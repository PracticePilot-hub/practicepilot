// Path: app/compliance/paia/page.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PaiaManual = {
  id: string;
  entity_name: string;
  entity_registration_number: string | null;
  entity_type: string | null;
  date_compiled: string | null;
  status: string | null;
};

type NewManualForm = {
  entity_name: string;
  entity_registration_number: string;
  entity_type: string;
  date_compiled: string;
  information_officer_name: string;
  information_officer_email: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyForm: NewManualForm = {
  entity_name: "",
  entity_registration_number: "",
  entity_type: "Private Company",
  date_compiled: today,
  information_officer_name: "",
  information_officer_email: "",
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 48px)",
    background: "#f3f7fb",
    padding: "36px",
    color: "#0f172a",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  hero: {
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 18,
    padding: "30px 32px",
    marginBottom: 26,
  },
  eyebrow: {
    margin: 0,
    color: "#1769e0",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  title: {
    margin: "12px 0 0",
    fontSize: 34,
    fontWeight: 500,
    lineHeight: 1.1,
    color: "#0f172a",
  },
  sub: {
    margin: "14px 0 0",
    fontSize: 16,
    color: "#667085",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "440px 1fr",
    gap: 26,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 18,
    overflow: "hidden",
  },
  cardBody: { padding: 24 },
  h2: { margin: 0, fontSize: 22, fontWeight: 600, color: "#0f172a" },
  fieldWrap: { display: "block", marginTop: 18 },
  label: { display: "block", marginBottom: 8, fontSize: 13, fontWeight: 800, color: "#25364d" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: 46,
    border: "1px solid #cfd8e3",
    borderRadius: 12,
    padding: "0 14px",
    fontSize: 15,
    color: "#0f172a",
    outline: "none",
    background: "#ffffff",
  },
  button: {
    width: "100%",
    marginTop: 22,
    height: 46,
    border: "1px solid #1769e0",
    borderRadius: 12,
    background: "#1769e0",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    marginTop: 14,
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
  },
  listCard: { padding: 24 },
  manualRow: {
    display: "block",
    border: "1px solid #d8e2ee",
    borderRadius: 16,
    padding: "18px 20px",
    textDecoration: "none",
    color: "inherit",
    marginTop: 16,
    background: "#ffffff",
  },
  manualName: { margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" },
  manualMeta: { marginTop: 7, fontSize: 14, color: "#667085" },
  status: {
    float: "right",
    borderRadius: 999,
    background: "#eef4ff",
    color: "#1769e0",
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 800,
  },
  empty: {
    marginTop: 18,
    border: "1px dashed #cfd8e3",
    borderRadius: 14,
    padding: 18,
    color: "#667085",
    fontSize: 14,
  },
};

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function PaiaManualsPage() {
  const [manuals, setManuals] = useState<PaiaManual[]>([]);
  const [form, setForm] = useState<NewManualForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadManuals() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/paia/manuals", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load PAIA manuals.");
      setManuals(json.manuals ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Could not load PAIA manuals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadManuals();
  }, []);

  function updateField(field: keyof NewManualForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.entity_name.trim()) {
      setError("Entity name is required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/paia/manuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          manual_name: `${form.entity_name.trim()} PAIA Manual`,
          information_officer_position: "Information Officer",
          next_review_date: "",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create PAIA manual.");

      if (json.manual?.id) window.location.href = `/compliance/paia/${json.manual.id}`;
      else await loadManuals();
    } catch (err: any) {
      setError(err?.message ?? "Could not create PAIA manual.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={s.page}>
      <section style={s.hero}>
        <p style={s.eyebrow}>PracticePilot</p>
        <h1 style={s.title}>PAIA Manuals</h1>
        <p style={s.sub}>
          Create and manage PAIA / POPIA manuals, records, information processing, security measures and sign-off.
        </p>
      </section>

      <section style={s.grid}>
        <form onSubmit={createManual} style={s.card}>
          <div style={s.cardBody}>
            <h2 style={s.h2}>New PAIA manual</h2>

            <Field label="Entity name" value={form.entity_name} onChange={(value) => updateField("entity_name", value)} placeholder="Example: ABC Trading (Pty) Ltd" required />
            <Field label="Registration number" value={form.entity_registration_number} onChange={(value) => updateField("entity_registration_number", value)} placeholder="Optional" />
            <Field label="Entity type" value={form.entity_type} onChange={(value) => updateField("entity_type", value)} />
            <Field label="Date compiled" type="date" value={form.date_compiled} onChange={(value) => updateField("date_compiled", value)} />
            <Field label="Information Officer" value={form.information_officer_name} onChange={(value) => updateField("information_officer_name", value)} placeholder="Optional" />
            <Field label="Information Officer email" value={form.information_officer_email} onChange={(value) => updateField("information_officer_email", value)} placeholder="Optional" />

            {error ? <div style={s.error}>{error}</div> : null}

            <button type="submit" disabled={creating} style={{ ...s.button, opacity: creating ? 0.65 : 1 }}>
              {creating ? "Creating..." : "Create PAIA manual"}
            </button>
          </div>
        </form>

        <section style={s.card}>
          <div style={s.listCard}>
            <h2 style={s.h2}>Existing manuals</h2>

            {loading ? (
              <div style={s.empty}>Loading PAIA manuals...</div>
            ) : manuals.length === 0 ? (
              <div style={s.empty}>No PAIA manuals created yet.</div>
            ) : (
              manuals.map((manual) => (
                <Link key={manual.id} href={`/compliance/paia/${manual.id}`} style={s.manualRow}>
                  <span style={s.status}>{manual.status || "Draft"}</span>
                  <h3 style={s.manualName}>{manual.entity_name}</h3>
                  <div style={s.manualMeta}>
                    {manual.entity_type || "Entity"} · {manual.entity_registration_number || "No registration number"} · Compiled {formatDate(manual.date_compiled)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label style={s.fieldWrap}>
      <span style={s.label}>{label}</span>
      <input type={type} value={value} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} style={s.input} />
    </label>
  );
}
