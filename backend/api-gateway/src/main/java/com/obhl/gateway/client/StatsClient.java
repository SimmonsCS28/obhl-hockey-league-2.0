package com.obhl.gateway.client;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.obhl.gateway.dto.PlayerDTO;

@FeignClient(name = "stats-service", url = "${application.config.stats-service-url:http://localhost:8082}")
public interface StatsClient {

    @PostMapping("/api/v1/players/batch")
    List<Map<String, Object>> createPlayers(@RequestBody List<Map<String, Object>> players);

    @GetMapping("/api/v1/players/{playerId}")
    PlayerDTO getPlayer(@PathVariable("playerId") Long playerId);
}
