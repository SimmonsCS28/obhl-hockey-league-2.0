package com.obhl.game.service.scoring;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.game.model.Game;
import com.obhl.game.model.TournamentAward;
import com.obhl.game.repository.GameRepository;
import com.obhl.game.repository.TournamentAwardRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Chocolate Milk Player of the Game.
 *
 * The rule the tradition actually encodes: each captain names a player on the OPPOSING bench. That
 * is enforced here rather than merely described, because the whole point of the award is that it
 * comes from the other team.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TournamentAwardService {

    private final TournamentAwardRepository awardRepository;
    private final GameRepository gameRepository;

    @Transactional(readOnly = true)
    public List<TournamentAward> forGame(Long gameId) {
        return awardRepository.findByGameId(gameId);
    }

    @Transactional(readOnly = true)
    public List<TournamentAward> forSeason(Long seasonId) {
        return awardRepository.findBySeasonIdOrderByCreatedAtDesc(seasonId);
    }

    /**
     * Records (or replaces) one bench's pick for a game.
     *
     * <p>Upsert rather than insert: a captain changing their mind must not produce two winners, so
     * re-picking updates the existing row — which is exactly what the unique key on
     * (game, type, awarding team) already guarantees at the database level.
     */
    @Transactional
    public TournamentAward award(Long gameId, Long awardedByTeamId, Long playerId, Long playerTeamId, String note) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new IllegalArgumentException("Game not found"));

        if (!"TOURNAMENT".equals(game.getGameType())) {
            throw new IllegalArgumentException("Chocolate Milk is a tournament award.");
        }

        boolean benchPlayed = awardedByTeamId != null
                && (awardedByTeamId.equals(game.getHomeTeamId()) || awardedByTeamId.equals(game.getAwayTeamId()));
        if (!benchPlayed) {
            throw new IllegalArgumentException("That team did not play in this game.");
        }

        // The heart of the tradition: you name someone on the other bench, never your own.
        if (playerTeamId != null && playerTeamId.equals(awardedByTeamId)) {
            throw new IllegalArgumentException(
                    "The Chocolate Milk award goes to a player on the opposing team.");
        }
        if (playerTeamId != null
                && !playerTeamId.equals(game.getHomeTeamId())
                && !playerTeamId.equals(game.getAwayTeamId())) {
            throw new IllegalArgumentException("That player did not play in this game.");
        }

        TournamentAward award = awardRepository
                .findByGameIdAndAwardTypeAndAwardedByTeamId(gameId, TournamentAward.CHOCOLATE_MILK, awardedByTeamId)
                .orElseGet(TournamentAward::new);

        award.setGameId(gameId);
        award.setSeasonId(game.getSeasonId());
        award.setAwardType(TournamentAward.CHOCOLATE_MILK);
        award.setAwardedByTeamId(awardedByTeamId);
        award.setPlayerId(playerId);
        award.setTeamId(playerTeamId);
        award.setNote(note);

        TournamentAward saved = awardRepository.save(award);
        log.info("Chocolate Milk: game {} team {} named player {}", gameId, awardedByTeamId, playerId);
        return saved;
    }

    @Transactional
    public void remove(Long awardId) {
        awardRepository.deleteById(awardId);
    }
}
