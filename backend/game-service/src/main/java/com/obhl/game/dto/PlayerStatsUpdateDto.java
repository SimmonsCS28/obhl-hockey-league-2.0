package com.obhl.game.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerStatsUpdateDto {
    private Long playerId;
    private Long seasonId;
    private Long teamId;
    private Integer goals;
    private Integer assists;
    private Integer points;
    private Integer penaltyMinutes;
}
