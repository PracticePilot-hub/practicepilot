"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Engagement = {
  id: string;
  engagement_number: string;
  client_name: string;
  client_registration_number: string | null;
  contract_start_date: string;
};

type Handover = {
  id: string;
  previous_practice: string | null;
  previous_accountant_name: string | null;
  previous_accountant_email: string | null;
  takeover_date: string | null;
  document_date: string | null;
  notes: string | null;
  status: "Draft" | "Finalised";
};

type PracticeSettings = {
  firm_name: string | null;
  trading_name: string | null;
  logo_url: string | null;
  address_lines: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  authorised_signatory_name: string | null;
  authorised_signatory_professional_designation: string | null;
  authorised_signatory_registration_number: string | null;
  authorised_signatory_position: string | null;
  authorised_signatory_signature_url: string | null;
  governing_body_name: string | null;
  governing_body_logo_url: string | null;
  second_governing_body_name: string | null;
  second_governing_body_logo_url: string | null;
  footer_text: string | null;
  footer_logo_url: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={styles.bulletList}>
      {items.map((item) => (
        <li key={item} style={styles.bulletItem}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Letterhead({
  settings,
  organisationName,
}: {
  settings: PracticeSettings | null;
  organisationName: string;
}) {
  const practiceName =
    settings?.trading_name ||
    settings?.firm_name ||
    organisationName ||
    "Practice";

  const addressLines = String(settings?.address_lines || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <header style={styles.letterhead}>
      <div style={styles.letterheadTop}>
        <div style={styles.logoArea}>
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={practiceName} style={styles.practiceLogo} />
          ) : (
            <strong>{practiceName}</strong>
          )}
        </div>

        <div style={styles.practiceContact}>
          <strong>{practiceName}</strong>
          {addressLines.map((line) => <span key={line}>{line}</span>)}
          {settings?.telephone ? <span>Tel: {settings.telephone}</span> : null}
          {settings?.email ? <span>Email: {settings.email}</span> : null}
          {settings?.website ? <span>{settings.website}</span> : null}
        </div>
      </div>

      <div style={styles.headerRule} />
    </header>
  );
}

function LetterFooter({
  settings,
  organisationName,
}: {
  settings: PracticeSettings | null;
  organisationName: string;
}) {
  const practiceName =
    settings?.firm_name ||
    settings?.trading_name ||
    organisationName ||
    "Practice";

  const professionalLine = [
    settings?.authorised_signatory_professional_designation,
    settings?.authorised_signatory_registration_number,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <footer style={styles.footer}>
      <div style={styles.footerRule} />

      <div style={styles.footerMain}>
        <div style={styles.footerIdentity}>
          {settings?.authorised_signatory_name ? (
            <strong>{settings.authorised_signatory_name}</strong>
          ) : null}
          {professionalLine ? <span>{professionalLine}</span> : null}
          <span>{practiceName}</span>
        </div>

        <div style={styles.footerLogos}>
          {settings?.governing_body_logo_url ? (
            <img
              src={settings.governing_body_logo_url}
              alt={settings.governing_body_name || "Professional body"}
              style={styles.bodyLogo}
            />
          ) : null}

          {settings?.second_governing_body_logo_url ? (
            <img
              src={settings.second_governing_body_logo_url}
              alt={settings.second_governing_body_name || "Professional body"}
              style={styles.bodyLogo}
            />
          ) : null}
        </div>
      </div>
    </footer>
  );
}

function A4Page({
  settings,
  organisationName,
  children,
}: {
  settings: PracticeSettings | null;
  organisationName: string;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.pageSheet}>
      <Letterhead settings={settings} organisationName={organisationName} />
      <div style={styles.pageBody}>{children}</div>
      <LetterFooter settings={settings} organisationName={organisationName} />
    </section>
  );
}

export default function HandoverLetterPage() {
  const params = useParams<{ id: string }>();
  const engagementId = String(params?.id || "");

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [organisationName, setOrganisationName] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function authToken() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error("Your login session could not be confirmed.");
    }

    return session.access_token;
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const token = await authToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [engagementResponse, handoverResponse, settingsResponse] =
          await Promise.all([
            fetch(`/api/engagements/${engagementId}`, {
              cache: "no-store",
              headers,
            }),
            fetch(`/api/engagements/${engagementId}/handover-letter`, {
              cache: "no-store",
              headers,
            }),
            fetch("/api/settings/practice", {
              cache: "no-store",
              headers,
            }),
          ]);

        const engagementResult = await engagementResponse.json();
        const handoverResult = await handoverResponse.json();
        const settingsResult = await settingsResponse.json();

        if (!engagementResponse.ok || !engagementResult?.success) {
          throw new Error(
            engagementResult?.error || "Unable to load engagement."
          );
        }

        if (!handoverResponse.ok || !handoverResult?.success) {
          throw new Error(
            handoverResult?.error || "Unable to load handover letter."
          );
        }

        if (!handoverResult.handover) {
          throw new Error("No saved handover letter draft exists yet.");
        }

        if (!settingsResponse.ok) {
          throw new Error(
            settingsResult?.error || "Unable to load practice letterhead."
          );
        }

        setEngagement(engagementResult.engagement as Engagement);
        setHandover(handoverResult.handover as Handover);
        setSettings((settingsResult.settings || null) as PracticeSettings | null);
        setOrganisationName(settingsResult.organisation?.name || "");
      } catch (loadError: any) {
        setError(loadError?.message || "Unable to load handover letter.");
      } finally {
        setLoading(false);
      }
    }

    if (engagementId) void load();
  }, [engagementId]);

  async function downloadPdf() {
    try {
      setDownloading(true);
      setError("");

      const token = await authToken();

      const response = await fetch(
        `/api/engagements/${engagementId}/handover-letter/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Unable to generate handover PDF.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename =
        match?.[1] ||
        `${engagement?.client_name || "Client"} - Handover Letter.pdf`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError: any) {
      setError(downloadError?.message || "Unable to generate handover PDF.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <main style={styles.screen}>Loading handover letter...</main>;
  }

  if (!engagement || !handover) {
    return (
      <main style={styles.screen}>
        <div style={styles.errorBox}>{error || "Handover letter not found."}</div>
      </main>
    );
  }

  const clientHeading = engagement.client_registration_number
    ? `${engagement.client_name} - Registration No. ${engagement.client_registration_number}`
    : engagement.client_name;

  const signatoryName =
    settings?.authorised_signatory_name || "Authorised signatory";

  const practiceName =
    settings?.firm_name ||
    settings?.trading_name ||
    organisationName ||
    "";

  return (
    <main style={styles.screen}>
      <div style={styles.screenActions}>
        <div style={styles.draftBadge}>{handover.status.toUpperCase()}</div>

        <div style={styles.actionButtons}>
          <Link href={`/engagements/${engagement.id}`} style={styles.secondaryButton}>
            Back to Engagement
          </Link>

          <button
            type="button"
            onClick={() => void downloadPdf()}
            style={styles.primaryButton}
            disabled={downloading}
          >
            {downloading ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>
      </div>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <A4Page settings={settings} organisationName={organisationName}>
        <div style={styles.date}>{formatDate(handover.document_date)}</div>

        <div style={styles.recipient}>
          <strong>{handover.previous_practice}</strong>
          <div>
            Att: {handover.previous_accountant_name || "To whom it may concern"}
          </div>
          {handover.previous_accountant_email ? (
            <div>Per Email: {handover.previous_accountant_email}</div>
          ) : null}
        </div>

        <p style={styles.subject}>
          <strong>RE: {clientHeading.toUpperCase()}</strong>
        </p>

        <div style={styles.introBlock}>
          <p>
            We have been appointed by the above-mentioned client to attend to
            their accounting, taxation and related compliance affairs as from{" "}
            <strong style={styles.noWrap}>
              {formatDate(handover.takeover_date)}
            </strong>.
          </p>

          <p>
            We understand that your firm currently acts as accountant and/or tax
            practitioner for the client.
          </p>

          <p>
            As part of our professional acceptance procedures, kindly advise
            whether you are aware of any reason, professional or otherwise, why
            we should not accept this appointment.
          </p>

          <p>
            Subject to there being no such reason, we would appreciate your
            assistance with the orderly handover of the client&apos;s accounting
            and statutory records.
          </p>

          <p>
            Kindly provide the following information and documentation, where
            applicable:
          </p>
        </div>

        <h3 style={styles.sectionTitle}>
          1. Annual Financial Statements and Accounting Records
        </h3>
        <BulletList
          items={[
            "Signed annual financial statements for the latest available financial years.",
            "Final trial balances relating to those financial statements.",
            "Latest available management accounts.",
            "Current-year trial balance up to the date of handover.",
            "Detailed general ledger for the current financial year.",
            "Profit and Loss and Balance Sheet reports up to the date of handover.",
            "Complete accounting data and/or access to the accounting system.",
            "Bank reconciliations up to the latest completed period.",
            "Debtors age analysis.",
            "Creditors age analysis.",
            "Fixed asset register and supporting depreciation schedules.",
            "Loan account reconciliations and supporting schedules.",
            "Any other balance sheet reconciliations or working papers required to support the accounting records.",
          ]}
        />

        <h3 style={styles.sectionTitle}>2. Income Tax</h3>
        <BulletList
          items={[
            "Copies of income tax returns submitted for the latest available years of assessment.",
            "Income tax calculations and supporting schedules.",
            "Provisional tax calculations and submissions.",
            "SARS assessments and statements of account.",
            "Details of any assessed losses, capital losses or other tax balances carried forward.",
            "Details of any outstanding income tax returns, objections, disputes, audits or verification matters.",
            "Copies of relevant SARS correspondence.",
          ]}
        />

              </A4Page>

      <A4Page settings={settings} organisationName={organisationName}>
<h3 style={styles.sectionTitle}>3. Value-Added Tax</h3>
        <p style={styles.tightParagraph}>Where the client is registered for VAT:</p>
        <BulletList
          items={[
            "Copies of VAT201 returns for the current financial year and latest completed financial year.",
            "VAT reconciliations.",
            "VAT control account reconciliations.",
            "SARS VAT statements of account.",
            "Details of any outstanding returns, verifications, audits or disputes.",
            "Supporting schedules relevant to any unusual or significant VAT matters.",
          ]}
        />
        <h3 style={styles.sectionTitle}>
          4. Payroll, PAYE and Employees&apos; Tax
        </h3>
        <p style={styles.tightParagraph}>Where applicable:</p>
        <BulletList
          items={[
            "EMP201 returns for the current financial year.",
            "EMP501 reconciliations for the latest completed reconciliation periods.",
            "IRP5/IT3(a) certificates.",
            "Payroll reports up to the date of handover.",
            "Employee payslips where required.",
            "PAYE, UIF and SDL reconciliations.",
            "Details of any outstanding payroll submissions or SARS queries.",
            "Copies of relevant SARS correspondence.",
          ]}
        />

        <h3 style={styles.sectionTitle}>5. SARS Registration Information</h3>
        <p style={styles.tightParagraph}>
          Kindly confirm and/or provide the client&apos;s relevant registration
          numbers, including:
        </p>
        <BulletList
          items={[
            "Income Tax number.",
            "VAT number.",
            "PAYE number.",
            "Customs or other SARS registrations, where applicable.",
          ]}
        />

        <p>
          We will arrange for the transfer of the relevant SARS eFiling tax
          types upon instruction and authorisation from the client.
        </p>

        <h3 style={styles.sectionTitle}>
          6. Department of Employment and Labour
        </h3>
        <p style={styles.tightParagraph}>Where applicable, kindly provide:</p>
        <BulletList
          items={[
            "UIF registration number.",
            "Compensation Fund / COIDA registration number.",
            "Latest Return of Earnings information.",
            "Letter of Good Standing, if available.",
            "Details of any outstanding submissions, assessments or correspondence.",
          ]}
        />

              </A4Page>

      <A4Page settings={settings} organisationName={organisationName}>
<h3 style={styles.sectionTitle}>7. CIPC and Entity Statutory Records</h3>
        <p style={styles.tightParagraph}>
          Where applicable to the entity type, kindly provide:
        </p>
        <BulletList
          items={[
            "Company or close corporation registration documents.",
            "Memorandum of Incorporation, founding statement or CK documents, as applicable.",
            "Securities / share register and share certificates, or members' interest records, as applicable.",
            "Current shareholder or member information.",
            "Current director or member information.",
            "Beneficial ownership records and supporting documentation.",
            "Copies of annual return submissions.",
            "CIPC disclosure certificates, company extracts or close corporation extracts.",
            "Copies of relevant resolutions, minutes or member decisions.",
            "Details of any outstanding CIPC filings or compliance matters.",
          ]}
        />

        <p style={styles.pageEndParagraph}>
          Where original statutory documents are held by your firm, please advise
          and we will arrange collection at a mutually convenient time.
        </p>

        <h3 style={styles.sectionTitle}>8. Other Relevant Information</h3>
        <p style={styles.tightParagraph}>Please also provide:</p>

        <BulletList
          items={[
            "Details of any material matters currently under discussion with the client.",
            "Details of any outstanding work or submissions.",
            "Copies of relevant correspondence with SARS, CIPC, the Department of Employment and Labour or other regulatory authorities.",
            "Any schedules, calculations, working papers or supporting documentation which may assist with the continuity of the client's accounting and compliance affairs.",
          ]}
        />

        <p>
          Should any of the above information not be available or not be
          applicable to the client, kindly advise us accordingly.
        </p>

        <p>
          We appreciate your assistance in ensuring an efficient and professional
          handover.
        </p>

        <p>
          Please do not hesitate to contact us should you require any further
          information or authorisation from the client.
        </p>

        {handover.notes ? <p>{handover.notes}</p> : null}

        <div style={styles.closing}>
          <p>Kind regards</p>
          <div style={styles.signatureLine} />
          <strong>{signatoryName}</strong>
          {practiceName ? <span>{practiceName}</span> : null}
        </div>
      </A4Page>

    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  screen: {
    minHeight: "100vh",
    background: "#eaf0f7",
    padding: "24px 0 40px",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  screenActions: {
    width: "210mm",
    maxWidth: "calc(100vw - 32px)",
    margin: "0 auto 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  actionButtons: {
    display: "flex",
    gap: 10,
  },
  draftBadge: {
    padding: "6px 9px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
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
    minHeight: 36,
    padding: "0 12px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },
  pageSheet: {
    position: "relative",
    width: "210mm",
    height: "297mm",
    maxWidth: "calc(100vw - 32px)",
    margin: "0 auto 18px",
    background: "#ffffff",
    boxSizing: "border-box",
    padding: "16mm 14mm 23mm",
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.12)",
    fontSize: 10.2,
    lineHeight: 1.32,
  },
  letterhead: { marginBottom: 14 },
  letterheadTop: {
    minHeight: 72,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
  },
  logoArea: { minWidth: 250 },
  practiceLogo: {
    display: "block",
    maxWidth: 245,
    maxHeight: 76,
    objectFit: "contain",
    objectPosition: "left top",
  },
  practiceContact: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    textAlign: "right",
    fontSize: 9.5,
    lineHeight: 1.45,
  },
  headerRule: {
    height: 1,
    background: "#0f172a",
    marginTop: 10,
  },
  pageBody: { paddingBottom: 64 },
  date: { marginBottom: 16 },
  recipient: {
    marginBottom: 14,
    lineHeight: 1.4,
  },
  subject: { margin: "14px 0" },
  introBlock: {
    display: "grid",
    gap: 6,
  },
  noWrap: { whiteSpace: "nowrap" },
  sectionTitle: {
    margin: "9px 0 3px",
    fontSize: 10.7,
    lineHeight: 1.25,
    fontWeight: 900,
  },
  tightParagraph: { margin: "0 0 2px" },
  bulletList: {
    margin: "3px 0 8px",
    paddingLeft: 22,
    listStyleType: "disc",
    listStylePosition: "outside",
  },
  bulletItem: { marginBottom: 2 },
  pageEndParagraph: {
    marginTop: 10,
    marginBottom: 0,
  },
  closing: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    marginTop: 20,
  },
  signatureLine: {
    width: 175,
    borderBottom: "1px solid #0f172a",
    margin: "28px 0 4px",
  },
  footer: {
    position: "absolute",
    left: "14mm",
    right: "14mm",
    bottom: "8mm",
  },
  footerRule: {
    height: 1,
    background: "#0f172a",
    marginBottom: 7,
  },
  footerMain: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-end",
  },
  footerIdentity: {
    display: "flex",
    flexDirection: "column",
    fontSize: 8.5,
    lineHeight: 1.35,
  },
  footerLogos: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  bodyLogo: {
    maxWidth: 65,
    maxHeight: 32,
    objectFit: "contain",
  },
  errorBox: {
    width: "210mm",
    maxWidth: "calc(100vw - 32px)",
    margin: "0 auto 12px",
    padding: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 750,
  },
};
