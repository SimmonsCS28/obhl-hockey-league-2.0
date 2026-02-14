package com.obhl.gateway.controller;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.client.GameClient;
import com.obhl.gateway.client.LeagueClient;
import com.obhl.gateway.client.StatsClient;
import com.obhl.gateway.dto.PlayerDashboardDTO;
import com.obhl.gateway.dto.PlayerDto;

@RestController
@RequestMapping("/api/v1/user/dashboard")
public class PlayerDashboardController {

    private static final Logger log = LoggerFactory.getLogger(PlayerDashboardController.class);

    private final StatsClient statsClient;
    private final LeagueClient leagueClient;
    private final GameClient gameClient;

    public PlayerDashboardController(StatsClient statsClient, LeagueClient leagueClient, GameClient gameClient) {
        this.statsClient = statsClient;
        this.leagueClient = leagueClient;
        this.gameClient = gameClient;
    }

    @GetMapping
    public ResponseEntity<PlayerDashboardDTO> getDashboard(@AuthenticationPrincipal Object principal) {
        log.info("DEBUG: getDashboard called. Principal: {}", principal);
        if (principal != null) {
            log.info("DEBUG: Principal type: {}", principal.getClass().getName());
        }

        if (principal == null) {
            log.error("Principal is null - returning 400");
            return ResponseEntity.badRequest().build();
        }

        String email = null;
        if (principal instanceof String) {
            email = (String) principal;
        } else if (principal instanceof org.springframework.security.core.userdetails.UserDetails) {
            email = ((org.springframework.security.core.userdetails.UserDetails) principal).getUsername();
        } else {
            log.error("Unknown principal type: {}", principal.getClass().getName());
            return ResponseEntity.badRequest().build();
        }

        log.info("DEBUG: Resolved email/username: {}", email);

        // 1. Get Active Season
        Map<String, Object> activeSeason;
        try {
            activeSeason = leagueClient.getActiveSeason();
        } catch (Exception e) {
            log.error("Failed to fetch active season", e);
            return ResponseEntity.notFound().build();
        }

        Long seasonId = ((Number) activeSeason.get("id")).longValue();

        // 2. Get Player by Email & Season
        PlayerDto player;
        try {
            player = statsClient.getPlayerByEmailAndSeason(email, seasonId);
        } catch (Exception e) {
            log.warn("Player not found for email {} and season {}", email, seasonId);
            // Return empty dashboard if not a player in current season
            return ResponseEntity.ok(new PlayerDashboardDTO());
        }

        if (player == null || player.getTeamId() == null) {
            return ResponseEntity.ok(new PlayerDashboardDTO());
        }

        // 3. Get Team
        Map<String, Object> team;
        try {
            team = leagueClient.getTeam(player.getTeamId());
        } catch (Exception e) {
            log.error("Failed to fetch team {}", player.getTeamId(), e);
            return ResponseEntity.ok(new PlayerDashboardDTO());
        }

        // 4. Get Schedule (Games)
        List<Map<String, Object>> games;
        try {
            games = gameClient.getGames(seasonId, player.getTeamId(), null);
        } catch (Exception e) {
            log.error("Failed to fetch games", e);
            games = List.of();
        }

        // 5. Calculate Record & Identify Next Game
        int wins = 0;
        int losses = 0;
        int ties = 0;
        int otLosses = 0; // Keeping track but rolling into losses for W-L-T display if requested

        LocalDateTime now = LocalDateTime.now();
        Map<String, Object> nextGame = null;

        // Sort games by date
        games = games.stream()
                .sorted(Comparator.comparing(g -> (String) g.get("gameDate")))
                .collect(Collectors.toList());

        for (Map<String, Object> game : games) {
            String status = (String) game.get("status");
            String gameDateStr = (String) game.get("gameDate"); // ISO format expected
            String gameTimeStr = (String) game.get("gameTime");

            // Basic Next Game Logic
            if (!"COMPLETED".equalsIgnoreCase(status)) {
                if (nextGame == null) {
                    // unexpected date format handling might be needed, assuming ISO YYYY-MM-DD
                    LocalDateTime gameDateTime = LocalDateTime
                            .parse(gameDateStr + "T" + (gameTimeStr != null ? gameTimeStr : "00:00:00"));
                    if (gameDateTime.isAfter(now)) {
                        nextGame = game;
                    }
                }
            }

            // Stats Logic
            if ("COMPLETED".equalsIgnoreCase(status)) {
                Long homeTeamId = ((Number) game.get("homeTeamId")).longValue();
                int homeScore = ((Number) game.get("homeScore")).intValue();
                int awayScore = ((Number) game.get("awayScore")).intValue();
                boolean isOt = Boolean.TRUE.equals(game.get("endedInOT")); // Check field name compatibility

                boolean isHome = player.getTeamId().equals(homeTeamId);

                if (homeScore == awayScore) {
                    ties++;
                } else if (isHome) {
                    if (homeScore > awayScore) {
                        wins++;
                    } else {
                        if (isOt)
                            otLosses++;
                        losses++;
                    }
                } else {
                    // isAway
                    if (awayScore > homeScore) {
                        wins++;
                    } else {
                        if (isOt)
                            otLosses++;
                        losses++;
                    }
                }
            }
        }

        PlayerDashboardDTO.TeamRecord record = new PlayerDashboardDTO.TeamRecord(wins, losses, ties, otLosses);

        return ResponseEntity.ok(new PlayerDashboardDTO(team, record, nextGame, games));
    }
}
