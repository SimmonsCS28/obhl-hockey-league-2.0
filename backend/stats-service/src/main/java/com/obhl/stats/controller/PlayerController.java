package com.obhl.stats.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;
import main.java.com.obhl.stats.model.Player;
import main.java.com.obhl.stats.repository.PlayerRepository;

@RestController
@RequestMapping("${api.v1.prefix}/players")
@RequiredArgsConstructor
public class PlayerController {

    private final PlayerRepository playerRepository;

    @GetMapping
    public ResponseEntity<List<Player>> getPlayers(
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) String position,
            @RequestParam(required = false) Boolean active) {

        if (teamId != null && active != null && active) {
            return ResponseEntity.ok(playerRepository.findByTeamIdAndIsActiveTrue(teamId));
        } else if (teamId != null) {
            return ResponseEntity.ok(playerRepository.findByTeamId(teamId));
        } else if (position != null) {
            return ResponseEntity.ok(playerRepository.findByPosition(position));
        } else if (active != null && active) {
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

    @PostMapping
    public ResponseEntity<Player> createPlayer(@RequestBody Player player) {
        Player created = playerRepository.save(player);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{playerId}")
    public ResponseEntity<Player> updatePlayer(
            @PathVariable Long playerId,
            @RequestBody Player playerUpdate) {
        return playerRepository.findById(playerId)
                .map(existing -> {
                    if (playerUpdate.getTeamId() != null)
                        existing.setTeamId(playerUpdate.getTeamId());
                    if (playerUpdate.getFirstName() != null)
                        existing.setFirstName(playerUpdate.getFirstName());
                    if (playerUpdate.getLastName() != null)
                        existing.setLastName(playerUpdate.getLastName());
                    if (playerUpdate.getJerseyNumber() != null)
                        existing.setJerseyNumber(playerUpdate.getJerseyNumber());
                    if (playerUpdate.getPosition() != null)
                        existing.setPosition(playerUpdate.getPosition());
                    if (playerUpdate.getShoots() != null)
                        existing.setShoots(playerUpdate.getShoots());
                    if (playerUpdate.getHeightInches() != null)
                        existing.setHeightInches(playerUpdate.getHeightInches());
                    if (playerUpdate.getWeightLbs() != null)
                        existing.setWeightLbs(playerUpdate.getWeightLbs());
                    if (playerUpdate.getBirthDate() != null)
                        existing.setBirthDate(playerUpdate.getBirthDate());
                    if (playerUpdate.getHometown() != null)
                        existing.setHometown(playerUpdate.getHometown());
                    if (playerUpdate.getIsActive() != null)
                        existing.setIsActive(playerUpdate.getIsActive());
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
