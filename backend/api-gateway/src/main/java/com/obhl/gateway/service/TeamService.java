package com.obhl.gateway.service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.client.StatsClient;
import com.obhl.gateway.dto.TeamDto;
import com.obhl.gateway.model.Team;
import com.obhl.gateway.repository.TeamRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;
    private final StatsClient statsClient;

    @Transactional(readOnly = true)
    public List<TeamDto.Response> getTeams(Long seasonId, int skip, int limit) {
        return teamRepository.findAll()
                .stream()
                .filter(team -> seasonId == null || team.getSeasonId().equals(seasonId))
                .skip(skip)
                .limit(limit)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<TeamDto.Response> getTeamById(Long id) {
        return teamRepository.findById(id).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Optional<TeamDto.Response> getTeamByName(String name) {
        return teamRepository.findByName(name).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Optional<TeamDto.Response> getTeamByNameAndSeason(String name, Long seasonId) {
        return teamRepository.findBySeasonIdAndName(seasonId, name).map(this::toResponse);
    }

    @Transactional
    public TeamDto.Response createTeam(TeamDto.Create dto) {
        Team team = new Team();
        team.setName(dto.getName());
        team.setAbbreviation(dto.getAbbreviation());
        team.setSeasonId(dto.getSeasonId());
        team.setLogoUrl(dto.getLogoUrl());
        team.setTeamColor(dto.getTeamColor());
        team.setGmId(dto.getGmId());
        team.setActive(dto.getActive());
        team.setPoints(dto.getPoints());
        team.setWins(dto.getWins());
        team.setLosses(dto.getLosses());
        team.setTies(dto.getTies());
        team.setOvertimeWins(dto.getOvertimeWins());
        team.setOvertimeLosses(dto.getOvertimeLosses());
        team.setGoalsFor(dto.getGoalsFor());
        team.setGoalsAgainst(dto.getGoalsAgainst());

        return toResponse(teamRepository.save(team));
    }

    @Transactional
    public TeamDto.Response updateTeam(Long id, TeamDto.Update dto) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Team not found"));

        if (dto.getName() != null)
            team.setName(dto.getName());
        if (dto.getAbbreviation() != null)
            team.setAbbreviation(dto.getAbbreviation());
        if (dto.getSeasonId() != null)
            team.setSeasonId(dto.getSeasonId());
        if (dto.getLogoUrl() != null)
            team.setLogoUrl(dto.getLogoUrl());
        if (dto.getTeamColor() != null)
            team.setTeamColor(dto.getTeamColor());
        if (dto.getGmId() != null)
            team.setGmId(dto.getGmId());
        if (dto.getActive() != null)
            team.setActive(dto.getActive());
        if (dto.getPoints() != null)
            team.setPoints(dto.getPoints());
        if (dto.getWins() != null)
            team.setWins(dto.getWins());
        if (dto.getLosses() != null)
            team.setLosses(dto.getLosses());
        if (dto.getTies() != null)
            team.setTies(dto.getTies());
        if (dto.getOvertimeWins() != null)
            team.setOvertimeWins(dto.getOvertimeWins());
        if (dto.getOvertimeLosses() != null)
            team.setOvertimeLosses(dto.getOvertimeLosses());
        if (dto.getGoalsFor() != null)
            team.setGoalsFor(dto.getGoalsFor());
        if (dto.getGoalsAgainst() != null)
            team.setGoalsAgainst(dto.getGoalsAgainst());

        return toResponse(teamRepository.save(team));
    }

    @Transactional
    public void deleteTeam(Long id) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Team not found"));
        team.setActive(false);
        teamRepository.save(team);
    }

    @Transactional
    public void incrementTeamStats(Long id, java.util.Map<String, Integer> statsUpdate) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Team not found"));

        // Helper to safely get integer from map
        java.util.function.Function<String, Integer> getStat = (key) -> {
            Integer val = statsUpdate.get(key);
            return val != null ? val : 0;
        };

        // Helper to safely get current team stat
        java.util.function.Function<Integer, Integer> getCurrent = (val) -> val != null ? val : 0;

        // Increment stats safely
        if (statsUpdate.containsKey("wins"))
            team.setWins(getCurrent.apply(team.getWins()) + getStat.apply("wins"));
        if (statsUpdate.containsKey("losses"))
            team.setLosses(getCurrent.apply(team.getLosses()) + getStat.apply("losses"));
        if (statsUpdate.containsKey("ties"))
            team.setTies(getCurrent.apply(team.getTies()) + getStat.apply("ties"));
        if (statsUpdate.containsKey("overtimeWins"))
            team.setOvertimeWins(getCurrent.apply(team.getOvertimeWins()) + getStat.apply("overtimeWins"));
        if (statsUpdate.containsKey("overtimeLosses"))
            team.setOvertimeLosses(getCurrent.apply(team.getOvertimeLosses()) + getStat.apply("overtimeLosses"));
        if (statsUpdate.containsKey("goalsFor"))
            team.setGoalsFor(getCurrent.apply(team.getGoalsFor()) + getStat.apply("goalsFor"));
        if (statsUpdate.containsKey("goalsAgainst"))
            team.setGoalsAgainst(getCurrent.apply(team.getGoalsAgainst()) + getStat.apply("goalsAgainst"));
        if (statsUpdate.containsKey("points"))
            team.setPoints(getCurrent.apply(team.getPoints()) + getStat.apply("points"));

        teamRepository.save(team);
    }

    private TeamDto.Response toResponse(Team team) {
        TeamDto.Response dto = new TeamDto.Response();
        dto.setId(team.getId());
        dto.setName(team.getName());
        dto.setAbbreviation(team.getAbbreviation());
        dto.setSeasonId(team.getSeasonId());
        dto.setLogoUrl(team.getLogoUrl());
        dto.setTeamColor(team.getTeamColor());
        dto.setGmId(team.getGmId());

        // Fetch GM name from stats-service if gmId is present
        if (team.getGmId() != null) {
            try {
                PlayerDTO player = statsClient.getPlayer(team.getGmId());
                dto.setGmName(player.getFirstName() + " " + player.getLastName());
            } catch (Exception e) {
                // If stats-service is down, set GM name to null
                dto.setGmName(null);
            }
        }

        dto.setActive(team.getActive());
        dto.setPoints(team.getPoints());
        dto.setWins(team.getWins());
        dto.setLosses(team.getLosses());
        dto.setTies(team.getTies());
        dto.setOvertimeWins(team.getOvertimeWins());
        dto.setOvertimeLosses(team.getOvertimeLosses());
        dto.setGoalsFor(team.getGoalsFor());
        dto.setGoalsAgainst(team.getGoalsAgainst());
        dto.setCreatedAt(team.getCreatedAt());
        dto.setUpdatedAt(team.getUpdatedAt());
        return dto;
    }
}
