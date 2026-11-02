import { buildAfsPrintStatementEngine, type AfsPrintStatementEngineResult } from "./AfsPrintStatementEngine";

type Amount = number | null;
const keys = ["shareCapital", "retainedIncome", "reserves", "nonControllingInterests", "otherEquity"] as const;
const captions = ["Share capital", "Retained income / (loss)", "Reserves", "Non-controlling interests", "Other equity"];

// The active TB already supplies the comparative closing year. A historical
// opening year plus that comparative is sufficient; a duplicate history import
// is neither necessary nor safe. Restrict years to the reporting period.
export function withComparativeHistory(history: any[], lines: any[], yearEnd: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(yearEnd);
  if (!match) return history;
  const end = (offset: number) => {
    const year = Number(match[1]) - offset, month = Number(match[2]);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const isMonthEnd = Number(match[3]) === new Date(Date.UTC(Number(match[1]), month, 0)).getUTCDate();
    const day = isMonthEnd ? lastDay : Math.min(Number(match[3]), lastDay);
    return `${year}-${match[2]}-${String(day).padStart(2,"0")}`;
  };
  const priorEnd = end(1), openingEnd = end(2);
  const opening = history.filter(row => String(row.financial_year_end).slice(0,10) === openingEnd);
  if (!opening.length) return history.filter(row => String(row.financial_year_end).slice(0,10) <= priorEnd);
  return [...opening, ...lines.map(line => ({...line,
    financial_year_end: priorEnd, closing_balance: Number(line.prior_year_balance || 0),
  }))];
}

export function buildEquityMovementTable(engine: AfsPrintStatementEngineResult, history: any[] = [], transactions: {label:string;side:"current"|"prior";amounts:number[]}[] = [], attribution:Record<string,any> = {}) {
  const total = (key: keyof AfsPrintStatementEngineResult["noteData"], side: "current" | "prior") =>
    (engine.noteData[key] || []).reduce((sum, row) => sum + Number(row[side] || 0), 0);
  const balance = (side: "current" | "prior") => keys.map(key => total(key, side));
  const prior = balance("prior"), current = balance("current");
  const sce = (id: string) => Number(engine.sceRows.find(row => row.id === id)?.current || 0);
  prior[1] = sce("sce-prior-closing-retained");
  current[1] = sce("sce-retained-closing");
  const years = [...new Set(history.map(row => String(row.financial_year_end || "")).filter(Boolean))].sort();
  let opening: Amount[] = keys.map(() => null);
  if (years.length >= 2) {
    // Historical TB balances are signed ledger balances. Close their income
    // through the same engine rather than mistaking ledger equity for AFS equity.
    const historical = buildAfsPrintStatementEngine(history.filter(row => String(row.financial_year_end) === years[years.length - 2]).map(row => ({
      ...row, current_year_balance: Number(row.closing_balance || 0), prior_year_balance: 0,
    })));
    opening = keys.map(key => (historical.noteData[key] || []).reduce((sum, row) => sum + Number(row.current || 0), 0));
  }
  const profitPrior = [0, sce("sce-prior-profit")-Number(attribution.profitPrior||0), 0, Number(attribution.profitPrior||0), 0];
  const profitCurrent = [0, sce("sce-current-profit")-Number(attribution.profitCurrent||0), 0, Number(attribution.profitCurrent||0), 0];
  const oci = (side: "current" | "prior") => [0, 0, total("otherComprehensiveIncome", side)-Number(attribution[side==="current"?"ociCurrent":"ociPrior"]||0), Number(attribution[side==="current"?"ociCurrent":"ociPrior"]||0), 0];
  const ociPrior = oci("prior"), ociCurrent = oci("current");
  const movement = (end: Amount[], start: Amount[], profit: number[], comprehensive: number[]) =>
    end.map((value, i) => value === null || start[i] === null ? null : value - start[i]! - profit[i] - comprehensive[i]);
  const ownerRows=(side:"current"|"prior")=>transactions.filter(row=>row.side===side).map(row=>({label:row.label,amounts:keys.map((_,i)=>Number(row.amounts[i]||0))}));
  const remaining=(side:"current"|"prior",end:Amount[],start:Amount[],profit:number[],comprehensive:number[])=>movement(end,start,profit,comprehensive).map((value,i)=>value===null?null:value-ownerRows(side).reduce((n,row)=>n+row.amounts[i],0));
  return {
    visible: keys.map((_, i) => i < 2 || current[i] !== 0 || prior[i] !== 0 || (opening[i] ?? 0) !== 0),
    rows: [
      { label: "Balance at beginning of prior year", amounts: opening, strong: true },
      { label: "Profit / (loss) for prior year", amounts: profitPrior },
      { label: "Other comprehensive income for prior year", amounts: ociPrior },
      ...ownerRows("prior"),
      { label: "Unclassified equity movements", amounts: remaining("prior",prior,opening,profitPrior,ociPrior), unclassified:true },
      { label: "Balance at end of prior year", amounts: prior, strong: true },
      { label: "Profit / (loss) for current year", amounts: profitCurrent },
      { label: "Other comprehensive income for current year", amounts: ociCurrent },
      ...ownerRows("current"),
      { label: "Unclassified equity movements", amounts: remaining("current",current,prior,profitCurrent,ociCurrent), unclassified:true },
      { label: "Balance at end of current year", amounts: current, strong: true },
    ],
  };
}

export default function AfsCompleteEquityStatement({engine, history, transactions=[], attribution={}}: {engine: AfsPrintStatementEngineResult; history: any[]; transactions?:{label:string;side:"current"|"prior";amounts:number[]}[];attribution?:Record<string,any>}) {
  const {rows, visible} = buildEquityMovementTable(engine, history,transactions,attribution);
  const amount = (value: Amount) => value === null ? "Not provided" : value === 0 ? "–" :
    (value < 0 ? `(${Math.abs(Math.round(value)).toLocaleString("en-ZA")})` : Math.round(value).toLocaleString("en-ZA"));
  return <section style={{color:"#111827",fontSize:10}}>
    <h1 style={{fontSize:18,margin:"0 0 14px"}}>Statement of Changes in Equity</h1>
    <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed",fontSize:9}}>
      <thead><tr><th style={{textAlign:"left",width:"30%",padding:"5px 2px"}}>Figures in Rand</th>
        {captions.map((caption,i) => visible[i] && <th key={caption} style={{textAlign:"right",padding:"5px 2px"}}>{caption}</th>)}
        <th style={{textAlign:"right",padding:"5px 2px"}}>Total equity</th></tr></thead>
      <tbody>{rows.filter(row=>!row.unclassified||row.amounts.some(value=>value===null||Math.abs(value)>0.005)).map((row,index) => <tr key={index} style={{fontWeight:row.strong ? 700 : 400}}>
        <td style={{padding:"5px 2px"}}>{row.label}</td>
        {row.amounts.map((value,i) => visible[i] && <td key={i} style={{textAlign:"right",padding:"5px 2px",borderTop:row.strong ? "1px solid #111827" : undefined}}>{amount(value)}</td>)}
        <td style={{textAlign:"right",padding:"5px 2px",borderTop:row.strong ? "1px solid #111827" : undefined}}>{amount(row.amounts.some(value => value === null) ? null : row.amounts.reduce<number>((sum,value) => sum + (value || 0),0))}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}
