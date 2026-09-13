package com.obhl.stats.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.stats.model.Player;

@Repository
public interface PlayerRepository extends JpaRepository<Player, Long> {

    List<Player> findByTeamId(Long teamId);

    List<Player> findByIsActiveTrue();

    List<Player> findByPosition(String position);

    Optional<Player> findByFirstNameAndLastName(String firstName, String lastName);

    List<Player> findByTeamIdAndIsActiveTrue(Long teamId);

    List<Player> findByTeamIdIsNull();

    List<Player> findBySeasonId(Long seasonId);

    List<Player> findBySeasonIdInAndIsActiveTrue(List<Long> seasonIds);

    List<Player> findBySeasonIdAndTeamId(Long seasonId, Long teamId);

    List<Player> findBySeasonIdAndTeamIdAndIsActiveTrue(Long seasonId, Long teamId);

    List<Player> findBySeasonIdAndTeamIdIsNull(Long seasonId);

    List<Player> findBySeasonIdAndTeamIdIsNullAndIsActiveTrue(Long seasonId);

    /**
     * Returns at most one row and THROWS for any email that appears in more than one
     * season -- i.e. every returning player. Kept for /exists and /by-email, which
     * predate the per-season model; new code wants findByEmailIgnoreCaseOrderBySeasonIdDesc.
     */
    Optional<Player> findByEmail(String email);

    /**
     * Every season row for one person, newest season first. Case-insensitive because
     * players.email is not normalized (unlike users.email since migration 044) and the
     * same person can be "Bob@x.com" one season and "bob@x.com" the next.
     */
    List<Player> findByEmailIgnoreCaseOrderBySeasonIdDesc(String email);

    Optional<Player> findByEmailAndSeasonId(String email, Long seasonId);
}
