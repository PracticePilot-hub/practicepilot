"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

type AmountLine = {
  id?: string;
  label: string;
  current: number;
  prior: number;
  meta?: Record<string, any>;
};

type Props = {
  engagementId: string;
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
  { key: "itEquipment", label: "IT equipment", current: {}, prior: {} },
  {
    key: "computerSoftware",
    label: "Computer software",
    current: {},
    prior: {},
  },
  {
    key: "leaseholdImprovements",
    label: "Leasehold improvements",
    current: {},
    prior: {},
  },
  {
    key: "rightOfUseAssets",
    label: "Right-of-use assets",
    current: {},
    prior: {},
  },
  { key: "propertyPlantEquipment1", label: "PPE 1", current: {}, prior: {} },
  { key: "propertyPlantEquipment2", label: "PPE 2", current: {}, prior: {} },
  { key: "otherPpe1", label: "Other PPE 1", current: {}, prior: {} },
  { key: "otherPpe2", label: "Other PPE 2", current: {}, prior: {} },
  {
    key: "capitalWorkInProgress",
    label: "Capital WIP",
    current: {},
    prior: {},
  },
];

const COST_MOVEMENTS: { key: PpeMovementKey; label: string }[] = [
  { key: "openingCost", label: "Opening" },
  { key: "additions", label: "Additions" },
  { key: "additionsBusinessCombinations", label: "Business comb." },
  { key: "disposals", label: "Disposals" },
  { key: "transfers", label: "Transfers" },
  { key: "revaluations", label: "Revaluations" },
  { key: "foreignExchangeMovements", label: "Forex" },
  { key: "decommissioningLiability", label: "Decomm." },
  { key: "otherMovements", label: "Other" },
];

const ACC_DEP_MOVEMENTS: { key: PpeMovementKey; label: string }[] = [
  { key: "openingAccumulatedDepreciation", label: "Opening" },
  { key: "depreciation", label: "Depreciation" },
  { key: "impairmentLosses", label: "Impairment" },
  { key: "impairmentReversal", label: "Reversal" },
  { key: "accumulatedDepreciationDisposals", label: "Disposals" },
  { key: "accumulatedDepreciationTransfers", label: "Transfers" },
  { key: "accumulatedDepreciationOtherMovements", label: "Other" },
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
  const values = [
    line.mapping_code,
    line.lead_schedule_number,
    line.lead_schedule_key,
    line.mapping_leaf_id,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return values.some((value) =>
    prefixes.some((prefix) => {
      const cleanPrefix = String(prefix || "").trim().toLowerCase();
      return (
        value === cleanPrefix ||
        value.startsWith(`${cleanPrefix}.`) ||
        value.startsWith(`${cleanPrefix} `) ||
        value.includes(` ${cleanPrefix}.`) ||
        value.includes(` ${cleanPrefix} `)
      );
    })
  );
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
  const text = [
    line.lead_schedule_key,
    line.lead_schedule_number,
    line.mapping_code,
    line.mapping_label,
    line.mapping_path,
    line.mapping_section,
    line.mapping_category,
    line.account_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("ppe") ||
    text.includes("property, plant") ||
    text.includes("property plant") ||
    text.includes("plant and equipment") ||
    text.includes("305")
  );
}

function ppeClassKeyFromLine(line: any) {
  const label =
    clean(line.mapping_label) ||
    clean(line.account_name) ||
    "Property, plant and equipment";
  const text = label.toLowerCase();

  if (text.includes("land")) return { key: "land", label: "Land" };
  if (text.includes("building"))
    return { key: "buildings", label: "Buildings" };
  if (text.includes("motor") || text.includes("vehicle"))
    return { key: "motorVehicles", label: "Motor vehicles" };
  if (
    text.includes("computer") ||
    text.includes("laptop") ||
    text.includes("it equipment")
  )
    return { key: "itEquipment", label: "IT equipment" };
  if (text.includes("office"))
    return { key: "officeEquipment", label: "Office equipment" };
  if (text.includes("furniture") || text.includes("fitting"))
    return { key: "furnitureAndFittings", label: "Furniture and fittings" };
  if (text.includes("plant") || text.includes("machinery"))
    return { key: "plantAndMachinery", label: "Plant and machinery" };
  if (text.includes("leasehold"))
    return { key: "leaseholdProperty", label: "Leasehold property" };

  return { key: "propertyPlantEquipment1", label };
}

function useStructuredNotesState(engagementId: string) {
  const storageKey = `practicepilot-afs-structured-notes:${engagementId}`;
  const [state, setState] = useState<StructuredState>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setState(JSON.parse(raw));
    } catch {
      setState({});
    }
  }, [storageKey]);

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
        // local only for now
      }

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

