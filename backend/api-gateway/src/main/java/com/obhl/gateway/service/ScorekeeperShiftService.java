package com.obhl.gateway.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.ShiftAssignmentDTO;

@Service
public class ScorekeeperShiftService {

    @Autowired
    private GameProxyService gameProxyService;

    /**
     * Get available games needing scorekeepers
     */
    public List<ShiftAssignmentDTO> getAvailableGames(Long seasonId) {
        return gameProxyService.getAvailableScorekeeperGames(seasonId);
    }

    /**
     * Sign up for a scorekeeper shift
     */
    @Transactional
    public void signUpForShift(Long gameId, Long userId) {
        gameProxyService.assignScorekeeper(gameId, userId);
    }

    /**
     * Cancel a scorekeeper shift
     */
    @Transactional
    public void cancelShift(Long gameId, Long userId) {
        gameProxyService.removeScorekeeper(gameId, userId);
    }

    /**
     * Get scorekeeper's assigned games
     */
    public List<ShiftAssignmentDTO> getMyAssignments(Long userId) {
        return gameProxyService.getScorekeeperAssignments(userId);
    }
}
