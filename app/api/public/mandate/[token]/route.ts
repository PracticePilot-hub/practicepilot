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

async function loadPublicOrder(token: string) {
  const { data: order, error } = await admin
    .from("crm_secretarial_work_orders")
    .select(
      "id, organisation_id, client_id, client_group_id, title, proposed_entity_name, work_order_type, status, fee_ex_vat, fee_inc_vat, vat_rate, work_start_gate, release_gate, billing_trigger, payment_status, mandate_status, mandate_sent_at, mandate_accepted_at, mandate_accepted_by_name, mandate_accepted_by_email, client_progress_link_token"
    )
    .eq("client_progress_link_token", token)
    .maybeSingle();

  if (error) throw error;
  if (!order) throw new Error("This mandate link is invalid or no longer available.");

  return order;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const order = await loadPublicOrder(token);

    const [
      { data: items, error: itemsError },
      { data: client, error: clientError },
      { data: group, error: groupError },
      { data: updates, error: updatesError },
    ] = await Promise.all([
      admin
        .from("crm_secretarial_work_order_items")
        .select(
          "id, item_code, item_label, sort_order, is_required, is_selected, status, client_update_enabled"
        )
        .eq("organisation_id", order.organisation_id)
        .eq("work_order_id", order.id)
        .eq("is_selected", true)
        .order("sort_order"),

      order.client_id
        ? admin
            .from("crm_clients")
            .select("client_name")
            .eq("id", order.client_id)
            .eq("organisation_id", order.organisation_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),

      order.client_group_id
        ? admin
            .from("crm_client_groups")
            .select("group_name")
            .eq("id", order.client_group_id)
            .eq("organisation_id", order.organisation_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),

      admin
        .from("crm_secretarial_work_order_updates")
        .select(
          "id, update_type, subject, message, delivery_status, created_at"
        )
        .eq("organisation_id", order.organisation_id)
        .eq("work_order_id", order.id)
        .in("update_type", [
          "mandate_accepted",
          "milestone_completed",
          "payment_required",
          "payment_received",
          "work_completed",
          "document_released",
          "manual_update",
        ])
        .order("created_at", { ascending: false }),
    ]);

    if (itemsError) throw itemsError;
    if (clientError) throw clientError;
    if (groupError) throw groupError;
    if (updatesError) throw updatesError;

    const selectedItems = items || [];
    const completed = selectedItems.filter((item: any) =>
      ["done", "not_applicable"].includes(String(item.status || ""))
    );

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        relationship_name:
          group?.group_name ||
          client?.client_name ||
          order.proposed_entity_name ||
          "Client",
        progress_completed: completed.length,
        progress_total: selectedItems.length,
      },
      items: selectedItems,
      updates: updates || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not load mandate.",
      },
      { status: 404 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const order = await loadPublicOrder(token);
    const body = await request.json();

    const action = String(body?.action || "");

    if (action === "accept") {
      const acceptedByName = String(body?.acceptedByName || "").trim();
      const acceptedByEmail = String(body?.acceptedByEmail || "").trim();
      const confirmAuthority = body?.confirmAuthority === true;
      const confirmPayment = body?.confirmPayment === true;

      if (!acceptedByName) {
        throw new Error("Please enter the name of the person accepting the mandate.");
      }

      if (!acceptedByEmail || !acceptedByEmail.includes("@")) {
        throw new Error("Please enter a valid email address.");
      }

      if (!confirmAuthority || !confirmPayment) {
        throw new Error("Both confirmations must be accepted before continuing.");
      }

      if (order.mandate_status === "accepted") {
        return NextResponse.json({ success: true, alreadyAccepted: true });
      }

      const now = new Date().toISOString();

      let nextStatus = "ready_to_start";

      if (
        order.work_start_gate === "deposit_required" ||
        order.work_start_gate === "full_payment_required"
      ) {
        nextStatus = "awaiting_payment";
      }

      if (order.billing_trigger === "mandate_accepted") {
        nextStatus = "ready_to_bill";
      }

      const acceptanceReference = `MAND-${String(order.id)
        .slice(0, 8)
        .toUpperCase()}-${Date.now()}`;

      const forwardedFor =
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        null;

      const { error: updateError } = await admin
        .from("crm_secretarial_work_orders")
        .update({
          mandate_status: "accepted",
          mandate_accepted_at: now,
          mandate_accepted_by_name: acceptedByName,
          mandate_accepted_by_email: acceptedByEmail,
          mandate_acceptance_ip: forwardedFor,
          mandate_acceptance_user_agent:
            request.headers.get("user-agent") || null,
          mandate_acceptance_reference: acceptanceReference,
          status: nextStatus,
          payment_status:
            order.billing_trigger === "mandate_accepted"
              ? "invoice_required"
              : order.payment_status,
          updated_at: now,
        })
        .eq("id", order.id)
        .eq("organisation_id", order.organisation_id);

      if (updateError) throw updateError;

      await admin.from("crm_secretarial_work_order_updates").insert({
        organisation_id: order.organisation_id,
        work_order_id: order.id,
        update_type: "mandate_accepted",
        subject: "Mandate accepted",
        message: `${acceptedByName} accepted the mandate online.`,
        delivery_channel: "email_and_portal",
        recipient_name: acceptedByName,
        recipient_email: acceptedByEmail,
        delivery_status: "queued",
      });

      return NextResponse.json({
        success: true,
        acceptanceReference,
        status: nextStatus,
      });
    }

    if (action === "decline") {
      const name = String(body?.name || "").trim();
      const reason = String(body?.reason || "").trim();

      const now = new Date().toISOString();

      const { error } = await admin
        .from("crm_secretarial_work_orders")
        .update({
          mandate_status: "declined",
          mandate_declined_at: now,
          status: "draft",
          updated_at: now,
        })
        .eq("id", order.id)
        .eq("organisation_id", order.organisation_id);

      if (error) throw error;

      await admin.from("crm_secretarial_work_order_updates").insert({
        organisation_id: order.organisation_id,
        work_order_id: order.id,
        update_type: "manual_update",
        subject: "Mandate declined",
        message: `${name || "Client"} declined the mandate.${
          reason ? ` Reason: ${reason}` : ""
        }`,
        delivery_channel: "portal",
        delivery_status: "not_sent",
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unknown mandate action." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not update mandate.",
      },
      { status: 400 }
    );
  }
}
