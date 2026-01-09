package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/gm")
@RequiredArgsConstructor
public class GMProxyController {

    private final RestTemplate restTemplate;

    @Value("${game.service.url:http://localhost:8002}")
    private String gameServiceUrl;

    @Value("${stats.service.url:http://localhost:8003}")
    private String statsServiceUrl;

    @Value("${api.v1.prefix}")
    private String apiV1Prefix;

    /**
     * Proxy GM requests to appropriate services
     * - /schedule -> Game Service
     * - Everything else -> Stats Service
     */
    @RequestMapping(value = "/**", method = { RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
            RequestMethod.PATCH, RequestMethod.DELETE })
    public ResponseEntity<?> proxyGMRequests(
            HttpServletRequest request,
            @RequestBody(required = false) String body,
            @RequestHeader HttpHeaders headers) {

        try {
            String requestUri = request.getRequestURI();
            String path = requestUri.replace(apiV1Prefix + "/gm", "/api/v1/gm");

            // Determine target service based on path
            String targetServiceUrl;
            if (path.contains("/schedule")) {
                targetServiceUrl = gameServiceUrl;
            } else {
                targetServiceUrl = statsServiceUrl;
            }

            String queryString = request.getQueryString();
            String targetUrl = targetServiceUrl + path + (queryString != null ? "?" + queryString : "");

            // Create HTTP entity with headers and body
            HttpHeaders proxyHeaders = new HttpHeaders();
            if (headers.getContentType() != null) {
                proxyHeaders.setContentType(headers.getContentType());
            } else {
                proxyHeaders.setContentType(MediaType.APPLICATION_JSON);
            }
            HttpEntity<String> entity = new HttpEntity<>(body, proxyHeaders);

            // Forward the request
            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.valueOf(request.getMethod()),
                    entity,
                    String.class);

            return ResponseEntity
                    .status(response.getStatusCode())
                    .headers(response.getHeaders())
                    .body(response.getBody());

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            return ResponseEntity
                    .status(e.getStatusCode())
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to proxy GM request", "message", e.getMessage()));
        }
    }
}
