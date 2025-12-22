package com.obhl.league.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Data;

@Data
public class DraftStateDTO {
    private String seasonName;
    private int teamCount;
    private List<DraftPlayerDTO> playerPool;
    private List<DraftTeamDTO> teams;

    @JsonProperty("isLive")
    private boolean isLive;
}
