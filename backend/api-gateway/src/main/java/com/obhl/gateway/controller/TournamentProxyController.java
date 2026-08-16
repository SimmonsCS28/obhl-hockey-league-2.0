package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Proxies /tournaments to league-service, mirroring {@link SeasonProxyController}.
 *
 * <p>Because this is a catch-all mapping there is no per-endpoint method to hang
 * {@code @PreAuthorize} on, so authorisation for these paths lives in SecurityConfig: GET is
 * permitAll and the write verbs require ADMIN. Keep the two in step -- a new tournament sub-path
 * inherits whatever SecurityConfig says about /tournaments/**, and nothing else.
 */
@RestController
@RequestMapping("${api.v1.prefix}/tournaments")
public class TournamentProxyController {

    private final RestTemplate restTemplate;

    @Value("${league.service.url:http://localhost:8001}")
    private String leagueServiceUrl;

    @Value("${api.v1.prefix}")
    private String apiV1Prefix;

    public TournamentProxyController() {
        // Apache HttpComponents rather than the JDK default, which cannot do PATCH -- and PATCH is
        // how the tournament admin saves every edit.
        this.restTemplate = new RestTemplate(new HttpComponentsClientHttpRequestFactory());
    }

    @RequestMapping(value = "/**", method = { RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
            RequestMethod.PATCH, RequestMethod.DELETE })
    public ResponseEntity<?> proxyTournamentRequests(
            HttpServletRequest request,
            @RequestBody(required = false) String body,
            @RequestHeader HttpHeaders headers) {

        try {
            String path = request.getRequestURI().replace(apiV1Prefix + "/tournaments", "/api/v1/tournaments");
            String queryString = request.getQueryString();
            String targetUrl = leagueServiceUrl + path + (queryString != null ? "?" + queryString : "");

            HttpHeaders proxyHeaders = new HttpHeaders();
            proxyHeaders.setContentType(MediaType.APPLICATION_JSON);
            if (headers.containsKey(HttpHeaders.AUTHORIZATION)) {
                proxyHeaders.set(HttpHeaders.AUTHORIZATION, headers.getFirst(HttpHeaders.AUTHORIZATION));
            }

            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.valueOf(request.getMethod()),
                    new HttpEntity<>(body, proxyHeaders),
                    String.class);

            return ResponseEntity
                    .status(response.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(response.getBody());

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            // Pass the downstream body through rather than swallowing it -- the tournament service
            // returns {"error": "..."} messages the admin UI shows directly.
            return ResponseEntity
                    .status(e.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(e.getResponseBodyAsString());
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to proxy request to League Service",
                            "message", e.getMessage()));
        }
    }
}
