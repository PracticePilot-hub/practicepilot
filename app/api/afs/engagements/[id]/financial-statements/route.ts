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

async function smallDelay(ms: number) {
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
    const url = `${origin}/afs/${id}?afsPdf=1&profile=${profile}`;

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
      ],
      defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 1 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    }

    await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForSelector(".afs-print-root", { timeout: 120000 });
    await page.emulateMediaType("screen");

    await page.addStyleTag({
      content: `
        @page { size: A4; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
        body > *:not(.afs-pdf-only-root) { visibility: hidden !important; }
        .afs-pdf-only-root, .afs-pdf-only-root * { visibility: visible !important; }
        .afs-pdf-only-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 210mm !important; background: #ffffff !important; }
        .afs-print-root { width: 210mm !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
        .afs-print-page { width: 210mm !important; min-height: 297mm !important; max-height: 297mm !important; margin: 0 !important; box-shadow: none !important; border: 0 !important; break-after: page !important; page-break-after: always !important; overflow: hidden !important; }
        .afs-print-page:last-child { break-after: auto !important; page-break-after: auto !important; }
        .afs-screen-only, .afs-print-hide, .print-hide, button, .statementModeToolbar, .inlineEditableToolbar, .compactNoteTabBar, .noteEditorActions, .print-edit-col { display: none !important; }
      `,
    });

    await page.evaluate((pdfProfile: string) => {
      const source = document.querySelector(".afs-print-root");
      if (!source) return;
      const root = document.createElement("div");
      root.className = "afs-pdf-only-root";
      const clone = source.cloneNode(true) as HTMLElement;
      clone.classList.remove("afs-print-draft", "afs-print-final");
      clone.classList.add(pdfProfile === "draft" ? "afs-print-draft" : "afs-print-final");
      root.appendChild(clone);
      document.body.appendChild(root);
    }, profile);

    await smallDelay(500);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return new NextResponse(pdf, {
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
  