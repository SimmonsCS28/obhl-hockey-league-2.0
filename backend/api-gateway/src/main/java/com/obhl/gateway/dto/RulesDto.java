package com.obhl.gateway.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTOs for the sectioned League Rules (v4 §5c).
 */
public class RulesDto {

    /** One section as sent to/from the client. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Section {
        private Long id;
        private String group;    // gen | game | mou
        private String title;
        private String content;  // rich-text HTML
        private Integer order;
    }

    /** Full rules payload: ordered sections + publish metadata. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RulesResponse {
        private List<Section> sections;
        private String publishedAt;
        private String publishedBy;
    }

    /** Save request: the full ordered section list (replaces the current set). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SaveRequest {
        private List<Section> sections;
    }
}
