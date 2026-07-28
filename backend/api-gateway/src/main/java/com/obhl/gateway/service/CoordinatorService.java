package com.obhl.gateway.service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.ShiftAssignmentRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Coordinator workflow: propose staff for game slots, track confirm/decline status,
 * and publish confirmed assignments onto the games.
 */
@Service
public class CoordinatorService {

    private static final DateTimeFormatter GAME_FMT = DateTimeFormatter.ofPattern("EEE MMM d, h:mm a");
    // Game times are stored as UTC LocalDateTime; render them in league-local time for humans.
    private static final ZoneId LEAGUE_TZ = ZoneId.of("America/Chicago");
    private static final int TOKEN_TTL_DAYS = 7;

    @Autowired
    private ShiftAssignmentRepository assignmentRepository;

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private TeamService teamService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${app.frontend.url:https://oldbuzzardhockey.com}")
    private String frontendUrl;

    /** All proposals for a season + role, enriched for the coordinator board. */
    public List<CoordinatorDto.AssignmentView> getAssignments(Long seasonId, String role) {
        return getAssignments(seasonId, role, null);
    }

    /** As above, optionally filtered to a single week. */
    public List<CoordinatorDto.AssignmentView> getAssignments(Long seasonId, String role, Integer week) {
        List<ShiftAssignment> rows = assignmentRepository.findBySeasonIdAndRole(seasonId, role);
        Map<Long, GameResponseDTO> games = gamesById(seasonId);
        return rows.stream()
                .map(a -> toView(a, games.get(a.getGameId())))
                .filter(v -> week == null || week.equals(v.getWeek()))
                .collect(Collectors.toList());
    }

    /** Propose (or re-propose) a staff member for a game slot; notifies them. */
    @Transactional
    public CoordinatorDto.AssignmentView propose(CoordinatorDto.ProposeRequest req, Long coordinatorUserId) {
        String role = normalizeRole(req.getRole());
        int slot = req.getSlot() == null ? 0 : req.getSlot();
        int maxSlot = slotsForRole(role);
        if (slot < 1 || slot > maxSlot) {
            throw new RuntimeException(maxSlot == 1 ? "Slot must be 1" : "Slot must be 1 or 2");
        }
        if (req.getGameId() == null || req.getUserId() == null) {
            throw new RuntimeException("gameId and userId are required");
        }

        GameResponseDTO game = gameProxyService.getGameById(req.getGameId());
        if (game == null) {
            throw new RuntimeException("Game not found");
        }

        // One proposal per (game, role, slot): supersede any existing one.
        ShiftAssignment a = assignmentRepository.findByGameIdAndRoleAndSlot(req.getGameId(), role, slot)
                .orElseGet(ShiftAssignment::new);
        a.setGameId(req.getGameId());
        // Always the game's own season, never the client-supplied one — a stale/mismatched
        // client season here would make publishWeek's season-scoped game lookup miss this
        // row silently (see publishWeek's game==null handling).
        a.setSeasonId(game.getSeasonId());
        a.setRole(role);
        a.setSlot(slot);
        a.setUserId(req.getUserId());
        a.setStatus(ShiftAssignment.STATUS_PROPOSED);
        a.setPublished(false);
        a.setDeclineReason(null);
        a.setRespondedAt(null);
        a.setAssignedBy(coordinatorUserId);

        // Tokenized confirm link (mirrors the password-reset pattern).
        String rawToken = java.util.UUID.randomUUID().toString() + java.util.UUID.randomUUID().toString();
        a.setConfirmTokenHash(passwordEncoder.encode(rawToken));
        a.setTokenExpiresAt(LocalDateTime.now().plusDays(TOKEN_TTL_DAYS));

        a = assignmentRepository.save(a);

        notify(a, game, rawToken);
        return toView(a, game);
    }

    /** Remove a proposal (does not affect an already-published game slot). */
    @Transactional
    public void withdraw(Long assignmentId) {
        assignmentRepository.deleteById(assignmentId);
    }

    /**
     * Swap the two goalie slots within a game: each goalie — and their entire confirmation state
     * (status, confirm token, published flag) — moves to the other team's slot. Slot→team identity
     * is fixed; only the occupant changes. No confirmation is re-sent and no status is reset, because
     * a goalie confirmed a TIME, not a team, so the confirmation still holds after the move. If only
     * one slot is filled, that goalie moves to the other slot and the original is left empty.
     */
    @Transactional
    public List<CoordinatorDto.AssignmentView> swapGoalieSlots(Long gameId) {
        GameResponseDTO game = gameProxyService.getGameById(gameId);
        if (game == null) {
            throw new RuntimeException("Game not found");
        }
        Optional<ShiftAssignment> s1 = assignmentRepository.findByGameIdAndRoleAndSlot(gameId, "GOALIE", 1);
        Optional<ShiftAssignment> s2 = assignmentRepository.findByGameIdAndRoleAndSlot(gameId, "GOALIE", 2);
        if (s1.isEmpty() && s2.isEmpty()) {
            throw new RuntimeException("No goalie assignments to swap for this game");
        }

        if (s1.isPresent() && s2.isPresent()) {
            // Both filled: swap occupants, keeping slots fixed so the (game,role,slot) uniqueness holds.
            swapOccupant(s1.get(), s2.get());
            assignmentRepository.save(s1.get());
            assignmentRepository.save(s2.get());
        } else {
            // One filled: move it to the empty slot (no uniqueness conflict — the target slot is free).
            ShiftAssignment lone = s1.orElseGet(s2::get);
            lone.setSlot(lone.getSlot() != null && lone.getSlot() == 1 ? 2 : 1);
            assignmentRepository.save(lone);
        }

        // Keep the game's goalie columns consistent with any PUBLISHED slot after the move.
        reconcileGoalieColumns(gameId, game);

        GameResponseDTO fresh = gameProxyService.getGameById(gameId);
        List<CoordinatorDto.AssignmentView> out = new ArrayList<>();
        assignmentRepository.findByGameIdAndRoleAndSlot(gameId, "GOALIE", 1).ifPresent(a -> out.add(toView(a, fresh)));
        assignmentRepository.findByGameIdAndRoleAndSlot(gameId, "GOALIE", 2).ifPresent(a -> out.add(toView(a, fresh)));
        return out;
    }

    /** Move the occupant and their whole confirmation state between two slot rows; slots stay put. */
    private void swapOccupant(ShiftAssignment a, ShiftAssignment b) {
        Long uid = a.getUserId();
        String status = a.getStatus();
        Boolean published = a.getPublished();
        String token = a.getConfirmTokenHash();
        LocalDateTime tokenExpires = a.getTokenExpiresAt();
        LocalDateTime responded = a.getRespondedAt();
        String decline = a.getDeclineReason();
        Long by = a.getAssignedBy();

        a.setUserId(b.getUserId());
        a.setStatus(b.getStatus());
        a.setPublished(b.getPublished());
        a.setConfirmTokenHash(b.getConfirmTokenHash());
        a.setTokenExpiresAt(b.getTokenExpiresAt());
        a.setRespondedAt(b.getRespondedAt());
        a.setDeclineReason(b.getDeclineReason());
        a.setAssignedBy(b.getAssignedBy());

        b.setUserId(uid);
        b.setStatus(status);
        b.setPublished(published);
        b.setConfirmTokenHash(token);
        b.setTokenExpiresAt(tokenExpires);
        b.setRespondedAt(responded);
        b.setDeclineReason(decline);
        b.setAssignedBy(by);
    }

    /** After a slot move, mirror published slots onto the game's goalie columns and clear vacated ones. */
    private void reconcileGoalieColumns(Long gameId, GameResponseDTO before) {
        for (int slot = 1; slot <= 2; slot++) {
            Optional<ShiftAssignment> a = assignmentRepository.findByGameIdAndRoleAndSlot(gameId, "GOALIE", slot);
            boolean published = a.map(x -> Boolean.TRUE.equals(x.getPublished())).orElse(false);
            Long currentCol = slot == 1 ? before.getGoalie1Id() : before.getGoalie2Id();
            if (published) {
                gameProxyService.updateGameStaff(gameId, Map.of(slotColumn("GOALIE", slot), a.get().getUserId()));
            } else if (currentCol != null && currentCol > 0) {
                gameProxyService.updateGameStaff(gameId, Map.of(slotColumn("GOALIE", slot), -1L));
            }
        }
    }

    /**
     * Admin direct-assign override: upserts a shift_assignments row that's already
     * CONFIRMED and published, and writes the game's staff column in the same step —
     * bypassing propose/confirm/publish entirely so the assignment shows up immediately
     * on both the Coordinator Console and the assigned user's dashboard. A null userId
     * clears the slot (removes the row and the game column).
     */
    @Transactional
    public CoordinatorDto.AssignmentView adminDirectAssign(Long gameId, String role, Integer slot, Long userId, Long adminUserId) {
        String r = normalizeRole(role);
        int s = slot == null ? 1 : slot;
        int maxSlot = slotsForRole(r);
        if (s < 1 || s > maxSlot) {
            throw new RuntimeException(maxSlot == 1 ? "Slot must be 1" : "Slot must be 1 or 2");
        }

        GameResponseDTO game = gameProxyService.getGameById(gameId);
        if (game == null) {
            throw new RuntimeException("Game not found");
        }

        Optional<ShiftAssignment> existing = assignmentRepository.findByGameIdAndRoleAndSlot(gameId, r, s);

        if (userId == null) {
            existing.ifPresent(a -> assignmentRepository.deleteById(a.getId()));
            gameProxyService.updateGameStaff(gameId, Map.of(slotColumn(r, s), -1L));
            return null;
        }

        ShiftAssignment a = existing.orElseGet(ShiftAssignment::new);
        a.setGameId(gameId);
        a.setSeasonId(game.getSeasonId());
        a.setRole(r);
        a.setSlot(s);
        a.setUserId(userId);
        a.setStatus(ShiftAssignment.STATUS_CONFIRMED);
        a.setPublished(true);
        a.setDeclineReason(null);
        a.setConfirmTokenHash(null);
        a.setTokenExpiresAt(null);
        a.setRespondedAt(LocalDateTime.now());
        a.setAssignedBy(adminUserId);
        a = assignmentRepository.save(a);

        gameProxyService.updateGameStaff(gameId, Map.of(slotColumn(r, s), userId));

        return toView(a, game);
    }

    /**
     * Coordinator confirms a slot an official signed up for: SIGNED_UP -> CONFIRMED directly
     * (no accept loop — the official already opted in). Sends a courtesy "you're confirmed" email.
     */
    @Transactional
    public CoordinatorDto.AssignmentView confirmSignup(Long assignmentId, Long coordinatorUserId) {
        ShiftAssignment a = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new RuntimeException("Assignment not found"));
        if (!ShiftAssignment.STATUS_SIGNED_UP.equals(a.getStatus())) {
            throw new RuntimeException("Only a signed-up shift can be confirmed this way");
        }
        a.setStatus(ShiftAssignment.STATUS_CONFIRMED);
        a.setRespondedAt(LocalDateTime.now());
        a.setAssignedBy(coordinatorUserId);
        a.setConfirmTokenHash(null);
        a.setTokenExpiresAt(null);
        a.setDeclineReason(null);
        a = assignmentRepository.save(a);

        GameResponseDTO game = gameProxyService.getGameById(a.getGameId());
        try {
            Optional<User> userOpt = userRepository.findById(a.getUserId());
            if (userOpt.isPresent() && userOpt.get().getEmail() != null) {
                User u = userOpt.get();
                String name = (u.getFirstName() != null && !u.getFirstName().isBlank()) ? u.getFirstName() : u.getUsername();
                emailService.sendShiftConfirmedEmail(u.getEmail(), name, roleLabel(a.getRole()), describeGame(game));
            }
        } catch (RuntimeException e) {
            // Courtesy email is best-effort; confirmation already persisted.
        }
        return toView(a, game);
    }

