import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseSecretKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || "PracticePilot";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  if (!host || !user || !pass || !fromEmail) {
    throw new Error("Missing SMTP configuration");
  }

  return {
    host,
    port,
    user,
    pass,
    fromName,
    fromEmail,
  };
}

async function sendWelcomeEmail({
  fullName,
  email,
  password,
}: {
  fullName: string;
  email: string;
  password: string;
}) {
  const smtp = getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const displayName = fullName || "there";

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: email,
    subject: "Welcome to PracticePilot",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0B2F4F; line-height: 1.6;">
        <h2>Welcome to PracticePilot</h2>

        <p>Hi ${displayName},</p>

        <p>Your PracticePilot user account has been created.</p>

        <p>You can log in using the details below:</p>

        <p>
          <strong>Login page:</strong><br />
          <a href="https://practicepilot.co.za/login">https://practicepilot.co.za/login</a>
        </p>

        <p>
          <strong>Username:</strong><br />
          ${email}
        </p>

        <p>
          <strong>Temporary password:</strong><br />
          ${password}
        </p>

        <p>
          Please keep these details safe. You may reset your password from the login page if needed.
        </p>

        <p>Kind regards,<br />The PracticePilot Team</p>
      </div>
    `,
  });
}

export async function GET() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(`
      *,
      organisations (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data });
}

export async function POST(req: Request) {
  const body = await req.json();

  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const role = String(body.role || "Client Viewer").trim();
  const organisationId = String(body.organisationId || "").trim();
  const canEditProjects = Boolean(body.canEditProjects);
  const canAccessAccounting = Boolean(body.canAccessAccounting);
  const canAccessProjects = Boolean(body.canAccessProjects);
  const canAccessBudgeting = Boolean(body.canAccessBudgeting);

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const userId = authData.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Could not create auth user" }, { status: 500 });
  }

  const isInternalUser = role === "Super Admin" || role === "Admin" || role === "Staff";

  const { data, error } = await supabase
    .from("user_profiles")
    .insert([
      {
        user_id: userId,
        full_name: fullName || null,
        email,
        role,
        organisation_id: isInternalUser ? null : organisationId || null,
        can_edit_projects: isInternalUser ? true : canEditProjects,
        can_access_accounting: isInternalUser ? true : canAccessAccounting,
        can_access_projects: true,
        can_access_budgeting: isInternalUser ? true : canAccessBudgeting,
        access_enabled: true,
      },
    ])
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

  try {
    await sendWelcomeEmail({
      fullName,
      email,
      password,
    });
  } catch (emailError) {
    console.error("WELCOME EMAIL ERROR:", emailError);

    return NextResponse.json({
      user: data,
      warning: emailError instanceof Error ? emailError.message : "User created, but welcome email failed",
    });
  }

  return NextResponse.json({ user: data });
}