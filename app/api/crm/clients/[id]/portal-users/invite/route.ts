import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const serviceKey =

process.env.SUPABASE_SERVICE_ROLE_KEY ||

process.env.SUPABASE_SECRET_KEY ||

process.env.SUPABASE_SERVICE_KEY ||

"";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

if (!serviceKey) throw new Error("Missing Supabase service-role key");

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

async function currentContext(request: Request) {

  const token = bearerToken(request);

  if (!token) {

    return {

      user: null,

      profile: null,

      response: NextResponse.json(

      { error: "Not authenticated." },

      { status: 401 }

    ),

  };

}

const {

  data: { user },

  error: authError,

} = await admin.auth.getUser(token);

if (authError || !user) {

  return {

    user: null,

    profile: null,

    response: NextResponse.json(

    { error: "Not authenticated." },

    { status: 401 }

  ),

};

}

const { data: profile, error } = await admin

.from("user_profiles")

.select(

"id,user_id,organisation_id,role,access_enabled,can_access_crm"

)

.eq("user_id", user.id)

.maybeSingle();

if (

error ||

!profile ||

!profile.organisation_id ||

profile.access_enabled === false ||

profile.can_access_crm === false

) {

  return {

    user: null,

    profile: null,

    response: NextResponse.json(

    { error: "CRM access is required." },

    { status: 403 }

  ),

};

}

return { user, profile, response: null };

}

