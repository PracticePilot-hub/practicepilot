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

type WorkflowStatus =

  | "stored"

  | "awaiting_review"

  | "reviewed"

  | "approved"

  | "rejected";

type WorkflowItemType = "file" | "folder";

function bearerToken(request: Request) {

  return (request.headers.get("authorization") || "")

    .replace(/^Bearer\s+/i, "")

    .trim();

}

async function currentContext(request: Request) {

  const token = bearerToken(request);

  if (!token) {

    return {

      user: null,

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

      user: null,

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

      user: null,

      profile: null,

      response: NextResponse.json(

        { error: "CRM access is required." },

        { status: 403 }

      ),

    };

  }

  return {

    user,

    profile,

    response: null,

  };

}

async function clientProviderContext(

  organisationId: string,

  clientId: string

) {

  const { data: client, error: clientError } = await admin

    .from("crm_clients")

    .select("id")

    .eq("id", clientId)

    .eq("organisation_id", organisationId)

    .maybeSingle();

  if (clientError) throw clientError;

  if (!client) {

    throw new Error("Client not found.");

  }

  const { data: mapping, error: mappingError } = await admin

    .from("crm_client_document_locations")

    .select(

      "id,organisation_id,client_id,provider_id,folder_path,is_primary,is_active"

    )

    .eq("organisation_id", organisationId)

    .eq("client_id", clientId)

    .eq("is_active", true)

    .eq("is_primary", true)

    .limit(1)

    .maybeSingle();

  if (mappingError) throw mappingError;

  if (!mapping) {

    throw new Error(

      "This client is not linked to a document-provider folder."

    );

  }

  return {

    client,

    mapping,

  };

}

function normalisePath(value: string) {

  const parts = String(value || "")

    .split("/")

    .filter(Boolean);

  return `/${parts.join("/")}`;

}

function isInsideRoot(rootPath: string, requestedPath: string) {

  const root = normalisePath(rootPath);

  const requested = normalisePath(requestedPath);

  return requested === root || requested.startsWith(`${root}/`);

}

function cleanItemType(value: unknown): WorkflowItemType {

  const itemType = String(value || "file")

    .trim()

    .toLowerCase() as WorkflowItemType;

  if (!["file", "folder"].includes(itemType)) {

    throw new Error("Invalid workflow item type.");

  }

  return itemType;

}

function cleanStatus(value: unknown): WorkflowStatus {

  const status = String(value || "")

    .trim()

    .toLowerCase() as WorkflowStatus;

  if (

    ![

      "stored",

      "awaiting_review",

      "reviewed",

      "approved",

      "rejected",

    ].includes(status)

  ) {

    throw new Error("Invalid document workflow status.");

  }

  return status;

}

const PORTAL_CATEGORIES = [

  "financial_statements",

  "tax",

  "management_accounts",

  "vat",

  "payroll",

  "secretarial",

  "company_documents",

  "agreements_contracts",

  "general",

] as const;

type PortalCategory = (typeof PORTAL_CATEGORIES)[number];

function cleanPortalCategory(value: unknown): PortalCategory {

  const category = String(value || "")

    .trim()

    .toLowerCase() as PortalCategory;

  if (!PORTAL_CATEGORIES.includes(category)) {

    throw new Error("Invalid client portal category.");

  }

  return category;

}

