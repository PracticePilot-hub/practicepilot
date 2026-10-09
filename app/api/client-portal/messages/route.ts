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

    const { data, error } = await admin
      .from("crm_client_portal_messages")
      .select(
        "id,portal_user_id,sender_type,sender_name,message_body,is_read_by_client,is_read_by_practice,created_at"
      )
      .eq("organisation_id", ctx.portalAccess.organisation_id)
      .eq("client_id", ctx.portalAccess.client_id)
      .or(`portal_user_id.is.null,portal_user_id.eq.${ctx.portalAccess.id}`)
      .order("created_at", { ascending: true });

    if (error) throw error;

    await admin
      .from("crm_client_portal_messages")
      .update({ is_read_by_client: true })
      .eq("organisation_id", ctx.portalAccess.organisation_id)
      .eq("client_id", ctx.portalAccess.client_id)
      .eq("sender_type", "practice")
      .eq("is_read_by_client", false);

    return NextResponse.json({
      success: true,
      messages: data || [],
    });
  } catch (error) {
    console.error("CLIENT PORTAL MESSAGES GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load messages.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientId = String(body?.client_id || "").trim();
    const messageBody = String(body?.message_body || "").trim();

    if (!messageBody) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const ctx = await requirePortal(request, clientId);

    const { data: message, error } = await admin
      .from("crm_client_portal_messages")
      .insert({
        organisation_id: ctx.portalAccess.organisation_id,
        client_id: ctx.portalAccess.client_id,
        portal_user_id: ctx.portalAccess.id,
        sender_type: "client",
        sender_user_id: ctx.authUser.id,
        sender_name:
          ctx.portalAccess.full_name || ctx.portalAccess.email || "Client",
        message_body: messageBody,
        is_read_by_client: true,
        is_read_by_practice: false,
      })
      .select(
        "id,portal_user_id,sender_type,sender_name,message_body,is_read_by_client,is_read_by_practice,created_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("CLIENT PORTAL MESSAGES POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not send message.",
      },
      { status: 500 }
    );
  }
}
