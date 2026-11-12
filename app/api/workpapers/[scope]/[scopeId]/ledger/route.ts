import { leadLedgerBalance } from "@/app/lib/workpapers/leadBalances";
import { createHash } from "node:crypto";
import {
  workpaperContext,
  workpaperErrorResponse,
  WorkpaperError,
} from "@/app/lib/workpapers/server";
import { validateGL, glCode, yearStart } from "@/app/lib/workpapers/gl";
import type { WorkpaperScope } from "@/app/lib/workpapers/model";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ scope: string; scopeId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { scope, scopeId } = await context.params,
      ctx = await workpaperContext(request, scope, scopeId);
    if (scope !== "afs")
      throw new WorkpaperError("GL detail belongs to an AFS engagement.");
    const accountCode = glCode(
      new URL(request.url).searchParams.get("accountCode"),
    );
    const { data: active, error: importError } = await ctx.db
      .from("pp_gl_imports")
      .select("id,period_start,period_end,accounts")
      .eq("engagement_id", scopeId)
      .eq("organisation_id", ctx.organisationId)
      .eq("active", true)
      .maybeSingle();
    if (importError) throw importError;
    let transactions: Record<string, unknown>[] = [];
    if (active) {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await ctx.db
          .from("pp_gl_transactions")
          .select("journal_date,reference,description,debit,credit")
          .eq("import_id", active.id)
          .eq("organisation_id", ctx.organisationId)
          .eq("account_code", accountCode)
          .order("journal_date")
          .order("row_number")
          .range(offset, offset + 999);
        if (error) throw error;
        transactions.push(
          ...(data || []).map((row) => ({
            ...row,
            date: row.journal_date,
          })),
        );
        if ((data || []).length < 1000) break;
      }
    }
    const { data: journals, error } = await ctx.db
      .from("afs_adjusting_journals")
      .select("*,lines:afs_adjusting_journal_lines(*)")
      .eq("engagement_id", scopeId)
      .order("journal_date");
    if (error) throw error;
    const filtered = (journals || [])
      .filter(
        (j) =>
          String(j.status).toLowerCase() !== "draft" &&
          (!j.journal_period ||
            ["current_year", "opening_balance"].includes(j.journal_period)),
      )
      .flatMap((j) =>
        (j.lines || [])
          .filter(
            (l: { account_code: string }) =>
              glCode(l.account_code) === accountCode,
          )
          .map((l: { debit: number; credit: number }) => ({
            reference: j.journal_reference || j.journal_number,
            description: j.description,
            debit: l.debit,
            credit: l.credit,
            date: j.journal_date,
            purpose: j.journal_purpose,
            period: j.journal_period || "current_year",
          })),
      );
    const account = (active?.accounts || []).find(
      (a: { code: string }) => glCode(a.code) === accountCode,
    );
    let running = Number(account?.opening || 0);
    transactions = transactions.map((row) => {
      running =
        Math.round(
          (running + Number(row.debit || 0) - Number(row.credit || 0)) * 100,
        ) / 100;
      return { ...row, runningBalance: running };
    });
    const { data: tb, error: tbError } = await ctx.db
      .from("afs_trial_balance_lines")
      .select(
        "current_year_balance,current_balance,final_balance,source_balance,debit,credit,manual_adjustment,adjustments,reclassifications",
      )
      .eq("engagement_id", scopeId)
      .eq("account_code", accountCode)
      .maybeSingle();
    if (tbError) throw tbError;
    const ppAdjustments = filtered.reduce(
        (sum, j) => sum + Number(j.debit || 0) - Number(j.credit || 0),
        0,
      ),
      manual =
        Number(tb?.manual_adjustment || 0) + Number(tb?.reclassifications || 0),
      closing = tb ? leadLedgerBalance(tb) : null;
    return Response.json({
      transactions,
      journals: filtered,
      bridge: {
        opening: account?.opening ?? null,
        glClosing: account?.closing ?? null,
        ppAdjustments,
        manual,
        closing,
        difference:
          account && closing !== null
            ? Math.round(
                (closing - Number(account.closing) - ppAdjustments - manual) *
                  100,
              ) / 100
            : null,
      },
      message: active
        ? `GL detail ${active.period_start} to ${active.period_end}. Imported transactions and posted PP journals are shown separately.`
        : "No GL detail imported yet. Existing TB balances remain available; import GL detail from the trial balance section to drill into transactions.",
    });
  } catch (error) {
    return workpaperErrorResponse(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { scope, scopeId } = await context.params,
      ctx = await workpaperContext(request, scope, scopeId, true);
    if (scope !== "afs")
      throw new WorkpaperError("GL detail belongs to an AFS engagement.");
    if (Number(request.headers.get("content-length") || 0) > 4_000_000)
      throw new WorkpaperError(
        "Import file exceeds the 4 MB request limit. Use a smaller ledger extract.",
        413,
      );
    const body = await request.json(),
      end = String(ctx.entity.financial_year_end || "").slice(0, 10),
      start = String(body.periodStart || "");
    if (String(body.periodEnd) !== end)
      throw new WorkpaperError(
        "The ledger must end on this engagement's financial year-end.",
      );
    const { data: setup, error: setupError } = await ctx.db
      .from("afs_client_setup")
      .select("reporting_period_start")
      .eq("engagement_id", scopeId)
      .maybeSingle();
    if (setupError) throw setupError;
    const expectedStart = setup?.reporting_period_start || yearStart(end);
    if (start !== expectedStart)
      throw new WorkpaperError(
        `Import the full reporting period, starting ${expectedStart}. Opening balances must be supplied separately.`,
      );
    const checked = validateGL(
      body.transactions,
      body.openings || {},
      start,
      end,
    );
    if (
      body.updateTrialBalance &&
      (Math.abs(checked.difference) > 0.005 ||
        Math.abs(checked.openingDifference) > 0.005)
    )
      throw new WorkpaperError(
        "To generate a TB, both the complete GL movements and the supplied opening balances must balance to zero.",
      );
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          transactions: checked.transactions,
          accounts: checked.accounts,
          start,
          end,
        }),
      )
      .digest("hex");
    const { data, error } = await ctx.db.rpc("pp_import_general_ledger", {
      p_organisation_id: ctx.organisationId,
      p_engagement_id: scopeId,
      p_user_id: ctx.profile.id,
      p_fingerprint: fingerprint,
      p_filename: String(body.filename || "GL detail").slice(0, 250),
      p_start: start,
      p_end: end,
      p_rows: checked.transactions,
      p_accounts: checked.accounts,
      p_update_tb: Boolean(body.updateTrialBalance),
    });
    if (error) {
      if (error.code === "23505")
        throw new WorkpaperError(
          "This ledger and opening balances have already been imported.",
          409,
        );
      throw error;
    }
    return Response.json({
      importId: data,
      accounts: checked.accounts,
      count: checked.transactions.length,
      trialBalanceUpdated: Boolean(body.updateTrialBalance),
    });
  } catch (error) {
    return workpaperErrorResponse(error);
  }
}
