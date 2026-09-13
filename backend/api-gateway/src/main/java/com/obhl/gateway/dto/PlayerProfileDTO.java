package com.obhl.gateway.dto;

import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The owner's view of their own profile — the only place the full birth date leaves
 * the server, because the date picker needs it. Everyone else gets PlayerCardDTO.age.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerProfileDTO {
    /** The owner's season row in the active season, else their newest row — lets the UI reopen the card after saving. */
    private Long playerId;
    private String firstName;
    private String lastName;
    private LocalDate birthDate;
    private String hometown;
    private Integer heightInches;
    private Integer weightLbs;
    private String shoots;
    private String photoUrl;
    private boolean usePhotoAvatar;
}
