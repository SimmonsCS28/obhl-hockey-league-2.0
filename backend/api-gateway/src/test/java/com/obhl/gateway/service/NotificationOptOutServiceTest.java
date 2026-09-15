package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import com.obhl.gateway.dto.NotificationPrefDto;
import com.obhl.gateway.model.NotificationOptOut;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.NotificationOptOutRepository;
import com.obhl.gateway.repository.SeasonGoalieRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * The emailed link is the whole authorisation for a no-login unsubscribe, so what matters is that
 * a genuine link works forever and any edited one — other user, other kind, other secret — does not.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationOptOutServiceTest {

    private static final String KIND = NotificationOptOut.KIND_GOALIE_OPEN_SPOT;

    @Mock private NotificationOptOutRepository optOutRepository;
    @Mock private UserRepository userRepository;
    @Mock private SeasonGoalieRepository seasonGoalieRepository;

    @InjectMocks private NotificationOptOutService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "jwtSecret", "test-secret-that-is-long-enough-for-hmac");
        ReflectionTestUtils.setField(service, "frontendUrl", "https://example.test");

        User u = new User();
        u.setId(42L);
        u.setUsername("sam_goalie");
        u.setFirstName("Sam");
        u.setEmail("sam.goalie@example.test");
        when(userRepository.findById(42L)).thenReturn(Optional.of(u));
        when(userRepository.findById(43L)).thenReturn(Optional.of(new User()));
        when(optOutRepository.findByUserIdAndKind(any(), any())).thenReturn(Optional.empty());
    }

    @Test
    void genuineLinkResolvesToItsUserWithoutRevealingTheAddress() {
        Map<String, String> q = query(service.unsubscribeLink(42L, KIND));

        NotificationPrefDto.TokenStatusView v = service.statusByToken(
                Long.valueOf(q.get("u")), q.get("k"), q.get("t"));

        assertEquals("Sam", v.getFirstName());
        assertEquals("s***@example.test", v.getMaskedEmail());
        assertTrue(v.getPref().isSubscribed());
        assertEquals(KIND, v.getPref().getKind());
    }

    @Test
    void editingTheUserIdInvalidatesTheLink() {
        Map<String, String> q = query(service.unsubscribeLink(42L, KIND));
        assertThrows(RuntimeException.class, () -> service.setByToken(43L, q.get("k"), q.get("t"), false));
        verify(optOutRepository, never()).save(any());
    }

    @Test
    void signatureIsScopedToTheKind() {
        Map<String, String> q = query(service.unsubscribeLink(42L, KIND));
        assertThrows(RuntimeException.class, () -> service.statusByToken(42L, "SOME_OTHER_KIND", q.get("t")));
    }

    @Test
    void rotatingTheSecretInvalidatesOldLinks() {
        Map<String, String> q = query(service.unsubscribeLink(42L, KIND));
        ReflectionTestUtils.setField(service, "jwtSecret", "a-different-secret-after-rotation");
        assertThrows(RuntimeException.class, () -> service.statusByToken(42L, q.get("k"), q.get("t")));
    }

    @Test
    void unsubscribeWritesOneRowAndResubscribeDeletesIt() {
        Map<String, String> q = query(service.unsubscribeLink(42L, KIND));

        service.setByToken(42L, q.get("k"), q.get("t"), false);
        verify(optOutRepository).save(any(NotificationOptOut.class));

        NotificationOptOut existing = new NotificationOptOut(7L, 42L, KIND, null);
        when(optOutRepository.findByUserIdAndKind(42L, KIND)).thenReturn(Optional.of(existing));
        // Unsubscribing twice must not try to insert a duplicate.
        service.setByToken(42L, q.get("k"), q.get("t"), false);
        verify(optOutRepository).save(any(NotificationOptOut.class));

        service.setByToken(42L, q.get("k"), q.get("t"), true);
        verify(optOutRepository).delete(existing);
    }

    @Test
    void settingsPanelShowsTheGoalieKindOnlyToGoalies() {
        User skater = new User();
        skater.setId(9L);
        skater.setRoles(java.util.Set.of());
        when(seasonGoalieRepository.findByUserId(9L)).thenReturn(List.of());
        assertTrue(service.getMine(skater).isEmpty());

        // In a season's pool without holding the role — carried-forward subs look like this.
        User carried = new User();
        carried.setId(10L);
        carried.setRoles(java.util.Set.of());
        when(seasonGoalieRepository.findByUserId(10L)).thenReturn(List.of(new com.obhl.gateway.model.SeasonGoalie()));
        List<NotificationPrefDto.AlertPrefView> mine = service.getMine(carried);
        assertEquals(1, mine.size());
        assertEquals(KIND, mine.get(0).getKind());
        assertFalse(mine.get(0).getLabel().isBlank());
    }

    private static Map<String, String> query(String url) {
        Map<String, String> out = new HashMap<>();
        for (String pair : URI.create(url).getRawQuery().split("&")) {
            String[] kv = pair.split("=", 2);
            out.put(kv[0], kv[1]);
        }
        return out;
    }
}
