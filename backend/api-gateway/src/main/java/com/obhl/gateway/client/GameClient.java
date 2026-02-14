package com.obhl.gateway.client;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "game-service", url = "${application.config.game-service-url:http://localhost:8002}")
public interface GameClient {

    @GetMapping("/api/v1/games")
    List<Map<String, Object>> getGames(
            @RequestParam(value = "seasonId", required = false) Long seasonId,
            @RequestParam(value = "teamId", required = false) Long teamId,
            @RequestParam(value = "status", required = false) String status);
}
