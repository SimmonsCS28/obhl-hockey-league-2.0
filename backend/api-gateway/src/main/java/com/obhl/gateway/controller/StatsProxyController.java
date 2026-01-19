package com.obhl.gateway.controller;

import java.util.Collections;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/stats")
@RequiredArgsConstructor
public class StatsProxyController {

    private static final Logger logger = LoggerFactory.getLogger(StatsProxyController.class);

    @Value("${api.v1.prefix}")
    private String apiV1Prefix;

    @Value("${stats.service.url}")
    private String statsServiceUrl;

    private final RestTemplate restTemplate;

    /**
     * Proxy all /stats requests to the Stats Service
     */
    @RequestMapping(value = "/**", method = { RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
            RequestMethod.PATCH, RequestMethod.DELETE })
    public ResponseEntity<String> proxyStatsRequests(
            HttpServletRequest request,
            @RequestBody(required = false) String body) {

        try {
            // Build the target URL
            String path = request.getRequestURI().replace(apiV1Prefix + "/stats", "/api/v1/stats");
            String queryString = request.getQueryString();
            String targetUrl = statsServiceUrl + path;
            if (queryString != null && !queryString.isEmpty()) {
                targetUrl += "?" + queryString;
            }

            logger.info("Proxying {} request to: {}", request.getMethod(), targetUrl);

            // Forward headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            // Create request entity
            HttpEntity<String> entity = new HttpEntity<>(body, headers);

            // Make the request
            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.valueOf(request.getMethod()),
                    entity,
                    String.class);

            return response;

        } catch (HttpClientErrorException e) {
            logger.error("Error proxying to stats service: {}", e.getMessage());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            logger.error("Unexpected error proxying to stats service", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("{\"error\": \"Failed to proxy request to stats service\"}");
        }
    }
}
