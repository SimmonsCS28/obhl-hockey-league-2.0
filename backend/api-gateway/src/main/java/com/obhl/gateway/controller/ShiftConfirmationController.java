package com.obhl.gateway.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.ShiftConfirmationService;

/**
 * Goalie/ref responses to proposed shifts. Public token endpoints live under
 * /api/v1/auth/** (permitAll, used by the emailed links); the in-app endpoints
 * under /api/v1/shifts require authentication.
 */
@RestController
public class ShiftConfirmationController {

    @Autowired
    private ShiftConfirmationService confirmationService;

    @Autowired
    private UserRepository userRepository;

    // ---- public, token-based (emailed links) ----

    @GetMapping("/api/v1/auth/shift-confirm")
    public ResponseEntity<?> getByToken(@RequestParam Long id, @RequestParam String token) {
        try {
            return ResponseEntity.ok(confirmationService.getByToken(id, token));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/v1/auth/shift-confirm")
    public ResponseEntity<?> respondByToken(@RequestBody CoordinatorDto.TokenRespondRequest req) {
        try {
            return ResponseEntity.ok(
                    confirmationService.respondByToken(req.getId(), req.getToken(), req.getAction(), req.getReason()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    // ---- authenticated, in-app ----

    @GetMapping("/api/v1/shifts/pending")
    public ResponseEntity<?> getPending(Authentication auth) {
        Long userId = currentUserId(auth);
        return ResponseEntity.ok(confirmationService.getPendingForUser(userId));
    }

    @PostMapping("/api/v1/shifts/{id}/respond")
    public ResponseEntity<?> respondInApp(@PathVariable Long id, @RequestBody CoordinatorDto.RespondRequest req,
            Authentication auth) {
        try {
            Long userId = currentUserId(auth);
            return ResponseEntity.ok(confirmationService.respondInApp(id, userId, req.getAction(), req.getReason()));
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
