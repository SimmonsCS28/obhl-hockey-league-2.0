package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.StaffPayRate;

@Repository
public interface StaffPayRateRepository extends JpaRepository<StaffPayRate, Long> {
    List<StaffPayRate> findByRole(String role);
    Optional<StaffPayRate> findByUserIdAndRole(Long userId, String role);
}
