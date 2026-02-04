package com.obhl.gateway.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.GoalieProfile;

@Repository
public interface GoalieProfileRepository extends JpaRepository<GoalieProfile, Long> {

    Optional<GoalieProfile> findByUserId(Long userId);
}
