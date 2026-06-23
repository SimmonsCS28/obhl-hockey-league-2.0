package com.obhl.gateway.service;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.obhl.gateway.dto.GameDayDTO;
import com.obhl.gateway.dto.GameResponseDTO;

@Service
public class GameProxyService {

    @Autowired
    private RestTemplate restTemplate;

    @Value("${game.service.url:http://localhost:8002}")
    private String gameServiceUrl;

    /**
     * Get all game days for a season
     */
    public List<GameDayDTO> getGameDaysBySeason(Long seasonId) {
        String url = gameServiceUrl + "/api/v1/games/season/" + seasonId + "/game-days";
        ResponseEntity<List<GameDayDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<GameDayDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get goalie assignments for a user
     */
    public List<GameResponseDTO> getGoalieAssignments(Long userId) {
        String url = gameServiceUrl + "/api/v1/games/goalie/" + userId + "/assignments";
        ResponseEntity<List<GameResponseDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<GameResponseDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get referee assignments for a user
     */
    public List<GameResponseDTO> getRefereeAssignments(Long userId) {
        String url = gameServiceUrl + "/api/v1/games/referee/" + userId + "/assignments";
        ResponseEntity<List<GameResponseDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<GameResponseDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get scorekeeper assignments for a user
     */
    public List<GameResponseDTO> getScorekeeperAssignments(Long userId) {
        String url = gameServiceUrl + "/api/v1/games/scorekeeper/" + userId + "/assignments";
        ResponseEntity<List<GameResponseDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<GameResponseDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get available games for referees
     */
    public List<GameResponseDTO> getAvailableRefereeGames(Long seasonId) {
        String url = gameServiceUrl + "/api/v1/games/season/" + seasonId + "/referee/available";
        ResponseEntity<List<GameResponseDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<GameResponseDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get available games for scorekeepers
     */
    public List<GameResponseDTO> getAvailableScorekeeperGames(Long seasonId) {
        String url = gameServiceUrl + "/api/v1/games/season/" + seasonId + "/scorekeeper/available";
        ResponseEntity<List<GameResponseDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<GameResponseDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Assign referee to game
     */
    public void assignReferee(Long gameId, Long userId) {
        String url = gameServiceUrl + "/api/v1/games/" + gameId + "/referee/" + userId;
        restTemplate.postForEntity(url, null, Void.class);
    }

    /**
     * Remove referee from game
     */
    public void removeReferee(Long gameId, Long userId) {
        String url = gameServiceUrl + "/api/v1/games/" + gameId + "/referee/" + userId;
        restTemplate.delete(url);
    }

    /**
     * Assign scorekeeper to game
     */
    public void assignScorekeeper(Long gameId, Long userId) {
        String url = gameServiceUrl + "/api/v1/games/" + gameId + "/scorekeeper/" + userId;
        restTemplate.postForEntity(url, null, Void.class);
    }

    /**
     * Remove scorekeeper from game
     */
    public void removeScorekeeper(Long gameId, Long userId) {
        String url = gameServiceUrl + "/api/v1/games/" + gameId + "/scorekeeper/" + userId;
        restTemplate.delete(url);
    }

    /**
     * Get all games for a season
     */
    public List<GameResponseDTO> getGamesBySeason(Long seasonId) {
        String url = gameServiceUrl + "/api/v1/games?seasonId=" + seasonId;
        ResponseEntity<List<GameResponseDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<GameResponseDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get a single game by id
     */
    public GameResponseDTO getGameById(Long gameId) {
        String url = gameServiceUrl + "/api/v1/games/" + gameId;
        return restTemplate.getForObject(url, GameResponseDTO.class);
    }

    /**
     * Patch a game's staff slot fields (e.g. goalie1Id, referee2Id). Only the keys
     * provided are changed; game-service ignores null fields. Used by coordinator publish.
     */
    public void updateGameStaff(Long gameId, Map<String, Object> fields) {
        String url = gameServiceUrl + "/api/v1/games/" + gameId;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        restTemplate.exchange(url, HttpMethod.PATCH, new HttpEntity<>(fields, headers), Void.class);
    }
}
