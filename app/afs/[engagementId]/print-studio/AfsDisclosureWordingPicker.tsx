"use client";
import {useState} from 'react';
import {standardWording} from './afsDisclosureWording';
import {disclosureContext,type DisclosureEntry} from './afsNoteDisclosureRequirements';
import type {StandardsContext} from './afsStandardsCoverage';
export default function AfsDisclosureWordingPicker({section,field,entry,context,entityType,onChange}:{section:string;field:string;entry:DisclosureEntry;context:StandardsContext;entityType?:string;onChange:(value:DisclosureEntry)=>void}){
 const [selected,setSelected]=useState('');
 const choices=standardWording(section,field,context,entityType),draft=choices.find(choice=>choice.id===selected);
 return <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',padding:12,borderRadius:6,margin:'8px 0'}}>
  <label style={{display:'block',fontWeight:700,marginBottom:6}}>Choose wording
   <select aria-label={`Choose wording — ${section} — ${field}`} value={selected} onChange={e=>setSelected(e.target.value)} style={{display:'block',width:'100%',padding:8,marginTop:6,background:'white',border:'1px solid #94a3b8',borderRadius:4}}>
    <option value="">Keep existing wording / choose an option…</option>
    {choices.map(choice=><option key={choice.id} value={choice.id}>{choice.label}</option>)}
    <option value="custom">Write my own wording (blank will not print)</option>
   </select>
  </label>
  {draft&&<><p style={{whiteSpace:'pre-line',background:'white',padding:10,border:'1px solid #cbd5e1'}}>{draft.text}</p><p style={{fontSize:11}}>Choose this only if it matches the facts. You can change every word below.</p><button type="button" onClick={()=>{onChange({...entry,wordingMode:'standard',wordingChoice:draft.id,text:draft.text,notApplicable:false,requiresReview:/\[enter /i.test(draft.text),context:disclosureContext(context)});setSelected('');}} style={{padding:'8px 12px',background:'#1d4ed8',color:'white',border:0,borderRadius:4,cursor:'pointer'}}>Use this wording</button></>}
  {selected==='custom'&&<><p>Type your own wording below. Leaving it empty omits this text and leaves a yellow review reminder.</p><button type="button" onClick={()=>{onChange({...entry,wordingMode:'custom',wordingChoice:undefined,notApplicable:false,requiresReview:false,context:disclosureContext(context)});setSelected('');}} style={{padding:'8px 12px',background:'white',border:'1px solid #2563eb',borderRadius:4,cursor:'pointer'}}>Use my own wording</button></>}
  {entry.wordingMode==='custom'&&<p style={{marginBottom:0,fontSize:11}}>Own wording selected. Empty text is omitted from the AFS.</p>}
 </div>;
}
