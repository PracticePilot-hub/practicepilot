// Path: app/api/engagements/from-proposal/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing server Supabase service role key.");
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

  const userProfile = profile as UserProfile;

  if (!userProfile.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { success: false, error: "User access is blocked." },
        { status: 403 }
      ),
    };
  }

  return {
    profile: userProfile,
    response: null as NextResponse | null,
  };
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

function nextMonthStart() {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  return {
    year: next.getUTCFullYear(),
    monthIndex: next.getUTCMonth(),
    date: isoDate(next.getUTCFullYear(), next.getUTCMonth(), 1),
  };
}

function money(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function engagementNumberFromProposal(proposalNumber: string) {
  const cleaned = String(proposalNumber || "")
    .replace(/^PP-/i, "")
    .replace(/[^A-Za-z0-9-]/g, "");

  return `ENG-${cleaned || Date.now()}`;
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  try {
    const { profile, response } = await getCurrentProfile(request, supabase);

    if (response || !profile) {
      return response;
    }

    const body = await request.json();
    const proposalId = String(body?.proposalId || "").trim();

    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: "Proposal id is required." },
        { status: 400 }
      );
    }

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select(
        `
          id,
          proposal_number,
          organisation_id,
          client_id,
          client_name,
          contact_name,
          contact_email,
          prospect_company_name,
          prospect_contact_name,
          prospect_contact_email,
          prospect_contact_number,
          status,
          proposal_date,
          valid_until,
          monthly_fee,
          annual_fee,
          once_off_fee,
          package_code,
          package_name,
          package_description,
          package_monthly_fee,
          fee_is_exclusive_vat,
          introduction,
          notes
        `
      )
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json(
        { success: false, error: "Proposal not found." },
        { status: 404 }
      );
    }

    if (proposal.status !== "Accepted") {
      return NextResponse.json(
        {
          success: false,
          error: "Only an accepted proposal can generate an engagement.",
        },
        { status: 400 }
      );
    }

    const { data: existingEngagement } = await supabase
      .from("engagements")
      .select("id, engagement_number")
      .eq("proposal_id", proposalId)
      .maybeSingle();

    if (existingEngagement) {
      return NextResponse.json({
        success: true,
        engagement_id: existingEngagement.id,
        engagement_number: existingEngagement.engagement_number,
        existing: true,
      });
    }

    let organisationId = proposal.organisation_id as string | null;
    let clientRegistrationNumber: string | null = null;
    let clientRecord: any = null;

    if (proposal.client_id) {
      const { data: client, error: clientError } = await supabase
        .from("crm_clients")
        .select(
          `
            id,
            organisation_id,
            client_name,
            registration_number,
            primary_contact,
            email,
            cellphone,
            telephone
          `
        )
        .eq("id", proposal.client_id)
        .maybeSingle();

      if (clientError) {
        throw clientError;
      }

      clientRecord = client || null;
      clientRegistrationNumber = client?.registration_number || null;

      if (!organisationId && client?.organisation_id) {
        organisationId = client.organisation_id;
      }
    }

    if (!organisationId && !isGlobalAdmin(profile.role)) {
      organisationId = profile.organisation_id;
    }

    if (!organisationId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PracticePilot could not determine which organisation owns this proposal.",
        },
        { status: 400 }
      );
    }

    if (
      !isGlobalAdmin(profile.role) &&
      profile.organisation_id !== organisationId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have access to this proposal.",
        },
        { status: 403 }
      );
    }

    if (!proposal.organisation_id) {
      const { error: proposalOrganisationError } = await supabase
        .from("proposals")
        .update({ organisation_id: organisationId })
        .eq("id", proposal.id);

      if (proposalOrganisationError) {
        throw proposalOrganisationError;
      }
    }

    const { data: services, error: servicesError } = await supabase
      .from("proposal_services")
      .select(
        `
          id,
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
        `
      )
      .eq("proposal_id", proposal.id)
      .order("sort_order", { ascending: true });

    if (servicesError) {
      throw servicesError;
    }

    const contractStart = nextMonthStart();
    const contractEndParts = addMonths(
      contractStart.year,
      contractStart.monthIndex,
      11
    );
    const contractEndDate = isoDate(
      contractEndParts.year,
      contractEndParts.monthIndex,
      daysInMonth(contractEndParts.year, contractEndParts.monthIndex)
    );

    const quotedMonthlyFee =
      money(proposal.package_monthly_fee) > 0
        ? money(proposal.package_monthly_fee)
        : money(proposal.monthly_fee);

    const feeExclusiveVat = proposal.fee_is_exclusive_vat !== false;
    const vatRate = 0.15;

    const clientName =
      proposal.prospect_company_name ||
      proposal.client_name ||
      clientRecord?.client_name ||
      "Client";

    const contactName =
      proposal.prospect_contact_name ||
      proposal.contact_name ||
      clientRecord?.primary_contact ||
      null;

    const contactEmail =
      proposal.prospect_contact_email ||
      proposal.contact_email ||
      clientRecord?.email ||
      null;

    const contactNumber =
      proposal.prospect_contact_number ||
      clientRecord?.cellphone ||
      clientRecord?.telephone ||
      null;

    const engagementNumber = engagementNumberFromProposal(
      proposal.proposal_number
    );

    const proposalSnapshot = {
      ...proposal,
      services: services || [],
    };

    const clientSnapshot = clientRecord || {
      client_name: clientName,
      registration_number: clientRegistrationNumber,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_number: contactNumber,
    };

    const { data: engagement, error: engagementError } = await supabase
      .from("engagements")
      .insert({
        engagement_number: engagementNumber,
        organisation_id: organisationId,
        client_id: proposal.client_id || null,
        proposal_id: proposal.id,

        client_name: clientName,
        client_registration_number: clientRegistrationNumber,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_number: contactNumber,

        status: "Draft",
        contract_start_date: contractStart.date,
        contract_end_date: contractEndDate,
        contract_months: 12,

        billing_day: 25,
        payment_due_day: 1,
        billing_in_advance: true,

        monthly_fee: quotedMonthlyFee,
        fee_is_exclusive_vat: feeExclusiveVat,
        vat_rate: vatRate,

        renewal_method: "New contract required",
        auto_renew: false,

        legal_template_version: "1.0",
        proposal_snapshot: proposalSnapshot,
        client_snapshot: clientSnapshot,

        created_by: profile.id,
      })
      .select("id, engagement_number")
      .single();

    if (engagementError || !engagement) {
      throw engagementError || new Error("Could not create engagement.");
    }

    try {
      const serviceRows = (services || []).map((service: any) => ({
        engagement_id: engagement.id,
        organisation_id: organisationId,
        source_proposal_service_id: service.id,
        service_code: service.service_code || null,
        category: service.category || "Other Services",
        service_name: service.service_name || "Service",
        description: service.description || null,
        fee_type: service.fee_type || null,
        amount: money(service.amount),
        scope_quantity: service.scope_quantity ?? null,
        scope_unit: service.scope_unit || null,
        client_facing_note: service.client_facing_note || null,
        sort_order: Number(service.sort_order || 0),
      }));

      if (serviceRows.length > 0) {
        const { error: serviceInsertError } = await supabase
          .from("engagement_services")
          .insert(serviceRows);

        if (serviceInsertError) {
          throw serviceInsertError;
        }
      }

      const billingRows = Array.from({ length: 12 }, (_, index) => {
        const serviceMonth = addMonths(
          contractStart.year,
          contractStart.monthIndex,
          index
        );

        const previousMonth = addMonths(
          serviceMonth.year,
          serviceMonth.monthIndex,
          -1
        );

        const servicePeriodStart = isoDate(
          serviceMonth.year,
          serviceMonth.monthIndex,
          1
        );

        const servicePeriodEnd = isoDate(
          serviceMonth.year,
          serviceMonth.monthIndex,
          daysInMonth(serviceMonth.year, serviceMonth.monthIndex)
        );

        const invoiceDate = isoDate(
          previousMonth.year,
          previousMonth.monthIndex,
          25
        );

        const paymentDueDate = isoDate(
          serviceMonth.year,
          serviceMonth.monthIndex,
          1
        );

        const amountExVat = feeExclusiveVat
          ? quotedMonthlyFee
          : quotedMonthlyFee / (1 + vatRate);

        const vatAmount = amountExVat * vatRate;
        const amountIncVat = amountExVat + vatAmount;

        return {
          engagement_id: engagement.id,
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

      const { error: billingError } = await supabase
        .from("engagement_billing_schedule")
        .insert(billingRows);

      if (billingError) {
        throw billingError;
      }

      const { error: eventError } = await supabase
        .from("engagement_events")
        .insert({
          engagement_id: engagement.id,
          organisation_id: organisationId,
          event_type: "Engagement Created",
          to_status: "Draft",
          event_description: `Engagement generated from accepted proposal ${proposal.proposal_number}.`,
          event_payload: {
            proposal_id: proposal.id,
            proposal_number: proposal.proposal_number,
          },
          performed_by: profile.id,
          performed_by_name: profile.email,
          performed_by_email: profile.email,
        });

      if (eventError) {
        throw eventError;
      }
    } catch (childError) {
      await supabase.from("engagements").delete().eq("id", engagement.id);
      throw childError;
    }

    return NextResponse.json({
      success: true,
      engagement_id: engagement.id,
      engagement_number: engagement.engagement_number,
      existing: false,
    });
  } catch (error: any) {
    console.error("CREATE ENGAGEMENT FROM PROPOSAL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to create engagement.",
      },
      { status: 500 }
    );
  }
}
