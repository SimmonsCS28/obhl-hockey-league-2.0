package com.obhl.gateway.controller;

import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.obhl.gateway.service.SeasonRecapService;

@RestController
public class SeasonRecapController {
    private final SeasonRecapService recaps;
    public SeasonRecapController(SeasonRecapService recaps) { this.recaps = recaps; }

    // More specific than SeasonProxyController's wildcard. Existing season GET security permits public access.
    @GetMapping("/api/v1/seasons/{id}/recap")
    public SeasonRecapService.Recap recap(@PathVariable long id) { return recaps.get(id); }

    @PostMapping("/api/v1/seasons/{id}/recap/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public SeasonRecapService.Recap generate(@PathVariable long id, Authentication auth) {
        return recaps.generate(id, auth.getName());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> error(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
    }
}
