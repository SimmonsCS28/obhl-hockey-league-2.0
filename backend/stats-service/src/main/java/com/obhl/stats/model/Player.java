package com.obhl.stats.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonView;
import jakarta.persistence.Transient;

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

    /**
     * Fields not annotated with @JsonView are always serialized, in every view.
     * {@link Privileged} is only activated (via MappingJacksonValue) for callers that
     * PlayerAccess#isPrivileged approves — everyone else gets {@link Public}, which
     * silently drops these fields from the JSON entirely (not just nulled).
     */
    public static class Views {
        public static class Public {}
        public static class Privileged {}
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "season_id")
    private Long seasonId;

    @Column(nullable = false)
    @JsonView(Views.Privileged.class)
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
    @JsonView(Views.Privileged.class)
    private LocalDate birthDate;

    @Column(length = 100)
    private String hometown;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "skill_rating")
    @JsonView(Views.Privileged.class)
    private Integer skillRating = 5;

    public static final int TWO_GOAL_LIMIT_THRESHOLD = 9;

    /**
     * Whether this player is subject to the 2-goal-limit rule. Deliberately has no
     * @JsonView so it serializes in every view (see Views javadoc above) — the raw
     * skillRating number is staff-only, but the rule it enforces is public information
     * everyone at the rink needs to see.
     */
    @Transient
    @JsonProperty("twoGoalLimit")
    public boolean isTwoGoalLimit() {
        return skillRating != null && skillRating >= TWO_GOAL_LIMIT_THRESHOLD;
    }

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
