package com.obhl.league.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.obhl.league.model.TournamentDraftEntrant;

@Repository
public interface TournamentDraftEntrantRepository extends JpaRepository<TournamentDraftEntrant, Long> {

    List<TournamentDraftEntrant> findByTournamentIdOrderByLastNameAscFirstNameAsc(Long tournamentId);

    List<TournamentDraftEntrant> findByTournamentIdAndIsGmTrue(Long tournamentId);

    /**
     * Case-insensitive lookup. Matches the partial unique index on (tournament_id, lower(email)) --
     * querying with a plain equals here would let 'Bob@x.com' slip past an existing 'bob@x.com' and
     * then fail at insert.
     */
    @Query("SELECT e FROM TournamentDraftEntrant e "
         + "WHERE e.tournamentId = :tournamentId AND LOWER(e.email) = LOWER(:email)")
    Optional<TournamentDraftEntrant> findByTournamentIdAndEmailIgnoreCase(
            @Param("tournamentId") Long tournamentId, @Param("email") String email);

    void deleteByTournamentId(Long tournamentId);
}
