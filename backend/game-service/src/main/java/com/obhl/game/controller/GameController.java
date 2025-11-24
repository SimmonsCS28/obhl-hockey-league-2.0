package com.obhl.game.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import main.java.com.obhl.game.dto.GameDto;
import main.java.com.obhl.game.service.GameService;

@RestController
@RequestMapping("${api.v1.prefix}/games")
@RequiredArgsConstructor
public class GameController {

    private final GameService gameService;

    @GetMapping
    public ResponseEntity<List<GameDto.Response>> getGames(
            @RequestParam(required = false) Long seasonId,
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) String status) {

        if (seasonId != null) {
            return ResponseEntity.ok(gameService.getGamesBySeason(seasonId));
        } else if (teamId != null) {
            return ResponseEntity.ok(gameService.getGamesByTeam(teamId));
        } else if (status != null) {
            return ResponseEntity.ok(gameService.getGamesByStatus(status));
        }

        return ResponseEntity.ok(gameService.getAllGames());
    }

    @GetMapping("/{gameId}")
    public ResponseEntity<GameDto.Response> getGame(@PathVariable Long gameId) {
        return gameService.getGameById(gameId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createGame(@Valid @RequestBody GameDto.Create gameDto) {
        GameDto.Response created = gameService.createGame(gameDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{gameId}")
    public ResponseEntity<?> updateGame(
            @PathVariable Long gameId,
            @Valid @RequestBody GameDto.Update updateDto) {
        try {
            GameDto.Response updated = gameService.updateGame(gameId, updateDto);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{gameId}")
    public ResponseEntity<Void> deleteGame(@PathVariable Long gameId) {
        try {
            gameService.deleteGame(gameId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
