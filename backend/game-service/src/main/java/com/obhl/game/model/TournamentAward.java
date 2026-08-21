package com.obhl.game.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Chocolate Milk Player of the Game.
 *
 * A long-standing tournament tradition: after every game a carton of chocolate milk goes to the
 * player on the opposing bench who showed the best sportsmanship. Each captain names one player
 * from the OTHER bench, which is why the unique key is (game, type, awarding team) rather than
 * just (game, type).
 */
@Entity
@Table(name = "tournament_awards")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TournamentAward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    /** Denormalised from the game so a tournament's award list is a single-table read. */
    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(name = "award_type", nullable = false, length = 30)
    private String awardType = CHOCOLATE_MILK;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    /** The recipient's team. */
    @Column(name = "team_id")
    private Long teamId;

    /** The bench that gave it — always the opposing one. */
    @Column(name = "awarded_by_team_id")
    private Long awardedByTeamId;

    @Column(length = 280)
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public static final String CHOCOLATE_MILK = "CHOCOLATE_MILK";
}
