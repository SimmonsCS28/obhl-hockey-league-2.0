package com.obhl.gateway.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTOs for the Chicken Licks team-ordering feature. See
 * CHICKEN_LICKS_ORDER_HANDBACK.md / the Claude Design handoff for the full
 * functional spec.
 */
public class ChickenLicksDto {

    /** Request body for adding a menu item. Wings/Cheeseburger fields are ignored for plain items. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AddItemRequest {
        private String itemKey;
        private String flavor;         // wings only, required
        private List<String> sauces;   // wings only
        private String hotMode;        // wings only: "sexy" | "extra"
        private Integer hotMultiplier; // wings only, 1-20, when hotMode = "extra"
        private Boolean celery;        // wings only
        private Boolean bacon;         // cheeseburger only
        private Integer qty;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateQtyRequest {
        private Integer qty;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemView {
        private Long id;
        private String itemKey;
        private String itemLabel;
        private String detail;
        private BigDecimal unitPrice;
        private Integer qty;
        private BigDecimal lineTotal;
        private boolean mine;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PersonGroup {
        private String email;
        private String name;
        private boolean me;
        private List<ItemView> items;
        private BigDecimal subtotal;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderView {
        private Long id;
        private String orderType;      // PERSONAL | TEAM
        private Long seasonId;
        private Long teamId;
        private String teamName;
        private String initiatorEmail;
        private String initiatorName;
        private boolean mineInitiated;
        private String status;
        private LocalDateTime createdAt;
        private LocalDateTime closedAt;
        private List<PersonGroup> people;
        private BigDecimal total;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OpenOrdersResponse {
        private Long myTeamId;
        private String myTeamName;
        private OrderView personalOrder;
        private OrderView teamOrder;
        private boolean teamOrderJoinable; // team order open, current user has no items in it yet
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HistoryEntry {
        private Long id;
        private String orderType;
        private String teamName;
        private LocalDateTime closedAt;
        private List<PersonGroup> people;
        private BigDecimal total;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StandingsRow {
        private Long teamId;
        private String teamName;
        private BigDecimal total;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MyTotalResponse {
        private BigDecimal total;
    }
}
