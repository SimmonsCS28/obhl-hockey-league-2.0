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
import com.obhl.gateway.service.GoalieProposerService;
import com.obhl.gateway.service.StaffAvailabilityService;

@RestController
@RequestMapping("/api/v1/coordinator")
@PreAuthorize("hasAnyRole('GOALIE_COORDINATOR', 'REF_COORDINATOR', 'SCOREKEEPER_COORDINATOR', 'ADMIN')")
public class CoordinatorController {

    @Autowired
    private CoordinatorService coordinatorService;

    @Autowired
    private GoalieProposerService goalieProposerService;

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

    /**
     * Which team each staff member plays for this season, so the console can flag assigning someone
     * to a game their own team is in. Returns an entry for every user of the role — unresolved ones
     * carry {@code resolved=false} rather than being omitted, which is what lets the console tell
     * "we don't know" apart from "no conflict".
     */
    @GetMapping("/staff-teams")
    public ResponseEntity<?> getStaffTeams(@RequestParam Long seasonId, @RequestParam String role,
            Authentication auth) {
        String r = role.trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        try {
            return ResponseEntity.ok(coordinatorService.getStaffTeams(seasonId, r));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
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
            return badRequest(e);
        }
    }

    /** Auto-propose full-time goalies into a single week's open goalie slots (AUTO_PROPOSED, no email). */
    @PostMapping("/goalie/auto-propose")
    public ResponseEntity<?> autoProposeGoalies(@RequestParam Long seasonId, @RequestParam Integer week,
            Authentication auth) {
        if (!canActOn(auth, "GOALIE")) {
            return forbidden("GOALIE");
        }
        try {
            return ResponseEntity.ok(goalieProposerService.autoPropose(seasonId, week, currentUserId(auth)));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    /** The season's goalie roster split full-time vs substitute (drives the picker's "Add a Substitute"). */
    @GetMapping("/goalie/season-roster")
    public ResponseEntity<?> seasonGoalieRoster(@RequestParam Long seasonId, Authentication auth) {
        if (!canActOn(auth, "GOALIE")) {
            return forbidden("GOALIE");
        }
        return ResponseEntity.ok(goalieProposerService.getSeasonRoster(seasonId));
    }

    /** Send Email A (confirm-your-time) for the week's auto-proposed goalie slots (AUTO_PROPOSED -> PROPOSED). */
    @PostMapping("/goalie/send-confirmations")
    public ResponseEntity<?> sendGoalieConfirmations(@RequestParam Long seasonId, @RequestParam Integer week,
            Authentication auth) {
        if (!canActOn(auth, "GOALIE")) {
            return forbidden("GOALIE");
        }
        try {
            return ResponseEntity.ok(goalieProposerService.sendConfirmations(seasonId, week, currentUserId(auth)));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @DeleteMapping("/assignments/{id}")
    public ResponseEntity<?> withdraw(@PathVariable Long id, @RequestParam String role, Authentication auth) {
        String r = role.trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        return ResponseEntity.ok(coordinatorService.withdraw(id, currentUserId(auth)));
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
            return badRequest(e);
        }
    }

    /** Testing aid (dev UI only): force a slot to CONFIRMED/DECLINED, simulating the goalie's email response. */
    @PostMapping("/assignments/{id}/simulate")
    public ResponseEntity<?> simulate(@PathVariable Long id, @RequestParam String action,
            @RequestParam String role, Authentication auth) {
        String r = role.trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        try {
            return ResponseEntity.ok(coordinatorService.simulateResponse(id, action));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    /** Admin-only: assign a staff member to a slot bypassing propose/confirm/publish. */
    @PostMapping("/admin-assign")
    public ResponseEntity<?> adminAssign(@RequestBody CoordinatorDto.AdminAssignRequest req, Authentication auth) {
        if (!hasAuthority(auth, "ROLE_ADMIN")) {
            return ResponseEntity.status(403).body(java.util.Map.of("error", "Admin only"));
        }
        try {
            Long adminId = currentUserId(auth);
            CoordinatorDto.AssignmentView view = coordinatorService.adminDirectAssign(
                    req.getGameId(), req.getRole(), req.getSlot(), req.getUserId(), adminId);
            return ResponseEntity.ok(view != null ? view : java.util.Map.of("message", "Assignment cleared"));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    /** Swap the two goalie slots in a matchup (moves goalies + their status; no email, no re-confirm). */
    @PostMapping("/goalie/swap")
    public ResponseEntity<?> swapGoalie(@RequestParam Long gameId, Authentication auth) {
        if (!canActOn(auth, "GOALIE")) {
            return forbidden("GOALIE");
        }
        try {
            return ResponseEntity.ok(coordinatorService.swapGoalieSlots(gameId));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    /**
     * Publish confirmed assignments. Scope narrows season → week → single game, so one late change
     * can go out on its own. {@code dryRun=true} returns the same plan without writing or emailing,
     * which is what the console's confirm panel shows before anything is sent.
     */
    @PostMapping("/publish")
    public ResponseEntity<?> publish(@RequestParam Long seasonId, @RequestParam String role,
            @RequestParam(required = false) Integer week,
            @RequestParam(required = false) Long gameId,
            @RequestParam(required = false, defaultValue = "false") boolean dryRun,
            Authentication auth) {
        String r = role.trim().toUpperCase();
        if (!canActOn(auth, r)) {
            return forbidden(r);
        }
        try {
            return ResponseEntity.ok(coordinatorService.publish(seasonId, r, week, gameId, dryRun));
        } catch (RuntimeException e) {
            return badRequest(e);
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

    /**
     * 400 with the exception's message. Falls back to the exception type when the message is null —
     * {@code Map.of} rejects null values, so building the body naively turns any null-message
     * failure (an NPE, say) into an opaque 500 and throws the real cause away.
     */
    private ResponseEntity<?> badRequest(RuntimeException e) {
        String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        return ResponseEntity.badRequest().body(java.util.Map.of("error", msg));
    }
}
