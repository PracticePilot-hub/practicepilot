import { disclosureTableComplete, type DisclosureTable } from "./disclosureTableData";
import type { StandardsContext } from "./afsStandardsCoverage";
export type DisclosureField = {id:string;label:string;prompt:string;conditional:boolean};
export type DisclosureEntry = {text?:string;notApplicable?:boolean;reason?:string;context?:string;requiresReview?:boolean;reviewReason?:string;tables?:DisclosureTable[]};
export const disclosureContext=(context:StandardsContext)=>context.framework === "full"?"full":`${context.framework}:${context.edition}`;
export const NOTE_DISCLOSURE_FIELDS:Record<string,DisclosureField[]> = {
  "notesPropertyPlantEquipment": [
    {
      "id": "basis",
      "label": "Measurement by class",
      "prompt": "Identify the cost or revaluation model for each class; show gross cost/revaluation, accumulated depreciation and accumulated impairment for both periods.",
      "conditional": false
    },
    {
      "id": "lives",
      "label": "Depreciation methods and useful lives",
      "prompt": "State depreciation methods and useful lives or rates by class, including land and components.",
      "conditional": false
    },
    {
      "id": "reconciliation",
      "label": "Class reconciliations",
      "prompt": "Complete opening-to-closing movements for each class: additions, business combinations, disposals, transfers, revaluations, impairment, reversals, depreciation and exchange movements. Explain non-cash acquisitions separately.",
      "conditional": false
    },
    {
      "id": "restrictions",
      "label": "Restrictions, security and commitments",
      "prompt": "Disclose title restrictions, pledged carrying amounts, capital commitments and construction expenditure, or state the supported absence of these items.",
      "conditional": false
    },
    {
      "id": "revaluations",
      "label": "Revaluation disclosures",
      "prompt": "Where revalued: effective date, independent valuer, methods/inputs, cost-model equivalent, surplus movements and distribution restrictions.",
      "conditional": true
    }
  ],
  "notesRightOfUseAssets": [
    {
      "id": "classification",
      "label": "Applicable lease accounting",
      "prompt": "For SME statements identify finance-leased asset classes under Section 20; do not describe all leases using IFRS 16. For full IFRS identify right-of-use classes and exemptions actually elected.",
      "conditional": false
    },
    {
      "id": "assets",
      "label": "Asset measurement and movements",
      "prompt": "Give carrying amounts by asset class, additions, depreciation and impairment and the relevant measurement basis for both periods.",
      "conditional": false
    },
    {
      "id": "restrictions",
      "label": "Restrictions and material lease terms",
      "prompt": "Describe significant arrangements, restrictions, options and variable payments that explain the recognised assets and obligations.",
      "conditional": false
    }
  ],
  "notesGoodwill": [
    {
      "id": "acquisition",
      "label": "Origin and acquisition disclosures",
      "prompt": "Identify acquisitions giving rise to goodwill, dates, consideration, acquired interests and recognised net assets; distinguish separate investments from consolidated goodwill.",
      "conditional": false
    },
    {
      "id": "life",
      "label": "Subsequent measurement",
      "prompt": "SME: disclose life, amortisation method, expense and reconciliation. Full IFRS: goodwill is not amortised; give allocation to cash-generating units and impairment testing.",
      "conditional": false
    },
    {
      "id": "movement",
      "label": "Goodwill reconciliation and impairment",
      "prompt": "Reconcile opening and closing gross/accumulated amounts; disclose acquisitions, disposals, amortisation where applicable, impairment, exchange movements and material testing assumptions.",
      "conditional": false
    }
  ],
  "notesInvestmentProperty": [
    {
      "id": "model",
      "label": "Measurement basis and valuation",
      "prompt": "Identify fair value or cost basis, why applicable to the framework, valuation techniques and significant inputs; identify independent valuation and relevant valuation date.",
      "conditional": false
    },
    {
      "id": "movements",
      "label": "Opening-to-closing reconciliation",
      "prompt": "Explain additions (separating acquisitions through combinations), disposals, transfers, valuation gains/losses, depreciation/impairment where applicable and other changes for both periods.",
      "conditional": false
    },
    {
      "id": "obligations",
      "label": "Restrictions and contractual obligations",
      "prompt": "Disclose restrictions on realisability/remittances and contractual purchase, construction, development, repair, maintenance or enhancement obligations; record supported absence where applicable.",
      "conditional": false
    },
    {
      "id": "cost",
      "label": "Cost-model and income information",
      "prompt": "For cost measurement provide relevant depreciation and impairment disclosures; for full IFRS disclose fair value and rental income/direct operating expenses as applicable. Explain any required fair-value measurement exception.",
      "conditional": true
    }
  ],
  "notesIntangibleAssets": [
    {
      "id": "classes",
      "label": "Classes, methods and lives",
      "prompt": "Identify classes, measurement basis, useful lives/rates, amortisation method and expense line. SME assets have finite lives; under full IFRS explain indefinite lives separately.",
      "conditional": false
    },
    {
      "id": "movement",
      "label": "Intangible asset reconciliation",
      "prompt": "Reconcile gross and accumulated amounts and opening-to-closing movements by class, including additions, acquisitions, amortisation, impairment, disposals and transfers for both periods.",
      "conditional": false
    },
    {
      "id": "material",
      "label": "Material assets and restrictions",
      "prompt": "Describe individually material assets and remaining lives, title restrictions, security and contractual acquisition commitments; identify research/development expense and full-IFRS capitalisation where relevant.",
      "conditional": false
    }
  ],
  "notesInvestmentsSubsidiaries": [
    {
      "id": "scope",
      "label": "Reporting scope and ownership",
      "prompt": "Name investees, country of incorporation/principal business location, ownership and voting interests, nature of relationship and significant control/joint-control/influence judgements.",
      "conditional": false
    },
    {
      "id": "measurement",
      "label": "Measurement and scope elections",
      "prompt": "Identify consolidated/separate/individual statements and the actual model applied to this investment category; disclose any consolidation exemption and identifying parent information.",
      "conditional": false
    },
    {
      "id": "information",
      "label": "Required investment information",
      "prompt": "Provide relevant carrying amounts, fair values where required, summarised financial information, share of results/OCI, restrictions, commitments, contingencies and reporting-date differences for the applicable scope/model.",
      "conditional": false
    }
  ],
  "notesInvestmentsAssociates": [
    {
      "id": "scope",
      "label": "Reporting scope and ownership",
      "prompt": "Name investees, country of incorporation/principal business location, ownership and voting interests, nature of relationship and significant control/joint-control/influence judgements.",
      "conditional": false
    },
    {
      "id": "measurement",
      "label": "Measurement and scope elections",
      "prompt": "Identify consolidated/separate/individual statements and the actual model applied to this investment category; disclose any consolidation exemption and identifying parent information.",
      "conditional": false
    },
    {
      "id": "information",
      "label": "Required investment information",
      "prompt": "Provide relevant carrying amounts, fair values where required, summarised financial information, share of results/OCI, restrictions, commitments, contingencies and reporting-date differences for the applicable scope/model.",
      "conditional": false
    }
  ],
  "notesInvestmentsJointVentures": [
    {
      "id": "scope",
      "label": "Reporting scope and ownership",
      "prompt": "Name investees, country of incorporation/principal business location, ownership and voting interests, nature of relationship and significant control/joint-control/influence judgements.",
      "conditional": false
    },
    {
      "id": "measurement",
      "label": "Measurement and scope elections",
      "prompt": "Identify consolidated/separate/individual statements and the actual model applied to this investment category; disclose any consolidation exemption and identifying parent information.",
      "conditional": false
    },
    {
      "id": "information",
      "label": "Required investment information",
      "prompt": "Provide relevant carrying amounts, fair values where required, summarised financial information, share of results/OCI, restrictions, commitments, contingencies and reporting-date differences for the applicable scope/model.",
      "conditional": false
    }
  ],
  "notesOtherInvestments": [
    {
      "id": "classification",
      "label": "Instrument categories and measurement",
      "prompt": "Identify instrument classes, basic/non-basic classification under SME or IFRS 9 categories under full IFRS, initial/subsequent bases and relevant fair value methods/inputs.",
      "conditional": false
    },
    {
      "id": "terms",
      "label": "Contractual terms, maturity and security",
      "prompt": "Identify counterparties or appropriate classes, rates, repayment dates, current/non-current split, security, guarantees, restrictions and any breaches or renegotiations.",
      "conditional": false
    },
    {
      "id": "impairment",
      "label": "Impairment and instrument risk",
      "prompt": "Disclose impairment losses/reversals, allowance movements, relevant credit risks and judgements; use SME objective-evidence impairment or full IFRS expected credit losses as applicable.",
      "conditional": false
    }
  ],
  "notesOtherFinancialAssets": [
    {
      "id": "classification",
      "label": "Instrument categories and measurement",
      "prompt": "Identify instrument classes, basic/non-basic classification under SME or IFRS 9 categories under full IFRS, initial/subsequent bases and relevant fair value methods/inputs.",
      "conditional": false
    },
    {
      "id": "terms",
      "label": "Contractual terms, maturity and security",
      "prompt": "Identify counterparties or appropriate classes, rates, repayment dates, current/non-current split, security, guarantees, restrictions and any breaches or renegotiations.",
      "conditional": false
    },
    {
      "id": "impairment",
      "label": "Impairment and instrument risk",
      "prompt": "Disclose impairment losses/reversals, allowance movements, relevant credit risks and judgements; use SME objective-evidence impairment or full IFRS expected credit losses as applicable.",
      "conditional": false
    }
  ],
  "notesLoansReceivable": [
    {
      "id": "classification",
      "label": "Instrument categories and measurement",
      "prompt": "Identify instrument classes, basic/non-basic classification under SME or IFRS 9 categories under full IFRS, initial/subsequent bases and relevant fair value methods/inputs.",
      "conditional": false
    },
    {
      "id": "terms",
      "label": "Contractual terms, maturity and security",
      "prompt": "Identify counterparties or appropriate classes, rates, repayment dates, current/non-current split, security, guarantees, restrictions and any breaches or renegotiations.",
      "conditional": false
    },
    {
      "id": "impairment",
      "label": "Impairment and instrument risk",
      "prompt": "Disclose impairment losses/reversals, allowance movements, relevant credit risks and judgements; use SME objective-evidence impairment or full IFRS expected credit losses as applicable.",
      "conditional": false
    }
  ],
  "notesOtherNonCurrentAssets": [
    {
      "id": "nature",
      "label": "Nature, measurement and recovery",
      "prompt": "Disaggregate material classes, identify the underlying standard and measurement basis, recovery terms and current/non-current classification.",
      "conditional": false
    },
    {
      "id": "changes",
      "label": "Changes, restrictions and impairment",
      "prompt": "Explain material movements, impairment, restrictions and commitments applicable to the underlying assets.",
      "conditional": false
    }
  ],
  "notesBiologicalAssets": [
    {
      "id": "activity",
      "label": "Agricultural activity and classes",
      "prompt": "Describe each class and relevant agricultural activities, distinguishing productive assets and produce where appropriate.",
      "conditional": false
    },
    {
      "id": "measurement",
      "label": "Measurement and valuation",
      "prompt": "State the fair value less costs to sell or permitted cost basis by class, techniques, significant assumptions and reasons for a permitted cost exception.",
      "conditional": false
    },
    {
      "id": "movement",
      "label": "Reconciliation and cost-model information",
      "prompt": "Reconcile acquisitions, growth/fair-value changes, harvest, disposals, combinations, exchange and other movements; cost classes require useful lives, methods, depreciation and impairment.",
      "conditional": false
    },
    {
      "id": "restrictions",
      "label": "Restrictions and commitments",
      "prompt": "Describe pledged assets, restrictions and acquisition/development commitments and other applicable agricultural disclosures.",
      "conditional": false
    }
  ],
  "notesInventories": [
    {
      "id": "formula",
      "label": "Inventory measurement and cost formula",
      "prompt": "State the cost formula by class and measurement basis; do not choose FIFO or weighted average from a balance.",
      "conditional": false
    },
    {
      "id": "expense",
      "label": "Inventory expense and write-downs",
      "prompt": "Disclose inventory recognised as expense, write-downs, reversals and the circumstances causing reversals, including comparative information.",
      "conditional": false
    },
    {
      "id": "security",
      "label": "Inventory pledged as security",
      "prompt": "Disclose carrying amounts pledged as security, or state the supported absence of pledges.",
      "conditional": false
    }
  ],
  "notesContractAssets": [
    {
      "id": "nature",
      "label": "Nature of contract balances",
      "prompt": "Describe rights/obligations, goods/services, billing and payment terms and why a balance is a contract asset, receivable or contract liability.",
      "conditional": false
    },
    {
      "id": "movement",
      "label": "Contract balances and revenue recognition",
      "prompt": "Disclose opening/closing balances and material changes, revenue recognised from opening contract liabilities and relevant performance obligations/significant judgements under the applicable revenue model.",
      "conditional": false
    },
    {
      "id": "recoverability",
      "label": "Recoverability and commitments",
      "prompt": "For assets describe impairment and recoverability; for liabilities explain remaining delivery obligations, expected recognition and refund exposures.",
      "conditional": false
    }
  ],
  "notesContractLiabilities": [
    {
      "id": "nature",
      "label": "Nature of contract balances",
      "prompt": "Describe rights/obligations, goods/services, billing and payment terms and why a balance is a contract asset, receivable or contract liability.",
      "conditional": false
    },
    {
      "id": "movement",
      "label": "Contract balances and revenue recognition",
      "prompt": "Disclose opening/closing balances and material changes, revenue recognised from opening contract liabilities and relevant performance obligations/significant judgements under the applicable revenue model.",
      "conditional": false
    },
    {
      "id": "recoverability",
      "label": "Recoverability and commitments",
      "prompt": "For assets describe impairment and recoverability; for liabilities explain remaining delivery obligations, expected recognition and refund exposures.",
      "conditional": false
    }
  ],
  "notesTradeReceivables": [
    {
      "id": "classes",
      "label": "Receivable classes and terms",
      "prompt": "Distinguish trade, other financial and non-financial receivables and related parties; disclose credit terms, security and financing terms where material.",
      "conditional": false
    },
    {
      "id": "allowance",
      "label": "Allowance and impairment",
      "prompt": "State gross carrying amounts and allowances for both periods, recognised losses/reversals, allowance movements and relevant credit risk/estimation information; apply the correct framework model.",
      "conditional": false
    },
    {
      "id": "transfers",
      "label": "Restrictions, transfers and offsetting",
      "prompt": "Explain pledged/discounted/transferred receivables and derecognition or retained risks, and any qualifying offsetting; otherwise state the supported absence of such arrangements.",
      "conditional": false
    }
  ],
  "notesTaxStatutoryReceivables": [
    {
      "id": "nature",
      "label": "Statutory balances and settlement",
      "prompt": "Disaggregate VAT, payroll and other statutory amounts, distinguish income tax and explain material disputed, overdue or recoverability issues and settlement timing.",
      "conditional": false
    }
  ],
  "notesTaxStatutoryPayables": [
    {
      "id": "nature",
      "label": "Statutory balances and settlement",
      "prompt": "Disaggregate VAT, payroll and other statutory amounts, distinguish income tax and explain material disputed, overdue or recoverability issues and settlement timing.",
      "conditional": false
    }
  ],
  "notesCurrentTaxReceivable": [
    {
      "id": "basis",
      "label": "Current tax balance and settlement",
      "prompt": "Identify tax periods/jurisdictions, current tax charge, payments, prior-year adjustments and balance settlement/recovery; explain any offsetting and material uncertainty.",
      "conditional": false
    }
  ],
  "notesCurrentTaxPayable": [
    {
      "id": "basis",
      "label": "Current tax balance and settlement",
      "prompt": "Identify tax periods/jurisdictions, current tax charge, payments, prior-year adjustments and balance settlement/recovery; explain any offsetting and material uncertainty.",
      "conditional": false
    }
  ],
  "notesCashAndCashEquivalents": [
    {
      "id": "definition",
      "label": "Cash components and cash management",
      "prompt": "Identify cash equivalent composition and maturities and the treatment of demand overdrafts; reconcile to the cash flow statement and explain differences.",
      "conditional": false
    },
    {
      "id": "restrictions",
      "label": "Restricted or unavailable cash",
      "prompt": "Disclose significant cash balances unavailable for use and why, or state the supported absence of restrictions.",
      "conditional": false
    }
  ],
  "notesAssetsHeldForSale": [
    {
      "id": "classification",
      "label": "Framework-specific classification",
      "prompt": "Full IFRS: identify disposal group, criteria/date, expected sale, facts and circumstances and segment if applicable. SME: explain the applicable current/non-current classification and impairment without importing IFRS 5 measurement.",
      "conditional": false
    },
    {
      "id": "measurement",
      "label": "Measurement and disposal information",
      "prompt": "Disclose major classes and relevant carrying values, impairment/gains/losses, valuation basis, sale changes or abandonment and any related discontinued operation.",
      "conditional": false
    }
  ],
  "notesLiabilitiesHeldForSale": [
    {
      "id": "classification",
      "label": "Framework-specific classification",
      "prompt": "Full IFRS: identify disposal group, criteria/date, expected sale, facts and circumstances and segment if applicable. SME: explain the applicable current/non-current classification and impairment without importing IFRS 5 measurement.",
      "conditional": false
    },
    {
      "id": "measurement",
      "label": "Measurement and disposal information",
      "prompt": "Disclose major classes and relevant carrying values, impairment/gains/losses, valuation basis, sale changes or abandonment and any related discontinued operation.",
      "conditional": false
    }
  ],
  "notesShareCapital": [
    {
      "id": "classes",
      "label": "Share classes, quantities and rights",
      "prompt": "For each class disclose authorised and issued shares, paid/unpaid status, nominal/no-par value, opening-to-closing share numbers, rights/preferences/restrictions and shares reserved for issue; for a CC or trust give the corresponding ownership/capital particulars.",
      "conditional": false
    },
    {
      "id": "own",
      "label": "Own shares, options and distributions",
      "prompt": "Disclose own shares held by the entity/group and shares reserved under options/contracts with their terms; disclose relevant distributions or commitments and restrictions.",
      "conditional": true
    }
  ],
  "notesRetainedIncome": [
    {
      "id": "movement",
      "label": "Retained earnings movements",
      "prompt": "Explain profit allocation, dividends, transfers and retrospective corrections/policy changes and restrictions. Reconcile opening and closing balances to the SCE for both periods.",
      "conditional": false
    }
  ],
  "notesReserves": [
    {
      "id": "nature",
      "label": "Nature and purpose of reserves",
      "prompt": "Identify each reserve, its purpose and distribution restrictions; do not combine revaluation, translation and other reserves without explanation.",
      "conditional": false
    },
    {
      "id": "movement",
      "label": "Reserve movements and OCI",
      "prompt": "Explain additions, transfers, distributions, OCI and tax by reserve and reconcile to the SCE, separating parent/NCI attribution for consolidated statements.",
      "conditional": false
    }
  ],
  "notesNonControllingInterests": [
    {
      "id": "scope",
      "label": "Consolidated scope and interests",
      "prompt": "NCI belongs in consolidated equity. Identify subsidiaries and ownership/voting percentages; resolve this mapping for standalone/separate statements rather than hide the balance.",
      "conditional": false
    },
    {
      "id": "allocation",
      "label": "NCI movements and attribution",
      "prompt": "Reconcile opening balance, profit/loss, OCI, contributions, distributions and ownership changes; provide required subsidiary information, restrictions and significant judgements for the applicable framework.",
      "conditional": false
    }
  ],
  "notesOtherEquity": [
    {
      "id": "terms",
      "label": "Equity classification and instrument rights",
      "prompt": "Identify instruments and contractual terms supporting equity versus liability classification, rights, restrictions and any compound components.",
      "conditional": false
    },
    {
      "id": "movement",
      "label": "Other equity movements",
      "prompt": "Reconcile opening and closing balances, contributions, distributions, transfers and ownership changes to the SCE; distinguish cash and non-cash transactions.",
      "conditional": false
    }
  ],
  "notesGroupRelatedPartyBorrowings": [
    {
      "id": "terms",
      "label": "Borrowing terms and security",
      "prompt": "For material classes identify lender/category, rate, maturity, instalments, current/non-current portions, pledged assets, guarantees, subordination and repayment/on-demand conditions.",
      "conditional": false
    },
    {
      "id": "breaches",
      "label": "Defaults, breaches and financing changes",
      "prompt": "Disclose defaults/breaches, carrying amounts, remedies/renegotiations and relevant financing changes, or state the supported absence; identify non-cash changes separately.",
      "conditional": false
    },
    {
      "id": "risks",
      "label": "Classification, measurement and risk",
      "prompt": "Explain measurement, covenant-dependent classification and relevant liquidity/market risk and maturity information required by the framework. Cross-reference related-party transactions and terms where relevant.",
      "conditional": false
    }
  ],
  "notesShareholdersLoans": [
    {
      "id": "terms",
      "label": "Borrowing terms and security",
      "prompt": "For material classes identify lender/category, rate, maturity, instalments, current/non-current portions, pledged assets, guarantees, subordination and repayment/on-demand conditions.",
      "conditional": false
    },
    {
      "id": "breaches",
      "label": "Defaults, breaches and financing changes",
      "prompt": "Disclose defaults/breaches, carrying amounts, remedies/renegotiations and relevant financing changes, or state the supported absence; identify non-cash changes separately.",
      "conditional": false
    },
    {
      "id": "risks",
      "label": "Classification, measurement and risk",
      "prompt": "Explain measurement, covenant-dependent classification and relevant liquidity/market risk and maturity information required by the framework. Cross-reference related-party transactions and terms where relevant.",
      "conditional": false
    }
  ],
  "notesBorrowings": [
    {
      "id": "terms",
      "label": "Borrowing terms and security",
      "prompt": "For material classes identify lender/category, rate, maturity, instalments, current/non-current portions, pledged assets, guarantees, subordination and repayment/on-demand conditions.",
      "conditional": false
    },
    {
      "id": "breaches",
      "label": "Defaults, breaches and financing changes",
      "prompt": "Disclose defaults/breaches, carrying amounts, remedies/renegotiations and relevant financing changes, or state the supported absence; identify non-cash changes separately.",
      "conditional": false
    },
    {
      "id": "risks",
      "label": "Classification, measurement and risk",
      "prompt": "Explain measurement, covenant-dependent classification and relevant liquidity/market risk and maturity information required by the framework. Cross-reference related-party transactions and terms where relevant.",
      "conditional": false
    }
  ],
  "notesOtherFinancialLiabilities": [
    {
      "id": "terms",
      "label": "Borrowing terms and security",
      "prompt": "For material classes identify lender/category, rate, maturity, instalments, current/non-current portions, pledged assets, guarantees, subordination and repayment/on-demand conditions.",
      "conditional": false
    },
    {
      "id": "breaches",
      "label": "Defaults, breaches and financing changes",
      "prompt": "Disclose defaults/breaches, carrying amounts, remedies/renegotiations and relevant financing changes, or state the supported absence; identify non-cash changes separately.",
      "conditional": false
    },
    {
      "id": "risks",
      "label": "Classification, measurement and risk",
      "prompt": "Explain measurement, covenant-dependent classification and relevant liquidity/market risk and maturity information required by the framework. Cross-reference related-party transactions and terms where relevant.",
      "conditional": false
    }
  ],
  "notesLeaseLiabilities": [
    {
      "id": "nature",
      "label": "Lease or financing arrangements",
      "prompt": "Identify finance/operating lease classification under SME or IFRS 16 lessee treatment under full IFRS, and distinguish asset-backed borrowing from a lease.",
      "conditional": false
    },
    {
      "id": "maturity",
      "label": "Future payments and finance charges",
      "prompt": "SME finance leases: future minimum payments and present values within one year, one-to-five years and after five years, and material contingent rent/terms. Full IFRS: required separate lease maturity analysis and lease cash/expense disclosures.",
      "conditional": false
    },
    {
      "id": "security",
      "label": "Terms, options and restrictions",
      "prompt": "Describe security, purchase/renewal options, variable payments, residual guarantees and restrictions; reconcile the obligation with recognised asset/cash movements.",
      "conditional": false
    }
  ],
  "notesAssetFinance": [
    {
      "id": "nature",
      "label": "Lease or financing arrangements",
      "prompt": "Identify finance/operating lease classification under SME or IFRS 16 lessee treatment under full IFRS, and distinguish asset-backed borrowing from a lease.",
      "conditional": false
    },
    {
      "id": "maturity",
      "label": "Future payments and finance charges",
      "prompt": "SME finance leases: future minimum payments and present values within one year, one-to-five years and after five years, and material contingent rent/terms. Full IFRS: required separate lease maturity analysis and lease cash/expense disclosures.",
      "conditional": false
    },
    {
      "id": "security",
      "label": "Terms, options and restrictions",
      "prompt": "Describe security, purchase/renewal options, variable payments, residual guarantees and restrictions; reconcile the obligation with recognised asset/cash movements.",
      "conditional": false
    }
  ],
  "notesProvisions": [
    {
      "id": "nature",
      "label": "Nature, timing and uncertainty",
      "prompt": "Describe each obligation, expected timing, significant uncertainties/assumptions and discounting; state reimbursements and separately recognised reimbursement assets.",
      "conditional": false
    },
    {
      "id": "movement",
      "label": "Provision reconciliation by class",
      "prompt": "Reconcile opening balance, new provisions, utilisation, reversals, discount unwind and other movements separately by class, with comparative information as required.",
      "conditional": false
    }
  ],
  "notesEmployeeBenefitObligations": [
    {
      "id": "plans",
      "label": "Benefit arrangements and measurement",
      "prompt": "Describe material short-term, contribution, defined-benefit and termination arrangements and the measurement/recognition policy actually used.",
      "conditional": false
    },
    {
      "id": "amounts",
      "label": "Expense, liabilities and plan disclosures",
      "prompt": "Disclose defined contribution expense and material benefit amounts; for defined benefit plans provide the required obligation/asset reconciliations, remeasurements, assumptions, funding and risk disclosures for the applicable framework.",
      "conditional": false
    }
  ],
  "notesDeferredTaxLiability": [
    {
      "id": "temporary",
      "label": "Deferred tax by source",
      "prompt": "Disclose temporary differences, losses and credits by type for both periods, recognised assets/liabilities, movement through profit/OCI/equity and measurement tax rates.",
      "conditional": false
    },
    {
      "id": "recovery",
      "label": "Recovery, unrecognised amounts and offsetting",
      "prompt": "Explain evidence supporting deferred tax assets, unrecognised losses/credits and expiry, relevant investment exceptions, material uncertainties and the basis of any offsetting.",
      "conditional": false
    }
  ],
  "notesDeferredIncomeGrants": [
    {
      "id": "nature",
      "label": "Nature, recognition and conditions",
      "prompt": "Distinguish grants from customer advances and other deferred income. Describe grant conditions, accounting policy, income recognised, carrying liabilities and unfulfilled conditions/contingencies; state other direct government assistance.",
      "conditional": false
    },
    {
      "id": "movement",
      "label": "Deferred income movement and settlement",
      "prompt": "Explain receipts, income releases, repayments and other changes and expected settlement/performance timing.",
      "conditional": false
    }
  ],
  "notesTradePayables": [
    {
      "id": "classes",
      "label": "Payable classes and payment terms",
      "prompt": "Disaggregate trade, accruals and other financial/non-financial payables; disclose material credit terms, related parties, financing arrangements and current/non-current classification.",
      "conditional": false
    },
    {
      "id": "risks",
      "label": "Security, liquidity and defaults",
      "prompt": "Describe material guarantees, restrictions, defaults, offsetting and relevant liquidity risks; supplier finance arrangements require separate assessment.",
      "conditional": false
    }
  ],
  "notesSupplierFinance": [
    {
      "id": "terms",
      "label": "Arrangement terms and conditions",
      "prompt": "Describe the arrangements, terms, security and guarantees and separately identify arrangements with dissimilar terms.",
      "conditional": false
    },
    {
      "id": "amounts",
      "label": "Carrying amounts and payment dates",
      "prompt": "Disclose beginning/end carrying amounts and statement line items, amounts suppliers have already received from finance providers, and payment due-date ranges for arrangement and comparable non-arrangement payables.",
      "conditional": false
    },
    {
      "id": "changes",
      "label": "Non-cash changes and liquidity",
      "prompt": "Describe types and effects of non-cash changes and relevant concentration/liquidity risk. For SME 2015 assess required fair presentation information without claiming the new 2025 paragraphs were already mandatory.",
      "conditional": false
    }
  ],
  "notesDividendPayable": [
    {
      "id": "declaration",
      "label": "Dividend declaration and settlement",
      "prompt": "Disclose the date and authority for declaration, amount per share/class, total distribution, unpaid amount and expected settlement; distinguish distributions declared after the reporting period and assess relevant tax consequences.",
      "conditional": false
    }
  ],
  "notesRevenue": [
    {
      "id": "streams",
      "label": "Revenue streams and timing",
      "prompt": "Describe material goods/services and disaggregate revenue into meaningful categories; explain when control transfers under SME 2025/full IFRS or risks/rewards and stage of completion under SME 2015.",
      "conditional": false
    },
    {
      "id": "terms",
      "label": "Contract terms and significant judgements",
      "prompt": "Explain payment terms, variable consideration, returns/refunds, warranties, principal/agent judgements and progress measures relevant to the actual contracts.",
      "conditional": false
    },
    {
      "id": "balances",
      "label": "Contract balances and obligations",
      "prompt": "Provide required contract balance, performance obligation and related judgement disclosures for the applicable edition, cross-referencing contract asset/liability notes.",
      "conditional": false
    }
  ],
  "notesCostOfSales": [
    {
      "id": "composition",
      "label": "Cost of sales composition",
      "prompt": "Disaggregate material costs and explain inventory expense, write-downs and unusual cost items; reconcile the function presentation with required nature-of-expense disclosures.",
      "conditional": false
    }
  ],
  "notesOtherOperatingIncome": [
    {
      "id": "nature",
      "label": "Nature and measurement of income/gains",
      "prompt": "Explain material sources, separate income from gains/losses, identify measurement basis and distinguish cash from valuation or disposal effects; disclose relevant related-party items and comparatives.",
      "conditional": false
    }
  ],
  "notesInvestmentIncome": [
    {
      "id": "nature",
      "label": "Nature and measurement of income/gains",
      "prompt": "Explain material sources, separate income from gains/losses, identify measurement basis and distinguish cash from valuation or disposal effects; disclose relevant related-party items and comparatives.",
      "conditional": false
    }
  ],
  "notesOtherGainsLosses": [
    {
      "id": "nature",
      "label": "Nature and measurement of income/gains",
      "prompt": "Explain material sources, separate income from gains/losses, identify measurement basis and distinguish cash from valuation or disposal effects; disclose relevant related-party items and comparatives.",
      "conditional": false
    }
  ],
  "notesOperatingExpenses": [
    {
      "id": "nature",
      "label": "Material expenses by nature",
      "prompt": "Provide the required nature information, including depreciation/amortisation, employee benefit expense and material impairment, write-downs, provisions and unusual items, even if the primary statement uses functions.",
      "conditional": false
    }
  ],
  "notesFinanceCosts": [
    {
      "id": "components",
      "label": "Finance cost components and borrowing policy",
      "prompt": "Separate effective-interest expense, lease finance charges and other material financing costs. SME borrowing costs are expensed; full IFRS must disclose qualifying capitalised amounts and capitalisation rate where applicable.",
      "conditional": false
    }
  ],
  "notesTaxation": [
    {
      "id": "components",
      "label": "Current and deferred tax components",
      "prompt": "Disclose current tax, prior-period current adjustments, origination/reversal of temporary differences, rate changes, asset recognition changes and other material components; distinguish tax in profit, OCI and equity.",
      "conditional": false
    },
    {
      "id": "reconciliation",
      "label": "Tax reconciliation",
      "prompt": "Provide the required numerical reconciliation of tax expense to accounting profit multiplied by the applicable tax rate (or rate reconciliation where permitted); explain material reconciling items and changes in rates. Do not force a percentage where the base is nil.",
      "conditional": false
    },
    {
      "id": "uncertainty",
      "label": "Other tax information",
      "prompt": "Disclose material tax uncertainties, unrecognised losses/credits and expiry and relevant distribution/investment tax consequences; cross-reference deferred tax detail.",
      "conditional": false
    }
  ],
  "notesOtherComprehensiveIncome": [
    {
      "id": "categories",
      "label": "OCI categories and tax",
      "prompt": "Identify the standard permitting each OCI category, gross amount, tax effect, net amount and permitted reclassification or transfer. Full IFRS separates items that may and may not be subsequently reclassified.",
      "conditional": false
    },
    {
      "id": "equity",
      "label": "Equity allocation",
      "prompt": "Reconcile each category to its reserve/SCE movement and, for consolidated statements, attribute comprehensive income between parent owners and NCI.",
      "conditional": false
    }
  ],
  "notesDiscontinuedOperations": [
    {
      "id": "operation",
      "label": "Disposed/discontinued component",
      "prompt": "Describe the component and facts meeting the applicable definition, disposal dates and any continuing involvement; distinguish a disposal of an individual asset.",
      "conditional": false
    },
    {
      "id": "results",
      "label": "Results and disposal effects",
      "prompt": "Provide separate post-tax result and applicable analysis, disposal/remeasurement gains/losses and tax, comparative re-presentation and required cash-flow information.",
      "conditional": false
    }
  ],
  "notesCashUsedInOperations": [
    {
      "id": "reconciliation",
      "label": "Operating cash reconciliation",
      "prompt": "Reconcile profit to cash generated/used in operations using separately identified non-cash items and operating working capital changes; distinguish tax, finance and investing items.",
      "conditional": false
    },
    {
      "id": "noncash",
      "label": "Non-cash financing and investing",
      "prompt": "Disclose material investing/financing transactions excluded from cash flows, explain financing liability movements as required and reconcile cash components to the balance sheet.",
      "conditional": false
    }
  ],
  "notesGoingConcern": [
    {
      "id": "assessment",
      "label": "Management assessment and conclusion",
      "prompt": "Describe the assessment period, significant adverse conditions, forecasts/support and management conclusion; include material uncertainties and significant judgements where required.",
      "conditional": false
    },
    {
      "id": "basis",
      "label": "Basis and material uncertainties",
      "prompt": "State the basis used. If a material uncertainty exists, clearly disclose the events/conditions and uncertainty. If not going concern, explain the alternative basis and reasons. Do not assert financial support without evidence.",
      "conditional": false
    }
  ],
  "notesRelatedParties": [
    {
      "id": "population",
      "label": "Relationships and transaction completeness",
      "prompt": "Use the related-party account editor and manual rows below: identify control relationships independently of transactions, categories of parties, key management and arrangements without separate TB accounts.",
      "conditional": false
    },
    {
      "id": "terms",
      "label": "Transactions, balances and terms",
      "prompt": "Disclose required transaction amounts, balances/commitments, settlement terms, security/guarantees, provisions for uncollectible balances and bad-debt expense by required categories. Do not label terms arm’s length without substantiation.",
      "conditional": false
    },
    {
      "id": "compensation",
      "label": "Key-management compensation",
      "prompt": "Disclose total compensation under SME; full IFRS also requires the prescribed compensation categories. Assess management-entity service fees separately.",
      "conditional": false
    }
  ],
  "notesCommitmentsContingencies": [
    {
      "id": "commitments",
      "label": "Contractual commitments",
      "prompt": "Describe material capital, lease, purchase and other commitments with amounts/timing and appropriate cross-references; identify supported absence where none exist.",
      "conditional": false
    },
    {
      "id": "contingencies",
      "label": "Contingent liabilities and assets",
      "prompt": "For each relevant class describe nature, estimated financial effect or inability to estimate, uncertainties and reimbursement possibilities. Contingent liabilities are omitted only when outflow is remote; contingent assets are disclosed when inflow is probable. Explain any permitted seriously-prejudicial omission without inventing nil exposure.",
      "conditional": false
    }
  ],
  "notesEventsAfterReportingPeriod": [
    {
      "id": "authorisation",
      "label": "Authorisation date and authority",
      "prompt": "State the date financial statements were authorised and who authorised them, including whether owners or others can amend them after issue where relevant.",
      "conditional": false
    },
    {
      "id": "events",
      "label": "Subsequent events assessment",
      "prompt": "Describe material non-adjusting events and estimated financial effect or why it cannot be estimated. Adjusting events update recognised amounts/disclosures. If no material events exist, state that only after assessment through authorisation.",
      "conditional": false
    }
  ]
};
Object.assign(NOTE_DISCLOSURE_FIELDS, {
 policyBasisPreparation:[
  {id:"scope",label:"Reporting entity, framework and measurement bases",prompt:"Identify the reporting framework and edition, standalone/separate/consolidated scope, material measurement elections, functional/presentation currency, rounding, reporting period and relevant compliance/early-adoption basis. Explain any consolidation exemption. Do not assert compliance until requirements are met.",conditional:false},
  {id:"changes",label:"Policy changes, errors and transition",prompt:"Disclose applicable new standards/edition and transition effects, policy changes, restatements and comparative reclassifications with required reconciliations; state the supported absence of changes where appropriate. Full IFRS also requires relevant issued-but-not-effective information.",conditional:false}],
 policyJudgementsEstimates:[
  {id:"judgements",label:"Significant judgements",prompt:"Describe the actual judgements with the most significant effect on recognised amounts, excluding estimates: for example control, principal/agent, recognition or classification decisions. Explain the facts and conclusions rather than repeat a generic policy.",conditional:false},
  {id:"estimates",label:"Sources of estimation uncertainty",prompt:"Identify key assumptions and other major estimation uncertainties with significant risk of material adjustment in the next financial year, the affected asset/liability nature and carrying amounts, and relevant sensitivity/range information. Record a supported conclusion if none exist.",conditional:false}],
 policyShareBasedPayments:[{id:"awards",label:"Share-based payment arrangements",prompt:"Describe awards/terms, number and weighted-average exercise price movements, valuation methods/inputs, expenses, liabilities and other required information; assess arrangements not identifiable from the TB.",conditional:false}],
 policyForeignCurrency:[{id:"currency",label:"Currency and translation information",prompt:"Identify functional and presentation currencies and reasons for any difference/change, exchange differences in profit and OCI and reserve reconciliation, with relevant foreign-operation information.",conditional:false}]
});
export const POLICY_DISCLOSURE_KEYS=["policyBasisPreparation","policyJudgementsEstimates","policyShareBasedPayments","policyForeignCurrency"];
export function disclosureFields(key:string, context:StandardsContext):DisclosureField[] {
  const fields=(NOTE_DISCLOSURE_FIELDS[key] || []).map(field=>({...field}));
  if(context.framework !== "smes") return fields;
  if(key === "notesTradeReceivables") fields.find(field=>field.id === "allowance")!.prompt = "Apply the selected Section 11 model: objective evidence of incurred impairment, gross balances, recognised losses/reversals and supporting estimates. Do not assume IFRS 9 expected credit losses. Under the 2025 edition also disclose financial assets aged by contractual due date.";
  if(key === "notesGoodwill") fields.find(field=>field.id === "acquisition")!.prompt = context.edition === "2025" ? "Apply revised Section 19: acquisition method, consideration and NCI measurement, expense acquisition-related costs except issue costs, and disclose current combinations/contingent consideration where applicable." : "Apply 2015 Section 19: purchase method, combination cost including directly attributable costs, qualifying contingent consideration and required acquisition particulars.";
  if(key === "notesContractAssets" && context.edition === "2015") fields.find(field=>field.id === "nature")!.prompt = "Describe amounts due from construction/service customers under 2015 Section 23, distinguishing billed receivables and unbilled work; disclose contract costs/profit, advances and retentions where applicable. Do not assert a five-step control model.";
  if(context.edition === "2025") {
    if(["notesOtherInvestments","notesOtherFinancialAssets","notesOtherFinancialLiabilities","notesPropertyPlantEquipment","notesInvestmentProperty","notesBiologicalAssets"].includes(key)) fields.push({id:"fairValue",label:"Fair value by class",prompt:"Section 12.28–12.32: provide a table of closing fair values by class, hierarchy levels and Level 2/3 techniques and inputs. For recurring Level 3 disclose gains/losses in profit or loss and OCI. Explain a supported exclusion if no asset/liability in this note is measured at fair value.",conditional:true});
    if(key === "notesOtherFinancialAssets") fields.push({id:"aging",label:"Financial-asset due-date analysis",prompt:"Section 11.43: age financial assets by contractual due date, distinguishing current, past due and impaired classes. Include other receivables and cross-reference trade receivables.",conditional:false});
    if(key === "notesOtherFinancialLiabilities") fields.push({id:"maturity",label:"Financial-liability maturities",prompt:"Sections 11.43A–11.43B: analyse financial liabilities by category and appropriate maturity bands, distinguishing financial instruments from non-financial obligations.",conditional:false});
    if(key === "notesRevenue") fields.push({id:"contractDetails",label:"Contract balances, costs and elections",prompt:"Sections 23.83–23.90: opening/closing receivables, contract assets/liabilities, impairment, revenue from opening contract liabilities, progress methods, transaction-price/allocation judgements, fulfilment-cost assets and relevant financing/customer-option elections.",conditional:false});
  }
  return fields;
}
export function supportedDisclosureText(value:unknown):string {
 const text=String(value??"").trim();
 return /^(?:n\/?a|none|nil|tbd|todo|unknown|pending|[-.]+)$/i.test(text) || /\{[^}]+\}|\[(?:insert|enter|describe|complete)[^\]]*\]/i.test(text) ? "" : text;
}
export function fieldComplete(field:DisclosureField,entry:DisclosureEntry|undefined,context?:StandardsContext):boolean {
 if(entry?.requiresReview) return false;
 if(context && entry?.context !== disclosureContext(context)) return false;
 if(entry?.notApplicable) return field.conditional && supportedDisclosureText(entry.reason).length>=12;
 return supportedDisclosureText(entry?.text).length>=12 && (!entry?.tables || (Array.isArray(entry.tables) && entry.tables.every(disclosureTableComplete)));
}
export function noteDisclosureIssues(notes:readonly {key:string;optionKey:string;defaultTitle?:string;title?:string}[],options:Record<string,any>,state:Record<string,any>,context:StandardsContext) {
 const entries=state.disclosureContent||{};
 return notes.filter(note=>options[note.optionKey]).flatMap(note=>{
  const fields=disclosureFields(note.key,context),missing=fields.filter(field=>!fieldComplete(field,entries[note.key]?.[field.id],context));
  return missing.length?[{key:note.key,title:note.defaultTitle||note.title||note.key,missing:missing.map(field=>field.label)}]:[];
 });
}
