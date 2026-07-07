"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type {
  AfsReportOption,
  AfsStudioSection,
} from "../../components/AfsPrintStudioShell";
import AfsA4Page from "../../components/AfsA4Page";
import AfsStatementTable, {
  AfsStatementRow,
} from "../../components/AfsStatementTable";
import AfsDirectorsReportSettings from "../../components/AfsDirectorsReportSettings";
import AfsEditableDisclosureSettings from "../../components/AfsEditableDisclosureSettings";
import AfsStatementOverrideSettings from "../../components/AfsStatementOverrideSettings";
import AfsStructuredNotesPanel from "../AfsStructuredNotesPanel";
import {
  buildAfsFlightDeckIssuesFromEngine,
} from "../AfsFlightDeck";
import {
  DirectorsResponsibilitiesBlock,
  DirectorsReportBlock,
  CompilationReportBlock,
  buildDefaultDirectorsReportTexts,
  DirectorsReportSectionKey,
  DirectorsReportTextOverrides,
} from "../../components/AfsNarrativeBlocks";
import {
  accountingPolicySections,
  noteSections,
  buildDefaultAccountingPolicyTexts,
  buildDefaultNoteTexts,
  renderDisclosureText,
  EditableDisclosureTextMap,
} from "../../components/AfsPolicyNoteDefaults";
import {
  buildAfsPrintStatementEngine,
  AfsStatementOverrides,
  AfsNoteKey,
} from "../../components/AfsPrintStatementEngine";

type EngagementData = {
  id: string;
  client_name: string;
  entity_type: string | null;
  financial_year_end: string;
  status: string;
};

type ClientSetupData = Record<string, any>;

type AfsFirmSettings = {
  id?: string | null;
  user_id?: string | null;
  firm_name?: string | null;
  trading_name?: string | null;
  logo_url?: string | null;
  address_lines?: string | null;
  telephone?: string | null;
  email?: string | null;
  website?: string | null;
  practitioner_name?: string | null;
  practitioner_designation?: string | null;
  governing_body_name?: string | null;
  governing_body_registration_number?: string | null;
  governing_body_logo_url?: string | null;
  second_governing_body_name?: string | null;
  second_governing_body_registration_number?: string | null;
  second_governing_body_logo_url?: string | null;
  footer_text?: string | null;
  footer_logo_url?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function cleanString(value: unknown) {
  return String(value || "").trim();
}

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
  mapping_category: string | null;
  note_number: string | null;
  mapping_leaf_id?: string | null;
  mapping_label?: string | null;
  mapping_statement?: string | null;
  mapping_section?: string | null;
  mapping_path?: string | null;
  mapping_code?: string | null;
  lead_schedule_number?: string | null;
  lead_schedule_key?: string | null;
};

type PersonData = {
  id?: string;
  name?: string | null;
  full_name?: string | null;
  person_name?: string | null;
  role?: string | null;
  type?: string | null;
  designation?: string | null;
  capacity?: string | null;
  person_type?: string | null;
  nationality?: string | null;
  appointment_date?: string | null;
  resignation_date?: string | null;
};

type StatementBucket = {
  key: string;
  label: string;
  note?: string | number | null;
  current: number;
  prior: number;
};

type NoteAmountLine = {
  id?: string;
  label: string;
  current: number;
  prior: number;
  meta?: Record<string, any>;
};

type ReportOptions = {
  coverPage: boolean;
  generalInformation: boolean;
  index: boolean;
  directorsResponsibilities: boolean;
  directorsReport: boolean;
  compilerReport: boolean;
  sfp: boolean;
  soci: boolean;
  sce: boolean;
  cashFlow: boolean;
  accountingPolicies: boolean;
  notes: boolean;
  detailedIncomeStatement: boolean;
  taxComputation: boolean;

  policyBasisPreparation: boolean;
  policyJudgementsEstimates: boolean;
  policyGoingConcern: boolean;

  policyRevenueGeneral: boolean;
  policyRevenueGoods: boolean;
  policyRevenueServices: boolean;
  policyRevenueConstruction: boolean;
  policyRevenueInterest: boolean;
  policyRevenueRoyalties: boolean;
  policyRevenueDividends: boolean;
  policyRevenueRental: boolean;

  policyPropertyPlantEquipmentRecognition: boolean;
  policyPropertyPlantEquipmentSubsequentExpenditure: boolean;
  policyPropertyPlantEquipmentDepreciation: boolean;
  policyPropertyPlantEquipmentUsefulLives: boolean;
  policyPropertyPlantEquipmentDerecognition: boolean;
  policyPropertyPlantEquipmentCostModel: boolean;
  policyPropertyPlantEquipmentRevaluationModel: boolean;
  policyPropertyPlantEquipmentAssetsUnderConstruction: boolean;

  policyFinancialInstruments: boolean;
  policyFinancialAssetsAmortisedCost: boolean;
  policyFinancialLiabilitiesAmortisedCost: boolean;
  policyTradeReceivables: boolean;
  policyTradePayables: boolean;
  policyShareholderLoans: boolean;
  policyFinancialAssetImpairment: boolean;
  policyFinancialInstrumentsOffsetting: boolean;

  policyInventories: boolean;

  policyInvestmentPropertyRecognition: boolean;
  policyInvestmentPropertyCostModel: boolean;
  policyInvestmentPropertyFairValueModel: boolean;
  policyInvestmentPropertyTransfers: boolean;

  policyIntangibleAssets: boolean;
  policyImpairment: boolean;

  policyLeasesGeneral: boolean;
  policyLeasesLessee: boolean;
  policyLeasesLessor: boolean;
  policyLeasesShortTermLowValue: boolean;

  policyEmployeeBenefits: boolean;
  policyBorrowingCosts: boolean;
  policyTaxation: boolean;

  policyShareCapitalEquity: boolean;
  policyProvisionsContingencies: boolean;
  policyRelatedParties: boolean;
  policyForeignCurrency: boolean;

  notesPropertyPlantEquipment: boolean;
  notesGoodwill: boolean;
  notesInvestmentProperty: boolean;
  notesIntangibleAssets: boolean;
  notesBiologicalAssets: boolean;
  notesOtherNonCurrentAssets: boolean;
  notesLoansReceivable: boolean;
  notesInventories: boolean;
  notesTradeReceivables: boolean;
  notesCurrentTaxReceivable: boolean;
  notesCashAndCashEquivalents: boolean;
  notesShareCapital: boolean;
  notesRetainedIncome: boolean;
  notesShareholdersLoans: boolean;
  notesOtherFinancialLiabilities: boolean;
  notesTradePayables: boolean;
  notesCurrentTaxPayable: boolean;
  notesRevenue: boolean;
  notesOtherIncome: boolean;
  notesOperatingExpenses: boolean;
  notesFinanceCosts: boolean;
  notesTaxation: boolean;
  notesCashUsedInOperations: boolean;

  directorsReportGeneralReview: boolean;
  directorsReportIncorporation: boolean;
  directorsReportNatureBusiness: boolean;
  directorsReportReviewActivities: boolean;
  directorsReportFinancialResults: boolean;
  directorsReportEventsAfter: boolean;
  directorsReportDividends: boolean;
  directorsReportShareCapital: boolean;
  directorsReportDirectors: boolean;
  directorsReportSecretary: boolean;
  directorsReportExternalAccountant: boolean;
  directorsReportInterestContracts: boolean;
  directorsReportBorrowingLimitations: boolean;
  directorsReportShareholder: boolean;
  directorsReportGoingConcern: boolean;
  directorsReportLiquiditySolvency: boolean;
  directorsReportLitigation: boolean;
  directorsReportSocialEthics: boolean;
  directorsReportSubsidiaries: boolean;
  directorsReportAssociates: boolean;
  directorsReportJointVentures: boolean;
  directorsReportNonCurrentAssets: boolean;
  directorsReportAuthorisation: boolean;
  directorsReportOther1: boolean;
  directorsReportOther2: boolean;
  directorsReportOther3: boolean;
  directorsReportOther4: boolean;
  directorsReportOther5: boolean;
  directorsReportOther6: boolean;
  directorsReportOther7: boolean;
  directorsReportOther8: boolean;
  directorsReportOther9: boolean;
  directorsReportOther10: boolean;

  showCoverLogo: boolean;
  showCoverFrameworkStatement: boolean;
  showCoverNoAssuranceStatement: boolean;

  [key: string]: boolean;
};

