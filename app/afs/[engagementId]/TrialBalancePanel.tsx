"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { getAfsMappingForImport } from "./MappingPanel";
import { historicalMappingColumn, historicalMappingCode } from "./historicalTbImport";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

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
  mapping_leaf_id?: string | null;
  mapping_label?: string | null;
  mapping_statement?: string | null;
  mapping_section?: string | null;
  mapping_path?: string | null;
  mapping_smart_rule?: string | null;
  mapping_confidence?: string | null;
  mapping_code?: string | null;
  lead_schedule_number?: string | null;
  lead_schedule_key?: string | null;
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
  | "Final TB — current and prior year"
  | "Opening balance + annual movement"
  | "Rolled-over figures + current-year final TB"
  | "Rolled-over figures + annual movement"
  | "Current-year final TB only";

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
    useState<ImportMode>("Final TB — current and prior year");

  const [codeColumn, setCodeColumn] = useState(0);
  const [nameColumn, setNameColumn] = useState(1);

  const [openingColumn, setOpeningColumn] = useState(2);
  const [annualMovementColumn, setAnnualMovementColumn] = useState(3);
  const [amountLayout, setAmountLayout] =
    useState<AmountLayout>("Single signed amount column");
  const [sourceBalanceColumn, setSourceBalanceColumn] = useState(3);
  const [debitColumn, setDebitColumn] = useState(3);
  const [creditColumn, setCreditColumn] = useState(4);
  const [priorYearColumn, setPriorYearColumn] = useState(2);
  const [importMappingColumn, setImportMappingColumn] = useState(-1);
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
  const [historyImportYear, setHistoryImportYear] = useState("2024-02-29");
  const [historyPreview, setHistoryPreview] = useState<Array<{
    account_code: string; account_name: string; closing_balance: number;
    mapping_code: string; mapping_label: string; mapping_statement: string;
    mapping_section: string; mapping_path: string; mapping_leaf_id: string;
    lead_schedule_number: string; lead_schedule_key: string;
  }>>([]);
  const [historyImportName, setHistoryImportName] = useState("");
  const [historySheetNames, setHistorySheetNames] = useState<string[]>([]);
  const [historyWorkbookRows, setHistoryWorkbookRows] = useState<Record<string, any[][]>>({});
  const [historySheetName, setHistorySheetName] = useState("");
  const [historyStartRow, setHistoryStartRow] = useState(1);
  const [historyCodeColumn, setHistoryCodeColumn] = useState(0);
  const [historyNameColumn, setHistoryNameColumn] = useState(1);
  const [historyAmountColumn, setHistoryAmountColumn] = useState(2);
  const [historyMappingColumn, setHistoryMappingColumn] = useState(-1);
  const [historyMappingDialog, setHistoryMappingDialog] = useState(false);
  const [historySaving, setHistorySaving] = useState(false);

  const [manualAdjustmentsEnabled, setManualAdjustmentsEnabled] = useState(false);
  const [manualAdjustmentsLoading, setManualAdjustmentsLoading] = useState(true);

  const activeLines = previewLines.length > 0 ? previewLines : trialBalanceLines;

  useEffect(() => {
    let cancelled = false;

    async function loadManualAdjustmentSetting() {
      if (!engagementId || !supabase) {
        setManualAdjustmentsLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const token = session?.access_token || "";

        if (!token) {
          setManualAdjustmentsEnabled(false);
          return;
        }

        const response = await fetch("/api/afs/settings/manual-adjustments", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load manual adjustment setting.");
        }

        if (!cancelled) {
          setManualAdjustmentsEnabled(Boolean(data.enabled));
        }
      } catch (error) {
        console.error("Failed to load manual adjustment setting", error);
        if (!cancelled) {
          setManualAdjustmentsEnabled(false);
        }
      } finally {
        if (!cancelled) {
          setManualAdjustmentsLoading(false);
        }
      }
    }

    loadManualAdjustmentSetting();

    return () => {
      cancelled = true;
    };
  }, [engagementId]);

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

  function selectHistorySheet(sheetName: string, allRows: Record<string, any[][]> = historyWorkbookRows, yearEnd: string = historyImportYear) {
    const rows = allRows[sheetName] || [];
    const header = (rows[0] || []).map((item: any) => String(item ?? "").trim().toLowerCase());
    const find = (candidates: string[]) => header.findIndex((value: string) => candidates.some((candidate) => value === candidate || value.includes(candidate)));
    const findYear = (year: string) => header.findIndex((value: string) => value.includes(year));
    const code = find(["account number", "account code", "account"]);
    const name = find(["description", "account name"]);
    const mapping = historicalMappingColumn(rows[0] || []);
    const year = yearEnd.slice(0, 4);
    const amount = findYear(year);
    setHistorySheetName(sheetName);
    setHistoryCodeColumn(code >= 0 ? code : 0);
    setHistoryNameColumn(name >= 0 ? name : 1);
    setHistoryMappingColumn(mapping);
    setHistoryAmountColumn(amount >= 0 ? amount : 2);
    setHistoryStartRow(header.some((item: string) => item.includes("account")) ? 1 : 0);
    setHistoryPreview([]);
  }

  async function handleHistoryUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const allRows: Record<string, any[][]> = {};
      for (const sheetName of workbook.SheetNames) {
        allRows[sheetName] = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
      }
      const preferred = workbook.SheetNames.find((sheetName) => /THREE YEAR TB/i.test(sheetName)) || workbook.SheetNames[0];
      if (!preferred || !allRows[preferred]?.length) throw new Error("No usable Excel data found.");
      setHistoryWorkbookRows(allRows);
      setHistorySheetNames(workbook.SheetNames);
      setHistoryImportName(file.name);
      selectHistorySheet(preferred, allRows);
      setHistoryMappingDialog(true);
    } catch (error: any) {
      alert(error?.message || "Unable to open historical TB workbook.");
    }
  }

  function previewHistoricalColumnMapping() {
    const rows = historyWorkbookRows[historySheetName] || [];
    const fields = [historyCodeColumn, historyNameColumn, historyAmountColumn, ...(historyMappingColumn >= 0 ? [historyMappingColumn] : [])];
    if (new Set(fields).size !== fields.length || fields.some((field) => field < 0)) {
      alert("Choose different columns for account, description and balance. If you supply a mapping column, choose a separate column for it."); return;
    }
    const invalid: string[] = [];
    const seen = new Set<string>();
    const next = rows.slice(historyStartRow).map((row, i) => {
      const account_code = String(row[historyCodeColumn] ?? "").trim().replace(/\s+/g, "").toUpperCase();
      const account_name = String(row[historyNameColumn] ?? "").trim();
      if (!account_code && !account_name) return null;
      const raw = String(row[historyAmountColumn] ?? "").trim();
      const cleaned = raw.replace(/,/g, "").replace(/\s/g, "").replace(/[Rr]/g, "").replace(/^\((.*)\)$/, "-$1");
      const balance = Number(cleaned);
      const mapping_code = historicalMappingCode(account_code, row[historyMappingColumn], historyMappingColumn, trialBalanceLines);
      const mapped = getAfsMappingForImport(mapping_code);
      if (!account_code || !account_name) invalid.push(`Row ${historyStartRow + i + 1}: missing account or description`);
      if (!raw || !Number.isFinite(balance)) invalid.push(`Row ${historyStartRow + i + 1}: invalid amount`);
      if (!mapped && (historyMappingColumn >= 0 || mapping_code)) invalid.push(`Row ${historyStartRow + i + 1}: unknown PP code ${mapping_code || "(blank)"}`);
      if (seen.has(account_code)) invalid.push(`Row ${historyStartRow + i + 1}: duplicate account ${account_code}`);
      seen.add(account_code);
      return {
        account_code, account_name, closing_balance: balance, mapping_code,
        mapping_label: mapped?.label || "", mapping_statement: mapped?.statement || "",
        mapping_section: mapped?.section || "", mapping_path: mapped ? [...mapped.path, mapped.label].join(" > ") : "",
        mapping_leaf_id: mapped?.id || "", lead_schedule_number: mapped?.leadScheduleNumber || "",
        lead_schedule_key: mapped?.leadScheduleKey || "",
      };
    }).filter(Boolean) as typeof historyPreview;
    const total = next.reduce((sum, line) => sum + line.closing_balance, 0);
    if (!next.length) invalid.push("No accounts found");
    if (Math.abs(total) > 0.01) invalid.push(`The selected year is not balanced: ${formatMoney(total)}`);
    if (invalid.length) { alert(`Import cancelled.\n${invalid.slice(0, 12).join("\n")}`); return; }
    setHistoryPreview(next);
    setHistoryMappingDialog(false);
  }

  async function saveHistoricalTb() {
    if (!historyPreview.length || historySaving) return;
    const yearEnd = historyImportYear;
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(yearEnd)) {
      alert("Select a valid historical financial year end."); return;
    }
    const currentFinancialYear = String(new Date().getFullYear());
    if (yearEnd >= currentFinancialYear + "-12-31") {
      alert("Historical year must precede the current period."); return;
    }
    const overwrite = historyLines.some((line) => line.financial_year_end === yearEnd);
    if (!confirm(`${overwrite ? "REPLACE existing" : "Import"} historical TB for ${yearEnd} (${historyPreview.length} accounts)?\n\nThe current TB and its mappings are NOT changed.`)) return;
    setHistorySaving(true);
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch(`/api/afs/engagements/${engagementId}/trial-balance-history-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ financialYearEnd: yearEnd, lines: historyPreview }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "History import failed.");
      const latest = await fetch(`/api/afs/engagements/${engagementId}`, { cache: "no-store" });
      if (!latest.ok) throw new Error("Imported, but history reload failed. Refresh this page.");
      const detail = await latest.json();
      setHistoryLines(detail.trialBalanceHistory || detail.trial_balance_history || []);
      setHistoryPreview([]); setHistoryImportName("");
      alert(`${result.inserted} historical accounts saved for ${yearEnd}. The current TB is unchanged.`);
    } catch (error: any) {
      alert(error?.message || "History import failed.");
    } finally { setHistorySaving(false); }
  }

  const historyExcelRows = historyWorkbookRows[historySheetName] || [];
  const historyMaxColumns = Math.max(0, ...historyExcelRows.slice(0, 20).map((row) => row.length));
  const historyColumns = Array.from({ length: historyMaxColumns }, (_, index) => ({
    index,
    label: `${columnLetter(index)} — ${String(historyExcelRows[0]?.[index] ?? "").slice(0, 45)}`,
  }));

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
      setAnnualMovementColumn(3);
      setAmountLayout("Single signed amount column");
      setSourceBalanceColumn(3);
      setDebitColumn(3);
      setCreditColumn(4);
      setPriorYearColumn(2);
       // Optional mapping code column is chosen explicitly; normal TB imports are unchanged.
       const header = cleanedRows[0].map((cell) => String(cell ?? "").trim().toLowerCase());
       const mappingIndex = header.findIndex((cell) =>
         ["pp mapping", "pp mapping code", "mapping code", "mapping_code", "afs mapping code"].includes(cell)
       );
      setImportMappingColumn(mappingIndex);
       if (mappingIndex >= 0 && header.some((cell) => ["account", "account code", "code"].includes(cell))) {
         setStartRowIndex(1);
       }
      setPreviewLines([]);
      setShowMapping(true);
    } catch (error: any) {
      alert(error.message || "Failed to read Excel file.");
    } finally {
      e.target.value = "";
    }
  }

  function applyColumnMapping() {
    // Reject the whole import before creating a preview if any supplied code is invalid.
    // Descriptions are never used to guess the classification.
    if (importMappingColumn >= 0) {
      const invalid = rawRows.slice(startRowIndex).flatMap((row, index) => {
        const name = getCell(row, nameColumn);
        const code = getCell(row, importMappingColumn);
        if (!name) return [];
        if (!code) return [`Excel row ${startRowIndex + index + 1}: missing mapping code`];
        if (getAfsMappingForImport(code)) return [];
        return [`Excel row ${startRowIndex + index + 1}: ${code}`];
      });
      if (invalid.length > 0) {
        alert(`Unknown PracticePilot mapping codes:\n${invalid.slice(0, 12).join("\n")}${invalid.length > 12 ? `\n...and ${invalid.length - 12} more` : ""}\n\nCorrect these codes in Excel before importing.`);
        return;
      }
    }
    // Never interpret a mapping identifier as a financial balance.
    const amountColumns =
      importMode === "Final TB — current and prior year"
        ? amountLayout === "Debit and credit columns"
          ? [debitColumn, creditColumn, priorYearColumn]
          : [sourceBalanceColumn, priorYearColumn]
        : importMode === "Current-year final TB only" ||
            importMode === "Rolled-over figures + current-year final TB"
          ? amountLayout === "Debit and credit columns"
            ? [debitColumn, creditColumn]
            : [sourceBalanceColumn]
          : importMode === "Opening balance + annual movement"
            ? [openingColumn, annualMovementColumn]
            : [annualMovementColumn];

    if (amountColumns.some((index) => index === codeColumn || index === nameColumn) ||
        (importMappingColumn >= 0 && amountColumns.includes(importMappingColumn))) {
      alert("Import cancelled: an amount column overlaps Account, Description or PP Mapping Code. Select the correct amount columns before proceeding.");
      return;
    }
    const malformedAmounts = rawRows.slice(startRowIndex).flatMap((row, index) => {
      if (!String(row[nameColumn] ?? "").trim()) return [];
      return amountColumns.filter((column) => {
        const raw = String(row[column] ?? "").trim();
        if (!raw) return true;
        const cleaned = raw.replace(/,/g, "").replace(/\s/g, "").replace(/[Rr]/g, "").replace(/^\((.*)\)$/, "-$1");
        return !Number.isFinite(Number(cleaned));
      }).map((column) => `Row ${startRowIndex + index + 1}, column ${columnLetter(column)}`);
    });
    if (malformedAmounts.length) {
      alert(`Import cancelled: invalid or empty financial amounts at ${malformedAmounts.slice(0, 10).join(", ")}.`);
      return;
    }

    const importedLines = rawRows
      .slice(startRowIndex)
      .map((row) => buildLine(row))
      .filter((line) => line.account_name);

    if (importedLines.length === 0) {
      alert("No valid trial balance lines were found from the selected columns.");
      return;
    }

    // Do not permit accidental wholesale corruption of the active TB.
    if (importMode === "Final TB — current and prior year") {
      const currentTotal = importedLines.reduce((sum, line) => sum + Number(line.current_year_balance || 0), 0);
      const priorTotal = importedLines.reduce((sum, line) => sum + Number(line.prior_year_balance || 0), 0);
      if (Math.abs(currentTotal) > 0.01 || Math.abs(priorTotal) > 0.01) {
        alert(`Import cancelled. Trial balance does not balance: current ${formatMoney(currentTotal)}, prior ${formatMoney(priorTotal)}. Confirm that CURRENT is column D, PRIOR is C and mapping is E.`);
        return;
      }
    }

    /*
      A rolled-over annual-movement import is an UPDATE to the rolled-over TB,
      not a replacement of the comparative file.

      Accounts omitted from the movement file therefore remain exactly as they
      were rolled over. This prevents prior-year comparatives from disappearing
      merely because an account had no movement in the uploaded workbook.
    */
    if (importMode === "Rolled-over figures + annual movement") {
      const importedByCode = new Map(
        importedLines.map((line) => [
          String(line.account_code || "").trim().toUpperCase(),
          line,
        ]),
      );

      const mergedLines = trialBalanceLines.map((existingLine) => {
        const code = String(existingLine.account_code || "").trim().toUpperCase();
        return (code && importedByCode.get(code)) || existingLine;
      });

      const existingCodes = new Set(
        trialBalanceLines
          .map((line) => String(line.account_code || "").trim().toUpperCase())
          .filter(Boolean),
      );

      for (const importedLine of importedLines) {
        const code = String(importedLine.account_code || "").trim().toUpperCase();

        if (!code || !existingCodes.has(code)) {
          mergedLines.push(importedLine);
        }
      }

      setPreviewLines(mergedLines);
    } else {
      setPreviewLines(importedLines);
    }

    setShowMapping(false);
  }

  function buildLine(row: any[]): TrialBalanceLine {
    const accountCode = getCell(row, codeColumn);
    const accountName = getCell(row, nameColumn);

    let openingBalance = 0;
    let currentYearBalance = 0;
    let priorYearBalance = 0;

    const existingLine = trialBalanceLines.find(
      (line) =>
        String(line.account_code || "").trim() ===
        String(accountCode || "").trim()
    );

    /*
      For a rolled-over engagement there are TWO different balances that must
      never be confused:

      - opening balance: the balance carried into the new current year;
      - prior-year balance: the previous engagement's final comparative.

      Profit-and-loss accounts correctly open at zero in the new year while
      still retaining their prior-year comparative. Using getFinalBalance()
      for both values is what previously turned rolled-over P&L comparatives
      into zero.
    */
    const rolledForwardOpeningBalance = existingLine
      ? Number(
          existingLine.opening_balance ??
            existingLine.source_balance ??
            existingLine.current_year_balance ??
            getFinalBalance(existingLine),
        )
      : 0;

    const rolledForwardPriorYearBalance = existingLine
      ? Number(existingLine.prior_year_balance ?? 0)
      : 0;

    const readFinalBalance = () =>
      amountLayout === "Debit and credit columns"
        ? numberOrZero(getCell(row, debitColumn)) -
          numberOrZero(getCell(row, creditColumn))
        : numberOrZero(getCell(row, sourceBalanceColumn));

    if (importMode === "Final TB — current and prior year") {
      currentYearBalance = readFinalBalance();
      priorYearBalance = numberOrZero(getCell(row, priorYearColumn));
    }

    if (importMode === "Current-year final TB only") {
      currentYearBalance = readFinalBalance();
      priorYearBalance = 0;
    }

    if (importMode === "Opening balance + annual movement") {
      openingBalance = numberOrZero(getCell(row, openingColumn));
      priorYearBalance = openingBalance;
      currentYearBalance =
        openingBalance + numberOrZero(getCell(row, annualMovementColumn));
    }

    if (importMode === "Rolled-over figures + current-year final TB") {
      openingBalance = rolledForwardOpeningBalance;
      priorYearBalance = rolledForwardPriorYearBalance;
      currentYearBalance = readFinalBalance();
    }

    if (importMode === "Rolled-over figures + annual movement") {
      openingBalance = rolledForwardOpeningBalance;
      priorYearBalance = rolledForwardPriorYearBalance;
      currentYearBalance =
        rolledForwardOpeningBalance +
        numberOrZero(getCell(row, annualMovementColumn));
    }

    const importedMappingCode =
      importMappingColumn >= 0 ? getCell(row, importMappingColumn) : "";
    const mappingLeaf = importedMappingCode
      ? getAfsMappingForImport(importedMappingCode)
      : null;

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

      period_1: 0,
      period_2: 0,
      period_3: 0,
      period_4: 0,
      period_5: 0,
      period_6: 0,
      period_7: 0,
      period_8: 0,
      period_9: 0,
      period_10: 0,
      period_11: 0,
      period_12: 0,

      import_basis:
        importMode === "Opening balance + annual movement" ||
        importMode === "Rolled-over figures + annual movement"
          ? "Opening + annual movement"
          : importMode.includes("Rolled-over")
            ? "Rolled-over final TB"
            : "Final TB",
      amount_layout:
        importMode === "Final TB — current and prior year" ||
        importMode === "Current-year final TB only" ||
        importMode === "Rolled-over figures + current-year final TB"
          ? amountLayout
          : importMode,

      mapping_category: mappingLeaf?.label ?? existingLine?.mapping_category ?? null,
      mapping_leaf_id: mappingLeaf?.id ?? (existingLine as any)?.mapping_leaf_id ?? null,
      mapping_label: mappingLeaf?.label ?? (existingLine as any)?.mapping_label ?? null,
      mapping_statement: mappingLeaf?.statement ?? (existingLine as any)?.mapping_statement ?? null,
      mapping_section: mappingLeaf?.section ?? (existingLine as any)?.mapping_section ?? null,
      mapping_path: mappingLeaf
        ? [...mappingLeaf.path, mappingLeaf.label].join(" > ")
        : (existingLine as any)?.mapping_path ?? null,
      mapping_smart_rule: mappingLeaf?.smartRule ?? (existingLine as any)?.mapping_smart_rule ?? null,
      mapping_confidence: mappingLeaf ? "Imported - validated" : (existingLine as any)?.mapping_confidence ?? null,
      mapping_code: mappingLeaf?.mappingCode ?? (existingLine as any)?.mapping_code ?? null,
      lead_schedule_number: mappingLeaf?.leadScheduleNumber ?? (existingLine as any)?.lead_schedule_number ?? null,
      lead_schedule_key: mappingLeaf?.leadScheduleKey ?? (existingLine as any)?.lead_schedule_key ?? null,
      note_number: existingLine?.note_number || null,
    };
  }

  async function confirmImport() {
    if (previewLines.length === 0) {
      alert("Import and map an Excel trial balance first.");
      return;
    }

    if (importMode === "Rolled-over figures + annual movement") {
      const previewCurrentTotal = previewLines.reduce(
        (sum, line) => sum + getFinalBalance(line),
        0,
      );
      const previewPriorTotal = previewLines.reduce(
        (sum, line) =>
          sum + Number(line.prior_year_balance ?? line.credit ?? 0),
        0,
      );

      if (
        Math.abs(previewCurrentTotal) > 0.01 ||
        Math.abs(previewPriorTotal) > 0.01
      ) {
        alert(
          `Rolled-over movement import is not balanced. ` +
            `Current-year total: ${formatMoney(previewCurrentTotal)}; ` +
            `prior-year total: ${formatMoney(previewPriorTotal)}. ` +
            `The import has not been saved.`,
        );
        return;
      }
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
      notifyTrialBalanceSignoffRefresh();
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

  function notifyTrialBalanceSignoffRefresh() {
    window.dispatchEvent(
      new CustomEvent("afs-signoff-refresh", {
        detail: {
          engagementId,
          sectionKey: "trial-balance",
        },
      }),
    );
  }



  async function saveManualAdjustment(
    line: TrialBalanceLine,
    value: string,
  ): Promise<boolean> {
    if (!manualAdjustmentsEnabled) {
      alert("Manual adjustments are disabled for this practice.");
      return false;
    }

    const manualAdjustment = numberOrZero(value);
    const lineId = line.id || null;

    if (!lineId) {
      alert("This line must be imported before you can save manual adjustments.");
      return false;
    }

    if (!supabase) {
      alert("Could not connect to authentication.");
      return false;
    }

    setSavingLineId(lineId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token || "";

      if (!token) {
        throw new Error("Not authenticated.");
      }

      const res = await fetch(`/api/afs/engagements/${engagementId}/trial-balance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

      notifyTrialBalanceSignoffRefresh();
      return true;
    } catch (error: any) {
      alert(error.message || "Failed to save manual adjustment.");
      return false;
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
      notifyTrialBalanceSignoffRefresh();
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
            Import and review the balances used for the annual financial statements. Imported balances stay locked; {manualAdjustmentsEnabled ? "manual adjustments and journals" : "journals"} build the final AFS balance.
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
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, whiteSpace: "nowrap" }}>
                <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 700, color: "#334155" }}>
                  Historical year end
                  <input type="date" style={{ ...styles.input, width: 145, minWidth: 145, padding: "7px 6px" }} value={historyImportYear}
                    onChange={(event) => { setHistoryImportYear(event.target.value); if (historySheetName) selectHistorySheet(historySheetName, historyWorkbookRows, event.target.value); }} />
                </label>
                <label style={{ ...styles.fileButton, display: "inline-flex", alignItems: "center", justifyContent: "center", height: 34, boxSizing: "border-box", whiteSpace: "nowrap", padding: "6px 10px" }}>
                  Import historical TB
                  <input type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                    onChange={handleHistoryUpload}/>
                </label>
              </div>
              <div style={styles.historyYearsLabel}>
              {historyYears.length > 0
                ? `${historyYears.length} historical year${
                    historyYears.length === 1 ? "" : "s"
                  }`
                : "No history available"}
              </div>
            </>
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

      {viewMode === "history" && historyMappingDialog ? (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={styles.modalHeader}>
              <div><h3 style={styles.modalTitle}>Import Historical Trial Balance</h3>
                <p style={styles.text}>Choose the financial year, worksheet and balance column. Ignore the mapping column to reuse existing account mappings, or import unmapped and map the accounts afterwards.</p>
              </div>
              <button style={styles.closeButton} onClick={() => setHistoryMappingDialog(false)}>×</button>
            </div>
            <div style={styles.mappingGrid}>
              <label style={styles.label}>Financial year end
                <input type="date" style={styles.input} value={historyImportYear}
                  onChange={(e) => { setHistoryImportYear(e.target.value); selectHistorySheet(historySheetName, historyWorkbookRows, e.target.value); }} />
              </label>
              <label style={styles.label}>Worksheet
                <select style={styles.input} value={historySheetName}
                  onChange={(e) => selectHistorySheet(e.target.value)}>
                  {historySheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label style={styles.label}>Start importing from row
                <select style={styles.input} value={historyStartRow} onChange={(e) => setHistoryStartRow(Number(e.target.value))}>
                  {historyExcelRows.slice(0, 20).map((row, i) => <option key={i} value={i}>Row {i+1}: {row.slice(0,3).join(" | ")}</option>)}
                </select>
              </label>
              {([
                ["Account number column",historyCodeColumn,setHistoryCodeColumn],
                ["Account description column",historyNameColumn,setHistoryNameColumn],
                ["Historical closing balance column",historyAmountColumn,setHistoryAmountColumn],
                ["PP mapping code column (optional)",historyMappingColumn,setHistoryMappingColumn],
              ] as Array<[string,number,(value:number)=>void]>).map(([label, value, setter]) => (
                <label key={label} style={styles.label}>{label}
                  <select style={styles.input} value={value} onChange={(e) => setter(Number(e.target.value))}>
                    {label === "PP mapping code column (optional)" && <option value={-1}>Ignore — reuse existing mappings or map later</option>}
                    {historyColumns.map((col) => <option key={col.index} value={col.index}>{col.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ ...styles.sampleBox, marginTop: 14 }}><strong>Sample rows — selected columns</strong>
              <table style={styles.table}><thead><tr>{["Account","Description","Balance","Mapping"].map((h)=><th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                <tbody>{historyExcelRows.slice(historyStartRow, historyStartRow+8).map((row,i)=><tr key={i}>
                  {[historyCodeColumn,historyNameColumn,historyAmountColumn].map((col,j)=><td key={j} style={styles.td}>{String(row[col] ?? "")}</td>)}
                  <td style={styles.td}>{historyMappingColumn >= 0 ? String(row[historyMappingColumn] ?? "") : historicalMappingCode(row[historyCodeColumn], null, -1, trialBalanceLines) || "Unmapped — import now, map later"}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.secondaryButton} onClick={() => setHistoryMappingDialog(false)}>Cancel</button>
              <button style={styles.primaryButton} onClick={previewHistoricalColumnMapping}>Validate &amp; preview historical TB</button>
            </div>
          </div>
        </div>
      ) : null}

      {viewMode === "history" && historyPreview.length > 0 ? (
        <div style={{ ...styles.previewBanner, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>{historyImportName}: {historyPreview.length} accounts ({historyPreview.filter(line => !line.mapping_code).length} unmapped), signed TB difference R0.00. Target year {historyImportYear}.</span>
          <button style={styles.primaryButton} disabled={historySaving} onClick={saveHistoricalTb}>
            {historySaving ? "Saving historical TB..." : "Confirm historical import"}
          </button>
          <button style={styles.secondaryButton} onClick={() => setHistoryPreview([])}>Cancel</button>
        </div>
      ) : null}

      {viewMode === "current" ? (
        <div
          style={{
            ...styles.summaryGrid,
            gridTemplateColumns: `repeat(${manualAdjustmentsEnabled ? 6 : 5}, minmax(0, 1fr))`,
          }}
        >
          <Summary label="Imported Balance" value={formatMoney(totalSourceBalance)} />
          {manualAdjustmentsEnabled ? (
            <Summary label="Manual Adj." value={formatMoney(totalManualAdjustments)} />
          ) : null}
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
                {manualAdjustmentsEnabled ? (
                  <th style={styles.thRight}>Manual Adj.</th>
                ) : null}
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
                    {manualAdjustmentsEnabled ? (
                      <td style={styles.tdRight}>
                        <input
                          style={styles.amountInput}
                          defaultValue={formatPlainNumber(manualAdjustment)}
                          disabled={
                            manualAdjustmentsLoading ||
                            previewLines.length > 0 ||
                            savingLineId === line.id
                          }
                          onBlur={async (event) => {
                            const saved = await saveManualAdjustment(
                              line,
                              event.currentTarget.value,
                            );

                            if (!saved) {
                              event.currentTarget.value =
                                formatPlainNumber(manualAdjustment);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      </td>
                    ) : null}
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
                {manualAdjustmentsEnabled ? (
                  <td style={styles.totalRight}>{formatMoney(totalManualAdjustments)}</td>
                ) : null}
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
                  Choose the annual AFS import method, map the Excel columns and review the sample before importing.
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setShowMapping(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.importMethodSection}>
              <div style={styles.sectionHeading}>1. What are you importing?</div>
              <div style={styles.importMethodGrid}>
                {[
                  {
                    value: "Final TB — current and prior year",
                    title: "Final TB — current and prior year",
                    description:
                      "Use one Excel file containing both closing balances.",
                  },
                  {
                    value: "Opening balance + annual movement",
                    title: "Opening balance + annual movement",
                    description:
                      "Calculate closing balance from opening balance plus one full-year movement.",
                  },
                  {
                    value: "Rolled-over figures + current-year final TB",
                    title: "Rolled-over figures + current-year final TB",
                    description:
                      "Keep rolled-over comparatives and replace the current year with the imported final TB.",
                  },
                  {
                    value: "Rolled-over figures + annual movement",
                    title: "Rolled-over figures + annual movement",
                    description:
                      "Add one annual movement to the rolled-over opening balance.",
                  },
                  {
                    value: "Current-year final TB only",
                    title: "Current-year final TB only",
                    description:
                      "Use where no prior-year comparative is being imported.",
                  },
                ].map((option) => {
                  const selected = importMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setImportMode(option.value as ImportMode)
                      }
                      style={{
                        ...styles.importMethodButton,
                        ...(selected
                          ? styles.importMethodButtonActive
                          : null),
                      }}
                    >
                      <strong>{option.title}</strong>
                      <span>{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.mappingSection}>
              <div style={styles.sectionHeading}>2. Map the Excel columns</div>

              <div style={styles.mappingGrid}>
                <label style={styles.label}>
                  PracticePilot mapping code column (optional)
                  <select
                    style={styles.input}
                    value={importMappingColumn}
                    onChange={(e) => setImportMappingColumn(Number(e.target.value))}
                  >
                    <option value={-1}>No mapping column (existing mappings retained)</option>
                    {columnOptions.map((column) => (
                      <option key={column.index} value={column.index}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={styles.label}>
                  Start importing from row
                  <select
                    style={styles.input}
                    value={startRowIndex}
                    onChange={(e) =>
                      setStartRowIndex(Number(e.target.value))
                    }
                  >
                    {rawRows.slice(0, 30).map((row, index) => (
                      <option key={index} value={index}>
                        Row {index + 1}: {row.slice(0, 5).join(" | ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Account number column
                  <select
                    style={styles.input}
                    value={codeColumn}
                    onChange={(e) =>
                      setCodeColumn(Number(e.target.value))
                    }
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
                    onChange={(e) =>
                      setNameColumn(Number(e.target.value))
                    }
                  >
                    {columnOptions.map((column) => (
                      <option key={column.index} value={column.index}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>

                {(importMode === "Final TB — current and prior year" ||
                  importMode === "Current-year final TB only" ||
                  importMode ===
                    "Rolled-over figures + current-year final TB") && (
                  <label style={styles.label}>
                    Amount layout
                    <select
                      style={styles.input}
                      value={amountLayout}
                      onChange={(e) =>
                        setAmountLayout(
                          e.target.value as AmountLayout
                        )
                      }
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

                {(importMode === "Final TB — current and prior year" ||
                  importMode === "Current-year final TB only" ||
                  importMode ===
                    "Rolled-over figures + current-year final TB") &&
                  amountLayout === "Single signed amount column" && (
                    <label style={styles.label}>
                      Current-year final balance column
                      <select
                        style={styles.input}
                        value={sourceBalanceColumn}
                        onChange={(e) =>
                          setSourceBalanceColumn(
                            Number(e.target.value)
                          )
                        }
                      >
                        {columnOptions.map((column) => (
                          <option
                            key={column.index}
                            value={column.index}
                          >
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                {(importMode === "Final TB — current and prior year" ||
                  importMode === "Current-year final TB only" ||
                  importMode ===
                    "Rolled-over figures + current-year final TB") &&
                  amountLayout === "Debit and credit columns" && (
                    <>
                      <label style={styles.label}>
                        Current-year debit column
                        <select
                          style={styles.input}
                          value={debitColumn}
                          onChange={(e) =>
                            setDebitColumn(Number(e.target.value))
                          }
                        >
                          {columnOptions.map((column) => (
                            <option
                              key={column.index}
                              value={column.index}
                            >
                              {column.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={styles.label}>
                        Current-year credit column
                        <select
                          style={styles.input}
                          value={creditColumn}
                          onChange={(e) =>
                            setCreditColumn(Number(e.target.value))
                          }
                        >
                          {columnOptions.map((column) => (
                            <option
                              key={column.index}
                              value={column.index}
                            >
                              {column.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}

                {importMode === "Final TB — current and prior year" && (
                  <label style={styles.label}>
                    Prior-year final balance column
                    <select
                      style={styles.input}
                      value={priorYearColumn}
                      onChange={(e) =>
                        setPriorYearColumn(Number(e.target.value))
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

                {importMode === "Opening balance + annual movement" && (
                  <>
                    <label style={styles.label}>
                      Opening balance column
                      <select
                        style={styles.input}
                        value={openingColumn}
                        onChange={(e) =>
                          setOpeningColumn(Number(e.target.value))
                        }
                      >
                        {columnOptions.map((column) => (
                          <option
                            key={column.index}
                            value={column.index}
                          >
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.label}>
                      Total annual movement column
                      <select
                        style={styles.input}
                        value={annualMovementColumn}
                        onChange={(e) =>
                          setAnnualMovementColumn(
                            Number(e.target.value)
                          )
                        }
                      >
                        {columnOptions.map((column) => (
                          <option
                            key={column.index}
                            value={column.index}
                          >
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {importMode ===
                  "Rolled-over figures + annual movement" && (
                  <label style={styles.label}>
                    Total annual movement column
                    <select
                      style={styles.input}
                      value={annualMovementColumn}
                      onChange={(e) =>
                        setAnnualMovementColumn(
                          Number(e.target.value)
                        )
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
              </div>
            </div>

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
    border: "1px solid #1d4ed8",
    borderRadius: "0px",
    padding: "10px 14px",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    border: "1px solid #94a3b8",
    borderRadius: "0px",
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
    borderRadius: "0px",
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
    width: "min(1180px, calc(100vw - 32px))",
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100vh - 32px)",
    overflow: "auto",
    background: "white",
    border: "1px solid #94a3b8",
    borderRadius: "0px",
    padding: "16px",
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
    borderRadius: "0px",
    width: "34px",
    height: "36px",
    cursor: "pointer",
    fontSize: "22px",
    lineHeight: "1",
  },
  mappingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
  },
  importMethodSection: {
    borderTop: "1px solid #cbd5e1",
    borderBottom: "1px solid #cbd5e1",
    padding: "8px 0",
    marginBottom: "8px",
  },
  mappingSection: {
    borderBottom: "1px solid #cbd5e1",
    paddingBottom: "8px",
    marginBottom: "8px",
  },
  sectionHeading: {
    fontSize: "11px",
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  importMethodGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "6px",
  },
  importMethodButton: {
    minHeight: "58px",
    display: "grid",
    gap: "2px",
    alignContent: "start",
    textAlign: "left",
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
    background: "#ffffff",
    padding: "8px",
    color: "#0f172a",
    cursor: "pointer",
    fontSize: "11px",
    lineHeight: 1.25,
  },
  importMethodButtonActive: {
    border: "2px solid #0f172a",
    background: "#f8fafc",
    padding: "7px",
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
    border: "1px solid #94a3b8",
    borderRadius: "0px",
    padding: "8px 9px",
    fontSize: "13px",
    outline: "none",
    color: "#111827",
    background: "white",
    boxSizing: "border-box",
  },
  sampleBox: {
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
    padding: "8px",
    maxHeight: "300px",
    overflow: "auto",
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
