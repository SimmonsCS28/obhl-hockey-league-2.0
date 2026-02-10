package com.obhl.gateway.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.ShiftAssignmentDTO;

@Service
public class RefereeShiftService {

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private TeamService teamService;

    /**
     * Get available games needing referees
     */
    public List<ShiftAssignmentDTO> getAvailableGames(Long seasonId) {
        return mapToShiftAssignment(gameProxyService.getAvailableRefereeGames(seasonId));
    }

    /**
     * Sign up for a referee shift
     */
    @Transactional
    public void signUpForShift(Long gameId, Long userId) {
        gameProxyService.assignReferee(gameId, userId);
    }

    /**
     * Cancel a referee shift
     */
    @Transactional
    public void cancelShift(Long gameId, Long userId) {
        gameProxyService.removeReferee(gameId, userId);
    }

    /**
     * Get referee's assigned games
     */
    public List<ShiftAssignmentDTO> getMyAssignments(Long userId) {
        return mapToShiftAssignment(gameProxyService.getRefereeAssignments(userId));
    }

    private List<ShiftAssignmentDTO> mapToShiftAssignment(List<com.obhl.gateway.dto.GameResponseDTO> games) {
        return games.stream().map(game -> {
            ShiftAssignmentDTO dto = new ShiftAssignmentDTO();
            dto.setGameId(game.getId());
            dto.setGameDate(game.getGameDate().toLocalDate());
            dto.setGameTime(game.getGameDate().toLocalTime());

            if (game.getHomeTeamId() != null) {
                teamService.getTeamById(game.getHomeTeamId())
                        .ifPresent(team -> dto.setHomeTeam(team.getName()));
            }

            if (game.getAwayTeamId() != null) {
                teamService.getTeamById(game.getAwayTeamId())
                        .ifPresent(team -> dto.setAwayTeam(team.getName()));
            }

            dto.setRole("REFEREE");
            return dto;
        }).collect(java.util.stream.Collectors.toList());
    }
}
