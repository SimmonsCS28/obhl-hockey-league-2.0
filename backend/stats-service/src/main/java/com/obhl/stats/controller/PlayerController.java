package com.obhl.stats.controller;

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

import com.obhl.stats.model.Player;
import com.obhl.stats.repository.PlayerRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/players")
@RequiredArgsConstructor
public class PlayerController {

    private final PlayerRepository playerRepository;

    @GetMapping
    public ResponseEntity<List<Player>> getPlayers(
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) Long seasonId,
            @RequestParam(required = false) String position,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Boolean unassigned) {

        if (Boolean.TRUE.equals(unassigned)) {
            return ResponseEntity.ok(playerRepository.findByTeamIdIsNull());
        } else if (seasonId != null && teamId != null) {
            return ResponseEntity.ok(playerRepository.findBySeasonIdAndTeamId(seasonId, teamId));
        } else if (seasonId != null) {
            return ResponseEntity.ok(playerRepository.findBySeasonId(seasonId));
        } else if (teamId != null && Boolean.TRUE.equals(active)) {
            return ResponseEntity.ok(playerRepository.findByTeamIdAndIsActiveTrue(teamId));
        } else if (teamId != null) {
            return ResponseEntity.ok(playerRepository.findByTeamId(teamId));
        } else if (position != null) {
            return ResponseEntity.ok(playerRepository.findByPosition(position));
        } else if (Boolean.TRUE.equals(active)) {
            return ResponseEntity.ok(playerRepository.findByIsActiveTrue());
        }

        return ResponseEntity.ok(playerRepository.findAll());
    }

    @GetMapping("/{playerId}")
    public ResponseEntity<Player> getPlayer(@PathVariable Long playerId) {
        return playerRepository.findById(playerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-email-season")
    public ResponseEntity<Player> getPlayerByEmailAndSeason(
            @RequestParam String email,
            @RequestParam Long seasonId) {
        return playerRepository.findByEmailAndSeasonId(email, seasonId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Player> createPlayer(@RequestBody Player player) {
        Player created = playerRepository.save(player);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/batch")
    public ResponseEntity<List<Player>> createPlayers(@RequestBody List<Player> players) {
        List<Player> created = playerRepository.saveAll(players);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{playerId}")
    public ResponseEntity<Player> updatePlayer(
            @PathVariable Long playerId,
            @RequestBody java.util.Map<String, Object> updates) {
        return playerRepository.findById(playerId)
                .map(existing -> {
                    if (updates.containsKey("teamId")) {
                        Object val = updates.get("teamId");
                        existing.setTeamId(val == null ? null : ((Number) val).longValue());
                    }
                    if (updates.containsKey("firstName"))
                        existing.setFirstName((String) updates.get("firstName"));
                    if (updates.containsKey("lastName"))
                        existing.setLastName((String) updates.get("lastName"));
                    if (updates.containsKey("jerseyNumber")) {
                        Object val = updates.get("jerseyNumber");
                        existing.setJerseyNumber(val == null ? null : ((Number) val).intValue());
                    }
                    if (updates.containsKey("position"))
                        existing.setPosition((String) updates.get("position"));
                    if (updates.containsKey("shoots"))
                        existing.setShoots((String) updates.get("shoots"));
                    if (updates.containsKey("seasonId")) {
                        Object val = updates.get("seasonId");
                        existing.setSeasonId(val == null ? null : ((Number) val).longValue());
                    }
                    if (updates.containsKey("skillRating")) {
                        Object val = updates.get("skillRating");
                        existing.setSkillRating(val == null ? 5 : ((Number) val).intValue());
                    }
                    if (updates.containsKey("email"))
                        existing.setEmail((String) updates.get("email"));
                    if (updates.containsKey("isVeteran"))
                        existing.setIsVeteran((Boolean) updates.get("isVeteran"));
                    if (updates.containsKey("birthDate")) {
                        Object val = updates.get("birthDate");
                        existing.setBirthDate(val == null ? null : java.time.LocalDate.parse((String) val));
                    }
                    if (updates.containsKey("hometown"))
                        existing.setHometown((String) updates.get("hometown"));
                    if (updates.containsKey("isActive"))
                        existing.setIsActive((Boolean) updates.get("isActive"));

                    return ResponseEntity.ok(playerRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{playerId}")
    public ResponseEntity<Void> deletePlayer(@PathVariable Long playerId) {
        if (playerRepository.existsById(playerId)) {
            playerRepository.deleteById(playerId);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
