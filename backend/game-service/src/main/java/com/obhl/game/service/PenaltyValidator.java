package com.obhl.game.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.obhl.game.dto.PenaltyValidationResponse;
import com.obhl.game.model.PenaltyTracking;
import com.obhl.game.repository.PenaltyTrackingRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class PenaltyValidator {

    private final PenaltyTrackingRepository penaltyTrackingRepository;
    private final com.obhl.game.repository.GameRepository gameRepository;

    /**
     * Validates if a penalty should result in ejection or suspension
     * Rules:
     * - 3 penalties in current game → Ejection
     * - 4 penalties across last 2 consecutive games → Ejection + Suspension for
     * next game
     */
    @Transactional
    public PenaltyValidationResponse validatePenalty(Long playerId, Long gameId, Long teamId) {
        log.info("Validating penalty for player {} in game {} for team {}", playerId, gameId, teamId);

        // Get current game details
        com.obhl.game.model.Game currentGame = gameRepository.findById(gameId)
                .orElseThrow(() -> new IllegalArgumentException("Game not found: " + gameId));

        // Get or create penalty tracking for current game
        PenaltyTracking currentGameTracking = penaltyTrackingRepository
                .findByPlayerIdAndGameId(playerId, gameId)
                .orElse(new PenaltyTracking());

        if (currentGameTracking.getId() == null) {
            currentGameTracking.setPlayerId(playerId);
            currentGameTracking.setGameId(gameId);
            currentGameTracking.setPenaltyCount(0);
        }

        // Increment penalty count
        int newPenaltyCount = currentGameTracking.getPenaltyCount() + 1;
        currentGameTracking.setPenaltyCount(newPenaltyCount);

        // Check for 3-penalty ejection rule
        if (newPenaltyCount >= 3) {
            currentGameTracking.setIsEjected(true);
            penaltyTrackingRepository.save(currentGameTracking);

            return new PenaltyValidationResponse(
                    true,
                    false,
                    newPenaltyCount,
                    "⚠️ EJECTION: Player has received 3 penalties in this game and must be ejected immediately.",
                    "EJECTION");
        }

        // Check for 4-penalty suspension rule (across last 2 consecutive games in season)
        List<com.obhl.game.model.Game> seasonGames = gameRepository.findBySeasonIdAndTeam(
                currentGame.getSeasonId(), teamId);

        com.obhl.game.model.Game previousGame = null;
        // Iterate backwards to find the previous game before the current one
        for (int i = seasonGames.size() - 1; i >= 0; i--) {
            com.obhl.game.model.Game g = seasonGames.get(i);
            if (g.getGameDate().isBefore(currentGame.getGameDate())) {
                previousGame = g;
                break;
            }
        }

        if (previousGame != null) {
            // Find penalty tracking for THAT specific previous game
            PenaltyTracking previousGameTracking = penaltyTrackingRepository
                    .findByPlayerIdAndGameId(playerId, previousGame.getId())
                    .orElse(null);

            int previousCount = (previousGameTracking != null) ? previousGameTracking.getPenaltyCount() : 0;
            int totalPenalties = newPenaltyCount + previousCount;

            if (totalPenalties >= 4) {
                currentGameTracking.setIsEjected(true);
                currentGameTracking.setIsSuspendedNextGame(true);
                penaltyTrackingRepository.save(currentGameTracking);

                return new PenaltyValidationResponse(
                        true,
                        true,
                        newPenaltyCount,
                        String.format(
                                "🚨 EJECTION + SUSPENSION: Player has %d penalties in this game and %d in the previous game (total: %d). "
                                        + "Player must be ejected from this game AND is suspended for the next game.",
                                newPenaltyCount, previousCount, totalPenalties),
                        "EJECTION_AND_SUSPENSION");
            }
        }

        // No ejection or suspension - just save the updated count
        penaltyTrackingRepository.save(currentGameTracking);

        return new PenaltyValidationResponse(
                false,
                false,
                newPenaltyCount,
                String.format("Penalty recorded. Player now has %d penalties in this game.", newPenaltyCount),
                "NORMAL");
    }

    /**
     * Check if a player is currently suspended
     */
    public boolean isPlayerSuspended(Long playerId) {
        List<PenaltyTracking> recentGames = penaltyTrackingRepository
                .findByPlayerIdOrderByCreatedAtDesc(playerId);

        if (!recentGames.isEmpty()) {
            PenaltyTracking mostRecent = recentGames.get(0);
            return mostRecent.getIsSuspendedNextGame();
        }

        return false;
    }

    /**
     * Clear suspension flag after the next game is played
     */
    @Transactional
    public void clearSuspension(Long playerId, Long gameId) {
        // Find the previous game where suspension was set
        List<PenaltyTracking> recentGames = penaltyTrackingRepository
                .findByPlayerIdOrderByCreatedAtDesc(playerId);

        for (PenaltyTracking tracking : recentGames) {
            if (tracking.getIsSuspendedNextGame()) {
                tracking.setIsSuspendedNextGame(false);
                penaltyTrackingRepository.save(tracking);
                log.info("Cleared suspension for player {} after serving in game {}", playerId, gameId);
                break;
            }
        }
    }
}
