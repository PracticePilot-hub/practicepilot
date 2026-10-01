import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) throw new Error("Missing Supabase service-role key");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function currentContext(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,role,access_enabled,can_access_crm"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    !profile.organisation_id ||
    profile.access_enabled === false ||
    profile.can_access_crm === false
  ) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "CRM access is required." },
        { status: 403 }
      ),
    };
  }

  return { profile, response: null };
}

function categoryLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    financial_statements: "Financial Statements",
    tax: "Tax",
    management_accounts: "Management Accounts",
    payroll: "Payroll",
    secretarial: "Secretarial",
    company_documents: "Company Documents",
    agreements_contracts: "Agreements & Contracts",
    general: "General",
  };

  return labels[String(value || "")] || "General";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    const { data: client, error: clientError } = await admin
      .from("crm_clients")
      .select(
        "id,client_name,trading_name,registration_number,client_code"
      )
      .eq("id", clientId)
      .eq("organisation_id", organisationId)
      .maybeSingle();

    if (clientError) throw clientError;

    if (!client) {
      return NextResponse.json(
        { error: "Client not found." },
        { status: 404 }
      );
    }

    const { data: documents, error: documentsError } = await admin
      .from("crm_document_workflow")
      .select(
        `
          id,
          provider_path,
          document_name,
          portal_category,
          workflow_status,
          client_visible,
          released_at,
          approved_at,
          updated_at
        `
      )
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .eq("client_visible", true)
      .eq("workflow_status", "approved")
      .order("released_at", { ascending: false, nullsFirst: false });

    if (documentsError) throw documentsError;

    const rows = (documents || []).map((row: any) => ({
      ...row,
      portal_category: row.portal_category || "general",
      portal_category_label: categoryLabel(row.portal_category),
    }));

    const categoryCounts = rows.reduce(
      (acc: Record<string, number>, row: any) => {
        const key = String(row.portal_category || "general");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {}
    );

    return NextResponse.json({
      success: true,
      client,
      documents: rows,
      counts: {
        total: rows.length,
        needs_action: 0,
        awaiting_our_work: 0,
        for_your_records: rows.length,
      },
      category_counts: categoryCounts,
    });
  } catch (error) {
    console.error("CLIENT PORTAL PREVIEW ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the client portal preview.",
      },
      { status: 500 }
    );
  }
}
