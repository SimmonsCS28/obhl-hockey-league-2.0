package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.service.UserManagementService;

import lombok.Data;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/auth")
@RequiredArgsConstructor
public class PasswordResetController {

    private final UserManagementService userManagementService;

    @GetMapping("/security-question")
    public ResponseEntity<Map<String, String>> getSecurityQuestion(@RequestParam String username) {
        try {
            String question = userManagementService.getSecurityQuestion(username);
            return ResponseEntity.ok(Map.of("question", question));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody ResetPasswordRequest request) {
        try {
            userManagementService.verifyAndResetPassword(
                    request.getUsername(),
                    request.getAnswer(),
                    request.getNewPassword());
            return ResponseEntity.ok(Map.of("message", "Password reset successfully."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @Data
    public static class ResetPasswordRequest {
        private String username;
        private String answer;
        private String newPassword;
    }
}
