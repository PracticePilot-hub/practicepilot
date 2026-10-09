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
if (!serviceKey) throw new Error("Missing Supabase server key");

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

type StaffContext = {
  authUser: any;
  staffProfile: {
    organisation_id: string;
  };
  client: {
    id: string;
    organisation_id: string;
    client_name: string;
  } | null;
};

async function requireStaff(
  request: Request,
  clientId?: string
): Promise<StaffContext> {
  const token = bearerToken(request);

  if (!token) throw new Error("Not authenticated.");

  const {
    data: { user: authenticatedUser },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !authenticatedUser) {
    throw new Error("Not authenticated.");
  }

  const { data: staffProfileRow, error: profileError } = await admin
    .from("user_profiles")
    .select("organisation_id,access_enabled,can_access_crm")
    .eq("user_id", authenticatedUser.id)
    .maybeSingle();

  if (
    profileError ||
    !staffProfileRow ||
    !staffProfileRow.organisation_id ||
    staffProfileRow.access_enabled === false ||
    staffProfileRow.can_access_crm === false
  ) {
    throw new Error("CRM access is required.");
  }

  const organisationId = String(staffProfileRow.organisation_id);

  let client: StaffContext["client"] = null;

  if (clientId) {
    const { data: clientRow, error: clientError } = await admin
      .from("crm_clients")
      .select("id,organisation_id,client_name")
      .eq("id", clientId)
      .eq("organisation_id", organisationId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!clientRow) throw new Error("Client not found.");

    client = clientRow;
  }

  return {
    authUser: authenticatedUser,
    staffProfile: {
      organisation_id: organisationId,
    },
    client,
  };
}

const starterTemplates = [
  {
    template_name: "Monthly Bank Statements",
    request_type: "document_request",
    title: "Bank statements required",
    description:
      "Please upload the bank statements for the month so we can complete your accounting work.",
    priority: "normal",
    requires_upload: true,
    requires_response: false,
    requires_approval: false,
    default_due_days: 5,
  },
  {
    template_name: "VAT Supporting Documents",
    request_type: "document_request",
    title: "VAT supporting documents required",
    description:
      "Please upload the outstanding VAT supporting documents so we can complete the VAT work.",
    priority: "normal",
    requires_upload: true,
    requires_response: false,
    requires_approval: false,
    default_due_days: 5,
  },
  {
    template_name: "Payroll Information",
    request_type: "document_request",
    title: "Payroll information required",
    description:
      "Please upload the payroll information and changes required for this payroll period.",
    priority: "normal",
    requires_upload: true,
    requires_response: false,
    requires_approval: false,
    default_due_days: 3,
  },
  {
    template_name: "General Confirmation",
    request_type: "confirmation",
    title: "Please confirm",
    description:
      "Please review the information below and confirm whether it is correct.",
    priority: "normal",
    requires_upload: false,
    requires_response: true,
    requires_approval: false,
    default_due_days: 3,
  },
];

async function ensureStarterTemplates(
  organisationId: string,
  userId: string
) {
  const { data: existing, error } = await admin
    .from("crm_client_request_templates")
    .select("template_name")
    .eq("organisation_id", organisationId);

  if (error) throw error;

  const existingNames = new Set(
    (existing || []).map((row) => String(row.template_name))
  );

  const missing = starterTemplates
    .filter((row) => !existingNames.has(row.template_name))
    .map((row) => ({
      ...row,
      organisation_id: organisationId,
      created_by_user_id: userId,
      is_active: true,
    }));

  if (missing.length) {
    const { error: insertError } = await admin
      .from("crm_client_request_templates")
      .insert(missing);

    if (insertError) throw insertError;
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await requireStaff(request);

    await ensureStarterTemplates(
      ctx.staffProfile.organisation_id,
      ctx.authUser.id
    );

    const { data, error } = await admin
      .from("crm_client_request_templates")
      .select("*")
      .eq("organisation_id", ctx.staffProfile.organisation_id)
      .eq("is_active", true)
      .order("template_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      templates: data || [],
    });
  } catch (error) {
    console.error("REQUEST TEMPLATES GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load request templates.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireStaff(request);
    const body = await request.json().catch(() => ({}));

    const templateName = String(body?.template_name || "").trim();
    const title = String(body?.title || "").trim();
    const requestType = String(body?.request_type || "").trim();

    if (!templateName || !title || !requestType) {
      return NextResponse.json(
        { error: "Template name, request type and title are required." },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("crm_client_request_templates")
      .insert({
        organisation_id: ctx.staffProfile.organisation_id,
        template_name: templateName,
        request_type: requestType,
        title,
        description:
          String(body?.description || "").trim() || null,
        priority: String(body?.priority || "normal"),
        requires_upload: body?.requires_upload === true,
        requires_response: body?.requires_response === true,
        requires_approval: body?.requires_approval === true,
        default_due_days:
          body?.default_due_days === "" ||
          body?.default_due_days === null ||
          body?.default_due_days === undefined
            ? null
            : Number(body.default_due_days),
        default_upload_folder_path:
          String(body?.default_upload_folder_path || "").trim() || null,
        default_upload_folder_name:
          String(body?.default_upload_folder_name || "").trim() || null,
        is_active: true,
        created_by_user_id: ctx.authUser.id,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      template: data,
    });
  } catch (error) {
    console.error("REQUEST TEMPLATES POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save request template.",
      },
      { status: 500 }
    );
  }
}
