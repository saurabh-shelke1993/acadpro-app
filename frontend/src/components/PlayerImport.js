import { useState } from "react";
import * as XLSX from "xlsx";

import {
  parsePlayerImportWorkbook,
} from "../utils/playerImportParser";

import {
  downloadPlayerImportTemplate,
} from "../utils/playerImportTemplate";

function PlayerImport() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [worksheetNames, setWorksheetNames] = useState([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState("");
  const [validationError, setValidationError] = useState("");
  const [normalizedRows, setNormalizedRows] = useState([]);
  const [fileName, setFileName] = useState("");

  const resetImportState = () => {
    setSelectedFile(null);
    setWorksheetNames([]);
    setSelectedWorksheet("");
    setValidationError("");
    setNormalizedRows([]);
    setFileName("");
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    setValidationError("");
    setNormalizedRows([]);

    if (!file) {
      resetImportState();
      return;
    }

    const lowerFileName = String(file.name || "").toLowerCase();

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

      setNormalizedRows(result.rows || []);
    } catch (error) {
      setSelectedFile(file);
      setFileName(file.name);
      setWorksheetNames([]);
      setSelectedWorksheet("");
      setNormalizedRows([]);
      setValidationError(
        error?.message || "Unable to read the Excel file."
      );
    }
  };

  const handleWorksheetChange = async (event) => {
    const worksheetName = event.target.value;

    setSelectedWorksheet(worksheetName);
    setValidationError("");
    setNormalizedRows([]);

    if (!selectedFile || !worksheetName) {
      return;
    }

    try {
      const result = await parsePlayerImportWorkbook(
        selectedFile,
        worksheetName
      );

      setNormalizedRows(result.rows || []);
    } catch (error) {
      setValidationError(
        error?.message || "Unable to validate the selected worksheet."
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
        Download the template, prepare the player data, then upload the
        completed Excel file for validation and preview.
      </p>

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

      {selectedFile && !validationError && (
        <div style={{ marginTop: "20px" }}>
          <h3>Normalized Preview</h3>

          {normalizedRows.length === 0 ? (
            <p>No player data rows found in the selected worksheet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                border="1"
                width="100%"
                cellPadding="6"
                style={{ borderCollapse: "collapse" }}
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
                    <tr key={`${row.sourceRowNumber}-${row.playerName}`}>
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
