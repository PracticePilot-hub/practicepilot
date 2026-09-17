import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) throw new Error("Missing Supabase service role key.");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolveClient(clientId: string) {
  const { data: client, error } = await supabase
    .from("crm_clients")
    .select("id, organisation_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw error;
  if (!client) throw new Error("Client not found.");

  return client;
}

function text(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const client = await resolveClient(id);
    const form = await request.formData();
    const action = text(form.get("action"));

    if (action === "create_template") {
      const templateName = text(form.get("template_name"));
      const serviceCode = text(form.get("service_code"));
      const frequency = text(form.get("frequency")) || "monthly";
      const reminderIntervalDays = Number(
        text(form.get("reminder_interval_days")) || "7"
      );

      if (!templateName) {
        throw new Error("Template name is required.");
      }

      const { error } = await supabase
        .from("crm_document_request_templates")
        .insert({
          organisation_id: client.organisation_id,
          client_id: id,
          template_name: templateName,
          service_code: serviceCode || null,
          frequency,
          reminder_enabled: true,
          reminder_interval_days:
            Number.isFinite(reminderIntervalDays) && reminderIntervalDays >= 1
              ? reminderIntervalDays
              : 7,
          is_active: true,
        });

      if (error) throw error;
    } else if (action === "add_item") {
      const templateId = text(form.get("template_id"));
      const itemName = text(form.get("item_name"));
      const isRequired = text(form.get("is_required")) !== "no";

      if (!templateId || !itemName) {
        throw new Error("Template and item name are required.");
      }

      const { data: template, error: templateError } = await supabase
        .from("crm_document_request_templates")
        .select("id, organisation_id, client_id")
        .eq("id", templateId)
        .eq("client_id", id)
        .eq("organisation_id", client.organisation_id)
        .maybeSingle();

      if (templateError) throw templateError;
      if (!template) throw new Error("Document request template not found.");

      const { data: existingItems, error: existingItemsError } = await supabase
        .from("crm_document_request_template_items")
        .select("id")
        .eq("template_id", templateId)
        .eq("is_active", true);

      if (existingItemsError) throw existingItemsError;

      const { error } = await supabase
        .from("crm_document_request_template_items")
        .insert({
          organisation_id: client.organisation_id,
          template_id: templateId,
          item_name: itemName,
          sort_order: (existingItems || []).length + 1,
          is_required: isRequired,
          is_active: true,
        });

      if (error) throw error;
    } else if (action === "archive_item") {
      const itemId = text(form.get("item_id"));

      const { error } = await supabase
        .from("crm_document_request_template_items")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .eq("organisation_id", client.organisation_id);

      if (error) throw error;
    } else if (action === "archive_template") {
      const templateId = text(form.get("template_id"));

      const { error } = await supabase
        .from("crm_document_request_templates")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", templateId)
        .eq("client_id", id)
        .eq("organisation_id", client.organisation_id);

      if (error) throw error;
    } else {
      throw new Error("Invalid document request template action.");
    }

    return NextResponse.redirect(
      new URL(`/crm/client/${id}?tab=documents`, request.url),
      303
    );
  } catch (error: any) {
    console.error("DOCUMENT REQUEST TEMPLATE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message || "Could not update document request templates.",
      },
      { status: 500 }
    );
  }
}
