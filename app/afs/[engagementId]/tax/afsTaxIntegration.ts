import {reportingTaxRate} from './taxEntityRates';
import { calculateTax, profitFromTb, taxReconciliation, taxWorkbookIssues, TaxResult, value } from './taxWorkpaper';
import { TAX_RECONCILING_ITEMS } from '../print-studio/afsTaxReconciliation';
import { disclosureContext } from '../print-studio/afsNoteDisclosureRequirements';
import { standardsContext } from '../print-studio/afsStandardsCoverage';
const money = (n: number) => 'R' + n.toLocaleString('en-ZA');
export function taxNotesState(base: any, saved: any, prior: any, lines: any[], setup: any) {
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
    } const selectedRate = side === 'prior' ? reportingTaxRate(setup,'prior') : rate; const recon = taxReconciliation(r, profitFromTb(source), selectedRate > 1 ? selectedRate / 100 : selectedRate); for (const [key, value] of Object.entries(recon)) {
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
    const details = (r: TaxResult) => r.entities.map(entity => entity.name + ': taxable income ' + money(entity.taxable) + ', current tax ' + money(entity.current) + ', prior adjustment ' + money(entity.prior) + ', other current tax ' + money(entity.other) + ', deferred tax in profit ' + money(entity.deferredProfit) + ', OCI ' + money(entity.deferredOci) + ', direct equity ' + money(entity.deferredEquity) + '.').join(' ');
    set('notesTaxation', 'components', saved.worksheet.yearEnd + ': ' + details(result) + (previous ? ' Comparative: ' + details(previous) : ' Comparative tax components remain as recorded in the comparative ledger; no reviewed comparative workpaper is linked.'));
    set('notesTaxation', 'reconciliation', 'The rate reconciliation is derived from the reviewed entity workpapers: permanent adjustments, assessed-loss availability/utilisation, temporary differences and deferred-tax recognition, entity/SBC rate differences, eligible credits, prior adjustments and other current income tax. Whole-Rand rounding is separately identified. No unexplained amount is classified as deferred tax.');
    set('notesTaxation', 'uncertainty', saved.worksheet.notes);
    const sources = result.entities.map(entity => entity.name + ': ' + entity.deferred.map(row => row.description + ' — carrying ' + money(value(row.carrying)) + ', tax base ' + money(value(row.taxBase)) + ', rate ' + row.rate + '%, opening tax ' + money(value(row.openingTax)) + ', closing ' + money(row.closing) + ', movement ' + money(row.movement) + ' in ' + row.allocation + '. ' + row.evidence).join(' ') + ' Loss DTA opening ' + money(entity.lossOpening) + ', recognised closing ' + money(entity.lossClosing) + ', potential ' + money(entity.lossPotential) + '.');
    set('notesDeferredTaxLiability', 'temporary', sources.join('\n\n') + '\n\nCurrent deferred tax assets ' + money(result.dta) + ' and liabilities ' + money(result.dtl) + ' are presented separately; amounts are not offset between taxable entities.');
    set('notesDeferredTaxLiability', 'recovery', saved.worksheet.entities.map((entity: any) => entity.name + ': ' + entity.lossDtaEvidence + ' ' + entity.deferred.filter((row: any) => row.recognise).map((row: any) => row.evidence).join(' ')).join('\n\n') + ' Deferred tax uses the enacted rates expected on recovery or settlement; recognition is supported in the retained workpaper.');
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
    }
    return result;
}
