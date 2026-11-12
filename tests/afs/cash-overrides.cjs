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

// Capture comparative repayments through the actual workbench field, then verify
// the printed row and financing totals after moving a saved other-financing entry.
const Settings=load(p+'components/AfsStatementOverrideSettings.tsx').default;
function inputs(node){
 if(!node||typeof node!=='object')return [];
 if(Array.isArray(node))return node.flatMap(inputs);
 if(typeof node.type==='function')return inputs(node.type(node.props));
 return [...(node.type==='input'?[node]:[]),...inputs(node.props?.children)];
}
for(const entityType of ['Close Corporation','Trust','Company']){
 const saved={cashLoansRepaidCurrent:-64977.63,cashOtherFinancingPrior:-80204};
 const before=cash.buildCashFlowPresentation(engine.buildAfsPrintStatementEngine([],saved),[],{},saved,[],'2026-02-28');
 const fields=inputs(Settings({mode:'cashFlow',entityType,overrides:saved,onChange:(key,value)=>saved[key]=value}));
 const prior=fields.find(input=>input.props['aria-label']==='Repayment of borrowings prior year');
 assert.ok(prior,`${entityType}: comparative repayment is editable`);
 assert.equal(fields.find(input=>input.props['aria-label']==='Repayment of borrowings current year').props.value,'-64977.63');
 prior.props.onChange({target:{value:'-80204'}});
 fields.find(input=>input.props['aria-label']==='Other financing cash flows prior year').props.onChange({target:{value:''}});
 for(const method of ['direct','indirect']){
  saved.cashFlowMethod=method;
  const after=cash.buildCashFlowPresentation(engine.buildAfsPrintStatementEngine([],saved),[],{},saved,[],'2026-02-28');
  const row=after.cashFlowRows.find(row=>row.id==='cfs-loans-repaid');
  assert.equal(row.current,-64977.63);assert.equal(row.prior,-80204);
  assert.equal(after.cashFlowSources.prior.financing,before.cashFlowSources.prior.financing);
  assert.equal(after.cashFlowSources.current.financing,before.cashFlowSources.current.financing);
  assert.equal(after.cashFlowRows.find(row=>row.id==='cfs-other-financing').prior,0);
 }
 prior.props.onChange({target:{value:'0'}});assert.equal(saved.cashLoansRepaidPrior,0);
 prior.props.onChange({target:{value:''}});assert.equal(saved.cashLoansRepaidPrior,null);
}
console.log('PASS workbench repayments align both years without changing financing totals for CC, trust and company.');
