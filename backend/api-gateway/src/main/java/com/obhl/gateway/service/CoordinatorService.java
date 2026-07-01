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
        Long seasonId = req.getSeasonId() != null ? req.getSeasonId() : game.getSeasonId();

        // One proposal per (game, role, slot): supersede any existing one.
        ShiftAssignment a = assignmentRepository.findByGameIdAndRoleAndSlot(req.getGameId(), role, slot)
                .orElseGet(ShiftAssignment::new);
        a.setGameId(req.getGameId());
        a.setSeasonId(seasonId);
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
            if (game == null || week != null && !week.equals(game.getWeek())) {
                continue;
            }
            if (ShiftAssignment.STATUS_CONFIRMED.equals(a.getStatus())) {
                if (!Boolean.TRUE.equals(a.getPublished())) {
                    gameProxyService.updateGameStaff(a.getGameId(), Map.of(slotColumn(r, a.getSlot()), a.getUserId()));
                    a.setPublished(true);
                    assignmentRepository.save(a);
                    published++;
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
