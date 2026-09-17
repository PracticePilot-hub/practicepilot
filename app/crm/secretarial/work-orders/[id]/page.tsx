"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type WorkOrder = {
  id: string;
  work_order_number: string;
  relationship_name: string;
  work_order_type: string;
  title: string;
  proposed_entity_name: string | null;
  status: string;
  mandate_status: string;
  payment_status: string;
  work_start_gate: string;
  release_gate: string;
  billing_trigger: string;
  fee_ex_vat: number | null;
  fee_inc_vat: number | null;
  client_progress_link_token: string;
  progress_completed: number;
  progress_total: number;
  contact_person_name: string | null;
  contact_email: string | null;
  contact_mobile: string | null;
  contact_cc_email: string | null;
  update_recipient_mode: "primary_only" | "primary_and_cc";
  client_id?: string | null;
  client_group_id?: string | null;
  created_at?: string | null;
};

type Item = {
  id: string;
  item_code: string;
  item_label: string;
  is_required: boolean;
  is_selected: boolean;
  status: string;
  client_update_enabled: boolean;
};

type UpdateRow = {
  id: string;
  update_type: string;
  subject: string | null;
  message: string;
  delivery_status: string;
  created_at: string;
};

const statusOptions = [
  ["not_started", "Not started"],
  ["in_progress", "In progress"],
  ["waiting", "Waiting"],
  ["done", "Done"],
  ["not_applicable", "N/A"],
];

