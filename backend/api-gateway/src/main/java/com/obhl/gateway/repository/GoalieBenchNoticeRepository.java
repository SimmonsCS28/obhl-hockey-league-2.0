package com.obhl.gateway.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.GoalieBenchNotice;

@Repository
public interface GoalieBenchNoticeRepository extends JpaRepository<GoalieBenchNotice, Long> {

    Optional<GoalieBenchNotice> findBySeasonIdAndWeek(Long seasonId, Integer week);
}
