package com.obhl.gateway.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.client.LeagueClient;
import com.obhl.gateway.client.StatsClient;
import com.obhl.gateway.dto.DraftPlayerDTO;
import com.obhl.gateway.dto.DraftStateDTO;
import com.obhl.gateway.dto.DraftTeamDTO;
import com.obhl.gateway.model.Team;
import com.obhl.gateway.repository.TeamRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DraftService {

    private final TeamRepository teamRepository;
    private final LeagueClient leagueClient;
    private final StatsClient statsClient;

    @Transactional
    public void finalizeDraft(DraftStateDTO draftState) {
        // 1. Create Season (via League Service)
        Map<String, Object> seasonMap = new HashMap<>();
        seasonMap.put("name", draftState.getSeasonName());
        seasonMap.put("isActive", true);
        // Add other season fields if necessary

        Map<String, Object> createdSeason = leagueClient.createSeason(seasonMap);
        Long seasonId = ((Number) createdSeason.get("id")).longValue();

        // 2. Create Teams and Map Players (Local Team Repo)
        List<Map<String, Object>> playersToCreate = new ArrayList<>();

        for (DraftTeamDTO teamDTO : draftState.getTeams()) {
            Team team = new Team();
            team.setName(teamDTO.getName());
            team.setSeasonId(seasonId);
            team.setActive(true);
            // Default values
            team.setWins(0);
            team.setLosses(0);
            team.setTies(0);
            team.setOvertimeWins(0);
            team.setOvertimeLosses(0);
            team.setPoints(0);
            team.setGoalsFor(0);
            team.setGoalsAgainst(0);

            team = teamRepository.save(team);

            for (DraftPlayerDTO playerDTO : teamDTO.getPlayers()) {
                playersToCreate.add(mapPlayer(playerDTO, seasonId, team.getId()));
            }
        }

        // 3. Handle Unassigned Players (Pool)
        for (DraftPlayerDTO playerDTO : draftState.getPlayerPool()) {
            playersToCreate.add(mapPlayer(playerDTO, seasonId, null));
        }

        // 4. Batch Create Players (via Stats Service)
        if (!playersToCreate.isEmpty()) {
            statsClient.createPlayers(playersToCreate);
        }
    }

    private Map<String, Object> mapPlayer(DraftPlayerDTO dto, Long seasonId, Long teamId) {
        Map<String, Object> map = new HashMap<>();
        map.put("firstName", dto.getFirstName());
        map.put("lastName", dto.getLastName());
        map.put("email", dto.getEmail());
        map.put("position", dto.getPosition());
        map.put("skillRating", dto.getSkillRating());
        map.put("isVeteran", dto.isVeteran());
        map.put("seasonId", seasonId);
        map.put("teamId", teamId);
        map.put("isActive", true);
        // Default values
        map.put("jerseyNumber", 0);
        map.put("shoots", "R");
        return map;
    }
}
