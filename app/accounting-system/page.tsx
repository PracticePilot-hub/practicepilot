"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

type AccountingClient = {
  id: string;
  client_name: string;
};

type AccountingAccount = {
  id: string;
  client_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
};

type TrialBalanceRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  balance: number;
};

const defaultChartOfAccounts = [
  { account_code: "1000", account_name: "Current Bank Account", account_type: "Assets - Current - Cash and Cash Equivalents" },
  { account_code: "1010", account_name: "Savings / Call Account", account_type: "Assets - Current - Cash and Cash Equivalents" },
  { account_code: "1020", account_name: "Cash on Hand", account_type: "Assets - Current - Cash and Cash Equivalents" },
  { account_code: "1100", account_name: "Trade Receivables", account_type: "Assets - Current - Other Current Assets" },
  { account_code: "1200", account_name: "VAT Control", account_type: "Assets - Current - Other Current Assets" },
  { account_code: "1300", account_name: "Loans Receivable", account_type: "Assets - Current - Other Current Assets" },
  { account_code: "1400", account_name: "Investments", account_type: "Assets - Current - Other Current Assets" },
  { account_code: "1410", account_name: "Money Market Investment", account_type: "Assets - Current - Cash and Cash Equivalents" },
  { account_code: "1420", account_name: "Other Investments", account_type: "Assets - Current - Other Current Assets" },

  { account_code: "1500", account_name: "Motor Vehicles at Cost", account_type: "Assets - Non Current - Fixed Assets" },
  { account_code: "1501", account_name: "Accumulated Depreciation - Motor Vehicles", account_type: "Assets - Non Current - Fixed Assets" },
  { account_code: "1510", account_name: "Computer Equipment at Cost", account_type:"Assets - Non Current - Fixed Assets" },
  { account_code: "1511", account_name: "Accumulated Depreciation - Computer Equipment", account_type: "Assets - Non Current - Fixed Assets" },
  { account_code: "1520", account_name: "Furniture and Equipment at Cost", account_type: "Assets - Non Current - Fixed Assets" },
  { account_code: "1521", account_name: "Accumulated Depreciation - Furniture and Equipment", account_type: "Assets - Non Current - Fixed Assets" },
  { account_code: "1530", account_name: "Plant and Equipment at Cost", account_type: "Assets - Non Current - Fixed Assets" },
  { account_code: "1531", account_name: "Accumulated Depreciation - Plant and Equipment", account_type: "Assets - Non Current - Fixed Assets" },
  { account_code: "1540", account_name: "Leasehold Improvements at Cost", account_type: "Assets - Non Current - Fixed Assets" },
  { account_code: "1541", account_name: "Accumulated Depreciation - Leasehold Improvements", account_type: "Assets - Non Current - Fixed Assets" },

  { account_code: "2000", account_name: "Trade Payables", account_type: "Liabilities - Current" },
  { account_code: "2200", account_name: "Payroll Liabilities", account_type: "Liabilities - Current" },
  { account_code: "2300", account_name: "Income Tax Payable", account_type: "Liabilities - Current" },
  { account_code: "2400", account_name: "Loans Payable", account_type: "Liabilities - Current" },
  { account_code: "2500", account_name: "Long-Term Loans", account_type: "Liabilities - Non Current" },

  { account_code: "3000", account_name: "Share Capital / Members Interest / Trust Capital", account_type: "Equity - Share Capital / Members Interest / Trust Capital" },
  { account_code: "3100", account_name: "Retained Earnings", account_type: "Equity - Retained Earnings" },
  { account_code: "3200", account_name: "Current Year Profit / Loss", account_type: "Equity - Retained Earnings" },
  { account_code: "3300", account_name: "Owner Drawings / Distributions", account_type: "Equity - Other Equity" },
  { account_code: "3400", account_name: "Other Equity", account_type: "Equity - Other Equity" },

  { account_code: "4000", account_name: "Sales", account_type: "Income - Revenue from Trading Activities" },
  { account_code: "4100", account_name: "Service Income", account_type: "Income - Revenue from Trading Activities" },
  { account_code: "4200", account_name: "Interest Received", account_type: "Income - Revenue from Investment Activities" },
  { account_code: "4300", account_name: "Other Income", account_type: "Other Income" },

  { account_code: "5000", account_name: "Cost of Sales", account_type: "Expenses - Cost of Sales" },
  { account_code: "5100", account_name: "Purchases", account_type: "Expenses - Cost of Sales" },

  { account_code: "6000", account_name: "Accounting Fees", account_type: "Expenses - Other Expenses" },
  { account_code: "6010", account_name: "Advertising and Marketing", account_type: "Expenses - Other Expenses" },
  { account_code: "6020", account_name: "Bank Charges", account_type: "Expenses - Finance Cost" },
  { account_code: "6030", account_name: "Computer Expenses", account_type: "Expenses - Other Expenses" },
  { account_code: "6040", account_name: "Depreciation", account_type: "Expenses - Other Expenses" },
  { account_code: "6050", account_name: "Insurance", account_type: "Expenses - Other Expenses" },
  { account_code: "6060", account_name: "Motor Vehicle Expenses", account_type: "Expenses - Other Expenses" },
  { account_code: "6070", account_name: "Printing and Stationery", account_type: "Expenses - Other Expenses" },
  { account_code: "6080", account_name: "Rent", account_type: "Expenses - Other Expenses" },
  { account_code: "6090", account_name: "Repairs and Maintenance", account_type: "Expenses - Other Expenses" },
  { account_code: "6100", account_name: "Salaries and Wages", account_type: "Expenses - Other Expenses" },
  { account_code: "6110", account_name: "Telephone and Internet", account_type: "Expenses - Other Expenses" },
  { account_code: "6120", account_name: "Travel and Accommodation", account_type: "Expenses - Other Expenses" },
  { account_code: "6130", account_name: "Utilities - Electricity and Water", account_type: "Expenses - Other Expenses" },
  { account_code: "6140", account_name: "Interest Paid", account_type: "Expenses - Finance Cost" },
  { account_code: "6150", account_name: "Income Tax Expense", account_type: "Expenses - Tax" },
  { account_code: "6160", account_name: "Consumables", account_type: "Expenses - Other Expenses" },
];

