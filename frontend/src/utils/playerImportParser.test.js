import * as XLSX from "xlsx";

import {
  parsePlayerImportWorkbook,
} from "./playerImportParser";

const createMockExcelFile = (rows, fileName = "players.xlsx") => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Player Import Template"
  );

  const arrayBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  return {
    name: fileName,
    arrayBuffer: async () => arrayBuffer,
  };
};

const createMockWorkbookFile = (sheets, fileName = "players.xlsx") => {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ name, rows }) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });

  const arrayBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  return {
    name: fileName,
    arrayBuffer: async () => arrayBuffer,
  };
};

describe("parsePlayerImportWorkbook", () => {
  test("parses and normalizes a valid player row", async () => {
    const file = createMockExcelFile([
      {
        "Player Name": "  Test   Player ",
        "Date of Birth": "2010-04-04",
        "Parent Name": " Test Parent ",
        "Parent Phone": "90000 00000",
        Center: " Wakad ",
        Batch: " U14 ",
        Gender: "Male",
        "Date of joining": "2026-06-01",
        "Parent Email Address": " TEST.PARENT@EXAMPLE.COM ",
      },
    ]);

    const result = await parsePlayerImportWorkbook(file);

    expect(result.fileName).toBe("players.xlsx");
    expect(result.worksheetName).toBe("Player Import Template");
    expect(result.totalRows).toBe(1);

    expect(result.rows[0]).toEqual({
      sourceRowNumber: 2,
      playerName: "Test Player",
      dateOfBirth: "2010-04-04",
      parentName: "Test Parent",
      parentPhone: "9000000000",
      center: "Wakad",
      batch: "U14",
      gender: "Male",
      joiningDate: "2026-06-01",
      parentEmail: "test.parent@example.com",
    });
  });

  test("preserves Excel date-cell values without timezone day shifts", async () => {
    const file = createMockExcelFile([
      {
        "Player Name": "Excel Date Player",
        "Date of Birth": new Date(2012, 4, 15),
        "Parent Name": "Test Parent",
        "Parent Phone": "9000000004",
        Center: "Wakad",
        Batch: "U14",
        "Date of joining": new Date(2026, 8, 19),
      },
    ]);

    const result = await parsePlayerImportWorkbook(file);

    expect(result.rows[0].dateOfBirth).toBe("2012-05-15");
    expect(result.rows[0].joiningDate).toBe("2026-09-19");
  });

  test("accepts DD-MM-YYYY display headers and normalizes their values", async () => {
    const file = createMockExcelFile([
      {
        "Player Name": "Date Format Player",
        "Date of Birth (DD-MM-YYYY)": "21-08-2014",
        "Parent Name": "Test Parent",
        "Parent Phone": "9000000000",
        Center: "Wakad",
        Batch: "U14",
        "Date of joining (DD-MM-YYYY)": "01-06-2026",
      },
    ]);

    const result = await parsePlayerImportWorkbook(file);

    expect(result.rows[0].dateOfBirth).toBe("2014-08-21");
    expect(result.rows[0].joiningDate).toBe("2026-06-01");
  });

  test("allows optional fields to remain blank", async () => {
    const file = createMockExcelFile([
      {
        "Player Name": "Sample Player",
        "Date of Birth": "2011-03-03",
        "Parent Name": "Sample Parent",
        "Parent Phone": "9000000001",
        Center: "Pimple Saudagar",
        Batch: "U13",
        Gender: "",
        "Date of joining": "",
        "Parent Email Address": "",
      },
    ]);

    const result = await parsePlayerImportWorkbook(file);

    expect(result.rows[0].gender).toBe("");
    expect(result.rows[0].joiningDate).toBe("");
    expect(result.rows[0].parentEmail).toBe("");
  });

  test("rejects a workbook with missing required columns", async () => {
    const file = createMockExcelFile([
      {
        "Player Name": "Test Player",
        "Date of Birth": "2010-04-04",
        "Parent Name": "Test Parent",
        "Parent Phone": "9000000000",
        Center: "Wakad",
      },
    ]);

    await expect(
      parsePlayerImportWorkbook(file)
    ).rejects.toThrow("Missing required columns: Batch");
  });

  test("rejects unsupported file extensions", async () => {
    const file = createMockExcelFile(
      [],
      "players.csv"
    );

    await expect(
      parsePlayerImportWorkbook(file)
    ).rejects.toThrow(
      "Only .xlsx and .xls files are supported."
    );
  });

  test("ignores completely empty rows", async () => {
    const file = createMockExcelFile([
      {
        "Player Name": "Test Player",
        "Date of Birth": "2010-04-04",
        "Parent Name": "Test Parent",
        "Parent Phone": "9000000000",
        Center: "Wakad",
        Batch: "U14",
      },
      {},
    ]);

    const result = await parsePlayerImportWorkbook(file);

    expect(result.totalRows).toBe(1);
    expect(result.rows).toHaveLength(1);
  });

  test("parses the selected worksheet when worksheetName is provided", async () => {
    const file = createMockWorkbookFile([
      {
        name: "First Sheet",
        rows: [
          {
            "Player Name": "Wrong Test Player",
            "Date of Birth": "2010-04-04",
            "Parent Name": "Wrong Test Parent",
            "Parent Phone": "9000000002",
            Center: "Wrong Center",
            Batch: "Wrong Batch",
          },
        ],
      },
      {
        name: "Player Import",
        rows: [
          {
            "Player Name": "Selected Test Player",
            "Date of Birth": "2011-03-03",
            "Parent Name": "Selected Test Parent",
            "Parent Phone": "9000000003",
            Center: "Selected Center",
            Batch: "Selected Batch",
          },
        ],
      },
    ]);

    const result = await parsePlayerImportWorkbook(
      file,
      "Player Import"
    );

    expect(result.worksheetName).toBe("Player Import");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].playerName).toBe("Selected Test Player");
  });

  test("ignores the template Instructions worksheet", async () => {
    const file = createMockWorkbookFile([
      {
        name: "Player Import Template",
        rows: [
          {
            "Player Name": "Test Player",
            "Date of Birth": "2010-04-04",
            "Parent Name": "Test Parent",
            "Parent Phone": "9000000002",
            Center: "Test Center",
            Batch: "Test Batch",
          },
        ],
      },
      {
        name: "Instructions",
        rows: [
          {
            Step: "Use the Player Import Template worksheet.",
          },
        ],
      },
    ]);

    const result = await parsePlayerImportWorkbook(
      file,
      "Instructions"
    );

    expect(result.isInstructionSheet).toBe(true);
    expect(result.rows).toEqual([]);
    expect(result.totalRows).toBe(0);
  });

  test("rejects an unknown worksheet name", async () => {
    const file = createMockWorkbookFile([
      {
        name: "Player Import",
        rows: [
          {
            "Player Name": "Test Player",
            "Date of Birth": "2010-04-04",
            "Parent Name": "Test Parent",
            "Parent Phone": "9000000002",
            Center: "Test Center",
            Batch: "Test Batch",
          },
        ],
      },
    ]);

    await expect(
      parsePlayerImportWorkbook(file, "Does Not Exist")
    ).rejects.toThrow(
      'Worksheet "Does Not Exist" was not found in the workbook.'
    );
  });
});