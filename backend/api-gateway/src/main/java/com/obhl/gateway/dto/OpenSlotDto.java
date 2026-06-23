package com.obhl.gateway.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single staff slot on a game, from the self-service Open Slots view (refs/scorekeepers).
 * {@code state} is relative to the requesting user: OPEN (nobody), MINE (you signed up / are
 * assigned), or TAKEN (someone else holds it).
 */
public class OpenSlotDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OpenSlotView {
        private String slotId;       // "gameId-ROLE-slot", e.g. "123-REF-2"
        private Long gameId;
        private Long seasonId;
        private String role;         // REF | SCOREKEEPER
        private Integer slot;        // 1 or 2 (scorekeeper: always 1)
        private Integer week;
        private LocalDateTime gameDate;
        private String rink;
        private String homeTeam;
        private String awayTeam;
        private String state;        // OPEN | MINE | TAKEN
        private String rowStatus;    // SIGNED_UP | PROPOSED | CONFIRMED (null when OPEN)
        private Long assignmentId;   // set when MINE/TAKEN
        private String takenByName;  // set when TAKEN
    }
}
