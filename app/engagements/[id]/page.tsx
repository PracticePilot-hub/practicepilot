"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type EngagementStatus =
  | "Draft"
  | "Sent"
  | "Signed"
  | "Active"
  | "Suspended"
  | "Expired"
  | "Terminated"
  | "Superseded";

type Engagement = {
  id: string;
  engagement_number: string;
  proposal_id: string | null;
  client_id: string | null;
  client_name: string;
  client_registration_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_number: string | null;
  status: EngagementStatus;
  contract_start_date: string;
  contract_end_date: string;
  contract_months: number;
  billing_day: number;
  payment_due_day: number;
  billing_in_advance: boolean;
  monthly_fee: number;
  fee_is_exclusive_vat: boolean;
  vat_rate: number;
  renewal_method: string;
  auto_renew: boolean;
  special_terms: string | null;
  internal_notes: string | null;
  legal_template_version: string;
  locked_at: string | null;
};

type EngagementService = {
  id: string;
  category: string;
  service_name: string;
  description: string | null;
  fee_type: string | null;
  amount: number;
  scope_quantity: number | null;
  scope_unit: string | null;
  client_facing_note: string | null;
  sort_order: number;
};

type BillingRow = {
  id: string;
  sequence_no: number;
  service_period_start: string;
  service_period_end: string;
  invoice_date: string;
  payment_due_date: string;
  amount_ex_vat: number;
  vat_amount: number;
  amount_inc_vat: number;
  billing_status: string;
};

