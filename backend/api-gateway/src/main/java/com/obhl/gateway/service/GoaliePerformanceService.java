package com.obhl.gateway.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.obhl.gateway.client.StatsClient;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.GoaliePerformanceDto;
import com.obhl.gateway.dto.PlayerDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;

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

    @Autowired
    private StatsClient statsClient;

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
                    boolean isHome = userId.equals(g.getGoalie1Id());
                    boolean isAway = userId.equals(g.getGoalie2Id());
                    if (!isHome && !isAway) {
                        continue;
                    }

                    Long teamId = isHome ? g.getHomeTeamId() : g.getAwayTeamId();
                    Long oppTeamId = isHome ? g.getAwayTeamId() : g.getHomeTeamId();
                    Integer gf = isHome ? g.getHomeScore() : g.getAwayScore();
                    Integer ga = isHome ? g.getAwayScore() : g.getHomeScore();
                    Long oppGoalieUserId = isHome ? g.getGoalie2Id() : g.getGoalie1Id();
                    String oppGoalieName = oppGoalieUserId == null ? "TBD" : resolveName(nameByUserId, oppGoalieUserId);
                    String resultStr = (gf == null || ga == null) ? null : gf > ga ? "W" : gf < ga ? "L" : "T";

                    lines.add(new GoaliePerformanceDto.GameLine(
                            g.getId(), g.getGameDate(), teamId, oppTeamId, oppGoalieName, gf, ga, resultStr));
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
