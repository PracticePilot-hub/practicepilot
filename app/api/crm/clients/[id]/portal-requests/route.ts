// Path: app/api/crm/clients/[id]/portal-requests/route.ts



import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import nodemailer from "nodemailer";



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

      "id,user_id,organisation_id,access_enabled,can_access_crm"

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



  return { user, profile, response: null };

}



async function assertClient(

  organisationId: string,

  clientId: string

) {

  const { data: client, error } = await admin

    .from("crm_clients")

    .select("id,client_name")

    .eq("id", clientId)

    .eq("organisation_id", organisationId)

    .maybeSingle();



  if (error) throw error;

  if (!client) throw new Error("Client not found.");



  return client;

}



const allowedTypes = new Set([

  "document_request",

  "approval",

  "confirmation",

  "question",

]);



const allowedStatuses = new Set([

  "new",

  "in_progress",

  "submitted",

  "completed",

  "cancelled",

]);



const allowedPriorities = new Set([

  "low",

  "normal",

  "high",

  "urgent",

]);



function getSmtpConfig() {

  const host = process.env.SMTP_HOST;

  const port = Number(process.env.SMTP_PORT || 587);

  const user = process.env.SMTP_USER;

  const pass = process.env.SMTP_PASS;

  const fromName = process.env.SMTP_FROM_NAME || "PracticePilot";

  const fromEmail = process.env.SMTP_FROM_EMAIL || user;



  if (!host || !user || !pass || !fromEmail) {

    throw new Error("Missing SMTP configuration.");

  }



  return { host, port, user, pass, fromName, fromEmail };

}



function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendRequestEmail(args: {

  to: string[];

  clientName: string;

  requestTitle: string;

  description: string | null;

  dueDate: string | null;

  loginUrl: string;

}) {

  if (!args.to.length) return;



  const smtp = getSmtpConfig();

  const transporter = nodemailer.createTransport({

    host: smtp.host,

    port: smtp.port,

    secure: smtp.port === 465,

    auth: {

      user: smtp.user,

      pass: smtp.pass,

    },

  });



  const dueLine = args.dueDate

    ? `<p><strong>Due date:</strong> ${escapeHtml(args.dueDate)}</p>`

    : "";



  const descriptionLine = args.description

    ? `<p>${escapeHtml(args.description)}</p>`

    : "";



  await transporter.sendMail({

    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,

    to: args.to.join(","),

    subject: `${args.clientName} — new PracticePilot request`,

    html: `

      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10233A;max-width:620px;margin:0 auto;">

        <div style="padding:22px 0;border-bottom:1px solid #D5DDE6;">

          <div style="font-size:22px;font-weight:800;">PracticePilot</div>

        </div>

        <div style="padding:24px 0;">

          <p>Hi,</p>

          <p>Your accounting team has added a new request for <strong>${escapeHtml(

            args.clientName

          )}</strong>.</p>

          <div style="margin:18px 0;padding:16px;border:1px solid #DCE4EC;background:#F7FAFC;">

            <div style="font-size:16px;font-weight:800;margin-bottom:8px;">

              ${escapeHtml(args.requestTitle)}

            </div>

            ${descriptionLine}

            ${dueLine}

          </div>

          <p>Please sign in to your PracticePilot Client Portal to complete the request.</p>

          <p style="margin:24px 0;">

            <a

              href="${args.loginUrl}"

              style="display:inline-block;background:#1768D2;color:#FFFFFF;text-decoration:none;padding:12px 18px;font-weight:700;"

            >

              Open PracticePilot

            </a>

          </p>

          <p style="font-size:13px;color:#64748B;">

            You can reuse the normal PracticePilot login page whenever you need to return to your portal.

          </p>

        </div>

      </div>

    `,

  });

}



