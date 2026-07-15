package com.obhl.gateway.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.GoaliePerformanceDto;
import com.obhl.gateway.service.GoaliePerformanceService;

@RestController
@RequestMapping("/api/v1/goalies")
@PreAuthorize("hasAnyRole('ADMIN', 'GM', 'GOALIE_COORDINATOR')")
public class GoaliePerformanceController {

    @Autowired
    private GoaliePerformanceService goaliePerformanceService;

    @GetMapping("/performance")
    public ResponseEntity<List<GoaliePerformanceDto>> getPerformance(@RequestParam Long seasonId) {
        return ResponseEntity.ok(goaliePerformanceService.getPerformance(seasonId));
    }
}
