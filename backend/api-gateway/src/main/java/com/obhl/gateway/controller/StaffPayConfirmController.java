package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.StaffPayDto;
import com.obhl.gateway.service.StaffPayService;

/**
 * Public, token-based endpoints behind the "confirm your pay total" email links. Lives under
 * {@code /api/v1/auth/} because that prefix is open in SecurityConfig, like the shift-confirm
 * links; the token in the URL is the only credential.
 */
@RestController
public class StaffPayConfirmController {

    @Autowired
    private StaffPayService staffPayService;

    @GetMapping("/api/v1/auth/pay-confirm")
    public ResponseEntity<?> getByToken(@RequestParam Long id, @RequestParam String token) {
        try {
            return ResponseEntity.ok(staffPayService.getLineByToken(id, token));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/v1/auth/pay-confirm")
    public ResponseEntity<?> respondByToken(@RequestBody StaffPayDto.TokenRespondRequest req) {
        try {
            return ResponseEntity.ok(
                    staffPayService.respondByToken(req.getId(), req.getToken(), req.getAction(), req.getNote()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
