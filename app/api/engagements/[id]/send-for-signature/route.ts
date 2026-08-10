// Path: app/api/engagements/[id]/send-for-signature/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing server Supabase service role key.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearer(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function globalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function baseUrl(request: Request) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configured) {
    return (configured.startsWith("http") ? configured : `https://${configured}`)
      .replace(/\/+$/, "");
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request, context: any) {
  const supabase = admin();

  try {
    const params = await context.params;
    const engagementId = String(params?.id || "");
    const token = bearer(request);

    if (!engagementId) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id,email,full_name,role,organisation_id,access_enabled")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile || !profile.access_enabled) {
      return NextResponse.json(
        { success: false, error: "Could not load active user profile." },
        { status: 403 }
      );
    }

    const { data: engagement, error: engagementError } = await supabase
      .from("engagements")
      .select(
        "id,organisation_id,engagement_number,client_name,contact_name,contact_email,status,locked_at"
      )
      .eq("id", engagementId)
      .single();

    if (engagementError || !engagement) {
      return NextResponse.json(
        { success: false, error: "Engagement not found." },
        { status: 404 }
      );
    }

    if (
      !globalAdmin(profile.role) &&
      profile.organisation_id !== engagement.organisation_id
    ) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this engagement." },
        { status: 403 }
      );
    }

    if (engagement.locked_at) {
      return NextResponse.json(
        { success: false, error: "This engagement is already signed and locked." },
        { status: 409 }
      );
    }

    if (engagement.status !== "Draft") {
      return NextResponse.json(
        {
          success: false,
          error: "Only a Draft engagement can be sent for signature.",
        },
        { status: 409 }
      );
    }

    const { count, error: countError } = await supabase
      .from("engagement_clauses")
      .select("id", { count: "exact", head: true })
      .eq("engagement_id", engagementId);

    if (countError) throw countError;

    if (!count) {
      return NextResponse.json(
        {
          success: false,
          error: "Apply Legal Terms before sending for signature.",
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const recipientName = String(
      body?.recipientName || engagement.contact_name || ""
    ).trim();

    const recipientEmail = String(
      body?.recipientEmail || engagement.contact_email || ""
    )
      .trim()
      .toLowerCase();

    if (!recipientName) {
      return NextResponse.json(
        { success: false, error: "Recipient name is required." },
        { status: 400 }
      );
    }

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid recipient email is required." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("engagement_signature_requests")
      .select("id,token,recipient_name,recipient_email,expires_at,status")
      .eq("engagement_id", engagementId)
      .in("status", ["Pending", "Opened"])
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return NextResponse.json({
        success: true,
        existing: true,
        signature_request_id: existing.id,
        recipient_name: existing.recipient_name,
        recipient_email: existing.recipient_email,
        expires_at: existing.expires_at,
        signing_url: `${baseUrl(request)}/sign/engagement/${existing.token}`,
      });
    }

    const now = new Date().toISOString();

    const { data: signatureRequest, error: signatureError } = await supabase
      .from("engagement_signature_requests")
      .insert({
        engagement_id: engagementId,
        organisation_id: engagement.organisation_id,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        status: "Pending",
        sent_at: now,
        created_by: profile.id,
      })
      .select("id,token,recipient_name,recipient_email,expires_at,status")
      .single();

    if (signatureError || !signatureRequest) {
      throw signatureError || new Error("Could not create signature request.");
    }

    const { data: updated, error: updateError } = await supabase
      .from("engagements")
      .update({ status: "Sent", sent_at: now })
      .eq("id", engagementId)
      .select("*")
      .single();

    if (updateError || !updated) {
      await supabase
        .from("engagement_signature_requests")
        .delete()
        .eq("id", signatureRequest.id);

      throw updateError || new Error("Could not update engagement status.");
    }

    await supabase.from("engagement_events").insert({
      engagement_id: engagementId,
      organisation_id: engagement.organisation_id,
      event_type: "Sent for Signature",
      from_status: "Draft",
      to_status: "Sent",
      event_description: `Engagement issued for signature to ${recipientName} (${recipientEmail}).`,
      event_payload: {
        signature_request_id: signatureRequest.id,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        expires_at: signatureRequest.expires_at,
      },
      performed_by: profile.id,
      performed_by_name: profile.full_name || profile.email,
      performed_by_email: profile.email,
    });

    return NextResponse.json({
      success: true,
      existing: false,
      engagement: updated,
      signature_request_id: signatureRequest.id,
      recipient_name: signatureRequest.recipient_name,
      recipient_email: signatureRequest.recipient_email,
      expires_at: signatureRequest.expires_at,
      signing_url: `${baseUrl(request)}/sign/engagement/${signatureRequest.token}`,
    });
  } catch (error: any) {
    console.error("SEND ENGAGEMENT FOR SIGNATURE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to send engagement for signature.",
      },
      { status: 500 }
    );
  }
}
