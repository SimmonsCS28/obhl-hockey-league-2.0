package com.obhl.game.service.scoring;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.game.model.Game;
import com.obhl.game.model.GameEvent;
import com.obhl.game.repository.GameEventRepository;
import com.obhl.game.repository.GameRepository;

import lombok.Data;
import lombok.RequiredArgsConstructor;

/**
 * Tournament standings, computed on read.
 *
 * <p>Never stored. The denormalised standings columns on the team row are league-shaped and are not
 * written for tournament games (see TeamStatsUpdater), so there is nothing to keep in sync, no
 * revert path to get wrong on unfinalize, and a corrected scoring rule simply produces corrected
 * standings the next time anyone looks. At eight teams and a couple of dozen games the cost is
 * nothing.
 *
 * <p>Only group-stage games count. In a round-robin-only tournament these standings decide the
 * champion outright, which is why the tiebreakers matter rather than being decoration.
 */
@Service
@RequiredArgsConstructor
public class TournamentStandingsService {

    private final GameRepository gameRepository;
    private final GameEventRepository gameEventRepository;
    private final com.obhl.game.client.TeamClient teamClient;

    @Data
    public static class TeamStanding {
        private Long teamId;
        private String pool;
        private int gamesPlayed;
        private int wins;
        private int losses;
        private int ties;
        private int goalsFor;
        private int goalsAgainst;
        private int periodsWon;
        private int penaltyFreePeriods;
        private int penaltyMinutes;
        private int points;
        /** Set when the coin-flip tiebreaker was used, so the UI can show it was not automatic. */
        private boolean coinFlipApplied;

        public int getGoalDifferential() {
            return goalsFor - goalsAgainst;
        }
    }

    @Transactional(readOnly = true)
    public List<TeamStanding> getStandings(Long seasonId) {
        List<Game> games = gameRepository.findBySeasonIdOrderByGameDate(seasonId).stream()
                .filter(g -> "completed".equals(g.getStatus()))
                .filter(TournamentPointsPolicy::isPointsBearing)
                .toList();

        Map<Long, TeamStanding> table = new HashMap<>();
        // head[a][b] = points team a took from games against team b, for the head-to-head tiebreak.
        Map<Long, Map<Long, Integer>> head = new HashMap<>();

        for (Game g : games) {
            if (g.getHomeTeamId() == null || g.getAwayTeamId() == null) {
                continue;
            }

            TeamStanding home = table.computeIfAbsent(g.getHomeTeamId(), TournamentStandingsService::newStanding);
            TeamStanding away = table.computeIfAbsent(g.getAwayTeamId(), TournamentStandingsService::newStanding);

            int hs = g.getHomeScore() != null ? g.getHomeScore() : 0;
            int as = g.getAwayScore() != null ? g.getAwayScore() : 0;
            int hp = g.getHomeTeamPoints() != null ? g.getHomeTeamPoints() : 0;
            int ap = g.getAwayTeamPoints() != null ? g.getAwayTeamPoints() : 0;

            accumulate(home, hs, as, hp);
            accumulate(away, as, hs, ap);

            head.computeIfAbsent(g.getHomeTeamId(), k -> new HashMap<>())
                    .merge(g.getAwayTeamId(), hp, Integer::sum);
            head.computeIfAbsent(g.getAwayTeamId(), k -> new HashMap<>())
                    .merge(g.getHomeTeamId(), ap, Integer::sum);

            applyEventDerivedTallies(g, home, away);
        }

        // Division label, so callers can group the table and so bracket seeding can interleave
        // divisions. Best-effort: standings still rank correctly if teams cannot be reached.
        try {
            for (var team : teamClient.getTeams(seasonId)) {
                TeamStanding s = table.get(team.getId());
                if (s != null) s.setPool(team.getPool());
            }
        } catch (Exception e) {
            // Leaves pool null, which groups everything into one table rather than failing.
        }

        List<TeamStanding> standings = new ArrayList<>(table.values());
        standings.sort(comparator(head));
        return standings;
    }

