package com.obhl.gateway.service;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GameProxyServiceSecurityTest {
    @Test void coordinatorAndSelfSignupCallsCarryBackendCredential() {
        RestTemplate rest = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(rest).build();
        GameProxyService service = new GameProxyService();
        ReflectionTestUtils.setField(service, "restTemplate", rest);
        ReflectionTestUtils.setField(service, "gameServiceUrl", "http://game-service:8002");
        ReflectionTestUtils.setField(service, "internalServiceKey", "fixture-internal-key");
        for (String role : new String[]{"referee", "scorekeeper"}) {
            for (HttpMethod method : new HttpMethod[]{HttpMethod.POST, HttpMethod.DELETE}) {
                server.expect(requestTo("http://game-service:8002/api/v1/games/1/" + role + "/42"))
                        .andExpect(method(method)).andExpect(header("X-Internal-Service-Key", "fixture-internal-key"))
                        .andRespond(withSuccess());
            }
        }
        server.expect(requestTo("http://game-service:8002/api/v1/games/1"))
                .andExpect(method(HttpMethod.PATCH)).andExpect(header("X-Internal-Service-Key", "fixture-internal-key"))
                .andRespond(withSuccess());
        service.assignReferee(1L, 42L); service.removeReferee(1L, 42L);
        service.assignScorekeeper(1L, 42L); service.removeScorekeeper(1L, 42L);
        service.updateGameStaff(1L, Map.of("goalie1Id", 42L));
        server.verify();
    }
}
