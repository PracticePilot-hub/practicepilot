// Path: app/api/admin/organisations/[id]/users/route.ts

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

type ModuleKey =
  | "crm"
  | "accounting"
  | "afs"
  | "assets"
  | "secretarial"
  | "projects"
  | "management_reports"
  | "paia"
  | "proposals"
  | "trusts";

const moduleFields: Record<ModuleKey, string> = {
  crm: "can_access_crm",
  accounting: "can_access_accounting",
  afs: "can_access_afs",
  assets: "can_access_assets",
  secretarial: "can_access_secretarial",
  projects: "can_access_projects",
  management_reports: "can_access_management_reports",
  paia: "can_access_paia",
  proposals: "can_access_proposals",
  trusts: "can_access_trusts",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseServiceKey) throw new Error("Missing Supabase server key");

const admin = createClient(supabaseUrl, supabaseServiceKey, {
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

function isAdminRole(role: string) {
  return role === "Super Admin" || role === "Admin";
}

async function requireAdmin(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id,user_id,role,access_enabled")
    .eq("user_id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.access_enabled === false ||
    !isAdminRole(profile.role)
  ) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    };
  }

  return { profile, response: null };
}

async function loadOrganisationUsers(organisationId: string) {
  const [usersResult, licencesResult] = await Promise.all([
    admin
      .from("user_profiles")
      .select(
        "id,user_id,organisation_id,full_name,email,role,access_enabled,is_practice_owner,can_manage_practice_users"
      )
      .eq("organisation_id", organisationId)
      .order("is_practice_owner", { ascending: false })
      .order("full_name", { ascending: true }),

    admin
      .from("practice_module_licences")
      .select("module_key,licence_limit,is_enabled")
      .eq("organisation_id", organisationId)
      .order("module_key", { ascending: true }),
  ]);

  if (usersResult.error) throw usersResult.error;
  if (licencesResult.error) throw licencesResult.error;

  const users = usersResult.data || [];
  const licences = [];

  for (const licence of licencesResult.data || []) {
    const moduleKey = String(licence.module_key) as ModuleKey;
    const field = moduleFields[moduleKey];

    let used = 0;

    if (field) {
      const { count, error } = await admin
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("access_enabled", true)
        .eq(field, true);

      if (error) throw error;
      used = Number(count || 0);
    }

    licences.push({
      ...licence,
      used,
      available: Math.max(Number(licence.licence_limit || 0) - used, 0),
    });
  }

  return { users, licences };
}

