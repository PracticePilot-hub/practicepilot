import { SME_POLICY_CONTENT, PREVIOUS_GENERATED_POLICY_TEXTS } from "../print-studio/afsPolicyContent";
import { COVERAGE_TOPICS } from "../print-studio/afsStandardsCoverage";
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
    "The annual financial statements have been prepared in accordance with IFRS for SMEs and the requirements of the Companies Act 71 of 2008, as amended. They have been prepared on the historical cost basis, except where otherwise stated, and are presented in South African Rand."
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
    "Current tax is the expected tax payable or receivable on taxable income or loss for the year, using tax rates enacted or substantively enacted at the reporting date. Deferred tax is recognised for temporary differences, unused tax losses and unused tax credits to the extent required by IFRS for SMEs."
  ),
  section(
    "policyImpairment",
    "policyImpairment",
    "Impairment of assets",
    "impairment",
    "Impairment",
    "At each reporting date, assets are assessed for indications of impairment. If such indication exists, the recoverable amount is estimated and an impairment loss is recognised where the carrying amount exceeds the recoverable amount."
  ),

  // Additional policy selections using the existing Print Studio option keys.
  section("policyRevenueConstruction", "policyRevenueConstruction", "Contract assets and long-term contracts", "revenue", "Revenue", "Revenue from contracts involving multiple promises or long-term performance is recognised by reference to when control transfers; for the 2015 edition, the stage-of-completion approach is applied where required. Contract balances are recognised as appropriate."),
  section("policyRevenueRoyalties", "policyRevenueRoyalties", "Royalties and licensing", "revenue", "Revenue", "Royalty income is recognised on an accrual basis in accordance with the substance of the relevant agreement."),
  section("policyPropertyPlantEquipmentRecognition", "policyPropertyPlantEquipmentRecognition", "PPE recognition", "ppe", "Property, plant and equipment", "Property, plant and equipment is initially recognised at cost when recognition criteria are met."),
  section("policyPropertyPlantEquipmentSubsequentExpenditure", "policyPropertyPlantEquipmentSubsequentExpenditure", "Subsequent expenditure", "ppe", "Property, plant and equipment", "Subsequent expenditure is capitalised only when recognition requirements are met; repairs are expensed."),
  section("policyPropertyPlantEquipmentDepreciation", "policyPropertyPlantEquipmentDepreciation", "Depreciation", "ppe", "Property, plant and equipment", "Depreciable amounts are allocated over useful lives using methods reflecting consumption of economic benefits."),
  section("policyPropertyPlantEquipmentUsefulLives", "policyPropertyPlantEquipmentUsefulLives", "Useful lives and residual values", "ppe", "Property, plant and equipment", "Useful lives, residual values and depreciation methods are reviewed when relevant indications of change arise."),
  section("policyPropertyPlantEquipmentDerecognition", "policyPropertyPlantEquipmentDerecognition", "Derecognition", "ppe", "Property, plant and equipment", "Assets are derecognised on disposal or when no future benefits are expected."),
  section("policyPropertyPlantEquipmentCostModel", "policyPropertyPlantEquipmentCostModel", "Cost model", "ppe", "Property, plant and equipment", "Classes accounted for under the cost model are carried at cost less accumulated depreciation and impairment."),
  section("policyPropertyPlantEquipmentRevaluationModel", "policyPropertyPlantEquipmentRevaluationModel", "Revaluation model", "ppe", "Property, plant and equipment", "Classes elected for revaluation are accounted for at revalued amounts where permitted; revaluation changes are accounted for under the relevant standard."),
  section("policyPropertyPlantEquipmentAssetsUnderConstruction", "policyPropertyPlantEquipmentAssetsUnderConstruction", "Capital work in progress", "ppe", "Property, plant and equipment", "Assets under construction are carried at cost until available for their intended use."),
  section("policyFinancialAssetsAmortisedCost", "policyFinancialAssetsAmortisedCost", "Financial assets at amortised cost", "financial-instruments", "Financial instruments", "Qualifying basic financial assets are measured at amortised cost using the effective interest method, less impairment."),
  section("policyFinancialLiabilitiesAmortisedCost", "policyFinancialLiabilitiesAmortisedCost", "Financial liabilities at amortised cost", "financial-instruments", "Financial instruments", "Qualifying financial liabilities are subsequently measured at amortised cost using the effective interest method."),
  section("policyShareholderLoans", "policyShareholderLoans", "Shareholder and related-party loans", "financial-instruments", "Financial instruments", "Related-party loans are measured according to the contractual terms and relevant financial-instrument requirements."),
  section("policyFinancialAssetImpairment", "policyFinancialAssetImpairment", "Impairment of financial assets", "financial-instruments", "Financial instruments", "At each reporting date, qualifying financial assets are assessed for objective evidence of impairment and impairment is recognised where required."),
  section("policyFinancialInstrumentsOffsetting", "policyFinancialInstrumentsOffsetting", "Offsetting", "financial-instruments", "Financial instruments", "Financial assets and liabilities are offset only when the relevant criteria are satisfied."),
  section("policyInvestmentPropertyRecognition", "policyInvestmentPropertyRecognition", "Investment property recognition", "investment-property", "Investment property", "Property held to earn rentals or for capital appreciation is classified as investment property."),
  section("policyInvestmentPropertyCostModel", "policyInvestmentPropertyCostModel", "Cost-based measurement", "investment-property", "Investment property", "Investment property is accounted for under the cost model if fair value cannot be measured reliably without undue cost or effort on an ongoing basis."),
  section("policyInvestmentPropertyFairValueModel", "policyInvestmentPropertyFairValueModel", "Fair value measurement", "investment-property", "Investment property", "Investment property whose fair value is reliably measurable without undue cost or effort on an ongoing basis is measured at fair value through profit or loss."),
  section("policyInvestmentPropertyTransfers", "policyInvestmentPropertyTransfers", "Transfers to or from investment property", "investment-property", "Investment property", "Transfers between investment property and other classes are recognised when the property changes its use."),
  section("policyIntangibleAssets", "policyIntangibleAssets", "Intangible assets", "intangibles", "Intangible assets and goodwill", "Acquired intangible assets are initially measured at cost and subsequently at cost less accumulated amortisation and impairment, subject to applicable requirements."),
  section("policyLeasesGeneral", "policyLeasesGeneral", "Lease classification", "leases", "Leases", "Leases are classified as finance or operating leases based on the substance of the arrangement."),
  section("policyLeasesLessee", "policyLeasesLessee", "Leases as lessee", "leases", "Leases", "Finance leases are recognised as assets and obligations; operating lease costs are recognised systematically over the lease term."),
  section("policyLeasesLessor", "policyLeasesLessor", "Leases as lessor", "leases", "Leases", "For finance leases as lessor, a receivable is recognised; operating lease assets continue to be accounted for and rental income is recognised appropriately."),
  section("policyLeasesShortTermLowValue", "policyLeasesShortTermLowValue", "Other lease arrangements", "leases", "Leases", "The entity assesses the terms and substance of each lease arrangement."),
  section("policyEmployeeBenefits", "policyEmployeeBenefits", "Employee benefits", "employee-benefits", "Employee benefits", "Employee benefit costs and liabilities are recognised when employees render services, with defined benefit obligations measured according to the applicable requirements."),
  section("policyBorrowingCosts", "policyBorrowingCosts", "Borrowing costs", "borrowings", "Borrowing costs", "Borrowing costs are recognised as an expense in profit or loss when incurred."),
  section("policyShareCapitalEquity", "policyShareCapitalEquity", "Equity and share capital", "equity", "Equity", "Equity instruments are classified according to contractual substance. Share issues are recognised net of directly attributable transaction costs where applicable."),
  section("policyProvisionsContingencies", "policyProvisionsContingencies", "Provisions and contingencies", "provisions", "Provisions and contingencies", "Provisions are recognised when a present obligation results from a past event, outflows are probable and the amount can be estimated reliably."),
  section("policyRelatedParties", "policyRelatedParties", "Related parties", "related-parties", "Related parties", "Related-party relationships, transactions, outstanding balances and commitments are disclosed where applicable."),
  section("policyForeignCurrency", "policyForeignCurrency", "Foreign currency", "foreign-currency", "Foreign currency", "Foreign-currency transactions are translated at transaction-date exchange rates; monetary balances are retranslated at reporting date with exchange differences generally in profit or loss."),
  section("policyGoodwillBusinessCombinations", "policyGoodwillBusinessCombinations", "Business combinations", "intangibles", "Intangible assets and goodwill", "Business combinations are accounted for using the applicable acquisition method, and goodwill is amortised over its estimated useful life and assessed for impairment."),
  section("policyBiologicalAssets", "policyBiologicalAssets", "Agriculture and biological assets", "agriculture", "Agriculture and biological assets", "Biological assets are measured at fair value less costs to sell when readily determinable without undue cost or effort; otherwise the cost model applies."),
  section("policyGovernmentGrants", "policyGovernmentGrants", "Government grants", "government-grants", "Government grants", "Grants are recognised as income when applicable performance conditions are met; received amounts with unmet conditions are recognised as liabilities."),
  section("policyShareBasedPayments", "policyShareBasedPayments", "Share-based payments", "share-payments", "Share-based payments", "Equity-settled and cash-settled share-based payments are recognised based on the applicable measurement requirements and vesting conditions."),
  section("policyDiscontinuedOperations", "policyDiscontinuedOperations", "Discontinued operations", "discontinued", "Discontinued operations", "Discontinued activities and asset disposals are presented and disclosed according to the applicable IFRS for SMEs rules, rather than automatically applying full IFRS 5."),
  section("policyConsolidation", "policyConsolidation", "Consolidated and separate financial statements", "investments", "Group investments", "Control, significant influence and joint control determine the accounting for interests in other entities."),

];

