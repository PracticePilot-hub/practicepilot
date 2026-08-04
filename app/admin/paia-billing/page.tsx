// Path: app/admin/paia-billing/page.tsx

"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Organisation = {
  id: string;
  name: string;
  status: string;
  access_enabled: boolean;
  paia_manual_price: number;
  paia_billing_enabled: boolean;
};

type BillingItem = {
  id: string;
  client_id: string;
  organisation_name: string;
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

type BillingStatusFilter =
  | ""
  | "free"
  | "uninvoiced"
  | "invoiced"
  | "paid";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const today = new Date().toISOString().slice(0, 10);

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

export default function PaiaBillingAdminPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);

  const [organisationId, setOrganisationId] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<BillingStatusFilter>("uninvoiced");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadBilling();
  }, [organisationId, statusFilter, dateFrom, dateTo]);

  async function loadBilling() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setSelectedIds([]);

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

      if (dateFrom) {
        params.set("dateFrom", dateFrom);
      }

      if (dateTo) {
        params.set("dateTo", dateTo);
      }

      const response = await fetch(
        `/api/admin/paia-billing${params.toString() ? `?${params.toString()}` : ""}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not load PAIA billing.");
      }

      setOrganisations(json.organisations ?? []);
      setItems(json.items ?? []);
      setSummary(json.summary ?? null);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load PAIA billing."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const selectedOrganisationIds = useMemo(
    () => new Set(selectedItems.map((item) => item.client_id)),
    [selectedItems]
  );

  const selectedTotal = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) => total + Number(item.billing_amount || 0),
        0
      ),
    [selectedItems]
  );

  const selectableItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.is_free_manual &&
          normaliseStatus(item) === "uninvoiced"
      ),
    [items]
  );

  const allSelectableSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIds.includes(item.id));

  function toggleItem(item: BillingItem) {
    if (
      item.is_free_manual ||
      normaliseStatus(item) !== "uninvoiced"
    ) {
      return;
    }

    setSelectedIds((current) => {
      if (current.includes(item.id)) {
        return current.filter((id) => id !== item.id);
      }

      const currentItems = items.filter((row) =>
        current.includes(row.id)
      );

      const existingOrganisationId =
        currentItems[0]?.client_id || "";

      if (
        existingOrganisationId &&
        existingOrganisationId !== item.client_id
      ) {
        setError(
          "Select manuals from one franchisee only for each invoice batch."
        );
        return current;
      }

      setError(null);
      return [...current, item.id];
    });
  }

  function toggleAllSelectable() {
    if (allSelectableSelected) {
      setSelectedIds([]);
      return;
    }

    if (!organisationId) {
      setError(
        "Choose one franchisee before selecting all manuals for an invoice batch."
      );
      return;
    }

    setError(null);
    setSelectedIds(selectableItems.map((item) => item.id));
  }

  async function createInvoiceBatch() {
    setError(null);
    setSuccess(null);

    if (!selectedIds.length) {
      setError("Select at least one uninvoiced PAIA manual.");
      return;
    }

    if (selectedOrganisationIds.size !== 1) {
      setError("An invoice batch may only contain one franchisee.");
      return;
    }

    if (!invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }

    setSaving(true);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/paia-billing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          manual_ids: selectedIds,
          invoice_number: invoiceNumber.trim(),
          invoiced_at: invoiceDate,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error || "Could not create the invoice batch."
        );
      }

      setSuccess(
        `${selectedIds.length} manual(s) marked as invoiced under ${invoiceNumber.trim()}.`
      );
      setSelectedIds([]);
      setInvoiceNumber("");
      await loadBilling();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create the invoice batch."
      );
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setOrganisationId("");
    setStatusFilter("uninvoiced");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <main style={s.page}>
      <section style={s.hero}>
        <div>
          <p style={s.eyebrow}>PracticePilot</p>
          <h1 style={s.title}>PAIA Billing Admin</h1>
        </div>

        <p style={s.sub}>
          Review franchisee PAIA charges and mark invoice batches as
          invoiced.
        </p>
      </section>

      {error ? <div style={s.error}>{error}</div> : null}
      {success ? <div style={s.success}>{success}</div> : null}

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
        <div style={s.sectionHeader}>
          <div>
            <h2 style={s.h2}>Filters</h2>
            <div style={s.resultText}>
              Refine the billing register before creating an invoice batch.
            </div>
          </div>

          <button
            type="button"
            style={s.secondaryButton}
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>

        <div style={s.filters}>
          <label style={s.fieldWrap}>
            <span style={s.label}>Franchisee</span>
            <select
              value={organisationId}
              onChange={(event) =>
                setOrganisationId(event.target.value)
              }
              style={s.input}
            >
              <option value="">All franchisees</option>
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.name}
                  {organisation.paia_billing_enabled === false
                    ? " - Billing disabled"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={s.fieldWrap}>
            <span style={s.label}>Billing status</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as BillingStatusFilter
                )
              }
              style={s.input}
            >
              <option value="">All</option>
              <option value="free">Free</option>
              <option value="uninvoiced">Uninvoiced</option>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
            </select>
          </label>

          <label style={s.fieldWrap}>
            <span style={s.label}>Created from</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              style={s.input}
            />
          </label>

          <label style={s.fieldWrap}>
            <span style={s.label}>Created to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              style={s.input}
            />
          </label>
        </div>
      </section>

      <section style={s.invoicePanel}>
        <div>
          <div style={s.headerLabel}>Selected franchisee</div>
          <div style={s.headerValue}>
            {selectedItems[0]?.organisation_name || "None selected"}
          </div>
        </div>

        <div>
          <div style={s.headerLabel}>Selected manuals</div>
          <div style={s.headerValue}>{selectedIds.length}</div>
        </div>

        <div>
          <div style={s.headerLabel}>Selected total</div>
          <div style={s.headerValue}>{formatMoney(selectedTotal)}</div>
        </div>

        <label style={s.invoiceField}>
          <span style={s.label}>Invoice number</span>
          <input
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
            placeholder="Example: INV-000123"
            style={s.input}
          />
        </label>

        <label style={s.invoiceField}>
          <span style={s.label}>Invoice date</span>
          <input
            type="date"
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value)}
            style={s.input}
          />
        </label>

        <button
          type="button"
          onClick={createInvoiceBatch}
          disabled={saving || !selectedIds.length}
          style={{
            ...s.primaryButton,
            opacity: saving || !selectedIds.length ? 0.55 : 1,
          }}
        >
          {saving ? "Saving..." : "Mark batch invoiced"}
        </button>
      </section>

      <section style={s.card}>
        <div style={s.sectionHeader}>
          <div>
            <h2 style={s.h2}>PAIA billing register</h2>
            <div style={s.resultText}>
              Showing {items.length} item(s)
            </div>
          </div>
        </div>

        {loading ? (
          <div style={s.empty}>Loading PAIA billing...</div>
        ) : items.length === 0 ? (
          <div style={s.empty}>
            No PAIA billing items match the selected filters.
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.checkTh}>
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={toggleAllSelectable}
                    aria-label="Select all uninvoiced manuals"
                  />
                </th>
                <th style={s.th}>No.</th>
                <th style={s.th}>Franchisee</th>
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
              {items.map((item, index) => {
                const status = normaliseStatus(item);
                const selectable =
                  !item.is_free_manual && status === "uninvoiced";

                return (
                  <tr key={item.id}>
                    <td style={s.checkTd}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        disabled={!selectable}
                        onChange={() => toggleItem(item)}
                        aria-label={`Select ${item.entity_name}`}
                      />
                    </td>
                    <td style={s.td}>{index + 1}</td>
                    <td style={s.td}>{item.organisation_name}</td>
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
    gridTemplateColumns: "1.4fr 210px 160px 160px",
    gap: 6,
  },
  fieldWrap: {
    display: "block",
  },
  invoiceField: {
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
  invoicePanel: {
    display: "grid",
    gridTemplateColumns:
      "1.1fr 120px 140px 1fr 160px 180px",
    gap: 6,
    alignItems: "end",
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 2,
    padding: 8,
    marginBottom: 8,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: 850,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  headerValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: 850,
    color: "#0f172a",
  },
  primaryButton: {
    height: 31,
    border: "1px solid #1769e0",
    borderRadius: 2,
    background: "#1769e0",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
    padding: "0 12px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  checkTh: {
    width: 36,
    textAlign: "center",
    padding: "5px 5px",
    background: "#f8fbff",
    borderTop: "1px solid #dbe5ef",
    borderBottom: "1px solid #dbe5ef",
  },
  checkTd: {
    width: 36,
    textAlign: "center",
    padding: "5px 5px",
    borderBottom: "1px solid #edf2f7",
    verticalAlign: "middle",
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
    borderRadius: 2,
    fontSize: 12,
  },
  success: {
    marginBottom: 14,
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
};
