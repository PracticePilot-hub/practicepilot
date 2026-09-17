"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type ActiveService = {
  client_service_id: string;
  service_name: string;
  service_group: string | null;
  tasking_frequency: string | null;
};

type ServiceTerm = {
  id?: string;
  client_service_id: string | null;
  service_name: string;
  billing_treatment: string;
  fee_amount: number | null;
  hourly_rate: number | null;
  fee_frequency: string | null;
  scope_notes: string | null;
};

type Draft = {
  billingTreatment: string;
  feeAmount: string;
  hourlyRate: string;
  feeFrequency: string;
  scopeNotes: string;
};

function blank(): Draft {
  return {
    billingTreatment: "included",
    feeAmount: "",
    hourlyRate: "",
    feeFrequency: "",
    scopeNotes: "",
  };
}

export default function CommercialDetailPage() {
  const params = useParams();
  const clientId = String(params?.id || "");

  const [client, setClient] = useState<any>(null);
  const [terms, setTerms] = useState<any>(null);
  const [services, setServices] = useState<ActiveService[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function accessToken() {
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
      const token = await accessToken();

      const response = await fetch(
        `/api/crm/clients/${encodeURIComponent(clientId)}/commercial-terms`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Could not load commercial details.");
      }

      setClient(data.client || null);
      setTerms(data.terms || null);
      setServices(data.activeServices || []);

      const termByServiceId = new Map<string, ServiceTerm>(
        (data.serviceTerms || []).map((row: ServiceTerm) => [
          String(row.client_service_id || ""),
          row,
        ])
      );

      const nextDrafts: Record<string, Draft> = {};

      for (const service of data.activeServices || []) {
        const existing = termByServiceId.get(service.client_service_id);

        nextDrafts[service.client_service_id] = existing
          ? {
              billingTreatment:
                existing.billing_treatment || "included",
              feeAmount:
                existing.fee_amount == null
                  ? ""
                  : String(existing.fee_amount),
              hourlyRate:
                existing.hourly_rate == null
                  ? ""
                  : String(existing.hourly_rate),
              feeFrequency: existing.fee_frequency || "",
              scopeNotes: existing.scope_notes || "",
            }
          : blank();
      }

      setDrafts(nextDrafts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load commercial details."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (clientId) void load();
  }, [clientId]);

  function patch(serviceId: string, change: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [serviceId]: {
        ...(current[serviceId] || blank()),
        ...change,
      },
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const token = await accessToken();

      const serviceTerms = services.map((service) => ({
        clientServiceId: service.client_service_id,
        serviceName: service.service_name,
        ...(drafts[service.client_service_id] || blank()),
      }));

      const response = await fetch(
        `/api/crm/clients/${encodeURIComponent(clientId)}/commercial-terms`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ serviceTerms }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error || "Could not save service commercial terms."
        );
      }

      setMessage("Commercial service rules saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save service commercial terms."
      );
    } finally {
      setSaving(false);
    }
  }

  const includedCount = useMemo(
    () =>
      services.filter(
        (service) =>
          (drafts[service.client_service_id] || blank()).billingTreatment ===
          "included"
      ).length,
    [services, drafts]
  );

  const billableCount = services.length - includedCount;

  if (loading) {
    return <main style={page}>Loading commercial details...</main>;
  }

  return (
    <main style={page}>
      <section style={workingBar}>
        <Link href="/crm/commercials" style={backLink}>
          Client Commercials
        </Link>
        <span style={divider}>›</span>
        <span>{client?.client_name || "Client"}</span>
        <span style={divider}>|</span>
        <span style={muted}>Service-level commercial rules</span>
      </section>

      <section style={header}>
        <div>
          <h1 style={title}>{client?.client_name || "Client"}</h1>
          <p style={subtitle}>
            Decide what the core fee covers and what should create Billable WIP.
          </p>
        </div>

        <div style={headerActions}>
          <Link href="/crm/commercials" style={secondaryLink}>
            Back
          </Link>

          <button
            type="button"
            style={saveButton}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving..." : "Save Rules"}
          </button>
        </div>
      </section>

      {error ? <div style={errorBar}>{error}</div> : null}
      {message ? <div style={messageBar}>{message}</div> : null}

      <section style={summaryStrip}>
        <div style={summaryCell}>
          <span style={summaryLabel}>Commercial model</span>
          <strong style={summaryValue}>
            {String(terms?.commercial_model || "Not set").replaceAll("_", " ")}
          </strong>
        </div>

        <div style={summaryCell}>
          <span style={summaryLabel}>Core fee</span>
          <strong style={summaryValue}>
            {terms?.core_fee_amount == null
              ? "—"
              : `R ${Number(terms.core_fee_amount).toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                })}`}
          </strong>
        </div>

        <div style={summaryCell}>
          <span style={summaryLabel}>Included services</span>
          <strong style={summaryValue}>{includedCount}</strong>
        </div>

        <div style={summaryCell}>
          <span style={summaryLabel}>Separately billable</span>
          <strong style={summaryValue}>{billableCount}</strong>
        </div>
      </section>

      <section style={infoBar}>
        <strong>Rule:</strong>
        <span>
          Included work becomes Delivery WIP / profitability data. Separately
          billed, hourly or fixed-fee work can create Billable WIP.
        </span>
      </section>

      <section style={panel}>
        <div style={tableHeader}>
          <span>Service</span>
          <span>Billing treatment</span>
          <span>Fee / amount</span>
          <span>Hourly rate</span>
          <span>Frequency</span>
          <span>Scope notes</span>
        </div>

        {services.length ? (
          services.map((service) => {
            const draft = drafts[service.client_service_id] || blank();

            return (
              <div key={service.client_service_id} style={tableRow}>
                <div>
                  <strong style={serviceName}>{service.service_name}</strong>
                  <div style={serviceMeta}>
                    Tasking: {service.tasking_frequency || "—"}
                    {service.service_group
                      ? ` · ${service.service_group}`
                      : ""}
                  </div>
                </div>

                <select
                  style={input}
                  value={draft.billingTreatment}
                  onChange={(event) =>
                    patch(service.client_service_id, {
                      billingTreatment: event.target.value,
                    })
                  }
                >
                  <option value="included">Included in core fee</option>
                  <option value="separately_billed">
                    Separately billed
                  </option>
                  <option value="hourly">Hourly</option>
                  <option value="fixed_fee">Fixed fee</option>
                  <option value="not_chargeable">Not chargeable</option>
                </select>

                <div style={moneyInput}>
                  <span>R</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={input}
                    value={draft.feeAmount}
                    onChange={(event) =>
                      patch(service.client_service_id, {
                        feeAmount: event.target.value,
                      })
                    }
                    placeholder="Optional"
                  />
                </div>

                <div style={moneyInput}>
                  <span>R</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={input}
                    value={draft.hourlyRate}
                    onChange={(event) =>
                      patch(service.client_service_id, {
                        hourlyRate: event.target.value,
                      })
                    }
                    placeholder="Optional"
                  />
                </div>

                <select
                  style={input}
                  value={draft.feeFrequency}
                  onChange={(event) =>
                    patch(service.client_service_id, {
                      feeFrequency: event.target.value,
                    })
                  }
                >
                  <option value="">Use client default</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="six_monthly">Six-monthly</option>
                  <option value="annual">Annual</option>
                  <option value="once_off">Once-off</option>
                  <option value="as_billed">As billed</option>
                </select>

                <input
                  style={input}
                  value={draft.scopeNotes}
                  onChange={(event) =>
                    patch(service.client_service_id, {
                      scopeNotes: event.target.value,
                    })
                  }
                  placeholder="Included / excluded scope..."
                />
              </div>
            );
          })
        ) : (
          <div style={empty}>
            This client has no active Tasking Setup services yet.
          </div>
        )}
      </section>
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
  gap: "7px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
  fontSize: "9px",
};

