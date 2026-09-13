package com.obhl.gateway.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * PUT body for a player's own profile. Full-replace semantics: a null field clears it.
 * The birth-date window (16–100 years ago) is relative to today, which Bean Validation
 * can't express, so PlayerProfileService checks it.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerProfileUpdateDTO {

    private LocalDate birthDate;

    @Size(max = 100, message = "Keep it under 100 characters.")
    private String hometown;

    @Min(value = 48, message = "Enter a height between 4'0\" and 8'0\".")
    @Max(value = 96, message = "Enter a height between 4'0\" and 8'0\".")
    private Integer heightInches;

    @Min(value = 80, message = "Enter a weight between 80 and 400 lb.")
    @Max(value = 400, message = "Enter a weight between 80 and 400 lb.")
    private Integer weightLbs;

    @Pattern(regexp = "[LRlr]", message = "Shoots must be Left or Right.")
    private String shoots;

    /** Show the photo instead of initials on the dashboard avatar. Null reads as false. */
    private Boolean usePhotoAvatar;
}
