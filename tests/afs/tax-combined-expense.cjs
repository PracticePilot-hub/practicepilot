const {load}=require('./load.cjs'),assert=require('node:assert/strict'),t=load('app/afs/[engagementId]/tax/taxWorkpaper.ts');
const row=(mapping_code,balance,account_code=mapping_code)=>({mapping_code,account_code,current_year_balance:balance,prior_year_balance:0});
const entity=t.newEntity();
Object.assign(entity,{profitMode:'manual',profit:-33414.99,profitEvidence:'Supported trial balance loss',paymentsConfirmed:true,lossBf:266449,tradeConfirmed:true,lossDtaOpening:72820,lossDtaClosing:80963,lossDtaRate:27,lossDtaEvidence:'Supported management taxable profit forecasts'});
const workbook={version:2,yearEnd:'2026-02-28',entities:[entity],notes:'Combined income tax account regression',groupReconciliation:'',reviewed:false};
const before=[row('700.20',33414.99),row('795.10',0,'income-tax'),row('395.10',72820,'deferred-asset')];
const result=t.calculateTax(workbook,before);
assert.equal(result.deferredProfit,-8143);
const journal=t.taxJournal(result,before,{});
assert.equal(journal.errors.length,0);
assert.equal(journal.entries.length,2);
assert.equal(journal.entries.find(r=>r.account_code==='income-tax').credit,8143);
assert.equal(journal.entries.find(r=>r.account_code==='deferred-asset').debit,8143);
const after=[row('700.20',33414.99),row('795.10',-8143,'income-tax'),row('395.10',80963,'deferred-asset')];
assert(t.taxDifferences(result,after).every(r=>r.difference===0));
assert.equal(t.taxJournal(result,after,{}).entries.length,0);
assert.equal(t.taxJournal(result,after,{}).errors.length,0);
// An existing dedicated deferred account retains separate component checks.
const separate=[...before,row('795.20',0,'deferred-expense')];
assert.equal(t.taxJournal(result,separate,{}).entries.find(r=>r.credit===8143).account_code,'deferred-expense');
assert(t.taxDifferences(result,[...after,row('795.20',0)]).some(r=>r.code==='795.20'&&r.difference===-8143));
assert(t.taxJournal(result,before.filter(r=>r.mapping_code!=='795.10'),{}).errors.some(e=>e.includes('795.20')));
// Multiple candidate accounts still require explicit selection.
assert(t.taxJournal(result,[...before,row('795.10',0,'second-tax')],{}).errors.some(e=>e.includes('795.10')));
assert.equal(t.taxJournal(result,[...before,row('795.10',0,'second-tax')],{'795.10':'income-tax'}).errors.length,0);
// Nonzero current and deferred tax share the account without losing either target.
const mixed={...result,current:27000,deferredProfit:540,discontinuedTax:0};
assert.equal(t.taxDifferences(mixed,before).find(r=>r.code==='795.10').target,27540);
assert.equal(t.taxTargets(mixed)['795.20'],540);
console.log('PASS combined tax expense posting, manual journal idempotence, separate mappings, missing/ambiguous accounts and mixed current/deferred tax.');