function suggestPortalCategory(

  providerPath: string,

  documentName: string

): PortalCategory {

  const text = `${providerPath} ${documentName}`.toLowerCase();

  if (

    text.includes("afs") ||

    text.includes("financial statement") ||

    text.includes("annual financial")

  ) {

    return "financial_statements";

  }

  if (

    text.includes("management account") ||

    text.includes("management report")

  ) {

    return "management_accounts";

  }

  if (

    text.includes("vat201") ||

    text.includes("value added tax") ||

    text.includes("value-added tax") ||

    text.includes("vat")

  ) {

    return "vat";

  }

  if (

    text.includes("payroll") ||

    text.includes("payslip") ||

    text.includes("emp201") ||

    text.includes("emp501") ||

    text.includes("irp5")

  ) {

    return "payroll";

  }

  if (

    text.includes("secretarial") ||

    text.includes("share certificate") ||

    text.includes("securities register") ||

    text.includes("beneficial ownership") ||

    text.includes("cipc")

  ) {

    return "secretarial";

  }

  if (

    text.includes("engagement") ||

    text.includes("agreement") ||

    text.includes("contract") ||

    text.includes("mandate")

  ) {

    return "agreements_contracts";

  }

  if (

    text.includes("income tax") ||

    text.includes("provisional") ||

    text.includes("itr") ||

    text.includes("sars") ||

    text.includes("tax")

  ) {

    return "tax";

  }

  if (

    text.includes("company document") ||

    text.includes("company documents") ||

    text.includes("incorporation") ||

    text.includes("cor14") ||

    text.includes("coreg")

  ) {

    return "company_documents";

  }

  return "general";

}

function withSuggestedPortalCategory(row: any) {

  return {

    ...row,

    portal_category:

      row?.portal_category ||

      suggestPortalCategory(

        String(row?.provider_path || ""),

        String(row?.document_name || "")

      ),

  };

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

    const { mapping } = await clientProviderContext(

      organisationId,

      clientId

    );

    const url = new URL(request.url);

    const path = String(url.searchParams.get("path") || "").trim();

    let query = admin

      .from("crm_document_workflow")

      .select(

        `

          id,

          organisation_id,

          client_id,

          provider_id,

          provider_item_id,

          provider_path,

          document_name,

          item_type,

          portal_category,

          workflow_status,

          client_visible,

          owner_user_id,

          created_by_user_id,

          review_requested_by_user_id,

          review_requested_at,

          review_assigned_user_id,

          review_work_item_id,

          reviewed_by_user_id,

          reviewed_at,

          approved_by_user_id,

          approved_at,

          released_by_user_id,

          released_at,

          last_activity_text,

          created_at,

          updated_at

        `

      )

      .eq("organisation_id", organisationId)

      .eq("client_id", clientId)

      .eq("provider_id", mapping.provider_id)

      .order("updated_at", { ascending: false });

    if (path) {

      const normalised = normalisePath(path);

      if (!isInsideRoot(mapping.folder_path, normalised)) {

        return NextResponse.json(

          { error: "Requested path is outside the client document root." },

          { status: 403 }

        );

      }

      query = query.eq("provider_path", normalised);

    }

    const { data, error } = await query;

    if (error) throw error;

    const { data: reviewers, error: reviewersError } = await admin

      .from("user_profiles")

      .select("user_id,full_name,email,role")

      .eq("organisation_id", organisationId)

      .eq("access_enabled", true)

      .eq("can_access_crm", true)

      .order("full_name", { ascending: true });

    if (reviewersError) throw reviewersError;

    return NextResponse.json({

      success: true,

      workflow: (data || []).map(withSuggestedPortalCategory),

      reviewers: reviewers || [],

    });

  } catch (error) {

    console.error("CLIENT DOCUMENT WORKFLOW GET ERROR:", error);

    return NextResponse.json(

      {

        error:

          error instanceof Error

            ? error.message

            : "Could not load document workflow.",

      },

      { status: 500 }

    );

  }

}

