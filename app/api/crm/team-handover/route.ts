import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceKey) {
  throw new Error("Missing Supabase service-role key");
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const CLOSED_STATUSES = new Set([
  "completed",
  "complete",
  "done",
  "closed",
  "cancelled",
]);

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function canManage(profile: any) {
  return Boolean(
    profile?.is_practice_owner ||
      profile?.can_manage_practice_users ||
      ["Client Manager", "Admin", "Super Admin"].includes(
        String(profile?.role || "")
      )
  );
}

async function getContext(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return {
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
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,full_name,email,role,access_enabled,can_access_crm,can_manage_practice_users,is_practice_owner"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !profile.organisation_id ||
    profile.access_enabled === false ||
    profile.can_access_crm === false ||
    !canManage(profile)
  ) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Practice manager CRM access is required." },
        { status: 403 }
      ),
    };
  }

  return {
    profile,
    response: null,
  };
}

async function getTeam(organisationId: string) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("id,user_id,full_name,email,access_enabled")
    .eq("organisation_id", organisationId)
    .order("access_enabled", { ascending: false })
    .order("full_name", { ascending: true });

  if (error) throw error;

  return data || [];
}

async function getDepartingProfile(
  organisationId: string,
  profileId: string
) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("id,user_id,full_name,email,access_enabled")
    .eq("organisation_id", organisationId)
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("The selected staff member could not be found.");
  }

  return data;
}

async function loadPreview(
  organisationId: string,
  departingProfileId: string
) {
  const departing = await getDepartingProfile(
    organisationId,
    departingProfileId
  );

  const [leadResult, managerResult, partnerResult] =
    await Promise.all([
      admin
        .from("crm_clients")
        .select("id,client_name")
        .eq("organisation_id", organisationId)
        .eq("client_lead_user_id", departingProfileId),

      admin
        .from("crm_clients")
        .select("id,client_name")
        .eq("organisation_id", organisationId)
        .eq("manager_user_id", departingProfileId),

      admin
        .from("crm_clients")
        .select("id,client_name")
        .eq("organisation_id", organisationId)
        .eq("partner_user_id", departingProfileId),
    ]);

  if (leadResult.error) throw leadResult.error;
  if (managerResult.error) throw managerResult.error;
  if (partnerResult.error) throw partnerResult.error;

  const clientAllocations = [
    ...(leadResult.data || []).map((client) => ({
      client_id: client.id,
      client_name: client.client_name,
      allocation_type: "client_lead" as const,
    })),
    ...(managerResult.data || []).map((client) => ({
      client_id: client.id,
      client_name: client.client_name,
      allocation_type: "manager" as const,
    })),
    ...(partnerResult.data || []).map((client) => ({
      client_id: client.id,
      client_name: client.client_name,
      allocation_type: "partner" as const,
    })),
  ].sort((a, b) =>
    a.client_name.localeCompare(b.client_name)
  );

  let openWork: any[] = [];

  if (departing.user_id) {
    const { data: workRows, error: workError } = await admin
      .from("crm_work_items")
      .select(
        "id,client_id,title,status,due_date,assigned_user_id"
      )
      .eq("organisation_id", organisationId)
      .eq("assigned_user_id", departing.user_id)
      .order("due_date", {
        ascending: true,
        nullsFirst: false,
      });

    if (workError) throw workError;

    const filteredWork = (workRows || []).filter(
      (item) =>
        !CLOSED_STATUSES.has(
          String(item.status || "").trim().toLowerCase()
        )
    );

    const clientIds = Array.from(
      new Set(
        filteredWork
          .map((item) => item.client_id)
          .filter(Boolean)
      )
    );

    const clientNameById = new Map<string, string>();

    if (clientIds.length) {
      const { data: clientRows, error: clientError } =
        await admin
          .from("crm_clients")
          .select("id,client_name")
          .eq("organisation_id", organisationId)
          .in("id", clientIds);

      if (clientError) throw clientError;

      for (const client of clientRows || []) {
        clientNameById.set(
          String(client.id),
          String(client.client_name || "")
        );
      }
    }

    openWork = filteredWork.map((item) => ({
      id: item.id,
      client_id: item.client_id,
      client_name: item.client_id
        ? clientNameById.get(String(item.client_id)) || null
        : null,
      title: item.title,
      status: item.status,
      due_date: item.due_date,
    }));
  }

  return {
    departing,
    client_allocations: clientAllocations,
    open_work: openWork,
    counts: {
      client_lead: leadResult.data?.length || 0,
      manager: managerResult.data?.length || 0,
      partner: partnerResult.data?.length || 0,
      open_work: openWork.length,
    },
  };
}

