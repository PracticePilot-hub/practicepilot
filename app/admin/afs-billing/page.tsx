// Path: app/admin/afs-billing/page.tsx

"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
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
  client_name: string | null;
  financial_year_end: string | null;
  billing_plan: string | null;
  charge_type: string | null;
  billing_amount: number;
  billing_status: string | null;
  invoice_number: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  triggered_at: string | null;
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
  configured_licence_count: number | null;
  active_afs_user_count: number;
  unit_price: number;
  monthly_amount: number;
  users: SubscriptionUser[];
};

type BillingRun = {
  id: string;
  billing_month: string;
  cutoff_date: string;
  run_date: string;
  status: string;
  generated_at: string;
  notes: string | null;
};

type BillingBatch = {
  id: string;
  billing_run_id: string;
  organisation_id: string;
  organisation_name: string;
  billing_plan: string | null;
  pricing_tier: string | null;
  free_items_count: number;
  covered_items_count: number;
  chargeable_items_count: number;
  subtotal: number;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_id: string | null;
  status: string;
  invoiced_at: string | null;
};

type RunSummary = {
  total: number;
  uninvoiced: number;
  invoiced: number;
  invoiceBatches: number;
};

type OrgFilter = "all" | "flex" | "unlimited" | "no_plan" | "attention";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const today = new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 20;

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateText(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function planLabel(plan: string | null | undefined) {
  const value = String(plan || "").toLowerCase();
  if (value === "flex") return "Flex";
  if (value === "unlimited") return "Unlimited";
  return "No Plan";
}

function normalStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export default function AfsBillingAdminPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [items, setItems] = useState<BillingItem[]>([]);

  const [runs, setRuns] = useState<BillingRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [batches, setBatches] = useState<BillingBatch[]>([]);
  const [runEvents, setRunEvents] = useState<BillingItem[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary>({
    total: 0,
    uninvoiced: 0,
    invoiced: 0,
    invoiceBatches: 0,
  });

  const [selectedOrganisationId, setSelectedOrganisationId] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<OrgFilter>("all");
  const [sortMode, setSortMode] = useState("name_asc");
  const [orgPage, setOrgPage] = useState(1);

  const [invoiceBatchId, setInvoiceBatchId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);

  const [loading, setLoading] = useState(true);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    if (selectedRunId) void loadRunData(selectedRunId);
  }, [selectedRunId]);

  async function loadBaseData() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const [billingResponse, runsResponse] = await Promise.all([
        fetch("/api/admin/afs-billing", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/afs-billing/runs", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const billingJson = await billingResponse.json();
      const runsJson = await runsResponse.json();

      if (!billingResponse.ok) {
        throw new Error(billingJson.error || "Could not load AFS billing.");
      }

      if (!runsResponse.ok) {
        throw new Error(runsJson.error || "Could not load AFS billing runs.");
      }

      setOrganisations(billingJson.organisations ?? []);
      setSubscriptions(billingJson.subscriptions ?? []);
      setItems(billingJson.items ?? []);

      setRuns(runsJson.runs ?? []);
      setSelectedRunId(runsJson.selected_run_id ?? "");
      setBatches(runsJson.batches ?? []);
      setRunEvents(runsJson.events ?? []);
      setRunSummary(
        runsJson.summary ?? {
          total: 0,
          uninvoiced: 0,
          invoiced: 0,
          invoiceBatches: 0,
        }
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load AFS billing.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRunData(runId: string) {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `/api/admin/afs-billing/runs?runId=${encodeURIComponent(runId)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not load billing run.");
      }

      setBatches(json.batches ?? []);
      setRunEvents(json.events ?? []);
      setRunSummary(
        json.summary ?? {
          total: 0,
          uninvoiced: 0,
          invoiced: 0,
          invoiceBatches: 0,
        }
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load billing run.");
    }
  }

  const subscriptionByOrg = useMemo(
    () =>
      new Map(
        subscriptions.map((subscription) => [
          subscription.organisation_id,
          subscription,
        ])
      ),
    [subscriptions]
  );

  const eventsByOrg = useMemo(() => {
    const map = new Map<string, BillingItem[]>();

    for (const item of items) {
      const current = map.get(item.organisation_id) ?? [];
      current.push(item);
      map.set(item.organisation_id, current);
    }

    return map;
  }, [items]);

  const latestBatchByOrg = useMemo(() => {
    const map = new Map<string, BillingBatch>();

    for (const batch of batches) {
      map.set(batch.organisation_id, batch);
    }

    return map;
  }, [batches]);

  const freeUsageByOrg = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of items) {
      const status = normalStatus(item.billing_status);
      if (status === "free" || item.charge_type === "free_credit") {
        map.set(
          item.organisation_id,
          (map.get(item.organisation_id) ?? 0) + 1
        );
      }
    }

    return map;
  }, [items]);

  const attentionOrgIds = useMemo(() => {
    const set = new Set<string>();

    for (const organisation of organisations) {
      const subscription = subscriptionByOrg.get(organisation.id);
      const batch = latestBatchByOrg.get(organisation.id);

      if (
        batch &&
        Number(batch.subtotal || 0) > 0 &&
        batch.status !== "invoiced" &&
        batch.status !== "paid"
      ) {
        set.add(organisation.id);
      }

      if (
        subscription?.plan === "unlimited" &&
        subscription.active_afs_user_count !==
          Number(subscription.configured_licence_count || 0)
      ) {
        set.add(organisation.id);
      }
    }

    return set;
  }, [organisations, subscriptionByOrg, latestBatchByOrg]);

  const visibleOrganisations = useMemo(() => {
    const term = orgSearch.trim().toLowerCase();

    let result = organisations.filter((organisation) => {
      const plan = String(organisation.afs_plan || "").toLowerCase();

      if (term && !organisation.name.toLowerCase().includes(term)) return false;
      if (orgFilter === "flex" && plan !== "flex") return false;
      if (orgFilter === "unlimited" && plan !== "unlimited") return false;
      if (orgFilter === "no_plan" && (plan === "flex" || plan === "unlimited")) {
        return false;
      }
      if (orgFilter === "attention" && !attentionOrgIds.has(organisation.id)) {
        return false;
      }

      return true;
    });

    result = [...result].sort((a, b) => {
      if (sortMode === "name_desc") return b.name.localeCompare(a.name);
      if (sortMode === "plan") {
        return planLabel(a.afs_plan).localeCompare(planLabel(b.afs_plan));
      }
      if (sortMode === "attention") {
        return (
          Number(attentionOrgIds.has(b.id)) -
          Number(attentionOrgIds.has(a.id))
        );
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [organisations, orgSearch, orgFilter, sortMode, attentionOrgIds]);

  useEffect(() => {
    setOrgPage(1);
  }, [orgSearch, orgFilter, sortMode]);

  const orgPageCount = Math.max(
    1,
    Math.ceil(visibleOrganisations.length / PAGE_SIZE)
  );

  const pagedOrganisations = visibleOrganisations.slice(
    (orgPage - 1) * PAGE_SIZE,
    orgPage * PAGE_SIZE
  );

  const selectedOrganisation =
    organisations.find((organisation) => organisation.id === selectedOrganisationId) ??
    null;

  const selectedSubscription = selectedOrganisation
    ? subscriptionByOrg.get(selectedOrganisation.id) ?? null
    : null;

  const selectedEvents = selectedOrganisation
    ? eventsByOrg.get(selectedOrganisation.id) ?? []
    : [];

  const selectedBatch = selectedOrganisation
    ? latestBatchByOrg.get(selectedOrganisation.id) ?? null
    : null;

  const selectedUsers = selectedSubscription?.users ?? [];
  const selectedFreeUsed = selectedOrganisation
    ? freeUsageByOrg.get(selectedOrganisation.id) ?? 0
    : 0;

  const selectedUninvoiced = selectedEvents.reduce((total, event) => {
    if (normalStatus(event.billing_status) !== "uninvoiced") return total;
    return total + Number(event.billing_amount || 0);
  }, 0);

  const activeSubscriptions = organisations.filter((organisation) =>
    ["flex", "unlimited"].includes(
      String(organisation.afs_plan || "").toLowerCase()
    )
  ).length;

  const freeEvents = items.filter((item) => {
    const status = normalStatus(item.billing_status);
    return status === "free" || item.charge_type === "free_credit";
  }).length;

  const invoicedTotal = items.reduce((total, item) => {
    if (normalStatus(item.billing_status) !== "invoiced") return total;
    return total + Number(item.billing_amount || 0);
  }, 0);

  const paidTotal = items.reduce((total, item) => {
    if (normalStatus(item.billing_status) !== "paid") return total;
    return total + Number(item.billing_amount || 0);
  }, 0);

  const currentRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;

  function organisationMeta(organisation: Organisation) {
    const subscription = subscriptionByOrg.get(organisation.id);
    const plan = String(organisation.afs_plan || "").toLowerCase();
    const users = subscription?.active_afs_user_count ?? 0;
    const freeUsed = freeUsageByOrg.get(organisation.id) ?? 0;

    if (plan === "unlimited") {
      return `Unlimited • ${users} AFS user${users === 1 ? "" : "s"}`;
    }

    if (plan === "flex") {
      return `${freeUsed} free set${freeUsed === 1 ? "" : "s"} used • ${users} AFS user${
        users === 1 ? "" : "s"
      }`;
    }

    return `No AFS plan • ${users} user${users === 1 ? "" : "s"}`;
  }

  function batchStatusLabel(batch: BillingBatch | null) {
    if (!batch) return "No billing run";
    if (batch.status === "paid") return "Paid";
    if (batch.status === "invoiced") return "Invoiced";
    if (Number(batch.subtotal || 0) > 0) return "Ready to invoice";
    return "No invoice required";
  }

  async function recordBatchInvoice() {
    if (!invoiceBatchId) {
      setError("Choose an organisation billing batch first.");
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

    setSavingInvoice(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/afs-billing/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "record_batch_invoice",
          billing_batch_id: invoiceBatchId,
          invoice_number: invoiceNumber.trim(),
          invoice_date: invoiceDate,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not record QuickBooks invoice.");
      }

      setSuccess(
        `QuickBooks invoice ${invoiceNumber.trim()} linked to the full organisation billing batch (${money(
          json.amount
        )}).`
      );
      setInvoiceBatchId("");
      setInvoiceNumber("");
      await loadBaseData();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not record QuickBooks invoice."
      );
    } finally {
      setSavingInvoice(false);
    }
  }

  function openInvoiceForBatch(batch: BillingBatch) {
    setSelectedOrganisationId(batch.organisation_id);
    setInvoiceBatchId(batch.id);
    setInvoiceNumber("");
    setInvoiceDate(today);
    window.setTimeout(() => {
      document.getElementById("batch-invoice-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  function exportBillingRunCsv() {
    if (!currentRun || !batches.length) {
      setError("There is no billing run to export yet.");
      return;
    }

    const rows = [
      [
        "Billing month",
        "Organisation",
        "Plan",
        "Free items",
        "Covered items",
        "Chargeable items",
        "Amount excl VAT",
        "QB invoice",
        "Invoice date",
        "Status",
      ],
      ...batches
        .filter((batch) => Number(batch.subtotal || 0) > 0)
        .map((batch) => [
          currentRun.billing_month,
          batch.organisation_name,
          planLabel(batch.billing_plan),
          String(batch.free_items_count || 0),
          String(batch.covered_items_count || 0),
          String(batch.chargeable_items_count || 0),
          Number(batch.subtotal || 0).toFixed(2),
          batch.invoice_number || "",
          batch.invoice_date || "",
          batch.status,
        ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PracticePilot_AFS_Billing_Run_${currentRun.billing_month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const selectedRunEvents = selectedOrganisation
    ? runEvents.filter(
        (event) => event.organisation_id === selectedOrganisation.id
      )
    : runEvents.slice(0, 10);

  return (
    <main style={s.page}>
      <header style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}>PracticePilot</div>
          <h1 style={s.title}>AFS Billing Admin</h1>
          <div style={s.subtitle}>
            Manage AFS subscriptions, free sets, users and monthly QuickBooks billing.
          </div>
        </div>

        <div style={s.headerActions}>
          {runs.length ? (
            <select
              value={selectedRunId}
              onChange={(event) => setSelectedRunId(event.target.value)}
              style={s.runSelect}
            >
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {dateText(run.billing_month)} billing run
                </option>
              ))}
            </select>
          ) : null}

          <button type="button" style={s.secondaryButton} onClick={exportBillingRunCsv}>
            Export billing run
          </button>
        </div>
      </header>

      {error ? <div style={s.error}>{error}</div> : null}
      {success ? <div style={s.success}>{success}</div> : null}

      <div style={s.workspace}>
        <aside style={s.sidebar}>
          <div style={s.sidebarTitle}>Organisations</div>

          <input
            value={orgSearch}
            onChange={(event) => setOrgSearch(event.target.value)}
            placeholder="Search organisations..."
            style={s.searchInput}
          />

          <div style={s.filterTabs}>
            {[
              ["all", "All"],
              ["flex", "Flex"],
              ["unlimited", "Unlimited"],
              ["no_plan", "No Plan"],
              ["attention", "Attention"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOrgFilter(value as OrgFilter)}
                style={{
                  ...s.filterTab,
                  ...(orgFilter === value ? s.filterTabActive : {}),
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            style={s.sortSelect}
          >
            <option value="name_asc">Organisation (A–Z)</option>
            <option value="name_desc">Organisation (Z–A)</option>
            <option value="plan">Plan</option>
            <option value="attention">Attention first</option>
          </select>

          <button
            type="button"
            onClick={() => setSelectedOrganisationId("")}
            style={{
              ...s.orgRow,
              ...(selectedOrganisationId === "" ? s.orgRowSelected : {}),
            }}
          >
            <div>
              <div style={s.orgName}>All organisations overview</div>
              <div style={s.orgMeta}>Portfolio billing summary</div>
            </div>
            <span style={s.chevron}>›</span>
          </button>

          <div style={s.orgList}>
            {pagedOrganisations.map((organisation) => (
              <button
                key={organisation.id}
                type="button"
                onClick={() => setSelectedOrganisationId(organisation.id)}
                style={{
                  ...s.orgRow,
                  ...(selectedOrganisationId === organisation.id
                    ? s.orgRowSelected
                    : {}),
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={s.orgTopLine}>
                    <span style={s.orgName}>{organisation.name}</span>
                    <span
                      style={{
                        ...s.planBadge,
                        ...(organisation.afs_plan === "unlimited"
                          ? s.planUnlimited
                          : organisation.afs_plan === "flex"
                            ? s.planFlex
                            : s.planNone),
                      }}
                    >
                      {planLabel(organisation.afs_plan)}
                    </span>
                  </div>
                  <div style={s.orgMeta}>{organisationMeta(organisation)}</div>
                </div>
                <span style={s.chevron}>›</span>
              </button>
            ))}
          </div>

          <div style={s.sidebarFooter}>
            <div style={s.sidebarCount}>
              Showing {visibleOrganisations.length === 0 ? 0 : (orgPage - 1) * PAGE_SIZE + 1}–
              {Math.min(orgPage * PAGE_SIZE, visibleOrganisations.length)} of{" "}
              {visibleOrganisations.length}
            </div>

            <div style={s.pagination}>
              <button
                type="button"
                disabled={orgPage <= 1}
                onClick={() => setOrgPage((page) => Math.max(1, page - 1))}
                style={s.pageButton}
              >
                ‹
              </button>
              <span style={s.pageCurrent}>
                {orgPage} / {orgPageCount}
              </span>
              <button
                type="button"
                disabled={orgPage >= orgPageCount}
                onClick={() => setOrgPage((page) => Math.min(orgPageCount, page + 1))}
                style={s.pageButton}
              >
                ›
              </button>
            </div>
          </div>
        </aside>

        <section style={s.mainPanel}>
          {loading ? (
            <div style={s.empty}>Loading AFS billing...</div>
          ) : selectedOrganisation ? (
            <>
              <div style={s.orgHeader}>
                <div>
                  <div style={s.orgDetailTitleRow}>
                    <h2 style={s.orgDetailTitle}>{selectedOrganisation.name}</h2>
                    <span
                      style={{
                        ...s.planBadge,
                        ...(selectedOrganisation.afs_plan === "unlimited"
                          ? s.planUnlimited
                          : selectedOrganisation.afs_plan === "flex"
                            ? s.planFlex
                            : s.planNone),
                      }}
                    >
                      {planLabel(selectedOrganisation.afs_plan)}
                    </span>
                  </div>
                  <div style={s.detailMeta}>
                    Billing status:{" "}
                    {selectedOrganisation.afs_billing_enabled ? "Enabled" : "Not enabled"}
                  </div>
                </div>

                {selectedBatch &&
                Number(selectedBatch.subtotal || 0) > 0 &&
                !selectedBatch.invoice_number ? (
                  <button
                    type="button"
                    style={s.primaryButton}
                    onClick={() => openInvoiceForBatch(selectedBatch)}
                  >
                    Record QuickBooks invoice
                  </button>
                ) : null}
              </div>

              <div style={s.detailStats}>
                <Metric
                  label="Plan & status"
                  value={planLabel(selectedOrganisation.afs_plan)}
                  note={
                    selectedOrganisation.afs_billing_enabled
                      ? "Billing enabled"
                      : "Billing not enabled"
                  }
                />
                <Metric
                  label="Free AFS usage"
                  value={`${selectedFreeUsed} free set${selectedFreeUsed === 1 ? "" : "s"} used`}
                  note={
                    selectedFreeUsed > 0
                      ? "Free usage remains visible in billing history"
                      : "No free AFS event recorded"
                  }
                />
                <Metric
                  label="AFS users"
                  value={String(selectedUsers.length)}
                  note="Active users with AFS access"
                />
                <Metric
                  label="Current batch"
                  value={selectedBatch ? money(selectedBatch.subtotal) : "—"}
                  note={batchStatusLabel(selectedBatch)}
                />
                <Metric
                  label="Current uninvoiced"
                  value={money(selectedUninvoiced)}
                  note="Across all AFS billing events"
                />
                <Metric
                  label="Latest QB invoice"
                  value={selectedBatch?.invoice_number || "—"}
                  note={dateText(selectedBatch?.invoice_date)}
                />
              </div>

              <section style={s.section}>
                <div style={s.sectionHeader}>
                  <div>
                    <h3 style={s.sectionTitle}>AFS users ({selectedUsers.length})</h3>
                    <div style={s.sectionSub}>
                      Users currently enabled for Financial Statements.
                    </div>
                  </div>
                </div>

                {selectedUsers.length === 0 ? (
                  <div style={s.empty}>No active AFS users found for this organisation.</div>
                ) : (
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>Name</th>
                          <th style={s.th}>Email</th>
                          <th style={s.th}>Role</th>
                          <th style={s.th}>Access</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUsers.map((user) => (
                          <tr key={user.id}>
                            <td style={s.tdStrong}>{user.full_name || user.email}</td>
                            <td style={s.td}>{user.email}</td>
                            <td style={s.td}>{user.role}</td>
                            <td style={s.td}>
                              <span style={{ ...s.status, ...s.statusGood }}>Active</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {invoiceBatchId === selectedBatch?.id ? (
                <section id="batch-invoice-panel" style={s.invoicePanel}>
                  <div>
                    <div style={s.invoiceTitle}>Link QuickBooks invoice</div>
                    <div style={s.invoiceSub}>
                      This invoice will be linked to the entire monthly organisation batch.
                      No individual AFS items need to be ticked.
                    </div>
                  </div>

                  <div style={s.invoiceGrid}>
                    <div>
                      <div style={s.label}>Billing total</div>
                      <div style={s.invoiceAmount}>{money(selectedBatch.subtotal)}</div>
                    </div>

                    <label>
                      <span style={s.label}>QuickBooks invoice number</span>
                      <input
                        value={invoiceNumber}
                        onChange={(event) => setInvoiceNumber(event.target.value)}
                        placeholder="Example: INV-000123"
                        style={s.input}
                      />
                    </label>

                    <label>
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
                      style={{
                        ...s.primaryButton,
                        opacity: savingInvoice ? 0.6 : 1,
                      }}
                      disabled={savingInvoice}
                      onClick={recordBatchInvoice}
                    >
                      {savingInvoice ? "Saving..." : "Link invoice to batch"}
                    </button>
                  </div>
                </section>
              ) : null}

              <section style={s.section}>
                <div style={s.sectionHeader}>
                  <div>
                    <h3 style={s.sectionTitle}>Billing events</h3>
                    <div style={s.sectionSub}>
                      Full audit trail, including free and covered AFS events.
                    </div>
                  </div>
                </div>

                <BillingEventsTable events={selectedEvents} />
              </section>
            </>
          ) : (
            <>
              <div style={s.portfolioStats}>
                <Metric
                  label="Organisations"
                  value={String(organisations.length)}
                  note="PracticePilot organisations"
                />
                <Metric
                  label="Active subscriptions"
                  value={String(activeSubscriptions)}
                  note="Flex + Unlimited"
                />
                <Metric
                  label="Free sets used"
                  value={String(freeEvents)}
                  note="Retained in billing history"
                />
                <Metric
                  label="Current run uninvoiced"
                  value={money(runSummary.uninvoiced)}
                  note={`${runSummary.invoiceBatches || 0} invoice batch(es)`}
                />
                <Metric
                  label="Invoiced"
                  value={money(invoicedTotal)}
                  note="AFS billing events"
                />
                <Metric
                  label="Paid"
                  value={money(paidTotal)}
                  note="AFS billing events"
                />
                <Metric
                  label="Needs attention"
                  value={String(attentionOrgIds.size)}
                  note="Billing or licence check"
                />
              </div>

              <section style={s.section}>
                <div style={s.sectionHeader}>
                  <div>
                    <h3 style={s.sectionTitle}>Organisation billing overview</h3>
                    <div style={s.sectionSub}>
                      {currentRun
                        ? `${dateText(currentRun.billing_month)} run • Cut-off ${dateText(
                            currentRun.cutoff_date
                          )} • ${currentRun.status}`
                        : "No monthly billing run has been generated yet."}
                    </div>
                  </div>

                  {currentRun ? (
                    <button
                      type="button"
                      style={s.secondaryButton}
                      onClick={exportBillingRunCsv}
                    >
                      Export invoice list
                    </button>
                  ) : null}
                </div>

                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Organisation</th>
                        <th style={s.th}>Plan</th>
                        <th style={s.thRight}>Free / covered</th>
                        <th style={s.thRight}>AFS users</th>
                        <th style={s.thRight}>Chargeable items</th>
                        <th style={s.thRight}>Current batch</th>
                        <th style={s.th}>QB invoice</th>
                        <th style={s.th}>Status</th>
                        <th style={s.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {organisations.slice(0, 100).map((organisation) => {
                        const subscription = subscriptionByOrg.get(organisation.id);
                        const batch = latestBatchByOrg.get(organisation.id);
                        const attention = attentionOrgIds.has(organisation.id);
                        const users = subscription?.active_afs_user_count ?? 0;

                        return (
                          <tr key={organisation.id}>
                            <td style={s.tdStrong}>{organisation.name}</td>
                            <td style={s.td}>{planLabel(organisation.afs_plan)}</td>
                            <td style={s.tdRight}>
                              {batch
                                ? `${batch.free_items_count || 0} / ${
                                    batch.covered_items_count || 0
                                  }`
                                : "—"}
                            </td>
                            <td style={s.tdRight}>{users}</td>
                            <td style={s.tdRight}>
                              {batch?.chargeable_items_count ?? 0}
                            </td>
                            <td style={s.tdRightStrong}>
                              {batch ? money(batch.subtotal) : "—"}
                            </td>
                            <td style={s.td}>{batch?.invoice_number || "—"}</td>
                            <td style={s.td}>
                              <span
                                style={{
                                  ...s.status,
                                  ...(attention
                                    ? s.statusWarn
                                    : batch?.status === "invoiced" ||
                                        batch?.status === "paid"
                                      ? s.statusGood
                                      : s.statusNeutral),
                                }}
                              >
                                {attention
                                  ? "Attention"
                                  : batch
                                    ? batchStatusLabel(batch)
                                    : "No run"}
                              </span>
                            </td>
                            <td style={s.tdRight}>
                              {batch &&
                              Number(batch.subtotal || 0) > 0 &&
                              !batch.invoice_number ? (
                                <button
                                  type="button"
                                  style={s.rowAction}
                                  onClick={() => openInvoiceForBatch(batch)}
                                >
                                  Invoice
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  style={s.rowAction}
                                  onClick={() =>
                                    setSelectedOrganisationId(organisation.id)
                                  }
                                >
                                  View
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section style={s.section}>
                <div style={s.sectionHeader}>
                  <div>
                    <h3 style={s.sectionTitle}>Recent billing events</h3>
                    <div style={s.sectionSub}>
                      Current billing-run audit trail. Free items remain visible at R0.
                    </div>
                  </div>
                </div>

                <BillingEventsTable events={selectedRunEvents} showOrganisation />
              </section>

              {invoiceBatchId ? (
                <section id="batch-invoice-panel" style={s.invoicePanel}>
                  <div>
                    <div style={s.invoiceTitle}>Link QuickBooks invoice</div>
                    <div style={s.invoiceSub}>
                      One invoice number links to the full monthly organisation batch.
                    </div>
                  </div>

                  <div style={s.invoiceGrid}>
                    <div>
                      <div style={s.label}>Organisation</div>
                      <div style={s.invoiceAmount}>
                        {batches.find((batch) => batch.id === invoiceBatchId)
                          ?.organisation_name || "—"}
                      </div>
                    </div>

                    <label>
                      <span style={s.label}>QuickBooks invoice number</span>
                      <input
                        value={invoiceNumber}
                        onChange={(event) => setInvoiceNumber(event.target.value)}
                        placeholder="Example: INV-000123"
                        style={s.input}
                      />
                    </label>

                    <label>
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
                      style={s.primaryButton}
                      disabled={savingInvoice}
                      onClick={recordBatchInvoice}
                    >
                      {savingInvoice ? "Saving..." : "Link invoice to batch"}
                    </button>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div style={s.metric}>
      <div style={s.metricLabel}>{label}</div>
      <div style={s.metricValue}>{value}</div>
      <div style={s.metricNote}>{note}</div>
    </div>
  );
}

function BillingEventsTable({
  events,
  showOrganisation = false,
}: {
  events: BillingItem[];
  showOrganisation?: boolean;
}) {
  if (!events.length) {
    return <div style={s.empty}>No billing events found.</div>;
  }

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Date</th>
            {showOrganisation ? <th style={s.th}>Organisation</th> : null}
            <th style={s.th}>Event</th>
            <th style={s.th}>Description</th>
            <th style={s.thRight}>Amount</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Invoice</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 100).map((event) => {
            const status = normalStatus(event.billing_status);
            const free =
              status === "free" ||
              status === "covered" ||
              event.charge_type === "free_credit";

            return (
              <tr key={event.id}>
                <td style={s.td}>{dateText(event.triggered_at)}</td>
                {showOrganisation ? (
                  <td style={s.tdStrong}>{event.organisation_name}</td>
                ) : null}
                <td style={s.td}>{event.charge_type || "AFS event"}</td>
                <td style={s.tdStrong}>
                  {event.client_name ||
                    (event.charge_type === "free_credit"
                      ? "Free AFS set used"
                      : "AFS billing item")}
                </td>
                <td style={s.tdRight}>{money(event.billing_amount)}</td>
                <td style={s.td}>
                  <span
                    style={{
                      ...s.status,
                      ...(free
                        ? s.statusGood
                        : status === "uninvoiced"
                          ? s.statusWarn
                          : status === "invoiced" || status === "paid"
                            ? s.statusInfo
                            : s.statusNeutral),
                    }}
                  >
                    {free ? "Covered / Free" : status || "—"}
                  </span>
                </td>
                <td style={s.td}>{event.invoice_number || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 54px)",
    background: "#f5f8fc",
    color: "#0f172a",
    padding: "12px 16px 20px",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    color: "#1769e0",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "3px 0 0",
    fontSize: 26,
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 5,
    fontSize: 12,
    color: "#64748b",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  runSelect: {
    height: 32,
    minWidth: 220,
    border: "1px solid #cbd5e1",
    borderRadius: 2,
    background: "#fff",
    padding: "0 8px",
    fontSize: 12,
    color: "#0f172a",
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "330px minmax(0, 1fr)",
    gap: 8,
    alignItems: "start",
  },
  sidebar: {
    background: "#fff",
    border: "1px solid #d8e2ee",
    borderRadius: 2,
    minHeight: 720,
    overflow: "hidden",
  },
  sidebarTitle: {
    padding: "10px 12px 6px",
    fontSize: 14,
    fontWeight: 900,
  },
  searchInput: {
    width: "calc(100% - 20px)",
    margin: "0 10px 8px",
    boxSizing: "border-box",
    height: 32,
    border: "1px solid #cbd5e1",
    borderRadius: 2,
    padding: "0 9px",
    fontSize: 12,
  },
  filterTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 3,
    padding: "0 10px 8px",
  },
  filterTab: {
    height: 28,
    border: "1px solid #dbe4ee",
    borderRadius: 2,
    background: "#fff",
    color: "#475569",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
  },
  filterTabActive: {
    borderColor: "#1769e0",
    color: "#1769e0",
    background: "#eff6ff",
  },
  sortSelect: {
    width: "calc(100% - 20px)",
    margin: "0 10px 8px",
    height: 30,
    border: "1px solid #cbd5e1",
    borderRadius: 2,
    background: "#fff",
    padding: "0 8px",
    fontSize: 11,
  },
  orgList: {
    maxHeight: 520,
    overflowY: "auto",
    borderTop: "1px solid #e6edf5",
  },
  orgRow: {
    width: "100%",
    minHeight: 54,
    border: "none",
    borderBottom: "1px solid #edf2f7",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "8px 10px",
    textAlign: "left",
    cursor: "pointer",
  },
  orgRowSelected: {
    background: "#eef5ff",
    boxShadow: "inset 3px 0 0 #1769e0",
  },
  orgTopLine: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  orgName: {
    fontSize: 12,
    fontWeight: 850,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  orgMeta: {
    marginTop: 3,
    fontSize: 10.5,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chevron: {
    color: "#64748b",
    fontSize: 18,
    flexShrink: 0,
  },
  planBadge: {
    display: "inline-block",
    borderRadius: 2,
    padding: "1px 4px",
    fontSize: 9.5,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  planFlex: {
    color: "#1d4ed8",
    background: "#dbeafe",
  },
  planUnlimited: {
    color: "#047857",
    background: "#d1fae5",
  },
  planNone: {
    color: "#475569",
    background: "#e2e8f0",
  },
  sidebarFooter: {
    padding: 10,
    borderTop: "1px solid #e6edf5",
  },
  sidebarCount: {
    fontSize: 10.5,
    color: "#64748b",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  pageButton: {
    width: 28,
    height: 26,
    border: "1px solid #cbd5e1",
    borderRadius: 2,
    background: "#fff",
    cursor: "pointer",
  },
  pageCurrent: {
    fontSize: 11,
    fontWeight: 800,
    color: "#334155",
  },
  mainPanel: {
    minWidth: 0,
  },
  portfolioStats: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    border: "1px solid #d8e2ee",
    background: "#fff",
    marginBottom: 8,
  },
  detailStats: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    border: "1px solid #d8e2ee",
    background: "#fff",
    marginBottom: 8,
  },
  metric: {
    minWidth: 0,
    padding: "10px 11px",
    borderRight: "1px solid #e2e8f0",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: 850,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  metricValue: {
    marginTop: 5,
    fontSize: 17,
    fontWeight: 900,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  metricNote: {
    marginTop: 3,
    fontSize: 10.5,
    color: "#64748b",
    minHeight: 14,
  },
  orgHeader: {
    background: "#fff",
    border: "1px solid #d8e2ee",
    padding: "10px 12px",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  orgDetailTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  orgDetailTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
  },
  detailMeta: {
    marginTop: 3,
    fontSize: 11,
    color: "#64748b",
  },
  section: {
    background: "#fff",
    border: "1px solid #d8e2ee",
    marginBottom: 8,
  },
  sectionHeader: {
    minHeight: 42,
    padding: "8px 10px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
  },
  sectionSub: {
    marginTop: 2,
    fontSize: 10.5,
    color: "#64748b",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 850,
  },
  th: {
    textAlign: "left",
    padding: "6px 7px",
    background: "#f8fafc",
    borderBottom: "1px solid #dbe4ee",
    fontSize: 10.5,
    fontWeight: 900,
    color: "#475569",
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: "6px 7px",
    background: "#f8fafc",
    borderBottom: "1px solid #dbe4ee",
    fontSize: 10.5,
    fontWeight: 900,
    color: "#475569",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "6px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 11,
    color: "#475569",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "6px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 11,
    color: "#0f172a",
    fontWeight: 800,
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "6px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 11,
    color: "#475569",
    textAlign: "right",
    verticalAlign: "middle",
  },
  tdRightStrong: {
    padding: "6px 7px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 11,
    color: "#0f172a",
    fontWeight: 850,
    textAlign: "right",
    verticalAlign: "middle",
  },
  status: {
    display: "inline-block",
    borderRadius: 2,
    padding: "2px 5px",
    fontSize: 9.5,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  statusGood: {
    background: "#dcfce7",
    color: "#166534",
  },
  statusWarn: {
    background: "#ffedd5",
    color: "#9a3412",
  },
  statusInfo: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  statusNeutral: {
    background: "#e2e8f0",
    color: "#475569",
  },
  invoicePanel: {
    background: "#f8fbff",
    border: "1px solid #9fc0f0",
    padding: "10px 12px",
    marginBottom: 8,
  },
  invoiceTitle: {
    fontSize: 13,
    fontWeight: 900,
  },
  invoiceSub: {
    marginTop: 2,
    fontSize: 10.5,
    color: "#64748b",
  },
  invoiceGrid: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "180px 1fr 170px 190px",
    gap: 7,
    alignItems: "end",
  },
  invoiceAmount: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: 900,
  },
  label: {
    display: "block",
    marginBottom: 3,
    fontSize: 10.5,
    fontWeight: 850,
    color: "#475569",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: 31,
    border: "1px solid #bfc9d6",
    borderRadius: 2,
    padding: "0 8px",
    fontSize: 11,
    background: "#fff",
  },
  primaryButton: {
    minHeight: 31,
    border: "1px solid #1769e0",
    borderRadius: 2,
    background: "#1769e0",
    color: "#fff",
    fontSize: 11,
    fontWeight: 850,
    padding: "0 11px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    minHeight: 31,
    border: "1px solid #cbd5e1",
    borderRadius: 2,
    background: "#fff",
    color: "#0f172a",
    fontSize: 11,
    fontWeight: 850,
    padding: "0 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  rowAction: {
    border: "1px solid #cbd5e1",
    borderRadius: 2,
    background: "#fff",
    color: "#1769e0",
    padding: "3px 7px",
    fontSize: 10,
    fontWeight: 850,
    cursor: "pointer",
  },
  empty: {
    background: "#fff",
    padding: 14,
    color: "#64748b",
    fontSize: 12,
  },
  error: {
    marginBottom: 8,
    padding: "8px 10px",
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    fontSize: 11,
  },
  success: {
    marginBottom: 8,
    padding: "8px 10px",
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: 11,
  },
};
