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
import jakarta.persistence.UniqueConstraint;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One person's snapshotted totals for one role in one pay period, plus where they are in
 * confirming them. {@code games} already counts a solo-reffed game twice (that is how the
 * rink's sheet expresses double pay) and {@code soloGames} says how many of those there were.
 *
 * <p>The confirm token works exactly like the one on {@link ShiftAssignment}: BCrypt hash of a
 * random string that only ever lives in the emailed link, burned on first use.
 */
@Entity
@Table(name = "staff_pay_lines",
        uniqueConstraints = @UniqueConstraint(name = "uq_staff_pay_lines_period_user_role",
                columnNames = { "period_id", "user_id", "role" }))
@Data
@NoArgsConstructor
public class StaffPayLine {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_CONFIRMED = "CONFIRMED";
    public static final String STATUS_DISPUTED = "DISPUTED";
    public static final String STATUS_ADMIN_CONFIRMED = "ADMIN_CONFIRMED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "period_id", nullable = false)
    private Long periodId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "role", nullable = false, length = 20)
    private String role;

    @Column(name = "games", nullable = false)
    private Integer games = 0;

    @Column(name = "solo_games", nullable = false)
    private Integer soloGames = 0;

    @Column(name = "rate_cents", nullable = false)
    private Integer rateCents = 0;

    @Column(name = "total_cents", nullable = false)
    private Integer totalCents = 0;

    @Column(name = "confirm_status", nullable = false, length = 20)
    private String confirmStatus = STATUS_PENDING;

    @Column(name = "confirm_token_hash", length = 255)
    private String confirmTokenHash;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Column(name = "email_sent_at")
    private LocalDateTime emailSentAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @Column(name = "dispute_note", columnDefinition = "TEXT")
    private String disputeNote;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Confirmed by the person or by the admin on their behalf: nothing left to wait for. */
    public boolean isResolved() {
        return STATUS_CONFIRMED.equals(confirmStatus) || STATUS_ADMIN_CONFIRMED.equals(confirmStatus);
    }
}
