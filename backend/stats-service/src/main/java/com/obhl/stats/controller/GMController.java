package com.obhl.stats.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.stats.config.PlayerAccess;
import com.obhl.stats.model.Player;
import com.obhl.stats.repository.PlayerRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/gm")
@RequiredArgsConstructor
public class GMController {

    private final PlayerRepository playerRepository;

    /**
     * Get team roster for GM, optionally scoped to a specific season.
     * When seasonId is provided only players from that season are returned,
     * preventing cross-season roster bleed.
     */
    @GetMapping("/team/{teamId}/roster")
    public ResponseEntity<List<Player>> getTeamRoster(
            @PathVariable Long teamId,
            @RequestParam(required = false) Long seasonId) {
        List<Player> roster = (seasonId != null)
                ? playerRepository.findBySeasonIdAndTeamId(seasonId, teamId)
                : playerRepository.findByTeamId(teamId);
        return ResponseEntity.ok(roster);
    }

    /**
     * Update player jersey number (GM can only update their team's players)
     */
    @PatchMapping("/players/{playerId}/jersey")
    public ResponseEntity<Player> updateJerseyNumber(
            @PathVariable Long playerId,
            @RequestBody Map<String, Object> updates) {

        Object jerseyObj = updates.get("jerseyNumber");
        if (jerseyObj == null) {
            return ResponseEntity.badRequest().build();
        }

        return playerRepository.findById(playerId)
                .map(player -> {
                    Integer newJerseyNumber = jerseyObj instanceof Number
                            ? ((Number) jerseyObj).intValue()
                            : Integer.parseInt(jerseyObj.toString());
                    player.setJerseyNumber(newJerseyNumber);
                    Player updated = playerRepository.save(player);
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Update player skill rating (GM can only update their team's players)
     * Valid range: 1–10, or null to clear (used for goalies not yet rated by
     * a Goalie Coordinator).
     */
    @PatchMapping("/players/{playerId}/skill")
    @PreAuthorize("hasAnyRole('ADMIN','GM','GOALIE_COORDINATOR')")
    public ResponseEntity<Player> updateSkillRating(
            @PathVariable Long playerId,
            @RequestBody Map<String, Object> updates,
            Authentication authentication) {

        if (!updates.containsKey("skillRating")) {
            return ResponseEntity.badRequest().build();
        }
        Object skillObj = updates.get("skillRating");

        return playerRepository.findById(playerId)
                .map(player -> {
                    if (!PlayerAccess.canRateSkill(authentication, player.getPosition())) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<Player>build();
                    }
                    if (skillObj == null) {
                        player.setSkillRating(null);
                    } else {
                        int rating = skillObj instanceof Number
                                ? ((Number) skillObj).intValue()
                                : Integer.parseInt(skillObj.toString());
                        rating = Math.max(1, Math.min(10, rating));
                        player.setSkillRating(rating);
                    }
                    Player updated = playerRepository.save(player);
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
