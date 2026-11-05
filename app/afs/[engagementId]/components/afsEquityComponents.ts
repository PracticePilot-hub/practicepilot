import type { DisclosureTable } from '../print-studio/disclosureTableData';
/** Reconcile contributed classes and each OCI reserve. Never label a residual as an owner transaction. */
export function equityComponentTables(lines:any[],history:any[],state:any={}):DisclosureTable[]{
 const codes=[...new Set<string>(lines.map(l=>String(l.mapping_code||'')).filter(c=>c.startsWith('805.')||c.startsWith('820.')))];
 const years=[...new Set<string>(history.map(l=>String(l.financial_year_end||'')).filter(Boolean))].sort();
 const openingHistory=years.length>=2?history.filter(l=>String(l.financial_year_end)===years[years.length-2]):[];
 const ledger=(code:string,side:'current'|'prior')=>-lines.filter(l=>l.mapping_code===code).reduce((n,l)=>n+Number(l[side+'_year_balance']||0),0);
 const oci=(code:string,side:'current'|'prior')=>Math.abs(lines.reduce((n,l)=>n+Number(l[side+'_year_balance']||0),0))<.005?-lines.filter(l=>state.ociReserveAllocation?.[l.mapping_code]===code).reduce((n,l)=>n+Number(l[side+'_year_balance']||0),0):0;
 const close=(code:string,side:'current'|'prior')=>ledger(code,side)+oci(code,side);
 return (['prior','current'] as const).flatMap(side=>['805.','820.'].map(prefix=>{
  const rows=codes.filter(c=>c.startsWith(prefix)).map(code=>{
   const start=side==='current'?close(code,'prior'):openingHistory.length?-openingHistory.filter(l=>l.mapping_code===code).reduce((n,l)=>n+Number(l.closing_balance||0),0):null;
   const end=close(code,side),comprehensive=oci(code,side),owners=(state.equityTransactions||[]).filter((r:any)=>r.side===side).reduce((n:number,r:any)=>n+Number(r.mappingAmounts?.[code]||0),0);
   const remaining=start===null?null:Math.round((end-start-comprehensive-owners)*100)/100;
   return {label:String(lines.find(l=>l.mapping_code===code)?.mapping_label||code),cells:[start,comprehensive,owners,remaining,end]};
  }).filter(r=>r.cells.some(v=>v===null||v!==0));
  const hasUnclassified=rows.some(r=>r.cells[3]===null||Math.abs(r.cells[3]||0)>.005);
  return {title:(prefix==='805.'?'Contributed equity':'Reserve components')+' — '+(side==='current'?'current year':'prior year'),columns:['Opening','OCI','Recorded owner movements',...(hasUnclassified?['Unclassified movements']:[]),'Closing'],rows:rows.map(r=>({...r,cells:hasUnclassified?r.cells:r.cells.filter((_,i)=>i!==3)}))};
 })).filter(t=>t.rows.length);
}
