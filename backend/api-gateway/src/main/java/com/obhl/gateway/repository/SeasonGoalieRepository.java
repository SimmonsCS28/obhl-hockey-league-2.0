package com.obhl.gateway.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.SeasonGoalie;

@Repository
public interface SeasonGoalieRepository extends JpaRepository<SeasonGoalie, Long> {

    List<SeasonGoalie> findBySeasonId(Long seasonId);

    /** The goalies the weekly auto-proposer schedules for a season. */
    List<SeasonGoalie> findBySeasonIdAndIsFulltimeTrue(Long seasonId);
}
