package com.obhl.league.model;

import java.time.LocalDate;
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
 * One annual tournament (The Conley Classic).
 *
 * <p>Owns a {@link Season} of type TOURNAMENT via {@code seasonId}; that season holds the actual
 * teams, players and games, so they reuse Live Score Entry, staffing, finalize and the stats
 * pipeline. Everything here is configuration that has nowhere sensible to live on a season.
 *
 * <p>Follows the codebase convention of plain FK id fields rather than JPA relationships.
 */
@Entity
@Table(name = "tournaments")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Tournament {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "season_id", nullable = false, unique = true)
    private Long seasonId;

    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false)
    private Integer year;

    @Column(length = 200)
    private String tagline;

    // --- Format: three independent stages, not one enum. See migration 048 for why. ---

    @Column(name = "group_stage", nullable = false, length = 20)
    private String groupStage = GROUP_ROUND_ROBIN;

    @Column(name = "pool_count")
    private Integer poolCount;

    @Column(name = "advance_per_pool")
    private Integer advancePerPool = 2;

    @Column(name = "championship_stage", nullable = false, length = 20)
    private String championshipStage = CHAMPIONSHIP_SINGLE_ELIM;

    /** One extra game between the two semifinal losers. */
    @Column(name = "placement_game", nullable = false)
    private Boolean placementGame = false;

    @Column(name = "consolation_stage", nullable = false, length = 20)
    private String consolationStage = CONSOLATION_NONE;

    @Column(name = "consolation_team_count")
    private Integer consolationTeamCount;

    /**
     * Derived from the stage config at generation time, stored only so the public bracket page can
     * choose one of its three layouts. A rendering hint -- never read this as configuration.
     */
    @Column(name = "display_format", length = 20)
    private String displayFormat;

    // --- Weekend details ---

    @Column(name = "team_count", nullable = false)
    private Integer teamCount = 8;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(length = 150)
    private String venue = "Sun Prairie Ice Arena";

    @Column(name = "entry_fee_cents")
    private Integer entryFeeCents;

    @Column(name = "entry_deadline")
    private LocalDate entryDeadline;

    @Column(name = "draft_date")
    private LocalDate draftDate;

    // --- Game format: 2 x 15 for the Classic, against the league's 3 x 20. ---

    @Column(name = "period_count", nullable = false)
    private Short periodCount = 2;

    @Column(name = "period_minutes", nullable = false)
    private Short periodMinutes = 20;

    /** Names a scoring profile in code rather than storing the rules as columns. */
    @Column(name = "scoring_profile", nullable = false, length = 40)
    private String scoringProfile = "conley-v1";

    /**
     * The tournament's lifecycle. Never mirrored onto {@code seasons.is_active} -- a tournament
     * season is forbidden from being active by chk_tournament_never_active (migration 046).
     */
    @Column(nullable = false, length = 20)
    private String status = STATUS_SETUP;

    @Column(name = "is_published", nullable = false)
    private Boolean isPublished = false;

    @Column(name = "champion_team_id")
    private Long championTeamId;

    @Column(name = "crest_image_url", length = 500)
    private String crestImageUrl;

    @Column(name = "trophy_image_url", length = 500)
    private String trophyImageUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Mirrors the VARCHAR + CHECK values in migration 048. Kept as constants in the
    // ShiftAssignment.STATUS_* style rather than enums, matching the rest of the codebase.
    public static final String GROUP_NONE = "NONE";
    public static final String GROUP_ROUND_ROBIN = "ROUND_ROBIN";
    public static final String GROUP_DIVISIONS = "DIVISIONS";

    public static final String CHAMPIONSHIP_NONE = "NONE";
    public static final String CHAMPIONSHIP_SINGLE_ELIM = "SINGLE_ELIM";

    public static final String CONSOLATION_NONE = "NONE";
    /** Every non-qualifier plays exactly one game: N teams produce N/2 games. */
    public static final String CONSOLATION_SINGLE_ROUND = "SINGLE_ROUND";
    public static final String CONSOLATION_BRACKET = "BRACKET";

    public static final String STATUS_SETUP = "setup";
    public static final String STATUS_DRAFT = "draft";
    public static final String STATUS_SCHEDULED = "scheduled";
    public static final String STATUS_IN_PROGRESS = "in_progress";
    public static final String STATUS_COMPLETED = "completed";
    public static final String STATUS_ARCHIVED = "archived";
}
