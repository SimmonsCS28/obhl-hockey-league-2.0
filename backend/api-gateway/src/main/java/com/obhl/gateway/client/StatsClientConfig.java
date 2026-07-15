package com.obhl.gateway.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

import feign.RequestInterceptor;

/**
 * Attaches the trusted internal-service key to every StatsClient call, so
 * server-to-server aggregation (e.g. GoaliePerformanceService reading
 * skillRating) gets stats-service's privileged field view without needing to
 * forward an end user's JWT. Scoped to StatsClient only — never sent to
 * league-service or game-service.
 */
public class StatsClientConfig {

    @Value("${internal.service.key}")
    private String internalServiceKey;

    @Bean
    public RequestInterceptor statsInternalServiceKeyInterceptor() {
        return requestTemplate -> requestTemplate.header("X-Internal-Service-Key", internalServiceKey);
    }
}
