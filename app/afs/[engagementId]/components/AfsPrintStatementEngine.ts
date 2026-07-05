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
  | "goodwill"
  | "investmentProperty"
  | "intangibleAssets"
  | "biologicalAssets"
  | "otherNonCurrentAssets"
  | "loansReceivable"
  | "inventories"
  | "tradeReceivables"
  | "currentTaxReceivable"
  | "cashAndCashEquivalents"
  | "shareCapital"
  | "retainedIncome"
  | "shareholdersLoans"
  | "otherFinancialLiabilities"
  | "tradePayables"
  | "currentTaxPayable"
  | "revenue"
  | "otherIncome"
  | "operatingExpenses"
  | "financeCosts"
  | "taxation"
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
    | "unmapped";
  noteKey?: AfsNoteKey;
  plGroup?:
    | "revenue"
    | "costOfSales"
    | "otherIncome"
    | "operatingExpenses"
    | "financeCosts"
    | "taxation";
};

type StatementBucket = {
  key: string;
  label: string;
  note?: string | number | null;
  current: number;
  prior: number;
};

const NOTE_LABELS: Record<AfsNoteKey, string> = {
  propertyPlantEquipment: "Property, plant and equipment",
  goodwill: "Goodwill",
  investmentProperty: "Investment property",
  intangibleAssets: "Intangible assets",
  biologicalAssets: "Biological assets",
  otherNonCurrentAssets: "Other non-current assets",
  loansReceivable: "Loans receivable",
  inventories: "Inventories",
  tradeReceivables: "Trade and other receivables",
  currentTaxReceivable: "Current tax receivable",
  cashAndCashEquivalents: "Cash and cash equivalents",
  shareCapital: "Share capital",
  retainedIncome: "Retained income / accumulated loss",
  shareholdersLoans: "Shareholders' loans",
  otherFinancialLiabilities: "Other financial liabilities",
  tradePayables: "Trade and other payables",
  currentTaxPayable: "Current tax payable",
  revenue: "Revenue",
  otherIncome: "Other income",
  operatingExpenses: "Operating expenses",
  financeCosts: "Finance costs",
  taxation: "Taxation",
  cashUsedInOperations: "Cash used in operations",
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
 * Statement classification is mapping-only.
 * It must never read account_code or account_name to decide where a line belongs.
 */
function mappingText(line: AfsEngineTrialBalanceLine) {
  return [
    line.mapping_statement,
    line.mapping_section,
    line.mapping_path,
    line.mapping_category,
    line.mapping_label,
    line.mapping_code,
    line.lead_schedule_number,
    line.lead_schedule_key,
    line.mapping_leaf_id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

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
  return (
    line.lead_schedule_key ||
    line.mapping_leaf_id ||
    line.mapping_code ||
    line.mapping_label ||
    line.mapping_category ||
    canonical.noteKey ||
    "mapped-uncategorised"
  );
}

function bucketLabel(line: AfsEngineTrialBalanceLine, canonical: CanonicalBucket) {
  if (canonical.noteKey) return NOTE_LABELS[canonical.noteKey];

  return cleanLabel(
    line.mapping_label ||
      line.mapping_category ||
      line.lead_schedule_key ||
      line.mapping_code ||
      "Mapped item"
  );
}

function detailedLabel(line: AfsEngineTrialBalanceLine) {
  const name = String(line.account_name || "").trim();
  return name || bucketLabel(line, canonicalFromMapping(line));
}

function canonicalFromMapping(line: AfsEngineTrialBalanceLine): CanonicalBucket {
  const text = mappingText(line);

  if (!text.trim()) return { statement: "unmapped" };

  if (includesAny(text, ["revenue", "sales", "turnover"])) {
    return { statement: "profitLoss", noteKey: "revenue", plGroup: "revenue" };
  }

  if (includesAny(text, ["cost of sales", "cost-of-sales", "costofsales"])) {
    return { statement: "profitLoss", plGroup: "costOfSales" };
  }

  if (includesAny(text, ["other income", "investment income", "finance income"])) {
    return { statement: "profitLoss", noteKey: "otherIncome", plGroup: "otherIncome" };
  }

  if (includesAny(text, ["finance cost", "finance-cost", "interest expense", "interest paid"])) {
    return { statement: "profitLoss", noteKey: "financeCosts", plGroup: "financeCosts" };
  }

  if (includesAny(text, ["current tax receivable", "income tax receivable", "tax receivable", "deferred tax asset"])) {
    return { statement: "currentAsset", noteKey: "currentTaxReceivable" };
  }

  if (includesAny(text, ["current tax payable", "income tax payable", "tax payable", "deferred tax liability"])) {
    return { statement: "currentLiability", noteKey: "currentTaxPayable" };
  }

  if (includesAny(text, ["tax expense", "income tax expense", "taxation", "normal tax"])) {
    return { statement: "profitLoss", noteKey: "taxation", plGroup: "taxation" };
  }

  if (
    includesAny(text, [
      "operating expenses",
      "operating expense",
      "administration expenses",
      "administrative expenses",
      "expenses",
    ])
  ) {
    return { statement: "profitLoss", noteKey: "operatingExpenses", plGroup: "operatingExpenses" };
  }

  if (includesAny(text, ["property plant", "property, plant", "plant and equipment", "ppe"])) {
    return { statement: "nonCurrentAsset", noteKey: "propertyPlantEquipment" };
  }

  if (includesAny(text, ["goodwill"])) {
    return { statement: "nonCurrentAsset", noteKey: "goodwill" };
  }

  if (includesAny(text, ["investment property"])) {
    return { statement: "nonCurrentAsset", noteKey: "investmentProperty" };
  }

  if (includesAny(text, ["intangible"])) {
    return { statement: "nonCurrentAsset", noteKey: "intangibleAssets" };
  }

  if (includesAny(text, ["biological asset"])) {
    return { statement: "nonCurrentAsset", noteKey: "biologicalAssets" };
  }

  if (includesAny(text, ["loans receivable", "loan receivable"])) {
    return { statement: "nonCurrentAsset", noteKey: "loansReceivable" };
  }

  if (includesAny(text, ["other non-current asset", "other non current asset", "non-current asset", "non current asset"])) {
    return { statement: "nonCurrentAsset", noteKey: "otherNonCurrentAssets" };
  }

  if (includesAny(text, ["inventory", "inventories", "stock"])) {
    return { statement: "currentAsset", noteKey: "inventories" };
  }

  if (includesAny(text, ["trade receivable", "trade and other receivable", "accounts receivable", "debtors"])) {
    return { statement: "currentAsset", noteKey: "tradeReceivables" };
  }

  if (includesAny(text, ["current tax receivable", "income tax receivable"])) {
    return { statement: "currentAsset", noteKey: "currentTaxReceivable" };
  }

  if (includesAny(text, ["cash and cash equivalents", "cash equivalents", "bank", "cash"])) {
    return { statement: "currentAsset", noteKey: "cashAndCashEquivalents" };
  }

  if (includesAny(text, ["current asset", "asset"])) {
    return { statement: "currentAsset", noteKey: "otherNonCurrentAssets" };
  }

  if (includesAny(text, ["share capital", "issued capital", "members contribution", "member contribution"])) {
    return { statement: "equity", noteKey: "shareCapital" };
  }

  if (includesAny(text, ["retained", "accumulated profit", "accumulated loss"])) {
    return { statement: "equity", noteKey: "retainedIncome" };
  }

  if (includesAny(text, ["reserve", "equity"])) {
    return { statement: "equity" };
  }

  if (
    includesAny(text, [
      "shareholder",
      "director loan",
      "member loan",
      "members loan",
      "loan from shareholder",
      "loans from shareholders",
      "related party loan",
    ])
  ) {
    return { statement: "nonCurrentLiability", noteKey: "shareholdersLoans" };
  }

  if (
    includesAny(text, [
      "other financial liability",
      "borrowings",
      "long-term loan",
      "long term loan",
      "lease liability",
      "instalment sale",
    ])
  ) {
    return { statement: "nonCurrentLiability", noteKey: "otherFinancialLiabilities" };
  }

  if (includesAny(text, ["trade payable", "trade and other payable", "accounts payable", "creditors", "accrual"])) {
    return { statement: "currentLiability", noteKey: "tradePayables" };
  }

  if (includesAny(text, ["current tax payable", "income tax payable"])) {
    return { statement: "currentLiability", noteKey: "currentTaxPayable" };
  }

  if (includesAny(text, ["current liability", "current liabilities"])) {
    return { statement: "currentLiability" };
  }

  if (includesAny(text, ["non-current liability", "non current liability", "liability", "liabilities"])) {
    return { statement: "nonCurrentLiability" };
  }

  return { statement: "unmapped" };
}

function normaliseAmount(line: AfsEngineTrialBalanceLine, amount: number, canonical: CanonicalBucket) {
  if (
    canonical.statement === "equity" ||
    canonical.statement === "nonCurrentLiability" ||
    canonical.statement === "currentLiability" ||
    canonical.plGroup === "revenue" ||
    canonical.plGroup === "otherIncome"
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
      current: 0,
      prior: 0,
    });
  }

  const bucket = buckets.get(key);
  if (!bucket) return;

  bucket.current += normaliseAmount(line, rawCurrent(line), canonical);
  bucket.prior += normaliseAmount(line, rawPrior(line), canonical);
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
    goodwill: [],
    investmentProperty: [],
    intangibleAssets: [],
    biologicalAssets: [],
    otherNonCurrentAssets: [],
    loansReceivable: [],
    inventories: [],
    tradeReceivables: [],
    currentTaxReceivable: [],
    cashAndCashEquivalents: [],
    shareCapital: [],
    retainedIncome: [],
    shareholdersLoans: [],
    otherFinancialLiabilities: [],
    tradePayables: [],
    currentTaxPayable: [],
    revenue: [],
    otherIncome: [],
    operatingExpenses: [],
    financeCosts: [],
    taxation: [],
    cashUsedInOperations: [],
  };
}

