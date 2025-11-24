package com.obhl.stats.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "players")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_id")
    private Long teamId;

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

    @Column(name = "height_inches")
    private Integer heightInches;

    @Column(name = "weight_lbs")
    private Integer weightLbs;

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
}
