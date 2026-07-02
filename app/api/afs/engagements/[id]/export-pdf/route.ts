import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findLocalChromeExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean) as string[];

  const fs = await import("fs/promises");

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep looking
    }
  }

  return null;
}

async function getBrowserLaunchOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction || process.env.VERCEL) {
    const chromium = await import("@sparticuz/chromium");

    return {
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    };
  }

  const localExecutablePath = await findLocalChromeExecutable();

  if (!localExecutablePath) {
    throw new Error(
      "Could not find a local Chrome executable. Install Google Chrome or set CHROME_EXECUTABLE_PATH.",
    );
  }

  return {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
      "--disable-extensions",
      "--disable-background-networking",
    ],
    executablePath: localExecutablePath,
    headless: true,
  };
}

function getBaseUrl(request: NextRequest) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_URL ||
    "";

  if (configured) {
    if (configured.startsWith("http://") || configured.startsWith("https://")) {
      return configured.replace(/\/$/, "");
    }

    return `https://${configured.replace(/\/$/, "")}`;
  }

  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";

  return `${protocol}://${host}`;
}

function safeFilename(value: string) {
  const cleaned = String(value || "afs")
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/\(pty\)/gi, "pty")
    .replace(/ltd\.?/gi, "ltd")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return cleaned || "afs";
}

function cleanTitle(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

export async function GET(request: NextRequest, context: RouteContext) {
  let browser: any = null;

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const puppeteer = await import("puppeteer-core");
    const launchOptions = await getBrowserLaunchOptions();
    const baseUrl = getBaseUrl(request);
    const isDraft =
  request.nextUrl.searchParams.get("draft") === "1" ||
  request.nextUrl.searchParams.get("draft") === "true";

const exportUrl = `${baseUrl}/afs/${id}/print-studio/export?serverPdf=1${
  isDraft ? "&draft=1" : ""
}`;


    browser = await puppeteer.default.launch(launchOptions as any);

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120_000);
    page.setDefaultTimeout(120_000);

    await page.setViewport({
      width: 1240,
      height: 1754,
      deviceScaleFactor: 1,
    });

    await page.goto(exportUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || "";
        return (
          text.includes("Annual financial statements") &&
          text.includes("Statement of Financial Position") &&
          text.includes("Tax Computation")
        );
      },
      { timeout: 120_000 },
    );

    await page.emulateMediaType("print");

    const exportInfo = await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => resolve()).catch(() => resolve());
        } else {
          resolve();
        }
      });

      window.dispatchEvent(
        new CustomEvent("afs-print-export-mode", {
          detail: true,
        }),
      );

      const bodyText = document.body?.innerText || "";
      const lines = bodyText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const entityLine =
        lines.find((line) => /\(PTY\)\s+LTD/i.test(line)) ||
        lines.find((line) => /LTD/i.test(line)) ||
        "annual-financial-statements";

      const yearEndMatch = bodyText.match(/year ended\s+(\d{4}-\d{2}-\d{2})/i);
      const yearEnd = yearEndMatch?.[1] || "";

      const title = [entityLine, "AFS", yearEnd].filter(Boolean).join(" - ");
      document.title = title;

      return {
        title,
        entityName: entityLine,
        yearEnd,
      };
    });

    // Small stabilisation delay after export-mode event; keep it short so export feels alive.
    await sleep(250);

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    await browser.close();
    browser = null;

    const pdfBuffer = Buffer.from(pdfBytes);
    const finalTitle = cleanTitle(exportInfo?.title || `${id} AFS`);
    const finalFilename = `${safeFilename(finalTitle)}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${finalFilename}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-AFS-PDF-Title": finalTitle,
      },
    });
  } catch (error: any) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore close errors
      }
    }

    console.error("AFS PDF export failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "AFS PDF export failed.",
      },
      { status: 500 },
    );
  }
}
