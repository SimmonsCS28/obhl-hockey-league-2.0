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

    @PutMapping("/deactivate-unregistered")
    public ResponseEntity<Void> deactivateUnregisteredPlayers(@RequestBody List<String> registeredEmails) {
        List<Player> activePlayers = playerRepository.findByIsActiveTrue();
        int deactivatedCount = 0;
        for (Player p : activePlayers) {
            if (p.getEmail() != null && !registeredEmails.contains(p.getEmail())) {
                p.setIsActive(false);
                playerRepository.save(p);
                deactivatedCount++;
            }
        }
        System.out.println("Deactivated " + deactivatedCount + " old player records not in current registration.");
        return ResponseEntity.ok().build();
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
