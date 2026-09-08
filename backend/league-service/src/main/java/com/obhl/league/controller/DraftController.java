package com.obhl.league.controller;

import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.league.dto.DraftStateDTO;
import com.obhl.league.model.DraftSave;
import com.obhl.league.service.DraftService;
import com.obhl.league.service.DraftShareService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/draft")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "*", allowCredentials = "false")
public class DraftController {

    private final DraftService draftService;
    private final DraftShareService draftShareService;

    @PostMapping("/{id}/finalize")
    public ResponseEntity<?> finalizeDraft(@PathVariable Long id) {
        try {
            Long seasonId = draftService.finalizeDraft(id);
            return ResponseEntity.ok(java.util.Map.of(
                    "message", "Draft finalized successfully",
                    "seasonId", seasonId));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(java.util.Map.of("error", "Failed to finalize draft: " + e.getMessage()));
        }
    }

    // ===== Draft Save/Load Endpoints =====

    @PostMapping("/save")
    public ResponseEntity<?> saveDraft(@RequestBody DraftStateDTO draftState) {
        try {
            // Convert draft state to JSON string
            String draftDataJson = convertToJson(draftState);
            DraftSave saved = draftService.saveDraft(draftState.getSeasonName(), draftDataJson);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }

    @PutMapping("/save/{id}")
    public ResponseEntity<?> updateDraft(@PathVariable Long id, @RequestBody DraftStateDTO draftState) {
        try {
            // Convert draft state to JSON string
            String draftDataJson = convertToJson(draftState);
            DraftSave updated = draftService.updateDraft(id, draftDataJson);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }

    @GetMapping("/latest")
    public ResponseEntity<?> getLatestDraft() {
        try {
            Optional<DraftSave> latest = draftService.getLatestDraft();
            if (latest.isPresent()) {
                return ResponseEntity.ok(latest.get());
            } else {
                return ResponseEntity.noContent().build();
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<?> completeDraft(@PathVariable Long id) {
        try {
            DraftSave completed = draftService.completeDraft(id);
            return ResponseEntity.ok(completed);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getDraftById(@PathVariable Long id) {
        try {
            Optional<DraftSave> draft = draftService.getDraftById(id);
            if (draft.isPresent()) {
                return ResponseEntity.ok(draft.get());
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }

    // Helper method to convert DraftStateDTO to JSON
    private String convertToJson(DraftStateDTO draftState) {
        // Simple JSON conversion - in production, use Jackson ObjectMapper
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.writeValueAsString(draftState);
        } catch (Exception e) {
            throw new RuntimeException("Failed to convert draft state to JSON", e);
        }
    }
    // ===== Read-only share link (GMs following along) =====

    /**
     * Mints a share link. The raw token comes back exactly once -- it is not stored and cannot be
     * read again, so the caller must show it to the operator now. Calling this a second time
     * rotates the token, which kills any link already handed out.
     */
    @PostMapping("/{id}/share")
    public ResponseEntity<?> createShareLink(@PathVariable Long id) {
        try {
            String token = draftShareService.createShareToken(id);
            return ResponseEntity.ok(java.util.Map.of("token", token));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(java.util.Map.of("error", "Failed to create share link"));
        }
    }

    /** Whether a live share link exists, without disclosing it. */
    @GetMapping("/{id}/share")
    public ResponseEntity<?> shareStatus(@PathVariable Long id) {
        return ResponseEntity.ok(java.util.Map.of("shared", draftShareService.isShared(id)));
    }

    @DeleteMapping("/{id}/share")
    public ResponseEntity<?> revokeShareLink(@PathVariable Long id) {
        try {
            draftShareService.revokeShareToken(id);
            return ResponseEntity.ok(java.util.Map.of("shared", false));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    /**
     * The viewer's board. Reached only through the gateway's public /api/v1/auth/draft-watch, and
     * every response goes through DraftShareService.projectForViewing -- never the raw blob, which
     * carries an email address for every player.
     *
     * <p>A bad token and a revoked token are answered identically, so the response cannot be used
     * to distinguish "wrong token" from "sharing turned off".
     */
    @GetMapping("/watch")
    public ResponseEntity<?> watch(@RequestParam("t") String token) {
        try {
            Optional<DraftSave> draft = draftShareService.findByToken(token);
            if (draft.isEmpty()) {
                return ResponseEntity.status(404)
                        .body(java.util.Map.of("error", "This draft link is not valid, or sharing has been turned off."));
            }
            DraftSave save = draft.get();
            return ResponseEntity.ok(java.util.Map.of(
                    "seasonName", save.getSeasonName(),
                    "status", save.getStatus(),
                    "updatedAt", save.getUpdatedAt().toString(),
                    "draftData", draftShareService.projectForViewing(save)));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(java.util.Map.of("error", "Could not load the draft board."));
        }
    }
}
