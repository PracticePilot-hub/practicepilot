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

type CommercialTerm = {
  id: string;
  organisation_id: string;
  client_id: string;
  commercial_model: string | null;
  core_fee_amount: number | null;
  billing_frequency: string | null;
  default_hourly_rate: number | null;
  effective_from: string;
  effective_to: string | null;
  billing_day: number | null;
  vat_treatment: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

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
      "user_id, organisation_id, role, access_enabled, can_manage_practice_users, can_access_commercials, can_view_commercial_reports"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.access_enabled || !profile.organisation_id) {
    throw new Error("Your PracticePilot practice access could not be confirmed.");
  }

  if (profile.can_access_commercials !== true) {
    throw new Error("You do not have access to client commercial terms.");
  }

  return profile;
}

function dateOnly(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? text : "";
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function dayBefore(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function toNullableNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function effectiveTermForDate(
  terms: CommercialTerm[],
  targetDate: string
): CommercialTerm | null {
  const current =
    terms.find(
      (row) =>
        row.is_active === true &&
        row.effective_from <= targetDate &&
        (!row.effective_to || row.effective_to >= targetDate)
    ) || null;

  if (current) return current;

  const upcoming =
    terms.find(
      (row) =>
        row.is_active === true &&
        row.effective_from > targetDate
    ) || null;

  return upcoming;
}

export async function GET(request: Request) {
  try {
    const profile = await getCommercialAccess(request);
    const asAt =
      dateOnly(new URL(request.url).searchParams.get("asAt")) || todayDate();

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
        .eq("is_active", true)
        .order("effective_from", { ascending: true }),
    ]);

    if (clientsError) throw clientsError;
    if (termsError) throw termsError;

    const termsByClient = new Map<string, CommercialTerm[]>();

    for (const row of (terms || []) as CommercialTerm[]) {
      const list = termsByClient.get(row.client_id) || [];
      list.push(row);
      termsByClient.set(row.client_id, list);
    }

    const rows = (clients || []).map((client: any) => {
      const history = termsByClient.get(client.id) || [];

      return {
        ...client,
        commercial_terms: effectiveTermForDate(history, asAt),
        commercial_history: history,
      };
    });

    return NextResponse.json({
      success: true,
      as_at: asAt,
      rows,
    });
  } catch (error: any) {
    const message = error?.message || "Could not load client commercial terms.";

    return NextResponse.json(
      { success: false, error: message },
      {
        status:
          message.includes("access") ||
          message.includes("signed in") ||
          message.includes("login session")
            ? 403
            : 500,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getCommercialAccess(request);
    const body = await request.json();

    const clientId = String(body?.clientId || "").trim();
    const effectiveFrom =
      dateOnly(body?.effectiveFrom) || todayDate();

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

    const coreFeeAmount = toNullableNumber(body?.coreFeeAmount);
    const hourlyRate = toNullableNumber(body?.defaultHourlyRate);
    const billingDay = toNullableNumber(body?.billingDay);

    if (
      billingDay != null &&
      (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31)
    ) {
      return NextResponse.json(
        { success: false, error: "Billing day must be between 1 and 31." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: existingRows, error: existingError } = await admin
      .from("crm_client_commercial_terms")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("effective_from", { ascending: true });

    if (existingError) throw existingError;

    const versions = (existingRows || []) as CommercialTerm[];
    const sameDate =
      versions.find((row) => row.effective_from === effectiveFrom) || null;

    const previous =
      [...versions]
        .filter((row) => row.effective_from < effectiveFrom)
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ||
      null;

    const next =
      versions.find((row) => row.effective_from > effectiveFrom) || null;

    const effectiveTo = next ? dayBefore(next.effective_from) : null;

    const row = {
      organisation_id: profile.organisation_id,
      client_id: clientId,
      commercial_model: body?.commercialModel || "monthly_retainer",
      core_fee_amount: coreFeeAmount,
      billing_frequency: body?.billingFrequency || null,
      default_hourly_rate: hourlyRate,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      billing_day: billingDay,
      vat_treatment: body?.vatTreatment || "exclusive",
      notes: body?.notes || null,
      is_active: true,
      updated_at: now,
    };

    if (sameDate?.id) {
      const { error } = await admin
        .from("crm_client_commercial_terms")
        .update(row)
        .eq("id", sameDate.id)
        .eq("organisation_id", profile.organisation_id);

      if (error) throw error;
    } else {
      const { error } = await admin
        .from("crm_client_commercial_terms")
        .insert(row);

      if (error) throw error;
    }

    if (previous?.id) {
      const previousEndDate = dayBefore(effectiveFrom);

      if (previous.effective_to !== previousEndDate) {
        const { error } = await admin
          .from("crm_client_commercial_terms")
          .update({
            effective_to: previousEndDate,
            updated_at: now,
          })
          .eq("id", previous.id)
          .eq("organisation_id", profile.organisation_id);

        if (error) throw error;
      }
    }

    const { data: refreshed, error: refreshedError } = await admin
      .from("crm_client_commercial_terms")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("effective_from", { ascending: true });

    if (refreshedError) throw refreshedError;

    return NextResponse.json({
      success: true,
      effective_from: effectiveFrom,
      commercial_history: refreshed || [],
    });
  } catch (error: any) {
    const message = error?.message || "Could not save client commercial terms.";

    return NextResponse.json(
      { success: false, error: message },
      {
        status:
          message.includes("access") ||
          message.includes("signed in") ||
          message.includes("login session")
            ? 403
            : 500,
      }
    );
  }
}
