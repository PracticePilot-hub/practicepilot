"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ReportType = "monthly" | "yearly";
type ActiveTab = "setup" | "trial-balance" | "income-statement" | "sfp-summary" | "notes" | "balance-sheet-detail"  | "management-pack" | "graphs";

type ManagementClient = {
  id: string;
  client_name: string;
  financial_year_end_month: number;
};

type TBLine = {
  accountName: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
};

type ImportSlot = {
  key: string;
  label: string;
  month: number;
  year: number;
};

type ImportedPeriod = {
  label: string;
  fileName: string;
  lines: TBLine[];
};

type ReportRow = {
  name: string;
  category: string;
  values: Record<string, number>;
};

type ManualGraphMonth = {
  month: string;
  year1Sales: string;
  year1CostOfSales: string;
  year2Sales: string;
  year2CostOfSales: string;
  year3Sales: string;
  year3CostOfSales: string;
};

type GraphYearLabels = {
  year1: string;
  year2: string;
  year3: string;
};

function createDefaultManualGraphMonths(): ManualGraphMonth[] {
  return [
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "January",
    "February",
  ].map((month) => ({
    month,
    year1Sales: "",
    year1CostOfSales: "",
    year2Sales: "",
    year2CostOfSales: "",
    year3Sales: "",
    year3CostOfSales: "",
  }));
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const incomeStatementCategories = ["Sales", "Cost of Sales", "Expenses", "Other Income", "Other Expenses"];

const tabs: { key: ActiveTab; label: string }[] = [
  { key: "setup", label: "Setup" },
  { key: "trial-balance", label: "Trial Balance" },
  { key: "income-statement", label: "Income Statement" },
  { key: "sfp-summary", label: "SFP Summary" },
  { key: "notes", label: "Notes" },
  { key: "balance-sheet-detail", label: "B/S Detail" },
  { key: "management-pack", label: "Management Pack" },
  { key: "graphs", label: "Graphs / Analysis" },
];

export default function ManagementReportsPage() {
  const [clients, setClients] = useState<ManagementClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("setup");
  const [graphYearLabels, setGraphYearLabels] = useState({
  year1: "2025",
  year2: "2026",
  year3: "2027",
});
const [manualGraphMonths, setManualGraphMonths] = useState<ManualGraphMonth[]>(
  createDefaultManualGraphMonths()
);

  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [startMonth, setStartMonth] = useState(0);
  const [startYear, setStartYear] = useState("2026");
  const [numberOfMonths, setNumberOfMonths] = useState(0);
  const [numberOfYears, setNumberOfYears] = useState(0);

  const [selectedSlot, setSelectedSlot] = useState("");
  const [imports, setImports] = useState<Record<string, ImportedPeriod>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [editingClientName, setEditingClientName] = useState("");
  const [isEditingClientName, setIsEditingClientName] = useState(false);
const [isSavingClientName, setIsSavingClientName] = useState(false);
  const [newClientYearEndMonth, setNewClientYearEndMonth] = useState(2);
  const [isAddingClient, setIsAddingClient] = useState(false);    

  useEffect(() => {
    loadClients();
  }, []);

useEffect(() => {
  if (selectedClientId) {
    loadAccountMappings(selectedClientId);
    loadGraphInputs(selectedClientId);

    const client = clients.find((item) => item.id === selectedClientId);
    setEditingClientName(client?.client_name || "");
  }
}, [selectedClientId, clients]);

  async function loadClients() {
    const { data, error } = await supabase.from("management_clients").select("*").order("client_name");
    if (error) {
      alert(error.message);
      return;
    }
    setClients(data || []);
    if (data && data.length > 0) setSelectedClientId(data[0].id);
  }

async function saveSelectedClientName() {
  if (!selectedClientId) return;

  const cleanName = editingClientName.trim();

  if (!cleanName) {
    alert("Please enter a client name.");
    return;
  }

  setIsSavingClientName(true);

  const { error } = await supabase
    .from("management_clients")
    .update({ client_name: cleanName })
    .eq("id", selectedClientId);

  setIsSavingClientName(false);

  if (error) {
    alert(error.message);
    return;
  }

  setClients((current) =>
    current
      .map((client) =>
        client.id === selectedClientId
          ? { ...client, client_name: cleanName }
          : client
      )
      .sort((a, b) => a.client_name.localeCompare(b.client_name))
  );
}


async function deleteSelectedClient() {
  if (!selectedClientId) return;

  const client = clients.find((item) => item.id === selectedClientId);
  const clientName = client?.client_name || "this entity";

  const confirmed = window.confirm(
    `Are you sure you want to delete ${clientName}? This will also delete saved imports and graph inputs linked to this entity.`
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("management_clients")
    .delete()
    .eq("id", selectedClientId);

  if (error) {
    alert(error.message);
    return;
  }

  setClients((current) => {
    const next = current.filter((item) => item.id !== selectedClientId);
    setSelectedClientId(next[0]?.id || "");
    return next;
  });

  resetImports();
}
  async function addManagementClient() {
  const clientName = newClientName.trim();

  if (!clientName) {
    alert("Please enter a client name.");
    return;
  }

  setIsAddingClient(true);

  const { data, error } = await supabase
    .from("management_clients")
    .insert({
      client_name: clientName,
      financial_year_end_month: newClientYearEndMonth,
    })
    .select("*")
    .single();

  setIsAddingClient(false);

  if (error) {
    alert(error.message);
    return;
  }

  setClients((current) => [...current, data].sort((a, b) => a.client_name.localeCompare(b.client_name)));
  setSelectedClientId(data.id);
  setNewClientName("");
  setNewClientYearEndMonth(2);
  resetImports();
}

async function loadGraphInputs(clientId: string) {
  const { data, error } = await supabase
    .from("management_graph_inputs")
    .select("graph_data, year_labels")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    alert(error.message);
    return;
  }

  if (!data) {
    setManualGraphMonths(createDefaultManualGraphMonths());
    setGraphYearLabels({
      year1: "2025",
      year2: "2026",
      year3: "2027",
    });
    return;
  }

  setManualGraphMonths(
    Array.isArray(data.graph_data) && data.graph_data.length > 0
      ? data.graph_data
      : createDefaultManualGraphMonths()
  );

  setGraphYearLabels({
    year1: data.year_labels?.year1 || "2025",
    year2: data.year_labels?.year2 || "2026",
    year3: data.year_labels?.year3 || "2027",
  });
}

async function saveGraphInputs(nextGraphData: ManualGraphMonth[]) {
  if (!selectedClientId) return;

  const { error } = await supabase
    .from("management_graph_inputs")
    .upsert(
      {
        client_id: selectedClientId,
        graph_data: nextGraphData,
        year_labels: graphYearLabels,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    );

  if (error) {
    alert(error.message);
  }
}

  async function loadAccountMappings(clientId: string) {
    const { data, error } = await supabase
      .from("management_account_mappings")
      .select("account_name, source_category, display_name")
      .eq("client_id", clientId);

    if (error) {
      alert(error.message);
      return;
    }

    const next: Record<string, string> = {};
    (data || []).forEach((mapping: any) => {
      if (mapping.display_name) {
        next[getAccountKey(mapping.account_name, mapping.source_category)] = mapping.display_name;
      }
    });
    setDisplayNames(next);
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId);

  const importSlots = useMemo<ImportSlot[]>(() => {
    if (reportType === "monthly") {
      if (!numberOfMonths || numberOfMonths <= 0) return [];

      return Array.from({ length: numberOfMonths }, (_, index) => {
        const monthIndex = (startMonth + index) % 12;
        const yearOffset = Math.floor((startMonth + index) / 12);
        const year = Number(startYear) + yearOffset;

        return {
          key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
          label: `${monthNames[monthIndex]} ${year}`,
          month: monthIndex + 1,
          year,
        };
      });
    }

    if (!numberOfYears || numberOfYears <= 0) return [];

    return Array.from({ length: numberOfYears }, (_, index) => {
      const year = Number(startYear) + index;
      return { key: String(year), label: String(year), month: 12, year };
    });
  }, [reportType, startMonth, startYear, numberOfMonths, numberOfYears]);

  useEffect(() => {
    if (selectedClientId && importSlots.length > 0) {
      loadSavedTrialBalances();
    } else {
      setImports({});
      setSelectedSlot("");
    }
  }, [selectedClientId, reportType, startMonth, startYear, numberOfMonths, numberOfYears]);

  const activeSlotKey = selectedSlot || importSlots[0]?.key || "";
  const activeImport = imports[activeSlotKey];
  const activeLines = activeImport?.lines || [];

  const comparison = useMemo(() => {
    return buildComparison(importSlots, imports, reportType, selectedClient?.financial_year_end_month || 12);
  }, [importSlots, imports, reportType, selectedClient]);

  async function loadSavedTrialBalances() {
    if (!selectedClientId) return;

    const { data, error } = await supabase
      .from("management_trial_balances")
      .select(`
        id,
        period_month,
        period_year,
        file_name,
        management_trial_balance_lines (
          account_name,
          category,
          debit,
          credit,
          balance
        )
      `)
      .eq("client_id", selectedClientId);

    if (error) {
      alert(error.message);
      return;
    }

    const next: Record<string, ImportedPeriod> = {};

    importSlots.forEach((slot) => {
      const saved = (data || []).find((item: any) => item.period_month === slot.month && item.period_year === slot.year);
      if (!saved) return;

      next[slot.key] = {
        label: slot.label,
        fileName: saved.file_name || "Saved import",
        lines: (saved.management_trial_balance_lines || []).map((line: any) => ({
          accountName: line.account_name,
          category: line.category,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
          balance: Number(line.balance || 0),
        })),
      };
    });

    setImports(next);
    setSelectedSlot("");
  }

  function money(value: number) {
    const rounded = Math.abs(value) < 0.005 ? 0 : value;
    return rounded.toLocaleString("en-ZA", { style: "currency", currency: "ZAR" });
  }

  function parseNumber(value: unknown) {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/"/g, "").replace(/,/g, "").replace(/\s/g, "").trim();
    if (!cleaned) return 0;
    const isNegative = cleaned.startsWith("(") && cleaned.endsWith(")");
    const numberValue = Number(cleaned.replace(/[()]/g, ""));
    if (Number.isNaN(numberValue)) return 0;
    return isNegative ? numberValue * -1 : numberValue;
  }

  function cleanText(value: unknown) {
    return String(value || "").replace(/"/g, "").trim();
  }

function updateManualGraphMonth(
  monthIndex: number,
  field: keyof ManualGraphMonth,
  value: string
) {
  setManualGraphMonths((current) => {
    const next = current.map((row, index) =>
      index === monthIndex ? { ...row, [field]: value } : row
    );

    saveGraphInputs(next);

    return next;
  });
}
  
  function resetImports() {
    setImports({});
    setSelectedSlot("");
  }

  function getDisplayName(accountName: string, category: string) {
    return displayNames[getAccountKey(accountName, category)] || accountName;
  }

  function updateDisplayNameLocally(accountName: string, category: string, value: string) {
    setDisplayNames((current) => ({
      ...current,
      [getAccountKey(accountName, category)]: value,
    }));
  }

  async function saveDisplayName(accountName: string, category: string, value: string) {
    if (!selectedClient) return;

    const isIncomeStatement = incomeStatementCategories.includes(category);

    const { error } = await supabase.from("management_account_mappings").upsert(
      {
        client_id: selectedClient.id,
        account_name: accountName,
        source_category: category,
        report_type: isIncomeStatement ? "income_statement" : "balance_sheet",
        report_section: category,
        display_name: value.trim() || accountName,
      },
      { onConflict: "client_id,account_name,source_category" }
    );

    if (error) alert(error.message);
  }

function exportExcel() {
  if (!selectedClient) {
    alert("Please select a client first.");
    return;
  }

  if (importSlots.length === 0) {
    alert("Please complete the report setup first.");
    return;
  }

  const workbook = XLSX.utils.book_new();

  const incomeSheet = [
    ["Client", selectedClient.client_name],
    ["Report", "Statement of Profit or Loss"],
    [],
    ["Account", ...importSlots.map((slot) => slot.label)],
    ...comparison.incomeStatementRows.map((row) => [
      getDisplayName(row.name, row.category),
      ...importSlots.map((slot) =>
        incomeDisplayValue(row.category, row.values[slot.key] || 0)
      ),
    ]),
  ];

const sfpRows = comparison.balanceSheetRows;

const fixedAssets = sfpRows.filter(isFixedAsset);
const otherNonCurrentAssets = sfpRows.filter(
  (row) => row.category === "Non-Current Assets" && !isFixedAsset(row)
);

const cash = sfpRows.filter(isCash);
const receivables = sfpRows.filter(isReceivable);
const otherCurrentAssets = sfpRows.filter(
  (row) => row.category === "Current Assets" && !isCash(row) && !isReceivable(row)
);

const shareCapital = sfpRows.filter(isShareCapital);
const accumulatedIncome = sfpRows.filter(
  (row) => row.category === "Owners Equity" && !isShareCapital(row)
);

const nonCurrentLiabilities = sfpRows.filter(
  (row) => row.category === "Non-Current Liabilities"
);

const vat = sfpRows.filter(isVat);
const incomeTax = sfpRows.filter(isIncomeTax);
const payables = sfpRows.filter(isPayable);
const otherCurrentLiabilities = sfpRows.filter(
  (row) =>
    row.category === "Current Liabilities" &&
    !isVat(row) &&
    !isIncomeTax(row) &&
    !isPayable(row)
);

const sfpSummary = [
  ["Client", selectedClient.client_name],
  ["Report", "Statement of Financial Position"],
  [],
  ["Figures in Rand", "Note(s)", ...importSlots.map((slot) => slot.label)],
  ["Assets", "", ...importSlots.map(() => "")],
  [
    "Property, plant and equipment",
    "1",
    ...importSlots.map((slot) => signAsset(totalRows(fixedAssets, slot.key))),
  ],
  [
    "Other non-current assets",
    "",
    ...importSlots.map((slot) => signAsset(totalRows(otherNonCurrentAssets, slot.key))),
  ],
  [
    "Trade and other receivables",
    "2",
    ...importSlots.map((slot) => signAsset(totalRows(receivables, slot.key))),
  ],
  [
    "Cash and cash equivalents",
    "3",
    ...importSlots.map((slot) => signAsset(totalRows(cash, slot.key))),
  ],
  [
    "Other current assets",
    "",
    ...importSlots.map((slot) => signAsset(totalRows(otherCurrentAssets, slot.key))),
  ],
  [
    "Total assets",
    "",
    ...importSlots.map(
      (slot) =>
        signAsset(totalRows(fixedAssets, slot.key)) +
        signAsset(totalRows(otherNonCurrentAssets, slot.key)) +
        signAsset(totalRows(receivables, slot.key)) +
        signAsset(totalRows(cash, slot.key)) +
        signAsset(totalRows(otherCurrentAssets, slot.key))
    ),
  ],
  [],
  ["Equity and liabilities", "", ...importSlots.map(() => "")],
  [
    "Share capital",
    "",
    ...importSlots.map((slot) => signEquityLiability(totalRows(shareCapital, slot.key))),
  ],
  [
    "Accumulated profit / (loss)",
    "",
    ...importSlots.map(
      (slot) =>
        signEquityLiability(totalRows(accumulatedIncome, slot.key)) +
        calculateCurrentProfit(imports[slot.key])
    ),
  ],
  [
    "Non-current liabilities",
    "4",
    ...importSlots.map((slot) =>
      signEquityLiability(totalRows(nonCurrentLiabilities, slot.key))
    ),
  ],
  [
    "VAT payable",
    "",
    ...importSlots.map((slot) => signEquityLiability(totalRows(vat, slot.key))),
  ],
  [
    "Income tax payable",
    "",
    ...importSlots.map((slot) => signEquityLiability(totalRows(incomeTax, slot.key))),
  ],
  [
    "Trade and other payables",
    "5",
    ...importSlots.map((slot) => signEquityLiability(totalRows(payables, slot.key))),
  ],
  [
    "Other current liabilities",
    "",
    ...importSlots.map((slot) =>
      signEquityLiability(totalRows(otherCurrentLiabilities, slot.key))
    ),
  ],
];

  const balanceSheet = [
    ["Client", selectedClient.client_name],
    ["Report", "Balance Sheet Detail"],
    [],
    ["Account", "Category", ...importSlots.map((slot) => slot.label)],
    ...comparison.balanceSheetRows.map((row) => [
      getDisplayName(row.name, row.category),
      row.category,
      ...importSlots.map((slot) => row.values[slot.key] || 0),
    ]),
  ];

XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet(sfpSummary),
  "SFP Summary"
);

const excelNotes = [
  ["Client", selectedClient.client_name],
  ["Report", "Notes to the Management Accounts"],
  [],
  ["Note / Account", ...importSlots.map((slot) => slot.label)],
  ["1. Property, plant and equipment", ...importSlots.map(() => "")],
  ...fixedAssets.map((row) => [
    getDisplayName(row.name, row.category),
    ...importSlots.map((slot) => signAsset(row.values[slot.key] || 0)),
  ]),
  ["Total Property, plant and equipment", ...importSlots.map((slot) => signAsset(totalRows(fixedAssets, slot.key)))],
  [],
  ["2. Trade and other receivables", ...importSlots.map(() => "")],
  ...receivables.map((row) => [
    getDisplayName(row.name, row.category),
    ...importSlots.map((slot) => signAsset(row.values[slot.key] || 0)),
  ]),
  ["Total Trade and other receivables", ...importSlots.map((slot) => signAsset(totalRows(receivables, slot.key)))],
  [],
  ["3. Cash and cash equivalents", ...importSlots.map(() => "")],
  ...cash.map((row) => [
    getDisplayName(row.name, row.category),
    ...importSlots.map((slot) => signAsset(row.values[slot.key] || 0)),
  ]),
  ["Total Cash and cash equivalents", ...importSlots.map((slot) => signAsset(totalRows(cash, slot.key)))],
  [],
  ["4. Non-current liabilities", ...importSlots.map(() => "")],
  ...nonCurrentLiabilities.map((row) => [
    getDisplayName(row.name, row.category),
    ...importSlots.map((slot) => signEquityLiability(row.values[slot.key] || 0)),
  ]),
  ["Total Non-current liabilities", ...importSlots.map((slot) => signEquityLiability(totalRows(nonCurrentLiabilities, slot.key)))],
  [],
  ["5. Trade and other payables", ...importSlots.map(() => "")],
  ...payables.map((row) => [
    getDisplayName(row.name, row.category),
    ...importSlots.map((slot) => signEquityLiability(row.values[slot.key] || 0)),
  ]),
  ["Total Trade and other payables", ...importSlots.map((slot) => signEquityLiability(totalRows(payables, slot.key)))],
];

XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet(excelNotes),
  "Notes"
);

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(incomeSheet),
    "Income Statement"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(balanceSheet),
    "Balance Sheet Detail"
  );

  XLSX.writeFile(
    workbook,
    `${selectedClient.client_name} Management Accounts.xlsx`
  );
}

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedClient) return;

    const slot = importSlots.find((item) => item.key === activeSlotKey);
    if (!slot) return;

    const reader = new FileReader();

    reader.onload = async function (e) {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: "",
      });

      const importedLines = rows
        .slice(1)
        .map((row) => {
          const accountName = cleanText(row[0]);
          const category = cleanText(row[1]);
          const debit = parseNumber(row[3]);
          const credit = parseNumber(row[4]);

          return {
            accountName,
            category,
            debit,
            credit,
            balance: debit - credit,
          };
        })
        .filter((line) => line.accountName || line.category);

      setIsSaving(true);

      const { data: savedTb, error: tbError } = await supabase
        .from("management_trial_balances")
        .upsert(
          {
            client_id: selectedClient.id,
            period_month: slot.month,
            period_year: slot.year,
            file_name: file.name,
          },
          { onConflict: "client_id,period_month,period_year" }
        )
        .select("id")
        .single();

      if (tbError || !savedTb) {
        setIsSaving(false);
        alert(tbError?.message || "Could not save trial balance.");
        return;
      }

      const trialBalanceId = savedTb.id;

      const { error: deleteError } = await supabase
        .from("management_trial_balance_lines")
        .delete()
        .eq("trial_balance_id", trialBalanceId);

      if (deleteError) {
        setIsSaving(false);
        alert(deleteError.message);
        return;
      }

      const { error: linesError } = await supabase.from("management_trial_balance_lines").insert(
        importedLines.map((line) => ({
          trial_balance_id: trialBalanceId,
          account_name: line.accountName,
          category: line.category,
          debit: line.debit,
          credit: line.credit,
          balance: line.balance,
        }))
      );

      setIsSaving(false);

      if (linesError) {
        alert(linesError.message);
        return;
      }

      setImports((current) => ({
        ...current,
        [slot.key]: {
          label: slot.label,
          fileName: file.name,
          lines: importedLines,
        },
      }));
    };

    reader.readAsArrayBuffer(file);
    event.target.value = "";
  }

