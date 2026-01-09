package com.obhl.stats.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.stats.model.Player;
import com.obhl.stats.repository.PlayerRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/gm")
@RequiredArgsConstructor
public class GMController {

    private final PlayerRepository playerRepository;

    /**
     * Get team roster for GM
     */
    @GetMapping("/team/{teamId}/roster")
    public ResponseEntity<List<Player>> getTeamRoster(@PathVariable Long teamId) {
        List<Player> roster = playerRepository.findByTeamId(teamId);
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
                    // Convert to Integer
                    Integer newJerseyNumber = jerseyObj instanceof Number
                            ? ((Number) jerseyObj).intValue()
                            : Integer.parseInt(jerseyObj.toString());

                    player.setJerseyNumber(newJerseyNumber);
                    Player updated = playerRepository.save(player);
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
