package com.obhl.gateway.dto;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** DTOs for the staff pay workflow: rates, finalize, confirm totals, rink report. */
public class StaffPayDto {

    /** One person in one role on the rates grid, with what they have worked this season. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RateView {
        private Long userId;
        private String name;
        private String email;
        private String role;            // REF | SCOREKEEPER
        private Integer rateCents;      // null = no rate set yet
        private int games;              // season credits so far (solo games already doubled)
        private int soloGames;
        private boolean hasRole;        // false = worked games but no longer holds the role / inactive
        private boolean active;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SaveRateRequest {
        private Long userId;
        private String role;
        private Integer rateCents;
    }

    /** One game as it appears in a person's confirmation email and on the admin's line detail. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GameRow {
        private Long gameId;
        private LocalDateTime gameDate;     // UTC
        private String dateLabel;           // league-local, formatted
        private String matchup;
        private boolean solo;
    }

    /** One snapshotted line of the finalized period, as the admin sees it. */
    @Data
    @NoArgsConstructor
    public static class LineView {
        private Long id;
        private Long userId;
        private String name;
        private String email;
        private String role;
        private int games;
        private int soloGames;
        private int rateCents;
        private int totalCents;
        private String confirmStatus;       // PENDING | CONFIRMED | DISPUTED | ADMIN_CONFIRMED
        private LocalDateTime emailSentAt;
        private LocalDateTime respondedAt;
        private String disputeNote;
        private boolean stale;              // live totals differ from the snapshot: re-finalize needed
        private List<GameRow> gameRows;
    }

    /** Live totals for someone with credits this season (pre-finalize preview / staleness check). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LiveTotal {
        private Long userId;
        private String name;
        private String role;
        private int games;
        private int soloGames;
        private Integer rateCents;
        private Integer totalCents;         // null while no rate is set
    }

    /** Everything the Staff Pay tab needs for one season in one call. */
    @Data
    @NoArgsConstructor
    public static class SummaryView {
        private Long seasonId;
        private String seasonName;
        private String periodStatus;        // DRAFT | FINALIZED | SENT (DRAFT when no period row yet)
        private String title;
        private LocalDateTime finalizedAt;
        private LocalDateTime confirmationsSentAt;
        private LocalDateTime reportSentAt;
        private String reportSentTo;
        private String financeEmail;        // saved default recipient, may be null
        private List<LiveTotal> live;
        private List<String> missingRates;  // names blocking finalize
        private List<LineView> lines;
        private boolean stale;              // any line's live totals drifted from the snapshot
        private int pending;
        private int confirmed;
        private int disputed;
        private boolean reportReady;
        private int totalCents;             // sum of finalized lines
    }

    /** What the emailed link shows the person — no email addresses or ids beyond the line's own. */
    @Data
    @NoArgsConstructor
    public static class TokenLineView {
        private Long id;
        private String name;
        private String role;
        private String seasonName;
        private int games;
        private int soloGames;
        private int rateCents;
        private int totalCents;
        private String confirmStatus;
        private List<GameRow> gameRows;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenRespondRequest {
        private Long id;
        private String token;
        private String action;      // confirm | dispute
        private String note;        // optional, for dispute
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SendReportRequest {
        private String toEmail;
        private Boolean saveAsDefault;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SettingRequest {
        private String value;
    }

    /** Result of a bulk send: how many went out and who could not be reached. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SendResult {
        private int sent;
        private int skipped;
        private List<String> failed;
    }
}
