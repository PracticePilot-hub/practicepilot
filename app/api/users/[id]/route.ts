import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseSecretKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function getUserProfileId(context: any) {
  const params = await context.params;
  return String(params.id || "");
}

export async function PATCH(req: Request, context: any) {
  const id = await getUserProfileId(context);
  const body = await req.json();

  const updateData: Record<string, any> = {};

  if (body.fullName !== undefined) {
    updateData.full_name = String(body.fullName || "").trim() || null;
  }

  if (body.email !== undefined) {
    updateData.email = String(body.email || "").trim().toLowerCase();
  }

  if (body.role !== undefined) {
    updateData.role = String(body.role || "Client Viewer").trim();
  }

  if (body.organisationId !== undefined) {
    const organisationId = String(body.organisationId || "").trim();
    updateData.organisation_id = organisationId || null;
  }

  if (body.canEditProjects !== undefined) {
    updateData.can_edit_projects = Boolean(body.canEditProjects);
  }

  if (body.canAccessAccounting !== undefined) {
  updateData.can_access_accounting = Boolean(body.canAccessAccounting);
}

if (body.canAccessProjects !== undefined) {
  updateData.can_access_projects = Boolean(body.canAccessProjects);
}

if (body.canAccessBudgeting !== undefined) {
  updateData.can_access_budgeting = Boolean(body.canAccessBudgeting);
}
  if (body.accessEnabled !== undefined) {
    updateData.access_enabled = Boolean(body.accessEnabled);
  }

  const role = updateData.role;

  if (role === "Super Admin" || role === "Admin" || role === "Staff") {
  updateData.organisation_id = null;
  updateData.can_edit_projects = true;
  updateData.can_access_accounting = true;
  updateData.can_access_projects = true;
  updateData.can_access_budgeting = true;
}

  if (role === "Client Viewer") {
    updateData.can_edit_projects = false;
  }

  if (role === "Client Manager") {
    updateData.can_edit_projects = true;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      organisations (
        id,
        name
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}