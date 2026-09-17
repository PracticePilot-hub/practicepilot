import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing Supabase admin environment variables.");
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function requireManager(request: Request) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) throw new Error("Not authenticated.");

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) throw new Error("Not authenticated.");

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select(
      "user_id, organisation_id, role, access_enabled, can_manage_practice_users"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  const canManage =
    profile?.access_enabled !== false &&
    !!profile?.organisation_id &&
    (
      profile?.role === "Super Admin" ||
      profile?.role === "Admin" ||
      profile?.role === "Client Manager" ||
      profile?.can_manage_practice_users === true
    );

  if (!canManage) {
    throw new Error("You do not have permission to manage capacity pools.");
  }

  return profile;
}

export async function GET(request: Request) {
  try {
    const profile = await requireManager(request);

    const [
      { data: clients, error: clientsError },
      { data: groups, error: groupsError },
      { data: pools, error: poolsError },
    ] = await Promise.all([
      admin
        .from("crm_clients")
        .select("id, client_name, client_code, relationship_status")
        .eq("organisation_id", profile.organisation_id)
        .neq("relationship_status", "former_client")
        .order("client_name"),

      admin
        .from("crm_client_groups")
        .select("id, group_name")
        .eq("organisation_id", profile.organisation_id)
        .order("group_name"),

      admin
        .from("crm_current_client_capacity_pools")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .order("scope_type"),
    ]);

    if (clientsError) throw clientsError;
    if (groupsError) throw groupsError;
    if (poolsError) throw poolsError;

    return NextResponse.json({
      success: true,
      clients: clients || [],
      groups: groups || [],
      pools: pools || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Could not load capacity pools." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireManager(request);
    const body = await request.json();

    const scopeType = String(body?.scopeType || "");
    const scopeId = String(body?.scopeId || "");
    const periodBasis = String(body?.periodBasis || "");
    const allocatedHours = Number(body?.allocatedHours || 0);

    if (!["client", "group"].includes(scopeType)) {
      throw new Error("Select whether the pool belongs to a client or a client group.");
    }

    if (!scopeId) throw new Error("Select a client or client group.");

    if (!["daily", "weekly", "monthly"].includes(periodBasis)) {
      throw new Error("Select daily, weekly or monthly.");
    }

    if (!Number.isFinite(allocatedHours) || allocatedHours < 0) {
      throw new Error("Allocated hours must be zero or higher.");
    }

    const clientId = scopeType === "client" ? scopeId : null;
    const clientGroupId = scopeType === "group" ? scopeId : null;

    const currentQuery = admin
      .from("crm_client_capacity_pools")
      .select("id")
      .eq("organisation_id", profile.organisation_id)
      .eq("is_active", true)
      .is("effective_to", null);

    if (clientId) currentQuery.eq("client_id", clientId);
    if (clientGroupId) currentQuery.eq("client_group_id", clientGroupId);

    const { data: current, error: currentError } = await currentQuery.maybeSingle();
    if (currentError) throw currentError;

    const payload = {
      organisation_id: profile.organisation_id,
      client_id: clientId,
      client_group_id: clientGroupId,
      pool_name: body?.poolName?.trim() || null,
      period_basis: periodBasis,
      allocated_hours: allocatedHours,
      allocation_type: body?.allocationType || "service_capacity",
      enforcement_mode: body?.enforcementMode || "measure_only",
      warning_percent: Number(body?.warningPercent ?? 80),
      rollover_policy: body?.rolloverPolicy || "none",
      include_in_capacity_planning: body?.includeInCapacityPlanning !== false,
      notes: body?.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (current?.id) {
      const { error } = await admin
        .from("crm_client_capacity_pools")
        .update(payload)
        .eq("id", current.id)
        .eq("organisation_id", profile.organisation_id);

      if (error) throw error;
    } else {
      const { error } = await admin
        .from("crm_client_capacity_pools")
        .insert({
          ...payload,
          effective_from: new Date().toISOString().slice(0, 10),
          is_active: true,
        });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Could not save capacity pool." },
      { status: 500 }
    );
  }
}
