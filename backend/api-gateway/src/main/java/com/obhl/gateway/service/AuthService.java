package com.obhl.gateway.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.obhl.gateway.dto.AuthDto;
import com.obhl.gateway.model.Role;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.RoleRepository;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.util.JwtUtil;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    // Roles a user is allowed to grant/revoke for themselves via Account Settings
    private static final java.util.Set<String> SELF_SERVICE_ROLES = java.util.Set.of("GOALIE", "REF", "SCOREKEEPER");

    // Priority order for choosing a user's primary (legacy) role, highest first.
    private static final java.util.List<String> ROLE_PRIORITY = java.util.List.of(
            "ADMIN", "GM", "USER", "SCOREKEEPER", "REF", "GOALIE");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthDto.LoginResponse login(AuthDto.LoginRequest request) {
        // Trim before lookup: mobile autofill and copy/paste routinely append a trailing
        // space, which would otherwise fail the lookup and surface as "invalid credentials".
        String identifier = request.getUsernameOrEmail() != null
                ? request.getUsernameOrEmail().trim()
                : "";

        log.info("Login attempt for: {}", identifier);

        // Find user by username or email (case-insensitive)
        java.util.List<User> matches = userRepository
                .findAllByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier);

        if (matches.isEmpty()) {
            log.warn("User not found: {}", identifier);
            throw new RuntimeException("Invalid credentials");
        }

        User user;
        if (matches.size() == 1) {
            user = matches.get(0);
        } else {
            // Duplicate rows that differ only by case. Don't lock the person out — authenticate
            // against whichever row their password actually belongs to — but make the data
            // problem loud so it gets cleaned up rather than sitting silent.
            log.error("Duplicate accounts for identifier '{}': ids={}. Merge these rows.",
                    identifier,
                    matches.stream().map(u -> String.valueOf(u.getId()))
                            .collect(java.util.stream.Collectors.joining(", ")));

            user = matches.stream()
                    .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                    .filter(u -> passwordEncoder.matches(request.getPassword(), u.getPasswordHash()))
                    // Most recently created wins: later rows carry the current onboarding state.
                    .max(java.util.Comparator.comparing(User::getId))
                    .orElse(matches.get(matches.size() - 1));
        }

        log.info("User found: id={}, username={}", user.getId(), user.getUsername());

        // Check if user is active. Legacy rows can carry a NULL is_active, which would
        // otherwise NPE on unboxing and get swallowed as a generic credentials failure.
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            log.warn("User account is inactive: {}", user.getUsername());
            throw new RuntimeException("User account is inactive");
        }

        // Never log password material — the stored hash and any derived hash stay out of the logs.
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Password verification failed for user: {}", user.getUsername());
            throw new RuntimeException("Invalid credentials");
        }

        log.info("Login successful for user: {}", user.getUsername());

        // Record last login
        user.setLastLogin(java.time.Instant.now());
        userRepository.save(user);

        // Generate JWT token
        String token = jwtUtil.generateToken(user);

        // Create user info
        // Build roles list from multi-role set
        java.util.List<String> roleNames = user.getRoles() != null
                ? user.getRoles().stream().map(r -> r.getName()).collect(java.util.stream.Collectors.toList())
                : java.util.Collections.emptyList();

        AuthDto.UserInfo userInfo = new AuthDto.UserInfo(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole(),
                roleNames,
                user.getTeamId(),
                user.getLastLogin());

        // Create login response with password change flag and security question status
        boolean hasSecurityQuestion = user.getSecurityQuestion() != null
                && !user.getSecurityQuestion().isBlank();
        AuthDto.LoginResponse response = new AuthDto.LoginResponse(token, "Bearer", userInfo,
                user.getMustChangePassword(), hasSecurityQuestion);

        return response;
    }

    public User getUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public void changePassword(Long userId, AuthDto.ChangePasswordRequest request) {
        User user = getUserById(userId);

        // Verify old password
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Current password is incorrect");
        }

        // Validate new password
        if (request.getNewPassword() == null || request.getNewPassword().length() < 8) {
            throw new RuntimeException("New password must be at least 8 characters");
        }

        // Update password and clear must_change_password flag
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setMustChangePassword(false);

        // Save security question/answer if provided (first-login setup)
        if (request.getSecurityQuestion() != null && !request.getSecurityQuestion().isBlank()
                && request.getSecurityAnswer() != null && !request.getSecurityAnswer().isBlank()) {
            user.setSecurityQuestion(request.getSecurityQuestion());
            user.setSecurityAnswerHash(passwordEncoder
                    .encode(UserManagementService.normalizeSecurityAnswer(request.getSecurityAnswer())));
            log.info("Security question set for user: {}", user.getUsername());
        }

        userRepository.save(user);

        log.info("Password changed successfully for user: {}", user.getUsername());
    }

    public AuthDto.ProfileResponse getProfile(Long userId) {
        User user = getUserById(userId);
        boolean hasSecurityQuestion = user.getSecurityQuestion() != null && !user.getSecurityQuestion().isBlank();
        return new AuthDto.ProfileResponse(
                user.getUsername(),
                user.getEmail(),
                hasSecurityQuestion ? user.getSecurityQuestion() : null,
                currentStaffRoles(user));
    }

    private String primaryRole(java.util.Set<String> roleNames) {
        for (String r : ROLE_PRIORITY) {
            if (roleNames.contains(r)) {
                return r;
            }
        }
        return roleNames.stream().findFirst().orElse(null);
    }

    private java.util.List<String> currentStaffRoles(User user) {
        if (user.getRoles() == null) {
            return java.util.Collections.emptyList();
        }
        return user.getRoles().stream()
                .map(Role::getName)
                .filter(SELF_SERVICE_ROLES::contains)
                .sorted()
                .collect(java.util.stream.Collectors.toList());
    }

    public AuthDto.UpdateProfileResponse updateProfile(Long userId, AuthDto.UpdateProfileRequest request) {
        User user = getUserById(userId);

        // Verify current password to authorize any change
        if (request.getCurrentPassword() == null
                || !passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Current password is incorrect");
        }

        boolean usernameChanged = false;

        // Username
        if (request.getUsername() != null && !request.getUsername().isBlank()
                && !request.getUsername().equalsIgnoreCase(user.getUsername())) {
            String newUsername = request.getUsername().trim();
            if (userRepository.findByUsernameIgnoreCase(newUsername).isPresent()) {
                throw new RuntimeException("Username is already taken");
            }
            user.setUsername(newUsername);
            usernameChanged = true;
        }

        // Email
        if (request.getEmail() != null && !request.getEmail().isBlank()
                && !request.getEmail().equalsIgnoreCase(user.getEmail())) {
            String newEmail = request.getEmail().trim();
            if (userRepository.findByEmailIgnoreCase(newEmail).isPresent()) {
                throw new RuntimeException("Email is already in use");
            }
            user.setEmail(newEmail);
        }

        // Password
        if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
            if (request.getNewPassword().length() < 8) {
                throw new RuntimeException("New password must be at least 8 characters");
            }
            user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        }

        // Security question/answer
        if (request.getSecurityQuestion() != null && !request.getSecurityQuestion().isBlank()
                && request.getSecurityAnswer() != null && !request.getSecurityAnswer().isBlank()) {
            user.setSecurityQuestion(request.getSecurityQuestion());
            user.setSecurityAnswerHash(passwordEncoder
                    .encode(UserManagementService.normalizeSecurityAnswer(request.getSecurityAnswer())));
        }

        // Self-service volunteer roles (GOALIE/REF/SCOREKEEPER). When provided, reconcile the
        // user's staff roles to exactly the requested set while leaving all other roles intact.
        boolean rolesChanged = false;
        if (request.getStaffRoles() != null) {
            java.util.Set<String> desired = request.getStaffRoles().stream()
                    .filter(java.util.Objects::nonNull)
                    .map(r -> r.trim().toUpperCase())
                    .collect(java.util.stream.Collectors.toSet());

            for (String roleName : desired) {
                if (!SELF_SERVICE_ROLES.contains(roleName)) {
                    throw new RuntimeException("Role cannot be self-assigned: " + roleName);
                }
            }

            java.util.Set<String> before = user.getRoles().stream().map(Role::getName)
                    .collect(java.util.stream.Collectors.toSet());

            // Keep every non-self-service role the user already has...
            java.util.Set<Role> newRoles = user.getRoles().stream()
                    .filter(r -> !SELF_SERVICE_ROLES.contains(r.getName()))
                    .collect(java.util.stream.Collectors.toSet());

            // ...then add exactly the requested staff roles.
            for (String roleName : desired) {
                Role role = roleRepository.findByName(roleName)
                        .orElseThrow(() -> new RuntimeException("Role not found: " + roleName));
                newRoles.add(role);
            }

            java.util.Set<String> after = newRoles.stream().map(Role::getName)
                    .collect(java.util.stream.Collectors.toSet());

            if (!before.equals(after)) {
                user.setRoles(newRoles);
                // Keep the deprecated single-role column consistent. Legacy checks (including the
                // frontend's hasAnyRole fallback) still read user.role, so it must not keep pointing
                // at a staff role the user just gave up.
                if (user.getRole() == null || !after.contains(user.getRole())) {
                    user.setRole(primaryRole(after));
                }
                rolesChanged = true;
            }
        }

        userRepository.save(user);

        log.info("Profile updated successfully for user: {}", user.getUsername());

        java.util.List<String> roleNames = user.getRoles() != null
                ? user.getRoles().stream().map(r -> r.getName()).collect(java.util.stream.Collectors.toList())
                : java.util.Collections.emptyList();

        AuthDto.UserInfo userInfo = new AuthDto.UserInfo(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole(),
                roleNames,
                user.getTeamId(),
                user.getLastLogin());

        // A stale JWT carries the old username and roles claims, so reissue when either changes.
        String newToken = (usernameChanged || rolesChanged) ? jwtUtil.generateToken(user) : null;

        return new AuthDto.UpdateProfileResponse("Profile updated successfully", userInfo, newToken);
    }
}
