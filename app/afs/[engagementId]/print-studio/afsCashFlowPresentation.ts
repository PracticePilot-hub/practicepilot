import type { AfsStatementOverrides, AfsPrintStatementEngineResult } from "../components/AfsPrintStatementEngine";
type Side="current"|"prior";
/** A saved replacement must also remove obsolete fields from an older browser cache. */
export function resolveSavedStatementOverrides(saved:Record<string,any>|null|undefined,local:Record<string,any>={}){
 return saved && Object.keys(saved).length>0 ? {...saved} : {...local};
}
const sides:Side[]=["current","prior"];
const present=(v:any)=>v!==null&&v!==undefined&&String(v).trim()!=="";
const numeric=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const matches=(code:string,prefix:string)=>code===prefix||code.startsWith(prefix+".");
const value=(line:any,side:Side)=>numeric(side==="current"?line.current_year_balance??line.final_balance??line.current_balance??(numeric(line.debit)-numeric(line.credit)):line.prior_year_balance);
const sum=(lines:readonly any[],prefixes:string[],side:Side,exclude:string[]=[])=>lines.filter(line=>prefixes.some(p=>matches(String(line.mapping_code||""),p))&&!exclude.some(p=>matches(String(line.mapping_code||""),p))).reduce((total,line)=>total+value(line,side),0);
const cash=(lines:readonly any[],side:Side)=>sum(lines,["420","620"],side);
function historicalLines(history:readonly any[],yearEnd:string){
 const year=Number(yearEnd.slice(0,4));
 const years=[...new Set(history.map(row=>String(row.financial_year_end||"")).filter(date=>Number(date.slice(0,4))<=year-2))].sort();
 const date=years.at(-1);return date?history.filter(row=>String(row.financial_year_end)===date).map(row=>({...row,current_year_balance:row.closing_balance,prior_year_balance:row.closing_balance})):null;
}
export function prepareCashFlowWorkState(base:any,lines:readonly any[],state:Record<string,any>,history:readonly any[],yearEnd:string,overrides:Record<string,any>={}){
 const priorOpening=historicalLines(history,yearEnd),input=state.cashGeneratedFromOperations?.values||{},values=structuredClone(input);
 const before=(side:Side,prefixes:string[],exclude:string[]=[])=>side==="current"?sum(lines,prefixes,"prior",exclude):priorOpening?sum(priorOpening,prefixes,"current",exclude):0;
 const wcAssets=["415","430","432","490","390.10","390.20"],wcAssetExclusions=["430.20","430.60"];
 const wcLiabilities=["515","520","531","630","640","650","660","670","690"];
 for(const side of sides){
  const end=side==="current"?"Current":"Prior";
  const defaults:Record<string,number>={
   depreciationAmortisationImpairment:sum(lines,["750.14","750.141","750.12","780.40"],side),
   lossOnSaleAssetsLiabilities:sum(lines,["780.10"],side),
   fairValueGainsLosses:sum(lines,["780.20","770.30"],side),
   movementProvisions:0,otherNonCash1:0,adjustments:0,discontinuedResult:-sum(lines,["799"],side)+numeric(overrides["cashDiscontinuedTax"+end]),
   investmentIncome:sum(lines,["770.10"],side),
   // Discount unwinding is already offset by the operating-provision movement.
   financeCosts:sum(lines,["775"],side,["775.50"]),
   inventories:before(side,["405"])-sum(lines,["405"],side),
   tradeReceivables:before(side,wcAssets,wcAssetExclusions)-sum(lines,wcAssets,side,wcAssetExclusions),
   tradePayables:before(side,wcLiabilities)-sum(lines,wcLiabilities,side),
   otherOperatingPresentedSeparately:-["cashOtherOperating","cashOtherOperating2","cashOtherOperating3"].reduce((n,key)=>n+numeric(overrides[key+end]),0),
  };
  for(const [key,amount]of Object.entries(defaults)){values[key]={...(values[key]||{})};if(!present(values[key][side]))values[key][side]=amount;}
 }
 return {...state,cashGeneratedFromOperations:{...(state.cashGeneratedFromOperations||{}),values}};
}
/** A single calculation supplies both the statement and its operating reconciliation note. */
export function buildCashFlowPresentation(base:AfsPrintStatementEngineResult,lines:readonly any[],state:Record<string,any>,overrides:AfsStatementOverrides&Record<string,any>,history:readonly any[],yearEnd:string):Omit<AfsPrintStatementEngineResult,"checks"> & {checks:AfsPrintStatementEngineResult["checks"]&Record<string,any>;cashFlowSources:any} {
 const resolved=prepareCashFlowWorkState(base,lines,state,history,yearEnd,overrides),work=resolved.cashGeneratedFromOperations.values;
 const historic=historicalLines(history,yearEnd),openingPrior=present(overrides.cashPriorOpeningBalance)?numeric(overrides.cashPriorOpeningBalance):historic?cash(historic,"current"):null;
 const method=overrides.cashFlowMethod||"indirect";
 const period=Number(yearEnd.slice(0,10).replace(/-/g,""));
 const pbt=(side:Side)=>numeric(base.sociRows.find((row:any)=>row.id==="profit-before-tax"||/before taxation/i.test(row.label||""))?.[side]);
 const stored=(key:string,side:Side)=>numeric(work[key]?.[side]);
 const adjustmentKeys=["adjustments","depreciationAmortisationImpairment","lossOnSaleAssetsLiabilities","fairValueGainsLosses","movementProvisions","otherNonCash1","investmentIncome","financeCosts","discontinuedResult","otherOperatingPresentedSeparately"];
 const override=(name:string,side:Side,fallback=0)=>present(overrides[name+(side==="current"?"Current":"Prior")])?numeric(overrides[name+(side==="current"?"Current":"Prior")]):fallback;
 const result:any={};
 for(const side of sides){
  const adjustments=override("cashAdjustmentsToProfit",side,adjustmentKeys.reduce((n,key)=>n+stored(key,side),0));
  const wc=override("cashWorkingCapital",side,stored("inventories",side)+stored("tradeReceivables",side)+stored("tradePayables",side));
  const generated=pbt(side)+adjustments+wc;
  const explicitDirect=(name:string,fallback:number)=>overrides.cashDirectOverridesPeriod===period?override(name,side,fallback):fallback;
  const revenue=-sum(lines,["700"],side);
  const directReceipts=explicitDirect("cashReceiptsCustomers",revenue+stored("tradeReceivables",side));
  const directPayments=explicitDirect("cashPaymentsSuppliersEmployees",-sum(lines,["720","750"],side)+stored("depreciationAmortisationImpairment",side)+stored("inventories",side)+stored("tradePayables",side));
  const directOther=explicitDirect("cashOtherDirectOperating",0);
  const interest=override("cashInterestReceived",side,0),finance=override("cashFinanceCostsPaid",side,0),tax=override("cashTaxPaid",side,0);
  const otherOp=override("cashOtherOperating",side),otherOp2=override("cashOtherOperating2",side),otherOp3=override("cashOtherOperating3",side);
  const operating=(method==="direct"?directReceipts+directPayments+directOther:generated)+interest+finance+tax+otherOp+otherOp2+otherOp3;
  const purchase=override("cashPurchaseOfPpe",side),disposal=override("cashProceedsOnDisposalPpe",side),invest=override("cashOtherInvesting",side),invest2=override("cashOtherInvesting2",side),invest3=override("cashOtherInvesting3",side);
  const investing=purchase+disposal+invest+invest2+invest3;
  const loans=override("cashLoansRaised",side),repay=override("cashLoansRepaid",side),dividends=override("cashDividendsPaid",side),fin=override("cashOtherFinancing",side),fin2=override("cashOtherFinancing2",side),fin3=override("cashOtherFinancing3",side);
  const financing=loans+repay+dividends+fin+fin2+fin3,net=operating+investing+financing,opening=side==="current"?cash(lines,"prior"):openingPrior;
  result[side]={adjustments,wc,generated,directReceipts,directPayments,directOther,interest,finance,tax,otherOp,otherOp2,otherOp3,operating,purchase,disposal,invest,invest2,invest3,investing,loans,repay,dividends,fin,fin2,fin3,financing,net,opening,closing:opening===null?null:opening+net,target:cash(lines,side)};
 }
 const rows:any[]=[];const row=(id:string,label:string,key:string,type="line")=>rows.push({id,label:state.cashFlowPresentationLabels?.[id]||label,current:result.current[key]??0,prior:result.prior[key]??0,type});
 row("cfs-operating-heading","Cash flows from operating activities","zero","section");
 if(method==="direct"){
  row("cfs-direct-receipts-customers","Cash receipts from customers","directReceipts");row("cfs-direct-payments-suppliers-employees","Cash paid to suppliers and employees","directPayments");row("cfs-direct-other-operating","Other direct operating cash flows","directOther");
 }else{row("cfs-profit-before-tax","Profit / (loss) before taxation","pbt");rows.at(-1).current=pbt("current");rows.at(-1).prior=pbt("prior");row("cfs-adjustments","Adjustments to profit","adjustments");row("cfs-working-capital","Changes in operating assets and liabilities","wc");row("cfs-cash-generated","Cash generated from / (used in) operations","generated","subtotal");}
 row("cfs-interest-received","Interest received","interest");row("cfs-finance-costs-paid","Finance costs paid","finance");row("cfs-tax-paid","Taxation paid","tax");row("cfs-other-operating","Other operating cash flows","otherOp");row("cfs-other-operating-2","Other operating cash flows 2","otherOp2");row("cfs-other-operating-3","Other operating cash flows 3","otherOp3");row("cfs-net-operating","Net cash from / (used in) operating activities","operating","subtotal");
 row("cfs-investing-heading","Cash flows from investing activities","zero","section");row("cfs-purchase-ppe","Purchases of property, plant and equipment","purchase");row("cfs-disposal-ppe","Proceeds on disposal of property, plant and equipment","disposal");row("cfs-other-investing","Other investing cash flows","invest");row("cfs-other-investing-2","Other investing cash flows 2","invest2");row("cfs-other-investing-3","Other investing cash flows 3","invest3");row("cfs-net-investing","Net cash from / (used in) investing activities","investing","subtotal");
 row("cfs-financing-heading","Cash flows from financing activities","zero","section");row("cfs-loans-raised","Proceeds from borrowings","loans");row("cfs-loans-repaid","Repayment of borrowings","repay");row("cfs-dividends-paid","Dividends paid","dividends");row("cfs-other-financing","Other financing cash flows","fin");row("cfs-other-financing-2","Other financing cash flows 2","fin2");row("cfs-other-financing-3","Other financing cash flows 3","fin3");row("cfs-net-financing","Net cash from / (used in) financing activities","financing","subtotal");row("cfs-net-movement","Net increase / (decrease) in cash and cash equivalents","net","total");row("cfs-opening-cash","Cash and cash equivalents at beginning of year","opening");row("cfs-closing-cash","Cash and cash equivalents at end of year","closing","total");
 const note:any[]=[{id:"canonical-pbt",label:"Profit / (loss) before taxation",current:pbt("current"),prior:pbt("prior"),meta:{canonicalCash:true}}];
 const labels:Record<string,string>={adjustments:"Other adjustments",depreciationAmortisationImpairment:"Depreciation, amortisation and impairment",lossOnSaleAssetsLiabilities:"Loss / (gain) on disposal of assets",fairValueGainsLosses:"Fair value losses / (gains)",movementProvisions:"Other non-cash provision movements",otherNonCash1:"Other non-cash items",investmentIncome:"Interest income presented separately",financeCosts:"Finance costs presented separately",discontinuedResult:"Profit before tax from discontinued operations",otherOperatingPresentedSeparately:"Other operating cash amounts presented separately",inventories:"(Increase) / decrease in inventories",tradeReceivables:"(Increase) / decrease in other operating assets",tradePayables:"Increase / (decrease) in operating liabilities"};
 for(const key of [...adjustmentKeys,"inventories","tradeReceivables","tradePayables"]){const current=stored(key,"current"),prior=stored(key,"prior");if(current||prior)note.push({id:`canonical-${key}`,label:labels[key],current,prior,meta:{canonicalCash:true}});}
 if(present(overrides.cashAdjustmentsToProfitCurrent)||present(overrides.cashAdjustmentsToProfitPrior)){const current=result.current.adjustments-adjustmentKeys.reduce((n,key)=>n+stored(key,"current"),0),prior=result.prior.adjustments-adjustmentKeys.reduce((n,key)=>n+stored(key,"prior"),0);if(current||prior)note.push({id:"canonical-documented-adjustments",label:"Additional documented adjustments",current,prior,meta:{canonicalCash:true}});}
 if(present(overrides.cashWorkingCapitalCurrent)||present(overrides.cashWorkingCapitalPrior)){const current=result.current.wc-["inventories","tradeReceivables","tradePayables"].reduce((n,key)=>n+stored(key,"current"),0),prior=result.prior.wc-["inventories","tradeReceivables","tradePayables"].reduce((n,key)=>n+stored(key,"prior"),0);if(current||prior)note.push({id:"canonical-documented-wc",label:"Additional documented operating asset / liability movements",current,prior,meta:{canonicalCash:true}});}
 note.push({id:"canonical-cash-generated",label:"Cash generated from / (used in) operations",current:result.current.generated,prior:result.prior.generated,meta:{canonicalCash:true,total:true}});
 const c=result.current,p=result.prior;
 return {...base,cashFlowRows:rows,noteData:{...base.noteData,cashUsedInOperations:note},cashFlowSources:result,checks:{...base.checks,cashClosingFromSfp:c.target,cashOpeningFromSfp:c.opening,cashMovementFromSfp:c.target-c.opening,cashMovementFromCashFlow:c.net,cashClosingFromCashFlow:c.closing,cashFlowMovementDifference:c.net-(c.target-c.opening),cashFlowClosingDifference:c.closing-c.target,cashOpeningPrior:p.opening??0,cashMovementPriorFromCashFlow:p.net,cashClosingPriorFromCashFlow:p.closing??0,cashClosingPriorFromSfp:p.target,cashFlowPriorClosingDifference:p.closing===null?NaN:p.closing-p.target,cashPriorOpeningMissing:p.opening===null,cashDirectIndirectDifferenceCurrent:method==="direct"?c.directReceipts+c.directPayments+c.directOther-c.generated:0,cashDirectIndirectDifferencePrior:method==="direct"?p.directReceipts+p.directPayments+p.directOther-p.generated:0}};
}
