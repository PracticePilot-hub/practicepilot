const assert=require('node:assert/strict'),{load,r}=require('./load.cjs'),p='app/afs/[engagementId]/',React=r('react'),render=r('react-dom/server').renderToStaticMarkup;
const ep=load(p+'afsEntityPresentation.ts'),n=load(p+'components/AfsNarrativeBlocks.tsx'),rates=load(p+'tax/taxEntityRates.ts'),tax=load(p+'tax/taxWorkpaper.ts'),eq=load(p+'components/AfsCompleteEquityStatement.tsx'),engine=load(p+'components/AfsPrintStatementEngine.ts');
for(const type of ['Company','Close Corporation','Trust','Non-Profit Company','Sole Proprietor','Partnership']){
 const pres=ep.getAfsEntityPresentation(type),ctx={entityType:type,clientName:'Fictional Entity',framework:'IFRS for SMEs (2015)',approvalDate:'5 November 2026',directors:[{name:'Alex Test'}]};
 const html=render(React.createElement(n.DirectorsResponsibilitiesBlock,{context:ctx}));
 if(!['Company','Non-Profit Company'].includes(type))assert(!html.includes('Companies Act 71'),type);
 assert(html.includes(pres.responsiblePersonsLabel.toLowerCase()),type);
 const l=[{mapping_code:'805.10',current_year_balance:-1000,prior_year_balance:-1000},{mapping_code:'820.90',current_year_balance:-3000,prior_year_balance:-3000},{mapping_code:'810.10',current_year_balance:-5000,prior_year_balance:-5000},{mapping_code:'420.10',current_year_balance:9000,prior_year_balance:9000}],hist=l.flatMap(x=>['2024-02-29','2025-02-28'].map(y=>({...x,financial_year_end:y,closing_balance:x.prior_year_balance})));
 const output=render(React.createElement(eq.default,{engine:engine.buildAfsPrintStatementEngine(l),history:hist,entityType:type}));assert(output.includes(pres.equityStatementTitle.replace(/&/g,'&amp;').replace(/'/g,'&#x27;')),type);
 assert(/3[,\s]000/.test(output));if(type!=='Company')assert(!output.includes('>Contributed equity<'),type);
 if(rates.isOwnerTaxEntity({entity_type:type})){
  const wb={version:2,yearEnd:'2026-02-28',entities:[tax.newEntity()],reviewed:true,notes:'Supported business-only tax case',groupReconciliation:''};const bound=rates.bindTrustWorkpaper(wb,{entity_type:type});assert.equal(bound.entities[0].regime,'owner-tax');assert.equal(bound.reviewed,false);assert.equal(wb.entities[0].regime,'normal');assert.equal(rates.reportingTaxRate({entity_type:type}),0);assert.equal(tax.calculateTax(bound,[{mapping_code:'700.10',current_year_balance:-200000}]).current,0);
  bound.entities[0].priorTax=100;assert(tax.calculateTax(bound,[]).issues.some(x=>x.includes('Personal income tax')));
 }
}
const npc={version:2,yearEnd:'2026-02-28',entities:[tax.newEntity()],reviewed:true,notes:'NPC taxable activities',groupReconciliation:''};assert.equal(tax.calculateTax(npc,[{mapping_code:'700.10',current_year_balance:-100000}]).current,27000);npc.entities[0].regime='custom';npc.entities[0].rate=0;assert(tax.calculateTax(npc,[]).issues.some(x=>x.includes('enacted rate')));
console.log('PASS all six legal forms: responsibilities, complete equity/funds, owner tax exclusion, NPC exemption evidence and unchanged company treatment.');

const recon=load(p+'print-studio/afsTaxReconciliation.ts');assert.equal(recon.taxReconciliationReview({taxation:[{current:-40163,prior:-31995}],cashUsedInOperations:[{label:'Profit before tax',current:148750,prior:118500}]},{},{entity_type:'Company',tax_rate:27})[0].difference,0);

for(const type of ['Trust','Close Corporation','Non-Profit Company','Sole Proprietor','Partnership']){assert.equal(ep.entityDisclosureFieldLabel('notesShareCapital','classes','Share classes',type),'Capital, ownership and rights');const defs={policyShareCapitalEquity:{title:'Equity and shares',text:'Original default'}};assert(!ep.entityPolicyTexts(defs,defs,type).policyShareCapitalEquity.text.includes('Share issues'));assert.equal(ep.entityPolicyTexts({policyShareCapitalEquity:{text:'My supported bespoke policy'}},defs,type).policyShareCapitalEquity.text,'My supported bespoke policy');}

const coverage=load(p+'print-studio/afsStandardsCoverage.ts');const mixed={financial_reporting_framework:'IFRS for SMEs',basis_of_preparation:'IFRS',ifrs_smes_edition:'2025'};assert.equal(coverage.reportingFramework(mixed),'IFRS');assert.equal(coverage.standardsContext(mixed).framework,'full');assert.equal(coverage.standardsContext({basis_of_preparation:'IFRS for SMEs',financial_reporting_framework:'IFRS'}).framework,'smes');assert.equal(coverage.standardsContext({basis_of_preparation:'IFRS'}).framework,'full');

{const e=tax.newEntity();e.regime='owner-tax';e.payments=500;const result=tax.calculateTax({version:2,yearEnd:'2026-02-28',entities:[e],reviewed:false,notes:'',groupReconciliation:''},[]);assert(result.issues.some(x=>x.includes('Personal income tax')));}

{const entity=tax.newEntity();entity.paymentsConfirmed=true;const result=tax.calculateTax({version:2,yearEnd:'2026-02-28',entities:[entity],reviewed:false,notes:'',groupReconciliation:''},[{mapping_code:'700.10',current_year_balance:-148750}]);const rows=tax.taxReconciliation(result,148750,.27);assert.equal(rows.differentTaxRates||0,0);assert.equal(rows.taxRounding||0,0);}
{const context={entityType:'Close Corporation',clientName:'CC test',yearEnd:'28 February 2026',reportingPeriodLabel:'18-month period ended 28 February 2026',framework:'IFRS',directorsReportFinancialResults:true,directorsReportTexts:{financialResults:{title:'Financial results',text:'Results for the {reportingPeriodLabel}.'}}};const text=render(React.createElement(n.DirectorsReportBlock,{context}));assert(!text.includes('{reportingPeriodLabel}'));assert(text.includes('18-month period ended'));}

{
 const Component=load(p+'print-studio/AfsNoteDisclosureContent.tsx').default;
 const entry={text:'One complete capital disclosure covers the ownership rights and distributions.',context:'full'};
 const second={...entry,tables:[{title:'Preserved second-field table',columns:['2026'],rows:[{label:'Funds',cells:[100]}]}]};
 const state={disclosureContent:{notesShareCapital:{classes:entry,own:second}}};
 const html=render(React.createElement(Component,{sectionKey:'notesShareCapital',edit:false,state,setup:{entity_type:'Trust',basis_of_preparation:'IFRS'},update(){}}));
 assert.equal(html.split(entry.text).length-1,1);assert(html.includes('Preserved second-field table'));
}
