package com.obhl.gateway.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/league")
@RequiredArgsConstructor
public class LeagueProxyController {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${league.service.url}")
    private String leagueServiceUrl;

    /**
     * Proxy for Excel registration file upload
     */
    @PostMapping("/import/registration")
    public ResponseEntity<?> uploadRegistration(
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) {

        System.out.println("=== Import Registration Proxy Request ===");
        System.out.println("File: " + file.getOriginalFilename());
        System.out.println("Size: " + file.getSize());

        try {
            String targetUrl = leagueServiceUrl + "/import/registration";
            System.out.println("Target URL: " + targetUrl);

            // Forward the multipart file to league-service
            HttpHeaders headers = new HttpHeaders();
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null) {
                headers.set("Authorization", authHeader);
            }

            // Create multipart request
            org.springframework.util.LinkedMultiValueMap<String, Object> map = new org.springframework.util.LinkedMultiValueMap<>();
            map.add("file", file.getResource());

            HttpEntity<org.springframework.util.LinkedMultiValueMap<String, Object>> requestEntity = new HttpEntity<>(
                    map, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.POST,
                    requestEntity,
                    String.class);

            System.out.println("Response Status: " + response.getStatusCode());
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            System.err.println("Error proxying import request: " + e.getMessage());
            e.printStackTrace();
            try {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Failed to upload file: " + e.getMessage());
                return ResponseEntity.internalServerError().body(objectMapper.writeValueAsString(errorResponse));
            } catch (Exception jsonEx) {
                return ResponseEntity.internalServerError().body("{\"error\":\"Internal server error\"}");
            }
        }
    }

    /**
     * Proxy for draft finalization
     */
    @PostMapping("/draft/finalize")
    public ResponseEntity<?> finalizeDraft(
            @RequestBody String draftState,
            HttpServletRequest request) {

        System.out.println("=== Draft Finalize Proxy Request ===");
        System.out.println("Draft State Length: " + draftState.length());

        try {
            String targetUrl = leagueServiceUrl + "/draft/finalize";
            System.out.println("Target URL: " + targetUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.set("Content-Type", "application/json");
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null) {
                headers.set("Authorization", authHeader);
            }

            HttpEntity<String> requestEntity = new HttpEntity<>(draftState, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.POST,
                    requestEntity,
                    String.class);

            System.out.println("Response Status: " + response.getStatusCode());
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            System.err.println("Error proxying draft finalize request: " + e.getMessage());
            e.printStackTrace();
            try {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Failed to finalize draft: " + e.getMessage());
                return ResponseEntity.internalServerError().body(objectMapper.writeValueAsString(errorResponse));
            } catch (Exception jsonEx) {
                return ResponseEntity.internalServerError().body("{\"error\":\"Internal server error\"}");
            }
        }
    }

    // ===== Draft Save/Load Proxy Endpoints =====

    @PostMapping("/draft/save")
    public ResponseEntity<?> saveDraft(
            @RequestBody String draftState,
            HttpServletRequest request) {

        System.out.println("=== Draft Save Proxy Request ===");

        try {
            String targetUrl = leagueServiceUrl + "/draft/save";
            System.out.println("Target URL: " + targetUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.set("Content-Type", "application/json");
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null) {
                headers.set("Authorization", authHeader);
            }

            HttpEntity<String> requestEntity = new HttpEntity<>(draftState, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.POST,
                    requestEntity,
                    String.class);

            System.out.println("Response Status: " + response.getStatusCode());
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            System.err.println("Error proxying draft save request: " + e.getMessage());
            e.printStackTrace();
            try {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Failed to save draft: " + e.getMessage());
                return ResponseEntity.internalServerError().body(objectMapper.writeValueAsString(errorResponse));
            } catch (Exception jsonEx) {
                return ResponseEntity.internalServerError().body("{\"error\":\"Internal server error\"}");
            }
        }
    }

    @PutMapping("/draft/save/{id}")
    public ResponseEntity<?> updateDraft(
            @PathVariable Long id,
            @RequestBody String draftState,
            HttpServletRequest request) {

        System.out.println("=== Draft Update Proxy Request ===");
        System.out.println("Draft ID: " + id);

        try {
            String targetUrl = leagueServiceUrl + "/draft/save/" + id;
            System.out.println("Target URL: " + targetUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.set("Content-Type", "application/json");
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null) {
                headers.set("Authorization", authHeader);
            }

            HttpEntity<String> requestEntity = new HttpEntity<>(draftState, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.PUT,
                    requestEntity,
                    String.class);

            System.out.println("Response Status: " + response.getStatusCode());
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            System.err.println("Error proxying draft update request: " + e.getMessage());
            e.printStackTrace();
            try {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Failed to update draft: " + e.getMessage());
                return ResponseEntity.internalServerError().body(objectMapper.writeValueAsString(errorResponse));
            } catch (Exception jsonEx) {
                return ResponseEntity.internalServerError().body("{\"error\":\"Internal server error\"}");
            }
        }
    }

    @PostMapping("/draft/{id}/finalize")
    public ResponseEntity<?> finalizeDraft(
            @PathVariable Long id,
            HttpServletRequest request) {

        System.out.println("=== Draft Finalize Proxy Request ===");
        System.out.println("Draft ID: " + id);

        try {
            String targetUrl = leagueServiceUrl + "/draft/" + id + "/finalize";
            System.out.println("Target URL: " + targetUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.set("Content-Type", "application/json");
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null) {
                headers.set("Authorization", authHeader);
            }

            HttpEntity<String> requestEntity = new HttpEntity<>(null, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.POST,
                    requestEntity,
                    String.class);

            System.out.println("Response Status: " + response.getStatusCode());
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            System.err.println("Error proxying draft finalize request: " + e.getMessage());
            e.printStackTrace();
            try {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Failed to finalize draft: " + e.getMessage());
                return ResponseEntity.internalServerError().body(objectMapper.writeValueAsString(errorResponse));
            } catch (Exception jsonEx) {
                return ResponseEntity.internalServerError().body("{\"error\":\"Internal server error\"}");
            }
        }
    }

    @GetMapping("/draft/latest")
    public ResponseEntity<?> getLatestDraft(HttpServletRequest request) {

        System.out.println("=== Get Latest Draft Proxy Request ===");

        try {
            String targetUrl = leagueServiceUrl + "/draft/latest";
            System.out.println("Target URL: " + targetUrl);

            HttpHeaders headers = new HttpHeaders();
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null) {
                headers.set("Authorization", authHeader);
            }

            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.GET,
                    requestEntity,
                    String.class);

            System.out.println("Response Status: " + response.getStatusCode());
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            System.err.println("Error proxying get latest draft request: " + e.getMessage());
            e.printStackTrace();
            try {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Failed to get latest draft: " + e.getMessage());
                return ResponseEntity.internalServerError().body(objectMapper.writeValueAsString(errorResponse));
            } catch (Exception jsonEx) {
                return ResponseEntity.internalServerError().body("{\"error\":\"Internal server error\"}");
            }
        }
    }

    @PutMapping("/draft/{id}/complete")
    public ResponseEntity<?> completeDraft(
            @PathVariable Long id,
            HttpServletRequest request) {

        System.out.println("=== Complete Draft Proxy Request ===");
        System.out.println("Draft ID: " + id);

        try {
            String targetUrl = leagueServiceUrl + "/draft/" + id + "/complete";
            System.out.println("Target URL: " + targetUrl);

            HttpHeaders headers = new HttpHeaders();
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null) {
                headers.set("Authorization", authHeader);
            }

            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.PUT,
                    requestEntity,
                    String.class);

            System.out.println("Response Status: " + response.getStatusCode());
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            System.err.println("Error proxying complete draft request: " + e.getMessage());
            e.printStackTrace();
            try {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Failed to complete draft: " + e.getMessage());
                return ResponseEntity.internalServerError().body(objectMapper.writeValueAsString(errorResponse));
            } catch (Exception jsonEx) {
                return ResponseEntity.internalServerError().body("{\"error\":\"Internal server error\"}");
            }
        }
    }
}
