package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.CoordinatorNotificationPref;

@Repository
public interface CoordinatorNotificationPrefRepository extends JpaRepository<CoordinatorNotificationPref, Long> {

    Optional<CoordinatorNotificationPref> findByUserIdAndRole(Long userId, String role);

    /** Every role's preferences for one person — drives the settings panel. */
    List<CoordinatorNotificationPref> findByUserId(Long userId);

    /** All deliberate choices for a role; anyone without a row here is on defaults. */
    List<CoordinatorNotificationPref> findByRole(String role);
}
