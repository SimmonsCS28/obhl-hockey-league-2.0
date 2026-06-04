package com.obhl.league.repository;

import com.obhl.league.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Integer> {

    // All announcements, newest first
    List<Announcement> findAllByOrderByCreatedAtDesc();

    // Active announcements within their date range
    @Query("SELECT a FROM Announcement a WHERE a.isActive = true " +
           "AND (a.startDate IS NULL OR a.startDate <= :today) " +
           "AND (a.endDate IS NULL OR a.endDate >= :today) " +
           "ORDER BY a.createdAt DESC")
    List<Announcement> findActiveWithinDateRange(@Param("today") LocalDate today);
}
