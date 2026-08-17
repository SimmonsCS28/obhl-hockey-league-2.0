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

@Entity
@Table(name = "teams", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "name", "season_id" }),
        @UniqueConstraint(columnNames = { "abbreviation", "season_id" })
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 10)
    private String abbreviation;

    @Column(length = 500)
    private String logoUrl;

    @Column(length = 30)
    private String teamColor;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "gm_id")
    private Long gmId;

    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(nullable = false)
    private Integer points = 0;

    @Column(nullable = false)
    private Integer wins = 0;

    @Column(nullable = false)
    private Integer losses = 0;

    @Column(nullable = false)
    private Integer ties = 0;

    @Column(name = "overtime_wins", nullable = false)
    private Integer overtimeWins = 0;

    @Column(name = "overtime_losses", nullable = false)
    private Integer overtimeLosses = 0;

    @Column(name = "goals_for", nullable = false)
    private Integer goalsFor = 0;

    @Column(name = "goals_against", nullable = false)
    private Integer goalsAgainst = 0;

    // --- Tournament fields (migration 049). Null for league teams. ---
    // The standings columns above are league-shaped and are NOT written for tournament games;
    // tournament standings are computed on read by TournamentStandingsService. Tournament UI must
    // never read points/wins/losses off this row.

    /** Bracket seed, derived from group standings when group play closes. */
    @Column(name = "seed")
    private Integer seed;

    /** The tournament GM/captain as a players row. Distinct from gmId, which is a user account. */
    @Column(name = "captain_player_id")
    private Long captainPlayerId;

    /** Division label ('A', 'B', ...) when the tournament runs divisions. */
    @Column(name = "pool", length = 10)
    private String pool;

    @Column(name = "eliminated", nullable = false)
    private Boolean eliminated = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
