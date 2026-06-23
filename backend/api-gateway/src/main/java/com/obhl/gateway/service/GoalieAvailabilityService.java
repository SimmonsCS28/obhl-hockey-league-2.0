package com.obhl.gateway.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.GoalieAvailabilityDto;
import com.obhl.gateway.model.GoalieAvailability;
import com.obhl.gateway.repository.GoalieAvailabilityRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Positive, per-week goalie availability (v3). Weeks + game counts are derived from the season's
 * games; the goalie's chosen status per week is stored in {@code goalie_availability}.
 */
@Service
public class GoalieAvailabilityService {

    @Autowired
    private GoalieAvailabilityRepository availabilityRepository;

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private UserRepository userRepository;

    /** Each scheduled week of the season with the goalie's status (null = not set). */
    public List<GoalieAvailabilityDto.WeekAvailability> getForUser(Long userId, Long seasonId) {
        Map<Integer, GoalieAvailabilityDto.WeekAvailability> weeks = weeksForSeason(seasonId);

        Map<Integer, String> statusByWeek = availabilityRepository.findByUserIdAndSeasonId(userId, seasonId).stream()
                .collect(Collectors.toMap(GoalieAvailability::getWeek, GoalieAvailability::getStatus, (a, b) -> a));

        for (GoalieAvailabilityDto.WeekAvailability w : weeks.values()) {
            w.setStatus(statusByWeek.get(w.getWeek()));
        }
        return new ArrayList<>(weeks.values());
    }

    /** Upsert one week's status; a null/blank status clears it. */
    @Transactional
    public void setStatus(Long userId, Long seasonId, Integer week, String status) {
        if (week == null) {
            throw new RuntimeException("week is required");
        }
        Optional<GoalieAvailability> existing = availabilityRepository
                .findByUserIdAndSeasonIdAndWeek(userId, seasonId, week);

        if (status == null || status.isBlank()) {
            existing.ifPresent(availabilityRepository::delete);
            return;
        }
        String s = status.trim().toUpperCase();
        if (!s.equals(GoalieAvailability.STATUS_AVAILABLE) && !s.equals(GoalieAvailability.STATUS_UNAVAILABLE)) {
            throw new RuntimeException("status must be AVAILABLE or UNAVAILABLE");
        }
        GoalieAvailability a = existing.orElseGet(GoalieAvailability::new);
        a.setUserId(userId);
        a.setSeasonId(seasonId);
        a.setWeek(week);
        a.setStatus(s);
        availabilityRepository.save(a);
    }

    /** Coordinator pool: every goalie who set a status for the given week. */
    public List<GoalieAvailabilityDto.GoalieWeekStatus> getForWeek(Long seasonId, Integer week) {
        return availabilityRepository.findBySeasonIdAndWeek(seasonId, week).stream()
                .map(a -> new GoalieAvailabilityDto.GoalieWeekStatus(a.getUserId(), userName(a.getUserId()), a.getStatus()))
                .collect(Collectors.toList());
    }

    // ---- helpers ----

    private Map<Integer, GoalieAvailabilityDto.WeekAvailability> weeksForSeason(Long seasonId) {
        List<GameResponseDTO> games = gameProxyService.getGamesBySeason(seasonId);
        Map<Integer, GoalieAvailabilityDto.WeekAvailability> weeks = new TreeMap<>();
        if (games == null) {
            return weeks;
        }
        Map<Integer, int[]> counts = new HashMap<>();
        for (GameResponseDTO g : games) {
            Integer week = g.getWeek();
            if (week == null) {
                continue;
            }
            GoalieAvailabilityDto.WeekAvailability w = weeks.computeIfAbsent(week, k -> {
                GoalieAvailabilityDto.WeekAvailability nw = new GoalieAvailabilityDto.WeekAvailability();
                nw.setWeek(k);
                nw.setGamesCount(0);
                return nw;
            });
            counts.computeIfAbsent(week, k -> new int[]{0})[0]++;
            w.setGamesCount(counts.get(week)[0]);
            LocalDateTime d = g.getGameDate();
            if (d != null) {
                if (w.getStartDate() == null || d.isBefore(w.getStartDate())) {
                    w.setStartDate(d);
                }
                if (w.getEndDate() == null || d.isAfter(w.getEndDate())) {
                    w.setEndDate(d);
                }
            }
        }
        return weeks;
    }

    private String userName(Long userId) {
        return userRepository.findById(userId)
                .map(u -> (u.getFirstName() != null && u.getLastName() != null)
                        ? (u.getFirstName() + " " + u.getLastName())
                        : u.getUsername())
                .orElse("User " + userId);
    }
}
