package com.obhl.game.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class GameDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Create {
        @NotNull
        @Positive
        private Long seasonId;

        private Long leagueId;

        @NotNull
        @Positive
        private Long homeTeamId;

        @NotNull
        @Positive
        private Long awayTeamId;

        @NotNull
        private LocalDateTime gameDate;

        @Size(max = 200)
        private String venue;

        private String status;
        private Integer homeScore;
        private Integer awayScore;
        private Boolean overtime;
        private Boolean shootout;
        private Integer period;
        private Integer week;
        private String rink;
        private String gameNotes;
        private Long goalieId;
        private Long refereeId;
        private Long scorekeeperId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Update {
        private Long seasonId;
        private Long leagueId;
        private Long homeTeamId;
        private Long awayTeamId;
        private LocalDateTime gameDate;
        private String venue;
        private String status;
        private Integer homeScore;
        private Integer awayScore;
        private Boolean overtime;
        private Boolean shootout;
        private Integer period;
        private Integer week;
        private String rink;
        private String gameNotes;
        private Long goalieId;
        private Long refereeId;
        private Long scorekeeperId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScoreUpdate {
        private Integer homeScore;
        private Integer awayScore;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FinalizeRequest {
        @NotNull
        private Integer homeScore;
        @NotNull
        private Integer awayScore;
        private Boolean endedInOT;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PenaltyValidationRequest {
        @NotNull
        private Long playerId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
        private Long seasonId;
        private Long leagueId;
        private Long homeTeamId;
        private String homeTeamName; // Added for UI
        private String homeTeamColor; // Added for UI
        private Long awayTeamId;
        private String awayTeamName; // Added for UI
        private String awayTeamColor; // Added for UI
        private LocalDateTime gameDate;
        private String venue;
        private String status;
        private Integer homeScore;
        private Integer awayScore;
        private Boolean overtime;
        private Boolean shootout;
        private Integer period;
        private Boolean endedInOT;
        private Integer homeTeamPoints;
        private Integer awayTeamPoints;
        private Integer week;
        private String rink;
        private String gameNotes;
        private String gameType;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private Long goalieId;
        private Long refereeId;
        private Long scorekeeperId;
    }
}
