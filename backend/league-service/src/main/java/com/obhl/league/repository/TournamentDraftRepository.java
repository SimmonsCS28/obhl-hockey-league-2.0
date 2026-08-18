package com.obhl.league.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.league.model.TournamentDraft;

@Repository
public interface TournamentDraftRepository extends JpaRepository<TournamentDraft, Long> {
    Optional<TournamentDraft> findByTournamentId(Long tournamentId);
}
