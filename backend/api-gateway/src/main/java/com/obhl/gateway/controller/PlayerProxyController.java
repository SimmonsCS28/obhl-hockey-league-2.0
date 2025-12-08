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
@RequestMapping("${api.v1.prefix}/players")
public class PlayerProxyController {

        private final RestTemplate restTemplate;

        @Value("${stats.service.url:http://localhost:8003}")
        private String statsServiceUrl;

        @Value("${api.v1.prefix}")
        private String apiV1Prefix;

        public PlayerProxyController() {
                // Use HttpComponentsClientHttpRequestFactory to support PATCH method
                // Java's default HttpURLConnection doesn't support PATCH
                this.restTemplate = new RestTemplate(
                                new org.springframework.http.client.HttpComponentsClientHttpRequestFactory());
        }

        /**
         * Proxy all /players requests to the Stats Service
         */
        @RequestMapping(value = "/**", method = { RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
                        RequestMethod.PATCH, RequestMethod.DELETE })
        public ResponseEntity<?> proxyPlayerRequests(
                        HttpServletRequest request,
                        @RequestBody(required = false) String body,
                        @RequestHeader HttpHeaders headers) {

                try {
                        // Build the target URL
                        String path = request.getRequestURI().replace(apiV1Prefix + "/players", "/api/v1/players");
                        String queryString = request.getQueryString();
                        String targetUrl = statsServiceUrl + path + (queryString != null ? "?" + queryString : "");

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
                                        .body(Map.of("error", "Failed to proxy request to Stats Service", "message",
                                                        e.getMessage()));
                }
        }
}
