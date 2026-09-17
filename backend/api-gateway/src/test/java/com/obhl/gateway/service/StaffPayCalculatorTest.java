package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.service.StaffPayCalculator.Credits;
import com.obhl.gateway.service.StaffPayCalculator.Key;

/**
 * The pay rules, stated once: a worked game is one credit per filled slot, a ref alone in a
 * game is paid double (two credits, one solo), and only past, not-called-off games count.
 */
class StaffPayCalculatorTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 16, 12, 0);
    private static final LocalDateTime PAST = NOW.minusDays(3);
    private static final LocalDateTime FUTURE = NOW.plusDays(3);

    private static GameResponseDTO game(long id, LocalDateTime when, String status, Long ref1, Long ref2, Long sk) {
        GameResponseDTO g = new GameResponseDTO();
        g.setId(id);
        g.setGameDate(when);
        g.setStatus(status);
        g.setReferee1Id(ref1);
        g.setReferee2Id(ref2);
        g.setScorekeeperId(sk);
        g.setHomeTeamId(1L);
        g.setAwayTeamId(2L);
        return g;
    }

    private static Credits ref(Map<Key, Credits> out, long userId) {
        return out.get(new Key(userId, "REF"));
    }

    @Test
    void twoRefsEachGetOneGame() {
        Map<Key, Credits> out = StaffPayCalculator.compute(List.of(game(1, PAST, "completed", 10L, 11L, 20L)), NOW);

        assertEquals(1, ref(out, 10).getGames());
        assertEquals(0, ref(out, 10).getSoloGames());
        assertEquals(1, ref(out, 11).getGames());
        assertEquals(1, out.get(new Key(20L, "SCOREKEEPER")).getGames());
        assertFalse(ref(out, 10).getGameList().get(0).solo());
    }

    @Test
    void refAloneIsPaidDouble() {
        Map<Key, Credits> out = StaffPayCalculator.compute(List.of(game(1, PAST, "completed", 10L, null, null)), NOW);

        assertEquals(2, ref(out, 10).getGames());
        assertEquals(1, ref(out, 10).getSoloGames());
        assertTrue(ref(out, 10).getGameList().get(0).solo());
        assertEquals(1, ref(out, 10).getGameList().size());
    }

    @Test
    void refOnlyInSlotTwoIsStillSolo() {
        Map<Key, Credits> out = StaffPayCalculator.compute(List.of(game(1, PAST, "scheduled", null, 11L, null)), NOW);

        assertEquals(2, ref(out, 11).getGames());
        assertEquals(1, ref(out, 11).getSoloGames());
    }

    @Test
    void sameRefInBothSlotsCountsAsSoloNotTwoNormalGames() {
        Map<Key, Credits> out = StaffPayCalculator.compute(List.of(game(1, PAST, "completed", 10L, 10L, null)), NOW);

        assertEquals(2, ref(out, 10).getGames());
        assertEquals(1, ref(out, 10).getSoloGames());
        assertEquals(1, ref(out, 10).getGameList().size());
    }

    @Test
    void scorekeeperNeverGetsSoloPay() {
        Map<Key, Credits> out = StaffPayCalculator.compute(List.of(game(1, PAST, "completed", null, null, 20L)), NOW);

        Credits sk = out.get(new Key(20L, "SCOREKEEPER"));
        assertEquals(1, sk.getGames());
        assertEquals(0, sk.getSoloGames());
        assertNull(ref(out, 20));
    }

    @Test
    void futureNullDateAndCancelledGamesAreSkipped() {
        Map<Key, Credits> out = StaffPayCalculator.compute(List.of(
                game(1, FUTURE, "scheduled", 10L, 11L, 20L),
                game(2, null, "scheduled", 10L, 11L, 20L),
                game(3, PAST, "cancelled", 10L, 11L, 20L),
                game(4, PAST, "Postponed", 10L, 11L, 20L),
                game(5, PAST, "in_progress", 10L, 11L, 20L)), NOW);

        assertEquals(1, ref(out, 10).getGames());
        assertEquals(1, ref(out, 11).getGames());
        assertEquals(1, out.get(new Key(20L, "SCOREKEEPER")).getGames());
        assertEquals(5L, ref(out, 10).getGameList().get(0).gameId());
    }

    @Test
    void gameOnTheCutoffInstantDoesNotCount() {
        Map<Key, Credits> out = StaffPayCalculator.compute(List.of(game(1, NOW, "completed", 10L, 11L, null)), NOW);

        assertTrue(out.isEmpty());
    }

    @Test
    void personWorkingBothRolesGetsTwoSeparateLines() {
        Map<Key, Credits> out = StaffPayCalculator.compute(List.of(
                game(1, PAST, "completed", 10L, 11L, 10L),
                game(2, PAST, "completed", 10L, null, 12L)), NOW);

        assertEquals(3, ref(out, 10).getGames());
        assertEquals(1, ref(out, 10).getSoloGames());
        assertEquals(1, out.get(new Key(10L, "SCOREKEEPER")).getGames());
        assertEquals(4, out.size());
    }

    @Test
    void totalsAccumulateAcrossGames() {
        Map<Key, Credits> out = StaffPayCalculator.compute(List.of(
                game(1, PAST, "completed", 10L, 11L, null),
                game(2, PAST, "completed", 10L, null, null),
                game(3, PAST, "completed", 11L, 10L, null),
                game(4, PAST, "completed", null, 10L, null)), NOW);

        // 1 + 2 (solo) + 1 + 2 (solo)
        assertEquals(6, ref(out, 10).getGames());
        assertEquals(2, ref(out, 10).getSoloGames());
        assertEquals(4, ref(out, 10).getGameList().size());
        assertEquals(2, ref(out, 11).getGames());
    }

    @Test
    void nullListYieldsNothing() {
        assertTrue(StaffPayCalculator.compute(null, NOW).isEmpty());
    }
}
