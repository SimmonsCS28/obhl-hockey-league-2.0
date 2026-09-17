package com.obhl.gateway.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Comparator;
import java.util.List;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.WorkbookUtil;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * Renders one season's pay totals as a sheet laid out the way the rink's
 * "Score Keepers and Officials for OBHL" workbook is: referees in columns A–G, scorekeepers
 * in H–M, one title row per block, headers on row 3, {@code Owed} left as a live
 * {@code =games*rate} formula so the rink can correct a count in place, and the ref rate
 * legend under the referee block. No Spring in here so it can be tested by reading the
 * bytes straight back with POI.
 */
public final class StaffPayWorkbookBuilder {

    /** One sheet row. {@code games} is the sheet's figure — solo games are already doubled. */
    public record Line(String name, int games, int rateCents) {
    }

    private static final String FONT_NAME = "Helvetica Neue";
    private static final short FONT_SIZE = 9;
    private static final float ROW_HEIGHT_PT = 22.5f;
    private static final int HEADER_ROW = 2;   // 0-based: sheet row 3
    private static final int FIRST_DATA_ROW = 3;

    private static final String[] LEGEND = {
        "LEVEL 3 USA Hockey Certified = $40/game",
        "LEVEL 2 Rink Class Certified = $30/game",
        "LEVEL 1 No Training = $20/game",
    };

    private StaffPayWorkbookBuilder() {
    }

    public static byte[] build(String sheetName, String refTitle, String scorekeeperTitle,
            List<Line> refs, List<Line> scorekeepers) throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet(WorkbookUtil.createSafeSheetName(
                    sheetName == null || sheetName.isBlank() ? "Staff Pay" : sheetName));
            Styles st = new Styles(wb);

            // Column widths lifted from the rink's most recent tab.
            setWidths(sheet, new double[] { 16, 18.5, 15, 12.9, 8.43, 19.6, 19.2, 15.5, 8.43, 21.6, 12.9, 19.6, 19.2 });

