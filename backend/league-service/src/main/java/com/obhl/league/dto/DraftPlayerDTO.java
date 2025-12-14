package com.obhl.league.dto;

import lombok.Data;

@Data
public class DraftPlayerDTO {
    private String firstName;
    private String lastName;
    private String email;
    private String position;
    private int skillRating;
    private boolean isVeteran;
    private String buddyPick;
    private boolean isRef;
    private boolean isGm;
}
