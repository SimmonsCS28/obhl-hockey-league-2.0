package com.obhl.league.client;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "stats-service", url = "${application.config.stats-service-url:http://localhost:8082}")
public interface StatsClient {

    @PostMapping("/api/v1/players/batch")
    List<Map<String, Object>> createPlayers(@RequestBody List<Map<String, Object>> players);
}