const backLink: React.CSSProperties = {
  color: "#1758d5",
  textDecoration: "none",
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

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: "6px",
};

const secondaryLink: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 850,
};

const saveButton: React.CSSProperties = {
  height: "30px",
  padding: "0 11px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const summaryStrip: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const summaryCell: React.CSSProperties = {
  minHeight: "50px",
  padding: "7px 10px",
  display: "grid",
  alignContent: "center",
  borderRight: "1px solid #e5eaf0",
};

const summaryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 800,
};

const summaryValue: React.CSSProperties = {
  marginTop: "2px",
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 900,
  textTransform: "capitalize",
};

const infoBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  display: "flex",
  gap: "6px",
  borderLeft: "3px solid #1758d5",
  background: "#f4f8fc",
  color: "#526174",
  fontSize: "9px",
};

const panel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const tableHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(220px,1.3fr) minmax(160px,1fr) 125px 125px 140px minmax(220px,1.4fr)",
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
    "minmax(220px,1.3fr) minmax(160px,1fr) 125px 125px 140px minmax(220px,1.4fr)",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const serviceName: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 900,
};

const serviceMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7.5px",
};

const input: React.CSSProperties = {
  width: "100%",
  height: "28px",
  padding: "0 6px",
  boxSizing: "border-box",
  minWidth: 0,
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8px",
};

const moneyInput: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "14px minmax(0,1fr)",
  gap: "3px",
  alignItems: "center",
  color: "#64748b",
  fontSize: "8px",
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
