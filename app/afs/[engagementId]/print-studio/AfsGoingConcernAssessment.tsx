"use client";
import { useId } from "react";
import { goingConcernContext, goingConcernReview } from "./afsGoingConcern";
import type { StandardsContext } from "./afsStandardsCoverage";
type Props = { state: Record<string, any>; context: StandardsContext; update: (path: string[], value: any) => void };
/** Ask the practical questions first; do not preselect or invent an assessment. */
export default function AfsGoingConcernAssessment({state, context, update}: Props) {
  const groupId = useId();
  const value = state.goingConcernAssessment || {}, review = goingConcernReview(state, context);
  const outlook = value.assessmentContext === goingConcernContext(context)
    ? value.operatingOutlook || (review.status === "alternative-basis" ? "no" : review.assessed ? "yes" : "") : "";
  const disclosure = value.assessmentContext !== goingConcernContext(context) ? "" : value.disclosureNeed || ({"no-disclosure":"none","material-uncertainty":"uncertainty","significant-judgement":"judgement"} as Record<string,string>)[review.status] || "";
  function answer(key: string, selected: string) {
    const next = {...value, operatingOutlook:outlook, disclosureNeed:disclosure, [key]:selected};
    next.assessmentStatus = next.operatingOutlook === "no" ? "alternative-basis" : next.operatingOutlook === "yes"
      ? ({none:"no-disclosure",uncertainty:"material-uncertainty",judgement:"significant-judgement"} as Record<string,string>)[next.disclosureNeed] || "" : "";
    next.assessmentContext = goingConcernContext(context);
    update(["goingConcernAssessment"],next);
  }
  const choice = (name:string, selected:string, label:string, help?:string) => <label key={selected} style={{display:"block",border:"1px solid #cbd5e1",borderRadius:5,padding:"9px 10px",margin:"6px 0",cursor:"pointer",background:(name === "operatingOutlook" ? outlook : disclosure) === selected ? "#eff6ff" : "#fff"}}>
    <input type="radio" name={`${groupId}-${name}`} checked={(name === "operatingOutlook" ? outlook : disclosure) === selected} onChange={()=>answer(name,selected)}/> <strong>{label}</strong>
    {help && <span style={{display:"block",marginLeft:22,fontSize:11,color:"#475569",marginTop:3}}>{help}</span>}
  </label>;
  return <fieldset data-work-only="true" className="afs-screen-only" style={{border:"1px solid #94a3b8",borderRadius:5,padding:14,margin:"10px 0",fontSize:12}}>
    <legend style={{fontWeight:700}}>Does this business need a going-concern note?</legend>
    <p style={{marginTop:3}}>Answer these questions from your review. Your assessment stays in Work; only a required disclosure goes into the AFS.</p>
    <fieldset style={{border:0,padding:0,margin:0}}><legend style={{fontWeight:700}}>1. Can the business continue trading and meet its payments?</legend>
      <p style={{fontSize:11,color:"#475569"}}>Consider expected receipts, expenses, debts falling due and confirmed funding or lender support. Assess at least 12 months from the reporting date, using all available later information.</p>
      {choice("operatingOutlook","yes","Yes — the business can continue")}
      {choice("operatingOutlook","unsure","I still need to check","Keep this assessment pending while you obtain the missing information.")}
      {choice("operatingOutlook","no","No — closure is planned or there is no realistic alternative")}
    </fieldset>
    {outlook === "yes" && <fieldset style={{border:0,padding:0,margin:"14px 0"}}><legend style={{fontWeight:700}}>2. Is there anything about that conclusion the reader needs to know?</legend>
      {choice("disclosureNeed","none","No — no material uncertainty or significant judgement needs disclosure","No separate going-concern note is needed.")}
      {choice("disclosureNeed","uncertainty","Yes — there is serious uncertainty about continued trading","For example, necessary funding or loan support remains uncertain.")}
      {choice("disclosureNeed","judgement","Yes — the conclusion required significant judgement","The facts and judgement need explaining even though continued trading is appropriate.")}
      {choice("disclosureNeed","unsure","I still need to check")}
    </fieldset>}
    {review.assessed && <label style={{display:"block",fontWeight:700,marginTop:14}}>3. Briefly explain what supports your answers
      <span style={{display:"block",fontWeight:400,fontSize:11,margin:"5px 0"}}>Record the period reviewed and the relevant facts or documents. This explanation stays in Work.</span>
      <textarea aria-label="Going-concern assessment evidence" value={value.assessmentEvidence || ""} onChange={e=>update(["goingConcernAssessment", "assessmentEvidence"],e.target.value)} style={{display:"block",width:"100%",boxSizing:"border-box",minHeight:80,padding:8,fontFamily:"inherit",fontWeight:400}} placeholder="What expected trading, payment or funding information did you review, and why does it support your conclusion?"/>
    </label>}
    {review.omitNote && <p role="status" style={{padding:10,background:"#ecfdf5",color:"#166534",fontWeight:700}}>Assessment recorded. No separate going-concern note will print. There are no disclosure boxes to complete.</p>}
    {review.assessed && !review.complete && <p style={{color:"#9f1239"}}>Add a brief supporting explanation to complete this assessment.</p>}
    {review.disclosureRequired && <p style={{padding:10,background:"#fff7ed"}}>A note is needed. Complete “Required note wording” below in Notes → Work. Your answers are saved automatically.</p>}
    {(outlook === "unsure" || (outlook === "yes" && disclosure === "unsure")) && <p style={{color:"#9f1239"}}>Assessment pending. Obtain the missing information before choosing a conclusion.</p>}
  </fieldset>;
}
