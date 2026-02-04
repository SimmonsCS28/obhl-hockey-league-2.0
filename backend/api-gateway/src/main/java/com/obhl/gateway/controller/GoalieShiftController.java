package com.obhl.gateway.controller;

import java.time.LocalDate;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.GameDayDTO;
import com.obhl.gateway.dto.GoalieAvailabilityRequest;
import com.obhl.gateway.dto.ShiftAssignmentDTO;
import com.obhl.gateway.model.GoalieProfile;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.GoalieShiftService;

@RestController
@RequestMapping("/api/v1/shifts/goalie")
@PreAuthorize("hasAnyRole('GOALIE', 'ADMIN')")
@CrossOrigin(origins = "*")
public class GoalieShiftController {

    @Autowired
    private GoalieShiftService goalieShiftService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Get all game days for current season
     */
    @GetMapping("/game-days")
    public ResponseEntity<List<GameDayDTO>> getGameDays(@RequestParam Long seasonId) {
        List<GameDayDTO> gameDays = goalieShiftService.getGameDays(seasonId);
        return ResponseEntity.ok(gameDays);
    }

    /**
     * Get my unavailable dates
     */
    @GetMapping("/my-availability")
    public ResponseEntity<List<LocalDate>> getMyAvailability(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<LocalDate> unavailableDates = goalieShiftService.getMyUnavailability(user.getId());
        return ResponseEntity.ok(unavailableDates);
    }

    /**
     * Mark dates as unavailable
     */
    @PostMapping("/unavailable")
    public ResponseEntity<Void> markUnavailable(
            @RequestBody GoalieAvailabilityRequest request,
            Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        goalieShiftService.markUnavailable(user.getId(), request);
        return ResponseEntity.ok().build();
    }

    /**
     * Remove unavailable date
     */
    @DeleteMapping("/unavailable/{date}")
    public ResponseEntity<Void> removeUnavailableDate(
            @PathVariable String date,
            Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        LocalDate localDate = LocalDate.parse(date);
        goalieShiftService.removeUnavailableDate(user.getId(), localDate);
        return ResponseEntity.ok().build();
    }

    /**
     * Get my assigned games
     */
    @GetMapping("/my-assignments")
    public ResponseEntity<List<ShiftAssignmentDTO>> getMyAssignments(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<ShiftAssignmentDTO> assignments = goalieShiftService.getMyAssignments(user.getId());
        return ResponseEntity.ok(assignments);
    }

    /**
     * Get my goalie profile
     */
    @GetMapping("/my-profile")
    public ResponseEntity<GoalieProfile> getMyProfile(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        GoalieProfile profile = goalieShiftService.getOrCreateProfile(user.getId());
        return ResponseEntity.ok(profile);
    }
}
