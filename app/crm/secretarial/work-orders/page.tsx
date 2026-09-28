"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type WorkOrderRow = {
  id: string;
  work_order_number: string;
  relationship_name: string;
  work_order_type: string;
  title: string;
  proposed_entity_name: string | null;
  status: string;
  mandate_status: string;
  payment_status: string;
  fee_ex_vat: number | null;
  created_at: string;
  progress_completed: number;
  progress_total: number;
};

type Option = {
  id: string;
  client_name?: string;
  client_code?: string | null;
  group_name?: string;
};

type StatusFilter = "all" | "active" | "waiting" | "ready_to_bill" | "completed";

const optionalServices = [
  ["registered_rep", "Registered Representative update"],
  ["paye_registration", "PAYE Registration"],
  ["uif_dol_registration", "UIF (DOL) Registration"],
  ["coida_registration", "COIDA Registration"],
] as const;

export default function SecretarialWorkOrdersPage() {
  const [rows, setRows] = useState<WorkOrderRow[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [scopeType, setScopeType] = useState<
    "client" | "group" | "new_party"
  >("group");
  const [scopeId, setScopeId] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [contactCcEmail, setContactCcEmail] = useState("");
  const [updateRecipientMode, setUpdateRecipientMode] = useState<
    "primary_only" | "primary_and_cc"
  >("primary_only");
  const [workOrderType, setWorkOrderType] = useState<
    "new_entity_registration" | "company_name_change"
  >("new_entity_registration");
  const [proposedEntityName, setProposedEntityName] = useState("");
  const [feeExVat, setFeeExVat] = useState("");
  const [selectedOptional, setSelectedOptional] = useState<string[]>([]);
  const [workStartGate, setWorkStartGate] = useState("no_payment_required");
  const [releaseGate, setReleaseGate] = useState("full_payment_required");
  const [billingTrigger, setBillingTrigger] = useState(
    "all_required_work_complete"
  );

  async function getToken() {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not signed in.");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();
      const response = await fetch("/api/crm/secretarial/work-orders", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load work orders.");
      }

      setRows(result.rows || []);
      setClients(result.clients || []);
      setGroups(result.groups || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load work orders."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      active: rows.filter((r) =>
        [
          "draft",
          "mandate_sent",
          "mandate_accepted",
          "awaiting_payment",
          "ready_to_start",
          "in_progress",
        ].includes(r.status)
      ).length,
      waiting: rows.filter((r) => r.status === "waiting_external").length,
      ready_to_bill: rows.filter((r) => r.status === "ready_to_bill").length,
      completed: rows.filter((r) =>
        ["billed", "completed"].includes(r.status)
      ).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !term ||
        [
          row.work_order_number,
          row.relationship_name,
          row.title,
          row.proposed_entity_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          [
            "draft",
            "mandate_sent",
            "mandate_accepted",
            "awaiting_payment",
            "ready_to_start",
            "in_progress",
          ].includes(row.status)) ||
        (statusFilter === "waiting" && row.status === "waiting_external") ||
        (statusFilter === "ready_to_bill" && row.status === "ready_to_bill") ||
        (statusFilter === "completed" &&
          ["billed", "completed"].includes(row.status));

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  function resetCreate() {
    setScopeType("group");
    setScopeId("");
    setNewPartyName("");
    setContactPersonName("");
    setContactEmail("");
    setContactMobile("");
    setContactCcEmail("");
    setUpdateRecipientMode("primary_only");
    setWorkOrderType("new_entity_registration");
    setProposedEntityName("");
    setFeeExVat("");
    setSelectedOptional([]);
    setWorkStartGate("no_payment_required");
    setReleaseGate("full_payment_required");
    setBillingTrigger("all_required_work_complete");
  }

  function toggleOptional(code: string) {
    setSelectedOptional((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    );
  }

  async function createWorkOrder() {
    setSaving(true);
    setError("");

    try {
      if (scopeType !== "new_party" && !scopeId) {
        throw new Error("Select a client or client group.");
      }

      if (scopeType === "new_party" && !newPartyName.trim()) {
        throw new Error("Enter the client / business name.");
      }

      if (!contactPersonName.trim()) {
        throw new Error("Contact person is required.");
      }

      if (!contactEmail.trim() || !contactEmail.includes("@")) {
        throw new Error("A valid mandate email address is required.");
      }

      const token = await getToken();
      const response = await fetch("/api/crm/secretarial/work-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scopeType,
          scopeId,
          newPartyName,
          contactPersonName,
          contactEmail,
          contactMobile,
          contactCcEmail,
          updateRecipientMode,
          workOrderType,
          proposedEntityName,
          feeExVat,
          optionalServices: selectedOptional,
          workStartGate,
          releaseGate,
          billingTrigger,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not create work order.");
      }

      setShowCreate(false);
      resetCreate();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create work order."
      );
    } finally {
      setSaving(false);
    }
  }

  const scopeOptions = scopeType === "client" ? clients : groups;

  return (
    <main style={page}>
      <section style={crumbBar}>
        <Link href="/crm/secretarial" style={crumbLink}>
          Secretarial
        </Link>
        <span style={crumbDivider}>›</span>
        <strong>Work Orders</strong>
        <span style={crumbDivider}>|</span>
        <span style={crumbMuted}>
          Registrations, changes, mandates, progress and billing
        </span>
      </section>

      <section style={header}>
        <div>
          <h1 style={title}>Secretarial Work Orders</h1>
          <p style={subtitle}>
            Manage secretarial jobs from client instruction through mandate,
            progress updates, payment controls and billing.
          </p>
        </div>

        <button
          type="button"
          style={primaryButton}
          onClick={() => setShowCreate(true)}
        >
          + New Work Order
        </button>
      </section>

      {error ? <div style={errorBar}>{error}</div> : null}

      <section style={toolbar}>
        <div style={statusTabs}>
          {[
            ["all", `All (${counts.all})`],
            ["active", `In Progress (${counts.active})`],
            ["waiting", `Waiting (${counts.waiting})`],
            ["ready_to_bill", `Ready to Bill (${counts.ready_to_bill})`],
            ["completed", `Completed (${counts.completed})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key as StatusFilter)}
              style={{
                ...tab,
                ...(statusFilter === key ? activeTab : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search work orders..."
          style={searchInput}
        />
      </section>

      <section style={panel}>
        <div style={tableHeader}>
          <span>#</span>
          <span>Client / Group</span>
          <span>Work Type</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Next Action</span>
          <span>Billing</span>
          <span>Created</span>
          <span />
        </div>

        {loading ? <div style={empty}>Loading work orders...</div> : null}

        {!loading && filtered.length === 0 ? (
          <div style={empty}>
            No Secretarial Work Orders match this view.
          </div>
        ) : null}

        {filtered.map((row) => {
          const progress =
            row.progress_total > 0
              ? Math.round(
                  (row.progress_completed / row.progress_total) * 100
                )
              : 0;

          const nextAction =
            row.mandate_status === "not_sent"
              ? "Send mandate"
              : row.mandate_status === "sent"
              ? "Await client"
              : row.status === "awaiting_payment"
              ? "Await payment"
              : row.status === "waiting_external"
              ? "Follow up"
              : row.status === "ready_to_bill"
              ? "Bill client"
              : "Continue work";

          return (
            <Link
              key={row.id}
              href={`/crm/secretarial/work-orders/${row.id}`}
              style={tableRow}
            >
              <strong>{row.work_order_number}</strong>

              <div>
                <strong style={relationshipName}>
                  {row.relationship_name}
                </strong>
                {row.proposed_entity_name ? (
                  <span style={rowMeta}>{row.proposed_entity_name}</span>
                ) : null}
              </div>

              <span style={cellText}>
                {row.work_order_type === "new_entity_registration"
                  ? "New Entity Registration"
                  : row.work_order_type === "company_name_change"
                  ? "Name Change"
                  : "Secretarial"}
              </span>

              <span style={statusBadge}>
                {row.status.replaceAll("_", " ")}
              </span>

              <div>
                <div style={progressText}>
                  {row.progress_completed}/{row.progress_total}
                </div>
                <div style={progressTrack}>
                  <span
                    style={{
                      ...progressFill,
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>

              <span style={cellText}>{nextAction}</span>

              <span style={cellText}>
                {row.payment_status === "not_invoiced"
                  ? "Not billed"
                  : row.payment_status.replaceAll("_", " ")}
              </span>

              <span style={cellText}>
                {new Date(row.created_at).toLocaleDateString("en-ZA")}
              </span>

              <span style={openArrow}>→</span>
            </Link>
          );
        })}
      </section>

      {showCreate ? (
        <div style={modalBackdrop}>
          <section style={modal}>
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>Create Secretarial Work Order</h2>
                <p style={modalSubtitle}>
                  Create the job, choose the scope and set payment behaviour.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={closeButton}
              >
                ×
              </button>
            </div>

            <div style={modalBody}>
              <div style={scopeTabs}>
                <button
                  type="button"
                  onClick={() => {
                    setScopeType("group");
                    setScopeId("");
                  }}
                  style={{
                    ...scopeTab,
                    ...(scopeType === "group" ? scopeTabActive : {}),
                  }}
                >
                  Client Group
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScopeType("client");
                    setScopeId("");
                  }}
                  style={{
                    ...scopeTab,
                    ...(scopeType === "client" ? scopeTabActive : {}),
                  }}
                >
                  Client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScopeType("new_party");
                    setScopeId("");
                  }}
                  style={{
                    ...scopeTab,
                    ...(scopeType === "new_party" ? scopeTabActive : {}),
                  }}
                >
                  New / Not yet in PP
                </button>
              </div>

              <div style={formGrid}>
                {scopeType !== "new_party" ? (
                  <label style={fieldWide}>
                    <span style={label}>
                      {scopeType === "group" ? "Client Group" : "Client"}
                    </span>
                    <select
                      value={scopeId}
                      onChange={(event) => setScopeId(event.target.value)}
                      style={input}
                    >
                      <option value="">Select...</option>
                      {scopeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.group_name ||
                            option.client_name ||
                            option.id}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label style={fieldWide}>
                    <span style={label}>Client / Business Name</span>
                    <input
                      value={newPartyName}
                      onChange={(event) => setNewPartyName(event.target.value)}
                      placeholder="Person or business instructing Bizzacc"
                      style={input}
                    />
                  </label>
                )}

                <div style={contactPanel}>
                  <div style={contactPanelTitle}>Mandate & Contact Details</div>

                  <label style={field}>
                    <span style={label}>Contact Person *</span>
                    <input
                      value={contactPersonName}
                      onChange={(event) =>
                        setContactPersonName(event.target.value)
                      }
                      placeholder="Full name"
                      style={input}
                    />
                  </label>

                  <label style={field}>
                    <span style={label}>Email Address *</span>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      placeholder="Mandate + progress updates"
                      style={input}
                    />
                  </label>

                  <label style={field}>
                    <span style={label}>Mobile</span>
                    <input
                      value={contactMobile}
                      onChange={(event) => setContactMobile(event.target.value)}
                      placeholder="Optional"
                      style={input}
                    />
                  </label>

                  <label style={field}>
                    <span style={label}>CC Email</span>
                    <input
                      type="email"
                      value={contactCcEmail}
                      onChange={(event) => setContactCcEmail(event.target.value)}
                      placeholder="Optional secondary recipient"
                      style={input}
                    />
                  </label>

                  <label style={fieldWide}>
                    <span style={label}>Send Progress Updates To</span>
                    <select
                      value={updateRecipientMode}
                      onChange={(event) =>
                        setUpdateRecipientMode(
                          event.target.value as
                            | "primary_only"
                            | "primary_and_cc"
                        )
                      }
                      style={input}
                    >
                      <option value="primary_only">Primary contact only</option>
                      <option value="primary_and_cc">
                        Primary contact + CC
                      </option>
                    </select>
                  </label>
                </div>

                <label style={field}>
                  <span style={label}>Work Order Type</span>
                  <select
                    value={workOrderType}
                    onChange={(event) =>
                      setWorkOrderType(
                        event.target.value as
                          | "new_entity_registration"
                          | "company_name_change"
                      )
                    }
                    style={input}
                  >
                    <option value="new_entity_registration">
                      New Entity Registration
                    </option>
                    <option value="company_name_change">
                      Company Name Change
                    </option>
                  </select>
                </label>

                <label style={field}>
                  <span style={label}>
                    {workOrderType === "new_entity_registration"
                      ? "Proposed Company Name"
                      : "Proposed New Name"}
                  </span>
                  <input
                    value={proposedEntityName}
                    onChange={(event) =>
                      setProposedEntityName(event.target.value)
                    }
                    placeholder="Optional"
                    style={input}
                  />
                </label>
              </div>

              {workOrderType === "new_entity_registration" ? (
                <div style={servicesGrid}>
                  <div style={servicePanel}>
                    <h3 style={serviceTitle}>Included Services</h3>
                    {[
                      "Name reservation",
                      "Company registration",
                      "1st Beneficial Ownership filing",
                      "PAIA Manual",
                    ].map((item) => (
                      <div key={item} style={serviceRow}>
                        <span style={checkedBox}>✓</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div style={servicePanel}>
                    <h3 style={serviceTitle}>Optional Services</h3>
                    {optionalServices.map(([code, labelText]) => (
                      <label key={code} style={optionRow}>
                        <input
                          type="checkbox"
                          checked={selectedOptional.includes(code)}
                          onChange={() => toggleOptional(code)}
                        />
                        <span>{labelText}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div style={commercialGrid}>
                <label style={field}>
                  <span style={label}>Fee excl. VAT</span>
                  <div style={moneyField}>
                    <span>R</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={feeExVat}
                      onChange={(event) => setFeeExVat(event.target.value)}
                      style={input}
                    />
                  </div>
                </label>

                <label style={field}>
                  <span style={label}>Work Start Rule</span>
                  <select
                    value={workStartGate}
                    onChange={(event) =>
                      setWorkStartGate(event.target.value)
                    }
                    style={input}
                  >
                    <option value="no_payment_required">
                      Proceed with work
                    </option>
                    <option value="deposit_required">
                      Deposit required first
                    </option>
                    <option value="full_payment_required">
                      Full payment upfront
                    </option>
                  </select>
                </label>

                <label style={field}>
                  <span style={label}>Release Rule</span>
                  <select
                    value={releaseGate}
                    onChange={(event) =>
                      setReleaseGate(event.target.value)
                    }
                    style={input}
                  >
                    <option value="full_payment_required">
                      Hold final work until fully paid
                    </option>
                    <option value="deposit_required">
                      Release after deposit
                    </option>
                    <option value="release_regardless">
                      Release regardless
                    </option>
                  </select>
                </label>

                <label style={field}>
                  <span style={label}>Billing Trigger</span>
                  <select
                    value={billingTrigger}
                    onChange={(event) =>
                      setBillingTrigger(event.target.value)
                    }
                    style={input}
                  >
                    <option value="all_required_work_complete">
                      All required work complete
                    </option>
                    <option value="registration_completed">
                      Registration completed
                    </option>
                    <option value="mandate_accepted">
                      Mandate accepted
                    </option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
              </div>
            </div>

            <div style={modalFooter}>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={createWorkOrder}
                style={primaryButton}
                disabled={saving}
              >
                {saving ? "Creating..." : "Create Work Order"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "10px 12px 28px",
  background: "#eef2f5",
  color: "#10233a",
};

const crumbBar: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
  fontSize: "10px",
};

const crumbLink: React.CSSProperties = {
  color: "#1758d5",
  textDecoration: "none",
  fontWeight: 900,
};

const crumbDivider: React.CSSProperties = { color: "#94a3b8" };
const crumbMuted: React.CSSProperties = { color: "#64748b" };

const header: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "78px",
  padding: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "10px",
};

const primaryButton: React.CSSProperties = {
  height: "30px",
  padding: "0 11px",
  border: "1px solid #1758d5",
  background: "#1758d5",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  height: "30px",
  padding: "0 11px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const toolbar: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "42px",
  padding: "6px 8px",
  display: "grid",
  gridTemplateColumns: "auto minmax(260px, 1fr)",
  gap: "8px",
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const statusTabs: React.CSSProperties = {
  display: "flex",
  gap: "4px",
};

const tab: React.CSSProperties = {
  height: "28px",
  padding: "0 9px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const activeTab: React.CSSProperties = {
  background: "#10233a",
  borderColor: "#10233a",
  color: "#ffffff",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  height: "28px",
  padding: "0 8px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  fontSize: "8px",
};

const panel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const tableHeader: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "100px minmax(180px,1.2fr) minmax(170px,1.1fr) 115px 120px 125px 100px 95px 40px",
  gap: "7px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "7.5px",
  fontWeight: 900,
};

const tableRow: React.CSSProperties = {
  minHeight: "46px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns:
    "100px minmax(180px,1.2fr) minmax(170px,1.1fr) 115px 120px 125px 100px 95px 40px",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "8px",
};

const relationshipName: React.CSSProperties = {
  display: "block",
  fontSize: "8.5px",
  fontWeight: 900,
};

const rowMeta: React.CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7px",
};

const cellText: React.CSSProperties = {
  color: "#526174",
  fontSize: "8px",
  textTransform: "capitalize",
};

const statusBadge: React.CSSProperties = {
  minHeight: "20px",
  padding: "0 6px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#eef5ff",
  color: "#1758d5",
  border: "1px solid #dbeafe",
  fontSize: "7px",
  fontWeight: 850,
  textTransform: "capitalize",
};

const progressText: React.CSSProperties = {
  fontSize: "7.5px",
  fontWeight: 850,
};

const progressTrack: React.CSSProperties = {
  height: "4px",
  marginTop: "4px",
  background: "#e5eaf0",
  overflow: "hidden",
};

const progressFill: React.CSSProperties = {
  display: "block",
  height: "100%",
  background: "#1758d5",
};

const openArrow: React.CSSProperties = {
  color: "#1758d5",
  fontSize: "20px",
  fontWeight: 900,
  textAlign: "right",
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

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "grid",
  placeItems: "center",
  background: "rgba(15,35,58,0.32)",
  padding: "20px",
};

const modal: React.CSSProperties = {
  width: "min(920px, 96vw)",
  maxHeight: "92vh",
  overflow: "auto",
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  boxShadow: "0 18px 55px rgba(15,35,58,.22)",
};

const modalHeader: React.CSSProperties = {
  minHeight: "64px",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #d8dee7",
};

const modalTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 950,
};

const modalSubtitle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: "8px",
};

const closeButton: React.CSSProperties = {
  width: "30px",
  height: "30px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#526174",
  fontSize: "18px",
  cursor: "pointer",
};

const modalBody: React.CSSProperties = {
  padding: "12px",
};

const scopeTabs: React.CSSProperties = {
  display: "flex",
  gap: "5px",
  marginBottom: "10px",
};

const scopeTab: React.CSSProperties = {
  height: "28px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const scopeTabActive: React.CSSProperties = {
  background: "#10233a",
  borderColor: "#10233a",
  color: "#ffffff",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "9px",
};

const commercialGrid: React.CSSProperties = {
  marginTop: "10px",
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: "9px",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const fieldWide: React.CSSProperties = {
  ...field,
  gridColumn: "1 / -1",
};

const label: React.CSSProperties = {
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  height: "30px",
  boxSizing: "border-box",
  padding: "0 7px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8.5px",
};

const contactPanel: React.CSSProperties = {
  gridColumn: "1 / -1",
  padding: "10px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "9px",
  border: "1px solid #d8dee7",
  background: "#f8fafc",
};

const contactPanelTitle: React.CSSProperties = {
  gridColumn: "1 / -1",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 900,
};

const servicesGrid: React.CSSProperties = {
  marginTop: "10px",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "9px",
};

const servicePanel: React.CSSProperties = {
  padding: "10px",
  border: "1px solid #d8dee7",
  background: "#f8fafc",
};

const serviceTitle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: "9px",
  fontWeight: 900,
};

const serviceRow: React.CSSProperties = {
  minHeight: "28px",
  display: "flex",
  alignItems: "center",
  gap: "7px",
  color: "#334155",
  fontSize: "8px",
};

const checkedBox: React.CSSProperties = {
  width: "16px",
  height: "16px",
  display: "grid",
  placeItems: "center",
  background: "#1758d5",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 900,
};

const optionRow: React.CSSProperties = {
  minHeight: "28px",
  display: "flex",
  alignItems: "center",
  gap: "7px",
  color: "#334155",
  fontSize: "8px",
};

const moneyField: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "18px minmax(0,1fr)",
  gap: "4px",
  alignItems: "center",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 850,
};

const modalFooter: React.CSSProperties = {
  minHeight: "54px",
  padding: "9px 12px",
  display: "flex",
  justifyContent: "flex-end",
  gap: "7px",
  borderTop: "1px solid #d8dee7",
};

