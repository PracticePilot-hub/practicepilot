import type {StandardsContext} from './afsStandardsCoverage';
/** Preserve client edits; require correction when a saved policy explicitly applies another framework. */
export function policyFrameworkIssues(sections:readonly {key:string;optionKey:string;title?:string}[],options:Record<string,unknown>,texts:Record<string,{text?:string}>,context:StandardsContext){
 if(context.framework==='unknown')return [];
 const issues:{key:string;message:string}[]=[];
 for(const section of sections){
  if(!options[section.optionKey])continue;
  const text=String(texts[section.key]?.text||'');
  const wrong=context.framework==='smes' && (/\b(?:under|in accordance with|applies?|using)\s+(?:the\s+)?(?:IFRS\s+(?:3|9|15|16)|IAS\s+(?:23|38|40|41))\b/i.test(text)||/goodwill\s+(?:is\s+)?not\s+amorti[sz]ed/i.test(text));
  const wrongEdition=context.framework==='smes'&&((context.edition==='2015'&&/under Section 23[^.]*2025|2025 Third Edition/i.test(text))||(context.edition==='2025'&&/\b(?:applies?|using|under|in accordance with)\s+(?:the\s+)?IAS\s*39\b/i.test(text)));
  if(wrong||wrongEdition)issues.push({key:section.key,message:`${section.title||section.key}: the saved policy applies a different framework or edition. Review its wording in Policies; your saved text has been preserved.`});
 }
 return issues;
}

export function frameworkLeaseLabel(label:string,context:StandardsContext){
 return context.framework==='smes'&&/^right[- ]of[- ]use assets$/i.test(label.trim())?'Finance-leased assets':label;
}
