"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Engagement = {
  id: string;
  engagement_number: string;
  proposal_id: string | null;
  client_name: string;
  client_registration_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_number: string | null;
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
  auto_renew: boolean;
  special_terms: string | null;
  legal_template_version: string;
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
};

type Clause = {
  id: string;
  category: string;
  title: string;
  body: string;
  clause_version: number;
  sort_order: number;
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
    month: "long",
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

export default function EngagementPreviewPage() {
  const params = useParams<{ id: string }>();
  const engagementId = String(params?.id || "");

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

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

    async function loadPreview() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error("Your login session could not be confirmed.");
        }

        const response = await fetch(`/api/engagements/${engagementId}`, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Unable to load engagement preview.");
        }

        if (!cancelled) {
          setEngagement(result.engagement);
          setServices(Array.isArray(result.services) ? result.services : []);
          setBilling(
            Array.isArray(result.billing_schedule)
              ? result.billing_schedule
              : []
          );
          setClauses(Array.isArray(result.clauses) ? result.clauses : []);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(
            loadError?.message || "Unable to load engagement preview."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (engagementId) {
      loadPreview();
    }

    return () => {
      cancelled = true;
    };
  }, [engagementId]);


  async function exportPdf() {
    try {
      setExportingPdf(true);
      setError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your login session could not be confirmed.");
      }

      const response = await fetch(
        `/api/engagements/${engagementId}/export-pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const result = await response.json();
          throw new Error(result?.error || "Unable to export PDF.");
        }

        throw new Error("Unable to export PDF.");
      }

      const blob = await response.blob();
      const contentDisposition =
        response.headers.get("content-disposition") || "";

      const fileNameMatch = /filename="([^"]+)"/i.exec(contentDisposition);

      const fileName =
        fileNameMatch?.[1] ||
        `${engagement?.engagement_number || "Engagement"}-Engagement-Letter.pdf`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    } catch (exportError: any) {
      setError(exportError?.message || "Unable to export PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) {
    return <main style={styles.screenPage}>Loading engagement preview...</main>;
  }

  if (!engagement) {
    return (
      <main style={styles.screenPage}>
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

  const totalExVat = billing.reduce(
    (total, row) => total + Number(row.amount_ex_vat || 0),
    0
  );

  const totalIncVat = billing.reduce(
    (total, row) => total + Number(row.amount_inc_vat || 0),
    0
  );

  const groupedServices = services.reduce<Record<string, Service[]>>(
    (groups, service) => {
      const category = service.category || "Other Services";
      groups[category] = groups[category] || [];
      groups[category].push(service);
      return groups;
    },
    {}
  );

  return (
    <main style={styles.screenPage}>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden;
          }

          [data-engagement-document],
          [data-engagement-document] * {
            visibility: visible;
          }

          [data-engagement-document] {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
          }

          [data-engagement-document] > section {
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .pp-no-print {
            display: none !important;
          }
        }
      `}</style>

      <section className="pp-no-print" style={styles.screenToolbar}>
        <div>
          <p style={styles.toolbarKicker}>ENGAGEMENT PREVIEW</p>
          <strong>{engagement.engagement_number}</strong>
        </div>

        <div style={styles.toolbarActions}>
          <Link
            href={`/engagements/${engagement.id}`}
            style={styles.secondaryButton}
          >
            Back to Engagement
          </Link>

          <button
            type="button"
            onClick={exportPdf}
            disabled={exportingPdf}
            style={{
              ...styles.primaryButton,
              ...(exportingPdf ? styles.disabledButton : {}),
            }}
          >
            {exportingPdf ? "Exporting PDF..." : "Export PDF"}
          </button>
        </div>
      </section>

      {clauses.length === 0 ? (
        <div className="pp-no-print" style={styles.warningBox}>
          Legal terms have not been applied yet. Return to the engagement and
          apply the legal clause pack before issuing this document.
        </div>
      ) : null}

      <div data-engagement-document style={styles.document}>
        <section style={styles.coverPage}>
          <div style={styles.coverTop}>
            <div style={styles.brandWord}>BIZZACC</div>
            <div style={styles.brandDescriptor}>
              ACCOUNTING · CONSULTING · TAXATION
            </div>
          </div>

          <div style={styles.coverBody}>
            <p style={styles.coverKicker}>CLIENT ENGAGEMENT</p>
            <h1 style={styles.coverTitle}>Engagement Letter</h1>

            <div style={styles.coverRule} />

            <div style={styles.coverDetails}>
              <div style={styles.coverDetailRow}>
                <span>Prepared for</span>
                <strong>{engagement.client_name}</strong>
              </div>

              {engagement.client_registration_number ? (
                <div style={styles.coverDetailRow}>
                  <span>Registration number</span>
                  <strong>{engagement.client_registration_number}</strong>
                </div>
              ) : null}

              <div style={styles.coverDetailRow}>
                <span>Contact</span>
                <strong>{engagement.contact_name || "-"}</strong>
              </div>

              <div style={styles.coverDetailRow}>
                <span>Engagement</span>
                <strong>{engagement.engagement_number}</strong>
              </div>

              <div style={styles.coverDetailRow}>
                <span>Contract period</span>
                <strong>
                  {formatDate(engagement.contract_start_date)} –{" "}
                  {formatDate(engagement.contract_end_date)}
                </strong>
              </div>
            </div>
          </div>

          <div style={styles.coverFooter}>
            <span>Bizzacc Menlyn (Pty) Ltd</span>
            <span>www.bizzacc.co.za</span>
          </div>
        </section>

        <section style={styles.page}>
          <PageHeader
            engagementNumber={engagement.engagement_number}
            clientName={engagement.client_name}
            section="Engagement overview"
          />

          <div style={styles.pageContent}>
            <p style={styles.sectionKicker}>WELCOME</p>
            <h2 style={styles.sectionTitle}>Our engagement</h2>

            <p style={styles.bodyText}>
              Thank you for appointing Bizzacc Menlyn (Pty) Ltd. This engagement
              records the professional services, responsibilities, fees,
              billing arrangements and legal terms applicable to our
              appointment.
            </p>

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

            <div style={styles.feeBox}>
              <div>
                <span style={styles.feeLabel}>MONTHLY PROFESSIONAL FEE</span>
                <strong style={styles.feeAmount}>
                  {money.format(monthlyExVat)}
                </strong>
                <span style={styles.feeSubLabel}>Excluding VAT</span>
              </div>

              <div style={styles.feeRight}>
                <span>
                  VAT <strong>{money.format(monthlyVat)}</strong>
                </span>
                <span>
                  Monthly total including VAT{" "}
                  <strong>{money.format(monthlyIncVat)}</strong>
                </span>
              </div>
            </div>

            <div style={styles.billingStatement}>
              <strong>Billing arrangement</strong>
              <p>
                Recurring monthly services are invoiced on the{" "}
                <strong>{engagement.billing_day}th</strong> of the month
                preceding the service month. Payment must reflect as cleared
                funds in Bizzacc&apos;s bank account on or before the{" "}
                <strong>{engagement.payment_due_day}st</strong> of the service
                month.
              </p>
            </div>

            {engagement.special_terms ? (
              <div style={styles.specialTerms}>
                <strong>Special terms</strong>
                <p>{engagement.special_terms}</p>
              </div>
            ) : null}
          </div>

          <PageFooter engagementNumber={engagement.engagement_number} />
        </section>

        <section style={styles.page}>
          <PageHeader
            engagementNumber={engagement.engagement_number}
            clientName={engagement.client_name}
            section="Scope of services"
          />

          <div style={styles.pageContent}>
            <p style={styles.sectionKicker}>SCOPE OF SERVICES</p>
            <h2 style={styles.sectionTitle}>Services included</h2>

            {Object.entries(groupedServices).map(
              ([category, categoryServices]) => (
                <section key={category} style={styles.serviceCategory}>
                  <h3 style={styles.categoryTitle}>{category}</h3>

                  {categoryServices.map((service) => {
                    const scope = scopeText(service);

                    return (
                      <article key={service.id} style={styles.serviceItem}>
                        <div style={styles.serviceHeadingRow}>
                          <strong>{service.service_name}</strong>
                          <span style={styles.includedBadge}>INCLUDED</span>
                        </div>

                        {service.description ? (
                          <p style={styles.serviceDescription}>
                            {service.description}
                          </p>
                        ) : null}

                        {scope || service.client_facing_note ? (
                          <div style={styles.scopeBox}>
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
                      </article>
                    );
                  })}
                </section>
              )
            )}
          </div>

          <PageFooter engagementNumber={engagement.engagement_number} />
        </section>

        <section style={styles.page}>
          <PageHeader
            engagementNumber={engagement.engagement_number}
            clientName={engagement.client_name}
            section="Billing schedule"
          />

          <div style={styles.pageContent}>
            <p style={styles.sectionKicker}>12-MONTH BILLING SCHEDULE</p>
            <h2 style={styles.sectionTitle}>Invoice and payment dates</h2>

            <div style={styles.billingHeader}>
              <span>#</span>
              <span>Service month</span>
              <span>Invoice date</span>
              <span>Payment reflects</span>
              <span style={styles.amountHeading}>Ex VAT</span>
              <span style={styles.amountHeading}>Incl. VAT</span>
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

            <div style={styles.billingTotalRow}>
              <span />
              <strong>Contract total</strong>
              <span />
              <span />
              <strong style={styles.amount}>{money.format(totalExVat)}</strong>
              <strong style={styles.amount}>{money.format(totalIncVat)}</strong>
            </div>

            <div style={styles.billingStatement}>
              <strong>Important</strong>
              <p>
                The billing schedule forms part of the engagement. The contract
                does not automatically renew for a further twelve months. A new
                engagement or written renewal must be concluded for services
                after {formatDate(engagement.contract_end_date)}.
              </p>
            </div>
          </div>

          <PageFooter engagementNumber={engagement.engagement_number} />
        </section>

        <section style={styles.legalTermsDocument}>
          <PageHeader
            engagementNumber={engagement.engagement_number}
            clientName={engagement.client_name}
            section="Terms of engagement"
          />

          <div style={styles.legalTermsContent}>
            <p style={styles.sectionKicker}>TERMS OF ENGAGEMENT</p>
            <h2 style={styles.sectionTitle}>Legal terms</h2>

            {clauses.map((clause, index) => (
              <article key={clause.id} style={styles.legalClauseBlock}>
                <div style={styles.legalClauseHeading}>
                  <span style={styles.legalClauseNumber}>{index + 1}</span>
                  <div>
                    <p style={styles.legalCategory}>{clause.category}</p>
                    <h3 style={styles.legalTitle}>{clause.title}</h3>
                  </div>
                </div>

                <p style={styles.legalBody}>{clause.body}</p>
              </article>
            ))}
          </div>

          <PageFooter engagementNumber={engagement.engagement_number} />
        </section>

        <section style={styles.page}>
          <PageHeader
            engagementNumber={engagement.engagement_number}
            clientName={engagement.client_name}
            section="Acceptance"
          />

          <div style={styles.pageContent}>
            <p style={styles.sectionKicker}>ACCEPTANCE</p>
            <h2 style={styles.sectionTitle}>Acceptance of engagement</h2>

            <p style={styles.bodyText}>
              I confirm that I am authorised to accept this engagement on
              behalf of {engagement.client_name}, that I have reviewed the
              scope, fees, billing schedule and terms of engagement, and that
              the Client accepts this engagement.
            </p>

            <div style={styles.signatureGrid}>
              <SignatureField label="Name" />
              <SignatureField label="Capacity" />
              <SignatureField label="Signature" />
              <SignatureField label="Date" />
            </div>

            <div style={styles.practitionerBox}>
              <strong>Ferdi van Aswegen</strong>
              <span>Professional Accountant (SA) · SAIPA 28289</span>
              <span>Bizzacc Menlyn (Pty) Ltd</span>
              <span>ferdi_v@bizzacc.co.za · 012 881 6388</span>
            </div>

            <div style={styles.templateVersion}>
              Legal template: {engagement.legal_template_version}
            </div>
          </div>

          <PageFooter engagementNumber={engagement.engagement_number} />
        </section>
      </div>
    </main>
  );
}

function PageHeader(props: {
  engagementNumber: string;
  clientName: string;
  section: string;
}) {
  return (
    <header style={styles.pageHeader}>
      <div>
        <strong>{props.engagementNumber}</strong>
        <span>{props.clientName}</span>
      </div>
      <span>{props.section}</span>
    </header>
  );
}

function PageFooter(props: { engagementNumber: string }) {
  return (
    <footer style={styles.pageFooter}>
      <span>Bizzacc Menlyn (Pty) Ltd · www.bizzacc.co.za</span>
      <span>{props.engagementNumber}</span>
    </footer>
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

function SignatureField(props: { label: string }) {
  return (
    <div style={styles.signatureField}>
      <span>{props.label}</span>
      <div style={styles.signatureLine} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  screenPage: {
    minHeight: "100vh",
    padding: "20px 20px 48px",
    background: "#e9eef5",
    color: "#0f172a",
  },
  screenToolbar: {
    maxWidth: 1040,
    margin: "0 auto 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  toolbarKicker: {
    margin: "0 0 3px",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    color: "#2563eb",
  },
  toolbarActions: {
    display: "flex",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  primaryButton: {
    minHeight: 38,
    padding: "0 14px",
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "0 14px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },
  warningBox: {
    maxWidth: 1040,
    margin: "0 auto 16px",
    padding: 12,
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#92400e",
    fontSize: 12,
    fontWeight: 750,
  },
  errorBox: {
    maxWidth: 900,
    margin: "20px auto",
    padding: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
  },
  document: {
    width: "210mm",
    margin: "0 auto",
    fontFamily: '"Century Gothic", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
  },
  coverPage: {
    boxSizing: "border-box",
    width: "210mm",
    minHeight: "297mm",
    padding: "20mm 18mm",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    pageBreakAfter: "always",
    breakAfter: "page",
  },
  coverTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #0f4c6d",
    paddingBottom: "8mm",
  },
  brandWord: {
    fontFamily: '"Century Gothic", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 700,
    color: "#183f56",
    letterSpacing: "0.02em",
  },
  brandDescriptor: {
    fontSize: 9,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: "0.08em",
  },
  coverBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    maxWidth: "155mm",
    paddingTop: "42mm",
  },
  coverKicker: {
    margin: 0,
    fontFamily: '"Century Gothic", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.16em",
    color: "#64748b",
  },
  coverTitle: {
    margin: "5mm 0 4mm",
    fontFamily: '"Century Gothic", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    fontSize: 40,
    lineHeight: 1.05,
    fontWeight: 700,
    color: "#183f56",
  },
  coverRule: {
    width: "34mm",
    height: 2,
    background: "#183f56",
    marginBottom: "14mm",
  },
  coverDetails: {
    display: "grid",
    gap: "5mm",
  },
  coverDetailRow: {
    display: "grid",
    gridTemplateColumns: "45mm 1fr",
    gap: "7mm",
    fontSize: 12,
  },
  coverFooter: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "1px solid #cbd5e1",
    paddingTop: "5mm",
    fontSize: 9,
    color: "#64748b",
  },
  page: {
    boxSizing: "border-box",
    width: "210mm",
    minHeight: "297mm",
    padding: "14mm 16mm 12mm",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    pageBreakAfter: "always",
    breakAfter: "page",
  },
  legalTermsDocument: {
    boxSizing: "border-box",
    width: "210mm",
    padding: "14mm 16mm 12mm",
    background: "#ffffff",
    pageBreakAfter: "always",
    breakAfter: "page",
  },
  legalTermsContent: {
    paddingTop: "13mm",
    paddingBottom: "10mm",
  },
  legalClauseBlock: {
    marginBottom: "7mm",
    paddingBottom: "6mm",
    borderBottom: "1px solid #e2e8f0",
    breakInside: "avoid",
    pageBreakInside: "avoid",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    paddingBottom: "4mm",
    borderBottom: "1px solid #cbd5e1",
    fontSize: "8.5pt",
    color: "#64748b",
  },
  pageContent: {
    flex: 1,
    paddingTop: "13mm",
  },
  pageFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: "4mm",
    borderTop: "1px solid #cbd5e1",
    fontSize: "7.5pt",
    color: "#94a3b8",
  },
  sectionKicker: {
    margin: "0 0 3mm",
    fontFamily: '"Century Gothic", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    fontSize: "8.5pt",
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#64748b",
    textTransform: "uppercase",
  },
  sectionTitle: {
    margin: "0 0 7mm",
    fontFamily: '"Century Gothic", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    fontSize: "20pt",
    fontWeight: 700,
    color: "#244b63",
  },
  bodyText: {
    margin: "0 0 9mm",
    fontSize: "10.5pt",
    lineHeight: 1.7,
    color: "#475569",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    border: "1px solid #dbe3ef",
    marginBottom: "8mm",
  },
  summaryCell: {
    minHeight: "20mm",
    padding: "4mm",
    borderRight: "1px solid #dbe3ef",
    borderBottom: "1px solid #dbe3ef",
    display: "grid",
    gap: "2mm",
    fontSize: 10,
  },
  feeBox: {
    padding: "7mm",
    background: "#124a67",
    color: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10mm",
    marginBottom: "8mm",
  },
  feeLabel: {
    display: "block",
    fontSize: 9,
    letterSpacing: "0.08em",
  },
  feeAmount: {
    display: "block",
    margin: "2mm 0",
    fontSize: 25,
  },
  feeSubLabel: {
    fontSize: 9,
  },
  feeRight: {
    display: "grid",
    gap: "3mm",
    fontSize: 10,
  },
  billingStatement: {
    padding: "5mm",
    border: "1px solid #dbe3ef",
    background: "#f8fafc",
    fontSize: 10,
    lineHeight: 1.6,
    color: "#475569",
    marginBottom: "6mm",
  },
  specialTerms: {
    padding: "5mm",
    borderLeft: "3px solid #244b63",
    background: "#f8fafc",
    fontSize: 10,
    lineHeight: 1.6,
  },
  serviceCategory: {
    marginBottom: "7mm",
  },
  categoryTitle: {
    margin: "0 0 3mm",
    padding: "3mm 4mm",
    background: "#124a67",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase",
  },
  serviceItem: {
    padding: "4mm",
    borderBottom: "1px solid #dbe3ef",
  },
  serviceHeadingRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: "9.5pt",
  },
  includedBadge: {
    padding: "1.5mm 2.5mm",
    background: "#eef4f7",
    color: "#124a67",
    fontSize: 8,
    fontWeight: 900,
  },
  serviceDescription: {
    margin: "2mm 0 0",
    fontSize: "8.5pt",
    lineHeight: 1.5,
    color: "#64748b",
  },
  scopeBox: {
    marginTop: "3mm",
    padding: "3mm",
    display: "grid",
    gap: "1.5mm",
    background: "#f8fafc",
    fontSize: "8pt",
    color: "#475569",
  },
  billingHeader: {
    display: "grid",
    gridTemplateColumns: "8mm 1.3fr 28mm 30mm 25mm 25mm",
    gap: "2mm",
    minHeight: "10mm",
    alignItems: "center",
    padding: "0 2mm",
    background: "#eef2f7",
    borderBottom: "1px solid #cbd5e1",
    fontSize: "7.5pt",
    fontWeight: 900,
    textTransform: "uppercase",
  },
  billingRow: {
    display: "grid",
    gridTemplateColumns: "8mm 1.3fr 28mm 30mm 25mm 25mm",
    gap: "2mm",
    minHeight: "10mm",
    alignItems: "center",
    padding: "0 2mm",
    borderBottom: "1px solid #e2e8f0",
    fontSize: "8pt",
  },
  billingTotalRow: {
    display: "grid",
    gridTemplateColumns: "8mm 1.3fr 28mm 30mm 25mm 25mm",
    gap: "2mm",
    minHeight: "11mm",
    alignItems: "center",
    padding: "0 2mm",
    background: "#f8fafc",
    borderTop: "1px solid #94a3b8",
    fontSize: "8pt",
  },
  amountHeading: {
    textAlign: "right",
  },
  amount: {
    textAlign: "right",
  },
  legalClauseHeading: {
    display: "grid",
    gridTemplateColumns: "11mm 1fr",
    gap: "4mm",
    alignItems: "start",
    marginBottom: "3mm",
  },
  legalClauseNumber: {
    width: "9mm",
    height: "9mm",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#124a67",
    color: "#ffffff",
    fontSize: "8pt",
    fontWeight: 900,
  },
  legalCategory: {
    margin: "0 0 1mm",
    fontSize: "7.5pt",
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: "#64748b",
    textTransform: "uppercase",
  },
  legalTitle: {
    margin: 0,
    fontSize: "12pt",
    fontWeight: 700,
    color: "#244b63",
  },
  legalBody: {
    margin: 0,
    fontSize: "9.5pt",
    lineHeight: 1.55,
    color: "#374151",
    whiteSpace: "pre-wrap",
  },
  signatureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12mm 10mm",
    margin: "15mm 0 18mm",
  },
  signatureField: {
    display: "grid",
    gap: "7mm",
    fontSize: 9,
    color: "#64748b",
  },
  signatureLine: {
    borderBottom: "1px solid #475569",
    minHeight: "7mm",
  },
  practitionerBox: {
    padding: "7mm",
    background: "#124a67",
    color: "#ffffff",
    display: "grid",
    gap: "1.5mm",
    textAlign: "center",
    fontSize: 9,
  },
  templateVersion: {
    marginTop: "5mm",
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
  },
};

