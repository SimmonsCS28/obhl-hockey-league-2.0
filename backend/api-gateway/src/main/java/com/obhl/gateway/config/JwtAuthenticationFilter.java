package com.obhl.gateway.config;

import java.io.IOException;
import java.util.ArrayList;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.obhl.gateway.util.JwtUtil;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

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
                // Extract roles from token
                java.util.List<String> roles = jwtUtil.getRolesFromToken(token);
                System.out.println("DEBUG: Username: " + username);
                System.out.println("DEBUG: Roles from token: " + roles);

                var authorities = new ArrayList<SimpleGrantedAuthority>();

                if (roles != null) {
                    for (String role : roles) {
                        System.out.println("DEBUG: Adding authority: " + role);
                        // Check if role already starts with ROLE_
                        String authority = role.startsWith("ROLE_") ? role : "ROLE_" + role;
                        authorities.add(new SimpleGrantedAuthority(authority));
                    }
                } else {
                    // Fallback to legacy single role
                    String role = jwtUtil.getRoleFromToken(token);
                    System.out.println("DEBUG: Fallback legacy role: " + role);
                    if (role != null) {
                        String authority = role.startsWith("ROLE_") ? role : "ROLE_" + role;
                        authorities.add(new SimpleGrantedAuthority(authority));
                    }
                }
                System.out.println("DEBUG: Final Authorities: " + authorities);

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(username, null,
                        authorities);
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
