const {load}=require('./load.cjs'),assert=require('node:assert/strict');
const p='app/afs/[engagementId]/',engine=load(p+'components/AfsPrintStatementEngine.ts'),cash=load(p+'print-studio/afsCashFlowPresentation.ts');
const lines=[{mapping_code:'775.10',current_year_balance:1000,prior_year_balance:2000},{mapping_code:'795.10',current_year_balance:2700,prior_year_balance:5400}];
for(const method of ['direct','indirect'])for(const amount of [0,-123]){
 const overrides={cashFlowMethod:method,cashFinanceCostsPaidCurrent:amount,cashFinanceCostsPaidPrior:amount,cashTaxPaidCurrent:amount,cashTaxPaidPrior:amount,cashOtherFinancingPrior:321};
 const result=cash.buildCashFlowPresentation(engine.buildAfsPrintStatementEngine(lines,overrides),lines,{},overrides,[],'2026-02-28');
 for(const side of ['current','prior']){assert.equal(result.cashFlowSources[side].tax,amount);assert.equal(result.cashFlowSources[side].finance,amount);}
 assert.equal(result.cashFlowSources.prior.financing,321);
}
console.log('PASS live cash-flow fixes retained: explicit zero/nonzero tax and finance payments, and prior financing counted once, for both methods.');
