package com.obhl.gateway.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.ChickenLicksDto.AddItemRequest;
import com.obhl.gateway.dto.ChickenLicksDto.UpdateQtyRequest;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.ChickenLicksOrderService;

/**
 * Chicken Licks team ordering. Every endpoint except GET /standings requires
 * an authenticated user (any role) — see CHICKEN_LICKS_ORDER_HANDBACK.md.
 */
@RestController
@RequestMapping("/api/v1/chicken-licks")
public class ChickenLicksController {

    @Autowired
    private ChickenLicksOrderService orderService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/orders")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getOpenOrders(@RequestParam Long seasonId, Authentication auth) {
        return ResponseEntity.ok(orderService.getOpenOrders(currentUser(auth), seasonId));
    }

    @PostMapping("/orders/personal")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> startPersonal(@RequestParam Long seasonId, Authentication auth) {
        return respond(() -> orderService.startPersonal(currentUser(auth), seasonId));
    }

    @PostMapping("/orders/team")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> startTeam(@RequestParam Long seasonId, Authentication auth) {
        return respond(() -> orderService.startTeam(currentUser(auth), seasonId));
    }

    @PostMapping("/orders/{orderKey}/items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> addItem(@PathVariable String orderKey, @RequestParam Long seasonId,
            @RequestBody AddItemRequest req, Authentication auth) {
        return respond(() -> orderService.addItem(orderKey, currentUser(auth), seasonId, req));
    }

    @PutMapping("/items/{itemId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateItemQty(@PathVariable Long itemId, @RequestBody UpdateQtyRequest req, Authentication auth) {
        int qty = req.getQty() == null ? 0 : req.getQty();
        return respond(() -> orderService.updateItemQty(itemId, currentUser(auth), qty));
    }

    @DeleteMapping("/items/{itemId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> removeItem(@PathVariable Long itemId, Authentication auth) {
        return respond(() -> orderService.removeItem(itemId, currentUser(auth)));
    }

    @PostMapping("/orders/personal/move-to-team")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> moveToTeam(@RequestParam Long seasonId, Authentication auth) {
        return respond(() -> orderService.moveToTeam(currentUser(auth), seasonId));
    }

    @PostMapping("/orders/team/close")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> closeTeamOrder(@RequestParam Long seasonId, Authentication auth) {
        return respond(() -> orderService.closeTeamOrder(currentUser(auth), seasonId));
    }

    @PostMapping("/orders/personal/place")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> placePersonal(Authentication auth) {
        try {
            orderService.placePersonal(currentUser(auth));
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/orders/{orderKey}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> cancelOrder(@PathVariable String orderKey, @RequestParam Long seasonId, Authentication auth) {
        try {
            orderService.cancelOrder(orderKey, currentUser(auth), seasonId);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getHistory(@RequestParam Long seasonId, Authentication auth) {
        return ResponseEntity.ok(orderService.getHistory(currentUser(auth), seasonId));
    }

    @PostMapping("/history/{orderId}/reorder")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> reorder(@PathVariable Long orderId, @RequestParam Long seasonId, Authentication auth) {
        return respond(() -> orderService.reorder(orderId, currentUser(auth), seasonId));
    }

    @GetMapping("/my-total")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMyTotal(@RequestParam Long seasonId, Authentication auth) {
        return ResponseEntity.ok(orderService.getMyTotal(currentUser(auth), seasonId));
    }

    /** Public — powers the Standings page's "Chicken Licks Orders" view (no login required). */
    @GetMapping("/standings")
    public ResponseEntity<?> getStandings(@RequestParam Long seasonId) {
        return ResponseEntity.ok(orderService.getStandings(seasonId));
    }

    // ---- helpers ----

    private User currentUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private ResponseEntity<?> respond(java.util.function.Supplier<Object> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }
}
