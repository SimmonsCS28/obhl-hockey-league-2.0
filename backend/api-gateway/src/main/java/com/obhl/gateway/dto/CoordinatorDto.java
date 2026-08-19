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
        private LocalDateTime respondedAt;
        /**
         * Last write to the row. For a row still awaiting a reply this is when the confirmation
         * email went out, which is what the console's "Emailed N days ago" line measures — {@code
         * createdAt} can't serve that, because re-proposing a slot upserts the same row and its
         * creation stamp is {@code updatable = false}, so it would report the slot's first-ever
         * proposal rather than the current occupant's.
         */
        private LocalDateTime updatedAt;
        /** Confirm-link expiry; drives the "link expires in N days" warning and the Link Expired chip. */
        private LocalDateTime tokenExpiresAt;
        private LocalDateTime gameDate;
        private String homeTeam;
        private String awayTeam;
        /**
         * Team ids as well as names: a goalie's own dashboard shows the colour of the net they're in,
         * and matching a team by name to find its colour breaks the moment two seasons spell one
         * differently.
         */
        private Long homeTeamId;
        private Long awayTeamId;
        private String rink;
    }

    /**
     * Result of removing an assignment. The removal itself always stands — it is committed before the
     * email is attempted — so the flags exist to describe the one genuinely ambiguous outcome: the
     * person is off the game but was never told, which is the state a coordinator has to act on.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WithdrawResult {
        private boolean removed;
        private boolean notifyAttempted;  // did this person have a commitment worth telling them about
        private boolean notifySent;       // false + attempted = they don't know yet
    }

    /** One slot in a publish plan — someone who will be emailed, is already live, or is blocked. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PublishTarget {
        private Long assignmentId;
        private Long gameId;
        private String userName;
        private String slotLabel;   // "Ref 1" | "Scorekeeper" | team name for goalies
        private String matchup;     // "Red vs Green"
        private String dayDate;     // "Sun Jun 28" (league-local)
        private String time;        // "8:00 PM" (league-local)
        private String status;      // blocked entries only
        private String reason;      // blocked entries only, already phrased for display
    }

    /**
     * Result of a publish. Doubles as the <em>plan</em> for a dry run: the same walk over the same
     * rows, with the writes and emails skipped. The three lists exist because the coordinator's
     * question before clicking is always "who exactly gets an email" — a bare count is what made the
     * week-wide button feel unsafe.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PublishResult {
        private int publishedCount;
        private List<String> unconfirmedSlots; // human-readable descriptions of slots not yet confirmed
        private List<PublishTarget> willEmail;
        private List<PublishTarget> alreadyLive;
        private List<PublishTarget> blocked;
        private int alreadyPublishedCount;
        private boolean dryRun;
    }

    /**
     * Which team a staff member plays for this season, so the console can flag assigning someone to
     * a game their own team is in.
     *
     * <p>An entry is returned for <em>every</em> staff user, including those we can't resolve —
     * {@code resolved=false} is a real answer and must not be confused with "no conflict". The link
     * is {@code lower(users.email)} against {@code players.email} for the season, which currently
     * misses well over half of referees, so the console renders three states and the unresolved one
     * has to be distinguishable. Omitting these entries would silently collapse it to two.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StaffTeamView {
        private Long userId;
        private boolean resolved;   // false = no players row matched this email for this season
        private Long teamId;
        private String teamName;
        private String teamColor;
    }

    /** One role's notification settings, as the panel shows and saves them. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationPrefView {
        private String role;                 // GOALIE | REF | SCOREKEEPER
        private boolean notifyOnDecline;
        private boolean notifyOnConfirm;
        private String emailOverride;        // null = the account's own address
        private String accountEmail;         // what null falls back to, so the panel can name it
        /**
         * Everyone else holding this coordinator role. Drives "You're the only one" vs "With Amy
         * Cole" — which is what makes the last-recipient warning intelligible: turning declines off
         * matters very differently depending on whether anyone else would still get them.
         */
        private List<String> otherHolders;
    }

    /**
     * The whole settings panel for one person. {@code roles} is empty for an admin who holds no
     * coordinator role — a real state with its own screen, not an error.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationSettingsView {
        private List<NotificationPrefView> roles;
        /**
         * Coordinator roles nobody currently holds, so their notices fall back to admins. Lets the
         * admin screen say exactly which mail is reaching them and why — the confusion this whole
         * feature was asked for.
         */
        private List<String> unfilledRoles;
        private boolean isAdmin;
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
        // Full-time goalies told they drew no slot this week. Surfaced so the coordinator can see
        // the bench was covered, and see it as 0 on a top-up send that deliberately skipped them.
        private int notifiedUnassignedCount;
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
