import { disclosureContext } from "./afsNoteDisclosureRequirements";
import { standardsContext } from "./afsStandardsCoverage";
/** Draft only facts held in setup/TB. Never infer transaction causes, loan terms or nil disclosures. */
export function fillSupportedDisclosureDrafts(state:Record<string,any>,setup:Record<string,any>|null,lines:readonly any[],people:readonly any[]=[]){
 const next=structuredClone(state),context=disclosureContext(standardsContext(setup));
 const content=next.disclosureContent||{};let changed=false;
 const put=(note:string,field:string,text:string,source:string,reviewReason?:string)=>{
  if(!text.trim() || String(content[note]?.[field]?.text||"").trim() || content[note]?.[field]?.notApplicable) return;
  content[note]={...(content[note]||{}),[field]:{text,context,source,...(reviewReason?{requiresReview:true,reviewReason}:{})}};changed=true;
 };
 const value=(line:any,side:"current"|"prior")=>Number(side==="current"?line.current_year_balance??(Number(line.debit||0)-Number(line.credit||0)):line.prior_year_balance??0);
 const money=(n:number)=>`${setup?.currency_symbol||"R"}${n<0?"(":""}${Math.abs(n).toLocaleString("en-ZA",{maximumFractionDigits:2})}${n<0?")":""}`;
 const year=String(setup?.financial_year_end||"").slice(0,4),prior=/^\d{4}$/.test(year)?String(Number(year)-1):"comparative";
 const revenue=lines.filter(line=>/^700(?:\.|$)/.test(String(line.mapping_code||""))&&["current","prior"].some(side=>Math.abs(value(line,side as "current"|"prior"))>0.005));
 if(revenue.length&&revenue.every(line=>Number.isFinite(value(line,"current"))&&Number.isFinite(value(line,"prior"))))put("notesRevenue","streams","Revenue recorded in the trial balance comprises "+revenue.map(line=>`${String(line.account_name||line.mapping_label||line.mapping_code)}: ${money(-value(line,"current"))} (${prior}: ${money(-value(line,"prior"))})`).join("; ")+".","Imported TB revenue mappings (700 family).","Confirm timing of recognition and contract-specific judgements for each stream; the TB supplies the disaggregation only.");
 const shareFacts:[[string,string],...Array<[string,string]>]=[["authorised_ordinary_shares","authorised ordinary shares"],["issued_ordinary_shares","issued ordinary shares"]];
 const particulars=shareFacts.filter(([key])=>setup?.[key]!=null&&String(setup[key]).trim()!=="").map(([key,label])=>`${String(setup![key])} ${label}`);
 if(particulars.length){
  const par=setup?.issued_ordinary_share_par_value;
  const text="The ordinary share particulars recorded in client setup comprise "+particulars.join(" and ")+(par!=null&&String(par).trim()!==""?`, with a recorded nominal value of ${setup?.currency_symbol||"R"}${par} per issued share`:"")+".";
  put("notesShareCapital","classes",text,"Saved AFS client setup share particulars.","Confirm share rights/preferences, nominal or no-par status and comparative share-number movements against the share register.");
 }
 const rawDate=String(setup?.afs_approval_date||setup?.approval_date||"");
 const entity=String(setup?.entity_type||"").toLowerCase();
 const authority=entity.includes("trust")?"trustees":entity==="cc"||entity.includes("close corporation")?"members":entity.includes("company")?"directors":"";
 if(/^\d{4}-\d{2}-\d{2}$/.test(rawDate)&&authority){const date=new Date(rawDate+"T12:00:00Z");if(Number.isFinite(date.getTime()))put("notesEventsAfterReportingPeriod","authorisation",`The financial statements were authorised for issue by the ${authority} on ${date.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})}.`,"Saved AFS approval date and entity type.");}
 const remuneration=lines.filter(line=>/^750\.28(?:\.|$)/.test(String(line.mapping_code||"")));
 if(remuneration.length){const current=remuneration.reduce((sum,line)=>sum+value(line,"current"),0),comparative=remuneration.reduce((sum,line)=>sum+value(line,"prior"),0);if(Number.isFinite(current)&&Number.isFinite(comparative))put("notesRelatedParties","compensation",`Directors’ remuneration recognised in profit or loss amounts to ${money(current)} (${prior}: ${money(comparative)}).`,"TB mapping 750.28, directors remuneration.","Assess the complete key-management compensation total, other benefits and management-entity service fees; the recorded expense is not automatically the complete total.");}
 const owners=people.filter(person=>/shareholder/i.test(String(person.person_type||""))).map(person=>String(person.full_name||"").trim()).filter(Boolean);
 if(owners.length&&!String(next.relatedPartyDisclosure?.controlText||"").trim()){next.relatedPartyDisclosure={...(next.relatedPartyDisclosure||{}),controlText:`The recorded shareholders are ${owners.join("; ")}.`};changed=true;}
 if(!changed) return state;
 next.disclosureContent=content;return next;
}
