/** Remove repeated selected policy prose within a topic; retain distinct wording and Work disclosures. */
export function distinctPolicySections<T extends {key:string;optionKey:string;group?:string}>(sections:readonly T[],options:Record<string,unknown>,texts:Record<string,{text?:string}>,disclosures:Record<string,unknown>={}){
 const seen=new Set<string>();
 return sections.filter(section=>{
  if(!options[section.optionKey])return false;
  const text=String(texts[section.key]?.text||'').trim().replace(/\s+/g,' ');
  // Never suppress a unique captured disclosure, including one attached to a legacy key.
  const extra=disclosures[section.key];
  const signature=section.group&&text?JSON.stringify([section.group,text,extra||null]):section.key;
  if(seen.has(signature))return false;seen.add(signature);return true;
 });
}
