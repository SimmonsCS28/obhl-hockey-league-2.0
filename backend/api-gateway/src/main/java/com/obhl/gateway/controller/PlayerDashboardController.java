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
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.TeamService;

@RestController
@RequestMapping("/api/v1/user/dashboard")
public class PlayerDashboardController {

    private static final Logger log = LoggerFactory.getLogger(PlayerDashboardController.class);

    private final StatsClient statsClient;
    private final LeagueClient leagueClient;
    private final GameClient gameClient;
    private final TeamService teamService;
    private final UserRepository userRepository;

    public PlayerDashboardController(StatsClient statsClient, LeagueClient leagueClient, GameClient gameClient,
            TeamService teamService, UserRepository userRepository) {
        this.statsClient = statsClient;
        this.leagueClient = leagueClient;
        this.gameClient = gameClient;
        this.teamService = teamService;
        this.userRepository = userRepository;
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

        String username = null;
        if (principal instanceof String) {
            username = (String) principal;
        } else if (principal instanceof org.springframework.security.core.userdetails.UserDetails) {
            username = ((org.springframework.security.core.userdetails.UserDetails) principal).getUsername();
        } else {
            log.error("Unknown principal type: {}", principal.getClass().getName());
            return ResponseEntity.badRequest().build();
        }

        log.info("DEBUG: Resolved username from principal: {}", username);

        // Look up the User to get their actual email (principal is username, not email)
        User userEntity = userRepository.findByUsername(username).orElse(null);
        if (userEntity == null) {
            log.warn("No user found for username: {}", username);
            return ResponseEntity.ok(new PlayerDashboardDTO());
        }
        String email = userEntity.getEmail();
        log.info("DEBUG: Resolved email from user record: {}", email);

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
        TeamDto.Response teamDto = null;
        try {
            teamDto = teamService.getTeamById(player.getTeamId())
                    .orElseThrow(() -> new RuntimeException("Team not found: " + player.getTeamId()));
            team = new java.util.HashMap<>();
            team.put("id", teamDto.getId());
            team.put("name", teamDto.getName());
            team.put("abbreviation", teamDto.getAbbreviation());
            team.put("seasonId", teamDto.getSeasonId());
            team.put("teamColor", teamDto.getTeamColor());
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

        // 5. Identify Next Game & sort games by date
        LocalDateTime now = LocalDateTime.now();
        Map<String, Object> nextGame = null;

        // Sort games by date
        games = games.stream()
                .sorted(Comparator.comparing(g -> (String) g.get("gameDate")))
                .collect(Collectors.toList());

        for (Map<String, Object> game : games) {
            String status = (String) game.get("status");
            String gameDateStr = (String) game.get("gameDate");

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
        }

        // 6. Use stored team record from database (updated by TeamStatsUpdater on game
        // finalize)
        int wins = teamDto.getWins() != null ? teamDto.getWins() : 0;
        int losses = teamDto.getLosses() != null ? teamDto.getLosses() : 0;
        int ties = teamDto.getTies() != null ? teamDto.getTies() : 0;
        int otLosses = teamDto.getOvertimeLosses() != null ? teamDto.getOvertimeLosses() : 0;

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