    /**
     * Points, then head-to-head, then goal differential, then fewest penalty minutes, then a coin
     * flip.
     *
     * <p>Head-to-head is only meaningful between two teams; with three or more level on points there
     * is no consistent pairwise ordering (A beats B beats C beats A is entirely possible), so it is
     * applied strictly as a pairwise comparison and any cycle falls through to goal differential.
     *
     * <p>The coin flip is NOT decided here -- a comparator must be deterministic, and a random one
     * would reorder the table on every page load. Teams still level after penalty minutes are
     * ordered by id and flagged, so the UI can show the organiser that a coin flip is owed.
     */
    private Comparator<TeamStanding> comparator(Map<Long, Map<Long, Integer>> head) {
        return (a, b) -> {
            int byPoints = Integer.compare(b.getPoints(), a.getPoints());
            if (byPoints != 0) return byPoints;

            int h2h = headToHead(head, a.getTeamId(), b.getTeamId());
            if (h2h != 0) return h2h;

            int byDiff = Integer.compare(b.getGoalDifferential(), a.getGoalDifferential());
            if (byDiff != 0) return byDiff;

            int byPim = Integer.compare(a.getPenaltyMinutes(), b.getPenaltyMinutes());
            if (byPim != 0) return byPim;

            a.setCoinFlipApplied(true);
            b.setCoinFlipApplied(true);
            return Long.compare(a.getTeamId(), b.getTeamId());
        };
    }

    private int headToHead(Map<Long, Map<Long, Integer>> head, Long a, Long b) {
        Integer aFromB = head.getOrDefault(a, Map.of()).get(b);
        Integer bFromA = head.getOrDefault(b, Map.of()).get(a);
        if (aFromB == null || bFromA == null) {
            return 0; // never met
        }
        return Integer.compare(bFromA, aFromB);
    }

    private void accumulate(TeamStanding s, int goalsFor, int goalsAgainst, int points) {
        s.setGamesPlayed(s.getGamesPlayed() + 1);
        s.setGoalsFor(s.getGoalsFor() + goalsFor);
        s.setGoalsAgainst(s.getGoalsAgainst() + goalsAgainst);
        s.setPoints(s.getPoints() + points);

        if (goalsFor > goalsAgainst) {
            s.setWins(s.getWins() + 1);
        } else if (goalsAgainst > goalsFor) {
            s.setLosses(s.getLosses() + 1);
        } else {
            s.setTies(s.getTies() + 1);
        }
    }

    /**
     * Periods won, penalty-free periods and penalty minutes are display columns -- they explain
     * where a team's points came from. The points themselves were already computed at finalize by
     * {@link TournamentPointsPolicy} and are read off the game, not recomputed here.
     */
    private void applyEventDerivedTallies(Game g, TeamStanding home, TeamStanding away) {
        int periodCount = g.getPeriodCount() != null ? g.getPeriodCount() : 2;
        List<GameEvent> events = gameEventRepository.findByGameId(g.getId());

        int[] hg = new int[periodCount];
        int[] ag = new int[periodCount];
        Set<Integer> homePenaltyPeriods = new HashSet<>();
        Set<Integer> awayPenaltyPeriods = new HashSet<>();

        for (GameEvent e : events) {
            boolean isHome = g.getHomeTeamId().equals(e.getTeamId());
            boolean isAway = g.getAwayTeamId().equals(e.getTeamId());
            if (!isHome && !isAway) continue;

            int idx = e.getPeriod() - 1;
            boolean inRegulation = idx >= 0 && idx < periodCount;

            if ("goal".equals(e.getEventType()) && inRegulation) {
                if (isHome) hg[idx]++; else ag[idx]++;
            } else if ("penalty".equals(e.getEventType())) {
                int pim = e.getPenaltyMinutes() != null ? e.getPenaltyMinutes() : 0;
                if (isHome) {
                    home.setPenaltyMinutes(home.getPenaltyMinutes() + pim);
                    if (inRegulation) homePenaltyPeriods.add(idx);
                } else {
                    away.setPenaltyMinutes(away.getPenaltyMinutes() + pim);
                    if (inRegulation) awayPenaltyPeriods.add(idx);
                }
            }
        }

        for (int p = 0; p < periodCount; p++) {
            if (hg[p] > ag[p]) home.setPeriodsWon(home.getPeriodsWon() + 1);
            else if (ag[p] > hg[p]) away.setPeriodsWon(away.getPeriodsWon() + 1);

            if (!homePenaltyPeriods.contains(p)) home.setPenaltyFreePeriods(home.getPenaltyFreePeriods() + 1);
            if (!awayPenaltyPeriods.contains(p)) away.setPenaltyFreePeriods(away.getPenaltyFreePeriods() + 1);
        }
    }

    private static TeamStanding newStanding(Long teamId) {
        TeamStanding s = new TeamStanding();
        s.setTeamId(teamId);
        return s;
    }
}
