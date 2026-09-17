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

describe("parsePlayerImportWorkbook", () => {
  test("parses and normalizes a valid player row", async () => {
    const file = createMockExcelFile([
      {
        "Player Name": "  Rahul   Sharma ",
        "Date of Birth": "2014-08-21",
        "Parent Name": " Amit Sharma ",
        "Parent Phone": "98765 43210",
        Center: " Wakad ",
        Batch: " U14 ",
        Gender: "Male",
        "Date of joining": "2026-06-01",
        "Parent Email Address": " AMIT@EXAMPLE.COM ",
      },
    ]);

    const result = await parsePlayerImportWorkbook(file);

    expect(result.fileName).toBe("players.xlsx");
    expect(result.worksheetName).toBe("Player Import Template");
    expect(result.totalRows).toBe(1);

    expect(result.rows[0]).toEqual({
      sourceRowNumber: 2,
      playerName: "Rahul Sharma",
      dateOfBirth: "2014-08-21",
      parentName: "Amit Sharma",
      parentPhone: "9876543210",
      center: "Wakad",
      batch: "U14",
      gender: "Male",
      joiningDate: "2026-06-01",
      parentEmail: "amit@example.com",
    });
  });

  test("allows optional fields to remain blank", async () => {
    const file = createMockExcelFile([
      {
        "Player Name": "Rohan Patil",
        "Date of Birth": "2013-04-10",
        "Parent Name": "Suresh Patil",
        "Parent Phone": "9123456789",
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
        "Player Name": "Rahul Sharma",
        "Date of Birth": "2014-08-21",
        "Parent Name": "Amit Sharma",
        "Parent Phone": "9876543210",
        Center: "Wakad",
        // Batch intentionally missing
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
        "Player Name": "Rahul Sharma",
        "Date of Birth": "2014-08-21",
        "Parent Name": "Amit Sharma",
        "Parent Phone": "9876543210",
        Center: "Wakad",
        Batch: "U14",
      },
      {},
    ]);

    const result = await parsePlayerImportWorkbook(file);

    expect(result.totalRows).toBe(1);
    expect(result.rows).toHaveLength(1);
  });
});