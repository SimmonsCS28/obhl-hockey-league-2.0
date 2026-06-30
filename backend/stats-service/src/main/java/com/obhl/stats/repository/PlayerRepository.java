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

    List<Player> findBySeasonIdAndTeamId(Long seasonId, Long teamId);

    List<Player> findBySeasonIdAndTeamIdAndIsActiveTrue(Long seasonId, Long teamId);

    List<Player> findBySeasonIdAndTeamIdIsNull(Long seasonId);

    List<Player> findBySeasonIdAndTeamIdIsNullAndIsActiveTrue(Long seasonId);

    Optional<Player> findByEmail(String email);

    Optional<Player> findByEmailAndSeasonId(String email, Long seasonId);
}
