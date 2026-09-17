package com.obhl.gateway.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.StaffPayLineGame;

@Repository
public interface StaffPayLineGameRepository extends JpaRepository<StaffPayLineGame, Long> {
    List<StaffPayLineGame> findByLineIdOrderByGameDateAsc(Long lineId);
    List<StaffPayLineGame> findByLineIdInOrderByGameDateAsc(List<Long> lineIds);
    void deleteByLineId(Long lineId);
}
