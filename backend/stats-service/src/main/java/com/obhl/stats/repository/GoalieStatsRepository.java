package com.obhl.stats.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import main.java.com.obhl.stats.model.GoalieStats;

@Repository
public interface GoalieStatsRepository extends JpaRepository<GoalieStats, Long> {

    Optional<GoalieStats> findByPlayerIdAndSeasonId(Long playerId, Long seasonId);

    List<GoalieStats> findBySeasonId(Long seasonId);

    List<GoalieStats> findBySeasonIdOrderBySavePercentageDesc(Long seasonId);

    List<GoalieStats> findByTeamIdAndSeasonId(Long teamId, Long seasonId);
}
