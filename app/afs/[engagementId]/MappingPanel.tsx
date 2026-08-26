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

type EntityKind = "company" | "cc" | "trust" | "npc" | "other";

function normaliseEntityKind(value: unknown): EntityKind {
  const text = String(value || "").trim().toLowerCase();

  if (text.includes("trust")) return "trust";
  if (text.includes("close corporation") || text === "cc") return "cc";
  if (text.includes("non-profit") || text.includes("non profit") || text === "npc") {
    return "npc";
  }
  if (text.includes("company")) return "company";
  return "other";
}

function displayMappingText(value: string, entityKind: EntityKind) {
  if (entityKind !== "trust") return value;

  const exact: Record<string, string> = {
    "548 · Shareholder / director / member loans":
      "548 · Trustee / beneficiary / related-party loans",
    "Loans from shareholders / directors / members":
      "Loans from trustees / beneficiaries / related parties",
    "Loans from shareholders / directors / members - general":
      "Loans from trustees / beneficiaries / related parties - general",
    "Shareholder loan": "Trustee loan",
    "Director loan": "Beneficiary loan",
    "Member loan": "Related-party loan",
    "Loans to shareholders / directors / members":
      "Loans to trustees / beneficiaries / related parties",
    "449 · Loans to directors, managers, employees and related parties":
      "449 · Loans to trustees, beneficiaries, employees and related parties",
    "Loans to directors / members / shareholders":
      "Loans to trustees / beneficiaries / related parties",
    "Members / owners contributions":
      "Trust capital / accumulated funds",
    "Directors / members remuneration":
      "Trustee remuneration / administration fees",
  };

  if (exact[value]) return exact[value];

  const numberedStakeholderLoan =
    /^Shareholder \/ director \/ member loan (\d+)$/i.exec(value);

  if (numberedStakeholderLoan) {
    return `Trustee / beneficiary / related-party loan ${numberedStakeholderLoan[1]}`;
  }

  return value
    .replace(
      /shareholders\s*\/\s*directors\s*\/\s*members/gi,
      "trustees / beneficiaries / related parties",
    )
    .replace(
      /shareholder\s*\/\s*director\s*\/\s*member/gi,
      "trustee / beneficiary / related-party",
    )
    .replace(
      /directors\s*\/\s*members\s*\/\s*shareholders/gi,
      "trustees / beneficiaries / related parties",
    )
    .replace(/directors\s*\/\s*members/gi, "trustees");
}

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
        folder("ppe-land", "Land", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Land"], "At cost", "305.10", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Land"], "Accumulated impairment", "305.12", "ppe"),
        ]),
        folder("ppe-buildings", "Buildings", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Buildings"], "At cost", "305.20", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Buildings"], "Accumulated depreciation", "305.21", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Buildings"], "Accumulated impairment", "305.22", "ppe"),
        ]),
        folder("ppe-leasehold-property", "Leasehold property", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Leasehold property"], "At cost", "305.30", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Leasehold property"], "Accumulated depreciation", "305.31", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Leasehold property"], "Accumulated impairment", "305.32", "ppe"),
        ]),
        folder("ppe-plant-machinery", "Plant and machinery", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Plant and machinery"], "At cost", "305.40", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Plant and machinery"], "Accumulated depreciation", "305.41", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Plant and machinery"], "Accumulated impairment", "305.42", "ppe"),
        ]),
        folder("ppe-furniture-fittings", "Furniture and fittings", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Furniture and fittings"], "At cost", "305.50", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Furniture and fittings"], "Accumulated depreciation", "305.51", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Furniture and fittings"], "Accumulated impairment", "305.52", "ppe"),
        ]),
        folder("ppe-motor-vehicles", "Motor vehicles", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Motor vehicles"], "At cost", "305.60", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Motor vehicles"], "Accumulated depreciation", "305.61", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Motor vehicles"], "Accumulated impairment", "305.62", "ppe"),
        ]),
        folder("ppe-office-equipment", "Office equipment", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Office equipment"], "At cost", "305.70", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Office equipment"], "Accumulated depreciation", "305.71", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Office equipment"], "Accumulated impairment", "305.72", "ppe"),
        ]),
        folder("ppe-computer-equipment", "Computer equipment", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Computer equipment"], "At cost", "305.80", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Computer equipment"], "Accumulated depreciation", "305.81", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Computer equipment"], "Accumulated impairment", "305.82", "ppe"),
        ]),
        folder("ppe-leasehold-improvements", "Leasehold improvements", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Leasehold improvements"], "At cost", "305.90", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Leasehold improvements"], "Accumulated depreciation", "305.91", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Leasehold improvements"], "Accumulated impairment", "305.92", "ppe"),
        ]),
        folder("ppe-other-1", "Other PPE 1", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 1"], "At cost", "305.101", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 1"], "Accumulated depreciation", "305.102", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 1"], "Accumulated impairment", "305.103", "ppe"),
        ]),
        folder("ppe-other-2", "Other PPE 2", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 2"], "At cost", "305.111", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 2"], "Accumulated depreciation", "305.112", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 2"], "Accumulated impairment", "305.113", "ppe"),
        ]),
        folder("ppe-other-3", "Other PPE 3", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 3"], "At cost", "305.121", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 3"], "Accumulated depreciation", "305.122", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 3"], "Accumulated impairment", "305.123", "ppe"),
        ]),
        folder("ppe-other-4", "Other PPE 4", [
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 4"], "At cost", "305.131", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 4"], "Accumulated depreciation", "305.132", "ppe"),
          leaf("SFP", "Non-current assets", ["Property, plant and equipment", "Other PPE 4"], "Accumulated impairment", "305.133", "ppe"),
        ]),
      ]),

      folder("sfp-nca-rou", "306 · Right-of-use assets (Full IFRS)", [
        leaf("SFP", "Non-current assets", ["Right-of-use assets"], "At cost", "306.10", "right-of-use-assets"),
        leaf("SFP", "Non-current assets", ["Right-of-use assets"], "Accumulated depreciation", "306.20", "right-of-use-assets"),
        leaf("SFP", "Non-current assets", ["Right-of-use assets"], "Accumulated impairment", "306.30", "right-of-use-assets"),
      ]),

      folder("sfp-nca-investment-property", "310 · Investment property", [
        leaf("SFP", "Non-current assets", ["Investment property"], "Investment property at cost / valuation", "310.10", "investment-property"),
        leaf("SFP", "Non-current assets", ["Investment property"], "Fair value adjustment", "310.20", "investment-property"),
        leaf("SFP", "Non-current assets", ["Investment property"], "Accumulated depreciation", "310.25", "investment-property"),
        leaf("SFP", "Non-current assets", ["Investment property"], "Accumulated impairment", "310.30", "investment-property"),
      ]),

      folder("sfp-nca-intangibles", "320 · Intangible assets", [
        leaf("SFP", "Non-current assets", ["Intangible assets"], "At cost", "320.10", "intangibles"),
        leaf("SFP", "Non-current assets", ["Intangible assets"], "Accumulated amortisation", "320.20", "intangibles"),
        leaf("SFP", "Non-current assets", ["Intangible assets"], "Accumulated impairment", "320.30", "intangibles"),
      ]),

      folder("sfp-nca-goodwill", "321 · Goodwill", [
        leaf("SFP", "Non-current assets", ["Goodwill"], "Goodwill", "321.10", "goodwill"),
        leaf("SFP", "Non-current assets", ["Goodwill"], "Accumulated impairment", "321.20", "goodwill"),
      ]),

      folder("sfp-nca-investments", "325 · Investments and interests in other entities", [
        leaf("SFP", "Non-current assets", ["Investments"], "Investments in subsidiaries", "326.10", "investments-subsidiaries"),
        leaf("SFP", "Non-current assets", ["Investments"], "Investments in associates", "327.10", "investments-associates"),
        leaf("SFP", "Non-current assets", ["Investments"], "Investments in joint ventures", "328.10", "investments-joint-ventures"),
        leaf("SFP", "Non-current assets", ["Investments"], "Other non-current investments", "329.10", "financial-liabilities"),
      ]),

      folder("sfp-nca-biological", "330 · Biological assets", [
        leaf("SFP", "Non-current assets", ["Biological assets"], "Biological assets - fair value model", "330.10", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Biological assets"], "Biological assets - cost model", "330.20", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Biological assets"], "Accumulated depreciation", "330.30", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Biological assets"], "Accumulated impairment", "330.40", "other-non-current-assets"),
      ]),

      folder("sfp-nca-loans-receivable", "340 · Loans and non-current receivables", [
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to parent company", "340.10", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to subsidiaries", "340.11", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to fellow subsidiaries", "340.12", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to associates", "340.13", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to joint ventures", "340.14", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to shareholders / directors / members", "340.20", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Loans to employees", "340.30", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Other related-party loans receivable", "340.40", "loans-receivable"),
        leaf("SFP", "Non-current assets", ["Loans receivable"], "Other non-current loan receivable", "340.90", "loans-receivable"),
      ]),

      folder("sfp-nca-financial-assets", "350 · Other non-current financial assets", [
        leaf("SFP", "Non-current assets", ["Financial assets"], "Debt instruments / deposits at amortised cost", "350.10", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Financial assets"], "Debt instruments at fair value", "350.20", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Financial assets"], "Equity instruments at fair value", "350.30", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Financial assets"], "Derivative financial assets", "350.40", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Financial assets"], "Other non-current financial assets", "350.90", "other-non-current-assets"),
      ]),

      folder("sfp-nca-other", "390 · Other non-current assets", [
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Operating lease / straight-line rental asset", "390.10", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Retirement benefit asset", "390.20", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Long-term deposits", "390.30", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Other non-current asset 1", "390.91", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Other non-current asset 2", "390.92", "other-non-current-assets"),
        leaf("SFP", "Non-current assets", ["Other non-current assets"], "Other non-current asset 3", "390.93", "other-non-current-assets"),
      ]),

      leaf("SFP", "Non-current assets", ["Deferred tax asset"], "Deferred tax asset", "395.10", "deferred-tax-asset"),
    ]),

    folder("sfp-current-assets", "400 · Current assets", [
      folder("sfp-ca-inventory", "405 · Inventories", [
        leaf("SFP", "Current assets", ["Inventories"], "Raw materials", "405.10", "inventory"),
        leaf("SFP", "Current assets", ["Inventories"], "Work in progress", "405.20", "inventory"),
        leaf("SFP", "Current assets", ["Inventories"], "Finished goods", "405.30", "inventory"),
        leaf("SFP", "Current assets", ["Inventories"], "Merchandise / goods for resale", "405.40", "inventory"),
        leaf("SFP", "Current assets", ["Inventories"], "Agricultural produce after harvest", "405.50", "inventory"),
        leaf("SFP", "Current assets", ["Inventories"], "Consumables / stock on hand", "405.90", "inventory"),
      ]),

      folder("sfp-ca-biological", "410 · Current biological assets", [
        leaf("SFP", "Current assets", ["Biological assets"], "Current biological assets - fair value model", "410.10", "inventory"),
        leaf("SFP", "Current assets", ["Biological assets"], "Current biological assets - cost model", "410.20", "inventory"),
      ]),

      folder("sfp-ca-contract-assets", "415 · Contract assets / work performed not billed", [
        leaf("SFP", "Current assets", ["Contract assets"], "Contract assets", "415.10", "construction-contracts-receivable"),
        leaf("SFP", "Current assets", ["Contract assets"], "Construction contract asset / receivable", "415.20", "construction-contracts-receivable"),
      ]),

      folder("sfp-ca-cash", "420 · Cash and cash equivalents", [
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Current bank account", "420.10", "cash", "bank"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Savings account", "420.20", "cash", "bank"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Call account", "420.30", "cash", "bank"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Short-term deposits / money market", "420.35", "cash"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Petty cash", "420.40", "cash", "cash"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Cash on hand", "420.50", "cash", "cash"),
        leaf("SFP", "Current assets", ["Cash and cash equivalents"], "Restricted cash - current", "420.60", "cash"),
      ]),

      folder("sfp-ca-receivables", "430 · Trade and other receivables", [
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Trade receivables", "430.10", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Allowance / provision for impairment", "430.20", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Other receivable 1", "430.31", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Other receivable 2", "430.32", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Prepayments", "430.40", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Deposits paid", "430.50", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "Accrued income", "430.60", "receivables"),
        leaf("SFP", "Current assets", ["Trade and other receivables"], "VAT / indirect tax receivable not mapped to tax control", "430.70", "receivables"),
      ]),

      folder("sfp-ca-financial-assets", "435 · Current financial assets / short-term investments", [
        leaf("SFP", "Current assets", ["Current financial assets"], "Short-term investments / deposits", "435.10", "receivables"),
        leaf("SFP", "Current assets", ["Current financial assets"], "Derivative financial assets", "435.20", "receivables"),
        leaf("SFP", "Current assets", ["Current financial assets"], "Other current financial assets", "435.90", "receivables"),
      ]),

      folder("sfp-ca-related-loans", "449 · Loans to directors, managers, employees and related parties", [
        leaf("SFP", "Current assets", ["Current loans receivable"], "Loans to directors / members / shareholders", "449.10", "directors-employee-loans"),
        leaf("SFP", "Current assets", ["Current loans receivable"], "Loans to employees", "449.20", "directors-employee-loans"),
        leaf("SFP", "Current assets", ["Current loans receivable"], "Current related-party loans receivable", "449.30", "directors-employee-loans"),
        leaf("SFP", "Current assets", ["Current loans receivable"], "Current portion of other loan receivable", "449.90", "directors-employee-loans"),
      ]),

      folder("sfp-ca-tax-controls", "490 · Tax and statutory controls", [
        leaf("SFP", "Current assets", ["Tax and statutory controls"], "VAT receivable", "490.10", "tax-controls", smartDebitCredit),
        leaf("SFP", "Current assets", ["Tax and statutory controls"], "PAYE / UIF / SDL receivable", "490.20", "tax-controls", smartDebitCredit),
        leaf("SFP", "Current assets", ["Tax and statutory controls"], "Other SARS / statutory receivable", "490.90", "tax-controls", smartDebitCredit),
      ]),

      leaf("SFP", "Current assets", ["Current tax receivable"], "Current tax receivable", "495.10", "current-tax-receivable"),
      leaf("SFP", "Current assets", ["Assets held for sale"], "Assets held for sale (Full IFRS)", "499.10", "assets-held-for-sale"),
    ]),

    folder("sfp-equity", "800 · Equity", [
      folder("sfp-equity-capital", "805 · Share capital / contributions", [
        leaf("SFP", "Equity", ["Share capital / contributions"], "Ordinary share capital", "805.10", "share-capital"),
        leaf("SFP", "Equity", ["Share capital / contributions"], "Share premium", "805.20", "share-capital"),
        leaf("SFP", "Equity", ["Share capital / contributions"], "Members / owners contributions", "805.30", "share-capital"),
        leaf("SFP", "Equity", ["Share capital / contributions"], "Preference shares classified as equity", "805.40", "share-capital"),
        leaf("SFP", "Equity", ["Share capital / contributions"], "Treasury / own shares", "805.90", "share-capital"),
      ]),
      leaf("SFP", "Equity", ["Retained income"], "Retained income / accumulated loss", "810.10", "retained-income"),
      folder("sfp-equity-reserves", "820 · Reserves", [
        leaf("SFP", "Equity", ["Reserves"], "Revaluation reserve", "820.10", "reserves"),
        leaf("SFP", "Equity", ["Reserves"], "Foreign currency translation reserve", "820.20", "reserves"),
        leaf("SFP", "Equity", ["Reserves"], "Fair value / OCI reserve", "820.30", "reserves"),
        leaf("SFP", "Equity", ["Reserves"], "Hedging reserve", "820.40", "reserves"),
        leaf("SFP", "Equity", ["Reserves"], "Share-based payment reserve", "820.50", "reserves"),
        leaf("SFP", "Equity", ["Reserves"], "Other reserve 1", "820.91", "reserves"),
        leaf("SFP", "Equity", ["Reserves"], "Other reserve 2", "820.92", "reserves"),
      ]),
      leaf("SFP", "Equity", ["Non-controlling interests"], "Non-controlling interests", "830.10", "reserves"),
      leaf("SFP", "Equity", ["Other equity"], "Other equity / compound instrument equity component", "840.10", "reserves"),
    ]),

    folder("sfp-non-current-liabilities", "500 · Non-current liabilities", [
      folder("sfp-ncl-provisions", "515 · Non-current provisions", [
        leaf("SFP", "Non-current liabilities", ["Provisions"], "Long-term provisions - general", "515.10", "provisions"),
        leaf("SFP", "Non-current liabilities", ["Provisions"], "Warranty provision", "515.20", "provisions"),
        leaf("SFP", "Non-current liabilities", ["Provisions"], "Legal claims provision", "515.30", "provisions"),
        leaf("SFP", "Non-current liabilities", ["Provisions"], "Restoration / decommissioning provision", "515.40", "provisions"),
        leaf("SFP", "Non-current liabilities", ["Provisions"], "Other non-current provision", "515.90", "provisions"),
      ]),

      folder("sfp-ncl-employee-benefits", "520 · Non-current employee benefit obligations", [
        leaf("SFP", "Non-current liabilities", ["Employee benefit obligations"], "Defined benefit / post-employment obligation", "520.10", "provisions"),
        leaf("SFP", "Non-current liabilities", ["Employee benefit obligations"], "Long-service / other long-term employee benefits", "520.20", "provisions"),
        leaf("SFP", "Non-current liabilities", ["Employee benefit obligations"], "Other non-current employee benefit liability", "520.90", "provisions"),
      ]),

      folder("sfp-ncl-deferred-income", "531 · Deferred income / grants", [
        leaf("SFP", "Non-current liabilities", ["Deferred income"], "Deferred income", "531.10", "deferred-income"),
        leaf("SFP", "Non-current liabilities", ["Deferred income"], "Government grant liability / deferred grant income", "531.20", "deferred-income"),
        leaf("SFP", "Non-current liabilities", ["Deferred income"], "Other non-current deferred income", "531.90", "deferred-income"),
      ]),

      folder("sfp-ncl-related-party", "547 · Group and related-party borrowings", [
        leaf("SFP", "Non-current liabilities", ["Group and related-party borrowings"], "Loan from parent company", "547.10", "loans-group-companies-payable"),
        leaf("SFP", "Non-current liabilities", ["Group and related-party borrowings"], "Loan from subsidiary", "547.20", "loans-group-companies-payable"),
        leaf("SFP", "Non-current liabilities", ["Group and related-party borrowings"], "Loan from fellow subsidiary", "547.30", "loans-group-companies-payable"),
        leaf("SFP", "Non-current liabilities", ["Group and related-party borrowings"], "Loan from associate", "547.40", "loans-group-companies-payable"),
        leaf("SFP", "Non-current liabilities", ["Group and related-party borrowings"], "Loan from joint venture", "547.50", "loans-group-companies-payable"),
        leaf("SFP", "Non-current liabilities", ["Group and related-party borrowings"], "Other related-party borrowing", "547.90", "loans-group-companies-payable"),
      ]),

      folder("sfp-ncl-stakeholder-loans", "548 · Shareholder / director / member loans", [
        leaf("SFP", "Non-current liabilities", ["Loans from stakeholders"], "Stakeholder loan - general", "548.10", "loans-stakeholders-payable"),
        leaf("SFP", "Non-current liabilities", ["Loans from stakeholders"], "Shareholder loan", "548.20", "loans-stakeholders-payable"),
        leaf("SFP", "Non-current liabilities", ["Loans from stakeholders"], "Director loan", "548.30", "loans-stakeholders-payable"),
        leaf("SFP", "Non-current liabilities", ["Loans from stakeholders"], "Member loan", "548.40", "loans-stakeholders-payable"),
        ...numberedStakeholderLoanLeaves(),
      ]),

      folder("sfp-ncl-borrowings", "550 · Borrowings and other financial liabilities", [
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Borrowings / financial liabilities - general", "550.10", "financial-liabilities"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Bank loan", "550.20", "borrowings"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Mortgage bond", "550.30", "borrowings"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Asset finance / vehicle finance", "550.40", "borrowings"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Instalment sale liability", "550.50", "borrowings"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Debenture / bond liability", "550.60", "borrowings"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Preference shares classified as liability", "550.70", "borrowings"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Private lender borrowing", "550.80", "borrowings"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Other secured borrowing", "550.91", "borrowings"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Other unsecured borrowing", "550.92", "borrowings"),
        leaf("SFP", "Non-current liabilities", ["Borrowings"], "Other non-current borrowing", "550.99", "borrowings"),
      ]),

      /* Legacy code retained so existing engagements do not break. */
      leaf("SFP", "Non-current liabilities", ["Borrowings"], "Borrowings - legacy", "551.10", "borrowings"),

      folder("sfp-ncl-leases", "555 · Lease liabilities", [
        leaf("SFP", "Non-current liabilities", ["Lease liabilities"], "Lease liabilities - non-current", "555.10", "lease-liabilities"),
        leaf("SFP", "Non-current liabilities", ["Lease liabilities"], "Finance lease liability - non-current", "555.20", "lease-liabilities"),
      ]),

      folder("sfp-ncl-derivatives", "560 · Derivative and other complex financial liabilities", [
        leaf("SFP", "Non-current liabilities", ["Financial liabilities"], "Derivative financial liability", "560.10", "financial-liabilities"),
        leaf("SFP", "Non-current liabilities", ["Financial liabilities"], "Other complex financial liability", "560.90", "financial-liabilities"),
      ]),

      folder("sfp-ncl-supplier-finance", "580 · Supplier finance arrangements - non-current", [
        leaf("SFP", "Non-current liabilities", ["Supplier finance arrangements"], "Supplier finance arrangement - non-current", "580.10", "financial-liabilities"),
      ]),

      folder("sfp-ncl-other", "590 · Other non-current liabilities", [
        leaf("SFP", "Non-current liabilities", ["Other non-current liabilities"], "Other non-current financial liability", "590.10", "other-non-current-liabilities"),
        leaf("SFP", "Non-current liabilities", ["Other non-current liabilities"], "Other non-current non-financial liability", "590.20", "other-non-current-liabilities"),
      ]),

      leaf("SFP", "Non-current liabilities", ["Deferred tax liability"], "Deferred tax liability", "595.10", "deferred-tax-liability"),
    ]),

    folder("sfp-current-liabilities", "600 · Current liabilities", [
      folder("sfp-cl-current-borrowings", "610 · Current borrowings", [
        leaf("SFP", "Current liabilities", ["Current borrowings"], "Current portion of bank loan", "610.10", "borrowings"),
        leaf("SFP", "Current liabilities", ["Current borrowings"], "Current portion of mortgage bond", "610.20", "borrowings"),
        leaf("SFP", "Current liabilities", ["Current borrowings"], "Current portion of asset / vehicle finance", "610.30", "borrowings"),
        leaf("SFP", "Current liabilities", ["Current borrowings"], "Current portion of instalment sale liability", "610.40", "borrowings"),
        leaf("SFP", "Current liabilities", ["Current borrowings"], "Current related-party borrowing", "610.50", "borrowings"),
        leaf("SFP", "Current liabilities", ["Current borrowings"], "Short-term loan / revolving credit facility", "610.60", "borrowings"),
        leaf("SFP", "Current liabilities", ["Current borrowings"], "Other current borrowing", "610.90", "borrowings"),
      ]),

      folder("sfp-cl-current-leases", "615 · Current lease liabilities", [
        leaf("SFP", "Current liabilities", ["Lease liabilities"], "Lease liabilities - current", "615.10", "lease-liabilities"),
        leaf("SFP", "Current liabilities", ["Lease liabilities"], "Finance lease liability - current", "615.20", "lease-liabilities"),
      ]),

      leaf("SFP", "Current liabilities", ["Bank overdraft"], "Bank overdraft", "620.10", "bank-overdraft"),

      folder("sfp-cl-derivatives", "625 · Current derivative financial liabilities", [
        leaf("SFP", "Current liabilities", ["Financial liabilities"], "Derivative financial liability - current", "625.10", "financial-liabilities"),
      ]),

      folder("sfp-cl-payables", "630 · Trade and other payables", [
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Trade payables", "630.10", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Accrued expenses", "630.20", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Payroll / salaries payable", "630.30", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Leave pay / bonus payable", "630.35", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Other payable 1", "630.41", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Other payable 2", "630.42", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Customer deposits / amounts received in advance", "630.50", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Retentions payable", "630.60", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Related-party payable", "630.70", "payables"),
        leaf("SFP", "Current liabilities", ["Trade and other payables"], "Other trade and other payable", "630.90", "payables"),
      ]),

      folder("sfp-cl-contract-liabilities", "640 · Contract liabilities / deferred revenue", [
        leaf("SFP", "Current liabilities", ["Contract liabilities"], "Contract liability / deferred revenue", "640.10", "deferred-income"),
        leaf("SFP", "Current liabilities", ["Contract liabilities"], "Construction contract liability", "640.20", "deferred-income"),
      ]),

      folder("sfp-cl-grants", "650 · Current deferred income / grants", [
        leaf("SFP", "Current liabilities", ["Deferred income"], "Deferred income - current", "650.10", "deferred-income"),
        leaf("SFP", "Current liabilities", ["Deferred income"], "Government grant liability - current", "650.20", "deferred-income"),
      ]),

      folder("sfp-cl-provisions", "660 · Current provisions", [
        leaf("SFP", "Current liabilities", ["Provisions"], "Provision - current portion", "660.10", "provisions"),
        leaf("SFP", "Current liabilities", ["Provisions"], "Warranty provision - current", "660.20", "provisions"),
        leaf("SFP", "Current liabilities", ["Provisions"], "Other current provision", "660.90", "provisions"),
      ]),

      folder("sfp-cl-employee-benefits", "670 · Current employee benefit liabilities", [
        leaf("SFP", "Current liabilities", ["Employee benefit liabilities"], "Employee benefits payable", "670.10", "payables"),
        leaf("SFP", "Current liabilities", ["Employee benefit liabilities"], "Bonus / incentive provision", "670.20", "payables"),
        leaf("SFP", "Current liabilities", ["Employee benefit liabilities"], "Other current employee benefit liability", "670.90", "payables"),
      ]),

      folder("sfp-cl-supplier-finance", "680 · Supplier finance arrangements - current", [
        leaf("SFP", "Current liabilities", ["Supplier finance arrangements"], "Supplier finance arrangement - current", "680.10", "financial-liabilities"),
      ]),

      leaf("SFP", "Current liabilities", ["Dividend payable"], "Dividend payable", "688.10", "dividend-payable"),

      folder("sfp-cl-tax-controls", "690 · Tax and statutory controls", [
        leaf("SFP", "Current liabilities", ["Tax and statutory controls"], "VAT payable", "690.10", "tax-controls", smartDebitCredit),
        leaf("SFP", "Current liabilities", ["Tax and statutory controls"], "PAYE / UIF / SDL payable", "690.20", "tax-controls", smartDebitCredit),
        leaf("SFP", "Current liabilities", ["Tax and statutory controls"], "Other SARS / statutory payable", "690.90", "tax-controls", smartDebitCredit),
      ]),

      leaf("SFP", "Current liabilities", ["Current tax payable"], "Current tax payable", "695.10", "current-tax-payable"),
      leaf("SFP", "Current liabilities", ["Liabilities held for sale"], "Liabilities held for sale (Full IFRS)", "699.10", "liabilities-held-for-sale"),
    ]),
  ]),

  folder("pl", "Income Statement", [
    folder("pl-revenue-income", "700 · Revenue and income", [
      folder("pl-revenue", "700 · Revenue", [
        leaf("P/L", "Revenue and income", ["Revenue"], "Revenue - general", "700.10", "revenue"),
        leaf("P/L", "Revenue and income", ["Revenue"], "Sales / goods", "700.20", "revenue", "sales"),
        leaf("P/L", "Revenue and income", ["Revenue"], "Services", "700.30", "revenue"),
        leaf("P/L", "Revenue and income", ["Revenue"], "Construction / long-term contract revenue", "700.40", "revenue"),
        leaf("P/L", "Revenue and income", ["Revenue"], "Rental income", "700.50", "revenue"),
        leaf("P/L", "Revenue and income", ["Revenue"], "Commission income", "700.60", "revenue"),
        leaf("P/L", "Revenue and income", ["Revenue"], "Franchise income", "700.70", "revenue"),
        leaf("P/L", "Revenue and income", ["Revenue"], "Subscription / recurring service income", "700.80", "revenue"),
        leaf("P/L", "Revenue and income", ["Revenue"], "Royalty income", "700.90", "revenue"),
      ]),

      folder("pl-operating-income", "730 · Other operating income", [
        leaf("P/L", "Revenue and income", ["Operating income"], "Operating income - general", "730.10", "operating-income"),
        leaf("P/L", "Revenue and income", ["Operating income"], "Government grant income", "730.20", "operating-income"),
        leaf("P/L", "Revenue and income", ["Operating income"], "Insurance recoveries", "730.30", "operating-income"),
        leaf("P/L", "Revenue and income", ["Operating income"], "Other operating income", "730.90", "operating-income"),
      ]),

      folder("pl-investment-income", "770 · Investment and finance income", [
        leaf("P/L", "Revenue and income", ["Investment income"], "Interest received", "770.10", "investment-income"),
        leaf("P/L", "Revenue and income", ["Investment income"], "Dividend income", "770.20", "investment-income"),
        leaf("P/L", "Revenue and income", ["Investment income"], "Fair value income on financial assets", "770.30", "investment-income"),
        leaf("P/L", "Revenue and income", ["Investment income"], "Other investment income", "770.90", "investment-income"),
      ]),

      leaf("P/L", "Revenue and income", ["Non-operating income"], "Non-operating income", "785.10", "non-operating-income"),
    ]),

    folder("pl-cost-sales", "720 · Cost of sales", [
      leaf("P/L", "Cost of sales", ["Cost of sales"], "Cost of sales", "720.10", "cost-of-sales"),
      leaf("P/L", "Cost of sales", ["Cost of sales"], "Purchases", "720.20", "cost-of-sales"),
      leaf("P/L", "Cost of sales", ["Cost of sales"], "Opening / closing stock movement", "720.30", "cost-of-sales"),
      leaf("P/L", "Cost of sales", ["Cost of sales"], "Direct labour", "720.40", "cost-of-sales"),
      leaf("P/L", "Cost of sales", ["Cost of sales"], "Direct production / contract costs", "720.50", "cost-of-sales"),
      leaf("P/L", "Cost of sales", ["Cost of sales"], "Other direct costs", "720.90", "cost-of-sales"),
    ]),

    folder("pl-expenses", "750 · Operating expenses", [
      folder("pl-expenses-admin", "Administration", [
        leaf("P/L", "Operating expenses", ["Administration"], "Accounting fees", "750.10", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Audit / independent review fees", "750.11", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Bad debts / impairment losses", "750.12", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Bank charges", "750.13", "operating-expenses", "bank charges"),
        leaf("P/L", "Operating expenses", ["Administration"], "Depreciation", "750.14", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Amortisation", "750.141", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Insurance", "750.15", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Legal fees", "750.16", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Motor vehicle expenses", "750.17", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Rent paid", "750.18", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Repairs and maintenance", "750.19", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Salaries and wages", "750.20", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Staff costs / employee benefits", "750.21", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Telephone and internet", "750.22", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Travel and accommodation", "750.23", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Fines and penalties", "750.24", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Software subscriptions", "750.25", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Printing and stationery", "750.26", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Courier and postage", "750.27", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Directors / members remuneration", "750.28", "operating-expenses"),
        leaf("P/L", "Operating expenses", ["Administration"], "Employee benefit expense", "750.29", "operating-expenses"),
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

    folder("pl-finance-tax", "775 · Finance costs and taxation", [
      folder("pl-finance-costs", "775 · Finance costs", [
        leaf("P/L", "Finance and taxation", ["Finance costs"], "Interest paid - general", "775.10", "finance-costs"),
        leaf("P/L", "Finance and taxation", ["Finance costs"], "Bank interest", "775.20", "finance-costs"),
        leaf("P/L", "Finance and taxation", ["Finance costs"], "Lease / finance lease interest", "775.30", "finance-costs"),
        leaf("P/L", "Finance and taxation", ["Finance costs"], "Loan / borrowing interest", "775.40", "finance-costs"),
        leaf("P/L", "Finance and taxation", ["Finance costs"], "Unwinding of discount", "775.50", "finance-costs"),
        leaf("P/L", "Finance and taxation", ["Finance costs"], "Other finance costs", "775.90", "finance-costs"),
      ]),

      folder("pl-taxation", "795 · Taxation", [
        leaf("P/L", "Finance and taxation", ["Taxation"], "Current tax expense", "795.10", "taxation"),
        leaf("P/L", "Finance and taxation", ["Taxation"], "Deferred tax expense / (income)", "795.20", "taxation"),
        leaf("P/L", "Finance and taxation", ["Taxation"], "Prior year tax under / over provision", "795.30", "taxation"),
        leaf("P/L", "Finance and taxation", ["Taxation"], "Other taxation", "795.90", "taxation"),
      ]),
    ]),

    folder("pl-other-performance", "780 · Other gains, losses and OCI", [
      leaf("P/L", "Other performance", ["Non-operating gains / losses"], "Gain / loss on disposal of assets", "780.10", "non-operating-gains-losses"),
      leaf("P/L", "Other performance", ["Non-operating gains / losses"], "Fair value gains / losses", "780.20", "non-operating-gains-losses"),
      leaf("P/L", "Other performance", ["Non-operating gains / losses"], "Foreign exchange gains / losses", "780.30", "non-operating-gains-losses"),
      leaf("P/L", "Other performance", ["Non-operating gains / losses"], "Impairment / reversal outside operating expenses", "780.40", "non-operating-gains-losses"),
      leaf("P/L", "Other performance", ["Non-operating expenses"], "Non-operating expenses", "781.10", "non-operating-expenses"),

      folder("pl-oci", "797 · Other comprehensive income", [
        leaf("P/L", "Other performance", ["Other comprehensive income"], "Other comprehensive income - general", "797.10", "other-comprehensive-income"),
        leaf("P/L", "Other performance", ["Other comprehensive income"], "Revaluation surplus / (loss)", "797.20", "other-comprehensive-income"),
        leaf("P/L", "Other performance", ["Other comprehensive income"], "Foreign currency translation differences", "797.30", "other-comprehensive-income"),
        leaf("P/L", "Other performance", ["Other comprehensive income"], "Fair value / hedging reserve movement", "797.40", "other-comprehensive-income"),
        leaf("P/L", "Other performance", ["Other comprehensive income"], "Remeasurement of defined benefit obligation", "797.50", "other-comprehensive-income"),
      ]),

      leaf("P/L", "Other performance", ["Discontinued operations"], "Discontinued operations (Full IFRS)", "799.10", "discontinued-operations"),
    ]),
  ]),

  folder("other", "Other / disclosure-only mappings", [
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
  const [financialStatementLabel, setFinancialStatementLabel] = useState("");
  const [searchText, setSearchText] = useState("");
  const [accountFilter, setAccountFilter] = useState("Unmapped");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [entityKind, setEntityKind] = useState<EntityKind>("company");
const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalLines(trialBalanceLines);
  }, [trialBalanceLines]);

  useEffect(() => {
    let cancelled = false;

    async function loadEntityKind() {
      if (!engagementId) return;

      try {
        const response = await fetch(
          `/api/afs/engagements/${engagementId}/client-setup`,
          { cache: "no-store" },
        );
        const result = await response.json();

        if (!cancelled && response.ok) {
          setEntityKind(normaliseEntityKind(result?.setup?.entity_type));
        }
      } catch {
        // Presentation-only enhancement. Mapping behaviour must continue
        // even if Client Setup cannot be loaded temporarily.
      }
    }

    void loadEntityKind();

    return () => {
      cancelled = true;
    };
  }, [engagementId]);

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

  function selectLine(line: EnrichedLine) {
    setSelectedLineKey(line.lineKey);

    const mappedLeaf =
      findLeafByCode(String(line.mapping_code || "")) ||
      allMappingLeaves.find((item) => item.id === line.mapping_leaf_id) ||
      null;

    if (mappedLeaf) {
      setSelectedLeaf(mappedLeaf);
    }

    setFinancialStatementLabel(
      displayMappingText(
        String(line.mapping_label || mappedLeaf?.label || "").trim(),
        entityKind,
      ),
    );
  }

  function selectMappingLeaf(mappingLeaf: MappingLeaf) {
    setSelectedLeaf(mappingLeaf);

    const existingLabel =
      selectedLine &&
      selectedLine.mapping_code === mappingLeaf.mappingCode
        ? String(selectedLine.mapping_label || "").trim()
        : "";

    setFinancialStatementLabel(
      displayMappingText(existingLabel || mappingLeaf.label, entityKind),
    );
  }

  function toggleNode(id: string) {
    setOpenNodes((current) => ({ ...current, [id]: !current[id] }));
  }

  async function saveMapping(
    line: EnrichedLine,
    mappingLeaf: MappingLeaf,
    confidence = "Manual",
    presentationLabel = ""
  ) {
    if (!line.id && !line.account_code) {
      alert("This trial balance line does not have an ID or account number yet.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const effectivePresentationLabel =
        presentationLabel.trim() ||
        displayMappingText(mappingLeaf.label, entityKind);

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
            mappingCategory: mappingLeaf.label,
            mappingLabel: effectivePresentationLabel,
            financialStatementLabel: effectivePresentationLabel,
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
      setFinancialStatementLabel(
        displayMappingText(
          String(
            updatedLine.mapping_label ||
              effectivePresentationLabel ||
              mappingLeaf.label,
          ),
          entityKind,
        ),
      );
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

    await saveMapping(
      selectedLine,
      selectedLeaf,
      "Manual",
      financialStatementLabel
    );
  }

  async function applySuggestedMapping(line: EnrichedLine) {
    if (!line.suggested.leaf) {
      alert("No suggestion available for this account.");
      return;
    }

    await saveMapping(
      line,
      line.suggested.leaf,
      line.suggested.confidence,
      line.suggested.leaf.label
    );
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
        await saveMapping(
          line,
          line.suggested.leaf,
          line.suggested.confidence,
          line.suggested.leaf.label
        );
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
                        onClick={() => selectLine(line)}
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
                              {displayMappingText(
                                line.mapping_label || "Mapped",
                                entityKind,
                              )}
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
                              {displayMappingText(
                                line.suggested.leaf.label,
                                entityKind,
                              )}
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
                setSelectedLeaf={selectMappingLeaf}
                leafUsage={leafUsage}
                entityKind={entityKind}
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
              ? `${selectedLeaf.mappingCode} · ${selectedLeaf.path
                  .map((item) => displayMappingText(item, entityKind))
                  .join(" > ")} > ${displayMappingText(
                  selectedLeaf.label,
                  entityKind,
                )}`
              : "None selected"}
          </strong>

          <label style={styles.presentationLabelWrap}>
            <span>Financial statement description</span>
            <input
              type="text"
              style={styles.presentationLabelInput}
              value={financialStatementLabel}
              disabled={!selectedLeaf || saving}
              placeholder={
                selectedLeaf
                  ? displayMappingText(selectedLeaf.label, entityKind)
                  : "Select a mapping first"
              }
              onChange={(event) =>
                setFinancialStatementLabel(event.target.value)
              }
            />
          </label>
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
  entityKind,
}: {
  node: MappingNode;
  level: number;
  openNodes: Record<string, boolean>;
  toggleNode: (id: string) => void;
  selectedLeaf: MappingLeaf | null;
  setSelectedLeaf: (leaf: MappingLeaf) => void;
  leafUsage: Record<string, LeafUsage>;
  entityKind: EntityKind;
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
          {displayMappingText(node.label, entityKind)}
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
        <strong>{displayMappingText(node.label, entityKind)}</strong>
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
              entityKind={entityKind}
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
  /*
    IMPORTANT:
    Suggestions may inspect the account description to help the preparer.
    They NEVER classify the AFS themselves. Only the mapping code selected
    and saved by the preparer drives statements, notes and lead schedules.
  */
  const name = String(line.account_name || "").toLowerCase();
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
    name.includes("vehicle finance") ||
    name.includes("asset finance") ||
    name.includes("wesbank") ||
    name.includes("mfc")
  ) {
    return medium(
      balance < 0 ? "550.40" : "340.90",
      "Vehicle / asset finance wording detected. Review legal agreement before assigning."
    );
  }

  if (name.includes("mortgage") || name.includes("bond")) {
    return medium(balance < 0 ? "550.30" : "340.90", "Mortgage / bond wording detected.");
  }

  if (name.includes("instalment sale") || name.includes("installment sale")) {
    return medium(balance < 0 ? "550.50" : "340.90", "Instalment sale wording detected.");
  }

  if (
    name.includes("nedbank") ||
    name.includes("absa") ||
    name.includes("fnb") ||
    name.includes("standard bank") ||
    name.includes("capitec") ||
    (name.includes("bank") && !name.includes("charges") && !name.includes("interest"))
  ) {
    return high(balance < 0 ? "620.10" : "420.10", "Bank account detected. Review whether a credit balance is a true overdraft or other financing.");
  }

  if (name.includes("vat")) return high(balance < 0 ? "690.10" : "490.10", "VAT control detected.");
  if (name.includes("paye") || name.includes("uif") || name.includes("sdl")) {
    return high(balance < 0 ? "690.20" : "490.20", "Payroll statutory control detected.");
  }
  if (name.includes("income tax") || name.includes("current tax")) {
    return high(balance < 0 ? "695.10" : "495.10", "Income tax detected.");
  }

  if (name.includes("debtor") || name.includes("accounts receivable") || name.includes("trade receivable")) {
    return high("430.10", "Trade receivable detected.");
  }
  if (name.includes("creditor") || name.includes("accounts payable") || name.includes("trade payable")) {
    return high("630.10", "Trade payable detected.");
  }
  if (name.includes("accrual")) return high("630.20", "Accrual detected.");
  if (name.includes("inventory") || name.includes("stock")) return medium("405.90", "Inventory / stock detected.");

  if (name.includes("share premium")) return high("805.20", "Share premium detected.");
  if (name.includes("share capital") || name === "capital") return high("805.10", "Share capital / capital detected.");
  if (name.includes("retained income") || name.includes("accumulated loss")) return high("810.10", "Retained income detected.");

  if (name.includes("sales") || name.includes("turnover")) return high("700.20", "Sales / turnover detected.");
  if (name.includes("service income") || name.includes("service revenue")) return medium("700.30", "Service revenue detected.");
  if (name.includes("rental income")) return medium("700.50", "Rental income detected.");
  if (name.includes("commission income")) return medium("700.60", "Commission income detected.");
  if (name.includes("franchise income")) return medium("700.70", "Franchise income detected.");
  if (name.includes("subscription income")) return medium("700.80", "Subscription income detected.");
  if (name.includes("revenue")) return medium("700.10", "Revenue detected.");

  if (name.includes("cost of sales")) return high("720.10", "Cost of sales detected.");
  if (name.includes("purchases")) return high("720.20", "Purchases detected.");
  if (name.includes("interest received")) return high("770.10", "Interest received detected.");
  if (name.includes("interest paid") || name.includes("loan interest")) return high("775.40", "Borrowing interest detected.");

  if (name.includes("shareholder loan")) return medium(balance < 0 ? "548.20" : "340.20", "Shareholder loan wording detected.");
  if (name.includes("director loan")) return medium(balance < 0 ? "548.30" : "340.20", "Director loan wording detected.");
  if (name.includes("member loan")) return medium(balance < 0 ? "548.40" : "340.20", "Member loan wording detected.");

  if (name.includes("loan") && balance >= 0) return low("340.90", "Loan receivable detected. Confirm counterparty and current/non-current classification.");
  if (name.includes("loan") && balance < 0) return low("550.99", "Loan payable detected. Confirm lender, relationship, security and current/non-current classification.");

  if (name.includes("motor vehicle")) return medium("305.60", "Motor vehicle asset detected.");
  if (name.includes("office equipment")) return medium("305.70", "Office equipment detected.");
  if (name.includes("computer equipment")) return medium("305.80", "Computer equipment detected.");

  const expense1 = findLeafByLabel("Other expenses 1");
  if (expense1 && balance > 0) {
    return { leaf: expense1, confidence: "Low", reason: "Debit balance requires preparer review." };
  }

  return low("750.90", "No reliable suggestion. Review manually.");
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
  border: "1px solid #cbd5e1",
  borderRadius: "0px",
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
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
    background: "#f8fafc",
    padding: "5px 7px",
    display: "grid",
    gap: "2px",
    minWidth: "70px",
    fontSize: "10.5px",
  },
  actionBand: {
    border: "1px solid #bfdbfe",
    borderRadius: "0px",
    background: "#eff6ff",
    padding: "6px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "7px",
  },
  primaryButton: {
    border: "1px solid #0f172a",
    borderRadius: "0px",
    background: "#0f172a",
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
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
    background: "#ffffff",
    overflow: "hidden",
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr)",
  },
  rightPane: {
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
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
    borderRadius: "0px",
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
    borderRadius: "0px",
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
    borderRadius: "0px",
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
    borderRadius: "0px",
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
    borderRadius: "0px",
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
    gridTemplateColumns: "minmax(0, 0.85fr) 24px minmax(360px, 1.15fr) 82px",
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
  presentationLabelWrap: {
    display: "grid",
    gridTemplateColumns: "145px minmax(180px, 1fr)",
    gap: "6px",
    alignItems: "center",
    marginTop: "4px",
    color: "#334155",
    fontSize: "10px",
    fontWeight: 800,
  },
  presentationLabelInput: {
    width: "100%",
    minWidth: 0,
    border: "1px solid #94a3b8",
    borderRadius: "0px",
    background: "#ffffff",
    padding: "5px 6px",
    color: "#0f172a",
    fontSize: "11px",
    outline: "none",
  },
  assignArrow: {
    color: "#64748b",
    fontWeight: 850,
    fontSize: "12px",
  },
  assignButton: {
    border: "1px solid #0f172a",
    borderRadius: "0px",
    background: "#0f172a",
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
  border: "1px solid #0f172a",
  borderRadius: "0px",
  background: "#0f172a",
  color: "#ffffff",
  padding: "7px 9px",
  fontWeight: 850,
  cursor: "pointer",
  fontSize: "11px",
  whiteSpace: "nowrap",
},

};
