import { existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import { getSupabaseServer } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  "https://github.com/Sparticuz/chromium/releases/download/v141.0.0/chromium-v141.0.0-pack.x64.tar";

let cachedExecutablePath: string | null = null;
let chromiumDownloadPromise: Promise<string> | null = null;

type ExportDocumentKey =
  | "final-trial-balance"
  | "journals-passed"
  | "lead-sheets-used"
  | "subordination-agreements";

async function getId(context: any) {
  const params = await context?.params;
  return String(params?.id || "");
}

function safeNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: unknown) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value: unknown) {
  const rounded = Math.round(safeNumber(value));

  if (rounded === 0) return "–";

  const absolute = Math.abs(rounded).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  });

  return rounded < 0 ? `(${absolute})` : absolute;
}

function formatSignedMoney(value: unknown) {
  const rounded = Math.round(safeNumber(value));

  if (rounded === 0) return "–";

  return rounded.toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  });
}

function finalTrialBalanceAmount(line: Record<string, any>) {
  if (line.final_afs_balance !== undefined && line.final_afs_balance !== null) {
    return safeNumber(line.final_afs_balance);
  }

  const base =
    line.current_year_balance !== undefined && line.current_year_balance !== null
      ? safeNumber(line.current_year_balance)
      : safeNumber(line.debit) - safeNumber(line.credit);

  return (
    base +
    safeNumber(line.manual_adjustment) +
    safeNumber(line.journal_adjustment) +
    safeNumber(line.reclassification)
  );
}

function safeFilename(value: string) {
  return String(value || "afs-working-file-export")
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/\(pty\)/gi, "pty")
    .replace(/ltd\.?/gi, "ltd")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getLocalChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;

  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(chromePath)) return chromePath;

  const chromeCanaryPath =
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
  if (existsSync(chromeCanaryPath)) return chromeCanaryPath;

  return null;
}

