package com.obhl.gateway.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.DraftStateDTO;
import com.obhl.gateway.service.DraftService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/draft")
@RequiredArgsConstructor
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
