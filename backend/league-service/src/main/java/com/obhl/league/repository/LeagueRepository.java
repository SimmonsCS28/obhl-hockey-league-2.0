package com.obhl.league.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import main.java.com.obhl.league.model.League;

@Repository
public interface LeagueRepository extends JpaRepository<League, Long> {

    List<League> findBySeasonId(Long seasonId);

    List<League> findBySeasonIdOrderByDisplayOrderAsc(Long seasonId);

    Optional<League> findBySeasonIdAndName(Long seasonId, String name);

    List<League> findByLeagueType(String leagueType);
}