export default function AccountingSystemPage() {
  const [clients, setClients] = useState<AccountingClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [activeTab, setActiveTab] = useState("Setup");
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
const [newAccountCode, setNewAccountCode] = useState("");
const [newAccountName, setNewAccountName] = useState("");
const [newAccountType, setNewAccountType] = useState("Asset");
type CashbookBatchRow = {
  date: string;
  description: string;
  moneyIn: string;
  moneyOut: string;
  allocationType: "Account" | "Client" | "Supplier" | "VAT" | "Transfer";
  accountId: string;
  accountSearch: string;
};

type GeneralJournalRow = {
  accountId: string;
  accountSearch: string;
  debit: string;
  credit: string;
  notes: string;
};

type CashbookSortField = "date" | "description" | "moneyIn" | "moneyOut";

const [cashbookBankAccountId, setCashbookBankAccountId] = useState("");
const [cashbookRows, setCashbookRows] = useState<CashbookBatchRow[]>(
  Array.from({ length: 10 }, () => ({
    date: "",
    description: "",
    moneyIn: "",
    moneyOut: "",
    allocationType: "Account" as const,
    accountId: "",
    accountSearch: "",
  }))
);

const [trialBalanceRows, setTrialBalanceRows] = useState<TrialBalanceRow[]>([]);
const [isPostingCashbook, setIsPostingCashbook] = useState(false);
const [cashbookSort, setCashbookSort] = useState<{
  field: CashbookSortField;
  direction: "asc" | "desc";
} | null>(null);

const [journalNumber, setJournalNumber] = useState("");
const [journalDate, setJournalDate] = useState("");
const [journalDescription, setJournalDescription] = useState("");
const [journalRows, setJournalRows] = useState<GeneralJournalRow[]>(
  Array.from({ length: 8 }, () => ({
    accountId: "",
    accountSearch: "",
    debit: "",
    credit: "",
    notes: "",
  }))
);

useEffect(() => {
  loadClients();
}, []);

useEffect(() => {
  if (selectedClientId) {
    loadAccounts(selectedClientId);
    loadCashbookDraft(selectedClientId);

    if (activeTab === "Trial Balance") {
      loadTrialBalance();
    }

    if (activeTab === "Journals" && !journalNumber) {
      generateNextJournalNumber();
    }
  }
}, [selectedClientId, activeTab, journalNumber]);

  async function loadClients() {
    const { data, error } = await supabase
      .from("accounting_clients")
      .select("*")
      .order("client_name");

    if (error) {
      alert(error.message);
      return;
    }

    setClients(data || []);

    if (data && data.length > 0) {
      setSelectedClientId(data[0].id);
    }
  }

  async function loadAccounts(clientId: string) {
  const { data, error } = await supabase
    .from("accounting_accounts")
    .select("*")
    .eq("client_id", clientId)
    .order("account_code");

  if (error) {
    alert(error.message);
    return;
  }

  setAccounts(data || []);
}

async function loadCashbookDraft(clientId: string) {
  const { data, error } = await supabase
    .from("accounting_cashbook_drafts")
    .select("bank_account_id, draft_rows")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    alert(error.message);
    return;
  }

  if (!data) return;

  setCashbookBankAccountId(data.bank_account_id || "");

  if (Array.isArray(data.draft_rows) && data.draft_rows.length > 0) {
    setCashbookRows(data.draft_rows);
  }
}

