package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.client.LeagueClient;
import com.obhl.gateway.client.StatsClient;
import com.obhl.gateway.dto.PlayerCardDTO;
import com.obhl.gateway.dto.PlayerDto;
import com.obhl.gateway.dto.PlayerProfileUpdateDTO;
import com.obhl.gateway.model.PlayerProfile;
import com.obhl.gateway.model.Team;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.PlayerProfileRepository;
import com.obhl.gateway.repository.TeamRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * The card must resolve the same person across season rows whose emails differ only
 * by case, must never leak the birth date (only the age), and must refuse to let an
 * account that was never on a roster create a profile.
 */
@ExtendWith(MockitoExtension.class)
class PlayerProfileServiceTest {

    @Mock private PlayerProfileRepository profileRepository;
    @Mock private UserRepository userRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private StatsClient statsClient;
    @Mock private LeagueClient leagueClient;
    @Mock private HighlightStorageService storage;
    @Mock private ProfilePhotoProcessor photoProcessor;

    private PlayerProfileService service;

    @BeforeEach
    void setUp() {
        service = new PlayerProfileService(profileRepository, userRepository, teamRepository,
                statsClient, leagueClient, storage, photoProcessor, "/api/v1");
    }

    private static PlayerDto row(long id, String email, long seasonId, Long teamId, String jersey) {
        PlayerDto p = new PlayerDto();
        p.setId(id);
        p.setEmail(email);
        p.setSeasonId(seasonId);
        p.setTeamId(teamId);
        p.setFirstName("Marco");
        p.setLastName("Reyes");
        p.setPosition("F");
        p.setJerseyNumber(jersey);
        return p;
    }

    private static Team team(long id, String name, String color) {
        Team t = new Team();
        t.setId(id);
        t.setName(name);
        t.setAbbreviation(name.substring(0, 3).toUpperCase());
        t.setTeamColor(color);
        return t;
    }

    private static Map<String, Object> season(long id, String name, String type, boolean active, String start) {
        return Map.of("id", id, "name", name, "type", type, "isActive", active, "startDate", start);
    }

    private static Authentication authAs(String username) {
        return new UsernamePasswordAuthenticationToken(username, null, List.of());
    }

    @Test
    void cardJoinsCaseVariantEmailsIntoOneHistoryNewestFirst() {
        PlayerDto current = row(300L, "Marco@Example.com", 15L, 1L, "12");
        PlayerDto lastYear = row(200L, "marco@example.com", 14L, 2L, "7");
        PlayerDto tourney = row(250L, "marco@example.com", 20L, 3L, "4");
        when(statsClient.getPlayer(300L)).thenReturn(current);
        when(statsClient.getPlayerHistoryByEmail("Marco@Example.com")).thenReturn(List.of(current, tourney, lastYear));
        when(leagueClient.getSeasons("ALL")).thenReturn(List.of(
                season(15L, "Season 15", "LEAGUE", true, "2026-09-01"),
                season(14L, "Season 14", "LEAGUE", false, "2025-09-01"),
                season(20L, "Summer Classic 2026", "TOURNAMENT", false, "2026-06-15")));
        when(teamRepository.findAllById(anyList())).thenReturn(List.of(
                team(1L, "Blue", "#0000FF"), team(2L, "Orange", "#FFA500"), team(3L, "Team Red", "#FF0000")));
        when(profileRepository.findByEmailLower("marco@example.com")).thenReturn(Optional.empty());

        PlayerCardDTO card = service.getCard(300L, null);

        assertEquals(3, card.getSeasonHistory().size());
        assertEquals(List.of(15L, 20L, 14L),
                card.getSeasonHistory().stream().map(h -> h.getSeasonId()).toList());
        assertTrue(card.getSeasonHistory().get(0).isCurrent());
        assertEquals("TOURNAMENT", card.getSeasonHistory().get(1).getSeasonType());
        assertEquals("Team Red", card.getSeasonHistory().get(1).getTeam().getName());
        assertEquals(Integer.valueOf(12), card.getJerseyNumber());
        assertTrue(card.isSeasonIsCurrent());
        assertFalse(card.isSelf());
        assertFalse(card.isHasProfile());
    }