function detailedRowsFromLines(lines: AfsEngineTrialBalanceLine[]) {
  const rows: AfsStatementRow[] = [];

  const buckets: Record<string, AfsStatementRow[]> = {
    revenue: [],
    costOfSales: [],
    otherIncome: [],
    operatingExpenses: [],
    financeCosts: [],
    taxation: [],
  };

  lines.forEach((line) => {
    const canonical = canonicalFromMapping(line);
    if (canonical.statement !== "profitLoss") return;

    const group = canonical.plGroup || "operatingExpenses";

    buckets[group].push({
      id:
        line.id ||
        line.account_code ||
        line.account_name ||
        `${group}-${buckets[group].length}`,
      label: detailedLabel(line),
      current: Math.round(normaliseAmount(line, rawCurrent(line), canonical)),
      prior: Math.round(normaliseAmount(line, rawPrior(line), canonical)),
      type: "line",
    });
  });

  function sum(groupRows: AfsStatementRow[]) {
    return groupRows.reduce(
      (total, row) => ({
        current: total.current + Number(row.current || 0),
        prior: total.prior + Number(row.prior || 0),
      }),
      { current: 0, prior: 0 }
    );
  }

  function pushGroup(
    id: string,
    label: string,
    groupRows: AfsStatementRow[],
    options: { showEvenIfZero?: boolean; subtotalLabel?: string } = {}
  ) {
    if (!options.showEvenIfZero && groupRows.length === 0) return;

    rows.push({ id: `${id}-section`, label, type: "section" });

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

  pushGroup("revenue", "Revenue", buckets.revenue, {
    showEvenIfZero: true,
    subtotalLabel: "Total revenue",
  });
  pushGroup("cost-of-sales", "Cost of sales", buckets.costOfSales, {
    showEvenIfZero: true,
    subtotalLabel: "Total cost of sales",
  });

  const revenueTotal = sum(buckets.revenue);
  const costOfSalesTotal = sum(buckets.costOfSales);
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

  pushGroup("other-income", "Other income", buckets.otherIncome, {
    subtotalLabel: "Total other income",
  });
  pushGroup("operating-expenses", "Operating expenses", buckets.operatingExpenses, {
    showEvenIfZero: true,
    subtotalLabel: "Total operating expenses",
  });
  pushGroup("finance-costs", "Finance costs", buckets.financeCosts, {
    subtotalLabel: "Total finance costs",
  });

  const otherIncomeTotal = sum(buckets.otherIncome);
  const operatingExpensesTotal = sum(buckets.operatingExpenses);
  const financeCostsTotal = sum(buckets.financeCosts);
  const beforeTax = {
    current:
      gross.current +
      otherIncomeTotal.current +
      operatingExpensesTotal.current +
      financeCostsTotal.current,
    prior:
      gross.prior +
      otherIncomeTotal.prior +
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

  pushGroup("taxation", "Taxation", buckets.taxation, {
    subtotalLabel: "Total taxation",
  });

  const taxationTotal = sum(buckets.taxation);

  rows.push({
    id: "detailed-total",
    label: "Profit / (loss) for the year",
    current: Math.round(beforeTax.current + taxationTotal.current),
    prior: Math.round(beforeTax.prior + taxationTotal.prior),
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
    otherIncome: new Map<string, StatementBucket>(),
    operatingExpenses: new Map<string, StatementBucket>(),
    financeCosts: new Map<string, StatementBucket>(),
    taxation: new Map<string, StatementBucket>(),
  };

  lines.forEach((line) => {
    const canonical = canonicalFromMapping(line);

    if (canonical.statement === "unmapped") return;

    if (canonical.statement === "nonCurrentAsset") {
      addToBucket(buckets.nonCurrentAssets, line, canonical, noteNumbers);
      return;
    }

    if (canonical.statement === "currentAsset") {
      addToBucket(buckets.currentAssets, line, canonical, noteNumbers);
      return;
    }

    if (canonical.statement === "equity") {
      addToBucket(buckets.equity, line, canonical, noteNumbers);
      return;
    }

    if (canonical.statement === "nonCurrentLiability") {
      addToBucket(buckets.nonCurrentLiabilities, line, canonical, noteNumbers);
      return;
    }

    if (canonical.statement === "currentLiability") {
      addToBucket(buckets.currentLiabilities, line, canonical, noteNumbers);
      return;
    }

    if (canonical.statement === "profitLoss" && canonical.plGroup) {
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
  const otherIncome = visibleBuckets(buckets.otherIncome);
  const operatingExpenses = visibleBuckets(buckets.operatingExpenses);
  const financeCosts = visibleBuckets(buckets.financeCosts);
  const taxation = visibleBuckets(buckets.taxation);

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

  const shareCapitalRaw = equityRaw.filter((item) =>
    item.note === noteNumbers.shareCapital ||
    item.label.toLowerCase().includes("share capital")
  );
  const retainedIncomeRaw = equityRaw.filter((item) =>
    item.note === noteNumbers.retainedIncome ||
    item.label.toLowerCase().includes("retained") ||
    item.label.toLowerCase().includes("accumulated")
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

  const rawOpeningRetainedInput =
    overrides.sceOpeningRetainedIncome !== null &&
    overrides.sceOpeningRetainedIncome !== undefined
      ? Number(overrides.sceOpeningRetainedIncome)
      : retainedIncomeTotal.prior;

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

  const currentOtherMovements =
    overrides.sceCurrentOtherMovements !== null &&
    overrides.sceCurrentOtherMovements !== undefined
      ? Number(overrides.sceCurrentOtherMovements)
      : overrides.sceOtherMovements !== null &&
        overrides.sceOtherMovements !== undefined
      ? Number(overrides.sceOtherMovements)
      : 0;

  const currentClosingRetainedIncome =
    priorClosingRetainedIncome + profitForYear.current + currentOtherMovements;

  const shareCapital = [
    {
      key: "share-capital-adjusted",
      label: "Share Capital",
      note: noteNumbers.shareCapital || null,
      current: shareCapitalTotal.current || openingShareCapital,
      prior: shareCapitalTotal.prior || openingShareCapital,
    },
  ].filter((item) => Math.round(item.current) !== 0 || Math.round(item.prior) !== 0);

  const retainedIncome = [
    {
      key: "retained-income-adjusted",
      label: "Retained Income / Accumulated Loss",
      note: noteNumbers.retainedIncome || null,
      current: currentClosingRetainedIncome,
      prior: priorClosingRetainedIncome,
    },
  ].filter((item) => Math.round(item.current) !== 0 || Math.round(item.prior) !== 0);

  const equity = [...shareCapital, ...retainedIncome, ...otherEquity];

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

  const sfpRoundingCurrent = Math.round(
    assetsTotal.current - equityLiabilitiesTotal.current
  );
  const sfpRoundingPrior = Math.round(
    assetsTotal.prior - equityLiabilitiesTotal.prior
  );

  if (sfpRoundingCurrent !== 0 || sfpRoundingPrior !== 0) {
    equity.push({
      key: "sfp-rounding",
      label: "Rounding",
      note: null,
      current: sfpRoundingCurrent,
      prior: sfpRoundingPrior,
    });

    equityTotal.current += sfpRoundingCurrent;
    equityTotal.prior += sfpRoundingPrior;
    equityLiabilitiesTotal.current += sfpRoundingCurrent;
    equityLiabilitiesTotal.prior += sfpRoundingPrior;
  }

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
    ...toRows(otherIncome),
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
    {
      id: "profit-year",
      label: "Profit / (loss) for the year",
      current: Math.round(profitForYear.current),
      prior: Math.round(profitForYear.prior),
      type: "grand-total",
    },
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
    (item) => item.note === noteNumbers.cashAndCashEquivalents
  );
  const inventoryBuckets = currentAssets.filter(
    (item) => item.note === noteNumbers.inventories
  );
  const tradeReceivableBuckets = currentAssets.filter(
    (item) => item.note === noteNumbers.tradeReceivables
  );
  const currentTaxReceivableBuckets = currentAssets.filter(
    (item) => item.note === noteNumbers.currentTaxReceivable
  );
  const ppeBuckets = nonCurrentAssets.filter(
    (item) => item.note === noteNumbers.propertyPlantEquipment
  );
  const goodwillBuckets = nonCurrentAssets.filter(
    (item) => item.note === noteNumbers.goodwill
  );
  const loansReceivableBuckets = nonCurrentAssets.filter(
    (item) => item.note === noteNumbers.loansReceivable
  );

  const shareCapitalBuckets = equity.filter(
    (item) => item.note === noteNumbers.shareCapital
  );
  const shareholdersLoanBuckets = nonCurrentLiabilities.filter(
    (item) => item.note === noteNumbers.shareholdersLoans
  );
  const otherFinancialLiabilityBuckets = nonCurrentLiabilities.filter(
    (item) => item.note === noteNumbers.otherFinancialLiabilities
  );
  const tradePayableBuckets = currentLiabilities.filter(
    (item) => item.note === noteNumbers.tradePayables
  );
  const currentTaxPayableBuckets = currentLiabilities.filter(
    (item) => item.note === noteNumbers.currentTaxPayable
  );

  const cashClosingFromSfp = roundedBucketTotal(cashBuckets);
  const calculatedCashOpening = roundedBucketPrior(cashBuckets);
  const cashOpening = overrideAmount(
    overrides,
    "cashOpeningBalance",
    calculatedCashOpening
  );
  const cashMovementFromSfp = cashClosingFromSfp - cashOpening;

  const priorCashOpening = overrideAmount(overrides, "cashPriorOpeningBalance", 0);
  const priorCashClosingFromSfp = roundedBucketPrior(cashBuckets);

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

  const purchaseOfPpeCurrent = overrideAmount(
    overrides,
    "cashPurchaseOfPpeCurrent",
    roundedBucketPrior(ppeBuckets) - roundedBucketTotal(ppeBuckets)
  );
  const purchaseOfPpePrior = overrideAmount(overrides, "cashPurchaseOfPpePrior", 0);
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

  const loansRaisedCurrent = overrideAmount(
    overrides,
    "cashLoansRaisedCurrent",
    shareholdersLoanMovementCurrent
  );
  const loansRaisedPrior = overrideAmount(
    overrides,
    "cashLoansRaisedPrior",
    shareholdersLoanMovementPrior
  );
  const loansRepaidCurrent = overrideAmount(overrides, "cashLoansRepaidCurrent", 0);
  const loansRepaidPrior = overrideAmount(overrides, "cashLoansRepaidPrior", 0);
  const dividendsPaidCurrent = overrideAmount(overrides, "cashDividendsPaidCurrent", 0);
  const dividendsPaidPrior = overrideAmount(overrides, "cashDividendsPaidPrior", 0);
  const otherFinancingCurrent = overrideAmount(
    overrides,
    "cashOtherFinancingCurrent",
    shareCapitalMovementCurrent + otherFinancialLiabilityMovementCurrent
  );
  const otherFinancingPrior = overrideAmount(
    overrides,
    "cashOtherFinancingPrior",
    shareCapitalMovementPrior + otherFinancialLiabilityMovementPrior
  );
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

  [...nonCurrentAssets, ...currentAssets, ...equity, ...nonCurrentLiabilities, ...currentLiabilities].forEach((item) => {
    const noteKey = Object.entries(noteNumbers).find(([, number]) => number === item.note)?.[0] as AfsNoteKey | undefined;
    addNoteLine(noteKey, item);
  });

  revenue.forEach((item) => addNoteLine("revenue", item));
  otherIncome.forEach((item) => addNoteLine("otherIncome", item));
  operatingExpenses.forEach((item) => addNoteLine("operatingExpenses", item));
  financeCosts.forEach((item) => addNoteLine("financeCosts", item));
  taxation.forEach((item) => addNoteLine("taxation", item));

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
    sfpDifference: Math.round(
      rowAmount(sfpRows, "assets-total", "current") -
        rowAmount(sfpRows, "eql-total", "current")
    ),
    profitForYear: Math.round(profitForYear.current),
    profitBeforeTax: Math.round(beforeTax.current),
    sfpEquityTotal: Math.round(equityTotal.current),
    sceTotalEquity: Math.round(sceCurrentTotal),
    sceEquityDifferenceToSfp: Math.round(sceCurrentTotal - equityTotal.current),
    cashClosingFromSfp: Math.round(cashClosingFromSfp),
    cashOpeningFromSfp: Math.round(cashOpening),
    cashMovementFromSfp: Math.round(cashMovementFromSfp),
    cashMovementFromCashFlow: Math.round(cashMovementFromCashFlow),
    cashClosingFromCashFlow: Math.round(cashClosingFromCashFlow),
    cashFlowMovementDifference: Math.round(cashFlowMovementDifference),
    cashFlowClosingDifference: Math.round(cashFlowClosingDifference),
    cashOpeningPrior: Math.round(priorCashOpening),
    cashMovementPriorFromCashFlow: Math.round(cashMovementPriorFromCashFlow),
    cashClosingPriorFromCashFlow: Math.round(cashClosingPriorFromCashFlow),
    cashClosingPriorFromSfp: Math.round(priorCashClosingFromSfp),
    cashFlowPriorClosingDifference: Math.round(cashFlowPriorClosingDifference),
  };

  return {
    sfpRows,
    sociRows,
    sceRows,
    cashFlowRows,
    detailedIncomeRows: detailedRowsFromLines(lines),
    noteData,
    checks,
  };
}
