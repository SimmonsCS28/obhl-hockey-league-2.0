package com.obhl.gateway.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.dto.GoalieCareerDto;
import com.obhl.gateway.dto.GoaliePerformanceDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.GoaliePerformanceService;

/**
 * Goalie performance for the people who manage goalies (coordinator, GMs, admins), plus
 * one self-service route so a goalie can see their own career. None of this is public:
 * the gateway requires a JWT for /api/v1/goalies/** and the class-level rule gates the rest.
 */
@RestController
@RequestMapping("/api/v1/goalies")
@PreAuthorize("hasAnyRole('ADMIN', 'GM', 'GOALIE_COORDINATOR')")
public class GoaliePerformanceController {

    @Autowired
    private GoaliePerformanceService goaliePerformanceService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/performance")
    public ResponseEntity<List<GoaliePerformanceDto>> getPerformance(@RequestParam Long seasonId) {
        return ResponseEntity.ok(goaliePerformanceService.getPerformance(seasonId));
    }

    /** The caller's own career — any signed-in account, so a goalie sees it on their dashboard. */
    @GetMapping("/me/career")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<GoalieCareerDto> getMyCareer(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated.");
        }
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated."));
        return ResponseEntity.ok(goaliePerformanceService.getCareer(user.getId()));
    }

    /** Any goalie's career, by user id (the same key games.goalie1Id/goalie2Id use). */
    @GetMapping("/{userId}/career")
    public ResponseEntity<GoalieCareerDto> getCareer(@PathVariable Long userId) {
        return ResponseEntity.ok(goaliePerformanceService.getCareer(userId));
    }
}