async function ensureReplacement(
  organisationId: string,
  profileId: string | null
) {
  if (!profileId) return null;

  const { data, error } = await admin
    .from("user_profiles")
    .select("id,user_id,full_name,email,access_enabled")
    .eq("organisation_id", organisationId)
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;

  if (!data || data.access_enabled === false) {
    throw new Error(
      "A replacement staff member is missing or inactive."
    );
  }

  return data;
}

export async function GET(request: Request) {
  try {
    const { profile, response } = await getContext(request);

    if (response || !profile) return response;

    const organisationId = profile.organisation_id;
    const url = new URL(request.url);
    const departingProfileId = String(
      url.searchParams.get("departingProfileId") || ""
    ).trim();

    if (!departingProfileId) {
      const team = await getTeam(organisationId);

      return NextResponse.json({
        success: true,
        team,
      });
    }

    const preview = await loadPreview(
      organisationId,
      departingProfileId
    );

    return NextResponse.json({
      success: true,
      ...preview,
    });
  } catch (error) {
    console.error("CRM TEAM HANDOVER GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the staff handover.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile, response } = await getContext(request);

    if (response || !profile) return response;

    const organisationId = profile.organisation_id;
    const body = await request.json();

    const departingProfileId = String(
      body.departingProfileId || ""
    ).trim();

    const leadReplacementProfileId = body.leadReplacementProfileId
      ? String(body.leadReplacementProfileId).trim()
      : null;

    const managerReplacementProfileId =
      body.managerReplacementProfileId
        ? String(body.managerReplacementProfileId).trim()
        : null;

    const partnerReplacementProfileId =
      body.partnerReplacementProfileId
        ? String(body.partnerReplacementProfileId).trim()
        : null;

    const workReplacementProfileId =
      body.workReplacementProfileId
        ? String(body.workReplacementProfileId).trim()
        : null;

    const disableAccess = body.disableAccess !== false;

    if (!departingProfileId) {
      return NextResponse.json(
        { error: "Departing staff member is required." },
        { status: 400 }
      );
    }

    if (
      [
        leadReplacementProfileId,
        managerReplacementProfileId,
        partnerReplacementProfileId,
        workReplacementProfileId,
      ].includes(departingProfileId)
    ) {
      return NextResponse.json(
        {
          error:
            "The departing staff member cannot be their own replacement.",
        },
        { status: 400 }
      );
    }

    const preview = await loadPreview(
      organisationId,
      departingProfileId
    );

    const leadReplacement = await ensureReplacement(
      organisationId,
      leadReplacementProfileId
    );

    const managerReplacement = await ensureReplacement(
      organisationId,
      managerReplacementProfileId
    );

    const partnerReplacement = await ensureReplacement(
      organisationId,
      partnerReplacementProfileId
    );

    const workReplacement = await ensureReplacement(
      organisationId,
      workReplacementProfileId
    );

    if (
      preview.counts.client_lead > 0 &&
      !leadReplacement
    ) {
      throw new Error("Replacement Client Lead is required.");
    }

    if (
      preview.counts.manager > 0 &&
      !managerReplacement
    ) {
      throw new Error("Replacement Manager is required.");
    }

    if (
      preview.counts.partner > 0 &&
      !partnerReplacement
    ) {
      throw new Error("Replacement Partner is required.");
    }

    if (
      preview.counts.open_work > 0 &&
      (!workReplacement || !workReplacement.user_id)
    ) {
      throw new Error(
        "Replacement for open work is required."
      );
    }

    const { data: batch, error: batchError } = await admin
      .from("crm_staff_handover_batches")
      .insert({
        organisation_id: organisationId,
        departing_profile_id: departingProfileId,
        status: "processing",
        disable_user_access_on_complete: disableAccess,
        created_by_profile_id: profile.id,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (batchError) throw batchError;

    const batchId = batch.id;
    let reassignedClients = 0;
    let reassignedWork = 0;

    const allocationPlans = [
      {
        field: "client_lead_user_id",
        type: "client_lead",
        replacement: leadReplacement,
      },
      {
        field: "manager_user_id",
        type: "manager",
        replacement: managerReplacement,
      },
      {
        field: "partner_user_id",
        type: "partner",
        replacement: partnerReplacement,
      },
    ] as const;

    for (const plan of allocationPlans) {
      if (!plan.replacement) continue;

      const matchingAllocations =
        preview.client_allocations.filter(
          (item) => item.allocation_type === plan.type
        );

      if (!matchingAllocations.length) continue;

      const clientIds = matchingAllocations.map(
        (item) => item.client_id
      );

      const historyRows = clientIds.map((clientId) => ({
        organisation_id: organisationId,
        client_id: clientId,
        assignment_type: plan.type,
        from_profile_id: departingProfileId,
        to_profile_id: plan.replacement!.id,
        change_source: "staff_handover",
        handover_batch_id: batchId,
        changed_by_profile_id: profile.id,
      }));

      const { error: historyError } = await admin
        .from("crm_client_assignment_history")
        .insert(historyRows);

      if (historyError) throw historyError;

      const handoverRows = clientIds.map((clientId) => ({
        organisation_id: organisationId,
        handover_batch_id: batchId,
        item_type: plan.type,
        client_id: clientId,
        from_profile_id: departingProfileId,
        to_profile_id: plan.replacement!.id,
        item_status: "ready",
      }));

      const { error: itemError } = await admin
        .from("crm_staff_handover_items")
        .insert(handoverRows);

      if (itemError) throw itemError;

      const { error: updateError } = await admin
        .from("crm_clients")
        .update({
          [plan.field]: plan.replacement.id,
        })
        .eq("organisation_id", organisationId)
        .in("id", clientIds)
        .eq(plan.field, departingProfileId);

      if (updateError) throw updateError;

      const { error: markError } = await admin
        .from("crm_staff_handover_items")
        .update({
          item_status: "reassigned",
        })
        .eq("organisation_id", organisationId)
        .eq("handover_batch_id", batchId)
        .eq("item_type", plan.type);

      if (markError) throw markError;

      reassignedClients += clientIds.length;
    }

    if (
      preview.open_work.length &&
      workReplacement?.user_id
    ) {
      const workIds = preview.open_work.map(
        (item) => item.id
      );

      const handoverRows = preview.open_work.map(
        (item) => ({
          organisation_id: organisationId,
          handover_batch_id: batchId,
          item_type: "open_work_item",
          client_id: item.client_id || null,
          work_item_id: item.id,
          from_profile_id: departingProfileId,
          to_profile_id: workReplacement.id,
          from_auth_user_id:
            preview.departing.user_id || null,
          to_auth_user_id: workReplacement.user_id,
          item_status: "ready",
        })
      );

      const { error: itemError } = await admin
        .from("crm_staff_handover_items")
        .insert(handoverRows);

      if (itemError) throw itemError;

      const { error: workUpdateError } = await admin
        .from("crm_work_items")
        .update({
          assigned_user_id: workReplacement.user_id,
        })
        .eq("organisation_id", organisationId)
        .in("id", workIds)
        .eq(
          "assigned_user_id",
          preview.departing.user_id
        );

      if (workUpdateError) throw workUpdateError;

      const { error: workMarkError } = await admin
        .from("crm_staff_handover_items")
        .update({
          item_status: "reassigned",
        })
        .eq("organisation_id", organisationId)
        .eq("handover_batch_id", batchId)
        .eq("item_type", "open_work_item");

      if (workMarkError) throw workMarkError;

      reassignedWork = workIds.length;
    }

    if (disableAccess) {
      const { error: disableError } = await admin
        .from("user_profiles")
        .update({
          access_enabled: false,
        })
        .eq("organisation_id", organisationId)
        .eq("id", departingProfileId);

      if (disableError) throw disableError;
    }

    const { error: completeError } = await admin
      .from("crm_staff_handover_batches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("organisation_id", organisationId)
      .eq("id", batchId);

    if (completeError) throw completeError;

    return NextResponse.json({
      success: true,
      handover_batch_id: batchId,
      reassigned_clients: reassignedClients,
      reassigned_work: reassignedWork,
      access_disabled: disableAccess,
    });
  } catch (error) {
    console.error("CRM TEAM HANDOVER POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not complete the staff handover.",
      },
      { status: 500 }
    );
  }
}
