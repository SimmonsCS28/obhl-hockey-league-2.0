package com.obhl.gateway.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.GoalieAvailabilityDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.GoalieAvailabilityService;

/**
 * Self-service goalie weekly availability (v3). A goalie reads/sets their own availability;
 * the coordinator pool view lives on CoordinatorController.
 */
@RestController
@RequestMapping("/api/v1/goalie/availability")
@PreAuthorize("hasAnyRole('GOALIE', 'GOALIE_COORDINATOR', 'ADMIN')")
public class GoalieAvailabilityController {

    @Autowired
    private GoalieAvailabilityService availabilityService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getMine(@RequestParam Long seasonId, Authentication auth) {
        return ResponseEntity.ok(availabilityService.getForUser(currentUserId(auth), seasonId));
    }

    @PutMapping
    public ResponseEntity<?> setMine(@RequestBody GoalieAvailabilityDto.SetWeekRequest req, Authentication auth) {
        try {
            availabilityService.setStatus(currentUserId(auth), req.getSeasonId(), req.getWeek(), req.getStatus());
            return ResponseEntity.ok(availabilityService.getForUser(currentUserId(auth), req.getSeasonId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    private Long currentUserId(Authentication auth) {
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
