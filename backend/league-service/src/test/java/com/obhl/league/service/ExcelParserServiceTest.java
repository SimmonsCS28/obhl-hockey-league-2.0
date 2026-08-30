package com.obhl.league.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.io.ByteArrayOutputStream;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import com.obhl.league.client.StatsClient;

/**
 * The registration import is a once-a-year, high-stakes operation: if the column mapping
 * is wrong the whole draft pool is silently garbage. These tests pin both the header-alias
 * path and the legacy positional fallback.
 */
@ExtendWith(MockitoExtension.class)
class ExcelParserServiceTest {

    @Mock
    private StatsClient statsClient;

    private ExcelParserService service;

    @BeforeEach
    void setUp() {
        service = new ExcelParserService(statsClient);
        // The DB enrichment step is exercised separately; here it must not override ratings.
        when(statsClient.getAllPlayers()).thenReturn(Collections.emptyList());
    }

    private MockMultipartFile workbookOf(String[][] rows) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Sheet1");
            for (int r = 0; r < rows.length; r++) {
                Row row = sheet.createRow(r);
                for (int c = 0; c < rows[r].length; c++) {
                    row.createCell(c).setCellValue(rows[r][c]);
                }
            }
            wb.write(out);
            return new MockMultipartFile("file", "registration.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    out.toByteArray());
        }
    }

    @Test
    void parsesTheDownloadTemplateHeaders() throws Exception {
        List<Map<String, Object>> players = service.parseRegistrationFile(workbookOf(new String[][] {
                { "First Name", "Last Name", "Email", "preferred position", "Skill Rating",
                        "Veteran Status", "Buddy Pick", "Ref", "GM" },
                { "John", "Smith", "john.smith@example.com", "Forward", "7", "veteran", "", "n", "n" },
                { "Jane", "Doe", "jane.doe@example.com", "Defense", "5", "rookie", "John Smith", "n", "y" },
        }));

        assertThat(players).hasSize(2);

        Map<String, Object> john = players.get(0);
        assertThat(john.get("firstName")).isEqualTo("John");
        assertThat(john.get("email")).isEqualTo("john.smith@example.com");
        assertThat(john.get("position")).isEqualTo("Forward");
        assertThat(john.get("skillRating")).isEqualTo(7);
        assertThat(john.get("isVeteran")).isEqualTo(true);
        assertThat(john.get("status")).isEqualTo("Veteran");
        assertThat(john.get("isGm")).isEqualTo(false);

        Map<String, Object> jane = players.get(1);
        assertThat(jane.get("position")).isEqualTo("Defense");
        assertThat(jane.get("isVeteran")).isEqualTo(false);
        assertThat(jane.get("status")).isEqualTo("Rookie");
        assertThat(jane.get("buddyPick")).isEqualTo("John Smith");
        assertThat(jane.get("isGm")).isEqualTo(true);
    }

    /**
     * The shape of the real CustomRegistrationReport export: different column order,
     * unrelated leading columns, "Level N" ratings, an inverted veteran column, and no
     * Ref or GM columns at all.
     */
    @Test
    void parsesTheRealRegistrationExportHeaders() throws Exception {
        List<Map<String, Object>> players = service.parseRegistrationFile(workbookOf(new String[][] {
                { "Team ID", "Roster Name", "Customer ID", "First Name", "Last Name", "Email",
                        "Phone", "New to the league?", "OBHL Buddy Pick",
                        "Adult Hockey Skills Rating", "Preferred Position", "Date" },
                { "12", "OBHL", "884", "Cole", "Simmons", "Cole@Example.com", "555-0100", "No",
                        "Dave Jones", "Level 3", "Forward", "2026-08-01" },
                { "12", "OBHL", "885", "Dave", "Jones", "dave@example.com", "555-0101", "Yes",
                        "", "Level 5", "Defence", "2026-08-01" },
        }));

        assertThat(players).hasSize(2);

        Map<String, Object> cole = players.get(0);
        assertThat(cole.get("firstName")).isEqualTo("Cole");
        // Email is lowercased at parse time; it is the identity key on the board.
        assertThat(cole.get("email")).isEqualTo("cole@example.com");
        assertThat(cole.get("skillRating")).isEqualTo(3);
        assertThat(cole.get("position")).isEqualTo("Forward");
        assertThat(cole.get("buddyPick")).isEqualTo("Dave Jones");
        // "New to the league? = No" means they are a veteran.
        assertThat(cole.get("isVeteran")).isEqualTo(true);
        assertThat(cole.get("status")).isEqualTo("Veteran");
        // Absent columns default rather than throwing.
        assertThat(cole.get("isRef")).isEqualTo(false);
        assertThat(cole.get("isGm")).isEqualTo(false);

        Map<String, Object> dave = players.get(1);
        assertThat(dave.get("skillRating")).isEqualTo(5);
        assertThat(dave.get("position")).isEqualTo("Defense");
        assertThat(dave.get("isVeteran")).isEqualTo(false);
    }

    @Test
    void toleratesReorderedColumns() throws Exception {
        List<Map<String, Object>> players = service.parseRegistrationFile(workbookOf(new String[][] {
                { "GM", "Email", "Skill Rating", "Last Name", "First Name", "Preferred Position" },
                { "yes", "a@b.com", "9", "Zed", "Amy", "Defense" },
        }));

        assertThat(players).hasSize(1);
        Map<String, Object> amy = players.get(0);
        assertThat(amy.get("firstName")).isEqualTo("Amy");
        assertThat(amy.get("lastName")).isEqualTo("Zed");
        assertThat(amy.get("skillRating")).isEqualTo(9);
        assertThat(amy.get("position")).isEqualTo("Defense");
        assertThat(amy.get("isGm")).isEqualTo(true);
    }

    /**
     * A file whose header resolves nothing must still import via the original fixed
     * column order, so previously-working files keep working.
     */
    @Test
    void fallsBackToPositionalMappingWhenHeadersAreUnrecognizable() throws Exception {
        List<Map<String, Object>> players = service.parseRegistrationFile(workbookOf(new String[][] {
                { "col1", "col2", "col3", "col4", "col5", "col6", "col7", "col8", "col9" },
                { "Pat", "Kane", "pat@example.com", "Forward", "8", "veteran", "Bud Dy", "y", "n" },
        }));

        assertThat(players).hasSize(1);
        Map<String, Object> pat = players.get(0);
        assertThat(pat.get("firstName")).isEqualTo("Pat");
        assertThat(pat.get("lastName")).isEqualTo("Kane");
        assertThat(pat.get("email")).isEqualTo("pat@example.com");
        assertThat(pat.get("skillRating")).isEqualTo(8);
        assertThat(pat.get("isVeteran")).isEqualTo(true);
        assertThat(pat.get("buddyPick")).isEqualTo("Bud Dy");
        assertThat(pat.get("isRef")).isEqualTo(true);
    }

    @Test
    void flagsBlankAndDuplicateEmailsWithoutDroppingRows() throws Exception {
        List<Map<String, Object>> players = service.parseRegistrationFile(workbookOf(new String[][] {
                { "First Name", "Last Name", "Email" },
                { "No", "Email", "" },
                { "First", "Copy", "dupe@example.com" },
                { "Second", "Copy", "DUPE@example.com" },
        }));

        // Nobody is silently dropped -- the operator has to be able to see the problem.
        assertThat(players).hasSize(3);
        assertThat(players.get(0).get("importWarning").toString()).contains("No email");
        assertThat(players.get(1)).doesNotContainKey("importWarning");
        // Duplicate detection is case-insensitive, matching the lowercasing at parse time.
        assertThat(players.get(2).get("importWarning").toString()).contains("Duplicate email");
    }

    @Test
    void skipsRowsWithoutAFirstName() throws Exception {
        List<Map<String, Object>> players = service.parseRegistrationFile(workbookOf(new String[][] {
                { "First Name", "Last Name", "Email" },
                { "Real", "Person", "real@example.com" },
                { "", "", "" },
        }));

        assertThat(players).hasSize(1);
        assertThat(players.get(0).get("firstName")).isEqualTo("Real");
    }
}
