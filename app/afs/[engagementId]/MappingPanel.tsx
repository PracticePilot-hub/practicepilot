"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";
import {
  getLeadScheduleNumber,
  getLeadSchedulePlainTitle,
  type LeadScheduleKey,
} from "./afsLeadScheduleCatalog";

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
  mapping_saved_at?: string | null;
  mapping_code?: string | null;
  lead_schedule_number?: string | null;
  lead_schedule_key?: string | null;
  note_number: string | null;
};

type MappingStatement = "SFP" | "P/L" | "Other";

type MappingLeaf = {
  id: string;
  label: string;
  statement: MappingStatement;
  section: string;
  path: string[];
  mappingCode: string;
  leadScheduleNumber: string;
  leadScheduleKey: LeadScheduleKey;
  smartRule?: string;
};

type MappingNode = {
  id: string;
  label: string;
  children?: MappingNode[];
  leaf?: MappingLeaf;
};

type SuggestedMapping = {
  leaf: MappingLeaf | null;
  confidence: "High" | "Medium" | "Low" | "Review";
  reason: string;
};

type EnrichedLine = TrialBalanceLine & {
  lineKey: string;
  current: number;
  prior: number;
  suggested: SuggestedMapping;
};

type LeafUsage = {
  count: number;
  total: number;
  accounts: string[];
};

type Props = {
  trialBalanceLines: TrialBalanceLine[];
  onTrialBalanceLinesChanged?: (lines: TrialBalanceLine[]) => void;
  onDataChanged?: () => void | Promise<void>;
};

function cleanId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function folder(id: string, label: string, children: MappingNode[]): MappingNode {
  return { id, label, children };
}

function leaf(
  statement: MappingStatement,
  section: string,
  path: string[],
  label: string,
  mappingCode: string,
  leadScheduleKey: LeadScheduleKey,
  smartRule?: string
): MappingNode {
  const leadScheduleNumber = getLeadScheduleNumber(leadScheduleKey);
  const id = cleanId(`${mappingCode}-${statement}-${section}-${path.join("-")}-${label}`);

  return {
    id,
    label,
    leaf: {
      id,
      label,
      statement,
      section,
      path,
      mappingCode,
      leadScheduleNumber,
      leadScheduleKey,
      smartRule,
    },
  };
}

function numberedExpenseLeaves() {
  return Array.from({ length: 50 }, (_, index) => {
    const number = index + 1;
    return leaf(
      "P/L",
      "Operating expenses",
      ["Operating expenses", "Other expenses"],
      `Other expenses ${number}`,
      `750.${900 + number}`,
      "operating-expenses"
    );
  });
}

function numberedStakeholderLoanLeaves() {
  return Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const codeSuffix = String(number).padStart(2, "0");

    return leaf(
      "SFP",
      "Non-current liabilities",
      ["Loans from stakeholders"],
      `Shareholder / director / member loan ${number}`,
      `548.${codeSuffix}`,
      "loans-stakeholders-payable"
    );
  });
}

const smartDebitCredit =
  "This mapping is saved once. Presentation can follow the debit/credit balance where the related lead sheet needs it.";

