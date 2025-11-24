package com.obhl.league.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class SeasonDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Create {
        @NotBlank(message = "Season name is required")
        @Size(min = 1, max = 100)
        private String name;

        @NotNull(message = "Start date is required")
        private LocalDate startDate;

        @NotNull(message = "End date is required")
        private LocalDate endDate;

        @Pattern(regexp = "^(upcoming|active|completed|cancelled)$")
        private String status = "upcoming";

        private Boolean isActive = false;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Update {
        @Size(min = 1, max = 100)
        private String name;

        private LocalDate startDate;

        private LocalDate endDate;

        @Pattern(regexp = "^(upcoming|active|completed|cancelled)$")
        private String status;

        private Boolean isActive;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
        private String name;
        private LocalDate startDate;
        private LocalDate endDate;
        private String status;
        private Boolean isActive;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}
