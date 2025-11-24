package com.obhl.league.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import main.java.com.obhl.league.model.Season;

@Repository
public interface SeasonRepository extends JpaRepository<Season, Long> {

    Optional<Season> findByName(String name);

    List<Season> findByStatus(String status);

    Optional<Season> findByIsActiveTrue();

    List<Season> findAllByOrderByStartDateDesc();
}