async function saveCashbookDraft(
  nextRows: CashbookBatchRow[],
  nextBankAccountId = cashbookBankAccountId
) {
  if (!selectedClientId) return;

  const hasRows = nextRows.some(
    (row) =>
      row.date ||
      row.description ||
      row.moneyIn ||
      row.moneyOut ||
      row.accountId ||
      row.accountSearch
  );

  const { error } = await supabase
    .from("accounting_cashbook_drafts")
    .upsert(
      {
        client_id: selectedClientId,
        bank_account_id: nextBankAccountId || null,
        draft_rows: hasRows ? nextRows : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    );

  if (error) {
    alert(error.message);
  }
}
  async function addClient() {
  const cleanName = newClientName.trim();

  if (!cleanName) {
    alert("Please enter a client name.");
    return;
  }

  const { data, error } = await supabase
    .from("accounting_clients")
    .insert({ client_name: cleanName })
    .select("*")
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  setClients((current) =>
    [...current, data].sort((a, b) =>
      a.client_name.localeCompare(b.client_name)
    )
  );

  setSelectedClientId(data.id);
  setNewClientName("");
}

async function addAccount() {
  if (!selectedClientId) {
    alert("Please select a client first.");
    return;
  }

  const cleanCode = newAccountCode.trim();
  const cleanName = newAccountName.trim();

  if (!cleanCode || !cleanName) {
    alert("Please enter an account code and account name.");
    return;
  }

  const { data, error } = await supabase
    .from("accounting_accounts")
    .insert({
      client_id: selectedClientId,
      account_code: cleanCode,
      account_name: cleanName,
      account_type: newAccountType,
    })
    .select("*")
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  setAccounts((current) =>
    [...current, data].sort((a, b) =>
      a.account_code.localeCompare(b.account_code)
    )
  );

  setNewAccountCode("");
  setNewAccountName("");
  setNewAccountType("Asset");
}

async function loadDefaultChartOfAccounts() {
  if (!selectedClientId) {
    alert("Please select a client first.");
    return;
  }

  if (accounts.length > 0) {
    const confirmed = window.confirm(
      "This client already has accounts. Do you still want to load the default chart of accounts?"
    );

    if (!confirmed) return;
  }

  const accountsToInsert = defaultChartOfAccounts.map((account) => ({
    client_id: selectedClientId,
    account_code: account.account_code,
    account_name: account.account_name,
    account_type: account.account_type,
  }));

  const { error } = await supabase
    .from("accounting_accounts")
    .upsert(accountsToInsert, {
      onConflict: "client_id,account_code",
    });

  if (error) {
    alert(error.message);
    return;
  }

  await loadAccounts(selectedClientId);
}

function parseImportedDate(value: unknown) {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) return "";

    const year = parsed.y;
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

const raw = String(value).trim();

if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

if (ddmmyyyy) {
  const day = ddmmyyyy[1].padStart(2, "0");
  const month = ddmmyyyy[2].padStart(2, "0");
  const year = ddmmyyyy[3];

  return `${year}-${month}-${day}`;
}

const date = new Date(raw);

if (Number.isNaN(date.getTime())) return "";

return date.toISOString().slice(0, 10);
}

function parseImportedAmount(value: unknown) {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  const numberValue = Number(cleaned);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

async function importBankStatement(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const data = e.target?.result;
    const workbook = XLSX.read(data, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
      header: 1,
      defval: "",
    });

    const importedRows: CashbookBatchRow[] = rows
      .slice(1)
      .map((row) => {
        const amount = parseImportedAmount(row[2]);

    return {
  date: parseImportedDate(row[0]),
  description: String(row[1] || ""),
  moneyIn: amount > 0 ? String(amount) : "",
  moneyOut: amount < 0 ? String(Math.abs(amount)) : "",
  allocationType: "Account" as const,
  accountId: "",
  accountSearch: "",
};
      })
      .filter((row) => row.date || row.description || row.moneyIn || row.moneyOut);

    const nextRows = importedRows.length > 0 ? importedRows : cashbookRows;

setCashbookRows(nextRows);
saveCashbookDraft(nextRows);
  };

  reader.readAsArrayBuffer(file);
  event.target.value = "";
}

function sortCashbookRows(field: CashbookSortField) {
  const nextDirection =
    cashbookSort?.field === field && cashbookSort.direction === "asc"
      ? "desc"
      : "asc";

  setCashbookSort({ field, direction: nextDirection });

  setCashbookRows((current) =>
    [...current].sort((a, b) => {
      const aValue = a[field] || "";
      const bValue = b[field] || "";

      let result = 0;

      if (field === "moneyIn" || field === "moneyOut") {
        result = Number(aValue || 0) - Number(bValue || 0);
      } else {
        result = aValue.localeCompare(bValue);
      }

      return nextDirection === "asc" ? result : result * -1;
    })
  );
}

function updateGeneralJournalRow(
  rowIndex: number,
  field: keyof GeneralJournalRow,
  value: string
) {
  setJournalRows((current) =>
    current.map((row, index) =>
      index === rowIndex ? { ...row, [field]: value } : row
    )
  );
}

function updateCashbookRow(
  rowIndex: number,
  field: keyof CashbookBatchRow,
  value: string
) {
  setCashbookRows((current) => {
    const nextRows = current.map((row, index) =>
      index === rowIndex ? { ...row, [field]: value } : row
    );

    saveCashbookDraft(nextRows);

    return nextRows;
  });
}

function accountLabel(account: AccountingAccount) {
  return `${account.account_code} - ${account.account_name}`;
}

