package com.obhl.gateway.controller;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.RulesDto;
import com.obhl.gateway.model.LeagueRules;
import com.obhl.gateway.model.RulesSection;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.LeagueRulesRepository;
import com.obhl.gateway.repository.RulesSectionRepository;

import lombok.RequiredArgsConstructor;

/**
 * Sectioned League Rules (v4 §5). Public {@code GET /rules} returns the ordered sections
 * + publish metadata; admins author sections via {@code /admin/rules}. The {@code league_rules}
 * singleton row is reused as the publish-metadata store (updated_at/by = published_at/by).
 *
 * NOTE: no draft isolation yet — {@code PUT /admin/rules} saves live; {@code publish} only
 * stamps the "Published … by …" metadata. Draft/live separation can be layered on later.
 */
@RestController
@RequestMapping("${api.v1.prefix}")
@RequiredArgsConstructor
public class LeagueRulesController {

    private static final Set<String> GROUPS = Set.of("gen", "game", "mou");

    private final RulesSectionRepository sectionRepository;
    private final LeagueRulesRepository leagueRulesRepository;

    /** Public — read the published rules. */
    @GetMapping("/rules")
    public ResponseEntity<RulesDto.RulesResponse> getRules() {
        return ResponseEntity.ok(buildResponse());
    }

    /** Admin — read for editing (same data; no draft isolation yet). */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/rules")
    public ResponseEntity<RulesDto.RulesResponse> getAdminRules() {
        return ResponseEntity.ok(buildResponse());
    }

    /** Admin — replace the full ordered section list. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/rules")
    @Transactional
    public ResponseEntity<RulesDto.RulesResponse> saveRules(@RequestBody RulesDto.SaveRequest req) {
        List<RulesDto.Section> incoming = req.getSections() != null ? req.getSections() : List.of();
        sectionRepository.deleteAllInBatch();

        int order = 0;
        for (RulesDto.Section s : incoming) {
            RulesSection entity = new RulesSection();
            entity.setSectionGroup(normalizeGroup(s.getGroup()));
            entity.setTitle(s.getTitle() != null && !s.getTitle().isBlank() ? s.getTitle().trim() : "Untitled Section");
            entity.setContent(s.getContent() != null ? s.getContent() : "");
            entity.setSortOrder(order++);
            sectionRepository.save(entity);
        }
        return ResponseEntity.ok(buildResponse());
    }

    /** Admin — stamp published_at / published_by. */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/rules/publish")
    public ResponseEntity<RulesDto.RulesResponse> publish(Authentication auth) {
        LeagueRules meta = leagueRulesRepository.findFirstByOrderByIdAsc().orElseGet(LeagueRules::new);
        meta.setUpdatedAt(LocalDateTime.now());
        if (auth != null && auth.getPrincipal() instanceof User u) {
            meta.setUpdatedById(u.getId() != null ? u.getId().intValue() : null);
            String name = ((u.getFirstName() != null ? u.getFirstName() : "") + " "
                    + (u.getLastName() != null ? u.getLastName() : "")).trim();
            meta.setUpdatedByName(name.isBlank() ? u.getEmail() : name);
        }
        if (meta.getContent() == null) {
            meta.setContent("");
        }
        leagueRulesRepository.save(meta);
        return ResponseEntity.ok(buildResponse());
    }

    // ---- helpers ----

    private RulesDto.RulesResponse buildResponse() {
        List<RulesDto.Section> sections = sectionRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(s -> new RulesDto.Section(s.getId(), s.getSectionGroup(), s.getTitle(), s.getContent(), s.getSortOrder()))
                .collect(Collectors.toCollection(ArrayList::new));

        String publishedAt = "";
        String publishedBy = "";
        LeagueRules meta = leagueRulesRepository.findFirstByOrderByIdAsc().orElse(null);
        if (meta != null) {
            publishedAt = meta.getUpdatedAt() != null ? meta.getUpdatedAt().toString() : "";
            publishedBy = meta.getUpdatedByName() != null ? meta.getUpdatedByName() : "";
        }
        return new RulesDto.RulesResponse(sections, publishedAt, publishedBy);
    }

    private String normalizeGroup(String group) {
        if (group == null) {
            return "gen";
        }
        String g = group.trim().toLowerCase();
        return GROUPS.contains(g) ? g : "gen";
    }
}
