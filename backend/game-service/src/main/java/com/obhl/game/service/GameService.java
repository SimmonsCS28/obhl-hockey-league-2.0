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

    @Transactional(readOnly = true)
    public List<GameDto.Response> getAllGames() {
        return gameRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGamesBySeason(Long seasonId) {
        return gameRepository.findBySeasonIdOrderByGameDateDesc(seasonId)
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
        game.setGameNotes(dto.getGameNotes());

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
        if (dto.getGameNotes() != null)
            game.setGameNotes(dto.getGameNotes());

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
        dto.setGameNotes(game.getGameNotes());
        dto.setCreatedAt(game.getCreatedAt());
        dto.setUpdatedAt(game.getUpdatedAt());
        return dto;
    }
}
