package com.obhl.gateway.repository;

import com.obhl.gateway.model.LeagueRules;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LeagueRulesRepository extends JpaRepository<LeagueRules, Integer> {
    Optional<LeagueRules> findFirstByOrderByIdAsc();
}
