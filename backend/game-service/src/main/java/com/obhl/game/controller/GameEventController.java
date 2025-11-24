package com.obhl.game.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.obhl.game.dto.GameEventDto;
import com.obhl.game.dto.GoalValidationRequest;
import com.obhl.game.dto.GoalValidationResponse;
import com.obhl.game.dto.PenaltyValidationResponse;
import com.obhl.game.service.GameEventService;
import com.obhl.game.service.GoalLimitValidator;
import com.obhl.game.service.PenaltyValidator;

@RestController
@RequestMapping("${api.v1.prefix}/game-events")
@RequiredArgsConstructor
public class GameEventController {

    private final GameEventService gameEventService;
    private final GoalLimitValidator goalLimitValidator;
    private final PenaltyValidator penaltyValidator;

    @PostMapping("/validate-goal")
    public ResponseEntity<GoalValidationResponse> validateGoal(@RequestBody GoalValidationRequest request) {
        GoalValidationResponse response = goalLimitValidator.validateGoal(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/validate-penalty")
    public ResponseEntity<PenaltyValidationResponse> validatePenalty(
            @RequestParam Long playerId,
            @RequestParam Long gameId) {
        PenaltyValidationResponse response = penaltyValidator.validatePenalty(playerId, gameId);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<GameEventDto.Response>> getEvents(
            @RequestParam Long gameId,
            @RequestParam(required = false) String eventType) {

        if (eventType != null) {
            return ResponseEntity.ok(gameEventService.getEventsByGameAndType(gameId, eventType));
        }

        return ResponseEntity.ok(gameEventService.getEventsByGame(gameId));
    }

    @GetMapping("/{eventId}")
    public ResponseEntity<GameEventDto.Response> getEvent(@PathVariable Long eventId) {
        return gameEventService.getEventById(eventId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createEvent(@Valid @RequestBody GameEventDto.Create eventDto) {
        GameEventDto.Response created = gameEventService.createEvent(eventDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/{eventId}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long eventId) {
        try {
            gameEventService.deleteEvent(eventId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
