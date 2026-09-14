package com.obhl.gateway.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.client.LeagueClient;
import com.obhl.gateway.client.StatsClient;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.GoalieCareerDto;
import com.obhl.gateway.dto.GoaliePerformanceDto;
import com.obhl.gateway.dto.PlayerDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;

import feign.FeignException;

/**
 * Season goalie performance (GAA, W/L, shutouts, last-5 form), computed on read from
 * completed games — nothing is persisted. There is no shot tracking in this league, so
 * this only derives what's available from final scores + goalie assignments
 * (games.goalie1Id = home team's goalie, games.goalie2Id = away team's goalie, both
 * user IDs, bridged to a players row by email match — mirrors the pattern already used
 * in PlayerManagement.jsx).
 */
@Service
public class GoaliePerformanceService {

    private static final Logger log = LoggerFactory.getLogger(GoaliePerformanceService.class);

    @Autowired
    private StatsClient statsClient;

    @Autowired
    private LeagueClient leagueClient;

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private UserRepository userRepository;

    public List<GoaliePerformanceDto> getPerformance(Long seasonId) {
        List<PlayerDto> goalies = statsClient.getPlayersBySeason(seasonId).stream()
                .filter(p -> "G".equals(p.getPosition()))
                .collect(Collectors.toList());

        // userId -> display name, for both the goalies themselves and any opposing
        // goalie encountered while walking games (may not be in this season's roster).
        Map<Long, String> nameByUserId = new HashMap<>();
        Map<String, Long> userIdByEmail = new HashMap<>();
        for (PlayerDto p : goalies) {
            if (p.getEmail() == null) {
                continue;
            }
            userRepository.findByEmail(p.getEmail()).ifPresent(u -> {
                userIdByEmail.put(p.getEmail(), u.getId());
                nameByUserId.put(u.getId(), displayName(u));
            });
        }

        List<GameResponseDTO> games = gameProxyService.getGamesBySeason(seasonId);
        List<GameResponseDTO> completed = (games == null ? List.<GameResponseDTO>of() : games).stream()
                .filter(g -> "completed".equals(g.getStatus()))
                .sorted(Comparator.comparing(GameResponseDTO::getGameDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());

        List<GoaliePerformanceDto> result = new ArrayList<>();
        for (PlayerDto player : goalies) {
            Long userId = player.getEmail() != null ? userIdByEmail.get(player.getEmail()) : null;

            List<GoaliePerformanceDto.GameLine> lines = new ArrayList<>();
            if (userId != null) {
                for (GameResponseDTO g : completed) {
                    GoaliePerformanceDto.GameLine line = gameLine(userId, g, nameByUserId);
                    if (line != null) {
                        lines.add(line);
                    }
                }
            }

            int gp = lines.size();
            int totalGa = lines.stream().mapToInt(l -> l.getGa() != null ? l.getGa() : 0).sum();
            int wins = (int) lines.stream().filter(l -> "W".equals(l.getResult())).count();
            int losses = (int) lines.stream().filter(l -> "L".equals(l.getResult())).count();
            int shutouts = (int) lines.stream().filter(l -> l.getGa() != null && l.getGa() == 0).count();
            Double gaa = gp == 0 ? null : Math.round((totalGa / (double) gp) * 100.0) / 100.0;

            GoaliePerformanceDto dto = new GoaliePerformanceDto();
            dto.setPlayerId(player.getId());
            dto.setUserId(userId);
            dto.setName(userId != null ? nameByUserId.get(userId) : (player.getFirstName() + " " + player.getLastName()));
            dto.setGaa(gaa);
            dto.setGp(gp);
            dto.setWins(wins);
            dto.setLosses(losses);
            dto.setShutouts(shutouts);
            dto.setRating(player.getSkillRating());
            dto.setLast5(lines.stream().limit(5).collect(Collectors.toList()));
            result.add(dto);
        }

        result.sort(Comparator.comparing(GoaliePerformanceDto::getName, Comparator.nullsLast(String::compareToIgnoreCase)));
        return result;
    }

    /**
     * Career line for one goalie: every completed REGULAR_SEASON / PLAYOFF game they were in
     * net for, any season. Tournament games are excluded here even though the season view
     * includes them when asked for a tournament season — a career is league play only.
     */
    public GoalieCareerDto getCareer(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such user"));

        Map<Long, SeasonInfo> seasons = loadSeasons();
        List<GameResponseDTO> games = gameProxyService.getGoalieAssignments(userId);
        Map<Long, String> nameByUserId = new HashMap<>();
        nameByUserId.put(userId, displayName(user));

        List<GoaliePerformanceDto.GameLine> all = new ArrayList<>();
        Map<Long, List<GoaliePerformanceDto.GameLine>> bySeason = new HashMap<>();
        for (GameResponseDTO g : games == null ? List.<GameResponseDTO>of() : games) {
            if (!"completed".equals(g.getStatus()) || !countsTowardCareer(g, seasons)) {
                continue;
            }
            GoaliePerformanceDto.GameLine line = gameLine(userId, g, nameByUserId);
            if (line == null) {
                continue;
            }
            all.add(line);
            bySeason.computeIfAbsent(g.getSeasonId(), k -> new ArrayList<>()).add(line);
        }

        List<GoalieCareerDto.SeasonLine> seasonLines = bySeason.entrySet().stream()
                .map(e -> {
                    SeasonInfo info = seasons.get(e.getKey());
                    Totals t = Totals.of(e.getValue());
                    return new GoalieCareerDto.SeasonLine(e.getKey(),
                            info == null ? null : info.name,
                            t.gp, t.wins, t.losses, t.ties, t.shutouts, t.gaa());
                })
                .sorted(Comparator
                        .comparing((GoalieCareerDto.SeasonLine sl) -> {
                            SeasonInfo info = seasons.get(sl.getSeasonId());
                            return info == null ? null : info.startDate;
                        }, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(GoalieCareerDto.SeasonLine::getSeasonId,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());

        Totals t = Totals.of(all);
        GoalieCareerDto dto = new GoalieCareerDto();
        dto.setUserId(userId);
        dto.setName(displayName(user));
        dto.setGp(t.gp);
        dto.setWins(t.wins);
        dto.setLosses(t.losses);
        dto.setTies(t.ties);
        dto.setShutouts(t.shutouts);
        dto.setGoalsAgainst(t.goalsAgainst);
        dto.setGaa(t.gaa());
        dto.setSeasonsPlayed(seasonLines.size());
        dto.setSeasons(seasonLines);
        return dto;
    }

    /** REGULAR_SEASON or PLAYOFF (null = pre-migration-010 rows, all regular season), never a tournament. */
    private boolean countsTowardCareer(GameResponseDTO g, Map<Long, SeasonInfo> seasons) {
        if ("TOURNAMENT".equals(g.getGameType())) {
            return false;
        }
        SeasonInfo season = g.getSeasonId() == null ? null : seasons.get(g.getSeasonId());
        return season == null || !"TOURNAMENT".equals(season.type);
    }

    /**
     * The one place a game becomes a goalie's line — season view and career view both go
     * through here so W/L/T, GA and GAA can never drift apart. Returns null when the user
     * wasn't in either net.
     */
    private GoaliePerformanceDto.GameLine gameLine(Long userId, GameResponseDTO g, Map<Long, String> nameByUserId) {
        boolean isHome = userId.equals(g.getGoalie1Id());
        boolean isAway = userId.equals(g.getGoalie2Id());
        if (!isHome && !isAway) {
            return null;
        }

        Long teamId = isHome ? g.getHomeTeamId() : g.getAwayTeamId();
        Long oppTeamId = isHome ? g.getAwayTeamId() : g.getHomeTeamId();
        Integer gf = isHome ? g.getHomeScore() : g.getAwayScore();
        Integer ga = isHome ? g.getAwayScore() : g.getHomeScore();
        Long oppGoalieUserId = isHome ? g.getGoalie2Id() : g.getGoalie1Id();
        String oppGoalieName = oppGoalieUserId == null ? "TBD" : resolveName(nameByUserId, oppGoalieUserId);
        String resultStr = (gf == null || ga == null) ? null : gf > ga ? "W" : gf < ga ? "L" : "T";

        return new GoaliePerformanceDto.GameLine(
                g.getId(), g.getGameDate(), teamId, oppTeamId, oppGoalieName, gf, ga, resultStr);
    }

    private static final class Totals {
        int gp;
        int wins;
        int losses;
        int ties;
        int shutouts;
        int goalsAgainst;

        static Totals of(List<GoaliePerformanceDto.GameLine> lines) {
            Totals t = new Totals();
            t.gp = lines.size();
            t.goalsAgainst = lines.stream().mapToInt(l -> l.getGa() != null ? l.getGa() : 0).sum();
            t.wins = (int) lines.stream().filter(l -> "W".equals(l.getResult())).count();
            t.losses = (int) lines.stream().filter(l -> "L".equals(l.getResult())).count();
            t.ties = (int) lines.stream().filter(l -> "T".equals(l.getResult())).count();
            t.shutouts = (int) lines.stream().filter(l -> l.getGa() != null && l.getGa() == 0).count();
            return t;
        }

        Double gaa() {
            return gp == 0 ? null : Math.round((goalsAgainst / (double) gp) * 100.0) / 100.0;
        }
    }

    private static final class SeasonInfo {
        String name;
        String type;
        LocalDate startDate;
    }

    // Same shape as PlayerProfileService.loadSeasons: league-service returns loose maps.
    private Map<Long, SeasonInfo> loadSeasons() {
        try {
            List<Map<String, Object>> raw = leagueClient.getSeasons("ALL");
            Map<Long, SeasonInfo> out = new HashMap<>();
            if (raw == null) {
                return out;
            }
            for (Map<String, Object> s : raw) {
                Object id = s.get("id");
                if (!(id instanceof Number)) {
                    continue;
                }
                SeasonInfo info = new SeasonInfo();
                info.name = s.get("name") == null ? null : String.valueOf(s.get("name"));
                info.type = s.get("type") == null ? null : String.valueOf(s.get("type"));
                Object start = s.get("startDate");
                if (start != null) {
                    try {
                        info.startDate = LocalDate.parse(String.valueOf(start));
                    } catch (RuntimeException ignored) {
                        // anything non-ISO just loses sort precision
                    }
                }
                out.put(((Number) id).longValue(), info);
            }
            return out;
        } catch (FeignException e) {
            log.warn("league-service failed listing seasons for goalie career: {}", e.getMessage());
            return Map.of();
        }
    }

    private String displayName(User u) {
        return (u.getFirstName() != null && u.getLastName() != null)
                ? (u.getFirstName() + " " + u.getLastName())
                : u.getUsername();
    }

    private String resolveName(Map<Long, String> nameByUserId, Long userId) {
        String cached = nameByUserId.get(userId);
        if (cached != null) {
            return cached;
        }
        String resolved = userRepository.findById(userId).map(this::displayName).orElse("TBD");
        nameByUserId.put(userId, resolved);
        return resolved;
    }
}
