package com.obhl.gateway.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Metadata-only edit. Replacing the video or poster means deleting the highlight
 * and uploading again — keeps the storage lifecycle simple and means there is
 * never an orphaned file from a half-finished swap.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HighlightUpdateDTO {
    private String title;
    private String description;
    private Long seasonId;
    private Integer week;
    private String youtubeUrl;
    private Boolean isActive;
}
