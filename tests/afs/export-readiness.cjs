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
 const blank=structuredClone(state);blank.goingConcernAssessment.assessmentEvidence='';assert(!gc.goingConcernReview(blank,context).omitNote);assert(gc.goingConcernReview(blank,context).issues.length);
 const old=structuredClone(state);old.goingConcernAssessment.assessmentContext='old';assert(!gc.goingConcernReview(old,context).assessed);
 const legacy={goingConcernAssessment:{conditions:'Legacy narrative is not an explicit assessment.'}};assert(gc.goingConcernReview(legacy,context).issues.length);
 const React=r('react'),render=r('react-dom/server').renderToStaticMarkup,Panel=load(p+'AfsStructuredNotesPanel.tsx').default;
 const props={engagementId:'fictional-going-concern-test',structuredNotesState:state,noteSections:[note],reportOptions:{notesGoingConcern:true},toggleReportOption:()=>{},noteData:{},trialBalanceLines:[],clientSetup:{basis_of_preparation:framework==='full'?'Full IFRS':'IFRS for SMEs'},currentHeading:'2026',priorHeading:'2025',forceReviewMode:true};
 let html=render(React.createElement(Panel,props));assert(!html.includes('Existing disclosure retained'));assert(!html.includes('>Going concern<'));assert(!html.includes('Management reviewed twelve'));
 props.structuredNotesState={goingConcernAssessment:{...state.goingConcernAssessment,assessmentStatus:'material-uncertainty'}};
 html=render(React.createElement(Panel,props));assert(html.includes('Existing disclosure retained'));assert(!html.includes('Management reviewed twelve'));
}
console.log('PASS yellow suggestions do not block export; all required holds appear as red, linked blockers. Supported no-disclosure assessments omit the printed note; uncertainty, judgement and alternative-basis outcomes retain disclosure requirements without erasing saved text.');
