package com.obhl.gateway.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.obhl.gateway.dto.AuthDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.util.JwtUtil;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthDto.LoginResponse login(AuthDto.LoginRequest request) {
        log.info("Login attempt for: {}", request.getUsernameOrEmail());

        // Find user by username or email (case-insensitive)
        User user = userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(
                request.getUsernameOrEmail(),
                request.getUsernameOrEmail())
                .orElseThrow(() -> {
                    log.warn("User not found: {}", request.getUsernameOrEmail());
                    return new RuntimeException("Invalid credentials");
                });

        System.out.println("DEBUG: AuthService.login called for user: " + user.getUsername());

        log.info("User found: id={}, username={}, email={}, role={}",
                user.getId(), user.getUsername(), user.getEmail(), user.getRole());

        // Check if user is active
        if (!user.getIsActive()) {
            log.warn("User account is inactive: {}", user.getUsername());
            throw new RuntimeException("User account is inactive");
        }

        // Log password verification details
        String providedPassword = request.getPassword();
        String storedHash = user.getPasswordHash();

        log.info("Password verification:");
        log.info("  Provided password length: {}", providedPassword.length());
        log.info("  Stored hash: {}", storedHash);
        log.info("  Hash starts with: {}",
                storedHash != null ? storedHash.substring(0, Math.min(10, storedHash.length())) : "null");

        // Generate a test hash to verify encoder is working
        String testHash = passwordEncoder.encode(providedPassword);
        log.info("  Test hash of provided password: {}", testHash);
        log.info("  Test hash starts with: {}", testHash.substring(0, Math.min(10, testHash.length())));

        // Verify password
        boolean passwordMatches = passwordEncoder.matches(providedPassword, storedHash);
        log.info("  Password matches: {}", passwordMatches);

        if (!passwordMatches) {
            log.warn("Password verification failed for user: {}", user.getUsername());
            throw new RuntimeException("Invalid credentials");
        }

        log.info("Login successful for user: {}", user.getUsername());

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
                user.getRole(),
                roleNames,
                user.getTeamId());

        // Create login response with password change flag
        AuthDto.LoginResponse response = new AuthDto.LoginResponse(token, "Bearer", userInfo,
                user.getMustChangePassword());

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
        userRepository.save(user);

        log.info("Password changed successfully for user: {}", user.getUsername());
    }
}
