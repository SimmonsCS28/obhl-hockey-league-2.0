package com.obhl.league.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class LeagueDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Create {
        @NotNull(message = "Season ID is required")
        @Positive
        private Long seasonId;

        @NotBlank(message = "League name is required")
        @Size(min = 1, max = 100)
        private String name;

        @NotBlank(message = "Abbreviation is required")
        @Size(min = 1, max = 10)
        private String abbreviation;

        private String description;

        @Pattern(regexp = "^(division|conference|league)$")
        private String leagueType = "division";

        @Min(0)
        private Integer displayOrder = 0;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Update {
        @Positive
        private Long seasonId;

        @Size(min = 1, max = 100)
        private String name;

        @Size(min = 1, max = 10)
        private String abbreviation;

        private String description;

        @Pattern(regexp = "^(division|conference|league)$")
        private String leagueType;

        @Min(0)
        private Integer displayOrder;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
        private Long seasonId;
        private String name;
        private String abbreviation;
        private String description;
        private String leagueType;
        private Integer displayOrder;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}