    @Test
    void cardShowsAgeFromProfileAndFallsBackToRowForHometown() {
        PlayerDto current = row(300L, "marco@example.com", 15L, null, null);
        current.setHometown("Windsor, ON");
        current.setBirthDate(LocalDate.now().minusYears(30));
        when(statsClient.getPlayer(300L)).thenReturn(current);
        when(statsClient.getPlayerHistoryByEmail("marco@example.com")).thenReturn(List.of(current));
        when(leagueClient.getSeasons("ALL")).thenReturn(List.of());

        PlayerProfile profile = new PlayerProfile("marco@example.com");
        profile.setBirthDate(LocalDate.now().minusYears(42).minusDays(1));
        profile.setHeightInches(73);
        profile.setPhotoKey("abc.jpg");
        when(profileRepository.findByEmailLower("marco@example.com")).thenReturn(Optional.of(profile));

        PlayerCardDTO card = service.getCard(300L, null);

        assertEquals(Integer.valueOf(42), card.getAge());          // profile wins over the row's 30
        assertEquals("Windsor, ON", card.getHometown());           // row fills the profile's null
        assertEquals(Integer.valueOf(73), card.getHeightInches());
        assertEquals("/api/v1/media/players/abc.jpg", card.getPhotoUrl());
        assertTrue(card.isHasProfile());
        assertNull(card.getTeam());
        assertNull(card.getJerseyNumber());
    }

    @Test
    void isSelfMatchesTheViewerEmailCaseInsensitively() {
        PlayerDto current = row(300L, "Marco@Example.com", 15L, null, null);
        when(statsClient.getPlayer(300L)).thenReturn(current);
        when(statsClient.getPlayerHistoryByEmail("Marco@Example.com")).thenReturn(List.of(current));
        when(leagueClient.getSeasons("ALL")).thenReturn(List.of());
        when(profileRepository.findByEmailLower("marco@example.com")).thenReturn(Optional.empty());

        User me = new User();
        me.setId(9L);
        me.setUsername("marco");
        me.setEmail("MARCO@example.com");
        when(userRepository.findByUsername("marco")).thenReturn(Optional.of(me));

        assertTrue(service.getCard(300L, authAs("marco")).isSelf());
    }

    @Test
    void placeholderEmailIsNeverSelfAndGetsOnlyItsOwnRow() {
        PlayerDto walkOn = row(300L, "noemail+300@obhl.invalid", 20L, null, null);
        when(statsClient.getPlayer(300L)).thenReturn(walkOn);
        when(leagueClient.getSeasons("ALL")).thenReturn(List.of());
        when(profileRepository.findByEmailLower("noemail+300@obhl.invalid")).thenReturn(Optional.empty());

        PlayerCardDTO card = service.getCard(300L, authAs("anyone"));

        assertEquals(1, card.getSeasonHistory().size());
        assertFalse(card.isSelf());
        verify(statsClient, never()).getPlayerHistoryByEmail(any());
    }

