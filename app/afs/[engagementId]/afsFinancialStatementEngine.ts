export type AfsTrialBalanceLine = {
  id?: string;
  account_code?: string | null;
  account_name: string;
  current_year_balance?: number | null;
  prior_year_balance?: number | null;
  debit?: number | null;
  credit?: number | null;
  mapping_code?: string | null;
  lead_schedule_number?: string | null;
  lead_schedule_key?: string | null;
  mapping_label?: string | null;
  mapping_statement?: string | null;
  mapping_section?: string | null;
};

export type AfsJournalEffect = {
  trial_balance_line_id: string | null;
  posted_debits: number;
  posted_credits: number;
  net_adjustment: number;
};

export type AfsStatementLine = {
  key: string;
  label: string;
  current: number;
  prior: number;
  noteNumber?: string;
  children?: AfsStatementLine[];
  isTotal?: boolean;
  isSubtotal?: boolean;
};

type SignMode = "debit-positive" | "credit-positive";

type LeafDefinition = {
  key: string;
  label: string;
  prefixes: string[];
  sign: SignMode;
};

type GroupDefinition = {
  key: string;
  label: string;
  children: Array<GroupDefinition | LeafDefinition>;
};

export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function adjustedCurrentBalance(
  line: AfsTrialBalanceLine,
  journalEffects: AfsJournalEffect[] = []
): number {
  const effect = journalEffects.find((item) => item.trial_balance_line_id === line.id);

  if (line.current_year_balance !== undefined && line.current_year_balance !== null) {
    return toNumber(line.current_year_balance) + toNumber(effect?.net_adjustment);
  }

  return toNumber(line.debit) - toNumber(line.credit) + toNumber(effect?.net_adjustment);
}

export function formatMoney(value: number): string {
  const abs = Math.abs(toNumber(value));
  const formatted = abs.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return value < 0 ? `(${formatted})` : formatted;
}

function roundMoney(value: number): number {
  return Math.round(toNumber(value) * 100) / 100;
}

function hasValue(current: number, prior: number): boolean {
  return Math.abs(current) >= 0.005 || Math.abs(prior) >= 0.005;
}

