package com.obhl.league.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

import feign.RequestInterceptor;

/**
 * stats-service now requires proof of a trusted caller to return full player data
 * (skillRating) or accept skillRating writes on the generic player-update endpoint —
 * see stats-service's JwtAuthenticationFilter/PlayerAccess. Draft finalization and
 * Excel roster import call stats-service server-to-server with no end-user session,
 * so they authenticate as an internal service instead.
 *
 * Deliberately NOT annotated with @Configuration: it's wired only into StatsClient via
 * @FeignClient(configuration = ...), so it must stay out of component-scanning or it
 * would become a global interceptor shared by every Feign client in this service.
 */
public class StatsClientConfig {

    @Value("${internal.service.key:obhl-internal-service-key-change-in-production}")
    private String internalServiceKey;

    @Bean
    public RequestInterceptor statsClientRequestInterceptor() {
        return requestTemplate -> requestTemplate.header("X-Internal-Service-Key", internalServiceKey);
    }
}
