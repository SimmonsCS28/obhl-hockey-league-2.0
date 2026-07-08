package com.obhl.gateway.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.dto.GoalieUnavailabilityDTO;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.CoordinatorService;
import com.obhl.gateway.service.GoalieAvailabilityService;
import com.obhl.gateway.service.StaffAvailabilityService;

@RestController
@RequestMapping("/api/v1/coordinator")
@PreAuthorize("hasAnyRole('GOALIE_COORDINATOR', 'REF_COORDINATOR', 'SCOREKEEPER_COORDINATOR', 'ADMIN')")
public class CoordinatorController {

    @Autowired
    private CoordinatorService coordinatorService;

    @Autowired
    private StaffAvailabilityService availabilityService;

    @Autowired
    private GoalieAvailabilityService goalieAvailabilityService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/assignments")
    public ResponseEntity<?> getAssignments(@RequestParam Long seasonId, @RequestParam String role,
            @RequestParam(required = false) Integer week, Authentication auth) {
        String r = role.trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        return ResponseEntity.ok(coordinatorService.getAssignments(seasonId, r, week));
    }

    @GetMapping("/availability")
    public ResponseEntity<?> getAvailability(@RequestParam String role, Authentication auth) {
        String r = role.trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        List<GoalieUnavailabilityDTO> data = availabilityService.getAllUnavailability(r);
        return ResponseEntity.ok(data);
    }

    /** Coordinator goalie pool: each goalie's positive availability for a given week (v3). */
    @GetMapping("/goalie-availability")
    public ResponseEntity<?> getGoalieAvailability(@RequestParam Long seasonId, @RequestParam Integer week,
            Authentication auth) {
        if (!canActOn(auth, "GOALIE")) {
            return forbidden("GOALIE");
        }
        return ResponseEntity.ok(goalieAvailabilityService.getForWeek(seasonId, week));
    }

    @PostMapping("/propose")
    public ResponseEntity<?> propose(@RequestBody CoordinatorDto.ProposeRequest req, Authentication auth) {
        String r = req.getRole() == null ? "" : req.getRole().trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        try {
            Long coordinatorId = currentUserId(auth);
            return ResponseEntity.ok(coordinatorService.propose(req, coordinatorId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/assignments/{id}")
    public ResponseEntity<?> withdraw(@PathVariable Long id, @RequestParam String role, Authentication auth) {
        String r = role.trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        coordinatorService.withdraw(id);
        return ResponseEntity.ok().body(java.util.Map.of("message", "Assignment withdrawn"));
    }

    @PostMapping("/assignments/{id}/confirm")
    public ResponseEntity<?> confirmSignup(@PathVariable Long id, @RequestParam String role, Authentication auth) {
        String r = role.trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        try {
            return ResponseEntity.ok(coordinatorService.confirmSignup(id, currentUserId(auth)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/publish")
    public ResponseEntity<?> publish(@RequestParam Long seasonId, @RequestParam String role,
            @RequestParam(required = false) Integer week, Authentication auth) {
        String r = role.trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        try {
            return ResponseEntity.ok(coordinatorService.publishWeek(seasonId, r, week));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    // ---- helpers ----

    /** A coordinator may only act on its own role; ADMIN can act on any. */
    private boolean canActOn(Authentication auth, String role) {
        if (hasAuthority(auth, "ROLE_ADMIN")) {
            return true;
        }
        if ("GOALIE".equals(role)) {
            return hasAuthority(auth, "ROLE_GOALIE_COORDINATOR");
        }
        if ("REF".equals(role)) {
            return hasAuthority(auth, "ROLE_REF_COORDINATOR");
        }
        if ("SCOREKEEPER".equals(role)) {
            return hasAuthority(auth, "ROLE_SCOREKEEPER_COORDINATOR");
        }
        return false;
    }

    private boolean hasAuthority(Authentication auth, String authority) {
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if (authority.equals(ga.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    private Long currentUserId(Authentication auth) {
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    private ResponseEntity<?> forbidden(String role) {
        return ResponseEntity.status(403)
                .body(java.util.Map.of("error", "Not authorized to manage " + role + " assignments"));
    }
}
