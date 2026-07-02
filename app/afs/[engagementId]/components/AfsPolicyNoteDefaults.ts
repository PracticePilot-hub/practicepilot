export type EditableDisclosureText = {
  title: string;
  text: string;
};

export type EditableDisclosureTextMap = Record<string, EditableDisclosureText>;

export type EditableDisclosureSection = {
  key: string;
  optionKey: string;
  title: string;
  label: string;
  defaultTitle: string;
  defaultText: string;
  group?: string;
  groupLabel?: string;
  introText?: string;
};

function section(
  key: string,
  optionKey: string,
  title: string,
  group: string,
  groupLabel: string,
  text = ""
): EditableDisclosureSection {
  return {
    key,
    optionKey,
    title,
    label: title,
    defaultTitle: title,
    defaultText: text,
    group,
    groupLabel,
  };
}

export function renderDisclosureText(
  value: string,
  tokens: Record<string, string | number | null | undefined> = {}
) {
  let rendered = String(value || "");

  Object.entries(tokens).forEach(([key, rawValue]) => {
    const valueToUse =
      rawValue === null || rawValue === undefined ? "" : String(rawValue);
    rendered = rendered.split(`{${key}}`).join(valueToUse);
  });

  return rendered
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const accountingPolicySections: EditableDisclosureSection[] = [
  section(
    "policyBasisPreparation",
    "policyBasisPreparation",
    "Basis of preparation and summary of significant accounting policies",
    "general",
    "General",
    "The annual financial statements have been prepared in accordance with IFRS for SMEs and the requirements of the Companies Act of South Africa. They have been prepared on the historical cost basis, except where otherwise stated, and are presented in South African Rand."
  ),
  section(
    "policyJudgementsEstimates",
    "policyJudgementsEstimates",
    "Significant judgements and sources of estimation uncertainty",
    "general",
    "General",
    "The preparation of annual financial statements requires management to make judgements, estimates and assumptions that affect the reported amounts of assets, liabilities, income and expenses. Actual results may differ from these estimates. Estimates and underlying assumptions are reviewed on an ongoing basis."
  ),
  section(
    "policyGoingConcern",
    "policyGoingConcern",
    "Going concern",
    "general",
    "General",
    "The annual financial statements have been prepared on the basis of accounting policies applicable to a going concern. This basis presumes that funds will be available to finance future operations and that the realisation of assets and settlement of liabilities will occur in the ordinary course of business."
  ),

  section(
    "policyRevenueGeneral",
    "policyRevenueGeneral",
    "Revenue",
    "revenue",
    "Revenue",
    "Revenue is recognised when it is probable that the economic benefits associated with the transaction will flow to the entity and the amount of revenue can be measured reliably. Revenue is measured at the fair value of the consideration received or receivable, excluding amounts collected on behalf of third parties."
  ),
  section(
    "policyRevenueGoods",
    "policyRevenueGoods",
    "Sale of goods",
    "revenue",
    "Revenue",
    "Revenue from the sale of goods is recognised when the significant risks and rewards of ownership have transferred to the buyer, the entity retains neither continuing managerial involvement nor effective control over the goods sold, the amount of revenue can be measured reliably and it is probable that the economic benefits will flow to the entity."
  ),
  section(
    "policyRevenueServices",
    "policyRevenueServices",
    "Rendering of services",
    "revenue",
    "Revenue",
    "Revenue from the rendering of services is recognised by reference to the stage of completion of the transaction at the reporting date when the outcome of the transaction can be estimated reliably."
  ),
  section(
    "policyRevenueRental",
    "policyRevenueRental",
    "Rental income",
    "revenue",
    "Revenue",
    "Rental income is recognised on a straight-line basis over the term of the lease unless another systematic basis is more representative of the pattern in which benefits from the leased asset are consumed."
  ),
  section(
    "policyRevenueInterest",
    "policyRevenueInterest",
    "Interest income",
    "revenue",
    "Revenue",
    "Interest income is recognised using the effective interest method."
  ),
  section(
    "policyRevenueDividends",
    "policyRevenueDividends",
    "Dividend income",
    "revenue",
    "Revenue",
    "Dividend income is recognised when the shareholder’s right to receive payment has been established."
  ),

  section(
    "policyPpeRecognition",
    "policyPpeRecognition",
    "Recognition and initial measurement",
    "ppe",
    "Property, plant and equipment",
    "Property, plant and equipment is recognised when it is probable that future economic benefits associated with the item will flow to the entity and the cost of the item can be measured reliably. Items of property, plant and equipment are initially measured at cost."
  ),
  section(
    "policyPpeSubsequent",
    "policyPpeSubsequent",
    "Subsequent expenditure",
    "ppe",
    "Property, plant and equipment",
    "Subsequent costs are included in the asset’s carrying amount or recognised as a separate asset only when it is probable that future economic benefits associated with the item will flow to the entity and the cost can be measured reliably. Repairs and maintenance are recognised in profit or loss as incurred."
  ),
  section(
    "policyPpeDepreciation",
    "policyPpeDepreciation",
    "Depreciation",
    "ppe",
    "Property, plant and equipment",
    "Depreciation is recognised so as to write off the cost of assets, less residual values, over their estimated useful lives using a method that reflects the expected pattern of consumption of future economic benefits. Residual values, useful lives and depreciation methods are reviewed when there is an indication that they have changed."
  ),
  section(
    "policyPpeDerecognition",
    "policyPpeDerecognition",
    "Derecognition",
    "ppe",
    "Property, plant and equipment",
    "An item of property, plant and equipment is derecognised on disposal or when no future economic benefits are expected from its use or disposal. Gains or losses on derecognition are recognised in profit or loss."
  ),

  section(
    "policyFinancialInstruments",
    "policyFinancialInstruments",
    "Financial instruments",
    "financial-instruments",
    "Financial instruments",
    "Financial instruments are recognised when the entity becomes party to the contractual provisions of the instrument. Financial assets and financial liabilities are initially measured at the transaction price unless another measurement basis is required."
  ),
  section(
    "policyTradeReceivables",
    "policyTradeReceivables",
    "Trade and other receivables",
    "financial-instruments",
    "Financial instruments",
    "Trade and other receivables are measured at amortised cost less impairment losses, where applicable."
  ),
  section(
    "policyCash",
    "policyCash",
    "Cash and cash equivalents",
    "financial-instruments",
    "Financial instruments",
    "Cash and cash equivalents comprise cash on hand, bank balances and short-term highly liquid investments that are readily convertible to known amounts of cash and are subject to an insignificant risk of changes in value."
  ),
  section(
    "policyTradePayables",
    "policyTradePayables",
    "Trade and other payables",
    "financial-instruments",
    "Financial instruments",
    "Trade and other payables are measured at amortised cost."
  ),
  section(
    "policyLoans",
    "policyLoans",
    "Loans",
    "financial-instruments",
    "Financial instruments",
    "Loans are measured at amortised cost using the effective interest method, less impairment where applicable."
  ),

  section(
    "policyInventories",
    "policyInventories",
    "Inventories",
    "inventory",
    "Inventories",
    "Inventories are measured at the lower of cost and estimated selling price less costs to complete and sell. Cost includes purchase costs, conversion costs and other costs incurred in bringing inventories to their present location and condition."
  ),
  section(
    "policyLeases",
    "policyLeases",
    "Leases",
    "leases",
    "Leases",
    "Leases are classified according to the substance of the arrangement. Lease payments under operating leases are recognised as an expense on a straight-line basis over the lease term unless another systematic basis is more representative of the pattern of benefit."
  ),
  section(
    "policyTaxation",
    "policyTaxation",
    "Taxation",
    "tax",
    "Taxation",
    "Current tax is the expected tax payable or receivable on taxable income or loss for the year, using tax rates enacted or substantively enacted at the reporting date. Deferred tax is recognised for timing differences where applicable."
  ),
  section(
    "policyImpairment",
    "policyImpairment",
    "Impairment of assets",
    "impairment",
    "Impairment",
    "At each reporting date, assets are assessed for indications of impairment. If such indication exists, the recoverable amount is estimated and an impairment loss is recognised where the carrying amount exceeds the recoverable amount."
  ),
];

export const noteSections: EditableDisclosureSection[] = [
  section("notesPropertyPlantEquipment", "notesPropertyPlantEquipment", "Property, plant and equipment", "assets", "Assets"),
  section("notesGoodwill", "notesGoodwill", "Goodwill", "assets", "Assets"),
  section("notesInvestmentProperty", "notesInvestmentProperty", "Investment property", "assets", "Assets"),
  section("notesIntangibleAssets", "notesIntangibleAssets", "Intangible assets", "assets", "Assets"),
  section("notesBiologicalAssets", "notesBiologicalAssets", "Biological assets", "assets", "Assets"),
  section("notesOtherNonCurrentAssets", "notesOtherNonCurrentAssets", "Other non-current assets", "assets", "Assets"),
  section("notesLoansReceivable", "notesLoansReceivable", "Loans receivable", "assets", "Assets"),
  section("notesInventories", "notesInventories", "Inventories", "assets", "Assets"),
  section("notesTradeReceivables", "notesTradeReceivables", "Trade and other receivables", "assets", "Assets"),
  section("notesCurrentTaxReceivable", "notesCurrentTaxReceivable", "Current tax receivable", "assets", "Assets"),
  section("notesCashAndCashEquivalents", "notesCashAndCashEquivalents", "Cash and cash equivalents", "assets", "Assets", "Cash and cash equivalents consist of bank balances and cash on hand."),

  section("notesShareCapital", "notesShareCapital", "Share capital", "equity", "Equity and liabilities"),
  section("notesRetainedIncome", "notesRetainedIncome", "Retained income / accumulated loss", "equity", "Equity and liabilities"),
  section("notesShareholdersLoans", "notesShareholdersLoans", "Shareholders' loans", "equity", "Equity and liabilities"),
  section("notesOtherFinancialLiabilities", "notesOtherFinancialLiabilities", "Other financial liabilities", "equity", "Equity and liabilities"),
  section("notesTradePayables", "notesTradePayables", "Trade and other payables", "equity", "Equity and liabilities"),
  section("notesCurrentTaxPayable", "notesCurrentTaxPayable", "Current tax payable", "equity", "Equity and liabilities"),

  section("notesRevenue", "notesRevenue", "Revenue", "profit-loss", "Profit or loss"),
  section("notesOtherIncome", "notesOtherIncome", "Other income", "profit-loss", "Profit or loss"),
  section("notesOperatingExpenses", "notesOperatingExpenses", "Operating expenses", "profit-loss", "Profit or loss"),
  section("notesFinanceCosts", "notesFinanceCosts", "Finance costs", "profit-loss", "Profit or loss"),
  section("notesTaxation", "notesTaxation", "Taxation", "profit-loss", "Profit or loss"),
  section("notesCashUsedInOperations", "notesCashUsedInOperations", "Cash used in operations", "cash-flow", "Cash flow"),
];

export function buildDefaultAccountingPolicyTexts(): EditableDisclosureTextMap {
  const result: EditableDisclosureTextMap = {};
  accountingPolicySections.forEach((item) => {
    result[item.key] = {
      title: item.defaultTitle,
      text: item.defaultText,
    };
  });
  return result;
}

export function buildDefaultNoteTexts(): EditableDisclosureTextMap {
  const result: EditableDisclosureTextMap = {};
  noteSections.forEach((item) => {
    result[item.key] = {
      title: item.defaultTitle,
      text: item.defaultText,
    };
  });
  return result;
}
