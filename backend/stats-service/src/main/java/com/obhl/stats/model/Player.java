package com.obhl.stats.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "players", uniqueConstraints = @UniqueConstraint(columnNames = { "email", "season_id" }))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "season_id")
    private Long seasonId;

    @Column(nullable = false)
    private String email;

    @Column(name = "is_veteran")
    private Boolean isVeteran = false;

    @Column(name = "first_name", nullable = false, length = 50)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 50)
    private String lastName;

    @Column(name = "jersey_number")
    private Integer jerseyNumber;

    @Column(nullable = false, length = 10)
    private String position;

    @Column(length = 5)
    private String shoots;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(length = 100)
    private String hometown;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "skill_rating", nullable = false)
    private Integer skillRating = 5;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Boolean getIsVeteran() {
        return isVeteran;
    }

    public void setIsVeteran(Boolean isVeteran) {
        this.isVeteran = isVeteran;
    }
}
