package com.obhl.gateway.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.ShiftAssignmentDTO;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.ScorekeeperShiftService;

@RestController
@RequestMapping("/api/v1/shifts/scorekeeper")
@PreAuthorize("hasAnyRole('SCOREKEEPER', 'ADMIN')")
@CrossOrigin(origins = "*")
public class ScorekeeperShiftController {

    @Autowired
    private ScorekeeperShiftService scorekeeperShiftService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Get available games needing scorekeepers
     */
    @GetMapping("/available")
    public ResponseEntity<List<ShiftAssignmentDTO>> getAvailableGames(@RequestParam Long seasonId) {
        List<ShiftAssignmentDTO> availableGames = scorekeeperShiftService.getAvailableGames(seasonId);
        return ResponseEntity.ok(availableGames);
    }

    /**
     * Sign up for a scorekeeper shift
     */
    @PostMapping("/{gameId}")
    public ResponseEntity<Void> signUpForShift(
            @PathVariable Long gameId,
            Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        scorekeeperShiftService.signUpForShift(gameId, user.getId());
        return ResponseEntity.ok().build();
    }

    /**
     * Cancel a scorekeeper shift
     */
    @DeleteMapping("/{gameId}")
    public ResponseEntity<Void> cancelShift(
            @PathVariable Long gameId,
            Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        scorekeeperShiftService.cancelShift(gameId, user.getId());
        return ResponseEntity.ok().build();
    }

    /**
     * Get my assigned games
     */
    @GetMapping("/my-assignments")
    public ResponseEntity<List<ShiftAssignmentDTO>> getMyAssignments(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<ShiftAssignmentDTO> assignments = scorekeeperShiftService.getMyAssignments(user.getId());
        return ResponseEntity.ok(assignments);
    }
}
