import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Proposal = {
  id: string;
  proposal_number: string;
  client_name: string;
  contact_name: string | null;
  contact_email: string | null;
  prospect_company_name: string | null;
  prospect_contact_name: string | null;
  prospect_contact_email: string | null;
  prospect_contact_number: string | null;
  proposal_date: string;
  valid_until: string;
  package_name: string | null;
  package_description: string | null;
  package_monthly_fee: number;
  fee_is_exclusive_vat: boolean;
};

type ProposalService = {
  id: string;
  category: string;
  service_name: string;
  description: string | null;
  included_in_package: boolean;
  scope_quantity: number | null;
  scope_unit: string | null;
  client_facing_note: string | null;
  sort_order: number;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function formatDate(value: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getScopeText(service: ProposalService) {
  const quantity =
    service.scope_quantity === null ||
    service.scope_quantity === undefined ||
    Number(service.scope_quantity) === 0
      ? ""
      : Number(service.scope_quantity).toLocaleString("en-ZA");

  const unit = String(service.scope_unit || "").trim();

  if (!quantity && !unit) return "";
  if (!quantity) return unit;
  if (!unit) return quantity;

  return `${quantity} ${unit}`;
}

export default async function ProposalExportPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select(`
      id,
      proposal_number,
      client_name,
      contact_name,
      contact_email,
      prospect_company_name,
      prospect_contact_name,
      prospect_contact_email,
      prospect_contact_number,
      proposal_date,
      valid_until,
      package_name,
      package_description,
      package_monthly_fee,
      fee_is_exclusive_vat
    `)
    .eq("id", id)
    .single();

  if (proposalError || !proposalData) {
    notFound();
  }

  const { data: servicesData, error: servicesError } = await supabase
    .from("proposal_services")
    .select(`
      id,
      category,
      service_name,
      description,
      included_in_package,
      scope_quantity,
      scope_unit,
      client_facing_note,
      sort_order
    `)
    .eq("proposal_id", id)
    .order("sort_order", { ascending: true });

  if (servicesError) {
    throw servicesError;
  }

  const proposal = proposalData as Proposal;
  const services = (servicesData || []) as ProposalService[];

  const companyName =
    proposal.prospect_company_name || proposal.client_name || "Prospective Client";
  const contactName =
    proposal.prospect_contact_name || proposal.contact_name || "";
  const contactEmail =
    proposal.prospect_contact_email || proposal.contact_email || "";
  const contactNumber = proposal.prospect_contact_number || "";

  const monthlyFee = Number(proposal.package_monthly_fee || 0);
  const vatAmount = monthlyFee * 0.15;
  const totalIncludingVat = monthlyFee + vatAmount;

  const groupedServices = services.reduce<Record<string, ProposalService[]>>(
    (groups, service) => {
      const category = service.category || "Other Services";
      groups[category] = groups[category] || [];
      groups[category].push(service);
      return groups;
    },
    {}
  );

  return (
    <>
      <title>{`Proposal ${proposal.proposal_number} - ${companyName}`}</title>

      <main style={styles.document}>
        <section
          style={{
            ...styles.page,
            ...styles.coverImagePage,
            backgroundImage: "url('/proposals/client-proposal-cover.png')",
          }}
        >
          <div style={styles.coverPreparedFor}>
            <strong>{companyName}</strong>
            {contactName ? <span>{contactName}</span> : null}
          </div>

          <div style={styles.coverPreparedBy}>
            <strong>Ferdi van Aswegen</strong>
            <span>Professional Accountant (SA)</span>
          </div>

          <div style={styles.coverDate}>
            <strong>{formatDate(proposal.proposal_date)}</strong>
            <span>Proposal #{proposal.proposal_number}</span>
          </div>
        </section>

        <section style={styles.page}>
          <header style={styles.pageHeader}>
            <div style={styles.pageHeaderIdentity}>
              <strong>{proposal.proposal_number}</strong>
              <span>{companyName}</span>
            </div>
            <span>Bizzacc Menlyn (Pty) Ltd</span>
          </header>

          <div style={styles.pageContent}>
            <p style={styles.sectionKicker}>WELCOME</p>
            <h2 style={styles.sectionTitle}>Your accounting proposal</h2>

            <p style={styles.introText}>
              Thank you for the opportunity to present our proposal to {companyName}.
              The purpose of this proposal is to provide a clear and practical
              accounting, payroll, tax and compliance solution tailored to the
              current needs of the business.
            </p>

            <p style={styles.introText}>
              We aim to take responsibility for the agreed financial administration
              and statutory compliance functions, while ensuring that management has
              reliable financial information and a responsive accounting partner.
            </p>

            <div style={styles.summaryPanel}>
              <div>
                <span style={styles.summaryLabel}>Package</span>
                <strong style={styles.summaryValue}>
                  {proposal.package_name || "Custom Package"}
                </strong>
              </div>

              <div>
                <span style={styles.summaryLabel}>Proposal date</span>
                <strong style={styles.summaryValue}>
                  {formatDate(proposal.proposal_date)}
                </strong>
              </div>

              <div>
                <span style={styles.summaryLabel}>Valid until</span>
                <strong style={styles.summaryValue}>
                  {formatDate(proposal.valid_until)}
                </strong>
              </div>
            </div>

            {proposal.package_description ? (
              <p style={styles.packageDescription}>
                {proposal.package_description}
              </p>
            ) : null}

            <div style={styles.feePanel}>
              <div>
                <span style={styles.feeLabel}>Monthly professional fee</span>
                <strong style={styles.feeMain}>{formatMoney(monthlyFee)}</strong>
                <span style={styles.feeSub}>
                  {proposal.fee_is_exclusive_vat
                    ? "Excluding VAT"
                    : "Including VAT"}
                </span>
              </div>

              <div style={styles.feeBreakdown}>
                <span>
                  VAT <strong>{formatMoney(vatAmount)}</strong>
                </span>
                <span>
                  Monthly total including VAT{" "}
                  <strong>{formatMoney(totalIncludingVat)}</strong>
                </span>
              </div>
            </div>

            <div style={styles.noteBox}>
              The monthly fee covers the services specifically listed in this
              proposal. CIPC statutory fees, Compensation Fund assessment amounts,
              and penalties or interest imposed by SARS, CIPC or the Department of
              Employment and Labour are excluded. Formal SARS audits, objections,
              disputes and work outside the agreed scope will be quoted separately
              before work commences.
            </div>
          </div>

          <footer style={styles.pageFooter}>
            <span>Bizzacc Menlyn (Pty) Ltd · www.bizzacc.co.za</span>
            <span>Proposal #{proposal.proposal_number}</span>
          </footer>
        </section>

        <section style={styles.page}>
          <header style={styles.pageHeader}>
            <div style={styles.pageHeaderIdentity}>
              <strong>{proposal.proposal_number}</strong>
              <span>{companyName}</span>
            </div>
            <span>Services included</span>
          </header>

          <div style={styles.pageContent}>
            <p style={styles.sectionKicker}>SCOPE OF SERVICES</p>
            <h2 style={styles.sectionTitle}>What is included</h2>

            {Object.entries(groupedServices).map(([category, categoryServices]) => (
              <section key={category} style={styles.serviceCategory}>
                <h3 style={styles.categoryTitle}>{category}</h3>

                {categoryServices.map((service) => {
                  const scopeText = getScopeText(service);

                  return (
                    <article key={service.id} style={styles.serviceItem}>
                      <div style={styles.serviceHeadingRow}>
                        <strong style={styles.serviceName}>
                          {service.service_name}
                        </strong>
                        <span style={styles.includedBadge}>INCLUDED</span>
                      </div>

                      {service.description ? (
                        <p style={styles.serviceDescription}>
                          {service.description}
                        </p>
                      ) : null}

                      {scopeText || service.client_facing_note ? (
                        <div style={styles.scopeNote}>
                          {scopeText ? (
                            <span>
                              <strong>Scope:</strong> {scopeText}
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
            ))}
          </div>

          <footer style={styles.pageFooter}>
            <span>Bizzacc Menlyn (Pty) Ltd · www.bizzacc.co.za</span>
            <span>Proposal #{proposal.proposal_number}</span>
          </footer>
        </section>

        <section style={styles.page}>
          <header style={styles.pageHeader}>
            <div style={styles.pageHeaderIdentity}>
              <strong>{proposal.proposal_number}</strong>
              <span>{companyName}</span>
            </div>
            <span>Next steps</span>
          </header>

          <div style={styles.pageContent}>
            <p style={styles.sectionKicker}>MOVING FORWARD</p>
            <h2 style={styles.sectionTitle}>What happens next?</h2>

            <div style={styles.steps}>
              <div style={styles.step}>
                <span style={styles.stepNumber}>1</span>
                <div>
                  <strong>Review the proposal</strong>
                  <p>
                    Please review the package, scope and monthly professional fee.
                  </p>
                </div>
              </div>

              <div style={styles.step}>
                <span style={styles.stepNumber}>2</span>
                <div>
                  <strong>Confirm acceptance</strong>
                  <p>
                    Confirm that you would like Bizzacc to proceed with the proposed
                    services.
                  </p>
                </div>
              </div>

              <div style={styles.step}>
                <span style={styles.stepNumber}>3</span>
                <div>
                  <strong>Complete the engagement process</strong>
                  <p>
                    We will issue the formal engagement letter and request the
                    information required to commence the assignment.
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.acceptanceBox}>
              <h3>Proposal acceptance</h3>
              <p>
                I confirm that I have reviewed this proposal and accept the package,
                scope of services and professional fee outlined above.
              </p>

              <div style={styles.signatureGrid}>
                <div>
                  <span>Name</span>
                  <div style={styles.signatureLine} />
                </div>

                <div>
                  <span>Capacity</span>
                  <div style={styles.signatureLine} />
                </div>

                <div>
                  <span>Signature</span>
                  <div style={styles.signatureLine} />
                </div>

                <div>
                  <span>Date</span>
                  <div style={styles.signatureLine} />
                </div>
              </div>
            </div>

            <div style={styles.contactBox}>
              <strong>Ferdi van Aswegen</strong>
              <span>Professional Accountant (SA) · SAIPA 28289</span>
              <span>ferdi_v@bizzacc.co.za · 012 881 6388</span>
            </div>
          </div>

          <footer style={styles.pageFooter}>
            <span>Bizzacc Menlyn (Pty) Ltd · www.bizzacc.co.za</span>
            <span>Proposal #{proposal.proposal_number}</span>
          </footer>
        </section>
      </main>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  document: {
    margin: 0,
    padding: 0,
    background: "#ffffff",
    fontFamily:
      '"Century Gothic", "Avenir Next", Avenir, Arial, Helvetica, sans-serif',
    color: "#1f2937",
  },
  page: {
    position: "relative",
    width: "210mm",
    minHeight: "297mm",
    backgroundColor: "#ffffff",
    margin: "0 auto",
    background: "#ffffff",
    boxSizing: "border-box",
    breakAfter: "page",
    pageBreakAfter: "always",
    overflow: "visible",
  },
  coverImagePage: {
    backgroundSize: "100% 100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  coverPreparedFor: {
    position: "absolute",
    left: "108mm",
    top: "181mm",
    width: "82mm",
    display: "grid",
    gap: "1mm",
    color: "#0b4d73",
    fontSize: 10,
    lineHeight: 1.35,
  },
  coverPreparedBy: {
    position: "absolute",
    left: "108mm",
    top: "214mm",
    width: "82mm",
    display: "grid",
    gap: "1mm",
    color: "#0b4d73",
    fontSize: 10,
    lineHeight: 1.35,
  },
  coverDate: {
    position: "absolute",
    left: "108mm",
    top: "247mm",
    width: "82mm",
    display: "grid",
    gap: "1mm",
    color: "#0b4d73",
    fontSize: 10,
    lineHeight: 1.35,
  },
  pageHeaderIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "3mm",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: "16mm",
    padding: "0 16mm",
    borderBottom: "1px solid #dbe2e8",
    color: "#64748b",
    fontSize: 8,
  },
  pageContent: {
    padding: "16mm",
  },
  sectionKicker: {
    margin: 0,
    color: "#4b6f84",
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  sectionTitle: {
    margin: "3mm 0 8mm",
    paddingBottom: "4mm",
    borderBottom: "1px solid #123e5a",
    color: "#123e5a",
    fontSize: 22,
    lineHeight: 1.1,
  },
  introText: {
    margin: "0 0 5mm",
    fontSize: 11,
    lineHeight: 1.65,
    color: "#475569",
  },
  summaryPanel: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr 1fr",
    gap: 0,
    margin: "9mm 0 6mm",
    border: "1px solid #dbe2e8",
  },
  summaryLabel: {
    display: "block",
    padding: "3mm 4mm 0",
    color: "#64748b",
    fontSize: 8,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  summaryValue: {
    display: "block",
    padding: "1.5mm 4mm 4mm",
    color: "#1f2937",
    fontSize: 10,
  },
  packageDescription: {
    margin: "0 0 7mm",
    padding: "4mm 5mm",
    background: "#f4f7f9",
    borderLeft: "3px solid #4d9ac4",
    fontSize: 10,
    lineHeight: 1.55,
  },
  feePanel: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: "8mm",
    alignItems: "center",
    padding: "7mm",
    background: "#123e5a",
    color: "#ffffff",
  },
  feeLabel: {
    display: "block",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  feeMain: {
    display: "block",
    marginTop: "2mm",
    fontSize: 25,
  },
  feeSub: {
    display: "block",
    marginTop: 2,
    color: "#cbd5e1",
    fontSize: 9,
  },
  feeBreakdown: {
    display: "grid",
    gap: "3mm",
    fontSize: 10,
  },
  noteBox: {
    marginTop: "7mm",
    padding: "5mm",
    border: "1px solid #dbe2e8",
    background: "#fafcfd",
    color: "#64748b",
    fontSize: 9,
    lineHeight: 1.55,
  },
  serviceCategory: {
    marginBottom: "7mm",
  },
  categoryTitle: {
    margin: "0 0 3mm",
    padding: "2.5mm 3mm",
    background: "#123e5a",
    color: "#ffffff",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  serviceItem: {
    padding: "4mm 3mm",
    borderBottom: "1px solid #e2e8f0",
    breakInside: "avoid",
    pageBreakInside: "avoid",
  },
  serviceHeadingRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "5mm",
    alignItems: "center",
  },
  serviceName: {
    color: "#1f2937",
    fontSize: 11,
  },
  includedBadge: {
    flex: "0 0 auto",
    padding: "1.2mm 2.2mm",
    background: "#e8f2f8",
    color: "#123e5a",
    fontSize: 7,
    fontWeight: 900,
  },
  serviceDescription: {
    margin: "2mm 0 0",
    color: "#475569",
    fontSize: 9,
    lineHeight: 1.5,
  },
  scopeNote: {
    display: "grid",
    gap: 2,
    marginTop: "2mm",
    padding: "2.5mm 3mm",
    background: "#f7f9fa",
    color: "#475569",
    fontSize: 8,
    lineHeight: 1.45,
  },
  steps: {
    display: "grid",
    gap: "6mm",
    marginTop: "10mm",
  },
  step: {
    display: "grid",
    gridTemplateColumns: "12mm 1fr",
    gap: "4mm",
    alignItems: "start",
    paddingBottom: "5mm",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 10,
  },
  stepNumber: {
    display: "inline-flex",
    width: "10mm",
    height: "10mm",
    alignItems: "center",
    justifyContent: "center",
    background: "#123e5a",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 900,
  },
  acceptanceBox: {
    marginTop: "12mm",
    padding: "6mm",
    border: "1px solid #9aa9b5",
    fontSize: 10,
  },
  signatureGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8mm 10mm",
    marginTop: "9mm",
    color: "#64748b",
    fontSize: 8,
  },
  signatureLine: {
    height: "10mm",
    borderBottom: "1px solid #475569",
  },
  contactBox: {
    display: "grid",
    gap: 2,
    marginTop: "10mm",
    padding: "5mm",
    background: "#123e5a",
    color: "#ffffff",
    textAlign: "center",
    fontSize: 9,
  },
  pageFooter: {
    position: "absolute",
    left: "16mm",
    right: "16mm",
    bottom: "7mm",
    display: "flex",
    justifyContent: "space-between",
    paddingTop: "3mm",
    borderTop: "1px solid #dbe2e8",
    color: "#64748b",
    fontSize: 7,
  },
};
