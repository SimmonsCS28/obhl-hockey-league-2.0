package com.obhl.league.controller;

import com.obhl.league.dto.AnnouncementCreateDTO;
import com.obhl.league.dto.AnnouncementDTO;
import com.obhl.league.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("${api.v1.prefix}/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;

    @GetMapping
    public ResponseEntity<List<AnnouncementDTO>> getAnnouncements(
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(announcementService.getAllAnnouncements(activeOnly));
    }

    @PostMapping
    public ResponseEntity<AnnouncementDTO> createAnnouncement(@RequestBody AnnouncementCreateDTO dto) {
        return ResponseEntity.ok(announcementService.createAnnouncement(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AnnouncementDTO> updateAnnouncement(
            @PathVariable Integer id,
            @RequestBody AnnouncementCreateDTO dto) {
        return ResponseEntity.ok(announcementService.updateAnnouncement(id, dto));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<AnnouncementDTO> toggleActive(
            @PathVariable Integer id,
            @RequestParam boolean active) {
        return ResponseEntity.ok(announcementService.toggleActive(id, active));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable Integer id) {
        announcementService.deleteAnnouncement(id);
        return ResponseEntity.noContent().build();
    }
}
