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

function nextMonthlyRun(dayOfMonth: number, sendHour: number, from = new Date()) {
  const day = Math.min(28, Math.max(1, dayOfMonth));
  const hour = Math.min(23, Math.max(0, sendHour));

  function makeUtc(year: number, month: number) {
    return new Date(Date.UTC(year, month, day, hour - 2, 0, 0, 0));
  }

  let candidate = makeUtc(from.getUTCFullYear(), from.getUTCMonth());

  if (candidate.getTime() <= from.getTime()) {
    candidate = makeUtc(from.getUTCFullYear(), from.getUTCMonth() + 1);
  }

  return candidate;
}

function nextWeeklyRun(dayOfWeek: number, sendHour: number, from = new Date()) {
  const targetDay = Math.min(6, Math.max(0, dayOfWeek));
  const hour = Math.min(23, Math.max(0, sendHour));

  const southAfricaNow = new Date(from.getTime() + 2 * 60 * 60 * 1000);
  const currentDay = southAfricaNow.getUTCDay();
  let addDays = (targetDay - currentDay + 7) % 7;

  let localTarget = new Date(
    Date.UTC(
      southAfricaNow.getUTCFullYear(),
      southAfricaNow.getUTCMonth(),
      southAfricaNow.getUTCDate() + addDays,
      hour,
      0,
      0,
      0
    )
  );

  let utcTarget = new Date(
    localTarget.getTime() - 2 * 60 * 60 * 1000
  );

  if (utcTarget.getTime() <= from.getTime()) {
    utcTarget = new Date(
      utcTarget.getTime() + 7 * 24 * 60 * 60 * 1000
    );
  }

  return utcTarget;
}

function calculateNextRun(input: {
  schedule_type: string;
  day_of_month?: number | null;
  day_of_week?: number | null;
  send_hour?: number | null;
}) {
  const hour = Number(input.send_hour ?? 8);

  if (input.schedule_type === "weekly") {
    return nextWeeklyRun(
      Number(input.day_of_week ?? 1),
      hour
    ).toISOString();
  }

  return nextMonthlyRun(
    Number(input.day_of_month ?? 20),
    hour
  ).toISOString();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await context.params;
    const ctx = await requireStaff(request, clientId);

    const { data, error } = await admin
      .from("crm_client_request_schedules")
      .select(
        "*,crm_client_request_templates(id,template_name,request_type,title,description,priority)"
      )
      .eq("organisation_id", ctx.staffProfile.organisation_id)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      schedules: data || [],
    });
  } catch (error) {
    console.error("REQUEST SCHEDULES GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load request schedules.",
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

    const operation = String(body?.operation || "create");

    if (operation === "create") {
      const templateId = String(body?.template_id || "").trim();

      if (!templateId) {
        return NextResponse.json(
          { error: "Request template is required." },
          { status: 400 }
        );
      }

      const scheduleType = String(
        body?.schedule_type || "monthly"
      );

      const dayOfMonth =
        scheduleType === "monthly"
          ? Number(body?.day_of_month ?? 20)
          : null;

      const dayOfWeek =
        scheduleType === "weekly"
          ? Number(body?.day_of_week ?? 1)
          : null;

      const sendHour = Number(body?.send_hour ?? 8);
      const uploadFolderPath =
        String(body?.upload_folder_path || "").trim() || null;
      const uploadFolderName =
        String(body?.upload_folder_name || "").trim() || null;

      const { data: template, error: templateError } = await admin
        .from("crm_client_request_templates")
        .select("id,requires_upload")
        .eq("id", templateId)
        .eq("organisation_id", ctx.staffProfile.organisation_id)
        .eq("is_active", true)
        .maybeSingle();

      if (templateError) throw templateError;
      if (!template) {
        return NextResponse.json(
          { error: "Request template not found." },
          { status: 404 }
        );
      }

      if (template.requires_upload === true && !uploadFolderPath) {
        return NextResponse.json(
          {
            error:
              "Choose the upload destination before scheduling this document request.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await admin
        .from("crm_client_request_schedules")
        .insert({
          organisation_id: ctx.staffProfile.organisation_id,
          client_id: clientId,
          template_id: templateId,
          assigned_portal_user_id:
            String(body?.assigned_portal_user_id || "").trim() || null,
          schedule_type: scheduleType,
          day_of_month: dayOfMonth,
          day_of_week: dayOfWeek,
          send_hour: sendHour,
          timezone: "Africa/Johannesburg",
          start_date: body?.start_date || null,
          end_date: body?.end_date || null,
          is_active: true,
          upload_folder_path: uploadFolderPath,
          upload_folder_name: uploadFolderName,
          next_run_at: calculateNextRun({
            schedule_type: scheduleType,
            day_of_month: dayOfMonth,
            day_of_week: dayOfWeek,
            send_hour: sendHour,
          }),
          created_by_user_id: ctx.authUser.id,
        })
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        schedule: data,
      });
    }

    if (operation === "toggle") {
      const scheduleId = String(body?.schedule_id || "").trim();
      const isActive = body?.is_active === true;

      const { data, error } = await admin
        .from("crm_client_request_schedules")
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", scheduleId)
        .eq("organisation_id", ctx.staffProfile.organisation_id)
        .eq("client_id", clientId)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        schedule: data,
      });
    }

    if (operation === "delete") {
      const scheduleId = String(body?.schedule_id || "").trim();

      const { error } = await admin
        .from("crm_client_request_schedules")
        .delete()
        .eq("id", scheduleId)
        .eq("organisation_id", ctx.staffProfile.organisation_id)
        .eq("client_id", clientId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Unsupported schedule operation." },
      { status: 400 }
    );
  } catch (error) {
    console.error("REQUEST SCHEDULES POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save request schedule.",
      },
      { status: 500 }
    );
  }
}