            Row title = sheet.createRow(0);
            styled(title, 0, refTitle, st.title);
            styled(title, 7, scorekeeperTitle, st.titleLeft);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 6));
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 7, 11));

            Row header = sheet.createRow(HEADER_ROW);
            header.setHeightInPoints(ROW_HEIGHT_PT);
            String[] refHeaders = { "Ref", "Number of Games", "Ref Rate", "Owed", null, "Paid / not paid", "Date Check Issued" };
            String[] skHeaders = { "Score Keeper", "Games", "Scorekeeper Rate", "Owed", "Paid / not paid", "Date Check Issued" };
            for (int i = 0; i < refHeaders.length; i++) {
                if (refHeaders[i] != null) {
                    styled(header, i, refHeaders[i], i == 1 ? st.headerCenter : st.header);
                }
            }
            for (int i = 0; i < skHeaders.length; i++) {
                styled(header, 7 + i, skHeaders[i], i == 1 ? st.headerCenter : st.header);
            }

            List<Line> refRows = sorted(refs);
            List<Line> skRows = sorted(scorekeepers);
            int rows = Math.max(refRows.size(), skRows.size());
            for (int i = 0; i < rows; i++) {
                int r = FIRST_DATA_ROW + i;
                Row row = sheet.createRow(r);
                row.setHeightInPoints(ROW_HEIGHT_PT);
                if (i < refRows.size()) {
                    writeLine(row, 0, refRows.get(i), r, st);
                }
                if (i < skRows.size()) {
                    writeLine(row, 7, skRows.get(i), r, st);
                }
            }

            int legendRow = FIRST_DATA_ROW + refRows.size() + 2;
            for (int i = 0; i < LEGEND.length; i++) {
                styled(sheet.createRow(legendRow + i), 0, LEGEND[i], st.plain);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    /**
     * Fills one person's block starting at {@code col}: name, games (blank when zero, as the
     * rink's sheet does), rate, {@code =games*rate}, then "Not Paid" and an empty date cell.
     * The scorekeeper block has no spacer column after Owed.
     */
    private static void writeLine(Row row, int col, Line line, int rowIdx, Styles st) {
        int excelRow = rowIdx + 1;
        String gamesCol = colLetter(col + 1);
        String rateCol = colLetter(col + 2);

        styled(row, col, line.name(), st.name);
        Cell games = row.createCell(col + 1);
        games.setCellStyle(st.games);
        if (line.games() > 0) {
            games.setCellValue(line.games());
        }
        Cell rate = row.createCell(col + 2);
        rate.setCellStyle(st.money);
        rate.setCellValue(line.rateCents() / 100.0);
        Cell owed = row.createCell(col + 3);
        owed.setCellStyle(st.money);
        owed.setCellFormula(gamesCol + excelRow + "*" + rateCol + excelRow);

        int paidCol = col == 0 ? col + 5 : col + 4;
        styled(row, paidCol, "Not Paid", st.plain);
        row.createCell(paidCol + 1).setCellStyle(st.date);
    }

    private static List<Line> sorted(List<Line> lines) {
        return lines == null ? List.of()
                : lines.stream().sorted(Comparator.comparing(l -> l.name() == null ? "" : l.name().toLowerCase())).toList();
    }

    private static void styled(Row row, int col, String value, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(value);
        c.setCellStyle(style);
    }

    private static void setWidths(Sheet sheet, double[] widths) {
        for (int i = 0; i < widths.length; i++) {
            sheet.setColumnWidth(i, (int) Math.round(widths[i] * 256));
        }
    }

    static String colLetter(int zeroBased) {
        StringBuilder sb = new StringBuilder();
        int n = zeroBased;
        do {
            sb.insert(0, (char) ('A' + (n % 26)));
            n = n / 26 - 1;
        } while (n >= 0);
        return sb.toString();
    }

    /** Every cell style the sheet uses, created once per workbook. */
    private static final class Styles {
        final CellStyle title;
        final CellStyle titleLeft;
        final CellStyle header;
        final CellStyle headerCenter;
        final CellStyle name;
        final CellStyle games;
        final CellStyle money;
        final CellStyle plain;
        final CellStyle date;

        Styles(Workbook wb) {
            Font body = wb.createFont();
            body.setFontName(FONT_NAME);
            body.setFontHeightInPoints(FONT_SIZE);
            Font bold = wb.createFont();
            bold.setFontName(FONT_NAME);
            bold.setFontHeightInPoints(FONT_SIZE);
            bold.setBold(true);
            Font arial = wb.createFont();
            arial.setFontName("Arial");

            title = wb.createCellStyle();
            title.setFont(arial);
            title.setAlignment(HorizontalAlignment.CENTER);
            titleLeft = wb.createCellStyle();
            titleLeft.setFont(arial);

            header = wb.createCellStyle();
            header.setFont(bold);
            header.setAlignment(HorizontalAlignment.LEFT);
            headerCenter = wb.createCellStyle();
            headerCenter.setFont(bold);
            headerCenter.setAlignment(HorizontalAlignment.CENTER);

            name = bordered(wb, body);
            games = bordered(wb, body);
            games.setAlignment(HorizontalAlignment.CENTER);
            money = bordered(wb, body);
            money.setDataFormat(wb.createDataFormat().getFormat("\"$\"#,##0"));

            plain = wb.createCellStyle();
            plain.setFont(arial);
            date = wb.createCellStyle();
            date.setFont(arial);
            date.setAlignment(HorizontalAlignment.CENTER);
            date.setDataFormat(wb.createDataFormat().getFormat("M/d/yyyy"));
        }

        private static CellStyle bordered(Workbook wb, Font font) {
            CellStyle s = wb.createCellStyle();
            s.setFont(font);
            s.setBorderTop(BorderStyle.THIN);
            s.setBorderBottom(BorderStyle.THIN);
            s.setBorderLeft(BorderStyle.THIN);
            s.setBorderRight(BorderStyle.THIN);
            return s;
        }
    }
}
