package com.obhl.game.model;

import java.time.LocalDateTime;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "penalty_tracking")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PenaltyTracking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(name = "penalty_count", nullable = false)
    private Integer penaltyCount = 0;

    @Column(name = "is_ejected")
    private Boolean isEjected = false;

    @Column(name = "is_suspended_next_game")
    private Boolean isSuspendedNextGame = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
