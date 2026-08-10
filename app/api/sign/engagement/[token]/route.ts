// Path: app/api/sign/engagement/[token]/route.ts

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing server Supabase service role key.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getToken(context: any) {
  const params = await context.params;
  return String(params?.token || "").trim();
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

function normaliseEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function requestExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

async function loadSigningRequest(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  token: string
) {
  const { data, error } = await supabase
    .from("engagement_signature_requests")
    .select(
      `
        id,
        token,
        engagement_id,
        organisation_id,
        recipient_name,
        recipient_email,
        status,
        expires_at,
        sent_at,
        first_opened_at,
        last_opened_at,
        signed_at,
        signed_name,
        signed_capacity,
        signed_email
      `
    )
    .eq("token", token)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

async function loadEngagementBundle(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  engagementId: string
) {
  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select(
      `
        id,
        engagement_number,
        organisation_id,
        client_id,
        proposal_id,
        client_name,
        client_registration_number,
        contact_name,
        contact_email,
        contact_number,
        status,
        contract_start_date,
        contract_end_date,
        contract_months,
        billing_day,
        payment_due_day,
        billing_in_advance,
        monthly_fee,
        fee_is_exclusive_vat,
        vat_rate,
        renewal_method,
        auto_renew,
        special_terms,
        legal_template_version,
        locked_at,
        sent_at,
        signed_at,
        signed_by_name,
        signed_by_capacity,
        signed_by_email
      `
    )
    .eq("id", engagementId)
    .single();

  if (engagementError || !engagement) {
    throw engagementError || new Error("Engagement not found.");
  }

  const [servicesResult, clausesResult, billingResult] = await Promise.all([
    supabase
      .from("engagement_services")
      .select(
        `
          id,
          category,
          service_name,
          description,
          fee_type,
          amount,
          scope_quantity,
          scope_unit,
          client_facing_note,
          sort_order
        `
      )
      .eq("engagement_id", engagementId)
      .order("sort_order", { ascending: true }),

    supabase
      .from("engagement_clauses")
      .select(
        `
          id,
          clause_key,
          category,
          title,
          body,
          clause_version,
          sort_order,
          is_mandatory
        `
      )
      .eq("engagement_id", engagementId)
      .order("sort_order", { ascending: true }),

    supabase
      .from("engagement_billing_schedule")
      .select(
        `
          id,
          sequence_no,
          service_period_start,
          service_period_end,
          invoice_date,
          payment_due_date,
          amount_ex_vat,
          vat_rate,
          vat_amount,
          amount_inc_vat,
          billing_status
        `
      )
      .eq("engagement_id", engagementId)
      .order("sequence_no", { ascending: true }),
  ]);

  if (servicesResult.error) throw servicesResult.error;
  if (clausesResult.error) throw clausesResult.error;
  if (billingResult.error) throw billingResult.error;

  return {
    engagement,
    services: servicesResult.data || [],
    clauses: clausesResult.data || [],
    billing_schedule: billingResult.data || [],
  };
}

function signingSnapshot(bundle: any, signature: any) {
  return {
    engagement: bundle.engagement,
    services: bundle.services,
    clauses: bundle.clauses,
    billing_schedule: bundle.billing_schedule,
    signature,
  };
}

export async function GET(request: Request, context: any) {
  const supabase = getSupabaseAdmin();

  try {
    const token = await getToken(context);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing signing token." },
        { status: 400 }
      );
    }

    const signatureRequest = await loadSigningRequest(supabase, token);

    if (!signatureRequest) {
      return NextResponse.json(
        { success: false, error: "This signing link is invalid." },
        { status: 404 }
      );
    }

    if (
      signatureRequest.status === "Expired" ||
      requestExpired(signatureRequest.expires_at)
    ) {
      if (signatureRequest.status !== "Expired") {
        await supabase
          .from("engagement_signature_requests")
          .update({ status: "Expired" })
          .eq("id", signatureRequest.id);
      }

      return NextResponse.json(
        {
          success: false,
          error: "This signing link has expired.",
          expired: true,
        },
        { status: 410 }
      );
    }

    if (signatureRequest.status === "Cancelled") {
      return NextResponse.json(
        {
          success: false,
          error: "This signing request has been cancelled.",
        },
        { status: 410 }
      );
    }

    const bundle = await loadEngagementBundle(
      supabase,
      signatureRequest.engagement_id
    );

    const now = new Date().toISOString();

    if (
      signatureRequest.status === "Pending" ||
      signatureRequest.status === "Opened"
    ) {
      await supabase
        .from("engagement_signature_requests")
        .update({
          status: signatureRequest.status === "Pending" ? "Opened" : "Opened",
          first_opened_at: signatureRequest.first_opened_at || now,
          last_opened_at: now,
        })
        .eq("id", signatureRequest.id);

      if (signatureRequest.status === "Pending") {
        await supabase.from("engagement_events").insert({
          engagement_id: signatureRequest.engagement_id,
          organisation_id: signatureRequest.organisation_id,
          event_type: "Signature Link Opened",
          from_status: bundle.engagement.status,
          to_status: bundle.engagement.status,
          event_description: `Signing link opened by ${signatureRequest.recipient_email}.`,
          event_payload: {
            signature_request_id: signatureRequest.id,
            opened_at: now,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      signature_request: {
        id: signatureRequest.id,
        recipient_name: signatureRequest.recipient_name,
        recipient_email: signatureRequest.recipient_email,
        status:
          signatureRequest.status === "Pending"
            ? "Opened"
            : signatureRequest.status,
        expires_at: signatureRequest.expires_at,
        signed_at: signatureRequest.signed_at,
        signed_name: signatureRequest.signed_name,
        signed_capacity: signatureRequest.signed_capacity,
        signed_email: signatureRequest.signed_email,
      },
      ...bundle,
    });
  } catch (error: any) {
    console.error("PUBLIC ENGAGEMENT SIGNING LOAD ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to load engagement.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: any) {
  const supabase = getSupabaseAdmin();

  try {
    const token = await getToken(context);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing signing token." },
        { status: 400 }
      );
    }

    const signatureRequest = await loadSigningRequest(supabase, token);

    if (!signatureRequest) {
      return NextResponse.json(
        { success: false, error: "This signing link is invalid." },
        { status: 404 }
      );
    }

    if (
      signatureRequest.status === "Expired" ||
      requestExpired(signatureRequest.expires_at)
    ) {
      await supabase
        .from("engagement_signature_requests")
        .update({ status: "Expired" })
        .eq("id", signatureRequest.id);

      return NextResponse.json(
        { success: false, error: "This signing link has expired." },
        { status: 410 }
      );
    }

    if (signatureRequest.status === "Cancelled") {
      return NextResponse.json(
        { success: false, error: "This signing request has been cancelled." },
        { status: 410 }
      );
    }

    if (signatureRequest.status === "Signed") {
      return NextResponse.json({
        success: true,
        already_signed: true,
        signed_at: signatureRequest.signed_at,
        signed_name: signatureRequest.signed_name,
      });
    }

    const body = await request.json();

    const signedName = String(body?.signedName || "").trim();
    const signedCapacity = String(body?.signedCapacity || "").trim();
    const signedEmail = normaliseEmail(body?.signedEmail);
    const accepted = Boolean(body?.accepted);

    if (!accepted) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must confirm acceptance of the engagement before signing.",
        },
        { status: 400 }
      );
    }

    if (signedName.length < 2) {
      return NextResponse.json(
        { success: false, error: "Please enter the signer's full name." },
        { status: 400 }
      );
    }

    if (signedCapacity.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter the signer's capacity or position.",
        },
        { status: 400 }
      );
    }

    if (!signedEmail || !signedEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (signedEmail !== normaliseEmail(signatureRequest.recipient_email)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The email entered must match the email address to which this engagement was issued.",
        },
        { status: 400 }
      );
    }

    const bundle = await loadEngagementBundle(
      supabase,
      signatureRequest.engagement_id
    );

    if (bundle.engagement.locked_at) {
      return NextResponse.json(
        {
          success: false,
          error: "This engagement has already been signed and locked.",
        },
        { status: 409 }
      );
    }

    if (!["Sent", "Draft"].includes(bundle.engagement.status)) {
      return NextResponse.json(
        {
          success: false,
          error: "This engagement is no longer available for signature.",
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const ip = clientIp(request);
    const userAgent = request.headers.get("user-agent") || null;

    const signatureEvidence = {
      signed_name: signedName,
      signed_capacity: signedCapacity,
      signed_email: signedEmail,
      signed_at: now,
      signed_ip: ip,
      signed_user_agent: userAgent,
      signature_request_id: signatureRequest.id,
    };

    const snapshot = signingSnapshot(bundle, signatureEvidence);
    const sha256 = createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");

    const { error: requestUpdateError } = await supabase
      .from("engagement_signature_requests")
      .update({
        status: "Signed",
        signed_at: now,
        signed_name: signedName,
        signed_capacity: signedCapacity,
        signed_email: signedEmail,
        signed_ip: ip,
        signed_user_agent: userAgent,
      })
      .eq("id", signatureRequest.id);

    if (requestUpdateError) {
      throw requestUpdateError;
    }

    const { data: signedEngagement, error: engagementUpdateError } =
      await supabase
        .from("engagements")
        .update({
          status: "Signed",
          signed_at: now,
          signed_by_name: signedName,
          signed_by_capacity: signedCapacity,
          signed_by_email: signedEmail,
          signed_document_sha256: sha256,
          locked_at: now,
        })
        .eq("id", bundle.engagement.id)
        .select("*")
        .single();

    if (engagementUpdateError || !signedEngagement) {
      throw (
        engagementUpdateError ||
        new Error("Could not finalise signed engagement.")
      );
    }

    await supabase.from("engagement_events").insert({
      engagement_id: bundle.engagement.id,
      organisation_id: bundle.engagement.organisation_id,
      event_type: "Engagement Signed",
      from_status: bundle.engagement.status,
      to_status: "Signed",
      event_description: `Engagement signed electronically by ${signedName} (${signedCapacity}).`,
      event_payload: {
        signature_request_id: signatureRequest.id,
        signed_name: signedName,
        signed_capacity: signedCapacity,
        signed_email: signedEmail,
        signed_at: now,
        signed_ip: ip,
        signed_user_agent: userAgent,
        signed_document_sha256: sha256,
      },
    });

    return NextResponse.json({
      success: true,
      signed: true,
      signed_at: now,
      signed_name: signedName,
      engagement_number: signedEngagement.engagement_number,
      document_sha256: sha256,
    });
  } catch (error: any) {
    console.error("PUBLIC ENGAGEMENT SIGNING ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to sign engagement.",
      },
      { status: 500 }
    );
  }
}
