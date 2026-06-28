import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dynamicImport(specifier: string) {
  const importer = new Function("s", "return import(s)") as (s: string) => Promise<any>;
  return importer(specifier);
}

async function getIdFromContext(context: any) {
  const params = await context?.params;
  const id = params?.id;

  if (!id || typeof id !== "string") {
    throw new Error("Missing AFS engagement id.");
  }

  return id;
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getChromium() {
  try {
    const mod = await dynamicImport("@sparticuz/chromium");
    return mod.default || mod;
  } catch {
    return null;
  }
}

async function getExecutablePath(chromium: any) {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;

  const localMacChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (process.platform === "darwin") return localMacChrome;

  if (chromium?.executablePath) return await chromium.executablePath();
  return undefined;
}

export async function GET(req: NextRequest, context: any) {
  let browser: any = null;

  try {
    const id = await getIdFromContext(context);
    const profile = req.nextUrl.searchParams.get("profile") === "final" ? "final" : "draft";
    const origin = req.nextUrl.origin;

    // Important: do not PDF the app shell. We load the normal AFS screen only to let
    // PracticePilot calculate the current statements, then clone ONLY .afs-print-root
    // into a clean PDF host and print that host.
    const url = `${origin}/afs/${id}?afsPdf=1&profile=${profile}&export=1`;

    const puppeteerMod = await dynamicImport("puppeteer-core");
    const puppeteer = puppeteerMod.default || puppeteerMod;
    const chromium = await getChromium();
    const executablePath = await getExecutablePath(chromium);

    browser = await puppeteer.launch({
      args: [
        ...((chromium?.args || []) as string[]),
        "--hide-scrollbars",
        "--disable-web-security",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
      ],
      defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    page.setDefaultNavigationTimeout(180000);

    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    }

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector(".afs-print-root", { timeout: 180000 });
    await page.emulateMediaType("screen");
    await delay(900);

    await page.addStyleTag({
      content: `
        @page { size: A4; margin: 0; }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 210mm !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body > *:not(.afs-pdf-export-host) {
          display: none !important;
          visibility: hidden !important;
        }

        .afs-pdf-export-host,
        .afs-pdf-export-host * {
          visibility: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }

        .afs-pdf-export-host {
          display: block !important;
          position: static !important;
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
        }

        .afs-pdf-export-host .afs-print-root {
          display: block !important;
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
        }

        .afs-pdf-export-host .afs-print-page {
          display: block !important;
          position: relative !important;
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 !important;
          padding: 12mm 18mm 16mm 18mm !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          border: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          break-after: page !important;
          page-break-after: always !important;
        }

        .afs-pdf-export-host .afs-print-page:last-child {
          break-after: auto !important;
          page-break-after: auto !important;
        }

        .afs-pdf-export-host .afs-screen-only,
        .afs-pdf-export-host .afs-print-hide,
        .afs-pdf-export-host .print-hide,
        .afs-pdf-export-host button,
        .afs-pdf-export-host input,
        .afs-pdf-export-host textarea,
        .afs-pdf-export-host select,
        .afs-pdf-export-host .statementModeToolbar,
        .afs-pdf-export-host .inlineEditableToolbar,
        .afs-pdf-export-host .compactNoteTabBar,
        .afs-pdf-export-host .noteEditorActions,
        .afs-pdf-export-host .print-edit-col {
          display: none !important;
        }

        .afs-pdf-export-host .afs-draft-watermark {
          display: ${profile === "draft" ? "block" : "none"} !important;
        }
      `,
    });

    const cloned = await page.evaluate((pdfProfile: string) => {
      const source = document.querySelector(".afs-print-root") as HTMLElement | null;
      if (!source) return false;

      const existingHost = document.querySelector(".afs-pdf-export-host");
      if (existingHost) existingHost.remove();

      const host = document.createElement("div");
      host.className = "afs-pdf-export-host";

      const clone = source.cloneNode(true) as HTMLElement;
      clone.classList.remove("afs-print-draft", "afs-print-final");
      clone.classList.add(pdfProfile === "draft" ? "afs-print-draft" : "afs-print-final");

      // Strip editable controls from the cloned print version only.
      clone
        .querySelectorAll("button,input,textarea,select,.afs-screen-only,.afs-print-hide,.print-hide,.print-edit-col")
        .forEach((node) => node.remove());

      host.appendChild(clone);
      document.body.innerHTML = "";
      document.body.appendChild(host);
      window.scrollTo(0, 0);
      return true;
    }, profile);

    if (!cloned) {
      throw new Error("Could not find the AFS print document on the page.");
    }

    await delay(300);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      timeout: 180000,
    });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="afs-${profile}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate AFS PDF." },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
