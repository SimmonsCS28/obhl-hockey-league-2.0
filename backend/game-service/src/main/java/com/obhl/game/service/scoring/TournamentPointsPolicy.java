package com.obhl.game.service.scoring;

import java.util.List;

import org.springframework.stereotype.Service;

import com.obhl.game.model.Game;
import com.obhl.game.model.GameEvent;
import com.obhl.game.repository.GameEventRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * C League Classic scoring: 3/1/0, plus a point per period won and a point per penalty-free period.
 *
 * <p>Gathers per-period tallies from {@code game_events} and hands the arithmetic to
 * {@link TournamentPointsCalculator}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TournamentPointsPolicy implements GamePointsPolicy {

    private static final String GAME_TYPE = "TOURNAMENT";
    private static final int DEFAULT_PERIOD_COUNT = 2;

    /**
     * Only these stages award points. Bracket, placement and consolation games decide who advances
     * and who finishes where -- putting them on the points table would let a consolation win
     * outrank a semifinal loss.
     */
    private static final List<String> SCORING_STAGES = List.of("POOL", "ROUND_ROBIN");

    private final GameEventRepository gameEventRepository;

    @Override
    public boolean supports(Game game) {
        return GAME_TYPE.equals(game.getGameType());
    }

    @Override
    public void apply(Game game) {
        if (!isPointsBearing(game)) {
            // Explicit zeroes rather than leaving whatever was there: a game moved from POOL to
            // BRACKET, or re-finalized after a stage correction, must not keep stale points.
            game.setHomeTeamPoints(0);
            game.setAwayTeamPoints(0);
            log.info("Tournament game {} is stage {} -- no points awarded", game.getId(),
                    game.getTournamentStage());
            return;
        }

        TournamentScoringProfile profile = TournamentScoringProfile.CLASSIC_V1;
        int periodCount = game.getPeriodCount() != null ? game.getPeriodCount() : DEFAULT_PERIOD_COUNT;

        List<GameEvent> events = gameEventRepository.findByGameId(game.getId());

        TournamentPointsCalculator.PeriodTally tally =
                TournamentPointsCalculator.PeriodTally.ofSize(periodCount);
        int totalHomePenalties = 0;
        int totalAwayPenalties = 0;
        int eventHomeGoals = 0;
        int eventAwayGoals = 0;

        for (GameEvent e : events) {
            boolean isHome = game.getHomeTeamId() != null && game.getHomeTeamId().equals(e.getTeamId());
            boolean isAway = game.getAwayTeamId() != null && game.getAwayTeamId().equals(e.getTeamId());
            if (!isHome && !isAway) {
                continue;
            }

            // Periods beyond regulation (sudden-death OT in an elimination game) are not periods
            // anyone can "win", so they are excluded from the per-period arrays -- but their
            // penalties still count toward the whole-game threshold below.
            int idx = e.getPeriod() - 1;
            boolean inRegulation = idx >= 0 && idx < periodCount;

            if ("goal".equals(e.getEventType())) {
                if (isHome) eventHomeGoals++; else eventAwayGoals++;
                if (inRegulation) {
                    if (isHome) tally.homeGoals()[idx]++; else tally.awayGoals()[idx]++;
                }
            } else if ("penalty".equals(e.getEventType())) {
                if (isHome) totalHomePenalties++; else totalAwayPenalties++;
                if (inRegulation) {
                    if (isHome) tally.homePenalties()[idx]++; else tally.awayPenalties()[idx]++;
                }
            }
        }

        int homeScore = game.getHomeScore() != null ? game.getHomeScore() : 0;
        int awayScore = game.getAwayScore() != null ? game.getAwayScore() : 0;

        // The final score is authoritative, but period bonuses can only come from events. If the two
        // disagree, the result is still right while the period points are computed from incomplete
        // data -- worth shouting about, because it silently changes standings.
        if (eventHomeGoals != homeScore || eventAwayGoals != awayScore) {
            log.warn("Game {}: recorded goal events ({}-{}) do not match the final score ({}-{}). "
                    + "Period-win points are derived from events and may be understated.",
                    game.getId(), eventHomeGoals, eventAwayGoals, homeScore, awayScore);
        }

        TournamentPointsCalculator.Result result = TournamentPointsCalculator.calculate(
                profile, periodCount, homeScore, awayScore, tally, totalHomePenalties, totalAwayPenalties);

        game.setHomeTeamPoints(result.homePoints());
        game.setAwayTeamPoints(result.awayPoints());

        log.info("Tournament game {} ({}): {}-{} -> {} / {} points [profile={}, periods={}]",
                game.getId(), game.getTournamentStage(), homeScore, awayScore,
                result.homePoints(), result.awayPoints(), profile.key(), periodCount);
    }

    /** Group-stage games only. */
    public static boolean isPointsBearing(Game game) {
        return GAME_TYPE.equals(game.getGameType())
                && game.getTournamentStage() != null
                && SCORING_STAGES.contains(game.getTournamentStage());
    }
}
