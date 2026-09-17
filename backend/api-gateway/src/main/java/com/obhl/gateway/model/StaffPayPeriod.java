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
 * One season's staff pay cycle. Created on first finalize; walks DRAFT, FINALIZED, SENT.
 * Re-finalizing after SENT drops it back to FINALIZED so a corrected workbook can go out.
 */
@Entity
@Table(name = "staff_pay_periods",
        uniqueConstraints = @UniqueConstraint(name = "uq_staff_pay_periods_season",
                columnNames = { "season_id" }))
@Data
@NoArgsConstructor
public class StaffPayPeriod {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_FINALIZED = "FINALIZED";
    public static final String STATUS_SENT = "SENT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(name = "status", nullable = false, length = 20)
    private String status = STATUS_DRAFT;

    /** Workbook title, e.g. "OBHL Fall 2026 C League (Cole Simmons)". Set at finalize. */
    @Column(name = "title", length = 200)
    private String title;

    @Column(name = "finalized_at")
    private LocalDateTime finalizedAt;

    @Column(name = "finalized_by")
    private Long finalizedBy;

    @Column(name = "confirmations_sent_at")
    private LocalDateTime confirmationsSentAt;

    @Column(name = "report_sent_at")
    private LocalDateTime reportSentAt;

    @Column(name = "report_sent_to", length = 255)
    private String reportSentTo;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