function findAccountByLabel(label: string) {
  return accounts.find((account) => accountLabel(account) === label);
}

async function postGeneralJournalBatch() {
  if (!selectedClientId) {
    alert("Please select a client first.");
    return;
  }

  if (!journalNumber.trim() || !journalDate || !journalDescription.trim()) {
  alert("Please enter the journal number, date and description.");
  return;
}

  const validRows = journalRows.filter((row) => {
    const debit = Number(row.debit || 0);
    const credit = Number(row.credit || 0);

    return row.accountId && (debit > 0 || credit > 0);
  });

  if (validRows.length < 2) {
    alert("Please enter at least two journal lines.");
    return;
  }

  const totalDebit = validRows.reduce(
    (sum, row) => sum + Number(row.debit || 0),
    0
  );

  const totalCredit = validRows.reduce(
    (sum, row) => sum + Number(row.credit || 0),
    0
  );

  if (totalDebit !== totalCredit) {
    alert("Journal does not balance. Total debits must equal total credits.");
    return;
  }

  for (const row of validRows) {
    if (Number(row.debit || 0) > 0 && Number(row.credit || 0) > 0) {
      alert("A journal line cannot have both debit and credit.");
      return;
    }
  }

  const { data: journal, error: journalError } = await supabase
    .from("accounting_journals")
 .insert({
  client_id: selectedClientId,
  journal_number: journalNumber.trim(),
  journal_date: journalDate,
  description: journalDescription.trim(),
  source: "General Journal",
})
    .select("*")
    .single();

  if (journalError) {
    alert(journalError.message);
    return;
  }

  const lines = validRows.map((row) => ({
    journal_id: journal.id,
    client_id: selectedClientId,
    account_id: row.accountId,
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    description: row.notes.trim() || journalDescription.trim(),
  }));

  const { error: linesError } = await supabase
    .from("accounting_journal_lines")
    .insert(lines);

  if (linesError) {
    alert(linesError.message);
    return;
  }

  setJournalNumber("");
  setJournalDate("");
  setJournalDescription("");
  setJournalRows(
    Array.from({ length: 8 }, () => ({
      accountId: "",
      accountSearch: "",
      debit: "",
      credit: "",
      notes: "",
    }))
  );

  alert("Journal posted.");
}

async function postCashbookBatch() {
    if (isPostingCashbook) return;

setIsPostingCashbook(true);

  if (!selectedClientId) {
    alert("Please select a client first.");
    return;
  }

  

try {

  if (!cashbookBankAccountId) {
    alert("Please select the bank account.");
    return;
  }

  const validRows = cashbookRows.filter((row) => {
    const moneyIn = Number(row.moneyIn || 0);
    const moneyOut = Number(row.moneyOut || 0);

    return row.date && row.description && row.accountId && (moneyIn > 0 || moneyOut > 0);
  });

  if (validRows.length === 0) {
    alert("Please enter at least one complete cashbook line.");
    return;
  }

let postedCount = 0;
let matchedTransferCount = 0;

  for (const row of validRows) {
    const moneyIn = Number(row.moneyIn || 0);
    const moneyOut = Number(row.moneyOut || 0);

    if (moneyIn > 0 && moneyOut > 0) {
      alert("A line cannot have both Money In and Money Out.");
      return;
    }

    const amount = moneyIn > 0 ? moneyIn : moneyOut;
    const isTransfer = row.allocationType === "Transfer";
    if (isTransfer) {
  const transferFromAccountId = moneyOut > 0 ? cashbookBankAccountId : row.accountId;
  const transferToAccountId = moneyOut > 0 ? row.accountId : cashbookBankAccountId;

  const { data: existingTransfer, error: transferMatchError } = await supabase
    .from("accounting_bank_transfers")
    .select("*")
    .eq("client_id", selectedClientId)
.eq("from_account_id", transferFromAccountId)
.eq("to_account_id", transferToAccountId)
    .eq("amount", amount)
    .eq("status", "Open")
    .maybeSingle();

  if (transferMatchError) {
    alert(transferMatchError.message);
    return;
  }

  if (existingTransfer) {
    const { error: matchUpdateError } = await supabase
      .from("accounting_bank_transfers")
      .update({
        status: "Matched",
        matched_at: new Date().toISOString(),
      })
      .eq("id", existingTransfer.id);

    if (matchUpdateError) {
      alert(matchUpdateError.message);
      return;
    }
matchedTransferCount += 1;
    continue;
  }
}

    const { data: journal, error: journalError } = await supabase
      .from("accounting_journals")
      .insert({
        client_id: selectedClientId,
        journal_date: row.date,
        description: row.description,
        source: "Cashbook",
      })
      .select("*")
      .single();

    if (journalError) {
      alert(journalError.message);
      return;
    }

    const lines =
      moneyIn > 0
        ? [
            {
              journal_id: journal.id,
              client_id: selectedClientId,
              account_id: cashbookBankAccountId,
              debit: amount,
              credit: 0,
              description: row.description,
            },
            {
              journal_id: journal.id,
              client_id: selectedClientId,
              account_id: row.accountId,
              debit: 0,
              credit: amount,
              description: row.description,
            },
          ]
        : [
            {
              journal_id: journal.id,
              client_id: selectedClientId,
              account_id: cashbookBankAccountId,
              debit: 0,
              credit: amount,
              description: row.description,
            },
            {
              journal_id: journal.id,
              client_id: selectedClientId,
              account_id: row.accountId,
              debit: amount,
              credit: 0,
              description: row.description,
            },
          ];

    const { error: linesError } = await supabase
      .from("accounting_journal_lines")
      .insert(lines);

    if (linesError) {
      alert(linesError.message);
      return;
    }
    postedCount += 1;

    if (isTransfer) {
  const transferFromAccountId =
    moneyOut > 0 ? cashbookBankAccountId : row.accountId;

  const transferToAccountId =
    moneyOut > 0 ? row.accountId : cashbookBankAccountId;

  const { error: transferError } = await supabase
    .from("accounting_bank_transfers")
    .insert({
      client_id: selectedClientId,
      journal_id: journal.id,
      from_account_id: transferFromAccountId,
      to_account_id: transferToAccountId,
      transfer_date: row.date,
      amount,
      description: row.description,
      status: "Open",
    });

  if (transferError) {
    alert(transferError.message);
    return;
  }
}
  }

  

setCashbookRows(
  Array.from({ length: 10 }, () => ({
    date: "",
    description: "",
    moneyIn: "",
    moneyOut: "",
    allocationType: "Account" as const,
    accountId: "",
    accountSearch: "",
  }))
);

  alert(
  `${postedCount} cashbook line(s) posted.\n${matchedTransferCount} transfer line(s) matched and skipped.`
);
} finally {
  setIsPostingCashbook(false);
}
}

