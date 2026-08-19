"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSharedAssetFinanceRows,
  buildSharedBankOverdraftRows,
  buildSharedOtherFinancialLiabilityRows,
  buildSharedShareholderLoanRows,
} from "./AfsSharedStructuredNoteData";

type AmountLine = {
  id?: string;
  label: string;
  current: number;
  prior: number;
  meta?: Record<string, any>;
};

type Props = {
  engagementId: string;
  structuredNotesState?: Record<string, any>;
  onStructuredNotesStateChange?: (next: Record<string, any>) => void;
  noteSections: any[];
  reportOptions: Record<string, boolean>;
  toggleReportOption: (key: string, checked: boolean) => void;
  noteData: Record<string, AmountLine[]>;
  trialBalanceLines: any[];
  clientSetup: Record<string, any> | null;
  currentHeading: string;
  priorHeading: string;
  activeNoteTexts?: Record<string, { title?: string; text?: string }>;
  defaultNoteTexts?: Record<string, { title?: string; text?: string }>;
  disclosureTokens?: Record<string, any>;
  hideComparatives?: boolean;
  forceReviewMode?: boolean;
  sectionKeys?: string[];
  headingMode?: "main" | "continued" | "none";
  rootId?: string;
};


const NotesDisplayContext = createContext({
  currentHeading: "Current",
  priorHeading: "Prior",
  hideComparatives: false,
});


function displayNoteLineLabel(label: unknown) {
  const value = String(label ?? "");
  return value.trim().toLowerCase() === "total" ? "" : value;
}

function useNotesDisplay() {
  return useContext(NotesDisplayContext);
}

type StructuredState = Record<string, any>;
type YearKey = "current" | "prior";

type PpeMovementKey =
  | "openingCost"
  | "additions"
  | "additionsBusinessCombinations"
  | "disposals"
  | "transfers"
  | "revaluations"
  | "foreignExchangeMovements"
  | "decommissioningLiability"
  | "otherMovements"
  | "openingAccumulatedDepreciation"
  | "depreciation"
  | "impairmentLosses"
  | "impairmentReversal"
  | "accumulatedDepreciationDisposals"
  | "accumulatedDepreciationTransfers"
  | "accumulatedDepreciationOtherMovements";

type PpeValues = Partial<Record<PpeMovementKey, number>>;

type PpeRow = {
  key: string;
  label: string;
  current: PpeValues;
  prior: PpeValues;
};

type PpeTab =
  | "summary"
  | "current-cost"
  | "current-dep"
  | "prior-cost"
  | "prior-dep"
  | "disclosures";

const NOTE_KEY_MAP: Record<string, string> = {
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
  notesGoingConcern: "goingConcern",
  notesRelatedParties: "relatedParties",
  notesCommitmentsContingencies: "commitmentsContingencies",
  notesEventsAfterReportingPeriod: "eventsAfterReportingPeriod",
};

const DEFAULT_PPE_ROWS: PpeRow[] = [
  { key: "land", label: "Land", current: {}, prior: {} },
  { key: "buildings", label: "Buildings", current: {}, prior: {} },
  {
    key: "leaseholdProperty",
    label: "Leasehold property",
    current: {},
    prior: {},
  },
  {
    key: "plantAndMachinery",
    label: "Plant and machinery",
    current: {},
    prior: {},
  },
  {
    key: "furnitureAndFittings",
    label: "Furniture and fittings",
    current: {},
    prior: {},
  },
  { key: "motorVehicles", label: "Motor vehicles", current: {}, prior: {} },
  { key: "officeEquipment", label: "Office equipment", current: {}, prior: {} },
  {
    key: "computerEquipment",
    label: "Computer equipment",
    current: {},
    prior: {},
  },
  {
    key: "leaseholdImprovements",
    label: "Leasehold improvements",
    current: {},
    prior: {},
  },
  { key: "otherPpe1", label: "Other PPE 1", current: {}, prior: {} },
  { key: "otherPpe2", label: "Other PPE 2", current: {}, prior: {} },
  { key: "otherPpe3", label: "Other PPE 3", current: {}, prior: {} },
  { key: "otherPpe4", label: "Other PPE 4", current: {}, prior: {} },
];

const COST_MOVEMENTS: { key: PpeMovementKey; label: string }[] = [
  { key: "openingCost", label: "Opening" },
  { key: "additions", label: "Additions" },
  { key: "additionsBusinessCombinations", label: "Business comb." },
  { key: "disposals", label: "Disposals" },
  { key: "transfers", label: "Transfers" },
  { key: "revaluations", label: "Revaluations" },
];

const ACC_DEP_MOVEMENTS: { key: PpeMovementKey; label: string }[] = [
  { key: "openingAccumulatedDepreciation", label: "Opening" },
  { key: "depreciation", label: "Depreciation" },
  { key: "impairmentLosses", label: "Impairment" },
  { key: "impairmentReversal", label: "Reversal" },
  { key: "accumulatedDepreciationDisposals", label: "Disposals" },
  { key: "accumulatedDepreciationTransfers", label: "Transfers" },
];

function toNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/\s/g, "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function amount(value: unknown) {
  const rounded = Math.round(toNumber(value));
  if (rounded === 0) return "–";
  const formatted = Math.abs(rounded).toLocaleString("en-ZA");
  return rounded < 0 ? `(${formatted})` : formatted;
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function mappingStartsWith(line: any, prefixes: string[]) {
  /*
    NON-NEGOTIABLE:
    Structured-note classification is driven by mapping_code only.
  */
  const value = String(line?.mapping_code || "").trim().toLowerCase();
  if (!value) return false;

  return prefixes.some((prefix) => {
    const cleanPrefix = String(prefix || "").trim().toLowerCase();
    return (
      value === cleanPrefix ||
      value.startsWith(`${cleanPrefix}.`) ||
      value.startsWith(`${cleanPrefix}-`) ||
      value.startsWith(`${cleanPrefix} `)
    );
  });
}


function splitRows(lines: AmountLine[]) {
  return lines.filter(
    (line) =>
      Math.round(toNumber(line.current)) !== 0 ||
      Math.round(toNumber(line.prior)) !== 0,
  );
}

function lineAmount(line: any, period: "current" | "prior") {
  const direct =
    period === "current" ? line.current_year_balance : line.prior_year_balance;

  if (
    direct !== null &&
    direct !== undefined &&
    Number.isFinite(Number(direct))
  ) {
    return Number(direct);
  }

  if (
    period === "prior" &&
    line.opening_balance !== null &&
    line.opening_balance !== undefined
  ) {
    return Number(line.opening_balance || 0);
  }

  return Number(line.debit || 0) - Number(line.credit || 0);
}

function isPpeLine(line: any) {
  return mappingStartsWith(line, ["305"]);
}

function normalisedMappingCode(line: any) {
  return clean(line?.mapping_code);
}

