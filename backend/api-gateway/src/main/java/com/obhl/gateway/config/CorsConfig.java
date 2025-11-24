package com.obhl.gateway.config;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.cors.allowed-methods}")
    private String allowedMethods;

    @Value("${app.cors.allowed-headers}")
    private String allowedHeaders;

    @Value("${app.cors.allow-credentials}")
    private boolean allowCredentials;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();

        if ("*".equals(allowedOrigins)) {
            config.addAllowedOriginPattern("*");
        } else {
            Arrays.stream(allowedOrigins.split(",")).forEach(config::addAllowedOrigin);
        }

        if ("*".equals(allowedMethods)) {
            config.addAllowedMethod("*");
        } else {
            Arrays.stream(allowedMethods.split(",")).forEach(config::addAllowedMethod);
        }

        if ("*".equals(allowedHeaders)) {
            config.addAllowedHeader("*");
        } else {
            Arrays.stream(allowedHeaders.split(",")).forEach(config::addAllowedHeader);
        }

        config.setAllowCredentials(allowCredentials);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsFilter(source);
    }
}
