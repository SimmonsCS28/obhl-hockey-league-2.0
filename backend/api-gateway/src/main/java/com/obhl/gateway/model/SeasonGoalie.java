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
 * Per-season goalie roster row (see migration 043). Keyed by user_id — the same key
 * games.goalie1_id/goalie2_id use — so the weekly auto-proposer works on user ids directly.
 *   is_fulltime = true  -> a full-time goalie the auto-proposer schedules each week
 *   is_fulltime = false -> a substitute who only fills in ad hoc (never auto-assigned)
 * Skill rating is NOT stored here; it lives on the players row (crossed via email).
 */
@Entity
@Table(name = "season_goalies")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeasonGoalie {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "is_fulltime", nullable = false)
    private Boolean isFulltime = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
