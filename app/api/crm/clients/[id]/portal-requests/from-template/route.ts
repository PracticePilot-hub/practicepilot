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

import nodemailer from "nodemailer";

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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await context.params;
    const ctx = await requireStaff(request, clientId);
    const client = ctx.client!;

    const body = await request.json().catch(() => ({}));
    const templateId = String(body?.template_id || "").trim();
    const portalUserId =
      String(body?.assigned_portal_user_id || "").trim() || null;
    const uploadFolderPath =
      String(body?.upload_folder_path || "").trim() || null;
    const uploadFolderName =
      String(body?.upload_folder_name || "").trim() || null;

    if (!templateId) {
      return NextResponse.json(
        { error: "Request template is required." },
        { status: 400 }
      );
    }

    const { data: template, error: templateError } = await admin
      .from("crm_client_request_templates")
      .select("*")
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
            "Choose where the client's uploaded document must be saved before sending this request.",
        },
        { status: 400 }
      );
    }

    const dueDays = Number(template.default_due_days || 0);
    const dueDate =
      dueDays > 0 ? dateOnly(addDays(new Date(), dueDays)) : null;

    const { data: createdRequest, error: createError } = await admin
      .from("crm_client_portal_requests")
      .insert({
        organisation_id: ctx.staffProfile.organisation_id,
        client_id: clientId,
        request_type: template.request_type,
        title: template.title,
        description: template.description,
        assigned_portal_user_id: portalUserId,
        due_date: dueDate,
        priority: template.priority || "normal",
        status: "new",
        requires_upload: template.requires_upload === true,
        requires_response: template.requires_response === true,
        requires_approval: template.requires_approval === true,
        response_text: null,
        upload_folder_path:
          uploadFolderPath || template.default_upload_folder_path || null,
        upload_folder_name:
          uploadFolderName || template.default_upload_folder_name || null,
        created_by_user_id: ctx.authUser.id,
      })
      .select("*")
      .single();

    if (createError) throw createError;

    let recipients: string[] = [];

    if (portalUserId) {
      const { data: portalUser, error } = await admin
        .from("crm_client_portal_users")
        .select("email")
        .eq("id", portalUserId)
        .eq("organisation_id", ctx.staffProfile.organisation_id)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      const email = String(portalUser?.email || "").trim();
      if (email) recipients = [email];
    } else {
      const { data: portalUsers, error } = await admin
        .from("crm_client_portal_users")
        .select("email")
        .eq("organisation_id", ctx.staffProfile.organisation_id)
        .eq("client_id", clientId)
        .eq("is_active", true);

      if (error) throw error;

      recipients = Array.from(
        new Set(
          (portalUsers || [])
            .map((row) => String(row.email || "").trim())
            .filter(Boolean)
        )
      );
    }

    for (const email of recipients) {
      try {
        await emailRequest(
          email,
          client.client_name,
          template.title,
          template.description
        );
      } catch (mailError) {
        console.error("REQUEST TEMPLATE EMAIL ERROR:", mailError);
      }
    }

    return NextResponse.json({
      success: true,
      request: createdRequest,
    });
  } catch (error) {
    console.error("REQUEST FROM TEMPLATE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send request from template.",
      },
      { status: 500 }
    );
  }
}
