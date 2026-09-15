package com.obhl.gateway.dto;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** DTOs for the broadcast-email opt-outs (goalie open-spot alerts). */
public class NotificationPrefDto {

    /** One kind of broadcast, as seen by the person who can turn it off. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AlertPrefView {
        private String kind;            // e.g. GOALIE_OPEN_SPOT
        private String label;           // "Open goalie spot alerts"
        private String description;     // one line on when it is sent
        private boolean subscribed;
        private LocalDateTime optedOutAt;  // null while subscribed
    }

    /**
     * What the emailed unsubscribe link resolves to. Carries the person's first name and a masked
     * address so the page can say who it is acting for without leaking the full email to anyone who
     * happens to hold the link.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenStatusView {
        private String firstName;
        private String maskedEmail;
        private AlertPrefView pref;
    }

    /** Body for the emailed-link toggle: the link's own parameters plus the wanted state. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenUpdateRequest {
        private Long u;
        private String k;
        private String t;
        private boolean subscribed;
    }

    /** Body for the logged-in toggle. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateRequest {
        private String kind;
        private boolean subscribed;
    }

    /** Result of one open-spot broadcast, for the console's inline feedback. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OpenSpotOutcome {
        private int sent;           // messages Resend accepted
        private int eligible;       // pool members who should have been emailed
        private int optedOut;       // skipped: unsubscribed from these alerts
        private int unavailable;    // skipped: marked unavailable for that week
        private int alreadyOnGame;  // skipped: in the other net, or the one who just left
        private List<String> sentTo; // first names, so the coordinator can see who was told
    }
}
