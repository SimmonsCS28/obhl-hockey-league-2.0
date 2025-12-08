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

@RestController
@RequestMapping("${api.v1.prefix}/seasons")
public class SeasonProxyController {

        private final RestTemplate restTemplate;

        @Value("${league.service.url:http://localhost:8001}")
        private String leagueServiceUrl;

        @Value("${api.v1.prefix}")
        private String apiV1Prefix;

        public SeasonProxyController() {
                // Use HttpComponentsClientHttpRequestFactory to support PATCH method
                // Java's default HttpURLConnection doesn't support PATCH
                this.restTemplate = new RestTemplate(
                                new org.springframework.http.client.HttpComponentsClientHttpRequestFactory());
        }

        /**
         * Proxy all /seasons requests to the League Service
         */
        @RequestMapping(value = "/**", method = { RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
                        RequestMethod.PATCH, RequestMethod.DELETE })
        public ResponseEntity<?> proxySeasonRequests(
                        HttpServletRequest request,
                        @RequestBody(required = false) String body,
                        @RequestHeader HttpHeaders headers) {

                try {
                        // Build the target URL
                        String path = request.getRequestURI().replace(apiV1Prefix + "/seasons", "/api/v1/seasons");
                        String queryString = request.getQueryString();
                        String targetUrl = leagueServiceUrl + path + (queryString != null ? "?" + queryString : "");

                        System.out.println("=== Season Proxy Request ===");
                        System.out.println("Method: " + request.getMethod());
                        System.out.println("Original URI: " + request.getRequestURI());
                        System.out.println("Target URL: " + targetUrl);
                        System.out.println("Body: " + body);
                        System.out.println("League Service URL: " + leagueServiceUrl);

                        // Create HTTP entity with headers and body
                        HttpHeaders proxyHeaders = new HttpHeaders();
                        proxyHeaders.setContentType(MediaType.APPLICATION_JSON);
                        HttpEntity<String> entity = new HttpEntity<>(body, proxyHeaders);

                        // Forward the request
                        ResponseEntity<String> response = restTemplate.exchange(
                                        targetUrl,
                                        HttpMethod.valueOf(request.getMethod()),
                                        entity,
                                        String.class);

                        System.out.println("Response Status: " + response.getStatusCode());

                        return ResponseEntity
                                        .status(response.getStatusCode())
                                        .headers(response.getHeaders())
                                        .body(response.getBody());

                } catch (HttpClientErrorException | HttpServerErrorException e) {
                        System.err.println("HTTP Error in Season Proxy: " + e.getStatusCode() + " - " + e.getMessage());
                        e.printStackTrace();
                        return ResponseEntity
                                        .status(e.getStatusCode())
                                        .body(Map.of("error", e.getMessage()));
                } catch (Exception e) {
                        System.err.println("Exception in Season Proxy: " + e.getClass().getName() + " - "
                                        + e.getMessage());
                        e.printStackTrace();
                        return ResponseEntity
                                        .status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .body(Map.of("error", "Failed to proxy request to League Service", "message",
                                                        e.getMessage()));
                }
        }
}
