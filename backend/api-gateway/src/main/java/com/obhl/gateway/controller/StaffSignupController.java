package com.obhl.gateway.controller;

import java.util.HashSet;
import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.CreateUserRequest;
import com.obhl.gateway.dto.UserDTO;
import com.obhl.gateway.service.UserManagementService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/users")
@RequiredArgsConstructor
public class StaffSignupController {

    private final UserManagementService userManagementService;

    @PostMapping("/signup")
    public ResponseEntity<UserDTO> signup(@Valid @RequestBody CreateUserRequest request) {
        // Handle roles: prefer 'roles' set, fallback to 'role' string
        if (request.getRoles() == null || request.getRoles().isEmpty()) {
            Set<String> roles = new HashSet<>();
            if (request.getRole() != null && !request.getRole().isBlank()) {
                roles.add(request.getRole().toUpperCase());
            }
            request.setRoles(roles);
        } else {
            // Ensure all roles are uppercase
            Set<String> upperRoles = new HashSet<>();
            for (String r : request.getRoles()) {
                upperRoles.add(r.toUpperCase());
            }
            request.setRoles(upperRoles);
        }

        UserDTO newUser = userManagementService.createUser(request);
        return ResponseEntity.ok(newUser);
    }
}
