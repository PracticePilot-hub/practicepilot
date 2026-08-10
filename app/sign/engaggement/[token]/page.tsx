"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";

type Engagement = {
  id: string;
  engagement_number: string;
  client_name: string;
  client_registration_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
  contract_start_date: string;
  contract_end_date: string;
  contract_months: number;
  billing_day: number;
  payment_due_day: number;
  monthly_fee: number;
  fee_is_exclusive_vat: boolean;
  vat_rate: number;
  renewal_method: string;
  special_terms: string | null;
  legal_template_version: string;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_capacity: string | null;
};

type Service = {
  id: string;
  category: string;
  service_name: string;
  description: string | null;
  fee_type: string | null;
  amount: number;
  scope_quantity: number | null;
  scope_unit: string | null;
  client_facing_note: string | null;
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
};

type Clause = {
  id: string;
  category: string;
  title: string;
  body: string;
  clause_version: number;
};

type SignatureRequest = {
  id: string;
  recipient_name: string | null;
  recipient_email: string;
  status: string;
  expires_at: string;
  signed_at: string | null;
  signed_name: string | null;
  signed_capacity: string | null;
  signed_email: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00` : value));
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function scopeText(service: Service) {
  const quantity =
    service.scope_quantity === null || service.scope_quantity === undefined
      ? ""
      : String(service.scope_quantity);

  const unit = String(service.scope_unit || "").trim();

  if (!quantity && !unit) return "";
  if (!quantity) return unit;
  if (!unit) return quantity;

  return `${quantity} ${unit}`;
}

export default function PublicEngagementSigningPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || "");

  const [signatureRequest, setSignatureRequest] =
    useState<SignatureRequest | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [clauses, setClauses] = useState<Clause[]>([]);

  const [signedName, setSignedName] = useState("");
  const [signedCapacity, setSignedCapacity] = useState("");
  const [signedEmail, setSignedEmail] = useState("");
  const [accepted, setAccepted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [signedSuccess, setSignedSuccess] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/sign/engagement/${token}`, {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Unable to load engagement.");
        }

        if (cancelled) return;

        setSignatureRequest(result.signature_request);
        setEngagement(result.engagement);
        setServices(Array.isArray(result.services) ? result.services : []);
        setBilling(
          Array.isArray(result.billing_schedule)
            ? result.billing_schedule
            : []
        );
        setClauses(Array.isArray(result.clauses) ? result.clauses : []);

        setSignedName(
          result.signature_request?.signed_name ||
            result.signature_request?.recipient_name ||
            ""
        );
        setSignedCapacity(result.signature_request?.signed_capacity || "");
        setSignedEmail(
          result.signature_request?.signed_email ||
            result.signature_request?.recipient_email ||
            ""
        );

        if (result.signature_request?.status === "Signed") {
          setSignedSuccess(true);
          setSignedAt(result.signature_request?.signed_at || null);
          setAccepted(true);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || "Unable to load engagement.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (token) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function signEngagement() {
    try {
      setSigning(true);
      setError("");

      const response = await fetch(`/api/sign/engagement/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signedName,
          signedCapacity,
          signedEmail,
          accepted,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to sign engagement.");
      }

      setSignedSuccess(true);
      setSignedAt(result.signed_at || new Date().toISOString());

      setSignatureRequest((current) =>
        current
          ? {
              ...current,
              status: "Signed",
              signed_at: result.signed_at || new Date().toISOString(),
              signed_name: signedName,
              signed_capacity: signedCapacity,
              signed_email: signedEmail,
            }
          : current
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (signError: any) {
      setError(signError?.message || "Unable to sign engagement.");
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.pageShell}>
        <div style={styles.loadingBox}>Loading engagement...</div>
      </main>
    );
  }

  if (!engagement || !signatureRequest) {
    return (
      <main style={styles.pageShell}>
        <div style={styles.errorBox}>{error || "Engagement not found."}</div>
      </main>
    );
  }

  const vatRate = Number(engagement.vat_rate || 0);
  const monthlyExVat = engagement.fee_is_exclusive_vat
    ? Number(engagement.monthly_fee || 0)
    : Number(engagement.monthly_fee || 0) / (1 + vatRate);

  const monthlyVat = monthlyExVat * vatRate;
  const monthlyIncVat = monthlyExVat + monthlyVat;

  const groupedServices = services.reduce<Record<string, Service[]>>(
    (groups, service) => {
      const category = service.category || "Other Services";
      groups[category] = groups[category] || [];
      groups[category].push(service);
      return groups;
    },
    {}
  );

  const alreadySigned =
    signedSuccess || signatureRequest.status === "Signed";

  return (
    <main style={styles.pageShell}>
      <section style={styles.topBar}>
        <div>
          <div style={styles.brand}>bizzacc</div>
          <div style={styles.brandSub}>
            ACCOUNTING · CONSULTING · TAXATION
          </div>
        </div>

        <div style={styles.topBarRight}>
          <span style={styles.engagementNo}>
            {engagement.engagement_number}
          </span>
          <span style={styles.statusBadge}>
            {alreadySigned ? "SIGNED" : "AWAITING SIGNATURE"}
          </span>
        </div>
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      {alreadySigned ? (
        <section style={styles.successBanner}>
          <div style={styles.successMark}>✓</div>
          <div>
            <strong>Engagement successfully signed</strong>
            <p style={styles.successText}>
              Signed by {signatureRequest.signed_name || signedName}
              {signatureRequest.signed_capacity || signedCapacity
                ? ` · ${
                    signatureRequest.signed_capacity || signedCapacity
                  }`
                : ""}
              {" · "}
              {formatDate(
                signatureRequest.signed_at || signedAt
              )}
            </p>
          </div>
        </section>
      ) : (
        <section style={styles.introBanner}>
          <div>
            <p style={styles.kicker}>CLIENT ENGAGEMENT</p>
            <h1 style={styles.pageTitle}>Review and sign your engagement</h1>
          </div>

          <p style={styles.introText}>
            Please review the scope, billing schedule and legal terms below.
            You can sign electronically at the end of the document.
          </p>
        </section>
      )}

      <section style={styles.document}>
        <div style={styles.section}>
          <p style={styles.kicker}>ENGAGEMENT OVERVIEW</p>
          <h2 style={styles.sectionTitle}>{engagement.client_name}</h2>

          <div style={styles.summaryGrid}>
            <SummaryCell
              label="Contract start"
              value={formatDate(engagement.contract_start_date)}
            />
            <SummaryCell
              label="Contract end"
              value={formatDate(engagement.contract_end_date)}
            />
            <SummaryCell
              label="Contract term"
              value={`${engagement.contract_months} months`}
            />
            <SummaryCell
              label="Renewal"
              value={engagement.renewal_method}
            />
          </div>

          <div style={styles.feeBand}>
            <div>
              <span style={styles.feeLabel}>MONTHLY PROFESSIONAL FEE</span>
              <strong style={styles.feeAmount}>
                {money.format(monthlyExVat)}
              </strong>
              <span style={styles.feeSub}>Excluding VAT</span>
            </div>

            <div style={styles.feeSummary}>
              <span>
                VAT <strong>{money.format(monthlyVat)}</strong>
              </span>
              <span>
                Monthly including VAT{" "}
                <strong>{money.format(monthlyIncVat)}</strong>
              </span>
            </div>
          </div>

          <div style={styles.infoBox}>
            <strong>Billing arrangement</strong>
            <p>
              The monthly invoice is issued on the{" "}
              <strong>{engagement.billing_day}th</strong> of the month
              preceding the service month. Payment must reflect in Bizzacc&apos;s
              bank account by the{" "}
              <strong>{engagement.payment_due_day}st</strong> of the service
              month.
            </p>
          </div>

          {engagement.special_terms ? (
            <div style={styles.specialBox}>
              <strong>Special terms</strong>
              <p>{engagement.special_terms}</p>
            </div>
          ) : null}
        </div>

        <div style={styles.section}>
          <p style={styles.kicker}>SCOPE OF SERVICES</p>
          <h2 style={styles.sectionTitle}>Services included</h2>

          {Object.entries(groupedServices).map(
            ([category, categoryServices]) => (
              <div key={category} style={styles.serviceGroup}>
                <div style={styles.categoryHeader}>{category}</div>

                {categoryServices.map((service) => {
                  const scope = scopeText(service);

                  return (
                    <div key={service.id} style={styles.serviceItem}>
                      <div style={styles.serviceTop}>
                        <strong>{service.service_name}</strong>
                        <span style={styles.included}>INCLUDED</span>
                      </div>

                      {service.description ? (
                        <p style={styles.serviceDescription}>
                          {service.description}
                        </p>
                      ) : null}

                      {scope || service.client_facing_note ? (
                        <div style={styles.scopeNote}>
                          {scope ? (
                            <span>
                              <strong>Scope:</strong> {scope}
                            </span>
                          ) : null}

                          {service.client_facing_note ? (
                            <span>{service.client_facing_note}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        <div style={styles.section}>
          <p style={styles.kicker}>BILLING SCHEDULE</p>
          <h2 style={styles.sectionTitle}>Invoice and payment dates</h2>

          <div style={styles.billingHeader}>
            <span>#</span>
            <span>Service month</span>
            <span>Invoice</span>
            <span>Payment</span>
            <span style={styles.amount}>Ex VAT</span>
            <span style={styles.amount}>Incl. VAT</span>
          </div>

          {billing.map((row) => (
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
        </div>

        <div style={styles.section}>
          <p style={styles.kicker}>TERMS OF ENGAGEMENT</p>
          <h2 style={styles.sectionTitle}>Legal terms</h2>

          <div style={styles.clauseList}>
            {clauses.map((clause, index) => (
              <article key={clause.id} style={styles.clause}>
                <div style={styles.clauseNo}>{index + 1}</div>
                <div>
                  <div style={styles.clauseCategory}>{clause.category}</div>
                  <h3 style={styles.clauseTitle}>{clause.title}</h3>
                  <p style={styles.clauseBody}>{clause.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div style={styles.signatureSection}>
          <p style={styles.kicker}>ACCEPTANCE</p>
          <h2 style={styles.sectionTitle}>Electronic signature</h2>

          {alreadySigned ? (
            <div style={styles.signedCard}>
              <div style={styles.signedLabel}>SIGNED ELECTRONICALLY</div>
              <strong style={styles.signedName}>
                {signatureRequest.signed_name || signedName}
              </strong>
              <span>
                {signatureRequest.signed_capacity || signedCapacity}
              </span>
              <span>
                {signatureRequest.signed_email || signedEmail}
              </span>
              <span>
                {formatDate(signatureRequest.signed_at || signedAt)}
              </span>
            </div>
          ) : (
            <>
              <p style={styles.acceptanceText}>
                By signing below, I confirm that I am authorised to accept this
                engagement on behalf of {engagement.client_name}, that I have
                reviewed the scope of services, fees, billing schedule and
                legal terms, and that the Client accepts this engagement.
              </p>

              <div style={styles.signGrid}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Full name</span>
                  <input
                    value={signedName}
                    onChange={(event) => setSignedName(event.target.value)}
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Capacity / Position</span>
                  <input
                    value={signedCapacity}
                    onChange={(event) => setSignedCapacity(event.target.value)}
                    placeholder="e.g. Director"
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Email address</span>
                  <input
                    type="email"
                    value={signedEmail}
                    onChange={(event) => setSignedEmail(event.target.value)}
                    style={styles.input}
                  />
                </label>
              </div>

              <label style={styles.acceptRow}>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <span>
                  I confirm that I have read and accept this engagement and am
                  authorised to sign on behalf of the Client.
                </span>
              </label>

              <button
                type="button"
                onClick={signEngagement}
                disabled={
                  signing ||
                  !accepted ||
                  !signedName.trim() ||
                  !signedCapacity.trim() ||
                  !signedEmail.trim()
                }
                style={{
                  ...styles.signButton,
                  ...(signing ||
                  !accepted ||
                  !signedName.trim() ||
                  !signedCapacity.trim() ||
                  !signedEmail.trim()
                    ? styles.disabledButton
                    : {}),
                }}
              >
                {signing ? "Signing..." : "Sign and Accept Engagement"}
              </button>
            </>
          )}

          <div style={styles.legalMeta}>
            <span>
              Legal template: {engagement.legal_template_version}
            </span>
            <span>
              Signing request expires {formatDate(signatureRequest.expires_at)}
            </span>
          </div>
        </div>
      </section>

      <footer style={styles.footer}>
        <strong>Bizzacc Menlyn (Pty) Ltd</strong>
        <span>www.bizzacc.co.za</span>
      </footer>
    </main>
  );
}

function SummaryCell(props: { label: string; value: string }) {
  return (
    <div style={styles.summaryCell}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageShell: {
    minHeight: "100vh",
    background: "#eef2f7",
    color: "#0f172a",
    padding: "0 16px 40px",
  },
  loadingBox: {
    maxWidth: 900,
    margin: "60px auto",
    padding: 20,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
  },
  topBar: {
    maxWidth: 1040,
    margin: "0 auto",
    minHeight: 82,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },
  brand: {
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1,
    color: "#0f4c6d",
    letterSpacing: "-0.05em",
  },
  brandSub: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#64748b",
  },
  topBarRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  engagementNo: {
    fontSize: 11,
    fontWeight: 850,
    color: "#475569",
  },
  statusBadge: {
    minHeight: 28,
    padding: "0 10px",
    display: "inline-flex",
    alignItems: "center",
    background: "#0f4c6d",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.06em",
  },
  introBanner: {
    maxWidth: 1040,
    margin: "0 auto 16px",
    padding: "20px 22px",
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    display: "flex",
    justifyContent: "space-between",
    gap: 30,
    alignItems: "center",
  },
  introText: {
    maxWidth: 430,
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    color: "#64748b",
  },
  pageTitle: {
    margin: 0,
    fontSize: 27,
    fontWeight: 800,
    color: "#244b63",
  },
  successBanner: {
    maxWidth: 1040,
    margin: "0 auto 16px",
    padding: "16px 20px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    display: "flex",
    gap: 12,
    alignItems: "center",
    color: "#166534",
  },
  successMark: {
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#166534",
    color: "#ffffff",
    fontWeight: 900,
  },
  successText: {
    margin: "3px 0 0",
    fontSize: 12,
  },
  errorBox: {
    maxWidth: 1040,
    margin: "0 auto 16px",
    padding: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 700,
  },
  document: {
    maxWidth: 1040,
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #dbe3ef",
  },
  section: {
    padding: "28px 30px",
    borderBottom: "1px solid #dbe3ef",
  },
  kicker: {
    margin: "0 0 5px",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.13em",
    color: "#0f4c6d",
  },
  sectionTitle: {
    margin: "0 0 20px",
    fontSize: 24,
    fontWeight: 600,
    color: "#244b63",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    border: "1px solid #dbe3ef",
    marginBottom: 20,
  },
  summaryCell: {
    minHeight: 70,
    padding: 12,
    display: "grid",
    gap: 6,
    borderRight: "1px solid #dbe3ef",
    fontSize: 11,
  },
  feeBand: {
    padding: "20px 22px",
    background: "#124a67",
    color: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    gap: 30,
    alignItems: "center",
    marginBottom: 18,
  },
  feeLabel: {
    display: "block",
    fontSize: 9,
    letterSpacing: "0.08em",
  },
  feeAmount: {
    display: "block",
    margin: "5px 0 3px",
    fontSize: 28,
  },
  feeSub: {
    fontSize: 9,
  },
  feeSummary: {
    display: "grid",
    gap: 7,
    fontSize: 11,
  },
  infoBox: {
    padding: 14,
    background: "#f8fafc",
    border: "1px solid #dbe3ef",
    fontSize: 11,
    lineHeight: 1.6,
  },
  specialBox: {
    marginTop: 14,
    padding: 14,
    background: "#f8fafc",
    borderLeft: "3px solid #7cad29",
    fontSize: 11,
    lineHeight: 1.6,
  },
  serviceGroup: {
    marginBottom: 18,
  },
  categoryHeader: {
    padding: "9px 12px",
    background: "#124a67",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 850,
    textTransform: "uppercase",
  },
  serviceItem: {
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
  },
  serviceTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 12,
  },
  included: {
    padding: "3px 7px",
    background: "#eef4f7",
    color: "#124a67",
    fontSize: 8,
    fontWeight: 900,
  },
  serviceDescription: {
    margin: "6px 0 0",
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#64748b",
  },
  scopeNote: {
    marginTop: 8,
    padding: 9,
    background: "#f8fafc",
    display: "grid",
    gap: 4,
    fontSize: 10,
    color: "#475569",
  },
  billingHeader: {
    display: "grid",
    gridTemplateColumns: "40px 1.4fr 130px 130px 120px 120px",
    gap: 10,
    minHeight: 38,
    alignItems: "center",
    padding: "0 10px",
    background: "#eef2f7",
    borderBottom: "1px solid #cbd5e1",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  billingRow: {
    display: "grid",
    gridTemplateColumns: "40px 1.4fr 130px 130px 120px 120px",
    gap: 10,
    minHeight: 42,
    alignItems: "center",
    padding: "0 10px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 10.5,
  },
  amount: {
    textAlign: "right",
  },
  clauseList: {
    display: "grid",
    gap: 0,
    borderTop: "1px solid #dbe3ef",
  },
  clause: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr)",
    gap: 12,
    padding: "16px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  clauseNo: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#124a67",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 900,
  },
  clauseCategory: {
    marginBottom: 3,
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: "#64748b",
    textTransform: "uppercase",
  },
  clauseTitle: {
    margin: 0,
    fontSize: 13,
    color: "#244b63",
  },
  clauseBody: {
    margin: "7px 0 0",
    fontSize: 10.5,
    lineHeight: 1.7,
    color: "#475569",
    whiteSpace: "pre-wrap",
  },
  signatureSection: {
    padding: "30px",
  },
  acceptanceText: {
    margin: "0 0 20px",
    fontSize: 11,
    lineHeight: 1.7,
    color: "#475569",
  },
  signGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 14,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#475569",
  },
  input: {
    minHeight: 40,
    padding: "0 10px",
    border: "1px solid #cbd5e1",
    fontSize: 12,
  },
  acceptRow: {
    marginTop: 18,
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    background: "#f8fafc",
    border: "1px solid #dbe3ef",
    fontSize: 11,
    lineHeight: 1.5,
  },
  signButton: {
    marginTop: 16,
    minHeight: 44,
    padding: "0 18px",
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  signedCard: {
    padding: 20,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    display: "grid",
    gap: 5,
    color: "#166534",
  },
  signedLabel: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },
  signedName: {
    fontSize: 20,
  },
  legalMeta: {
    marginTop: 20,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    fontSize: 9,
    color: "#94a3b8",
  },
  footer: {
    maxWidth: 1040,
    margin: "16px auto 0",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 9,
    color: "#64748b",
  },
};
