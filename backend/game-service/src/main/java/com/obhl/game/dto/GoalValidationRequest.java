package com.obhl.game.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalValidationRequest {
    private Long gameId;
    private Long playerId;
    private Long teamId;
}
