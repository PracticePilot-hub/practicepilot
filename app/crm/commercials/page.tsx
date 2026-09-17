"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type CommercialTerms = {
  id?: string;
  commercial_model: string;
  core_fee_amount: number | null;
  billing_frequency: string | null;
  default_hourly_rate: number | null;
  effective_from: string | null;
  effective_to: string | null;
  billing_day: number | null;
  vat_treatment: string | null;
  notes: string | null;
};

type CommercialRow = {
  id: string;
  client_name: string;
  client_code: string | null;
  entity_type: string | null;
  relationship_status: string | null;
  engagement_type: string | null;
  commercial_terms: CommercialTerms | null;
};

type DraftRow = {
  commercialModel: string;
  coreFeeAmount: string;
  billingFrequency: string;
  defaultHourlyRate: string;
  effectiveFrom: string;
  effectiveTo: string;
  billingDay: string;
  vatTreatment: string;
  notes: string;
};

function blankDraft(): DraftRow {
  return {
    commercialModel: "monthly_retainer",
    coreFeeAmount: "",
    billingFrequency: "monthly",
    defaultHourlyRate: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    billingDay: "",
    vatTreatment: "exclusive",
    notes: "",
  };
}

function toDraft(row: CommercialRow): DraftRow {
  const terms = row.commercial_terms;
  if (!terms) return blankDraft();

  return {
    commercialModel: terms.commercial_model || "monthly_retainer",
    coreFeeAmount:
      terms.core_fee_amount == null ? "" : String(terms.core_fee_amount),
    billingFrequency: terms.billing_frequency || "",
    defaultHourlyRate:
      terms.default_hourly_rate == null
        ? ""
        : String(terms.default_hourly_rate),
    effectiveFrom:
      terms.effective_from || new Date().toISOString().slice(0, 10),
    effectiveTo: terms.effective_to || "",
    billingDay:
      terms.billing_day == null ? "" : String(terms.billing_day),
    vatTreatment: terms.vat_treatment || "exclusive",
    notes: terms.notes || "",
  };
}

