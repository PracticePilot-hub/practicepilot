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

  if (!url || !key) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authContext(
  request: Request,
  clientId: string,
  supabase: ReturnType<typeof adminClient>
) {
  const token = String(request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    ""
  );

  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !authData.user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, organisation_id, access_enabled, role")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!profile || profile.access_enabled === false) return null;

  const { data: client } = await supabase
    .from("crm_clients")
    .select("id, organisation_id, client_name, registration_number, entity_type")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return null;

  const globalAdmin =
    profile.role === "Super Admin" || profile.role === "Admin";

  if (
    !globalAdmin &&
    String(client.organisation_id || "") !==
      String(profile.organisation_id || "")
  ) {
    return null;
  }

  return { user: authData.user, profile, client };
}

async function loadWorkspace(
  supabase: ReturnType<typeof adminClient>,
  clientId: string
) {
  const [{ data: workflow, error: workflowError }, { data: directors, error: directorsError }] =
    await Promise.all([
      supabase
        .from("crm_registered_representative_workflows")
        .select(
          "id, organisation_id, client_id, director_id, status, resolution_date, submission_date, confirmation_date, notes, created_at, updated_at"
        )
        .eq("client_id", clientId)
        .maybeSingle(),

      supabase
        .from("crm_client_directors")
        .select(
          "id, director_name, id_passport_number, email, phone, appointment_date, cessation_date, is_active"
        )
        .eq("client_id", clientId)
        .order("director_name", { ascending: true }),
    ]);

  if (workflowError) throw workflowError;
  if (directorsError) throw directorsError;

  let items: any[] = [];

  if (workflow?.id) {
    const { data, error } = await supabase
      .from("crm_registered_representative_items")
      .select(
        "id, item_key, label, item_order, item_type, status, file_name, storage_path, completed_at, completed_by_user_id"
      )
      .eq("workflow_id", workflow.id)
      .order("item_order", { ascending: true });

    if (error) throw error;
    items = data || [];
  }

  return {
    workflow: workflow || null,
    directors: directors || [],
    items,
  };
}

