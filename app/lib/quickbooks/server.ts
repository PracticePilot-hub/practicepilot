import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { WorkpaperError, type WorkpaperContext } from "@/app/lib/workpapers/server";
export const tokenURL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export function configuration() {
    const { QBO_CLIENT_ID: clientId, QBO_CLIENT_SECRET: secret, QBO_REDIRECT_URI: redirect, QBO_TOKEN_KEY: key, QBO_ENVIRONMENT: environment } = process.env;
    if (!clientId || !secret || !redirect || !key || !["sandbox", "production"].includes(environment || ""))
        throw new WorkpaperError("QuickBooks is not configured yet. Ask your practice administrator to complete the connection setup.", 503);
    const url = new URL(redirect);
    if (url.pathname !== "/api/quickbooks/callback" || (url.protocol !== "https:" && !(environment === "sandbox" && url.hostname === "localhost" && url.protocol === "http:")))
        throw new WorkpaperError("QuickBooks callback URL is invalid.", 503);
    if (Buffer.from(key, "base64").length !== 32)
        throw new WorkpaperError("QuickBooks token encryption is not configured correctly.", 503);
    return { clientId, secret, redirect, key: Buffer.from(key, "base64"), environment: environment! };
}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function encrypt(value: unknown) { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", configuration().key, iv); return Buffer.concat([iv, c.update(JSON.stringify(value)), c.final(), c.getAuthTag()]).toString("base64"); }
export function decrypt(value: string): {
    access_token: string;
    refresh_token: string;
} { const b = Buffer.from(value, "base64"); const c = createDecipheriv("aes-256-gcm", configuration().key, b.subarray(0, 12)); c.setAuthTag(b.subarray(-16)); return JSON.parse(Buffer.concat([c.update(b.subarray(12, -16)), c.final()]).toString()); }
// Keep provider diagnostics useful without retaining report bodies, URLs or credentials.
export function providerFailure(response: Response, stage: "oauth" | "accounting", reason: string) {
    const raw = response.headers.get("intuit_tid") || "";
    const reference = /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : null;
    console.error(JSON.stringify({ event: "quickbooks_provider_failure", stage, status: response.status, reason, intuit_tid: reference }));
    return reference ? ` Support reference: ${reference}.` : "";
}
export async function exchange(params: Record<string, string>) {
    const cfg = configuration();
    const r = await fetch(tokenURL, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams(params), signal: AbortSignal.timeout(20000), cache: "no-store" });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.access_token || !data.refresh_token || !Number.isFinite(data.expires_in))
        throw new WorkpaperError("QuickBooks authorisation could not be renewed. Reconnect the company." + providerFailure(r, "oauth", "token_exchange_failed"), 401);
    return data as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    };
}
export async function connection(ctx: WorkpaperContext) { const { data, error } = await ctx.db.from("pp_qbo_connections").select("*").eq("engagement_id", ctx.scopeId).eq("organisation_id", ctx.organisationId).maybeSingle(); if (error)
    throw error; return data; }
export async function qboGet(ctx: WorkpaperContext, path: string, query: Record<string, string> = {}) {
    const conn = await connection(ctx);
    if (!conn || conn.status !== "connected")
        throw new WorkpaperError("Connect this engagement to QuickBooks first.", 409);
    if (conn.environment !== configuration().environment)
        throw new WorkpaperError("The saved connection belongs to a different QuickBooks environment. Reconnect it.", 409);
    let tokens = decrypt(conn.tokens);
    if (Date.parse(conn.expires_at) < Date.now() + 90000) {
        const lease = randomBytes(16).toString("hex"), now = new Date().toISOString();
        const { data: held, error } = await ctx.db.from("pp_qbo_connections").update({ refresh_lease: lease, refresh_until: new Date(Date.now() + 60000).toISOString() }).eq("id", conn.id).eq("status", "connected").or(`refresh_until.is.null,refresh_until.lt.${now}`).select("id").maybeSingle();
        if (error)
            throw error;
        if (!held)
            throw new WorkpaperError("QuickBooks is renewing this connection. Retry shortly.", 409);
        try {
            const next = await exchange({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
            const { data: saved, error: saveError } = await ctx.db.from("pp_qbo_connections").update({ tokens: encrypt(next), expires_at: new Date(Date.now() + next.expires_in * 1000).toISOString(), refresh_lease: null, refresh_until: null }).eq("id", conn.id).eq("refresh_lease", lease).eq("status", "connected").select("id").maybeSingle();
            if (saveError || !saved)
                throw new WorkpaperError("QuickBooks connection changed while renewing. Reconnect before importing.", 409);
            tokens = next;
        }
        catch (error) {
            await ctx.db.from("pp_qbo_connections").update({ status: "reconnect_required", refresh_lease: null, refresh_until: null }).eq("id", conn.id).eq("refresh_lease", lease);
            throw error;
        }
    }
    if (!/^\d+$/.test(conn.realm_id))
        throw new WorkpaperError("Invalid QuickBooks company reference.");
    const base = conn.environment === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
    const url = new URL(`${base}/v3/company/${conn.realm_id}/${path}`);
    for (const [key, value] of Object.entries(query))
        url.searchParams.set(key, value);
    url.searchParams.set("minorversion", "75");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" }, signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (response.status === 401) {
        await ctx.db.from("pp_qbo_connections").update({ status: "reconnect_required" }).eq("id", conn.id);
        throw new WorkpaperError("QuickBooks access expired. Reconnect the company." + providerFailure(response, "accounting", "unauthorised"), 401);
    }
    if (response.status === 429)
        throw new WorkpaperError("QuickBooks is limiting requests. Wait a minute, then resume the import." + providerFailure(response, "accounting", "rate_limited"), 429);
    if (!response.ok)
        throw new WorkpaperError(`QuickBooks could not return this report (${response.status}). Resume later.` + providerFailure(response, "accounting", "http_error"), 502);
    const reader = response.body?.getReader();
    if (!reader)
        throw new WorkpaperError("QuickBooks returned an empty response.", 502);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
        const part = await reader.read();
        if (part.done)
            break;
        bytes += part.value.byteLength;
        if (bytes > 12000000) {
            await reader.cancel();
            throw new WorkpaperError("This QuickBooks report is too large. Use a smaller-period export for now.", 413);
        }
        chunks.push(part.value);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    let data;
    try {
        data = JSON.parse(body);
    }
    catch {
        throw new WorkpaperError("QuickBooks returned an unreadable response." + providerFailure(response, "accounting", "invalid_json"), 502);
    }
    if (data.Fault)
        throw new WorkpaperError("QuickBooks returned a report error. No figures have been applied." + providerFailure(response, "accounting", "provider_fault"), 502);
    return data;
}
