package com.obhl.gateway.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.NotificationPrefDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.NotificationOptOutService;

/**
 * Subscribe/unsubscribe for broadcast emails (goalie open-spot alerts).
 *
 * <p>The token endpoints live under {@code /api/v1/auth/**} (permitAll) because they are reached
 * from an email by people who may not have a working login. Authorisation is the signed link itself.
 * The in-app endpoints under {@code /api/v1/email-alerts} act on the authenticated user only.
 */
@RestController
public class EmailAlertsController {

    @Autowired
    private NotificationOptOutService optOutService;

    @Autowired
    private UserRepository userRepository;

    // ---- public, signed-link (from the email footer) ----

    @GetMapping("/api/v1/auth/email-alerts")
    public ResponseEntity<?> statusByToken(@RequestParam Long u, @RequestParam String k, @RequestParam String t) {
        try {
            return ResponseEntity.ok(optOutService.statusByToken(u, k, t));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @PostMapping("/api/v1/auth/email-alerts")
    public ResponseEntity<?> setByToken(@RequestBody NotificationPrefDto.TokenUpdateRequest req) {
        try {
            return ResponseEntity.ok(optOutService.setByToken(req.getU(), req.getK(), req.getT(), req.isSubscribed()));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    /**
     * RFC 8058 one-click target for the {@code List-Unsubscribe} header. Mail clients POST here with
     * a form body of {@code List-Unsubscribe=One-Click} and no other context, so the answer is always
     * "unsubscribe" and the response body is irrelevant — only the 2xx matters.
     */
    @PostMapping("/api/v1/auth/email-alerts/one-click")
    public ResponseEntity<?> oneClick(@RequestParam Long u, @RequestParam String k, @RequestParam String t) {
        try {
            optOutService.setByToken(u, k, t, false);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    // ---- authenticated (Account Settings) ----

    @GetMapping("/api/v1/email-alerts")
    public ResponseEntity<?> mine(Authentication auth) {
        return ResponseEntity.ok(optOutService.getMine(currentUser(auth)));
    }

    @PutMapping("/api/v1/email-alerts")
    public ResponseEntity<?> setMine(@RequestBody NotificationPrefDto.UpdateRequest req, Authentication auth) {
        try {
            return ResponseEntity.ok(optOutService.setMine(currentUser(auth), req.getKind(), req.isSubscribed()));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    private User currentUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private ResponseEntity<?> badRequest(RuntimeException e) {
        String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        return ResponseEntity.badRequest().body(java.util.Map.of("error", msg));
    }
}
