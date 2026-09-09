import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseServiceKey) throw new Error("Missing Supabase service key");

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fileSafe(value: unknown) {
  return String(value || "Client")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) throw new Error("Not authenticated.");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Not authenticated.");

  return data.user;
}

async function launchBrowser() {
  const localChromeCandidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];

  const localExecutablePath =
    localChromeCandidates.find((candidate) => fs.existsSync(candidate)) || null;

  const isVercel = Boolean(process.env.VERCEL);

  const executablePath = isVercel
    ? await chromium.executablePath()
    : localExecutablePath || (await chromium.executablePath());

  return puppeteer.launch({
    args: isVercel
      ? chromium.args
      : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1200, height: 1600 },
    executablePath,
    headless: true,
  });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    await requireUser(req);
    const { id: clientId } = await context.params;

    const [clientResult, workflowResult, directorsResult] = await Promise.all([
      admin
        .from("crm_clients")
        .select("id, client_name, registration_number, entity_type, tax_number")
        .eq("id", clientId)
        .maybeSingle(),

      admin
        .from("crm_registered_representative_workflows")
        .select("id, client_id, director_id, status, resolution_date")
        .eq("client_id", clientId)
        .maybeSingle(),

      admin
        .from("crm_client_directors")
        .select("id, director_name, id_passport_number, appointment_date, is_active")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("director_name", { ascending: true }),
    ]);

    if (clientResult.error) throw clientResult.error;
    if (workflowResult.error) throw workflowResult.error;
    if (directorsResult.error) throw directorsResult.error;

    const client = clientResult.data;
    const workflow = workflowResult.data;
    const directors = directorsResult.data || [];

    if (!client) throw new Error("Client not found.");
    if (!workflow) throw new Error("Registered Representative workflow not found.");
    if (!workflow.director_id) throw new Error("Select the Registered Representative first.");

    const representative = directors.find(
      (director: any) => String(director.id) === String(workflow.director_id)
    );

    if (!representative) {
      throw new Error("The selected Registered Representative is not an active director.");
    }

    const resolutionDate = workflow.resolution_date || todayKey();

    const approvalSignatures = directors
      .map(
        (director: any) => `
          <div class="signature-block">
            <div class="signature-line"></div>
            <div class="signature-label">Signature</div>
            <div><strong>Name:</strong> ${esc(director.director_name)}</div>
            <div><strong>Capacity:</strong> Director</div>
          </div>
        `
      )
      .join("");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(client.client_name)} - RR Resolution</title>
<style>
  @page { size: A4; margin: 16mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    font-size: 10pt;
    line-height: 1.35;
  }
  h1 {
    text-align: center;
    margin: 0;
    font-size: 16pt;
    line-height: 1.15;
  }
  h2 {
    text-align: center;
    margin: 3px 0 12px;
    font-size: 12pt;
  }
  .meta {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 14px;
  }
  .meta td {
    padding: 2px 4px;
    vertical-align: top;
  }
  .meta td:first-child {
    width: 180px;
    font-weight: 700;
  }
  p { margin: 0 0 8px; }
  ol { margin: 4px 0 12px 20px; padding: 0; }
  li { margin: 0 0 5px; }
  .signed-at {
    margin: 14px 0 10px;
  }
  .section-title {
    margin: 12px 0 6px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .signatures {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 36px;
    row-gap: 20px;
    margin-top: 8px;
  }
  .signature-block {
    min-height: 86px;
  }
  .signature-line {
    border-top: 1px solid #111;
    margin-top: 34px;
  }
  .signature-label {
    text-align: center;
    font-size: 8.5pt;
    margin: 2px 0 4px;
  }
  .acceptance {
    margin-top: 14px;
    page-break-inside: avoid;
  }
  .acceptance-line {
    border-top: 1px solid #111;
    margin-top: 34px;
    width: 100%;
  }
  .footer {
    margin-top: 28px;
    text-align: center;
    font-size: 8pt;
    color: #555;
  }
</style>
</head>
<body>
  <h1>DIRECTORS’ RESOLUTION</h1>
  <h2>Appointment of SARS Registered Representative</h2>

  <table class="meta">
    <tr><td>Company name</td><td>${esc(client.client_name)}</td></tr>
    <tr><td>Registration number</td><td>${esc(client.registration_number || "—")}</td></tr>
    <tr><td>Income tax number</td><td>${esc(client.tax_number || "—")}</td></tr>
    <tr><td>Date of resolution</td><td>${esc(formatDate(resolutionDate))}</td></tr>
  </table>

  <p>
    <strong>WHEREAS</strong>, the Company is required to appoint and/or confirm an authorised person
    to act as its registered representative with the South African Revenue Service (“SARS”);
  </p>

  <p>
    <strong>AND WHEREAS</strong>, the directors wish to authorise one of the directors of the Company
    to attend to all matters required by SARS in this regard;
  </p>

  <p><strong>IT IS HEREBY RESOLVED THAT:</strong></p>

  <ol>
    <li>
      <strong>${esc(representative.director_name)}</strong>
      ${representative.id_passport_number ? `, identity number ${esc(representative.id_passport_number)},` : ""}
      in his/her capacity as director of the Company, is hereby authorised and appointed to act as the Company’s registered representative with SARS.
    </li>
    <li>
      The authorised director may register, update, verify and maintain the Company’s SARS registered representative profile and related eFiling profile.
    </li>
    <li>
      The authorised director may sign, submit and receive all documents, forms, declarations, correspondence and information required by SARS for the purpose of giving effect to this resolution.
    </li>
    <li>
      The authorised director may attend to all tax types and SARS matters linked to the Company, including but not limited to Income Tax, VAT, PAYE, UIF, SDL and any related administrative matters, where applicable.
    </li>
    <li>
      SARS is hereby requested to accept this resolution as authority for the appointment and/or update of the Company’s registered representative details.
    </li>
    <li>
      This authority remains valid until withdrawn or amended by written resolution of the directors of the Company.
    </li>
  </ol>

  <p class="signed-at">
    Signed on this ${esc(formatDate(resolutionDate))}.
  </p>

  <div class="section-title">DIRECTORS / AUTHORISED SIGNATORIES</div>

  <div class="signatures">
    ${approvalSignatures}
  </div>

  <div class="acceptance">
    <div class="section-title">ACCEPTANCE BY AUTHORISED DIRECTOR</div>
    <p>
      I, <strong>${esc(representative.director_name)}</strong>, hereby accept the appointment and
      authority granted to me in terms of this resolution.
    </p>

    <div class="acceptance-line"></div>
    <div class="signature-label">Signature of authorised director</div>
    <div><strong>Name:</strong> ${esc(representative.director_name)}</div>
    <div><strong>Date:</strong> ____________________</div>
  </div>

  <div class="footer">
    Company Resolution | SARS Registered Representative
  </div>
</body>
</html>`;

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });

    const fileName = `${fileSafe(client.client_name)}-SARS-Registered-Representative-Resolution.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("RR RESOLUTION PDF ERROR:", error);

    const message =
      error?.message || "Could not generate the Registered Representative resolution.";

    return NextResponse.json(
      { success: false, error: message },
      { status: message === "Not authenticated." ? 401 : 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
