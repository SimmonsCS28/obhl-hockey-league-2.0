package com.obhl.gateway.service;

import com.obhl.gateway.client.LeagueClient;
import com.obhl.gateway.dto.AnnouncementCreateDTO;
import com.obhl.gateway.dto.AnnouncementDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private final LeagueClient leagueClient;

    public List<AnnouncementDTO> getAnnouncements(boolean activeOnly) {
        return leagueClient.getAnnouncements(activeOnly);
    }

    public AnnouncementDTO createAnnouncement(AnnouncementCreateDTO dto) {
        return leagueClient.createAnnouncement(dto);
    }

    public AnnouncementDTO updateAnnouncement(Integer id, AnnouncementCreateDTO dto) {
        return leagueClient.updateAnnouncement(id, dto);
    }

    public AnnouncementDTO toggleActive(Integer id, boolean active) {
        return leagueClient.toggleActive(id, active);
    }

    public void deleteAnnouncement(Integer id) {
        leagueClient.deleteAnnouncement(id);
    }
}
