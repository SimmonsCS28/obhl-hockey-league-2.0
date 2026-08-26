package com.obhl.game.model;

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

@Entity
@Table(name = "games")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "season_id", nullable = false)
    private Long seasonId;

    @Column(name = "league_id")
    private Long leagueId;

    @Column(name = "home_team_id", nullable = false)
    private Long homeTeamId;

    @Column(name = "away_team_id", nullable = false)
    private Long awayTeamId;

    @Column(name = "game_date", nullable = false)
    private LocalDateTime gameDate;

    @Column(length = 200)
    private String venue;

    @Column(nullable = false, length = 20)
    private String status = "scheduled";

    @Column(name = "home_score")
    private Integer homeScore = 0;

    @Column(name = "away_score")
    private Integer awayScore = 0;

    @Column
    private Boolean overtime = false;

    @Column
    private Boolean shootout = false;

    @Column
    private Integer period = 1;

    @Column(name = "game_type", length = 20, nullable = false)
    private String gameType = "REGULAR_SEASON";

    @Column(name = "week")
    private Integer week;

    @Column(name = "playoff_round", length = 20)
    private String playoffRound; // "QUARTERFINAL", "SEMIFINAL", "FINAL" — null for regular season

    @Column(name = "bracket_position")
    private Integer bracketPosition; // 1-indexed position within the playoff round

    /**
     * Playoff seeds of the two participants, 1 = best regular season record.
     *
     * <p>Frozen when the bracket is initialized and carried forward as each round is re-seeded, so
     * a later round can pair survivors by seed without recomputing standings — and so re-finalizing
     * a regular season game cannot renumber a bracket already under way. Null for anything that is
     * not a league bracket game, and for brackets created before the column existed.
     */
    @Column(name = "home_seed")
    private Integer homeSeed;

    @Column(name = "away_seed")
    private Integer awaySeed;

    /** POOL | ROUND_ROBIN | BRACKET | PLACEMENT | CONSOLATION — null for league games. */
    @Column(name = "tournament_stage", length = 20)
    private String tournamentStage;

    /**
     * Regulation periods this game was played under. Null for league games (3 + OT). Read by
     * tournament scoring rather than the tournament config, so reconfiguring a tournament cannot
     * rescore games already played.
     */
    @Column(name = "period_count")
    private Short periodCount;

    /**
     * Length of a regulation period in minutes. Null for league games (20). Read by the scorekeeper
     * clock in preference to the tournament config, for the same reason as periodCount: a game keeps
     * the rules it was played under.
     */
    @Column(name = "period_minutes")
    private Short periodMinutes;

    @Column(name = "rink", length = 20)
    private String rink;

    @Column(name = "ended_in_ot")
    private Boolean endedInOT = false;

    @Column(name = "forfeit_team_id")
    private Long forfeitTeamId;

    @Column(name = "home_team_points")
    private Integer homeTeamPoints = 0;

    @Column(name = "away_team_points")
    private Integer awayTeamPoints = 0;

    @Column(name = "game_notes", columnDefinition = "TEXT")
    private String gameNotes;

    @Column(name = "goalie1_id")
    private Long goalie1Id;

    @Column(name = "goalie2_id")
    private Long goalie2Id;

    @Column(name = "referee1_id")
    private Long referee1Id;

    @Column(name = "referee2_id")
    private Long referee2Id;

    @Column(name = "scorekeeper_id")
    private Long scorekeeperId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