    @Test
    void ownerWithNoRosterRowIsRefused() {
        User me = new User();
        me.setId(9L);
        me.setUsername("fan");
        me.setEmail("fan@example.com");
        when(userRepository.findByUsername("fan")).thenReturn(Optional.of(me));
        when(statsClient.getPlayerHistoryByEmail("fan@example.com")).thenReturn(List.of());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.updateOwnProfile(authAs("fan"), new PlayerProfileUpdateDTO()));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        verify(profileRepository, never()).save(any());
    }

    @Test
    void ownerUpdateSeedsFromNewestRowLinksUserAndNormalizes() {
        User me = new User();
        me.setId(9L);
        me.setUsername("marco");
        me.setEmail("Marco@Example.com");
        when(userRepository.findByUsername("marco")).thenReturn(Optional.of(me));
        PlayerDto newest = row(300L, "marco@example.com", 15L, 1L, "12");
        newest.setHometown("Windsor, ON");
        when(statsClient.getPlayerHistoryByEmail("Marco@Example.com")).thenReturn(List.of(newest));
        when(leagueClient.getActiveSeason()).thenReturn(Map.of("id", 15L));
        when(profileRepository.findByEmailLower("marco@example.com")).thenReturn(Optional.empty());
        when(profileRepository.save(any(PlayerProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        PlayerProfileUpdateDTO dto = new PlayerProfileUpdateDTO(
                LocalDate.now().minusYears(40), "  Sun Prairie, WI ", 70, 172, "r", true);
        var view = service.updateOwnProfile(authAs("marco"), dto);

        assertEquals(Long.valueOf(300L), view.getPlayerId());
        assertEquals("Sun Prairie, WI", view.getHometown());
        assertEquals("R", view.getShoots());
        assertEquals(Integer.valueOf(70), view.getHeightInches());
        assertTrue(view.isUsePhotoAvatar());
        verify(profileRepository).save(org.mockito.ArgumentMatchers.argThat(p ->
                "marco@example.com".equals(p.getEmailLower()) && Long.valueOf(9L).equals(p.getUserId())));
    }

    @Test
    void birthDateOutsideSixteenToHundredYearsIsRejected() {
        User me = new User();
        me.setId(9L);
        me.setUsername("marco");
        me.setEmail("marco@example.com");
        when(userRepository.findByUsername("marco")).thenReturn(Optional.of(me));
        when(statsClient.getPlayerHistoryByEmail("marco@example.com"))
                .thenReturn(List.of(row(300L, "marco@example.com", 15L, 1L, "12")));
        when(leagueClient.getActiveSeason()).thenReturn(Map.of("id", 15L));
        when(profileRepository.findByEmailLower("marco@example.com")).thenReturn(Optional.of(new PlayerProfile("marco@example.com")));

        PlayerProfileUpdateDTO tooYoung = new PlayerProfileUpdateDTO(LocalDate.now().minusYears(12), null, null, null, null, null);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.updateOwnProfile(authAs("marco"), tooYoung));
        assertEquals(PlayerProfileService.ERR_BIRTH_DATE, ex.getReason());
        verify(profileRepository, never()).save(any());
    }

    @Test
    void uploadWritesNewFileBeforeDeletingOld() {
        User me = new User();
        me.setId(9L);
        me.setUsername("marco");
        me.setEmail("marco@example.com");
        when(userRepository.findByUsername("marco")).thenReturn(Optional.of(me));
        when(statsClient.getPlayerHistoryByEmail("marco@example.com"))
                .thenReturn(List.of(row(300L, "marco@example.com", 15L, 1L, "12")));
        when(leagueClient.getActiveSeason()).thenReturn(Map.of("id", 15L));
        PlayerProfile existing = new PlayerProfile("marco@example.com");
        existing.setPhotoKey("old.jpg");
        when(profileRepository.findByEmailLower("marco@example.com")).thenReturn(Optional.of(existing));
        when(photoProcessor.process(any())).thenReturn(new byte[] { 1, 2, 3 });
        when(storage.storeBytes(any(), eq("players"), eq(".jpg"))).thenReturn("new.jpg");
        when(profileRepository.save(any(PlayerProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        var view = service.uploadOwnPhoto(authAs("marco"), null);

        assertEquals("/api/v1/media/players/new.jpg", view.getPhotoUrl());
        var order = org.mockito.Mockito.inOrder(storage, profileRepository);
        order.verify(storage).storeBytes(any(), eq("players"), eq(".jpg"));
        order.verify(profileRepository).save(any(PlayerProfile.class));
        order.verify(storage).delete("players", "old.jpg");
    }

    @Test
    void avatarUrlOnlyWhenPhotoExistsAndOptedIn() {
        PlayerProfile optedInNoPhoto = new PlayerProfile("a@x.com");
        optedInNoPhoto.setUsePhotoAvatar(true);
        PlayerProfile photoNotOptedIn = new PlayerProfile("b@x.com");
        photoNotOptedIn.setPhotoKey("b.jpg");
        PlayerProfile both = new PlayerProfile("c@x.com");
        both.setPhotoKey("c.jpg");
        both.setUsePhotoAvatar(true);
        when(profileRepository.findByEmailLower("a@x.com")).thenReturn(Optional.of(optedInNoPhoto));
        when(profileRepository.findByEmailLower("b@x.com")).thenReturn(Optional.of(photoNotOptedIn));
        when(profileRepository.findByEmailLower("c@x.com")).thenReturn(Optional.of(both));

        assertNull(service.avatarUrlFor("A@x.com"));
        assertNull(service.avatarUrlFor("b@x.com"));
        assertEquals("/api/v1/media/players/c.jpg", service.avatarUrlFor("C@X.com"));
        assertNull(service.avatarUrlFor("  "));
    }

    @Test
    void normalizersHandleLegacySentinels() {
        assertNull(PlayerProfileService.normalizeShoots("N/A"));
        assertEquals("L", PlayerProfileService.normalizeShoots(" l "));
        assertEquals("bob@x.com", PlayerProfileService.normalizeEmail("  Bob@X.com "));
        assertNull(PlayerProfileService.normalizeEmail("   "));
        assertNull(PlayerProfileService.ageFrom(null));
        assertEquals(Integer.valueOf(20), PlayerProfileService.ageFrom(LocalDate.now().minusYears(20)));
        assertEquals(Integer.valueOf(19), PlayerProfileService.ageFrom(LocalDate.now().minusYears(20).plusDays(1)));
    }
}
