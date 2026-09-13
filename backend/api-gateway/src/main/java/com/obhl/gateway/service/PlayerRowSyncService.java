package com.obhl.gateway.service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.obhl.gateway.dto.PlayerDto;

/**
 * Pushes the person-level profile fields back onto the per-season players rows.
 *
 * player_profiles is the source of truth for birth date / hometown / shoots, but the
 * admin Players page (and the roster import, and every other staff tool) still reads the
 * legacy columns on each season row. Rather than teach all of those to join the profile,
 * the profile fans its three row-mapped fields out to every row the person has, so an
 * admin sees exactly what the player typed, whichever season they're browsing.
 *
 * Best-effort by design: a stats-service hiccup logs a warning and never fails the
 * player's save. The card reads the profile first anyway, so a missed fan-out only
 * leaves an admin view slightly stale until the next save.
 *
 * RestTemplate rather than StatsClient because Feign's default client cannot send
 * PATCH (there is no feign-hc5 on the classpath), and stats-service maps this update
 * as PATCH/PUT only.
 */
@Service
public class PlayerRowSyncService {

    private static final Logger log = LoggerFactory.getLogger(PlayerRowSyncService.class);

    private final RestTemplate restTemplate = new RestTemplate(new HttpComponentsClientHttpRequestFactory());

    @Value("${stats.service.url:http://localhost:8003}")
    private String statsServiceUrl;

    @Value("${internal.service.key}")
    private String internalServiceKey;

    /**
     * Writes the three row-mapped profile fields to every given row, skipping any whose
     * id is in {@code skipIds} (the row an admin just edited directly, for instance).
     * Nulls are sent as explicit nulls so a cleared hometown clears on the rows too.
     */
    public void fanOut(List<PlayerDto> rows, LocalDate birthDate, String hometown, String shoots, Long... skipIds) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        Map<String, Object> updates = new HashMap<>();
        updates.put("birthDate", birthDate == null ? null : birthDate.toString());
        updates.put("hometown", hometown);
        updates.put("shoots", shoots);

        List<Long> skip = List.of(skipIds);
        for (PlayerDto row : rows) {
            if (row.getId() == null || skip.contains(row.getId())) {
                continue;
            }
            if (Objects.equals(row.getBirthDate(), birthDate)
                    && Objects.equals(blankToNull(row.getHometown()), hometown)
                    && Objects.equals(blankToNull(row.getShoots()), shoots)) {
                continue; // already in sync — don't touch updated_at for nothing
            }
            patchRow(row.getId(), updates);
        }
    }

    void patchRow(Long playerId, Map<String, Object> updates) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Internal-Service-Key", internalServiceKey);
        try {
            restTemplate.exchange(statsServiceUrl + "/api/v1/players/" + playerId,
                    HttpMethod.PATCH, new HttpEntity<>(updates, headers), String.class);
        } catch (RuntimeException e) {
            log.warn("Profile fan-out to players row {} failed: {}", playerId, e.getMessage());
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
