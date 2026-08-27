import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
  can_access_secretarial: boolean;
};

type CurrentProfileResult =
  | { profile: UserProfile; response: null }
  | { profile: null; response: NextResponse };

type AllocationInput = {
  shareholderId?: string;
  numberOfShares?: string | number;
  certificateNumber?: string;
};

type SaveIssueBody = {
  clientId?: string;
  shareClassId?: string;
  issueDate?: string;
  placeOfIssue?: string;
  considerationPerShare?: string | number;
  amountPaidPerShare?: string | number;
  fullyPaid?: boolean;
  transferRestriction?: string;
  signatoryOneName?: string;
  signatoryOneCapacity?: string;
  signatoryTwoName?: string;
  signatoryTwoCapacity?: string;
  allocations?: AllocationInput[];

  // Backwards-compatible single-certificate fields
  shareholderId?: string;
  certificateNumber?: string;
  shareClass?: string;
  seriesDesignation?: string;
  numberOfShares?: string | number;
  totalConsideration?: string | number;
  amountPaid?: string | number;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) {
    throw new Error(
      "Missing server Supabase key. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and Vercel."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getBearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function optionalNumber(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getCurrentProfile(
  request: Request,
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<CurrentProfileResult> {
  const token = getBearerToken(request);

  if (!token) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(
      "id, user_id, role, organisation_id, access_enabled, can_access_secretarial"
    )
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Could not load your user profile." },
        { status: 403 }
      ),
    };
  }

  const currentProfile = profile as UserProfile;

  if (!currentProfile.access_enabled) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Your PracticePilot access is disabled." },
        { status: 403 }
      ),
    };
  }

  if (
    !isGlobalAdmin(currentProfile.role) &&
    !currentProfile.can_access_secretarial
  ) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "You do not have access to Secretarial." },
        { status: 403 }
      ),
    };
  }

  return { profile: currentProfile, response: null };
}

async function resolveShareClass(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string,
  clientId: string,
  body: SaveIssueBody
) {
  const requestedId = cleanText(body.shareClassId);

  if (requestedId) {
    const { data, error } = await supabase
      .from("secretarial_share_classes")
      .select("id, class_name, series_designation, authorised_shares, issued_shares")
      .eq("id", requestedId)
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      throw new Error("The selected share class could not be found.");
    }

    return data;
  }

  // Legacy single-certificate support
  const className = cleanText(body.shareClass);
  const seriesDesignation = cleanText(body.seriesDesignation);

  if (!className) throw new Error("Select a share class.");

  let query = supabase
    .from("secretarial_share_classes")
    .select("id, class_name, series_designation, authorised_shares, issued_shares")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .eq("class_name", className)
    .eq("is_active", true);

  query = seriesDesignation
    ? query.eq("series_designation", seriesDesignation)
    : query.is("series_designation", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from("secretarial_share_classes")
    .insert({
      organisation_id: organisationId,
      client_id: clientId,
      class_name: className,
      series_designation: seriesDesignation || null,
      par_value_type: className.toLowerCase().includes("no-par")
        ? "no_par_value"
        : "par_value",
      authorised_shares: 0,
      issued_shares: 0,
    })
    .select("id, class_name, series_designation, authorised_shares, issued_shares")
    .single();

  if (createError || !created) {
    throw createError || new Error("Could not create the share class.");
  }

  return created;
}


