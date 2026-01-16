package com.obhl.gateway.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CreateRoleRequest {

    @NotBlank(message = "Role name is required")
    @Pattern(regexp = "^[A-Z_]+$", message = "Role name must be uppercase letters and underscores only")
    private String name;

    private String description;
}
