package com.obhl.gateway.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
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
 * Positive goalie availability, marked per game night. Weeks, nights and game counts are derived
 * from the season's games; the goalie's chosen status per night is stored in
 * {@code goalie_availability}. Most weeks have a single night, where this reads exactly like the
 * old per-week model; a week with games on two nights lets a goalie be free for only one.
 */
@Service
public class GoalieAvailabilityService {

    private static final ZoneId LEAGUE_TZ = ZoneId.of("America/Chicago");

    @Autowired
    private GoalieAvailabilityRepository availabilityRepository;

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private UserRepository userRepository;

    /**
     * The game's night: its calendar date in league time. Game times are stored as UTC, so an 8pm
     * Thursday game is Friday in UTC -- every per-night check must go through this.
     */
    public static LocalDate leagueNight(LocalDateTime utcGameDate) {
        if (utcGameDate == null) {
            return null;
        }
        return utcGameDate.atZone(ZoneOffset.UTC).withZoneSameInstant(LEAGUE_TZ).toLocalDate();
    }

    /** Each scheduled week of the season, with its nights and the goalie's status for each. */
    public List<GoalieAvailabilityDto.WeekAvailability> getForUser(Long userId, Long seasonId) {
        Map<Integer, GoalieAvailabilityDto.WeekAvailability> weeks = weeksForSeason(seasonId);

        Map<LocalDate, String> statusByNight = availabilityRepository.findByUserIdAndSeasonId(userId, seasonId).stream()
                .collect(Collectors.toMap(GoalieAvailability::getGameDate, GoalieAvailability::getStatus, (a, b) -> a));

        for (GoalieAvailabilityDto.WeekAvailability w : weeks.values()) {
            List<String> statuses = new ArrayList<>();
            for (GoalieAvailabilityDto.NightAvailability n : w.getNights()) {
                n.setStatus(statusByNight.get(n.getDate()));
                statuses.add(n.getStatus());
            }
            w.setStatus(weekStatus(statuses));
        }
        return new ArrayList<>(weeks.values());
    }

    /** Set every night of a week at once; a null/blank status clears them. */
    @Transactional
    public void setStatus(Long userId, Long seasonId, Integer week, String status) {
        if (week == null) {
            throw new RuntimeException("week is required");
        }
        GoalieAvailabilityDto.WeekAvailability w = weeksForSeason(seasonId).get(week);
        if (w == null) {
            throw new RuntimeException("No games scheduled for week " + week);
        }
        String s = normalizeStatus(status);
        for (GoalieAvailabilityDto.NightAvailability n : w.getNights()) {
            write(userId, seasonId, week, n.getDate(), s);
        }
    }

    /** Set one game night; a null/blank status clears it. */
    @Transactional
    public void setNightStatus(Long userId, Long seasonId, LocalDate night, String status) {
        if (night == null) {
            throw new RuntimeException("date is required");
        }
        Integer week = weekOfNight(seasonId, night);
        if (week == null) {
            throw new RuntimeException("No games scheduled on " + night);
        }
        write(userId, seasonId, week, night, normalizeStatus(status));
    }

    /**
     * Coordinator pool: every goalie who marked at least one of the week's nights, with which nights
     * they're free and which they're out.
     */
    public List<GoalieAvailabilityDto.GoalieWeekStatus> getForWeek(Long seasonId, Integer week) {
        Set<LocalDate> weekNights = nightsOfWeek(seasonId, week);
        Map<Long, GoalieAvailabilityDto.GoalieWeekStatus> byUser = new TreeMap<>();
        for (GoalieAvailability a : availabilityRepository.findBySeasonIdAndWeek(seasonId, week)) {
            if (!weekNights.contains(a.getGameDate())) {
                continue;   // a night whose games were moved away; it no longer means anything
            }
            GoalieAvailabilityDto.GoalieWeekStatus g = byUser.computeIfAbsent(a.getUserId(), uid -> {
                GoalieAvailabilityDto.GoalieWeekStatus n = new GoalieAvailabilityDto.GoalieWeekStatus();
                n.setUserId(uid);
                n.setUserName(userName(uid));
                return n;
            });
            if (GoalieAvailability.STATUS_UNAVAILABLE.equals(a.getStatus())) {
                g.getUnavailableNights().add(a.getGameDate());
            } else {
                g.getAvailableNights().add(a.getGameDate());
            }
        }
        for (GoalieAvailabilityDto.GoalieWeekStatus g : byUser.values()) {
            g.getAvailableNights().sort(null);
            g.getUnavailableNights().sort(null);
            if (g.getUnavailableNights().isEmpty()) {
                g.setStatus(GoalieAvailability.STATUS_AVAILABLE);
            } else if (g.getUnavailableNights().containsAll(weekNights)) {
                g.setStatus(GoalieAvailability.STATUS_UNAVAILABLE);
            } else {
                g.setStatus(GoalieAvailabilityDto.STATUS_PARTIAL);
            }
        }
        return new ArrayList<>(byUser.values());
    }

