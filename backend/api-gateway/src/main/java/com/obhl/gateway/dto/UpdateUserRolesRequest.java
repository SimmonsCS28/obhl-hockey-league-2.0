package com.obhl.gateway.dto;

import java.util.List;

public class UpdateUserRolesRequest {
    private List<String> roles;

    public List<String> getRoles() {
        return roles;
    }

    public void setRoles(List<String> roles) {
        this.roles = roles;
    }
}
