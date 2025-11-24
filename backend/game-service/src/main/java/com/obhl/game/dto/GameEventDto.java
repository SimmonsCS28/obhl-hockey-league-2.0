package com.obhl.game.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class GameEventDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Create {
        @NotNull(message = "Game ID is required")
        @Positive
        private Long gameId;

        @NotNull(message = "Team ID is required")
        @Positive
        private Long teamId;

        @Positive
        private Long playerId;

        @NotBlank(message = "Event type is required")
        @Pattern(regexp = "^(goal|penalty|save|shot|hit|faceoff)$")
        private String eventType;

        @NotNull(message = "Period is required")
        @Min(1)
        @Max(5)
        private Integer period;

        @NotNull(message = "Time minutes is required")
        @Min(0)
        @Max(59)
        private Integer timeMinutes;

        @NotNull(message = "Time seconds is required")
        @Min(0)
        @Max(59)
        private Integer timeSeconds;

        private String description;

        @Positive
        private Long assist1PlayerId;

        @Positive
        private Long assist2PlayerId;

        @Positive
        private Integer penaltyMinutes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
        private Long gameId;
        private Long teamId;
        private Long playerId;
        private String eventType;
        private Integer period;
        private Integer timeMinutes;
        private Integer timeSeconds;
        private String description;
        private Long assist1PlayerId;
        private Long assist2PlayerId;
        private Integer penaltyMinutes;
        private LocalDateTime createdAt;
    }
}
