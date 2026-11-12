package com.obhl.stats.config;

import java.util.List;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Backend identity granted only after checking the configured shared service secret.
 * Browser-facing gateway proxies never supply this credential. It permits trusted
 * workflow calls without giving a user's JWT the INTERNAL_SERVICE authority.
 */
public class InternalServiceAuthentication extends AbstractAuthenticationToken {

    public static final String AUTHORITY = "ROLE_INTERNAL_SERVICE";

    public InternalServiceAuthentication() {
        super(List.of(new SimpleGrantedAuthority(AUTHORITY)));
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return null;
    }

    @Override
    public Object getPrincipal() {
        return "internal-service";
    }
}
