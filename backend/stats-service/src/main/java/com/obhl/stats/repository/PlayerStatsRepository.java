package com.obhl.stats.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import main.java.com.obhl.stats.model.PlayerStats;

@Repository
public interface PlayerStatsRepository extends JpaRepository<PlayerStats, Long> {

    Optional<PlayerStats> findByPlayerIdAndSeasonId(Long playerId, Long seasonId);

    List<PlayerStats> findBySeasonId(Long seasonId);

    List<PlayerStats> findBySeasonIdOrderByPointsDesc(Long seasonId);

    List<PlayerStats> findByTeamIdAndSeasonId(Long teamId, Long seasonId);
}
