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

async function getCommercialAccess(request: Request) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) throw new Error("You are not signed in.");

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Your login session could not be confirmed.");
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select(
      "user_id, organisation_id, role, access_enabled, can_manage_practice_users"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.access_enabled || !profile.organisation_id) {
    throw new Error("Your PracticePilot practice access could not be confirmed.");
  }

  const allowed =
    profile.role === "Client Manager" ||
    profile.role === "Admin" ||
    profile.role === "Super Admin";

  if (!allowed) {
    throw new Error("You do not have access to client commercial terms.");
  }

  return profile;
}

export async function GET(request: Request) {
  try {
    const profile = await getCommercialAccess(request);

    const [
      { data: clients, error: clientsError },
      { data: terms, error: termsError },
    ] = await Promise.all([
      admin
        .from("crm_clients")
        .select(
          "id, client_name, client_code, entity_type, relationship_status, engagement_type"
        )
        .eq("organisation_id", profile.organisation_id)
        .eq("relationship_status", "flying_client")
        .order("client_name", { ascending: true }),

      admin
        .from("crm_client_commercial_terms")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("is_active", true),
    ]);

    if (clientsError) throw clientsError;
    if (termsError) throw termsError;

    const termMap = new Map(
      (terms || []).map((row: any) => [row.client_id, row])
    );

    const rows = (clients || []).map((client: any) => ({
      ...client,
      commercial_terms: termMap.get(client.id) || null,
    }));

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error: any) {
    const message = error?.message || "Could not load client commercial terms.";
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("access") ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getCommercialAccess(request);
    const body = await request.json();

    const clientId = String(body?.clientId || "").trim();
    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client is required." },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await admin
      .from("crm_clients")
      .select("id")
      .eq("id", clientId)
      .eq("organisation_id", profile.organisation_id)
      .eq("relationship_status", "flying_client")
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Flying Client not found." },
        { status: 404 }
      );
    }

    const coreFeeAmount =
      body?.coreFeeAmount === "" || body?.coreFeeAmount == null
        ? null
        : Number(body.coreFeeAmount);

    const hourlyRate =
      body?.defaultHourlyRate === "" || body?.defaultHourlyRate == null
        ? null
        : Number(body.defaultHourlyRate);

    const billingDay =
      body?.billingDay === "" || body?.billingDay == null
        ? null
        : Number(body.billingDay);

    const row = {
      organisation_id: profile.organisation_id,
      client_id: clientId,
      commercial_model: body?.commercialModel || "monthly_retainer",
      core_fee_amount: coreFeeAmount,
      billing_frequency: body?.billingFrequency || null,
      default_hourly_rate: hourlyRate,
      effective_from:
        body?.effectiveFrom || new Date().toISOString().slice(0, 10),
      effective_to: body?.effectiveTo || null,
      billing_day: billingDay,
      vat_treatment: body?.vatTreatment || "exclusive",
      notes: body?.notes || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await admin
      .from("crm_client_commercial_terms")
      .select("id")
      .eq("organisation_id", profile.organisation_id)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { error } = await admin
        .from("crm_client_commercial_terms")
        .update(row)
        .eq("id", existing.id)
        .eq("organisation_id", profile.organisation_id);

      if (error) throw error;
    } else {
      const { error } = await admin
        .from("crm_client_commercial_terms")
        .insert(row);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const message = error?.message || "Could not save client commercial terms.";
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("access") ? 403 : 500 }
    );
  }
}
