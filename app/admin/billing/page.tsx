// Path: app/admin/billing/page.tsx

"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Organisation = {
  id: string;
  name: string;
  billing_access_suspended: boolean;
  billing_suspended_at: string | null;
  billing_suspension_reason: string | null;
};

type InvoiceItem = {
  id: string;
  organisation_id: string;
  organisation_name: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string;
  status: string;
  amount: number;
  paid_at: string | null;
  suspension_override_until: string | null;
  source_system: string | null;
  external_invoice_id: string | null;
  external_invoice_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
  billing_access_suspended: boolean;
  billing_suspension_reason: string | null;
};

type BillingSummary = {
  totalInvoices: number;
  totalAmount: number;
  outstandingAmount: number;
  outstandingInvoices: number;
  paidAmount: number;
  paidInvoices: number;
  overdueAmount: number;
  overdueInvoices: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export default function PracticePilotBillingControlPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);

  const [organisationId, setOrganisationId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadBilling();
  }, [organisationId, statusFilter]);

  async function loadBilling() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const params = new URLSearchParams();

      if (organisationId) {
        params.set("organisationId", organisationId);
      }

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      const response = await fetch(
        `/api/admin/billing${params.toString() ? `?${params.toString()}` : ""}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not load billing control.");
      }

      setOrganisations(json.organisations ?? []);
      setItems(json.items ?? []);
      setSummary(json.summary ?? null);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load billing control."
      );
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(invoice: InvoiceItem) {
    const confirmed = window.confirm(
      `Mark QuickBooks invoice ${invoice.invoice_number || invoice.id} as paid?`
    );

    if (!confirmed) return;

    setSavingId(invoice.id);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "mark_paid",
          invoice_id: invoice.id,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not mark invoice as paid.");
      }

      setSuccess(
        `QuickBooks invoice ${invoice.invoice_number || invoice.id} marked as paid.`
      );

      await loadBilling();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not mark invoice as paid."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function reconcileOverdue() {
    setReconciling(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "reconcile_overdue",
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error || "Could not refresh overdue access status."
        );
      }

      setSuccess(
        `${Number(json.suspended_count || 0)} organisation(s) currently suspended for overdue billing.`
      );

      await loadBilling();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not refresh overdue access status."
      );
    } finally {
      setReconciling(false);
    }
  }

  const suspendedOrganisationCount = useMemo(
    () =>
      organisations.filter(
        (organisation) => organisation.billing_access_suspended
      ).length,
    [organisations]
  );

  return (
    <main style={s.page}>
      <section style={s.hero}>
        <div>
          <p style={s.eyebrow}>PracticePilot</p>
          <h1 style={s.title}>Billing Control</h1>
        </div>

        <div style={s.heroActions}>
          <div style={s.sub}>
            QuickBooks remains the invoice source of truth. PracticePilot tracks
            due dates, payment status and billing access.
          </div>

          <button
            type="button"
            onClick={reconcileOverdue}
            disabled={reconciling}
            style={{
              ...s.reconcileButton,
              opacity: reconciling ? 0.6 : 1,
            }}
          >
            {reconciling ? "Checking..." : "Refresh overdue status"}
          </button>
        </div>
      </section>

      {error ? <div style={s.error}>{error}</div> : null}
      {success ? <div style={s.success}>{success}</div> : null}

      <section style={s.summaryGrid}>
        <SummaryCard
          label="Outstanding"
          value={formatMoney(summary?.outstandingAmount)}
          note={`${summary?.outstandingInvoices || 0} invoice(s)`}
        />

        <SummaryCard
          label="Overdue"
          value={formatMoney(summary?.overdueAmount)}
          note={`${summary?.overdueInvoices || 0} invoice(s)`}
        />

        <SummaryCard
          label="Paid"
          value={formatMoney(summary?.paidAmount)}
          note={`${summary?.paidInvoices || 0} invoice(s)`}
        />

        <SummaryCard
          label="Suspended"
          value={String(suspendedOrganisationCount)}
          note="organisation(s)"
        />
      </section>

      <section style={s.card}>
        <div style={s.sectionHeader}>
          <div>
            <h2 style={s.h2}>Filters</h2>
            <div style={s.resultText}>
              Review all QuickBooks invoices mirrored in PracticePilot.
            </div>
          </div>

          <button
            type="button"
            style={s.secondaryButton}
            onClick={() => {
              setOrganisationId("");
              setStatusFilter("");
            }}
          >
            Clear filters
          </button>
        </div>

        <div style={s.filters}>
          <label style={s.fieldWrap}>
            <span style={s.label}>Organisation</span>
            <select
              value={organisationId}
              onChange={(event) => setOrganisationId(event.target.value)}
              style={s.input}
            >
              <option value="">All organisations</option>

              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.name}
                  {organisation.billing_access_suspended
                    ? " - SUSPENDED"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={s.fieldWrap}>
            <span style={s.label}>Invoice status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={s.input}
            >
              <option value="">All</option>
              <option value="issued">Issued / outstanding</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      </section>

      <section style={s.card}>
        <div style={s.sectionHeader}>
          <div>
            <h2 style={s.h2}>QuickBooks invoice register</h2>
            <div style={s.resultText}>
              Showing {items.length} invoice(s)
            </div>
          </div>
        </div>

        {loading ? (
          <div style={s.empty}>Loading PracticePilot billing...</div>
        ) : items.length === 0 ? (
          <div style={s.empty}>
            No QuickBooks invoice records match the selected filters.
          </div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Organisation</th>
                  <th style={s.th}>QuickBooks invoice</th>
                  <th style={s.th}>Invoice date</th>
                  <th style={s.th}>Due date</th>
                  <th style={s.th}>Status</th>
                  <th style={s.thRight}>Amount</th>
                  <th style={s.th}>Paid</th>
                  <th style={s.th}>Access</th>
                  <th style={s.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {items.map((invoice) => {
                  const status = String(invoice.status || "").toLowerCase();

                  return (
                    <tr key={invoice.id}>
                      <td style={s.tdStrong}>
                        {invoice.organisation_name}
                      </td>

                      <td style={s.td}>
                        {invoice.invoice_number || "-"}
                      </td>

                      <td style={s.td}>
                        {formatDate(invoice.invoice_date)}
                      </td>

                      <td style={s.td}>
                        <span
                          style={{
                            fontWeight: invoice.is_overdue ? 900 : 650,
                            color: invoice.is_overdue
                              ? "#b42318"
                              : "#34495e",
                          }}
                        >
                          {formatDate(invoice.due_date)}
                        </span>
                      </td>

                      <td style={s.td}>
                        <span
                          style={{
                            ...s.status,
                            ...(status === "paid"
                              ? s.statusPaid
                              : invoice.is_overdue
                                ? s.statusOverdue
                                : status === "cancelled"
                                  ? s.statusCancelled
                                  : s.statusIssued),
                          }}
                        >
                          {invoice.is_overdue
                            ? "overdue"
                            : status}
                        </span>
                      </td>

                      <td style={s.tdRight}>
                        {formatMoney(invoice.amount)}
                      </td>

                      <td style={s.td}>
                        {formatDateTime(invoice.paid_at)}
                      </td>

                      <td style={s.td}>
                        <span
                          style={{
                            ...s.accessBadge,
                            ...(invoice.billing_access_suspended
                              ? s.accessSuspended
                              : s.accessOpen),
                          }}
                        >
                          {invoice.billing_access_suspended
                            ? "suspended"
                            : "open"}
                        </span>
                      </td>

                      <td style={s.td}>
                        {status === "issued" ? (
                          <button
                            type="button"
                            onClick={() => markPaid(invoice)}
                            disabled={savingId === invoice.id}
                            style={{
                              ...s.markPaidButton,
                              opacity:
                                savingId === invoice.id ? 0.6 : 1,
                            }}
                          >
                            {savingId === invoice.id
                              ? "Saving..."
                              : "Mark paid"}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={s.note}>
        <strong>Access rule:</strong> an issued invoice becomes overdue on the
        calendar day after its due date. The due date is the actual QuickBooks
        invoice date plus 7 calendar days. Marking an invoice paid clears the
        suspension only when the organisation has no other overdue unpaid
        PracticePilot invoices.
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div style={s.summaryCard}>
      <div style={s.summaryLabel}>{label}</div>
      <div style={s.summaryValue}>{value}</div>
      <div style={s.summaryNote}>{note}</div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 54px)",
    background: "#f3f7fb",
    padding: "10px 14px",
    color: "#0f172a",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: 18,
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 2,
    padding: "11px 14px",
    marginBottom: 7,
  },
  heroActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  eyebrow: {
    margin: 0,
    color: "#1769e0",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  title: {
    margin: "5px 0 0",
    fontSize: 25,
    fontWeight: 800,
    lineHeight: 1.05,
    color: "#0f172a",
  },
  sub: {
    margin: 0,
    maxWidth: 640,
    fontSize: 13,
    color: "#667085",
    textAlign: "right",
  },
  reconcileButton: {
    minHeight: 31,
    border: "1px solid #0f766e",
    borderRadius: 2,
    background: "#0f766e",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
    padding: "0 12px",
    whiteSpace: "nowrap",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 6,
    marginBottom: 8,
  },
  summaryCard: {
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 2,
    padding: "9px 11px",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  summaryNote: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 2,
    padding: 8,
    overflow: "hidden",
    marginBottom: 8,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 7,
  },
  h2: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
  },
  resultText: {
    marginTop: 3,
    fontSize: 12,
    color: "#667085",
    fontWeight: 650,
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "1.4fr 260px",
    gap: 6,
  },
  fieldWrap: {
    display: "block",
  },
  label: {
    display: "block",
    marginBottom: 3,
    fontSize: 11,
    fontWeight: 850,
    color: "#34495e",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: 31,
    border: "1px solid #bfc9d6",
    borderRadius: 2,
    padding: "0 8px",
    fontSize: 12,
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
  },
  secondaryButton: {
    border: "1px solid #d5dde6",
    background: "#ffffff",
    color: "#12304a",
    borderRadius: 2,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: 1050,
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "5px 7px",
    background: "#f8fbff",
    borderTop: "1px solid #dbe5ef",
    borderBottom: "1px solid #dbe5ef",
    fontSize: 11,
    fontWeight: 900,
    color: "#34495e",
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: "5px 7px",
    background: "#f8fbff",
    borderTop: "1px solid #dbe5ef",
    borderBottom: "1px solid #dbe5ef",
    fontSize: 11,
    fontWeight: 900,
    color: "#34495e",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "5px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#34495e",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "5px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 800,
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "5px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#34495e",
    textAlign: "right",
    verticalAlign: "middle",
  },
  status: {
    display: "inline-block",
    borderRadius: 2,
    padding: "2px 5px",
    fontSize: 11,
    fontWeight: 850,
    textTransform: "lowercase",
  },
  statusIssued: {
    background: "#e0f2fe",
    color: "#075985",
  },
  statusOverdue: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  statusPaid: {
    background: "#dcfce7",
    color: "#166534",
  },
  statusCancelled: {
    background: "#f1f5f9",
    color: "#64748b",
  },
  accessBadge: {
    display: "inline-block",
    borderRadius: 2,
    padding: "2px 5px",
    fontSize: 11,
    fontWeight: 850,
    textTransform: "lowercase",
  },
  accessOpen: {
    background: "#dcfce7",
    color: "#166534",
  },
  accessSuspended: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  markPaidButton: {
    minHeight: 28,
    border: "1px solid #1769e0",
    borderRadius: 2,
    background: "#1769e0",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
    padding: "0 10px",
    whiteSpace: "nowrap",
  },
  error: {
    marginBottom: 8,
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 10,
    borderRadius: 2,
    fontSize: 12,
  },
  success: {
    marginBottom: 8,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    padding: 10,
    borderRadius: 2,
    fontSize: 12,
  },
  empty: {
    border: "1px dashed #cfd8e3",
    borderRadius: 2,
    padding: 10,
    color: "#667085",
    fontSize: 13,
    background: "#ffffff",
  },
  note: {
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 2,
    padding: "9px 11px",
    fontSize: 12,
    lineHeight: 1.5,
    color: "#667085",
  },
};
