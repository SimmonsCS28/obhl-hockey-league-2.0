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
