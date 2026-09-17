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
    .select("id, organisation_id, access_enabled, can_access_crm")
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

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await getAuthenticatedProfile(req);
    const organisationId = profile.organisation_id;
    const url = new URL(req.url);
    const groupId = String(url.searchParams.get("groupId") || "").trim();

    if (groupId) {
      const { data: group, error: groupError } = await supabase
        .from("crm_client_groups")
        .select(
          "id, organisation_id, group_name, group_code, notes, is_active, created_at, updated_at"
        )
        .eq("organisation_id", organisationId)
        .eq("id", groupId)
        .eq("is_active", true)
        .maybeSingle();

      if (groupError) throw groupError;

      if (!group) {
        return NextResponse.json(
          { success: false, error: "Client group not found." },
          { status: 404 }
        );
      }

      const { data: members, error: membersError } = await supabase
        .from("crm_client_group_members")
        .select(
          "id, group_id, client_id, relationship_label, is_primary, is_active, created_at"
        )
        .eq("organisation_id", organisationId)
        .eq("group_id", groupId)
        .eq("is_active", true);

      if (membersError) throw membersError;

      const clientIds = Array.from(
        new Set(
          (members || [])
            .map((member: any) => member.client_id)
            .filter(Boolean)
        )
      );

      let clients: any[] = [];
      let workItems: any[] = [];

      if (clientIds.length) {
        const [
          { data: clientData, error: clientError },
          { data: workData, error: workError },
        ] = await Promise.all([
          supabase
            .from("crm_clients")
            .select(
              "id, client_name, registration_number, id_passport_number, client_category, relationship_status, entity_type, client_code"
            )
            .eq("organisation_id", organisationId)
            .in("id", clientIds)
            .order("client_name", { ascending: true }),

          supabase
            .from("crm_work_items")
            .select(
              "id, client_id, title, status, due_date, service_code, assigned_user_id, completed_at"
            )
            .eq("organisation_id", organisationId)
            .in("client_id", clientIds)
            .neq("status", "cancelled")
            .order("due_date", { ascending: true, nullsFirst: false }),
        ]);

        if (clientError) throw clientError;
        if (workError) throw workError;

        clients = clientData || [];
        workItems = workData || [];
      }

      const { data: memberOptions, error: memberOptionsError } = await supabase
        .from("crm_clients")
        .select(
          "id, client_name, registration_number, id_passport_number, client_category, relationship_status, entity_type, client_code"
        )
        .eq("organisation_id", organisationId)
        .order("client_name", { ascending: true });

      if (memberOptionsError) throw memberOptionsError;

      return NextResponse.json({
        success: true,
        group,
        members: members || [],
        clients,
        workItems,
        memberOptions: memberOptions || [],
      });
    }

    const [
      { data: groups, error: groupsError },
      { data: members, error: membersError },
      { data: clients, error: clientsError },
    ] = await Promise.all([
      supabase
        .from("crm_client_groups")
        .select("id, group_name, group_code, notes, is_active, created_at, updated_at")
        .eq("organisation_id", organisationId)
        .eq("is_active", true)
        .order("group_name", { ascending: true }),
      supabase
        .from("crm_client_group_members")
        .select(
          "id, group_id, client_id, relationship_label, is_primary, is_active, created_at"
        )
        .eq("organisation_id", organisationId)
        .eq("is_active", true),
      supabase
        .from("crm_clients")
        .select(
          "id, client_name, client_category, relationship_status, registration_number, id_passport_number"
        )
        .eq("organisation_id", organisationId)
        .order("client_name", { ascending: true }),
    ]);

    if (groupsError) throw groupsError;
    if (membersError) throw membersError;
    if (clientsError) throw clientsError;

    const allClientIds = Array.from(
      new Set(
        (members || [])
          .map((member: any) => member.client_id)
          .filter(Boolean)
      )
    );

    let workItems: any[] = [];

    if (allClientIds.length) {
      const { data: workData, error: workError } = await supabase
        .from("crm_work_items")
        .select("id, client_id, status, due_date")
        .eq("organisation_id", organisationId)
        .in("client_id", allClientIds)
        .neq("status", "cancelled");

      if (workError) throw workError;
      workItems = workData || [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const closedStatuses = new Set([
      "completed",
      "complete",
      "done",
      "closed",
      "cancelled",
    ]);

    const clientById = new Map(
      (clients || []).map((client: any) => [client.id, client])
    );

    const groupStats = (groups || []).map((group: any) => {
      const groupMembers = (members || []).filter(
        (member: any) => member.group_id === group.id
      );

      const memberIds = new Set(
        groupMembers.map((member: any) => member.client_id)
      );

      let flyingClients = 0;
      let openWork = 0;
      let overdue = 0;

      for (const member of groupMembers) {
        const client: any = clientById.get(member.client_id);
        if (client?.relationship_status === "flying_client") {
          flyingClients += 1;
        }
      }

      for (const item of workItems) {
        if (!memberIds.has(item.client_id)) continue;

        const status = String(item.status || "").trim().toLowerCase();
        if (closedStatuses.has(status)) continue;

        openWork += 1;

        if (item.due_date) {
          const due = new Date(`${item.due_date}T00:00:00`);
          if (due < today) overdue += 1;
        }
      }

      return {
        group_id: group.id,
        members: groupMembers.length,
        flying_clients: flyingClients,
        open_work: openWork,
        overdue,
      };
    });

    return NextResponse.json({
      success: true,
      groups: groups || [],
      members: members || [],
      clients: clients || [],
      groupStats,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load client groups.";

    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("signed in") || message.includes("session") ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, profile } = await getAuthenticatedProfile(req);
    const organisationId = profile.organisation_id;
    const body = await req.json();

    const action = String(body?.action || "").trim();

    if (action === "create_group") {
      const groupName = String(body?.groupName || "").trim();
      const groupCode =
        typeof body?.groupCode === "string" ? body.groupCode.trim() || null : null;
      const notes =
        typeof body?.notes === "string" ? body.notes.trim() || null : null;

      if (!groupName) {
        return NextResponse.json(
          { success: false, error: "Group name is required." },
          { status: 400 }
        );
      }

      const { data: created, error } = await supabase
        .from("crm_client_groups")
        .insert({
          organisation_id: organisationId,
          group_name: groupName,
          group_code: groupCode,
          notes,
          is_active: true,
        })
        .select("id")
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        groupId: created.id,
      });
    }

    if (action === "update_group") {
      const groupId = String(body?.groupId || "").trim();
      const groupName = String(body?.groupName || "").trim();
      const groupCode =
        typeof body?.groupCode === "string" ? body.groupCode.trim() || null : null;
      const notes =
        typeof body?.notes === "string" ? body.notes.trim() || null : null;

      if (!groupId || !groupName) {
        return NextResponse.json(
          { success: false, error: "Group ID and group name are required." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("crm_client_groups")
        .update({
          group_name: groupName,
          group_code: groupCode,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId)
        .eq("organisation_id", organisationId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    if (action === "add_member") {
      const groupId = String(body?.groupId || "").trim();
      const clientId = String(body?.clientId || "").trim();
      const relationshipLabel =
        typeof body?.relationshipLabel === "string"
          ? body.relationshipLabel.trim() || null
          : null;
      const isPrimary = Boolean(body?.isPrimary);

      if (!groupId || !clientId) {
        return NextResponse.json(
          { success: false, error: "Group and CRM record are required." },
          { status: 400 }
        );
      }

      const [{ data: group, error: groupError }, { data: client, error: clientError }] =
        await Promise.all([
          supabase
            .from("crm_client_groups")
            .select("id")
            .eq("id", groupId)
            .eq("organisation_id", organisationId)
            .eq("is_active", true)
            .maybeSingle(),
          supabase
            .from("crm_clients")
            .select("id")
            .eq("id", clientId)
            .eq("organisation_id", organisationId)
            .maybeSingle(),
        ]);

      if (groupError) throw groupError;
      if (clientError) throw clientError;

      if (!group || !client) {
        return NextResponse.json(
          { success: false, error: "Group or CRM record not found." },
          { status: 404 }
        );
      }

      if (isPrimary) {
        const { error: clearError } = await supabase
          .from("crm_client_group_members")
          .update({
            is_primary: false,
            updated_at: new Date().toISOString(),
          })
          .eq("group_id", groupId)
          .eq("organisation_id", organisationId)
          .eq("is_active", true);

        if (clearError) throw clearError;
      }

      const { data: existing, error: existingError } = await supabase
        .from("crm_client_group_members")
        .select("id, is_active")
        .eq("group_id", groupId)
        .eq("client_id", clientId)
        .eq("organisation_id", organisationId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { error } = await supabase
          .from("crm_client_group_members")
          .update({
            relationship_label: relationshipLabel,
            is_primary: isPrimary,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("organisation_id", organisationId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("crm_client_group_members")
          .insert({
            organisation_id: organisationId,
            group_id: groupId,
            client_id: clientId,
            relationship_label: relationshipLabel,
            is_primary: isPrimary,
            is_active: true,
          });

        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    if (action === "set_primary") {
      const groupId = String(body?.groupId || "").trim();
      const memberId = String(body?.memberId || "").trim();

      if (!groupId || !memberId) {
        return NextResponse.json(
          { success: false, error: "Group and member are required." },
          { status: 400 }
        );
      }

      const { error: clearError } = await supabase
        .from("crm_client_group_members")
        .update({
          is_primary: false,
          updated_at: new Date().toISOString(),
        })
        .eq("group_id", groupId)
        .eq("organisation_id", organisationId)
        .eq("is_active", true);

      if (clearError) throw clearError;

      const { error } = await supabase
        .from("crm_client_group_members")
        .update({
          is_primary: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId)
        .eq("group_id", groupId)
        .eq("organisation_id", organisationId)
        .eq("is_active", true);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    if (action === "remove_member") {
      const memberId = String(body?.memberId || "").trim();

      if (!memberId) {
        return NextResponse.json(
          { success: false, error: "Member ID is required." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("crm_client_group_members")
        .update({
          is_active: false,
          is_primary: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId)
        .eq("organisation_id", organisationId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    if (action === "archive_group") {
      const groupId = String(body?.groupId || "").trim();

      if (!groupId) {
        return NextResponse.json(
          { success: false, error: "Group ID is required." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("crm_client_groups")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId)
        .eq("organisation_id", organisationId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid client-group action." },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update client group.";

    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("already exists") ? 409 : 500 }
    );
  }
}
