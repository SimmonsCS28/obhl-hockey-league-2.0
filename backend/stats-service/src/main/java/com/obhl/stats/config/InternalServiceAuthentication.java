package com.obhl.stats.config;

import java.util.List;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Marks a request as coming from one of our own backend services (api-gateway,
 * league-service, game-service) rather than an end user. Granted only when the caller
 * presents the shared X-Internal-Service-Key — never derived from anything a browser
 * client could send. Used to let trusted server-to-server calls (goal-limit checks,
 * draft ordering, stats aggregation) keep reading full player data, incl. skillRating,
 * without requiring those internal calls to carry an end user's JWT.
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
