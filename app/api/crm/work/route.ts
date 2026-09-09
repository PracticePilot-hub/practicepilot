import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) throw new Error("Missing Supabase admin environment variables.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authProfile(request: Request, supabase: ReturnType<typeof adminClient>) {
  const token = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, organisation_id, access_enabled")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!profile || profile.access_enabled === false) return null;
  return { user: authData.user, profile };
}

export async function PATCH(request: Request, context: any) {
  try {
    const params = await context.params;
    const workId = String(params?.id || "").trim();

    const supabase = adminClient();
    const auth = await authProfile(request, supabase);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("crm_work_items")
      .select("*")
      .eq("id", workId)
      .maybeSingle();

    if (
      existingError ||
      !existing ||
      String(existing.organisation_id || "") !== String(auth.profile.organisation_id || "")
    ) {
      return NextResponse.json({ error: "Work item not found." }, { status: 404 });
    }

    const body = await request.json();
    const nextStatus = String(body.status ?? existing.status);
    const allowedStatuses = new Set([
      "not_started",
      "in_progress",
      "waiting",
      "ready",
      "completed",
      "cancelled",
    ]);

    if (!allowedStatuses.has(nextStatus)) {
      return NextResponse.json({ error: "Invalid work status." }, { status: 400 });
    }

    if (nextStatus === "completed") {
      const { data: checklist, error: checklistError } = await supabase
        .from("crm_work_item_checklist")
        .select("id, status, item_type")
        .eq("work_item_id", workId);

      if (checklistError) throw checklistError;

      const manualOutstanding = (checklist || []).some(
        (item: any) =>
          item.item_type !== "dependency" &&
          !["completed", "not_applicable"].includes(String(item.status))
      );

      if (manualOutstanding) {
        return NextResponse.json(
          { error: "Complete or mark the outstanding checklist items as not applicable first." },
          { status: 400 }
        );
      }
    }

    const allowedPriorities = new Set(["low", "normal", "high", "urgent"]);
    const priority = allowedPriorities.has(String(body.priority || existing.priority))
      ? String(body.priority || existing.priority)
      : existing.priority;

    if (body.assignedUserId) {
      const { data: assignee } = await supabase
        .from("user_profiles")
        .select("user_id, organisation_id, access_enabled")
        .eq("user_id", body.assignedUserId)
        .maybeSingle();

      if (
        !assignee ||
        assignee.access_enabled === false ||
        String(assignee.organisation_id || "") !== String(auth.profile.organisation_id || "")
      ) {
        return NextResponse.json({ error: "Invalid assignee." }, { status: 400 });
      }
    }

    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      status: nextStatus,
      priority,
      assigned_user_id:
        body.assignedUserId === undefined
          ? existing.assigned_user_id
          : body.assignedUserId || null,
      due_date:
        body.dueDate === undefined
          ? existing.due_date
          : body.dueDate || null,
      title:
        body.title === undefined
          ? existing.title
          : String(body.title || "").trim() || existing.title,
      description:
        body.description === undefined
          ? existing.description
          : String(body.description || "").trim() || null,
      completed_at:
        nextStatus === "completed"
          ? existing.completed_at || now
          : null,
      waiting_since:
        nextStatus === "waiting"
          ? existing.waiting_since || now
          : null,
      waiting_on:
        nextStatus === "waiting"
          ? body.waitingOn || existing.waiting_on || "client"
          : null,
      cancelled_at:
        nextStatus === "cancelled"
          ? existing.cancelled_at || now
          : null,
      updated_at: now,
    };

    const { error: updateError } = await supabase
      .from("crm_work_items")
      .update(updatePayload)
      .eq("id", workId);

    if (updateError) throw updateError;

    if (
      nextStatus !== existing.status ||
      body.assignedUserId !== undefined ||
      body.dueDate !== undefined ||
      body.priority !== undefined
    ) {
      await supabase.from("crm_work_item_activity").insert({
        work_item_id: workId,
        action_type: nextStatus !== existing.status ? "status_changed" : "updated",
        action_summary:
          nextStatus !== existing.status
            ? `Status changed from ${existing.status} to ${nextStatus}.`
            : "Work item details updated.",
        from_status: existing.status,
        to_status: nextStatus,
        performed_by_user_id: auth.user.id,
        metadata: {},
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update work item failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not update the work item." },
      { status: 500 }
    );
  }
}
