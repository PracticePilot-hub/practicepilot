/** The lead sheet and Notes address exactly the same saved disclosure entries. */
export const LEAD_NOTE_SECTIONS:Record<string,string[]>={
 'ppe':['notesPropertyPlantEquipment'],'right-of-use-assets':['notesRightOfUseAssets'],'investment-property':['notesInvestmentProperty'],'intangibles':['notesIntangibleAssets'],'goodwill':['notesGoodwill'],
 'investments-subsidiaries':['notesInvestmentsSubsidiaries'],'investments-associates':['notesInvestmentsAssociates'],'investments-joint-ventures':['notesInvestmentsJointVentures'],
 'loans-receivable':['notesLoansReceivable'],'directors-employee-loans':['notesLoansReceivable'],'other-non-current-assets':['notesOtherNonCurrentAssets','notesOtherFinancialAssets','notesOtherInvestments','notesBiologicalAssets'],
 'inventory':['notesInventories'],'cash':['notesCashAndCashEquivalents'],'bank-overdraft':['notesCashAndCashEquivalents'],'receivables':['notesTradeReceivables'],'construction-contracts-receivable':['notesContractAssets'],
 'tax-controls':['notesTaxStatutoryReceivables','notesTaxStatutoryPayables'],'current-tax-receivable':['notesCurrentTaxReceivable'],'current-tax-payable':['notesCurrentTaxPayable'],
 'assets-held-for-sale':['notesAssetsHeldForSale'],'liabilities-held-for-sale':['notesLiabilitiesHeldForSale'],
 'share-capital':['notesShareCapital'],'retained-income':['notesRetainedIncome'],'reserves':['notesReserves','notesOtherEquity','notesNonControllingInterests'],
 'provisions':['notesProvisions','notesEmployeeBenefitObligations'],'deferred-income':['notesDeferredIncomeGrants'],'financial-liabilities':['notesOtherFinancialLiabilities','notesSupplierFinance'],
 'borrowings':['notesBorrowings'],'loans-group-companies-payable':['notesGroupRelatedPartyBorrowings'],'loans-stakeholders-payable':['notesShareholdersLoans'],
 'lease-liabilities':['notesLeaseLiabilities','notesAssetFinance'],'other-non-current-liabilities':['notesOtherFinancialLiabilities'],'payables':['notesTradePayables','notesContractLiabilities'],'dividend-payable':['notesDividendPayable'],
 'deferred-tax-asset':['notesTaxation'],'deferred-tax-liability':['notesDeferredTaxLiability'],'taxation':['notesTaxation'],
 'revenue':['notesRevenue'],'cost-of-sales':['notesCostOfSales'],'operating-income':['notesOtherOperatingIncome'],'operating-expenses':['notesOperatingExpenses'],
 'investment-income':['notesInvestmentIncome'],'finance-costs':['notesFinanceCosts'],'non-operating-gains-losses':['notesOtherGainsLosses'],'non-operating-expenses':['notesOperatingExpenses'],'non-operating-income':['notesOtherOperatingIncome'],
 'other-comprehensive-income':['notesOtherComprehensiveIncome'],'discontinued-operations':['notesDiscontinuedOperations'],'related-parties':['notesRelatedParties'],
 'commitments-contingencies':['notesCommitmentsContingencies'],'cash-flow':['notesCashUsedInOperations'],
 'other-disclosures':['notesGoingConcern','notesEventsAfterReportingPeriod','policyBasisPreparation','policyJudgementsEstimates','policyShareBasedPayments','policyForeignCurrency'],
};
