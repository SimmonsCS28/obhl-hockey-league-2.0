package com.obhl.game.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.game.model.TournamentAward;

@Repository
public interface TournamentAwardRepository extends JpaRepository<TournamentAward, Long> {

    List<TournamentAward> findByGameId(Long gameId);

    List<TournamentAward> findBySeasonIdOrderByCreatedAtDesc(Long seasonId);

    /** Matches the unique key: one award of a type per bench per game. */
    Optional<TournamentAward> findByGameIdAndAwardTypeAndAwardedByTeamId(
            Long gameId, String awardType, Long awardedByTeamId);
}