export async function GET(request: Request, context: any) {
  try {
    const params = await context.params;
    const clientId = String(params?.id || "").trim();

    const supabase = adminClient();
    const auth = await authContext(request, clientId, supabase);

    if (!auth) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const workspace = await loadWorkspace(supabase, clientId);

    return NextResponse.json({
      success: true,
      client: auth.client,
      ...workspace,
    });
  } catch (error: any) {
    console.error("Registered Representative GET failed:", error);

    return NextResponse.json(
      { error: error?.message || "Could not load Registered Representative." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: any) {
  try {
    const params = await context.params;
    const clientId = String(params?.id || "").trim();

    const supabase = adminClient();
    const auth = await authContext(request, clientId, supabase);

    if (!auth) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const body = await request.json();
    const directorId = String(body.directorId || "").trim();

    if (!directorId) {
      return NextResponse.json(
        { error: "Select the Registered Representative first." },
        { status: 400 }
      );
    }

    const { data: director, error: directorError } = await supabase
      .from("crm_client_directors")
      .select("id, client_id, director_name, is_active")
      .eq("id", directorId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (directorError) throw directorError;

    if (!director) {
      return NextResponse.json(
        { error: "Selected director was not found for this client." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: existing, error: existingError } = await supabase
      .from("crm_registered_representative_workflows")
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("crm_registered_representative_workflows")
        .update({
          director_id: directorId,
          status: "documents_required",
          updated_at: now,
        })
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("crm_registered_representative_workflows")
        .insert({
          organisation_id: auth.client.organisation_id,
          client_id: clientId,
          director_id: directorId,
          status: "documents_required",
        });

      if (insertError) throw insertError;
    }

    const workspace = await loadWorkspace(supabase, clientId);

    return NextResponse.json({
      success: true,
      ...workspace,
    });
  } catch (error: any) {
    console.error("Registered Representative POST failed:", error);

    return NextResponse.json(
      { error: error?.message || "Could not start Registered Representative." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const params = await context.params;
    const clientId = String(params?.id || "").trim();

    const supabase = adminClient();
    const auth = await authContext(request, clientId, supabase);

    if (!auth) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const body = await request.json();

    const { data: workflow, error: workflowError } = await supabase
      .from("crm_registered_representative_workflows")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (workflowError) throw workflowError;

    if (!workflow) {
      return NextResponse.json(
        { error: "Registered Representative workflow has not been started." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (body.action === "update_item") {
      const itemId = String(body.itemId || "").trim();
      const status = String(body.status || "").trim();

      const allowedStatuses = new Set([
        "outstanding",
        "ready",
        "completed",
        "not_applicable",
      ]);

      if (!itemId || !allowedStatuses.has(status)) {
        return NextResponse.json(
          { error: "Invalid checklist update." },
          { status: 400 }
        );
      }

      const { data: item, error: itemError } = await supabase
        .from("crm_registered_representative_items")
        .select("id, workflow_id, item_type")
        .eq("id", itemId)
        .eq("workflow_id", workflow.id)
        .maybeSingle();

      if (itemError) throw itemError;

      if (!item) {
        return NextResponse.json(
          { error: "Registered Representative checklist item not found." },
          { status: 404 }
        );
      }

      const { error: updateError } = await supabase
        .from("crm_registered_representative_items")
        .update({
          status,
          completed_at: status === "completed" ? now : null,
          completed_by_user_id:
            status === "completed" ? auth.user.id : null,
          updated_at: now,
        })
        .eq("id", item.id);

      if (updateError) throw updateError;
    } else if (body.action === "update_workflow") {
      const allowedStatuses = new Set([
        "not_started",
        "documents_required",
        "ready_for_signature",
        "ready_for_submission",
        "submitted",
        "confirmed",
      ]);

      const nextStatus =
        body.status === undefined ? workflow.status : String(body.status || "");

      if (!allowedStatuses.has(nextStatus)) {
        return NextResponse.json(
          { error: "Invalid Registered Representative status." },
          { status: 400 }
        );
      }

      let directorId = workflow.director_id;

      if (body.directorId !== undefined) {
        directorId = String(body.directorId || "").trim() || null;

        if (directorId) {
          const { data: director, error: directorError } = await supabase
            .from("crm_client_directors")
            .select("id")
            .eq("id", directorId)
            .eq("client_id", clientId)
            .maybeSingle();

          if (directorError) throw directorError;

          if (!director) {
            return NextResponse.json(
              { error: "Selected director was not found for this client." },
              { status: 400 }
            );
          }
        }
      }

      const payload: Record<string, any> = {
        director_id: directorId,
        status: nextStatus,
        resolution_date:
          body.resolutionDate === undefined
            ? workflow.resolution_date
            : body.resolutionDate || null,
        submission_date:
          body.submissionDate === undefined
            ? workflow.submission_date
            : body.submissionDate || null,
        confirmation_date:
          body.confirmationDate === undefined
            ? workflow.confirmation_date
            : body.confirmationDate || null,
        notes:
          body.notes === undefined
            ? workflow.notes
            : String(body.notes || "").trim() || null,
        updated_at: now,
      };

      if (nextStatus === "submitted" && !payload.submission_date) {
        payload.submission_date = now.slice(0, 10);
      }

      if (nextStatus === "confirmed" && !payload.confirmation_date) {
        payload.confirmation_date = now.slice(0, 10);
      }

      const { error: updateError } = await supabase
        .from("crm_registered_representative_workflows")
        .update(payload)
        .eq("id", workflow.id);

      if (updateError) throw updateError;
    } else {
      return NextResponse.json(
        { error: "Unknown Registered Representative action." },
        { status: 400 }
      );
    }

    const workspace = await loadWorkspace(supabase, clientId);

    return NextResponse.json({
      success: true,
      ...workspace,
    });
  } catch (error: any) {
    console.error("Registered Representative PATCH failed:", error);

    return NextResponse.json(
      { error: error?.message || "Could not update Registered Representative." },
      { status: 500 }
    );
  }
}
