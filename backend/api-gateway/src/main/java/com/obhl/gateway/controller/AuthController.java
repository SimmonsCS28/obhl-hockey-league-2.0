package com.obhl.gateway.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.AuthDto;
import com.obhl.gateway.service.AuthService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final com.obhl.gateway.util.JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthDto.LoginRequest request) {
        try {
            AuthDto.LoginResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401)
                    .body(java.util.Map.of("error", "Username or password is incorrect"));
        }
    }

    @PostMapping("/logout")

    public ResponseEntity<?> logout() {
        // For JWT, logout is handled client-side by removing the token
        // In future, could implement token blacklist
        return ResponseEntity.ok().body(java.util.Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @Valid @RequestBody AuthDto.ChangePasswordRequest request,
            @org.springframework.web.bind.annotation.RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String username = jwtUtil.extractUsername(token);
            com.obhl.gateway.model.User user = authService.getUserByUsername(username);

            authService.changePassword(user.getId(), request);
            return ResponseEntity.ok().body(java.util.Map.of("message", "Password changed successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(
            @org.springframework.web.bind.annotation.RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String username = jwtUtil.extractUsername(token);
            com.obhl.gateway.model.User user = authService.getUserByUsername(username);

            return ResponseEntity.ok(authService.getProfile(user.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @Valid @RequestBody AuthDto.UpdateProfileRequest request,
            @org.springframework.web.bind.annotation.RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String username = jwtUtil.extractUsername(token);
            com.obhl.gateway.model.User user = authService.getUserByUsername(username);

            AuthDto.UpdateProfileResponse response = authService.updateProfile(user.getId(), request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }
}
