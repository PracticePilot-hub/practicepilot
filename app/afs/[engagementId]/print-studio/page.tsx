"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import AfsPrintStudioShell, {
  AfsReportOption,
  AfsStudioSection,
} from "../components/AfsPrintStudioShell";
import AfsA4Page from "../components/AfsA4Page";
import AfsStatementTable, {
  AfsStatementRow,
} from "../components/AfsStatementTable";
import AfsDirectorsReportSettings from "../components/AfsDirectorsReportSettings";
import AfsEditableDisclosureSettings from "../components/AfsEditableDisclosureSettings";
import AfsStatementOverrideSettings from "../components/AfsStatementOverrideSettings";
import AfsStructuredNotesPanel from "./AfsStructuredNotesPanel";
import AfsFlightDeck, {
  buildAfsFlightDeckIssuesFromEngine,
} from "./AfsFlightDeck";
import {
  DirectorsResponsibilitiesBlock,
  DirectorsReportBlock,
  CompilationReportBlock,
  buildDefaultDirectorsReportTexts,
  getActiveDirectorsReportSectionKeys,
} from "../components/AfsNarrativeBlocks";

import type {
  DirectorsReportSectionKey,
  DirectorsReportTextOverrides,
} from "../components/AfsNarrativeBlocks";
import {
  accountingPolicySections,
  noteSections,
  buildDefaultAccountingPolicyTexts,
  buildDefaultNoteTexts,
  renderDisclosureText,
  EditableDisclosureTextMap,
} from "../components/AfsPolicyNoteDefaults";
import {
  buildAfsPrintStatementEngine,
  AfsStatementOverrides,
  AfsNoteKey,
} from "../components/AfsPrintStatementEngine";
import {
  getAfsEntityPresentation,
  getAfsEntityRowLabel,
} from "../afsEntityPresentation";

type EngagementData = {
  id: string;
  client_name: string;
  entity_type: string | null;
  financial_year_end: string;
  status: string;
};

