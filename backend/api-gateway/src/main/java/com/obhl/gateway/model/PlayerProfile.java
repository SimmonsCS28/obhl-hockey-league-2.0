package com.obhl.gateway.model;

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
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The person-level player profile — the part of a player that survives the draft.
 *
 * players (in stats-service) is one row per person PER SEASON, rebuilt every draft
 * with only name/email/position/skill carried over. This row is keyed by lowercased
 * email, the one identity every season row shares, so the same photo and details
 * show up under whichever team and number the person has this year. See migration
 * 063 for why it is not keyed by user_id.
 *
 * The photo itself is not here — only its storage key under app.media.root/players/,
 * exactly like Highlight.storageKey.
 */
@Entity
@Table(name = "player_profiles", uniqueConstraints = @UniqueConstraint(columnNames = "email_lower"))
@Data
@NoArgsConstructor
public class PlayerProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** lower(trim(players.email)). Set once at creation; never the user's display email. */
    @Column(name = "email_lower", nullable = false, length = 255)
    private String emailLower;

    /**
     * Resolved users.id when the person has an account. Plain Long rather than a
     * relationship: most profiles are backfilled for people who never signed up.
     */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "hometown", length = 100)
    private String hometown;

    @Column(name = "height_inches")
    private Integer heightInches;

    @Column(name = "weight_lbs")
    private Integer weightLbs;

    /** "L" or "R"; null when unset (goalies mostly leave it blank). */
    @Column(name = "shoots", length = 1)
    private String shoots;

    @Column(name = "photo_key", length = 255)
    private String photoKey;

    /** Opt-in: show the photo (when there is one) in place of initials on the dashboard avatar. */
    @Column(name = "use_photo_avatar", nullable = false)
    private Boolean usePhotoAvatar = false;

    @Column(name = "photo_content_type", length = 100)
    private String photoContentType;

    @Column(name = "photo_size_bytes")
    private Long photoSizeBytes;

    @Column(name = "photo_updated_at")
    private LocalDateTime photoUpdatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public PlayerProfile(String emailLower) {
        this.emailLower = emailLower;
    }

    public boolean hasPhoto() {
        return photoKey != null && !photoKey.isBlank();
    }

    public boolean showsPhotoAsAvatar() {
        return hasPhoto() && Boolean.TRUE.equals(usePhotoAvatar);
    }

    /** True when at least one of the five profile fields is filled in. */
    public boolean hasAnyDetail() {
        return birthDate != null || (hometown != null && !hometown.isBlank())
                || heightInches != null || weightLbs != null || shoots != null;
    }
}
