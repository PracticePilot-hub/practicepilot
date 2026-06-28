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

export type AfsNoteLine = {
  id: string;
  label: string;
  note?: string | number | null;
  current: number;
  prior: number;
};

export type AfsNoteData = {
  propertyPlantEquipment: AfsNoteLine[];
  inventories: AfsNoteLine[];
  tradeReceivables: AfsNoteLine[];
  cashAndCashEquivalents: AfsNoteLine[];
  shareCapital: AfsNoteLine[];
  retainedIncome: AfsNoteLine[];
  shareholdersLoans: AfsNoteLine[];
  tradePayables: AfsNoteLine[];
  revenue: AfsNoteLine[];
  otherIncome: AfsNoteLine[];
  operatingExpenses: AfsNoteLine[];
  financeCosts: AfsNoteLine[];
  taxation: AfsNoteLine[];
  cashUsedInOperations: AfsNoteLine[];
};

export type AfsEngineChecks = {
  sfpAssetsTotal: number;
  sfpEquityAndLiabilitiesTotal: number;
  sfpDifference: number;
  profitForYear: number;
  retainedIncomeClosing: number;
  retainedIncomeMovement: number;
  cashClosingFromSfp: number;
  cashOpeningFromSfp: number;
  cashMovementFromSfp: number;
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

type StatementBucket = {
  key: string;
  label: string;
  note?: string | number | null;
  current: number;
  prior: number;
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rawCurrent(line: AfsEngineTrialBalanceLine) {
  if (line.current_year_balance !== null && line.current_year_balance !== undefined) {
    return safeNumber(line.current_year_balance);
  }
  return safeNumber(line.debit) - safeNumber(line.credit);
}

function rawPrior(line: AfsEngineTrialBalanceLine) {
  if (line.prior_year_balance !== null && line.prior_year_balance !== undefined) {
    return safeNumber(line.prior_year_balance);
  }
  return safeNumber(line.opening_balance);
}

function lineSearchText(line: AfsEngineTrialBalanceLine) {
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
  ].filter(Boolean).join(" ").toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function normaliseAmount(line: AfsEngineTrialBalanceLine, amount: number) {
  const text = lineSearchText(line);
  if (includesAny(text, ["liabil", "equity", "retained", "share capital", "share-capital", "revenue", "sales", "turnover", "income"])) {
    return -amount;
  }
  return amount;
}

function bucketKey(line: AfsEngineTrialBalanceLine) {
  return line.lead_schedule_key || line.mapping_leaf_id || line.mapping_code || line.mapping_label || line.mapping_category || line.account_code || "unmapped";
}

function bucketLabel(line: AfsEngineTrialBalanceLine) {
  const label = line.mapping_label || line.mapping_category || line.lead_schedule_key || line.account_name || "Unmapped";
  return String(label).replaceAll("-", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function addToBuckets(buckets: Map<string, StatementBucket>, line: AfsEngineTrialBalanceLine) {
  const key = bucketKey(line);
  const current = normaliseAmount(line, rawCurrent(line));
  const prior = normaliseAmount(line, rawPrior(line));

  if (!buckets.has(key)) {
    buckets.set(key, { key, label: bucketLabel(line), note: line.note_number || null, current: 0, prior: 0 });
  }

  const bucket = buckets.get(key);
  if (!bucket) return;
  bucket.current += current;
  bucket.prior += prior;
  if (!bucket.note && line.note_number) bucket.note = line.note_number;
}

function buildBuckets(lines: AfsEngineTrialBalanceLine[], matcher: (line: AfsEngineTrialBalanceLine) => boolean) {
  const buckets = new Map<string, StatementBucket>();
  lines.filter(matcher).forEach((line) => addToBuckets(buckets, line));
  return Array.from(buckets.values())
    .filter((bucket) => Math.round(bucket.current) !== 0 || Math.round(bucket.prior) !== 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function bucketRows(buckets: StatementBucket[]): AfsStatementRow[] {
  return buckets.map((bucket) => ({ id: bucket.key, label: bucket.label, note: bucket.note, current: Math.round(bucket.current), prior: Math.round(bucket.prior), type: "line" }));
}

function noteLines(buckets: StatementBucket[]): AfsNoteLine[] {
  return buckets.map((bucket) => ({ id: bucket.key, label: bucket.label, note: bucket.note, current: Math.round(bucket.current), prior: Math.round(bucket.prior) }));
}

function sumBuckets(buckets: StatementBucket[]) {
  return buckets.reduce((total, bucket) => ({ current: total.current + bucket.current, prior: total.prior + bucket.prior }), { current: 0, prior: 0 });
}

function totalCurrent(rows: AfsStatementRow[], id: string) {
  const row = rows.find((item) => item.id === id);
  return Number(row?.current || 0);
}

export function buildAfsPrintStatementEngine(lines: AfsEngineTrialBalanceLine[]): AfsPrintStatementEngineResult {
  const ppe = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["ppe", "property plant", "property, plant", "plant and equipment", "motor vehicle", "furniture", "computer equipment", "office equipment", "machinery"]));
  const investmentProperty = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["investment property"]));
  const intangibleAssets = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["intangible", "goodwill"]));
  const loansReceivable = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["loan receivable", "loans receivable"]));
  const inventories = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["inventory", "inventories", "stock"]));
  const tradeReceivables = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["trade receivable", "accounts receivable", "debtors"]));
  const currentTaxReceivable = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["current tax receivable", "income tax receivable"]));
  const cashAndCashEquivalents = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["cash", "bank", "call account", "petty cash"]));
  const shareCapital = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["share capital", "issued capital", "member contribution"]));
  const retainedIncome = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["retained", "accumulated profit", "accumulated loss"]));
  const reserves = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["reserve"]) && !includesAny(lineSearchText(line), ["retained"]));
  const shareholdersLoans = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["shareholder", "director loan", "member loan", "members loan", "related party loan"]));
  const otherFinancialLiabilities = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["borrowings", "long-term loan", "instalment sale", "lease liability"]));
  const tradePayables = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["trade payable", "accounts payable", "creditors", "accrual"]));
  const currentTaxPayable = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["current tax payable", "income tax payable", "sars income tax"]));

  const revenue = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["revenue", "sales", "turnover"]));
  const costOfSales = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["cost of sales", "cost-of-sales"]));
  const otherIncome = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["other income", "operating income", "investment income"])).filter((bucket) => !revenue.some((existing) => existing.key === bucket.key));
  const operatingExpenses = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["operating expense", "operating expenses", "expense"])).filter((bucket) => !costOfSales.some((existing) => existing.key === bucket.key) && !otherIncome.some((existing) => existing.key === bucket.key));
  const financeCosts = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["finance cost", "interest paid", "interest expense"]));
  const taxation = buildBuckets(lines, (line) => includesAny(lineSearchText(line), ["tax expense", "taxation", "income tax"])).filter((bucket) => !currentTaxReceivable.some((existing) => existing.key === bucket.key) && !currentTaxPayable.some((existing) => existing.key === bucket.key));

  const nonCurrentAssets = [...ppe, ...investmentProperty, ...intangibleAssets, ...loansReceivable];
  const currentAssets = [...inventories, ...tradeReceivables, ...currentTaxReceivable, ...cashAndCashEquivalents];
  const equity = [...shareCapital, ...retainedIncome, ...reserves];
  const nonCurrentLiabilities = [...shareholdersLoans, ...otherFinancialLiabilities];
  const currentLiabilities = [...tradePayables, ...currentTaxPayable];

  const ncaTotal = sumBuckets(nonCurrentAssets);
  const caTotal = sumBuckets(currentAssets);
  const assetsTotal = { current: ncaTotal.current + caTotal.current, prior: ncaTotal.prior + caTotal.prior };
  const equityTotal = sumBuckets(equity);
  const nclTotal = sumBuckets(nonCurrentLiabilities);
  const clTotal = sumBuckets(currentLiabilities);
  const liabilitiesTotal = { current: nclTotal.current + clTotal.current, prior: nclTotal.prior + clTotal.prior };
  const equityLiabilitiesTotal = { current: equityTotal.current + liabilitiesTotal.current, prior: equityTotal.prior + liabilitiesTotal.prior };

  const sfpRows: AfsStatementRow[] = [
    { id: "assets", label: "Assets", type: "section" },
    { id: "nca", label: "Non-current assets", type: "subsection" },
    ...bucketRows(nonCurrentAssets),
    { id: "nca-total", label: "Total non-current assets", current: Math.round(ncaTotal.current), prior: Math.round(ncaTotal.prior), type: "subtotal" },
    { id: "space-1", type: "spacer" },
    { id: "ca", label: "Current assets", type: "subsection" },
    ...bucketRows(currentAssets),
    { id: "ca-total", label: "Total current assets", current: Math.round(caTotal.current), prior: Math.round(caTotal.prior), type: "subtotal" },
    { id: "assets-total", label: "Total assets", current: Math.round(assetsTotal.current), prior: Math.round(assetsTotal.prior), type: "grand-total" },
    { id: "space-2", type: "spacer" },
    { id: "equity-liabilities", label: "Equity and liabilities", type: "section" },
    { id: "equity", label: "Equity", type: "subsection" },
    ...bucketRows(equity),
    { id: "equity-total", label: "Total equity", current: Math.round(equityTotal.current), prior: Math.round(equityTotal.prior), type: "subtotal" },
    { id: "space-3", type: "spacer" },
    { id: "liabilities", label: "Liabilities", type: "section" },
    { id: "ncl", label: "Non-current liabilities", type: "subsection" },
    ...bucketRows(nonCurrentLiabilities),
    { id: "ncl-total", label: "Total non-current liabilities", current: Math.round(nclTotal.current), prior: Math.round(nclTotal.prior), type: "subtotal" },
    { id: "cl", label: "Current liabilities", type: "subsection" },
    ...bucketRows(currentLiabilities),
    { id: "cl-total", label: "Total current liabilities", current: Math.round(clTotal.current), prior: Math.round(clTotal.prior), type: "subtotal" },
    { id: "liabilities-total", label: "Total liabilities", current: Math.round(liabilitiesTotal.current), prior: Math.round(liabilitiesTotal.prior), type: "total" },
    { id: "eql-total", label: "Total equity and liabilities", current: Math.round(equityLiabilitiesTotal.current), prior: Math.round(equityLiabilitiesTotal.prior), type: "grand-total" },
  ];

  const revenueTotal = sumBuckets(revenue);
  const cosTotal = sumBuckets(costOfSales);
  const gross = { current: revenueTotal.current + cosTotal.current, prior: revenueTotal.prior + cosTotal.prior };
  const otherIncomeTotal = sumBuckets(otherIncome);
  const opexTotal = sumBuckets(operatingExpenses);
  const operatingProfit = { current: gross.current + otherIncomeTotal.current + opexTotal.current, prior: gross.prior + otherIncomeTotal.prior + opexTotal.prior };
  const financeCostsTotal = sumBuckets(financeCosts);
  const beforeTax = { current: operatingProfit.current + financeCostsTotal.current, prior: operatingProfit.prior + financeCostsTotal.prior };
  const taxationTotal = sumBuckets(taxation);
  const profitForYear = { current: beforeTax.current + taxationTotal.current, prior: beforeTax.prior + taxationTotal.prior };

  const sociRows: AfsStatementRow[] = [
    ...bucketRows(revenue),
    ...bucketRows(costOfSales),
    { id: "gross", label: "Gross profit / (loss)", current: Math.round(gross.current), prior: Math.round(gross.prior), type: "subtotal" },
    ...bucketRows(otherIncome),
    ...bucketRows(operatingExpenses),
    { id: "operating-profit", label: "Operating profit / (loss)", current: Math.round(operatingProfit.current), prior: Math.round(operatingProfit.prior), type: "subtotal" },
    ...bucketRows(financeCosts),
    { id: "before-tax", label: "Profit / (loss) before taxation", current: Math.round(beforeTax.current), prior: Math.round(beforeTax.prior), type: "subtotal" },
    ...bucketRows(taxation),
    { id: "profit-year", label: "Profit / (loss) for the year", current: Math.round(profitForYear.current), prior: Math.round(profitForYear.prior), type: "grand-total" },
  ];

  const shareCapitalTotal = sumBuckets(shareCapital);
  const retainedIncomeTotal = sumBuckets(retainedIncome);
  const reservesTotal = sumBuckets(reserves);
  const retainedIncomeMovement = retainedIncomeTotal.current - retainedIncomeTotal.prior;
  const otherMovement = retainedIncomeMovement - profitForYear.current;

  const sceRows: AfsStatementRow[] = [
    { id: "sce-share-capital", label: "Share capital", type: "section" },
    { id: "sce-share-opening", label: "Balance at beginning of year", current: Math.round(shareCapitalTotal.prior), prior: null, type: "line" },
    { id: "sce-share-closing", label: "Balance at end of year", current: Math.round(shareCapitalTotal.current), prior: null, type: "subtotal" },
    { id: "sce-space-1", type: "spacer" },
    { id: "sce-retained-income", label: "Retained income", type: "section" },
    { id: "sce-retained-opening", label: "Balance at beginning of year", current: Math.round(retainedIncomeTotal.prior), prior: null, type: "line" },
    { id: "sce-profit", label: "Profit / (loss) for the year", current: Math.round(profitForYear.current), prior: null, type: "line" },
    { id: "sce-other-movement", label: "Other movements / distributions", current: Math.round(otherMovement), prior: null, type: "line" },
    { id: "sce-retained-closing", label: "Balance at end of year", current: Math.round(retainedIncomeTotal.current), prior: null, type: "subtotal" },
    { id: "sce-space-2", type: "spacer" },
    { id: "sce-total-equity", label: "Total equity at end of year", current: Math.round(shareCapitalTotal.current + retainedIncomeTotal.current + reservesTotal.current), prior: null, type: "grand-total" },
  ];

  const cashOpening = sumBuckets(cashAndCashEquivalents).prior;
  const cashClosing = sumBuckets(cashAndCashEquivalents).current;
  const cashMovement = cashClosing - cashOpening;

  const cashFlowRows: AfsStatementRow[] = [
    { id: "cfs-operating", label: "Cash flows from operating activities", type: "section" },
    { id: "cfs-profit-before-tax", label: "Profit / (loss) before taxation", current: Math.round(beforeTax.current), prior: Math.round(beforeTax.prior), type: "line" },
    { id: "cfs-working-capital-placeholder", label: "Working capital and other movements", current: Math.round(cashMovement - beforeTax.current), prior: null, type: "line" },
    { id: "cfs-net-operating", label: "Net movement in cash and cash equivalents", current: Math.round(cashMovement), prior: null, type: "subtotal" },
    { id: "cfs-space-1", type: "spacer" },
    { id: "cfs-cash-beginning", label: "Cash and cash equivalents at beginning of year", current: Math.round(cashOpening), prior: null, type: "line" },
    { id: "cfs-cash-movement", label: "Net increase / (decrease) in cash and cash equivalents", current: Math.round(cashMovement), prior: null, type: "line" },
    { id: "cfs-cash-end", label: "Cash and cash equivalents at end of year", current: Math.round(cashClosing), prior: null, type: "grand-total" },
  ];

  const noteData: AfsNoteData = {
    propertyPlantEquipment: noteLines(ppe),
    inventories: noteLines(inventories),
    tradeReceivables: noteLines(tradeReceivables),
    cashAndCashEquivalents: noteLines(cashAndCashEquivalents),
    shareCapital: noteLines(shareCapital),
    retainedIncome: noteLines(retainedIncome),
    shareholdersLoans: noteLines(shareholdersLoans),
    tradePayables: noteLines(tradePayables),
    revenue: noteLines(revenue),
    otherIncome: noteLines(otherIncome),
    operatingExpenses: noteLines(operatingExpenses),
    financeCosts: noteLines(financeCosts),
    taxation: noteLines(taxation),
    cashUsedInOperations: [
      { id: "profit-before-tax", label: "Profit / (loss) before taxation", current: Math.round(beforeTax.current), prior: Math.round(beforeTax.prior) },
      { id: "cash-movement", label: "Movement in cash and cash equivalents", current: Math.round(cashMovement), prior: 0 },
    ],
  };

  const checks: AfsEngineChecks = {
    sfpAssetsTotal: Math.round(totalCurrent(sfpRows, "assets-total")),
    sfpEquityAndLiabilitiesTotal: Math.round(totalCurrent(sfpRows, "eql-total")),
    sfpDifference: Math.round(totalCurrent(sfpRows, "assets-total") - totalCurrent(sfpRows, "eql-total")),
    profitForYear: Math.round(profitForYear.current),
    retainedIncomeClosing: Math.round(retainedIncomeTotal.current),
    retainedIncomeMovement: Math.round(retainedIncomeMovement),
    cashClosingFromSfp: Math.round(cashClosing),
    cashOpeningFromSfp: Math.round(cashOpening),
    cashMovementFromSfp: Math.round(cashMovement),
  };

  return {
    sfpRows,
    sociRows,
    sceRows,
    cashFlowRows,
    detailedIncomeRows: sociRows,
    noteData,
    checks,
  };
}
