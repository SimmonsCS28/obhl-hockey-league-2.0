package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.dto.PlayerCardDTO;
import com.obhl.gateway.service.PlayerProfileService;

/**
 * The public profile card, plus the admin's photo-moderation escape hatch.
 *
 * These are concrete mappings under /players, which PlayerProxyController otherwise
 * forwards wholesale to stats-service via "/**". Spring picks the most specific
 * pattern, so /{playerId}/card and /{playerId}/photo land here and everything else
 * still proxies. GET /players/** is permitAll in SecurityConfig; the JWT filter still
 * runs, so an authenticated viewer's identity is available for isSelf.
 */
@RestController
@RequestMapping("${api.v1.prefix}/players")
public class PlayerCardController {

    private final PlayerProfileService profileService;

    public PlayerCardController(PlayerProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping("/{playerId}/card")
    public ResponseEntity<PlayerCardDTO> getCard(@PathVariable Long playerId, Authentication auth) {
        return ResponseEntity.ok(profileService.getCard(playerId, auth));
    }

    /** Moderation: remove a player's photo. Idempotent — 204 even if there was none. */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{playerId}/photo")
    public ResponseEntity<Void> adminDeletePhoto(@PathVariable Long playerId) {
        profileService.adminDeletePhoto(playerId);
        return ResponseEntity.noContent().build();
    }

    /** Same shape as HighlightController: the reason text under "error", which api.js reads. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException ex) {
        String reason = ex.getReason() == null ? "Request failed." : ex.getReason();
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", reason));
    }
}
