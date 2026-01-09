package com.obhl.game.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.game.client.TeamClient;
import com.obhl.game.dto.GameDto;
import com.obhl.game.dto.TeamResponse;
import com.obhl.game.model.Game;
import com.obhl.game.repository.GameRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/gm")
@RequiredArgsConstructor
public class GMGameController {

    private final GameRepository gameRepository;
    private final TeamClient teamClient;

    /**
     * Get team's schedule for a season
     */
    @GetMapping("/team/{teamId}/schedule")
    public ResponseEntity<List<GameDto.Response>> getTeamSchedule(
            @PathVariable Long teamId,
            @RequestParam Long seasonId) {

        // Get all games where the team is either home or away
        System.out.println("Fetching schedule for team " + teamId + " season " + seasonId);
        List<Game> games = gameRepository.findBySeasonIdAndTeam(seasonId, teamId);
        System.out.println("Found " + games.size() + " games");

        // Fetch specific teams from API Gateway
        Map<Long, TeamResponse> teamMap = new HashMap<>();
        try {
            List<TeamResponse> teams = teamClient.getTeams(seasonId);
            System.out.println("Fetched " + teams.size() + " teams from gateway");
            teamMap = teams.stream()
                    .collect(Collectors.toMap(TeamResponse::getId, Function.identity()));
        } catch (Exception e) {
            System.err.println("Failed to fetch teams: " + e.getMessage());
            e.printStackTrace();
        }

        // Map to DTO
        final Map<Long, TeamResponse> finalTeamMap = teamMap;
        List<GameDto.Response> gameDtos = games.stream().map(game -> {
            GameDto.Response dto = new GameDto.Response();
            dto.setId(game.getId());
            dto.setSeasonId(game.getSeasonId());
            dto.setLeagueId(game.getLeagueId());
            dto.setHomeTeamId(game.getHomeTeamId());
            dto.setAwayTeamId(game.getAwayTeamId());
            dto.setGameDate(game.getGameDate());
            dto.setVenue(game.getVenue());
            dto.setStatus(game.getStatus());
            dto.setHomeScore(game.getHomeScore());
            dto.setAwayScore(game.getAwayScore());
            dto.setOvertime(game.getOvertime());
            dto.setShootout(game.getShootout());
            dto.setPeriod(game.getPeriod());
            dto.setGameType(game.getGameType());
            dto.setWeek(game.getWeek());
            dto.setRink(game.getRink());
            dto.setGameNotes(game.getGameNotes());
            dto.setEndedInOT(game.getEndedInOT());
            dto.setCreatedAt(game.getCreatedAt());
            dto.setUpdatedAt(game.getUpdatedAt());

            // Populate Names
            TeamResponse homeTeam = finalTeamMap.get(game.getHomeTeamId());
            TeamResponse awayTeam = finalTeamMap.get(game.getAwayTeamId());

            String hName = homeTeam != null ? homeTeam.getName() : "Team " + game.getHomeTeamId();
            String aName = awayTeam != null ? awayTeam.getName() : "Team " + game.getAwayTeamId();
            String hColor = homeTeam != null ? homeTeam.getTeamColor() : null;
            String aColor = awayTeam != null ? awayTeam.getTeamColor() : null;

            dto.setHomeTeamName(hName);
            dto.setAwayTeamName(aName);
            dto.setHomeTeamColor(hColor);
            dto.setAwayTeamColor(aColor);

            // Debug first game
            if (games.indexOf(game) == 0) {
                System.out.println("Mapped Game " + game.getId() + ": Home=" + hName + " Away=" + aName);
            }

            return dto;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(gameDtos);
    }
}
