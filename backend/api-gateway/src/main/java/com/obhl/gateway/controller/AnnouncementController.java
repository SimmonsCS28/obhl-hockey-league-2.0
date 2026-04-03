package com.obhl.gateway.controller;

import com.obhl.gateway.dto.AnnouncementCreateDTO;
import com.obhl.gateway.dto.AnnouncementDTO;
import com.obhl.gateway.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("${api.v1.prefix}/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;

    // Publicly accessible for viewing announcements
    @GetMapping
    public ResponseEntity<List<AnnouncementDTO>> getAnnouncements(
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(announcementService.getAnnouncements(activeOnly));
    }

    // Admins only
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<AnnouncementDTO> createAnnouncement(@RequestBody AnnouncementCreateDTO dto) {
        return ResponseEntity.ok(announcementService.createAnnouncement(dto));
    }

    // Admins only
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<AnnouncementDTO> updateAnnouncement(
            @PathVariable Integer id,
            @RequestBody AnnouncementCreateDTO dto) {
        return ResponseEntity.ok(announcementService.updateAnnouncement(id, dto));
    }

    // Admins only
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/toggle")
    public ResponseEntity<AnnouncementDTO> toggleActive(
            @PathVariable Integer id,
            @RequestParam boolean active) {
        return ResponseEntity.ok(announcementService.toggleActive(id, active));
    }

    // Admins only
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable Integer id) {
        announcementService.deleteAnnouncement(id);
        return ResponseEntity.noContent().build();
    }
}
