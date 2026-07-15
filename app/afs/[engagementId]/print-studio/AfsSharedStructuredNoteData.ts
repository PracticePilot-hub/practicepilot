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
  if (line?.current_year_balance !== null && line?.current_year_balance !== undefined) {
    return numberValue(line.current_year_balance);
  }
  return numberValue(line?.debit) - numberValue(line?.credit);
}

function priorAmount(line: any) {
  if (line?.prior_year_balance !== null && line?.prior_year_balance !== undefined) {
    return numberValue(line.prior_year_balance);
  }
  return 0;
}

function normaliseLiability(value: number) {
  return value > 0 ? -value : Math.abs(value);
}

function mappingStartsWith(line: any, prefixes: string[]) {
  return [line?.mapping_code, line?.lead_schedule_number, line?.lead_schedule_key]
    .map(clean)
    .filter(Boolean)
    .some((candidate) =>
      prefixes.some(
        (prefix) =>
          candidate === prefix ||
          candidate.startsWith(`${prefix}.`) ||
          candidate.startsWith(`${prefix}-`) ||
          candidate.startsWith(`${prefix} `),
      ),
    );
}

export function isSharedShareholderLoanLine(line: any) {
  return mappingStartsWith(line, ["548", "500.548"]);
}

export function isSharedOtherFinancialLiabilityLine(line: any) {
  return !isSharedShareholderLoanLine(line) &&
    mappingStartsWith(line, ["590", "500.590"]);
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

  (trialBalanceLines || []).filter(predicate).forEach((line, index) => {
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
          sourceLabel: label,
        },
      });
    }

    const row = grouped.get(id)!;
    row.current += current;
    row.prior += prior;
  });

  const rows = Array.from(grouped.values())
    .filter((row) => Math.round(row.current) !== 0 || Math.round(row.prior) !== 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  return rows.length ? rows : fallbackRows || [];
}

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
  ].map(normalise).filter(Boolean);

  for (const [key, value] of Object.entries(familyState)) {
    if (candidates.includes(normalise(key))) return value || {};
  }

  return {};
}