package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.dto.PlayerProfileDTO;
import com.obhl.gateway.dto.PlayerProfileUpdateDTO;
import com.obhl.gateway.service.PlayerProfileService;

import jakarta.validation.Valid;

/**
 * A player's own profile: the five person-level fields and the photo.
 *
 * Lives under /user/... (next to /user/dashboard) rather than /players/me/... — the
 * latter would have to fight PlayerProxyController's "/**" and a {playerId} Long
 * parse for the same path. Everything here is authenticated by SecurityConfig's
 * anyRequest() rule; ownership is resolved inside the service from the JWT username,
 * never from a client-supplied id.
 *
 * The photo endpoint is multipart and therefore MUST be native to the gateway — the
 * proxy controllers read bodies as String and destroy multipart (TECHNICAL_DEBT #1).
 */
@RestController
@RequestMapping("${api.v1.prefix}/user/player-profile")
public class PlayerProfileController {

    private final PlayerProfileService profileService;

    public PlayerProfileController(PlayerProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ResponseEntity<PlayerProfileDTO> getMine(Authentication auth) {
        return ResponseEntity.ok(profileService.getOwnProfile(auth));
    }

    @PutMapping
    public ResponseEntity<PlayerProfileDTO> updateMine(@Valid @RequestBody PlayerProfileUpdateDTO dto, Authentication auth) {
        return ResponseEntity.ok(profileService.updateOwnProfile(auth, dto));
    }

    @PostMapping(value = "/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PlayerProfileDTO> uploadPhoto(@RequestPart("file") MultipartFile file, Authentication auth) {
        return ResponseEntity.ok(profileService.uploadOwnPhoto(auth, file));
    }

    @DeleteMapping("/photo")
    public ResponseEntity<Void> deletePhoto(Authentication auth) {
        profileService.deleteOwnPhoto(auth);
        return ResponseEntity.noContent().build();
    }

    /** Reason text under "error" — the key api.js's request() reads. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException ex) {
        String reason = ex.getReason() == null ? "Request failed." : ex.getReason();
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", reason));
    }

    /** Bean-validation failures on the PUT body: first field message, plus a per-field map for inline display. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleInvalid(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new java.util.LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(fe.getField(), fe.getDefaultMessage() == null ? "Invalid value." : fe.getDefaultMessage());
        }
        String first = fields.isEmpty() ? "Please check the form." : fields.values().iterator().next();
        return ResponseEntity.badRequest().body(Map.of("error", first, "fields", fields));
    }

    /**
     * The container rejects anything over spring.servlet.multipart.max-request-size
     * (100 MB, sized for highlight videos) before the 5 MB photo check ever runs.
     * Say the limit that applies to THIS upload.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("error", com.obhl.gateway.service.ProfilePhotoProcessor.ERR_SIZE));
    }
}
