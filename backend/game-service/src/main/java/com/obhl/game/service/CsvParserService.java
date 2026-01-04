package com.obhl.game.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.obhl.game.dto.GameSlot;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class CsvParserService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    /**
     * Parse CSV file into list of GameSlots
     * Expected CSV format: week,date,time,rink
     * Example: 1,2024-01-15,19:00,Tubbs
     */
    public List<GameSlot> parseGameSlots(MultipartFile file) {
        List<GameSlot> slots = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;

                // Skip header row
                if (lineNumber == 1 && line.toLowerCase().contains("week")) {
                    continue;
                }

                // Skip empty lines
                if (line.trim().isEmpty()) {
                    continue;
                }

                try {
                    GameSlot slot = parseLine(line, lineNumber);
                    slots.add(slot);
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

    private GameSlot parseLine(String line, int lineNumber) {
        String[] parts = line.split(",");

        if (parts.length != 4) {
            throw new RuntimeException("Expected 4 columns (week,date,time,rink) but found " + parts.length);
        }

        try {
            Integer week = Integer.parseInt(parts[0].trim());
            LocalDate date = LocalDate.parse(parts[1].trim(), DATE_FORMATTER);
            LocalTime time = LocalTime.parse(parts[2].trim(), TIME_FORMATTER);
            String rink = parts[3].trim();

            // Validate week is positive
            if (week <= 0) {
                throw new RuntimeException("Week must be positive");
            }

            // Normalize rink name - accept variations like "Cardinal Rink", "Tubbs Rink",
            // etc.
            String normalizedRink = normalizeRinkName(rink);
            if (normalizedRink == null) {
                throw new RuntimeException("Rink must contain 'Tubbs' or 'Cardinal', found: " + rink);
            }

            return new GameSlot(week, date, time, normalizedRink);

        } catch (NumberFormatException e) {
            throw new RuntimeException("Invalid week number: " + parts[0]);
        } catch (DateTimeParseException e) {
            throw new RuntimeException("Invalid date format (expected yyyy-MM-dd): " + parts[1]);
        }
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
