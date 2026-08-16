package com.obhl.league.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class TournamentDto {

    /**
     * Creating a tournament also provisions its backing season, so this carries the season's dates
     * and name too. The caller never creates the season separately -- doing so by hand risks a
     * tournament season that is active, or a tournament with no season at all.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Create {
        @NotBlank(message = "Tournament name is required")
        @Size(max = 150)
        private String name;

        @NotNull(message = "Year is required")
        @Min(2000)
        @Max(2200)
        private Integer year;

        /** Optional -- derived from name + year when omitted. */
        @Size(max = 80)
        private String slug;

        @Size(max = 200)
        private String tagline;

        @Pattern(regexp = "^(NONE|ROUND_ROBIN|DIVISIONS)$")
        private String groupStage;

        @Min(2)
        private Integer poolCount;

        @Min(1)
        private Integer advancePerPool;

        @Pattern(regexp = "^(NONE|SINGLE_ELIM)$")
        private String championshipStage;

        private Boolean placementGame;

        @Pattern(regexp = "^(NONE|SINGLE_ROUND|BRACKET)$")
        private String consolationStage;

        @Min(0)
        private Integer consolationTeamCount;

        @Min(2)
        @Max(32)
        private Integer teamCount;

        @NotNull(message = "Start date is required")
        private LocalDate startDate;

        @NotNull(message = "End date is required")
        private LocalDate endDate;

        @Size(max = 150)
        private String venue;

        @Min(0)
        private Integer entryFeeCents;

        private LocalDate entryDeadline;
        private LocalDate draftDate;

        @Min(1)
        @Max(5)
        private Short periodCount;

        @Min(1)
        @Max(60)
        private Short periodMinutes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Update {
        @Size(max = 150)
        private String name;

        @Size(max = 200)
        private String tagline;

        @Pattern(regexp = "^(NONE|ROUND_ROBIN|DIVISIONS)$")
        private String groupStage;

        @Min(2)
        private Integer poolCount;

        @Min(1)
        private Integer advancePerPool;

        @Pattern(regexp = "^(NONE|SINGLE_ELIM)$")
        private String championshipStage;

        private Boolean placementGame;

        @Pattern(regexp = "^(NONE|SINGLE_ROUND|BRACKET)$")
        private String consolationStage;

        @Min(0)
        private Integer consolationTeamCount;

        @Min(2)
        @Max(32)
        private Integer teamCount;

        private LocalDate startDate;
        private LocalDate endDate;

        @Size(max = 150)
        private String venue;

        @Min(0)
        private Integer entryFeeCents;

        private LocalDate entryDeadline;
        private LocalDate draftDate;

        @Min(1)
        @Max(5)
        private Short periodCount;

        @Min(1)
        @Max(60)
        private Short periodMinutes;

        @Pattern(regexp = "^(setup|draft|scheduled|in_progress|completed|archived)$")
        private String status;

        private Boolean isPublished;

        private Long championTeamId;

        @Size(max = 500)
        private String crestImageUrl;

        @Size(max = 500)
        private String trophyImageUrl;

        // Deliberately absent: seasonId and slug. The season link is fixed at creation, and the
        // slug is a public URL that should not change under visitors' feet.
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
        private Long seasonId;
        private String slug;
        private String name;
        private Integer year;
        private String tagline;

        private String groupStage;
        private Integer poolCount;
        private Integer advancePerPool;
        private String championshipStage;
        private Boolean placementGame;
        private String consolationStage;
        private Integer consolationTeamCount;
        private String displayFormat;

        private Integer teamCount;
        private LocalDate startDate;
        private LocalDate endDate;
        private String venue;
        private Integer entryFeeCents;
        private LocalDate entryDeadline;
        private LocalDate draftDate;

        private Short periodCount;
        private Short periodMinutes;
        private String scoringProfile;

        private String status;
        private Boolean isPublished;
        private Long championTeamId;
        private String crestImageUrl;
        private String trophyImageUrl;

        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}
