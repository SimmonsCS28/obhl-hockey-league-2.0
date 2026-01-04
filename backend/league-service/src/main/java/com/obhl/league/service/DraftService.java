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
            if ("completed".equals(draft.getStatus())) {
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

            // 3. Create Season with default dates (admin can update later)
            // First, mark all existing seasons as completed and inactive
            List<Season> existingSeasons = seasonRepository.findAll();
            for (Season existingSeason : existingSeasons) {
                existingSeason.setIsActive(false);
                existingSeason.setStatus("completed");
            }
            seasonRepository.saveAll(existingSeasons);

            // Now create the new season and set it as active
            Season season = new Season();
            season.setName(draftState.getSeasonName());
            // Set default dates - admin can update these later
            season.setStartDate(LocalDate.now()); // Default to today
            season.setEndDate(LocalDate.now().plusMonths(6)); // Default to 6 months from now
            season.setStatus("active");
            season.setIsActive(true); // Set as active since this is the current season
            season = seasonRepository.save(season);
            createdSeasonId = season.getId(); // Track for rollback

            System.out.println("Created season with ID: " + createdSeasonId);

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
                    // Check if player exists in this season via StatsClient
                    Map<String, Object> existingPlayerData = null;
                    try {
                        existingPlayerData = statsClient.getPlayerByEmailAndSeason(
                                draftPlayer.getEmail(),
                                season.getId());
                    } catch (Exception e) {
                        // 404 means player doesn't exist, which is fine - we'll create them
                        // Any other error will be caught by the outer try-catch
                    }

                    Map<String, Object> playerData = new HashMap<>();
                    playerData.put("email", draftPlayer.getEmail());
                    playerData.put("firstName", draftPlayer.getFirstName());
                    playerData.put("lastName", draftPlayer.getLastName());
                    playerData.put("position", draftPlayer.getPosition());
                    playerData.put("skillRating", draftPlayer.getSkillRating());
                    playerData.put("isVeteran", "Veteran".equals(draftPlayer.getStatus()));
                    playerData.put("teamId", teamId);
                    playerData.put("seasonId", season.getId());
                    playerData.put("isActive", true);

                    Map<String, Object> savedPlayer;
                    if (existingPlayerData == null) {
                        // Create new player
                        savedPlayer = statsClient.createPlayer(playerData);
                        Long playerId = ((Number) savedPlayer.get("id")).longValue();
                        createdPlayerIds.add(playerId); // Track for rollback
                        System.out.println("Created player: " + draftPlayer.getFirstName() + " " +
                                draftPlayer.getLastName() + " (ID: " + playerId + ")");
                    } else {
                        // Update existing player
                        Long playerId = ((Number) existingPlayerData.get("id")).longValue();
                        savedPlayer = statsClient.updatePlayer(playerId, playerData);
                        System.out.println("Updated existing player: " + draftPlayer.getFirstName() + " " +
                                draftPlayer.getLastName() + " (ID: " + playerId + ")");
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

            // 7. Mark draft as completed
            draft.setStatus("completed");
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