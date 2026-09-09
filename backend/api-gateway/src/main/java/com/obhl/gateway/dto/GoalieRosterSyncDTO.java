package com.obhl.gateway.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The season goalie roster the weekly proposer runs on, after a sync.
 *
 * Registering makes a goalie full-time; a goalie who does not register is carried forward as
 * a substitute at the rating they already had, rather than dropped.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalieRosterSyncDTO {

    private Long seasonId;

    /** The season the substitutes were carried from, or null if there was no earlier roster. */
    private Long carriedFromSeasonId;

    /** Registered this season — these are the goalies the weekly proposer schedules. */
    private List<String> fullTime;

    /** Did not register — kept as substitutes, still callable ad hoc. */
    private List<String> carriedAsSubstitute;

    /** Player records created so the carried substitutes' ratings resolve this season. */
    private int playerRecordsCreated;
}
