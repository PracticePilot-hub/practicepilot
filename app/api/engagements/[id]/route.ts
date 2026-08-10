// Path: app/api/engagements/[id]/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing server Supabase service role key.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getEngagementId(context: any) {
  const params = await context.params;
  return String(params?.id || "");
}

function getBearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

async function getCurrentProfile(
  request: Request,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(
      `
        id,
        user_id,
        email,
        full_name,
        role,
        organisation_id,
        access_enabled
      `
    )
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { success: false, error: "Could not load user profile." },
        { status: 403 }
      ),
    };
  }

  const current = profile as UserProfile;

  if (!current.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { success: false, error: "User access is blocked." },
        { status: 403 }
      ),
    };
  }

  return { profile: current, response: null as NextResponse | null };
}

function canAccessOrganisation(
  profile: UserProfile,
  organisationId: string | null
) {
  if (!organisationId) return false;
  return isGlobalAdmin(profile.role) || profile.organisation_id === organisationId;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonths(year: number, monthIndex: number, amount: number) {
  const date = new Date(Date.UTC(year, monthIndex + amount, 1));
  return {
    year: date.getUTCFullYear(),
    monthIndex: date.getUTCMonth(),
  };
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) throw new Error("Invalid date.");

  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

function money(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function buildBillingRows(args: {
  engagementId: string;
  organisationId: string;
  contractStartDate: string;
  contractMonths: number;
  billingDay: number;
  paymentDueDay: number;
  monthlyFee: number;
  feeIsExclusiveVat: boolean;
  vatRate: number;
}) {
  const {
    engagementId,
    organisationId,
    contractStartDate,
    contractMonths,
    billingDay,
    paymentDueDay,
    monthlyFee,
    feeIsExclusiveVat,
    vatRate,
  } = args;

  const start = parseIsoDate(contractStartDate);

  return Array.from({ length: contractMonths }, (_, index) => {
    const serviceMonth = addMonths(start.year, start.monthIndex, index);
    const previousMonth = addMonths(serviceMonth.year, serviceMonth.monthIndex, -1);

    const servicePeriodStart = isoDate(serviceMonth.year, serviceMonth.monthIndex, 1);
    const servicePeriodEnd = isoDate(
      serviceMonth.year,
      serviceMonth.monthIndex,
      daysInMonth(serviceMonth.year, serviceMonth.monthIndex)
    );

    const safeBillingDay = Math.min(
      billingDay,
      daysInMonth(previousMonth.year, previousMonth.monthIndex)
    );
    const safeDueDay = Math.min(
      paymentDueDay,
      daysInMonth(serviceMonth.year, serviceMonth.monthIndex)
    );

    const invoiceDate = isoDate(previousMonth.year, previousMonth.monthIndex, safeBillingDay);
    const paymentDueDate = isoDate(serviceMonth.year, serviceMonth.monthIndex, safeDueDay);

    const amountExVat = feeIsExclusiveVat
      ? monthlyFee
      : monthlyFee / (1 + vatRate);
    const vatAmount = amountExVat * vatRate;
    const amountIncVat = amountExVat + vatAmount;

    return {
      engagement_id: engagementId,
      organisation_id: organisationId,
      sequence_no: index + 1,
      service_period_start: servicePeriodStart,
      service_period_end: servicePeriodEnd,
      invoice_date: invoiceDate,
      payment_due_date: paymentDueDate,
      amount_ex_vat: Number(amountExVat.toFixed(2)),
      vat_rate: vatRate,
      vat_amount: Number(vatAmount.toFixed(2)),
      amount_inc_vat: Number(amountIncVat.toFixed(2)),
      billing_status: "Scheduled",
    };
  });
}

export async function GET(request: Request, context: any) {
  const supabase = getSupabaseAdmin();

  try {
    const engagementId = await getEngagementId(context);

    if (!engagementId) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const { profile, response } = await getCurrentProfile(request, supabase);
    if (response || !profile) return response;

    const { data: engagement, error: engagementError } = await supabase
      .from("engagements")
      .select("*")
      .eq("id", engagementId)
      .single();

    if (engagementError || !engagement) {
      return NextResponse.json(
        { success: false, error: "Engagement not found." },
        { status: 404 }
      );
    }

    if (!canAccessOrganisation(profile, engagement.organisation_id)) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this engagement." },
        { status: 403 }
      );
    }

    const [servicesResult, clausesResult, billingResult, eventsResult, addendaResult] =
      await Promise.all([
        supabase
          .from("engagement_services")
          .select("*")
          .eq("engagement_id", engagementId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("engagement_clauses")
          .select("*")
          .eq("engagement_id", engagementId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("engagement_billing_schedule")
          .select("*")
          .eq("engagement_id", engagementId)
          .order("sequence_no", { ascending: true }),
        supabase
          .from("engagement_events")
          .select("*")
          .eq("engagement_id", engagementId)
          .order("created_at", { ascending: false }),
        supabase
          .from("engagement_addenda")
          .select("*")
          .eq("engagement_id", engagementId)
          .order("created_at", { ascending: false }),
      ]);

    if (servicesResult.error) throw servicesResult.error;
    if (clausesResult.error) throw clausesResult.error;
    if (billingResult.error) throw billingResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (addendaResult.error) throw addendaResult.error;

    return NextResponse.json({
      success: true,
      engagement,
      services: servicesResult.data || [],
      clauses: clausesResult.data || [],
      billing_schedule: billingResult.data || [],
      events: eventsResult.data || [],
      addenda: addendaResult.data || [],
    });
  } catch (error: any) {
    console.error("LOAD ENGAGEMENT ERROR:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Unable to load engagement." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: any) {
  const supabase = getSupabaseAdmin();

  try {
    const engagementId = await getEngagementId(context);

    if (!engagementId) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const { profile, response } = await getCurrentProfile(request, supabase);
    if (response || !profile) return response;

    const { data: engagement, error: engagementError } = await supabase
      .from("engagements")
      .select("*")
      .eq("id", engagementId)
      .single();

    if (engagementError || !engagement) {
      return NextResponse.json(
        { success: false, error: "Engagement not found." },
        { status: 404 }
      );
    }

    if (!canAccessOrganisation(profile, engagement.organisation_id)) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this engagement." },
        { status: 403 }
      );
    }

    if (engagement.locked_at) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This engagement is signed and locked. Use an addendum or replacement engagement.",
        },
        { status: 409 }
      );
    }

    if (engagement.status !== "Draft") {
      return NextResponse.json(
        { success: false, error: "Only a Draft engagement can be edited." },
        { status: 409 }
      );
    }

    const body = await request.json();

    const contractStartDate = String(
      body?.contractStartDate || engagement.contract_start_date
    );
    const contractMonths = Math.max(
      1,
      Math.min(120, Number(body?.contractMonths ?? engagement.contract_months))
    );
    const billingDay = Math.max(
      1,
      Math.min(28, Number(body?.billingDay ?? engagement.billing_day))
    );
    const paymentDueDay = Math.max(
      1,
      Math.min(28, Number(body?.paymentDueDay ?? engagement.payment_due_day))
    );
    const monthlyFee = Math.max(
      0,
      money(body?.monthlyFee ?? engagement.monthly_fee)
    );
    const feeIsExclusiveVat =
      body?.feeIsExclusiveVat === undefined
        ? Boolean(engagement.fee_is_exclusive_vat)
        : Boolean(body.feeIsExclusiveVat);
    const vatRate = Math.max(
      0,
      Math.min(1, money(body?.vatRate ?? engagement.vat_rate))
    );

    const start = parseIsoDate(contractStartDate);
    const endMonth = addMonths(start.year, start.monthIndex, contractMonths - 1);
    const contractEndDate = isoDate(
      endMonth.year,
      endMonth.monthIndex,
      daysInMonth(endMonth.year, endMonth.monthIndex)
    );

    const renewalMethod =
      String(body?.renewalMethod || engagement.renewal_method) === "Manual renewal"
        ? "Manual renewal"
        : "New contract required";

    const autoRenew =
      body?.autoRenew === undefined
        ? Boolean(engagement.auto_renew)
        : Boolean(body.autoRenew);

    const specialTerms =
      body?.specialTerms === undefined
        ? engagement.special_terms
        : String(body.specialTerms || "").trim() || null;

    const internalNotes =
      body?.internalNotes === undefined
        ? engagement.internal_notes
        : String(body.internalNotes || "").trim() || null;

    const { data: updatedEngagement, error: updateError } = await supabase
      .from("engagements")
      .update({
        contract_start_date: contractStartDate,
        contract_end_date: contractEndDate,
        contract_months: contractMonths,
        billing_day: billingDay,
        payment_due_day: paymentDueDay,
        monthly_fee: monthlyFee,
        fee_is_exclusive_vat: feeIsExclusiveVat,
        vat_rate: vatRate,
        renewal_method: renewalMethod,
        auto_renew: autoRenew,
        special_terms: specialTerms,
        internal_notes: internalNotes,
      })
      .eq("id", engagementId)
      .select("*")
      .single();

    if (updateError || !updatedEngagement) {
      throw updateError || new Error("Could not update engagement.");
    }

    const { error: deleteBillingError } = await supabase
      .from("engagement_billing_schedule")
      .delete()
      .eq("engagement_id", engagementId);

    if (deleteBillingError) throw deleteBillingError;

    const billingRows = buildBillingRows({
      engagementId,
      organisationId: engagement.organisation_id,
      contractStartDate,
      contractMonths,
      billingDay,
      paymentDueDay,
      monthlyFee,
      feeIsExclusiveVat,
      vatRate,
    });

    const { error: insertBillingError } = await supabase
      .from("engagement_billing_schedule")
      .insert(billingRows);

    if (insertBillingError) throw insertBillingError;

    await supabase.from("engagement_events").insert({
      engagement_id: engagementId,
      organisation_id: engagement.organisation_id,
      event_type: "Engagement Updated",
      from_status: engagement.status,
      to_status: engagement.status,
      event_description: "Draft engagement setup and billing schedule were updated.",
      event_payload: {
        contract_start_date: contractStartDate,
        contract_end_date: contractEndDate,
        contract_months: contractMonths,
        billing_day: billingDay,
        payment_due_day: paymentDueDay,
        monthly_fee: monthlyFee,
        fee_is_exclusive_vat: feeIsExclusiveVat,
        vat_rate: vatRate,
        renewal_method: renewalMethod,
        auto_renew: autoRenew,
      },
      performed_by: profile.id,
      performed_by_name: profile.full_name || profile.email,
      performed_by_email: profile.email,
    });

    const { data: billingSchedule, error: billingLoadError } = await supabase
      .from("engagement_billing_schedule")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("sequence_no", { ascending: true });

    if (billingLoadError) throw billingLoadError;

    return NextResponse.json({
      success: true,
      engagement: updatedEngagement,
      billing_schedule: billingSchedule || [],
    });
  } catch (error: any) {
    console.error("UPDATE ENGAGEMENT ERROR:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Unable to update engagement." },
      { status: 500 }
    );
  }
}
