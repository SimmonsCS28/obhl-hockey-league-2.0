package com.obhl.game.service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.game.dto.GameDto;
import com.obhl.game.model.Game;
import com.obhl.game.repository.GameRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GameService {

    private final GameRepository gameRepository;
    private final PointsCalculator pointsCalculator;
    private final TeamStatsUpdater teamStatsUpdater;
    private final PlayerStatsAggregator playerStatsAggregator;

    @Transactional(readOnly = true)
    public List<GameDto.Response> getAllGames() {
        return gameRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGamesBySeason(Long seasonId) {
        return gameRepository.findBySeasonIdOrderByGameDate(seasonId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGamesByStatus(String status) {
        return gameRepository.findByStatus(status)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGamesByTeam(Long teamId) {
        return gameRepository.findByHomeTeamIdOrAwayTeamId(teamId, teamId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<GameDto.Response> getGameById(Long id) {
        return gameRepository.findById(id).map(this::toResponse);
    }

    @Transactional
    public GameDto.Response createGame(GameDto.Create dto) {
        Game game = new Game();
        game.setSeasonId(dto.getSeasonId());
        game.setLeagueId(dto.getLeagueId());
        game.setHomeTeamId(dto.getHomeTeamId());
        game.setAwayTeamId(dto.getAwayTeamId());
        game.setGameDate(dto.getGameDate());
        game.setVenue(dto.getVenue());
        game.setStatus(dto.getStatus());
        game.setHomeScore(dto.getHomeScore());
        game.setAwayScore(dto.getAwayScore());
        game.setOvertime(dto.getOvertime());
        game.setShootout(dto.getShootout());
        game.setPeriod(dto.getPeriod());
        game.setWeek(dto.getWeek());
        game.setRink(dto.getRink());
        game.setGameNotes(dto.getGameNotes());
        game.setGoalie1Id(dto.getGoalie1Id());
        game.setGoalie2Id(dto.getGoalie2Id());
        game.setReferee1Id(dto.getReferee1Id());
        game.setReferee2Id(dto.getReferee2Id());
        game.setScorekeeperId(dto.getScorekeeperId());

        return toResponse(gameRepository.save(game));
    }

    @Transactional
    public GameDto.Response updateGame(Long id, GameDto.Update dto) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (dto.getSeasonId() != null)
            game.setSeasonId(dto.getSeasonId());
        if (dto.getLeagueId() != null)
            game.setLeagueId(dto.getLeagueId());
        if (dto.getHomeTeamId() != null)
            game.setHomeTeamId(dto.getHomeTeamId());
        if (dto.getAwayTeamId() != null)
            game.setAwayTeamId(dto.getAwayTeamId());
        if (dto.getGameDate() != null)
            game.setGameDate(dto.getGameDate());
        if (dto.getVenue() != null)
            game.setVenue(dto.getVenue());
        if (dto.getStatus() != null)
            game.setStatus(dto.getStatus());
        if (dto.getHomeScore() != null)
            game.setHomeScore(dto.getHomeScore());
        if (dto.getAwayScore() != null)
            game.setAwayScore(dto.getAwayScore());
        if (dto.getOvertime() != null)
            game.setOvertime(dto.getOvertime());
        if (dto.getShootout() != null)
            game.setShootout(dto.getShootout());
        if (dto.getPeriod() != null)
            game.setPeriod(dto.getPeriod());
        if (dto.getWeek() != null)
            game.setWeek(dto.getWeek());
        if (dto.getRink() != null)
            game.setRink(dto.getRink());
        if (dto.getGameNotes() != null)
            game.setGameNotes(dto.getGameNotes());
        if (dto.getGoalie1Id() != null)
            game.setGoalie1Id(dto.getGoalie1Id() == -1 ? null : dto.getGoalie1Id());
        if (dto.getGoalie2Id() != null)
            game.setGoalie2Id(dto.getGoalie2Id() == -1 ? null : dto.getGoalie2Id());
        if (dto.getReferee1Id() != null)
            game.setReferee1Id(dto.getReferee1Id() == -1 ? null : dto.getReferee1Id());
        if (dto.getReferee2Id() != null)
            game.setReferee2Id(dto.getReferee2Id() == -1 ? null : dto.getReferee2Id());
        if (dto.getScorekeeperId() != null)
            game.setScorekeeperId(dto.getScorekeeperId() == -1 ? null : dto.getScorekeeperId());

        return toResponse(gameRepository.save(game));
    }

    @Transactional
    public void deleteGame(Long id) {
        gameRepository.deleteById(id);
    }

    @Transactional
    public GameDto.Response updateGameScore(Long id, GameDto.ScoreUpdate scoreUpdate) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        game.setHomeScore(scoreUpdate.getHomeScore());
        game.setAwayScore(scoreUpdate.getAwayScore());

        return toResponse(gameRepository.save(game));
    }

    @Transactional
    public GameDto.Response finalizeGame(Long id, GameDto.FinalizeRequest finalizeRequest) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        // Update scores
        game.setHomeScore(finalizeRequest.getHomeScore());
        game.setAwayScore(finalizeRequest.getAwayScore());
        game.setEndedInOT(finalizeRequest.getEndedInOT());
        game.setStatus("completed");

        // Calculate points using PointsCalculator
        pointsCalculator.calculateAndSetPoints(game);

        // Save game first
        Game savedGame = gameRepository.save(game);

        // Update team standings
        teamStatsUpdater.updateTeamStats(savedGame);

        // Aggregate and update player stats
        playerStatsAggregator.aggregateAndUpdateStats(savedGame);

        return toResponse(savedGame);
    }

    private GameDto.Response toResponse(Game game) {
        GameDto.Response dto = new GameDto.Response();
        dto.setId(game.getId());
        dto.setSeasonId(game.getSeasonId());
        dto.setLeagueId(game.getLeagueId());
        dto.setHomeTeamId(game.getHomeTeamId());
        dto.setAwayTeamId(game.getAwayTeamId());
        dto.setGameDate(game.getGameDate());
        dto.setVenue(game.getVenue());
        dto.setStatus(game.getStatus());
        dto.setHomeScore(game.getHomeScore());
        dto.setAwayScore(game.getAwayScore());
        dto.setOvertime(game.getOvertime());
        dto.setShootout(game.getShootout());
        dto.setPeriod(game.getPeriod());
        dto.setEndedInOT(game.getEndedInOT());
        dto.setHomeTeamPoints(game.getHomeTeamPoints());
        dto.setAwayTeamPoints(game.getAwayTeamPoints());
        dto.setWeek(game.getWeek());
        dto.setRink(game.getRink());
        dto.setGameNotes(game.getGameNotes());
        dto.setGoalie1Id(game.getGoalie1Id());
        dto.setGoalie2Id(game.getGoalie2Id());
        dto.setReferee1Id(game.getReferee1Id());
        dto.setReferee2Id(game.getReferee2Id());
        dto.setScorekeeperId(game.getScorekeeperId());
        dto.setCreatedAt(game.getCreatedAt());
        dto.setUpdatedAt(game.getUpdatedAt());
        return dto;
    }

    // Shift Assignment Methods
    @Transactional(readOnly = true)
    public List<com.obhl.game.dto.GameDayDTO> getGameDaysBySeason(Long seasonId) {
        java.util.Map<java.time.LocalDate, Long> gamesPerDay = gameRepository.findBySeasonIdOrderByGameDate(seasonId)
                .stream()
                .collect(Collectors.groupingBy(
                        game -> game.getGameDate().toLocalDate(),
                        Collectors.counting()));

        return gamesPerDay.entrySet().stream()
                .map(entry -> new com.obhl.game.dto.GameDayDTO(entry.getKey(), entry.getValue().intValue()))
                .sorted(java.util.Comparator.comparing(com.obhl.game.dto.GameDayDTO::getDate))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGoalieAssignments(Long userId) {
        return gameRepository.findByGoalie1IdOrGoalie2Id(userId, userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getRefereeAssignments(Long userId) {
        return gameRepository.findByReferee1IdOrReferee2Id(userId, userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getScorekeeperAssignments(Long userId) {
        return gameRepository.findByScorekeeperId(userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getAvailableRefereeGames(Long seasonId) {
        return gameRepository.findBySeasonIdOrderByGameDate(seasonId)
                .stream()
                .filter(game -> game.getReferee1Id() == null || game.getReferee2Id() == null)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getAvailableScorekeeperGames(Long seasonId) {
        return gameRepository.findBySeasonIdOrderByGameDate(seasonId)
                .stream()
                .filter(game -> game.getScorekeeperId() == null)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void assignReferee(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (game.getReferee1Id() == null) {
            game.setReferee1Id(userId);
        } else if (game.getReferee2Id() == null) {
            game.setReferee2Id(userId);
        } else {
            throw new RuntimeException("Game already has two referees assigned");
        }

        gameRepository.save(game);
    }

    @Transactional
    public void removeReferee(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (userId.equals(game.getReferee1Id())) {
            game.setReferee1Id(null);
        } else if (userId.equals(game.getReferee2Id())) {
            game.setReferee2Id(null);
        }

        gameRepository.save(game);
    }

    @Transactional
    public void assignScorekeeper(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (game.getScorekeeperId() != null) {
            throw new RuntimeException("Game already has a scorekeeper assigned");
        }

        game.setScorekeeperId(userId);
        gameRepository.save(game);
    }

    @Transactional
    public void removeScorekeeper(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (userId.equals(game.getScorekeeperId())) {
            game.setScorekeeperId(null);
        }

        gameRepository.save(game);
    }
}
