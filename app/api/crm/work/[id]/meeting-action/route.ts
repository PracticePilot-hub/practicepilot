import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) throw new Error("Missing Supabase server key");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function currentContext(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return {
      user: null,
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      user: null,
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("organisation_id,access_enabled,can_access_crm")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !profile?.organisation_id ||
    profile.access_enabled === false ||
    profile.can_access_crm === false
  ) {
    return {
      user: null,
      profile: null,
      response: NextResponse.json(
        { error: "CRM access is required." },
        { status: 403 }
      ),
    };
  }

  return { user, profile, response: null };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await currentContext(request);

    if (ctx.response || !ctx.profile || !ctx.user) {
      return ctx.response;
    }

    const { id: workItemId } = await context.params;
    const organisationId = String(ctx.profile.organisation_id);

    const { data: workItem, error: workError } = await admin
      .from("crm_work_items")
      .select("*")
      .eq("id", workItemId)
      .eq("organisation_id", organisationId)
      .eq("workflow_type", "meeting_action")
      .maybeSingle();

    if (workError) throw workError;

    if (!workItem) {
      return NextResponse.json(
        { error: "Meeting action work item not found." },
        { status: 404 }
      );
    }

    const actionId = String(workItem.workflow_id || "").trim();

    if (!actionId) {
      return NextResponse.json(
        { error: "This work item is not linked to a meeting action." },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();

    const workPatch: Record<string, unknown> = {
      updated_at: now,
    };

    if (typeof body?.title === "string") {
      const title = body.title.trim();

      if (!title) {
        return NextResponse.json(
          { error: "Action title is required." },
          { status: 400 }
        );
      }

      workPatch.title = title;
    }

    if ("description" in body) {
      workPatch.description =
        String(body?.description || "").trim() || null;
    }

    if ("due_date" in body) {
      workPatch.due_date =
        String(body?.due_date || "").trim() || null;
    }

    if (typeof body?.status === "string") {
      workPatch.status = body.status;

      if (body.status === "completed") {
        workPatch.completed_at = now;
        workPatch.waiting_on = null;
        workPatch.waiting_since = null;
      } else {
        workPatch.completed_at = null;
      }
    }

    if ("waiting_on" in body) {
      workPatch.waiting_on =
        String(body?.waiting_on || "").trim() || null;
    }

    if ("waiting_since" in body) {
      workPatch.waiting_since =
        String(body?.waiting_since || "").trim() || null;
    }

    if ("start_at" in body) {
      workPatch.start_at = body.start_at || null;
    }

    if ("end_at" in body) {
      workPatch.end_at = body.end_at || null;
    }

    const actionPatch: Record<string, unknown> = {
      updated_at: now,
    };

    if ("title" in workPatch) {
      actionPatch.action_text = workPatch.title;
    }

    if ("due_date" in workPatch) {
      actionPatch.due_date = workPatch.due_date;
    }

    if (typeof body?.status === "string") {
      const completed = body.status === "completed";

      actionPatch.status = completed ? "completed" : "open";
      actionPatch.completed_at = completed ? now : null;
      actionPatch.completed_by_type = completed ? "practice" : null;
      actionPatch.completed_by_user_id = completed ? ctx.user.id : null;
    }

    const { data: action, error: actionError } = await admin
      .from("crm_client_meeting_actions")
      .update(actionPatch)
      .eq("id", actionId)
      .eq("organisation_id", organisationId)
      .eq("assigned_to_type", "practice")
      .select("id")
      .maybeSingle();

    if (actionError) throw actionError;

    if (!action) {
      return NextResponse.json(
        { error: "Linked meeting action not found." },
        { status: 404 }
      );
    }

    const { data: updatedWork, error: updateError } = await admin
      .from("crm_work_items")
      .update(workPatch)
      .eq("id", workItemId)
      .eq("organisation_id", organisationId)
      .eq("workflow_type", "meeting_action")
      .select("*")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      work_item: updatedWork,
    });
  } catch (error) {
    console.error("MEETING ACTION WORK SYNC ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the meeting action.",
      },
      { status: 500 }
    );
  }
}
