package com.obhl.league.controller;

import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.league.dto.DraftStateDTO;
import com.obhl.league.model.DraftSave;
import com.obhl.league.service.DraftService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/draft")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "*", allowCredentials = "false")
public class DraftController {

    private final DraftService draftService;

    @PostMapping("/finalize")
    public ResponseEntity<?> finalizeDraft(@RequestBody DraftStateDTO draftState) {
        try {
            draftService.finalizeDraft(draftState);
            return ResponseEntity.ok().body("{\"message\": \"Draft finalized successfully\"}");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("{\"error\": \"" + e.getMessage() + "\"}");
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
}
