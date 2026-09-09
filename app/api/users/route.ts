import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseSecretKey) throw new Error("Missing server Supabase key");

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isInternalRole(role: string) {
  return role === "Super Admin" || role === "Admin" || role === "Staff";
}

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

  return { host, port, user, pass, fromName, fromEmail };
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
    auth: { user: smtp.user, pass: smtp.pass },
  });

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: email,
    subject: "Welcome to PracticePilot",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Welcome to PracticePilot</h2>
        <p>Hi ${fullName || "there"},</p>
        <p>Your PracticePilot internal user account has been created.</p>
        <p><strong>Login page:</strong><br>
        <a href="https://practicepilot.co.za/login">https://practicepilot.co.za/login</a></p>
        <p><strong>Username:</strong><br>${email}</p>
        <p><strong>Temporary password:</strong><br>${password}</p>
        <p>Kind regards,<br>The PracticePilot Team</p>
      </div>
    `,
  });
}

export async function GET() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,user_id,full_name,email,role,access_enabled,created_at")
    .is("organisation_id", null)
    .in("role", ["Super Admin", "Admin", "Staff"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
}

export async function POST(req: Request) {
  const body = await req.json();

  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const role = String(body.role || "Staff").trim();

  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  if (!isInternalRole(role)) {
    return NextResponse.json(
      { error: "Admin Users can only create PracticePilot internal users." },
      { status: 400 }
    );
  }

  const adminRole = role === "Super Admin" || role === "Admin";

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError || !authData.user?.id) {
    return NextResponse.json(
      { error: authError?.message || "Could not create auth user" },
      { status: 500 }
    );
  }

  const userId = authData.user.id;

  const { data, error } = await supabase
    .from("user_profiles")
    .insert({
      user_id: userId,
      full_name: fullName,
      email,
      role,
      organisation_id: null,
      is_practice_owner: false,
      can_manage_practice_users: false,
      can_edit_projects: adminRole,
      can_access_crm: adminRole,
      can_access_accounting: adminRole,
      can_access_afs: adminRole,
      can_access_assets: adminRole,
      can_access_secretarial: adminRole,
      can_access_projects: adminRole,
      can_access_budgeting: adminRole,
      can_access_management_reports: adminRole,
      can_access_paia: adminRole,
      can_access_proposals: adminRole,
      access_enabled: true,
    })
    .select("id,user_id,full_name,email,role,access_enabled,created_at")
    .single();

  if (error) {
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await sendWelcomeEmail({ fullName, email, password });
  } catch (emailError) {
    return NextResponse.json({
      user: data,
      warning:
        emailError instanceof Error
          ? emailError.message
          : "User created, but welcome email failed",
    });
  }

  return NextResponse.json({ user: data });
}