export default function ClientCommercialsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<CommercialRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function token() {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error("You are not signed in.");
    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const accessToken = await token();

      const response = await fetch("/api/crm/commercials", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Could not load Client Commercials.");
      }

      const loaded = (data.rows || []) as CommercialRow[];
      setRows(loaded);

      const nextDrafts: Record<string, DraftRow> = {};
      for (const row of loaded) {
        nextDrafts[row.id] = toDraft(row);
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load Client Commercials."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function patch(clientId: string, change: Partial<DraftRow>) {
    setDrafts((current) => ({
      ...current,
      [clientId]: {
        ...(current[clientId] || blankDraft()),
        ...change,
      },
    }));
  }

  async function save(clientId: string) {
    const draft = drafts[clientId] || blankDraft();

    setSavingId(clientId);
    setError("");
    setMessage("");

    try {
      const accessToken = await token();

      const response = await fetch("/api/crm/commercials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientId,
          ...draft,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Could not save commercial terms.");
      }

      const client = rows.find((row) => row.id === clientId);
      setMessage(`${client?.client_name || "Client"} saved.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save commercial terms."
      );
    } finally {
      setSavingId("");
    }
  }

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const draft = drafts[row.id] || blankDraft();

      if (!term) return true;

      return [
        row.client_name,
        row.client_code,
        row.entity_type,
        draft.commercialModel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [rows, drafts, search, modelFilter]);

  return (
    <main style={page}>
      <section style={workingBar}>
        <strong style={workingTitle}>Client Commercials</strong>
        <span style={divider}>|</span>
        <span>Quick Entry</span>
        <span style={divider}>|</span>
        <span style={muted}>
          Restricted commercial information for Flying Clients
        </span>
      </section>

      <section style={header}>
        <div>
          <h1 style={title}>Client Commercials</h1>
          <p style={subtitle}>
            Maintain fee basis and billing terms without opening each client file.
          </p>
        </div>

        <button type="button" style={secondaryButton} onClick={() => void load()}>
          Refresh
        </button>
      </section>

      {error ? <div style={errorBar}>{error}</div> : null}
      {message ? <div style={messageBar}>{message}</div> : null}

      <section style={filters}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search client..."
          style={searchInput}
        />

        <div style={countText}>
          {loading ? "Loading..." : `${filteredRows.length} clients`}
        </div>
      </section>

      <section style={panel}>
        <div style={tableHeader}>
          <span>Client</span>
          <span>Core Fee</span>
          <span>Frequency</span>
          <span>Optional Hourly Rate</span>
          <span>Effective From</span>
          <span>Billing Day</span>
          <span />
        </div>

        {loading ? (
          <div style={empty}>Loading client commercials...</div>
        ) : filteredRows.length ? (
          filteredRows.map((row) => {
            const draft = drafts[row.id] || blankDraft();

            return (
              <div key={row.id}>
                <div style={tableRow}>
                  <div>
                    <strong style={clientName}>{row.client_name}</strong>
                    <div style={clientMeta}>
                      {row.client_code || "No code"}
                      {row.entity_type ? ` · ${row.entity_type}` : ""}
                      {` · ${draft.commercialModel.replaceAll("_", " ")}`}
                    </div>
                  </div>

                  <div style={moneyInput}>
                    <span>R</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      style={input}
                      value={draft.coreFeeAmount}
                      onChange={(event) =>
                        patch(row.id, { coreFeeAmount: event.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <select
                    style={input}
                    value={draft.billingFrequency}
                    onChange={(event) =>
                      patch(row.id, { billingFrequency: event.target.value })
                    }
                  >
                    <option value="">Select...</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="six_monthly">Six-monthly</option>
                    <option value="annual">Annual</option>
                    <option value="once_off">Once-off</option>
                    <option value="as_billed">As billed</option>
                  </select>

                  <div style={moneyInput}>
                    <span>R</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      style={input}
                      value={draft.defaultHourlyRate}
                      onChange={(event) =>
                        patch(row.id, {
                          defaultHourlyRate: event.target.value,
                        })
                      }
                      placeholder="Optional"
                    />
                  </div>

                  <input
                    type="date"
                    style={input}
                    value={draft.effectiveFrom}
                    onChange={(event) =>
                      patch(row.id, { effectiveFrom: event.target.value })
                    }
                  />

                  <input
                    type="number"
                    min="1"
                    max="31"
                    style={input}
                    value={draft.billingDay}
                    onChange={(event) =>
                      patch(row.id, { billingDay: event.target.value })
                    }
                    placeholder="—"
                  />

                  <div style={rowActions}>
                    <button
                      type="button"
                      style={detailsButton}
                      onClick={() => router.push(`/crm/commercials/${row.id}`)}
                    >
                      Details
                    </button>

                    <button
                      type="button"
                      style={saveButton}
                      disabled={savingId === row.id}
                      onClick={() => void save(row.id)}
                    >
                      {savingId === row.id ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        ) : (
          <div style={empty}>No Flying Clients match the current filter.</div>
        )}
      </section>

      <div style={footNote}>
        <strong>Quick-entry screen:</strong> capture the fee basis fast.
        Use <strong>Details</strong> for service-level inclusions, separately
        billable work and scope notes.
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "8px 10px 28px",
  background: "#eef2f5",
  color: "#10233a",
};

const workingBar: React.CSSProperties = {
  minHeight: "36px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
  fontSize: "9px",
};

const workingTitle: React.CSSProperties = {
  color: "#1758d5",
  fontWeight: 900,
};

const divider: React.CSSProperties = { color: "#94a3b8" };
const muted: React.CSSProperties = { color: "#64748b" };

const header: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "68px",
  padding: "9px 11px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: "10px",
};

const filters: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(320px, 1fr) auto",
  gap: "8px",
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const searchInput: React.CSSProperties = {
  height: "30px",
  padding: "0 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
};

const filterSelect: React.CSSProperties = {
  ...searchInput,
};

const countText: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 800,
};

const panel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
  overflowX: "hidden",
};

const tableHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(240px, 1.65fr) minmax(120px, .78fr) minmax(130px, .82fr) minmax(145px, .95fr) minmax(135px, .88fr) minmax(90px, .58fr) 118px",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 850,
};

const tableRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(240px, 1.65fr) minmax(120px, .78fr) minmax(130px, .82fr) minmax(145px, .95fr) minmax(135px, .88fr) minmax(90px, .58fr) 118px",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const clientName: React.CSSProperties = {
  fontSize: "9.5px",
  fontWeight: 900,
};

const clientMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7.5px",
};

const input: React.CSSProperties = {
  width: "100%",
  height: "28px",
  padding: "0 6px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8px",
  minWidth: 0,
};

const moneyInput: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "14px minmax(0,1fr)",
  gap: "3px",
  alignItems: "center",
  color: "#64748b",
  fontSize: "8px",
};

const saveButton: React.CSSProperties = {
  height: "28px",
  padding: "0 8px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 900,
  cursor: "pointer",
};

const rowActions: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "4px",
};

const detailsButton: React.CSSProperties = {
  height: "28px",
  padding: "0 6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const empty: React.CSSProperties = {
  padding: "18px 10px",
  color: "#64748b",
  fontSize: "9px",
};

const errorBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: "9px",
  fontWeight: 800,
};

const messageBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "9px",
  fontWeight: 800,
};

const footNote: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  borderLeft: "3px solid #1758d5",
  background: "#f4f8fc",
  color: "#526174",
  fontSize: "9px",
};
