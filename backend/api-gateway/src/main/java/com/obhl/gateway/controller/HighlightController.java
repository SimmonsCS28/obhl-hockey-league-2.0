package com.obhl.gateway.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.dto.HighlightDTO;
import com.obhl.gateway.dto.HighlightUpdateDTO;
import com.obhl.gateway.service.HighlightService;

import lombok.RequiredArgsConstructor;

/**
 * Weekly video highlights.
 *
 * This feature is owned by the gateway rather than proxied to league-service
 * because the gateway's proxy controllers read request bodies as String, which
 * corrupts multipart uploads (see TECHNICAL_DEBT.md). Being the origin of the
 * request sidesteps that entirely.
 *
 * Note there is no mapping here for /media/** — that path is served by
 * MediaResourceConfig's resource handler so it gets Range support for free.
 */
@RestController
@RequestMapping("${api.v1.prefix}/highlights")
@RequiredArgsConstructor
public class HighlightController {

    private final HighlightService highlightService;

    /** Public — what the home page renders. 204 when nothing is posted. */
    @GetMapping("/current")
    public ResponseEntity<HighlightDTO> getCurrent() {
        return highlightService.getCurrent()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /**
     * The archive listing. Public, but a non-admin only ever sees active highlights:
     * "hidden" has to actually mean hidden, so activeOnly=false is quietly forced back
     * to true for anyone without the ADMIN role rather than 403-ing a public reader.
     */
    @GetMapping
    public ResponseEntity<List<HighlightDTO>> getHighlights(
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly,
            Authentication auth) {
        boolean isAdmin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return ResponseEntity.ok(highlightService.getHighlights(activeOnly || !isAdmin));
    }

    // Admins only
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<HighlightDTO> createHighlight(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "poster", required = false) MultipartFile poster,
            @RequestParam("title") String title,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) Long seasonId,
            @RequestParam(required = false) Integer week,
            @RequestParam(required = false) String youtubeUrl,
            @RequestParam(required = false) Boolean isActive,
            Authentication auth) {
        HighlightUpdateDTO meta = new HighlightUpdateDTO(title, description, seasonId, week, youtubeUrl, isActive);
        HighlightDTO created = highlightService.create(file, poster, meta, auth.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // Admins only — metadata edit; the video itself is not replaceable in place.
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<HighlightDTO> updateHighlight(
            @PathVariable Long id,
            @RequestBody HighlightUpdateDTO dto) {
        return ResponseEntity.ok(highlightService.update(id, dto));
    }

    // Admins only
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/toggle")
    public ResponseEntity<HighlightDTO> toggleActive(
            @PathVariable Long id,
            @RequestParam boolean active) {
        return ResponseEntity.ok(highlightService.toggleActive(id, active));
    }

    // Admins only
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHighlight(@PathVariable Long id) {
        highlightService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Surfaces the reason text from the validation failures thrown by
     * HighlightStorageService ("Only .mp4 video files are supported", "Video is too
     * large (140MB)…"). Spring's default error body carries only "Bad Request" unless
     * server.error.include-message=always, and that property is global — this handler
     * keeps the fix scoped to this controller instead of changing the error shape of
     * every other endpoint in the gateway.
     *
     * The key is "error" because that is what api.js's request() reads first.
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleValidation(ResponseStatusException ex) {
        String reason = ex.getReason() == null ? "Request failed." : ex.getReason();
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", reason));
    }

    /**
     * A file larger than spring.servlet.multipart.max-request-size is rejected by the
     * container before any controller code runs, so the size check in the storage
     * service never sees it. Without this the admin gets an opaque 500.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("error", "That file is too large to upload. The limit is 100 MB."));
    }
}
