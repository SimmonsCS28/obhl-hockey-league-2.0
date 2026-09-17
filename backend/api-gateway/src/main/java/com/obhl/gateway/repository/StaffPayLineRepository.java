package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.StaffPayLine;

@Repository
public interface StaffPayLineRepository extends JpaRepository<StaffPayLine, Long> {
    List<StaffPayLine> findByPeriodId(Long periodId);
    Optional<StaffPayLine> findByPeriodIdAndUserIdAndRole(Long periodId, Long userId, String role);
}