function normalise(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

/*
  NON-NEGOTIABLE:
  Financial-statement classification is driven by mapping codes only.

  Do not classify from:
  - account names
  - account numbers
  - mapping labels
  - lead-schedule titles / keys
  - keywords

  Those may be used by the MappingPanel to SUGGEST a mapping, but once the
  preparer saves a mapping, this engine follows mapping_code only.
*/
function matchesPrefix(line: AfsTrialBalanceLine, prefixes: string[]): boolean {
  const mappingCode = normalise(line.mapping_code);
  if (!mappingCode) return false;

  return prefixes.some((prefix) => {
    const clean = normalise(prefix);
    if (!clean) return false;

    return (
      mappingCode === clean ||
      mappingCode.startsWith(`${clean}.`) ||
      mappingCode.startsWith(`${clean}-`) ||
      mappingCode.startsWith(`${clean} `)
    );
  });
}

function signedAmount(rawAmount: number, sign: SignMode): number {
  return sign === "credit-positive" ? -rawAmount : rawAmount;
}

function sumLeaf(
  lines: AfsTrialBalanceLine[],
  definition: LeafDefinition,
  journalEffects: AfsJournalEffect[]
) {
  return lines.reduce(
    (acc, line) => {
      if (!matchesPrefix(line, definition.prefixes)) return acc;

      return {
        current: acc.current + signedAmount(adjustedCurrentBalance(line, journalEffects), definition.sign),
        prior: acc.prior + signedAmount(toNumber(line.prior_year_balance), definition.sign),
      };
    },
    { current: 0, prior: 0 }
  );
}

function isGroupDefinition(item: GroupDefinition | LeafDefinition): item is GroupDefinition {
  return Array.isArray((item as GroupDefinition).children);
}

function buildNode(
  lines: AfsTrialBalanceLine[],
  definition: GroupDefinition | LeafDefinition,
  journalEffects: AfsJournalEffect[]
): AfsStatementLine | null {
  if (isGroupDefinition(definition)) {
    const children = definition.children
      .map((child) => buildNode(lines, child, journalEffects))
      .filter(Boolean) as AfsStatementLine[];

    const current = roundMoney(children.reduce((total, child) => total + toNumber(child.current), 0));
    const prior = roundMoney(children.reduce((total, child) => total + toNumber(child.prior), 0));

    if (!children.length && !hasValue(current, prior)) return null;

    return {
      key: definition.key,
      label: definition.label,
      current,
      prior,
      children,
    };
  }

  const totals = sumLeaf(lines, definition, journalEffects);
  const current = roundMoney(totals.current);
  const prior = roundMoney(totals.prior);

  if (!hasValue(current, prior)) return null;

  return {
    key: definition.key,
    label: definition.label,
    current,
    prior,
  };
}

function assignNoteNumbers(lines: AfsStatementLine[], startAt = 2): AfsStatementLine[] {
  let noteNumber = startAt;

  function walk(line: AfsStatementLine): AfsStatementLine {
    const children = (line.children || []).map(walk);

    if (children.length) {
      return { ...line, children, noteNumber: undefined };
    }

    if (line.isTotal || line.isSubtotal || !hasValue(line.current, line.prior)) {
      return { ...line, noteNumber: undefined };
    }

    const assigned = String(noteNumber);
    noteNumber += 1;

    return { ...line, noteNumber: assigned };
  }

  return lines.map(walk);
}

const sfpDefinition: GroupDefinition[] = [
  {
    key: "assets",
    label: "Assets",
    children: [
      {
        key: "non-current-assets",
        label: "Non-current assets",
        children: [
          {
            key: "property-plant-and-equipment",
            label: "Property, plant and equipment",
            prefixes: ["305"],
            sign: "debit-positive",
          },
          {
            key: "right-of-use-assets",
            label: "Right-of-use assets",
            prefixes: ["306"],
            sign: "debit-positive",
          },
          {
            key: "investment-property",
            label: "Investment property",
            prefixes: ["310"],
            sign: "debit-positive",
          },
          {
            key: "intangible-assets",
            label: "Intangible assets",
            prefixes: ["320"],
            sign: "debit-positive",
          },
          {
            key: "goodwill",
            label: "Goodwill",
            prefixes: ["321"],
            sign: "debit-positive",
          },
          {
            key: "investments",
            label: "Investments",
            prefixes: ["326", "327", "328", "329"],
            sign: "debit-positive",
          },
          {
            key: "biological-assets-non-current",
            label: "Biological assets",
            prefixes: ["330"],
            sign: "debit-positive",
          },
          {
            key: "long-term-loans-receivable",
            label: "Loans receivable",
            prefixes: ["340"],
            sign: "debit-positive",
          },
          {
            key: "other-non-current-financial-assets",
            label: "Other financial assets",
            prefixes: ["350"],
            sign: "debit-positive",
          },
          {
            key: "other-non-current-assets",
            label: "Other non-current assets",
            prefixes: ["390"],
            sign: "debit-positive",
          },
          {
            key: "deferred-tax-asset",
            label: "Deferred tax asset",
            prefixes: ["395"],
            sign: "debit-positive",
          },
        ],
      },
      {
        key: "current-assets",
        label: "Current assets",
        children: [
          {
            key: "inventories",
            label: "Inventories",
            prefixes: ["405"],
            sign: "debit-positive",
          },
          {
            key: "biological-assets-current",
            label: "Biological assets",
            prefixes: ["410"],
            sign: "debit-positive",
          },
          {
            key: "contract-assets",
            label: "Contract assets",
            prefixes: ["415"],
            sign: "debit-positive",
          },
          {
            key: "cash-and-cash-equivalents",
            label: "Bank, cash and cash equivalents",
            prefixes: ["420"],
            sign: "debit-positive",
          },
          {
            key: "trade-and-other-receivables",
            label: "Trade and other receivables",
            prefixes: ["430"],
            sign: "debit-positive",
          },
          {
            key: "current-financial-assets",
            label: "Current financial assets",
            prefixes: ["435"],
            sign: "debit-positive",
          },
          {
            key: "current-loans-receivable",
            label: "Loans receivable",
            prefixes: ["449"],
            sign: "debit-positive",
          },
          {
            key: "tax-and-statutory-receivables",
            label: "Tax and statutory receivables",
            prefixes: ["490"],
            sign: "debit-positive",
          },
          {
            key: "current-tax-receivable",
            label: "Current tax receivable",
            prefixes: ["495"],
            sign: "debit-positive",
          },
          {
            key: "assets-held-for-sale",
            label: "Assets held for sale",
            prefixes: ["499"],
            sign: "debit-positive",
          },
        ],
      },
    ],
  },
  {
    key: "equity-and-liabilities",
    label: "Equity and liabilities",
    children: [
      {
        key: "equity",
        label: "Equity",
        children: [
          {
            key: "share-capital",
            label: "Share capital / contributions",
            prefixes: ["805"],
            sign: "credit-positive",
          },
          {
            key: "retained-income",
            label: "Retained income / (accumulated loss)",
            prefixes: ["810"],
            sign: "credit-positive",
          },
          {
            key: "reserves",
            label: "Reserves",
            prefixes: ["820"],
            sign: "credit-positive",
          },
          {
            key: "non-controlling-interests",
            label: "Non-controlling interests",
            prefixes: ["830"],
            sign: "credit-positive",
          },
          {
            key: "other-equity",
            label: "Other equity",
            prefixes: ["840"],
            sign: "credit-positive",
          },
        ],
      },
      {
        key: "liabilities",
        label: "Liabilities",
        children: [
          {
            key: "non-current-liabilities",
            label: "Non-current liabilities",
            children: [
              {
                key: "non-current-provisions",
                label: "Provisions",
                prefixes: ["515"],
                sign: "credit-positive",
              },
              {
                key: "employee-benefit-obligations-non-current",
                label: "Employee benefit obligations",
                prefixes: ["520"],
                sign: "credit-positive",
              },
              {
                key: "deferred-income-non-current",
                label: "Deferred income / grants",
                prefixes: ["531"],
                sign: "credit-positive",
              },
              {
                key: "group-related-party-borrowings",
                label: "Group and related-party borrowings",
                prefixes: ["547"],
                sign: "credit-positive",
              },
              {
                key: "shareholders-loans",
                label: "Shareholder / director / member loans",
                prefixes: ["548"],
                sign: "credit-positive",
              },
              {
                key: "long-term-borrowings",
                label: "Borrowings",
                prefixes: ["550", "551"],
                sign: "credit-positive",
              },
              {
                key: "lease-liabilities-non-current",
                label: "Lease liabilities",
                prefixes: ["555"],
                sign: "credit-positive",
              },
              {
                key: "complex-financial-liabilities-non-current",
                label: "Other financial liabilities",
                prefixes: ["560"],
                sign: "credit-positive",
              },
              {
                key: "supplier-finance-non-current",
                label: "Supplier finance arrangements",
                prefixes: ["580"],
                sign: "credit-positive",
              },
              {
                key: "other-non-current-liabilities",
                label: "Other non-current liabilities",
                prefixes: ["590"],
                sign: "credit-positive",
              },
              {
                key: "deferred-tax-liability",
                label: "Deferred tax liability",
                prefixes: ["595"],
                sign: "credit-positive",
              },
            ],
          },
          {
            key: "current-liabilities",
            label: "Current liabilities",
            children: [
              {
                key: "current-borrowings",
                label: "Borrowings",
                prefixes: ["610"],
                sign: "credit-positive",
              },
              {
                key: "lease-liabilities-current",
                label: "Lease liabilities",
                prefixes: ["615"],
                sign: "credit-positive",
              },
              {
                key: "bank-overdraft",
                label: "Bank overdraft",
                prefixes: ["620"],
                sign: "credit-positive",
              },
              {
                key: "current-derivative-financial-liabilities",
                label: "Other financial liabilities",
                prefixes: ["625"],
                sign: "credit-positive",
              },
              {
                key: "trade-and-other-payables",
                label: "Trade and other payables",
                prefixes: ["630"],
                sign: "credit-positive",
              },
              {
                key: "contract-liabilities",
                label: "Contract liabilities / deferred revenue",
                prefixes: ["640"],
                sign: "credit-positive",
              },
              {
                key: "deferred-income-current",
                label: "Deferred income / grants",
                prefixes: ["650"],
                sign: "credit-positive",
              },
              {
                key: "current-provisions",
                label: "Provisions",
                prefixes: ["660"],
                sign: "credit-positive",
              },
              {
                key: "employee-benefit-liabilities-current",
                label: "Employee benefit liabilities",
                prefixes: ["670"],
                sign: "credit-positive",
              },
              {
                key: "supplier-finance-current",
                label: "Supplier finance arrangements",
                prefixes: ["680"],
                sign: "credit-positive",
              },
              {
                key: "dividend-payable",
                label: "Dividend payable",
                prefixes: ["688"],
                sign: "credit-positive",
              },
              {
                key: "tax-and-statutory-payables",
                label: "Tax and statutory payables",
                prefixes: ["690"],
                sign: "credit-positive",
              },
              {
                key: "current-tax-payable",
                label: "Current tax payable",
                prefixes: ["695"],
                sign: "credit-positive",
              },
              {
                key: "liabilities-held-for-sale",
                label: "Liabilities held for sale",
                prefixes: ["699"],
                sign: "credit-positive",
              },
            ],
          },
        ],
      },
    ],
  },
];

export function buildStatementOfFinancialPosition(
  lines: AfsTrialBalanceLine[],
  journalEffects: AfsJournalEffect[] = []
): AfsStatementLine[] {
  const built = sfpDefinition
    .map((definition) => buildNode(lines, definition, journalEffects))
    .filter(Boolean) as AfsStatementLine[];

  return assignNoteNumbers(built, 2);
}

function profitLine(
  lines: AfsTrialBalanceLine[],
  key: string,
  label: string,
  prefixes: string[],
  sign: SignMode,
  journalEffects: AfsJournalEffect[]
): AfsStatementLine | null {
  return buildNode(lines, { key, label, prefixes, sign }, journalEffects);
}

export function buildStatementOfProfitOrLoss(
  lines: AfsTrialBalanceLine[],
  journalEffects: AfsJournalEffect[] = []
): AfsStatementLine[] {
  const revenue = profitLine(
    lines,
    "revenue",
    "Revenue",
    ["700"],
    "credit-positive",
    journalEffects
  );

  const costOfSales = profitLine(
    lines,
    "cost-of-sales",
    "Cost of sales",
    ["720"],
    "debit-positive",
    journalEffects
  );

  const otherOperatingIncome = profitLine(
    lines,
    "other-operating-income",
    "Other operating income",
    ["730"],
    "credit-positive",
    journalEffects
  );

  const investmentIncome = profitLine(
    lines,
    "investment-income",
    "Investment income",
    ["770"],
    "credit-positive",
    journalEffects
  );

  const operatingExpenses = profitLine(
    lines,
    "operating-expenses",
    "Operating expenses",
    ["750"],
    "debit-positive",
    journalEffects
  );

  const financeCosts = profitLine(
    lines,
    "finance-costs",
    "Finance costs",
    ["775"],
    "debit-positive",
    journalEffects
  );

  const otherGainsLosses = profitLine(
    lines,
    "other-gains-losses",
    "Other gains / (losses)",
    ["780", "781", "785"],
    "credit-positive",
    journalEffects
  );

  const taxation = profitLine(
    lines,
    "taxation",
    "Taxation",
    ["795"],
    "debit-positive",
    journalEffects
  );

  const discontinuedOperations = profitLine(
    lines,
    "discontinued-operations",
    "Discontinued operations",
    ["799"],
    "credit-positive",
    journalEffects
  );

  const otherComprehensiveIncome = profitLine(
    lines,
    "other-comprehensive-income",
    "Other comprehensive income",
    ["797"],
    "credit-positive",
    journalEffects
  );

  const grossProfit = {
    key: "gross-profit",
    label: "Gross profit / (loss)",
    current: roundMoney(
      toNumber(revenue?.current) - toNumber(costOfSales?.current)
    ),
    prior: roundMoney(
      toNumber(revenue?.prior) - toNumber(costOfSales?.prior)
    ),
    isSubtotal: true,
  };

  const profitBeforeTax = {
    key: "profit-before-tax",
    label: "Profit / (loss) before taxation",
    current: roundMoney(
      toNumber(grossProfit.current) +
        toNumber(otherOperatingIncome?.current) +
        toNumber(investmentIncome?.current) -
        toNumber(operatingExpenses?.current) -
        toNumber(financeCosts?.current) +
        toNumber(otherGainsLosses?.current)
    ),
    prior: roundMoney(
      toNumber(grossProfit.prior) +
        toNumber(otherOperatingIncome?.prior) +
        toNumber(investmentIncome?.prior) -
        toNumber(operatingExpenses?.prior) -
        toNumber(financeCosts?.prior) +
        toNumber(otherGainsLosses?.prior)
    ),
    isSubtotal: true,
  };

  const profitFromContinuingOperations = {
    key: "profit-from-continuing-operations",
    label: "Profit / (loss) from continuing operations",
    current: roundMoney(
      toNumber(profitBeforeTax.current) - toNumber(taxation?.current)
    ),
    prior: roundMoney(
      toNumber(profitBeforeTax.prior) - toNumber(taxation?.prior)
    ),
    isSubtotal: true,
  };

  const profitAfterTax = {
    key: "profit-after-tax",
    label: "Profit / (loss) for the year",
    current: roundMoney(
      toNumber(profitFromContinuingOperations.current) +
        toNumber(discontinuedOperations?.current)
    ),
    prior: roundMoney(
      toNumber(profitFromContinuingOperations.prior) +
        toNumber(discontinuedOperations?.prior)
    ),
    isTotal: true,
  };

  const totalComprehensiveIncome = {
    key: "total-comprehensive-income",
    label: "Total comprehensive income / (loss)",
    current: roundMoney(
      toNumber(profitAfterTax.current) +
        toNumber(otherComprehensiveIncome?.current)
    ),
    prior: roundMoney(
      toNumber(profitAfterTax.prior) +
        toNumber(otherComprehensiveIncome?.prior)
    ),
    isTotal: true,
  };

  const zeroLine = (key: string, label: string): AfsStatementLine => ({
    key,
    label,
    current: 0,
    prior: 0,
  });

  const visible = [
    revenue || zeroLine("revenue", "Revenue"),
    costOfSales || zeroLine("cost-of-sales", "Cost of sales"),
    grossProfit,
    otherOperatingIncome ||
      zeroLine("other-operating-income", "Other operating income"),
    investmentIncome || zeroLine("investment-income", "Investment income"),
    operatingExpenses ||
      zeroLine("operating-expenses", "Operating expenses"),
    financeCosts || zeroLine("finance-costs", "Finance costs"),
    otherGainsLosses || zeroLine("other-gains-losses", "Other gains / (losses)"),
    profitBeforeTax,
    taxation || zeroLine("taxation", "Taxation"),
    profitFromContinuingOperations,
    ...(discontinuedOperations ? [discontinuedOperations] : []),
    profitAfterTax,
    ...(otherComprehensiveIncome ? [otherComprehensiveIncome, totalComprehensiveIncome] : []),
  ] as AfsStatementLine[];

  return assignNoteNumbers(visible, 20);
}
