package com.obhl.game.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TeamResponse {
    private Long id;
    private String name;
    private String abbreviation;
    private Long seasonId;
    private String logoUrl;
    private String teamColor;

    /** Tournament bracket seed; null for league teams. Drives the tournament draw. */
    private Integer seed;

    /** Division label ('A', 'B', ...) when a tournament runs divisions. */
    private String pool;
}
