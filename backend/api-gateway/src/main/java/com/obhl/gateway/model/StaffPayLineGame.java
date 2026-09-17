package com.obhl.gateway.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One game behind a {@link StaffPayLine}, frozen at finalize so the emailed list stays stable. */
@Entity
@Table(name = "staff_pay_line_games")
@Data
@NoArgsConstructor
public class StaffPayLineGame {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "line_id", nullable = false)
    private Long lineId;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    /** UTC, same convention as games.game_date. */
    @Column(name = "game_date")
    private LocalDateTime gameDate;

    @Column(name = "matchup", length = 200)
    private String matchup;

    @Column(name = "solo", nullable = false)
    private Boolean solo = false;
}
