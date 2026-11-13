const assert=require('node:assert/strict'),{load,r}=require('./load.cjs');
const root='app/afs/[engagementId]/print-studio/',req=load(root+'afsNoteDisclosureRequirements.ts'),wording=load(root+'afsDisclosureWording.ts'),patch=load(root+'afsDisclosureEntryPatch.ts'),drafts=load(root+'afsSupportedDisclosureDrafts.ts');
for(const entity of ['Company','Close Corporation','Trust','Sole Proprietor','Partnership','Non Profit Company'])for(const context of [{framework:'smes',edition:'2015'},{framework:'smes',edition:'2025'},{framework:'full',edition:'2015'}]){
 const saved={wordingMode:'custom',text:'',context:req.disclosureContext(context)},notes=[{key:'notesCashAndCashEquivalents',optionKey:'cash',title:'Cash'}],state={disclosureContent:{notesCashAndCashEquivalents:{definition:saved,restrictions:saved}}};
 assert.equal(req.noteDisclosureIssues(notes,{cash:true},state,context).length,0);
 assert.equal(req.blankWordingReviews(notes,{cash:true},state,context).length,1);
 assert.equal(req.fieldComplete(req.disclosureFields(notes[0].key,context)[0],saved,context),false); // not a compliance assertion
 assert.equal(req.supportedDisclosureText(saved.text),'');
 assert(wording.standardWording('notesCashAndCashEquivalents','restrictions',context,entity).some(x=>x.id==='unrestricted'));
 assert.equal(req.noteDisclosureIssues(notes,{cash:true},{},context).length,1); // old blanks not silently cleared
}
const ctx={framework:'smes',edition:'2015'},blank={text:'',wordingMode:'custom',context:'smes:2015'},state={presentationReview:{scope:'standalone'},disclosureContent:{notesRevenue:{streams:blank},notesCashAndCashEquivalents:{restrictions:{text:'Existing custom cash wording',context:'smes:2015'}}},cashFlow:{captured:123}};
const merged=patch.mergeDisclosureEntryPatches(state,[{section:'notesRevenue',field:'streams',base:blank,entry:{...blank,text:'Revenue is from rental income.'}}]);
assert.equal(merged.disclosureContent.notesCashAndCashEquivalents.restrictions.text,'Existing custom cash wording');assert.equal(merged.cashFlow.captured,123);assert.equal(state.disclosureContent.notesRevenue.streams.text,'');
assert.throws(()=>patch.mergeDisclosureEntryPatches(merged,[{section:'notesRevenue',field:'streams',base:blank,entry:blank}]),/another window/);
assert.throws(()=>patch.mergeDisclosureEntryPatches(state,[{section:'__proto__',field:'streams',entry:blank}]),/Invalid/);
assert.throws(()=>patch.mergeDisclosureEntryPatches(state,[{section:'notesRevenue',field:'__proto__',entry:blank}]),/Invalid/);
const derived=drafts.fillSupportedDisclosureDrafts(state,{basis_of_preparation:'IFRS for SMEs'},[{mapping_code:'700.20',account_name:'Rent',current_year_balance:-100,prior_year_balance:-90}]);assert.equal(derived.disclosureContent.notesRevenue.streams.text,'');
const catalog=load(root+'afsLeadNoteSections.ts').LEAD_NOTE_SECTIONS,covered=new Set(Object.values(catalog).flat());for(const key of Object.keys(req.NOTE_DISCLOSURE_FIELDS))assert(covered.has(key),'Lead mapping missing '+key);
const goods2015=wording.standardWording('notesRevenue','streams',ctx,'Company').find(x=>x.id==='goods').text,goods2025=wording.standardWording('notesRevenue','streams',{framework:'smes',edition:'2025'},'Company').find(x=>x.id==='goods').text;assert(goods2015.includes('risks and rewards'));assert(goods2025.includes('control'));
const patent=wording.standardWording('notesIntangibleAssets','classes',ctx,'Company')[0];assert.equal(req.supportedDisclosureText(patent.text),''); // unresolved useful lives never print as facts
assert.equal(req.ownWordingLeftBlank({...blank,context:'full'},ctx),false);
console.log('PASS shared wording across six entity templates/three framework contexts: explicit own blanks warn without blocking or printing, old blanks stay checked, facts/amounts preserved, stale edits rejected and all note sections reachable from leads.');

const React=r('react'),render=r('react-dom/server').renderToStaticMarkup,Content=load(root+'AfsNoteDisclosureContent.tsx').default;
const blankState={disclosureContent:{notesCashAndCashEquivalents:{definition:blank,restrictions:blank}}};
const printed=render(React.createElement(Content,{sectionKey:'notesCashAndCashEquivalents',edit:false,state:blankState,setup:{basis_of_preparation:'IFRS for SMEs'},update:()=>{}}));
assert(!printed.includes('<h3'));assert(!printed.includes('Not provided'));assert(!printed.includes('undefined'));
const edited=render(React.createElement(Content,{sectionKey:'notesCashAndCashEquivalents',edit:true,state:blankState,setup:{basis_of_preparation:'IFRS for SMEs'},update:()=>{}}));assert(edited.includes('Choose wording'));assert(edited.includes('yellow review'));assert(!edited.includes('aria-invalid="true"'));
const readiness=load(root+'afsExportReadiness.ts').buildExportReadiness([{id:'own-blank',severity:'caution',title:'Cash: own wording left blank',message:'The text will not print.',target:'note:notesCashAndCashEquivalents'}],[],req.noteDisclosureIssues([{key:'notesCashAndCashEquivalents',optionKey:'cash'}],{cash:true},blankState,ctx).map(x=>x.title));assert.equal(readiness.finalisationIssues.length,0);
console.log('PASS actual print renderer emits no blank headings/placeholders; own wording displays a yellow reminder and export remains available.');
const selected=patch.mergeDisclosureOptionPatches({notesRevenue:false,notesCashAndCashEquivalents:true},[{section:'notesRevenue',base:false,value:true}]);assert.equal(selected.notesRevenue,true);assert.equal(selected.notesCashAndCashEquivalents,true);assert.throws(()=>patch.mergeDisclosureOptionPatches(selected,[{section:'notesRevenue',base:false,value:true}]),/another window/);
assert.equal(patch.mergeDisclosureEntryPatches(state,[]).cashFlow.captured,123);
const fs=require('fs'),defaults=fs.readFileSync('app/afs/[engagementId]/print-studio/page.tsx','utf8'),trueDefaults=['policyBasisPreparation','policyJudgementsEstimates','notesOtherNonCurrentAssets','notesInventories','notesCashAndCashEquivalents','notesShareCapital','notesShareholdersLoans','notesOperatingExpenses','notesCashUsedInOperations'];
for(const section of Object.keys(req.NOTE_DISCLOSURE_FIELDS)){const matched=defaults.slice(defaults.indexOf('const defaultReportOptions:')).match(new RegExp('\\b'+section+': (true|false)'));if(matched)assert.equal(matched[1]==='true',trueDefaults.includes(section),'Lead selection default differs for '+section);}
console.log('PASS lead-sheet note selections merge independently, reject stale changes and match the AFS defaults.');