    /** Per goalie, the nights of this week they marked themselves out. Goalies with none are absent. */
    public Map<Long, Set<LocalDate>> unavailableNights(Long seasonId, Integer week) {
        Map<Long, Set<LocalDate>> out = new HashMap<>();
        for (GoalieAvailability a : availabilityRepository.findBySeasonIdAndWeek(seasonId, week)) {
            if (GoalieAvailability.STATUS_UNAVAILABLE.equals(a.getStatus())) {
                out.computeIfAbsent(a.getUserId(), k -> new HashSet<>()).add(a.getGameDate());
            }
        }
        return out;
    }

    /** The distinct league-time nights that week's games fall on. */
    public Set<LocalDate> nightsOfWeek(Long seasonId, Integer week) {
        GoalieAvailabilityDto.WeekAvailability w = weeksForSeason(seasonId).get(week);
        Set<LocalDate> nights = new TreeSet<>();
        if (w != null) {
            w.getNights().forEach(n -> nights.add(n.getDate()));
        }
        return nights;
    }

    // ---- helpers ----

    private void write(Long userId, Long seasonId, Integer week, LocalDate night, String status) {
        Optional<GoalieAvailability> existing = availabilityRepository
                .findByUserIdAndSeasonIdAndGameDate(userId, seasonId, night);
        if (status == null) {
            existing.ifPresent(availabilityRepository::delete);
            return;
        }
        GoalieAvailability a = existing.orElseGet(GoalieAvailability::new);
        a.setUserId(userId);
        a.setSeasonId(seasonId);
        a.setWeek(week);
        a.setGameDate(night);
        a.setStatus(status);
        availabilityRepository.save(a);
    }

    /** Null for "clear"; otherwise AVAILABLE or UNAVAILABLE. */
    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String s = status.trim().toUpperCase();
        if (!s.equals(GoalieAvailability.STATUS_AVAILABLE) && !s.equals(GoalieAvailability.STATUS_UNAVAILABLE)) {
            throw new RuntimeException("status must be AVAILABLE or UNAVAILABLE");
        }
        return s;
    }

    /** All nights agree -> that status; none set -> null; anything else -> PARTIAL. */
    static String weekStatus(List<String> nightStatuses) {
        Set<String> distinct = new HashSet<>(nightStatuses);
        if (distinct.size() == 1) {
            return distinct.iterator().next();
        }
        return distinct.isEmpty() ? null : GoalieAvailabilityDto.STATUS_PARTIAL;
    }

    private Integer weekOfNight(Long seasonId, LocalDate night) {
        List<GameResponseDTO> games = gameProxyService.getGamesBySeason(seasonId);
        if (games == null) {
            return null;
        }
        return games.stream()
                .filter(g -> g.getWeek() != null && night.equals(leagueNight(g.getGameDate())))
                .map(GameResponseDTO::getWeek)
                .findFirst()
                .orElse(null);
    }

    private Map<Integer, GoalieAvailabilityDto.WeekAvailability> weeksForSeason(Long seasonId) {
        List<GameResponseDTO> games = gameProxyService.getGamesBySeason(seasonId);
        Map<Integer, GoalieAvailabilityDto.WeekAvailability> weeks = new TreeMap<>();
        if (games == null) {
            return weeks;
        }
        Map<Integer, TreeMap<LocalDate, int[]>> nightCounts = new HashMap<>();
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
            w.setGamesCount(w.getGamesCount() + 1);
            LocalDateTime d = g.getGameDate();
            if (d != null) {
                if (w.getStartDate() == null || d.isBefore(w.getStartDate())) {
                    w.setStartDate(d);
                }
                if (w.getEndDate() == null || d.isAfter(w.getEndDate())) {
                    w.setEndDate(d);
                }
                nightCounts.computeIfAbsent(week, k -> new TreeMap<>())
                        .computeIfAbsent(leagueNight(d), k -> new int[]{0})[0]++;
            }
        }
        for (Map.Entry<Integer, TreeMap<LocalDate, int[]>> e : nightCounts.entrySet()) {
            List<GoalieAvailabilityDto.NightAvailability> nights = weeks.get(e.getKey()).getNights();
            e.getValue().forEach((night, count) ->
                    nights.add(new GoalieAvailabilityDto.NightAvailability(night, count[0], null)));
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
