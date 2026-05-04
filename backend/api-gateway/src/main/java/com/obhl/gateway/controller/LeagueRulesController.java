package com.obhl.gateway.controller;

import com.obhl.gateway.model.LeagueRules;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.LeagueRulesRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("${api.v1.prefix}/rules")
@RequiredArgsConstructor
public class LeagueRulesController {

    private final LeagueRulesRepository leagueRulesRepository;

    /**
     * Public endpoint – anyone can read the rules.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getRules() {
        LeagueRules rules = leagueRulesRepository.findFirstByOrderByIdAsc()
                .orElse(new LeagueRules());

        return ResponseEntity.ok(Map.of(
                "content", rules.getContent() != null ? rules.getContent() : "",
                "updatedByName", rules.getUpdatedByName() != null ? rules.getUpdatedByName() : "",
                "updatedAt", rules.getUpdatedAt() != null ? rules.getUpdatedAt().toString() : ""
        ));
    }

    /**
     * Admin-only endpoint – save updated rules content.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping
    public ResponseEntity<Map<String, Object>> updateRules(
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        String content = body.get("content");
        if (content == null) {
            return ResponseEntity.badRequest().build();
        }

        LeagueRules rules = leagueRulesRepository.findFirstByOrderByIdAsc()
                .orElse(new LeagueRules());

        rules.setContent(content);

        // Record who updated it
        if (authentication != null && authentication.getPrincipal() instanceof User currentUser) {
            rules.setUpdatedById(currentUser.getId() != null ? currentUser.getId().intValue() : null);
            String name = (currentUser.getFirstName() != null ? currentUser.getFirstName() : "")
                    + " " + (currentUser.getLastName() != null ? currentUser.getLastName() : "");
            rules.setUpdatedByName(name.isBlank() ? currentUser.getEmail() : name.trim());
        }

        LeagueRules saved = leagueRulesRepository.save(rules);

        return ResponseEntity.ok(Map.of(
                "content", saved.getContent(),
                "updatedByName", saved.getUpdatedByName() != null ? saved.getUpdatedByName() : "",
                "updatedAt", saved.getUpdatedAt() != null ? saved.getUpdatedAt().toString() : ""
        ));
    }
}
