package com.obhl.gateway.service;

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

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthDto.LoginResponse login(AuthDto.LoginRequest request) {
        // Find user by username or email
        User user = userRepository.findByUsernameOrEmail(
                request.getUsernameOrEmail(),
                request.getUsernameOrEmail())
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        // Check if user is active
        if (!user.getIsActive()) {
            throw new RuntimeException("User account is inactive");
        }

        // Verify password
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }

        // Generate JWT token
        String token = jwtUtil.generateToken(user);

        // Create user info
        AuthDto.UserInfo userInfo = new AuthDto.UserInfo(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole(),
                user.getTeamId());

        return new AuthDto.LoginResponse(token, "Bearer", userInfo);
    }

    public User getUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
