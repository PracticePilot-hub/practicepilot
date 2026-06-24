// Path: app/api/paia/manuals/[manualId]/pdf/route.ts

import { existsSync } from "fs";
import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    manualId: string;
  }>;
};

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  "https://github.com/Sparticuz/chromium/releases/download/v141.0.0/chromium-v141.0.0-pack.tar";

let cachedExecutablePath: string | null = null;
let chromiumDownloadPromise: Promise<string> | null = null;

function safeFilename(value: string) {
  return String(value || "PAIA Manual")
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function getOrigin(request: Request) {
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

  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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

export async function GET(request: Request, context: RouteContext) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const { manualId } = await context.params;
    const origin = getOrigin(request);
    const exportUrl = `${origin}/api/paia/manuals/${manualId}/export`;

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

    await page.goto(exportUrl, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });

    await page.emulateMediaType("print");

    const title = await page.title();
    const filename = safeFilename(title || "PAIA Manual");

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

    return new Response(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "Failed to generate PAIA PDF.",
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}