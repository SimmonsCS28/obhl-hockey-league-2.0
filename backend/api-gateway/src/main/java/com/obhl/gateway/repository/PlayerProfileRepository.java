package com.obhl.gateway.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.PlayerProfile;

@Repository
public interface PlayerProfileRepository extends JpaRepository<PlayerProfile, Long> {

    /** Callers must pass an already-lowercased, trimmed email — see PlayerProfileService.normalizeEmail. */
    Optional<PlayerProfile> findByEmailLower(String emailLower);
}