function ppeClassKeyFromLine(line: any) {
  const code = normalisedMappingCode(line);

  const codeMap: {
    prefixes: string[];
    key: string;
    label: string;
    balanceType: "cost" | "accumulatedDepreciation" | "impairment";
  }[] = [
    { prefixes: ["305.10"], key: "land", label: "Land", balanceType: "cost" },
    { prefixes: ["305.12"], key: "land", label: "Land", balanceType: "impairment" },

    { prefixes: ["305.20"], key: "buildings", label: "Buildings", balanceType: "cost" },
    { prefixes: ["305.21"], key: "buildings", label: "Buildings", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.22"], key: "buildings", label: "Buildings", balanceType: "impairment" },

    { prefixes: ["305.30"], key: "leaseholdProperty", label: "Leasehold property", balanceType: "cost" },
    { prefixes: ["305.31"], key: "leaseholdProperty", label: "Leasehold property", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.32"], key: "leaseholdProperty", label: "Leasehold property", balanceType: "impairment" },

    { prefixes: ["305.40"], key: "plantAndMachinery", label: "Plant and machinery", balanceType: "cost" },
    { prefixes: ["305.41"], key: "plantAndMachinery", label: "Plant and machinery", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.42"], key: "plantAndMachinery", label: "Plant and machinery", balanceType: "impairment" },

    { prefixes: ["305.50"], key: "furnitureAndFittings", label: "Furniture and fittings", balanceType: "cost" },
    { prefixes: ["305.51"], key: "furnitureAndFittings", label: "Furniture and fittings", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.52"], key: "furnitureAndFittings", label: "Furniture and fittings", balanceType: "impairment" },

    { prefixes: ["305.60"], key: "motorVehicles", label: "Motor vehicles", balanceType: "cost" },
    { prefixes: ["305.61"], key: "motorVehicles", label: "Motor vehicles", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.62"], key: "motorVehicles", label: "Motor vehicles", balanceType: "impairment" },

    { prefixes: ["305.70"], key: "officeEquipment", label: "Office equipment", balanceType: "cost" },
    { prefixes: ["305.71"], key: "officeEquipment", label: "Office equipment", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.72"], key: "officeEquipment", label: "Office equipment", balanceType: "impairment" },

    { prefixes: ["305.80"], key: "computerEquipment", label: "Computer equipment", balanceType: "cost" },
    { prefixes: ["305.81"], key: "computerEquipment", label: "Computer equipment", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.82"], key: "computerEquipment", label: "Computer equipment", balanceType: "impairment" },

    { prefixes: ["305.90"], key: "leaseholdImprovements", label: "Leasehold improvements", balanceType: "cost" },
    { prefixes: ["305.91"], key: "leaseholdImprovements", label: "Leasehold improvements", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.92"], key: "leaseholdImprovements", label: "Leasehold improvements", balanceType: "impairment" },

    { prefixes: ["305.101"], key: "otherPpe1", label: "Other PPE 1", balanceType: "cost" },
    { prefixes: ["305.102"], key: "otherPpe1", label: "Other PPE 1", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.103"], key: "otherPpe1", label: "Other PPE 1", balanceType: "impairment" },

    { prefixes: ["305.111"], key: "otherPpe2", label: "Other PPE 2", balanceType: "cost" },
    { prefixes: ["305.112"], key: "otherPpe2", label: "Other PPE 2", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.113"], key: "otherPpe2", label: "Other PPE 2", balanceType: "impairment" },

    { prefixes: ["305.121"], key: "otherPpe3", label: "Other PPE 3", balanceType: "cost" },
    { prefixes: ["305.122"], key: "otherPpe3", label: "Other PPE 3", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.123"], key: "otherPpe3", label: "Other PPE 3", balanceType: "impairment" },

    { prefixes: ["305.131"], key: "otherPpe4", label: "Other PPE 4", balanceType: "cost" },
    { prefixes: ["305.132"], key: "otherPpe4", label: "Other PPE 4", balanceType: "accumulatedDepreciation" },
    { prefixes: ["305.133"], key: "otherPpe4", label: "Other PPE 4", balanceType: "impairment" },

  ];

  const match = codeMap.find((entry) =>
    entry.prefixes.some(
      (prefix) =>
        code === prefix ||
        code.startsWith(`${prefix}.`) ||
        code.startsWith(`${prefix}-`) ||
        code.startsWith(`${prefix} `),
    ),
  );

  return match || null;
}

function useStructuredNotesState(
  engagementId: string,
  initialState: StructuredState = {},
  onChange?: (next: StructuredState) => void,
) {
  const storageKey = `practicepilot-afs-structured-notes:${engagementId}`;
  const [state, setState] = useState<StructuredState>(initialState || {});
  const loadedEngagementRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadedEngagementRef.current === engagementId) return;

    loadedEngagementRef.current = engagementId;

    const suppliedState = initialState || {};

    if (Object.keys(suppliedState).length > 0) {
      setState(suppliedState);

      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(suppliedState),
        );
      } catch {
        // localStorage is only a fallback cache
      }

      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      setState(raw ? JSON.parse(raw) : {});
    } catch {
      setState({});
    }
  }, [engagementId, storageKey]);

  function update(path: string[], value: any) {
    setState((current) => {
      const next = structuredCloneSafe(current);
      let cursor: any = next;

      path.slice(0, -1).forEach((key) => {
        if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
        cursor = cursor[key];
      });

      cursor[path[path.length - 1]] = value;

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // localStorage is only a fallback cache
      }

      onChange?.(next);

      window.dispatchEvent(
        new CustomEvent("afs-structured-notes-change", {
          detail: {
            engagementId,
            state: next,
          },
        }),
      );

      return next;
    });
  }

  return { state, update };
}

function structuredCloneSafe<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value || {}));
  }
}

function noteTitle(
  section: any,
  activeNoteTexts: Props["activeNoteTexts"],
  defaultNoteTexts: Props["defaultNoteTexts"],
) {
  return (
    activeNoteTexts?.[section.key]?.title ||
    defaultNoteTexts?.[section.key]?.title ||
    section.title ||
    section.defaultTitle ||
    section.label ||
    "Note"
  );
}

function directOpeningBalance(line: any) {
  if (
    line?.opening_balance !== null &&
    line?.opening_balance !== undefined &&
    Number.isFinite(Number(line.opening_balance))
  ) {
    return Number(line.opening_balance);
  }

  return 0;
}

function buildPpeRows(lines: any[], savedRows: PpeRow[] = []) {
  const map = new Map<string, PpeRow>();

  DEFAULT_PPE_ROWS.forEach((row) => {
    map.set(row.key, {
      ...row,
      current: { ...row.current },
      prior: { ...row.prior },
    });
  });

  savedRows
  .filter((savedRow) => map.has(String(savedRow.key)))
  .forEach((row) => {
    const current = { ...(row.current || {}) } as any;
    const prior = { ...(row.prior || {}) } as any;

    // These values must always be rebuilt from controlled mapping codes.
    current.openingCost = 0;
    current.openingAccumulatedDepreciation = 0;
    current.mappedClosingCost = 0;
    current.mappedClosingAccumulatedDepreciation = 0;

    prior.openingCost = 0;
    prior.openingAccumulatedDepreciation = 0;
    prior.mappedClosingCost = 0;
    prior.mappedClosingAccumulatedDepreciation = 0;

    map.set(String(row.key), {
      ...map.get(String(row.key))!,
      ...row,
      current,
      prior,
    });
  });

  lines.filter(isPpeLine).forEach((line) => {
    const klass = ppeClassKeyFromLine(line);

    // Never force an unknown PPE account into a generic Other PPE row.
    // The account must use one of the controlled 305/306 mapping codes.
    if (!klass) return;

    const row = map.get(klass.key);
    if (!row) return;

    /*
      Other PPE 1-4 may be renamed in Mapping using the
      "Financial statement description" field. Pull that saved mapping_label
      through to the PPE note.
    */
    if (
      String(klass.key).startsWith("otherPpe") &&
      clean(line?.mapping_label)
    ) {
      row.label = clean(line.mapping_label);
    }

    const currentClosing = lineAmount(line, "current");
    const priorClosing = lineAmount(line, "prior");
    const storedPriorOpening = directOpeningBalance(line);

const priorOpening =
  Math.round(storedPriorOpening) !== 0
    ? storedPriorOpening
    : priorClosing;

    if (klass.balanceType === "cost") {
      row.current.openingCost =
        toNumber(row.current.openingCost) + priorClosing;
      row.prior.openingCost =
        toNumber(row.prior.openingCost) + priorOpening;

      (row.current as any).mappedClosingCost =
        toNumber((row.current as any).mappedClosingCost) + currentClosing;
      (row.prior as any).mappedClosingCost =
        toNumber((row.prior as any).mappedClosingCost) + priorClosing;
    }

    if (
      klass.balanceType === "accumulatedDepreciation" ||
      klass.balanceType === "impairment"
    ) {
      const currentAccumulated = Math.abs(currentClosing);
      const priorAccumulated = Math.abs(priorClosing);
      const openingAccumulated = Math.abs(priorOpening);

      row.current.openingAccumulatedDepreciation =
        toNumber(row.current.openingAccumulatedDepreciation) +
        priorAccumulated;
      row.prior.openingAccumulatedDepreciation =
        toNumber(row.prior.openingAccumulatedDepreciation) +
        openingAccumulated;

      (row.current as any).mappedClosingAccumulatedDepreciation =
        toNumber((row.current as any).mappedClosingAccumulatedDepreciation) +
        currentAccumulated;
      (row.prior as any).mappedClosingAccumulatedDepreciation =
        toNumber((row.prior as any).mappedClosingAccumulatedDepreciation) +
        priorAccumulated;
    }
  });

  return DEFAULT_PPE_ROWS.map((defaultRow) => map.get(defaultRow.key)!)
    .filter(Boolean);
}

function numberInputStyle() {
  return {
    width: "58px",
    minWidth: "58px",
    border: "1px solid #7A9FC8",
    background: "#EAF3FF",
    color: "#111827",
    outlineColor: "#2563EB",
    padding: "3px 4px",
    fontSize: 10.8,
    textAlign: "right" as const,
    fontFamily: "inherit",
  };
}

function textAreaStyle() {
  return {
    width: "100%",
    minHeight: 46,
    border: "1px solid #7A9FC8",
    padding: 6,
    fontSize: 10.8,
    fontFamily: "inherit",
    resize: "vertical" as const,
    background: "#EAF3FF",
    outlineColor: "#2563EB",
  };
}

function inputStyle() {
  return {
    width: "100%",
    border: "1px solid #7A9FC8",
    padding: "4px 5px",
    fontSize: 10.8,
    fontFamily: "inherit",
    background: "#EAF3FF",
    outlineColor: "#2563EB",
  };
}

function ppeValue(row: PpeRow, year: YearKey, key: PpeMovementKey) {
  return toNumber(row[year]?.[key]);
}

function closingCost(values: PpeValues) {
  return (
    toNumber(values.openingCost) +
    toNumber(values.additions) +
    toNumber(values.additionsBusinessCombinations) -
    toNumber(values.disposals) +
    toNumber(values.transfers) +
    toNumber(values.revaluations)
  );
}

function closingAccumulatedDepreciation(values: PpeValues) {
  return (
    toNumber(values.openingAccumulatedDepreciation) +
    toNumber(values.depreciation) +
    toNumber(values.impairmentLosses) -
    toNumber(values.impairmentReversal) -
    toNumber(values.accumulatedDepreciationDisposals) +
    toNumber(values.accumulatedDepreciationTransfers)
  );
}

function carryingAmount(values: PpeValues) {
  return closingCost(values) - closingAccumulatedDepreciation(values);
}

function sumPpeRows(
  rows: PpeRow[],
  year: YearKey,
  getter: (values: PpeValues) => number,
) {
  return rows.reduce((sum, row) => sum + getter(row[year] || {}), 0);
}

function shouldHideNoteTotal(rows: AmountLine[]): boolean {
  const text = rows
    .map((row) => String(row.label || ""))
    .join(" | ")
    .toLowerCase();

  return (
    text.includes("cash generated from / (used in) operations") &&
    text.includes("net cash from / (used in) operating activities") &&
    text.includes("net increase / (decrease) in cash and cash equivalents")
  );
}

function rowsTotal(rows: AmountLine[], side: "current" | "prior") {
  return splitRows(rows).reduce((sum, row) => sum + toNumber(row[side]), 0);
}

function rowByIdOrLabel(rows: AmountLine[], terms: string[]) {
  return rows.find((row) => {
    const text = `${row.id || ""} ${row.label || ""}`.toLowerCase();
    return terms.every((term) => text.includes(term.toLowerCase()));
  });
}

function getSetupNumber(clientSetup: Record<string, any> | null, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = clientSetup?.[key];
    if (value !== null && value !== undefined && value !== "") {
      const parsed = toNumber(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return fallback;
}


function getSetupText(
  clientSetup: Record<string, any> | null,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = clientSetup?.[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return String(value).trim();
    }
  }

  return fallback;
}

function currentTaxBalanceAmount(rows: AmountLine[]) {
  return rowsTotal(rows, "current");
}

function priorTaxBalanceAmount(rows: AmountLine[]) {
  return rowsTotal(rows, "prior");
}

function hasDeferredTaxRows(rows: AmountLine[]) {
  return splitRows(rows).some((row) =>
    String(row.label || "").toLowerCase().includes("deferred tax"),
  );
}

function deferredTaxAmount(rows: AmountLine[], side: "current" | "prior") {
  return splitRows(rows)
    .filter((row) => String(row.label || "").toLowerCase().includes("deferred tax"))
    .reduce((sum, row) => sum + toNumber(row[side]), 0);
}

function roundAmount(value: unknown) {
  return Math.round(toNumber(value));
}

function difference(actual: number, expected: number) {
  return roundAmount(actual) - roundAmount(expected);
}

function hasDifference(
  actualCurrent: number,
  expectedCurrent: number,
  actualPrior: number,
  expectedPrior: number,
) {
  return (
    difference(actualCurrent, expectedCurrent) !== 0 ||
    difference(actualPrior, expectedPrior) !== 0
  );
}

function ValidationBox({
  label,
  expectedCurrent,
  actualCurrent,
  expectedPrior,
  actualPrior,
}: {
  label: string;
  expectedCurrent: number;
  actualCurrent: number;
  expectedPrior: number;
  actualPrior: number;
}) {
  // Validation is now handled by the AFS FlightDeck.
  // Keep this component as a no-output placeholder so the rest of the notes panel remains unchanged.
  return null;
}

function normaliseLoanAmount(value: unknown) {
  const rounded = Math.round(toNumber(value));
  return Math.abs(rounded);
}

function shareholderLoanSearchText(line: any) {
  return [
    line.mapping_code,
    line.mapping_leaf_id,
    line.lead_schedule_key,
    line.lead_schedule_number,
    line.mapping_label,
    line.mapping_path,
    line.mapping_section,
    line.mapping_category,
    line.account_code,
    line.account_name,
    line.account_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isShareholderLoanLine(line: any) {
  /*
    Mapping-driven only:
    548 / 500.548 = shareholder / director / member loans.
    Do not include accounts because of account names or wording.
  */
  return mappingStartsWith(line, ["548"]);
}

function shareholderLoanLabel(line: any) {
  return (
    clean(line.account_name) ||
    clean(line.description) ||
    clean(line.mapping_label) ||
    clean(line.mapping_category) ||
    "Shareholder / director / member loan"
  );
}

function shareholderLoanLineKey(line: any, index: number) {
  return String(
    line.id ||
      line.account_code ||
      line.account_name ||
      line.mapping_leaf_id ||
      line.mapping_code ||
      `shareholder-loan-${index}`,
  );
}

function buildShareholderLoanDetailRows(
  trialBalanceLines: any[],
  fallbackRows: AmountLine[],
): AmountLine[] {
  const grouped = new Map<string, AmountLine>();

  (trialBalanceLines || [])
    .filter(isShareholderLoanLine)
    .forEach((line, index) => {
      const current = normaliseLoanAmount(lineAmount(line, "current"));
      const prior = normaliseLoanAmount(lineAmount(line, "prior"));
      if (current === 0 && prior === 0) return;

      const label = shareholderLoanLabel(line);
      const key = shareholderLoanLineKey(line, index);

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          label,
          current: 0,
          prior: 0,
          meta: { source: "trialBalanceLine" },
        });
      }

      const row = grouped.get(key);
      if (!row) return;
      row.current += current;
      row.prior += prior;
    });

  const detailRows = Array.from(grouped.values()).filter(
    (row) => roundAmount(row.current) !== 0 || roundAmount(row.prior) !== 0,
  );

  if (detailRows.length > 0) {
    return detailRows.sort((a, b) => a.label.localeCompare(b.label));
  }

  return fallbackRows;
}

function NoteTable({
  rows,
  edit = false,
  state,
  stateKey,
  update,
}: {
  rows: AmountLine[];
  edit?: boolean;
  state?: StructuredState;
  stateKey?: string;
  update?: (path: string[], value: any) => void;
}) {
  const { currentHeading, priorHeading, hideComparatives } = useNotesDisplay();
  const visibleRows = splitRows(rows);
  const totalCurrent = visibleRows.reduce(
    (sum, row) => sum + toNumber(row.current),
    0,
  );
  const totalPrior = visibleRows.reduce(
    (sum, row) => sum + toNumber(row.prior),
    0,
  );
  const hideTotal =
    shouldHideNoteTotal(visibleRows) ||
    visibleRows.some((row) =>
      String(row.label || "")
        .toLowerCase()
        .includes("net increase / (decrease) in cash and cash equivalents"),
    );

  if (visibleRows.length === 0) return null;

  return (
    <table style={styles.table}>
      <colgroup>
        <col style={{ width: "auto" }} />
        <col style={{ width: 76 }} />
        {!hideComparatives ? <col style={{ width: 76 }} /> : null}
      </colgroup>
      <thead>
        <tr>
          <th style={styles.thLeft}>Description</th>
          <th style={styles.thRight}>{currentHeading}</th>
          {!hideComparatives ? (
            <th style={styles.thRight}>{priorHeading}</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {visibleRows.map((row, index) => {
          const rowKey = row.id || row.label || String(index);
          const savedLabelRaw = stateKey
            ? state?.[stateKey]?.lineLabels?.[rowKey]
            : "";
          const savedLabel =
            typeof savedLabelRaw === "string"
              ? savedLabelRaw
              : savedLabelRaw?.label || "";
          const displayLabel = savedLabel || row.label;

          return (
            <tr key={rowKey}>
              <td style={styles.tdLeft}>
                {edit && stateKey && update ? (
                  <input
                    value={displayLabel}
                    onChange={(event) =>
                      update(
                        [stateKey, "lineLabels", rowKey, "label"],
                        event.target.value,
                      )
                    }
                    style={inputStyle()}
                  />
                ) : (
                  displayLabel
                )}
              </td>
              <td style={styles.tdRight}>{amount(row.current)}</td>
              {!hideComparatives ? (
                <td style={styles.tdRight}>{amount(row.prior)}</td>
              ) : null}
            </tr>
          );
        })}
        {!hideTotal ? (
          <tr>
            <td data-total-label="true" style={styles.totalLabel}>
              &nbsp;
            </td>
            <td data-total-amount="true" style={styles.totalAmount}>
              {amount(totalCurrent)}
            </td>
            {!hideComparatives ? (
              <td data-total-amount="true" style={styles.totalAmount}>
                {amount(totalPrior)}
              </td>
            ) : null}
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function EditableTextBlock({
  label,
  value,
  edit,
  onChange,
}: {
  label: string;
  value: string;
  edit: boolean;
  onChange: (value: string) => void;
}) {
  if (edit) {
    return (
      <label style={{ display: "grid", gap: 4, margin: "6px 0" }}>
        <span style={styles.smallLabel}>{label}</span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={textAreaStyle()}
        />
      </label>
    );
  }

  if (!value.trim()) return null;

  return <p style={styles.paragraph}>{value}</p>;
}

function PpeInput({
  row,
  year,
  movementKey,
  state,
  update,
}: {
  row: PpeRow;
  year: YearKey;
  movementKey: PpeMovementKey;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const isMappedOpening =
  year === "current" &&
  (
    movementKey === "openingCost" ||
    movementKey === "openingAccumulatedDepreciation"
  );
  const raw = state.ppeInputs?.[row.key]?.[year]?.[movementKey];
  const fallback = row[year]?.[movementKey];
  const value = isMappedOpening
    ? fallback !== undefined && fallback !== 0
      ? String(fallback)
      : ""
    : raw !== undefined
      ? raw
      : fallback !== undefined && fallback !== 0
        ? String(fallback)
        : "";

  return (
    <td style={styles.amountTd}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        readOnly={isMappedOpening}
        title={isMappedOpening ? "Pulled automatically from the trial balance." : undefined}
        onChange={(event) => {
          if (isMappedOpening) return;
          update(["ppeInputs", row.key, year, movementKey], event.target.value);
        }}
        style={{
          ...numberInputStyle(),
          background: isMappedOpening ? "#F1F5F9" : "#EAF3FF",
          border: isMappedOpening ? "1px solid #CBD5E1" : "1px solid #7A9FC8",
          outlineColor: isMappedOpening ? "#CBD5E1" : "#2563EB",
          color: isMappedOpening ? "#334155" : "#111827",
        }}
      />
    </td>
  );
}

function resolvedPpeRows(rows: PpeRow[], state: StructuredState) {
  return rows.map((row) => {
    const current = { ...(row.current || {}) };
    const prior = { ...(row.prior || {}) };

    (["current", "prior"] as YearKey[]).forEach((year) => {
      const values = state.ppeInputs?.[row.key]?.[year] || {};
      Object.keys(values).forEach((key) => {
        const movementKey = key as PpeMovementKey;
        if (year === "current") current[movementKey] = toNumber(values[key]);
        if (year === "prior") prior[movementKey] = toNumber(values[key]);
      });
    });

    return { ...row, current, prior };
  });
}


function GoingConcernNote({
  edit,
  state,
  update,
}: {
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const values = state.goingConcernAssessment || {};
  const fields = [
    ["conditions", "Conditions or events requiring consideration"],
    ["support", "Shareholder, lender or group support"],
    ["repayment", "Repayment demands, moratoriums or subordinations"],
    ["forecast", "Forecast period and expected operating performance"],
    ["funding", "Expected funding requirements and available facilities"],
    ["conclusion", "Directors’ conclusion"],
  ];

  if (edit) {
    return (
      <div style={styles.editGridSingle}>
        <p style={styles.paragraph}>
          Complete this assessment only when company-specific going-concern disclosure is required. Blank fields do not print.
        </p>
        {fields.map(([key, label]) => (
          <EditableTextBlock
            key={key}
            label={label}
            value={values[key] || ""}
            edit
            onChange={(value) => update(["goingConcernAssessment", key], value)}
          />
        ))}
      </div>
    );
  }

  const completed = fields.filter(([key]) => String(values[key] || "").trim());
  if (!completed.length) return null;

  return (
    <div>
      {completed.map(([key, label]) => (
        <div key={key} style={{ marginBottom: 7 }}>
          <div style={{ fontWeight: 700, fontSize: 10.5 }}>{label}</div>
          <p style={styles.paragraph}>{values[key]}</p>
        </div>
      ))}
    </div>
  );
}

function RelatedPartiesNote({
  edit,
  state,
  update,
}: {
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const rows = Array.isArray(state.relatedPartyRows)
    ? state.relatedPartyRows
    : [];

  const rowHasContent = (row: any) =>
    [
      row?.name,
      row?.relationship,
      row?.transaction,
      row?.current,
      row?.prior,
      row?.terms,
      row?.interest,
      row?.security,
      row?.commitments,
    ].some((value) => String(value ?? "").trim());

  const displayRows = edit
    ? rows.length
      ? rows
      : [{}]
    : rows.filter(rowHasContent);

  const setRows = (next: any[]) => update(["relatedPartyRows"], next);

  const change = (index: number, field: string, value: string) => {
    const next = [...displayRows];
    next[index] = {
      ...(next[index] || {}),
      [field]: value,
    };
    setRows(next);
  };

  if (!edit && displayRows.length === 0) return null;

  if (edit) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <p style={{ ...styles.paragraph, margin: 0 }}>
            Capture each related party separately. Blank fields do not print.
          </p>

          <button
            type="button"
            style={styles.button}
            onClick={() => setRows([...displayRows, {}])}
          >
            Add related party
          </button>
        </div>

        {displayRows.map((row: any, index: number) => (
          <section
            key={`related-party-editor-${index}`}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              padding: 9,
              display: "grid",
              gap: 8,
              breakInside: "avoid",
              pageBreakInside: "avoid",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.15fr 1fr",
                gap: 8,
              }}
            >
              <label style={relatedPartyLabelStyle()}>
                Name
                <input
                  value={row.name || ""}
                  placeholder="Related party name"
                  onChange={(event) =>
                    change(index, "name", event.target.value)
                  }
                  style={relatedPartyInputStyle()}
                />
              </label>

              <label style={relatedPartyLabelStyle()}>
                Relationship
                <input
                  value={row.relationship || ""}
                  placeholder="Director, shareholder, group company..."
                  onChange={(event) =>
                    change(index, "relationship", event.target.value)
                  }
                  style={relatedPartyInputStyle()}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 105px 105px",
                gap: 8,
              }}
            >
              <label style={relatedPartyLabelStyle()}>
                Transaction type
                <input
                  value={row.transaction || ""}
                  placeholder="Loan, management fees, purchases..."
                  onChange={(event) =>
                    change(index, "transaction", event.target.value)
                  }
                  style={relatedPartyInputStyle()}
                />
              </label>

              <label style={relatedPartyLabelStyle()}>
                Current
                <input
                  inputMode="decimal"
                  value={row.current || ""}
                  onChange={(event) =>
                    change(index, "current", event.target.value)
                  }
                  style={relatedPartyInputStyle(true)}
                />
              </label>

              <label style={relatedPartyLabelStyle()}>
                Prior
                <input
                  inputMode="decimal"
                  value={row.prior || ""}
                  onChange={(event) =>
                    change(index, "prior", event.target.value)
                  }
                  style={relatedPartyInputStyle(true)}
                />
              </label>
            </div>

            <label style={relatedPartyLabelStyle()}>
              Terms and repayment
              <textarea
                value={row.terms || ""}
                placeholder="Repayment terms, maturity and other material conditions"
                onChange={(event) =>
                  change(index, "terms", event.target.value)
                }
                style={{ ...textAreaStyle(), minHeight: 42 }}
              />
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <label style={relatedPartyLabelStyle()}>
                Interest
                <input
                  value={row.interest || ""}
                  placeholder="Interest rate or interest-free"
                  onChange={(event) =>
                    change(index, "interest", event.target.value)
                  }
                  style={relatedPartyInputStyle()}
                />
              </label>

              <label style={relatedPartyLabelStyle()}>
                Security
                <input
                  value={row.security || ""}
                  placeholder="Security or unsecured"
                  onChange={(event) =>
                    change(index, "security", event.target.value)
                  }
                  style={relatedPartyInputStyle()}
                />
              </label>
            </div>

            <label style={relatedPartyLabelStyle()}>
              Guarantees, commitments or support
              <textarea
                value={row.commitments || ""}
                placeholder="Guarantees, commitments, subordination or financial support"
                onChange={(event) =>
                  change(index, "commitments", event.target.value)
                }
                style={{ ...textAreaStyle(), minHeight: 38 }}
              />
            </label>

            <button
              type="button"
              onClick={() =>
                setRows(
                  displayRows.filter(
                    (_: any, rowIndex: number) => rowIndex !== index,
                  ),
                )
              }
              style={{
                ...styles.button,
                justifySelf: "start",
              }}
            >
              Remove
            </button>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 11 }}>
      {displayRows.map((row: any, index: number) => {
        const detailRows = [
          ["Terms and repayment", row.terms],
          ["Interest", row.interest],
          ["Security", row.security],
          ["Guarantees, commitments or support", row.commitments],
        ].filter(([, value]) => String(value ?? "").trim());

        return (
          <section
            key={`related-party-review-${index}`}
            style={{
              breakInside: "avoid",
              pageBreakInside: "avoid",
            }}
          >
            <table
              style={{
                ...styles.table,
                width: "100%",
                tableLayout: "fixed",
                margin: 0,
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...styles.thLeft, width: "25%" }}>Name</th>
                  <th style={{ ...styles.thLeft, width: "20%" }}>
                    Relationship
                  </th>
                  <th style={{ ...styles.thLeft, width: "29%" }}>
                    Transaction
                  </th>
                  <th style={{ ...styles.thRight, width: "13%" }}>
                    Current
                  </th>
                  <th style={{ ...styles.thRight, width: "13%" }}>Prior</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td style={{ ...styles.tdLeft, fontWeight: 700 }}>
                    {row.name || "–"}
                  </td>
                  <td style={styles.tdLeft}>{row.relationship || "–"}</td>
                  <td style={styles.tdLeft}>{row.transaction || "–"}</td>
                  <td style={styles.tdRight}>
                    {String(row.current ?? "").trim()
                      ? amount(toNumber(row.current))
                      : "–"}
                  </td>
                  <td style={styles.tdRight}>
                    {String(row.prior ?? "").trim()
                      ? amount(toNumber(row.prior))
                      : "–"}
                  </td>
                </tr>
              </tbody>
            </table>

            {detailRows.length > 0 ? (
              <div
                style={{
                  borderBottom: "1px solid #cbd5e1",
                  padding: "5px 0 7px",
                  display: "grid",
                  gap: 3,
                }}
              >
                {detailRows.map(([label, value]) => (
                  <div
                    key={`${index}-${label}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "145px minmax(0, 1fr)",
                      gap: 8,
                      fontSize: 10.2,
                      lineHeight: 1.35,
                    }}
                  >
                    <strong>{label}</strong>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function relatedPartyLabelStyle() {
  return {
    display: "grid",
    gap: 4,
    fontSize: 9.5,
    lineHeight: 1.2,
    fontWeight: 800,
    color: "#334155",
  };
}

function relatedPartyInputStyle(amountField = false) {
  return {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "4px 5px",
    fontSize: 10,
    textAlign: amountField ? ("right" as const) : ("left" as const),
    background: "#EAF3FF",
    border: "1px solid #7A9FC8",
    outlineColor: "#2563EB",
    color: "#111827",
  };
}

function PpeStructuredNote({
  noteNumber,
  edit,
  rows,
  mappedRows,
  state,
  update,
}: {
  noteNumber: number | null;
  edit: boolean;
  rows: PpeRow[];
  mappedRows: AmountLine[];
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const [tab, setTab] = useState<PpeTab>("summary");
  const { currentHeading, priorHeading } = useNotesDisplay();
  const workingRows = resolvedPpeRows(rows, state);
  const populatedRows = workingRows.filter(
    (row) =>
      carryingAmount(row.current || {}) !== 0 ||
      carryingAmount(row.prior || {}) !== 0 ||
      edit,
  );
  const security = state.ppeText?.security || "";
  const restrictions = state.ppeText?.restrictions || "";
  const commitments = state.ppeText?.commitments || "";
  const mappedCurrent = rowsTotal(mappedRows, "current");
  const mappedPrior = rowsTotal(mappedRows, "prior");
  const ppeCurrentCarrying = sumPpeRows(workingRows, "current", carryingAmount);
  const ppePriorCarrying = sumPpeRows(workingRows, "prior", carryingAmount);
  const mappedCurrentCost = workingRows.reduce(
    (sum, row) => sum + toNumber((row.current as any).mappedClosingCost),
    0,
  );
  const mappedPriorCost = workingRows.reduce(
    (sum, row) => sum + toNumber((row.prior as any).mappedClosingCost),
    0,
  );
  const mappedCurrentAccumulatedDepreciation = workingRows.reduce(
    (sum, row) =>
      sum +
      toNumber((row.current as any).mappedClosingAccumulatedDepreciation),
    0,
  );
  const mappedPriorAccumulatedDepreciation = workingRows.reduce(
    (sum, row) =>
      sum +
      toNumber((row.prior as any).mappedClosingAccumulatedDepreciation),
    0,
  );
  const mappedCurrentCarrying =
    mappedCurrentCost - mappedCurrentAccumulatedDepreciation;
  const mappedPriorCarrying =
    mappedPriorCost - mappedPriorAccumulatedDepreciation;
  const ppeReconciles =
    Math.round(ppeCurrentCarrying) === Math.round(mappedCurrentCarrying) &&
    Math.round(ppePriorCarrying) === Math.round(mappedPriorCarrying);

  if (!edit && populatedRows.length === 0) {
    return null;
  }

  return (
    <section
      id={noteNumber ? `afs-note-${noteNumber}` : undefined}
      style={styles.noteSection}
    >
      <h2 style={styles.noteHeading}>
        {noteNumber ? `${noteNumber}. ` : ""}Property, plant and equipment
      </h2>

      <ValidationBox
        label="PPE closing carrying amount must agree to the mapped PPE balance."
        expectedCurrent={mappedCurrent}
        actualCurrent={ppeCurrentCarrying}
        expectedPrior={mappedPrior}
        actualPrior={ppePriorCarrying}
      />

      {edit && !ppeReconciles ? (
        <div
          style={{
            margin: "6px 0 8px",
            border: "1px solid #dc2626",
            background: "#fef2f2",
            color: "#991b1b",
            padding: "6px 8px",
            fontSize: 10.4,
            fontWeight: 700,
          }}
        >
          PPE note is not reconciled to the mapped trial balance. Complete the
          movement columns until the closing cost and accumulated depreciation
          agree to the mapped closing balances.
        </div>
      ) : null}

      {edit ? (
        <>
          <div style={styles.tabBar}>
            <TabButton
              active={tab === "summary"}
              onClick={() => setTab("summary")}
            >
              Summary
            </TabButton>
            <TabButton
              active={tab === "current-cost"}
              onClick={() => setTab("current-cost")}
            >
              {currentHeading} cost
            </TabButton>
            <TabButton
              active={tab === "current-dep"}
              onClick={() => setTab("current-dep")}
            >
              {currentHeading} dep.
            </TabButton>
            <TabButton
              active={tab === "prior-cost"}
              onClick={() => setTab("prior-cost")}
            >
              {priorHeading} cost
            </TabButton>
            <TabButton
              active={tab === "prior-dep"}
              onClick={() => setTab("prior-dep")}
            >
              {priorHeading} dep.
            </TabButton>
            <TabButton
              active={tab === "disclosures"}
              onClick={() => setTab("disclosures")}
            >
              Text
            </TabButton>
          </div>

          {tab === "summary" ? (
            <PpeSummaryTable
              rows={populatedRows}
              edit
              state={state}
              update={update}
            />
          ) : null}
          {tab === "current-cost" ? (
            <PpeMovementEditor
              rows={populatedRows}
              year="current"
              movements={COST_MOVEMENTS}
              state={state}
              update={update}
              title={`Cost / valuation reconciliation - ${currentHeading}`}
              totalGetter={closingCost}
            />
          ) : null}
          {tab === "current-dep" ? (
            <PpeMovementEditor
              rows={populatedRows}
              year="current"
              movements={ACC_DEP_MOVEMENTS}
              state={state}
              update={update}
              title={`Accumulated depreciation / impairment - ${currentHeading}`}
              totalGetter={closingAccumulatedDepreciation}
            />
          ) : null}
          {tab === "prior-cost" ? (
            <PpeMovementEditor
              rows={populatedRows}
              year="prior"
              movements={COST_MOVEMENTS}
              state={state}
              update={update}
              title={`Cost / valuation reconciliation - ${priorHeading}`}
              totalGetter={closingCost}
            />
          ) : null}
          {tab === "prior-dep" ? (
            <PpeMovementEditor
              rows={populatedRows}
              year="prior"
              movements={ACC_DEP_MOVEMENTS}
              state={state}
              update={update}
              title={`Accumulated depreciation / impairment - ${priorHeading}`}
              totalGetter={closingAccumulatedDepreciation}
            />
          ) : null}
          {tab === "disclosures" ? (
            <div style={styles.editGridSingle}>
              <EditableTextBlock
                label="Pledged as security"
                value={security}
                edit
                onChange={(value) => update(["ppeText", "security"], value)}
              />
              <EditableTextBlock
                label="Restrictions on title"
                value={restrictions}
                edit
                onChange={(value) => update(["ppeText", "restrictions"], value)}
              />
              <EditableTextBlock
                label="Capital commitments"
                value={commitments}
                edit
                onChange={(value) => update(["ppeText", "commitments"], value)}
              />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p style={styles.paragraph}>
            Property, plant and equipment consist of the following classes of
            assets:
          </p>
          <PpeSummaryTable rows={populatedRows} />
          <PpeFinancialMovementTable
            rows={populatedRows}
            year="current"
            title={`Reconciliation of property, plant and equipment - ${currentHeading}`}
          />
          <PpeFinancialMovementTable
            rows={populatedRows}
            year="prior"
            title={`Reconciliation of property, plant and equipment - ${priorHeading}`}
          />
          <EditableTextBlock
            label="Pledged as security"
            value={security}
            edit={false}
            onChange={() => undefined}
          />
          <EditableTextBlock
            label="Restrictions on title"
            value={restrictions}
            edit={false}
            onChange={() => undefined}
          />
          <EditableTextBlock
            label="Capital commitments"
            value={commitments}
            edit={false}
            onChange={() => undefined}
          />
        </>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? styles.activeTab : styles.tab}
    >
      {children}
    </button>
  );
}

function PpeSummaryTable({
  rows,
  edit = false,
  state,
  update,
}: {
  rows: PpeRow[];
  edit?: boolean;
  state?: StructuredState;
  update?: (path: string[], value: any) => void;
}) {
  const { currentHeading, priorHeading } = useNotesDisplay();

  return (
    <table
      style={{
        ...styles.table,
        width: "100%",
        tableLayout: "fixed",
      }}
    >
      <colgroup>
        <col style={{ width: "34%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
      </colgroup>

      <thead>
        <tr>
          <th style={styles.thLeft}>Class</th>
          <th style={styles.thRight}>{currentHeading} cost</th>
          <th style={styles.thRight}>{currentHeading} acc. dep.</th>
          <th style={styles.thRight}>{currentHeading} carrying</th>
          <th style={styles.thRight}>{priorHeading} cost</th>
          <th style={styles.thRight}>{priorHeading} acc. dep.</th>
          <th style={styles.thRight}>{priorHeading} carrying</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td style={styles.tdLeft}>
              {edit && String(row.key).startsWith("otherPpe") && update ? (
                <input
                  type="text"
                  value={row.label}
                  onChange={(event) =>
                    update(
                      ["ppeClassLabels", row.key],
                      event.target.value,
                    )
                  }
                  style={{
                    ...inputStyle(),
                    padding: "2px 4px",
                    fontSize: 10.2,
                  }}
                />
              ) : (
                displayNoteLineLabel(row.label)
              )}
            </td>
            <td style={styles.tdRight}>
              {amount(closingCost(row.current))}
            </td>
            <td style={styles.tdRight}>
              {amount(closingAccumulatedDepreciation(row.current))}
            </td>
            <td style={styles.tdRight}>
              {amount(carryingAmount(row.current))}
            </td>
            <td style={styles.tdRight}>
              {amount(closingCost(row.prior))}
            </td>
            <td style={styles.tdRight}>
              {amount(closingAccumulatedDepreciation(row.prior))}
            </td>
            <td style={styles.tdRight}>
              {amount(carryingAmount(row.prior))}
            </td>
          </tr>
        ))}

        <tr>
          <td data-total-label="true" style={styles.totalLabel}>
            Total
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(sumPpeRows(rows, "current", closingCost))}
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(
              sumPpeRows(
                rows,
                "current",
                closingAccumulatedDepreciation,
              ),
            )}
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(sumPpeRows(rows, "current", carryingAmount))}
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(sumPpeRows(rows, "prior", closingCost))}
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(
              sumPpeRows(
                rows,
                "prior",
                closingAccumulatedDepreciation,
              ),
            )}
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(sumPpeRows(rows, "prior", carryingAmount))}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function PpeMovementEditor({
  rows,
  year,
  movements,
  state,
  update,
  title,
  totalGetter,
}: {
  rows: PpeRow[];
  year: YearKey;
  movements: { key: PpeMovementKey; label: string }[];
  state: StructuredState;
  update: (path: string[], value: any) => void;
  title: string;
  totalGetter: (values: PpeValues) => number;
}) {
  return (
    <div style={styles.matrixScroll}>
      <table
        style={{
          ...styles.table,
          width: "100%",
          tableLayout: "fixed",
        }}
      >

        <colgroup>
  <col style={{ width: 190 }} />
  {movements.map((movement) => (
    <col key={movement.key} style={{ width: 62 }} />
  ))}
  <col style={{ width: 68 }} />
</colgroup>


        <thead>
          <tr>
            <th style={styles.thLeft}>{title}</th>
            {movements.map((movement) => (
              <th key={movement.key} style={styles.thRight}>
                {movement.label}
              </th>
            ))}
            <th style={styles.thRight}>Closing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${year}-${row.key}`}>
              <td
                style={{
                  ...styles.tdLeft,
                  width: 190,
                  minWidth: 190,
                  whiteSpace: "normal",
                  wordBreak: "normal",
                  overflowWrap: "normal",
                  lineHeight: 1.2,
                }}
              >
                {String(row.key).startsWith("otherPpe") ? (
                  <input
                    type="text"
                    value={row.label}
                    onChange={(event) =>
                      update(
                        ["ppeClassLabels", row.key],
                        event.target.value,
                      )
                    }
                    style={{
                      ...inputStyle(),
                      padding: "2px 4px",
                      fontSize: 10.2,
                    }}
                  />
                ) : (
                  displayNoteLineLabel(row.label)
                )}
              </td>
              {movements.map((movement) => (
                <PpeInput
                  key={movement.key}
                  row={row}
                  year={year}
                  movementKey={movement.key}
                  state={state}
                  update={update}
                />
              ))}
              <td style={styles.tdRight}>
                {amount(totalGetter(resolvedPpeRows([row], state)[0][year]))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PpeFinancialMovementTable({
  rows,
  year,
  title,
}: {
  rows: PpeRow[];
  year: YearKey;
  title: string;
}) {
  const movementValue = (
    values: PpeValues,
    key: PpeMovementKey,
    reverseSign = false,
  ) => {
    const value = toNumber(values?.[key]);
    return reverseSign ? -Math.abs(value) : value;
  };

  const openingCarryingAmount = (values: PpeValues) =>
    toNumber(values.openingCost) -
    toNumber(values.openingAccumulatedDepreciation);

  const tableRows = rows.map((row) => {
    const values = row[year] || {};

    return {
      key: row.key,
      label: displayNoteLineLabel(row.label),
      opening: openingCarryingAmount(values),
      additions: movementValue(values, "additions"),
      businessCombinations: movementValue(
        values,
        "additionsBusinessCombinations",
      ),
      disposals:
        -Math.abs(movementValue(values, "disposals")) +
        Math.abs(
          movementValue(
            values,
            "accumulatedDepreciationDisposals",
          ),
        ),
      transfers:
        movementValue(values, "transfers") -
        movementValue(values, "accumulatedDepreciationTransfers"),
      revaluations: movementValue(values, "revaluations"),
      depreciation: movementValue(values, "depreciation", true),
      impairment:
        -Math.abs(movementValue(values, "impairmentLosses")) +
        Math.abs(movementValue(values, "impairmentReversal")),
      other:
        movementValue(values, "foreignExchangeMovements") +
        movementValue(values, "decommissioningLiability") +
        movementValue(values, "otherMovements") -
        movementValue(
          values,
          "accumulatedDepreciationOtherMovements",
        ),
      closing: carryingAmount(values),
    };
  });

  const showBusinessCombinations = tableRows.some(
    (row) => Math.round(row.businessCombinations) !== 0,
  );

  const showDisposals = tableRows.some(
    (row) => Math.round(row.disposals) !== 0,
  );

  const showTransfers = tableRows.some(
    (row) => Math.round(row.transfers) !== 0,
  );

  const showRevaluations = tableRows.some(
    (row) => Math.round(row.revaluations) !== 0,
  );

  const showImpairment = tableRows.some(
    (row) => Math.round(row.impairment) !== 0,
  );

  const showOther = tableRows.some(
    (row) => Math.round(row.other) !== 0,
  );

  const total = (key: keyof (typeof tableRows)[number]) =>
    tableRows.reduce((sum, row) => {
      const value = row[key];
      return sum + (typeof value === "number" ? value : 0);
    }, 0);

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.thLeft}>{title}</th>

          <th style={styles.thRight}>Opening carrying</th>
          <th style={styles.thRight}>Additions</th>

          {showBusinessCombinations ? (
            <th style={styles.thRight}>Business comb.</th>
          ) : null}

          {showDisposals ? (
            <th style={styles.thRight}>Disposals</th>
          ) : null}

          {showTransfers ? (
            <th style={styles.thRight}>Transfers</th>
          ) : null}

          {showRevaluations ? (
            <th style={styles.thRight}>Revaluations</th>
          ) : null}

          <th style={styles.thRight}>Depreciation</th>

          {showImpairment ? (
            <th style={styles.thRight}>Impairment</th>
          ) : null}

          {showOther ? (
            <th style={styles.thRight}>Other</th>
          ) : null}

          <th style={styles.thRight}>Closing carrying</th>
        </tr>
      </thead>

      <tbody>
        {tableRows.map((row) => (
          <tr key={`${year}-${row.key}`}>
            <td style={styles.tdLeft}>{row.label}</td>

            <td style={styles.tdRight}>{amount(row.opening)}</td>
            <td style={styles.tdRight}>{amount(row.additions)}</td>

            {showBusinessCombinations ? (
              <td style={styles.tdRight}>
                {amount(row.businessCombinations)}
              </td>
            ) : null}

            {showDisposals ? (
              <td style={styles.tdRight}>{amount(row.disposals)}</td>
            ) : null}

            {showTransfers ? (
              <td style={styles.tdRight}>{amount(row.transfers)}</td>
            ) : null}

            {showRevaluations ? (
              <td style={styles.tdRight}>{amount(row.revaluations)}</td>
            ) : null}

            <td style={styles.tdRight}>
              {amount(row.depreciation)}
            </td>

            {showImpairment ? (
              <td style={styles.tdRight}>{amount(row.impairment)}</td>
            ) : null}

            {showOther ? (
              <td style={styles.tdRight}>{amount(row.other)}</td>
            ) : null}

            <td
  style={{
    ...styles.tdRight,
    fontWeight: 800,
  }}
>
  {amount(row.closing)}
</td>
          </tr>
        ))}

        <tr
  style={{
    borderBottom: "2px solid #111827",
  }}
>
          <td style={styles.totalLabel}>Total</td>

          <td style={styles.totalAmount}>
            {amount(total("opening"))}
          </td>

          <td style={styles.totalAmount}>
            {amount(total("additions"))}
          </td>

          {showBusinessCombinations ? (
            <td style={styles.totalAmount}>
              {amount(total("businessCombinations"))}
            </td>
          ) : null}

          {showDisposals ? (
            <td style={styles.totalAmount}>
              {amount(total("disposals"))}
            </td>
          ) : null}

          {showTransfers ? (
            <td style={styles.totalAmount}>
              {amount(total("transfers"))}
            </td>
          ) : null}

          {showRevaluations ? (
            <td style={styles.totalAmount}>
              {amount(total("revaluations"))}
            </td>
          ) : null}

          <td style={styles.totalAmount}>
            {amount(total("depreciation"))}
          </td>

          {showImpairment ? (
            <td style={styles.totalAmount}>
              {amount(total("impairment"))}
            </td>
          ) : null}

          {showOther ? (
            <td style={styles.totalAmount}>
              {amount(total("other"))}
            </td>
          ) : null}

          <td style={styles.totalAmount}>
  {amount(total("closing"))}
</td>
        </tr>
      </tbody>
    </table>
  );
}

function FragmentWithKey({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function CashNote({
  rows,
  edit,
  state,
  update,
}: {
  rows: AmountLine[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  return (
    <>
      <p style={styles.paragraph}>
        Cash and cash equivalents consist of the following:
      </p>
      <NoteTable
        rows={rows}
        edit={edit}
        state={state}
        stateKey="cash"
        update={update}
      />
      <EditableTextBlock
        label="Restricted cash / availability wording"
        value={state.cash?.restrictedText || ""}
        edit={edit}
        onChange={(value) => update(["cash", "restrictedText"], value)}
      />
      <EditableTextBlock
        label="Security / pledge wording"
        value={state.cash?.securityText || ""}
        edit={edit}
        onChange={(value) => update(["cash", "securityText"], value)}
      />
    </>
  );
}

type CashGeneratedLine = {
  key: string;
  label: string;
  group?: string;
  current: number;
  prior: number;
  calculated?: boolean;
  strong?: boolean;
};

function cashGeneratedInputValue(
  state: StructuredState,
  key: string,
  year: YearKey,
) {
  const raw = state.cashGeneratedFromOperations?.values?.[key]?.[year];
  return raw === undefined || raw === null ? "" : String(raw);
}

function cashGeneratedStoredAmount(
  state: StructuredState,
  key: string,
  year: YearKey,
  fallback = 0,
) {
  const raw = state.cashGeneratedFromOperations?.values?.[key]?.[year];
  if (raw === undefined || raw === null || raw === "") return fallback;
  return toNumber(raw);
}

function findProfitBeforeTaxRow(rows: AmountLine[]) {
  return (
    rows.find((row) => {
      const label = String(row.label || "").toLowerCase();
      return label.includes("profit") && label.includes("tax");
    }) || rows[0]
  );
}

function CashGeneratedAmountCell({
  line,
  year,
  edit,
  state,
  update,
}: {
  line: CashGeneratedLine;
  year: YearKey;
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const automaticCurrentYearKeys = new Set([
    "adjustments",
    "depreciationAmortisationImpairment",
    "lossOnSaleAssetsLiabilities",
    "fairValueGainsLosses",
    "movementProvisions",
    "otherNonCash1",
    "investmentIncome",
    "financeCosts",
    "inventories",
    "tradeReceivables",
    "prepayments",
    "tradePayables",
    "deferredIncome",
  ]);

  const isAutomaticCurrentYear =
    year === "current" &&
    (
      line.calculated ||
      line.key === "profitBeforeTax" ||
      automaticCurrentYearKeys.has(line.key)
    );

  const savedValue = cashGeneratedInputValue(
    state,
    line.key,
    year,
  );

  const displayedValue =
    savedValue !== undefined &&
    savedValue !== null &&
    String(savedValue).trim() !== ""
      ? savedValue
      : line[year] || "";

  if (!edit || isAutomaticCurrentYear) {
    return (
      <td style={line.strong ? styles.totalAmount : styles.tdRight}>
        {amount(line[year])}
      </td>
    );
  }

  return (
    <td style={styles.tdRight}>
      <input
        type="text"
        inputMode="decimal"
        value={displayedValue}
        onChange={(event) =>
          update(
            [
              "cashGeneratedFromOperations",
              "values",
              line.key,
              year,
            ],
            event.target.value,
          )
        }
        style={numberInputStyle()}
      />
    </td>
  );
}

function CashUsedInOperationsNote({
  rows,
  edit,
  state,
  update,
}: {
  rows: AmountLine[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const { currentHeading, priorHeading, hideComparatives } = useNotesDisplay();
  const profitRow = findProfitBeforeTaxRow(rows);
  const profitCurrent = toNumber(profitRow?.current);
  const profitPrior = toNumber(profitRow?.prior);

  const fallbackAmount = (terms: string[], year: YearKey) =>
    toNumber(rowByIdOrLabel(rows, terms)?.[year]);

  const nonCashLines: CashGeneratedLine[] = [
    {
      key: "adjustments",
      label: "Adjustments for non-cash and other items",
      group: "Adjustments for non-cash items:",
      current: cashGeneratedStoredAmount(
        state,
        "adjustments",
        "current",
        fallbackAmount(["adjustments"], "current"),
      ),
      prior: cashGeneratedStoredAmount(
        state,
        "adjustments",
        "prior",
        fallbackAmount(["adjustments"], "prior"),
      ),
    },
    {
      key: "depreciationAmortisationImpairment",
      label:
        "Depreciation, amortisation, impairments and reversals of impairments",
      group: "Adjustments for non-cash items:",
      current: cashGeneratedStoredAmount(
        state,
        "depreciationAmortisationImpairment",
        "current",
      ),
      prior: cashGeneratedStoredAmount(
        state,
        "depreciationAmortisationImpairment",
        "prior",
      ),
    },
    {
      key: "lossOnSaleAssetsLiabilities",
      label: "Loss on sale of assets and liabilities",
      group: "Adjustments for non-cash items:",
      current: cashGeneratedStoredAmount(state, "lossOnSaleAssetsLiabilities", "current"),
      prior: cashGeneratedStoredAmount(state, "lossOnSaleAssetsLiabilities", "prior"),
    },
    {
      key: "fairValueGainsLosses",
      label: "Fair value (gains) losses",
      group: "Adjustments for non-cash items:",
      current: cashGeneratedStoredAmount(state, "fairValueGainsLosses", "current"),
      prior: cashGeneratedStoredAmount(state, "fairValueGainsLosses", "prior"),
    },
    {
      key: "movementProvisions",
      label: "Movement in provisions",
      group: "Adjustments for non-cash items:",
      current: cashGeneratedStoredAmount(state, "movementProvisions", "current"),
      prior: cashGeneratedStoredAmount(state, "movementProvisions", "prior"),
    },
    {
      key: "otherNonCash1",
      label: "Other non-cash item included in profit or loss",
      group: "Adjustments for non-cash items:",
      current: cashGeneratedStoredAmount(state, "otherNonCash1", "current"),
      prior: cashGeneratedStoredAmount(state, "otherNonCash1", "prior"),
    },
  ];

  const separateItems: CashGeneratedLine[] = [
    {
      key: "investmentIncome",
      label: "Investment income",
      group: "Adjust for items which are presented separately:",
      current: cashGeneratedStoredAmount(state, "investmentIncome", "current"),
      prior: cashGeneratedStoredAmount(state, "investmentIncome", "prior"),
    },
    {
      key: "financeCosts",
      label: "Finance costs",
      group: "Adjust for items which are presented separately:",
      current: cashGeneratedStoredAmount(state, "financeCosts", "current"),
      prior: cashGeneratedStoredAmount(state, "financeCosts", "prior"),
    },
  ];

  const workingCapitalLines: CashGeneratedLine[] = [
    {
      key: "inventories",
      label: "(Increase) decrease in inventories",
      group: "Changes in working capital:",
      current: cashGeneratedStoredAmount(
        state,
        "inventories",
        "current",
        fallbackAmount(["inventories"], "current"),
      ),
      prior: cashGeneratedStoredAmount(
        state,
        "inventories",
        "prior",
        fallbackAmount(["inventories"], "prior"),
      ),
    },
    {
      key: "tradeReceivables",
      label: "(Increase) decrease in trade and other receivables",
      group: "Changes in working capital:",
      current: cashGeneratedStoredAmount(
        state,
        "tradeReceivables",
        "current",
        fallbackAmount(["trade", "receivables"], "current"),
      ),
      prior: cashGeneratedStoredAmount(
        state,
        "tradeReceivables",
        "prior",
        fallbackAmount(["trade", "receivables"], "prior"),
      ),
    },
    {
      key: "prepayments",
      label: "(Increase) decrease in prepayments",
      group: "Changes in working capital:",
      current: cashGeneratedStoredAmount(state, "prepayments", "current"),
      prior: cashGeneratedStoredAmount(state, "prepayments", "prior"),
    },
    {
      key: "tradePayables",
      label: "Increase (decrease) in trade and other payables",
      group: "Changes in working capital:",
      current: cashGeneratedStoredAmount(
        state,
        "tradePayables",
        "current",
        fallbackAmount(["trade", "payables"], "current"),
      ),
      prior: cashGeneratedStoredAmount(
        state,
        "tradePayables",
        "prior",
        fallbackAmount(["trade", "payables"], "prior"),
      ),
    },
    {
      key: "deferredIncome",
      label: "Increase (decrease) in deferred income",
      group: "Changes in working capital:",
      current: cashGeneratedStoredAmount(state, "deferredIncome", "current"),
      prior: cashGeneratedStoredAmount(state, "deferredIncome", "prior"),
    },
  ];

  const detailLines: CashGeneratedLine[] = [
    {
      key: "profitBeforeTax",
      label: "Net profit before taxation",
      current: profitCurrent,
      prior: profitPrior,
    },
    ...nonCashLines,
    ...separateItems,
    ...workingCapitalLines,
  ];

  const cashGeneratedCurrent = detailLines.reduce(
    (sum, line) => sum + toNumber(line.current),
    0,
  );
  const cashGeneratedPrior = detailLines.reduce(
    (sum, line) => sum + toNumber(line.prior),
    0,
  );

  const finalLine: CashGeneratedLine = {
    key: "cashGeneratedFromOperations",
    label: "Cash generated from operations",
    current: cashGeneratedCurrent,
    prior: cashGeneratedPrior,
    calculated: true,
    strong: true,
  };

  const printableLines = edit
    ? [...detailLines, finalLine]
    : [
        ...detailLines.filter(
          (line) =>
            line.key === "profitBeforeTax" ||
            roundAmount(line.current) !== 0 ||
            roundAmount(line.prior) !== 0,
        ),
        finalLine,
      ];

  let lastGroup = "";

  return (
    <table style={styles.table}>
      <colgroup>
        <col style={{ width: "auto" }} />
        <col style={{ width: 76 }} />
        {!hideComparatives ? <col style={{ width: 76 }} /> : null}
      </colgroup>
      <thead>
        <tr>
          <th style={styles.thLeft}>Description</th>
          <th style={styles.thRight}>{currentHeading}</th>
          {!hideComparatives ? (
            <th style={styles.thRight}>{priorHeading}</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {printableLines.map((line) => {
          const showGroup = line.group && line.group !== lastGroup;
          if (line.group) lastGroup = line.group;

          return (
            <FragmentWithKey key={line.key}>
              {showGroup ? (
                <tr>
                  <td style={styles.cashGroupHeading} colSpan={hideComparatives ? 2 : 3}>
                    {line.group}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td style={line.strong ? styles.totalLabel : styles.tdLeft}>
                  {displayNoteLineLabel(line.label)}
                  {edit &&
                  !line.calculated &&
                  line.key !== "profitBeforeTax" ? (
                    <div style={styles.cashEditHint}>editable</div>
                  ) : null}
                </td>
                <CashGeneratedAmountCell
                  line={line}
                  year="current"
                  edit={edit}
                  state={state}
                  update={update}
                />
                {!hideComparatives ? (
                  <CashGeneratedAmountCell
                    line={line}
                    year="prior"
                    edit={edit}
                    state={state}
                    update={update}
                  />
                ) : null}
              </tr>
            </FragmentWithKey>
          );
        })}
      </tbody>
    </table>
  );
}

function isOtherFinancialLiabilityLine(line: any) {
  /*
    Mapping-driven only:
    590 / 500.590 = other non-current financial liabilities.
    These are not shareholder loans and must never be auto-subordinated.
  */
  return mappingStartsWith(line, ["590", "500.590"]);
}

function otherFinancialLiabilityLabel(line: any) {
  return (
    clean(line.account_name) ||
    clean(line.description) ||
    clean(line.mapping_label) ||
    clean(line.mapping_category) ||
    "Other non-current financial liability"
  );
}

function otherFinancialLiabilityLineKey(line: any, index: number) {
  return String(
    line.id ||
      line.account_code ||
      line.account_name ||
      line.mapping_leaf_id ||
      line.mapping_code ||
      `other-financial-liability-${index}`,
  );
}

function buildOtherFinancialLiabilityDetailRows(
  trialBalanceLines: any[],
  fallbackRows: AmountLine[],
): AmountLine[] {
  const grouped = new Map<string, AmountLine>();

  (trialBalanceLines || [])
    .filter(isOtherFinancialLiabilityLine)
    .forEach((line, index) => {
      const current = normaliseLoanAmount(lineAmount(line, "current"));
      const prior = normaliseLoanAmount(lineAmount(line, "prior"));
      if (current === 0 && prior === 0) return;

      const label = otherFinancialLiabilityLabel(line);
      const key = otherFinancialLiabilityLineKey(line, index);

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          label,
          current: 0,
          prior: 0,
          meta: { source: "trialBalanceLine", noteFamily: "otherFinancialLiabilities" },
        });
      }

      const row = grouped.get(key);
      if (!row) return;
      row.current += current;
      row.prior += prior;
    });

  const detailRows = Array.from(grouped.values()).filter(
    (row) => roundAmount(row.current) !== 0 || roundAmount(row.prior) !== 0,
  );

  if (detailRows.length > 0) {
    return detailRows.sort((a, b) => a.label.localeCompare(b.label));
  }

  return fallbackRows;
}

function OtherFinancialLiabilitiesNote({
  rows,
  trialBalanceLines,
  edit,
  state,
  update,
}: {
  rows: AmountLine[];
  trialBalanceLines: any[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const { currentHeading, priorHeading, hideComparatives } = useNotesDisplay();
  const visibleRows = splitRows(
    buildSharedOtherFinancialLiabilityRows(trialBalanceLines, rows),
  );
  const totalCurrent = visibleRows.reduce(
    (sum, row) => sum + toNumber(row.current),
    0,
  );
  const totalPrior = visibleRows.reduce(
    (sum, row) => sum + toNumber(row.prior),
    0,
  );

  if (visibleRows.length === 0 && !edit) return null;

  return (
    <>
      <table style={styles.table}>
        <colgroup>
          <col style={{ width: "auto" }} />
          <col style={{ width: 76 }} />
          {!hideComparatives ? <col style={{ width: 76 }} /> : null}
        </colgroup>
        <thead>
          <tr>
            <th style={styles.thLeft}>Description</th>
            <th style={styles.thRight}>{currentHeading}</th>
            {!hideComparatives ? (
              <th style={styles.thRight}>{priorHeading}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => {
            const key = row.id || row.label || String(index);
            const savedLabel = state.otherFinancialLiabilities?.[key]?.label || "";
            const displayLabel = savedLabel || row.label;
            const savedTerms =
  state.otherFinancialLiabilities?.[key]?.terms;

const terms =
  savedTerms !== undefined
    ? String(savedTerms)
    : "The liability is unsecured, bears no interest and has no fixed repayment terms.";
            const interest = state.otherFinancialLiabilities?.[key]?.interest || "";
            const repayment = state.otherFinancialLiabilities?.[key]?.repayment || "";
            const security = state.otherFinancialLiabilities?.[key]?.security || "";
            const relationship = state.otherFinancialLiabilities?.[key]?.relationship || "";

            return (
              <FragmentWithKey key={key}>
                <tr>
                  <td style={styles.tdLeft}>
                    {edit ? (
                      <input
                        value={displayLabel}
                        onChange={(event) =>
                          update(
                            ["otherFinancialLiabilities", key, "label"],
                            event.target.value,
                          )
                        }
                        style={inputStyle()}
                      />
                    ) : (
                      displayLabel
                    )}
                  </td>
                  <td style={styles.tdRight}>{amount(row.current)}</td>
                  {!hideComparatives ? (
                    <td style={styles.tdRight}>{amount(row.prior)}</td>
                  ) : null}
                </tr>
                <tr>
                  <td colSpan={hideComparatives ? 2 : 3} style={styles.loanTermsCell}>
                    {edit ? (
                      <div style={styles.loanTermsGrid}>
                        <label>
                          <span style={styles.smallLabel}>
                            Terms for {displayLabel}
                          </span>
                          <input
                            value={terms}
                            onChange={(event) =>
                              update(
                                ["otherFinancialLiabilities", key, "terms"],
                                event.target.value,
                              )
                            }
                            style={inputStyle()}
                          />
                        </label>
                        <label>
                          <span style={styles.smallLabel}>Relationship / lender type</span>
                          <input
                            value={relationship}
                            onChange={(event) =>
                              update(
                                ["otherFinancialLiabilities", key, "relationship"],
                                event.target.value,
                              )
                            }
                            style={inputStyle()}
                          />
                        </label>
                        <label>
                          <span style={styles.smallLabel}>Interest</span>
                          <input
                            value={interest}
                            onChange={(event) =>
                              update(
                                ["otherFinancialLiabilities", key, "interest"],
                                event.target.value,
                              )
                            }
                            style={inputStyle()}
                          />
                        </label>
                        <label>
                          <span style={styles.smallLabel}>Repayment</span>
                          <input
                            value={repayment}
                            onChange={(event) =>
                              update(
                                ["otherFinancialLiabilities", key, "repayment"],
                                event.target.value,
                              )
                            }
                            style={inputStyle()}
                          />
                        </label>
                        <label>
                          <span style={styles.smallLabel}>Security</span>
                          <input
                            value={security}
                            onChange={(event) =>
                              update(
                                ["otherFinancialLiabilities", key, "security"],
                                event.target.value,
                              )
                            }
                            style={inputStyle()}
                          />
                        </label>
                      </div>
                    ) : (
                      <div>
                        {relationship ? (
                          <p style={styles.paragraph}>Relationship / lender type: {relationship}</p>
                        ) : null}
                        {terms ? <p style={styles.paragraph}>{terms}</p> : null}
                        {interest ? (
                          <p style={styles.paragraph}>Interest: {interest}</p>
                        ) : null}
                        {repayment ? (
                          <p style={styles.paragraph}>
                            Repayment terms: {repayment}
                          </p>
                        ) : null}
                        {security ? (
                          <p style={styles.paragraph}>Security: {security}</p>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              </FragmentWithKey>
            );
          })}
          <tr>
            <td data-total-label="true" style={styles.totalLabel}>
              &nbsp;
            </td>
            <td data-total-amount="true" style={styles.totalAmount}>
              {amount(totalCurrent)}
            </td>
            {!hideComparatives ? (
              <td data-total-amount="true" style={styles.totalAmount}>
                {amount(totalPrior)}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>

      {edit ? (
        <EditableTextBlock
          label="Additional disclosure wording"
          value={state.otherFinancialLiabilities?.extraText || ""}
          edit
          onChange={(value) =>
            update(["otherFinancialLiabilities", "extraText"], value)
          }
        />
      ) : state.otherFinancialLiabilities?.extraText ? (
        <p style={styles.paragraph}>
          {state.otherFinancialLiabilities.extraText}
        </p>
      ) : null}
    </>
  );
}


function MappedBorrowingNote({
  rows,
  trialBalanceLines,
  edit,
  state,
  update,
  stateKey,
  buildRows,
  defaultTerms,
  relationshipLabel = "Lender / facility type",
}: {
  rows: AmountLine[];
  trialBalanceLines: any[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
  stateKey: string;
  buildRows: (trialBalanceLines: any[], fallbackRows?: AmountLine[]) => AmountLine[];
  defaultTerms: string;
  relationshipLabel?: string;
}) {
  const { currentHeading, priorHeading, hideComparatives } = useNotesDisplay();
  const visibleRows = splitRows(buildRows(trialBalanceLines, rows));
  const totalCurrent = visibleRows.reduce(
    (sum, row) => sum + toNumber(row.current),
    0,
  );
  const totalPrior = visibleRows.reduce(
    (sum, row) => sum + toNumber(row.prior),
    0,
  );

  if (visibleRows.length === 0 && !edit) return null;

  return (
    <>
      <table style={styles.table}>
        <colgroup>
          <col style={{ width: "auto" }} />
          <col style={{ width: 76 }} />
          {!hideComparatives ? <col style={{ width: 76 }} /> : null}
        </colgroup>
        <thead>
          <tr>
            <th style={styles.thLeft}>Description</th>
            <th style={styles.thRight}>{currentHeading}</th>
            {!hideComparatives ? (
              <th style={styles.thRight}>{priorHeading}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => {
            const key = row.id || row.label || String(index);
            const familyState = state?.[stateKey] || {};
            const savedLabel = familyState?.[key]?.label;
            const displayLabel =
              savedLabel !== undefined ? String(savedLabel) : row.label;

            const savedTerms = familyState?.[key]?.terms;
            const terms =
              savedTerms !== undefined ? String(savedTerms) : defaultTerms;

            const savedRelationship = familyState?.[key]?.relationship;
            const relationship =
              savedRelationship !== undefined ? String(savedRelationship) : "";

            const interest = familyState?.[key]?.interest || "";
            const repayment = familyState?.[key]?.repayment || "";
            const security = familyState?.[key]?.security || "";

            return (
              <FragmentWithKey key={key}>
                <tr>
                  <td style={styles.tdLeft}>
                    {edit ? (
                      <input
                        value={displayLabel}
                        onChange={(event) =>
                          update([stateKey, key, "label"], event.target.value)
                        }
                        style={inputStyle()}
                      />
                    ) : (
                      displayLabel
                    )}
                  </td>
                  <td style={styles.tdRight}>{amount(row.current)}</td>
                  {!hideComparatives ? (
                    <td style={styles.tdRight}>{amount(row.prior)}</td>
                  ) : null}
                </tr>
                <tr>
                  <td
                    colSpan={hideComparatives ? 2 : 3}
                    style={styles.loanTermsCell}
                  >
                    {edit ? (
                      <div style={styles.loanTermsGrid}>
                        <label>
                          <span style={styles.smallLabel}>
                            Terms for {displayLabel}
                          </span>
                          <input
                            value={terms}
                            onChange={(event) =>
                              update([stateKey, key, "terms"], event.target.value)
                            }
                            style={inputStyle()}
                          />
                        </label>

                        <label>
                          <span style={styles.smallLabel}>
                            {relationshipLabel}
                          </span>
                          <input
                            value={relationship}
                            onChange={(event) =>
                              update(
                                [stateKey, key, "relationship"],
                                event.target.value,
                              )
                            }
                            style={inputStyle()}
                          />
                        </label>

                        <label>
                          <span style={styles.smallLabel}>Interest</span>
                          <input
                            value={interest}
                            onChange={(event) =>
                              update(
                                [stateKey, key, "interest"],
                                event.target.value,
                              )
                            }
                            style={inputStyle()}
                          />
                        </label>

                        <label>
                          <span style={styles.smallLabel}>Repayment</span>
                          <input
                            value={repayment}
                            onChange={(event) =>
                              update(
                                [stateKey, key, "repayment"],
                                event.target.value,
                              )
                            }
                            style={inputStyle()}
                          />
                        </label>

                        <label>
                          <span style={styles.smallLabel}>Security</span>
                          <input
                            value={security}
                            onChange={(event) =>
                              update(
                                [stateKey, key, "security"],
                                event.target.value,
                              )
                            }
                            style={inputStyle()}
                          />
                        </label>
                      </div>
                    ) : (
                      <div>
                        {relationship ? (
                          <p style={styles.paragraph}>
                            {relationshipLabel}: {relationship}
                          </p>
                        ) : null}
                        {terms ? <p style={styles.paragraph}>{terms}</p> : null}
                        {interest ? (
                          <p style={styles.paragraph}>Interest: {interest}</p>
                        ) : null}
                        {repayment ? (
                          <p style={styles.paragraph}>
                            Repayment terms: {repayment}
                          </p>
                        ) : null}
                        {security ? (
                          <p style={styles.paragraph}>Security: {security}</p>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              </FragmentWithKey>
            );
          })}

          {visibleRows.length > 0 ? (
            <tr>
              <td data-total-label="true" style={styles.totalLabel}>
                &nbsp;
              </td>
              <td data-total-amount="true" style={styles.totalAmount}>
                {amount(totalCurrent)}
              </td>
              {!hideComparatives ? (
                <td data-total-amount="true" style={styles.totalAmount}>
                  {amount(totalPrior)}
                </td>
              ) : null}
            </tr>
          ) : null}
        </tbody>
      </table>

      {edit ? (
        <EditableTextBlock
          label="Additional disclosure wording"
          value={state?.[stateKey]?.extraText || ""}
          edit
          onChange={(value) => update([stateKey, "extraText"], value)}
        />
      ) : state?.[stateKey]?.extraText ? (
        <p style={styles.paragraph}>{state[stateKey].extraText}</p>
      ) : null}
    </>
  );
}

function AssetFinanceNote(props: {
  rows: AmountLine[];
  trialBalanceLines: any[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  return (
    <MappedBorrowingNote
      {...props}
      stateKey="assetFinance"
      buildRows={buildSharedAssetFinanceRows}
      defaultTerms="The asset finance liability is recognised in accordance with the underlying finance agreement."
      relationshipLabel="Financier / facility type"
    />
  );
}

function BankOverdraftNote(props: {
  rows: AmountLine[];
  trialBalanceLines: any[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  return (
    <MappedBorrowingNote
      {...props}
      stateKey="bankOverdraft"
      buildRows={buildSharedBankOverdraftRows}
      defaultTerms="The bank overdraft is repayable in accordance with the banking facility terms."
      relationshipLabel="Bank / facility type"
    />
  );
}

function ShareholderLoansNote({
  rows,
  trialBalanceLines,
  edit,
  state,
  update,
}: {
  rows: AmountLine[];
  trialBalanceLines: any[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const { currentHeading, priorHeading, hideComparatives } = useNotesDisplay();
  const visibleRows = splitRows(
    buildSharedShareholderLoanRows(trialBalanceLines, rows),
  );
  const totalCurrent = visibleRows.reduce(
    (sum, row) => sum + toNumber(row.current),
    0,
  );
  const totalPrior = visibleRows.reduce(
    (sum, row) => sum + toNumber(row.prior),
    0,
  );

  if (visibleRows.length === 0 && !edit) return null;

  return (
    <table style={styles.table}>
      <colgroup>
        <col style={{ width: "auto" }} />
        <col style={{ width: 76 }} />
        {!hideComparatives ? <col style={{ width: 76 }} /> : null}
      </colgroup>
      <thead>
        <tr>
          <th style={styles.thLeft}>Description</th>
          <th style={styles.thRight}>{currentHeading}</th>
          {!hideComparatives ? (
            <th style={styles.thRight}>{priorHeading}</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {visibleRows.map((row, index) => {
          const key = row.id || row.label || String(index);
          const savedLabel = state.shareholderLoans?.[key]?.label || "";
          const displayLabel = savedLabel || row.label;
          const savedTerms = state.shareholderLoans?.[key]?.terms;
          const terms =
            savedTerms !== undefined
              ? String(savedTerms)
              : "The loan is unsecured, bears no interest and has no fixed repayment terms.";
          const interest = state.shareholderLoans?.[key]?.interest || "";
          const repayment = state.shareholderLoans?.[key]?.repayment || "";
          const security = state.shareholderLoans?.[key]?.security || "";
          const savedRelationship = state.shareholderLoans?.[key]?.relationship;
          const relationship =
            savedRelationship !== undefined
              ? String(savedRelationship)
              : "Shareholder / director / member";

          return (
            <FragmentWithKey key={key}>
              <tr>
                <td style={styles.tdLeft}>
                  {edit ? (
                    <input
                      value={displayLabel}
                      onChange={(event) =>
                        update(
                          ["shareholderLoans", key, "label"],
                          event.target.value,
                        )
                      }
                      style={inputStyle()}
                    />
                  ) : (
                    displayLabel
                  )}
                </td>
                <td style={styles.tdRight}>{amount(row.current)}</td>
                {!hideComparatives ? (
                  <td style={styles.tdRight}>{amount(row.prior)}</td>
                ) : null}
              </tr>
              <tr>
                <td colSpan={hideComparatives ? 2 : 3} style={styles.loanTermsCell}>
                  {edit ? (
                    <div style={styles.loanTermsGrid}>
                      <label>
                        <span style={styles.smallLabel}>
                          Terms for {displayLabel}
                        </span>
                        <input
                          value={terms}
                          onChange={(event) =>
                            update(
                              ["shareholderLoans", key, "terms"],
                              event.target.value,
                            )
                          }
                          style={inputStyle()}
                        />
                      </label>
                      <label>
                        <span style={styles.smallLabel}>Relationship / lender type</span>
                        <input
                          value={relationship}
                          onChange={(event) =>
                            update(
                              ["shareholderLoans", key, "relationship"],
                              event.target.value,
                            )
                          }
                          style={inputStyle()}
                        />
                      </label>
                      <label>
                        <span style={styles.smallLabel}>Interest</span>
                        <input
                          value={interest}
                          onChange={(event) =>
                            update(
                              ["shareholderLoans", key, "interest"],
                              event.target.value,
                            )
                          }
                          style={inputStyle()}
                        />
                      </label>
                      <label>
                        <span style={styles.smallLabel}>Repayment</span>
                        <input
                          value={repayment}
                          onChange={(event) =>
                            update(
                              ["shareholderLoans", key, "repayment"],
                              event.target.value,
                            )
                          }
                          style={inputStyle()}
                        />
                      </label>
                      <label>
                        <span style={styles.smallLabel}>Security</span>
                        <input
                          value={security}
                          onChange={(event) =>
                            update(
                              ["shareholderLoans", key, "security"],
                              event.target.value,
                            )
                          }
                          style={inputStyle()}
                        />
                      </label>
                    </div>
                  ) : (
                    <div>
                      {relationship ? (
                        <p style={styles.paragraph}>
                          Relationship / lender type: {relationship}
                        </p>
                      ) : null}
                      {terms ? <p style={styles.paragraph}>{terms}</p> : null}
                      {interest ? (
                        <p style={styles.paragraph}>Interest: {interest}</p>
                      ) : null}
                      {repayment ? (
                        <p style={styles.paragraph}>
                          Repayment terms: {repayment}
                        </p>
                      ) : null}
                      {security ? (
                        <p style={styles.paragraph}>Security: {security}</p>
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            </FragmentWithKey>
          );
        })}
        <tr>
          <td data-total-label="true" style={styles.totalLabel}>
            &nbsp;
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(totalCurrent)}
          </td>
          {!hideComparatives ? (
            <td data-total-amount="true" style={styles.totalAmount}>
              {amount(totalPrior)}
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  );
}

function ShareCapitalNote({
  rows,
  edit,
  state,
  update,
  clientSetup,
}: {
  rows: AmountLine[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
  clientSetup: Record<string, any> | null;
}) {
  const { currentHeading, priorHeading, hideComparatives } = useNotesDisplay();
  const authorisedShares =
    state.shareCapital?.authorisedShares ||
    clean(clientSetup?.authorised_ordinary_shares) ||
    "100";
  const authorisedPar =
    state.shareCapital?.authorisedPar ||
    clean(clientSetup?.authorised_ordinary_share_par_value) ||
    "1";
  const issuedShares =
    state.shareCapital?.issuedShares ||
    clean(clientSetup?.issued_ordinary_shares) ||
    "100";
  const issuedPar =
    state.shareCapital?.issuedPar ||
    clean(clientSetup?.issued_ordinary_share_par_value) ||
    "1";
  const rightsText =
    state.shareCapital?.rightsText ||
    "The shares rank equally with regard to voting rights and dividends.";
  const mappedCurrent = rows.reduce(
  (sum, row) => sum + toNumber(row.current),
  0,
);

const mappedPrior = rows.reduce(
  (sum, row) => sum + toNumber(row.prior),
  0,
);

const issuedAmount = Number(issuedShares || 0) * Number(issuedPar || 0);

/*
  Share-capital disclosure remains one 805 note family,
  but individual equity classes are identified by controlled mapping code.
*/
const ordinaryShareCapitalRow = rows.find(
  (row) => String(row.id || "").trim() === "805.10",
);

const sharePremiumRow = rows.find(
  (row) => String(row.id || "").trim() === "805.20",
);

const ownerContributionRow = rows.find(
  (row) => String(row.id || "").trim() === "805.30",
);

const preferenceShareRow = rows.find(
  (row) => String(row.id || "").trim() === "805.40",
);

const treasuryShareRow = rows.find(
  (row) => String(row.id || "").trim() === "805.90",
);

const ordinaryShareCapitalCurrent =
  ordinaryShareCapitalRow !== undefined
    ? toNumber(ordinaryShareCapitalRow.current)
    : issuedAmount;

const ordinaryShareCapitalPrior =
  ordinaryShareCapitalRow !== undefined
    ? toNumber(ordinaryShareCapitalRow.prior)
    : issuedAmount;

const sharePremiumCurrent = toNumber(sharePremiumRow?.current);
const sharePremiumPrior = toNumber(sharePremiumRow?.prior);

  return (
    <>
      {edit ? (
        <div style={styles.editGrid}>
          <label>
            <span style={styles.smallLabel}>Authorised ordinary shares</span>
            <input
              value={authorisedShares}
              onChange={(event) =>
                update(["shareCapital", "authorisedShares"], event.target.value)
              }
              style={inputStyle()}
            />
          </label>
          <label>
            <span style={styles.smallLabel}>Authorised par value</span>
            <input
              value={authorisedPar}
              onChange={(event) =>
                update(["shareCapital", "authorisedPar"], event.target.value)
              }
              style={inputStyle()}
            />
          </label>
          <label>
            <span style={styles.smallLabel}>Issued ordinary shares</span>
            <input
              value={issuedShares}
              onChange={(event) =>
                update(["shareCapital", "issuedShares"], event.target.value)
              }
              style={inputStyle()}
            />
          </label>
          <label>
            <span style={styles.smallLabel}>Issued par value</span>
            <input
              value={issuedPar}
              onChange={(event) =>
                update(["shareCapital", "issuedPar"], event.target.value)
              }
              style={inputStyle()}
            />
          </label>
        </div>
      ) : null}

      <table style={styles.table}>
        <colgroup>
          <col style={{ width: "auto" }} />
          <col style={{ width: 76 }} />
          {!hideComparatives ? <col style={{ width: 76 }} /> : null}
        </colgroup>
        <thead>
          <tr>
            <th style={styles.thLeft}>Description</th>
            <th style={styles.thRight}>{currentHeading}</th>
            {!hideComparatives ? (
              <th style={styles.thRight}>{priorHeading}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={styles.subheading} colSpan={hideComparatives ? 2 : 3}>
              Authorised
            </td>
          </tr>
          <tr>
            <td style={styles.tdLeft}>
              {authorisedShares} ordinary shares of R{authorisedPar} each
            </td>
            <td style={styles.tdRight}>
              {amount(
                Number(authorisedShares || 0) * Number(authorisedPar || 0),
              )}
            </td>
            {!hideComparatives ? (
              <td style={styles.tdRight}>
                {amount(
                  Number(authorisedShares || 0) * Number(authorisedPar || 0),
                )}
              </td>
            ) : null}
          </tr>
          <tr>
  <td style={styles.subheading} colSpan={hideComparatives ? 2 : 3}>
    Issued
  </td>
</tr>

<tr>
  <td style={styles.tdLeft}>
    {Number(issuedShares || 0).toLocaleString("en-ZA")} ordinary shares issued
  </td>
  <td style={styles.tdRight}>
    {amount(ordinaryShareCapitalCurrent)}
  </td>
  {!hideComparatives ? (
    <td style={styles.tdRight}>
      {amount(ordinaryShareCapitalPrior)}
    </td>
  ) : null}
</tr>

{sharePremiumRow ? (
  <tr>
    <td style={styles.tdLeft}>Share premium</td>
    <td style={styles.tdRight}>
      {amount(sharePremiumCurrent)}
    </td>
    {!hideComparatives ? (
      <td style={styles.tdRight}>
        {amount(sharePremiumPrior)}
      </td>
    ) : null}
  </tr>
) : null}

{ownerContributionRow ? (
  <tr>
    <td style={styles.tdLeft}>Members / owners contributions</td>
    <td style={styles.tdRight}>
      {amount(ownerContributionRow.current)}
    </td>
    {!hideComparatives ? (
      <td style={styles.tdRight}>
        {amount(ownerContributionRow.prior)}
      </td>
    ) : null}
  </tr>
) : null}

{preferenceShareRow ? (
  <tr>
    <td style={styles.tdLeft}>Preference shares classified as equity</td>
    <td style={styles.tdRight}>
      {amount(preferenceShareRow.current)}
    </td>
    {!hideComparatives ? (
      <td style={styles.tdRight}>
        {amount(preferenceShareRow.prior)}
      </td>
    ) : null}
  </tr>
) : null}

{treasuryShareRow ? (
  <tr>
    <td style={styles.tdLeft}>Treasury / own shares</td>
    <td style={styles.tdRight}>
      {amount(treasuryShareRow.current)}
    </td>
    {!hideComparatives ? (
      <td style={styles.tdRight}>
        {amount(treasuryShareRow.prior)}
      </td>
    ) : null}
  </tr>
) : null}

<tr>
  <td style={styles.totalLabel}>
    Total share capital and contributions
  </td>
  <td data-total-amount="true" style={styles.totalAmount}>
    {amount(mappedCurrent)}
  </td>
  {!hideComparatives ? (
    <td data-total-amount="true" style={styles.totalAmount}>
      {amount(mappedPrior)}
    </td>
  ) : null}
</tr>
        </tbody>
      </table>

      <EditableTextBlock
        label="Rights, restrictions and preferences"
        value={rightsText}
        edit={edit}
        onChange={(value) => update(["shareCapital", "rightsText"], value)}
      />
    </>
  );
}

function TaxationNote({
  rows,
  edit,
  state,
  update,
  clientSetup,
  cashUsedInOperationsRows,
  currentTaxReceivableRows = [],
  currentTaxPayableRows = [],
}: {
  rows: AmountLine[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
  clientSetup: Record<string, any> | null;
  cashUsedInOperationsRows: AmountLine[];
  currentTaxReceivableRows?: AmountLine[];
  currentTaxPayableRows?: AmountLine[];
}) {
  const { hideComparatives } = useNotesDisplay();

  const visibleRows = splitRows(rows);
  const totalTaxCurrent = rowsTotal(visibleRows, "current");
  const totalTaxPrior = rowsTotal(visibleRows, "prior");

  const explicitCurrentTaxRows = visibleRows.filter((row) => {
    const label = String(row.label || "").toLowerCase();
    return label.includes("current tax") || label.includes("normal tax");
  });

  const explicitDeferredTaxRows = visibleRows.filter((row) =>
    String(row.label || "").toLowerCase().includes("deferred"),
  );

  const deferredAssetCurrent = deferredTaxAmount(currentTaxReceivableRows, "current");
  const deferredAssetPrior = deferredTaxAmount(currentTaxReceivableRows, "prior");
  const deferredLiabilityCurrent = deferredTaxAmount(currentTaxPayableRows, "current");
  const deferredLiabilityPrior = deferredTaxAmount(currentTaxPayableRows, "prior");

  const hasDeferredTaxBalance =
    deferredAssetCurrent !== 0 ||
    deferredAssetPrior !== 0 ||
    deferredLiabilityCurrent !== 0 ||
    deferredLiabilityPrior !== 0;

  const hasExplicitComponents =
    explicitCurrentTaxRows.length > 0 || explicitDeferredTaxRows.length > 0;

  const currentTaxCurrent = hasExplicitComponents
    ? rowsTotal(explicitCurrentTaxRows, "current")
    : hasDeferredTaxBalance
      ? 0
      : totalTaxCurrent;
  const currentTaxPrior = hasExplicitComponents
    ? rowsTotal(explicitCurrentTaxRows, "prior")
    : hasDeferredTaxBalance
      ? 0
      : totalTaxPrior;

  const deferredTaxCurrent = hasExplicitComponents
    ? rowsTotal(explicitDeferredTaxRows, "current")
    : hasDeferredTaxBalance
      ? totalTaxCurrent
      : 0;
  const deferredTaxPrior = hasExplicitComponents
    ? rowsTotal(explicitDeferredTaxRows, "prior")
    : hasDeferredTaxBalance
      ? totalTaxPrior
      : 0;

  const componentTotalCurrent = currentTaxCurrent + deferredTaxCurrent;
  const componentTotalPrior = currentTaxPrior + deferredTaxPrior;

  const profitRow = findProfitBeforeTaxRow(cashUsedInOperationsRows);
  const profitCurrent = toNumber(profitRow?.current);
  const profitPrior = toNumber(profitRow?.prior);
  const taxRate = getSetupNumber(
    clientSetup,
    [
      "tax_rate",
      "income_tax_rate",
      "company_tax_rate",
      "taxRate",
      "incomeTaxRate",
      "companyTaxRate",
    ],
    27,
  );

  /*
    Statement signs are retained: a tax credit is positive in the SOCI and
    a tax expense is negative. Therefore tax at the statutory rate is the
    opposite sign of accounting profit / loss.
  */
  const theoreticalCurrent = Math.round(-profitCurrent * (taxRate / 100));
  const theoreticalPrior = Math.round(-profitPrior * (taxRate / 100));

  const reconciliationState = state.taxationReconciliation || {};
  const captured = (key: string, side: "current" | "prior") =>
    toNumber(reconciliationState?.[key]?.[side]);

  const reconciliationKeys = [
    { key: "nonDeductibleExpenses", label: "Tax effect of non-deductible expenses" },
    { key: "exemptIncome", label: "Tax effect of exempt income" },
    { key: "assessedLossesNotRecognised", label: "Tax effect of assessed losses not recognised" },
    { key: "deferredTaxAssetRecognised", label: "Deferred tax asset recognised" },
    { key: "priorYearAdjustments", label: "Prior-year adjustments" },
  ];

  const capturedCurrent = reconciliationKeys.reduce(
    (sum, item) => sum + captured(item.key, "current"),
    0,
  );
  const capturedPrior = reconciliationKeys.reduce(
    (sum, item) => sum + captured(item.key, "prior"),
    0,
  );

  const otherCurrent =
    componentTotalCurrent - theoreticalCurrent - capturedCurrent;
  const otherPrior = componentTotalPrior - theoreticalPrior - capturedPrior;

  const componentRows: AmountLine[] = [
    {
      id: "current-taxation",
      label:
        currentTaxCurrent >= 0
          ? "Current tax credit"
          : "Current tax expense",
      current: currentTaxCurrent,
      prior: currentTaxPrior,
    },
    {
      id: "deferred-taxation",
      label:
        deferredTaxCurrent >= 0
          ? "Deferred tax credit"
          : "Deferred tax expense",
      current: deferredTaxCurrent,
      prior: deferredTaxPrior,
    },
  ];

  return (
    <>
      <p style={styles.subheading}>Components of the tax expense / (credit)</p>
      <NoteTable
        rows={componentRows}
        edit={false}
        state={state}
        stateKey="taxationExpense"
        update={update}
      />

      <p style={styles.subheading}>Reconciliation of the tax expense / (credit)</p>
      <table style={styles.table}>
        <colgroup>
          <col style={{ width: "auto" }} />
          <col style={{ width: 76 }} />
          {!hideComparatives ? <col style={{ width: 76 }} /> : null}
        </colgroup>
        <tbody>
          <tr>
            <td style={styles.tdLeft}>Accounting profit / (loss) before taxation</td>
            <td style={styles.tdRight}>{amount(profitCurrent)}</td>
            {!hideComparatives ? <td style={styles.tdRight}>{amount(profitPrior)}</td> : null}
          </tr>
          <tr>
            <td style={styles.tdLeft}>Tax calculated at {taxRate}%</td>
            <td style={styles.tdRight}>{amount(theoreticalCurrent)}</td>
            {!hideComparatives ? <td style={styles.tdRight}>{amount(theoreticalPrior)}</td> : null}
          </tr>

          {reconciliationKeys.map((item) => {
            const current = captured(item.key, "current");
            const prior = captured(item.key, "prior");
            if (!edit && roundAmount(current) === 0 && roundAmount(prior) === 0) return null;

            return (
              <tr key={item.key}>
                <td style={styles.tdLeft}>{item.label}</td>
                <td style={styles.tdRight}>
                  {edit ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={reconciliationState?.[item.key]?.current ?? ""}
                      onChange={(event) =>
                        update(["taxationReconciliation", item.key, "current"], event.target.value)
                      }
                      style={numberInputStyle()}
                    />
                  ) : amount(current)}
                </td>
                {!hideComparatives ? (
                  <td style={styles.tdRight}>
                    {edit ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={reconciliationState?.[item.key]?.prior ?? ""}
                        onChange={(event) =>
                          update(["taxationReconciliation", item.key, "prior"], event.target.value)
                        }
                        style={numberInputStyle()}
                      />
                    ) : amount(prior)}
                  </td>
                ) : null}
              </tr>
            );
          })}

          {roundAmount(otherCurrent) !== 0 || roundAmount(otherPrior) !== 0 ? (
            <tr>
              <td style={styles.tdLeft}>Other reconciling items</td>
              <td style={styles.tdRight}>{amount(otherCurrent)}</td>
              {!hideComparatives ? <td style={styles.tdRight}>{amount(otherPrior)}</td> : null}
            </tr>
          ) : null}

          <tr>
            <td style={styles.totalLabel}>Tax expense / (credit) per income statement</td>
            <td data-total-amount="true" style={styles.totalAmount}>
              {amount(componentTotalCurrent)}
            </td>
            {!hideComparatives ? (
              <td data-total-amount="true" style={styles.totalAmount}>
                {amount(componentTotalPrior)}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>

      {edit ? (
        <EditableTextBlock
          label="Additional tax reconciliation wording"
          value={state.taxationExpense?.extraText ?? ""}
          edit
          onChange={(value) => update(["taxationExpense", "extraText"], value)}
        />
      ) : state.taxationExpense?.extraText ? (
        <p style={styles.paragraph}>{state.taxationExpense.extraText}</p>
      ) : null}
    </>
  );
}

function CurrentTaxBalanceNote({
  rows,
  edit,
  state,
  update,
  stateKey,
  clientSetup,
}: {
  rows: AmountLine[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
  stateKey: string;
  clientSetup: Record<string, any> | null;
}) {
  const { currentHeading, priorHeading, hideComparatives } =
    useNotesDisplay();

  const visibleRows = splitRows(rows);
  const deferredRows = visibleRows.filter((row) =>
    String(row.label || "").toLowerCase().includes("deferred tax"),
  );
  const currentTaxRows = visibleRows.filter(
    (row) =>
      !String(row.label || "").toLowerCase().includes("deferred tax"),
  );

  if (deferredRows.length > 0) {
    const deferredCurrent = rowsTotal(deferredRows, "current");
    const deferredPrior = rowsTotal(deferredRows, "prior");
    const movementCurrent = deferredCurrent - deferredPrior;
    const explanation =
      state[stateKey]?.extraText ||
      "Deferred tax arises from temporary differences between the carrying amounts of assets and liabilities and their corresponding tax bases.";

    const assessedLossesFromTaxComputation = Math.abs(
      getSetupNumber(
        clientSetup,
        [
          "assessed_loss",
          "assessed_loss_brought_forward",
          "assessedLoss",
          "assessedLossBroughtForward",
          "tax_assessed_loss",
          "taxAssessedLoss",
        ],
        0,
      ),
    );

    const taxRate = getSetupNumber(
      clientSetup,
      [
        "tax_rate",
        "income_tax_rate",
        "company_tax_rate",
        "taxRate",
        "incomeTaxRate",
        "companyTaxRate",
      ],
      27,
    );

    const forecastPeriodFromSetup = getSetupText(
      clientSetup,
      [
        "deferred_tax_forecast_period",
        "deferredTaxForecastPeriod",
        "forecast_period",
        "forecastPeriod",
      ],
      "3 years",
    );

    const populateDeferredTaxAssessment = () => {
      const currentAssessment =
        state.deferredTaxAssessment &&
        typeof state.deferredTaxAssessment === "object"
          ? state.deferredTaxAssessment
          : {};

      const suggestedNature =
        assessedLossesFromTaxComputation > 0
          ? `The deferred tax assessment includes assessed losses of ${amount(
              assessedLossesFromTaxComputation,
            )} together with applicable temporary differences.`
          : "The deferred tax assessment relates to temporary differences between the carrying amounts and tax bases of assets and liabilities.";

      update(["deferredTaxAssessment"], {
        ...currentAssessment,
        nature:
          String(currentAssessment.nature || "").trim() ||
          suggestedNature,
        assessedLosses:
          String(currentAssessment.assessedLosses || "").trim() ||
          (assessedLossesFromTaxComputation
            ? String(Math.round(assessedLossesFromTaxComputation))
            : ""),
        recognisedFromLosses:
          String(currentAssessment.recognisedFromLosses || "").trim() ||
          (deferredCurrent ? String(Math.round(deferredCurrent)) : ""),
        forecastPeriod:
          String(currentAssessment.forecastPeriod || "").trim() ||
          forecastPeriodFromSetup,
        taxRate:
          String(currentAssessment.taxRate || "").trim() ||
          String(taxRate),
      });
    };

    return (
      <>
        <table style={styles.table}>
          <colgroup>
            <col style={{ width: "auto" }} />
            <col style={{ width: 76 }} />
            {!hideComparatives ? <col style={{ width: 76 }} /> : null}
          </colgroup>
          <thead>
            <tr>
              <th style={styles.thLeft}>Reconciliation</th>
              <th style={styles.thRight}>{currentHeading}</th>
              {!hideComparatives ? (
                <th style={styles.thRight}>{priorHeading}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.tdLeft}>Opening balance</td>
              <td style={styles.tdRight}>{amount(deferredPrior)}</td>
              {!hideComparatives ? <td style={styles.tdRight}>–</td> : null}
            </tr>
            <tr>
              <td style={styles.tdLeft}>
                Recognised in profit or loss and other movements
              </td>
              <td style={styles.tdRight}>{amount(movementCurrent)}</td>
              {!hideComparatives ? <td style={styles.tdRight}>–</td> : null}
            </tr>
            <tr>
              <td style={styles.totalLabel}>Closing deferred tax asset</td>
              <td data-total-amount="true" style={styles.totalAmount}>
                {amount(deferredCurrent)}
              </td>
              {!hideComparatives ? (
                <td data-total-amount="true" style={styles.totalAmount}>
                  {amount(deferredPrior)}
                </td>
              ) : null}
            </tr>
          </tbody>
        </table>

        <EditableTextBlock
          label="Deferred tax explanation"
          value={explanation}
          edit={edit}
          onChange={(value) => update([stateKey, "extraText"], value)}
        />

        {edit ? (
          <div style={{ display: "grid", gap: 8, margin: "10px 0 12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div>
                <p style={{ ...styles.subheading, margin: 0 }}>
                  Deferred tax assessment
                </p>
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: 9.5,
                    lineHeight: 1.3,
                    color: "#64748b",
                  }}
                >
                  Mapped closing deferred tax asset: {amount(deferredCurrent)} ·
                  Tax rate: {taxRate}% · Assessed losses from Tax Computation:
                  {" "}
                  {assessedLossesFromTaxComputation
                    ? amount(assessedLossesFromTaxComputation)
                    : "not captured"}
                </p>
              </div>

              <button
                type="button"
                style={styles.button}
                onClick={populateDeferredTaxAssessment}
              >
                Populate from AFS and Tax Computation
              </button>
            </div>

            <EditableTextBlock
              label="Nature of temporary differences and assessed losses"
              value={state.deferredTaxAssessment?.nature ?? ""}
              edit
              onChange={(value) => update(["deferredTaxAssessment", "nature"], value)}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={styles.smallLabel}>Assessed losses available</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={state.deferredTaxAssessment?.assessedLosses ?? ""}
                  onChange={(event) =>
                    update(["deferredTaxAssessment", "assessedLosses"], event.target.value)
                  }
                  style={inputStyle()}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={styles.smallLabel}>Deferred tax asset from assessed losses recognised</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={state.deferredTaxAssessment?.recognisedFromLosses ?? ""}
                  onChange={(event) =>
                    update(["deferredTaxAssessment", "recognisedFromLosses"], event.target.value)
                  }
                  style={inputStyle()}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={styles.smallLabel}>Unrecognised deferred tax asset</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={state.deferredTaxAssessment?.unrecognisedAsset ?? ""}
                  onChange={(event) =>
                    update(["deferredTaxAssessment", "unrecognisedAsset"], event.target.value)
                  }
                  style={inputStyle()}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={styles.smallLabel}>Forecast period used</span>
                <input
                  type="text"
                  value={state.deferredTaxAssessment?.forecastPeriod ?? ""}
                  onChange={(event) =>
                    update(["deferredTaxAssessment", "forecastPeriod"], event.target.value)
                  }
                  style={inputStyle()}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={styles.smallLabel}>Tax rate used</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={state.deferredTaxAssessment?.taxRate ?? ""}
                  onChange={(event) =>
                    update(["deferredTaxAssessment", "taxRate"], event.target.value)
                  }
                  style={inputStyle()}
                />
              </label>
            </div>
            <EditableTextBlock
              label="Evidence supporting probable future taxable profits"
              value={state.deferredTaxAssessment?.evidence ?? ""}
              edit
              onChange={(value) => update(["deferredTaxAssessment", "evidence"], value)}
            />
            <EditableTextBlock
              label="Preparer conclusion"
              value={state.deferredTaxAssessment?.conclusion ?? ""}
              edit
              onChange={(value) => update(["deferredTaxAssessment", "conclusion"], value)}
            />
          </div>
        ) : (
          <>
            {state.deferredTaxAssessment?.nature ? (
              <p style={styles.paragraph}>{state.deferredTaxAssessment.nature}</p>
            ) : null}
            {state.deferredTaxAssessment?.evidence ? (
              <p style={styles.paragraph}>
                Recognition is supported by: {state.deferredTaxAssessment.evidence}
              </p>
            ) : null}
            {state.deferredTaxAssessment?.conclusion ? (
              <p style={styles.paragraph}>{state.deferredTaxAssessment.conclusion}</p>
            ) : null}
            {toNumber(state.deferredTaxAssessment?.unrecognisedAsset) !== 0 ? (
              <p style={styles.paragraph}>
                Unrecognised deferred tax asset: {amount(state.deferredTaxAssessment.unrecognisedAsset)}.
              </p>
            ) : null}
          </>
        )}

        {currentTaxRows.length > 0 ? (
          <>
            <p style={styles.subheading}>Current tax balance</p>
            <NoteTable
              rows={currentTaxRows.map((row) => ({
                ...row,
                label:
                  stateKey === "currentTaxPayable"
                    ? "Current tax payable"
                    : "Current tax receivable",
              }))}
              edit={edit}
              state={state}
              stateKey={`${stateKey}CurrentTax`}
              update={update}
            />
          </>
        ) : null}
      </>
    );
  }

  const displayRows =
    currentTaxRows.length > 0
      ? currentTaxRows.map((row) => ({
          ...row,
          label:
            stateKey === "currentTaxPayable"
              ? "Current tax payable"
              : "Current tax receivable",
        }))
      : [];

  if (displayRows.length === 0 && !edit) return null;

  return (
    <>
      <NoteTable
        rows={displayRows}
        edit={edit}
        state={state}
        stateKey={stateKey}
        update={update}
      />

      {edit ? (
        <EditableTextBlock
          label="Additional current tax balance wording"
          value={state[stateKey]?.extraText || ""}
          edit
          onChange={(value) => update([stateKey, "extraText"], value)}
        />
      ) : state[stateKey]?.extraText ? (
        <p style={styles.paragraph}>{state[stateKey].extraText}</p>
      ) : null}
    </>
  );
}


function operatingExpenseSearchText(line: any) {
  return [
    line.mapping_code,
    line.mapping_leaf_id,
    line.lead_schedule_key,
    line.lead_schedule_number,
    line.mapping_label,
    line.mapping_path,
    line.mapping_section,
    line.mapping_category,
    line.account_code,
    line.account_name,
    line.account_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildOperatingExpenseDetailRows(
  trialBalanceLines: any[],
  fallbackRows: AmountLine[],
): AmountLine[] {
  const grouped = new Map<string, AmountLine>();

  const addToGroup = (
    id: string,
    label: string,
    current: number,
    prior: number,
  ) => {
    const existing = grouped.get(id) || { id, label, current: 0, prior: 0 };
    existing.current += current;
    existing.prior += prior;
    grouped.set(id, existing);
  };

  (trialBalanceLines || [])
    .filter((line) => mappingStartsWith(line, ["750"]))
    .forEach((line) => {
      const code = normalisedMappingCode(line);
      const currentRaw = lineAmount(line, "current");
      const priorRaw = lineAmount(line, "prior");
      const current = currentRaw > 0 ? -Math.abs(currentRaw) : currentRaw;
      const prior = priorRaw > 0 ? -Math.abs(priorRaw) : priorRaw;

      if (roundAmount(current) === 0 && roundAmount(prior) === 0) return;

      if (["750.20", "750.21", "750.28", "750.29"].some((p) => code === p || code.startsWith(`${p}.`))) {
        addToGroup("employee-costs", "Employee costs", current, prior);
        return;
      }

      if (["750.18", "750.19", "750.30", "750.31", "750.32", "750.33"].some((p) => code === p || code.startsWith(`${p}.`))) {
        addToGroup("occupancy-costs", "Rent and occupancy costs", current, prior);
        return;
      }

      if (["750.14", "750.141"].some((p) => code === p || code.startsWith(`${p}.`))) {
        addToGroup("depreciation", "Depreciation and amortisation", current, prior);
        return;
      }

      if (["750.10", "750.11", "750.16"].some((p) => code === p || code.startsWith(`${p}.`))) {
        addToGroup("professional-fees", "Professional and consulting fees", current, prior);
        return;
      }

      if (["750.40", "750.41"].some((p) => code === p || code.startsWith(`${p}.`))) {
        addToGroup("advertising", "Advertising and promotion", current, prior);
        return;
      }

      addToGroup(
        code || "other-operating-expenses",
        clean(line.mapping_label) || clean(line.account_name) || "Other operating expenses",
        current,
        prior,
      );
    });

  const rows = Array.from(grouped.values())
    .filter((row) => roundAmount(row.current) !== 0 || roundAmount(row.prior) !== 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  return rows.length > 0 ? rows : fallbackRows;
}

function OperatingExpensesNote({
  rows,
  trialBalanceLines,
  edit,
  state,
  update,
}: {
  rows: AmountLine[];
  trialBalanceLines: any[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const detailRows = buildOperatingExpenseDetailRows(
    trialBalanceLines,
    rows,
  );

  return (
    <NoteTable
      rows={detailRows}
      edit={edit}
      state={state}
      stateKey="operatingExpenses"
      update={update}
    />
  );
}

function GenericStructuredNote({
  rows,
  edit,
  stateKey,
  defaultText,
  state,
  update,
}: {
  rows: AmountLine[];
  edit: boolean;
  stateKey: string;
  defaultText?: string;
  state: StructuredState;
  update: (path: string[], value: any) => void;
}) {
  const extraText = state[stateKey]?.extraText ?? "";

  return (
    <>
      <NoteTable
        rows={rows}
        edit={edit}
        state={state}
        stateKey={stateKey}
        update={update}
      />
      <ValidationBox
        label="Note total must agree to mapped balance."
        expectedCurrent={rowsTotal(rows, "current")}
        actualCurrent={rowsTotal(rows, "current")}
        expectedPrior={rowsTotal(rows, "prior")}
        actualPrior={rowsTotal(rows, "prior")}
      />

      {edit ? (
        <div style={{ display: "grid", gap: 4, margin: "6px 0" }}>
          <span style={styles.smallLabel}>Additional disclosure wording</span>
          <textarea
            value={extraText}
            placeholder={
              defaultText || "Optional wording. Leave blank if not needed."
            }
            onChange={(event) =>
              update([stateKey, "extraText"], event.target.value)
            }
            style={textAreaStyle()}
          />
          <button
            type="button"
            onClick={() => update([stateKey, "extraText"], "")}
            style={styles.clearButton}
          >
            Clear wording
          </button>
        </div>
      ) : extraText.trim() ? (
        <p style={styles.paragraph}>{extraText}</p>
      ) : null}
    </>
  );
}

export default function AfsStructuredNotesPanel({
  engagementId,
  noteSections,
  reportOptions,
  toggleReportOption,
  noteData,
  trialBalanceLines,
  clientSetup,
  currentHeading,
  priorHeading,
  activeNoteTexts,
  defaultNoteTexts,
  hideComparatives = false,
  structuredNotesState = {},
  onStructuredNotesStateChange,
  forceReviewMode = false,
  sectionKeys,
  headingMode = "main",
  rootId,
}: Props) {
  const [mode, setMode] = useState<"review" | "edit">(() => {
    if (forceReviewMode || typeof window === "undefined") return "review";
    try {
      return window.localStorage.getItem(`afs-notes-mode:${engagementId}`) === "edit"
        ? "edit"
        : "review";
    } catch {
      return "review";
    }
  });
  const notesRootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(
        `afs-notes-mode:${engagementId}`,
      );
      if (savedMode === "review" || savedMode === "edit") {
        setMode(savedMode);
      }
    } catch {
      // ignore localStorage failures
    }

    const onModeChange = (event: Event) => {
      const customEvent = event as CustomEvent<"review" | "edit">;
      if (customEvent.detail === "review" || customEvent.detail === "edit") {
        setMode(customEvent.detail);
      }
    };

    window.addEventListener("afs-notes-mode-change", onModeChange);

    return () =>
      window.removeEventListener("afs-notes-mode-change", onModeChange);
  }, [engagementId]);

  const { state, update } = useStructuredNotesState(
    engagementId,
    structuredNotesState,
    onStructuredNotesStateChange,
  );
  const isEditing = mode === "edit" && !forceReviewMode;

  const ppeRows = buildPpeRows(trialBalanceLines, state.ppeRows || []).map(
    (row) => {
      const savedLabel =
        state?.ppeClassLabels &&
        typeof state.ppeClassLabels === "object"
          ? clean(state.ppeClassLabels[row.key])
          : "";

      return savedLabel ? { ...row, label: savedLabel } : row;
    },
  );

  const sectionKeySignature = (sectionKeys || []).join("|");

  const sectionsWithNumbers = useMemo(() => {
    let noteNumber = 0;

    const hasMappedTrialBalance = (prefixes: string[]) =>
      (trialBalanceLines || []).some(
        (line: any) =>
          mappingStartsWith(line, prefixes) &&
          (Math.round(lineAmount(line, "current")) !== 0 ||
            Math.round(lineAmount(line, "prior")) !== 0),
      );

    const goingConcernHasContent = Object.values(
      state.goingConcernAssessment || {},
    ).some((item) => String(item || "").trim());

    const relatedPartiesHaveContent = (
      Array.isArray(state.relatedPartyRows) ? state.relatedPartyRows : []
    ).some((row: any) =>
      [
        row?.name,
        row?.relationship,
        row?.transaction,
        row?.current,
        row?.prior,
        row?.terms,
        row?.interest,
        row?.security,
        row?.commitments,
      ].some((item) => String(item ?? "").trim()),
    );

    const commitmentsHaveContent = Object.values(
      state.commitmentsContingencies || {},
    ).some((item) => String(item ?? "").trim());

    const eventsAfterReportingHaveContent = Object.values(
      state.eventsAfterReportingPeriod || {},
    ).some((item) => String(item ?? "").trim());

    const numberedSections = noteSections
      .map((section) => {
        const configuredActive = Boolean(reportOptions[section.optionKey]);
        const dataKey = NOTE_KEY_MAP[section.key];
        const rows = dataKey ? noteData[dataKey] || [] : [];
        const mappedRowsHaveContent = splitRows(rows).length > 0;

        let specialHasContent = false;

        if (section.key === "notesPropertyPlantEquipment") {
          specialHasContent = hasMappedTrialBalance(["305"]);
        } else if (section.key === "notesShareholdersLoans") {
          specialHasContent = hasMappedTrialBalance(["548"]);
        } else if (section.key === "notesBorrowings") {
          specialHasContent = hasMappedTrialBalance(["550", "551", "610"]);
        } else if (section.key === "notesAssetFinance") {
          specialHasContent = hasMappedTrialBalance([
            "550.40",
            "550.50",
            "610.30",
            "610.40",
          ]);
        } else if (section.key === "notesLeaseLiabilities") {
          specialHasContent = hasMappedTrialBalance(["555", "615"]);
        } else if (section.key === "notesOtherFinancialLiabilities") {
          specialHasContent = hasMappedTrialBalance(["560", "590", "625"]);
        } else if (section.key === "notesBankOverdraft") {
          specialHasContent = hasMappedTrialBalance(["620"]);
        } else if (section.key === "notesGoingConcern") {
          specialHasContent = goingConcernHasContent;
        } else if (section.key === "notesRelatedParties") {
          specialHasContent = relatedPartiesHaveContent;
        } else if (section.key === "notesCommitmentsContingencies") {
          specialHasContent = commitmentsHaveContent;
        } else if (section.key === "notesEventsAfterReportingPeriod") {
          specialHasContent = eventsAfterReportingHaveContent;
        }

        const hasPrintableContent =
          mappedRowsHaveContent || specialHasContent;

        /*
          AFS / review mode:
          an empty note never prints and never consumes a note number.

          Work mode:
          a switched-on empty note remains visible so the accountant can work
          on it, but it does not receive a final note number until it contains
          mapped data or a real disclosure.
        */
        const active =
          configuredActive && (isEditing || hasPrintableContent);

        const numberedActive =
          configuredActive && hasPrintableContent;

        if (!active && !isEditing) return null;

        if (numberedActive) noteNumber += 1;

        return {
          section,
          active,
          noteNumber: numberedActive ? noteNumber : null,
          rows,
        };
      })
      .filter(Boolean) as {
      section: any;
      active: boolean;
      noteNumber: number | null;
      rows: AmountLine[];
    }[];

    if (!sectionKeys || sectionKeys.length === 0) {
      return numberedSections;
    }

    const allowed = new Set(sectionKeys);
    return numberedSections.filter(({ section }) => allowed.has(section.key));
  }, [
    isEditing,
    noteSections,
    reportOptions,
    noteData,
    trialBalanceLines,
    state,
    sectionKeySignature,
  ]);

  return (
    <NotesDisplayContext.Provider
      value={{
        currentHeading,
        priorHeading,
        hideComparatives,
      }}
    >
      <section
      id={rootId || (headingMode === "continued" ? "print-notes-continued" : "print-notes")}
      data-afs-notes-root="true"
      data-hide-comparatives={hideComparatives ? "true" : "false"}
      ref={notesRootRef}
      style={{ fontSize: 11.7, lineHeight: 1.45, color: "#111827" }}
    >
      <style>{`
        [data-afs-notes-root="true"] table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }
        [data-afs-notes-root="true"] tbody tr,
        [data-afs-notes-root="true"] tbody td {
          border-bottom: 0 !important;
          box-shadow: none !important;
          background-image: none !important;
          outline: 0 !important;
        }
        /* Notes must not draw one long CaseWare-unfriendly line across the full page.
           Only amount cells on total rows get rules. */
        [data-afs-notes-root="true"] thead th {
          border-bottom: 0 !important;
        }
        [data-afs-notes-root="true"] [data-total-label="true"] {
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        [data-afs-notes-root="true"] [data-total-amount="true"] {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.5px solid #111827 !important;
        }
        @media print {
          [data-afs-notes-root="true"] {
            font-size: 10.45px !important;
            line-height: 1.34 !important;
          }
          [data-afs-notes-root="true"] [data-note-active="false"],
          [data-afs-notes-root="true"] .afs-screen-only {
            display: none !important;
          }
          [data-afs-notes-root="true"] input,
          [data-afs-notes-root="true"] textarea,
          [data-afs-notes-root="true"] button,
          [data-afs-notes-root="true"] [data-work-only="true"] {
            display: none !important;
          }
          [data-afs-notes-root="true"] table {
            table-layout: fixed !important;
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
          }
          [data-afs-notes-root="true"] th:first-child,
          [data-afs-notes-root="true"] td:first-child {
            width: auto !important;
          }
          [data-afs-notes-root="true"] th:not(:first-child),
          [data-afs-notes-root="true"] td:not(:first-child) {
            width: 68px !important;
          }
        }
      `}</style>
      {headingMode !== "none" ? (
        <h1 style={styles.pageHeading}>
          {headingMode === "continued"
            ? "Notes to the Financial Statements — continued"
            : "Notes to the Financial Statements"}
        </h1>
      ) : null}

      {sectionsWithNumbers.map(({ section, active, noteNumber, rows }) => {
        const title = noteTitle(section, activeNoteTexts, defaultNoteTexts);
        const displayTitle =
          section.key === "notesCashUsedInOperations"
            ? "Cash generated from operations"
            : title;

        if (section.key === "notesPropertyPlantEquipment") {
          return (
            <div
              key={section.key}
              style={
                !active && isEditing ? styles.noteSectionOff : undefined
              }
            >
              {isEditing ? (
                <div style={styles.headingRow}>
                  <span
                    style={!active ? styles.noteHeadingOff : styles.noteHeading}
                  >
                    {active && noteNumber ? `${noteNumber}. ` : ""}Property,
                    plant and equipment
                  </span>
                  <button
                    type="button"
                    className="afs-screen-only"
                    onClick={() =>
                      toggleReportOption(section.optionKey, !active)
                    }
                    style={active ? styles.onToggle : styles.offToggle}
                  >
                    {active ? "On" : "Off"}
                  </button>
                </div>
              ) : null}
              {active || isEditing ? (
                <PpeStructuredNote
                  noteNumber={active ? noteNumber : null}
                  edit={isEditing}
                  rows={ppeRows}
                  mappedRows={noteData.propertyPlantEquipment || []}
                  state={state}
                  update={update}
                />
              ) : null}
            </div>
          );
        }

        if (!active && !isEditing) return null;

        return (
          <section
            key={section.key}
            id={noteNumber ? `afs-note-${noteNumber}` : undefined}
            data-note-active={active ? "true" : "false"}
            style={
              active
                ? {
                    ...styles.noteSection,
                    ...(isEditing
                      ? {
                          breakInside: "auto",
                          pageBreakInside: "auto",
                        }
                      : {}),
                  }
                : styles.noteSectionOff
            }
          >
            <div style={styles.headingRow}>
              <h2 style={active ? styles.noteHeading : styles.noteHeadingOff}>
                {active && noteNumber ? `${noteNumber}. ` : ""}
                {displayTitle}
              </h2>
              <button
                type="button"
                className="afs-screen-only"
                onClick={() => toggleReportOption(section.optionKey, !active)}
                style={active ? styles.onToggle : styles.offToggle}
              >
                {active ? "On" : "Off"}
              </button>
            </div>

            {!active ? (
              <p style={styles.inactiveText}>
                Note switched off. Turn it on to include this disclosure and
                assign a note number.
              </p>
            ) : (
              <>
                {section.key === "notesCashAndCashEquivalents" ? (
                  <CashNote
                    rows={rows}
                    edit={isEditing}
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesShareholdersLoans" ? (
                  <ShareholderLoansNote
                    rows={rows}
                    trialBalanceLines={trialBalanceLines}
                    edit={isEditing}
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesCashUsedInOperations" ? (
                  <CashUsedInOperationsNote
                    rows={rows}
                    edit={isEditing}
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesShareCapital" ? (
                  <ShareCapitalNote
                    rows={rows}
                    edit={isEditing}
                    state={state}
                    update={update}
                    clientSetup={clientSetup}
                  />
                ) : section.key === "notesInventories" ? (
                  <GenericStructuredNote
                    rows={rows}
                    edit={isEditing}
                    stateKey="inventories"
                    defaultText="Inventories are analysed by category where applicable. Inventories pledged as security and write-downs to net realisable value are disclosed where applicable."
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesTradeReceivables" ? (
                  <GenericStructuredNote
                    rows={rows}
                    edit={isEditing}
                    stateKey="receivables"
                    defaultText="The directors consider that the carrying amount of trade and other receivables approximates their fair value."
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesTradePayables" ? (
                  <GenericStructuredNote
                    rows={rows}
                    edit={isEditing}
                    stateKey="payables"
                    defaultText="Trade and other payables are payable within normal credit terms unless otherwise disclosed."
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesOtherFinancialLiabilities" ? (
                  <OtherFinancialLiabilitiesNote
                    rows={rows}
                    trialBalanceLines={trialBalanceLines}
                    edit={isEditing}
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesAssetFinance" ? (
                  <AssetFinanceNote
                    rows={rows}
                    trialBalanceLines={trialBalanceLines}
                    edit={isEditing}
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesBankOverdraft" ? (
                  <BankOverdraftNote
                    rows={rows}
                    trialBalanceLines={trialBalanceLines}
                    edit={isEditing}
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesOperatingExpenses" ? (
                  <OperatingExpensesNote
                    rows={rows}
                    trialBalanceLines={trialBalanceLines}
                    edit={isEditing}
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesTaxation" ? (
                  <TaxationNote
                    rows={rows}
                    edit={isEditing}
                    state={state}
                    update={update}
                    clientSetup={clientSetup}
                    cashUsedInOperationsRows={noteData.cashUsedInOperations || []}
                    currentTaxReceivableRows={noteData.currentTaxReceivable || []}
                    currentTaxPayableRows={noteData.currentTaxPayable || []}
                  />
                ) : section.key === "notesCurrentTaxReceivable" ? (
                  <CurrentTaxBalanceNote
                    rows={rows}
                    edit={isEditing}
                    state={state}
                    update={update}
                    stateKey="currentTaxReceivable"
                    clientSetup={clientSetup}
                  />
                ) : section.key === "notesCurrentTaxPayable" ? (
                  <CurrentTaxBalanceNote
                    rows={rows}
                    edit={isEditing}
                    state={state}
                    update={update}
                    stateKey="currentTaxPayable"
                    clientSetup={clientSetup}
                  />
                ) : section.key === "notesGoingConcern" ? (
                  <GoingConcernNote
                    edit={isEditing}
                    state={state}
                    update={update}
                  />
                ) : section.key === "notesRelatedParties" ? (
                  <RelatedPartiesNote
                    edit={isEditing}
                    state={state}
                    update={update}
                  />
                ) : (
                  <GenericStructuredNote
                    rows={rows}
                    edit={isEditing}
                    stateKey={section.key}
                    state={state}
                    update={update}
                  />
                )}
              </>
            )}
          </section>
        );
      })}
      </section>
    </NotesDisplayContext.Provider>
  );
}

const styles: Record<string, any> = {
  // Notes visual reset: CaseWare-style amount rules only. No full-width grid lines.
  pageHeading: {
    margin: "0 0 12px",
    paddingBottom: 6,
    borderBottom: "1.5px solid #111827",
    fontSize: 15.5,
    fontWeight: 700,
  },
  toolbar: {
    position: "fixed",
    top: 255,
    right: 380,
    zIndex: 2147483647,
    display: "flex",
    gap: 6,
    alignItems: "center",
    margin: 0,
    padding: 6,
    border: "1px solid #dbe3ef",
    background: "#f8fafc",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.18)",
    fontSize: 10.8,
  },
  button: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    padding: "4px 8px",
    fontSize: 10.8,
    cursor: "pointer",
  },
  activeButton: {
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    padding: "4px 8px",
    fontSize: 10.8,
    cursor: "pointer",
  },
  noteSection: { marginBottom: 19, breakInside: "avoid", pageBreakInside: "avoid" },
  noteSectionOff: {
    marginBottom: 10,
    opacity: 0.72,
    border: "1px dashed #cbd5e1",
    padding: 8,
  },
  headingRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  noteHeading: { margin: "8px 0 5px", fontSize: 11.7, fontWeight: 700 },
  noteHeadingOff: {
    margin: 0,
    fontSize: 12.8,
    fontWeight: 700,
    color: "#64748b",
  },
  onToggle: {
    border: "1px solid #86efac",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 9.8,
    fontWeight: 600,
    cursor: "pointer",
  },
  offToggle: {
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 9.8,
    fontWeight: 600,
    cursor: "pointer",
  },
  inactiveText: { margin: "6px 0 0", fontSize: 10.8, color: "#64748b" },
  paragraph: { margin: "4px 0", fontSize: 10.4, lineHeight: 1.336 },
  smallLabel: {
    display: "block",
    fontSize: 9.8,
    color: "#475569",
    fontWeight: 600,
    marginBottom: 2,
  },
  table: {
    width: "100%",
    tableLayout: "fixed",
    borderCollapse: "separate",
    borderSpacing: 0,
    margin: "4px 0 16px",
    fontSize: 10.35,
  },
  thLeft: {
    textAlign: "left",
    borderBottom: "0",
    padding: "2px 0 3px",
    fontWeight: 700,
  },
  thRight: {
    textAlign: "right",
    borderBottom: "0",
    padding: "2px 3px 3px",
    width: 72,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  tdLeft: { padding: "2.5px 0", borderBottom: "0", boxShadow: "none" },
  tdRight: {
    padding: "2.5px 3px",
    width: 72,
    borderBottom: "0",
    textAlign: "right",
    boxShadow: "none",
    whiteSpace: "nowrap",
  },
  totalLabel: { padding: "4px 0 3px", borderTop: "0", fontWeight: 700 },
  totalAmount: {
    padding: "4px 3px 3px",
    width: 72,
    borderTop: "1px solid #111827",
    borderBottom: "1.5px solid #111827",
    textAlign: "right",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  subheading: { padding: "6px 0 2px", fontWeight: 700, borderBottom: "0" },
  cashGroupHeading: {
    padding: "7px 0 2px",
    fontWeight: 700,
    fontSize: 10.6,
    borderBottom: "0",
    color: "#111827",
  },
  cashEditHint: {
    display: "inline-block",
    marginLeft: 6,
    fontSize: 8.5,
    color: "#64748b",
    fontWeight: 600,
  },
  loanTermsCell: {
    padding: "3px 0 8px 12px",
    borderBottom: "0",
    fontSize: 10.15,
    color: "#111827",
  },
  loanTermsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 5,
    padding: 6,
    background: "#ffffff",
    border: "1px solid #111827",
  },
  editGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
    margin: "6px 0",
  },
  editGridSingle: { display: "grid", gap: 6, margin: "6px 0" },
  tabBar: { display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0" },
  tab: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "3px 6px",
    fontSize: 9.8,
    cursor: "pointer",
  },
  activeTab: {
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    padding: "3px 6px",
    fontSize: 9.8,
    cursor: "pointer",
  },
  matrixScroll: { overflowX: "visible", maxWidth: "100%" },
  amountTd: { padding: "2px", borderBottom: "0", textAlign: "right" },
};
