const assert=require('node:assert/strict'),fs=require('fs'),{buildSmeCase}=require('./sme_review_case.cjs'),{load,r}=require('./load.cjs'),p='app/afs/[engagementId]/';
const defaults=load(p+'components/AfsPolicyNoteDefaults.ts'),req=load(p+'print-studio/afsNoteDisclosureRequirements.ts'),eng=load(p+'components/AfsPrintStatementEngine.ts'),cf=load(p+'print-studio/afsCashFlowPresentation.ts'),mov=load(p+'print-studio/afsMovementReview.ts'),notes=load(p+'print-studio/AfsStructuredNotesPanel.tsx'),tax=load(p+'tax/taxWorkpaper.ts'),tr=load(p+'print-studio/afsTaxReconciliation.ts'),eq=load(p+'components/afsEquityComponents.ts'),history=load(p+'components/AfsCompleteEquityStatement.tsx'),content=load(p+'print-studio/AfsNoteDisclosureContent.tsx').default;
const render=r('react-dom/server').renderToStaticMarkup,React=r('react');
const proof=[];
for(const edition of ['2015','2025'])for(const scope of ['consolidated','standalone']){
 const c=buildSmeCase(edition,scope),st=c.settings.state,context={framework:'smes',edition};const h=history.withComparativeHistory(c.history,c.lines,'2026-02-28'),base=eng.buildAfsPrintStatementEngine(c.lines,c.overrides),e=cf.buildCashFlowPresentation(base,c.lines,st,c.overrides,h,'2026-02-28');
 for(const key of ['sfpDifference','sfpPriorDifference','cashFlowClosingDifference','cashFlowPriorClosingDifference','cashDirectIndirectDifferenceCurrent','cashDirectIndirectDifferencePrior'])assert(Math.abs(e.checks[key])<.005,edition+scope+key);
 assert.equal(e.checks.profitForYear,585615);assert.equal(e.checks.profitBeforeTax,802748);assert.equal(e.noteData.discontinuedOperations.reduce((n,r)=>n+r.current,0),365);
 assert.equal(req.noteDisclosureIssues([...defaults.noteSections,...defaults.accountingPolicySections],c.settings.reportOptions,st,context).length,0);
 assert.equal(mov.reviewAllMovementNotes(c.lines,e.noteData,st,h).filter(r=>r.difference===null||Math.abs(r.difference)>.005||r.openingConflict||r.invalid).length,0);
 assert.equal(notes.reviewPpeNote(c.lines,st,h).length,0);assert(tr.taxReconciliationReview(e.noteData,st,c.setup).every(r=>r.difference===0));
 for(const year of [2025,2026])assert.equal(tax.taxWorkbookIssues(c.tax[year],year===2026?c.lines:c.lines.map(l=>({...l,current_year_balance:l.prior_year_balance})),scope==='consolidated').length,0);
 for(const t of eq.equityComponentTables(c.lines,h,st))assert(!t.columns.includes('Unclassified movements'),t.title);
 const trade=render(React.createElement(content,{sectionKey:'notesTradeReceivables',edit:false,state:st,setup:c.setup,update(){}}));assert(trade.includes('Trade impairment allowance'));assert(!trade.includes('lifetime ECL approach'));
 const fa=render(React.createElement(content,{sectionKey:'notesOtherFinancialAssets',edit:false,state:st,setup:c.setup,update(){}}));assert(fa.includes('Financial-instrument categories'));assert.equal(fa.includes('Financial assets at fair value'),edition==='2025');
 assert(st.disclosureContent.notesGoodwill.life.text.includes('R480'));assert.equal(c.settings.reportOptions.notesAssetsHeldForSale,false);
 if(scope==='standalone'){assert.equal(e.noteData.nonControllingInterests.reduce((n,r)=>n+r.current,0),0);assert(st.disclosureContent.notesInvestmentsSubsidiaries.measurement.text.includes('carried at historical cost R2,000'));assert(st.relatedPartyAccounts.filter(x=>x.category==='subsidiary').every(x=>!x.eliminated));}
 proof.push({edition,scope,checks:e.checks,notes:defaults.noteSections.filter(n=>c.settings.reportOptions[n.optionKey]).length,complete:true});fs.writeFileSync(__dirname+'/case-'+edition+'-'+scope+'.json',JSON.stringify(c,null,2));
 console.log('PASS SME '+edition+' '+scope+': disclosures render, movements/tax/equity/cash reconcile, discontinued result retained.');
}
fs.writeFileSync(__dirname+'/sme-review-results.json',JSON.stringify(proof,null,2));
