package com.obhl.gateway.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateUserRequest {

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "First Name is required")
    private String firstName;

    @NotBlank(message = "Last Name is required")
    private String lastName;

    @Deprecated
    private String role; // DEPRECATED: Use roles set instead

    @jakarta.validation.constraints.NotEmpty(message = "At least one role is required")
    private java.util.Set<String> roles;

    @NotBlank(message = "Password is required")
    private String password;

    private Long teamId; // Optional, for GM role

    @NotBlank(message = "Security Question is required")
    private String securityQuestion;

    @NotBlank(message = "Security Answer is required")
    private String securityAnswer;
}
