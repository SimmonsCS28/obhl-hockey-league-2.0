package com.obhl.gateway.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A weekly video highlight shown on the public home page.
 *
 * The mp4 and its poster image are NOT stored here — only their storage keys,
 * which are server-generated UUID filenames under {@code app.media.root}. The
 * client's own filename is kept for display only and is never used as a path.
 * See HighlightStorageService for the disk side of this.
 */
@Entity
@Table(name = "highlights")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Highlight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "season_id")
    private Long seasonId;

    @Column(name = "week")
    private Integer week;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column(name = "original_filename")
    private String originalFilename;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "poster_key")
    private String posterKey;

    @Column(name = "poster_content_type", length = 100)
    private String posterContentType;

    @Column(name = "poster_size_bytes")
    private Long posterSizeBytes;

    @Column(name = "youtube_url", length = 500)
    private String youtubeUrl;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_by_name")
    private String createdByName;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
