"use client";
import { useState } from "react";
import { RELATED_PARTY_CATEGORIES, normaliseRelatedPartyAccountLinks, relatedPartyAccountKey, relatedPartyCandidates, relatedPartyReviewIssues, type RelatedPartyAccountLink } from "./afsRelatedPartyDisclosure";

type Props = {state: Record<string,any>; lines: any[]; framework: "smes" | "full"; update: (path:string[],value:any)=>void};
export default function AfsRelatedPartyAccountEditor({state,lines,framework,update}: Props) {
  const [search,setSearch] = useState("");
  const [all,setAll] = useState(false);
  const links: RelatedPartyAccountLink[] = normaliseRelatedPartyAccountLinks(state.relatedPartyAccounts || [],lines);
  const meta = state.relatedPartyDisclosure || {};
  const candidates = new Set(relatedPartyCandidates(lines).map(relatedPartyAccountKey));
  const selected = new Set(links.map(link=>link.accountKey));
  const shown = lines.filter(line => (all || candidates.has(relatedPartyAccountKey(line)) || selected.has(relatedPartyAccountKey(line))) &&
    `${line.account_code || ""} ${line.account_name || ""}`.toLowerCase().includes(search.toLowerCase()));
  const input = {fontSize:11,padding:5,border:"1px solid #94a3b8",width:"100%",minWidth:0};
  const change = (key:string,field:string,value:any) => update(["relatedPartyAccounts"],links.map(link=>link.accountKey===key?{...link,[field]:value}:link));
  const periods = ["current","prior"] as const;
  const kmp = framework==="full" ? [["shortTerm","Short-term benefits"],["postEmployment","Post-employment benefits"],["otherLongTerm","Other long-term benefits"],["termination","Termination benefits"],["shareBased","Share-based payment"]] : [["total","Key-management compensation — total"]];
  return <div data-work-only="true" style={{border:"1px solid #94a3b8",padding:10,display:"grid",gap:9,background:"#f8fafc"}}>
    <strong>Related-party accounts and disclosure review</strong>
    <a href={framework==="full"?"https://www.ifrs.org/issued-standards/list-of-standards/ias-24-related-party-disclosures/":"https://www.ifrs.org/content/dam/ifrs/supporting-implementation/smes/2026-modules/module-33.pdf"} target="_blank" rel="noreferrer">{framework==="full"?"IAS 24":"IFRS for SMEs — Section 33"}</a>
    <p style={{margin:0,fontSize:11}}>Tick an account, identify the counterparty and relationship, then confirm whether its entire closing balance belongs to that party. Mixed accounts require an allocation below. This does not change the account mapping. Annual transaction amounts, guarantees and compensation need their own evidence.</p>
    <label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Show all TB accounts (including customers, suppliers and expenses)</label>
    <input aria-label="Find related-party account" placeholder="Find account number or description" value={search} onChange={e=>setSearch(e.target.value)} style={input}/>
    <div style={{maxHeight:390,overflow:"auto",display:"grid",gap:7}}>
      {shown.map(line=>{const key=relatedPartyAccountKey(line),link=links.find(item=>item.accountKey===key);return <div key={key} style={{border:"1px solid #cbd5e1",padding:7,display:"grid",gap:6}}>
        <label><input type="checkbox" aria-label={`Related party: ${line.account_code} ${line.account_name}`} checked={!!link} onChange={e=>update(["relatedPartyAccounts"],e.target.checked?[...links,{accountKey:key,name:"",relationship:"",category:"other",kind:"receivable",wholeAccount:false}]:links.filter(item=>item.accountKey!==key))}/>{" "}{line.account_code} · {line.account_name}</label>
        {link && <>
          <label><input type="checkbox" checked={!!link.eliminated} onChange={e=>change(key,"eliminated",e.target.checked)}/> Eliminated within this consolidated group</label>
          {link.eliminated && <label>Consolidation elimination explanation<input value={link.eliminationReason||""} onChange={e=>change(key,"eliminationReason",e.target.value)} style={input}/></label>}
          <label>Counterparty<input aria-label={`Counterparty ${line.account_code}`} value={link.name} onChange={e=>change(key,"name",e.target.value)} style={input}/></label>
          <label>Relationship and basis<input value={link.relationship} placeholder="Explain control, influence, management or family relationship" onChange={e=>change(key,"relationship",e.target.value)} style={input}/></label>
          <label>Disclosure category<select value={link.category} onChange={e=>change(key,"category",e.target.value)} style={input}>{RELATED_PARTY_CATEGORIES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>Account use<select value={link.kind} onChange={e=>change(key,"kind",e.target.value)} style={input}><option value="receivable">Amount receivable</option><option value="payable">Amount payable</option><option value="transaction">Annual transactions — capture amounts separately</option></select></label>
          {[["terms","Terms and repayment"],["interest","Interest basis"],["security","Security"],["commitments","Guarantees, commitments or support"],["impairment","Related receivable impairment allowance (current / prior)"],["badDebtExpense","Bad or doubtful debt expense (current / prior)"]].map(([field,label])=><label key={field}>{label}<input value={String((link as any)[field] || "")} onChange={e=>change(key,field,e.target.value)} style={input}/></label>)}
          <label><input type="checkbox" checked={link.wholeAccount} onChange={e=>change(key,"wholeAccount",e.target.checked)}/> Entire closing balance belongs to this party</label>
          <p style={{margin:0,fontSize:10}}>Keep amounts receivable and payable separate. A shared account can cover several parties; use supported manual allocations.</p>
        </>}
      </div>})}
      {!shown.length && <p>No accounts in this view. Use “Show all TB accounts” to assess other accounts.</p>}
    </div>
    <label>Parent and ultimate controlling party / control explanation<textarea aria-label="Controlling party disclosure" value={meta.controlText || ""} onChange={e=>update(["relatedPartyDisclosure","controlText"],e.target.value)} style={input} placeholder="Name the parent and ultimate controller; explain where no parent exists. Identify the next senior parent issuing public financial statements where required."/></label>
    <label><input type="checkbox" checked={!!meta.controlReviewed} onChange={e=>update(["relatedPartyDisclosure","controlReviewed"],e.target.checked)}/> Control relationships assessed, including relationships without transactions</label>
    <table style={{width:"100%",fontSize:11}}><thead><tr><th style={{textAlign:"left"}}>Compensation / services</th><th>Current</th><th>Prior</th></tr></thead><tbody>
      {[...kmp,["managementFees","Services from a separate management entity"]].map(([key,label])=><tr key={key}><td>{label}</td>{periods.map(side=><td key={side}><input aria-label={`${label} ${side}`} inputMode="decimal" value={meta.kmp?.[key]?.[side] ?? ""} onChange={e=>update(["relatedPartyDisclosure","kmp",key,side],e.target.value)} style={input}/></td>)}</tr>)}
    </tbody></table>
    <label><input type="checkbox" checked={!!meta.kmpReviewed} onChange={e=>update(["relatedPartyDisclosure","kmpReviewed"],e.target.checked)}/> Key-management compensation and management-entity fees assessed</label>
    <label><input type="checkbox" checked={!!meta.termsReviewed} onChange={e=>update(["relatedPartyDisclosure","termsReviewed"],e.target.checked)}/> Terms, security, guarantees, commitments and impairment disclosures assessed</label>
    <label><input type="checkbox" checked={!!meta.populationReviewed} onChange={e=>update(["relatedPartyDisclosure","populationReviewed"],e.target.checked)}/> Complete population assessed, including parties without TB accounts and transactions at no charge</label>
    <label>Other disclosures / explanations<textarea value={meta.extraText || ""} onChange={e=>update(["relatedPartyDisclosure","extraText"],e.target.value)} style={input}/></label>
    {relatedPartyReviewIssues(state,lines,framework).map(issue=><p key={issue} style={{margin:0,color:"#9f1239",fontSize:11}}>{issue}</p>)}
  </div>;
}
