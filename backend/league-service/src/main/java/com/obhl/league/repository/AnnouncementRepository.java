package com.obhl.league.repository;

import com.obhl.league.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Integer> {
    List<Announcement> findAllByIsActiveTrueOrderByCreatedAtDesc();
    List<Announcement> findAllByOrderByCreatedAtDesc();
    List<Announcement> findByIsActiveTrueAndCreatedAtBefore(java.time.LocalDateTime date);
}
