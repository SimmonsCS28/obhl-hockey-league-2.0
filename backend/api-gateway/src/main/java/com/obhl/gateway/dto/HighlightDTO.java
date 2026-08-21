package com.obhl.gateway.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Public/admin view of a highlight. videoUrl and posterUrl are built server-side
 * from the storage keys so the frontend never has to know the media path layout.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HighlightDTO {
    private Long id;
    private String title;
    private String description;
    private Long seasonId;
    private Integer week;
    private String videoUrl;
    private String posterUrl;
    private String originalFilename;
    private Long fileSizeBytes;
    private String youtubeUrl;
    private Boolean isActive;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
