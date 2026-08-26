import { existsSync } from "fs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Profile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  access_enabled: boolean;
};

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
  if (!key) throw new Error("Missing Supabase service-role key.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof adminClient>,
) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      ),
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,user_id,organisation_id,full_name,email,access_enabled")
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Profile access denied." },
        { status: 403 },
      ),
    };
  }

  return { profile: data as Profile, response: null };
}

async function engagementIdFrom(context: any) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

async function authorisedContext(request: Request, context: any) {
  const engagementId = await engagementIdFrom(context);

  if (!engagementId) {
    return {
      error: NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 },
      ),
    };
  }

  const supabase = adminClient();
  const auth = await currentProfile(request, supabase);

  if (auth.response) {
    return { error: auth.response };
  }

  if (!auth.profile) {
    return {
      error: NextResponse.json(
        { error: "Profile access denied." },
        { status: 403 },
      ),
    };
  }

  const { data: engagement, error: engagementError } = await supabase
    .from("afs_engagements")
    .select("id,organisation_id,afs_methodology_snapshot")
    .eq("id", engagementId)
    .maybeSingle();

  if (engagementError || !engagement) {
    return {
      error: NextResponse.json(
        { error: "AFS engagement not found." },
        { status: 404 },
      ),
    };
  }

  if (
    !auth.profile.organisation_id ||
    engagement.organisation_id !== auth.profile.organisation_id
  ) {
    return {
      error: NextResponse.json(
        { error: "Access denied." },
        { status: 403 },
      ),
    };
  }

  const { data: organisation, error: organisationError } = await supabase
    .from("organisations")
    .select("id,name,afs_white_label_documents")
    .eq("id", engagement.organisation_id)
    .maybeSingle();

  if (organisationError || !organisation) {
    return {
      error: NextResponse.json(
        { error: "Practice not found." },
        { status: 404 },
      ),
    };
  }

  const methodologySnapshot =
    engagement.afs_methodology_snapshot &&
    typeof engagement.afs_methodology_snapshot === "object"
      ? engagement.afs_methodology_snapshot
      : null;

  const lockedPracticeName =
    methodologySnapshot?.organisationName ||
    organisation.name ||
    "Accounting practice";

  const lockedWhiteLabel =
    methodologySnapshot?.documents?.whiteLabel === undefined
      ? Boolean(organisation.afs_white_label_documents)
      : Boolean(methodologySnapshot.documents.whiteLabel);

  return {
    error: null,
    supabase,
    engagementId,
    profile: auth.profile,
    organisation,
    practiceName: lockedPracticeName,
    whiteLabel: lockedWhiteLabel,
  };
}

function getLocalChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  const chromePath =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

  if (existsSync(chromePath)) {
    return chromePath;
  }

  const chromeCanaryPath =
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";

  if (existsSync(chromeCanaryPath)) {
    return chromeCanaryPath;
  }

  return null;
}

async function getVercelChromiumPath() {
  if (cachedExecutablePath) {
    return cachedExecutablePath;
  }

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

function safeFilename(value: unknown) {
  const cleaned = String(value || "Year-end Document")
    .replace(/\s+-\s+/g, " _ ")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return cleaned || "Year-end Document";
}

function cleanHtml(value: unknown) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim();
}

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPdfHtml(content: string, title: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>

    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        font-size: 10.5pt;
        line-height: 1.45;
      }

      article,
      .document,
      .certificate-page {
        display: block !important;
        width: 100% !important;
        max-width: none !important;
        min-height: 248mm;
        margin: 0 !important;
        padding: 0 0 20mm !important;
        border: 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
        color: #111827 !important;
      }

      h1 {
        margin: 0 0 6mm !important;
        padding: 0 0 2.5mm !important;
        border-bottom: 1px solid #111827;
        color: #111827 !important;
        font-size: 15.5pt !important;
        line-height: 1.2 !important;
        font-weight: 700 !important;
      }

      h2,
      h3,
      h4 {
        color: #111827 !important;
        break-after: avoid;
      }

      h2 {
        margin: 6mm 0 2mm !important;
        font-size: 11.5pt !important;
      }

      h3,
      h4 {
        margin: 5mm 0 1.5mm !important;
        font-size: 10.5pt !important;
      }

      p,
      li {
        font-size: 10.5pt !important;
        line-height: 1.48 !important;
      }

      p {
        margin: 0 0 3mm !important;
      }

      ol,
      ul {
        margin: 2mm 0 4mm !important;
        padding-left: 6mm !important;
      }

      li {
        margin: 0 0 2mm !important;
      }

      table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 4mm 0 !important;
        page-break-inside: auto;
      }

      th,
      td {
        padding: 2.2mm 1.6mm !important;
        vertical-align: top !important;
        font-size: 8.8pt !important;
        line-height: 1.35 !important;
      }

      th {
        border-bottom: 1px solid #64748b !important;
        font-weight: 700 !important;
      }

      tr {
        break-inside: avoid;
      }

      .identity {
        display: grid !important;
        gap: 1mm !important;
        margin: 0 0 7mm !important;
        color: #334155 !important;
        font-size: 9pt !important;
        line-height: 1.35 !important;
      }

      .identity strong,
      .identity span {
        display: block !important;
      }

      .signature-grid {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 10mm 14mm !important;
        margin-top: 14mm !important;
        break-inside: avoid;
      }

      .signature {
        min-width: 0 !important;
        break-inside: avoid;
        font-size: 9pt !important;
      }

      .meta {
        display: none !important;
      }

      input,
      select,
      textarea,
      button,
      .no-print {
        display: none !important;
      }

      @page {
        size: A4;
        margin: 16mm 16mm 22mm;
      }
    </style>
  </head>

  <body>
    ${content}
  </body>
