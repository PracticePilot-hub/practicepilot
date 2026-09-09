import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type UserProfile = {
  id: string;
  user_id: string;
  email: string;
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

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

async function getCurrentProfile(
  request: Request,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("Not authenticated.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Not authenticated.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(`
      id,
      user_id,
      email,
      role,
      organisation_id,
      access_enabled
    `)
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Could not load user profile.");
  }

  if (!profile.access_enabled) {
    throw new Error("User access is blocked.");
  }

  return profile as UserProfile;
}

function normaliseMoney(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function normaliseInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function makeProposalNumber() {
  const now = new Date();

  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `PP-${datePart}-${timePart}`;
}

async function duplicateProposal(
  proposalId: string,
  organisationId: string,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const { data: original, error: originalError } = await supabase
    .from("proposals")
    .select(`
      id,
      organisation_id,
      prospect_registration_number,
      package_code,
      package_name,
      package_description,
      package_monthly_fee,
      fee_is_exclusive_vat,
      monthly_fee,
      annual_fee,
      once_off_fee,
      offer_annual_prepayment,
      annual_prepayment_months,
      normal_annual_fee,
      annual_prepayment_fee,
      annual_prepayment_saving,
      introduction,
      notes
    `)
    .eq("id", proposalId)
    .single();

  if (originalError) throw originalError;

  const { data: originalServices, error: servicesError } = await supabase
    .from("proposal_services")
    .select(`
      service_code,
      category,
      service_name,
      description,
      fee_type,
      amount,
      included_in_package,
      scope_quantity,
      scope_unit,
      client_facing_note,
      sort_order
    `)
    .eq("proposal_id", proposalId)
    .order("sort_order", { ascending: true });

  if (servicesError) throw servicesError;

  const proposalDate = new Date();
  const validUntil = new Date(proposalDate);
  validUntil.setDate(validUntil.getDate() + 14);

  const proposalNumber = makeProposalNumber();

  const { data: duplicate, error: duplicateError } = await supabase
    .from("proposals")
    .insert({
      proposal_number: proposalNumber,
      organisation_id: original.organisation_id || organisationId,
      client_id: null,
      client_name: "New Prospective Client",
      contact_name: null,
      contact_email: null,
      prospect_company_name: "New Prospective Client",
      prospect_registration_number: original.prospect_registration_number || null,
      prospect_contact_name: null,
      prospect_contact_email: null,
      prospect_contact_number: null,
      package_code: original.package_code || "custom",
      package_name: original.package_name || "Custom Package",
      package_description: original.package_description || null,
      package_monthly_fee: normaliseMoney(original.package_monthly_fee),
      fee_is_exclusive_vat: original.fee_is_exclusive_vat !== false,
      status: "Draft",
      proposal_date: proposalDate.toISOString().slice(0, 10),
      valid_until: validUntil.toISOString().slice(0, 10),
      monthly_fee: normaliseMoney(original.monthly_fee),
      annual_fee: normaliseMoney(original.annual_fee),
      once_off_fee: normaliseMoney(original.once_off_fee),
      offer_annual_prepayment: Boolean(original.offer_annual_prepayment),
      annual_prepayment_months: original.annual_prepayment_months,
      normal_annual_fee: original.normal_annual_fee,
      annual_prepayment_fee: original.annual_prepayment_fee,
      annual_prepayment_saving: original.annual_prepayment_saving,
      introduction: original.introduction || null,
      notes: original.notes || null,
    })
    .select("id, proposal_number")
    .single();

  if (duplicateError) throw duplicateError;

  const serviceRows = (originalServices || []).map((service: any) => ({
    proposal_id: duplicate.id,
    service_code: service.service_code || null,
    category: service.category || "Other Services",
    service_name: service.service_name || "Service",
    description: service.description || null,
    fee_type: service.fee_type || "Monthly",
    amount: normaliseMoney(service.amount),
    included_in_package: service.included_in_package !== false,
    scope_quantity: service.scope_quantity,
    scope_unit: service.scope_unit || null,
    client_facing_note: service.client_facing_note || null,
    sort_order: service.sort_order ?? 0,
  }));

  if (serviceRows.length > 0) {
    const { error: copiedServicesError } = await supabase
      .from("proposal_services")
      .insert(serviceRows);

    if (copiedServicesError) {
      await supabase.from("proposals").delete().eq("id", duplicate.id);
      throw copiedServicesError;
    }
  }

  return {
    success: true,
    proposal_id: duplicate.id,
    proposal_number: duplicate.proposal_number,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("proposals")
      .select(`
        id,
        proposal_number,
        client_name,
        contact_name,
        proposal_date,
        valid_until,
        status,
        monthly_fee,
        annual_fee,
        once_off_fee,
        offer_annual_prepayment,
        annual_prepayment_months,
        normal_annual_fee,
        annual_prepayment_fee,
        annual_prepayment_saving,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      proposals: data || [],
    });
  } catch (error: any) {
    console.error("LOAD PROPOSALS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to load proposals.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const profile = await getCurrentProfile(req, supabase);

    if (!profile.organisation_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Your user profile is not linked to an organisation.",
        },
        { status: 400 }
      );
    }

    const body = await req.json();

    if (body?.action === "duplicate") {
      const proposalId = String(body?.proposalId || "").trim();

      if (!proposalId) {
        return NextResponse.json(
          {
            success: false,
            error: "Proposal ID is required.",
          },
          { status: 400 }
        );
      }

      const result = await duplicateProposal(
        proposalId,
        profile.organisation_id,
        supabase
      );

      return NextResponse.json(result);
    }

    const {
      clientId,
      clientName,
      registrationNumber,
      contactName,
      contactEmail,
      contactNumber,
      validDays,
      packageCode,
      packageName,
      packageDescription,
      packageMonthlyFee,
      offerAnnualPrepayment,
      annualPrepaymentMonths,
      services,
      introduction,
      notes,
    } = body;

    if (!clientName) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter the prospective client's name.",
        },
        { status: 400 }
      );
    }

    const selectedServices = Array.isArray(services)
      ? services.filter((service) => service?.selected !== false)
      : [];

    if (selectedServices.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Please select at least one service.",
        },
        { status: 400 }
      );
    }

    const monthlyPackageFee = normaliseMoney(packageMonthlyFee);

    if (monthlyPackageFee <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter the monthly package fee.",
        },
        { status: 400 }
      );
    }

    const annualPrepaymentEnabled = Boolean(offerAnnualPrepayment);
    const prepaymentMonths = Math.min(
      12,
      Math.max(1, normaliseInteger(annualPrepaymentMonths, 10))
    );

    const calculatedNormalAnnualFee = monthlyPackageFee * 12;
    const calculatedAnnualPrepaymentFee = monthlyPackageFee * prepaymentMonths;
    const calculatedAnnualPrepaymentSaving = Math.max(
      0,
      calculatedNormalAnnualFee - calculatedAnnualPrepaymentFee
    );

    const proposalDate = new Date();
    const validUntil = new Date(proposalDate);

    validUntil.setDate(
      validUntil.getDate() + Math.max(1, Number(validDays || 14))
    );

    const totals = selectedServices.reduce(
      (
        accumulator: {
          annual: number;
          onceOff: number;
        },
        service: any
      ) => {
        const amount = normaliseMoney(service.amount);

        if (service.feeType === "Annual" && !service.includedInPackage) {
          accumulator.annual += amount;
        }

        if (service.feeType === "Once-off" && !service.includedInPackage) {
          accumulator.onceOff += amount;
        }

        return accumulator;
      },
      {
        annual: 0,
        onceOff: 0,
      }
    );

    const proposalNumber = makeProposalNumber();

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .insert({
        proposal_number: proposalNumber,
        organisation_id: profile.organisation_id,
        client_id: clientId || null,
        client_name: clientName,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        prospect_company_name: clientName,
        prospect_registration_number:
          String(registrationNumber || "").trim() || null,
        prospect_contact_name: contactName || null,
        prospect_contact_email: contactEmail || null,
        prospect_contact_number: contactNumber || null,
        package_code: packageCode || "custom",
        package_name: packageName || "Custom Package",
        package_description: packageDescription || null,
        package_monthly_fee: monthlyPackageFee,
        fee_is_exclusive_vat: true,
        status: "Draft",
        proposal_date: proposalDate.toISOString().slice(0, 10),
        valid_until: validUntil.toISOString().slice(0, 10),
        monthly_fee: monthlyPackageFee,
        annual_fee: totals.annual,
        once_off_fee: totals.onceOff,
        offer_annual_prepayment: annualPrepaymentEnabled,
        annual_prepayment_months: annualPrepaymentEnabled
          ? prepaymentMonths
          : null,
        normal_annual_fee: annualPrepaymentEnabled
          ? calculatedNormalAnnualFee
          : null,
        annual_prepayment_fee: annualPrepaymentEnabled
          ? calculatedAnnualPrepaymentFee
          : null,
        annual_prepayment_saving: annualPrepaymentEnabled
          ? calculatedAnnualPrepaymentSaving
          : null,
        introduction: introduction || null,
        notes: notes || null,
      })
      .select("id, proposal_number")
      .single();

    if (proposalError) throw proposalError;

    const serviceRows = selectedServices.map((service: any, index: number) => ({
      proposal_id: proposal.id,
      service_code: service.id || null,
      category: service.category || "Other Services",
      service_name: service.name || "Service",
      description: service.description || null,
      fee_type: service.feeType || "Monthly",
      amount: service.includedInPackage
        ? 0
        : normaliseMoney(service.amount),
      included_in_package: service.includedInPackage !== false,
      scope_quantity:
        service.scopeQuantity === "" ||
        service.scopeQuantity === null ||
        service.scopeQuantity === undefined
          ? null
          : normaliseMoney(service.scopeQuantity),
      scope_unit: service.scopeUnit || null,
      client_facing_note: service.clientFacingNote || null,
      sort_order: index,
    }));

    const { error: serviceError } = await supabase
      .from("proposal_services")
      .insert(serviceRows);

    if (serviceError) {
      await supabase.from("proposals").delete().eq("id", proposal.id);
      throw serviceError;
    }

    return NextResponse.json({
      success: true,
      proposal_id: proposal.id,
      proposal_number: proposal.proposal_number,
    });
  } catch (error: any) {
    console.error("SAVE PROPOSAL ERROR:", error);

    const message = error?.message || "Unable to save proposal.";
    const status =
      message === "Not authenticated." ? 401 :
      message === "Could not load user profile." || message === "User access is blocked." ? 403 :
      500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
