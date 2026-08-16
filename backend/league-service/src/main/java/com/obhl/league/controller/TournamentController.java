package com.obhl.league.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.league.dto.TournamentDto;
import com.obhl.league.service.TournamentService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Tournament configuration.
 *
 * <p>Lives in league-service rather than game-service on purpose. game-service has no Spring
 * Security at all AND is published straight to the internet by nginx at /games-api/, so a write
 * endpoint there would be unauthenticated to the world. league-service has no security either, but
 * nginx does not expose port 8001 -- it only fronts 8000 (gateway), 8002, 8003 and 8080 -- so the
 * gateway is the only route in.
 *
 * <p><b>Authorisation therefore lives entirely in the gateway's SecurityConfig</b>: GET is
 * permitAll (the microsite is public) and the write verbs require ADMIN. There is deliberately no
 * {@code @PreAuthorize} here, because league-service has no spring-security on the classpath and
 * the annotation would be silently inert rather than protective. If league-service is ever given a
 * security starter, or 8001 is ever exposed, add method-level checks here at the same time.
 */
@RestController
@RequestMapping("${api.v1.prefix}/tournaments")
@RequiredArgsConstructor
public class TournamentController {

    private final TournamentService tournamentService;

    /**
     * @param includeUnpublished admin view. Defaults false so the public archive only ever shows
     *                           tournaments that have been deliberately published.
     */
    @GetMapping
    public ResponseEntity<List<TournamentDto.Response>> getAll(
            @RequestParam(required = false, defaultValue = "false") boolean includeUnpublished) {
        return ResponseEntity.ok(tournamentService.getAll(!includeUnpublished));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<?> getBySlug(@PathVariable String slug) {
        return tournamentService.getBySlug(slug)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody TournamentDto.Create dto) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(tournamentService.create(dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody TournamentDto.Update dto) {
        try {
            return ResponseEntity.ok(tournamentService.update(id, dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            tournamentService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
