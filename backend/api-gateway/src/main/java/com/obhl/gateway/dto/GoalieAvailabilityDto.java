package com.obhl.gateway.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTOs for the v3 positive goalie weekly availability.
 */
public class GoalieAvailabilityDto {

    /** One week in a goalie's availability list. {@code status} is null when not set. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeekAvailability {
        private Integer week;
        private LocalDateTime startDate;   // earliest game that week
        private LocalDateTime endDate;     // latest game that week
        private int gamesCount;
        private String status;             // AVAILABLE | UNAVAILABLE | null
    }

    /** A goalie's status for a given week (coordinator pool view). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GoalieWeekStatus {
        private Long userId;
        private String userName;
        private String status;             // AVAILABLE | UNAVAILABLE
    }

    /** Request body for setting one week's status (status null/blank clears it). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SetWeekRequest {
        private Long seasonId;
        private Integer week;
        private String status;
    }
}
