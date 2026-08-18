package com.obhl.league.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class DraftDto {

    /**
     * One imported sign-up.
     *
     * <p>The spreadsheet is parsed in the browser (the xlsx library is already a frontend
     * dependency) and posted as JSON. That sidesteps multipart entirely — the gateway proxies read
     * bodies as String, which breaks binary uploads — and lets the operator see and correct the
     * parsed rows before anything is written.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EntrantInput {
        @NotBlank
        @Size(max = 50)
        private String firstName;

        @NotBlank
        @Size(max = 50)
        private String lastName;

        @Size(max = 255)
        private String email;

        @Size(max = 40)
        private String phone;

        @Size(max = 10)
        private String position;

        private Integer jerseyNumber;
        private Integer skillRating;
        private Boolean isGm;
        private Boolean paid;

        @Size(max = 280)
        private String notes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportRequest {
        private List<EntrantInput> entrants;
        /**
         * Replace the whole entrant list rather than merging. Off by default: a second import is
         * usually a late batch, and wiping the board partway through a draft should be deliberate.
         */
        private Boolean replaceExisting = false;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportResult {
        private int created;
        private int updated;
        private int skipped;
        private List<String> warnings;
    }

    /** One candidate account for an entrant, offered to the operator to confirm. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AccountCandidate {
        private Long userId;
        private String username;
        private String email;
        private String fullName;
        /** email | name — why this account came up, so the operator can judge it. */
        private String matchedOn;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EntrantResponse {
        private Long id;
        private String firstName;
        private String lastName;
        private String email;
        private String phone;
        private String position;
        private Integer jerseyNumber;
        private Integer skillRating;
        private Boolean isGm;
        private Boolean paid;
        private String notes;

        private Long userId;
        private String linkStatus;
        private List<AccountCandidate> candidates;

        /** Null when unassigned. */
        private Long teamId;
        private Integer pickNumber;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamRosterSummary {
        private Long teamId;
        private String teamName;
        private String teamColor;
        private Integer seed;
        private String pool;
        private Long captainEntrantId;
        private int skaters;
        /** Average skill of assigned entrants who have a rating; 0 when none do. */
        private double averageSkill;
    }

    /**
     * Everything the operator board needs in one response.
     *
     * <p>One call rather than several: on draft day the board is refreshed constantly and a
     * half-loaded screen is worse than a slightly larger payload.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BoardResponse {
        private Long tournamentId;
        private String status;
        private List<EntrantResponse> entrants;
        private List<TeamRosterSummary> teams;
        private int totalEntrants;
        private int assigned;
        private int unassigned;
        private int gmCount;
        private int teamCount;
        /** Blocking problems, e.g. GM count not matching team count. */
        private List<String> warnings;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssignRequest {
        private Long teamId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LinkRequest {
        /** Null clears the link and records it as deliberately unlinked. */
        private Long userId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommitResult {
        private int playersCreated;
        private int playersReused;
        private int teamsUpdated;
        private List<String> warnings;
    }
}
