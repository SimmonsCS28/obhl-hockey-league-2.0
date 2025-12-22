package com.obhl.league.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Data;

@Data
public class DraftPlayerDTO {
    private String firstName;
    private String lastName;
    private String email;
    private String position;
    private int skillRating;

    @JsonProperty("isVeteran")
    private boolean isVeteran;

    private String status;
    private String buddyPick;
    private String buddyEmail;

    @JsonProperty("isRef")
    private boolean isRef;

    @JsonProperty("isGm")
    private boolean isGm;
}
