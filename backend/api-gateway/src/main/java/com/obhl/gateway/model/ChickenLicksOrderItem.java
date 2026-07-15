package com.obhl.gateway.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One configured line item within a {@link ChickenLicksOrder}, attributed to
 * the person who added it. {@code detail} is the human-readable configured
 * string (e.g. "Buffalo, 3x Extra Sexy, +Ranch, +Celery") used for both
 * display and the call read-aloud. Wings/Cheeseburger "Add to Order" always
 * creates a new line rather than merging into an existing matching one.
 */
@Entity
@Table(name = "chicken_licks_order_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChickenLicksOrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "person_email", nullable = false)
    private String personEmail;

    @Column(name = "person_name")
    private String personName;

    @Column(name = "item_key", nullable = false, length = 50)
    private String itemKey;

    @Column(name = "item_label", nullable = false)
    private String itemLabel;

    @Column(name = "detail", length = 500)
    private String detail;

    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "qty", nullable = false)
    private Integer qty = 1;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
