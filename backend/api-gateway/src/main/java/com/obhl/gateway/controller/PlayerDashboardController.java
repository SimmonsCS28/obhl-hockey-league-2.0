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
import com.obhl.gateway.dto.TeamDto;
import com.obhl.gateway.service.TeamService;

@RestController
@RequestMapping("/api/v1/user/dashboard")
public class PlayerDashboardController {

    private static final Logger log = LoggerFactory.getLogger(PlayerDashboardController.class);

    private final StatsClient statsClient;
    private final LeagueClient leagueClient;
    private final GameClient gameClient;
    private final TeamService teamService;

    public PlayerDashboardController(StatsClient statsClient, LeagueClient leagueClient, GameClient gameClient,
            TeamService teamService) {
        this.statsClient = statsClient;
        this.leagueClient = leagueClient;
        this.gameClient = gameClient;
        this.teamService = teamService;
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
            return ResponseEntity.ok(new PlayerDashboardDTO());
        }

        if (player == null || player.getTeamId() == null) {
            return ResponseEntity.ok(new PlayerDashboardDTO());
        }

        // 3. Get Team - use local TeamService (teams live in the api-gateway DB)
        Map<String, Object> team;
        try {
            TeamDto.Response teamDto = teamService.getTeamById(player.getTeamId())
                    .orElseThrow(() -> new RuntimeException("Team not found: " + player.getTeamId()));
            team = new java.util.HashMap<>();
            team.put("id", teamDto.getId());
            team.put("name", teamDto.getName());
            team.put("abbreviation", teamDto.getAbbreviation());
            team.put("seasonId", teamDto.getSeasonId());
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

        // 4b. Enrich game maps with team names (game-service returns null for team
        // names)
        if (!games.isEmpty()) {
            // Collect all unique team IDs across all games
            java.util.Set<Long> teamIds = new java.util.HashSet<>();
            for (Map<String, Object> g : games) {
                if (g.get("homeTeamId") instanceof Number n)
                    teamIds.add(n.longValue());
                if (g.get("awayTeamId") instanceof Number n)
                    teamIds.add(n.longValue());
            }
            // Build id->name and id->color cache
            java.util.Map<Long, String> teamNames = new java.util.HashMap<>();
            java.util.Map<Long, String> teamColors = new java.util.HashMap<>();
            for (Long tid : teamIds) {
                teamService.getTeamById(tid).ifPresent(t -> {
                    teamNames.put(t.getId(), t.getName());
                    teamColors.put(t.getId(), t.getTeamColor());
                });
            }
            // Patch each game map with resolved names and colors (make mutable copies)
            List<Map<String, Object>> enriched = new java.util.ArrayList<>();
            for (Map<String, Object> g : games) {
                Map<String, Object> m = new java.util.HashMap<>(g);
                if (m.get("homeTeamId") instanceof Number n) {
                    m.put("homeTeamName", teamNames.getOrDefault(n.longValue(), "Unknown"));
                    m.put("homeTeamColor", teamColors.getOrDefault(n.longValue(), "#ffffff"));
                }
                if (m.get("awayTeamId") instanceof Number n) {
                    m.put("awayTeamName", teamNames.getOrDefault(n.longValue(), "Unknown"));
                    m.put("awayTeamColor", teamColors.getOrDefault(n.longValue(), "#ffffff"));
                }
                enriched.add(m);
            }
            games = enriched;
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
            String gameDateStr = (String) game.get("gameDate"); // Already a full ISO datetime e.g.
                                                                // '2026-01-10T04:15:00'

            // Basic Next Game Logic
            if (!"COMPLETED".equalsIgnoreCase(status)) {
                if (nextGame == null && gameDateStr != null) {
                    try {
                        LocalDateTime gameDateTime = LocalDateTime
                                .parse(gameDateStr.length() > 19 ? gameDateStr.substring(0, 19) : gameDateStr);
                        if (gameDateTime.isAfter(now)) {
                            nextGame = game;
                        }
                    } catch (Exception ex) {
                        log.warn("Could not parse gameDate: {}", gameDateStr);
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

        PlayerDashboardDTO dto = new PlayerDashboardDTO();
        dto.setFirstName(player.getFirstName());
        dto.setLastName(player.getLastName());
        dto.setTeam(team);
        dto.setRecord(new PlayerDashboardDTO.TeamRecord(wins, losses, ties, otLosses));
        dto.setNextGame(nextGame);
        dto.setSchedule(games);

        return ResponseEntity.ok(dto);
    }
}
