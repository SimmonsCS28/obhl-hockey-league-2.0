package com.obhl.game.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
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
        @NotNull(message = "Season ID is required")
        @Positive
        private Long seasonId;

        @Positive
        private Long leagueId;

        @NotNull(message = "Home team ID is required")
        @Positive
        private Long homeTeamId;

        @NotNull(message = "Away team ID is required")
        @Positive
        private Long awayTeamId;

        @NotNull(message = "Game date is required")
        private LocalDateTime gameDate;

        @Size(max = 200)
        private String venue;

        @Pattern(regexp = "^(scheduled|in_progress|completed|postponed|cancelled)$")
        private String status = "scheduled";

        @Min(0)
        private Integer homeScore = 0;

        @Min(0)
        private Integer awayScore = 0;

        private Boolean overtime = false;

        private Boolean shootout = false;

        @Min(1)
        @Max(5)
        private Integer period = 1;

        @Min(1)
        private Integer week;

        @Size(max = 20)
        private String rink;

        private String gameNotes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Update {
        @Positive
        private Long seasonId;

        @Positive
        private Long leagueId;

        @Positive
        private Long homeTeamId;

        @Positive
        private Long awayTeamId;

        private LocalDateTime gameDate;

        @Size(max = 200)
        private String venue;

        @Pattern(regexp = "^(scheduled|in_progress|completed|postponed|cancelled)$")
        private String status;

        @Min(0)
        private Integer homeScore;

        @Min(0)
        private Integer awayScore;

        private Boolean overtime;

        private Boolean shootout;

        @Min(1)
        @Max(5)
        private Integer period;

        @Min(1)
        private Integer week;

        @Size(max = 20)
        private String rink;

        private String gameNotes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
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
        private Boolean endedInOT;
        private Integer homeTeamPoints;
        private Integer awayTeamPoints;
        private Integer week;
        private String rink;
        private String gameNotes;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScoreUpdate {
        @NotNull
        @Min(0)
        private Integer homeScore;

        @NotNull
        @Min(0)
        private Integer awayScore;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FinalizeRequest {
        @NotNull
        @Min(0)
        private Integer homeScore;

        @NotNull
        @Min(0)
        private Integer awayScore;

        private Boolean endedInOT = false;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PenaltyValidationRequest {
        @NotNull
        @Positive
        private Long playerId;
    }
}
