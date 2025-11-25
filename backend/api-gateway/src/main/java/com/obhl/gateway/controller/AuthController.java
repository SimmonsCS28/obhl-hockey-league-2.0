package com.obhl.gateway.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
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

    @PostMapping("/login")
    public ResponseEntity<AuthDto.LoginResponse> login(@Valid @RequestBody AuthDto.LoginRequest request) {
        try {
            AuthDto.LoginResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(null);
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        // For JWT, logout is handled client-side by removing the token
        // In future, could implement token blacklist
        return ResponseEntity.ok().body(java.util.Map.of("message", "Logged out successfully"));
    }
}
