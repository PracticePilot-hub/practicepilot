const assert=require('node:assert/strict'),{load,r}=require('./load.cjs');
const p='app/afs/[engagementId]/print-studio/',ready=load(p+'afsExportReadiness.ts').buildExportReadiness,gc=load(p+'afsGoingConcern.ts'),req=load(p+'afsNoteDisclosureRequirements.ts');
const advisory={id:'suggestion',severity:'caution',title:'Optional policy review',message:'Consider material policy information.',target:'accounting-policies'};
let result=ready([advisory],[],[]);assert.equal(result.finalisationIssues.length,0);assert.equal(result.flightDeckIssues[0].severity,'caution');
const required=['Tax workpaper review is pending.','Presentation scope is not assessed','Property, plant and equipment: Class reconciliation'];
result=ready([advisory],['cashFlowClosingDifference'],required,[{title:'Property, plant and equipment',target:'note:notesPropertyPlantEquipment',targetLabel:'Notes → Work'}]);
assert.equal(result.flightDeckIssues.filter(i=>i.severity==='critical').length,4);assert.equal(result.finalisationIssues.length,4);assert.equal(result.arithmeticIssues.length,1);
assert.equal(result.flightDeckIssues.find(i=>i.message===required[2]).target,'note:notesPropertyPlantEquipment');
for(const issue of result.flightDeckIssues.filter(i=>i.severity==='critical'))assert(issue.target);
result=ready([{id:'cash',severity:'caution',title:'Review calculated cash movements',message:'Check gross movements.',target:'cash-flow-work'}],[],['Review calculated cash movements in Cash Flow Work']);assert.equal(result.flightDeckIssues.length,1);assert.equal(result.flightDeckIssues[0].severity,'critical');
for(const framework of ['smes','full']){
 const context={framework,edition:'2015'},note={key:'notesGoingConcern',optionKey:'notesGoingConcern',defaultTitle:'Going concern'};
 const state={goingConcernAssessment:{assessmentStatus:'no-disclosure',assessmentContext:gc.goingConcernContext(context),assessmentEvidence:'Management reviewed twelve-month forecasts and confirmed supported funding.',conditions:'Existing disclosure retained for future review.'}};
 const original=JSON.stringify(state);assert(gc.goingConcernReview(state,context).omitNote);
 assert.equal(req.noteDisclosureIssues([note],{notesGoingConcern:true},state,context).length,0);assert.equal(JSON.stringify(state),original);
 for(const status of ['material-uncertainty','significant-judgement','alternative-basis']){
  const risk=structuredClone(state);risk.goingConcernAssessment.assessmentStatus=status;
  assert(gc.goingConcernReview(risk,context).disclosureRequired);assert(!gc.goingConcernReview(risk,context).omitNote);assert.equal(req.noteDisclosureIssues([note],{notesGoingConcern:true},risk,context).length,1);
 }
 const blank=structuredClone(state);blank.goingConcernAssessment.assessmentEvidence='';assert(gc.goingConcernReview(blank,context).omitNote);assert(gc.goingConcernReview(blank,context).complete);assert.equal(gc.goingConcernReview(blank,context).issues.length,0);assert.equal(req.noteDisclosureIssues([note],{notesGoingConcern:true},blank,context).length,0);
 const old=structuredClone(state);old.goingConcernAssessment.assessmentContext='old';assert(!gc.goingConcernReview(old,context).assessed);
 const legacy={goingConcernAssessment:{conditions:'Legacy narrative is not an explicit assessment.'}};assert(gc.goingConcernReview(legacy,context).issues.length);
 const React=r('react'),render=r('react-dom/server').renderToStaticMarkup,Panel=load(p+'AfsStructuredNotesPanel.tsx').default;
 const props={engagementId:'fictional-going-concern-test',structuredNotesState:state,noteSections:[note],reportOptions:{notesGoingConcern:true},toggleReportOption:()=>{},noteData:{},trialBalanceLines:[],clientSetup:{basis_of_preparation:framework==='full'?'Full IFRS':'IFRS for SMEs'},currentHeading:'2026',priorHeading:'2025',forceReviewMode:true};
 let html=render(React.createElement(Panel,props));assert(!html.includes('Existing disclosure retained'));assert(!html.includes('>Going concern<'));assert(!html.includes('Management reviewed twelve'));
 props.structuredNotesState={goingConcernAssessment:{...state.goingConcernAssessment,assessmentStatus:'material-uncertainty'}};
 html=render(React.createElement(Panel,props));assert(html.includes('Existing disclosure retained'));assert(!html.includes('Management reviewed twelve'));
}
console.log('PASS yellow suggestions do not block export; all required holds appear as red, linked blockers. Supported no-disclosure assessments omit the printed note; uncertainty, judgement and alternative-basis outcomes retain disclosure requirements without erasing saved text.');
const React=r('react'),render=r('react-dom/server').renderToStaticMarkup,Assessment=load(p+'AfsGoingConcernAssessment.tsx').default,Content=load(p+'AfsNoteDisclosureContent.tsx').default;
const context={framework:'smes',edition:'2015'},setup={basis_of_preparation:'IFRS for SMEs'};
function assessment(state){return render(React.createElement(Assessment,{state,context,update:()=>{}}));}
let html=assessment({});assert(html.includes('1. Can the business continue trading'));assert(!html.includes('<textarea'));assert(!html.includes('2. Is there anything'));
assert.equal(render(React.createElement(Content,{sectionKey:'notesGoingConcern',edit:true,state:{},setup,update:()=>{}})),'');
const supported={goingConcernAssessment:{assessmentStatus:'no-disclosure',assessmentContext:'smes:2015',assessmentEvidence:'Supported management assessment of forecasts and available funding.'}};
html=assessment(supported);assert(html.includes('2. Is there anything'));assert(html.includes('Optional: add a working-paper explanation'));assert(html.includes('There are no disclosure boxes to complete.'));assert(!html.includes('<select'));
const risk=structuredClone(supported);risk.goingConcernAssessment.assessmentStatus='material-uncertainty';
html=render(React.createElement(Content,{sectionKey:'notesGoingConcern',edit:true,state:risk,setup,update:()=>{}}));assert(html.includes('<details open=""'));assert(html.includes('Type here — wording to include in the AFS'));
// Framework changes must not silently reuse answers from a previous assessment.
const stale=structuredClone(supported);stale.goingConcernAssessment.assessmentContext='full';stale.goingConcernAssessment.operatingOutlook='yes';stale.goingConcernAssessment.disclosureNeed='none';html=assessment(stale);assert(!html.includes('checked=""'));assert(!html.includes('<textarea'));
console.log('PASS guided assessment starts with one practical question; further questions and wording appear only when needed, and old answers survive without being silently reused.');

