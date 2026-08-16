"use client";

import { AfsStatementRow } from "./AfsStatementTable";

export type AfsEngineTrialBalanceLine = {
  id?: string;
  account_code?: string | null;
  account_name?: string | null;
  account_type?: string | null;
  debit?: number | null;
  credit?: number | null;
  opening_balance?: number | null;
  current_year_balance?: number | null;
  prior_year_balance?: number | null;
  mapping_category?: string | null;
  note_number?: string | number | null;
  mapping_leaf_id?: string | null;
  mapping_label?: string | null;
  mapping_statement?: string | null;
  mapping_section?: string | null;
  mapping_path?: string | null;
  mapping_code?: string | null;
  lead_schedule_number?: string | null;
  lead_schedule_key?: string | null;
};

export type AfsStatementOverrides = {
  cashFlowMethod?: "indirect" | "direct";

  roundingTolerance?: number | null;
  roundingAccountMappingCode?: string | null;
  roundingAccountLabel?: string | null;

  cashReceiptsCustomersCurrent?: number | null;
  cashReceiptsCustomersPrior?: number | null;
  cashPaymentsSuppliersEmployeesCurrent?: number | null;
  cashPaymentsSuppliersEmployeesPrior?: number | null;
  cashOtherDirectOperatingCurrent?: number | null;
  cashOtherDirectOperatingPrior?: number | null;

  sceOpeningShareCapital?: number | null;
  sceOpeningRetainedIncome?: number | null;
  sceOpeningReserves?: number | null;
  scePriorOtherMovements?: number | null;
  sceCurrentOtherMovements?: number | null;
  sceOtherMovements?: number | null;

  cashOpeningBalance?: number | null;
  cashPriorOpeningBalance?: number | null;

  cashAdjustmentsToProfitCurrent?: number | null;
  cashAdjustmentsToProfitPrior?: number | null;
  cashWorkingCapitalCurrent?: number | null;
  cashWorkingCapitalPrior?: number | null;
  cashInterestReceivedCurrent?: number | null;
  cashInterestReceivedPrior?: number | null;
  cashFinanceCostsPaidCurrent?: number | null;
  cashFinanceCostsPaidPrior?: number | null;
  cashTaxPaidCurrent?: number | null;
  cashTaxPaidPrior?: number | null;
  cashOtherOperatingCurrent?: number | null;
  cashOtherOperatingPrior?: number | null;
  cashOtherOperating2Current?: number | null;
  cashOtherOperating2Prior?: number | null;
  cashOtherOperating3Current?: number | null;
  cashOtherOperating3Prior?: number | null;
  cashPurchaseOfPpeCurrent?: number | null;
  cashPurchaseOfPpePrior?: number | null;
  cashProceedsOnDisposalPpeCurrent?: number | null;
  cashProceedsOnDisposalPpePrior?: number | null;
  cashOtherInvestingCurrent?: number | null;
  cashOtherInvestingPrior?: number | null;
  cashOtherInvesting2Current?: number | null;
  cashOtherInvesting2Prior?: number | null;
  cashOtherInvesting3Current?: number | null;
  cashOtherInvesting3Prior?: number | null;
  cashLoansRaisedCurrent?: number | null;
  cashLoansRaisedPrior?: number | null;
  cashLoansRepaidCurrent?: number | null;
  cashLoansRepaidPrior?: number | null;
  cashDividendsPaidCurrent?: number | null;
  cashDividendsPaidPrior?: number | null;
  cashOtherFinancingCurrent?: number | null;
  cashOtherFinancingPrior?: number | null;
  cashOtherFinancing2Current?: number | null;
  cashOtherFinancing2Prior?: number | null;
  cashOtherFinancing3Current?: number | null;
  cashOtherFinancing3Prior?: number | null;

  /** Legacy field kept so old saved settings do not break. */
  cashPriorMovement?: number | null;
};

export type AfsNoteKey =
  | "propertyPlantEquipment"
  | "rightOfUseAssets"
  | "goodwill"
  | "investmentProperty"
  | "intangibleAssets"
  | "biologicalAssets"
  | "investmentsSubsidiaries"
  | "investmentsAssociates"
  | "investmentsJointVentures"
  | "otherInvestments"
  | "otherFinancialAssets"
  | "otherNonCurrentAssets"
  | "deferredTaxAsset"
  | "deferredTax"
  | "loansReceivable"
  | "inventories"
  | "contractAssets"
  | "tradeReceivables"
  | "taxStatutoryReceivables"
  | "currentTaxReceivable"
  | "cashAndCashEquivalents"
  | "assetsHeldForSale"
  | "shareCapital"
  | "retainedIncome"
  | "reserves"
  | "nonControllingInterests"
  | "otherEquity"
  | "provisions"
  | "employeeBenefitObligations"
  | "deferredIncomeGrants"
  | "groupRelatedPartyBorrowings"
  | "shareholdersLoans"
  | "borrowings"
  | "assetFinance"
  | "leaseLiabilities"
  | "otherFinancialLiabilities"
  | "supplierFinance"
  | "deferredTaxLiability"
  | "bankOverdraft"
  | "tradePayables"
  | "contractLiabilities"
  | "dividendPayable"
  | "taxStatutoryPayables"
  | "currentTaxPayable"
  | "liabilitiesHeldForSale"
  | "revenue"
  | "otherIncome"
  | "costOfSales"
  | "otherOperatingIncome"
  | "investmentIncome"
  | "operatingExpenses"
  | "financeCosts"
  | "otherGainsLosses"
  | "taxation"
  | "otherComprehensiveIncome"
  | "discontinuedOperations"
  | "cashUsedInOperations";

export type AfsNoteLine = {
  id: string;
  label: string;
  current: number;
  prior: number;
};

export type AfsNoteData = Record<AfsNoteKey, AfsNoteLine[]>;

export type AfsEngineChecks = {
  sfpAssetsTotal: number;
  sfpEquityAndLiabilitiesTotal: number;
  sfpDifference: number;
  profitForYear: number;
  profitBeforeTax: number;
  sfpEquityTotal: number;
  sceTotalEquity: number;
  sceEquityDifferenceToSfp: number;
  cashClosingFromSfp: number;
  cashOpeningFromSfp: number;
  cashMovementFromSfp: number;
  cashMovementFromCashFlow: number;
  cashClosingFromCashFlow: number;
  cashFlowMovementDifference: number;
  cashFlowClosingDifference: number;
  cashOpeningPrior: number;
  cashMovementPriorFromCashFlow: number;
  cashClosingPriorFromCashFlow: number;
  cashClosingPriorFromSfp: number;
  cashFlowPriorClosingDifference: number;
};

export type AfsPrintStatementEngineResult = {
  sfpRows: AfsStatementRow[];
  sociRows: AfsStatementRow[];
  sceRows: AfsStatementRow[];
  cashFlowRows: AfsStatementRow[];
  detailedIncomeRows: AfsStatementRow[];
  noteData: AfsNoteData;
  checks: AfsEngineChecks;
};

type CanonicalBucket = {
  statement:
    | "nonCurrentAsset"
    | "currentAsset"
    | "equity"
    | "nonCurrentLiability"
    | "currentLiability"
    | "profitLoss"
    | "otherComprehensiveIncome"
    | "unmapped";
  noteKey?: AfsNoteKey;
  plGroup?:
    | "revenue"
    | "costOfSales"
    | "otherOperatingIncome"
    | "investmentIncome"
    | "operatingExpenses"
    | "financeCosts"
    | "otherGainsLosses"
    | "taxation"
    | "discontinuedOperations"
    | "otherComprehensiveIncome";
};

type StatementBucket = {
  key: string;
  label: string;
  note?: string | number | null;
  noteKey?: AfsNoteKey;
  current: number;
  prior: number;
};

