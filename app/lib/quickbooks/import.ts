import "server-only";
import { randomBytes } from "node:crypto";
import { WorkpaperError, type WorkpaperContext } from "@/app/lib/workpapers/server";
import { connection, qboGet } from "./server";
import { accountMap, trialBalance, ledger, verifyReport, checkReportingCurrency, ledgerColumns, fiscalOpening, periods, dayBefore, reconcile, type Account, type Report } from "./reports";
import { yearStart } from "@/app/lib/workpapers/gl";
import type { GLTransaction } from "@/app/lib/workpapers/gl";
type Job = {
    id: string;
    organisation_id: string;
    engagement_id: string;
    connection_id: string;
    realm_id: string;
    status: string;
    step: number;
    period_start: string;
    period_end: string;
    state: {
        company?: string;
        currency?: string | null;
        expectedCurrency?: string;
        multicurrency?: boolean;
        fiscalStartMonth?: number;
        sourceAccounts?: Account[];
        mapped?: ReturnType<typeof accountMap>;
        accountsLoaded?: boolean;
        accountOffset?: number;
        opening?: Record<string, number>;
        closing?: Record<string, number>;
        openingReport?: Report;
        closingReport?: Report;
        closingChecked?: boolean;
        openingChecked?: boolean;
        progress?: string;
        month?: number;
        rowCount?: number;
        accounts?: ReturnType<typeof reconcile>["accounts"];
        issues?: string[];
        verified?: boolean;
    };
};
export function publicJob(j: Job) { return { id: j.id, status: j.status, step: j.step, periodStart: j.period_start, periodEnd: j.period_end, company: j.state.company, currency: j.state.currency, rowCount: j.state.rowCount || 0, accounts: j.status === "review" ? j.state.accounts : undefined, issues: j.state.issues || [], verified: j.state.verified === true, progress: j.state.progress || "Ready to retrieve accounts" }; }
export async function runImportStep(ctx: WorkpaperContext, job: Job) {
    if (job.status !== "loading")
        return publicJob(job);
    const conn = await connection(ctx);
    if (!conn || conn.id !== job.connection_id || conn.realm_id !== job.realm_id || conn.status !== "connected")
        throw new WorkpaperError("The company connection changed. Cancel and restart this import.", 409);
    const lease = randomBytes(16).toString("hex"), now = new Date().toISOString();
    const { data: held, error } = await ctx.db.from("pp_qbo_jobs").update({ lease, lease_until: new Date(Date.now() + 90000).toISOString() }).eq("id", job.id).eq("step", job.step).eq("status", "loading").or(`lease_until.is.null,lease_until.lt.${now}`).select("id").maybeSingle();
    if (error)
        throw error;
    if (!held)
        throw new WorkpaperError("This import is already processing. Retry shortly.", 409);
    try {
        const state = { ...job.state };
        let status = "loading";
        const ranges = periods(job.period_start, job.period_end);
        if (!state.accountsLoaded) {
            const offset = Number(state.accountOffset || 1), data = await qboGet(ctx, "query", { query: `select * from Account where Active in (true,false) startposition ${offset} maxresults 1000` });
            if (!data.QueryResponse)
                throw new WorkpaperError("QuickBooks did not return its account list.", 502);
            const accounts: Account[] = data.QueryResponse.Account || [];
            state.sourceAccounts = [...(state.sourceAccounts || []), ...accounts];
            if (state.sourceAccounts.length > 20000)
                throw new WorkpaperError("QuickBooks has too many accounts for this import.", 413);
            if (accounts.length === 1000)
                state.accountOffset = offset + accounts.length;
            else {
                state.accountsLoaded = true;
                state.mapped = accountMap(state.sourceAccounts);
                if (!state.mapped.length)
                    throw new WorkpaperError("QuickBooks has no accounts to import.");
            }
            state.progress = `Read ${state.sourceAccounts.length} accounts`;
        }
        else if (!state.opening) {
            const asAt = dayBefore(job.period_start), r: Report = await qboGet(ctx, "reports/TrialBalance", { start_date: yearStart(asAt), end_date: asAt, accounting_method: "Accrual" });
            verifyReport(r, "TrialBalance", asAt);
            state.opening = trialBalance(r, state.mapped || []);
            state.openingReport = r;
            state.currency = checkReportingCurrency(r.Header?.Currency, state.expectedCurrency);
            state.progress = "Opening trial balance retrieved";
        }
        else if (!state.closing) {
            const r: Report = await qboGet(ctx, "reports/TrialBalance", { start_date: job.period_start, end_date: job.period_end, accounting_method: "Accrual" });
            verifyReport(r, "TrialBalance", job.period_end);
            if (r.Header?.Currency !== state.currency)
                throw new WorkpaperError("Source reports use different currencies.");
            state.closing = trialBalance(r, state.mapped || []);
            state.closingReport = r;
            state.progress = "Closing trial balance retrieved";
        }
        else if ((state.month || 0) < ranges.length) {
            const month = Number(state.month || 0), range = ranges[month];
            const r: Report = await qboGet(ctx, "reports/GeneralLedger", { start_date: range.start, end_date: range.end, accounting_method: "Accrual", columns: ledgerColumns(state.multicurrency === true) });
            verifyReport(r, "GeneralLedger", range.end, range.start);
            if (r.Header?.Currency !== state.currency)
                throw new WorkpaperError("Ledger currency differs from trial balance currency.");
            const rows = ledger(r, state.mapped || [], range.start, range.end, state.multicurrency === true);
            if (rows.length > 10000)
                throw new WorkpaperError("This monthly ledger is too large for a verified import. Use a file export split into smaller periods.", 413);
            const { error: batchError } = await ctx.db.from("pp_qbo_batches").upsert({ job_id: job.id, batch: month, payload: rows, source_report: r }, { onConflict: "job_id,batch" });
            if (batchError)
                throw batchError;
            state.month = month + 1;
            state.rowCount = Number(state.rowCount || 0) + rows.length;
            if (state.rowCount > 100000)
                throw new WorkpaperError("This ledger exceeds the 100,000-posting limit. No figures have been applied.", 413);
            state.progress = `Retrieved ${state.month} of ${ranges.length} months (${state.rowCount} postings)`;
        }
        else if (!state.closingChecked) {
            const r: Report = await qboGet(ctx, "reports/TrialBalance", {start_date:job.period_start,end_date:job.period_end,accounting_method:"Accrual"});
            verifyReport(r,"TrialBalance",job.period_end);
            const latest=trialBalance(r,state.mapped||[]);
            if(r.Header?.Currency!==state.currency || (state.mapped||[]).some(a=>(latest[a.Id]||0)!==(state.closing![a.Id]||0))) throw new WorkpaperError("QuickBooks changed during extraction. Cancel and restart the import.",409);
            state.closingChecked=true;state.progress="Closing balances rechecked after extraction";
        }
        else if (!state.openingChecked) {
            const asAt=dayBefore(job.period_start),r:Report=await qboGet(ctx,"reports/TrialBalance",{start_date:yearStart(asAt),end_date:asAt,accounting_method:"Accrual"});
            verifyReport(r,"TrialBalance",asAt);
            const latest=trialBalance(r,state.mapped||[]);
            if(r.Header?.Currency!==state.currency || (state.mapped||[]).some(a=>(latest[a.Id]||0)!==(state.opening![a.Id]||0))) throw new WorkpaperError("QuickBooks opening balances changed during extraction. Cancel and restart the import.",409);
            state.openingChecked=true;state.progress="Opening balances rechecked after extraction";
        }
        else {
            const rows: GLTransaction[] = [];
            const {data: batches, error: batchError} = await ctx.db.from("pp_qbo_batches").select("batch,payload").eq("job_id",job.id).order("batch");
            if (batchError) throw batchError;
            if (!batches || batches.length !== ranges.length || batches.some((b, i) => b.batch !== i)) throw new WorkpaperError("Staged ledger batches are incomplete. Cancel and restart the import.");
            for (const batch of batches) rows.push(...batch.payload);
            if (rows.length !== state.rowCount)
                throw new WorkpaperError("Staged ledger is incomplete. Cancel and restart the import.");
            const opening = fiscalOpening(state.mapped || [], state.opening!, job.period_start, job.period_end, state.fiscalStartMonth);
            const checked = reconcile(state.mapped || [], opening.balances, state.closing!, rows);
            state.accounts = checked.accounts;
            state.issues = checked.issues;
            state.verified = checked.issues.length === 0;
            state.progress = state.verified ? (opening.rolled ? "Ledger reconciles to the source trial balance. Opening balances include QuickBooks’ automatic prior-year transfer to retained earnings; no transaction was added." : "Ledger reconciles to the source trial balance") : "Reconciliation needs attention. No figures have been applied.";
            status = "review";
        }
        const { data: saved, error: saveError } = await ctx.db.from("pp_qbo_jobs").update({ state, status, step: job.step + 1, lease: null, lease_until: null, updated_at: new Date().toISOString() }).eq("id", job.id).eq("step", job.step).eq("lease", lease).eq("status", "loading").select("*").maybeSingle();
        if (saveError)
            throw saveError;
        if (!saved)
            throw new WorkpaperError("Import was cancelled or changed. No ledger was activated.", 409);
        return publicJob(saved);
    }
    finally {
        await ctx.db.from("pp_qbo_jobs").update({ lease: null, lease_until: null }).eq("id", job.id).eq("lease", lease);
    }
}
