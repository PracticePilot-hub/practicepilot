"use client";
import {useEffect,useState} from 'react';
import AfsNoteDisclosureContent from './print-studio/AfsNoteDisclosureContent';
import {LEAD_NOTE_SECTIONS} from './print-studio/afsLeadNoteSections';
import {noteSections,accountingPolicySections} from './components/AfsPolicyNoteDefaults';

export default function AfsLeadNoteWording({engagementId,schedule,setup,lines}:{engagementId:string;schedule:string;setup:Record<string,any>|null;lines:readonly any[]}){
 const [state,setState]=useState<Record<string,any>>({}),[base,setBase]=useState<Record<string,any>>({}),[loaded,setLoaded]=useState(false),[status,setStatus]=useState('Loading note wording…'),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
 const [options,setOptions]=useState<Record<string,boolean>>({}),[baseOptions,setBaseOptions]=useState<Record<string,boolean>>({});
 const defaultIncluded=(section:string)=>['policyBasisPreparation','policyJudgementsEstimates','notesOtherNonCurrentAssets','notesInventories','notesCashAndCashEquivalents','notesShareCapital','notesShareholdersLoans','notesOperatingExpenses','notesCashUsedInOperations'].includes(section);
 const keys=LEAD_NOTE_SECTIONS[schedule]||[],storageKey=`afs-lead-wording-draft:${engagementId}:${schedule}`;
 useEffect(()=>{let alive=true;void(async()=>{try{
  const response=await fetch(`/api/afs/engagements/${engagementId}/print-studio-settings?notesOnly=1`,{cache:'no-store'}),data=await response.json();
  if(!response.ok||!data.success)throw new Error(data.error||'Could not load note wording.');if(!alive)return;
  const saved=data.structuredNotesState||{};setBase(saved);setState(saved);setOptions(data.reportOptions||{});setBaseOptions(data.reportOptions||{});setLoaded(true);setStatus('Saved wording is shared with Notes and the AFS.');
  try{const draft=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(draft){setBase(draft.base);setState(draft.state);setOptions(draft.options||data.reportOptions||{});setBaseOptions(draft.baseOptions||data.reportOptions||{});setDirty(true);setStatus('Your unsaved draft has been restored. Save it to update the AFS.');}}catch{}
 }catch(error:any){if(alive)setStatus(error.message);}})();return()=>{alive=false;};},[engagementId,storageKey]);
 function update(path:string[],value:any){setState(current=>{const next=structuredClone(current);let target=next;for(const key of path.slice(0,-1))target=target[key]||=( {} );target[path[path.length-1]]=value;
  try{sessionStorage.setItem(storageKey,JSON.stringify({base,state:next,options,baseOptions}));}catch{}return next;});setDirty(true);setStatus('Unsaved wording — save to update the AFS.');}
 async function save(){setBusy(true);setStatus('Saving wording…');try{
  const patches=keys.flatMap(section=>Object.entries(state.disclosureContent?.[section]||{}).filter(([field,entry])=>JSON.stringify(entry)!==JSON.stringify(base.disclosureContent?.[section]?.[field])).map(([field,entry])=>({section,field,entry,base:base.disclosureContent?.[section]?.[field]??null})));
  const optionPatches=keys.filter(section=>options[section]!==baseOptions[section]).map(section=>({section,value:options[section],base:baseOptions[section]??null}));
  if(!patches.length&&!optionPatches.length){setDirty(false);setStatus('No wording changes to save.');return;}
  const response=await fetch(`/api/afs/engagements/${engagementId}/print-studio-settings`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({disclosureEntryPatches:patches,disclosureOptionPatches:optionPatches})}),data=await response.json();
  if(!response.ok||!data.success)throw new Error(data.error||'Wording could not be saved.');
  const next=data.structuredNotesState||{};setBase(next);setState(next);setOptions(data.reportOptions||{});setBaseOptions(data.reportOptions||{});setDirty(false);sessionStorage.removeItem(storageKey);
  try{localStorage.setItem(`practicepilot-afs-structured-notes:${engagementId}`,JSON.stringify(next));localStorage.setItem(`practicepilot-afs-print-studio:${engagementId}:report-options`,JSON.stringify(data.reportOptions||{}));}catch{}
  window.dispatchEvent(new CustomEvent('afs-structured-notes-change',{detail:{engagementId,state:next}}));
  if(data.signoffInvalidated)window.dispatchEvent(new CustomEvent('afs-signoff-refresh',{detail:{engagementId,sectionKey:'financial-statements'}}));
  setStatus('Saved to the AFS. The same wording is available in Notes.');
 }catch(error:any){setStatus(error.message);}finally{setBusy(false);}}
 if(!keys.length)return null;
 return <section style={{margin:'16px 0',padding:18,border:'1px solid #93c5fd',background:'#fff',borderRadius:6}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><div><h3 style={{margin:0}}>AFS note wording</h3><p style={{margin:'6px 0'}}>Choose a standard, change the wording, or write your own. Empty own wording will not print.</p></div><button type="button" disabled={!loaded||busy||!dirty} onClick={save} style={{padding:'10px 14px',background:dirty?'#1d4ed8':'#e2e8f0',color:dirty?'white':'#475569',border:0,borderRadius:4,whiteSpace:'nowrap',cursor:'pointer'}}> {busy?'Saving…':'Save note wording'}</button></div>
  <p role="status" style={{color:dirty?'#92400e':'#475569'}}>{status}</p>
  {loaded&&keys.map(section=>{const title=[...noteSections,...accountingPolicySections].find(note=>note.key===section)?.defaultTitle||section;return <div key={section}><h4>{title}</h4><label style={{display:'block',padding:8,background:'#f8fafc'}}><input type="checkbox" checked={options[section]??defaultIncluded(section)} onChange={event=>{const next={...options,[section]:event.target.checked};setOptions(next);setDirty(true);setStatus('Unsaved note selection.');try{sessionStorage.setItem(storageKey,JSON.stringify({base,state,options:next,baseOptions}));}catch{}}}/> Include this {section.startsWith('policy')?'policy':'note'} in the AFS</label><AfsNoteDisclosureContent sectionKey={section} edit expanded state={state} setup={setup} update={update} lines={lines} scheduleHref={`/afs/${engagementId}/print-studio`}/></div>;})}
  {loaded&&dirty&&<button type="button" disabled={busy} onClick={save} style={{padding:"10px 14px",background:"#1d4ed8",color:"white",border:0,borderRadius:4}}>Save note wording</button>}
 </section>;
}
