package com.obhl.game.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.obhl.game.model.PenaltyTracking;

@Repository
public interface PenaltyTrackingRepository extends JpaRepository<PenaltyTracking, Long> {

    Optional<PenaltyTracking> findByPlayerIdAndGameId(Long playerId, Long gameId);

    @Query("SELECT pt FROM PenaltyTracking pt WHERE pt.playerId = :playerId " +
            "ORDER BY pt.createdAt DESC")
    List<PenaltyTracking> findByPlayerIdOrderByCreatedAtDesc(@Param("playerId") Long playerId);

    @Query("SELECT pt FROM PenaltyTracking pt WHERE pt.playerId = :playerId " +
            "AND pt.gameId IN :gameIds ORDER BY pt.createdAt DESC")
    List<PenaltyTracking> findByPlayerIdAndGameIdIn(@Param("playerId") Long playerId,
            @Param("gameIds") List<Long> gameIds);
}
