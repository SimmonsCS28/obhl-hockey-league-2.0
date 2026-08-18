package com.obhl.league.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Draft state for one tournament. Operator-directed, so there is no round or on-the-clock team. */
@Entity
@Table(name = "tournament_drafts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TournamentDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tournament_id", nullable = false, unique = true)
    private Long tournamentId;

    @Column(nullable = false, length = 20)
    private String status = STATUS_SETUP;

    @Column(name = "committed_at")
    private LocalDateTime committedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Entrants being imported and linked to accounts. */
    public static final String STATUS_SETUP = "setup";
    /** Assignment board in use. */
    public static final String STATUS_LIVE = "live";
    /** players rows created; the board is frozen. */
    public static final String STATUS_COMMITTED = "committed";
}