// Third Edition defaults are selected by the reporting engine; legacy defaults remain unchanged.
export const IFRS_SMES_2025_POLICY_DEFAULTS: Record<string, string> = {
  policyRevenueGeneral: 'Revenue from contracts with customers is accounted for under Section 23 of the IFRS for SMEs Accounting Standard (2025 Third Edition). The entity identifies its contracts and the distinct promises to transfer goods or services, determines and allocates the transaction price, and recognises revenue when or as each promise is fulfilled by transferring control to the customer. Variable consideration, contract modifications and other terms are assessed where applicable. Revenue excludes amounts collected on behalf of third parties.',
  policyRevenueGoods: 'Revenue from the sale of goods is recognised when control of the goods transfers to the customer, normally on delivery or another contractually specified point at which the customer can direct their use and obtain substantially all remaining benefits. Returns, discounts and variable consideration are considered when determining the transaction price.',
  policyRevenueServices: 'Revenue from services is recognised when or as the entity fulfils the relevant promise to the customer. Revenue is recognised over time only where the criteria in Section 23 are met and progress can be measured appropriately; otherwise revenue is recognised at the point in time control of the service transfers. Significant judgements about timing and progress measures are disclosed when relevant.',
  policyPpeRecognition: 'Property, plant and equipment is recognised when its cost can be measured reliably and the item is expected to provide future economic benefits. Items are initially measured at cost, including directly attributable expenditure and any initial estimate of dismantling or restoration obligations where required by Section 17.',
  policyPpeSubsequent: 'After recognition, classes of property, plant and equipment are accounted for under the cost model or, where elected and permitted, the revaluation model. Replacement components are capitalised when the recognition criteria are met and the replaced component is derecognised. Day-to-day repairs and maintenance are expensed as incurred.',
  policyPpeDepreciation: 'Depreciable amounts are allocated systematically over each asset’s estimated useful life using a method reflecting consumption of economic benefits. Significant components with different patterns of consumption are depreciated separately. Useful lives, residual values and depreciation methods are reviewed when indicators of change arise; changes are treated as changes in estimates.',
  policyPpeDerecognition: 'An item of property, plant and equipment is derecognised on disposal or when no future economic benefits are expected. The gain or loss equals net disposal proceeds, if any, less the carrying amount and is recognised in profit or loss.',
  policyLeases: 'Leases are classified as finance or operating leases based on the substance of the arrangement under Section 20 of the IFRS for SMEs Accounting Standard. As lessee, a finance lease is initially recognised as an asset and liability at the lower of the fair value of the leased asset and the present value of minimum lease payments; payments are allocated between finance charges and reduction of the liability. Operating lease payments are expensed on a straight-line basis over the lease term unless another systematic basis better represents the pattern of benefit. Lease commitments and significant terms are disclosed where applicable.',
  policyTaxation: 'Income tax comprises current and deferred tax under Section 29 of the IFRS for SMEs Accounting Standard. Current tax reflects the amount expected to be paid or recovered using enacted or substantively enacted tax laws and rates. Deferred tax is recognised for temporary differences between tax bases and carrying amounts, and for unused tax losses or credits where the relevant recognition criteria are met. Deferred tax assets are reviewed at each reporting date and reduced when recovery is no longer probable. Income tax is generally recognised in profit or loss except where the related transaction is recognised outside profit or loss.',
  policyRevenueConstruction: "Contract revenue is recognised when or as the entity satisfies its promises to customers under Section 23. For obligations satisfied over time, progress is measured using a method that faithfully depicts performance; contract assets and liabilities arise from differences between performance, billing and payment.",
  policyRevenueRoyalties: "Licensing and royalty revenue is recognised based on the nature of the promised intellectual property and when or as control transfers; sales- or usage-based consideration is assessed under Section 23.",
  policyPropertyPlantEquipmentRecognition: "Property, plant and equipment is initially measured at cost, including directly attributable costs and applicable dismantling obligations.",
  policyPropertyPlantEquipmentSubsequentExpenditure: "Replacement components are capitalised when applicable recognition criteria are met, and replaced components are derecognised. Routine repairs are expensed.",
  policyPropertyPlantEquipmentDepreciation: "Significant components are depreciated separately where appropriate. Useful lives, residual values and methods are reviewed when indicators of change arise.",
  policyPropertyPlantEquipmentUsefulLives: "Estimated useful lives, residual values and depreciation methods are reassessed on indications of changed expectations, with revisions treated prospectively as estimates.",
  policyPropertyPlantEquipmentDerecognition: "An asset is derecognised on disposal or when no future economic benefits remain; gains or losses are recognised in profit or loss.",
  policyPropertyPlantEquipmentCostModel: "For classes elected under the cost model, assets are carried at cost less accumulated depreciation and impairment.",
  policyPropertyPlantEquipmentRevaluationModel: "Where elected and permitted, entire classes are carried at revalued amounts less subsequent depreciation and impairment; the revaluation basis and movements are disclosed.",
  policyPropertyPlantEquipmentAssetsUnderConstruction: "Capital work in progress is carried at accumulated cost; depreciation starts when the asset is available for its intended use.",
  policyFinancialAssetsAmortisedCost: "Debt instruments meeting the basic financial instrument conditions in Section 11 are measured at amortised cost using the effective interest method, subject to the applicable initial-measurement and impairment requirements.",
  policyFinancialLiabilitiesAmortisedCost: "Qualifying financial liabilities are measured at amortised cost using the effective interest method; liabilities with different measurement requirements are considered separately.",
  policyShareholderLoans: "Related-party and shareholder loan instruments are assessed using their contractual substance, initial measurement and subsequent accounting under the applicable Section 11 and 12 requirements.",
  policyFinancialAssetImpairment: "At each reporting date, financial assets measured at cost or amortised cost are assessed for objective evidence of impairment under Section 11. Identified impairment losses and qualifying reversals are recognised as required. The IFRS 9 expected-credit-loss model is not automatically applied.",
  policyFinancialInstrumentsOffsetting: "Financial assets and liabilities are offset only where the applicable legal and settlement criteria are satisfied.",
  policyInvestmentPropertyRecognition: "Property held to earn rentals or for capital appreciation is classified as investment property; owner-occupied property is accounted for separately.",
  policyInvestmentPropertyCostModel: "Where fair value cannot be measured reliably without undue cost or effort on an ongoing basis, investment property is accounted for under the applicable cost-model requirements.",
  policyInvestmentPropertyFairValueModel: "Investment property that meets the fair-value-measurement conditions is remeasured at fair value, with changes recognised in profit or loss; valuation techniques and significant inputs are disclosed.",
  policyInvestmentPropertyTransfers: "Transfers between investment property, owner-occupied property and inventories are recognised when the property use changes, following the relevant measurement requirements.",
  policyIntangibleAssets: "Recognised intangible assets are subsequently carried at cost less amortisation and impairment. Useful lives, methods and relevant development expenditure are assessed according to Section 18.",
  policyLeasesGeneral: "Leases are classified as finance or operating leases in accordance with Section 20; full IFRS 16 right-of-use treatment is not automatically applied.",
  policyLeasesLessee: "Finance lease assets and liabilities are initially recognised at the lower of the fair value of the leased asset and present value of minimum lease payments. Operating lease payments are expensed on a systematic basis.",
  policyLeasesLessor: "Lessor finance leases are reflected as a net investment receivable; operating leases retain the underlying asset, with rental income recognised systematically.",
  policyLeasesShortTermLowValue: "Lease classifications and material commitments are determined in accordance with Section 20. Short-term or low-value IFRS 16 exemptions are not automatically imported into IFRS for SMEs.",
  policyEmployeeBenefits: "Short-term and post-employment benefit costs and obligations are recognised under Section 28, including actuarial measurement and related disclosures where applicable.",
  policyBorrowingCosts: "Borrowing costs are recognised as an expense in profit or loss as incurred, under Section 25.",
  policyShareCapitalEquity: "Share capital, reserves and other equity instruments are classified on the basis of their substance; issue costs are accounted for as required.",
  policyProvisionsContingencies: "Provisions are recognised when a present obligation from a past event is probable and can be reliably estimated; discounting and uncertainties are considered when material. Contingencies are disclosed where applicable.",
  policyRelatedParties: "Related parties and key management arrangements are identified and relevant relationships, transactions, balances and commitments are disclosed under Section 33.",
  policyForeignCurrency: "Foreign-currency transactions are initially translated at spot rates, and monetary balances are retranslated at closing rates; exchange differences are accounted for under Section 30.",
  policyGoodwillBusinessCombinations: "Business combinations are accounted for using the acquisition method in Section 19. Goodwill is subsequently amortised over its useful life and assessed for impairment; relevant acquisition judgements are disclosed.",
  policyBiologicalAssets: "Biological assets are measured using the fair value or cost model as permitted by Section 34, with measurement assumptions, gains and losses and relevant movements disclosed.",
  policyGovernmentGrants: "Government grants are recognised under Section 24 when the relevant conditions are met; amounts received before satisfying conditions are liabilities.",
  policyShareBasedPayments: "Share-based payment arrangements are accounted for under Section 26, including measurement and vesting estimates appropriate to equity-settled or cash-settled arrangements.",
  policyDiscontinuedOperations: "Discontinued activities and disposal plans are assessed under the Third Edition presentation and disclosure requirements; IFRS 5 categories are not assumed to apply.",
  policyConsolidation: "Interests in subsidiaries, associates and joint arrangements are classified and measured based on the corresponding Sections 9, 14 and 15 and relevant separate-financial-statement elections.",

};


