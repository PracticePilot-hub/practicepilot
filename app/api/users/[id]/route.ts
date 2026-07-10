import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseSecretKey) {
  throw new Error("Missing server Supabase key");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function getUserProfileId(context: any) {
  const params = await context.params;
  return String(params.id || "");
}

function isAdminRole(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function isInternalRole(role: string) {
  return role === "Super Admin" || role === "Admin" || role === "Staff";
}

export async function PATCH(req: Request, context: any) {
  const id = await getUserProfileId(context);
  const body = await req.json();

  const updateData: Record<string, any> = {};

  let nextRole: string | null = null;

  if (body.fullName !== undefined) {
    updateData.full_name = String(body.fullName || "").trim() || null;
  }

  if (body.email !== undefined) {
    updateData.email = String(body.email || "").trim().toLowerCase();
  }

  if (body.role !== undefined) {
    nextRole = String(body.role || "Client Viewer").trim();
    updateData.role = nextRole;
  }

  if (body.accessEnabled !== undefined) {
    updateData.access_enabled = Boolean(body.accessEnabled);
  }

  if (body.organisationId !== undefined) {
    const organisationId = String(body.organisationId || "").trim();
    updateData.organisation_id = organisationId || null;
  }

  if (body.canAccessCrm !== undefined) {
    updateData.can_access_crm = Boolean(body.canAccessCrm);
  }

  if (body.canAccessAccounting !== undefined) {
    updateData.can_access_accounting = Boolean(body.canAccessAccounting);
  }

  if (body.canAccessAfs !== undefined) {
    updateData.can_access_afs = Boolean(body.canAccessAfs);
  }

  if (body.canAccessSecretarial !== undefined) {
    updateData.can_access_secretarial = Boolean(body.canAccessSecretarial);
  }

  if (body.canAccessProjects !== undefined) {
    updateData.can_access_projects = Boolean(body.canAccessProjects);
  }

  if (body.canAccessBudgeting !== undefined) {
    updateData.can_access_budgeting = Boolean(body.canAccessBudgeting);
  }

  if (body.canAccessManagementReports !== undefined) {
    updateData.can_access_management_reports = Boolean(
      body.canAccessManagementReports
    );
  }

  if (body.canAccessPaia !== undefined) {
    updateData.can_access_paia = Boolean(body.canAccessPaia);
  }

  if (body.canEditProjects !== undefined) {
    updateData.can_edit_projects = Boolean(body.canEditProjects);
  }

  if (nextRole) {
    const adminRole = isAdminRole(nextRole);
    const internalRole = isInternalRole(nextRole);

    if (internalRole) {
      updateData.organisation_id = null;
    }

    if (adminRole) {
      updateData.can_edit_projects = true;
      updateData.can_access_crm = true;
      updateData.can_access_accounting = true;
      updateData.can_access_afs = true;
      updateData.can_access_secretarial = true;
      updateData.can_access_projects = true;
      updateData.can_access_budgeting = true;
      updateData.can_access_management_reports = true;
      updateData.can_access_paia = true;
    }

    if (nextRole === "Client Viewer") {
      updateData.can_edit_projects = false;
      updateData.can_access_crm = false;
      updateData.can_access_accounting = false;
      updateData.can_access_afs = false;
      updateData.can_access_secretarial = false;
      updateData.can_access_projects = false;
      updateData.can_access_budgeting = false;
      updateData.can_access_management_reports = false;
      updateData.can_access_paia = false;
    }

    if (nextRole === "Client Manager") {
  // Client Managers may be given module access, but the tick boxes must remain the source of truth.
  // Do not force Projects on just because the role is Client Manager.
  if (body.canEditProjects === undefined && updateData.can_access_projects === false) {
    updateData.can_edit_projects = false;
  }
}
  }

  if (updateData.can_access_projects === false) {
    updateData.can_edit_projects = false;
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