package com.obhl.gateway.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CreateUserRequest {

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Pattern(regexp = "^(?=.*[A-Z])(?=.*[!@#$%^&*()\\-_=+\\[\\]{}|;:',.<>?/~`])(?=\\S+$).{8,}$", message = "Password must be at least 8 characters, contain 1 uppercase letter, 1 special character, and no spaces")
    private String password;

    @NotBlank(message = "Role is required")
    private String role;

    private Long teamId; // Optional, for GM role
}
