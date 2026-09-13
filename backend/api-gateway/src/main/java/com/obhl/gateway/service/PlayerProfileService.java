package com.obhl.gateway.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.client.LeagueClient;
import com.obhl.gateway.client.StatsClient;
import com.obhl.gateway.dto.PlayerCardDTO;
import com.obhl.gateway.dto.PlayerDto;
import com.obhl.gateway.dto.PlayerProfileDTO;
import com.obhl.gateway.dto.PlayerProfileUpdateDTO;
import com.obhl.gateway.dto.SeasonHistoryEntryDTO;
import com.obhl.gateway.model.PlayerProfile;
import com.obhl.gateway.model.Team;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.PlayerProfileRepository;
import com.obhl.gateway.repository.TeamRepository;
import com.obhl.gateway.repository.UserRepository;

import feign.FeignException;

/**
 * The profile card and the player's own profile edits.
 *
 * Identity resolution, the part that is easy to get subtly wrong in this schema:
 *   - a card is opened from a season row (players.id) → that row's email → profile;
 *   - "is this me?" is JWT username → users.email, compared case-insensitively to the
 *     row's email (users.email is case-insensitive-unique since 044; players.email is
 *     not normalized at all);
 *   - the owner's own edits go through the same users.email → lower() → profile path,
 *     and are refused for accounts with no players row at all, so a profile can never
 *     exist for someone who was never on a roster.
 *
 * Profile fields fall back to the season row (COALESCE) because the legacy
 * players.birth_date/hometown/shoots columns hold real data that the admin form still
 * writes. Profile wins whenever it has a value.
 */
@Service
public class PlayerProfileService {

    private static final Logger log = LoggerFactory.getLogger(PlayerProfileService.class);

    static final String ERR_NO_PLAYER = "No player record is linked to your account.";
    static final String ERR_BIRTH_DATE = "Enter a valid birth date.";

    private final PlayerProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final StatsClient statsClient;
    private final LeagueClient leagueClient;
    private final HighlightStorageService storage;
    private final ProfilePhotoProcessor photoProcessor;
    private final PlayerRowSyncService rowSync;
    private final String apiPrefix;

    public PlayerProfileService(PlayerProfileRepository profileRepository,
            UserRepository userRepository,
            TeamRepository teamRepository,
            StatsClient statsClient,
            LeagueClient leagueClient,
            HighlightStorageService storage,
            ProfilePhotoProcessor photoProcessor,
            PlayerRowSyncService rowSync,
            @Value("${api.v1.prefix}") String apiPrefix) {
        this.profileRepository = profileRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.statsClient = statsClient;
        this.leagueClient = leagueClient;
        this.storage = storage;
        this.photoProcessor = photoProcessor;
        this.rowSync = rowSync;
        this.apiPrefix = apiPrefix;
    }

    // ------------------------------------------------------------------ card (public)

