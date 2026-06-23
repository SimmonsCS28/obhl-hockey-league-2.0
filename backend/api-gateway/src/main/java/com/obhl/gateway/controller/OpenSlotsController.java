package com.obhl.gateway.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.OpenSlotsService;

/**
 * Self-service shift sign-up for officials (refs/scorekeepers) and the coordinator/admin who
 * browse the same board. Goalies are excluded (coordinator-assign only) at the service level.
 */
@RestController
@RequestMapping("/api/v1")
@PreAuthorize("hasAnyRole('REF', 'SCOREKEEPER', 'REF_COORDINATOR', 'GOALIE_COORDINATOR', 'SCOREKEEPER_COORDINATOR', 'ADMIN')")
public class OpenSlotsController {

    @Autowired
    private OpenSlotsService openSlotsService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/open-slots")
    public ResponseEntity<?> getOpenSlots(@RequestParam String role, @RequestParam Long seasonId,
            @RequestParam(required = false) Integer week, Authentication auth) {
        try {
            return ResponseEntity.ok(openSlotsService.getOpenSlots(role, seasonId, week, currentUserId(auth)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/slots/{slotId}/signup")
    public ResponseEntity<?> signup(@PathVariable String slotId, Authentication auth) {
        try {
            return ResponseEntity.ok(openSlotsService.signup(slotId, currentUserId(auth)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/slots/{slotId}/signup")
    public ResponseEntity<?> dropSignup(@PathVariable String slotId, Authentication auth) {
        try {
            openSlotsService.removeSignup(slotId, currentUserId(auth));
            return ResponseEntity.ok(java.util.Map.of("message", "Sign-up removed"));
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
