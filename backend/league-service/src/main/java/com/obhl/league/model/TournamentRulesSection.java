package com.obhl.league.model;

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
 * One section of a tournament's rules.
 *
 * Deliberately a separate table from the league's rules_sections: reusing that one would add
 * another place the league Rules page has to remember to filter, for a handful of rows. Scoped per
 * tournament because these rules follow the format — the overtime and tiebreaker rules for a
 * round-robin year are not the ones for a bracket year.
 */
@Entity
@Table(name = "tournament_rules_sections")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TournamentRulesSection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tournament_id", nullable = false)
    private Long tournamentId;

    @Column(nullable = false)
    private String title;

    /** Rich-text HTML, same as the league rules editor produces. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content = "";

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
