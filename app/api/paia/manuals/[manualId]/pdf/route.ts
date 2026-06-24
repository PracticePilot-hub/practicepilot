// Path: app/api/paia/manuals/[manualId]/pdf/route.ts

import { existsSync } from "fs";
import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    manualId: string;
  }>;
};

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

async function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.platform === "darwin") {
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
  }

  return await chromium.executablePath();
}

export async function GET(request: Request, context: RouteContext) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const { manualId } = await context.params;
    const origin = getOrigin(request);

    const exportUrl = `${origin}/api/paia/manuals/${manualId}/export`;

    const isLocalMac = process.platform === "darwin";

    browser = await puppeteer.launch({
      args: isLocalMac
        ? ["--no-sandbox", "--disable-setuid-sandbox"]
        : chromium.args,
      executablePath: await getExecutablePath(),
      headless: true,
      defaultViewport: {
        width: 1280,
        height: 1800,
      },
    });

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