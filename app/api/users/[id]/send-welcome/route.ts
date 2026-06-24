// Path: app/api/users/[id]/send-welcome/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceKey) {
  throw new Error("Missing Supabase server key");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || "PracticePilot";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  if (!host || !user || !pass || !fromEmail) {
    throw new Error("Missing SMTP configuration.");
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

async function sendLoginEmail({
  fullName,
  email,
  resetLink,
}: {
  fullName: string;
  email: string;
  resetLink: string;
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

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: email,
    subject: "Your PracticePilot login",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0B2F4F; line-height: 1.6;">
        <h2>Welcome to PracticePilot</h2>

        <p>Hi ${fullName || "there"},</p>

        <p>Your PracticePilot user account has been created.</p>

        <p>Please click the button below to set your password and access your workspace:</p>

        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="background:#0B5CAB;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold;display:inline-block;">
            Set password / Login
          </a>
        </p>

        <p>If the button does not work, copy and paste this link into your browser:</p>

        <p style="word-break: break-all;">
          <a href="${resetLink}">${resetLink}</a>
        </p>

        <p>Kind regards,<br />The PracticePilot Team</p>
      </div>
    `,
  });
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, user_id, full_name, email")
      .eq("id", id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!userProfile?.email) {
      return NextResponse.json(
        { error: "User email address was not found." },
        { status: 404 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: userProfile.email,
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resetLink = data.properties?.action_link || "";

    if (!resetLink || !resetLink.startsWith("http")) {
      return NextResponse.json(
        { error: "Could not generate login link." },
        { status: 500 }
      );
    }

    await sendLoginEmail({
      fullName: userProfile.full_name || "",
      email: userProfile.email,
      resetLink,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("WELCOME EMAIL ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Could not send login email." },
      { status: 500 }
    );
  }
}