    @Transactional(readOnly = true)
    public PlayerCardDTO getCard(Long playerId, Authentication auth) {
        PlayerDto row = fetchRow(playerId);
        String emailLower = normalizeEmail(row.getEmail());
        Optional<PlayerProfile> profile = emailLower == null ? Optional.empty() : profileRepository.findByEmailLower(emailLower);

        Map<Long, SeasonInfo> seasons = loadSeasons();
        List<PlayerDto> history = hasRealEmail(row) ? fetchHistory(row.getEmail()) : List.of(row);
        if (history.stream().noneMatch(r -> Objects.equals(r.getId(), row.getId()))) {
            // Defensive: a row whose email changed since it was linked still gets its own entry.
            history = new ArrayList<>(history);
            history.add(row);
        }
        Map<Long, Team> teams = loadTeams(history);

        PlayerCardDTO card = new PlayerCardDTO();
        card.setPlayerId(row.getId());
        card.setFirstName(row.getFirstName());
        card.setLastName(row.getLastName());
        card.setPosition(row.getPosition());
        card.setJerseyNumber(row.jerseyNumberAsInt());
        card.setSeasonId(row.getSeasonId());
        SeasonInfo season = seasons.get(row.getSeasonId());
        card.setSeasonName(season == null ? null : season.name);
        card.setSeasonIsCurrent(season != null && season.isActive);
        card.setTeam(teamRef(teamFor(teams, row.getTeamId())));
        card.setBadges(new PlayerCardDTO.Badges(
                Boolean.TRUE.equals(row.getIsGm()),
                Boolean.TRUE.equals(row.getIsVeteran()),
                Boolean.TRUE.equals(row.getTwoGoalLimit())));

        PlayerProfile p = profile.orElse(null);
        LocalDate birthDate = p != null && p.getBirthDate() != null ? p.getBirthDate() : row.getBirthDate();
        card.setAge(ageFrom(birthDate));
        card.setHometown(firstNonBlank(p == null ? null : p.getHometown(), row.getHometown()));
        card.setHeightInches(p == null ? null : p.getHeightInches());
        card.setWeightLbs(p == null ? null : p.getWeightLbs());
        card.setShoots(normalizeShoots(firstNonBlank(p == null ? null : p.getShoots(), row.getShoots())));
        card.setPhotoUrl(photoUrl(p));
        card.setHasProfile(p != null && (p.hasAnyDetail() || p.hasPhoto()));
        card.setSelf(isSelf(auth, row));
        card.setSeasonHistory(buildHistory(history, seasons, teams));
        return card;
    }

    // ------------------------------------------------------------------ owner (self)

    @Transactional(readOnly = true)
    public PlayerProfileDTO getOwnProfile(Authentication auth) {
        OwnerContext ctx = requireOwner(auth);
        return ownerView(ctx, ctx.profile);
    }

    @Transactional
    public PlayerProfileDTO updateOwnProfile(Authentication auth, PlayerProfileUpdateDTO dto) {
        OwnerContext ctx = requireOwner(auth);
        PlayerProfile profile = ctx.profile;

        LocalDate birthDate = dto.getBirthDate();
        if (birthDate != null) {
            LocalDate today = LocalDate.now();
            if (birthDate.isAfter(today.minusYears(16)) || birthDate.isBefore(today.minusYears(100))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ERR_BIRTH_DATE);
            }
        }

        profile.setBirthDate(birthDate);
        profile.setHometown(blankToNull(dto.getHometown()));
        profile.setHeightInches(dto.getHeightInches());
        profile.setWeightLbs(dto.getWeightLbs());
        profile.setShoots(normalizeShoots(dto.getShoots()));
        profile.setUsePhotoAvatar(Boolean.TRUE.equals(dto.getUsePhotoAvatar()));
        linkUser(profile, ctx.user);

