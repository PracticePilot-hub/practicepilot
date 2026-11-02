/** Only period-confirmed cash amounts replace TB-derived starting calculations. */
export function directCashAmount(overrides:Record<string,any>,key:string,yearEnd:string,fallback:number):number {
  const period=Number(String(yearEnd).slice(0,10).replace(/-/g,""));
  if(!period||Number(overrides.cashDirectOverridesPeriod)!==period)return fallback;
  const raw=overrides[key];
  if(raw===null||raw===undefined||String(raw).trim()==="")return fallback;
  const value=Number(raw);return Number.isFinite(value)?value:fallback;
}
