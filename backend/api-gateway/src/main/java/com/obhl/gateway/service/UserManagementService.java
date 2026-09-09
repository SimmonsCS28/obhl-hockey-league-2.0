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

    @Autowired
    private EmailService emailService;

    @Autowired
    private com.obhl.gateway.client.LeagueClient leagueClient;

    @Autowired
    private com.obhl.gateway.client.StatsClient statsClient;

    @Autowired
    private com.obhl.gateway.repository.SeasonGoalieRepository seasonGoalieRepository;

    @org.springframework.beans.factory.annotation.Value("${app.frontend.url:https://oldbuzzardhockey.com}")
    private String frontendUrl;

    private static final long PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;

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
        // Login matches on username/email case-insensitively, so these checks must too.
        // A case-sensitive check lets "A_user@x.com" and "a_user@x.com" both be created,
        // after which neither account can log in.
        String username = request.getUsername() != null ? request.getUsername().trim() : null;
        String email = request.getEmail() != null ? request.getEmail().trim() : null;

        if (username != null && userRepository.findByUsernameIgnoreCase(username).isPresent()) {
            throw new RuntimeException("Username already exists: " + username);
        }
        if (email != null && userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new RuntimeException("Email already exists: " + email);
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
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
            user.setSecurityAnswerHash(passwordEncoder.encode(normalizeSecurityAnswer(request.getSecurityAnswer())));
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
            // Case-insensitive, to match how login resolves the account.
            String newUsername = request.getUsername().trim();
            userRepository.findByUsernameIgnoreCase(newUsername)
                    .ifPresent(existingUser -> {
                        if (!existingUser.getId().equals(id)) {
                            throw new RuntimeException("Username already exists: " + newUsername);
                        }
                    });
            user.setUsername(newUsername);
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String newEmail = request.getEmail().trim();
            userRepository.findByEmailIgnoreCase(newEmail)
                    .ifPresent(existingUser -> {
                        if (!existingUser.getId().equals(id)) {
                            throw new RuntimeException("Email already exists: " + newEmail);
                        }
                    });
            user.setEmail(newEmail);
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
        User user = findForPasswordReset(username);

        if (user.getSecurityQuestion() == null || user.getSecurityQuestion().isBlank()) {
            // Most accounts have no security question yet (it's only set during the forced
            // first-login flow), so this is the common path, not an edge case. Point at the
            // email option one click away rather than dead-ending them at "contact admin".
            throw new RuntimeException(
                    "You haven't set a security question yet. Choose \"Email Me a Reset Link\" instead — "
                            + "we'll send a reset link to your account email.");
        }

        return user.getSecurityQuestion();
    }

    /**
     * Verify security answer and reset password
     */
    /**
     * Resolve the account for a self-service password reset. Accepts either a username or an
     * email, case-insensitively, because the Forgot Password form asks for "username" and most
     * members' username *is* their email — a case-sensitive, username-only lookup left them
     * with "User not found" and no way back into their account.
     */
    /**
     * Security answers are compared case- and whitespace-insensitively. Every write and every
     * comparison must run through this, or an answer set on one screen won't verify on another.
     */
    static String normalizeSecurityAnswer(String answer) {
        return answer == null ? null : answer.trim().toLowerCase();
    }

    private User findForPasswordReset(String usernameOrEmail) {
        String identifier = usernameOrEmail != null ? usernameOrEmail.trim() : "";
        return userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier)
                .orElseThrow(() -> new RuntimeException("User not found: " + identifier));
    }

    @Transactional
    public void verifyAndResetPassword(String username, String answer, String newPassword) {
        User user = findForPasswordReset(username);

        if (user.getSecurityAnswerHash() == null) {
            throw new RuntimeException("Security answer not set. Cannot reset password.");
        }

        // Answers are stored normalised (see normalizeSecurityAnswer) and the UI promises
        // "not case-sensitive", so normalise on the way in too rather than matching raw.
        if (!passwordEncoder.matches(normalizeSecurityAnswer(answer), user.getSecurityAnswerHash())) {
            throw new RuntimeException("Incorrect security answer.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false); // Reset successful, they know the password now
        userRepository.save(user);
    }

    /**
     * Generate a password reset token and email it to the user, if an account
     * with that email exists. Always succeeds silently if the email is unknown,
     * so this endpoint can't be used to enumerate registered emails.
     */
    @Transactional
    public void requestPasswordResetEmail(String email) {
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty()) {
            return;
        }

        User user = userOpt.get();
        String token = java.util.UUID.randomUUID().toString() + java.util.UUID.randomUUID().toString();
        user.setPasswordResetTokenHash(passwordEncoder.encode(token));
        user.setPasswordResetExpiresAt(java.time.Instant.now().plus(PASSWORD_RESET_TOKEN_TTL_MINUTES, java.time.temporal.ChronoUnit.MINUTES));
        userRepository.save(user);

        String resetLink = frontendUrl + "/reset-password?token=" + token + "&email=" + java.net.URLEncoder.encode(user.getEmail(), java.nio.charset.StandardCharsets.UTF_8);
        emailService.sendPasswordResetEmail(user.getEmail(), resetLink);
    }

    /**
     * Reset a user's password using a token emailed to them via requestPasswordResetEmail.
     */
    @Transactional
    public void resetPasswordWithToken(String email, String token, String newPassword) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RuntimeException("Invalid or expired reset link."));

        if (user.getPasswordResetTokenHash() == null || user.getPasswordResetExpiresAt() == null) {
            throw new RuntimeException("Invalid or expired reset link.");
        }

        if (java.time.Instant.now().isAfter(user.getPasswordResetExpiresAt())) {
            throw new RuntimeException("This reset link has expired. Please request a new one.");
        }

        if (!passwordEncoder.matches(token, user.getPasswordResetTokenHash())) {
            throw new RuntimeException("Invalid or expired reset link.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        user.setPasswordResetTokenHash(null);
        user.setPasswordResetExpiresAt(null);
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

            // Skip if a user with this email already exists. Must be case-insensitive: the
            // lookup key is lowercased above, so a case-sensitive check misses accounts stored
            // with any capitalisation and reports them as new.
            if (userRepository.findByEmailIgnoreCase(email).isPresent() ||
                    userRepository.findByUsernameIgnoreCase(email).isPresent()) {
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

            // Check if user already exists by email or username. Case-insensitive — this check
            // being case-sensitive against a lowercased key is what created duplicate accounts
            // for members whose original rows were stored capitalised.
            if (userRepository.findByEmailIgnoreCase(email).isPresent() ||
                    userRepository.findByUsernameIgnoreCase(email).isPresent()) {
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

    /** What the import will do with one CSV row. */
    private enum GoalieImportAction {
        /** Nobody has ever rated them: the admin sets the rating in the review modal. */
        NEW,
        /** Already in the league: their last known rating comes forward, unchanged. */
        CARRY_FORWARD,
        /** Nothing to do. */
        SKIP
    }

    private static class ClassifiedGoalie {
        com.obhl.gateway.dto.GoalieImportDTO dto;
        String email;
        GoalieImportAction action;
        String reason;
        Integer carriedRating;
        Integer existingRating;
        boolean needsAccount;
    }

    /**
     * Decide what the import should do with each CSV row.
     *
     * Shared by the preview and the import itself so the two cannot drift - the modal shows
     * exactly what the import will do, and the import re-derives it rather than trusting
     * whatever the browser sends back.
     *
     * The CSV has no skill-rating column, so a returning goalie's row arrives at the default.
     * Their rating therefore never comes from the file: it is read off their most recent
     * season and carried forward. Only a goalie nobody has ever rated is put in front of the
     * admin for one.
     */
    private List<ClassifiedGoalie> classifyGoalieImport(
            List<com.obhl.gateway.dto.GoalieImportDTO> goalieDtos, Long activeSeasonId) {

        Map<String, PlayerDto> lastKnown = lastKnownPlayerByEmail(activeSeasonId);
        Set<String> seenEmails = new HashSet<>();
        List<ClassifiedGoalie> out = new ArrayList<>();

        for (com.obhl.gateway.dto.GoalieImportDTO dto : goalieDtos) {
            if (dto.getEmail() == null || dto.getEmail().isBlank()) {
                continue;
            }

            ClassifiedGoalie c = new ClassifiedGoalie();
            c.dto = dto;
            c.email = dto.getEmail().trim();
            String key = c.email.toLowerCase();

            // A CSV that lists the same address twice would otherwise import it twice.
            if (!seenEmails.add(key)) {
                c.action = GoalieImportAction.SKIP;
                c.reason = "Listed more than once in this file";
                out.add(c);
                continue;
            }

            PlayerDto thisSeason = findPlayerForSeason(c.email, activeSeasonId);
            if (thisSeason != null) {
                c.action = GoalieImportAction.SKIP;
                c.reason = "Already on the Players page this season";
                c.existingRating = thisSeason.getSkillRating();
                out.add(c);
                continue;
            }

            c.needsAccount = userRepository.findByEmailIgnoreCase(c.email).isEmpty()
                    && userRepository.findByUsernameIgnoreCase(c.email).isEmpty();

            PlayerDto priorRecord = lastKnown.get(key);
            if (priorRecord != null) {
                c.action = GoalieImportAction.CARRY_FORWARD;
                c.carriedRating = priorRecord.getSkillRating();
            } else {
                c.action = GoalieImportAction.NEW;
            }
            out.add(c);
        }

        return out;
    }

    /**
     * Most recent rated player record per person, keyed by lowercased email.
     *
     * players carries one row per person per season, so "their record" means the row on the
     * newest season they have one for. Seasons after the active one are ignored: a future
     * season that has been set up but not started must not be treated as current.
     */
    private Map<String, PlayerDto> lastKnownPlayerByEmail(Long activeSeasonId) {
        Map<String, PlayerDto> newest = new java.util.HashMap<>();
        try {
            List<PlayerDto> players = playerService.getAllPlayers();
            if (players == null) {
                return newest;
            }
            for (PlayerDto p : players) {
                if (p.getEmail() == null || p.getSkillRating() == null || p.getSeasonId() == null) {
                    continue;
                }
                if (activeSeasonId != null && p.getSeasonId() > activeSeasonId) {
                    continue;
                }
                String key = p.getEmail().trim().toLowerCase();
                PlayerDto seen = newest.get(key);
                if (seen == null || p.getSeasonId() > seen.getSeasonId()) {
                    newest.put(key, p);
                }
            }
        } catch (RuntimeException e) {
            // Ratings are best-effort. Without stats-service every row looks new, and the
            // admin is asked for a rating rather than one being carried forward wrongly.
        }
        return newest;
    }

    /**
     * Split a goalie CSV into the rows the admin still has to rate, the returning goalies
     * whose rating comes forward untouched, and the rows there is nothing to do for.
     */
    @Transactional(readOnly = true)
    public com.obhl.gateway.dto.GoalieImportPreviewDTO previewGoalieImport(
            List<com.obhl.gateway.dto.GoalieImportDTO> goalieDtos) {

        List<com.obhl.gateway.dto.GoalieImportDTO> toImport = new ArrayList<>();
        List<com.obhl.gateway.dto.GoalieImportPreviewDTO.CarriedGoalie> toCarryForward = new ArrayList<>();
        List<com.obhl.gateway.dto.GoalieImportPreviewDTO.SkippedGoalie> alreadyInLeague = new ArrayList<>();

        for (ClassifiedGoalie c : classifyGoalieImport(goalieDtos, resolveActiveSeasonId())) {
            switch (c.action) {
                case NEW:
                    toImport.add(c.dto);
                    break;
                case CARRY_FORWARD:
                    toCarryForward.add(new com.obhl.gateway.dto.GoalieImportPreviewDTO.CarriedGoalie(
                            c.dto, c.carriedRating, c.needsAccount));
                    break;
                case SKIP:
                default:
                    alreadyInLeague.add(new com.obhl.gateway.dto.GoalieImportPreviewDTO.SkippedGoalie(
                            c.dto, c.reason, c.existingRating));
                    break;
            }
        }

        return new com.obhl.gateway.dto.GoalieImportPreviewDTO(toImport, toCarryForward, alreadyInLeague);
    }

    private Long resolveActiveSeasonId() {
        try {
            Map<String, Object> activeSeason = leagueClient.getActiveSeason();
            return ((Number) activeSeason.get("id")).longValue();
        } catch (Exception e) {
            // No active season resolvable - goalies will still be created as users,
            // just without a players row (same as any other onboarding gap); the
            // admin can add them to the Players page manually once a season is active.
            return null;
        }
    }

    private PlayerDto findPlayerForSeason(String email, Long seasonId) {
        if (seasonId == null) {
            return null;
        }
        try {
            return statsClient.getPlayerByEmailAndSeason(email, seasonId);
        } catch (Exception e) {
            // 404 = no player record for this season, which is the answer we wanted.
            return null;
        }
    }

    /**
     * Put every goalie in the file onto this season's roster.
     *
     * A goalie who is new to the league gets an account and the rating the admin chose. A
     * goalie the league already knows gets the season player record they were missing,
     * carrying their existing rating - they are not re-rated and not re-accounted. Either
     * way they end up with the GOALIE role and a player record for the active season, which
     * is what the Players page and the goalie proposer both read.
     */
    @Transactional
    public com.obhl.gateway.dto.GoalieImportResultDTO importGoalies(
            List<com.obhl.gateway.dto.GoalieImportDTO> goalieDtos) {

        List<UserDTO> createdUsers = new java.util.ArrayList<>();
        List<String> carriedForward = new java.util.ArrayList<>();
        int skipped = 0;

        Role goalieRole = roleRepository.findByName("GOALIE")
                .orElseThrow(() -> new RuntimeException("Role 'GOALIE' not found"));

        String defaultPasswordHash = passwordEncoder.encode("Welcome1!");
        Long activeSeasonId = resolveActiveSeasonId();

        for (ClassifiedGoalie c : classifyGoalieImport(goalieDtos, activeSeasonId)) {
            if (c.action == GoalieImportAction.SKIP) {
                skipped++;
                continue;
            }

            com.obhl.gateway.dto.GoalieImportDTO dto = c.dto;

            if (c.needsAccount) {
                User user = new User();
                user.setUsername(c.email);
                user.setEmail(c.email);
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
                profile.setEmail(c.email);
                profile.setIsActive(true);
                goalieProfileRepository.save(profile);

                createdUsers.add(convertToDTO(savedUser));
            } else {
                // Returning goalie who already has an account. Being on the league's goalie
                // list is what the GOALIE role means, and without it their own availability
                // page is closed to them - so add it if it is missing. Additive, like every
                // other role grant here; nothing is taken away.
                grantGoalieRole(c.email, goalieRole);
            }

            if (c.action == GoalieImportAction.CARRY_FORWARD) {
                carriedForward.add(dto.getFirstName() + " " + dto.getLastName());
            }

            // Goalies are treated like regular players (position='G') so they show up
            // on the Players page with the same editable skill rating.
            Integer rating = c.action == GoalieImportAction.CARRY_FORWARD
                    ? c.carriedRating
                    : dto.getSkillRating();
            createSeasonPlayerRow(dto, c.email, rating, activeSeasonId, true);
        }

        // Registering is what makes a goalie full-time, so the roster the weekly proposer
        // runs on is settled here rather than left as a separate job somebody has to know
        // to do. Derived from the season's player records, not from this request, so it is
        // the same answer whether the file added fifteen goalies or none.
        com.obhl.gateway.dto.GoalieRosterSyncDTO roster = syncSeasonGoalieRoster(activeSeasonId);

        return new com.obhl.gateway.dto.GoalieImportResultDTO(createdUsers, carriedForward, skipped, roster);
    }

    /**
     * Settle a season's goalie roster: who the weekly proposer schedules, and who is only a
     * substitute.
     *
     * The rule is the league's: registering for the season makes you full-time, and a goalie
     * who does not register is not dropped — they are carried forward as a substitute, at the
     * rating they already had, so they can still be called on ad hoc. A full-timer who sits a
     * season out is therefore relegated rather than lost.
     *
     * Reads the season's own player records rather than whatever the import happened to
     * process, so it is idempotent and gives the same answer run twice or run standalone
     * against a season that was imported earlier.
     *
     * Deliberately does not demote: an existing roster row is left alone except to promote a
     * goalie who has now registered. Nothing here should undo a hand-made correction.
     */
    @Transactional
    public com.obhl.gateway.dto.GoalieRosterSyncDTO syncSeasonGoalieRoster(Long seasonId) {
        Long season = seasonId != null ? seasonId : resolveActiveSeasonId();
        if (season == null) {
            throw new RuntimeException("No active season to build a goalie roster for");
        }

        Map<String, PlayerDto> lastKnown = lastKnownPlayerByEmail(season);
        List<PlayerDto> allPlayers;
        try {
            allPlayers = playerService.getAllPlayers();
        } catch (RuntimeException e) {
            throw new RuntimeException("Could not read players to build the goalie roster: " + e.getMessage());
        }
        if (allPlayers == null) {
            allPlayers = List.of();
        }

        // --- Registered this season -> full-time ---
        Map<Long, String> fullTime = new LinkedHashMap<>();
        for (PlayerDto p : allPlayers) {
            if (!season.equals(p.getSeasonId()) || p.getEmail() == null) {
                continue;
            }
            if (!"G".equalsIgnoreCase(p.getPosition())) {
                continue;
            }
            // Carried-forward records are inactive; only a registration makes a goalie
            // full-time. Without this the sync promotes every substitute on its second run,
            // because by then it has given them a record for this season itself.
            if (!Boolean.TRUE.equals(p.getIsActive())) {
                continue;
            }
            findUserByEmailOrUsername(p.getEmail().trim()).ifPresent(
                    u -> fullTime.put(u.getId(), displayName(p.getFirstName(), p.getLastName(), u)));
        }

        // --- Everyone on the previous roster who did not -> carried as a substitute ---
        Long priorSeason = seasonGoalieRepository.findAll().stream()
                .map(com.obhl.gateway.model.SeasonGoalie::getSeasonId)
                .filter(id -> id != null && id < season)
                .max(Long::compareTo)
                .orElse(null);

        Map<Long, String> carried = new LinkedHashMap<>();
        int playerRowsCreated = 0;
        if (priorSeason != null) {
            for (com.obhl.gateway.model.SeasonGoalie prior : seasonGoalieRepository.findBySeasonId(priorSeason)) {
                Long uid = prior.getUserId();
                if (uid == null || fullTime.containsKey(uid)) {
                    continue;
                }
                Optional<User> maybeUser = userRepository.findById(uid);
                if (maybeUser.isEmpty() || Boolean.FALSE.equals(maybeUser.get().getIsActive())) {
                    continue;
                }
                User user = maybeUser.get();
                carried.put(uid, displayName(user.getFirstName(), user.getLastName(), user));

                // Their rating has to exist on THIS season's records or the proposer cannot
                // score them — it reads the current season's row and drops anyone unresolved
                // to the league median.
                if (user.getEmail() != null) {
                    String key = user.getEmail().trim().toLowerCase();
                    PlayerDto prev = lastKnown.get(key);
                    if (prev != null && findPlayerForSeason(user.getEmail().trim(), season) == null) {
                        com.obhl.gateway.dto.GoalieImportDTO stand = new com.obhl.gateway.dto.GoalieImportDTO(
                                prev.getFirstName(), prev.getLastName(), user.getEmail().trim(),
                                user.getPhoneNumber(), prev.getSkillRating());
                        createSeasonPlayerRow(stand, user.getEmail().trim(), prev.getSkillRating(), season, false);
                        playerRowsCreated++;
                    }
                }
            }
        }

        // --- Write the roster ---
        Map<Long, com.obhl.gateway.model.SeasonGoalie> existing = new java.util.HashMap<>();
        for (com.obhl.gateway.model.SeasonGoalie sg : seasonGoalieRepository.findBySeasonId(season)) {
            existing.put(sg.getUserId(), sg);
        }

        for (Long uid : fullTime.keySet()) {
            com.obhl.gateway.model.SeasonGoalie row = existing.get(uid);
            if (row == null) {
                row = new com.obhl.gateway.model.SeasonGoalie();
                row.setSeasonId(season);
                row.setUserId(uid);
            } else if (Boolean.TRUE.equals(row.getIsFulltime())) {
                continue;
            }
            row.setIsFulltime(true);
            seasonGoalieRepository.save(row);
        }

        for (Long uid : carried.keySet()) {
            if (existing.containsKey(uid)) {
                continue; // Already on this season's roster — leave whatever it says alone.
            }
            com.obhl.gateway.model.SeasonGoalie row = new com.obhl.gateway.model.SeasonGoalie();
            row.setSeasonId(season);
            row.setUserId(uid);
            row.setIsFulltime(false);
            seasonGoalieRepository.save(row);
        }

        return new com.obhl.gateway.dto.GoalieRosterSyncDTO(
                season, priorSeason,
                new ArrayList<>(fullTime.values()),
                new ArrayList<>(carried.values()),
                playerRowsCreated);
    }

    private Optional<User> findUserByEmailOrUsername(String email) {
        Optional<User> match = userRepository.findByEmailIgnoreCase(email);
        return match.isPresent() ? match : userRepository.findByUsernameIgnoreCase(email);
    }

    private static String displayName(String firstName, String lastName, User fallback) {
        if (firstName != null && lastName != null) {
            return firstName + " " + lastName;
        }
        if (fallback.getFirstName() != null && fallback.getLastName() != null) {
            return fallback.getFirstName() + " " + fallback.getLastName();
        }
        return fallback.getUsername();
    }

    private void grantGoalieRole(String email, Role goalieRole) {
        Optional<User> match = userRepository.findByEmailIgnoreCase(email);
        if (match.isEmpty()) {
            match = userRepository.findByUsernameIgnoreCase(email);
        }
        if (match.isEmpty()) {
            return;
        }
        User user = match.get();
        Set<Role> roles = new HashSet<>(user.getRoles() == null ? Set.<Role>of() : user.getRoles());
        if (roles.stream().anyMatch(r -> "GOALIE".equals(r.getName()))) {
            return;
        }
        roles.add(goalieRole);
        user.setRoles(roles);
        userRepository.save(user);
    }

    /**
     * @param registered true when they signed up for this season, false when the row exists only
     *                   to carry a non-registering goalie's rating forward. This flag is the only
     *                   thing that tells the two apart afterwards, so the roster sync can run
     *                   twice without promoting every carried substitute to full-time.
     */
    private void createSeasonPlayerRow(com.obhl.gateway.dto.GoalieImportDTO dto, String email,
            Integer skillRating, Long activeSeasonId, boolean registered) {
        if (activeSeasonId == null) {
            return;
        }
        Map<String, Object> playerMap = new java.util.HashMap<>();
        playerMap.put("firstName", dto.getFirstName());
        playerMap.put("lastName", dto.getLastName());
        playerMap.put("email", email);
        playerMap.put("position", "G");
        playerMap.put("skillRating", skillRating);
        playerMap.put("seasonId", activeSeasonId);
        playerMap.put("teamId", null);
        playerMap.put("isActive", registered);
        try {
            statsClient.createPlayers(List.of(playerMap));
        } catch (Exception e) {
            // Player creation failure shouldn't block the user account from
            // being created; the goalie just won't appear on the Players page
            // until an admin adds them manually.
        }
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
