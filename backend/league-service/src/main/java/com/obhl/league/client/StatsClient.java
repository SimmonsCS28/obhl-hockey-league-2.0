package com.obhl.league.client;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "stats-service", url = "${application.config.stats-service-url:http://localhost:8082}")
public interface StatsClient {

        @PostMapping("/api/v1/players/batch")
        List<Map<String, Object>> createPlayers(@RequestBody List<Map<String, Object>> players);

        @GetMapping("/api/v1/players/by-email-season")
        Map<String, Object> getPlayerByEmailAndSeason(
                        @RequestParam("email") String email,
                        @RequestParam("seasonId") Long seasonId);

        @PostMapping("/api/v1/players")
        Map<String, Object> createPlayer(@RequestBody Map<String, Object> playerData);

        @PutMapping("/api/v1/players/{id}")
        Map<String, Object> updatePlayer(
                        @PathVariable("id") Long id,
                        @RequestBody Map<String, Object> playerData);

        @DeleteMapping("/api/v1/players/{id}")
        void deletePlayer(@PathVariable("id") Long id);
}