async function generateNextJournalNumber() {
  if (!selectedClientId) return;

  const { data, error } = await supabase
    .from("accounting_journals")
    .select("journal_number")
    .eq("client_id", selectedClientId)
    .eq("source", "General Journal")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    alert(error.message);
    return;
  }

  const numbers = (data || [])
    .map((journal) => journal.journal_number || "")
    .map((number) => {
      const match = number.match(/^GJ(\d+)$/);
      return match ? Number(match[1]) : 0;
    });

  const nextNumber = Math.max(0, ...numbers) + 1;

  setJournalNumber(`GJ${String(nextNumber).padStart(3, "0")}`);
}

async function loadTrialBalance() {
  if (!selectedClientId) return;

  const { data, error } = await supabase
    .from("accounting_journal_lines")
    .select(`
      account_id,
      debit,
      credit,
      accounting_accounts (
        account_code,
        account_name,
        account_type
      )
    `)
    .eq("client_id", selectedClientId);

  if (error) {
    alert(error.message);
    return;
  }

  const grouped: Record<string, TrialBalanceRow> = {};

  (data || []).forEach((line: any) => {
    const account = line.accounting_accounts;

    if (!account) return;

    if (!grouped[line.account_id]) {
      grouped[line.account_id] = {
        account_id: line.account_id,
        account_code: account.account_code,
        account_name: account.account_name,
        account_type: account.account_type,
        debit: 0,
        credit: 0,
        balance: 0,
      };
    }

    grouped[line.account_id].debit += Number(line.debit || 0);
    grouped[line.account_id].credit += Number(line.credit || 0);
  });

  const rows = Object.values(grouped)
    .map((row) => ({
      ...row,
      balance: row.debit - row.credit,
    }))
    .sort((a, b) => a.account_code.localeCompare(b.account_code));

  setTrialBalanceRows(rows);
}

