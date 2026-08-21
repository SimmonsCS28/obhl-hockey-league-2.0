package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.Highlight;

@Repository
public interface HighlightRepository extends JpaRepository<Highlight, Long> {

    /** What the public home page shows: the most recently posted active highlight. */
    Optional<Highlight> findFirstByIsActiveTrueOrderByCreatedAtDesc();

    /** Admin console list — newest first, including deactivated ones. */
    List<Highlight> findAllByOrderByCreatedAtDesc();

    /** Public archive listing. */
    List<Highlight> findAllByIsActiveTrueOrderByCreatedAtDesc();
}
