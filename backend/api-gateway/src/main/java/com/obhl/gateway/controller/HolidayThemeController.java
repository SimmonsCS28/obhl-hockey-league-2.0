package com.obhl.gateway.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.AppSettingsService;

/**
 * Public-site holiday theme schedule. The frontend owns the calendar (default windows, Easter
 * math, which theme wins an overlap); this only stores the admin's master switch and their
 * per-holiday overrides as an opaque JSON object. GET is public because every visitor's
 * PublicLayout needs it to decide what to render.
 */
@RestController
@RequestMapping("/api/v1/holiday-theme")
public class HolidayThemeController {

    private static final String MODE_AUTO = "auto";
    private static final String MODE_OFF = "off";

    @Autowired
    private AppSettingsService appSettingsService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<?> get() {
        return ResponseEntity.ok(current());
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> save(@RequestBody Map<String, Object> body, Authentication auth) {
        Object mode = body.get("mode");
        if (!MODE_AUTO.equals(mode) && !MODE_OFF.equals(mode)) {
            return ResponseEntity.badRequest().body(Map.of("error", "mode must be 'auto' or 'off'."));
        }
        Object overrides = body.get("overrides");
        if (overrides != null && !(overrides instanceof Map)) {
            return ResponseEntity.badRequest().body(Map.of("error", "overrides must be an object."));
        }
        String overridesJson;
        try {
            overridesJson = objectMapper.writeValueAsString(overrides == null ? Map.of() : overrides);
        } catch (JsonProcessingException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "overrides could not be saved."));
        }
        Long userId = currentUserId(auth);
        appSettingsService.set(AppSettingsService.HOLIDAY_THEME_MODE, (String) mode, userId);
        appSettingsService.set(AppSettingsService.HOLIDAY_THEME_OVERRIDES, overridesJson, userId);
        return ResponseEntity.ok(current());
    }

    private Map<String, Object> current() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("mode", appSettingsService.get(AppSettingsService.HOLIDAY_THEME_MODE).orElse(MODE_AUTO));
        JsonNode overrides = objectMapper.createObjectNode();
        String raw = appSettingsService.get(AppSettingsService.HOLIDAY_THEME_OVERRIDES).orElse(null);
        if (raw != null) {
            try {
                JsonNode parsed = objectMapper.readTree(raw);
                if (parsed.isObject()) overrides = parsed;
            } catch (JsonProcessingException e) {
                // A corrupt value falls back to the defaults rather than breaking the public site.
            }
        }
        out.put("overrides", overrides);
        return out;
    }

    private Long currentUserId(Authentication auth) {
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
