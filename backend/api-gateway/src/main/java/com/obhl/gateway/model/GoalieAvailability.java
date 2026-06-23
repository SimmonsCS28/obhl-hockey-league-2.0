package com.obhl.gateway.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A goalie's positive availability for one week of a season (v3 Goalie Availability page).
 * Absence of a row means "not set".
 */
@Entity
@Table(name = "goalie_availability")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalieAvailability {

    public static final String STATUS_AVAILABLE = "AVAILABLE";
    public static final String STATUS_UNAVAILABLE = "UNAVAILABLE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(name = "week", nullable = false)
    private Integer week;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
