type Row=Record<string,any>;
const present=(v:any)=>v!==null&&v!==undefined&&String(v).trim()!=='';
const n=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const is=(code:string,prefix:string)=>code===prefix||code.startsWith(prefix+'.');
const total=(rows:readonly Row[],prefixes:string[],side:string)=>rows.filter(r=>prefixes.some(p=>is(String(r.mapping_code||''),p))).reduce((v,r)=>v+n(r[side]),0);
/** Draft roll-forward calculations, never a residual plugged to closing cash. Captured values (including zero) win. */
export function automaticCashDraft(lines:readonly Row[],history:readonly Row[],yearEnd:string,captured:Row={}){
 const year=Number(yearEnd.slice(0,4)),date=[...new Set(history.map(r=>String(r.financial_year_end||'')).filter(d=>Number(d.slice(0,4))===year-2))].sort().at(-1);
 const opening:Row[]|null=date?history.filter(r=>r.financial_year_end===date).map(r=>({...r,current_year_balance:r.closing_balance})):null;
 const values:Row={},sources:{key:string;label:string;amount:number;basis:string}[]=[];
 const add=(key:string,label:string,amount:number,basis:string)=>{if(present(captured[key])||Math.abs(amount)<.005)return;values[key]=Math.round(amount*100)/100;sources.push({key,label,amount:values[key],basis});};
 for(const [side,suffix]of [['current_year_balance','Current'],['prior_year_balance','Prior']] as const){
  const before=suffix==='Current'?lines:opening,beforeSide=suffix==='Current'?'prior_year_balance':'current_year_balance';
  const interest=total(lines,['775'],side)-total(lines,['775.50'],side);
  add('cashFinanceCostsPaid'+suffix,'Interest paid · '+suffix.toLowerCase(),-interest,'Finance expense excluding non-cash discount unwinding. Check unpaid, capitalised or non-cash interest and enter any correction.');
  add('cashInterestReceived'+suffix,'Interest received · '+suffix.toLowerCase(),-total(lines,['770.10'],side),'Interest income. Check accrued/non-cash interest and enter any correction.');
  if(!before)continue;
  const control=(rows:readonly Row[],field:string)=>-total(rows,['695','495'],field);
  const currentTax=total(lines,['795.10','795.30','795.90'],side);
  add('cashTaxPaid'+suffix,'Tax paid / (refunded) · '+suffix.toLowerCase(),control(lines,side)-control(before,beforeSide)-currentTax,'Opening current-tax control + current/prior/other current-tax expense − closing control. Check credits, transfers and non-cash movements. Reviewed tax-payment schedules take priority.');
  const debt=['547','548','550','551','610','625'];
  const change=-total(lines,debt,side)+total(before,debt,beforeSide);
  const financed=Math.max(0,n(captured['cashFlowNonCashFinancedPpe'+suffix])),settled=Math.max(0,n(captured['cashFlowNonCashLoanSettlement'+suffix]));
  const cashChange=change-financed+settled;
  add('cashLoansRaised'+suffix,'Loan proceeds · '+suffix.toLowerCase(),Math.max(0,cashChange),'Net principal increase after captured directly financed assets. Check gross advances/repayments, transfers, foreign exchange and other non-cash changes.');
  add('cashLoansRepaid'+suffix,'Loan repayments · '+suffix.toLowerCase(),Math.min(0,cashChange),'Net principal decrease after captured non-cash settlements. Check gross advances/repayments, transfers, foreign exchange and other non-cash changes.');
 }
 const signature=JSON.stringify({yearEnd,sources,lines:lines.map(r=>[r.account_code,r.mapping_code,r.current_year_balance,r.prior_year_balance]),opening:opening?.map(r=>[r.account_code,r.mapping_code,r.current_year_balance])});
 return{values,sources,signature,reviewed:captured.cashFlowDraftReviewSignature===signature};
}
