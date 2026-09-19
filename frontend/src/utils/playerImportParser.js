import * as XLSX from "xlsx";

export const REQUIRED_PLAYER_IMPORT_COLUMNS = [
  "Player Name",
  "Date of Birth",
  "Parent Name",
  "Parent Phone",
  "Center",
  "Batch",
];

export const OPTIONAL_PLAYER_IMPORT_COLUMNS = [
  "Gender",
  "Date of joining",
  "Parent Email Address",
];

const ALL_SUPPORTED_COLUMNS = [
  ...REQUIRED_PLAYER_IMPORT_COLUMNS,
  ...OPTIONAL_PLAYER_IMPORT_COLUMNS,
];

const normalizeHeader = (value) => {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
};

const HEADER_ALIASES = {
  "date of birth (dd-mm-yyyy)": "Date of Birth",
  "date of joining (dd-mm-yyyy)": "Date of joining",
};

const createHeaderMap = () => {
  return ALL_SUPPORTED_COLUMNS.reduce((map, column) => {
    map[normalizeHeader(column)] = column;
    return map;
  }, HEADER_ALIASES);
};

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().replace(/\s+/g, " ");
};

const normalizePhone = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/[^\d]/g, "");
};

const formatDate = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // SheetJS may materialize Excel date cells as Date objects whose local
    // getters can differ from the calendar date encoded by the workbook.
    // Use UTC calendar parts so the stored date does not shift with timezone.
    const year = String(value.getUTCFullYear()).padStart(4, "0");
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number") {
    const parsedDate = XLSX.SSF.parse_date_code(value);

    if (!parsedDate) {
      return "";
    }

    const year = String(parsedDate.y).padStart(4, "0");
    const month = String(parsedDate.m).padStart(2, "0");
    const day = String(parsedDate.d).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const textValue = String(value).trim();

  if (!textValue) {
    return "";
  }

  // Already in YYYY-MM-DD format.
  if (/^\d{4}-\d{2}-\d{2}$/.test(textValue)) {
    return textValue;
  }

  // Supports common formats such as:
  // DD/MM/YYYY
  // DD-MM-YYYY
  // MM/DD/YYYY
  const separatorMatch = textValue.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
  );

  if (separatorMatch) {
    const first = Number(separatorMatch[1]);
    const second = Number(separatorMatch[2]);
    const year = separatorMatch[3];

    // Treat values where the first part is greater than 12 as DD/MM/YYYY.
    if (first > 12) {
      return `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
    }

    // Default to DD/MM/YYYY for Indian data-entry conventions.
    return `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
  }

  const parsedDate = new Date(textValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
};

const isEmptyRow = (row) => {
  return Object.values(row).every(
    (value) => value === null || value === undefined || String(value).trim() === ""
  );
};

export const parsePlayerImportWorkbook = async (file, worksheetName) => {
  if (!file) {
    throw new Error("Please select an Excel file.");
  }

  const fileName = String(file.name || "").toLowerCase();

  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    throw new Error("Only .xlsx and .xls files are supported.");
  }

  const arrayBuffer = await file.arrayBuffer();

  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    // Keep Excel date cells as serial numbers. Converting them to JavaScript
    // Date objects introduces timezone-dependent day shifts for date-only data.
    // formatDate() converts the serial using the Excel calendar date directly.
    cellDates: false,
  });

  if (!workbook.SheetNames.length) {
    throw new Error("The workbook does not contain any worksheets.");
  }

  const selectedWorksheetName = worksheetName || workbook.SheetNames[0];

  if (!workbook.SheetNames.includes(selectedWorksheetName)) {
    throw new Error(
      `Worksheet "${selectedWorksheetName}" was not found in the workbook.`
    );
  }

  const worksheet = workbook.Sheets[selectedWorksheetName];

  // The downloadable template intentionally includes an Instructions sheet.
  // It is not an import-data worksheet, so selecting it should not trigger
  // required-column validation.
  if (normalizeHeader(selectedWorksheetName) === "instructions") {
    return {
      fileName: file.name,
      worksheetName: selectedWorksheetName,
      totalRows: 0,
      rows: [],
      isInstructionSheet: true,
    };
  }

  // Read rows as arrays so the physical worksheet row index is preserved.
  // `blankrows: true` is required so blank rows inside the worksheet are not
  // removed before sourceRowNumber is calculated.
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: true,
  });

  if (rawRows.length <= 1) {
    throw new Error(
      `The worksheet "${selectedWorksheetName}" does not contain any data rows.`
    );
  }

  const headerMap = createHeaderMap();
  const headerRow = rawRows[0] || [];

  const actualHeaders = headerRow.map((header) => normalizeText(header));
  const normalizedActualHeaders = actualHeaders.map(normalizeHeader);

  const canonicalHeaders = normalizedActualHeaders
    .map((header) => headerMap[header])
    .filter(Boolean);

  const missingRequiredColumns = REQUIRED_PLAYER_IMPORT_COLUMNS.filter(
    (requiredColumn) =>
      !canonicalHeaders.includes(requiredColumn)
  );

  if (missingRequiredColumns.length > 0) {
    throw new Error(
      `Missing required columns: ${missingRequiredColumns.join(", ")}`
    );
  }

  const normalizedRows = rawRows
    .slice(1)
    .map((row, index) => {
      const rowObject = {};

      actualHeaders.forEach((rawHeader, columnIndex) => {
        if (!rawHeader) {
          return;
        }

        rowObject[rawHeader] = row[columnIndex] ?? "";
      });

      return {
        rowObject,
        sourceRowNumber: index + 2,
      };
    })
    .filter(({ rowObject }) => !isEmptyRow(rowObject))
    .map(({ rowObject, sourceRowNumber }) => {
      const mappedRow = {
        sourceRowNumber,
        playerName: "",
        dateOfBirth: "",
        parentName: "",
        parentPhone: "",
        center: "",
        batch: "",
        gender: "",
        joiningDate: "",
        parentEmail: "",
      };

      Object.entries(rowObject).forEach(([rawHeader, rawValue]) => {
        const canonicalHeader = headerMap[normalizeHeader(rawHeader)];

        if (!canonicalHeader) {
          return;
        }

        switch (canonicalHeader) {
          case "Player Name":
            mappedRow.playerName = normalizeText(rawValue);
            break;

          case "Date of Birth":
            mappedRow.dateOfBirth = formatDate(rawValue);
            break;

          case "Parent Name":
            mappedRow.parentName = normalizeText(rawValue);
            break;

          case "Parent Phone":
            mappedRow.parentPhone = normalizePhone(rawValue);
            break;

          case "Center":
            mappedRow.center = normalizeText(rawValue);
            break;

          case "Batch":
            mappedRow.batch = normalizeText(rawValue);
            break;

          case "Gender":
            mappedRow.gender = normalizeText(rawValue);
            break;

          case "Date of joining":
            mappedRow.joiningDate = formatDate(rawValue);
            break;

          case "Parent Email Address":
            mappedRow.parentEmail = normalizeText(rawValue).toLowerCase();
            break;

          default:
            break;
        }
      });

      return mappedRow;
    });

  return {
    fileName: file.name,
    worksheetName: selectedWorksheetName,
    totalRows: normalizedRows.length,
    rows: normalizedRows,
  };
};
