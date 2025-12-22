package com.obhl.league.dto;

import java.util.List;

import lombok.Data;

@Data
public class DraftTeamDTO {
    private int id; // Temporary ID from frontend
    private String name;
    private String color;
    private String sortOption;
    private List<DraftPlayerDTO> players;
}