const defaultReportOptions: ReportOptions = {
  coverPage: true,
  generalInformation: true,
  index: true,
  directorsResponsibilities: true,
  directorsReport: true,
  compilerReport: true,
  sfp: true,
  soci: true,
  sce: true,
  cashFlow: true,
  accountingPolicies: true,
  notes: true,
  detailedIncomeStatement: true,
  taxComputation: true,

  policyBasisPreparation: true,
  policyJudgementsEstimates: true,
  policyGoingConcern: true,

  policyRevenueGeneral: true,
  policyRevenueGoods: false,
  policyRevenueServices: false,
  policyRevenueConstruction: false,
  policyRevenueInterest: false,
  policyRevenueRoyalties: false,
  policyRevenueDividends: false,
  policyRevenueRental: false,

  policyPropertyPlantEquipmentRecognition: false,
  policyPropertyPlantEquipmentSubsequentExpenditure: false,
  policyPropertyPlantEquipmentDepreciation: false,
  policyPropertyPlantEquipmentUsefulLives: false,
  policyPropertyPlantEquipmentDerecognition: false,
  policyPropertyPlantEquipmentCostModel: false,
  policyPropertyPlantEquipmentRevaluationModel: false,
  policyPropertyPlantEquipmentAssetsUnderConstruction: false,

  policyFinancialInstruments: true,
  policyFinancialAssetsAmortisedCost: false,
  policyFinancialLiabilitiesAmortisedCost: false,
  policyTradeReceivables: false,
  policyTradePayables: false,
  policyShareholderLoans: false,
  policyFinancialAssetImpairment: false,
  policyFinancialInstrumentsOffsetting: false,

  policyInventories: true,

  policyInvestmentPropertyRecognition: false,
  policyInvestmentPropertyCostModel: false,
  policyInvestmentPropertyFairValueModel: false,
  policyInvestmentPropertyTransfers: false,

  policyIntangibleAssets: false,
  policyImpairment: true,

  policyLeasesGeneral: false,
  policyLeasesLessee: false,
  policyLeasesLessor: false,
  policyLeasesShortTermLowValue: false,

  policyEmployeeBenefits: false,
  policyBorrowingCosts: false,
  policyTaxation: false,

  policyShareCapitalEquity: true,
  policyProvisionsContingencies: false,
  policyRelatedParties: false,
  policyForeignCurrency: false,

  notesPropertyPlantEquipment: false,
  notesGoodwill: false,
  notesInvestmentProperty: false,
  notesIntangibleAssets: false,
  notesBiologicalAssets: false,
  notesOtherNonCurrentAssets: true,
  notesLoansReceivable: false,
  notesInventories: true,
  notesTradeReceivables: false,
  notesCurrentTaxReceivable: false,
  notesCashAndCashEquivalents: true,
  notesShareCapital: true,
  notesRetainedIncome: false,
  notesShareholdersLoans: true,
  notesOtherFinancialLiabilities: false,
  notesTradePayables: false,
  notesCurrentTaxPayable: false,
  notesRevenue: false,
  notesOtherIncome: false,
  notesOperatingExpenses: true,
  notesFinanceCosts: false,
  notesTaxation: false,
  notesCashUsedInOperations: true,

  directorsReportGeneralReview: true,
  directorsReportIncorporation: true,
  directorsReportNatureBusiness: true,
  directorsReportReviewActivities: true,
  directorsReportFinancialResults: true,
  directorsReportEventsAfter: true,
  directorsReportDividends: true,
  directorsReportShareCapital: true,
  directorsReportDirectors: true,
  directorsReportSecretary: false,
  directorsReportExternalAccountant: true,
  directorsReportInterestContracts: false,
  directorsReportBorrowingLimitations: false,
  directorsReportShareholder: true,
  directorsReportGoingConcern: true,
  directorsReportLiquiditySolvency: true,
  directorsReportLitigation: false,
  directorsReportSocialEthics: false,
  directorsReportSubsidiaries: false,
  directorsReportAssociates: false,
  directorsReportJointVentures: false,
  directorsReportNonCurrentAssets: false,
  directorsReportAuthorisation: true,
  directorsReportOther1: false,
  directorsReportOther2: false,
  directorsReportOther3: false,
  directorsReportOther4: false,
  directorsReportOther5: false,
  directorsReportOther6: false,
  directorsReportOther7: false,
  directorsReportOther8: false,
  directorsReportOther9: false,
  directorsReportOther10: false,

  showCoverLogo: false,
  showCoverFrameworkStatement: true,
  showCoverNoAssuranceStatement: true,
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortYearHeading(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const match = String(value).match(/(20\d{2})/);
  return match?.[1] || value;
}

function rawCurrent(line: TrialBalanceLine) {
  if (
    line.current_year_balance !== null &&
    line.current_year_balance !== undefined
  ) {
    return safeNumber(line.current_year_balance);
  }

  return safeNumber(line.debit) - safeNumber(line.credit);
}

function rawPrior(line: TrialBalanceLine) {
  if (
    line.prior_year_balance !== null &&
    line.prior_year_balance !== undefined
  ) {
    return safeNumber(line.prior_year_balance);
  }

  return 0;
}

function normaliseAmount(line: TrialBalanceLine, amount: number) {
  const text = [
    line.mapping_statement,
    line.mapping_section,
    line.mapping_path,
    line.lead_schedule_key,
    line.mapping_category,
    line.mapping_label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    text.includes("liabil") ||
    text.includes("equity") ||
    text.includes("retained") ||
    text.includes("share-capital") ||
    text.includes("revenue") ||
    text.includes("income")
  ) {
    return -amount;
  }

  return amount;
}

function bucketKey(line: TrialBalanceLine) {
  return (
    line.lead_schedule_key ||
    line.mapping_leaf_id ||
    line.mapping_code ||
    line.mapping_label ||
    line.mapping_category ||
    "unmapped"
  );
}

function bucketLabel(line: TrialBalanceLine) {
  const label =
    line.mapping_label ||
    line.mapping_category ||
    line.lead_schedule_key ||
    line.account_name ||
    "Unmapped";

  return String(label)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function addToBuckets(
  buckets: Map<string, StatementBucket>,
  line: TrialBalanceLine,
) {
  const key = bucketKey(line);
  const current = normaliseAmount(line, rawCurrent(line));
  const prior = normaliseAmount(line, rawPrior(line));

  if (!buckets.has(key)) {
    buckets.set(key, {
      key,
      label: bucketLabel(line),
      note: line.note_number || null,
      current: 0,
      prior: 0,
    });
  }

  const bucket = buckets.get(key);
  if (!bucket) return;

  bucket.current += current;
  bucket.prior += prior;

  if (!bucket.note && line.note_number) {
    bucket.note = line.note_number;
  }
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function lineSearchText(line: TrialBalanceLine) {
  return [
    line.mapping_statement,
    line.mapping_section,
    line.mapping_path,
    line.mapping_category,
    line.mapping_label,
    line.mapping_code,
    line.lead_schedule_key,
    line.account_name,
    line.account_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildBuckets(
  lines: TrialBalanceLine[],
  matcher: (line: TrialBalanceLine) => boolean,
) {
  const buckets = new Map<string, StatementBucket>();

  lines.filter(matcher).forEach((line) => addToBuckets(buckets, line));

  return Array.from(buckets.values())
    .filter(
      (bucket) =>
        Math.round(bucket.current) !== 0 || Math.round(bucket.prior) !== 0,
    )
    .sort((a, b) => a.label.localeCompare(b.label));
}

function bucketRows(buckets: StatementBucket[]): AfsStatementRow[] {
  return buckets.map((bucket) => ({
    id: bucket.key,
    label: bucket.label,
    note: bucket.note,
    current: Math.round(bucket.current),
    prior: Math.round(bucket.prior),
    type: "line",
  }));
}

function sumBuckets(buckets: StatementBucket[]) {
  return buckets.reduce(
    (total, bucket) => ({
      current: total.current + bucket.current,
      prior: total.prior + bucket.prior,
    }),
    { current: 0, prior: 0 },
  );
}


function statementRowHasAmountFields(row: AfsStatementRow) {
  const item = row as any;
  return item?.current !== undefined || item?.prior !== undefined;
}

function statementRowRoundedAmount(row: AfsStatementRow, side: "current" | "prior") {
  const item = row as any;
  return Math.round(safeNumber(item?.[side]));
}

function statementRowHasNonZeroAmount(row: AfsStatementRow) {
  if (!statementRowHasAmountFields(row)) return false;
  return (
    statementRowRoundedAmount(row, "current") !== 0 ||
    statementRowRoundedAmount(row, "prior") !== 0
  );
}

function isDetailedIncomeHeadingRow(row: AfsStatementRow) {
  const item = row as any;
  const type = String(item?.type || "").toLowerCase();

  if (type === "section" || type === "subsection") return true;
  if (statementRowHasAmountFields(row)) return false;

  const label = String(item?.label || "").trim();
  return label.length > 0;
}

function isDetailedIncomeSpacerRow(row: AfsStatementRow) {
  const item = row as any;
  return String(item?.type || "").toLowerCase() === "spacer";
}

function isZeroDetailedIncomeAmountRow(row: AfsStatementRow) {
  if (!statementRowHasAmountFields(row)) return false;
  return !statementRowHasNonZeroAmount(row);
}

function cleanDetailedIncomeRowsForReport(rows: AfsStatementRow[]) {
  const firstPass = (rows || []).filter(
    (row) => !isDetailedIncomeSpacerRow(row) && !isZeroDetailedIncomeAmountRow(row),
  );

  return firstPass.filter((row, index) => {
    if (!isDetailedIncomeHeadingRow(row)) return true;

    for (let nextIndex = index + 1; nextIndex < firstPass.length; nextIndex += 1) {
      const nextRow = firstPass[nextIndex];

      if (isDetailedIncomeHeadingRow(nextRow)) return false;
      if (statementRowHasNonZeroAmount(nextRow)) return true;
    }

    return false;
  });
}


function isShareholderLoanTrialBalanceLine(line: TrialBalanceLine) {
  const text = lineSearchText(line);

  if (
    includesAny(text, [
      "share capital",
      "ordinary share",
      "issued share",
      "retained",
      "accumulated",
      "revenue",
      "sales",
      "expense",
      "asset",
    ])
  ) {
    return false;
  }

  return includesAny(text, [
    "shareholder",
    "shareholder loan",
    "shareholders loan",
    "shareholders' loan",
    "director loan",
    "directors loan",
    "member loan",
    "members loan",
    "loan from shareholder",
    "loan to shareholder",
    "loan from director",
    "loan to director",
    "loan from member",
    "loan to member",
  ]);
}

function readableLoanAccountLabel(line: TrialBalanceLine) {
  const raw =
    line.account_name ||
    line.mapping_label ||
    line.mapping_category ||
    line.lead_schedule_key ||
    "Shareholders' loans";

  return String(raw)
    .replace(/^\s*\d+[\s./-]*/g, "")
    .replace(/\s*[-–—]\s*(shareholder'?s?|director'?s?|member'?s?)\s*loans?$/i, "")
    .replace(/\s*\((shareholder'?s?|director'?s?|member'?s?)\s*loans?\)\s*$/i, "")
    .trim() || String(raw);
}

function buildShareholderLoanSplitRows(
  lines: TrialBalanceLine[],
  fallbackRows: any[],
) {
  const grouped = new Map<string, NoteAmountLine>();

  (lines || [])
    .filter(isShareholderLoanTrialBalanceLine)
    .forEach((line) => {
      const label = readableLoanAccountLabel(line);
      const key =
        line.id ||
        line.account_code ||
        label.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        "shareholder-loan";

      const current = normaliseAmount(line, rawCurrent(line));
      const prior = normaliseAmount(line, rawPrior(line));

      if (!grouped.has(label)) {
        grouped.set(label, {
          id: String(key),
          label,
          current: 0,
          prior: 0,
          meta: {
            source: "trial-balance-split",
            accountCode: line.account_code,
          },
        });
      }

      const row = grouped.get(label);
      if (!row) return;
      row.current += current;
      row.prior += prior;
    });

  const splitRows = Array.from(grouped.values())
    .filter(
      (row) =>
        Math.round(row.current || 0) !== 0 || Math.round(row.prior || 0) !== 0,
    )
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));

  const fallbackVisible = (fallbackRows || []).filter(
    (row) =>
      Math.round(Number(row?.current || 0)) !== 0 ||
      Math.round(Number(row?.prior || 0)) !== 0,
  );

  if (splitRows.length > 1) return splitRows;

  if (
    splitRows.length === 1 &&
    !String(splitRows[0].label || "")
      .toLowerCase()
      .includes("shareholders")
  ) {
    return splitRows;
  }

  return fallbackVisible;
}


function buildSfpRows(lines: TrialBalanceLine[]): AfsStatementRow[] {
  const nonCurrentAssets = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return (
      includesAny(text, ["non-current asset", "non current asset"]) ||
      includesAny(text, [
        "ppe",
        "property",
        "plant",
        "equipment",
        "investment",
        "intangible",
        "goodwill",
        "deferred tax asset",
        "loans receivable",
      ])
    );
  });

  const currentAssets = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return (
      includesAny(text, ["current asset"]) ||
      includesAny(text, [
        "cash",
        "bank",
        "receivable",
        "inventory",
        "inventories",
        "vat receivable",
        "current tax receivable",
        "finished goods",
      ])
    );
  }).filter(
    (bucket) =>
      !nonCurrentAssets.some((existing) => existing.key === bucket.key),
  );

  const equity = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return includesAny(text, [
      "equity",
      "share capital",
      "retained",
      "accumulated",
      "reserves",
      "contribution",
    ]);
  });

  const nonCurrentLiabilities = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return (
      includesAny(text, ["non-current liabil", "non current liabil"]) ||
      includesAny(text, [
        "shareholder",
        "director loan",
        "member loan",
        "long-term loan",
        "deferred tax liability",
        "borrowings",
        "lease liabilities",
      ])
    );
  });

  const currentLiabilities = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return (
      includesAny(text, ["current liabil"]) ||
      includesAny(text, [
        "payable",
        "creditor",
        "vat payable",
        "current tax payable",
        "paye",
        "sars",
        "bank overdraft",
      ])
    );
  }).filter(
    (bucket) =>
      !nonCurrentLiabilities.some((existing) => existing.key === bucket.key),
  );

  const ncaTotal = sumBuckets(nonCurrentAssets);
  const caTotal = sumBuckets(currentAssets);
  const assetsTotal = {
    current: ncaTotal.current + caTotal.current,
    prior: ncaTotal.prior + caTotal.prior,
  };

  const equityTotal = sumBuckets(equity);
  const nclTotal = sumBuckets(nonCurrentLiabilities);
  const clTotal = sumBuckets(currentLiabilities);
  const liabilitiesTotal = {
    current: nclTotal.current + clTotal.current,
    prior: nclTotal.prior + clTotal.prior,
  };

  const equityLiabilitiesTotal = {
    current: equityTotal.current + liabilitiesTotal.current,
    prior: equityTotal.prior + liabilitiesTotal.prior,
  };

  return [
    { id: "assets", label: "Assets", type: "section" },
    { id: "nca", label: "Non-current assets", type: "subsection" },
    ...bucketRows(nonCurrentAssets),
    {
      id: "nca-total",
      label: "Total non-current assets",
      current: Math.round(ncaTotal.current),
      prior: Math.round(ncaTotal.prior),
      type: "subtotal",
    },
    { id: "space-1", type: "spacer" },
    { id: "ca", label: "Current assets", type: "subsection" },
    ...bucketRows(currentAssets),
    {
      id: "ca-total",
      label: "Total current assets",
      current: Math.round(caTotal.current),
      prior: Math.round(caTotal.prior),
      type: "subtotal",
    },
    {
      id: "assets-total",
      label: "Total assets",
      current: Math.round(assetsTotal.current),
      prior: Math.round(assetsTotal.prior),
      type: "grand-total",
    },
    { id: "space-2", type: "spacer" },
    {
      id: "equity-liabilities",
      label: "Equity and liabilities",
      type: "section",
    },
    { id: "equity", label: "Equity", type: "subsection" },
    ...bucketRows(equity),
    {
      id: "equity-total",
      label: "Total equity",
      current: Math.round(equityTotal.current),
      prior: Math.round(equityTotal.prior),
      type: "subtotal",
    },
    { id: "space-3", type: "spacer" },
    { id: "liabilities", label: "Liabilities", type: "section" },
    { id: "ncl", label: "Non-current liabilities", type: "subsection" },
    ...bucketRows(nonCurrentLiabilities),
    {
      id: "ncl-total",
      label: "Total non-current liabilities",
      current: Math.round(nclTotal.current),
      prior: Math.round(nclTotal.prior),
      type: "subtotal",
    },
    { id: "cl", label: "Current liabilities", type: "subsection" },
    ...bucketRows(currentLiabilities),
    {
      id: "cl-total",
      label: "Total current liabilities",
      current: Math.round(clTotal.current),
      prior: Math.round(clTotal.prior),
      type: "subtotal",
    },
    {
      id: "liabilities-total",
      label: "Total liabilities",
      current: Math.round(liabilitiesTotal.current),
      prior: Math.round(liabilitiesTotal.prior),
      type: "total",
    },
    {
      id: "eql-total",
      label: "Total equity and liabilities",
      current: Math.round(equityLiabilitiesTotal.current),
      prior: Math.round(equityLiabilitiesTotal.prior),
      type: "grand-total",
    },
  ];
}

function buildSociRows(lines: TrialBalanceLine[]): AfsStatementRow[] {
  const revenue = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return includesAny(text, ["revenue", "sales", "turnover"]);
  });

  const costOfSales = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return includesAny(text, ["cost of sales", "cost-of-sales"]);
  });

  const otherIncome = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return includesAny(text, [
      "other income",
      "operating income",
      "investment income",
    ]);
  }).filter(
    (bucket) => !revenue.some((existing) => existing.key === bucket.key),
  );

  const operatingExpenses = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return includesAny(text, [
      "operating expense",
      "operating expenses",
      "expense",
    ]);
  }).filter(
    (bucket) =>
      !costOfSales.some((existing) => existing.key === bucket.key) &&
      !otherIncome.some((existing) => existing.key === bucket.key),
  );

  const financeCosts = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return includesAny(text, [
      "finance cost",
      "interest paid",
      "interest expense",
    ]);
  });

  const taxation = buildBuckets(lines, (line) => {
    const text = lineSearchText(line);
    return includesAny(text, ["tax expense", "taxation", "income tax"]);
  });

  const revenueTotal = sumBuckets(revenue);
  const cosTotal = sumBuckets(costOfSales);
  const gross = {
    current: revenueTotal.current + cosTotal.current,
    prior: revenueTotal.prior + cosTotal.prior,
  };

  const otherIncomeTotal = sumBuckets(otherIncome);
  const opexTotal = sumBuckets(operatingExpenses);
  const operatingProfit = {
    current: gross.current + otherIncomeTotal.current + opexTotal.current,
    prior: gross.prior + otherIncomeTotal.prior + opexTotal.prior,
  };

  const financeCostsTotal = sumBuckets(financeCosts);
  const beforeTax = {
    current: operatingProfit.current + financeCostsTotal.current,
    prior: operatingProfit.prior + financeCostsTotal.prior,
  };

  const taxationTotal = sumBuckets(taxation);
  const profitForYear = {
    current: beforeTax.current + taxationTotal.current,
    prior: beforeTax.prior + taxationTotal.prior,
  };

  return [
    ...bucketRows(revenue),
    ...bucketRows(costOfSales),
    {
      id: "gross",
      label: "Gross profit / (loss)",
      current: Math.round(gross.current),
      prior: Math.round(gross.prior),
      type: "subtotal",
    },
    ...bucketRows(otherIncome),
    ...bucketRows(operatingExpenses),
    {
      id: "operating-profit",
      label: "Operating profit / (loss)",
      current: Math.round(operatingProfit.current),
      prior: Math.round(operatingProfit.prior),
      type: "subtotal",
    },
    ...bucketRows(financeCosts),
    {
      id: "before-tax",
      label: "Profit / (loss) before taxation",
      current: Math.round(beforeTax.current),
      prior: Math.round(beforeTax.prior),
      type: "subtotal",
    },
    ...bucketRows(taxation),
    {
      id: "profit-year",
      label: "Profit / (loss) for the year",
      current: Math.round(profitForYear.current),
      prior: Math.round(profitForYear.prior),
      type: "grand-total",
    },
  ];
}

