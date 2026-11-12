export type LeadBalanceLine = {
  final_afs_balance?: number | null; final_balance?: number | null; current_balance?: number | null;
  source_balance?: number | null; current_year_balance?: number | null;
  manual_adjustment?: number | null; adjustments?: number | null; journal_adjustment?: number | null;
  reclassifications?: number | null; reclassification?: number | null; debit?: number | null; credit?: number | null;
};
/** Use the stored adjusted closing once; an imported source is not the final balance. */
export function leadLedgerBalance(line:LeadBalanceLine):number {
  for(const value of [line.final_afs_balance,line.final_balance,line.current_balance]) if(value!==null && value!==undefined) return Number(value);
  if(line.source_balance!==null && line.source_balance!==undefined)
    return Number(line.source_balance)+Number(line.manual_adjustment||0)+Number(line.adjustments??line.journal_adjustment??0)+Number(line.reclassifications??line.reclassification??0);
  return Number(line.current_year_balance ?? (Number(line.debit||0)-Number(line.credit||0)));
}
