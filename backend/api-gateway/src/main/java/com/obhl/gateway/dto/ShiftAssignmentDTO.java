package com.obhl.gateway.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShiftAssignmentDTO {
    private Long gameId;
    private LocalDate gameDate;
    private LocalTime gameTime;
    private String homeTeam;
    private String awayTeam;
    private String role; // GOALIE, REF, SCOREKEEPER
}