function smtpConfig() {
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendWelcomeEmail({
  fullName,
  email,
  password,
  practiceName,
}: {
  fullName: string;
  email: string;
  password: string;
  practiceName: string;
}) {
  const smtp = smtpConfig();

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const safeName = escapeHtml(fullName || "there");
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(password);
  const safePractice = escapeHtml(practiceName);

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: email,
    subject: "Welcome to PracticePilot",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#10233a;">
        <h2>Welcome to PracticePilot</h2>

        <p>Hi ${safeName},</p>

        <p>Your PracticePilot account for <strong>${safePractice}</strong> has been created.</p>

        <p>You can log in using the details below:</p>

        <p>
          <strong>Login page:</strong><br />
          <a href="https://practicepilot.co.za/login">https://practicepilot.co.za/login</a>
        </p>

        <p>
          <strong>Username:</strong><br />
          ${safeEmail}
        </p>

        <p>
          <strong>Temporary password:</strong><br />
          ${safePassword}
        </p>

        <p>
          You are the Practice Owner for this PracticePilot account and can manage your team and licence allocations from PracticePilot Settings.
        </p>

        <p>Kind regards,<br />The PracticePilot Team</p>
      </div>
    `,
  });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;

    const { id: organisationId } = await context.params;

    const { data: organisation, error: organisationError } = await admin
      .from("organisations")
      .select("id,name")
      .eq("id", organisationId)
      .single();

    if (organisationError || !organisation) {
      return NextResponse.json({ error: "Practice not found." }, { status: 404 });
    }

    const data = await loadOrganisationUsers(organisationId);

    return NextResponse.json({
      success: true,
      organisation,
      ...data,
    });
  } catch (error: any) {
    console.error("ADMIN ORGANISATION USERS GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load practice users." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;

    const { id: organisationId } = await context.params;
    const body = await request.json();

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const requestedModules = (body.modules || {}) as Partial<Record<ModuleKey, boolean>>;

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Temporary password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const { data: organisation, error: organisationError } = await admin
      .from("organisations")
      .select("id,name")
      .eq("id", organisationId)
      .single();

    if (organisationError || !organisation) {
      return NextResponse.json({ error: "Practice not found." }, { status: 404 });
    }

    const { data: existingOwner, error: ownerError } = await admin
      .from("user_profiles")
      .select("id,email")
      .eq("organisation_id", organisationId)
      .eq("is_practice_owner", true)
      .maybeSingle();

    if (ownerError) throw ownerError;

    if (existingOwner) {
      return NextResponse.json(
        { error: "This practice already has a Practice Owner." },
        { status: 400 }
      );
    }

    const { data: licenceRows, error: licenceError } = await admin
      .from("practice_module_licences")
      .select("module_key,licence_limit,is_enabled")
      .eq("organisation_id", organisationId);

    if (licenceError) throw licenceError;

    const licenceMap = new Map(
      (licenceRows || []).map((row: any) => [String(row.module_key), row])
    );

    const moduleValues: Record<string, boolean> = {};

    for (const [moduleKey, field] of Object.entries(moduleFields)) {
      const requested = Boolean(requestedModules[moduleKey as ModuleKey]);
      const licence = licenceMap.get(moduleKey) as any;

      if (!requested) {
        moduleValues[field] = false;
        continue;
      }

      if (
        !licence ||
        licence.is_enabled === false ||
        Number(licence.licence_limit || 0) <= 0
      ) {
        return NextResponse.json(
          { error: `${moduleKey} is not enabled for this practice.` },
          { status: 400 }
        );
      }

      const { count, error: usageError } = await admin
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("access_enabled", true)
        .eq(field, true);

      if (usageError) throw usageError;

      if (Number(count || 0) >= Number(licence.licence_limit || 0)) {
        return NextResponse.json(
          { error: `No ${moduleKey} licences are available.` },
          { status: 400 }
        );
      }

      moduleValues[field] = true;
    }

    const { data: createdAuth, error: authCreateError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          practice_name: organisation.name,
        },
      });

    if (authCreateError || !createdAuth.user) {
      throw authCreateError || new Error("Could not create login.");
    }

    const profileInsert: Record<string, any> = {
      user_id: createdAuth.user.id,
      organisation_id: organisationId,
      full_name: fullName,
      email,
      role: "Client Manager",
      access_enabled: true,
      is_practice_owner: true,
      can_manage_practice_users: true,
      can_edit_projects: Boolean(moduleValues.can_access_projects),
      afs_authority: "Captain",
      can_restrict_afs_files: true,
      ...moduleValues,
    };

    const { data: createdProfile, error: profileError } = await admin
      .from("user_profiles")
      .insert(profileInsert)
      .select(
        "id,user_id,organisation_id,full_name,email,role,access_enabled,is_practice_owner,can_manage_practice_users"
      )
      .single();

    if (profileError || !createdProfile) {
      await admin.auth.admin.deleteUser(createdAuth.user.id).catch(() => undefined);
      throw profileError || new Error("Could not create practice user profile.");
    }

    let warning: string | null = null;

    try {
      await sendWelcomeEmail({
        fullName,
        email,
        password,
        practiceName: organisation.name,
      });
    } catch (emailError: any) {
      console.error("PRACTICE OWNER WELCOME EMAIL ERROR:", emailError);
      warning = emailError?.message || "The login email could not be sent.";
    }

    return NextResponse.json({
      success: true,
      user: createdProfile,
      warning,
    });
  } catch (error: any) {
    console.error("ADMIN ORGANISATION USERS POST ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not create Practice Owner." },
      { status: 500 }
    );
  }
}
