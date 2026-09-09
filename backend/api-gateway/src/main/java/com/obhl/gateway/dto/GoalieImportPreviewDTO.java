package com.obhl.gateway.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * What a goalie CSV will actually do, split three ways for the review modal.
 *
 * The file has no skill-rating column, so every row arrives at the default. That is only
 * a sensible rating for somebody nobody has rated yet, which is why the admin is asked
 * for a rating on {@code toImport} alone: a returning goalie's rating is read off their
 * last season and carried forward instead.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalieImportPreviewDTO {

    /** New to the league and unrated — the admin sets the rating. */
    private List<GoalieImportDTO> toImport;

    /** Already known to the league — gets this season's player record at their existing rating. */
    private List<CarriedGoalie> toCarryForward;

    /** Nothing to do, with the reason why. */
    private List<SkippedGoalie> alreadyInLeague;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarriedGoalie {
        private GoalieImportDTO goalie;

        /** The rating being carried forward, from the most recent season they played. */
        private Integer skillRating;

        /** True when they are in players but have no user account yet. */
        private boolean needsAccount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SkippedGoalie {
        private GoalieImportDTO goalie;

        /** Human-readable reason, shown in the review modal. */
        private String reason;

        /** Their rating on this season's record, when that is what makes them a skip. */
        private Integer existingSkillRating;
    }
}
