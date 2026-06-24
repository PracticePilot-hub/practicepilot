export type LeadScheduleKey =
  | "ppe"
  | "right-of-use-assets"
  | "investment-property"
  | "intangibles"
  | "goodwill"
  | "investments-subsidiaries"
  | "investments-associates"
  | "investments-joint-ventures"
  | "loans-receivable"
  | "deferred-tax-asset"
  | "other-non-current-assets"
  | "inventory"
  | "cash"
  | "receivables"
  | "construction-contracts-receivable"
  | "directors-employee-loans"
  | "tax-controls"
  | "current-tax-receivable"
  | "assets-held-for-sale"
  | "share-capital"
  | "retained-income"
  | "reserves"
  | "provisions"
  | "deferred-income"
  | "financial-liabilities"
  | "borrowings"
  | "loans-group-companies-payable"
  | "loans-stakeholders-payable"
  | "lease-liabilities"
  | "deferred-tax-liability"
  | "other-non-current-liabilities"
  | "bank-overdraft"
  | "payables"
  | "dividend-payable"
  | "current-tax-payable"
  | "liabilities-held-for-sale"
  | "revenue"
  | "cost-of-sales"
  | "operating-income"
  | "operating-expenses"
  | "investment-income"
  | "finance-costs"
  | "non-operating-gains-losses"
  | "non-operating-expenses"
  | "non-operating-income"
  | "taxation"
  | "other-comprehensive-income"
  | "discontinued-operations"
  | "related-parties"
  | "commitments-contingencies"
  | "cash-flow"
  | "other-disclosures";

export type LeadScheduleStatementKey =
  | "Statement of Financial Position"
  | "Income Statement"
  | "Other";

export type LeadScheduleGroupKey =
  | "sfp-non-current-assets"
  | "sfp-current-assets"
  | "sfp-equity"
  | "sfp-non-current-liabilities"
  | "sfp-current-liabilities"
  | "is-revenue-income"
  | "is-expenses"
  | "is-finance-tax"
  | "is-other-performance"
  | "other-disclosures";

export type LeadScheduleItem = {
  key: LeadScheduleKey;
  number: string;
  title: string;
};

export type LeadScheduleGroup = {
  key: LeadScheduleGroupKey;
  statement: LeadScheduleStatementKey;
  number: string;
  title: string;
  schedules: LeadScheduleItem[];
};