function buildPpeRows(lines: any[], savedRows: PpeRow[] = []) {
  const map = new Map<string, PpeRow>();

  DEFAULT_PPE_ROWS.forEach((row) => {
    map.set(row.key, {
      ...row,
      current: { ...row.current },
      prior: { ...row.prior },
    });
  });

  savedRows.forEach((row) => {
    map.set(String(row.key), {
      ...row,
      current: { ...(row.current || {}) },
      prior: { ...(row.prior || {}) },
    });
  });

  lines.filter(isPpeLine).forEach((line) => {
    const klass = ppeClassKeyFromLine(line);
    if (!map.has(klass.key)) {
      map.set(klass.key, {
        key: klass.key,
        label: klass.label,
        current: {},
        prior: {},
      });
    }

    const row = map.get(klass.key);
    if (!row) return;

    const prior = lineAmount(line, "prior");
    const current = lineAmount(line, "current");

    row.prior.openingCost = row.prior.openingCost ?? prior;
    row.current.openingCost = row.current.openingCost ?? prior;
    row.current.otherMovements =
      row.current.otherMovements ?? Math.round(current - prior);
  });

  return Array.from(map.values());
}

function numberInputStyle() {
  return {
    width: "58px",
    minWidth: "58px",
    border: "1px solid #d1d5db",
    background: "#fff7bf",
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
    border: "1px solid #d1d5db",
    padding: 6,
    fontSize: 10.8,
    fontFamily: "inherit",
    resize: "vertical" as const,
    background: "#ffffff",
  };
}

function inputStyle() {
  return {
    width: "100%",
    border: "1px solid #d1d5db",
    padding: "4px 5px",
    fontSize: 10.8,
    fontFamily: "inherit",
    background: "#ffffff",
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
    toNumber(values.revaluations) +
    toNumber(values.foreignExchangeMovements) +
    toNumber(values.decommissioningLiability) +
    toNumber(values.otherMovements)
  );
}

