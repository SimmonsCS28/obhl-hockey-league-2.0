package com.obhl.stats.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import jakarta.servlet.DispatcherType;

/** Enforce authorization in the service even when the gateway is bypassed. */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/players", "/api/v1/players/**",
                                "/api/v1/stats/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/gm/**")
                            .hasAnyRole("ADMIN", "GM", "GOALIE_COORDINATOR", "INTERNAL_SERVICE")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/gm/players/*/jersey").hasAnyRole("ADMIN", "GM")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/gm/players/*/skill")
                            .hasAnyRole("ADMIN", "GM", "GOALIE_COORDINATOR")
                        .requestMatchers("/api/v1/players", "/api/v1/players/**", "/api/v1/stats/**")
                            .hasAnyRole("ADMIN", "INTERNAL_SERVICE")
                        .anyRequest().denyAll())
                .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, exception) ->
                        response.sendError(401)))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
