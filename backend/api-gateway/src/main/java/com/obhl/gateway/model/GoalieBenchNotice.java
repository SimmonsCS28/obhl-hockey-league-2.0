package com.obhl.gateway.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

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
 * The record that a week's bench notice — "you're not scheduled this week", to every full-time
 * goalie who drew no slot — has gone out (see migration 062). One row per (season, week).
 *
 * <p>Exists so that "have we already told the bench?" is a stored fact rather than something
 * inferred from the week's assignment statuses. The inference broke whenever a single slot was
 * proposed by hand before the bulk send: that one PROPOSED row made the week look like a top-up,
 * and the bench was silently never told.
 */
@Entity
@Table(name = "goalie_bench_notices")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalieBenchNotice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(name = "week", nullable = false)
    private Integer week;

    @CreationTimestamp
    @Column(name = "sent_at", updatable = false)
    private LocalDateTime sentAt;

    /** Whoever pressed Send; null if their account is later removed. */
    @Column(name = "sent_by")
    private Long sentBy;

    /** How many goalies Resend accepted a message for — not how many were eligible. */
    @Column(name = "recipient_count", nullable = false)
    private Integer recipientCount = 0;
}
