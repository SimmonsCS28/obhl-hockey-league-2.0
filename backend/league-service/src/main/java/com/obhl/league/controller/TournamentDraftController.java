package com.obhl.league.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.league.dto.DraftDto;
import com.obhl.league.service.TournamentDraftService;
import com.obhl.league.service.TournamentService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * The tournament draft.
 *
 * <p>Every route here is a write or an operator view, so all of them are ADMIN-gated in the
 * gateway's SecurityConfig — including the GET, unlike the rest of /tournaments/** which is public.
 * The draft board shows entrants' emails and phone numbers; it is not public.
 */
@RestController
@RequestMapping("${api.v1.prefix}/tournaments/{idOrSlug}/draft")
@RequiredArgsConstructor
public class TournamentDraftController {

    private final TournamentDraftService draftService;
    private final TournamentService tournamentService;

    @GetMapping
    public ResponseEntity<?> board(@PathVariable String idOrSlug) {
        return withId(idOrSlug, id -> ResponseEntity.ok(draftService.getBoard(id)));
    }

    @PostMapping("/entrants")
    public ResponseEntity<?> importEntrants(
            @PathVariable String idOrSlug,
            @Valid @RequestBody DraftDto.ImportRequest request) {
        return withId(idOrSlug, id -> ResponseEntity.ok(draftService.importEntrants(id, request)));
    }

    /** Re-runs account matching. Entrants the operator has confirmed are left untouched. */
    @PostMapping("/match-accounts")
    public ResponseEntity<?> matchAccounts(@PathVariable String idOrSlug) {
        return withId(idOrSlug, id -> ResponseEntity.ok(draftService.matchAccounts(id)));
    }

    @PutMapping("/entrants/{entrantId}/link")
    public ResponseEntity<?> setLink(
            @PathVariable String idOrSlug,
            @PathVariable Long entrantId,
            @RequestBody DraftDto.LinkRequest request) {
        return withId(idOrSlug, id ->
                ResponseEntity.ok(draftService.setLink(id, entrantId, request.getUserId())));
    }

    @PostMapping("/place-gms")
    public ResponseEntity<?> placeGms(@PathVariable String idOrSlug) {
        return withId(idOrSlug, id -> ResponseEntity.ok(draftService.placeGms(id)));
    }

    @PutMapping("/picks/{entrantId}")
    public ResponseEntity<?> assign(
            @PathVariable String idOrSlug,
            @PathVariable Long entrantId,
            @RequestBody DraftDto.AssignRequest request) {
        return withId(idOrSlug, id ->
                ResponseEntity.ok(draftService.assign(id, entrantId, request.getTeamId())));
    }

    @DeleteMapping("/picks/{entrantId}")
    public ResponseEntity<?> unassign(@PathVariable String idOrSlug, @PathVariable Long entrantId) {
        return withId(idOrSlug, id -> ResponseEntity.ok(draftService.unassign(id, entrantId)));
    }

    @PostMapping("/undo")
    public ResponseEntity<?> undo(@PathVariable String idOrSlug) {
        return withId(idOrSlug, id -> ResponseEntity.ok(draftService.undo(id)));
    }

    @PostMapping("/commit")
    public ResponseEntity<?> commit(@PathVariable String idOrSlug) {
        return withId(idOrSlug, id -> ResponseEntity.ok(draftService.commit(id)));
    }

    /**
     * Resolves the slug-or-id and turns the service's exceptions into readable responses.
     *
     * <p>Centralised because every route here needs the same treatment, and because these messages
     * are read on draft day by someone with a room waiting — "There are 7 GMs and 8 teams" has to
     * reach the screen intact rather than as a 500.
     */
    private ResponseEntity<?> withId(String idOrSlug, java.util.function.Function<Long, ResponseEntity<?>> action) {
        return tournamentService.resolveId(idOrSlug)
                .map(id -> {
                    try {
                        return action.apply(id);
                    } catch (IllegalArgumentException | IllegalStateException e) {
                        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
                    } catch (RuntimeException e) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", e.getMessage() == null ? "Draft action failed" : e.getMessage()));
                    }
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