function getSmtpConfig() {

  const host = process.env.SMTP_HOST;

  const port = Number(process.env.SMTP_PORT || 587);

  const user = process.env.SMTP_USER;

  const pass = process.env.SMTP_PASS;

  const fromName =

  process.env.SMTP_FROM_NAME || "PracticePilot";

  const fromEmail =

  process.env.SMTP_FROM_EMAIL || user;

  if (!host || !user || !pass || !fromEmail) {

    throw new Error(

    "PracticePilot SMTP is not configured for portal invitations."

  );

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendInvitationEmail(args: {

  fullName: string;

  email: string;

  clientName: string;

  actionLink: string;

  permanentLoginLink: string;

  existingUser: boolean;

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

  const displayName = args.fullName || "there";

  await transporter.sendMail({

    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,

    to: args.email,

    subject: `${args.clientName} — your PracticePilot Client Portal`,

    html: `

    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#10233a;max-width:620px;margin:0 auto;">

    <div style="padding:22px 0;border-bottom:1px solid #dce4ec;">

    <div style="font-size:22px;font-weight:800;">PracticePilot</div>

    </div>

    <div style="padding:26px 0;">

    <p>Hi ${escapeHtml(displayName)},</p>

    <p>

    You have been given access to the

    <strong>${escapeHtml(args.clientName)}</strong>

    Client Portal in PracticePilot.

    </p>

    <p>

    The portal gives you secure access to documents released

    to you and, as more features are enabled, client actions

    and communication with your accounting team.

    </p>

    ${

    args.existingUser

    ? `<p>

    Your email address already has a PracticePilot account,

    so you do not need to create another password.

    </p>`

    : `<p>

    Use the button below to activate your portal and create

    your password.

    </p>`

    }

    <p style="margin:28px 0 16px;">

    <a

    href="${args.actionLink}"

    style="display:inline-block;background:#1768d2;color:#ffffff;text-decoration:none;padding:12px 18px;font-weight:700;"

    >

    ${args.existingUser ? "Open Client Portal" : "Activate Client Portal"}

    </a>

    </p>

    <div style="margin:20px 0;padding:16px;border:1px solid #dce4ec;background:#f7fafc;">

    <strong>Keep this email for future access</strong>

    <p style="margin:8px 0 10px;">

    After your portal has been activated, use the normal

    PracticePilot login page whenever you want to return.

    </p>

    <a

    href="${args.permanentLoginLink}"

    style="color:#1768d2;font-weight:700;text-decoration:none;"

    >

    Sign in to PracticePilot

    </a>

    <div style="margin-top:6px;font-size:12px;color:#64748b;word-break:break-all;">

    ${args.permanentLoginLink}

    </div>

    </div>

    <p style="font-size:13px;color:#64748b;">

    The activation/open button above is a secure one-time link.

    The normal PracticePilot login link can be used again at any time.

    </p>

    <p style="font-size:13px;color:#64748b;">

    If you were not expecting this invitation, you can ignore

    this email.

    </p>

    <p>Kind regards,<br />PracticePilot</p>

    </div>

    </div>

    `,

  });

}

export async function POST(

request: Request,

context: { params: Promise<{ id: string }> }

) {

  try {

    const { user, profile, response } =

    await currentContext(request);

    if (response || !profile || !user) return response;

    const { id: clientId } = await context.params;

    const organisationId = profile.organisation_id;

    const body = await request.json().catch(() => ({}));

    const portalUserId = String(

    body?.portal_user_id || ""

  ).trim();

  if (!portalUserId) {

    return NextResponse.json(

    { error: "Portal user ID is required." },

    { status: 400 }

  );

}

const [

{ data: client, error: clientError },

{ data: portalUser, error: portalUserError },

] = await Promise.all([

admin

.from("crm_clients")

.select("id,client_name")

.eq("id", clientId)

.eq("organisation_id", organisationId)

.maybeSingle(),

admin

.from("crm_client_portal_users")

.select(

"id,organisation_id,client_id,contact_id,auth_user_id,full_name,email,portal_role,can_view_documents,can_approve_actions,is_active,invitation_status,invited_at,accepted_at,last_login_at,created_at,updated_at"

)

.eq("id", portalUserId)

.eq("client_id", clientId)

.eq("organisation_id", organisationId)

.maybeSingle(),

]);

if (clientError) throw clientError;

if (portalUserError) throw portalUserError;

if (!client) {

  return NextResponse.json(

  { error: "Client not found." },

  { status: 404 }

);

}

if (!portalUser || !portalUser.is_active) {

  return NextResponse.json(

  { error: "Active portal user not found." },

  { status: 404 }

);

}

const email = String(portalUser.email || "")

.trim()

.toLowerCase();

if (!email || !email.includes("@")) {

  return NextResponse.json(

  { error: "Portal user does not have a valid email address." },

  { status: 400 }

);

}

// Use the origin that actually received this request.

// Local testing therefore returns to localhost, while production

// returns to practicepilot.co.za without an environment mismatch.

const origin = new URL(request.url).origin.replace(/\/+$/, "");

const inviteRedirectTo = `${origin}/portal-welcome`;

const existingUserRedirectTo = `${origin}/portal-welcome?existing=1`;

let linkData: any = null;

let existingAuthUser = false;

let passwordSetupRequired = false;

let authLinkType: "invite" | "magiclink" | "recovery" = "invite";

// Multi-entity portal access:
// If this email already has an ACTIVE, ACCEPTED portal login for another
// client in the same practice, reuse that same Supabase auth user.
const { data: existingPortalLinks, error: existingPortalLinksError } =
await admin
.from("crm_client_portal_users")
.select("id,auth_user_id,accepted_at,last_login_at,client_id")
.eq("organisation_id", organisationId)
.ilike("email", email)
.eq("is_active", true)
.not("auth_user_id", "is", null)
.not("accepted_at", "is", null)
.neq("id", portalUser.id)
.order("last_login_at", {
  ascending: false,
  nullsFirst: false,
})
.limit(1);

if (existingPortalLinksError) throw existingPortalLinksError;

const existingLinkedPortal =
existingPortalLinks?.[0] || null;

const existingLinkedAuthUserId =
existingLinkedPortal?.auth_user_id || null;

const previouslyInvitedPortalUser =

portalUser.invitation_status === "invited" &&

!portalUser.accepted_at &&

Boolean(portalUser.auth_user_id);

if (existingLinkedAuthUserId) {
  // This person already has an activated PracticePilot Client Portal login
  // for another entity. Reuse that same login and simply open the portal.
  existingAuthUser = true;
  authLinkType = "magiclink";

  const magicResult = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: existingUserRedirectTo,
      data: {
        portal_client_id: clientId,
        portal_user_id: portalUser.id,
        account_type: "client_portal",
      },
    },
  });

  if (
  magicResult.error ||
  !magicResult.data?.properties?.hashed_token
) {
  throw magicResult.error || new Error(
  "This email already has an active PracticePilot Client Portal login, but a secure portal link could not be created."
);
}

linkData = magicResult.data;
} else if (previouslyInvitedPortalUser) {
  // This is NOT a normal existing PracticePilot account.
  // Supabase already created the auth record during the first portal invite,
  // but the client has not created a password / accepted the portal yet.
  const recoveryResult = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: inviteRedirectTo,
    },
  });

  if (
  recoveryResult.error ||
  !recoveryResult.data?.properties?.hashed_token
) {
  throw recoveryResult.error || new Error(
  "Could not create a secure password setup link for this portal user."
);
}

