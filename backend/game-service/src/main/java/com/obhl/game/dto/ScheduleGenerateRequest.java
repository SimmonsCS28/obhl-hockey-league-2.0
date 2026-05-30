package com.obhl.game.dto;

import java.util.List;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleGenerateRequest {

    @NotNull(message = "Season ID is required")
    @Positive
    private Long seasonId;

    @Positive
    private Long leagueId;

    @NotNull(message = "Team IDs are required")
    private List<Long> teamIds;

    @NotNull(message = "Game slots are required")
    private List<GameSlot> gameSlots;

    @NotNull(message = "Max weeks is required")
    @Positive
    private Integer maxWeeks;

    // Number of playoff weeks to append after maxWeeks (default 0)
    // These slots will be created with gameType=PLAYOFF and TBD teams
    private Integer playoffWeeks = 0;
}
