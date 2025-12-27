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
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(teamService.getTeams(skip, limit));
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
}
