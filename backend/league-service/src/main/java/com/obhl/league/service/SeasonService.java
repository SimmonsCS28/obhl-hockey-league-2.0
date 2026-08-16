package com.obhl.league.service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.league.dto.SeasonDto;
import com.obhl.league.model.Season;
import com.obhl.league.repository.SeasonRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SeasonService {

    private final SeasonRepository seasonRepository;

    /**
     * Passed as the {@code type} request parameter to ask for every season regardless of type.
     * Deliberately explicit: callers that genuinely want tournament seasons in a league-facing list
     * have to say so.
     */
    public static final String TYPE_ALL = "ALL";

    /**
     * @param type {@link Season#TYPE_LEAGUE}, {@link Season#TYPE_TOURNAMENT}, or {@link #TYPE_ALL}.
     *             Callers get league seasons unless they ask otherwise -- see SeasonController.
     */
    @Transactional(readOnly = true)
    public List<SeasonDto.Response> getAllSeasons(String type) {
        List<Season> seasons = TYPE_ALL.equalsIgnoreCase(type)
                ? seasonRepository.findAllByOrderByStartDateDesc()
                : seasonRepository.findByTypeOrderByStartDateDesc(normalizeType(type));

        return seasons.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<SeasonDto.Response> getSeasonById(Long id) {
        return seasonRepository.findById(id).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Optional<SeasonDto.Response> getActiveSeason() {
        return seasonRepository.findByIsActiveTrue().map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<SeasonDto.Response> getSeasonsByStatus(String status, String type) {
        List<Season> seasons = TYPE_ALL.equalsIgnoreCase(type)
                ? seasonRepository.findByStatus(status)
                : seasonRepository.findByStatusAndType(status, normalizeType(type));

        return seasons.stream().map(this::toResponse).collect(Collectors.toList());
    }

    /**
     * Anything unrecognised collapses to LEAGUE rather than throwing. A typo in a query string
     * should hide the tournament, never expose it -- failing closed is the whole point of the
     * default-deny filter.
     */
    private String normalizeType(String type) {
        return Season.TYPE_TOURNAMENT.equalsIgnoreCase(type)
                ? Season.TYPE_TOURNAMENT
                : Season.TYPE_LEAGUE;
    }

    @Transactional
    public SeasonDto.Response createSeason(SeasonDto.Create dto) {
        Season season = new Season();
        season.setName(dto.getName());
        season.setStartDate(dto.getStartDate());
        season.setEndDate(dto.getEndDate());
        season.setStatus(dto.getStatus());
        season.setIsActive(dto.getIsActive());
        if (dto.getType() != null)
            season.setType(dto.getType());

        return toResponse(seasonRepository.save(season));
    }

    @Transactional
    public SeasonDto.Response updateSeason(Long id, SeasonDto.Update dto) {
        Season season = seasonRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Season not found"));

        if (dto.getName() != null)
            season.setName(dto.getName());
        if (dto.getStartDate() != null)
            season.setStartDate(dto.getStartDate());
        if (dto.getEndDate() != null)
            season.setEndDate(dto.getEndDate());
        if (dto.getStatus() != null)
            season.setStatus(dto.getStatus());
        if (dto.getIsActive() != null)
            season.setIsActive(dto.getIsActive());
        // type is deliberately not updatable. Flipping an existing season between LEAGUE and
        // TOURNAMENT would strand its teams, players and games on the wrong side of every
        // season-type filter in the app. Create a new season instead.

        return toResponse(seasonRepository.save(season));
    }

    @Transactional
    public void deleteSeason(Long id) {
        seasonRepository.deleteById(id);
    }

    private SeasonDto.Response toResponse(Season season) {
        SeasonDto.Response dto = new SeasonDto.Response();
        dto.setId(season.getId());
        dto.setName(season.getName());
        dto.setStartDate(season.getStartDate());
        dto.setEndDate(season.getEndDate());
        dto.setStatus(season.getStatus());
        dto.setType(season.getType());
        dto.setIsActive(season.getIsActive());
        dto.setCreatedAt(season.getCreatedAt());
        dto.setUpdatedAt(season.getUpdatedAt());
        return dto;
    }
}
