package com.obhl.gateway.dto;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One row of the profile card's season history — team and position only, never stats. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeasonHistoryEntryDTO {
    private Long seasonId;
    private String seasonName;
    /** LEAGUE or TOURNAMENT, as league-service reports it. */
    private String seasonType;
    private LocalDate startDate;
    @JsonProperty("isCurrent")
    private boolean isCurrent;
    private PlayerCardDTO.TeamRef team;
    private String position;
    private Integer jerseyNumber;
}
