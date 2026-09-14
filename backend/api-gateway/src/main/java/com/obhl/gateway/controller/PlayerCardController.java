package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpStatus;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import jakarta.validation.Valid;
import com.obhl.gateway.dto.PlayerProfileDTO;
import com.obhl.gateway.dto.PlayerProfileUpdateDTO;
import com.obhl.gateway.service.ProfilePhotoProcessor;
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

    /**
     * Moderation index: which people have a photo, keyed by lowercased email. Concrete
     * mapping, so it wins over the proxy's /** like the other two routes here. ADMIN only —
     * it is an email-keyed listing.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/photos")
    public ResponseEntity<Map<String, String>> photoIndex() {
        return ResponseEntity.ok(profileService.photoIndex());
    }

    // ── Admin edit of any player's profile. Same service logic as the self-service path,
    // resolved from the row instead of the JWT; the dashboard-avatar preference is excluded.

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{playerId}/profile")
    public ResponseEntity<PlayerProfileDTO> adminGetProfile(@PathVariable Long playerId) {
        return ResponseEntity.ok(profileService.getProfileForRow(playerId));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{playerId}/profile")
    public ResponseEntity<PlayerProfileDTO> adminUpdateProfile(@PathVariable Long playerId,
            @Valid @RequestBody PlayerProfileUpdateDTO dto) {
        return ResponseEntity.ok(profileService.updateProfileForRow(playerId, dto));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/{playerId}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PlayerProfileDTO> adminUploadPhoto(@PathVariable Long playerId,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(profileService.uploadPhotoForRow(playerId, file));
    }

    /** Moderation: remove a player's photo. Idempotent — 204 even if there was none. */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{playerId}/photo")
    public ResponseEntity<Void> adminDeletePhoto(@PathVariable Long playerId) {
        profileService.adminDeletePhoto(playerId);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleInvalid(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new java.util.LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(fe.getField(), fe.getDefaultMessage() == null ? "Invalid value." : fe.getDefaultMessage());
        }
        String first = fields.isEmpty() ? "Please check the form." : fields.values().iterator().next();
        return ResponseEntity.badRequest().body(Map.of("error", first, "fields", fields));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error", ProfilePhotoProcessor.ERR_SIZE));
    }

    /** Same shape as HighlightController: the reason text under "error", which api.js reads. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException ex) {
        String reason = ex.getReason() == null ? "Request failed." : ex.getReason();
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", reason));
    }
}
