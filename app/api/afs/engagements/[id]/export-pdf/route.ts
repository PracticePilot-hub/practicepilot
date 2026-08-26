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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function safeFilename(value: string) {
  const cleaned = String(value || "AFS")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();

  return cleaned || "AFS";
}

function formatYearEndMonthYear(value: string) {
  const clean = String(value || "").trim();

  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);

    if (month >= 1 && month <= 12) {
      return new Intl.DateTimeFormat("en-ZA", {
        month: "long",
        year: "numeric",
      }).format(new Date(year, month - 1, 1));
    }
  }

  const longDateMatch = clean.match(
    /^(?:\d{1,2}\s+)?([A-Za-z]+)\s+(\d{4})$/,
  );

  if (longDateMatch) {
    return `${longDateMatch[1]} ${longDateMatch[2]}`;
  }

  return clean;
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

    /*
      IMPORTANT:
      Export the actual Print Studio page.
      There is no separate export renderer and no duplicated AFS data.
    */
    const exportUrl = new URL(`${origin}/afs/${id}/print-studio`);
    exportUrl.searchParams.set("pdf", "1");

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
          deviceScaleFactor: 1,
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
          deviceScaleFactor: 1,
        },
      });
    }

    const page = await browser.newPage();

    page.setDefaultNavigationTimeout(25_000);
    page.setDefaultTimeout(25_000);

    const cookieHeader = request.headers.get("cookie") || "";

    if (cookieHeader) {
      await page.setExtraHTTPHeaders({
        cookie: cookieHeader,
      });
    }

    const encodedAuthStorage =
      request.headers.get("x-afs-auth-storage") || "";

    if (encodedAuthStorage) {
      let authStorage: Record<string, string> = {};

      try {
        const decoded = Buffer.from(encodedAuthStorage, "base64").toString("utf8");
        const parsed = JSON.parse(decoded);

        if (parsed && typeof parsed === "object") {
          authStorage = parsed;
        }
      } catch {
        authStorage = {};
      }

      await page.evaluateOnNewDocument((entries) => {
        try {
          Object.entries(entries || {}).forEach(([key, value]) => {
            window.localStorage.setItem(key, String(value));
          });
        } catch {
          // The Print Studio page still loads without saved browser auth.
        }
      }, authStorage);
    }

    await withTimeout(
      page.goto(exportUrl.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      }),
      27_000,
      "The Print Studio page did not open in time.",
    );

    /*
      Wait briefly for the normal React readiness signals. Pagination already
      has its own five-second fallback on the page, so the export route must
      never wait indefinitely for a perfect measurement state.
    */
    try {
      await page.waitForFunction(
        () =>
          document.body?.getAttribute("data-afs-pdf-ready") === "true" &&
          document
            .getElementById("afs-pagination-ready")
            ?.getAttribute("data-ready") === "true" &&
          !/loading print studio data/i.test(document.body?.innerText || ""),
        { timeout: 15_000 },
      );
    } catch {
      /*
        Continue with the last rendered stable layout. The SFP selector below
        is the hard minimum requirement for a valid AFS export.
      */
    }

    await page.waitForSelector("#print-sfp", {
      visible: true,
      timeout: 12_000,
    });

    await page.emulateMediaType("print");

    const exportInfo = await withTimeout(page.evaluate(async () => {
      if (document.fonts?.ready) {
        await Promise.race([
          document.fonts.ready.catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      }

      const bodyText = document.body?.innerText || "";
      const lines = bodyText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const entityLine =
        lines.find((line) => /\(PTY\)\s+LTD/i.test(line)) ||
        lines.find((line) => /\bLTD\b/i.test(line)) ||
        "annual-financial-statements";

      const yearEndMatch =
        bodyText.match(/financial year end\s+([^\n]+)/i) ||
        bodyText.match(/year ended\s+([^\n]+)/i);

      const yearEnd = String(yearEndMatch?.[1] || "").trim();
      const title = [entityLine, "AFS", yearEnd].filter(Boolean).join(" _ ");

      /*
        Keep the exact rendered Print Studio report pages, but physically remove
        the entire PracticePilot application shell before Chromium prints.
        Existing stylesheets remain in <head>, so the cloned report retains its
        real Print Studio appearance and live content.
      */
      const sfpPage = document.getElementById("print-sfp");

      if (!sfpPage) {
        throw new Error("The rendered Statement of Financial Position was not found.");
      }

      /*
        Start at the real SFP node and walk upward until we reach the common
        container that also holds the other rendered report sections.
        This avoids relying on CSS-module class names.
      */
      let pageStack: HTMLElement | null = sfpPage.parentElement;

      while (
        pageStack?.parentElement &&
        !pageStack.querySelector("#print-cover-page") &&
        !pageStack.querySelector("#print-index") &&
        !pageStack.querySelector("#print-general-info")
      ) {
        pageStack = pageStack.parentElement;
      }

      if (!pageStack) {
        throw new Error("The rendered Print Studio report container was not found.");
      }

      const reportClone = pageStack.cloneNode(true) as HTMLElement;

      document.body.replaceChildren(reportClone);
      document.body.setAttribute("data-afs-pdf-mode", "true");

      Object.assign(document.documentElement.style, {
        margin: "0",
        padding: "0",
        width: "210mm",
        background: "#ffffff",
      });

      Object.assign(document.body.style, {
        margin: "0",
        padding: "0",
        width: "210mm",
        minWidth: "210mm",
        background: "#ffffff",
        overflow: "visible",
      });

      Object.assign(reportClone.style, {
        width: "210mm",
        margin: "0",
        padding: "0",
        transform: "none",
        transformOrigin: "top left",
      });

      /*
        Pagination and continuation headings are owned by the React Print Studio.
        The export route must not insert, split or move report content.
      */

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const images = Array.from(document.images);

      await Promise.race([
        Promise.all(
          images.map(
            (image) =>
              new Promise<void>((resolve) => {
                if (image.complete) {
                  resolve();
                  return;
                }

                const finish = () => resolve();
                image.addEventListener("load", finish, { once: true });
                image.addEventListener("error", finish, { once: true });
                setTimeout(finish, 2000);
              }),
          ),
        ),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      document.title = title;

      return {
        title,
        entityName: entityLine,
        yearEnd,
      };
    }), 12_000, "The rendered report could not be prepared for printing in time.");

    await page.waitForFunction(
      () => {
        const style = window.getComputedStyle(document.body);
        return style.display !== "none" && style.visibility !== "hidden";
      },
      { timeout: 5_000 },
    );

    await sleep(350);

    const pdfBytes = await withTimeout(
      page.pdf({
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
      }),
      15_000,
      "Chromium did not finish generating the PDF in time.",
    );

    const pdfBuffer = Buffer.from(pdfBytes);

    const entityName = cleanTitle(
      exportInfo?.entityName || "Annual Financial Statements",
    );
    const period = formatYearEndMonthYear(exportInfo?.yearEnd || "");
    const finalTitle = [entityName, "AFS", period]
      .filter(Boolean)
      .join(" _ ");
    const finalFilename = `${safeFilename(finalTitle)}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.byteLength),
        "Content-Disposition": `attachment; filename="${finalFilename}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`,
        "Cache-Control": "no-store, max-age=0",
        "X-AFS-PDF-Title": finalTitle,
        "X-AFS-PDF-Draft": isDraft ? "true" : "false",
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
      try {
        await withTimeout(
          browser.close(),
          3000,
          "Chromium did not close cleanly.",
        );
      } catch {
        try {
          browser.process()?.kill("SIGKILL");
        } catch {
          // The response has already been returned or failed safely.
        }
      }
    }
  }
}
