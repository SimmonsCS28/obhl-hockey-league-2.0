package com.obhl.gateway.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.StaffAvailabilityService;

/**
 * Self-service availability for staff (referees now). The current user marks the
 * dates they're NOT available for the given role; coordinators read this when
 * proposing shifts. Goalies have their own dedicated endpoints already.
 */
@RestController
@RequestMapping("/api/v1/staff/availability")
public class StaffAvailabilityController {

    @Autowired
    private StaffAvailabilityService availabilityService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<LocalDate>> getMyUnavailability(@RequestParam String role, Authentication auth) {
        Long userId = currentUserId(auth);
        return ResponseEntity.ok(availabilityService.getMyUnavailability(userId, role.trim().toUpperCase()));
    }

    @PostMapping
    public ResponseEntity<?> markUnavailable(@RequestParam String role,
            @RequestBody CoordinatorDto.AvailabilityRequest req, Authentication auth) {
        Long userId = currentUserId(auth);
        availabilityService.markUnavailable(userId, role.trim().toUpperCase(), req.getDates());
        return ResponseEntity.ok().body(java.util.Map.of("message", "Availability updated"));
    }

    @DeleteMapping
    public ResponseEntity<?> removeUnavailable(@RequestParam String role,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date, Authentication auth) {
        Long userId = currentUserId(auth);
        availabilityService.removeUnavailable(userId, role.trim().toUpperCase(), date);
        return ResponseEntity.ok().body(java.util.Map.of("message", "Availability updated"));
    }

    private Long currentUserId(Authentication auth) {
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
