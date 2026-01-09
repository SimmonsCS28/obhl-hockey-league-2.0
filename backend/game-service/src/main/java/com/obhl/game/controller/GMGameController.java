package com.obhl.game.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.game.model.Game;
import com.obhl.game.repository.GameRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/gm")
@RequiredArgsConstructor
public class GMGameController {

    private final GameRepository gameRepository;

    /**
     * Get team's schedule for a season
     */
    @GetMapping("/team/{teamId}/schedule")
    public ResponseEntity<List<Game>> getTeamSchedule(
            @PathVariable Long teamId,
            @RequestParam Long seasonId) {

        // Get all games where the team is either home or away
        List<Game> games = gameRepository.findBySeasonIdAndTeam(seasonId, teamId);

        return ResponseEntity.ok(games);
    }
}
