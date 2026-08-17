package com.obhl.league.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** An entrant assigned to a team. */
@Entity
@Table(name = "tournament_draft_picks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TournamentDraftPick {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tournament_id", nullable = false)
    private Long tournamentId;

    @Column(name = "entrant_id", nullable = false)
    private Long entrantId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    /**
     * Monotonic sequence for undo and audit only. This draft has no pick order, so this records
     * WHEN someone was assigned, never whose turn it was.
     */
    @Column(name = "pick_number", nullable = false)
    private Integer pickNumber;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
