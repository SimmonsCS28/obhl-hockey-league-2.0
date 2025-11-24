package com.obhl.stats.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;
import main.java.com.obhl.stats.model.GoalieStats;
import main.java.com.obhl.stats.model.PlayerStats;
import main.java.com.obhl.stats.repository.GoalieStatsRepository;
import main.java.com.obhl.stats.repository.PlayerStatsRepository;

@RestController
@RequestMapping("${api.v1.prefix}/stats")
@RequiredArgsConstructor
public class StatsController {

    private final PlayerStatsRepository playerStatsRepository;
    private final GoalieStatsRepository goalieStatsRepository;

    @GetMapping("/players")
    public ResponseEntity<List<PlayerStats>> getPlayerStats(
            @RequestParam Long seasonId,
            @RequestParam(required = false) Long teamId) {

        if (teamId != null) {
            return ResponseEntity.ok(playerStatsRepository.findByTeamIdAndSeasonId(teamId, seasonId));
        }

        return ResponseEntity.ok(playerStatsRepository.findBySeasonIdOrderByPointsDesc(seasonId));
    }

    @GetMapping("/players/{playerId}")
    public ResponseEntity<PlayerStats> getPlayerStatsBySeason(
            @PathVariable Long playerId,
            @RequestParam Long seasonId) {

        return playerStatsRepository.findByPlayerIdAndSeasonId(playerId, seasonId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/goalies")
    public ResponseEntity<List<GoalieStats>> getGoalieStats(
            @RequestParam Long seasonId,
            @RequestParam(required = false) Long teamId) {

        if (teamId != null) {
            return ResponseEntity.ok(goalieStatsRepository.findByTeamIdAndSeasonId(teamId, seasonId));
        }

        return ResponseEntity.ok(goalieStatsRepository.findBySeasonIdOrderBySavePercentageDesc(seasonId));
    }

    @GetMapping("/goalies/{playerId}")
    public ResponseEntity<GoalieStats> getGoalieStatsBySeason(
            @PathVariable Long playerId,
            @RequestParam Long seasonId) {

        return goalieStatsRepository.findByPlayerIdAndSeasonId(playerId, seasonId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/players")
    public ResponseEntity<PlayerStats> createPlayerStats(@RequestBody PlayerStats stats) {
        PlayerStats created = playerStatsRepository.save(stats);
        return ResponseEntity.ok(created);
    }

    @PostMapping("/goalies")
    public ResponseEntity<GoalieStats> createGoalieStats(@RequestBody GoalieStats stats) {
        GoalieStats created = goalieStatsRepository.save(stats);
        return ResponseEntity.ok(created);
    }
}
