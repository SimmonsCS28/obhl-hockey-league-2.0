package com.obhl.gateway.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.client.StatsClient;
import com.obhl.gateway.dto.ChickenLicksDto.AddItemRequest;
import com.obhl.gateway.dto.ChickenLicksDto.HistoryEntry;
import com.obhl.gateway.dto.ChickenLicksDto.ItemView;
import com.obhl.gateway.dto.ChickenLicksDto.MyTotalResponse;
import com.obhl.gateway.dto.ChickenLicksDto.OpenOrdersResponse;
import com.obhl.gateway.dto.ChickenLicksDto.OrderView;
import com.obhl.gateway.dto.ChickenLicksDto.PersonGroup;
import com.obhl.gateway.dto.ChickenLicksDto.StandingsRow;
import com.obhl.gateway.dto.PlayerDto;
import com.obhl.gateway.model.ChickenLicksOrder;
import com.obhl.gateway.model.ChickenLicksOrderItem;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.ChickenLicksOrderItemRepository;
import com.obhl.gateway.repository.ChickenLicksOrderRepository;

/**
 * Chicken Licks team ordering — see CHICKEN_LICKS_ORDER_HANDBACK.md and the
 * Claude Design handoff for the full functional spec. Personal and team
 * orders are independent (both can be open at once); only the team order's
 * initiator can close/cancel it; only a line's own author can edit/remove it.
 */
@Service
public class ChickenLicksOrderService {

    private static final String PERSONAL = ChickenLicksOrder.TYPE_PERSONAL;
    private static final String TEAM = ChickenLicksOrder.TYPE_TEAM;
    private static final String OPEN = ChickenLicksOrder.STATUS_OPEN;
    private static final String PLACED = ChickenLicksOrder.STATUS_PLACED;
    private static final String CLOSED = ChickenLicksOrder.STATUS_CLOSED;

    private static final List<String> WING_FLAVORS = List.of("Original", "Dry Rub", "Buffalo", "BBQ", "Nude (Plain)");
    private static final List<String> WING_SAUCES = List.of("Blue Cheese", "Ranch", "BBQ", "Buffalo");

    private record MenuItem(String label, BigDecimal basePrice) {
    }

    private static final Map<String, MenuItem> CATALOG = Map.ofEntries(
            Map.entry("wings", new MenuItem("Wings", new BigDecimal("13.00"))),
            Map.entry("sandwich_poboy", new MenuItem("Chicken Po-Boy", new BigDecimal("11.50"))),
            Map.entry("sandwich_crispy_chicken", new MenuItem("Crispy Chicken Sandwich", new BigDecimal("7.00"))),
            Map.entry("sandwich_grilled_chicken", new MenuItem("Grilled Chicken Sandwich", new BigDecimal("7.00"))),
            Map.entry("sandwich_crispy_cod", new MenuItem("Crispy Cod Sandwich", new BigDecimal("7.50"))),
            Map.entry("basket_chicken_strips", new MenuItem("Chicken Strips Basket", new BigDecimal("12.00"))),
            Map.entry("basket_shrimp", new MenuItem("Shrimp Basket", new BigDecimal("12.00"))),
            Map.entry("basket_crispy_cod", new MenuItem("Crispy Cod Basket", new BigDecimal("12.00"))),
            Map.entry("cheeseburger", new MenuItem("Cheeseburger", new BigDecimal("7.50"))),
            Map.entry("blue_cheese_pint", new MenuItem("Blue Cheese Pint", new BigDecimal("7.00"))),
            Map.entry("app_cheese_curds", new MenuItem("Cheese Curds", new BigDecimal("6.00"))),
            Map.entry("app_jalapeno_poppers", new MenuItem("Jalapeno Poppers", new BigDecimal("6.00"))),
            Map.entry("app_onion_rings", new MenuItem("Onion Rings", new BigDecimal("6.00"))),
            Map.entry("app_mac_cheese_bites", new MenuItem("Mac & Cheese Bites", new BigDecimal("6.00"))),
            Map.entry("app_mushrooms", new MenuItem("Mushrooms", new BigDecimal("6.00"))),
            Map.entry("app_breaded_pickle_chips", new MenuItem("Breaded Pickle Chips", new BigDecimal("6.00"))),
            Map.entry("app_pub_chips", new MenuItem("Pub Chips", new BigDecimal("5.00"))),
            Map.entry("app_waffle_fries", new MenuItem("Waffle Fries", new BigDecimal("5.00"))),
            Map.entry("app_tater_tots", new MenuItem("Tater Tots", new BigDecimal("5.00"))),
            Map.entry("app_french_fries", new MenuItem("French Fries", new BigDecimal("4.50"))),
            Map.entry("app_cole_slaw", new MenuItem("Cole Slaw", new BigDecimal("2.00"))));

