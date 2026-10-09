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

if (!serviceKey) throw new Error("Missing Supabase server key");



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



type StaffContext = {

  authUser: any;

  staffProfile: {

    organisation_id: string;

  };

  client: {

    id: string;

    organisation_id: string;

    client_name: string;

  } | null;

};



async function requireStaff(

  request: Request,

  clientId?: string

): Promise<StaffContext> {

  const token = bearerToken(request);



  if (!token) throw new Error("Not authenticated.");



  const {

    data: { user: authenticatedUser },

    error: authError,

  } = await admin.auth.getUser(token);



  if (authError || !authenticatedUser) {

    throw new Error("Not authenticated.");

  }



  const { data: staffProfileRow, error: profileError } = await admin

    .from("user_profiles")

    .select("organisation_id,access_enabled,can_access_crm")

    .eq("user_id", authenticatedUser.id)

    .maybeSingle();



  if (

    profileError ||

    !staffProfileRow ||

    !staffProfileRow.organisation_id ||

    staffProfileRow.access_enabled === false ||

    staffProfileRow.can_access_crm === false

  ) {

    throw new Error("CRM access is required.");

  }



  const organisationId = String(staffProfileRow.organisation_id);



  let client: StaffContext["client"] = null;



  if (clientId) {

    const { data: clientRow, error: clientError } = await admin

      .from("crm_clients")

      .select("id,organisation_id,client_name")

      .eq("id", clientId)

      .eq("organisation_id", organisationId)

      .maybeSingle();



    if (clientError) throw clientError;

    if (!clientRow) throw new Error("Client not found.");



    client = clientRow;

  }



  return {

    authUser: authenticatedUser,

    staffProfile: {

      organisation_id: organisationId,

    },

    client,

  };

}



async function loadMeetingRows(

  organisationId: string,

  clientId: string

) {

  const { data: meetings, error: meetingError } = await admin

    .from("crm_client_meetings")

    .select("*")

    .eq("organisation_id", organisationId)

    .eq("client_id", clientId)

    .order("meeting_at", { ascending: false, nullsFirst: false })

    .order("created_at", { ascending: false });



  if (meetingError) throw meetingError;



  const ids = (meetings || []).map((row) => row.id);

  let actions: any[] = [];



  if (ids.length) {

    const { data, error } = await admin

      .from("crm_client_meeting_actions")

      .select("*")

      .in("meeting_id", ids)

      .order("sort_order", { ascending: true })

      .order("created_at", { ascending: true });



    if (error) throw error;

    actions = data || [];

  }



  return (meetings || []).map((meeting) => ({

    ...meeting,

    actions: actions.filter(

      (action) => action.meeting_id === meeting.id

    ),

  }));

}



