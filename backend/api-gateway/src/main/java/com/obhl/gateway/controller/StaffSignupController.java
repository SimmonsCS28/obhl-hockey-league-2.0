package com.obhl.gateway.controller;

import java.util.HashSet;
import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.CreateUserRequest;
import com.obhl.gateway.dto.StaffSignupRequest;
import com.obhl.gateway.dto.UserDTO;
import com.obhl.gateway.service.UserManagementService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("${api.v1.prefix}/staff")
@RequiredArgsConstructor
public class StaffSignupController {

    private final UserManagementService userManagementService;

    @PostMapping("/referee/signup")
    public ResponseEntity<UserDTO> refereeSignup(@Valid @RequestBody StaffSignupRequest request) {
        CreateUserRequest createUserRequest = new CreateUserRequest();
        createUserRequest.setUsername(request.getUsername());
        createUserRequest.setEmail(request.getEmail());
        createUserRequest.setPassword(request.getPassword());

        Set<String> roles = new HashSet<>();
        roles.add("REFEREE");
        createUserRequest.setRoles(roles);

        // Backward compatibility
        createUserRequest.setRole("REFEREE");

        UserDTO newUser = userManagementService.createUser(createUserRequest);
        return ResponseEntity.ok(newUser);
    }

    @PostMapping("/scorekeeper/signup")
    public ResponseEntity<UserDTO> scorekeeperSignup(@Valid @RequestBody StaffSignupRequest request) {
        CreateUserRequest createUserRequest = new CreateUserRequest();
        createUserRequest.setUsername(request.getUsername());
        createUserRequest.setEmail(request.getEmail());
        createUserRequest.setPassword(request.getPassword());

        Set<String> roles = new HashSet<>();
        roles.add("SCOREKEEPER");
        createUserRequest.setRoles(roles);

        // Backward compatibility
        createUserRequest.setRole("SCOREKEEPER");

        UserDTO newUser = userManagementService.createUser(createUserRequest);
        return ResponseEntity.ok(newUser);
    }
}
