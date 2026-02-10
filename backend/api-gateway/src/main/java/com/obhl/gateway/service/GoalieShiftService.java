package com.obhl.gateway.service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.GameDayDTO;
import com.obhl.gateway.dto.GoalieAvailabilityRequest;
import com.obhl.gateway.dto.ShiftAssignmentDTO;
import com.obhl.gateway.model.GoalieProfile;
import com.obhl.gateway.model.GoalieUnavailability;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.GoalieProfileRepository;
import com.obhl.gateway.repository.GoalieUnavailabilityRepository;
import com.obhl.gateway.repository.UserRepository;

@Service
public class GoalieShiftService {

    @Autowired
    private GoalieUnavailabilityRepository unavailabilityRepository;

    @Autowired
    private GoalieProfileRepository profileRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private TeamService teamService;

    /**
     * Get all game days for the current season
     */
    public List<GameDayDTO> getGameDays(Long seasonId) {
        return gameProxyService.getGameDaysBySeason(seasonId);
    }

    /**
     * Get unavailable dates for a goalie
     */
    public List<LocalDate> getMyUnavailability(Long userId) {
        return unavailabilityRepository.findByUserId(userId)
                .stream()
                .map(GoalieUnavailability::getUnavailableDate)
                .collect(Collectors.toList());
    }

    /**
     * Get ALL unavailability (for Admin)
     */
    public List<com.obhl.gateway.dto.GoalieUnavailabilityDTO> getAllUnavailability() {
        return unavailabilityRepository.findAll()
                .stream()
                .map(u -> new com.obhl.gateway.dto.GoalieUnavailabilityDTO(u.getUser().getId(), u.getUnavailableDate()))
                .collect(Collectors.toList());
    }

    /**
     * Mark dates as unavailable
     */
    @Transactional
    public void markUnavailable(Long userId, GoalieAvailabilityRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        for (LocalDate date : request.getDates()) {
            // Check if already exists
            if (unavailabilityRepository.findByUserIdAndUnavailableDate(userId, date).isEmpty()) {
                GoalieUnavailability unavailability = new GoalieUnavailability();
                unavailability.setUser(user);
                unavailability.setUnavailableDate(date);
                unavailabilityRepository.save(unavailability);
            }
        }
    }

    /**
     * Remove unavailable date
     */
    @Transactional
    public void removeUnavailableDate(Long userId, LocalDate date) {
        unavailabilityRepository.findByUserIdAndUnavailableDate(userId, date)
                .ifPresent(unavailabilityRepository::delete);
    }

    /**
     * Get goalie's assigned games
     */
    public List<ShiftAssignmentDTO> getMyAssignments(Long userId) {
        List<com.obhl.gateway.dto.GameResponseDTO> games = gameProxyService.getGoalieAssignments(userId);

        return games.stream().map(game -> {
            ShiftAssignmentDTO dto = new ShiftAssignmentDTO();
            dto.setGameId(game.getId());
            dto.setGameDate(game.getGameDate().toLocalDate());
            dto.setGameTime(game.getGameDate().toLocalTime());

            // Fetch team names
            // Note: This could be optimized with caching or bulk fetch if needed
            if (game.getHomeTeamId() != null) {
                teamService.getTeamById(game.getHomeTeamId())
                        .ifPresent(team -> dto.setHomeTeam(team.getName()));
            }

            if (game.getAwayTeamId() != null) {
                teamService.getTeamById(game.getAwayTeamId())
                        .ifPresent(team -> dto.setAwayTeam(team.getName()));
            }

            dto.setRole("GOALIE");
            return dto;
        }).collect(Collectors.toList());
    }

    /**
     * Get or create goalie profile
     */
    public GoalieProfile getOrCreateProfile(Long userId) {
        return profileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new RuntimeException("User not found"));
                    GoalieProfile profile = new GoalieProfile();
                    profile.setUser(user);
                    return profileRepository.save(profile);
                });
    }
}
