package com.obhl.gateway.dto;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Season goalie performance, derived on read from completed games (final scores +
 * goalie1Id/goalie2Id assignments) — nothing here is persisted. There is no shot
 * tracking in this league, so only what's derivable from final scores is included
 * (GAA, W/L, shutouts, last-5 form). Rating is players.skill_rating, carried through
 * unchanged.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoaliePerformanceDto {
    private Long playerId;
    private Long userId;
    private String name;
    private Double gaa;
    private Integer gp;
    private Integer wins;
    private Integer losses;
    private Integer shutouts;
    private Integer rating;
    private List<GameLine> last5;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GameLine {
        private Long gameId;
        private LocalDateTime date;
        private Long teamId;
        private Long oppTeamId;
        private String oppGoalieName;
        private Integer gf;
        private Integer ga;
        private String result; // "W" | "L" | "T"
    }
}
