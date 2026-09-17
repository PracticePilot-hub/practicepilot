"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getTrustContext, supabaseAny, ui } from "../_lib";

export default function NewTrustPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", trust_type: "Inter Vivos Family Trust", masters_office: "Pretoria", initial_donation: "100", physical_line1: "", physical_line2: "", physical_city: "", physical_province: "Gauteng", physical_postal_code: "", postal_line1: "", postal_line2: "", postal_city: "", postal_province: "Gauteng", postal_postal_code: "" });
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const copyAddress = () => setForm((f) => ({ ...f, postal_line1:f.physical_line1, postal_line2:f.physical_line2, postal_city:f.physical_city, postal_province:f.physical_province, postal_postal_code:f.physical_postal_code }));

  async function save() {
    setError("");
    if (!form.name.trim()) return setError("Please enter the trust name.");
    setSaving(true);
    try {
      const ctx = await getTrustContext();
      const { data, error } = await supabaseAny.from("pp_trusts").insert({ ...form, name: form.name.trim(), initial_donation: Number(form.initial_donation || 100), organisation_id: ctx.organisationId, created_by_user_id: ctx.userId, status: "Draft" }).select("id").single();
      if (error) throw error;
      router.push(`/trusts/${data.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create trust."); setSaving(false); }
  }

  return <div style={ui.page}>
    <div style={ui.hero}><div><div style={ui.eyebrow}>Trusts</div><h1 style={ui.h1}>New Trust</h1><p style={ui.sub}>Capture the trust once. The deed and registration pack will use the same data.</p></div><Link href="/trusts" style={ui.secondary}>Cancel</Link></div>
    {error ? <div style={ui.error}>{error}</div> : null}
    <section style={ui.panel}><div style={ui.panelHeader}>Trust information</div><div style={ui.panelBody}>
      <div style={ui.grid2}>
        <label style={ui.label}>Trust name<input style={ui.input} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Smith Family Trust" /></label>
        <label style={ui.label}>Type of trust<select style={ui.input} value={form.trust_type} onChange={e=>set('trust_type',e.target.value)}><option>Inter Vivos Family Trust</option><option>Inter Vivos Business Trust</option></select></label>
        <label style={ui.label}>Master's office<input style={ui.input} value={form.masters_office} onChange={e=>set('masters_office',e.target.value)} /></label>
        <label style={ui.label}>Initial donation (R)<input style={ui.input} type="number" value={form.initial_donation} onChange={e=>set('initial_donation',e.target.value)} /></label>
      </div>
    </div></section>
    <section style={ui.panel}><div style={ui.panelHeader}>Addresses</div><div style={ui.panelBody}><div style={ui.grid2}>
      <div><strong>Physical address</strong><div style={{display:'grid',gap:8,marginTop:10}}>{[['physical_line1','Address line 1'],['physical_line2','Address line 2'],['physical_city','City / town'],['physical_province','Province'],['physical_postal_code','Postal code']].map(([k,l])=><label key={k} style={ui.label}>{l}<input style={ui.input} value={(form as any)[k]} onChange={e=>set(k,e.target.value)} /></label>)}</div></div>
      <div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>Postal address</strong><button type="button" onClick={copyAddress} style={ui.secondary}>Copy physical</button></div><div style={{display:'grid',gap:8,marginTop:10}}>{[['postal_line1','Address line 1'],['postal_line2','Address line 2'],['postal_city','City / town'],['postal_province','Province'],['postal_postal_code','Postal code']].map(([k,l])=><label key={k} style={ui.label}>{l}<input style={ui.input} value={(form as any)[k]} onChange={e=>set(k,e.target.value)} /></label>)}</div></div>
    </div></div></section>
    <button type="button" onClick={save} disabled={saving} style={ui.primary}>{saving ? 'Creating…' : 'Create trust file'}</button>
  </div>;
}
