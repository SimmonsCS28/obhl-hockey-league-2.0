package com.obhl.game.service;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.obhl.game.dto.GoalValidationRequest;
import com.obhl.game.dto.GoalValidationResponse;
import com.obhl.game.model.Game;
import com.obhl.game.model.GameEvent;
import com.obhl.game.repository.GameEventRepository;
import com.obhl.game.repository.GameRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class GoalLimitValidator {

    private final GameRepository gameRepository;
    private final GameEventRepository gameEventRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    private static final String STATS_SERVICE_URL = "http://localhost:8003/api/v1/players";

    /**
     * Validates if a player can score a goal based on:
     * 1. Player's skill rating (determines goal limit)
     * 2. Goals already scored in this game
     * 3. Mercy rule (removes limits if losing by 4+)
     */
    public GoalValidationResponse validateGoal(GoalValidationRequest request) {
        try {
            // Get game details
            Game game = gameRepository.findById(request.getGameId())
                    .orElseThrow(() -> new RuntimeException("Game not found"));

            // Get player details (including skill rating)
            Map<String, Object> player = getPlayerDetails(request.getPlayerId());
            int skillRating = (Integer) player.getOrDefault("skillRating", 5);

            // Determine goal limit based on skill rating
            int goalLimit = (skillRating >= 9) ? 2 : 3;

            // Count goals scored by this player in this game
            int goalsScored = countPlayerGoalsInGame(request.getGameId(), request.getPlayerId());

            // Check mercy rule
            boolean mercyRuleActive = isMercyRuleActive(game, request.getTeamId());

            // Validate
            boolean allowed;
            String message;

            if (mercyRuleActive) {
                // Mercy rule: no limits
                allowed = true;
                message = "Goal allowed (Mercy Rule active - no goal limits)";
            } else if (goalsScored >= goalLimit) {
                // At or over limit
                allowed = false;
                message = String.format("Player has reached goal limit (%d/%d goals)", goalsScored, goalLimit);
            } else {
                // Under limit
                allowed = true;
                if (goalsScored == goalLimit - 1) {
                    message = String.format("Warning: This is player's final goal (%d/%d)", goalsScored + 1, goalLimit);
                } else {
                    message = String.format("Goal allowed (%d/%d goals)", goalsScored + 1, goalLimit);
                }
            }

            return new GoalValidationResponse(
                    allowed,
                    message,
                    mercyRuleActive,
                    goalsScored,
                    goalLimit,
                    skillRating);

        } catch (Exception e) {
            log.error("Error validating goal: {}", e.getMessage());
            // Default to allowing goal if validation fails
            return new GoalValidationResponse(
                    true,
                    "Validation error - goal allowed by default",
                    false,
                    0,
                    3,
                    5);
        }
    }

    /**
     * Checks if mercy rule is active for a team
     * Mercy rule: Losing team has no goal limits when losing by 4+ goals
     */
    private boolean isMercyRuleActive(Game game, Long teamId) {
        int homeScore = game.getHomeScore() != null ? game.getHomeScore() : 0;
        int awayScore = game.getAwayScore() != null ? game.getAwayScore() : 0;
        int scoreDiff = Math.abs(homeScore - awayScore);

        // Mercy rule applies when differential is 4 or more
        if (scoreDiff < 4) {
            return false;
        }

        // Check if this team is the losing team
        boolean isHomeTeam = teamId.equals(game.getHomeTeamId());
        boolean isLosingTeam = isHomeTeam ? (homeScore < awayScore) : (awayScore < homeScore);

        return isLosingTeam;
    }

    /**
     * Counts how many goals a player has scored in a specific game
     */
    private int countPlayerGoalsInGame(Long gameId, Long playerId) {
        List<GameEvent> goals = gameEventRepository.findByGameIdAndEventType(gameId, "goal");
        return (int) goals.stream()
                .filter(event -> playerId.equals(event.getPlayerId()))
                .count();
    }

    /**
     * Fetches player details from Stats Service
     */
    private Map<String, Object> getPlayerDetails(Long playerId) {
        try {
            String url = STATS_SERVICE_URL + "/" + playerId;
            @SuppressWarnings("unchecked")
            Map<String, Object> player = restTemplate.getForObject(url, Map.class);
            return player != null ? player : Map.of("skillRating", 5);
        } catch (RestClientException e) {
            log.warn("Could not fetch player details for ID {}: {}", playerId, e.getMessage());
            return Map.of("skillRating", 5);
        }
    }
}
