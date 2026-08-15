package com.obhl.gateway.controller;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.ShiftAssignmentDTO;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.CoordinatorService;
import com.obhl.gateway.service.GoalieShiftService;
import com.obhl.gateway.service.RefereeShiftService;
import com.obhl.gateway.service.ScorekeeperShiftService;
import com.obhl.gateway.service.ShiftConfirmationService;

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

    @Autowired
    private ShiftConfirmationService shiftConfirmationService;

    @Autowired
    private CoordinatorService coordinatorService;

    /**
     * Every shift this person currently holds, at any stage, for every role.
     *
     * <p>Distinct from {@code /my-shifts}, which derives from the game's staff columns and therefore
     * only ever shows <em>published</em> work. This reads the assignments themselves, so a shift the
     * person has confirmed but which hasn't been published yet still appears — and goalies, who never
     * self-sign and so have no open-slot rows, finally see their commitments at all.
     */
    @GetMapping("/my-assignments")
    public ResponseEntity<?> getMyAssignments(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(shiftConfirmationService.getMyAssignments(user.getId()));
    }

    /**
     * Give up a shift you had confirmed or signed up for. Unpublishes the slot and tells the
     * coordinator; you are not emailed, since you are the one doing it.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> dropOwnShift(@PathVariable Long id, Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        try {
            return ResponseEntity.ok(coordinatorService.dropOwnShift(id, user.getId()));
        } catch (RuntimeException e) {
            String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            return ResponseEntity.badRequest().body(java.util.Map.of("error", msg));
        }
    }

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
