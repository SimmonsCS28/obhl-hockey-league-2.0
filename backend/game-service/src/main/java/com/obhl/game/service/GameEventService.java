package com.obhl.game.service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.game.dto.GameEventDto;
import com.obhl.game.model.GameEvent;
import com.obhl.game.repository.GameEventRepository;
import com.obhl.game.repository.GameRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GameEventService {

    private final GameEventRepository gameEventRepository;
    private final GameRepository gameRepository;

    @Transactional(readOnly = true)
    public List<GameEventDto.Response> getEventsByGame(Long gameId) {
        return gameEventRepository.findByGameIdOrderByPeriodAscTimeMinutesAscTimeSecondsAsc(gameId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameEventDto.Response> getEventsByGameAndType(Long gameId, String eventType) {
        return gameEventRepository.findByGameIdAndEventType(gameId, eventType)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<GameEventDto.Response> getEventById(Long id) {
        return gameEventRepository.findById(id).map(this::toResponse);
    }

    @Transactional
    public GameEventDto.Response createEvent(GameEventDto.Create dto) {
        GameEvent event = new GameEvent();
        event.setGameId(dto.getGameId());
        event.setTeamId(dto.getTeamId());
        event.setPlayerId(dto.getPlayerId());
        event.setEventType(dto.getEventType());
        event.setPeriod(dto.getPeriod());
        event.setTimeMinutes(dto.getTimeMinutes());
        event.setTimeSeconds(dto.getTimeSeconds());
        event.setDescription(dto.getDescription());
        event.setAssist1PlayerId(dto.getAssist1PlayerId());
        event.setAssist2PlayerId(dto.getAssist2PlayerId());
        event.setPenaltyMinutes(dto.getPenaltyMinutes());

        // Auto-set game status to in_progress when events are added
        gameRepository.findById(dto.getGameId()).ifPresent(game -> {
            if (!"completed".equals(game.getStatus())) {
                game.setStatus("in_progress");
                gameRepository.save(game);
            }
        });

        return toResponse(gameEventRepository.save(event));
    }

    @Transactional
    public void deleteEvent(Long id) {
        gameEventRepository.deleteById(id);
    }

    private GameEventDto.Response toResponse(GameEvent event) {
        GameEventDto.Response dto = new GameEventDto.Response();
        dto.setId(event.getId());
        dto.setGameId(event.getGameId());
        dto.setTeamId(event.getTeamId());
        dto.setPlayerId(event.getPlayerId());
        dto.setEventType(event.getEventType());
        dto.setPeriod(event.getPeriod());
        dto.setTimeMinutes(event.getTimeMinutes());
        dto.setTimeSeconds(event.getTimeSeconds());
        dto.setDescription(event.getDescription());
        dto.setAssist1PlayerId(event.getAssist1PlayerId());
        dto.setAssist2PlayerId(event.getAssist2PlayerId());
        dto.setPenaltyMinutes(event.getPenaltyMinutes());
        dto.setCreatedAt(event.getCreatedAt());
        return dto;
    }
}
