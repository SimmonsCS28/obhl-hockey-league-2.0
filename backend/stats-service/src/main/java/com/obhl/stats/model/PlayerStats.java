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
@Table(name = "player_stats")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerStats {

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

    @Column(nullable = false)
    private Integer goals = 0;

    @Column(nullable = false)
    private Integer assists = 0;

    @Column(nullable = false)
    private Integer points = 0;

    @Column(name = "plus_minus", nullable = false)
    private Integer plusMinus = 0;

    @Column(name = "penalty_minutes", nullable = false)
    private Integer penaltyMinutes = 0;

    @Column(name = "power_play_goals", nullable = false)
    private Integer powerPlayGoals = 0;

    @Column(name = "power_play_assists", nullable = false)
    private Integer powerPlayAssists = 0;

    @Column(name = "short_handed_goals", nullable = false)
    private Integer shortHandedGoals = 0;

    @Column(name = "short_handed_assists", nullable = false)
    private Integer shortHandedAssists = 0;

    @Column(name = "game_winning_goals", nullable = false)
    private Integer gameWinningGoals = 0;

    @Column(nullable = false)
    private Integer shots = 0;

    @Column(name = "shooting_percentage", precision = 5, scale = 2)
    private BigDecimal shootingPercentage = BigDecimal.ZERO;

    @Column(name = "faceoff_wins", nullable = false)
    private Integer faceoffWins = 0;

    @Column(name = "faceoff_losses", nullable = false)
    private Integer faceoffLosses = 0;

    @Column(nullable = false)
    private Integer hits = 0;

    @Column(name = "blocked_shots", nullable = false)
    private Integer blockedShots = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
