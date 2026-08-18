package com.obhl.league.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "seasons")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Season {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(nullable = false, length = 20)
    private String status = "upcoming";

    /**
     * LEAGUE or TOURNAMENT. A tournament (The Conley Classic) is backed by its own season row so its
     * teams, players and games can be ordinary season-scoped rows, but it must stay out of league
     * season lists -- see TYPE_LEAGUE / TYPE_TOURNAMENT and the default-deny filter on
     * GET /seasons. A tournament season is never is_active; the database enforces that with
     * chk_tournament_never_active (migration 046).
     */
    @Column(nullable = false, length = 20)
    private String type = TYPE_LEAGUE;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = false;

    public static final String TYPE_LEAGUE = "LEAGUE";
    public static final String TYPE_TOURNAMENT = "TOURNAMENT";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
