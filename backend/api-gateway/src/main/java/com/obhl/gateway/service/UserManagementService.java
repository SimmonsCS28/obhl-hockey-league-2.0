package com.obhl.gateway.service;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.CreateUserRequest;
import com.obhl.gateway.dto.UpdateUserRequest;
import com.obhl.gateway.dto.UserDTO;
import com.obhl.gateway.model.Role;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.RoleRepository;
import com.obhl.gateway.repository.UserRepository;

@Service
public class UserManagementService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Get all active users
     */
    public List<UserDTO> getAllUsers() {
        return userRepository.findByIsActive(true)
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get user by ID
     */
    public UserDTO getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
        return convertToDTO(user);
    }

    /**
     * Create new user
     */
    @Transactional
    public UserDTO createUser(CreateUserRequest request) {
        // Check if username or email already exists
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new RuntimeException("Username already exists: " + request.getUsername());
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already exists: " + request.getEmail());
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        if (request.getRoles() != null && !request.getRoles().isEmpty()) {
            Set<Role> roles = new HashSet<>();
            for (String roleName : request.getRoles()) {
                Role role = roleRepository.findByName(roleName)
                        .orElseThrow(() -> new RuntimeException("Role not found: " + roleName));
                roles.add(role);
            }
            user.setRoles(roles);
            // BACKWARD COMPATIBILITY: Set the first role in the deprecated field
            user.setRole(request.getRoles().iterator().next());
        } else if (request.getRole() != null) {
            // Fallback for requests using the old 'role' field
            Role role = roleRepository.findByName(request.getRole())
                    .orElseThrow(() -> new RuntimeException("Role not found: " + request.getRole()));
            user.setRoles(Collections.singleton(role));
            user.setRole(request.getRole());
        } else {
            // Default role
            Role userRole = roleRepository.findByName("USER")
                    .orElseThrow(() -> new RuntimeException("Default role 'USER' not found"));
            user.setRoles(Collections.singleton(userRole));
            user.setRole("USER");
        }
        user.setTeamId(request.getTeamId());
        user.setIsActive(true);
        user.setMustChangePassword(true); // New users must change password on first login

        User savedUser = userRepository.save(user);
        return convertToDTO(savedUser);
    }

    /**
     * Update user
     */
    @Transactional
    public UserDTO updateUser(Long id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));

        // Update fields if provided
        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            // Check if new username conflicts with another user
            userRepository.findByUsername(request.getUsername())
                    .ifPresent(existingUser -> {
                        if (!existingUser.getId().equals(id)) {
                            throw new RuntimeException("Username already exists: " + request.getUsername());
                        }
                    });
            user.setUsername(request.getUsername());
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            // Check if new email conflicts with another user
            userRepository.findByEmail(request.getEmail())
                    .ifPresent(existingUser -> {
                        if (!existingUser.getId().equals(id)) {
                            throw new RuntimeException("Email already exists: " + request.getEmail());
                        }
                    });
            user.setEmail(request.getEmail());
        }

        if (request.getRoles() != null) {
            Set<Role> roles = new HashSet<>();
            for (String roleName : request.getRoles()) {
                Role role = roleRepository.findByName(roleName)
                        .orElseThrow(() -> new RuntimeException("Role not found: " + roleName));
                roles.add(role);
            }
            user.setRoles(roles);
            // BACKWARD COMPATIBILITY
            if (!roles.isEmpty()) {
                user.setRole(roles.iterator().next().getName());
            }
        } else if (request.getRole() != null && !request.getRole().isBlank()) {
            Role role = roleRepository.findByName(request.getRole())
                    .orElseThrow(() -> new RuntimeException("Role not found: " + request.getRole()));
            user.setRoles(Collections.singleton(role));
            user.setRole(request.getRole());
        }

        if (request.getTeamId() != null) {
            user.setTeamId(request.getTeamId());
        }

        // If password is being changed, hash it and set mustChangePassword flag
        if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
            user.setMustChangePassword(true);
        }

        User updatedUser = userRepository.save(user);
        return convertToDTO(updatedUser);
    }

    /**
     * Soft delete user (mark as inactive)
     */
    @Transactional
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));

        user.setIsActive(false);
        userRepository.save(user);
    }

    /**
     * Update user roles
     */
    @Transactional
    public UserDTO updateUserRoles(Long id, List<String> roleNames) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));

        if (roleNames == null || roleNames.isEmpty()) {
            throw new RuntimeException("At least one role must be specified");
        }

        Set<Role> roles = new HashSet<>();
        for (String roleName : roleNames) {
            Role role = roleRepository.findByName(roleName)
                    .orElseThrow(() -> new RuntimeException("Role not found: " + roleName));
            roles.add(role);
        }

        user.setRoles(roles);
        // BACKWARD COMPATIBILITY: Set the first role in the deprecated field
        user.setRole(roleNames.get(0));

        User updatedUser = userRepository.save(user);
        return convertToDTO(updatedUser);
    }

    /**
     * Convert User entity to UserDTO (without password)
     */
    private UserDTO convertToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole());
        dto.setRoles(user.getRoles().stream().map(Role::getName).collect(Collectors.toSet()));
        dto.setTeamId(user.getTeamId());
        dto.setIsActive(user.getIsActive());
        dto.setMustChangePassword(user.getMustChangePassword());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        // passwordHash is intentionally NOT included
        return dto;
    }
}
