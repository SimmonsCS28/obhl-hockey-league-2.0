package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.GoalieAvailability;

@Repository
public interface GoalieAvailabilityRepository extends JpaRepository<GoalieAvailability, Long> {

    List<GoalieAvailability> findByUserIdAndSeasonId(Long userId, Long seasonId);

    Optional<GoalieAvailability> findByUserIdAndSeasonIdAndWeek(Long userId, Long seasonId, Integer week);

    List<GoalieAvailability> findBySeasonIdAndWeek(Long seasonId, Integer week);
}
