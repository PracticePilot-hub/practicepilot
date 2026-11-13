import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { workpaperContext, workpaperErrorResponse, WorkpaperError } from "@/app/lib/workpapers/server";
import { configuration, connection, digest, qboGet } from "@/app/lib/quickbooks/server";
import { runImportStep, publicJob } from "@/app/lib/quickbooks/import";
import { reportingCurrency, checkReportingCurrency, importCurrencyPlan } from "@/app/lib/quickbooks/reports";
import { yearStart } from "@/app/lib/workpapers/gl";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = {
    params: Promise<{
        id: string;
    }>;
};
export async function GET(request: Request, { params }: Context) {
    try {
        const { id } = await params, ctx = await workpaperContext(request, "afs", id);
        try { configuration(); } catch { return Response.json({configured:false,connection:null,job:null}); }
        let conn=await connection(ctx);
        const { data: job, error } = await ctx.db.from("pp_qbo_jobs").select("*").eq("organisation_id", ctx.organisationId).eq("engagement_id", id).in("status", ["loading", "review"]).maybeSingle();
        if (error)
            throw error;
        let companyName:string|null=null,companyError:string|null=null;
        if(conn?.status==="connected"){
            try {const info=await qboGet(ctx,`companyinfo/${conn.realm_id}`);companyName=info.CompanyInfo?.CompanyName||null;if(!companyName)companyError="QuickBooks did not return the company name. Retry before importing.";}
            catch(e){companyError=e instanceof Error?e.message:"Company details could not be checked.";conn=await connection(ctx);}
        }
        return Response.json({ configured:true, environment: configuration().environment, connection: conn ? { status: conn.status, realmId: conn.realm_id, environment: conn.environment,companyName } : null, companyError, job: job ? publicJob(job) : null });
    }
    catch (e) {
        return workpaperErrorResponse(e);
    }
}
export async function POST(request: Request, { params }: Context) {
    try {
        const { id } = await params, ctx = await workpaperContext(request, "afs", id, true);
        if (/^finalising$/i.test(ctx.entity.status || ""))
            throw new WorkpaperError("This engagement is being finalised.", 423);
        const body = await request.json(), action = body.action;
        if (action === "connect") {
            const cfg = configuration(), existing = await connection(ctx);
            if (existing && existing.status !== "disconnected")
                throw new WorkpaperError("Disconnect the existing company before reconnecting.", 409);
            const state = randomBytes(32).toString("hex"), browser = randomBytes(32).toString("hex");
            const { error } = await ctx.db.from("pp_qbo_oauth_states").insert({ state_hash: digest(state), browser_hash: digest(browser), organisation_id: ctx.organisationId, engagement_id: id, profile_id: ctx.profile.id, environment: cfg.environment, expires_at: new Date(Date.now() + 600000).toISOString() });
            if (error)
                throw error;
            const url = new URL("https://appcenter.intuit.com/connect/oauth2");
            url.search = new URLSearchParams({ client_id: cfg.clientId, response_type: "code", scope: "com.intuit.quickbooks.accounting", redirect_uri: cfg.redirect, state }).toString();
            const response = NextResponse.json({ url: url.toString() });
            response.cookies.set("pp_qbo_browser", browser, { httpOnly: true, secure: new URL(cfg.redirect).protocol === "https:", sameSite: "lax", maxAge: 600, path: "/api/quickbooks/callback" });
            response.headers.set("Cache-Control", "no-store");
            return response;
        }
        if (action === "disconnect") {
            const { error } = await ctx.db.from("pp_qbo_jobs").update({ status: "cancelled" }).eq("organisation_id", ctx.organisationId).eq("engagement_id", id).in("status", ["loading", "review"]);
            if (error)
                throw error;
            // Removing the local encrypted credentials makes PP stop using this connection immediately.
            const { error: remove } = await ctx.db.from("pp_qbo_connections").update({ tokens: "", status: "disconnected" }).eq("organisation_id", ctx.organisationId).eq("engagement_id", id);
            if (remove)
                throw remove;
            const { error: del } = await ctx.db.from("pp_qbo_connections").delete().eq("organisation_id", ctx.organisationId).eq("engagement_id", id); // Historical jobs reference the binding; retain a disabled row if deletion is restricted.
            if (del && del.code !== "23503")
                throw del;
            return Response.json({ ok: true });
        }
        if (action === "start") {
            if (body.confirmCompany !== true)
                throw new WorkpaperError("Confirm the selected QuickBooks company first.");
            const conn = await connection(ctx);
            if (!conn || conn.status !== "connected")
                throw new WorkpaperError("Connect QuickBooks first.");
            const info = await qboGet(ctx, `companyinfo/${conn.realm_id}`), company = info.CompanyInfo?.CompanyName;
            const preferences = await qboGet(ctx, "preferences");
            if (!preferences.Preferences)
                throw new WorkpaperError("QuickBooks preferences could not be verified.");
            if (!company || body.companyName !== company || body.realmId !== conn.realm_id)
                throw new WorkpaperError("The company confirmation is out of date. Refresh and confirm again.", 409);
            const { data: setup, error: setupError } = await ctx.db.from("afs_client_setup").select("reporting_period_start,currency").eq("engagement_id", id).maybeSingle();
            if (setupError)
                throw setupError;
            const currencyPlan = importCurrencyPlan(preferences.Preferences, setup?.currency);
            const {data:activeImport,error:activeError}=await ctx.db.from("pp_gl_imports").select("id").eq("engagement_id",id).eq("organisation_id",ctx.organisationId).eq("active",true).maybeSingle();
            if(activeError)throw activeError;
            const { data, error } = await ctx.db.from("pp_qbo_jobs").insert({ organisation_id: ctx.organisationId, engagement_id: id, connection_id: conn.id, realm_id: conn.realm_id, created_by: ctx.profile.id, period_start: setup?.reporting_period_start || yearStart(ctx.entity.financial_year_end.slice(0, 10)), period_end: ctx.entity.financial_year_end.slice(0, 10), state: { company, multicurrency: currencyPlan.multicurrency, expectedCurrency: reportingCurrency(setup?.currency), activeImportId:activeImport?.id||null, currency: currencyPlan.currency } }).select("*").single();
            if (error) {
                if (error.code === "23505")
                    throw new WorkpaperError("An import is already pending. Resume or cancel it.", 409);
                throw error;
            }
            return Response.json(publicJob(data));
        }
        if (action === "company") {
            const conn = await connection(ctx);
            if (!conn)
                throw new WorkpaperError("Connect QuickBooks first.");
            const data = await qboGet(ctx, `companyinfo/${conn.realm_id}`);
            return Response.json({ name: data.CompanyInfo?.CompanyName, realmId: conn.realm_id, environment: conn.environment });
        }
        const { data: job, error } = await ctx.db.from("pp_qbo_jobs").select("*").eq("id", String(body.jobId)).eq("organisation_id", ctx.organisationId).eq("engagement_id", id).maybeSingle();
        if (error)
            throw error;
        if (!job)
            throw new WorkpaperError("Import not found.", 404);
        if (action === "cancel") {
            const { error } = await ctx.db.from("pp_qbo_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", job.id).in("status", ["loading", "review"]);
            if (error)
                throw error;
            return Response.json({ ok: true });
        }
        if (action === "step")
            return Response.json(await runImportStep(ctx, job));
        if (action === "apply") {
            const { data: currentSetup, error: currencyError } = await ctx.db.from("afs_client_setup").select("currency").eq("engagement_id", id).maybeSingle();
            if (currencyError) throw currencyError;
            if (!job.state.expectedCurrency) throw new WorkpaperError("This preview predates the reporting-currency check. Discard it and retrieve a new preview.",409);
            checkReportingCurrency(job.state.currency, job.state.expectedCurrency);
            checkReportingCurrency(job.state.currency, currentSetup?.currency);

            const { data, error } = await ctx.db.rpc("pp_qbo_apply", { p_job: job.id, p_organisation: ctx.organisationId, p_actor: ctx.profile.id, p_update_tb: body.updateTrialBalance === true });
            if (error)
                throw error;
            return Response.json({ importId: data });
        }
        throw new WorkpaperError("Unknown QuickBooks action.");
    }
    catch (e) {
        return workpaperErrorResponse(e);
    }
}
