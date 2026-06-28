import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

async function getIdFromContext(context: any) {
  const params = await context?.params;
  const id = params?.id;

  if (!id || typeof id !== "string") {
    throw new Error("Missing AFS engagement id.");
  }

  return id;
}

export async function GET(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const supabase = getSupabaseServer();

    const { data: setup, error: setupError } = await supabase
      .from("afs_client_setup")
      .select("*")
      .eq("engagement_id", engagementId)
      .maybeSingle();

    if (setupError) throw setupError;

    const { data: people, error: peopleError } = await supabase
      .from("afs_client_people")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: true });

    if (peopleError) throw peopleError;

    const { data: engagement, error: engagementError } = await supabase
      .from("afs_engagements")
      .select("*")
      .eq("id", engagementId)
      .single();

    if (engagementError) throw engagementError;

    const enrichedSetup = setup
      ? enrichClientSetup(setup, engagement)
      : null;

    return NextResponse.json({
      setup: enrichedSetup,
      clientSetup: enrichedSetup,
      people: people || [],
      clientPeople: people || [],
      client_people: people || [],
      directors: people || [],
      members: people || [],
      trustees: people || [],
      engagement,
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load client setup." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const setupData = {
      engagement_id: engagementId,

      registered_name: clean(body.registered_name),
      registration_number: clean(body.registration_number),
      entity_type: clean(body.entity_type),
      country: clean(body.country) || "South Africa",
      currency: clean(body.currency) || "Rand",
      currency_symbol: clean(body.currency_symbol) || "R",
      legal_framework:
        clean(body.legal_framework) || "Companies Act of South Africa",
      nature_of_business: clean(body.nature_of_business),
      trading_name: clean(body.trading_name),

      basis_of_preparation: clean(body.basis_of_preparation) || "IFRS for SMEs",
      type_of_engagement: clean(body.type_of_engagement) || "Compilation",
      report_required:
        clean(body.report_required) || "Practitioner compilation report",
      industry: clean(body.industry),
      group_description: clean(body.group_description),
      parent_entity: clean(body.parent_entity),

      income_tax_number: clean(body.income_tax_number),
      vat_number: clean(body.vat_number),
      paye_number: clean(body.paye_number),
      sdl_number: clean(body.sdl_number),
      uif_number: clean(body.uif_number),
      tax_loss_current_year: moneyOrNull(body.tax_loss_current_year),
      tax_loss_prior_year: moneyOrNull(body.tax_loss_prior_year),
      tax_rate_current_year: numberOrDefault(body.tax_rate_current_year, 27),
      tax_rate_prior_year: numberOrDefault(body.tax_rate_prior_year, 27),

      registered_office_line_1: clean(body.registered_office_line_1),
      registered_office_line_2: clean(body.registered_office_line_2),
      registered_office_city: clean(body.registered_office_city),
      registered_office_province: clean(body.registered_office_province),
      registered_office_postal_code: clean(body.registered_office_postal_code),

      physical_address_line_1: clean(body.physical_address_line_1),
      physical_address_line_2: clean(body.physical_address_line_2),
      physical_address_city: clean(body.physical_address_city),
      physical_address_province: clean(body.physical_address_province),
      physical_address_postal_code: clean(body.physical_address_postal_code),

      postal_address_line_1: clean(body.postal_address_line_1),
      postal_address_line_2: clean(body.postal_address_line_2),
      postal_address_city: clean(body.postal_address_city),
      postal_address_province: clean(body.postal_address_province),
      postal_address_postal_code: clean(body.postal_address_postal_code),

      banker_name: clean(body.banker_name),
      account_holder: clean(body.account_holder),
      account_type: clean(body.account_type),

      public_officer_name: clean(body.public_officer_name),
      public_officer_email: clean(body.public_officer_email),
      public_officer_cell: clean(body.public_officer_cell),
      public_officer_income_tax_number: clean(
        body.public_officer_income_tax_number
      ),
      public_officer_id_number: clean(body.public_officer_id_number),

      secretary_name: clean(body.secretary_name),
      secretary_address: clean(body.secretary_address),

      number_of_directors: integerOrDefault(body.number_of_directors, 0),
      date_of_incorporation: dateOrNull(body.date_of_incorporation),
      date_business_commenced: dateOrNull(body.date_business_commenced),
      signature_date: dateOrNull(body.signature_date),
      afs_approval_date: dateOrNull(body.afs_approval_date),
      publish_date: dateOrNull(body.publish_date),

      practitioner_name: clean(body.practitioner_name),
      practitioner_designation: clean(body.practitioner_designation),
      practice_name: clean(body.practice_name),
      member_firm: clean(body.member_firm),
      place_of_signature: clean(body.place_of_signature),

      authorised_ordinary_shares: clean(body.authorised_ordinary_shares),
      authorised_ordinary_share_par_value: clean(
        body.authorised_ordinary_share_par_value
      ),
      issued_ordinary_shares: clean(body.issued_ordinary_shares),
      issued_ordinary_share_par_value: clean(
        body.issued_ordinary_share_par_value
      ),
      share_capital_note: clean(body.share_capital_note),
      shareholder_note: clean(body.shareholder_note),

      current_period_heading: clean(body.current_period_heading),
      prior_period_heading: clean(body.prior_period_heading),

      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("afs_client_setup")
      .upsert(setupData, { onConflict: "engagement_id" })
      .select("*")
      .single();

    if (error) throw error;

    const registeredName = clean(body.registered_name);
    const updatedEntityType = clean(body.entity_type);
    const updatedYearEnd = dateOrNull(body.financial_year_end);
    const updatedPreparedBy = clean(body.practitioner_name);

    const engagementUpdate: Record<string, any> = {};

    if (registeredName) engagementUpdate.client_name = registeredName;
    if (updatedEntityType) engagementUpdate.entity_type = updatedEntityType;
    if (updatedYearEnd) engagementUpdate.financial_year_end = updatedYearEnd;
    if (updatedPreparedBy) engagementUpdate.prepared_by = updatedPreparedBy;

    let updatedEngagement = null;

    if (Object.keys(engagementUpdate).length > 0) {
      const { data: engagementData, error: engagementError } = await supabase
        .from("afs_engagements")
        .update(engagementUpdate)
        .eq("id", engagementId)
        .select("*")
        .single();

      if (engagementError) throw engagementError;

      updatedEngagement = engagementData;
    }

    const enrichedSetup = enrichClientSetup(data, updatedEngagement);

    return NextResponse.json({
      setup: enrichedSetup,
      clientSetup: enrichedSetup,
      engagement: updatedEngagement,
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to save client setup." },
      { status: 500 }
    );
  }
}

function enrichClientSetup(setup: Record<string, any>, engagement: any) {
  const registeredOffice = joinAddress([
    setup.registered_office_line_1,
    setup.registered_office_line_2,
    setup.registered_office_city,
    setup.registered_office_province,
    setup.registered_office_postal_code,
  ]);

  const physicalAddress = joinAddress([
    setup.physical_address_line_1,
    setup.physical_address_line_2,
    setup.physical_address_city,
    setup.physical_address_province,
    setup.physical_address_postal_code,
  ]);

  const postalAddress = joinAddress([
    setup.postal_address_line_1,
    setup.postal_address_line_2,
    setup.postal_address_city,
    setup.postal_address_province,
    setup.postal_address_postal_code,
  ]);

  const bankerParts = [
    setup.banker_name,
    setup.account_holder ? `Account holder: ${setup.account_holder}` : null,
    setup.account_type ? `Account type: ${setup.account_type}` : null,
  ].filter(Boolean);

  const bankers = bankerParts.length ? bankerParts.join("\n") : null;

  const approvalDate =
    setup.afs_approval_date || setup.signature_date || setup.publish_date || null;

  const compilationReportDate =
    setup.publish_date || setup.signature_date || setup.afs_approval_date || null;

  const practitionerFirm = setup.practice_name || setup.member_firm || null;

  const basisOfPreparation = setup.basis_of_preparation || null;
  const typeOfEngagement = setup.type_of_engagement || null;

  return {
    ...setup,

    financial_year_end:
      engagement?.financial_year_end || setup.financial_year_end || null,

    client_name: setup.registered_name || engagement?.client_name || null,
    company_name: setup.registered_name || engagement?.client_name || null,
    entity_name: setup.registered_name || engagement?.client_name || null,

    country_of_incorporation: setup.country || null,
    country_of_incorporation_and_domicile: setup.country || null,
    domicile: setup.country || null,

    financial_reporting_framework: basisOfPreparation,
    reporting_framework: basisOfPreparation,
    accounting_framework: basisOfPreparation,
    framework: basisOfPreparation,
    basis: basisOfPreparation,

    level_of_assurance: typeOfEngagement,
    engagement_type: typeOfEngagement,

    income_tax_reference_number: setup.income_tax_number || null,
    tax_reference_number: setup.income_tax_number || null,
    income_tax_number: setup.income_tax_number || null,
    tax_number: setup.income_tax_number || null,

    practitioner_firm_name: practitionerFirm,
    firm_name: practitionerFirm,
    accounting_firm: practitionerFirm,
    compiler_firm: practitionerFirm,
    preparer_firm: practitionerFirm,

    compiler_name: setup.practitioner_name || null,
    prepared_by: setup.practitioner_name || null,
    accountant_name: setup.practitioner_name || null,

    compiler_designation: setup.practitioner_designation || null,
    professional_designation: setup.practitioner_designation || null,
    designation: setup.practitioner_designation || null,

    registered_office: registeredOffice,
    registered_address: registeredOffice,
    registered_office_address: registeredOffice,
    registeredAddress: registeredOffice,
    registeredOffice: registeredOffice,
    registeredOfficeAddress: registeredOffice,

    business_address: physicalAddress,
    physical_address: physicalAddress,
    trading_address: physicalAddress,
    businessAddress: physicalAddress,
    physicalAddress: physicalAddress,
    tradingAddress: physicalAddress,

    postal_address: postalAddress,
    mailing_address: postalAddress,
    postalAddress,
    mailingAddress: postalAddress,

    bankers,
    banker: setup.banker_name || null,
    bank_name: setup.banker_name || null,
    bankName: setup.banker_name || null,

    approval_date: approvalDate,
    directors_approval_date: approvalDate,
    signed_date: setup.signature_date || null,
    sign_off_date: approvalDate,

    compilation_report_date: compilationReportDate,
    compiler_report_date: compilationReportDate,
    report_date: compilationReportDate,

    contact_person: setup.public_officer_name || null,
    primary_contact: setup.public_officer_name || null,
    contactPerson: setup.public_officer_name || null,
    primaryContact: setup.public_officer_name || null,

    email: setup.public_officer_email || null,
    email_address: setup.public_officer_email || null,
    contact_email: setup.public_officer_email || null,
    emailAddress: setup.public_officer_email || null,

    telephone: setup.public_officer_cell || null,
    phone: setup.public_officer_cell || null,
    contact_number: setup.public_officer_cell || null,
    telephone_number: setup.public_officer_cell || null,
    contactNumber: setup.public_officer_cell || null,
  };
}

function joinAddress(parts: any[]) {
  const cleaned = parts
    .map((part) => clean(part))
    .filter((part): part is string => Boolean(part));

  return cleaned.length ? cleaned.join("\n") : null;
}

function clean(value: any) {
  const text = String(value || "").trim();
  return text || null;
}

function moneyOrNull(value: any) {
  if (value === "" || value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function numberOrDefault(value: any, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function integerOrDefault(value: any, fallback: number) {
  const numberValue = parseInt(String(value || ""), 10);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function dateOrNull(value: any) {
  const text = String(value || "").trim();
  return text || null;
}