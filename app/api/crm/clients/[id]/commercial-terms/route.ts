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

async function getContext(request: Request, clientId: string) {
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
      "organisation_id, role, access_enabled, can_access_commercials"
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

  const { data: client, error: clientError } = await admin
    .from("crm_clients")
    .select(
      "id, client_name, client_code, entity_type, engagement_type, relationship_status, organisation_id"
    )
    .eq("id", clientId)
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();

  if (clientError) throw clientError;
  if (!client) throw new Error("Client not found.");

  return { profile, client };
}

function nestedServiceName(value: any) {
  if (Array.isArray(value)) return value[0]?.service_name || "";
  return value?.service_name || "";
}

function dateOnlyToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);

  const outYear = date.getFullYear();
  const outMonth = String(date.getMonth() + 1).padStart(2, "0");
  const outDay = String(date.getDate()).padStart(2, "0");

  return `${outYear}-${outMonth}-${outDay}`;
}

function nullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalText(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function sameNumber(a: unknown, b: unknown) {
  const left = a == null || a === "" ? null : Number(a);
  const right = b == null || b === "" ? null : Number(b);

  if (left == null && right == null) return true;
  return left === right;
}

function commercialRuleChanged(existing: any, next: any) {
  return (
    String(existing?.billing_treatment || "included") !==
      String(next.billing_treatment || "included") ||
    !sameNumber(existing?.fee_amount, next.fee_amount) ||
    !sameNumber(existing?.hourly_rate, next.hourly_rate) ||
    normalText(existing?.fee_frequency) !==
      normalText(next.fee_frequency) ||
    normalText(existing?.scope_notes) !== normalText(next.scope_notes)
  );
}

async function snapshotHistory(
  profile: any,
  clientId: string,
  existing: any,
  effectiveTo: string
) {
  const effectiveFrom =
    String(existing?.effective_from || "").trim() || dateOnlyToday();

  const { error } = await admin
    .from("crm_client_commercial_service_term_history")
    .insert({
      organisation_id: profile.organisation_id,
      client_id: clientId,
      client_service_id: existing.client_service_id || null,
      source_term_id: existing.id,
      service_name: existing.service_name,
      billing_treatment: existing.billing_treatment || "included",
      fee_amount: existing.fee_amount ?? null,
      hourly_rate: existing.hourly_rate ?? null,
      fee_frequency: existing.fee_frequency || null,
      scope_notes: existing.scope_notes || null,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
    });

  if (error) throw error;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, client } = await getContext(request, id);

    const [
      { data: terms, error: termsError },
      { data: serviceTerms, error: serviceTermsError },
      { data: serviceHistory, error: historyError },
      { data: clientServices, error: clientServicesError },
    ] = await Promise.all([
      admin
        .from("crm_client_commercial_terms")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("client_id", id)
        .eq("is_active", true)
        .maybeSingle(),

      admin
        .from("crm_client_commercial_service_terms")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("client_id", id)
        .eq("is_active", true)
        .order("service_name", { ascending: true }),

      admin
        .from("crm_client_commercial_service_term_history")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("client_id", id)
        .order("effective_from", { ascending: false }),

      admin
        .from("crm_client_services")
        .select(
          "id, frequency, is_active, crm_services(id, service_name, service_group)"
        )
        .eq("client_id", id)
        .eq("is_active", true),
    ]);

    if (termsError) throw termsError;
    if (serviceTermsError) throw serviceTermsError;
    if (historyError) throw historyError;
    if (clientServicesError) throw clientServicesError;

    const activeServices = (clientServices || [])
      .map((row: any) => ({
        client_service_id: row.id,
        service_name: nestedServiceName(row.crm_services),
        service_group: Array.isArray(row.crm_services)
          ? row.crm_services[0]?.service_group || null
          : row.crm_services?.service_group || null,
        tasking_frequency: row.frequency || null,
      }))
      .filter((row: any) => row.service_name)
      .sort((a: any, b: any) =>
        a.service_name.localeCompare(b.service_name)
      );

    return NextResponse.json({
      success: true,
      client,
      terms: terms || null,
      serviceTerms: serviceTerms || [],
      serviceHistory: serviceHistory || [],
      activeServices,
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile } = await getContext(request, id);
    const body = await request.json();

    const incoming = Array.isArray(body?.serviceTerms)
      ? body.serviceTerms
      : [];

    const incomingServiceIds = incoming
      .map((item: any) => String(item?.clientServiceId || "").trim())
      .filter(Boolean);

    const { data: existing, error: existingError } = await admin
      .from("crm_client_commercial_service_terms")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .eq("client_id", id)
      .eq("is_active", true);

    if (existingError) throw existingError;

    for (const row of existing || []) {
      if (
        row.client_service_id &&
        !incomingServiceIds.includes(String(row.client_service_id))
      ) {
        const endDate = dateOnlyToday();

        await snapshotHistory(profile, id, row, endDate);

        const { error } = await admin
          .from("crm_client_commercial_service_terms")
          .update({
            is_active: false,
            effective_to: endDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("organisation_id", profile.organisation_id);

        if (error) throw error;
      }
    }

    for (const item of incoming) {
      const clientServiceId = String(item?.clientServiceId || "").trim();
      const serviceName = String(item?.serviceName || "").trim();

      if (!clientServiceId || !serviceName) continue;

      const effectiveFrom =
        String(item?.effectiveFrom || "").trim() || dateOnlyToday();

      const nextRow = {
        organisation_id: profile.organisation_id,
        client_id: id,
        client_service_id: clientServiceId,
        service_name: serviceName,
        billing_treatment: item?.billingTreatment || "included",
        fee_amount: nullableNumber(item?.feeAmount),
        hourly_rate: nullableNumber(item?.hourlyRate),
        fee_frequency: normalText(item?.feeFrequency),
        scope_notes: normalText(item?.scopeNotes),
        effective_from: effectiveFrom,
        effective_to: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const existingRow = (existing || []).find(
        (entry: any) =>
          String(entry.client_service_id || "") === clientServiceId
      );

      if (!existingRow?.id) {
        const { error } = await admin
          .from("crm_client_commercial_service_terms")
          .insert(nextRow);

        if (error) throw error;
        continue;
      }

      const ruleChanged = commercialRuleChanged(existingRow, nextRow);
      const oldEffectiveFrom =
        String(existingRow.effective_from || "").trim() || effectiveFrom;

      if (!ruleChanged && oldEffectiveFrom === effectiveFrom) {
        continue;
      }

      if (ruleChanged && effectiveFrom > oldEffectiveFrom) {
        await snapshotHistory(
          profile,
          id,
          existingRow,
          previousDate(effectiveFrom)
        );
      }

      const { error } = await admin
        .from("crm_client_commercial_service_terms")
        .update(nextRow)
        .eq("id", existingRow.id)
        .eq("organisation_id", profile.organisation_id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const message =
      error?.message || "Could not save client service commercial terms.";

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
