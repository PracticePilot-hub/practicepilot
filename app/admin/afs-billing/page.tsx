// Path: app/admin/afs-billing/page.tsx

"use client";

import { Fragment, type CSSProperties, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Organisation = {
  id: string;
  name: string;
  status: string;
  access_enabled: boolean;
  afs_billing_enabled: boolean;
  afs_plan: string | null;
  afs_pricing_tier: string | null;
  afs_flex_monthly_fee: number | null;
  afs_flex_extra_price: number | null;
  afs_unlimited_user_price: number | null;
  afs_unlimited_licence_count: number | null;
};

type BillingItem = {
  id: string;
  organisation_id: string;
  organisation_name: string;
  engagement_id: string | null;
  client_id: string | null;
  client_name: string | null;
  financial_year_end: string | null;
  billing_plan: string | null;
  pricing_tier: string | null;
  charge_type: string | null;
  billing_amount: number;
  billing_status: string | null;
  invoice_number: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  triggered_at: string | null;
  invoice_line_id: string | null;
};

type BillingSummary = {
  totalEvents: number;
  freeEvents: number;
  coveredEvents: number;
  totalCharges: number;
  uninvoicedAmount: number;
  uninvoicedEvents: number;
  invoicedAmount: number;
  invoicedEvents: number;
  paidAmount: number;
  paidEvents: number;
};

type SubscriptionUser = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
};

type SubscriptionRow = {
  organisation_id: string;
  organisation_name: string;
  billing_enabled: boolean;
  plan: string;
  pricing_tier: string | null;
  plan_activated_at: string | null;
  configured_licence_count: number | null;
  active_afs_user_count: number;
  unit_price: number;
  monthly_amount: number;
  licence_mismatch: boolean;
  users: SubscriptionUser[];
  latest_charge: {
    id: string;
    billing_amount: number;
    billing_status: string | null;
    invoice_number: string | null;
    invoiced_at: string | null;
    triggered_at: string | null;
    billing_period_start: string | null;
    billing_period_end: string | null;
  } | null;
};

type BillingStatusFilter =
  | ""
  | "free"
  | "covered"
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
  return String(item.billing_status || "uninvoiced")
    .trim()
    .toLowerCase();
}

