import { validatePlayerImportRows } from "./playerImportValidator";

const createRow = (overrides = {}) => ({
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
  ...overrides,
});

const createReferenceData = () => ({
  academyId: "academy-1",
  centers: [
    {
      id: "center-1",
      academy_id: "academy-1",
      center_name: "Wakad",
      is_active: true,
    },
  ],
  batches: [
    {
      id: "batch-1",
      academy_id: "academy-1",
      center_id: "center-1",
      batch_name: "U14",
      is_active: true,
    },
  ],
  parents: [],
  players: [],
});

describe("validatePlayerImportRows", () => {
  test("resolves center and batch for a valid row", () => {
    const result = validatePlayerImportRows(
      [createRow()],
      createReferenceData()
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({
      resolvedCenterId: "center-1",
      resolvedBatchId: "batch-1",
      existingParentId: null,
    });
  });

  test("requires an academy before validation", () => {
    const result = validatePlayerImportRows(
      [createRow()],
      createReferenceData()
    );

    const noAcademyResult = validatePlayerImportRows(
      [createRow()],
      {
        ...createReferenceData(),
        academyId: "",
      }
    );

    expect(noAcademyResult.isValid).toBe(false);
    expect(noAcademyResult.errors[0].message).toContain(
      "select an academy"
    );
    expect(noAcademyResult.validRows).toEqual([]);
  });

  test("rejects a center that does not belong to the selected academy", () => {
    const result = validatePlayerImportRows(
      [createRow({ center: "Unknown Center" })],
      createReferenceData()
    );

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain(
      'Center "Unknown Center" was not found'
    );
  });

  test("rejects a batch that does not belong to the selected center", () => {
    const result = validatePlayerImportRows(
      [createRow({ batch: "U16" })],
      createReferenceData()
    );

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain(
      'Batch "U16" was not found in center "Wakad"'
    );
  });

  test("reuses an existing parent matched by academy and phone", () => {
    const result = validatePlayerImportRows(
      [createRow()],
      {
        ...createReferenceData(),
        parents: [
          {
            id: "parent-1",
            academy_id: "academy-1",
            parent_name: "Test Parent",
            phone: "9000000000",
            email: "test.parent@example.com",
            is_active: true,
          },
        ],
      }
    );

    expect(result.isValid).toBe(true);
    expect(result.validRows[0].existingParentId).toBe(
      "parent-1"
    );
  });

  test("rejects an existing player with the same name and parent phone", () => {
    const result = validatePlayerImportRows(
      [createRow()],
      {
        ...createReferenceData(),
        players: [
          {
            id: "player-1",
            academy_id: "academy-1",
            full_name: "Test Player",
            parent_phone: "9000000000",
            is_active: true,
          },
        ],
      }
    );

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain(
      "already exists"
    );
  });

  test("rejects duplicate players inside the same import file", () => {
    const result = validatePlayerImportRows(
      [
        createRow({ sourceRowNumber: 2 }),
        createRow({ sourceRowNumber: 3 }),
      ],
      createReferenceData()
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].sourceRowNumber).toBe(3);
    expect(result.errors[0].message).toContain(
      "Duplicate player in the import file"
    );
  });

  test("rejects invalid parent phone", () => {
    const result = validatePlayerImportRows(
      [createRow({ parentPhone: "12345" })],
      createReferenceData()
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) =>
      error.message.includes("exactly 10 digits")
    )).toBe(true);
  });

  test("rejects a conflicting parent email when the phone already exists", () => {
    const result = validatePlayerImportRows(
      [createRow({ parentEmail: "different@example.com" })],
      {
        ...createReferenceData(),
        parents: [
          {
            id: "parent-1",
            academy_id: "academy-1",
            parent_name: "Test Parent",
            phone: "9000000000",
            email: "existing@example.com",
            is_active: true,
          },
        ],
      }
    );

    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain(
      "does not match the existing parent"
    );
  });
});
