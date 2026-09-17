package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.util.List;

import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import com.obhl.gateway.service.StaffPayWorkbookBuilder.Line;

/** The sheet has to open in the rink's workbook and read exactly like the tabs they already have. */
class StaffPayWorkbookBuilderTest {

    @Test
    void layoutMatchesTheRinksTab() throws Exception {
        byte[] bytes = StaffPayWorkbookBuilder.build("Fall 2026 C League",
                "OBHL Fall 2026 C League (Cole Simmons)", "OBHL Fall 2026 C League Scorekeepers (Cole Simmons)",
                List.of(new Line("Zed Ref", 4, 3000), new Line("Amy Ref", 0, 4000)),
                List.of(new Line("Sue Keeper", 12, 1500)));

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet s = wb.getSheetAt(0);
            assertEquals("Fall 2026 C League", s.getSheetName());
            assertEquals("OBHL Fall 2026 C League (Cole Simmons)", s.getRow(0).getCell(0).getStringCellValue());
            assertEquals("OBHL Fall 2026 C League Scorekeepers (Cole Simmons)", s.getRow(0).getCell(7).getStringCellValue());
            assertEquals(2, s.getNumMergedRegions());

            assertEquals("Ref", s.getRow(2).getCell(0).getStringCellValue());
            assertEquals("Number of Games", s.getRow(2).getCell(1).getStringCellValue());
            assertEquals("Ref Rate", s.getRow(2).getCell(2).getStringCellValue());
            assertEquals("Owed", s.getRow(2).getCell(3).getStringCellValue());
            assertEquals("Paid / not paid", s.getRow(2).getCell(5).getStringCellValue());
            assertEquals("Date Check Issued", s.getRow(2).getCell(6).getStringCellValue());
            assertEquals("Score Keeper", s.getRow(2).getCell(7).getStringCellValue());
            assertEquals("Games", s.getRow(2).getCell(8).getStringCellValue());
            assertEquals("Scorekeeper Rate", s.getRow(2).getCell(9).getStringCellValue());
            assertEquals("Owed", s.getRow(2).getCell(10).getStringCellValue());
            assertEquals("Paid / not paid", s.getRow(2).getCell(11).getStringCellValue());
            assertEquals("Date Check Issued", s.getRow(2).getCell(12).getStringCellValue());

            // Sorted by name; a zero-game person keeps a blank Games cell like the rink's sheet.
            assertEquals("Amy Ref", s.getRow(3).getCell(0).getStringCellValue());
            assertEquals(CellType.BLANK, s.getRow(3).getCell(1).getCellType());
            assertEquals(40.0, s.getRow(3).getCell(2).getNumericCellValue());
            assertEquals("B4*C4", s.getRow(3).getCell(3).getCellFormula());
            assertEquals("Not Paid", s.getRow(3).getCell(5).getStringCellValue());
            assertEquals("\"$\"#,##0", s.getRow(3).getCell(2).getCellStyle().getDataFormatString());

            assertEquals("Zed Ref", s.getRow(4).getCell(0).getStringCellValue());
            assertEquals(4.0, s.getRow(4).getCell(1).getNumericCellValue());
            assertEquals("B5*C5", s.getRow(4).getCell(3).getCellFormula());

            assertEquals("Sue Keeper", s.getRow(3).getCell(7).getStringCellValue());
            assertEquals(12.0, s.getRow(3).getCell(8).getNumericCellValue());
            assertEquals(15.0, s.getRow(3).getCell(9).getNumericCellValue());
            assertEquals("I4*J4", s.getRow(3).getCell(10).getCellFormula());
            assertEquals("Not Paid", s.getRow(3).getCell(11).getStringCellValue());

            // Legend sits two blank rows under the last ref.
            assertEquals("LEVEL 3 USA Hockey Certified = $40/game", s.getRow(7).getCell(0).getStringCellValue());
            assertEquals("LEVEL 2 Rink Class Certified = $30/game", s.getRow(8).getCell(0).getStringCellValue());
            assertEquals("LEVEL 1 No Training = $20/game", s.getRow(9).getCell(0).getStringCellValue());
        }
    }

    @Test
    void columnLettersRollOverPastZ() {
        assertEquals("A", StaffPayWorkbookBuilder.colLetter(0));
        assertEquals("Z", StaffPayWorkbookBuilder.colLetter(25));
        assertEquals("AA", StaffPayWorkbookBuilder.colLetter(26));
    }

    @Test
    void sheetNameIsSanitised() throws Exception {
        byte[] bytes = StaffPayWorkbookBuilder.build("Fall 2026: C/D [combined]", "t", "t2", List.of(), List.of());
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            String name = wb.getSheetAt(0).getSheetName();
            assertTrue(name.length() <= 31);
            assertTrue(name.indexOf('/') < 0 && name.indexOf(':') < 0);
        }
    }
}
