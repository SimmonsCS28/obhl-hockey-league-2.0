package com.obhl.game.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.obhl.game.dto.GameDto;
import com.obhl.game.dto.GameEventDto;
import com.obhl.game.dto.PenaltyValidationResponse;
import com.obhl.game.service.GameEventService;
import com.obhl.game.service.GameService;
import com.obhl.game.service.PenaltyValidator;

@RestController
@RequestMapping("${api.v1.prefix}/games")
@RequiredArgsConstructor
public class GameController {

    private final GameService gameService;
    private final GameEventService gameEventService;
    private final PenaltyValidator penaltyValidator;

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

    // Score and Finalization Endpoints
    @PatchMapping("/{gameId}/score")
    public ResponseEntity<?> updateGameScore(
            @PathVariable Long gameId,
            @RequestBody GameDto.ScoreUpdate scoreUpdate) {
        try {
            GameDto.Response updated = gameService.updateGameScore(gameId, scoreUpdate);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{gameId}/finalize")
    public ResponseEntity<?> finalizeGame(
            @PathVariable Long gameId,
            @RequestBody GameDto.FinalizeRequest finalizeRequest) {
        try {
            GameDto.Response finalized = gameService.finalizeGame(gameId, finalizeRequest);
            return ResponseEntity.ok(finalized);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Game Events Endpoints (nested under games)
    @PostMapping("/{gameId}/events")
    public ResponseEntity<?> createGameEvent(
            @PathVariable Long gameId,
            @Valid @RequestBody GameEventDto.Create eventDto) {
        // Ensure gameId matches
        eventDto.setGameId(gameId);
        GameEventDto.Response created = gameEventService.createEvent(eventDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{gameId}/events")
    public ResponseEntity<List<GameEventDto.Response>> getGameEvents(@PathVariable Long gameId) {
        return ResponseEntity.ok(gameEventService.getEventsByGame(gameId));
    }

    // Penalty Validation Endpoint (nested under games)
    @PostMapping("/{gameId}/penalties/validate")
    public ResponseEntity<PenaltyValidationResponse> validatePenalty(
            @PathVariable Long gameId,
            @RequestBody GameDto.PenaltyValidationRequest request) {
        PenaltyValidationResponse response = penaltyValidator.validatePenalty(
                request.getPlayerId(), gameId);
        return ResponseEntity.ok(response);
    }

    // Players Endpoint (for future use)
    @GetMapping("/{gameId}/players")
    public ResponseEntity<List<?>> getGamePlayers(@PathVariable Long gameId) {
        // TODO: Implement when player service is ready
        return ResponseEntity.ok(List.of());
    }
}
