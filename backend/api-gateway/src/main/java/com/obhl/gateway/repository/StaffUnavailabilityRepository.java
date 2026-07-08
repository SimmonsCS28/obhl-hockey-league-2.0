package com.obhl.gateway.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.StaffUnavailability;

@Repository
public interface StaffUnavailabilityRepository extends JpaRepository<StaffUnavailability, Long> {

    List<StaffUnavailability> findByRole(String role);

    List<StaffUnavailability> findByUserIdAndRole(Long userId, String role);

    Optional<StaffUnavailability> findByUserIdAndRoleAndUnavailableDate(Long userId, String role,
            LocalDate unavailableDate);
}
