package com.obhl.gateway.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.obhl.gateway.dto.GameDayDTO;
import com.obhl.gateway.dto.ShiftAssignmentDTO;

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
    public List<ShiftAssignmentDTO> getGoalieAssignments(Long userId) {
        String url = gameServiceUrl + "/api/v1/games/goalie/" + userId + "/assignments";
        ResponseEntity<List<ShiftAssignmentDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ShiftAssignmentDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get referee assignments for a user
     */
    public List<ShiftAssignmentDTO> getRefereeAssignments(Long userId) {
        String url = gameServiceUrl + "/api/v1/games/referee/" + userId + "/assignments";
        ResponseEntity<List<ShiftAssignmentDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ShiftAssignmentDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get scorekeeper assignments for a user
     */
    public List<ShiftAssignmentDTO> getScorekeeperAssignments(Long userId) {
        String url = gameServiceUrl + "/api/v1/games/scorekeeper/" + userId + "/assignments";
        ResponseEntity<List<ShiftAssignmentDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ShiftAssignmentDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get available games for referees
     */
    public List<ShiftAssignmentDTO> getAvailableRefereeGames(Long seasonId) {
        String url = gameServiceUrl + "/api/v1/games/season/" + seasonId + "/referee/available";
        ResponseEntity<List<ShiftAssignmentDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ShiftAssignmentDTO>>() {
                });
        return response.getBody();
    }

    /**
     * Get available games for scorekeepers
     */
    public List<ShiftAssignmentDTO> getAvailableScorekeeperGames(Long seasonId) {
        String url = gameServiceUrl + "/api/v1/games/season/" + seasonId + "/scorekeeper/available";
        ResponseEntity<List<ShiftAssignmentDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ShiftAssignmentDTO>>() {
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
}
