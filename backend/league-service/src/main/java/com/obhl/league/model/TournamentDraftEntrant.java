package com.obhl.league.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Somebody who signed up, before commit turns them into a players row.
 *
 * Separate from players so the board stays freely mutable during the draft -- reassign, unassign,
 * re-import -- without churning real rows or fighting players' UNIQUE(email, season_id).
 */
@Entity
@Table(name = "tournament_draft_entrants")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TournamentDraftEntrant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tournament_id", nullable = false)
    private Long tournamentId;

    @Column(name = "first_name", nullable = false, length = 50)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 50)
    private String lastName;

    /** Nullable, unlike players.email. Commit generates a placeholder for entrants without one. */
    @Column(length = 255)
    private String email;

    @Column(length = 40)
    private String phone;

    @Column(length = 10)
    private String position;

    @Column(name = "jersey_number")
    private Integer jerseyNumber;

    @Column(name = "skill_rating")
    private Integer skillRating;

    /** Designated before the draft; seated one per team by the Place GMs action. */
    @Column(name = "is_gm", nullable = false)
    private Boolean isGm = false;

    @Column(nullable = false)
    private Boolean paid = false;

    /** NULL is a normal, permanent state -- the tournament works with zero accounts linked. */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "link_status", nullable = false, length = 20)
    private String linkStatus = LINK_UNMATCHED;

    @Column(length = 280)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Not yet checked against accounts. */
    public static final String LINK_UNMATCHED = "unmatched";
    /** Exactly one account matched; awaiting operator confirmation. */
    public static final String LINK_MATCHED = "matched";
    /** More than one account matched. Never linked automatically. */
    public static final String LINK_AMBIGUOUS = "ambiguous";
    /** Operator confirmed the link. */
    public static final String LINK_CONFIRMED = "confirmed";
    /** Checked, and there is genuinely no account. Distinct from "not yet checked". */
    public static final String LINK_NONE = "none";
}
