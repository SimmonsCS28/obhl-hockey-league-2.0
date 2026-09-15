package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.NotificationOptOut;

@Repository
public interface NotificationOptOutRepository extends JpaRepository<NotificationOptOut, Long> {

    Optional<NotificationOptOut> findByUserIdAndKind(Long userId, String kind);

    /** Everyone who has opted out of one kind — subtracted from the pool on every broadcast. */
    List<NotificationOptOut> findByKind(String kind);

    List<NotificationOptOut> findByUserId(Long userId);

    void deleteByUserIdAndKind(Long userId, String kind);
}
