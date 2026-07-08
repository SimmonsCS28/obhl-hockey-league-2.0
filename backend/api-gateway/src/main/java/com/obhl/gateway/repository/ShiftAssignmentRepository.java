package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.ShiftAssignment;

@Repository
public interface ShiftAssignmentRepository extends JpaRepository<ShiftAssignment, Long> {

    List<ShiftAssignment> findBySeasonIdAndRole(Long seasonId, String role);

    List<ShiftAssignment> findByGameId(Long gameId);

    List<ShiftAssignment> findByGameIdInAndRole(List<Long> gameIds, String role);

    List<ShiftAssignment> findByUserIdAndStatus(Long userId, String status);

    Optional<ShiftAssignment> findByGameIdAndRoleAndSlot(Long gameId, String role, Integer slot);

    Optional<ShiftAssignment> findByConfirmTokenHash(String confirmTokenHash);
}
