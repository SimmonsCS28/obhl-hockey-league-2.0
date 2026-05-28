package com.obhl.gateway.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.CreateUserRequest;
import com.obhl.gateway.dto.GeneratePreviewDTO;
import com.obhl.gateway.dto.PlayerDto;
import com.obhl.gateway.dto.UpdateUserRequest;
import com.obhl.gateway.dto.UserDTO;
import com.obhl.gateway.model.Role;
import com.obhl.gateway.model.User;

@Service
public class UserManagementService {

    @Autowired
    private com.obhl.gateway.repository.GoalieProfileRepository goalieProfileRepository;

    @Autowired
    private com.obhl.gateway.repository.UserRepository userRepository;

    @Autowired
    private com.obhl.gateway.repository.RoleRepository roleRepository;

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
     * Get users by role
     */
    @Transactional(readOnly = true)
    public List<UserDTO> getUsersByRole(String roleName) {
        return userRepository.findByRoles_Name(roleName)
                .stream()
                .filter(user -> user.getIsActive()) // Ensure we only get active users
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get user by ID
     */
    public UserDTO getUserById(Long id) {
        if (id == null) {
            throw new RuntimeException("User ID cannot be null");
        }
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
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
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
        user.setMustChangePassword(false); // Self-signup users chose their own password

        // set security question and hash answer (optional for admin-created users)
        if (request.getSecurityQuestion() != null) {
            user.setSecurityQuestion(request.getSecurityQuestion());
        }
        if (request.getSecurityAnswer() != null) {
            user.setSecurityAnswerHash(passwordEncoder.encode(request.getSecurityAnswer()));
        }

        User savedUser = userRepository.save(user);
        return convertToDTO(savedUser);
    }

    /**
     * Update user
     */
    @Transactional
    public UserDTO updateUser(Long id, UpdateUserRequest request) {
        if (id == null) {
            throw new RuntimeException("User ID cannot be null");
        }
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

        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName());
        }

