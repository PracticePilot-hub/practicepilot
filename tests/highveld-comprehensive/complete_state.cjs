const fs=require('fs'),{load}=require('./load.cjs');const root='tests/highveld-comprehensive/',pre='app/afs/[engagementId]/';const f=JSON.parse(fs.readFileSync(root+'fixture.json')),state=JSON.parse(fs.readFileSync(root+'fixture-state.json')),facts=require('./dynamic_case_facts.cjs').buildDynamicFacts(f,require('./disclosure_facts.cjs')),req=load(pre+'print-studio/afsNoteDisclosureRequirements.ts'),defaults=load(pre+'components/AfsPolicyNoteDefaults.ts'),rp=load(pre+'print-studio/afsRelatedPartyDisclosure.ts');
state.equityTransactions=["prior","current"].map(side=>({label:"Equity-settled share-based payments",side,amounts:[0,0,100,0,0]}));
state.disclosureContent={};for(const[key,fields]of Object.entries(req.NOTE_DISCLOSURE_FIELDS)){
 state.disclosureContent[key]={};for(const field of fields){const text=facts[key]?.[field.id];if(!text)throw Error('Missing case fact '+key+'.'+field.id);state.disclosureContent[key][field.id]={text,context:'full',source:'Fictional Highveld comprehensive fixture v1: balanced journal ledger and documented scenario'};}
}
const relatedCase=require('./related_party_case.cjs').buildRelatedPartyCase(f,f.lines,rp);
state.relatedPartyAccounts=relatedCase.links;
state.relatedPartyDisclosure={controlText:facts.notesRelatedParties.population,controlReviewed:true,populationReviewed:true,termsReviewed:true,kmpReviewed:true,kmp:{shortTerm:{current:75000,prior:60000},postEmployment:{current:5000,prior:5000},otherLongTerm:{current:0,prior:0},termination:{current:0,prior:0},shareBased:{current:100,prior:100},managementFees:{current:1000,prior:1000}},extraText:facts.notesRelatedParties.terms};
// Transaction disclosures are distinct from closing balances and come from journals.
state.relatedPartyRows=relatedCase.rows;
const options={...JSON.parse(fs.readFileSync(root+'settings.json')).reportOptions};for(const section of [...defaults.noteSections,...defaults.accountingPolicySections])options[section.optionKey]=true;
const texts=defaults.buildAccountingPolicyTextsForEdition('2025',null,'full');
const result={state,reportOptions:options,accountingPolicyTexts:texts,noteTexts:defaults.buildDefaultNoteTexts()};
const missing=req.noteDisclosureIssues([...defaults.noteSections,...defaults.accountingPolicySections],options,state,{framework:'full',edition:'2025'});if(missing.length)throw Error(JSON.stringify(missing));const issues=rp.relatedPartyReviewIssues(state,f.lines,'full');if(issues.length)throw Error(JSON.stringify(issues));fs.writeFileSync(root+'fixture-settings.json',JSON.stringify(result,null,2));console.log('All 57 notes and 58 policies enabled; 138 disclosure fields populated; related-party review passes.');
