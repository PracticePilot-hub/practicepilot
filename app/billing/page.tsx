// Path: app/billing/page.tsx

"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type BillingItem = {
  id: string;
  entity_name: string;
  entity_registration_number: string | null;
  created_at: string | null;
  is_free_manual: boolean;
  billing_amount: number;
  billing_status: string | null;
  invoice_number: string | null;
  invoiced_at: string | null;
};

type BillingSummary = {
  totalManuals: number;
  freeManuals: number;
  totalCharges: number;
  uninvoicedAmount: number;
  uninvoicedManuals: number;
  invoicedAmount: number;
  invoicedManuals: number;
  paidAmount: number;
  paidManuals: number;
};

type Organisation = {
  id: string;
  name: string;
  paia_manual_price: number;
  paia_billing_enabled: boolean;
};

type StatusFilter = "all" | "free" | "uninvoiced" | "invoiced" | "paid";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function normaliseStatus(item: BillingItem) {
  if (item.is_free_manual) return "free";
  return String(item.billing_status || "uninvoiced").trim().toLowerCase();
}

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export default function MyBillingPage() {
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    loadBilling();
  }, []);

  async function loadBilling() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/billing/paia", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not load billing.");
      }

      setOrganisation(json.organisation ?? null);
      setItems(json.items ?? []);
      setSummary(json.summary ?? null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not load billing."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return items.filter((item) => {
      const status = normaliseStatus(item);

      const matchesSearch =
        !searchValue ||
        String(item.entity_name || "").toLowerCase().includes(searchValue) ||
        String(item.entity_registration_number || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(item.invoice_number || "").toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  if (loading) {
    return (
      <main style={s.page}>
        <div style={s.empty}>Loading billing...</div>
      </main>
    );
  }

  return (
    <main style={s.page}>
      <section style={s.hero}>
        <div>
          <p style={s.eyebrow}>PracticePilot</p>
          <h1 style={s.title}>My Billing</h1>
        </div>

        <p style={s.sub}>
          View PAIA manuals charged to your firm, together with invoice and
          payment status.
        </p>
      </section>

      {error ? <div style={s.error}>{error}</div> : null}

      <section style={s.headerStrip}>
        <div>
          <div style={s.headerLabel}>Firm</div>
          <div style={s.headerValue}>
            {organisation?.name || "Your organisation"}
          </div>
        </div>

        <div>
          <div style={s.headerLabel}>PAIA price</div>
          <div style={s.headerValue}>
            {organisation?.paia_billing_enabled === false
              ? "Billing disabled"
              : `${formatMoney(organisation?.paia_manual_price)} per manual`}
          </div>
        </div>
      </section>

      <section style={s.summaryGrid}>
        <SummaryCard
          label="Total manuals"
          value={String(summary?.totalManuals || 0)}
          note={`${summary?.freeManuals || 0} free`}
        />

        <SummaryCard
          label="Uninvoiced"
          value={formatMoney(summary?.uninvoicedAmount)}
          note={`${summary?.uninvoicedManuals || 0} manual(s)`}
        />

        <SummaryCard
          label="Invoiced"
          value={formatMoney(summary?.invoicedAmount)}
          note={`${summary?.invoicedManuals || 0} manual(s)`}
        />

        <SummaryCard
          label="Paid"
          value={formatMoney(summary?.paidAmount)}
          note={`${summary?.paidManuals || 0} manual(s)`}
        />
      </section>

      <section style={s.card}>
        <div style={s.listHeader}>
          <div>
            <h2 style={s.h2}>PAIA billing history</h2>
            <div style={s.resultText}>
              Showing {filteredItems.length} of {items.length} item(s)
            </div>
          </div>

          <button
            type="button"
            style={s.clearButton}
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>

        <div style={s.filters}>
          <label style={s.filterLabel}>
            <span style={s.filterText}>Entity / reg no. / invoice</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              style={s.filterInput}
            />
          </label>

          <label style={s.filterLabel}>
            <span style={s.filterText}>Billing status</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              style={s.filterInput}
            >
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="uninvoiced">Uninvoiced</option>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
            </select>
          </label>
        </div>

        {items.length === 0 ? (
          <div style={s.empty}>No PAIA billing items found.</div>
        ) : filteredItems.length === 0 ? (
          <div style={s.empty}>No billing items match the filters.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>No.</th>
                <th style={s.th}>Entity</th>
                <th style={s.th}>Registration</th>
                <th style={s.th}>Created</th>
                <th style={s.th}>Status</th>
                <th style={s.thRight}>Amount</th>
                <th style={s.th}>Invoice</th>
                <th style={s.th}>Invoice date</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item, index) => {
                const status = normaliseStatus(item);

                return (
                  <tr key={item.id}>
                    <td style={s.td}>{index + 1}</td>
                    <td style={s.tdStrong}>{item.entity_name}</td>
                    <td style={s.td}>
                      {item.entity_registration_number || "-"}
                    </td>
                    <td style={s.td}>{formatDate(item.created_at)}</td>
                    <td style={s.td}>
                      <span
                        style={{
                          ...s.status,
                          ...(status === "free"
                            ? s.statusFree
                            : status === "invoiced"
                              ? s.statusInvoiced
                              : status === "paid"
                                ? s.statusPaid
                                : s.statusUninvoiced),
                        }}
                      >
                        {status}
                      </span>
                    </td>
                    <td style={s.tdRight}>
                      {formatMoney(item.billing_amount)}
                    </td>
                    <td style={s.td}>{item.invoice_number || "-"}</td>
                    <td style={s.td}>{formatDate(item.invoiced_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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
    padding: "14px 18px",
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
    borderRadius: 12,
    padding: "14px 20px",
    marginBottom: 14,
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
    maxWidth: 720,
    fontSize: 13,
    color: "#667085",
    textAlign: "right",
  },
  headerStrip: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 14,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: 850,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  headerValue: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: 850,
    color: "#0f172a",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 10,
    padding: "12px 14px",
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
    fontSize: 22,
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
    borderRadius: 12,
    padding: 12,
    overflow: "hidden",
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 12,
  },
  h2: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
    color: "#0f172a",
  },
  resultText: {
    marginTop: 3,
    fontSize: 12,
    color: "#667085",
    fontWeight: 650,
  },
  clearButton: {
    border: "1px solid #d5dde6",
    background: "#ffffff",
    color: "#12304a",
    borderRadius: 7,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "1fr 220px",
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: "1px solid #edf2f7",
  },
  filterLabel: {
    display: "block",
  },
  filterText: {
    display: "block",
    marginBottom: 3,
    fontSize: 11,
    color: "#34495e",
    fontWeight: 850,
  },
  filterInput: {
    width: "100%",
    boxSizing: "border-box",
    height: 32,
    border: "1px solid #cfd8e3",
    borderRadius: 7,
    padding: "0 8px",
    fontSize: 12,
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "7px 8px",
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
    padding: "7px 8px",
    background: "#f8fbff",
    borderTop: "1px solid #dbe5ef",
    borderBottom: "1px solid #dbe5ef",
    fontSize: 11,
    fontWeight: 900,
    color: "#34495e",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "7px 8px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#34495e",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "7px 8px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 800,
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "7px 8px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#34495e",
    textAlign: "right",
    verticalAlign: "middle",
  },
  status: {
    display: "inline-block",
    borderRadius: 999,
    padding: "2px 7px",
    fontSize: 11,
    fontWeight: 850,
    textTransform: "lowercase",
  },
  statusFree: {
    background: "#dcfce7",
    color: "#166534",
  },
  statusUninvoiced: {
    background: "#ffedd5",
    color: "#9a3412",
  },
  statusInvoiced: {
    background: "#e0f2fe",
    color: "#075985",
  },
  statusPaid: {
    background: "#ede9fe",
    color: "#5b21b6",
  },
  error: {
    marginBottom: 14,
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
  },
  empty: {
    border: "1px dashed #cfd8e3",
    borderRadius: 10,
    padding: 14,
    color: "#667085",
    fontSize: 13,
    background: "#ffffff",
  },
};
