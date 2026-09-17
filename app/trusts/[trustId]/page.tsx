"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TrustShell from "../_shell";
import { loadTrust, loadTrustParties, TrustParty, TrustRecord, ui } from "../_lib";

export default function TrustOverviewPage(){
 const params=useParams<{trustId:string}>(); const trustId=String(params.trustId); const [trust,setTrust]=useState<TrustRecord|null>(null); const [parties,setParties]=useState<TrustParty[]>([]); const [error,setError]=useState('');
 useEffect(()=>{(async()=>{try{const r=await loadTrust(trustId); setTrust(r.trust); setParties(await loadTrustParties(trustId,r.context.organisationId));}catch(e){setError(e instanceof Error?e.message:'Could not load trust.')}})()},[trustId]);
 const counts=useMemo(()=>({founders:parties.filter(p=>p.role_founder).length, trustees:parties.filter(p=>p.role_trustee||p.role_independent_trustee).length, independent:parties.filter(p=>p.role_independent_trustee).length, beneficiaries:parties.filter(p=>p.role_beneficiary).length}),[parties]);
 if(!trust) return <div style={ui.page}>{error?<div style={ui.error}>{error}</div>:'Loading…'}</div>;
 const ready=counts.founders>0&&counts.trustees>=2&&counts.independent>0&&counts.beneficiaries>0;
 return <TrustShell trustId={trustId} trustName={trust.name}>{error?<div style={ui.error}>{error}</div>:null}
 <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',border:'1px solid #d7e0df',background:'#fff',marginBottom:16}}>{[['Founders',counts.founders],['Trustees',counts.trustees],['Independent',counts.independent],['Beneficiaries',counts.beneficiaries]].map(([l,v])=><div key={String(l)} style={{padding:14,borderRight:'1px solid #e7eceb'}}><div style={{fontSize:11,color:'#687582',fontWeight:800}}>{l}</div><div style={{fontSize:25,fontWeight:900,marginTop:2}}>{v}</div></div>)}</div>
 <section style={ui.panel}><div style={ui.panelHeader}>Registration readiness</div><div style={ui.panelBody}><div style={ready?ui.success:ui.error}>{ready?'Core deed parties are captured. You can move to the Trust Deed and Registration Pack.':'Complete founder, trustee, independent trustee and beneficiary information before finalising the deed.'}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link href={`/trusts/${trustId}/people`} style={ui.secondary}>People & Roles</Link><Link href={`/trusts/${trustId}/deed`} style={ui.primary}>Open Trust Deed</Link></div></div></section>
 <section style={ui.panel}><div style={ui.panelHeader}>Trust details</div><div style={ui.panelBody}><table style={ui.table}><tbody><tr><td style={ui.td}>Type</td><td style={ui.td}><strong>{trust.trust_type}</strong></td></tr><tr><td style={ui.td}>Master's office</td><td style={ui.td}>{trust.masters_office||'—'}</td></tr><tr><td style={ui.td}>Status</td><td style={ui.td}>{trust.status}</td></tr><tr><td style={ui.td}>Registration number</td><td style={ui.td}>{trust.registration_number||'Not yet registered'}</td></tr></tbody></table></div></section>
 </TrustShell>;
}
