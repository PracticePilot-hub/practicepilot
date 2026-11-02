// Policy applicability is an advisory review, NOT accounting or disclosure sign-off.
// Only numbered PP mapping codes drive detection; descriptions are never inspected.
export type PolicyRule = { family: string; label: string; codes: readonly string[]; policyKeys: readonly string[]; note: string };
export const POLICY_APPLICABILITY_RULES: readonly PolicyRule[] = [
  {family:"PPE",label:"Property, plant and equipment",codes:["305"],policyKeys:["policyPpeRecognition","policyPpeDepreciation","policyPpeDerecognition"],note:"Confirm the measurement model and useful lives."},
  {family:"Leases",label:"Leases",codes:["306","555"],policyKeys:["policyLeasesGeneral"],note:"Confirm lessee/lessor, finance/operating classification and reporting edition."},
  {family:"Investment property",label:"Investment property",codes:["310"],policyKeys:["policyInvestmentPropertyRecognition"],note:"Select the appropriate fair-value or cost-model policy after reviewing measurement evidence."},
  {family:"Intangible assets",label:"Intangible assets",codes:["320"],policyKeys:["policyIntangibleAssets"],note:"Check amortisation, useful lives and impairment."},
  {family:"Goodwill",label:"Goodwill and business combinations",codes:["321"],policyKeys:["policyGoodwillBusinessCombinations"],note:"Review acquisitions, amortisation and impairment."},
  {family:"Group investments",label:"Group investments",codes:["326","327","328"],policyKeys:["policyConsolidation"],note:"Review the accounting treatment of subsidiaries, associates and joint arrangements."},
  {family:"Financial assets",label:"Financial assets",codes:["340","430","432","449","390","395","495"],policyKeys:["policyFinancialInstruments","policyFinancialAssetImpairment"],note:"Determine classification, impairment and entity-specific disclosures."},
  {family:"Inventories",label:"Inventories",codes:["405"],policyKeys:["policyInventories"],note:"Confirm inventory measurement and write-downs."},
  {family:"Biological assets",label:"Agriculture and biological assets",codes:["330","410"],policyKeys:["policyBiologicalAssets"],note:"Confirm fair-value versus cost measurement."},
  {family:"Cash",label:"Cash and cash equivalents",codes:["420","620"],policyKeys:["policyCash"],note:"Confirm any overdraft qualifies for the cash-flow definition."},
  {family:"Equity",label:"Equity",codes:["805","810","820"],policyKeys:["policyShareCapitalEquity"],note:"Review share capital, reserves and entity type."},
  {family:"Provisions",label:"Provisions",codes:["515"],policyKeys:["policyProvisionsContingencies"],note:"Confirm obligation, probability and estimation."},
  {family:"Employee benefits",label:"Employee benefits",codes:["520","525"],policyKeys:["policyEmployeeBenefits"],note:"Confirm defined contribution/defined benefit arrangements."},
  {family:"Government grants",label:"Government grants",codes:["531"],policyKeys:["policyGovernmentGrants"],note:"Check grant conditions and recognition."},
  {family:"Borrowings",label:"Borrowings and financial liabilities",codes:["547","548","550","551","590","630","688"],policyKeys:["policyFinancialInstruments","policyFinancialLiabilitiesAmortisedCost"],note:"Confirm maturity, effective interest and any exceptions."},
  {family:"Taxation",label:"Income tax",codes:["490","595","695","795"],policyKeys:["policyTaxation"],note:"Check current/deferred tax and losses."},
  {family:"Revenue",label:"Revenue",codes:["700","730"],policyKeys:["policyRevenueGeneral"],note:"Under the 2025 edition assess contract performance obligations and timing."},
  {family:"Investment income",label:"Investment income",codes:["770"],policyKeys:["policyRevenueInterest","policyRevenueDividends"],note:"Select interest and/or dividend policy only when applicable."},
  {family:"Cost of sales",label:"Cost of sales",codes:["720"],policyKeys:["policyInventories"],note:"Review the nature of costs, if material; not every cost-of-sales mapping requires an inventory policy."},
  {family:"Finance costs",label:"Finance costs",codes:["775"],policyKeys:["policyBorrowingCosts"],note:"Review expensing of borrowing costs."},
  {family:"Discontinued activities",label:"Discontinued operations",codes:["799","499","699"],policyKeys:["policyDiscontinuedOperations"],note:"Check applicability under IFRS for SMEs; avoid assuming full IFRS 5."},
];
// TB rows are authoritative only for the presence of mapping codes and material amounts.
export function reviewPolicyApplicability(lines: readonly any[], library: readonly {optionKey:string}[], options: Record<string,unknown>) {
  const validKeys=new Set(library.map(x=>x.optionKey));
  const materialCodes=new Set<string>();
  for(const line of lines||[]){
    const code=String(line?.mapping_code??"").trim();
    const current=Number(line?.current_year_balance??line?.current_balance??line?.final_balance??0);
    const prior=Number(line?.prior_year_balance??line?.prior_balance??0);
    if(/^\d{3}(?:\.\d+)*$/.test(code)&&((Number.isFinite(current)&&Math.abs(current)>0.5)||(Number.isFinite(prior)&&Math.abs(prior)>0.5))) materialCodes.add(code);
  }
  const matches=(code:string,prefix:string)=>code===prefix||code.startsWith(prefix+".");
  const applicable=POLICY_APPLICABILITY_RULES.filter(rule=>[...materialCodes].some(code=>rule.codes.some(p=>matches(code,p))));
  const gaps=applicable.flatMap(rule=>rule.policyKeys.filter(k=>!validKeys.has(k)).map(key=>({family:rule.family,key})));
  const recommendations=[...new Set(applicable.flatMap(rule=>rule.policyKeys.filter(k=>validKeys.has(k)&&!Boolean(options[k]))))];
  const examined=new Set(applicable.flatMap(r=>r.codes));
  const uncovered=[...materialCodes].filter(code=>![...examined].some(p=>matches(code,p)));
  return {applicable,recommendations,gaps,uncovered};
}
