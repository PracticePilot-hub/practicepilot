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

function mappingText(line: AfsTrialBalanceLine): string {
  return [
    line.mapping_code,
    line.lead_schedule_number,
    line.lead_schedule_key,
    line.mapping_label,
    line.mapping_section,
    line.account_code,
    line.account_name,
  ]
    .map((item) => normalise(item))
    .filter(Boolean)
    .join(" | ");
}

function matchesPrefix(line: AfsTrialBalanceLine, prefixes: string[]): boolean {
  const mappingCode = normalise(line.mapping_code || line.lead_schedule_number);
  const leadKey = normalise(line.lead_schedule_key);
  const labelText = normalise(`${line.mapping_label || ""} ${line.mapping_section || ""}`);

  return prefixes.some((prefix) => {
    const clean = normalise(prefix);
    if (!clean) return false;

    if (mappingCode === clean || mappingCode.startsWith(`${clean}.`)) return true;
    if (mappingCode.includes(`.${clean}`) || mappingCode.includes(`.${clean}.`)) return true;
    if (leadKey === clean || leadKey.includes(clean)) return true;
    if (labelText.includes(clean)) return true;

    return false;
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
            prefixes: ["305", "property-plant-and-equipment", "ppe"],
            sign: "debit-positive",
          },
          {
            key: "right-of-use-assets",
            label: "Right-of-use assets",
            prefixes: ["306", "right-of-use-assets"],
            sign: "debit-positive",
          },
          {
            key: "investment-property",
            label: "Investment property",
            prefixes: ["310", "investment-property"],
            sign: "debit-positive",
          },
          {
            key: "intangible-assets",
            label: "Intangible assets",
            prefixes: ["320", "intangible"],
            sign: "debit-positive",
          },
          {
            key: "long-term-loans-receivable",
            label: "Loans receivable",
            prefixes: ["340", "300.340", "348", "300.348", "350", "300.350", "long-term-loans", "loans-receivable", "loan-receivable", "loan to shareholder", "loan to director"],
            sign: "debit-positive",
          },
          {
            key: "deferred-tax-asset",
            label: "Deferred tax asset",
            prefixes: ["395", "deferred-tax-asset"],
            sign: "debit-positive",
          },
          {
            key: "other-non-current-assets",
            label: "Other non-current assets",
            prefixes: ["390", "300.390", "other-non-current-assets", "other non-current assets", "non-current assets other"],
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
            prefixes: ["405", "400.405", "inventory", "inventories"],
            sign: "debit-positive",
          },
          {
            key: "trade-and-other-receivables",
            label: "Trade and other receivables",
            prefixes: ["430", "400.430", "trade-and-other-receivables"],
            sign: "debit-positive",
          },
          {
            key: "current-tax-receivable",
            label: "Current tax receivable",
            prefixes: ["490", "495", "current-tax-receivable", "tax receivable", "sars receivable"],
            sign: "debit-positive",
          },
          {
            key: "cash-and-cash-equivalents",
            label: "Bank, cash and cash equivalents",
            prefixes: ["420", "400.420", "cash-and-cash-equivalents"],
            sign: "debit-positive",
          },
          {
            key: "other-current-assets",
            label: "Other current assets",
            prefixes: ["499", "other-current-assets", "assets-held-for-sale"],
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
            label: "Issued capital",
            prefixes: ["805", "800.805", "share-capital", "issued-capital", "ordinary-share-capital"],
            sign: "credit-positive",
          },
          {
            key: "retained-income",
            label: "Retained income / (accumulated loss)",
            prefixes: ["810", "800.810", "retained-income", "retained earnings", "accumulated loss"],
            sign: "credit-positive",
          },
          {
            key: "reserves",
            label: "Reserves",
            prefixes: ["820", "reserves"],
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
                key: "shareholders-loans",
                label: "Shareholders loans",
                prefixes: ["547", "500.547", "548", "500.548", "shareholder", "shareholders", "member loan", "loans-stakeholders-payable", "loans-from-shareholders", "directors-loans"],
                sign: "credit-positive",
              },
              {
                key: "long-term-borrowings",
                label: "Other financial liabilities",
                prefixes: ["550", "551", "long-term-borrowings", "borrowings", "financial-liabilities"],
                sign: "credit-positive",
              },
              {
                key: "lease-liabilities-non-current",
                label: "Lease liabilities",
                prefixes: ["555", "lease-liabilities"],
                sign: "credit-positive",
              },
              {
                key: "deferred-tax-liability",
                label: "Deferred tax liability",
                prefixes: ["595", "deferred-tax-liability"],
                sign: "credit-positive",
              },
            ],
          },
          {
            key: "current-liabilities",
            label: "Current liabilities",
            children: [
              {
                key: "trade-and-other-payables",
                label: "Trade and other payables",
                prefixes: ["630", "600.630", "trade-and-other-payables", "accrual"],
                sign: "credit-positive",
              },
              {
                key: "bank-overdraft",
                label: "Bank overdraft",
                prefixes: ["620", "600.620", "bank-overdraft", "overdraft"],
                sign: "credit-positive",
              },
              {
                key: "current-tax-payable",
                label: "Current tax payable",
                prefixes: ["690", "600.690", "695", "600.695", "current-tax-payable", "tax payable", "sars payable", "vat payable", "paye payable"],
                sign: "credit-positive",
              },
              {
                key: "dividend-payable",
                label: "Dividend payable",
                prefixes: ["688", "dividend-payable"],
                sign: "credit-positive",
              },
              {
                key: "other-current-liabilities",
                label: "Other current liabilities",
                prefixes: ["699", "other-current-liabilities"],
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
  const revenue = profitLine(lines, "revenue", "Revenue", ["700", "revenue", "sales"], "credit-positive", journalEffects);
  const costOfSales = profitLine(lines, "cost-of-sales", "Cost of sales", ["720", "cost-of-sales"], "debit-positive", journalEffects);
  const otherIncome = profitLine(lines, "other-income", "Other income", ["730", "770", "785", "other-income", "investment-income"], "credit-positive", journalEffects);
  const operatingExpenses = profitLine(lines, "operating-expenses", "Operating expenses", ["750", "781", "operating-expenses", "administration expenses", "expenses"], "debit-positive", journalEffects);
  const financeCosts = profitLine(lines, "finance-costs", "Finance costs", ["775", "finance-costs", "interest paid"], "debit-positive", journalEffects);
  const taxation = profitLine(lines, "taxation", "Taxation", ["795", "taxation", "income tax expense"], "debit-positive", journalEffects);

  const grossProfit = {
    key: "gross-profit",
    label: "Gross profit / (loss)",
    current: roundMoney(toNumber(revenue?.current) - toNumber(costOfSales?.current)),
    prior: roundMoney(toNumber(revenue?.prior) - toNumber(costOfSales?.prior)),
    isSubtotal: true,
  };

  const profitBeforeTax = {
    key: "profit-before-tax",
    label: "Profit / (loss) before taxation",
    current: roundMoney(
      toNumber(grossProfit.current) +
        toNumber(otherIncome?.current) -
        toNumber(operatingExpenses?.current) -
        toNumber(financeCosts?.current)
    ),
    prior: roundMoney(
      toNumber(grossProfit.prior) +
        toNumber(otherIncome?.prior) -
        toNumber(operatingExpenses?.prior) -
        toNumber(financeCosts?.prior)
    ),
    isSubtotal: true,
  };

  const profitAfterTax = {
    key: "profit-after-tax",
    label: "Profit / (loss) for the year",
    current: roundMoney(toNumber(profitBeforeTax.current) - toNumber(taxation?.current)),
    prior: roundMoney(toNumber(profitBeforeTax.prior) - toNumber(taxation?.prior)),
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
    otherIncome || zeroLine("other-income", "Other income"),
    operatingExpenses || zeroLine("operating-expenses", "Operating expenses"),
    financeCosts || zeroLine("finance-costs", "Finance costs"),
    profitBeforeTax,
    taxation || zeroLine("taxation", "Taxation"),
    profitAfterTax,
  ] as AfsStatementLine[];

  return assignNoteNumbers(visible, 20);
}
