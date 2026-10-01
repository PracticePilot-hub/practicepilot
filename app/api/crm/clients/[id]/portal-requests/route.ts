// Path: app/api/crm/clients/[id]/portal-requests/route.ts

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
      "id,user_id,organisation_id,access_enabled,can_access_crm"
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

  return { user, profile, response: null };
}

async function assertClient(
  organisationId: string,
  clientId: string
) {
  const { data: client, error } = await admin
    .from("crm_clients")
    .select("id,client_name")
    .eq("id", clientId)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (error) throw error;
  if (!client) throw new Error("Client not found.");

  return client;
}

const allowedTypes = new Set([
  "document_request",
  "approval",
  "confirmation",
  "question",
]);

const allowedStatuses = new Set([
  "new",
  "in_progress",
  "submitted",
  "completed",
  "cancelled",
]);

const allowedPriorities = new Set([
  "low",
  "normal",
  "high",
  "urgent",
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    await assertClient(organisationId, clientId);

    const [
      { data: requests, error: requestsError },
      { data: portalUsers, error: portalUsersError },
    ] = await Promise.all([
      admin
        .from("crm_client_portal_requests")
        .select(
          "id,organisation_id,client_id,request_type,title,description,due_date,status,priority,assigned_portal_user_id,requires_upload,requires_response,requires_approval,upload_provider_id,upload_folder_path,upload_folder_name,response_text,submitted_at,completed_at,created_by_user_id,created_at,updated_at"
        )
        .eq("organisation_id", organisationId)
        .eq("client_id", clientId)
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),

      admin
        .from("crm_client_portal_users")
        .select(
          "id,full_name,email,portal_role,is_active,invitation_status"
        )
        .eq("organisation_id", organisationId)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("portal_role", { ascending: true })
        .order("full_name", { ascending: true, nullsFirst: false }),
    ]);

    if (requestsError) throw requestsError;
    if (portalUsersError) throw portalUsersError;

    return NextResponse.json({
      success: true,
      requests: requests || [],
      portal_users: portalUsers || [],
    });
  } catch (error) {
    console.error("PORTAL REQUESTS GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load portal requests.",
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

    await assertClient(organisationId, clientId);

    const body = await request.json().catch(() => ({}));

    const requestType = String(body?.request_type || "").trim();
    const title = String(body?.title || "").trim();
    const description =
      String(body?.description || "").trim() || null;
    const dueDate =
      String(body?.due_date || "").trim() || null;
    const priority = String(body?.priority || "normal").trim();
    const assignedPortalUserId =
      String(body?.assigned_portal_user_id || "").trim() || null;
    const uploadProviderId =
      String(body?.upload_provider_id || "").trim() || null;
    const uploadFolderPath =
      String(body?.upload_folder_path || "").trim() || null;
    const uploadFolderName =
      String(body?.upload_folder_name || "").trim() || null;

    if (!allowedTypes.has(requestType)) {
      return NextResponse.json(
        { error: "Choose a valid request type." },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Request title is required." },
        { status: 400 }
      );
    }

    if (!allowedPriorities.has(priority)) {
      return NextResponse.json(
        { error: "Choose a valid priority." },
        { status: 400 }
      );
    }

    if (assignedPortalUserId) {
      const { data: portalUser, error: portalUserError } = await admin
        .from("crm_client_portal_users")
        .select("id")
        .eq("id", assignedPortalUserId)
        .eq("organisation_id", organisationId)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .maybeSingle();

      if (portalUserError) throw portalUserError;

      if (!portalUser) {
        return NextResponse.json(
          { error: "Selected portal user could not be found." },
          { status: 404 }
        );
      }
    }

    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("crm_client_portal_requests")
      .insert({
        organisation_id: organisationId,
        client_id: clientId,
        request_type: requestType,
        title,
        description,
        due_date: dueDate,
        status: "new",
        priority,
        assigned_portal_user_id: assignedPortalUserId,
        requires_upload: body?.requires_upload === true,
        requires_response: body?.requires_response === true,
        requires_approval: body?.requires_approval === true,
        upload_provider_id: uploadProviderId,
        upload_folder_path: uploadFolderPath,
        upload_folder_name: uploadFolderName,
        created_by_user_id: user.id,
        created_at: now,
        updated_at: now,
      })
      .select(
        "id,organisation_id,client_id,request_type,title,description,due_date,status,priority,assigned_portal_user_id,requires_upload,requires_response,requires_approval,upload_provider_id,upload_folder_path,upload_folder_name,response_text,submitted_at,completed_at,created_by_user_id,created_at,updated_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      request: data,
    });
  } catch (error) {
    console.error("PORTAL REQUESTS POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the portal request.",
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
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    await assertClient(organisationId, clientId);

    const body = await request.json().catch(() => ({}));
    const requestId = String(body?.request_id || "").trim();

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required." },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body?.title === "string") {
      const title = body.title.trim();

      if (!title) {
        return NextResponse.json(
          { error: "Request title is required." },
          { status: 400 }
        );
      }

      update.title = title;
    }

    if (typeof body?.description === "string") {
      update.description = body.description.trim() || null;
    }

    if (typeof body?.due_date === "string") {
      update.due_date = body.due_date.trim() || null;
    }

    if (typeof body?.request_type === "string") {
      if (!allowedTypes.has(body.request_type)) {
        return NextResponse.json(
          { error: "Choose a valid request type." },
          { status: 400 }
        );
      }

      update.request_type = body.request_type;
    }

    if (typeof body?.priority === "string") {
      if (!allowedPriorities.has(body.priority)) {
        return NextResponse.json(
          { error: "Choose a valid priority." },
          { status: 400 }
        );
      }

      update.priority = body.priority;
    }

    if (typeof body?.status === "string") {
      if (!allowedStatuses.has(body.status)) {
        return NextResponse.json(
          { error: "Choose a valid status." },
          { status: 400 }
        );
      }

      update.status = body.status;

      if (body.status === "completed") {
        update.completed_at = new Date().toISOString();
      }

      if (body.status !== "completed") {
        update.completed_at = null;
      }
    }

    if ("assigned_portal_user_id" in body) {
      const assignedPortalUserId =
        String(body?.assigned_portal_user_id || "").trim() || null;

      if (assignedPortalUserId) {
        const { data: portalUser, error: portalUserError } = await admin
          .from("crm_client_portal_users")
          .select("id")
          .eq("id", assignedPortalUserId)
          .eq("organisation_id", organisationId)
          .eq("client_id", clientId)
          .eq("is_active", true)
          .maybeSingle();

        if (portalUserError) throw portalUserError;

        if (!portalUser) {
          return NextResponse.json(
            { error: "Selected portal user could not be found." },
            { status: 404 }
          );
        }
      }

      update.assigned_portal_user_id = assignedPortalUserId;
    }

    if (typeof body?.requires_upload === "boolean") {
      update.requires_upload = body.requires_upload;
    }

    if (typeof body?.requires_response === "boolean") {
      update.requires_response = body.requires_response;
    }

    if (typeof body?.requires_approval === "boolean") {
      update.requires_approval = body.requires_approval;
    }

    if ("upload_provider_id" in body) {
      update.upload_provider_id =
        String(body?.upload_provider_id || "").trim() || null;
    }

    if ("upload_folder_path" in body) {
      update.upload_folder_path =
        String(body?.upload_folder_path || "").trim() || null;
    }

    if ("upload_folder_name" in body) {
      update.upload_folder_name =
        String(body?.upload_folder_name || "").trim() || null;
    }

    const { data, error } = await admin
      .from("crm_client_portal_requests")
      .update(update)
      .eq("id", requestId)
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .select(
        "id,organisation_id,client_id,request_type,title,description,due_date,status,priority,assigned_portal_user_id,requires_upload,requires_response,requires_approval,upload_provider_id,upload_folder_path,upload_folder_name,response_text,submitted_at,completed_at,created_by_user_id,created_at,updated_at"
      )
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Portal request not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      request: data,
    });
  } catch (error) {
    console.error("PORTAL REQUESTS PATCH ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the portal request.",
      },
      { status: 500 }
    );
  }
}
