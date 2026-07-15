package com.obhl.stats.config;

import java.util.Set;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

/**
 * Who's allowed to see/edit a player's skill rating (and other staff-only fields like
 * email/birthDate). Centralized so PlayerController's read-masking and GMController's
 * write check enforce the exact same rule.
 */
public final class PlayerAccess {

    private static final Set<String> PRIVILEGED_ROLES = Set.of("ROLE_ADMIN", "ROLE_GM", "ROLE_GOALIE_COORDINATOR");

    private PlayerAccess() {
    }

    /** True for staff roles (ADMIN/GM/GOALIE_COORDINATOR) and trusted internal service calls. */
    public static boolean isPrivileged(Authentication authentication) {
        return hasAnyAuthority(authentication, PRIVILEGED_ROLES) || isInternalService(authentication);
    }

    public static boolean isInternalService(Authentication authentication) {
        return hasAnyAuthority(authentication, Set.of(InternalServiceAuthentication.AUTHORITY));
    }

    public static boolean hasRole(Authentication authentication, String role) {
        return hasAnyAuthority(authentication, Set.of("ROLE_" + role));
    }

    /**
     * Skill rating writes: ADMIN/GM can rate anyone; GOALIE_COORDINATOR is scoped to
     * goalies only (position "G") — enforced here, not just hidden in the UI, since
     * the write endpoints take an arbitrary playerId. Trusted internal calls (draft
     * finalization, roster import via league-service) also bypass — those write
     * server-computed ratings with no end-user session to check roles against.
     */
    public static boolean canRateSkill(Authentication authentication, String playerPosition) {
        if (isInternalService(authentication)) {
            return true;
        }
        if (hasRole(authentication, "ADMIN") || hasRole(authentication, "GM")) {
            return true;
        }
        if (hasRole(authentication, "GOALIE_COORDINATOR")) {
            return "G".equals(playerPosition);
        }
        return false;
    }

    private static boolean hasAnyAuthority(Authentication authentication, Set<String> authorities) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (authorities.contains(authority.getAuthority())) {
                return true;
            }
        }
        return false;
    }
}
