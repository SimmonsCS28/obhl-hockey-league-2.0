package com.obhl.gateway.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.ChickenLicksOrder;

@Repository
public interface ChickenLicksOrderRepository extends JpaRepository<ChickenLicksOrder, Long> {

    Optional<ChickenLicksOrder> findByInitiatorEmailAndOrderTypeAndStatus(String initiatorEmail, String orderType, String status);

    Optional<ChickenLicksOrder> findByTeamIdAndOrderTypeAndStatus(Long teamId, String orderType, String status);

    // Latest team order regardless of status — a closed one stays the "current" one on
    // screen (persistent call screen) until the initiator starts a new one.
    Optional<ChickenLicksOrder> findTopByTeamIdAndOrderTypeOrderByIdDesc(Long teamId, String orderType);

    // Personal history is private to its owner; team history is visible to anyone on that team
    // (teamId is snapshotted on personal orders too, for Standings totals, but must NOT leak a
    // teammate's personal order into everyone else's history).
    @Query("SELECT o FROM ChickenLicksOrder o WHERE o.seasonId = :seasonId "
            + "AND o.status IN ('PLACED', 'CLOSED') "
            + "AND ((o.orderType = 'PERSONAL' AND o.initiatorEmail = :email) "
            + "  OR (o.orderType = 'TEAM' AND o.teamId IS NOT NULL AND o.teamId = :teamId)) "
            + "ORDER BY o.closedAt DESC, o.updatedAt DESC")
    List<ChickenLicksOrder> findHistory(@Param("seasonId") Long seasonId, @Param("email") String email, @Param("teamId") Long teamId);

    /**
     * Season-to-date Chicken Licks total per team, counting only "finalized"
     * orders: PERSONAL orders that were PLACED, and TEAM orders that were
     * CLOSED. OPEN/CANCELLED orders of either type never count, and orders
     * with no team_id (non-rostered users' personal orders) never count
     * toward any team.
     */
    @Query(value = "SELECT o.team_id AS teamId, o.team_name AS teamName, "
            + "COALESCE(SUM(i.unit_price * i.qty), 0) AS total "
            + "FROM chicken_licks_orders o "
            + "JOIN chicken_licks_order_items i ON i.order_id = o.id "
            + "WHERE o.season_id = :seasonId AND o.team_id IS NOT NULL "
            + "AND ((o.order_type = 'PERSONAL' AND o.status = 'PLACED') "
            + "  OR (o.order_type = 'TEAM' AND o.status = 'CLOSED')) "
            + "GROUP BY o.team_id, o.team_name "
            + "ORDER BY total DESC", nativeQuery = true)
    List<TeamOrderTotal> findTeamTotals(@Param("seasonId") Long seasonId);

    /**
     * One person's season-to-date total across their own personal orders and
     * their own attributed lines within team orders, same "finalized" rule.
     */
    @Query(value = "SELECT COALESCE(SUM(i.unit_price * i.qty), 0) "
            + "FROM chicken_licks_order_items i "
            + "JOIN chicken_licks_orders o ON o.id = i.order_id "
            + "WHERE i.person_email = :email AND o.season_id = :seasonId "
            + "AND ((o.order_type = 'PERSONAL' AND o.status = 'PLACED') "
            + "  OR (o.order_type = 'TEAM' AND o.status = 'CLOSED'))", nativeQuery = true)
    BigDecimal findMyTotal(@Param("email") String email, @Param("seasonId") Long seasonId);

    interface TeamOrderTotal {
        Long getTeamId();
        String getTeamName();
        BigDecimal getTotal();
    }
}
