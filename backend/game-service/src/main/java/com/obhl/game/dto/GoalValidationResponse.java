package com.obhl.game.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalValidationResponse {
    private boolean allowed;
    private String message;
    private boolean mercyRuleActive;
    private int goalsScored;
    private int goalLimit;
    private int skillRating;
}