        PlayerProfile saved = profileRepository.save(profile);
        // The admin Players page reads the season rows, not the profile — keep them in step.
        rowSync.fanOut(ctx.rows, saved.getBirthDate(), saved.getHometown(), saved.getShoots());
        return ownerView(ctx, saved);
    }

    /**
     * The reverse direction: an admin edited birthDate / hometown / shoots on one season row
     * through the proxy. Those are person-level facts, so the profile takes them (it is what
     * the card shows, and it would otherwise silently win over the admin's edit), and the
     * person's OTHER season rows get the same values. Only keys present in the edit move;
     * an admin changing just the jersey number touches nothing here.
     */
    @Transactional
    public void absorbRowEdit(Long playerId, Map<String, Object> updates) {
        boolean hasBirth = updates.containsKey("birthDate");
        boolean hasHometown = updates.containsKey("hometown");
        boolean hasShoots = updates.containsKey("shoots");
        if (!hasBirth && !hasHometown && !hasShoots) {
            return;
        }
        PlayerDto row;
        try {
            row = fetchRow(playerId);
        } catch (ResponseStatusException e) {
            return;
        }
        String emailLower = normalizeEmail(row.getEmail());
        if (emailLower == null || !hasRealEmail(row)) {
            return;
        }
        PlayerProfile profile = profileRepository.findByEmailLower(emailLower)
                .orElseGet(() -> seedFrom(emailLower, row));
        if (hasBirth) {
            profile.setBirthDate(parseDate(updates.get("birthDate")));
        }
        if (hasHometown) {
            profile.setHometown(blankToNull(asString(updates.get("hometown"))));
        }
        if (hasShoots) {
            profile.setShoots(normalizeShoots(asString(updates.get("shoots"))));
        }
        PlayerProfile saved = profileRepository.save(profile);
        rowSync.fanOut(fetchHistory(row.getEmail()), saved.getBirthDate(), saved.getHometown(), saved.getShoots(),
                playerId);
    }

    private static LocalDate parseDate(Object value) {
        String s = blankToNull(asString(value));
        if (s == null) {
            return null;
        }
        try {
            return LocalDate.parse(s);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    @Transactional
    public PlayerProfileDTO uploadOwnPhoto(Authentication auth, MultipartFile file) {
        OwnerContext ctx = requireOwner(auth);
        PlayerProfile profile = ctx.profile;

        byte[] jpeg = photoProcessor.process(file);
        String previousKey = profile.getPhotoKey();
        // Write the new file, then the row, then remove the old file — a failed write
        // must never leave the row pointing at a photo that does not exist.
        String key = storage.storeBytes(jpeg, HighlightStorageService.PLAYER_PHOTO_DIR, ProfilePhotoProcessor.OUTPUT_EXTENSION);
        profile.setPhotoKey(key);
        profile.setPhotoContentType(ProfilePhotoProcessor.OUTPUT_CONTENT_TYPE);
        profile.setPhotoSizeBytes((long) jpeg.length);
        profile.setPhotoUpdatedAt(LocalDateTime.now());
        linkUser(profile, ctx.user);
        PlayerProfile saved = profileRepository.save(profile);
        storage.delete(HighlightStorageService.PLAYER_PHOTO_DIR, previousKey);
        return ownerView(ctx, saved);
    }

    @Transactional
    public void deleteOwnPhoto(Authentication auth) {
        OwnerContext ctx = requireOwner(auth);
        clearPhoto(ctx.profile);
    }

    /** ADMIN moderation: strip the photo from whichever profile this season row belongs to. Idempotent. */
    @Transactional
    public void adminDeletePhoto(Long playerId) {
        PlayerDto row = fetchRow(playerId);
        String emailLower = normalizeEmail(row.getEmail());
        if (emailLower == null) {
            return;
        }
        profileRepository.findByEmailLower(emailLower).ifPresent(this::clearPhoto);
    }

    // ------------------------------------------------------------------ resolution

    private static final class OwnerContext {
        User user;
        List<PlayerDto> rows;
        PlayerProfile profile;
        Long activeSeasonId;
    }

    /**
     * Who is asking, and which person are they. Refuses (404) anyone whose account
     * email has never appeared on a roster — there is nothing for them to edit, and
     * allowing it would let any signed-up visitor create an orphan profile row.
     */
    private OwnerContext requireOwner(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated.");
        }
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated."));
        String emailLower = normalizeEmail(user.getEmail());
        if (emailLower == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ERR_NO_PLAYER);
        }
        List<PlayerDto> rows = fetchHistory(user.getEmail());
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ERR_NO_PLAYER);
        }

        OwnerContext ctx = new OwnerContext();
        ctx.user = user;
        ctx.rows = rows;
        ctx.activeSeasonId = activeSeasonId();
        ctx.profile = profileRepository.findByEmailLower(emailLower).orElseGet(() -> seedFrom(emailLower, rows.get(0)));
        return ctx;
    }

    /**
     * A brand-new profile starts from the newest season row's legacy values, so a
     * player who only fills in "shoots" does not silently lose the hometown the
     * registration spreadsheet already knew. Not persisted until a write happens.
     */
    private static PlayerProfile seedFrom(String emailLower, PlayerDto newest) {
        PlayerProfile p = new PlayerProfile(emailLower);
        p.setBirthDate(newest.getBirthDate());
        p.setHometown(blankToNull(newest.getHometown()));
        p.setShoots(normalizeShoots(newest.getShoots()));
        return p;
    }

    private static void linkUser(PlayerProfile profile, User user) {
        if (profile.getUserId() == null && user != null) {
            profile.setUserId(user.getId());
        }
    }

    private boolean isSelf(Authentication auth, PlayerDto row) {
        if (auth == null || auth.getName() == null || !hasRealEmail(row)) {
            return false;
        }
        return userRepository.findByUsername(auth.getName())
                .map(User::getEmail)
                .map(PlayerProfileService::normalizeEmail)
                .map(e -> e.equals(normalizeEmail(row.getEmail())))
                .orElse(false);
    }

    private PlayerProfileDTO ownerView(OwnerContext ctx, PlayerProfile profile) {
        PlayerDto current = ctx.rows.stream()
                .filter(r -> ctx.activeSeasonId != null && ctx.activeSeasonId.equals(r.getSeasonId()))
                .findFirst()
                .orElse(ctx.rows.get(0));
        return new PlayerProfileDTO(
                current.getId(),
                current.getFirstName(),
                current.getLastName(),
                profile.getBirthDate(),
                profile.getHometown(),
                profile.getHeightInches(),
                profile.getWeightLbs(),
                profile.getShoots(),
                photoUrl(profile),
                Boolean.TRUE.equals(profile.getUsePhotoAvatar()));
    }

    /**
     * The URL a player's initials-avatar should show instead, or null. Only when the player
     * has a photo AND opted in — uploading a photo for the card never changes this on its own.
     */
    @Transactional(readOnly = true)
    public String avatarUrlFor(String email) {
        String emailLower = normalizeEmail(email);
        if (emailLower == null) {
            return null;
        }
        return profileRepository.findByEmailLower(emailLower)
                .filter(PlayerProfile::showsPhotoAsAvatar)
                .map(this::photoUrl)
                .orElse(null);
    }

    private void clearPhoto(PlayerProfile profile) {
        String key = profile.getPhotoKey();
        if (key == null) {
            return;
        }
        profile.setPhotoKey(null);
        profile.setPhotoContentType(null);
        profile.setPhotoSizeBytes(null);
        profile.setPhotoUpdatedAt(null);
        profileRepository.save(profile);
        storage.delete(HighlightStorageService.PLAYER_PHOTO_DIR, key);
    }

    // ------------------------------------------------------------------ downstream reads

    private PlayerDto fetchRow(Long playerId) {
        try {
            PlayerDto row = statsClient.getPlayer(playerId);
            if (row == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Player not found.");
            }
            return row;
        } catch (FeignException.NotFound e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Player not found.");
        } catch (FeignException e) {
            log.error("stats-service failed fetching player {}", playerId, e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Couldn't load this player.");
        }
    }

    /** Never fails the caller: a stats hiccup degrades to "no history", not "no card". */
    private List<PlayerDto> fetchHistory(String email) {
        try {
            List<PlayerDto> rows = statsClient.getPlayerHistoryByEmail(email);
            return rows == null ? List.of() : rows;
        } catch (FeignException e) {
            log.warn("stats-service failed fetching history for a player: {}", e.getMessage());
            return List.of();
        }
    }

    private static final class SeasonInfo {
        Long id;
        String name;
        String type;
        LocalDate startDate;
        boolean isActive;
    }

    private Map<Long, SeasonInfo> loadSeasons() {
        try {
            List<Map<String, Object>> raw = leagueClient.getSeasons("ALL");
            Map<Long, SeasonInfo> out = new HashMap<>();
            if (raw == null) {
                return out;
            }
            for (Map<String, Object> s : raw) {
                Object id = s.get("id");
                if (!(id instanceof Number)) {
                    continue;
                }
                SeasonInfo info = new SeasonInfo();
                info.id = ((Number) id).longValue();
                info.name = s.get("name") == null ? null : String.valueOf(s.get("name"));
                info.type = s.get("type") == null ? null : String.valueOf(s.get("type"));
                info.isActive = Boolean.TRUE.equals(s.get("isActive"));
                Object start = s.get("startDate");
                if (start != null) {
                    try {
                        info.startDate = LocalDate.parse(String.valueOf(start));
                    } catch (RuntimeException ignored) {
                        // league-service returns ISO dates; anything else just loses sort precision
                    }
                }
                out.put(info.id, info);
            }
            return out;
        } catch (FeignException e) {
            log.warn("league-service failed listing seasons for the profile card: {}", e.getMessage());
            return Map.of();
        }
    }

    private Long activeSeasonId() {
        try {
            Map<String, Object> active = leagueClient.getActiveSeason();
            Object id = active == null ? null : active.get("id");
            return id instanceof Number ? ((Number) id).longValue() : null;
        } catch (FeignException e) {
            return null;
        }
    }

    private Map<Long, Team> loadTeams(List<PlayerDto> rows) {
        List<Long> ids = rows.stream().map(PlayerDto::getTeamId).filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return teamRepository.findAllById(ids).stream().collect(Collectors.toMap(Team::getId, Function.identity()));
    }

    private List<SeasonHistoryEntryDTO> buildHistory(List<PlayerDto> rows, Map<Long, SeasonInfo> seasons, Map<Long, Team> teams) {
        Map<Long, SeasonHistoryEntryDTO> bySeason = new HashMap<>();
        for (PlayerDto r : rows) {
            if (r.getSeasonId() == null || bySeason.containsKey(r.getSeasonId())) {
                continue; // (email, season_id) is unique; a duplicate here is a case-variant twin
            }
            SeasonInfo s = seasons.get(r.getSeasonId());
            bySeason.put(r.getSeasonId(), new SeasonHistoryEntryDTO(
                    r.getSeasonId(),
                    s == null ? "Season " + r.getSeasonId() : s.name,
                    s == null ? null : s.type,
                    s == null ? null : s.startDate,
                    s != null && s.isActive,
                    teamRef(teamFor(teams, r.getTeamId())),
                    r.getPosition(),
                    r.jerseyNumberAsInt()));
        }
        return bySeason.values().stream()
                .sorted(Comparator
                        .comparing(SeasonHistoryEntryDTO::getStartDate, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(SeasonHistoryEntryDTO::getSeasonId, Comparator.reverseOrder()))
                .toList();
    }

    // ------------------------------------------------------------------ helpers

    private String photoUrl(PlayerProfile p) {
        return p == null || !p.hasPhoto() ? null
                : apiPrefix + "/media/" + HighlightStorageService.PLAYER_PHOTO_DIR + "/" + p.getPhotoKey();
    }

    /** Map.of() throws on a null key, and free agents have a null teamId. */
    private static Team teamFor(Map<Long, Team> teams, Long teamId) {
        return teamId == null ? null : teams.get(teamId);
    }

    private static PlayerCardDTO.TeamRef teamRef(Team t) {
        return t == null ? null : new PlayerCardDTO.TeamRef(t.getId(), t.getName(), t.getAbbreviation(), t.getTeamColor());
    }

    static Integer ageFrom(LocalDate birthDate) {
        if (birthDate == null) {
            return null;
        }
        int years = Period.between(birthDate, LocalDate.now()).getYears();
        return years < 0 ? null : years;
    }

    /** The profile key: lower(trim(email)); null for blank input. */
    static String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String e = email.trim().toLowerCase(Locale.ROOT);
        return e.isEmpty() ? null : e;
    }

    /** Placeholder emails (tournament walk-ons) are not a person identity. */
    private static boolean hasRealEmail(PlayerDto row) {
        String e = normalizeEmail(row.getEmail());
        return e != null && !e.endsWith("@obhl.invalid");
    }

    /** "L"/"R" only; the legacy 'N/A' sentinel and anything else become null. */
    static String normalizeShoots(String shoots) {
        if (shoots == null) {
            return null;
        }
        String s = shoots.trim().toUpperCase(Locale.ROOT);
        return "L".equals(s) || "R".equals(s) ? s : null;
    }

    private static String blankToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String firstNonBlank(String a, String b) {
        return blankToNull(a) != null ? blankToNull(a) : blankToNull(b);
    }
}
