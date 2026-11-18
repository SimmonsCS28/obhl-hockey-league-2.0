package com.obhl.stats.config;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.obhl.stats.util.JwtUtil;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Two trust paths into stats-service:
 *  - X-Internal-Service-Key: trusted backend-to-backend calls (game-service,
 *    league-service, api-gateway's own internal callers) get full access.
 *  - Authorization: Bearer <jwt>: the same tokens api-gateway issues, forwarded
 *    through when a request originated from an end user (e.g. PlayerProxyController).
 * Requests with neither are left unauthenticated (anonymous) — most endpoints stay
 * open (see SecurityConfig), but field-level masking and @PreAuthorize checks key off
 * the authorities set here.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Value("${internal.service.key:obhl-internal-service-key-change-in-production}")
    private String internalServiceKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String internalKeyHeader = request.getHeader("X-Internal-Service-Key");
        if (internalKeyHeader != null && !internalKeyHeader.isBlank()
                && internalKeyHeader.equals(internalServiceKey)) {
            SecurityContextHolder.getContext().setAuthentication(new InternalServiceAuthentication());
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        String token = null;
        String username = null;

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
            try {
                username = jwtUtil.extractUsername(token);
            } catch (Exception e) {
                // Invalid token, continue without authentication
            }
        }

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            if (jwtUtil.validateToken(token)) {
                List<String> roles = jwtUtil.getRolesFromToken(token);

                var authorities = new ArrayList<SimpleGrantedAuthority>();
                if (roles != null && !roles.isEmpty()) {
                    for (String role : roles) {
                        String authority = role.startsWith("ROLE_") ? role : "ROLE_" + role;
                        authorities.add(new SimpleGrantedAuthority(authority));
                    }
                } else {
                    // Fallback for older tokens carrying a single legacy role claim
                    String role = jwtUtil.getRoleFromToken(token);
                    if (role != null) {
                        String authority = role.startsWith("ROLE_") ? role : "ROLE_" + role;
                        authorities.add(new SimpleGrantedAuthority(authority));
                    }
                }

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(username, null,
                        authorities);
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
