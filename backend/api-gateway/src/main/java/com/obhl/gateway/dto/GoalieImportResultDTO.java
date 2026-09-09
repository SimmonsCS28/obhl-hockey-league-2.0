package com.obhl.gateway.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Outcome of a goalie import. Split because the two halves are not interchangeable:
 * a new goalie gains an account, while a returning one only gains this season's player
 * record — and the admin needs to see that the second group was carried, not re-rated.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalieImportResultDTO {

    /** Accounts created for goalies new to the league. */
    private List<UserDTO> createdUsers;

    /** Names of returning goalies put onto this season's roster at their existing rating. */
    private List<String> carriedForward;

    /** Rows that needed nothing doing. */
    private int skipped;
}