function closingAccumulatedDepreciation(values: PpeValues) {
  return (
    toNumber(values.openingAccumulatedDepreciation) +
    toNumber(values.depreciation) +
    toNumber(values.impairmentLosses) -
    toNumber(values.impairmentReversal) -
    toNumber(values.accumulatedDepreciationDisposals) +
    toNumber(values.accumulatedDepreciationTransfers) +
    toNumber(values.accumulatedDepreciationOtherMovements)
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
  return mappingStartsWith(line, ["548", "500.548"]);
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
  const raw = state.ppeInputs?.[row.key]?.[year]?.[movementKey];
  const fallback = row[year]?.[movementKey];
  const value =
    raw !== undefined
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
        onChange={(event) =>
          update(["ppeInputs", row.key, year, movementKey], event.target.value)
        }
        style={numberInputStyle()}
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
              2024 cost
            </TabButton>
            <TabButton
              active={tab === "current-dep"}
              onClick={() => setTab("current-dep")}
            >
              2024 dep.
            </TabButton>
            <TabButton
              active={tab === "prior-cost"}
              onClick={() => setTab("prior-cost")}
            >
              2023 cost
            </TabButton>
            <TabButton
              active={tab === "prior-dep"}
              onClick={() => setTab("prior-dep")}
            >
              2023 dep.
            </TabButton>
            <TabButton
              active={tab === "disclosures"}
              onClick={() => setTab("disclosures")}
            >
              Text
            </TabButton>
          </div>

          {tab === "summary" ? <PpeSummaryTable rows={populatedRows} /> : null}
          {tab === "current-cost" ? (
            <PpeMovementEditor
              rows={populatedRows}
              year="current"
              movements={COST_MOVEMENTS}
              state={state}
              update={update}
              title="Cost / valuation reconciliation - 2024"
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
              title="Accumulated depreciation / impairment - 2024"
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
              title="Cost / valuation reconciliation - 2023"
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
              title="Accumulated depreciation / impairment - 2023"
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
            title="Reconciliation of property, plant and equipment - 2024"
          />
          <PpeFinancialMovementTable
            rows={populatedRows}
            year="prior"
            title="Reconciliation of property, plant and equipment - 2023"
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

function PpeSummaryTable({ rows }: { rows: PpeRow[] }) {
  return (
    <table style={styles.table}>
      <colgroup>
        <col style={{ width: "auto" }} />
        <col style={{ width: 76 }} />
        <col style={{ width: 76 }} />
      </colgroup>
      <thead>
        <tr>
          <th style={styles.thLeft}>Class</th>
          <th style={styles.thRight}>2024 cost</th>
          <th style={styles.thRight}>2024 acc. dep</th>
          <th style={styles.thRight}>2024 carrying</th>
          <th style={styles.thRight}>2023 cost</th>
          <th style={styles.thRight}>2023 acc. dep</th>
          <th style={styles.thRight}>2023 carrying</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td style={styles.tdLeft}>{displayNoteLineLabel(row.label)}</td>
            <td style={styles.tdRight}>{amount(closingCost(row.current))}</td>
            <td style={styles.tdRight}>
              {amount(closingAccumulatedDepreciation(row.current))}
            </td>
            <td style={styles.tdRight}>
              {amount(carryingAmount(row.current))}
            </td>
            <td style={styles.tdRight}>{amount(closingCost(row.prior))}</td>
            <td style={styles.tdRight}>
              {amount(closingAccumulatedDepreciation(row.prior))}
            </td>
            <td style={styles.tdRight}>{amount(carryingAmount(row.prior))}</td>
          </tr>
        ))}
        <tr>
          <td data-total-label="true" style={styles.totalLabel}>
            &nbsp;
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(sumPpeRows(rows, "current", closingCost))}
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(
              sumPpeRows(rows, "current", closingAccumulatedDepreciation),
            )}
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(sumPpeRows(rows, "current", carryingAmount))}
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(sumPpeRows(rows, "prior", closingCost))}
          </td>
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(sumPpeRows(rows, "prior", closingAccumulatedDepreciation))}
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
      <table style={styles.table}>
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
              <td style={styles.tdLeft}>{displayNoteLineLabel(row.label)}</td>
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
  const movementRows = year === "current" ? COST_MOVEMENTS : COST_MOVEMENTS;

  return (
    <table style={styles.table}>
      <colgroup>
        <col style={{ width: "auto" }} />
        <col style={{ width: 76 }} />
        <col style={{ width: 76 }} />
      </colgroup>
      <thead>
        <tr>
          <th style={styles.thLeft}>{title}</th>
          {rows.map((row) => (
            <th key={row.key} style={styles.thRight}>
              {displayNoteLineLabel(row.label)}
            </th>
          ))}
          <th style={styles.thRight}>Total</th>
        </tr>
      </thead>
      <tbody>
        {movementRows.map((movement) => {
          const values = rows.map((row) => ppeValue(row, year, movement.key));
          const total = values.reduce((sum, value) => sum + value, 0);
          if (total === 0) return null;

          return (
            <tr key={`${title}-${movement.key}`}>
              <td style={styles.tdLeft}>{movement.label}</td>
              {values.map((value, index) => (
                <td key={index} style={styles.tdRight}>
                  {amount(value)}
                </td>
              ))}
              <td style={styles.tdRight}>{amount(total)}</td>
            </tr>
          );
        })}
        <tr>
          <td style={styles.totalLabel}>Closing carrying amount</td>
          {rows.map((row) => (
            <td key={row.key} style={styles.totalAmount}>
              {amount(carryingAmount(row[year]))}
            </td>
          ))}
          <td data-total-amount="true" style={styles.totalAmount}>
            {amount(sumPpeRows(rows, year, carryingAmount))}
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
  if (!edit || line.calculated || line.key === "profitBeforeTax") {
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
        value={cashGeneratedInputValue(state, line.key, year)}
        placeholder={line[year] ? String(line[year]) : ""}
        onChange={(event) =>
          update(
            ["cashGeneratedFromOperations", "values", line.key, year],
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
    buildOtherFinancialLiabilityDetailRows(trialBalanceLines, rows),
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
            const terms =
              state.otherFinancialLiabilities?.[key]?.terms ||
              "The liability is unsecured, bears no interest and has no fixed repayment terms unless otherwise disclosed.";
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
    buildShareholderLoanDetailRows(trialBalanceLines, rows),
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
          const terms =
            state.shareholderLoans?.[key]?.terms ||
            "The loan is unsecured, bears no interest and has no fixed repayment terms.";
          const interest = state.shareholderLoans?.[key]?.interest || "";
          const repayment = state.shareholderLoans?.[key]?.repayment || "";
          const security = state.shareholderLoans?.[key]?.security || "";

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
  const mappedPrior = rows.reduce((sum, row) => sum + toNumber(row.prior), 0);
  const issuedAmount = Number(issuedShares || 0) * Number(issuedPar || 0);

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
            <td style={styles.tdLeft}>Ordinary shares at end of year</td>
            <td style={styles.tdRight}>
              {amount(mappedCurrent || issuedAmount)}
            </td>
            {!hideComparatives ? (
              <td style={styles.tdRight}>
                {amount(mappedPrior || issuedAmount)}
              </td>
            ) : null}
          </tr>
          <tr>
            <td style={styles.totalLabel}>Share capital</td>
            <td data-total-amount="true" style={styles.totalAmount}>
              {amount(mappedCurrent || issuedAmount)}
            </td>
            {!hideComparatives ? (
              <td data-total-amount="true" style={styles.totalAmount}>
                {amount(mappedPrior || issuedAmount)}
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
  const visibleRows = splitRows(rows).map((row) => ({
    ...row,
    label:
      String(row.label || "").toLowerCase().includes("deferred")
        ? row.label
        : String(row.label || "").toLowerCase().includes("tax")
          ? "Current taxation"
          : row.label,
  }));

  const deferredTaxAssetCurrent = deferredTaxAmount(
    currentTaxReceivableRows,
    "current",
  );
  const deferredTaxAssetPrior = deferredTaxAmount(
    currentTaxReceivableRows,
    "prior",
  );
  const deferredTaxLiabilityCurrent = deferredTaxAmount(
    currentTaxPayableRows,
    "current",
  );
  const deferredTaxLiabilityPrior = deferredTaxAmount(
    currentTaxPayableRows,
    "prior",
  );

  const inferredDeferredCreditCurrent =
    deferredTaxAssetCurrent - deferredTaxLiabilityCurrent;
  const inferredDeferredCreditPrior =
    deferredTaxAssetPrior - deferredTaxLiabilityPrior;

  const currentTaxExpenseCurrent = rowsTotal(visibleRows, "current");
  const currentTaxExpensePrior = rowsTotal(visibleRows, "prior");

  const deferredTaxCreditCurrent =
    currentTaxExpenseCurrent === 0 && inferredDeferredCreditCurrent !== 0
      ? -inferredDeferredCreditCurrent
      : 0;
  const deferredTaxCreditPrior =
    currentTaxExpensePrior === 0 && inferredDeferredCreditPrior !== 0
      ? -inferredDeferredCreditPrior
      : 0;

  const taxExpenseCurrent = currentTaxExpenseCurrent + deferredTaxCreditCurrent;
  const taxExpensePrior = currentTaxExpensePrior + deferredTaxCreditPrior;

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

  const theoreticalCurrent = Math.round(profitCurrent * (taxRate / 100));
  const theoreticalPrior = Math.round(profitPrior * (taxRate / 100));

  const componentRows: AmountLine[] = [];

  if (visibleRows.length) {
    componentRows.push(...visibleRows);
  }

  if (deferredTaxCreditCurrent !== 0 || deferredTaxCreditPrior !== 0) {
    componentRows.push({
      id: "deferred-tax-credit",
      label: "Deferred tax credit recognised",
      current: deferredTaxCreditCurrent,
      prior: deferredTaxCreditPrior,
    });
  }

  if (componentRows.length === 0) {
    componentRows.push({
      id: "current-taxation-zero",
      label: "Current taxation",
      current: 0,
      prior: 0,
    });
  }

  return (
    <>
      <p style={styles.subheading}>Major components of the tax expense / (credit)</p>
      <NoteTable
        rows={componentRows}
        edit={edit}
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
            {!hideComparatives ? (
              <td style={styles.tdRight}>{amount(profitPrior)}</td>
            ) : null}
          </tr>
          <tr>
            <td style={styles.tdLeft}>Tax at the applicable tax rate of {taxRate}%</td>
            <td style={styles.tdRight}>{amount(theoreticalCurrent)}</td>
            {!hideComparatives ? (
              <td style={styles.tdRight}>{amount(theoreticalPrior)}</td>
            ) : null}
          </tr>
          <tr>
            <td style={styles.totalLabel}>Tax expense / (credit) per income statement</td>
            <td data-total-amount="true" style={styles.totalAmount}>
              {amount(taxExpenseCurrent)}
            </td>
            {!hideComparatives ? (
              <td data-total-amount="true" style={styles.totalAmount}>
                {amount(taxExpensePrior)}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>

      {edit ? (
        <EditableTextBlock
          label="Additional tax reconciliation wording"
          value={state.taxationExpense?.extraText || ""}
          edit
          onChange={(value) =>
            update(["taxationExpense", "extraText"], value)
          }
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
}: {
  rows: AmountLine[];
  edit: boolean;
  state: StructuredState;
  update: (path: string[], value: any) => void;
  stateKey: string;
}) {
  const { hideComparatives } = useNotesDisplay();
  const deferred = hasDeferredTaxRows(rows);
  const current = currentTaxBalanceAmount(rows);
  const prior = priorTaxBalanceAmount(rows);

  const displayRows =
    splitRows(rows).length > 0
      ? splitRows(rows).map((row) => ({
          ...row,
          label: deferred
            ? String(row.label || "").toLowerCase().includes("liability")
              ? "Deferred tax liability"
              : "Deferred tax asset"
            : "Normal tax",
        }))
      : [
          {
            id: `${stateKey}-normal-tax`,
            label: deferred ? "Deferred tax" : "Normal tax",
            current,
            prior,
          },
        ];

  const totalLabel = deferred
    ? displayRows.some((row) => String(row.label || "").toLowerCase().includes("liability"))
      ? "Deferred tax liability"
      : "Deferred tax asset"
    : "Net current tax receivable / (payable)";

  return (
    <>
      <NoteTable
        rows={displayRows}
        edit={edit}
        state={state}
        stateKey={stateKey}
        update={update}
      />

      <table style={styles.table}>
        <colgroup>
          <col style={{ width: "auto" }} />
          <col style={{ width: 76 }} />
          {!hideComparatives ? <col style={{ width: 76 }} /> : null}
        </colgroup>
        <tbody>
          <tr>
            <td style={styles.totalLabel}>{totalLabel}</td>
            <td data-total-amount="true" style={styles.totalAmount}>
              {amount(current)}
            </td>
            {!hideComparatives ? (
              <td data-total-amount="true" style={styles.totalAmount}>
                {amount(prior)}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>

      {edit ? (
        <EditableTextBlock
          label={deferred ? "Additional deferred tax wording" : "Additional current tax balance wording"}
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
}: Props) {
  const [mode, setMode] = useState<"review" | "edit">("review");
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

  const { state, update } = useStructuredNotesState(engagementId);
  const ppeRows = buildPpeRows(trialBalanceLines, state.ppeRows || []);

  const sectionsWithNumbers = useMemo(() => {
    let noteNumber = 0;
    return noteSections
      .map((section) => {
        const active = Boolean(reportOptions[section.optionKey]);
        const dataKey = NOTE_KEY_MAP[section.key];
        const rows = dataKey ? noteData[dataKey] || [] : [];
        const hasData =
          splitRows(rows).length > 0 ||
          section.key === "notesPropertyPlantEquipment";

        if (!active && mode === "review" && !hasData) return null;
        if (active) noteNumber += 1;

        return {
          section,
          active,
          noteNumber: active ? noteNumber : null,
          rows,
        };
      })
      .filter(Boolean) as {
      section: any;
      active: boolean;
      noteNumber: number | null;
      rows: AmountLine[];
    }[];
  }, [mode, noteSections, reportOptions, noteData]);

  return (
    <NotesDisplayContext.Provider
      value={{
        currentHeading,
        priorHeading,
        hideComparatives,
      }}
    >
      <section
      id="print-notes"
      data-hide-comparatives={hideComparatives ? "true" : "false"}
      ref={notesRootRef}
      style={{ fontSize: 11.7, lineHeight: 1.45, color: "#111827" }}
    >
      <style>{`
        #print-notes table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }
        #print-notes tbody tr,
        #print-notes tbody td {
          border-bottom: 0 !important;
          box-shadow: none !important;
          background-image: none !important;
          outline: 0 !important;
        }
        /* Notes must not draw one long CaseWare-unfriendly line across the full page.
           Only amount cells on total rows get rules. */
        #print-notes thead th {
          border-bottom: 0 !important;
        }
        #print-notes [data-total-label="true"] {
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        #print-notes [data-total-amount="true"] {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.5px solid #111827 !important;
        }
        #print-notes .afs-notes-print-content {
          display: none;
        }
        @media print {
          #print-notes {
            font-size: 10.45px !important;
            line-height: 1.34 !important;
          }
          #print-notes .afs-notes-screen-content {
            display: none !important;
          }
          #print-notes .afs-notes-print-content {
            display: block !important;
          }
          #print-notes [data-note-active="false"],
          #print-notes .afs-screen-only {
            display: none !important;
          }
          #print-notes input,
          #print-notes textarea,
          #print-notes button,
          #print-notes [data-work-only="true"] {
            display: none !important;
          }
          #print-notes table {
            table-layout: fixed !important;
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
          }
          #print-notes th:first-child,
          #print-notes td:first-child {
            width: auto !important;
          }
          #print-notes th:not(:first-child),
          #print-notes td:not(:first-child) {
            width: 68px !important;
          }
        }
      `}</style>
      <h1 style={styles.pageHeading}>Notes to the Financial Statements</h1>

      {sectionsWithNumbers.map(({ section, active, noteNumber, rows }) => {
        const title = noteTitle(section, activeNoteTexts, defaultNoteTexts);
        const displayTitle =
          section.key === "notesCashUsedInOperations"
            ? "Cash generated from operations"
            : section.key === "notesCurrentTaxReceivable" && hasDeferredTaxRows(rows)
              ? "Deferred tax asset"
              : section.key === "notesCurrentTaxPayable" && hasDeferredTaxRows(rows)
                ? "Deferred tax liability"
                : title;

        if (section.key === "notesPropertyPlantEquipment") {
          return (
            <div
              key={section.key}
              style={
                !active && mode === "edit" ? styles.noteSectionOff : undefined
              }
            >
              {mode === "edit" ? (
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
              {active || mode === "edit" ? (
                <>
                  <div className="afs-notes-screen-content">
                    <PpeStructuredNote
                      noteNumber={active ? noteNumber : null}
                      edit={mode === "edit"}
                      rows={ppeRows}
                      mappedRows={noteData.propertyPlantEquipment || []}
                      state={state}
                      update={update}
                    />
                  </div>
                  {active ? (
                    <div className="afs-notes-print-content">
                      <PpeStructuredNote
                        noteNumber={noteNumber}
                        edit={false}
                        rows={ppeRows}
                        mappedRows={noteData.propertyPlantEquipment || []}
                        state={state}
                        update={update}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        }

        if (!active && mode !== "edit") return null;

        return (
          <section
            key={section.key}
            id={noteNumber ? `afs-note-${noteNumber}` : undefined}
            data-note-active={active ? "true" : "false"}
            style={active ? styles.noteSection : styles.noteSectionOff}
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
                <div className="afs-notes-screen-content">
                  {section.key === "notesCashAndCashEquivalents" ? (
                    <CashNote
                      rows={rows}
                      edit={mode === "edit"}
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesShareholdersLoans" ? (
                    <ShareholderLoansNote
                      rows={rows}
                      trialBalanceLines={trialBalanceLines}
                      edit={mode === "edit"}
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesCashUsedInOperations" ? (
                    <CashUsedInOperationsNote
                      rows={rows}
                      edit={mode === "edit"}
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesShareCapital" ? (
                    <ShareCapitalNote
                      rows={rows}
                      edit={mode === "edit"}
                      state={state}
                      update={update}
                      clientSetup={clientSetup}
                    />
                  ) : section.key === "notesInventories" ? (
                    <GenericStructuredNote
                      rows={rows}
                      edit={mode === "edit"}
                      stateKey="inventories"
                      defaultText="Inventories are analysed by category where applicable. Inventories pledged as security and write-downs to net realisable value are disclosed where applicable."
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesTradeReceivables" ? (
                    <GenericStructuredNote
                      rows={rows}
                      edit={mode === "edit"}
                      stateKey="receivables"
                      defaultText="The directors consider that the carrying amount of trade and other receivables approximates their fair value."
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesTradePayables" ? (
                    <GenericStructuredNote
                      rows={rows}
                      edit={mode === "edit"}
                      stateKey="payables"
                      defaultText="Trade and other payables are payable within normal credit terms unless otherwise disclosed."
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesOtherFinancialLiabilities" ? (
                    <OtherFinancialLiabilitiesNote
                      rows={rows}
                      trialBalanceLines={trialBalanceLines}
                      edit={mode === "edit"}
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesTaxation" ? (
                    <TaxationNote
                      rows={rows}
                      edit={mode === "edit"}
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
                      edit={mode === "edit"}
                      state={state}
                      update={update}
                      stateKey="currentTaxReceivable"
                    />
                  ) : section.key === "notesCurrentTaxPayable" ? (
                    <CurrentTaxBalanceNote
                      rows={rows}
                      edit={mode === "edit"}
                      state={state}
                      update={update}
                      stateKey="currentTaxPayable"
                    />
                  ) : (
                    <GenericStructuredNote
                      rows={rows}
                      edit={mode === "edit"}
                      stateKey={section.key}
                      state={state}
                      update={update}
                    />
                  )}
                </div>
                <div className="afs-notes-print-content">
                  {section.key === "notesCashAndCashEquivalents" ? (
                    <CashNote
                      rows={rows}
                      edit={false}
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesShareholdersLoans" ? (
                    <ShareholderLoansNote
                      rows={rows}
                      trialBalanceLines={trialBalanceLines}
                      edit={false}
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesCashUsedInOperations" ? (
                    <CashUsedInOperationsNote
                      rows={rows}
                      edit={false}
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesShareCapital" ? (
                    <ShareCapitalNote
                      rows={rows}
                      edit={false}
                      state={state}
                      update={update}
                      clientSetup={clientSetup}
                    />
                  ) : section.key === "notesInventories" ? (
                    <GenericStructuredNote
                      rows={rows}
                      edit={false}
                      stateKey="inventories"
                      defaultText="Inventories are analysed by category where applicable. Inventories pledged as security and write-downs to net realisable value are disclosed where applicable."
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesTradeReceivables" ? (
                    <GenericStructuredNote
                      rows={rows}
                      edit={false}
                      stateKey="receivables"
                      defaultText="The directors consider that the carrying amount of trade and other receivables approximates their fair value."
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesTradePayables" ? (
                    <GenericStructuredNote
                      rows={rows}
                      edit={false}
                      stateKey="payables"
                      defaultText="Trade and other payables are payable within normal credit terms unless otherwise disclosed."
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesOtherFinancialLiabilities" ? (
                    <OtherFinancialLiabilitiesNote
                      rows={rows}
                      trialBalanceLines={trialBalanceLines}
                      edit={false}
                      state={state}
                      update={update}
                    />
                  ) : section.key === "notesTaxation" ? (
                    <TaxationNote
                      rows={rows}
                      edit={false}
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
                      edit={false}
                      state={state}
                      update={update}
                      stateKey="currentTaxReceivable"
                    />
                  ) : section.key === "notesCurrentTaxPayable" ? (
                    <CurrentTaxBalanceNote
                      rows={rows}
                      edit={false}
                      state={state}
                      update={update}
                      stateKey="currentTaxPayable"
                    />
                  ) : (
                    <GenericStructuredNote
                      rows={rows}
                      edit={false}
                      stateKey={section.key}
                      state={state}
                      update={update}
                    />
                  )}
                </div>
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
    fontWeight: 850,
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
  noteSection: { marginBottom: 19, breakInside: "avoid-page", pageBreakInside: "avoid" },
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
  noteHeading: { margin: "8px 0 5px", fontSize: 11.7, fontWeight: 850 },
  noteHeadingOff: {
    margin: 0,
    fontSize: 12.8,
    fontWeight: 900,
    color: "#64748b",
  },
  onToggle: {
    border: "1px solid #86efac",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 9.8,
    fontWeight: 800,
    cursor: "pointer",
  },
  offToggle: {
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 9.8,
    fontWeight: 800,
    cursor: "pointer",
  },
  inactiveText: { margin: "6px 0 0", fontSize: 10.8, color: "#64748b" },
  paragraph: { margin: "4px 0", fontSize: 10.4, lineHeight: 1.336 },
  smallLabel: {
    display: "block",
    fontSize: 9.8,
    color: "#475569",
    fontWeight: 800,
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
    fontWeight: 850,
  },
  thRight: {
    textAlign: "right",
    borderBottom: "0",
    padding: "2px 3px 3px",
    width: 72,
    fontWeight: 850,
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
  totalLabel: { padding: "4px 0 3px", borderTop: "0", fontWeight: 850 },
  totalAmount: {
    padding: "4px 3px 3px",
    width: 72,
    borderTop: "1px solid #111827",
    borderBottom: "1.5px solid #111827",
    textAlign: "right",
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  subheading: { padding: "6px 0 2px", fontWeight: 850, borderBottom: "0" },
  cashGroupHeading: {
    padding: "7px 0 2px",
    fontWeight: 900,
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
  matrixScroll: { overflowX: "auto", maxWidth: "100%" },
  amountTd: { padding: "2px", borderBottom: "0", textAlign: "right" },
};