    /**
     * Testing aid: force a proposed/auto-proposed slot to CONFIRMED or DECLINED, standing in for
     * the goalie's real email confirm/decline. Coordinator-authorized (see controller); the UI only
     * exposes it in dev builds. No email is sent — this simulates the goalie's own response.
     */
    @Transactional
    public CoordinatorDto.AssignmentView simulateResponse(Long assignmentId, String action) {
        ShiftAssignment a = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new RuntimeException("Assignment not found"));
        String act = action == null ? "" : action.trim().toLowerCase();
        if ("confirm".equals(act)) {
            a.setStatus(ShiftAssignment.STATUS_CONFIRMED);
            a.setDeclineReason(null);
        } else if ("decline".equals(act)) {
            a.setStatus(ShiftAssignment.STATUS_DECLINED);
            a.setDeclineReason("Simulated decline");
        } else {
            throw new RuntimeException("action must be confirm or decline");
        }
        a.setRespondedAt(LocalDateTime.now());
        a.setConfirmTokenHash(null);
        a.setTokenExpiresAt(null);
        a = assignmentRepository.save(a);
        return toView(a, gameProxyService.getGameById(a.getGameId()));
    }

    /** Write all CONFIRMED, not-yet-published assignments for a week onto the games. */
    @Transactional
    public CoordinatorDto.PublishResult publishWeek(Long seasonId, String role, Integer week) {
        String r = normalizeRole(role);
        Map<Long, GameResponseDTO> games = gamesById(seasonId);
        List<ShiftAssignment> rows = assignmentRepository.findBySeasonIdAndRole(seasonId, r);

        int published = 0;
        List<String> unconfirmed = new ArrayList<>();

        for (ShiftAssignment a : rows) {
            GameResponseDTO game = games.get(a.getGameId());
            if (game == null) {
                // The assignment's season doesn't match its game's actual season (or the
                // game was deleted) — surface it instead of silently dropping a CONFIRMED
                // row that will otherwise never get published.
                if (ShiftAssignment.STATUS_CONFIRMED.equals(a.getStatus())) {
                    unconfirmed.add("Game #" + a.getGameId() + " — " + r + " slot " + a.getSlot()
                            + " (assignment's season doesn't match game; not published)");
                }
                continue;
            }
            if (week != null && !week.equals(game.getWeek())) {
                continue;
            }
            if (ShiftAssignment.STATUS_CONFIRMED.equals(a.getStatus())) {
                if (!Boolean.TRUE.equals(a.getPublished())) {
                    gameProxyService.updateGameStaff(a.getGameId(), Map.of(slotColumn(r, a.getSlot()), a.getUserId()));
                    a.setPublished(true);
                    assignmentRepository.save(a);
                    published++;
                    // Email B — final goalie assignment with the exact game + team (best-effort).
                    if ("GOALIE".equals(r)) {
                        sendGoalieFinalAssignment(a, game);
                    }
                }
            } else {
                unconfirmed.add(describeGame(game) + " — " + r + " slot " + a.getSlot()
                        + " (" + a.getStatus() + ")");
            }
        }
        return new CoordinatorDto.PublishResult(published, unconfirmed);
    }

    // ---- helpers ----

    private void notify(ShiftAssignment a, GameResponseDTO game, String rawToken) {
        Optional<User> userOpt = userRepository.findById(a.getUserId());
        if (userOpt.isEmpty() || userOpt.get().getEmail() == null) {
            return;
        }
        User user = userOpt.get();
        String name = (user.getFirstName() != null && !user.getFirstName().isBlank())
                ? user.getFirstName()
                : user.getUsername();
        String roleLabel = roleLabel(a.getRole());
        String link = frontendUrl + "/shift-confirm?id=" + a.getId() + "&token=" + rawToken;
        emailService.sendShiftProposalEmail(user.getEmail(), name, roleLabel, describeGame(game), link);
    }

    /** Email B: goalie's exact game + team once the week is published (slot 1 = home, slot 2 = away). */
    private void sendGoalieFinalAssignment(ShiftAssignment a, GameResponseDTO game) {
        try {
            Optional<User> userOpt = userRepository.findById(a.getUserId());
            if (userOpt.isEmpty() || userOpt.get().getEmail() == null) {
                return;
            }
            User user = userOpt.get();
            String name = (user.getFirstName() != null && !user.getFirstName().isBlank())
                    ? user.getFirstName()
                    : user.getUsername();
            Long teamId = a.getSlot() != null && a.getSlot() == 2 ? game.getAwayTeamId() : game.getHomeTeamId();
            emailService.sendGoalieFinalAssignmentEmail(user.getEmail(), name, describeGame(game), teamName(teamId));
        } catch (RuntimeException e) {
            // Final-assignment email is best-effort; publish already persisted.
        }
    }

    private Map<Long, GameResponseDTO> gamesById(Long seasonId) {
        List<GameResponseDTO> games = gameProxyService.getGamesBySeason(seasonId);
        if (games == null) {
            return Map.of();
        }
        Map<Long, GameResponseDTO> map = new java.util.HashMap<>();
        for (GameResponseDTO g : games) {
            map.put(g.getId(), g);
        }
        return map;
    }

    private CoordinatorDto.AssignmentView toView(ShiftAssignment a, GameResponseDTO game) {
        CoordinatorDto.AssignmentView v = new CoordinatorDto.AssignmentView();
        v.setId(a.getId());
        v.setGameId(a.getGameId());
        v.setSeasonId(a.getSeasonId());
        v.setRole(a.getRole());
        v.setSlot(a.getSlot());
        v.setUserId(a.getUserId());
        v.setUserName(userName(a.getUserId()));
        v.setStatus(a.getStatus());
        v.setPublished(a.getPublished());
        v.setDeclineReason(a.getDeclineReason());
        if (game != null) {
            v.setWeek(game.getWeek());
            v.setGameDate(game.getGameDate());
            v.setRink(game.getRink());
            v.setHomeTeam(teamName(game.getHomeTeamId()));
            v.setAwayTeam(teamName(game.getAwayTeamId()));
        }
        return v;
    }

    private String describeGame(GameResponseDTO game) {
        if (game == null) {
            return "Game";
        }
        String when = game.getGameDate() != null
                ? game.getGameDate().atZone(ZoneOffset.UTC).withZoneSameInstant(LEAGUE_TZ).format(GAME_FMT)
                : "TBD";
        String matchup = teamName(game.getHomeTeamId()) + " vs " + teamName(game.getAwayTeamId());
        String where = game.getRink() != null ? (" at " + game.getRink()) : "";
        return when + " — " + matchup + where;
    }

    private String teamName(Long teamId) {
        if (teamId == null) {
            return "TBD";
        }
        return teamService.getTeamById(teamId).map(t -> t.getName()).orElse("Team " + teamId);
    }

    private String userName(Long userId) {
        return userRepository.findById(userId)
                .map(u -> (u.getFirstName() != null && u.getLastName() != null)
                        ? (u.getFirstName() + " " + u.getLastName())
                        : u.getUsername())
                .orElse("User " + userId);
    }

    private String normalizeRole(String role) {
        if (role == null) {
            throw new RuntimeException("role is required");
        }
        String r = role.trim().toUpperCase();
        if (!r.equals("GOALIE") && !r.equals("REF") && !r.equals("SCOREKEEPER")) {
            throw new RuntimeException("Unsupported coordinator role: " + role);
        }
        return r;
    }

    /** Number of staff slots a role has per game: goalie/ref = 2, scorekeeper = 1. */
    static int slotsForRole(String role) {
        return "SCOREKEEPER".equals(role) ? 1 : 2;
    }

    private String roleLabel(String role) {
        if ("REF".equals(role)) {
            return "referee";
        }
        if ("SCOREKEEPER".equals(role)) {
            return "scorekeeper";
        }
        return "goalie";
    }

    private String slotColumn(String role, int slot) {
        if ("SCOREKEEPER".equals(role)) {
            return "scorekeeperId";
        }
        if ("REF".equals(role)) {
            return slot == 2 ? "referee2Id" : "referee1Id";
        }
        return slot == 2 ? "goalie2Id" : "goalie1Id";
    }
}
