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
import com.obhl.gateway.service.RefereeShiftService;

@RestController
@RequestMapping("/api/v1/shifts/referee")
@PreAuthorize("hasAnyRole('REF', 'ADMIN')")
@CrossOrigin(origins = "*")
public class RefereeShiftController {

    @Autowired
    private RefereeShiftService refereeShiftService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Get available games needing referees
     */
    @GetMapping("/available")
    public ResponseEntity<List<ShiftAssignmentDTO>> getAvailableGames(@RequestParam Long seasonId) {
        List<ShiftAssignmentDTO> availableGames = refereeShiftService.getAvailableGames(seasonId);
        return ResponseEntity.ok(availableGames);
    }

    /**
     * Sign up for a referee shift
     */
    @PostMapping("/{gameId}")
    public ResponseEntity<Void> signUpForShift(
            @PathVariable Long gameId,
            Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        refereeShiftService.signUpForShift(gameId, user.getId());
        return ResponseEntity.ok().build();
    }

    /**
     * Cancel a referee shift
     */
    @DeleteMapping("/{gameId}")
    public ResponseEntity<Void> cancelShift(
            @PathVariable Long gameId,
            Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        refereeShiftService.cancelShift(gameId, user.getId());
        return ResponseEntity.ok().build();
    }

    /**
     * Get my assigned games
     */
    @GetMapping("/my-assignments")
    public ResponseEntity<List<ShiftAssignmentDTO>> getMyAssignments(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<ShiftAssignmentDTO> assignments = refereeShiftService.getMyAssignments(user.getId());
        return ResponseEntity.ok(assignments);
    }
}