// Concise starting points for full IFRS. Client-specific elections, parameters
// and disclosures require review; saved client edits are preserved.
const FULL_IFRS_SPECIFIC_POLICY: Record<string,string> = {
 policyRevenueGoods: "Revenue from goods is recognised when control transfers to the customer, assessed from delivery, acceptance and contractual rights. Consideration is measured net of returns, rebates and amounts collected for third parties; variable amounts are included only to the extent that a significant reversal is highly improbable.",
 policyRevenueServices: "Service revenue is recognised over time only when an IFRS 15 over-time criterion is met. Progress is measured using an input or output method that faithfully depicts performance. Otherwise revenue is recognised at the point control transfers. Advances are contract liabilities; a conditional right to consideration is a contract asset and an unconditional right is a receivable.",
 policyRevenueRoyalties: "Revenue from licences reflects whether the promise provides a right to access intellectual property over time or a right to use it at a point in time. Sales- or usage-based royalties relating to intellectual property are recognised at the later of the subsequent sale or usage and satisfaction of the related performance obligation. Principal/agent assessments determine gross or net presentation.",
 policyLeasesLessor: "As lessor, leases transferring substantially all ownership risks and rewards are finance leases: the net investment is recognised as a receivable and finance income earns a constant periodic return. Other leases are operating leases; the underlying asset remains recognised and rental income is recognised on a straight-line or more representative systematic basis. Lease incentives and initial direct costs are recognised over the lease term as required by IFRS 16.",
 policyLeasesLessee: "At commencement the lessee recognises a right-of-use asset and a liability for unpaid lease payments discounted at the implicit rate, if readily determinable, or the incremental borrowing rate. Included payments reflect fixed and in-substance fixed payments and relevant index, option and guarantee terms. Subsequent interest, payments and required remeasurements adjust the liability; corresponding asset adjustments and depreciation follow IFRS 16. Any short-term or low-value exemption is disclosed as an election.",
 policyRevenueRental: "Operating rental income is recognised over the lease term on a straight-line basis unless another systematic basis better represents the pattern of benefit. Lease incentives reduce rental income over that term. Finance-lease income reflects a constant periodic return on the net investment; non-lease service components are assessed under IFRS 15.",
};
const FULL_IFRS_TOPIC_POLICY: Record<string,string> = {
  basis: "The financial statements are prepared in accordance with IFRS Accounting Standards applicable to the reporting period. Material accounting policy information, significant judgements and sources of estimation uncertainty are disclosed. Measurement bases, presentation currency, reporting scope and relevant changes in policies are identified in the accompanying disclosures.",
  going: "The financial statements are prepared on a going concern basis unless management intends to liquidate or cease trading or has no realistic alternative. Management assesses the information available about the future and discloses material uncertainties and significant judgements where required.",
  revenue: "Revenue from contracts with customers is recognised under IFRS 15 when or as performance obligations are satisfied through transfer of control. The transaction price is allocated to distinct performance obligations using relative stand-alone selling prices. Variable consideration, contract modifications, contract balances and significant judgements are assessed for the entity's actual arrangements.",
  ppe: "Property, plant and equipment is initially recognised at cost, including directly attributable expenditure and qualifying restoration obligations. The applicable cost or revaluation model is identified by class. Depreciable amounts are allocated over useful lives, with significant components depreciated separately. Useful lives, residual values and methods are reviewed at least at each financial year end. Disposals and impairment are accounted for under IAS 16 and IAS 36.",
  financial: "Financial instruments are recognised and classified under IFRS 9 and IAS 32 on the basis of contractual terms and, for financial assets, the applicable business model and cash-flow characteristics. Subsequent measurement follows the relevant amortised-cost, fair-value-through-OCI or fair-value-through-profit-or-loss requirements. Expected credit losses are recognised where required. Offsetting is applied only when the IAS 32 criteria are met; instrument risks and measurement are disclosed under IFRS 7.",
  leases: "The entity assesses whether a contract contains a lease under IFRS 16. As lessee, it recognises right-of-use assets and lease liabilities, subject to any elected short-term or low-value exemptions. Liabilities reflect the present value of applicable lease payments and subsequent interest, payments and remeasurements. Right-of-use assets are depreciated and assessed for impairment. Lessor arrangements are classified and accounted for separately as finance or operating leases.",
  "investment-property": "Investment property is initially measured at cost under IAS 40. The entity selects and consistently applies the applicable fair value or cost model and discloses that election. Fair-value-model changes are recognised in profit or loss. Cost-model property is depreciated and tested for impairment, with fair value disclosed as required. Valuation inputs, transfers and restrictions are assessed for the entity's properties.",
  intangibles: "Intangible assets are recognised under IAS 38. Research expenditure is expensed; development expenditure is capitalised only when all recognition criteria are met. Finite-life assets are amortised over their useful lives and tested for impairment when indicated. Indefinite-life assets are not amortised and are tested annually for impairment, with the useful-life assessment reviewed each period. The applicable measurement model and class-specific lives and methods are disclosed.",
  goodwill: "Business combinations are accounted for using the acquisition method under IFRS 3. Goodwill is not amortised. It is allocated to the relevant cash-generating units or groups and tested for impairment annually and when indicators arise under IAS 36. Goodwill impairment losses are not reversed.",
  investments: "Control, joint control and significant influence are assessed under IFRS 10, IFRS 11 and IAS 28. The financial statements identify their consolidated or separate scope and the accounting basis for each material interest. In consolidated statements, intragroup balances and transactions are eliminated and non-controlling interests are separately presented. Separate financial statements apply the applicable IAS 27 measurement election. Exemptions are applied only where their conditions are met.",
  inventory: "Inventories are measured at the lower of cost and net realisable value under IAS 2. Cost includes qualifying purchase, conversion and other costs incurred to bring inventories to their present location and condition. The cost formula, material classes, expenses and write-downs or reversals are disclosed as applicable.",
  cash: "Cash and cash equivalents comprise cash on hand, demand deposits and qualifying short-term, highly liquid investments. Bank overdrafts are included for cash-flow purposes only when repayable on demand and integral to cash management. Cash components are reconciled to the statement of financial position under IAS 7; non-cash transactions are excluded from cash flows.",
  tax: "Income tax comprises current and deferred tax under IAS 12. Current tax uses enacted or substantively enacted tax laws and rates. Deferred tax reflects temporary differences and qualifying unused losses or credits, subject to the applicable recognition exceptions and recoverability criteria. Tax is recognised consistently with the related transaction in profit or loss, OCI or equity. Uncertain income tax treatments are assessed under IFRIC 23.",
  equity: "Instruments are classified as equity or liabilities under IAS 32 according to their contractual substance. Equity contributions and distributions are recognised directly in equity as applicable, together with qualifying transaction costs. The rights, restrictions and movements of material classes and reserves are disclosed.",
  provisions: "Provisions are recognised under IAS 37 for present obligations from past events when a probable outflow can be reliably estimated. They reflect the best estimate of settlement and are discounted when material. Obligations, uncertainties, reimbursements and contingent assets and liabilities are assessed and disclosed as required.",
  benefits: "Employee benefits are accounted for under IAS 19. Short-term benefits are recognised as employees render service. Defined-contribution costs are recognised as contributions become payable; defined-benefit obligations are measured using the required actuarial method. Relevant service costs, net interest and remeasurements are recognised in the applicable statements and the required plan-specific disclosures are provided.",
  grants: "Government grants are recognised under IAS 20 when there is reasonable assurance that the entity will comply with conditions and the grants will be received. Income grants are recognised systematically over the periods of the related costs. The presentation policy for grants related to assets or income, significant conditions and unfulfilled obligations is disclosed.",
  agriculture: "Biological assets within IAS 41 are measured at fair value less costs to sell, except where the narrowly defined initial-recognition exception applies. Changes are recognised in profit or loss. Agricultural produce is measured at fair value less costs to sell at harvest. The entity assesses bearer plants separately under IAS 16 and discloses material valuation assumptions and movements.",
  impairment: "Non-financial assets are assessed for impairment under IAS 36. Recoverable amount is the higher of value in use and fair value less costs of disposal, assessed for the asset or relevant cash-generating unit. Impairment losses and qualifying reversals are recognised as required. Goodwill and applicable intangible assets are tested annually; financial assets follow IFRS 9.",
  borrowing: "Borrowing costs directly attributable to acquiring, constructing or producing qualifying assets are capitalised when the IAS 23 criteria are met. Capitalisation is suspended or ceases as required. Other borrowing costs are recognised in profit or loss as incurred. The amount capitalised and applicable capitalisation rate are disclosed.",
  related: "Related parties are identified under IAS 24, including control, joint control, significant influence, key management and relevant close family and entity relationships. Control relationships, compensation, material transactions, outstanding balances and commitments are assessed and disclosed by the required categories. Transactions are not described as arm's length without substantiation.",
  fx: "Foreign-currency transactions are translated under IAS 21 using the exchange rate at the transaction date. Monetary items are retranslated at closing rates. Non-monetary items follow their applicable measurement-date rates. Exchange differences and foreign-operation translation are recognised in profit or loss or OCI as required, and functional and presentation currencies are disclosed.",
  "share-based": "Share-based payment arrangements are accounted for under IFRS 2. Equity-settled awards use the applicable grant-date or other measurement basis; cash-settled liabilities are remeasured as required. Vesting conditions, estimates, expenses and material award disclosures are assessed for the entity's arrangements.",
  disposals: "Non-current assets or disposal groups meeting IFRS 5 held-for-sale criteria are classified and measured under that Standard, with depreciation ceasing where required. Discontinued operations are separately presented only when the definition is met. Classification, measurement, major asset and liability classes and relevant cash-flow information are disclosed.",
};
function fullIfrsDefault(key:string): string | undefined {
  const topic=COVERAGE_TOPICS.find(topic=>topic.policies.includes(key));
  return FULL_IFRS_SPECIFIC_POLICY[key] || (topic ? FULL_IFRS_TOPIC_POLICY[topic.id] : undefined);
}

