package com.obhl.stats.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "goalie_stats")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalieStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(name = "games_played", nullable = false)
    private Integer gamesPlayed = 0;

    @Column(name = "games_started", nullable = false)
    private Integer gamesStarted = 0;

    @Column(nullable = false)
    private Integer wins = 0;

    @Column(nullable = false)
    private Integer losses = 0;

    @Column(name = "overtime_losses", nullable = false)
    private Integer overtimeLosses = 0;

    @Column(nullable = false)
    private Integer shutouts = 0;

    @Column(nullable = false)
    private Integer saves = 0;

    @Column(name = "shots_against", nullable = false)
    private Integer shotsAgainst = 0;

    @Column(name = "goals_against", nullable = false)
    private Integer goalsAgainst = 0;

    @Column(name = "save_percentage", precision = 5, scale = 3)
    private BigDecimal savePercentage = BigDecimal.ZERO;

    @Column(name = "goals_against_average", precision = 4, scale = 2)
    private BigDecimal goalsAgainstAverage = BigDecimal.ZERO;

    @Column(name = "minutes_played", nullable = false)
    private Integer minutesPlayed = 0;

    @Column(name = "penalty_minutes", nullable = false)
    private Integer penaltyMinutes = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
