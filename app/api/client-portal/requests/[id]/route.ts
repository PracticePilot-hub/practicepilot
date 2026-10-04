// Path: app/api/client-portal/requests/[id]/route.ts

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

async function portalContext(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
      user: null,
      accessRows: [],
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
      user: null,
      accessRows: [],
    };
  }

  const { data: accessRows, error: accessError } = await admin
    .from("crm_client_portal_users")
    .select("id,organisation_id,client_id,email,is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true);

  if (accessError) throw accessError;

  return {
    error: null,
    user,
    accessRows: accessRows || [],
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await context.params;
    const ctx = await portalContext(request);

    if (ctx.error) return ctx.error;

    const body = await request.json().catch(() => ({}));

    const { data: portalRequest, error: loadError } = await admin
      .from("crm_client_portal_requests")
      .select(
        "id,organisation_id,client_id,request_type,status,assigned_portal_user_id,requires_response,requires_approval"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (loadError) throw loadError;

    if (!portalRequest) {
      return NextResponse.json(
        { error: "Request not found." },
        { status: 404 }
      );
    }

    const access = ctx.accessRows.find(
      (row: any) =>
        row.organisation_id === portalRequest.organisation_id &&
        row.client_id === portalRequest.client_id &&
        (
          !portalRequest.assigned_portal_user_id ||
          portalRequest.assigned_portal_user_id === row.id
        )
    );

    if (!access) {
      return NextResponse.json(
        { error: "You do not have access to this request." },
        { status: 403 }
      );
    }

    if (
      ["submitted", "completed", "cancelled"].includes(
        String(portalRequest.status || "")
      )
    ) {
      return NextResponse.json(
        { error: "This request can no longer be changed." },
        { status: 409 }
      );
    }

    const action = String(body?.action || "").trim();
    const responseText =
      String(body?.response_text || "").trim() || null;

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (portalRequest.request_type === "question") {
      if (action !== "respond" || !responseText) {
        return NextResponse.json(
          { error: "A written response is required." },
          { status: 400 }
        );
      }

      update.response_text = responseText;
    } else if (portalRequest.request_type === "approval") {
      const choice = String(body?.approval_choice || "");

      if (!["approved", "declined"].includes(choice)) {
        return NextResponse.json(
          { error: "Choose Approve or Decline." },
          { status: 400 }
        );
      }

      update.response_text = JSON.stringify({
        decision: choice,
        comment: responseText,
      });
    } else if (portalRequest.request_type === "confirmation") {
      const choice = String(body?.confirmation_choice || "");

      if (!["confirmed", "cannot_confirm"].includes(choice)) {
        return NextResponse.json(
          { error: "Choose a confirmation option." },
          { status: 400 }
        );
      }

      update.response_text = JSON.stringify({
        confirmation: choice,
        comment: responseText,
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Document requests must be completed through the upload action.",
        },
        { status: 400 }
      );
    }

    update.status = "submitted";
    update.submitted_at = new Date().toISOString();

    const { data, error } = await admin
      .from("crm_client_portal_requests")
      .update(update)
      .eq("id", requestId)
      .eq("organisation_id", portalRequest.organisation_id)
      .eq("client_id", portalRequest.client_id)
      .select(
        "id,request_type,title,status,response_text,submitted_at,updated_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      request: data,
    });
  } catch (error) {
    console.error("CLIENT PORTAL REQUEST ACTION ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not submit the request.",
      },
      { status: 500 }
    );
  }
}
