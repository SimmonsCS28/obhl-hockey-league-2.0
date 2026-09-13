package com.obhl.stats.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.json.MappingJacksonValue;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.stats.config.PlayerAccess;
import com.obhl.stats.model.Player;
import com.obhl.stats.repository.PlayerRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/players")
@RequiredArgsConstructor
public class PlayerController {

    private final PlayerRepository playerRepository;

    @GetMapping
    public MappingJacksonValue getPlayers(
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) Long seasonId,
            @RequestParam(required = false) String position,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Boolean unassigned,
            Authentication authentication) {

        return maskedResponse(resolvePlayers(teamId, seasonId, position, active, unassigned), authentication);
    }

    private List<Player> resolvePlayers(Long teamId, Long seasonId, String position, Boolean active, Boolean unassigned) {
        if (Boolean.TRUE.equals(unassigned)) {
            if (seasonId != null && Boolean.TRUE.equals(active)) {
                return playerRepository.findBySeasonIdAndTeamIdIsNullAndIsActiveTrue(seasonId);
            } else if (seasonId != null) {
                return playerRepository.findBySeasonIdAndTeamIdIsNull(seasonId);
            } else {
                return playerRepository.findByTeamIdIsNull();
            }
        } else if (seasonId != null && teamId != null && Boolean.TRUE.equals(active)) {
            return playerRepository.findBySeasonIdAndTeamIdAndIsActiveTrue(seasonId, teamId);
        } else if (seasonId != null && teamId != null) {
            return playerRepository.findBySeasonIdAndTeamId(seasonId, teamId);
        } else if (seasonId != null) {
            return playerRepository.findBySeasonId(seasonId);
        } else if (teamId != null && Boolean.TRUE.equals(active)) {
            return playerRepository.findByTeamIdAndIsActiveTrue(teamId);
        } else if (teamId != null) {
            return playerRepository.findByTeamId(teamId);
        } else if (position != null) {
            return playerRepository.findByPosition(position);
        } else if (Boolean.TRUE.equals(active)) {
            return playerRepository.findByIsActiveTrue();
        }
        return playerRepository.findAll();
    }

    @GetMapping("/{playerId}")
    public ResponseEntity<?> getPlayer(@PathVariable Long playerId, Authentication authentication) {
        return playerRepository.findById(playerId)
                .<ResponseEntity<?>>map(player -> ResponseEntity.ok(maskedResponse(player, authentication)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Wraps a Player/List&lt;Player&gt; so Jackson drops skillRating/email/birthDate
     * for anyone who isn't staff (ADMIN/GM/GOALIE_COORDINATOR) or a trusted internal
     * service call — see PlayerAccess and Player.Views.
     */
    private MappingJacksonValue maskedResponse(Object body, Authentication authentication) {
        MappingJacksonValue wrapper = new MappingJacksonValue(body);
        wrapper.setSerializationView(PlayerAccess.isPrivileged(authentication)
                ? Player.Views.Privileged.class
                : Player.Views.Public.class);
        return wrapper;
    }

    @GetMapping("/exists")
    public ResponseEntity<java.util.Map<String, Boolean>> playerExists(@RequestParam String email) {
        boolean exists = playerRepository.findByEmail(email).isPresent();
        return ResponseEntity.ok(java.util.Map.of("exists", exists));
    }

    @GetMapping("/by-email")
    public ResponseEntity<?> getPlayerByEmail(@RequestParam String email, Authentication authentication) {
        return playerRepository.findByEmail(email)
                .<ResponseEntity<?>>map(player -> ResponseEntity.ok(maskedResponse(player, authentication)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Every season row for one person, newest first -- the source of the profile card's
     * season history. Privileged/internal only: it is an email-keyed lookup, and the
     * whole point of the Public JSON view is that anonymous callers never learn emails.
     * The gateway calls this with the internal service key on the public card's behalf.
     */
    @GetMapping("/history")
    public ResponseEntity<?> getPlayerHistory(@RequestParam String email, Authentication authentication) {
        if (!PlayerAccess.isPrivileged(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        List<Player> rows = playerRepository.findByEmailIgnoreCaseOrderBySeasonIdDesc(email == null ? "" : email.trim());
        return ResponseEntity.ok(maskedResponse(rows, authentication));
    }

    @GetMapping("/by-email-season")
    public ResponseEntity<?> getPlayerByEmailAndSeason(
            @RequestParam String email,
            @RequestParam Long seasonId,
            Authentication authentication) {
        return playerRepository.findByEmailAndSeasonId(email, seasonId)
                .<ResponseEntity<?>>map(player -> ResponseEntity.ok(maskedResponse(player, authentication)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createPlayer(@RequestBody Player player) {
        try {
            Player created = playerRepository.save(player);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "A player with this email is already registered for this season."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/batch")
    public ResponseEntity<List<Player>> createPlayers(@RequestBody List<Player> players) {
        List<Player> created = playerRepository.saveAll(players);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Deactivates every player row belonging to a season that is now finished, so that
     * is_active means "on a roster in the current season".
     *
     * <p>This replaces an email-based sweep that deactivated players who were not in the new
     * registration list. That had two problems. It never deactivated a RETURNING player's old
     * rows -- their email was in the list, so every season they had ever played stayed active,
     * and one person ended up active in three seasons at once. And it compared emails with a
     * case-sensitive contains(), so a player whose stored address differed only in case was
     * deactivated by mistake.
     *
     * <p>GOALIES ARE EXEMPT, and that exemption is the whole reason this takes a position into
     * account. Goalies have player profiles but are never drafted, so they never appear in a
     * registration list -- the old sweep deactivated every one of them on every finalize. Their
     * roster is managed separately through season_goalies, not by the draft.
     *
     * <p>{@code seasonIds} is a positive list: the finished seasons to sweep, never the current
     * one. It exists so the sweep cannot reach tournament players, and an empty or missing list
     * deactivates nobody rather than everybody, so a bad call fails closed.
     */
    @PutMapping("/deactivate-prior-seasons")
    public ResponseEntity<java.util.Map<String, Integer>> deactivatePriorSeasons(
            @RequestParam List<Long> seasonIds) {
        if (seasonIds == null || seasonIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        List<Player> activePlayers = playerRepository.findBySeasonIdInAndIsActiveTrue(seasonIds);
        int deactivated = 0;
        int goaliesKept = 0;
        for (Player p : activePlayers) {
            if ("G".equalsIgnoreCase(p.getPosition())) {
                goaliesKept++;
                continue;
            }
            p.setIsActive(false);
            playerRepository.save(p);
            deactivated++;
        }
        System.out.println("Deactivated " + deactivated + " player records in finished seasons "
                + seasonIds + "; kept " + goaliesKept + " goalies active.");
        return ResponseEntity.ok(java.util.Map.of("deactivated", deactivated, "goaliesKept", goaliesKept));
    }

    @PatchMapping("/{playerId}")
    @PutMapping("/{playerId}")
    public ResponseEntity<Player> updatePlayer(
            @PathVariable Long playerId,
            @RequestBody java.util.Map<String, Object> updates,
            Authentication authentication) {
        return playerRepository.findById(playerId)
                .map(existing -> {
                    if (updates.containsKey("skillRating")
                            && !PlayerAccess.canRateSkill(authentication, existing.getPosition())) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<Player>build();
                    }
                    if (updates.containsKey("teamId")) {
                        Object val = updates.get("teamId");
                        existing.setTeamId(val == null ? null : ((Number) val).longValue());
                    }
                    if (updates.containsKey("firstName"))
                        existing.setFirstName((String) updates.get("firstName"));
                    if (updates.containsKey("lastName"))
                        existing.setLastName((String) updates.get("lastName"));
                    if (updates.containsKey("jerseyNumber")) {
                        Object val = updates.get("jerseyNumber");
                        existing.setJerseyNumber(val == null ? null : ((Number) val).intValue());
                    }
                    if (updates.containsKey("position"))
                        existing.setPosition((String) updates.get("position"));
                    if (updates.containsKey("shoots"))
                        existing.setShoots((String) updates.get("shoots"));
                    if (updates.containsKey("seasonId")) {
                        Object val = updates.get("seasonId");
                        existing.setSeasonId(val == null ? null : ((Number) val).longValue());
                    }
                    if (updates.containsKey("skillRating")) {
                        Object val = updates.get("skillRating");
                        existing.setSkillRating(val == null ? 5 : ((Number) val).intValue());
                    }
                    if (updates.containsKey("email"))
                        existing.setEmail((String) updates.get("email"));
                    if (updates.containsKey("isVeteran"))
                        existing.setIsVeteran((Boolean) updates.get("isVeteran"));
                    if (updates.containsKey("birthDate")) {
                        Object val = updates.get("birthDate");
                        existing.setBirthDate(val == null ? null : java.time.LocalDate.parse((String) val));
                    }
                    if (updates.containsKey("hometown"))
                        existing.setHometown((String) updates.get("hometown"));
                    if (updates.containsKey("isActive"))
                        existing.setIsActive((Boolean) updates.get("isActive"));
                    if (updates.containsKey("buddyPick"))
                        existing.setBuddyPick((String) updates.get("buddyPick"));
                    if (updates.containsKey("buddyEmail"))
                        existing.setBuddyEmail((String) updates.get("buddyEmail"));
                    if (updates.containsKey("isGm"))
                        existing.setIsGm((Boolean) updates.get("isGm"));
                    if (updates.containsKey("isRef"))
                        existing.setIsRef((Boolean) updates.get("isRef"));

                    return ResponseEntity.ok(playerRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{playerId}")
    public ResponseEntity<Void> deletePlayer(@PathVariable Long playerId) {
        if (playerRepository.existsById(playerId)) {
            playerRepository.deleteById(playerId);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
