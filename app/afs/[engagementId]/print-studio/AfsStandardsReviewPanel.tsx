"use client";
import AfsGoingConcernAssessment from "./AfsGoingConcernAssessment";
import { fillSupportedDisclosureDrafts } from "./afsSupportedDisclosureDrafts";
import { reviewPpeNote, ppeDisclosureFields } from "./AfsStructuredNotesPanel";
import { taxReconciliationReview } from "./afsTaxReconciliation";
import AfsNoteDisclosureContent from "./AfsNoteDisclosureContent";
import { POLICY_DISCLOSURE_KEYS, noteDisclosureIssues } from "./afsNoteDisclosureRequirements";
import { COVERAGE_TOPICS, getStandardsReference, reviewStandardsCoverage, standardsContext } from "./afsStandardsCoverage";
import { reviewAllMovementNotes } from "./afsMovementReview";
import { relatedPartyReviewIssues } from "./afsRelatedPartyDisclosure";

type Props={taxReviews?:ReturnType<typeof taxReconciliationReview>;people?:any[];engine:any;history:any[];lines:any[];policies:any[];notes:any[];options:Record<string,any>;state:Record<string,any>;setup:Record<string,any>|null;onChange:(next:Record<string,any>)=>void};
export default function AfsStandardsReviewPanel({taxReviews,people=[],engine,history,lines,policies,notes,options,state,setup,onChange}:Props){
  const context=standardsContext(setup);
  const reviews=reviewStandardsCoverage(lines,policies,notes,options,state,context);
  const unmapped=[...policies,...notes].filter(item=>!getStandardsReference(item.key,context));
  const linked=new Set(reviews.flatMap(r=>r.mapped.map(line=>String(line.id||line.account_code))));
  const applicable=reviews.filter(r=>r.applicable);
  return <details id="afs-standards-review" data-work-only="true" className="afs-screen-only" style={{border:"1px solid #94a3b8",padding:10,marginTop:10,fontSize:11,background:"#fff"}}>
    <summary style={{cursor:"pointer",fontWeight:700}}>Whole AFS review · standards and disclosure sources</summary>
    <div data-afs-review-scroll="true" style={{maxHeight:"45vh",overflowY:"auto",overscrollBehavior:"contain",padding:"0 2px"}}>
    <div style={{position:"sticky",top:0,zIndex:1,background:"#fff",display:"flex",justifyContent:"flex-end",padding:"7px 0",borderBottom:"1px solid #dbe3ed"}}><button type="button" onClick={event=>{const panel=event.currentTarget.closest("details");if(panel){panel.open=false;panel.querySelector("summary")?.focus();}}} style={{padding:"5px 10px",border:"1px solid #94a3b8",background:"#fff",cursor:"pointer"}}>Close review</button></div>
    <p>Selected policies and notes are not a compliance sign-off. This checklist covers the current library and mapped accounts; use the standards to assess materiality, facts outside the TB, measurement and presentation.</p>
    <p>{context.framework==="smes"?`IFRS for SMEs (${context.edition})`:context.framework==="full"?"Full IFRS — check effective dates and early-adoption elections":"Reporting framework must be selected"}. {policies.length} policies, {notes.length} notes, {COVERAGE_TOPICS.length} review areas. {unmapped.length} library items lack a source link. {linked.size} accounts trigger review areas.</p>
    <label>Presentation scope<select aria-label="AFS presentation scope" value={state.presentationReview?.scope || ""} onChange={e=>onChange({...state,presentationReview:{...state.presentationReview,scope:e.target.value}})} style={{display:"block",fontSize:11,padding:5,margin:"4px 0 7px"}}>
      <option value="">Not assessed — select scope</option><option value="standalone">Standalone entity</option><option value="separate">Separate financial statements of an investor / parent</option><option value="consolidated">Consolidated group</option>
    </select></label>
    <label>Scope / exemption and supporting evidence<textarea aria-label="AFS scope evidence" value={state.presentationReview?.evidence || ""} onChange={e=>onChange({...state,presentationReview:{...state.presentationReview,evidence:e.target.value}})} style={{display:"block",width:"100%",fontSize:11,minHeight:48}} placeholder="Record the control assessment, ownership evidence, exemptions and consolidation/elimination schedules, where applicable."/></label>
    <AfsGoingConcernAssessment state={state} context={context} update={(path,value)=>{const next=structuredClone(state);let cursor:any=next;for(const key of path.slice(0,-1)){cursor[key]={...(cursor[key]||{})};cursor=cursor[key];}cursor[path[path.length-1]]=value;onChange(next);}}/>
    <button type="button" onClick={()=>onChange(fillSupportedDisclosureDrafts(state,setup,lines,people))} style={{padding:"7px 10px",fontSize:11,cursor:"pointer"}}>Fill known details from records</button>
    <p>Copies only blank disclosure areas from client setup and mapped TB information. Existing wording is preserved. Sourced drafts with missing terms, assumptions or other required detail remain flagged; this does not mark review ticks complete.</p>
    <h3>Entity-specific policy disclosures</h3>
    {POLICY_DISCLOSURE_KEYS.filter(key=>options[key]).map(key=><AfsNoteDisclosureContent key={key} sectionKey={key} edit={true} state={state} setup={setup} update={(path,value)=>{const next=structuredClone(state);let cursor:any=next;for(const key of path.slice(0,-1)){cursor[key]={...(cursor[key]||{})};cursor=cursor[key];}cursor[path[path.length-1]]=value;onChange(next);}}/>)}
    <p>For 2026 full-IFRS reports, IAS 1 remains relevant unless IFRS 18 is early applied. IFRS 18 is effective for periods beginning on or after 1 January 2027. The SME 2025 edition has its own early-adoption and transition requirements.</p>
    <details style={{borderTop:"1px solid #94a3b8",padding:"8px 0"}}><summary style={{fontWeight:700}}>Work schedules — openings, recorded changes and unexplained differences</summary>
      <p>Closing balance less opening balance is a change to explain. It is not automatically an addition, valuation change, disposal or cash flow. Captured openings that conflict with the TB history require review; saved inputs are retained.</p>
      {reviewPpeNote(lines,state,history).map((row,index)=><p key={`ppe-${index}`} style={{color:"#9f1239"}}>PPE {row.label} · {row.side}: source cost less recorded schedule {row.costDifference.toLocaleString("en-ZA")}; accumulated depreciation / impairment difference {row.depDifference.toLocaleString("en-ZA")}.{row.openingMissing?" Historical opening is not provided.":""}{row.openingConflict?" Captured opening conflicts with source history.":""} The summary uses mapped closing balances; no movement is inferred.</p>)}
      {(taxReviews??taxReconciliationReview(engine?.noteData||{},state,setup)).filter(row=>row.difference===null||Math.abs(row.difference)>0.005||row.invalid||row.rateAssumed).map(row=><p key={`tax-${row.side}`} style={{color:"#9f1239"}}>Tax {row.side}: unexplained reconciliation difference {row.difference===null?"profit before tax required":row.difference.toLocaleString("en-ZA")}.{row.rateAssumed?" Statutory rate is not recorded in setup.":""} Tax effects require supporting analysis.</p>)}
      {reviewAllMovementNotes(lines,engine?.noteData||{},state,history).map((row,index)=><p key={index} style={{color:row.difference!==0||row.openingConflict?"#9f1239":"#111827"}}>{row.label} · {row.side}: opening {row.opening===null?"not supplied":row.opening.toLocaleString("en-ZA")}; recorded changes {row.movements.toLocaleString("en-ZA")}; closing {row.closing.toLocaleString("en-ZA")}; unexplained difference {row.difference===null?"opening required":row.difference.toLocaleString("en-ZA")}.{row.openingConflict?" Saved opening conflicts with the TB/history.":""}{row.policyMissing?" Note-specific measurement/disclosure text is incomplete.":""} {row.difference===0?"Arithmetic agrees; evidence and disclosures still need assessment.":""}</p>)}
    </details>
    {applicable.map(r=>{const ref=getStandardsReference(r.topic.policies[0]||r.topic.notes[0],context);return <details key={r.topic.id} style={{borderTop:"1px solid #cbd5e1",padding:"7px 0"}}>
      <summary style={{cursor:"pointer"}}>{r.topic.label} · {r.mapped.length} mapped accounts · {r.selectedPolicies.length} policies / {r.selectedNotes.length} notes selected{r.issues.length?" · inputs / review needed":" · assess disclosure detail"}</summary>
      {ref && <p><a href={ref.url} target="_blank" rel="noreferrer">{ref.label}</a></p>}
      <p>{r.topic.review}</p>
      {r.issues.map(issue=><p key={issue} style={{color:"#9f1239"}}>{issue}</p>)}
      {r.topic.id==="related"&&relatedPartyReviewIssues(state,lines,context.framework==="full"?"full":"smes").map(issue=><p key={issue} style={{color:"#9f1239"}}>{issue}</p>)}
      <p>Policy items: {r.topic.policies.map(key=>policies.find(p=>p.key===key)?.defaultTitle||key).join("; ")||"Assess the policy for the underlying transaction"}.</p>
      <p>Notes: {r.topic.notes.map(key=>notes.find(n=>n.key===key)?.defaultTitle||key).join("; ")||"Assess disclosures in the relevant notes"}.</p>
    </details>})}
    <details><summary>Incomplete note wording</summary>{noteDisclosureIssues(notes,options,state,context,lines,ppeDisclosureFields(lines,state,history)).map(item=><p key={item.key}><strong>{item.title}:</strong> {item.missing.join("; ")}. Open Notes → Work → Required note wording.</p>)}</details>
    {unmapped.length>0&&<p style={{color:"#9f1239"}}>Source coverage missing: {unmapped.map(item=>item.key).join(", ")}.</p>}
    </div>
  </details>;
}
