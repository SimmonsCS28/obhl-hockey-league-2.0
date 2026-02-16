package com.obhl.gateway.client;

import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "league-service", url = "${league.service.url:http://localhost:8001}")
public interface LeagueClient {

    @PostMapping("/api/v1/seasons")
    Map<String, Object> createSeason(@RequestBody Map<String, Object> season);

    @GetMapping("/api/v1/seasons/active")
    Map<String, Object> getActiveSeason();

    @GetMapping("/api/v1/teams/{teamId}")
    Map<String, Object> getTeam(@PathVariable("teamId") Long teamId);
}
