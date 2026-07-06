package com.obhl.game.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.obhl.game.dto.GameSlot;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class CsvParserService {

    // Accept the common date shapes coordinators export (ISO + US M/D/YYYY).
    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("M/d/yyyy"),
            DateTimeFormatter.ofPattern("M/d/yy"));

    // Accept both 24-hour (19:00) and 12-hour (7:00 PM / 07:00 PM) clock times.
    private static final List<DateTimeFormatter> TIME_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("HH:mm"),
            DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH));

    /**
     * Parse a schedule CSV into ice-time GameSlots.
     * <p>
     * Columns are resolved by header name (case-insensitive) so the file may be
     * either the 4-column slots template ({@code Week,Date,Rink,Time}) or a fuller
     * export ({@code Week,Date,Time,Home Team,Away Team,Rink}); any extra columns
     * (e.g. team matchups) are ignored — the Generate step assigns teams. If no
     * recognizable header is present the columns are read positionally as
     * {@code week,date,time,rink}.
     */
    public List<GameSlot> parseGameSlots(MultipartFile file) {
        List<GameSlot> slots = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            int lineNumber = 0;
            Map<String, Integer> cols = null;

            while ((line = reader.readLine()) != null) {
                lineNumber++;

                if (line.trim().isEmpty()) {
                    continue;
                }

                // The first non-empty row establishes the column layout.
                if (cols == null) {
                    if (looksLikeHeader(line)) {
                        cols = parseHeader(line);
                        continue;
                    }
                    // No header — fall back to the documented positional order.
                    cols = defaultColumns();
                }

                try {
                    slots.add(parseLine(line, cols));
                } catch (Exception e) {
                    throw new RuntimeException("Error parsing line " + lineNumber + ": " + e.getMessage());
                }
            }

            log.info("Successfully parsed {} game slots from CSV", slots.size());
            return slots;

        } catch (Exception e) {
            log.error("Failed to parse CSV file", e);
            throw new RuntimeException("Failed to parse CSV file: " + e.getMessage());
        }
    }

    private boolean looksLikeHeader(String line) {
        String lower = line.toLowerCase();
        return lower.contains("week") && lower.contains("date");
    }

    private Map<String, Integer> parseHeader(String line) {
        String[] parts = line.split(",");
        Map<String, Integer> cols = new HashMap<>();
        for (int i = 0; i < parts.length; i++) {
            cols.put(parts[i].trim().toLowerCase(), i);
        }
        for (String required : new String[] { "week", "date", "time", "rink" }) {
            if (!cols.containsKey(required)) {
                throw new RuntimeException(
                        "CSV header is missing the '" + required + "' column. Expected columns: Week, Date, Time, Rink.");
            }
        }
        return cols;
    }

    private Map<String, Integer> defaultColumns() {
        Map<String, Integer> cols = new HashMap<>();
        cols.put("week", 0);
        cols.put("date", 1);
        cols.put("time", 2);
        cols.put("rink", 3);
        return cols;
    }

    private GameSlot parseLine(String line, Map<String, Integer> cols) {
        String[] parts = line.split(",");

        int maxIndex = 0;
        for (int idx : cols.values()) {
            maxIndex = Math.max(maxIndex, idx);
        }
        if (parts.length <= maxIndex) {
            throw new RuntimeException("Expected at least " + (maxIndex + 1) + " columns but found " + parts.length);
        }

        String weekStr = parts[cols.get("week")].trim();
        String dateStr = parts[cols.get("date")].trim();
        String timeStr = parts[cols.get("time")].trim();
        String rinkStr = parts[cols.get("rink")].trim();

        Integer week;
        try {
            week = Integer.parseInt(weekStr);
        } catch (NumberFormatException e) {
            throw new RuntimeException("Invalid week number: " + weekStr);
        }
        if (week <= 0) {
            throw new RuntimeException("Week must be positive");
        }

        LocalDate date = parseDate(dateStr);
        LocalTime time = parseTime(timeStr);

        String normalizedRink = normalizeRinkName(rinkStr);
        if (normalizedRink == null) {
            throw new RuntimeException("Rink must contain 'Tubbs' or 'Cardinal', found: " + rinkStr);
        }

        return new GameSlot(week, date, time, normalizedRink);
    }

    private LocalDate parseDate(String value) {
        for (DateTimeFormatter fmt : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(value, fmt);
            } catch (Exception ignored) {
                // try the next format
            }
        }
        throw new RuntimeException("Invalid date format (expected e.g. 2026-06-04 or 6/4/2026): " + value);
    }

    private LocalTime parseTime(String value) {
        // Normalize whitespace so "06:30  PM" or non-breaking spaces still parse.
        String cleaned = value.trim().replaceAll("\s+", " ").toUpperCase(Locale.ENGLISH);
        for (DateTimeFormatter fmt : TIME_FORMATTERS) {
            try {
                return LocalTime.parse(cleaned, fmt);
            } catch (Exception ignored) {
                // try the next format
            }
        }
        throw new RuntimeException("Invalid time format (expected e.g. 19:00 or 7:00 PM): " + value);
    }

    /**
     * Normalize rink name to standard format
     * Accepts variations like "Cardinal Rink", "Tubbs Rink", "cardinal", etc.
     * Returns "Cardinal" or "Tubbs", or null if neither is found
     */
    private String normalizeRinkName(String rink) {
        String normalized = rink.trim().toLowerCase();

        if (normalized.contains("cardinal")) {
            return "Cardinal";
        } else if (normalized.contains("tubbs")) {
            return "Tubbs";
        }

        return null;
    }

    /**
     * Validate that the parsed slots are consistent
     */
    public void validateGameSlots(List<GameSlot> slots) {
        if (slots.isEmpty()) {
            throw new RuntimeException("No game slots found in file");
        }

        // Check for duplicate slots (same week, date, time, rink)
        for (int i = 0; i < slots.size(); i++) {
            for (int j = i + 1; j < slots.size(); j++) {
                GameSlot slot1 = slots.get(i);
                GameSlot slot2 = slots.get(j);

                if (slot1.getWeek().equals(slot2.getWeek()) &&
                        slot1.getDate().equals(slot2.getDate()) &&
                        slot1.getTime().equals(slot2.getTime()) &&
                        slot1.getRink().equals(slot2.getRink())) {
                    throw new RuntimeException("Duplicate slot found: Week " + slot1.getWeek() +
                            ", " + slot1.getDate() + " " + slot1.getTime() + " on " + slot1.getRink());
                }
            }
        }

        log.info("Validated {} game slots successfully", slots.size());
    }
}
