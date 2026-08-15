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
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One coordinator's notification choices for one role.
 *
 * <p>A missing row means defaults — declines on, confirms off, no address override — so this table
 * only ever holds deliberate choices and no backfill is needed for coordinators appointed later.
 *
 * <p>There is no field for the drop notice on purpose: someone giving up a shift they had already
 * confirmed is the one notice that cannot be switched off.
 *
 * <p>The unique constraint is declared here as well as in migration 045 because api-gateway runs
 * {@code ddl-auto=update} — if this service boots before the migration is applied, Hibernate creates
 * the table from this class, the migration's {@code CREATE TABLE IF NOT EXISTS} then no-ops, and a
 * constraint declared only in SQL would never exist.
 */
@Entity
@Table(name = "coordinator_notification_prefs",
        uniqueConstraints = @UniqueConstraint(name = "uq_coord_notify_prefs_user_role",
                columnNames = { "user_id", "role" }))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CoordinatorNotificationPref {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** GOALIE | REF | SCOREKEEPER — the shift role, matching {@code shift_assignments.role}. */
    @Column(name = "role", nullable = false, length = 20)
    private String role;

    @Column(name = "notify_on_decline", nullable = false)
    private Boolean notifyOnDecline = true;

    @Column(name = "notify_on_confirm", nullable = false)
    private Boolean notifyOnConfirm = false;

    /** Null sends to the account's own address. Never a copy of it — that would go stale. */
    @Column(name = "email_override", length = 255)
    private String emailOverride;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
