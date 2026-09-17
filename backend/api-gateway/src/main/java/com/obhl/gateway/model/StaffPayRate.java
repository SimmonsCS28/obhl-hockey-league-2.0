package com.obhl.gateway.model;

import java.time.LocalDateTime;

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
 * What one person is paid per game in one staff role. Refs are tiered by certification
 * ($20 / $30 / $40), scorekeepers are a flat $15; a person holding both roles has two rows.
 * Zero is a valid, deliberate rate ("doesn't want to be paid") and is distinct from no row.
 *
 * <p>Unique constraint duplicated from migration 067 for the same ddl-auto reason as
 * {@link CoordinatorNotificationPref}.
 */
@Entity
@Table(name = "staff_pay_rates",
        uniqueConstraints = @UniqueConstraint(name = "uq_staff_pay_rates_user_role",
                columnNames = { "user_id", "role" }))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StaffPayRate {

    public static final String ROLE_REF = "REF";
    public static final String ROLE_SCOREKEEPER = "SCOREKEEPER";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** REF | SCOREKEEPER */
    @Column(name = "role", nullable = false, length = 20)
    private String role;

    @Column(name = "rate_cents", nullable = false)
    private Integer rateCents;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;
}
