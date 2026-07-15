package com.obhl.gateway.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.ChickenLicksOrderItem;

@Repository
public interface ChickenLicksOrderItemRepository extends JpaRepository<ChickenLicksOrderItem, Long> {

    List<ChickenLicksOrderItem> findByOrderId(Long orderId);

    List<ChickenLicksOrderItem> findByOrderIdIn(List<Long> orderIds);

    void deleteByOrderId(Long orderId);
}
