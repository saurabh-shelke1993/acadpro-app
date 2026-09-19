import * as XLSX from "xlsx";

import {
  buildPlayerImportTemplateWorkbook,
  PLAYER_IMPORT_INSTRUCTIONS_SHEET_NAME,
  PLAYER_IMPORT_TEMPLATE_FILE_NAME,
  PLAYER_IMPORT_TEMPLATE_SHEET_NAME,
} from "./playerImportTemplate";

import {
  OPTIONAL_PLAYER_IMPORT_COLUMNS,
  REQUIRED_PLAYER_IMPORT_COLUMNS,
} from "./playerImportParser";

describe("buildPlayerImportTemplateWorkbook", () => {
  test("creates the expected player import worksheet and headers", () => {
    const workbook = buildPlayerImportTemplateWorkbook();

    expect(workbook.SheetNames).toEqual([
      PLAYER_IMPORT_TEMPLATE_SHEET_NAME,
      PLAYER_IMPORT_INSTRUCTIONS_SHEET_NAME,
    ]);

    const worksheet = workbook.Sheets[PLAYER_IMPORT_TEMPLATE_SHEET_NAME];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    expect(rows[0]).toEqual([
      "Player Name",
      "Date of Birth (DD-MM-YYYY)",
      "Parent Name",
      "Parent Phone",
      "Center",
      "Batch",
      "Gender",
      "Date of joining (DD-MM-YYYY)",
      "Parent Email Address",
    ]);
  });

  test("includes an example row without adding unsupported columns", () => {
    const workbook = buildPlayerImportTemplateWorkbook();
    const worksheet = workbook.Sheets[PLAYER_IMPORT_TEMPLATE_SHEET_NAME];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      "Test Player",
      "04-04-2010",
      "Test Parent",
      "9000000000",
      "Wakad",
      "U14",
      "Male",
      "01-06-2026",
      "test.parent@example.com",
    ]);
  });

  test("stores the parent phone example as text", () => {
    const workbook = buildPlayerImportTemplateWorkbook();
    const worksheet = workbook.Sheets[PLAYER_IMPORT_TEMPLATE_SHEET_NAME];

    expect(worksheet.D2.v).toBe("9000000000");
    expect(worksheet.D2.t).toBe("s");
    expect(worksheet.D2.z).toBe("@");
  });

  test("creates an instructions worksheet", () => {
    const workbook = buildPlayerImportTemplateWorkbook();
    const worksheet = workbook.Sheets[PLAYER_IMPORT_INSTRUCTIONS_SHEET_NAME];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    expect(rows[0][0]).toBe("AcadPro Player Import Template");
    expect(rows.some((row) =>
      row[0] === "1. Keep the column headers in Row 1 unchanged."
    )).toBe(true);
  });

  test("uses the expected template filename", () => {
    expect(PLAYER_IMPORT_TEMPLATE_FILE_NAME).toBe(
      "AcadPro_Player_Import_Template.xlsx"
    );
  });
});
