import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as XLSX from "xlsx";

import PlayerImport from "./PlayerImport";

jest.mock("../utils/playerImportTemplate", () => ({
  downloadPlayerImportTemplate: jest.fn(),
}));

jest.mock("../utils/playerImportParser", () => ({
  parsePlayerImportWorkbook: jest.fn(),
}));

const getTemplateMock = () =>
  jest.requireMock("../utils/playerImportTemplate")
    .downloadPlayerImportTemplate;

const getParserMock = () =>
  jest.requireMock("../utils/playerImportParser")
    .parsePlayerImportWorkbook;

const createMockFile = (
  rows,
  fileName = "players.xlsx"
) => {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Player Data"
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

describe("PlayerImport", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getParserMock().mockResolvedValue({
      rows: [
        {
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
        },
      ],
    });
  });

  test("renders template download and Excel upload controls", () => {
    render(<PlayerImport />);

    expect(
      screen.getByRole("button", {
        name: "Download Excel Template",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Excel File")
    ).toBeInTheDocument();
  });

  test("downloads the player import template when requested", () => {
    render(<PlayerImport />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Download Excel Template",
      })
    );

    expect(
      getTemplateMock()
    ).toHaveBeenCalledTimes(1);
  });

  test("shows worksheet selection and normalized preview after upload", async () => {
    render(<PlayerImport />);

    const file = createMockFile([
      [
        "Player Name",
        "Date of Birth",
        "Parent Name",
        "Parent Phone",
        "Center",
        "Batch",
      ],
      [
        "Test Player",
        "2010-04-04",
        "Test Parent",
        "9000000000",
        "Wakad",
        "U14",
      ],
    ]);

    fireEvent.change(
      screen.getByLabelText("Excel File"),
      {
        target: {
          files: [file],
        },
      }
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText("Worksheet")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("option", {
        name: "Player Data",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Test Player")
    ).toBeInTheDocument();

    expect(
      getParserMock()
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "players.xlsx",
      }),
      "Player Data"
    );
  });

  test("shows parser validation errors", async () => {
    getParserMock().mockRejectedValueOnce(
      new Error(
        "Missing required columns: Batch"
      )
    );

    render(<PlayerImport />);

    const file = createMockFile([
      [
        "Player Name",
        "Date of Birth",
        "Parent Name",
        "Parent Phone",
        "Center",
      ],
      [
        "Test Player",
        "2010-04-04",
        "Test Parent",
        "9000000000",
        "Wakad",
      ],
    ]);

    fireEvent.change(
      screen.getByLabelText("Excel File"),
      {
        target: {
          files: [file],
        },
      }
    );

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toHaveTextContent(
        "Missing required columns: Batch"
      );
    });

    expect(
      screen.queryByText("Test Player")
    ).not.toBeInTheDocument();
  });

  test("rejects unsupported file extensions before parsing", async () => {
    render(<PlayerImport />);

    const file = createMockFile(
      [
        [
          "Player Name",
          "Date of Birth",
          "Parent Name",
          "Parent Phone",
          "Center",
          "Batch",
        ],
        [
          "Test Player",
          "2010-04-04",
          "Test Parent",
          "9000000000",
          "Wakad",
          "U14",
        ],
      ],
      "players.csv"
    );

    fireEvent.change(
      screen.getByLabelText("Excel File"),
      {
        target: {
          files: [file],
        },
      }
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "Only .xlsx and .xls files are supported."
    );

    expect(
      getParserMock()
    ).not.toHaveBeenCalled();
  });
});
