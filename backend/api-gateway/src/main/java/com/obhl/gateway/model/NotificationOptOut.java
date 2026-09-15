package com.obhl.gateway.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

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
 * One person's opt-out from one kind of broadcast email (see migration 066).
 *
 * <p>Presence means opted out; the default is subscribed and has no row. That keeps the recipient
 * list for a broadcast a subtraction from the pool, so nobody joining the pool later needs a row.
 *
 * <p>The unique constraint is declared here as well as in the migration because api-gateway runs
 * {@code ddl-auto=update}: if it boots before the migration is applied, Hibernate creates the table
 * from this class and the migration's {@code CREATE TABLE IF NOT EXISTS} then no-ops.
 */
@Entity
@Table(name = "notification_optouts",
        uniqueConstraints = @UniqueConstraint(name = "uq_notification_optouts_user_kind",
                columnNames = { "user_id", "kind" }))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationOptOut {

    /** A goalie declined/dropped a shift, or the coordinator alerted the pool about an open net. */
    public static final String KIND_GOALIE_OPEN_SPOT = "GOALIE_OPEN_SPOT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "kind", nullable = false, length = 40)
    private String kind;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
