package com.obhl.gateway.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.StaffPayPeriod;

@Repository
public interface StaffPayPeriodRepository extends JpaRepository<StaffPayPeriod, Long> {
    Optional<StaffPayPeriod> findBySeasonId(Long seasonId);
}
