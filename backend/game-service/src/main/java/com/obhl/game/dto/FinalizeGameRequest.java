package com.obhl.game.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FinalizeGameRequest {
    private Long gameId;
    private Integer homeScore;
    private Integer awayScore;
    private Boolean endedInOT;
}
