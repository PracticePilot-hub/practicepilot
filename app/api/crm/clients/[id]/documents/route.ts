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
if (!serviceKey) {
  throw new Error("Missing Supabase service role key.");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getProfile(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.replace(/^Bearer\\s+/i, "").trim();

  if (bearer) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearer);

    if (authError || !user) {
      throw new Error("Your login session could not be confirmed.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("user_id, organisation_id, access_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile?.access_enabled || !profile.organisation_id) {
      throw new Error("Your PracticePilot practice access could not be confirmed.");
    }

    return profile;
  }

  return null;
}

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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const client = await resolveClient(id);

    const contentType = request.headers.get("content-type") || "";
    const isForm = contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data");

    let body: any;

    if (isForm) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      body = await request.json();
    }

    const action = String(body.action || "").trim();

    if (action === "create") {
      const documentName = String(body.document_name || "").trim();
      if (!documentName) {
        return NextResponse.json(
          { success: false, error: "Document name is required." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("crm_client_documents")
        .insert({
          organisation_id: client.organisation_id,
          client_id: id,
          document_name: documentName,
          category: String(body.category || "").trim() || null,
          description: String(body.description || "").trim() || null,
          provider: String(body.provider || "manual").trim() || "manual",
          external_url: String(body.external_url || "").trim() || null,
          document_date: String(body.document_date || "").trim() || null,
          received_date: String(body.received_date || "").trim() || null,
          linked_work_item_id:
            String(body.linked_work_item_id || "").trim() || null,
          source_type: String(body.source_type || "external").trim() || "external",
          status: "active",
        });

      if (error) throw error;

      if (isForm) {
        return NextResponse.redirect(
          new URL(`/crm/client/${id}?tab=documents`, request.url),
          303
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "archive") {
      const documentId = String(body.document_id || "").trim();

      if (!documentId) {
        return NextResponse.json(
          { success: false, error: "Document is required." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("crm_client_documents")
        .update({
          status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .eq("client_id", id)
        .eq("organisation_id", client.organisation_id);

      if (error) throw error;

      if (isForm) {
        return NextResponse.redirect(
          new URL(`/crm/client/${id}?tab=documents`, request.url),
          303
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid document action." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("CLIENT DOCUMENTS POST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not update client documents.",
      },
      { status: 500 }
    );
  }
}