function expandedSmePolicy(key:string,edition:"2015"|"2025"):string|undefined {
 if(key==="policyGoodwillBusinessCombinations") return edition==="2025"
  ? "Business combinations within Section 19 use the acquisition method. Identifiable acquired assets and assumed liabilities are recognised using the applicable acquisition-date requirements; non-controlling interests are measured at their proportionate share of recognised identifiable net assets. Consideration, any previously held interest and that non-controlling interest are compared with net identifiable assets to determine goodwill or a reassessed bargain-purchase gain. Acquisition-related costs are expensed except costs of issuing debt or equity, which follow the relevant sections. Contingent consideration is recognised and subsequently accounted for under the applicable classification requirements. Goodwill is carried at cost less accumulated amortisation and impairment; it is amortised over its estimated useful life, with a best estimate not exceeding ten years if the life cannot be established reliably. Goodwill impairment is not reversed. Common-control combinations are outside Section 19."
  : "Business combinations within Section 19 use the purchase method. The cost of a combination includes the fair value of consideration and directly attributable acquisition costs. Qualifying contingent consideration is included when probable and reliably measurable. Identifiable assets, liabilities and qualifying contingent liabilities are recognised under the acquisition-date requirements. Goodwill is the excess of combination cost over the acquirer’s interest in identifiable net assets; a bargain purchase is reassessed before recognising a gain. Goodwill is carried at cost less accumulated amortisation and impairment and is amortised over its estimated useful life; if that life cannot be established reliably, management uses its best estimate not exceeding ten years. Goodwill impairment is not reversed. Common-control combinations are outside Section 19.";
 if(key==="policyFinancialInstruments") return (edition==="2025"
  ? "The entity applies Section 11 Financial Instruments of the 2025 edition; the former option to use IAS 39 recognition and measurement is not available. "
  : "The entity applies the recognition and measurement requirements of Sections 11 and 12 of the 2015 edition, rather than the alternative IAS 39 option. ") + SME_POLICY_CONTENT[key];
 const oldRevenue:Record<string,string>={
  policyRevenueGeneral:"Revenue is measured at the fair value of consideration received or receivable, net of discounts, rebates and amounts collected for third parties. Exchanges of similar goods/services do not create revenue. Goods revenue is recognised when significant risks and rewards transfer, neither continuing managerial involvement nor effective control is retained, amounts and costs can be reliably measured and economic benefits are probable. Services and construction revenue follow the stage-of-completion requirements when outcomes can be estimated reliably. Material revenue categories, methods and significant judgements are disclosed.",
  policyRevenueGoods:"Revenue from goods is recognised when significant risks and rewards transfer to the buyer, the entity retains neither continuing managerial involvement nor effective control, revenue and related costs can be measured reliably and economic benefits are probable. Returns, rebates and discounts reduce revenue using supportable estimates. Amounts collected on behalf of another party are excluded; an agent recognises only its commission.",
  policyRevenueServices:"When a service transaction outcome can be estimated reliably, revenue and costs are recognised by reference to stage of completion using a method that reliably measures work performed. When the outcome cannot be estimated reliably, revenue is recognised only to the extent of recognised expenses that are recoverable. An expected loss is recognised immediately. Advance billings and receipts are not by themselves measures of progress.",
  policyRevenueConstruction:"When a construction contract outcome can be estimated reliably, revenue and contract costs are recognised by reference to stage of completion using reliable estimates. Otherwise revenue is recognised only to the extent of recoverable costs incurred and costs are expensed as incurred. Expected contract losses are recognised immediately. Amounts due from or to customers reflect accumulated recognised revenue/cost outcomes and progress billings under Section 23.",
  policyRevenueRoyalties:"Royalties are recognised on an accrual basis in accordance with the substance of the relevant agreement when economic benefits are probable and the amount can be measured reliably. Licensing and royalty arrangements are assessed for their actual performance conditions rather than treating an advance payment as earned income."
 };
 if(key in oldRevenue) {
   if(edition==="2015") return oldRevenue[key];
   const extra:Record<string,string>={
    policyRevenueGeneral:" Contracts are combined or modified where the applicable criteria require this. The transaction price reflects variable consideration subject to the applicable constraint, significant financing and consideration payable to customers. Allocation is based on relative stand-alone selling prices, subject to the specified exceptions. Revenue recognised over time reflects an appropriate measure of progress; otherwise it is recognised when control transfers. Contract assets and liabilities distinguish performance from billing and payment.",
    policyRevenueGoods:" The assessment considers present rights to payment, legal title, physical possession, significant risks and rewards, and customer acceptance as indicators of control. An obligation to accept returns gives rise to the applicable refund liability and recovery asset rather than recognition of the entire receipt as earned revenue. Principal-versus-agent assessment determines gross revenue or net fee presentation.",
    policyRevenueServices:" Over-time recognition requires the customer to receive and consume benefits as performance occurs, control an asset as it is created, or the performance to create an asset without alternative use with an enforceable right to payment for performance completed. The measure of progress excludes inputs that do not depict performance, is updated at each reporting date and is disclosed for material service streams.",
    policyRevenueConstruction:" Progress estimates reflect the actual transfer of control and are updated as facts change. Advance receipts and progress billings do not by themselves measure performance. Variable consideration and modifications are assessed under the revised revenue model; related rights to consideration and obligations to perform are separately presented as receivables, contract assets or contract liabilities as appropriate.",
    policyRevenueRoyalties:" A licence is assessed to determine the nature of the promised intellectual-property rights and whether revenue is recognised over time or at a point in time. Sales- or usage-based royalties are recognised in accordance with the specific applicable restriction rather than on receipt of an advance. Minimum guarantees and other fixed consideration are assessed separately from contingent royalties."
   };
   return IFRS_SMES_2025_POLICY_DEFAULTS[key]+(extra[key]||"");
 }
 return SME_POLICY_CONTENT[key] || (edition==="2025"?IFRS_SMES_2025_POLICY_DEFAULTS[key]:undefined);
}