export async function GET(

  request: Request,

  context: { params: Promise<{ id: string }> }

) {

  try {

    const { id: clientId } = await context.params;

    const ctx = await requireStaff(request, clientId);

    const client = ctx.client!;



    const [
      meetings,
      { data: portalUsers, error: portalUsersError },
      { data: staffUsers, error: staffUsersError },
    ] = await Promise.all([
      loadMeetingRows(ctx.staffProfile.organisation_id, clientId),
      admin
        .from("crm_client_portal_users")
        .select("id,full_name,email,portal_role,is_active")
        .eq("organisation_id", ctx.staffProfile.organisation_id)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      admin
        .from("user_profiles")
        .select("id,user_id,full_name,email")
        .eq("organisation_id", ctx.staffProfile.organisation_id)
        .eq("access_enabled", true)
        .order("full_name", { ascending: true }),
    ]);

    if (portalUsersError) throw portalUsersError;
    if (staffUsersError) throw staffUsersError;

    return NextResponse.json({
      success: true,
      client,
      portal_users: portalUsers || [],
      staff_users: staffUsers || [],
      current_staff_user_id: ctx.authUser.id,
      meetings,
    });

  } catch (error) {

    console.error("CLIENT MEETINGS GET ERROR:", error);



    return NextResponse.json(

      {

        error:

          error instanceof Error ? error.message : "Could not load meetings.",

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

    const { id: clientId } = await context.params;

    const ctx = await requireStaff(request, clientId);



    const body = await request.json().catch(() => ({}));

    const operation = String(body?.operation || "create_meeting");



    if (operation === "create_meeting") {

      const title = String(body?.title || "").trim();



      if (!title) {

        return NextResponse.json(

          { error: "Meeting title is required." },

          { status: 400 }

        );

      }



      const { data: meeting, error } = await admin

        .from("crm_client_meetings")

        .insert({

          organisation_id: ctx.staffProfile.organisation_id,

          client_id: clientId,

          title,

          meeting_at: body?.meeting_at || null,

          meeting_type:

            String(body?.meeting_type || "").trim() || null,

          location: String(body?.location || "").trim() || null,

          attendees: String(body?.attendees || "").trim() || null,

          minutes_text:

            String(body?.minutes_text || "").trim() || null,

          status: "draft",

          shared_with_client: false,

          created_by_user_id: ctx.authUser.id,

        })

        .select("*")

        .single();



      if (error) throw error;



      return NextResponse.json({ success: true, meeting });

    }



    const meetingId = String(body?.meeting_id || "").trim();



    if (!meetingId) {

      return NextResponse.json(

        { error: "Meeting ID is required." },

        { status: 400 }

      );

    }



    if (operation === "update_meeting") {

      const patch: Record<string, unknown> = {

        updated_at: new Date().toISOString(),

      };



      for (const key of [

        "title",

        "meeting_at",

        "meeting_type",

        "location",

        "attendees",

        "minutes_text",

        "status",

      ]) {

        if (body?.[key] !== undefined) {

          patch[key] =

            typeof body[key] === "string"

              ? String(body[key]).trim() || null

              : body[key];

        }

      }



      const { data: meeting, error } = await admin

        .from("crm_client_meetings")

        .update(patch)

        .eq("id", meetingId)

        .eq("organisation_id", ctx.staffProfile.organisation_id)

        .eq("client_id", clientId)

        .select("*")

        .single();



      if (error) throw error;



      return NextResponse.json({ success: true, meeting });

    }



    if (operation === "share_meeting") {

      const now = new Date().toISOString();



      const { data: meeting, error } = await admin

        .from("crm_client_meetings")

        .update({

          shared_with_client: true,

          shared_at: now,

          status: "shared",

          updated_at: now,

        })

        .eq("id", meetingId)

        .eq("organisation_id", ctx.staffProfile.organisation_id)

        .eq("client_id", clientId)

        .select("*")

        .single();



      if (error) throw error;



      return NextResponse.json({ success: true, meeting });

    }



    if (operation === "unshare_meeting") {

      const { data: meeting, error } = await admin

        .from("crm_client_meetings")

        .update({

          shared_with_client: false,

          shared_at: null,

          status: "draft",

          updated_at: new Date().toISOString(),

        })

        .eq("id", meetingId)

        .eq("organisation_id", ctx.staffProfile.organisation_id)

        .eq("client_id", clientId)

        .select("*")

        .single();



      if (error) throw error;



      return NextResponse.json({ success: true, meeting });

    }



    if (operation === "add_action") {
      const actionText = String(body?.action_text || "").trim();
      const assignedToType = String(body?.assigned_to_type || "").trim();
      const assignedStaffUserId =
        String(body?.assigned_staff_user_id || "").trim() || null;
      const assignedPortalUserId =
        String(body?.assigned_portal_user_id || "").trim() || null;
      const dueDate = String(body?.due_date || "").trim() || null;

      if (!actionText) {
        return NextResponse.json(
          { error: "Action description is required." },
          { status: 400 }
        );
      }

      if (!["practice", "client"].includes(assignedToType)) {
        return NextResponse.json(
          { error: "Action must be assigned to Practice or Client." },
          { status: 400 }
        );
      }

      if (assignedToType === "practice" && !assignedStaffUserId) {
        return NextResponse.json(
          { error: "Choose the staff member responsible for this action." },
          { status: 400 }
        );
      }

      if (assignedToType === "practice" && assignedStaffUserId) {
        const { data: staffUser, error: staffError } = await admin
          .from("user_profiles")
          .select("user_id")
          .eq("organisation_id", ctx.staffProfile.organisation_id)
          .eq("user_id", assignedStaffUserId)
          .eq("access_enabled", true)
          .eq("can_access_crm", true)
          .maybeSingle();

        if (staffError) throw staffError;

        if (!staffUser) {
          return NextResponse.json(
            { error: "Selected staff member could not be found." },
            { status: 404 }
          );
        }
      }

      const { data: action, error } = await admin
        .from("crm_client_meeting_actions")
        .insert({
          organisation_id: ctx.staffProfile.organisation_id,
          client_id: clientId,
          meeting_id: meetingId,
          action_text: actionText,
          assigned_to_type: assignedToType,
          assigned_staff_user_id:
            assignedToType === "practice" ? assignedStaffUserId : null,
          assigned_portal_user_id:
            assignedToType === "client" ? assignedPortalUserId : null,
          due_date: dueDate,
          status: "open",
          created_by_user_id: ctx.authUser.id,
        })
        .select("*")
        .single();

      if (error) throw error;

      if (assignedToType === "practice") {
        const { error: workError } = await admin
          .from("crm_work_items")
          .insert({
            organisation_id: ctx.staffProfile.organisation_id,
            client_id: clientId,
            title: actionText,
            description: "Practice action from client meeting",
            work_type: "task",
            status: "not_started",
            priority: "normal",
            assigned_user_id: assignedStaffUserId,
            due_date: dueDate,
            is_all_day: true,
            is_personal: false,
            workflow_type: "meeting_action",
            workflow_id: action.id,
            workflow_stage: "meeting_action",
            service_code: "Meeting Action",
            source_module: "crm",
          });

        if (workError) {
          await admin
            .from("crm_client_meeting_actions")
            .delete()
            .eq("id", action.id);

          throw workError;
        }
      }

      return NextResponse.json({ success: true, action });
    }



    if (operation === "toggle_action") {
      const actionId = String(body?.action_id || "").trim();
      const completed = body?.completed === true;

      if (!actionId) {
        return NextResponse.json(
          { error: "Action ID is required." },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();

      const { data: action, error } = await admin
        .from("crm_client_meeting_actions")
        .update({
          status: completed ? "completed" : "open",
          completed_at: completed ? now : null,
          completed_by_type: completed ? "practice" : null,
          completed_by_user_id: completed ? ctx.authUser.id : null,
          updated_at: now,
        })
        .eq("id", actionId)
        .eq("organisation_id", ctx.staffProfile.organisation_id)
        .eq("client_id", clientId)
        .eq("meeting_id", meetingId)
        .select("*")
        .single();

      if (error) throw error;

      if (action.assigned_to_type === "practice") {
        const { error: workError } = await admin
          .from("crm_work_items")
          .update({
            status: completed ? "completed" : "not_started",
            completed_at: completed ? now : null,
            updated_at: now,
          })
          .eq("organisation_id", ctx.staffProfile.organisation_id)
          .eq("workflow_type", "meeting_action")
          .eq("workflow_id", actionId);

        if (workError) throw workError;
      }

      return NextResponse.json({ success: true, action });
    }



    return NextResponse.json(

      { error: "Unsupported meeting operation." },

      { status: 400 }

    );

  } catch (error) {

    console.error("CLIENT MEETINGS POST ERROR:", error);



    return NextResponse.json(

      {

        error:

          error instanceof Error ? error.message : "Could not save meeting.",

      },

      { status: 500 }

    );

  }

}
