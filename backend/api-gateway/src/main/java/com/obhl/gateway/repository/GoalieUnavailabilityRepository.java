package com.obhl.gateway.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.GoalieUnavailability;

@Repository
public interface GoalieUnavailabilityRepository extends JpaRepository<GoalieUnavailability, Long> {

    List<GoalieUnavailability> findByUserId(Long userId);

    List<GoalieUnavailability> findByUserIdAndUnavailableDateBetween(Long userId, LocalDate startDate,
            LocalDate endDate);

    Optional<GoalieUnavailability> findByUserIdAndUnavailableDate(Long userId, LocalDate unavailableDate);

    void deleteByUserIdAndUnavailableDate(Long userId, LocalDate unavailableDate);
}
