package com.obhl.league.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.league.model.Tournament;

@Repository
public interface TournamentRepository extends JpaRepository<Tournament, Long> {

    Optional<Tournament> findBySlug(String slug);

    Optional<Tournament> findBySeasonId(Long seasonId);

    boolean existsBySlug(String slug);

    /** Archive listing, newest first. */
    List<Tournament> findAllByOrderByYearDesc();

    /** Public listing -- unpublished tournaments are still being set up. */
    List<Tournament> findByIsPublishedTrueOrderByYearDesc();
}
