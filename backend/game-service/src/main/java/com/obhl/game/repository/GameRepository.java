package com.obhl.game.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.game.model.Game;

@Repository
public interface GameRepository extends JpaRepository<Game, Long> {

    List<Game> findBySeasonId(Long seasonId);

    List<Game> findBySeasonIdOrderByGameDateDesc(Long seasonId);

    List<Game> findByStatus(String status);

    List<Game> findByHomeTeamIdOrAwayTeamId(Long homeTeamId, Long awayTeamId);

    List<Game> findByGameDateBetween(LocalDateTime startDate, LocalDateTime endDate);

    List<Game> findByHomeTeamIdAndAwayTeamId(Long homeTeamId, Long awayTeamId);
}