const assessedWithoutText={goingConcernAssessment:{assessmentStatus:'no-disclosure',assessmentContext:'smes:2015'}};
const assessedReview=gc.goingConcernReview(assessedWithoutText,context);
const assessedGate=ready([],[],assessedReview.issues);
assert.equal(assessedGate.finalisationIssues.length,0);assert.equal(assessedGate.flightDeckIssues.length,0);
assert.equal(req.noteDisclosureIssues([{key:'notesGoingConcern',optionKey:'notesGoingConcern',defaultTitle:'Going concern'}],{notesGoingConcern:true},assessedWithoutText,context).length,0);
html=assessment(assessedWithoutText);assert(html.includes('Assessment recorded.'));assert(!html.includes('Only the short explanation'));
console.log('PASS an explicit no-disclosure assessment clears the going-concern blocker without compulsory free text; uncertain or unassessed outcomes are not silently cleared.');

const arithmetic=load(p+'afsExportReadiness.ts').statementArithmeticIssues;
assert.equal(arithmetic({cashFlowMovementDifference:0.22,cashFlowClosingDifference:-0.22,cashFlowPriorClosingDifference:0.03}).length,0);
for(const key of ['cashFlowMovementDifference','cashFlowClosingDifference','cashFlowPriorClosingDifference']) {
 for(const value of [1,-1,18.25,NaN,Infinity]) {
  const messages=arithmetic({[key]:value});assert.equal(messages.length,1);assert(!messages[0].includes(key));
  assert.equal(ready([],messages,[]).flightDeckIssues[0].target,'cash-flow-work');
 }
}
assert.equal(arithmetic({sfpDifference:0.03}).length,1);
assert.equal(arithmetic({cashPriorOpeningMissing:true}).length,1);
console.log('PASS cash export checks match whole-rand workbench rounding, preserve real/missing-value blockers and link clear messages to Cash Flow Work.');
