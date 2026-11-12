"use client";
import { relatedPartyStructuredFields } from "./afsRelatedPartyDisclosure";
import { goingConcernReview } from "./afsGoingConcern";
import {entityDisclosureFieldLabel} from "../afsEntityPresentation";
import AfsDisclosureTables from "./AfsDisclosureTables";
import { disclosureContext, disclosureFields, fieldComplete, supportedDisclosureText } from "./afsNoteDisclosureRequirements";
import { getStandardsReference, standardsContext } from "./afsStandardsCoverage";

type Props={sectionKey:string;edit:boolean;state:Record<string,any>;setup:Record<string,any>|null;update:(path:string[],value:any)=>void;customText?:string;lines?:readonly any[];suppliedFields?:Record<string,boolean>};
/** Required narrative is stored with the same note state used by preview and PDF. */
export default function AfsNoteDisclosureContent({sectionKey,edit,state,setup,update,customText,lines=[],suppliedFields={}}:Props){
 const context=standardsContext(setup),fields=disclosureFields(sectionKey,context),entries=state.disclosureContent?.[sectionKey]||{};
 if(sectionKey==="notesGoingConcern") {
   const review=goingConcernReview(state,context);
   if(review.omitNote || (edit && !review.disclosureRequired)) return null;
 }
 const structured={...suppliedFields,...(sectionKey==="notesRelatedParties"?relatedPartyStructuredFields(state,lines,context.framework==="full"?"full":"smes"):{})};
 const missing=fields.filter(field=>!(structured as Record<string,boolean>)[field.id] && !fieldComplete(field,entries[field.id],context));
 const reference=getStandardsReference(sectionKey,context);
 const paragraphs=(text:string)=>text.split(/\n\s*\n/).filter(Boolean).map((part,index)=><p key={index} style={{margin:"4px 0 7px",whiteSpace:"pre-line",orphans:3,widows:3}}>{part}</p>);
 if(edit) return <details open={sectionKey==="notesGoingConcern" ? true : undefined} data-disclosure-section={sectionKey} data-work-only="true" className="afs-screen-only" style={{margin:"10px 0",padding:10,border:"1px solid #94a3b8",background:"#f8fafc"}}>
   <summary style={{fontWeight:700,cursor:"pointer"}}>Information to complete · {missing.length?`${missing.length} content areas incomplete`:"content entered — assess supporting evidence"}</summary>
   {reference&&<p><a href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a></p>}
   <p>Enter financial-statement wording for both periods where relevant. The entered content prints below the note’s tables. Use existing schedules for amounts; explain assumptions, terms and conclusions here. A filled field does not certify compliance.</p>
   {fields.map(field=>{const entry=entries[field.id]||{}; if(sectionKey==="notesPropertyPlantEquipment" && field.id==="reconciliation") return <div key={field.id} style={{border:"1px solid #93c5fd",padding:12,margin:"10px 0",background:"#eff6ff"}}><strong>Asset movements by category (class reconciliation)</strong><p>For each asset category, the table shows opening balance + additions − disposals − depreciation ± other movements = closing balance.</p><p>{suppliedFields.reconciliation ? "The asset movement table already reconciles. You do not need to type it again." : "Complete the numeric asset movement table. A paragraph is not a substitute for the amounts."}</p><button type="button" onClick={event=>{const schedule=event.currentTarget.closest("[data-ppe-schedule]");schedule?.querySelector("input")?.focus({preventScroll:true});schedule?.scrollIntoView({behavior:"smooth",block:"start"});}} style={{border:"1px solid #2563eb",background:"white",padding:"8px 12px",fontWeight:700,cursor:"pointer"}}>Open asset movement table ↑</button></div>;
     if((structured as Record<string,boolean>)[field.id]) return <p key={field.id} style={{color:"#166534"}}>{field.label}: supplied by the completed schedules. No duplicate typing needed.</p>;const id=`disclosure-${sectionKey}-${field.id}`;return <fieldset key={field.id} style={{border:0,borderTop:"1px solid #cbd5e1",padding:"9px 0"}}>
     <legend style={{fontWeight:600}}>{entityDisclosureFieldLabel(sectionKey,field.id,field.label,setup?.entity_type)}</legend><p style={{margin:"3px 0",fontSize:11}}>{field.prompt}</p>
     {field.conditional&&<label style={{display:"block",margin:"4px 0"}}><input type="checkbox" checked={!!entry.notApplicable} onChange={e=>update(["disclosureContent",sectionKey,field.id],{...entry,notApplicable:e.target.checked,context:disclosureContext(context)})}/> This conditional disclosure does not apply</label>}
     {entry.requiresReview&&<p style={{color:"#9f1239",fontSize:11}}>Sourced draft: {entry.reviewReason || "Complete the entity-specific information before finalisation."}</p>}
     <label htmlFor={id} style={{display:"block",fontWeight:700,color:"#1e40af",margin:"8px 0 5px"}}>✎ Type here — {entry.notApplicable?"reason (Work only)":"wording to include in the AFS"}</label>
     <textarea id={id} aria-invalid={!fieldComplete(field,entry,context)} aria-label={`${entityDisclosureFieldLabel(sectionKey,field.id,field.label,setup?.entity_type)} — ${sectionKey}`} placeholder={entry.notApplicable?"Type why this conditional disclosure does not apply…":`Type your ${entityDisclosureFieldLabel(sectionKey,field.id,field.label,setup?.entity_type).toLowerCase()} here…`} value={entry.notApplicable?entry.reason||"":entry.text||""} onChange={e=>update(["disclosureContent",sectionKey,field.id],{...entry,requiresReview:false,[entry.notApplicable?"reason":"text"]:e.target.value,context:disclosureContext(context)})} style={{display:"block",boxSizing:"border-box",width:"100%",minHeight:110,fontSize:12,padding:12,border:"2px solid #94a3b8",borderRadius:6,background:"#ffffff",color:"#111827",boxShadow:"0 1px 3px rgba(15,23,42,0.08)"}}/>
     <button type="button" onClick={()=>update(["disclosureContent",sectionKey,field.id],{...entry,tables:[...(entry.tables||[]),{title:field.label,columns:["Current year","Prior year"],rows:[{label:"Description",cells:[0,0]}]}],requiresReview:false,context:disclosureContext(context)})} style={{border:"1px solid #94a3b8",padding:"6px 10px",background:"#fff",borderRadius:4,marginTop:6,cursor:"pointer"}}>+ Add a table (optional)</button>
     <AfsDisclosureTables tables={entry.tables||[]} edit onChange={tables=>update(["disclosureContent",sectionKey,field.id],{...entry,tables,requiresReview:false,context:disclosureContext(context)})}/>
     {!fieldComplete(field,entry,context)&&<p style={{color:"#9f1239",fontSize:10}}>Financial-statement wording or a supported conditional exclusion is still required.</p>}
   </fieldset>})}
 </details>;
 const printedTexts=new Set<string>();
 return <div data-afs-disclosure-content={sectionKey}>
   {customText?.trim()?paragraphs(customText):null}
   {fields.map(field=>{const entry=entries[field.id];const text=entry?.notApplicable || entry?.context !== disclosureContext(context)?"":supportedDisclosureText(entry?.text); const existing=sectionKey==="notesGoingConcern"?(field.id==="assessment"?state.goingConcernAssessment?.forecast:field.id==="basis"?state.goingConcernAssessment?.conclusion:undefined):sectionKey==="notesRelatedParties"&&field.id==="population"?state.relatedPartyDisclosure?.controlText:undefined; if(existing&&String(existing).trim()===text.trim()&&!entry?.tables?.length)return null;const duplicate=!!text&&printedTexts.has(text.trim());if(text)printedTexts.add(text.trim());if(duplicate&&!entry?.tables?.length)return null;return text?<div key={field.id}><h3 style={{fontSize:"inherit",fontWeight:600,margin:"8px 0 3px",breakAfter:"avoid"}}>{entityDisclosureFieldLabel(sectionKey,field.id,field.label,setup?.entity_type)}</h3>{!duplicate&&paragraphs(text)}<AfsDisclosureTables tables={entry.tables||[]}/></div>:null;})}
 </div>;
}
