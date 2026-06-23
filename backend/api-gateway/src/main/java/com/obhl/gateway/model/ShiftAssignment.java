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
 * A coordinator's PROPOSED assignment of a goalie/ref to a specific game slot,
 * which the assigned user confirms or declines. On publish, CONFIRMED rows are
 * written onto the game's slot columns (game-service).
 */
@Entity
@Table(name = "shift_assignments")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShiftAssignment {

    public static final String STATUS_SIGNED_UP = "SIGNED_UP";  // official self-signed; awaiting coordinator Confirm
    public static final String STATUS_PROPOSED = "PROPOSED";    // coordinator-assigned; awaiting the person's accept
    public static final String STATUS_CONFIRMED = "CONFIRMED";
    public static final String STATUS_DECLINED = "DECLINED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(name = "season_id")
    private Long seasonId;

    @Column(name = "role", nullable = false, length = 20)
    private String role; // GOALIE | REF

    @Column(name = "slot", nullable = false)
    private Integer slot; // 1 or 2

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "status", nullable = false, length = 20)
    private String status = STATUS_PROPOSED;

    @Column(name = "published", nullable = false)
    private Boolean published = false;

    @Column(name = "confirm_token_hash")
    private String confirmTokenHash;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Column(name = "decline_reason", length = 500)
    private String declineReason;

    @Column(name = "assigned_by")
    private Long assignedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;
}
