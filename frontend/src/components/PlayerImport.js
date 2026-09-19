import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../services/supabase";

import {
  getAccessibleAcademies,
} from "../utils/dataScope";

import {
  parsePlayerImportWorkbook,
} from "../utils/playerImportParser";

import {
  downloadPlayerImportTemplate,
} from "../utils/playerImportTemplate";

import {
  validatePlayerImportRows,
} from "../utils/playerImportValidator";

function PlayerImport({ loggedInUser }) {
  const [academies, setAcademies] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [worksheetNames, setWorksheetNames] = useState([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState("");
  const [validationError, setValidationError] = useState("");
  const [normalizedRows, setNormalizedRows] = useState([]);
  const [rowValidationErrors, setRowValidationErrors] = useState([]);
  const [validRows, setValidRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [isLoadingReferenceData, setIsLoadingReferenceData] =
    useState(false);

  useEffect(() => {
    const loadAcademies = async () => {
      if (!loggedInUser) {
        return;
      }

      try {
        const data = await getAccessibleAcademies(
          loggedInUser
        );

        setAcademies(data || []);
      } catch (error) {
        setAcademies([]);
        setValidationError(
          error?.message ||
            "Unable to load academies for player import."
        );
      }
    };

    loadAcademies();
  }, [loggedInUser]);

  const resetRowValidation = () => {
    setRowValidationErrors([]);
    setValidRows([]);
  };

  const resetImportState = () => {
    setSelectedFile(null);
    setWorksheetNames([]);
    setSelectedWorksheet("");
    setValidationError("");
    setNormalizedRows([]);
    resetRowValidation();
    setFileName("");
  };

  const validateRowsForAcademy = async (
    rows,
    academyId
  ) => {
    if (!academyId || !rows.length) {
      resetRowValidation();
      return;
    }

    setIsLoadingReferenceData(true);
    setValidationError("");

    try {
      const [
        centersResult,
        batchesResult,
        parentsResult,
        playersResult,
      ] = await Promise.all([
        supabase
          .from("centers")
          .select(
            "id, academy_id, center_name, is_active"
          )
          .eq("academy_id", academyId)
          .eq("is_active", true),

        supabase
          .from("batches")
          .select(
            "id, academy_id, center_id, batch_name, is_active"
          )
          .eq("academy_id", academyId)
          .eq("is_active", true),

        supabase
          .from("parents")
          .select(
            "id, academy_id, parent_name, phone, email, is_active"
          )
          .eq("academy_id", academyId)
          .eq("is_active", true),

        supabase
          .from("players")
          .select(
            "id, academy_id, full_name, phone, is_active"
          )
          .eq("academy_id", academyId)
          .eq("is_active", true),
      ]);

      const firstError =
        centersResult.error ||
        batchesResult.error ||
        parentsResult.error ||
        playersResult.error;

      if (firstError) {
        throw firstError;
      }

      const data = {
        centers: centersResult.data || [],
        batches: batchesResult.data || [],
        parents: parentsResult.data || [],
        players: playersResult.data || [],
      };

      const result = validatePlayerImportRows(
        rows,
        {
          academyId,
          ...data,
        }
      );

      setRowValidationErrors(result.errors || []);
      setValidRows(result.validRows || []);
    } catch (error) {
      resetRowValidation();
      setValidationError(
        error?.message ||
          "Unable to validate the player import against AcadPro data."
      );
    } finally {
      setIsLoadingReferenceData(false);
    }
  };

  const handleAcademyChange = async (event) => {
    const academyId = event.target.value;

    setSelectedAcademy(academyId);
    resetRowValidation();
    setValidationError("");

    if (academyId && normalizedRows.length > 0) {
      await validateRowsForAcademy(
        normalizedRows,
        academyId
      );
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    setValidationError("");
    setNormalizedRows([]);
    resetRowValidation();

    if (!file) {
      resetImportState();
      return;
    }

    const lowerFileName = String(
      file.name || ""
    ).toLowerCase();

    if (
      !lowerFileName.endsWith(".xlsx") &&
      !lowerFileName.endsWith(".xls")
    ) {
      setSelectedFile(null);
      setWorksheetNames([]);
      setSelectedWorksheet("");
      setFileName(file.name || "");
      setValidationError(
        "Only .xlsx and .xls files are supported."
      );
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();

      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
      });

      if (!workbook.SheetNames.length) {
        throw new Error(
          "The workbook does not contain any worksheets."
        );
      }

      const firstWorksheet = workbook.SheetNames[0];

      setSelectedFile(file);
      setFileName(file.name);
      setWorksheetNames(workbook.SheetNames);
      setSelectedWorksheet(firstWorksheet);

      const result = await parsePlayerImportWorkbook(
        file,
        firstWorksheet
      );

      const rows = result.rows || [];

      setNormalizedRows(rows);

      if (selectedAcademy) {
        await validateRowsForAcademy(
          rows,
          selectedAcademy
        );
      }
    } catch (error) {
      setSelectedFile(file);
      setFileName(file.name);
      setWorksheetNames([]);
      setSelectedWorksheet("");
      setNormalizedRows([]);
      resetRowValidation();
      setValidationError(
        error?.message ||
          "Unable to read the Excel file."
      );
    }
  };

  const handleWorksheetChange = async (event) => {
    const worksheetName = event.target.value;

    setSelectedWorksheet(worksheetName);
    setValidationError("");
    setNormalizedRows([]);
    resetRowValidation();

    if (!selectedFile || !worksheetName) {
      return;
    }

    try {
      const result = await parsePlayerImportWorkbook(
        selectedFile,
        worksheetName
      );

      const rows = result.rows || [];

      setNormalizedRows(rows);

      if (selectedAcademy) {
        await validateRowsForAcademy(
          rows,
          selectedAcademy
        );
      }
    } catch (error) {
      setValidationError(
        error?.message ||
          "Unable to validate the selected worksheet."
      );
    }
  };

  return (
    <section
      aria-label="Player Import"
      style={{
        marginTop: "30px",
        marginBottom: "30px",
        padding: "20px",
        border: "1px solid #cbd5e1",
        borderRadius: "10px",
        backgroundColor: "#f8fafc",
      }}
    >
      <h2>Player Import</h2>

      <p>
        Download the template, prepare the player data, then
        upload the completed Excel file for validation and
        preview.
      </p>

      <div style={{ marginBottom: "20px" }}>
        <label htmlFor="player-import-academy">
          Academy *
        </label>
        <br />
        <select
          id="player-import-academy"
          value={selectedAcademy}
          onChange={handleAcademyChange}
        >
          <option value="">Select Academy</option>
          {academies.map((academy) => (
            <option
              key={academy.id}
              value={academy.id}
            >
              {academy.academy_name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={downloadPlayerImportTemplate}
      >
        Download Excel Template
      </button>

      <div style={{ marginTop: "20px" }}>
        <label htmlFor="player-import-file">
          Excel File
        </label>
        <br />
        <input
          id="player-import-file"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
        />
      </div>

      {fileName && (
        <p>
          <strong>Selected file:</strong> {fileName}
        </p>
      )}

      {worksheetNames.length > 0 && (
        <div style={{ marginTop: "15px" }}>
          <label htmlFor="player-import-worksheet">
            Worksheet
          </label>
          <br />
          <select
            id="player-import-worksheet"
            value={selectedWorksheet}
            onChange={handleWorksheetChange}
          >
            {worksheetNames.map((worksheetName) => (
              <option
                key={worksheetName}
                value={worksheetName}
              >
                {worksheetName}
              </option>
            ))}
          </select>
        </div>
      )}

      {validationError && (
        <div
          role="alert"
          style={{
            marginTop: "20px",
            padding: "12px",
            border: "1px solid #ef4444",
            borderRadius: "8px",
            backgroundColor: "#fef2f2",
          }}
        >
          <strong>Import validation error:</strong>{" "}
          {validationError}
        </div>
      )}

      {isLoadingReferenceData && (
        <p role="status">
          Validating rows against the selected academy...
        </p>
      )}

      {selectedAcademy &&
        normalizedRows.length > 0 &&
        !isLoadingReferenceData &&
        !validationError && (
          <div
            role="status"
            style={{
              marginTop: "20px",
              padding: "12px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
            }}
          >
            <strong>
              {rowValidationErrors.length === 0
                ? validRows.length +
                  " row" +
                  (validRows.length === 1 ? "" : "s") +
                  " ready for import."
                : rowValidationErrors.length +
                  " validation error" +
                  (rowValidationErrors.length === 1
                    ? ""
                    : "s") +
                  " found."}
            </strong>
          </div>
        )}

      {rowValidationErrors.length > 0 && (
        <div
          role="alert"
          style={{
            marginTop: "15px",
            padding: "12px",
            border: "1px solid #ef4444",
            borderRadius: "8px",
            backgroundColor: "#fef2f2",
          }}
        >
          <strong>Row validation errors</strong>

          <ul>
            {rowValidationErrors.map((error, index) => (
              <li
                key={error.sourceRowNumber + "-" + index}
              >
                {error.sourceRowNumber
                  ? "Row " + error.sourceRowNumber + ": "
                  : ""}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedFile && !validationError && (
        <div style={{ marginTop: "20px" }}>
          <h3>Normalized Preview</h3>

          {normalizedRows.length === 0 ? (
            <p>
              No player data rows found in the selected
              worksheet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                border="1"
                width="100%"
                cellPadding="6"
                style={{
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Player Name</th>
                    <th>Date of Birth</th>
                    <th>Parent Name</th>
                    <th>Parent Phone</th>
                    <th>Center</th>
                    <th>Batch</th>
                    <th>Gender</th>
                    <th>Date of joining</th>
                    <th>Parent Email Address</th>
                  </tr>
                </thead>

                <tbody>
                  {normalizedRows.map((row) => (
                    <tr
                      key={
                        row.sourceRowNumber +
                        "-" +
                        row.playerName
                      }
                    >
                      <td>{row.sourceRowNumber}</td>
                      <td>{row.playerName}</td>
                      <td>{row.dateOfBirth}</td>
                      <td>{row.parentName}</td>
                      <td>{row.parentPhone}</td>
                      <td>{row.center}</td>
                      <td>{row.batch}</td>
                      <td>{row.gender}</td>
                      <td>{row.joiningDate}</td>
                      <td>{row.parentEmail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default PlayerImport;
