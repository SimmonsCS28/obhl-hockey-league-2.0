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

import com.obhl.league.dto.SeasonDto;
import com.obhl.league.service.SeasonService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/seasons")
@RequiredArgsConstructor
public class SeasonController {

    private final SeasonService seasonService;

    /**
     * Season list, filtered to league seasons by default.
     *
     * <p>The {@code type} default of LEAGUE is a deliberate default-deny: tournament seasons exist
     * so tournament teams/players/games can be ordinary season-scoped rows, but if one reaches a
     * league season list the whole site can retarget to it (SeasonContext picks the current season
     * off that list). Filtering here rather than in the frontend is what makes it reliable -- two
     * callers (public/Home.jsx and SchedulePage.jsx) bypass both SeasonContext and services/api.js
     * with a raw fetch, so no client-side fix can reach them.
     *
     * @param type LEAGUE (default), TOURNAMENT, or ALL. Unrecognised values fail closed to LEAGUE.
     */
    @GetMapping
    public ResponseEntity<List<SeasonDto.Response>> getAllSeasons(
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "LEAGUE") String type) {
        if (status != null) {
            return ResponseEntity.ok(seasonService.getSeasonsByStatus(status, type));
        }
        return ResponseEntity.ok(seasonService.getAllSeasons(type));
    }

    @GetMapping("/active")
    public ResponseEntity<SeasonDto.Response> getActiveSeason() {
        return seasonService.getActiveSeason()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{seasonId}")
    public ResponseEntity<SeasonDto.Response> getSeason(@PathVariable Long seasonId) {
        return seasonService.getSeasonById(seasonId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createSeason(@Valid @RequestBody SeasonDto.Create seasonDto) {
        SeasonDto.Response created = seasonService.createSeason(seasonDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{seasonId}")
    public ResponseEntity<?> updateSeason(
            @PathVariable Long seasonId,
            @Valid @RequestBody SeasonDto.Update updateDto) {
        try {
            SeasonDto.Response updated = seasonService.updateSeason(seasonId, updateDto);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{seasonId}")
    public ResponseEntity<Void> deleteSeason(@PathVariable Long seasonId) {
        try {
            seasonService.deleteSeason(seasonId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
