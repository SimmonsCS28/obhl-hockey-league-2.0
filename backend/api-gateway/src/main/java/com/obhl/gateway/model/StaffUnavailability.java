package com.obhl.gateway.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Generalized staff availability (referees now, scorekeepers later), mirroring
 * {@link GoalieUnavailability}. Goalies keep their own table; the availability
 * service dispatches by role.
 */
@Entity
@Table(name = "staff_unavailability")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StaffUnavailability {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "role", nullable = false, length = 20)
    private String role;

    @Column(name = "unavailable_date", nullable = false)
    private LocalDate unavailableDate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
