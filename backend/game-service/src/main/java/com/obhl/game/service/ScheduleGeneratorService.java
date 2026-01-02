package com.obhl.game.service;

import java.time.LocalDateTime;
import java.time.LocalTime;
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

        // Save all games
        List<Game> savedGames = gameRepository.saveAll(games);
        log.info("Successfully generated {} games", savedGames.size());

        return savedGames;
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

        // Combine date and time
        LocalDateTime gameDateTime = LocalDateTime.of(slot.getDate(), slot.getTime());
        game.setGameDate(gameDateTime);

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
        List<Game> games = gameRepository.findBySeasonIdOrderByGameDateDesc(seasonId);
        gameRepository.deleteAll(games);
        log.info("Deleted {} games for season {}", games.size(), seasonId);
    }

    /**
     * Assign matchups to slots with time balancing
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
            List<GameSlot> weekSlots = slotsByWeek.get(week);

            // Assign matchups to this week's slots with balancing
            for (GameSlot slot : weekSlots) {
                if (matchupIndex >= matchups.size()) {
                    break;
                }

                Matchup matchup = matchups.get(matchupIndex);
                String category = categorizeTimeSlot(slot.getTime());

                // Calculate fairness score for this assignment
                int homeScore = calculateFairnessScore(teamStats.get(matchup.homeTeamId), category, week);
                int awayScore = calculateFairnessScore(teamStats.get(matchup.awayTeamId), category, week);

                // Create game
                Game game = createGame(seasonId, leagueId, matchup, slot);
                games.add(game);

                // Update stats
                TimeSlotStats homeStats = teamStats.get(matchup.homeTeamId);
                TimeSlotStats awayStats = teamStats.get(matchup.awayTeamId);

                homeStats.incrementCategory(category);
                awayStats.incrementCategory(category);

                if (category.equals("late")) {
                    homeStats.setLastLateWeek(week);
                    awayStats.setLastLateWeek(week);
                }

                matchupIndex++;
            }
        }

        log.info("Assigned {} games with time slot balancing", games.size());
        logTimeSlotDistribution(teamStats);

        return games;
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
     * Calculate fairness score for assigning a team to a time slot
     * Lower score = more fair
     */
    private int calculateFairnessScore(TimeSlotStats stats, String category, int currentWeek) {
        int score = 0;

        // Penalty for playing late in consecutive weeks
        if (category.equals("late") && stats.getLastLateWeek() != null) {
            int weeksSinceLastLate = currentWeek - stats.getLastLateWeek();
            if (weeksSinceLastLate == 1) {
                score += 100; // Heavy penalty for consecutive weeks
            } else if (weeksSinceLastLate == 2) {
                score += 50; // Moderate penalty for 2 weeks apart
            }
        }

        // Penalty for having more games in this category than average
        int categoryCount = stats.getCategoryCount(category);
        score += categoryCount * 10;

        // Bonus for having fewer games in this category
        if (categoryCount == 0) {
            score -= 20;
        }

        return score;
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