async function requestRecipients(args: {

  organisationId: string;

  clientId: string;

  assignedPortalUserId: string | null;

}) {

  let recipients: Array<{ email: string | null }> = [];



  if (args.assignedPortalUserId) {

    const { data: assignedUser, error } = await admin

      .from("crm_client_portal_users")

      .select("email")

      .eq("id", args.assignedPortalUserId)

      .eq("organisation_id", args.organisationId)

      .eq("client_id", args.clientId)

      .eq("is_active", true)

      .maybeSingle();



    if (error) throw error;

    if (assignedUser) recipients = [assignedUser];

  } else {

    const { data: clientUsers, error } = await admin

      .from("crm_client_portal_users")

      .select("email")

      .eq("organisation_id", args.organisationId)

      .eq("client_id", args.clientId)

      .eq("is_active", true);



    if (error) throw error;

    recipients = clientUsers || [];

  }



  return Array.from(

    new Set(

      recipients

        .map((item) => String(item.email || "").trim().toLowerCase())

        .filter((email) => email.includes("@"))

    )

  );

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



    await assertClient(organisationId, clientId);



    const [

      { data: requests, error: requestsError },

      { data: portalUsers, error: portalUsersError },

    ] = await Promise.all([

      admin

        .from("crm_client_portal_requests")

        .select(

          "id,organisation_id,client_id,request_type,title,description,due_date,status,priority,assigned_portal_user_id,requires_upload,requires_response,requires_approval,upload_provider_id,upload_folder_path,upload_folder_name,response_text,submitted_at,completed_at,created_by_user_id,created_at,updated_at"

        )

        .eq("organisation_id", organisationId)

        .eq("client_id", clientId)

        .order("status", { ascending: true })

        .order("due_date", { ascending: true, nullsFirst: false })

        .order("created_at", { ascending: false }),



      admin

        .from("crm_client_portal_users")

        .select(

          "id,full_name,email,portal_role,is_active,invitation_status"

        )

        .eq("organisation_id", organisationId)

        .eq("client_id", clientId)

        .eq("is_active", true)

        .order("portal_role", { ascending: true })

        .order("full_name", { ascending: true, nullsFirst: false }),

    ]);



    if (requestsError) throw requestsError;

    if (portalUsersError) throw portalUsersError;



    return NextResponse.json({

      success: true,

      requests: requests || [],

      portal_users: portalUsers || [],

    });

  } catch (error) {

    console.error("PORTAL REQUESTS GET ERROR:", error);



    return NextResponse.json(

      {

        error:

          error instanceof Error

            ? error.message

            : "Could not load portal requests.",

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



    const client = await assertClient(organisationId, clientId);



    const body = await request.json().catch(() => ({}));



    const requestType = String(body?.request_type || "").trim();

    const title = String(body?.title || "").trim();

    const description =

      String(body?.description || "").trim() || null;

    const dueDate =

      String(body?.due_date || "").trim() || null;

    const priority = String(body?.priority || "normal").trim();

    const assignedPortalUserId =

      String(body?.assigned_portal_user_id || "").trim() || null;

    const uploadProviderId =

      String(body?.upload_provider_id || "").trim() || null;

    const uploadFolderPath =

      String(body?.upload_folder_path || "").trim() || null;

    const uploadFolderName =

      String(body?.upload_folder_name || "").trim() || null;

    const notifyClient = true;



    if (!allowedTypes.has(requestType)) {

      return NextResponse.json(

        { error: "Choose a valid request type." },

        { status: 400 }

      );

    }



    if (!title) {

      return NextResponse.json(

        { error: "Request title is required." },

        { status: 400 }

      );

    }



    if (!allowedPriorities.has(priority)) {

      return NextResponse.json(

        { error: "Choose a valid priority." },

        { status: 400 }

      );

    }



    if (assignedPortalUserId) {

      const { data: portalUser, error: portalUserError } = await admin

        .from("crm_client_portal_users")

        .select("id")

        .eq("id", assignedPortalUserId)

        .eq("organisation_id", organisationId)

        .eq("client_id", clientId)

        .eq("is_active", true)

        .maybeSingle();



      if (portalUserError) throw portalUserError;



      if (!portalUser) {

        return NextResponse.json(

          { error: "Selected portal user could not be found." },

          { status: 404 }

        );

      }

    }



    const now = new Date().toISOString();



    const { data, error } = await admin

      .from("crm_client_portal_requests")

      .insert({

        organisation_id: organisationId,

        client_id: clientId,

        request_type: requestType,

        title,

        description,

        due_date: dueDate,

        status: "new",

        priority,

        assigned_portal_user_id: assignedPortalUserId,

        requires_upload: body?.requires_upload === true,

        requires_response: body?.requires_response === true,

        requires_approval: body?.requires_approval === true,

        upload_provider_id: uploadProviderId,

        upload_folder_path: uploadFolderPath,

        upload_folder_name: uploadFolderName,

        created_by_user_id: user.id,

        created_at: now,

        updated_at: now,

      })

      .select(

        "id,organisation_id,client_id,request_type,title,description,due_date,status,priority,assigned_portal_user_id,requires_upload,requires_response,requires_approval,upload_provider_id,upload_folder_path,upload_folder_name,response_text,submitted_at,completed_at,created_by_user_id,created_at,updated_at"

      )

      .single();



    if (error) throw error;



    let notificationSent = false;

    let notificationError: string | null = null;



    if (notifyClient) {

      try {

        const emails = await requestRecipients({

          organisationId,

          clientId,

          assignedPortalUserId,

        });



        const origin = new URL(request.url).origin.replace(/\/+$/, "");



        await sendRequestEmail({

          to: emails,

          clientName: client.client_name,

          requestTitle: title,

          description,

          dueDate,

          loginUrl: `${origin}/login`,

        });



        notificationSent = emails.length > 0;

      } catch (caught) {

        console.error("PORTAL REQUEST EMAIL ERROR:", caught);

        notificationError =

          caught instanceof Error

            ? caught.message

            : "Could not send request notification.";

      }

    }



    return NextResponse.json({

      success: true,

      request: data,

      notification_sent: notificationSent,

      notification_error: notificationError,

    });

  } catch (error) {

    console.error("PORTAL REQUESTS POST ERROR:", error);



    return NextResponse.json(

      {

        error:

          error instanceof Error

            ? error.message

            : "Could not create the portal request.",

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

    const { profile, response } = await currentContext(request);

    if (response || !profile) return response;



    const { id: clientId } = await context.params;

    const organisationId = profile.organisation_id;



    await assertClient(organisationId, clientId);



    const body = await request.json().catch(() => ({}));

    const requestId = String(body?.request_id || "").trim();



    if (!requestId) {

      return NextResponse.json(

        { error: "Request ID is required." },

        { status: 400 }

      );

    }



    if (body?.action === "resend_email") {

      const { data: existing, error: existingError } = await admin

        .from("crm_client_portal_requests")

        .select(

          "id,title,description,due_date,assigned_portal_user_id"

        )

        .eq("id", requestId)

        .eq("organisation_id", organisationId)

        .eq("client_id", clientId)

        .maybeSingle();



      if (existingError) throw existingError;



      if (!existing) {

        return NextResponse.json(

          { error: "Portal request not found." },

          { status: 404 }

        );

      }



      const client = await assertClient(organisationId, clientId);

      const emails = await requestRecipients({

        organisationId,

        clientId,

        assignedPortalUserId: existing.assigned_portal_user_id,

      });



      if (!emails.length) {

        return NextResponse.json(

          { error: "No active portal email recipient is available." },

          { status: 409 }

        );

      }



      const origin = new URL(request.url).origin.replace(/\/+$/, "");



      await sendRequestEmail({

        to: emails,

        clientName: client.client_name,

        requestTitle: existing.title,

        description: existing.description,

        dueDate: existing.due_date,

        loginUrl: `${origin}/login`,

      });



      return NextResponse.json({

        success: true,

        notification_sent: true,

      });

    }



    const update: Record<string, unknown> = {

      updated_at: new Date().toISOString(),

    };



    if (typeof body?.title === "string") {

      const title = body.title.trim();



      if (!title) {

        return NextResponse.json(

          { error: "Request title is required." },

          { status: 400 }

        );

      }



      update.title = title;

    }



    if (typeof body?.description === "string") {

      update.description = body.description.trim() || null;

    }



    if (typeof body?.due_date === "string") {

      update.due_date = body.due_date.trim() || null;

    }



    if (typeof body?.request_type === "string") {

      if (!allowedTypes.has(body.request_type)) {

        return NextResponse.json(

          { error: "Choose a valid request type." },

          { status: 400 }

        );

      }



      update.request_type = body.request_type;

    }



    if (typeof body?.priority === "string") {

      if (!allowedPriorities.has(body.priority)) {

        return NextResponse.json(

          { error: "Choose a valid priority." },

          { status: 400 }

        );

      }



      update.priority = body.priority;

    }



    if (typeof body?.status === "string") {

      if (!allowedStatuses.has(body.status)) {

        return NextResponse.json(

          { error: "Choose a valid status." },

          { status: 400 }

        );

      }



      update.status = body.status;



      if (body.status === "completed") {

        update.completed_at = new Date().toISOString();

      }



      if (body.status !== "completed") {

        update.completed_at = null;

      }

    }



    if ("assigned_portal_user_id" in body) {

      const assignedPortalUserId =

        String(body?.assigned_portal_user_id || "").trim() || null;



      if (assignedPortalUserId) {

        const { data: portalUser, error: portalUserError } = await admin

          .from("crm_client_portal_users")

          .select("id")

          .eq("id", assignedPortalUserId)

          .eq("organisation_id", organisationId)

          .eq("client_id", clientId)

          .eq("is_active", true)

          .maybeSingle();



        if (portalUserError) throw portalUserError;



        if (!portalUser) {

          return NextResponse.json(

            { error: "Selected portal user could not be found." },

            { status: 404 }

          );

        }

      }



      update.assigned_portal_user_id = assignedPortalUserId;

    }



    if (typeof body?.requires_upload === "boolean") {

      update.requires_upload = body.requires_upload;

    }



    if (typeof body?.requires_response === "boolean") {

      update.requires_response = body.requires_response;

    }



    if (typeof body?.requires_approval === "boolean") {

      update.requires_approval = body.requires_approval;

    }



    if ("upload_provider_id" in body) {

      update.upload_provider_id =

        String(body?.upload_provider_id || "").trim() || null;

    }



    if ("upload_folder_path" in body) {

      update.upload_folder_path =

        String(body?.upload_folder_path || "").trim() || null;

    }



    if ("upload_folder_name" in body) {

      update.upload_folder_name =

        String(body?.upload_folder_name || "").trim() || null;

    }



    const { data, error } = await admin

      .from("crm_client_portal_requests")

      .update(update)

      .eq("id", requestId)

      .eq("organisation_id", organisationId)

      .eq("client_id", clientId)

      .select(

        "id,organisation_id,client_id,request_type,title,description,due_date,status,priority,assigned_portal_user_id,requires_upload,requires_response,requires_approval,upload_provider_id,upload_folder_path,upload_folder_name,response_text,submitted_at,completed_at,created_by_user_id,created_at,updated_at"

      )

      .maybeSingle();



    if (error) throw error;



    if (!data) {

      return NextResponse.json(

        { error: "Portal request not found." },

        { status: 404 }

      );

    }



    return NextResponse.json({

      success: true,

      request: data,

    });

  } catch (error) {

    console.error("PORTAL REQUESTS PATCH ERROR:", error);



    return NextResponse.json(

      {

        error:

          error instanceof Error

            ? error.message

            : "Could not update the portal request.",

      },

      { status: 500 }

    );

  }

}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    await assertClient(organisationId, clientId);

    const body = await request.json().catch(() => ({}));
    const requestId = String(body?.request_id || "").trim();

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await admin
      .from("crm_client_portal_requests")
      .select("id")
      .eq("id", requestId)
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json(
        { error: "Portal request not found." },
        { status: 404 }
      );
    }

    const { error: deleteError } = await admin
      .from("crm_client_portal_requests")
      .delete()
      .eq("id", requestId)
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      deleted_request_id: requestId,
    });
  } catch (error) {
    console.error("PORTAL REQUESTS DELETE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not delete the portal request.",
      },
      { status: 500 }
    );
  }
}

