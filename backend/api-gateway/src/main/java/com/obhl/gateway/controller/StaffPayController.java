package com.obhl.gateway.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.obhl.gateway.dto.StaffPayDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.AppSettingsService;
import com.obhl.gateway.service.StaffPayService;

/** Admin side of staff pay: rates, finalize, confirmations, and the rink workbook. */
@RestController
@RequestMapping("/api/v1/admin/staff-pay")
@PreAuthorize("hasRole('ADMIN')")
public class StaffPayController {

    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    @Autowired
    private StaffPayService staffPayService;

    @Autowired
    private AppSettingsService appSettingsService;

    @Autowired
    private UserRepository userRepository;

    // ---- rates ----

    @GetMapping("/rates")
    public ResponseEntity<?> getRates(@RequestParam(required = false) Long seasonId) {
        try {
            return ResponseEntity.ok(staffPayService.getRates(seasonId));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @PutMapping("/rates")
    public ResponseEntity<?> saveRate(@RequestBody StaffPayDto.SaveRateRequest req, Authentication auth) {
        try {
            return ResponseEntity.ok(staffPayService.saveRate(req.getUserId(), req.getRole(), req.getRateCents(),
                    currentUserId(auth)));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    // ---- settings ----

    @GetMapping("/settings/finance-email")
    public ResponseEntity<?> getFinanceEmail() {
        return ResponseEntity.ok(Map.of("value",
                appSettingsService.get(AppSettingsService.FINANCE_REPORT_EMAIL).orElse("")));
    }

    @PutMapping("/settings/finance-email")
    public ResponseEntity<?> setFinanceEmail(@RequestBody StaffPayDto.SettingRequest req, Authentication auth) {
        String v = req.getValue() == null ? "" : req.getValue().trim();
        if (!v.isEmpty() && !v.contains("@")) {
            return ResponseEntity.badRequest().body(Map.of("error", "That doesn't look like an email address."));
        }
        appSettingsService.set(AppSettingsService.FINANCE_REPORT_EMAIL, v, currentUserId(auth));
        return ResponseEntity.ok(Map.of("value", v));
    }

    // ---- per-season workflow ----

    @GetMapping("/{seasonId}")
    public ResponseEntity<?> summary(@PathVariable Long seasonId) {
        try {
            return ResponseEntity.ok(staffPayService.getSummary(seasonId));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @PostMapping("/{seasonId}/finalize")
    public ResponseEntity<?> finalize(@PathVariable Long seasonId, Authentication auth) {
        try {
            return ResponseEntity.ok(staffPayService.finalize(seasonId, currentUserId(auth)));
        } catch (StaffPayService.MissingRatesException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage(), "missing", e.getMissing()));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @PostMapping("/{seasonId}/send-confirmations")
    public ResponseEntity<?> sendConfirmations(@PathVariable Long seasonId, Authentication auth) {
        try {
            return ResponseEntity.ok(staffPayService.sendConfirmations(seasonId, currentUserId(auth)));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @PostMapping("/lines/{lineId}/resend")
    public ResponseEntity<?> resend(@PathVariable Long lineId, Authentication auth) {
        try {
            return ResponseEntity.ok(staffPayService.resendLine(lineId, currentUserId(auth)));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @PostMapping("/lines/{lineId}/admin-confirm")
    public ResponseEntity<?> adminConfirm(@PathVariable Long lineId) {
        try {
            return ResponseEntity.ok(staffPayService.adminConfirmLine(lineId));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @GetMapping("/{seasonId}/report.xlsx")
    public ResponseEntity<?> download(@PathVariable Long seasonId) {
        try {
            byte[] bytes = staffPayService.buildReport(seasonId);
            String filename = staffPayService.reportFilename(seasonId);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType(XLSX))
                    .body(bytes);
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @PostMapping("/{seasonId}/send-report")
    public ResponseEntity<?> sendReport(@PathVariable Long seasonId, @RequestBody StaffPayDto.SendReportRequest req,
            Authentication auth) {
        try {
            return ResponseEntity.ok(staffPayService.sendReport(seasonId, req.getToEmail(),
                    !Boolean.FALSE.equals(req.getSaveAsDefault()), currentUserId(auth)));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    // ---- helpers ----

    private Long currentUserId(Authentication auth) {
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    private ResponseEntity<?> badRequest(RuntimeException e) {
        String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        return ResponseEntity.badRequest().body(Map.of("error", msg));
    }
}
