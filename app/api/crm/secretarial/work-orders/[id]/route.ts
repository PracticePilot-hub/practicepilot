import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMandateEmail, sendMilestoneEmail } from "../../../../../lib/secretarialMail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
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

function getRequestOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");

  if (host) {
    return `${forwardedProto || "http"}://${host}`;
  }

  return new URL(request.url).origin;
}

async function getOrder(profile: any, workOrderId: string) {
  const { data: order, error } = await admin
    .from("crm_secretarial_work_orders")
    .select("*")
    .eq("id", workOrderId)
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();

  if (error) throw error;
  if (!order) throw new Error("Secretarial Work Order not found.");

  return order;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getProfile(request);
    const { id } = await context.params;
    const order = await getOrder(profile, id);

    const [
      { data: items, error: itemsError },
      { data: updates, error: updatesError },
      { data: client, error: clientError },
      { data: group, error: groupError },
    ] = await Promise.all([
      admin
        .from("crm_secretarial_work_order_items")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("work_order_id", id)
        .order("sort_order"),

      admin
        .from("crm_secretarial_work_order_updates")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("work_order_id", id)
        .order("created_at", { ascending: false }),

      order.client_id
        ? admin
            .from("crm_clients")
            .select("id, client_name, client_code")
            .eq("id", order.client_id)
            .eq("organisation_id", profile.organisation_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),

      order.client_group_id
        ? admin
            .from("crm_client_groups")
            .select("id, group_name")
            .eq("id", order.client_group_id)
            .eq("organisation_id", profile.organisation_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (itemsError) throw itemsError;
    if (updatesError) throw updatesError;
    if (clientError) throw clientError;
    if (groupError) throw groupError;

    const selected = (items || []).filter((item: any) => item.is_selected !== false);
    const completed = selected.filter((item: any) =>
      ["done", "not_applicable"].includes(String(item.status || ""))
    );

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        work_order_number: `WO-${String(order.id).slice(0, 8).toUpperCase()}`,
        relationship_name:
          group?.group_name ||
          client?.client_name ||
          order.proposed_entity_name ||
          "Unlinked",
        progress_completed: completed.length,
        progress_total: selected.length,
      },
      items: items || [],
      updates: updates || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not load Secretarial Work Order.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getProfile(request);
    const { id } = await context.params;
    await getOrder(profile, id);

    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "update-item-status") {
      const itemId = String(body?.itemId || "").trim();
      const status = String(body?.status || "");

      if (!itemId) throw new Error("Checklist item is required.");

      if (
        !["not_started", "in_progress", "waiting", "done", "not_applicable"].includes(
          status
        )
      ) {
        throw new Error("Invalid checklist status.");
      }

      const { data: item, error: itemError } = await admin
        .from("crm_secretarial_work_order_items")
        .select("*")
        .eq("id", itemId)
        .eq("work_order_id", id)
        .eq("organisation_id", profile.organisation_id)
        .maybeSingle();

      if (itemError) throw itemError;
      if (!item) throw new Error("Checklist item not found.");

      const completed = status === "done";

      const { error: updateError } = await admin
        .from("crm_secretarial_work_order_items")
        .update({
          status,
          completed_at: completed ? new Date().toISOString() : null,
          completed_by_user_id: completed ? profile.user_id : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .eq("organisation_id", profile.organisation_id);

      if (updateError) throw updateError;

      if (
        completed &&
        item.client_update_enabled &&
        item.status !== "done"
      ) {
        const { data: emailOrder, error: emailOrderError } = await admin
          .from("crm_secretarial_work_orders")
          .select(
            "title, contact_person_name, contact_email, contact_cc_email, update_recipient_mode, client_progress_link_token"
          )
          .eq("id", id)
          .eq("organisation_id", profile.organisation_id)
          .maybeSingle();

        if (emailOrderError) throw emailOrderError;

        const subject =
          item.client_update_subject || `${item.item_label} completed`;

        const message =
          item.client_update_message ||
          `${item.item_label} has been completed.`;

        let deliveryStatus = "not_sent";

        if (emailOrder?.contact_email) {
          try {
            const progressUrl = `${getRequestOrigin(
              request
            )}/mandate/${emailOrder.client_progress_link_token}`;

            await sendMilestoneEmail({
              organisationId: profile.organisation_id,
              to: emailOrder.contact_email,
              cc:
                emailOrder.update_recipient_mode === "primary_and_cc"
                  ? emailOrder.contact_cc_email
                  : null,
              contactName: emailOrder.contact_person_name,
              workTitle: emailOrder.title,
              milestoneLabel: subject,
              message,
              progressUrl,
            });

            deliveryStatus = "sent";
          } catch {
            deliveryStatus = "failed";
          }
        }

        await admin.from("crm_secretarial_work_order_updates").insert({
          organisation_id: profile.organisation_id,
          work_order_id: id,
          work_order_item_id: itemId,
          update_type: "milestone_completed",
          subject,
          message,
          delivery_channel: "email_and_portal",
          recipient_name: emailOrder?.contact_person_name || null,
          recipient_email: emailOrder?.contact_email || null,
          delivery_status: deliveryStatus,
          sent_at:
            deliveryStatus === "sent" ? new Date().toISOString() : null,
        });
      }

      const { data: items, error: refreshItemsError } = await admin
        .from("crm_secretarial_work_order_items")
        .select("status, is_required, is_selected, item_code")
        .eq("organisation_id", profile.organisation_id)
        .eq("work_order_id", id);

      if (refreshItemsError) throw refreshItemsError;

      const selectedRequired = (items || []).filter(
        (row: any) => row.is_selected !== false && row.is_required !== false
      );

      const allRequiredComplete =
        selectedRequired.length > 0 &&
        selectedRequired.every((row: any) =>
          ["done", "not_applicable"].includes(String(row.status || ""))
        );

      const registrationComplete = (items || []).some(
        (row: any) =>
          row.item_code === "company_registration" &&
          row.status === "done"
      );

      const { data: order } = await admin
        .from("crm_secretarial_work_orders")
        .select("billing_trigger, payment_status, status")
        .eq("id", id)
        .eq("organisation_id", profile.organisation_id)
        .maybeSingle();

      let nextStatus = order?.status || "in_progress";

      if (
        order?.billing_trigger === "registration_completed" &&
        registrationComplete
      ) {
        nextStatus = "ready_to_bill";
      } else if (
        order?.billing_trigger === "all_required_work_complete" &&
        allRequiredComplete
      ) {
        nextStatus = "ready_to_bill";
      } else if (!["ready_to_bill", "billed", "completed"].includes(nextStatus)) {
        nextStatus =
          status === "waiting" ? "waiting_external" : "in_progress";
      }

      await admin
        .from("crm_secretarial_work_orders")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organisation_id", profile.organisation_id);

      return NextResponse.json({ success: true });
    }

    if (action === "send-mandate") {
      const { data: existing, error: existingError } = await admin
        .from("crm_secretarial_work_orders")
        .select(
          "id, title, proposed_entity_name, fee_inc_vat, mandate_status, work_start_gate, billing_trigger, client_progress_link_token, contact_person_name, contact_email, contact_cc_email, update_recipient_mode"
        )
        .eq("id", id)
        .eq("organisation_id", profile.organisation_id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (!existing) throw new Error("Secretarial Work Order not found.");

      const now = new Date().toISOString();

      const { error: mandateError } = await admin
        .from("crm_secretarial_work_orders")
        .update({
          mandate_status: "sent",
          mandate_sent_at: now,
          status: "mandate_sent",
          updated_at: now,
        })
        .eq("id", id)
        .eq("organisation_id", profile.organisation_id);

      if (mandateError) throw mandateError;

      if (!existing.contact_email) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This work order does not have a mandate email address. Add the contact email before sending.",
          },
          { status: 400 }
        );
      }

      const mandateUrl = `${getRequestOrigin(
        request
      )}/mandate/${existing.client_progress_link_token}`;

      let deliveryStatus = "sent";
      let emailError = "";

      try {
        await sendMandateEmail({
          organisationId: profile.organisation_id,
          to: existing.contact_email,
          cc:
            existing.update_recipient_mode === "primary_and_cc"
              ? existing.contact_cc_email
              : null,
          contactName: existing.contact_person_name,
          workTitle: existing.title,
          proposedEntityName: existing.proposed_entity_name,
          mandateUrl,
        });
      } catch (error: any) {
        deliveryStatus = "failed";
        emailError = error?.message || "Email could not be sent.";
      }

      await admin.from("crm_secretarial_work_order_updates").insert({
        organisation_id: profile.organisation_id,
        work_order_id: id,
        update_type: "mandate_sent",
        subject: "Secretarial mandate ready for client acceptance",
        message:
          deliveryStatus === "sent"
            ? `Mandate email sent to ${existing.contact_email}.`
            : `Mandate link activated, but the email failed: ${emailError}`,
        delivery_channel: "email_and_portal",
        recipient_name: existing.contact_person_name || null,
        recipient_email: existing.contact_email,
        delivery_status: deliveryStatus,
        sent_at:
          deliveryStatus === "sent" ? new Date().toISOString() : null,
      });

      if (deliveryStatus === "failed") {
        return NextResponse.json(
          {
            success: false,
            error: `Mandate link activated, but the email failed: ${emailError}`,
            token: existing.client_progress_link_token,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        token: existing.client_progress_link_token,
      });
    }

    if (action === "update-contact") {
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
        throw new Error("A valid primary email address is required.");
      }

      if (contactCcEmail && !contactCcEmail.includes("@")) {
        throw new Error("CC email address is not valid.");
      }

      const { error } = await admin
        .from("crm_secretarial_work_orders")
        .update({
          contact_person_name: contactPersonName,
          contact_email: contactEmail,
          contact_mobile: contactMobile,
          contact_cc_email: contactCcEmail,
          update_recipient_mode: updateRecipientMode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organisation_id", profile.organisation_id);

      if (error) throw error;

      await admin.from("crm_secretarial_work_order_updates").insert({
        organisation_id: profile.organisation_id,
        work_order_id: id,
        update_type: "manual_update",
        subject: "Mandate contact updated",
        message: `Mandate contact updated to ${contactPersonName} <${contactEmail}>.`,
        delivery_channel: "portal",
        delivery_status: "not_sent",
      });

      return NextResponse.json({ success: true });
    }

    if (action === "mark-payment-status") {
      const paymentStatus = String(body?.paymentStatus || "");

      if (
        ![
          "not_invoiced",
          "invoice_required",
          "invoiced",
          "part_paid",
          "paid",
          "written_off",
        ].includes(paymentStatus)
      ) {
        throw new Error("Invalid payment status.");
      }

      const { data: order, error: orderError } = await admin
        .from("crm_secretarial_work_orders")
        .select("work_start_gate, release_gate, status")
        .eq("id", id)
        .eq("organisation_id", profile.organisation_id)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) throw new Error("Secretarial Work Order not found.");

      let nextStatus = order.status;

      if (paymentStatus === "paid") {
        if (
          order.status === "awaiting_payment" ||
          order.status === "mandate_accepted"
        ) {
          nextStatus = "ready_to_start";
        }
      }

      const { error } = await admin
        .from("crm_secretarial_work_orders")
        .update({
          payment_status: paymentStatus,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organisation_id", profile.organisation_id);

      if (error) throw error;

      if (paymentStatus === "paid") {
        await admin.from("crm_secretarial_work_order_updates").insert({
          organisation_id: profile.organisation_id,
          work_order_id: id,
          update_type: "payment_received",
          subject: "Payment received",
          message: "Payment has been marked as received.",
          delivery_channel: "portal",
          delivery_status: "not_sent",
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "update-order") {
      const payload: any = {
        updated_at: new Date().toISOString(),
      };

      if (body?.status) payload.status = body.status;
      if (body?.paymentStatus) payload.payment_status = body.paymentStatus;
      if (body?.invoiceReference !== undefined) {
        payload.invoice_reference = body.invoiceReference || null;
      }

      const { error } = await admin
        .from("crm_secretarial_work_orders")
        .update(payload)
        .eq("id", id)
        .eq("organisation_id", profile.organisation_id);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unknown work order action." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not update Secretarial Work Order.",
      },
      { status: 500 }
    );
  }
}
