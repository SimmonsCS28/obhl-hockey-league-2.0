package com.obhl.game.service;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.game.dto.GameSlot;
import com.obhl.game.dto.TimeSlotStats;
import com.obhl.game.model.Game;
import com.obhl.game.repository.GameRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleGeneratorService {

    private final GameRepository gameRepository;

    /**
     * Generate round-robin schedule for a season
     * 
     * @param seasonId Season to generate schedule for
     * @param leagueId League ID
     * @param teamIds  List of team IDs
     * @param slots    Parsed game slots from CSV
     * @param maxWeeks Maximum weeks to schedule (typically n-3 for playoffs)
     * @return List of generated games
     */
    @Transactional
    public List<Game> generateSchedule(Long seasonId, Long leagueId, List<Long> teamIds,
            List<GameSlot> slots, Integer maxWeeks) {
        return generateSchedule(seasonId, leagueId, teamIds, slots, maxWeeks, 0);
    }

    @Transactional
    public List<Game> generateSchedule(Long seasonId, Long leagueId, List<Long> teamIds,
            List<GameSlot> slots, Integer maxWeeks, Integer playoffWeeks) {

        log.info("Generating schedule for season {} with {} teams and {} slots",
                seasonId, teamIds.size(), slots.size());

        // Validate inputs
        if (teamIds.size() < 2) {
            throw new RuntimeException("Need at least 2 teams to generate schedule");
        }

        if (teamIds.size() % 2 != 0) {
            throw new RuntimeException("Need an even number of teams for round-robin scheduling");
        }

        // Check for existing schedule
        if (hasExistingSchedule(seasonId)) {
            throw new RuntimeException("Schedule already exists for this season. Please reset first.");
        }

        // Filter slots by maxWeeks
        List<GameSlot> filteredSlots = slots.stream()
                .filter(slot -> slot.getWeek() <= maxWeeks)
                .toList();

        if (filteredSlots.isEmpty()) {
            throw new RuntimeException("No game slots available within " + maxWeeks + " weeks");
        }

        // Generate round-robin matchups
        List<Matchup> matchups = createRoundRobinMatchups(teamIds);

        // Cycle matchups to fill all available slots
        List<Matchup> cycledMatchups = cycleMatchups(matchups, filteredSlots.size());

        // Assign matchups to slots with time balancing
        List<Game> games = assignSlotsWithBalancing(seasonId, leagueId, teamIds, cycledMatchups, filteredSlots);

        // Return games WITHOUT saving - this is a preview/draft
        // Games will be saved when user explicitly clicks "Save Schedule"
        log.info("Successfully generated {} draft games (not saved to database)", games.size());

        // Generate playoff week placeholders if requested
        if (playoffWeeks != null && playoffWeeks > 0) {
            List<Game> playoffGames = generatePlayoffSlots(seasonId, leagueId, slots, maxWeeks, playoffWeeks);
            games.addAll(playoffGames);
            log.info("Added {} playoff placeholder games", playoffGames.size());
        }

        return games;
    }

    /**
     * Create round-robin matchups using circle algorithm
     * For N teams, creates (N-1) rounds with N/2 games per round
     */
    private List<Matchup> createRoundRobinMatchups(List<Long> teamIds) {
        int n = teamIds.size();
        List<Matchup> matchups = new ArrayList<>();

        // Create a working copy of team IDs
        List<Long> teams = new ArrayList<>(teamIds);

        // Number of rounds = n - 1
        for (int round = 0; round < n - 1; round++) {
            // Each round has n/2 games
            for (int game = 0; game < n / 2; game++) {
                int home = game;
                int away = n - 1 - game;

                // Alternate home/away based on round
                boolean homeFirst = (round + game) % 2 == 0;

                if (homeFirst) {
                    matchups.add(new Matchup(teams.get(home), teams.get(away)));
                } else {
                    matchups.add(new Matchup(teams.get(away), teams.get(home)));
                }
            }

            // Rotate teams (keep first team fixed, rotate others)
            Long lastTeam = teams.remove(n - 1);
            teams.add(1, lastTeam);
        }

        log.info("Created {} round-robin matchups for {} teams", matchups.size(), n);
        return matchups;
    }

    /**
     * Generate playoff week placeholder games (TBD teams, gameType=PLAYOFF).
     * Round names (QUARTERFINAL/SEMIFINAL/FINAL) are assigned based on how
     * many playoff weeks there are and which week we are processing.
     *
     * Standard mapping:
     *   1 week  → FINAL
     *   2 weeks → SEMIFINAL, FINAL
     *   3 weeks → QUARTERFINAL, SEMIFINAL, FINAL
     */
    private List<Game> generatePlayoffSlots(Long seasonId, Long leagueId,
            List<GameSlot> allSlots, int maxWeeks, int playoffWeeks) {

        // Build ordered round names for the playoff weeks
        String[] allRounds = {"QUARTERFINAL", "SEMIFINAL", "FINAL"};
        // Take the last `playoffWeeks` entries from allRounds
        int startIdx = Math.max(0, allRounds.length - playoffWeeks);
        String[] rounds = java.util.Arrays.copyOfRange(allRounds, startIdx, allRounds.length);

        List<Game> playoffGames = new ArrayList<>();

        for (int i = 0; i < rounds.length; i++) {
            int playoffWeekNumber = maxWeeks + i + 1; // e.g. week 12, 13, 14
            String round = rounds[i];

            // Get slots for this playoff week
            final int weekNum = playoffWeekNumber;
            List<GameSlot> weekSlots = allSlots.stream()
                    .filter(slot -> slot.getWeek() == weekNum)
                    .sorted(java.util.Comparator.comparing(GameSlot::getTime))
                    .toList();

            int position = 1;
            for (GameSlot slot : weekSlots) {
                Game game = new Game();
                game.setSeasonId(seasonId);
                game.setLeagueId(leagueId);
                game.setHomeTeamId(null); // TBD — bracket not yet initialized
                game.setAwayTeamId(null); // TBD
                game.setGameDate(LocalDateTime.of(slot.getDate(), slot.getTime())
                        .atZone(java.time.ZoneId.of("America/Chicago"))
                        .withZoneSameInstant(java.time.ZoneId.of("UTC"))
                        .toLocalDateTime());
                game.setWeek(playoffWeekNumber);
                game.setRink(slot.getRink());
                game.setStatus("scheduled");
                game.setGameType("PLAYOFF");
                game.setPlayoffRound(round);
                game.setBracketPosition(position++);
                playoffGames.add(game);
            }

            log.info("Generated {} placeholder games for {} (week {})",
                    weekSlots.size(), round, playoffWeekNumber);
        }

        return playoffGames;
    }

    /**
     * Cycle through matchups to fill all available slots
     */
    private List<Matchup> cycleMatchups(List<Matchup> baseMatchups, int totalSlots) {
        List<Matchup> cycled = new ArrayList<>();
        int index = 0;

        while (cycled.size() < totalSlots) {
            Matchup original = baseMatchups.get(index % baseMatchups.size());

            // Alternate home/away in subsequent cycles
            int cycle = index / baseMatchups.size();
            if (cycle % 2 == 0) {
                cycled.add(original);
            } else {
                cycled.add(new Matchup(original.awayTeamId, original.homeTeamId));
            }

            index++;
        }

        log.info("Cycled {} base matchups to fill {} slots", baseMatchups.size(), totalSlots);
        return cycled;
    }

    /**
     * Create a Game entity from matchup and slot
     */
    private Game createGame(Long seasonId, Long leagueId, Matchup matchup, GameSlot slot) {
        Game game = new Game();
        game.setSeasonId(seasonId);
        game.setLeagueId(leagueId);
        game.setHomeTeamId(matchup.homeTeamId);
        game.setAwayTeamId(matchup.awayTeamId);

        // Combine date and time, treating CSV times as America/Chicago timezone
        LocalDateTime localDateTime = LocalDateTime.of(slot.getDate(), slot.getTime());
        ZonedDateTime zonedDateTime = localDateTime.atZone(ZoneId.of("America/Chicago"));
        // Convert to UTC for storage
        LocalDateTime utcDateTime = zonedDateTime.withZoneSameInstant(ZoneId.of("UTC")).toLocalDateTime();
        game.setGameDate(utcDateTime);

        game.setWeek(slot.getWeek());
        game.setRink(slot.getRink());
        game.setStatus("scheduled");
        game.setGameType("REGULAR_SEASON");

        return game;
    }

    /**
     * Check if schedule already exists for season
     */
    public boolean hasExistingSchedule(Long seasonId) {
        return gameRepository.existsBySeasonId(seasonId);
    }

    /**
     * Delete all games for a season (reset schedule)
     */
    @Transactional
    public void resetSchedule(Long seasonId) {
        List<Game> games = gameRepository.findBySeasonIdOrderByGameDate(seasonId);
        gameRepository.deleteAll(games);
        log.info("Deleted {} games for season {}", games.size(), seasonId);
    }

    /**
     * Assign matchups to slots with time balancing.
     *
     * For each week, matchups are sorted by their "early/late burden" before being
     * assigned to slots. Matchups whose teams have played too many early games get
     * pushed to the later slots that week, and vice versa. This creates a natural
     * rotation so no team is stuck with predominantly early or late games all season.
     */
    private List<Game> assignSlotsWithBalancing(Long seasonId, Long leagueId, List<Long> teamIds,
            List<Matchup> matchups, List<GameSlot> slots) {

        // Initialize stats tracking for each team
        Map<Long, TimeSlotStats> teamStats = new HashMap<>();
        for (Long teamId : teamIds) {
            teamStats.put(teamId, new TimeSlotStats(teamId));
        }

        // Group slots by week
        Map<Integer, List<GameSlot>> slotsByWeek = new HashMap<>();
        for (GameSlot slot : slots) {
            slotsByWeek.computeIfAbsent(slot.getWeek(), k -> new ArrayList<>()).add(slot);
        }

        List<Game> games = new ArrayList<>();
        int matchupIndex = 0;

        // Process each week
        for (Integer week : slotsByWeek.keySet().stream().sorted().toList()) {
            List<GameSlot> weekSlots = new ArrayList<>(slotsByWeek.get(week));

            // Sort slots earliest → latest so index 0 = earliest, index N-1 = latest
            weekSlots.sort(java.util.Comparator.comparing(GameSlot::getTime));

            int slotsThisWeek = weekSlots.size();

            // Collect this week's matchups (one per slot)
            List<Matchup> weekMatchups = new ArrayList<>();
            for (int i = 0; i < slotsThisWeek && (matchupIndex + i) < matchups.size(); i++) {
                weekMatchups.add(matchups.get(matchupIndex + i));
            }
            matchupIndex += weekMatchups.size();

            // Sort matchups by early-game burden DESCENDING:
            //   burden = (homeEarlyGames - homeLateGames) + (awayEarlyGames - awayLateGames)
            //   A positive burden means the matchup's teams have played more early than late
            //   games this season → they should receive a LATE slot this week to compensate.
            weekMatchups.sort((a, b) -> {
                int burdenA = getBurden(teamStats, a);
                int burdenB = getBurden(teamStats, b);
                if (burdenA != burdenB) return Integer.compare(burdenB, burdenA); // desc
                // Tiebreaker: team with fewer total games played gets earlier slot
                int gpA = teamStats.get(a.homeTeamId).getTotalGames()
                        + teamStats.get(a.awayTeamId).getTotalGames();
                int gpB = teamStats.get(b.homeTeamId).getTotalGames()
                        + teamStats.get(b.awayTeamId).getTotalGames();
                return Integer.compare(gpA, gpB); // asc: fewer games → earlier slot
            });

            // Assign: matchup[0] (highest burden) → latest slot
            //         matchup[N-1] (lowest burden) → earliest slot
            for (int i = 0; i < weekMatchups.size(); i++) {
                int slotIdx = weekSlots.size() - 1 - i; // latest → earliest
                Matchup matchup = weekMatchups.get(i);
                GameSlot slot = weekSlots.get(slotIdx);

                Game game = createGame(seasonId, leagueId, matchup, slot);
                games.add(game);

                // Update stats so future weeks factor in this week's assignment
                String category = categorizeTimeSlot(slot.getTime());
                TimeSlotStats homeStats = teamStats.get(matchup.homeTeamId);
                TimeSlotStats awayStats = teamStats.get(matchup.awayTeamId);
                homeStats.incrementCategory(category);
                awayStats.incrementCategory(category);
                if (category.equals("late")) {
                    homeStats.setLastLateWeek(week);
                    awayStats.setLastLateWeek(week);
                }
            }
        }

        log.info("Assigned {} games with time slot balancing", games.size());
        logTimeSlotDistribution(teamStats);

        return games;
    }

    /**
     * Burden score for a matchup: how many more early games than late games the two
     * teams have played combined this season. Positive = too many early → needs late slot.
     */
    private int getBurden(Map<Long, TimeSlotStats> teamStats, Matchup matchup) {
        TimeSlotStats home = teamStats.get(matchup.homeTeamId);
        TimeSlotStats away = teamStats.get(matchup.awayTeamId);
        return (home.getEarlyGames() - home.getLateGames())
             + (away.getEarlyGames() - away.getLateGames());
    }

    /**
     * Categorize time slot as early, mid, or late
     */
    private String categorizeTimeSlot(LocalTime time) {
        int hour = time.getHour();
        int minute = time.getMinute();
        int totalMinutes = hour * 60 + minute;

        // Early: before 19:30 (1170 minutes)
        if (totalMinutes < 1170) {
            return "early";
        }
        // Late: after 20:30 (1230 minutes)
        else if (totalMinutes > 1230) {
            return "late";
        }
        // Mid: 19:30 - 20:30
        else {
            return "mid";
        }
    }

    /**
     * Log time slot distribution for debugging
     */
    private void logTimeSlotDistribution(Map<Long, TimeSlotStats> teamStats) {
        log.info("Time Slot Distribution:");
        for (Map.Entry<Long, TimeSlotStats> entry : teamStats.entrySet()) {
            TimeSlotStats stats = entry.getValue();
            log.info("  Team {}: Early={}, Mid={}, Late={}",
                    entry.getKey(), stats.getEarlyGames(), stats.getMidGames(), stats.getLateGames());
        }
    }

    /**
     * Inner class to represent a matchup
     */
    private static class Matchup {
        final Long homeTeamId;
        final Long awayTeamId;

        Matchup(Long homeTeamId, Long awayTeamId) {
            this.homeTeamId = homeTeamId;
            this.awayTeamId = awayTeamId;
        }
    }
}
