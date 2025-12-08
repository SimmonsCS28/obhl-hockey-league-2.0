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

    @Transactional(readOnly = true)
    public List<SeasonDto.Response> getAllSeasons() {
        return seasonRepository.findAllByOrderByStartDateDesc()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
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
    public List<SeasonDto.Response> getSeasonsByStatus(String status) {
        return seasonRepository.findByStatus(status)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public SeasonDto.Response createSeason(SeasonDto.Create dto) {
        Season season = new Season();
        season.setName(dto.getName());
        season.setStartDate(dto.getStartDate());
        season.setEndDate(dto.getEndDate());
        season.setStatus(dto.getStatus());
        season.setIsActive(dto.getIsActive());

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
        dto.setIsActive(season.getIsActive());
        dto.setCreatedAt(season.getCreatedAt());
        dto.setUpdatedAt(season.getUpdatedAt());
        return dto;
    }
}
