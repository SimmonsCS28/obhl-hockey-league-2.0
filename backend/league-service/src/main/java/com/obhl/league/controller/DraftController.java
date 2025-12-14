package com.obhl.league.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.league.dto.DraftStateDTO;
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
}