type TaxCalculationData = {
  tax_year?: string | null;
  tax_regime?: "normal" | "sbc" | string | null;
  accounting_profit?: number | null;
  permanent_differences?: number | null;
  temporary_differences?: number | null;
  assessed_loss_bf?: number | null;
  taxable_income?: number | null;
  tax_rate?: number | null;
  current_tax?: number | null;
  provisional_tax_paid?: number | null;
  tax_payable?: number | null;
  deferred_tax?: number | null;
  notes?: string | null;
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


function formatAfsDisplayDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return raw;

  const [, year, month, day] = isoMatch;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function professionalStatementLabel(value: unknown) {
  const label = String(value || "").trim();

  const exactLabels: Record<string, string> = {
    "Cost Of Sales": "Cost of sales",
    "Share Capital": "Share capital",
    "Retained Income / Accumulated Loss": "Accumulated loss",
    "Retained income / accumulated loss": "Accumulated loss",
  };

  return exactLabels[label] || label;
}

function applyProfessionalStatementLabels(rows: AfsStatementRow[]) {
  return (rows || []).map((row: any) => ({
    ...row,
    label: professionalStatementLabel(row?.label),
  }));
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

type TrialBalanceHistoryLine = {
  id?: string;
  financial_year_end: string;
  account_code: string;
  account_name: string;
  closing_balance: number;
  mapping_code?: string | null;
  mapping_leaf_id?: string | null;
  mapping_label?: string | null;
  mapping_statement?: string | null;
  mapping_section?: string | null;
  mapping_path?: string | null;
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
  hideComparativeFigures: boolean;

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
  notesRightOfUseAssets: boolean;
  notesGoodwill: boolean;
  notesInvestmentProperty: boolean;
  notesIntangibleAssets: boolean;
  notesBiologicalAssets: boolean;
  notesInvestmentsSubsidiaries: boolean;
  notesInvestmentsAssociates: boolean;
  notesInvestmentsJointVentures: boolean;
  notesOtherInvestments: boolean;
  notesOtherFinancialAssets: boolean;
  notesOtherNonCurrentAssets: boolean;
  notesLoansReceivable: boolean;
  notesInventories: boolean;
  notesContractAssets: boolean;
  notesTradeReceivables: boolean;
  notesTaxStatutoryReceivables: boolean;
  notesCurrentTaxReceivable: boolean;
  notesCashAndCashEquivalents: boolean;
  notesAssetsHeldForSale: boolean;

  notesShareCapital: boolean;
  notesRetainedIncome: boolean;
  notesReserves: boolean;
  notesNonControllingInterests: boolean;
  notesOtherEquity: boolean;

  notesProvisions: boolean;
  notesEmployeeBenefitObligations: boolean;
  notesDeferredIncomeGrants: boolean;
  notesGroupRelatedPartyBorrowings: boolean;
  notesShareholdersLoans: boolean;
  notesBorrowings: boolean;
  notesAssetFinance: boolean;
  notesLeaseLiabilities: boolean;
  notesOtherFinancialLiabilities: boolean;
  notesSupplierFinance: boolean;
  notesDeferredTaxLiability: boolean;
  notesBankOverdraft: boolean;
  notesTradePayables: boolean;
  notesContractLiabilities: boolean;
  notesDividendPayable: boolean;
  notesTaxStatutoryPayables: boolean;
  notesCurrentTaxPayable: boolean;
  notesLiabilitiesHeldForSale: boolean;

  notesRevenue: boolean;
  notesCostOfSales: boolean;
  notesOtherOperatingIncome: boolean;
  notesInvestmentIncome: boolean;
  notesOperatingExpenses: boolean;
  notesFinanceCosts: boolean;
  notesOtherGainsLosses: boolean;
  notesTaxation: boolean;
  notesOtherComprehensiveIncome: boolean;
  notesDiscontinuedOperations: boolean;

  notesCashUsedInOperations: boolean;
  notesGoingConcern: boolean;
  notesRelatedParties: boolean;
  notesCommitmentsContingencies: boolean;
  notesEventsAfterReportingPeriod: boolean;

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
  hideComparativeFigures: false,

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
  notesRightOfUseAssets: false,
  notesGoodwill: false,
  notesInvestmentProperty: false,
  notesIntangibleAssets: false,
  notesBiologicalAssets: false,
  notesInvestmentsSubsidiaries: false,
  notesInvestmentsAssociates: false,
  notesInvestmentsJointVentures: false,
  notesOtherInvestments: false,
  notesOtherFinancialAssets: false,
  notesOtherNonCurrentAssets: true,
  notesLoansReceivable: false,
  notesInventories: true,
  notesContractAssets: false,
  notesTradeReceivables: false,
  notesTaxStatutoryReceivables: false,
  notesCurrentTaxReceivable: false,
  notesCashAndCashEquivalents: true,
  notesAssetsHeldForSale: false,

  notesShareCapital: true,
  notesRetainedIncome: false,
  notesReserves: false,
  notesNonControllingInterests: false,
  notesOtherEquity: false,

  notesProvisions: false,
  notesEmployeeBenefitObligations: false,
  notesDeferredIncomeGrants: false,
  notesGroupRelatedPartyBorrowings: false,
  notesShareholdersLoans: true,
  notesBorrowings: false,
  notesAssetFinance: false,
  notesLeaseLiabilities: false,
  notesOtherFinancialLiabilities: false,
  notesSupplierFinance: false,
  notesDeferredTaxLiability: false,
  notesBankOverdraft: false,
  notesTradePayables: false,
  notesContractLiabilities: false,
  notesDividendPayable: false,
  notesTaxStatutoryPayables: false,
  notesCurrentTaxPayable: false,
  notesLiabilitiesHeldForSale: false,

  notesRevenue: false,
  notesCostOfSales: false,
  notesOtherOperatingIncome: false,
  notesInvestmentIncome: false,
  notesOperatingExpenses: true,
  notesFinanceCosts: false,
  notesOtherGainsLosses: false,
  notesTaxation: false,
  notesOtherComprehensiveIncome: false,
  notesDiscontinuedOperations: false,

  notesCashUsedInOperations: true,
  notesGoingConcern: false,
  notesRelatedParties: false,
  notesCommitmentsContingencies: false,
  notesEventsAfterReportingPeriod: false,

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

/*
  Legacy local SFP/SOCI builders removed.

  Print Studio statements are now sourced from AfsPrintStatementEngine,
  where statement and note classification is mapping_code-only.
*/

function lineSearchText(line: TrialBalanceLine) {
  /*
    AFS statements must be driven by the selected mapping, not by account names.
    Account names may contain practical suffixes like (IS) or (SFP), but those
    must not decide where the line appears in the statements.
  */
  return [
    line.mapping_statement,
    line.mapping_section,
    line.mapping_path,
    line.mapping_category,
    line.mapping_label,
    line.mapping_code,
    line.lead_schedule_key,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}


function getSetupValue(setup: ClientSetupData | null, keys: string[]) {
  if (!setup) return "";

  for (const key of keys) {
    const value = setup[key];

    if (Array.isArray(value) && value.length > 0) return value;

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
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
    person.full_name ||
    person.person_name ||
    person.name ||
    "Name not captured"
  );
}

function isDirectorLike(person: PersonData) {
  const role = String(
    person.role ||
      person.type ||
      person.designation ||
      person.capacity ||
      person.person_type ||
      ""
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

function renderInfoRow(
  label: string,
  value: unknown,
  keepAsSentence = false,
) {
  const lines = keepAsSentence
    ? [String(value || "").replace(/\s*\n\s*/g, " ").trim()].filter(Boolean)
    : formatMultiline(value);

  if (!lines.length) return null;

  return (
    <tr key={label}>
      <td
        style={{
          width: "36%",
          padding: "5px 0",
          fontWeight: 700,
          verticalAlign: "top",
        }}
      >
        {label}
      </td>
      <td style={{ padding: "5px 0", verticalAlign: "top" }}>
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
    fontWeight: 700,
    margin: "16px 0 6px",
  };
}

function subsectionHeadingStyle() {
  return {
    fontSize: 11,
    lineHeight: 1.3,
    fontWeight: 700,
    margin: "10px 0 4px",
  };
}

function pageHeadingStyle() {
  return {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 16,
    lineHeight: 1.12,
    fontWeight: 600,
    margin: "0 0 12px",
    paddingBottom: 6,
    borderBottom: "1px solid #000000",
    letterSpacing: 0,
    textTransform: "none" as const,
  };
}


function isGenericNoteText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .includes("this note is generated from the mapped trial balance");
}

function cleanNoteTextMap(
  input: EditableDisclosureTextMap
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



function alignDetailedIncomeRowsToSoci(
  detailedRows: AfsStatementRow[],
  sociRows: AfsStatementRow[],
) {
  const sociProfitBeforeTaxRow = (sociRows || []).find((row: any) =>
    String(row?.label || "").toLowerCase().trim() ===
    "profit / (loss) before taxation",
  ) as any;

  const sociProfitForYearRow = (sociRows || []).find((row: any) =>
    String(row?.label || "").toLowerCase().trim() ===
    "profit / (loss) for the year",
  ) as any;

  return (detailedRows || []).map((row: any) => {
    const label = String(row?.label || "").toLowerCase().trim();

    if (label === "profit / (loss) before taxation" && sociProfitBeforeTaxRow) {
      return {
        ...row,
        current: Math.round(Number(sociProfitBeforeTaxRow.current || 0)),
        prior: Math.round(Number(sociProfitBeforeTaxRow.prior || 0)),
      };
    }

    if (label === "profit / (loss) for the year" && sociProfitForYearRow) {
      return {
        ...row,
        current: Math.round(Number(sociProfitForYearRow.current || 0)),
        prior: Math.round(Number(sociProfitForYearRow.prior || 0)),
      };
    }

    return row;
  });
}


function normaliseMappingIdentifier(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function mappingIdentifierStartsWith(value: unknown, prefixes: string[]) {
  const identifier = normaliseMappingIdentifier(value);

  return prefixes.some((prefix) => {
    const cleanPrefix = normaliseMappingIdentifier(prefix);

    return (
      identifier === cleanPrefix ||
      identifier.startsWith(`${cleanPrefix}.`) ||
      identifier.startsWith(`${cleanPrefix}-`)
    );
  });
}

function historyCategory(line: TrialBalanceHistoryLine) {
  const mappingCode = normaliseMappingIdentifier(line.mapping_code);
  const mappingLeafId = normaliseMappingIdentifier(line.mapping_leaf_id);
  const leadScheduleNumber = normaliseMappingIdentifier(
    line.lead_schedule_number,
  );
  const leadScheduleKey = normaliseMappingIdentifier(line.lead_schedule_key);

  /*
    Historical cash-flow classification is mapping-driven only.
    Account names and mapping labels are never used.
  */
  if (
    mappingCode === "420.10" ||
    mappingLeafId.startsWith("420-10-") ||
    leadScheduleKey === "cash"
  ) {
    return "cash";
  }

  if (
    mappingIdentifierStartsWith(mappingCode, ["405"]) ||
    mappingIdentifierStartsWith(mappingLeafId, ["405"]) ||
    leadScheduleKey === "inventories"
  ) {
    return "inventories";
  }

  if (
    mappingIdentifierStartsWith(mappingCode, ["430"]) ||
    mappingIdentifierStartsWith(mappingLeafId, ["430"]) ||
    leadScheduleKey === "trade-receivables" ||
    leadScheduleKey === "trade-and-other-receivables"
  ) {
    return "tradeReceivables";
  }

  if (
    mappingIdentifierStartsWith(mappingCode, ["630"]) ||
    mappingIdentifierStartsWith(mappingLeafId, ["630"]) ||
    leadScheduleKey === "trade-payables" ||
    leadScheduleKey === "trade-and-other-payables"
  ) {
    return "tradePayables";
  }

  if (
    mappingCode === "495.10" ||
    mappingLeafId.startsWith("495-10-")
  ) {
    return "currentTaxReceivable";
  }

  if (
    mappingCode === "695.10" ||
    mappingLeafId.startsWith("695-10-")
  ) {
    return "currentTaxPayable";
  }

  if (
    mappingCode === "795.10" ||
    mappingLeafId.startsWith("795-10-")
  ) {
    return "currentTaxExpense";
  }

  if (
    mappingIdentifierStartsWith(mappingCode, ["500"]) ||
    mappingIdentifierStartsWith(mappingLeafId, ["500"]) ||
    leadScheduleKey === "share-capital"
  ) {
    return "shareCapital";
  }

  if (
    mappingIdentifierStartsWith(mappingCode, ["548", "500.548"]) ||
    mappingIdentifierStartsWith(mappingLeafId, ["548", "500-548"]) ||
    leadScheduleKey === "shareholders-loans" ||
    leadScheduleKey === "shareholder-loans"
  ) {
    return "shareholderLoans";
  }

  if (
    mappingIdentifierStartsWith(mappingCode, ["590", "500.590"]) ||
    mappingIdentifierStartsWith(mappingLeafId, ["590", "500-590"]) ||
    leadScheduleKey === "other-financial-liabilities" ||
    leadScheduleKey === "other-non-current-liabilities"
  ) {
    return "otherFinancialLiabilities";
  }

  return "other";
}

function historyPresentedBalance(line: TrialBalanceHistoryLine) {
  const category = historyCategory(line);
  const raw = safeNumber(line.closing_balance);

  if (
    category === "tradePayables" ||
    category === "currentTaxPayable" ||
    category === "shareCapital" ||
    category === "shareholderLoans" ||
    category === "otherFinancialLiabilities"
  ) {
    return -raw;
  }

  return raw;
}

type HistoricalCashFlowData = {
  overrides: Partial<AfsStatementOverrides>;
  hasTwoDistinctYears: boolean;
  inventoryPrior: number;
  receivablesPrior: number;
  payablesPrior: number;
  taxPaidPrior: number;
};

function buildHistoricalCashFlowData(
  history: TrialBalanceHistoryLine[],
): HistoricalCashFlowData {
  const years = Array.from(
    new Set(
      (history || [])
        .map((line) => String(line.financial_year_end || "").trim())
        .filter(Boolean),
    ),
  ).sort();

  if (years.length < 2) {
    return {
      overrides: {},
      hasTwoDistinctYears: false,
      inventoryPrior: 0,
      receivablesPrior: 0,
      payablesPrior: 0,
      taxPaidPrior: 0,
    };
  }

  const openingYear = years[years.length - 2];
  const closingYear = years[years.length - 1];

  const totalFor = (year: string, category: string) =>
    (history || [])
      .filter(
        (line) =>
          String(line.financial_year_end || "").trim() === year &&
          historyCategory(line) === category,
      )
      .reduce((sum, line) => sum + historyPresentedBalance(line), 0);

  const openingCash = totalFor(openingYear, "cash");
  const closingCash = totalFor(closingYear, "cash");

  const openingInventory = totalFor(openingYear, "inventories");
  const closingInventory = totalFor(closingYear, "inventories");

  const openingReceivables = totalFor(openingYear, "tradeReceivables");
  const closingReceivables = totalFor(closingYear, "tradeReceivables");

  const openingPayables = totalFor(openingYear, "tradePayables");
  const closingPayables = totalFor(closingYear, "tradePayables");

  const openingShareCapital = totalFor(openingYear, "shareCapital");
  const closingShareCapital = totalFor(closingYear, "shareCapital");

  const openingShareholderLoans = totalFor(openingYear, "shareholderLoans");
  const closingShareholderLoans = totalFor(closingYear, "shareholderLoans");

  const openingOtherFinancialLiabilities = totalFor(
    openingYear,
    "otherFinancialLiabilities",
  );
  const closingOtherFinancialLiabilities = totalFor(
    closingYear,
    "otherFinancialLiabilities",
  );

  const inventoryPrior = openingInventory - closingInventory;
  const receivablesPrior = openingReceivables - closingReceivables;
  const payablesPrior = closingPayables - openingPayables;

  const openingCurrentTaxReceivable = totalFor(
    openingYear,
    "currentTaxReceivable",
  );
  const closingCurrentTaxReceivable = totalFor(
    closingYear,
    "currentTaxReceivable",
  );

  const openingCurrentTaxPayable = totalFor(
    openingYear,
    "currentTaxPayable",
  );
  const closingCurrentTaxPayable = totalFor(
    closingYear,
    "currentTaxPayable",
  );

  const currentTaxExpensePrior = Math.abs(
    totalFor(closingYear, "currentTaxExpense"),
  );

  const calculatedTaxPaidPrior =
    openingCurrentTaxPayable -
    openingCurrentTaxReceivable +
    currentTaxExpensePrior -
    closingCurrentTaxPayable +
    closingCurrentTaxReceivable;

  const taxPaidPrior =
    calculatedTaxPaidPrior === 0
      ? 0
      : -Math.abs(calculatedTaxPaidPrior);

  return {
    hasTwoDistinctYears: true,
    overrides: {
      cashPriorOpeningBalance: openingCash,
      cashWorkingCapitalPrior:
        inventoryPrior + receivablesPrior + payablesPrior,
      cashLoansRaisedPrior:
        closingShareholderLoans - openingShareholderLoans,
      /*
        Do not infer "Other financing cash flows" from SFP balances.
        That row is reserved for an explicit workbench amount.
      */
      cashPriorMovement: closingCash - openingCash,
    },
    inventoryPrior,
    receivablesPrior,
    payablesPrior,
    taxPaidPrior,
  };
}


function isCloseCorporationEntityType(value: unknown) {
  const lower = String(value || "").trim().toLowerCase();

  return (
    lower === "cc" ||
    lower.includes("close corporation") ||
    lower.includes("close-corporation")
  );
}

function isTrustEntityType(value: unknown) {
  return String(value || "").trim().toLowerCase().includes("trust");
}

function isShareCapitalNoteSection(section: any) {
  const key = String(section?.key || "").toLowerCase();
  const optionKey = String(section?.optionKey || "").toLowerCase();
  const label = String(
    section?.label || section?.title || section?.defaultTitle || "",
  ).toLowerCase();

  return (
    key.includes("sharecapital") ||
    optionKey.includes("sharecapital") ||
    label.includes("share capital")
  );
}

function ccMemberPossessive(memberCount: number) {
  return memberCount === 1 ? "Member's" : "Members'";
}

function ccMemberCollective(memberCount: number) {
  return memberCount === 1 ? "member" : "members";
}

function CcMembersResponsibilitiesBlock({
  clientName,
  yearEnd,
  approvalDate,
  members,
}: {
  clientName: string;
  yearEnd: string;
  approvalDate: string;
  members: PersonData[];
}) {
  const memberCount = Math.max(1, members.length);
  const memberWord = ccMemberCollective(memberCount);
  const memberWordCapitalised =
    memberWord.charAt(0).toUpperCase() + memberWord.slice(1);

  return (
    <div>
      <p style={paragraphStyle()}>
        The {memberWord} {memberCount === 1 ? "is" : "are"} responsible for the
        maintenance of adequate accounting records and for the preparation and
        integrity of the annual financial statements and related information.
        The accounting officer is responsible for determining that the annual
        financial statements are in agreement with the accounting records,
        summarised in the manner required by section 58(2)(d) of the Close
        Corporations Act of South Africa.
      </p>

      <p style={paragraphStyle()}>
        The {memberWord} {memberCount === 1 ? "is" : "are"} also responsible for
        the close corporation&apos;s system of internal financial control. These
        controls are designed to provide reasonable, but not absolute, assurance
        as to the reliability of the annual financial statements, to safeguard
        and maintain accountability for assets, and to prevent and detect
        material misstatement and loss.
      </p>

      <p style={paragraphStyle()}>
        The annual financial statements have been prepared on the going concern
        basis because the {memberWord} {memberCount === 1 ? "believes" : "believe"}{" "}
        that {clientName} has adequate resources to continue in operation for the
        foreseeable future.
      </p>

      <p style={paragraphStyle()}>
        The annual financial statements for the year ended {yearEnd} were
        approved by the {memberWord} on {approvalDate || "________________"} and
        are signed below by the {memberWord} or on their behalf.
      </p>

      <h2 style={sectionHeadingStyle()}>Approval of annual financial statements</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            members.length > 1 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 280px)",
          gap: "28px 44px",
          marginTop: 30,
        }}
      >
        {(members.length ? members : [{ full_name: memberWordCapitalised }]).map(
          (member: PersonData, index: number) => (
            <div key={member.id || `${getPersonName(member)}-${index}`}>
              <div
                style={{
                  width: "100%",
                  borderTop: "1px solid #111827",
                  paddingTop: 5,
                  fontWeight: 700,
                }}
              >
                {getPersonName(member)}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function CcMembersReportBlock({
  clientName,
  yearEnd,
  members,
}: {
  clientName: string;
  yearEnd: string;
  members: PersonData[];
}) {
  const memberCount = Math.max(1, members.length);
  const memberWord = ccMemberCollective(memberCount);

  return (
    <div>
      <p style={paragraphStyle()}>
        The {memberWord} {memberCount === 1 ? "submits" : "submit"}{" "}
        {memberCount === 1 ? "his or her" : "their"} report for the year ended{" "}
        {yearEnd}.
      </p>

      <h2 style={sectionHeadingStyle()}>1. Going concern</h2>
      <p style={paragraphStyle()}>
        The annual financial statements have been prepared on the basis of
        accounting policies applicable to a going concern. The {memberWord}{" "}
        {memberCount === 1 ? "believes" : "believe"} that {clientName} has
        adequate financial resources to continue in operation for the foreseeable
        future and has considered the close corporation&apos;s financial position,
        commitments and expected cash requirements.
      </p>

      <h2 style={sectionHeadingStyle()}>2. Events after the reporting period</h2>
      <p style={paragraphStyle()}>
        The {memberWord} {memberCount === 1 ? "has" : "have"} considered events
        occurring after the reporting date and up to the date on which these
        annual financial statements are approved. Any material matter requiring
        adjustment or disclosure is reflected in the annual financial statements.
      </p>

      <h2 style={sectionHeadingStyle()}>3. Member&apos;s contribution</h2>
      <p style={paragraphStyle()}>
        Details of the member&apos;s contribution and any movement during the
        accounting period are disclosed in the annual financial statements and
        related notes.
      </p>

      <h2 style={sectionHeadingStyle()}>
        4. {memberCount === 1 ? "Member" : "Members"}
      </h2>

      <div style={{ marginTop: 6 }}>
        {(members.length ? members : [{ full_name: "Member not captured" }]).map(
          (member: PersonData, index: number) => (
            <div
              key={member.id || `${getPersonName(member)}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 12,
                padding: "4px 0",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <span style={{ fontWeight: 700 }}>Name</span>
              <span>{getPersonName(member)}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function TrustTrusteesResponsibilitiesBlock({
  clientName,
  yearEnd,
  approvalDate,
  trustees,
}: {
  clientName: string;
  yearEnd: string;
  approvalDate: string;
  trustees: PersonData[];
}) {
  const trusteeCount = Math.max(1, trustees.length);
  const trusteeWord = trusteeCount === 1 ? "trustee" : "trustees";

  return (
    <div>
      <p style={paragraphStyle()}>
        The {trusteeWord} {trusteeCount === 1 ? "is" : "are"} responsible for the
        maintenance of adequate accounting records and for the preparation and
        integrity of the annual financial statements and related information.
      </p>

      <p style={paragraphStyle()}>
        The {trusteeWord} {trusteeCount === 1 ? "is" : "are"} also responsible for
        the trust&apos;s system of internal financial control. These controls are
        designed to provide reasonable, but not absolute, assurance as to the
        reliability of the annual financial statements, to safeguard and maintain
        accountability for the trust&apos;s assets, and to prevent and detect material
        misstatement and loss.
      </p>

      <p style={paragraphStyle()}>
        The annual financial statements have been prepared on the going concern
        basis because the {trusteeWord} {trusteeCount === 1 ? "believes" : "believe"}{" "}
        that {clientName} has adequate resources to continue in operation for the
        foreseeable future.
      </p>

      <p style={paragraphStyle()}>
        The annual financial statements for the year ended {yearEnd} were approved
        by the {trusteeWord} on {approvalDate || "________________"} and are signed
        below by the {trusteeWord} or on their behalf.
      </p>

      <h2 style={sectionHeadingStyle()}>Approval of annual financial statements</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            trustees.length > 1 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 280px)",
          gap: "28px 44px",
          marginTop: 30,
        }}
      >
        {(trustees.length ? trustees : [{ full_name: "Trustee" }]).map(
          (trustee: PersonData, index: number) => (
            <div key={trustee.id || `${getPersonName(trustee)}-${index}`}>
              <div
                style={{
                  width: "100%",
                  borderTop: "1px solid #111827",
                  paddingTop: 5,
                  fontWeight: 700,
                }}
              >
                {getPersonName(trustee)}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function TrustTrusteesReportBlock({
  clientName,
  yearEnd,
  trustees,
}: {
  clientName: string;
  yearEnd: string;
  trustees: PersonData[];
}) {
  const trusteeCount = Math.max(1, trustees.length);
  const trusteeWord = trusteeCount === 1 ? "trustee" : "trustees";

  return (
    <div>
      <p style={paragraphStyle()}>
        The {trusteeWord} {trusteeCount === 1 ? "submits" : "submit"}{" "}
        {trusteeCount === 1 ? "his or her" : "their"} report for the year ended{" "}
        {yearEnd}.
      </p>

      <h2 style={sectionHeadingStyle()}>1. Nature of the trust and its activities</h2>
      <p style={paragraphStyle()}>
        {clientName} is administered by the trustees in accordance with the trust
        deed and the Trust Property Control Act 57 of 1988, as amended.
      </p>

      <h2 style={sectionHeadingStyle()}>2. Going concern</h2>
      <p style={paragraphStyle()}>
        The annual financial statements have been prepared on the basis of
        accounting policies applicable to a going concern. The {trusteeWord}{" "}
        {trusteeCount === 1 ? "believes" : "believe"} that {clientName} has
        adequate financial resources to continue in operation for the foreseeable
        future and has considered the trust&apos;s financial position, commitments and
        expected cash requirements.
      </p>

      <h2 style={sectionHeadingStyle()}>3. Events after the reporting period</h2>
      <p style={paragraphStyle()}>
        The {trusteeWord} {trusteeCount === 1 ? "has" : "have"} considered events
        occurring after the reporting date and up to the date on which these annual
        financial statements are approved. Any material matter requiring adjustment
        or disclosure is reflected in the annual financial statements.
      </p>

      <h2 style={sectionHeadingStyle()}>4. Trust capital and accumulated funds</h2>
      <p style={paragraphStyle()}>
        Details of the trust capital, accumulated funds and movements during the
        reporting period are disclosed in the annual financial statements and
        related notes.
      </p>

      <h2 style={sectionHeadingStyle()}>
        5. {trusteeCount === 1 ? "Trustee" : "Trustees"}
      </h2>

      <div style={{ marginTop: 6 }}>
        {(trustees.length ? trustees : [{ full_name: "Trustee not captured" }]).map(
          (trustee: PersonData, index: number) => (
            <div
              key={trustee.id || `${getPersonName(trustee)}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 12,
                padding: "4px 0",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <span style={{ fontWeight: 700 }}>Name</span>
              <span>{getPersonName(trustee)}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function CcAccountingOfficerReportBlock({
  clientName,
  yearEnd,
  members,
  practitionerFirm,
  practitionerName,
  practitionerDesignation,
  compilationDate,
  place,
  practitionerLogoUrl,
  practitionerFooterLogoUrl,
  practitionerAddressLines,
  practitionerTelephone,
  practitionerEmail,
  practitionerWebsite,
  governingBodyName,
  governingBodyRegistrationNumber,
  governingBodyLogoUrl,
  secondGoverningBodyName,
  secondGoverningBodyRegistrationNumber,
  secondGoverningBodyLogoUrl,
  practitionerFooterText,
}: {
  clientName: string;
  yearEnd: string;
  members: PersonData[];
  practitionerFirm: string;
  practitionerName: string;
  practitionerDesignation: string;
  compilationDate: string;
  place: string;
  practitionerLogoUrl?: string;
  practitionerFooterLogoUrl?: string;
  practitionerAddressLines?: string;
  practitionerTelephone?: string;
  practitionerEmail?: string;
  practitionerWebsite?: string;
  governingBodyName?: string;
  governingBodyRegistrationNumber?: string;
  governingBodyLogoUrl?: string;
  secondGoverningBodyName?: string;
  secondGoverningBodyRegistrationNumber?: string;
  secondGoverningBodyLogoUrl?: string;
  practitionerFooterText?: string;
}) {
  const memberCount = Math.max(1, members.length);
  const memberWord = memberCount === 1 ? "Member" : "Members";
  const addressLines = practitionerAddressLines
    ? formatMultiline(practitionerAddressLines)
    : [];

  return (
    <section
      style={{
        position: "relative",
        minHeight: "265mm",
        paddingBottom: 0,
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 10.1,
        lineHeight: 1.34,
        color: "#111827",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 58mm",
          alignItems: "center",
          columnGap: 18,
          margin: "0 0 14px",
          paddingBottom: 8,
          borderBottom: "1.25px solid #111827",
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        <div
          style={{
            minHeight: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          {practitionerLogoUrl ? (
            <img
              src={practitionerLogoUrl}
              alt={`${practitionerFirm || "Firm"} logo`}
              style={{
                width: "62mm",
                maxWidth: "100%",
                height: "auto",
                maxHeight: "23mm",
                objectFit: "contain",
                objectPosition: "left center",
                display: "block",
              }}
            />
          ) : null}
        </div>

        <div
          style={{
            textAlign: "right",
            fontSize: 8.5,
            lineHeight: 1.25,
            color: "#111827",
          }}
        >
          {practitionerFirm ? (
            <div style={{ fontWeight: 900, marginBottom: 3 }}>
              {practitionerFirm}
            </div>
          ) : null}

          {addressLines.map((line, index) => (
            <div key={`ao-top-address-${index}`}>{line}</div>
          ))}

          {practitionerTelephone ? (
            <div>
              Tel: {String(practitionerTelephone).replace(/^Tel:\s*/i, "")}
            </div>
          ) : null}

          {practitionerEmail ? (
            <div>
              Email: {String(practitionerEmail).replace(/^Email:\s*/i, "")}
            </div>
          ) : null}

          {practitionerWebsite ? <div>{practitionerWebsite}</div> : null}
        </div>
      </div>

      <h1
        style={{
          fontSize: 13.5,
          lineHeight: 1.25,
          fontWeight: 900,
          margin: "0 0 13px",
          paddingBottom: 7,
          borderBottom: "1.25px solid #111827",
        }}
      >
        Accounting Officer&apos;s Report
      </h1>

      <p style={{ ...paragraphStyle(), fontWeight: 700 }}>
        To the {memberWord} of {clientName}
      </p>

      <p style={paragraphStyle()}>
        We have performed the duties of accounting officer to {clientName} for
        the year ended {yearEnd} as required by section 62 of the Close
        Corporations Act of South Africa. The annual financial statements are the
        responsibility of the {memberCount === 1 ? "member" : "members"}.
      </p>

      <p style={paragraphStyle()}>
        No audit or review was conducted. Accordingly, we do not express an audit
        opinion, review conclusion or any other form of assurance on these annual
        financial statements.
      </p>

      <h2 style={sectionHeadingStyle()}>Duties of the Accounting Officer</h2>

      <p style={paragraphStyle()}>
        We report, as required in terms of section 62(1) of the Close
        Corporations Act of South Africa, having performed such procedures and
        conducted such enquiries in relation to the accounting records as we
        considered necessary in the circumstances, that:
      </p>

      <ul
        style={{
          margin: "0 0 18px 18px",
          padding: 0,
          display: "grid",
          gap: 7,
        }}
      >
        <li>
          the annual financial statements are in agreement with the accounting
          records, summarised in the manner required by section 58(2)(d) of the
          Close Corporations Act of South Africa; and
        </li>
        <li>
          the accounting policies presented to us as having been applied in the
          preparation of the annual financial statements are appropriate to the
          business.
        </li>
      </ul>

      <div
        style={{
          marginTop: 26,
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        <div
          style={{
            borderTop: "1px solid #111827",
            height: 1,
            marginBottom: 6,
            width: "58mm",
            maxWidth: "58mm",
          }}
        />

        {practitionerFirm ? (
          <p style={paragraphStyle()}>
            <strong>{practitionerFirm}</strong>
          </p>
        ) : null}

        <p style={paragraphStyle()}>
          <strong>{practitionerName}</strong>
        </p>

        {practitionerDesignation ? (
          <p style={paragraphStyle()}>{practitionerDesignation}</p>
        ) : null}

        <p style={paragraphStyle()}>
          {compilationDate || "________________"}
        </p>

        {place ? <p style={paragraphStyle()}>{place}</p> : null}
      </div>

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr 45mm",
          gap: 14,
          alignItems: "center",
          marginTop: "auto",
          paddingTop: 10,
          borderTop: "1px solid #111827",
          fontSize: 9.2,
          lineHeight: 1.3,
          color: "#111827",
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 4,
            justifyItems: "start",
            textAlign: "left",
          }}
        >
          <strong>{practitionerName}</strong>

          {practitionerDesignation ? (
            <div>{practitionerDesignation}</div>
          ) : null}

          {practitionerFooterText ? (
            <div style={{ fontWeight: 900, marginTop: 3 }}>
              {practitionerFooterText}
            </div>
          ) : governingBodyName ? (
            <div style={{ fontWeight: 900, marginTop: 3 }}>
              {[governingBodyName, governingBodyRegistrationNumber]
                .filter(Boolean)
                .join(" ")}
            </div>
          ) : null}

          {secondGoverningBodyName ? (
            <div style={{ fontWeight: 900, marginTop: 3 }}>
              {[secondGoverningBodyName, secondGoverningBodyRegistrationNumber]
                .filter(Boolean)
                .join(" ")}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            minHeight: 24,
          }}
        >
          {governingBodyLogoUrl ? (
            <img
              src={governingBodyLogoUrl}
              alt={governingBodyName || "Professional body"}
              style={{
                maxWidth: "32mm",
                maxHeight: "11mm",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : null}

          {secondGoverningBodyLogoUrl ? (
            <img
              src={secondGoverningBodyLogoUrl}
              alt={secondGoverningBodyName || "Professional body"}
              style={{
                maxWidth: "32mm",
                maxHeight: "11mm",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : null}

          {practitionerFooterLogoUrl ? (
            <img
              src={practitionerFooterLogoUrl}
              alt=""
              style={{
                maxWidth: "36mm",
                maxHeight: "10mm",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                objectPosition: "right center",
                display: "block",
              }}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function AfsPrintStudioPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const engagementId = String(params?.engagementId || "");
  const isPdfExportMode =
    searchParams.get("pdf") === "1" ||
    searchParams.get("export") === "1" ||
    searchParams.get("pdf") === "true";

  const isDraftPdfExport =
    searchParams.get("draft") === "1" ||
    searchParams.get("draft") === "true" ||
    searchParams.get("draftPdf") === "1" ||
    searchParams.get("watermark") === "draft";

  const [loading, setLoading] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState("cover-page");
  const [cashFlowViewMode, setCashFlowViewMode] = useState<"afs" | "work">("afs");
  const [notesViewMode, setNotesViewMode] = useState<"review" | "edit">("review");

  useEffect(() => {
    const handleNotesModeChange = (event: Event) => {
      const nextMode = (event as CustomEvent<"review" | "edit">).detail;
      if (nextMode !== "review" && nextMode !== "edit") return;

      setNotesViewMode(nextMode);

      try {
        window.localStorage.setItem(`afs-notes-mode:${engagementId}`, nextMode);
        window.localStorage.setItem("afs-notes-mode-global", nextMode);
      } catch {
        // The live state still changes even if storage is unavailable.
      }
    };

    window.addEventListener("afs-notes-mode-change", handleNotesModeChange);
    return () => {
      window.removeEventListener("afs-notes-mode-change", handleNotesModeChange);
    };
  }, [engagementId]);

  useEffect(() => {
    if (!engagementId) return;

    try {
      const savedMode =
        window.localStorage.getItem(`afs-notes-mode:${engagementId}`) ||
        window.localStorage.getItem("afs-notes-mode-global");

      if (savedMode === "review" || savedMode === "edit") {
        setNotesViewMode(savedMode);
      }
    } catch {
      // Continue with the default AFS view.
    }
  }, [engagementId]);
  const [detailedIncomeInlineDrafts, setDetailedIncomeInlineDrafts] = useState<Record<string, string>>({});
  const [detailedIncomeEditingRowId, setDetailedIncomeEditingRowId] = useState<string | null>(null);
  const [structuredNotesState, setStructuredNotesState] =
    useState<Record<string, any>>({});

  useEffect(() => {
    if (!isPdfExportMode) return;

    document.documentElement.classList.add("afsPdfExportHtml");
    document.body.classList.add("afsPdfExportMode");
    document.body.setAttribute("data-afs-pdf-mode", "true");
    document.body.setAttribute("data-afs-pdf-ready", loading ? "false" : "true");

    if (isDraftPdfExport) {
      document.body.setAttribute("data-afs-draft-pdf", "true");
    } else {
      document.body.removeAttribute("data-afs-draft-pdf");
    }

    window.dispatchEvent(
      new CustomEvent("afs-print-export-mode", { detail: true }),
    );

    return () => {
      document.documentElement.classList.remove("afsPdfExportHtml");
      document.body.classList.remove("afsPdfExportMode");
      document.body.removeAttribute("data-afs-pdf-mode");
      document.body.removeAttribute("data-afs-pdf-ready");
      document.body.removeAttribute("data-afs-draft-pdf");
      window.dispatchEvent(
        new CustomEvent("afs-print-export-mode", { detail: false }),
      );
    };
  }, [isPdfExportMode, isDraftPdfExport, loading]);

  useEffect(() => {
    if (!engagementId) return;

    const storageKey = `practicepilot-afs-structured-notes:${engagementId}`;

    try {
      const raw = window.localStorage.getItem(storageKey);
      setStructuredNotesState(raw ? JSON.parse(raw) : {});
    } catch {
      setStructuredNotesState({});
    }

    const onStructuredNotesChange = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};

      if (String(detail.engagementId || "") !== engagementId) return;

      setStructuredNotesState(
        detail.state && typeof detail.state === "object" ? detail.state : {},
      );
    };

    window.addEventListener(
      "afs-structured-notes-change",
      onStructuredNotesChange,
    );

    return () => {
      window.removeEventListener(
        "afs-structured-notes-change",
        onStructuredNotesChange,
      );
    };
  }, [engagementId]);

  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [clientSetup, setClientSetup] = useState<ClientSetupData | null>(null);
  const [firmSettings, setFirmSettings] = useState<AfsFirmSettings | null>(null);
  const [taxCalculation, setTaxCalculation] =
    useState<TaxCalculationData | null>(null);
  const [trialBalanceLines, setTrialBalanceLines] = useState<TrialBalanceLine[]>(
    []
  );
  const [trialBalanceHistory, setTrialBalanceHistory] = useState<
    TrialBalanceHistoryLine[]
  >([]);
  const [clientPeople, setClientPeople] = useState<PersonData[]>([]);
  const [reportOptions, setReportOptions] =
    useState<ReportOptions>(defaultReportOptions);
  const [directorsReportTexts, setDirectorsReportTexts] =
    useState<DirectorsReportTextOverrides | null>(null);
  const [accountingPolicyTexts, setAccountingPolicyTexts] =
    useState<EditableDisclosureTextMap | null>(null);
  const [accountingPolicyEditorTexts, setAccountingPolicyEditorTexts] =
    useState<EditableDisclosureTextMap | null>(null);
  const pendingAccountingPolicyTextsRef =
    useRef<EditableDisclosureTextMap | null>(null);
  const [noteTexts, setNoteTexts] =
    useState<EditableDisclosureTextMap | null>(null);
  const [statementOverrides, setStatementOverrides] =
    useState<AfsStatementOverrides>({});
  const [printStudioSettingsLoaded, setPrintStudioSettingsLoaded] =
    useState(false);
  const [printStudioSaveStatus, setPrintStudioSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  async function loadTaxCalculation() {
    if (!engagementId) return;

    try {
      const response = await fetch(
        `/api/afs/engagements/${engagementId}/tax-calculation`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to load tax calculation.");
      }

      setTaxCalculation(result.taxCalculation || null);
    } catch (error) {
      console.error("Failed to load tax calculation", error);
      setTaxCalculation(null);
    }
  }

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
          } else if (firmError) {
            console.error("Failed to load AFS firm settings", firmError);
          }
        }
      }

      const engagementRes = await fetch(`/api/afs/engagements/${engagementId}`, {
        cache: "no-store",
      });

      const engagementData = await engagementRes.json();

      if (engagementRes.ok) {
        setEngagement(engagementData.engagement || null);
        setTrialBalanceLines(
          engagementData.trialBalanceLines ||
            engagementData.trial_balance_lines ||
            engagementData.lines ||
            []
        );
        setTrialBalanceHistory(
          engagementData.trialBalanceHistory ||
            engagementData.trial_balance_history ||
            []
        );
      }

      const setupRes = await fetch(
        `/api/afs/engagements/${engagementId}/client-setup`,
        { cache: "no-store" }
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
            []
        );
      }

      await loadTaxCalculation();

      const settingsRes = await fetch(
        `/api/afs/engagements/${engagementId}/print-studio-settings`,
        { cache: "no-store" }
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
        const savedStructuredNotesState =
          settingsData.structuredNotesState || {};

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
          setAccountingPolicyEditorTexts(savedAccountingPolicyTexts);
        }

        if (
          savedNoteTexts &&
          typeof savedNoteTexts === "object" &&
          Object.keys(savedNoteTexts).length > 0
        ) {
          const cleanedSavedNoteTexts = cleanNoteTextMap(savedNoteTexts);
          setNoteTexts(cleanedSavedNoteTexts);

          if (JSON.stringify(cleanedSavedNoteTexts) !== JSON.stringify(savedNoteTexts)) {
            savePrintStudioSettingsToSupabase({
              noteTexts: cleanedSavedNoteTexts,
            });
          }
        }

        const localStatementOverridesKey =
          `practicepilot-afs-print-studio:${engagementId}:statement-overrides`;

        let localStatementOverrides: Record<string, any> = {};

        try {
          const rawLocalStatementOverrides =
            window.localStorage.getItem(localStatementOverridesKey);

          localStatementOverrides = rawLocalStatementOverrides
            ? JSON.parse(rawLocalStatementOverrides)
            : {};
        } catch {
          localStatementOverrides = {};
        }

        const mergedStatementOverrides = {
          ...(savedStatementOverrides &&
          typeof savedStatementOverrides === "object"
            ? savedStatementOverrides
            : {}),
          ...localStatementOverrides,
        };

        if (
          mergedStatementOverrides.cashFlowMethod !== "direct" &&
          mergedStatementOverrides.cashFlowMethod !== "indirect"
        ) {
          mergedStatementOverrides.cashFlowMethod = "indirect";
        }

        setStatementOverrides(mergedStatementOverrides);

        if (
          savedStructuredNotesState &&
          typeof savedStructuredNotesState === "object" &&
          Object.keys(savedStructuredNotesState).length > 0
        ) {
          setStructuredNotesState(savedStructuredNotesState);

          try {
            window.localStorage.setItem(
              `practicepilot-afs-structured-notes:${engagementId}`,
              JSON.stringify(savedStructuredNotesState),
            );
          } catch {
            // Supabase remains the source of truth.
          }
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
    structuredNotesState?: Record<string, any>;
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
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save Print Studio settings.");
      }

      setPrintStudioSaveStatus("saved");

      if (result.signoffInvalidated) {
        window.dispatchEvent(
          new CustomEvent("afs-signoff-refresh", {
            detail: {
              engagementId,
              sectionKey: "financial-statements",
            },
          }),
        );

        try {
          window.localStorage.setItem(
            `afs-signoff-refresh:${engagementId}:financial-statements`,
            String(Date.now()),
          );
        } catch {
          // Same-tab refresh still works even if storage is unavailable.
        }
      }

      window.setTimeout(() => {
        setPrintStudioSaveStatus((current) =>
          current === "saved" ? "idle" : current
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
    next: DirectorsReportTextOverrides
  ) {
    if (!engagementId) return;

    const localKey = `practicepilot-afs-print-studio:${engagementId}:directors-report-texts`;
    window.localStorage.setItem(localKey, JSON.stringify(next));

    savePrintStudioSettingsToSupabase({
      directorsReportTexts: next,
    });
  }

  function saveAccountingPolicyTextsEverywhere(
    next: EditableDisclosureTextMap
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

  function saveStructuredNotesStateEverywhere(next: Record<string, any>) {
    if (!engagementId) return;

    setStructuredNotesState(next);

    try {
      window.localStorage.setItem(
        `practicepilot-afs-structured-notes:${engagementId}`,
        JSON.stringify(next),
      );
    } catch {
      // Supabase remains the source of truth.
    }

    savePrintStudioSettingsToSupabase({
      structuredNotesState: next,
    });
  }

  function updateStatementOverride(
    key: keyof AfsStatementOverrides,
    value: number | null | "indirect" | "direct"
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
    if (sectionId === "tax-computation") {
      void loadTaxCalculation();
    }

    setActiveSectionId(sectionId);

    requestAnimationFrame(() => {
      const element = document.getElementById(`print-${sectionId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function toggleReportOption(key: keyof ReportOptions | string, checked: boolean) {
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
    description?: string
  ): AfsReportOption {
    return {
      id: String(key),
      label,
      description,
      checked: reportOptions[key],
      onChange: (checked) => toggleReportOption(key, checked),
    };
  }

  const presentationEntityType = String(
    getSetupValue(clientSetup, ["entity_type", "legal_entity_type"]) ||
      engagement?.entity_type ||
      "Company"
  );

  const entityPresentation = getAfsEntityPresentation(presentationEntityType);
  const isCloseCorporation = isCloseCorporationEntityType(presentationEntityType);
  const isTrust = isTrustEntityType(presentationEntityType);

  const reportSectionOptions: AfsReportOption[] = [
    option("coverPage", "Cover page", "Show the AFS cover page."),
    option("index", "Index", "Show the report index."),
    option("generalInformation", "General information", "Show entity and engagement details."),
    option(
      "directorsResponsibilities",
      isCloseCorporation
        ? `${ccMemberPossessive(Math.max(1, clientPeople.filter(isDirectorLike).length))} responsibilities`
        : isTrust
          ? "Trustees’ responsibilities"
          : "Directors’ responsibilities",
      "Show the approval and responsibility statement.",
    ),
    option(
      "directorsReport",
      isCloseCorporation
        ? `${ccMemberPossessive(Math.max(1, clientPeople.filter(isDirectorLike).length))} report`
        : isTrust
          ? "Trustees’ report"
          : "Directors’ report",
      isCloseCorporation
        ? "Show the close corporation member report."
        : isTrust
          ? "Show the trustees’ report."
          : "Show the directors’ report.",
    ),
    option(
      "compilerReport",
      isCloseCorporation ? "Accounting Officer's Report" : "Compiler report",
      isCloseCorporation ? "Show the accounting officer's statutory report." : "Show the compilation report.",
    ),
    option("sfp", "Statement of financial position", "Show SFP."),
    option(
      "soci",
      entityPresentation.isNpc
        ? "Statement of income and expenditure"
        : "Statement of comprehensive income",
      entityPresentation.isNpc
        ? "Show income and expenditure."
        : "Show comprehensive income.",
    ),
    option(
      "sce",
      entityPresentation.equityStatementTitle,
      entityPresentation.isNpc
        ? "Show statement of changes in funds."
        : isTrust
          ? "Show statement of changes in trust capital and accumulated funds."
          : "Show statement of changes in equity.",
    ),
    option("cashFlow", "Cash flow", "Show cash flow statement."),
    option("accountingPolicies", "Accounting policies", "Show accounting policies."),
    option("notes", "Notes", "Show notes to the financial statements."),
    option("detailedIncomeStatement", "Detailed income statement", "Show detailed income statement."),
    option("taxComputation", "Tax computation", "Show tax computation."),
    option(
      "hideComparativeFigures",
      "First year of trading / hide comparative figures",
      "Hide the prior-year column on the AFS statements and notes."
    ),
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
      "Annual Financial Statements"
  );

  const tradingName = cleanString(
  getSetupValue(clientSetup, [
    "trading_name",
    "tradingName",
    "business_name",
    "businessName",
  ]),
);

const clientLogoUrl = cleanString(
  getSetupValue(clientSetup, [
    "logo_url",
    "client_logo_url",
    "afs_logo_url",
  ]),
);


  const entityType = presentationEntityType;

  const yearEnd = String(
    getSetupValue(clientSetup, [
      "financial_year_end",
      "year_end",
      "reporting_date",
      "period_end",
    ]) ||
      engagement?.financial_year_end ||
      "Year-end not set"
  );


  const displayYearEnd = formatAfsDisplayDate(yearEnd);

  const legalFrameworkRaw = String(
    getSetupValue(clientSetup, [
      "legal_framework",
      "companies_act_framework",
    ]) || ""
  );

  const legalFrameworkDisplay =
    isCloseCorporationEntityType(entityType)
      ? !legalFrameworkRaw ||
        legalFrameworkRaw.trim().toLowerCase() === "companies act of south africa" ||
        legalFrameworkRaw.trim().toLowerCase() === "close corporations act of south africa"
        ? "Close Corporations Act 69 of 1984, as amended"
        : legalFrameworkRaw
      : isTrustEntityType(entityType)
        ? !legalFrameworkRaw ||
          legalFrameworkRaw.trim().toLowerCase() === "companies act of south africa" ||
          legalFrameworkRaw.trim().toLowerCase() === "companies act 71 of 2008, as amended"
          ? "Trust Property Control Act 57 of 1988, as amended"
          : legalFrameworkRaw
        : !legalFrameworkRaw ||
          legalFrameworkRaw.trim().toLowerCase() === "companies act of south africa"
          ? "Companies Act 71 of 2008, as amended"
          : legalFrameworkRaw;

  const registrationNumber =
    String(
      getSetupValue(clientSetup, [
        "registration_number",
        "company_registration_number",
        "trust_registration_number",
        "master_reference_number",
        "registration_no",
      ]) || ""
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
      ]) || yearEnd
    ),
    "Current"
  );

  const storedPriorHeading = String(
    getSetupValue(clientSetup, [
      "prior_period_heading",
      "prior_year_heading",
    ]) || ""
  ).trim();

  const currentYearNumber = Number(
    String(currentHeading || "").match(/(20\d{2})/)?.[1] || 0
  );

  const priorHeading = storedPriorHeading
    ? shortYearHeading(storedPriorHeading, "")
    : currentYearNumber > 0
      ? String(currentYearNumber - 1)
      : "Prior";

  const peopleFromSetup = [
    ...formatMultiline(
      getSetupValue(clientSetup, ["directors", "members", "trustees"])
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

  /*
    Practitioner report branding must come from the accounting firm only.
    Do not fall back to the client's generic logo_url.
  */
  const practitionerLogoUrl =
    firmSetting("logo_url") ||
    cleanString(
      getSetupValue(clientSetup, [
        "practitioner_logo_url",
        "compiler_logo_url",
        "firm_logo_url",
        "letterhead_logo_url",
      ]),
    );

  /*
    Same rule for the compilation-report footer: firm / practitioner branding only.
  */
  const practitionerFooterLogoUrl =
    firmSetting("footer_logo_url") ||
    cleanString(
      getSetupValue(clientSetup, [
        "practitioner_footer_logo_url",
        "compiler_footer_logo_url",
        "firm_footer_logo_url",
        "letterhead_footer_logo_url",
      ]),
    );

  const framework =
  getSetupValue(clientSetup, [
    "basis_of_preparation",
    "financial_reporting_framework",
    "reporting_framework",
    "accounting_framework",
    "framework",
  ]) || "IFRS for SMEs";

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
    getSetupValue(clientSetup, ["currency", "presentation_currency"]) ||
    "Rand";

  const baseNarrativeContext = {
    clientName,
    entityType,
    yearEnd: displayYearEnd,
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
    practitionerFooterText: firmSetting("footer_text"),
    firmFooterText: firmSetting("footer_text"),
    natureOfBusiness: String(
      getSetupValue(clientSetup, [
        "nature_of_business",
        "principal_activities",
        "business_activity",
        "business_description",
      ]) || ""
    )
      .trim()
      .replace(/[.\s]+$/g, ""),
    country: String(country || "South Africa"),
    directors: directorsForDisplay,
  };

  const genericDirectorsReportTexts = useMemo(
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

  const defaultDirectorsReportTexts = useMemo(() => {
    const defaults = genericDirectorsReportTexts;

    if (isCloseCorporation) {
      return {
        ...defaults,
        incorporation: {
          title: "Registration",
          text: `${clientName} is registered as a close corporation in South Africa.`,
        },
        natureBusiness: {
          title: "Nature of the close corporation and its activities",
          text:
            "The principal activities of the close corporation are {natureOfBusiness}.",
        },
        reviewActivities: {
          title: "Review of activities",
          text:
            "The close corporation continued to conduct its principal activities during the year under review. The operating results and financial position are fully set out in the annual financial statements and, in the opinion of the members, do not require further comment except as disclosed in this report.",
        },
        financialResults: {
          title: "Financial results",
          text:
            "The financial results of the close corporation for the year ended {yearEnd} are set out in these annual financial statements. The members have considered the results for the year, the financial position at year end and the related disclosures, and are satisfied that the annual financial statements fairly reflect the affairs of the close corporation based on the accounting records and information available to them.",
        },
        dividends: {
          title: "Distributions",
          text:
            "Distributions made or proposed during the year are disclosed in the annual financial statements where applicable.",
        },
        shareCapital: {
          title: "Member's contribution",
          text:
            "Details of the member's contribution and movements during the year are disclosed in the annual financial statements and related notes.",
        },
        directors: {
          title: "Members",
          text:
            "The members in office during the year and up to the date of this report are set out below.",
        },
        externalAccountant: {
          title: "Accounting officer / compiler",
          text:
            "The accounting officer and compiler details are disclosed in the accompanying report and annual financial statements.",
        },
        interestContracts: {
          title: "Members’ interests / related matters",
          text:
            "No material matters involving members' interests that significantly affected the affairs of the close corporation arose during the year, unless otherwise disclosed.",
        },
        borrowingLimitations: {
          title: "Borrowing powers",
          text:
            "Borrowing powers are exercised by the members in accordance with the applicable founding documents and relevant legislation.",
        },
        litigation: {
          title: "Litigation",
          text:
            "The members are not aware of any material legal or arbitration proceedings, pending or threatened, which may have a material effect on the financial position of the close corporation.",
        },
        authorisation: {
          title: "Approval and authorisation",
          text:
            "The annual financial statements were approved and authorised for issue by the members on {approvalDate}.",
        },
      };
    }

    if (isTrust) {
      return {
        ...defaults,
        incorporation: {
          title: "Trust registration",
          text:
            `${clientName} is administered in accordance with the trust deed and the Trust Property Control Act 57 of 1988, as amended.`,
        },
        natureBusiness: {
          title: "Nature of the trust and its activities",
          text:
            "The principal activities and purpose of the trust are {natureOfBusiness}.",
        },
        reviewActivities: {
          title: "Review of trust activities",
          text:
            "The trust continued to conduct its activities during the year under review. The operating results and financial position are fully set out in the annual financial statements and, in the opinion of the trustees, do not require further comment except as disclosed in this report.",
        },
        financialResults: {
          title: "Financial results",
          text:
            "The financial results of the trust for the year ended {yearEnd} are set out in these annual financial statements. The trustees have considered the results for the year, the financial position at year end and the related disclosures, and are satisfied that the annual financial statements fairly reflect the affairs of the trust based on the accounting records and information available to them.",
        },
        dividends: {
          title: "Distributions to beneficiaries",
          text:
            "Distributions vested in or made to beneficiaries during the year are disclosed where applicable in the accounting records and annual financial statements.",
        },
        shareCapital: {
          title: "Trust capital and accumulated funds",
          text:
            "Details of trust capital, accumulated funds and movements during the reporting period are disclosed in the annual financial statements and related notes.",
        },
        directors: {
          title: "Trustees",
          text:
            "The trustees in office during the year and up to the date of this report are set out below.",
        },
        externalAccountant: {
          title: "External accountant / compiler",
          text:
            "The external accountant and compiler details are disclosed in the accompanying report and annual financial statements.",
        },
        interestContracts: {
          title: "Trustee interests / related matters",
          text:
            "The trustees have considered related-party matters and any interests requiring disclosure. Material matters are disclosed in the annual financial statements where applicable.",
        },
        borrowingLimitations: {
          title: "Borrowing powers",
          text:
            "Borrowing powers are exercised by the trustees in accordance with the trust deed and applicable legislation.",
        },
        litigation: {
          title: "Litigation",
          text:
            "The trustees are not aware of any material legal or arbitration proceedings, pending or threatened, which may have a material effect on the financial position of the trust.",
        },
        authorisation: {
          title: "Approval and authorisation",
          text:
            "The annual financial statements were approved and authorised for issue by the trustees on {approvalDate}.",
        },
      };
    }

    return defaults;
  }, [
    genericDirectorsReportTexts,
    clientName,
    isCloseCorporation,
    isTrust,
  ]);

  const activeDirectorsReportTexts = useMemo(() => {
    if (!directorsReportTexts) return defaultDirectorsReportTexts;
    if (!isCloseCorporation && !isTrust) return directorsReportTexts;

    const next: DirectorsReportTextOverrides = {
      ...directorsReportTexts,
    };

    (
      Object.keys(defaultDirectorsReportTexts) as DirectorsReportSectionKey[]
    ).forEach((key) => {
      const saved = (directorsReportTexts as any)?.[key] || {};
      const genericDefault = (genericDirectorsReportTexts as any)?.[key] || {};
      const entityDefault = (defaultDirectorsReportTexts as any)?.[key] || {};

      const savedTitle = String(saved.title ?? "");
      const savedText = String(saved.text ?? "");
      const genericTitle = String(genericDefault.title ?? "");
      const genericText = String(genericDefault.text ?? "");

      (next as any)[key] = {
        ...saved,
        title:
          !savedTitle || savedTitle === genericTitle
            ? entityDefault.title
            : saved.title,
        text:
          !savedText || savedText === genericText
            ? entityDefault.text
            : saved.text,
      };
    });

    return next;
  }, [
    directorsReportTexts,
    genericDirectorsReportTexts,
    defaultDirectorsReportTexts,
    isCloseCorporation,
    isTrust,
  ]);

  const defaultAccountingPolicyTexts = useMemo(
    () => buildDefaultAccountingPolicyTexts(),
    []
  );

  const activeAccountingPolicyTexts =
    accountingPolicyTexts || defaultAccountingPolicyTexts;

  const activeAccountingPolicyEditorTexts =
    accountingPolicyEditorTexts ||
    accountingPolicyTexts ||
    defaultAccountingPolicyTexts;

  function commitPendingAccountingPolicyEdits() {
    const pending = pendingAccountingPolicyTextsRef.current;
    if (!pending) return;

    pendingAccountingPolicyTextsRef.current = null;
    setAccountingPolicyTexts(pending);
    saveAccountingPolicyTextsEverywhere(pending);
  }

  const defaultNoteTexts = useMemo(() => buildDefaultNoteTexts(), []);
  const activeNoteTexts = noteTexts || defaultNoteTexts;

  const initialSettingsSyncDoneRef = useRef(false);

useEffect(() => {
  if (
    loading ||
    !printStudioSettingsLoaded ||
    !engagementId ||
    initialSettingsSyncDoneRef.current
  ) {
    return;
  }

  initialSettingsSyncDoneRef.current = true;

  void savePrintStudioSettingsToSupabase({
    reportOptions,
    directorsReportTexts: activeDirectorsReportTexts,
    accountingPolicyTexts: activeAccountingPolicyTexts,
    noteTexts: activeNoteTexts,
    statementOverrides,
    structuredNotesState,
  });
}, [
  loading,
  printStudioSettingsLoaded,
  engagementId,
]);

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
    value: string
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
    value: string
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
    setAccountingPolicyEditorTexts((current) => {
      const base =
        current ||
        accountingPolicyTexts ||
        activeAccountingPolicyTexts ||
        defaultAccountingPolicyTexts;

      const next = {
        ...base,
        [key]: {
          ...(base[key] || defaultAccountingPolicyTexts[key] || {
            title: key,
            text: "",
          }),
          title: value,
        },
      };

      pendingAccountingPolicyTextsRef.current = next;
      return next;
    });
  }

  function updateAccountingPolicyText(key: string, value: string) {
    setAccountingPolicyEditorTexts((current) => {
      const base =
        current ||
        accountingPolicyTexts ||
        activeAccountingPolicyTexts ||
        defaultAccountingPolicyTexts;

      const next = {
        ...base,
        [key]: {
          ...(base[key] || defaultAccountingPolicyTexts[key] || {
            title: key,
            text: "",
          }),
          text: value,
        },
      };

      pendingAccountingPolicyTextsRef.current = next;
      return next;
    });
  }

  function resetAccountingPolicySection(key: string) {
    const base =
      accountingPolicyEditorTexts ||
      accountingPolicyTexts ||
      activeAccountingPolicyTexts;

    const next = {
      ...base,
      [key]: defaultAccountingPolicyTexts[key],
    };

    pendingAccountingPolicyTextsRef.current = null;
    setAccountingPolicyEditorTexts(next);
    setAccountingPolicyTexts(next);
    saveAccountingPolicyTextsEverywhere(next);
  }

  function resetAllAccountingPolicySections() {
    pendingAccountingPolicyTextsRef.current = null;
    setAccountingPolicyEditorTexts(defaultAccountingPolicyTexts);
    setAccountingPolicyTexts(defaultAccountingPolicyTexts);
    saveAccountingPolicyTextsEverywhere(defaultAccountingPolicyTexts);
  }

  function updateNoteTitle(key: string, value: string) {
    setNoteTexts((current) => {
      const base = current || activeNoteTexts;
      const next = {
        ...base,
        [key]: {
          ...(base[key] || defaultNoteTexts[key] || {
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
          ...(base[key] || defaultNoteTexts[key] || {
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
    directorsReportDividends:
      !entityPresentation.isNpc && reportOptions.directorsReportDividends,
    directorsReportShareCapital:
      !entityPresentation.isNpc && reportOptions.directorsReportShareCapital,
    directorsReportDirectors: reportOptions.directorsReportDirectors,
    directorsReportSecretary:
      !isCloseCorporation && !isTrust && reportOptions.directorsReportSecretary,
    directorsReportExternalAccountant:
      reportOptions.directorsReportExternalAccountant,
    directorsReportInterestContracts:
      reportOptions.directorsReportInterestContracts,
    directorsReportBorrowingLimitations:
      reportOptions.directorsReportBorrowingLimitations,
    directorsReportShareholder:
      !entityPresentation.isNpc &&
      !isCloseCorporation &&
      !isTrust &&
      reportOptions.directorsReportShareholder,
    directorsReportGoingConcern: reportOptions.directorsReportGoingConcern,
    directorsReportLiquiditySolvency:
      reportOptions.directorsReportLiquiditySolvency,
    directorsReportLitigation: reportOptions.directorsReportLitigation,
    directorsReportSocialEthics:
      !isCloseCorporation && !isTrust && reportOptions.directorsReportSocialEthics,
    directorsReportSubsidiaries:
      !isCloseCorporation && !isTrust && reportOptions.directorsReportSubsidiaries,
    directorsReportAssociates:
      !isCloseCorporation && !isTrust && reportOptions.directorsReportAssociates,
    directorsReportJointVentures:
      !isCloseCorporation && !isTrust && reportOptions.directorsReportJointVentures,
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

  const historicalCashFlowData = useMemo(
    () => buildHistoricalCashFlowData(trialBalanceHistory),
    [trialBalanceHistory],
  );

  const effectiveStatementOverrides = useMemo(
    () => ({
      /*
        Historical values are fallbacks only. A value deliberately captured
        in the workbench must always take priority.
      */
      ...historicalCashFlowData.overrides,
      ...statementOverrides,
    }),
    [statementOverrides, historicalCashFlowData],
  );

  /*
    Build once without note numbers so numbering can be driven by actual
    mapped note content rather than by switches alone.
  */
  const unnumberedStatementEngine = useMemo(
    () =>
      buildAfsPrintStatementEngine(
        trialBalanceLines,
        effectiveStatementOverrides,
        {},
      ),
    [trialBalanceLines, effectiveStatementOverrides],
  );

  const effectiveNoteSections = useMemo(() => {
    const mappedAbs = (
      prefix: "395" | "595",
      side: "current" | "prior",
    ) =>
      (trialBalanceLines || []).reduce((sum: number, line: any) => {
        const code = String(line?.mapping_code || "").trim();

        if (!(code === prefix || code.startsWith(`${prefix}.`))) {
          return sum;
        }

        const raw =
          side === "current"
            ? Number(
                line?.current_year_balance ??
                  line?.current_balance ??
                  line?.final_balance ??
                  line?.source_balance ??
                  0,
              )
            : Number(
                line?.prior_year_balance ??
                  line?.prior_balance ??
                  line?.comparative_balance ??
                  0,
              );

        return sum + Math.abs(Number.isFinite(raw) ? raw : 0);
      }, 0);

    const assetCurrent = mappedAbs("395", "current");
    const liabilityCurrent = mappedAbs("595", "current");
    const assetPrior = mappedAbs("395", "prior");
    const liabilityPrior = mappedAbs("595", "prior");

    const currentHasDeferredTax =
      assetCurrent !== 0 || liabilityCurrent !== 0;

    const placeUnderAssets = currentHasDeferredTax
      ? assetCurrent >= liabilityCurrent
      : assetPrior >= liabilityPrior;

    return noteSections.map((section: any) => {
      if (isShareCapitalNoteSection(section) && isCloseCorporation) {
        return {
          ...section,
          label: "Member's contribution",
          title: "Member's contribution",
          defaultTitle: "Member's contribution",
        };
      }

      if (isShareCapitalNoteSection(section) && isTrust) {
        return {
          ...section,
          label: "Trust capital",
          title: "Trust capital",
          defaultTitle: "Trust capital",
        };
      }

      if (section.key === "notesLoansReceivable") {
        const loanRows =
          unnumberedStatementEngine.noteData?.loansReceivable || [];
        const relatedPartyOnly =
          loanRows.length > 0 &&
          loanRows.every(
            (row: any) =>
              String(row?.label || "").trim() ===
              "Shareholder / director / member loans",
          );

        if (relatedPartyOnly) {
          const title = getAfsEntityRowLabel(
            "Shareholder / director / member loans",
            entityPresentation,
          );

          return {
            ...section,
            label: title,
            title,
            defaultTitle: title,
          };
        }
      }

      if (section.key === "notesShareholdersLoans" && isCloseCorporation) {
        return {
          ...section,
          label: "Member loans",
          title: "Member loans",
          defaultTitle: "Member loans",
        };
      }

      if (section.key === "notesShareholdersLoans" && isTrust) {
        return {
          ...section,
          label: "Trustee loans",
          title: "Trustee loans",
          defaultTitle: "Trustee loans",
        };
      }

      if (section.key === "notesDeferredTaxLiability") {
        return {
          ...section,
          label: "Deferred tax",
          title: "Deferred tax",
          defaultTitle: "Deferred tax",
          group: placeUnderAssets
            ? "non-current-assets"
            : "non-current-liabilities",
          groupLabel: placeUnderAssets
            ? "Non-current assets"
            : "Non-current liabilities",
        };
      }

      if (isTrust && section.group === "equity") {
        return {
          ...section,
          groupLabel: "Trust capital and accumulated funds",
        };
      }

      return section;
    });
  }, [
    trialBalanceLines,
    isCloseCorporation,
    isTrust,
    unnumberedStatementEngine,
    entityPresentation,
  ]);

  const noteNumberMap = useMemo(() => {
    const keyMap: Record<string, AfsNoteKey> = {
      notesPropertyPlantEquipment: "propertyPlantEquipment",
      notesRightOfUseAssets: "rightOfUseAssets",
      notesGoodwill: "goodwill",
      notesInvestmentProperty: "investmentProperty",
      notesIntangibleAssets: "intangibleAssets",
      notesBiologicalAssets: "biologicalAssets",
      notesInvestmentsSubsidiaries: "investmentsSubsidiaries",
      notesInvestmentsAssociates: "investmentsAssociates",
      notesInvestmentsJointVentures: "investmentsJointVentures",
      notesOtherInvestments: "otherInvestments",
      notesOtherFinancialAssets: "otherFinancialAssets",
      notesOtherNonCurrentAssets: "otherNonCurrentAssets",
      notesLoansReceivable: "loansReceivable",
      notesInventories: "inventories",
      notesContractAssets: "contractAssets",
      notesTradeReceivables: "tradeReceivables",
      notesTaxStatutoryReceivables: "taxStatutoryReceivables",
      notesCurrentTaxReceivable: "currentTaxReceivable",
      notesCashAndCashEquivalents: "cashAndCashEquivalents",
      notesAssetsHeldForSale: "assetsHeldForSale",

      notesShareCapital: "shareCapital",
      notesRetainedIncome: "retainedIncome",
      notesReserves: "reserves",
      notesNonControllingInterests: "nonControllingInterests",
      notesOtherEquity: "otherEquity",

      notesProvisions: "provisions",
      notesEmployeeBenefitObligations: "employeeBenefitObligations",
      notesDeferredIncomeGrants: "deferredIncomeGrants",
      notesGroupRelatedPartyBorrowings: "groupRelatedPartyBorrowings",
      notesShareholdersLoans: "shareholdersLoans",
      notesBorrowings: "borrowings",
      notesAssetFinance: "assetFinance",
      notesLeaseLiabilities: "leaseLiabilities",
      notesOtherFinancialLiabilities: "otherFinancialLiabilities",
      notesSupplierFinance: "supplierFinance",
      notesDeferredTaxLiability: "deferredTax",
      notesBankOverdraft: "bankOverdraft",
      notesTradePayables: "tradePayables",
      notesContractLiabilities: "contractLiabilities",
      notesDividendPayable: "dividendPayable",
      notesTaxStatutoryPayables: "taxStatutoryPayables",
      notesCurrentTaxPayable: "currentTaxPayable",
      notesLiabilitiesHeldForSale: "liabilitiesHeldForSale",

      notesRevenue: "revenue",
      notesCostOfSales: "costOfSales",
      notesOtherOperatingIncome: "otherOperatingIncome",
      notesInvestmentIncome: "investmentIncome",
      notesOperatingExpenses: "operatingExpenses",
      notesFinanceCosts: "financeCosts",
      notesOtherGainsLosses: "otherGainsLosses",
      notesTaxation: "taxation",
      notesOtherComprehensiveIncome: "otherComprehensiveIncome",
      notesDiscontinuedOperations: "discontinuedOperations",

      notesCashUsedInOperations: "cashUsedInOperations",
    };

    const hasRows = (noteKey: AfsNoteKey) =>
      (unnumberedStatementEngine.noteData[noteKey] || []).some(
        (row: any) =>
          Math.round(Number(row?.current || 0)) !== 0 ||
          Math.round(Number(row?.prior || 0)) !== 0,
      );

    const map: Partial<Record<AfsNoteKey, string | number>> = {};
    let nextNumber = 1;

    effectiveNoteSections.forEach((section: any) => {
      if (!reportOptions[section.optionKey as keyof ReportOptions]) return;

      const noteKey = keyMap[section.key];
      if (!noteKey) return;

      if (entityPresentation.isNpc && noteKey === "shareCapital") return;

      // Empty mapped notes do not consume note numbers.
      if (!hasRows(noteKey)) return;

      map[noteKey] = nextNumber;

      if (noteKey === "deferredTax") {
        map.deferredTaxAsset = nextNumber;
        map.deferredTaxLiability = nextNumber;
      }

      if (noteKey === "cashAndCashEquivalents") {
        map.bankOverdraft = nextNumber;
      }

      nextNumber += 1;
    });

    return map;
  }, [
    reportOptions,
    unnumberedStatementEngine,
    effectiveNoteSections,
    entityPresentation.isNpc,
  ]);

  const baseStatementEngine = useMemo(
    () =>
      buildAfsPrintStatementEngine(
        trialBalanceLines,
        effectiveStatementOverrides,
        noteNumberMap,
      ),
    [trialBalanceLines, effectiveStatementOverrides, noteNumberMap],
  );

const effectiveStructuredNotesState = useMemo(() => {
  const currentState =
    structuredNotesState && typeof structuredNotesState === "object"
      ? structuredNotesState
      : {};

  const currentCashGenerated =
    currentState.cashGeneratedFromOperations &&
    typeof currentState.cashGeneratedFromOperations === "object"
      ? currentState.cashGeneratedFromOperations
      : {};

  const currentValues =
    currentCashGenerated.values &&
    typeof currentCashGenerated.values === "object"
      ? currentCashGenerated.values
      : {};

  const ppeInputs =
    currentState.ppeInputs &&
    typeof currentState.ppeInputs === "object"
      ? currentState.ppeInputs
      : {};

  const ppeDepreciation = (
    side: "current" | "prior",
  ) =>
    Object.values(ppeInputs).reduce((sum: number, row: any) => {
      return (
        sum +
        Math.abs(
          Number(
            row?.[side]?.depreciation ??
              row?.[side]?.depreciationCharge ??
              0,
          ),
        )
      );
    }, 0);

  const mappedNoteTotal = (
    lines: any[] | undefined,
    side: "current" | "prior",
  ) =>
    (lines || []).reduce(
      (sum: number, line: any) =>
        sum + Number(line?.[side] || 0),
      0,
    );

  const mappedPnlDepreciation = (
    side: "current" | "prior",
  ) =>
    (trialBalanceLines || [])
      .filter((line: any) => {
        const code = String(line?.mapping_code || "").trim();
        return (
          code === "750.14" ||
          code.startsWith("750.14.") ||
          code === "750.141" ||
          code.startsWith("750.141.")
        );
      })
      .reduce((sum: number, line: any) => {
        const amount =
          side === "current"
            ? Number(
                line?.current_year_balance ??
                  line?.current_balance ??
                  line?.final_balance ??
                  line?.source_balance ??
                  0,
              )
            : Number(
                line?.prior_year_balance ??
                  line?.prior_balance ??
                  0,
              );

        return sum + Math.abs(Number.isFinite(amount) ? amount : 0);
      }, 0);

  const mappedDepreciationCurrent =
    mappedPnlDepreciation("current") || ppeDepreciation("current");

  const mappedDepreciationPrior =
    mappedPnlDepreciation("prior") || ppeDepreciation("prior");

  const existingDepreciation =
    currentValues.depreciationAmortisationImpairment || {};

  return {
    ...currentState,
    cashGeneratedFromOperations: {
      ...currentCashGenerated,
      values: {
        ...currentValues,

        depreciationAmortisationImpairment: {
          ...existingDepreciation,

          current:
            mappedDepreciationCurrent !== 0
              ? mappedDepreciationCurrent
              : existingDepreciation.current ?? 0,

          prior:
            mappedDepreciationPrior !== 0
              ? mappedDepreciationPrior
              : existingDepreciation.prior ?? 0,
        },

        inventories: {
          ...(currentValues.inventories || {}),
          current:
            currentValues.inventories?.current !== undefined &&
            currentValues.inventories?.current !== null &&
            currentValues.inventories?.current !== ""
              ? currentValues.inventories.current
              : Number(
                  baseStatementEngine.cashFlowRows?.find(
                    (row: any) =>
                      String(row?.id || "") === "cfs-inventories",
                  )?.current || 0,
                ),
          prior:
            currentValues.inventories?.prior !== undefined &&
            currentValues.inventories?.prior !== null &&
            currentValues.inventories?.prior !== ""
              ? currentValues.inventories.prior
              : historicalCashFlowData.inventoryPrior,
        },

        tradeReceivables: {
          ...(currentValues.tradeReceivables || {}),
          current:
            currentValues.tradeReceivables?.current !== undefined &&
            currentValues.tradeReceivables?.current !== null &&
            currentValues.tradeReceivables?.current !== ""
              ? currentValues.tradeReceivables.current
              : Number(
                  baseStatementEngine.cashFlowRows?.find(
                    (row: any) =>
                      String(row?.id || "") ===
                      "cfs-trade-receivables",
                  )?.current || 0,
                ),
          prior:
            currentValues.tradeReceivables?.prior !== undefined &&
            currentValues.tradeReceivables?.prior !== null &&
            currentValues.tradeReceivables?.prior !== ""
              ? currentValues.tradeReceivables.prior
              : historicalCashFlowData.receivablesPrior,
        },

        tradePayables: {
          ...(currentValues.tradePayables || {}),
          current:
            currentValues.tradePayables?.current !== undefined &&
            currentValues.tradePayables?.current !== null &&
            currentValues.tradePayables?.current !== ""
              ? currentValues.tradePayables.current
              : Number(
                  baseStatementEngine.cashFlowRows?.find(
                    (row: any) =>
                      String(row?.id || "") ===
                      "cfs-trade-payables",
                  )?.current || 0,
                ),
          prior:
            currentValues.tradePayables?.prior !== undefined &&
            currentValues.tradePayables?.prior !== null &&
            currentValues.tradePayables?.prior !== ""
              ? currentValues.tradePayables.prior
              : historicalCashFlowData.payablesPrior,
        },

        investmentIncome: {
          ...(currentValues.investmentIncome || {}),
          current: -Math.abs(
            mappedNoteTotal(
              baseStatementEngine.noteData.investmentIncome,
              "current",
            ),
          ),
          prior: -Math.abs(
            mappedNoteTotal(
              baseStatementEngine.noteData.investmentIncome,
              "prior",
            ),
          ),
        },

        financeCosts: {
          ...(currentValues.financeCosts || {}),
          current:
            currentValues.financeCosts?.current !== undefined &&
            currentValues.financeCosts?.current !== null &&
            currentValues.financeCosts?.current !== ""
              ? currentValues.financeCosts.current
              : Math.abs(
                  mappedNoteTotal(
                    baseStatementEngine.noteData.financeCosts,
                    "current",
                  ),
                ),
          prior:
            currentValues.financeCosts?.prior !== undefined &&
            currentValues.financeCosts?.prior !== null &&
            currentValues.financeCosts?.prior !== ""
              ? currentValues.financeCosts.prior
              : Math.abs(
                  mappedNoteTotal(
                    baseStatementEngine.noteData.financeCosts,
                    "prior",
                  ),
                ),
        },
      },
    },
  };
}, [
  structuredNotesState,
  baseStatementEngine,
  historicalCashFlowData,
]);

  const statementEngine = useMemo(() => {
    const values =
  effectiveStructuredNotesState?.cashGeneratedFromOperations?.values || {};

    const hasStoredValue = (key: string, side: "current" | "prior") => {
      const value = values?.[key]?.[side];
      return value !== undefined && value !== null && value !== "";
    };

    const storedAmount = (
      key: string,
      side: "current" | "prior",
      fallback: number,
    ) => {
      if (!hasStoredValue(key, side)) return fallback;
      const parsed = Number(values[key][side]);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    /*
      CASH-FLOW CURRENT-YEAR P&L SOURCE

      IMPORTANT: do NOT change rawCurrent(). rawCurrent() is the closing/final
      balance used by the SFP and the rest of Print Studio.

      For current-year P&L cash-flow calculations, debit/credit represents the
      annual movement imported for this engagement. This keeps rolled-over
      cumulative P&L balances out of the cash-flow statement without changing
      any balance-sheet statement.
    */
    const cashFlowCurrentYearMovement = (line: TrialBalanceLine) => {
      const importedMovement = safeNumber(line.debit) - safeNumber(line.credit);

      /*
        Rolled-over engagements carry the annual movement in debit / credit.
        A first-year / final-TB engagement may not have separate movement fields,
        in which case the current TB balance is the annual P&L movement.

        This fallback is deliberately local to CASH FLOW P&L calculations only;
        it never changes SFP closing balances.
      */
      if (Math.abs(importedMovement) > 0.005) return importedMovement;
      return rawCurrent(line);
    };

    const cashFlowMappingStartsWith = (line: TrialBalanceLine, prefixes: string[]) => {
      const code = String(line.mapping_code || "").trim();
      return prefixes.some(
        (prefix) => code === prefix || code.startsWith(`${prefix}.`),
      );
    };

    const cashFlowMappedRawTotal = (
      prefixes: string[],
      side: "current" | "prior",
    ) =>
      (trialBalanceLines || [])
        .filter((line) => cashFlowMappingStartsWith(line, prefixes))
        .reduce(
          (sum, line) =>
            sum +
            (side === "current"
              ? cashFlowCurrentYearMovement(line)
              : rawPrior(line)),
          0,
        );

    const rows = (baseStatementEngine.cashFlowRows || []).map((row: any) => ({ ...row }));
    const findById = (id: string) => rows.find((row: any) => String(row?.id || "") === id);
    const findByLabel = (terms: string[]) => rows.find((row: any) => {
      const label = String(row?.label || "").toLowerCase();
      return terms.every((term) => label.includes(term));
    });

    /*
      CANONICAL NON-CASH ADJUSTMENTS

      Depreciation / amortisation is mapping-driven. It must be added back in
      BOTH indirect and direct cash-flow methods and must never depend on a
      Workbench value being captured.

      750.14  depreciation
      750.141 amortisation
    */
    const mappedDepreciationAmortisationCurrent = Math.abs(
      cashFlowMappedRawTotal(["750.14", "750.141"], "current"),
    );

    const mappedDepreciationAmortisationPrior = Math.abs(
      cashFlowMappedRawTotal(["750.14", "750.141"], "prior"),
    );

    const manualAdjustmentKeys = [
      "adjustments",
      "lossOnSaleAssetsLiabilities",
      "fairValueGainsLosses",
      "movementProvisions",
      "otherNonCash1",
      "investmentIncome",
      "financeCosts",
    ];

    const adjustmentsCurrent =
      mappedDepreciationAmortisationCurrent +
      manualAdjustmentKeys.reduce(
        (sum, key) => sum + storedAmount(key, "current", 0),
        0,
      );

    const adjustmentsPrior =
      mappedDepreciationAmortisationPrior +
      manualAdjustmentKeys.reduce(
        (sum, key) => sum + storedAmount(key, "prior", 0),
        0,
      );

    const profitRow = findById("cfs-profit-before-tax") || findByLabel(["profit", "before taxation"]);
    const adjustmentsRow = findById("cfs-adjustments") || findByLabel(["adjustments", "non-cash"]);
    const inventoryRow = findById("cfs-inventories") || findByLabel(["inventor"]);
    const receivablesRow = findById("cfs-trade-receivables") || findByLabel(["trade", "receivables"]);
    const payablesRow = findById("cfs-trade-payables") || findByLabel(["trade", "payables"]);
    const generatedRow = findById("cfs-cash-generated-operations") || findByLabel(["cash generated", "operations"]);
    const interestReceivedRow =
      findById("cfs-interest-received") ||
      findByLabel(["interest received"]);
    const financeCostsPaidRow =
      findById("cfs-finance-costs-paid") ||
      findByLabel(["finance costs paid"]);
    const taxPaidRow =
      findById("cfs-tax-paid") ||
      findByLabel(["taxation paid"]) ||
      findByLabel(["tax paid"]);
    const otherOperatingRow = findById("cfs-other-operating") || findByLabel(["other operating cash flows"]);
    const netOperatingRow = findById("cfs-net-operating") || findByLabel(["net cash", "operating activities"]);
    const purchasePpeRow =
      findById("cfs-purchase-ppe") ||
      findByLabel(["purchase", "property", "plant", "equipment"]);

    const disposalPpeRow =
      findById("cfs-disposal-ppe") ||
      findByLabel(["proceeds", "disposal", "property", "plant", "equipment"]);

    const otherInvestingRow =
      findById("cfs-other-investing") ||
      findByLabel(["other investing cash flows"]);

    const netInvestingRow =
      findById("cfs-net-investing") ||
      findByLabel(["net cash", "investing activities"]);

    const netFinancingRow =
      findById("cfs-net-financing") ||
      findByLabel(["net cash", "financing activities"]);

    /*
      Prior-year financing must represent movements, not closing balances.
      The statement engine may carry a legacy prior closing liability into
      Other financing cash flows. Replace that comparative with explicit
      movement values only.
    */
    const loansRaisedRow =
      findById("cfs-loans-raised") ||
      findByLabel(["shareholder loans raised"]);

    const dividendsPaidRow =
      findById("cfs-dividends-paid") ||
      findByLabel(["dividends paid"]);

    const otherFinancingRow =
      findById("cfs-other-financing") ||
      findByLabel(["other financing cash flows"]);

    const explicitOtherFinancingPrior =
      effectiveStatementOverrides.cashOtherFinancingPrior !== null &&
      effectiveStatementOverrides.cashOtherFinancingPrior !== undefined
        ? Number(effectiveStatementOverrides.cashOtherFinancingPrior || 0)
        : 0;

    if (otherFinancingRow) {
      otherFinancingRow.prior = Math.round(explicitOtherFinancingPrior);
    }

    const correctedNetFinancingPrior =
      Number(loansRaisedRow?.prior || 0) +
      Number(dividendsPaidRow?.prior || 0) +
      explicitOtherFinancingPrior;

    if (netFinancingRow) {
      netFinancingRow.prior = Math.round(correctedNetFinancingPrior);
    }

    const liabilityMappingMovement = (prefixes: string[]) => {
      let currentPresentedLiability = 0;
      let priorPresentedLiability = 0;

      for (const line of trialBalanceLines || []) {
        const code = String(line?.mapping_code || "").trim();
        if (
          !prefixes.some(
            (prefix) => code === prefix || code.startsWith(`${prefix}.`),
          )
        ) {
          continue;
        }

        /*
          Financing mappings are liabilities.

          TB sign convention:
            credit liability = negative raw balance
            debit / overdrawn liability = positive raw balance

          Cash-flow movement must follow the actual liability movement, not the
          movement in absolute values. Using Math.abs() incorrectly turned a
          debit shareholder-loan balance into a cash inflow.

          Presented liability balance = -raw balance.
        */
        currentPresentedLiability += -Number(rawCurrent(line) || 0);
        priorPresentedLiability += -Number(rawPrior(line) || 0);
      }

      return Math.round(
        currentPresentedLiability - priorPresentedLiability,
      );
    };

    const shareholderLoanMovementCurrent = liabilityMappingMovement(["548"]);

    /*
      Share capital is an equity financing movement.
      TB credits are negative, so presented equity = -raw balance.
      Only the movement between prior and current mapped share-capital balances
      belongs in cash flow.
    */
    const shareCapitalMovementCurrent = (() => {
      /*
        Use the already-mapped SFP result as the canonical source.

        This avoids a second, separate interpretation of the TB sign and mapping
        inside cash flow. The SFP is already mapping-driven, and FlightDeck is
        checking the cash flow against that same statement.

        For a first-year / hidden-comparative file there is no opening share
        capital for cash-flow purposes, so the opening balance is zero.
      */
      const shareCapitalSfpRow = (baseStatementEngine.sfpRows || []).find(
        (row: any) => {
          const id = String(row?.id || "").trim().toLowerCase();
          const label = String(row?.label || "").trim().toLowerCase();

          return (
            id === "share-capital" ||
            id === "equity-share-capital" ||
            label === "share capital"
          );
        },
      );

      if (!shareCapitalSfpRow) return 0;

      const currentPresentedEquity = Number(
        shareCapitalSfpRow.current || 0,
      );

      const priorPresentedEquity = Boolean(
        reportOptions.hideComparativeFigures,
      )
        ? 0
        : Number(shareCapitalSfpRow.prior || 0);

      return Math.round(
        currentPresentedEquity - priorPresentedEquity,
      );
    })();

    const assetFinanceMovementCurrent = liabilityMappingMovement([
      "550.40",
      "550.50",
      "610.30",
      "610.40",
    ]);

    const otherBorrowingsMovementCurrent = (() => {
      let current = 0;
      let prior = 0;

      for (const line of trialBalanceLines || []) {
        const code = String(line?.mapping_code || "").trim();

        const isAssetFinance =
          code === "550.40" ||
          code.startsWith("550.40.") ||
          code === "550.50" ||
          code.startsWith("550.50.") ||
          code === "610.30" ||
          code.startsWith("610.30.") ||
          code === "610.40" ||
          code.startsWith("610.40.");

        const isOtherBorrowing =
          code === "547" ||
          code.startsWith("547.") ||
          code === "550" ||
          code.startsWith("550.") ||
          code === "551" ||
          code.startsWith("551.") ||
          code === "610" ||
          code.startsWith("610.");

        if (!isOtherBorrowing || isAssetFinance) continue;

        current += -Number(rawCurrent(line) || 0);
        prior += -Number(rawPrior(line) || 0);
      }

      return Math.round(current - prior);
    })();

    const manualLoanMovementCurrent =
      effectiveStatementOverrides.cashLoansRaisedCurrent !== null &&
      effectiveStatementOverrides.cashLoansRaisedCurrent !== undefined
        ? Number(effectiveStatementOverrides.cashLoansRaisedCurrent || 0)
        : shareholderLoanMovementCurrent;

    const manualLoanMovementPrior =
      effectiveStatementOverrides.cashLoansRaisedPrior !== null &&
      effectiveStatementOverrides.cashLoansRaisedPrior !== undefined
        ? Number(effectiveStatementOverrides.cashLoansRaisedPrior || 0)
        : Number(loansRaisedRow?.prior || 0);

    const mappedOtherFinancingCurrent =
      shareCapitalMovementCurrent +
      assetFinanceMovementCurrent +
      otherBorrowingsMovementCurrent;

    /*
      Asset finance / borrowings (e.g. Wesbank) must ALWAYS pull automatically
      from the mapped balance-sheet movements. The Workbench "Other financing"
      field is an additional manual cash-flow amount, not a replacement for
      those mapped financing movements.
    */
    const manualOtherFinancingCurrent =
      Number(effectiveStatementOverrides.cashOtherFinancingCurrent || 0);

    const manualOtherFinancingPrior =
      Number(effectiveStatementOverrides.cashOtherFinancingPrior || 0);

    const totalOtherFinancingCurrent =
      mappedOtherFinancingCurrent + manualOtherFinancingCurrent;

    const mappedOtherFinancingPrior =
      Number(otherFinancingRow?.prior || 0);

    const totalOtherFinancingPrior =
      mappedOtherFinancingPrior + manualOtherFinancingPrior;

    if (loansRaisedRow) {
      loansRaisedRow.current = Math.round(manualLoanMovementCurrent);
      loansRaisedRow.prior = Math.round(manualLoanMovementPrior);
      loansRaisedRow.label = isCloseCorporation
        ? "Member loan movement"
        : isTrust
          ? "Trustee loan movement"
          : "Directors / shareholders loan movement";
    }

    if (otherFinancingRow) {
      otherFinancingRow.current = Math.round(totalOtherFinancingCurrent);
      otherFinancingRow.prior = Math.round(totalOtherFinancingPrior);
      otherFinancingRow.label =
        "Asset finance, borrowings and other financing cash flows";
    }

    if (netFinancingRow) {
      netFinancingRow.current = Math.round(
        manualLoanMovementCurrent +
          Number(dividendsPaidRow?.current || 0) +
          totalOtherFinancingCurrent,
      );

      netFinancingRow.prior = Math.round(
        manualLoanMovementPrior +
          Number(dividendsPaidRow?.prior || 0) +
          totalOtherFinancingPrior,
      );
    }

    /*
      PPE additions:
      The structured PPE note is the source of truth for additions.
      An explicit Workbench amount may override it where an acquisition was
      non-cash / financed directly.
    */
    const ppeAdditionsFromNote = (side: "current" | "prior") => {
      const structuredStateAny = effectiveStructuredNotesState as any;

      const savedRows = Array.isArray(structuredStateAny?.ppeRows)
        ? structuredStateAny.ppeRows
        : [];

      const savedInputs =
        structuredStateAny?.ppeInputs &&
        typeof structuredStateAny.ppeInputs === "object"
          ? Object.values(structuredStateAny.ppeInputs)
          : [];

      const sourceRows = savedRows.length > 0 ? savedRows : savedInputs;

      return sourceRows.reduce(
        (sum: number, row: any) =>
          sum + Math.abs(Number(row?.[side]?.additions || 0)),
        0,
      );
    };

    const defaultPpeCurrent = ppeAdditionsFromNote("current");
    const defaultPpePrior = ppeAdditionsFromNote("prior");

    const purchasePpeCurrentRaw =
      effectiveStatementOverrides.cashPurchaseOfPpeCurrent;
    const purchasePpePriorRaw =
      effectiveStatementOverrides.cashPurchaseOfPpePrior;

    const purchasePpeCurrent =
      purchasePpeCurrentRaw !== null &&
      purchasePpeCurrentRaw !== undefined &&
      Number.isFinite(Number(purchasePpeCurrentRaw))
        ? -Math.abs(Number(purchasePpeCurrentRaw))
        : -Math.abs(defaultPpeCurrent);

    const purchasePpePrior =
      purchasePpePriorRaw !== null &&
      purchasePpePriorRaw !== undefined &&
      Number.isFinite(Number(purchasePpePriorRaw))
        ? -Math.abs(Number(purchasePpePriorRaw))
        : -Math.abs(defaultPpePrior);

    if (purchasePpeRow) {
      purchasePpeRow.current = Math.round(purchasePpeCurrent);
      purchasePpeRow.prior = Math.round(purchasePpePrior);
    }
    const netMovementRow = findById("cfs-net-movement") || findByLabel(["net increase"]);
    const openingCashRow = findById("cfs-opening-cash") || findByLabel(["cash and cash equivalents at beginning"]);
    const closingCashRow = findById("cfs-closing-cash") || findByLabel(["cash and cash equivalents at end"]);

    /*
      CURRENT-YEAR INVENTORY MOVEMENT — mapping-driven, never stored-value-driven.

      A zero closing balance is a real balance, not a missing value. Calculate the
      movement directly from the mapped inventory note balances so a movement such
      as R365,284 -> R0 is correctly treated as a R365,284 decrease in inventory.
    */
    const mappedInventoryCurrentBalance = (
      baseStatementEngine.noteData.inventories || []
    ).reduce(
      (sum: number, line: any) => sum + Number(line?.current || 0),
      0,
    );

    const mappedInventoryPriorBalance = (
      baseStatementEngine.noteData.inventories || []
    ).reduce(
      (sum: number, line: any) => sum + Number(line?.prior || 0),
      0,
    );

    const inventoryCurrent =
      mappedInventoryPriorBalance - mappedInventoryCurrentBalance;

    const inventoryPrior = historicalCashFlowData.hasTwoDistinctYears
      ? historicalCashFlowData.inventoryPrior
      : storedAmount(
          "inventories",
          "prior",
          Number(inventoryRow?.prior || 0),
        );

    /*
      CURRENT-YEAR WORKING CAPITAL — ALWAYS FROM SFP BALANCE MOVEMENTS.

      Never let saved Workbench values override these movements. A rollover can
      leave stale zero/manual values behind, which is exactly what caused cash
      flow to ignore a receivable/payable movement.

      Assets: decrease = cash inflow => opening - closing.
      Liabilities: increase = cash inflow => closing - opening.
    */
    const mappedReceivablesCurrentBalance = (
      baseStatementEngine.noteData.tradeReceivables || []
    ).reduce(
      (sum: number, line: any) => sum + Number(line?.current || 0),
      0,
    );

    const mappedReceivablesPriorBalance = (
      baseStatementEngine.noteData.tradeReceivables || []
    ).reduce(
      (sum: number, line: any) => sum + Number(line?.prior || 0),
      0,
    );

    const receivablesCurrent =
      mappedReceivablesPriorBalance - mappedReceivablesCurrentBalance;

    const receivablesPrior = historicalCashFlowData.hasTwoDistinctYears
      ? historicalCashFlowData.receivablesPrior
      : Number(receivablesRow?.prior || 0);

    const mappedPayablesCurrentBalance = (
      baseStatementEngine.noteData.tradePayables || []
    ).reduce(
      (sum: number, line: any) => sum + Number(line?.current || 0),
      0,
    );

    const mappedPayablesPriorBalance = (
      baseStatementEngine.noteData.tradePayables || []
    ).reduce(
      (sum: number, line: any) => sum + Number(line?.prior || 0),
      0,
    );

    const payablesCurrent =
      mappedPayablesCurrentBalance - mappedPayablesPriorBalance;

    const payablesPrior = historicalCashFlowData.hasTwoDistinctYears
      ? historicalCashFlowData.payablesPrior
      : Number(payablesRow?.prior || 0);

    /*
      CASH FLOW PROFIT BEFORE TAX

      Use the exact PBT already produced by the AFS statement engine. Cash flow
      must never rebuild or reinterpret profit from TB movements independently
      of the SOCI. This keeps SOCI and cash flow on one source of truth.
    */
    const canonicalPbtRow = (baseStatementEngine.sociRows || []).find(
      (row: any) =>
        String(row?.id || "") === "profit-before-tax" ||
        String(row?.label || "").toLowerCase().includes("before taxation"),
    );

    const cashFlowProfitBeforeTaxCurrent = Math.round(
      Number(canonicalPbtRow?.current || 0),
    );

    const cashFlowProfitBeforeTaxPrior = Math.round(
      Number(canonicalPbtRow?.prior || 0),
    );

    if (profitRow) {
      profitRow.current = Math.round(cashFlowProfitBeforeTaxCurrent);
      profitRow.prior = Math.round(cashFlowProfitBeforeTaxPrior);
    }

    const generatedCurrent =
      cashFlowProfitBeforeTaxCurrent +
      adjustmentsCurrent +
      inventoryCurrent +
      receivablesCurrent +
      payablesCurrent;

    const generatedPrior =
      cashFlowProfitBeforeTaxPrior +
      adjustmentsPrior +
      inventoryPrior +
      receivablesPrior +
      payablesPrior;

    if (adjustmentsRow) {
      adjustmentsRow.current = Math.round(adjustmentsCurrent);
      adjustmentsRow.prior = Math.round(adjustmentsPrior);
    }
    if (inventoryRow) {
      inventoryRow.current = Math.round(inventoryCurrent);
      inventoryRow.prior = Math.round(inventoryPrior);
    }
    if (receivablesRow) {
      receivablesRow.current = Math.round(receivablesCurrent);
      receivablesRow.prior = Math.round(receivablesPrior);
    }
    if (payablesRow) {
      payablesRow.current = Math.round(payablesCurrent);
      payablesRow.prior = Math.round(payablesPrior);
    }
    if (generatedRow) {
      generatedRow.current = Math.round(generatedCurrent);
      generatedRow.prior = Math.round(generatedPrior);
    }

    const mappedNoteTotal = (
      lines: any[] | undefined,
      side: "current" | "prior",
    ) =>
      (lines || []).reduce(
        (sum: number, line: any) =>
          sum + Number(line?.[side] || 0),
        0,
      );

    const mappedInterestReceivedCurrent = Math.max(
      0,
      -cashFlowMappedRawTotal(["770"], "current"),
    );

    const mappedInterestReceivedPrior = Math.abs(
      mappedNoteTotal(
        baseStatementEngine.noteData.investmentIncome,
        "prior",
      ),
    );

    const mappedFinanceCostsPaidCurrent = -Math.abs(
      cashFlowMappedRawTotal(["775"], "current"),
    );

    const mappedFinanceCostsPaidPrior = -Math.abs(
      mappedNoteTotal(
        baseStatementEngine.noteData.financeCosts,
        "prior",
      ),
    );

    /*
      Taxation in the SOCI is already presented with the correct cash-flow
      sign: an expense is negative and a tax credit is positive.

      A workbench amount remains an explicit override. When no override has
      been captured, use the mapped taxation amount automatically.
    */
    const exactMappedRawTotal = (
      mappingCode: string,
      side: "current" | "prior",
    ) =>
      (trialBalanceLines || [])
        .filter(
          (line) =>
            normaliseMappingIdentifier(line.mapping_code) ===
            normaliseMappingIdentifier(mappingCode),
        )
        .reduce(
          (sum, line) =>
            sum +
            (side === "current"
              ? rawCurrent(line)
              : rawPrior(line)),
          0,
        );

    /*
      Current tax paid is calculated from current-tax mappings only.
      Deferred tax mappings 395.10 and 795.20 are deliberately excluded.

      Tax paid =
        opening current-tax payable
        - opening current-tax receivable
        + current-tax expense
        - closing current-tax payable
        + closing current-tax receivable

      The cash-flow line is presented as a negative outflow.
    */
    const currentTaxExpenseCurrent = Math.abs(
      cashFlowMappedRawTotal(["795.10"], "current"),
    );

    const openingCurrentTaxReceivable = Math.abs(
      exactMappedRawTotal("495.10", "prior"),
    );
    const closingCurrentTaxReceivable = Math.abs(
      exactMappedRawTotal("495.10", "current"),
    );

    const openingCurrentTaxPayable = Math.abs(
      exactMappedRawTotal("695.10", "prior"),
    );
    const closingCurrentTaxPayable = Math.abs(
      exactMappedRawTotal("695.10", "current"),
    );

    const calculatedCurrentTaxPaid =
      openingCurrentTaxPayable -
      openingCurrentTaxReceivable +
      currentTaxExpenseCurrent -
      closingCurrentTaxPayable +
      closingCurrentTaxReceivable;

    const mappedTaxPaidCurrent =
      calculatedCurrentTaxPaid === 0
        ? 0
        : -Math.abs(calculatedCurrentTaxPaid);

    /*
      Comparative tax paid is reconstructed from TB History using only the
      dedicated current-tax mappings:

        695.10 current tax payable
        495.10 current tax receivable
        795.10 current tax expense

      Deferred-tax mappings remain excluded.
    */
    const mappedTaxPaidPrior = historicalCashFlowData.hasTwoDistinctYears
      ? historicalCashFlowData.taxPaidPrior
      : 0;

    const interestReceivedCurrent =
      effectiveStatementOverrides.cashInterestReceivedCurrent !== null &&
      effectiveStatementOverrides.cashInterestReceivedCurrent !== undefined
        ? Number(
            effectiveStatementOverrides.cashInterestReceivedCurrent || 0,
          )
        : mappedInterestReceivedCurrent;

    const interestReceivedPrior =
      effectiveStatementOverrides.cashInterestReceivedPrior !== null &&
      effectiveStatementOverrides.cashInterestReceivedPrior !== undefined
        ? Number(
            effectiveStatementOverrides.cashInterestReceivedPrior || 0,
          )
        : mappedInterestReceivedPrior;

    const financeCostsPaidCurrent =
      effectiveStatementOverrides.cashFinanceCostsPaidCurrent !== null &&
      effectiveStatementOverrides.cashFinanceCostsPaidCurrent !== undefined
        ? Number(
            effectiveStatementOverrides.cashFinanceCostsPaidCurrent || 0,
          )
        : mappedFinanceCostsPaidCurrent;

    const financeCostsPaidPrior =
      effectiveStatementOverrides.cashFinanceCostsPaidPrior !== null &&
      effectiveStatementOverrides.cashFinanceCostsPaidPrior !== undefined
        ? Number(
            effectiveStatementOverrides.cashFinanceCostsPaidPrior || 0,
          )
        : mappedFinanceCostsPaidPrior;

    const manualTaxPaidCurrent = Number(
      effectiveStatementOverrides.cashTaxPaidCurrent || 0,
    );
    const manualTaxPaidPrior = Number(
      effectiveStatementOverrides.cashTaxPaidPrior || 0,
    );

    /*
      Blank workbench inputs are persisted as zero. A saved zero must not
      suppress a real tax payment calculated from the exact current-tax
      mappings. A non-zero workbench amount remains an explicit override.
    */
    /*
      If current-tax mappings exist, they are authoritative. This prevents a
      stale Workbench value (for example a deferred-tax asset movement) from
      being presented as cash taxation paid. A manual amount is only a fallback
      when the TB contains no current-tax mapping data at all.
    */
    const hasCurrentTaxMappingData = (trialBalanceLines || []).some((line) => {
      const code = String(line.mapping_code || "").trim();
      return (
        code === "795.10" ||
        code.startsWith("795.10.") ||
        code === "495.10" ||
        code.startsWith("495.10.") ||
        code === "695.10" ||
        code.startsWith("695.10.")
      );
    });

    /*
      Cash taxation paid is mapping-driven only.

      IMPORTANT: cashTaxPaidCurrent / cashTaxPaidPrior can contain stale values
      carried forward from older Workbench saves or a rollover. Those values
      must never become cash tax automatically — especially where the source
      balance is deferred tax.

      Only the dedicated CURRENT-tax mappings may create a taxation-paid cash
      flow. If there is no current-tax mapping data, taxation paid is zero.
      Deferred tax mappings (395.10 / 595.10 / 795.20) therefore remain
      entirely non-cash.
    */
    /*
      CASH TAX FAIL-SAFE

      Do not infer cash taxation paid from tax expense, current-tax balances,
      deferred-tax balances, or rolled-forward Workbench values. Those are
      accounting balances and can be entirely non-cash.

      Until PP has a separately proven cash-tax-payment source, the printable
      cash-flow statement must show zero taxation paid rather than manufacture
      a cash outflow. This also prevents deferred tax from entering cash flow
      on rollover/comparatives.
    */
    /*
      Current-year cash tax is not inferred from a deferred/current tax balance.
      Comparative tax paid may be reconstructed from TB History using the exact
      current-tax mapping categories only. This preserves genuine prior cash tax
      (for example Alphaman 2024) without allowing deferred tax to leak into cash.
    */
    const taxPaidCurrent = 0;

    /*
      Comparative cash tax is only allowed when the comparative TB actually
      contains a CURRENT-tax expense mapping (795.10). This stops a rolled
      deferred-tax balance from being reconstructed as comparative tax paid,
      while preserving genuine historical cash tax such as Alphaman 2024.
    */
    const hasPriorCurrentTaxExpense =
      Math.abs(cashFlowMappedRawTotal(["795.10"], "prior")) > 0.5;

    /*
      PRIOR-YEAR TAX PAID VALIDATION

      A comparative tax amount is only accepted when it actually reconciles the
      comparative cash movement to the historical SFP cash movement. This avoids
      a deferred-tax balance (or stale rolled-forward tax value) being presented
      as cash tax paid.

      No year is hardcoded. For a genuine cash-tax year, the mapped current-tax
      amount will be the candidate that reconciles. If zero is the reconciler,
      tax paid stays zero.
    */
    const priorOtherOperatingForTaxTest = Number(
      effectiveStatementOverrides.cashOtherOperatingPrior || 0,
    );
    const priorOtherInvestingForTaxTest = Number(
      effectiveStatementOverrides.cashOtherInvestingPrior || 0,
    );
    const priorMovementBeforeTax =
      generatedPrior +
      interestReceivedPrior +
      financeCostsPaidPrior +
      priorOtherOperatingForTaxTest +
      purchasePpePrior +
      Number(disposalPpeRow?.prior || 0) +
      priorOtherInvestingForTaxTest +
      Number(netFinancingRow?.prior || 0);

    const historicalPriorMovement = Number(
      historicalCashFlowData.overrides.cashPriorMovement,
    );

    const hasHistoricalPriorMovement =
      historicalCashFlowData.hasTwoDistinctYears &&
      Number.isFinite(historicalPriorMovement);

    const priorDifferenceWithMappedTax = hasHistoricalPriorMovement
      ? Math.abs(
          priorMovementBeforeTax + mappedTaxPaidPrior - historicalPriorMovement,
        )
      : Number.POSITIVE_INFINITY;

    const priorDifferenceWithZeroTax = hasHistoricalPriorMovement
      ? Math.abs(priorMovementBeforeTax - historicalPriorMovement)
      : Number.POSITIVE_INFINITY;

    const taxPaidPrior =
      hasPriorCurrentTaxExpense &&
      (!hasHistoricalPriorMovement ||
        priorDifferenceWithMappedTax < priorDifferenceWithZeroTax)
        ? mappedTaxPaidPrior
        : 0;

    if (interestReceivedRow) {
      interestReceivedRow.current = Math.round(interestReceivedCurrent);
      interestReceivedRow.prior = Math.round(interestReceivedPrior);
    }

    if (financeCostsPaidRow) {
      financeCostsPaidRow.current = Math.round(financeCostsPaidCurrent);
      financeCostsPaidRow.prior = Math.round(financeCostsPaidPrior);
    }

    if (taxPaidRow) {
      taxPaidRow.current = Math.round(taxPaidCurrent);
      taxPaidRow.prior = Math.round(taxPaidPrior);
    }

    const otherOperatingCurrent =
      Number(effectiveStatementOverrides.cashOtherOperatingCurrent || 0);
    const otherOperatingPrior =
      Number(effectiveStatementOverrides.cashOtherOperatingPrior || 0);

    if (otherOperatingRow) {
      otherOperatingRow.current = Math.round(otherOperatingCurrent);
      otherOperatingRow.prior = Math.round(otherOperatingPrior);
    }

    const netOperatingCurrent =
      generatedCurrent +
      interestReceivedCurrent +
      financeCostsPaidCurrent +
      taxPaidCurrent +
      otherOperatingCurrent;
    const netOperatingPrior =
      generatedPrior +
      interestReceivedPrior +
      financeCostsPaidPrior +
      taxPaidPrior +
      otherOperatingPrior;

    if (netOperatingRow) {
      netOperatingRow.current = Math.round(netOperatingCurrent);
      netOperatingRow.prior = Math.round(netOperatingPrior);
    }

  const otherInvestingCurrent =
  Number(effectiveStatementOverrides.cashOtherInvestingCurrent || 0);

const otherInvestingPrior =
  Number(effectiveStatementOverrides.cashOtherInvestingPrior || 0);

if (otherInvestingRow) {
  otherInvestingRow.current = Math.round(otherInvestingCurrent);
  otherInvestingRow.prior = Math.round(otherInvestingPrior);
}

const netInvestingCurrent =
  purchasePpeCurrent +
  Number(disposalPpeRow?.current || 0) +
  otherInvestingCurrent;

const netInvestingPrior =
  purchasePpePrior +
  Number(disposalPpeRow?.prior || 0) +
  otherInvestingPrior;

    if (netInvestingRow) {
      netInvestingRow.current = Math.round(netInvestingCurrent);
      netInvestingRow.prior = Math.round(netInvestingPrior);
    }

    const netMovementCurrent =
      netOperatingCurrent +
      netInvestingCurrent +
      Number(netFinancingRow?.current || 0);

    const netMovementPrior =
      netOperatingPrior +
      netInvestingPrior +
      Number(netFinancingRow?.prior || 0);

    if (netMovementRow) {
      netMovementRow.current = Math.round(netMovementCurrent);
      netMovementRow.prior = Math.round(netMovementPrior);
    }

    const openingCurrent = Number(
      baseStatementEngine.checks.cashClosingPriorFromSfp || 0,
    );
    const openingPrior =
      effectiveStatementOverrides.cashPriorOpeningBalance !== null &&
      effectiveStatementOverrides.cashPriorOpeningBalance !== undefined
        ? Number(effectiveStatementOverrides.cashPriorOpeningBalance || 0)
        : 0;

    if (openingCashRow) {
      openingCashRow.current = Math.round(openingCurrent);
      openingCashRow.prior = Math.round(openingPrior);
    }

    const calculatedClosingCurrent = openingCurrent + netMovementCurrent;
const calculatedClosingPrior = openingPrior + netMovementPrior;

const sfpClosingCurrent = Number(
  baseStatementEngine.checks.cashClosingFromSfp || 0,
);
const sfpClosingPrior = Number(
  baseStatementEngine.checks.cashClosingPriorFromSfp || 0,
);

const rawRoundingCurrent =
  Math.round(sfpClosingCurrent) - Math.round(calculatedClosingCurrent);

const rawRoundingPrior =
  Math.round(sfpClosingPrior) - Math.round(calculatedClosingPrior);

const roundingCurrent =
  Math.abs(rawRoundingCurrent) <= 1 ? rawRoundingCurrent : 0;

const roundingPrior =
  Math.abs(rawRoundingPrior) <= 1 ? rawRoundingPrior : 0;

const closingRowIndex = rows.findIndex((row: any) => {
  const id = String(row?.id || "").toLowerCase();
  const label = String(row?.label || "").toLowerCase();

  return (
    id === "cfs-closing-cash" ||
    label.includes("cash and cash equivalents at end of year")
  );
});

const existingRoundingRow = rows.find(
  (row: any) => String(row?.id || "") === "cfs-rounding-adjustment",
);

if (existingRoundingRow) {
  existingRoundingRow.current = roundingCurrent;
  existingRoundingRow.prior = roundingPrior;
} else if (
  closingRowIndex >= 0 &&
  (roundingCurrent !== 0 || roundingPrior !== 0)
) {
  rows.splice(closingRowIndex, 0, {
    id: "cfs-rounding-adjustment",
    label: "Rounding adjustment",
    note: "",
    current: roundingCurrent,
    prior: roundingPrior,
    type: "line",
    kind: "line",
    indent: 0,
  });
}

const finalClosingCurrent =
  calculatedClosingCurrent + roundingCurrent;

const finalClosingPrior =
  calculatedClosingPrior + roundingPrior;

if (closingCashRow) {
  closingCashRow.current = Math.round(finalClosingCurrent);
  closingCashRow.prior = Math.round(finalClosingPrior);
}

    const checks = {
      ...baseStatementEngine.checks,
      cashMovementFromCashFlow: Math.round(netMovementCurrent),
      cashClosingFromCashFlow: Math.round(finalClosingCurrent),
      cashFlowMovementDifference: Math.round(
        netMovementCurrent - Number(baseStatementEngine.checks.cashMovementFromSfp || 0),
      ),
      cashFlowClosingDifference: Math.round(
  finalClosingCurrent - sfpClosingCurrent,
),
      cashOpeningPrior: Math.round(openingPrior),
      cashMovementPriorFromCashFlow: Math.round(netMovementPrior),
      cashClosingPriorFromCashFlow: Math.round(finalClosingPrior),
      cashFlowPriorClosingDifference: Math.round(
  finalClosingPrior - sfpClosingPrior,
),
    };

    const cashFlowMethod =
      effectiveStatementOverrides.cashFlowMethod || "indirect";

    if (cashFlowMethod === "direct") {
      const noteTotal = (
        lines: any[] | undefined,
        side: "current" | "prior",
      ) =>
        (lines || []).reduce(
          (sum: number, line: any) =>
            sum + Number(line?.[side] || 0),
          0,
        );

      const mappedRawTotal = (
        requiredTerms: string[],
        side: "current" | "prior",
      ) =>
        (trialBalanceLines || [])
          .filter((line) => {
            const mappingText = lineSearchText(line);

            return requiredTerms.every((term) =>
              mappingText.includes(term),
            );
          })
          .reduce(
            (sum, line) =>
              sum +
              (side === "current"
                ? rawCurrent(line)
                : rawPrior(line)),
            0,
          );

      const revenueCurrent = -cashFlowMappedRawTotal(["700"], "current");

      const revenuePrior = noteTotal(
        baseStatementEngine.noteData.revenue,
        "prior",
      );

      const otherIncomeCurrent = -cashFlowMappedRawTotal(
        ["730", "770", "780", "781", "785"],
        "current",
      );

      const otherIncomePrior =
        noteTotal(baseStatementEngine.noteData.otherOperatingIncome, "prior") +
        noteTotal(baseStatementEngine.noteData.investmentIncome, "prior") +
        noteTotal(baseStatementEngine.noteData.otherGainsLosses, "prior");

      const financeCostsCurrent = Math.abs(
        cashFlowMappedRawTotal(["775"], "current"),
      );

      const financeCostsPrior = Math.abs(
        noteTotal(
          baseStatementEngine.noteData.financeCosts,
          "prior",
        ),
      );

      const profitBeforeTaxCurrent =
        Number(profitRow?.current || 0);

      const profitBeforeTaxPrior =
        Number(profitRow?.prior || 0);

      /*
        Profit before tax =
          revenue
          + other income
          - cost of sales
          - operating expenses
          - finance costs

        Therefore cost of sales plus operating expenses =
          profit before tax
          - revenue
          - other income
          + finance costs
      */
      const tradingAndOperatingExpensesCurrent =
        profitBeforeTaxCurrent -
        revenueCurrent -
        otherIncomeCurrent +
        financeCostsCurrent;

      const tradingAndOperatingExpensesPrior =
        profitBeforeTaxPrior -
        revenuePrior -
        otherIncomePrior +
        financeCostsPrior;

      const mappedNonCashExpense = (side: "current" | "prior") =>
        side === "current"
          ? mappedDepreciationAmortisationCurrent
          : mappedDepreciationAmortisationPrior;

      /*
        Non-cash expenses are added back to the negative expense total.
        Use the mapped TB amounts automatically instead of relying on a
        manually completed cash-flow note.
      */
      const operatingNonCashAdjustmentCurrent =
        mappedNonCashExpense("current") +
        storedAmount("lossOnSaleAssetsLiabilities", "current", 0) +
        storedAmount("fairValueGainsLosses", "current", 0) +
        storedAmount("movementProvisions", "current", 0) +
        storedAmount("otherNonCash1", "current", 0);

      const operatingNonCashAdjustmentPrior =
        mappedNonCashExpense("prior") +
        storedAmount("lossOnSaleAssetsLiabilities", "prior", 0) +
        storedAmount("fairValueGainsLosses", "prior", 0) +
        storedAmount("movementProvisions", "prior", 0) +
        storedAmount("otherNonCash1", "prior", 0);

      /*
        Direct Method:

        Cash receipts from customers
        = revenue + decrease / (increase) in receivables

        Cash paid to suppliers and employees
        = cost of sales and operating expenses
          + non-cash adjustments
          + inventory movement
          + payables movement
      */
      const tradeReceivablesCurrentBalance = noteTotal(
        baseStatementEngine.noteData.tradeReceivables,
        "current",
      );

      const tradeReceivablesPriorBalance = noteTotal(
        baseStatementEngine.noteData.tradeReceivables,
        "prior",
      );

      /*
        Current-year receivables movement is calculated directly from
        the mapped SFP balances.

        Prior comparative movement comes from the stored historical TB,
        because the opening comparative balance is not in the current TB.
      */
      const directReceivablesMovementCurrent =
        tradeReceivablesPriorBalance -
        tradeReceivablesCurrentBalance;

      const directReceivablesMovementPrior =
        historicalCashFlowData.receivablesPrior;

      /*
        Customer receipts use the working-capital movement already
        controlled by the Cash generated from operations note.
      */
      const directReceiptsCurrentCalculated =
        revenueCurrent + receivablesCurrent;

      const directReceiptsPriorCalculated =
        revenuePrior + receivablesPrior;

      /*
        Direct-method customer receipts are always rebuilt from the mapped
        revenue and receivables movement. Rolled-forward Workbench values must
        never override the mapped calculation for a new year.
      */
      const directReceiptsCurrent = directReceiptsCurrentCalculated;
      const directReceiptsPrior = directReceiptsPriorCalculated;

      /*
        DIRECT METHOD — suppliers and employees

        Do NOT derive this backwards from "cash generated from operations".
        That subtotal also contains finance-cost and investment-income
        adjustments, which caused Perfect Wood's 2026 supplier payment to be
        understated by R70.

        Start with cost of sales + operating expenses, then:
          + add back non-cash operating expenses
          + apply inventory movement
          + apply trade-payables / deferred-income movement

        Receivables belong in customer receipts, not supplier payments.
        Finance costs and investment income are shown separately below.
      */
      const directPaymentsCurrentCalculated =
        tradingAndOperatingExpensesCurrent +
        operatingNonCashAdjustmentCurrent +
        inventoryCurrent +
        payablesCurrent;

      const directPaymentsPriorCalculated =
        tradingAndOperatingExpensesPrior +
        operatingNonCashAdjustmentPrior +
        inventoryPrior +
        payablesPrior;

      /*
        Direct-method supplier / employee payments are mapping-driven.
        Never reuse a saved or rolled-forward direct-method amount: those stale
        values were causing prior-year cash flows to remain wrong after rollover.
      */
      const directPaymentsCurrent = directPaymentsCurrentCalculated;
      const directPaymentsPrior = directPaymentsPriorCalculated;

      const noteInterestReceived = (
        side: "current" | "prior",
      ) =>
        (baseStatementEngine.noteData.investmentIncome || [])
          .filter((line: any) =>
            String(line?.label || "")
              .toLowerCase()
              .includes("interest"),
          )
          .reduce(
            (sum: number, line: any) =>
              sum + Math.abs(Number(line?.[side] || 0)),
            0,
          );

      const directInterestReceivedCurrent =
        effectiveStatementOverrides.cashInterestReceivedCurrent !== null &&
        effectiveStatementOverrides.cashInterestReceivedCurrent !== undefined
          ? Number(
              effectiveStatementOverrides.cashInterestReceivedCurrent || 0,
            )
          : mappedInterestReceivedCurrent;

      const directInterestReceivedPrior =
        effectiveStatementOverrides.cashInterestReceivedPrior !== null &&
        effectiveStatementOverrides.cashInterestReceivedPrior !== undefined
          ? Number(
              effectiveStatementOverrides.cashInterestReceivedPrior || 0,
            )
          : noteInterestReceived("prior");

      const directFinanceCostsPaidCurrent =
        -Math.abs(
          storedAmount(
            "financeCosts",
            "current",
            financeCostsCurrent,
          ),
        );

      const directFinanceCostsPaidPrior =
        -Math.abs(
          storedAmount(
            "financeCosts",
            "prior",
            financeCostsPrior,
          ),
        );

      const directOtherOperatingCurrent = 0;
      const directOtherOperatingPrior = 0;

      const directNetOperatingCurrent =
        directReceiptsCurrent +
        directPaymentsCurrent +
        directOtherOperatingCurrent +
        directInterestReceivedCurrent +
        directFinanceCostsPaidCurrent +
        taxPaidCurrent +
        otherOperatingCurrent;

      const directNetOperatingPrior =
        directReceiptsPrior +
        directPaymentsPrior +
        directOtherOperatingPrior +
        directInterestReceivedPrior +
        directFinanceCostsPaidPrior +
        taxPaidPrior +
        otherOperatingPrior;

      /*
        The direct-method net cash movement must equal the three subtotals
        displayed on the statement:

          operating activities
          + investing activities
          + financing activities

        Use the completed section totals directly so that finance costs and
        every other operating cash-flow item cannot be omitted from the final
        movement calculation.
      */
      /*
        NEVER plug an unexplained cash-flow difference into financing.

        Financing rows may only contain mapped financing movements or explicit
        Workbench amounts already calculated above. If the statement does not
        reconcile after those genuine movements, the difference must remain a
        FlightDeck blocker instead of being fabricated as financing cash flow.
      */
      const calculatedDirectNetMovementCurrent =
  directNetOperatingCurrent +
  Number(netInvestingRow?.current || 0) +
  Number(netFinancingRow?.current || 0);

const calculatedDirectNetMovementPrior =
  directNetOperatingPrior +
  Number(netInvestingRow?.prior || 0) +
  Number(netFinancingRow?.prior || 0);

const directRawDifferenceCurrent =
  Math.round(sfpClosingCurrent) -
  Math.round(openingCurrent + calculatedDirectNetMovementCurrent);

const directRawDifferencePrior =
  Math.round(sfpClosingPrior) -
  Math.round(openingPrior + calculatedDirectNetMovementPrior);

const directRoundingTolerance = Math.max(
  0,
  Math.round(Number(effectiveStatementOverrides.roundingTolerance ?? 5)),
);

/*
  A rounding line may only absorb a genuinely small difference. Large
  differences remain visible through FlightDeck instead of being hidden as
  rounding adjustments.
*/
const directRoundingCurrent =
  Math.abs(directRawDifferenceCurrent) <= directRoundingTolerance
    ? directRawDifferenceCurrent
    : 0;

const directRoundingPrior =
  Math.abs(directRawDifferencePrior) <= directRoundingTolerance
    ? directRawDifferencePrior
    : 0;

const directNetMovementCurrent =
  calculatedDirectNetMovementCurrent + directRoundingCurrent;

const directNetMovementPrior =
  calculatedDirectNetMovementPrior + directRoundingPrior;

const directClosingCurrent =
  openingCurrent + directNetMovementCurrent;

const directClosingPrior =
  openingPrior + directNetMovementPrior;

      const directRows = rows.filter((row: any) => {
        const id = String(row?.id || "");

        return ![
          "cfs-profit-before-tax",
          "cfs-adjustments",
          "cfs-inventories",
          "cfs-trade-receivables",
          "cfs-trade-payables",
          "cfs-cash-generated-operations",
          "cfs-rounding-adjustment",
          "cfs-direct-rounding-adjustment",
        ].includes(id);
      });

      const operatingIndex = directRows.findIndex(
        (row: any) => String(row?.id || "") === "cfs-operating",
      );

      directRows.splice(operatingIndex + 1, 0,
        {
          id: "cfs-direct-receipts-customers",
          label: "Cash receipts from customers",
          current: Math.round(directReceiptsCurrent),
          prior: Math.round(directReceiptsPrior),
          type: "line",
        },
        {
          id: "cfs-direct-payments-suppliers-employees",
          label: "Cash paid to suppliers and employees",
          current: Math.round(directPaymentsCurrent),
          prior: Math.round(directPaymentsPrior),
          type: "line",
        },
        {
          id: "cfs-direct-other-operating",
          label: "Other direct operating cash flows",
          current: Math.round(directOtherOperatingCurrent),
          prior: Math.round(directOtherOperatingPrior),
          type: "line",
        },
      );

      const directNetMovementIndex = directRows.findIndex((row: any) => {
  const id = String(row?.id || "");
  const label = String(row?.label || "").toLowerCase();

  return (
    id === "cfs-net-movement" ||
    id === "cfs-cash-movement" ||
    label.includes(
      "net increase / (decrease) in cash and cash equivalents",
    )
  );
});

if (
  directNetMovementIndex >= 0 &&
  (directRoundingCurrent !== 0 || directRoundingPrior !== 0)
) {
  directRows.splice(directNetMovementIndex, 0, {
    id: "cfs-direct-rounding-adjustment",
    label: "Rounding adjustment",
    current: Math.round(directRoundingCurrent),
    prior: Math.round(directRoundingPrior),
    type: "line",
  });
}

      const directInterestReceivedRow = directRows.find(
        (row: any) =>
          String(row?.id || "") === "cfs-interest-received",
      );

      const directFinanceCostsPaidRow = directRows.find(
        (row: any) =>
          String(row?.id || "") === "cfs-finance-costs-paid",
      );

      if (directInterestReceivedRow) {
        directInterestReceivedRow.current = Math.round(
          directInterestReceivedCurrent,
        );
        directInterestReceivedRow.prior = Math.round(
          directInterestReceivedPrior,
        );
      }

      if (directFinanceCostsPaidRow) {
        directFinanceCostsPaidRow.current = Math.round(
          directFinanceCostsPaidCurrent,
        );
        directFinanceCostsPaidRow.prior = Math.round(
          directFinanceCostsPaidPrior,
        );
      }

      const directNetOperatingRow = directRows.find(
        (row: any) => String(row?.id || "") === "cfs-net-operating",
      );

      const directNetMovementRow =
        directRows.find(
          (row: any) => String(row?.id || "") === "cfs-net-movement",
        ) ||
        directRows.find((row: any) =>
          String(row?.label || "")
            .toLowerCase()
            .includes("net increase / (decrease) in cash and cash equivalents"),
        );

      const directOpeningRow =
        directRows.find(
          (row: any) => String(row?.id || "") === "cfs-opening-cash",
        ) ||
        directRows.find((row: any) =>
          String(row?.label || "")
            .toLowerCase()
            .includes("cash and cash equivalents at beginning of year"),
        );

      const directClosingRow =
        directRows.find(
          (row: any) => String(row?.id || "") === "cfs-closing-cash",
        ) ||
        directRows.find((row: any) =>
          String(row?.label || "")
            .toLowerCase()
            .includes("cash and cash equivalents at end of year"),
        );

      if (directNetOperatingRow) {
        directNetOperatingRow.current = Math.round(
          directNetOperatingCurrent,
        );
        directNetOperatingRow.prior = Math.round(
          directNetOperatingPrior,
        );
      }

      if (directNetMovementRow) {
        directNetMovementRow.current = Math.round(
          directNetMovementCurrent,
        );
        directNetMovementRow.prior = Math.round(
          directNetMovementPrior,
        );
      }

      if (directOpeningRow) {
        directOpeningRow.current = Math.round(openingCurrent);
        directOpeningRow.prior = Math.round(openingPrior);
      }

      if (directClosingRow) {
        directClosingRow.current = Math.round(directClosingCurrent);
        directClosingRow.prior = Math.round(directClosingPrior);
      }

      return {
        ...baseStatementEngine,
        cashFlowRows: directRows,
        checks: {
          ...checks,
          sfpAssetsTotal: Math.round(
            Number(
              (baseStatementEngine.sfpRows || []).find(
                (row: any) => String(row?.id || "") === "assets-total",
              )?.current || 0,
            ),
          ),
          sfpEquityAndLiabilitiesTotal: Math.round(
            Number(
              (baseStatementEngine.sfpRows || []).find(
                (row: any) => String(row?.id || "") === "eql-total",
              )?.current || 0,
            ),
          ),
          sfpDifference: (() => {
            const a = Math.round(
              Number(
                (baseStatementEngine.sfpRows || []).find(
                  (row: any) => String(row?.id || "") === "assets-total",
                )?.current || 0,
              ),
            );
            const e = Math.round(
              Number(
                (baseStatementEngine.sfpRows || []).find(
                  (row: any) => String(row?.id || "") === "eql-total",
                )?.current || 0,
              ),
            );
            return Math.abs(a - e) <= 1 ? 0 : a - e;
          })(),
          cashMovementFromCashFlow: Math.round(
            directNetMovementCurrent,
          ),
          cashClosingFromCashFlow: Math.round(
            directClosingCurrent,
          ),
          cashFlowMovementDifference: Math.round(
            directNetMovementCurrent -
              Number(
                baseStatementEngine.checks.cashMovementFromSfp || 0,
              ),
          ),
          cashFlowClosingDifference: Math.round(
            directClosingCurrent - sfpClosingCurrent,
          ),
          cashMovementPriorFromCashFlow: Math.round(
            directNetMovementPrior,
          ),
          cashClosingPriorFromCashFlow: Math.round(
            directClosingPrior,
          ),
          cashFlowPriorClosingDifference: Math.round(
            directClosingPrior - sfpClosingPrior,
          ),
        },
      };
    }

    return {
      ...baseStatementEngine,
      cashFlowRows: rows,
      checks,
    };
  }, [
    baseStatementEngine,
    effectiveStructuredNotesState,
    effectiveStatementOverrides,
    trialBalanceHistory,
    historicalCashFlowData,
  ]);

  const correctedEquityStatements = useMemo(() => {
  const sfpRows = (statementEngine.sfpRows || []).map((row: any) => ({
    ...row,
  }));

  const sceRows = (statementEngine.sceRows || []).map((row: any) => ({
    ...row,
  }));

  const retainedIncomeRow = sfpRows.find(
    (row: any) =>
      String(row?.id || "") === "retained-income-adjusted" ||
      String(row?.label || "").toLowerCase().includes("retained income") ||
      String(row?.label || "").toLowerCase().includes("accumulated loss"),
  );

  const totalEquityRow = sfpRows.find(
    (row: any) =>
      String(row?.label || "").trim().toLowerCase() === "total equity",
  );

  const totalEquityAndLiabilitiesRow = sfpRows.find(
    (row: any) =>
      String(row?.label || "").trim().toLowerCase() ===
      "total equity and liabilities",
  );

  const currentProfitRow = sceRows.find(
    (row: any) => String(row?.id || "") === "sce-current-profit",
  );

  const priorClosingRetainedRow = sceRows.find(
    (row: any) =>
      String(row?.id || "") === "sce-prior-closing-retained",
  );

  const currentOtherMovementRow = sceRows.find(
    (row: any) =>
      String(row?.id || "") === "sce-current-other-movement",
  );

  const currentClosingRetainedRow = sceRows.find(
    (row: any) => String(row?.id || "") === "sce-retained-closing",
  );

  /*
    The statement engine owns the SCE roll-forward.

    Print Studio must not manufacture an "Other movements" amount from the
    mapped retained-income TB line. That creates false equity movements on
    first-year PracticePilot files and prevents the current-year profit/loss
    from flowing correctly into accumulated income/loss on the SFP.
  */
  const priorClosingRetained = Math.round(
    Number(priorClosingRetainedRow?.current || retainedIncomeRow?.prior || 0),
  );

  const currentProfit = Math.round(
    Number(currentProfitRow?.current || 0),
  );

  const currentOtherMovement = Math.round(
    Number(currentOtherMovementRow?.current || 0),
  );

  const correctedCurrentClosingRetained = Math.round(
    Number(
      currentClosingRetainedRow?.current ??
        (priorClosingRetained + currentProfit + currentOtherMovement),
    ),
  );

  const retainedIncomeAdjustment =
    correctedCurrentClosingRetained -
    Math.round(Number(retainedIncomeRow?.current || 0));

  if (priorClosingRetainedRow) {
    priorClosingRetainedRow.current = priorClosingRetained;
  }

  if (retainedIncomeRow) {
    retainedIncomeRow.current = correctedCurrentClosingRetained;
  }

  if (totalEquityRow && retainedIncomeAdjustment !== 0) {
    totalEquityRow.current = Math.round(
      Number(totalEquityRow.current || 0) +
        retainedIncomeAdjustment,
    );
  }

  if (totalEquityAndLiabilitiesRow && retainedIncomeAdjustment !== 0) {
    totalEquityAndLiabilitiesRow.current = Math.round(
      Number(totalEquityAndLiabilitiesRow.current || 0) +
        retainedIncomeAdjustment,
    );
  }

  if (currentOtherMovementRow) {
    currentOtherMovementRow.current = currentOtherMovement;
  }

  if (currentClosingRetainedRow) {
    currentClosingRetainedRow.current = correctedCurrentClosingRetained;
  }

  /*
    FINAL DISPLAY ROUNDING:
    Print Studio recalculates retained income after the statement engine,
    which can reintroduce a R1/R2 SFP difference. Absorb only a tiny
    presentation difference into accumulated loss / retained income.
  */
  const assetsTotalRow = sfpRows.find(
    (row: any) => String(row?.id || "") === "assets-total",
  );

  const finalEqlRow = sfpRows.find(
    (row: any) => String(row?.id || "") === "eql-total",
  );

  const displayDifference =
    Math.round(Number(assetsTotalRow?.current || 0)) -
    Math.round(Number(finalEqlRow?.current || 0));

  if (
    retainedIncomeRow &&
    totalEquityRow &&
    finalEqlRow &&
    Math.abs(displayDifference) <= 2 &&
    displayDifference !== 0
  ) {
    retainedIncomeRow.current =
      Math.round(Number(retainedIncomeRow.current || 0)) +
      displayDifference;

    totalEquityRow.current =
      Math.round(Number(totalEquityRow.current || 0)) +
      displayDifference;

    finalEqlRow.current =
      Math.round(Number(finalEqlRow.current || 0)) +
      displayDifference;

    if (currentClosingRetainedRow) {
      currentClosingRetainedRow.current =
        Math.round(Number(currentClosingRetainedRow.current || 0)) +
        displayDifference;
    }
  }

  return {
    sfpRows,
    sceRows,
  };
}, [statementEngine.sfpRows, statementEngine.sceRows]);

function ccStatementRowLabel(value: unknown) {
  // Compatibility pass-through only.
  // Entity-specific SFP wording is handled centrally by afsEntityPresentation.
  return String(value || "").trim();
}

const applyEntityPresentationToRows = (rows: AfsStatementRow[]) =>
  applyProfessionalStatementLabels(rows).map((row: any) => {
    const entityLabel = getAfsEntityRowLabel(row?.label, entityPresentation);

    return {
      ...row,
      label: ccStatementRowLabel(entityLabel),
    };
  });

const sfpRows = applyEntityPresentationToRows(
  correctedEquityStatements.sfpRows,
);
const sociRows = applyEntityPresentationToRows(
  statementEngine.sociRows,
);
const sceRows = applyEntityPresentationToRows(
  correctedEquityStatements.sceRows,
);
const cashFlowRows = applyEntityPresentationToRows(
  statementEngine.cashFlowRows,
);

const renderedSfpBalanceDifference = useMemo(() => {
  const findAmount = (
    rows: AfsStatementRow[],
    label: string,
    side: "current" | "prior",
  ) => {
    const row = (rows || []).find(
      (item: any) =>
        String(item?.label || "").trim().toLowerCase() ===
        label.toLowerCase(),
    ) as any;

    return Math.round(Number(row?.[side] || 0));
  };

  return {
    current:
      findAmount(sfpRows, "Total assets", "current") -
      findAmount(sfpRows, "Total equity and liabilities", "current"),
    prior:
      findAmount(sfpRows, "Total assets", "prior") -
      findAmount(sfpRows, "Total equity and liabilities", "prior"),
  };
}, [sfpRows]);

const flightDeckIssues = useMemo(() => {
  const issues = buildAfsFlightDeckIssuesFromEngine(statementEngine);

  const sfpRoundingTolerance = 5;

  if (
    Math.abs(renderedSfpBalanceDifference.current) > sfpRoundingTolerance ||
    Math.abs(renderedSfpBalanceDifference.prior) > sfpRoundingTolerance
  ) {
    return issues;
  }

  return issues.filter((issue: any) => {
    const issueText = JSON.stringify(issue || {}).toLowerCase();
    const isStatementOfFinancialPositionIssue =
      issueText.includes("statement of financial position") ||
      issueText.includes('"sfp"');

    return !isStatementOfFinancialPositionIssue;
  });
}, [statementEngine, renderedSfpBalanceDifference]);

  function consolidateDetailedIncomeRows(rows: AfsStatementRow[]) {
    const result: AfsStatementRow[] = [];
    const indexByKey = new Map<string, number>();

    for (const row of rows || []) {
      const item = row as any;
      const type = String(item?.type || "").toLowerCase();
      const label = String(item?.label || "").trim();
      const normalisedLabel = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

      const isDetail =
        type !== "heading" &&
        type !== "subtotal" &&
        type !== "total" &&
        type !== "grand-total";

      const isGenericOtherExpense =
        /^other expenses?(?:\s+\d+)?$/i.test(label);

      if (!isDetail || !normalisedLabel || isGenericOtherExpense) {
        result.push(row);
        continue;
      }

      const existingIndex = indexByKey.get(normalisedLabel);

      if (existingIndex === undefined) {
        indexByKey.set(normalisedLabel, result.length);
        result.push({ ...item });
        continue;
      }

      const existing = result[existingIndex] as any;
      existing.current =
        Number(existing.current || 0) + Number(item.current || 0);
      existing.prior =
        Number(existing.prior || 0) + Number(item.prior || 0);
    }

    return result;
  }

  const detailedIncomeRows = useMemo(() => {
    const rows = consolidateDetailedIncomeRows(
      cleanDetailedIncomeRowsForReport(
        statementEngine.detailedIncomeRows || [],
      ),
    );

    const profitBeforeTaxRow = (sociRows || []).find((row: any) =>
      String(row?.label || "").toLowerCase().includes("before taxation"),
    );

    const profitBeforeTaxCurrent = Math.round(Number((profitBeforeTaxRow as any)?.current || 0));
    const profitBeforeTaxPrior = Math.round(Number((profitBeforeTaxRow as any)?.prior || 0));

    const alreadyHasProfitBeforeTax = rows.some((row: any) =>
      String(row?.label || "").toLowerCase().includes("before taxation"),
    );

    if (alreadyHasProfitBeforeTax) return rows;

    const insertAt = rows.findIndex((row: any) =>
      String(row?.label || "").toLowerCase().includes("taxation"),
    );

    const profitBeforeTaxDetailedRow: AfsStatementRow = {
      id: "detailed-profit-before-tax",
      label: "Profit / (loss) before taxation",
      current: profitBeforeTaxCurrent,
      prior: profitBeforeTaxPrior,
      type: "subtotal",
    };

    if (insertAt < 0) return [...rows, profitBeforeTaxDetailedRow];

    return [
      ...rows.slice(0, insertAt),
      profitBeforeTaxDetailedRow,
      ...rows.slice(insertAt),
    ];
  }, [statementEngine.detailedIncomeRows, sociRows]);


  function isEditableDetailedIncomeOtherExpense(row: AfsStatementRow) {
    const label = String((row as any)?.label || "").trim();

    return /^other expenses?(?:\s+\d+)?$/i.test(label);
  }

  const detailedIncomeLabelOverrides = {
    ...(
      structuredNotesState?.detailedIncomeLabelOverrides &&
      typeof structuredNotesState.detailedIncomeLabelOverrides === "object"
        ? structuredNotesState.detailedIncomeLabelOverrides
        : {}
    ),
    ...(
      (statementOverrides as any)?.detailedIncomeLabelOverrides &&
      typeof (statementOverrides as any).detailedIncomeLabelOverrides ===
        "object"
        ? (statementOverrides as any).detailedIncomeLabelOverrides
        : {}
    ),
  };

  useEffect(() => {
    const sourceRows = alignDetailedIncomeRowsToSoci(
      detailedIncomeRows,
      sociRows,
    );

    const nextOverrides = {
      ...detailedIncomeLabelOverrides,
    };

    let changed = false;

    for (const row of sourceRows as any[]) {
      if (!isEditableDetailedIncomeOtherExpense(row)) continue;

      const rowId = String(row?.id || "");
      const originalLabel = String(row?.label || "").trim();

      const existingLabel = cleanString(
        nextOverrides[rowId] ||
          nextOverrides[originalLabel],
      );

      if (!existingLabel || existingLabel === originalLabel) continue;

      for (const key of detailedIncomeLabelAliasKeys(
        rowId,
        originalLabel,
      )) {
        if (nextOverrides[key] !== existingLabel) {
          nextOverrides[key] = existingLabel;
          changed = true;
        }
      }
    }

    if (changed) {
      saveDetailedIncomeLabelOverrides(nextOverrides);
    }
  }, [
    detailedIncomeRows,
    sociRows,
  ]);

  const editableDetailedIncomeRows = useMemo(
    () =>
      alignDetailedIncomeRowsToSoci(
        detailedIncomeRows,
        sociRows,
      ).map((row: any) => {
        const savedLabel = cleanString(
          detailedIncomeLabelOverrides[String(row?.id || "")],
        );

        return savedLabel
          ? {
              ...row,
              label: savedLabel,
            }
          : row;
      }),
    [
      detailedIncomeRows,
      sociRows,
      detailedIncomeLabelOverrides,
    ],
  );

  const editableOtherExpenseRows = useMemo(
    () =>
      alignDetailedIncomeRowsToSoci(
        detailedIncomeRows,
        sociRows,
      ).filter(isEditableDetailedIncomeOtherExpense),
    [detailedIncomeRows, sociRows],
  );

  function detailedIncomeLabelAliasKeys(
    rowId: string,
    originalLabel: string,
  ) {
    const keys = new Set<string>();
    const cleanRowId = String(rowId || "").trim();
    const cleanOriginalLabel = String(originalLabel || "").trim();

    if (cleanRowId) keys.add(cleanRowId);
    if (cleanOriginalLabel) keys.add(cleanOriginalLabel);

    const numberMatch = cleanOriginalLabel.match(
      /other\s*expenses?\s*(\d+)/i,
    );

    if (numberMatch?.[1]) {
      const number = numberMatch[1];
      keys.add(`Other Expenses ${number}`);
      keys.add(`otherExpenses${number}`);
      keys.add(`other_expenses_${number}`);
      keys.add(`other-expenses-${number}`);
    }

    return Array.from(keys);
  }

  function saveDetailedIncomeLabelOverrides(
    nextOverrides: Record<string, string>,
  ) {
    const nextStructuredNotesState = {
      ...structuredNotesState,
      detailedIncomeLabelOverrides: nextOverrides,
    };

    const nextStatementOverrides = {
      ...(statementOverrides as any),
      detailedIncomeLabelOverrides: nextOverrides,
    } as AfsStatementOverrides;

    setStructuredNotesState(nextStructuredNotesState);
    setStatementOverrides(nextStatementOverrides);

    try {
      window.localStorage.setItem(
        `practicepilot-afs-structured-notes:${engagementId}`,
        JSON.stringify(nextStructuredNotesState),
      );

      window.localStorage.setItem(
        `practicepilot-afs-print-studio:${engagementId}:statement-overrides`,
        JSON.stringify(nextStatementOverrides),
      );
    } catch {
      // Supabase remains the source of truth.
    }

    savePrintStudioSettingsToSupabase({
      structuredNotesState: nextStructuredNotesState,
      statementOverrides: nextStatementOverrides,
    });
  }

  function updateDetailedIncomeLabel(
    rowId: string,
    originalLabel: string,
    value: string,
  ) {
    const nextOverrides = {
      ...detailedIncomeLabelOverrides,
    };

    for (const key of detailedIncomeLabelAliasKeys(
      rowId,
      originalLabel,
    )) {
      nextOverrides[key] = value;
    }

    saveDetailedIncomeLabelOverrides(nextOverrides);
  }

  function resetDetailedIncomeLabel(
    rowId: string,
    originalLabel: string,
  ) {
    const nextOverrides = {
      ...detailedIncomeLabelOverrides,
    };

    for (const key of detailedIncomeLabelAliasKeys(
      rowId,
      originalLabel,
    )) {
      delete nextOverrides[key];
    }

    setDetailedIncomeInlineDrafts((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });

    saveDetailedIncomeLabelOverrides(nextOverrides);
  }

  function normaliseDetailedIncomeMatchValue(value: unknown) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function mappedAccountsForDetailedIncomeRow(row: any) {
    const originalLabel = String(row?.label || "").trim();
    const originalNormalised = normaliseDetailedIncomeMatchValue(originalLabel);
    const rowIdNormalised = normaliseDetailedIncomeMatchValue(row?.id);

    return trialBalanceLines
      .filter((line) => {
        const candidates = [
          line.mapping_label,
          line.mapping_category,
          line.mapping_code,
          line.mapping_leaf_id,
          line.lead_schedule_key,
        ].map(normaliseDetailedIncomeMatchValue);

        return candidates.some(
          (candidate) =>
            candidate &&
            (candidate === originalNormalised ||
              candidate === rowIdNormalised),
        );
      })
      .map((line) => ({
        code: String(line.account_code || "").trim(),
        name: String(line.account_name || "").trim(),
      }))
      .filter((line) => line.code || line.name);
  }

  function formatDetailedIncomeAmount(value: unknown) {
    const amount = Math.round(Number(value || 0));

    if (!amount) return "–";

    const absolute = Math.abs(amount).toLocaleString("en-GB");

    return amount < 0 ? `(${absolute})` : absolute;
  }

  function renderEditableDetailedIncomeStatement() {
    const sourceRows = alignDetailedIncomeRowsToSoci(
      detailedIncomeRows,
      sociRows,
    ).map((row: any) => ({
      ...row,
      label: getAfsEntityRowLabel(row?.label, entityPresentation),
    }));

    const hiddenSectionLabels = new Set([
      "revenue",
      "cost of sales",
      "operating expenses",
      "taxation",
    ]);

    return (
      <section style={{ fontSize: 10, lineHeight: 1.25, color: "#111827" }}>
        <h1 style={pageHeadingStyle()}>
          {entityPresentation.isNpc
            ? "Detailed Income and Expenditure Statement"
            : "Detailed Income Statement"}
        </h1>
        <div
          style={{
            margin: "-6px 0 12px",
            fontSize: 9.5,
            lineHeight: 1.35,
            fontWeight: 700,
            color: "#475569",
          }}
        >
          Supplementary information not forming part of the annual financial
          statements
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: hideComparatives
              ? "minmax(0, 1fr) 90px"
              : "minmax(0, 1fr) 90px 90px",
            columnGap: 12,
            borderBottom: "1px solid #111827",
            paddingBottom: 5,
            marginBottom: 4,
            fontSize: 9,
          }}
        >
          <div>Figures in Rand</div>
          <div style={{ textAlign: "right" }}>{currentHeading}</div>
          {!hideComparatives ? (
            <div style={{ textAlign: "right" }}>{priorHeading}</div>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 1 }}>
          {sourceRows.map((row: any) => {
            const rowId = String(row?.id || "");
            const originalLabel = String(row?.label || "").trim();
            const normalisedLabel = originalLabel.toLowerCase();
            const editable = isEditableDetailedIncomeOtherExpense(row);
            const savedLabel = cleanString(
              detailedIncomeLabelOverrides[rowId],
            );
            const draftValue =
              detailedIncomeInlineDrafts[rowId] !== undefined
                ? detailedIncomeInlineDrafts[rowId]
                : savedLabel || originalLabel;
            const mappedAccounts = editable
              ? mappedAccountsForDetailedIncomeRow(row)
              : [];
            const displayLabel = savedLabel || originalLabel;
            const type = String(row?.type || "").toLowerCase();
            const isHeading = type === "heading" ||type === "section" ||type === "subsection";
            const isSubtotal =
              type === "subtotal" ||
              type === "total" ||
              type === "grand-total";
            const hideHeading =
              isHeading && hiddenSectionLabels.has(normalisedLabel);

            if (hideHeading) return null;

            const editing =
              !isPdfExportMode &&
              editable &&
              detailedIncomeEditingRowId === rowId;

            return (
              <div
                key={rowId || `${originalLabel}-${row?.current}-${row?.prior}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: hideComparatives
                    ? "minmax(0, 1fr) 90px"
                    : "minmax(0, 1fr) 90px 90px",
                  columnGap: 12,
                  alignItems: "start",
                  padding: isHeading ? "5px 0 2px" : "2px 0",
                  fontWeight: isHeading || isSubtotal ? 800 : 400,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  {editing ? (
                    <div style={{ display: "grid", gap: 3 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={draftValue}
                          onChange={(event) =>
                            setDetailedIncomeInlineDrafts((current) => ({
                              ...current,
                              [rowId]: event.target.value,
                            }))
                          }
                          onBlur={() => {
                            const nextValue = cleanString(
                              detailedIncomeInlineDrafts[rowId] ??
                                savedLabel ??
                                originalLabel,
                            );

                            if (
                              nextValue &&
                              nextValue !== originalLabel
                            ) {
                              updateDetailedIncomeLabel(rowId, originalLabel, nextValue);
                            } else if (!nextValue) {
                              resetDetailedIncomeLabel(rowId, originalLabel);
                            }

                            setDetailedIncomeEditingRowId(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }

                            if (event.key === "Escape") {
                              setDetailedIncomeInlineDrafts((current) => ({
                                ...current,
                                [rowId]: savedLabel || originalLabel,
                              }));
                              setDetailedIncomeEditingRowId(null);
                            }
                          }}
                          style={{
                            width: "100%",
                            maxWidth: 300,
                            border: "1px solid #64748b",
                            borderRadius: 2,
                            outline: "none",
                            background: "#ffffff",
                            padding: "3px 5px",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#111827",
                          }}
                        />

                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            setDetailedIncomeEditingRowId(null)
                          }
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#475569",
                            padding: 0,
                            fontSize: 9,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                        }}
                      >
                        <span>{displayLabel}</span>

                        {!isPdfExportMode && editable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDetailedIncomeInlineDrafts((current) => ({
                                ...current,
                                [rowId]: savedLabel || originalLabel,
                              }));
                              setDetailedIncomeEditingRowId(rowId);
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              color: "#2563eb",
                              fontSize: 8,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                        ) : null}

                        {!isPdfExportMode && editable && savedLabel ? (
                          <button
                            type="button"
                            onClick={() =>
                              resetDetailedIncomeLabel(rowId, originalLabel)
                            }
                            style={{
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              color: "#64748b",
                              fontSize: 8,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Reset
                          </button>
                        ) : null}
                      </div>

                      {!isPdfExportMode &&
                      editable &&
                      mappedAccounts.length > 0 ? (
                        <div
                          style={{
                            marginTop: 1,
                            fontSize: 8,
                            lineHeight: 1.2,
                            color: "#64748b",
                          }}
                        >
                          {mappedAccounts
                            .map((account) =>
                              [account.code, account.name]
                                .filter(Boolean)
                                .join(" · "),
                            )
                            .join(" | ")}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    borderTop: isSubtotal
                      ? "1px solid #6b7280"
                      : "none",
                    paddingTop: isSubtotal ? 2 : 0,
                  }}
                >
                  {formatDetailedIncomeAmount(row?.current)}
                </div>

                {!hideComparatives ? (
                  <div
                    style={{
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      borderTop: isSubtotal
                        ? "1px solid #6b7280"
                        : "none",
                      paddingTop: isSubtotal ? 2 : 0,
                    }}
                  >
                    {formatDetailedIncomeAmount(row?.prior)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  const noteData = statementEngine.noteData;

  const engineChecks = statementEngine.checks;

  const sections: AfsStudioSection[] = [
    { id: "cover-page", label: "Cover Page", shortLabel: "Cover", group: "report", hidden: !reportOptions.coverPage },
    { id: "index", label: "Index", shortLabel: "Index", group: "report", hidden: !reportOptions.index },
    { id: "general-info", label: "General Information", shortLabel: "General Info", group: "report", hidden: !reportOptions.generalInformation },
    {
      id: "directors-responsibilities",
      label: isCloseCorporation
        ? `${ccMemberPossessive(Math.max(1, directorsForDisplay.length))} Responsibilities and Approval`
        : isTrust
          ? "Trustees’ Responsibilities and Approval"
          : "Directors’ Responsibilities",
      shortLabel: "Responsibilities",
      group: "report",
      hidden: !reportOptions.directorsResponsibilities,
    },
    {
      id: "directors-report",
      label: isCloseCorporation
        ? `${ccMemberPossessive(Math.max(1, directorsForDisplay.length))} Report`
        : isTrust
          ? "Trustees’ Report"
          : "Directors’ Report",
      shortLabel: isCloseCorporation
        ? "Member Report"
        : isTrust
          ? "Trustees Report"
          : "Directors Report",
      group: "report",
      hidden: !reportOptions.directorsReport,
    },
    {
      id: "compiler-report",
      label: isCloseCorporation ? "Accounting Officer's Report" : "Compiler Report",
      shortLabel: isCloseCorporation ? "Accounting Officer" : "Compiler",
      group: "report",
      hidden: !reportOptions.compilerReport,
    },
    { id: "sfp", label: "Statement of Financial Position", shortLabel: "SFP", group: "report", hidden: !reportOptions.sfp },
    {
      id: "soci",
      label: entityPresentation.incomeStatementTitle,
      shortLabel: entityPresentation.isNpc ? "Income & Exp." : "SOCI",
      group: "report",
      hidden: !reportOptions.soci,
    },
    {
      id: "sce",
      label: entityPresentation.equityStatementTitle,
      shortLabel: entityPresentation.isNpc ? "Funds" : "SCE",
      group: "report",
      hidden: !reportOptions.sce,
    },
    { id: "cash-flow", label: "Statement of Cash Flows", shortLabel: "Cash Flow", group: "report", hidden: !reportOptions.cashFlow },
    { id: "accounting-policies", label: "Accounting Policies", shortLabel: "Policies", group: "report", hidden: !reportOptions.accountingPolicies },
    { id: "notes", label: "Notes to the Financial Statements", shortLabel: "Notes", group: "report", hidden: !reportOptions.notes },
    {
      id: "detailed-income",
      label: entityPresentation.isNpc
        ? "Detailed Income and Expenditure Statement — Supplementary information"
        : "Detailed Income Statement — Supplementary information",
      shortLabel: entityPresentation.isNpc ? "Detailed I&E" : "Detailed IS",
      group: "report",
      hidden: !reportOptions.detailedIncomeStatement,
    },
    { id: "tax-computation", label: "Tax Computation", shortLabel: "Tax", group: "report", hidden: !reportOptions.taxComputation },
    { id: "report-options", label: "AFS Report Options", shortLabel: "Options", group: "settings" },
  ];

  const hideComparatives = Boolean(reportOptions.hideComparativeFigures);

  const reportHeaderProps = {
    showReportHeader: true,
    clientName,
    registrationNumber: registrationNumber || undefined,
    yearEndLabel: `Annual financial statements for the year ended ${displayYearEnd}`,
  };

  const visibleReportSections = sections.filter(
    (section) => section.group === "report" && !section.hidden
  );

  function buildAccountingPolicyPrintItems() {
    const combinedGroups = new Set([
      "revenue",
      "ppe",
      "financial-instruments",
      "leases",
      "investment-property",
    ]);

    const items: Array<{
      section: (typeof accountingPolicySections)[number];
      groupKey: string | null;
      groupLabel: string;
      policyNumber: number;
      showGroupHeading: boolean;
    }> = [];

    const seenGroups = new Set<string>();
    let nextPolicyNumber = 1;

    accountingPolicySections.forEach((section: any) => {
      const isSelected = Boolean(
        reportOptions[section.optionKey as keyof ReportOptions],
      );

      if (
        !entityPresentation.showShareCapitalPolicy &&
        String(section.optionKey || "") === "policyShareCapitalEquity"
      ) {
        return;
      }

      if (!isSelected) return;

      const groupKey = section.group || "other";
      const groupLabel =
        section.groupLabel ||
        section.label ||
        section.title ||
        section.defaultTitle;

      if (combinedGroups.has(groupKey)) {
        const isFirstSelectedSectionInGroup = !seenGroups.has(groupKey);

        if (isFirstSelectedSectionInGroup) {
          seenGroups.add(groupKey);
        }

        const policyNumber = isFirstSelectedSectionInGroup
          ? nextPolicyNumber++
          : items.find((item) => item.groupKey === groupKey)?.policyNumber ||
            nextPolicyNumber++;

        items.push({
          section,
          groupKey,
          groupLabel,
          policyNumber,
          showGroupHeading: isFirstSelectedSectionInGroup,
        });

        return;
      }

      items.push({
        section,
        groupKey: null,
        groupLabel,
        policyNumber: nextPolicyNumber++,
        showGroupHeading: true,
      });
    });

    return items;
  }


  function getNoteLinesForSectionKey(key: string) {
    const map: Record<string, any[]> = {
      notesPropertyPlantEquipment: noteData.propertyPlantEquipment,
      notesRightOfUseAssets: noteData.rightOfUseAssets,
      notesGoodwill: noteData.goodwill,
      notesInvestmentProperty: noteData.investmentProperty,
      notesIntangibleAssets: noteData.intangibleAssets,
      notesBiologicalAssets: noteData.biologicalAssets,
      notesInvestmentsSubsidiaries: noteData.investmentsSubsidiaries,
      notesInvestmentsAssociates: noteData.investmentsAssociates,
      notesInvestmentsJointVentures: noteData.investmentsJointVentures,
      notesOtherInvestments: noteData.otherInvestments,
      notesOtherFinancialAssets: noteData.otherFinancialAssets,
      notesOtherNonCurrentAssets: noteData.otherNonCurrentAssets,
      notesLoansReceivable: noteData.loansReceivable,
      notesInventories: noteData.inventories,
      notesContractAssets: noteData.contractAssets,
      notesTradeReceivables: noteData.tradeReceivables,
      notesTaxStatutoryReceivables: noteData.taxStatutoryReceivables,
      notesCurrentTaxReceivable: noteData.currentTaxReceivable,
      notesCashAndCashEquivalents: noteData.cashAndCashEquivalents,
      notesAssetsHeldForSale: noteData.assetsHeldForSale,

      notesShareCapital: noteData.shareCapital,
      notesRetainedIncome: noteData.retainedIncome,
      notesReserves: noteData.reserves,
      notesNonControllingInterests: noteData.nonControllingInterests,
      notesOtherEquity: noteData.otherEquity,

      notesProvisions: noteData.provisions,
      notesEmployeeBenefitObligations: noteData.employeeBenefitObligations,
      notesDeferredIncomeGrants: noteData.deferredIncomeGrants,
      notesGroupRelatedPartyBorrowings: noteData.groupRelatedPartyBorrowings,
      notesShareholdersLoans: noteData.shareholdersLoans,
      notesBorrowings: noteData.borrowings,
      notesAssetFinance: noteData.assetFinance,
      notesLeaseLiabilities: noteData.leaseLiabilities,
      notesOtherFinancialLiabilities: noteData.otherFinancialLiabilities,
      notesSupplierFinance: noteData.supplierFinance,
      notesDeferredTaxLiability: noteData.deferredTax,
      notesBankOverdraft: noteData.bankOverdraft,
      notesTradePayables: noteData.tradePayables,
      notesContractLiabilities: noteData.contractLiabilities,
      notesDividendPayable: noteData.dividendPayable,
      notesTaxStatutoryPayables: noteData.taxStatutoryPayables,
      notesCurrentTaxPayable: noteData.currentTaxPayable,
      notesLiabilitiesHeldForSale: noteData.liabilitiesHeldForSale,

      notesRevenue: noteData.revenue,
      notesCostOfSales: noteData.costOfSales,
      notesOtherOperatingIncome: noteData.otherOperatingIncome,
      notesInvestmentIncome: noteData.investmentIncome,
      notesOperatingExpenses: noteData.operatingExpenses,
      notesFinanceCosts: noteData.financeCosts,
      notesOtherGainsLosses: noteData.otherGainsLosses,
      notesTaxation: noteData.taxation,
      notesOtherComprehensiveIncome: noteData.otherComprehensiveIncome,
      notesDiscontinuedOperations: noteData.discontinuedOperations,

      notesCashUsedInOperations: noteData.cashUsedInOperations,
      notesGoingConcern: [],
      notesRelatedParties: [],
      notesCommitmentsContingencies: [],
      notesEventsAfterReportingPeriod: [],
    };

    return map[key] || [];
  }

  function renderNoteTable(lines: any[]) {
    if (!lines || lines.length === 0) return null;

    const displayLines =
      lines.length === 1
        ? [
            {
              ...lines[0],
              label:
                String(lines[0]?.label || "").toLowerCase().includes("cash and cash")
                  ? "Bank balances"
                  : String(lines[0]?.label || "").toLowerCase().includes("share capital")
                  ? isCloseCorporation
                    ? "Member's contribution"
                    : isTrust
                      ? "Trust capital"
                      : "Issued share capital"
                  : String(lines[0]?.label || "").toLowerCase().includes("inventor")
                  ? "Inventories on hand"
                  : String(lines[0]?.label || "").toLowerCase().includes("shareholder")
                  ? isCloseCorporation
                    ? "Member loans"
                    : isTrust
                      ? "Trustee loans"
                      : "Loans from shareholders"
                  : lines[0]?.label,
            },
          ]
        : lines;

    const totalCurrent = displayLines.reduce(
      (total, line) => total + Number(line.current || 0),
      0
    );
    const totalPrior = displayLines.reduce(
      (total, line) => total + Number(line.prior || 0),
      0
    );

    return (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          margin: "8px 0 14px",
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
              Description
            </th>
            <th
              style={{
                textAlign: "right",
                borderBottom: "1px solid #111827",
                padding: "3px 0",
                width: 80,
              }}
            >
              {currentHeading}
            </th>
            <th
              style={{
                textAlign: "right",
                borderBottom: "1px solid #111827",
                padding: "3px 0",
                width: 80,
              }}
            >
              {priorHeading}
            </th>
          </tr>
        </thead>
        <tbody>
          {displayLines.map((line) => (
            <tr key={line.id}>
              <td style={{ padding: "3px 0" }}>{String(line.label || "").trim().toLowerCase() === "total" ? "" : line.label}</td>
              <td style={{ padding: "3px 0", textAlign: "right" }}>
                {Math.round(Number(line.current || 0)).toLocaleString("en-ZA")}
              </td>
              <td style={{ padding: "3px 0", textAlign: "right" }}>
                {Math.round(Number(line.prior || 0)).toLocaleString("en-ZA")}
              </td>
            </tr>
          ))}
          <tr>
            <td
              style={{
                padding: "4px 0",
                borderTop: "1px solid #111827",
                fontWeight: 800,
              }}
            >
              Total
            </td>
            <td
              style={{
                padding: "4px 0",
                borderTop: "1px solid #111827",
                fontWeight: 800,
                textAlign: "right",
              }}
            >
              {Math.round(totalCurrent).toLocaleString("en-ZA")}
            </td>
            <td
              style={{
                padding: "4px 0",
                borderTop: "1px solid #111827",
                fontWeight: 800,
                textAlign: "right",
              }}
            >
              {Math.round(totalPrior).toLocaleString("en-ZA")}
            </td>
          </tr>
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

    const currentClosingRetained = sceValue("sce-retained-closing");
    const closingShare = sceValue("sce-share-closing");

    /*
      The SCE must use the exact current-year result displayed in the SOCI.
      Any small transfer/rounding difference is shown as an equity movement
      rather than recalculating or changing the SOCI result.
    */
    const sociCurrentProfitRow = (sociRows || []).find(
      (row: any) => String(row?.id || "") === "profit-year",
    );

    const currentProfit = Math.round(
      Number((sociCurrentProfitRow as any)?.current || 0),
    );

    const currentOther = Math.round(
      sceValue("sce-current-other-movement"),
    );

    const priorShareMovement = 0;
    const priorClosingShare = openingShare + priorShareMovement;
    const currentShareMovement = closingShare - priorClosingShare;

    if (entityPresentation.isNpc) {
      const fundRows = [
        {
          label: "Balance at beginning of prior year",
          accumulated: openingRetained,
          total: openingRetained,
          strong: true,
        },
        {
          label: "Surplus / (deficit) for prior year",
          accumulated: priorProfit,
          total: priorProfit,
        },
        {
          label: "Other movements / transfers - prior year",
          accumulated: priorOther,
          total: priorOther,
        },
        {
          label: "Balance at end of prior year",
          accumulated: priorClosingRetained,
          total: priorClosingRetained,
          strong: true,
          underline: true,
        },
        {
          label: "Surplus / (deficit) for current year",
          accumulated: currentProfit,
          total: currentProfit,
        },
        {
          label: "Other movements / transfers - current year",
          accumulated: currentOther,
          total: currentOther,
        },
        {
          label: "Balance at end of current year",
          accumulated: currentClosingRetained,
          total: currentClosingRetained,
          strong: true,
          underline: true,
        },
      ];

      return (
        <section style={{ fontSize: 11, color: "#111827" }}>
          <h1 style={pageHeadingStyle()}>{entityPresentation.equityStatementTitle}</h1>

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
                    padding: "4px 0",
                  }}
                >
                  Figures in Rand
                </th>
                <th
                  style={{
                    textAlign: "right",
                    borderBottom: "1px solid #111827",
                    padding: "4px 0",
                    width: 120,
                  }}
                >
                  Accumulated funds
                </th>
                <th
                  style={{
                    textAlign: "right",
                    borderBottom: "1px solid #111827",
                    padding: "4px 0",
                    width: 100,
                  }}
                >
                  Total funds
                </th>
              </tr>
            </thead>

            <tbody>
              {fundRows.map((row) => (
                <tr key={row.label}>
                  <td
                    style={{
                      padding: "4px 0",
                      fontWeight: row.strong ? 800 : 400,
                    }}
                  >
                    {row.label}
                  </td>
                  <td
                    style={{
                      padding: "4px 0",
                      textAlign: "right",
                      fontWeight: row.strong ? 800 : 400,
                      borderTop: row.underline ? "1px solid #111827" : undefined,
                      borderBottom: row.underline
                        ? "2px solid #111827"
                        : undefined,
                    }}
                  >
                    {afsAmount(row.accumulated)}
                  </td>
                  <td
                    style={{
                      padding: "4px 0",
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
        label: isCloseCorporation
          ? "Member's contribution movements - prior year"
          : isTrust
            ? "Trust capital movements - prior year"
            : "Shares issued / cancelled - prior year",
        share: priorShareMovement,
        retained: 0,
        total: priorShareMovement,
      },
      {
        label: "Other movements / distributions - prior year",
        share: 0,
        retained: priorOther,
        total: priorOther,
      },
      {
        label: "Balance at end of prior year",
        share: priorClosingShare,
        retained: priorClosingRetained,
        total: priorClosingShare + priorClosingRetained,
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
        label: isCloseCorporation
          ? "Member's contribution movements - current year"
          : isTrust
            ? "Trust capital movements - current year"
            : "Shares issued / cancelled - current year",
        share: currentShareMovement,
        retained: 0,
        total: currentShareMovement,
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
        <h1 style={pageHeadingStyle()}>{entityPresentation.equityStatementTitle}</h1>

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
                  padding: "4px 0",
                }}
              >
                Figures in Rand
              </th>
              <th
                style={{
                  textAlign: "right",
                  borderBottom: "1px solid #111827",
                  padding: "4px 0",
                  width: 90,
                }}
              >
                {isCloseCorporation
                  ? "Member's contribution"
                  : isTrust
                    ? "Trust capital"
                    : "Share capital"}
              </th>
              <th
                style={{
                  textAlign: "right",
                  borderBottom: "1px solid #111827",
                  padding: "4px 0",
                  width: 110,
                }}
              >
                {isTrust ? "Accumulated funds" : "Accumulated loss"}
              </th>
              <th
                style={{
                  textAlign: "right",
                  borderBottom: "1px solid #111827",
                  padding: "4px 0",
                  width: 90,
                }}
              >
                {isTrust ? "Total trust funds" : "Total equity"}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={String(row.label || "").trim().toLowerCase() === "total" ? "" : row.label}>
                <td
                  style={{
                    padding: "4px 0",
                    fontWeight: row.strong ? 800 : 400,
                  }}
                >
                  {String(row.label || "").trim().toLowerCase() === "total" ? "" : row.label}
                </td>
                <td
                  style={{
                    padding: "4px 0",
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
                    padding: "4px 0",
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
                    padding: "4px 0",
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

  function updatePpePolicyDisclosure(
    rowKey: string,
    field: "method" | "usefulLife" | "residualValue",
    value: string,
  ) {
    const currentDisclosures =
      structuredNotesState?.ppeClassDisclosures &&
      typeof structuredNotesState.ppeClassDisclosures === "object"
        ? structuredNotesState.ppeClassDisclosures
        : {};

    saveStructuredNotesStateEverywhere({
      ...structuredNotesState,
      ppeClassDisclosures: {
        ...currentDisclosures,
        [rowKey]: {
          ...(currentDisclosures[rowKey] || {}),
          [field]: value,
        },
      },
    });
  }

  function renderPpePolicyDisclosureEditor() {
    const ppeClassCatalog = [
      { key: "land", label: "Land" },
      { key: "buildings", label: "Buildings" },
      { key: "leaseholdProperty", label: "Leasehold property" },
      { key: "plantAndMachinery", label: "Plant and machinery" },
      { key: "furnitureAndFittings", label: "Furniture and fittings" },
      { key: "motorVehicles", label: "Motor vehicles" },
      { key: "officeEquipment", label: "Office equipment" },
      { key: "computerEquipment", label: "Computer equipment" },
      { key: "leaseholdImprovements", label: "Leasehold improvements" },
      { key: "rightOfUseAssets", label: "Right-of-use assets" },
      { key: "otherPpe1", label: "Other PPE 1" },
      { key: "otherPpe2", label: "Other PPE 2" },
      { key: "otherPpe3", label: "Other PPE 3" },
      { key: "otherPpe4", label: "Other PPE 4" },
    ];

    const normalisePpeLabel = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const ppeInputs =
      structuredNotesState?.ppeInputs &&
      typeof structuredNotesState.ppeInputs === "object"
        ? structuredNotesState.ppeInputs
        : {};

    const savedRows = Array.isArray(structuredNotesState?.ppeRows)
      ? structuredNotesState.ppeRows
      : [];

    const mappedLabels = new Set(
      (noteData.propertyPlantEquipment || [])
        .map((line: any) => normalisePpeLabel(line?.label))
        .filter(Boolean),
    );

    const hasAnyCapturedAmount = (value: unknown): boolean => {
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "string") {
        const numberValue = Number(value.replace(/\s|,/g, ""));
        return Number.isFinite(numberValue) ? numberValue !== 0 : value.trim() !== "";
      }
      if (Array.isArray(value)) return value.some(hasAnyCapturedAmount);
      if (typeof value === "object") {
        return Object.values(value as Record<string, unknown>).some(
          hasAnyCapturedAmount,
        );
      }
      return false;
    };

    const activeRows = ppeClassCatalog.filter((catalogRow) => {
      const savedRow = savedRows.find(
        (row: any) => String(row?.key || "") === catalogRow.key,
      );

      return (
        hasAnyCapturedAmount(ppeInputs[catalogRow.key]) ||
        hasAnyCapturedAmount(savedRow) ||
        mappedLabels.has(normalisePpeLabel(catalogRow.label))
      );
    });

    if (!activeRows.length) return null;

    const disclosures =
      structuredNotesState?.ppeClassDisclosures &&
      typeof structuredNotesState.ppeClassDisclosures === "object"
        ? structuredNotesState.ppeClassDisclosures
        : {};

    return (
      <div
        style={{
          marginTop: 12,
          borderTop: "1px solid #cbd5e1",
          paddingTop: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#111827" }}>
            Depreciation methods and useful lives by asset class
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 10,
              lineHeight: 1.35,
              color: "#64748b",
            }}
          >
            Complete each asset class separately. These disclosures print in
            the Property, plant and equipment accounting policy and never in
            the PPE note.
          </div>
        </div>

        {activeRows.map((row) => {
          const values = disclosures[row.key] || {};

          const fieldStyle = {
            width: "100%",
            boxSizing: "border-box" as const,
            padding: "6px 7px",
            fontSize: 10,
            background: "#EAF3FF",
            border: "1px solid #7A9FC8",
            outlineColor: "#2563EB",
            color: "#111827",
          };

          return (
            <div
              key={`policy-ppe-${row.key}`}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                padding: 8,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 900, color: "#111827" }}>
                {row.label}
              </div>
              <input
                type="text"
                value={String(values.method || "")}
                placeholder="Depreciation method, e.g. straight-line"
                onChange={(event) =>
                  updatePpePolicyDisclosure(
                    row.key,
                    "method",
                    event.target.value,
                  )
                }
                style={fieldStyle}
              />
              <input
                type="text"
                value={String(values.usefulLife || "")}
                placeholder="Useful life / depreciation rate"
                onChange={(event) =>
                  updatePpePolicyDisclosure(
                    row.key,
                    "usefulLife",
                    event.target.value,
                  )
                }
                style={fieldStyle}
              />
              <input
                type="text"
                value={String(values.residualValue || "")}
                placeholder="Residual value / basis"
                onChange={(event) =>
                  updatePpePolicyDisclosure(
                    row.key,
                    "residualValue",
                    event.target.value,
                  )
                }
                style={fieldStyle}
              />
            </div>
          );
        })}
      </div>
    );
  }

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
        title: isCloseCorporation
          ? `${ccMemberPossessive(Math.max(1, directorsForDisplay.length))} Report settings`
          : isTrust
            ? "Trustees’ Report settings"
            : "Directors’ Report settings",
        description:
          "Turn sections on/off, edit wording, or reset to PracticePilot defaults.",
        emptyMessage: "No directors’ report settings available.",
        options: [],
        content: (
          <AfsDirectorsReportSettings
            reportOptions={{
              ...reportOptions,
              ...(entityPresentation.isNpc
                ? {
                    directorsReportDividends: false,
                    directorsReportShareCapital: false,
                    directorsReportShareholder: false,
                  }
                : {}),
              ...((isCloseCorporation || isTrust)
                ? {
                    directorsReportSecretary: false,
                    directorsReportShareholder: false,
                    directorsReportSocialEthics: false,
                    directorsReportSubsidiaries: false,
                    directorsReportAssociates: false,
                    directorsReportJointVentures: false,
                  }
                : {}),
            }}
            toggleReportOption={toggleReportOption}
            texts={activeDirectorsReportTexts}
            defaults={defaultDirectorsReportTexts}
            onChangeTitle={updateDirectorsReportTitle}
            onChangeText={updateDirectorsReportText}
            onReset={resetDirectorsReportSection}
            onResetAll={resetAllDirectorsReportSections}
            entityType={presentationEntityType}
          />
        ),
      };
    }

    if (activeSectionId === "sce") {
      return {
        title: isTrust
          ? "Statement of Changes in Trust Capital and Accumulated Funds settings"
          : "SCE settings",
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
            entityType={presentationEntityType}
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
                  background: cashFlowViewMode === "afs" ? "#111827" : "#ffffff",
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
                  background: cashFlowViewMode === "work" ? "#111827" : "#ffffff",
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
              <strong>Workbench</strong> is where current and prior cash flow fields are captured.
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
          <div
            onBlur={(event) => {
              const nextTarget = event.relatedTarget as Node | null;

              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                commitPendingAccountingPolicyEdits();
              }
            }}
            onClickCapture={(event) => {
              const target = event.target as HTMLElement;
              const button = target.closest("button");
              const label = String(button?.textContent || "").trim().toLowerCase();

              if (label === "close") {
                commitPendingAccountingPolicyEdits();
              }
            }}
          >
            <AfsEditableDisclosureSettings
              sections={accountingPolicySections}
              reportOptions={reportOptions}
              toggleReportOption={toggleReportOption}
              texts={activeAccountingPolicyEditorTexts}
              defaults={defaultAccountingPolicyTexts}
              onChangeTitle={updateAccountingPolicyTitle}
              onChangeText={updateAccountingPolicyText}
              onReset={resetAccountingPolicySection}
              onResetAll={resetAllAccountingPolicySections}
              groupExtras={{
                ppe: renderPpePolicyDisclosureEditor(),
              }}
            />
          </div>
        ),
      };
    }

    if (activeSectionId === "detailed-income") {
      return {
        title: "Detailed Income Statement",
        description:
          "Edit the generic Other Expenses descriptions directly in the statement. The mapped accounts are shown beneath each editable line.",
        emptyMessage: "No separate settings are required.",
        options: [],
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
            sections={effectiveNoteSections}
            reportOptions={reportOptions}
            toggleReportOption={toggleReportOption}
            texts={activeNoteTexts}
            defaults={defaultNoteTexts}
            onChangeTitle={updateNoteTitle}
            onChangeText={updateNoteText}
            onReset={resetNoteSection}
            onResetAll={resetAllNoteSections}
            notesMode={notesViewMode}
            onNotesModeChange={(nextMode) => {
              window.dispatchEvent(
                new CustomEvent("afs-notes-mode-change", {
                  detail: nextMode,
                }),
              );
            }}
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
            "Show no-assurance statement"
          ),
        ],
        content: null,
      };
    }

    return {
      title: "Section settings",
      description: "This report page does not have section-specific settings yet.",
      emptyMessage:
        "No section-specific settings yet. Use AFS Report Options to turn this report page on or off.",
      options: [],
      content: null,
    };
  }

function paginateMeasuredItems<T>(
  items: T[],
  heights: Map<T, number>,
  capacity: number,
) {
  const pages: T[][] = [];
  let currentPage: T[] = [];
  let currentHeight = 0;

  items.forEach((item) => {
    const itemHeight = Math.max(1, heights.get(item) || 1);

    if (
      currentPage.length > 0 &&
      currentHeight + itemHeight > capacity
    ) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 0;
    }

    currentPage.push(item);
    currentHeight += itemHeight;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[]];
}

function elementOuterHeight(element: HTMLElement | null) {
  if (!element) return 0;

  const style = window.getComputedStyle(element);
  return (
    element.getBoundingClientRect().height +
    Number.parseFloat(style.marginTop || "0") +
    Number.parseFloat(style.marginBottom || "0")
  );
}

  const currentContextualOptions = contextualOptions();

  const activeDirectorsReportKeys =
    getActiveDirectorsReportSectionKeys(narrativeContext);

  const activeNoteSectionKeys = effectiveNoteSections
    .filter((section: any) =>
      Boolean(reportOptions[section.optionKey as keyof ReportOptions]),
    )
    .map((section: any) => section.key);

  const directorsPaginationSignature = [
    activeDirectorsReportKeys.join("|"),
    directorsForDisplay.length,
    JSON.stringify(activeDirectorsReportTexts),
  ].join("::");

  const notesPaginationSignature = [
    activeNoteSectionKeys.join("|"),
    currentHeading,
    priorHeading,
    hideComparatives ? "1" : "0",
  ].join("::");

  const accountingPolicyPrintItems = buildAccountingPolicyPrintItems();
  const accountingPolicyPaginationSignature = accountingPolicyPrintItems
    .map((item: any) => {
      const current =
        activeAccountingPolicyTexts[item.section.key] ||
        defaultAccountingPolicyTexts[item.section.key] || {};

      return [
        item.section.key,
        item.groupKey || "single",
        item.policyNumber,
        item.showGroupHeading ? "1" : "0",
        current.title || "",
        current.text || "",
      ].join(":");
    })
    .join("@@");


  const paginationMeasureRef = useRef<HTMLDivElement | null>(null);

  const [measuredDirectorsPagination, setMeasuredDirectorsPagination] =
    useState<{
      signature: string;
      pages: DirectorsReportSectionKey[][];
    }>({
      signature: "",
      pages: [],
    });

  const [measuredNotesPagination, setMeasuredNotesPagination] = useState<{
    signature: string;
    pages: string[][];
  }>({
    signature: "",
    pages: [],
  });

  const [measuredAccountingPolicyPagination, setMeasuredAccountingPolicyPagination] =
    useState<{
      signature: string;
      pages: number[][];
    }>({
      signature: "",
      pages: [],
    });

  const accountingPoliciesPrintRef = useRef<HTMLDivElement | null>(null);
  const [accountingPolicyLayoutVerified, setAccountingPolicyLayoutVerified] =
    useState(false);

  const directorsReportPageGroups =
    measuredDirectorsPagination.signature === directorsPaginationSignature
      ? measuredDirectorsPagination.pages
      : [activeDirectorsReportKeys];

      const balancedDirectorsReportPageGroups = (() => {
  const pages = directorsReportPageGroups.map((page) => [...page]);

  if (pages.length < 2) {
    return pages;
  }

  const lastPage = pages[pages.length - 1];
  const previousPage = pages[pages.length - 2];

  if (lastPage.length === 1 && previousPage.length > 1) {
    const sectionToMove = previousPage.pop();

    if (sectionToMove) {
      lastPage.unshift(sectionToMove);
    }
  }

  return pages;
})();

  const notesPageGroups =
    measuredNotesPagination.signature === notesPaginationSignature
      ? measuredNotesPagination.pages
      : [activeNoteSectionKeys];

  const accountingPolicyPageGroups =
    measuredAccountingPolicyPagination.signature ===
    accountingPolicyPaginationSignature
      ? measuredAccountingPolicyPagination.pages
      : [accountingPolicyPrintItems.map((_: any, index: number) => index)];

  const reportPageNumberMap = useMemo(() => {
    const pageMap: Record<string, number> = {};
    let physicalPage = 1;

    const addSection = (id: string, enabled: boolean, pageCount = 1) => {
      if (!enabled) return;
      pageMap[id] = physicalPage;
      physicalPage += Math.max(1, pageCount);
    };

    addSection("cover-page", reportOptions.coverPage);
    addSection("index", reportOptions.index);
    addSection("general-info", reportOptions.generalInformation);
    addSection(
      "directors-responsibilities",
      reportOptions.directorsResponsibilities,
    );
    addSection(
      "directors-report",
      reportOptions.directorsReport,
      balancedDirectorsReportPageGroups.length,
    );
    addSection("compiler-report", reportOptions.compilerReport);
    addSection("sfp", reportOptions.sfp);
    addSection("soci", reportOptions.soci);
    addSection("sce", reportOptions.sce);
    addSection("cash-flow", reportOptions.cashFlow);
    addSection(
      "accounting-policies",
      reportOptions.accountingPolicies,
      accountingPolicyPageGroups.length,
    );
    addSection("notes", reportOptions.notes, notesPageGroups.length);
    addSection(
      "detailed-income",
      reportOptions.detailedIncomeStatement,
    );
    addSection("tax-computation", reportOptions.taxComputation);

    return pageMap;
  }, [
    reportOptions,
    balancedDirectorsReportPageGroups.length,
    accountingPolicyPageGroups.length,
    notesPageGroups.length,
  ]);

  const [pdfReadinessFallback, setPdfReadinessFallback] = useState(false);

  useEffect(() => {
    setPdfReadinessFallback(false);

    const timer = window.setTimeout(() => {
      setPdfReadinessFallback(true);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [
    directorsPaginationSignature,
    notesPaginationSignature,
    accountingPolicyPaginationSignature,
  ]);

  const paginationReady =
    pdfReadinessFallback ||
    (measuredDirectorsPagination.signature === directorsPaginationSignature &&
      measuredNotesPagination.signature === notesPaginationSignature &&
      measuredAccountingPolicyPagination.signature ===
        accountingPolicyPaginationSignature &&
      accountingPolicyLayoutVerified);

  useLayoutEffect(() => {
    if (loading) return;

    setAccountingPolicyLayoutVerified(false);

    let cancelled = false;

    const measure = async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // Continue with available fonts.
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      if (cancelled || !paginationMeasureRef.current) return;

      const root = paginationMeasureRef.current;

      const readCapacity = (kind: "directors" | "notes" | "policies") => {
        const page = root.querySelector<HTMLElement>(
          `[data-measure-page="${kind}"]`,
        );
        const content = page?.querySelector<HTMLElement>(
          '[data-afs-a4-content="true"]',
        );

        if (!content) return 900;

        const contentStyle = window.getComputedStyle(content);
        const innerHeight =
          content.getBoundingClientRect().height -
          Number.parseFloat(contentStyle.paddingTop || "0") -
          Number.parseFloat(contentStyle.paddingBottom || "0");

        const reportHeader = content.querySelector<HTMLElement>(
          '[data-afs-report-header="true"]',
        );
        const heading = content.querySelector<HTMLElement>(
          '[data-measure-page-heading="true"]',
        );

        const printSafetyReserve =
          kind === "directors" ? 110 : kind === "policies" ? 32 : 12;

return Math.max(
  200,
  innerHeight -
    elementOuterHeight(reportHeader) -
    elementOuterHeight(heading) -
    printSafetyReserve,
);
      };

      const directorsHeights = new Map<DirectorsReportSectionKey, number>();
      root
        .querySelectorAll<HTMLElement>("[data-measure-director-key]")
        .forEach((element) => {
          const key = element.dataset
            .measureDirectorKey as DirectorsReportSectionKey;
          directorsHeights.set(key, element.getBoundingClientRect().height);
        });

      const noteHeights = new Map<string, number>();
      root
        .querySelectorAll<HTMLElement>("[data-measure-note-key]")
        .forEach((element) => {
          const key = element.dataset.measureNoteKey || "";
          noteHeights.set(key, element.getBoundingClientRect().height);
        });

      const accountingPolicyHeights = new Map<number, number>();
      root
        .querySelectorAll<HTMLElement>("[data-measure-policy-index]")
        .forEach((element) => {
          const index = Number(element.dataset.measurePolicyIndex || "-1");
          if (index >= 0) {
            accountingPolicyHeights.set(
              index,
              elementOuterHeight(element) + 8,
            );
          }
        });

      const nextDirectorsPages = paginateMeasuredItems(
        activeDirectorsReportKeys,
        directorsHeights,
        readCapacity("directors"),
      );

      const nextNotesPages = paginateMeasuredItems(
        activeNoteSectionKeys,
        noteHeights,
        readCapacity("notes"),
      );

      const policyIndexes = accountingPolicyPrintItems.map(
        (_: any, index: number) => index,
      );
      const nextAccountingPolicyPages = paginateMeasuredItems(
        policyIndexes,
        accountingPolicyHeights,
        readCapacity("policies"),
      );

      if (cancelled) return;

      setMeasuredDirectorsPagination({
        signature: directorsPaginationSignature,
        pages: nextDirectorsPages,
      });
      setMeasuredNotesPagination({
        signature: notesPaginationSignature,
        pages: nextNotesPages,
      });
      setMeasuredAccountingPolicyPagination({
        signature: accountingPolicyPaginationSignature,
        pages: nextAccountingPolicyPages,
      });
    };

    void measure();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    directorsPaginationSignature,
    notesPaginationSignature,
    accountingPolicyPaginationSignature,
    activeDirectorsReportKeys,
    activeNoteSectionKeys,
  ]);

  useLayoutEffect(() => {
    if (
      loading ||
      measuredAccountingPolicyPagination.signature !==
        accountingPolicyPaginationSignature
    ) {
      setAccountingPolicyLayoutVerified(false);
      return;
    }

    let cancelled = false;

    const verifyRenderedPolicyPages = async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // Continue with available fonts.
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      if (cancelled || !accountingPoliciesPrintRef.current) return;

      const pageElements = Array.from(
        accountingPoliciesPrintRef.current.querySelectorAll<HTMLElement>(
          "[data-accounting-policy-page-index]",
        ),
      );

      const overflowingPageIndex = pageElements.findIndex((pageElement) => {
        const content = pageElement.querySelector<HTMLElement>(
          '[data-afs-a4-content="true"]',
        );

        if (!content) return false;

        return content.scrollHeight > content.clientHeight + 1;
      });

      if (overflowingPageIndex < 0) {
        setAccountingPolicyLayoutVerified(true);
        return;
      }

      const currentPages = measuredAccountingPolicyPagination.pages.map(
        (page) => [...page],
      );
      const overflowingPage = currentPages[overflowingPageIndex] || [];

      if (overflowingPage.length <= 1) {
        console.error(
          "A single accounting policy subsection is taller than one A4 page.",
          overflowingPage,
        );
        setAccountingPolicyLayoutVerified(true);
        return;
      }

      const itemToMove = overflowingPage.pop();

      if (itemToMove === undefined) {
        setAccountingPolicyLayoutVerified(true);
        return;
      }

      if (!currentPages[overflowingPageIndex + 1]) {
        currentPages.push([]);
      }

      currentPages[overflowingPageIndex + 1].unshift(itemToMove);

      setAccountingPolicyLayoutVerified(false);
      setMeasuredAccountingPolicyPagination({
        signature: accountingPolicyPaginationSignature,
        pages: currentPages,
      });
    };

    void verifyRenderedPolicyPages();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    accountingPolicyPaginationSignature,
    measuredAccountingPolicyPagination.signature,
    measuredAccountingPolicyPagination.pages,
  ]);

  const ppePolicyDisclosureRows = useMemo(() => {
    const disclosures =
      structuredNotesState?.ppeClassDisclosures &&
      typeof structuredNotesState.ppeClassDisclosures === "object"
        ? structuredNotesState.ppeClassDisclosures
        : {};

    const savedRows = Array.isArray(structuredNotesState?.ppeRows)
      ? structuredNotesState.ppeRows
      : [];

    const standardLabels: Record<string, string> = {
      land: "Land",
      buildings: "Buildings",
      leaseholdProperty: "Leasehold property",
      plantAndMachinery: "Plant and machinery",
      furnitureAndFittings: "Furniture and fittings",
      motorVehicles: "Motor vehicles",
      officeEquipment: "Office equipment",
      computerEquipment: "Computer equipment",
      leaseholdImprovements: "Leasehold improvements",
      rightOfUseAssets: "Right-of-use assets",
      otherPpe1: "Other PPE 1",
      otherPpe2: "Other PPE 2",
      otherPpe3: "Other PPE 3",
      otherPpe4: "Other PPE 4",
    };

    const labelByKey = new Map<string, string>();
    savedRows.forEach((row: any) => {
      const key = String(row?.key || "").trim();
      const label = String(row?.label || "").trim();
      if (key && label) labelByKey.set(key, label);
    });

    const displayLabel = (key: string) =>
      labelByKey.get(key) ||
      standardLabels[key] ||
      key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replaceAll("-", " ")
        .replaceAll("_", " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\w/, (character) => character.toUpperCase());

    return Object.entries(disclosures)
      .map(([key, raw]: [string, any]) => ({
        key,
        label: displayLabel(key),
        method: String(raw?.method || "").trim(),
        usefulLife: String(raw?.usefulLife || "").trim(),
        residualValue: String(raw?.residualValue || "").trim(),
      }))
      .filter(
        (row) => row.method || row.usefulLife || row.residualValue,
      );
  }, [structuredNotesState]);

  function renderAccountingPolicyPrintItem(item: any, index: number) {
    const section = item.section;
    const current =
      activeAccountingPolicyTexts[section.key] ||
      defaultAccountingPolicyTexts[section.key] || {
        title: section.label || section.title || section.defaultTitle,
        text: "",
      };

    const rawTitle = String(
      current.title ||
        section.label ||
        section.title ||
        section.defaultTitle,
    );

    const shortTitle = item.groupKey
      ? rawTitle
          .replace(`${item.groupLabel} - `, "")
          .replace(`${item.groupLabel}: `, "")
          .replace("Property, plant and equipment - ", "")
          .replace("Financial instruments - ", "")
          .replace("Leases - ", "")
          .replace("Investment property - ", "")
          .replace("Revenue - ", "")
      : rawTitle;

    return (
      <div
        key={`${section.key}-${index}`}
        style={{
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        {item.showGroupHeading ? (
          <h2 style={sectionHeadingStyle()}>
            {item.policyNumber}. {item.groupKey ? item.groupLabel : rawTitle}
          </h2>
        ) : null}

        {item.groupKey &&
        shortTitle.trim().toLowerCase() !==
          item.groupLabel.trim().toLowerCase() ? (
          <h3 style={subsectionHeadingStyle()}>{shortTitle}</h3>
        ) : null}

        {renderDisclosureText(
          String(current.text || "").replace(/timing differences/gi, "temporary differences"),
          disclosureTokens,
        ).map(
          (paragraph, paragraphIndex) => (
            <p
              key={`${section.key}-${paragraphIndex}`}
              style={paragraphStyle()}
            >
              {paragraph}
            </p>
          ),
        )}

        {section.key === "policyPpeDepreciation" &&
        ppePolicyDisclosureRows.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10.5,
                margin: "4px 0 9px",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #111827", padding: "3px 4px 3px 0" }}>
                    Asset class
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #111827", padding: "3px 4px" }}>
                    Depreciation method
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #111827", padding: "3px 4px" }}>
                    Useful life / rate
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #111827", padding: "3px 0 3px 4px" }}>
                    Residual value / basis
                  </th>
                </tr>
              </thead>
              <tbody>
                {ppePolicyDisclosureRows.map((row) => (
                  <tr key={`ppe-policy-disclosure-${row.key}`}>
                    <td style={{ padding: "3px 4px 3px 0", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>
                      {row.label}
                    </td>
                    <td style={{ padding: "3px 4px", borderBottom: "1px solid #e5e7eb" }}>
                      {row.method || "–"}
                    </td>
                    <td style={{ padding: "3px 4px", borderBottom: "1px solid #e5e7eb" }}>
                      {row.usefulLife || "–"}
                    </td>
                    <td style={{ padding: "3px 0 3px 4px", borderBottom: "1px solid #e5e7eb" }}>
                      {row.residualValue || "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ppePolicyDisclosureRows.some(
              (row) => row.key === "leaseholdImprovements",
            ) ? (
              <p style={paragraphStyle()}>
                Leasehold improvements are depreciated over the shorter of their
                useful lives and the remaining lease term, where applicable.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }


  return (
    <AfsPrintStudioShell
      engagementName={clientName}
      yearEndLabel={`${entityType} · Financial year end ${displayYearEnd}${
        printStudioSaveStatus === "saving"
          ? " · Saving…"
          : printStudioSaveStatus === "saved"
          ? " · Saved"
          : printStudioSaveStatus === "error"
          ? " · Save error"
          : ""
      }`}
      activeSectionId={activeSectionId}
      sections={sections}
      onSectionChange={goToSection}
      exportDisabled={false}
      reportOptions={currentContextualOptions.options}
      reportOptionsTitle={currentContextualOptions.title}
      reportOptionsDescription={currentContextualOptions.description}
      emptyOptionsMessage={currentContextualOptions.emptyMessage}
      reportOptionsContent={currentContextualOptions.content}
      flightDeckContent={
        !loading ? (
          <AfsFlightDeck
            issues={flightDeckIssues}
            onJump={(target) => {
              const element =
                document.getElementById(target) ||
                document.getElementById(`print-${target}`);

              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          />
        ) : null
      }
    >
      <style>{`
        body[data-afs-pdf-mode="true"] h1 {
          font-weight: 700 !important;
          letter-spacing: -0.01em !important;
        }

        body[data-afs-pdf-mode="true"] h2 {
          font-weight: 700 !important;
        }

        body[data-afs-pdf-mode="true"] h3,
        body[data-afs-pdf-mode="true"] th {
          font-weight: 600 !important;
        }

        body[data-afs-pdf-mode="true"] p,
        body[data-afs-pdf-mode="true"] td {
          font-weight: 400;
        }

        body[data-afs-draft-pdf="true"]::before {
          content: "DRAFT";
          position: fixed;
          top: 44%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-32deg);
          z-index: 999999;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: 12px;
          color: rgba(100, 116, 139, 0.16);
          pointer-events: none;
          white-space: nowrap;
        }
      `}</style>

      {!loading ? (
        <div
          ref={paginationMeasureRef}
          data-afs-pagination-measure="true"
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-100000px",
            top: 0,
            width: "210mm",
            height: 0,
            overflow: "visible",
            visibility: "hidden",
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <div data-measure-page="directors">
            <AfsA4Page {...reportHeaderProps}>
              <section
                style={{
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: "#111827",
                }}
              >
                <h1
                  data-measure-page-heading="true"
                  style={pageHeadingStyle()}
                >
                  {reportTitle(entityType)} — continued
                </h1>
              </section>
            </AfsA4Page>
          </div>

          <div data-measure-page="notes">
            <AfsA4Page {...reportHeaderProps}>
              <h1
                data-measure-page-heading="true"
                style={pageHeadingStyle()}
              >
                Notes to the Financial Statements — continued
              </h1>
            </AfsA4Page>
          </div>

          <div data-measure-page="policies">
            <AfsA4Page {...reportHeaderProps}>
              <h1
                data-measure-page-heading="true"
                style={pageHeadingStyle()}
              >
                Accounting Policies — continued
              </h1>
            </AfsA4Page>
          </div>

          <div
            style={{
              width: "178mm",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: 11,
              lineHeight: 1.45,
            }}
          >
            {activeDirectorsReportKeys.map((key, index) => (
              <div
                key={`measure-director-${key}`}
                data-measure-director-key={key}
              >
                <DirectorsReportBlock
                  context={narrativeContext}
                  sectionKeys={[key]}
                  startNumber={index}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              width: "178mm",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: 11,
              lineHeight: 1.45,
              color: "#111827",
            }}
          >
            {accountingPolicyPrintItems.map((item: any, index: number) => (
              <div
                key={`measure-policy-${index}`}
                data-measure-policy-index={index}
              >
                {renderAccountingPolicyPrintItem(item, index)}
              </div>
            ))}
          </div>

          <div style={{ width: "178mm" }}>
            {activeNoteSectionKeys.map((key) => (
              <div
                key={`measure-note-${key}`}
                data-measure-note-key={key}
              >
                <AfsStructuredNotesPanel
                  engagementId={engagementId}
                  noteSections={effectiveNoteSections}
                  reportOptions={reportOptions as any}
                  toggleReportOption={() => undefined}
                  noteData={noteData as any}
                  trialBalanceLines={trialBalanceLines}
                  clientSetup={clientSetup}
                  entityType={entityType}
                  isCloseCorporationEntity={isCloseCorporation}
                  currentHeading={currentHeading}
                  priorHeading={priorHeading}
                  activeNoteTexts={activeNoteTexts}
                  defaultNoteTexts={defaultNoteTexts}
                  disclosureTokens={disclosureTokens}
                  hideComparatives={hideComparatives}
                  structuredNotesState={effectiveStructuredNotesState}
                  onStructuredNotesStateChange={() => undefined}
                  forceReviewMode={true}
                  sectionKeys={[key]}
                  headingMode="none"
                  rootId={`measure-note-${key}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div
        id="afs-pagination-ready"
        data-ready={paginationReady ? "true" : "false"}
        style={{ display: "none" }}
      />

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
  {reportOptions.showCoverLogo && clientLogoUrl ? (
    <img
      src={clientLogoUrl}
      alt={`${clientName} logo`}
      style={{
        display: "block",
        maxWidth: 240,
        maxHeight: 90,
        objectFit: "contain",
        marginBottom: 24,
      }}
    />
  ) : null}

                  <h1
                    style={{
                      fontSize: 22,
                      lineHeight: 1.25,
                      fontWeight: 800,
                      margin: "0 0 22px",
                      textTransform: "uppercase",
                      letterSpacing: "-0.01em",
                      borderBottom: "1.5px solid #111827",
                      paddingBottom: 5,
                    }}
                  >
                    {clientName}
                  </h1>
{tradingName &&
tradingName.toLowerCase() !== clientName.toLowerCase() ? (
  <div
    style={{
  marginTop: 8,
  marginBottom: 22,
  fontSize: 12,
  fontWeight: 400,
  color: "#4b5563",
  letterSpacing: "0.2px",
}}
  >
    Trading as {tradingName}
  </div>
) : null}


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
                      {isTrust ? "Master's reference number" : "Registration number"}:{" "}
                      {registrationNumber}
                    </div>
                  ) : null}
                </section>
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.index ? (
            <div id="print-index">
              <AfsA4Page {...reportHeaderProps}>
                <section style={{ fontSize: 11, color: "#111827" }}>
                  <h1 style={pageHeadingStyle()}>Index</h1>

                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {visibleReportSections
                        .filter((section) => section.id !== "cover-page")
                        .map((section, index) => (
                          <tr key={section.id}>
                            <td style={{ padding: "5px 0" }}>
                              {section.label}
                            </td>
                            <td
                              style={{
                                padding: "5px 0",
                                width: 60,
                                textAlign: "right",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {reportPageNumberMap[section.id] ?? "–"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
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
                        getSetupValue(clientSetup, ["trading_name"])
                      )}
                      {renderInfoRow(
                        isTrust ? "Master's reference number" : "Registration number",
                        registrationNumber,
                      )}
                      {renderInfoRow("Entity type", entityType)}
                      {renderInfoRow("Financial year end", displayYearEnd)}
                      {renderInfoRow(
                        "Country of incorporation and domicile",
                        country
                      )}
                      {renderInfoRow(
                        "Nature of business and principal activities",
                        getSetupValue(clientSetup, [
                          "nature_of_business",
                          "principal_activities",
                          "business_activity",
                          "business_description",
                        ]),
                        true
                      )}
                      {renderInfoRow(
                        roleLabel(entityType),
                        directorsForDisplay.map(getPersonName)
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
                        ])
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
                        ])
                      )}
                      {renderInfoRow(
                        "Postal address",
                        getSetupValue(clientSetup, [
                          "postal_address",
                          "mailing_address",
                          "postalAddress",
                          "mailingAddress",
                        ])
                      )}
                      {renderInfoRow(
                        "Bankers",
                        getSetupValue(clientSetup, [
                          "bankers",
                          "banker",
                          "bank_name",
                          "bankName",
                        ])
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
                        ])
                      )}
                      {renderInfoRow(
                        "VAT number",
                        getSetupValue(clientSetup, [
                          "vat_number",
                          "vat_reference_number",
                          "vatNumber",
                          "vatReferenceNumber",
                        ])
                      )}
                      {renderInfoRow(
                        "PAYE number",
                        getSetupValue(clientSetup, [
                          "paye_number",
                          "paye_reference_number",
                          "payeNumber",
                        ])
                      )}
                      {renderInfoRow(
                        "UIF number",
                        getSetupValue(clientSetup, [
                          "uif_number",
                          "uif_reference_number",
                          "uifNumber",
                        ])
                      )}
                      {renderInfoRow(
                        "Currency",
                        getSetupValue(clientSetup, [
                          "currency",
                          "presentation_currency",
                        ])
                      )}
                      {renderInfoRow(
                        "Legal framework",
                        legalFrameworkDisplay
                      )}
                      {renderInfoRow("Financial reporting framework", framework)}
                      {renderInfoRow(
                        "Nature of engagement",
                        isCloseCorporation ? "Accounting officer" : "Compilation",
                      )}
                      {renderInfoRow("Assurance provided", "None")}
                      {renderInfoRow(
                        isCloseCorporation ? "Accounting officers" : "Practitioners",
                        practitionerFirm,
                      )}
                      {renderInfoRow(
                        isCloseCorporation ? "Accounting officer" : "Preparer",
                        practitionerName,
                      )}
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
                    {isCloseCorporation
                      ? `${ccMemberPossessive(Math.max(1, directorsForDisplay.length))} Responsibilities and Approval`
                      : responsibilityTitle(entityType)}
                  </h1>

                  {isCloseCorporation ? (
                    <CcMembersResponsibilitiesBlock
                      clientName={clientName}
                      yearEnd={displayYearEnd}
                      approvalDate={String(approvalDate)}
                      members={directorsForDisplay}
                    />
                  ) : isTrust ? (
                    <TrustTrusteesResponsibilitiesBlock
                      clientName={clientName}
                      yearEnd={displayYearEnd}
                      approvalDate={String(approvalDate)}
                      trustees={directorsForDisplay}
                    />
                  ) : (
                    <DirectorsResponsibilitiesBlock context={narrativeContext} />
                  )}
                </section>
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.directorsReport ? (
            <div id="print-directors-report">
              {balancedDirectorsReportPageGroups.map((sectionKeys, pageIndex) => {
                const previousSectionCount = balancedDirectorsReportPageGroups
                  .slice(0, pageIndex)
                  .reduce((total, page) => total + page.length, 0);

                return (
                  <AfsA4Page
                    key={`directors-report-page-${pageIndex}`}
                    {...reportHeaderProps}
                  >
                    <section
                      style={{
                        fontSize: 11,
                        lineHeight: 1.45,
                        color: "#111827",
                      }}
                    >
                      <h1 style={pageHeadingStyle()}>
                        {pageIndex === 0
                          ? reportTitle(entityType)
                          : `${reportTitle(entityType)} — continued`}
                      </h1>

                      <DirectorsReportBlock
                        context={narrativeContext}
                        sectionKeys={sectionKeys}
                        startNumber={previousSectionCount}
                      />
                    </section>
                  </AfsA4Page>
                );
              })}
            </div>
          ) : null}

          {reportOptions.compilerReport ? (
            <div id="print-compiler-report">
              <AfsA4Page {...(isCloseCorporation ? reportHeaderProps : {})}>
                {isCloseCorporation ? (
                  <CcAccountingOfficerReportBlock
                    clientName={clientName}
                    yearEnd={displayYearEnd}
                    members={directorsForDisplay}
                    practitionerFirm={String(practitionerFirm)}
                    practitionerName={String(practitionerName)}
                    practitionerDesignation={String(practitionerDesignation)}
                    compilationDate={String(compilationDate)}
                    place={String(
                      getSetupValue(clientSetup, [
                        "place_of_signature",
                        "place_of_compilation",
                        "city",
                      ]) || "",
                    )}
                    practitionerLogoUrl={practitionerLogoUrl}
                    practitionerFooterLogoUrl={practitionerFooterLogoUrl}
                    practitionerAddressLines={firmSetting("address_lines")}
                    practitionerTelephone={firmSetting("telephone")}
                    practitionerEmail={firmSetting("email")}
                    practitionerWebsite={firmSetting("website")}
                    governingBodyName={firmSetting("governing_body_name")}
                    governingBodyRegistrationNumber={firmSetting(
                      "governing_body_registration_number",
                    )}
                    governingBodyLogoUrl={firmSetting("governing_body_logo_url")}
                    secondGoverningBodyName={firmSetting(
                      "second_governing_body_name",
                    )}
                    secondGoverningBodyRegistrationNumber={firmSetting(
                      "second_governing_body_registration_number",
                    )}
                    secondGoverningBodyLogoUrl={firmSetting(
                      "second_governing_body_logo_url",
                    )}
                    practitionerFooterText={firmSetting("footer_text")}
                  />
                ) : (
                  <section
                    style={{
                      fontFamily: "Arial, Helvetica, sans-serif",
                      fontSize: 11,
                      lineHeight: 1.45,
                      color: "#111827",
                    }}
                  >
                    <CompilationReportBlock context={narrativeContext} />
                  </section>
                )}
              </AfsA4Page>
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
                  rows={sfpRows.filter(
                  (row: any) =>
                    String(row?.label || "").trim().toLowerCase() !== "rounding",
                )}
                hidePriorYear={hideComparatives}
                />
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.soci ? (
            <div id="print-soci">
              <AfsA4Page {...reportHeaderProps}>
                <AfsStatementTable
                  title={entityPresentation.incomeStatementTitle}
                  currencyLabel="Figures in Rand"
                  currentHeading={currentHeading}
                  priorHeading={priorHeading}
                  rows={sociRows}
                hidePriorYear={hideComparatives}
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
            activeSectionId === "cash-flow" &&
            cashFlowViewMode === "work" &&
            !isPdfExportMode ? (
              <div
                id="print-cash-flow"
                style={{
                  width: "210mm",
                  minHeight: "297mm",
                  margin: "0 auto 18px",
                  padding: "18mm 16mm",
                  boxSizing: "border-box",
                  background: "#ffffff",
                  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.14)",
                  overflow: "visible",
                }}
              >
                <section style={{ fontSize: 10, color: "#111827" }}>
                  <h1 style={pageHeadingStyle()}>Cash Flow Workbench</h1>
                  <p
                    style={{
                      margin: "0 0 10px",
                      color: "#64748b",
                      lineHeight: 1.4,
                    }}
                  >
                    Capture or override only the cash-flow fields that require
                    adjustment. The AFS view remains the printable statement.
                  </p>

                  <AfsStatementOverrideSettings
                    mode="cashFlow"
                    overrides={effectiveStatementOverrides}
                    onChange={updateStatementOverride}
                    engineChecks={engineChecks}
                    entityType={presentationEntityType}
                  />
                </section>
              </div>
            ) : (
              <div id="print-cash-flow">
                <AfsA4Page {...reportHeaderProps}>
                  <AfsStatementTable
                    title="Statement of Cash Flows"
                    currencyLabel="Figures in Rand"
                    currentHeading={currentHeading}
                    priorHeading={priorHeading}
                    rows={cashFlowRows}
                    hidePriorYear={hideComparatives}
                  />
                </AfsA4Page>
              </div>
            )
          ) : null}

          {reportOptions.accountingPolicies ? (
            <div
              id="print-accounting-policies"
              ref={accountingPoliciesPrintRef}
            >
              {accountingPolicyPageGroups.map(
                (policyIndexes: number[], pageIndex: number) => (
                  <div
                    key={`accounting-policies-page-${pageIndex}`}
                    data-accounting-policy-page-index={pageIndex}
                  >
                    <AfsA4Page {...reportHeaderProps}>
                    <section
                      style={{
                        fontSize: 11,
                        lineHeight: 1.45,
                        color: "#111827",
                      }}
                    >
                      <h1 style={pageHeadingStyle()}>
                        {pageIndex === 0
                          ? "Accounting Policies"
                          : "Accounting Policies — continued"}
                      </h1>

                      {policyIndexes.map((policyIndex: number) =>
                        renderAccountingPolicyPrintItem(
                          accountingPolicyPrintItems[policyIndex],
                          policyIndex,
                        ),
                      )}
                    </section>
                    </AfsA4Page>
                  </div>
                ),
              )}
            </div>
          ) : null}

          {reportOptions.notes ? (
            activeSectionId === "notes" &&
            notesViewMode === "edit" &&
            !isPdfExportMode ? (
              <div
                id="print-notes"
                style={{
                  width: "min(100%, 1120px)",
                  boxSizing: "border-box",
                  margin: "0 auto",
                  padding: "22px 28px 42px",
                  background: "#ffffff",
                  color: "#111827",
                  minHeight: 0,
                  boxShadow: "none",
                }}
              >
                <AfsStructuredNotesPanel
                  engagementId={engagementId}
                  noteSections={effectiveNoteSections}
                  reportOptions={reportOptions as any}
                  toggleReportOption={(key: string, checked: boolean) =>
                    toggleReportOption(
                      key as keyof ReportOptions,
                      checked,
                    )
                  }
                  noteData={noteData as any}
                  trialBalanceLines={trialBalanceLines}
                  clientSetup={clientSetup}
                  entityType={entityType}
                  isCloseCorporationEntity={isCloseCorporation}
                  currentHeading={currentHeading}
                  priorHeading={priorHeading}
                  activeNoteTexts={activeNoteTexts}
                  defaultNoteTexts={defaultNoteTexts}
                  disclosureTokens={disclosureTokens}
                  hideComparatives={hideComparatives}
                  structuredNotesState={effectiveStructuredNotesState}
                  onStructuredNotesStateChange={
                    saveStructuredNotesStateEverywhere
                  }
                  forceReviewMode={false}
                  sectionKeys={activeNoteSectionKeys}
                  headingMode="main"
                  rootId="print-notes-work"
                />
              </div>
            ) : (
              <div
                id="print-notes"
                style={{
                  display: "grid",
                  gap: 16,
                  alignContent: "start",
                  justifyItems: "center",
                }}
              >
                {notesPageGroups.map((sectionKeys, pageIndex) => (
                  <div
                    key={`notes-page-${pageIndex}`}
                    data-notes-page-index={pageIndex}
                    style={{
                      width: "210mm",
                      minHeight: "297mm",
                    }}
                  >
                    <AfsA4Page {...reportHeaderProps}>
                      <AfsStructuredNotesPanel
                      engagementId={engagementId}
                      noteSections={effectiveNoteSections}
                      reportOptions={reportOptions as any}
                      toggleReportOption={(key: string, checked: boolean) =>
                        toggleReportOption(
                          key as keyof ReportOptions,
                          checked,
                        )
                      }
                      noteData={noteData as any}
                      trialBalanceLines={trialBalanceLines}
                      clientSetup={clientSetup}
                      entityType={entityType}
                      isCloseCorporationEntity={isCloseCorporation}
                      currentHeading={currentHeading}
                      priorHeading={priorHeading}
                      activeNoteTexts={activeNoteTexts}
                      defaultNoteTexts={defaultNoteTexts}
                      disclosureTokens={disclosureTokens}
                      hideComparatives={hideComparatives}
                      structuredNotesState={effectiveStructuredNotesState}
                      onStructuredNotesStateChange={saveStructuredNotesStateEverywhere}
                      forceReviewMode={isPdfExportMode}
                      sectionKeys={sectionKeys}
                      headingMode={pageIndex === 0 ? "main" : "continued"}
                      rootId={`print-notes-page-${pageIndex + 1}`}
                    />
                    </AfsA4Page>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {reportOptions.detailedIncomeStatement ? (
            <div id="print-detailed-income">
              <AfsA4Page {...reportHeaderProps}>
                {renderEditableDetailedIncomeStatement()}
              </AfsA4Page>
            </div>
          ) : null}

          {reportOptions.taxComputation ? (
            <div id="print-tax-computation">
              <AfsA4Page {...reportHeaderProps}>
                <section
                  style={{ fontSize: 11, lineHeight: 1.45, color: "#111827" }}
                >
                  <h1 style={pageHeadingStyle()}>Tax Computation</h1>

                  {(() => {
                    const profitBeforeTax = Math.round(
                      Number(engineChecks.profitBeforeTax || 0)
                    );

                    const savedTax = taxCalculation;
                    const hasSavedTax = Boolean(savedTax);

                    const accountingProfit = hasSavedTax
                      ? Math.round(Number(savedTax?.accounting_profit || 0))
                      : profitBeforeTax;

                    const permanentDifferences = hasSavedTax
                      ? Math.round(Number(savedTax?.permanent_differences || 0))
                      : 0;

                    const temporaryDifferences = hasSavedTax
                      ? Math.round(Number(savedTax?.temporary_differences || 0))
                      : 0;

                    const assessedLossBroughtForward = hasSavedTax
                      ? Math.abs(Math.round(Number(savedTax?.assessed_loss_bf || 0)))
                      : Math.abs(
                          Number(
                            getSetupValue(clientSetup, [
                              "assessed_loss",
                              "assessed_loss_brought_forward",
                              "assessedLoss",
                              "assessedLossBroughtForward",
                            ]) || 0
                          )
                        );

                    const taxableBeforeLoss =
                      accountingProfit +
                      permanentDifferences +
                      temporaryDifferences;

                    const taxableIncome = hasSavedTax
                      ? Math.max(0, Math.round(Number(savedTax?.taxable_income || 0)))
                      : Math.max(
                          0,
                          taxableBeforeLoss - assessedLossBroughtForward
                        );

                    const currentYearAssessedLoss = Math.max(
                      0,
                      -taxableBeforeLoss
                    );

                    const assessedLossUsed =
                      taxableBeforeLoss > 0
                        ? Math.min(
                            taxableBeforeLoss,
                            assessedLossBroughtForward
                          )
                        : 0;

                    const assessedLossCarriedForward =
                      Math.max(
                        0,
                        assessedLossBroughtForward - assessedLossUsed
                      ) + currentYearAssessedLoss;

                    const savedTaxRegime = String(
                      savedTax?.tax_regime || "",
                    ).toLowerCase();

                    const taxRegime = isTrust
                      ? "trust_ordinary"
                      : savedTaxRegime === "sbc"
                        ? "sbc"
                        : "normal";

                    const savedRate = Number(savedTax?.tax_rate || 0);
                    const normalTaxRate = isTrust
                      ? 0.45
                      : savedRate > 0
                        ? savedRate
                        : Number(
                            getSetupValue(clientSetup, [
                              "tax_rate",
                              "income_tax_rate",
                              "company_tax_rate",
                              "taxRate",
                              "incomeTaxRate",
                              "companyTaxRate",
                            ]) || 27
                          ) / 100;

                    const currentTax = hasSavedTax
                      ? Math.round(Number(savedTax?.current_tax || 0))
                      : Math.round(taxableIncome * normalTaxRate);

                    const deferredTaxAssetCurrent = Math.round(
                      (noteData.deferredTaxAsset || []).reduce(
                        (sum: number, line: any) =>
                          sum + Number(line.current || 0),
                        0
                      )
                    );

                    const deferredTaxLiabilityCurrent = Math.round(
                      (noteData.deferredTaxLiability || []).reduce(
                        (sum: number, line: any) =>
                          sum + Number(line.current || 0),
                        0
                      )
                    );

                    const taxExpenseMapped = Math.round(
                      (noteData.taxation || []).reduce(
                        (sum: number, line: any) => sum + Number(line.current || 0),
                        0
                      )
                    );

                    /*
                      IMPORTANT:
                      Do not manufacture deferred tax by forcing the calculated
                      current-tax charge to reconcile to the mapped SOCI tax balance.

                      The statement engine stores expense balances with the statement
                      sign (normally negative), while this tax computation presents
                      tax expense as a positive charge.

                      Deferred tax may only be shown here when it has been explicitly
                      recognised in the Tax Calculator. A mismatch between the
                      calculated tax and the mapped SOCI tax balance is a review /
                      journal difference — it is NOT deferred tax.
                    */
                    const mappedTaxExpensePresented = -taxExpenseMapped;

                    const explicitDeferredTaxRecognised = hasSavedTax
                      ? Math.round(Number(savedTax?.deferred_tax || 0))
                      : 0;

                    const deferredTaxCredit =
                      explicitDeferredTaxRecognised !== 0
                        ? -explicitDeferredTaxRecognised
                        : 0;

                    const calculatedTaxExpenseCredit =
                      currentTax + deferredTaxCredit;

                    const mappedTaxDifference =
                      mappedTaxExpensePresented !== 0
                        ? mappedTaxExpensePresented - calculatedTaxExpenseCredit
                        : 0;

                    const currentTaxReceivable = Math.round(
                      (noteData.currentTaxReceivable || []).reduce(
                        (sum: number, line: any) =>
                          sum + Number(line.current || 0),
                        0
                      )
                    );

                    const currentTaxPayable = Math.round(
                      (noteData.currentTaxPayable || []).reduce(
                        (sum: number, line: any) =>
                          sum + Number(line.current || 0),
                        0
                      )
                    );

                    const priorCurrentTaxReceivable = Math.round(
                      (noteData.currentTaxReceivable || []).reduce(
                        (sum: number, line: any) =>
                          sum + Number(line.prior || 0),
                        0
                      )
                    );

                    const priorCurrentTaxPayable = Math.round(
                      (noteData.currentTaxPayable || []).reduce(
                        (sum: number, line: any) =>
                          sum + Number(line.prior || 0),
                        0
                      )
                    );

                    const openingCurrentTaxBalance =
                      priorCurrentTaxPayable - priorCurrentTaxReceivable;
                    const mappedClosingCurrentTaxBalance =
                      currentTaxPayable - currentTaxReceivable;

                    const provisionalTaxPaid = hasSavedTax
                      ? Math.max(
                          0,
                          Math.round(Number(savedTax?.provisional_tax_paid || 0))
                        )
                      : 0;

                    const calculatedClosingCurrentTaxBalance =
                      openingCurrentTaxBalance +
                      currentTax -
                      provisionalTaxPaid;

                    const taxBalanceRows: Array<
                      [string, number, "normal" | "bold"]
                    > = [];

                    const hasDeferredTaxOnly =
                      currentTax === 0 &&
                      deferredTaxCredit !== 0 &&
                      currentTaxPayable === 0 &&
                      currentTaxReceivable === 0 &&
                      priorCurrentTaxPayable === 0 &&
                      priorCurrentTaxReceivable === 0;

                    const hasCurrentTaxBalance =
                      !hasDeferredTaxOnly &&
                      (openingCurrentTaxBalance !== 0 ||
                        provisionalTaxPaid !== 0 ||
                        currentTax !== 0 ||
                        mappedClosingCurrentTaxBalance !== 0);

                    if (hasCurrentTaxBalance) {
                      taxBalanceRows.push(
                        [
                          "Amount owing / (prepaid) at beginning of year",
                          openingCurrentTaxBalance,
                          "normal",
                        ],
                        [
                          taxRegime === "sbc"
                            ? "SBC tax per calculation"
                            : "Normal tax per calculation",
                          currentTax,
                          "normal",
                        ],
                        [
                          "Provisional tax paid / tax credits",
                          -provisionalTaxPaid,
                          "normal",
                        ],
                        [
                          "Calculated amount owing / (prepaid) at end of year",
                          calculatedClosingCurrentTaxBalance,
                          "bold",
                        ],
                      );

                      if (
                        mappedClosingCurrentTaxBalance !== 0 &&
                        mappedClosingCurrentTaxBalance !==
                          calculatedClosingCurrentTaxBalance
                      ) {
                        taxBalanceRows.push([
                          "AFS current tax balance",
                          mappedClosingCurrentTaxBalance,
                          "normal",
                        ]);
                      }
                    }

                    const topRows: Array<[string, number, "normal" | "bold"]> = [
                      ["Profit / (loss) before taxation", accountingProfit, "normal"],
                      [
                        "Add / (deduct): permanent differences",
                        permanentDifferences,
                        "normal",
                      ],
                      [
                        "Add / (deduct): temporary differences",
                        temporaryDifferences,
                        "normal",
                      ],
                      [
                        "Taxable income / (assessed loss) before losses",
                        taxableBeforeLoss,
                        "bold",
                      ],
                      ["Assessed loss utilised", -assessedLossUsed, "normal"],
                      ["Taxable income", taxableIncome, "bold"],
                    ];

                    const taxBasisLabel =
                      taxRegime === "sbc"
                        ? "Small Business Corporation tax"
                        : taxRegime === "trust_ordinary"
                          ? `Trust tax at ${(normalTaxRate * 100).toFixed(0)}%`
                          : `Normal tax at ${(normalTaxRate * 100).toFixed(0)}%`;

                    const taxRows: Array<[string, number, "normal" | "bold"]> = [
                      [taxBasisLabel, currentTax, "bold"],
                    ];

                    const assessedLossRows: Array<
                      [string, number, "normal" | "bold"]
                    > = [
                      [
                        "Assessed loss brought forward",
                        assessedLossBroughtForward,
                        "normal",
                      ],
                      [
                        "Current-year assessed loss",
                        currentYearAssessedLoss,
                        "normal",
                      ],
                      ["Assessed loss utilised", -assessedLossUsed, "normal"],
                      [
                        "Total assessed loss carried forward",
                        assessedLossCarriedForward,
                        "bold",
                      ],
                    ];

                    const expenseRows: Array<
                      [string, number, "normal" | "bold"]
                    > = [
                      [
                        taxRegime === "sbc"
                          ? "SBC current tax expense"
                          : "Normal tax expense",
                        currentTax,
                        "normal",
                      ],
                    ];

                    if (deferredTaxCredit !== 0) {
                      expenseRows.push([
                        deferredTaxCredit < 0
                          ? "Deferred tax credit recognised"
                          : "Deferred tax expense recognised",
                        deferredTaxCredit,
                        "normal",
                      ]);
                    }

                    expenseRows.push([
                      "Calculated income tax expense / (credit)",
                      calculatedTaxExpenseCredit,
                      "bold",
                    ]);

                    if (mappedTaxExpensePresented !== 0) {
                      expenseRows.push([
                        "Mapped income tax expense / (credit) per SOCI",
                        mappedTaxExpensePresented,
                        "normal",
                      ]);
                    }

                    if (mappedTaxDifference !== 0) {
                      expenseRows.push([
                        "Difference requiring review / journal",
                        mappedTaxDifference,
                        "bold",
                      ]);
                    }

                    const renderRows = (
                      rows: Array<[string, number, "normal" | "bold"]>
                    ) =>
                      rows.map(([label, amount, rowType]) => (
                        <tr key={String(label)}>
                          <td
                            style={{
                              padding: "4px 0",
                              fontWeight: rowType === "bold" ? 800 : 400,
                            }}
                          >
                            {label}
                          </td>
                          <td
                            style={{
                              padding: "4px 0",
                              textAlign: "right",
                              width: 120,
                              fontWeight: rowType === "bold" ? 800 : 400,
                              borderTop:
                                rowType === "bold"
                                  ? "1px solid #111827"
                                  : "0",
                            }}
                          >
                            {taxAmount(Number(amount))}
                          </td>
                        </tr>
                      ));

                    return (
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 10.5,
                          marginTop: 10,
                        }}
                      >
                        <tbody>
                          {renderRows(topRows)}

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                padding: "14px 0 4px",
                                fontWeight: 800,
                              }}
                            >
                              Current tax calculation
                            </td>
                          </tr>
                          {renderRows(taxRows)}

                          {assessedLossBroughtForward !== 0 ||
                          assessedLossCarriedForward !== 0 ? (
                            <>
                              <tr>
                                <td
                                  colSpan={2}
                                  style={{
                                    padding: "14px 0 4px",
                                    fontWeight: 800,
                                  }}
                                >
                                  Summary of assessed loss
                                </td>
                              </tr>
                              {renderRows(assessedLossRows)}
                            </>
                          ) : null}

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                padding: "14px 0 4px",
                                fontWeight: 800,
                              }}
                            >
                              Reconciliation of income tax expense / (credit)
                            </td>
                          </tr>
                          {renderRows(expenseRows)}

                          {taxBalanceRows.length ? (
                            <>
                              <tr>
                                <td
                                  colSpan={2}
                                  style={{
                                    padding: "14px 0 4px",
                                    fontWeight: 800,
                                  }}
                                >
                                  Reconciliation of current tax balance
                                </td>
                              </tr>
                              {renderRows(taxBalanceRows)}
                            </>
                          ) : null}
                        </tbody>
                      </table>
                    );
                  })()}
                </section>
              </AfsA4Page>
            </div>
          ) : null}
        </>
      )}
    </AfsPrintStudioShell>
  );
}
  // preservation-first: no additional logic
  // preservation-first: no additional logic
  // preservation-first: no additional logic
  // preservation-first: no additional logic
  // preservation-first: no additional logic
  // preservation-first: no additional logic
  // preservation-first: no additional logic
  // preservation-first: no additional logic
