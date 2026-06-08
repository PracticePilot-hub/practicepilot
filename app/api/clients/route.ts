import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function firstDayOfCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function normaliseAccountingFrequency(value: string | undefined) {
  const raw = (value || "").toLowerCase();

  if (raw === "none" || !raw) return null;
  if (raw.includes("bi")) return "bi_monthly_aligned_to_vat";
  if (raw.includes("year")) return "yearly_ad_hoc";

  return "monthly";
}

function getAccountingFrequencyLabel(value: string | undefined) {
  const frequency = normaliseAccountingFrequency(value);

  if (frequency === "bi_monthly_aligned_to_vat") return "Bi-monthly";
  if (frequency === "yearly_ad_hoc") return "Yearly / Ad Hoc";

  return "Monthly";
}

function normalisePayrollFrequency(value: string | undefined) {
  const raw = (value || "").toLowerCase();

  if (raw.includes("week") && raw.includes("2")) return "bi_weekly";
  if (raw.includes("bi")) return "bi_weekly";
  if (raw.includes("week")) return "weekly";

  return "monthly";
}

function getPayrollFrequencyLabel(value: string | undefined) {
  const frequency = normalisePayrollFrequency(value);

  if (frequency === "weekly") return "Weekly";
  if (frequency === "bi_weekly") return "Every 2 weeks";

  return "Monthly";
}

function normaliseVatCategory(value: string | undefined) {
  const raw = (value || "").toUpperCase();

  if (raw.includes("A")) return "A";
  if (raw.includes("B")) return "B";
  if (raw.includes("C")) return "C";

  return "";
}

function getVatFrequency(vatCategory: string) {
  if (vatCategory === "C") return "monthly";
  return "bi_monthly";
}

function getVatFrequencyLabel(vatCategory: string) {
  if (vatCategory === "C") return "Monthly";
  return "Bi-monthly";
}

async function getServiceIdMap(supabase: any) {
  const { data, error } = await supabase
    .from("crm_services")
    .select("id, service_name")
    .eq("is_active", true);

  if (error) throw error;

  const map = new Map<string, string>();

  for (const service of data || []) {
    map.set(service.service_name, service.id);
  }

  return map;
}

async function upsertClientService({
  supabase,
  serviceMap,
  clientId,
  serviceName,
  frequency,
  serviceSettings,
}: {
  supabase: any;
  serviceMap: Map<string, string>;
  clientId: string;
  serviceName: string;
  frequency: string;
  serviceSettings: Record<string, any>;
}) {
  const serviceId = serviceMap.get(serviceName);

  if (!serviceId) {
    console.warn(`Service not found in crm_services: ${serviceName}`);
    return;
  }

  const { error } = await supabase.from("crm_client_services").upsert(
    {
      client_id: clientId,
      service_id: serviceId,
      frequency,
      start_date: firstDayOfCurrentMonth(),
      is_active: true,
      task_generation_enabled: true,
      service_settings: serviceSettings,
      notes: null,
    },
    {
      onConflict: "client_id,service_id",
    }
  );

  if (error) throw error;
}

