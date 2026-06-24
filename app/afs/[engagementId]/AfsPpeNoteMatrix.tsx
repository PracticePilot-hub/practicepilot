"use client";

import React, { CSSProperties, useEffect, useMemo, useState } from "react";

export type AfsPpeClassKey =
  | "land"
  | "buildings"
  | "leaseholdProperty"
  | "plantAndMachinery"
  | "furnitureAndFittings"
  | "motorVehicles"
  | "officeEquipment"
  | "itEquipment"
  | "computerSoftware"
  | "leaseholdImprovements"
  | "rightOfUseAssets"
  | "propertyPlantEquipment1"
  | "propertyPlantEquipment2"
  | "otherPpe1"
  | "otherPpe2"
  | "capitalWorkInProgress";

export type AfsPpeMovementKey =
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

export type AfsPpeMovementValues = Partial<Record<AfsPpeMovementKey, number>>;

export type AfsPpeClassRow = {
  key: AfsPpeClassKey | string;
  label: string;
  current: AfsPpeMovementValues;
  prior: AfsPpeMovementValues;
};

type Props = {
  noteNumber: number | string;
  currentYear: string;
  priorYear: string;
  rows?: AfsPpeClassRow[];
  isEditMode?: boolean;
  isEnabled?: boolean;
  onToggle?: (nextValue: boolean) => void;
  onChange?: (
    classKey: string,
    year: "current" | "prior",
    movementKey: AfsPpeMovementKey,
    value: number
  ) => void;
  onSave?: () => void;
};

const DEFAULT_PPE_ROWS: AfsPpeClassRow[] = [
  { key: "land", label: "Land", current: {}, prior: {} },
  { key: "buildings", label: "Buildings", current: {}, prior: {} },
  { key: "leaseholdProperty", label: "Leasehold property", current: {}, prior: {} },
  { key: "plantAndMachinery", label: "Plant and machinery", current: {}, prior: {} },
  { key: "furnitureAndFittings", label: "Furniture and fittings", current: {}, prior: {} },
  { key: "motorVehicles", label: "Motor vehicles", current: {}, prior: {} },
  { key: "officeEquipment", label: "Office equipment", current: {}, prior: {} },
  { key: "itEquipment", label: "IT equipment", current: {}, prior: {} },
  { key: "computerSoftware", label: "Computer software", current: {}, prior: {} },
  { key: "leaseholdImprovements", label: "Leasehold improvements", current: {}, prior: {} },
  { key: "rightOfUseAssets", label: "Right-of-use assets", current: {}, prior: {} },
  { key: "propertyPlantEquipment1", label: "PPE 1", current: {}, prior: {} },
  { key: "propertyPlantEquipment2", label: "PPE 2", current: {}, prior: {} },
  { key: "otherPpe1", label: "Other PPE 1", current: {}, prior: {} },
  { key: "otherPpe2", label: "Other PPE 2", current: {}, prior: {} },
  { key: "capitalWorkInProgress", label: "Capital WIP", current: {}, prior: {} },
];

