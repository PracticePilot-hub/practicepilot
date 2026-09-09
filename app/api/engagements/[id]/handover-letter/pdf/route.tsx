import { existsSync } from "fs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  "https://github.com/Sparticuz/chromium/releases/download/v141.0.0/chromium-v141.0.0-pack.x64.tar";

let cachedExecutablePath: string | null = null;
let chromiumDownloadPromise: Promise<string> | null = null;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing Supabase service role key.");

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function safeFilename(value: string) {
  return String(value || "Handover Letter")
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function getLocalChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const paths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  ];

  return paths.find((candidate) => existsSync(candidate)) || null;
}

async function getVercelChromiumPath() {
  if (cachedExecutablePath) return cachedExecutablePath;

  if (!chromiumDownloadPromise) {
    chromiumDownloadPromise = import("@sparticuz/chromium-min")
      .then((module) => module.default.executablePath(CHROMIUM_PACK_URL))
      .then((path) => {
        cachedExecutablePath = path;
        return path;
      })
      .catch((error) => {
        chromiumDownloadPromise = null;
        throw error;
      });
  }

  return chromiumDownloadPromise;
}

function bullets(items: string[]) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function letterhead(settings: any, organisationName: string) {
  const practiceName =
    settings?.trading_name ||
    settings?.firm_name ||
    organisationName ||
    "Practice";

  const addressLines = String(settings?.address_lines || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return `
    <header class="letterhead">
      <div class="letterhead-top">
        <div class="logo-area">
          ${
            settings?.logo_url
              ? `<img class="practice-logo" src="${escapeHtml(settings.logo_url)}" alt="">`
              : `<strong class="practice-name">${escapeHtml(practiceName)}</strong>`
          }
        </div>

        <div class="practice-contact">
          <strong>${escapeHtml(practiceName)}</strong>
          ${addressLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
          ${settings?.telephone ? `<span>Tel: ${escapeHtml(settings.telephone)}</span>` : ""}
          ${settings?.email ? `<span>Email: ${escapeHtml(settings.email)}</span>` : ""}
          ${settings?.website ? `<span>${escapeHtml(settings.website)}</span>` : ""}
        </div>
      </div>
      <div class="rule"></div>
    </header>
  `;
}

function footer(settings: any, organisationName: string) {
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

  return `
    <footer class="footer">
      <div class="rule"></div>
      <div class="footer-main">
        <div class="footer-identity">
          ${settings?.authorised_signatory_name ? `<strong>${escapeHtml(settings.authorised_signatory_name)}</strong>` : ""}
          ${professionalLine ? `<span>${escapeHtml(professionalLine)}</span>` : ""}
          <span>${escapeHtml(practiceName)}</span>
        </div>

        <div class="footer-logos">
          ${
            settings?.governing_body_logo_url
              ? `<img src="${escapeHtml(settings.governing_body_logo_url)}" alt="">`
              : ""
          }
          ${
            settings?.second_governing_body_logo_url
              ? `<img src="${escapeHtml(settings.second_governing_body_logo_url)}" alt="">`
              : ""
          }
        </div>
      </div>
    </footer>
  `;
}

function pageShell(
  settings: any,
  organisationName: string,
  body: string,
  last = false
) {
  return `
    <section class="page ${last ? "last-page" : ""}">
      ${letterhead(settings, organisationName)}
      <main class="page-body">${body}</main>
      ${footer(settings, organisationName)}
    </section>
  `;
}

export async function GET(request: Request, context: any) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const params = await context.params;
    const engagementId = String(params?.id || "");
    const supabase = adminClient();

    const token = bearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id,role,organisation_id,access_enabled")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile || !profile.access_enabled) {
      return NextResponse.json(
        { error: "Profile access denied." },
        { status: 403 }
      );
    }

    const { data: engagement, error: engagementError } = await supabase
      .from("engagements")
      .select(`
        id,
        organisation_id,
        client_name,
        client_registration_number,
        contract_start_date
      `)
      .eq("id", engagementId)
      .single();

    if (engagementError || !engagement) {
      return NextResponse.json(
        { error: "Engagement not found." },
        { status: 404 }
      );
    }

    if (
      !isGlobalAdmin(profile.role) &&
      profile.organisation_id !== engagement.organisation_id
    ) {
      return NextResponse.json(
        { error: "You do not have access to this engagement." },
        { status: 403 }
      );
    }

    const [{ data: handover, error: handoverError }, { data: organisation, error: orgError }, { data: settings, error: settingsError }] =
      await Promise.all([
        supabase
          .from("engagement_handover_letters")
          .select("*")
          .eq("engagement_id", engagementId)
          .single(),
        supabase
          .from("organisations")
          .select("id,name")
          .eq("id", engagement.organisation_id)
          .single(),
        supabase
          .from("practice_settings")
          .select("*")
          .eq("organisation_id", engagement.organisation_id)
          .maybeSingle(),
      ]);

    if (handoverError || !handover) {
      return NextResponse.json(
        { error: "Save the handover letter draft before exporting it." },
        { status: 400 }
      );
    }

    if (orgError) throw orgError;
    if (settingsError) throw settingsError;

    const organisationName = organisation?.name || "";
    const practiceName =
      settings?.firm_name ||
      settings?.trading_name ||
      organisationName ||
      "";

    const signatoryName =
      settings?.authorised_signatory_name || "Authorised signatory";

    const clientHeading = engagement.client_registration_number
      ? `${engagement.client_name} - Registration No. ${engagement.client_registration_number}`
      : engagement.client_name;

    const firstPage = `
      <div class="date">${escapeHtml(formatDate(handover.document_date))}</div>

      <div class="recipient">
        <strong>${escapeHtml(handover.previous_practice || "")}</strong>
        <span>Att: ${escapeHtml(handover.previous_accountant_name || "To whom it may concern")}</span>
        ${
          handover.previous_accountant_email
            ? `<span>Per Email: ${escapeHtml(handover.previous_accountant_email)}</span>`
            : ""
        }
      </div>

      <p class="subject"><strong>RE: ${escapeHtml(clientHeading.toUpperCase())}</strong></p>

      <div class="intro">
        <p>
          We have been appointed by the above-mentioned client to attend to their accounting,
          taxation and related compliance affairs as from
          <strong class="nowrap">${escapeHtml(formatDate(handover.takeover_date))}</strong>.
        </p>
        <p>We understand that your firm currently acts as accountant and/or tax practitioner for the client.</p>
        <p>As part of our professional acceptance procedures, kindly advise whether you are aware of any reason, professional or otherwise, why we should not accept this appointment.</p>
        <p>Subject to there being no such reason, we would appreciate your assistance with the orderly handover of the client's accounting and statutory records.</p>
        <p>Kindly provide the following information and documentation, where applicable:</p>
      </div>

      <h3>1. Annual Financial Statements and Accounting Records</h3>
      ${bullets([
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
      ])}

      <h3>2. Income Tax</h3>
      ${bullets([
        "Copies of income tax returns submitted for the latest available years of assessment.",
        "Income tax calculations and supporting schedules.",
        "Provisional tax calculations and submissions.",
        "SARS assessments and statements of account.",
        "Details of any assessed losses, capital losses or other tax balances carried forward.",
        "Details of any outstanding income tax returns, objections, disputes, audits or verification matters.",
        "Copies of relevant SARS correspondence.",
      ])}

      `;

    const secondPage = `<h3>3. Value-Added Tax</h3>
      <p class="tight">Where the client is registered for VAT:</p>
      ${bullets([
        "Copies of VAT201 returns for the current financial year and latest completed financial year.",
        "VAT reconciliations.",
        "VAT control account reconciliations.",
        "SARS VAT statements of account.",
        "Details of any outstanding returns, verifications, audits or disputes.",
        "Supporting schedules relevant to any unusual or significant VAT matters.",
      ])}
    
      <h3>4. Payroll, PAYE and Employees' Tax</h3>
      <p class="tight">Where applicable:</p>
      ${bullets([
        "EMP201 returns for the current financial year.",
        "EMP501 reconciliations for the latest completed reconciliation periods.",
        "IRP5/IT3(a) certificates.",
        "Payroll reports up to the date of handover.",
        "Employee payslips where required.",
        "PAYE, UIF and SDL reconciliations.",
        "Details of any outstanding payroll submissions or SARS queries.",
        "Copies of relevant SARS correspondence.",
      ])}

      <h3>5. SARS Registration Information</h3>
      <p class="tight">Kindly confirm and/or provide the client's relevant registration numbers, including:</p>
      ${bullets([
        "Income Tax number.",
        "VAT number.",
        "PAYE number.",
        "Customs or other SARS registrations, where applicable.",
      ])}

      <p>We will arrange for the transfer of the relevant SARS eFiling tax types upon instruction and authorisation from the client.</p>

      <h3>6. Department of Employment and Labour</h3>
      <p class="tight">Where applicable, kindly provide:</p>
      ${bullets([
        "UIF registration number.",
        "Compensation Fund / COIDA registration number.",
        "Latest Return of Earnings information.",
        "Letter of Good Standing, if available.",
        "Details of any outstanding submissions, assessments or correspondence.",
      ])}

      `;

    const thirdPage = `<h3>7. CIPC and Entity Statutory Records</h3>
      <p class="tight">Where applicable to the entity type, kindly provide:</p>
      ${bullets([
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
      ])}

      <p class="page-end">Where original statutory documents are held by your firm, please advise and we will arrange collection at a mutually convenient time.</p>
    

      <h3>8. Other Relevant Information</h3>
      <p class="tight">Please also provide:</p>
      ${bullets([
        "Details of any material matters currently under discussion with the client.",
        "Details of any outstanding work or submissions.",
        "Copies of relevant correspondence with SARS, CIPC, the Department of Employment and Labour or other regulatory authorities.",
        "Any schedules, calculations, working papers or supporting documentation which may assist with the continuity of the client's accounting and compliance affairs.",
      ])}

      <p>Should any of the above information not be available or not be applicable to the client, kindly advise us accordingly.</p>
      <p>We appreciate your assistance in ensuring an efficient and professional handover.</p>
      <p>Please do not hesitate to contact us should you require any further information or authorisation from the client.</p>
      ${handover.notes ? `<p>${escapeHtml(handover.notes)}</p>` : ""}

      <div class="closing">
        <p>Kind regards</p>
        <div class="signature-line"></div>
        <strong>${escapeHtml(signatoryName)}</strong>
        ${practiceName ? `<span>${escapeHtml(practiceName)}</span>` : ""}
      </div>
    `;

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(engagement.client_name)} - Handover Letter</title>
<style>
  @page { size: A4; margin: 0; }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    position: relative;
    width: 210mm;
    height: 297mm;
    padding: 16mm 14mm 23mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    font-size: 10.2pt;
    line-height: 1.32;
    background: #ffffff;
  }

  .page.last-page {
    page-break-after: auto;
    break-after: auto;
  }

  .letterhead { margin-bottom: 14px; }
  .letterhead-top {
    min-height: 72px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
  }

  .logo-area { min-width: 250px; }
  .practice-logo {
    display: block;
    max-width: 245px;
    max-height: 76px;
    object-fit: contain;
    object-position: left top;
  }

  .practice-name { font-size: 24px; }

  .practice-contact {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    font-size: 9.5pt;
    line-height: 1.45;
  }

  .rule {
    height: 1px;
    background: #0f172a;
    margin-top: 10px;
  }

  .page-body { padding-bottom: 64px; }
  .date { margin-bottom: 16px; }

  .recipient {
    margin-bottom: 14px;
    line-height: 1.4;
    display: flex;
    flex-direction: column;
  }

  p { margin: 0 0 8px; }
  .subject { margin: 14px 0; }
  .intro p { margin-bottom: 8px; }
  .nowrap { white-space: nowrap; }

  h3 {
    margin: 9px 0 3px;
    font-size: 10.7pt;
    line-height: 1.25;
    font-weight: 700;
  }

  .tight { margin: 0 0 2px; }

  ul {
    margin: 3px 0 8px;
    padding-left: 22px;
    list-style-type: disc;
    list-style-position: outside;
  }

  li { margin-bottom: 2px; }

  .page-end {
    margin-top: 10px;
    margin-bottom: 0;
  }

  .closing {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 20px;
  }

  .signature-line {
    width: 175px;
    border-bottom: 1px solid #0f172a;
    margin: 28px 0 4px;
  }

  .footer {
    position: absolute;
    left: 14mm;
    right: 14mm;
    bottom: 8mm;
  }

  .footer .rule {
    margin: 0 0 7px;
  }

  .footer-main {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
  }

  .footer-identity {
    display: flex;
    flex-direction: column;
    font-size: 8.5pt;
    line-height: 1.35;
  }

  .footer-logos {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .footer-logos img {
    max-width: 65px;
    max-height: 32px;
    object-fit: contain;
  }
</style>
</head>
<body>
  ${pageShell(settings, organisationName, firstPage)}
  ${pageShell(settings, organisationName, secondPage)}
  ${pageShell(settings, organisationName, thirdPage, true)}
</body>
</html>`;

    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

    if (isVercel) {
      const chromium = (await import("@sparticuz/chromium-min")).default;

      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await getVercelChromiumPath(),
        headless: true,
        defaultViewport: {
          width: 1280,
          height: 1800,
        },
      });
    } else {
      const localChromePath = getLocalChromePath();

      if (!localChromePath) {
        throw new Error("Local Google Chrome executable was not found.");
      }

      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: localChromePath,
        headless: true,
        defaultViewport: {
          width: 1280,
          height: 1800,
        },
      });
    }

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "load",
      timeout: 60_000,
    });

    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    const filename = safeFilename(
      `${engagement.client_name} - Handover Letter`
    );

    return new Response(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("HANDOVER LETTER PDF ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Unable to generate handover PDF.",
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Director = {
  id: string;
  director_name: string;
  id_passport_number: string | null;
  email: string | null;
  phone: string | null;
  appointment_date: string | null;
  cessation_date: string | null;
  is_active: boolean | null;
};

type Workflow = {
  id: string;
  organisation_id: string;
  client_id: string;
  director_id: string | null;
  status: string;
  resolution_date: string | null;
  submission_date: string | null;
  confirmation_date: string | null;
  notes: string | null;
};

type Item = {
  id: string;
  item_key: string;
  label: string;
  item_order: number;
  item_type: "generated" | "upload";
  status: "outstanding" | "ready" | "completed" | "not_applicable";
  file_name: string | null;
  storage_path: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
};

type ApiPayload = {
  success?: boolean;
  error?: string;
  client?: {
    id: string;
    client_name: string;
    registration_number: string | null;
    entity_type: string | null;
  };
  workflow?: Workflow | null;
  directors?: Director[];
  items?: Item[];
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  documents_required: "Documents required",
  ready_for_signature: "Ready for signature",
  ready_for_submission: "Ready for submission",
  submitted: "Submitted",
  confirmed: "Confirmed",
};

function statusLabel(value: string) {
  return STATUS_LABELS[value] || value;
}

function todayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated.");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export default function RegisteredRepresentativePage() {
  const params = useParams();
  const clientId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [clientName, setClientName] = useState("Client");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [entityType, setEntityType] = useState("");

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [selectedDirectorId, setSelectedDirectorId] = useState("");
  const [status, setStatus] = useState("documents_required");
  const [resolutionDate, setResolutionDate] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  const [confirmationDate, setConfirmationDate] = useState("");
  const [notes, setNotes] = useState("");

  const activeDirectors = useMemo(
    () => directors.filter((director) => director.is_active !== false),
    [directors]
  );

  const selectedDirector = useMemo(
    () => directors.find((director) => director.id === selectedDirectorId) || null,
    [directors, selectedDirectorId]
  );

  const completedCount = items.filter(
    (item) => item.status === "completed" || item.status === "not_applicable"
  ).length;

  const progress = items.length
    ? Math.round((completedCount / items.length) * 100)
    : 0;

  function hydrate(data: ApiPayload) {
    if (data.client) {
      setClientName(data.client.client_name || "Client");
      setRegistrationNumber(data.client.registration_number || "");
      setEntityType(data.client.entity_type || "");
    }

    setDirectors(data.directors || []);
    setItems(data.items || []);

    if (data.workflow) {
      setWorkflow(data.workflow);
      setSelectedDirectorId(data.workflow.director_id || "");
      setStatus(data.workflow.status || "documents_required");
      setResolutionDate(data.workflow.resolution_date || "");
      setSubmissionDate(data.workflow.submission_date || "");
      setConfirmationDate(data.workflow.confirmation_date || "");
      setNotes(data.workflow.notes || "");
    } else {
      setWorkflow(null);
      setSelectedDirectorId("");
      setStatus("documents_required");
      setResolutionDate("");
      setSubmissionDate("");
      setConfirmationDate("");
      setNotes("");
    }
  }

  async function load() {
    if (!clientId) return;

    setLoading(true);
    setError("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not load Registered Representative.");
      }

      hydrate(data);
    } catch (err: any) {
      setError(err?.message || "Could not load Registered Representative.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clientId]);

  async function startWorkflow() {
    if (!selectedDirectorId) {
      setError("Select the Registered Representative first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ directorId: selectedDirectorId }),
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not start Registered Representative.");
      }

      hydrate(data);
      setMessage("Registered Representative workflow started.");
    } catch (err: any) {
      setError(err?.message || "Could not start Registered Representative.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWorkflow() {
    if (!workflow) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "update_workflow",
            directorId: selectedDirectorId || null,
            status,
            resolutionDate: resolutionDate || null,
            submissionDate: submissionDate || null,
            confirmationDate: confirmationDate || null,
            notes,
          }),
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not save Registered Representative.");
      }

      hydrate(data);
      setMessage("Registered Representative saved.");
    } catch (err: any) {
      setError(err?.message || "Could not save Registered Representative.");
    } finally {
      setSaving(false);
    }
  }

  async function markAlreadyConfirmed() {
    if (!selectedDirectorId) {
      setError("Select the current Registered Representative first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();

      const startResponse = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ directorId: selectedDirectorId }),
        }
      );

      const startData = (await startResponse.json()) as ApiPayload;

      if (!startResponse.ok) {
        throw new Error(
          startData.error || "Could not create Registered Representative record."
        );
      }

      const confirmResponse = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "update_workflow",
            directorId: selectedDirectorId,
            status: "confirmed",
            resolutionDate: null,
            submissionDate: null,
            confirmationDate: todayDateKey(),
            notes: "Existing Registered Representative captured on client takeover.",
          }),
        }
      );

      const confirmData = (await confirmResponse.json()) as ApiPayload;

      if (!confirmResponse.ok) {
        throw new Error(
          confirmData.error || "Could not confirm Registered Representative."
        );
      }

      hydrate(confirmData);
      setMessage("Existing Registered Representative recorded as confirmed.");
    } catch (err: any) {
      setError(err?.message || "Could not confirm Registered Representative.");
    } finally {
      setSaving(false);
    }
  }

  async function startRepresentativeChange() {
    if (!workflow) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "update_workflow",
            directorId: selectedDirectorId || null,
            status: "documents_required",
            resolutionDate: null,
            submissionDate: null,
            confirmationDate: null,
            notes,
          }),
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not start RR change.");
      }

      hydrate(data);
      setMessage("RR change workflow opened.");
    } catch (err: any) {
      setError(err?.message || "Could not start RR change.");
    } finally {
      setSaving(false);
    }
  }

  async function generateResolution() {
    if (!workflow || !selectedDirectorId) {
      setError("Select and save the Registered Representative first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative/resolution`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Could not generate the resolution.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");

      if (!resolutionDate) {
        setResolutionDate(todayDateKey());
      }

      setMessage("Registered Representative resolution generated.");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      setError(err?.message || "Could not generate the resolution.");
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(item: Item, nextStatus: Item["status"]) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "update_item",
            itemId: item.id,
            status: nextStatus,
          }),
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not update checklist item.");
      }

      hydrate(data);
    } catch (err: any) {
      setError(err?.message || "Could not update checklist item.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={styles.page}>Loading Registered Representative...</main>;
  }

  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
        <Link
          href={`/crm/client/${clientId}?tab=registrations`}
          style={styles.backLink}
        >
          ← Back to Registrations
        </Link>
      </section>

      <section style={styles.hero}>
        <div>
          <div style={styles.heroKicker}>Registered Representative</div>
          <h1 style={styles.title}>{clientName}</h1>
          <div style={styles.meta}>
            {entityType || "Entity"}
            {registrationNumber ? `  •  ${registrationNumber}` : ""}
          </div>
        </div>

        {workflow ? (
          <span style={styles.statusBadge}>{statusLabel(workflow.status)}</span>
        ) : (
          <span style={styles.statusBadgeMuted}>Not started</span>
        )}
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {message ? <div style={styles.messageBox}>{message}</div> : null}

      {!workflow ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Select the SARS representative</h2>
              <p style={styles.panelSubtitle}>
                Choose the director who will act as the Registered Representative.
              </p>
            </div>
          </div>

          <div style={styles.startGrid}>
            <div>
              <label style={styles.label}>Registered Representative</label>
              <select
                style={styles.input}
                value={selectedDirectorId}
                onChange={(event) => setSelectedDirectorId(event.target.value)}
              >
                <option value="">Select director...</option>
                {activeDirectors.map((director) => (
                  <option key={director.id} value={director.id}>
                    {director.director_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.startActions}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={startWorkflow}
                disabled={saving || !selectedDirectorId}
              >
                {saving ? "Starting..." : "Start RR workflow"}
              </button>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={markAlreadyConfirmed}
                disabled={saving || !selectedDirectorId}
              >
                Already confirmed
              </button>
            </div>
          </div>

          {activeDirectors.length === 0 ? (
            <div style={styles.warningBox}>
              No active directors are available. Add the director under People /
              Secretarial first.
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <section style={styles.summaryStrip}>
            <div style={styles.summaryCell}>
              <span style={styles.summaryLabel}>Representative</span>
              <strong style={styles.summaryValue}>
                {selectedDirector?.director_name || "Not selected"}
              </strong>
            </div>

            <div style={styles.summaryCell}>
              <span style={styles.summaryLabel}>Pack progress</span>
              <strong style={styles.summaryValue}>
                {completedCount}/{items.length}
              </strong>
            </div>

            <div style={styles.summaryCell}>
              <span style={styles.summaryLabel}>Completion</span>
              <strong style={styles.summaryValue}>{progress}%</strong>
            </div>

            <div style={{ ...styles.summaryCell, borderRight: "none" }}>
              <span style={styles.summaryLabel}>Status</span>
              <strong style={styles.summaryValue}>{statusLabel(status)}</strong>
            </div>
          </section>

          <section style={styles.workspace}>
            <div style={styles.mainColumn}>
              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                    <h2 style={styles.panelTitle}>Representative details</h2>
                    <p style={styles.panelSubtitle}>
                      The RR is linked to the client’s existing director master data.
                    </p>
                  </div>

                  {status === "confirmed" ? (
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={startRepresentativeChange}
                      disabled={saving}
                    >
                      Change RR
                    </button>
                  ) : null}
                </div>

                <div style={styles.formGrid}>
                  <div>
                    <label style={styles.label}>Registered Representative</label>
                    <select
                      style={styles.input}
                      value={selectedDirectorId}
                      onChange={(event) => setSelectedDirectorId(event.target.value)}
                    >
                      <option value="">Select director...</option>
                      {activeDirectors.map((director) => (
                        <option key={director.id} value={director.id}>
                          {director.director_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Workflow status</label>
                    <select
                      style={styles.input}
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="documents_required">Documents required</option>
                      <option value="ready_for_signature">Ready for signature</option>
                      <option value="ready_for_submission">Ready for submission</option>
                      <option value="submitted">Submitted</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Resolution date</label>
                    <input
                      type="date"
                      style={styles.input}
                      value={resolutionDate}
                      onChange={(event) => setResolutionDate(event.target.value)}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Submission date</label>
                    <input
                      type="date"
                      style={styles.input}
                      value={submissionDate}
                      onChange={(event) => setSubmissionDate(event.target.value)}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Confirmation date</label>
                    <input
                      type="date"
                      style={styles.input}
                      value={confirmationDate}
                      onChange={(event) => setConfirmationDate(event.target.value)}
                    />
                  </div>
                </div>

                {selectedDirector ? (
                  <div style={styles.directorFacts}>
                    <span>
                      <strong>ID / Passport:</strong>{" "}
                      {selectedDirector.id_passport_number || "Not captured"}
                    </span>
                    <span>
                      <strong>Email:</strong>{" "}
                      {selectedDirector.email || "Not captured"}
                    </span>
                    <span>
                      <strong>Phone:</strong>{" "}
                      {selectedDirector.phone || "Not captured"}
                    </span>
                  </div>
                ) : null}

                <div style={styles.notesWrap}>
                  <label style={styles.label}>Notes</label>
                  <textarea
                    rows={4}
                    style={styles.textarea}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

                <div style={styles.actions}>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={saveWorkflow}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save RR"}
                  </button>
                </div>
              </section>

              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                    <h2 style={styles.panelTitle}>Registered Representative pack</h2>
                    <p style={styles.panelSubtitle}>
                      Everything required for the SARS RR submission in one place.
                    </p>
                  </div>
                  <div style={styles.progressText}>
                    {completedCount} of {items.length} complete
                  </div>
                </div>

                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                </div>

                <div style={styles.checklist}>
                  {items.map((item) => {
                    const done =
                      item.status === "completed" ||
                      item.status === "not_applicable";

                    return (
                      <div key={item.id} style={styles.checkRow}>
                        <button
                          type="button"
                          aria-label={`Toggle ${item.label}`}
                          style={{
                            ...styles.checkbox,
                            ...(done ? styles.checkboxDone : {}),
                          }}
                          onClick={() =>
                            updateItem(
                              item,
                              done ? "outstanding" : "completed"
                            )
                          }
                          disabled={saving}
                        >
                          {done ? "✓" : ""}
                        </button>

                        <div style={styles.checkMain}>
                          <strong
                            style={{
                              ...styles.checkLabel,
                              ...(done ? styles.checkLabelDone : {}),
                            }}
                          >
                            {item.label}
                          </strong>
                          <span style={styles.checkMeta}>
                            {item.item_type === "generated"
                              ? "PracticePilot generated document"
                              : "Supporting document / evidence"}
                          </span>
                        </div>

                        <div style={styles.itemActions}>
                          {item.item_type === "generated" ? (
                            <span style={styles.generatedBadge}>PP document</span>
                          ) : (
                            <button
                              type="button"
                              style={styles.secondaryButton}
                              disabled
                              title="Document upload is added in the next step"
                            >
                              Upload
                            </button>
                          )}

                          <button
                            type="button"
                            style={styles.naButton}
                            onClick={() =>
                              updateItem(
                                item,
                                item.status === "not_applicable"
                                  ? "outstanding"
                                  : "not_applicable"
                              )
                            }
                            disabled={saving}
                          >
                            N/A
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside style={styles.sideColumn}>
              <section style={styles.sidePanel}>
                <h3 style={styles.sideTitle}>Submission control</h3>
                <div style={styles.sideRow}>
                  <span>Pack</span>
                  <strong>{progress === 100 ? "Complete" : "In progress"}</strong>
                </div>
                <div style={styles.sideRow}>
                  <span>Submitted</span>
                  <strong>{submissionDate || "—"}</strong>
                </div>
                <div style={styles.sideRow}>
                  <span>Confirmed</span>
                  <strong>{confirmationDate || "—"}</strong>
                </div>
              </section>

              <section style={styles.sidePanel}>
                <h3 style={styles.sideTitle}>PP-generated documents</h3>
                <p style={styles.sideText}>
                  The Resolution and SARS TPPOA buttons will be activated when
                  we wire the document generators in the next step.
                </p>
                <button
                  type="button"
                  style={styles.fullSecondaryButtonActive}
                  onClick={generateResolution}
                  disabled={saving || !selectedDirectorId}
                >
                  Generate Resolution
                </button>
                <button type="button" style={styles.fullSecondaryButton} disabled>
                  Generate SARS TPPOA
                </button>
              </section>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eef3f7",
    color: "#13263d",
    padding: 16,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  },
  topBar: {
    background: "#ffffff",
    border: "1px solid #d5e0e8",
    padding: "12px 16px",
    marginBottom: 10,
  },
  backLink: {
    color: "#1558c0",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
  },
  hero: {
    background: "#ffffff",
    border: "1px solid #d5e0e8",
    padding: "22px 20px",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },
  heroKicker: {
    color: "#64788c",
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 7,
  },
  title: {
    margin: 0,
    fontSize: 27,
    lineHeight: 1.15,
    color: "#13263d",
  },
  meta: {
    marginTop: 8,
    color: "#6f8295",
    fontSize: 14,
  },
  statusBadge: {
    border: "1px solid #a8d6bb",
    background: "#eef9f2",
    color: "#24643d",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  statusBadgeMuted: {
    border: "1px solid #cfd9e2",
    background: "#f7f9fb",
    color: "#66788a",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  errorBox: {
    background: "#fff4f1",
    border: "1px solid #efc1b5",
    color: "#963524",
    padding: "10px 12px",
    marginBottom: 10,
    fontSize: 13,
  },
  messageBox: {
    background: "#f1faf4",
    border: "1px solid #b8ddc3",
    color: "#28643c",
    padding: "10px 12px",
    marginBottom: 10,
    fontSize: 13,
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #d5e0e8",
    marginBottom: 10,
  },
  panelHeader: {
    padding: "15px 16px",
    borderBottom: "1px solid #dfe7ed",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  panelTitle: {
    margin: 0,
    fontSize: 17,
    color: "#172b42",
  },
  panelSubtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#708294",
  },
  startGrid: {
    padding: 16,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "end",
  },
  startActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#4f6275",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 38,
    border: "1px solid #c9d7e2",
    background: "#ffffff",
    color: "#182c43",
    padding: "7px 9px",
    outline: "none",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #c9d7e2",
    background: "#ffffff",
    color: "#182c43",
    padding: "9px",
    resize: "vertical",
    outline: "none",
  },
  primaryButton: {
    border: "1px solid #1565dc",
    background: "#1565dc",
    color: "#ffffff",
    minHeight: 38,
    padding: "8px 15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd7e1",
    background: "#ffffff",
    color: "#263c52",
    minHeight: 32,
    padding: "6px 10px",
    fontWeight: 700,
    cursor: "pointer",
  },
  fullSecondaryButton: {
    width: "100%",
    border: "1px solid #cbd7e1",
    background: "#f7f9fb",
    color: "#7b8b9a",
    minHeight: 36,
    padding: "7px 10px",
    fontWeight: 700,
    marginTop: 8,
  },
  fullSecondaryButtonActive: {
    width: "100%",
    border: "1px solid #cbd7e1",
    background: "#ffffff",
    color: "#263c52",
    minHeight: 36,
    padding: "7px 10px",
    fontWeight: 700,
    marginTop: 8,
    cursor: "pointer",
  },
  naButton: {
    border: "1px solid #cbd7e1",
    background: "#ffffff",
    color: "#5f7183",
    minHeight: 32,
    padding: "6px 9px",
    fontWeight: 700,
    cursor: "pointer",
  },
  warningBox: {
    margin: "0 16px 16px",
    padding: "10px 12px",
    background: "#fff8e7",
    border: "1px solid #ead39b",
    color: "#6f5521",
    fontSize: 13,
  },
  summaryStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    border: "1px solid #d5e0e8",
    background: "#ffffff",
    marginBottom: 10,
  },
  summaryCell: {
    padding: "12px 14px",
    borderRight: "1px solid #dfe7ed",
  },
  summaryLabel: {
    display: "block",
    color: "#728496",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 5,
  },
  summaryValue: {
    display: "block",
    fontSize: 16,
    color: "#172b42",
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 270px",
    gap: 10,
    alignItems: "start",
  },
  mainColumn: {
    minWidth: 0,
  },
  sideColumn: {
    display: "grid",
    gap: 10,
  },
  sidePanel: {
    background: "#ffffff",
    border: "1px solid #d5e0e8",
    padding: 14,
  },
  sideTitle: {
    margin: "0 0 12px",
    fontSize: 15,
  },
  sideText: {
    margin: "0 0 10px",
    color: "#6e8092",
    fontSize: 12,
    lineHeight: 1.5,
  },
  sideRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid #edf1f4",
    fontSize: 12,
  },
  formGrid: {
    padding: 16,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  directorFacts: {
    margin: "0 16px 14px",
    background: "#f6f9fb",
    border: "1px solid #dbe4eb",
    padding: 10,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    fontSize: 12,
    color: "#53677b",
  },
  notesWrap: {
    padding: "0 16px 16px",
  },
  actions: {
    borderTop: "1px solid #e1e8ee",
    padding: "11px 16px",
    display: "flex",
    justifyContent: "flex-end",
  },
  progressText: {
    fontSize: 12,
    color: "#5e7184",
    fontWeight: 700,
  },
  progressTrack: {
    height: 5,
    background: "#edf2f5",
    margin: "0 16px 6px",
  },
  progressFill: {
    height: "100%",
    background: "#3d8b62",
  },
  checklist: {
    padding: "0 16px 14px",
  },
  checkRow: {
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    borderBottom: "1px solid #e5ebf0",
  },
  checkbox: {
    width: 24,
    height: 24,
    border: "1px solid #bfd0dc",
    background: "#ffffff",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  checkboxDone: {
    background: "#5fae7d",
    borderColor: "#5fae7d",
  },
  checkMain: {
    minWidth: 0,
  },
  checkLabel: {
    display: "block",
    fontSize: 13,
    color: "#20354c",
  },
  checkLabelDone: {
    textDecoration: "line-through",
    color: "#6d7d8d",
  },
  checkMeta: {
    display: "block",
    marginTop: 3,
    fontSize: 11,
    color: "#8593a1",
  },
  itemActions: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  generatedBadge: {
    border: "1px solid #b8d0e9",
    background: "#eef6ff",
    color: "#255f99",
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 700,
  },
};

