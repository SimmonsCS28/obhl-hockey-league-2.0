package com.obhl.league.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.league.dto.LeagueDto;
import com.obhl.league.service.LeagueService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/leagues")
@RequiredArgsConstructor
public class LeagueController {

    private final LeagueService leagueService;

    @GetMapping
    public ResponseEntity<List<LeagueDto.Response>> getLeagues(
            @RequestParam(required = false) Long seasonId) {
        if (seasonId != null) {
            return ResponseEntity.ok(leagueService.getLeaguesBySeason(seasonId));
        }
        return ResponseEntity.ok(leagueService.getAllLeagues());
    }

    @GetMapping("/{leagueId}")
    public ResponseEntity<LeagueDto.Response> getLeague(@PathVariable Long leagueId) {
        return leagueService.getLeagueById(leagueId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createLeague(@Valid @RequestBody LeagueDto.Create leagueDto) {
        LeagueDto.Response created = leagueService.createLeague(leagueDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{leagueId}")
    public ResponseEntity<?> updateLeague(
            @PathVariable Long leagueId,
            @Valid @RequestBody LeagueDto.Update updateDto) {
        try {
            LeagueDto.Response updated = leagueService.updateLeague(leagueId, updateDto);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{leagueId}")
    public ResponseEntity<Void> deleteLeague(@PathVariable Long leagueId) {
        try {
            leagueService.deleteLeague(leagueId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
