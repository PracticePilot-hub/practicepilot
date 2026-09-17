import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing Supabase admin environment variables.");
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function money(value: number | null) {
  if (value == null) return "To be confirmed";

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(value);
}

async function acceptMandate(formData: FormData) {
  "use server";

  const token = String(formData.get("token") || "");
  const acceptedByName = String(formData.get("acceptedByName") || "").trim();
  const acceptedByEmail = String(formData.get("acceptedByEmail") || "").trim();
  const confirmAuthority = formData.get("confirmAuthority") === "on";
  const confirmPayment = formData.get("confirmPayment") === "on";

  if (!token) throw new Error("Mandate token is missing.");
  if (!acceptedByName) throw new Error("Please enter the person accepting the mandate.");
  if (!acceptedByEmail || !acceptedByEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (!confirmAuthority || !confirmPayment) {
    throw new Error("Both confirmations must be accepted.");
  }

  const { data: order, error } = await admin
    .from("crm_secretarial_work_orders")
    .select(
      "id, organisation_id, mandate_status, work_start_gate, billing_trigger, payment_status"
    )
    .eq("client_progress_link_token", token)
    .maybeSingle();

  if (error) throw error;
  if (!order) throw new Error("This mandate link is invalid or unavailable.");

  if (order.mandate_status !== "accepted") {
    const now = new Date().toISOString();

    let nextStatus = "ready_to_start";

    if (
      order.work_start_gate === "deposit_required" ||
      order.work_start_gate === "full_payment_required"
    ) {
      nextStatus = "awaiting_payment";
    }

    if (order.billing_trigger === "mandate_accepted") {
      nextStatus = "ready_to_bill";
    }

    const acceptanceReference = `MAND-${String(order.id)
      .slice(0, 8)
      .toUpperCase()}-${Date.now()}`;

    const h = await headers();

    const forwardedFor =
      h.get("x-forwarded-for") ||
      h.get("x-real-ip") ||
      null;

    const { error: updateError } = await admin
      .from("crm_secretarial_work_orders")
      .update({
        mandate_status: "accepted",
        mandate_accepted_at: now,
        mandate_accepted_by_name: acceptedByName,
        mandate_accepted_by_email: acceptedByEmail,
        mandate_acceptance_ip: forwardedFor,
        mandate_acceptance_user_agent: h.get("user-agent") || null,
        mandate_acceptance_reference: acceptanceReference,
        status: nextStatus,
        payment_status:
          order.billing_trigger === "mandate_accepted"
            ? "invoice_required"
            : order.payment_status,
        updated_at: now,
      })
      .eq("id", order.id)
      .eq("organisation_id", order.organisation_id);

    if (updateError) throw updateError;

    await admin.from("crm_secretarial_work_order_updates").insert({
      organisation_id: order.organisation_id,
      work_order_id: order.id,
      update_type: "mandate_accepted",
      subject: "Mandate accepted",
      message: `${acceptedByName} accepted the mandate online.`,
      delivery_channel: "email_and_portal",
      recipient_name: acceptedByName,
      recipient_email: acceptedByEmail,
      delivery_status: "queued",
    });
  }

  revalidatePath(`/mandate/${token}`);
  redirect(`/mandate/${token}?accepted=1`);
}


async function requestMandateChanges(formData: FormData) {
  "use server";

  const token = String(formData.get("token") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!token) throw new Error("Mandate token is missing.");
  if (!name) throw new Error("Please enter your name.");
  if (!email || !email.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (!message) {
    throw new Error("Please tell us what you would like changed.");
  }

  const { data: order, error } = await admin
    .from("crm_secretarial_work_orders")
    .select("id, organisation_id, mandate_status")
    .eq("client_progress_link_token", token)
    .maybeSingle();

  if (error) throw error;
  if (!order) throw new Error("This mandate link is invalid or unavailable.");

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("crm_secretarial_work_orders")
    .update({
      mandate_status: "changes_requested",
      status: "draft",
      updated_at: now,
    })
    .eq("id", order.id)
    .eq("organisation_id", order.organisation_id);

  if (updateError) throw updateError;

  await admin.from("crm_secretarial_work_order_updates").insert({
    organisation_id: order.organisation_id,
    work_order_id: order.id,
    update_type: "manual_update",
    subject: "Client requested mandate changes",
    message: `${name} (${email}) requested changes: ${message}`,
    delivery_channel: "portal",
    recipient_name: name,
    recipient_email: email,
    delivery_status: "not_sent",
  });

  revalidatePath(`/mandate/${token}`);
  redirect(`/mandate/${token}?changes=1`);
}

async function declineMandate(formData: FormData) {
  "use server";

  const token = String(formData.get("token") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!token) throw new Error("Mandate token is missing.");
  if (!name) throw new Error("Please enter your name.");
  if (!email || !email.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }

  const { data: order, error } = await admin
    .from("crm_secretarial_work_orders")
    .select("id, organisation_id")
    .eq("client_progress_link_token", token)
    .maybeSingle();

  if (error) throw error;
  if (!order) throw new Error("This mandate link is invalid or unavailable.");

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("crm_secretarial_work_orders")
    .update({
      mandate_status: "declined",
      mandate_declined_at: now,
      status: "draft",
      updated_at: now,
    })
    .eq("id", order.id)
    .eq("organisation_id", order.organisation_id);

  if (updateError) throw updateError;

  await admin.from("crm_secretarial_work_order_updates").insert({
    organisation_id: order.organisation_id,
    work_order_id: order.id,
    update_type: "manual_update",
    subject: "Mandate declined",
    message: `${name} (${email}) declined the mandate.${
      reason ? ` Reason: ${reason}` : ""
    }`,
    delivery_channel: "portal",
    recipient_name: name,
    recipient_email: email,
    delivery_status: "not_sent",
  });

  revalidatePath(`/mandate/${token}`);
  redirect(`/mandate/${token}?declined=1`);
}

export default async function MandatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    accepted?: string;
    changes?: string;
    declined?: string;
  }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  const { data: order, error } = await admin
    .from("crm_secretarial_work_orders")
    .select(
      "id, organisation_id, client_id, client_group_id, title, proposed_entity_name, work_order_type, status, fee_ex_vat, fee_inc_vat, vat_rate, work_start_gate, release_gate, billing_trigger, payment_status, mandate_status, mandate_sent_at, mandate_accepted_at, mandate_accepted_by_name, mandate_accepted_by_email, mandate_acceptance_reference, client_progress_link_token, contact_person_name, contact_email, contact_mobile, contact_cc_email, update_recipient_mode"
    )
    .eq("client_progress_link_token", token)
    .maybeSingle();

  if (error || !order) {
    return (
      <main style={page}>
        <div style={shell}>
          <div style={errorBox}>
            {error?.message || "This mandate link is invalid or no longer available."}
          </div>
        </div>
      </main>
    );
  }

  const [
    { data: items, error: itemsError },
    { data: client, error: clientError },
    { data: group, error: groupError },
    { data: updates, error: updatesError },
  ] = await Promise.all([
    admin
      .from("crm_secretarial_work_order_items")
      .select(
        "id, item_code, item_label, sort_order, is_required, is_selected, status, client_update_enabled"
      )
      .eq("organisation_id", order.organisation_id)
      .eq("work_order_id", order.id)
      .eq("is_selected", true)
      .order("sort_order"),

    order.client_id
      ? admin
          .from("crm_clients")
          .select("client_name")
          .eq("id", order.client_id)
          .eq("organisation_id", order.organisation_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),

    order.client_group_id
      ? admin
          .from("crm_client_groups")
          .select("group_name")
          .eq("id", order.client_group_id)
          .eq("organisation_id", order.organisation_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),

    admin
      .from("crm_secretarial_work_order_updates")
      .select("id, update_type, subject, message, created_at")
      .eq("organisation_id", order.organisation_id)
      .eq("work_order_id", order.id)
      .in("update_type", [
        "mandate_accepted",
        "milestone_completed",
        "payment_required",
        "payment_received",
        "work_completed",
        "document_released",
        "manual_update",
      ])
      .order("created_at", { ascending: false }),
  ]);

  const fetchError = itemsError || clientError || groupError || updatesError;

  if (fetchError) {
    return (
      <main style={page}>
        <div style={shell}>
          <div style={errorBox}>{fetchError.message}</div>
        </div>
      </main>
    );
  }

  const selectedItems = items || [];
  const completed = selectedItems.filter((item: any) =>
    ["done", "not_applicable"].includes(String(item.status || ""))
  );

  const progress =
    selectedItems.length > 0
      ? Math.round((completed.length / selectedItems.length) * 100)
      : 0;

  const relationshipName =
    group?.group_name ||
    client?.client_name ||
    order.proposed_entity_name ||
    "Client";

  const { data: emailBrand } = await admin
    .from("organisation_email_settings")
    .select("sender_name")
    .eq("organisation_id", order.organisation_id)
    .eq("is_active", true)
    .maybeSingle();

  const brandName =
    String(emailBrand?.sender_name || "").trim() || "PracticePilot";

  const accepted = order.mandate_status === "accepted";

  return (
    <main style={page}>
      <div style={shell}>
        <header style={brandHeader}>
          <div>
            <div style={brand}>{brandName}</div>
            <div style={brandSub}>Secure Client Mandate & Progress</div>
          </div>
          <span style={secureBadge}>Secure Link</span>
        </header>

        <section style={hero}>
          <div>
            <span style={heroEyebrow}>Secretarial Work Order</span>
            <h1 style={title}>{order.title}</h1>
            <p style={subtitle}>{relationshipName}</p>
          </div>

          <div style={heroStatus}>
            <span style={heroStatusLabel}>Current status</span>
            <strong style={heroStatusValue}>
              {accepted
                ? "Mandate accepted"
                : order.mandate_status === "changes_requested"
                ? "Changes requested"
                : order.mandate_status === "declined"
                ? "Mandate declined"
                : "Awaiting acceptance"}
            </strong>
          </div>
        </section>

        {query.accepted === "1" ? (
          <section style={acceptedPanel}>
            <div style={acceptedIcon}>✓</div>
            <div>
              <h2 style={acceptedTitle}>Mandate accepted</h2>
              <p style={acceptedText}>
                Thank you. Your instruction has been accepted. This page is now
                your live progress page.
              </p>
              {order.mandate_acceptance_reference ? (
                <span style={acceptedRef}>
                  Acceptance reference: {order.mandate_acceptance_reference}
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        {query.changes === "1" ? (
          <section style={changesPanel}>
            <div style={changesIcon}>!</div>
            <div>
              <h2 style={changesTitle}>Changes requested</h2>
              <p style={changesText}>
                Thank you. Your request has been sent to {brandName}. They will review the
                mandate and send you a revised version.
              </p>
            </div>
          </section>
        ) : null}

        {query.declined === "1" ? (
          <section style={declinedPanel}>
            <div style={declinedIcon}>×</div>
            <div>
              <h2 style={declinedTitle}>Mandate declined</h2>
              <p style={declinedText}>
                Your response has been recorded and {brandName} has been notified.
              </p>
            </div>
          </section>
        ) : null}

        {!accepted &&
        order.mandate_status !== "changes_requested" &&
        order.mandate_status !== "declined" ? (
          <>
            <section style={panel}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Work authorised</h2>
                  <p style={panelSub}>
                    Please review the services {brandName} has been instructed to perform.
                  </p>
                </div>
              </div>

              <div style={serviceList}>
                {selectedItems.map((item: any) => (
                  <div key={item.id} style={serviceRow}>
                    <span style={tick}>✓</span>
                    <div>
                      <strong>{item.item_label}</strong>
                      <span style={serviceMeta}>
                        {item.is_required ? "Included" : "Optional selected"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={termsGrid}>
              <div style={termsCard}>
                <span style={termsLabel}>Work start rule</span>
                <strong style={termsSmallValue}>
                  {order.work_start_gate.replaceAll("_", " ")}
                </strong>
              </div>
              <div style={termsCard}>
                <span style={termsLabel}>Document release rule</span>
                <strong style={termsSmallValue}>
                  {order.release_gate.replaceAll("_", " ")}
                </strong>
              </div>
            </section>

            <section style={panel}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Mandate & authority</h2>
                  <p style={panelSub}>
                    Acceptance authorises {brandName} to proceed with the selected work.
                  </p>
                </div>
              </div>

              <div style={mandateText}>
                <p>
                  I confirm that I am authorised to instruct {brandName} to perform the
                  services listed above and that the information supplied will be
                  complete and accurate.
                </p>
                <p>
                  I acknowledge the payment and release conditions shown above.
                  Where the release rule requires payment, I understand that completed
                  outputs may be withheld until payment has been received.
                </p>
                <p>
                  I understand that processing times at CIPC, SARS, the Department
                  of Employment and Labour and other authorities are outside
                  Bizzacc&apos;s direct control.
                </p>
              </div>

              <form action={acceptMandate} style={acceptForm}>
                <input type="hidden" name="token" value={token} />

                <label style={field}>
                  <span style={label}>Full name</span>
                  <input
                    name="acceptedByName"
                    style={input}
                    placeholder="Person accepting the mandate"
                    required
                  />
                </label>

                <label style={field}>
                  <span style={label}>Email address</span>
                  <input
                    name="acceptedByEmail"
                    type="email"
                    style={input}
                    placeholder="name@example.com"
                    required
                  />
                </label>

                <label style={checkRow}>
                  <input name="confirmAuthority" type="checkbox" required />
                  <span>I confirm that I have authority to give this instruction.</span>
                </label>

                <label style={checkRow}>
                  <input name="confirmPayment" type="checkbox" required />
                  <span>I accept the scope and payment / release conditions.</span>
                </label>

                <button type="submit" style={acceptButton}>
                  Accept Mandate
                </button>
              </form>

              <div style={alternateActions}>
                <details style={requestChangesBox}>
                  <summary style={requestChangesSummary}>
                    Request Changes
                  </summary>

                  <form action={requestMandateChanges} style={alternateForm}>
                    <input type="hidden" name="token" value={token} />

                    <label style={field}>
                      <span style={label}>Your name</span>
                      <input
                        name="name"
                        defaultValue={order.contact_person_name || ""}
                        style={input}
                        required
                      />
                    </label>

                    <label style={field}>
                      <span style={label}>Email address</span>
                      <input
                        name="email"
                        type="email"
                        defaultValue={order.contact_email || ""}
                        style={input}
                        required
                      />
                    </label>

                    <label style={field}>
                      <span style={label}>What would you like us to change?</span>
                      <textarea
                        name="message"
                        style={textarea}
                        rows={4}
                        placeholder="Tell us what needs to be changed in the services or mandate."
                        required
                      />
                    </label>

                    <button type="submit" style={requestChangesButton}>
                      Send Change Request
                    </button>
                  </form>
                </details>

                <details style={declineBox}>
                  <summary style={declineSummary}>
                    Decline Mandate
                  </summary>

                  <form action={declineMandate} style={alternateForm}>
                    <input type="hidden" name="token" value={token} />

                    <label style={field}>
                      <span style={label}>Your name</span>
                      <input
                        name="name"
                        defaultValue={order.contact_person_name || ""}
                        style={input}
                        required
                      />
                    </label>

                    <label style={field}>
                      <span style={label}>Email address</span>
                      <input
                        name="email"
                        type="email"
                        defaultValue={order.contact_email || ""}
                        style={input}
                        required
                      />
                    </label>

                    <label style={field}>
                      <span style={label}>Reason (optional)</span>
                      <textarea
                        name="reason"
                        style={textarea}
                        rows={3}
                        placeholder="Optional"
                      />
                    </label>

                    <button type="submit" style={declineButton}>
                      Confirm Decline
                    </button>
                  </form>
                </details>
              </div>
            </section>
          </>
        ) : !accepted ? (
          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>
                  {order.mandate_status === "changes_requested"
                    ? `${brandName} is reviewing your requested changes`
                    : "Mandate declined"}
                </h2>
                <p style={panelSub}>
                  {order.mandate_status === "changes_requested"
                    ? "You do not need to do anything else until the revised mandate is sent."
                    : "No work will proceed under this mandate."}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section style={panel}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Work progress</h2>
                  <p style={panelSub}>
                    This page updates as each secretarial milestone is completed.
                  </p>
                </div>
                <strong style={progressValue}>{progress}%</strong>
              </div>

              <div style={progressTrack}>
                <span style={{ ...progressFill, width: `${progress}%` }} />
              </div>

              <div style={progressList}>
                {selectedItems.map((item: any) => {
                  const done = ["done", "not_applicable"].includes(item.status);
                  return (
                    <div key={item.id} style={progressRow}>
                      <span style={done ? progressDone : progressPending}>
                        {done ? "✓" : "○"}
                      </span>
                      <div>
                        <strong>{item.item_label}</strong>
                        <span style={progressMeta}>
                          {item.status.replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section style={panel}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Updates</h2>
                  <p style={panelSub}>Important progress updates from {brandName}.</p>
                </div>
              </div>

              {(updates || []).length ? (
                (updates || []).map((row: any) => (
                  <div key={row.id} style={updateRow}>
                    <strong>{row.subject || "Progress update"}</strong>
                    <span style={updateDate}>
                      {new Date(row.created_at).toLocaleString("en-ZA")}
                    </span>
                    <p style={updateMessage}>{row.message}</p>
                  </div>
                ))
              ) : (
                <div style={empty}>No client updates yet.</div>
              )}
            </section>
          </>
        )}

        <footer style={footer}>
          {brandName} secretarial workflow powered by PracticePilot
        </footer>
      </div>
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", padding: "28px 16px", background: "#eef2f5", color: "#10233a" };
const shell: React.CSSProperties = { width: "min(920px,100%)", margin: "0 auto" };
const brandHeader: React.CSSProperties = { minHeight: "64px", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#10233a", color: "#fff" };
const brand: React.CSSProperties = { fontSize: "18px", fontWeight: 950 };
const brandSub: React.CSSProperties = { marginTop: "2px", color: "#cbd5e1", fontSize: "9px" };
const secureBadge: React.CSSProperties = { minHeight: "24px", padding: "0 8px", display: "inline-flex", alignItems: "center", border: "1px solid rgba(255,255,255,.25)", fontSize: "8px", fontWeight: 850 };
const hero: React.CSSProperties = { minHeight: "110px", padding: "18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", background: "#fff", border: "1px solid #d8dee7", borderTop: "none" };
const heroEyebrow: React.CSSProperties = { color: "#1758d5", fontSize: "9px", fontWeight: 900 };
const title: React.CSSProperties = { margin: "4px 0 0", fontSize: "24px", lineHeight: 1.1, fontWeight: 950 };
const subtitle: React.CSSProperties = { margin: "5px 0 0", color: "#64748b", fontSize: "11px" };
const heroStatus: React.CSSProperties = { minWidth: "190px", textAlign: "right" };
const heroStatusLabel: React.CSSProperties = { display: "block", color: "#64748b", fontSize: "8px", fontWeight: 850 };
const heroStatusValue: React.CSSProperties = { display: "block", marginTop: "3px", fontSize: "14px", fontWeight: 950 };
const panel: React.CSSProperties = { marginTop: "12px", background: "#fff", border: "1px solid #d8dee7" };
const panelHeader: React.CSSProperties = { minHeight: "58px", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", borderBottom: "1px solid #d8dee7" };
const panelTitle: React.CSSProperties = { margin: 0, fontSize: "14px", fontWeight: 900 };
const panelSub: React.CSSProperties = { margin: "3px 0 0", color: "#64748b", fontSize: "9px" };
const serviceList: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr" };
const serviceRow: React.CSSProperties = { minHeight: "54px", padding: "8px 14px", display: "grid", gridTemplateColumns: "24px minmax(0,1fr)", gap: "8px", alignItems: "center", borderRight: "1px solid #e5eaf0", borderBottom: "1px solid #e5eaf0", fontSize: "10px" };
const tick: React.CSSProperties = { width: "22px", height: "22px", display: "grid", placeItems: "center", background: "#1758d5", color: "#fff", fontWeight: 950 };
const serviceMeta: React.CSSProperties = { display: "block", marginTop: "2px", color: "#64748b", fontSize: "8px" };
const termsGrid: React.CSSProperties = { marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" };
const termsCard: React.CSSProperties = { minHeight: "86px", padding: "11px", display: "grid", alignContent: "center", background: "#fff", border: "1px solid #d8dee7" };
const termsLabel: React.CSSProperties = { color: "#64748b", fontSize: "8px", fontWeight: 850 };
const termsValue: React.CSSProperties = { marginTop: "3px", fontSize: "18px", fontWeight: 950 };
const termsSmallValue: React.CSSProperties = { marginTop: "4px", fontSize: "10px", fontWeight: 900, textTransform: "capitalize" };
const mandateText: React.CSSProperties = { padding: "12px 14px 4px", color: "#475569", fontSize: "10px", lineHeight: 1.55 };
const acceptForm: React.CSSProperties = { padding: "8px 14px 14px", display: "grid", gap: "9px" };
const field: React.CSSProperties = { display: "grid", gap: "4px" };
const label: React.CSSProperties = { color: "#526174", fontSize: "8px", fontWeight: 850 };
const input: React.CSSProperties = { height: "34px", padding: "0 9px", border: "1px solid #cbd5e1", color: "#10233a", fontSize: "10px" };
const checkRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px", color: "#334155", fontSize: "10px" };
const acceptButton: React.CSSProperties = { height: "38px", marginTop: "4px", border: "1px solid #1758d5", background: "#1758d5", color: "#fff", fontSize: "11px", fontWeight: 950, cursor: "pointer" };
const acceptedPanel: React.CSSProperties = { marginTop: "12px", minHeight: "110px", padding: "18px", display: "grid", gridTemplateColumns: "54px minmax(0,1fr)", gap: "14px", alignItems: "center", background: "#ecfdf3", border: "1px solid #bbf7d0" };
const acceptedIcon: React.CSSProperties = { width: "50px", height: "50px", display: "grid", placeItems: "center", borderRadius: "50%", background: "#166534", color: "#fff", fontSize: "24px", fontWeight: 950 };
const acceptedTitle: React.CSSProperties = { margin: 0, color: "#166534", fontSize: "18px", fontWeight: 950 };
const acceptedText: React.CSSProperties = { margin: "4px 0 0", color: "#3f654c", fontSize: "10px" };
const acceptedRef: React.CSSProperties = { display: "block", marginTop: "5px", color: "#166534", fontSize: "8px", fontWeight: 850 };
const progressValue: React.CSSProperties = { fontSize: "18px", fontWeight: 950 };
const progressTrack: React.CSSProperties = { height: "8px", margin: "12px 14px 0", background: "#e5eaf0", overflow: "hidden" };
const progressFill: React.CSSProperties = { display: "block", height: "100%", background: "#1758d5" };
const progressList: React.CSSProperties = { padding: "10px 14px 14px" };
const progressRow: React.CSSProperties = { minHeight: "48px", display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", gap: "8px", alignItems: "center", borderBottom: "1px solid #e5eaf0", fontSize: "10px" };
const progressDone: React.CSSProperties = { width: "24px", height: "24px", display: "grid", placeItems: "center", borderRadius: "50%", background: "#dcfce7", color: "#166534", fontWeight: 950 };
const progressPending: React.CSSProperties = { width: "24px", height: "24px", display: "grid", placeItems: "center", borderRadius: "50%", background: "#f1f5f9", color: "#94a3b8", fontWeight: 950 };
const progressMeta: React.CSSProperties = { display: "block", marginTop: "2px", color: "#64748b", fontSize: "8px", textTransform: "capitalize" };
const updateRow: React.CSSProperties = { minHeight: "68px", padding: "10px 14px", borderBottom: "1px solid #e5eaf0" };
const updateDate: React.CSSProperties = { display: "block", marginTop: "2px", color: "#94a3b8", fontSize: "8px" };
const updateMessage: React.CSSProperties = { margin: "5px 0 0", color: "#526174", fontSize: "10px" };
const alternateActions: React.CSSProperties = {
  padding: "0 14px 14px",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
};

const requestChangesBox: React.CSSProperties = {
  border: "1px solid #f5c77a",
  background: "#fffaf0",
};

const requestChangesSummary: React.CSSProperties = {
  padding: "10px 12px",
  cursor: "pointer",
  color: "#9a6700",
  fontSize: "10px",
  fontWeight: 900,
};

const declineBox: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff7f7",
};

const declineSummary: React.CSSProperties = {
  padding: "10px 12px",
  cursor: "pointer",
  color: "#b42318",
  fontSize: "10px",
  fontWeight: 900,
};

const alternateForm: React.CSSProperties = {
  padding: "0 12px 12px",
  display: "grid",
  gap: "8px",
};

const textarea: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 9px",
  border: "1px solid #cbd5e1",
  color: "#10233a",
  fontSize: "10px",
  fontFamily: "inherit",
  resize: "vertical",
};

const requestChangesButton: React.CSSProperties = {
  height: "34px",
  border: "1px solid #d97706",
  background: "#d97706",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const declineButton: React.CSSProperties = {
  height: "34px",
  border: "1px solid #b42318",
  background: "#ffffff",
  color: "#b42318",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const changesPanel: React.CSSProperties = {
  marginTop: "12px",
  minHeight: "96px",
  padding: "16px",
  display: "grid",
  gridTemplateColumns: "48px minmax(0,1fr)",
  gap: "12px",
  alignItems: "center",
  background: "#fffaf0",
  border: "1px solid #f5c77a",
};

const changesIcon: React.CSSProperties = {
  width: "42px",
  height: "42px",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: "#d97706",
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: 950,
};

const changesTitle: React.CSSProperties = {
  margin: 0,
  color: "#9a6700",
  fontSize: "17px",
  fontWeight: 950,
};

const changesText: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#7c5a16",
  fontSize: "10px",
};

const declinedPanel: React.CSSProperties = {
  marginTop: "12px",
  minHeight: "96px",
  padding: "16px",
  display: "grid",
  gridTemplateColumns: "48px minmax(0,1fr)",
  gap: "12px",
  alignItems: "center",
  background: "#fff7f7",
  border: "1px solid #fecaca",
};

const declinedIcon: React.CSSProperties = {
  width: "42px",
  height: "42px",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: "#b42318",
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 950,
};

const declinedTitle: React.CSSProperties = {
  margin: 0,
  color: "#b42318",
  fontSize: "17px",
  fontWeight: 950,
};

const declinedText: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#7f1d1d",
  fontSize: "10px",
};

const footer: React.CSSProperties = { padding: "20px 0 4px", color: "#94a3b8", textAlign: "center", fontSize: "8px" };
const errorBox: React.CSSProperties = { marginTop: "12px", padding: "10px 12px", border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontSize: "10px", fontWeight: 850 };
const empty: React.CSSProperties = { padding: "18px 14px", color: "#64748b", fontSize: "10px" };
