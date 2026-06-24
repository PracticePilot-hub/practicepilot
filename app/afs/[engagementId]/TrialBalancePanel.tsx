"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type TrialBalanceLine = {
  id?: string;
  account_code: string | null;
  account_name: string;
  account_type: string | null;

  debit: number;
  credit: number;

 opening_balance?: number | null;
current_year_balance?: number | null;
prior_year_balance?: number | null;

  period_1?: number;
  period_2?: number;
  period_3?: number;
  period_4?: number;
  period_5?: number;
  period_6?: number;
  period_7?: number;
  period_8?: number;
  period_9?: number;
  period_10?: number;
  period_11?: number;
  period_12?: number;

import_basis?: string | null;
amount_layout?: string | null;

  mapping_category: string | null;
  note_number: string | null;
};

type Props = {
  engagementId: string;
  trialBalanceLines: TrialBalanceLine[];
  onImported: (lines: TrialBalanceLine[]) => void;
};

type ColumnOption = {
  index: number;
  label: string;
};

type ImportMode =
  | "Current and prior year final balances"
  | "Current year only"
  | "Opening balance + monthly movements"
  | "Monthly closing balances";

export default function TrialBalancePanel({
  engagementId,
  trialBalanceLines,
  onImported,
}: Props) {
  const [previewLines, setPreviewLines] = useState<TrialBalanceLine[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [showMapping, setShowMapping] = useState(false);

  const [startRowIndex, setStartRowIndex] = useState(0);
  const [importMode, setImportMode] =
    useState<ImportMode>("Current and prior year final balances");

  const [codeColumn, setCodeColumn] = useState(0);
  const [nameColumn, setNameColumn] = useState(1);

  const [openingColumn, setOpeningColumn] = useState(2);
  const [sourceBalanceColumn, setSourceBalanceColumn] = useState(3);
  const [priorYearColumn, setPriorYearColumn] = useState(2);
  const [closingBalancePeriod, setClosingBalancePeriod] = useState(12);

  const [periodColumns, setPeriodColumns] = useState<number[]>([
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
  ]);

  const activeLines = previewLines.length > 0 ? previewLines : trialBalanceLines;

  const totalSourceBalance = activeLines.reduce(
    (sum, line) =>
      sum +
      Number(line.opening_balance || 0) +
      Number(line.current_year_balance ?? line.debit ?? 0),
    0
  );

  const totalPriorYear = activeLines.reduce(
    (sum, line) => sum + Number(line.prior_year_balance ?? line.credit ?? 0),
    0
  );

  const totalAdjustments = 0;
  const totalReclassifications = 0;
  const totalFinalBalance =
    totalSourceBalance + totalAdjustments + totalReclassifications;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        alert("No sheets were found in this Excel file.");
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: "",
      });

      const cleanedRows = rows.filter((row) =>
        row.some((cell) => String(cell || "").trim() !== "")
      );

      if (cleanedRows.length === 0) {
        alert("No data was found in this Excel file.");
        return;
      }

      setRawRows(cleanedRows);
      setStartRowIndex(0);
      setCodeColumn(0);
      setNameColumn(1);
      setOpeningColumn(2);
      setSourceBalanceColumn(3);
      setPriorYearColumn(2);
      setClosingBalancePeriod(12);
      setPreviewLines([]);
      setShowMapping(true);
    } catch (error: any) {
      alert(error.message || "Failed to read Excel file.");
    } finally {
      e.target.value = "";
    }
  }

  function applyColumnMapping() {
    const lines = rawRows
      .slice(startRowIndex)
      .map((row) => buildLine(row))
      .filter((line) => line.account_name);

    if (lines.length === 0) {
      alert("No valid trial balance lines were found from the selected columns.");
      return;
    }

    setPreviewLines(lines);
    setShowMapping(false);
  }

  function buildLine(row: any[]): TrialBalanceLine {
    const accountCode = getCell(row, codeColumn);
    const accountName = getCell(row, nameColumn);

    let openingBalance = 0;
    let currentYearBalance = 0;
    let priorYearBalance = 0;

    const periods = Array.from({ length: 12 }).map(() => 0);

    if (importMode === "Current and prior year final balances") {
      currentYearBalance = numberOrZero(getCell(row, sourceBalanceColumn));
      priorYearBalance = numberOrZero(getCell(row, priorYearColumn));
    }

    if (importMode === "Current year only") {
      currentYearBalance = numberOrZero(getCell(row, sourceBalanceColumn));
      priorYearBalance = 0;
    }

    if (importMode === "Opening balance + monthly movements") {
      openingBalance = numberOrZero(getCell(row, openingColumn));

      periodColumns.forEach((columnIndex, index) => {
        periods[index] = numberOrZero(getCell(row, columnIndex));
      });

      currentYearBalance = periods.reduce((sum, value) => sum + value, 0);
    }

    if (importMode === "Monthly closing balances") {
      periodColumns.forEach((columnIndex, index) => {
        periods[index] = numberOrZero(getCell(row, columnIndex));
      });

      currentYearBalance = periods[closingBalancePeriod - 1] || 0;
    }

    return {
      account_code: accountCode || null,
      account_name: accountName,
      account_type: null,

      debit: currentYearBalance,
      credit: priorYearBalance,

      opening_balance: openingBalance,
      current_year_balance: currentYearBalance,
      prior_year_balance: priorYearBalance,

      period_1: periods[0],
      period_2: periods[1],
      period_3: periods[2],
      period_4: periods[3],
      period_5: periods[4],
      period_6: periods[5],
      period_7: periods[6],
      period_8: periods[7],
      period_9: periods[8],
      period_10: periods[9],
      period_11: periods[10],
      period_12: periods[11],

      import_basis:
        importMode === "Opening balance + monthly movements" ||
        importMode === "Monthly closing balances"
          ? "Monthly"
          : "Yearly",
      amount_layout: importMode,

      mapping_category: null,
      note_number: null,
    };
  }

  async function confirmImport() {
    if (previewLines.length === 0) {
      alert("Import and map an Excel trial balance first.");
      return;
    }

    const confirmed = confirm(
      "This will replace the current trial balance for this AFS engagement. Continue?"
    );

    if (!confirmed) return;

    setImporting(true);

    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}/trial-balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lines: previewLines }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to import trial balance.");
      }

      onImported(data.lines || []);
      setPreviewLines([]);
      setRawRows([]);
      setFileName("");
      alert("Trial balance imported.");
    } catch (error: any) {
      alert(error.message || "Failed to import trial balance.");
    } finally {
      setImporting(false);
    }
  }

  function clearPreview() {
    setPreviewLines([]);
    setRawRows([]);
    setFileName("");
    setShowMapping(false);
  }

  function updatePeriodColumn(index: number, value: number) {
    setPeriodColumns((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  const columnOptions = getColumnOptions(rawRows);

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Trial Balance</h3>
          <p style={styles.text}>
            Import the trial balance from Excel, choose the start row, map the
            columns, preview the result, then confirm the import.
          </p>
          {fileName && <p style={styles.fileName}>Selected file: {fileName}</p>}
        </div>

        <div style={styles.actions}>
          <label style={styles.fileButton}>
            Choose Excel file
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>

          {previewLines.length > 0 && (
            <>
              <button style={styles.secondaryButton} onClick={clearPreview}>
                Clear preview
              </button>

              <button
                style={styles.primaryButton}
                onClick={confirmImport}
                disabled={importing}
              >
                {importing ? "Importing..." : "Confirm import"}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <Summary label="Source Balance" value={formatMoney(totalSourceBalance)} />
        <Summary label="Adjustments" value={formatMoney(totalAdjustments)} />
        <Summary label="Final Balance" value={formatMoney(totalFinalBalance)} />
        <Summary label="Prior Year" value={formatMoney(totalPriorYear)} />
        <Summary label="Lines" value={String(activeLines.length)} />
      </div>

      {previewLines.length > 0 && (
        <div style={styles.previewBanner}>
          Preview mode — review the lines below, then click Confirm import.
        </div>
      )}

      {activeLines.length === 0 ? (
        <p style={styles.emptyText}>No trial balance imported yet.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Account</th>
                <th style={styles.th}>Description</th>
                <th style={styles.thRight}>Source Balance</th>
                <th style={styles.thRight}>Adjustments</th>
                <th style={styles.thRight}>Reclassifications</th>
                <th style={styles.thRight}>Final Balance</th>
                <th style={styles.thRight}>Prior Year</th>
                <th style={styles.th}>Mapping</th>
              </tr>
            </thead>

            <tbody>
              {activeLines.map((line, index) => {
                const opening = Number(line.opening_balance || 0);
                const currentYearBalance = Number(
                  line.current_year_balance ?? line.debit ?? 0
                );
                const sourceBalance = opening + currentYearBalance;
                const adjustments = 0;
                const reclassifications = 0;
                const finalBalance =
                  sourceBalance + adjustments + reclassifications;
                const priorYear = Number(line.prior_year_balance ?? line.credit ?? 0);

                return (
                  <tr key={line.id || index}>
                    <td style={styles.td}>{line.account_code || ""}</td>
                    <td style={styles.td}>{line.account_name}</td>
                    <td style={styles.tdRight}>{formatMoney(sourceBalance)}</td>
                    <td style={styles.tdRight}>{formatMoney(adjustments)}</td>
                    <td style={styles.tdRight}>{formatMoney(reclassifications)}</td>
                    <td style={styles.tdRightBold}>{formatMoney(finalBalance)}</td>
                    <td style={styles.tdRight}>{formatMoney(priorYear)}</td>
                    <td style={styles.td}>{line.mapping_category || ""}</td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr>
                <td style={styles.totalCell} colSpan={2}>
                  Totals
                </td>
                <td style={styles.totalRight}>
                  {formatMoney(totalSourceBalance)}
                </td>
                <td style={styles.totalRight}>{formatMoney(totalAdjustments)}</td>
                <td style={styles.totalRight}>
                  {formatMoney(totalReclassifications)}
                </td>
                <td style={styles.totalRight}>{formatMoney(totalFinalBalance)}</td>
                <td style={styles.totalRight}>{formatMoney(totalPriorYear)}</td>
                <td style={styles.totalCell}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showMapping && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Import Trial Balance</h3>
                <p style={styles.text}>
                  Select the first row to import, then map the Excel columns.
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setShowMapping(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.mappingGrid}>
              <label style={styles.label}>
                Start importing from row
                <select
                  style={styles.input}
                  value={startRowIndex}
                  onChange={(e) => setStartRowIndex(Number(e.target.value))}
                >
                  {rawRows.slice(0, 30).map((row, index) => (
                    <option key={index} value={index}>
                      Row {index + 1}: {row.slice(0, 5).join(" | ")}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Import type
                <select
                  style={styles.input}
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as ImportMode)}
                >
                  <option value="Current and prior year final balances">
                    Current and prior year final balances
                  </option>
                  <option value="Current year only">Current year only</option>
                  <option value="Opening balance + monthly movements">
                    Opening balance + monthly movements
                  </option>
                  <option value="Monthly closing balances">
                    Monthly closing balances
                  </option>
                </select>
              </label>

              <label style={styles.label}>
                Account number column
                <select
                  style={styles.input}
                  value={codeColumn}
                  onChange={(e) => setCodeColumn(Number(e.target.value))}
                >
                  {columnOptions.map((column) => (
                    <option key={column.index} value={column.index}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Account description column
                <select
                  style={styles.input}
                  value={nameColumn}
                  onChange={(e) => setNameColumn(Number(e.target.value))}
                >
                  {columnOptions.map((column) => (
                    <option key={column.index} value={column.index}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>

              {(importMode === "Current and prior year final balances" ||
                importMode === "Current year only") && (
                <label style={styles.label}>
                  Source balance column
                  <select
                    style={styles.input}
                    value={sourceBalanceColumn}
                    onChange={(e) =>
                      setSourceBalanceColumn(Number(e.target.value))
                    }
                  >
                    {columnOptions.map((column) => (
                      <option key={column.index} value={column.index}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {importMode === "Current and prior year final balances" && (
                <label style={styles.label}>
                  Prior year column
                  <select
                    style={styles.input}
                    value={priorYearColumn}
                    onChange={(e) => setPriorYearColumn(Number(e.target.value))}
                  >
                    {columnOptions.map((column) => (
                      <option key={column.index} value={column.index}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {importMode === "Opening balance + monthly movements" && (
                <label style={styles.label}>
                  Opening balance column
                  <select
                    style={styles.input}
                    value={openingColumn}
                    onChange={(e) => setOpeningColumn(Number(e.target.value))}
                  >
                    {columnOptions.map((column) => (
                      <option key={column.index} value={column.index}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {importMode === "Monthly closing balances" && (
                <label style={styles.label}>
                  Final balance month
                  <select
                    style={styles.input}
                    value={closingBalancePeriod}
                    onChange={(e) =>
                      setClosingBalancePeriod(Number(e.target.value))
                    }
                  >
                    {Array.from({ length: 12 }).map((_, index) => (
                      <option key={index + 1} value={index + 1}>
                        Period {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {(importMode === "Opening balance + monthly movements" ||
              importMode === "Monthly closing balances") && (
              <div style={styles.monthGrid}>
                {periodColumns.map((column, index) => (
                  <label key={index} style={styles.label}>
                    Period {index + 1}
                    <select
                      style={styles.input}
                      value={column}
                      onChange={(e) =>
                        updatePeriodColumn(index, Number(e.target.value))
                      }
                    >
                      {columnOptions.map((option) => (
                        <option key={option.index} value={option.index}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            <div style={styles.sampleBox}>
              <strong>Sample rows</strong>

              <div style={styles.sampleTableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {columnOptions.slice(0, 10).map((column) => (
                        <th key={column.index} style={styles.th}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rawRows
                      .slice(startRowIndex, startRowIndex + 8)
                      .map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {columnOptions.slice(0, 10).map((column) => (
                            <td key={column.index} style={styles.td}>
                              {String(row[column.index] || "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.secondaryButton}
                onClick={() => setShowMapping(false)}
              >
                Cancel
              </button>

              <button style={styles.primaryButton} onClick={applyColumnMapping}>
                Apply mapping and preview
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getColumnOptions(rows: any[][]): ColumnOption[] {
  const maxColumns = Math.max(...rows.slice(0, 20).map((row) => row.length), 0);

  return Array.from({ length: maxColumns }).map((_, index) => {
    const letter = columnLetter(index);

    return {
      index,
      label: letter,
    };
  });
}

function columnLetter(index: number) {
  let letter = "";
  let number = index + 1;

  while (number > 0) {
    const remainder = (number - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    number = Math.floor((number - 1) / 26);
  }

  return letter;
}

function getCell(row: any[], index: number) {
  if (index < 0) return "";
  return String(row[index] || "").trim();
}

function numberOrZero(value: any) {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[Rr]/g, "")
    .replace(/\((.*?)\)/, "-$1");

  const numberValue = Number(cleaned);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value || 0));
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "white",
    border: "1px solid #dbe3ef",
    borderRadius: "16px",
    padding: "18px",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
  },
  text: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  fileName: {
    margin: "8px 0 0",
    color: "#2563eb",
    fontSize: "13px",
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  fileButton: {
    border: "none",
    borderRadius: "12px",
    padding: "10px 14px",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "10px 14px",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "10px 14px",
    background: "white",
    color: "#111827",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  summaryCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
    display: "grid",
    gap: "5px",
  },
  previewBanner: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "14px",
  },
  emptyText: {
    color: "#64748b",
    fontSize: "14px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px",
    fontSize: "12px",
    color: "#64748b",
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px",
    fontSize: "12px",
    color: "#64748b",
    whiteSpace: "nowrap",
  },
  td: {
    borderBottom: "1px solid #f3f4f6",
    padding: "10px",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  tdRight: {
    borderBottom: "1px solid #f3f4f6",
    padding: "10px",
    fontSize: "13px",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  tdRightBold: {
    borderBottom: "1px solid #f3f4f6",
    padding: "10px",
    fontSize: "13px",
    textAlign: "right",
    whiteSpace: "nowrap",
    fontWeight: 900,
  },
  totalCell: {
    borderTop: "2px solid #111827",
    padding: "10px",
    fontSize: "13px",
    fontWeight: 900,
    background: "#f8fafc",
  },
  totalRight: {
    borderTop: "2px solid #111827",
    padding: "10px",
    fontSize: "13px",
    textAlign: "right",
    fontWeight: 900,
    background: "#f8fafc",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "24px",
  },
  modal: {
    width: "min(1050px, 100%)",
    maxHeight: "90vh",
    overflow: "auto",
    background: "white",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
    marginBottom: "16px",
  },
  modalTitle: {
    margin: 0,
    fontSize: "20px",
  },
  closeButton: {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: "10px",
    width: "36px",
    height: "36px",
    cursor: "pointer",
    fontSize: "22px",
    lineHeight: "1",
  },
  mappingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  monthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "16px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "12px",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "10px 11px",
    fontSize: "13px",
    outline: "none",
    color: "#111827",
    background: "white",
    boxSizing: "border-box",
  },
  sampleBox: {
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "12px",
    marginBottom: "16px",
  },
  sampleTableWrap: {
    marginTop: "10px",
    overflowX: "auto",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
};