import { NextRequest, NextResponse } from "next/server";
import { workpaperAdmin } from "@/app/lib/workpapers/server";
import { configuration, digest, encrypt, exchange } from "@/app/lib/quickbooks/server";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
    let target = "/afs";
    const finish = (status: string) => { const url = new URL(target, request.url); url.searchParams.set("qbo", status); url.searchParams.set("section","trial-balance"); const response = NextResponse.redirect(url, 303); response.cookies.set("pp_qbo_browser", "", { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/api/quickbooks/callback", maxAge: 0 }); response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer"); return response; };
    try {
        const cfg = configuration(), url = request.nextUrl, state = url.searchParams.get("state"), browser = request.cookies.get("pp_qbo_browser")?.value;
        if (!state || !browser || state.length > 256 || browser.length > 256)
            return finish("invalid_state");
        const db = workpaperAdmin();
        const { data, error } = await db.from("pp_qbo_oauth_states").delete().eq("state_hash", digest(state)).eq("browser_hash", digest(browser)).eq("environment", cfg.environment).gt("expires_at", new Date().toISOString()).select("*").maybeSingle();
        if (error || !data)
            return finish("invalid_state");
        target = `/afs/${data.engagement_id}`;
        if (url.searchParams.has("error"))
            return finish("cancelled");
        const code = url.searchParams.get("code"), realm = url.searchParams.get("realmId");
        if (!code || !realm || !/^\d{1,30}$/.test(realm))
            return finish("failed");
        const { data: profile } = await db.from("user_profiles").select("id,organisation_id,access_enabled,can_access_afs,role").eq("id", data.profile_id).eq("organisation_id", data.organisation_id).maybeSingle();
        const { data: engagement } = await db.from("afs_engagements").select("status").eq("id", data.engagement_id).eq("organisation_id", data.organisation_id).maybeSingle();
        const { data: workflow } = await db.from("afs_engagement_workflow").select("*").eq("engagement_id", data.engagement_id).eq("organisation_id", data.organisation_id).maybeSingle();
        const crew = [...(workflow?.pilot_user_ids || []), ...(workflow?.first_officer_user_ids || []), ...(workflow?.captain_user_ids || [])];
        if (!profile?.access_enabled || profile.can_access_afs === false || !engagement || /^(final|archived|finalising)$/i.test(engagement.status || "") || (workflow?.is_started && !crew.includes(profile.id) && !["Admin", "Super Admin"].includes(profile.role)))
            return finish("access_changed");
        const tokens = await exchange({ grant_type: "authorization_code", code, redirect_uri: cfg.redirect });
        // Do not replace an existing binding, even when the same browser completes an older tab.
        const binding = { organisation_id: data.organisation_id, engagement_id: data.engagement_id, realm_id: realm, environment: cfg.environment, tokens: encrypt(tokens), status: "connected", expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), created_by: profile.id };
        const { data: previous } = await db.from("pp_qbo_connections").select("id,status").eq("organisation_id", data.organisation_id).eq("engagement_id", data.engagement_id).maybeSingle();
        if (previous && previous.status !== "disconnected")
            return finish("already_connected");
        const { error: saved } = previous ? await db.from("pp_qbo_connections").update(binding).eq("id", previous.id).eq("status", "disconnected") : await db.from("pp_qbo_connections").insert(binding);
        if (saved)
            return finish("already_connected");
        return finish("connected");
    }
    catch {
        return finish("failed");
    }
}