async function checkDuplicate({
  supabase,
  column,
  value,
  label,
}: {
  supabase: any;
  column: string;
  value: string | null | undefined;
  label: string;
}) {
  const cleanValue = value?.trim();

  if (!cleanValue) return null;

  const { data, error } = await supabase
    .from("crm_clients")
    .select("id, client_name")
    .ilike(column, cleanValue)
    .limit(1);

  if (error) throw error;

  if (data && data.length > 0) {
    return `${label} already exists for ${data[0].client_name}.`;
  }

  return null;
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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      clientName,
      clientType,
      internalCode,
      status,
      yearEnd,
      tradingName,
      registrationNumber,
      registrationDate,

      vatNumber,
      payeNumber,
      incomeTaxNumber,
      uifNumber,
      customsNumber,
      sdlRegistered,
      wccRefNr,

      accounting,
      vat,
      payroll,
      financials,
      bo,
      ar,
      provisionalTax,
      incomeTax,
      emp201,
      emp501,
      workmans,
    } = body;

    const supabase = getSupabaseAdmin();

    const duplicateMessages = await Promise.all([
      checkDuplicate({
        supabase,
        column: "client_name",
        value: clientName,
        label: "Client name",
      }),
      checkDuplicate({
        supabase,
        column: "client_code",
        value: internalCode,
        label: "Internal code",
      }),
      checkDuplicate({
        supabase,
        column: "registration_number",
        value: registrationNumber,
        label: clientType === "Individual" ? "ID number" : "Registration number",
      }),
    ]);

    const duplicateMessage = duplicateMessages.find(Boolean);

    if (duplicateMessage) {
      return NextResponse.json(
        {
          success: false,
          error: duplicateMessage,
        },
        { status: 409 }
      );
    }

    const { data: supabaseClient, error: clientInsertError } = await supabase
      .from("crm_clients")
      .insert({
        client_name: clientName || "",
        entity_type: clientType || null,
        status: status || "Active",
        year_end: yearEnd || null,
        client_code: internalCode || null,
        trading_name: tradingName || null,
        registration_number: registrationNumber || null,
        registration_date: registrationDate || null,

        vat_number: vatNumber || null,
        paye_number: payeNumber || null,
        tax_number: incomeTaxNumber || null,
        uif_registration_number: uifNumber || null,
        customs_number: customsNumber ? String(customsNumber) : null,
        sdl_registered: !!sdlRegistered,
        wcc_reference_number: wccRefNr ? String(wccRefNr) : null,

        imported_source: "new_client_form",
      })
      .select("id")
      .single();

    if (clientInsertError) throw clientInsertError;

    const supabaseClientId = supabaseClient.id;
    const serviceMap = await getServiceIdMap(supabase);

    const servicesToCreate: Array<{
      serviceName: string;
      frequency: string;
      serviceSettings: Record<string, any>;
    }> = [];

    const accountingFrequency = normaliseAccountingFrequency(accounting);

    if (accountingFrequency) {
      servicesToCreate.push({
        serviceName: "Accounting",
        frequency: getAccountingFrequencyLabel(accounting),
        serviceSettings: {
          frequency: accountingFrequency,
          accounting_frequency: accountingFrequency,
        },
      });
    }

    const vatCategory = normaliseVatCategory(vat);

    if (vatCategory) {
      servicesToCreate.push({
        serviceName: "VAT201",
        frequency: getVatFrequencyLabel(vatCategory),
        serviceSettings: {
          vat_category: vatCategory,
          frequency: getVatFrequency(vatCategory),
          due_day: 25,
        },
      });
    }

    if (payroll && payroll !== "None") {
      servicesToCreate.push({
        serviceName: "Payroll",
        frequency: getPayrollFrequencyLabel(payroll),
        serviceSettings: {
          payroll_frequency: normalisePayrollFrequency(payroll),
          frequency: normalisePayrollFrequency(payroll),
        },
      });
    }

    if (financials) {
      servicesToCreate.push({
        serviceName: "Financial Statements",
        frequency: "Annual",
        serviceSettings: {
          frequency: "annual",
        },
      });
    }

    if (bo) {
      servicesToCreate.push({
        serviceName: "Beneficial Ownership Declaration",
        frequency: "Annual",
        serviceSettings: {
          frequency: "annual",
        },
      });
    }

    if (ar) {
      servicesToCreate.push({
        serviceName: "CIPC Annual Return",
        frequency: "Annual",
        serviceSettings: {
          frequency: "annual",
        },
      });
    }

    if (provisionalTax) {
      servicesToCreate.push({
        serviceName: "Provisional Tax",
        frequency: "Bi-annual",
        serviceSettings: {
          frequency: "twice_yearly",
          payment_months: ["August", "February"],
        },
      });
    }

    if (incomeTax) {
      servicesToCreate.push({
        serviceName: "Income Tax",
        frequency: "Annual",
        serviceSettings: {
          frequency: "annual",
        },
      });
    }

    if (emp201) {
      servicesToCreate.push({
        serviceName: "EMP201",
        frequency: "Monthly",
        serviceSettings: {
          frequency: "monthly",
          due_day: 7,
        },
      });
    }

    if (emp501) {
      servicesToCreate.push({
        serviceName: "EMP501",
        frequency: "Bi-annual",
        serviceSettings: {
          frequency: "twice_yearly",
          periods: ["interim", "annual"],
        },
      });
    }

    if (workmans) {
      servicesToCreate.push({
        serviceName: "Workmans Compensation",
        frequency: "Annual",
        serviceSettings: {
          frequency: "annual",
        },
      });
    }

    for (const service of servicesToCreate) {
      await upsertClientService({
        supabase,
        serviceMap,
        clientId: supabaseClientId,
        serviceName: service.serviceName,
        frequency: service.frequency,
        serviceSettings: service.serviceSettings,
      });
    }

    return NextResponse.json({
      success: true,
      supabase_client_id: supabaseClientId,
      services_created: servicesToCreate.length,
    });
  } catch (error: any) {
    console.error("SAVE ERROR:", error);

    const message = getFriendlyDatabaseError(error.message || "Unknown error");

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}