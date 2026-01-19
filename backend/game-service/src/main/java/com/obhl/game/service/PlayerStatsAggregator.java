package com.obhl.game.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.obhl.game.dto.PlayerStatsUpdateDto;
import com.obhl.game.model.Game;
import com.obhl.game.model.GameEvent;
import com.obhl.game.repository.GameEventRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlayerStatsAggregator {

    private static final Logger logger = LoggerFactory.getLogger(PlayerStatsAggregator.class);

    private final GameEventRepository gameEventRepository;
    private final RestTemplate restTemplate;

    @Value("${stats.service.url:http://localhost:8003/api/v1}")
    private String statsServiceUrl;

    /**
     * Aggregates game events into player stats and updates the stats service
     */
    public void aggregateAndUpdateStats(Game game) {
        logger.info("Aggregating stats for game {}", game.getId());

        // Fetch all events for this game
        List<GameEvent> events = gameEventRepository.findByGameId(game.getId());

        if (events.isEmpty()) {
            logger.info("No events found for game {}, skipping stats aggregation", game.getId());
            return;
        }

        // Map to store aggregated stats per player: playerId -> stats
        Map<Long, PlayerStatsUpdateDto> playerStatsMap = new HashMap<>();

        // Process each event
        for (GameEvent event : events) {
            String eventType = event.getEventType().toLowerCase();

            if ("goal".equals(eventType)) {
                // Increment goal for scorer
                if (event.getPlayerId() != null) {
                    incrementStats(playerStatsMap, event.getPlayerId(), game, event.getTeamId(), 1, 0, 0);
                }

                // Increment assists
                if (event.getAssist1PlayerId() != null) {
                    incrementStats(playerStatsMap, event.getAssist1PlayerId(), game, event.getTeamId(), 0, 1, 0);
                }
                if (event.getAssist2PlayerId() != null) {
                    incrementStats(playerStatsMap, event.getAssist2PlayerId(), game, event.getTeamId(), 0, 1, 0);
                }
            } else if ("penalty".equals(eventType)) {
                // Increment penalty minutes
                if (event.getPlayerId() != null && event.getPenaltyMinutes() != null) {
                    incrementStats(playerStatsMap, event.getPlayerId(), game, event.getTeamId(), 0, 0,
                            event.getPenaltyMinutes());
                }
            }
        }

        // Send updates to stats service
        for (PlayerStatsUpdateDto stats : playerStatsMap.values()) {
            updatePlayerStats(stats);
        }

        logger.info("Stats aggregation complete for game {}. Updated {} players", game.getId(), playerStatsMap.size());
    }

    /**
     * Helper method to increment stats for a player
     */
    private void incrementStats(Map<Long, PlayerStatsUpdateDto> statsMap, Long playerId, Game game, Long teamId,
            int goals, int assists, int penaltyMinutes) {
        PlayerStatsUpdateDto stats = statsMap.computeIfAbsent(playerId, id -> {
            PlayerStatsUpdateDto dto = new PlayerStatsUpdateDto();
            dto.setPlayerId(id);
            dto.setSeasonId(game.getSeasonId());
            dto.setTeamId(teamId);
            dto.setGoals(0);
            dto.setAssists(0);
            dto.setPoints(0);
            dto.setPenaltyMinutes(0);
            return dto;
        });

        stats.setGoals(stats.getGoals() + goals);
        stats.setAssists(stats.getAssists() + assists);
        stats.setPoints(stats.getGoals() + stats.getAssists()); // Recalculate points
        stats.setPenaltyMinutes(stats.getPenaltyMinutes() + penaltyMinutes);
    }

    /**
     * Sends stats update to stats service via REST call
     */
    private void updatePlayerStats(PlayerStatsUpdateDto stats) {
        try {
            String url = statsServiceUrl + "/stats/players/increment";
            restTemplate.postForObject(url, stats, Void.class);
            logger.debug("Updated stats for player {}: G:{} A:{} P:{} PM:{}",
                    stats.getPlayerId(), stats.getGoals(), stats.getAssists(),
                    stats.getPoints(), stats.getPenaltyMinutes());
        } catch (Exception e) {
            logger.error("Failed to update stats for player {}: {}", stats.getPlayerId(), e.getMessage());
            // Continue processing other players even if one fails
        }
    }
}
