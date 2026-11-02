import {reportingTaxRate,isTrustTaxEntity} from '../tax/taxEntityRates';
/** Tax reconciling amounts must be supported, never generated as a residual plug. */
export const TAX_RECONCILING_ITEMS=[
 {key:"nonDeductibleExpenses",label:"Tax effect of non-deductible expenses"},
 {key:"exemptIncome",label:"Tax effect of exempt income"},
 {key:"assessedLossesNotRecognised",label:"Tax effect of assessed losses not recognised"},
 {key:"assessedLossesUtilised",label:"Tax effect of assessed losses utilised"},
 {key:"deferredTaxAssetRecognised",label:"Deferred tax asset recognised"},
 {key:"priorYearAdjustments",label:"Prior-year adjustments"},
 {key:"differentTaxRates",label:"Effect of different tax rates"},
 {key:"taxRateChanges",label:"Effect of changes in tax rates"},
 {key:"taxCredits",label:"Tax credits and incentives"},
 {key:"otherPermanentDifferences",label:"Other permanent differences"},
 {key:"temporaryDifferencesAndDeferredTax",label:"Temporary differences, deferred tax and loss recognition"},
 {key:"taxRounding",label:"Whole-Rand rounding"},
 {key:"otherTaxCharges",label:"Other income tax charges"},
];
export function taxReconciliationReview(noteData:Record<string,any[]>,state:Record<string,any>,setup:Record<string,any>|null){
 const taxRows=(noteData.taxation||[]).filter(row=>!/^total/i.test(String(row.label||"")));
 const profit=(noteData.cashUsedInOperations||[]).find(row=>/profit/i.test(String(row.label||""))&&/tax/i.test(String(row.label||"")));
 const rateKeys=["tax_rate","income_tax_rate","company_tax_rate","taxRate","incomeTaxRate","companyTaxRate"];
 const supplied=rateKeys.map(key=>setup?.[key]).find(value=>value!=null&&String(value).trim()!=="");
 const recon=state.taxationReconciliation||{};
 const invalidInputs=TAX_RECONCILING_ITEMS.some(item=>["current","prior"].some(side=>recon[item.key]?.[side]!=null&&String(recon[item.key][side]).trim()!==""&&!Number.isFinite(Number(recon[item.key][side]))));
 return (["current","prior"] as const).map(side=>{
  const periodRate=setup?.[side==="current"?"tax_rate_current_year":"tax_rate_prior_year"];
  const suppliedRate=periodRate!=null && String(periodRate).trim()!==""?periodRate:supplied;
  const rate=reportingTaxRate(setup,side),invalid=invalidInputs || !Number.isFinite(rate)||rate<0||rate>100;
  const actual=taxRows.reduce((sum,row)=>sum+Number(row[side]||0),0),theoretical=profit?Math.round(-Number(profit[side]||0)*rate/100):null;
  const explained=TAX_RECONCILING_ITEMS.reduce((sum,item)=>sum+Number(recon[item.key]?.[side]||0),0);
  return {side,rate,rateAssumed:!isTrustTaxEntity(setup)&&suppliedRate==null,actual,theoretical,explained,difference:theoretical===null?null:Math.round((actual-theoretical-explained)*100)/100,invalid};
 });
}
