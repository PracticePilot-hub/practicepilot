import type { AfsStatementRow } from './AfsStatementTable';
const defaults:Record<string,string>={'797.20':'never','797.30':'may','797.50':'never'};
export const ociCaptions:Record<string,string>={'797.10':'Other OCI','797.20':'Revaluation surplus','797.30':'Foreign-operation translation','797.40':'Fair value / hedging movement','797.50':'Defined-benefit remeasurements'};
export function ociDetail(lines:any[],state:any={}){
 return Object.entries(ociCaptions).map(([code,label])=>({id:'oci-'+code,label,current:Math.round(-lines.filter(row=>row.mapping_code===code).reduce((n,row)=>n+Number(row.current_year_balance||0),0)),prior:Math.round(-lines.filter(row=>row.mapping_code===code).reduce((n,row)=>n+Number(row.prior_year_balance||0),0)),code,classification:state.ociClassification?.[code]||defaults[code]||'unreviewed'})).filter(row=>row.current||row.prior);
}
export function comprehensivePresentationIssues(lines:any[],state:any={}){
 const issues:string[]=[];
 for(const row of ociDetail(lines,state))if(!['never','may'].includes(row.classification))issues.push('Classify '+row.label+' as recyclable or non-recyclable in OCI Work.');
 const nci=lines.some(row=>row.mapping_code==='830.10'&&(Number(row.current_year_balance)||Number(row.prior_year_balance)));
 if(nci&&state.presentationReview?.scope==='consolidated')for(const key of ['profitCurrent','profitPrior','ociCurrent','ociPrior'])if(state.comprehensiveIncomeAttribution?.[key]==null||state.comprehensiveIncomeAttribution[key]==='')issues.push('Capture the NCI '+key+' allocation, including an explicit zero, in NCI Work.');
 return issues;
}
export function withComprehensivePresentation(rows:AfsStatementRow[],lines:any[],state:any={},note?:string|number|null):AfsStatementRow[]{
 const detail=ociDetail(lines,state);let result=[...rows];
 if(detail.length){
  const index=result.findIndex(row=>row.id==='total-comprehensive-income');const first=result.findIndex(row=>/other-comprehensive-income|otherComprehensiveIncome/.test(row.id));
  // The aggregate row is immediately before the total in the canonical engine.
  const start=first>=0?first:Math.max(0,index-1);
  const sections:AfsStatementRow[]=[];
  for(const [classification,label] of [['never','Items that will not be reclassified to profit or loss'],['may','Items that may be reclassified to profit or loss'],['unreviewed','OCI classification requiring review']]){
   const selected=detail.filter(row=>row.classification===classification);if(!selected.length)continue;
   sections.push({id:'oci-'+classification,label,type:'subsection'},...selected.map(row=>({...row,note,type:'line' as const})));
  }
  sections.push({id:'oci-total',label:'Other comprehensive income, net of tax',note,current:detail.reduce((n,row)=>n+row.current,0),prior:detail.reduce((n,row)=>n+row.prior,0),type:'subtotal'});
  if(index>=0)result.splice(start,index-start,...sections);
 }
 if(state.presentationReview?.scope==='consolidated'&&lines.some(row=>row.mapping_code==='830.10'&&(Number(row.current_year_balance)||Number(row.prior_year_balance)))){
  const captured=state.comprehensiveIncomeAttribution||{},profit=result.find(row=>row.id==='profit-year'),comprehensive=result.find(row=>row.id==='total-comprehensive-income')||profit;
  const value=(key:string)=>captured[key]==null||captured[key]===''?null:Number(captured[key]);
  const pc=value('profitCurrent'),pp=value('profitPrior'),oc=value('ociCurrent'),op=value('ociPrior');
  result.push({id:'profit-attribution',label:'Profit attributable to',type:'subsection'},{id:'profit-parent',label:'Owners of the parent',current:pc===null?null:Number(profit?.current||0)-pc,prior:pp===null?null:Number(profit?.prior||0)-pp},{id:'profit-nci',label:'Non-controlling interests',current:pc,prior:pp},{id:'comprehensive-attribution',label:'Total comprehensive income attributable to',type:'subsection'},{id:'comprehensive-parent',label:'Owners of the parent',current:pc===null||oc===null?null:Number(comprehensive?.current||0)-pc-oc,prior:pp===null||op===null?null:Number(comprehensive?.prior||0)-pp-op},{id:'comprehensive-nci',label:'Non-controlling interests',current:pc===null||oc===null?null:pc+oc,prior:pp===null||op===null?null:pp+op});
 }
 return result;
}
export function ComprehensiveWork({section,state,update}:{section:string;state:any;update:(path:string[],value:any)=>void}){
 if(section==='notesOtherComprehensiveIncome')return <div data-work-only="true"><strong>OCI presentation and reserve allocation</strong>{Object.entries(ociCaptions).map(([code,label])=><p key={code}>{label} <select value={state.ociClassification?.[code]||defaults[code]||''} onChange={e=>update(['ociClassification',code],e.target.value)}><option value="">Select classification</option><option value="never">Never reclassified to profit or loss</option><option value="may">May subsequently be reclassified</option></select> Reserve <select value={state.ociReserveAllocation?.[code]||''} onChange={e=>update(['ociReserveAllocation',code],e.target.value)}><option value="">Select reserve for unclosed OCI</option>{['820.10','820.20','820.30','820.40','820.50','820.91','820.92'].map(value=><option key={value}>{value}</option>)}</select></p>)}</div>;
 if(section==='notesCashUsedInOperations')return <div data-work-only="true"><strong>Cash-flow extra-line descriptions</strong>{['cfs-other-operating','cfs-other-operating-2','cfs-other-operating-3','cfs-other-investing','cfs-other-investing-2','cfs-other-investing-3','cfs-other-financing','cfs-other-financing-2','cfs-other-financing-3'].map(key=><p key={key}>{key.replace('cfs-','')} <input value={state.cashFlowPresentationLabels?.[key]??''} onChange={e=>update(['cashFlowPresentationLabels',key],e.target.value)}/></p>)}</div>;
 if(section==='notesNonControllingInterests')return <div data-work-only="true"><strong>NCI allocation (capture zero where applicable)</strong>{['profitCurrent','profitPrior','ociCurrent','ociPrior'].map(key=><p key={key}>{key.replace(/([A-Z])/g,' $1')} <input inputMode="decimal" value={state.comprehensiveIncomeAttribution?.[key]??''} onChange={e=>update(['comprehensiveIncomeAttribution',key],e.target.value)}/></p>)}</div>;
 return null;
}
