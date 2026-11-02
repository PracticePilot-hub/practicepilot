/** Differences identify incomplete schedules; they do not identify transactions. */
export const MOVEMENT_FAMILIES: Record<string,{stateKey:string;prefixes:string[];credit:boolean;count:number}> = {
  notesInvestmentProperty:{stateKey:"investmentPropertyMovements",prefixes:["310"],credit:false,count:5},
  notesGoodwill:{stateKey:"goodwillMovements",prefixes:["321"],credit:false,count:4},
  notesIntangibleAssets:{stateKey:"intangibleMovements",prefixes:["320"],credit:false,count:5},
  notesBiologicalAssets:{stateKey:"biologicalMovements",prefixes:["330","410"],credit:false,count:5},
  notesProvisions:{stateKey:"provisionMovements",prefixes:["515","660"],credit:true,count:4},
};
const matches=(code:string,prefix:string)=>code===prefix||code.startsWith(prefix+".");
export function historicalMovementOpening(sectionKey:string,lineId:string,history:any[]):number|null {
  const family=MOVEMENT_FAMILIES[sectionKey];if(!family)return null;
  const years=[...new Set(history.map(row=>String(row.financial_year_end||"")).filter(Boolean))].sort();
  if(years.length<2)return null;
  const year=years[years.length-2];
  const suffix=new RegExp(`^${sectionKey}-(\\d{3}(?:\\.\\d+)*)$`).exec(lineId)?.[1];
  const rows=history.filter(row=>String(row.financial_year_end)===year&&
    (suffix?String(row.mapping_code||"")===suffix:family.prefixes.some(p=>matches(String(row.mapping_code||""),p))));
  if(!rows.length)return null;
  return rows.reduce((sum,row)=>sum+Number(row.closing_balance||0)*(family.credit?-1:1),0);
}
export function movementNoteReview(sectionKey:string,rows:any[],state:Record<string,any>,history:any[]) {
  const family=MOVEMENT_FAMILIES[sectionKey];if(!family)return [];
  const saved=state[family.stateKey]||{};
  return rows.flatMap(row=>(["current","prior"] as const).map(side=>{
    const id=String(row.id||row.label),input=saved.opening?.[id]?.[side];
    const captured=input!==undefined&&input!==null&&String(input).trim()!=="";
    const historical=side==="prior"?historicalMovementOpening(sectionKey,id,history):Number(row.prior||0);
    const opening=captured?Number(input):historical;
    const changes=Array.from({length:family.count},(_,i)=>saved.movements?.[id]?.[side]?.[`movement${i}`]);
    const invalid=(captured&&!Number.isFinite(Number(input)))||changes.some(value=>value!=null&&String(value).trim()!==""&&!Number.isFinite(Number(value)));
    const movements=changes.reduce<number>((sum,value)=>sum+Number(value||0),0);
    const difference=opening===null?null:Math.round((Number(row[side]||0)-opening-movements)*100)/100;
    return {sectionKey,id,label:row.label,side,opening,closing:Number(row[side]||0),movements,difference,invalid,
      openingConflict:captured&&historical!==null&&Math.abs(Number(input)-historical)>0.005,
      policyMissing:!String(saved.policyText||"").trim(), modelConfirmed:!!saved.policyReviewed};
  }));
}
export function movementRowsForReview(sectionKey:string,lines:readonly any[],noteData:Record<string,any[]>) {
  const family=MOVEMENT_FAMILIES[sectionKey];if(!family)return [];
  const key:Record<string,string>={notesInvestmentProperty:"investmentProperty",notesGoodwill:"goodwill",notesIntangibleAssets:"intangibleAssets"};
  if(key[sectionKey])return noteData[key[sectionKey]] || [];
  const groups=new Map<string,any>();
  for(const line of lines){const code=String(line.mapping_code||"");if(!family.prefixes.some(p=>matches(code,p)))continue;
    const id=`${sectionKey}-${code}`,factor=family.credit?-1:1;
    const current=factor*Number(line.current_year_balance??(Number(line.debit||0)-Number(line.credit||0))),prior=factor*Number(line.prior_year_balance||0);
    const existing=groups.get(id)||{id,label:line.mapping_label||line.account_name||code,current:0,prior:0};existing.current+=current;existing.prior+=prior;groups.set(id,existing);
  }
  return [...groups.values()].filter(row=>Math.abs(row.current)>0.005||Math.abs(row.prior)>0.005);
}
export function reviewAllMovementNotes(lines:readonly any[],noteData:Record<string,any[]>,state:Record<string,any>,history:any[]) {
  return Object.keys(MOVEMENT_FAMILIES).flatMap(key=>movementNoteReview(key,movementRowsForReview(key,lines,noteData),state,history));
}