</html>`;
}

export async function GET(request: Request, context: any) {
  try {
    const ctx = await authorisedContext(request, context);
    if (ctx.error) return ctx.error;

    const url = new URL(request.url);
    const documentKey = String(
      url.searchParams.get("documentKey") || "afs-approval",
    ).trim();

    const { data, error } = await ctx.supabase
      .from("afs_year_end_documents")
      .select("*")
      .eq("engagement_id", ctx.engagementId)
      .eq("document_key", documentKey)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      document: data || null,
      practiceName: ctx.practiceName,
      whiteLabel: ctx.whiteLabel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load year-end document." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: any) {
  try {
    const ctx = await authorisedContext(request, context);
    if (ctx.error) return ctx.error;

    const body = await request.json();
    const documentKey = String(body?.documentKey || "").trim();
    const status = String(body?.status || "draft")
      .trim()
      .toLowerCase();

    const payload =
      body?.payload && typeof body.payload === "object"
        ? body.payload
        : {};

    if (!documentKey) {
      return NextResponse.json(
        { error: "Missing document key." },
        { status: 400 },
      );
    }

    if (!["draft", "prepared", "signed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid document status." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const record: Record<string, any> = {
      engagement_id: ctx.engagementId,
      organisation_id: ctx.organisation.id,
      document_key: documentKey,
      status,
      payload,
      updated_at: now,
    };

    if (status === "prepared") {
      record.prepared_at = now;
      record.prepared_by = ctx.profile.user_id;
      record.signed_at = null;
      record.signed_by = null;
    } else if (status === "signed") {
      record.signed_at = now;
      record.signed_by = ctx.profile.user_id;
    } else {
      record.prepared_at = null;
      record.prepared_by = null;
      record.signed_at = null;
      record.signed_by = null;
    }

    const { data, error } = await ctx.supabase
      .from("afs_year_end_documents")
      .upsert(record, {
        onConflict: "engagement_id,document_key",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      document: data,
      practiceName: ctx.practiceName,
      whiteLabel: ctx.whiteLabel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not save year-end document." },
      { status: 500 },
    );
  }
}

function pdfFooterTemplate(practiceName: string, whiteLabel: boolean) {
  const leftText = `Prepared as part of ${practiceName}'s year-end working file.`;
  const rightText = whiteLabel ? "" : "Powered by PracticePilot";

  return `
    <div style="
      width: 100%;
      padding: 0 16mm;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7px;
      color: #6b7280;
    ">
      <div style="
        width: 100%;
        border-top: 1px solid #e5e7eb;
        padding-top: 5px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
      ">
        <span>${escapeHtml(leftText)}</span>
        <span>${escapeHtml(rightText)}</span>
      </div>
    </div>
  `;
}

export async function POST(request: Request, context: any) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const ctx = await authorisedContext(request, context);
    if (ctx.error) return ctx.error;

    const body = await request.json().catch(() => null);
    const title = safeFilename(body?.title);
    const content = cleanHtml(body?.html);

    if (!content) {
      return NextResponse.json(
        { error: "No year-end document content was supplied." },
        { status: 400 },
      );
    }

    if (content.length > 1_500_000) {
      return NextResponse.json(
        { error: "The year-end document is too large to export." },
        { status: 413 },
      );
    }

    const isVercel = Boolean(
      process.env.VERCEL ||
      process.env.VERCEL_ENV,
    );

    if (isVercel) {
      const chromium =
        (await import("@sparticuz/chromium-min")).default;

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
        throw new Error(
          "Local Google Chrome executable was not found.",
        );
      }

      browser = await puppeteer.launch({
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ],
        executablePath: localChromePath,
        headless: true,
        defaultViewport: {
          width: 1280,
          height: 1800,
        },
      });
    }

    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);

    await page.setContent(
      buildPdfHtml(content, title),
      {
        waitUntil: "load",
        timeout: 60_000,
      },
    );

    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: pdfFooterTemplate(
        ctx.practiceName,
        ctx.whiteLabel,
      ),
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "12mm",
        left: "0mm",
      },
    });

    return new Response(
      Buffer.from(pdfBuffer),
      {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            `attachment; filename="${title}.pdf"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: any) {
    console.error(
      "YEAR-END DOCUMENT PDF EXPORT ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to generate the year-end document PDF.",
      },
      { status: 500 },
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
