package com.obhl.gateway.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.GoalieAvailability;

@Repository
public interface GoalieAvailabilityRepository extends JpaRepository<GoalieAvailability, Long> {

    List<GoalieAvailability> findByUserIdAndSeasonId(Long userId, Long seasonId);

    Optional<GoalieAvailability> findByUserIdAndSeasonIdAndGameDate(Long userId, Long seasonId, LocalDate gameDate);

    /** One row per game night that week — callers wanting a goalie's whole-week view must aggregate. */
    List<GoalieAvailability> findBySeasonIdAndWeek(Long seasonId, Integer week);
}
