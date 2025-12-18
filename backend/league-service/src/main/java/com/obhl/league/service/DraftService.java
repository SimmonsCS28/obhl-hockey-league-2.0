package com.obhl.league.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.league.client.StatsClient;
import com.obhl.league.dto.DraftPlayerDTO;
import com.obhl.league.dto.DraftStateDTO;
import com.obhl.league.dto.DraftTeamDTO;
import com.obhl.league.model.DraftSave;
import com.obhl.league.model.Season;
import com.obhl.league.repository.DraftSaveRepository;
import com.obhl.league.repository.SeasonRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DraftService {

    private final SeasonRepository seasonRepository;
    private final StatsClient statsClient;
    private final DraftSaveRepository draftSaveRepository;

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

    // ===== Draft Save/Load Methods =====

    /**
     * Save a new draft or update existing one
     */
    @Transactional
    public DraftSave saveDraft(String seasonName, String draftDataJson) {
        DraftSave draftSave = new DraftSave(seasonName, "saved", draftDataJson);
        return draftSaveRepository.save(draftSave);
    }

    /**
     * Update an existing draft
     */
    @Transactional
    public DraftSave updateDraft(Long id, String draftDataJson) {
        Optional<DraftSave> existing = draftSaveRepository.findById(id);
        if (existing.isPresent()) {
            DraftSave draftSave = existing.get();
            draftSave.setDraftData(draftDataJson);
            return draftSaveRepository.save(draftSave);
        }
        throw new RuntimeException("Draft save not found with id: " + id);
    }

    /**
     * Get the most recent draft save
     */
    public Optional<DraftSave> getLatestDraft() {
        return draftSaveRepository.findTopByOrderByCreatedAtDesc();
    }

    /**
     * Get a specific draft by ID
     */
    public Optional<DraftSave> getDraftById(Long id) {
        return draftSaveRepository.findById(id);
    }

    /**
     * Mark a draft as complete
     */
    @Transactional
    public DraftSave completeDraft(Long id) {
        Optional<DraftSave> existing = draftSaveRepository.findById(id);
        if (existing.isPresent()) {
            DraftSave draftSave = existing.get();
            draftSave.setStatus("complete");
            return draftSaveRepository.save(draftSave);
        }
        throw new RuntimeException("Draft save not found with id: " + id);
    }

    /**
     * Delete a draft save
     */
    @Transactional
    public void deleteDraft(Long id) {
        draftSaveRepository.deleteById(id);
    }
}
