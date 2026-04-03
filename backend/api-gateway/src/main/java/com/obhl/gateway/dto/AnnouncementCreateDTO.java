package com.obhl.gateway.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnnouncementCreateDTO {
    private String title;
    private String content;
    private Integer authorId;
    private String authorName;
    private Boolean isActive;
}
