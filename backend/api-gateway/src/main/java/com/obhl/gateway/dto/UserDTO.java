package com.obhl.gateway.dto;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {
    private Long id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    @Deprecated
    private String role;
    private java.util.Set<String> roles;
    private Long teamId;
    private Boolean isActive;
    private String phoneNumber;
    private Boolean mustChangePassword;
    private java.time.Instant createdAt;
    private java.time.Instant updatedAt;
    private java.time.Instant lastLogin;

    // Note: passwordHash is intentionally NOT included for security
}
