import {specialTrustTax} from './taxEntityRates';
/** Shared company-tax workpaper. Amounts are debit-positive; credits/receivables are negative. */
export type Value = number | string;
export type TaxAdjustment = {
    id: string;
    description: string;
    kind: 'permanent' | 'temporary';
    amount: Value;
};
export type DeferredItem = {
    id: string;
    description: string;
    kind: 'asset' | 'liability';
    carrying: Value;
    taxBase: Value;
    rate: Value;
    openingTax: Value;
    recognise: boolean;
    evidence: string;
    allocation: 'profit' | 'oci' | 'equity';
    allocationAccount?: string;
};
export type TaxPayment={kind:'p1'|'p2'|'topup'|'other';amount:Value;date:string};
export type TaxEntity = {
    id: string;
    name: string;
    jurisdiction: string;
    regime: 'normal' | 'sbc' | 'custom' | 'trust' | 'special-trust' | 'owner-tax';
    rate: Value;
    rateEvidence: string;
    sbcConfirmed: boolean;
    profitMode: 'mapped' | 'manual';
    profit: Value;
    profitEvidence: string;
    adjustments: TaxAdjustment[];
    lossBf: Value;
    tradeConfirmed: boolean;
    liquidationExemption: boolean;
    liquidationEvidence: string;
    priorTax: Value;
    otherTax: Value;
    foreignCredit: Value;
    creditEvidence: string;
    openingControl: Value;
    payments: Value;
    paymentSchedule?: TaxPayment[];
    refunds: Value;
    controlOther: Value;
    paymentsConfirmed: boolean;
    deferred: DeferredItem[];
    lossDtaOpening: Value;
    lossDtaClosing: Value;
    lossDtaRate: Value;
    lossDtaEvidence: string;
    deferredOffsetConfirmed?: boolean;
    deferredOffsetEvidence?: string;
    discontinuedProfit?: Value;
    discontinuedTax?: Value;
    discontinuedEvidence?: string;
};
export type TaxWorkbook = {
    version: 2;
    yearEnd: string;
    periodStart?: string;
    entities: TaxEntity[];
    notes: string;
    groupReconciliation: string;
    reviewed: boolean;
    taxBasisReviewRequired?: boolean;
    taxBasisReviewReason?: string;
};
export const TAX_WORKPAPER_TAG = 'PracticePilot tax workpaper v2\n';
export function value(input: Value | undefined, label = 'Amount') { if (input == null || input === '')
    return 0; const raw = String(input).trim().replace(/[R\s,]/g, '').replace(/^\((.*)\)$/, '-$1'); const number = Number(raw); if (!Number.isFinite(number))
    throw Error(label + ' must be a finite number.'); return number; }
export const round = (amount: number) => Math.round(amount) || 0;
export function profitFromTb(lines: any[], side: 'current' | 'prior' = 'current') { return -lines.filter(row => /^(700|720|730|750|770|775|780|781|785)(\.|$)/.test(String(row.mapping_code || ''))).reduce((sum, row) => sum + Math.round(Number(row[side === 'current' ? 'current_year_balance' : 'prior_year_balance'] ?? (side === 'current' ? Number(row.debit || 0) - Number(row.credit || 0) : 0))), 0); }
export function mapped(lines: any[], code: string, side: 'current' | 'prior' = 'current') { return round(lines.filter(row => String(row.mapping_code) === code).reduce((sum, row) => sum + Number(row[side === 'current' ? 'current_year_balance' : 'prior_year_balance'] || 0), 0)); }
export function companyRate(yearEnd: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(yearEnd) || !Number.isFinite(Date.parse(yearEnd)) || new Date(yearEnd).toISOString().slice(0, 10) !== yearEnd)
    throw Error('Select a valid financial year end.'); if (yearEnd < '2012-04-01' || yearEnd > '2027-03-31')
    throw Error('This year needs a documented enacted rate; select a custom rate.'); return yearEnd >= '2023-03-31' ? .27 : .28; }
