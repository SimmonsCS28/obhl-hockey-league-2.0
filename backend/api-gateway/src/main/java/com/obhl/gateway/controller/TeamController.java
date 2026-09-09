package com.obhl.gateway.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.TeamDto;
import com.obhl.gateway.service.TeamService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;

    @GetMapping
    public ResponseEntity<List<TeamDto.Response>> getTeams(
            @RequestParam(required = false) Long seasonId,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(teamService.getTeams(seasonId, skip, limit));
    }

    @GetMapping("/{teamId}")
    public ResponseEntity<TeamDto.Response> getTeam(@PathVariable Long teamId) {
        return teamService.getTeamById(teamId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createTeam(@RequestBody TeamDto.Create teamDto) {
        // Check if team with same name exists in the same season
        if (teamDto.getSeasonId() != null &&
                teamService.getTeamByNameAndSeason(teamDto.getName(), teamDto.getSeasonId()).isPresent()) {
            return ResponseEntity.badRequest()
                    .body("Team with name '" + teamDto.getName() + "' already exists in this season");
        }

        TeamDto.Response created = teamService.createTeam(teamDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{teamId}")
    public ResponseEntity<?> updateTeam(
            @PathVariable Long teamId,
            @RequestBody TeamDto.Update updateDto) {
        // A team's name is unique per season (teams_name_season_unique). Check it up front the
        // way createTeam does. Without this the constraint violation escapes as a
        // DataIntegrityViolationException, which the catch below flattens into a bare 404 with no
        // body -- so a GM renaming their team to one that is already taken just sees "Failed to
        // save team name" and has no way to know the name was the problem.
        // The name may be sent on its own (the GM rename does), so fall back to the team's
        // current season rather than assuming the payload carries seasonId.
        if (updateDto.getName() != null) {
            Long seasonId = updateDto.getSeasonId() != null
                    ? updateDto.getSeasonId()
                    : teamService.getTeamById(teamId).map(TeamDto.Response::getSeasonId).orElse(null);
            if (seasonId != null && teamService.getTeamByNameAndSeason(updateDto.getName(), seasonId)
                    .filter(existing -> !existing.getId().equals(teamId))
                    .isPresent()) {
                return ResponseEntity.badRequest()
                        .body("Team with name '" + updateDto.getName() + "' already exists in this season");
            }
        }

        try {
            TeamDto.Response updated = teamService.updateTeam(teamId, updateDto);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{teamId}")
    public ResponseEntity<Void> deleteTeam(@PathVariable Long teamId) {
        try {
            teamService.deleteTeam(teamId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{teamId}/stats")
    public ResponseEntity<Void> updateTeamStats(
            @PathVariable Long teamId,
            @RequestBody java.util.Map<String, Integer> statsUpdate) {
        try {
            teamService.incrementTeamStats(teamId, statsUpdate);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