export async function POST(

  request: Request,

  context: { params: Promise<{ id: string }> }

) {

  try {

    const { user, profile, response } = await currentContext(request);

    if (response || !profile || !user) return response;

    const { id: clientId } = await context.params;

    const organisationId = profile.organisation_id;

    const { mapping } = await clientProviderContext(

      organisationId,

      clientId

    );

    const body = await request.json().catch(() => ({}));

    const providerPath = normalisePath(

      String(body?.provider_path || "").trim()

    );

    const documentName = String(body?.document_name || "").trim();

    const providerItemId = String(body?.provider_item_id || "").trim() || null;

    const itemType = cleanItemType(body?.item_type);

    if (!providerPath || providerPath === "/") {

      return NextResponse.json(

        { error: "Item path is required." },

        { status: 400 }

      );

    }

    if (!documentName) {

      return NextResponse.json(

        { error: "Item name is required." },

        { status: 400 }

      );

    }

    if (!isInsideRoot(mapping.folder_path, providerPath)) {

      return NextResponse.json(

        { error: "Item is outside the client document root." },

        { status: 403 }

      );

    }

    const { data: existingWorkflow, error: existingWorkflowError } = await admin

      .from("crm_document_workflow")

      .select("*")

      .eq("organisation_id", organisationId)

      .eq("client_id", clientId)

      .eq("provider_id", mapping.provider_id)

      .eq("provider_path", providerPath)

      .maybeSingle();

    if (existingWorkflowError) throw existingWorkflowError;

    let data: any;

    if (existingWorkflow) {

      const { data: updatedWorkflow, error: updateError } = await admin

        .from("crm_document_workflow")

        .update({

          provider_item_id: providerItemId,

          document_name: documentName,

          item_type: itemType,

          portal_category:

            existingWorkflow.portal_category ||

            suggestPortalCategory(providerPath, documentName),

          last_activity_text:

            itemType === "folder"

              ? existingWorkflow.last_activity_text ||

                "Folder registered in PracticePilot workflow."

              : existingWorkflow.last_activity_text ||

                "Document registered in PracticePilot workflow.",

        })

        .eq("id", existingWorkflow.id)

        .select("*")

        .single();

      if (updateError) throw updateError;

      data = updatedWorkflow;

    } else {

      const { data: insertedWorkflow, error: insertError } = await admin

        .from("crm_document_workflow")

        .insert({

          organisation_id: organisationId,

          client_id: clientId,

          provider_id: mapping.provider_id,

          provider_item_id: providerItemId,

          provider_path: providerPath,

          document_name: documentName,

          item_type: itemType,

          portal_category: suggestPortalCategory(providerPath, documentName),

          workflow_status: "stored",

          client_visible: false,

          created_by_user_id: user.id,

          last_activity_text:

            itemType === "folder"

              ? "Folder registered in PracticePilot workflow."

              : "Document added to PracticePilot workflow.",

        })

        .select("*")

        .single();

      if (insertError) throw insertError;

      data = insertedWorkflow;

    }

    return NextResponse.json({

      success: true,

      workflow: withSuggestedPortalCategory(data),

    });

  } catch (error) {

    console.error("CLIENT DOCUMENT WORKFLOW POST ERROR:", error);

    return NextResponse.json(

      {

        error:

          error instanceof Error

            ? error.message

            : "Could not register document workflow.",

      },

      { status: 500 }

    );

  }

}

function localDateInJohannesburg() {

  return new Intl.DateTimeFormat("en-CA", {

    timeZone: "Africa/Johannesburg",

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

  }).format(new Date());

}

async function validReviewer(

  organisationId: string,

  reviewerUserId: string

) {

  const { data, error } = await admin

    .from("user_profiles")

    .select("user_id,full_name,email,access_enabled,can_access_crm")

    .eq("organisation_id", organisationId)

    .eq("user_id", reviewerUserId)

    .eq("access_enabled", true)

    .eq("can_access_crm", true)

    .maybeSingle();

  if (error) throw error;

  return data || null;

}