async function getVercelChromiumPath() {
  if (cachedExecutablePath) return cachedExecutablePath;

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


function preliminaryTrialBalanceAmount(line: Record<string, any>) {
  if (line.current_year_balance !== undefined && line.current_year_balance !== null) {
    return safeNumber(line.current_year_balance);
  }

  return safeNumber(line.debit) - safeNumber(line.credit);
}

function manualAdjustmentAmount(line: Record<string, any>) {
  return safeNumber(line.manual_adjustment ?? line.manual_adjustments ?? line.manualAdj);
}

function journalAdjustmentAmount(line: Record<string, any>) {
  return safeNumber(line.journal_adjustment ?? line.journal_adjustments ?? line.journalAdj);
}

function reclassificationAmount(line: Record<string, any>) {
  return safeNumber(line.reclassification ?? line.reclassification_adjustment ?? line.reclass);
}

function reportAnnotationAmount(line: Record<string, any>) {
  return finalTrialBalanceAmount(line);
}

function percentageChangeAmount(current: number, prior: number) {
  const roundedPrior = Math.round(prior);
  const roundedCurrent = Math.round(current);

  if (roundedPrior === 0 && roundedCurrent === 0) return "";
  if (roundedPrior === 0) return "(100)";

  const percent = Math.round(((roundedCurrent - roundedPrior) / Math.abs(roundedPrior)) * 100);
  return `(${percent})`;
}

function leadScheduleReference(line: Record<string, any>) {
  return cleanText(line.lead_schedule_number || line.mapping_code) || "–";
}

function documentTitle(document: ExportDocumentKey) {
  if (document === "journals-passed") return "Journals Passed";
  if (document === "lead-sheets-used") return "Lead Sheets Used";
  if (document === "subordination-agreements") return "Subordination Agreements";
  return "Final Trial Balance";
}

function renderFinalTrialBalance(lines: Record<string, any>[]) {
  const rows = lines
    .map((line) => ({ line, finalAmount: finalTrialBalanceAmount(line) }))
    .filter((row) => Math.round(row.finalAmount) !== 0)
    .sort((a, b) =>
      String(a.line.account_code || "").localeCompare(String(b.line.account_code || "")),
    );

  const totals = rows.reduce(
    (sum, row) => ({
      imported: sum.imported + preliminaryTrialBalanceAmount(row.line),
      journals: sum.journals + journalAdjustmentAmount(row.line),
      reclass: sum.reclass + reclassificationAmount(row.line),
      final: sum.final + row.finalAmount,
      prior: sum.prior + safeNumber(row.line.prior_year_balance),
    }),
    { imported: 0, journals: 0, reclass: 0, final: 0, prior: 0 },
  );

  return `
    <table class="tb-export">
      <thead>
        <tr>
          <th class="code">Account</th>
          <th class="description">Description</th>
          <th class="amount">Imported balance</th>
          <th class="amount">Journal adj.</th>
          <th class="amount">Reclass.</th>
          <th class="amount">Final AFS balance</th>
          <th class="amount">Prior year</th>
          <th class="mapping">Mapping</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const imported = preliminaryTrialBalanceAmount(row.line);
            const journals = journalAdjustmentAmount(row.line);
            const reclass = reclassificationAmount(row.line);
            const prior = safeNumber(row.line.prior_year_balance);
            const description = cleanText(row.line.account_name || row.line.description || "");
            const mapping = cleanText(
              row.line.mapping_label ||
                row.line.mapping_code ||
                row.line.lead_schedule_number ||
                "Unmapped",
            );

            return `
              <tr>
                <td>${escapeHtml(cleanText(row.line.account_code))}</td>
                <td>${escapeHtml(description)}</td>
                <td class="amount">${formatSignedMoney(imported)}</td>
                <td class="amount">${formatSignedMoney(journals)}</td>
                <td class="amount">${formatSignedMoney(reclass)}</td>
                <td class="amount">${formatSignedMoney(row.finalAmount)}</td>
                <td class="amount">${formatSignedMoney(prior)}</td>
                <td>${escapeHtml(mapping)}</td>
              </tr>
            `;
          })
          .join("")}
        <tr class="total">
          <td colspan="2">Total</td>
          <td class="amount">${formatSignedMoney(totals.imported)}</td>
          <td class="amount">${formatSignedMoney(totals.journals)}</td>
          <td class="amount">${formatSignedMoney(totals.reclass)}</td>
          <td class="amount">${formatSignedMoney(totals.final)}</td>
          <td class="amount">${formatSignedMoney(totals.prior)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}

function journalReference(rawJournal: Record<string, any>) {
  const explicit = cleanText(
    rawJournal.journal_reference ?? rawJournal.journalReference ?? rawJournal.reference,
  );

  if (explicit) return explicit;

  const numberValue = cleanText(rawJournal.journal_number ?? rawJournal.number);
  if (!numberValue) return "AJ";
  if (/^AJ/i.test(numberValue)) return numberValue.toUpperCase();

  return `AJ${String(Number(numberValue) || numberValue).padStart(3, "0")}`;
}

function renderJournalsPassed(journals: Record<string, any>[]) {
  if (!journals.length) {
    return `<p class="empty">No posted journals were found in the journal register.</p>`;
  }

  return journals
    .map((journal) => {
      const lines = Array.isArray(journal.lines) ? journal.lines : [];
      const debitTotal =
        journal.debit_total !== undefined && journal.debit_total !== null
          ? safeNumber(journal.debit_total)
          : lines.reduce((sum: number, line: Record<string, any>) => sum + safeNumber(line.debit), 0);
      const creditTotal =
        journal.credit_total !== undefined && journal.credit_total !== null
          ? safeNumber(journal.credit_total)
          : lines.reduce((sum: number, line: Record<string, any>) => sum + safeNumber(line.credit), 0);
      const balanced =
        journal.is_balanced === false ? false : Math.abs(debitTotal - creditTotal) < 0.01;

      return `
        <section class="journal">
          <div class="journalHeader">
            <div>
              <strong>${escapeHtml(journalReference(journal))}</strong>
              <span>${escapeHtml(journal.description || "Adjusting journal")}</span>
            </div>
            <div class="journalMeta">
              <span>${escapeHtml(journal.journal_date || String(journal.posted_at || "").slice(0, 10))}</span>
              <strong>${balanced ? "Balanced" : "Unbalanced"}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Description</th>
                <th>Note</th>
                <th class="amount">Debit</th>
                <th class="amount">Credit</th>
              </tr>
            </thead>
            <tbody>
              ${lines
                .map(
                  (line: Record<string, any>) => `
                    <tr>
                      <td>${escapeHtml(line.account_code)}</td>
                      <td>${escapeHtml(line.account_name)}</td>
                      <td>${escapeHtml(line.note)}</td>
                      <td class="amount">${formatMoney(line.debit)}</td>
                      <td class="amount">${formatMoney(line.credit)}</td>
                    </tr>
                  `,
                )
                .join("")}
              <tr class="total">
                <td colspan="3">Total</td>
                <td class="amount">${formatMoney(debitTotal)}</td>
                <td class="amount">${formatMoney(creditTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      `;
    })
    .join("");
}

function renderLeadSheetsUsed(lines: Record<string, any>[]) {
  const grouped = new Map<string, { title: string; amount: number; count: number }>();

  lines.forEach((line) => {
    const key = cleanText(line.lead_schedule_key);
    if (!key) return;

    const amount = finalTrialBalanceAmount(line);
    if (Math.round(amount) === 0) return;

    const title = cleanText(line.lead_schedule_number)
      ? `${cleanText(line.lead_schedule_number)} · ${cleanText(line.lead_schedule_key).replaceAll("-", " ")}`
      : cleanText(line.lead_schedule_key).replaceAll("-", " ");

    if (!grouped.has(key)) {
      grouped.set(key, { title, amount: 0, count: 0 });
    }

    const item = grouped.get(key);
    if (!item) return;
    item.amount += amount;
    item.count += 1;
  });

  const rows = Array.from(grouped.entries())
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => a.title.localeCompare(b.title));

  if (!rows.length) {
    return `<p class="empty">No lead schedules are currently linked to balances.</p>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Lead sheet</th>
          <th class="amount">Accounts</th>
          <th class="amount">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.title)}</td>
                <td class="amount">${row.count}</td>
                <td class="amount">${formatMoney(row.amount)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderSubordinationAgreements() {
  return `<p class="empty">Subordination agreement generation will be added after the Final Trial Balance and Journals Passed export pages are signed off.</p>`;
}

function renderHtml(args: {
  document: ExportDocumentKey;
  engagement: Record<string, any> | null;
  clientSetup: Record<string, any> | null;
  trialBalanceLines: Record<string, any>[];
  journals: Record<string, any>[];
}) {
  const clientName =
    args.clientSetup?.registered_name || args.engagement?.client_name || "AFS engagement";
  const yearEnd =
    args.clientSetup?.financial_year_end || args.engagement?.financial_year_end || "";
  const title = documentTitle(args.document);

  let body = "";
  if (args.document === "journals-passed") body = renderJournalsPassed(args.journals);
  else if (args.document === "lead-sheets-used") body = renderLeadSheetsUsed(args.trialBalanceLines);
  else if (args.document === "subordination-agreements") body = renderSubordinationAgreements();
  else body = renderFinalTrialBalance(args.trialBalanceLines);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(clientName)} - ${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      font-size: 9.5px;
      line-height: 1.22;
      background: #fff;
    }
    header {
      margin-bottom: 14px;
      border-bottom: 1.2px solid #0f172a;
      padding-bottom: 8px;
    }
    header strong { display: block; font-size: 13px; font-weight: 800; }
    header span { display: block; font-size: 11px; color: #334155; }
    h1 { margin: 0 0 10px; font-size: 16px; line-height: 1.2; }

    table.tb-export {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 8.5px;
      line-height: 1.14;
    }
    table.tb-export th {
      border-bottom: 1.5px solid #111827;
      padding: 2.2px 3px;
      text-align: left;
      font-weight: 800;
      vertical-align: bottom;
    }
    table.tb-export th.amount,
    table.tb-export td.amount,
    table.tb-export th.small,
    table.tb-export td.small {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    table.tb-export th.code { width: 9%; }
    table.tb-export th.description { width: 24%; }
    table.tb-export th.mapping { width: 13%; }
    table.tb-export td {
      border-bottom: 1px solid #e5e7eb;
      padding: 2px 3px;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    table.tb-export tr.total td {
      border-top: 1.5px solid #111827;
      font-weight: 800;
      padding-top: 3px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 10px; }
    th { text-align: left; border-bottom: 1px solid #94a3b8; padding: 5px 4px; font-weight: 800; }
    td { border-bottom: 1px solid #e2e8f0; padding: 4px; vertical-align: top; }
    .amount { text-align: right; white-space: nowrap; }
    .total td, tr.total td { border-top: 1.2px solid #0f172a; border-bottom: 0; font-weight: 800; }
    .empty { color: #475569; margin: 0; }
    .journal { page-break-inside: avoid; break-inside: avoid; margin-bottom: 14px; }
    .journalHeader {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .journalHeader strong { display: block; font-size: 12px; }
    .journalHeader span { display: block; color: #334155; }
    .journalMeta { text-align: right; }
  </style>
</head>
<body>
  <header>
    <strong>${escapeHtml(clientName)}</strong>
    <span>Financial year end ${escapeHtml(yearEnd)}</span>
  </header>
  <h1>${escapeHtml(title)}</h1>
  ${body}
</body>
</html>`;
}

export async function GET(request: NextRequest, context: any) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const engagementId = await getId(context);

    if (!engagementId) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const requestedDocument = cleanText(
      request.nextUrl.searchParams.get("document") || "final-trial-balance",
    ) as ExportDocumentKey;

    const document: ExportDocumentKey = [
      "final-trial-balance",
      "journals-passed",
      "lead-sheets-used",
      "subordination-agreements",
    ].includes(requestedDocument)
      ? requestedDocument
      : "final-trial-balance";

    const supabase = getSupabaseServer();

    const { data: engagement, error: engagementError } = await supabase
      .from("afs_engagements")
      .select("*")
      .eq("id", engagementId)
      .maybeSingle();

    if (engagementError) throw engagementError;

    const { data: clientSetup } = await supabase
      .from("afs_client_setup")
      .select("*")
      .eq("engagement_id", engagementId)
      .maybeSingle();

    const { data: trialBalanceLines, error: tbError } = await supabase
      .from("afs_trial_balance_lines")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("account_code", { ascending: true });

    if (tbError) throw tbError;

    const { data: journals, error: journalsError } = await supabase
      .from("afs_adjusting_journals")
      .select("*, lines:afs_adjusting_journal_lines(*)")
      .eq("engagement_id", engagementId)
      .order("journal_date", { ascending: true });

    if (journalsError) throw journalsError;

    const html = renderHtml({
      document,
      engagement: engagement || null,
      clientSetup: clientSetup || null,
      trialBalanceLines: trialBalanceLines || [],
      journals: journals || [],
    });

    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

    if (isVercel) {
      const chromium = (await import("@sparticuz/chromium-min")).default;
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await getVercelChromiumPath(),
        headless: true,
      });
    } else {
      const executablePath = getLocalChromePath();
      if (!executablePath) throw new Error("Local Google Chrome executable was not found.");

      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath,
        headless: true,
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    await page.emulateMediaType("print");

    const pdfBytes = await page.pdf({
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

    const clientName = clientSetup?.registered_name || engagement?.client_name || "afs";
    const fileName = `${safeFilename(`${clientName}-${documentTitle(document)}`)}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Working-file PDF export failed.",
      },
      { status: 500 },
    );
  } finally {
    if (browser) await browser.close();
  }
}
