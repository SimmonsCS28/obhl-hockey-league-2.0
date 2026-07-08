package com.obhl.gateway.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.RulesSection;

@Repository
public interface RulesSectionRepository extends JpaRepository<RulesSection, Long> {

    List<RulesSection> findAllByOrderBySortOrderAscIdAsc();
}
