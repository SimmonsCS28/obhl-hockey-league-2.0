package com.obhl.gateway.dto;

import java.util.List;

import lombok.Data;

@Data
public class DraftStateDTO {
    private String seasonName;
    private Long seasonId;
    private int teamCount;
    private List<DraftPlayerDTO> playerPool;
    private List<DraftTeamDTO> teams;
    private boolean isLive;
}
