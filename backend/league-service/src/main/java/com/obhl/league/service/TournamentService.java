package com.obhl.league.service;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.league.client.StatsClient;
import com.obhl.league.client.TeamClient;
import com.obhl.league.dto.TournamentDto;
import com.obhl.league.model.Season;
import com.obhl.league.model.Tournament;
import com.obhl.league.model.TournamentRulesSection;
import com.obhl.league.repository.SeasonRepository;
import com.obhl.league.repository.TournamentRepository;
import com.obhl.league.repository.TournamentRulesSectionRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class TournamentService {

    private final TournamentRepository tournamentRepository;
    private final SeasonRepository seasonRepository;
    private final TournamentRulesSectionRepository rulesRepository;
    private final TeamClient teamClient;
    private final StatsClient statsClient;

    @Transactional(readOnly = true)
    public List<TournamentDto.Response> getAll(boolean publishedOnly) {
        List<Tournament> tournaments = publishedOnly
                ? tournamentRepository.findByIsPublishedTrueOrderByYearDesc()
                : tournamentRepository.findAllByOrderByYearDesc();

        return tournaments.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<TournamentDto.Response> getBySlug(String slug) {
        return tournamentRepository.findBySlug(slug).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Optional<TournamentDto.Response> getById(Long id) {
        return tournamentRepository.findById(id).map(this::toResponse);
    }

    /**
     * Creates the tournament and the season that backs it, together.
     *
     * <p>Deliberately one call rather than "create a season, then create a tournament pointing at
     * it". Two calls leave two ways to get it wrong: a tournament season created through the normal
     * season endpoint would default to type=LEAGUE and could be marked active, and a half-finished
     * sequence leaves an orphan season sitting in the admin's season list. Doing both in one
     * transaction means a tournament season only ever exists as part of a tournament.
     */
    @Transactional
    public TournamentDto.Response create(TournamentDto.Create dto) {
        String slug = (dto.getSlug() != null && !dto.getSlug().isBlank())
                ? slugify(dto.getSlug())
                : slugify(dto.getName() + "-" + dto.getYear());

        if (tournamentRepository.existsBySlug(slug)) {
            throw new IllegalArgumentException(
                    "A tournament with the URL '" + slug + "' already exists. Choose a different name or slug.");
        }

        // seasons.name is globally unique, so a collision here is a real conflict (most likely the
        // same tournament being created twice) rather than something to silently work around.
        String seasonName = dto.getName() + " " + dto.getYear();
        if (seasonRepository.findByName(seasonName).isPresent()) {
            throw new IllegalArgumentException(
                    "A season named '" + seasonName + "' already exists.");
        }

        Season season = new Season();
        season.setName(seasonName);
        season.setStartDate(dto.getStartDate());
        season.setEndDate(dto.getEndDate());
        season.setType(Season.TYPE_TOURNAMENT);
        season.setStatus("upcoming");
        // Never active. The database enforces this too (chk_tournament_never_active); the
        // tournament's own lifecycle lives on tournaments.status.
        season.setIsActive(false);
        season = seasonRepository.save(season);

        Tournament t = new Tournament();
        t.setSeasonId(season.getId());
        t.setSlug(slug);
        t.setName(dto.getName());
        t.setYear(dto.getYear());
        t.setTagline(dto.getTagline());
        t.setStartDate(dto.getStartDate());
        t.setEndDate(dto.getEndDate());

        applyIfPresent(dto.getGroupStage(), t::setGroupStage);
        applyIfPresent(dto.getPoolCount(), t::setPoolCount);
        applyIfPresent(dto.getAdvancePerPool(), t::setAdvancePerPool);
        applyIfPresent(dto.getChampionshipStage(), t::setChampionshipStage);
        applyIfPresent(dto.getPlacementGame(), t::setPlacementGame);
        applyIfPresent(dto.getConsolationStage(), t::setConsolationStage);
        applyIfPresent(dto.getConsolationTeamCount(), t::setConsolationTeamCount);
        applyIfPresent(dto.getTeamCount(), t::setTeamCount);
        applyIfPresent(dto.getVenue(), t::setVenue);
        applyIfPresent(dto.getEntryFeeCents(), t::setEntryFeeCents);
        applyIfPresent(dto.getEntryDeadline(), t::setEntryDeadline);
        applyIfPresent(dto.getDraftDate(), t::setDraftDate);
        applyIfPresent(dto.getPeriodCount(), t::setPeriodCount);
        applyIfPresent(dto.getPeriodMinutes(), t::setPeriodMinutes);

        validateStageConfig(t);

        Tournament saved = tournamentRepository.save(t);
        log.info("Created tournament '{}' (slug={}) backed by season {}", saved.getName(), slug, season.getId());
        return toResponse(saved);
    }

    @Transactional
    public TournamentDto.Response update(Long id, TournamentDto.Update dto) {
        Tournament t = tournamentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tournament not found"));

        applyIfPresent(dto.getName(), t::setName);
        applyIfPresent(dto.getTagline(), t::setTagline);
        applyIfPresent(dto.getGroupStage(), t::setGroupStage);
        applyIfPresent(dto.getPoolCount(), t::setPoolCount);
        applyIfPresent(dto.getAdvancePerPool(), t::setAdvancePerPool);
        applyIfPresent(dto.getChampionshipStage(), t::setChampionshipStage);
        applyIfPresent(dto.getPlacementGame(), t::setPlacementGame);
        applyIfPresent(dto.getConsolationStage(), t::setConsolationStage);
        applyIfPresent(dto.getConsolationTeamCount(), t::setConsolationTeamCount);
        applyIfPresent(dto.getTeamCount(), t::setTeamCount);
        applyIfPresent(dto.getStartDate(), t::setStartDate);
        applyIfPresent(dto.getEndDate(), t::setEndDate);
        applyIfPresent(dto.getVenue(), t::setVenue);
        applyIfPresent(dto.getEntryFeeCents(), t::setEntryFeeCents);
        applyIfPresent(dto.getEntryDeadline(), t::setEntryDeadline);
        applyIfPresent(dto.getDraftDate(), t::setDraftDate);
        applyIfPresent(dto.getPeriodCount(), t::setPeriodCount);
        applyIfPresent(dto.getPeriodMinutes(), t::setPeriodMinutes);
        applyIfPresent(dto.getStatus(), t::setStatus);
        applyIfPresent(dto.getIsPublished(), t::setIsPublished);
        applyIfPresent(dto.getChampionTeamId(), t::setChampionTeamId);
        applyIfPresent(dto.getCrestImageUrl(), t::setCrestImageUrl);
        applyIfPresent(dto.getTrophyImageUrl(), t::setTrophyImageUrl);

        validateStageConfig(t);

        // Keep the backing season's dates in step, so staffing and schedule screens that read the
        // season rather than the tournament show the right weekend.
        if (dto.getStartDate() != null || dto.getEndDate() != null) {
            seasonRepository.findById(t.getSeasonId()).ifPresent(season -> {
                if (dto.getStartDate() != null) season.setStartDate(dto.getStartDate());
                if (dto.getEndDate() != null) season.setEndDate(dto.getEndDate());
                seasonRepository.save(season);
            });
        }

        return toResponse(tournamentRepository.save(t));
    }

    /**
     * Deletes the tournament and, with it, the backing season -- which cascades to the season's
     * teams, players and games. Guarded to setup/draft so a tournament that has already been played
     * cannot be erased by a stray click.
     */
    @Transactional
    public void delete(Long id) {
        Tournament t = tournamentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tournament not found"));

        if (!Tournament.STATUS_SETUP.equals(t.getStatus()) && !Tournament.STATUS_DRAFT.equals(t.getStatus())) {
            throw new IllegalStateException(
                    "Only a tournament still in setup or draft can be deleted. This one is '" + t.getStatus()
                    + "' -- archive it instead.");
        }

        Long seasonId = t.getSeasonId();

        // Players and teams must be removed explicitly.
        //
        // Every other season-scoped table (games, player_stats, goalie_stats, leagues,
        // season_goalies) has ON DELETE CASCADE on season_id, but `players` and `teams` have no
        // foreign key to seasons at all -- their season_id was added later by Hibernate rather than
        // by a migration. Deleting the season alone therefore leaves orphan rows pointing at a
        // season that no longer exists, which then surface in any query that filters by team rather
        // than by season. Verified 2026-08-17 by deleting a test tournament and finding 5 players
        // and 2 teams left behind.
        //
        // Doing it here rather than adding the missing FKs deliberately: adding them would change
        // league behaviour too (deleting a league season would begin cascade-deleting its players),
        // which is a bigger decision than this delete path. Tracked in
        // docs/tournament/00-follow-ups.md.
        try {
            for (Map<String, Object> player : statsClient.getPlayersBySeason(seasonId)) {
                statsClient.deletePlayer(((Number) player.get("id")).longValue());
            }
        } catch (Exception e) {
            log.warn("Could not delete players for tournament season {}: {}", seasonId, e.getMessage());
        }

        try {
            for (Map<String, Object> team : teamClient.getTeamsBySeasonId(seasonId)) {
                teamClient.deleteTeam(((Number) team.get("id")).longValue());
            }
        } catch (Exception e) {
            log.warn("Could not delete teams for tournament season {}: {}", seasonId, e.getMessage());
        }

        tournamentRepository.delete(t);
        seasonRepository.deleteById(seasonId);
        log.info("Deleted tournament {}, its teams and players, and its backing season {}", id, seasonId);
    }

    /**
     * Accepts a numeric id or a slug. The microsite knows a tournament by its slug (it is in the
     * URL) while the admin knows it by id; supporting both saves the caller a lookup round trip.
     */
    @Transactional(readOnly = true)
    public Optional<Long> resolveId(String idOrSlug) {
        if (idOrSlug == null || idOrSlug.isBlank()) return Optional.empty();
        if (idOrSlug.chars().allMatch(Character::isDigit)) {
            Long id = Long.valueOf(idOrSlug);
            return tournamentRepository.existsById(id) ? Optional.of(id) : Optional.empty();
        }
        return tournamentRepository.findBySlug(idOrSlug).map(Tournament::getId);
    }

    @Transactional(readOnly = true)
    public List<TournamentRulesSection> getRules(Long tournamentId) {
        return rulesRepository.findByTournamentIdOrderBySortOrderAsc(tournamentId);
    }

    /**
     * Replaces a tournament's rules wholesale.
     *
     * <p>Delete-then-insert rather than diffing: the editor hands back an ordered list, sections get
     * reordered and retitled freely, and matching them up by id would be more code for no benefit at
     * this size. Transactional, so a failure leaves the previous rules in place.
     */
    @Transactional
    public List<TournamentRulesSection> replaceRules(Long tournamentId, List<TournamentRulesSection> sections) {
        if (!tournamentRepository.existsById(tournamentId)) {
            throw new RuntimeException("Tournament not found");
        }

        rulesRepository.deleteByTournamentId(tournamentId);

        int order = 0;
        for (TournamentRulesSection s : sections) {
            s.setId(null);
            s.setTournamentId(tournamentId);
            s.setSortOrder(order++);
            if (s.getContent() == null) s.setContent("");
            rulesRepository.save(s);
        }

        return getRules(tournamentId);
    }

    /**
     * Cross-field rules the database CHECKs cannot express on their own, reported as readable
     * messages rather than constraint violations.
     */
    private void validateStageConfig(Tournament t) {
        if (Tournament.GROUP_DIVISIONS.equals(t.getGroupStage())) {
            if (t.getPoolCount() == null || t.getPoolCount() < 2) {
                throw new IllegalArgumentException("Divisions format needs a pool count of at least 2.");
            }
            if (t.getTeamCount() != null && t.getPoolCount() > t.getTeamCount()) {
                throw new IllegalArgumentException(
                        "Cannot split " + t.getTeamCount() + " teams into " + t.getPoolCount() + " divisions.");
            }
        }

        // A placement game is one game between the two semifinal losers, so it presupposes
        // semifinals -- i.e. a bracket of at least four.
        if (Boolean.TRUE.equals(t.getPlacementGame())
                && !Tournament.CHAMPIONSHIP_SINGLE_ELIM.equals(t.getChampionshipStage())) {
            throw new IllegalArgumentException(
                    "A placement game needs a single-elimination bracket to take its semifinal losers from.");
        }

        if (!Tournament.CONSOLATION_NONE.equals(t.getConsolationStage())
                && (t.getConsolationTeamCount() == null || t.getConsolationTeamCount() < 2)) {
            throw new IllegalArgumentException("Consolation play needs at least 2 teams.");
        }

        // With no group stage and no bracket there is nothing to generate.
        if (Tournament.GROUP_NONE.equals(t.getGroupStage())
                && Tournament.CHAMPIONSHIP_NONE.equals(t.getChampionshipStage())) {
            throw new IllegalArgumentException(
                    "A tournament needs at least a group stage or a championship bracket.");
        }
    }

    private <T> void applyIfPresent(T value, java.util.function.Consumer<T> setter) {
        if (value != null) {
            setter.accept(value);
        }
    }

    /** "The C League Classic-2026" -> "the-c-league-classic-2026". */
    private String slugify(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");

        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Could not build a URL from '" + input + "'.");
        }
        return normalized.length() > 80 ? normalized.substring(0, 80) : normalized;
    }

    private TournamentDto.Response toResponse(Tournament t) {
        TournamentDto.Response dto = new TournamentDto.Response();
        dto.setId(t.getId());
        dto.setSeasonId(t.getSeasonId());
        dto.setSlug(t.getSlug());
        dto.setName(t.getName());
        dto.setYear(t.getYear());
        dto.setTagline(t.getTagline());

        dto.setGroupStage(t.getGroupStage());
        dto.setPoolCount(t.getPoolCount());
        dto.setAdvancePerPool(t.getAdvancePerPool());
        dto.setChampionshipStage(t.getChampionshipStage());
        dto.setPlacementGame(t.getPlacementGame());
        dto.setConsolationStage(t.getConsolationStage());
        dto.setConsolationTeamCount(t.getConsolationTeamCount());
        dto.setDisplayFormat(t.getDisplayFormat());

        dto.setTeamCount(t.getTeamCount());
        dto.setStartDate(t.getStartDate());
        dto.setEndDate(t.getEndDate());
        dto.setVenue(t.getVenue());
        dto.setEntryFeeCents(t.getEntryFeeCents());
        dto.setEntryDeadline(t.getEntryDeadline());
        dto.setDraftDate(t.getDraftDate());

        dto.setPeriodCount(t.getPeriodCount());
        dto.setPeriodMinutes(t.getPeriodMinutes());
        dto.setScoringProfile(t.getScoringProfile());

        dto.setStatus(t.getStatus());
        dto.setIsPublished(t.getIsPublished());
        dto.setChampionTeamId(t.getChampionTeamId());
        dto.setCrestImageUrl(t.getCrestImageUrl());
        dto.setTrophyImageUrl(t.getTrophyImageUrl());

        dto.setCreatedAt(t.getCreatedAt());
        dto.setUpdatedAt(t.getUpdatedAt());
        return dto;
    }
}
