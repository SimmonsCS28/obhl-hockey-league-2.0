package com.obhl.league.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.league.client.StatsClient;
import com.obhl.league.client.TeamClient;
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
    private final TeamClient teamClient;
    private final DraftSaveRepository draftSaveRepository;

    @Transactional
    public Long finalizeDraft(Long draftId) throws Exception {
        // Tracking for compensation/rollback
        Long createdSeasonId = null;
        List<Long> createdTeamIds = new ArrayList<>();
        List<Long> createdPlayerIds = new ArrayList<>();

        try {
            // 1. Load draft save
            Optional<DraftSave> draftOpt = draftSaveRepository.findById(draftId);
            if (!draftOpt.isPresent()) {
                throw new IllegalArgumentException("Draft not found with id: " + draftId);
            }

            DraftSave draft = draftOpt.get();
            if ("complete".equals(draft.getStatus())) {
                throw new IllegalStateException("Draft already finalized");
            }

            // Parse draft data
            DraftStateDTO draftState = parseDraftData(draft.getDraftData());

            // 2. VALIDATE: All teams must have a GM
            List<String> teamsWithoutGM = new ArrayList<>();
            for (DraftTeamDTO team : draftState.getTeams()) {
                boolean hasGM = team.getPlayers().stream()
                        .anyMatch(DraftPlayerDTO::isGm);
                if (!hasGM) {
                    teamsWithoutGM.add(team.getName());
                }
            }

            if (!teamsWithoutGM.isEmpty()) {
                throw new IllegalStateException(
                        "The following teams do not have a GM: " + String.join(", ", teamsWithoutGM) +
                                ". All teams must have at least one GM before finalizing.");
            }

            // 3. Resolve the Season
            Season season;
            if (draftState.getSeasonId() != null) {
                // Use the pre-existing season selected during drafting
                Optional<Season> seasonOpt = seasonRepository.findById(draftState.getSeasonId());
                if (!seasonOpt.isPresent()) {
                    throw new IllegalArgumentException(
                        "Selected season not found with id: " + draftState.getSeasonId() +
                        ". The season may have been deleted. Please re-open the draft and select a valid season.");
                }
                season = seasonOpt.get();
            } else {
                // Fallback: create a new season from the name (legacy behaviour)
                Season newSeason = new Season();
                newSeason.setName(draftState.getSeasonName());
                newSeason.setStartDate(LocalDate.now());
                newSeason.setEndDate(LocalDate.now().plusMonths(6));
                newSeason.setStatus("active");
                newSeason.setIsActive(true);
                season = seasonRepository.save(newSeason);
                createdSeasonId = season.getId(); // Only track for rollback in fallback path
                System.out.println("Created new season (legacy fallback) with ID: " + createdSeasonId);
            }

            // Mark all OTHER seasons as completed and inactive
            List<Season> existingSeasons = seasonRepository.findAll();
            for (Season existingSeason : existingSeasons) {
                if (!existingSeason.getId().equals(season.getId())) {
                    existingSeason.setIsActive(false);
                    existingSeason.setStatus("completed");
                }
            }
            seasonRepository.saveAll(existingSeasons);

            // Activate the selected season
            season.setStatus("active");
            season.setIsActive(true);
            season = seasonRepository.save(season);

            System.out.println("Activated season '" + season.getName() + "' with ID: " + season.getId());


            // Track all successfully drafted player IDs so we can deactivate the rest
            List<Long> draftedPlayerIds = new ArrayList<>();

            // 4. Create Teams and Players
            // Track abbreviations to ensure uniqueness
            java.util.Set<String> usedAbbreviations = new java.util.HashSet<>();

            for (DraftTeamDTO draftTeam : draftState.getTeams()) {
                // Create team via TeamClient
                Map<String, Object> teamData = new HashMap<>();
                teamData.put("name", draftTeam.getName());

                // Generate unique abbreviation
                String baseAbbr = generateAbbreviation(draftTeam.getName());
                String uniqueAbbr = baseAbbr;
                int counter = 2;
                while (usedAbbreviations.contains(uniqueAbbr)) {
                    uniqueAbbr = baseAbbr + counter;
                    counter++;
                }
                usedAbbreviations.add(uniqueAbbr);

                teamData.put("abbreviation", uniqueAbbr);
                teamData.put("seasonId", season.getId());
                // Truncate color to 7 characters to match database constraint
                String color = draftTeam.getColor();
                if (color != null && color.length() > 7) {
                    color = color.substring(0, 7);
                }
                teamData.put("teamColor", color);
                teamData.put("active", true);
                teamData.put("points", 0);
                teamData.put("wins", 0);
                teamData.put("losses", 0);
                teamData.put("ties", 0);
                teamData.put("overtimeWins", 0);
                teamData.put("overtimeLosses", 0);
                teamData.put("goalsFor", 0);
                teamData.put("goalsAgainst", 0);

                // Call TeamClient to create team
                Map<String, Object> createdTeam = teamClient.createTeam(teamData);
                Long teamId = ((Number) createdTeam.get("id")).longValue();
                createdTeamIds.add(teamId); // Track for rollback

                System.out.println("Created team '" + draftTeam.getName() + "' with ID: " + teamId + " (Abbr: "
                        + uniqueAbbr + ")");

                // Find GM player to set gmId later
                DraftPlayerDTO gmPlayer = draftTeam.getPlayers().stream()
                        .filter(DraftPlayerDTO::isGm)
                        .findFirst()
                        .get(); // Safe because we validated above

                Long gmPlayerId = null;

                // 5. Create/Update Players for this team
                for (DraftPlayerDTO draftPlayer : draftTeam.getPlayers()) {
                    // Per-season model: look up by email + NEW seasonId only.
                    // If a record already exists for this season, update it (idempotent re-run).
                    // Otherwise always create a fresh record — never touch prior-season records.
                    Map<String, Object> existingPlayerData = null;
                    try {
                        existingPlayerData = statsClient.getPlayerByEmailAndSeason(
                                draftPlayer.getEmail(), season.getId());
                    } catch (Exception e) {
                        // 404 = no record for this season yet — that's expected for new seasons
                    }

                    Map<String, Object> playerData = mapPlayer(draftPlayer, season.getId(), teamId);

                    Map<String, Object> savedPlayer;
                    if (existingPlayerData != null) {
                        // Update the existing record for this season
                        Long playerId = ((Number) existingPlayerData.get("id")).longValue();
                        savedPlayer = statsClient.updatePlayer(playerId, playerData);
                        System.out.println("Updated existing season record for: " + draftPlayer.getFirstName() + " "
                                + draftPlayer.getLastName() + " (ID: " + playerId + ")");
                    } else {
                        // Create a new record for this season (prior-season records untouched)
                        savedPlayer = statsClient.createPlayer(playerData);
                        Long playerId = ((Number) savedPlayer.get("id")).longValue();
                        createdPlayerIds.add(playerId);
                        System.out.println("Created new season record for: " + draftPlayer.getFirstName() + " "
                                + draftPlayer.getLastName() + " (ID: " + playerId + ")");
                    }

                    if (savedPlayer != null && savedPlayer.get("id") != null) {
                        draftedPlayerIds.add(((Number) savedPlayer.get("id")).longValue());
                    }

                    // Track GM player ID
                    if (draftPlayer.isGm()) {
                        gmPlayerId = ((Number) savedPlayer.get("id")).longValue();
                    }
                }

                // 6. Update team with gmId
                if (gmPlayerId != null) {
                    teamData.put("gmId", gmPlayerId);
                    teamClient.updateTeam(teamId, teamData);
                    System.out.println("Updated team '" + draftTeam.getName() + "' with GM ID: " + gmPlayerId);
                }
            }

            // Under the per-season model, undrafted players simply have no record for the
            // new season — we don't need to deactivate historical records.

            // 8. Mark draft as completed
            draft.setStatus("complete");
            draftSaveRepository.save(draft);

            System.out.println("Draft finalization completed successfully! Season ID: " + season.getId());

            return season.getId();

        } catch (Exception e) {
            // COMPENSATION LOGIC: Rollback all created entities
            System.err.println("Draft finalization failed! Rolling back... Error: " + e.getMessage());
            compensateFailedFinalization(createdSeasonId, createdTeamIds, createdPlayerIds);

            // Re-throw the exception with context
            throw new Exception("Failed to finalize draft: " + e.getMessage(), e);
        }
    }

    /**
     * Compensation method to rollback created entities if finalization fails
     */
    private void compensateFailedFinalization(Long seasonId, List<Long> teamIds, List<Long> playerIds) {
        System.err.println("Starting compensation/rollback...");
        System.err.println("Season ID to delete: " + seasonId);
        System.err.println("Team IDs to delete: " + teamIds);
        System.err.println("Player IDs to delete: " + playerIds);

        // Delete players (reverse order of creation)
        for (Long playerId : playerIds) {
            try {
                statsClient.deletePlayer(playerId);
                System.err.println("Deleted player with ID: " + playerId);
            } catch (Exception e) {
                System.err.println("Warning: Failed to delete player " + playerId + ": " + e.getMessage());
                // Continue with other deletions even if one fails
            }
        }

        // Delete teams
        for (Long teamId : teamIds) {
            try {
                teamClient.deleteTeam(teamId);
                System.err.println("Deleted team with ID: " + teamId);
            } catch (Exception e) {
                System.err.println("Warning: Failed to delete team " + teamId + ": " + e.getMessage());
                // Continue with other deletions even if one fails
            }
        }

        // Delete season (local database operation)
        if (seasonId != null) {
            try {
                seasonRepository.deleteById(seasonId);
                System.err.println("Deleted season with ID: " + seasonId);
            } catch (Exception e) {
                System.err.println("Warning: Failed to delete season " + seasonId + ": " + e.getMessage());
            }
        }

        System.err.println("Compensation/rollback completed.");
    }

    /**
     * Generate team abbreviation from team name
     * Takes first 3 letters or first letter of each word
     */
    private String generateAbbreviation(String teamName) {
        if (teamName == null || teamName.trim().isEmpty()) {
            return "TM";
        }

        teamName = teamName.trim();
        String[] words = teamName.split("\\s+");

        if (words.length == 1) {
            // Single word - take first 3 letters
            return teamName.substring(0, Math.min(3, teamName.length())).toUpperCase();
        } else {
            // Multiple words - take first letter of each word (max 3)
            StringBuilder abbr = new StringBuilder();
            for (int i = 0; i < Math.min(3, words.length); i++) {
                if (!words[i].isEmpty()) {
                    abbr.append(words[i].charAt(0));
                }
            }
            return abbr.toString().toUpperCase();
        }
    }

    /**
     * Parse draft data JSON into DraftStateDTO
     */
    private DraftStateDTO parseDraftData(String draftDataJson) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return objectMapper.readValue(draftDataJson, DraftStateDTO.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse draft data: " + e.getMessage(), e);
        }
    }

    private Map<String, Object> mapPlayer(DraftPlayerDTO dto, Long seasonId, Long teamId) {
        Map<String, Object> map = new HashMap<>();
        map.put("firstName", dto.getFirstName());
        map.put("lastName", dto.getLastName());
        map.put("email", dto.getEmail());
        map.put("position", normalizePosition(dto.getPosition()));
        // Clamp skill rating to valid range [1, 10] — DB constraint rejects 0
        int rating = dto.getSkillRating();
        if (rating < 1) rating = 1;
        if (rating > 10) rating = 10;
        map.put("skillRating", rating);
        map.put("isVeteran", dto.isVeteran());
        map.put("seasonId", seasonId);
        map.put("teamId", teamId);
        map.put("isActive", true);
        return map;
    }

    private String normalizePosition(String position) {
        if (position == null)
            return "F";
        String p = position.trim().toUpperCase();
        if (p.startsWith("F") || p.contains("FORWARD"))
            return "F";
        if (p.startsWith("D") || p.contains("DEFENSE"))
            return "D";
        if (p.startsWith("G") || p.contains("GOALIE"))
            return "G";
        return "F"; // Default fallback
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