export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseAdmin();

  try {
    const authResult = await getCurrentProfile(request, supabase);

    if (authResult.response) {
      return authResult.response;
    }

    const profile = authResult.profile;

    if (!profile) {
      return NextResponse.json(
        { error: "Could not determine the current user." },
        { status: 403 }
      );
    }

    let clientsQuery = supabase
      .from("crm_clients")
      .select(
        "id, client_name, registration_number, id_passport_number, entity_type, status, organisation_id"
      )
      .order("client_name", { ascending: true });

    if (!isGlobalAdmin(profile.role)) {
      if (!profile.organisation_id) {
        return NextResponse.json(
          { error: "Your user is not linked to a practice." },
          { status: 400 }
        );
      }

      clientsQuery = clientsQuery.eq(
        "organisation_id",
        profile.organisation_id
      );
    }

    const { data: clients, error: clientsError } = await clientsQuery;

    if (clientsError) throw clientsError;

    const visibleClients = (clients || []).filter((client: any) =>
      String(client.client_name || "").trim()
    );

    const clientIds = visibleClients.map((client: any) => String(client.id));

    if (!clientIds.length) {
      return NextResponse.json({
        success: true,
        clients: [],
        matters: [],
        certificates: [],
        shareholders: [],
      });
    }

    const [mattersResult, certificatesResult, shareholdersResult] =
      await Promise.all([
        supabase
          .from("secretarial_share_matters")
          .select("client_id, matter_status")
          .in("client_id", clientIds)
          .neq("matter_status", "cancelled"),

        supabase
          .from("secretarial_share_certificates")
          .select("client_id, certificate_status")
          .in("client_id", clientIds),

        supabase
          .from("secretarial_shareholders")
          .select("client_id, is_active")
          .in("client_id", clientIds),
      ]);

    if (mattersResult.error) throw mattersResult.error;
    if (certificatesResult.error) throw certificatesResult.error;
    if (shareholdersResult.error) throw shareholdersResult.error;

    return NextResponse.json({
      success: true,
      clients: visibleClients.map(
        ({ organisation_id, ...client }: any) => client
      ),
      matters: mattersResult.data || [],
      certificates: certificatesResult.data || [],
      shareholders: (shareholdersResult.data || []).filter(
        (row: any) => row.is_active !== false
      ),
    });
  } catch (error: any) {
    console.error("SECRETARIAL SUMMARY GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Could not load the Secretarial client summary.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseAdmin();

  try {
    const authResult = await getCurrentProfile(request, supabase);

    if (authResult.response) {
      return authResult.response;
    }

    const profile = authResult.profile;

    const body = (await request.json()) as SaveIssueBody;
    const clientId = cleanText(body.clientId);

    if (!clientId) {
      return NextResponse.json(
        { error: "Open the Secretarial client before creating a share issue." },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .select("id, client_name, organisation_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client || !client.organisation_id) {
      return NextResponse.json(
        { error: "The selected CRM client could not be found." },
        { status: 404 }
      );
    }

    if (
      !isGlobalAdmin(profile.role) &&
      profile.organisation_id !== client.organisation_id
    ) {
      return NextResponse.json(
        { error: "You cannot create a matter for another organisation." },
        { status: 403 }
      );
    }

    const organisationId = client.organisation_id;
    const shareClass = await resolveShareClass(
      supabase,
      organisationId,
      clientId,
      body
    );

    const rawAllocations =
      Array.isArray(body.allocations) && body.allocations.length
        ? body.allocations
        : [
            {
              shareholderId: body.shareholderId,
              numberOfShares: body.numberOfShares,
              certificateNumber: body.certificateNumber,
            },
          ];

    const allocations = rawAllocations.map((allocation) => ({
      shareholderId: cleanText(allocation.shareholderId),
      numberOfShares: optionalNumber(allocation.numberOfShares),
      certificateNumber: cleanText(allocation.certificateNumber),
    }));

    if (
      allocations.some(
        (allocation) =>
          !allocation.shareholderId ||
          !allocation.certificateNumber ||
          !allocation.numberOfShares ||
          allocation.numberOfShares <= 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Every allocation needs an existing shareholder, certificate number and positive share quantity.",
        },
        { status: 400 }
      );
    }

    const certificateNumbers = allocations.map(
      (allocation) => allocation.certificateNumber
    );
    if (new Set(certificateNumbers).size !== certificateNumbers.length) {
      return NextResponse.json(
        { error: "Certificate numbers in this issue must be unique." },
        { status: 400 }
      );
    }

    const shareholderIds = allocations.map(
      (allocation) => allocation.shareholderId
    );

    const { data: shareholderRows, error: shareholderError } = await supabase
      .from("secretarial_shareholders")
      .select("id, full_legal_name, id_registration_number")
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .in("id", shareholderIds);

    if (shareholderError) throw shareholderError;

    if ((shareholderRows || []).length !== new Set(shareholderIds).size) {
      return NextResponse.json(
        {
          error:
            "One or more selected shareholders are not active shareholders of this client.",
        },
        { status: 400 }
      );
    }

    const shareholderById = new Map(
      (shareholderRows || []).map((row: any) => [row.id, row])
    );

    const totalNewShares = allocations.reduce(
      (sum, allocation) => sum + (allocation.numberOfShares || 0),
      0
    );

    const authorisedShares = Number(shareClass.authorised_shares || 0);
    const issuedShares = Number(shareClass.issued_shares || 0);

    if (
      authorisedShares > 0 &&
      issuedShares + totalNewShares > authorisedShares
    ) {
      return NextResponse.json(
        {
          error:
            "This share issue would exceed the authorised shares for the selected class.",
        },
        { status: 400 }
      );
    }

    const { data: existingCertificates, error: duplicateError } = await supabase
      .from("secretarial_share_matters")
      .select("certificate_number")
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .in("certificate_number", certificateNumbers);

    if (duplicateError) throw duplicateError;

    if ((existingCertificates || []).length) {
      return NextResponse.json(
        {
          error: `Certificate number ${
            existingCertificates?.[0]?.certificate_number || ""
          } already exists for this client.`,
        },
        { status: 409 }
      );
    }

    const issueBatchId = randomUUID();
    const considerationPerShare = optionalNumber(body.considerationPerShare);
    const amountPaidPerShare = optionalNumber(body.amountPaidPerShare);

    const matterRows = allocations.map((allocation) => {
      const quantity = allocation.numberOfShares || 0;
      const totalConsideration =
        considerationPerShare == null
          ? null
          : quantity * considerationPerShare;
      const totalAmountPaid =
        amountPaidPerShare == null ? null : quantity * amountPaidPerShare;

      return {
        organisation_id: organisationId,
        client_id: clientId,
        matter_status: "draft",
        current_step: 1,
        issue_batch_id: issueBatchId,
        certificate_number: allocation.certificateNumber,
        shareholder_id: allocation.shareholderId,
        share_class_id: shareClass.id,
        number_of_shares: quantity,
        issue_date: cleanText(body.issueDate) || null,
        place_of_issue: cleanText(body.placeOfIssue) || null,
        transfer_restriction:
          cleanText(body.transferRestriction) ||
          "The transfer of these shares is subject to the restrictions contained in the company's Memorandum of Incorporation.",
        fully_paid: body.fullyPaid !== false,
        consideration_per_share: considerationPerShare,
        total_consideration: totalConsideration,
        amount_paid: totalAmountPaid,
        signatory_one_name: cleanText(body.signatoryOneName) || null,
        signatory_one_capacity: cleanText(body.signatoryOneCapacity) || null,
        signatory_two_name: cleanText(body.signatoryTwoName) || null,
        signatory_two_capacity: cleanText(body.signatoryTwoCapacity) || null,
        created_by_user_id: profile.id,
        updated_by_user_id: profile.id,
      };
    });

    const { data: matters, error: insertError } = await supabase
      .from("secretarial_share_matters")
      .insert(matterRows)
      .select(
        "id, certificate_number, shareholder_id, current_step, matter_status"
      );

    if (insertError || !matters) {
      if (insertError?.code === "23505") {
        return NextResponse.json(
          { error: "One of the certificate numbers already exists." },
          { status: 409 }
        );
      }
      throw insertError || new Error("Could not create the share issue.");
    }

    return NextResponse.json(
      {
        message: "Share issue created.",
        issueBatchId,
        matters: matters.map((matter: any) => ({
          id: matter.id,
          certificateNumber: matter.certificate_number,
          shareholderName:
            shareholderById.get(matter.shareholder_id)?.full_legal_name ||
            "Shareholder",
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create share issue failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the share issue.",
      },
      { status: 500 }
    );
  }
}
