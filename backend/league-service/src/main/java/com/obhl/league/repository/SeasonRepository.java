package com.obhl.league.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.league.model.Season;

@Repository
public interface SeasonRepository extends JpaRepository<Season, Long> {

    Optional<Season> findByName(String name);

    List<Season> findByStatus(String status);

    /**
     * Safe without a type filter: chk_tournament_never_active (migration 046) guarantees a
     * tournament season can never be is_active, so this can only ever return a league season.
     */
    Optional<Season> findByIsActiveTrue();

    List<Season> findAllByOrderByStartDateDesc();

    List<Season> findByTypeOrderByStartDateDesc(String type);

    List<Season> findByStatusAndType(String status, String type);

    /** Used by the draft's "complete every other season" pass, which must not touch tournaments. */
    List<Season> findByType(String type);
}
