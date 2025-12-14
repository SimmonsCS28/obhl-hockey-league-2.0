package com.obhl.gateway.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/league")
@RequiredArgsConstructor
public class LeagueProxyController {

    private final RestTemplate restTemplate;

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
            return ResponseEntity.internalServerError()
                    .body("{\"error\": \"Failed to upload file: " + e.getMessage() + "\"}");
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
            return ResponseEntity.internalServerError()
                    .body("{\"error\": \"Failed to finalize draft: " + e.getMessage() + "\"}");
        }
    }
}
