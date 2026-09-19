import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as XLSX from "xlsx";

import PlayerImport from "./PlayerImport";

jest.mock("../utils/playerImportTemplate", () => ({
  downloadPlayerImportTemplate: jest.fn(),
}));

jest.mock("../utils/playerImportParser", () => ({
  parsePlayerImportWorkbook: jest.fn(),
}));

jest.mock("../utils/playerImportValidator", () => ({
  validatePlayerImportRows: jest.fn(),
}));

jest.mock("../utils/dataScope", () => ({
  getAccessibleAcademies: jest.fn(),
}));

jest.mock("../services/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("../services/playerService", () => ({
  importPlayersBulk: jest.fn(),
}));

const getTemplateMock = () =>
  jest.requireMock("../utils/playerImportTemplate")
    .downloadPlayerImportTemplate;

const getParserMock = () =>
  jest.requireMock("../utils/playerImportParser")
    .parsePlayerImportWorkbook;

const getValidatorMock = () =>
  jest.requireMock("../utils/playerImportValidator")
    .validatePlayerImportRows;

const getAcademiesMock = () =>
  jest.requireMock("../utils/dataScope")
    .getAccessibleAcademies;

const getSupabaseMock = () =>
  jest.requireMock("../services/supabase")
    .supabase;

const getImportPlayersBulkMock = () =>
  jest.requireMock("../services/playerService")
    .importPlayersBulk;

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

const createSupabaseQueryMock = (data = []) => {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    then: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.then.mockImplementation((resolve, reject) =>
    Promise.resolve({
      data,
      error: null,
    }).then(resolve, reject)
  );

  return query;
};

describe("PlayerImport", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getAcademiesMock().mockResolvedValue([
      {
        id: "academy-1",
        academy_name: "Thane City FC",
      },
    ]);

    getSupabaseMock().from.mockImplementation(() =>
      createSupabaseQueryMock([])
    );

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

    getImportPlayersBulkMock().mockResolvedValue({
      importedPlayerCount: 1,
      createdParentCount: 1,
      reusedParentCount: 0,
    });

    getValidatorMock().mockReturnValue({
      isValid: true,
      errors: [],
      validRows: [
        {
          sourceRowNumber: 2,
          playerName: "Test Player",
          resolvedCenterId: "center-1",
          resolvedBatchId: "batch-1",
          existingParentId: null,
        },
      ],
    });
  });

  test("renders academy selection for the import", async () => {
    render(
      <PlayerImport
        loggedInUser={{
          id: "user-1",
          role: "super_admin",
        }}
      />
    );

    expect(
      screen.getByLabelText("Academy *")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("option", {
          name: "Thane City FC",
        })
      ).toBeInTheDocument();
    });
  });

  test("renders template download and Excel upload controls", async () => {
    render(
      <PlayerImport
        loggedInUser={{
          id: "user-1",
          role: "super_admin",
        }}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Download Excel Template",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Excel File")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(getAcademiesMock()).toHaveBeenCalled();
    });
  });

  test("downloads the player import template when requested", async () => {
    render(
      <PlayerImport
        loggedInUser={{
          id: "user-1",
          role: "super_admin",
        }}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("option", {
          name: "Thane City FC",
        })
      ).toBeInTheDocument();
    });

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
    render(
      <PlayerImport
        loggedInUser={{
          id: "user-1",
          role: "super_admin",
        }}
      />
    );

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

  test("validates uploaded rows against the selected academy", async () => {
    render(
      <PlayerImport
        loggedInUser={{
          id: "user-1",
          role: "super_admin",
        }}
      />
    );

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

    fireEvent.change(
      screen.getByLabelText("Academy *"),
      {
        target: {
          value: "academy-1",
        },
      }
    );

    await waitFor(() => {
      expect(
        getValidatorMock()
      ).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            playerName: "Test Player",
          }),
        ]),
        expect.objectContaining({
          academyId: "academy-1",
        })
      );
    });

    expect(
      screen.getByText("1 row ready for import.")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Import 1 Player",
      })
    ).toBeInTheDocument();
  });

  test("imports validated players and shows the import result", async () => {
    window.confirm = jest.fn(() => true);

    render(
      <PlayerImport
        loggedInUser={{
          id: "user-1",
          role: "super_admin",
        }}
      />
    );

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

    fireEvent.change(
      screen.getByLabelText("Academy *"),
      {
        target: {
          value: "academy-1",
        },
      }
    );

    const importButton = await screen.findByRole(
      "button",
      {
        name: "Import 1 Player",
      }
    );

    fireEvent.click(importButton);

    await waitFor(() => {
      expect(
        getImportPlayersBulkMock()
      ).toHaveBeenCalledWith(
        "academy-1",
        expect.arrayContaining([
          expect.objectContaining({
            playerName: "Test Player",
            resolvedCenterId: "center-1",
            resolvedBatchId: "batch-1",
          }),
        ])
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("Import completed successfully.")
      ).toBeInTheDocument();

      expect(
        screen.getByText(/Players imported: 1/)
      ).toBeInTheDocument();
    });
  });

  test("shows row-level validation errors", async () => {
    getValidatorMock().mockReturnValue({
      isValid: false,
      validRows: [],
      errors: [
        {
          sourceRowNumber: 4,
          message:
            'Center "Unknown Center" was not found in the selected academy.',
        },
      ],
    });

    render(
      <PlayerImport
        loggedInUser={{
          id: "user-1",
          role: "super_admin",
        }}
      />
    );

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
        "Unknown Center",
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

    fireEvent.change(
      screen.getByLabelText("Academy *"),
      {
        target: {
          value: "academy-1",
        },
      }
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Row 4: Center "Unknown Center" was not found in the selected academy.'
        )
      ).toBeInTheDocument();
    });
  });

  test("shows parser validation errors", async () => {
    getParserMock().mockRejectedValueOnce(
      new Error(
        "Missing required columns: Batch"
      )
    );

    render(
      <PlayerImport
        loggedInUser={{
          id: "user-1",
          role: "super_admin",
        }}
      />
    );

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
    render(
      <PlayerImport
        loggedInUser={{
          id: "user-1",
          role: "super_admin",
        }}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("option", {
          name: "Thane City FC",
        })
      ).toBeInTheDocument();
    });

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
