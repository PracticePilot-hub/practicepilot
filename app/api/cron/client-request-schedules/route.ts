import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

type ScheduleRow = {
  id: string;
  organisation_id: string;
  client_id: string;
  template_id: string;
  assigned_portal_user_id: string | null;
  schedule_type: string;
  day_of_month: number | null;
  day_of_week: number | null;
  send_hour: number | null;
  timezone: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by_user_id: string | null;
  upload_folder_path: string | null;
  upload_folder_name: string | null;
  crm_client_request_templates:
    | {
        id: string;
        request_type: string;
        title: string;
        description: string | null;
        priority: string | null;
        default_due_days: number | null;
        requires_upload: boolean | null;
        requires_response: boolean | null;
        requires_approval: boolean | null;
        default_upload_folder_path: string | null;
        default_upload_folder_name: string | null;
        is_active: boolean | null;
      }
    | Array<{
        id: string;
        request_type: string;
        title: string;
        description: string | null;
        priority: string | null;
        default_due_days: number | null;
        requires_upload: boolean | null;
        requires_response: boolean | null;
        requires_approval: boolean | null;
        default_upload_folder_path: string | null;
        default_upload_folder_name: string | null;
        is_active: boolean | null;
      }>
    | null;
  crm_clients:
    | {
        id: string;
        client_name: string;
      }
    | Array<{
        id: string;
        client_name: string;
      }>
    | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function verifyCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Same pattern as the existing AFS billing cron:
  // if CRON_SECRET exists, Vercel must send it as Bearer auth.
  if (!secret) return true;

  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function johannesburgDateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function scheduleLocalDateAtHour(dateValue: string, hour: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const safeHour = Math.min(23, Math.max(0, Number(hour || 0)));

  // Africa/Johannesburg is UTC+2 throughout the year.
  return new Date(Date.UTC(year, month - 1, day, safeHour - 2, 0, 0, 0));
}

function nextMonthlyRun(
  dayOfMonth: number,
  sendHour: number,
  from = new Date()
) {
  const day = Math.min(28, Math.max(1, Number(dayOfMonth || 20)));
  const hour = Math.min(23, Math.max(0, Number(sendHour ?? 8)));

  const southAfricaNow = new Date(from.getTime() + 2 * 60 * 60 * 1000);

  const makeUtc = (year: number, month: number) =>
    new Date(Date.UTC(year, month, day, hour - 2, 0, 0, 0));

  let candidate = makeUtc(
    southAfricaNow.getUTCFullYear(),
    southAfricaNow.getUTCMonth()
  );

  if (candidate.getTime() <= from.getTime()) {
    candidate = makeUtc(
      southAfricaNow.getUTCFullYear(),
      southAfricaNow.getUTCMonth() + 1
    );
  }

  return candidate;
}

function nextWeeklyRun(
  dayOfWeek: number,
  sendHour: number,
  from = new Date()
) {
  const targetDay = Math.min(6, Math.max(0, Number(dayOfWeek ?? 1)));
  const hour = Math.min(23, Math.max(0, Number(sendHour ?? 8)));

  const southAfricaNow = new Date(from.getTime() + 2 * 60 * 60 * 1000);
  const currentDay = southAfricaNow.getUTCDay();
  const addDaysCount = (targetDay - currentDay + 7) % 7;

  const localTarget = new Date(
    Date.UTC(
      southAfricaNow.getUTCFullYear(),
      southAfricaNow.getUTCMonth(),
      southAfricaNow.getUTCDate() + addDaysCount,
      hour,
      0,
      0,
      0
    )
  );

  let utcTarget = new Date(localTarget.getTime() - 2 * 60 * 60 * 1000);

  if (utcTarget.getTime() <= from.getTime()) {
    utcTarget = new Date(utcTarget.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return utcTarget;
}

function calculateNextRun(schedule: ScheduleRow, from = new Date()) {
  if (String(schedule.schedule_type || "").toLowerCase() === "weekly") {
    return nextWeeklyRun(
      Number(schedule.day_of_week ?? 1),
      Number(schedule.send_hour ?? 8),
      from
    );
  }

  return nextMonthlyRun(
    Number(schedule.day_of_month ?? 20),
    Number(schedule.send_hour ?? 8),
    from
  );
}

function firstEligibleRun(schedule: ScheduleRow, from = new Date()) {
  let candidate = calculateNextRun(schedule, from);

  if (schedule.start_date) {
    const startAt = scheduleLocalDateAtHour(
      schedule.start_date,
      Number(schedule.send_hour ?? 8)
    );

    if (candidate.getTime() < startAt.getTime()) {
      candidate = calculateNextRun(
        schedule,
        new Date(startAt.getTime() - 60 * 1000)
      );
    }
  }

  return candidate;
}

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || "PracticePilot";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  if (!host || !user || !pass || !fromEmail) return null;

  return { host, port, user, pass, fromName, fromEmail };
}

async function emailRequest(
  email: string,
  clientName: string,
  title: string,
  description: string | null
) {
  const smtp = smtpConfig();
  if (!smtp || !email) return;

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: email,
    subject: `${clientName} — ${title}`,
    text:
      `${title}\n\n` +
      `${description || ""}\n\n` +
      `Please sign in to your PracticePilot Client Portal to respond.`,
  });
}

