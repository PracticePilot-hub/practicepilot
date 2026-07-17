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

    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(60_000);

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

    await page.goto(exportUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    /*
      The real Print Studio page sets this attribute only after all live
      engagement, TB, settings, notes and overrides have finished loading.
    */
    await page.waitForFunction(
      () =>
        document.body?.getAttribute("data-afs-pdf-ready") === "true" &&
        document
          .getElementById("afs-pagination-ready")
          ?.getAttribute("data-ready") === "true" &&
        !/loading print studio data/i.test(document.body?.innerText || ""),
      { timeout: 60_000 },
    );

    await page.waitForSelector("#print-sfp", {
      visible: true,
      timeout: 60_000,
    });

    await page.emulateMediaType("print");

    const exportInfo = await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready.catch(() => undefined);
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
      const title = [entityLine, "AFS", yearEnd].filter(Boolean).join(" - ");

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

      await Promise.all(
        images.map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }

              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
        ),
      );

      document.title = title;

      return {
        title,
        entityName: entityLine,
        yearEnd,
      };
    });

    await page.waitForFunction(
      () => {
        const style = window.getComputedStyle(document.body);
        return style.display !== "none" && style.visibility !== "hidden";
      },
      { timeout: 10_000 },
    );

    await sleep(900);

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
        "Content-Length": String(pdfBuffer.byteLength),
        "Content-Disposition": `attachment; filename="${finalFilename}"`,
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
      await browser.close();
    }
  }
}
