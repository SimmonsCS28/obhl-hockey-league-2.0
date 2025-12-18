package com.obhl.league.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.league.model.DraftSave;

@Repository
public interface DraftSaveRepository extends JpaRepository<DraftSave, Long> {

    /**
     * Find the most recent draft save
     */
    Optional<DraftSave> findTopByOrderByCreatedAtDesc();

    /**
     * Find all drafts with a specific status
     */
    List<DraftSave> findByStatusOrderByCreatedAtDesc(String status);

    /**
     * Find the most recent draft with a specific status
     */
    Optional<DraftSave> findTopByStatusOrderByCreatedAtDesc(String status);
}