const NOTE_LABELS: Record<AfsNoteKey, string> = {
  propertyPlantEquipment: "Property, plant and equipment",
  rightOfUseAssets: "Right-of-use assets",
  goodwill: "Goodwill",
  investmentProperty: "Investment property",
  intangibleAssets: "Intangible assets",
  biologicalAssets: "Biological assets",
  investmentsSubsidiaries: "Investments in subsidiaries",
  investmentsAssociates: "Investments in associates",
  investmentsJointVentures: "Investments in joint ventures",
  otherInvestments: "Other investments",
  otherFinancialAssets: "Other financial assets",
  otherNonCurrentAssets: "Other non-current assets",
  deferredTaxAsset: "Deferred tax asset",
  deferredTax: "Deferred tax",
  loansReceivable: "Loans receivable",
  inventories: "Inventories",
  contractAssets: "Contract assets",
  tradeReceivables: "Trade and other receivables",
  taxStatutoryReceivables: "Tax and statutory receivables",
  currentTaxReceivable: "Current tax receivable",
  cashAndCashEquivalents: "Cash and cash equivalents",
  assetsHeldForSale: "Assets held for sale",
  shareCapital: "Share capital / contributions",
  retainedIncome: "Retained income / accumulated loss",
  reserves: "Reserves",
  nonControllingInterests: "Non-controlling interests",
  otherEquity: "Other equity",
  provisions: "Provisions",
  employeeBenefitObligations: "Employee benefit obligations",
  deferredIncomeGrants: "Deferred income and government grants",
  groupRelatedPartyBorrowings: "Group and related-party borrowings",
  shareholdersLoans: "Shareholder / director / member loans",
  borrowings: "Borrowings",
  assetFinance: "Asset finance / instalment sale liabilities",
  leaseLiabilities: "Lease liabilities",
  otherFinancialLiabilities: "Other financial liabilities",
  supplierFinance: "Supplier finance arrangements",
  deferredTaxLiability: "Deferred tax liability",
  bankOverdraft: "Bank overdraft",
  tradePayables: "Trade and other payables",
  contractLiabilities: "Contract liabilities / deferred revenue",
  dividendPayable: "Dividend payable",
  taxStatutoryPayables: "Tax and statutory payables",
  currentTaxPayable: "Current tax payable",
  liabilitiesHeldForSale: "Liabilities held for sale",
  revenue: "Revenue",
  otherIncome: "Other income",
  costOfSales: "Cost of sales",
  otherOperatingIncome: "Other operating income",
  investmentIncome: "Investment income",
  operatingExpenses: "Operating expenses",
  financeCosts: "Finance costs",
  otherGainsLosses: "Other gains / (losses)",
  taxation: "Taxation",
  otherComprehensiveIncome: "Other comprehensive income",
  discontinuedOperations: "Discontinued operations",
  cashUsedInOperations: "Cash generated from / (used in) operations",
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanLabel(value: unknown) {
  return String(value || "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * Statement classification is mapping-number only.
 * Labels and account names are presentation fields and never determine placement.
 */

function rawCurrent(line: AfsEngineTrialBalanceLine) {
  if (
    line.current_year_balance !== null &&
    line.current_year_balance !== undefined
  ) {
    return safeNumber(line.current_year_balance);
  }

  return safeNumber(line.debit) - safeNumber(line.credit);
}

function rawPrior(line: AfsEngineTrialBalanceLine) {
  if (
    line.prior_year_balance !== null &&
    line.prior_year_balance !== undefined
  ) {
    return safeNumber(line.prior_year_balance);
  }

  return safeNumber(line.opening_balance);
}

function bucketKey(line: AfsEngineTrialBalanceLine, canonical: CanonicalBucket) {
  /*
    Statement rows are grouped by the canonical mapping class.
    Mapping leaf codes still remain available for classes that do not have
    a dedicated note class, such as VAT and statutory controls.
  */
  return (
    canonical.noteKey ||
    line.mapping_code ||
    line.mapping_leaf_id ||
    line.lead_schedule_number ||
    "mapped-uncategorised"
  );
}

function mappingStartsWith(line: AfsEngineTrialBalanceLine, prefixes: string[]) {
  /*
    NON-NEGOTIABLE:
    Statement and note classification is driven by mapping_code only.
    Lead-schedule keys/numbers, labels, paths, categories and account names
    may assist the user elsewhere, but they never determine classification here.
  */
  const value = String(line.mapping_code || "").trim().toLowerCase();
  if (!value) return false;

  return prefixes.some((prefix) => {
    const clean = String(prefix || "").trim().toLowerCase();
    return (
      value === clean ||
      value.startsWith(`${clean}.`) ||
      value.startsWith(`${clean}-`) ||
      value.startsWith(`${clean} `)
    );
  });
}

function bucketLabel(line: AfsEngineTrialBalanceLine, canonical: CanonicalBucket) {
  if (canonical.noteKey) return NOTE_LABELS[canonical.noteKey];

  return cleanLabel(
    line.mapping_label ||
      line.mapping_category ||
      line.mapping_code ||
      "Mapped item",
  );
}

function detailedLabel(line: AfsEngineTrialBalanceLine) {
  /*
    Detailed IS must use the selected mapping wording first.
    Account names are internal working-file descriptions only.
  */
  return (
    cleanLabel(
      line.mapping_label ||
        line.mapping_category ||
        line.lead_schedule_key ||
        line.mapping_code ||
        "Mapped item",
    ) || bucketLabel(line, canonicalFromMapping(line))
  );
}

function canonicalFromMapping(line: AfsEngineTrialBalanceLine): CanonicalBucket {
  /*
    ABSOLUTE RULE:
    Statement placement and note family are determined only by mapping_code.
  */

  // NON-CURRENT ASSETS
  if (mappingStartsWith(line, ["305"])) return { statement: "nonCurrentAsset", noteKey: "propertyPlantEquipment" };
  if (mappingStartsWith(line, ["306"])) return { statement: "nonCurrentAsset", noteKey: "rightOfUseAssets" };
  if (mappingStartsWith(line, ["310"])) return { statement: "nonCurrentAsset", noteKey: "investmentProperty" };
  if (mappingStartsWith(line, ["320"])) return { statement: "nonCurrentAsset", noteKey: "intangibleAssets" };
  if (mappingStartsWith(line, ["321"])) return { statement: "nonCurrentAsset", noteKey: "goodwill" };
  if (mappingStartsWith(line, ["326"])) return { statement: "nonCurrentAsset", noteKey: "investmentsSubsidiaries" };
  if (mappingStartsWith(line, ["327"])) return { statement: "nonCurrentAsset", noteKey: "investmentsAssociates" };
  if (mappingStartsWith(line, ["328"])) return { statement: "nonCurrentAsset", noteKey: "investmentsJointVentures" };
  if (mappingStartsWith(line, ["329"])) return { statement: "nonCurrentAsset", noteKey: "otherInvestments" };
  if (mappingStartsWith(line, ["330"])) return { statement: "nonCurrentAsset", noteKey: "biologicalAssets" };
  if (mappingStartsWith(line, ["340"])) return { statement: "nonCurrentAsset", noteKey: "loansReceivable" };
  if (mappingStartsWith(line, ["350"])) return { statement: "nonCurrentAsset", noteKey: "otherFinancialAssets" };
  if (mappingStartsWith(line, ["390"])) return { statement: "nonCurrentAsset", noteKey: "otherNonCurrentAssets" };
  if (mappingStartsWith(line, ["395"])) return { statement: "nonCurrentAsset", noteKey: "deferredTaxAsset" };

  // CURRENT ASSETS
  if (mappingStartsWith(line, ["405"])) return { statement: "currentAsset", noteKey: "inventories" };
  if (mappingStartsWith(line, ["410"])) return { statement: "currentAsset", noteKey: "biologicalAssets" };
  if (mappingStartsWith(line, ["415"])) return { statement: "currentAsset", noteKey: "contractAssets" };
  if (mappingStartsWith(line, ["420"])) return { statement: "currentAsset", noteKey: "cashAndCashEquivalents" };
  if (mappingStartsWith(line, ["430"])) return { statement: "currentAsset", noteKey: "tradeReceivables" };
  if (mappingStartsWith(line, ["435"])) return { statement: "currentAsset", noteKey: "otherFinancialAssets" };
  if (mappingStartsWith(line, ["449"])) return { statement: "currentAsset", noteKey: "loansReceivable" };
  if (mappingStartsWith(line, ["490"])) return { statement: "currentAsset", noteKey: "taxStatutoryReceivables" };
  if (mappingStartsWith(line, ["495"])) return { statement: "currentAsset", noteKey: "currentTaxReceivable" };
  if (mappingStartsWith(line, ["499"])) return { statement: "currentAsset", noteKey: "assetsHeldForSale" };

  // EQUITY
  if (mappingStartsWith(line, ["805"])) return { statement: "equity", noteKey: "shareCapital" };
  if (mappingStartsWith(line, ["810"])) return { statement: "equity", noteKey: "retainedIncome" };
  if (mappingStartsWith(line, ["820"])) return { statement: "equity", noteKey: "reserves" };
  if (mappingStartsWith(line, ["830"])) return { statement: "equity", noteKey: "nonControllingInterests" };
  if (mappingStartsWith(line, ["840"])) return { statement: "equity", noteKey: "otherEquity" };

  // NON-CURRENT LIABILITIES
  if (mappingStartsWith(line, ["515"])) return { statement: "nonCurrentLiability", noteKey: "provisions" };
  if (mappingStartsWith(line, ["520"])) return { statement: "nonCurrentLiability", noteKey: "employeeBenefitObligations" };
  if (mappingStartsWith(line, ["531"])) return { statement: "nonCurrentLiability", noteKey: "deferredIncomeGrants" };
  if (mappingStartsWith(line, ["547"])) return { statement: "nonCurrentLiability", noteKey: "groupRelatedPartyBorrowings" };
  if (mappingStartsWith(line, ["548"])) return { statement: "nonCurrentLiability", noteKey: "shareholdersLoans" };

  // Specific borrowing subtypes must be tested before the broad 550 family.
  if (mappingStartsWith(line, ["550.40", "550.50"])) {
    return { statement: "nonCurrentLiability", noteKey: "assetFinance" };
  }
  if (mappingStartsWith(line, ["550", "551"])) {
    return { statement: "nonCurrentLiability", noteKey: "borrowings" };
  }

  if (mappingStartsWith(line, ["555"])) return { statement: "nonCurrentLiability", noteKey: "leaseLiabilities" };
  if (mappingStartsWith(line, ["560"])) return { statement: "nonCurrentLiability", noteKey: "otherFinancialLiabilities" };
  if (mappingStartsWith(line, ["580"])) return { statement: "nonCurrentLiability", noteKey: "supplierFinance" };
  if (mappingStartsWith(line, ["590"])) return { statement: "nonCurrentLiability", noteKey: "otherFinancialLiabilities" };
  if (mappingStartsWith(line, ["595"])) return { statement: "nonCurrentLiability", noteKey: "deferredTaxLiability" };

  // CURRENT LIABILITIES
  if (mappingStartsWith(line, ["610.30", "610.40"])) {
    return { statement: "currentLiability", noteKey: "assetFinance" };
  }
  if (mappingStartsWith(line, ["610"])) return { statement: "currentLiability", noteKey: "borrowings" };
  if (mappingStartsWith(line, ["615"])) return { statement: "currentLiability", noteKey: "leaseLiabilities" };
  if (mappingStartsWith(line, ["620"])) return { statement: "currentLiability", noteKey: "bankOverdraft" };
  if (mappingStartsWith(line, ["625"])) return { statement: "currentLiability", noteKey: "otherFinancialLiabilities" };
  if (mappingStartsWith(line, ["630"])) return { statement: "currentLiability", noteKey: "tradePayables" };
  if (mappingStartsWith(line, ["640"])) return { statement: "currentLiability", noteKey: "contractLiabilities" };
  if (mappingStartsWith(line, ["650"])) return { statement: "currentLiability", noteKey: "deferredIncomeGrants" };
  if (mappingStartsWith(line, ["660"])) return { statement: "currentLiability", noteKey: "provisions" };
  if (mappingStartsWith(line, ["670"])) return { statement: "currentLiability", noteKey: "employeeBenefitObligations" };
  if (mappingStartsWith(line, ["680"])) return { statement: "currentLiability", noteKey: "supplierFinance" };
  if (mappingStartsWith(line, ["688"])) return { statement: "currentLiability", noteKey: "dividendPayable" };
  if (mappingStartsWith(line, ["690"])) return { statement: "currentLiability", noteKey: "taxStatutoryPayables" };
  if (mappingStartsWith(line, ["695"])) return { statement: "currentLiability", noteKey: "currentTaxPayable" };
  if (mappingStartsWith(line, ["699"])) return { statement: "currentLiability", noteKey: "liabilitiesHeldForSale" };

  // PROFIT OR LOSS / OCI
  if (mappingStartsWith(line, ["700"])) return { statement: "profitLoss", noteKey: "revenue", plGroup: "revenue" };
  if (mappingStartsWith(line, ["720"])) return { statement: "profitLoss", noteKey: "costOfSales", plGroup: "costOfSales" };
  if (mappingStartsWith(line, ["730"])) return { statement: "profitLoss", noteKey: "otherOperatingIncome", plGroup: "otherOperatingIncome" };
  if (mappingStartsWith(line, ["770"])) return { statement: "profitLoss", noteKey: "investmentIncome", plGroup: "investmentIncome" };
  if (mappingStartsWith(line, ["750"])) return { statement: "profitLoss", noteKey: "operatingExpenses", plGroup: "operatingExpenses" };
  if (mappingStartsWith(line, ["775"])) return { statement: "profitLoss", noteKey: "financeCosts", plGroup: "financeCosts" };
  if (mappingStartsWith(line, ["780", "781", "785"])) return { statement: "profitLoss", noteKey: "otherGainsLosses", plGroup: "otherGainsLosses" };
  if (mappingStartsWith(line, ["795"])) return { statement: "profitLoss", noteKey: "taxation", plGroup: "taxation" };
  if (mappingStartsWith(line, ["799"])) return { statement: "profitLoss", noteKey: "discontinuedOperations", plGroup: "discontinuedOperations" };
  if (mappingStartsWith(line, ["797"])) return { statement: "otherComprehensiveIncome", noteKey: "otherComprehensiveIncome", plGroup: "otherComprehensiveIncome" };

  return { statement: "unmapped" };
}

function normaliseAmount(line: AfsEngineTrialBalanceLine, amount: number, canonical: CanonicalBucket) {
  if (
    canonical.statement === "equity" ||
    canonical.statement === "nonCurrentLiability" ||
    canonical.statement === "currentLiability" ||
    canonical.plGroup === "revenue" ||
    canonical.plGroup === "otherOperatingIncome" ||
    canonical.plGroup === "investmentIncome" ||
    canonical.plGroup === "otherGainsLosses" ||
    canonical.plGroup === "discontinuedOperations" ||
    canonical.plGroup === "otherComprehensiveIncome"
  ) {
    return -amount;
  }

  if (
    canonical.plGroup === "costOfSales" ||
    canonical.plGroup === "operatingExpenses" ||
    canonical.plGroup === "financeCosts"
  ) {
    return -Math.abs(amount);
  }

  if (canonical.plGroup === "taxation") {
    return -amount;
  }

  return amount;
}

function addToBucket(
  buckets: Map<string, StatementBucket>,
  line: AfsEngineTrialBalanceLine,
  canonical: CanonicalBucket,
  noteNumbers: Partial<Record<AfsNoteKey, string | number>>
) {
  const key = String(bucketKey(line, canonical));
  const label = bucketLabel(line, canonical);

  if (!buckets.has(key)) {
    buckets.set(key, {
      key,
      label,
      note: canonical.noteKey ? noteNumbers[canonical.noteKey] || null : null,
      noteKey: canonical.noteKey,
      current: 0,
      prior: 0,
    });
  }

  const bucket = buckets.get(key);
  if (!bucket) return;

  bucket.current += normaliseAmount(line, rawCurrent(line), canonical);
  bucket.prior += normaliseAmount(line, rawPrior(line), canonical);
}

function addBalanceSheetLineByPeriod(
  buckets: {
    nonCurrentAssets: Map<string, StatementBucket>;
    currentAssets: Map<string, StatementBucket>;
    nonCurrentLiabilities: Map<string, StatementBucket>;
    currentLiabilities: Map<string, StatementBucket>;
  },
  line: AfsEngineTrialBalanceLine,
  canonical: CanonicalBucket,
  noteNumbers: Partial<Record<AfsNoteKey, string | number>>
) {
  const baseKey = String(bucketKey(line, canonical));
  const baseLabel = bucketLabel(line, canonical);
  const baseNote = canonical.noteKey
    ? noteNumbers[canonical.noteKey] || null
    : null;

  const target =
    canonical.statement === "nonCurrentAsset"
      ? buckets.nonCurrentAssets
      : canonical.statement === "currentAsset"
      ? buckets.currentAssets
      : canonical.statement === "nonCurrentLiability"
      ? buckets.nonCurrentLiabilities
      : buckets.currentLiabilities;

  const key = `${baseKey}:${canonical.statement}`;

  if (!target.has(key)) {
    target.set(key, {
      key,
      label: baseLabel,
      note: baseNote,
      noteKey: canonical.noteKey,
      current: 0,
      prior: 0,
    });
  }

  const bucket = target.get(key);
  if (!bucket) return;

  const currentRaw = rawCurrent(line);
  const priorRaw = rawPrior(line);
  const liability =
    canonical.statement === "nonCurrentLiability" ||
    canonical.statement === "currentLiability";

  bucket.current += liability ? -currentRaw : currentRaw;
  bucket.prior += liability ? -priorRaw : priorRaw;
}

function visibleBuckets(map: Map<string, StatementBucket>) {
  return Array.from(map.values())
    .filter(
      (bucket) =>
        Math.round(bucket.current) !== 0 || Math.round(bucket.prior) !== 0
    )
    .sort((a, b) => a.label.localeCompare(b.label));
}

function sumBuckets(buckets: StatementBucket[]) {
  return buckets.reduce(
    (total, bucket) => ({
      current: total.current + bucket.current,
      prior: total.prior + bucket.prior,
    }),
    { current: 0, prior: 0 }
  );
}

function sumRoundedBuckets(buckets: StatementBucket[]) {
  return buckets.reduce(
    (total, bucket) => ({
      current: total.current + Math.round(bucket.current),
      prior: total.prior + Math.round(bucket.prior),
    }),
    { current: 0, prior: 0 },
  );
}

function toRows(buckets: StatementBucket[]): AfsStatementRow[] {
  return buckets.map((bucket) => ({
    id: bucket.key,
    label: bucket.label,
    note: bucket.note || null,
    current: Math.round(bucket.current),
    prior: Math.round(bucket.prior),
    type: "line",
  }));
}

function toNoteLines(buckets: StatementBucket[]): AfsNoteLine[] {
  return buckets.map((bucket) => ({
    id: bucket.key,
    label: bucket.label,
    current: Math.round(bucket.current),
    prior: Math.round(bucket.prior),
  }));
}

function rowAmount(rows: AfsStatementRow[], id: string, side: "current" | "prior") {
  const row = rows.find((item) => item.id === id);
  return Number(row?.[side] || 0);
}

function checkDifference(value: number, tolerance = 1) {
  const rounded = Math.round(value);
  return Math.abs(rounded) <= tolerance ? 0 : rounded;
}

function overrideAmount(
  overrides: AfsStatementOverrides,
  key: keyof AfsStatementOverrides,
  fallback = 0
) {
  const value = overrides[key];

  if (value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function emptyNoteData(): AfsNoteData {
  return {
    propertyPlantEquipment: [],
    rightOfUseAssets: [],
    goodwill: [],
    investmentProperty: [],
    intangibleAssets: [],
    biologicalAssets: [],
    investmentsSubsidiaries: [],
    investmentsAssociates: [],
    investmentsJointVentures: [],
    otherInvestments: [],
    otherFinancialAssets: [],
    otherNonCurrentAssets: [],
    deferredTaxAsset: [],
    deferredTax: [],
    loansReceivable: [],
    inventories: [],
    contractAssets: [],
    tradeReceivables: [],
    taxStatutoryReceivables: [],
    currentTaxReceivable: [],
    cashAndCashEquivalents: [],
    assetsHeldForSale: [],
    shareCapital: [],
    retainedIncome: [],
    reserves: [],
    nonControllingInterests: [],
    otherEquity: [],
    provisions: [],
    employeeBenefitObligations: [],
    deferredIncomeGrants: [],
    groupRelatedPartyBorrowings: [],
    shareholdersLoans: [],
    borrowings: [],
    assetFinance: [],
    leaseLiabilities: [],
    otherFinancialLiabilities: [],
    supplierFinance: [],
    deferredTaxLiability: [],
    bankOverdraft: [],
    tradePayables: [],
    contractLiabilities: [],
    dividendPayable: [],
    taxStatutoryPayables: [],
    currentTaxPayable: [],
    liabilitiesHeldForSale: [],
    revenue: [],
    otherIncome: [],
    costOfSales: [],
    otherOperatingIncome: [],
    investmentIncome: [],
    operatingExpenses: [],
    financeCosts: [],
    otherGainsLosses: [],
    taxation: [],
    otherComprehensiveIncome: [],
    discontinuedOperations: [],
    cashUsedInOperations: [],
  };
}

function detailedRowsFromLines(
  lines: AfsEngineTrialBalanceLine[],
  overrides: AfsStatementOverrides = {},
  automaticProfitRoundingAdjustment = 0,
) {
  const rows: AfsStatementRow[] = [];
  const roundingTolerance = Math.max(
    0,
    Math.round(Number(overrides.roundingTolerance ?? 5)),
  );
  const roundingAccountMappingCode = String(
    overrides.roundingAccountMappingCode || "",
  ).trim();
  const roundingAccountLabel =
    String(overrides.roundingAccountLabel || "").trim() || "Bank Charges";

  type DetailedBucket = {
    key: string;
    label: string;
    current: number;
    prior: number;
    isDefaultRoundingTarget?: boolean;
  };

  type DetailedGroup =
    | "revenue"
    | "costOfSales"
    | "otherOperatingIncome"
    | "investmentIncome"
    | "operatingExpenses"
    | "financeCosts"
    | "otherGainsLosses"
    | "taxation"
    | "discontinuedOperations"
    | "otherComprehensiveIncome";

  const buckets: Record<DetailedGroup, Map<string, DetailedBucket>> = {
    revenue: new Map<string, DetailedBucket>(),
    costOfSales: new Map<string, DetailedBucket>(),
    otherOperatingIncome: new Map<string, DetailedBucket>(),
    investmentIncome: new Map<string, DetailedBucket>(),
    operatingExpenses: new Map<string, DetailedBucket>(),
    financeCosts: new Map<string, DetailedBucket>(),
    otherGainsLosses: new Map<string, DetailedBucket>(),
    taxation: new Map<string, DetailedBucket>(),
    discontinuedOperations: new Map<string, DetailedBucket>(),
    otherComprehensiveIncome: new Map<string, DetailedBucket>(),
  };

  function detailedBucketKey(
    line: AfsEngineTrialBalanceLine,
    group: string,
  ) {
    return String(
      line.mapping_code ||
        line.lead_schedule_number ||
        line.mapping_leaf_id ||
        line.lead_schedule_key ||
        line.mapping_label ||
        line.mapping_category ||
        `${group}-unmapped`,
    ).trim();
  }

  function isDefaultBankChargesLine(line: AfsEngineTrialBalanceLine) {
    return String(line.mapping_label || "")
      .trim()
      .toLowerCase() === "bank charges";
  }

  function preferredDetailedLabel(
    existing: string | undefined,
    line: AfsEngineTrialBalanceLine,
  ) {
    const customLabel = cleanLabel(line.mapping_label);

    if (customLabel) return customLabel;
    if (existing) return existing;

    return detailedLabel(line);
  }

  lines.forEach((line) => {
    const canonical = canonicalFromMapping(line);
    if (canonical.statement !== "profitLoss") return;

    const group = canonical.plGroup || "operatingExpenses";
    const groupBuckets = buckets[group];
    const key = detailedBucketKey(line, group);
    const existing = groupBuckets.get(key);

    if (!existing) {
      groupBuckets.set(key, {
        key,
        label: preferredDetailedLabel(undefined, line),
        current: normaliseAmount(line, rawCurrent(line), canonical),
        prior: normaliseAmount(line, rawPrior(line), canonical),
        isDefaultRoundingTarget: isDefaultBankChargesLine(line),
      });
      return;
    }

    existing.label = preferredDetailedLabel(existing.label, line);
    existing.current += normaliseAmount(
      line,
      rawCurrent(line),
      canonical,
    );
    existing.prior += normaliseAmount(
      line,
      rawPrior(line),
      canonical,
    );
    existing.isDefaultRoundingTarget =
      existing.isDefaultRoundingTarget || isDefaultBankChargesLine(line);
  });

  function groupRows(group: DetailedGroup): AfsStatementRow[] {
    const rawBuckets = Array.from(buckets[group].values()).filter(
      (bucket) =>
        Math.round(bucket.current) !== 0 ||
        Math.round(bucket.prior) !== 0,
    );

    if (
      group === "operatingExpenses" &&
      automaticProfitRoundingAdjustment !== 0 &&
      Math.abs(automaticProfitRoundingAdjustment) <= roundingTolerance
    ) {
      const target =
        (roundingAccountMappingCode
          ? rawBuckets.find(
              (bucket) =>
                String(bucket.key).trim() === roundingAccountMappingCode,
            )
          : undefined) ||
        rawBuckets.find((bucket) => bucket.isDefaultRoundingTarget);

      if (target) {
        target.current += automaticProfitRoundingAdjustment;
        target.label = roundingAccountLabel;
      }
    }

    const rows = rawBuckets
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((bucket) => ({
        id: `${group}:${bucket.key}`,
        label: bucket.label,
        current: Math.round(bucket.current),
        prior: Math.round(bucket.prior),
        type: "line" as const,
      }));

    const roundedRawCurrent = Math.round(
      rawBuckets.reduce((sum, bucket) => sum + bucket.current, 0),
    );
    const roundedRawPrior = Math.round(
      rawBuckets.reduce((sum, bucket) => sum + bucket.prior, 0),
    );

    const displayedCurrent = rows.reduce(
      (sum, row) => sum + Number(row.current || 0),
      0,
    );
    const displayedPrior = rows.reduce(
      (sum, row) => sum + Number(row.prior || 0),
      0,
    );

    const roundingCurrent = roundedRawCurrent - displayedCurrent;
    const roundingPrior = roundedRawPrior - displayedPrior;

    if (roundingCurrent !== 0 || roundingPrior !== 0) {
      const withinTolerance =
        Math.abs(roundingCurrent) <= roundingTolerance &&
        Math.abs(roundingPrior) <= roundingTolerance;

      const defaultTargetBucket = rawBuckets.find(
        (bucket) => bucket.isDefaultRoundingTarget,
      );
      const targetRow = roundingAccountMappingCode
        ? rows.find(
            (row) =>
              row.id === `${group}:${roundingAccountMappingCode}`,
          )
        : defaultTargetBucket
        ? rows.find(
            (row) => row.id === `${group}:${defaultTargetBucket.key}`,
          )
        : undefined;

      if (withinTolerance && targetRow) {
        targetRow.current =
          Number(targetRow.current || 0) + roundingCurrent;
        targetRow.prior =
          Number(targetRow.prior || 0) + roundingPrior;
        targetRow.label = roundingAccountLabel;
      } else {
        rows.push({
          id: `${group}:rounding-adjustment`,
          label: "Rounding adjustment",
          current: roundingCurrent,
          prior: roundingPrior,
          type: "line",
        });
      }
    }

    return rows;
  }

  const groupedRows = {
    revenue: groupRows("revenue"),
    costOfSales: groupRows("costOfSales"),
    otherOperatingIncome: groupRows("otherOperatingIncome"),
    investmentIncome: groupRows("investmentIncome"),
    operatingExpenses: groupRows("operatingExpenses"),
    financeCosts: groupRows("financeCosts"),
    otherGainsLosses: groupRows("otherGainsLosses"),
    taxation: groupRows("taxation"),
    discontinuedOperations: groupRows("discontinuedOperations"),
    otherComprehensiveIncome: groupRows("otherComprehensiveIncome"),
  };

  function sum(groupRows: AfsStatementRow[]) {
    return groupRows.reduce(
      (total, row) => ({
        current: total.current + Number(row.current || 0),
        prior: total.prior + Number(row.prior || 0),
      }),
      { current: 0, prior: 0 },
    );
  }

  function pushGroup(
    id: string,
    label: string,
    groupRows: AfsStatementRow[],
    options: {
      showEvenIfZero?: boolean;
      subtotalLabel?: string;
    } = {},
  ) {
    if (!options.showEvenIfZero && groupRows.length === 0) return;

    rows.push({
      id: `${id}-section`,
      label,
      type: "section",
    });

    if (groupRows.length > 0) {
      rows.push(...groupRows);
    } else {
      rows.push({
        id: `${id}-zero`,
        label,
        current: 0,
        prior: 0,
        type: "line",
      });
    }

    const groupTotal = sum(groupRows);

    rows.push({
      id: `${id}-total`,
      label: options.subtotalLabel || label,
      current: Math.round(groupTotal.current),
      prior: Math.round(groupTotal.prior),
      type: "subtotal",
    });
  }

  pushGroup("revenue", "Revenue", groupedRows.revenue, {
    showEvenIfZero: true,
    subtotalLabel: "Total revenue",
  });

  pushGroup(
    "cost-of-sales",
    "Cost of sales",
    groupedRows.costOfSales,
    {
      showEvenIfZero: true,
      subtotalLabel: "Total cost of sales",
    },
  );

  const revenueTotal = sum(groupedRows.revenue);
  const costOfSalesTotal = sum(groupedRows.costOfSales);

  const gross = {
    current: revenueTotal.current + costOfSalesTotal.current,
    prior: revenueTotal.prior + costOfSalesTotal.prior,
  };

  rows.push({
    id: "gross-profit",
    label: "Gross profit / (loss)",
    current: Math.round(gross.current),
    prior: Math.round(gross.prior),
    type: "grand-total",
  });

  pushGroup(
    "other-operating-income",
    "Other operating income",
    groupedRows.otherOperatingIncome,
    { subtotalLabel: "Total other operating income" },
  );

  pushGroup(
    "investment-income",
    "Investment income",
    groupedRows.investmentIncome,
    { subtotalLabel: "Total investment income" },
  );

  pushGroup(
    "other-gains-losses",
    "Other gains / (losses)",
    groupedRows.otherGainsLosses,
    { subtotalLabel: "Total other gains / (losses)" },
  );

  pushGroup(
    "operating-expenses",
    "Operating expenses",
    groupedRows.operatingExpenses,
    {
      showEvenIfZero: true,
      subtotalLabel: "Total operating expenses",
    },
  );

  pushGroup(
    "finance-costs",
    "Finance costs",
    groupedRows.financeCosts,
    {
      subtotalLabel: "Total finance costs",
    },
  );

  const otherOperatingIncomeTotal = sum(groupedRows.otherOperatingIncome);
  const investmentIncomeTotal = sum(groupedRows.investmentIncome);
  const otherGainsLossesTotal = sum(groupedRows.otherGainsLosses);
  const operatingExpensesTotal = sum(
    groupedRows.operatingExpenses,
  );
  const financeCostsTotal = sum(groupedRows.financeCosts);

  const beforeTax = {
    current:
      gross.current +
      otherOperatingIncomeTotal.current +
      investmentIncomeTotal.current +
      otherGainsLossesTotal.current +
      operatingExpensesTotal.current +
      financeCostsTotal.current,
    prior:
      gross.prior +
      otherOperatingIncomeTotal.prior +
      investmentIncomeTotal.prior +
      otherGainsLossesTotal.prior +
      operatingExpensesTotal.prior +
      financeCostsTotal.prior,
  };

  rows.push({
    id: "profit-before-tax",
    label: "Profit / (loss) before taxation",
    current: Math.round(beforeTax.current),
    prior: Math.round(beforeTax.prior),
    type: "grand-total",
  });

  const taxationTotal = sum(groupedRows.taxation);

  rows.push({
    id: "taxation",
    label: "Taxation",
    current: Math.round(taxationTotal.current),
    prior: Math.round(taxationTotal.prior),
    type: "line",
  });

  rows.push({
    id: "detailed-total",
    label: "Profit / (loss) for the year",
    current: Math.round(
      beforeTax.current + taxationTotal.current,
    ),
    prior: Math.round(
      beforeTax.prior + taxationTotal.prior,
    ),
    type: "grand-total",
  });

  return rows;
}

export function buildAfsPrintStatementEngine(
  lines: AfsEngineTrialBalanceLine[],
  overrides: AfsStatementOverrides = {},
  noteNumbers: Partial<Record<AfsNoteKey, string | number>> = {}
): AfsPrintStatementEngineResult {
  const buckets = {
    nonCurrentAssets: new Map<string, StatementBucket>(),
    currentAssets: new Map<string, StatementBucket>(),
    equity: new Map<string, StatementBucket>(),
    nonCurrentLiabilities: new Map<string, StatementBucket>(),
    currentLiabilities: new Map<string, StatementBucket>(),
    revenue: new Map<string, StatementBucket>(),
    costOfSales: new Map<string, StatementBucket>(),
    otherOperatingIncome: new Map<string, StatementBucket>(),
    investmentIncome: new Map<string, StatementBucket>(),
    operatingExpenses: new Map<string, StatementBucket>(),
    financeCosts: new Map<string, StatementBucket>(),
    otherGainsLosses: new Map<string, StatementBucket>(),
    taxation: new Map<string, StatementBucket>(),
    discontinuedOperations: new Map<string, StatementBucket>(),
    otherComprehensiveIncome: new Map<string, StatementBucket>(),
  };

  lines.forEach((line) => {
    const canonical = canonicalFromMapping(line);

    if (canonical.statement === "unmapped") return;

    if (
      canonical.statement === "nonCurrentAsset" ||
      canonical.statement === "currentAsset" ||
      canonical.statement === "nonCurrentLiability" ||
      canonical.statement === "currentLiability"
    ) {
      addBalanceSheetLineByPeriod(
        buckets,
        line,
        canonical,
        noteNumbers
      );
      return;
    }

    if (canonical.statement === "equity") {
      addToBucket(buckets.equity, line, canonical, noteNumbers);
      return;
    }

    if (
      (canonical.statement === "profitLoss" ||
        canonical.statement === "otherComprehensiveIncome") &&
      canonical.plGroup
    ) {
      addToBucket(buckets[canonical.plGroup], line, canonical, noteNumbers);
    }
  });

  const nonCurrentAssets = visibleBuckets(buckets.nonCurrentAssets);
  const currentAssets = visibleBuckets(buckets.currentAssets);
  const equityRaw = visibleBuckets(buckets.equity);
  const nonCurrentLiabilities = visibleBuckets(buckets.nonCurrentLiabilities);
  const currentLiabilities = visibleBuckets(buckets.currentLiabilities);

  const revenue = visibleBuckets(buckets.revenue);
  const costOfSales = visibleBuckets(buckets.costOfSales);
  const otherOperatingIncome = visibleBuckets(buckets.otherOperatingIncome);
  const investmentIncome = visibleBuckets(buckets.investmentIncome);
  const operatingExpenses = visibleBuckets(buckets.operatingExpenses);
  const financeCosts = visibleBuckets(buckets.financeCosts);
  const otherGainsLosses = visibleBuckets(buckets.otherGainsLosses);
  const taxation = visibleBuckets(buckets.taxation);
  const discontinuedOperations = visibleBuckets(buckets.discontinuedOperations);
  const otherComprehensiveIncome = visibleBuckets(buckets.otherComprehensiveIncome);

  const revenueTotal = sumBuckets(revenue);
  const cosTotal = sumBuckets(costOfSales);
  const gross = {
    current: revenueTotal.current + cosTotal.current,
    prior: revenueTotal.prior + cosTotal.prior,
  };

  const otherOperatingIncomeTotal = sumBuckets(otherOperatingIncome);
  const investmentIncomeTotal = sumBuckets(investmentIncome);
  const otherGainsLossesTotal = sumBuckets(otherGainsLosses);
  let opexTotal = sumBuckets(operatingExpenses);
  let operatingProfit = {
    current:
      gross.current +
      otherOperatingIncomeTotal.current +
      investmentIncomeTotal.current +
      otherGainsLossesTotal.current +
      opexTotal.current,
    prior:
      gross.prior +
      otherOperatingIncomeTotal.prior +
      investmentIncomeTotal.prior +
      otherGainsLossesTotal.prior +
      opexTotal.prior,
  };

  const financeCostsTotal = sumBuckets(financeCosts);
  let beforeTax = {
    current: operatingProfit.current + financeCostsTotal.current,
    prior: operatingProfit.prior + financeCostsTotal.prior,
  };

  const taxationTotal = sumBuckets(taxation);
  const discontinuedOperationsTotal = sumBuckets(discontinuedOperations);
  const otherComprehensiveIncomeTotal = sumBuckets(otherComprehensiveIncome);

  let profitForYear = {
    current:
      beforeTax.current +
      taxationTotal.current +
      discontinuedOperationsTotal.current,
    prior:
      beforeTax.prior +
      taxationTotal.prior +
      discontinuedOperationsTotal.prior,
  };

  const totalComprehensiveIncome = {
    current: profitForYear.current + otherComprehensiveIncomeTotal.current,
    prior: profitForYear.prior + otherComprehensiveIncomeTotal.prior,
  };

  const shareCapitalRaw = equityRaw.filter(
    (item) => item.noteKey === "shareCapital"
  );
  const retainedIncomeRaw = equityRaw.filter(
    (item) => item.noteKey === "retainedIncome"
  );
  const otherEquity = equityRaw.filter(
    (item) => !shareCapitalRaw.includes(item) && !retainedIncomeRaw.includes(item)
  );

  const shareCapitalTotal = sumBuckets(shareCapitalRaw);
  const retainedIncomeTotal = sumBuckets(retainedIncomeRaw);
  const otherEquityTotal = sumBuckets(otherEquity);

  const openingShareCapital =
    overrides.sceOpeningShareCapital !== null &&
    overrides.sceOpeningShareCapital !== undefined
      ? Number(overrides.sceOpeningShareCapital)
      : shareCapitalTotal.prior;

  /*
    Opening retained income must come from the mapped prior-year retained
    income balance wherever that balance exists. A manual override is only
    used for genuinely incomplete first-year or legacy files.

    This prevents an old saved override from surviving a Next Flight refresh
    and incorrectly replacing the rolled-forward comparative balance.
  */
  const hasMappedPriorRetainedIncome =
    Math.abs(retainedIncomeTotal.prior) >= 0.005;

  const rawOpeningRetainedInput = hasMappedPriorRetainedIncome
    ? retainedIncomeTotal.prior
    : overrides.sceOpeningRetainedIncome !== null &&
      overrides.sceOpeningRetainedIncome !== undefined
    ? Number(overrides.sceOpeningRetainedIncome)
    : 0;

  const retainedMappingIndicatesLoss =
    retainedIncomeTotal.current < 0 || retainedIncomeTotal.prior < 0;

  const openingRetainedIncome =
    rawOpeningRetainedInput > 0 && retainedMappingIndicatesLoss
      ? -Math.abs(rawOpeningRetainedInput)
      : rawOpeningRetainedInput;

  const priorOtherMovements =
    overrides.scePriorOtherMovements !== null &&
    overrides.scePriorOtherMovements !== undefined
      ? Number(overrides.scePriorOtherMovements)
      : 0;

  const priorClosingRetainedIncome =
    openingRetainedIncome + profitForYear.prior + priorOtherMovements;

  const roundingTolerance = Math.max(
    0,
    Math.round(Number(overrides.roundingTolerance ?? 5)),
  );
  const roundingAccountMappingCode = String(
    overrides.roundingAccountMappingCode || "",
  ).trim();

  const preliminaryRetainedIncomeDifference =
    Math.round(retainedIncomeTotal.current) -
    Math.round(priorClosingRetainedIncome + profitForYear.current);

  let automaticProfitRoundingAdjustment =
    Math.abs(preliminaryRetainedIncomeDifference) <= roundingTolerance
      ? preliminaryRetainedIncomeDifference
      : 0;

  if (
    automaticProfitRoundingAdjustment !== 0 &&
    operatingExpenses.length > 0
  ) {
    operatingExpenses[0].current += automaticProfitRoundingAdjustment;

    opexTotal = sumBuckets(operatingExpenses);
    operatingProfit = {
      current: gross.current + otherOperatingIncomeTotal.current + investmentIncomeTotal.current + otherGainsLossesTotal.current + opexTotal.current,
      prior: gross.prior + otherOperatingIncomeTotal.prior + investmentIncomeTotal.prior + otherGainsLossesTotal.prior + opexTotal.prior,
    };
    beforeTax = {
      current: operatingProfit.current + financeCostsTotal.current,
      prior: operatingProfit.prior + financeCostsTotal.prior,
    };
    profitForYear = {
      current: beforeTax.current + taxationTotal.current + discontinuedOperationsTotal.current,
      prior: beforeTax.prior + taxationTotal.prior + discontinuedOperationsTotal.prior,
    };
  }

  const savedCurrentOtherMovements =
    overrides.sceCurrentOtherMovements !== null &&
    overrides.sceCurrentOtherMovements !== undefined
      ? Number(overrides.sceCurrentOtherMovements)
      : overrides.sceOtherMovements !== null &&
        overrides.sceOtherMovements !== undefined
      ? Number(overrides.sceOtherMovements)
      : 0;

  /*
    A R1-R2 difference between mapped closing retained income and the sum of
    prior closing retained income plus current profit is presentation rounding,
    not an equity distribution.
  */
  const mappedRetainedIncomeRounding =
    Math.round(retainedIncomeTotal.current) -
    Math.round(priorClosingRetainedIncome + profitForYear.current);

  const currentOtherMovements =
    Math.abs(savedCurrentOtherMovements) <= roundingTolerance
      ? 0
      : savedCurrentOtherMovements;

  const currentEquityRoundingAdjustment =
    Math.abs(mappedRetainedIncomeRounding) <= roundingTolerance
      ? mappedRetainedIncomeRounding
      : 0;

  /*
    Where a mapped current-year retained-income balance exists, it is the
    SFP source of truth.

    Rebuilding retained income from prior closing plus current profit can
    omit dividends, distributions, prior-period adjustments and other equity
    movements already included in the mapped trial balance.
  */
  const hasMappedCurrentRetainedIncome =
    Math.abs(retainedIncomeTotal.current) >= 0.005;

  let currentClosingRetainedIncome =
    hasMappedCurrentRetainedIncome
      ? retainedIncomeTotal.current
      : priorClosingRetainedIncome +
        profitForYear.current +
        currentOtherMovements;

  const shareCapital: StatementBucket[] = [
    {
      key: "share-capital-adjusted",
      label: "Share Capital",
      note: noteNumbers.shareCapital || null,
      noteKey: "shareCapital" as AfsNoteKey,
      current: shareCapitalTotal.current || openingShareCapital,
      prior: shareCapitalTotal.prior || openingShareCapital,
    },
  ].filter(
    (item) =>
      Math.round(item.current) !== 0 ||
      Math.round(item.prior) !== 0,
  );

  const retainedIncome: StatementBucket[] = [
    {
      key: "retained-income-adjusted",
      label: "Retained Income / Accumulated Loss",
      note: noteNumbers.retainedIncome || null,
      noteKey: "retainedIncome" as AfsNoteKey,
      current: currentClosingRetainedIncome,
      prior: priorClosingRetainedIncome,
    },
  ].filter(
    (item) =>
      Math.round(item.current) !== 0 ||
      Math.round(item.prior) !== 0,
  );

  const equity: StatementBucket[] = [
    ...shareCapital,
    ...retainedIncome,
    ...otherEquity,
  ];

  const ncaTotal = sumRoundedBuckets(nonCurrentAssets);
  const caTotal = sumRoundedBuckets(currentAssets);
  const assetsTotal = {
    current: ncaTotal.current + caTotal.current,
    prior: ncaTotal.prior + caTotal.prior,
  };

  let equityTotal = sumRoundedBuckets(equity);
  const nclTotal = sumRoundedBuckets(nonCurrentLiabilities);
  const clTotal = sumRoundedBuckets(currentLiabilities);
  const liabilitiesTotal = {
    current: nclTotal.current + clTotal.current,
    prior: nclTotal.prior + clTotal.prior,
  };
  let equityLiabilitiesTotal = {
    current: equityTotal.current + liabilitiesTotal.current,
    prior: equityTotal.prior + liabilitiesTotal.prior,
  };

  /*
    FINAL SFP ROUNDING CONTROL

    The printed SFP must balance on the displayed Rand amounts. Where the
    difference is within the engagement rounding tolerance, absorb it into
    retained income before any SFP, SCE or check rows are built. This changes
    the actual displayed equity balance instead of merely overwriting the
    grand-total row.
  */
  const sfpRetainedRoundingCurrent =
    Math.round(assetsTotal.current) -
    Math.round(equityLiabilitiesTotal.current);
  const sfpRetainedRoundingPrior =
    Math.round(assetsTotal.prior) -
    Math.round(equityLiabilitiesTotal.prior);

  /*
    Always allow at least R1 of presentation rounding on the SFP, even when
    the engagement rounding tolerance is set to zero.
  */
  const sfpRoundingTolerance = Math.max(1, roundingTolerance);

  if (
    retainedIncome.length > 0 &&
    Math.abs(sfpRetainedRoundingCurrent) <= sfpRoundingTolerance
  ) {
    retainedIncome[0].current += sfpRetainedRoundingCurrent;
    currentClosingRetainedIncome += sfpRetainedRoundingCurrent;
  }

  if (
    retainedIncome.length > 0 &&
    Math.abs(sfpRetainedRoundingPrior) <= sfpRoundingTolerance
  ) {
    retainedIncome[0].prior += sfpRetainedRoundingPrior;
  }

  /*
    FINAL PROFIT ROUNDING ABSORPTION

    The SFP rounding control can change the displayed closing retained-income
    balance after the preliminary profit rounding was calculated. Recalculate
    the remaining difference here and absorb it into operating expenses when
    it falls within the engagement tolerance. This makes SOCI profit, Detailed
    IS profit and the SCE retained-income roll-forward agree without showing an
    artificial equity movement.
  */
  const finalProfitRoundingAdjustment =
    Math.round(currentClosingRetainedIncome) -
    Math.round(priorClosingRetainedIncome + profitForYear.current);

  if (
    finalProfitRoundingAdjustment !== 0 &&
    Math.abs(finalProfitRoundingAdjustment) <= roundingTolerance &&
    operatingExpenses.length > 0
  ) {
    operatingExpenses[0].current += finalProfitRoundingAdjustment;
    automaticProfitRoundingAdjustment += finalProfitRoundingAdjustment;

    opexTotal = sumBuckets(operatingExpenses);
    operatingProfit = {
      current: gross.current + otherOperatingIncomeTotal.current + investmentIncomeTotal.current + otherGainsLossesTotal.current + opexTotal.current,
      prior: gross.prior + otherOperatingIncomeTotal.prior + investmentIncomeTotal.prior + otherGainsLossesTotal.prior + opexTotal.prior,
    };
    beforeTax = {
      current: operatingProfit.current + financeCostsTotal.current,
      prior: operatingProfit.prior + financeCostsTotal.prior,
    };
    profitForYear = {
      current: beforeTax.current + taxationTotal.current + discontinuedOperationsTotal.current,
      prior: beforeTax.prior + taxationTotal.prior + discontinuedOperationsTotal.prior,
    };
  }

  equityTotal = sumRoundedBuckets(equity);
  equityLiabilitiesTotal = {
    current: equityTotal.current + liabilitiesTotal.current,
    prior: equityTotal.prior + liabilitiesTotal.prior,
  };

  const sfpRows: AfsStatementRow[] = [
    { id: "assets", label: "Assets", type: "section" },
    { id: "nca", label: "Non-current assets", type: "subsection" },
    ...toRows(nonCurrentAssets),
    {
      id: "nca-total",
      label: "Total non-current assets",
      current: Math.round(ncaTotal.current),
      prior: Math.round(ncaTotal.prior),
      type: "subtotal",
    },
    { id: "space-1", type: "spacer" },
    { id: "ca", label: "Current assets", type: "subsection" },
    ...toRows(currentAssets),
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
    { id: "equity-liabilities", label: "Equity and liabilities", type: "section" },
    { id: "equity", label: "Equity", type: "subsection" },
    ...toRows(equity),
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
    ...toRows(nonCurrentLiabilities),
    {
      id: "ncl-total",
      label: "Total non-current liabilities",
      current: Math.round(nclTotal.current),
      prior: Math.round(nclTotal.prior),
      type: "subtotal",
    },
    { id: "cl", label: "Current liabilities", type: "subsection" },
    ...toRows(currentLiabilities),
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

  /*
    AFS R1 DISPLAY ROUNDING FIX

    When detailed buckets contain cents, each line is displayed rounded to Rand.
    In rare cases the separately rounded assets total and equity/liabilities total
    differ by R1. For the printed AFS, force the displayed SFP grand total to
    agree where the difference is only a rounding cent issue.
  */
  const sfpAssetsDisplayCurrent = Math.round(assetsTotal.current);
  const sfpAssetsDisplayPrior = Math.round(assetsTotal.prior);
  const sfpEquityLiabilitiesDisplayCurrent = Math.round(equityLiabilitiesTotal.current);
  const sfpEquityLiabilitiesDisplayPrior = Math.round(equityLiabilitiesTotal.prior);

  const sfpCurrentRoundingDifference =
    sfpAssetsDisplayCurrent - sfpEquityLiabilitiesDisplayCurrent;
  const sfpPriorRoundingDifference =
    sfpAssetsDisplayPrior - sfpEquityLiabilitiesDisplayPrior;

  if (Math.abs(sfpCurrentRoundingDifference) <= 1) {
    const eqlRow = sfpRows.find((row) => row.id === "eql-total") as any;
    if (eqlRow) eqlRow.current = sfpAssetsDisplayCurrent;
  }

  if (Math.abs(sfpPriorRoundingDifference) <= 1) {
    const eqlRow = sfpRows.find((row) => row.id === "eql-total") as any;
    if (eqlRow) eqlRow.prior = sfpAssetsDisplayPrior;
  }

  const sociRows: AfsStatementRow[] = [
    ...toRows(revenue),
    ...toRows(costOfSales),
    {
      id: "gross",
      label: "Gross profit / (loss)",
      current: Math.round(gross.current),
      prior: Math.round(gross.prior),
      type: "subtotal",
    },
    ...toRows(otherOperatingIncome),
    ...toRows(investmentIncome),
    ...toRows(otherGainsLosses),
    ...toRows(operatingExpenses),
    {
      id: "operating-profit",
      label: "Operating profit / (loss)",
      current: Math.round(operatingProfit.current),
      prior: Math.round(operatingProfit.prior),
      type: "subtotal",
    },
    ...toRows(financeCosts),
    {
      id: "before-tax",
      label: "Profit / (loss) before taxation",
      current: Math.round(beforeTax.current),
      prior: Math.round(beforeTax.prior),
      type: "subtotal",
    },
    ...toRows(taxation),
    ...toRows(discontinuedOperations),
    {
      id: "profit-year",
      label: "Profit / (loss) for the year",
      current: Math.round(profitForYear.current),
      prior: Math.round(profitForYear.prior),
      type: "grand-total",
    },
    ...toRows(otherComprehensiveIncome),
    ...(otherComprehensiveIncome.length > 0
      ? [{
          id: "total-comprehensive-income",
          label: "Total comprehensive income / (loss)",
          current: Math.round(totalComprehensiveIncome.current),
          prior: Math.round(totalComprehensiveIncome.prior),
          type: "grand-total" as const,
        }]
      : []),
  ];

  const scePriorTotal =
    (shareCapitalTotal.prior || openingShareCapital) +
    priorClosingRetainedIncome +
    otherEquityTotal.prior;

  const sceCurrentTotal =
    (shareCapitalTotal.current || openingShareCapital) +
    currentClosingRetainedIncome +
    otherEquityTotal.current;

  const sceRows: AfsStatementRow[] = [
    { id: "sce-share-opening", label: "Opening share capital", current: Math.round(openingShareCapital), prior: null, type: "line" },
    { id: "sce-retained-opening", label: "Opening retained income", current: Math.round(openingRetainedIncome), prior: null, type: "line" },
    { id: "sce-prior-profit", label: "Prior year profit / (loss)", current: Math.round(profitForYear.prior), prior: null, type: "line" },
    { id: "sce-prior-other-movement", label: "Prior year other movements / distributions", current: Math.round(priorOtherMovements), prior: null, type: "line" },
    { id: "sce-prior-closing-retained", label: "Prior year closing retained income", current: Math.round(priorClosingRetainedIncome), prior: null, type: "subtotal" },
    { id: "sce-current-profit", label: "Current year profit / (loss)", current: Math.round(profitForYear.current), prior: null, type: "line" },
    { id: "sce-current-other-movement", label: "Current year other movements / distributions", current: Math.round(currentOtherMovements), prior: null, type: "line" },
    { id: "sce-current-rounding-adjustment", label: "Rounding adjustment", current: Math.round(currentEquityRoundingAdjustment), prior: null, type: "line" },
    { id: "sce-retained-closing", label: "Closing retained income", current: Math.round(currentClosingRetainedIncome), prior: null, type: "subtotal" },
    { id: "sce-share-closing", label: "Closing share capital", current: Math.round(shareCapitalTotal.current || openingShareCapital), prior: null, type: "line" },
    { id: "sce-total-equity", label: "Total equity at end of year", current: Math.round(sceCurrentTotal), prior: null, type: "grand-total" },
  ];

  function roundedBucketTotal(items: StatementBucket[]) {
    return Math.round(sumBuckets(items).current);
  }

  function roundedBucketPrior(items: StatementBucket[]) {
    return Math.round(sumBuckets(items).prior);
  }

  const cashBuckets = currentAssets.filter(
    (item) => item.noteKey === "cashAndCashEquivalents"
  );

  /*
    Cash-flow reconciliation:
    qualifying bank overdrafts form part of cash and cash equivalents for
    cash-flow purposes, while remaining separately presented on the SFP.
  */
  const bankOverdraftBuckets = currentLiabilities.filter(
    (item) => item.noteKey === "bankOverdraft"
  );

  const inventoryBuckets = currentAssets.filter(
    (item) => item.noteKey === "inventories"
  );
  const tradeReceivableBuckets = currentAssets.filter(
    (item) => item.noteKey === "tradeReceivables"
  );
  const currentTaxReceivableBuckets = currentAssets.filter(
    (item) => item.noteKey === "currentTaxReceivable"
  );
  const ppeBuckets = nonCurrentAssets.filter(
    (item) => item.noteKey === "propertyPlantEquipment"
  );
  const goodwillBuckets = nonCurrentAssets.filter(
    (item) => item.noteKey === "goodwill"
  );
  const loansReceivableBuckets = nonCurrentAssets.filter(
    (item) => item.noteKey === "loansReceivable"
  );

  const shareCapitalBuckets = equity.filter(
    (item) => item.noteKey === "shareCapital"
  );
  const shareholdersLoanBuckets = nonCurrentLiabilities.filter(
    (item) => item.noteKey === "shareholdersLoans"
  );
  const otherFinancialLiabilityBuckets = nonCurrentLiabilities.filter(
    (item) => item.noteKey === "otherFinancialLiabilities"
  );
  const tradePayableBuckets = currentLiabilities.filter(
    (item) => item.noteKey === "tradePayables"
  );
  const currentTaxPayableBuckets = currentLiabilities.filter(
    (item) => item.noteKey === "currentTaxPayable"
  );

  const cashClosingFromSfp =
    roundedBucketTotal(cashBuckets) -
    roundedBucketTotal(bankOverdraftBuckets);

  const calculatedCashOpening =
    roundedBucketPrior(cashBuckets) -
    roundedBucketPrior(bankOverdraftBuckets);

  /*
    If mapped cash / overdraft balances exist, the SFP is the source of truth
    for opening cash and cash equivalents. This prevents stale saved overrides
    from excluding the overdraft.
  */
  const hasMappedCashOpening =
    cashBuckets.length > 0 || bankOverdraftBuckets.length > 0;

  const cashOpening = hasMappedCashOpening
    ? calculatedCashOpening
    : overrideAmount(
        overrides,
        "cashOpeningBalance",
        calculatedCashOpening,
      );

  const cashMovementFromSfp = cashClosingFromSfp - cashOpening;

  const priorCashOpening = overrideAmount(
    overrides,
    "cashPriorOpeningBalance",
    0,
  );

  const priorCashClosingFromSfp =
    roundedBucketPrior(cashBuckets) -
    roundedBucketPrior(bankOverdraftBuckets);

  const adjustmentsCurrent = overrideAmount(overrides, "cashAdjustmentsToProfitCurrent", 0);
  const adjustmentsPrior = overrideAmount(overrides, "cashAdjustmentsToProfitPrior", 0);

  const inventoryMovementCurrent =
    roundedBucketPrior(inventoryBuckets) - roundedBucketTotal(inventoryBuckets);
  const inventoryMovementPrior = 0 - roundedBucketPrior(inventoryBuckets);

  const tradeReceivableMovementCurrent =
    roundedBucketPrior(tradeReceivableBuckets) - roundedBucketTotal(tradeReceivableBuckets);
  const tradeReceivableMovementPrior = 0 - roundedBucketPrior(tradeReceivableBuckets);

  const tradePayableMovementCurrent =
    roundedBucketTotal(tradePayableBuckets) - roundedBucketPrior(tradePayableBuckets);
  const tradePayableMovementPrior = roundedBucketPrior(tradePayableBuckets);

  const workingCapitalCurrent = overrideAmount(
    overrides,
    "cashWorkingCapitalCurrent",
    inventoryMovementCurrent + tradeReceivableMovementCurrent + tradePayableMovementCurrent
  );
  const workingCapitalPrior = overrideAmount(
    overrides,
    "cashWorkingCapitalPrior",
    inventoryMovementPrior + tradeReceivableMovementPrior + tradePayableMovementPrior
  );

  const interestReceivedCurrent = overrideAmount(overrides, "cashInterestReceivedCurrent", 0);
  const interestReceivedPrior = overrideAmount(overrides, "cashInterestReceivedPrior", 0);
  const financeCostsPaidCurrent = overrideAmount(overrides, "cashFinanceCostsPaidCurrent", 0);
  const financeCostsPaidPrior = overrideAmount(overrides, "cashFinanceCostsPaidPrior", 0);
  const taxPaidCurrent = overrideAmount(overrides, "cashTaxPaidCurrent", 0);
  const taxPaidPrior = overrideAmount(overrides, "cashTaxPaidPrior", 0);
  const otherOperatingCurrent = overrideAmount(overrides, "cashOtherOperatingCurrent", 0);
  const otherOperatingPrior = overrideAmount(overrides, "cashOtherOperatingPrior", 0);
  const otherOperating2Current = overrideAmount(overrides, "cashOtherOperating2Current", 0);
  const otherOperating2Prior = overrideAmount(overrides, "cashOtherOperating2Prior", 0);
  const otherOperating3Current = overrideAmount(overrides, "cashOtherOperating3Current", 0);
  const otherOperating3Prior = overrideAmount(overrides, "cashOtherOperating3Prior", 0);
  const otherOperatingTotalCurrent = otherOperatingCurrent + otherOperating2Current + otherOperating3Current;
  const otherOperatingTotalPrior = otherOperatingPrior + otherOperating2Prior + otherOperating3Prior;

  /*
    Do not infer PPE cash purchases from the movement in the PPE carrying amount.
    A movement in PPE can include financed acquisitions, depreciation, disposals,
    revaluations and other non-cash movements.

    Cash purchases of PPE must therefore come from the cash-flow workbench /
    explicit overrides. Default to zero when no cash amount has been captured.
  */
  /*
    MIGRATION FOR LEGACY AUTO-GENERATED PPE CASH OVERRIDES

    Older builds saved the movement in PPE carrying amount as though it were
    "cash paid for PPE". If that exact legacy-derived amount is still sitting
    in statementOverrides, ignore it automatically.

    A genuinely user-entered workbench amount that differs from the old
    balance-movement calculation is still respected.
  */
  const legacyInferredPpeCurrent =
    roundedBucketPrior(ppeBuckets) - roundedBucketTotal(ppeBuckets);

  const rawPurchaseOfPpeCurrent = overrides.cashPurchaseOfPpeCurrent;

  const purchaseOfPpeCurrent =
    rawPurchaseOfPpeCurrent !== null &&
    rawPurchaseOfPpeCurrent !== undefined &&
    Number.isFinite(Number(rawPurchaseOfPpeCurrent)) &&
    Math.abs(Math.round(Number(rawPurchaseOfPpeCurrent))) !==
      Math.abs(Math.round(legacyInferredPpeCurrent))
      ? Number(rawPurchaseOfPpeCurrent)
      : 0;

  const purchaseOfPpePrior = overrideAmount(
    overrides,
    "cashPurchaseOfPpePrior",
    0,
  );
  const proceedsOnDisposalPpeCurrent = overrideAmount(overrides, "cashProceedsOnDisposalPpeCurrent", 0);
  const proceedsOnDisposalPpePrior = overrideAmount(overrides, "cashProceedsOnDisposalPpePrior", 0);
  const otherInvestingCurrent = overrideAmount(
    overrides,
    "cashOtherInvestingCurrent",
    roundedBucketPrior(goodwillBuckets) -
      roundedBucketTotal(goodwillBuckets) +
      roundedBucketPrior(loansReceivableBuckets) -
      roundedBucketTotal(loansReceivableBuckets)
  );
  const otherInvestingPrior = overrideAmount(overrides, "cashOtherInvestingPrior", 0);
  const otherInvesting2Current = overrideAmount(overrides, "cashOtherInvesting2Current", 0);
  const otherInvesting2Prior = overrideAmount(overrides, "cashOtherInvesting2Prior", 0);
  const otherInvesting3Current = overrideAmount(overrides, "cashOtherInvesting3Current", 0);
  const otherInvesting3Prior = overrideAmount(overrides, "cashOtherInvesting3Prior", 0);
  const otherInvestingTotalCurrent = otherInvestingCurrent + otherInvesting2Current + otherInvesting3Current;
  const otherInvestingTotalPrior = otherInvestingPrior + otherInvesting2Prior + otherInvesting3Prior;

  const shareCapitalMovementCurrent =
    roundedBucketTotal(shareCapitalBuckets) - roundedBucketPrior(shareCapitalBuckets);
  const shareCapitalMovementPrior = roundedBucketPrior(shareCapitalBuckets);

  const shareholdersLoanMovementCurrent =
    roundedBucketTotal(shareholdersLoanBuckets) - roundedBucketPrior(shareholdersLoanBuckets);
  const shareholdersLoanMovementPrior = roundedBucketPrior(shareholdersLoanBuckets);

  const otherFinancialLiabilityMovementCurrent =
    roundedBucketTotal(otherFinancialLiabilityBuckets) -
    roundedBucketPrior(otherFinancialLiabilityBuckets);
  const otherFinancialLiabilityMovementPrior = roundedBucketPrior(otherFinancialLiabilityBuckets);

  /*
    Do not infer cash proceeds/repayments from movements in shareholder loans.
    Balance movements can arise from journals, reclassifications, interest,
    subordinations or other non-cash transactions.

    Cash loan movements must be explicitly captured in the cash-flow workbench.
  */
  const loansRaisedCurrent = overrideAmount(
    overrides,
    "cashLoansRaisedCurrent",
    0,
  );
  const loansRaisedPrior = overrideAmount(
    overrides,
    "cashLoansRaisedPrior",
    0,
  );
  const loansRepaidCurrent = overrideAmount(overrides, "cashLoansRepaidCurrent", 0);
  const loansRepaidPrior = overrideAmount(overrides, "cashLoansRepaidPrior", 0);
  const dividendsPaidCurrent = overrideAmount(overrides, "cashDividendsPaidCurrent", 0);
  const dividendsPaidPrior = overrideAmount(overrides, "cashDividendsPaidPrior", 0);
  
  /*
    Do not infer other financing cash flows from movements in share capital
    or financial-liability balances. Those movements are not proof of cash.
  */
  const otherFinancingCurrent = 0;
  const otherFinancingPrior = 0;

  const otherFinancing2Current = overrideAmount(overrides, "cashOtherFinancing2Current", 0);
  const otherFinancing2Prior = overrideAmount(overrides, "cashOtherFinancing2Prior", 0);
  const otherFinancing3Current = overrideAmount(overrides, "cashOtherFinancing3Current", 0);
  const otherFinancing3Prior = overrideAmount(overrides, "cashOtherFinancing3Prior", 0);
  const otherFinancingTotalCurrent = otherFinancingCurrent + otherFinancing2Current + otherFinancing3Current;
  const otherFinancingTotalPrior = otherFinancingPrior + otherFinancing2Prior + otherFinancing3Prior;

  const cashGeneratedFromOperationsCurrent =
    beforeTax.current + adjustmentsCurrent + workingCapitalCurrent;
  const cashGeneratedFromOperationsPrior =
    beforeTax.prior + adjustmentsPrior + workingCapitalPrior;

  const netOperatingCashCurrent =
    cashGeneratedFromOperationsCurrent +
    interestReceivedCurrent +
    financeCostsPaidCurrent +
    taxPaidCurrent +
    otherOperatingTotalCurrent;
  const netOperatingCashPrior =
    cashGeneratedFromOperationsPrior +
    interestReceivedPrior +
    financeCostsPaidPrior +
    taxPaidPrior +
    otherOperatingTotalPrior;

  const netInvestingCashCurrent =
    purchaseOfPpeCurrent + proceedsOnDisposalPpeCurrent + otherInvestingTotalCurrent;
  const netInvestingCashPrior =
    purchaseOfPpePrior + proceedsOnDisposalPpePrior + otherInvestingTotalPrior;

  const netFinancingCashCurrent =
    loansRaisedCurrent + loansRepaidCurrent + dividendsPaidCurrent + otherFinancingTotalCurrent;
  const netFinancingCashPrior =
    loansRaisedPrior + loansRepaidPrior + dividendsPaidPrior + otherFinancingTotalPrior;

  const cashMovementFromCashFlow =
    netOperatingCashCurrent + netInvestingCashCurrent + netFinancingCashCurrent;
  const cashMovementPriorFromCashFlow =
    overrides.cashPriorMovement !== null && overrides.cashPriorMovement !== undefined
      ? Number(overrides.cashPriorMovement)
      : netOperatingCashPrior + netInvestingCashPrior + netFinancingCashPrior;

  const cashClosingFromCashFlow = cashOpening + cashMovementFromCashFlow;
  const cashClosingPriorFromCashFlow = priorCashOpening + cashMovementPriorFromCashFlow;

  const cashFlowMovementDifference = cashMovementFromCashFlow - cashMovementFromSfp;
  const cashFlowClosingDifference = cashClosingFromCashFlow - cashClosingFromSfp;
  const cashFlowPriorClosingDifference = cashClosingPriorFromCashFlow - priorCashClosingFromSfp;

  const cashFlowRows: AfsStatementRow[] = [
    { id: "cfs-operating", label: "Cash flows from operating activities", type: "section" },
    {
      id: "cfs-profit-before-tax",
      label: "Profit / (loss) before taxation",
      current: Math.round(beforeTax.current),
      prior: Math.round(beforeTax.prior),
      type: "line",
    },
    {
      id: "cfs-adjustments",
      label: "Adjustments for non-cash and other items",
      current: Math.round(adjustmentsCurrent),
      prior: Math.round(adjustmentsPrior),
      type: "line",
    },
    {
      id: "cfs-inventories",
      label: "Decrease / (increase) in inventories",
      current: Math.round(inventoryMovementCurrent),
      prior: Math.round(inventoryMovementPrior),
      type: "line",
    },
    {
      id: "cfs-trade-receivables",
      label: "Decrease / (increase) in trade and other receivables",
      current: Math.round(tradeReceivableMovementCurrent),
      prior: Math.round(tradeReceivableMovementPrior),
      type: "line",
    },
    {
      id: "cfs-trade-payables",
      label: "Increase / (decrease) in trade and other payables",
      current: Math.round(tradePayableMovementCurrent),
      prior: Math.round(tradePayableMovementPrior),
      type: "line",
    },
    {
      id: "cfs-cash-generated-operations",
      label: "Cash generated from / (used in) operations",
      current: Math.round(cashGeneratedFromOperationsCurrent),
      prior: Math.round(cashGeneratedFromOperationsPrior),
      type: "subtotal",
    },
    {
      id: "cfs-interest-received",
      label: "Interest received",
      current: Math.round(interestReceivedCurrent),
      prior: Math.round(interestReceivedPrior),
      type: "line",
    },
    {
      id: "cfs-finance-costs-paid",
      label: "Finance costs paid",
      current: Math.round(financeCostsPaidCurrent),
      prior: Math.round(financeCostsPaidPrior),
      type: "line",
    },
    {
      id: "cfs-tax-paid",
      label: "Taxation paid",
      current: Math.round(taxPaidCurrent),
      prior: Math.round(taxPaidPrior),
      type: "line",
    },
    {
      id: "cfs-other-operating",
      label: "Other operating cash flows",
      current: Math.round(otherOperatingTotalCurrent),
      prior: Math.round(otherOperatingTotalPrior),
      type: "line",
    },
    {
      id: "cfs-net-operating",
      label: "Net cash from / (used in) operating activities",
      current: Math.round(netOperatingCashCurrent),
      prior: Math.round(netOperatingCashPrior),
      type: "subtotal",
    },
    { id: "cfs-investing", label: "Cash flows from investing activities", type: "section" },
    {
      id: "cfs-purchase-ppe",
      label: "Purchase of property, plant and equipment",
      current: Math.round(purchaseOfPpeCurrent),
      prior: Math.round(purchaseOfPpePrior),
      type: "line",
    },
    {
      id: "cfs-proceeds-ppe",
      label: "Proceeds on disposal of property, plant and equipment",
      current: Math.round(proceedsOnDisposalPpeCurrent),
      prior: Math.round(proceedsOnDisposalPpePrior),
      type: "line",
    },
    {
      id: "cfs-other-investing",
      label: "Other investing cash flows",
      current: Math.round(otherInvestingTotalCurrent),
      prior: Math.round(otherInvestingTotalPrior),
      type: "line",
    },
    {
      id: "cfs-net-investing",
      label: "Net cash from / (used in) investing activities",
      current: Math.round(netInvestingCashCurrent),
      prior: Math.round(netInvestingCashPrior),
      type: "subtotal",
    },
    { id: "cfs-financing", label: "Cash flows from financing activities", type: "section" },
    {
      id: "cfs-loans-raised",
      label: "Shareholder loans raised / (repaid)",
      current: Math.round(loansRaisedCurrent + loansRepaidCurrent),
      prior: Math.round(loansRaisedPrior + loansRepaidPrior),
      type: "line",
    },
    {
      id: "cfs-dividends-paid",
      label: "Dividends paid",
      current: Math.round(dividendsPaidCurrent),
      prior: Math.round(dividendsPaidPrior),
      type: "line",
    },
    {
      id: "cfs-other-financing",
      label: "Other financing cash flows",
      current: Math.round(otherFinancingTotalCurrent),
      prior: Math.round(otherFinancingTotalPrior),
      type: "line",
    },
    {
      id: "cfs-net-financing",
      label: "Net cash from / (used in) financing activities",
      current: Math.round(netFinancingCashCurrent),
      prior: Math.round(netFinancingCashPrior),
      type: "subtotal",
    },
    { id: "cfs-space-1", type: "spacer" },
    {
      id: "cfs-cash-movement",
      label: "Net increase / (decrease) in cash and cash equivalents",
      current: Math.round(cashMovementFromCashFlow),
      prior: Math.round(cashMovementPriorFromCashFlow),
      type: "subtotal",
    },
    {
      id: "cfs-cash-beginning",
      label: "Cash and cash equivalents at beginning of year",
      current: Math.round(cashOpening),
      prior: Math.round(priorCashOpening),
      type: "line",
    },
    {
      id: "cfs-cash-end",
      label: "Cash and cash equivalents at end of year",
      current: Math.round(cashClosingFromCashFlow),
      prior: Math.round(cashClosingPriorFromCashFlow),
      type: "grand-total",
    },
  ];

  const noteData = emptyNoteData();

  function addNoteLine(noteKey: AfsNoteKey | undefined, source: StatementBucket) {
    if (!noteKey || !noteData[noteKey]) return;

    noteData[noteKey].push({
      id: source.key,
      label: source.label,
      current: Math.round(source.current),
      prior: Math.round(source.prior),
    });
  }

  const allBalanceSheetBuckets: StatementBucket[] = [
    ...nonCurrentAssets,
    ...currentAssets,
    ...equity,
    ...nonCurrentLiabilities,
    ...currentLiabilities,
  ];

  allBalanceSheetBuckets.forEach((item) => {
    addNoteLine(item.noteKey, item);
  });

  /*
    ONE deferred-tax note:
    395 remains an asset on the SFP and 595 remains a liability on the SFP,
    but both feed the same disclosure note.
  */
  noteData.deferredTax = [
    ...noteData.deferredTaxAsset,
    ...noteData.deferredTaxLiability,
  ];

  /*
    ONE cash and cash equivalents note:
    Bank overdrafts remain current liabilities on the SFP, but are disclosed
    in the same cash note as negative amounts.
  */
  noteData.cashAndCashEquivalents = [
    ...noteData.cashAndCashEquivalents,
    ...noteData.bankOverdraft.map((row) => ({
      ...row,
      current: -Math.abs(Number(row.current || 0)),
      prior: -Math.abs(Number(row.prior || 0)),
    })),
  ];

  revenue.forEach((item) => addNoteLine("revenue", item));
  costOfSales.forEach((item) => addNoteLine("costOfSales", item));
  otherOperatingIncome.forEach((item) => addNoteLine("otherOperatingIncome", item));
  investmentIncome.forEach((item) => addNoteLine("investmentIncome", item));
  operatingExpenses.forEach((item) => addNoteLine("operatingExpenses", item));
  financeCosts.forEach((item) => addNoteLine("financeCosts", item));
  otherGainsLosses.forEach((item) => addNoteLine("otherGainsLosses", item));
  taxation.forEach((item) => addNoteLine("taxation", item));
  discontinuedOperations.forEach((item) => addNoteLine("discontinuedOperations", item));
  otherComprehensiveIncome.forEach((item) => addNoteLine("otherComprehensiveIncome", item));

  /*
    LEGACY COMPATIBILITY:
    Print Studio still references noteData.otherIncome until page.tsx is migrated
    to the new separate note families. Keep this aggregate temporarily so the
    live app compiles while preserving the new canonical classification.
  */
  noteData.otherIncome = [
    ...noteData.otherOperatingIncome,
    ...noteData.investmentIncome,
    ...noteData.otherGainsLosses,
  ];

  noteData.cashUsedInOperations = [
    {
      id: "profit-before-tax",
      label: "Profit / (loss) before taxation",
      current: Math.round(beforeTax.current),
      prior: Math.round(beforeTax.prior),
    },
    {
      id: "adjustments",
      label: "Adjustments for non-cash and other items",
      current: Math.round(adjustmentsCurrent),
      prior: Math.round(adjustmentsPrior),
    },
    {
      id: "inventories",
      label: "Decrease / (increase) in inventories",
      current: Math.round(inventoryMovementCurrent),
      prior: Math.round(inventoryMovementPrior),
    },
    {
      id: "trade-receivables",
      label: "Decrease / (increase) in trade and other receivables",
      current: Math.round(tradeReceivableMovementCurrent),
      prior: Math.round(tradeReceivableMovementPrior),
    },
    {
      id: "trade-payables",
      label: "Increase / (decrease) in trade and other payables",
      current: Math.round(tradePayableMovementCurrent),
      prior: Math.round(tradePayableMovementPrior),
    },
    {
      id: "cash-generated-operations",
      label: "Cash generated from / (used in) operations",
      current: Math.round(cashGeneratedFromOperationsCurrent),
      prior: Math.round(cashGeneratedFromOperationsPrior),
    },
  ];

  const checks: AfsEngineChecks = {
    sfpAssetsTotal: Math.round(rowAmount(sfpRows, "assets-total", "current")),
    sfpEquityAndLiabilitiesTotal: Math.round(rowAmount(sfpRows, "eql-total", "current")),
    sfpDifference: checkDifference(
      rowAmount(sfpRows, "assets-total", "current") -
        rowAmount(sfpRows, "eql-total", "current"),
      roundingTolerance,
    ),
    profitForYear: Math.round(profitForYear.current),
    profitBeforeTax: Math.round(beforeTax.current),
    sfpEquityTotal: Math.round(equityTotal.current),
    sceTotalEquity: Math.round(sceCurrentTotal),
    sceEquityDifferenceToSfp: checkDifference(
      sceCurrentTotal - equityTotal.current,
      roundingTolerance,
    ),
    cashClosingFromSfp: Math.round(cashClosingFromSfp),
    cashOpeningFromSfp: Math.round(cashOpening),
    cashMovementFromSfp: Math.round(cashMovementFromSfp),
    cashMovementFromCashFlow: Math.round(cashMovementFromCashFlow),
    cashClosingFromCashFlow: Math.round(cashClosingFromCashFlow),
    cashFlowMovementDifference: checkDifference(
      cashFlowMovementDifference,
      roundingTolerance,
    ),
    cashFlowClosingDifference: checkDifference(
      cashFlowClosingDifference,
      roundingTolerance,
    ),
    cashOpeningPrior: Math.round(priorCashOpening),
    cashMovementPriorFromCashFlow: Math.round(cashMovementPriorFromCashFlow),
    cashClosingPriorFromCashFlow: Math.round(cashClosingPriorFromCashFlow),
    cashClosingPriorFromSfp: Math.round(priorCashClosingFromSfp),
    cashFlowPriorClosingDifference: checkDifference(
      cashFlowPriorClosingDifference,
      roundingTolerance,
    ),
  };

  return {
    sfpRows,
    sociRows,
    sceRows,
    cashFlowRows,
    detailedIncomeRows: detailedRowsFromLines(
      lines,
      overrides,
      automaticProfitRoundingAdjustment,
    ),
    noteData,
    checks,
  };
}
