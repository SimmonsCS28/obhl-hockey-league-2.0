package com.obhl.gateway.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTOs for positive goalie availability. Goalies mark each game night; weeks group the nights for
 * display, and a week's {@code status} is derived from its nights.
 */
public class GoalieAvailabilityDto {

    /** Derived week status when the week's nights don't all agree (e.g. free Thursday, out Friday). */
    public static final String STATUS_PARTIAL = "PARTIAL";

    /** One game night inside a week. {@code status} is null when not set. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NightAvailability {
        private LocalDate date;            // America/Chicago calendar date of the night's games
        private int gamesCount;
        private String status;             // AVAILABLE | UNAVAILABLE | null
    }

    /**
     * One week in a goalie's availability list. {@code status} is AVAILABLE / UNAVAILABLE when every
     * night agrees, null when none is set, and PARTIAL otherwise.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeekAvailability {
        private Integer week;
        private LocalDateTime startDate;   // earliest game that week
        private LocalDateTime endDate;     // latest game that week
        private int gamesCount;
        private String status;             // AVAILABLE | UNAVAILABLE | PARTIAL | null
        private List<NightAvailability> nights = new ArrayList<>();
    }

    /**
     * A goalie's availability for a given week (coordinator pool view). Only goalies who marked at
     * least one night appear. {@code status} is derived as for {@link WeekAvailability}, over the
     * nights they marked; the per-night lists are what assignment checks use.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GoalieWeekStatus {
        private Long userId;
        private String userName;
        private String status;             // AVAILABLE | UNAVAILABLE | PARTIAL
        private List<LocalDate> availableNights = new ArrayList<>();
        private List<LocalDate> unavailableNights = new ArrayList<>();
    }

    /**
     * Request body for setting availability (status null/blank clears it). With {@code date} it sets
     * that one night; without, it sets every night of {@code week}.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SetWeekRequest {
        private Long seasonId;
        private Integer week;
        private LocalDate date;
        private String status;
    }
}
