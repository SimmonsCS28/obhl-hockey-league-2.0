package com.obhl.gateway.dto;

import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoalieUnavailabilityDTO {
    private Long userId;
    private LocalDate date;
}
