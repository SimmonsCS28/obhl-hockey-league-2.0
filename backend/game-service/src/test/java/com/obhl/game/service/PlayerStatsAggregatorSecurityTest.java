package com.obhl.game.service;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import com.obhl.game.model.Game;
import com.obhl.game.model.GameEvent;
import com.obhl.game.repository.GameEventRepository;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class PlayerStatsAggregatorSecurityTest {
    @Test void finalizedGameSendsStatsWithBackendIdentity() {
        RestTemplate rest = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(rest).build();
        GameEventRepository events = mock(GameEventRepository.class);
        Game game = new Game(); game.setId(1L); game.setSeasonId(2L);
        GameEvent goal = new GameEvent(); goal.setEventType("goal"); goal.setPlayerId(3L); goal.setTeamId(4L);
        when(events.findByGameId(1L)).thenReturn(List.of(goal));
        PlayerStatsAggregator aggregator = new PlayerStatsAggregator(events, rest);
        ReflectionTestUtils.setField(aggregator, "statsServiceUrl", "http://stats-service:8003/api/v1");
        ReflectionTestUtils.setField(aggregator, "internalServiceKey", "fixture-internal-key");
        server.expect(requestTo("http://stats-service:8003/api/v1/stats/players/increment"))
                .andExpect(header("X-Internal-Service-Key", "fixture-internal-key"))
                .andExpect(jsonPath("$.playerId").value(3))
                .andExpect(jsonPath("$.goals").value(1))
                .andRespond(withSuccess());
        aggregator.aggregateAndUpdateStats(game);
        server.verify();
    }
}
