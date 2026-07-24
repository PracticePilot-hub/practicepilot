"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type TrialBalanceLine = {
  id?: string;
  account_code: string | null;
  account_name: string;
  account_type: string | null;

  debit: number;
  credit: number;

  source_balance?: number | null;
  manual_adjustment?: number | null;
  adjustments?: number | null;
  reclassifications?: number | null;
  final_balance?: number | null;

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

type TrialBalanceHistoryLine = {
  id?: string;
  financial_year_end: string;
  account_code: string;
  account_name: string;
  closing_balance: number;
  mapping_code?: string | null;
  mapping_label?: string | null;
  mapping_statement?: string | null;
  mapping_section?: string | null;
  mapping_path?: string | null;
  mapping_leaf_id?: string | null;
  lead_schedule_number?: string | null;
  lead_schedule_key?: string | null;
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

type AmountLayout = "Single signed amount column" | "Debit and credit columns";

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
  const [amountLayout, setAmountLayout] =
    useState<AmountLayout>("Single signed amount column");
  const [sourceBalanceColumn, setSourceBalanceColumn] = useState(3);
  const [debitColumn, setDebitColumn] = useState(3);
  const [creditColumn, setCreditColumn] = useState(4);
  const [priorYearColumn, setPriorYearColumn] = useState(2);
  const [closingBalancePeriod, setClosingBalancePeriod] = useState(12);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newCurrentYearBalance, setNewCurrentYearBalance] = useState("");
  const [newPriorYearBalance, setNewPriorYearBalance] = useState("");

  const [viewMode, setViewMode] = useState<"current" | "history">("current");
  const [historyLines, setHistoryLines] = useState<TrialBalanceHistoryLine[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [periodColumns, setPeriodColumns] = useState<number[]>([
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
  ]);

  const activeLines = previewLines.length > 0 ? previewLines : trialBalanceLines;

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!engagementId) return;

      setHistoryLoading(true);
      setHistoryError("");

      try {
        const response = await fetch(`/api/afs/engagements/${engagementId}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load trial balance history.");
        }

        if (cancelled) return;

        const nextHistory =
          data.trialBalanceHistory ||
          data.trial_balance_history ||
          [];

        setHistoryLines(nextHistory);
      } catch (error: any) {
        if (!cancelled) {
          setHistoryError(
            error.message || "Failed to load trial balance history."
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  const historyYears = useMemo(
    () =>
      Array.from(
        new Set(
          historyLines
            .map((line) => String(line.financial_year_end || "").slice(0, 4))
            .filter(Boolean)
        )
      )
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 4),
    [historyLines]
  );

  const historyTableRows = useMemo(() => {
    const byAccount = new Map<
      string,
      {
        accountCode: string;
        accountName: string;
        mappingCode: string;
        mappingLabel: string;
        leadSchedule: string;
        balances: Record<string, number>;
        chosenDates: Record<string, string>;
      }
    >();

    historyLines.forEach((line) => {
      const year = String(line.financial_year_end || "").slice(0, 4);
      const accountCode = String(line.account_code || "").trim();

      if (!year || !accountCode || !historyYears.includes(year)) return;

      if (!byAccount.has(accountCode)) {
        byAccount.set(accountCode, {
          accountCode,
          accountName: String(line.account_name || ""),
          mappingCode: String(line.mapping_code || ""),
          mappingLabel: String(line.mapping_label || ""),
          leadSchedule: String(
            line.lead_schedule_number || line.lead_schedule_key || ""
          ),
          balances: {},
          chosenDates: {},
        });
      }

      const row = byAccount.get(accountCode);
      if (!row) return;

      const sourceDate = String(line.financial_year_end || "");
      const existingDate = row.chosenDates[year] || "";

      /*
        A leap-year rollover may temporarily leave both 2024-02-28 and
        2024-02-29 history rows. For display, use the later valid year-end.
      */
      if (!existingDate || sourceDate > existingDate) {
        row.balances[year] = Number(line.closing_balance || 0);
        row.chosenDates[year] = sourceDate;
        row.accountName = String(line.account_name || row.accountName);
        row.mappingCode = String(line.mapping_code || row.mappingCode);
        row.mappingLabel = String(line.mapping_label || row.mappingLabel);
        row.leadSchedule = String(
          line.lead_schedule_number ||
            line.lead_schedule_key ||
            row.leadSchedule
        );
      }
    });

    return Array.from(byAccount.values()).sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true })
    );
  }, [historyLines, historyYears]);

  const historyTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    historyYears.forEach((year) => {
      totals[year] = historyTableRows.reduce(
        (sum, row) => sum + Number(row.balances[year] || 0),
        0
      );
    });

    return totals;
  }, [historyTableRows, historyYears]);

  const totalSourceBalance = activeLines.reduce(
    (sum, line) => sum + getSourceBalance(line),
    0
  );

  const totalPriorYear = activeLines.reduce(
    (sum, line) => sum + Number(line.prior_year_balance ?? line.credit ?? 0),
    0
  );

  const totalManualAdjustments = activeLines.reduce(
    (sum, line) => sum + getManualAdjustment(line),
    0
  );

  const totalJournalAdjustments = activeLines.reduce(
    (sum, line) => sum + getJournalAdjustment(line),
    0
  );

  const totalReclassifications = activeLines.reduce(
    (sum, line) => sum + getReclassification(line),
    0
  );

  const totalFinalBalance = activeLines.reduce(
    (sum, line) => sum + getFinalBalance(line),
    0
  );

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
      setAmountLayout("Single signed amount column");
      setSourceBalanceColumn(3);
      setDebitColumn(3);
      setCreditColumn(4);
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
      currentYearBalance =
        amountLayout === "Debit and credit columns"
          ? numberOrZero(getCell(row, debitColumn)) -
            numberOrZero(getCell(row, creditColumn))
          : numberOrZero(getCell(row, sourceBalanceColumn));

      priorYearBalance = numberOrZero(getCell(row, priorYearColumn));
    }

    if (importMode === "Current year only") {
      currentYearBalance =
        amountLayout === "Debit and credit columns"
          ? numberOrZero(getCell(row, debitColumn)) -
            numberOrZero(getCell(row, creditColumn))
          : numberOrZero(getCell(row, sourceBalanceColumn));

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

      source_balance: currentYearBalance,
      manual_adjustment: 0,
      adjustments: 0,
      reclassifications: 0,
      final_balance: currentYearBalance,

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
      amount_layout:
        importMode === "Current and prior year final balances" ||
        importMode === "Current year only"
          ? amountLayout
          : importMode,

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

  async function saveManualAdjustment(line: TrialBalanceLine, value: string) {
    const manualAdjustment = numberOrZero(value);
    const lineId = line.id || null;

    if (!lineId) {
      alert("This line must be imported before you can save manual adjustments.");
      return;
    }

    setSavingLineId(lineId);

    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}/trial-balance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: lineId,
          manual_adjustment: manualAdjustment,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save manual adjustment.");
      }

      const updatedLine = data.line as TrialBalanceLine;

      onImported(
        trialBalanceLines.map((existing) =>
          existing.id === lineId ? { ...existing, ...updatedLine } : existing
        )
      );
    } catch (error: any) {
      alert(error.message || "Failed to save manual adjustment.");
    } finally {
      setSavingLineId(null);
    }
  }

  async function saveAccountName(line: TrialBalanceLine, value: string) {
    const nextAccountName = String(value || "").trim();
    const currentAccountName = String(line.account_name || "").trim();
    const lineId = line.id || null;

    if (previewLines.length > 0) return;
    if (!nextAccountName || nextAccountName === currentAccountName) return;

    if (!lineId) {
      alert("This line must be imported before you can edit the account name.");
      return;
    }

    setSavingLineId(lineId);

    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}/trial-balance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: lineId,
          account_name: nextAccountName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save account name.");
      }

      const updatedLine = data.line as TrialBalanceLine;

      onImported(
        trialBalanceLines.map((existing) =>
          existing.id === lineId ? { ...existing, ...updatedLine } : existing
        )
      );
    } catch (error: any) {
      alert(error.message || "Failed to save account name.");
    } finally {
      setSavingLineId(null);
    }
  }

  function resetAddAccountForm() {
    setNewAccountCode("");
    setNewAccountName("");
    setNewCurrentYearBalance("");
    setNewPriorYearBalance("");
  }

  function closeAddAccount() {
    if (creatingAccount) return;

    resetAddAccountForm();
    setShowAddAccount(false);
  }

  async function createAccount() {
    const accountCode = String(newAccountCode || "").trim();
    const accountName = String(newAccountName || "").trim();

    if (!accountCode || !accountName) {
      alert("Account code and account name are required.");
      return;
    }

    setCreatingAccount(true);

    try {
      const res = await fetch(
        `/api/afs/engagements/${engagementId}/journal-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountCode,
            accountName,
            currentYearBalance: numberOrZero(newCurrentYearBalance),
            priorYearBalance: numberOrZero(newPriorYearBalance),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create trial balance account.");
      }

      const createdLine = data.line as TrialBalanceLine;

      const nextLines = [...trialBalanceLines, createdLine].sort((a, b) =>
        String(a.account_code || "").localeCompare(
          String(b.account_code || ""),
          undefined,
          { numeric: true }
        )
      );

      onImported(nextLines);
      resetAddAccountForm();
      setShowAddAccount(false);
    } catch (error: any) {
      alert(error.message || "Failed to create trial balance account.");
    } finally {
      setCreatingAccount(false);
    }
  }

  const columnOptions = getColumnOptions(rawRows);

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>AFS Trial Balance</h3>
          <p style={styles.text}>
            Import and review the balances used for the annual financial statements. Imported balances stay locked; manual adjustments and journals build the final AFS balance.
          </p>
          {fileName && <p style={styles.fileName}>Selected file: {fileName}</p>}
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            style={
              viewMode === "current"
                ? styles.viewButtonActive
                : styles.viewButton
            }
            onClick={() => setViewMode("current")}
          >
            Current TB
          </button>

          <button
            type="button"
            style={
              viewMode === "history"
                ? styles.viewButtonActive
                : styles.viewButton
            }
            onClick={() => setViewMode("history")}
          >
            TB History
          </button>

          {viewMode === "current" ? (
            <>
              <button
                type="button"
                style={styles.addAccountButton}
                onClick={() => setShowAddAccount(true)}
                disabled={previewLines.length > 0}
                title={
                  previewLines.length > 0
                    ? "Finish or clear the import preview before adding an account."
                    : "Add a new account directly to this trial balance."
                }
              >
                Add Account
              </button>

              <label style={styles.fileButton}>
                Choose Excel file
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
            </>
          ) : (
            <div style={styles.historyYearsLabel}>
              {historyYears.length > 0
                ? `${historyYears.length} historical year${
                    historyYears.length === 1 ? "" : "s"
                  }`
                : "No history available"}
            </div>
          )}

          {viewMode === "current" && previewLines.length > 0 && (
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

      {viewMode === "current" ? (
  <div style={styles.summaryGrid}>
    <Summary label="Imported Balance" value={formatMoney(totalSourceBalance)} />
    <Summary label="Manual Adj." value={formatMoney(totalManualAdjustments)} />
    <Summary label="Journal Adj." value={formatMoney(totalJournalAdjustments)} />
    <Summary label="Final AFS Balance" value={formatMoney(totalFinalBalance)} />
    <Summary label="Prior Year" value={formatMoney(totalPriorYear)} />
    <Summary label="Lines" value={String(activeLines.length)} />
  </div>
) : null}

      {viewMode === "current" && previewLines.length > 0 && (
        <div style={styles.previewBanner}>
          Preview mode — review the lines below, then click Confirm import.
        </div>
      )}

      {viewMode === "history" ? (
        historyLoading ? (
          <p style={styles.emptyText}>Loading trial balance history...</p>
        ) : historyError ? (
          <div style={styles.errorBanner}>{historyError}</div>
        ) : historyTableRows.length === 0 ? (
          <p style={styles.emptyText}>
            No historical trial balance rows are stored for this engagement yet.
          </p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Account</th>
                  <th style={styles.th}>Description</th>
                  {historyYears.map((year) => (
                    <th key={year} style={styles.thRight}>
                      {year}
                    </th>
                  ))}
                  <th style={styles.th}>Mapping</th>
                  <th style={styles.th}>Lead sheet</th>
                </tr>
              </thead>
              <tbody>
                {historyTableRows.map((row) => (
                  <tr key={row.accountCode}>
                    <td style={styles.td}>{row.accountCode}</td>
                    <td style={styles.td}>{row.accountName}</td>
                    {historyYears.map((year) => (
                      <td key={year} style={styles.tdRight}>
                        {formatMoney(Number(row.balances[year] || 0))}
                      </td>
                    ))}
                    <td style={styles.td}>
                      {row.mappingCode
                        ? `${row.mappingCode} · ${row.mappingLabel}`
                        : row.mappingLabel}
                    </td>
                    <td style={styles.td}>{row.leadSchedule}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={styles.totalCell} colSpan={2}>
                    Totals
                  </td>
                  {historyYears.map((year) => (
                    <td key={year} style={styles.totalRight}>
                      {formatMoney(historyTotals[year] || 0)}
                    </td>
                  ))}
                  <td style={styles.totalCell} colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : activeLines.length === 0 ? (
        <p style={styles.emptyText}>No trial balance imported yet.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Account</th>
                <th style={styles.th}>Description</th>
                <th style={styles.thRight}>Imported Balance</th>
                <th style={styles.thRight}>Manual Adj.</th>
                <th style={styles.thRight}>Journal Adj.</th>
                <th style={styles.thRight}>Reclassification</th>
                <th style={styles.thRight}>Final AFS Balance</th>
                <th style={styles.thRight}>Prior Year</th>
                <th style={styles.th}>Mapping</th>
              </tr>
            </thead>

            <tbody>
              {activeLines.map((line, index) => {
                const sourceBalance = getSourceBalance(line);
                const manualAdjustment = getManualAdjustment(line);
                const journalAdjustment = getJournalAdjustment(line);
                const reclassifications = getReclassification(line);
                const finalBalance = getFinalBalance(line);
                const priorYear = Number(line.prior_year_balance ?? line.credit ?? 0);

                return (
                  <tr key={line.id || index}>
                    <td style={styles.td}>{line.account_code || ""}</td>
                    <td style={styles.td}>
                      <input
                        style={styles.accountNameInput}
                        defaultValue={line.account_name || ""}
                        disabled={previewLines.length > 0 || savingLineId === line.id}
                        onBlur={(event) => saveAccountName(line, event.target.value)}
                      />
                    </td>
                    <td style={styles.tdRight}>{formatMoney(sourceBalance)}</td>
                    <td style={styles.tdRight}>
                      <input
                        style={styles.amountInput}
                        defaultValue={formatPlainNumber(manualAdjustment)}
                        disabled={previewLines.length > 0 || savingLineId === line.id}
                        onBlur={(event) => saveManualAdjustment(line, event.target.value)}
                      />
                    </td>
                    <td style={styles.tdRight}>{formatMoney(journalAdjustment)}</td>
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
                <td style={styles.totalRight}>{formatMoney(totalManualAdjustments)}</td>
                <td style={styles.totalRight}>{formatMoney(totalJournalAdjustments)}</td>
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

      {viewMode === "current" && showAddAccount && (
        <div style={styles.modalOverlay}>
          <div style={styles.addAccountModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Add Trial Balance Account</h3>
                <p style={styles.text}>
                  Create a new account directly in this engagement without using a journal.
                </p>
              </div>

              <button
                type="button"
                style={styles.closeButton}
                onClick={closeAddAccount}
                disabled={creatingAccount}
              >
                ×
              </button>
            </div>

            <div style={styles.addAccountGrid}>
              <label style={styles.label}>
                Account code
                <input
                  style={styles.input}
                  value={newAccountCode}
                  onChange={(event) => setNewAccountCode(event.target.value)}
                  placeholder="Example: 210-000"
                  disabled={creatingAccount}
                  autoFocus
                />
              </label>

              <label style={styles.label}>
                Account name
                <input
                  style={styles.input}
                  value={newAccountName}
                  onChange={(event) => setNewAccountName(event.target.value)}
                  placeholder="Example: Audit Fees"
                  disabled={creatingAccount}
                />
              </label>

              <label style={styles.label}>
                Current-year balance
                <input
                  style={styles.input}
                  value={newCurrentYearBalance}
                  onChange={(event) =>
                    setNewCurrentYearBalance(event.target.value)
                  }
                  placeholder="0.00"
                  inputMode="decimal"
                  disabled={creatingAccount}
                />
              </label>

              <label style={styles.label}>
                Prior-year balance
                <input
                  style={styles.input}
                  value={newPriorYearBalance}
                  onChange={(event) =>
                    setNewPriorYearBalance(event.target.value)
                  }
                  placeholder="0.00"
                  inputMode="decimal"
                  disabled={creatingAccount}
                />
              </label>
            </div>

            <div style={styles.addAccountNotice}>
              Negative amounts may be entered with a minus sign or in brackets.
              Mapping can be completed afterwards in the Mapping section.
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={closeAddAccount}
                disabled={creatingAccount}
              >
                Cancel
              </button>

              <button
                type="button"
                style={styles.primaryButton}
                onClick={createAccount}
                disabled={creatingAccount}
              >
                {creatingAccount ? "Creating..." : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === "current" && showMapping && (
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

              {(importMode === "Current and prior year final balances" ||
                importMode === "Current year only") && (
                <label style={styles.label}>
                  Amount layout
                  <select
                    style={styles.input}
                    value={amountLayout}
                    onChange={(e) => setAmountLayout(e.target.value as AmountLayout)}
                  >
                    <option value="Single signed amount column">
                      Single signed amount column
                    </option>
                    <option value="Debit and credit columns">
                      Debit and credit columns
                    </option>
                  </select>
                </label>
              )}

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
                importMode === "Current year only") &&
                amountLayout === "Single signed amount column" && (
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

              {(importMode === "Current and prior year final balances" ||
                importMode === "Current year only") &&
                amountLayout === "Debit and credit columns" && (
                  <>
                    <label style={styles.label}>
                      Debit column
                      <select
                        style={styles.input}
                        value={debitColumn}
                        onChange={(e) => setDebitColumn(Number(e.target.value))}
                      >
                        {columnOptions.map((column) => (
                          <option key={column.index} value={column.index}>
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.label}>
                      Credit column
                      <select
                        style={styles.input}
                        value={creditColumn}
                        onChange={(e) => setCreditColumn(Number(e.target.value))}
                      >
                        {columnOptions.map((column) => (
                          <option key={column.index} value={column.index}>
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
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

function getSourceBalance(line: TrialBalanceLine) {
  if (line.source_balance !== undefined && line.source_balance !== null) {
    return Number(line.source_balance || 0);
  }

  return (
    Number(line.opening_balance || 0) +
    Number(line.debit ?? line.current_year_balance ?? 0)
  );
}

function getManualAdjustment(line: TrialBalanceLine) {
  return Number(line.manual_adjustment || 0);
}

function getJournalAdjustment(line: TrialBalanceLine) {
  return Number(line.adjustments || 0);
}

function getReclassification(line: TrialBalanceLine) {
  return Number(line.reclassifications || 0);
}

function getFinalBalance(line: TrialBalanceLine) {
  if (line.final_balance !== undefined && line.final_balance !== null) {
    return Number(line.final_balance || 0);
  }

  return (
    getSourceBalance(line) +
    getManualAdjustment(line) +
    getJournalAdjustment(line) +
    getReclassification(line)
  );
}

function formatPlainNumber(value: number) {
  return String(Number(value || 0).toFixed(2));
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
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
    padding: "14px",
    boxShadow: "none",
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
  viewButton: {
    border: "1px solid #94a3b8",
    borderRadius: "0px",
    padding: "8px 12px",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 800,
    fontSize: "12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  viewButtonActive: {
    border: "1px solid #0f172a",
    borderRadius: "0px",
    padding: "8px 12px",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  historyYearsLabel: {
    border: "1px solid #cbd5e1",
    padding: "8px 10px",
    background: "#f8fafc",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  addAccountButton: {
    border: "1px solid #94a3b8",
    borderRadius: "0px",
    padding: "9px 13px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: "13px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  fileButton: {
    border: "1px solid #1d4ed8",
    borderRadius: "0px",
    padding: "9px 13px",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
    fontSize: "13px",
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
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  summaryCard: {
    border: "1px solid #dbe3ef",
    borderRadius: "0px",
    padding: "10px",
    display: "grid",
    gap: "5px",
    background: "#ffffff",
  },
  historySummaryBar: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    borderTop: "1px solid #cbd5e1",
    borderBottom: "1px solid #cbd5e1",
    marginBottom: "14px",
    background: "#f8fafc",
  },
  historySummaryLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "11px",
    marginBottom: "4px",
  },
  errorBanner: {
    border: "1px solid #dc2626",
    background: "#fef2f2",
    color: "#991b1b",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 700,
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
  amountInput: {
    width: "105px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    padding: "6px 7px",
    fontSize: "12px",
    textAlign: "right",
    background: "#ffffff",
  },
  accountNameInput: {
    width: "100%",
    minWidth: "220px",
    border: "1px solid transparent",
    borderRadius: "6px",
    padding: "6px 8px",
    fontSize: "13px",
    color: "#0f172a",
    background: "transparent",
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
  addAccountModal: {
    width: "min(640px, 100%)",
    background: "white",
    borderRadius: "0px",
    padding: "18px",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
  },
  addAccountGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr",
    gap: "12px",
    marginBottom: "14px",
  },
  addAccountNotice: {
    borderLeft: "3px solid #0891b2",
    background: "#ecfeff",
    color: "#155e75",
    padding: "9px 11px",
    fontSize: "12px",
    lineHeight: 1.4,
    marginBottom: "16px",
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
