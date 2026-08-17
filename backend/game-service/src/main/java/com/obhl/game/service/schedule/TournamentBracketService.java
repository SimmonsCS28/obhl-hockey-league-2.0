package com.obhl.game.service.schedule;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.game.model.Game;
import com.obhl.game.repository.GameRepository;
import com.obhl.game.service.scoring.TournamentStandingsService;
import com.obhl.game.service.scoring.TournamentStandingsService.TeamStanding;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Moves a tournament forward as games finish.
 *
 * <p>Two jobs the league playoff path does not have:
 * <ul>
 *   <li><b>Seeding the bracket from group results.</b> Bracket, placement and consolation games are
 *       generated as placeholders because their participants are not known until group play ends.</li>
 *   <li><b>The placement game</b>, which is contested by the semifinal <i>losers</i> — the opposite
 *       branch of the same advancement pass.</li>
 * </ul>
 *
 * <p>Round names are not hardcoded. The league's {@code advancePlayoffBracket} switches on
 * QUARTERFINAL → SEMIFINAL → FINAL, which cannot describe a 16-team field. Here the order is derived
 * from the rounds actually present: the round with the most games is first, and each feeds the next.
 * The league path is deliberately left alone — it is shipped and correct for its one shape.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TournamentBracketService {

    private final GameRepository gameRepository;
    private final TournamentStandingsService standingsService;

    private static final String TYPE = "TOURNAMENT";
    private static final List<String> GROUP_STAGES = List.of("POOL", "ROUND_ROBIN");

    /**
     * Called after a tournament game is finalized.
     *
     * <p>Order matters: closing out the group stage may seed the bracket that this same game's
     * result belongs to, so seeding runs first.
     */
    @Transactional
    public void onGameFinalized(Game game) {
        if (!TYPE.equals(game.getGameType())) return;

        if (GROUP_STAGES.contains(game.getTournamentStage())) {
            seedFromGroupStageIfComplete(game.getSeasonId());
            return;
        }

        if ("BRACKET".equals(game.getTournamentStage())) {
            advanceWinner(game);
            placeSemifinalLoser(game);
        }
    }

    // ------------------------------------------------------------ group stage → bracket

    /**
     * Once every group game is complete, fills the first bracket round and the consolation games.
     *
     * <p>Qualifiers are ordered by rank within division, then by division (A1, B1, A2, B2…). With
     * standard bracket pairing that produces cross-division seeding — A1 v B2, B1 v A2 — without a
     * special case. Non-qualifiers are paired crossed for consolation, so the best remaining plays
     * the worst and nobody replays a division opponent they just faced.
     */
    @Transactional
    public boolean seedFromGroupStageIfComplete(Long seasonId) {
        List<Game> all = gameRepository.findBySeasonId(seasonId).stream()
                .filter(g -> TYPE.equals(g.getGameType()))
                .toList();

        List<Game> groupGames = all.stream()
                .filter(g -> GROUP_STAGES.contains(g.getTournamentStage()))
                .toList();

        if (groupGames.isEmpty()) return false;
        if (groupGames.stream().anyMatch(g -> !"completed".equals(g.getStatus()))) return false;

        List<Game> bracket = all.stream()
                .filter(g -> "BRACKET".equals(g.getTournamentStage()))
                .toList();
        List<Game> consolation = all.stream()
                .filter(g -> "CONSOLATION".equals(g.getTournamentStage()))
                .sorted(Comparator.comparing(Game::getBracketPosition,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        // Already seeded — finalizing a later group game must not reshuffle a bracket in progress.
        boolean bracketSeeded = bracket.stream().anyMatch(g -> g.getHomeTeamId() != null);
        boolean consolationSeeded = consolation.stream().anyMatch(g -> g.getHomeTeamId() != null);
        if (bracketSeeded && (consolation.isEmpty() || consolationSeeded)) return false;

        List<Long> ranked = rankedTeams(seasonId);
        if (ranked.isEmpty()) return false;

        List<Game> firstRound = firstRoundOf(bracket);
        int qualifiers = firstRound.size() * 2;

        if (!bracketSeeded && !firstRound.isEmpty() && ranked.size() >= qualifiers) {
            List<Integer> order = TournamentScheduleGenerator.seedOrder(qualifiers);
            for (int i = 0; i < firstRound.size(); i++) {
                Game g = firstRound.get(i);
                g.setHomeTeamId(ranked.get(order.get(i * 2) - 1));
                g.setAwayTeamId(ranked.get(order.get(i * 2 + 1) - 1));
                gameRepository.save(g);
            }
            log.info("Seeded {} bracket game(s) for season {}", firstRound.size(), seasonId);
        }

        if (!consolationSeeded && !consolation.isEmpty()) {
            List<Long> rest = ranked.subList(Math.min(qualifiers, ranked.size()), ranked.size());
            int needed = consolation.size() * 2;
            if (rest.size() >= needed) {
                List<Integer> order = TournamentScheduleGenerator.seedOrder(needed);
                for (int i = 0; i < consolation.size(); i++) {
                    Game g = consolation.get(i);
                    g.setHomeTeamId(rest.get(order.get(i * 2) - 1));
                    g.setAwayTeamId(rest.get(order.get(i * 2 + 1) - 1));
                    gameRepository.save(g);
                }
                log.info("Seeded {} consolation game(s) for season {}", consolation.size(), seasonId);
            } else {
                log.warn("Season {}: {} non-qualifiers but consolation needs {}", seasonId, rest.size(), needed);
            }
        }

        return true;
    }

    /**
     * Team ids ordered A1, B1, A2, B2, … — rank within division first, then division.
     *
     * <p>Standings already arrive sorted by points and tiebreakers; this only interleaves the
     * divisions so the bracket pairing produces cross-division matchups.
     */
    private List<Long> rankedTeams(Long seasonId) {
        List<TeamStanding> standings = standingsService.getStandings(seasonId);
        if (standings.isEmpty()) return List.of();

        Map<String, List<TeamStanding>> byPool = new LinkedHashMap<>();
        for (TeamStanding s : standings) {
            byPool.computeIfAbsent(s.getPool() == null ? "" : s.getPool(), k -> new ArrayList<>()).add(s);
        }

        List<String> pools = byPool.keySet().stream().sorted().toList();
        int deepest = byPool.values().stream().mapToInt(List::size).max().orElse(0);

        List<Long> ranked = new ArrayList<>();
        for (int rank = 0; rank < deepest; rank++) {
            for (String pool : pools) {
                List<TeamStanding> rows = byPool.get(pool);
                if (rank < rows.size()) ranked.add(rows.get(rank).getTeamId());
            }
        }
        return ranked;
    }

    // ------------------------------------------------------------ advancement

    /** The round with the most games is first; each feeds the next. No hardcoded round names. */
    private List<String> roundOrder(List<Game> bracket) {
        Map<String, Long> counts = bracket.stream()
                .filter(g -> g.getPlayoffRound() != null)
                .collect(Collectors.groupingBy(Game::getPlayoffRound, Collectors.counting()));

        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(Map.Entry::getKey)
                .toList();
    }

    private List<Game> firstRoundOf(List<Game> bracket) {
        List<String> order = roundOrder(bracket);
        if (order.isEmpty()) return List.of();
        String first = order.get(0);
        return bracket.stream()
                .filter(g -> first.equals(g.getPlayoffRound()))
                .sorted(Comparator.comparing(Game::getBracketPosition,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private void advanceWinner(Game completed) {
        if (completed.getBracketPosition() == null
                || completed.getHomeTeamId() == null || completed.getAwayTeamId() == null) return;

        List<Game> bracket = gameRepository.findBySeasonId(completed.getSeasonId()).stream()
                .filter(g -> TYPE.equals(g.getGameType()) && "BRACKET".equals(g.getTournamentStage()))
                .toList();

        List<String> order = roundOrder(bracket);
        int idx = order.indexOf(completed.getPlayoffRound());
        if (idx < 0 || idx + 1 >= order.size()) return; // the final has nowhere to go

        String nextRound = order.get(idx + 1);
        Long winner = winnerOf(completed);
        if (winner == null) return;

        placeInto(bracket, nextRound, nextPosition(completed.getBracketPosition()),
                isHomeSlot(completed.getBracketPosition()), winner, "winner");
    }

    /**
     * The placement game takes the two semifinal LOSERS — the other branch of the same pass.
     *
     * <p>"Semifinal" here means the round immediately before the last, whatever it is called, so a
     * 16-team bracket works the same way.
     */
    private void placeSemifinalLoser(Game completed) {
        if (completed.getBracketPosition() == null
                || completed.getHomeTeamId() == null || completed.getAwayTeamId() == null) return;

        List<Game> all = gameRepository.findBySeasonId(completed.getSeasonId()).stream()
                .filter(g -> TYPE.equals(g.getGameType()))
                .toList();

        List<Game> placement = all.stream()
                .filter(g -> "PLACEMENT".equals(g.getTournamentStage()))
                .toList();
        if (placement.isEmpty()) return;

        List<String> order = roundOrder(all.stream()
                .filter(g -> "BRACKET".equals(g.getTournamentStage())).toList());
        if (order.size() < 2) return;

        String semifinal = order.get(order.size() - 2);
        if (!semifinal.equals(completed.getPlayoffRound())) return;

        Long loser = loserOf(completed);
        if (loser == null) return;

        Game target = placement.get(0);
        if (isHomeSlot(completed.getBracketPosition())) target.setHomeTeamId(loser);
        else target.setAwayTeamId(loser);
        gameRepository.save(target);

        log.info("Placement game: semifinal {} loser {} placed", completed.getBracketPosition(), loser);
    }

    private void placeInto(List<Game> pool, String round, int position, boolean homeSlot,
                           Long teamId, String label) {
        pool.stream()
                .filter(g -> round.equals(g.getPlayoffRound())
                        && g.getBracketPosition() != null
                        && g.getBracketPosition() == position)
                .findFirst()
                .ifPresent(next -> {
                    if (homeSlot) next.setHomeTeamId(teamId);
                    else next.setAwayTeamId(teamId);
                    gameRepository.save(next);
                    log.info("Advanced {} {} into {} position {}", label, teamId, round, position);
                });
    }

    /** Position P feeds ceil(P/2) of the next round; odd positions take the home slot. */
    private int nextPosition(int position) {
        return (position + 1) / 2;
    }

    private boolean isHomeSlot(int position) {
        return position % 2 == 1;
    }

    private Long winnerOf(Game g) {
        if (g.getHomeScore() == null || g.getAwayScore() == null) return null;
        if (g.getHomeScore().equals(g.getAwayScore())) return null; // elimination games cannot tie
        return g.getHomeScore() > g.getAwayScore() ? g.getHomeTeamId() : g.getAwayTeamId();
    }

    private Long loserOf(Game g) {
        Long winner = winnerOf(g);
        if (winner == null) return null;
        return winner.equals(g.getHomeTeamId()) ? g.getAwayTeamId() : g.getHomeTeamId();
    }
}