function expandedFullPolicy(key:string):string | undefined {
 const shared = new Set(["policyBasisPreparation","policyJudgementsEstimates","policyGoingConcern","policyCash","policyInventories","policyProvisionsContingencies","policyRelatedParties","policyForeignCurrency","policyShareCapitalEquity","policyTaxation","policyRevenueInterest","policyRevenueDividends","policyShareBasedPayments"]);
 if(shared.has(key)) return SME_POLICY_CONTENT[key];
 if(key.startsWith("policyPpe") || key.startsWith("policyPropertyPlantEquipment")) {
   const text=SME_POLICY_CONTENT[key];
   return text ? text.replace("when indicators suggest a significant change", "at least at each financial year end").replace("Depreciation does not cease solely because an asset is idle.","Depreciation ceases on derecognition or classification as held for sale under IFRS 5; it does not cease solely because an asset is idle.") : fullIfrsDefault(key);
 }
 if(key==="policyFinancialAssetsAmortisedCost") return "Financial assets are measured at amortised cost only when held within a business model whose objective is to collect contractual cash flows and those cash flows are solely payments of principal and interest on the outstanding principal. Initial measurement is fair value plus directly attributable transaction costs. Subsequent measurement uses the effective interest method and includes the IFRS 9 expected-credit-loss allowance. Assets failing these conditions are assessed for fair value through OCI or profit or loss rather than classified from an account name.";
 if(key==="policyFinancialLiabilitiesAmortisedCost" || key==="policyTradePayables") return "Financial liabilities not measured at fair value through profit or loss are initially recognised at fair value less directly attributable transaction costs and subsequently at amortised cost using the effective interest method. Normal short-term trade payables are measured at the invoice amount when that approximates fair value. Interest includes fees, premiums, discounts and transaction costs. Liabilities are derecognised when the obligation is discharged, cancelled or expires; modifications are assessed under IFRS 9.";
 if(key==="policyLoans" || key==="policyShareholderLoans") return "Loans, including shareholder and related-party loans, are initially measured at fair value plus or minus attributable transaction costs, except instruments at fair value through profit or loss. Off-market terms are assessed separately from the financing instrument, with the difference classified according to substance. Financial assets are classified using their business model and contractual cash-flow characteristics; qualifying debt assets and liabilities are subsequently measured at amortised cost using the effective interest method. Receivables are subject to IFRS 9 expected credit losses. Enforceable terms and rights at the reporting date determine current/non-current classification.";
 if(key==="policyFinancialInstrumentsOffsetting") return "A financial asset and liability are offset only when the entity currently has a legally enforceable right to set off recognised amounts and intends either to settle on a net basis or realise the asset and settle the liability simultaneously. A master netting arrangement or common counterparty alone does not meet these criteria. The right must be enforceable in the normal course and in the relevant default or insolvency circumstances.";
 if(key==="policyTradeReceivables") return "Trade receivables without a significant financing component are initially measured at the IFRS 15 transaction price. Other receivables are initially measured at fair value plus attributable transaction costs, except instruments at fair value through profit or loss. Receivables held to collect solely principal and interest cash flows are subsequently measured at amortised cost. A loss allowance is recognised under IFRS 9; the simplified lifetime expected-credit-loss approach is applied to trade receivables and contract assets where required or elected. Expected losses reflect probability-weighted outcomes, the time value of money and reasonable supportable forward-looking information. Write-offs occur when there is no reasonable expectation of recovery.";
 if(key==="policyFinancialAssetImpairment") return "Expected credit losses are recognised under IFRS 9 for financial assets at amortised cost, relevant debt instruments at fair value through OCI, contract assets, lease receivables and relevant commitments and guarantees. Twelve-month expected losses apply unless lifetime losses are required because of a significant increase in credit risk or the applicable simplified approach. Estimates are probability-weighted and incorporate reasonable supportable forward-looking information and the time value of money. Changes in loss allowances are recognised in profit or loss. Financial assets are written off when there is no reasonable expectation of recovery.";
 if(key==="policyInvestmentPropertyRecognition") return "Investment property is property held to earn rentals or for capital appreciation rather than for production, administration or ordinary-course sale. It is initially measured at cost including directly attributable transaction costs. Mixed-use properties are separated where required by IAS 40. Subsequent measurement follows the model elected for the applicable properties; that election is disclosed in the investment property note.";
 if(key==="policyInvestmentPropertyCostModel") return "Investment property under the cost model is carried at cost less accumulated depreciation and impairment under the applicable IAS 16 or IFRS 16 requirements, subject to IFRS 5 where relevant. The useful lives and methods, gross carrying amount and accumulated depreciation/impairment are disclosed. Fair value and the methods and significant assumptions used to determine it are disclosed as required by IAS 40 and IFRS 13.";
 if(key==="policyInvestmentPropertyFairValueModel") return "Investment property under the fair value model is remeasured at fair value at each reporting date under IAS 40 and IFRS 13, with changes recognised in profit or loss. Fair value reflects market-participant assumptions at the measurement date. The fair value hierarchy, valuation techniques, significant inputs, restrictions and commitments are disclosed as required. Fair-value investment property is not depreciated.";
 if(key==="policyInvestmentPropertyTransfers") return "Transfers to or from investment property occur only when there is an evidenced change in use and the property meets or ceases to meet the definition. A change in management intention alone is insufficient. On transfer between fair-value investment property and owner-occupied property or inventories, the applicable deemed-cost or remeasurement requirements of IAS 40 are applied; transfers are disclosed separately from acquisitions and disposals.";
 if(key==="policyBorrowingCosts") return "Borrowing costs directly attributable to acquiring, constructing or producing a qualifying asset are capitalised as part of its cost under IAS 23. Capitalisation starts when expenditure, borrowing costs and activities necessary to prepare the asset are in progress, is suspended during extended interruptions and ceases when substantially all preparation activities are complete. Specific borrowing costs are reduced by relevant temporary investment income; general borrowing costs use an appropriate capitalisation rate. Other borrowing costs are expensed as incurred. Capitalised amounts and rates are disclosed.";
 return fullIfrsDefault(key);
}

