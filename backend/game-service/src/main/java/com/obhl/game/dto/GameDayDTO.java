package com.obhl.game.dto;

import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameDayDTO {
    private LocalDate date;
    private Integer gamesCount;
}
