import { existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  "https://github.com/Sparticuz/chromium/releases/download/v141.0.0/chromium-v141.0.0-pack.x64.tar";

let cachedExecutablePath: string | null = null;
let chromiumDownloadPromise: Promise<string> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function getOrigin(request: NextRequest) {
  const url = new URL(request.url);

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }

  return `${url.protocol}//${url.host}`;
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

export async function GET(request: NextRequest, context: RouteContext) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const origin = getOrigin(request);
    const isDraft =
      request.nextUrl.searchParams.get("draft") === "1" ||
      request.nextUrl.searchParams.get("draft") === "true";

    const exportUrl = new URL(`${origin}/afs/${id}/print-studio`);
    exportUrl.searchParams.set("pdf", "1");
    exportUrl.searchParams.set("serverPdf", "1");

    if (isDraft) {
      exportUrl.searchParams.set("draft", "1");
    }

    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

    if (isVercel) {
      const chromium = (await import("@sparticuz/chromium-min")).default;

      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await getVercelChromiumPath(),
        headless: true,
        defaultViewport: {
          width: 1240,
          height: 1754,
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
          width: 1240,
          height: 1754,
        },
      });
    }

    const page = await browser.newPage();

    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(60_000);

    const cookieHeader = request.headers.get("cookie") || "";

    if (cookieHeader) {
      await page.setExtraHTTPHeaders({
        cookie: cookieHeader,
      });
    }

    await page.goto(exportUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || "";
        const stillLoading = /loading print studio data/i.test(text);

        return (
          !stillLoading &&
          Boolean(document.getElementById("print-index")) &&
          Boolean(document.getElementById("print-general-info")) &&
          Boolean(document.getElementById("print-sfp"))
        );
      },
      { timeout: 60_000 },
    );

    await page.evaluate(async () => {
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
    });

    await sleep(300);

    const exportInfo = await page.evaluate(() => {
      /*
        These ids must match the actual Print Studio renderer.
        Do not rename these here unless the Print Studio JSX ids are also renamed.

        Important:
        - General info is print-general-info, not print-general-information.
        - Detailed income is print-detailed-income, not print-detailed-income-statement.
        - Tax is print-tax-computation.
      */
      const printableIds = [
        "print-cover-page",
        "print-index",
        "print-general-info",
        "print-directors-responsibilities",
        "print-directors-report",
        "print-compiler-report",
        "print-sfp",
        "print-soci",
        "print-sce",
        "print-cash-flow",
        "print-accounting-policies",
        "print-notes",
        "print-detailed-income",
        "print-tax-computation",
      ];

      const originalBodyText = document.body?.innerText || "";
      const originalLines = originalBodyText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const entityLine =
        originalLines.find((line) => /\(PTY\)\s+LTD/i.test(line)) ||
        originalLines.find((line) => /LTD/i.test(line)) ||
        "annual-financial-statements";

      const yearEndMatch = originalBodyText.match(/year ended\s+(\d{4}-\d{2}-\d{2})/i);
      const yearEnd = yearEndMatch?.[1] || "";
      const title = [entityLine, "AFS", yearEnd].filter(Boolean).join(" - ");

      const printRoot = document.createElement("main");
      printRoot.id = "afs-pdf-print-root";

      printableIds.forEach((id) => {
        const source = document.getElementById(id);

        if (!source) return;

        const text = source.textContent || "";
        if (!text.trim()) return;

        const clone = source.cloneNode(true) as HTMLElement;
        clone.classList.add("afs-pdf-section");
        printRoot.appendChild(clone);
      });

      if (!printRoot.children.length) {
        throw new Error("No printable AFS sections found.");
      }

      document.documentElement.className = "";
      document.body.className = "";
      document.documentElement.classList.add("afs-server-pdf-html");
      document.body.classList.add("afs-server-pdf-body");

      document.body.innerHTML = "";
      document.body.appendChild(printRoot);

      const style = document.createElement("style");
      style.setAttribute("data-afs-pdf-force-clean", "true");
      style.textContent = `
        @page {
          size: A4;
          margin: 0;
        }

        html.afs-server-pdf-html,
        body.afs-server-pdf-body {
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #111827 !important;
          overflow: visible !important;
          font-family: Arial, Helvetica, sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        #afs-pdf-print-root {
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          display: block !important;
          transform: none !important;
          zoom: 1 !important;
        }

        #afs-pdf-print-root,
        #afs-pdf-print-root * {
          box-sizing: border-box !important;
          transform-origin: top left !important;
          max-width: 100% !important;
        }

        .afs-pdf-section {
          display: block !important;
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          transform: none !important;
          zoom: 1 !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
          overflow: visible !important;
        }

        .afs-pdf-section:not(:last-child) {
          break-after: page !important;
          page-break-after: always !important;
        }

        .afs-pdf-section > article,
        .afs-pdf-section [class*="page"],
        .afs-pdf-section [class*="sheet"],
        .afs-pdf-section [class*="content"],
        .afs-pdf-section [class*="a4"],
        .afs-pdf-section [style*="210mm"] {
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          transform: none !important;
          zoom: 1 !important;
          overflow: visible !important;
        }

        .afs-pdf-section table {
          width: 100% !important;
          max-width: 100% !important;
          border-collapse: collapse !important;
          table-layout: auto !important;
        }

        .afs-pdf-section th,
        .afs-pdf-section td {
          white-space: normal !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
        }

        #print-sfp th,
        #print-sfp td,
        #print-soci th,
        #print-soci td,
        #print-sce th,
        #print-sce td,
        #print-cash-flow th,
        #print-cash-flow td,
        #print-detailed-income th,
        #print-detailed-income td,
        #print-tax-computation th,
        #print-tax-computation td {
          font-size: 11.15px !important;
          line-height: 1.28 !important;
        }

        #print-notes table {
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          table-layout: fixed !important;
        }

        #print-notes th:nth-child(2),
        #print-notes th:nth-child(3),
        #print-notes td:nth-child(2),
        #print-notes td:nth-child(3) {
          width: 25mm !important;
          min-width: 25mm !important;
          max-width: 25mm !important;
          text-align: right !important;
          white-space: nowrap !important;
        }

        #print-general-info table {
          width: 76% !important;
          max-width: 138mm !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          table-layout: fixed !important;
        }

        #print-general-info td {
          padding-top: 3px !important;
          padding-bottom: 3px !important;
          border: 0 !important;
          white-space: normal !important;
          text-align: left !important;
        }

        #print-general-info td:first-child {
          width: 34% !important;
          font-weight: 700 !important;
        }

        #print-general-info td:nth-child(2) {
          width: 66% !important;
          text-align: left !important;
        }

        #afs-pdf-print-root [class*="toolbar"],
        #afs-pdf-print-root [class*="sidebar"],
        #afs-pdf-print-root [class*="options"],
        #afs-pdf-print-root button,
        #afs-pdf-print-root input,
        #afs-pdf-print-root select,
        #afs-pdf-print-root textarea {
          display: none !important;
        }

        img {
          max-width: 100% !important;
        }
      `;
      document.head.appendChild(style);

      document.title = title;

      return {
        title,
        entityName: entityLine,
        yearEnd,
        sectionCount: printRoot.children.length,
      };
    });

    await page.waitForSelector("#afs-pdf-print-root", { timeout: 10_000 });
    await page.emulateMediaType("print");
    await sleep(500);

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
        "X-AFS-PDF-Draft": isDraft ? "true" : "false",
        "X-AFS-PDF-Sections": String(exportInfo?.sectionCount || ""),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "AFS PDF export failed.",
      },
      { status: 500 },
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
