export type EditableDisclosureText = {
  title: string;
  text: string;
};

export type EditableDisclosureTextMap = Record<string, EditableDisclosureText>;

export type EditableDisclosureSection = {
  key: string;
  optionKey: string;
  label: string;
  group?: string;
  groupLabel?: string;
  defaultOpen?: boolean;
  introText?: string;
};
function disclosure(title: string, text: string): EditableDisclosureText {
  return {
    title,
    text: text.trim(),
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
  {
    key: "policyBasisPreparation",
    optionKey: "policyBasisPreparation",
    label: "Basis of preparation",
    group: "basis",
    groupLabel: "Basis and framework",
    defaultOpen: true,
  },
  {
    key: "policyJudgementsEstimates",
    optionKey: "policyJudgementsEstimates",
    label: "Judgements and estimates",
    group: "basis",
    groupLabel: "Basis and framework",
  },
  {
    key: "policyGoingConcern",
    optionKey: "policyGoingConcern",
    label: "Going concern",
    group: "basis",
    groupLabel: "Basis and framework",
  },

  {
    key: "policyRevenueGeneral",
    optionKey: "policyRevenueGeneral",
    label: "General measurement",
    group: "revenue",
    groupLabel: "Revenue",
    defaultOpen: true,
  },
  {
    key: "policyRevenueGoods",
    optionKey: "policyRevenueGoods",
    label: "Sale of goods",
    group: "revenue",
    groupLabel: "Revenue",
  },
  {
    key: "policyRevenueServices",
    optionKey: "policyRevenueServices",
    label: "Rendering of services",
    group: "revenue",
    groupLabel: "Revenue",
  },
  {
    key: "policyRevenueConstruction",
    optionKey: "policyRevenueConstruction",
    label: "Construction and long-term contracts",
    group: "revenue",
    groupLabel: "Revenue",
  },
  {
    key: "policyRevenueInterest",
    optionKey: "policyRevenueInterest",
    label: "Interest income",
    group: "revenue",
    groupLabel: "Revenue",
  },
  {
    key: "policyRevenueRoyalties",
    optionKey: "policyRevenueRoyalties",
    label: "Royalties",
    group: "revenue",
    groupLabel: "Revenue",
  },
  {
    key: "policyRevenueDividends",
    optionKey: "policyRevenueDividends",
    label: "Dividends",
    group: "revenue",
    groupLabel: "Revenue",
  },
  {
    key: "policyRevenueRental",
    optionKey: "policyRevenueRental",
    label: "Rental income",
    group: "revenue",
    groupLabel: "Revenue",
  },

  {
    key: "policyPropertyPlantEquipmentRecognition",
    optionKey: "policyPropertyPlantEquipmentRecognition",
    label: "Recognition and initial measurement",
    group: "ppe",
    groupLabel: "Property, plant and equipment",
    defaultOpen: true,
  },
  {
    key: "policyPropertyPlantEquipmentSubsequentExpenditure",
    optionKey: "policyPropertyPlantEquipmentSubsequentExpenditure",
    label: "Subsequent expenditure",
    group: "ppe",
    groupLabel: "Property, plant and equipment",
  },
  {
    key: "policyPropertyPlantEquipmentDepreciation",
    optionKey: "policyPropertyPlantEquipmentDepreciation",
    label: "Depreciation",
    group: "ppe",
    groupLabel: "Property, plant and equipment",
  },
  {
    key: "policyPropertyPlantEquipmentUsefulLives",
    optionKey: "policyPropertyPlantEquipmentUsefulLives",
    label: "Residual values, useful lives and methods",
    group: "ppe",
    groupLabel: "Property, plant and equipment",
  },
  {
    key: "policyPropertyPlantEquipmentDerecognition",
    optionKey: "policyPropertyPlantEquipmentDerecognition",
    label: "Derecognition",
    group: "ppe",
    groupLabel: "Property, plant and equipment",
  },
  {
    key: "policyPropertyPlantEquipmentCostModel",
    optionKey: "policyPropertyPlantEquipmentCostModel",
    label: "Cost model",
    group: "ppe",
    groupLabel: "Property, plant and equipment",
  },
  {
    key: "policyPropertyPlantEquipmentRevaluationModel",
    optionKey: "policyPropertyPlantEquipmentRevaluationModel",
    label: "Revaluation model",
    group: "ppe",
    groupLabel: "Property, plant and equipment",
  },
  {
    key: "policyPropertyPlantEquipmentAssetsUnderConstruction",
    optionKey: "policyPropertyPlantEquipmentAssetsUnderConstruction",
    label: "Assets under construction",
    group: "ppe",
    groupLabel: "Property, plant and equipment",
  },

  {
    key: "policyFinancialInstruments",
    optionKey: "policyFinancialInstruments",
    label: "General",
    group: "financial-instruments",
    groupLabel: "Financial instruments",
    defaultOpen: true,
  },
  {
    key: "policyFinancialAssetsAmortisedCost",
    optionKey: "policyFinancialAssetsAmortisedCost",
    label: "Financial assets at amortised cost",
    group: "financial-instruments",
    groupLabel: "Financial instruments",
  },
  {
    key: "policyFinancialLiabilitiesAmortisedCost",
    optionKey: "policyFinancialLiabilitiesAmortisedCost",
    label: "Financial liabilities at amortised cost",
    group: "financial-instruments",
    groupLabel: "Financial instruments",
  },
  {
    key: "policyTradeReceivables",
    optionKey: "policyTradeReceivables",
    label: "Trade and other receivables",
    group: "financial-instruments",
    groupLabel: "Financial instruments",
  },
  {
    key: "policyTradePayables",
    optionKey: "policyTradePayables",
    label: "Trade and other payables",
    group: "financial-instruments",
    groupLabel: "Financial instruments",
  },
  {
    key: "policyShareholderLoans",
    optionKey: "policyShareholderLoans",
    label: "Shareholder / director loans",
    group: "financial-instruments",
    groupLabel: "Financial instruments",
  },
  {
    key: "policyFinancialAssetImpairment",
    optionKey: "policyFinancialAssetImpairment",
    label: "Impairment of financial assets",
    group: "financial-instruments",
    groupLabel: "Financial instruments",
  },
  {
    key: "policyFinancialInstrumentsOffsetting",
    optionKey: "policyFinancialInstrumentsOffsetting",
    label: "Offsetting",
    group: "financial-instruments",
    groupLabel: "Financial instruments",
  },

  {
    key: "policyInventories",
    optionKey: "policyInventories",
    label: "Inventories",
    group: "inventory",
    groupLabel: "Inventories",
  },

  {
    key: "policyInvestmentPropertyRecognition",
    optionKey: "policyInvestmentPropertyRecognition",
    label: "Recognition",
    group: "investment-property",
    groupLabel: "Investment property",
  },
  {
    key: "policyInvestmentPropertyCostModel",
    optionKey: "policyInvestmentPropertyCostModel",
    label: "Cost model",
    group: "investment-property",
    groupLabel: "Investment property",
  },
  {
    key: "policyInvestmentPropertyFairValueModel",
    optionKey: "policyInvestmentPropertyFairValueModel",
    label: "Fair value model",
    group: "investment-property",
    groupLabel: "Investment property",
  },
  {
    key: "policyInvestmentPropertyTransfers",
    optionKey: "policyInvestmentPropertyTransfers",
    label: "Transfers",
    group: "investment-property",
    groupLabel: "Investment property",
  },

  {
    key: "policyIntangibleAssets",
    optionKey: "policyIntangibleAssets",
    label: "Intangible assets",
    group: "other-assets",
    groupLabel: "Other assets",
  },
  {
    key: "policyImpairment",
    optionKey: "policyImpairment",
    label: "Impairment of non-financial assets",
    group: "other-assets",
    groupLabel: "Other assets",
  },

  {
    key: "policyLeasesGeneral",
    optionKey: "policyLeasesGeneral",
    label: "General",
    group: "leases",
    groupLabel: "Leases",
  },
  {
    key: "policyLeasesLessee",
    optionKey: "policyLeasesLessee",
    label: "Lessee accounting",
    group: "leases",
    groupLabel: "Leases",
  },
  {
    key: "policyLeasesLessor",
    optionKey: "policyLeasesLessor",
    label: "Lessor accounting",
    group: "leases",
    groupLabel: "Leases",
  },
  {
    key: "policyLeasesShortTermLowValue",
    optionKey: "policyLeasesShortTermLowValue",
    label: "Short-term and low-value leases",
    group: "leases",
    groupLabel: "Leases",
  },

  {
    key: "policyEmployeeBenefits",
    optionKey: "policyEmployeeBenefits",
    label: "Employee benefits",
    group: "expenses",
    groupLabel: "Expenses and tax",
  },
  {
    key: "policyBorrowingCosts",
    optionKey: "policyBorrowingCosts",
    label: "Borrowing costs",
    group: "expenses",
    groupLabel: "Expenses and tax",
  },
  {
    key: "policyTaxation",
    optionKey: "policyTaxation",
    label: "Taxation",
    group: "expenses",
    groupLabel: "Expenses and tax",
  },

  {
    key: "policyShareCapitalEquity",
    optionKey: "policyShareCapitalEquity",
    label: "Share capital and equity",
    group: "equity-liabilities",
    groupLabel: "Equity, provisions and other",
  },
  {
    key: "policyProvisionsContingencies",
    optionKey: "policyProvisionsContingencies",
    label: "Provisions and contingencies",
    group: "equity-liabilities",
    groupLabel: "Equity, provisions and other",
  },
  {
    key: "policyRelatedParties",
    optionKey: "policyRelatedParties",
    label: "Related parties",
    group: "equity-liabilities",
    groupLabel: "Equity, provisions and other",
  },
  {
    key: "policyForeignCurrency",
    optionKey: "policyForeignCurrency",
    label: "Foreign currency",
    group: "equity-liabilities",
    groupLabel: "Equity, provisions and other",
  },
];

export const noteSections: EditableDisclosureSection[] = [
  { key: "notesPropertyPlantEquipment", optionKey: "notesPropertyPlantEquipment", label: "Property, plant and equipment", group: "assets", groupLabel: "Assets" },
  { key: "notesGoodwill", optionKey: "notesGoodwill", label: "Goodwill", group: "assets", groupLabel: "Assets" },
  { key: "notesInvestmentProperty", optionKey: "notesInvestmentProperty", label: "Investment property", group: "assets", groupLabel: "Assets" },
  { key: "notesIntangibleAssets", optionKey: "notesIntangibleAssets", label: "Intangible assets", group: "assets", groupLabel: "Assets" },
  { key: "notesBiologicalAssets", optionKey: "notesBiologicalAssets", label: "Biological assets", group: "assets", groupLabel: "Assets" },
  { key: "notesOtherNonCurrentAssets", optionKey: "notesOtherNonCurrentAssets", label: "Other non-current assets", group: "assets", groupLabel: "Assets" },
  { key: "notesLoansReceivable", optionKey: "notesLoansReceivable", label: "Loans receivable", group: "assets", groupLabel: "Assets" },
  { key: "notesInventories", optionKey: "notesInventories", label: "Inventories", group: "assets", groupLabel: "Assets" },
  { key: "notesTradeReceivables", optionKey: "notesTradeReceivables", label: "Trade and other receivables", group: "assets", groupLabel: "Assets" },
  { key: "notesCurrentTaxReceivable", optionKey: "notesCurrentTaxReceivable", label: "Current tax receivable", group: "assets", groupLabel: "Assets" },
  { key: "notesCashAndCashEquivalents", optionKey: "notesCashAndCashEquivalents", label: "Cash and cash equivalents", group: "assets", groupLabel: "Assets" },

  { key: "notesShareCapital", optionKey: "notesShareCapital", label: "Share capital", group: "equity-liabilities", groupLabel: "Equity and liabilities" },
  { key: "notesRetainedIncome", optionKey: "notesRetainedIncome", label: "Retained income", group: "equity-liabilities", groupLabel: "Equity and liabilities" },
  { key: "notesShareholdersLoans", optionKey: "notesShareholdersLoans", label: "Shareholders' loans", group: "equity-liabilities", groupLabel: "Equity and liabilities" },
  { key: "notesOtherFinancialLiabilities", optionKey: "notesOtherFinancialLiabilities", label: "Other financial liabilities", group: "equity-liabilities", groupLabel: "Equity and liabilities" },
  { key: "notesTradePayables", optionKey: "notesTradePayables", label: "Trade and other payables", group: "equity-liabilities", groupLabel: "Equity and liabilities" },
  { key: "notesCurrentTaxPayable", optionKey: "notesCurrentTaxPayable", label: "Current tax payable", group: "equity-liabilities", groupLabel: "Equity and liabilities" },

  { key: "notesRevenue", optionKey: "notesRevenue", label: "Revenue", group: "profit-loss", groupLabel: "Profit or loss" },
  { key: "notesOtherIncome", optionKey: "notesOtherIncome", label: "Other income", group: "profit-loss", groupLabel: "Profit or loss" },
  { key: "notesOperatingExpenses", optionKey: "notesOperatingExpenses", label: "Operating expenses", group: "profit-loss", groupLabel: "Profit or loss" },
  { key: "notesFinanceCosts", optionKey: "notesFinanceCosts", label: "Finance costs", group: "profit-loss", groupLabel: "Profit or loss" },
  { key: "notesTaxation", optionKey: "notesTaxation", label: "Taxation", group: "profit-loss", groupLabel: "Profit or loss" },
  { key: "notesCashUsedInOperations", optionKey: "notesCashUsedInOperations", label: "Cash used in operations", group: "cash-flow", groupLabel: "Cash flow" },
];

export function buildDefaultAccountingPolicyTexts(): EditableDisclosureTextMap {
  return {
    policyBasisPreparation: disclosure(
      "Basis of preparation",
      `
The annual financial statements have been prepared in accordance with {framework} and in the manner required by the legislation applicable to the entity.

The annual financial statements have been prepared on the historical cost basis unless otherwise stated in the accounting policies below. The accounting policies have been applied consistently to all periods presented, unless otherwise indicated.

The annual financial statements are presented in {currency}, which is the entity's presentation currency.
      `
    ),

    policyJudgementsEstimates: disclosure(
      "Critical accounting judgements and key sources of estimation uncertainty",
      `
The preparation of annual financial statements requires management to make judgements, estimates and assumptions that affect the application of accounting policies and the reported amounts of assets, liabilities, income and expenses.

Actual results may differ from these estimates. Estimates and underlying assumptions are reviewed on an ongoing basis. Revisions to accounting estimates are recognised in the period in which the estimates are revised and in any future periods affected.

Areas involving significant judgement or estimation uncertainty are disclosed in the relevant notes to the annual financial statements where applicable.
      `
    ),

    policyGoingConcern: disclosure(
      "Going concern",
      `
The annual financial statements have been prepared on the basis that the entity will continue as a going concern for the foreseeable future.

Management has considered the entity's financial position, available resources, expected cash flows and the ability to meet obligations as they become due. Where material uncertainties exist, these are disclosed in the annual financial statements.
      `
    ),

    policyRevenueGeneral: disclosure(
      "Revenue - general measurement",
      `
Revenue is measured at the fair value of the consideration received or receivable, excluding amounts collected on behalf of third parties such as value-added tax.

Revenue is recognised to the extent that it is probable that the economic benefits associated with the transaction will flow to the entity and the amount of revenue can be measured reliably.

Only the revenue recognition policies relevant to the entity are included in these annual financial statements.
      `
    ),

    policyRevenueGoods: disclosure(
      "Revenue - sale of goods",
      `
Revenue from the sale of goods is recognised when control of the goods, or the significant risks and rewards of ownership where applicable, has transferred to the buyer.

Revenue is recognised only when the entity retains neither continuing managerial involvement nor effective control over the goods sold, the amount of revenue can be measured reliably, it is probable that economic benefits will flow to the entity, and the costs incurred or to be incurred in respect of the transaction can be measured reliably.
      `
    ),

    policyRevenueServices: disclosure(
      "Revenue - rendering of services",
      `
Revenue from rendering services is recognised by reference to the stage of completion of the transaction at the reporting date when the outcome of the transaction can be estimated reliably.

The outcome of a service transaction can be estimated reliably when the amount of revenue can be measured reliably, it is probable that the economic benefits will flow to the entity, the stage of completion can be measured reliably, and the costs incurred and costs to complete the transaction can be measured reliably.

Where the outcome of a service transaction cannot be estimated reliably, revenue is recognised only to the extent of expenses recognised that are recoverable.
      `
    ),

    policyRevenueConstruction: disclosure(
      "Revenue - construction and long-term contracts",
      `
Where the outcome of a construction or long-term contract can be estimated reliably, contract revenue and contract costs are recognised by reference to the stage of completion of the contract activity at the reporting date.

Where the outcome cannot be estimated reliably, revenue is recognised only to the extent of contract costs incurred that are expected to be recoverable. Contract costs are recognised as expenses in the period in which they are incurred.
      `
    ),

    policyRevenueInterest: disclosure(
      "Revenue - interest income",
      `
Interest income is recognised using the effective interest method or another systematic basis that reflects the effective yield on the relevant asset, where appropriate under the applicable financial reporting framework.
      `
    ),

    policyRevenueRoyalties: disclosure(
      "Revenue - royalties",
      `
Royalty income is recognised on an accrual basis in accordance with the substance of the relevant agreement.
      `
    ),

    policyRevenueDividends: disclosure(
      "Revenue - dividends",
      `
Dividend income is recognised when the entity's right to receive payment has been established.
      `
    ),

    policyRevenueRental: disclosure(
      "Revenue - rental income",
      `
Rental income from operating leases is recognised on a straight-line basis over the term of the relevant lease unless another systematic basis is more representative of the pattern in which benefits from the leased asset are consumed.
      `
    ),

    policyPropertyPlantEquipmentRecognition: disclosure(
      "Property, plant and equipment - recognition and initial measurement",
      `
Property, plant and equipment are tangible assets held for use in the production or supply of goods or services, for rental to others, or for administrative purposes, and are expected to be used during more than one period.

Items of property, plant and equipment are recognised as assets when it is probable that future economic benefits associated with the item will flow to the entity and the cost of the item can be measured reliably.

Property, plant and equipment are initially measured at cost. Cost includes the purchase price, import duties, non-refundable purchase taxes and any costs directly attributable to bringing the asset to the location and condition necessary for it to operate as intended by management.
      `
    ),

    policyPropertyPlantEquipmentSubsequentExpenditure: disclosure(
      "Property, plant and equipment - subsequent expenditure",
      `
Subsequent expenditure is included in the carrying amount of the asset or recognised as a separate asset only when it is probable that future economic benefits associated with the item will flow to the entity and the cost can be measured reliably.

The carrying amount of any replaced component is derecognised. Repairs and maintenance are recognised in profit or loss during the period in which they are incurred.
      `
    ),

    policyPropertyPlantEquipmentDepreciation: disclosure(
      "Property, plant and equipment - depreciation",
      `
Depreciation is recognised so as to write off the depreciable amount of items of property, plant and equipment over their estimated useful lives.

Depreciation begins when the asset is available for use and ceases at the earlier of the date the asset is classified as held for sale, if applicable, and the date the asset is derecognised.

Depreciation is recognised in profit or loss unless it is included in the carrying amount of another asset in accordance with the applicable financial reporting framework.
      `
    ),

    policyPropertyPlantEquipmentUsefulLives: disclosure(
      "Property, plant and equipment - residual values, useful lives and methods",
      `
The residual values, useful lives and depreciation methods of property, plant and equipment are reviewed at each reporting date and adjusted prospectively where expectations differ from previous estimates.

Depreciation methods are selected to reflect the pattern in which the asset's future economic benefits are expected to be consumed by the entity.
      `
    ),

    policyPropertyPlantEquipmentDerecognition: disclosure(
      "Property, plant and equipment - derecognition",
      `
An item of property, plant and equipment is derecognised on disposal or when no future economic benefits are expected from its use or disposal.

Gains or losses on derecognition are determined as the difference between the net disposal proceeds, if any, and the carrying amount of the asset, and are recognised in profit or loss.
      `
    ),

    policyPropertyPlantEquipmentCostModel: disclosure(
      "Property, plant and equipment - cost model",
      `
After initial recognition, property, plant and equipment are measured at cost less accumulated depreciation and accumulated impairment losses.
      `
    ),

    policyPropertyPlantEquipmentRevaluationModel: disclosure(
      "Property, plant and equipment - revaluation model",
      `
After initial recognition, items of property, plant and equipment whose fair value can be measured reliably are carried at a revalued amount, being fair value at the date of revaluation less subsequent accumulated depreciation and subsequent accumulated impairment losses.

Revaluations are made with sufficient regularity to ensure that the carrying amount does not differ materially from the amount that would be determined using fair value at the reporting date.

Revaluation increases are recognised in other comprehensive income and accumulated in equity, except to the extent that they reverse a revaluation decrease previously recognised in profit or loss for the same asset.
      `
    ),

    policyPropertyPlantEquipmentAssetsUnderConstruction: disclosure(
      "Property, plant and equipment - assets under construction",
      `
Assets under construction are measured at cost and are not depreciated until the asset is available for use in the manner intended by management.

Costs directly attributable to construction or installation are capitalised where they meet the recognition criteria for property, plant and equipment.
      `
    ),

    policyFinancialInstruments: disclosure(
      "Financial instruments - general",
      `
Financial instruments are recognised when the entity becomes a party to the contractual provisions of the instrument.

Financial assets and financial liabilities are measured in accordance with the applicable financial reporting framework. Classification depends on the nature of the instrument and the purpose for which it is held.
      `
    ),

    policyFinancialAssetsAmortisedCost: disclosure(
      "Financial assets at amortised cost",
      `
Financial assets held to collect contractual cash flows consisting solely of payments of principal and interest are measured at amortised cost, where applicable.

Interest income, impairment losses and gains or losses on derecognition are recognised in profit or loss.
      `
    ),

    policyFinancialLiabilitiesAmortisedCost: disclosure(
      "Financial liabilities at amortised cost",
      `
Financial liabilities at amortised cost are initially recognised at fair value, net of directly attributable transaction costs where applicable, and are subsequently measured at amortised cost using the effective interest method or another appropriate systematic basis.
      `
    ),

    policyTradeReceivables: disclosure(
      "Trade and other receivables",
      `
Trade and other receivables are recognised initially at the transaction price and subsequently measured at the amount expected to be collected.

Receivables are assessed for impairment at each reporting date. An impairment allowance is recognised where there is objective evidence that the entity will not be able to collect all amounts due according to the original terms of the receivable.
      `
    ),

    policyTradePayables: disclosure(
      "Trade and other payables",
      `
Trade and other payables are obligations to pay for goods or services that have been acquired in the ordinary course of business from suppliers.

Trade and other payables are initially recognised at the transaction price and subsequently measured at amortised cost where the effect of financing is material.
      `
    ),

    policyShareholderLoans: disclosure(
      "Shareholder / director loans",
      `
Loans from shareholders, directors, members or related parties are recognised when the entity becomes party to the contractual provisions of the arrangement.

Such loans are classified as current or non-current based on the terms of repayment and the entity's right to defer settlement at the reporting date. The terms, interest, repayment conditions and security are disclosed where material.
      `
    ),

    policyFinancialAssetImpairment: disclosure(
      "Impairment of financial assets",
      `
Financial assets are assessed for impairment at each reporting date. An impairment loss is recognised where there is evidence that amounts may not be recoverable in accordance with the original or expected terms.

The impairment assessment considers historical collection experience, current conditions and information about expected recoverability where relevant.
      `
    ),

    policyFinancialInstrumentsOffsetting: disclosure(
      "Offsetting financial instruments",
      `
Financial assets and financial liabilities are offset and the net amount presented in the statement of financial position only when the entity currently has a legally enforceable right to offset the recognised amounts and intends either to settle on a net basis or to realise the asset and settle the liability simultaneously.
      `
    ),

    policyInventories: disclosure(
      "Inventories",
      `
Inventories are measured at the lower of cost and net realisable value.

Cost includes expenditure incurred in acquiring the inventories and bringing them to their existing location and condition. Net realisable value is the estimated selling price in the ordinary course of business less the estimated costs of completion and the estimated costs necessary to make the sale.

Inventory write-downs are recognised in profit or loss in the period in which they occur. Reversals of previous write-downs are recognised when the circumstances that caused the write-down no longer exist.
      `
    ),

    policyInvestmentPropertyRecognition: disclosure(
      "Investment property - recognition",
      `
Investment property is property held to earn rentals, for capital appreciation, or both, rather than for use in the production or supply of goods or services or for administrative purposes.

Investment property is recognised as an asset when it is probable that future economic benefits associated with the investment property will flow to the entity and the cost can be measured reliably.
      `
    ),

    policyInvestmentPropertyCostModel: disclosure(
      "Investment property - cost model",
      `
Investment property measured under the cost model is carried at cost less accumulated depreciation and accumulated impairment losses, where applicable.
      `
    ),

    policyInvestmentPropertyFairValueModel: disclosure(
      "Investment property - fair value model",
      `
Investment property measured under the fair value model is carried at fair value at the reporting date. Changes in fair value are recognised in profit or loss in the period in which they arise, where required by the applicable financial reporting framework.
      `
    ),

    policyInvestmentPropertyTransfers: disclosure(
      "Investment property - transfers",
      `
Transfers to or from investment property are made only when there is a change in use evidenced by the circumstances applicable to the property.
      `
    ),

    policyIntangibleAssets: disclosure(
      "Intangible assets",
      `
Intangible assets are initially recognised at cost when it is probable that expected future economic benefits attributable to the asset will flow to the entity and the cost can be measured reliably.

Intangible assets with finite useful lives are amortised over their estimated useful lives. The amortisation method, useful life and residual value are reviewed at each reporting date and adjusted where appropriate.
      `
    ),

    policyImpairment: disclosure(
      "Impairment of non-financial assets",
      `
Assets are assessed at each reporting date for indicators of impairment. If any such indication exists, the recoverable amount of the asset is estimated and an impairment loss is recognised where the carrying amount exceeds the recoverable amount.

Where an impairment loss subsequently reverses, the carrying amount of the asset is increased to the revised estimate of its recoverable amount, subject to the limitations of the applicable financial reporting framework.
      `
    ),

    policyLeasesGeneral: disclosure(
      "Leases - general",
      `
Lease transactions are accounted for in accordance with the applicable financial reporting framework, considering the terms and substance of the lease arrangement.
      `
    ),

    policyLeasesLessee: disclosure(
      "Leases - lessee accounting",
      `
Where the entity is a lessee, lease arrangements are assessed to determine the appropriate accounting treatment under the applicable financial reporting framework.

Lease payments are recognised in profit or loss or recognised as right-of-use assets and lease liabilities where required by the applicable financial reporting framework.
      `
    ),

    policyLeasesLessor: disclosure(
      "Leases - lessor accounting",
      `
Where the entity is a lessor, leases are classified based on the extent to which risks and rewards incidental to ownership of the underlying asset lie with the lessor or the lessee.

Rental income from operating leases is recognised on a straight-line basis over the lease term unless another systematic basis is more representative of the pattern in which benefits from the leased asset are consumed.
      `
    ),

    policyLeasesShortTermLowValue: disclosure(
      "Leases - short-term and low-value leases",
      `
Short-term lease payments and payments for leases of low-value assets are recognised as an expense on a straight-line basis over the lease term, where the applicable recognition exemption is elected or permitted.
      `
    ),

    policyEmployeeBenefits: disclosure(
      "Employee benefits",
      `
Short-term employee benefits are recognised as an expense in the period in which the related service is rendered.

Liabilities for wages, salaries, bonuses, leave pay and other employee benefits expected to be settled wholly within twelve months are measured at the undiscounted amount expected to be paid in exchange for the related service.
      `
    ),

    policyBorrowingCosts: disclosure(
      "Borrowing costs",
      `
Borrowing costs are recognised as an expense in the period in which they are incurred, except to the extent that they are directly attributable to the acquisition, construction or production of a qualifying asset and capitalisation is required or permitted by the applicable financial reporting framework.
      `
    ),

    policyTaxation: disclosure(
      "Taxation",
      `
Current tax assets and liabilities are measured at the amount expected to be recovered from or paid to the taxation authorities, using tax rates and tax laws that have been enacted or substantively enacted by the reporting date.

Deferred tax is recognised where required by the applicable financial reporting framework for temporary differences between the carrying amounts of assets and liabilities for financial reporting purposes and the amounts used for taxation purposes.

Tax expense is recognised in profit or loss except to the extent that it relates to items recognised directly in equity or other comprehensive income.
      `
    ),

    policyShareCapitalEquity: disclosure(
      "Share capital and equity",
      `
Ordinary shares are classified as equity. Equity instruments are measured at the proceeds received, net of direct issue costs where applicable.

Distributions to owners are recognised directly in equity when approved and no longer at the discretion of the entity.
      `
    ),

    policyProvisionsContingencies: disclosure(
      "Provisions and contingencies",
      `
Provisions are recognised when the entity has a present legal or constructive obligation as a result of a past event, it is probable that an outflow of economic benefits will be required to settle the obligation, and the amount can be estimated reliably.

Contingent liabilities are not recognised in the statement of financial position but are disclosed unless the possibility of an outflow of resources is remote. Contingent assets are not recognised but are disclosed where an inflow of economic benefits is probable.
      `
    ),

    policyRelatedParties: disclosure(
      "Related parties",
      `
Related party relationships, transactions and outstanding balances are disclosed where required by the applicable financial reporting framework.

Transactions with related parties are disclosed with sufficient detail to enable users of the annual financial statements to understand the nature of the relationship and the financial effect of the transactions.
      `
    ),

    policyForeignCurrency: disclosure(
      "Foreign currency",
      `
Foreign currency transactions are translated into the presentation currency using the exchange rates prevailing at the dates of the transactions.

Monetary assets and liabilities denominated in foreign currencies are translated at the exchange rate at the reporting date. Exchange differences are recognised in profit or loss unless otherwise required by the applicable financial reporting framework.
      `
    ),
  };
}

export function buildDefaultNoteTexts(): EditableDisclosureTextMap {
  return {
    notesPropertyPlantEquipment: disclosure(
      "Property, plant and equipment",
      "This note should disclose the movement in property, plant and equipment by class, including cost, accumulated depreciation, additions, disposals, depreciation and carrying amounts."
    ),
    notesGoodwill: disclosure(
      "Goodwill",
      "This note should disclose the carrying amount of goodwill, movements during the period and impairment considerations where applicable."
    ),
    notesInvestmentProperty: disclosure(
      "Investment property",
      "This note should disclose investment property balances, movements, valuation approach and rental income or direct operating expenses where applicable."
    ),
    notesIntangibleAssets: disclosure(
      "Intangible assets",
      "This note should disclose intangible asset classes, cost, amortisation, additions, disposals and carrying amounts."
    ),
    notesBiologicalAssets: disclosure(
      "Biological assets",
      "This note should disclose the nature, measurement basis and movement in biological assets where applicable."
    ),
    notesOtherNonCurrentAssets: disclosure(
      "Other non-current assets",
      "This note should disclose the nature and composition of material other non-current assets."
    ),
    notesLoansReceivable: disclosure(
      "Loans receivable",
      "This note should disclose the nature, terms, interest, repayment conditions, security and balances of loans receivable."
    ),
    notesInventories: disclosure(
      "Inventories",
      "This note should disclose inventory categories, carrying amounts, write-downs and reversals where applicable."
    ),
    notesTradeReceivables: disclosure(
      "Trade and other receivables",
      "This note should disclose the composition of trade and other receivables, impairment allowances and material credit risk exposures where applicable."
    ),
    notesCurrentTaxReceivable: disclosure(
      "Current tax receivable",
      "This note should disclose current income tax receivable, provisional tax payments and assessments raised where applicable."
    ),
    notesCashAndCashEquivalents: disclosure(
      "Cash and cash equivalents",
      "This note should disclose cash on hand, bank balances, short-term deposits and bank overdrafts included in cash and cash equivalents."
    ),
    notesShareCapital: disclosure(
      "Share capital",
      "This note should disclose authorised and issued share capital or member contributions, including changes during the period where applicable."
    ),
    notesRetainedIncome: disclosure(
      "Retained income",
      "This note should reconcile opening retained income to closing retained income, including profit or loss and distributions."
    ),
    notesShareholdersLoans: disclosure(
      "Shareholders' loans",
      "This note should disclose shareholder, member or related party loan balances, terms, interest, repayment conditions and security where applicable."
    ),
    notesOtherFinancialLiabilities: disclosure(
      "Other financial liabilities",
      "This note should disclose the nature and terms of material financial liabilities, including borrowings, instalment sale agreements and lease liabilities where applicable."
    ),
    notesTradePayables: disclosure(
      "Trade and other payables",
      "This note should disclose the composition of trade and other payables, accruals, statutory liabilities and other material payables."
    ),
    notesCurrentTaxPayable: disclosure(
      "Current tax payable",
      "This note should disclose current income tax payable, provisional tax payments, assessments raised and movements in the tax balance."
    ),
    notesRevenue: disclosure(
      "Revenue",
      "This note should disclose material categories of revenue, disaggregation where required, and any significant judgements relating to revenue recognition."
    ),
    notesOtherIncome: disclosure(
      "Other income",
      "This note should disclose material categories of other income and separately identify unusual or non-recurring items where applicable."
    ),
    notesOperatingExpenses: disclosure(
      "Operating expenses",
      "This note should disclose material operating expense categories and items required by the applicable reporting framework."
    ),
    notesFinanceCosts: disclosure(
      "Finance costs",
      "This note should disclose interest expense and other finance costs by material category, including borrowings, leases and related party loans where applicable."
    ),
    notesTaxation: disclosure(
      "Taxation",
      "This note should reconcile accounting profit or loss to taxable income where applicable, disclose current and deferred tax components and explain material tax items."
    ),
    notesCashUsedInOperations: disclosure(
      "Cash used in operations",
      "This note should reconcile profit or loss before tax to cash generated from or used in operations, including non-cash items and working capital movements."
    ),
  };
}