function getSetupValue(setup: ClientSetupData | null, keys: string[]) {
  if (!setup) return "";

  for (const key of keys) {
    const value = setup[key];

    if (Array.isArray(value) && value.length > 0) return value;

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function formatMultiline(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\n|\r\n|,\s(?=\d|\w)/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPersonName(person: PersonData) {
  return (
    person.full_name || person.person_name || person.name || "Name not captured"
  );
}

function isDirectorLike(person: PersonData) {
  const role = String(
    person.role ||
      person.type ||
      person.designation ||
      person.capacity ||
      person.person_type ||
      "",
  ).toLowerCase();

  return (
    role.includes("director") ||
    role.includes("member") ||
    role.includes("trustee") ||
    role.includes("owner")
  );
}

function roleLabel(entityType: string) {
  const lower = entityType.toLowerCase();
  if (lower.includes("trust")) return "Trustees";
  if (lower.includes("close corporation") || lower.includes("cc")) {
    return "Members";
  }
  return "Directors";
}

function responsibilityTitle(entityType: string) {
  const lower = entityType.toLowerCase();
  if (lower.includes("trust")) return "Trustees’ Responsibilities and Approval";
  if (lower.includes("close corporation") || lower.includes("cc")) {
    return "Members’ Responsibilities and Approval";
  }
  return "Directors’ Responsibilities and Approval";
}

function reportTitle(entityType: string) {
  const lower = entityType.toLowerCase();
  if (lower.includes("trust")) return "Trustees’ Report";
  if (lower.includes("close corporation") || lower.includes("cc")) {
    return "Members’ Report";
  }
  return "Directors’ Report";
}

function governingBody(entityType: string) {
  const lower = entityType.toLowerCase();
  if (lower.includes("trust")) return "trustees";
  if (lower.includes("close corporation") || lower.includes("cc")) {
    return "members";
  }
  return "directors";
}

function renderInfoRow(label: string, value: unknown) {
  const lines = formatMultiline(value);
  if (!lines.length) return null;

  return (
    <tr key={label}>
      <td
        style={{
          width: "36%",
          padding: "6px 0 7px",
          fontWeight: 800,
          verticalAlign: "top",
          lineHeight: 1.35,
        }}
      >
        {label}
      </td>
      <td style={{ padding: "6px 0 7px", verticalAlign: "top", lineHeight: 1.35 }}>
        {lines.map((line, index) => (
          <div key={`${label}-${index}`}>{line}</div>
        ))}
      </td>
    </tr>
  );
}

function paragraphStyle() {
  return {
    margin: "0 0 10px",
    fontSize: 11,
    lineHeight: 1.45,
  };
}

function sectionHeadingStyle() {
  return {
    fontSize: 12,
    lineHeight: 1.3,
    fontWeight: 800,
    margin: "16px 0 6px",
  };
}

function subsectionHeadingStyle() {
  return {
    fontSize: 11,
    lineHeight: 1.3,
    fontWeight: 800,
    margin: "10px 0 4px",
  };
}

function pageHeadingStyle() {
  return {
    fontSize: 15.4,
    fontWeight: 800,
    margin: "0 0 16px",
    paddingBottom: 7,
    borderBottom: "1.25px solid #111827",
    textTransform: "none" as const,
  };
}

function isGenericNoteText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .includes("this note is generated from the mapped trial balance");
}

function cleanNoteTextMap(
  input: EditableDisclosureTextMap,
): EditableDisclosureTextMap {
  const next: EditableDisclosureTextMap = {};

  Object.entries(input || {}).forEach(([key, value]) => {
    next[key] = {
      title: value?.title || "",
      text: isGenericNoteText(value?.text) ? "" : value?.text || "",
    };
  });

  return next;
}

function taxAmount(value: number) {
  const rounded = Math.round(Number(value || 0));
  const formatted = Math.abs(rounded).toLocaleString("en-ZA");

  if (rounded === 0) return "–";
  return rounded < 0 ? `(${formatted})` : formatted;
}

export default function AfsPrintStudioExportPage() {
 const params = useParams();
const searchParams = useSearchParams();
const engagementId = String(params?.engagementId || "");
const isDraftPdf =
  searchParams.get("draft") === "1" || searchParams.get("draft") === "true";

  const [loading, setLoading] = useState(true);
  const [isPrintExportMode, setIsPrintExportMode] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState("cover-page");
  const [cashFlowViewMode, setCashFlowViewMode] = useState<"afs" | "work">(
    "afs",
  );

  useEffect(() => {
    const onExportMode = (event: Event) => {
      setIsPrintExportMode(Boolean((event as CustomEvent<boolean>).detail));
    };
    const onBeforePrint = () => setIsPrintExportMode(true);
    const onAfterPrint = () => setIsPrintExportMode(false);

    window.addEventListener("afs-print-export-mode", onExportMode);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      window.removeEventListener("afs-print-export-mode", onExportMode);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [clientSetup, setClientSetup] = useState<ClientSetupData | null>(null);
  const [firmSettings, setFirmSettings] = useState<AfsFirmSettings | null>(null);
  const [trialBalanceLines, setTrialBalanceLines] = useState<
    TrialBalanceLine[]
  >([]);
  const [clientPeople, setClientPeople] = useState<PersonData[]>([]);
  const [reportOptions, setReportOptions] =
    useState<ReportOptions>(defaultReportOptions);
  const [directorsReportTexts, setDirectorsReportTexts] =
    useState<DirectorsReportTextOverrides | null>(null);
  const [accountingPolicyTexts, setAccountingPolicyTexts] =
    useState<EditableDisclosureTextMap | null>(null);
  const [noteTexts, setNoteTexts] = useState<EditableDisclosureTextMap | null>(
    null,
  );
  const [statementOverrides, setStatementOverrides] =
    useState<AfsStatementOverrides>({});
  const [printStudioSettingsLoaded, setPrintStudioSettingsLoaded] =
    useState(false);
  const [printStudioSaveStatus, setPrintStudioSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  async function loadPrintStudioData() {
    if (!engagementId) return;

    setLoading(true);
    setPrintStudioSettingsLoaded(false);

    try {
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData.user;

        if (authUser?.id) {
          const { data: firmData, error: firmError } = await supabase
            .from("afs_firm_settings")
            .select("*")
            .eq("user_id", authUser.id)
            .maybeSingle();

          if (!firmError && firmData) {
            setFirmSettings(firmData);
          }
        }
      }

      const engagementRes = await fetch(
        `/api/afs/engagements/${engagementId}`,
        {
          cache: "no-store",
        },
      );

      const engagementData = await engagementRes.json();

      if (engagementRes.ok) {
        setEngagement(engagementData.engagement || null);
        setTrialBalanceLines(
          engagementData.trialBalanceLines ||
            engagementData.trial_balance_lines ||
            engagementData.lines ||
            [],
        );
      }

      const setupRes = await fetch(
        `/api/afs/engagements/${engagementId}/client-setup`,
        { cache: "no-store" },
      );

      const setupData = await setupRes.json();

      if (setupRes.ok) {
        setClientSetup(setupData.setup || setupData.clientSetup || null);

        if (setupData.engagement) {
          setEngagement(setupData.engagement);
        }

        setClientPeople(
          setupData.people ||
            setupData.clientPeople ||
            setupData.client_people ||
            setupData.directors ||
            setupData.members ||
            setupData.trustees ||
            [],
        );
      }

      const settingsRes = await fetch(
        `/api/afs/engagements/${engagementId}/print-studio-settings`,
        { cache: "no-store" },
      );

      const settingsData = await settingsRes.json();

      if (settingsRes.ok && settingsData.success) {
        const savedReportOptions = settingsData.reportOptions || {};
        const savedDirectorsReportTexts =
          settingsData.directorsReportTexts || {};
        const savedAccountingPolicyTexts =
          settingsData.accountingPolicyTexts || {};
        const savedNoteTexts = settingsData.noteTexts || {};
        const savedStatementOverrides = settingsData.statementOverrides || {};

        if (
          savedReportOptions &&
          typeof savedReportOptions === "object" &&
          Object.keys(savedReportOptions).length > 0
        ) {
          setReportOptions((current) => ({
            ...current,
            ...savedReportOptions,
          }));
        } else {
          const localOptionsKey = `practicepilot-afs-print-studio:${engagementId}:report-options`;
          const localOptions = window.localStorage.getItem(localOptionsKey);

          if (localOptions) {
            try {
              setReportOptions((current) => ({
                ...current,
                ...JSON.parse(localOptions),
              }));
            } catch {
              window.localStorage.removeItem(localOptionsKey);
            }
          }
        }

        if (
          savedDirectorsReportTexts &&
          typeof savedDirectorsReportTexts === "object" &&
          Object.keys(savedDirectorsReportTexts).length > 0
        ) {
          setDirectorsReportTexts(savedDirectorsReportTexts);
        } else {
          const localTextsKey = `practicepilot-afs-print-studio:${engagementId}:directors-report-texts`;
          const localTexts = window.localStorage.getItem(localTextsKey);

          if (localTexts) {
            try {
              setDirectorsReportTexts(JSON.parse(localTexts));
            } catch {
              window.localStorage.removeItem(localTextsKey);
            }
          }
        }

        if (
          savedAccountingPolicyTexts &&
          typeof savedAccountingPolicyTexts === "object" &&
          Object.keys(savedAccountingPolicyTexts).length > 0
        ) {
          setAccountingPolicyTexts(savedAccountingPolicyTexts);
        }

        if (
          savedNoteTexts &&
          typeof savedNoteTexts === "object" &&
          Object.keys(savedNoteTexts).length > 0
        ) {
          const cleanedSavedNoteTexts = cleanNoteTextMap(savedNoteTexts);
          setNoteTexts(cleanedSavedNoteTexts);

          if (
            JSON.stringify(cleanedSavedNoteTexts) !==
            JSON.stringify(savedNoteTexts)
          ) {
            savePrintStudioSettingsToSupabase({
              noteTexts: cleanedSavedNoteTexts,
            });
          }
        }

        if (
          savedStatementOverrides &&
          typeof savedStatementOverrides === "object" &&
          Object.keys(savedStatementOverrides).length > 0
        ) {
          setStatementOverrides(savedStatementOverrides);
        }
      }
    } catch (error) {
      console.error("Failed to load Print Studio data", error);
    } finally {
      setPrintStudioSettingsLoaded(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrintStudioData();
  }, [engagementId]);

  async function savePrintStudioSettingsToSupabase(payload: {
    reportOptions?: ReportOptions;
    directorsReportTexts?: DirectorsReportTextOverrides;
    accountingPolicyTexts?: EditableDisclosureTextMap;
    noteTexts?: EditableDisclosureTextMap;
    statementOverrides?: AfsStatementOverrides;
  }) {
    if (!engagementId || !printStudioSettingsLoaded) return;

    setPrintStudioSaveStatus("saving");

    try {
      const response = await fetch(
        `/api/afs/engagements/${engagementId}/print-studio-settings`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to save Print Studio settings.",
        );
      }

      setPrintStudioSaveStatus("saved");

      window.setTimeout(() => {
        setPrintStudioSaveStatus((current) =>
          current === "saved" ? "idle" : current,
        );
      }, 1600);
    } catch (error) {
      console.error("Failed to save Print Studio settings", error);
      setPrintStudioSaveStatus("error");
    }
  }

  function saveReportOptionsEverywhere(next: ReportOptions) {
    if (!engagementId) return;

    const localKey = `practicepilot-afs-print-studio:${engagementId}:report-options`;
    window.localStorage.setItem(localKey, JSON.stringify(next));

    savePrintStudioSettingsToSupabase({
      reportOptions: next,
    });
  }

  function saveDirectorsReportTextsEverywhere(
    next: DirectorsReportTextOverrides,
  ) {
    if (!engagementId) return;

    const localKey = `practicepilot-afs-print-studio:${engagementId}:directors-report-texts`;
    window.localStorage.setItem(localKey, JSON.stringify(next));

    savePrintStudioSettingsToSupabase({
      directorsReportTexts: next,
    });
  }

  function saveAccountingPolicyTextsEverywhere(
    next: EditableDisclosureTextMap,
  ) {
    if (!engagementId) return;

    const localKey = `practicepilot-afs-print-studio:${engagementId}:accounting-policy-texts`;
    window.localStorage.setItem(localKey, JSON.stringify(next));

    savePrintStudioSettingsToSupabase({
      accountingPolicyTexts: next,
    });
  }

  function saveNoteTextsEverywhere(next: EditableDisclosureTextMap) {
    if (!engagementId) return;

    const cleanedNext = cleanNoteTextMap(next);
    const localKey = `practicepilot-afs-print-studio:${engagementId}:note-texts`;
    window.localStorage.setItem(localKey, JSON.stringify(cleanedNext));

    savePrintStudioSettingsToSupabase({
      noteTexts: cleanedNext,
    });
  }

  function saveStatementOverridesEverywhere(next: AfsStatementOverrides) {
    if (!engagementId) return;

    const localKey = `practicepilot-afs-print-studio:${engagementId}:statement-overrides`;
    window.localStorage.setItem(localKey, JSON.stringify(next));

    savePrintStudioSettingsToSupabase({
      statementOverrides: next,
    });
  }

  function updateStatementOverride(
    key: keyof AfsStatementOverrides,
    value: number | null,
  ) {
    setStatementOverrides((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      saveStatementOverridesEverywhere(next);
      return next;
    });
  }

  function goToSection(sectionId: string) {
    setActiveSectionId(sectionId);

    requestAnimationFrame(() => {
      const element = document.getElementById(`print-${sectionId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function toggleReportOption(
    key: keyof ReportOptions | string,
    checked: boolean,
  ) {
    setReportOptions((current) => {
      const next = {
        ...current,
        [key]: checked,
      } as ReportOptions;

      saveReportOptionsEverywhere(next);

      return next;
    });
  }

  function option(
    key: keyof ReportOptions,
    label: string,
    description?: string,
  ): AfsReportOption {
    return {
      id: String(key),
      label,
      description,
      checked: reportOptions[key],
      onChange: (checked) => toggleReportOption(key, checked),
    };
  }

  const reportSectionOptions: AfsReportOption[] = [
    option("coverPage", "Cover page", "Show the AFS cover page."),
    option("index", "Index", "Show the report index."),
    option(
      "generalInformation",
      "General information",
      "Show entity and engagement details.",
    ),
    option(
      "directorsResponsibilities",
      "Directors’ responsibilities",
      "Show the approval and responsibility statement.",
    ),
    option(
      "directorsReport",
      "Directors’ report",
      "Show the directors’ report.",
    ),
    option("compilerReport", "Compiler report", "Show the compilation report."),
    option("sfp", "Statement of financial position", "Show SFP."),
    option(
      "soci",
      "Statement of comprehensive income",
      "Show comprehensive income.",
    ),
    option(
      "sce",
      "Statement of changes in equity",
      "Show statement of changes in equity.",
    ),
    option("cashFlow", "Cash flow", "Show cash flow statement."),
    option(
      "accountingPolicies",
      "Accounting policies",
      "Show accounting policies.",
    ),
    option("notes", "Notes", "Show notes to the financial statements."),
    option(
      "detailedIncomeStatement",
      "Detailed income statement",
      "Show detailed income statement.",
    ),
    option("taxComputation", "Tax computation", "Show tax computation."),
  ];

  const clientName = String(
    getSetupValue(clientSetup, [
      "registered_name",
      "client_name",
      "company_name",
      "trust_name",
      "entity_name",
    ]) ||
      engagement?.client_name ||
      "Annual Financial Statements",
  );

  const entityType = String(
    getSetupValue(clientSetup, ["entity_type", "legal_entity_type"]) ||
      engagement?.entity_type ||
      "Company",
  );

  const yearEnd = String(
    getSetupValue(clientSetup, [
      "financial_year_end",
      "year_end",
      "reporting_date",
      "period_end",
    ]) ||
      engagement?.financial_year_end ||
      "Year-end not set",
  );

  const registrationNumber =
    String(
      getSetupValue(clientSetup, [
        "registration_number",
        "company_registration_number",
        "trust_registration_number",
        "master_reference_number",
        "registration_no",
      ]) || "",
    ) || null;

  const country = getSetupValue(clientSetup, [
    "country",
    "country_of_incorporation",
    "country_of_incorporation_and_domicile",
    "domicile",
  ]);

  const currentHeading = shortYearHeading(
    String(
      getSetupValue(clientSetup, [
        "current_period_heading",
        "current_year_heading",
      ]) || yearEnd,
    ),
    "Current",
  );

  const priorHeading = shortYearHeading(
    String(
      getSetupValue(clientSetup, [
        "prior_period_heading",
        "prior_year_heading",
      ]),
    ),
    "Prior",
  );

  const peopleFromSetup = [
    ...formatMultiline(
      getSetupValue(clientSetup, ["directors", "members", "trustees"]),
    ),
  ].map((name) => ({ name }));

  const directors = clientPeople.filter(isDirectorLike);
  const directorsForDisplay =
    directors.length > 0
      ? directors
      : clientPeople.length > 0
        ? clientPeople
        : peopleFromSetup;

  const bodyLabel = governingBody(entityType);
  const bodyLabelCapitalised =
    bodyLabel.charAt(0).toUpperCase() + bodyLabel.slice(1);

  const firmSetting = (key: keyof AfsFirmSettings) =>
    cleanString(firmSettings?.[key]);

  const practitionerFirm =
    firmSetting("firm_name") ||
    firmSetting("trading_name") ||
    getSetupValue(clientSetup, [
      "practitioner_firm_name",
      "firm_name",
      "accounting_firm",
      "compiler_firm",
      "preparer_firm",
    ]) ||
    "Bizzacc Menlyn (Pty) Ltd";

  const practitionerName =
    firmSetting("practitioner_name") ||
    getSetupValue(clientSetup, [
      "practitioner_name",
      "compiler_name",
      "preparer",
      "prepared_by",
      "accountant_name",
    ]) ||
    "Sarel FS van Aswegen";

  const practitionerDesignation =
    firmSetting("practitioner_designation") ||
    getSetupValue(clientSetup, [
      "practitioner_designation",
      "compiler_designation",
      "professional_designation",
      "designation",
    ]) ||
    "Professional Accountant (SA)";

  const practitionerLogoUrl =
    firmSetting("logo_url") ||
    cleanString(
      getSetupValue(clientSetup, [
        "practitioner_logo_url",
        "compiler_logo_url",
        "firm_logo_url",
        "letterhead_logo_url",
        "logo_url",
      ]),
    );

  const practitionerFooterLogoUrl =
    firmSetting("footer_logo_url") ||
    firmSetting("governing_body_logo_url") ||
    cleanString(
      getSetupValue(clientSetup, [
        "practitioner_footer_logo_url",
        "compiler_footer_logo_url",
        "firm_footer_logo_url",
        "letterhead_footer_logo_url",
        "footer_logo_url",
      ]),
    );

  const framework =
    getSetupValue(clientSetup, [
      "financial_reporting_framework",
      "reporting_framework",
      "accounting_framework",
      "framework",
    ]) || "the applicable financial reporting framework";

  const approvalDate =
    getSetupValue(clientSetup, [
      "approval_date",
      "directors_approval_date",
      "signed_date",
      "sign_off_date",
    ]) || "________________";

  const compilationDate =
    getSetupValue(clientSetup, [
      "compilation_report_date",
      "compiler_report_date",
      "report_date",
    ]) || "________________";

  const currency =
    getSetupValue(clientSetup, ["currency", "presentation_currency"]) || "Rand";

  const baseNarrativeContext = {
    clientName,
    entityType,
    yearEnd,
    registrationNumber,
    bodyLabel,
    bodyLabelCapitalised,
    roleLabel: roleLabel(entityType),
    framework: String(framework),
    approvalDate: String(approvalDate),
    compilationDate: String(compilationDate),
    practitionerFirm: String(practitionerFirm),
    practitionerName: String(practitionerName),
    practitionerDesignation: String(practitionerDesignation),
    practitionerLogoUrl,
    practitionerFooterLogoUrl,
    practitionerAddressLines: firmSetting("address_lines"),
    practitionerTelephone: firmSetting("telephone"),
    practitionerEmail: firmSetting("email"),
    practitionerWebsite: firmSetting("website"),
    governingBodyName: firmSetting("governing_body_name"),
    governingBodyRegistrationNumber: firmSetting(
      "governing_body_registration_number",
    ),
    governingBodyLogoUrl: firmSetting("governing_body_logo_url"),
    secondGoverningBodyName: firmSetting("second_governing_body_name"),
    secondGoverningBodyRegistrationNumber: firmSetting(
      "second_governing_body_registration_number",
    ),
    secondGoverningBodyLogoUrl: firmSetting("second_governing_body_logo_url"),
    firmFooterText: firmSetting("footer_text"),
    practitionerFooterText: firmSetting("footer_text"),
    footerText: firmSetting("footer_text"),
    firmLogoUrl: practitionerLogoUrl,
    logoUrl: practitionerLogoUrl,
    letterheadLogoUrl: practitionerLogoUrl,
    firmFooterLogoUrl: practitionerFooterLogoUrl,
    footerLogoUrl: practitionerFooterLogoUrl,
    natureOfBusiness: String(
      getSetupValue(clientSetup, [
        "nature_of_business",
        "principal_activities",
        "business_activity",
        "business_description",
      ]) || "",
    ),
    country: String(country || "South Africa"),
    directors: directorsForDisplay,
  };

  const defaultDirectorsReportTexts = useMemo(
    () => buildDefaultDirectorsReportTexts(baseNarrativeContext),
    [
      clientName,
      entityType,
      yearEnd,
      registrationNumber,
      bodyLabel,
      bodyLabelCapitalised,
      framework,
      approvalDate,
      compilationDate,
      practitionerFirm,
      practitionerName,
      practitionerDesignation,
      practitionerLogoUrl,
      practitionerFooterLogoUrl,
      firmSettings,
      country,
      directorsForDisplay.length,
    ],
  );

  const activeDirectorsReportTexts =
    directorsReportTexts || defaultDirectorsReportTexts;

  const defaultAccountingPolicyTexts = useMemo(
    () => buildDefaultAccountingPolicyTexts(),
    [],
  );

  const activeAccountingPolicyTexts =
    accountingPolicyTexts || defaultAccountingPolicyTexts;

  const defaultNoteTexts = useMemo(() => buildDefaultNoteTexts(), []);
  const activeNoteTexts = noteTexts || defaultNoteTexts;

  const disclosureTokens = {
    clientName,
    yearEnd,
    framework: String(framework),
    currency: String(currency),
    currentYear: currentHeading,
    priorYear: priorHeading,
  };

  function saveDirectorsReportTexts(next: DirectorsReportTextOverrides) {
    saveDirectorsReportTextsEverywhere(next);
  }

  function updateDirectorsReportTitle(
    key: DirectorsReportSectionKey,
    value: string,
  ) {
    setDirectorsReportTexts((current) => {
      const base =
        current || activeDirectorsReportTexts || defaultDirectorsReportTexts;

      const next = {
        ...base,
        [key]: {
          ...(base[key] || defaultDirectorsReportTexts[key]),
          title: value,
        },
      };

      saveDirectorsReportTexts(next);
      return next;
    });
  }

  function updateDirectorsReportText(
    key: DirectorsReportSectionKey,
    value: string,
  ) {
    setDirectorsReportTexts((current) => {
      const base =
        current || activeDirectorsReportTexts || defaultDirectorsReportTexts;

      const next = {
        ...base,
        [key]: {
          ...(base[key] || defaultDirectorsReportTexts[key]),
          text: value,
        },
      };

      saveDirectorsReportTexts(next);
      return next;
    });
  }

  function resetDirectorsReportSection(key: DirectorsReportSectionKey) {
    setDirectorsReportTexts((current) => {
      const base =
        current || activeDirectorsReportTexts || defaultDirectorsReportTexts;

      const next = {
        ...base,
        [key]: defaultDirectorsReportTexts[key],
      };

      saveDirectorsReportTexts(next);
      return next;
    });
  }

  function resetAllDirectorsReportSections() {
    saveDirectorsReportTexts(defaultDirectorsReportTexts);
    setDirectorsReportTexts(defaultDirectorsReportTexts);
  }

  function updateAccountingPolicyTitle(key: string, value: string) {
    setAccountingPolicyTexts((current) => {
      const base = current || activeAccountingPolicyTexts;
      const next = {
        ...base,
        [key]: {
          ...(base[key] ||
            defaultAccountingPolicyTexts[key] || {
              title: key,
              text: "",
            }),
          title: value,
        },
      };

      saveAccountingPolicyTextsEverywhere(next);
      return next;
    });
  }

  function updateAccountingPolicyText(key: string, value: string) {
    setAccountingPolicyTexts((current) => {
      const base = current || activeAccountingPolicyTexts;
      const next = {
        ...base,
        [key]: {
          ...(base[key] ||
            defaultAccountingPolicyTexts[key] || {
              title: key,
              text: "",
            }),
          text: value,
        },
      };

      saveAccountingPolicyTextsEverywhere(next);
      return next;
    });
  }

  function resetAccountingPolicySection(key: string) {
    setAccountingPolicyTexts((current) => {
      const base = current || activeAccountingPolicyTexts;
      const next = {
        ...base,
        [key]: defaultAccountingPolicyTexts[key],
      };

      saveAccountingPolicyTextsEverywhere(next);
      return next;
    });
  }

  function resetAllAccountingPolicySections() {
    saveAccountingPolicyTextsEverywhere(defaultAccountingPolicyTexts);
    setAccountingPolicyTexts(defaultAccountingPolicyTexts);
  }

  function updateNoteTitle(key: string, value: string) {
    setNoteTexts((current) => {
      const base = current || activeNoteTexts;
      const next = {
        ...base,
        [key]: {
          ...(base[key] ||
            defaultNoteTexts[key] || {
              title: key,
              text: "",
            }),
          title: value,
        },
      };

      saveNoteTextsEverywhere(next);
      return next;
    });
  }

  function updateNoteText(key: string, value: string) {
    setNoteTexts((current) => {
      const base = current || activeNoteTexts;
      const next = {
        ...base,
        [key]: {
          ...(base[key] ||
            defaultNoteTexts[key] || {
              title: key,
              text: "",
            }),
          text: value,
        },
      };

      saveNoteTextsEverywhere(next);
      return next;
    });
  }

  function resetNoteSection(key: string) {
    setNoteTexts((current) => {
      const base = current || activeNoteTexts;
      const next = {
        ...base,
        [key]: defaultNoteTexts[key],
      };

      saveNoteTextsEverywhere(next);
      return next;
    });
  }

  function resetAllNoteSections() {
    saveNoteTextsEverywhere(defaultNoteTexts);
    setNoteTexts(defaultNoteTexts);
  }

  const narrativeContext = {
    ...baseNarrativeContext,

    directorsReportGeneralReview: reportOptions.directorsReportGeneralReview,
    directorsReportIncorporation: reportOptions.directorsReportIncorporation,
    directorsReportNatureBusiness: reportOptions.directorsReportNatureBusiness,
    directorsReportReviewActivities:
      reportOptions.directorsReportReviewActivities,
    directorsReportFinancialResults:
      reportOptions.directorsReportFinancialResults,
    directorsReportEventsAfter: reportOptions.directorsReportEventsAfter,
    directorsReportDividends: reportOptions.directorsReportDividends,
    directorsReportShareCapital: reportOptions.directorsReportShareCapital,
    directorsReportDirectors: reportOptions.directorsReportDirectors,
    directorsReportSecretary: reportOptions.directorsReportSecretary,
    directorsReportExternalAccountant:
      reportOptions.directorsReportExternalAccountant,
    directorsReportInterestContracts:
      reportOptions.directorsReportInterestContracts,
    directorsReportBorrowingLimitations:
      reportOptions.directorsReportBorrowingLimitations,
    directorsReportShareholder: reportOptions.directorsReportShareholder,
    directorsReportGoingConcern: reportOptions.directorsReportGoingConcern,
    directorsReportLiquiditySolvency:
      reportOptions.directorsReportLiquiditySolvency,
    directorsReportLitigation: reportOptions.directorsReportLitigation,
    directorsReportSocialEthics: reportOptions.directorsReportSocialEthics,
    directorsReportSubsidiaries: reportOptions.directorsReportSubsidiaries,
    directorsReportAssociates: reportOptions.directorsReportAssociates,
    directorsReportJointVentures: reportOptions.directorsReportJointVentures,
    directorsReportNonCurrentAssets:
      reportOptions.directorsReportNonCurrentAssets,
    directorsReportAuthorisation: reportOptions.directorsReportAuthorisation,
    directorsReportOther1: reportOptions.directorsReportOther1,
    directorsReportOther2: reportOptions.directorsReportOther2,
    directorsReportOther3: reportOptions.directorsReportOther3,
    directorsReportOther4: reportOptions.directorsReportOther4,
    directorsReportOther5: reportOptions.directorsReportOther5,
    directorsReportOther6: reportOptions.directorsReportOther6,
    directorsReportOther7: reportOptions.directorsReportOther7,
    directorsReportOther8: reportOptions.directorsReportOther8,
    directorsReportOther9: reportOptions.directorsReportOther9,
    directorsReportOther10: reportOptions.directorsReportOther10,

    directorsReportTexts: activeDirectorsReportTexts,
  };

  const directorsReportFirstPageOptionKeys = [
    "directorsReportGeneralReview",
    "directorsReportIncorporation",
    "directorsReportNatureBusiness",
    "directorsReportReviewActivities",
    "directorsReportFinancialResults",
    "directorsReportEventsAfter",
    "directorsReportDividends",
    "directorsReportShareCapital",
    "directorsReportDirectors",
    "directorsReportSecretary",
    "directorsReportExternalAccountant",
    "directorsReportInterestContracts",
    "directorsReportBorrowingLimitations",
    "directorsReportShareholder",
  ];

  const directorsReportContinuationOptionKeys = [
    "directorsReportGoingConcern",
    "directorsReportLiquiditySolvency",
    "directorsReportLitigation",
    "directorsReportSocialEthics",
    "directorsReportSubsidiaries",
    "directorsReportAssociates",
    "directorsReportJointVentures",
    "directorsReportNonCurrentAssets",
    "directorsReportAuthorisation",
    "directorsReportOther1",
    "directorsReportOther2",
    "directorsReportOther3",
    "directorsReportOther4",
    "directorsReportOther5",
    "directorsReportOther6",
    "directorsReportOther7",
    "directorsReportOther8",
    "directorsReportOther9",
    "directorsReportOther10",
  ];

  const directorsReportContinuationStartNumber =
    directorsReportFirstPageOptionKeys.filter(
      (key) => Boolean((reportOptions as any)[key]),
    ).length;

  const showDirectorsReportContinuation =
    directorsReportContinuationOptionKeys.some((key) =>
      Boolean((reportOptions as any)[key]),
    );



  function renderDirectorsReportAuthorisationExportPage() {
    const authorisationTextBlock =
  ((activeDirectorsReportTexts as any)?.directorsReportAuthorisation ||
    (activeDirectorsReportTexts as any)?.authorisation ||
    (defaultDirectorsReportTexts as any)?.directorsReportAuthorisation ||
    (defaultDirectorsReportTexts as any)?.authorisation ||
    {}) as { title?: string; text?: string };

const directorsReportSectionsBeforeAuthorisation = [
  reportOptions.directorsReportGeneralReview,
  reportOptions.directorsReportIncorporation,
  reportOptions.directorsReportNatureBusiness,
  reportOptions.directorsReportReviewActivities,
  reportOptions.directorsReportFinancialResults,
  reportOptions.directorsReportEventsAfter,
  reportOptions.directorsReportDividends,
  reportOptions.directorsReportShareCapital,
  reportOptions.directorsReportDirectors,
  reportOptions.directorsReportSecretary,
  reportOptions.directorsReportExternalAccountant,
  reportOptions.directorsReportInterestContracts,
  reportOptions.directorsReportBorrowingLimitations,
  reportOptions.directorsReportShareholder,
  reportOptions.directorsReportGoingConcern,
  reportOptions.directorsReportLiquiditySolvency,
  reportOptions.directorsReportLitigation,
  reportOptions.directorsReportSocialEthics,
  reportOptions.directorsReportSubsidiaries,
  reportOptions.directorsReportAssociates,
  reportOptions.directorsReportJointVentures,
  reportOptions.directorsReportNonCurrentAssets,
];

const authorisationNumber =
  directorsReportSectionsBeforeAuthorisation.filter(Boolean).length + 1;

const cleanAuthorisationTitle = String(
  authorisationTextBlock.title || "Authorisation of annual financial statements",
)
  .replace(/^\d+\.\s*/, "")
  .trim();

const title = `${authorisationNumber}. ${cleanAuthorisationTitle}`;

    const rawText =
      authorisationTextBlock.text ||
      `The annual financial statements were authorised for issue by the ${bodyLabel} on ${approvalDate}.`;

    const paragraphs = renderDisclosureText(String(rawText), {
      ...disclosureTokens,
      bodyLabel,
      approvalDate: String(approvalDate),
      clientName,
    } as any);

    return (
      <AfsA4Page {...reportHeaderProps}>
        <section
          className="afs-directors-report-authorisation-page"
          style={{
            fontSize: 11.2,
            lineHeight: 1.45,
            color: "#111827",
          }}
        >
          <h1 style={pageHeadingStyle()}>{reportTitle(entityType)} continued</h1>

          <section
            style={{
              breakInside: "avoid",
              pageBreakInside: "avoid",
              marginTop: 8,
            }}
          >
            <h2
              style={{
                ...sectionHeadingStyle(),
                marginTop: 0,
                breakAfter: "avoid",
                pageBreakAfter: "avoid",
              }}
            >
              {title}
            </h2>

            {paragraphs.map((paragraph, paragraphIndex) => (
              <p
                key={`directors-report-authorisation-${paragraphIndex}`}
                style={{
                  ...paragraphStyle(),
                  marginBottom: paragraphIndex === paragraphs.length - 1 ? 0 : 10,
                }}
              >
                {paragraph}
              </p>
            ))}
          </section>
        </section>
      </AfsA4Page>
    );
  }

  const noteNumberMap = useMemo(() => {
    const keyMap: Record<string, AfsNoteKey> = {
      notesPropertyPlantEquipment: "propertyPlantEquipment",
      notesGoodwill: "goodwill",
      notesInvestmentProperty: "investmentProperty",
      notesIntangibleAssets: "intangibleAssets",
      notesBiologicalAssets: "biologicalAssets",
      notesOtherNonCurrentAssets: "otherNonCurrentAssets",
      notesLoansReceivable: "loansReceivable",
      notesInventories: "inventories",
      notesTradeReceivables: "tradeReceivables",
      notesCurrentTaxReceivable: "currentTaxReceivable",
      notesCashAndCashEquivalents: "cashAndCashEquivalents",
      notesShareCapital: "shareCapital",
      notesRetainedIncome: "retainedIncome",
      notesShareholdersLoans: "shareholdersLoans",
      notesOtherFinancialLiabilities: "otherFinancialLiabilities",
      notesTradePayables: "tradePayables",
      notesCurrentTaxPayable: "currentTaxPayable",
      notesRevenue: "revenue",
      notesOtherIncome: "otherIncome",
      notesOperatingExpenses: "operatingExpenses",
      notesFinanceCosts: "financeCosts",
      notesTaxation: "taxation",
      notesCashUsedInOperations: "cashUsedInOperations",
    };

    const map: Partial<Record<AfsNoteKey, string | number>> = {};
    let nextNumber = 1;

    noteSections.forEach((section: any) => {
      if (!reportOptions[section.optionKey as keyof ReportOptions]) return;

      const noteKey = keyMap[section.key];
      if (!noteKey) return;

      map[noteKey] = nextNumber;
      nextNumber += 1;
    });

    return map;
  }, [reportOptions]);

  const statementEngine = useMemo(
    () =>
      buildAfsPrintStatementEngine(
        trialBalanceLines,
        statementOverrides,
        noteNumberMap,
      ),
    [trialBalanceLines, statementOverrides, noteNumberMap],
  );

  const flightDeckIssues = useMemo(
    () => buildAfsFlightDeckIssuesFromEngine(statementEngine),
    [statementEngine],
  );

  const sfpRows = statementEngine.sfpRows;
  const sociRows = statementEngine.sociRows;
  const sceRows = statementEngine.sceRows;
  const cashFlowRows = statementEngine.cashFlowRows;
  const detailedIncomeRows = useMemo(
    () => cleanDetailedIncomeRowsForReport(statementEngine.detailedIncomeRows || []),
    [statementEngine.detailedIncomeRows],
  );
  const noteData = statementEngine.noteData;

  const noteDataForPrintStudio = useMemo(() => {
    const base: Record<string, any[]> = { ...(noteData as any) };
    base.shareholdersLoans = buildShareholderLoanSplitRows(
      trialBalanceLines,
      base.shareholdersLoans || [],
    );
    return base;
  }, [noteData, trialBalanceLines]);

  const cashNoteCurrent = Math.round(
    (noteData.cashAndCashEquivalents || []).reduce(
      (sum: number, line: any) => sum + Number(line.current || 0),
      0,
    ),
  );
  const cashNotePrior = Math.round(
    (noteData.cashAndCashEquivalents || []).reduce(
      (sum: number, line: any) => sum + Number(line.prior || 0),
      0,
    ),
  );

  const exportCashFlowRows = useMemo(() => {
    const rows = (cashFlowRows || []).map((row: any) => ({ ...row }));
    const labelIncludes = (row: any, terms: string[]) => {
      const label = String(row?.label || "").toLowerCase();
      return terms.every((term) => label.includes(term));
    };
    const findRow = (terms: string[]) =>
      rows.find((row: any) => labelIncludes(row, terms));

    const profitRow = findRow(["profit", "taxation"]);
    const nonCashRow = findRow(["adjustments", "non-cash"]);
    const workingCapitalRow = findRow(["changes", "working capital"]);
    const generatedRow = findRow(["cash generated", "operations"]);
    const netOperatingRow = findRow(["net cash", "operating activities"]);
    const netIncreaseRow = findRow(["net increase"]);
    const openingCashRow = findRow(["beginning", "year"]);
    const closingCashRow = findRow(["end", "year"]);

    const profitCurrent = Number(profitRow?.current || 0);
    const profitPrior = Number(profitRow?.prior || 0);
    const nonCashCurrent = Number(nonCashRow?.current || 0);
    const nonCashPrior = Number(nonCashRow?.prior || 0);

    const currentMovement = cashNoteCurrent - cashNotePrior;
    const priorMovement = cashNotePrior;

    if (openingCashRow) {
      openingCashRow.current = cashNotePrior;
      openingCashRow.prior = 0;
    }
    if (closingCashRow) {
      closingCashRow.current = cashNoteCurrent;
      closingCashRow.prior = cashNotePrior;
    }
    if (netIncreaseRow) {
      netIncreaseRow.current = currentMovement;
      netIncreaseRow.prior = priorMovement;
    }
    if (workingCapitalRow) {
      workingCapitalRow.current = currentMovement - profitCurrent - nonCashCurrent;
      workingCapitalRow.prior = priorMovement - profitPrior - nonCashPrior;
    }
    if (generatedRow) {
      generatedRow.current = currentMovement;
      generatedRow.prior = priorMovement;
    }
    if (netOperatingRow) {
      netOperatingRow.current = currentMovement;
      netOperatingRow.prior = priorMovement;
    }

    return rows;
  }, [cashFlowRows, cashNoteCurrent, cashNotePrior]);

  const engineChecks = statementEngine.checks;

  const sections: AfsStudioSection[] = [
    {
      id: "cover-page",
      label: "Cover Page",
      shortLabel: "Cover",
      group: "report",
      hidden: !reportOptions.coverPage,
    },
    {
      id: "index",
      label: "Index",
      shortLabel: "Index",
      group: "report",
      hidden: !reportOptions.index,
    },
    {
      id: "general-info",
      label: "General Information",
      shortLabel: "General Info",
      group: "report",
      hidden: !reportOptions.generalInformation,
    },
    {
      id: "directors-responsibilities",
      label: "Directors’ Responsibilities",
      shortLabel: "Responsibilities",
      group: "report",
      hidden: !reportOptions.directorsResponsibilities,
    },
    {
      id: "directors-report",
      label: "Directors’ Report",
      shortLabel: "Directors Report",
      group: "report",
      hidden: !reportOptions.directorsReport,
    },
    {
      id: "compiler-report",
      label: "Compiler Report",
      shortLabel: "Compiler",
      group: "report",
      hidden: !reportOptions.compilerReport,
    },
    {
      id: "sfp",
      label: "Statement of Financial Position",
      shortLabel: "SFP",
      group: "report",
      hidden: !reportOptions.sfp,
    },
    {
      id: "soci",
      label: "Statement of Comprehensive Income",
      shortLabel: "SOCI",
      group: "report",
      hidden: !reportOptions.soci,
    },
    {
      id: "sce",
      label: "Statement of Changes in Equity",
      shortLabel: "SCE",
      group: "report",
      hidden: !reportOptions.sce,
    },
    {
      id: "cash-flow",
      label: "Statement of Cash Flows",
      shortLabel: "Cash Flow",
      group: "report",
      hidden: !reportOptions.cashFlow,
    },
    {
      id: "accounting-policies",
      label: "Accounting Policies",
      shortLabel: "Policies",
      group: "report",
      hidden: !reportOptions.accountingPolicies,
    },
    {
      id: "notes",
      label: "Notes to the Financial Statements",
      shortLabel: "Notes",
      group: "report",
      hidden: !reportOptions.notes,
    },
    {
      id: "detailed-income",
      label: "Detailed Income Statement",
      shortLabel: "Detailed IS",
      group: "report",
      hidden: !reportOptions.detailedIncomeStatement,
    },
    {
      id: "tax-computation",
      label: "Tax Computation",
      shortLabel: "Tax",
      group: "report",
      hidden: !reportOptions.taxComputation,
    },
    {
      id: "report-options",
      label: "AFS Report Options",
      shortLabel: "Options",
      group: "settings",
    },
  ];

  const reportHeaderProps = {
    showReportHeader: true,
    clientName,
    registrationNumber: registrationNumber || undefined,
    yearEndLabel: `Annual financial statements for the year ended ${yearEnd}`,
  };

  const visibleReportSections = sections.filter(
    (section) => section.group === "report" && !section.hidden,
  );

  function buildAccountingPolicyPrintItems() {
    const combinedGroups = new Set([
      "revenue",
      "ppe",
      "financial-instruments",
      "leases",
      "investment-property",
    ]);

    const items: Array<
      | {
          type: "single";
          section: (typeof accountingPolicySections)[number];
        }
      | {
          type: "group";
          groupKey: string;
          groupLabel: string;
          sections: Array<(typeof accountingPolicySections)[number]>;
        }
    > = [];

    const groupMap = new Map<
      string,
      {
        type: "group";
        groupKey: string;
        groupLabel: string;
        sections: Array<(typeof accountingPolicySections)[number]>;
      }
    >();

    accountingPolicySections.forEach((section: any) => {
      const isSelected = Boolean(
        reportOptions[section.optionKey as keyof ReportOptions],
      );

      if (!isSelected) return;

      const groupKey = section.group || "other";
      const groupLabel =
        section.groupLabel ||
        section.label ||
        section.title ||
        section.defaultTitle;

      if (!combinedGroups.has(groupKey)) {
        items.push({
          type: "single",
          section,
        });
        return;
      }

      if (!groupMap.has(groupKey)) {
        const groupItem = {
          type: "group" as const,
          groupKey,
          groupLabel,
          sections: [],
        };

        groupMap.set(groupKey, groupItem);
        items.push(groupItem);
      }

      groupMap.get(groupKey)?.sections.push(section);
    });

    return items;
  }

  function getNoteLinesForSectionKey(key: string) {
    const sourceNoteData = (noteDataForPrintStudio || noteData || {}) as Record<string, any[]>;

    const map: Record<string, any[]> = {
      notesPropertyPlantEquipment: sourceNoteData.propertyPlantEquipment,
      notesGoodwill: sourceNoteData.goodwill,
      notesInvestmentProperty: sourceNoteData.investmentProperty,
      notesIntangibleAssets: sourceNoteData.intangibleAssets,
      notesBiologicalAssets: sourceNoteData.biologicalAssets,
      notesOtherNonCurrentAssets: sourceNoteData.otherNonCurrentAssets,
      notesLoansReceivable: sourceNoteData.loansReceivable,
      notesInventories: sourceNoteData.inventories,
      notesTradeReceivables: sourceNoteData.tradeReceivables,
      notesCurrentTaxReceivable: sourceNoteData.currentTaxReceivable,
      notesCashAndCashEquivalents: sourceNoteData.cashAndCashEquivalents,
      notesShareCapital: sourceNoteData.shareCapital,
      notesRetainedIncome: sourceNoteData.retainedIncome,
      notesShareholdersLoans: sourceNoteData.shareholdersLoans,
      notesOtherFinancialLiabilities: sourceNoteData.otherFinancialLiabilities,
      notesTradePayables: sourceNoteData.tradePayables,
      notesCurrentTaxPayable: sourceNoteData.currentTaxPayable,
      notesRevenue: sourceNoteData.revenue,
      notesOtherIncome: sourceNoteData.otherIncome,
      notesOperatingExpenses: sourceNoteData.operatingExpenses,
      notesFinanceCosts: sourceNoteData.financeCosts,
      notesTaxation: sourceNoteData.taxation,
      notesCashUsedInOperations: sourceNoteData.cashUsedInOperations,
    };

    return map[key] || [];
  }


  function formatNoteAmount(value: unknown) {
    return afsAmount(value);
  }

  function isLikelyGarbageNoteParagraph(value: unknown) {
    const text = String(value || "").trim();
    if (!text) return true;

    const compact = text.replace(/\s+/g, "");
    const hasRealWords = /[A-Za-z]{3,}\s+[A-Za-z]{2,}/.test(text);
    const looksLikeKeyboardMash = compact.length >= 10 && !hasRealWords;

    return looksLikeKeyboardMash;
  }

  function cleanExportNoteParagraphs(paragraphs: string[]) {
    return (paragraphs || []).filter((paragraph) => !isLikelyGarbageNoteParagraph(paragraph));
  }

  function cashGeneratedNoteRows(lines: any[]) {
    const source = (lines || []).map((line) => ({ ...line }));
    const byLabel = (terms: string[]) =>
      source.find((line) => {
        const label = String(line?.label || "").toLowerCase();
        return terms.every((term) => label.includes(term));
      });

    const profit = byLabel(["profit", "taxation"]) || source[0];
    const nonCash = byLabel(["non-cash"]);
    const workingCapital = byLabel(["working", "capital"]);
    const generated =
      byLabel(["cash generated", "operations"]) ||
      byLabel(["cash", "used", "operations"]) ||
      source[source.length - 1];

    const rows: any[] = [];

    if (profit) {
      rows.push({ ...profit, label: "Profit / (loss) before taxation" });
    }

    if (
      nonCash &&
      (Math.round(Number(nonCash.current || 0)) !== 0 ||
        Math.round(Number(nonCash.prior || 0)) !== 0)
    ) {
      rows.push({ ...nonCash, label: "Adjustments for non-cash and other items" });
    }

    if (
      workingCapital &&
      (Math.round(Number(workingCapital.current || 0)) !== 0 ||
        Math.round(Number(workingCapital.prior || 0)) !== 0)
    ) {
      rows.push({ ...workingCapital, label: "Changes in working capital" });
    }

    if (generated) {
      rows.push({
        ...generated,
        label: "Cash generated from operations",
        meta: { ...(generated.meta || {}), strong: true, finalLine: true },
      });
    }

    return rows.length ? rows : source;
  }

  function renderNoteTable(lines: any[], noteKey?: string) {
    if (!lines || lines.length === 0) return null;

    const isCashGeneratedNote = noteKey === "notesCashUsedInOperations";
    const isShareholdersLoansNote = noteKey === "notesShareholdersLoans";
    const displaySourceLines = isCashGeneratedNote ? cashGeneratedNoteRows(lines) : lines;

    const displayLines =
      displaySourceLines.length === 1
        ? [
            {
              ...displaySourceLines[0],
              label: String(displaySourceLines[0]?.label || "")
                .toLowerCase()
                .includes("cash and cash")
                ? "Bank balances"
                : String(displaySourceLines[0]?.label || "")
                      .toLowerCase()
                      .includes("share capital")
                  ? "Issued share capital"
                  : String(displaySourceLines[0]?.label || "")
                        .toLowerCase()
                        .includes("inventor")
                    ? "Inventories on hand"
                    : String(displaySourceLines[0]?.label || "")
                          .toLowerCase()
                          .includes("shareholder")
                      ? "Loans from shareholders"
                      : displaySourceLines[0]?.label,
            },
          ]
        : displaySourceLines;

    const totalCurrent = displayLines.reduce(
      (total, line) => total + Number(line.current || 0),
      0,
    );
    const totalPrior = displayLines.reduce(
      (total, line) => total + Number(line.prior || 0),
      0,
    );

    return (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          margin: "4px 0 8px",
          fontSize: 10.2,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1.5px solid #111827",
                padding: "2px 0 3px",
              }}
            >
              Description
            </th>
            <th
              style={{
                textAlign: "right",
                borderBottom: "1.5px solid #111827",
                padding: "2px 0 3px",
                width: 80,
              }}
            >
              {currentHeading}
            </th>
            <th
              style={{
                textAlign: "right",
                borderBottom: "1.5px solid #111827",
                padding: "2px 0 3px",
                width: 80,
              }}
            >
              {priorHeading}
            </th>
          </tr>
        </thead>
        <tbody>
          {displayLines.flatMap((line, lineIndex) => {
            const rowKey = String(line.id || line.label || lineIndex);
            const rows = [
              <tr key={`${rowKey}-amount`}>
                <td
                  style={{
                    padding: "2px 0",
                    borderBottom: line?.meta?.finalLine ? "1px solid #111827" : "0",
                    fontWeight: line?.meta?.strong ? 800 : 400,
                  }}
                >
                  {line.label}
                </td>
                <td
                  style={{
                    padding: "2px 0",
                    textAlign: "right",
                    borderBottom: line?.meta?.finalLine ? "1px solid #111827" : "0",
                    fontWeight: line?.meta?.strong ? 800 : 400,
                  }}
                >
                  {formatNoteAmount(line.current)}
                </td>
                <td
                  style={{
                    padding: "2px 0",
                    textAlign: "right",
                    borderBottom: line?.meta?.finalLine ? "1px solid #111827" : "0",
                    fontWeight: line?.meta?.strong ? 800 : 400,
                  }}
                >
                  {formatNoteAmount(line.prior)}
                </td>
              </tr>,
            ];

            if (isShareholdersLoansNote) {
              const termsText =
                line?.meta?.terms ||
                line?.meta?.loanTerms ||
                "The loan is unsecured, bears no interest and has no fixed repayment terms.";

              rows.push(
                <tr key={`${rowKey}-terms`}>
                  <td
                    colSpan={3}
                    style={{
                      padding: "0 0 5px 0",
                      fontSize: 9.9,
                      lineHeight: 1.22,
                      color: "#111827",
                    }}
                  >
                    {termsText}
                  </td>
                </tr>,
              );
            }

            return rows;
          })}
          {!isCashGeneratedNote ? (
            <tr>
              <td
                style={{
                  padding: "3px 0",
                  borderTop: "1px solid #111827",
                  fontWeight: 800,
                }}
              >
                Total
              </td>
              <td
                style={{
                  padding: "3px 0",
                  borderTop: "1px solid #111827",
                  fontWeight: 800,
                  textAlign: "right",
                }}
              >
                {formatNoteAmount(totalCurrent)}
              </td>
              <td
                style={{
                  padding: "3px 0",
                  borderTop: "1px solid #111827",
                  fontWeight: 800,
                  textAlign: "right",
                }}
              >
                {formatNoteAmount(totalPrior)}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    );
  }

  function afsAmount(value: unknown) {
    const number = Math.round(Number(value || 0));

    if (number === 0) return "–";

    const formatted = Math.abs(number).toLocaleString("en-ZA");

    return number < 0 ? `(${formatted})` : formatted;
  }

  function sceValue(id: string) {
    return Number(sceRows.find((row) => row.id === id)?.current || 0);
  }

  function renderSceCustomTable() {
    const openingShare = sceValue("sce-share-opening");
    const openingRetained = sceValue("sce-retained-opening");
    const priorProfit = sceValue("sce-prior-profit");
    const priorOther = sceValue("sce-prior-other-movement");
    const priorClosingRetained = sceValue("sce-prior-closing-retained");
    const currentProfit = sceValue("sce-current-profit");
    const currentOther = sceValue("sce-current-other-movement");
    const currentClosingRetained = sceValue("sce-retained-closing");
    const closingShare = sceValue("sce-share-closing");

    const rows = [
      {
        label: "Balance at beginning of prior year",
        share: openingShare,
        retained: openingRetained,
        total: openingShare + openingRetained,
        strong: true,
      },
      {
        label: "Profit / (loss) for prior year",
        share: 0,
        retained: priorProfit,
        total: priorProfit,
      },
      {
        label: "Other comprehensive income for prior year",
        share: 0,
        retained: 0,
        total: 0,
      },
      {
        label: "Other movements / distributions - prior year",
        share: 0,
        retained: priorOther,
        total: priorOther,
      },
      {
        label: "Balance at end of prior year",
        share: openingShare,
        retained: priorClosingRetained,
        total: openingShare + priorClosingRetained,
        strong: true,
        underline: true,
      },
      {
        label: "Profit / (loss) for current year",
        share: 0,
        retained: currentProfit,
        total: currentProfit,
      },
      {
        label: "Other comprehensive income for current year",
        share: 0,
        retained: 0,
        total: 0,
      },
      {
        label: "Other movements / distributions - current year",
        share: 0,
        retained: currentOther,
        total: currentOther,
      },
      {
        label: "Balance at end of current year",
        share: closingShare,
        retained: currentClosingRetained,
        total: closingShare + currentClosingRetained,
        strong: true,
        underline: true,
      },
    ];

    return (
      <section style={{ fontSize: 11, color: "#111827" }}>
        <h1 style={pageHeadingStyle()}>Statement of Changes in Equity</h1>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 10.5,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #111827",
                  padding: "3px 0",
                }}
              >
                Figures in Rand
              </th>
              <th
                style={{
                  textAlign: "right",
                  borderBottom: "1px solid #111827",
                  padding: "3px 0",
                  width: 90,
                }}
              >
                Share capital
              </th>
              <th
                style={{
                  textAlign: "right",
                  borderBottom: "1px solid #111827",
                  padding: "3px 0",
                  width: 110,
                }}
              >
                Accumulated loss
              </th>
              <th
                style={{
                  textAlign: "right",
                  borderBottom: "1px solid #111827",
                  padding: "3px 0",
                  width: 90,
                }}
              >
                Total equity
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td
                  style={{
                    padding: "3px 0",
                    fontWeight: row.strong ? 800 : 400,
                  }}
                >
                  {row.label}
                </td>
                <td
                  style={{
                    padding: "3px 0",
                    textAlign: "right",
                    fontWeight: row.strong ? 800 : 400,
                    borderTop: row.underline ? "1px solid #111827" : undefined,
                    borderBottom: row.underline
                      ? "2px solid #111827"
                      : undefined,
                  }}
                >
                  {afsAmount(row.share)}
                </td>
                <td
                  style={{
                    padding: "3px 0",
                    textAlign: "right",
                    fontWeight: row.strong ? 800 : 400,
                    borderTop: row.underline ? "1px solid #111827" : undefined,
                    borderBottom: row.underline
                      ? "2px solid #111827"
                      : undefined,
                  }}
                >
                  {afsAmount(row.retained)}
                </td>
                <td
                  style={{
                    padding: "3px 0",
                    textAlign: "right",
                    fontWeight: row.strong ? 800 : 400,
                    borderTop: row.underline ? "1px solid #111827" : undefined,
                    borderBottom: row.underline
                      ? "2px solid #111827"
                      : undefined,
                  }}
                >
                  {afsAmount(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }


  type PrintableNoteItem = {
    id: string;
    number: number;
    title: string;
    textParagraphs: string[];
    lines: any[];
    estimatedUnits: number;
  };

  function estimatePrintableNoteUnits(lines: any[], paragraphs: string[]) {
    /*
      Export note packing estimate.
      This is intentionally looser than the old estimate. The previous version
      treated small 1-line notes as too tall, which created notes pages with
      only 1 or 2 notes and huge blank spaces. The real rendered note rows are
      compact, so the export packer must allow several normal notes per A4 page.
    */
    const rowCount = Math.max(1, (lines || []).length);
    const rowUnits = 3.2 + rowCount * 1.45;
    const paragraphUnits = (paragraphs || []).reduce(
      (total, paragraph) => total + Math.max(0.9, String(paragraph || "").length / 155),
      0,
    );

    return rowUnits + paragraphUnits + 2.2;
  }

  function buildPrintableNoteItems(): PrintableNoteItem[] {
    let noteNumber = 1;

    return (noteSections || [])
      .filter((section: any) => Boolean(reportOptions[section.optionKey as keyof ReportOptions]))
      .map((section: any) => {
        const defaults = defaultNoteTexts[section.key] || { title: section.label || section.title || section.key, text: "" };
        const active = activeNoteTexts[section.key] || defaults;
        const lines = getNoteLinesForSectionKey(section.key);
        const textParagraphs = cleanExportNoteParagraphs(renderDisclosureText(active.text || "", disclosureTokens).filter(Boolean));

        const item: PrintableNoteItem = {
          id: section.key,
          number: noteNumber,
          title: section.key === "notesCashUsedInOperations" ? "Cash generated from operations" : active.title || section.label || section.title || defaults.title || section.key,
          textParagraphs,
          lines,
          estimatedUnits: estimatePrintableNoteUnits(lines, textParagraphs),
        };

        noteNumber += 1;
        return item;
      })
      .filter((item) => item.lines.length > 0 || item.textParagraphs.length > 0);
  }

  function chunkPrintableNotes(items: PrintableNoteItem[]) {
    const pages: PrintableNoteItem[][] = [];
    let page: PrintableNoteItem[] = [];
    let used = 0;

    items.forEach((item) => {
      const maxUnits = pages.length === 0 ? 62 : 66;
      const nextUnits = Math.min(item.estimatedUnits, 26);

      if (page.length > 0 && used + nextUnits > maxUnits) {
        pages.push(page);
        page = [];
        used = 0;
      }

      page.push(item);
      used += nextUnits;
    });

    if (page.length > 0) pages.push(page);
    return pages.length > 0 ? pages : [[]];
  }

  function renderPrintableNotesPage(items: PrintableNoteItem[], pageIndex: number) {
    return (
      <AfsA4Page {...reportHeaderProps}>
        <section
          className="afs-export-notes-page"
          style={{ fontSize: 10.35, lineHeight: 1.28, color: "#111827" }}
        >
          {pageIndex === 0 ? (
            <h1 style={pageHeadingStyle()}>Notes to the Financial Statements</h1>
          ) : (
            <h1 style={{ ...pageHeadingStyle(), fontSize: 13.5 }}>
              Notes to the Financial Statements continued
            </h1>
          )}

          {items.map((item) => (
            <section
              key={item.id}
              className="afs-export-note-item"
              style={{ marginBottom: 8, breakInside: "avoid", pageBreakInside: "avoid" }}
            >
              <h2
                style={{
                  fontSize: 11.45,
                  lineHeight: 1.2,
                  margin: "0 0 5px",
                  fontWeight: 900,
                }}
              >
                {item.number}. {item.title}
              </h2>

              {item.textParagraphs.map((paragraph, paragraphIndex) => (
                <p
                  key={`${item.id}-paragraph-${paragraphIndex}`}
                  style={{ margin: "0 0 4px", fontSize: 10.25, lineHeight: 1.26 }}
                >
                  {paragraph}
                </p>
              ))}

              {renderNoteTable(item.lines, item.id)}
            </section>
          ))}
        </section>
      </AfsA4Page>
    );
  }


  const printableNoteItems = useMemo(
    () => buildPrintableNoteItems(),
    [
      reportOptions,
      activeNoteTexts,
      defaultNoteTexts,
      noteDataForPrintStudio,
      disclosureTokens,
    ],
  );

  const printableNotePages = useMemo(
    () => chunkPrintableNotes(printableNoteItems),
    [printableNoteItems],
  );

  const indexRows = useMemo(() => {
    type IndexRow = {
      id: string;
      label: string;
      page: number;
      pageSpan: number;
      show: boolean;
      includeInIndex: boolean;
    };

    const reportSequence: Omit<IndexRow, "page">[] = [
      {
        id: "cover-page",
        label: "Cover Page",
        pageSpan: 1,
        show: reportOptions.coverPage,
        includeInIndex: false,
      },
      {
        id: "index",
        label: "Index",
        pageSpan: 1,
        show: reportOptions.index,
        includeInIndex: true,
      },
      {
        id: "general-info",
        label: "General Information",
        pageSpan: 1,
        show: reportOptions.generalInformation,
        includeInIndex: true,
      },
      {
        id: "directors-responsibilities",
        label: responsibilityTitle(entityType).replace(" and Approval", ""),
        pageSpan: 1,
        show: reportOptions.directorsResponsibilities,
        includeInIndex: true,
      },
      {
        id: "directors-report",
        label: reportTitle(entityType),
        pageSpan: showDirectorsReportContinuation ? 2 : 1,
        show: reportOptions.directorsReport,
        includeInIndex: true,
      },
      {
        id: "compiler-report",
        label: "Compiler Report",
        pageSpan: 1,
        show: reportOptions.compilerReport,
        includeInIndex: true,
      },
      {
        id: "sfp",
        label: "Statement of Financial Position",
        pageSpan: 1,
        show: reportOptions.sfp,
        includeInIndex: true,
      },
      {
        id: "soci",
        label: "Statement of Comprehensive Income",
        pageSpan: 1,
        show: reportOptions.soci,
        includeInIndex: true,
      },
      {
        id: "sce",
        label: "Statement of Changes in Equity",
        pageSpan: 1,
        show: reportOptions.sce,
        includeInIndex: true,
      },
      {
        id: "cash-flow",
        label: "Statement of Cash Flows",
        pageSpan: 1,
        show: reportOptions.cashFlow,
        includeInIndex: true,
      },
      {
        id: "accounting-policies",
        label: "Accounting Policies",
        pageSpan: 1,
        show: reportOptions.accountingPolicies,
        includeInIndex: true,
      },
      {
        id: "notes",
        label: "Notes to the Financial Statements",
        pageSpan: Math.max(1, printableNotePages.length),
        show: reportOptions.notes,
        includeInIndex: true,
      },
      {
        id: "detailed-income",
        label: "Detailed Income Statement",
        pageSpan: 1,
        show: reportOptions.detailedIncomeStatement,
        includeInIndex: true,
      },
      {
        id: "tax-computation",
        label: "Tax Computation",
        pageSpan: 1,
        show: reportOptions.taxComputation,
        includeInIndex: true,
      },
    ];

    let currentPage = 1;
    const rows: IndexRow[] = [];

    reportSequence.forEach((section) => {
      if (!section.show) return;

      if (section.includeInIndex) {
        rows.push({
          ...section,
          page: currentPage,
        });
      }

      currentPage += section.pageSpan;
    });

    return rows;
  }, [
    entityType,
    printableNotePages.length,
    reportOptions,
    showDirectorsReportContinuation,
  ]);

  function contextualOptions() {
    if (activeSectionId === "report-options") {
      return {
        title: "AFS Report Options",
        description: "Turn main AFS report pages on or off.",
        emptyMessage: "Use this page to control the main AFS report structure.",
        options: reportSectionOptions,
        content: null,
      };
    }

    if (activeSectionId === "directors-report") {
      return {
        title: "Directors’ Report settings",
        description:
          "Turn sections on/off, edit wording, or reset to PracticePilot defaults.",
        emptyMessage: "No directors’ report settings available.",
        options: [],
        content: (
          <AfsDirectorsReportSettings
            reportOptions={reportOptions}
            toggleReportOption={toggleReportOption}
            texts={activeDirectorsReportTexts}
            defaults={defaultDirectorsReportTexts}
            onChangeTitle={updateDirectorsReportTitle}
            onChangeText={updateDirectorsReportText}
            onReset={resetDirectorsReportSection}
            onResetAll={resetAllDirectorsReportSections}
          />
        ),
      };
    }

    if (activeSectionId === "sce") {
      return {
        title: "SCE settings",
        description:
          "Set manual opening balances where prior-year values are incomplete.",
        emptyMessage: "No statement override settings available.",
        options: [],
        content: (
          <AfsStatementOverrideSettings
            mode="sce"
            overrides={statementOverrides}
            onChange={updateStatementOverride}
            engineChecks={engineChecks}
          />
        ),
      };
    }

    if (activeSectionId === "cash-flow") {
      return {
        title: "Cash flow settings",
        description:
          "Switch between the clean AFS statement and the cash flow workbench.",
        emptyMessage: "No cash flow settings available.",
        options: [],
        content: (
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                padding: 6,
              }}
            >
              <button
                type="button"
                onClick={() => setCashFlowViewMode("afs")}
                style={{
                  border: "1px solid #111827",
                  background:
                    cashFlowViewMode === "afs" ? "#111827" : "#ffffff",
                  color: cashFlowViewMode === "afs" ? "#ffffff" : "#111827",
                  padding: "7px 8px",
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                AFS view
              </button>
              <button
                type="button"
                onClick={() => setCashFlowViewMode("work")}
                style={{
                  border: "1px solid #111827",
                  background:
                    cashFlowViewMode === "work" ? "#111827" : "#ffffff",
                  color: cashFlowViewMode === "work" ? "#ffffff" : "#111827",
                  padding: "7px 8px",
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Workbench
              </button>
            </div>

            <div
              style={{
                fontSize: 10,
                color: "#475569",
                lineHeight: 1.4,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                padding: 8,
              }}
            >
              <strong>AFS view</strong> is the clean printable statement. <br />
              <strong>Workbench</strong> is where current and prior cash flow
              fields are captured.
            </div>
          </div>
        ),
      };
    }

    if (activeSectionId === "accounting-policies") {
      return {
        title: "Accounting policy settings",
        description: "Open a group, then tick only the policies that apply.",
        emptyMessage: "No accounting policy settings available.",
        options: [],
        content: (
          <AfsEditableDisclosureSettings
            sections={accountingPolicySections}
            reportOptions={reportOptions}
            toggleReportOption={toggleReportOption}
            texts={activeAccountingPolicyTexts}
            defaults={defaultAccountingPolicyTexts}
            onChangeTitle={updateAccountingPolicyTitle}
            onChangeText={updateAccountingPolicyText}
            onReset={resetAccountingPolicySection}
            onResetAll={resetAllAccountingPolicySections}
          />
        ),
      };
    }

    if (activeSectionId === "notes") {
      return {
        title: "Notes settings",
        description: "Open a group, then tick only the notes that apply.",
        emptyMessage: "No note settings available.",
        options: [],
        content: (
          <AfsEditableDisclosureSettings
            sections={noteSections}
            reportOptions={reportOptions}
            toggleReportOption={toggleReportOption}
            texts={activeNoteTexts}
            defaults={defaultNoteTexts}
            onChangeTitle={updateNoteTitle}
            onChangeText={updateNoteText}
            onReset={resetNoteSection}
            onResetAll={resetAllNoteSections}
          />
        ),
      };
    }

    if (activeSectionId === "cover-page") {
      return {
        title: "Cover page settings",
        description: "Cover page display options.",
        emptyMessage: "No cover page settings available.",
        options: [
          option("showCoverLogo", "Show logo"),
          option("showCoverFrameworkStatement", "Show framework statement"),
          option(
            "showCoverNoAssuranceStatement",
            "Show no-assurance statement",
          ),
        ],
        content: null,
      };
    }

    return {
      title: "Section settings",
      description:
        "This report page does not have section-specific settings yet.",
      emptyMessage:
        "No section-specific settings yet. Use AFS Report Options to turn this report page on or off.",
      options: [],
      content: null,
    };
  }

  const currentContextualOptions = contextualOptions();

  useEffect(() => {
    document.body.classList.add("afs-export-route-body");
    document.documentElement.classList.add("afs-export-route-html");

    return () => {
      document.body.classList.remove("afs-export-route-body");
      document.documentElement.classList.remove("afs-export-route-html");
    };
  }, []);

  useEffect(() => {
    const closeExportWindow = () => {
      window.setTimeout(() => {
        try {
          window.close();
        } catch {
          // Some browsers block scripted close. In that case the user can close the export tab manually.
        }
      }, 450);
    };

    window.addEventListener("afterprint", closeExportWindow);
    return () => window.removeEventListener("afterprint", closeExportWindow);
  }, []);

  useEffect(() => {
    if (loading) return;

    const printTimer = window.setTimeout(() => {
      window.print();
    }, 650);

    return () => window.clearTimeout(printTimer);
  }, [loading]);

  return (
  <main
  className={`afsExportOnlyRoot ${isDraftPdf ? "afsDraftExport" : ""}`}
>
  
  <style jsx global>{`
        html.afs-export-route-html,
        body.afs-export-route-body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: auto !important;
        }

        body.afs-export-route-body * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .afsExportOnlyRoot {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          width: 100vw;
          min-height: 100vh;
          margin: 0 !important;
          padding: 0 !important;
          overflow: auto;
          background: #ffffff;
        }

.afsExportOnlyRoot article {
  position: relative !important;
}

.afsDraftWatermark {
  position: absolute;
  top: 48%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-35deg);
  z-index: 999999;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 82pt;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.14em;
  color: rgba(90, 90, 90, 0.16);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}

        .afsExportOnlyRoot article {
          box-shadow: none !important;
        }

          .afsExportOnlyRoot {
            counter-reset: afs-export-page;
          }

          .afsExportOnlyRoot article {
            position: relative !important;
            counter-increment: afs-export-page;
          }

          .afsExportOnlyRoot article::after {
            content: counter(afs-export-page);
            position: absolute;
            right: 17mm;
            bottom: 8mm;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 9.5px;
            line-height: 1;
            color: #475569;
          }

          .afsExportOnlyRoot.afsDraftExport article::before {
  content: "DRAFT";
  position: absolute;
  top: 46%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-35deg);
  z-index: 999998;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 84pt;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.14em;
  color: rgba(100, 100, 100, 0.18);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}

          .afs-export-controlled-page,
          .afsExportOnlyRoot [id^="print-"] {
            break-before: page;
            page-break-before: always;
          }

          .afsExportOnlyRoot [id="print-cover-page"] {
            break-before: auto;
            page-break-before: auto;
          }

          .afs-export-note-item {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .afs-directors-report-authorisation-page,
          .afs-directors-report-authorisation-page section {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .afsExportOnlyRoot h2,
          .afsExportOnlyRoot h3 {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          .afsExportOnlyRoot p {
            orphans: 3;
            widows: 3;
          }

          .afs-export-notes-page section,
          .afs-export-notes-page .afs-export-note-item {
            margin-bottom: 11px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .afs-export-notes-page h2,
          .afs-export-notes-page h3 {
            margin-top: 10px !important;
            margin-bottom: 5px !important;
          }

          .afs-export-notes-page table {
            border-collapse: collapse !important;
            width: 100% !important;
            table-layout: fixed !important;
            margin: 3px 0 10px !important;
          }

          .afs-export-notes-page th,
          .afs-export-notes-page td {
            border-top: 0 !important;
            border-bottom: 0 !important;
            padding-top: 1.5px !important;
            padding-bottom: 1.5px !important;
            line-height: 1.22 !important;
          }

          .afs-export-notes-page thead th {
            border-bottom: 0 !important;
            font-weight: 800 !important;
          }

          .afs-export-notes-page tbody tr:last-child td {
            border-top: 0 !important;
            border-bottom: 0 !important;
            font-weight: 800 !important;
          }

          .afs-export-notes-page th:nth-child(2),
          .afs-export-notes-page th:nth-child(3),
          .afs-export-notes-page td:nth-child(2),
          .afs-export-notes-page td:nth-child(3) {
            border-bottom: 1px solid transparent !important;
          }

          .afs-export-notes-page tbody tr:not(:last-child) td:nth-child(2),
          .afs-export-notes-page tbody tr:not(:last-child) td:nth-child(3) {
            border-bottom: 1px solid #9ca3af !important;
          }

          .afs-export-notes-page tbody tr:last-child td:nth-child(2),
          .afs-export-notes-page tbody tr:last-child td:nth-child(3) {
            border-top: 1px solid #111827 !important;
            border-bottom: 1.25px solid #111827 !important;
          }

          .afs-export-notes-page th:nth-child(2),
          .afs-export-notes-page th:nth-child(3),
          .afs-export-notes-page td:nth-child(2),
          .afs-export-notes-page td:nth-child(3) {
            width: 20mm !important;
            max-width: 20mm !important;
            white-space: nowrap !important;
          }

        @media screen {
          body.afs-export-route-body {
            background: #ffffff !important;
          }

          body.afs-export-route-body > *:not(script):not(style) {
            background: #ffffff !important;
          }

          .afsExportOnlyRoot {
            display: grid;
            justify-content: center;
            align-content: start;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html.afs-export-route-html,
          body.afs-export-route-body {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          body.afs-export-route-body * {
            visibility: hidden !important;
          }

          body.afs-export-route-body .afsExportOnlyRoot,
          body.afs-export-route-body .afsExportOnlyRoot * {
            visibility: visible !important;
          }

          .afsExportOnlyRoot {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            right: auto !important;
            bottom: auto !important;
            z-index: 2147483647 !important;
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            min-height: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            display: block !important;
          }

          .afsExportOnlyRoot > div,
          .afsExportOnlyRoot [id^="print-"] {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            page-break-after: auto !important;
            break-after: auto !important;
            page-break-before: auto !important;
            break-before: auto !important;
          }

          .afsExportOnlyRoot table {
            width: 100% !important;
            table-layout: fixed;
          }

          .afsExportOnlyRoot tr,
          .afsExportOnlyRoot thead,
          .afsExportOnlyRoot tbody {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .afsExportOnlyRoot button,
          .afsExportOnlyRoot input,
          .afsExportOnlyRoot select,
          .afsExportOnlyRoot textarea,
          .afsExportOnlyRoot [data-work-only="true"],
          .afsExportOnlyRoot [data-editable="true"],
          .afsExportOnlyRoot [data-note-off="true"] {
            display: none !important;
          }


          .afsExportOnlyRoot article {
  width: 210mm !important;
  min-height: 297mm !important;
  height: 297mm !important;
  margin: 0 !important;
  overflow: hidden !important;
  page-break-after: always !important;
  break-after: page !important;
}

          .afsExportOnlyRoot article:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .afsExportOnlyRoot [id^="print-"] {
            page-break-before: always !important;
            break-before: page !important;
          }

          .afsExportOnlyRoot [id="print-cover-page"] {
            page-break-before: auto !important;
            break-before: auto !important;
          }

          .afsExportOnlyRoot #print-notes,
          .afsExportOnlyRoot #print-notes > div {
            page-break-before: auto !important;
            break-before: auto !important;
          }

          .afsExportOnlyRoot #print-notes > div + div {
            page-break-before: always !important;
            break-before: page !important;
          }

          .afs-export-note-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .afs-export-compiler-page {
            page-break-before: always !important;
            break-before: page !important;
          }

          .afs-export-compiler-page article {
            width: 210mm !important;
            min-height: 297mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .afs-export-compiler-page article::after {
            content: counter(afs-export-page);
          }

.afsExportOnlyRoot,
.afsExportOnlyRoot * {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}

        }
      `}</style>
      {loading ? (
        <AfsA4Page>
          <p style={{ fontSize: 12 }}>Loading Print Studio data...</p>
        </AfsA4Page>
      ) : (
        <>
          {reportOptions.coverPage ? (
            <div id="print-cover-page">
              <AfsA4Page>
                <section
                  style={{
                    minHeight: "245mm",
                    display: "grid",
                    alignContent: "center",
                    justifyItems: "center",
                    textAlign: "center",
                    color: "#111827",
                  }}
                >
                  <h1
                    style={{
                      fontSize: 22,
                      lineHeight: 1.25,
                      fontWeight: 800,
                      margin: "0 0 22px",
                      textTransform: "uppercase",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {clientName}
                  </h1>

                  <div
                    style={{
                      width: 390,
                      borderTop: "0",
                      borderBottom: "0",
                      padding: "0",
                      marginBottom: 24,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 900,
                        textTransform: "uppercase",
                      }}
                    >
                      Annual Financial Statements
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      for the year ended {yearEnd}
                    </div>

                    {reportOptions.showCoverFrameworkStatement ? (
                      <div style={{ marginTop: 8, fontSize: 10 }}>
                        Prepared in accordance with {String(framework)}
                      </div>
                    ) : null}

                    {reportOptions.showCoverNoAssuranceStatement ? (
                      <div style={{ marginTop: 4, fontSize: 10 }}>
                        These annual financial statements are unaudited.
                      </div>
                    ) : null}
                  </div>

                  {registrationNumber ? (
                    <div style={{ fontSize: 11, color: "#374151" }}>
                      Registration number: {registrationNumber}
                    </div>
                  ) : null}
                </section>
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.index ? (
            <div id="print-index">
              <AfsA4Page {...reportHeaderProps}>
                <section
                  className="afs-export-fixed-width"
                  style={{
                    fontSize: 11,
                    color: "#111827",
                    width: "100%",
                    minWidth: 0,
                    display: "block",
                  }}
                >
                  <h1 style={pageHeadingStyle()}>Index</h1>

                  <div style={{ display: "grid", gap: 0, width: "100%" }}>
                    {indexRows.map((section) => (
                      <div
                        key={section.id}
                        className="afs-export-row"
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 24,
                          width: "100%",
                          padding: "5px 0",
                          borderBottom: "0",
                          fontSize: 11,
                          lineHeight: 1.35,
                        }}
                      >
                        <span
                          className="afs-export-nowrap"
                          style={{
                            minWidth: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {section.label}
                        </span>
                        <span
                          style={{
                            flex: "0 0 36px",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {section.page}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.generalInformation ? (
            <div id="print-general-info">
              <AfsA4Page {...reportHeaderProps}>
                <section
                  style={{ fontSize: 11, lineHeight: 1.45, color: "#111827" }}
                >
                  <h1 style={pageHeadingStyle()}>General Information</h1>

                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 11,
                    }}
                  >
                    <tbody>
                      {renderInfoRow("Registered name", clientName)}
                      {renderInfoRow(
                        "Trading name",
                        getSetupValue(clientSetup, ["trading_name"]),
                      )}
                      {renderInfoRow("Registration number", registrationNumber)}
                      {renderInfoRow("Entity type", entityType)}
                      {renderInfoRow("Financial year end", yearEnd)}
                      {renderInfoRow(
                        "Country of incorporation and domicile",
                        country,
                      )}
                      {renderInfoRow(
                        "Nature of business and principal activities",
                        getSetupValue(clientSetup, [
                          "nature_of_business",
                          "principal_activities",
                          "business_activity",
                          "business_description",
                        ]),
                      )}
                      {renderInfoRow(
                        roleLabel(entityType),
                        directorsForDisplay.map(getPersonName),
                      )}
                      {renderInfoRow(
                        "Registered office",
                        getSetupValue(clientSetup, [
                          "registered_office",
                          "registered_address",
                          "registered_office_address",
                          "registeredAddress",
                          "registeredOffice",
                          "registeredOfficeAddress",
                        ]),
                      )}
                      {renderInfoRow(
                        "Business address",
                        getSetupValue(clientSetup, [
                          "business_address",
                          "physical_address",
                          "trading_address",
                          "businessAddress",
                          "physicalAddress",
                          "tradingAddress",
                        ]),
                      )}
                      {renderInfoRow(
                        "Postal address",
                        getSetupValue(clientSetup, [
                          "postal_address",
                          "mailing_address",
                          "postalAddress",
                          "mailingAddress",
                        ]),
                      )}
                      {renderInfoRow(
                        "Bankers",
                        getSetupValue(clientSetup, [
                          "bankers",
                          "banker",
                          "bank_name",
                          "bankName",
                        ]),
                      )}
                      {renderInfoRow(
                        "Income tax reference number",
                        getSetupValue(clientSetup, [
                          "income_tax_reference_number",
                          "tax_reference_number",
                          "income_tax_number",
                          "tax_number",
                          "incomeTaxReferenceNumber",
                          "taxReferenceNumber",
                        ]),
                      )}
                      {renderInfoRow(
                        "VAT number",
                        getSetupValue(clientSetup, [
                          "vat_number",
                          "vat_reference_number",
                          "vatNumber",
                          "vatReferenceNumber",
                        ]),
                      )}
                      {renderInfoRow(
                        "PAYE number",
                        getSetupValue(clientSetup, [
                          "paye_number",
                          "paye_reference_number",
                          "payeNumber",
                        ]),
                      )}
                      {renderInfoRow(
                        "UIF number",
                        getSetupValue(clientSetup, [
                          "uif_number",
                          "uif_reference_number",
                          "uifNumber",
                        ]),
                      )}
                      {renderInfoRow(
                        "Currency",
                        getSetupValue(clientSetup, [
                          "currency",
                          "presentation_currency",
                        ]),
                      )}
                      {renderInfoRow(
                        "Legal framework",
                        getSetupValue(clientSetup, [
                          "legal_framework",
                          "companies_act_framework",
                        ]),
                      )}
                      {renderInfoRow(
                        "Financial reporting framework",
                        framework,
                      )}
                      {renderInfoRow(
                        "Level of assurance",
                        getSetupValue(clientSetup, [
                          "level_of_assurance",
                          "engagement_type",
                        ]),
                      )}
                      {renderInfoRow("Practitioners", practitionerFirm)}
                      {renderInfoRow("Preparer", practitionerName)}
                    </tbody>
                  </table>
                </section>
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.directorsResponsibilities ? (
            <div id="print-directors-responsibilities">
              <AfsA4Page {...reportHeaderProps}>
                <section
                  style={{ fontSize: 11, lineHeight: 1.45, color: "#111827" }}
                >
                  <h1 style={pageHeadingStyle()}>
                    {responsibilityTitle(entityType)}
                  </h1>

                  <DirectorsResponsibilitiesBlock context={narrativeContext} />
                </section>
              </AfsA4Page>
            </div>
          ) : null}

        {reportOptions.directorsReport ? (
            <div id="print-directors-report">
              <AfsA4Page {...reportHeaderProps}>
                <section
                  style={{ fontSize: 11, lineHeight: 1.45, color: "#111827" }}
                >
                  <h1 style={pageHeadingStyle()}>{reportTitle(entityType)}</h1>

                  <DirectorsReportBlock
                    context={{
                      ...narrativeContext,

                      directorsReportGoingConcern: false,
                      directorsReportLiquiditySolvency: false,
                      directorsReportLitigation: false,
                      directorsReportSocialEthics: false,
                      directorsReportSubsidiaries: false,
                      directorsReportAssociates: false,
                      directorsReportJointVentures: false,
                      directorsReportNonCurrentAssets: false,
                      directorsReportAuthorisation: false,
                      directorsReportOther1: false,
                      directorsReportOther2: false,
                      directorsReportOther3: false,
                      directorsReportOther4: false,
                      directorsReportOther5: false,
                      directorsReportOther6: false,
                      directorsReportOther7: false,
                      directorsReportOther8: false,
                      directorsReportOther9: false,
                      directorsReportOther10: false,
                    }}
                  />
                </section>
              </AfsA4Page>

              {showDirectorsReportContinuation ? (
                <AfsA4Page {...reportHeaderProps}>
                  <section
                    style={{ fontSize: 11, lineHeight: 1.45, color: "#111827" }}
                  >
                    <h1 style={pageHeadingStyle()}>
                      {reportTitle(entityType)} continued
                    </h1>

                    <DirectorsReportBlock
                      startNumber={directorsReportContinuationStartNumber}
                      context={{
                        ...narrativeContext,

                        directorsReportGeneralReview: false,
                        directorsReportIncorporation: false,
                        directorsReportNatureBusiness: false,
                        directorsReportReviewActivities: false,
                        directorsReportFinancialResults: false,
                        directorsReportEventsAfter: false,
                        directorsReportDividends: false,
                        directorsReportShareCapital: false,
                        directorsReportDirectors: false,
                        directorsReportSecretary: false,
                        directorsReportExternalAccountant: false,
                        directorsReportInterestContracts: false,
                        directorsReportBorrowingLimitations: false,
                        directorsReportShareholder: false,

                        directorsReportGoingConcern:
                          reportOptions.directorsReportGoingConcern,
                        directorsReportLiquiditySolvency:
                          reportOptions.directorsReportLiquiditySolvency,
                        directorsReportLitigation:
                          reportOptions.directorsReportLitigation,
                        directorsReportSocialEthics:
                          reportOptions.directorsReportSocialEthics,
                        directorsReportSubsidiaries:
                          reportOptions.directorsReportSubsidiaries,
                        directorsReportAssociates:
                          reportOptions.directorsReportAssociates,
                        directorsReportJointVentures:
                          reportOptions.directorsReportJointVentures,
                        directorsReportNonCurrentAssets:
                          reportOptions.directorsReportNonCurrentAssets,
                        directorsReportAuthorisation:
                          reportOptions.directorsReportAuthorisation,
                      }}
                    />
                  </section>
                </AfsA4Page>
              ) : null}
            </div>
          ) : null}

          {reportOptions.compilerReport ? (
            <div id="print-compiler-report" className="afs-export-compiler-page">
              <article
                style={{
                  position: "relative",
                  width: "210mm",
                  minHeight: "297mm",
                  margin: "0 auto",
                  background: "#ffffff",
                  boxSizing: "border-box",
                  pageBreakAfter: "always",
                  breakAfter: "page",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    minHeight: "297mm",
                    padding: "16mm 17mm 16mm",
                    boxSizing: "border-box",
                    fontFamily:
                      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    color: "#111827",
                  }}
                >
                  <CompilationReportBlock context={narrativeContext} />
                </div>
              </article>
            </div>
          ) : null}

          {reportOptions.sfp ? (
            <div id="print-sfp">
              <AfsA4Page {...reportHeaderProps}>
                <AfsStatementTable
                  title={`Statement of Financial Position as at ${yearEnd}`}
                  currencyLabel="Figures in Rand"
                  currentHeading={currentHeading}
                  priorHeading={priorHeading}
                  rows={sfpRows}
                />
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.soci ? (
            <div id="print-soci">
              <AfsA4Page {...reportHeaderProps}>
                <AfsStatementTable
                  title="Statement of Comprehensive Income"
                  currencyLabel="Figures in Rand"
                  currentHeading={currentHeading}
                  priorHeading={priorHeading}
                  rows={sociRows}
                />
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.sce ? (
            <div id="print-sce">
              <AfsA4Page {...reportHeaderProps}>
                {renderSceCustomTable()}
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.cashFlow ? (
            <div id="print-cash-flow">
              <AfsA4Page {...reportHeaderProps}>
                {activeSectionId === "cash-flow" &&
                cashFlowViewMode === "work" &&
                !isPrintExportMode ? (
                  <section style={{ fontSize: 10, color: "#111827" }}>
                    <h1 style={pageHeadingStyle()}>Cash Flow Workbench</h1>
                    <p
                      style={{
                        margin: "0 0 10px",
                        color: "#64748b",
                        lineHeight: 1.4,
                      }}
                    >
                      Complete the current and prior year cash flow fields
                      below. The printable cash flow statement is shown in AFS
                      view.
                    </p>
                    <AfsStatementOverrideSettings
                      mode="cashFlow"
                      overrides={statementOverrides}
                      onChange={updateStatementOverride}
                      engineChecks={engineChecks}
                    />
                  </section>
                ) : (
                  <AfsStatementTable
                    title="Statement of Cash Flows"
                    currencyLabel="Figures in Rand"
                    currentHeading={currentHeading}
                    priorHeading={priorHeading}
                    rows={exportCashFlowRows}
                  />
                )}
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.accountingPolicies ? (
            <div id="print-accounting-policies">
              <AfsA4Page {...reportHeaderProps}>
                <section
                  style={{ fontSize: 9.2, lineHeight: 1.24, color: "#111827" }}
                >
                  <h1 style={pageHeadingStyle()}>Accounting Policies</h1>

                  {buildAccountingPolicyPrintItems().map((item, index) => {
                    if (item.type === "group") {
                      return (
                        <div key={item.groupKey}>
                          <h2 style={sectionHeadingStyle()}>
                            {index + 1}. {item.groupLabel}
                          </h2>

                          {item.sections.map((section) => {
                            const current = activeAccountingPolicyTexts[
                              section.key
                            ] ||
                              defaultAccountingPolicyTexts[section.key] || {
                                title: section.title || section.defaultTitle,
                                text: "",
                              };

                            const shortTitle = String(
                              current.title ||
                                section.label ||
                                section.title ||
                                section.defaultTitle,
                            )
                              .replace(`${item.groupLabel} - `, "")
                              .replace(`${item.groupLabel}: `, "")
                              .replace("Property, plant and equipment - ", "")
                              .replace("Financial instruments - ", "")
                              .replace("Leases - ", "")
                              .replace("Investment property - ", "")
                              .replace("Revenue - ", "");

                            return (
                              <div key={section.key}>
                                <h3 style={subsectionHeadingStyle()}>
                                  {shortTitle}
                                </h3>

                                {renderDisclosureText(
                                  current.text,
                                  disclosureTokens,
                                ).map((paragraph, paragraphIndex) => (
                                  <p
                                    key={`${section.key}-${paragraphIndex}`}
                                    style={paragraphStyle()}
                                  >
                                    {paragraph}
                                  </p>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    const current = activeAccountingPolicyTexts[
                      item.section.key
                    ] ||
                      defaultAccountingPolicyTexts[item.section.key] || {
                        title:
                          item.section.label ||
                          item.section.title ||
                          item.section.defaultTitle,
                        text: "",
                      };

                    return (
                      <div key={item.section.key}>
                        <h2 style={sectionHeadingStyle()}>
                          {index + 1}.{" "}
                          {current.title ||
                            item.section.label ||
                            item.section.title ||
                            item.section.defaultTitle}
                        </h2>

                        {renderDisclosureText(
                          current.text,
                          disclosureTokens,
                        ).map((paragraph, paragraphIndex) => (
                          <p
                            key={`${item.section.key}-${paragraphIndex}`}
                            style={paragraphStyle()}
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </section>
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.notes ? (
            <div id="print-notes">
              {printableNotePages.map((notePage, notePageIndex) => (
                <div
                  key={`print-notes-page-${notePageIndex}`}
                  id={notePageIndex === 0 ? "print-notes-page-1" : `print-notes-page-${notePageIndex + 1}`}
                  className="afs-export-controlled-page"
                >
                  {renderPrintableNotesPage(notePage, notePageIndex)}
                </div>
              ))}
            </div>
          ) : null}

          {reportOptions.detailedIncomeStatement ? (
            <div id="print-detailed-income">
              <AfsA4Page {...reportHeaderProps}>
                <div className="afs-export-fixed-width" style={{ width: "100%", minWidth: 0, display: "block" }}>
                <AfsStatementTable
                  title="Detailed Income Statement"
                  currencyLabel="Figures in Rand"
                  currentHeading={currentHeading}
                  priorHeading={priorHeading}
                  rows={detailedIncomeRows}
                />
                </div>
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.taxComputation ? (
            <div id="print-tax-computation">
              <AfsA4Page {...reportHeaderProps}>
                <section
                  style={{ fontSize: 11.2, lineHeight: 1.42, color: "#111827" }}
                >
                  <h1 style={pageHeadingStyle()}>Tax Computation</h1>

                  {(() => {
                    const profitBeforeTax = Number(
                      engineChecks.profitBeforeTax || 0,
                    );
                    const taxRateRaw = getSetupValue(clientSetup, [
                      "tax_rate",
                      "income_tax_rate",
                      "company_tax_rate",
                      "taxRate",
                      "incomeTaxRate",
                      "companyTaxRate",
                    ]);
                    const assessedLossRaw = getSetupValue(clientSetup, [
                      "assessed_loss",
                      "assessed_loss_brought_forward",
                      "assessedLoss",
                      "assessedLossBroughtForward",
                    ]);

                    const taxRate = Number(taxRateRaw || 27);
                    const assessedLoss = Number(assessedLossRaw || 0);
                    const taxableIncomeBeforeLoss = profitBeforeTax;
                    const lossUtilised = Math.min(
                      Math.max(taxableIncomeBeforeLoss, 0),
                      Math.max(assessedLoss, 0),
                    );
                    const taxableIncome = Math.max(
                      0,
                      taxableIncomeBeforeLoss - lossUtilised,
                    );
                    const normalTax = Math.round(
                      taxableIncome * (taxRate / 100),
                    );
                    const expectedTax = Math.round(
                      Math.max(profitBeforeTax, 0) * (taxRate / 100),
                    );
                    const taxDifference = normalTax - expectedTax;

                    const taxRows: Array<{
                      label: string;
                      current: number;
                      strong?: boolean;
                      rule?: boolean;
                    }> = [
                      {
                        label: "Profit / (loss) before taxation",
                        current: profitBeforeTax,
                        strong: true,
                      },
                      {
                        label: `Tax calculated at ${taxRate}%`,
                        current: expectedTax,
                      },
                      {
                        label: "Permanent / non-taxable differences",
                        current: 0,
                      },
                      {
                        label: "Assessed loss utilised",
                        current: -Math.abs(lossUtilised),
                      },
                      {
                        label: "Taxable income",
                        current: taxableIncome,
                        strong: true,
                        rule: true,
                      },
                      {
                        label: "Current tax",
                        current: normalTax,
                        strong: true,
                        rule: true,
                      },
                      {
                        label: "Tax rate reconciliation difference",
                        current: taxDifference,
                      },
                    ];

                    return (
                      <>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 10.2,
                            marginTop: 8,
                          }}
                        >
                          <thead>
                            <tr>
                              <th
                                style={{
                                  textAlign: "left",
                                  borderBottom: "1.5px solid #111827",
                                  padding: "3px 0",
                                }}
                              >
                                Description
                              </th>
                              <th
                                style={{
                                  textAlign: "right",
                                  borderBottom: "1.5px solid #111827",
                                  padding: "3px 0",
                                  width: 110,
                                }}
                              >
                                {currentHeading}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {taxRows.map((row) => (
                              <tr key={row.label}>
                                <td
                                  style={{
                                    padding: "3px 0",
                                    fontWeight: row.strong ? 800 : 400,
                                  }}
                                >
                                  {row.label}
                                </td>
                                <td
                                  style={{
                                    padding: "3px 0",
                                    textAlign: "right",
                                    fontWeight: row.strong ? 800 : 400,
                                    borderTop: row.rule
                                      ? "1px solid #111827"
                                      : undefined,
                                    borderBottom: row.rule
                                      ? "2px solid #111827"
                                      : undefined,
                                  }}
                                >
                                  {taxAmount(Number(row.current))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <p
                          style={{
                            marginTop: 12,
                            fontSize: 10.2,
                            lineHeight: 1.35,
                            color: "#374151",
                          }}
                        >
                          Tax computation is prepared from the mapped profit
                          before tax and the tax settings captured in Client
                          Setup.
                        </p>
                      </>
                    );
                  })()}
                </section>
              </AfsA4Page>
            </div>
          ) : null}
        </>
      )}

    </main>
  );
}
