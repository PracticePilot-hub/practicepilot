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
  return cleanText(value)
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[<>:"/\|?*]+/g, " ")
    .replace(/[-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  const grouped = new Map<
    string,
    {
      key: string;
      title: string;
      total: number;
      priorTotal: number;
      rows: {
        accountCode: string;
        accountName: string;
        mapping: string;
        finalAmount: number;
        prior: number;
      }[];
    }
  >();

  lines.forEach((line) => {
    const key = cleanText(line.lead_schedule_key);
    if (!key) return;

    const imported = preliminaryAmountFromTbLine(line);
    const manual = manualAdjustmentAmount(line);
    const journal = journalAmountForLine(line, journalMap);
    const reclass = reclassificationAmount(line);
    const finalAmount = finalAmountForLine(imported, manual, journal, reclass);
    const prior = safeNumber(line.prior_year_balance);

    if (Math.abs(finalAmount) < 0.005 && Math.abs(prior) < 0.005) return;

    const title = cleanText(line.lead_schedule_number)
      ? `${cleanText(line.lead_schedule_number)} · ${key.replaceAll("-", " ")}`
      : key.replaceAll("-", " ");

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        title,
        total: 0,
        priorTotal: 0,
        rows: [],
      });
    }

    const item = grouped.get(key);
    if (!item) return;

    item.rows.push({
      accountCode: cleanText(line.account_code),
      accountName: cleanText(line.account_name || line.description),
      mapping: mappingLabel(line),
      finalAmount,
      prior,
    });
    item.total += finalAmount;
    item.priorTotal += prior;
  });

  const groups = Array.from(grouped.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) =>
        a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));

  if (!groups.length) {
    return `<p class="empty">No lead schedules are currently linked to balances.</p>`;
  }

  return `
    <div class="lead-used-list">
      ${groups
        .map(
          (group) => `
            <section class="lead-used-block">
              <div class="lead-used-heading">
                <div>
                  <strong>${escapeHtml(group.title)}</strong>
                  <span>${group.rows.length} account${group.rows.length === 1 ? "" : "s"} linked</span>
                </div>
                <div class="lead-used-meta">
                  <span>Final balance</span>
                  <strong>${formatCents(group.total)}</strong>
                </div>
              </div>

              <table class="lead-used-table">
                <thead>
                  <tr>
                    <th class="code">Account</th>
                    <th>Description</th>
                    <th>Mapping</th>
                    <th class="amount">Final current year</th>
                    <th class="amount">Final prior year</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.rows
                    .map(
                      (row) => `
                        <tr>
                          <td>${escapeHtml(row.accountCode)}</td>
                          <td>${escapeHtml(row.accountName)}</td>
                          <td>${escapeHtml(row.mapping)}</td>
                          <td class="amount">${formatCents(row.finalAmount)}</td>
                          <td class="amount">${formatCents(row.prior)}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                  <tr class="total">
                    <td colspan="3">Total</td>
                    <td class="amount">${formatCents(group.total)}</td>
                    <td class="amount">${formatCents(group.priorTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          `,
        )
        .join("")}
    </div>
  `;
}

function isEligibleSubordinationLoanLine(line: Record<string, any>) {
  const mappingLabelText = cleanText(
    line.mapping_label || line.mapping_name || line.mapping_category,
  ).toLowerCase();

  if (
    mappingLabelText.includes("other non-current liabilities") ||
    mappingLabelText.includes("other non current liabilities")
  ) {
    return false;
  }

  const mappingValues = [
    line.mapping_code,
    line.mapping_key,
    line.lead_schedule_key,
    line.lead_schedule_number,
  ]
    .map((value) => cleanText(value).toLowerCase().replace(/\s+/g, ""))
    .filter(Boolean);

  const hasEligibleMappingCode = mappingValues.some(
    (value) =>
      value === "548" ||
      value.startsWith("548.") ||
      value === "500.548" ||
      value.startsWith("500.548."),
  );

  if (hasEligibleMappingCode) {
    return true;
  }

  return (
    mappingLabelText.includes("shareholder") ||
    mappingLabelText.includes("director") ||
    mappingLabelText.includes("member loan")
  );
}

function buildSubordinationLoanRows(
  lines: Record<string, any>[],
  journals: Record<string, any>[],
  selections: Record<string, any>[],
) {
  const journalMap = buildJournalAdjustmentMap(journals);
  const lineMap = new Map(
    lines.map((line) => [cleanText(line.id), line]),
  );

  return selections
    .filter((selection) => Boolean(selection.include_in_agreement))
    .map((selection) => {
      const trialBalanceLineId = cleanText(selection.trial_balance_line_id);
      const line = lineMap.get(trialBalanceLineId);

      if (!line || !isEligibleSubordinationLoanLine(line)) {
        return null;
      }

      const imported = preliminaryAmountFromTbLine(line);
      const manual = manualAdjustmentAmount(line);
      const journal = journalAmountForLine(line, journalMap);
      const reclass = reclassificationAmount(line);
      const finalAmount = finalAmountForLine(imported, manual, journal, reclass);
      const prior = safeNumber(line.prior_year_balance);

      return {
        accountCode: cleanText(selection.account_code || line.account_code),
        accountName: cleanText(
          selection.account_name ||
            line.account_name ||
            line.description ||
            "Loan account",
        ),
        creditorName: cleanText(
          selection.creditor_name ||
            selection.account_name ||
            line.account_name ||
            line.description ||
            "Loan account",
        ),
        mapping: mappingLabel(line),
        finalAmount,
        prior,
        interestTerms: cleanText(selection.interest_terms),
        repaymentTerms: cleanText(selection.repayment_terms),
        securityTerms: cleanText(selection.security_terms),
        subordinationTerms: cleanText(selection.subordination_terms),
        companySignatoryName: cleanText(selection.company_signatory_name),
        companySignatoryCapacity: cleanText(
          selection.company_signatory_capacity || "Director"
        ),
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> =>
        row !== null && row.finalAmount < -0.005,
    )
    .sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true }),
    );
}

function renderSubordinationAgreements(args: {
  engagement: Record<string, any> | null;
  clientSetup: Record<string, any> | null;
  trialBalanceLines: Record<string, any>[];
  journals: Record<string, any>[];
  subordinationSelections: Record<string, any>[];
}) {
  const companyName = cleanText(args.clientSetup?.registered_name || args.engagement?.client_name || "the Company");
  const registrationNumber = cleanText(args.clientSetup?.registration_number || args.engagement?.registration_number || "");
  const yearEnd = cleanText(args.clientSetup?.financial_year_end || args.engagement?.financial_year_end || "");
  const loanRows = buildSubordinationLoanRows(
    args.trialBalanceLines,
    args.journals,
    args.subordinationSelections,
  );

  if (!loanRows.length) {
    return `
      <section class="agreement-empty">
        <h2>No subordination agreement generated</h2>
        <p>
          No eligible shareholder, director or member loan accounts have been selected for inclusion.
          Select the required qualifying accounts in the working file and save the selection before exporting.
        </p>
      </section>
    `;
  }

  return `
    <div class="agreement-pack">
      ${loanRows
        .map((loan, index) => {
          const creditorName = loan.creditorName;
          const amountOwing = Math.abs(loan.finalAmount);

          return `
            <section class="agreement-document">
              <div class="agreement-title-block">
                <p class="agreement-kicker">Agreement ${index + 1} of ${loanRows.length}</p>
                <h2>Subordination Agreement</h2>
                <p>in respect of amounts owing by</p>
                <h3>${escapeHtml(companyName)}</h3>
                ${
                  registrationNumber
                    ? `<p class="agreement-muted">Registration number: ${escapeHtml(registrationNumber)}</p>`
                    : ""
                }
              </div>

              <div class="agreement-parties">
                <p>
                  This agreement is entered into between <strong>${escapeHtml(creditorName)}</strong>
                  ("the Creditor") and <strong>${escapeHtml(companyName)}</strong> ("the Company").
                </p>
                <p>
                  The Creditor is reflected in the accounting records of the Company as having advanced or left
                  amounts owing by the Company under account <strong>${escapeHtml(loan.accountCode || "N/A")}</strong>.
                </p>
              </div>

              <table class="agreement-summary">
                <tbody>
                  <tr>
                    <td>Company</td>
                    <td>${escapeHtml(companyName)}</td>
                  </tr>
                  ${
                    registrationNumber
                      ? `<tr><td>Registration number</td><td>${escapeHtml(registrationNumber)}</td></tr>`
                      : ""
                  }
                  <tr>
                    <td>Financial year end</td>
                    <td>${escapeHtml(yearEnd || "Not specified")}</td>
                  </tr>
                  <tr>
                    <td>Creditor / loan account</td>
                    <td>${escapeHtml(creditorName)}</td>
                  </tr>
                  <tr>
                    <td>Amount reflected as owing by the Company</td>
                    <td>${formatCents(amountOwing)}</td>
                  </tr>
                  <tr>
                    <td>Interest terms</td>
                    <td>${escapeHtml(loan.interestTerms || "Not specified")}</td>
                  </tr>
                  <tr>
                    <td>Repayment terms</td>
                    <td>${escapeHtml(loan.repaymentTerms || "Not specified")}</td>
                  </tr>
                  <tr>
                    <td>Security</td>
                    <td>${escapeHtml(loan.securityTerms || "Unsecured")}</td>
                  </tr>
                </tbody>
              </table>

              <ol class="agreement-clauses">
                <li>
                  <strong>Indebtedness.</strong>
                  The Creditor acknowledges that the Company is indebted to the Creditor in respect of the loan
                  account and any further amounts which may become owing by the Company to the Creditor from time
                  to time, whether by way of loan, advance, credit, capital contribution or any similar arrangement.
                </li>
                <li>
                  <strong>Subordination.</strong>
                  The Creditor irrevocably subordinates, in favour of the other present and future creditors of the
                  Company, all claims which the Creditor has or may in future have against the Company, to the extent
                  necessary to ensure that the claims of such other creditors rank in priority to the Creditor's claim.
                </li>
                <li>
                  <strong>Repayment restriction.</strong>
                  The Company shall not repay, settle, set off, reduce or otherwise discharge any subordinated amount
                  to the Creditor while such repayment would result in the Company being unable to pay its debts as
                  they become due in the ordinary course of business, or where the liabilities of the Company would
                  exceed its assets fairly valued.
                </li>
                <li>
                  <strong>No demand for payment.</strong>
                  The Creditor undertakes not to demand, sue for, prove a claim for, accept payment of, or otherwise
                  seek to recover the subordinated amount, except to the extent that the Company is solvent and liquid
                  after taking such payment into account.
                </li>
                <li>
                  <strong>No preference or security.</strong>
                  The Creditor shall not obtain or enforce any security, preference, cession, pledge, lien, set-off or
                  other advantage in respect of the subordinated amount which would prejudice the rights of the other
                  creditors of the Company.
                </li>
                <li>
                  <strong>Continuing effect.</strong>
                  This subordination shall remain in force until the directors or members of the Company are satisfied
                  that the assets of the Company, fairly valued, exceed its liabilities and that the Company is able to
                  pay its debts as they become due in the ordinary course of business.
                </li>
                <li>
                  <strong>Accounting records.</strong>
                  This agreement is prepared with reference to the accounting records and working papers of the Company
                  for the financial year ended <strong>${escapeHtml(yearEnd || "as reflected above")}</strong>. The
                  parties acknowledge that the final amount owing may be adjusted by subsequent accounting entries,
                  repayments, advances or other transactions.
                </li>
                <li>
                  <strong>Governing law.</strong>
                  This agreement shall be governed by and interpreted in accordance with the laws of the Republic of
                  South Africa.
                </li>
              </ol>

              <div class="agreement-signatures">
                <div class="signature-block">
                  <div class="signature-line"></div>
                  <strong>For and on behalf of the Creditor</strong>
                  <span>Name: ${escapeHtml(creditorName)}</span>
                  <span>Date: __________________________</span>
                </div>

                <div class="signature-block">
                  <div class="signature-line"></div>
                  <strong>For and on behalf of the Company</strong>
                  <span>Name: ${
                    loan.companySignatoryName
                      ? escapeHtml(loan.companySignatoryName)
                      : "__________________________"
                  }</span>
                  <span>Capacity: ${
                    loan.companySignatoryCapacity
                      ? escapeHtml(loan.companySignatoryCapacity)
                      : "Director / authorised representative"
                  }</span>
                  <span>Date: __________________________</span>
                </div>
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderHtml(args: {
  document: ExportDocumentKey;
  engagement: Record<string, any> | null;
  clientSetup: Record<string, any> | null;
  trialBalanceLines: Record<string, any>[];
  journals: Record<string, any>[];
  subordinationSelections: Record<string, any>[];
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
  else if (args.document === "subordination-agreements") {
    body = renderSubordinationAgreements({
      engagement: args.engagement,
      clientSetup: args.clientSetup,
      trialBalanceLines: args.trialBalanceLines,
      journals: args.journals,
      subordinationSelections: args.subordinationSelections,
    });
  }
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
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap");

    @page { size: ${pageCss}; margin: 10mm; }
    * { box-sizing: border-box; font-family: "Inter", Arial, sans-serif !important; }
    body {
      margin: 0;
      font-family: "Inter", Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
      color: #0f172a;
      font-size: 9.5px;
      line-height: 1.2;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    header {
      margin-bottom: 12px;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 7px;
    }
    header strong { display: block; font-size: 13px; font-weight: 800; }
    header span { display: block; font-size: 11px; color: #334155; }
    h1 { margin: 0 0 10px; font-size: 17px; line-height: 1.15; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th {
      padding: 4px 5px;
      border-bottom: 1.4px solid #0f172a;
      font-size: 8.6px;
      font-weight: 700;
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
      font-weight: 700;
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
    .journal-heading strong { display: block; font-size: 12px; font-weight: 700; }
    .journal-heading span { display: block; font-size: 9.5px; color: #334155; margin-top: 1px; }
    .journal-meta { text-align: right; min-width: 90px; }
    .journal-meta .balanced { color: #166534; }
    .journal-meta .unbalanced { color: #991b1b; }
    .journal-table { margin-top: 0; }
    .journal-table th { font-size: 8.5px; padding: 3px 4px; }
    .journal-table td { font-size: 8.7px; padding: 3px 4px; }
    .lead-used-list { display: grid; gap: 10px; }
    .lead-used-block {
      border: 1px solid #d3dce9;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .lead-used-heading {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      background: #f8fafc;
      border-bottom: 1px solid #d3dce9;
      padding: 7px 8px;
    }
    .lead-used-heading strong { display: block; font-size: 12px; font-weight: 700; }
    .lead-used-heading span { display: block; font-size: 9.5px; color: #334155; margin-top: 1px; }
    .lead-used-meta { text-align: right; min-width: 95px; }
    .lead-used-table { margin-top: 0; }
    .lead-used-table th { font-size: 8.5px; padding: 3px 4px; }
    .lead-used-table td { font-size: 8.7px; padding: 3px 4px; }

    .agreement-pack {
      display: grid;
      gap: 16px;
    }
    .agreement-document {
      break-after: page;
      page-break-after: always;
      font-size: 10.5px;
      line-height: 1.45;
      color: #0f172a;
    }
    .agreement-document:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .agreement-title-block {
      text-align: center;
      border: 1.4px solid #0f172a;
      padding: 16px 18px;
      margin-bottom: 14px;
    }
    .agreement-kicker {
      margin: 0 0 8px;
      color: #475569;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 800;
    }
    .agreement-title-block h2 {
      margin: 0 0 7px;
      font-size: 22px;
      line-height: 1.1;
      font-weight: 800;
      text-transform: uppercase;
    }
    .agreement-title-block h3 {
      margin: 7px 0 3px;
      font-size: 15px;
      font-weight: 800;
    }
    .agreement-title-block p {
      margin: 2px 0;
    }
    .agreement-muted {
      color: #475569;
    }
    .agreement-parties {
      margin-bottom: 12px;
    }
    .agreement-parties p {
      margin: 0 0 8px;
    }
    .agreement-summary {
      margin: 10px 0 14px;
      border: 1px solid #cbd5e1;
    }
    .agreement-summary td {
      font-size: 9.8px;
      padding: 6px 7px;
      border-bottom: 1px solid #e2e8f0;
    }
    .agreement-summary td:first-child {
      width: 34%;
      background: #f8fafc;
      font-weight: 800;
      color: #334155;
    }
    .agreement-clauses {
      margin: 0;
      padding-left: 18px;
    }
    .agreement-clauses li {
      margin: 0 0 8px;
      padding-left: 3px;
      break-inside: avoid;
    }
    .agreement-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 22px;
      margin-top: 26px;
      break-inside: avoid;
    }
    .signature-block {
      display: grid;
      gap: 5px;
      font-size: 9.8px;
    }
    .signature-line {
      border-top: 1.2px solid #0f172a;
      height: 1px;
      margin-bottom: 4px;
    }
    .signature-block strong {
      font-size: 10px;
    }
    .signature-block span {
      display: block;
      color: #334155;
    }
    .agreement-empty {
      border: 1px solid #d3dce9;
      background: #f8fafc;
      padding: 16px;
      font-size: 11px;
      line-height: 1.45;
    }
    .agreement-empty h2 {
      margin: 0 0 8px;
      font-size: 15px;
    }
  </style>
</head>
<body class="${bodyClass}">
  ${
    args.document === "subordination-agreements"
      ? ""
      : `
  <header>
    <strong>${escapeHtml(clientName)}</strong>
    <span>Financial year end ${escapeHtml(yearEnd)}</span>
  </header>
  <h1>${escapeHtml(title)}</h1>
  `
  }
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

    const { data: subordinationSelections, error: subordinationSelectionsError } =
      await supabase
        .from("afs_subordination_selections")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("include_in_agreement", true)
        .order("account_code", { ascending: true });

    if (subordinationSelectionsError) {
      throw subordinationSelectionsError;
    }

    const html = renderHtml({
      document,
      engagement: engagement || null,
      clientSetup: clientSetup || null,
      trialBalanceLines: trialBalanceLines || [],
      journals: journals || [],
      subordinationSelections: subordinationSelections || [],
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
      waitUntil: "load" as any,
      timeout: 60_000,
    });

    await new Promise((resolve) => setTimeout(resolve, 900));

    await page.emulateMediaType("print");

    const pdfBytes = await page.pdf({
      format: "A4",
      landscape: document === "final-trial-balance" || document === "final-tb-pilot-view",
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
    const fileName = `${safeFilename(clientName)} - ${safeFilename(documentTitle(document))}.pdf`;

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