type Clause = {
  id: string;
  clause_key: string;
  category: string;
  title: string;
  body: string;
  clause_version: number;
  sort_order: number;
  is_mandatory: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function formatDate(value: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function monthLabel(value: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default function EngagementDetailPage() {
  const params = useParams<{ id: string }>();
  const engagementId = String(params?.id || "");

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [services, setServices] = useState<EngagementService[]>([]);
  const [billingSchedule, setBillingSchedule] = useState<BillingRow[]>([]);
  const [clauses, setClauses] = useState<Clause[]>([]);

  const [contractStartDate, setContractStartDate] = useState("");
  const [contractMonths, setContractMonths] = useState(12);
  const [billingDay, setBillingDay] = useState(25);
  const [paymentDueDay, setPaymentDueDay] = useState(1);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [renewalMethod, setRenewalMethod] = useState("New contract required");
  const [specialTerms, setSpecialTerms] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [applyingLegalTerms, setApplyingLegalTerms] = useState(false);
  const [sendingForSignature, setSendingForSignature] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [signingUrl, setSigningUrl] = useState("");

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
      }),
    []
  );

  async function authHeaders() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error("Your login session could not be confirmed.");
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  async function loadEngagement() {
    try {
      setLoading(true);
      setError("");

      const headers = await authHeaders();

      const response = await fetch(`/api/engagements/${engagementId}`, {
        cache: "no-store",
        headers,
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load engagement.");
      }

      const loaded = result.engagement as Engagement;

      setEngagement(loaded);
      setRecipientName(loaded.contact_name || "");
      setRecipientEmail(loaded.contact_email || "");
      setServices(Array.isArray(result.services) ? result.services : []);
      setBillingSchedule(
        Array.isArray(result.billing_schedule) ? result.billing_schedule : []
      );
      setClauses(Array.isArray(result.clauses) ? result.clauses : []);

      setContractStartDate(loaded.contract_start_date || "");
      setContractMonths(Number(loaded.contract_months || 12));
      setBillingDay(Number(loaded.billing_day || 25));
      setPaymentDueDay(Number(loaded.payment_due_day || 1));
      setMonthlyFee(Number(loaded.monthly_fee || 0));
      setRenewalMethod(loaded.renewal_method || "New contract required");
      setSpecialTerms(loaded.special_terms || "");
      setInternalNotes(loaded.internal_notes || "");
    } catch (loadError: any) {
      setError(loadError?.message || "Unable to load engagement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (engagementId) {
      loadEngagement();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  async function saveSetup() {
    try {
      setSaving(true);
      setError("");
      setSavedMessage("");

      const headers = await authHeaders();

      const response = await fetch(`/api/engagements/${engagementId}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractStartDate,
          contractMonths,
          billingDay,
          paymentDueDay,
          monthlyFee,
          renewalMethod,
          autoRenew: false,
          specialTerms,
          internalNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to save engagement.");
      }

      setEngagement(result.engagement);
      setBillingSchedule(
        Array.isArray(result.billing_schedule) ? result.billing_schedule : []
      );
      setSavedMessage("Engagement setup saved.");
    } catch (saveError: any) {
      setError(saveError?.message || "Unable to save engagement.");
    } finally {
      setSaving(false);
    }
  }


  async function applyLegalTerms() {
    try {
      setApplyingLegalTerms(true);
      setError("");
      setSavedMessage("");

      const headers = await authHeaders();

      const response = await fetch(
        `/api/engagements/${engagementId}/apply-legal-terms`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to apply legal terms.");
      }

      setClauses(Array.isArray(result.clauses) ? result.clauses : []);
      setEngagement((current) =>
        current
          ? {
              ...current,
              legal_template_version:
                result.legal_template_version ||
                current.legal_template_version,
            }
          : current
      );

      setSavedMessage(
        `${result.clause_count || 0} legal clauses applied to this engagement.`
      );
    } catch (applyError: any) {
      setError(applyError?.message || "Unable to apply legal terms.");
    } finally {
      setApplyingLegalTerms(false);
    }
  }


  async function sendForSignature() {
    try {
      setSendingForSignature(true);
      setError("");
      setSavedMessage("");

      const headers = await authHeaders();

      const response = await fetch(
        `/api/engagements/${engagementId}/send-for-signature`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipientName,
            recipientEmail,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Unable to create signature request."
        );
      }

      if (result.engagement) {
        setEngagement(result.engagement);
      } else {
        setEngagement((current) =>
          current
            ? {
                ...current,
                status: "Sent",
              }
            : current
        );
      }

      setSigningUrl(result.signing_url || "");
      setSavedMessage(
        result.existing
          ? "Existing signing request opened."
          : "Engagement issued for signature."
      );
    } catch (sendError: any) {
      setError(
        sendError?.message || "Unable to create signature request."
      );
    } finally {
      setSendingForSignature(false);
    }
  }

  async function copySigningLink() {
    try {
      if (!signingUrl) return;
      await navigator.clipboard.writeText(signingUrl);
      setSavedMessage("Signing link copied.");
    } catch {
      setError("Could not copy the signing link.");
    }
  }

  if (loading) {
    return <main style={styles.page}>Loading engagement...</main>;
  }

  if (!engagement) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>{error || "Engagement not found."}</div>
      </main>
    );
  }

  const isLocked = Boolean(engagement.locked_at);
  const isEditable = engagement.status === "Draft" && !isLocked;

  const annualExVat = billingSchedule.reduce(
    (sum, row) => sum + Number(row.amount_ex_vat || 0),
    0
  );

  const annualIncVat = billingSchedule.reduce(
    (sum, row) => sum + Number(row.amount_inc_vat || 0),
    0
  );

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>
            ENGAGEMENT {engagement.engagement_number}
          </p>
          <h1 style={styles.title}>{engagement.client_name}</h1>
          <p style={styles.subtitle}>
            {engagement.contact_name || "No contact person"}
            {engagement.contact_email
              ? ` · ${engagement.contact_email}`
              : ""}
          </p>
        </div>

        <div style={styles.headerActions}>
          {engagement.proposal_id ? (
            <Link
              href={`/proposals/${engagement.proposal_id}`}
              style={styles.secondaryButton}
            >
              Proposal
            </Link>
          ) : null}

          <Link
            href={`/engagements/${engagement.id}/preview`}
            style={styles.primaryPreviewButton}
          >
            Preview Engagement
          </Link>

          <Link href="/proposals" style={styles.secondaryButton}>
            Back
          </Link>
        </div>
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {savedMessage ? (
        <div style={styles.successBox}>{savedMessage}</div>
      ) : null}

      <section style={styles.statusStrip}>
        <div>
          <span style={styles.statusLabel}>Status</span>
          <strong>{engagement.status}</strong>
        </div>
        <div>
          <span style={styles.statusLabel}>Contract</span>
          <strong>
            {formatDate(engagement.contract_start_date)} –{" "}
            {formatDate(engagement.contract_end_date)}
          </strong>
        </div>
        <div>
          <span style={styles.statusLabel}>Billing</span>
          <strong>
            25th · payment reflects by the 1st
          </strong>
        </div>
        <div>
          <span style={styles.statusLabel}>Renewal</span>
          <strong>{engagement.renewal_method}</strong>
        </div>
      </section>

      <section style={styles.layout}>
        <div style={styles.mainColumn}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <p style={styles.sectionKicker}>ENGAGEMENT SETUP</p>
                <h2 style={styles.panelTitle}>Contract and billing</h2>
              </div>

              {isLocked ? (
                <span style={styles.lockedBadge}>LOCKED</span>
              ) : (
                <span style={styles.draftBadge}>DRAFT</span>
              )}
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Contract start date</span>
                <input
                  type="date"
                  value={contractStartDate}
                  onChange={(event) =>
                    setContractStartDate(event.target.value)
                  }
                  disabled={!isEditable}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>Contract months</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={contractMonths}
                  onChange={(event) =>
                    setContractMonths(Number(event.target.value || 12))
                  }
                  disabled={!isEditable}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>Invoice day</span>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={billingDay}
                  onChange={(event) =>
                    setBillingDay(Number(event.target.value || 25))
                  }
                  disabled={!isEditable}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>Payment must reflect by</span>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={paymentDueDay}
                  onChange={(event) =>
                    setPaymentDueDay(Number(event.target.value || 1))
                  }
                  disabled={!isEditable}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>Monthly professional fee</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={monthlyFee}
                  onChange={(event) =>
                    setMonthlyFee(Number(event.target.value || 0))
                  }
                  disabled={!isEditable}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>Renewal method</span>
                <select
                  value={renewalMethod}
                  onChange={(event) => setRenewalMethod(event.target.value)}
                  disabled={!isEditable}
                  style={styles.input}
                >
                  <option value="New contract required">
                    New contract required
                  </option>
                  <option value="Manual renewal">Manual renewal</option>
                </select>
              </label>
            </div>

            <div style={styles.longFieldGrid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Special client terms</span>
                <textarea
                  value={specialTerms}
                  onChange={(event) => setSpecialTerms(event.target.value)}
                  disabled={!isEditable}
                  rows={4}
                  style={styles.textarea}
                  placeholder="Only add client-specific legal or commercial terms here."
                />
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>Internal notes</span>
                <textarea
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  disabled={!isEditable}
                  rows={4}
                  style={styles.textarea}
                  placeholder="Internal PracticePilot notes – not part of the signed engagement."
                />
              </label>
            </div>

            {isEditable ? (
              <div style={styles.saveBar}>
                <div style={styles.saveHint}>
                  Saving recalculates the contract end date and billing
                  schedule.
                </div>
                <button
                  type="button"
                  onClick={saveSetup}
                  disabled={saving}
                  style={{
                    ...styles.primaryActionButton,
                    ...(saving ? styles.disabledButton : {}),
                  }}
                >
                  {saving ? "Saving..." : "Save Engagement Setup"}
                </button>
              </div>
            ) : (
              <div style={styles.readOnlyBar}>
                Signed or non-draft engagements are read-only. Changes must be
                handled through an addendum or replacement engagement.
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <p style={styles.sectionKicker}>SCOPE OF SERVICES</p>
                <h2 style={styles.panelTitle}>
                  Pulled from accepted proposal
                </h2>
              </div>
              <span style={styles.countText}>{services.length} services</span>
            </div>

            <div style={styles.serviceHeader}>
              <span>Service</span>
              <span>Scope</span>
              <span>Frequency</span>
            </div>

            {services.length === 0 ? (
              <div style={styles.emptyRow}>No services have been copied.</div>
            ) : (
              services.map((service) => {
                const scope =
                  service.scope_quantity || service.scope_unit
                    ? `${service.scope_quantity || ""} ${
                        service.scope_unit || ""
                      }`.trim()
                    : "—";

                return (
                  <div key={service.id} style={styles.serviceBlock}>
                    <div style={styles.serviceRow}>
                      <div>
                        <strong>{service.service_name}</strong>
                        <div style={styles.category}>{service.category}</div>
                      </div>
                      <span>{scope}</span>
                      <span>{service.fee_type || "Included"}</span>
                    </div>

                    {service.description ? (
                      <p style={styles.description}>{service.description}</p>
                    ) : null}

                    {service.client_facing_note ? (
                      <p style={styles.scopeNote}>
                        {service.client_facing_note}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <p style={styles.sectionKicker}>BILLING SCHEDULE</p>
                <h2 style={styles.panelTitle}>
                  {billingSchedule.length}-month engagement billing
                </h2>
              </div>
            </div>

            <div style={styles.billingHeader}>
              <span>#</span>
              <span>Service month</span>
              <span>Invoice</span>
              <span>Payment reflects</span>
              <span style={styles.amountHeading}>Ex VAT</span>
              <span style={styles.amountHeading}>Incl. VAT</span>
            </div>

            {billingSchedule.map((row) => (
              <div key={row.id} style={styles.billingRow}>
                <span>{row.sequence_no}</span>
                <strong>{monthLabel(row.service_period_start)}</strong>
                <span>{formatDate(row.invoice_date)}</span>
                <span>{formatDate(row.payment_due_date)}</span>
                <span style={styles.amount}>
                  {money.format(Number(row.amount_ex_vat || 0))}
                </span>
                <strong style={styles.amount}>
                  {money.format(Number(row.amount_inc_vat || 0))}
                </strong>
              </div>
            ))}

            {billingSchedule.length > 0 ? (
              <div style={styles.billingTotalRow}>
                <span />
                <strong>12-month contract total</strong>
                <span />
                <span />
                <strong style={styles.amount}>
                  {money.format(annualExVat)}
                </strong>
                <strong style={styles.amount}>
                  {money.format(annualIncVat)}
                </strong>
              </div>
            ) : null}
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <p style={styles.sectionKicker}>LEGAL TERMS</p>
                <h2 style={styles.panelTitle}>Engagement clauses</h2>
              </div>
              <span style={styles.countText}>{clauses.length} clauses</span>
            </div>

            {clauses.length === 0 ? (
              <div style={styles.legalEmptyState}>
                <strong>Legal clause library not applied yet.</strong>
                <p style={styles.legalEmptyText}>
                  Apply the current Bizzacc master clause pack to this draft engagement.
                  The wording copied here becomes the engagement-specific legal snapshot.
                </p>

                {isEditable ? (
                  <button
                    type="button"
                    onClick={applyLegalTerms}
                    disabled={applyingLegalTerms}
                    style={{
                      ...styles.primaryActionButton,
                      ...(applyingLegalTerms ? styles.disabledButton : {}),
                    }}
                  >
                    {applyingLegalTerms
                      ? "Applying Legal Terms..."
                      : "Apply Legal Terms"}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div style={styles.legalAppliedBar}>
                  <div>
                    <strong>{clauses.length} clauses applied</strong>
                    <div style={styles.legalVersionText}>
                      {engagement.legal_template_version}
                    </div>
                  </div>

                  {isEditable ? (
                    <button
                      type="button"
                      onClick={applyLegalTerms}
                      disabled={applyingLegalTerms}
                      style={{
                        ...styles.secondaryActionButton,
                        ...(applyingLegalTerms ? styles.disabledButton : {}),
                      }}
                    >
                      {applyingLegalTerms
                        ? "Refreshing..."
                        : "Refresh Legal Terms"}
                    </button>
                  ) : null}
                </div>

                {clauses.map((clause, index) => (
                  <div key={clause.id} style={styles.clauseRow}>
                  <div style={styles.clauseNumber}>{index + 1}</div>
                  <div>
                    <strong>{clause.title}</strong>
                    <div style={styles.category}>{clause.category}</div>
                    <p style={styles.clauseBody}>{clause.body}</p>
                  </div>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>

        <aside style={styles.summary}>
          <p style={styles.sectionKicker}>ENGAGEMENT SUMMARY</p>
          <h2 style={styles.summaryTitle}>{engagement.status}</h2>

          <div style={styles.summaryRow}>
            <span>Monthly fee</span>
            <strong>{money.format(Number(engagement.monthly_fee || 0))}</strong>
          </div>

          <div style={styles.summaryRow}>
            <span>VAT basis</span>
            <strong>
              {engagement.fee_is_exclusive_vat
                ? "Excluding VAT"
                : "Including VAT"}
            </strong>
          </div>

          <div style={styles.summaryRow}>
            <span>Term</span>
            <strong>{engagement.contract_months} months</strong>
          </div>

          <div style={styles.summaryRow}>
            <span>Start</span>
            <strong>{formatDate(engagement.contract_start_date)}</strong>
          </div>

          <div style={styles.summaryRow}>
            <span>End</span>
            <strong>{formatDate(engagement.contract_end_date)}</strong>
          </div>

          <div style={styles.summaryRow}>
            <span>Invoice</span>
            <strong>{engagement.billing_day}th</strong>
          </div>

          <div style={styles.summaryRow}>
            <span>Payment</span>
            <strong>By the {engagement.payment_due_day}st</strong>
          </div>

          <div style={styles.summaryRow}>
            <span>Auto-renew</span>
            <strong>{engagement.auto_renew ? "Yes" : "No"}</strong>
          </div>

          <div style={styles.summaryDivider} />

          {engagement.status === "Draft" ? (
            <>
              <div style={styles.nextStepTitle}>Send for signature</div>
              <p style={styles.nextStepText}>
                Confirm who must receive and sign this engagement.
              </p>

              <label style={styles.compactField}>
                <span style={styles.fieldLabel}>Recipient name</span>
                <input
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  style={styles.input}
                  placeholder="Client contact"
                />
              </label>

              <label style={styles.compactField}>
                <span style={styles.fieldLabel}>Recipient email</span>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  style={styles.input}
                  placeholder="client@example.com"
                />
              </label>

              <button
                type="button"
                onClick={sendForSignature}
                disabled={
                  sendingForSignature ||
                  clauses.length === 0 ||
                  !recipientName.trim() ||
                  !recipientEmail.trim()
                }
                style={{
                  ...styles.sendSignatureButton,
                  ...(sendingForSignature ||
                  clauses.length === 0 ||
                  !recipientName.trim() ||
                  !recipientEmail.trim()
                    ? styles.disabledButton
                    : {}),
                }}
              >
                {sendingForSignature
                  ? "Creating Signing Link..."
                  : "Send for Signature"}
              </button>

              {clauses.length === 0 ? (
                <div style={styles.signatureWarning}>
                  Apply Legal Terms before sending.
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div style={styles.nextStepTitle}>Signature status</div>
              <p style={styles.nextStepText}>
                This engagement is currently <strong>{engagement.status}</strong>.
              </p>
            </>
          )}

          {signingUrl ? (
            <div style={styles.signingLinkBox}>
              <span style={styles.signingLinkLabel}>CLIENT SIGNING LINK</span>
              <div style={styles.signingLinkValue}>{signingUrl}</div>
              <button
                type="button"
                onClick={copySigningLink}
                style={styles.copyLinkButton}
              >
                Copy Signing Link
              </button>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 54px)",
    padding: 28,
    background: "#f8fafc",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
    marginBottom: 20,
  },
  headerActions: {
    display: "flex",
    gap: 10,
  },
  eyebrow: {
    margin: "0 0 5px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.14em",
    color: "#2563eb",
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "#64748b",
  },
  primaryPreviewButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "0 14px",
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "0 14px",
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #94a3b8",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },
  statusStrip: {
    display: "grid",
    gridTemplateColumns: "140px 1.35fr 1.35fr 1fr",
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    marginBottom: 18,
  },
  statusLabel: {
    display: "block",
    marginBottom: 4,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: "#64748b",
    textTransform: "uppercase",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 310px",
    gap: 18,
    alignItems: "start",
  },
  mainColumn: {
    display: "grid",
    gap: 16,
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
  },
  panelHeader: {
    minHeight: 62,
    padding: "12px 16px",
    borderBottom: "1px solid #dbe3ef",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  sectionKicker: {
    margin: "0 0 3px",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    color: "#2563eb",
  },
  panelTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
  },
  draftBadge: {
    display: "inline-flex",
    minHeight: 26,
    alignItems: "center",
    padding: "0 9px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: 10,
    fontWeight: 900,
  },
  lockedBadge: {
    display: "inline-flex",
    minHeight: 26,
    alignItems: "center",
    padding: "0 9px",
    border: "1px solid #94a3b8",
    background: "#e2e8f0",
    fontSize: 10,
    fontWeight: 900,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    padding: 16,
  },
  longFieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    padding: "0 16px 16px",
  },
  field: {
    display: "grid",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 850,
    color: "#475569",
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    minHeight: 38,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "0 10px",
    fontSize: 13,
    color: "#0f172a",
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: 10,
    fontSize: 13,
    lineHeight: 1.5,
    color: "#0f172a",
    fontFamily: "inherit",
  },
  saveBar: {
    borderTop: "1px solid #dbe3ef",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    background: "#f8fafc",
  },
  saveHint: {
    fontSize: 12,
    color: "#64748b",
  },
  primaryActionButton: {
    minHeight: 40,
    padding: "0 16px",
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  readOnlyBar: {
    borderTop: "1px solid #dbe3ef",
    padding: 14,
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
  },
  countText: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
  },
  serviceHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1fr) 130px 130px",
    gap: 12,
    minHeight: 38,
    alignItems: "center",
    padding: "0 14px",
    background: "#f1f5f9",
    borderBottom: "1px solid #dbe3ef",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#475569",
  },
  serviceBlock: {
    borderBottom: "1px solid #e2e8f0",
  },
  serviceRow: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1fr) 130px 130px",
    gap: 12,
    minHeight: 56,
    alignItems: "center",
    padding: "0 14px",
    fontSize: 13,
  },
  category: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
  },
  description: {
    margin: "0 14px 10px",
    fontSize: 12,
    lineHeight: 1.5,
    color: "#475569",
  },
  scopeNote: {
    margin: "0 14px 14px",
    padding: "8px 10px",
    background: "#f8fafc",
    borderLeft: "2px solid #94a3b8",
    fontSize: 11,
    lineHeight: 1.45,
    color: "#475569",
  },
  emptyRow: {
    padding: 18,
    color: "#64748b",
    fontSize: 13,
  },
  billingHeader: {
    display: "grid",
    gridTemplateColumns: "42px 1.3fr 125px 135px 120px 120px",
    gap: 10,
    minHeight: 38,
    alignItems: "center",
    padding: "0 12px",
    background: "#f1f5f9",
    borderBottom: "1px solid #dbe3ef",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#475569",
  },
  billingRow: {
    display: "grid",
    gridTemplateColumns: "42px 1.3fr 125px 135px 120px 120px",
    gap: 10,
    minHeight: 46,
    alignItems: "center",
    padding: "0 12px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
  },
  billingTotalRow: {
    display: "grid",
    gridTemplateColumns: "42px 1.3fr 125px 135px 120px 120px",
    gap: 10,
    minHeight: 50,
    alignItems: "center",
    padding: "0 12px",
    background: "#f8fafc",
    borderTop: "1px solid #94a3b8",
    fontSize: 12,
  },
  amountHeading: {
    textAlign: "right",
  },
  amount: {
    textAlign: "right",
  },
  legalAppliedBar: {
    minHeight: 54,
    padding: "10px 14px",
    borderBottom: "1px solid #dbe3ef",
    background: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    fontSize: 12,
  },
  legalVersionText: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748b",
  },
  secondaryActionButton: {
    minHeight: 34,
    padding: "0 12px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
  },
  legalEmptyText: {
    margin: "6px 0 14px",
    lineHeight: 1.5,
  },
  legalEmptyState: {
    padding: 20,
    color: "#475569",
    fontSize: 13,
  },
  clauseRow: {
    display: "grid",
    gridTemplateColumns: "38px minmax(0, 1fr)",
    gap: 10,
    padding: 14,
    borderBottom: "1px solid #e2e8f0",
  },
  clauseNumber: {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
  },
  clauseBody: {
    margin: "8px 0 0",
    whiteSpace: "pre-wrap",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#475569",
  },
  summary: {
    position: "sticky",
    top: 72,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    padding: 16,
  },
  summaryTitle: {
    margin: "0 0 12px",
    fontSize: 20,
    fontWeight: 900,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    padding: "10px 0",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
  },
  summaryDivider: {
    height: 1,
    background: "#94a3b8",
    margin: "16px 0",
  },
  compactField: {
    display: "grid",
    gap: 5,
    marginTop: 10,
  },
  sendSignatureButton: {
    width: "100%",
    minHeight: 40,
    marginTop: 12,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  signatureWarning: {
    marginTop: 8,
    fontSize: 10,
    color: "#92400e",
  },
  signingLinkBox: {
    marginTop: 14,
    padding: 10,
    background: "#f8fafc",
    border: "1px solid #dbe3ef",
  },
  signingLinkLabel: {
    display: "block",
    marginBottom: 5,
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: "#64748b",
  },
  signingLinkValue: {
    padding: 8,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    wordBreak: "break-all",
    fontSize: 10,
    lineHeight: 1.4,
    color: "#334155",
  },
  copyLinkButton: {
    width: "100%",
    minHeight: 34,
    marginTop: 8,
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 10,
    fontWeight: 850,
    cursor: "pointer",
  },
  nextStepTitle: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 900,
  },
  nextStepText: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: "#64748b",
  },
  errorBox: {
    marginBottom: 16,
    padding: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 750,
  },
  successBox: {
    marginBottom: 16,
    padding: 12,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: 12,
    fontWeight: 750,
  },
};