linkData = recoveryResult.data;
passwordSetupRequired = true;
authLinkType = "recovery";
} else {
  const inviteResult = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: inviteRedirectTo,
      data: {
        full_name: portalUser.full_name || "",
        portal_client_id: clientId,
        portal_user_id: portalUser.id,
        account_type: "client_portal",
      },
    },
  });

  if (
  inviteResult.error &&
  /already.*registered|already.*exists|user.*exists/i.test(
  inviteResult.error.message || ""
)
) {
  // Genuine pre-existing PracticePilot/Supabase login.
  existingAuthUser = true;
  authLinkType = "magiclink";

  const magicResult = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: existingUserRedirectTo,
      data: {
        portal_client_id: clientId,
        portal_user_id: portalUser.id,
        account_type: "client_portal",
      },
    },
  });

  if (
  magicResult.error ||
  !magicResult.data?.properties?.hashed_token
) {
  throw magicResult.error || new Error(
  "This email already has a PracticePilot login, but a secure portal link could not be created."
);
}

linkData = magicResult.data;
} else {
  if (
  inviteResult.error ||
  !inviteResult.data?.properties?.hashed_token
) {
  throw inviteResult.error || new Error(
  "Could not create the client portal invitation link."
);
}

linkData = inviteResult.data;
passwordSetupRequired = true;
authLinkType = "invite";
}
}

const authUserId =

linkData.user?.id ||

portalUser.auth_user_id ||

null;

const tokenHash = String(

linkData?.properties?.hashed_token || ""

).trim();

if (!tokenHash) {

  throw new Error(

  "PracticePilot could not create a secure portal token."

);

}

const nextPath = existingAuthUser

? "/portal-welcome?existing=1"

: "/portal-welcome";

const portalAuthLink =

`${origin}/portal-auth?token_hash=${encodeURIComponent(tokenHash)}` +

`&type=${authLinkType}` +

`&next=${encodeURIComponent(nextPath)}`;

await sendInvitationEmail({

  fullName: portalUser.full_name || "",

  email,

  clientName: client.client_name,

  actionLink: portalAuthLink,

  permanentLoginLink: `${origin}/login`,

  existingUser: existingAuthUser,

});

const now = new Date().toISOString();

const { data: updatedPortalUser, error: updateError } =

await admin

.from("crm_client_portal_users")

.update({

  auth_user_id: authUserId,

  invitation_status: existingAuthUser ? "active" : "invited",

  invited_at: now,

  accepted_at: existingAuthUser

  ? portalUser.accepted_at || now

  : null,

  updated_at: now,

})

.eq("id", portalUser.id)

.eq("organisation_id", organisationId)

.eq("client_id", clientId)

.select(

"id,organisation_id,client_id,contact_id,auth_user_id,full_name,email,portal_role,can_view_documents,can_approve_actions,is_active,invitation_status,invited_at,accepted_at,last_login_at,created_at,updated_at"

)

.single();

if (updateError) throw updateError;

return NextResponse.json({

  success: true,

  portal_user: updatedPortalUser,

  existing_user: existingAuthUser,

});

} catch (error) {

  console.error("CLIENT PORTAL INVITE ERROR:", error);

  return NextResponse.json(

  {

    error:

    error instanceof Error

    ? error.message

    : "Could not send the client portal invitation.",

  },

  { status: 500 }

);

}

}
