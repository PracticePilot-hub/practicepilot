import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) throw new Error("Missing Supabase server key");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

type PortalContext = {
  authUser: any;
  portalAccess: {
    id: string;
    organisation_id: string;
    client_id: string;
    full_name: string | null;
    email: string;
  };
};

async function requirePortal(
  request: Request,
  requestedClientId?: string
): Promise<PortalContext> {
  const token = bearerToken(request);

  if (!token) throw new Error("Not authenticated.");

  const {
    data: { user: authenticatedUser },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !authenticatedUser) {
    throw new Error("Not authenticated.");
  }

  let query = admin
    .from("crm_client_portal_users")
    .select(
      "id,organisation_id,client_id,full_name,email,is_active"
    )
    .eq("auth_user_id", authenticatedUser.id)
    .eq("is_active", true);

  if (requestedClientId) {
    query = query.eq("client_id", requestedClientId);
  }

  const { data: portalAccessRow, error } = await query
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!portalAccessRow) {
    throw new Error("Client portal access was not found.");
  }

  return {
    authUser: authenticatedUser,
    portalAccess: {
      id: portalAccessRow.id,
      organisation_id: portalAccessRow.organisation_id,
      client_id: portalAccessRow.client_id,
      full_name: portalAccessRow.full_name,
      email: portalAccessRow.email,
    },
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientId = String(url.searchParams.get("client") || "").trim();

    const ctx = await requirePortal(request, clientId);

    const { data: meetings, error: meetingsError } = await admin
      .from("crm_client_meetings")
      .select(
        "id,title,meeting_at,meeting_type,location,attendees,minutes_text,status,shared_at,created_at"
      )
      .eq("organisation_id", ctx.portalAccess.organisation_id)
      .eq("client_id", ctx.portalAccess.client_id)
      .eq("shared_with_client", true)
      .order("meeting_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (meetingsError) throw meetingsError;

    const meetingIds = (meetings || []).map((row) => row.id);
    let actions: any[] = [];

    if (meetingIds.length) {
      const { data, error } = await admin
        .from("crm_client_meeting_actions")
        .select(
          "id,meeting_id,action_text,assigned_to_type,assigned_portal_user_id,due_date,status,completed_at,completed_by_type,sort_order,created_at"
        )
        .in("meeting_id", meetingIds)
        .neq("status", "cancelled")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      actions = data || [];
    }

    const result = (meetings || []).map((meeting) => ({
      ...meeting,
      actions: actions.filter((action) => {
        if (action.meeting_id !== meeting.id) return false;
        if (action.assigned_to_type === "practice") return true;
        if (!action.assigned_portal_user_id) return true;
        return action.assigned_portal_user_id === ctx.portalAccess.id;
      }),
    }));

    return NextResponse.json({
      success: true,
      meetings: result,
    });
  } catch (error) {
    console.error("CLIENT PORTAL MEETINGS GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load meetings.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientId = String(body?.client_id || "").trim();
    const actionId = String(body?.action_id || "").trim();
    const completed = body?.completed === true;

    const ctx = await requirePortal(request, clientId);

    if (!actionId) {
      return NextResponse.json(
        { error: "Action ID is required." },
        { status: 400 }
      );
    }

    const { data: action, error: actionError } = await admin
      .from("crm_client_meeting_actions")
      .select(
        "id,assigned_to_type,assigned_portal_user_id"
      )
      .eq("id", actionId)
      .eq("organisation_id", ctx.portalAccess.organisation_id)
      .eq("client_id", ctx.portalAccess.client_id)
      .maybeSingle();

    if (actionError) throw actionError;

    if (!action || action.assigned_to_type !== "client") {
      return NextResponse.json(
        { error: "This action is not assigned to the client." },
        { status: 403 }
      );
    }

    if (
      action.assigned_portal_user_id &&
      action.assigned_portal_user_id !== ctx.portalAccess.id
    ) {
      return NextResponse.json(
        { error: "This action is assigned to another portal user." },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    const { data: updated, error } = await admin
      .from("crm_client_meeting_actions")
      .update({
        status: completed ? "completed" : "open",
        completed_at: completed ? now : null,
        completed_by_type: completed ? "client" : null,
        completed_by_user_id: completed ? ctx.authUser.id : null,
        updated_at: now,
      })
      .eq("id", actionId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      action: updated,
    });
  } catch (error) {
    console.error("CLIENT PORTAL MEETING ACTION PATCH ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the action.",
      },
      { status: 500 }
    );
  }
}
