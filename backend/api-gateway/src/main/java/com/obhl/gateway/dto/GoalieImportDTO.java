package com.obhl.gateway.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalieImportDTO {
    private String firstName;
    private String lastName;
    private String email;
    private String phoneNumber;
    private Integer skillRating;
}
