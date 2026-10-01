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

async function assertClient(
  organisationId: string,
  clientId: string
) {
  const { data: client, error } = await admin
    .from("crm_clients")
    .select("id,client_name")
    .eq("id", clientId)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (error) throw error;
  if (!client) throw new Error("Client not found.");

  return client;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    await assertClient(organisationId, clientId);

    const [{ data: portalUsers, error: portalUsersError }, { data: contacts, error: contactsError }] =
      await Promise.all([
        admin
          .from("crm_client_portal_users")
          .select(
            "id,organisation_id,client_id,contact_id,auth_user_id,full_name,email,portal_role,can_view_documents,can_approve_actions,is_active,invitation_status,invited_at,accepted_at,last_login_at,created_at,updated_at"
          )
          .eq("organisation_id", organisationId)
          .eq("client_id", clientId)
          .order("portal_role", { ascending: true })
          .order("full_name", { ascending: true, nullsFirst: false })
          .order("email", { ascending: true }),

        admin
          .from("crm_client_contacts")
          .select(
            "id,contact_name,contact_position,email,mobile,phone,is_primary"
          )
          .eq("client_id", clientId)
          .order("is_primary", { ascending: false })
          .order("contact_name", { ascending: true }),
      ]);

    if (portalUsersError) throw portalUsersError;
    if (contactsError) throw contactsError;

    return NextResponse.json({
      success: true,
      portal_users: portalUsers || [],
      contacts: contacts || [],
    });
  } catch (error) {
    console.error("CLIENT PORTAL USERS GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load client portal access.",
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
    const { user, profile, response } = await currentContext(request);
    if (response || !profile || !user) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    await assertClient(organisationId, clientId);

    const body = await request.json().catch(() => ({}));

    const contactId = String(body?.contact_id || "").trim() || null;
    let fullName = String(body?.full_name || "").trim() || null;
    let email = String(body?.email || "").trim().toLowerCase();

    if (contactId) {
      const { data: contact, error: contactError } = await admin
        .from("crm_client_contacts")
        .select("id,contact_name,email")
        .eq("id", contactId)
        .eq("client_id", clientId)
        .maybeSingle();

      if (contactError) throw contactError;

      if (!contact) {
        return NextResponse.json(
          { error: "Selected client contact could not be found." },
          { status: 404 }
        );
      }

      fullName =
        String(contact.contact_name || "").trim() ||
        fullName;

      email =
        String(contact.email || "").trim().toLowerCase() ||
        email;
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const portalRole =
      String(body?.portal_role || "").trim() === "primary"
        ? "primary"
        : "authorised";

    if (portalRole === "primary") {
      const { error: resetPrimaryError } = await admin
        .from("crm_client_portal_users")
        .update({
          portal_role: "authorised",
          updated_at: new Date().toISOString(),
        })
        .eq("organisation_id", organisationId)
        .eq("client_id", clientId)
        .eq("portal_role", "primary");

      if (resetPrimaryError) throw resetPrimaryError;
    }

    const portalPayload = {
      organisation_id: organisationId,
      client_id: clientId,
      contact_id: contactId,
      full_name: fullName,
      email,
      portal_role: portalRole,
      can_view_documents:
        body?.can_view_documents !== false,
      can_approve_actions:
        body?.can_approve_actions === true,
      is_active: true,
      invitation_status: "not_invited",
      created_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: existingPortalUser, error: existingPortalUserError } =
      await admin
        .from("crm_client_portal_users")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("client_id", clientId)
        .ilike("email", email)
        .maybeSingle();

    if (existingPortalUserError) throw existingPortalUserError;

    let data: any = null;

    if (existingPortalUser?.id) {
      const { data: updatedPortalUser, error: updatePortalUserError } =
        await admin
          .from("crm_client_portal_users")
          .update(portalPayload)
          .eq("id", existingPortalUser.id)
          .eq("organisation_id", organisationId)
          .eq("client_id", clientId)
          .select(
            "id,organisation_id,client_id,contact_id,auth_user_id,full_name,email,portal_role,can_view_documents,can_approve_actions,is_active,invitation_status,invited_at,accepted_at,last_login_at,created_at,updated_at"
          )
          .single();

      if (updatePortalUserError) throw updatePortalUserError;
      data = updatedPortalUser;
    } else {
      const { data: createdPortalUser, error: createPortalUserError } =
        await admin
          .from("crm_client_portal_users")
          .insert(portalPayload)
          .select(
            "id,organisation_id,client_id,contact_id,auth_user_id,full_name,email,portal_role,can_view_documents,can_approve_actions,is_active,invitation_status,invited_at,accepted_at,last_login_at,created_at,updated_at"
          )
          .single();

      if (createPortalUserError) throw createPortalUserError;
      data = createdPortalUser;
    }

    return NextResponse.json({
      success: true,
      portal_user: data,
    });
  } catch (error) {
    console.error("CLIENT PORTAL USERS POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save client portal access.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    await assertClient(organisationId, clientId);

    const body = await request.json().catch(() => ({}));
    const portalUserId = String(body?.portal_user_id || "").trim();

    if (!portalUserId) {
      return NextResponse.json(
        { error: "Portal user ID is required." },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body?.is_active === "boolean") {
      update.is_active = body.is_active;
      update.invitation_status = body.is_active
        ? "not_invited"
        : "disabled";
    }

    if (typeof body?.can_view_documents === "boolean") {
      update.can_view_documents = body.can_view_documents;
    }

    if (typeof body?.can_approve_actions === "boolean") {
      update.can_approve_actions = body.can_approve_actions;
    }

    if (
      body?.portal_role === "primary" ||
      body?.portal_role === "authorised"
    ) {
      if (body.portal_role === "primary") {
        const { error: resetPrimaryError } = await admin
          .from("crm_client_portal_users")
          .update({
            portal_role: "authorised",
            updated_at: new Date().toISOString(),
          })
          .eq("organisation_id", organisationId)
          .eq("client_id", clientId)
          .eq("portal_role", "primary");

        if (resetPrimaryError) throw resetPrimaryError;
      }

      update.portal_role = body.portal_role;
    }

    const { data, error } = await admin
      .from("crm_client_portal_users")
      .update(update)
      .eq("id", portalUserId)
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .select(
        "id,organisation_id,client_id,contact_id,auth_user_id,full_name,email,portal_role,can_view_documents,can_approve_actions,is_active,invitation_status,invited_at,accepted_at,last_login_at,created_at,updated_at"
      )
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Portal user not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      portal_user: data,
    });
  } catch (error) {
    console.error("CLIENT PORTAL USERS PATCH ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update client portal access.",
      },
      { status: 500 }
    );
  }
}
    