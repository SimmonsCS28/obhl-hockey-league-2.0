package com.obhl.gateway.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.obhl.gateway.dto.PlayerDto;

@Service
public class PlayerService {

    @Autowired
    private RestTemplate restTemplate;

    @Value("${stats.service.url:http://localhost:8003}")
    private String statsServiceUrl;

    @Value("${internal.service.key}")
    private String internalServiceKey;

    /**
     * Get all players from stats service, incl. privileged fields (email, skillRating)
     * — used for admin-only flows (e.g. bulk user generation from players), so this
     * calls stats-service as a trusted internal service rather than anonymously.
     */
    public List<PlayerDto> getAllPlayers() {
        String url = statsServiceUrl + "/api/v1/players";
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Internal-Service-Key", internalServiceKey);
        ResponseEntity<List<PlayerDto>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<List<PlayerDto>>() {
                });
        return response.getBody();
    }
}
