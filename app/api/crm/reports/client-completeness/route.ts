import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing Supabase admin environment variables.");
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function getProfile(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    throw new Error("Not authenticated.");
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Not authenticated.");
  }

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,full_name,email,role,access_enabled,can_access_crm,can_manage_practice_users"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (
    !profile?.id ||
    !profile.organisation_id ||
    profile.access_enabled === false ||
    profile.can_access_crm === false
  ) {
    throw new Error("CRM access is required.");
  }

  return profile;
}

function isManager(profile: any) {
  return (
    ["Client Manager", "Admin", "Super Admin"].includes(
      String(profile?.role || "")
    ) || profile?.can_manage_practice_users === true
  );
}

function text(value: unknown) {
  return String(value || "").trim();
}

export async function GET(request: Request) {
  try {
    const profile = await getProfile(request);

    const { data: staffUsers, error: staffError } = await admin
      .from("user_profiles")
      .select("id,user_id,full_name,email,access_enabled")
      .eq("organisation_id", profile.organisation_id)
      .eq("access_enabled", true)
      .order("full_name", { ascending: true });

    if (staffError) throw staffError;

    const staffByProfileId = new Map(
      (staffUsers || []).map((user: any) => [String(user.id), user])
    );

    let query = admin
      .from("crm_clients")
      .select(
        `
          id,
          client_name,
          client_code,
          entity_type,
          client_category,
          relationship_status,
          registration_number,
          id_passport_number,
          client_lead_user_id,
          default_work_owner_user_id,
          manager_user_id,
          partner_user_id,
          crm_client_contacts (
            id,
            contact_name,
            email,
            phone,
            mobile,
            is_primary
          )
        `
      )
      .eq("organisation_id", profile.organisation_id)
      .eq("relationship_status", "flying_client")
      .order("client_name", { ascending: true });

    if (!isManager(profile)) {
      query = query.or(
        `client_lead_user_id.eq.${profile.id},default_work_owner_user_id.eq.${profile.id}`
      );
    }

    const { data: clients, error } = await query;

    if (error) throw error;

    const rows = (clients || []).map((client: any) => {
      const contacts = Array.isArray(client.crm_client_contacts)
        ? client.crm_client_contacts
        : [];

      const primaryContact =
        contacts.find((contact: any) => contact?.is_primary === true) ||
        contacts[0] ||
        null;

      const category = text(client.client_category).toLowerCase();
      const isIndividual =
        category === "individual" ||
        text(client.entity_type).toLowerCase() === "individual";

      const registrationOrId = isIndividual
        ? text(client.id_passport_number)
        : text(client.registration_number);

      const contactName = text(primaryContact?.contact_name);
      const email = text(primaryContact?.email);
      const phone =
        text(primaryContact?.mobile) || text(primaryContact?.phone);

      const missing: string[] = [];

      if (!registrationOrId) {
        missing.push(isIndividual ? "ID / passport number" : "Registration number");
      }

      if (!contactName) {
        missing.push("Primary contact");
      }

      if (!phone) {
        missing.push("Telephone / mobile");
      }

      if (!email) {
        missing.push("Email");
      }

      return {
        client_id: client.id,
        client_name: client.client_name,
        client_code: client.client_code || null,
        entity_type: client.entity_type || null,
        client_category: client.client_category || null,
        client_lead_user_id: client.client_lead_user_id || null,
        client_lead_name:
          staffByProfileId.get(String(client.client_lead_user_id || ""))?.full_name ||
          staffByProfileId.get(String(client.client_lead_user_id || ""))?.email ||
          null,
        registration_or_id: registrationOrId || null,
        primary_contact: contactName || null,
        phone: phone || null,
        email: email || null,
        missing_items: missing,
        missing_count: missing.length,
      };
    });

    const incompleteRows = rows.filter((row) => row.missing_count > 0);

    return NextResponse.json({
      success: true,
      scope: isManager(profile) ? "practice" : "my_clients",
      current_staff: {
        id: profile.id,
        full_name: profile.full_name || null,
        email: profile.email || null,
      },
      client_leads: (staffUsers || []).map((user: any) => ({
        id: user.id,
        full_name: user.full_name || null,
        email: user.email || null,
      })),
      summary: {
        total_clients: rows.length,
        complete_clients: rows.filter((row) => row.missing_count === 0).length,
        incomplete_clients: incompleteRows.length,
        missing_registration_or_id: rows.filter(
          (row) => !row.registration_or_id
        ).length,
        missing_contact_number: rows.filter((row) => !row.phone).length,
        missing_email: rows.filter((row) => !row.email).length,
      },
      rows,
    });
  } catch (error: any) {
    const message =
      error?.message || "Could not load client information completeness.";

    return NextResponse.json(
      { success: false, error: message },
      {
        status:
          message.includes("authenticated") ||
          message.includes("access")
            ? 403
            : 500,
      }
    );
  }
}
