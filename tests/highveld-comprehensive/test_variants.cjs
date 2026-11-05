const fs=require('fs'),assert=require('node:assert/strict'),{load}=require('./load.cjs');const root='tests/highveld-comprehensive/',p='app/afs/[engagementId]/',f=JSON.parse(fs.readFileSync(root+'fixture.json')),cash=JSON.parse(fs.readFileSync(root+'fixture-cash.json')),engine=load(p+'components/AfsPrintStatementEngine.ts'),cf=load(p+'print-studio/afsCashFlowPresentation.ts');
const result=[];
for(const framework of ['full','smes2015','smes2025'])for(const scope of ['consolidated','standalone']){
 const lines=structuredClone(f.lines),history=structuredClone(f.history),overrides=structuredClone(cash.overrides);
 const line=code=>lines.find(l=>l.mapping_code===code&&!l.account_code.startsWith('ELIM'));
 const delta=(code,current,prior)=>{const l=line(code);l.current_year_balance+=current;l.prior_year_balance+=prior;};
 if(framework!=='full'){
  delta('305.131',-400,-200);delta('320.10',-800,-400);delta('321.10',-2880,-2400);
  delta('750.141',480,480);delta('750.90',400,400);delta('775.10',200,200);delta('795.20',-162,-162);delta('595.10',324,162);delta('810.10',2838,1920);
  // The historical debt FVOCI reserve is reclassified to retained earnings; the separately qualifying cash-flow hedge remains in OCI.
  delta('820.30',1568,1568);delta('810.10',-1568,-1568);
  const h=history.find(l=>l.mapping_code==='321.10');h.closing_balance-=1920;
  history.find(l=>l.mapping_code==='810.10').closing_balance+=1920;
  history.find(l=>l.mapping_code==='820.30').closing_balance+=1568;history.find(l=>l.mapping_code==='810.10').closing_balance-=1568;
  for(const collection of [lines,history])for(const l of collection){
   if(l.mapping_code==='499.10'){l.mapping_code='305.10';l.mapping_label='Land — former disposal group';}
   if(l.mapping_code==='699.10'){l.mapping_code='630.20';l.mapping_label='Other current liability — former disposal group';}

   // Section 5 still presents the discontinued business result separately.
   if(l.mapping_code.startsWith('306.'))l.mapping_label='Finance-leased office premises';
  }
  // IFRS 5 measurement is not imported; the post-tax discontinued result and its cash tax remain.
  for(const side of ['Current','Prior']){overrides['cashPaymentsSuppliersEmployees'+side]-=400;overrides['cashOtherInvesting'+side]+=400;}
 }
 if(scope==='standalone'){
  for(const collection of [lines,history])for(const l of collection){
   const amounts=collection===lines?['current_year_balance','prior_year_balance']:['closing_balance'];
   if(l.account_code.startsWith('ELIM')||l.account_code==='SUBCAP'||l.mapping_code==='830.10')for(const key of amounts)l[key]=0;
   const removeSubs={'420.10':-5907.41,'495.10':-2000,'395.10':-2000,'660.10':2000,'660.20':2000,'660.90':2000,'670.20':1407.41};
   if(removeSubs[l.mapping_code])for(const key of amounts)l[key]=Math.round((l[key]+removeSubs[l.mapping_code])*100)/100;
   if(!l.account_code.startsWith('ELIM')&&l.mapping_code==='340.11'){l.mapping_code='449.30';l.mapping_label='Current loan to subsidiary — on demand';}
   if(!l.account_code.startsWith('ELIM')&&l.mapping_code==='547.20'){l.mapping_code='610.50';l.mapping_label='Current loan from subsidiary — on demand';}
  }
 }
 for(const side of ['current_year_balance','prior_year_balance'])assert(Math.abs(lines.reduce((n,l)=>n+l[side],0))<.005,framework+'/'+scope+' '+side);
 assert(Math.abs(history.reduce((n,l)=>n+l.closing_balance,0))<.005);
 const state=cf.prepareCashFlowWorkState(null,lines,{cashGeneratedFromOperations:{values:{otherNonCash1:{current:80,prior:80}}}},history,'2026-02-28',overrides);for(const side of ['current','prior']){state.cashGeneratedFromOperations.values.tradeReceivables[side]+=10;state.cashGeneratedFromOperations.values.tradePayables[side]+=40;}
 const e=cf.buildCashFlowPresentation(engine.buildAfsPrintStatementEngine(lines,overrides),lines,state,overrides,history,'2026-02-28');
 for(const key of ['sfpDifference','sfpPriorDifference','cashFlowClosingDifference','cashFlowPriorClosingDifference','cashDirectIndirectDifferenceCurrent','cashDirectIndirectDifferencePrior'])assert(Math.abs(e.checks[key])<.005,framework+'/'+scope+' '+key);
 if(scope==='standalone')assert.equal(e.noteData.nonControllingInterests.reduce((n,l)=>n+l.current,0),0);
 if(framework!=='full'){assert.equal(lines.find(l=>l.mapping_code==='797.40').current_year_balance,-30);assert.equal(e.checks.profitBeforeTax,f.periods[2026].pbt-1080);}
 fs.writeFileSync(root+'variant-'+framework+'-'+scope+'.json',JSON.stringify({framework,scope,lines,history,state,overrides,checks:e.checks},null,2));result.push({framework,scope,checks:e.checks});console.log('PASS '+framework+' '+scope);
}
fs.writeFileSync(root+'variant-results.json',JSON.stringify(result,null,2));
