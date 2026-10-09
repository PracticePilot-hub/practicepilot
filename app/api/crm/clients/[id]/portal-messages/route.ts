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

async function notifyClient(
  email: string,
  clientName: string,
  messageBody: string
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
    subject: `${clientName} — new PracticePilot message`,
    text:
      `You have a new secure message in your PracticePilot Client Portal.\n\n` +
      `${messageBody}\n\n` +
      `Sign in to PracticePilot to reply.`,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await context.params;
    const ctx = await requireStaff(request, clientId);
    const client = ctx.client!;

    const [{ data: messages, error: messageError }, { data: users, error: userError }] =
      await Promise.all([
        admin
          .from("crm_client_portal_messages")
          .select(
            "id,portal_user_id,sender_type,sender_user_id,sender_name,message_body,is_read_by_client,is_read_by_practice,created_at"
          )
          .eq("organisation_id", ctx.staffProfile.organisation_id)
          .eq("client_id", clientId)
          .order("created_at", { ascending: true }),
        admin
          .from("crm_client_portal_users")
          .select("id,full_name,email,portal_role,is_active")
          .eq("organisation_id", ctx.staffProfile.organisation_id)
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("full_name", { ascending: true }),
      ]);

    if (messageError) throw messageError;
    if (userError) throw userError;

    await admin
      .from("crm_client_portal_messages")
      .update({ is_read_by_practice: true })
      .eq("organisation_id", ctx.staffProfile.organisation_id)
      .eq("client_id", clientId)
      .eq("sender_type", "client")
      .eq("is_read_by_practice", false);

    return NextResponse.json({
      success: true,
      client,
      portal_users: users || [],
      messages: messages || [],
    });
  } catch (error) {
    console.error("PRACTICE PORTAL MESSAGES GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load portal messages.",
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
    const client = ctx.client!;

    const body = await request.json().catch(() => ({}));
    const messageBody = String(body?.message_body || "").trim();
    const portalUserId =
      String(body?.portal_user_id || "").trim() || null;

    if (!messageBody) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

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
      if (!portalUser) {
        return NextResponse.json(
          { error: "Portal user not found." },
          { status: 404 }
        );
      }

      const email = String(portalUser.email || "").trim();
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

    const senderName = String(
      ctx.authUser.user_metadata?.full_name ||
        ctx.authUser.user_metadata?.name ||
        ctx.authUser.email ||
        "Practice team"
    ).trim();

    const { data: message, error } = await admin
      .from("crm_client_portal_messages")
      .insert({
        organisation_id: ctx.staffProfile.organisation_id,
        client_id: clientId,
        portal_user_id: portalUserId,
        sender_type: "practice",
        sender_user_id: ctx.authUser.id,
        sender_name: senderName,
        message_body: messageBody,
        is_read_by_client: false,
        is_read_by_practice: true,
      })
      .select(
        "id,portal_user_id,sender_type,sender_user_id,sender_name,message_body,is_read_by_client,is_read_by_practice,created_at"
      )
      .single();

    if (error) throw error;

    for (const email of recipients) {
      try {
        await notifyClient(email, client.client_name, messageBody);
      } catch (mailError) {
        console.error("PORTAL MESSAGE CLIENT EMAIL ERROR:", mailError);
      }
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("PRACTICE PORTAL MESSAGES POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send portal message.",
      },
      { status: 500 }
    );
  }
}
