package com.obhl.league.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.league.model.TournamentRulesSection;

@Repository
public interface TournamentRulesSectionRepository extends JpaRepository<TournamentRulesSection, Long> {

    List<TournamentRulesSection> findByTournamentIdOrderBySortOrderAsc(Long tournamentId);

    void deleteByTournamentId(Long tournamentId);
}
