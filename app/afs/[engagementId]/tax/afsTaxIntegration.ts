import type {DisclosureTable} from "../print-studio/disclosureTableData";
import {reportingTaxRate} from './taxEntityRates';
import { calculateTax, profitFromTb, taxReconciliation, taxWorkbookIssues, TaxResult, value } from './taxWorkpaper';
import { TAX_RECONCILING_ITEMS } from '../print-studio/afsTaxReconciliation';
import { disclosureContext } from '../print-studio/afsNoteDisclosureRequirements';
import { standardsContext } from '../print-studio/afsStandardsCoverage';
const money = (n: number) => 'R' + n.toLocaleString('en-ZA');
export function taxNotesState(base: any, saved: any, prior: any, lines: any[], setup: any, afsProfits?: {current:number;prior:number}) {
    if (!saved?.worksheet || taxWorkbookIssues(saved, lines, base.presentationReview?.scope === 'consolidated').length)
        return base;
    const next = structuredClone(base), context = disclosureContext(standardsContext(setup));
    const result = calculateTax(saved.worksheet, lines, base.presentationReview?.scope === 'consolidated');
    const rate = reportingTaxRate(setup,'current');
    const standardRate = rate > 1 ? rate / 100 : rate;
    next.taxationReconciliation ||= {};
    const fill = (r: TaxResult, side: 'current' | 'prior', source: any[]) => { for (const item of TAX_RECONCILING_ITEMS) {
        next.taxationReconciliation[item.key] ||= {};
        next.taxationReconciliation[item.key][side] = 0;
    } const selectedRate = side === 'prior' ? reportingTaxRate(setup,'prior') : rate; const recon = taxReconciliation(r, afsProfits?.[side] ?? profitFromTb(source), selectedRate > 1 ? selectedRate / 100 : selectedRate); for (const [key, value] of Object.entries(recon)) {
        next.taxationReconciliation[key] ||= {};
        next.taxationReconciliation[key][side] = value;
    } };
    fill(result, 'current', lines);
    let previous: TaxResult | null = null;
    const priorLines = lines.map(line => ({ ...line, current_year_balance: line.prior_year_balance, prior_year_balance: 0 }));
    if (prior?.worksheet && !taxWorkbookIssues(prior, priorLines, base.presentationReview?.scope === 'consolidated').length) {
        previous = calculateTax(prior.worksheet, priorLines, base.presentationReview?.scope === 'consolidated');
        fill(previous, 'prior', priorLines);
    }
    const set = (section: string, field: string, text: string) => { next.disclosureContent ||= {}; next.disclosureContent[section] ||= {}; next.disclosureContent[section][field] = { text, context, source: 'Reviewed Tax Calculator workpaper ' + saved.worksheet.yearEnd, requiresReview: false }; };
    const details = (r: TaxResult) => r.entities.map(entity => entity.name + ': taxable income ' + money(entity.taxable) + ', continuing current tax ' + money(entity.current-entity.discontinuedTax) + ', discontinued current tax ' + money(entity.discontinuedTax) + ', prior adjustment ' + money(entity.prior) + ', other current tax ' + money(entity.other) + ', deferred tax in profit ' + money(entity.deferredProfit) + ', OCI ' + money(entity.deferredOci) + ', direct equity ' + money(entity.deferredEquity) + '.').join(' ');
    set('notesTaxation', 'components', saved.worksheet.yearEnd + ': ' + details(result) + (previous ? ' Comparative: ' + details(previous) : ' Comparative tax components remain as recorded in the comparative ledger; no reviewed comparative workpaper is linked.'));
    set('notesTaxation', 'reconciliation', 'The rate reconciliation is derived from the reviewed entity workpapers: permanent adjustments, assessed-loss availability/utilisation, temporary differences and deferred-tax recognition, entity/SBC rate differences, eligible credits, prior adjustments and other current income tax. Whole-Rand rounding is separately identified. No unexplained amount is classified as deferred tax.');
    if (!next.disclosureContent?.notesTaxation?.uncertainty?.text?.trim()) set('notesTaxation', 'uncertainty', saved.worksheet.notes);
    const deferredTables:DisclosureTable[]=[];
    for(const [r,period] of [[result,saved.worksheet.yearEnd],[previous,prior?.worksheet?.yearEnd]] as const){
      if(!r)continue;
      for(const entity of r.entities){
        const rows=entity.deferred.map(row=>({label:row.description,cells:[value(row.openingTax),row.allocation==='profit'?row.movement:0,row.allocation==='oci'?row.movement:0,row.allocation==='equity'?row.movement:0,row.closing]}));
        if(entity.lossOpening||entity.lossClosing)rows.push({label:'Tax losses',cells:[-entity.lossOpening,-entity.lossClosing+entity.lossOpening,0,0,-entity.lossClosing]});
        if(rows.length)deferredTables.push({title:entity.name+' — deferred tax '+period,reference:'Liabilities positive; assets in brackets. Tax-base and recovery evidence is retained in the tax workpaper.',columns:['Opening','Profit or loss','OCI','Direct equity','Closing'],rows});
      }
    }
    set('notesDeferredTaxLiability','temporary','Deferred tax is analysed by type of temporary difference for both periods. Movements are allocated to profit or loss, OCI or direct equity as shown. Current presented deferred tax assets '+money(result.dta)+' and liabilities '+money(result.dtl)+' apply the documented same-taxpayer offset criteria; different taxable entities are not offset.');
    next.disclosureContent.notesDeferredTaxLiability.temporary.tables=deferredTables;
    if (!next.disclosureContent?.notesDeferredTaxLiability?.recovery?.text?.trim()) set('notesDeferredTaxLiability', 'recovery', saved.worksheet.entities.map((entity: any) => entity.name + ': ' + (entity.lossDtaEvidence || 'Recognised deductible differences and their recovery evidence are listed individually above.') + (entity.deferredOffsetConfirmed ? ' ' + entity.deferredOffsetEvidence : '')).join('\n\n') + ' Deferred tax uses the enacted rates expected on recovery or settlement; recognition is supported in the retained workpaper.');
    if (previous) {
        next.deferredTaxReconciliation = { priorOpening: previous.entities.reduce((n, row) => n + row.openingNet, 0), priorMovement: previous.deferredProfit + previous.deferredOci + previous.deferredEquity };
    }
    return next;
}
export function taxCashDefaults(saved: any, prior: any, lines: any[], consolidated = false) {
    const result: Record<string, number> = {};
    for (const [row, side, source] of [[saved, 'Current', lines], [prior, 'Prior', lines.map(line => ({ ...line, current_year_balance: line.prior_year_balance, prior_year_balance: 0 }))]] as const) {
        if (!row?.worksheet || taxWorkbookIssues(row, source, consolidated).length)
            continue;
        const calculated = calculateTax(row.worksheet, source, consolidated);
        result['cashTaxPaid' + side] = -(calculated.payments - calculated.refunds) || 0;
        result['cashDiscontinuedTax' + side] = calculated.discontinuedTax;
    }
    return result;
}
