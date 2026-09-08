package com.obhl.gateway.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import lombok.RequiredArgsConstructor;

/**
 * The public, read-only draft board that GMs watch from their own devices.
 *
 * <p>Deliberately mounted under {@code /api/v1/auth/**}, which SecurityConfig already declares
 * {@code permitAll} for exactly this purpose -- ShiftConfirmationController states the same
 * convention for its emailed links. Putting it here means the matcher list is not touched at all.
 * That file warns that its matchers are order-sensitive, and that a careless {@code permitAll} once
 * came close to publishing tournament entrants' names, emails and phone numbers; the safest change
 * to it is none.
 *
 * <p>Access is by unguessable token rather than by role, because a GM is not flagged as one until
 * finalize -- which happens after the draft they are trying to watch. league-service resolves the
 * token and strips personal data before anything is returned; this class only forwards.
 */
@RestController
@RequiredArgsConstructor
public class DraftWatchController {

    private final RestTemplate restTemplate;

    @Value("${league.service.url}")
    private String leagueServiceUrl;

    /**
     * Polled every few seconds by every watching GM, so it is built to be cheap: league-service
     * resolves the token through a unique index, and the ETag below means the usual answer is a
     * 304 with no body at all. The operator's own board must not pay for spectators.
     */
    @GetMapping("/api/v1/auth/draft-watch")
    public ResponseEntity<String> watch(
            @RequestParam("t") String token,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {

        String targetUrl = UriComponentsBuilder.fromHttpUrl(leagueServiceUrl + "/draft/watch")
                .queryParam("t", token)
                .toUriString();

        ResponseEntity<String> response;
        try {
            response = restTemplate.exchange(targetUrl, HttpMethod.GET, null, String.class);
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            // A bad or revoked token comes back as a 404 from league-service; pass its message
            // through rather than turning every failure into a 500.
            return ResponseEntity.status(e.getStatusCode())
                    .body(e.getResponseBodyAsString());
        } catch (Exception e) {
            System.err.println("Error proxying draft watch request: " + e.getMessage());
            return ResponseEntity.internalServerError()
                    .body("{\"error\":\"Could not load the draft board.\"}");
        }

        String body = response.getBody();
        // Weak validator: the board changes only when the draft is saved, so the save timestamp
        // is a complete description of the version. Sending it back unchanged costs one small
        // 304 instead of the whole board.
        String etag = "W/\"" + Integer.toHexString(body == null ? 0 : body.hashCode()) + "\"";
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(304).eTag(etag).build();
        }
        return ResponseEntity.status(response.getStatusCode())
                .eTag(etag)
                .header("Cache-Control", "no-cache")
                .body(body);
    }
}
