package com.obhl.gateway.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByUsernameOrEmail(String username, String email);

    // Case-insensitive queries for login
    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    List<User> findByIsActive(Boolean isActive);

    List<User> findByRole(String role);

    // Proper JPA query for ManyToMany role relationship
    List<User> findByRoles_Name(String roleName);

    Long countByRole(String role);

    Boolean existsByUsername(String username);

    Boolean existsByEmail(String email);
}
