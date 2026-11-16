package com.obhl.gateway.service;

import java.util.Comparator;
import java.time.Instant;
import java.sql.Timestamp;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SeasonRecapService {
    public record Game(long id, long homeTeamId, long awayTeamId, String homeTeam, String awayTeam,
                       Integer homeScore, Integer awayScore, String gameDate, String status,
                       String gameType, String playoffRound, Long forfeitTeamId, boolean overtime) {
        boolean complete() { return "completed".equalsIgnoreCase(status); }
        boolean scored() { return homeScore != null && awayScore != null && homeScore >= 0 && awayScore >= 0; }
        int goals() { return homeScore + awayScore; }
    }
    public record Champion(long teamId, String teamName, Game finalGame, boolean byForfeit) {}
    public record Recap(long seasonId, long gamesPlayed, long scoredGames, Long totalGoals,
                        long penaltiesRecorded, long penaltyMinutes, long forfeits,
                        Champion champion, String championNote, Game highestScoringGame, long highestScoringTies, Instant generatedAt) {}
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public SeasonRecapService(JdbcTemplate db, ObjectMapper json) { this.db = db; this.json = json; }

    @Transactional(readOnly = true)
    public Recap get(long seasonId) {
        requireCompleted(seasonId, false);
        List<String> saved = db.query("SELECT recap_json FROM season_recaps WHERE season_id = ?", (rs, n) -> rs.getString(1), seasonId);
        if (!saved.isEmpty()) {
            try { return json.readValue(saved.get(0), Recap.class); }
            catch (JsonProcessingException e) { throw new IllegalStateException("Could not read the published recap.", e); }
        }
        return calculate(seasonId);
    }

    @Transactional
    public Recap generate(long seasonId, String username) {
        List<Long> accounts = db.query("SELECT id FROM users WHERE username = ? AND is_active = true",
                (rs, n) -> rs.getLong(1), username);
        if (accounts.isEmpty()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "An active administrator account is required.");
        // Serialize publishers for this season; readers see the old or new complete snapshot.
        requireCompleted(seasonId, true);
        Recap live = calculate(seasonId);
        Recap saved = new Recap(live.seasonId(), live.gamesPlayed(), live.scoredGames(), live.totalGoals(),
                live.penaltiesRecorded(), live.penaltyMinutes(), live.forfeits(), live.champion(), live.championNote(),
                live.highestScoringGame(), live.highestScoringTies(), Instant.now());
        String payload;
        try { payload = json.writeValueAsString(saved); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not generate the recap.", e); }
        // The row lock makes this portable update/insert atomic, without requiring database-specific JSON casts.
        int updated = db.update("UPDATE season_recaps SET recap_json = ?, generated_at = ?, generated_by = ? WHERE season_id = ?",
                payload, Timestamp.from(saved.generatedAt()), accounts.get(0), seasonId);
        if (updated == 0) db.update("INSERT INTO season_recaps(season_id, recap_json, generated_at, generated_by) VALUES (?, ?, ?, ?)",
                seasonId, payload, Timestamp.from(saved.generatedAt()), accounts.get(0));
        return saved;
    }

    private void requireCompleted(long seasonId, boolean lock) {
        List<String> statuses = db.query("SELECT status FROM seasons WHERE id = ?" + (lock ? " FOR UPDATE" : ""), (rs, n) -> rs.getString(1), seasonId);
        if (statuses.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Season not found.");
        if (!"completed".equalsIgnoreCase(statuses.get(0)))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A recap is available once the season is completed.");
    }

    private Recap calculate(long seasonId) {
        List<Game> games = db.query("""
                SELECT g.*, h.name AS home_name, a.name AS away_name FROM games g
                LEFT JOIN teams h ON h.id = g.home_team_id
                LEFT JOIN teams a ON a.id = g.away_team_id
                WHERE g.season_id = ? AND (g.game_type IS NULL OR g.game_type IN ('REGULAR_SEASON', 'PLAYOFF'))
                ORDER BY g.game_date, g.id
                """, (rs, n) -> new Game(rs.getLong("id"), rs.getLong("home_team_id"), rs.getLong("away_team_id"),
                rs.getString("home_name"), rs.getString("away_name"), rs.getObject("home_score", Integer.class),
                rs.getObject("away_score", Integer.class), rs.getString("game_date"), rs.getString("status"),
                rs.getString("game_type"), rs.getString("playoff_round"), rs.getObject("forfeit_team_id", Long.class),
                rs.getBoolean("ended_in_ot") || rs.getBoolean("overtime")), seasonId);
        long[] penalties = db.queryForObject("""
                SELECT count(*), COALESCE(sum(e.penalty_minutes), 0) FROM game_events e
                JOIN games g ON g.id = e.game_id
                WHERE g.season_id = ? AND lower(g.status) = 'completed' AND g.forfeit_team_id IS NULL
                AND (g.game_type IS NULL OR g.game_type IN ('REGULAR_SEASON', 'PLAYOFF'))
                AND upper(e.event_type) = 'PENALTY'
                """, (rs, n) -> new long[]{rs.getLong(1), rs.getLong(2)}, seasonId);
        return summarize(seasonId, games, penalties[0], penalties[1]);
    }

    static Recap summarize(long seasonId, List<Game> games, long penalties, long minutes) {
        List<Game> completed = games.stream().filter(Game::complete).toList();
        List<Game> played = completed.stream().filter(g -> g.forfeitTeamId() == null).toList();
        List<Game> scored = played.stream().filter(Game::scored).toList();
        // Never infer a champion from standings, the last game, or an ambiguous series.
        List<Game> finals = games.stream().filter(g -> "PLAYOFF".equals(g.gameType()) && "FINAL".equals(g.playoffRound())).toList();
        Champion champion = null;
        String note = "No completed championship final is recorded.";
        if (finals.size() > 1) note = "Multiple finals are recorded; a champion could not be determined.";
        if (finals.size() == 1) {
            Game f = finals.get(0);
            if (f.complete() && (f.scored() || f.forfeitTeamId() != null)) {
                Long winner = null;
                if (f.forfeitTeamId() != null) {
                    if (f.forfeitTeamId() == f.homeTeamId()) winner = f.awayTeamId();
                    else if (f.forfeitTeamId() == f.awayTeamId()) winner = f.homeTeamId();
                } else if (f.homeScore() > f.awayScore()) winner = f.homeTeamId();
                else if (f.awayScore() > f.homeScore()) winner = f.awayTeamId();
                if (winner != null) {
                    String name = winner == f.homeTeamId() ? f.homeTeam() : f.awayTeam();
                    champion = new Champion(winner, name == null ? "Team #" + winner : name, f, f.forfeitTeamId() != null);
                    note = null;
                } else note = "The recorded final has no decisive winner yet.";
            }
        }
        Game highest = scored.stream().sorted(Comparator.comparingInt(Game::goals).reversed()
                .thenComparing(Game::gameDate, Comparator.nullsLast(Comparator.naturalOrder())).thenComparingLong(Game::id)).findFirst().orElse(null);
        long tied = highest == null ? 0 : scored.stream().filter(g -> g.goals() == highest.goals()).count();
        return new Recap(seasonId, played.size(), scored.size(), scored.isEmpty() ? null : scored.stream().mapToLong(Game::goals).sum(),
                penalties, minutes, completed.size() - played.size(), champion, note, highest, tied, null);
    }
}
