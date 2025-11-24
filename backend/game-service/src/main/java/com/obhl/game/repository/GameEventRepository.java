package com.obhl.game.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.game.model.GameEvent;

@Repository
public interface GameEventRepository extends JpaRepository<GameEvent, Long> {

    List<GameEvent> findByGameId(Long gameId);

    List<GameEvent> findByGameIdOrderByPeriodAscTimeMinutesAscTimeSecondsAsc(Long gameId);

    List<GameEvent> findByGameIdAndEventType(Long gameId, String eventType);

    List<GameEvent> findByPlayerId(Long playerId);

    List<GameEvent> findByTeamId(Long teamId);
}