async function createOrRefreshReviewWorkItem(args: {

  organisationId: string;

  clientId: string;

  workflow: any;

  reviewerUserId: string;

  requestedByUserId: string;

  dueDate: string;

}) {

  const {

    organisationId,

    clientId,

    workflow,

    reviewerUserId,

    requestedByUserId,

    dueDate,

  } = args;

  const itemType = cleanItemType(workflow.item_type);

  const itemLabel = itemType === "folder" ? "folder pack" : "document";

  const payload = {

    organisation_id: organisationId,

    client_id: clientId,

    title: `Review ${itemLabel} — ${workflow.document_name}`,

    description:

      `PP_DOCUMENT_REVIEW_PATH:${workflow.provider_path}\n\n` +

      `Review ${itemLabel} ${workflow.document_name} in the PracticePilot Documents workspace.`,

    work_type: "workflow_action",

    status: "not_started",

    priority: "normal",

    assigned_user_id: reviewerUserId,

    created_by_user_id: requestedByUserId,

    due_date: dueDate,

    start_at: null,

    end_at: null,

    is_all_day: true,

    is_personal: false,

    waiting_on: null,

    waiting_since: null,

    workflow_type: "document_review",

    workflow_id: workflow.id,

    workflow_stage: "awaiting_review",

    service_code: "Document Review",

    source_module: "documents",

    completed_at: null,

    cancelled_at: null,

  };

  if (workflow.review_work_item_id) {

    const { data, error } = await admin

      .from("crm_work_items")

      .update(payload)

      .eq("id", workflow.review_work_item_id)

      .select("id")

      .maybeSingle();

    if (error) throw error;

    if (data?.id) return data.id;

  }

  const { data, error } = await admin

    .from("crm_work_items")

    .insert(payload)

    .select("id")

    .single();

  if (error) throw error;

  return data.id as string;

}

async function completeReviewWorkItem(workItemId: string | null | undefined) {

  if (!workItemId) return;

  const { error } = await admin

    .from("crm_work_items")

    .update({

      status: "completed",

      completed_at: new Date().toISOString(),

      workflow_stage: "review_completed",

    })

    .eq("id", workItemId);

  if (error) throw error;

}

