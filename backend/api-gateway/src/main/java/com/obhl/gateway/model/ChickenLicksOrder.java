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
 * A Chicken Licks food order — either PERSONAL (one user) or TEAM (shared,
 * attributed per-person via {@link ChickenLicksOrderItem}). team_id is
 * snapshotted on both types so a personal order still counts toward its
 * owner's team on the Standings page; it's null for users with no team.
 */
@Entity
@Table(name = "chicken_licks_orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChickenLicksOrder {

    public static final String TYPE_PERSONAL = "PERSONAL";
    public static final String TYPE_TEAM = "TEAM";

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_PLACED = "PLACED";
    public static final String STATUS_CLOSED = "CLOSED";
    public static final String STATUS_CANCELLED = "CANCELLED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_type", nullable = false, length = 20)
    private String orderType;

    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "team_name")
    private String teamName;

    @Column(name = "initiator_email", nullable = false)
    private String initiatorEmail;

    @Column(name = "initiator_name")
    private String initiatorName;

    @Column(name = "status", nullable = false, length = 20)
    private String status = STATUS_OPEN;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;
}
