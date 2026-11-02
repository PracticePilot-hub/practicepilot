const {load}=require('./load.cjs'),fs=require('fs'),assert=require('node:assert/strict');
const p='app/afs/[engagementId]/', f=JSON.parse(fs.readFileSync('tests/highveld-comprehensive/fixture.json')), cash=JSON.parse(fs.readFileSync('tests/highveld-comprehensive/fixture-cash.json'));
const movement=load(p+'print-studio/afsMovementReview.ts'),notes=load(p+'print-studio/AfsStructuredNotesPanel.tsx'),eq=load(p+'components/AfsCompleteEquityStatement.tsx'),tax=load(p+'print-studio/afsTaxReconciliation.ts');
const history=eq.withComparativeHistory(f.history,f.lines,'2026-02-28'),state=cash.state;
state.presentationReview={scope:'consolidated',reviewed:true};state.ppeInputs={};
for(const [year,side] of [[2026,'current'],[2025,'prior']])for(const [key,values]of Object.entries(f.periods[year].ppe)){
 state.ppeInputs[key]??={};state.ppeInputs[key][side]=values;
}
const policies={notesInvestmentProperty:'The group applies the IAS 40 fair value model to rental property A. The specialist property B is subject to the exceptional cost measurement in IAS 40 because reliable comparable transactions are unavailable and alternative reliable fair-value measurements cannot be developed. Property B is depreciated at R100 annually. Independent fictional valuation evidence for property A supports R341,700 at 28 February 2026 (2025: R321,600).',notesGoodwill:'Goodwill is allocated to the office solutions cash-generating unit. It is not amortised under IFRS 3 and IAS 36. The annual impairment test uses a five-year cash-flow forecast, 12% pre-tax discount rate and 2% terminal growth. Recoverable amount R25,000 exceeds the unit carrying amount R15,000; no new impairment is recognised in either year. Historical impairment is R200.',notesIntangibleAssets:'Software is measured at cost less straight-line amortisation over 20 years. Annual amortisation is R500 in each period. Qualifying development expenditure of R400 in each year meets IAS 38 recognition criteria, remains under development and is not yet amortised. Annual software purchases are R1,000.',notesBiologicalAssets:'Livestock and growing crops are measured at fair value less costs to sell under IAS 41 using observable market prices. The specialist biological class qualifies for the initial-recognition reliability exception and remains at cost less annual depreciation R20. Annual fair-value growth of R50 relates to non-current livestock. No harvests, acquisitions or disposals occur in either period.',notesProvisions:'Each provision class has additions of R10 and utilisation of R5 in each period. The restoration provision also increases by R10 annually for discount unwinding. Expected settlement is after twelve months for non-current classes and within twelve months for current classes. No reimbursements are expected.'};
const caseFacts=require('./dynamic_case_facts.cjs').buildDynamicFacts(f,require('./disclosure_facts.cjs'));policies.notesIntangibleAssets=caseFacts.notesIntangibleAssets.classes+' '+caseFacts.notesIntangibleAssets.movement;
for(const [section,family]of Object.entries(movement.MOVEMENT_FAMILIES)){
 const saved=state[family.stateKey]={opening:{},movements:{},policyChoice:'0',policyReviewed:true,policyText:policies[section]};
 for(const row of movement.movementRowsForReview(section,f.lines,cash.engine.noteData)){
  saved.opening[row.id]={};saved.movements[row.id]={};
  for(const [year,side]of [[2026,'current'],[2025,'prior']]){
   const before=f.periods[year].opening;const code=row.id.match(/-(\d{3}(?:\.\d+)*)$/)?.[1];
   const source=Object.values(f.accounts).filter(a=>code?a.mapping_code===code:family.prefixes.some(pre=>a.mapping_code===pre||a.mapping_code.startsWith(pre+'.')));
   const opening=source.reduce((n,a)=>n+Number(before[a.account_code]||0)*(family.credit?-1:1),0);saved.opening[row.id][side]=opening;
   const amounts=Object.fromEntries(Array.from({length:family.count},(_,i)=>['movement'+i,0]));
   if(section==='notesInvestmentProperty')Object.assign(amounts,year===2025?{movement0:311600,movement3:10000,movement4:-100}:{movement3:20100,movement4:-100});
   if(section==='notesIntangibleAssets')Object.assign(amounts,{movement0:1400,movement2:-f.periods[year].intangibleAmortisation});
   if(section==='notesBiologicalAssets'){if(code==='330.10')amounts.movement2=50;if(code==='330.30')amounts.movement4=-20;}
   if(section==='notesProvisions')Object.assign(amounts,{movement0:10,movement1:-5,movement3:code?.startsWith('515.')?Math.round(opening*.05):0});
   saved.movements[row.id][side]=amounts;
  }
 }
}
const taxPapers=require('./sa_tax_workpapers.cjs').buildSaTaxWorkpapers(f,load(p+'tax/taxWorkpaper.ts'));state.taxationReconciliation={};for(const [year,side]of [[2026,'current'],[2025,'prior']])for(const[key,amount]of Object.entries(taxPapers[year].reconciliation)){state.taxationReconciliation[key]||={};state.taxationReconciliation[key][side]=amount;}
fs.writeFileSync('tests/highveld-comprehensive/tax-workpapers.json',JSON.stringify(taxPapers,null,2));
state.shareCapital={authorisedShares:'2000000',priorAuthorisedShares:'2000000',issuedShares:'1000000',priorIssuedShares:'1000000',issuedPar:'',priorIssuedPar:'',rightsText:'The company has 1,000,000 ordinary no-par-value shares in issue throughout both years, each carrying one vote and equal dividend and residual rights. Authorised ordinary shares total 2,000,000. Preference capital of R2,000 is non-redeemable and distributions are wholly discretionary. Share premium is R2,000. Treasury shares cost R200 and are deducted from equity. No shares are reserved for options or issue under contracts.'};
const bad=movement.reviewAllMovementNotes(f.lines,cash.engine.noteData,state,history).filter(r=>r.difference===null||Math.abs(r.difference)>.005||r.openingConflict||r.invalid);
assert.equal(bad.length,0,JSON.stringify(bad));assert.equal(notes.reviewPpeNote(f.lines,state,history).length,0,JSON.stringify(notes.reviewPpeNote(f.lines,state,history)));
const tr=tax.taxReconciliationReview(cash.engine.noteData,state,{tax_rate:27});assert(tr.every(r=>r.difference===0),JSON.stringify(tr));
fs.writeFileSync('tests/highveld-comprehensive/fixture-state.json',JSON.stringify(state,null,2));
console.log(JSON.stringify({movementPeriods:movement.reviewAllMovementNotes(f.lines,cash.engine.noteData,state,history).length,ppeIssues:0,tax:tr},null,2));
