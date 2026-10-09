import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase admin environment variables.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function contextFor(request: Request, workId: string) {
  const supabase = adminClient();
  const token = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return { supabase, context: null };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id,user_id,organisation_id,access_enabled,can_access_crm")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!profile?.organisation_id || profile.access_enabled === false || profile.can_access_crm === false) return { supabase, context: null };

  const { data: work } = await supabase
    .from("crm_work_items")
    .select("id,organisation_id,client_id")
    .eq("id", workId)
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();
  if (!work) return { supabase, context: null };

  return { supabase, context: { profile, user: authData.user, work } };
}

export async function GET(request: Request, routeContext: any) {
  try {
    const params = await routeContext.params;
    const workId = String(params?.id || "").trim();
    const { supabase, context } = await contextFor(request, workId);
    if (!context) return NextResponse.json({ error: "Access denied." }, { status: 403 });

    const { data, error } = await supabase
      .from("crm_work_item_evidence")
      .select("id,checklist_item_id,document_name,provider_path,created_at,uploaded_by_user_id")
      .eq("organisation_id", context.profile.organisation_id)
      .eq("work_item_id", workId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, evidence: data || [] });
  } catch (error: any) {
    console.error("Load task evidence failed:", error);
    return NextResponse.json({ error: error?.message || "Could not load task evidence." }, { status: 500 });
  }
}

export async function POST(request: Request, routeContext: any) {
  try {
    const params = await routeContext.params;
    const workId = String(params?.id || "").trim();
    const { supabase, context } = await contextFor(request, workId);
    if (!context) return NextResponse.json({ error: "Access denied." }, { status: 403 });

    const body = await request.json();
    const checklistItemId = String(body?.checklistItemId || "").trim();
    const documentName = String(body?.documentName || "").trim();
    const providerPath = String(body?.providerPath || "").trim();
    if (!checklistItemId || !documentName || !providerPath) return NextResponse.json({ error: "Checklist item, document name and provider path are required." }, { status: 400 });

    const { data: checklistItem } = await supabase
      .from("crm_work_item_checklist")
      .select("id,work_item_id")
      .eq("id", checklistItemId)
      .eq("work_item_id", workId)
      .maybeSingle();
    if (!checklistItem) return NextResponse.json({ error: "Checklist item not found." }, { status: 404 });

    const { data: location } = await supabase
      .from("crm_client_document_locations")
      .select("provider_id")
      .eq("organisation_id", context.profile.organisation_id)
      .eq("client_id", context.work.client_id)
      .eq("is_active", true)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("crm_work_item_evidence")
      .insert({
        organisation_id: context.profile.organisation_id,
        client_id: context.work.client_id,
        work_item_id: workId,
        checklist_item_id: checklistItemId,
        provider_id: location?.provider_id || null,
        provider_path: providerPath,
        document_name: documentName,
        uploaded_by_user_id: context.user.id,
      })
      .select("id,checklist_item_id,document_name,provider_path,created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, evidence: data });
  } catch (error: any) {
    console.error("Register task evidence failed:", error);
    return NextResponse.json({ error: error?.message || "Could not register task evidence." }, { status: 500 });
  }
}
