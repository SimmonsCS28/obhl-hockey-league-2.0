package com.obhl.stats.config;

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

import com.obhl.stats.controller.*;
import com.obhl.stats.util.JwtUtil;

@WebMvcTest(controllers = {PlayerController.class, StatsController.class, GMController.class}, properties = {
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
    @MockBean com.obhl.stats.repository.PlayerRepository players;
    @MockBean com.obhl.stats.repository.PlayerStatsRepository playerStats;
    @MockBean com.obhl.stats.repository.GoalieStatsRepository goalieStats;

    @Test void writesRejectAnonymousAndOrdinaryUsersBeforeParsing() throws Exception {
        String[][] routes = {
            {"POST", "/api/v1/players"}, {"POST", "/api/v1/players/batch"},
            {"PUT", "/api/v1/players/deactivate-prior-seasons"}, {"PUT", "/api/v1/players/1"},
            {"PATCH", "/api/v1/players/1"}, {"DELETE", "/api/v1/players/1"},
            {"POST", "/api/v1/stats/players"}, {"POST", "/api/v1/stats/goalies"},
            {"POST", "/api/v1/stats/players/increment"},
            {"PATCH", "/api/v1/gm/players/1/jersey"}, {"PATCH", "/api/v1/gm/players/1/skill"}
        };
        for (String[] route : routes) {
            mvc.perform(request(HttpMethod.valueOf(route[0]), route[1]).contentType("application/json").content("{"))
                    .andExpect(status().isUnauthorized());
            mvc.perform(request(HttpMethod.valueOf(route[0]), route[1]).header("Authorization", token("USER"))
                    .contentType("application/json").content("{")).andExpect(status().isForbidden());
        }
        verifyNoInteractions(players, playerStats, goalieStats);
    }

    @Test void publicReadsStayPublicButGmRosterDoesNot() throws Exception {
        mvc.perform(get("/api/v1/players")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/stats/players?seasonId=1")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/gm/team/1/roster")).andExpect(status().isUnauthorized());
    }

    @Test void adminAndBackendStatsWritesReachPersistence() throws Exception {
        mvc.perform(post("/api/v1/stats/players").header("Authorization", token("ADMIN"))
                .contentType("application/json").content("{\"playerId\":1,\"seasonId\":1}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/stats/goalies").header("X-Internal-Service-Key", INTERNAL)
                .contentType("application/json").content("{\"playerId\":1,\"seasonId\":1}"))
                .andExpect(status().isOk());
        verify(playerStats).save(any());
        verify(goalieStats).save(any());
    }

    @Test void gmAndCoordinatorKeepTheirNarrowPermissions() throws Exception {
        var player = new com.obhl.stats.model.Player();
        player.setPosition("G");
        when(players.findById(1L)).thenReturn(java.util.Optional.of(player));
        when(players.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        mvc.perform(patch("/api/v1/gm/players/1/jersey").header("Authorization", token("GM"))
                .contentType("application/json").content("{\"jerseyNumber\":12}"))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/v1/gm/players/1/skill").header("Authorization", token("GOALIE_COORDINATOR"))
                .contentType("application/json").content("{\"skillRating\":4}"))
                .andExpect(status().isOk());
        player.setPosition("F");
        mvc.perform(patch("/api/v1/gm/players/1/skill").header("Authorization", token("GOALIE_COORDINATOR"))
                .contentType("application/json").content("{\"skillRating\":4}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/players").header("Authorization", token("GM"))
                .contentType("application/json").content("{}")).andExpect(status().isForbidden());
        verify(players, times(2)).save(any());
    }

    @Test void invalidExpiredAndPublicDefaultCredentialsFailClosed() throws Exception {
        for (String auth : List.of("Bearer junk", signed("ADMIN", SECRET, 1, false),
                signed("ADMIN", "wrong-signing-key-123456789012345678901234567890", System.currentTimeMillis()+60000, false))) {
            mvc.perform(post("/api/v1/players").header("Authorization", auth)
                    .contentType("application/json").content("{")).andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/v1/players").header("X-Internal-Service-Key", "obhl-internal-service-key-change-in-production")
                .contentType("application/json").content("{")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/players").header("Authorization", token("INTERNAL_SERVICE"))
                .contentType("application/json").content("{")).andExpect(status().isForbidden());
        verifyNoInteractions(players);
    }

}
