package com.obhl.league.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.league.client.StatsClient;
import com.obhl.league.dto.DraftPlayerDTO;
import com.obhl.league.dto.DraftStateDTO;
import com.obhl.league.dto.DraftTeamDTO;
import com.obhl.league.model.Season;
import com.obhl.league.repository.SeasonRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DraftService {

    private final SeasonRepository seasonRepository;
    private final StatsClient statsClient;

    @Transactional
    public void finalizeDraft(DraftStateDTO draftState) {
        // 1. Create Season
        Season season = new Season();
        season.setName(draftState.getSeasonName());
        season.setIsActive(true);
        season = seasonRepository.save(season);

        // 2. Prepare all players for batch creation
        // Note: Team creation is handled separately via the Team Management UI
        // The teamId in the draft state is a temporary frontend ID
        // Players will be created without team assignment initially
        List<Map<String, Object>> playersToCreate = new ArrayList<>();

        // Add players from teams (without team assignment for now)
        for (DraftTeamDTO teamDTO : draftState.getTeams()) {
            for (DraftPlayerDTO playerDTO : teamDTO.getPlayers()) {
                playersToCreate.add(mapPlayer(playerDTO, season.getId(), null));
            }
        }

        // Add unassigned players from pool
        for (DraftPlayerDTO playerDTO : draftState.getPlayerPool()) {
            playersToCreate.add(mapPlayer(playerDTO, season.getId(), null));
        }

        // 3. Batch Create Players via Stats Service
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
        return map;
    }
}
