package com.obhl.league.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.ColumnTransformer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "draft_saves")
public class DraftSave {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "season_name", nullable = false)
    private String seasonName;

    @Column(name = "status", nullable = false, length = 20)
    private String status; // 'saved' or 'complete'

    @Column(name = "draft_data", nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String draftData; // JSON string containing all draft state

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Read-only share link for GMs following along. Only the SHA-256 hex of the token is held;
    // the raw value is shown to the operator once and is not recoverable. NULL = sharing off,
    // so revoking a link is just nulling this. See migration 060.
    @Column(name = "share_token_hash", length = 64)
    private String shareTokenHash;

    @Column(name = "share_created_at")
    private LocalDateTime shareCreatedAt;

    // Constructors
    public DraftSave() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public DraftSave(String seasonName, String status, String draftData) {
        this();
        this.seasonName = seasonName;
        this.status = status;
        this.draftData = draftData;
    }

    // Lifecycle callbacks
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSeasonName() {
        return seasonName;
    }

    public void setSeasonName(String seasonName) {
        this.seasonName = seasonName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDraftData() {
        return draftData;
    }

    public void setDraftData(String draftData) {
        this.draftData = draftData;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getShareTokenHash() {
        return shareTokenHash;
    }

    public void setShareTokenHash(String shareTokenHash) {
        this.shareTokenHash = shareTokenHash;
    }

    public LocalDateTime getShareCreatedAt() {
        return shareCreatedAt;
    }

    public void setShareCreatedAt(LocalDateTime shareCreatedAt) {
        this.shareCreatedAt = shareCreatedAt;
    }
}
