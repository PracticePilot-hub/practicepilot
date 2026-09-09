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