export const leadScheduleGroups: LeadScheduleGroup[] = [
  {
    key: "sfp-non-current-assets",
    statement: "Statement of Financial Position",
    number: "300",
    title: "Non-current assets",
    schedules: [
      { key: "ppe", number: "305", title: "Property, plant and equipment" },
      { key: "right-of-use-assets", number: "306", title: "Right-of-use assets" },
      { key: "investment-property", number: "310", title: "Investment property" },
      { key: "intangibles", number: "320", title: "Intangible assets" },
      { key: "goodwill", number: "321", title: "Goodwill" },
      {
        key: "investments-subsidiaries",
        number: "326",
        title: "Investments in subsidiaries",
      },
      {
        key: "investments-associates",
        number: "327",
        title: "Investments in associates",
      },
      {
        key: "investments-joint-ventures",
        number: "328",
        title: "Investments in joint ventures",
      },
      { key: "loans-receivable", number: "340", title: "Loans receivable" },
      {
        key: "other-non-current-assets",
        number: "390",
        title: "Other non-current assets",
      },
      { key: "deferred-tax-asset", number: "395", title: "Deferred tax asset" },
    ],
  },
  {
    key: "sfp-current-assets",
    statement: "Statement of Financial Position",
    number: "400",
    title: "Current assets",
    schedules: [
      { key: "inventory", number: "405", title: "Inventories" },
      { key: "cash", number: "420", title: "Cash and cash equivalents" },
      { key: "receivables", number: "430", title: "Trade and other receivables" },
      {
        key: "construction-contracts-receivable",
        number: "432",
        title: "Construction contracts and receivables",
      },
      {
        key: "directors-employee-loans",
        number: "449",
        title: "Loans to directors, managers and employees",
      },
      { key: "tax-controls", number: "490", title: "Tax / VAT / PAYE controls" },
      {
        key: "current-tax-receivable",
        number: "495",
        title: "Current tax receivable",
      },
      {
        key: "assets-held-for-sale",
        number: "499",
        title: "Assets held for sale",
      },
    ],
  },
  {
    key: "sfp-equity",
    statement: "Statement of Financial Position",
    number: "800",
    title: "Equity",
    schedules: [
      { key: "share-capital", number: "805", title: "Share capital / contributions" },
      { key: "retained-income", number: "810", title: "Retained income" },
      { key: "reserves", number: "820", title: "Reserves" },
    ],
  },
  {
    key: "sfp-non-current-liabilities",
    statement: "Statement of Financial Position",
    number: "500",
    title: "Non-current liabilities",
    schedules: [
      { key: "provisions", number: "515", title: "Provisions" },
      { key: "deferred-income", number: "531", title: "Deferred income" },
      {
        key: "loans-group-companies-payable",
        number: "547",
        title: "Loans from group companies",
      },
      {
        key: "loans-stakeholders-payable",
        number: "548",
        title: "Loans from stakeholders",
      },
      { key: "financial-liabilities", number: "550", title: "Financial liabilities" },
      { key: "borrowings", number: "551", title: "Borrowings" },
      { key: "lease-liabilities", number: "555", title: "Lease liabilities" },
      {
        key: "other-non-current-liabilities",
        number: "590",
        title: "Other non-current liabilities",
      },
      {
        key: "deferred-tax-liability",
        number: "595",
        title: "Deferred tax liability",
      },
    ],
  },
  {
    key: "sfp-current-liabilities",
    statement: "Statement of Financial Position",
    number: "600",
    title: "Current liabilities",
    schedules: [
      { key: "bank-overdraft", number: "620", title: "Bank overdraft" },
      { key: "payables", number: "630", title: "Trade and other payables" },
      { key: "dividend-payable", number: "688", title: "Dividend payable" },
      { key: "current-tax-payable", number: "695", title: "Current tax payable" },
      {
        key: "liabilities-held-for-sale",
        number: "699",
        title: "Liabilities held for sale",
      },
    ],
  },
  {
    key: "is-revenue-income",
    statement: "Income Statement",
    number: "700",
    title: "Revenue and income",
    schedules: [
      { key: "revenue", number: "700", title: "Revenue" },
      { key: "operating-income", number: "730", title: "Operating income" },
      { key: "investment-income", number: "770", title: "Investment income" },
      { key: "non-operating-income", number: "785", title: "Non-operating income" },
    ],
  },
  {
    key: "is-expenses",
    statement: "Income Statement",
    number: "720",
    title: "Expenses",
    schedules: [
      { key: "cost-of-sales", number: "720", title: "Cost of sales" },
      { key: "operating-expenses", number: "750", title: "Operating expenses" },
      {
        key: "non-operating-expenses",
        number: "781",
        title: "Non-operating expenses",
      },
    ],
  },
  {
    key: "is-finance-tax",
    statement: "Income Statement",
    number: "775",
    title: "Finance and taxation",
    schedules: [
      { key: "finance-costs", number: "775", title: "Finance costs" },
      { key: "taxation", number: "795", title: "Taxation" },
    ],
  },
  {
    key: "is-other-performance",
    statement: "Income Statement",
    number: "780",
    title: "Other performance",
    schedules: [
      {
        key: "non-operating-gains-losses",
        number: "780",
        title: "Non-operating gains / losses",
      },
      {
        key: "other-comprehensive-income",
        number: "797",
        title: "Other comprehensive income",
      },
      {
        key: "discontinued-operations",
        number: "799",
        title: "Discontinued operations",
      },
    ],
  },
  {
    key: "other-disclosures",
    statement: "Other",
    number: "850",
    title: "Other",
    schedules: [
      { key: "related-parties", number: "850", title: "Related parties" },
      {
        key: "commitments-contingencies",
        number: "857",
        title: "Commitments and contingencies",
      },
      { key: "cash-flow", number: "880", title: "Statement of cash flows" },
      { key: "other-disclosures", number: "891", title: "Other disclosures" },
    ],
  },
];

export const closedLeadScheduleGroups: Record<LeadScheduleGroupKey, boolean> = {
  "sfp-non-current-assets": false,
  "sfp-current-assets": false,
  "sfp-equity": false,
  "sfp-non-current-liabilities": false,
  "sfp-current-liabilities": false,
  "is-revenue-income": false,
  "is-expenses": false,
  "is-finance-tax": false,
  "is-other-performance": false,
  "other-disclosures": false,
};

export const closedLeadScheduleStatements: Record<
  LeadScheduleStatementKey,
  boolean
> = {
  "Statement of Financial Position": false,
  "Income Statement": false,
  Other: false,
};

export function getLeadScheduleItem(key: LeadScheduleKey) {
  for (const group of leadScheduleGroups) {
    const match = group.schedules.find((schedule) => schedule.key === key);

    if (match) {
      return match;
    }
  }

  return null;
}

export function getLeadScheduleTitle(key: LeadScheduleKey) {
  const item = getLeadScheduleItem(key);

  if (!item) {
    return "Lead Schedule";
  }

  return `${item.number}. ${item.title}`;
}

export function getLeadSchedulePlainTitle(key: LeadScheduleKey) {
  const item = getLeadScheduleItem(key);

  if (!item) {
    return "Lead Schedule";
  }

  return item.title;
}

export function getLeadScheduleNumber(key: LeadScheduleKey) {
  const item = getLeadScheduleItem(key);

  if (!item) {
    return "";
  }

  return item.number;
}