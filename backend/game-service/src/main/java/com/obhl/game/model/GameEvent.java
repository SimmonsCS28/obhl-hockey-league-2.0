package com.obhl.game.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "game_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(name = "player_id")
    private Long playerId;

    @Column(name = "event_type", nullable = false, length = 20)
    private String eventType;

    @Column(nullable = false)
    private Integer period;

    @Column(name = "time_minutes", nullable = false)
    private Integer timeMinutes;

    @Column(name = "time_seconds", nullable = false)
    private Integer timeSeconds;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "assist1_player_id")
    private Long assist1PlayerId;

    @Column(name = "assist2_player_id")
    private Long assist2PlayerId;

    @Column(name = "penalty_minutes")
    private Integer penaltyMinutes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
