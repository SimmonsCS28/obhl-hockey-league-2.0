package com.obhl.league.service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.league.dto.LeagueDto;
import com.obhl.league.model.League;
import com.obhl.league.repository.LeagueRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LeagueService {

    private final LeagueRepository leagueRepository;

    @Transactional(readOnly = true)
    public List<LeagueDto.Response> getAllLeagues() {
        return leagueRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LeagueDto.Response> getLeaguesBySeason(Long seasonId) {
        return leagueRepository.findBySeasonIdOrderByDisplayOrderAsc(seasonId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<LeagueDto.Response> getLeagueById(Long id) {
        return leagueRepository.findById(id).map(this::toResponse);
    }

    @Transactional
    public LeagueDto.Response createLeague(LeagueDto.Create dto) {
        League league = new League();
        league.setSeasonId(dto.getSeasonId());
        league.setName(dto.getName());
        league.setAbbreviation(dto.getAbbreviation());
        league.setDescription(dto.getDescription());
        league.setLeagueType(dto.getLeagueType());
        league.setDisplayOrder(dto.getDisplayOrder());

        return toResponse(leagueRepository.save(league));
    }

    @Transactional
    public LeagueDto.Response updateLeague(Long id, LeagueDto.Update dto) {
        League league = leagueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("League not found"));

        if (dto.getSeasonId() != null)
            league.setSeasonId(dto.getSeasonId());
        if (dto.getName() != null)
            league.setName(dto.getName());
        if (dto.getAbbreviation() != null)
            league.setAbbreviation(dto.getAbbreviation());
        if (dto.getDescription() != null)
            league.setDescription(dto.getDescription());
        if (dto.getLeagueType() != null)
            league.setLeagueType(dto.getLeagueType());
        if (dto.getDisplayOrder() != null)
            league.setDisplayOrder(dto.getDisplayOrder());

        return toResponse(leagueRepository.save(league));
    }

    @Transactional
    public void deleteLeague(Long id) {
        leagueRepository.deleteById(id);
    }

    private LeagueDto.Response toResponse(League league) {
        LeagueDto.Response dto = new LeagueDto.Response();
        dto.setId(league.getId());
        dto.setSeasonId(league.getSeasonId());
        dto.setName(league.getName());
        dto.setAbbreviation(league.getAbbreviation());
        dto.setDescription(league.getDescription());
        dto.setLeagueType(league.getLeagueType());
        dto.setDisplayOrder(league.getDisplayOrder());
        dto.setCreatedAt(league.getCreatedAt());
        dto.setUpdatedAt(league.getUpdatedAt());
        return dto;
    }
}