function exportTrialBalanceToExcel() {
  if (trialBalanceRows.length === 0) {
    alert("There is no trial balance to export.");
    return;
  }

  const exportRows = trialBalanceRows.map((row) => ({
    Code: row.account_code,
    Account: row.account_name,
    Type: row.account_type,
    Debit: row.balance >= 0 ? Number(row.balance.toFixed(2)) : "",
    Credit: row.balance < 0 ? Number(Math.abs(row.balance).toFixed(2)) : "",
  }));

  exportRows.push({
    Code: "",
    Account: "Total",
    Type: "",
    Debit: Number(
      trialBalanceRows
        .reduce((sum, row) => sum + (row.balance >= 0 ? row.balance : 0), 0)
        .toFixed(2)
    ),
    Credit: Number(
      trialBalanceRows
        .reduce((sum, row) => sum + (row.balance < 0 ? Math.abs(row.balance) : 0), 0)
        .toFixed(2)
    ),
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Trial Balance");
  XLSX.writeFile(workbook, "trial-balance.xlsx");
}


  return (
    <main style={{ background: "#f4f7fb", minHeight: "calc(100vh - 60px)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        <aside style={sideNav}>
          <div style={{ padding: "24px 12px 14px 0" }}>
            <p
              style={{
                margin: "0 0 14px 8px",
                fontSize: "13px",
                fontWeight: 900,
                color: "#52616f",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Accounting
            </p>

            <div style={{ display: "grid", gap: "10px" }}>
              {[
                "Setup",
                "Chart of Accounts",
                "Cashbook",
                "Journals",
                "Trial Balance",
              ].map((tab) => (
              <button
  key={tab}
  onClick={() => setActiveTab(tab)}
  style={{
    ...sideNavButton,
    background: activeTab === tab ? "#0f4c81" : "#ffffff",
    color: activeTab === tab ? "#ffffff" : "#12304a",
    border:
      activeTab === tab
        ? "1px solid #0f4c81"
        : "1px solid #dce4ec",
  }}
>
  {tab}
</button>
              ))}
            </div>
          </div>
        </aside>

        <section style={{ padding: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "8px" }}>
            Accounting System
          </h1>

          <p style={{ fontSize: "16px", color: "#52616f", marginBottom: "28px" }}>
            Basic accounting system: client, chart of accounts, cashbook, journals
            and trial balance.
          </p>

          {activeTab === "Setup" && (
            <section style={card}>
                <h2 style={sectionHeading}>Choose Client</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(280px, 420px) minmax(280px, 420px) 140px",
                gap: "16px",
                alignItems: "end",
              }}
            >
              <Field label="Select client">
                <select
                  value={selectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                  style={input}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.client_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Add new client">
                <input
                  value={newClientName}
                  onChange={(event) => setNewClientName(event.target.value)}
                  placeholder="Client name"
                  style={input}
                />
              </Field>

              <button onClick={addClient} style={primaryButton}>
                Add
              </button>
            </div>
          </section>
          )}

      {activeTab === "Setup" && (
  <section style={card}>
    <h2 style={sectionHeading}>Setup</h2>
    <p style={{ margin: 0, color: "#52616f" }}>
      Select or add the accounting client.
    </p>
  </section>
)}

{activeTab === "Chart of Accounts" && (
  <section style={card}>
    <h2 style={sectionHeading}>Chart of Accounts</h2>

    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "18px" }}>
  <button onClick={loadDefaultChartOfAccounts} style={primaryButton}>
    Load Default Chart of Accounts
  </button>
</div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr 220px 120px",
        gap: "16px",
        alignItems: "end",
        marginBottom: "24px",
      }}
    >
      <Field label="Code">
        <input
          value={newAccountCode}
          onChange={(event) => setNewAccountCode(event.target.value)}
          placeholder="1000/000"
          style={input}
        />
      </Field>

      <Field label="Account name">
        <input
          value={newAccountName}
          onChange={(event) => setNewAccountName(event.target.value)}
          placeholder="Bank account"
          style={input}
        />
      </Field>

      <Field label="Type">
        <select
          value={newAccountType}
          onChange={(event) => setNewAccountType(event.target.value)}
          style={input}
        >
<option value="Assets - Current - Cash and Cash Equivalents">
  Assets - Current - Cash and Cash Equivalents
</option>
<option value="Assets - Current - Other Current Assets">
  Assets - Current - Other Current Assets
</option>
<option value="Assets - Non Current - Fixed Assets">
  Assets - Non Current - Fixed Assets
</option>
<option value="Assets - Non Current - Other Non Current Assets">
  Assets - Non Current - Other Non Current Assets
</option>

<option value="Equity - Share Capital / Members Interest / Trust Capital">
  Equity - Share Capital / Members Interest / Trust Capital
</option>
<option value="Equity - Retained Earnings">Equity - Retained Earnings</option>
<option value="Equity - Other Equity">Equity - Other Equity</option>

<option value="Liabilities - Current">Liabilities - Current</option>
<option value="Liabilities - Non Current">Liabilities - Non Current</option>

<option value="Income - Revenue from Trading Activities">
  Income - Revenue from Trading Activities
</option>
<option value="Income - Revenue from Investment Activities">
  Income - Revenue from Investment Activities
</option>
<option value="Other Income">Other Income</option>

<option value="Expenses - Cost of Sales">Expenses - Cost of Sales</option>
<option value="Expenses - Finance Cost">Expenses - Finance Cost</option>
<option value="Expenses - Other Expenses">Expenses - Other Expenses</option>
<option value="Expenses - Tax">Expenses - Tax</option>
        </select>
      </Field>

      <button onClick={addAccount} style={primaryButton}>
        Add
      </button>
    </div>

    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
          <th style={th}>Code</th>
          <th style={th}>Account Name</th>
          <th style={th}>Type</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => (
          <tr key={account.id}>
            <td style={td}>{account.account_code}</td>
            <td style={td}>{account.account_name}</td>
            <td style={td}>{account.account_type}</td>
          </tr>
        ))}

        {accounts.length === 0 && (
          <tr>
            <td style={td} colSpan={3}>
              No accounts added yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </section>
)}

{activeTab === "Cashbook" && (
  <section style={card}>
    <h2 style={sectionHeading}>Cashbook</h2>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "18px" }}>
  <Field label="Import bank statement XLSX">
    <input
      type="file"
      accept=".xlsx,.xls"
      onChange={importBankStatement}
      style={input}
    />
  </Field>
</div>

    <div style={{ marginBottom: "20px", maxWidth: "520px" }}>
      <Field label="Bank account for this batch">
        <select
          value={cashbookBankAccountId}
          onChange={(event) => {
  const nextBankAccountId = event.target.value;
  setCashbookBankAccountId(nextBankAccountId);
  saveCashbookDraft(cashbookRows, nextBankAccountId);
}}
          style={input}
        >
          <option value="">Select bank account</option>
          {accounts
            .filter(
              (account) =>
                account.account_name.toLowerCase().includes("bank") ||
                account.account_name.toLowerCase().includes("cash") ||
                account.account_name.toLowerCase().includes("call")
            )
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_code} - {account.account_name}
              </option>
            ))}
        </select>
      </Field>
    </div>

    <table
  style={{
    width: "100%",
    borderCollapse: "collapse",
    background: "#ffffff",
    fontSize: "13px",
  }}
