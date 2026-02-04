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

    /**
     * Get available games needing referees
     */
    public List<ShiftAssignmentDTO> getAvailableGames(Long seasonId) {
        return gameProxyService.getAvailableRefereeGames(seasonId);
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
        return gameProxyService.getRefereeAssignments(userId);
    }
}
