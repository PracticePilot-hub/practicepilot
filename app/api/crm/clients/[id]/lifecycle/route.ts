import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getAuthenticatedProfile(req: Request) {
  const supabase = getSupabaseAdmin();
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) throw new Error("You are not signed in.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Your login session is invalid or has expired.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(
      "id, organisation_id, access_enabled, can_access_crm, can_delete_clients"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.organisation_id) {
    throw new Error("Your user profile is not linked to an organisation.");
  }

  if (!profile.access_enabled || !profile.can_access_crm) {
    throw new Error("You do not have access to CRM.");
  }

  return { supabase, profile };
}

async function getClient(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string,
  clientId: string
) {
  const { data: client, error } = await supabase
    .from("crm_clients")
    .select("id, client_name")
    .eq("id", clientId)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (error) throw error;
  return client;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getAuthenticatedProfile(req);

    const client = await getClient(supabase, profile.organisation_id, id);

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Client not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      canDeleteClient: Boolean(profile.can_delete_clients),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load permissions.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getAuthenticatedProfile(req);
    const body = await req.json();

    const action = String(body?.action || "").trim().toLowerCase();
    const closureReason =
      typeof body?.closureReason === "string"
        ? body.closureReason.trim() || null
        : null;

    if (action !== "close" && action !== "reopen") {
      return NextResponse.json(
        { success: false, error: "Invalid client lifecycle action." },
        { status: 400 }
      );
    }

    const client = await getClient(supabase, profile.organisation_id, id);

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Client not found." },
        { status: 404 }
      );
    }

    const update =
      action === "close"
        ? {
            status: "Closed",
            closed_at: new Date().toISOString(),
            closure_reason: closureReason,
          }
        : {
            status: "Active",
            closed_at: null,
            closure_reason: null,
          };

    const { error: updateError } = await supabase
      .from("crm_clients")
      .update(update)
      .eq("id", id)
      .eq("organisation_id", profile.organisation_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, action });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Client status could not be updated.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getAuthenticatedProfile(req);

    if (!profile.can_delete_clients) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You are not authorised to permanently delete clients. Close the client instead.",
        },
        { status: 403 }
      );
    }

    const client = await getClient(supabase, profile.organisation_id, id);

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Client not found." },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const confirmation = String(body?.confirmation || "").trim();

    if (confirmation !== String(client.client_name || "").trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Client name confirmation does not match.",
        },
        { status: 400 }
      );
    }

    const protectedTables = [
      { table: "engagements", label: "AFS / engagements" },
      { table: "proposals", label: "proposals" },
      {
        table: "secretarial_share_certificates",
        label: "Secretarial share certificates",
      },
      { table: "secretarial_share_matters", label: "Secretarial share matters" },
      {
        table: "secretarial_share_transactions",
        label: "Secretarial share transactions",
      },
    ];

    const blockers: string[] = [];

    for (const item of protectedTables) {
      const { count, error } = await supabase
        .from(item.table)
        .select("id", { count: "exact", head: true })
        .eq("client_id", id);

      if (error) throw error;

      if ((count || 0) > 0) {
        blockers.push(`${item.label} (${count})`);
      }
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This client cannot be hard-deleted because protected history exists: " +
            blockers.join(", ") +
            ". Use Close Client instead.",
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase
      .from("crm_clients")
      .delete()
      .eq("id", id)
      .eq("organisation_id", profile.organisation_id);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      deletedClientId: id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Client could not be deleted.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