export function buildAccountingPolicyTextsForEdition(
  edition: "2015" | "2025",
  saved: EditableDisclosureTextMap | null | undefined,
  framework: "smes" | "full" = "smes"
): EditableDisclosureTextMap {
  const legacy = buildDefaultAccountingPolicyTexts();
  const result: EditableDisclosureTextMap = { ...legacy };
  for (const [key, original] of Object.entries(legacy)) {
    const updated = framework === "full" ? expandedFullPolicy(key) : expandedSmePolicy(key,edition);
    const savedEntry = saved?.[key];
    // Replace only a blank or untouched legacy default; NEVER replace client edits.
    const savedText = String(savedEntry?.text ?? "");
    const untouched = !savedText.trim() || savedText === original.text ||
      savedText === IFRS_SMES_2025_POLICY_DEFAULTS[key] || savedText === fullIfrsDefault(key) ||
      PREVIOUS_GENERATED_POLICY_TEXTS[key]?.includes(savedText) || savedText === SME_POLICY_CONTENT[key] || savedText === expandedSmePolicy(key,"2015") || savedText === expandedSmePolicy(key,"2025") || savedText === expandedFullPolicy(key);
    result[key] = {
      title: key === "policyBasisPreparation" && (!savedEntry?.title || savedEntry.title === original.title) && (framework === "full" || edition === "2025") ? "Basis of preparation and material accounting policy information" : savedEntry?.title || original.title,
      text: untouched ? (updated || original.text) : savedText,
    };
  }
  return result;
}

