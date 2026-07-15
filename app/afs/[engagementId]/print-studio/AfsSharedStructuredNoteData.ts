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

function collectSavedEntries(value: unknown): any[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectSavedEntries(entry));
  }

  if (typeof value !== "object") return [];

  const objectValue = value as Record<string, any>;
  const looksLikeEntry =
    "label" in objectValue ||
    "terms" in objectValue ||
    "loanTerms" in objectValue ||
    "accountCode" in objectValue ||
    "id" in objectValue;

  const ownEntry = looksLikeEntry ? [objectValue] : [];

  return [
    ...ownEntry,
    ...Object.values(objectValue).flatMap((entry) =>
      collectSavedEntries(entry),
    ),
  ];
}

export function resolveSharedStructuredNoteEntry(
  familyState: Record<string, any> | any[] | undefined,
  row: SharedNoteAmountLine,
  rowIndex?: number,
) {
  if (!familyState || typeof familyState !== "object") return {};

  const direct = clean(row.id || row.label);

  if (
    !Array.isArray(familyState) &&
    direct &&
    (familyState as Record<string, any>)[direct]
  ) {
    return (familyState as Record<string, any>)[direct];
  }

  const candidates = [
    row.id,
    row.meta?.accountCode,
    row.meta?.sourceLabel,
    row.label,
  ]
    .map(normalise)
    .filter(Boolean);

  const entries = collectSavedEntries(familyState);

  for (const entry of entries) {
    const entryCandidates = [
      entry?.id,
      entry?.key,
      entry?.accountCode,
      entry?.account_code,
      entry?.sourceLabel,
      entry?.label,
      entry?.name,
    ]
      .map(normalise)
      .filter(Boolean);

    if (entryCandidates.some((value) => candidates.includes(value))) {
      return entry || {};
    }
  }

  if (
    typeof rowIndex === "number" &&
    rowIndex >= 0 &&
    entries[rowIndex]
  ) {
    return entries[rowIndex];
  }

  return {};
}
