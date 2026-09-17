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

async function getProfile(request: Request) {
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

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("user_id, organisation_id, access_enabled, can_access_crm")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (
    !profile?.organisation_id ||
    profile.access_enabled === false ||
    profile.can_access_crm === false
  ) {
    throw new Error("You do not have access to CRM Secretarial.");
  }

  return profile;
}

const registrationItems = [
  {
    item_code: "name_reservation",
    item_label: "Name reservation",
    sort_order: 10,
    is_required: true,
    is_selected: true,
    client_update_enabled: true,
    client_update_subject: "Company name reserved",
    client_update_message:
      "Your proposed company name has been successfully reserved.",
  },
  {
    item_code: "company_registration",
    item_label: "Actual registration",
    sort_order: 20,
    is_required: true,
    is_selected: true,
    client_update_enabled: true,
    client_update_subject: "Company registration completed",
    client_update_message:
      "Your company registration has been completed.",
  },
  {
    item_code: "first_bo",
    item_label: "1st Beneficial Ownership filing",
    sort_order: 30,
    is_required: true,
    is_selected: true,
    client_update_enabled: true,
    client_update_subject: "Beneficial Ownership filing completed",
    client_update_message:
      "The initial Beneficial Ownership filing has been completed.",
  },
  {
    item_code: "paia_manual",
    item_label: "PAIA Manual",
    sort_order: 40,
    is_required: true,
    is_selected: true,
    client_update_enabled: true,
    client_update_subject: "PAIA Manual completed",
    client_update_message:
      "Your PAIA Manual has been completed.",
  },
];

const optionalRegistrationItems = [
  {
    code: "registered_rep",
    label: "Registered Representative update",
    order: 50,
  },
  {
    code: "paye_registration",
    label: "PAYE Registration",
    order: 60,
  },
  {
    code: "uif_dol_registration",
    label: "UIF (DOL) Registration",
    order: 70,
  },
  {
    code: "coida_registration",
    label: "COIDA Registration",
    order: 80,
  },
];

const nameChangeItems = [
  {
    item_code: "name_reservation",
    item_label: "Name reservation",
    sort_order: 10,
    is_required: true,
    is_selected: true,
    client_update_enabled: true,
    client_update_subject: "New company name reserved",
    client_update_message:
      "The proposed new company name has been successfully reserved.",
  },
  {
    item_code: "company_name_change",
    item_label: "Company name change",
    sort_order: 20,
    is_required: true,
    is_selected: true,
    client_update_enabled: true,
    client_update_subject: "Company name change completed",
    client_update_message:
      "The company name change has been completed.",
  },
];

