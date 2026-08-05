import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;

type ServiceInput = {
  serviceName: string;
  selected: boolean;
  frequency: string;
  firstPeriodStart: string | null;
  firstPeriodEnd: string | null;
  settings?: JsonObject;
};

type ClientPayload = {
  clientName: string;
  clientType: string;
  internalCode?: string;
  status?: string;
  yearEnd?: string;
  tradingName?: string;
  registrationNumber?: string;
  registrationDate?: string;
  idPassportNumber?: string;
  dateOfBirth?: string;

  vatNumber?: string;
  payeNumber?: string;
  incomeTaxNumber?: string;
  uifNumber?: string;
  customsNumber?: string;
  sdlRegistered?: boolean;
  wccRefNr?: string;

  primaryContact?: string;
  email?: string;
  telephone?: string;
  cellphone?: string;
  contactPosition?: string;

  physicalAddressLine1?: string;
  physicalAddressLine2?: string;
  physicalSuburb?: string;
  physicalCity?: string;
  physicalProvince?: string;
  physicalPostalCode?: string;

  postalAddressLine1?: string;
  postalAddressLine2?: string;
  postalSuburb?: string;
  postalCity?: string;
  postalProvince?: string;
  postalPostalCode?: string;

  clientLeadUserId?: string;
  managerUserId?: string;
  partnerUserId?: string;

  services?: ServiceInput[];
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function getFriendlyDatabaseError(message: string) {
  if (message.includes("crm_clients_unique_client_name")) {
    return "Client name already exists.";
  }
  if (message.includes("crm_clients_unique_client_code")) {
    return "Internal code already exists.";
  }
  if (message.includes("crm_clients_unique_registration_number")) {
    return "Registration number already exists.";
  }
  if (message.includes("crm_clients_unique_id_passport_number")) {
    return "ID / passport number already exists.";
  }
  return message;
}

async function getAuthenticatedProfile(req: Request) {
  const supabase = getSupabaseAdmin();
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("You are not signed in.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Your login session is invalid or has expired.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(
      "id, user_id, organisation_id, access_enabled, can_access_crm, full_name, email"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.organisation_id) {
    throw new Error("Your user profile is not linked to an organisation.");
  }

  if (!profile.access_enabled || !profile.can_access_crm) {
    throw new Error("You do not have access to CRM.");
  }

  return { supabase, profile };
}

async function checkDuplicate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string,
  clientId: string | null,
  column: "client_name" | "client_code" | "registration_number" | "id_passport_number",
  value: string | null,
  label: string
) {
  if (!value) return;

  let query = supabase
    .from("crm_clients")
    .select("id, client_name")
    .eq("organisation_id", organisationId)
    .ilike(column, value)
    .limit(1);

  if (clientId) {
    query = query.neq("id", clientId);
  }

  const { data, error } = await query;

  if (error) throw error;

  if (data && data.length > 0) {
    throw new Error(`${label} already exists for ${data[0].client_name}.`);
  }
}

