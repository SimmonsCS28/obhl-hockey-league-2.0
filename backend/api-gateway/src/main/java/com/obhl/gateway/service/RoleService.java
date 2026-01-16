package com.obhl.gateway.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.CreateRoleRequest;
import com.obhl.gateway.dto.RoleDTO;
import com.obhl.gateway.dto.UpdateRoleRequest;
import com.obhl.gateway.model.Role;
import com.obhl.gateway.repository.RoleRepository;
import com.obhl.gateway.repository.UserRepository;

@Service
public class RoleService {

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Get all roles with user counts
     */
    public List<RoleDTO> getAllRoles() {
        List<Role> roles = roleRepository.findAll();
        return roles.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get role by ID with user count
     */
    public RoleDTO getRoleById(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Role not found with id: " + id));
        return convertToDTO(role);
    }

    /**
     * Create new role
     */
    @Transactional
    public RoleDTO createRole(CreateRoleRequest request) {
        // Check if role name already exists
        if (roleRepository.existsByName(request.getName())) {
            throw new RuntimeException("Role already exists: " + request.getName());
        }

        Role role = new Role();
        role.setName(request.getName());
        role.setDescription(request.getDescription());
        role.setIsSystemRole(false); // New roles are never system roles

        Role savedRole = roleRepository.save(role);
        return convertToDTO(savedRole);
    }

    /**
     * Update role
     */
    @Transactional
    public RoleDTO updateRole(Long id, UpdateRoleRequest request) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Role not found with id: " + id));

        // Prevent changing system role names (they may be hardcoded in code)
        if (role.getIsSystemRole() && request.getName() != null && !role.getName().equals(request.getName())) {
            throw new RuntimeException(
                    "Cannot rename system role '" + role.getName() + "'. " +
                            "System roles may be referenced in code and changing them could break functionality.");
        }

        // Update name if provided and not a system role
        if (request.getName() != null && !request.getName().isBlank()) {
            // Check if new name conflicts with another role
            roleRepository.findByName(request.getName())
                    .ifPresent(existingRole -> {
                        if (!existingRole.getId().equals(id)) {
                            throw new RuntimeException("Role name already exists: " + request.getName());
                        }
                    });
            role.setName(request.getName());
        }

        // Update description
        if (request.getDescription() != null) {
            role.setDescription(request.getDescription());
        }

        Role updatedRole = roleRepository.save(role);
        return convertToDTO(updatedRole);
    }

    /**
     * Delete role (soft delete by preventing if users exist)
     */
    @Transactional
    public void deleteRole(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Role not found with id: " + id));

        // Prevent deletion of system roles
        if (role.getIsSystemRole()) {
            throw new RuntimeException("Cannot delete system role: " + role.getName());
        }

        // Check if any users have this role
        Long userCount = userRepository.countByRole(role.getName());
        if (userCount > 0) {
            throw new RuntimeException(
                    "Cannot delete role '" + role.getName() + "'. " +
                            userCount + " user(s) currently have this role.");
        }

        roleRepository.delete(role);
    }

    /**
     * Get users with a specific role
     */
    public List<String> getUsernamesByRoleId(Long roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new RuntimeException("Role not found with id: " + roleId));

        return userRepository.findByRole(role.getName())
                .stream()
                .map(user -> user.getUsername())
                .collect(Collectors.toList());
    }

    /**
     * Convert Role entity to RoleDTO with user count
     */
    private RoleDTO convertToDTO(Role role) {
        RoleDTO dto = new RoleDTO();
        dto.setId(role.getId());
        dto.setName(role.getName());
        dto.setDescription(role.getDescription());
        dto.setIsSystemRole(role.getIsSystemRole());
        dto.setCreatedAt(role.getCreatedAt());
        dto.setUpdatedAt(role.getUpdatedAt());

        // Get user count for this role
        Long userCount = userRepository.countByRole(role.getName());
        dto.setUserCount(userCount.intValue());

        return dto;
    }
}
