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
if (!serviceKey) throw new Error("Missing Supabase service-role key");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type WorkflowStatus =
  | "stored"
  | "awaiting_review"
  | "reviewed"
  | "approved"
  | "rejected";

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
    .select(
      "id,user_id,organisation_id,role,access_enabled,can_access_crm"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    !profile.organisation_id ||
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

  return {
    user,
    profile,
    response: null,
  };
}

async function clientProviderContext(
  organisationId: string,
  clientId: string
) {
  const { data: client, error: clientError } = await admin
    .from("crm_clients")
    .select("id")
    .eq("id", clientId)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (clientError) throw clientError;

  if (!client) {
    throw new Error("Client not found.");
  }

  const { data: mapping, error: mappingError } = await admin
    .from("crm_client_document_locations")
    .select(
      "id,organisation_id,client_id,provider_id,folder_path,is_primary,is_active"
    )
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (mappingError) throw mappingError;

  if (!mapping) {
    throw new Error(
      "This client is not linked to a document-provider folder."
    );
  }

  return {
    client,
    mapping,
  };
}

function normalisePath(value: string) {
  const parts = String(value || "")
    .split("/")
    .filter(Boolean);

  return `/${parts.join("/")}`;
}

function isInsideRoot(rootPath: string, requestedPath: string) {
  const root = normalisePath(rootPath);
  const requested = normalisePath(requestedPath);

  return requested === root || requested.startsWith(`${root}/`);
}

function cleanStatus(value: unknown): WorkflowStatus {
  const status = String(value || "")
    .trim()
    .toLowerCase() as WorkflowStatus;

  if (
    ![
      "stored",
      "awaiting_review",
      "reviewed",
      "approved",
      "rejected",
    ].includes(status)
  ) {
    throw new Error("Invalid document workflow status.");
  }

  return status;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    const { mapping } = await clientProviderContext(
      organisationId,
      clientId
    );

    const url = new URL(request.url);
    const path = String(url.searchParams.get("path") || "").trim();

    let query = admin
      .from("crm_document_workflow")
      .select(
        `
          id,
          organisation_id,
          client_id,
          provider_id,
          provider_item_id,
          provider_path,
          document_name,
          workflow_status,
          client_visible,
          owner_user_id,
          created_by_user_id,
          review_requested_by_user_id,
          review_requested_at,
          reviewed_by_user_id,
          reviewed_at,
          approved_by_user_id,
          approved_at,
          released_by_user_id,
          released_at,
          last_activity_text,
          created_at,
          updated_at
        `
      )
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .eq("provider_id", mapping.provider_id)
      .order("updated_at", { ascending: false });

    if (path) {
      const normalised = normalisePath(path);

      if (!isInsideRoot(mapping.folder_path, normalised)) {
        return NextResponse.json(
          { error: "Requested path is outside the client document root." },
          { status: 403 }
        );
      }

      query = query.eq("provider_path", normalised);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      workflow: data || [],
    });
  } catch (error) {
    console.error("CLIENT DOCUMENT WORKFLOW GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load document workflow.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile, response } = await currentContext(request);
    if (response || !profile || !user) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    const { mapping } = await clientProviderContext(
      organisationId,
      clientId
    );

    const body = await request.json().catch(() => ({}));

    const providerPath = normalisePath(
      String(body?.provider_path || "").trim()
    );

    const documentName = String(body?.document_name || "").trim();
    const providerItemId = String(body?.provider_item_id || "").trim() || null;

    if (!providerPath || providerPath === "/") {
      return NextResponse.json(
        { error: "Document path is required." },
        { status: 400 }
      );
    }

    if (!documentName) {
      return NextResponse.json(
        { error: "Document name is required." },
        { status: 400 }
      );
    }

    if (!isInsideRoot(mapping.folder_path, providerPath)) {
      return NextResponse.json(
        { error: "Document is outside the client document root." },
        { status: 403 }
      );
    }

    const { data, error } = await admin
      .from("crm_document_workflow")
      .upsert(
        {
          organisation_id: organisationId,
          client_id: clientId,
          provider_id: mapping.provider_id,
          provider_item_id: providerItemId,
          provider_path: providerPath,
          document_name: documentName,
          workflow_status: "stored",
          client_visible: false,
          created_by_user_id: user.id,
          last_activity_text: "Document added to PracticePilot workflow.",
        },
        {
          onConflict:
            "organisation_id,client_id,provider_id,provider_path",
        }
      )
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      workflow: data,
    });
  } catch (error) {
    console.error("CLIENT DOCUMENT WORKFLOW POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not register document workflow.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile, response } = await currentContext(request);
    if (response || !profile || !user) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    const { mapping } = await clientProviderContext(
      organisationId,
      clientId
    );

    const body = await request.json().catch(() => ({}));

    const providerPath = normalisePath(
      String(body?.provider_path || "").trim()
    );

    if (!providerPath || providerPath === "/") {
      return NextResponse.json(
        { error: "Document path is required." },
        { status: 400 }
      );
    }

    if (!isInsideRoot(mapping.folder_path, providerPath)) {
      return NextResponse.json(
        { error: "Document is outside the client document root." },
        { status: 403 }
      );
    }

    const nextStatus = cleanStatus(body?.workflow_status);
    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
      workflow_status: nextStatus,
      last_activity_text: `Workflow changed to ${nextStatus.replaceAll(
        "_",
        " "
      )}.`,
    };

    if (nextStatus === "awaiting_review") {
      update.review_requested_by_user_id = user.id;
      update.review_requested_at = now;
      update.reviewed_by_user_id = null;
      update.reviewed_at = null;
      update.approved_by_user_id = null;
      update.approved_at = null;
      update.client_visible = false;
      update.released_by_user_id = null;
      update.released_at = null;
    }

    if (nextStatus === "reviewed") {
      update.reviewed_by_user_id = user.id;
      update.reviewed_at = now;
      update.client_visible = false;
      update.released_by_user_id = null;
      update.released_at = null;
    }

    if (nextStatus === "approved") {
      update.approved_by_user_id = user.id;
      update.approved_at = now;
    }

    if (nextStatus === "rejected") {
      update.client_visible = false;
      update.released_by_user_id = null;
      update.released_at = null;
    }

    if (nextStatus === "stored") {
      update.client_visible = false;
      update.review_requested_by_user_id = null;
      update.review_requested_at = null;
      update.reviewed_by_user_id = null;
      update.reviewed_at = null;
      update.approved_by_user_id = null;
      update.approved_at = null;
      update.released_by_user_id = null;
      update.released_at = null;
    }

    const { data: existing, error: existingError } = await admin
      .from("crm_document_workflow")
      .select("id")
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .eq("provider_id", mapping.provider_id)
      .eq("provider_path", providerPath)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "This document has not yet been registered in the PracticePilot workflow.",
        },
        { status: 404 }
      );
    }

    const { data, error } = await admin
      .from("crm_document_workflow")
      .update(update)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      workflow: data,
    });
  } catch (error) {
    console.error("CLIENT DOCUMENT WORKFLOW PATCH ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update document workflow.",
      },
      { status: 500 }
    );
  }
}