export async function GET(request: Request) {
  try {
    const profile = await getProfile(request);
    const organisationId = profile.organisation_id;

    const [
      { data: workOrders, error: workOrdersError },
      { data: clients, error: clientsError },
      { data: groups, error: groupsError },
      { data: items, error: itemsError },
    ] = await Promise.all([
      admin
        .from("crm_secretarial_work_orders")
        .select("*")
        .eq("organisation_id", organisationId)
        .order("created_at", { ascending: false }),

      admin
        .from("crm_clients")
        .select("id, client_name, client_code, relationship_status")
        .eq("organisation_id", organisationId)
        .neq("relationship_status", "former_client")
        .order("client_name"),

      admin
        .from("crm_client_groups")
        .select("id, group_name")
        .eq("organisation_id", organisationId)
        .order("group_name"),

      admin
        .from("crm_secretarial_work_order_items")
        .select("work_order_id, status, is_required, is_selected")
        .eq("organisation_id", organisationId),
    ]);

    if (workOrdersError) throw workOrdersError;
    if (clientsError) throw clientsError;
    if (groupsError) throw groupsError;
    if (itemsError) throw itemsError;

    const clientMap = new Map(
      (clients || []).map((row: any) => [row.id, row])
    );
    const groupMap = new Map(
      (groups || []).map((row: any) => [row.id, row])
    );

    const itemsByOrder = new Map<string, any[]>();
    for (const item of items || []) {
      const list = itemsByOrder.get(item.work_order_id) || [];
      list.push(item);
      itemsByOrder.set(item.work_order_id, list);
    }

    const rows = (workOrders || []).map((row: any) => {
      const orderItems = itemsByOrder.get(row.id) || [];
      const selected = orderItems.filter((item) => item.is_selected !== false);
      const completed = selected.filter((item) =>
        ["done", "not_applicable"].includes(String(item.status || ""))
      );

      const client = row.client_id ? clientMap.get(row.client_id) : null;
      const group = row.client_group_id
        ? groupMap.get(row.client_group_id)
        : null;

      return {
        ...row,
        work_order_number: `WO-${String(row.id).slice(0, 8).toUpperCase()}`,
        relationship_name:
          row.source_type === "new_party"
            ? row.new_party_name ||
              row.proposed_entity_name ||
              "New / Not yet in PracticePilot"
            : group?.group_name ||
              client?.client_name ||
              row.proposed_entity_name ||
              "Unlinked",
        progress_completed: completed.length,
        progress_total: selected.length,
      };
    });

    return NextResponse.json({
      success: true,
      rows,
      clients: clients || [],
      groups: groups || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not load Secretarial Work Orders.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getProfile(request);
    const body = await request.json();

    const scopeType = String(body?.scopeType || "");
    const scopeId = String(body?.scopeId || "").trim();
    const workOrderType = String(body?.workOrderType || "");

    if (!["client", "group", "new_party"].includes(scopeType)) {
      throw new Error("Select who this work order is for.");
    }

    if (scopeType !== "new_party" && !scopeId) {
      throw new Error("Select the client or client group.");
    }

    const newPartyName =
      String(body?.newPartyName || "").trim() || null;

    if (scopeType === "new_party" && !newPartyName) {
      throw new Error("Enter the client / business name.");
    }

    const contactPersonName =
      String(body?.contactPersonName || "").trim() || null;
    const contactEmail =
      String(body?.contactEmail || "").trim() || null;
    const contactMobile =
      String(body?.contactMobile || "").trim() || null;
    const contactCcEmail =
      String(body?.contactCcEmail || "").trim() || null;
    const updateRecipientMode =
      body?.updateRecipientMode === "primary_and_cc"
        ? "primary_and_cc"
        : "primary_only";

    if (!contactPersonName) {
      throw new Error("Contact person is required.");
    }

    if (!contactEmail || !contactEmail.includes("@")) {
      throw new Error("A valid mandate email address is required.");
    }

    if (
      ![
        "new_entity_registration",
        "company_name_change",
        "other_secretarial",
      ].includes(workOrderType)
    ) {
      throw new Error("Select a valid work order type.");
    }

    const proposedEntityName =
      String(body?.proposedEntityName || "").trim() || null;

    const title =
      workOrderType === "new_entity_registration"
        ? `New Entity Registration${
            proposedEntityName ? ` — ${proposedEntityName}` : ""
          }`
        : workOrderType === "company_name_change"
        ? `Company Name Change${
            proposedEntityName ? ` — ${proposedEntityName}` : ""
          }`
        : String(body?.title || "").trim() || "Secretarial Work Order";

    const feeExVat =
      body?.feeExVat === "" || body?.feeExVat == null
        ? null
        : Number(body.feeExVat);

    if (feeExVat !== null && (!Number.isFinite(feeExVat) || feeExVat < 0)) {
      throw new Error("Fee must be zero or higher.");
    }

    const vatRate = 15;
    const feeIncVat =
      feeExVat === null
        ? null
        : Number((feeExVat * (1 + vatRate / 100)).toFixed(2));

    const { data: workOrder, error: orderError } = await admin
      .from("crm_secretarial_work_orders")
      .insert({
        organisation_id: profile.organisation_id,
        source_type: scopeType,
        client_id: scopeType === "client" ? scopeId : null,
        client_group_id: scopeType === "group" ? scopeId : null,
        new_party_name: scopeType === "new_party" ? newPartyName : null,
        contact_person_name: contactPersonName,
        contact_email: contactEmail,
        contact_mobile: contactMobile,
        contact_cc_email: contactCcEmail,
        update_recipient_mode: updateRecipientMode,
        work_order_type: workOrderType,
        title,
        proposed_entity_name: proposedEntityName,
        status: "draft",
        fee_ex_vat: feeExVat,
        vat_rate: vatRate,
        fee_inc_vat: feeIncVat,
        work_start_gate:
          body?.workStartGate || "no_payment_required",
        release_gate:
          body?.releaseGate || "full_payment_required",
        billing_trigger:
          body?.billingTrigger || "all_required_work_complete",
        mandate_status: "not_sent",
        payment_status: "not_invoiced",
        client_updates_enabled: true,
        created_by_user_id: profile.user_id,
      })
      .select("id")
      .single();

    if (orderError) throw orderError;

    const checklist: any[] = [];

    if (workOrderType === "new_entity_registration") {
      checklist.push(...registrationItems);

      const selectedOptional = Array.isArray(body?.optionalServices)
        ? body.optionalServices.map(String)
        : [];

      for (const item of optionalRegistrationItems) {
        checklist.push({
          item_code: item.code,
          item_label: item.label,
          sort_order: item.order,
          is_required: false,
          is_selected: selectedOptional.includes(item.code),
          status: selectedOptional.includes(item.code)
            ? "not_started"
            : "not_applicable",
          client_update_enabled: selectedOptional.includes(item.code),
          client_update_subject: `${item.label} completed`,
          client_update_message: `${item.label} has been completed.`,
        });
      }
    } else if (workOrderType === "company_name_change") {
      checklist.push(...nameChangeItems);
    }

    if (checklist.length) {
      const { error: checklistError } = await admin
        .from("crm_secretarial_work_order_items")
        .insert(
          checklist.map((item) => ({
            organisation_id: profile.organisation_id,
            work_order_id: workOrder.id,
            status: item.status || "not_started",
            ...item,
          }))
        );

      if (checklistError) throw checklistError;
    }

    await admin.from("crm_secretarial_work_order_updates").insert({
      organisation_id: profile.organisation_id,
      work_order_id: workOrder.id,
      update_type: "manual_update",
      message: `Work order created: ${title}`,
      delivery_channel: "portal",
      delivery_status: "not_sent",
    });

    return NextResponse.json({
      success: true,
      id: workOrder.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not create Secretarial Work Order.",
      },
      { status: 500 }
    );
  }
}
