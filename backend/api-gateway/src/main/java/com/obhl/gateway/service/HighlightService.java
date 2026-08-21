package com.obhl.gateway.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.dto.HighlightDTO;
import com.obhl.gateway.dto.HighlightUpdateDTO;
import com.obhl.gateway.model.Highlight;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.HighlightRepository;
import com.obhl.gateway.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class HighlightService {

    private final HighlightRepository highlightRepository;
    private final HighlightStorageService storageService;
    private final UserRepository userRepository;

    @Value("${api.v1.prefix}")
    private String apiPrefix;

    public Optional<HighlightDTO> getCurrent() {
        return highlightRepository.findFirstByIsActiveTrueOrderByCreatedAtDesc().map(this::toDto);
    }

    public List<HighlightDTO> getHighlights(boolean activeOnly) {
        List<Highlight> rows = activeOnly
                ? highlightRepository.findAllByIsActiveTrueOrderByCreatedAtDesc()
                : highlightRepository.findAllByOrderByCreatedAtDesc();
        return rows.stream().map(this::toDto).toList();
    }

    @Transactional
    public HighlightDTO create(MultipartFile video, MultipartFile poster, HighlightUpdateDTO meta, String username) {
        if (meta.getTitle() == null || meta.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A title is required.");
        }

        // Store the video first: if it fails there is nothing to clean up. If the
        // poster then fails, roll the video back by hand — the @Transactional here
        // only covers the database, not the filesystem.
        String videoKey = storageService.storeVideo(video);
        String posterKey;
        try {
            posterKey = storageService.storePoster(poster);
        } catch (RuntimeException e) {
            storageService.delete(videoKey);
            throw e;
        }

        Highlight highlight = new Highlight();
        highlight.setStorageKey(videoKey);
        highlight.setOriginalFilename(video.getOriginalFilename());
        highlight.setContentType(video.getContentType());
        highlight.setFileSizeBytes(video.getSize());
        highlight.setPosterKey(posterKey);
        if (posterKey != null) {
            highlight.setPosterContentType(poster.getContentType());
            highlight.setPosterSizeBytes(poster.getSize());
        }
        applyMetadata(highlight, meta);
        highlight.setIsActive(meta.getIsActive() == null ? Boolean.TRUE : meta.getIsActive());

        userRepository.findByUsername(username).ifPresent(user -> {
            highlight.setCreatedBy(user.getId());
            highlight.setCreatedByName(displayName(user));
        });

        return toDto(highlightRepository.save(highlight));
    }

    @Transactional
    public HighlightDTO update(Long id, HighlightUpdateDTO meta) {
        Highlight highlight = find(id);
        if (meta.getTitle() != null && meta.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A title is required.");
        }
        applyMetadata(highlight, meta);
        if (meta.getIsActive() != null) {
            highlight.setIsActive(meta.getIsActive());
        }
        return toDto(highlightRepository.save(highlight));
    }

    @Transactional
    public HighlightDTO toggleActive(Long id, boolean active) {
        Highlight highlight = find(id);
        highlight.setIsActive(active);
        return toDto(highlightRepository.save(highlight));
    }

    /**
     * Deletes the row AND both files. Order matters: drop the row first so a failed
     * file delete can't leave a row pointing at bytes that are already gone.
     */
    @Transactional
    public void delete(Long id) {
        Highlight highlight = find(id);
        String videoKey = highlight.getStorageKey();
        String posterKey = highlight.getPosterKey();
        highlightRepository.delete(highlight);
        storageService.delete(videoKey);
        storageService.delete(posterKey);
    }

    private Highlight find(Long id) {
        return highlightRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Highlight not found."));
    }

    private void applyMetadata(Highlight highlight, HighlightUpdateDTO meta) {
        if (meta.getTitle() != null) {
            highlight.setTitle(meta.getTitle().trim());
        }
        highlight.setDescription(blankToNull(meta.getDescription()));
        highlight.setYoutubeUrl(blankToNull(meta.getYoutubeUrl()));
        highlight.setSeasonId(meta.getSeasonId());
        highlight.setWeek(meta.getWeek());
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private static String displayName(User user) {
        String first = user.getFirstName() == null ? "" : user.getFirstName();
        String last = user.getLastName() == null ? "" : user.getLastName();
        String full = (first + " " + last).trim();
        return full.isBlank() ? user.getUsername() : full;
    }

    private HighlightDTO toDto(Highlight h) {
        return HighlightDTO.builder()
                .id(h.getId())
                .title(h.getTitle())
                .description(h.getDescription())
                .seasonId(h.getSeasonId())
                .week(h.getWeek())
                .videoUrl(mediaUrl(h.getStorageKey()))
                .posterUrl(mediaUrl(h.getPosterKey()))
                .originalFilename(h.getOriginalFilename())
                .fileSizeBytes(h.getFileSizeBytes())
                .youtubeUrl(h.getYoutubeUrl())
                .isActive(h.getIsActive())
                .createdByName(h.getCreatedByName())
                .createdAt(h.getCreatedAt())
                .updatedAt(h.getUpdatedAt())
                .build();
    }

    private String mediaUrl(String storageKey) {
        return storageKey == null ? null : apiPrefix + "/highlights/media/" + storageKey;
    }
}