const mappingTree: MappingNode[] = [
  folder("sfp", "Statement of Financial Position", [
    folder("sfp-non-current-assets", "300 · Non-current assets", [
      folder("sfp-nca-ppe", "305 · Property, plant and equipment", [
        folder("ppe-land-buildings", "Land and buildings", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Land and buildings"], "At cost", "305.10", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Land and buildings"], "Accumulated depreciation", "305.11", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Land and buildings"], "Accumulated impairment", "305.12", "ppe"),
        ]),
        folder("ppe-plant-machinery", "Plant and machinery", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Plant and machinery"], "At cost", "305.20", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Plant and machinery"], "Accumulated depreciation", "305.21", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Plant and machinery"], "Accumulated impairment", "305.22", "ppe"),
        ]),
        folder("ppe-furniture-fittings", "Furniture and fittings", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Furniture and fittings"], "At cost", "305.30", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Furniture and fittings"], "Accumulated depreciation", "305.31", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Furniture and fittings"], "Accumulated impairment", "305.32", "ppe"),
        ]),
        folder("ppe-motor-vehicles", "Motor vehicles", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Motor vehicles"], "At cost", "305.40", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Motor vehicles"], "Accumulated depreciation", "305.41", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Motor vehicles"], "Accumulated impairment", "305.42", "ppe"),
        ]),
        folder("ppe-office-equipment", "Office and computer equipment", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Office and computer equipment"], "At cost", "305.50", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Office and computer equipment"], "Accumulated depreciation", "305.51", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Office and computer equipment"], "Accumulated impairment", "305.52", "ppe"),
        ]),
        folder("ppe-other", "Other property, plant and equipment", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other property, plant and equipment"], "At cost", "305.80", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other property, plant and equipment"], "Accumulated depreciation", "305.81", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other property, plant and equipment"], "Accumulated impairment", "305.82", "ppe"),
        ]),
        leaf("SFP", "Non-current assets", ["Property, plant and equipment"], "Capital work in progress", "305.90", "ppe"),
      ]),
      folder("sfp-nca-rou", "306 · Right-of-use assets", [
        leaf("SFP", "Non-current assets", ["Right-of-use assets"], "At cost", "306.10", "right-of-use-assets"),
        leaf("SFP", "Non-current assets", ["Right-of-use assets"], "Accumulated depreciation", "306.20", "right-of-use-assets"),
        leaf("SFP", "Non-current assets", ["Right-of-use assets"], "Accumulated impairment", "306.30", "right-of-use-assets"),
      ]),
      folder("sfp-nca-investment-property", "310 · Investment property", [
        leaf("SFP", "Non-current assets", ["Investment property"], "Investment property at cost / valuation", "310.10", "investment-property"),
        leaf("SFP", "Non-current assets", ["Investment property"], "Fair value adjustment", "310.20", "investment-property"),
        leaf("SFP", "Non-current assets", ["Investment property"], "Accumulated impairment", "310.30", "investment-property"),
      ]),
      folder("sfp-nca-intangibles", "320 · Intangible assets", [
        leaf("SFP", "Non-current assets", ["Intangible assets"], "At cost", "320.10", "intangibles"),
        leaf("SFP", "Non-current assets", ["Intangible assets"], "Accumulated amortisation", "320.20", "intangibles"),
        leaf("SFP", "Non-current assets", ["Intangible assets"], "Accumulated impairment", "320.30", "intangibles"),
      ]),
      leaf("SFP", "Non-current assets", ["Goodwill"], "Goodwill", "321.10", "goodwill"),
      leaf("SFP", "Non-current assets", ["Investments"], "Investments in subsidiaries", "326.10", "investments-subsidiaries"),
      leaf("SFP", "Non-current assets", ["Investments"], "Investments in associates", "327.10", "investments-associates"),
      leaf("SFP", "Non-current assets", ["Investments"], "Investments in joint ventures", "328.10", "investments-joint-ventures"),
      folder("sfp-nca-loans-receivable", "340 · Loans receivable", [
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to group companies", "340.10", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to related parties", "340.20", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to shareholders / directors", "340.30", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Other long-term loan receivable", "340.90", "loans-receivable"),
      ]),
      leaf("SFP", "Non-current assets", ["Deferred tax asset"], "Deferred tax asset", "395.10", "deferred-tax-asset"),
      folder("sfp-nca-other", "390 · Other non-current assets", [
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Operating lease asset", "390.10", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Retirement benefit asset", "390.20", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Other non-current asset 1", "390.91", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Other non-current asset 2", "390.92", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Other non-current asset 3", "390.93", "other-non-current-assets"),
      ]),
    ]),
    folder("sfp-current-assets", "400 · Current assets", [
      folder("sfp-ca-inventory", "405 · Inventories", [
        leaf("SFP", "Current assets", ["Inventories"], "Raw materials", "405.10", "inventory"),
        leaf("SFP", "Current assets", ["Inventories"], "Work in progress", "405.20", "inventory"),
        leaf("SFP", "Current assets", ["Inventories"], "Finished goods", "405.30", "inventory"),
        leaf("SFP", "Current assets", ["Inventories"], "Consumables / stock on hand", "405.90", "inventory"),
      ]),
      folder("sfp-ca-cash", "420 · Cash and cash equivalents", [
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Current bank account", "420.10", "cash", "bank"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Savings account", "420.20", "cash", "bank"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Call account", "420.30", "cash", "bank"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Short-term deposits", "420.35", "cash"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Petty cash", "420.40", "cash", "cash"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Cash on hand", "420.50", "cash", "cash"),
      ]),
      folder("sfp-ca-receivables", "430 · Trade and other receivables", [
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Trade receivables", "430.10", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Provision for impairment of receivables", "430.20", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Other receivable 1", "430.31", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Other receivable 2", "430.32", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Prepayments", "430.40", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Deposits paid", "430.50", "receivables"),
      ]),
      leaf("SFP", "Current assets", ["Construction contracts and receivables"], "Construction contract asset / receivable", "432.10", "construction-contracts-receivable"),
      leaf("SFP", "Current assets", ["Loans to directors, managers and employees"], "Loans to directors, managers and employees", "449.10", "directors-employee-loans"),
      folder("sfp-ca-tax-controls", "490 · Tax and statutory controls", [
        leaf("SFP", "Current assets", ["Tax and statutory controls"], "VAT receivable", "490.10", "tax-controls", smartDebitCredit),
        leaf("SFP", "Current assets", ["Tax and statutory controls"], "PAYE / UIF / SDL receivable", "490.20", "tax-controls", smartDebitCredit),
        leaf("SFP", "Current assets", ["Tax and statutory controls"], "Other SARS / statutory receivable", "490.90", "tax-controls", smartDebitCredit),
      ]),
      leaf("SFP", "Current assets", ["Current tax receivable"], "Current tax receivable", "495.10", "current-tax-receivable"),
      leaf("SFP", "Current assets", ["Assets held for sale"], "Assets held for sale", "499.10", "assets-held-for-sale"),
    ]),
    folder("sfp-equity", "800 · Equity", [
      leaf("SFP", "Equity", ["Share capital / contributions"], "Share capital", "805.10", "share-capital"),
      leaf("SFP", "Equity", ["Share capital / contributions"], "Share premium", "805.20", "share-capital"),
      leaf("SFP", "Equity", ["Share capital / contributions"], "Members / owners contributions", "805.30", "share-capital"),
      leaf("SFP", "Equity", ["Retained income"], "Retained income / accumulated loss", "810.10", "retained-income"),
      leaf("SFP", "Equity", ["Reserves"], "Revaluation reserve", "820.10", "reserves"),
      leaf("SFP", "Equity", ["Reserves"], "Other reserve 1", "820.91", "reserves"),
      leaf("SFP", "Equity", ["Reserves"], "Other reserve 2", "820.92", "reserves"),
    ]),
    folder("sfp-non-current-liabilities", "500 · Non-current liabilities", [
      leaf("SFP", "Non-current liabilities", ["Provisions"], "Long-term provisions", "515.10", "provisions"),
      leaf("SFP", "Non-current liabilities", ["Deferred income"], "Deferred income", "531.10", "deferred-income"),
      leaf("SFP", "Non-current liabilities", ["Loans from group companies"], "Loans from group companies", "547.10", "loans-group-companies-payable"),
      folder("sfp-ncl-stakeholder-loans", "548 · Loans from shareholders / directors / members", [
        leaf("SFP", "Non-current liabilities", ["Loans from stakeholders"], "Loans from shareholders / directors / members - general", "548.10", "loans-stakeholders-payable"),
        ...numberedStakeholderLoanLeaves(),
      ]),
      leaf("SFP", "Non-current liabilities", ["Financial liabilities"], "Financial liabilities", "550.10", "financial-liabilities"),
      leaf("SFP", "Non-current liabilities", ["Borrowings"], "Borrowings", "551.10", "borrowings"),
      leaf("SFP", "Non-current liabilities", ["Lease liabilities"], "Lease liabilities", "555.10", "lease-liabilities"),
      leaf("SFP", "Non-current liabilities", ["Other non-current liabilities"], "Other non-current liabilities", "590.10", "other-non-current-liabilities"),
      leaf("SFP", "Non-current liabilities", ["Deferred tax liability"], "Deferred tax liability", "595.10", "deferred-tax-liability"),
    ]),
    folder("sfp-current-liabilities", "600 · Current liabilities", [
      leaf("SFP", "Current liabilities", ["Bank overdraft"], "Bank overdraft", "620.10", "bank-overdraft"),
      folder("sfp-cl-payables", "630 · Trade and other payables", [
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Trade payables", "630.10", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Accruals", "630.20", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Other payable 1", "630.31", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Other payable 2", "630.32", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Income received in advance", "630.40", "payables"),
      ]),
      leaf("SFP", "Current liabilities", ["Dividend payable"], "Dividend payable", "688.10", "dividend-payable"),
      folder("sfp-cl-tax-controls", "690 · Tax and statutory controls", [
        leaf("SFP", "Current liabilities", ["Tax and statutory controls"], "VAT payable", "690.10", "tax-controls", smartDebitCredit),
        leaf("SFP", "Current liabilities", ["Tax and statutory controls"], "PAYE / UIF / SDL payable", "690.20", "tax-controls", smartDebitCredit),
        leaf("SFP", "Current liabilities", ["Tax and statutory controls"], "Other SARS / statutory payable", "690.90", "tax-controls", smartDebitCredit),
      ]),
      leaf("SFP", "Current liabilities", ["Current tax payable"], "Current tax payable", "695.10", "current-tax-payable"),
      leaf("SFP", "Current liabilities", ["Liabilities held for sale"], "Liabilities held for sale", "699.10", "liabilities-held-for-sale"),
    ]),
  ]),
  folder("pl", "Income Statement", [
    folder("pl-revenue-income", "700 · Revenue and income", [
      leaf("P/L", "Revenue and income", ["Revenue"], "Revenue", "700.10", "revenue"),
      leaf("P/L", "Revenue and income", ["Revenue"], "Sales", "700.20", "revenue", "sales"),
      leaf("P/L", "Revenue and income", ["Operating income"], "Operating income", "730.10", "operating-income"),
      leaf("P/L", "Revenue and income", ["Investment income"], "Interest received", "770.10", "investment-income"),
      leaf("P/L", "Revenue and income", ["Investment income"], "Dividend income", "770.20", "investment-income"),
      leaf("P/L", "Revenue and income", ["Non-operating income"], "Non-operating income", "785.10", "non-operating-income"),
    ]),
    folder("pl-cost-sales", "720 · Cost of sales", [
      leaf("P/L", "Cost of sales", ["Cost of sales"], "Cost of sales", "720.10", "cost-of-sales"),
      leaf("P/L", "Cost of sales", ["Cost of sales"], "Purchases", "720.20", "cost-of-sales"),
      leaf("P/L", "Cost of sales", ["Cost of sales"], "Opening / closing stock movement", "720.30", "cost-of-sales"),
    ]),
    folder("pl-expenses", "750 · Operating expenses", [
      folder("pl-expenses-admin", "Administration", [
        leaf("P/L", "Operating expenses", ["Administration"], "Accounting fees", "750.10", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Audit / independent review fees", "750.11", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Bad debts", "750.12", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Bank charges", "750.13", "operating-expenses", "bank charges"),
        leaf("P/L", "Operating expenses", ["Administration"], "Depreciation", "750.14", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Insurance", "750.15", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Legal fees", "750.16", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Motor vehicle expenses", "750.17", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Rent paid", "750.18", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Repairs and maintenance", "750.19", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Salaries and wages", "750.20", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Staff costs", "750.21", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Telephone and internet", "750.22", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Travel and accommodation", "750.23", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Fines and penalties", "750.24", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Software subscriptions", "750.25", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Printing and stationery", "750.26", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Courier and postage", "750.27", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Other expenses - deductible", "750.80", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Other expenses - non-deductible", "750.81", "operating-expenses"),
      ]),
      folder("pl-expenses-premises", "Premises", [
        leaf("P/L", "Operating expenses", ["Premises"], "Rates and taxes", "750.30", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Premises"], "Electricity and water", "750.31", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Premises"], "Cleaning", "750.32", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Premises"], "Security", "750.33", "operating-expenses"),
      ]),
      folder("pl-expenses-selling", "Selling and marketing", [
        leaf("P/L", "Operating expenses", ["Selling and marketing"], "Advertising", "750.40", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Selling and marketing"], "Marketing", "750.41", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Selling and marketing"], "Commission paid", "750.42", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Selling and marketing"], "Entertainment", "750.43", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Selling and marketing"], "Gifts", "750.44", "operating-expenses"),
      ]),
      folder("pl-expenses-other", "Other expenses", numberedExpenseLeaves()),
      leaf("P/L", "Operating expenses", ["Operating expenses"], "Other operating expenses", "750.90", "operating-expenses"),
    ]),
    folder("pl-finance-tax", "775 · Finance and taxation", [
      leaf("P/L", "Finance and taxation", ["Finance costs"], "Interest paid", "775.10", "finance-costs"),
      leaf("P/L", "Finance and taxation", ["Finance costs"], "Bank interest", "775.20", "finance-costs"),
      leaf("P/L", "Finance and taxation", ["Finance costs"], "Finance lease interest", "775.30", "finance-costs"),
      leaf("P/L", "Finance and taxation", ["Finance costs"], "Loan interest", "775.40", "finance-costs"),
      leaf("P/L", "Finance and taxation", ["Finance costs"], "Other finance costs", "775.90", "finance-costs"),
      leaf("P/L", "Finance and taxation", ["Taxation"], "Current tax expense", "795.10", "taxation"),
      leaf("P/L", "Finance and taxation", ["Taxation"], "Deferred tax expense", "795.20", "taxation"),
      leaf("P/L", "Finance and taxation", ["Taxation"], "Prior year tax under / over provision", "795.30", "taxation"),
      leaf("P/L", "Finance and taxation", ["Taxation"], "Other taxation", "795.90", "taxation"),
    ]),
    folder("pl-other-performance", "780 · Other performance", [
      leaf("P/L", "Other performance", ["Non-operating gains / losses"], "Gain / loss on disposal of assets", "780.10", "non-operating-gains-losses"),
      leaf("P/L", "Other performance", ["Non-operating gains / losses"], "Fair value gains / losses", "780.20", "non-operating-gains-losses"),
      leaf("P/L", "Other performance", ["Non-operating expenses"], "Non-operating expenses", "781.10", "non-operating-expenses"),
      leaf("P/L", "Other performance", ["Other comprehensive income"], "Other comprehensive income", "797.10", "other-comprehensive-income"),
      leaf("P/L", "Other performance", ["Discontinued operations"], "Discontinued operations", "799.10", "discontinued-operations"),
    ]),
  ]),
  folder("other", "Other", [
    leaf("Other", "Other", ["Related parties"], "Related party balances / disclosures", "850.10", "related-parties"),
    leaf("Other", "Other", ["Commitments and contingencies"], "Commitments and contingencies", "857.10", "commitments-contingencies"),
    leaf("Other", "Other", ["Statement of cash flows"], "Statement of cash flows", "880.10", "cash-flow"),
    leaf("Other", "Other", ["Other disclosures"], "Other disclosures", "891.10", "other-disclosures"),
  ]),
];

