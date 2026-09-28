import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!key) throw new Error("Missing Supabase service-role key");

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function tokenFrom(request: Request) {
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

async function currentContext(request: Request) {
  const token = tokenFrom(request);

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
  } = await admin.auth.getUser(token);

  if (!user) {
    return {
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
      "id,user_id,organisation_id,role,access_enabled,can_access_crm,can_manage_practice_users,is_practice_owner"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    error ||
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

  return { profile, response: null };
}

const allowedFields = new Set([
  "relationship_status",
  "client_category",
  "engagement_type",
  "client_lead_user_id",
  "manager_user_id",
  "partner_user_id",
  "year_end",
]);

function assignmentType(field: string) {
  if (field === "client_lead_user_id") return "client_lead";
  if (field === "manager_user_id") return "manager";
  if (field === "partner_user_id") return "partner";
  return null;
}

export async function GET(request: Request) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const organisationId = profile.organisation_id;

    const [
      clientsResult,
      teamResult,
      groupsResult,
      groupMembersResult,
    ] = await Promise.all([
      admin
        .from("crm_clients")
        .select(
          "id,client_name,client_code,client_category,engagement_type,relationship_status,year_end,client_lead_user_id,manager_user_id,partner_user_id"
        )
        .eq("organisation_id", organisationId)
        .order("client_name", { ascending: true }),

      admin
        .from("user_profiles")
        .select("id,full_name,email,access_enabled")
        .eq("organisation_id", organisationId)
        .order("access_enabled", { ascending: false })
        .order("full_name", { ascending: true }),

      admin
        .from("crm_client_groups")
        .select("id,group_name,group_code")
        .eq("organisation_id", organisationId)
        .eq("is_active", true)
        .order("group_name", { ascending: true }),

      admin
        .from("crm_client_group_members")
        .select("id,group_id,client_id,is_active")
        .eq("organisation_id", organisationId)
        .eq("is_active", true),
    ]);

    if (clientsResult.error) throw clientsResult.error;
    if (teamResult.error) throw teamResult.error;
    if (groupsResult.error) throw groupsResult.error;
    if (groupMembersResult.error) throw groupMembersResult.error;

    const groups = groupsResult.data || [];
    const groupMembers = groupMembersResult.data || [];

    const groupNameById = new Map<string, string>();

    for (const group of groups) {
      groupNameById.set(
        String(group.id),
        String(group.group_name || "")
      );
    }

    const membershipsByClient = new Map<
      string,
      { group_ids: string[]; group_names: string[] }
    >();

    for (const member of groupMembers) {
      const clientId = String(member.client_id || "");
      const groupId = String(member.group_id || "");

      if (!clientId || !groupId) continue;

      const current =
        membershipsByClient.get(clientId) || {
          group_ids: [],
          group_names: [],
        };

      if (!current.group_ids.includes(groupId)) {
        current.group_ids.push(groupId);
      }

      const groupName = groupNameById.get(groupId);

      if (
        groupName &&
        !current.group_names.includes(groupName)
      ) {
        current.group_names.push(groupName);
      }

      membershipsByClient.set(clientId, current);
    }

    const clients = (clientsResult.data || []).map((client) => {
      const membership =
        membershipsByClient.get(String(client.id)) || {
          group_ids: [],
          group_names: [],
        };

      return {
        ...client,
        group_ids: membership.group_ids,
        group_names: [...membership.group_names].sort((a, b) =>
          a.localeCompare(b)
        ),
      };
    });

    return NextResponse.json({
      success: true,
      clients,
      team: teamResult.data || [],
      groups,
    });
  } catch (error) {
    console.error("CRM BULK EDIT GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the bulk client editor.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const organisationId = profile.organisation_id;
    const body = await request.json();

    const clientIds: string[] = Array.isArray(body.clientIds)
      ? (body.clientIds as unknown[])
          .map((value: unknown) => String(value || "").trim())
          .filter((value: string): value is string => Boolean(value))
      : [];

    const field = String(body.field || "").trim();

    const value =
      body.value === null ||
      body.value === undefined ||
      body.value === ""
        ? null
        : String(body.value).trim();

    if (!clientIds.length) {
      return NextResponse.json(
        { error: "Select at least one client." },
        { status: 400 }
      );
    }

    const isGroupAction =
      field === "group_add" ||
      field === "group_remove";

    if (!allowedFields.has(field) && !isGroupAction) {
      return NextResponse.json(
        { error: "That field is not available for bulk editing." },
        { status: 400 }
      );
    }

    const { data: currentRows, error: currentError } = await admin
      .from("crm_clients")
      .select(
        "id,relationship_status,client_category,engagement_type,year_end,client_lead_user_id,manager_user_id,partner_user_id"
      )
      .eq("organisation_id", organisationId)
      .in("id", clientIds);

    if (currentError) throw currentError;

    if ((currentRows || []).length !== clientIds.length) {
      return NextResponse.json(
        {
          error:
            "One or more selected clients do not belong to this practice.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------
    // GROUP ACTIONS
    // -----------------------------------------------------------------
    if (isGroupAction) {
      let groupId = value;
      let group:
        | {
            id: string;
            group_name: string;
            group_code: string | null;
          }
        | null = null;

      if (field === "group_add" && value === "__new__") {
        const groupName = String(body.groupName || "").trim();

        if (!groupName) {
          return NextResponse.json(
            { error: "New group name is required." },
            { status: 400 }
          );
        }

        const { data: existingGroups, error: existingGroupsError } =
          await admin
            .from("crm_client_groups")
            .select("id,group_name,group_code")
            .eq("organisation_id", organisationId)
            .eq("is_active", true)
            .ilike("group_name", groupName)
            .limit(1);

        if (existingGroupsError) throw existingGroupsError;

        if (existingGroups?.length) {
          group = existingGroups[0];
          groupId = group.id;
        } else {
          const {
            data: createdGroup,
            error: createGroupError,
          } = await admin
            .from("crm_client_groups")
            .insert({
              organisation_id: organisationId,
              group_name: groupName,
              group_code: null,
              notes: null,
              is_active: true,
            })
            .select("id,group_name,group_code")
            .single();

          if (createGroupError) throw createGroupError;

          group = createdGroup;
          groupId = createdGroup.id;
        }
      } else {
        if (!groupId) {
          return NextResponse.json(
            { error: "Choose a client group." },
            { status: 400 }
          );
        }

        const { data: foundGroup, error: groupError } =
          await admin
            .from("crm_client_groups")
            .select("id,group_name,group_code")
            .eq("id", groupId)
            .eq("organisation_id", organisationId)
            .eq("is_active", true)
            .maybeSingle();

        if (groupError) throw groupError;

        if (!foundGroup) {
          return NextResponse.json(
            { error: "Client group not found." },
            { status: 404 }
          );
        }

        group = foundGroup;
      }

      if (!group || !groupId) {
        return NextResponse.json(
          { error: "Client group could not be resolved." },
          { status: 400 }
        );
      }

      if (field === "group_add") {
        const {
          data: existingMemberships,
          error: existingMembershipError,
        } = await admin
          .from("crm_client_group_members")
          .select("id,client_id,is_active")
          .eq("organisation_id", organisationId)
          .eq("group_id", groupId)
          .in("client_id", clientIds);

        if (existingMembershipError) {
          throw existingMembershipError;
        }

        const existingByClient = new Map<string, any>();

        for (const row of existingMemberships || []) {
          existingByClient.set(
            String(row.client_id),
            row
          );
        }

        const reactivateIds = (existingMemberships || [])
          .filter((row) => row.is_active === false)
          .map((row) => row.id);

        if (reactivateIds.length) {
          const { error: reactivateError } = await admin
            .from("crm_client_group_members")
            .update({
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("organisation_id", organisationId)
            .in("id", reactivateIds);

          if (reactivateError) throw reactivateError;
        }

        const newMemberships = clientIds
          .filter(
            (clientId) =>
              !existingByClient.has(clientId)
          )
          .map((clientId) => ({
            organisation_id: organisationId,
            group_id: groupId,
            client_id: clientId,
            relationship_label: null,
            is_primary: false,
            is_active: true,
          }));

        if (newMemberships.length) {
          const { error: insertError } = await admin
            .from("crm_client_group_members")
            .insert(newMemberships);

          if (insertError) throw insertError;
        }
      }

      if (field === "group_remove") {
        const { error: removeError } = await admin
          .from("crm_client_group_members")
          .update({
            is_active: false,
            is_primary: false,
            updated_at: new Date().toISOString(),
          })
          .eq("organisation_id", organisationId)
          .eq("group_id", groupId)
          .in("client_id", clientIds)
          .eq("is_active", true);

        if (removeError) throw removeError;
      }

      const groupActionType =
        field === "group_add"
          ? value === "__new__"
            ? "group_create_and_add"
            : "group_add"
          : "group_remove";

      const { error: auditError } = await admin
        .from("crm_bulk_client_edit_events")
        .insert({
          organisation_id: organisationId,
          action_type: groupActionType,
          client_ids: clientIds,
          before_snapshot: {},
          after_snapshot: {
            group_id: group.id,
            group_name: group.group_name,
          },
          affected_count: clientIds.length,
          changed_by_profile_id: profile.id,
        });

      if (auditError) throw auditError;

      return NextResponse.json({
        success: true,
        affected: clientIds.length,
        group,
      });
    }

    // -----------------------------------------------------------------
    // NORMAL CLIENT FIELD ACTIONS
    // -----------------------------------------------------------------
    if (
      [
        "client_lead_user_id",
        "manager_user_id",
        "partner_user_id",
      ].includes(field) &&
      value
    ) {
      const { data: member, error: memberError } =
        await admin
          .from("user_profiles")
          .select("id,access_enabled")
          .eq("id", value)
          .eq("organisation_id", organisationId)
          .maybeSingle();

      if (memberError) throw memberError;

      if (!member || member.access_enabled === false) {
        return NextResponse.json(
          {
            error:
              "Only an active team member can receive a new assignment.",
          },
          { status: 400 }
        );
      }
    }

    const type = assignmentType(field);

    if (type) {
      const history = (currentRows || [])
        .filter(
          (row: any) =>
            String(row[field] || "") !==
            String(value || "")
        )
        .map((row: any) => ({
          organisation_id: organisationId,
          client_id: row.id,
          assignment_type: type,
          from_profile_id: row[field] || null,
          to_profile_id: value,
          change_source: "bulk_editor",
          changed_by_profile_id: profile.id,
        }));

      if (history.length) {
        const { error: historyError } = await admin
          .from("crm_client_assignment_history")
          .insert(history);

        if (historyError) throw historyError;
      }
    }

    const { error: updateError } = await admin
      .from("crm_clients")
      .update({ [field]: value })
      .eq("organisation_id", organisationId)
      .in("id", clientIds);

    if (updateError) throw updateError;

    const beforeSnapshot = Object.fromEntries(
      (currentRows || []).map((row: any) => [
        row.id,
        row[field] ?? null,
      ])
    );

    const actionType =
      field === "relationship_status"
        ? "relationship_change"
        : field === "engagement_type"
          ? "service_relationship_change"
          : field === "client_category"
            ? "record_type_change"
            : field === "year_end"
              ? "year_end_change"
              : field === "client_lead_user_id"
                ? "client_lead_change"
                : field === "manager_user_id"
                  ? "manager_change"
                  : "partner_change";

    const { error: auditError } = await admin
      .from("crm_bulk_client_edit_events")
      .insert({
        organisation_id: organisationId,
        action_type: actionType,
        client_ids: clientIds,
        before_snapshot: beforeSnapshot,
        after_snapshot: { field, value },
        affected_count: clientIds.length,
        changed_by_profile_id: profile.id,
      });

    if (auditError) throw auditError;

    return NextResponse.json({
      success: true,
      affected: clientIds.length,
    });
  } catch (error) {
    console.error("CRM BULK EDIT PATCH ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not apply the bulk client change.",
      },
      { status: 500 }
    );
  }
}
