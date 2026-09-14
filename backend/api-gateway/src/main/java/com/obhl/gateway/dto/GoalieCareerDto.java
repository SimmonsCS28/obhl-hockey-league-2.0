package com.obhl.gateway.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A goalie's career line, derived on read from every completed league game they were in
 * net for (games.goalie1Id = home net, goalie2Id = away net, both user IDs) — nothing here
 * is persisted. Counts REGULAR_SEASON and PLAYOFF games only; C League Classic tournament
 * games are a separate event and are left out. GAA is goals-against per game (there is no
 * minutes tracking), rounded the same way as the season view so the two never disagree.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalieCareerDto {
    private Long userId;
    private String name;
    private Integer gp;
    private Integer wins;
    private Integer losses;
    private Integer ties;
    private Integer shutouts;
    private Integer goalsAgainst;
    private Double gaa;            // null until the first game
    private Integer seasonsPlayed;
    private List<SeasonLine> seasons; // newest season first

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SeasonLine {
        private Long seasonId;
        private String seasonName;
        private Integer gp;
        private Integer wins;
        private Integer losses;
        private Integer ties;
        private Integer shutouts;
        private Double gaa;
    }
}
