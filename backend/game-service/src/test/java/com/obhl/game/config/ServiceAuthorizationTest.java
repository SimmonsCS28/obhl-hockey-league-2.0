package com.obhl.game.config;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

import com.obhl.game.controller.*;
import com.obhl.game.util.JwtUtil;

@WebMvcTest(controllers = {GameController.class, GameEventController.class}, properties = {
        "api.v1.prefix=/api/v1", "jwt.secret=" + ServiceAuthorizationTest.SECRET,
        "internal.service.key=" + ServiceAuthorizationTest.INTERNAL})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtUtil.class})
class ServiceAuthorizationTest {

    static final String SECRET = "test-only-jwt-secret-not-for-deployment-1234567890";
    static final String INTERNAL = "test-only-internal-key-not-for-deployment-1234567890";
    @Autowired MockMvc mvc;

    String token(String role) {
        return signed(role, SECRET, System.currentTimeMillis() + 60000, false);
    }
    String signed(String role, String secret, long expiry, boolean legacy) {
        return "Bearer " + Jwts.builder().setSubject("42").claim("username", "fixture")
                .claim(legacy ? "role" : "roles", legacy ? role : List.of(role))
                .setExpiration(new Date(expiry))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), SignatureAlgorithm.HS256).compact();
    }
    @MockBean com.obhl.game.service.GameService gameService;
    @MockBean com.obhl.game.service.GameEventService events;
    @MockBean com.obhl.game.service.PenaltyValidator penalties;
    @MockBean com.obhl.game.service.GoalLimitValidator goals;
    @MockBean com.obhl.game.service.CsvParserService csv;
    @MockBean com.obhl.game.service.ScheduleGeneratorService schedule;
    @MockBean com.obhl.game.service.schedule.TournamentScheduleService tournamentSchedule;
    @MockBean com.obhl.game.service.scoring.TournamentStandingsService standings;
    @MockBean com.obhl.game.service.scoring.TournamentAwardService awards;
    @MockBean com.obhl.game.service.schedule.TournamentBracketService bracket;

    @Test void anonymousAndOrdinaryUsersCannotMutateAnyWriteSurface() throws Exception {
        String[][] routes = {
            {"POST", "/api/v1/games"}, {"PATCH", "/api/v1/games/1"}, {"DELETE", "/api/v1/games/1"},
            {"PATCH", "/api/v1/games/1/score"}, {"POST", "/api/v1/games/1/start"},
            {"POST", "/api/v1/games/1/finalize"}, {"POST", "/api/v1/games/1/unfinalize"},
            {"POST", "/api/v1/games/1/revert-to-scheduled"}, {"POST", "/api/v1/games/generate"},
            {"DELETE", "/api/v1/games/season/1"}, {"POST", "/api/v1/games/1/events"},
            {"PATCH", "/api/v1/games/1/events/2"}, {"DELETE", "/api/v1/games/1/events/2"},
            {"POST", "/api/v1/game-events"}, {"DELETE", "/api/v1/game-events/2"},
            {"POST", "/api/v1/games/1/referee/42"}, {"POST", "/api/v1/games/1/scorekeeper/42"},
            {"POST", "/api/v1/games/tournament-schedule"}, {"PATCH", "/api/v1/games/1/bracket-slot"},
            {"POST", "/api/v1/games/upload-slots"}, {"POST", "/api/v1/games/1/awards"}
        };
        for (String[] route : routes) {
            mvc.perform(request(HttpMethod.valueOf(route[0]), route[1]).contentType("application/json").content("{"))
                    .andExpect(status().isUnauthorized());
            mvc.perform(request(HttpMethod.valueOf(route[0]), route[1]).header("Authorization", token("USER"))
                    .contentType("application/json").content("{")).andExpect(status().isForbidden());
        }
        verifyNoInteractions(gameService, events, penalties, goals, csv, schedule, tournamentSchedule, standings, awards, bracket);
    }

    @Test void publicReadsStayPublic() throws Exception {
        mvc.perform(get("/api/v1/games")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/game-events?gameId=1")).andExpect(status().isOk());
    }

    @Test void scorekeepersCanScoreButCannotChangeSchedulesOrStaff() throws Exception {
        mvc.perform(post("/api/v1/games/1/start").header("Authorization", token("SCOREKEEPER")))
                .andExpect(status().isOk());
        verify(gameService).startGame(1L);
        mvc.perform(patch("/api/v1/games/1/score").header("Authorization", token("SCOREKEEPER"))
                .contentType("application/json").content("{\"homeScore\":1,\"awayScore\":0}"))
                .andExpect(status().isOk());
        verify(gameService).updateGameScore(eq(1L), any());
        for (String role : List.of("SCOREKEEPER", "REF", "GM", "GOALIE_COORDINATOR")) {
            mvc.perform(patch("/api/v1/games/1").header("Authorization", token(role))
                    .contentType("application/json").content("{\"scorekeeperId\":42}"))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/games/1/revert-to-scheduled").header("Authorization", token("SCOREKEEPER")))
                .andExpect(status().isForbidden());
        verify(gameService, never()).updateGame(anyLong(), any());
        verify(gameService, never()).revertToScheduled(anyLong());
    }

    @Test void scorekeepersCanReopenGamesWhileUnrelatedRolesCannot() throws Exception {
        for (String role : List.of("SCOREKEEPER", "ADMIN")) {
            mvc.perform(post("/api/v1/games/1/unfinalize").header("Authorization", token(role)))
                    .andExpect(status().isOk());
        }
        mvc.perform(post("/api/v1/games/1/unfinalize").header("X-Internal-Service-Key", INTERNAL))
                .andExpect(status().isOk());
        for (String role : List.of("USER", "REF", "GM", "GOALIE_COORDINATOR", "INTERNAL_SERVICE")) {
            mvc.perform(post("/api/v1/games/1/unfinalize").header("Authorization", token(role)))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/games/1/unfinalize")).andExpect(status().isUnauthorized());
        verify(gameService, times(3)).unfinalizeGame(1L);
    }

    @Test void adminAndBackendCallsCanMutate() throws Exception {
        mvc.perform(delete("/api/v1/games/1").header("Authorization", token("ADMIN"))).andExpect(status().isNoContent());
        mvc.perform(patch("/api/v1/games/2").header("X-Internal-Service-Key", INTERNAL)
                .contentType("application/json").content("{\"scorekeeperId\":42}"))
                .andExpect(status().isOk());
        verify(gameService).deleteGame(1L);
        verify(gameService).updateGame(eq(2L), any());
    }

    @Test void invalidCredentialsAndJwtInternalRoleCannotBypassChecks() throws Exception {
        for (String auth : List.of("Bearer junk", signed("ADMIN", SECRET, 1, false),
                signed("ADMIN", "wrong-signing-key-123456789012345678901234567890", System.currentTimeMillis()+60000, false))) {
            mvc.perform(delete("/api/v1/games/1").header("Authorization", auth)).andExpect(status().isUnauthorized());
        }
        mvc.perform(delete("/api/v1/games/1").header("X-Internal-Service-Key", "obhl-internal-service-key-change-in-production"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/games/1").header("Authorization", token("INTERNAL_SERVICE")))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/games/1").header("Authorization", signed("ADMIN", SECRET, System.currentTimeMillis()+60000, true)))
                .andExpect(status().isNoContent());
        verify(gameService, times(1)).deleteGame(1L);
    }

}
