package com.obhl.game.service;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.obhl.game.model.Game;
import com.obhl.game.repository.PenaltyTrackingRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class PointsCalculator {

    private final PenaltyTrackingRepository penaltyTrackingRepository;

    /**
     * Calculate points for both teams based on game outcome
     * Rules:
     * - Win (regulation/OT): 2 points
     * - Tie (regular season only): 1 point each
     * - OT Loss: 1 point
     * - Regulation Loss: 0 points
     * - 7+ penalties in game: -1 point penalty
     */
    public void calculateAndSetPoints(Game game) {
        log.info("Calculating points for game {}", game.getId());

        int homeScore = game.getHomeScore();
        int awayScore = game.getAwayScore();
        boolean endedInOT = game.getEndedInOT() != null && game.getEndedInOT();
        boolean isRegularSeason = "REGULAR_SEASON".equals(game.getGameType());

        int homePoints = 0;
        int awayPoints = 0;

        // Determine base points
        if (homeScore > awayScore) {
            // Home team wins
            homePoints = 2;
            awayPoints = endedInOT ? 1 : 0; // OT loss gets 1 point
        } else if (awayScore > homeScore) {
            // Away team wins
            awayPoints = 2;
            homePoints = endedInOT ? 1 : 0; // OT loss gets 1 point
        } else {
            // Tie game (only possible in regular season)
            if (isRegularSeason) {
                homePoints = 1;
                awayPoints = 1;
            } else {
                log.warn("Playoff game {} ended in a tie, which should not happen", game.getId());
            }
        }

        // Apply penalty deductions for 7+ penalties
        int homePenaltyCount = countTeamPenalties(game.getId(), game.getHomeTeamId());
        int awayPenaltyCount = countTeamPenalties(game.getId(), game.getAwayTeamId());

        if (homePenaltyCount >= 7) {
            homePoints -= 1;
            log.info("Home team has {} penalties, applying -1 point penalty", homePenaltyCount);
        }

        if (awayPenaltyCount >= 7) {
            awayPoints -= 1;
            log.info("Away team has {} penalties, applying -1 point penalty", awayPenaltyCount);
        }

        game.setHomeTeamPoints(homePoints);
        game.setAwayTeamPoints(awayPoints);

        log.info("Points calculated - Home: {} (score: {}, penalties: {}), Away: {} (score: {}, penalties: {})",
                homePoints, homeScore, homePenaltyCount, awayPoints, awayScore, awayPenaltyCount);
    }

    /**
     * Count total penalties for a team in a game
     * Note: This requires tracking which team each player belongs to
     * For now, this is a placeholder - you'll need to join with player data
     */
    private int countTeamPenalties(Long gameId, Long teamId) {
        // TODO: Implement proper team penalty counting
        // This would require joining penalty_tracking with players table
        // to filter by team_id

        // For now, return 0 as placeholder
        // This will need to be implemented with a custom query
        return 0;
    }
}
