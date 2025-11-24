package com.obhl.gateway.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class TeamDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Create {
        @NotBlank(message = "Team name is required")
        @Size(min = 1, max = 100)
        private String name;

        @NotBlank(message = "Abbreviation is required")
        @Size(min = 2, max = 10)
        private String abbreviation;

        @NotNull(message = "Season ID is required")
        @Positive
        private Long seasonId;

        @Size(max = 500)
        private String logoUrl;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
        private String teamColor;

        @Positive
        private Long gmId;

        private Boolean active = true;

        @Min(0)
        private Integer points = 0;

        @Min(0)
        private Integer wins = 0;

        @Min(0)
        private Integer losses = 0;

        @Min(0)
        private Integer ties = 0;

        @Min(0)
        private Integer overtimeWins = 0;

        @Min(0)
        private Integer overtimeLosses = 0;

        @Min(0)
        private Integer goalsFor = 0;

        @Min(0)
        private Integer goalsAgainst = 0;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Update {
        @Size(min = 1, max = 100)
        private String name;

        @Size(min = 2, max = 10)
        private String abbreviation;

        @Positive
        private Long seasonId;

        @Size(max = 500)
        private String logoUrl;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
        private String teamColor;

        @Positive
        private Long gmId;

        private Boolean active;

        @Min(0)
        private Integer points;

        @Min(0)
        private Integer wins;

        @Min(0)
        private Integer losses;

        @Min(0)
        private Integer ties;

        @Min(0)
        private Integer overtimeWins;

        @Min(0)
        private Integer overtimeLosses;

        @Min(0)
        private Integer goalsFor;

        @Min(0)
        private Integer goalsAgainst;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
        private String name;
        private String abbreviation;
        private Long seasonId;
        private String logoUrl;
        private String teamColor;
        private Long gmId;
        private Boolean active;
        private Integer points;
        private Integer wins;
        private Integer losses;
        private Integer ties;
        private Integer overtimeWins;
        private Integer overtimeLosses;
        private Integer goalsFor;
        private Integer goalsAgainst;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}
