package com.obhl.game.client;

import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;

@FeignClient(name = "api-gateway", url = "${application.config.api-gateway-url:http://localhost:8000}")
public interface TeamClient {

    @org.springframework.web.bind.annotation.PostMapping("/api/v1/teams/{teamId}/stats")
    void updateTeamStats(@org.springframework.web.bind.annotation.PathVariable("teamId") Long teamId,
            @org.springframework.web.bind.annotation.RequestBody Map<String, Integer> statsUpdate);

    @org.springframework.web.bind.annotation.GetMapping("/api/v1/teams")
    java.util.List<com.obhl.game.dto.TeamResponse> getTeams(
            @org.springframework.web.bind.annotation.RequestParam("seasonId") Long seasonId);
}
