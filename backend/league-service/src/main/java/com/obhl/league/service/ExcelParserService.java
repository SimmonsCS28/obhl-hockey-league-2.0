package com.obhl.league.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ExcelParserService {

    public List<Map<String, Object>> parseRegistrationFile(MultipartFile file) throws IOException {
        List<Map<String, Object>> players = new ArrayList<>();

        try (InputStream is = file.getInputStream();
                Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Iterator<org.apache.poi.ss.usermodel.Row> rows = sheet.iterator();

            // Skip header row
            if (rows.hasNext()) {
                rows.next();
            }

            while (rows.hasNext()) {
                org.apache.poi.ss.usermodel.Row currentRow = rows.next();
                Map<String, Object> player = new HashMap<>();

                // Headers: First Name, Last Name, Email, Preferred Position, Skill Rating,
                // Veteran Status, Buddy Pick, Ref, GM
                player.put("firstName", getCellValue(currentRow.getCell(0)));
                player.put("lastName", getCellValue(currentRow.getCell(1)));
                player.put("email", getCellValue(currentRow.getCell(2)));
                player.put("position", getCellValue(currentRow.getCell(3)));
                player.put("skillRating", getNumericCellValue(currentRow.getCell(4)));

                // Parse Veteran Status column (can be "veteran", "rookie", etc.) and set both
                // status and isVeteran
                String statusRaw = getCellValue(currentRow.getCell(5));
                // Capitalize first letter for display (e.g., "rookie" -> "Rookie")
                String status = (statusRaw != null && !statusRaw.isEmpty())
                        ? statusRaw.substring(0, 1).toUpperCase() + statusRaw.substring(1).toLowerCase()
                        : "Rookie";
                player.put("status", status);
                player.put("isVeteran", statusRaw != null && statusRaw.equalsIgnoreCase("veteran"));

                player.put("buddyPick", getCellValue(currentRow.getCell(6)));
                player.put("isRef", getBooleanCellValue(currentRow.getCell(7)));
                player.put("isGm", getBooleanCellValue(currentRow.getCell(8)));

                // Only add if we have at least a name
                if (player.get("firstName") != null && !player.get("firstName").toString().isEmpty()) {
                    players.add(player);
                }
            }
        }

        return players;
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
            default:
                return "";
        }
    }

    private Integer getNumericCellValue(Cell cell) {
        if (cell == null)
            return 0;
        if (cell.getCellType() == CellType.NUMERIC) {
            return (int) cell.getNumericCellValue();
        }
        try {
            return Integer.parseInt(cell.getStringCellValue());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Boolean getBooleanCellValue(Cell cell) {
        if (cell == null)
            return false;
        if (cell.getCellType() == CellType.BOOLEAN) {
            return cell.getBooleanCellValue();
        }
        String val = cell.getStringCellValue().toLowerCase();
        return val.equals("yes") || val.equals("true") || val.equals("y");
    }
}
