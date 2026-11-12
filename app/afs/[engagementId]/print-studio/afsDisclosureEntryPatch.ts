import {NOTE_DISCLOSURE_FIELDS} from './afsNoteDisclosureRequirements';
const same=(a:unknown,b:unknown)=>JSON.stringify(a??null)===JSON.stringify(b??null);
/** Merge only edited fields. Reject stale edits instead of overwriting another tab. */
export function mergeDisclosureEntryPatches(state:Record<string,any>,patches:any[]){
 if(!Array.isArray(patches)||patches.length>250)throw new Error('Invalid note wording changes.');
 const next=structuredClone(state);next.disclosureContent||={};
 for(const patch of patches){
  const {section,field,entry,base}=patch||{};
  if(!Object.prototype.hasOwnProperty.call(NOTE_DISCLOSURE_FIELDS,section)||!(/^[a-z][a-zA-Z0-9]*$/.test(field||''))||['__proto__','constructor','prototype'].includes(field)||!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Invalid note wording field.');
  // Edition-specific fields use the same entry shape, even when absent from the base catalog.
  const allowed=[...NOTE_DISCLOSURE_FIELDS[section].map(f=>f.id),'fairValue','aging','maturity','contractDetails'];
  if(!allowed.includes(field))throw new Error('Unknown note wording field.');
  if(!same(state.disclosureContent?.[section]?.[field],base))throw new Error('This wording changed in another window. Reload the notes before saving. Your draft has been kept.');
  next.disclosureContent[section]={...(next.disclosureContent[section]||{}),[field]:entry};
 }
 return next;
}
export function mergeDisclosureOptionPatches(options:Record<string,any>,patches:any[]){
 if(!Array.isArray(patches)||patches.length>100)throw new Error('Invalid note selections.');
 const next={...options};
 for(const patch of patches){
  const {section,value,base}=patch||{};
  if(!Object.prototype.hasOwnProperty.call(NOTE_DISCLOSURE_FIELDS,section)||typeof value!=='boolean')throw new Error('Invalid note selection.');
  if(!same(options[section],base))throw new Error('This note selection changed in another window. Reload before saving.');
  next[section]=value;
 }
 return next;
}
