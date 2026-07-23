package com.obhl.gateway.config;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable()) // Disable CSRF for stateless JWT
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers("/api/v1/users/signup").permitAll()
                        .requestMatchers("/api/v1/health").permitAll()
                        .requestMatchers("/").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        // Public read-only endpoints
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/seasons", "/api/v1/seasons/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/games", "/api/v1/games/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/teams", "/api/v1/teams/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/players", "/api/v1/players/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/stats/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/users/*/name").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/announcements", "/api/v1/announcements/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/rules").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/chicken-licks/standings").permitAll()
                        .anyRequest().authenticated())
                // Distinguish authentication from authorization failures so the client can react
                // correctly. A missing/expired/invalid token fails the .authenticated() check at
                // this HTTP layer (before method security runs) and lands here → 401, which the
                // frontend treats as an expired session. An authenticated caller who merely lacks
                // a required role fails a controller @PreAuthorize instead, yielding the default
                // AccessDeniedHandler's 403 — which the frontend surfaces WITHOUT logging out.
                // Without this, Spring's default collapses both into 403 and every authz hiccup
                // looks like a session timeout.
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\":\"Not authenticated or session expired\"}");
                        }))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList("*")); // Allow all origins
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(false); // Cannot use credentials with wildcard origins

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
