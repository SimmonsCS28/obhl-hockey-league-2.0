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

    boolean existsBySeasonId(Long seasonId);

    @org.springframework.data.jpa.repository.Query("SELECT g FROM Game g WHERE g.seasonId = :seasonId AND (g.homeTeamId = :teamId OR g.awayTeamId = :teamId) ORDER BY g.gameDate")
    List<Game> findBySeasonIdAndTeam(@org.springframework.data.repository.query.Param("seasonId") Long seasonId,
            @org.springframework.data.repository.query.Param("teamId") Long teamId);
}