const COST_MOVEMENTS: { key: AfsPpeMovementKey; label: string }[] = [
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

const ACC_DEP_MOVEMENTS: { key: AfsPpeMovementKey; label: string }[] = [
  { key: "openingAccumulatedDepreciation", label: "Opening" },
  { key: "depreciation", label: "Depreciation" },
  { key: "impairmentLosses", label: "Impairment" },
  { key: "impairmentReversal", label: "Reversal" },
  { key: "accumulatedDepreciationDisposals", label: "Disposals" },
  { key: "accumulatedDepreciationTransfers", label: "Transfers" },
  { key: "accumulatedDepreciationOtherMovements", label: "Other" },
];

type WorkTab = "summary" | "current-cost" | "current-dep" | "prior-cost" | "prior-dep" | "disclosures";

export default function AfsPpeNoteMatrix({
  noteNumber,
  currentYear,
  priorYear,
  rows,
  isEditMode = false,
  isEnabled = true,
  onToggle,
  onChange,
  onSave,
}: Props) {
  const [draftRows, setDraftRows] = useState<AfsPpeClassRow[]>(rows?.length ? rows : DEFAULT_PPE_ROWS);
  const [tab, setTab] = useState<WorkTab>("summary");

  const displayCurrentYear = normalisePpeYearLabel(currentYear);
  const displayPriorYear = normalisePriorPpeYearLabel(currentYear, priorYear);

  useEffect(() => {
    setDraftRows(rows?.length ? rows : DEFAULT_PPE_ROWS);
  }, [rows]);

  const populatedRows = useMemo(() => draftRows.filter((row) => hasAnyValue(row)), [draftRows]);
  const statementRows = populatedRows;

  const handleMovementChange = (
    classKey: string,
    year: "current" | "prior",
    movementKey: AfsPpeMovementKey,
    value: number
  ) => {
    setDraftRows((currentRows) =>
      currentRows.map((row) =>
        String(row.key) === String(classKey)
          ? { ...row, [year]: { ...row[year], [movementKey]: value } }
          : row
      )
    );

    onChange?.(classKey, year, movementKey, value);
  };

  if (!isEnabled && !isEditMode) return null;

  if (!isEnabled && isEditMode) {
    return (
      <section id={`afs-note-${noteNumber}`} style={styles.disabledNote}>
        <div style={styles.noteHeadingRow}>
          <h3 style={styles.noteTitle}>Property, plant and equipment</h3>
          <button type="button" style={styles.offToggle} onClick={() => onToggle?.(true)}>
            Off
          </button>
        </div>
        <p style={styles.disabledText}>Note switched off. Turn it on to include this disclosure and assign a note number.</p>
      </section>
    );
  }

  if (isEditMode) {
    return (
      <section id={`afs-note-${noteNumber}`} style={styles.wpSection}>
        <div style={styles.noteHeadingRow}>
          <div>
            <h3 style={styles.noteTitle}>{noteNumber ? `${noteNumber}. ` : ""}Property, plant and equipment</h3>
            <p style={styles.wpSubtitle}>PPE editor split into CaseWare-style tabs so it fits the screen.</p>
          </div>
          <button type="button" style={styles.onToggle} onClick={() => onToggle?.(false)}>
            On
          </button>
        </div>

        <div style={styles.tabBar}>
          <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>Summary</TabButton>
          <TabButton active={tab === "current-cost"} onClick={() => setTab("current-cost")}>{displayCurrentYear} cost</TabButton>
          <TabButton active={tab === "current-dep"} onClick={() => setTab("current-dep")}>{displayCurrentYear} dep.</TabButton>
          <TabButton active={tab === "prior-cost"} onClick={() => setTab("prior-cost")}>{displayPriorYear} cost</TabButton>
          <TabButton active={tab === "prior-dep"} onClick={() => setTab("prior-dep")}>{displayPriorYear} dep.</TabButton>
          <TabButton active={tab === "disclosures"} onClick={() => setTab("disclosures")}>Text</TabButton>
        </div>

        {tab === "summary" ? <WorkingSummaryTable currentYear={displayCurrentYear} priorYear={displayPriorYear} rows={draftRows} /> : null}
        {tab === "current-cost" ? (
          <CompactMovementEditor
            title={`Cost / valuation reconciliation - ${displayCurrentYear}`}
            rows={draftRows}
            year="current"
            movements={COST_MOVEMENTS}
            totalLabel="Closing cost / valuation"
            totalGetter={closingCost}
            onChange={handleMovementChange}
          />
        ) : null}
        {tab === "current-dep" ? (
          <CompactMovementEditor
            title={`Accumulated depreciation / impairment reconciliation - ${displayCurrentYear}`}
            rows={draftRows}
            year="current"
            movements={ACC_DEP_MOVEMENTS}
            totalLabel="Closing accumulated depreciation / impairment"
            totalGetter={closingAccumulatedDepreciation}
            onChange={handleMovementChange}
          />
        ) : null}
        {tab === "prior-cost" ? (
          <CompactMovementEditor
            title={`Cost / valuation reconciliation - ${displayPriorYear}`}
            rows={draftRows}
            year="prior"
            movements={COST_MOVEMENTS}
            totalLabel="Closing cost / valuation"
            totalGetter={closingCost}
            onChange={handleMovementChange}
          />
        ) : null}
        {tab === "prior-dep" ? (
          <CompactMovementEditor
            title={`Accumulated depreciation / impairment reconciliation - ${displayPriorYear}`}
            rows={draftRows}
            year="prior"
            movements={ACC_DEP_MOVEMENTS}
            totalLabel="Closing accumulated depreciation / impairment"
            totalGetter={closingAccumulatedDepreciation}
            onChange={handleMovementChange}
          />
        ) : null}
        {tab === "disclosures" ? <PpeDisclosureEditor /> : null}

        <div style={styles.actions}>
          <button type="button" style={styles.saveButton} onClick={onSave}>
            Save PPE note
          </button>
        </div>
      </section>
    );
  }

  return (
    <PpeFinancialStatementNote
      noteNumber={noteNumber}
      currentYear={displayCurrentYear}
      priorYear={displayPriorYear}
      rows={statementRows}
    />
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" style={active ? styles.activeTab : styles.tab} onClick={onClick}>
      {children}
    </button>
  );
}

function PpeFinancialStatementNote({
  noteNumber,
  currentYear,
  priorYear,
  rows,
}: {
  noteNumber: number | string;
  currentYear: string;
  priorYear: string;
  rows: AfsPpeClassRow[];
}) {
  if (!rows.length) return null;

  return (
    <section id={`afs-note-${noteNumber}`} style={styles.fsNoteSection}>
      <h3 style={styles.fsNoteTitle}>{noteNumber ? `${noteNumber}. ` : ""}Property, plant and equipment</h3>
      <p style={styles.fsParagraph}>
        Property, plant and equipment are tangible assets held for use in the production or supply of goods or services,
        for rental to others, or for administrative purposes.
      </p>

      <FinancialSummaryTable currentYear={currentYear} priorYear={priorYear} rows={rows} />
      <FinancialMovementTable title={`Reconciliation of property, plant and equipment - ${currentYear}`} year="current" rows={rows} />
      <FinancialMovementTable title={`Reconciliation of property, plant and equipment - ${priorYear}`} year="prior" rows={rows} />
    </section>
  );
}

function WorkingSummaryTable({
  currentYear,
  priorYear,
  rows,
}: {
  currentYear: string;
  priorYear: string;
  rows: AfsPpeClassRow[];
}) {
  return (
    <div style={styles.compactWrap}>
      <table style={styles.compactTable}>
        <thead>
          <tr>
            <th style={styles.stickyTh}>Asset class</th>
            <th style={styles.compactTh} colSpan={3}>{currentYear}</th>
            <th style={styles.compactTh} colSpan={3}>{priorYear}</th>
          </tr>
          <tr>
            <th style={styles.stickyTh}></th>
            <th style={styles.compactTh}>Cost</th>
            <th style={styles.compactTh}>Acc. dep</th>
            <th style={styles.compactTh}>Carrying</th>
            <th style={styles.compactTh}>Cost</th>
            <th style={styles.compactTh}>Acc. dep</th>
            <th style={styles.compactTh}>Carrying</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`summary-${row.key}`}>
              <td style={styles.stickyTd}>{row.label}</td>
              <AmountCell value={closingCost(row.current)} />
              <AmountCell value={closingAccumulatedDepreciation(row.current)} />
              <AmountCell value={carryingAmount(row.current)} strong />
              <AmountCell value={closingCost(row.prior)} />
              <AmountCell value={closingAccumulatedDepreciation(row.prior)} />
              <AmountCell value={carryingAmount(row.prior)} strong />
            </tr>
          ))}
          <tr>
            <td style={styles.stickyTotal}>Total</td>
            <AmountCell value={sumRows(rows, "current", closingCost)} strong total />
            <AmountCell value={sumRows(rows, "current", closingAccumulatedDepreciation)} strong total />
            <AmountCell value={sumRows(rows, "current", carryingAmount)} strong total />
            <AmountCell value={sumRows(rows, "prior", closingCost)} strong total />
            <AmountCell value={sumRows(rows, "prior", closingAccumulatedDepreciation)} strong total />
            <AmountCell value={sumRows(rows, "prior", carryingAmount)} strong total />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CompactMovementEditor({
  title,
  rows,
  year,
  movements,
  totalLabel,
  totalGetter,
  onChange,
}: {
  title: string;
  rows: AfsPpeClassRow[];
  year: "current" | "prior";
  movements: { key: AfsPpeMovementKey; label: string }[];
  totalLabel: string;
  totalGetter: (values: AfsPpeMovementValues) => number;
  onChange?: Props["onChange"];
}) {
  return (
    <div style={styles.compactWrap}>
      <table style={styles.compactTable}>
        <thead>
          <tr>
            <th style={styles.stickyTh}>{title}</th>
            {movements.map((movement) => (
              <th key={movement.key} style={styles.compactTh}>{movement.label}</th>
            ))}
            <th style={styles.compactTh}>{totalLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.key}`}>
              <td style={styles.stickyTd}>{row.label}</td>
              {movements.map((movement) => (
                <EditableCell
                  key={movement.key}
                  row={row}
                  year={year}
                  movementKey={movement.key}
                  value={numberValue(row[year][movement.key])}
                  onChange={onChange}
                />
              ))}
              <AmountCell value={totalGetter(row[year])} strong />
            </tr>
          ))}
          <tr>
            <td style={styles.stickyTotal}>Total</td>
            {movements.map((movement) => (
              <AmountCell
                key={movement.key}
                value={sumRows(rows, year, (values) => numberValue(values[movement.key]))}
                strong
                total
              />
            ))}
            <AmountCell value={sumRows(rows, year, totalGetter)} strong total />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PpeDisclosureEditor() {
  return (
    <div style={styles.disclosureGrid}>
      <div style={styles.disclosureLabel}>Pledged as security</div>
      <textarea style={styles.disclosureInput} placeholder="Insert details where applicable" />
      <div style={styles.disclosureLabel}>Restrictions on title</div>
      <textarea style={styles.disclosureInput} placeholder="Insert details where applicable" />
      <div style={styles.disclosureLabel}>Capital commitments</div>
      <textarea style={styles.disclosureInput} placeholder="Insert details where applicable" />
      <div style={styles.disclosureLabel}>Compensation from third parties</div>
      <textarea style={styles.disclosureInput} placeholder="Insert details where applicable" />
    </div>
  );
}

function EditableCell({
  row,
  year,
  movementKey,
  value,
  onChange,
}: {
  row: AfsPpeClassRow;
  year: "current" | "prior";
  movementKey: AfsPpeMovementKey;
  value: number;
  onChange?: Props["onChange"];
}) {
  return (
    <td style={styles.amountTd}>
      <input
        type="number"
        step="0.01"
        value={value === 0 ? "" : String(value)}
        onChange={(event) => onChange?.(String(row.key), year, movementKey, numberValue(event.target.value))}
        style={styles.amountInput}
      />
    </td>
  );
}

function FinancialSummaryTable({
  currentYear,
  priorYear,
  rows,
}: {
  currentYear: string;
  priorYear: string;
  rows: AfsPpeClassRow[];
}) {
  return (
    <table style={styles.fsTable}>
      <thead>
        <tr>
          <th style={styles.fsThLeft}>Summary of property, plant and equipment</th>
          <th style={styles.fsTh} colSpan={3}>{currentYear}</th>
          <th style={styles.fsTh} colSpan={3}>{priorYear}</th>
        </tr>
        <tr>
          <th style={styles.fsThLeft}></th>
          <th style={styles.fsTh}>Cost / valuation</th>
          <th style={styles.fsTh}>Accumulated depreciation and impairment</th>
          <th style={styles.fsTh}>Carrying value</th>
          <th style={styles.fsTh}>Cost / valuation</th>
          <th style={styles.fsTh}>Accumulated depreciation and impairment</th>
          <th style={styles.fsTh}>Carrying value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`fs-summary-${row.key}`}>
            <td style={styles.fsTdLeft}>{row.label}</td>
            <AmountCell value={closingCost(row.current)} />
            <AmountCell value={closingAccumulatedDepreciation(row.current)} />
            <AmountCell value={carryingAmount(row.current)} strong />
            <AmountCell value={closingCost(row.prior)} />
            <AmountCell value={closingAccumulatedDepreciation(row.prior)} />
            <AmountCell value={carryingAmount(row.prior)} strong />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FinancialMovementTable({
  title,
  year,
  rows,
}: {
  title: string;
  year: "current" | "prior";
  rows: AfsPpeClassRow[];
}) {
  return (
    <table style={styles.fsTable}>
      <thead>
        <tr>
          <th style={styles.fsThLeft}>{title}</th>
          {rows.map((row) => (
            <th key={row.key} style={styles.fsTh}>{row.label}</th>
          ))}
          <th style={styles.fsTh}>Total</th>
        </tr>
      </thead>
      <tbody>
        {movementStatementRows().map((movement) => {
          const values = rows.map((row) => movement.get(row[year]));
          const total = values.reduce((sum, value) => sum + value, 0);
          if (total === 0 && values.every((value) => value === 0)) return null;

          return (
            <tr key={movement.label}>
              <td style={movement.bold ? styles.fsTotalLeft : styles.fsTdLeft}>{movement.label}</td>
              {values.map((value, index) => (
                <AmountCell key={`${movement.label}-${index}`} value={value} strong={movement.bold} total={movement.bold} />
              ))}
              <AmountCell value={total} strong={movement.bold} total={movement.bold} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AmountCell({ value, strong, total }: { value: number; strong?: boolean; total?: boolean }) {
  return (
    <td style={{ ...styles.amountTd, ...(strong ? styles.strongAmount : {}), ...(total ? styles.totalAmount : {}) }}>
      {formatAmount(value)}
    </td>
  );
}

function movementStatementRows() {
  return [
    { label: "Opening carrying amount", get: carryingAmount, bold: false },
    { label: "Additions", get: (values: AfsPpeMovementValues) => numberValue(values.additions), bold: false },
    { label: "Disposals", get: (values: AfsPpeMovementValues) => -numberValue(values.disposals), bold: false },
    { label: "Transfers", get: (values: AfsPpeMovementValues) => numberValue(values.transfers), bold: false },
    { label: "Revaluations", get: (values: AfsPpeMovementValues) => numberValue(values.revaluations), bold: false },
    { label: "Depreciation", get: (values: AfsPpeMovementValues) => -numberValue(values.depreciation), bold: false },
    { label: "Impairment losses", get: (values: AfsPpeMovementValues) => -numberValue(values.impairmentLosses), bold: false },
    { label: "Impairment reversals", get: (values: AfsPpeMovementValues) => numberValue(values.impairmentReversal), bold: false },
    { label: "Closing carrying amount", get: carryingAmount, bold: true },
  ];
}

function closingCost(values: AfsPpeMovementValues) {
  return (
    numberValue(values.openingCost) +
    numberValue(values.additions) +
    numberValue(values.additionsBusinessCombinations) -
    numberValue(values.disposals) +
    numberValue(values.transfers) +
    numberValue(values.revaluations) +
    numberValue(values.foreignExchangeMovements) +
    numberValue(values.decommissioningLiability) +
    numberValue(values.otherMovements)
  );
}

function closingAccumulatedDepreciation(values: AfsPpeMovementValues) {
  return (
    numberValue(values.openingAccumulatedDepreciation) +
    numberValue(values.depreciation) +
    numberValue(values.impairmentLosses) -
    numberValue(values.impairmentReversal) -
    numberValue(values.accumulatedDepreciationDisposals) +
    numberValue(values.accumulatedDepreciationTransfers) +
    numberValue(values.accumulatedDepreciationOtherMovements)
  );
}

function carryingAmount(values: AfsPpeMovementValues) {
  return closingCost(values) - closingAccumulatedDepreciation(values);
}

function hasAnyValue(row: AfsPpeClassRow) {
  return (
    Object.values(row.current || {}).some((value) => numberValue(value) !== 0) ||
    Object.values(row.prior || {}).some((value) => numberValue(value) !== 0)
  );
}

function sumRows(rows: AfsPpeClassRow[], year: "current" | "prior", getter: (values: AfsPpeMovementValues) => number) {
  return rows.reduce((total, row) => total + getter(row[year]), 0);
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number) {
  const amount = numberValue(value);
  if (amount === 0) return "-";

  const absolute = Math.abs(amount)
    .toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/,/g, " ");

  return amount < 0 ? `(${absolute})` : absolute;
}


function normalisePpeYearLabel(label: string) {
  return String(label || "").trim();
}

function normalisePriorPpeYearLabel(currentLabel: string, fallbackLabel: string) {
  const current = String(currentLabel || "");
  const fallback = String(fallbackLabel || "").trim();

  const currentDate = extractDateFromLabel(current);
  if (!currentDate) return fallback;

  const priorDate = new Date(currentDate);
  priorDate.setFullYear(currentDate.getFullYear() - 1);

  /*
    JavaScript rolls 29 February 2024 back to 01 March 2023 when only setFullYear is used.
    Force the correct Companies Act/AFS prior year-end date: 28 February 2023.
  */
  if (currentDate.getMonth() === 1 && currentDate.getDate() === 29 && priorDate.getMonth() === 2) {
    priorDate.setMonth(1);
    priorDate.setDate(28);
  }

  return replaceDateInLabel(current, priorDate);
}

function extractDateFromLabel(label: string) {
  const match = label.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = monthIndex(match[2]);
  const year = Number(match[3]);

  if (!Number.isFinite(day) || month < 0 || !Number.isFinite(year)) return null;

  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;

  return date;
}

function replaceDateInLabel(label: string, date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthName(date.getMonth());
  const year = date.getFullYear();

  return label.replace(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/, `${day} ${month} ${year}`);
}

function monthIndex(month: string) {
  return [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(month.toLowerCase());
}

function monthName(index: number) {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][index] || "";
}


const styles: Record<string, CSSProperties> = {
  disabledNote: {
    margin: "14px 0",
    padding: "8px 0",
    color: "#94a3b8",
    borderTop: "1px solid #e2e8f0",
  },
  noteHeadingRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  },
  noteTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 900,
    color: "#0f172a",
  },
  disabledText: {
    margin: "4px 0 0",
    fontSize: "11px",
    color: "#64748b",
  },
  onToggle: {
    border: "1px solid #86efac",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "2px 10px",
    fontSize: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  offToggle: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    borderRadius: "999px",
    padding: "2px 10px",
    fontSize: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  wpSection: {
    margin: "20px 0 28px",
    padding: "10px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
  },
  wpSubtitle: {
    margin: "3px 0 0",
    fontSize: "10px",
    color: "#64748b",
  },
  tabBar: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
    margin: "8px 0 10px",
    borderBottom: "1px solid #cbd5e1",
    paddingBottom: "6px",
  },
  tab: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "4px 8px",
    fontSize: "10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  activeTab: {
    border: "1px solid #1d4ed8",
    background: "#dbeafe",
    color: "#1d4ed8",
    padding: "4px 8px",
    fontSize: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  compactWrap: {
    width: "100%",
    overflowX: "auto",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  compactTable: {
    borderCollapse: "collapse",
    width: "100%",
    minWidth: "820px",
    fontSize: "10px",
    color: "#0f172a",
  },
  stickyTh: {
    position: "sticky",
    left: 0,
    zIndex: 2,
    background: "#f8fafc",
    textAlign: "left",
    borderTop: "1px solid #111827",
    borderBottom: "1px solid #111827",
    padding: "5px 6px",
    minWidth: "150px",
    fontWeight: 900,
  },
  stickyTd: {
    position: "sticky",
    left: 0,
    zIndex: 1,
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    padding: "4px 6px",
    minWidth: "150px",
    fontWeight: 700,
  },
  stickyTotal: {
    position: "sticky",
    left: 0,
    zIndex: 1,
    background: "#ffffff",
    borderTop: "1px solid #111827",
    borderBottom: "2px solid #111827",
    padding: "4px 6px",
    minWidth: "150px",
    fontWeight: 900,
  },
  compactTh: {
    textAlign: "right",
    borderTop: "1px solid #111827",
    borderBottom: "1px solid #111827",
    padding: "5px 5px",
    minWidth: "72px",
    fontWeight: 900,
    background: "#f8fafc",
  },
  amountTd: {
    borderBottom: "1px solid #e5e7eb",
    padding: "4px 5px",
    textAlign: "right",
    whiteSpace: "nowrap",
    minWidth: "72px",
  },
  amountInput: {
    width: "58px",
    border: "1px solid #cbd5e1",
    background: "#fff9c4",
    padding: "2px 4px",
    textAlign: "right",
    fontSize: "10px",
    fontFamily: "inherit",
  },
  strongAmount: {
    fontWeight: 900,
  },
  totalAmount: {
    borderTop: "1px solid #111827",
    borderBottom: "2px solid #111827",
  },
  disclosureGrid: {
    display: "grid",
    gridTemplateColumns: "170px 1fr",
    borderTop: "1px solid #cbd5e1",
    borderLeft: "1px solid #cbd5e1",
    fontSize: "10.5px",
    background: "#ffffff",
  },
  disclosureLabel: {
    padding: "5px 6px",
    borderRight: "1px solid #cbd5e1",
    borderBottom: "1px solid #cbd5e1",
    fontWeight: 800,
    background: "#f8fafc",
  },
  disclosureInput: {
    minHeight: "34px",
    padding: "5px 6px",
    border: "0",
    borderRight: "1px solid #cbd5e1",
    borderBottom: "1px solid #cbd5e1",
    background: "#dcfce7",
    color: "#166534",
    resize: "vertical",
    fontFamily: "inherit",
    fontSize: "10.5px",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "8px",
  },
  saveButton: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff",
    padding: "5px 10px",
    fontSize: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  fsNoteSection: {
    margin: "22px 0 28px",
    paddingTop: "8px",
    borderTop: "1px solid #cbd5e1",
  },
  fsNoteTitle: {
    margin: "0 0 6px",
    fontSize: "14px",
    fontWeight: 900,
    color: "#0f172a",
  },
  fsParagraph: {
    margin: "0 0 10px",
    fontSize: "11px",
    lineHeight: 1.45,
    color: "#0f172a",
  },
  fsTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "10px",
    margin: "10px 0 16px",
    color: "#0f172a",
  },
  fsThLeft: {
    textAlign: "left",
    borderTop: "1px solid #111827",
    borderBottom: "1px solid #111827",
    padding: "5px 6px",
    fontWeight: 900,
  },
  fsTh: {
    textAlign: "right",
    borderTop: "1px solid #111827",
    borderBottom: "1px solid #111827",
    padding: "5px 6px",
    fontWeight: 900,
  },
  fsTdLeft: {
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    padding: "4px 6px",
  },
  fsTotalLeft: {
    textAlign: "left",
    borderTop: "1px solid #111827",
    borderBottom: "2px solid #111827",
    padding: "4px 6px",
    fontWeight: 900,
  },
};