return (
  <>
  <style>{`
  .editable-name-print {
    display: none;
  }

  @media print {
    @page {
      size: A4 portrait;
      margin: 8mm;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body * {
      visibility: hidden !important;
    }

    .print-area,
    .print-area * {
      visibility: visible !important;
    }

    .print-area {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      box-shadow: none !important;
      border: 1px solid #dce4ec !important;
      border-radius: 10px !important;
      padding: 12px !important;
      margin: 0 !important;
      background: #ffffff !important;
    }

    .print-area table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 9px !important;
    }

    .print-area th,
    .print-area td {
      padding: 5px 7px !important;
      line-height: 1.15 !important;
      font-size: 9px !important;
      font-family: Arial, sans-serif !important;
    }

    .print-area th {
      background: #0f4c81 !important;
      color: #ffffff !important;
      font-weight: 800 !important;
    }

    .print-area h2 {
      font-size: 13px !important;
      margin-bottom: 8px !important;
      font-family: Arial, sans-serif !important;
    }

    .print-area p {
      font-size: 9px !important;
      font-family: Arial, sans-serif !important;
    }

    .editable-name-input {
      display: none !important;
      visibility: hidden !important;
    }

    .editable-name-print {
      display: inline !important;
      visibility: visible !important;
      font-size: 9px !important;
      line-height: 1.15 !important;
      font-family: Arial, sans-serif !important;
      font-weight: 400 !important;
      color: #000000 !important;
    }

        .management-pack-print {
      position: static !important;
      width: 100% !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      background: white !important;
    }

    .management-pack-print .report-card,
    .management-pack-print section {
      box-shadow: none !important;
    }

    .management-pack-print {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  width: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  box-shadow: none !important;
  background: white !important;
}

.pack-cover-page,
.pack-index-page,
.pack-report-page {
  width: 100% !important;
  min-height: 281mm !important;
  box-sizing: border-box !important;
  background: white !important;
  page-break-after: always !important;
  break-after: page !important;
}

.pack-cover-page {
  padding: 18mm !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  background: white !important;
}

.pack-cover-page > div {
  width: 100% !important;
  min-height: 245mm !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  padding: 24mm !important;
  font-family: Arial, sans-serif !important;
  border: none !important;
}

.pack-cover-page h1,
.pack-cover-page h2 {
  font-family: "Fjalla One", Impact, sans-serif !important;
  color: #0f4c81 !important;
  margin: 0 0 12px 0 !important;
  line-height: 1.1 !important;
}

.pack-cover-page h1 {
  font-size: 34px !important;
  font-weight: 400 !important;
}

.pack-cover-page h2 {
  font-size: 22px !important;
  font-weight: 400 !important;
}

.pack-cover-page p {
  font-family: Arial, sans-serif !important;
  font-size: 12px !important;
  margin: 6px 0 !important;
  color: #1f2937 !important;

}

.pack-index-page {
  padding: 28mm !important;
  background: white !important;
  font-family: Arial, sans-serif !important;
}

.pack-index-page h2 {
  font-family: "Fjalla One", Impact, sans-serif !important;
  font-size: 28px !important;
  color: #0f4c81 !important;
  margin-bottom: 22px !important;
}

.pack-index-page table {
  width: 100% !important;
  border-collapse: collapse !important;
}

.pack-index-page td {
  font-size: 13px !important;
  padding: 10px 8px !important;
  border-bottom: 1px solid #dce4ec !important;
}

.pack-report-page {
  padding: 8mm !important;
}

.pack-report-page .print-area {
  position: static !important;
  width: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  box-shadow: none !important;
}

.graph-pack-page {
  display: block !important;
  padding: 10mm !important;
}

.graph-pack-page > div {
  width: 100% !important;
  max-width: 760px !important;
  margin: 0 auto 10mm auto !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

.graph-pack-page svg {
  width: 720px !important;
  height: 240px !important;
  max-width: 100% !important;
}

.management-pack-print .pack-report-page:last-child {
  page-break-after: auto !important;
  break-after: auto !important;
}

  }
`}</style>

    <main style={{ background: "#f4f7fb", minHeight: "calc(100vh - 60px)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", minHeight: "calc(100vh - 60px)" }}>
        <aside style={sideNav}>
          <div style={{ padding: "24px 12px 14px 0" }}>
            <p style={{ margin: "0 0 14px 18px", fontSize: "13px", fontWeight: 900, color: "#52616f", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Management
            </p>

            <div style={{ display: "grid", gap: "10px" }}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    ...sideNavButton,
                    background: activeTab === tab.key ? "#0f4c81" : "#ffffff",
                    color: activeTab === tab.key ? "#ffffff" : "#12304a",
                    border: activeTab === tab.key ? "1px solid #0f4c81" : "1px solid #dce4ec",
                    boxShadow: activeTab === tab.key ? "0 10px 22px rgba(15, 76, 129, 0.24)" : "0 8px 18px rgba(15, 76, 129, 0.08)",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section style={{ padding: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "8px" }}>Management Reports</h1>
          <p style={{ fontSize: "16px", color: "#52616f", marginBottom: "28px" }}>
            Select a client, import monthly trial balances, and prepare client-ready management reports.
          </p>

<div className="no-print" style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
  <button
    onClick={() => {
  const oldTitle = document.title;

  document.title = selectedClient
    ? `${selectedClient.client_name} Management Accounts`
    : "Management Accounts";

  window.print();

  setTimeout(() => {
    document.title = oldTitle;
  }, 1000);
}}
    style={{
      border: "1px solid #0f4c81",
      background: "#0f4c81",
      color: "#ffffff",
      borderRadius: "12px",
      padding: "10px 16px",
      fontWeight: 800,
      cursor: "pointer",
    }}
  >
    Print / Save as PDF
  </button>

  <button
    onClick={exportExcel}
    style={{
      border: "1px solid #d5dde6",
      background: "#ffffff",
      color: "#12304a",
      borderRadius: "12px",
      padding: "10px 16px",
      fontWeight: 800,
      cursor: "pointer",
    }}
  >
    Export Excel
  </button>
</div>

          {activeTab === "setup" && (
            <>
              <section style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
  <div>
    <h2 style={{ ...sectionHeading, marginBottom: "4px" }}>Client Setup</h2>
    <p style={{ margin: 0, color: "#52616f", fontSize: "13px" }}>
      Select an existing client or add a new management reporting client.
    </p>
  </div>
</div>
               <div
  style={{
    display: "grid",
    gridTemplateColumns: "minmax(280px, 520px) auto",
    gap: "16px",
    alignItems: "end",
  }}
>
  <Field label="Select client">
    <select
      value={selectedClientId}
      onChange={(event) => {
        setSelectedClientId(event.target.value);
        resetImports();
        setIsEditingClientName(false);
      }}
      style={input}
    >
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.client_name}
        </option>
      ))}
    </select>
  </Field>

  <div style={{ display: "flex", gap: "10px", alignItems: "end" }}>
    {!isEditingClientName ? (
      <>
        <button
          onClick={() => {
            setEditingClientName(selectedClient?.client_name || "");
            setIsEditingClientName(true);
          }}
          style={{
            height: "46px",
            border: "1px solid #0f4c81",
            background: "#ffffff",
            color: "#0f4c81",
            borderRadius: "12px",
            fontWeight: 800,
            padding: "0 18px",
            cursor: "pointer",
          }}
        >
          Edit
        </button>

        <button
          onClick={deleteSelectedClient}
          style={{
            height: "46px",
            border: "1px solid #b91c1c",
            background: "#ffffff",
            color: "#b91c1c",
            borderRadius: "12px",
            fontWeight: 800,
            padding: "0 18px",
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </>
    ) : (
      <>
        <Field label="Edit entity name">
          <input
            value={editingClientName}
            onChange={(event) => setEditingClientName(event.target.value)}
            style={{ ...input, minWidth: "360px" }}
          />
        </Field>

        <button
          onClick={async () => {
  await saveSelectedClientName();
  setIsEditingClientName(false);
}}
          disabled={isSavingClientName}
          style={{
            height: "46px",
            border: "1px solid #0f4c81",
            background: "#0f4c81",
            color: "#ffffff",
            borderRadius: "12px",
            fontWeight: 800,
            padding: "0 18px",
            cursor: "pointer",
          }}
        >
          {isSavingClientName ? "Saving..." : "Save"}
        </button>

        <button
          onClick={() => {
            setEditingClientName(selectedClient?.client_name || "");
            }}
          style={{
            height: "46px",
            border: "1px solid #d5dde6",
            background: "#ffffff",
            color: "#12304a",
            borderRadius: "12px",
            fontWeight: 800,
            padding: "0 18px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </>
    )}
  </div>
</div>
              </section>

              <div
  style={{
    marginTop: "22px",
    paddingTop: "22px",
    borderTop: "1px solid #eef2f6",
  }}
>
  <h3 style={{ fontSize: "16px", fontWeight: 800, marginBottom: "12px", color: "#12304a" }}>
  Add New Client
</h3>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(280px, 1fr) 220px 140px",
      gap: "16px",
      alignItems: "end",
    }}
  >
    <Field label="Client name">
      <input
        value={newClientName}
        onChange={(event) => setNewClientName(event.target.value)}
        placeholder="Enter client name"
        style={input}
      />
    </Field>

    <Field label="Financial year-end">
      <select
        value={newClientYearEndMonth}
        onChange={(event) => setNewClientYearEndMonth(Number(event.target.value))}
        style={input}
      >
        {monthNames.map((month, index) => (
          <option key={month} value={index + 1}>
            {month}
          </option>
        ))}
      </select>
    </Field>

    <button
      onClick={addManagementClient}
      disabled={isAddingClient}
      style={{
        height: "46px",
        border: "1px solid #0f4c81",
        background: "#0f4c81",
        color: "#ffffff",
        borderRadius: "12px",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {isAddingClient ? "Adding..." : "Add Client"}
    </button>
  </div>
</div>

              {selectedClient && (
                <section style={card}>
                  <h2 style={sectionHeading}>Report Setup</h2>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px", alignItems: "end" }}>
                    <Field label="Report type">
                      <select
                        value={reportType}
                        onChange={(event) => {
                          setReportType(event.target.value as ReportType);
                          resetImports();
                        }}
                        style={input}
                      >
                        <option value="monthly">Monthly comparison</option>
                        <option value="yearly">Yearly comparison</option>
                      </select>
                    </Field>

                    <Field label="Start year">
                      <input
                        value={startYear}
                        onChange={(event) => {
                          setStartYear(event.target.value);
                          resetImports();
                        }}
                        style={input}
                      />
                    </Field>

                    {reportType === "monthly" && (
                      <>
                        <Field label="Start month">
                          <select
                            value={startMonth}
                            onChange={(event) => {
                              setStartMonth(Number(event.target.value));
                              resetImports();
                            }}
                            style={input}
                          >
                            {monthNames.map((month, index) => (
                              <option key={month} value={index}>
                                {month}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Months to compare">
                          <input
                            type="number"
                            min={1}
                            max={12}
                            placeholder="Enter months"
                            value={numberOfMonths === 0 ? "" : numberOfMonths}
                            onChange={(event) => {
                              setNumberOfMonths(Number(event.target.value || 0));
                              resetImports();
                            }}
                            style={input}
                          />
                        </Field>
                      </>
                    )}

                    {reportType === "yearly" && (
                      <Field label="Years to compare">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          placeholder="Enter years"
                          value={numberOfYears === 0 ? "" : numberOfYears}
                          onChange={(event) => {
                            setNumberOfYears(Number(event.target.value || 0));
                            resetImports();
                          }}
                          style={input}
                        />
                      </Field>
                    )}
                  </div>

                  {importSlots.length === 0 && (
                    <p style={warningText}>Enter the number of periods to compare before importing trial balances.</p>
                  )}
                </section>
              )}
            </>
          )}

          {selectedClient && activeTab === "trial-balance" && (
            <TrialBalanceTab
              importSlots={importSlots}
              activeSlotKey={activeSlotKey}
              setSelectedSlot={setSelectedSlot}
              imports={imports}
              activeImport={activeImport}
              activeLines={activeLines}
              handleFileUpload={handleFileUpload}
              isSaving={isSaving}
              money={money}
              getDisplayName={getDisplayName}
            />
          )}

          {selectedClient && activeTab === "income-statement" && (
            <IncomeStatementTable
              rows={comparison.incomeStatementRows}
              clientName={selectedClient.client_name}
              slots={importSlots}
              money={money}
              getDisplayName={getDisplayName}
              updateDisplayNameLocally={updateDisplayNameLocally}
              saveDisplayName={saveDisplayName}
            />
          )}

          {selectedClient && activeTab === "sfp-summary" && (
            <SfpTable
              rows={comparison.balanceSheetRows}
              clientName={selectedClient.client_name}
              slots={importSlots}
              imports={imports}
              money={money}
              getDisplayName={getDisplayName}
              updateDisplayNameLocally={updateDisplayNameLocally}
              saveDisplayName={saveDisplayName}
            />
          )}

          {selectedClient && activeTab === "notes" && (
            <NotesTable
              rows={comparison.balanceSheetRows}
              clientName={selectedClient.client_name}
              slots={importSlots}
              money={money}
              getDisplayName={getDisplayName}
              updateDisplayNameLocally={updateDisplayNameLocally}
              saveDisplayName={saveDisplayName}
            />
          )}

          {selectedClient && activeTab === "balance-sheet-detail" && (
            <BalanceSheetDetailTable
              rows={comparison.balanceSheetRows}
              slots={importSlots}
              money={money}
              getDisplayName={getDisplayName}
              updateDisplayNameLocally={updateDisplayNameLocally}
              saveDisplayName={saveDisplayName}
            />
          )}

          {selectedClient && activeTab === "management-pack" && (
  <ManagementPack
    clientName={selectedClient.client_name}
    manualGraphMonths={manualGraphMonths}
    rows={comparison.balanceSheetRows}
    incomeRows={comparison.incomeStatementRows}
    slots={importSlots}
    imports={imports}
    money={money}
    getDisplayName={getDisplayName}
    
  />
  )}

 {selectedClient && activeTab === "graphs" && (
  <GraphsAnalysisTab
    manualGraphMonths={manualGraphMonths}
    graphYearLabels={graphYearLabels}
    rows={comparison.balanceSheetRows}
    slots={importSlots}
    updateManualGraphMonth={updateManualGraphMonth}
  />
)}
        </section>
      </div>
    </main>
    </>
  );
}

function buildComparison(
  slots: ImportSlot[],
  imports: Record<string, ImportedPeriod>,
  reportType: ReportType,
  financialYearEndMonth: number
) {
  const allAccounts = new Map<string, { name: string; category: string }>();
  slots.forEach((slot) => {
    imports[slot.key]?.lines.forEach((line) => {
      const key = `${line.category}|||${line.accountName}`;
      if (!allAccounts.has(key)) allAccounts.set(key, { name: line.accountName, category: line.category });
    });
  });

  const incomeStatementRows: ReportRow[] = [];
  const balanceSheetRows: ReportRow[] = [];
  const financialYearStartMonth = financialYearEndMonth === 12 ? 1 : financialYearEndMonth + 1;

  allAccounts.forEach((account) => {
    const isIncomeStatement = incomeStatementCategories.includes(account.category);
    const values: Record<string, number> = {};

    slots.forEach((slot, index) => {
      const currentBalance = getAccountBalance(imports[slot.key], account.name, account.category);

      values[slot.key] = currentBalance;
});

    const row = { name: account.name, category: account.category, values };
    if (isIncomeStatement) incomeStatementRows.push(row);
    else balanceSheetRows.push(row);
  });

  return { incomeStatementRows, balanceSheetRows };
}

function getAccountBalance(imported: ImportedPeriod | undefined, accountName: string, category: string) {
  if (!imported) return 0;
  return imported.lines
    .filter((line) => line.accountName === accountName && line.category === category)
    .reduce((sum, line) => sum + line.balance, 0);
}

function getAccountKey(accountName: string, category: string) {
  return `${category}|||${accountName}`;
}

function incomeDisplayValue(category: string, value: number) {
  if (category === "Sales" || category === "Other Income") return value * -1;
  return value;
}

function calculateCurrentProfit(imported: ImportedPeriod | undefined) {
  if (!imported) return 0;

  const totals: Record<string, number> = {
    Sales: 0,
    "Cost of Sales": 0,
    Expenses: 0,
    "Other Income": 0,
    "Other Expenses": 0,
  };

  imported.lines.forEach((line) => {
    if (!incomeStatementCategories.includes(line.category)) return;
    totals[line.category] += incomeDisplayValue(line.category, line.balance);
  });

  return (totals["Sales"] || 0) + (totals["Other Income"] || 0) - (totals["Cost of Sales"] || 0) - (totals["Expenses"] || 0) - (totals["Other Expenses"] || 0);
}

function rowTotal(row: ReportRow, slotKey: string) {
  return row.values[slotKey] || 0;
}

function totalRows(rows: ReportRow[], slotKey: string) {
  return rows.reduce((sum, row) => sum + rowTotal(row, slotKey), 0);
}

function isFixedAsset(row: ReportRow) {
  const name = row.name.toLowerCase();

  return (
    row.category === "Non-Current Assets" &&
    (
      name.includes("fixed asset") ||
      name.includes("fixed assets") ||
      name.includes("plant") ||
      name.includes("machinery") ||
      name.includes("motor vehicle") ||
      name.includes("vehicles") ||
      name.includes("office equipment") ||
      name.includes("furniture") ||
      name.includes("fixtures") ||
      name.includes("equipment") ||
      name.includes("property") ||
      name.includes("generator") ||
      name.includes("generators") ||
      name.includes("workshop") ||
      name.includes("depr") ||
      name.includes("depreciation")
    )
  );
}


  function isCash(row: ReportRow) {
  const name = row.name.toLowerCase();

  return (
    name.includes("bank") ||
    name.includes("cash") ||
    name.includes("petty cash") ||
    name.includes("current account") ||
    name.includes("call account") ||
    name.includes("call deposit") ||
    name.includes("absa") ||
    name.includes("8400") ||
    name.includes("grundling management trust")
  );
}



function isReceivable(row: ReportRow) {
  const name = row.name.toLowerCase();
  const hasCreditBalance = Object.values(row.values).some((value) => value < 0);

  return (
    row.category === "Current Assets" &&
    !hasCreditBalance &&
    (
      name.includes("receivable") ||
      name.includes("trade receivables") ||
      name.includes("sundry customer") ||
      name.includes("customer") ||
      name.includes("debtors")
    )
  );
}

function isShareCapital(row: ReportRow) {
  const name = row.name.toLowerCase();
  return row.category === "Owners Equity" && (name.includes("share capital") || name.includes("ordinary shares") || name.includes("member contribution"));
}

function isVat(row: ReportRow) {
  return row.category === "Current Liabilities" && row.name.toLowerCase().includes("vat");
}

function isIncomeTax(row: ReportRow) {
  const name = row.name.toLowerCase();
  return row.category === "Current Liabilities" && !name.includes("vat") && (name.includes("income tax") || name.includes("tax payable") || name.includes("provisional") || name.includes("sars") || name.includes("tax"));
}

function isPayable(row: ReportRow) {
  const name = row.name.toLowerCase();

  const isDebtorWithCreditBalance =
    name.includes("debtors with credit balances") ||
    name.includes("debtor with credit balance") ||
    name.includes("credit balance debtor");

  const isCurrentAssetDebtorWithCredit =
    row.category === "Current Assets" &&
    Object.values(row.values).some((value) => value < 0) &&
    (
      name.includes("receivable") ||
      name.includes("trade receivables") ||
      name.includes("sundry customer") ||
      name.includes("customer") ||
      name.includes("debtors")
    );

  return (
    isDebtorWithCreditBalance ||
    isCurrentAssetDebtorWithCredit ||
    (
      row.category === "Current Liabilities" &&
      !isVat(row) &&
      !isIncomeTax(row) &&
      (
        name.includes("payable") ||
        name.includes("payables") ||
        name.includes("creditor") ||
        name.includes("supplier") ||
        name.includes("trade payable")
      )
    )
  );
}

function signAsset(value: number) {
  return value;
}

function signEquityLiability(value: number) {
  return value * -1;
}

function EditableAccountName({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
}) {
  return (
    <>
      <input
        className="editable-name-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur(event.target.value)}
        style={{
          width: "100%",
          border: "1px solid transparent",
          background: "transparent",
          padding: "0",
          margin: "0",
          borderRadius: "0",
          fontSize: "12px",
          lineHeight: "1.2",
          fontFamily: "Arial, sans-serif",
          fontWeight: 400,
          color: "#000000",
        }}
      />

      <span className="editable-name-print">
        {value}
      </span>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: "8px", fontWeight: 700 }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={summaryCard}>
      <p style={{ margin: 0, color: "#52616f", fontSize: "14px" }}>{title}</p>
      <p style={{ margin: "8px 0 0", fontSize: "22px", fontWeight: 800 }}>{value}</p>
    </div>
  );
}

function TrialBalanceTab({
  importSlots,
  activeSlotKey,
  setSelectedSlot,
  imports,
  activeImport,
  activeLines,
  handleFileUpload,
  isSaving,
  money,
  getDisplayName,
}: {
  importSlots: ImportSlot[];
  activeSlotKey: string;
  setSelectedSlot: (value: string) => void;
  imports: Record<string, ImportedPeriod>;
  activeImport: ImportedPeriod | undefined;
  activeLines: TBLine[];
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isSaving: boolean;
  money: (value: number) => string;
  getDisplayName: (accountName: string, category: string) => string;
}) {
  return (
    <>
      <section style={card}>
        <h2 style={sectionHeading}>Import Trial Balances</h2>

        {importSlots.length === 0 ? (
          <p style={warningText}>
            Go to Setup and enter the number of periods to compare first.
          </p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 420px) minmax(260px, 520px)",
                gap: "16px",
                alignItems: "end",
              }}
            >
              <Field label="Import period">
                <select
                  value={activeSlotKey}
                  onChange={(event) => setSelectedSlot(event.target.value)}
                  style={input}
                >
                  {importSlots.map((slot) => (
                    <option key={slot.key} value={slot.key}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Trial balance file">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  style={input}
                  disabled={isSaving}
                />
              </Field>
            </div>

            <p style={{ marginTop: "10px", color: "#52616f", fontSize: "13px" }}>
              Expected Sage Online columns: Name, Category, Source, Debit, Credit
            </p>

            {isSaving && (
              <p style={{ marginTop: "10px", color: "#0f4c81", fontWeight: 700 }}>
                Saving import to Supabase...
              </p>
            )}
          </>
        )}
      </section>

      {importSlots.length > 0 && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {importSlots.map((slot) => {
            const imported = imports[slot.key];

            return (
              <button
                key={slot.key}
                onClick={() => setSelectedSlot(slot.key)}
                style={{
                  textAlign: "left",
                  background: activeSlotKey === slot.key ? "#eaf3fb" : "#ffffff",
                  border:
                    activeSlotKey === slot.key
                      ? "2px solid #0f4c81"
                      : "1px solid #dce4ec",
                  borderRadius: "16px",
                  padding: "18px",
                  boxShadow: "0 10px 30px rgba(15, 76, 129, 0.08)",
                  cursor: "pointer",
                }}
              >
                <p style={{ margin: 0, fontWeight: 800 }}>{slot.label}</p>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: imported ? "#166534" : "#52616f",
                    fontSize: "13px",
                    fontWeight: imported ? 700 : 400,
                  }}
                >
                  {imported ? imported.fileName : "Not imported yet"}
                </p>
              </button>
            );
          })}
        </section>
      )}

      {activeImport && (
        <section style={card}>
          <h2 style={sectionHeading}>{activeImport.label} Trial Balance Preview</h2>

          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr style={{ background: "#eef3f8" }}>
                  <th style={th}>Name</th>
                  <th style={th}>Category</th>
                  <th style={thRight}>Net Balance</th>
                </tr>
              </thead>

              <tbody>
                {activeLines.map((line, index) => (
                  <tr key={`${line.accountName}-${index}`}>
                    <td style={td}>{getDisplayName(line.accountName, line.category)}</td>
                    <td style={td}>{line.category}</td>
                    <td style={tdRight}>{money(line.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function IncomeStatementTable({
  rows,
  clientName,
  slots,
  money,
  getDisplayName,
  updateDisplayNameLocally,
  saveDisplayName,
}: {
  rows: ReportRow[];
  clientName: string;
  slots: ImportSlot[];
  money: (value: number) => string;
  getDisplayName: (accountName: string, category: string) => string;
  updateDisplayNameLocally: (accountName: string, category: string, value: string) => void;
  saveDisplayName: (accountName: string, category: string, value: string) => void;
}) {
  const groupedRows = rows.reduce<Record<string, ReportRow[]>>((groups, row) => {
    if (!groups[row.category]) groups[row.category] = [];
    groups[row.category].push(row);
    return groups;
  }, {});

  function categoryTotal(category: string, slotKey: string) {
    return (groupedRows[category] || []).reduce(
      (sum, row) => sum + incomeDisplayValue(row.category, row.values[slotKey] || 0),
      0
    );
  }

  function grossProfit(slotKey: string) {
    return categoryTotal("Sales", slotKey) - categoryTotal("Cost of Sales", slotKey);
  }

  function netProfit(slotKey: string) {
    return (
      grossProfit(slotKey) +
      categoryTotal("Other Income", slotKey) -
      categoryTotal("Expenses", slotKey) -
      categoryTotal("Other Expenses", slotKey)
    );
  }

  return (
    <section className="print-area" style={card}>
      <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 800, color: "#52616f" }}>
  {clientName}
</p>
<h2 style={sectionHeading}>Statement of Profit or Loss</h2>

      {slots.length === 0 ? (
        <p style={warningText}>Complete the report setup first.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
                <th style={reportTh}>Account</th>
                {slots.map((slot) => (
                  <th key={slot.key} style={reportThRight}>
                    {slot.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {incomeStatementCategories.map((category) => {
                const categoryRows = groupedRows[category] || [];
                if (categoryRows.length === 0) return null;

                return (
                  <Fragment key={category}>
                    <tr style={{ background: "#eef3f8" }}>
                      <td colSpan={slots.length + 1} style={categoryHeader}>
                        {category}
                      </td>
                    </tr>

                    {categoryRows.map((row) => (
                      <tr key={`${category}-${row.name}`}>
                        <td style={td}>
                          <EditableAccountName
                            value={getDisplayName(row.name, row.category)}
                            onChange={(value) =>
                              updateDisplayNameLocally(row.name, row.category, value)
                            }
                            onBlur={(value) => saveDisplayName(row.name, row.category, value)}
                          />
                        </td>

                        {slots.map((slot) => (
                          <td key={slot.key} style={tdRight}>
                            {money(incomeDisplayValue(row.category, row.values[slot.key] || 0))}
                          </td>
                        ))}
                      </tr>
                    ))}

                    <tr style={{ background: "#f8fafc" }}>
                      <td style={{ ...td, fontWeight: 800 }}>Total {category}</td>
                      {slots.map((slot) => (
                        <td key={slot.key} style={{ ...tdRight, fontWeight: 800 }}>
                          {money(categoryTotal(category, slot.key))}
                        </td>
                      ))}
                    </tr>

                    {category === "Cost of Sales" && (
                      <tr style={{ background: "#dbeafe" }}>
                        <td style={{ ...td, fontWeight: 900 }}>Gross Profit</td>
                        {slots.map((slot) => (
                          <td key={slot.key} style={{ ...tdRight, fontWeight: 900 }}>
                            {money(grossProfit(slot.key))}
                          </td>
                        ))}
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
                <td style={{ ...td, fontWeight: 900 }}>Net Profit</td>
                {slots.map((slot) => (
                  <td key={slot.key} style={{ ...tdRight, fontWeight: 900 }}>
                    {money(netProfit(slot.key))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SfpTable({
  rows,
  slots,
  clientName,
  imports,
  money,
  getDisplayName,
  updateDisplayNameLocally,
  saveDisplayName,
}: {
  rows: ReportRow[];
  clientName: string;
  slots: ImportSlot[];
  imports: Record<string, ImportedPeriod>;
  money: (value: number) => string;
  getDisplayName: (accountName: string, category: string) => string;
  updateDisplayNameLocally: (accountName: string, category: string, value: string) => void;
  saveDisplayName: (accountName: string, category: string, value: string) => void;
}) {
  const fixedAssets = rows.filter(isFixedAsset);
  const otherNonCurrentAssets = rows.filter(
    (row) => row.category === "Non-Current Assets" && !isFixedAsset(row)
  );

  const cash = rows.filter(isCash);
  const receivables = rows.filter(isReceivable);
  const otherCurrentAssets = rows.filter(
    (row) => row.category === "Current Assets" && !isCash(row) && !isReceivable(row)
  );

  const shareCapital = rows.filter(isShareCapital);
  const accumulatedIncome = rows.filter(
    (row) => row.category === "Owners Equity" && !isShareCapital(row)
  );

const nonCurrentLiabilities = rows.filter(
  (row) =>
    row.category === "Non-Current Liabilities" &&
    !row.name.toLowerCase().includes("loan")
);

  const vat = rows.filter(isVat);
  const incomeTax = rows.filter(isIncomeTax);
  const payables = rows.filter(isPayable);
  const otherCurrentLiabilities = rows.filter(
    (row) =>
      row.category === "Current Liabilities" &&
      !isVat(row) &&
      !isIncomeTax(row) &&
      !isPayable(row)
  );

  function assetTotal(sectionRows: ReportRow[], slotKey: string) {
    return signAsset(totalRows(sectionRows, slotKey));
  }

  function liabilityTotal(sectionRows: ReportRow[], slotKey: string) {
    return signEquityLiability(totalRows(sectionRows, slotKey));
  }

  function currentProfit(slotKey: string) {
    return calculateCurrentProfit(imports[slotKey]);
  }

  function totalNonCurrentAssets(slotKey: string) {
    return assetTotal(fixedAssets, slotKey) + assetTotal(otherNonCurrentAssets, slotKey);
  }

  function totalCurrentAssets(slotKey: string) {
    return (
      assetTotal(receivables, slotKey) +
      assetTotal(cash, slotKey) +
      assetTotal(otherCurrentAssets, slotKey)
    );
  }

  function totalAssets(slotKey: string) {
    return totalNonCurrentAssets(slotKey) + totalCurrentAssets(slotKey);
  }

  function totalEquity(slotKey: string) {
    return (
      liabilityTotal(shareCapital, slotKey) +
      liabilityTotal(accumulatedIncome, slotKey) +
      currentProfit(slotKey)
    );
  }

  function totalNonCurrentLiabilities(slotKey: string) {
    return liabilityTotal(nonCurrentLiabilities, slotKey);
  }

  function totalCurrentLiabilities(slotKey: string) {
    return (
      liabilityTotal(vat, slotKey) +
      liabilityTotal(incomeTax, slotKey) +
      liabilityTotal(payables, slotKey) +
      liabilityTotal(otherCurrentLiabilities, slotKey)
    );
  }

  function totalLiabilities(slotKey: string) {
    return totalNonCurrentLiabilities(slotKey) + totalCurrentLiabilities(slotKey);
  }

  function totalEquityAndLiabilities(slotKey: string) {
    return totalEquity(slotKey) + totalLiabilities(slotKey);
  }

  function difference(slotKey: string) {
  const liabilities =
    signEquityLiability(
      rows
        .filter((row) => row.category === "Non-Current Liabilities")
        .reduce((sum, row) => sum + (row.values[slotKey] || 0), 0)
    ) + totalCurrentLiabilities(slotKey);

  return totalAssets(slotKey) - (totalEquity(slotKey) + liabilities);
}

  return (
    <section className="print-area" style={card}>
      <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 800, color: "#52616f" }}>
  {clientName}
</p>
<h2 style={sectionHeading}>Statement of Financial Position</h2>

      {slots.length === 0 ? (
        <p style={warningText}>Complete the report setup first.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
                <th style={reportTh}>Figures in Rand</th>
                <th style={reportTh}>Note(s)</th>
                {slots.map((slot) => (
                  <th key={slot.key} style={reportThRight}>
                    {slot.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <SfpHeading title="Assets" slots={slots} />

              <SfpSubHeading title="Non-current assets" slots={slots} />
              <SfpLine label="Property, plant and equipment" note="1" rows={fixedAssets} slots={slots} money={money} sign="asset" />

              {otherNonCurrentAssets.map((row) => (
                <SfpEditableSingleLine
                  key={row.name}
                  row={row}
                  slots={slots}
                  money={money}
                  sign="asset"
                  getDisplayName={getDisplayName}
                  updateDisplayNameLocally={updateDisplayNameLocally}
                  saveDisplayName={saveDisplayName}
                />
              ))}

              <SfpSubTotal label="Total non-current assets" slots={slots} money={money} getValue={totalNonCurrentAssets} />

              <SfpSpacer slots={slots} />

              <SfpSubHeading title="Current assets" slots={slots} />
              <SfpLine label="Trade and other receivables" note="2" rows={receivables} slots={slots} money={money} sign="asset" />
              <SfpLine label="Cash and cash equivalents" note="3" rows={cash} slots={slots} money={money} sign="asset" />

              {otherCurrentAssets.map((row) => (
                <SfpEditableSingleLine
                  key={row.name}
                  row={row}
                  slots={slots}
                  money={money}
                  sign="asset"
                  getDisplayName={getDisplayName}
                  updateDisplayNameLocally={updateDisplayNameLocally}
                  saveDisplayName={saveDisplayName}
                />
              ))}

              <SfpSubTotal label="Total current assets" slots={slots} money={money} getValue={totalCurrentAssets} />
              <SfpGrandTotal label="Total assets" slots={slots} money={money} getValue={totalAssets} />

              <SfpSpacer slots={slots} />

              <SfpHeading title="Equity and liabilities" slots={slots} />

              <SfpSubHeading title="Equity" slots={slots} />
              <SfpLine label="Share capital" note="" rows={shareCapital} slots={slots} money={money} sign="liability" />
              <SfpLine label="Accumulated profit / (loss)" note="" rows={accumulatedIncome} slots={slots} money={money} sign="liability" />

              <tr>
                <td style={td}>Current year profit / (loss)</td>
                <td style={td}></td>
                {slots.map((slot) => (
                  <td key={slot.key} style={tdRight}>
                    {money(currentProfit(slot.key))}
                  </td>
                ))}
              </tr>

              <SfpSubTotal label="Total equity" slots={slots} money={money} getValue={totalEquity} />

              <SfpSpacer slots={slots} />

              <SfpSubHeading title="Liabilities" slots={slots} />
              <SfpSubHeading title="Non-current liabilities" slots={slots} indent />
              <SfpLine
  label="Loans"
  note="4"
  rows={rows.filter(
    (row) =>
      row.category === "Non-Current Liabilities" &&
      row.name.toLowerCase().includes("loan")
  )}
  slots={slots}
  money={money}
  sign="liability"
/>
              
              <SfpSubTotal
  label="Total non-current liabilities"
  slots={slots}
  money={money}
  getValue={(slotKey) =>
    signEquityLiability(
      rows
        .filter(
          (row) =>
            row.category === "Non-Current Liabilities" &&
            row.name.toLowerCase().includes("loan")
        )
        .reduce((sum, row) => sum + (row.values[slotKey] || 0), 0)
    )
  }
/>

              <SfpSubHeading title="Current liabilities" slots={slots} indent />
              <SfpLine label="VAT payable" note="" rows={vat} slots={slots} money={money} sign="liability" />
              <SfpLine label="Income tax payable" note="" rows={incomeTax} slots={slots} money={money} sign="liability" />
              <SfpLine label="Trade and other payables" note="5" rows={payables} slots={slots} money={money} sign="liability" />

              {otherCurrentLiabilities.map((row) => (
                <SfpEditableSingleLine
                  key={row.name}
                  row={row}
                  slots={slots}
                  money={money}
                  sign="liability"
                  getDisplayName={getDisplayName}
                  updateDisplayNameLocally={updateDisplayNameLocally}
                  saveDisplayName={saveDisplayName}
                />
              ))}

              <SfpSubTotal label="Total current liabilities" slots={slots} money={money} getValue={totalCurrentLiabilities} />
             <SfpSubTotal
  label="Total liabilities"
  slots={slots}
  money={money}
  getValue={(slotKey) =>
    signEquityLiability(
      rows
        .filter((row) => row.category === "Non-Current Liabilities")
        .reduce((sum, row) => sum + (row.values[slotKey] || 0), 0)
    ) + totalCurrentLiabilities(slotKey)
  }
/>
              <SfpGrandTotal
  label="Total equity and liabilities"
  slots={slots}
  money={money}
  getValue={(slotKey) =>
    totalEquity(slotKey) +
    signEquityLiability(
      rows
        .filter((row) => row.category === "Non-Current Liabilities")
        .reduce((sum, row) => sum + (row.values[slotKey] || 0), 0)
    ) +
    totalCurrentLiabilities(slotKey)
  }
/>

              <tr>
                <td style={td}>Difference check</td>
                <td style={td}></td>
                {slots.map((slot) => (
                  <td
                    key={slot.key}
                    style={{
                      ...tdRight,
                      fontWeight: 900,
                      color: Math.abs(difference(slot.key)) < 1 ? "#166534" : "#b91c1c",
                    }}
                  >
                    {money(difference(slot.key))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SfpHeading({ title, slots }: { title: string; slots: ImportSlot[] }) {
  return (
    <tr style={{ background: "#eef3f8" }}>
      <td colSpan={slots.length + 2} style={categoryHeader}>
        {title}
      </td>
    </tr>
  );
}

function SfpSubHeading({
  title,
  slots,
  indent = false,
}: {
  title: string;
  slots: ImportSlot[];
  indent?: boolean;
}) {
  return (
    <tr style={{ background: "#f8fafc" }}>
      <td colSpan={slots.length + 2} style={{ ...td, fontWeight: 900, paddingLeft: indent ? 28 : 12 }}>
        {title}
      </td>
    </tr>
  );
}

function SfpLine({
  label,
  note,
  rows,
  slots,
  money,
  sign,
}: {
  label: string;
  note: string;
  rows: ReportRow[];
  slots: ImportSlot[];
  money: (value: number) => string;
  sign: "asset" | "liability";
}) {
  const hasAnyValue = slots.some((slot) => Math.abs(totalRows(rows, slot.key)) > 0.005);
  if (!hasAnyValue) return null;

  return (
    <tr>
      <td style={td}>{label}</td>
      <td style={td}>{note}</td>
      {slots.map((slot) => {
        const rawValue = totalRows(rows, slot.key);
        const value = sign === "asset" ? signAsset(rawValue) : signEquityLiability(rawValue);

        return (
          <td key={slot.key} style={tdRight}>
            {money(value)}
          </td>
        );
      })}
    </tr>
  );
}

function SfpEditableSingleLine({
  row,
  slots,
  money,
  sign,
  getDisplayName,
  updateDisplayNameLocally,
  saveDisplayName,
}: {
  row: ReportRow;
  slots: ImportSlot[];
  money: (value: number) => string;
  sign: "asset" | "liability";
  getDisplayName: (accountName: string, category: string) => string;
  updateDisplayNameLocally: (accountName: string, category: string, value: string) => void;
  saveDisplayName: (accountName: string, category: string, value: string) => void;
}) {
  const hasAnyValue = slots.some((slot) => Math.abs(rowTotal(row, slot.key)) > 0.005);
  if (!hasAnyValue) return null;

  return (
    <tr>
      <td style={td}>
        <EditableAccountName
          value={getDisplayName(row.name, row.category)}
          onChange={(value) => updateDisplayNameLocally(row.name, row.category, value)}
          onBlur={(value) => saveDisplayName(row.name, row.category, value)}
        />
      </td>
      <td style={td}></td>
      {slots.map((slot) => {
        const rawValue = rowTotal(row, slot.key);
        const value = sign === "asset" ? signAsset(rawValue) : signEquityLiability(rawValue);

        return (
          <td key={slot.key} style={tdRight}>
            {money(value)}
          </td>
        );
      })}
    </tr>
  );
}

function SfpSubTotal({
  label,
  slots,
  money,
  getValue,
}: {
  label: string;
  slots: ImportSlot[];
  money: (value: number) => string;
  getValue: (slotKey: string) => number;
}) {
  return (
    <tr style={{ background: "#f8fafc" }}>
      <td style={{ ...td, fontWeight: 900 }}>{label}</td>
      <td style={td}></td>
      {slots.map((slot) => (
        <td key={slot.key} style={{ ...tdRight, fontWeight: 900 }}>
          {money(getValue(slot.key))}
        </td>
      ))}
    </tr>
  );
}

function SfpGrandTotal({
  label,
  slots,
  money,
  getValue,
}: {
  label: string;
  slots: ImportSlot[];
  money: (value: number) => string;
  getValue: (slotKey: string) => number;
}) {
  return (
    <tr style={{ background: "#dbeafe" }}>
      <td style={{ ...td, fontWeight: 900 }}>{label}</td>
      <td style={td}></td>
      {slots.map((slot) => (
        <td key={slot.key} style={{ ...tdRight, fontWeight: 900 }}>
          {money(getValue(slot.key))}
        </td>
      ))}
    </tr>
  );
}

function SfpSpacer({ slots }: { slots: ImportSlot[] }) {
  return (
    <tr>
      <td colSpan={slots.length + 2} style={{ height: 16 }}></td>
    </tr>
  );
}

function NotesTable({
  rows,
  clientName,
  slots,
  money,
  getDisplayName,
  updateDisplayNameLocally,
  saveDisplayName,
}: {
  rows: ReportRow[];
  clientName: string;
  slots: ImportSlot[];
  money: (value: number) => string;
  getDisplayName: (accountName: string, category: string) => string;
  updateDisplayNameLocally: (accountName: string, category: string, value: string) => void;
  saveDisplayName: (accountName: string, category: string, value: string) => void;
}) {
  const noteSections = [
    { note: "1", title: "Property, plant and equipment", rows: rows.filter(isFixedAsset), sign: "asset" as const },
    { note: "2", title: "Trade and other receivables", rows: rows.filter(isReceivable), sign: "asset" as const },
    { note: "3", title: "Cash and cash equivalents", rows: rows.filter(isCash), sign: "asset" as const },
    {
      note: "4",
      title: "Non-current liabilities",
      rows: rows.filter((row) => row.category === "Non-Current Liabilities"),
      sign: "liability" as const,
    },
    { note: "5", title: "Trade and other payables", rows: rows.filter(isPayable), sign: "liability" as const },
  ];

  return (
    <section className="print-area" style={card}>
      <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 800, color: "#52616f" }}>
  {clientName}
</p>
<h2 style={sectionHeading}>Notes to the Management Accounts</h2>

      {slots.length === 0 ? (
        <p style={warningText}>Complete the report setup first.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
                <th style={reportTh}>Note / Account</th>
                {slots.map((slot) => (
                  <th key={slot.key} style={reportThRight}>
                    {slot.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {noteSections.map((section) => {
                const hasAnyValue = section.rows.some((row) =>
                  slots.some((slot) => Math.abs(rowTotal(row, slot.key)) > 0.005)
                );

                if (!hasAnyValue) return null;

                return (
                  <Fragment key={section.note}>
                    <tr style={{ background: "#eef3f8" }}>
                      <td colSpan={slots.length + 1} style={categoryHeader}>
                        {section.note}. {section.title}
                      </td>
                    </tr>

                    {section.rows.map((row) => (
                      <tr key={`${section.note}-${row.name}`}>
                        <td style={td}>
                          <EditableAccountName
                            value={getDisplayName(row.name, row.category)}
                            onChange={(value) =>
                              updateDisplayNameLocally(row.name, row.category, value)
                            }
                            onBlur={(value) => saveDisplayName(row.name, row.category, value)}
                          />
                        </td>

                        {slots.map((slot) => {
                          const rawValue = rowTotal(row, slot.key);
                          const value =
                            section.sign === "asset"
                              ? signAsset(rawValue)
                              : signEquityLiability(rawValue);

                          return (
                            <td key={slot.key} style={tdRight}>
                              {money(value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    <tr style={{ background: "#f8fafc" }}>
                      <td style={{ ...td, fontWeight: 900 }}>Total {section.title}</td>
                      {slots.map((slot) => {
                        const rawValue = totalRows(section.rows, slot.key);
                        const value =
                          section.sign === "asset"
                            ? signAsset(rawValue)
                            : signEquityLiability(rawValue);

                        return (
                          <td key={slot.key} style={{ ...tdRight, fontWeight: 900 }}>
                            {money(value)}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function parseGraphNumber(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function BankTrendChart({
  rows,
  slots,
}: {
  rows: ReportRow[];
  slots: ImportSlot[];
}) {
  const currentAccountRows = rows.filter((row) => {
  const name = row.name.toLowerCase();

  return (
    name.includes("8400/000") ||
    name.includes("grundling management trust")
  );
});

  const callAccountRows = rows.filter((row) =>
    row.name.toLowerCase().includes("7100/003")
  );

  const chartData = slots.map((slot) => ({
    label: slot.label,
    shortLabel: slot.label.split(" ")[0].slice(0, 3),
    currentAccount: signAsset(totalRows(currentAccountRows, slot.key)),
    callAccount: signAsset(totalRows(callAccountRows, slot.key)),
  }));

  function BankSingleChart({
    title,
    valuesKey,
    color,
  }: {
    title: string;
    valuesKey: "currentAccount" | "callAccount";
    color: string;
  }) {
    const maxValue = Math.max(1, ...chartData.map((row) => row[valuesKey]));
    const roundedMax = Math.max(1000, Math.ceil(maxValue / 1000) * 1000);

    const graphHeight = 220;
    const graphWidth = 760;
    const leftPadding = 85;
    const bottomPadding = 40;
    const topPadding = 20;
    const chartInnerHeight = graphHeight - topPadding - bottomPadding;
    const monthWidth =
      (graphWidth - leftPadding - 20) / Math.max(1, chartData.length);

    function y(value: number) {
      return (
        topPadding +
        chartInnerHeight -
        (value / roundedMax) * chartInnerHeight
      );
    }

    function formatAxis(value: number) {
      return value.toLocaleString("en-ZA", {
        style: "currency",
        currency: "ZAR",
        maximumFractionDigits: 0,
      });
    }

    const points = chartData
      .map((row, index) => {
        const x = leftPadding + index * monthWidth + monthWidth / 2;
        return `${x},${y(row[valuesKey])}`;
      })
      .join(" ");

    return (
      <div style={{ ...card, marginTop: "24px" }}>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 800,
            marginBottom: "12px",
            color: "#12304a",
          }}
        >
          {title}
        </h3>

        <svg
          width="760"
          height="260"
          viewBox={`0 0 ${graphWidth} ${graphHeight}`}
          style={{ display: "block", maxWidth: "100%" }}
        >
          {[0, 1, 2, 3, 4, 5].map((step) => {
            const value = (roundedMax / 5) * step;
            const yPos = y(value);

            return (
              <g key={step}>
                <line
                  x1={leftPadding}
                  y1={yPos}
                  x2={graphWidth - 20}
                  y2={yPos}
                  stroke="#b9c7d6"
                  strokeDasharray="6 5"
                  strokeWidth="1"
                />
                <text
                  x={leftPadding - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#52616f"
                >
                  {formatAxis(value)}
                </text>
              </g>
            );
          })}

          <line
            x1={leftPadding}
            y1={topPadding}
            x2={leftPadding}
            y2={graphHeight - bottomPadding}
            stroke="#8aa0b5"
            strokeWidth="1"
          />

          <line
            x1={leftPadding}
            y1={graphHeight - bottomPadding}
            x2={graphWidth - 20}
            y2={graphHeight - bottomPadding}
            stroke="#8aa0b5"
            strokeWidth="1"
          />

          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {chartData.map((row, index) => {
            const x = leftPadding + index * monthWidth + monthWidth / 2;
            const yPos = y(row[valuesKey]);

            return (
              <g key={row.label}>
                <circle cx={x} cy={yPos} r="5" fill={color} />
                <text
                  x={x}
                  y={graphHeight - 16}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#52616f"
                >
                  {row.shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <>
      <BankSingleChart
        title="Current Account Trend"
        valuesKey="currentAccount"
        color="#0f4c81"
      />

      <BankSingleChart
        title="Call Account Trend"
        valuesKey="callAccount"
        color="#2f855a"
      />
    </>
  );
}

function SalesComparisonChart({
  manualGraphMonths,
  graphYearLabels,
}: {
  manualGraphMonths: ManualGraphMonth[];
  graphYearLabels: {
    year1: string;
    year2: string;
    year3: string;
  };
}) {
  const chartData = manualGraphMonths.map((row) => ({
    month: row.month.slice(0, 3),
    year1: parseGraphNumber(row.year1Sales),
    year2: parseGraphNumber(row.year2Sales),
    year3: parseGraphNumber(row.year3Sales),
  }));

  const maxValue = Math.max(
    1,
    ...chartData.flatMap((row) => [row.year1, row.year2, row.year3])
  );

  const roundedMax = Math.ceil(maxValue / 1000000) * 1000000;
  const graphHeight = 220;
  const graphWidth = 760;
  const leftPadding = 85;
  const bottomPadding = 40;
  const topPadding = 20;
  const chartInnerHeight = graphHeight - topPadding - bottomPadding;
  const barMaxHeight = chartInnerHeight;
  const monthWidth = (graphWidth - leftPadding - 20) / chartData.length;

  function y(value: number) {
    return topPadding + chartInnerHeight - (value / roundedMax) * chartInnerHeight;
  }

  function formatAxis(value: number) {
    return `R${Math.round(value / 1000000)},000,000`;
  }

  return (
    <div style={{ ...card, marginTop: "24px" }}>
      <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "12px", color: "#12304a" }}>
        Sales History
      </h3>

      <svg
  width="760"
  height="260"
  viewBox={`0 0 ${graphWidth} ${graphHeight}`}
  style={{ display: "block", maxWidth: "100%" }}
>
        {[0, 1, 2, 3, 4, 5].map((step) => {
          const value = (roundedMax / 5) * step;
          const yPos = y(value);

          return (
            <g key={step}>
              <line
                x1={leftPadding}
                y1={yPos}
                x2={graphWidth - 20}
                y2={yPos}
                stroke="#b9c7d6"
                strokeDasharray="6 5"
                strokeWidth="1"
              />
              <text
                x={leftPadding - 8}
                y={yPos + 4}
                textAnchor="end"
                fontSize="12"
                fill="#52616f"
              >
                {value === 0 ? "R0" : formatAxis(value)}
              </text>
            </g>
          );
        })}

        <line
          x1={leftPadding}
          y1={topPadding}
          x2={leftPadding}
          y2={graphHeight - bottomPadding}
          stroke="#8aa0b5"
          strokeWidth="1"
        />

        <line
          x1={leftPadding}
          y1={graphHeight - bottomPadding}
          x2={graphWidth - 20}
          y2={graphHeight - bottomPadding}
          stroke="#8aa0b5"
          strokeWidth="1"
        />

        {chartData.map((row, index) => {
          const xBase = leftPadding + index * monthWidth + 12;
          const barWidth = 12;

          const bars = [
            { value: row.year1, color: "#3366cc" },
            { value: row.year2, color: "#00a6d6" },
            { value: row.year3, color: "#f59e0b" },
          ];

          return (
            <g key={row.month}>
              {bars.map((bar, barIndex) => {
                const barHeight = barMaxHeight - (y(bar.value) - topPadding);

                return (
                  <rect
                    key={barIndex}
                    x={xBase + barIndex * (barWidth + 3)}
                    y={y(bar.value)}
                    width={barWidth}
                    height={Math.max(0, barHeight)}
                    fill={bar.color}
                  />
                );
              })}

              <text
                x={xBase + 18}
                y={graphHeight - 16}
                textAnchor="middle"
                fontSize="12"
                fill="#52616f"
              >
                {row.month}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "8px", fontSize: "13px", color: "#52616f" }}>
        <span><span style={{ color: "#3366cc", fontWeight: 900 }}>■</span> {graphYearLabels.year1}</span>
<span><span style={{ color: "#00a6d6", fontWeight: 900 }}>■</span> {graphYearLabels.year2}</span>
<span><span style={{ color: "#f59e0b", fontWeight: 900 }}>■</span> {graphYearLabels.year3}</span>
      </div>
    </div>
  );
}

function GraphsAnalysisTab({
  manualGraphMonths,
  graphYearLabels,
  rows,
  slots,
  updateManualGraphMonth,
}: {
  manualGraphMonths: ManualGraphMonth[];
  graphYearLabels: {
    year1: string;
    year2: string;
    year3: string;
  };
  rows: ReportRow[];
  slots: ImportSlot[];
  updateManualGraphMonth: (
    monthIndex: number,
    field: keyof ManualGraphMonth,
    value: string
  ) => void;
}) {
  return (
    <section style={card}>
      <h2 style={sectionHeading}>Sales Graph Input</h2>

      <p style={{ margin: "0 0 18px", color: "#52616f", fontSize: "14px" }}>
        Enter sales figures for the Sales History graph. 
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={table}>
          <thead>
            <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
              <th style={reportTh}>Month</th>
              <th style={reportThRight}>Year 1 Sales</th>
              <th style={reportThRight}>Year 1 Cost of Sales</th>
              <th style={reportThRight}>Year 2 Sales</th>
              <th style={reportThRight}>Year 2 Cost of Sales</th>
              <th style={reportThRight}>Year 3 Sales</th>
              <th style={reportThRight}>Year 3 Cost of Sales</th>
            </tr>
          </thead>

          <tbody>
            {manualGraphMonths.map((row, index) => (
              <tr key={row.month}>
                <td style={td}>{row.month}</td>

                {(
                  [
                    "year1Sales",
                    "year1CostOfSales",
                    "year2Sales",
                    "year2CostOfSales",
                    "year3Sales",
                    "year3CostOfSales",
                  ] as (keyof ManualGraphMonth)[]
                ).map((field) => (
                  <td key={field} style={tdRight}>
                    <input
                      value={row[field]}
                      onChange={(event) =>
                        updateManualGraphMonth(index, field, event.target.value)
                      }
                      placeholder="0.00"
                      style={{
                        ...input,
                        textAlign: "right",
                        minWidth: "130px",
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SalesComparisonChart
  manualGraphMonths={manualGraphMonths}
  graphYearLabels={graphYearLabels}
/>
<BankTrendChart
  rows={rows}
  slots={slots}
/>
    </section>
  );
}

function ManagementPack({
  clientName,
  manualGraphMonths,
  rows,
  incomeRows,
  slots,
  imports,
  money,
  getDisplayName,
}: {
  clientName: string;
  manualGraphMonths: ManualGraphMonth[];
  rows: ReportRow[];
  incomeRows: ReportRow[];
  slots: ImportSlot[];
  imports: Record<string, ImportedPeriod>;
  money: (value: number) => string;
  getDisplayName: (accountName: string, category: string) => string;
}) {
  return (
    <section className="print-area management-pack-print" style={card}>
      <div className="pack-cover-page">
        <div>

          <h1 style={{ margin: "18px 0 8px", fontSize: "34px", color: "#0f4c81" }}>
            Management Accounts
          </h1>

          <h2 style={{ margin: 0, fontSize: "24px" }}>{clientName}</h2>

          <p style={{ marginTop: "22px", fontSize: "16px", color: "#52616f" }}>
            For the period {slots[0]?.label || ""} to {slots[slots.length - 1]?.label || ""}
          </p>
        </div>
      </div>

      <div className="pack-index-page">
        <h2 style={sectionHeading}>Index</h2>

        <table style={table}>
          <tbody>
            <tr>
              <td style={td}>1. Statement of Financial Position</td>
              <td style={tdRight}>Page 3</td>
            </tr>
            <tr>
              <td style={td}>2. Notes to the Management Accounts</td>
              <td style={tdRight}>Page 4</td>
            </tr>
            <tr>
              <td style={td}>3. Statement of Profit or Loss</td>
              <td style={tdRight}>Page 5</td>
            </tr>
<tr>
              <td style={td}>4. Graphs</td>
              <td style={tdRight}>Page 6</td>
            </tr>


          </tbody>
        </table>
      </div>

      <div className="pack-report-page">
        <SfpTable
          rows={rows}
          clientName={clientName}
          slots={slots}
          imports={imports}
          money={money}
          getDisplayName={getDisplayName}
          updateDisplayNameLocally={() => {}}
          saveDisplayName={() => {}}
        />

        
      </div>

      <div className="pack-report-page">
        <NotesTable
          rows={rows}
          clientName={clientName}
          slots={slots}
          money={money}
          getDisplayName={getDisplayName}
          updateDisplayNameLocally={() => {}}
          saveDisplayName={() => {}}
        />
      </div>

      <div className="pack-report-page">
        <IncomeStatementTable
          rows={incomeRows}
          clientName={clientName}
          slots={slots}
          money={money}
          getDisplayName={getDisplayName}
          updateDisplayNameLocally={() => {}}
          saveDisplayName={() => {}}
        />
      </div>
      <div className="pack-report-page graph-pack-page">
<div style={{ marginBottom: "10px" }}>
  <p style={{ margin: "0 0 4px 0", fontSize: "11px", fontWeight: 700, color: "#52616f" }}>
    {clientName}
  </p>
  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: "#12304a" }}>
    Graphs and Analysis
  </h2>
</div>
        
  <SalesComparisonChart
  manualGraphMonths={manualGraphMonths}
  graphYearLabels={{ year1: "2025", year2: "2026", year3: "2027" }}
/>
<BankTrendChart
  rows={rows}
  slots={slots}
/>
</div>
    </section>
  );
}

function BalanceSheetDetailTable({
  rows,
  slots,
  money,
  getDisplayName,
  updateDisplayNameLocally,
  saveDisplayName,
}: {
  rows: ReportRow[];
  slots: ImportSlot[];
  money: (value: number) => string;
  getDisplayName: (accountName: string, category: string) => string;
  updateDisplayNameLocally: (accountName: string, category: string, value: string) => void;
  saveDisplayName: (accountName: string, category: string, value: string) => void;
}) {
  const groupedRows = rows.reduce<Record<string, ReportRow[]>>((groups, row) => {
    if (!groups[row.category]) groups[row.category] = [];
    groups[row.category].push(row);
    return groups;
  }, {});

  return (
    <section style={card}>
      <h2 style={sectionHeading}>Balance Sheet Detail</h2>

      {slots.length === 0 ? (
        <p style={warningText}>Complete the report setup first.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
                <th style={reportTh}>Account</th>
                {slots.map((slot) => (
                  <th key={slot.key} style={reportThRight}>
                    {slot.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {Object.entries(groupedRows).map(([category, categoryRows]) => {
                return (
                  <Fragment key={category}>
                    <tr style={{ background: "#eef3f8" }}>
                      <td colSpan={slots.length + 1} style={categoryHeader}>
                        {category}
                      </td>
                    </tr>

                    {categoryRows.map((row) => (
                      <tr key={`${category}-${row.name}`}>
                        <td style={td}>
                          <EditableAccountName
                            value={getDisplayName(row.name, row.category)}
                            onChange={(value) =>
                              updateDisplayNameLocally(row.name, row.category, value)
                            }
                            onBlur={(value) => saveDisplayName(row.name, row.category, value)}
                          />
                        </td>

                        {slots.map((slot) => (
                          <td key={slot.key} style={tdRight}>
                            {money(row.values[slot.key] || 0)}
                          </td>
                        ))}
                      </tr>
                    ))}

                    <tr style={{ background: "#f8fafc" }}>
                      <td style={{ ...td, fontWeight: 800 }}>Total {category}</td>
                      {slots.map((slot) => (
                        <td key={slot.key} style={{ ...tdRight, fontWeight: 800 }}>
                          {money(totalRows(categoryRows, slot.key))}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const sideNav: React.CSSProperties = {
  background: "#ffffff",
  borderRight: "1px solid #dce4ec",
  minHeight: "calc(100vh - 60px)",
  boxShadow: "8px 0 22px rgba(15, 76, 129, 0.04)",
};

const sideNavButton: React.CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: "0 14px 14px 0",
  fontWeight: 800,
  textAlign: "left",
  cursor: "pointer",
};

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dce4ec",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 10px 30px rgba(15, 76, 129, 0.08)",
  marginBottom: "24px",
};

const summaryCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dce4ec",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 10px 30px rgba(15, 76, 129, 0.08)",
};

const sectionHeading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  marginBottom: "16px",
};

const input: React.CSSProperties = {
  padding: "14px",
  border: "1px solid #ccd6e0",
  borderRadius: "12px",
  background: "#ffffff",
  width: "100%",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #dce4ec",
};

const thRight: React.CSSProperties = {
  ...th,
  textAlign: "right",
};

const reportTh: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #dce4ec",
  whiteSpace: "nowrap",
};

const reportThRight: React.CSSProperties = {
  ...reportTh,
  textAlign: "right",
};

const td: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #eef2f6",
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
};

const categoryHeader: React.CSSProperties = {
  padding: "12px",
  fontWeight: 800,
  borderBottom: "1px solid #dce4ec",
};

const warningText: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px 16px",
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: "12px",
  color: "#9a3412",
  fontWeight: 700,
};