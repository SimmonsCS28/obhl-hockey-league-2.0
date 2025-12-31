package com.obhl.game.client;

import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "api-gateway", url = "${application.config.api-gateway-url:http://localhost:8000}")
public interface TeamClient {

    @PatchMapping("/api/v1/teams/{teamId}/stats")
    void updateTeamStats(@PathVariable("teamId") Long teamId, @RequestBody Map<String, Integer> statsUpdate);
}
