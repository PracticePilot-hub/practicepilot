export type SharedNoteAmountLine = {
  id?: string;
  label: string;
  current: number;
  prior: number;
  meta?: Record<string, any>;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currentAmount(line: any) {
  if (
    line?.current_year_balance !== null &&
    line?.current_year_balance !== undefined
  ) {
    return numberValue(line.current_year_balance);
  }

  return numberValue(line?.debit) - numberValue(line?.credit);
}

function priorAmount(line: any) {
  if (
    line?.prior_year_balance !== null &&
    line?.prior_year_balance !== undefined
  ) {
    return numberValue(line.prior_year_balance);
  }

  return 0;
}

function normaliseLiability(value: number) {
  return value > 0 ? -value : Math.abs(value);
}

function mappingStartsWith(line: any, prefixes: string[]) {
  /*
    NON-NEGOTIABLE:
    Structured-note classification is driven by mapping_code only.
    Labels, account names, lead schedules and paths may be displayed, but they
    never determine the note family.
  */
  const candidate = clean(line?.mapping_code).toLowerCase();
  if (!candidate) return false;

  return prefixes.some((prefix) => {
    const cleanPrefix = clean(prefix).toLowerCase();
    return (
      candidate === cleanPrefix ||
      candidate.startsWith(`${cleanPrefix}.`) ||
      candidate.startsWith(`${cleanPrefix}-`) ||
      candidate.startsWith(`${cleanPrefix} `)
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Mapping-driven note families                                               */
/* -------------------------------------------------------------------------- */

export function isSharedShareholderLoanLine(line: any) {
  return mappingStartsWith(line, ["548"]);
}

export function isSharedAssetFinanceLine(line: any) {
  /*
    Final superset mapping:
    550.40 = asset / vehicle finance (non-current)
    550.50 = instalment sale liabilities (non-current)
    610.30 = current portion of asset / vehicle finance
    610.40 = current portion of instalment sale liabilities
  */
  return mappingStartsWith(line, ["550.40", "550.50", "610.30", "610.40"]);
}

export function isSharedBankOverdraftLine(line: any) {
  return mappingStartsWith(line, ["620"]);
}

export function isSharedOtherFinancialLiabilityLine(line: any) {
  /*
    Other financial liabilities excludes the dedicated borrowing, asset-finance,
    lease, shareholder/group-loan, supplier-finance and overdraft families.

    560 = derivatives / complex non-current financial liabilities
    590 = other non-current liabilities of a financial-liability nature
    625 = current derivative / other financial liabilities
  */
  return (
    !isSharedShareholderLoanLine(line) &&
    !isSharedAssetFinanceLine(line) &&
    !isSharedBankOverdraftLine(line) &&
    mappingStartsWith(line, ["560", "590", "625"])
  );
}

function rowKey(line: any, index: number, fallback: string) {
  return String(
    line?.id ||
      line?.account_code ||
      line?.account_name ||
      line?.mapping_leaf_id ||
      line?.mapping_code ||
      `${fallback}-${index}`,
  );
}

function rowLabel(line: any, fallback: string) {
  return (
    clean(line?.account_name) ||
    clean(line?.description) ||
    clean(line?.mapping_label) ||
    clean(line?.mapping_category) ||
    fallback
  );
}

function buildRows(
  trialBalanceLines: any[],
  fallbackRows: SharedNoteAmountLine[],
  predicate: (line: any) => boolean,
  fallbackKey: string,
  fallbackLabel: string,
  noteFamily: string,
) {
  const grouped = new Map<string, SharedNoteAmountLine>();

  (trialBalanceLines || [])
    .filter(predicate)
    .forEach((line, index) => {
      const current = normaliseLiability(currentAmount(line));
      const prior = normaliseLiability(priorAmount(line));

      if (Math.round(current) === 0 && Math.round(prior) === 0) return;

      const id = rowKey(line, index, fallbackKey);
      const label = rowLabel(line, fallbackLabel);

      if (!grouped.has(id)) {
        grouped.set(id, {
          id,
          label,
          current: 0,
          prior: 0,
          meta: {
            noteFamily,
            accountCode: line?.account_code || null,
            mappingCode: line?.mapping_code || null,
            sourceLabel: label,
          },
        });
      }

      const row = grouped.get(id)!;
      row.current += current;
      row.prior += prior;
    });

  const rows = Array.from(grouped.values())
    .filter(
      (row) =>
        Math.round(row.current) !== 0 || Math.round(row.prior) !== 0,
    )
    .sort((a, b) => a.label.localeCompare(b.label));

  return rows.length ? rows : fallbackRows || [];
}

/* -------------------------------------------------------------------------- */
/* Public row builders                                                        */
/* -------------------------------------------------------------------------- */

export function buildSharedShareholderLoanRows(
  trialBalanceLines: any[],
  fallbackRows: SharedNoteAmountLine[] = [],
) {
  return buildRows(
    trialBalanceLines,
    fallbackRows,
    isSharedShareholderLoanLine,
    "shareholder-loan",
    "Shareholders’ loans",
    "shareholderLoans",
  );
}

export function buildSharedOtherFinancialLiabilityRows(
  trialBalanceLines: any[],
  fallbackRows: SharedNoteAmountLine[] = [],
) {
  return buildRows(
    trialBalanceLines,
    fallbackRows,
    isSharedOtherFinancialLiabilityLine,
    "other-financial-liability",
    "Other financial liabilities",
    "otherFinancialLiabilities",
  );
}

export function buildSharedAssetFinanceRows(
  trialBalanceLines: any[],
  fallbackRows: SharedNoteAmountLine[] = [],
) {
  return buildRows(
    trialBalanceLines,
    fallbackRows,
    isSharedAssetFinanceLine,
    "asset-finance",
    "Asset finance",
    "assetFinance",
  );
}

export function buildSharedBankOverdraftRows(
  trialBalanceLines: any[],
  fallbackRows: SharedNoteAmountLine[] = [],
) {
  return buildRows(
    trialBalanceLines,
    fallbackRows,
    isSharedBankOverdraftLine,
    "bank-overdraft",
    "Bank overdraft",
    "bankOverdraft",
  );
}

/* -------------------------------------------------------------------------- */
/* Saved structured-note state resolution                                     */
/* -------------------------------------------------------------------------- */

function normalise(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function resolveSharedStructuredNoteEntry(
  familyState: Record<string, any> | undefined,
  row: SharedNoteAmountLine,
) {
  if (!familyState || typeof familyState !== "object") return {};

  const direct = clean(row.id || row.label);
  if (direct && familyState[direct]) return familyState[direct];

  const candidates = [
    row.id,
    row.meta?.accountCode,
    row.meta?.sourceLabel,
    row.label,
  ]
    .map(normalise)
    .filter(Boolean);

  for (const [key, value] of Object.entries(familyState)) {
    if (candidates.includes(normalise(key))) return value || {};
  }

  return {};
}
