package com.obhl.gateway.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.model.StaffPayRate;

/**
 * Turns a season's games into per-person game credits for referees and scorekeepers.
 *
 * <p>Pure and static on purpose: the pay rules live here and nowhere else, and they can be
 * tested without a Spring context. The source of truth is the games' own staff columns
 * ({@code referee1Id}, {@code referee2Id}, {@code scorekeeperId}), not {@code shift_assignments}
 * — the legacy self-signup pages write only the game columns, and the coordinator console's
 * unpublished sign-ups write only rows, so the columns are the one complete record of who
 * actually worked.
 *
 * <p>Rules:
 * <ul>
 *   <li>A game counts once its date has passed and it is not cancelled or postponed. A
 *       finalized score is not required — the rink pays for games worked, not games scored.</li>
 *   <li>Each ref slot that is filled earns that ref one game.</li>
 *   <li>A ref who works a game alone (the other ref slot empty, or both slots naming the
 *       same person) is paid double: that game counts as two games and one solo game.</li>
 *   <li>The scorekeeper earns one game.</li>
 * </ul>
 */
public final class StaffPayCalculator {

    private static final Set<String> SKIPPED_STATUSES = Set.of("cancelled", "canceled", "postponed");

    private StaffPayCalculator() {
    }

    /** (userId, role) — the identity of one pay line. */
    public record Key(Long userId, String role) {
    }

    /** One counted game from a person's point of view. */
    public record GameCredit(Long gameId, LocalDateTime gameDate, Long homeTeamId, Long awayTeamId, boolean solo) {
    }

    /** Running totals for one person in one role. {@code games} already counts solo games twice. */
    public static final class Credits {
        private int games;
        private int soloGames;
        private final List<GameCredit> gameList = new ArrayList<>();

        public int getGames() {
            return games;
        }

        public int getSoloGames() {
            return soloGames;
        }

        public List<GameCredit> getGameList() {
            return gameList;
        }

        private void add(GameResponseDTO g, boolean solo) {
            games += solo ? 2 : 1;
            if (solo) {
                soloGames++;
            }
            gameList.add(new GameCredit(g.getId(), g.getGameDate(), g.getHomeTeamId(), g.getAwayTeamId(), solo));
        }
    }

    /**
     * @param games  every game in the season
     * @param nowUtc the cutoff, in UTC — {@code gameDate} is stored in UTC
     * @return credits keyed by (userId, role), in first-seen order
     */
    public static Map<Key, Credits> compute(List<GameResponseDTO> games, LocalDateTime nowUtc) {
        Map<Key, Credits> out = new LinkedHashMap<>();
        if (games == null) {
            return out;
        }
        for (GameResponseDTO g : games) {
            if (!counts(g, nowUtc)) {
                continue;
            }
            Long r1 = g.getReferee1Id();
            Long r2 = g.getReferee2Id();
            if (r1 != null && r2 != null && !Objects.equals(r1, r2)) {
                credit(out, r1, StaffPayRate.ROLE_REF, g, false);
                credit(out, r2, StaffPayRate.ROLE_REF, g, false);
            } else if (r1 != null) {
                credit(out, r1, StaffPayRate.ROLE_REF, g, true);
            } else if (r2 != null) {
                credit(out, r2, StaffPayRate.ROLE_REF, g, true);
            }
            if (g.getScorekeeperId() != null) {
                credit(out, g.getScorekeeperId(), StaffPayRate.ROLE_SCOREKEEPER, g, false);
            }
        }
        return out;
    }

    /** Whether a game has been worked: date passed, not called off. */
    public static boolean counts(GameResponseDTO g, LocalDateTime nowUtc) {
        if (g == null || g.getGameDate() == null || !g.getGameDate().isBefore(nowUtc)) {
            return false;
        }
        String status = g.getStatus() == null ? "" : g.getStatus().trim().toLowerCase(Locale.ROOT);
        return !SKIPPED_STATUSES.contains(status);
    }

    private static void credit(Map<Key, Credits> out, Long userId, String role, GameResponseDTO g, boolean solo) {
        out.computeIfAbsent(new Key(userId, role), k -> new Credits()).add(g, solo);
    }
}