export function sbcTax(income: number, yearEnd: string) { if (yearEnd < '2023-04-01' || yearEnd > '2027-03-31')
    throw Error('SBC table unavailable for this year.'); const next = yearEnd >= '2026-04-01', threshold = next ? 99000 : 95750; return round(income <= threshold ? 0 : income <= 365000 ? (income - threshold) * .07 : income <= 550000 ? (next ? 18620 : 18848) + (income - 365000) * .21 : (next ? 57470 : 57698) + (income - 550000) * .27); }
export function newEntity(id = 'parent', name = 'Reporting entity'): TaxEntity { return { id, name, jurisdiction: 'ZA', regime: 'normal', rate: 27, rateEvidence: '', sbcConfirmed: false, profitMode: 'mapped', profit: 0, profitEvidence: '', adjustments: [], lossBf: 0, tradeConfirmed: false, liquidationExemption: false, liquidationEvidence: '', priorTax: 0, otherTax: 0, foreignCredit: 0, creditEvidence: '', openingControl: 0, payments: 0, refunds: 0, controlOther: 0, paymentsConfirmed: false, deferred: [], lossDtaOpening: 0, lossDtaClosing: 0, lossDtaRate: 27, lossDtaEvidence: '' }; }
export function decodeTaxNotes(notes: unknown): {
    worksheet?: TaxWorkbook;
    notes: string;
} { const text = String(notes || ''); if (!text.startsWith(TAX_WORKPAPER_TAG))
    return { notes: text }; try {
    const worksheet = JSON.parse(text.slice(TAX_WORKPAPER_TAG.length));
    return worksheet.version === 2 && Array.isArray(worksheet.entities) ? { worksheet, notes: String(worksheet.notes || '') } : { notes: text };
}
catch {
    return { notes: text };
} }
export function encodeTaxNotes(workbook: TaxWorkbook) { return TAX_WORKPAPER_TAG + JSON.stringify(workbook); }
export function paymentPeriodStart(end:string){const previous=priorTaxYearEnd(end);return new Date(Date.parse(previous+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
export function calculatePayments(entity:TaxEntity,end:string,start=paymentPeriodStart(end)){
 const validDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
 if(!validDate(start)||start>end)throw Error('Select a valid reporting period start.');
 if(entity.paymentSchedule===undefined)return {inYear:value(entity.payments),afterYear:0,issues:[] as string[]};
 if(!Array.isArray(entity.paymentSchedule)||entity.paymentSchedule.length>100)throw Error('Invalid tax payment schedule.');
 let inYear=0,afterYear=0;const issues:string[]=[];
 for(const row of entity.paymentSchedule){
  if(!['p1','p2','topup','other'].includes(row.kind))throw Error('Select a valid provisional payment category.');
  const amount=value(row.amount,'Tax payment');if(amount<0)throw Error('Enter tax payments as positive amounts.');if(!amount)continue;
  if(!validDate(row.date)){issues.push('Enter the actual payment date for '+({p1:'P1',p2:'P2',topup:'the top-up',other:'other tax payments'}[row.kind])+'.');continue;}
  if(row.date<start){issues.push('A tax payment dated '+row.date+' is before this reporting period. Check the opening balance or use the correct financial year.');continue;}
  if(row.date>end)afterYear+=amount;else inYear+=amount;
 }
 return {inYear:round(inYear),afterYear:round(afterYear),issues};
}
export function calculateTax(workbook: TaxWorkbook, lines: any[], consolidated = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workbook.yearEnd) || !Number.isFinite(Date.parse(workbook.yearEnd)) || new Date(workbook.yearEnd).toISOString().slice(0, 10) !== workbook.yearEnd)
        throw Error('Select a valid financial year end.');
    if (workbook.version !== 2 || !workbook.entities.length || workbook.entities.length > 20)
        throw Error('Capture between one and twenty tax entities.');
    const issues: string[] = [];
    const ids = new Set<string>();
    const entities = workbook.entities.map(entity => {
        if (ids.has(entity.id))
            throw Error('Tax entity identifiers must be unique.');
        ids.add(entity.id);
        const required = (condition: boolean, text: string) => { if (!condition)
            issues.push(entity.name + ': ' + text); };
        required(!!entity.name.trim(), 'name the taxable entity.');
        if (!['normal', 'sbc', 'custom', 'trust', 'special-trust', 'owner-tax'].includes(entity.regime) || !['mapped', 'manual'].includes(entity.profitMode))
            throw Error('Choose a valid tax regime and profit source.');
        const rate = entity.regime === 'owner-tax' ? 0 : entity.regime === 'trust' || entity.regime === 'special-trust' ? .45 : entity.regime === 'custom' ? value(entity.rate, 'Tax rate') / 100 : companyRate(workbook.yearEnd);
        if (rate < 0 || rate > 1)
            throw Error('Tax rates must be between 0% and 100%.');
        if(entity.regime==='owner-tax') {
            required(entity.jurisdiction==='ZA','Owner-tax treatment is supported here for South African sole proprietors and partnerships.');
            required(!entity.priorTax&&!entity.otherTax&&!entity.foreignCredit&&!entity.lossBf&&!entity.lossDtaOpening&&!entity.lossDtaClosing&&!entity.discontinuedTax&&!entity.deferred.length&&[entity.openingControl,entity.payments,entity.refunds,entity.controlOther].every(amount=>Number(amount||0)===0)&&!(entity.paymentSchedule||[]).some(row=>Number(row.amount||0)!==0),'Personal income tax and related deferred tax belong to the proprietor/partners, not this business AFS. Reclassify any personal-tax entries with support.');
        }
        if (entity.regime === 'custom')
            required(entity.rateEvidence.trim().length >= 12, 'document the enacted rate and jurisdiction.');
        if (entity.jurisdiction !== 'ZA')
            required(entity.regime === 'custom', 'use an evidenced rate for the foreign jurisdiction.');
        if (entity.regime === 'trust' || entity.regime === 'special-trust') {
            required(entity.jurisdiction === 'ZA', 'SA trust rates require South African tax residence.');
            if (entity.regime === 'special-trust') required(entity.rateEvidence.trim().length >= 12, 'document the qualifying special-trust classification; no individual rebates apply.');
        }
        if (entity.regime === 'sbc')
            required(entity.sbcConfirmed, 'confirm SBC eligibility; the rate selection alone does not establish eligibility.');
        if (consolidated || workbook.entities.length > 1)
            required(entity.profitMode === 'manual' && entity.profitEvidence.trim().length >= 12, 'allocate this entity’s own profit and document the source; do not tax consolidated profit as one entity.');
        const profit = entity.profitMode === 'mapped' ? profitFromTb(lines) : value(entity.profit, 'Entity profit');
        let permanent = 0, temporary = 0;
        for (const adjustment of entity.adjustments) {
            const amount = value(adjustment.amount, 'Tax adjustment');
            if (amount && !adjustment.description.trim())
                issues.push(entity.name + ': describe every tax adjustment.');
            if (adjustment.kind === 'permanent')
                permanent += amount;
            else if (adjustment.kind === 'temporary')
                temporary += amount;
            else
                throw Error('Unknown tax adjustment category.');
        }
        const discontinuedProfit = value(entity.discontinuedProfit), discontinuedTax = value(entity.discontinuedTax);
        if (discontinuedProfit || discontinuedTax) required((entity.discontinuedEvidence || '').trim().length >= 12, 'support the discontinued-operation profit and tax allocation.');
        const beforeLoss = round(profit + discontinuedProfit + permanent + temporary), lossBf = value(entity.lossBf, 'Assessed loss');
        if (lossBf < 0)
            throw Error('Brought-forward losses must be positive.');
        if (lossBf > 0 && (entity.jurisdiction !== 'ZA' || entity.regime === 'custom'))
            required(false, 'foreign loss utilisation needs a jurisdiction-specific calculation; capture the supported deduction as an adjustment instead of a brought-forward SA loss.');
        if (lossBf > 0)
            required(entity.tradeConfirmed, 'confirm that the loss is available and the trade requirements are met.');
        if (entity.liquidationExemption)
            required(workbook.yearEnd >= '2024-12-31' && entity.liquidationEvidence.trim().length >= 12, 'document the qualifying liquidation/deregistration exemption.');
        const limit = entity.jurisdiction === 'ZA' && ['normal', 'sbc'].includes(entity.regime) && workbook.yearEnd >= '2023-03-31' && !entity.liquidationExemption ? Math.max(1000000, Math.max(0, beforeLoss) * .8) : Math.max(0, beforeLoss);
        const lossUsed = entity.tradeConfirmed ? Math.min(lossBf, Math.max(0, beforeLoss), limit) : 0;
        const taxable = Math.max(0, round(beforeLoss - lossUsed)), lossCf = round(lossBf - lossUsed + Math.max(0, -beforeLoss));
        const gross = entity.regime === 'special-trust' ? specialTrustTax(taxable, workbook.yearEnd) : entity.regime === 'sbc' ? sbcTax(taxable, workbook.yearEnd) : round(taxable * rate), credit = value(entity.foreignCredit, 'Foreign tax credit');
        if (credit < 0 || credit > gross)
            throw Error('Eligible foreign tax credit must be between zero and the current tax before credit.');
        if (credit)
            required(entity.creditEvidence.trim().length >= 12, 'document the eligible foreign credit and limitation.');
        const paymentResult=calculatePayments(entity,workbook.yearEnd,workbook.periodStart);issues.push(...paymentResult.issues.map(issue=>entity.name+': '+issue));
        const current = round(gross - credit), prior = value(entity.priorTax), other = value(entity.otherTax), opening = value(entity.openingControl), payments = paymentResult.inYear, afterYearPayments=paymentResult.afterYear, refunds = value(entity.refunds), controlOther = value(entity.controlOther);
        if (payments < 0 || refunds < 0)
            throw Error('Enter payments and refunds as positive cash amounts.');
        required(entity.paymentsConfirmed, 'confirm actual tax cash payments and refunds; these are not inferred from tax expense.');
        let dta = 0, dtl = 0, openingNet = 0, deferredProfit = 0, deferredOci = 0, deferredEquity = 0;
        const deferred = entity.deferred.map(item => {
            if (!['asset', 'liability'].includes(item.kind))
                throw Error('Choose asset or liability for the temporary difference.');
            const carrying = value(item.carrying), base = value(item.taxBase), r = value(item.rate) / 100, opening = value(item.openingTax);
            if (carrying < 0 || base < 0 || r < 0 || r > 1)
                throw Error('Deferred tax carrying amounts, tax bases and rates must be non-negative, with rates no higher than 100%.');
            const difference = item.kind === 'asset' ? carrying - base : base - carrying, potential = round(difference * r), closing = potential < 0 && !item.recognise ? 0 : potential;
            if (entity.regime === 'trust' && difference !== 0 && r === .27)
                required(false, 'replace the company 27% deferred-tax rate for ' + item.description + ' with the supported trust reversal rate (ordinary income or capital gains).');
            if (!item.description.trim())
                issues.push(entity.name + ': describe the temporary difference.');
            required(item.evidence.trim().length >= 12, 'support ' + (item.description || 'the temporary difference') + ' with tax-base, reversal-rate and recovery evidence.');
            if (closing < 0)
                dta -= closing;
            else
                dtl += closing;
            openingNet += opening;
            const movement = round(closing - opening);
            if (item.allocation === 'profit')
                deferredProfit += movement;
            else if (item.allocation === 'oci')
                deferredOci += movement;
            else if (item.allocation === 'equity')
                deferredEquity += movement;
            else
                throw Error('Choose profit, OCI or equity for each deferred-tax movement.');
            return { ...item, difference, potential, closing, movement };
        });
        const lossOpening = value(entity.lossDtaOpening), lossClosing = value(entity.lossDtaClosing), lossRate = value(entity.lossDtaRate) / 100;
        if (lossOpening < 0 || lossClosing < 0 || lossRate < 0 || lossRate > 1)
            throw Error('Loss deferred tax amounts and rates are invalid.');
        const lossPotential = round(lossCf * lossRate);
        if (lossClosing > lossPotential + .005)
            throw Error('Recognised loss deferred-tax asset exceeds its supported potential.');
        if (lossClosing || lossOpening)
            required(entity.lossDtaEvidence.trim().length >= 12, 'document recognition and recovery of the loss deferred-tax asset.');
        dta += lossClosing;
        openingNet -= lossOpening;
        deferredProfit += lossOpening - lossClosing;
        const grossDta = dta, grossDtl = dtl;
        if (entity.deferredOffsetConfirmed) {
            required((entity.deferredOffsetEvidence || '').trim().length >= 12, 'document the legally enforceable current-tax offset right and same-authority/entity deferred-tax criteria.');
            const offset = Math.min(dta, dtl); dta -= offset; dtl -= offset;
        }
        const closingControl = round(opening + current + prior + other - payments + refunds + controlOther);
        return { id: entity.id, name: entity.name, discontinuedProfit, discontinuedTax, grossDta, grossDtl, adjustments: entity.adjustments, profit, rate, permanent: round(permanent), temporary: round(temporary), beforeLoss, lossBf, lossUsed, lossCf, taxable, gross, credit, current, prior, other, payments, afterYearPayments, refunds, opening, controlOther, closingControl, dta: round(dta), dtl: round(dtl), openingNet: round(openingNet), deferredProfit: round(deferredProfit), deferredOci: round(deferredOci), deferredEquity: round(deferredEquity), taxExpense: round(current + prior + other + deferredProfit - discontinuedTax), lossPotential, lossOpening, lossClosing, deferred };
    });
    if ((mapped(lines,'395.10')||mapped(lines,'395.10','prior'))&&!entities.some(entity=>entity.lossOpening||entity.lossClosing||entity.deferred.some(item=>item.openingTax&&value(item.openingTax)<0||item.potential<0)))issues.push('Complete the deferred-tax asset recognition or derecognition schedule for the existing mapped balance before posting.');
 if ((mapped(lines,'595.10')||mapped(lines,'595.10','prior'))&&!entities.some(entity=>entity.deferred.some(item=>value(item.openingTax)>0||item.potential>0)))issues.push('Complete the deferred-tax liability reversal schedule for the existing mapped balance before posting.');
 const sum = (key: keyof typeof entities[number]) => round(entities.reduce((n, row) => n + Number(row[key] || 0), 0));
    const profit = sum('profit'), groupDifference = round(profit - profitFromTb(lines));
    if (!consolidated && Math.abs(groupDifference) > .01)
        issues.push('Allocated accounting profit must agree to the standalone AFS profit before tax.');
    if (consolidated && Math.abs(groupDifference) > .01 && workbook.groupReconciliation.trim().length < 12)
        issues.push('Explain the entity-profit to consolidated-profit reconciliation.');
    const result = { entities, issues, profit, groupDifference, permanent: sum('permanent'), temporary: sum('temporary'), lossBf: sum('lossBf'), lossUsed: sum('lossUsed'), lossCf: sum('lossCf'), taxable: sum('taxable'), current: sum('current'), discontinuedProfit: sum('discontinuedProfit'), discontinuedTax: sum('discontinuedTax'), prior: sum('prior'), other: sum('other'), deferredProfit: sum('deferredProfit'), deferredOci: sum('deferredOci'), deferredEquity: sum('deferredEquity'), dta: sum('dta'), dtl: sum('dtl'), taxExpense: sum('taxExpense'), payments: sum('payments'), afterYearPayments:sum('afterYearPayments'), refunds: sum('refunds'), opening: sum('opening'), controlOther: sum('controlOther'), currentReceivable: round(entities.reduce((n, row) => n + Math.max(0, -row.closingControl), 0)), currentPayable: round(entities.reduce((n, row) => n + Math.max(0, row.closingControl), 0)) };
    return result;
}
export type TaxResult = ReturnType<typeof calculateTax>;
export function taxTargets(result: TaxResult) { return { '795.10': result.current - result.discontinuedTax, '795.20': result.deferredProfit, '795.30': result.prior, '795.90': result.other, '395.10': result.dta, '595.10': -result.dtl || 0, '495.10': result.currentReceivable, '695.10': -result.currentPayable || 0, ...(result.discontinuedProfit || result.discontinuedTax ? {'799.10':-result.discontinuedProfit + result.discontinuedTax} : {}) }; }
/** A difference is a journal/review item, never an unexplained deferred-tax amount. */
export function taxDifferences(result: TaxResult, lines: any[]) { return Object.entries(taxTargets(result)).map(([code, target]) => ({ code, target, booked: mapped(lines, code), difference: round(target - mapped(lines, code)) })); }
export function taxJournal(result: TaxResult, lines: any[], accounts: Record<string, string>, allocations: {
    oci?: string;
    equity?: string;
} = {}) {
    const errors = [...result.issues];
    const entries = taxDifferences(result, lines).filter(row => Math.abs(row.difference) > .005).map(row => { const candidates = lines.filter(line => line.mapping_code === row.code); const code = accounts[row.code] || (candidates.length === 1 ? candidates[0].account_code : ''); if (!code || !candidates.some(line => line.account_code === code))
        errors.push('Select the mapped account for ' + row.code + '.'); return { account_code: code || '', debit: Math.max(0, row.difference), credit: Math.max(0, -row.difference), note: 'Tax workpaper ' + row.code }; });
    const allocationsByAccount = new Map<string, {
        target: number;
        kind: string;
    }>();
    for (const entity of result.entities)
        for (const item of entity.deferred) {
            if (item.allocation === 'profit' || (!item.movement && !item.allocationAccount))
                continue;
            const account = lines.find(line => line.account_code === item.allocationAccount);
            const valid = account && (item.allocation === 'oci' ? String(account.mapping_code).startsWith('797.') : String(account.mapping_code).startsWith('820.'));
            if (!valid) {
                errors.push('Select a dedicated ' + item.allocation + ' tax account for ' + item.description + '.');
                continue;
            }
            const prior = allocationsByAccount.get(account.account_code);
            if (prior && prior.kind !== item.allocation)
                throw Error('OCI and equity allocations cannot share an account.');
            allocationsByAccount.set(account.account_code, { target: (prior?.target || 0) + item.movement, kind: item.allocation });
        }
    for (const [code, item] of allocationsByAccount) {
        const account = lines.find(line => line.account_code === code);
        const booked = Number(account.current_year_balance || 0) - (item.kind === 'equity' ? Number(account.prior_year_balance || 0) : 0), delta = round(item.target - booked);
        if (delta)
            entries.push({ account_code: code, debit: Math.max(0, delta), credit: Math.max(0, -delta), note: 'Deferred tax in ' + item.kind });
    }
    const difference = round(entries.reduce((n, row) => n + row.debit - row.credit, 0));
    if (Math.abs(difference) > .005)
        errors.push('Tax-control movement differs from the expense adjustment by ' + difference.toFixed(2) + '. Reconcile opening balances, actual payments/refunds and other movements; no cash balancing entry is generated.');
    return { entries, errors: [...new Set(errors)], difference };
}
export function taxWorkbookIssues(saved: any, lines: any[], consolidated = false) { if (!saved?.worksheet)
    return []; try {
    const result = calculateTax(saved.worksheet, lines, consolidated);
    return [...(saved.worksheet.taxBasisReviewRequired?[saved.worksheet.taxBasisReviewReason||'Validate the illustrative tax basis before final approval.']:[]), ...result.issues, ...taxJournal(result, lines, {}).errors, ...(!saved.sectionReview ? workbookReviewIssues(saved.worksheet) : []), ...taxDifferences(result, lines).filter(row => Math.abs(row.difference) > .5).map(row => 'Tax workpaper differs from ledger mapping ' + row.code + ' by ' + row.difference.toFixed(2)), ...(!saved.worksheet.reviewed && !saved.sectionReview ? ['Tax workpaper review is pending.'] : [])];
}
catch (error) {
    return [String((error as Error).message)];
} }
export function taxReconciliation(result: TaxResult, afsProfit: number, standardRate = .27) {
    const recon: Record<string, number> = { nonDeductibleExpenses: 0, exemptIncome: 0, assessedLossesNotRecognised: 0, assessedLossesUtilised: 0, deferredTaxAssetRecognised: 0, priorYearAdjustments: result.prior, differentTaxRates: 0, taxCredits: 0, otherTaxCharges: result.other, temporaryDifferencesAndDeferredTax: 0, taxRounding: 0 };
    for (const entity of result.entities) {
        for (const adjustment of entity.adjustments.filter(row => row.kind === 'permanent')) {
            const amount = value(adjustment.amount);
            recon[amount >= 0 ? 'nonDeductibleExpenses' : 'exemptIncome'] += amount * entity.rate;
        }
        recon.assessedLossesNotRecognised += Math.max(0, -entity.beforeLoss) * entity.rate;
        recon.assessedLossesUtilised -= entity.lossUsed * entity.rate;
        recon.differentTaxRates += entity.profit * (entity.rate - standardRate) + entity.gross - round(entity.taxable * entity.rate);
        recon.taxCredits -= entity.credit;
        recon.temporaryDifferencesAndDeferredTax += entity.temporary * entity.rate + entity.deferredProfit;
    }
    recon.differentTaxRates += (result.profit - afsProfit) * standardRate;
    const exactTheoretical = afsProfit * standardRate;
    const rounding = result.taxExpense - exactTheoretical - Object.values(recon).reduce((n, v) => n + v, 0);
    if (Math.abs(rounding) > result.entities.length + 0.01)
        throw Error('Tax rate reconciliation has an unsupported difference.');
    // Only the explicitly calculated whole-Rand rounding difference is classified here.
    for (const key of Object.keys(recon))
        recon[key] = round(recon[key]);
    recon.taxRounding = result.taxExpense - round(exactTheoretical) - Object.entries(recon).filter(([key]) => key !== 'taxRounding').reduce((n, [, v]) => n + v, 0);
    return Object.fromEntries(Object.entries(recon).map(([key, amount]) => [key, -amount]));
}
export function priorTaxYearEnd(end: string) { const [y, m, d] = end.split('-').map(Number), year = y - 1, last = new Date(Date.UTC(year, m, 0)).getUTCDate(), originalLast = new Date(Date.UTC(y, m, 0)).getUTCDate(); return `${year}-${String(m).padStart(2, '0')}-${String(d === originalLast ? last : Math.min(d, last)).padStart(2, '0')}`; }
function workbookReviewIssues(workbook: TaxWorkbook) { return workbook.reviewed && workbook.notes.trim().length < 20 ? ['Document the tax basis, significant judgements and uncertainties before marking the workpaper reviewed.'] : []; }

/** Final AFS review covers both displayed financial periods. */
export function taxAfsIssues(saved:any,prior:any,lines:any[],consolidated=false){
 const issues=taxWorkbookIssues(saved,lines,consolidated);
 if(!saved?.worksheet)return issues;
 const comparative=lines.map(line=>({...line,current_year_balance:line.prior_year_balance,prior_year_balance:0}));
 const hasComparative=profitFromTb(comparative)!==0||['795.10','795.20','795.30','795.90','395.10','595.10','495.10','695.10'].some(code=>mapped(comparative,code)!==0);
 if(hasComparative){if(!prior?.worksheet)issues.push('Complete the comparative tax workpaper before finalising these AFS.');else issues.push(...taxWorkbookIssues(prior,comparative,consolidated).map(issue=>'Comparative: '+issue));}
 return issues;
}
