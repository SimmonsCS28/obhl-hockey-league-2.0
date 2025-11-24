package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class RootController {

    @Value("${api.version}")
    private String version;

    @Value("${api.v1.prefix}")
    private String apiV1Prefix;

    @Value("${app.environment}")
    private String environment;

    @GetMapping("/")
    public ResponseEntity<Map<String, String>> root() {
        return ResponseEntity.ok(Map.of(
                "message", "Welcome to OBHL API Gateway",
                "version", version,
                "docs", "/swagger-ui.html",
                "health", apiV1Prefix + "/health"));
    }

    @GetMapping("${api.v1.prefix}/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "version", version,
                "environment", environment,
                "database", "connected"));
    }
}
