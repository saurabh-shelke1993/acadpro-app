import * as XLSX from "xlsx";

import {
  OPTIONAL_PLAYER_IMPORT_COLUMNS,
  REQUIRED_PLAYER_IMPORT_COLUMNS,
} from "./playerImportParser";

export const PLAYER_IMPORT_TEMPLATE_FILE_NAME = "AcadPro_Player_Import_Template.xlsx";
export const PLAYER_IMPORT_TEMPLATE_SHEET_NAME = "Player Import Template";
export const PLAYER_IMPORT_INSTRUCTIONS_SHEET_NAME = "Instructions";

const PLAYER_IMPORT_HEADERS = [
  "Player Name",
  "Date of Birth (DD-MM-YYYY)",
  "Parent Name",
  "Parent Phone",
  "Center",
  "Batch",
  "Gender",
  "Date of joining (DD-MM-YYYY)",
  "Parent Email Address",
];

const EXAMPLE_ROWS = [
  [
    "Test Player",
    "04-04-2010",
    "Test Parent",
    "9000000000",
    "Wakad",
    "U14",
    "Male",
    "01-06-2026",
    "test.parent@example.com",
  ],
  [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
];

const INSTRUCTION_ROWS = [
  ["AcadPro Player Import Template"],
  [""],
  ["Required columns"],
  ...REQUIRED_PLAYER_IMPORT_COLUMNS.map((column) => [column]),
  [""],
  ["Optional columns"],
  ...OPTIONAL_PLAYER_IMPORT_COLUMNS.map((column) => [column]),
  [""],
  ["Instructions"],
  ["1. Keep the column headers in Row 1 unchanged."],
  ["2. Enter one player per row starting from Row 2."],
  ["3. Date of Birth and Date of joining should use DD-MM-YYYY format (for example, 21-08-2014)."],
  ["4. Parent Phone should contain a 10-digit mobile number."],
  ["5. Center and Batch must match existing AcadPro records."],
  ["6. Delete the example player before uploading real data."],
];

const setColumnWidths = (worksheet) => {
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 24 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 30 },
  ];
};

const setPhoneCellsAsText = (worksheet, startRow, endRow) => {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const cellAddress = `D${rowNumber}`;
    const cell = worksheet[cellAddress];

    if (cell) {
      cell.t = "s";
      cell.z = "@";
    }
  }
};

export const buildPlayerImportTemplateWorkbook = () => {
  const workbook = XLSX.utils.book_new();

  const worksheet = XLSX.utils.aoa_to_sheet([
    PLAYER_IMPORT_HEADERS,
    ...EXAMPLE_ROWS,
  ]);

  setColumnWidths(worksheet);
  setPhoneCellsAsText(worksheet, 2, EXAMPLE_ROWS.length + 1);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    PLAYER_IMPORT_TEMPLATE_SHEET_NAME
  );

  const instructionsWorksheet = XLSX.utils.aoa_to_sheet(INSTRUCTION_ROWS);
  instructionsWorksheet["!cols"] = [{ wch: 90 }];

  XLSX.utils.book_append_sheet(
    workbook,
    instructionsWorksheet,
    PLAYER_IMPORT_INSTRUCTIONS_SHEET_NAME
  );

  return workbook;
};

export const downloadPlayerImportTemplate = () => {
  const workbook = buildPlayerImportTemplateWorkbook();

  XLSX.writeFile(workbook, PLAYER_IMPORT_TEMPLATE_FILE_NAME);
};
