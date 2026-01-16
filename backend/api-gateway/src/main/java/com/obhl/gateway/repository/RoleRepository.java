package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.Role;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {

    Optional<Role> findByName(String name);

    List<Role> findByIsSystemRole(Boolean isSystemRole);

    Boolean existsByName(String name);

    // Get role with user count
    @Query("SELECT r.id, r.name, r.description, r.isSystemRole, " +
            "COUNT(u.id) as userCount, r.createdAt, r.updatedAt " +
            "FROM Role r LEFT JOIN User u ON u.role = r.name " +
            "WHERE r.id = :roleId " +
            "GROUP BY r.id, r.name, r.description, r.isSystemRole, r.createdAt, r.updatedAt")
    Object[] findRoleWithUserCount(Long roleId);
}
