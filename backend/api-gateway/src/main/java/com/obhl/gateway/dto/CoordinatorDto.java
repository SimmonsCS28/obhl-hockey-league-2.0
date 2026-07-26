package com.obhl.gateway.dto;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTOs for the coordinator workflow (propose / view status / publish).
 */
public class CoordinatorDto {

    /** Request from a coordinator to propose a staff member for a game slot. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProposeRequest {
        private Long gameId;
        private Long seasonId;
        private String role;   // GOALIE | REF
        private Integer slot;  // 1 or 2
        private Long userId;   // staff member being proposed
    }

    /** Admin direct-assign override: writes a slot as already CONFIRMED + published. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdminAssignRequest {
        private Long gameId;
        private String role;   // GOALIE | REF | SCOREKEEPER
        private Integer slot;  // 1 or 2 (SCOREKEEPER is always 1)
        private Long userId;   // null clears the slot
    }

    /** A proposed assignment with its confirmation status (coordinator + in-app views). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssignmentView {
        private Long id;
        private Long gameId;
        private Long seasonId;
        private Integer week;
        private String role;
        private Integer slot;
        private Long userId;
        private String userName;
        private String status;        // PROPOSED | CONFIRMED | DECLINED
        private Boolean published;
        private String declineReason;
        private LocalDateTime gameDate;
        private String homeTeam;
        private String awayTeam;
        private String rink;
    }

    /** Result of publishing a week's confirmed assignments. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PublishResult {
        private int publishedCount;
        private List<String> unconfirmedSlots; // human-readable descriptions of slots not yet confirmed
    }

    /** A season roster goalie: full-time (auto-assigned) or substitute (ad hoc fill-in). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SeasonGoalieView {
        private Long userId;
        private String userName;
        private boolean fulltime;
    }

    /** A full-time goalie the auto-proposer chose to sit out this week, with the reason. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SittingGoalie {
        private Long userId;
        private String name;
        private String reason;
    }

    /** Why the optimizer placed one goalie where it did (drives the "why" panel). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GoaliePlacement {
        private Long userId;
        private String userName;
        private Integer rating;          // null when the players-row lookup didn't resolve
        private boolean ratingResolved;
        private String tierLabel;        // "T1", "T1/T2", …
        private Long gameId;
        private String matchup;          // "Home vs Away"
        private String bucket;           // EARLY | MID | LATE (relative within the week)
        private int priorEarly;          // this goalie's season counts per bucket, before this week
        private int priorMid;
        private int priorLate;
        private List<String> flags;      // soft-rule warnings the human may want to override
    }

    /** The full reasoning behind one auto-propose run. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProposalReasoning {
        private List<GoaliePlacement> placements;
        private List<String> unratedGoalies;   // skill lookup failed — treated as neutral, verify these
        private int skillCost;                 // lower = tighter skill matchups
        private int rotationCost;              // lower = better slot/team rotation
        private String pairingNote;            // e.g. "tier rule satisfied for all 5 games"
    }

    /** Result of an auto-propose run for a single week's goalie slots. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AutoProposeResult {
        private int filledCount;                       // slots this run newly filled as AUTO_PROPOSED
        private int openCount;                         // goalie slots still open after the run
        private List<SittingGoalie> sitting;           // eligible full-timers rotated out this week
        private List<AssignmentView> assignments;      // all goalie assignments for the week after the run
        private ProposalReasoning reasoning;           // "why" panel data
    }

    /** Result of sending Email A (confirm-your-time) for a week's auto-proposed goalie slots. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SendConfirmationsResult {
        private int sentCount;
        private List<AssignmentView> assignments;
    }

    /** A staff member's mark/remove unavailability request. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AvailabilityRequest {
        private List<java.time.LocalDate> dates;
    }

    /** Public (email-link) confirm/decline request. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenRespondRequest {
        private Long id;
        private String token;
        private String action;  // confirm | decline
        private String reason;  // optional, for decline
    }

    /** Authenticated (in-app) confirm/decline request. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RespondRequest {
        private String action;  // confirm | decline
        private String reason;  // optional, for decline
    }
}
