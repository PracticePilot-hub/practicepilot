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
  | "final-tb-pilot-view"
  | "final-tb-passenger-view"
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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatWhole(value: unknown) {
  const rounded = Math.round(safeNumber(value));
  if (rounded === 0) return "–";
  return rounded.toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

function formatCents(value: unknown) {
  const amount = safeNumber(value);
  if (Math.abs(amount) < 0.005) return "–";
  return amount.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function documentTitle(document: ExportDocumentKey) {
  if (document === "final-tb-pilot-view" || document === "final-trial-balance") {
    return "Final Trial Balance - Working File";
  }
  if (document === "final-tb-passenger-view") return "Final Trial Balance";
  if (document === "journals-passed") return "Journals Passed";
  if (document === "lead-sheets-used") return "Lead Sheets Used";
  if (document === "subordination-agreements") return "Subordination Agreements";
  return "Final Trial Balance - Working File";
}

function accountKey(value: unknown) {
  return cleanText(value).toLowerCase();
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

function journalLines(rawJournal: Record<string, any>) {
  return Array.isArray(rawJournal.lines) ? rawJournal.lines : [];
}

function postedJournalsOnly(journals: Record<string, any>[]) {
  return journals.filter((journal) => cleanText(journal.status || "posted").toLowerCase() !== "draft");
}

function buildJournalAdjustmentMap(journals: Record<string, any>[]) {
  const byCode = new Map<string, number>();
  const byName = new Map<string, number>();

  postedJournalsOnly(journals).forEach((journal) => {
    journalLines(journal).forEach((line: Record<string, any>) => {
      const amount = safeNumber(line.debit) - safeNumber(line.credit);
      const code = accountKey(line.account_code);
      const name = accountKey(line.account_name);

      if (code) byCode.set(code, (byCode.get(code) || 0) + amount);
      if (name) byName.set(name, (byName.get(name) || 0) + amount);
    });
  });

  return { byCode, byName };
}

function manualAdjustmentAmount(line: Record<string, any>) {
  return safeNumber(line.manual_adjustment ?? line.manual_adjustments ?? line.manualAdj);
}

function reclassificationAmount(line: Record<string, any>) {
  return safeNumber(line.reclassification ?? line.reclassification_adjustment ?? line.reclass);
}

function preliminaryAmountFromTbLine(line: Record<string, any>) {
  const explicit =
    line.imported_balance ??
    line.source_balance ??
    line.original_balance ??
    line.original_current_year_balance ??
    line.imported_current_year_balance ??
    line.current_year_balance;

  if (explicit !== undefined && explicit !== null) return safeNumber(explicit);

  return safeNumber(line.debit) - safeNumber(line.credit);
}

function journalAmountForLine(line: Record<string, any>, journalMap: ReturnType<typeof buildJournalAdjustmentMap>) {
  const explicit =
    line.journal_adjustment ?? line.journal_adjustments ?? line.journalAdj ?? line.journal_amount;

  if (explicit !== undefined && explicit !== null) return safeNumber(explicit);

  const code = accountKey(line.account_code);
  const name = accountKey(line.account_name || line.description);

  if (code && journalMap.byCode.has(code)) return safeNumber(journalMap.byCode.get(code));
  if (name && journalMap.byName.has(name)) return safeNumber(journalMap.byName.get(name));

  return 0;
}

function finalAmountForLine(
  importedAmount: number,
  manualAmount: number,
  journalAmount: number,
  reclassAmount: number,
) {
  return importedAmount + manualAmount + journalAmount + reclassAmount;
}

function mappingLabel(line: Record<string, any>) {
  return cleanText(
    line.mapping_label || line.mapping_code || line.lead_schedule_number || line.mapping_category || "Unmapped",
  );
}

function renderFinalTrialBalancePilotView(lines: Record<string, any>[], journals: Record<string, any>[]) {
  const journalMap = buildJournalAdjustmentMap(journals);

  const rows = lines
    .map((line) => {
      const imported = preliminaryAmountFromTbLine(line);
      const manual = manualAdjustmentAmount(line);
      const journal = journalAmountForLine(line, journalMap);
      const reclass = reclassificationAmount(line);
      const finalAmount = finalAmountForLine(imported, manual, journal, reclass);
      const prior = safeNumber(line.prior_year_balance);

      return { line, imported, manual, journal, reclass, finalAmount, prior };
    })
    .filter(
      (row) =>
        Math.abs(row.imported) >= 0.005 ||
        Math.abs(row.manual) >= 0.005 ||
        Math.abs(row.journal) >= 0.005 ||
        Math.abs(row.reclass) >= 0.005 ||
        Math.abs(row.finalAmount) >= 0.005 ||
        Math.abs(row.prior) >= 0.005,
    )
    .sort((a, b) =>
      cleanText(a.line.account_code).localeCompare(cleanText(b.line.account_code), undefined, {
        numeric: true,
      }),
    );

  const totals = rows.reduce(
    (sum, row) => ({
      imported: sum.imported + row.imported,
      manual: sum.manual + row.manual,
      journal: sum.journal + row.journal,
      reclass: sum.reclass + row.reclass,
      final: sum.final + row.finalAmount,
      prior: sum.prior + row.prior,
    }),
    { imported: 0, manual: 0, journal: 0, reclass: 0, final: 0, prior: 0 },
  );

  return `
    <table class="tb-export">
      <thead>
        <tr>
          <th class="code">Account</th>
          <th class="description">Description</th>
          <th class="amount">Imported balance</th>
          <th class="amount">Manual adj.</th>
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
            const description = cleanText(row.line.account_name || row.line.description || "");

            return `
              <tr>
                <td>${escapeHtml(row.line.account_code)}</td>
                <td>${escapeHtml(description)}</td>
                <td class="amount">${formatCents(row.imported)}</td>
                <td class="amount">${formatCents(row.manual)}</td>
                <td class="amount">${formatCents(row.journal)}</td>
                <td class="amount">${formatCents(row.reclass)}</td>
                <td class="amount">${formatCents(row.finalAmount)}</td>
                <td class="amount">${formatCents(row.prior)}</td>
                <td>${escapeHtml(mappingLabel(row.line))}</td>
              </tr>
            `;
          })
          .join("")}
        <tr class="total">
          <td colspan="2">Total</td>
          <td class="amount">${formatCents(totals.imported)}</td>
          <td class="amount">${formatCents(totals.manual)}</td>
          <td class="amount">${formatCents(totals.journal)}</td>
          <td class="amount">${formatCents(totals.reclass)}</td>
          <td class="amount">${formatCents(totals.final)}</td>
          <td class="amount">${formatCents(totals.prior)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}


function renderFinalTrialBalancePassengerView(lines: Record<string, any>[], journals: Record<string, any>[]) {
  const journalMap = buildJournalAdjustmentMap(journals);

  const rows = lines
    .map((line) => {
      const imported = preliminaryAmountFromTbLine(line);
      const manual = manualAdjustmentAmount(line);
      const journal = journalAmountForLine(line, journalMap);
      const reclass = reclassificationAmount(line);
      const finalAmount = finalAmountForLine(imported, manual, journal, reclass);
      const prior = safeNumber(line.prior_year_balance);
      return { line, finalAmount, prior };
    })
    .filter(
      (row) =>
        Math.abs(row.finalAmount) >= 0.005 || Math.abs(row.prior) >= 0.005,
    )
    .sort((a, b) =>
      cleanText(a.line.account_code).localeCompare(cleanText(b.line.account_code), undefined, {
        numeric: true,
      }),
    );

  const totals = rows.reduce(
    (sum, row) => ({
      final: sum.final + row.finalAmount,
      prior: sum.prior + row.prior,
    }),
    { final: 0, prior: 0 },
  );

  return `
    <table class="tb-export tb-passenger">
      <thead>
        <tr>
          <th class="code">Account</th>
          <th class="description">Description</th>
          <th class="amount">Final current year</th>
          <th class="amount">Final prior year</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const description = cleanText(row.line.account_name || row.line.description || "");

            return `
              <tr>
                <td>${escapeHtml(row.line.account_code)}</td>
                <td>${escapeHtml(description)}</td>
                <td class="amount">${formatCents(row.finalAmount)}</td>
                <td class="amount">${formatCents(row.prior)}</td>
              </tr>
            `;
          })
          .join("")}
        <tr class="total">
          <td colspan="2">Total</td>
          <td class="amount">${formatCents(totals.final)}</td>
          <td class="amount">${formatCents(totals.prior)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderJournalsPassed(journals: Record<string, any>[]) {
  const postedJournals = postedJournalsOnly(journals);

  if (!postedJournals.length) {
    return `<p class="empty">No posted journals were found in the journal register.</p>`;
  }

  return `
    <div class="journal-list">
      ${postedJournals
        .map((journal) => {
          const lines = journalLines(journal);
          const debitTotal = lines.reduce(
            (sum: number, line: Record<string, any>) => sum + safeNumber(line.debit),
            0,
          );
          const creditTotal = lines.reduce(
            (sum: number, line: Record<string, any>) => sum + safeNumber(line.credit),
            0,
          );
          const balanced = journal.is_balanced === false ? false : Math.abs(debitTotal - creditTotal) < 0.01;
          const dateText = cleanText(journal.journal_date || String(journal.posted_at || "").slice(0, 10));
          const reference = journalReference(journal);
          const description = cleanText(journal.description || "Adjusting journal");

          return `
            <section class="journal-block">
              <div class="journal-heading">
                <div>
                  <strong>${escapeHtml(reference)}</strong>
                  <span>${escapeHtml(description)}</span>
                </div>
                <div class="journal-meta">
                  <span>${escapeHtml(dateText || "No date")}</span>
                  <strong class="${balanced ? "balanced" : "unbalanced"}">${balanced ? "Balanced" : "Unbalanced"}</strong>
                </div>
              </div>
              <table class="journal-table">
                <thead>
                  <tr>
                    <th class="code">Account</th>
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
                          <td class="amount">${formatWhole(line.debit)}</td>
                          <td class="amount">${formatWhole(line.credit)}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                  <tr class="total">
                    <td colspan="3">Total</td>
                    <td class="amount">${formatWhole(debitTotal)}</td>
                    <td class="amount">${formatWhole(creditTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderLeadSheetsUsed(lines: Record<string, any>[], journals: Record<string, any>[]) {
  const journalMap = buildJournalAdjustmentMap(journals);
  const grouped = new Map<string, { title: string; amount: number; count: number }>();

  lines.forEach((line) => {
    const key = cleanText(line.lead_schedule_key);
    if (!key) return;

    const imported = preliminaryAmountFromTbLine(line);
    const manual = manualAdjustmentAmount(line);
    const journal = journalAmountForLine(line, journalMap);
    const reclass = reclassificationAmount(line);
    const amount = finalAmountForLine(imported, manual, journal, reclass);
    if (Math.abs(amount) < 0.005) return;

    const title = cleanText(line.lead_schedule_number)
      ? `${cleanText(line.lead_schedule_number)} · ${key.replaceAll("-", " ")}`
      : key.replaceAll("-", " ");

    if (!grouped.has(key)) grouped.set(key, { title, amount: 0, count: 0 });

    const item = grouped.get(key);
    if (!item) return;
    item.amount += amount;
    item.count += 1;
  });

  const rows = Array.from(grouped.entries())
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => a.title.localeCompare(b.title));

  if (!rows.length) return `<p class="empty">No lead schedules are currently linked to balances.</p>`;

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
                <td class="amount">${formatWhole(row.amount)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderSubordinationAgreements() {
  return `<p class="empty">Subordination agreements will be generated from selected shareholder / director loan balances after the TB and journal pack are finalised.</p>`;
}

function renderHtml(args: {
  document: ExportDocumentKey;
  engagement: Record<string, any> | null;
  clientSetup: Record<string, any> | null;
  trialBalanceLines: Record<string, any>[];
  journals: Record<string, any>[];
}) {
  const clientName = args.clientSetup?.registered_name || args.engagement?.client_name || "AFS engagement";
  const yearEnd = args.clientSetup?.financial_year_end || args.engagement?.financial_year_end || "";
  const title = documentTitle(args.document);
  const isPilotTb =
    args.document === "final-tb-pilot-view" ||
    args.document === "final-trial-balance";
  const isPassengerTb = args.document === "final-tb-passenger-view";
  const pageCss = isPilotTb ? "A4 landscape" : "A4 portrait";
  const bodyClass = isPilotTb ? "tbLandscape" : isPassengerTb ? "tbPassenger" : "normalDocument";

  let body = "";
  if (args.document === "journals-passed") body = renderJournalsPassed(args.journals);
  else if (args.document === "lead-sheets-used") body = renderLeadSheetsUsed(args.trialBalanceLines, args.journals);
  else if (args.document === "subordination-agreements") body = renderSubordinationAgreements();
  else if (args.document === "final-tb-passenger-view") {
    body = renderFinalTrialBalancePassengerView(args.trialBalanceLines, args.journals);
  } else {
    body = renderFinalTrialBalancePilotView(args.trialBalanceLines, args.journals);
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(clientName)} - ${escapeHtml(title)}</title>
  <style>
    @page { size: ${pageCss}; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif;
      color: #0f172a;
      font-size: 9.5px;
      line-height: 1.2;
      background: #fff;
    }
    header {
      margin-bottom: 12px;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 7px;
    }
    header strong { display: block; font-size: 13px; font-weight: 800; }
    header span { display: block; font-size: 11px; color: #334155; }
    h1 { margin: 0 0 10px; font-size: 17px; line-height: 1.15; font-weight: 850; }
    table { width: 100%; border-collapse: collapse; }
    th {
      padding: 4px 5px;
      border-bottom: 1.4px solid #0f172a;
      font-size: 8.6px;
      font-weight: 850;
      text-align: left;
      white-space: nowrap;
    }
    td {
      padding: 3px 5px;
      border-bottom: 1px solid #d9e0ea;
      vertical-align: top;
      font-variant-numeric: tabular-nums;
    }
    .amount { text-align: right; white-space: nowrap; }
    .code { width: 76px; white-space: nowrap; }
    .description { width: 210px; }
    .mapping { width: 170px; }
    tr.total td {
      border-top: 1.4px solid #0f172a;
      border-bottom: 0;
      font-weight: 850;
      padding-top: 5px;
    }
    .tbLandscape { font-size: 8.4px; line-height: 1.08; }
    .tbLandscape header { margin-bottom: 8px; padding-bottom: 6px; }
    .tbLandscape h1 { font-size: 15px; margin-bottom: 7px; }
    .tbLandscape th { font-size: 7.6px; padding: 2.4px 4px; }
    .tbLandscape td { padding: 1.9px 4px; }
    .tb-export .description { width: 190px; }
    .tb-export .mapping { width: 180px; }
    .empty { color: #475569; font-size: 12px; }
    .journal-block {
      break-inside: avoid;
      margin: 0 0 16px;
      padding: 0;
    }
    .journal-heading {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      padding: 4px 0 5px;
      border-bottom: 1.2px solid #0f172a;
    }
    .journal-heading strong { display: block; font-size: 12px; font-weight: 850; }
    .journal-heading span { display: block; font-size: 9.5px; color: #334155; margin-top: 1px; }
    .journal-meta { text-align: right; min-width: 90px; }
    .journal-meta .balanced { color: #166534; }
    .journal-meta .unbalanced { color: #991b1b; }
    .journal-table { margin-top: 0; }
    .journal-table th { font-size: 8.5px; padding: 3px 4px; }
    .journal-table td { font-size: 8.7px; padding: 3px 4px; }
  </style>
</head>
<body class="${bodyClass}">
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
      request.nextUrl.searchParams.get("document") || "final-tb-pilot-view",
    ) as ExportDocumentKey;

    const document: ExportDocumentKey = [
      "final-tb-pilot-view",
      "final-tb-passenger-view",
      "final-trial-balance",
      "journals-passed",
      "lead-sheets-used",
      "subordination-agreements",
    ].includes(requestedDocument)
      ? requestedDocument
      : "final-tb-pilot-view";

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
        defaultViewport: { width: 1600, height: 1000 },
      });
    } else {
      const localChromePath = getLocalChromePath();
      if (!localChromePath) throw new Error("Local Google Chrome executable was not found.");

      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: localChromePath,
        headless: true,
        defaultViewport: { width: 1600, height: 1000 },
      });
    }

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(60_000);

    await page.setContent(html, {
      waitUntil: "load",
      timeout: 60_000,
    });

    await page.emulateMediaType("print");

    const pdfBytes = await page.pdf({
      format: "A4",
      landscape: document === "final-trial-balance",
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
