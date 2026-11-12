"use client";
import { goingConcernContext, goingConcernReview } from "./afsGoingConcern";
import type { StandardsContext } from "./afsStandardsCoverage";
type Props = { state: Record<string, any>; context: StandardsContext; update: (path: string[], value: any) => void };
export default function AfsGoingConcernAssessment({state, context, update}: Props) {
  const value = state.goingConcernAssessment || {}, review = goingConcernReview(state, context);
  return <fieldset data-work-only="true" className="afs-screen-only" style={{border:"1px solid #94a3b8",padding:10,margin:"10px 0"}}>
    <legend style={{fontWeight:700}}>Going-concern assessment · Work only</legend>
    <p>Assess the entity’s ability to continue operating using available forward-looking information. A separate note is needed for material uncertainties, significant judgements requiring disclosure, or a different preparation basis.</p>
    <label>Assessment outcome<select aria-label="Going-concern assessment outcome" value={review.status || ""} onChange={e=>update(["goingConcernAssessment"], {...value, assessmentStatus:e.target.value, assessmentContext:goingConcernContext(context)})} style={{display:"block",width:"100%",padding:6,margin:"5px 0"}}>
      <option value="">Not assessed</option>
      <option value="no-disclosure">Assessed — no material uncertainty or significant judgement requiring a separate note</option>
      <option value="material-uncertainty">Material uncertainty — disclosure required</option>
      <option value="significant-judgement">Significant judgement — disclosure required</option>
      <option value="alternative-basis">Not a going concern — alternative basis and reasons required</option>
    </select></label>
    <label>Assessment basis and supporting evidence (Work only)<textarea aria-label="Going-concern assessment evidence" value={value.assessmentEvidence || ""} onChange={e=>update(["goingConcernAssessment", "assessmentEvidence"],e.target.value)} style={{display:"block",width:"100%",boxSizing:"border-box",minHeight:65,padding:6}} placeholder="Record the assessment period, forecasts, liquidity, funding/support evidence and management’s conclusion."/></label>
    {review.omitNote && <p>No separate going-concern note will print. Existing disclosure wording is retained in Work.</p>}
    {review.disclosureRequired && <p>Select Going concern under Other disclosures and complete the required financial-statement wording in Notes → Work.</p>}
    {review.issues.map(issue=><p key={issue} style={{color:"#9f1239"}}>{issue}</p>)}
  </fieldset>;
}
