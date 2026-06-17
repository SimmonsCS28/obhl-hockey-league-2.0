package com.obhl.gateway.service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.GoalieUnavailabilityDTO;
import com.obhl.gateway.model.StaffUnavailability;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.StaffUnavailabilityRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Availability for staff roles. Goalies keep their dedicated
 * {@code goalie_unavailability} table (handled by {@link GoalieShiftService});
 * all other roles (REF now, SCOREKEEPER later) use {@code staff_unavailability}.
 * This service dispatches by role so callers don't care which table backs it.
 */
@Service
public class StaffAvailabilityService {

    @Autowired
    private GoalieShiftService goalieShiftService;

    @Autowired
    private StaffUnavailabilityRepository staffUnavailabilityRepository;

    @Autowired
    private UserRepository userRepository;

    /** All unavailability for a role, as {userId, date} pairs (for the coordinator board). */
    public List<GoalieUnavailabilityDTO> getAllUnavailability(String role) {
        if ("GOALIE".equals(role)) {
            return goalieShiftService.getAllUnavailability();
        }
        return staffUnavailabilityRepository.findByRole(role).stream()
                .map(u -> new GoalieUnavailabilityDTO(u.getUser().getId(), u.getUnavailableDate()))
                .collect(Collectors.toList());
    }

    /** A single user's unavailable dates for a role. */
    public List<LocalDate> getMyUnavailability(Long userId, String role) {
        if ("GOALIE".equals(role)) {
            return goalieShiftService.getMyUnavailability(userId);
        }
        return staffUnavailabilityRepository.findByUserIdAndRole(userId, role).stream()
                .map(StaffUnavailability::getUnavailableDate)
                .collect(Collectors.toList());
    }

    @Transactional
    public void markUnavailable(Long userId, String role, List<LocalDate> dates) {
        if ("GOALIE".equals(role)) {
            com.obhl.gateway.dto.GoalieAvailabilityRequest req = new com.obhl.gateway.dto.GoalieAvailabilityRequest();
            req.setDates(dates);
            goalieShiftService.markUnavailable(userId, req);
            return;
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        for (LocalDate date : dates) {
            if (staffUnavailabilityRepository.findByUserIdAndRoleAndUnavailableDate(userId, role, date).isEmpty()) {
                StaffUnavailability su = new StaffUnavailability();
                su.setUser(user);
                su.setRole(role);
                su.setUnavailableDate(date);
                staffUnavailabilityRepository.save(su);
            }
        }
    }

    @Transactional
    public void removeUnavailable(Long userId, String role, LocalDate date) {
        if ("GOALIE".equals(role)) {
            goalieShiftService.removeUnavailableDate(userId, date);
            return;
        }
        staffUnavailabilityRepository.findByUserIdAndRoleAndUnavailableDate(userId, role, date)
                .ifPresent(staffUnavailabilityRepository::delete);
    }
}
