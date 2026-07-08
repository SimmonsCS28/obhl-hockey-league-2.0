package com.obhl.gateway.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.OpenSlotDto;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.repository.ShiftAssignmentRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Self-service shift sign-up for officials (refs/scorekeepers). Officials browse open slots
 * and pick them up (status SIGNED_UP); a coordinator later confirms or reassigns. Goalies do
 * NOT self-sign-up — they are coordinator-assigned only.
 */
@Service
public class OpenSlotsService {

    private static final Set<String> SELF_SIGNUP_ROLES = Set.of("REF", "SCOREKEEPER");

    @Autowired
    private ShiftAssignmentRepository assignmentRepository;

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private TeamService teamService;

    @Autowired
    private UserRepository userRepository;

    /** All slots for a self-signup role in a season (optionally one week), tagged OPEN/MINE/TAKEN. */
    public List<OpenSlotDto.OpenSlotView> getOpenSlots(String role, Long seasonId, Integer week, Long currentUserId) {
        String r = normalize(role);
        List<GameResponseDTO> games = gameProxyService.getGamesBySeason(seasonId);
        if (games == null) {
            games = List.of();
        }
        Map<String, ShiftAssignment> byKey = new HashMap<>();
        for (ShiftAssignment a : assignmentRepository.findBySeasonIdAndRole(seasonId, r)) {
            if (ShiftAssignment.STATUS_DECLINED.equals(a.getStatus())) {
                continue;
            }
            byKey.put(a.getGameId() + "|" + a.getSlot(), a);
        }
        int maxSlot = CoordinatorService.slotsForRole(r);
        List<OpenSlotDto.OpenSlotView> out = new ArrayList<>();
        for (GameResponseDTO g : games) {
            if (week != null && !week.equals(g.getWeek())) {
                continue;
            }
            for (int slot = 1; slot <= maxSlot; slot++) {
                out.add(buildView(g, r, slot, byKey.get(g.getId() + "|" + slot), currentUserId));
            }
        }
        return out;
    }

    /** Official picks up an open slot (-> SIGNED_UP). No email/token; coordinator confirms later. */
    @Transactional
    public OpenSlotDto.OpenSlotView signup(String slotId, Long userId) {
        Parsed p = parse(slotId);
        GameResponseDTO game = gameProxyService.getGameById(p.gameId);
        if (game == null) {
            throw new RuntimeException("Game not found");
        }
        Optional<ShiftAssignment> existing = assignmentRepository.findByGameIdAndRoleAndSlot(p.gameId, p.role, p.slot);
        if (existing.isPresent() && !ShiftAssignment.STATUS_DECLINED.equals(existing.get().getStatus())) {
            throw new RuntimeException("That slot is no longer open");
        }
        ShiftAssignment a = existing.orElseGet(ShiftAssignment::new);
        a.setGameId(p.gameId);
        a.setSeasonId(game.getSeasonId());
        a.setRole(p.role);
        a.setSlot(p.slot);
        a.setUserId(userId);
        a.setStatus(ShiftAssignment.STATUS_SIGNED_UP);
        a.setPublished(false);
        a.setAssignedBy(null);
        a.setConfirmTokenHash(null);
        a.setTokenExpiresAt(null);
        a.setDeclineReason(null);
        a.setRespondedAt(null);
        a = assignmentRepository.save(a);
        return buildView(game, p.role, p.slot, a, userId);
    }

    /** Official drops a slot they signed up for (only while still SIGNED_UP; confirmed = coordinator's call). */
    @Transactional
    public void removeSignup(String slotId, Long userId) {
        Parsed p = parse(slotId);
        ShiftAssignment a = assignmentRepository.findByGameIdAndRoleAndSlot(p.gameId, p.role, p.slot)
                .orElseThrow(() -> new RuntimeException("Sign-up not found"));
        if (!ShiftAssignment.STATUS_SIGNED_UP.equals(a.getStatus()) || !a.getUserId().equals(userId)) {
            throw new RuntimeException("You can only drop a slot you signed up for that isn't confirmed yet");
        }
        assignmentRepository.delete(a);
    }

    // ---- helpers ----

    private OpenSlotDto.OpenSlotView buildView(GameResponseDTO g, String role, int slot,
            ShiftAssignment a, Long currentUserId) {
        OpenSlotDto.OpenSlotView v = new OpenSlotDto.OpenSlotView();
        v.setSlotId(g.getId() + "-" + role + "-" + slot);
        v.setGameId(g.getId());
        v.setSeasonId(g.getSeasonId());
        v.setRole(role);
        v.setSlot(slot);
        v.setWeek(g.getWeek());
        v.setGameDate(g.getGameDate());
        v.setRink(g.getRink());
        v.setHomeTeam(teamName(g.getHomeTeamId()));
        v.setAwayTeam(teamName(g.getAwayTeamId()));
        if (a == null) {
            v.setState("OPEN");
        } else {
            v.setRowStatus(a.getStatus());
            v.setAssignmentId(a.getId());
            if (a.getUserId().equals(currentUserId)) {
                v.setState("MINE");
            } else {
                v.setState("TAKEN");
                v.setTakenByName(userName(a.getUserId()));
            }
        }
        return v;
    }

    private String normalize(String role) {
        if (role == null) {
            throw new RuntimeException("role is required");
        }
        String r = role.trim().toUpperCase();
        if (!SELF_SIGNUP_ROLES.contains(r)) {
            throw new RuntimeException("Self-signup is only for refs and scorekeepers: " + role);
        }
        return r;
    }

    private Parsed parse(String slotId) {
        if (slotId == null) {
            throw new RuntimeException("slotId is required");
        }
        String[] parts = slotId.split("-");
        if (parts.length != 3) {
            throw new RuntimeException("Bad slotId: " + slotId);
        }
        try {
            Long gameId = Long.parseLong(parts[0]);
            String role = normalize(parts[1]);
            int slot = Integer.parseInt(parts[2]);
            int maxSlot = CoordinatorService.slotsForRole(role);
            if (slot < 1 || slot > maxSlot) {
                throw new RuntimeException("Bad slot in slotId: " + slotId);
            }
            return new Parsed(gameId, role, slot);
        } catch (NumberFormatException e) {
            throw new RuntimeException("Bad slotId: " + slotId);
        }
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

    private static class Parsed {
        final Long gameId;
        final String role;
        final int slot;

        Parsed(Long gameId, String role, int slot) {
            this.gameId = gameId;
            this.role = role;
            this.slot = slot;
        }
    }
}
