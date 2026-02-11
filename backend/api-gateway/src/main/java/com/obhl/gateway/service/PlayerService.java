package com.obhl.gateway.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.obhl.gateway.dto.PlayerDTO;

@Service
public class PlayerService {

    @Autowired
    private RestTemplate restTemplate;

    @Value("${stats.service.url:http://localhost:8003}")
    private String statsServiceUrl;

    /**
     * Get all players from stats service
     */
    public List<PlayerDTO> getAllPlayers() {
        String url = statsServiceUrl + "/api/v1/players";
        ResponseEntity<List<PlayerDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<PlayerDTO>>() {
                });
        return response.getBody();
    }
}
