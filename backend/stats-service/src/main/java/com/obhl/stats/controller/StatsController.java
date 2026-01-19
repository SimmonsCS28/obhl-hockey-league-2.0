package com.obhl.stats.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.stats.dto.PlayerStatsIncrementDto;
import com.obhl.stats.model.GoalieStats;
import com.obhl.stats.model.PlayerStats;
import com.obhl.stats.repository.GoalieStatsRepository;
import com.obhl.stats.repository.PlayerStatsRepository;

import lombok.RequiredArgsConstructor;

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

    @PostMapping("/players/increment")
    public ResponseEntity<PlayerStats> incrementPlayerStats(@RequestBody PlayerStatsIncrementDto dto) {
        // Find existing stats or create new
        PlayerStats stats = playerStatsRepository
                .findByPlayerIdAndSeasonId(dto.getPlayerId(), dto.getSeasonId())
                .orElseGet(() -> {
                    PlayerStats newStats = new PlayerStats();
                    newStats.setPlayerId(dto.getPlayerId());
                    newStats.setSeasonId(dto.getSeasonId());
                    newStats.setTeamId(dto.getTeamId());
                    newStats.setGamesPlayed(0);
                    newStats.setGoals(0);
                    newStats.setAssists(0);
                    newStats.setPoints(0);
                    newStats.setPenaltyMinutes(0);
                    return newStats;
                });

        // Increment stats
        stats.setGoals(stats.getGoals() + dto.getGoals());
        stats.setAssists(stats.getAssists() + dto.getAssists());
        stats.setPoints(stats.getPoints() + dto.getPoints());
        stats.setPenaltyMinutes(stats.getPenaltyMinutes() + dto.getPenaltyMinutes());

        // Increment games played (once per game finalization)
        stats.setGamesPlayed(stats.getGamesPlayed() + 1);

        PlayerStats saved = playerStatsRepository.save(stats);
        return ResponseEntity.ok(saved);
    }
}
