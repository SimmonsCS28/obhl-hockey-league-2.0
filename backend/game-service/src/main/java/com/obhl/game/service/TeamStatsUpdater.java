package com.obhl.game.service;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.obhl.game.client.TeamClient;
import com.obhl.game.model.Game;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeamStatsUpdater {

    private final TeamClient teamClient;

    /**
     * Only regular-season games move the denormalised standings columns on the team row.
     *
     * <p>Written as an allow-list rather than "not PLAYOFF" deliberately. The columns it feeds
     * (points/wins/losses/ties/goals_for/...) are league-shaped: two points a win, one an OT loss.
     * Tournament games use a different formula entirely and their standings are computed on read,
     * so letting a TOURNAMENT game through here would write meaningless numbers onto tournament team
     * rows -- and because unfinalizeGame reverts them symmetrically, the damage would look
     * reversible while being silently wrong. Any future game type is excluded until it opts in.
     */
    private boolean affectsLeagueStandings(Game game) {
        return "REGULAR_SEASON".equals(game.getGameType());
    }

    /**
     * Update team standings after a game is finalized
     * This increments the team stats based on the game outcome
     */
    public void updateTeamStats(Game game) {
        log.info("Updating team stats for game {}", game.getId());

        if (!affectsLeagueStandings(game)) {
            log.info("Skipping standings update for {} game {}", game.getGameType(), game.getId());
            return;
        }

        int homeScore = game.getHomeScore();
        int awayScore = game.getAwayScore();
        boolean endedInOT = game.getEndedInOT() != null && game.getEndedInOT();

        // Calculate stats for home team
        Map<String, Integer> homeStats = new HashMap<>();
        homeStats.put("goalsFor", homeScore);
        homeStats.put("goalsAgainst", awayScore);
        homeStats.put("points", game.getHomeTeamPoints());

        // Calculate stats for away team
        Map<String, Integer> awayStats = new HashMap<>();
        awayStats.put("goalsFor", awayScore);
        awayStats.put("goalsAgainst", homeScore);
        awayStats.put("points", game.getAwayTeamPoints());

        // Determine win/loss/tie/OT stats
        if (homeScore > awayScore) {
            // Home team wins
            if (endedInOT) {
                homeStats.put("overtimeWins", 1);
                awayStats.put("overtimeLosses", 1);
            } else {
                homeStats.put("wins", 1);
                awayStats.put("losses", 1);
            }
        } else if (awayScore > homeScore) {
            // Away team wins
            if (endedInOT) {
                awayStats.put("overtimeWins", 1);
                homeStats.put("overtimeLosses", 1);
            } else {
                awayStats.put("wins", 1);
                homeStats.put("losses", 1);
            }
        } else {
            // Tie game
            homeStats.put("ties", 1);
            awayStats.put("ties", 1);
        }

        // Update both teams via API
        try {
            teamClient.updateTeamStats(game.getHomeTeamId(), homeStats);
            log.info("Updated home team {} stats", game.getHomeTeamId());
        } catch (Exception e) {
            log.error("Failed to update home team {} stats: {}", game.getHomeTeamId(), e.getMessage());
            throw new RuntimeException("Failed to update home team stats", e);
        }

        try {
            teamClient.updateTeamStats(game.getAwayTeamId(), awayStats);
            log.info("Updated away team {} stats", game.getAwayTeamId());
        } catch (Exception e) {
            log.error("Failed to update away team {} stats: {}", game.getAwayTeamId(), e.getMessage());
            throw new RuntimeException("Failed to update away team stats", e);
        }
    }

    /**
     * Revert team standings when a game is unfinalized
     * This decrements the team stats based on the game outcome
     */
    public void revertTeamStats(Game game) {
        log.info("Reverting team stats for game {}", game.getId());

        // Must mirror updateTeamStats exactly: anything never applied has nothing to revert, and a
        // mismatch between the two guards would corrupt standings in one direction only.
        if (!affectsLeagueStandings(game)) {
            log.info("Skipping standings revert for {} game {}", game.getGameType(), game.getId());
            return;
        }

        int homeScore = game.getHomeScore();
        int awayScore = game.getAwayScore();
        boolean endedInOT = game.getEndedInOT() != null && game.getEndedInOT();


        Map<String, Integer> homeStats = new HashMap<>();
        homeStats.put("goalsFor", -homeScore);
        homeStats.put("goalsAgainst", -awayScore);
        homeStats.put("points", -game.getHomeTeamPoints());

        Map<String, Integer> awayStats = new HashMap<>();
        awayStats.put("goalsFor", -awayScore);
        awayStats.put("goalsAgainst", -homeScore);
        awayStats.put("points", -game.getAwayTeamPoints());

        if (homeScore > awayScore) {
            if (endedInOT) {
                homeStats.put("overtimeWins", -1);
                awayStats.put("overtimeLosses", -1);
            } else {
                homeStats.put("wins", -1);
                awayStats.put("losses", -1);
            }
        } else if (awayScore > homeScore) {
            if (endedInOT) {
                awayStats.put("overtimeWins", -1);
                homeStats.put("overtimeLosses", -1);
            } else {
                awayStats.put("wins", -1);
                homeStats.put("losses", -1);
            }
        } else {
            homeStats.put("ties", -1);
            awayStats.put("ties", -1);
        }

        try {
            teamClient.updateTeamStats(game.getHomeTeamId(), homeStats);
            log.info("Reverted home team {} stats", game.getHomeTeamId());
        } catch (Exception e) {
            log.error("Failed to revert home team {} stats: {}", game.getHomeTeamId(), e.getMessage());
            throw new RuntimeException("Failed to revert home team stats", e);
        }

        try {
            teamClient.updateTeamStats(game.getAwayTeamId(), awayStats);
            log.info("Reverted away team {} stats", game.getAwayTeamId());
        } catch (Exception e) {
            log.error("Failed to revert away team {} stats: {}", game.getAwayTeamId(), e.getMessage());
            throw new RuntimeException("Failed to revert away team stats", e);
        }
    }
}
