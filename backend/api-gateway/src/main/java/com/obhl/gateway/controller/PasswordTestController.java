package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/auth")
@RequiredArgsConstructor
public class PasswordTestController {

    private final PasswordEncoder passwordEncoder;

    @PostMapping("/hash-password")
    public ResponseEntity<?> hashPassword(@RequestBody Map<String, String> request) {
        String password = request.get("password");
        String hash = passwordEncoder.encode(password);

        return ResponseEntity.ok(Map.of(
                "password", password,
                "hash", hash,
                "sql", "UPDATE users SET password_hash = '" + hash + "' WHERE username = 'simmonscs28@gmail.com';"));
    }

    @PostMapping("/test-match")
    public ResponseEntity<?> testMatch(@RequestBody Map<String, String> request) {
        String password = request.get("password");
        String hash = request.get("hash");
        boolean matches = passwordEncoder.matches(password, hash);

        return ResponseEntity.ok(Map.of(
                "password", password,
                "hash", hash,
                "matches", matches));
    }
}
