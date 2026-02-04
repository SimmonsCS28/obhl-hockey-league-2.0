package com.obhl.gateway.controller;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.ShiftAssignmentDTO;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.GoalieShiftService;
import com.obhl.gateway.service.RefereeShiftService;
import com.obhl.gateway.service.ScorekeeperShiftService;

@RestController
@RequestMapping("/api/v1/shifts")
@PreAuthorize("hasAnyRole('GOALIE', 'REF', 'SCOREKEEPER', 'ADMIN')")
@CrossOrigin(origins = "*")
public class ShiftController {

    @Autowired
    private GoalieShiftService goalieShiftService;

    @Autowired
    private RefereeShiftService refereeShiftService;

    @Autowired
    private ScorekeeperShiftService scorekeeperShiftService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Get all shifts for current user across all roles
     */
    @GetMapping("/my-shifts")
    public ResponseEntity<List<ShiftAssignmentDTO>> getMyShifts(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<ShiftAssignmentDTO> allShifts = new ArrayList<>();

        // Check if user has GOALIE role
        if (user.getRoles().stream().anyMatch(role -> role.getName().equals("GOALIE"))) {
            allShifts.addAll(goalieShiftService.getMyAssignments(user.getId()));
        }

        // Check if user has REF role
        if (user.getRoles().stream().anyMatch(role -> role.getName().equals("REF"))) {
            allShifts.addAll(refereeShiftService.getMyAssignments(user.getId()));
        }

        // Check if user has SCOREKEEPER role
        if (user.getRoles().stream().anyMatch(role -> role.getName().equals("SCOREKEEPER"))) {
            allShifts.addAll(scorekeeperShiftService.getMyAssignments(user.getId()));
        }

        return ResponseEntity.ok(allShifts);
    }
}
