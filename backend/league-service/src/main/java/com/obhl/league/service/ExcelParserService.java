package com.obhl.league.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.obhl.league.client.StatsClient;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ExcelParserService {

    private final StatsClient statsClient;

    /**
     * Header aliases, keyed by the canonical field name. Header cells are normalized
     * (lowercased, non-alphanumerics stripped) before lookup, so "First Name",
     * "first_name" and "FIRSTNAME" all resolve to the same alias.
     *
     * Two different columns can express veteran status: an explicit "Veteran Status"
     * column (the template) or an inverted "New to the league?" column (the real
     * registration export). Both are recognized; see resolveVeteran.
     */
    private static final Map<String, Set<String>> FIELD_ALIASES = buildAliases();

    /**
     * The original fixed column order, used only when the header row resolves nothing.
     * Preserves imports of files with missing or unrecognizable headers.
     */
    private static final Map<String, Integer> LEGACY_COLUMNS = buildLegacyColumns();

    private static Map<String, Set<String>> buildAliases() {
        Map<String, Set<String>> m = new LinkedHashMap<>();
        m.put("firstName", setOf("firstname", "first", "givenname", "fname"));
        m.put("lastName", setOf("lastname", "last", "surname", "familyname", "lname"));
        m.put("email", setOf("email", "emailaddress", "mail"));
        m.put("position", setOf("position", "pos", "preferredposition", "preferredpos",
                "positionpreference"));
        m.put("skillRating", setOf("skillrating", "skill", "rating", "tier", "skilllevel",
                "level", "adulthockeyskillsrating", "hockeyskillsrating", "skillsrating"));
        m.put("veteranStatus", setOf("veteranstatus", "veteran", "isveteran", "status"));
        m.put("newToLeague", setOf("newtotheleague", "newtoleague", "newplayer", "newmember",
                "isnew"));
        m.put("buddyPick", setOf("buddypick", "obhlbuddypick", "buddy", "buddies",
                "buddyrequest", "buddypicks"));
        m.put("isRef", setOf("ref", "isref", "referee", "reffing", "wanttoref"));
        m.put("isGm", setOf("gm", "isgm", "generalmanager", "captain", "iscaptain"));
        return m;
    }

    private static Map<String, Integer> buildLegacyColumns() {
        Map<String, Integer> m = new LinkedHashMap<>();
        m.put("firstName", 0);
        m.put("lastName", 1);
        m.put("email", 2);
        m.put("position", 3);
        m.put("skillRating", 4);
        m.put("veteranStatus", 5);
        m.put("buddyPick", 6);
        m.put("isRef", 7);
        m.put("isGm", 8);
        return m;
    }

    private static Set<String> setOf(String... values) {
        return new HashSet<>(Arrays.asList(values));
    }

    public List<Map<String, Object>> parseRegistrationFile(MultipartFile file) throws IOException {
        List<Map<String, Object>> players = new ArrayList<>();

        try (InputStream is = file.getInputStream();
                Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Iterator<org.apache.poi.ss.usermodel.Row> rows = sheet.iterator();

            if (!rows.hasNext()) {
                return players;
            }

            // The first row is always consumed as the header, matching prior behavior.
            Map<String, Integer> columns = resolveColumns(rows.next());

            // Tracks emails already seen in this file so duplicates can be flagged.
            // email is the identity key on the board and the React key in the UI, so a
            // duplicate or blank silently collapses two people into one card.
            Set<String> seenEmails = new HashSet<>();

            while (rows.hasNext()) {
                org.apache.poi.ss.usermodel.Row currentRow = rows.next();
                Map<String, Object> player = new HashMap<>();

                String firstName = stringAt(currentRow, columns, "firstName");
                String lastName = stringAt(currentRow, columns, "lastName");

                // Only add if we have at least a name
                if (firstName == null || firstName.isEmpty()) {
                    continue;
                }

                String email = stringAt(currentRow, columns, "email");
                email = email == null ? "" : email.toLowerCase().trim();

                player.put("firstName", firstName);
                player.put("lastName", lastName == null ? "" : lastName);
                player.put("email", email);
                player.put("position", coercePosition(stringAt(currentRow, columns, "position")));
                player.put("skillRating", coerceSkill(stringAt(currentRow, columns, "skillRating")));

                boolean isVeteran = resolveVeteran(currentRow, columns);
                player.put("isVeteran", isVeteran);
                player.put("status", isVeteran ? "Veteran" : "Rookie");

                String buddyPick = stringAt(currentRow, columns, "buddyPick");
                player.put("buddyPick", buddyPick == null ? "" : buddyPick);
                player.put("isRef", coerceBoolean(stringAt(currentRow, columns, "isRef")));
                player.put("isGm", coerceBoolean(stringAt(currentRow, columns, "isGm")));

                // Diagnostics rather than rejections: the row is still imported so nobody
                // silently disappears from the pool, but the problem is carried forward.
                if (email.isEmpty()) {
                    player.put("importWarning", "No email address — this player cannot be "
                            + "matched to an existing profile and may collide with other "
                            + "email-less rows.");
                } else if (!seenEmails.add(email)) {
                    player.put("importWarning", "Duplicate email in this file (" + email
                            + ") — only one of these rows will survive onto the board.");
                }

                players.add(player);
            }
        }

        enrichFromDatabase(players);
        return players;
    }

    /**
     * Maps canonical field names to column indices by reading the header row. Returns the
     * legacy fixed mapping when the header resolves neither name column, which is the
     * signal that this file has no usable header (or an entirely unknown vocabulary).
     */
    private Map<String, Integer> resolveColumns(org.apache.poi.ss.usermodel.Row headerRow) {
        Map<String, Integer> resolved = new LinkedHashMap<>();
        if (headerRow == null) {
            return LEGACY_COLUMNS;
        }

        for (int i = headerRow.getFirstCellNum(); i < headerRow.getLastCellNum(); i++) {
            String normalized = normalizeHeader(getCellValue(headerRow.getCell(i)));
            if (normalized.isEmpty()) {
                continue;
            }
            for (Map.Entry<String, Set<String>> entry : FIELD_ALIASES.entrySet()) {
                // First column to claim a field wins, so a stray later column with a
                // similar name cannot displace the real one.
                if (entry.getValue().contains(normalized) && !resolved.containsKey(entry.getKey())) {
                    resolved.put(entry.getKey(), i);
                    break;
                }
            }
        }

        if (!resolved.containsKey("firstName") || !resolved.containsKey("lastName")) {
            return LEGACY_COLUMNS;
        }
        return resolved;
    }

    private String normalizeHeader(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private String stringAt(org.apache.poi.ss.usermodel.Row row, Map<String, Integer> columns,
            String field) {
        Integer index = columns.get(field);
        if (index == null) {
            return null;
        }
        String value = getCellValue(row.getCell(index));
        return value == null ? null : value.trim();
    }

    /**
     * Veteran status arrives one of two ways: an explicit status column, or an inverted
     * "New to the league?" column. An explicit column wins when both are present.
     */
    private boolean resolveVeteran(org.apache.poi.ss.usermodel.Row row,
            Map<String, Integer> columns) {
        String status = stringAt(row, columns, "veteranStatus");
        if (status != null && !status.isEmpty()) {
            return status.equalsIgnoreCase("veteran");
        }
        if (columns.containsKey("newToLeague")) {
            return !coerceBoolean(stringAt(row, columns, "newToLeague"));
        }
        return false;
    }

    /**
     * Normalizes to the full words the frontend compares against by exact string equality
     * (p.position === 'Forward'). Unrecognized values pass through unchanged so the
     * operator can see and correct them rather than having them silently become forwards.
     */
    private String coercePosition(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return "";
        }
        String p = raw.trim().toLowerCase();
        if (p.startsWith("f") || p.startsWith("c") || p.startsWith("w") || p.contains("forward")
                || p.contains("center") || p.contains("centre") || p.contains("wing")) {
            return "Forward";
        }
        if (p.startsWith("d") || p.contains("defense") || p.contains("defence")) {
            return "Defense";
        }
        if (p.startsWith("g") || p.contains("goal")) {
            return "Goalie";
        }
        return raw.trim();
    }

    private static final Pattern FIRST_INTEGER = Pattern.compile("\\d+");

    /**
     * Pulls the first integer out of the cell, so "Level 3", "3", and "Tier 3 (C)" all
     * yield 3. Returns 0 when there is no number, which is what the unrated-veteran
     * prompt in the UI keys off.
     */
    private Integer coerceSkill(String raw) {
        if (raw == null) {
            return 0;
        }
        Matcher m = FIRST_INTEGER.matcher(raw);
        if (!m.find()) {
            return 0;
        }
        try {
            return Integer.parseInt(m.group());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Boolean coerceBoolean(String raw) {
        if (raw == null) {
            return false;
        }
        String v = raw.trim().toLowerCase();
        return v.equals("yes") || v.equals("true") || v.equals("y") || v.equals("1")
                || v.equals("x") || v.equals("✓");
    }

    /**
     * Overrides skill ratings from the database where the player already exists, and
     * flags name-matches-with-a-different-email for operator confirmation.
     */
    private void enrichFromDatabase(List<Map<String, Object>> players) {
        try {
            List<Map<String, Object>> dbPlayers = statsClient.getAllPlayers();
            Map<String, Map<String, Object>> emailToPlayer = new HashMap<>();
            Map<String, Map<String, Object>> nameToPlayer = new HashMap<>();

            for (Map<String, Object> dbPlayer : dbPlayers) {
                if (dbPlayer.get("email") != null) {
                    emailToPlayer.put(dbPlayer.get("email").toString().toLowerCase().trim(), dbPlayer);
                }
                if (dbPlayer.get("firstName") != null && dbPlayer.get("lastName") != null) {
                    String nameKey = dbPlayer.get("firstName").toString().toLowerCase().trim() + " "
                            + dbPlayer.get("lastName").toString().toLowerCase().trim();
                    nameToPlayer.put(nameKey, dbPlayer);
                }
            }

            for (Map<String, Object> player : players) {
                player.put("ratingFoundInDb", false);
                player.put("potentialMatchFound", false);

                String email = player.get("email") != null
                        ? player.get("email").toString().toLowerCase().trim()
                        : "";
                String nameKey = "";
                if (player.get("firstName") != null && player.get("lastName") != null) {
                    nameKey = player.get("firstName").toString().toLowerCase().trim() + " "
                            + player.get("lastName").toString().toLowerCase().trim();
                }

                if (!email.isEmpty() && emailToPlayer.containsKey(email)) {
                    Map<String, Object> matchedDbPlayer = emailToPlayer.get(email);
                    if (matchedDbPlayer.get("skillRating") != null) {
                        player.put("skillRating", ((Number) matchedDbPlayer.get("skillRating")).intValue());
                        player.put("ratingFoundInDb", true);
                    }
                    if (matchedDbPlayer.get("id") != null) {
                        player.put("dbId", ((Number) matchedDbPlayer.get("id")).longValue());
                    }
                } else if (!nameKey.isEmpty() && nameToPlayer.containsKey(nameKey)) {
                    Map<String, Object> matchedDbPlayer = nameToPlayer.get(nameKey);
                    player.put("potentialMatchFound", true);
                    if (matchedDbPlayer.get("id") != null) {
                        player.put("potentialMatchId", ((Number) matchedDbPlayer.get("id")).longValue());
                    }
                    if (matchedDbPlayer.get("email") != null) {
                        player.put("potentialMatchEmail", matchedDbPlayer.get("email").toString());
                    }
                    if (matchedDbPlayer.get("skillRating") != null) {
                        player.put("potentialMatchSkill", ((Number) matchedDbPlayer.get("skillRating")).intValue());
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to fetch database players for skill rating override: " + e.getMessage());
            // Continue with the parsed players without overriding
        }
    }

    private String getCellValue(Cell cell) {
        if (cell == null)
            return "";
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                return String.valueOf((int) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                // Read the cached result rather than evaluating; registration exports
                // occasionally carry formula cells for concatenated names.
                try {
                    return cell.getStringCellValue();
                } catch (IllegalStateException e) {
                    return String.valueOf((int) cell.getNumericCellValue());
                }
            default:
                return "";
        }
    }
}
