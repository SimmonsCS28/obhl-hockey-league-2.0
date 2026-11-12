package com.obhl.gateway.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.repository.UserRepository;

@Service
public class PollService {
    public record CreatePoll(String question, String description, List<String> options, Instant closesAt) {}
    public record Vote(Long optionId) {}
    public record Option(long id, String label, long votes) {}
    public record Poll(long id, String question, String description, Instant createdAt, Instant closesAt,
                       boolean closed, Long myOptionId, long totalVotes, List<Option> options) {}
    private record Row(long id, String question, String description, Instant createdAt,
                       Instant closesAt, Instant closedAt) {
        boolean closed() { return closedAt != null || (closesAt != null && !closesAt.isAfter(Instant.now())); }
    }

    private final JdbcTemplate db;
    private final UserRepository users;
    public PollService(JdbcTemplate db, UserRepository users) { this.db = db; this.users = users; }

    // Recheck the account as well as the JWT: deleted or deactivated accounts cannot vote.
    private long account(String username) {
        return users.findByUsername(username).filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "An active account is required."))
                .getId();
    }

    @Transactional(readOnly = true)
    public List<Poll> list(String username) {
        long userId = account(username);
        return db.query("SELECT * FROM member_polls ORDER BY created_at DESC, id DESC LIMIT 100", this::row)
                .stream().map(p -> view(p, userId)).sorted(java.util.Comparator.comparing(Poll::closed)).toList();
    }

    @Transactional
    public Poll create(String username, CreatePoll input) {
        long userId = account(username);
        if (input == null) throw bad("Enter a question and at least two choices.");
        String question = clean(input.question(), 180, "Question");
        String description = input.description() == null ? "" : input.description().trim();
        if (description.length() > 1000) throw bad("Description must be 1000 characters or fewer.");
        if (input.options() == null || input.options().size() < 2 || input.options().size() > 8)
            throw bad("Add between 2 and 8 choices.");
        List<String> options = input.options().stream().map(s -> clean(s, 120, "Choice")).toList();
        var unique = new HashSet<String>();
        if (options.stream().anyMatch(s -> !unique.add(s.toLowerCase(Locale.ROOT))))
            throw bad("Each choice must be different.");
        if (input.closesAt() != null && !input.closesAt().isAfter(Instant.now()))
            throw bad("Choose a closing time in the future.");
        Long id = db.queryForObject("""
                INSERT INTO member_polls(question, description, created_by, closes_at)
                VALUES (?, ?, ?, ?) RETURNING id
                """, Long.class, question, description, userId, timestamp(input.closesAt()));
        for (int i = 0; i < options.size(); i++)
            db.update("INSERT INTO member_poll_options(poll_id, label, position) VALUES (?, ?, ?)", id, options.get(i), i);
        return view(find(id, false), userId);
    }

    @Transactional
    public Poll vote(String username, long pollId, Vote input) {
        long userId = account(username);
        // Vote and close acquire the same row lock. A close cannot race a vote past the cutoff.
        Row poll = find(pollId, true);
        if (poll.closed()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Voting has closed. See the final results.");
        if (input == null || input.optionId() == null || !Boolean.TRUE.equals(db.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM member_poll_options WHERE poll_id = ? AND id = ?)",
                Boolean.class, pollId, input.optionId()))) throw bad("Choose an option from this poll.");
        db.update("""
                INSERT INTO member_poll_votes(poll_id, user_id, option_id) VALUES (?, ?, ?)
                ON CONFLICT (poll_id, user_id) DO UPDATE
                SET option_id = EXCLUDED.option_id, updated_at = CURRENT_TIMESTAMP
                """, pollId, userId, input.optionId());
        return view(poll, userId);
    }

    @Transactional
    public Poll close(String username, long pollId) {
        long userId = account(username);
        find(pollId, true);
        db.update("UPDATE member_polls SET closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP) WHERE id = ?", pollId);
        return view(find(pollId, false), userId);
    }

    private Poll view(Row poll, long userId) {
        List<Option> options = db.query("""
                SELECT o.id, o.label, count(v.user_id) AS votes FROM member_poll_options o
                LEFT JOIN member_poll_votes v ON v.poll_id = o.poll_id AND v.option_id = o.id
                WHERE o.poll_id = ? GROUP BY o.id, o.label, o.position ORDER BY o.position
                """, (rs, n) -> new Option(rs.getLong("id"), rs.getString("label"), rs.getLong("votes")), poll.id());
        List<Long> own = db.query("SELECT option_id FROM member_poll_votes WHERE poll_id = ? AND user_id = ?",
                (rs, n) -> rs.getLong(1), poll.id(), userId);
        return new Poll(poll.id(), poll.question(), poll.description(), poll.createdAt(), poll.closesAt(),
                poll.closed(), own.isEmpty() ? null : own.get(0), options.stream().mapToLong(Option::votes).sum(), options);
    }

    private Row find(long id, boolean lock) {
        return db.query("SELECT * FROM member_polls WHERE id = ?" + (lock ? " FOR UPDATE" : ""), this::row, id)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Poll not found."));
    }
    private Row row(ResultSet rs, int index) throws SQLException {
        return new Row(rs.getLong("id"), rs.getString("question"), rs.getString("description"),
                instant(rs, "created_at"), instant(rs, "closes_at"), instant(rs, "closed_at"));
    }
    private static Instant instant(ResultSet rs, String name) throws SQLException {
        Timestamp value = rs.getTimestamp(name); return value == null ? null : value.toInstant();
    }
    private static Timestamp timestamp(Instant value) { return value == null ? null : Timestamp.from(value); }
    private static String clean(String value, int max, String name) {
        if (value == null || value.isBlank() || value.trim().length() > max)
            throw bad(name + " must be between 1 and " + max + " characters.");
        return value.trim();
    }
    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