>
   <colgroup>
  <col style={{ width: "150px" }} />
  <col style={{ width: "420px" }} />
  <col style={{ width: "140px" }} />
  <col style={{ width: "140px" }} />
  <col style={{ width: "180px" }} />
  <col style={{ width: "320px" }} />
</colgroup>

      <thead>
        <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
         <th style={{ ...th, cursor: "pointer" }} onClick={() => sortCashbookRows("date")}>
  Date
</th>
<th style={{ ...th, cursor: "pointer" }} onClick={() => sortCashbookRows("description")}>
  Description
</th>
<th style={{ ...th, cursor: "pointer" }} onClick={() => sortCashbookRows("moneyIn")}>
  Money In
</th>
<th style={{ ...th, cursor: "pointer" }} onClick={() => sortCashbookRows("moneyOut")}>
  Money Out
</th>
<th style={th}>Allocation Type</th>
<th style={th}>Account</th>
        </tr>
      </thead>

      <tbody>
        {cashbookRows.map((row, index) => (
          <tr key={index}>
            <td style={td}>
              <input
                type="date"
                value={row.date}
                onChange={(event) =>
                  updateCashbookRow(index, "date", event.target.value)
                }
                style={input}
              />
            </td>

            <td style={td}>
              <input
                value={row.description}
                onChange={(event) =>
                  updateCashbookRow(index, "description", event.target.value)
                }
                placeholder="Description"
                style={input}
              />
            </td>

            <td style={td}>
              <input
                value={row.moneyIn}
                onChange={(event) =>
                  updateCashbookRow(index, "moneyIn", event.target.value)
                }
                placeholder="0.00"
                style={input}
              />
            </td>

            <td style={td}>
              <input
                value={row.moneyOut}
                onChange={(event) =>
                  updateCashbookRow(index, "moneyOut", event.target.value)
                }
                placeholder="0.00"
                style={input}
              />
            </td>
            <td style={td}>
  <select
    value={row.allocationType}
    onChange={(event) =>
      updateCashbookRow(
        index,
        "allocationType",
        event.target.value as CashbookBatchRow["allocationType"]
      )
    }
    style={input}
  >
    <option value="Account">Account</option>
    <option value="Client">Client</option>
    <option value="Supplier">Supplier</option>
    <option value="VAT">VAT</option>
    <option value="Transfer">Transfer</option>
  </select>
</td>


            <td style={td}>
           <input
  list={`cashbook-accounts-${index}`}
  value={row.accountSearch}
onChange={(event) => {
  const value = event.target.value;
  const selectedAccount = findAccountByLabel(value);

  updateCashbookRow(index, "accountSearch", value);
  updateCashbookRow(index, "accountId", selectedAccount?.id || "");
}}
  placeholder="Search account"
  style={input}
/>

<datalist id={`cashbook-accounts-${index}`}>
 {accounts
  .filter((account) => {
    if (account.id === cashbookBankAccountId) return false;

    const isCashEquivalent =
  account.account_type === "Assets - Current - Cash and Cash Equivalents";

if (row.allocationType === "Transfer") {
  return isCashEquivalent;
}

return !isCashEquivalent;
  })
  .map((account) => (
      <option key={account.id} value={accountLabel(account)} />
    ))}
</datalist>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
    <button
  onClick={postCashbookBatch}
  disabled={isPostingCashbook}
  style={{
    ...primaryButton,
    opacity: isPostingCashbook ? 0.6 : 1,
    cursor: isPostingCashbook ? "not-allowed" : "pointer",
  }}
>
  {isPostingCashbook ? "Posting..." : "Post Batch"}
</button>
    </div>
  </section>
)}

{activeTab === "Journals" && (
  <section style={card}>
    <h2 style={sectionHeading}>General Journal</h2>

    <div
  style={{
    display: "grid",
    gridTemplateColumns: "180px 180px 1fr",
    gap: "16px",
    marginBottom: "22px",
  }}
>
    <Field label="Journal number">
  <input
    value={journalNumber}
    onChange={(event) => setJournalNumber(event.target.value)}
    placeholder="GJ001"
    style={input}
  />
</Field>

      <Field label="Journal date">
        <input
          type="date"
          value={journalDate}
          onChange={(event) => setJournalDate(event.target.value)}
          style={input}
        />
      </Field>

      <Field label="Journal description">
        <input
          value={journalDescription}
          onChange={(event) => setJournalDescription(event.target.value)}
          placeholder="Journal description"
          style={input}
        />
      </Field>
    </div>

    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        background: "#ffffff",
        fontSize: "14px",
      }}
    >
      <colgroup>
        <col style={{ width: "360px" }} />
        <col style={{ width: "170px" }} />
        <col style={{ width: "170px" }} />
        <col style={{ width: "360px" }} />
      </colgroup>

      <thead>
        <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
          <th style={th}>Account</th>
          <th style={th}>Debit</th>
          <th style={th}>Credit</th>
          <th style={th}>Notes</th>
        </tr>
      </thead>

      <tbody>
        {journalRows.map((row, index) => (
          <tr key={index}>
            <td style={td}>
              <input
                list={`journal-accounts-${index}`}
                value={row.accountSearch}
                onChange={(event) => {
                  const value = event.target.value;
                  const selectedAccount = findAccountByLabel(value);

                  updateGeneralJournalRow(index, "accountSearch", value);
                  updateGeneralJournalRow(
                    index,
                    "accountId",
                    selectedAccount?.id || ""
                  );
                }}
                placeholder="Search account"
                style={input}
              />

              <datalist id={`journal-accounts-${index}`}>
                {accounts.map((account) => (
                  <option key={account.id} value={accountLabel(account)} />
                ))}
              </datalist>
            </td>

            <td style={td}>
              <input
                value={row.debit}
                onChange={(event) =>
                  updateGeneralJournalRow(index, "debit", event.target.value)
                }
                placeholder="0.00"
                style={input}
              />
            </td>

            <td style={td}>
              <input
                value={row.credit}
                onChange={(event) =>
                  updateGeneralJournalRow(index, "credit", event.target.value)
                }
                placeholder="0.00"
                style={input}
              />
            </td>

            <td style={td}>
              <input
                value={row.notes}
                onChange={(event) =>
                  updateGeneralJournalRow(index, "notes", event.target.value)
                }
                placeholder="Optional note"
                style={input}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
      <button onClick={postGeneralJournalBatch} style={primaryButton}>
        Post Journal
      </button>
    </div>
  </section>
)}

{activeTab === "Trial Balance" && (
  <section style={card}>
    <h2 style={sectionHeading}>Trial Balance</h2>

   <div style={{ display: "flex", gap: "12px", marginBottom: "18px" }}>
  <button onClick={loadTrialBalance} style={primaryButton}>
    Refresh Trial Balance
  </button>

  <button onClick={exportTrialBalanceToExcel} style={primaryButton}>
    Export Trial Balance to Excel
  </button>
</div>

    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#0f4c81", color: "#ffffff" }}>
          <th style={th}>Code</th>
          <th style={th}>Account</th>
          <th style={th}>Type</th>
          <th style={thRight}>Debit</th>
          <th style={thRight}>Credit</th>
        </tr>
      </thead>

      <tbody>
        {trialBalanceRows.map((row) => (
          <tr key={row.account_id}>
            <td style={td}>{row.account_code}</td>
            <td style={td}>{row.account_name}</td>
            <td style={td}>{row.account_type}</td>
            <td style={thRight}>{row.balance >= 0 ? row.balance.toFixed(2) : ""}</td>
            <td style={thRight}>{row.balance < 0 ? Math.abs(row.balance).toFixed(2) : ""}</td>
          </tr>
        ))}

        <tr style={{ background: "#f8fafc", fontWeight: 900 }}>
          <td style={td} colSpan={3}>Total</td>
          <td style={thRight}>
            {trialBalanceRows
              .reduce((sum, row) => sum + (row.balance >= 0 ? row.balance : 0), 0)
              .toFixed(2)}
          </td>
          <td style={thRight}>
            {trialBalanceRows
              .reduce((sum, row) => sum + (row.balance < 0 ? Math.abs(row.balance) : 0), 0)
              .toFixed(2)}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
)}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: "8px", fontWeight: 700 }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const sideNav: React.CSSProperties = {
  borderRight: "1px solid #dce4ec",
  background: "#ffffff",
};

const sideNavButton: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "14px 12px",
  borderRadius: "0 12px 12px 0",
  fontWeight: 800,
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
  fontSize: "20px",
};

const th: React.CSSProperties = {
  textAlign: "center",
  padding: "12px",
  borderBottom: "1px solid #dce4ec",
  fontSize: "20px",
};

const thRight: React.CSSProperties = {
  ...th,
  textAlign: "right",
};

const td: React.CSSProperties = {
  padding: "4px 6px",
  borderBottom: "1px solid #eef2f6",
};

const primaryButton: React.CSSProperties = {
  height: "46px",
  border: "1px solid #0f4c81",
  background: "#0f4c81",
  color: "#ffffff",
  borderRadius: "12px",
  fontWeight: 800,
  cursor: "pointer",
};