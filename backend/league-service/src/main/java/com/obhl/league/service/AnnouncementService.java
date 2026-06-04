package com.obhl.league.service;

import com.obhl.league.dto.AnnouncementCreateDTO;
import com.obhl.league.dto.AnnouncementDTO;
import com.obhl.league.model.Announcement;
import com.obhl.league.repository.AnnouncementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private final AnnouncementRepository repository;

    public List<AnnouncementDTO> getAllAnnouncements(boolean activeOnly) {
        List<Announcement> announcements = activeOnly
                ? repository.findActiveWithinDateRange(LocalDate.now())
                : repository.findAllByOrderByCreatedAtDesc();
        return announcements.stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public AnnouncementDTO createAnnouncement(AnnouncementCreateDTO dto) {
        Announcement announcement = Announcement.builder()
                .title(dto.getTitle())
                .content(dto.getContent())
                .authorId(dto.getAuthorId())
                .authorName(dto.getAuthorName())
                .isActive(dto.getIsActive() != null ? dto.getIsActive() : true)
                .startDate(dto.getStartDate())
                .endDate(dto.getEndDate())
                .build();
        return mapToDTO(repository.save(announcement));
    }

    public AnnouncementDTO updateAnnouncement(Integer id, AnnouncementCreateDTO dto) {
        Announcement announcement = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Announcement not found"));

        announcement.setTitle(dto.getTitle());
        announcement.setContent(dto.getContent());
        if (dto.getIsActive() != null) {
            announcement.setIsActive(dto.getIsActive());
        }
        announcement.setStartDate(dto.getStartDate());
        announcement.setEndDate(dto.getEndDate());

        return mapToDTO(repository.save(announcement));
    }

    public AnnouncementDTO toggleActive(Integer id, boolean active) {
        Announcement announcement = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Announcement not found"));
        announcement.setIsActive(active);
        return mapToDTO(repository.save(announcement));
    }

    public void deleteAnnouncement(Integer id) {
        repository.deleteById(id);
    }

    private AnnouncementDTO mapToDTO(Announcement announcement) {
        return AnnouncementDTO.builder()
                .id(announcement.getId())
                .title(announcement.getTitle())
                .content(announcement.getContent())
                .authorId(announcement.getAuthorId())
                .authorName(announcement.getAuthorName())
                .isActive(announcement.getIsActive())
                .startDate(announcement.getStartDate())
                .endDate(announcement.getEndDate())
                .createdAt(announcement.getCreatedAt())
                .updatedAt(announcement.getUpdatedAt())
                .build();
    }
}
