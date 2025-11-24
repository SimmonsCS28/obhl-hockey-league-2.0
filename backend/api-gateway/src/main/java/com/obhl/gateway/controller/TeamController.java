package com.obhl.gateway.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.obhl.gateway.dto.TeamDto;
import com.obhl.gateway.service.TeamService;

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
    public ResponseEntity<?> createTeam(@Valid @RequestBody TeamDto.Create teamDto) {
        if (teamService.getTeamByName(teamDto.getName()).isPresent()) {
            return ResponseEntity.badRequest()
                    .body("Team with name '" + teamDto.getName() + "' already exists");
        }

        TeamDto.Response created = teamService.createTeam(teamDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{teamId}")
    public ResponseEntity<?> updateTeam(
            @PathVariable Long teamId,
            @Valid @RequestBody TeamDto.Update updateDto) {
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