async function recipientsForSchedule(schedule: ScheduleRow) {
  const assignedPortalUserId = String(
    schedule.assigned_portal_user_id || ""
  ).trim();

  if (assignedPortalUserId) {
    const { data, error } = await admin
      .from("crm_client_portal_users")
      .select("email")
      .eq("id", assignedPortalUserId)
      .eq("organisation_id", schedule.organisation_id)
      .eq("client_id", schedule.client_id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;

    const email = String(data?.email || "").trim();
    return email ? [email] : [];
  }

  const { data, error } = await admin
    .from("crm_client_portal_users")
    .select("email")
    .eq("organisation_id", schedule.organisation_id)
    .eq("client_id", schedule.client_id)
    .eq("is_active", true);

  if (error) throw error;

  return Array.from(
    new Set(
      (data || [])
        .map((row) => String(row.email || "").trim())
        .filter(Boolean)
    )
  );
}

async function markSchedule(
  scheduleId: string,
  patch: Record<string, unknown>
) {
  const { error } = await admin
    .from("crm_client_request_schedules")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  if (error) throw error;
}

async function runOneSchedule(schedule: ScheduleRow, now: Date) {
  const template = one(schedule.crm_client_request_templates);
  const client = one(schedule.crm_clients);

  if (!template?.id || template.is_active === false) {
    throw new Error("The request template is missing or inactive.");
  }

  if (!client?.id) {
    throw new Error("The client linked to this schedule could not be found.");
  }

  const runAt = schedule.next_run_at
    ? new Date(schedule.next_run_at)
    : now;

  if (Number.isNaN(runAt.getTime())) {
    throw new Error("The schedule next_run_at value is invalid.");
  }

  const localToday = johannesburgDateOnly(now);

  if (schedule.start_date && localToday < schedule.start_date) {
    const nextRun = firstEligibleRun(schedule, now);

    await markSchedule(schedule.id, {
      next_run_at: nextRun.toISOString(),
      last_run_status: "waiting_for_start_date",
      last_run_error: null,
    });

    return {
      schedule_id: schedule.id,
      status: "waiting_for_start_date",
      next_run_at: nextRun.toISOString(),
    };
  }

  if (schedule.end_date && localToday > schedule.end_date) {
    await markSchedule(schedule.id, {
      is_active: false,
      last_run_status: "ended",
      last_run_error: null,
    });

    return {
      schedule_id: schedule.id,
      status: "ended",
    };
  }

  const uploadFolderPath =
    String(schedule.upload_folder_path || "").trim() ||
    String(template.default_upload_folder_path || "").trim() ||
    null;

  const uploadFolderName =
    String(schedule.upload_folder_name || "").trim() ||
    String(template.default_upload_folder_name || "").trim() ||
    null;

  if (template.requires_upload === true && !uploadFolderPath) {
    throw new Error(
      "This scheduled document request requires an upload destination."
    );
  }

  const dueDays = Number(template.default_due_days || 0);
  const dueDate =
    dueDays > 0 ? dateOnly(addDays(now, dueDays)) : null;

  const insertPayload = {
    organisation_id: schedule.organisation_id,
    client_id: schedule.client_id,
    request_type: template.request_type,
    title: template.title,
    description: template.description,
    assigned_portal_user_id: schedule.assigned_portal_user_id,
    due_date: dueDate,
    priority: template.priority || "normal",
    status: "new",
    requires_upload: template.requires_upload === true,
    requires_response: template.requires_response === true,
    requires_approval: template.requires_approval === true,
    response_text: null,
    upload_folder_path: uploadFolderPath,
    upload_folder_name: uploadFolderName,
    created_by_user_id: schedule.created_by_user_id,
    source_schedule_id: schedule.id,
    source_schedule_run_at: runAt.toISOString(),
  };

  const { data: createdRequest, error: createError } = await admin
    .from("crm_client_portal_requests")
    .insert(insertPayload)
    .select("id")
    .single();

  let duplicate = false;

  if (createError) {
    if (createError.code === "23505") {
      duplicate = true;
    } else {
      throw createError;
    }
  }

  // Email is best-effort, matching the existing manual Send Now behaviour.
  // A temporary mail failure must not generate duplicate portal requests.
  const mailErrors: string[] = [];

  if (!duplicate) {
    const recipients = await recipientsForSchedule(schedule);

    for (const email of recipients) {
      try {
        await emailRequest(
          email,
          client.client_name,
          template.title,
          template.description
        );
      } catch (mailError) {
        const text =
          mailError instanceof Error
            ? mailError.message
            : "Unknown mail error";

        console.error(
          "SCHEDULED REQUEST EMAIL ERROR:",
          schedule.id,
          email,
          mailError
        );

        mailErrors.push(`${email}: ${text}`);
      }
    }
  }

  const nextRun = calculateNextRun(schedule, runAt);
  const nextRunLocalDate = johannesburgDateOnly(nextRun);
  const hasEnded =
    Boolean(schedule.end_date) &&
    nextRunLocalDate > String(schedule.end_date);

  await markSchedule(schedule.id, {
    last_run_at: runAt.toISOString(),
    next_run_at: hasEnded ? null : nextRun.toISOString(),
    is_active: hasEnded ? false : true,
    last_run_status: duplicate
      ? "duplicate_skipped"
      : mailErrors.length
        ? "created_email_warning"
        : "success",
    last_run_error: mailErrors.length
      ? mailErrors.join(" | ").slice(0, 2000)
      : null,
  });

  return {
    schedule_id: schedule.id,
    status: duplicate
      ? "duplicate_skipped"
      : mailErrors.length
        ? "created_email_warning"
        : "success",
    request_id: createdRequest?.id || null,
    next_run_at: hasEnded ? null : nextRun.toISOString(),
    deactivated: hasEnded,
    email_warnings: mailErrors,
  };
}

async function execute(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorised cron request." },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const dryRun = url.searchParams.get("dryRun") === "1";
  const scheduleId = String(url.searchParams.get("scheduleId") || "").trim();

  const now = new Date();
  const nowIso = now.toISOString();

  let query = admin
    .from("crm_client_request_schedules")
    .select(
      `
        *,
        crm_client_request_templates (
          id,
          request_type,
          title,
          description,
          priority,
          default_due_days,
          requires_upload,
          requires_response,
          requires_approval,
          default_upload_folder_path,
          default_upload_folder_name,
          is_active
        ),
        crm_clients (
          id,
          client_name
        )
      `
    )
    .eq("is_active", true)
    .order("next_run_at", { ascending: true })
    .limit(100);

  if (scheduleId) {
    query = query.eq("id", scheduleId);
  } else if (!force) {
    query = query.lte("next_run_at", nowIso);
  }

  const { data, error } = await query;

  if (error) throw error;

  const schedules = (data || []) as ScheduleRow[];

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      checked_at: nowIso,
      schedules_found: schedules.length,
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        client_id: schedule.client_id,
        template_id: schedule.template_id,
        next_run_at: schedule.next_run_at,
        start_date: schedule.start_date,
        end_date: schedule.end_date,
      })),
    });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const schedule of schedules) {
    try {
      const result = await runOneSchedule(schedule, now);
      results.push(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Scheduled request failed.";

      console.error(
        "SCHEDULED REQUEST RUNNER ITEM ERROR:",
        schedule.id,
        error
      );

      try {
        await markSchedule(schedule.id, {
          last_run_status: "failed",
          last_run_error: message.slice(0, 2000),
        });
      } catch (logError) {
        console.error(
          "SCHEDULED REQUEST RUNNER STATUS ERROR:",
          schedule.id,
          logError
        );
      }

      results.push({
        schedule_id: schedule.id,
        status: "failed",
        error: message,
      });
    }
  }

  return NextResponse.json({
    success: true,
    checked_at: nowIso,
    schedules_found: schedules.length,
    success_count: results.filter(
      (row) =>
        row.status === "success" ||
        row.status === "duplicate_skipped" ||
        row.status === "created_email_warning"
    ).length,
    failed_count: results.filter((row) => row.status === "failed").length,
    results,
  });
}

export async function GET(request: Request) {
  try {
    return await execute(request);
  } catch (error) {
    console.error("SCHEDULED REQUEST RUNNER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Scheduled request runner failed.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
