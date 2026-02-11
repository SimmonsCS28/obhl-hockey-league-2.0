package com.obhl.gateway.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerDTO {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private Long seasonId;
    private String position;
    private String jerseyNumber;
    private Long teamId;
    private Boolean isActive;
}
