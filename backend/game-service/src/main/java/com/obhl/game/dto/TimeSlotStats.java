package com.obhl.game.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Tracks time slot statistics for a team during schedule generation
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TimeSlotStats {

    private Long teamId;
    private int earlyGames = 0;
    private int midGames = 0;
    private int lateGames = 0;
    private Integer lastLateWeek = null; // null if never played late

    public TimeSlotStats(Long teamId) {
        this.teamId = teamId;
    }

    /**
     * Increment count for a time category
     */
    public void incrementCategory(String category) {
        switch (category.toLowerCase()) {
            case "early":
                earlyGames++;
                break;
            case "mid":
                midGames++;
                break;
            case "late":
                lateGames++;
                break;
        }
    }

    /**
     * Get total games scheduled
     */
    public int getTotalGames() {
        return earlyGames + midGames + lateGames;
    }

    /**
     * Get count for a specific category
     */
    public int getCategoryCount(String category) {
        switch (category.toLowerCase()) {
            case "early":
                return earlyGames;
            case "mid":
                return midGames;
            case "late":
                return lateGames;
            default:
                return 0;
        }
    }
}
