package com.obhl.game.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PenaltyValidationResponse {
    private boolean shouldEject;
    private boolean shouldSuspendNextGame;
    private int penaltyCount;
    private String warningMessage;
    private String warningType; // "EJECTION" or "EJECTION_AND_SUSPENSION"
}