function getAllLeaves(nodes: MappingNode[]): MappingLeaf[] {
  return nodes.flatMap((node) => {
    if (node.leaf) return [node.leaf];
    return getAllLeaves(node.children || []);
  });
}

const allMappingLeaves = getAllLeaves(mappingTree);

export default function MappingPanel({ trialBalanceLines, onTrialBalanceLinesChanged, onDataChanged }: Props) {
  const params = useParams();
  const engagementId = String(params?.engagementId || "");

  const [localLines, setLocalLines] = useState<TrialBalanceLine[]>(trialBalanceLines);
  const [selectedLineKey, setSelectedLineKey] = useState("");
  const [selectedLeaf, setSelectedLeaf] = useState<MappingLeaf | null>(null);
  const [searchText, setSearchText] = useState("");
  const [accountFilter, setAccountFilter] = useState("Unmapped");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalLines(trialBalanceLines);
  }, [trialBalanceLines]);

  const enrichedLines = useMemo(() => {
    return localLines.map((line, index) => ({
      ...line,
      lineKey: getLineKey(line, index),
      current: currentBalance(line),
      prior: priorBalance(line),
      suggested: suggestMapping(line),
    }));
  }, [localLines]);

  const leafUsage = useMemo(() => buildLeafUsage(localLines), [localLines]);

  const selectedLine =
    enrichedLines.find((line) => line.lineKey === selectedLineKey) || null;

  const filteredLines = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return enrichedLines.filter((line) => {
      const mapped = isMapped(line);

      if (accountFilter === "Mapped" && !mapped) return false;
      if (accountFilter === "Unmapped" && mapped) return false;

      if (!q) return true;

      return [
        line.account_code,
        line.account_name,
        line.account_type,
        line.mapping_category,
        line.mapping_leaf_id,
        line.mapping_label,
        line.mapping_statement,
        line.mapping_section,
        line.mapping_path,
        line.mapping_code,
        line.lead_schedule_number,
        line.lead_schedule_key,
        line.suggested.leaf?.label,
        line.suggested.leaf?.mappingCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [enrichedLines, searchText, accountFilter]);

  const mappedCount = localLines.filter((line) => isMapped(line)).length;
  const unmappedCount = localLines.length - mappedCount;
  const highConfidenceCount = enrichedLines.filter(
    (line) => !isMapped(line) && line.suggested.confidence === "High"
  ).length;

  function toggleNode(id: string) {
    setOpenNodes((current) => ({ ...current, [id]: !current[id] }));
  }

  async function saveMapping(line: EnrichedLine, mappingLeaf: MappingLeaf, confidence = "Manual") {
    if (!line.id && !line.account_code) {
      alert("This trial balance line does not have an ID or account number yet.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/trial-balance-line-mapping`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trialBalanceLineId: line.id,
            lineId: line.id,
            accountCode: line.account_code,
            account_code: line.account_code,
            mappingLeafId: mappingLeaf.id,
            mappingLabel: mappingLeaf.label,
            mappingStatement: mappingLeaf.statement,
            mappingSection: mappingLeaf.section,
            mappingPath: [...mappingLeaf.path, mappingLeaf.label].join(" > "),
            mappingSmartRule: mappingLeaf.smartRule || "",
            mappingConfidence: confidence,
            mappingCode: mappingLeaf.mappingCode,
            leadScheduleNumber: mappingLeaf.leadScheduleNumber,
            leadScheduleKey: mappingLeaf.leadScheduleKey,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to save mapping.");
      }

      const updatedLine = result.trialBalanceLine || result.line;
      if (!updatedLine) throw new Error("Mapping saved but the updated line was not returned.");

      setLocalLines((current) => {
        const next = current.map((item) => {
          const sameId = updatedLine.id && item.id === updatedLine.id;
          const sameCode = updatedLine.account_code && item.account_code === updatedLine.account_code;
          return sameId || sameCode ? updatedLine : item;
        });
        onTrialBalanceLinesChanged?.(next);
        return next;
      });
      setSelectedLineKey(line.lineKey);
      setSelectedLeaf(mappingLeaf);
      setMessage("Mapping saved.");
    } catch (error: any) {
      alert(error?.message || "Failed to save mapping.");
    } finally {
      setSaving(false);
    }
  }

  async function clearMapping(line: EnrichedLine) {
    if (!line.id && !line.account_code) {
      alert("This trial balance line does not have an ID or account number yet.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/trial-balance-line-mapping`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trialBalanceLineId: line.id,
            lineId: line.id,
            accountCode: line.account_code,
            account_code: line.account_code,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to clear mapping.");
      }

      const updatedLine = result.trialBalanceLine || result.line;
      if (!updatedLine) throw new Error("Mapping saved but the updated line was not returned.");

      setLocalLines((current) => {
        const next = current.map((item) => {
          const sameId = updatedLine.id && item.id === updatedLine.id;
          const sameCode = updatedLine.account_code && item.account_code === updatedLine.account_code;
          return sameId || sameCode ? updatedLine : item;
        });
        onTrialBalanceLinesChanged?.(next);
        return next;
      });
      setSelectedLineKey(line.lineKey);
      setMessage("Mapping cleared.");
    } catch (error: any) {
      alert(error?.message || "Failed to clear mapping.");
    } finally {
      setSaving(false);
    }
  }

  async function assignMapping() {
    if (!selectedLine || !selectedLeaf) {
      alert("Select one account and one mapping code first.");
      return;
    }

    await saveMapping(selectedLine, selectedLeaf);
  }

  async function applySuggestedMapping(line: EnrichedLine) {
    if (!line.suggested.leaf) {
      alert("No suggestion available for this account.");
      return;
    }

    await saveMapping(line, line.suggested.leaf, line.suggested.confidence);
  }

  async function applyAllHighConfidence() {
    const linesToApply = enrichedLines.filter(
      (line) => !isMapped(line) && line.suggested.leaf && line.suggested.confidence === "High"
    );

    if (linesToApply.length === 0) {
      alert("No high confidence suggestions to apply.");
      return;
    }

    for (const line of linesToApply) {
      if (line.suggested.leaf) {
        await saveMapping(line, line.suggested.leaf, line.suggested.confidence);
      }
    }
  }

  return (
    <section style={styles.wrapper}>
      <div style={styles.headerRow}>
  <div>
    <h3 style={styles.title}>Mapping / Link Accounts</h3>
    <p style={styles.subtitle}>
      Map each trial balance account to a numbered mapping code. The mapping code links directly to the lead sheet.
    </p>
    {message ? <p style={styles.message}>{message}</p> : null}
  </div>

  <div style={styles.headerRight}>
    <div style={styles.statsRow}>
      <Stat label="Total" value={localLines.length} />
      <Stat label="Mapped" value={mappedCount} />
      <Stat label="Unmapped" value={unmappedCount} />
      <Stat label="High confidence" value={highConfidenceCount} />
    </div>

    <button
      type="button"
      style={styles.compactPrimaryButton}
      disabled={saving}
      onClick={applyAllHighConfidence}
    >
      Apply high confidence
    </button>
  </div>
</div>

      <div style={styles.mappingGrid}>
        <section style={styles.leftPane}>
          <div style={styles.panelHeader}>
            <strong>Trial balance mapping review</strong>
            <select
              style={styles.select}
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
            >
              <option>Unmapped</option>
              <option>Mapped</option>
              <option>All</option>
            </select>
          </div>

          <div style={styles.searchWrap}>
            <input
              style={styles.searchInput}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search account, description, mapping code or lead sheet..."
            />
          </div>

          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Account</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.thRight}>Current</th>
                  <th style={styles.thRight}>Prior</th>
                  <th style={styles.th}>Mapped</th>
                  <th style={styles.th}>Suggestion</th>
                  <th style={styles.th}>Confidence</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredLines.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={8}>
                      No accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((line) => {
                    const isSelected = selectedLineKey === line.lineKey;
                    const mapped = isMapped(line);

                    return (
                      <tr
                        key={line.lineKey}
                        style={{
                          ...styles.tr,
                          ...(isSelected ? styles.selectedRow : {}),
                        }}
                        onClick={() => setSelectedLineKey(line.lineKey)}
                      >
                        <td style={styles.tdCode}>{line.account_code || ""}</td>
                        <td style={styles.td}>{line.account_name}</td>
                        <td style={styles.tdRight}>{formatMoney(line.current)}</td>
                        <td style={styles.tdRight}>{formatMoney(line.prior)}</td>
                        <td style={styles.tdMuted}>
                          {mapped ? (
                            <span>
                              <strong>{line.mapping_code || "No code"}</strong>
                              <br />
                              {line.mapping_label || "Mapped"}
                              <br />
                              <small>
                                {line.lead_schedule_number || ""} · {leadScheduleLabel(line.lead_schedule_key)}
                              </small>
                            </span>
                          ) : (
                            "Unmapped"
                          )}
                        </td>
                        <td style={styles.tdMuted}>
                          {line.suggested.leaf ? (
                            <span>
                              <strong>{line.suggested.leaf.mappingCode}</strong>
                              <br />
                              {line.suggested.leaf.label}
                              <br />
                              <small>{line.suggested.reason}</small>
                            </span>
                          ) : (
                            line.suggested.reason
                          )}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.confidencePill,
                              ...confidenceStyle(line.suggested.confidence),
                            }}
                          >
                            {line.suggested.confidence}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.rowActions}>
                            {line.suggested.leaf && !mapped ? (
                              <button
                                type="button"
                                style={styles.linkButton}
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  applySuggestedMapping(line);
                                }}
                              >
                                Use
                              </button>
                            ) : null}

                            {mapped ? (
                              <button
                                type="button"
                                style={styles.dangerButton}
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  clearMapping(line);
                                }}
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.rightPane}>
          <div style={styles.panelHeaderStacked}>
            <strong>AFS Mapping Library</strong>
            <span>Manual mapping for exceptions and low-confidence lines.</span>
          </div>

          <div style={styles.libraryScroll}>
            {mappingTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                level={0}
                openNodes={openNodes}
                toggleNode={toggleNode}
                selectedLeaf={selectedLeaf}
                setSelectedLeaf={setSelectedLeaf}
                leafUsage={leafUsage}
              />
            ))}
          </div>
        </section>
      </div>

      <div style={styles.bottomAssignBar}>
        <div style={styles.assignCell}>
          <span>Selected account</span>
          <strong>
            {selectedLine
              ? `${selectedLine.account_code || ""} · ${selectedLine.account_name}`
              : "None selected"}
          </strong>
        </div>

        <div style={styles.assignArrow}>→</div>

        <div style={styles.assignCell}>
          <span>Selected AFS mapping</span>
          <strong>
            {selectedLeaf
              ? `${selectedLeaf.mappingCode} · ${selectedLeaf.path.join(" > ")} > ${selectedLeaf.label}`
              : "None selected"}
          </strong>
        </div>

        <button
          type="button"
          style={{
            ...styles.assignButton,
            ...(!selectedLine || !selectedLeaf || saving ? styles.assignButtonDisabled : {}),
          }}
          disabled={!selectedLine || !selectedLeaf || saving}
          onClick={assignMapping}
        >
          {saving ? "Saving..." : "Assign"}
        </button>
      </div>
    </section>
  );
}