async function syncContact(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string,
  clientId: string,
  payload: ClientPayload
) {
  const contact = {
    organisation_id: organisationId,
    client_id: clientId,
    contact_name: cleanText(payload.primaryContact),
    contact_position: cleanText(payload.contactPosition),
    email: cleanText(payload.email),
    phone: cleanText(payload.telephone),
    mobile: cleanText(payload.cellphone),
    is_primary: true,
  };

  const hasContact = Boolean(
    contact.contact_name ||
      contact.contact_position ||
      contact.email ||
      contact.phone ||
      contact.mobile
  );

  const { data: existing, error: existingError } = await supabase
    .from("crm_client_contacts")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!hasContact) {
    if (existing?.id) {
      const { error } = await supabase
        .from("crm_client_contacts")
        .delete()
        .eq("id", existing.id)
        .eq("organisation_id", organisationId);

      if (error) throw error;
    }
    return;
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("crm_client_contacts")
      .update(contact)
      .eq("id", existing.id)
      .eq("organisation_id", organisationId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("crm_client_contacts").insert(contact);
  if (error) throw error;
}

async function syncAddress(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string,
  clientId: string,
  addressType: "Physical" | "Postal",
  values: {
    line1?: string;
    line2?: string;
    suburb?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  }
) {
  const address = {
    organisation_id: organisationId,
    client_id: clientId,
    address_type: addressType,
    line_1: cleanText(values.line1),
    line_2: cleanText(values.line2),
    city: cleanText(values.city || values.suburb),
    province: cleanText(values.province),
    postal_code: cleanText(values.postalCode),
    country: "South Africa",
  };

  const hasAddress = Boolean(
    address.line_1 ||
      address.line_2 ||
      address.city ||
      address.province ||
      address.postal_code
  );

  const { data: existing, error: existingError } = await supabase
    .from("crm_client_addresses")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .eq("address_type", addressType)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!hasAddress) {
    if (existing?.id) {
      const { error } = await supabase
        .from("crm_client_addresses")
        .delete()
        .eq("id", existing.id)
        .eq("organisation_id", organisationId);

      if (error) throw error;
    }
    return;
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("crm_client_addresses")
      .update(address)
      .eq("id", existing.id)
      .eq("organisation_id", organisationId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("crm_client_addresses").insert(address);
  if (error) throw error;
}

async function getServiceMap(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string
) {
  const { data, error } = await supabase
    .from("crm_services")
    .select("id, service_name, organisation_id")
    .eq("is_active", true)
    .or(`organisation_id.eq.${organisationId},organisation_id.is.null`);

  if (error) throw error;

  const map = new Map<string, string>();

  for (const service of data || []) {
    if (!map.has(service.service_name) || service.organisation_id === organisationId) {
      map.set(service.service_name, service.id);
    }
  }

  return map;
}

async function syncServices(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string,
  clientId: string,
  services: ServiceInput[]
) {
  const serviceMap = await getServiceMap(supabase, organisationId);

  const { data: existingRows, error: existingError } = await supabase
    .from("crm_client_services")
    .select("id, service_id")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId);

  if (existingError) throw existingError;

  const existingByServiceId = new Map(
    (existingRows || []).map((row) => [row.service_id, row])
  );

  for (const input of services) {
    const serviceId = serviceMap.get(input.serviceName);

    if (!serviceId) {
      throw new Error(
        `Service "${input.serviceName}" is missing from CRM service settings.`
      );
    }

    const existing = existingByServiceId.get(serviceId);
    const firstPeriodStart = cleanText(input.firstPeriodStart);
    const firstPeriodEnd = cleanText(input.firstPeriodEnd);

    const serviceSettings = {
      ...(input.settings || {}),
      frequency: input.frequency,
      first_period_start: firstPeriodStart,
      first_period_end: firstPeriodEnd,
    };

    const row = {
      organisation_id: organisationId,
      client_id: clientId,
      service_id: serviceId,
      frequency: cleanText(input.frequency),
      start_date: firstPeriodStart,
      end_date: null,
      is_active: input.selected,
      task_generation_enabled: input.selected,
      next_generation_date: firstPeriodStart,
      last_generated_until: null,
      service_settings: serviceSettings,
      notes: null,
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("crm_client_services")
        .update(row)
        .eq("id", existing.id)
        .eq("organisation_id", organisationId);

      if (error) throw error;
    } else if (input.selected) {
      const { error } = await supabase.from("crm_client_services").insert(row);
      if (error) throw error;
    }
  }
}

function buildClientRow(organisationId: string, payload: ClientPayload) {
  const isIndividual = payload.clientType === "Individual";

  return {
    organisation_id: organisationId,
    client_name: cleanText(payload.clientName) || "",
    entity_type: cleanText(payload.clientType),
    status: cleanText(payload.status) || "Active",
    year_end: cleanText(payload.yearEnd),
    client_code: cleanText(payload.internalCode),
    trading_name: cleanText(payload.tradingName),

    registration_number: isIndividual
      ? null
      : cleanText(payload.registrationNumber),
    registration_date: isIndividual
      ? null
      : cleanText(payload.registrationDate),
    id_passport_number: isIndividual
      ? cleanText(payload.idPassportNumber || payload.registrationNumber)
      : null,
    date_of_birth: isIndividual
      ? cleanText(payload.dateOfBirth || payload.registrationDate)
      : null,

    vat_number: cleanText(payload.vatNumber),
    paye_number: cleanText(payload.payeNumber),
    tax_number: cleanText(payload.incomeTaxNumber),
    uif_registration_number: cleanText(payload.uifNumber),
    customs_number: cleanText(payload.customsNumber),
    sdl_registered: Boolean(payload.sdlRegistered),
    wcc_reference_number: cleanText(payload.wccRefNr),

    client_lead_user_id: cleanText(payload.clientLeadUserId),
    manager_user_id: cleanText(payload.managerUserId),
    partner_user_id: cleanText(payload.partnerUserId),

    imported_source: "client_form",
  };
}

async function saveRelatedRecords(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string,
  clientId: string,
  payload: ClientPayload
) {
  await syncContact(supabase, organisationId, clientId, payload);

  await syncAddress(supabase, organisationId, clientId, "Physical", {
    line1: payload.physicalAddressLine1,
    line2: payload.physicalAddressLine2,
    suburb: payload.physicalSuburb,
    city: payload.physicalCity,
    province: payload.physicalProvince,
    postalCode: payload.physicalPostalCode,
  });

  await syncAddress(supabase, organisationId, clientId, "Postal", {
    line1: payload.postalAddressLine1,
    line2: payload.postalAddressLine2,
    suburb: payload.postalSuburb,
    city: payload.postalCity,
    province: payload.postalProvince,
    postalCode: payload.postalPostalCode,
  });

  await syncServices(
    supabase,
    organisationId,
    clientId,
    Array.isArray(payload.services) ? payload.services : []
  );
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await getAuthenticatedProfile(req);
    const organisationId = profile.organisation_id;
    const url = new URL(req.url);
    const clientId = cleanText(url.searchParams.get("id"));

    const [{ data: users, error: usersError }, { data: services, error: servicesError }] =
      await Promise.all([
        supabase
          .from("user_profiles")
          .select("id, full_name, email, role")
          .eq("organisation_id", organisationId)
          .eq("access_enabled", true)
          .order("full_name", { ascending: true }),
        supabase
          .from("crm_services")
          .select(
            "id, service_name, service_group, default_frequency, default_service_settings"
          )
          .eq("is_active", true)
          .or(`organisation_id.eq.${organisationId},organisation_id.is.null`)
          .order("service_group", { ascending: true })
          .order("service_name", { ascending: true }),
      ]);

    if (usersError) throw usersError;
    if (servicesError) throw servicesError;

    if (!clientId) {
      return NextResponse.json({
        success: true,
        users: users || [],
        services: services || [],
      });
    }

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .select(`
        *,
        crm_client_contacts (*),
        crm_client_addresses (*),
        crm_client_services (
          *,
          crm_services (
            id,
            service_name,
            service_group,
            default_frequency
          )
        )
      `)
      .eq("organisation_id", organisationId)
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Client not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      client,
      users: users || [],
      services: services || [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load client.";

    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("signed in") || message.includes("session") ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, profile } = await getAuthenticatedProfile(req);
    const organisationId = profile.organisation_id;
    const payload = (await req.json()) as ClientPayload;

    if (!cleanText(payload.clientName)) {
      return NextResponse.json(
        { success: false, error: "Client name is required." },
        { status: 400 }
      );
    }

    const isIndividual = payload.clientType === "Individual";

    await Promise.all([
      checkDuplicate(
        supabase,
        organisationId,
        null,
        "client_name",
        cleanText(payload.clientName),
        "Client name"
      ),
      checkDuplicate(
        supabase,
        organisationId,
        null,
        "client_code",
        cleanText(payload.internalCode),
        "Internal code"
      ),
      checkDuplicate(
        supabase,
        organisationId,
        null,
        isIndividual ? "id_passport_number" : "registration_number",
        isIndividual
          ? cleanText(payload.idPassportNumber || payload.registrationNumber)
          : cleanText(payload.registrationNumber),
        isIndividual ? "ID / passport number" : "Registration number"
      ),
    ]);

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .insert(buildClientRow(organisationId, payload))
      .select("id")
      .single();

    if (clientError || !client) {
      throw clientError || new Error("Client could not be created.");
    }

    try {
      await saveRelatedRecords(
        supabase,
        organisationId,
        client.id,
        payload
      );
    } catch (relatedError) {
      await supabase
        .from("crm_clients")
        .delete()
        .eq("organisation_id", organisationId)
        .eq("id", client.id);

      throw relatedError;
    }

    return NextResponse.json({
      success: true,
      clientId: client.id,
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Could not create client.";

    const message = getFriendlyDatabaseError(rawMessage);
    const status = message.includes("already exists")
      ? 409
      : message.includes("signed in") || message.includes("session")
        ? 401
        : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, profile } = await getAuthenticatedProfile(req);
    const organisationId = profile.organisation_id;
    const payload = (await req.json()) as ClientPayload & { clientId?: string };
    const clientId = cleanText(payload.clientId);

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client ID is required." },
        { status: 400 }
      );
    }

    if (!cleanText(payload.clientName)) {
      return NextResponse.json(
        { success: false, error: "Client name is required." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("crm_clients")
      .select("id")
      .eq("organisation_id", organisationId)
      .eq("id", clientId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Client not found." },
        { status: 404 }
      );
    }

    const isIndividual = payload.clientType === "Individual";

    await Promise.all([
      checkDuplicate(
        supabase,
        organisationId,
        clientId,
        "client_name",
        cleanText(payload.clientName),
        "Client name"
      ),
      checkDuplicate(
        supabase,
        organisationId,
        clientId,
        "client_code",
        cleanText(payload.internalCode),
        "Internal code"
      ),
      checkDuplicate(
        supabase,
        organisationId,
        clientId,
        isIndividual ? "id_passport_number" : "registration_number",
        isIndividual
          ? cleanText(payload.idPassportNumber || payload.registrationNumber)
          : cleanText(payload.registrationNumber),
        isIndividual ? "ID / passport number" : "Registration number"
      ),
    ]);

    const { error: updateError } = await supabase
      .from("crm_clients")
      .update(buildClientRow(organisationId, payload))
      .eq("organisation_id", organisationId)
      .eq("id", clientId);

    if (updateError) throw updateError;

    await saveRelatedRecords(
      supabase,
      organisationId,
      clientId,
      payload
    );

    return NextResponse.json({
      success: true,
      clientId,
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Could not update client.";

    const message = getFriendlyDatabaseError(rawMessage);
    const status = message.includes("already exists")
      ? 409
      : message.includes("signed in") || message.includes("session")
        ? 401
        : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