    @Autowired
    private ChickenLicksOrderRepository orderRepository;

    @Autowired
    private ChickenLicksOrderItemRepository itemRepository;

    @Autowired
    private StatsClient statsClient;

    @Autowired
    private TeamService teamService;

    private record TeamContext(Long id, String name) {
    }

    // ---- team resolution ----

    private TeamContext resolveMyTeam(String email, Long seasonId) {
        try {
            PlayerDto player = statsClient.getPlayerByEmailAndSeason(email, seasonId);
            if (player == null || player.getTeamId() == null) {
                return null;
            }
            return teamService.getTeamById(player.getTeamId())
                    .map(t -> new TeamContext(t.getId(), t.getName()))
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    // ---- reads ----

    @Transactional(readOnly = true)
    public OpenOrdersResponse getOpenOrders(User user, Long seasonId) {
        String email = user.getEmail();
        TeamContext team = resolveMyTeam(email, seasonId);

        OrderView personal = orderRepository.findByInitiatorEmailAndOrderTypeAndStatus(email, PERSONAL, OPEN)
                .map(o -> toOrderView(o, email)).orElse(null);

        // The most recent team order stays on screen even after it's closed (it's the
        // persistent call screen) until the initiator starts a new one — so look up the
        // latest by id regardless of status, not just the OPEN one.
        OrderView teamOrder = null;
        boolean joinable = false;
        if (team != null) {
            ChickenLicksOrder latest = orderRepository.findTopByTeamIdAndOrderTypeOrderByIdDesc(team.id(), TEAM).orElse(null);
            if (latest != null && (OPEN.equals(latest.getStatus()) || CLOSED.equals(latest.getStatus()))) {
                OrderView view = toOrderView(latest, email);
                teamOrder = view;
                joinable = OPEN.equals(latest.getStatus()) && view.getPeople().stream().noneMatch(PersonGroup::isMe);
            }
        }

        return new OpenOrdersResponse(team == null ? null : team.id(), team == null ? null : team.name(), personal, teamOrder, joinable);
    }

    @Transactional(readOnly = true)
    public List<HistoryEntry> getHistory(User user, Long seasonId) {
        String email = user.getEmail();
        TeamContext team = resolveMyTeam(email, seasonId);
        return orderRepository.findHistory(seasonId, email, team == null ? null : team.id()).stream()
                .map(o -> toHistoryEntry(o, email))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StandingsRow> getStandings(Long seasonId) {
        return orderRepository.findTeamTotals(seasonId).stream()
                .map(t -> new StandingsRow(t.getTeamId(), t.getTeamName(), t.getTotal()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public MyTotalResponse getMyTotal(User user, Long seasonId) {
        BigDecimal total = orderRepository.findMyTotal(user.getEmail(), seasonId);
        return new MyTotalResponse(total == null ? BigDecimal.ZERO : total);
    }

    // ---- writes ----

    @Transactional
    public OrderView startPersonal(User user, Long seasonId) {
        String email = user.getEmail();
        if (orderRepository.findByInitiatorEmailAndOrderTypeAndStatus(email, PERSONAL, OPEN).isPresent()) {
            throw new RuntimeException("You already have an open personal order");
        }
        TeamContext team = resolveMyTeam(email, seasonId);
        ChickenLicksOrder order = new ChickenLicksOrder();
        order.setOrderType(PERSONAL);
        order.setSeasonId(seasonId);
        order.setTeamId(team == null ? null : team.id());
        order.setTeamName(team == null ? null : team.name());
        order.setInitiatorEmail(email);
        order.setInitiatorName(displayName(user));
        order.setStatus(OPEN);
        order = orderRepository.save(order);
        return toOrderView(order, email);
    }

    @Transactional
    public OrderView startTeam(User user, Long seasonId) {
        String email = user.getEmail();
        TeamContext team = resolveMyTeam(email, seasonId);
        if (team == null) {
            throw new RuntimeException("You're not on a team this season");
        }
        if (orderRepository.findByTeamIdAndOrderTypeAndStatus(team.id(), TEAM, OPEN).isPresent()) {
            throw new RuntimeException("Your team already has an open team order");
        }
        ChickenLicksOrder order = new ChickenLicksOrder();
        order.setOrderType(TEAM);
        order.setSeasonId(seasonId);
        order.setTeamId(team.id());
        order.setTeamName(team.name());
        order.setInitiatorEmail(email);
        order.setInitiatorName(displayName(user));
        order.setStatus(OPEN);
        order = orderRepository.save(order);
        return toOrderView(order, email);
    }

    @Transactional
    public OrderView addItem(String orderKey, User user, Long seasonId, AddItemRequest req) {
        String email = user.getEmail();
        ChickenLicksOrder order = resolveEditableOrder(orderKey, email, seasonId);

        MenuItem menuItem = CATALOG.get(req.getItemKey());
        if (menuItem == null) {
            throw new RuntimeException("Unknown item: " + req.getItemKey());
        }

        int qty = (req.getQty() == null || req.getQty() < 1) ? 1 : req.getQty();
        BigDecimal unitPrice = menuItem.basePrice();
        String detail = null;

        if ("wings".equals(req.getItemKey())) {
            if (req.getFlavor() == null || req.getFlavor().isBlank() || !WING_FLAVORS.contains(req.getFlavor())) {
                throw new RuntimeException("A valid flavor is required for Wings");
            }
            List<String> sauces = req.getSauces() == null ? List.of() : req.getSauces().stream()
                    .filter(WING_SAUCES::contains).collect(Collectors.toList());
            unitPrice = unitPrice.add(BigDecimal.valueOf(sauces.size()));
            boolean celery = Boolean.TRUE.equals(req.getCelery());
            if (celery) {
                unitPrice = unitPrice.add(new BigDecimal("0.75"));
            }
            String hotMode = "extra".equals(req.getHotMode()) ? "extra" : "sexy";
            int mult = req.getHotMultiplier() == null ? 1 : Math.max(1, Math.min(20, req.getHotMultiplier()));
            String hotLabel = "extra".equals(hotMode) ? mult + "x Extra Sexy" : "Sexy";

            List<String> parts = new ArrayList<>();
            parts.add(req.getFlavor());
            parts.add(hotLabel);
            sauces.forEach(s -> parts.add("+" + s));
            if (celery) {
                parts.add("+Celery");
            }
            detail = String.join(", ", parts);
        } else if ("cheeseburger".equals(req.getItemKey())) {
            boolean bacon = Boolean.TRUE.equals(req.getBacon());
            if (bacon) {
                unitPrice = unitPrice.add(new BigDecimal("2.00"));
                detail = "+Bacon";
            }
        }

        ChickenLicksOrderItem item = new ChickenLicksOrderItem();
        item.setOrderId(order.getId());
        item.setPersonEmail(email);
        item.setPersonName(displayName(user));
        item.setItemKey(req.getItemKey());
        item.setItemLabel(menuItem.label());
        item.setDetail(detail);
        item.setUnitPrice(unitPrice);
        item.setQty(qty);
        itemRepository.save(item);

        return toOrderView(order, email);
    }

    @Transactional
    public OrderView updateItemQty(Long itemId, User user, int qty) {
        ChickenLicksOrderItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));
        if (!item.getPersonEmail().equalsIgnoreCase(user.getEmail())) {
            throw new RuntimeException("You can only edit your own items");
        }
        ChickenLicksOrder order = orderRepository.findById(item.getOrderId())
                .orElseThrow(() -> new RuntimeException("Order not found"));
        if (!OPEN.equals(order.getStatus())) {
            throw new RuntimeException("This order is no longer open");
        }
        if (qty <= 0) {
            itemRepository.delete(item);
        } else {
            item.setQty(qty);
            itemRepository.save(item);
        }
        return toOrderView(order, user.getEmail());
    }

    @Transactional
    public OrderView removeItem(Long itemId, User user) {
        return updateItemQty(itemId, user, 0);
    }

    @Transactional
    public OrderView moveToTeam(User user, Long seasonId) {
        String email = user.getEmail();
        ChickenLicksOrder personal = orderRepository.findByInitiatorEmailAndOrderTypeAndStatus(email, PERSONAL, OPEN)
                .orElseThrow(() -> new RuntimeException("No open personal order to move"));
        TeamContext team = resolveMyTeam(email, seasonId);
        if (team == null) {
            throw new RuntimeException("You're not on a team this season");
        }
        ChickenLicksOrder teamOrder = orderRepository.findByTeamIdAndOrderTypeAndStatus(team.id(), TEAM, OPEN)
                .orElseThrow(() -> new RuntimeException("No open team order to move into"));

        for (ChickenLicksOrderItem it : itemRepository.findByOrderId(personal.getId())) {
            itemRepository.save(cloneItem(it, teamOrder.getId()));
        }
        itemRepository.deleteByOrderId(personal.getId());
        orderRepository.delete(personal);

        return toOrderView(teamOrder, email);
    }

    @Transactional
    public OrderView closeTeamOrder(User user, Long seasonId) {
        String email = user.getEmail();
        TeamContext team = resolveMyTeam(email, seasonId);
        if (team == null) {
            throw new RuntimeException("You're not on a team this season");
        }
        ChickenLicksOrder order = orderRepository.findByTeamIdAndOrderTypeAndStatus(team.id(), TEAM, OPEN)
                .orElseThrow(() -> new RuntimeException("No open team order for your team"));
        if (!order.getInitiatorEmail().equalsIgnoreCase(email)) {
            throw new RuntimeException("Only " + order.getInitiatorName() + " can close this order");
        }
        order.setStatus(CLOSED);
        order.setClosedAt(LocalDateTime.now());
        orderRepository.save(order);
        return toOrderView(order, email);
    }

    @Transactional
    public void placePersonal(User user) {
        String email = user.getEmail();
        ChickenLicksOrder order = orderRepository.findByInitiatorEmailAndOrderTypeAndStatus(email, PERSONAL, OPEN)
                .orElseThrow(() -> new RuntimeException("No open personal order"));
        order.setStatus(PLACED);
        order.setClosedAt(LocalDateTime.now());
        orderRepository.save(order);
    }

    @Transactional
    public void cancelOrder(String orderKey, User user, Long seasonId) {
        String email = user.getEmail();
        ChickenLicksOrder order;
        if ("personal".equals(orderKey)) {
            order = orderRepository.findByInitiatorEmailAndOrderTypeAndStatus(email, PERSONAL, OPEN)
                    .orElseThrow(() -> new RuntimeException("No open personal order"));
        } else if ("team".equals(orderKey)) {
            TeamContext team = resolveMyTeam(email, seasonId);
            if (team == null) {
                throw new RuntimeException("You're not on a team this season");
            }
            order = orderRepository.findByTeamIdAndOrderTypeAndStatus(team.id(), TEAM, OPEN)
                    .orElseThrow(() -> new RuntimeException("No open team order for your team"));
            if (!order.getInitiatorEmail().equalsIgnoreCase(email)) {
                throw new RuntimeException("Only " + order.getInitiatorName() + " can cancel this order");
            }
        } else {
            throw new RuntimeException("orderKey must be 'personal' or 'team'");
        }
        itemRepository.deleteByOrderId(order.getId());
        orderRepository.delete(order);
    }

    @Transactional
    public OrderView reorder(Long historyOrderId, User user, Long seasonId) {
        String email = user.getEmail();
        ChickenLicksOrder source = orderRepository.findById(historyOrderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        if (!List.of(PLACED, CLOSED).contains(source.getStatus())) {
            throw new RuntimeException("Only a placed/closed order can be reordered");
        }

        TeamContext team = resolveMyTeam(email, seasonId);
        boolean isMine = PERSONAL.equals(source.getOrderType()) && source.getInitiatorEmail().equalsIgnoreCase(email);
        boolean isMyTeams = TEAM.equals(source.getOrderType()) && team != null && team.id().equals(source.getTeamId());
        if (!isMine && !isMyTeams) {
            throw new RuntimeException("You can't reorder this order");
        }

        List<ChickenLicksOrderItem> sourceItems = itemRepository.findByOrderId(source.getId());

        ChickenLicksOrder fresh = new ChickenLicksOrder();
        fresh.setSeasonId(seasonId);
        fresh.setInitiatorEmail(email);
        fresh.setInitiatorName(displayName(user));
        fresh.setStatus(OPEN);
        if (PERSONAL.equals(source.getOrderType())) {
            if (orderRepository.findByInitiatorEmailAndOrderTypeAndStatus(email, PERSONAL, OPEN).isPresent()) {
                throw new RuntimeException("You already have an open personal order");
            }
            fresh.setOrderType(PERSONAL);
            fresh.setTeamId(team == null ? null : team.id());
            fresh.setTeamName(team == null ? null : team.name());
        } else {
            if (team == null) {
                throw new RuntimeException("You're not on a team this season");
            }
            if (orderRepository.findByTeamIdAndOrderTypeAndStatus(team.id(), TEAM, OPEN).isPresent()) {
                throw new RuntimeException("Your team already has an open team order");
            }
            fresh.setOrderType(TEAM);
            fresh.setTeamId(team.id());
            fresh.setTeamName(team.name());
        }
        fresh = orderRepository.save(fresh);

        for (ChickenLicksOrderItem it : sourceItems) {
            itemRepository.save(cloneItem(it, fresh.getId()));
        }

        return toOrderView(fresh, email);
    }

    // ---- helpers ----

    private ChickenLicksOrder resolveEditableOrder(String orderKey, String email, Long seasonId) {
        if ("personal".equals(orderKey)) {
            return orderRepository.findByInitiatorEmailAndOrderTypeAndStatus(email, PERSONAL, OPEN)
                    .orElseThrow(() -> new RuntimeException("No open personal order"));
        }
        if ("team".equals(orderKey)) {
            TeamContext team = resolveMyTeam(email, seasonId);
            if (team == null) {
                throw new RuntimeException("You're not on a team this season");
            }
            return orderRepository.findByTeamIdAndOrderTypeAndStatus(team.id(), TEAM, OPEN)
                    .orElseThrow(() -> new RuntimeException("No open team order for your team"));
        }
        throw new RuntimeException("orderKey must be 'personal' or 'team'");
    }

    private ChickenLicksOrderItem cloneItem(ChickenLicksOrderItem source, Long targetOrderId) {
        ChickenLicksOrderItem clone = new ChickenLicksOrderItem();
        clone.setOrderId(targetOrderId);
        clone.setPersonEmail(source.getPersonEmail());
        clone.setPersonName(source.getPersonName());
        clone.setItemKey(source.getItemKey());
        clone.setItemLabel(source.getItemLabel());
        clone.setDetail(source.getDetail());
        clone.setUnitPrice(source.getUnitPrice());
        clone.setQty(source.getQty());
        return clone;
    }

    private String displayName(User user) {
        if (user.getFirstName() != null && user.getLastName() != null) {
            return user.getFirstName() + " " + user.getLastName();
        }
        return user.getUsername();
    }

    private OrderView toOrderView(ChickenLicksOrder order, String viewerEmail) {
        List<ChickenLicksOrderItem> items = itemRepository.findByOrderId(order.getId());
        Map<String, PersonGroup> groups = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;

        for (ChickenLicksOrderItem it : items) {
            boolean mine = it.getPersonEmail().equalsIgnoreCase(viewerEmail);
            PersonGroup group = groups.computeIfAbsent(it.getPersonEmail(), e -> {
                PersonGroup g = new PersonGroup();
                g.setEmail(e);
                g.setName(it.getPersonName());
                g.setMe(mine);
                g.setItems(new ArrayList<>());
                g.setSubtotal(BigDecimal.ZERO);
                return g;
            });
            BigDecimal lineTotal = it.getUnitPrice().multiply(BigDecimal.valueOf(it.getQty()));
            group.getItems().add(new ItemView(it.getId(), it.getItemKey(), it.getItemLabel(), it.getDetail(),
                    it.getUnitPrice(), it.getQty(), lineTotal, mine));
            group.setSubtotal(group.getSubtotal().add(lineTotal));
            total = total.add(lineTotal);
        }

        OrderView view = new OrderView();
        view.setId(order.getId());
        view.setOrderType(order.getOrderType());
        view.setSeasonId(order.getSeasonId());
        view.setTeamId(order.getTeamId());
        view.setTeamName(order.getTeamName());
        view.setInitiatorEmail(order.getInitiatorEmail());
        view.setInitiatorName(order.getInitiatorName());
        view.setMineInitiated(order.getInitiatorEmail().equalsIgnoreCase(viewerEmail));
        view.setStatus(order.getStatus());
        view.setCreatedAt(order.getCreatedAt());
        view.setClosedAt(order.getClosedAt());
        view.setPeople(new ArrayList<>(groups.values()));
        view.setTotal(total);
        return view;
    }

    private HistoryEntry toHistoryEntry(ChickenLicksOrder order, String viewerEmail) {
        OrderView ov = toOrderView(order, viewerEmail);
        HistoryEntry h = new HistoryEntry();
        h.setId(ov.getId());
        h.setOrderType(ov.getOrderType());
        h.setTeamName(ov.getTeamName());
        h.setClosedAt(ov.getClosedAt());
        h.setPeople(ov.getPeople());
        h.setTotal(ov.getTotal());
        return h;
    }
}
