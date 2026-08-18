package com.obhl.league.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.league.model.TournamentDraftPick;

@Repository
public interface TournamentDraftPickRepository extends JpaRepository<TournamentDraftPick, Long> {

    List<TournamentDraftPick> findByTournamentIdOrderByPickNumberAsc(Long tournamentId);

    Optional<TournamentDraftPick> findByTournamentIdAndEntrantId(Long tournamentId, Long entrantId);

    List<TournamentDraftPick> findByTournamentIdAndTeamId(Long tournamentId, Long teamId);

    void deleteByTournamentIdAndEntrantId(Long tournamentId, Long entrantId);

    void deleteByTournamentId(Long tournamentId);
}
