package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.Team;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    Optional<Team> findByName(String name);

    List<Team> findByActiveTrue();

    Optional<Team> findByIdAndActiveTrue(Long id);
}