        if (request.getLastName() != null) {
            user.setLastName(request.getLastName());
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
        if (id == null) {
            throw new RuntimeException("User ID cannot be null");
        }
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
        if (id == null) {
            throw new RuntimeException("User ID cannot be null");
        }
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
     * Get security question for a username
     */
    @Transactional(readOnly = true)
    public String getSecurityQuestion(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        if (user.getSecurityQuestion() == null || user.getSecurityQuestion().isBlank()) {
            throw new RuntimeException("No security question set for this user. Please contact admin.");
        }

        return user.getSecurityQuestion();
    }

    /**
     * Verify security answer and reset password
     */
    @Transactional
    public void verifyAndResetPassword(String username, String answer, String newPassword) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        if (user.getSecurityAnswerHash() == null) {
            throw new RuntimeException("Security answer not set. Cannot reset password.");
        }

        if (!passwordEncoder.matches(answer, user.getSecurityAnswerHash())) {
            throw new RuntimeException("Incorrect security answer.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false); // Reset successful, they know the password now
        userRepository.save(user);
    }

    @Autowired
    private PlayerService playerService;

    /**
     * Preview which players would get new users and which are potential duplicates.
     * Deduplicates players by email (one per unique email, preferring the most recent season).
     */
    @Transactional(readOnly = true)
    public GeneratePreviewDTO previewGenerateUsers() {
        List<PlayerDto> allPlayers = playerService.getAllPlayers();

        // Deduplicate: keep one PlayerDto per email (last-seen wins)
        Map<String, PlayerDto> uniqueByEmail = new LinkedHashMap<>();
        for (PlayerDto p : allPlayers) {
            if (p.getEmail() != null && !p.getEmail().isBlank()) {
                uniqueByEmail.put(p.getEmail().toLowerCase().trim(), p);
            }
        }

        List<PlayerDto> toCreate = new ArrayList<>();
        List<GeneratePreviewDTO.PotentialDuplicate> conflicts = new ArrayList<>();

        for (PlayerDto player : uniqueByEmail.values()) {
            String email = player.getEmail().toLowerCase().trim();

            // Skip if a user with this exact email already exists
            if (userRepository.findByEmail(email).isPresent() ||
                    userRepository.findByUsername(email).isPresent()) {
                continue;
            }

            // Check for a name-based match (same first + last, different email)
            String firstName = player.getFirstName() != null ? player.getFirstName().trim() : "";
            String lastName  = player.getLastName()  != null ? player.getLastName().trim()  : "";
            Optional<User> nameMatch = userRepository
                    .findByFirstNameIgnoreCaseAndLastNameIgnoreCase(firstName, lastName);

            if (nameMatch.isPresent()) {
                conflicts.add(new GeneratePreviewDTO.PotentialDuplicate(player, convertToDTO(nameMatch.get())));
            } else {
                toCreate.add(player);
            }
        }

        return new GeneratePreviewDTO(toCreate, conflicts);
    }

    /**
     * Generate users from players who don't have an account.
     * Deduplicates players by email to avoid processing the same person twice across seasons.
     */
    @Transactional
    public List<UserDTO> generateUsersFromPlayers() {
        List<PlayerDto> allPlayers = playerService.getAllPlayers();

        // Deduplicate by email — same person can appear in multiple seasons
        Map<String, PlayerDto> uniqueByEmail = new LinkedHashMap<>();
        for (PlayerDto p : allPlayers) {
            if (p.getEmail() != null && !p.getEmail().isBlank()) {
                uniqueByEmail.put(p.getEmail().toLowerCase().trim(), p);
            }
        }

        List<UserDTO> createdUsers = new ArrayList<>();

        // Get default USER role
        Role userRole = roleRepository.findByName("USER")
                .orElseThrow(() -> new RuntimeException("Default role 'USER' not found"));
        Set<Role> roles = Collections.singleton(userRole);

        // Default password
        String defaultPasswordHash = passwordEncoder.encode("Welcome1!");

        for (PlayerDto player : uniqueByEmail.values()) {
            String email = player.getEmail().toLowerCase().trim();

            // Check if user already exists by email or username
            if (userRepository.findByEmail(email).isPresent() ||
                    userRepository.findByUsername(email).isPresent()) {
                continue;
            }

            // Create new user
            User user = new User();
            user.setUsername(email);
            user.setEmail(email);
            user.setFirstName(player.getFirstName());
            user.setLastName(player.getLastName());
            user.setPasswordHash(defaultPasswordHash);
            user.setRoles(roles);
            user.setRole("USER");
            user.setIsActive(true);
            user.setMustChangePassword(true);

            User savedUser = userRepository.save(user);
            createdUsers.add(convertToDTO(savedUser));
        }

        return createdUsers;
    }

    @Transactional
    public List<UserDTO> importGoalies(List<com.obhl.gateway.dto.GoalieImportDTO> goalieDtos) {
        List<UserDTO> createdUsers = new java.util.ArrayList<>();
        Role goalieRole = roleRepository.findByName("GOALIE")
                .orElseThrow(() -> new RuntimeException("Role 'GOALIE' not found"));

        String defaultPasswordHash = passwordEncoder.encode("Welcome1!");

        for (com.obhl.gateway.dto.GoalieImportDTO dto : goalieDtos) {
            String email = dto.getEmail().trim();
            if (userRepository.findByEmail(email).isPresent() || userRepository.findByUsername(email).isPresent()) {
                continue; // Skip if user exists
            }

            User user = new User();
            user.setUsername(email);
            user.setEmail(email);
            user.setFirstName(dto.getFirstName());
            user.setLastName(dto.getLastName());
            user.setPhoneNumber(dto.getPhoneNumber());
            user.setPasswordHash(defaultPasswordHash);
            user.setRoles(Collections.singleton(goalieRole));
            user.setIsActive(true);
            user.setMustChangePassword(true);

            User savedUser = userRepository.save(user);

            com.obhl.gateway.model.GoalieProfile profile = new com.obhl.gateway.model.GoalieProfile();
            profile.setUser(savedUser);
            profile.setEmail(email);
            profile.setSkillRating(dto.getSkillRating());
            profile.setWins(0);
            profile.setLosses(0);
            profile.setIsActive(true);

            goalieProfileRepository.save(profile);
            createdUsers.add(convertToDTO(savedUser));
        }
        return createdUsers;
    }

    /**
     * Convert User entity to UserDTO (without password)
     */
    private UserDTO convertToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setRole(user.getRole());
        dto.setRoles(user.getRoles().stream().map(Role::getName).collect(Collectors.toSet()));
        dto.setTeamId(user.getTeamId());
        dto.setIsActive(user.getIsActive());
        dto.setMustChangePassword(user.getMustChangePassword());
        dto.setPhoneNumber(user.getPhoneNumber()); // Add phone number to DTO
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        dto.setLastLogin(user.getLastLogin());
        // passwordHash is intentionally NOT included
        return dto;
    }
}
