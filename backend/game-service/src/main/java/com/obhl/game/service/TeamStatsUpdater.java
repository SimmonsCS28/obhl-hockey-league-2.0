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
     * Update team standings after a game is finalized
     * This increments the team stats based on the game outcome
     */
    public void updateTeamStats(Game game) {
        log.info("Updating team stats for game {}", game.getId());

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
}