export const noteSections: EditableDisclosureSection[] = [
  // NON-CURRENT ASSETS
  section("notesPropertyPlantEquipment", "notesPropertyPlantEquipment", "Property, plant and equipment", "non-current-assets", "Non-current assets"),
  section("notesRightOfUseAssets", "notesRightOfUseAssets", "Right-of-use assets", "non-current-assets", "Non-current assets"),
  section("notesGoodwill", "notesGoodwill", "Goodwill", "non-current-assets", "Non-current assets"),
  section("notesInvestmentProperty", "notesInvestmentProperty", "Investment property", "non-current-assets", "Non-current assets"),
  section("notesIntangibleAssets", "notesIntangibleAssets", "Intangible assets", "non-current-assets", "Non-current assets"),
  section("notesInvestmentsSubsidiaries", "notesInvestmentsSubsidiaries", "Investments in subsidiaries", "non-current-assets", "Non-current assets"),
  section("notesInvestmentsAssociates", "notesInvestmentsAssociates", "Investments in associates", "non-current-assets", "Non-current assets"),
  section("notesInvestmentsJointVentures", "notesInvestmentsJointVentures", "Investments in joint ventures", "non-current-assets", "Non-current assets"),
  section("notesOtherInvestments", "notesOtherInvestments", "Other investments", "non-current-assets", "Non-current assets"),
  section("notesOtherFinancialAssets", "notesOtherFinancialAssets", "Other financial assets", "non-current-assets", "Non-current assets"),
  section("notesOtherNonCurrentAssets", "notesOtherNonCurrentAssets", "Other non-current assets", "non-current-assets", "Non-current assets"),
  section("notesLoansReceivable", "notesLoansReceivable", "Loans receivable", "non-current-assets", "Non-current assets"),

  // CURRENT ASSETS
  section("notesBiologicalAssets", "notesBiologicalAssets", "Biological assets", "current-assets", "Current assets"),
  section("notesInventories", "notesInventories", "Inventories", "current-assets", "Current assets"),
  section("notesContractAssets", "notesContractAssets", "Contract assets", "current-assets", "Current assets"),
  section("notesTradeReceivables", "notesTradeReceivables", "Trade and other receivables", "current-assets", "Current assets"),
  section("notesTaxStatutoryReceivables", "notesTaxStatutoryReceivables", "Tax and statutory receivables", "current-assets", "Current assets"),
  section("notesCurrentTaxReceivable", "notesCurrentTaxReceivable", "Current tax receivable", "current-assets", "Current assets"),
  section("notesCashAndCashEquivalents", "notesCashAndCashEquivalents", "Cash and cash equivalents", "current-assets", "Current assets", "Cash and cash equivalents consist of cash on hand, bank balances and qualifying short-term deposits."),
  section("notesAssetsHeldForSale", "notesAssetsHeldForSale", "Assets held for sale", "current-assets", "Current assets"),

  // EQUITY
  section("notesShareCapital", "notesShareCapital", "Share capital / contributions", "equity", "Equity"),
  section("notesRetainedIncome", "notesRetainedIncome", "Retained income / accumulated loss", "equity", "Equity"),
  section("notesReserves", "notesReserves", "Reserves", "equity", "Equity"),
  section("notesNonControllingInterests", "notesNonControllingInterests", "Non-controlling interests", "equity", "Equity"),
  section("notesOtherEquity", "notesOtherEquity", "Other equity", "equity", "Equity"),

  // NON-CURRENT LIABILITIES
  section("notesProvisions", "notesProvisions", "Provisions", "non-current-liabilities", "Non-current liabilities"),
  section("notesEmployeeBenefitObligations", "notesEmployeeBenefitObligations", "Employee benefit obligations", "non-current-liabilities", "Non-current liabilities"),
  section("notesDeferredIncomeGrants", "notesDeferredIncomeGrants", "Deferred income and government grants", "non-current-liabilities", "Non-current liabilities"),
  section("notesGroupRelatedPartyBorrowings", "notesGroupRelatedPartyBorrowings", "Group and related-party borrowings", "non-current-liabilities", "Non-current liabilities"),
  section("notesShareholdersLoans", "notesShareholdersLoans", "Shareholder / director / member loans", "non-current-liabilities", "Non-current liabilities"),
  section("notesBorrowings", "notesBorrowings", "Borrowings", "non-current-liabilities", "Non-current liabilities"),
  section("notesAssetFinance", "notesAssetFinance", "Asset finance / instalment sale liabilities", "non-current-liabilities", "Non-current liabilities"),
  section("notesLeaseLiabilities", "notesLeaseLiabilities", "Lease liabilities", "non-current-liabilities", "Non-current liabilities"),
  section("notesOtherFinancialLiabilities", "notesOtherFinancialLiabilities", "Other financial liabilities", "non-current-liabilities", "Non-current liabilities"),
  section("notesSupplierFinance", "notesSupplierFinance", "Supplier finance arrangements", "non-current-liabilities", "Non-current liabilities"),
  section("notesDeferredTaxLiability", "notesDeferredTaxLiability", "Deferred tax", "non-current-assets", "Non-current assets"),

  // CURRENT LIABILITIES
  section("notesTradePayables", "notesTradePayables", "Trade and other payables", "current-liabilities", "Current liabilities"),
  section("notesContractLiabilities", "notesContractLiabilities", "Contract liabilities / deferred revenue", "current-liabilities", "Current liabilities"),
  section("notesDividendPayable", "notesDividendPayable", "Dividend payable", "current-liabilities", "Current liabilities"),
  section("notesTaxStatutoryPayables", "notesTaxStatutoryPayables", "Tax and statutory payables", "current-liabilities", "Current liabilities"),
  section("notesCurrentTaxPayable", "notesCurrentTaxPayable", "Current tax payable", "current-liabilities", "Current liabilities"),
  section("notesLiabilitiesHeldForSale", "notesLiabilitiesHeldForSale", "Liabilities held for sale", "current-liabilities", "Current liabilities"),

  // PROFIT OR LOSS / OCI
  section("notesRevenue", "notesRevenue", "Revenue", "profit-loss", "Income statement / OCI"),
  section("notesCostOfSales", "notesCostOfSales", "Cost of sales", "profit-loss", "Income statement / OCI"),
  section("notesOtherOperatingIncome", "notesOtherOperatingIncome", "Other operating income", "profit-loss", "Income statement / OCI"),
  section("notesInvestmentIncome", "notesInvestmentIncome", "Investment income", "profit-loss", "Income statement / OCI"),
  section("notesOperatingExpenses", "notesOperatingExpenses", "Operating expenses", "profit-loss", "Income statement / OCI"),
  section("notesFinanceCosts", "notesFinanceCosts", "Finance costs", "profit-loss", "Income statement / OCI"),
  section("notesOtherGainsLosses", "notesOtherGainsLosses", "Other gains and losses", "profit-loss", "Income statement / OCI"),
  section("notesTaxation", "notesTaxation", "Taxation", "profit-loss", "Income statement / OCI"),
  section("notesOtherComprehensiveIncome", "notesOtherComprehensiveIncome", "Other comprehensive income", "profit-loss", "Income statement / OCI"),
  section("notesDiscontinuedOperations", "notesDiscontinuedOperations", "Discontinued operations", "profit-loss", "Income statement / OCI"),

  // CASH FLOW
  section("notesCashUsedInOperations", "notesCashUsedInOperations", "Cash generated from / (used in) operations", "cash-flow", "Cash flow"),

  // OTHER DISCLOSURES
  section("notesGoingConcern", "notesGoingConcern", "Going concern", "other", "Other disclosures", "The going-concern assessment and any material uncertainties are disclosed where relevant."),
  section("notesRelatedParties", "notesRelatedParties", "Related parties", "other", "Other disclosures", "Related-party relationships, transactions, balances and commitments are disclosed where applicable."),
  section("notesCommitmentsContingencies", "notesCommitmentsContingencies", "Commitments and contingencies", "other", "Other disclosures"),
  section("notesEventsAfterReportingPeriod", "notesEventsAfterReportingPeriod", "Events after the reporting period", "other", "Other disclosures"),
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
