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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.obhl.gateway.service.PlayerProfileService;

@RestController
@RequestMapping("${api.v1.prefix}/players")
public class PlayerProxyController {

        private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PlayerProxyController.class);
        private static final java.util.regex.Pattern SINGLE_ROW = java.util.regex.Pattern.compile("/players/(\\d+)/?$");

        private final RestTemplate restTemplate;
        private final PlayerProfileService profileService;
        private final ObjectMapper objectMapper;

        @Value("${stats.service.url:http://localhost:8003}")
        private String statsServiceUrl;

        @Value("${api.v1.prefix}")
        private String apiV1Prefix;

        public PlayerProxyController(PlayerProfileService profileService, ObjectMapper objectMapper) {
                // Use HttpComponentsClientHttpRequestFactory to support PATCH method
                // Java's default HttpURLConnection doesn't support PATCH
                this.restTemplate = new RestTemplate(
                                new org.springframework.http.client.HttpComponentsClientHttpRequestFactory());
                this.profileService = profileService;
                this.objectMapper = objectMapper;
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

                        // Forward Authorization header
                        if (headers.containsKey(HttpHeaders.AUTHORIZATION)) {
                                proxyHeaders.set(HttpHeaders.AUTHORIZATION,
                                                headers.getFirst(HttpHeaders.AUTHORIZATION));
                        }
                        HttpEntity<String> entity = new HttpEntity<>(body, proxyHeaders);

                        // Forward the request
                        ResponseEntity<String> response = restTemplate.exchange(
                                        targetUrl,
                                        HttpMethod.valueOf(request.getMethod()),
                                        entity,
                                        String.class);

                        // An admin editing a single row's birth date / hometown / shoots must reach the
                        // person-level profile too, or the card keeps showing the old value. Done after
                        // the proxied write succeeded, and never allowed to fail the admin's request.
                        if (response.getStatusCode().is2xxSuccessful() && body != null
                                        && ("PATCH".equals(request.getMethod()) || "PUT".equals(request.getMethod()))) {
                                writeBackToProfile(path, body);
                        }

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

        private void writeBackToProfile(String path, String body) {
                java.util.regex.Matcher m = SINGLE_ROW.matcher(path);
                if (!m.find()) {
                        return;
                }
                try {
                        Map<String, Object> updates = objectMapper.readValue(body, new TypeReference<Map<String, Object>>() {
                        });
                        profileService.absorbRowEdit(Long.valueOf(m.group(1)), updates);
                } catch (Exception e) {
                        log.warn("Profile write-back after editing players row {} failed: {}", m.group(1), e.getMessage());
                }
        }
}
