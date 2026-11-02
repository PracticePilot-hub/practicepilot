import {TaxResult,mapped} from './taxWorkpaper';
export type TaxWorking='start'|'calculation'|'payments'|'deferred'|'review';
export type ComputationRow={label:string;amount?:number;section?:boolean;total?:boolean;working?:TaxWorking};
export function taxComputationRows(result:TaxResult,lines:any[]):ComputationRow[]{
 const mappedExpense=['795.10','795.20','795.30','795.90'].reduce((sum,code)=>sum+mapped(lines,code),0);
 const rows:ComputationRow[]=[
 {label:'Profit / (loss) before taxation',amount:result.profit,working:'start'},
 {label:'Add / (deduct): permanent differences',amount:result.permanent,working:'calculation'},
 {label:'Add / (deduct): temporary differences',amount:result.temporary,working:'calculation'},
 {label:'Taxable income / (assessed loss) before losses',amount:result.profit+result.permanent+result.temporary,total:true},
 {label:'Assessed loss utilised',amount:-result.lossUsed,working:'calculation'},
 {label:'Taxable income',amount:result.taxable,total:true},
 {label:'Current tax calculation',section:true},
 {label:'Current tax per calculation',amount:result.current,total:true,working:'calculation'},
 {label:'Reconciliation of income tax expense / (credit)',section:true},
 {label:'Normal tax expense',amount:result.current},
 {label:'Deferred tax expense recognised',amount:result.deferredProfit,working:'deferred'},
 {label:'Prior-year current tax adjustments',amount:result.prior,working:'review'},
 {label:'Other income tax charges',amount:result.other,working:'review'},
 {label:'Calculated income tax expense / (credit)',amount:result.taxExpense,total:true},
 {label:'Mapped income tax expense / (credit) per SOCI',amount:mappedExpense},
 ...(Math.abs(result.taxExpense-mappedExpense)>.5?[{label:'Difference still to explain (calculation less AFS)',amount:result.taxExpense-mappedExpense,total:true,working:'review' as TaxWorking}]:[]),
 {label:'Reconciliation of current tax balance',section:true},
 {label:'Amount owing / (prepaid) at beginning of year',amount:result.opening,working:'payments'},
 {label:'Normal tax per calculation',amount:result.current},
 {label:'Prior-year adjustments and other current tax',amount:result.prior+result.other},
 {label:'Provisional tax paid / tax credits',amount:-result.payments,working:'payments'},
 ];
 if(result.refunds)rows.push({label:'Tax refunds received during the year',amount:result.refunds,working:'payments'});
 if(result.controlOther)rows.push({label:'Other supported tax-control movements',amount:result.controlOther,working:'payments'});
 rows.push({label:result.currentPayable&&result.currentReceivable?'Net total for reconciliation (balances remain separate)':'Calculated amount owing / (prepaid) at end of year',amount:result.currentPayable-result.currentReceivable,total:true});
 if(result.currentPayable&&result.currentReceivable)rows.push({label:'Tax payable — presented separately in the AFS',amount:result.currentPayable},{label:'Tax receivable — presented separately in the AFS',amount:result.currentReceivable});
 if(result.afterYearPayments)rows.push({label:'Tax payments after reporting date (excluded from year-end balance and cash flow)',amount:result.afterYearPayments,working:'payments'});
 return rows;
}
