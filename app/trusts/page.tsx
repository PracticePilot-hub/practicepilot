"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTrustContext, supabaseAny, TrustRecord, ui } from "./_lib";

export default function TrustsPage() {
  const [rows, setRows] = useState<TrustRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true); setError("");
      try {
        const ctx = await getTrustContext();
        const { data, error } = await supabaseAny.from("pp_trusts").select("*").eq("organisation_id", ctx.organisationId).order("created_at", { ascending: false });
        if (error) throw error;
        setRows((data || []) as TrustRecord[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load trusts.");
      } finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <div style={ui.page}>
      <div style={ui.hero}>
        <div>
          <div style={ui.eyebrow}>Private module</div>
          <h1 style={ui.h1}>Trusts</h1>
          <p style={ui.sub}>Create, prepare and register inter vivos family trusts.</p>
        </div>
        <Link href="/trusts/new" style={ui.primary}>+ New Trust</Link>
      </div>
      {error ? <div style={ui.error}>{error}</div> : null}
      <section style={ui.panel}>
        <div style={ui.panelHeader}>Trust register</div>
        {loading ? <div style={ui.panelBody}>Loading…</div> : rows.length === 0 ? (
          <div style={ui.panelBody}>No trusts yet. Create the first trust to start the registration file.</div>
        ) : (
          <table style={ui.table}><thead><tr><th style={ui.th}>Trust</th><th style={ui.th}>Master's office</th><th style={ui.th}>Status</th><th style={ui.th}>Registration</th><th style={ui.th}></th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td style={ui.td}><strong>{row.name}</strong><div style={{color:'#6b7780',marginTop:3}}>{row.trust_type}</div></td><td style={ui.td}>{row.masters_office || "—"}</td><td style={ui.td}>{row.status}</td><td style={ui.td}>{row.registration_number || "Not registered"}</td><td style={ui.td}><Link href={`/trusts/${row.id}`} style={ui.secondary}>Open</Link></td></tr>)}</tbody></table>
        )}
      </section>
    </div>
  );
}
