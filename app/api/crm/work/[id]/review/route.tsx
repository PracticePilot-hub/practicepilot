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

async function authenticatedContext(request: Request, workId: string) {
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
    .select("id,organisation_id,client_id,title,status,assigned_user_id,preparer_user_id,reviewer_user_id,review_status")
    .eq("id", workId)
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();
  if (!work) return { supabase, context: null };

  const { data: client } = await supabase
    .from("crm_clients")
    .select("id,reviewer_user_id,partner_user_id")
    .eq("id", work.client_id)
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();

  return { supabase, context: { user: authData.user, profile, work, client } };
}

async function addActivity(supabase: ReturnType<typeof adminClient>, args: { organisationId: string; workId: string; userId: string; actionType: string; summary: string; fromStatus?: string | null; toStatus?: string | null }) {
  const { error } = await supabase.from("crm_work_item_activity").insert({
    organisation_id: args.organisationId,
    work_item_id: args.workId,
    action_type: args.actionType,
    action_summary: args.summary,
    from_status: args.fromStatus || null,
    to_status: args.toStatus || null,
    performed_by_user_id: args.userId,
  });
  if (error) throw error;
}

export async function POST(request: Request, routeContext: any) {
  try {
    const params = await routeContext.params;
    const workId = String(params?.id || "").trim();
    const { supabase, context } = await authenticatedContext(request, workId);
    if (!context) return NextResponse.json({ error: "Access denied." }, { status: 403 });

    const body = await request.json();
    const action = String(body?.action || "").trim();
    if (!["send", "approve", "return"].includes(action)) return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
    const now = new Date().toISOString();

    if (action === "send") {
      const preparerUserId = context.work.preparer_user_id || context.work.assigned_user_id || context.user.id;
      if (context.work.assigned_user_id && context.work.assigned_user_id !== context.user.id) {
        return NextResponse.json({ error: "Only the assigned work owner can send this task to the reviewer." }, { status: 403 });
      }

      const reviewerProfileId = context.client?.reviewer_user_id || context.client?.partner_user_id || null;
      if (!reviewerProfileId) return NextResponse.json({ error: "No reviewer is assigned to this client. Set one under Client Setup → Internal Responsibility." }, { status: 409 });

      const { data: reviewerProfile, error: reviewerError } = await supabase
        .from("user_profiles")
        .select("id,user_id,full_name,email")
        .eq("id", reviewerProfileId)
        .eq("organisation_id", context.profile.organisation_id)
        .maybeSingle();
      if (reviewerError) throw reviewerError;
      if (!reviewerProfile?.user_id) return NextResponse.json({ error: "The assigned reviewer does not have an active login user." }, { status: 409 });

      const { data: checklist, error: checklistError } = await supabase
        .from("crm_work_item_checklist")
        .select("id,label,status,item_type,requires_evidence,evidence_label")
        .eq("work_item_id", workId)
        .order("item_order", { ascending: true });
      if (checklistError) throw checklistError;

      const openPreparation = (checklist || []).filter((item: any) => item.item_type !== "review" && item.item_type !== "dependency" && !["completed", "not_applicable"].includes(String(item.status || "")));
      if (openPreparation.length) return NextResponse.json({ error: `Complete the preparation checklist first. Still open: ${openPreparation.map((item: any) => item.label).join(", ")}.` }, { status: 409 });

      const evidenceItems = (checklist || []).filter((item: any) => item.requires_evidence);
      if (evidenceItems.length) {
        const { data: evidenceRows, error: evidenceError } = await supabase
          .from("crm_work_item_evidence")
          .select("checklist_item_id")
          .eq("organisation_id", context.profile.organisation_id)
          .eq("work_item_id", workId);
        if (evidenceError) throw evidenceError;
        const ids = new Set((evidenceRows || []).map((row: any) => String(row.checklist_item_id || "")));
        const missing = evidenceItems.filter((item: any) => !ids.has(String(item.id)));
        if (missing.length) return NextResponse.json({ error: `Upload the required review evidence first: ${missing.map((item: any) => item.evidence_label || item.label).join(", ")}.` }, { status: 409 });
      }

      const { error: workError } = await supabase
        .from("crm_work_items")
        .update({
          preparer_user_id: preparerUserId,
          reviewer_user_id: reviewerProfile.user_id,
          assigned_user_id: reviewerProfile.user_id,
          review_status: "awaiting_review",
          review_requested_at: now,
          review_completed_at: null,
          status: "ready",
          updated_at: now,
        })
        .eq("id", workId);
      if (workError) throw workError;

      await addActivity(supabase, { organisationId: context.profile.organisation_id, workId, userId: context.user.id, actionType: "sent_to_review", summary: `Sent to reviewer ${reviewerProfile.full_name || reviewerProfile.email || "Reviewer"}.`, fromStatus: context.work.status, toStatus: "ready" });
      return NextResponse.json({ success: true, review_status: "awaiting_review", reviewer_user_id: reviewerProfile.user_id });
    }

    if (!context.work.reviewer_user_id || context.work.reviewer_user_id !== context.user.id) {
      return NextResponse.json({ error: "Only the assigned reviewer can perform this review action." }, { status: 403 });
    }

    if (action === "return") {
      if (!context.work.preparer_user_id) return NextResponse.json({ error: "The original preparer could not be identified." }, { status: 409 });
      const { error: resetReviewError } = await supabase
        .from("crm_work_item_checklist")
        .update({ status: "outstanding", updated_at: now })
        .eq("work_item_id", workId)
        .eq("item_type", "review");
      if (resetReviewError) throw resetReviewError;

      const { error: workError } = await supabase
        .from("crm_work_items")
        .update({ assigned_user_id: context.work.preparer_user_id, review_status: "returned", review_completed_at: null, status: "in_progress", updated_at: now })
        .eq("id", workId);
      if (workError) throw workError;

      await addActivity(supabase, { organisationId: context.profile.organisation_id, workId, userId: context.user.id, actionType: "review_returned", summary: "Review returned to preparer.", fromStatus: context.work.status, toStatus: "in_progress" });
      return NextResponse.json({ success: true, review_status: "returned" });
    }

    const { error: reviewChecklistError } = await supabase
      .from("crm_work_item_checklist")
      .update({ status: "completed", updated_at: now })
      .eq("work_item_id", workId)
      .eq("item_type", "review");
    if (reviewChecklistError) throw reviewChecklistError;

    const { error: completeError } = await supabase
      .from("crm_work_items")
      .update({ review_status: "approved", review_completed_at: now, status: "completed", completed_at: now, updated_at: now })
      .eq("id", workId);
    if (completeError) throw completeError;

    await addActivity(supabase, { organisationId: context.profile.organisation_id, workId, userId: context.user.id, actionType: "review_approved", summary: "Review approved and work completed.", fromStatus: context.work.status, toStatus: "completed" });
    return NextResponse.json({ success: true, review_status: "approved" });
  } catch (error: any) {
    console.error("Task review workflow failed:", error);
    return NextResponse.json({ error: error?.message || "Could not update task review." }, { status: 500 });
  }
}