export async function PATCH(

  request: Request,

  context: { params: Promise<{ id: string }> }

) {

  try {

    const { user, profile, response } = await currentContext(request);

    if (response || !profile || !user) return response;

    const { id: clientId } = await context.params;

    const organisationId = profile.organisation_id;

    const { mapping } = await clientProviderContext(

      organisationId,

      clientId

    );

    const body = await request.json().catch(() => ({}));

    const providerPath = normalisePath(

      String(body?.provider_path || "").trim()

    );

    if (!providerPath || providerPath === "/") {

      return NextResponse.json(

        { error: "Item path is required." },

        { status: 400 }

      );

    }

    if (!isInsideRoot(mapping.folder_path, providerPath)) {

      return NextResponse.json(

        { error: "Item is outside the client document root." },

        { status: 403 }

      );

    }

    const { data: existing, error: existingError } = await admin

      .from("crm_document_workflow")

      .select("*")

      .eq("organisation_id", organisationId)

      .eq("client_id", clientId)

      .eq("provider_id", mapping.provider_id)

      .eq("provider_path", providerPath)

      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {

      return NextResponse.json(

        {

          error:

            "This item has not yet been registered in the PracticePilot workflow.",

        },

        { status: 404 }

      );

    }

    const action = String(body?.action || "").trim().toLowerCase();

    const requestedItemType =

      body?.item_type === undefined || body?.item_type === null

        ? cleanItemType(existing.item_type)

        : cleanItemType(body.item_type);

    const now = new Date().toISOString();

    if (action === "set_portal_category") {

      const portalCategory = cleanPortalCategory(body?.portal_category);

      const { data, error } = await admin

        .from("crm_document_workflow")

        .update({

          item_type: requestedItemType,

          portal_category: portalCategory,

          last_activity_text: `Client portal category changed to ${portalCategory.replaceAll(

            "_",

            " "

          )}.`,

        })

        .eq("id", existing.id)

        .select("*")

        .single();

      if (error) throw error;

      return NextResponse.json({

        success: true,

        workflow: withSuggestedPortalCategory(data),

      });

    }

    if (action === "release_from_folder_pack") {
      const folderPackPath = normalisePath(
        String(body?.folder_pack_path || "").trim()
      );

      if (!folderPackPath || folderPackPath === "/") {
        return NextResponse.json(
          { error: "Folder pack path is required." },
          { status: 400 }
        );
      }

      if (
        providerPath === folderPackPath ||
        !providerPath.startsWith(`${folderPackPath}/`)
      ) {
        return NextResponse.json(
          { error: "This item is not inside the selected folder pack." },
          { status: 409 }
        );
      }

      const { data: folderPack, error: folderPackError } = await admin
        .from("crm_document_workflow")
        .select("*")
        .eq("organisation_id", organisationId)
        .eq("client_id", clientId)
        .eq("provider_id", mapping.provider_id)
        .eq("provider_path", folderPackPath)
        .eq("item_type", "folder")
        .maybeSingle();

      if (folderPackError) throw folderPackError;

      if (
        !folderPack ||
        folderPack.workflow_status !== "approved" ||
        folderPack.client_visible !== true
      ) {
        return NextResponse.json(
          {
            error:
              "The parent folder pack must be approved and released before its contents can be released.",
          },
          { status: 409 }
        );
      }

      const portalCategory =
        body?.portal_category != null
          ? cleanPortalCategory(body.portal_category)
          : folderPack.portal_category
            ? cleanPortalCategory(folderPack.portal_category)
            : suggestPortalCategory(
                String(folderPack.provider_path || ""),
                String(folderPack.document_name || "")
              );

      if (existing.review_work_item_id) {
        await completeReviewWorkItem(existing.review_work_item_id);
      }

      const { data, error } = await admin
        .from("crm_document_workflow")
        .update({
          item_type: requestedItemType,
          portal_category: portalCategory,
          workflow_status: "approved",
          reviewed_by_user_id:
            folderPack.reviewed_by_user_id || existing.reviewed_by_user_id,
          reviewed_at:
            folderPack.reviewed_at || existing.reviewed_at || now,
          approved_by_user_id:
            folderPack.approved_by_user_id || user.id,
          approved_at:
            folderPack.approved_at || now,
          client_visible: true,
          released_by_user_id: user.id,
          released_at: now,
          last_activity_text:
            requestedItemType === "folder"
              ? `Released as part of approved folder pack ${folderPack.document_name}.`
              : `Approved and released as part of folder pack ${folderPack.document_name}.`,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        workflow: withSuggestedPortalCategory(data),
      });
    }

    if (action === "release") {

      const itemType = requestedItemType;

      if (existing.workflow_status !== "approved") {

        return NextResponse.json(

          {

            error:

              itemType === "folder"

                ? "Only an approved folder pack can be released to the client."

                : "Only an approved document can be released to the client.",

          },

          { status: 409 }

        );

      }

      const portalCategory = existing.portal_category

        ? cleanPortalCategory(existing.portal_category)

        : suggestPortalCategory(

            String(existing.provider_path || ""),

            String(existing.document_name || "")

          );

      const { data, error } = await admin

        .from("crm_document_workflow")

        .update({

          item_type: itemType,

          portal_category: portalCategory,

          workflow_status: existing.workflow_status,

          approved_by_user_id: existing.approved_by_user_id,

          approved_at: existing.approved_at,

          client_visible: true,

          released_by_user_id: user.id,

          released_at: now,

          last_activity_text:

            itemType === "folder"

              ? "Approved folder pack released to the client. Document approval remains separate."

              : "Approved document released to the client.",

        })

        .eq("id", existing.id)

        .select("*")

        .single();

      if (error) throw error;

      return NextResponse.json({

        success: true,

        workflow: withSuggestedPortalCategory(data),

      });

    }

    if (action === "unrelease") {

      const { data, error } = await admin

        .from("crm_document_workflow")

        .update({

          item_type: requestedItemType,

          client_visible: false,

          released_by_user_id: null,

          released_at: null,

          last_activity_text:

          requestedItemType === "folder"

            ? "Client access removed from the folder."

            : "Client access removed from the document.",

        })

        .eq("id", existing.id)

        .select("*")

        .single();

      if (error) throw error;

      return NextResponse.json({

        success: true,

        workflow: withSuggestedPortalCategory(data),

      });

    }

    const nextStatus = cleanStatus(body?.workflow_status);

    const update: Record<string, unknown> = {

      item_type: requestedItemType,

      workflow_status: nextStatus,

      last_activity_text: `Workflow changed to ${nextStatus.replaceAll(

        "_",

        " "

      )}.`,

    };

    if (nextStatus === "awaiting_review") {

      const reviewerUserId = String(

        body?.reviewer_user_id ||

          existing.review_assigned_user_id ||

          ""

      ).trim();

      if (!reviewerUserId) {

        return NextResponse.json(

          { error: "Choose a reviewer before requesting review." },

          { status: 400 }

        );

      }

      const reviewer = await validReviewer(

        organisationId,

        reviewerUserId

      );

      if (!reviewer) {

        return NextResponse.json(

          { error: "The selected reviewer is not an active CRM user in this practice." },

          { status: 400 }

        );

      }

      const dueDate = String(

        body?.review_due_date || localDateInJohannesburg()

      ).trim();

      const workItemId = await createOrRefreshReviewWorkItem({

        organisationId,

        clientId,

        workflow: existing,

        reviewerUserId,

        requestedByUserId: user.id,

        dueDate,

      });

      update.review_requested_by_user_id = user.id;

      update.review_requested_at = now;

      update.review_assigned_user_id = reviewerUserId;

      update.review_work_item_id = workItemId;

      update.reviewed_by_user_id = null;

      update.reviewed_at = null;

      update.approved_by_user_id = null;

      update.approved_at = null;

      update.client_visible = false;

      update.released_by_user_id = null;

      update.released_at = null;

      update.last_activity_text = `Review requested from ${

        reviewer.full_name || reviewer.email || "reviewer"

      }.`;

    }

    if (nextStatus === "reviewed") {

      await completeReviewWorkItem(existing.review_work_item_id);

      update.reviewed_by_user_id = user.id;

      update.reviewed_at = now;

      update.client_visible = false;

      update.released_by_user_id = null;

      update.released_at = null;

      update.last_activity_text = requestedItemType === "folder" ? "Folder pack review completed." : "Document review completed.";

    }

    if (nextStatus === "approved") {

      update.approved_by_user_id = user.id;

      update.approved_at = now;

    }

    if (nextStatus === "rejected") {

      await completeReviewWorkItem(existing.review_work_item_id);

      update.client_visible = false;

      update.released_by_user_id = null;

      update.released_at = null;

      update.last_activity_text = requestedItemType === "folder" ? "Folder pack review rejected." : "Document review rejected.";

    }

    if (nextStatus === "stored") {

      update.client_visible = false;

      update.review_requested_by_user_id = null;

      update.review_requested_at = null;

      update.review_assigned_user_id = null;

      update.review_work_item_id = null;

      update.reviewed_by_user_id = null;

      update.reviewed_at = null;

      update.approved_by_user_id = null;

      update.approved_at = null;

      update.released_by_user_id = null;

      update.released_at = null;

    }

    const { data, error } = await admin

      .from("crm_document_workflow")

      .update(update)

      .eq("id", existing.id)

      .select("*")

      .single();

    if (error) throw error;

    return NextResponse.json({

      success: true,

      workflow: data,

    });

  } catch (error) {

    console.error("CLIENT DOCUMENT WORKFLOW PATCH ERROR:", error);

    return NextResponse.json(

      {

        error:

          error instanceof Error

            ? error.message

            : "Could not update document workflow.",

      },

      { status: 500 }

    );

  }

}
