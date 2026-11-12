package com.obhl.game.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import com.obhl.game.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Authenticates signed gateway tokens or explicitly configured backend credentials. */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final byte[] internalServiceKey;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, @Value("${internal.service.key}") String key) {
        if (key == null || key.isBlank() || key.length() < 32
                || key.equals("obhl-internal-service-key-change-in-production")) {
            throw new IllegalArgumentException("INTERNAL_SERVICE_KEY must be a new secret of at least 32 characters");
        }
        this.jwtUtil = jwtUtil;
        this.internalServiceKey = key.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String internalKey = request.getHeader("X-Internal-Service-Key");
        if (internalKey != null) {
            if (!MessageDigest.isEqual(internalServiceKey, internalKey.getBytes(StandardCharsets.UTF_8))) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
            SecurityContextHolder.getContext().setAuthentication(new InternalServiceAuthentication());
        } else {
            String header = request.getHeader("Authorization");
            if (header != null) {
                try {
                    if (!header.startsWith("Bearer ")) throw new IllegalArgumentException("Bearer token required");
                    String token = header.substring(7);
                    String username = jwtUtil.extractUsername(token);
                    if (username == null || username.isBlank()) throw new IllegalArgumentException("Missing username");
                    List<String> roles = jwtUtil.getRolesFromToken(token);
                    if (roles == null || roles.isEmpty()) {
                        String legacyRole = jwtUtil.getRoleFromToken(token);
                        roles = legacyRole == null ? List.of() : List.of(legacyRole);
                    }
                    var authorities = new ArrayList<SimpleGrantedAuthority>();
                    for (String role : roles) {
                        String authority = role.startsWith("ROLE_") ? role : "ROLE_" + role;
                        // A user JWT must never impersonate a backend service.
                        if (!InternalServiceAuthentication.AUTHORITY.equals(authority)) {
                            authorities.add(new SimpleGrantedAuthority(authority));
                        }
                    }
                    SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(username, null, authorities));
                } catch (Exception invalidToken) {
                    SecurityContextHolder.clearContext();
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                    return;
                }
            }
        }
        chain.doFilter(request, response);
    }
}
