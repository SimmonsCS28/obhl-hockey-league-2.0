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

    /**
     * Resolve a read-only share link. Matched on the SHA-256 hex of the presented token against
     * the unique partial index from migration 060, so this is an index hit rather than a scan --
     * it is called on every poll by every watching GM.
     */
    Optional<DraftSave> findByShareTokenHash(String shareTokenHash);
}
