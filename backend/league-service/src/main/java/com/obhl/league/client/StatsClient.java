package com.obhl.league.client;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "stats-service", url = "${application.config.stats-service-url:http://localhost:8082}",
                configuration = StatsClientConfig.class)
public interface StatsClient {

        @GetMapping("/api/v1/players")
        List<Map<String, Object>> getAllPlayers();

        @GetMapping("/api/v1/players")
        List<Map<String, Object>> getPlayersBySeason(@RequestParam("seasonId") Long seasonId);

        @GetMapping("/api/v1/players/{id}")
        Map<String, Object> getPlayerById(@PathVariable("id") Long id);

        @PostMapping("/api/v1/players/batch")
        List<Map<String, Object>> createPlayers(@RequestBody List<Map<String, Object>> players);

        @GetMapping("/api/v1/players/by-email")
        Map<String, Object> getPlayerByEmail(@RequestParam("email") String email);

        @GetMapping("/api/v1/players/by-email-season")
        Map<String, Object> getPlayerByEmailAndSeason(
                        @RequestParam("email") String email,
                        @RequestParam("seasonId") Long seasonId);

        @PostMapping("/api/v1/players")
        Map<String, Object> createPlayer(@RequestBody Map<String, Object> playerData);

        @PatchMapping("/api/v1/players/{id}")
        Map<String, Object> updatePlayer(
                        @PathVariable("id") Long id,
                        @RequestBody Map<String, Object> playerData);

        @DeleteMapping("/api/v1/players/{id}")
        void deletePlayer(@PathVariable("id") Long id);

        /**
         * Deactivates every non-goalie player row in the given FINISHED seasons, so is_active
         * means "on a roster in the current season". Pass the league seasons other than the one
         * just drafted; an empty list deactivates nobody, so a bad call fails closed.
         *
         * Goalies are exempt on the server side - they are never drafted, so they never appear
         * in a registration list, and the previous email-based sweep deactivated all of them.
         */
        @PutMapping("/api/v1/players/deactivate-prior-seasons")
        void deactivatePriorSeasons(@RequestParam("seasonIds") List<Long> seasonIds);
}
