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

        // Auto-set game status to in_progress when events are added and update score
        gameRepository.findById(dto.getGameId()).ifPresent(game -> {
            boolean updated = false;
            if (!"completed".equals(game.getStatus())) {
                game.setStatus("in_progress");
                updated = true;
            }

            // Update score if event is a goal
            if ("goal".equalsIgnoreCase(dto.getEventType())) {
                if (game.getHomeTeamId().equals(dto.getTeamId())) {
                    game.setHomeScore(game.getHomeScore() == null ? 1 : game.getHomeScore() + 1);
                    updated = true;
                } else if (game.getAwayTeamId().equals(dto.getTeamId())) {
                    game.setAwayScore(game.getAwayScore() == null ? 1 : game.getAwayScore() + 1);
                    updated = true;
                }
            }

            if (updated) {
                gameRepository.save(game);
            }
        });

        return toResponse(gameEventRepository.save(event));
    }

    @Transactional
    public GameEventDto.Response updateEvent(Long id, GameEventDto.Update dto) {
        GameEvent event = gameEventRepository.findById(id)
                .orElseThrow(() -> new java.util.NoSuchElementException("Game event not found: " + id));

        Long oldTeamId = event.getTeamId();

        event.setTeamId(dto.getTeamId());
        event.setPlayerId(dto.getPlayerId());
        event.setPeriod(dto.getPeriod());
        event.setTimeMinutes(dto.getTimeMinutes());
        event.setTimeSeconds(dto.getTimeSeconds());
        event.setDescription(dto.getDescription());
        event.setAssist1PlayerId(dto.getAssist1PlayerId());
        event.setAssist2PlayerId(dto.getAssist2PlayerId());
        event.setPenaltyMinutes(dto.getPenaltyMinutes());

        GameEvent saved = gameEventRepository.save(event);

        // If a goal's team changed, move its goal from the old team's score to the new team's
        if ("goal".equalsIgnoreCase(saved.getEventType()) && !dto.getTeamId().equals(oldTeamId)) {
            gameRepository.findById(saved.getGameId()).ifPresent(game -> {
                if (oldTeamId.equals(game.getHomeTeamId()) && game.getHomeScore() != null && game.getHomeScore() > 0) {
                    game.setHomeScore(game.getHomeScore() - 1);
                } else if (oldTeamId.equals(game.getAwayTeamId()) && game.getAwayScore() != null && game.getAwayScore() > 0) {
                    game.setAwayScore(game.getAwayScore() - 1);
                }

                if (dto.getTeamId().equals(game.getHomeTeamId())) {
                    game.setHomeScore((game.getHomeScore() == null ? 0 : game.getHomeScore()) + 1);
                } else if (dto.getTeamId().equals(game.getAwayTeamId())) {
                    game.setAwayScore((game.getAwayScore() == null ? 0 : game.getAwayScore()) + 1);
                }

                gameRepository.save(game);
            });
        }

        return toResponse(saved);
    }

    @Transactional
    public void deleteEvent(Long id) {
        GameEvent event = gameEventRepository.findById(id)
                .orElseThrow(() -> new java.util.NoSuchElementException("Game event not found: " + id));

        gameEventRepository.deleteById(id);

        // Mirror createEvent's score bookkeeping so the game score stays consistent after a goal is removed
        if ("goal".equalsIgnoreCase(event.getEventType())) {
            gameRepository.findById(event.getGameId()).ifPresent(game -> {
                if (event.getTeamId().equals(game.getHomeTeamId()) && game.getHomeScore() != null && game.getHomeScore() > 0) {
                    game.setHomeScore(game.getHomeScore() - 1);
                    gameRepository.save(game);
                } else if (event.getTeamId().equals(game.getAwayTeamId()) && game.getAwayScore() != null && game.getAwayScore() > 0) {
                    game.setAwayScore(game.getAwayScore() - 1);
                    gameRepository.save(game);
                }
            });
        }
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
