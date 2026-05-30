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

        // Min(0) allows TBD playoff games where teamId=0 means "to be determined"
        // homeTeamId and awayTeamId are nullable — null means TBD (playoff games before bracket is set)
        private Long homeTeamId;

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
        private String gameType;       // "REGULAR_SEASON" or "PLAYOFF"
        private String playoffRound;   // "QUARTERFINAL", "SEMIFINAL", "FINAL"
        private Integer bracketPosition;
        private Long goalie1Id;
        private Long goalie2Id;
        private Long referee1Id;
        private Long referee2Id;
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
        private String gameType;
        private String playoffRound;
        private Integer bracketPosition;
        private Long goalie1Id;
        private Long goalie2Id;
        private Long referee1Id;
        private Long referee2Id;
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
        
        @NotNull
        private Long teamId;
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
        private String playoffRound;
        private Integer bracketPosition;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private Long goalie1Id;
        private Long goalie2Id;
        private Long referee1Id;
        private Long referee2Id;
        private Long scorekeeperId;
    }
}
