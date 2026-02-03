package com.obhl.gateway.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UpdateUserRequest {

    private String username;

    @Email(message = "Invalid email format")
    private String email;

    @Pattern(regexp = "^(?=.*[A-Z])(?=.*[!@#$%^&*()\\-_=+\\[\\]{}|;:',.<>?/~`])(?=\\S+$).{8,}$", message = "Password must be at least 8 characters, contain 1 uppercase letter, 1 special character, and no spaces")
    private String newPassword; // Optional - only if changing password

    @Deprecated
    private String role; // DEPRECATED: Use roles set instead

    private java.util.Set<String> roles;

    private Long teamId;

    // All fields are optional - only provided fields will be updated
}