function planLabel(plan: string | null) {
  if (!plan) return "-";

  const value = plan.toLowerCase();

  if (value === "flex") return "AFS Flex";
  if (value === "unlimited") return "AFS Unlimited";

  return plan;
}

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export default function AfsBillingAdminPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [expandedOrganisationIds, setExpandedOrganisationIds] = useState<string[]>([]);

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
  const [generating, setGenerating] = useState(false);
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
        `/api/admin/afs-billing${params.toString() ? `?${params.toString()}` : ""}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not load AFS billing.");
      }

      setOrganisations(json.organisations ?? []);
      setSubscriptions(json.subscriptions ?? []);
      setItems(json.items ?? []);
      setSummary(json.summary ?? null);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load AFS billing."
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
    () => new Set(selectedItems.map((item) => item.organisation_id)),
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
          normaliseStatus(item) === "uninvoiced" &&
          !item.invoice_line_id
      ),
    [items]
  );

  const allSelectableSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIds.includes(item.id));

  function toggleItem(item: BillingItem) {
    if (
      normaliseStatus(item) !== "uninvoiced" ||
      item.invoice_line_id
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
        currentItems[0]?.organisation_id || "";

      if (
        existingOrganisationId &&
        existingOrganisationId !== item.organisation_id
      ) {
        setError(
          "Select AFS charges from one organisation only for each QuickBooks invoice."
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
        "Choose one organisation before selecting all AFS charges for a QuickBooks invoice."
      );
      return;
    }

    setError(null);
    setSelectedIds(selectableItems.map((item) => item.id));
  }

  async function generateSubscriptionCharges() {
    setError(null);
    setSuccess(null);
    setGenerating(true);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/afs-billing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "generate_subscription_charges",
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error || "Could not generate AFS subscription charges."
        );
      }

      const createdCount = Number(json.created_count || 0);

      if (createdCount > 0) {
        setSuccess(
          `${createdCount} subscription charge(s) generated successfully.`
        );
      } else {
        setSuccess(
          "No new subscription charges were required for the current billing periods."
        );
      }

      await loadBilling();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate AFS subscription charges."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function recordQuickBooksInvoice() {
    setError(null);
    setSuccess(null);

    if (!selectedIds.length) {
      setError("Select at least one uninvoiced AFS charge.");
      return;
    }

    if (selectedOrganisationIds.size !== 1) {
      setError(
        "A QuickBooks invoice may only contain AFS charges from one organisation."
      );
      return;
    }

    if (!invoiceNumber.trim()) {
      setError("QuickBooks invoice number is required.");
      return;
    }

    if (!invoiceDate) {
      setError("QuickBooks invoice date is required.");
      return;
    }

    setSaving(true);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/afs-billing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          event_ids: selectedIds,
          invoice_number: invoiceNumber.trim(),
          invoice_date: invoiceDate,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error || "Could not record the QuickBooks invoice."
        );
      }

      setSuccess(
        `${selectedIds.length} AFS charge(s) linked to QuickBooks invoice ${invoiceNumber.trim()}. Due date: ${formatDate(json.invoice?.due_date || null)}.`
      );

      setSelectedIds([]);
      setInvoiceNumber("");

      await loadBilling();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not record the QuickBooks invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleSubscriptionUsers(id: string) {
    setExpandedOrganisationIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
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
          <h1 style={s.title}>AFS Billing Admin</h1>
        </div>

        <div style={s.heroActions}>
          <p style={s.sub}>
            Review AFS charges and link them to the actual QuickBooks invoice.
          </p>

          <button
            type="button"
            onClick={generateSubscriptionCharges}
            disabled={generating}
            style={{
              ...s.generateButton,
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating
              ? "Generating..."
              : "Generate subscription charges"}
          </button>
        </div>
      </section>

      {error ? <div style={s.error}>{error}</div> : null}
      {success ? <div style={s.success}>{success}</div> : null}

      <section style={s.summaryGrid}>
        <SummaryCard
          label="AFS events"
          value={String(summary?.totalEvents || 0)}
          note={`${summary?.freeEvents || 0} free · ${summary?.coveredEvents || 0} covered`}
        />

        <SummaryCard
          label="Uninvoiced"
          value={formatMoney(summary?.uninvoicedAmount)}
          note={`${summary?.uninvoicedEvents || 0} charge(s)`}
        />

        <SummaryCard
          label="Invoiced"
          value={formatMoney(summary?.invoicedAmount)}
          note={`${summary?.invoicedEvents || 0} charge(s)`}
        />

        <SummaryCard
          label="Paid"
          value={formatMoney(summary?.paidAmount)}
          note={`${summary?.paidEvents || 0} charge(s)`}
        />
      </section>

      <section style={s.card}>
        <div style={s.sectionHeader}>
          <div>
            <h2 style={s.h2}>AFS subscriptions</h2>
            <div style={s.resultText}>
              Monthly subscription billing by organisation, with the actual users who currently have AFS access.
            </div>
          </div>
        </div>

        {loading ? (
          <div style={s.empty}>Loading AFS subscriptions...</div>
        ) : subscriptions.length === 0 ? (
          <div style={s.empty}>No active AFS subscriptions found.</div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.subscriptionTable}>
              <thead>
                <tr>
                  <th style={s.th}>Organisation</th>
                  <th style={s.th}>Plan</th>
                  <th style={s.thRight}>AFS users</th>
                  <th style={s.thRight}>Billable licences</th>
                  <th style={s.thRight}>Rate</th>
                  <th style={s.thRight}>Monthly subscription</th>
                  <th style={s.th}>Latest charge</th>
                  <th style={s.th}>QB invoice</th>
                  <th style={s.th}>Check</th>
                </tr>
              </thead>

              <tbody>
                {subscriptions.map((subscription) => {
                  const expanded = expandedOrganisationIds.includes(
                    subscription.organisation_id
                  );
                  const latestStatus = String(
                    subscription.latest_charge?.billing_status || "not generated"
                  ).toLowerCase();

                  return (
                    <Fragment key={subscription.organisation_id}>
                      <tr>
                        <td style={s.tdStrong}>
                          <button
                            type="button"
                            onClick={() =>
                              toggleSubscriptionUsers(subscription.organisation_id)
                            }
                            style={s.expandButton}
                          >
                            <span style={s.expandIcon}>{expanded ? "−" : "+"}</span>
                            {subscription.organisation_name}
                          </button>
                        </td>
                        <td style={s.td}>{planLabel(subscription.plan)}</td>
                        <td style={s.tdRight}>
                          {subscription.active_afs_user_count}
                        </td>
                        <td style={s.tdRight}>
                          {subscription.plan === "unlimited"
                            ? subscription.configured_licence_count ?? 0
                            : "-"}
                        </td>
                        <td style={s.tdRight}>
                          {formatMoney(subscription.unit_price)}
                          {subscription.plan === "unlimited" ? " / user" : " / month"}
                        </td>
                        <td style={s.tdRightStrong}>
                          {formatMoney(subscription.monthly_amount)}
                        </td>
                        <td style={s.td}>
                          <span
                            style={{
                              ...s.status,
                              ...(latestStatus === "invoiced"
                                ? s.statusInvoiced
                                : latestStatus === "paid"
                                  ? s.statusPaid
                                  : latestStatus === "uninvoiced"
                                    ? s.statusUninvoiced
                                    : s.statusCovered),
                            }}
                          >
                            {latestStatus}
                          </span>
                        </td>
                        <td style={s.td}>
                          {subscription.latest_charge?.invoice_number || "-"}
                        </td>
                        <td style={s.td}>
                          {subscription.licence_mismatch ? (
                            <span style={s.warningText}>
                              Users ≠ licences
                            </span>
                          ) : (
                            <span style={s.okText}>OK</span>
                          )}
                        </td>
                      </tr>

                      {expanded ? (
                        <tr>
                          <td colSpan={9} style={s.userDetailCell}>
                            <div style={s.userDetailHeader}>
                              Users currently enabled for Financial Statements
                            </div>
                            {subscription.users.length === 0 ? (
                              <div style={s.userEmpty}>No active AFS users found.</div>
                            ) : (
                              <table style={s.userTable}>
                                <thead>
                                  <tr>
                                    <th style={s.userTh}>User</th>
                                    <th style={s.userTh}>Email</th>
                                    <th style={s.userTh}>Role</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {subscription.users.map((user) => (
                                    <tr key={user.id}>
                                      <td style={s.userTdStrong}>
                                        {user.full_name || user.email}
                                      </td>
                                      <td style={s.userTd}>{user.email}</td>
                                      <td style={s.userTd}>{user.role}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={s.card}>
        <div style={s.sectionHeader}>
          <div>
            <h2 style={s.h2}>Filters</h2>
            <div style={s.resultText}>
              Refine the AFS billing register before linking charges to a QuickBooks invoice.
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
            <span style={s.label}>Organisation</span>
            <select
              value={organisationId}
              onChange={(event) =>
                setOrganisationId(event.target.value)
              }
              style={s.input}
            >
              <option value="">All organisations</option>

              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.name}
                  {organisation.afs_plan
                    ? ` - ${planLabel(organisation.afs_plan)}`
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
              <option value="covered">Covered</option>
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
          <div style={s.headerLabel}>Selected organisation</div>
          <div style={s.headerValue}>
            {selectedItems[0]?.organisation_name || "None selected"}
          </div>
        </div>

        <div>
          <div style={s.headerLabel}>Selected charges</div>
          <div style={s.headerValue}>{selectedIds.length}</div>
        </div>

        <div>
          <div style={s.headerLabel}>Selected total</div>
          <div style={s.headerValue}>{formatMoney(selectedTotal)}</div>
        </div>

        <label style={s.invoiceField}>
          <span style={s.label}>QuickBooks invoice number</span>
          <input
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
            placeholder="Example: INV-000123"
            style={s.input}
          />
        </label>

        <label style={s.invoiceField}>
          <span style={s.label}>QuickBooks invoice date</span>
          <input
            type="date"
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value)}
            style={s.input}
          />
        </label>

        <button
          type="button"
          onClick={recordQuickBooksInvoice}
          disabled={saving || !selectedIds.length}
          style={{
            ...s.primaryButton,
            opacity: saving || !selectedIds.length ? 0.55 : 1,
          }}
        >
          {saving ? "Saving..." : "Record QuickBooks invoice"}
        </button>
      </section>

      <section style={s.card}>
        <div style={s.sectionHeader}>
          <div>
            <h2 style={s.h2}>AFS billing register</h2>
            <div style={s.resultText}>
              Showing {items.length} item(s)
            </div>
          </div>
        </div>

        {loading ? (
          <div style={s.empty}>Loading AFS billing...</div>
        ) : items.length === 0 ? (
          <div style={s.empty}>
            No AFS billing items match the selected filters.
          </div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.checkTh}>
                    <input
                      type="checkbox"
                      checked={allSelectableSelected}
                      onChange={toggleAllSelectable}
                      aria-label="Select all uninvoiced AFS charges"
                    />
                  </th>
                  <th style={s.th}>No.</th>
                  <th style={s.th}>Organisation</th>
                  <th style={s.th}>Client</th>
                  <th style={s.th}>Year end</th>
                  <th style={s.th}>Plan</th>
                  <th style={s.th}>Charge type</th>
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
                    status === "uninvoiced" &&
                    !item.invoice_line_id;

                  return (
                    <tr key={item.id}>
                      <td style={s.checkTd}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          disabled={!selectable}
                          onChange={() => toggleItem(item)}
                          aria-label={`Select ${item.client_name || "AFS charge"}`}
                        />
                      </td>

                      <td style={s.td}>{index + 1}</td>

                      <td style={s.td}>
                        {item.organisation_name}
                      </td>

                      <td style={s.tdStrong}>
                        {item.client_name || "-"}
                      </td>

                      <td style={s.td}>
                        {formatDate(item.financial_year_end)}
                      </td>

                      <td style={s.td}>
                        {planLabel(item.billing_plan)}
                      </td>

                      <td style={s.td}>
                        {item.charge_type || "-"}
                      </td>

                      <td style={s.td}>
                        {formatDate(item.triggered_at)}
                      </td>

                      <td style={s.td}>
                        <span
                          style={{
                            ...s.status,
                            ...(status === "free"
                              ? s.statusFree
                              : status === "covered"
                                ? s.statusCovered
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

                      <td style={s.td}>
                        {item.invoice_number || "-"}
                      </td>

                      <td style={s.td}>
                        {formatDate(item.invoiced_at)}
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
        <strong>Subscription billing:</strong> use Generate subscription charges to create
        the applicable Flex or Unlimited subscription charge for each active billing period.
        The generated charge then appears in this register and can be linked to the actual
        QuickBooks invoice together with any other AFS charges.
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
  heroActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  sub: {
    margin: 0,
    maxWidth: 620,
    fontSize: 13,
    color: "#667085",
    textAlign: "right",
  },
  generateButton: {
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
      "1.1fr 120px 140px 1fr 160px 190px",
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
    minHeight: 31,
    border: "1px solid #1769e0",
    borderRadius: 2,
    background: "#1769e0",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
    padding: "0 12px",
    whiteSpace: "nowrap",
  },
  subscriptionTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1100,
  },
  expandButton: {
    border: 0,
    padding: 0,
    background: "transparent",
    color: "#0f172a",
    font: "inherit",
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    textAlign: "left",
  },
  expandIcon: {
    display: "inline-flex",
    width: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #bfc9d6",
    background: "#f8fbff",
    fontSize: 13,
    lineHeight: 1,
  },
  tdRightStrong: {
    padding: "5px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#0f172a",
    textAlign: "right",
    fontWeight: 900,
    verticalAlign: "middle",
  },
  warningText: {
    color: "#b42318",
    fontWeight: 850,
    fontSize: 11,
  },
  okText: {
    color: "#166534",
    fontWeight: 850,
    fontSize: 11,
  },
  userDetailCell: {
    padding: "7px 28px 9px",
    background: "#f8fbff",
    borderBottom: "1px solid #dbe5ef",
  },
  userDetailHeader: {
    marginBottom: 5,
    fontSize: 11,
    fontWeight: 900,
    color: "#34495e",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  userTable: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#ffffff",
    border: "1px solid #dbe5ef",
  },
  userTh: {
    textAlign: "left",
    padding: "4px 7px",
    background: "#f1f6fb",
    borderBottom: "1px solid #dbe5ef",
    fontSize: 10,
    fontWeight: 900,
    color: "#475569",
  },
  userTd: {
    padding: "4px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 11,
    color: "#475569",
  },
  userTdStrong: {
    padding: "4px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 11,
    color: "#0f172a",
    fontWeight: 800,
  },
  userEmpty: {
    fontSize: 11,
    color: "#667085",
    padding: "4px 0",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1180,
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
  statusCovered: {
    background: "#e0e7ff",
    color: "#3730a3",
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
