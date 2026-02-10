package com.obhl.gateway.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameResponseDTO {
    private Long id;
    private Long seasonId;
    private Long leagueId;
    private Long homeTeamId;
    private Long awayTeamId;
    private LocalDateTime gameDate;
    private String venue;
    private String status;
    private Integer homeScore;
    private Integer awayScore;
    private Boolean overtime;
    private Boolean shootout;
    private Integer period;
    private Boolean endedInOT;
    private Integer homeTeamPoints;
    private Integer awayTeamPoints;
    private Integer week;
    private String rink;
    private String gameNotes;
    private Long goalie1Id;
    private Long goalie2Id;
    private Long referee1Id;
    private Long referee2Id;
    private Long scorekeeperId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
