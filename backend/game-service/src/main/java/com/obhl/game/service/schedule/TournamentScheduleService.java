package com.obhl.game.service.schedule;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.game.client.TeamClient;
import com.obhl.game.dto.GameSlot;
import com.obhl.game.dto.TeamResponse;
import com.obhl.game.model.Game;
import com.obhl.game.repository.GameRepository;
import com.obhl.game.service.schedule.TournamentScheduleGenerator.Config;
import com.obhl.game.service.schedule.TournamentScheduleGenerator.Plan;
import com.obhl.game.service.schedule.TournamentScheduleGenerator.PlannedGame;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Turns a {@link TournamentScheduleGenerator} plan into real games.
 *
 * <p>Preview and save are separate, mirroring the league generator: the organiser looks at 18 rows
 * before a weekend's ice is committed to them.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TournamentScheduleService {

    /** The rink's wall-clock zone; slot sheets are written in it. */
    private static final ZoneId ARENA_ZONE = ZoneId.of("America/Chicago");

    private final GameRepository gameRepository;
    private final TeamClient teamClient;

    @Data
    public static class GenerateRequest {
        private Long seasonId;
        private Integer teamCount;
        private String groupStage;
        private Integer poolCount;
        private Integer advancePerPool;
        private String championshipStage;
        private Boolean placementGame;
        private String consolationStage;
        private Integer consolationTeamCount;
        private Short periodCount;
        private String venue;
        /** Ice slots, in the order games should fill them. */
        private List<GameSlot> slots;
    }

    @Data
    public static class GenerateResult {
        private List<Game> games;
        private List<String> warnings;
        private List<String> errors;
        private int required;
        private int slotsAvailable;

        public boolean ok() {
            return errors.isEmpty();
        }
    }

    /** Builds the fixture list without saving anything. */
    public GenerateResult preview(GenerateRequest req) {
        GenerateResult result = new GenerateResult();
        result.setWarnings(new ArrayList<>());
        result.setErrors(new ArrayList<>());
        result.setGames(new ArrayList<>());

        List<TeamResponse> teams = teamClient.getTeams(req.getSeasonId());
        if (teams == null) teams = List.of();

        // Seeds are the generator's currency, so an unseeded field cannot be scheduled. Fall back to
        // id order rather than refusing outright -- a small tournament may never set seeds.
        List<TeamResponse> ordered = new ArrayList<>(teams);
        boolean seeded = ordered.stream().anyMatch(t -> t.getSeed() != null);
        if (seeded) {
            ordered.sort(Comparator.comparing(TeamResponse::getSeed,
                    Comparator.nullsLast(Comparator.naturalOrder())));
        } else {
            ordered.sort(Comparator.comparing(TeamResponse::getId));
            result.getWarnings().add("No teams are seeded, so the draw follows team order.");
        }

        int teamCount = req.getTeamCount() != null ? req.getTeamCount() : ordered.size();
        if (ordered.size() < teamCount) {
            result.getErrors().add("The format expects " + teamCount + " teams but this tournament has "
                    + ordered.size() + ". Create the missing teams first.");
            return result;
        }

        Config cfg = new Config(
                teamCount,
                or(req.getGroupStage(), TournamentScheduleGenerator.GROUP_ROUND_ROBIN),
                req.getPoolCount() == null ? 2 : req.getPoolCount(),
                req.getAdvancePerPool() == null ? 2 : req.getAdvancePerPool(),
                or(req.getChampionshipStage(), TournamentScheduleGenerator.CHAMPIONSHIP_NONE),
                Boolean.TRUE.equals(req.getPlacementGame()),
                or(req.getConsolationStage(), TournamentScheduleGenerator.CONSOLATION_NONE),
                req.getConsolationTeamCount() == null ? 0 : req.getConsolationTeamCount());

        Plan plan = TournamentScheduleGenerator.generate(cfg);
        result.getWarnings().addAll(plan.warnings());
        result.setRequired(plan.size());

        List<GameSlot> slots = req.getSlots() == null ? List.of() : new ArrayList<>(req.getSlots());
        slots.sort(Comparator.comparing(GameSlot::getDate).thenComparing(GameSlot::getTime));
        result.setSlotsAvailable(slots.size());

        // Up front, not partway through. The league generator silently cycles or truncates, which
        // here would quietly drop the consolation games nobody notices until the weekend.
        if (!slots.isEmpty() && slots.size() < plan.size()) {
            result.getErrors().add("This format needs " + plan.size() + " games but only "
                    + slots.size() + " ice slot(s) were supplied. Add slots or change the format.");
            return result;
        }
        if (slots.isEmpty()) {
            result.getWarnings().add("No ice slots supplied — games are listed without dates or rinks.");
        }

        Map<String, List<Integer>> divisions = plan.divisions();

        int slotIndex = 0;
        for (PlannedGame pg : plan.games()) {
            Game g = new Game();
            g.setSeasonId(req.getSeasonId());
            g.setGameType("TOURNAMENT");
            g.setTournamentStage(pg.stage());
            g.setPlayoffRound(pg.round());
            g.setBracketPosition(pg.bracketPosition());
            g.setPeriodCount(req.getPeriodCount() == null ? (short) 2 : req.getPeriodCount());
            g.setStatus("scheduled");
            g.setVenue(req.getVenue());
            // week doubles as the day index for a weekend event; every downstream filter groups by it.
            g.setWeek(pg.dayIndex());

            if (pg.homeSeed() != null) g.setHomeTeamId(teamIdForSeed(ordered, pg.homeSeed()));
            if (pg.awaySeed() != null) g.setAwayTeamId(teamIdForSeed(ordered, pg.awaySeed()));

            if (slotIndex < slots.size()) {
                GameSlot slot = slots.get(slotIndex++);
                // games.game_date is stored in UTC (hibernate.jdbc.time_zone=UTC, and every reader
                // parses it as UTC). The organiser types rink-local times, so convert exactly as
                // ScheduleGeneratorService does -- storing the wall-clock time directly puts every
                // game five hours out, which only shows up on the pages that read it correctly.
                g.setGameDate(LocalDateTime.of(slot.getDate(), slot.getTime())
                        .atZone(ARENA_ZONE)
                        .withZoneSameInstant(ZoneOffset.UTC)
                        .toLocalDateTime());
                g.setRink(slot.getRink());
            }

            result.getGames().add(g);
        }

        log.info("Previewed {} tournament games for season {} ({} slots)",
                result.getGames().size(), req.getSeasonId(), slots.size());

        if (!divisions.isEmpty()) {
            result.getWarnings().add("Divisions: " + divisions.entrySet().stream()
                    .filter(e -> !e.getKey().isEmpty())
                    .map(e -> e.getKey() + " = seeds " + e.getValue())
                    .toList());
        }

        return result;
    }

    /**
     * Persists a previewed schedule, replacing any tournament games already generated for the
     * season.
     *
     * <p>Replaces rather than appends: regenerating after a format change is the normal reason to
     * run this, and leaving the previous fixtures behind would double the schedule. Completed games
     * are refused rather than deleted -- once results exist, regenerating is a mistake.
     */
    @Transactional
    public GenerateResult save(GenerateRequest req) {
        GenerateResult preview = preview(req);
        if (!preview.ok()) return preview;

        List<Game> existing = gameRepository.findBySeasonIdOrderByGameDate(req.getSeasonId()).stream()
                .filter(g -> "TOURNAMENT".equals(g.getGameType()))
                .toList();

        long played = existing.stream().filter(g -> "completed".equals(g.getStatus())).count();
        if (played > 0) {
            preview.getErrors().add(played + " tournament game(s) have already been played. "
                    + "Regenerating would delete them — unfinalize or remove them first if this is intended.");
            return preview;
        }

        if (!existing.isEmpty()) {
            gameRepository.deleteAll(existing);
            preview.getWarnings().add("Replaced " + existing.size() + " previously generated game(s).");
        }

        List<Game> saved = gameRepository.saveAll(preview.getGames());
        preview.setGames(saved);

        log.info("Saved {} tournament games for season {}", saved.size(), req.getSeasonId());
        return preview;
    }

    private Long teamIdForSeed(List<TeamResponse> ordered, int seed) {
        // Seeds are 1-based positions in the ordered list, so a gap in the seed numbers still
        // resolves to a real team rather than nothing.
        int idx = seed - 1;
        return (idx >= 0 && idx < ordered.size()) ? ordered.get(idx).getId() : null;
    }

    private String or(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
