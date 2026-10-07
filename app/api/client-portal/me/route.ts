// Path: app/api/client-portal/me/route.ts



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



function categoryLabel(value: string | null | undefined) {

  const labels: Record<string, string> = {

    financial_statements: "Financial Statements",

    tax: "Tax",

    management_accounts: "Management Accounts",

    vat: "VAT",

    payroll: "Payroll",

    secretarial: "Secretarial",

    company_documents: "Company Documents",

    agreements_contracts: "Agreements & Contracts",

    general: "General",

  };



  return labels[String(value || "")] || "General";

}



export async function GET(request: Request) {

  try {

    const token = bearerToken(request);



    if (!token) {

      return NextResponse.json(

        { error: "Not authenticated." },

        { status: 401 }

      );

    }



    const {

      data: { user },

      error: authError,

    } = await admin.auth.getUser(token);



    if (authError || !user) {

      return NextResponse.json(

        { error: "Not authenticated." },

        { status: 401 }

      );

    }



    const email = String(user.email || "")

      .trim()

      .toLowerCase();



    const url = new URL(request.url);

    const requestedClientId = String(

      url.searchParams.get("client") || ""

    ).trim();



    let { data: accessRows, error: accessError } = await admin

      .from("crm_client_portal_users")

      .select(

        "id,organisation_id,client_id,full_name,email,portal_role,can_view_documents,can_approve_actions,is_active,invitation_status,accepted_at"

      )

      .eq("auth_user_id", user.id)

      .eq("is_active", true);



    if (accessError) throw accessError;



    if (email) {

      const { data: emailAccessRows, error: emailAccessError } = await admin

        .from("crm_client_portal_users")

        .select(

          "id,organisation_id,client_id,full_name,email,portal_role,can_view_documents,can_approve_actions,is_active,invitation_status,accepted_at"

        )

        .ilike("email", email)

        .eq("is_active", true);



      if (emailAccessError) throw emailAccessError;



      const merged = new Map<string, any>();



      for (const row of accessRows || []) {

        merged.set(row.id, row);

      }



      for (const row of emailAccessRows || []) {

        merged.set(row.id, row);

      }



      accessRows = Array.from(merged.values());



      const rowsToLink = (emailAccessRows || []).filter(

        (row) =>

          !(accessRows || []).some(

            (linked) =>

              linked.id === row.id &&

              String((linked as any).auth_user_id || "") === user.id

          )

      );



      if ((emailAccessRows || []).length) {

        const repairNow = new Date().toISOString();



        const { error: repairError } = await admin

          .from("crm_client_portal_users")

          .update({

            auth_user_id: user.id,

            invitation_status: "active",

            accepted_at: repairNow,

            last_login_at: repairNow,

            updated_at: repairNow,

          })

          .in(

            "id",

            (emailAccessRows || []).map((row) => row.id)

          );



        if (repairError) throw repairError;

      }

    }



    if (!accessRows?.length) {

      return NextResponse.json(

        { error: "No Client Portal access is linked to this login." },

        { status: 403 }

      );

    }



    const now = new Date().toISOString();



    const rowsNeedingActivation = accessRows.filter(

      (row) => row.invitation_status !== "active"

    );



    if (rowsNeedingActivation.length) {

      const { error: activationError } = await admin

        .from("crm_client_portal_users")

        .update({

          invitation_status: "active",

          accepted_at: now,

          last_login_at: now,

          updated_at: now,

        })

        .in(

          "id",

          rowsNeedingActivation.map((row) => row.id)

        );



      if (activationError) throw activationError;



      for (const row of accessRows) {

        if (row.invitation_status !== "active") {

          row.invitation_status = "active";

          row.accepted_at = row.accepted_at || now;

        }

      }

    }



    const allowedClientIds = Array.from(

      new Set(accessRows.map((row) => row.client_id))

    );



    const clientId =

      requestedClientId && allowedClientIds.includes(requestedClientId)

        ? requestedClientId

        : allowedClientIds[0];



    const access = accessRows.find((row) => row.client_id === clientId)!;



    const { data: clients, error: clientsError } = await admin

      .from("crm_clients")

      .select(

        "id,client_name,trading_name,registration_number,client_code"

      )

      .in("id", allowedClientIds)

      .order("client_name", { ascending: true });



    if (clientsError) throw clientsError;



    const client = (clients || []).find((row) => row.id === clientId);



    if (!client) {

      return NextResponse.json(

        { error: "Client could not be loaded." },

        { status: 404 }

      );

    }



    let documents: any[] = [];



    if (access.can_view_documents) {

      const { data: documentRows, error: documentsError } = await admin

        .from("crm_document_workflow")

        .select(

          "id,provider_path,document_name,item_type,portal_category,workflow_status,client_visible,released_at,approved_at,updated_at"

        )

        .eq("organisation_id", access.organisation_id)

        .eq("client_id", clientId)

        .eq("client_visible", true)


        .order("released_at", { ascending: false, nullsFirst: false });



      if (documentsError) throw documentsError;



      documents = (documentRows || []).map((row: any) => ({

        ...row,

        portal_category: row.portal_category || "general",

        portal_category_label: categoryLabel(row.portal_category),

      }));

    }



    const { data: requestRows, error: requestsError } = await admin

      .from("crm_client_portal_requests")

      .select(

        "id,request_type,title,description,due_date,status,priority,assigned_portal_user_id,requires_upload,requires_response,requires_approval,response_text,submitted_at,completed_at"

      )

      .eq("organisation_id", access.organisation_id)

      .eq("client_id", clientId)

      .or(

        `assigned_portal_user_id.is.null,assigned_portal_user_id.eq.${access.id}`

      )

      .order("due_date", { ascending: true, nullsFirst: false })

      .order("created_at", { ascending: false });



    if (requestsError) throw requestsError;



    const requests = requestRows || [];



    const categoryCounts = documents.reduce(

      (acc: Record<string, number>, row: any) => {

        const key = String(row.portal_category || "general");

        acc[key] = (acc[key] || 0) + 1;

        return acc;

      },

      {}

    );



    const needsAction = requests.filter(

      (item: any) =>

        !["completed", "cancelled", "submitted"].includes(item.status)

    ).length;



    const awaitingOurWork = requests.filter(

      (item: any) => item.status === "submitted"

    ).length;



    await admin

      .from("crm_client_portal_users")

      .update({

        last_login_at: now,

        updated_at: now,

      })

      .eq("id", access.id);



    return NextResponse.json({

      success: true,

      portal_user: {

        full_name: access.full_name,

        email: access.email,

        portal_role: access.portal_role,

        can_view_documents: access.can_view_documents,

        can_approve_actions: access.can_approve_actions,

      },

      client,

      clients: clients || [],

      documents,

      requests,

      counts: {

        total: documents.length,

        needs_action: needsAction,

        awaiting_our_work: awaitingOurWork,

        for_your_records: documents.length,

      },

      category_counts: categoryCounts,

    });

  } catch (error) {

    console.error("CLIENT PORTAL ME ERROR:", error);



    return NextResponse.json(

      {

        error:

          error instanceof Error

            ? error.message

            : "Could not load the Client Portal.",

      },

      { status: 500 }

    );

  }

}