function TreeNode({
  node,
  level,
  openNodes,
  toggleNode,
  selectedLeaf,
  setSelectedLeaf,
  leafUsage,
}: {
  node: MappingNode;
  level: number;
  openNodes: Record<string, boolean>;
  toggleNode: (id: string) => void;
  selectedLeaf: MappingLeaf | null;
  setSelectedLeaf: (leaf: MappingLeaf) => void;
  leafUsage: Record<string, LeafUsage>;
}) {
  const isOpen = Boolean(openNodes[node.id]);
  const isSelected = selectedLeaf?.id === node.leaf?.id;

  if (node.leaf) {
    const usage = leafUsage[node.leaf.id] || leafUsage[node.leaf.mappingCode];

    return (
      <button
        type="button"
        style={{
          ...styles.treeLeaf,
          paddingLeft: `${12 + level * 16}px`,
          ...(isSelected ? styles.treeLeafSelected : {}),
          ...(usage ? styles.treeLeafUsed : {}),
        }}
        onClick={() => setSelectedLeaf(node.leaf!)}
      >
        <span>
          <strong>{node.leaf.mappingCode}</strong>
          {" · "}
          {node.label}
          {usage ? (
            <small style={styles.usageText}>
              Used by {usage.count} account{usage.count === 1 ? "" : "s"} · {formatMoney(usage.total)}
              <br />
              {usage.accounts.slice(0, 2).join(" | ")}
            </small>
          ) : null}
        </span>
        <small>{node.leaf.leadScheduleNumber}</small>
      </button>
    );
  }

  return (
    <div style={styles.treeFolder}>
      <button
        type="button"
        style={{
          ...styles.treeFolderButton,
          paddingLeft: `${10 + level * 14}px`,
          ...(level === 0 ? styles.treeStatement : {}),
          ...(isOpen ? styles.treeFolderButtonOpen : {}),
        }}
        onClick={() => toggleNode(node.id)}
      >
        <span>{isOpen ? "−" : "+"}</span>
        <strong>{node.label}</strong>
      </button>

      {isOpen && node.children ? (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              openNodes={openNodes}
              toggleNode={toggleNode}
              selectedLeaf={selectedLeaf}
              setSelectedLeaf={setSelectedLeaf}
              leafUsage={leafUsage}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statBox}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getLineKey(line: TrialBalanceLine, index: number) {
  return line.id || `${line.account_code || "line"}-${index}`;
}

function isMapped(line: TrialBalanceLine) {
  return Boolean(
    line.mapping_leaf_id ||
      line.mapping_code ||
      line.mapping_label ||
      line.lead_schedule_key
  );
}

function toNumber(value: any) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function currentBalance(line: TrialBalanceLine) {
  const anyLine = line as any;

  if (anyLine.final_balance !== undefined && anyLine.final_balance !== null) {
    return toNumber(anyLine.final_balance);
  }

  if (anyLine.current_balance !== undefined && anyLine.current_balance !== null) {
    return toNumber(anyLine.current_balance);
  }

  if (line.current_year_balance !== undefined && line.current_year_balance !== null) {
    return toNumber(line.current_year_balance);
  }

  return toNumber(line.debit) - toNumber(line.credit);
}

function priorBalance(line: TrialBalanceLine) {
  return toNumber(line.prior_year_balance);
}

function buildLeafUsage(lines: TrialBalanceLine[]) {
  const usage: Record<string, LeafUsage> = {};

  for (const line of lines) {
    const keys = [line.mapping_leaf_id || "", line.mapping_code || ""].filter(Boolean);

    for (const key of keys) {
      if (!usage[key]) {
        usage[key] = { count: 0, total: 0, accounts: [] };
      }

      usage[key].count += 1;
      usage[key].total += currentBalance(line);
      usage[key].accounts.push(
        `${line.account_code || ""} · ${line.account_name} · ${formatMoney(currentBalance(line))}`
      );
    }
  }

  return usage;
}

function findLeafByCode(mappingCode: string) {
  return allMappingLeaves.find((leafItem) => leafItem.mappingCode === mappingCode) || null;
}

function findLeafByLabel(label: string) {
  const target = label.toLowerCase();
  return allMappingLeaves.find((leafItem) => leafItem.label.toLowerCase() === target) || null;
}

function suggestMapping(line: TrialBalanceLine): SuggestedMapping {
  const name = String(line.account_name || "").toLowerCase();
  const code = String(line.account_code || "").toLowerCase();
  const balance = currentBalance(line);

  function high(mappingCode: string, reason: string): SuggestedMapping {
    return { leaf: findLeafByCode(mappingCode), confidence: "High", reason };
  }

  function medium(mappingCode: string, reason: string): SuggestedMapping {
    return { leaf: findLeafByCode(mappingCode), confidence: "Medium", reason };
  }

  function low(mappingCode: string, reason: string): SuggestedMapping {
    return { leaf: findLeafByCode(mappingCode), confidence: "Low", reason };
  }

  if (name.includes("bank charges")) return high("750.13", "Bank charges detected.");
  if (name.includes("fines") || name.includes("penalties")) return high("750.24", "Fines / penalties detected.");
  if (name.includes("courier") || name.includes("postage")) return medium("750.27", "Courier / postage detected.");
  if (name.includes("printing") || name.includes("stationery")) return medium("750.26", "Printing / stationery detected.");
  if (name.includes("petty cash")) return high("420.40", "Petty cash detected.");
  if (name.includes("cash on hand")) return high("420.50", "Cash on hand detected.");
  if (
    name.includes("nedbank") ||
    name.includes("absa") ||
    name.includes("fnb") ||
    name.includes("standard bank") ||
    name.includes("capitec") ||
    (name.includes("bank") && !name.includes("charges") && !name.includes("interest"))
  ) {
    return high(balance < 0 ? "620.10" : "420.10", "Bank account detected.");
  }
  if (name.includes("vat")) return high(balance < 0 ? "690.10" : "490.10", "VAT control detected.");
  if (name.includes("paye") || name.includes("uif") || name.includes("sdl")) return high(balance < 0 ? "690.20" : "490.20", "Payroll statutory control detected.");
  if (name.includes("income tax") || name.includes("current tax")) return high(balance < 0 ? "695.10" : "495.10", "Income tax detected.");
  if (name.includes("debtor") || name.includes("accounts receivable") || name.includes("trade receivable")) return high("430.10", "Receivable detected.");
  if (name.includes("creditor") || name.includes("accounts payable") || name.includes("trade payable")) return high("630.10", "Payable detected.");
  if (name.includes("accrual")) return high("630.20", "Accrual detected.");
  if (name.includes("inventory") || name.includes("stock")) return medium("405.90", "Inventory / stock detected.");
  if (name.includes("share premium")) return high("805.20", "Share premium detected.");
  if (name.includes("share capital") || name === "capital") return high("805.10", "Share capital / capital detected.");
  if (name.includes("retained income") || name.includes("accumulated loss")) return high("810.10", "Retained income detected.");
  if (name.includes("sales") || name.includes("revenue") || name.includes("turnover")) return high("700.20", "Revenue detected.");
  if (name.includes("cost of sales")) return high("720.10", "Cost of sales detected.");
  if (name.includes("purchases")) return high("720.20", "Purchases detected.");
  if (name.includes("interest received")) return high("770.10", "Interest received detected.");
  if (name.includes("interest paid") || name.includes("loan interest")) return high("775.10", "Interest paid detected.");
  if (name.includes("loan") && balance >= 0) return medium("340.90", "Loan receivable detected.");
  if (name.includes("loan") && balance < 0) return medium("548.10", "Loan payable detected.");
  if (name.includes("motor vehicle")) return medium("305.40", "Motor vehicle detected.");
  if (name.includes("office equipment") || name.includes("computer equipment")) return medium("305.50", "Office/computer equipment detected.");

  const expense1 = findLeafByLabel("Other expenses 1");
  if (expense1) {
    return { leaf: expense1, confidence: "Low", reason: "Debit balance defaulted to Other expenses 1." };
  }

  return low("750.90", "Review manually.");
}

function leadScheduleLabel(value?: string | null) {
  if (!value) return "No lead sheet";

  try {
    return getLeadSchedulePlainTitle(value as LeadScheduleKey);
  } catch {
    return value;
  }
}

function confidenceStyle(confidence: SuggestedMapping["confidence"]): CSSProperties {
  if (confidence === "High") return { background: "#dcfce7", color: "#166534" };
  if (confidence === "Medium") return { background: "#fef3c7", color: "#92400e" };
  if (confidence === "Low") return { background: "#e0f2fe", color: "#075985" };
  return { background: "#f1f5f9", color: "#475569" };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value || 0));
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
  background: "#ffffff",
  border: "1px solid #dbe3ef",
  borderRadius: "8px",
  padding: "8px",
  boxShadow: "none",
  position: "relative",
  height: "calc(100dvh - 92px)",
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  overflow: "hidden",
},
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "flex-start",
    marginBottom: "6px",
  },
  title: {
    margin: 0,
    fontSize: "15px",
    color: "#0f172a",
    fontWeight: 850,
  },
  subtitle: {
    margin: "3px 0 0",
    color: "#48617f",
    fontSize: "11px",
    lineHeight: 1.25,
  },
  message: {
    margin: "4px 0 0",
    color: "#166534",
    fontSize: "11px",
    fontWeight: 800,
  },
  statsRow: {
    display: "flex",
    gap: "5px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  statBox: {
    border: "1px solid #dbe3ef",
    borderRadius: "7px",
    background: "#f8fafc",
    padding: "5px 7px",
    display: "grid",
    gap: "2px",
    minWidth: "70px",
    fontSize: "10.5px",
  },
  actionBand: {
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    padding: "6px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "7px",
  },
  primaryButton: {
    border: "0",
    borderRadius: "7px",
    background: "#2563eb",
    color: "#ffffff",
    padding: "6px 9px",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: "11.5px",
  },
  actionHint: {
    color: "#1e3a8a",
    fontSize: "10.5px",
  },
  mappingGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(430px, 0.85fr)",
    gap: "8px",
    alignItems: "stretch",
    minHeight: 0,
    overflow: "hidden",
  },
  leftPane: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    overflow: "hidden",
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr)",
  },
  rightPane: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    overflow: "hidden",
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
  },
  panelHeader: {
    padding: "7px 8px",
    borderBottom: "1px solid #dbe3ef",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    alignItems: "center",
    fontSize: "11.5px",
  },
  panelHeaderStacked: {
    padding: "7px 8px",
    borderBottom: "1px solid #dbe3ef",
    background: "#f8fafc",
    display: "grid",
    gap: "2px",
    color: "#0f172a",
    fontSize: "11.5px",
  },
  select: {
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "4px 6px",
    background: "#ffffff",
    fontSize: "11px",
  },
  searchWrap: {
    padding: "6px 8px",
    borderBottom: "1px solid #e5e7eb",
  },
  searchInput: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    padding: "6px 7px",
    fontSize: "11.5px",
    outline: "none",
  },
  tableScroll: {
    height: "100%",
    minHeight: 0,
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "11px",
  },
  th: {
    textAlign: "left",
    padding: "5px 6px",
    borderBottom: "1px solid #dbe3ef",
    color: "#365a82",
    fontSize: "10px",
    position: "sticky",
    top: 0,
    background: "#ffffff",
    zIndex: 1,
  },
  thRight: {
    textAlign: "right",
    padding: "5px 6px",
    borderBottom: "1px solid #dbe3ef",
    color: "#365a82",
    fontSize: "10px",
    position: "sticky",
    top: 0,
    background: "#ffffff",
    zIndex: 1,
  },
  tr: {
    cursor: "pointer",
  },
  selectedRow: {
    background: "#eff6ff",
    outline: "1px solid #2563eb",
  },
  td: {
    padding: "5px 6px",
    borderBottom: "1px solid #edf1f7",
    verticalAlign: "top",
  },
  tdCode: {
    padding: "5px 6px",
    borderBottom: "1px solid #edf1f7",
    fontWeight: 850,
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tdRight: {
    padding: "5px 6px",
    borderBottom: "1px solid #edf1f7",
    textAlign: "right",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tdMuted: {
    padding: "5px 6px",
    borderBottom: "1px solid #edf1f7",
    color: "#64748b",
    verticalAlign: "top",
    lineHeight: 1.22,
  },
  confidencePill: {
    display: "inline-block",
    borderRadius: "999px",
    padding: "2px 6px",
    fontWeight: 850,
    fontSize: "10px",
  },
  rowActions: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  linkButton: {
    border: "0",
    background: "transparent",
    color: "#2563eb",
    fontWeight: 850,
    cursor: "pointer",
    padding: 0,
    fontSize: "11px",
  },
  dangerButton: {
    border: "0",
    background: "transparent",
    color: "#dc2626",
    fontWeight: 850,
    cursor: "pointer",
    padding: 0,
    fontSize: "11px",
  },
  libraryScroll: {
    height: "100%",
    minHeight: 0,
    overflow: "auto",
    padding: "5px",
  },
  treeFolder: {
    display: "grid",
    gap: "1px",
  },
  treeFolderButton: {
    width: "100%",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    color: "#0f172a",
    padding: "5px 6px",
    display: "flex",
    gap: "6px",
    alignItems: "center",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "11px",
    lineHeight: 1.15,
  },
  treeFolderButtonOpen: {
    background: "#eff6ff",
    border: "1px solid #dbeafe",
    color: "#1d4ed8",
  },
  treeStatement: {
    border: "1px solid #0f172a",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "11.5px",
  },
  treeLeaf: {
    width: "100%",
    border: "1px solid transparent",
    borderRadius: "5px",
    background: "transparent",
    color: "#334155",
    padding: "4px 6px",
    display: "flex",
    justifyContent: "space-between",
    gap: "6px",
    alignItems: "flex-start",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "10.5px",
    lineHeight: 1.18,
  },
  treeLeafSelected: {
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 850,
  },
  treeLeafUsed: {
    border: "1px solid #86efac",
    background: "#f0fdf4",
  },
  usageText: {
    display: "block",
    marginTop: "2px",
    color: "#15803d",
    fontWeight: 800,
    fontSize: "10px",
  },
  bottomAssignBar: {
    borderTop: "1px solid #dbe3ef",
    background: "#f8fafc",
    padding: "6px 8px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 24px minmax(0, 1fr) 82px",
    gap: "8px",
    alignItems: "center",
  },
  assignCell: {
    display: "grid",
    gap: "2px",
    color: "#48617f",
    fontSize: "10.5px",
    lineHeight: 1.2,
  },
  assignArrow: {
    color: "#64748b",
    fontWeight: 850,
    fontSize: "12px",
  },
  assignButton: {
    border: "0",
    borderRadius: "7px",
    background: "#2563eb",
    color: "#ffffff",
    padding: "8px 14px",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: "12px",
  },
  assignButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
headerRight: {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "6px",
  flexWrap: "wrap",
},

compactPrimaryButton: {
  border: "0",
  borderRadius: "7px",
  background: "#2563eb",
  color: "#ffffff",
  padding: "7px 9px",
  fontWeight: 850,
  cursor: "pointer",
  fontSize: "11px",
  whiteSpace: "nowrap",
},

};