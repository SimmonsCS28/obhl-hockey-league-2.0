package com.obhl.gateway.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Everything the public profile card modal renders, and nothing it must not.
 *
 * Deliberately absent: email, birthDate (only the computed age travels), skillRating,
 * buddy picks, and any stats. Those are either privileged or explicitly out of the
 * card's scope; the DTO shape is the enforcement, not a serialization view.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerCardDTO {

    // --- "This season": from the season row that was clicked ---
    private Long playerId;
    private String firstName;
    private String lastName;
    private String position;
    private Integer jerseyNumber;
    private Long seasonId;
    private String seasonName;
    /** True when the clicked row's season is the active one; drives "this season" vs "as drafted". */
    private boolean seasonIsCurrent;
    private TeamRef team;
    private Badges badges;

    // --- "This person": from the profile, falling back to the season row ---
    private String photoUrl;
    private Integer age;
    private String hometown;
    private Integer heightInches;
    private Integer weightLbs;
    private String shoots;

    /** The viewer is this player (JWT email matches the row's email, case-insensitive). */
    @JsonProperty("isSelf")
    private boolean isSelf;
    /** A player_profiles row exists with at least one detail or a photo. */
    private boolean hasProfile;

    private List<SeasonHistoryEntryDTO> seasonHistory;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamRef {
        private Long id;
        private String name;
        private String abbreviation;
        private String teamColor;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Badges {
        @JsonProperty("isGm")
        private boolean isGm;
        @JsonProperty("isVeteran")
        private boolean isVeteran;
        private boolean twoGoalLimit;
    }
}
