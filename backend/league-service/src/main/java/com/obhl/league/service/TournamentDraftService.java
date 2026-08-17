package com.obhl.league.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.league.client.StatsClient;
import com.obhl.league.client.TeamClient;
import com.obhl.league.dto.DraftDto;
import com.obhl.league.model.Tournament;
import com.obhl.league.model.TournamentDraft;
import com.obhl.league.model.TournamentDraftEntrant;
import com.obhl.league.model.TournamentDraftPick;
import com.obhl.league.repository.TournamentDraftEntrantRepository;
import com.obhl.league.repository.TournamentDraftPickRepository;
import com.obhl.league.repository.TournamentDraftRepository;
import com.obhl.league.repository.TournamentRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * The Conley Classic draft.
 *
 * <p>Operator-directed with no pick order: one person runs it from one screen, so there is no
 * snake, no rounds, no clock and no turn validation. What replaces the fairness that a pick order
 * would enforce is the live roster-balance read-out the board shows — which is why
 * {@link DraftDto.TeamRosterSummary} carries skater counts and average skill.
 *
 * <p>Every pick is persisted immediately. "Draft day, one laptop" is precisely the situation where
 * the browser gets closed, and a hundred round trips over an evening costs nothing.
 *
 * <p><b>Unlike the league draft, committing here does NOT retire other seasons and does NOT run the
 * unregistered-player sweep.</b> Both are league-draft behaviours; a tournament's lifecycle lives on
 * tournaments.status, and tournament entrants never appear in a league registration list.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TournamentDraftService {

    private final TournamentRepository tournamentRepository;
    private final TournamentDraftRepository draftRepository;
    private final TournamentDraftEntrantRepository entrantRepository;
    private final TournamentDraftPickRepository pickRepository;
    private final TeamClient teamClient;
    private final StatsClient statsClient;

    /** Goalies are assigned through the staffing flow, never drafted onto a roster. */
    private static final String POSITION_GOALIE = "G";

    // ---------------------------------------------------------------- board

    @Transactional
    public DraftDto.BoardResponse getBoard(Long tournamentId) {
        Tournament tournament = requireTournament(tournamentId);
        TournamentDraft draft = getOrCreateDraft(tournamentId);

        List<TournamentDraftEntrant> entrants =
                entrantRepository.findByTournamentIdOrderByLastNameAscFirstNameAsc(tournamentId);
        Map<Long, TournamentDraftPick> picksByEntrant = new HashMap<>();
        for (TournamentDraftPick p : pickRepository.findByTournamentIdOrderByPickNumberAsc(tournamentId)) {
            picksByEntrant.put(p.getEntrantId(), p);
        }

        List<Map<String, Object>> teams = safeTeams(tournament.getSeasonId());

        List<DraftDto.EntrantResponse> entrantDtos = new ArrayList<>();
        for (TournamentDraftEntrant e : entrants) {
            entrantDtos.add(toResponse(e, picksByEntrant.get(e.getId())));
        }

        List<DraftDto.TeamRosterSummary> teamDtos = new ArrayList<>();
        for (Map<String, Object> t : teams) {
            Long teamId = asLong(t.get("id"));
            List<TournamentDraftPick> teamPicks = pickRepository.findByTournamentIdAndTeamId(tournamentId, teamId);

            int skaters = 0;
            double skillTotal = 0;
            int rated = 0;
            Long captainEntrantId = null;
            for (TournamentDraftPick p : teamPicks) {
                TournamentDraftEntrant e = entrants.stream()
                        .filter(x -> x.getId().equals(p.getEntrantId())).findFirst().orElse(null);
                if (e == null) continue;
                skaters++;
                if (Boolean.TRUE.equals(e.getIsGm())) captainEntrantId = e.getId();
                if (e.getSkillRating() != null) { skillTotal += e.getSkillRating(); rated++; }
            }

            teamDtos.add(new DraftDto.TeamRosterSummary(
                    teamId,
                    (String) t.get("name"),
                    (String) t.get("teamColor"),
                    t.get("seed") == null ? null : ((Number) t.get("seed")).intValue(),
                    (String) t.get("pool"),
                    captainEntrantId,
                    skaters,
                    rated == 0 ? 0 : Math.round((skillTotal / rated) * 10.0) / 10.0));
        }
        teamDtos.sort(Comparator.comparing(
                DraftDto.TeamRosterSummary::getSeed, Comparator.nullsLast(Comparator.naturalOrder())));

        int assigned = (int) entrantDtos.stream().filter(e -> e.getTeamId() != null).count();
        int gmCount = (int) entrants.stream().filter(e -> Boolean.TRUE.equals(e.getIsGm())).count();

        List<String> warnings = new ArrayList<>();
        if (gmCount > 0 && teams.size() > 0 && gmCount != teams.size()) {
            warnings.add(gmCount + " GMs for " + teams.size() + " teams — these must match before "
                    + "GMs can be placed.");
        }
        long goalies = entrants.stream()
                .filter(e -> POSITION_GOALIE.equalsIgnoreCase(e.getPosition())).count();
        if (goalies > 0) {
            warnings.add(goalies + " entrant(s) are listed as goalies. Goalies are assigned through "
                    + "staffing, not drafted, so they are excluded from the pool.");
        }

        return new DraftDto.BoardResponse(
                tournamentId, draft.getStatus(), entrantDtos, teamDtos,
                entrantDtos.size(), assigned, entrantDtos.size() - assigned,
                gmCount, teams.size(), warnings);
    }

    // ---------------------------------------------------------------- import

    @Transactional
    public DraftDto.ImportResult importEntrants(Long tournamentId, DraftDto.ImportRequest request) {
        requireTournament(tournamentId);
        TournamentDraft draft = getOrCreateDraft(tournamentId);
        requireNotCommitted(draft);

        if (Boolean.TRUE.equals(request.getReplaceExisting())) {
            pickRepository.deleteByTournamentId(tournamentId);
            entrantRepository.deleteByTournamentId(tournamentId);
        }

        int created = 0, updated = 0, skipped = 0;
        List<String> warnings = new ArrayList<>();

        for (DraftDto.EntrantInput in : request.getEntrants()) {
            if (isBlank(in.getFirstName()) || isBlank(in.getLastName())) {
                skipped++;
                continue;
            }

            String email = normalizeEmail(in.getEmail());

            // Match case-insensitively, matching the partial unique index. A plain equals here
            // would let 'Bob@x.com' past an existing 'bob@x.com' and then fail at insert.
            Optional<TournamentDraftEntrant> existing = email == null
                    ? Optional.empty()
                    : entrantRepository.findByTournamentIdAndEmailIgnoreCase(tournamentId, email);

            TournamentDraftEntrant e = existing.orElseGet(TournamentDraftEntrant::new);
            boolean isNew = e.getId() == null;

            e.setTournamentId(tournamentId);
            e.setFirstName(in.getFirstName().trim());
            e.setLastName(in.getLastName().trim());
            e.setEmail(email);
            e.setPhone(in.getPhone());
            e.setPosition(in.getPosition() == null ? null : in.getPosition().trim().toUpperCase(Locale.ROOT));
            e.setJerseyNumber(in.getJerseyNumber());
            e.setSkillRating(in.getSkillRating());
            if (in.getIsGm() != null) e.setIsGm(in.getIsGm());
            if (in.getPaid() != null) e.setPaid(in.getPaid());
            e.setNotes(in.getNotes());

            entrantRepository.save(e);
            if (isNew) created++; else updated++;
        }

        if (skipped > 0) warnings.add(skipped + " row(s) skipped for a missing first or last name.");

        long noEmail = entrantRepository.findByTournamentIdOrderByLastNameAscFirstNameAsc(tournamentId)
                .stream().filter(e -> e.getEmail() == null).count();
        if (noEmail > 0) {
            warnings.add(noEmail + " entrant(s) have no email. They can still be drafted; a "
                    + "placeholder address is generated at commit so they never receive mail.");
        }

        log.info("Tournament {} draft import: {} created, {} updated, {} skipped",
                tournamentId, created, updated, skipped);
        return new DraftDto.ImportResult(created, updated, skipped, warnings);
    }

    // ---------------------------------------------------------------- account linking

    /**
     * Matches entrants against user accounts, exact email first and full name second.
     *
     * <p>Nothing is linked automatically when more than one account matches — the whole point of
     * the review screen is that a wrong link silently attaches one person's tournament history to
     * another's account. Entrants already confirmed by the operator are left alone.
     */
    @Transactional
    public DraftDto.BoardResponse matchAccounts(Long tournamentId) {
        requireTournament(tournamentId);

        List<Map<String, Object>> users;
        try {
            users = teamClient.getUsers();
        } catch (Exception ex) {
            log.warn("Could not reach the gateway for user matching: {}", ex.getMessage());
            throw new IllegalStateException("Could not load user accounts to match against.");
        }

        for (TournamentDraftEntrant e : entrantRepository.findByTournamentIdOrderByLastNameAscFirstNameAsc(tournamentId)) {
            if (TournamentDraftEntrant.LINK_CONFIRMED.equals(e.getLinkStatus())) continue;

            List<Map<String, Object>> hits = candidatesFor(e, users);

            if (hits.isEmpty()) {
                e.setUserId(null);
                e.setLinkStatus(TournamentDraftEntrant.LINK_NONE);
            } else if (hits.size() == 1) {
                e.setUserId(asLong(hits.get(0).get("id")));
                e.setLinkStatus(TournamentDraftEntrant.LINK_MATCHED);
            } else {
                // Deliberately leaves userId null: an ambiguous match must be resolved by a human.
                e.setUserId(null);
                e.setLinkStatus(TournamentDraftEntrant.LINK_AMBIGUOUS);
            }
            entrantRepository.save(e);
        }

        return getBoard(tournamentId);
    }

    private List<Map<String, Object>> candidatesFor(TournamentDraftEntrant e, List<Map<String, Object>> users) {
        List<Map<String, Object>> hits = new ArrayList<>();

        if (e.getEmail() != null) {
            for (Map<String, Object> u : users) {
                String ue = normalizeEmail((String) u.get("email"));
                if (ue != null && ue.equals(e.getEmail())) hits.add(u);
            }
            if (!hits.isEmpty()) return hits;
        }

        String full = (e.getFirstName() + " " + e.getLastName()).trim().toLowerCase(Locale.ROOT);
        for (Map<String, Object> u : users) {
            String un = ((String) java.util.Objects.toString(u.get("firstName"), "") + " "
                    + java.util.Objects.toString(u.get("lastName"), "")).trim().toLowerCase(Locale.ROOT);
            if (!un.isBlank() && un.equals(full)) hits.add(u);
        }
        return hits;
    }

    @Transactional
    public DraftDto.EntrantResponse setLink(Long tournamentId, Long entrantId, Long userId) {
        TournamentDraftEntrant e = requireEntrant(tournamentId, entrantId);
        e.setUserId(userId);
        // 'confirmed' even when clearing: the operator has made a decision, so a later re-match
        // must not overwrite it.
        e.setLinkStatus(TournamentDraftEntrant.LINK_CONFIRMED);
        entrantRepository.save(e);
        return toResponse(e, pickRepository.findByTournamentIdAndEntrantId(tournamentId, entrantId).orElse(null));
    }

    // ---------------------------------------------------------------- GMs

    /**
     * Seats the GM-flagged entrants one per team, before the pool is drafted from.
     *
     * <p>Refuses on a count mismatch rather than seating some and leaving others: a wrong GM count
     * on draft day is the most likely error here, and half-seating it is harder to unpick than not
     * starting.
     */
    @Transactional
    public DraftDto.BoardResponse placeGms(Long tournamentId) {
        Tournament tournament = requireTournament(tournamentId);
        TournamentDraft draft = getOrCreateDraft(tournamentId);
        requireNotCommitted(draft);

        List<TournamentDraftEntrant> gms = entrantRepository.findByTournamentIdAndIsGmTrue(tournamentId);
        List<Map<String, Object>> teams = safeTeams(tournament.getSeasonId());

        if (gms.isEmpty()) {
            throw new IllegalArgumentException("No entrants are flagged as GMs. Mark the GMs in the "
                    + "import, or set the flag on the entrant list first.");
        }
        if (teams.isEmpty()) {
            throw new IllegalArgumentException("This tournament has no teams yet. Create the teams "
                    + "before placing GMs.");
        }
        if (gms.size() != teams.size()) {
            throw new IllegalArgumentException("There are " + gms.size() + " GMs and " + teams.size()
                    + " teams. These must match before GMs can be placed.");
        }

        teams.sort(Comparator.comparing(t -> t.get("seed") == null ? Integer.MAX_VALUE
                : ((Number) t.get("seed")).intValue()));
        gms.sort(Comparator.comparing(TournamentDraftEntrant::getLastName,
                Comparator.nullsLast(Comparator.naturalOrder())));

        int seq = nextPickNumber(tournamentId);
        for (int i = 0; i < gms.size(); i++) {
            seq = upsertPick(tournamentId, gms.get(i).getId(), asLong(teams.get(i).get("id")), seq);
        }

        draft.setStatus(TournamentDraft.STATUS_LIVE);
        draftRepository.save(draft);

        log.info("Placed {} GMs across {} teams for tournament {}", gms.size(), teams.size(), tournamentId);
        return getBoard(tournamentId);
    }

    // ---------------------------------------------------------------- assignment

    @Transactional
    public DraftDto.BoardResponse assign(Long tournamentId, Long entrantId, Long teamId) {
        TournamentDraft draft = getOrCreateDraft(tournamentId);
        requireNotCommitted(draft);

        TournamentDraftEntrant e = requireEntrant(tournamentId, entrantId);
        if (POSITION_GOALIE.equalsIgnoreCase(e.getPosition())) {
            throw new IllegalArgumentException(e.getFirstName() + " " + e.getLastName()
                    + " is a goalie. Goalies are assigned to games through staffing, not drafted "
                    + "onto a roster.");
        }

        upsertPick(tournamentId, entrantId, teamId, nextPickNumber(tournamentId));

        if (TournamentDraft.STATUS_SETUP.equals(draft.getStatus())) {
            draft.setStatus(TournamentDraft.STATUS_LIVE);
            draftRepository.save(draft);
        }
        return getBoard(tournamentId);
    }

    /** Returns an entrant to the pool. Reassignment is free — nothing depends on order. */
    @Transactional
    public DraftDto.BoardResponse unassign(Long tournamentId, Long entrantId) {
        requireNotCommitted(getOrCreateDraft(tournamentId));
        pickRepository.deleteByTournamentIdAndEntrantId(tournamentId, entrantId);
        return getBoard(tournamentId);
    }

    /** Undoes the most recent assignment. */
    @Transactional
    public DraftDto.BoardResponse undo(Long tournamentId) {
        requireNotCommitted(getOrCreateDraft(tournamentId));
        List<TournamentDraftPick> picks = pickRepository.findByTournamentIdOrderByPickNumberAsc(tournamentId);
        if (!picks.isEmpty()) {
            pickRepository.delete(picks.get(picks.size() - 1));
        }
        return getBoard(tournamentId);
    }

    // ---------------------------------------------------------------- commit

    /**
     * Turns the board into real player rows.
     *
     * <p>Idempotent per entrant: an existing players row for the same (email, season) is reused
     * rather than duplicated, matching how the league draft finalises. Re-committing is blocked
     * outright.
     *
     * <p>Deliberately absent: retiring other seasons, and the unregistered-player sweep. Both are
     * league-draft behaviours and both would be wrong here.
     */
    @Transactional
    public DraftDto.CommitResult commit(Long tournamentId) {
        Tournament tournament = requireTournament(tournamentId);
        TournamentDraft draft = getOrCreateDraft(tournamentId);

        if (TournamentDraft.STATUS_COMMITTED.equals(draft.getStatus())) {
            throw new IllegalStateException("This draft has already been committed.");
        }

        List<TournamentDraftPick> picks = pickRepository.findByTournamentIdOrderByPickNumberAsc(tournamentId);
        if (picks.isEmpty()) {
            throw new IllegalArgumentException("Nothing has been drafted yet.");
        }

        Long seasonId = tournament.getSeasonId();
        List<String> warnings = new ArrayList<>();
        int createdCount = 0, reusedCount = 0, teamsUpdated = 0;
        Map<Long, Long> captainByTeam = new HashMap<>();

        for (TournamentDraftPick pick : picks) {
            TournamentDraftEntrant e = entrantRepository.findById(pick.getEntrantId()).orElse(null);
            if (e == null) continue;

            String email = e.getEmail() != null
                    ? e.getEmail()
                    // RFC 2606 reserved TLD: can never be routed, so a placeholder cannot
                    // accidentally mail a real person. Stable, so re-running is safe.
                    : "noemail+" + tournament.getSlug() + "-" + e.getId() + "@obhl.invalid";

            Map<String, Object> existing = null;
            try {
                existing = statsClient.getPlayerByEmailAndSeason(email, seasonId);
            } catch (Exception ignored) {
                // by-email-season 404s for a new player; that is the normal path.
            }

            Long playerId;
            if (existing != null && existing.get("id") != null) {
                playerId = asLong(existing.get("id"));
                Map<String, Object> patch = new HashMap<>();
                patch.put("teamId", pick.getTeamId());
                patch.put("isActive", true);
                statsClient.updatePlayer(playerId, patch);
                reusedCount++;
            } else {
                Map<String, Object> body = new HashMap<>();
                body.put("firstName", e.getFirstName());
                body.put("lastName", e.getLastName());
                body.put("email", email);
                body.put("seasonId", seasonId);
                body.put("teamId", pick.getTeamId());
                body.put("position", e.getPosition() == null ? "F" : e.getPosition());
                body.put("jerseyNumber", e.getJerseyNumber());
                body.put("skillRating", e.getSkillRating());
                body.put("isActive", true);
                body.put("userId", e.getUserId());
                body.put("draftPick", pick.getPickNumber());

                Map<String, Object> created = statsClient.createPlayer(body);
                playerId = asLong(created.get("id"));
                createdCount++;
            }

            if (Boolean.TRUE.equals(e.getIsGm()) && playerId != null) {
                captainByTeam.put(pick.getTeamId(), playerId);
            }
        }

        for (Map.Entry<Long, Long> entry : captainByTeam.entrySet()) {
            try {
                Map<String, Object> patch = new HashMap<>();
                patch.put("captainPlayerId", entry.getValue());
                teamClient.updateTeam(entry.getKey(), patch);
                teamsUpdated++;
            } catch (Exception ex) {
                warnings.add("Could not set the captain on team " + entry.getKey() + ": " + ex.getMessage());
            }
        }

        draft.setStatus(TournamentDraft.STATUS_COMMITTED);
        draft.setCommittedAt(java.time.LocalDateTime.now());
        draftRepository.save(draft);

        if (Tournament.STATUS_SETUP.equals(tournament.getStatus())
                || Tournament.STATUS_DRAFT.equals(tournament.getStatus())) {
            tournament.setStatus(Tournament.STATUS_SCHEDULED);
            tournamentRepository.save(tournament);
        }

        log.info("Committed tournament {} draft: {} players created, {} reused, {} captains set",
                tournamentId, createdCount, reusedCount, teamsUpdated);
        return new DraftDto.CommitResult(createdCount, reusedCount, teamsUpdated, warnings);
    }

    // ---------------------------------------------------------------- helpers

    private int upsertPick(Long tournamentId, Long entrantId, Long teamId, int nextSeq) {
        Optional<TournamentDraftPick> existing =
                pickRepository.findByTournamentIdAndEntrantId(tournamentId, entrantId);

        if (existing.isPresent()) {
            // Reassignment keeps the original pick_number: the sequence records when someone
            // entered the draft, and renumbering would scramble undo.
            TournamentDraftPick p = existing.get();
            p.setTeamId(teamId);
            pickRepository.save(p);
            return nextSeq;
        }

        TournamentDraftPick p = new TournamentDraftPick();
        p.setTournamentId(tournamentId);
        p.setEntrantId(entrantId);
        p.setTeamId(teamId);
        p.setPickNumber(nextSeq);
        pickRepository.save(p);
        return nextSeq + 1;
    }

    private int nextPickNumber(Long tournamentId) {
        return pickRepository.findByTournamentIdOrderByPickNumberAsc(tournamentId).stream()
                .mapToInt(TournamentDraftPick::getPickNumber).max().orElse(0) + 1;
    }

    private DraftDto.EntrantResponse toResponse(TournamentDraftEntrant e, TournamentDraftPick pick) {
        DraftDto.EntrantResponse dto = new DraftDto.EntrantResponse();
        dto.setId(e.getId());
        dto.setFirstName(e.getFirstName());
        dto.setLastName(e.getLastName());
        dto.setEmail(e.getEmail());
        dto.setPhone(e.getPhone());
        dto.setPosition(e.getPosition());
        dto.setJerseyNumber(e.getJerseyNumber());
        dto.setSkillRating(e.getSkillRating());
        dto.setIsGm(e.getIsGm());
        dto.setPaid(e.getPaid());
        dto.setNotes(e.getNotes());
        dto.setUserId(e.getUserId());
        dto.setLinkStatus(e.getLinkStatus());
        dto.setCandidates(List.of());
        dto.setTeamId(pick == null ? null : pick.getTeamId());
        dto.setPickNumber(pick == null ? null : pick.getPickNumber());
        return dto;
    }

    private List<Map<String, Object>> safeTeams(Long seasonId) {
        try {
            List<Map<String, Object>> teams = teamClient.getTeamsBySeasonId(seasonId);
            return teams == null ? new ArrayList<>() : new ArrayList<>(teams);
        } catch (Exception ex) {
            log.warn("Could not load teams for season {}: {}", seasonId, ex.getMessage());
            return new ArrayList<>();
        }
    }

    private Tournament requireTournament(Long id) {
        return tournamentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tournament not found"));
    }

    private TournamentDraftEntrant requireEntrant(Long tournamentId, Long entrantId) {
        TournamentDraftEntrant e = entrantRepository.findById(entrantId)
                .orElseThrow(() -> new RuntimeException("Entrant not found"));
        if (!e.getTournamentId().equals(tournamentId)) {
            throw new RuntimeException("Entrant does not belong to this tournament");
        }
        return e;
    }

    private void requireNotCommitted(TournamentDraft draft) {
        if (TournamentDraft.STATUS_COMMITTED.equals(draft.getStatus())) {
            throw new IllegalStateException("This draft has been committed and can no longer be changed.");
        }
    }

    private TournamentDraft getOrCreateDraft(Long tournamentId) {
        return draftRepository.findByTournamentId(tournamentId).orElseGet(() -> {
            TournamentDraft d = new TournamentDraft();
            d.setTournamentId(tournamentId);
            return draftRepository.save(d);
        });
    }

    /** Lower-cased and trimmed; blank becomes null. Applied at every write in this path. */
    private String normalizeEmail(String email) {
        if (email == null) return null;
        String v = email.trim().toLowerCase(Locale.ROOT);
        return v.isEmpty() ? null : v;
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private Long asLong(Object o) {
        return o == null ? null : ((Number) o).longValue();
    }
}