function money(value: number | null) {
  if (value == null) return "—";

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function SecretarialWorkOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const workOrderId = String(params?.id || "");

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState("");
  const [sendingMandate, setSendingMandate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const [contactPersonName, setContactPersonName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [contactCcEmail, setContactCcEmail] = useState("");
  const [updateRecipientMode, setUpdateRecipientMode] = useState<
    "primary_only" | "primary_and_cc"
  >("primary_only");

  const [error, setError] = useState("");

  async function getToken() {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error("You are not signed in.");

    return session.access_token;
  }

  async function load() {
    if (!workOrderId) return;

    setLoading(true);
    setError("");

    try {
      const token = await getToken();
      const response = await fetch(
        `/api/crm/secretarial/work-orders/${workOrderId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load work order.");
      }

      setOrder(result.order);
      setItems(result.items || []);
      setUpdates(result.updates || []);

      setContactPersonName(result.order?.contact_person_name || "");
      setContactEmail(result.order?.contact_email || "");
      setContactMobile(result.order?.contact_mobile || "");
      setContactCcEmail(result.order?.contact_cc_email || "");
      setUpdateRecipientMode(
        result.order?.update_recipient_mode === "primary_and_cc"
          ? "primary_and_cc"
          : "primary_only"
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load work order."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [workOrderId]);

  const progress = useMemo(() => {
    if (!order?.progress_total) return 0;
    return Math.round(
      (order.progress_completed / order.progress_total) * 100
    );
  }, [order]);

  async function updateItem(itemId: string, status: string) {
    setSavingItemId(itemId);
    setError("");

    try {
      const token = await getToken();

      const response = await fetch(
        `/api/crm/secretarial/work-orders/${workOrderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "update-item-status",
            itemId,
            status,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not update checklist item.");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update checklist item."
      );
    } finally {
      setSavingItemId("");
    }
  }

  async function sendMandate() {
    setSendingMandate(true);
    setError("");

    try {
      const token = await getToken();

      const response = await fetch(
        `/api/crm/secretarial/work-orders/${workOrderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "send-mandate",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not activate mandate.");
      }

      const url = `${window.location.origin}/mandate/${result.token}`;

      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        setCopied(false);
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not activate mandate."
      );
    } finally {
      setSendingMandate(false);
    }
  }

  async function copyClientLink() {
    if (!order?.client_progress_link_token) return;

    const url = `${window.location.origin}/mandate/${order.client_progress_link_token}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the client link.");
    }
  }

  async function markPayment(paymentStatus: string) {
    setError("");

    try {
      const token = await getToken();

      const response = await fetch(
        `/api/crm/secretarial/work-orders/${workOrderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "mark-payment-status",
            paymentStatus,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not update payment status.");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update payment status."
      );
    }
  }

  async function saveContact() {
    setSavingContact(true);
    setError("");

    try {
      const token = await getToken();

      const response = await fetch(
        `/api/crm/secretarial/work-orders/${workOrderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "update-contact",
            contactPersonName,
            contactEmail,
            contactMobile,
            contactCcEmail,
            updateRecipientMode,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not update mandate contact.");
      }

      setEditingContact(false);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update mandate contact."
      );
    } finally {
      setSavingContact(false);
    }
  }

  const latestChangeRequest = updates.find(
    (row) => row.subject === "Client requested mandate changes"
  );

  const latestDecline = updates.find(
    (row) => row.subject === "Mandate declined"
  );

  if (loading) {
    return (
      <main style={page}>
        <div style={loadingBox}>Loading work order...</div>
      </main>
    );
  }

  if (!order) {
    return (
      <main style={page}>
        <div style={errorBar}>{error || "Work order not found."}</div>
      </main>
    );
  }

  const mandateLabel = order.mandate_status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const paymentLabel = order.payment_status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const workStartLabel = order.work_start_gate
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const releaseLabel = order.release_gate
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const billingTriggerLabel = order.billing_trigger
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  function displayItemLabel(item: Item) {
    const raw = String(item.item_label || "").toLowerCase();
    return item.item_code === "actual_registration" || raw === "actual registration"
      ? "Company registration"
      : item.item_label;
  }

  function itemDescription(item: Item) {
    const label = displayItemLabel(item).toLowerCase();

    if (label.includes("name reservation")) return "Reserve the company name with CIPC.";
    if (label.includes("company registration")) return "Register the company with CIPC.";
    if (label.includes("beneficial ownership")) return "Submit initial beneficial ownership filing.";
    if (label.includes("paia")) return "Prepare and publish the PAIA Manual.";

    return item.is_required ? "Required work-order step." : "Optional work-order step.";
  }

  function actionStatus(item: Item) {
    if (item.status === "not_started") return "in_progress";
    if (item.status === "done") return "not_started";
    return "done";
  }

  function actionLabel(item: Item) {
    if (item.status === "not_started") return "Start";
    if (item.status === "done") return "Reopen";
    return "Complete";
  }

  const selectedItems = items.filter((item) => item.is_selected !== false);
  const selectedDone = selectedItems.filter((item) =>
    ["done", "not_applicable"].includes(item.status)
  ).length;
  const selectedProgress =
    selectedItems.length > 0
      ? Math.round((selectedDone / selectedItems.length) * 100)
      : 0;

  const clientLink =
    typeof window !== "undefined" && order.client_progress_link_token
      ? `${window.location.origin}/mandate/${order.client_progress_link_token}`
      : "";

  return (
    <main style={page}>
      <div style={crumbs}>
        <Link href="/crm/secretarial" style={crumbLink}>Secretarial</Link>
        <span>›</span>
        <Link href="/crm/secretarial/work-orders" style={crumbLink}>Work Orders</Link>
        <span>›</span>
        <strong>{order.work_order_number}</strong>
      </div>

      <section style={commandBar}>
        <div style={identityWrap}>
          <div style={commandIcon}>▦</div>
          <div>
            <div style={sectionKicker}>Secretarial Work Order</div>
            <div style={titleLine}>
              <h1 style={title}>{order.title}</h1>
              <span style={statusPill}>{mandateLabel}</span>
            </div>
            <div style={metaLine}>
              <strong>{order.work_order_number}</strong>
              <span>•</span>
              <span>{order.relationship_name}</span>
              <span>•</span>
              <span>New company registration</span>
              {order.created_at ? (
                <>
                  <span>•</span>
                  <span>Created {new Date(order.created_at).toLocaleDateString("en-ZA")}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div style={topActions}>
          <button type="button" style={primaryButton} onClick={sendMandate} disabled={sendingMandate}>
            {sendingMandate ? "Sending..." : "Resend Mandate Email"}
          </button>
          <button type="button" style={secondaryButton} onClick={() => setEditingContact((v) => !v)}>
            Edit Contact Details
          </button>
          <button type="button" style={secondaryButton} onClick={copyClientLink}>
            {copied ? "Copied" : "Copy Client Link"}
          </button>
          <details style={moreWrap}>
            <summary style={moreSummary}>More Actions</summary>
            <div style={moreMenu}>
              <button type="button" style={menuItem} onClick={() => markPayment("invoiced")}>Mark Invoiced</button>
              <button type="button" style={menuItem} onClick={() => markPayment("part_paid")}>Mark Part Paid</button>
              <button type="button" style={menuItem} onClick={() => markPayment("paid")}>Mark Paid</button>
            </div>
          </details>
        </div>
      </section>

      {order.mandate_status === "changes_requested" ? (
        <section style={requestBanner}>
          <div style={requestIcon}>!</div>
          <div>
            <div style={requestHeading}>Client Requested Changes</div>
            <div style={requestText}>
              {latestChangeRequest?.message ||
                "The client requested changes to this mandate. Review the scope before resending."}
            </div>
          </div>
          <div style={requestMeta}>
            {latestChangeRequest?.created_at
              ? new Date(latestChangeRequest.created_at).toLocaleString("en-ZA")
              : "Review before resending"}
          </div>
        </section>
      ) : null}

      {order.mandate_status === "declined" ? (
        <section style={declinedBanner}>
          <div style={requestIcon}>×</div>
          <div>
            <div style={requestHeading}>Mandate Declined</div>
            <div style={requestText}>
              {latestDecline?.message || "The client declined this mandate."}
            </div>
          </div>
        </section>
      ) : null}

      {error ? <div style={errorBar}>{error}</div> : null}

      <section style={bodyGrid}>
        <div style={mainColumn}>
          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Work Order Checklist</h2>
                <p style={panelText}>Complete all steps to finalise this secretarial work order.</p>
              </div>
              <div style={progressBox}>
                <div style={progressLabels}>
                  <strong>{selectedProgress}% complete</strong>
                  <span>{selectedDone}/{selectedItems.length} steps</span>
                </div>
                <div style={progressTrack}>
                  <span style={{ ...progressFill, width: `${selectedProgress}%` }} />
                </div>
              </div>
            </div>

            <div style={checklistHead}>
              <span>#</span>
              <span>Step</span>
              <span>Status</span>
              <span>Assigned to</span>
              <span>Due date</span>
              <span>Actions</span>
            </div>

            {items
              .filter((item) => item.is_selected !== false)
              .map((item, index) => (
              <div key={item.id} style={checklistRow}>
                <strong>{index + 1}</strong>

                <div style={stepCell}>
                  <span
                    style={{
                      ...stepBubble,
                      background:
                        index === 0 ? "#4f8fe8" :
                        index === 1 ? "#59b84b" :
                        index === 2 ? "#7853c5" : "#f28a1a",
                    }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <strong style={stepTitle}>{displayItemLabel(item)}</strong>
                    <span style={stepSub}>{itemDescription(item)}</span>
                  </div>
                </div>

                <select
                  value={item.status}
                  onChange={(e) => void updateItem(item.id, e.target.value)}
                  disabled={savingItemId === item.id}
                  style={select}
                >
                  {statusOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>

                <div style={mutedCell}>○ Unassigned</div>
                <div style={mutedCell}>—</div>

                <div style={rowActionCell}>
                  <button
                    type="button"
                    style={startButton}
                    onClick={() => void updateItem(item.id, actionStatus(item))}
                    disabled={savingItemId === item.id}
                  >
                    {savingItemId === item.id ? "Saving..." : actionLabel(item)}
                  </button>
                  <span style={dots}>⋮</span>
                </div>
              </div>
            ))}
          </section>

          <section style={activityPanel}>
            <div style={activityTabs}>
              <button type="button" style={activeTab}>Activity Feed</button>
              <button type="button" style={inactiveTab}>Documents (0)</button>
            </div>

            <div>
              {updates.length === 0 ? (
                <div style={emptyState}>No activity recorded yet.</div>
              ) : (
                updates.map((row) => {
                  const isRequest = row.subject === "Client requested mandate changes";
                  const isMandate = row.update_type === "mandate_sent";

                  return (
                    <div key={row.id} style={activityRow}>
                      <span
                        style={{
                          ...activityDot,
                          background: isRequest ? "#e97000" : isMandate ? "#1769e0" : "#64748b",
                        }}
                      >
                        {isRequest ? "!" : isMandate ? "✉" : "•"}
                      </span>

                      <div>
                        <strong style={{ ...activityTitle, color: isRequest ? "#b54708" : "#10233a" }}>
                          {isRequest ? "Client requested changes" : row.subject || "Work order update"}
                        </strong>
                        <span style={activityText}>{row.message}</span>
                      </div>

                      <div style={activityMeta}>{new Date(row.created_at).toLocaleString("en-ZA")}</div>
                      <div style={activityMeta}>{isRequest ? "Received" : row.delivery_status}</div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside style={sideColumn}>
          <section style={sideCard}>
            <div style={sideHeader}><h2 style={sideTitle}>Mandate & Billing</h2></div>
            <div style={detailList}>
              <div style={detailRow}><span>Mandate status</span><strong style={warn}>{mandateLabel}</strong></div>
              <div style={detailRow}><span>Work may start</span><strong>{workStartLabel}</strong></div>
              <div style={detailRow}><span>Final work release</span><strong>{releaseLabel}</strong></div>
              <div style={detailRow}><span>Billing status</span><strong>{paymentLabel}</strong></div>
              <div style={detailRow}><span>Billing trigger</span><strong>{billingTriggerLabel}</strong></div>
            </div>
          </section>

          <section style={sideCard}>
            <div style={sideHeader}>
              <h2 style={sideTitle}>Client Contact</h2>
              <button type="button" style={editButton} onClick={() => setEditingContact((v) => !v)}>
                {editingContact ? "Cancel" : "Edit"}
              </button>
            </div>

            {!editingContact ? (
              <div style={contactBody}>
                <div style={contactIdentity}>
                  <div style={avatar}>
                    {(order.contact_person_name || "C")
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <strong style={contactName}>{order.contact_person_name || "No contact loaded"}</strong>
                    <span style={contactOrg}>{order.relationship_name}</span>
                  </div>
                </div>

                <div style={detailList}>
                  <div style={detailRow}><span>Primary email</span><strong>{order.contact_email || "—"}</strong></div>
                  <div style={detailRow}><span>CC email</span><strong>{order.contact_cc_email || "—"}</strong></div>
                  <div style={detailRow}><span>Phone</span><strong>{order.contact_mobile || "—"}</strong></div>
                </div>
              </div>
            ) : (
              <div style={editGrid}>
                <label style={field}><span style={fieldLabel}>Contact person</span><input value={contactPersonName} onChange={(e) => setContactPersonName(e.target.value)} style={input} /></label>
                <label style={field}><span style={fieldLabel}>Primary email</span><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={input} /></label>
                <label style={field}><span style={fieldLabel}>CC email</span><input type="email" value={contactCcEmail} onChange={(e) => setContactCcEmail(e.target.value)} style={input} /></label>
                <label style={field}><span style={fieldLabel}>Phone</span><input value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} style={input} /></label>
                <label style={field}>
                  <span style={fieldLabel}>Progress updates</span>
                  <select value={updateRecipientMode} onChange={(e) => setUpdateRecipientMode(e.target.value as "primary_only" | "primary_and_cc")} style={input}>
                    <option value="primary_only">Primary only</option>
                    <option value="primary_and_cc">Primary + CC</option>
                  </select>
                </label>
                <button type="button" style={primaryButton} onClick={saveContact} disabled={savingContact}>
                  {savingContact ? "Saving..." : "Save Contact Details"}
                </button>
              </div>
            )}
          </section>

          <section style={sideCard}>
            <div style={sideHeader}><h2 style={sideTitle}>Quick Links</h2></div>
            <div style={quickList}>
              {order.client_id ? (
                <Link href={`/crm/client/${order.client_id}`} style={quickLink}>Open Client Profile</Link>
              ) : null}
              <Link href="/crm/secretarial/work-orders" style={quickLink}>View All Work Orders</Link>
              <button type="button" onClick={copyClientLink} style={quickButton}>
                {copied ? "Client Link Copied" : "Client Portal Link"}
              </button>
            </div>
            {clientLink ? <div style={linkPreview}>{clientLink}</div> : null}
          </section>
        </aside>
      </section>
    </main>
  );
}

const page: React.CSSProperties = { minHeight:"100%", padding:"12px 14px 28px", background:"#f3f7fb", color:"#10233a", fontFamily:"'Aptos','Segoe UI','Helvetica Neue',Arial,sans-serif" };
const loadingBox: React.CSSProperties = { padding:"20px", background:"#fff", border:"1px solid #d8e2ee", fontSize:"12px" };
const crumbs: React.CSSProperties = { minHeight:"32px", display:"flex", alignItems:"center", gap:"8px", color:"#475569", fontSize:"11px" };
const crumbLink: React.CSSProperties = { color:"#1769e0", textDecoration:"none", fontWeight:800 };
const commandBar: React.CSSProperties = { padding:"11px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", background:"#fff", border:"1px solid #d8e2ee" };
const identityWrap: React.CSSProperties = { display:"flex", alignItems:"center", gap:"14px", minWidth:0 };
const commandIcon: React.CSSProperties = { width:"54px", height:"54px", display:"grid", placeItems:"center", flex:"0 0 54px", background:"#1769e0", color:"#fff", fontSize:"24px", fontWeight:900 };
const sectionKicker: React.CSSProperties = { color:"#475569", fontSize:"11px", fontWeight:700 };
const titleLine: React.CSSProperties = { display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" };
const title: React.CSSProperties = { margin:"3px 0 0", color:"#0f172a", fontSize:"21px", lineHeight:1.12, fontWeight:900 };
const statusPill: React.CSSProperties = { minHeight:"28px", padding:"0 10px", display:"inline-flex", alignItems:"center", background:"#fff0d6", color:"#a94f00", border:"1px solid #ffd8a6", borderRadius:"4px", fontSize:"9px", fontWeight:900 };
const metaLine: React.CSSProperties = { marginTop:"7px", display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap", color:"#64748b", fontSize:"10px" };
const topActions: React.CSSProperties = { display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap", justifyContent:"flex-end" };
const primaryButton: React.CSSProperties = { minHeight:"34px", padding:"0 13px", border:"1px solid #1769e0", background:"#1769e0", color:"#fff", fontSize:"10px", fontWeight:850, cursor:"pointer" };
const secondaryButton: React.CSSProperties = { minHeight:"34px", padding:"0 13px", border:"1px solid #cbd5e1", background:"#fff", color:"#10233a", fontSize:"10px", fontWeight:850, cursor:"pointer" };
const moreWrap: React.CSSProperties = { position:"relative" };
const moreSummary: React.CSSProperties = { minHeight:"34px", padding:"0 13px", display:"inline-flex", alignItems:"center", border:"1px solid #cbd5e1", background:"#fff", color:"#10233a", fontSize:"10px", fontWeight:850, cursor:"pointer", listStyle:"none" };
const moreMenu: React.CSSProperties = { position:"absolute", right:0, top:"38px", zIndex:20, width:"160px", padding:"6px", display:"grid", gap:"4px", background:"#fff", border:"1px solid #d8e2ee", boxShadow:"0 10px 24px rgba(15,35,58,.12)" };
const menuItem: React.CSSProperties = { minHeight:"30px", border:"none", background:"#fff", color:"#10233a", textAlign:"left", fontSize:"10px", cursor:"pointer" };
const requestBanner: React.CSSProperties = { marginTop:"10px", minHeight:"56px", padding:"8px 12px", display:"grid", gridTemplateColumns:"42px minmax(0,1fr) 250px", gap:"12px", alignItems:"center", background:"#fff9ef", border:"1px solid #f4b665", borderLeft:"4px solid #e97000" };
const declinedBanner: React.CSSProperties = { ...requestBanner, gridTemplateColumns:"42px minmax(0,1fr)", background:"#fff6f6", border:"1px solid #fecaca", borderLeft:"4px solid #b42318" };
const requestIcon: React.CSSProperties = { width:"36px", height:"36px", display:"grid", placeItems:"center", borderRadius:"50%", background:"#e97000", color:"#fff", fontSize:"20px", fontWeight:900 };
const requestHeading: React.CSSProperties = { color:"#b54708", fontSize:"14px", fontWeight:900 };
const requestText: React.CSSProperties = { marginTop:"3px", color:"#10233a", fontSize:"11px", lineHeight:1.4 };
const requestMeta: React.CSSProperties = { paddingLeft:"14px", borderLeft:"1px solid #e9c58d", color:"#64748b", fontSize:"10px", lineHeight:1.4 };
const errorBar: React.CSSProperties = { marginTop:"8px", padding:"9px 11px", border:"1px solid #fecaca", background:"#fff1f2", color:"#991b1b", fontSize:"10px", fontWeight:800 };
const bodyGrid: React.CSSProperties = { marginTop:"10px", display:"grid", gridTemplateColumns:"minmax(0,1fr) 310px", gap:"10px", alignItems:"start" };
const mainColumn: React.CSSProperties = { minWidth:0, display:"grid", gap:"10px" };
const sideColumn: React.CSSProperties = { minWidth:0, display:"grid", gap:"10px" };
const panel: React.CSSProperties = { background:"#fff", border:"1px solid #d8e2ee" };
const panelHeader: React.CSSProperties = { minHeight:"50px", padding:"7px 10px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"14px", borderBottom:"1px solid #d8e2ee" };
const panelTitle: React.CSSProperties = { margin:0, fontSize:"16px", fontWeight:900 };
const panelText: React.CSSProperties = { margin:"3px 0 0", color:"#475569", fontSize:"11px" };
const progressBox: React.CSSProperties = { width:"260px", maxWidth:"36%" };
const progressLabels: React.CSSProperties = { marginBottom:"6px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", fontSize:"10px" };
const progressTrack: React.CSSProperties = { height:"9px", background:"#e6edf5", overflow:"hidden" };
const progressFill: React.CSSProperties = { display:"block", height:"100%", background:"#1769e0" };
const checklistHead: React.CSSProperties = { minHeight:"30px", padding:"0 8px", display:"grid", gridTemplateColumns:"22px minmax(205px,1.9fr) 112px 118px 78px 118px", gap:"6px", alignItems:"center", background:"#f4f7fa", borderBottom:"1px solid #d8e2ee", color:"#334155", fontSize:"10px", fontWeight:900 };
const checklistRow: React.CSSProperties = { minHeight:"42px", padding:"3px 8px", display:"grid", gridTemplateColumns:"22px minmax(205px,1.9fr) 112px 118px 78px 118px", gap:"6px", alignItems:"center", borderBottom:"1px solid #e5eaf0", fontSize:"11px" };
const stepCell: React.CSSProperties = { minWidth:0, display:"grid", gridTemplateColumns:"24px minmax(0,1fr)", gap:"7px", alignItems:"center" };
const stepBubble: React.CSSProperties = { width:"22px", height:"22px", display:"grid", placeItems:"center", borderRadius:"50%", color:"#fff", fontSize:"9px", fontWeight:900 };
const stepTitle: React.CSSProperties = { display:"block", fontSize:"11px", fontWeight:900 };
const stepSub: React.CSSProperties = { display:"block", marginTop:"1px", color:"#475569", fontSize:"9.5px" };
const select: React.CSSProperties = { width:"100%", height:"29px", padding:"0 7px", border:"1px solid #cbd5e1", background:"#fff", color:"#10233a", fontSize:"11px" };
const mutedCell: React.CSSProperties = { color:"#475569", fontSize:"10.5px" };
const rowActionCell: React.CSSProperties = { display:"grid", gridTemplateColumns:"1fr 24px", gap:"7px", alignItems:"center" };
const startButton: React.CSSProperties = { height:"29px", border:"1px solid #1769e0", background:"#1769e0", color:"#fff", fontSize:"10.5px", fontWeight:850, cursor:"pointer" };
const dots: React.CSSProperties = { fontSize:"18px", textAlign:"center" };
const activityPanel: React.CSSProperties = { background:"#fff", border:"1px solid #d8e2ee" };
const activityTabs: React.CSSProperties = { minHeight:"32px", padding:"0 10px", display:"flex", alignItems:"end", gap:"18px", borderBottom:"1px solid #d8e2ee" };
const activeTab: React.CSSProperties = { minHeight:"34px", border:"none", borderBottom:"3px solid #1769e0", background:"transparent", color:"#1769e0", fontSize:"12px", fontWeight:900 };
const inactiveTab: React.CSSProperties = { minHeight:"34px", border:"none", background:"transparent", color:"#334155", fontSize:"11px", fontWeight:800 };
const activityRow: React.CSSProperties = { minHeight:"50px", padding:"0 10px", display:"grid", gridTemplateColumns:"32px minmax(0,1fr) 145px 80px", gap:"10px", alignItems:"center", borderBottom:"1px solid #e5eaf0" };
const activityDot: React.CSSProperties = { width:"24px", height:"24px", display:"grid", placeItems:"center", borderRadius:"50%", color:"#fff", fontSize:"9px", fontWeight:900 };
const activityTitle: React.CSSProperties = { display:"block", fontSize:"12px", fontWeight:900 };
const activityText: React.CSSProperties = { display:"block", marginTop:"2px", color:"#475569", fontSize:"10.5px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" };
const activityMeta: React.CSSProperties = { color:"#334155", fontSize:"10px", textAlign:"right", textTransform:"capitalize" };
const emptyState: React.CSSProperties = { padding:"16px", color:"#64748b", fontSize:"10px" };
const sideCard: React.CSSProperties = { background:"#fff", border:"1px solid #d8e2ee" };
const sideHeader: React.CSSProperties = { minHeight:"42px", padding:"0 10px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px", borderBottom:"1px solid #d8e2ee" };
const sideTitle: React.CSSProperties = { margin:0, fontSize:"14px", fontWeight:900 };
const detailList: React.CSSProperties = { padding:"2px 9px 6px" };
const detailRow: React.CSSProperties = { minHeight:"32px", display:"grid", gridTemplateColumns:"118px minmax(0,1fr)", gap:"8px", alignItems:"center", borderBottom:"1px solid #e5eaf0", color:"#334155", fontSize:"10.5px" };
const warn: React.CSSProperties = { color:"#b54708" };
const editButton: React.CSSProperties = { minHeight:"28px", padding:"0 9px", border:"1px solid #cbd5e1", background:"#fff", color:"#10233a", fontSize:"9px", fontWeight:850, cursor:"pointer" };
const contactBody: React.CSSProperties = { padding:"8px" };
const contactIdentity: React.CSSProperties = { display:"flex", alignItems:"center", gap:"10px", paddingBottom:"8px" };
const avatar: React.CSSProperties = { width:"36px", height:"36px", display:"grid", placeItems:"center", borderRadius:"50%", background:"#244bb5", color:"#fff", fontSize:"13px", fontWeight:900 };
const contactName: React.CSSProperties = { display:"block", fontSize:"13px", fontWeight:900 };
const contactOrg: React.CSSProperties = { display:"block", marginTop:"2px", color:"#475569", fontSize:"10px" };
const editGrid: React.CSSProperties = { padding:"8px", display:"grid", gap:"8px" };
const field: React.CSSProperties = { display:"grid", gap:"4px" };
const fieldLabel: React.CSSProperties = { color:"#526174", fontSize:"9px", fontWeight:800 };
const input: React.CSSProperties = { width:"100%", height:"32px", boxSizing:"border-box", padding:"0 8px", border:"1px solid #cbd5e1", background:"#fff", color:"#10233a", fontSize:"10px" };
const quickList: React.CSSProperties = { padding:"4px 10px", display:"grid" };
const quickLink: React.CSSProperties = { minHeight:"32px", display:"flex", alignItems:"center", borderBottom:"1px solid #e5eaf0", color:"#1769e0", textDecoration:"none", fontSize:"10px", fontWeight:750 };
const quickButton: React.CSSProperties = { minHeight:"32px", padding:0, border:"none", borderBottom:"1px solid #e5eaf0", background:"#fff", color:"#1769e0", textAlign:"left", fontSize:"10px", fontWeight:750, cursor:"pointer" };
const linkPreview: React.CSSProperties = { margin:"6px 10px 10px", padding:"8px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", background:"#f4f7fa", border:"1px solid #d8e2ee", color:"#64748b", fontSize:"8px" };
