import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function adminClient() {

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) throw new Error("Missing Supabase admin environment variables.");

  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

}

async function authenticatedContext(request: Request, workId: string) {

  const supabase = adminClient();

  const token = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) return { supabase, context: null };

  const { data: profile } = await supabase

    .from("user_profiles")

    .select("id,user_id,organisation_id,role,access_enabled,can_access_crm")

    .eq("user_id", authData.user.id)

    .maybeSingle();

  if (!profile?.organisation_id || profile.access_enabled === false || profile.can_access_crm === false) return { supabase, context: null };

  const { data: work } = await supabase

    .from("crm_work_items")

    .select("id,organisation_id,client_id,title,status,due_date,assigned_user_id,preparer_user_id,reviewer_user_id,review_status,review_due_date,working_papers_path,review_notes")

    .eq("id", workId)

    .eq("organisation_id", profile.organisation_id)

    .maybeSingle();

  if (!work) return { supabase, context: null };

  const { data: client } = await supabase

    .from("crm_clients")

    .select("id,client_name,reviewer_user_id,manager_user_id,partner_user_id")

    .eq("id", work.client_id)

    .eq("organisation_id", profile.organisation_id)

    .maybeSingle();

  return { supabase, context: { user: authData.user, profile, work, client } };

}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || "PracticePilot";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;
  if (!host || !user || !pass || !fromEmail) return null;
  return { host, port, user, pass, fromName, fromEmail };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function profileByAuthUser(
  supabase: ReturnType<typeof adminClient>,
  organisationId: string,
  userId: string | null | undefined
) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,user_id,full_name,email")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function sendReviewEmail(args: {
  to: string | null | undefined;
  subject: string;
  greetingName?: string | null;
  clientName: string;
  workTitle: string;
  message: string;
  taskUrl: string;
  workingPapersUrl?: string | null;
  reviewDueDate?: string | null;
}) {
  if (!args.to) return false;
  const smtp = getSmtpConfig();
  if (!smtp) {
    console.warn("TASK REVIEW EMAIL SKIPPED: SMTP is not configured.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: args.to,
    subject: args.subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10233a;max-width:680px;margin:0 auto;">
        <div style="padding:18px 0;border-bottom:1px solid #dce4ec;font-size:22px;font-weight:800;">PracticePilot</div>
        <div style="padding:24px 0;">
          <p>Hi ${escapeHtml(args.greetingName || "there")},</p>
          <p>${escapeHtml(args.message)}</p>
          <table style="border-collapse:collapse;width:100%;margin:18px 0;">
            <tr><td style="padding:7px;border:1px solid #dce4ec;font-weight:700;">Client</td><td style="padding:7px;border:1px solid #dce4ec;">${escapeHtml(args.clientName)}</td></tr>
            <tr><td style="padding:7px;border:1px solid #dce4ec;font-weight:700;">Work</td><td style="padding:7px;border:1px solid #dce4ec;">${escapeHtml(args.workTitle)}</td></tr>
            ${args.reviewDueDate ? `<tr><td style="padding:7px;border:1px solid #dce4ec;font-weight:700;">Review required by</td><td style="padding:7px;border:1px solid #dce4ec;">${escapeHtml(args.reviewDueDate)}</td></tr>` : ""}
          </table>
          <p>
            <a href="${escapeHtml(args.taskUrl)}" style="display:inline-block;padding:10px 14px;background:#1769e0;color:#fff;text-decoration:none;font-weight:700;">Open task in PracticePilot</a>
            ${args.workingPapersUrl ? `<a href="${escapeHtml(args.workingPapersUrl)}" style="display:inline-block;margin-left:8px;padding:10px 14px;border:1px solid #1769e0;color:#1769e0;text-decoration:none;font-weight:700;">Open working papers</a>` : ""}
          </p>
        </div>
      </div>
    `,
  });

  return true;
}

async function addActivity(supabase: ReturnType<typeof adminClient>, args: { organisationId: string; workId: string; userId: string; actionType: string; summary: string; fromStatus?: string | null; toStatus?: string | null }) {

  const { error } = await supabase.from("crm_work_item_activity").insert({

    organisation_id: args.organisationId,

    work_item_id: args.workId,

    action_type: args.actionType,

    action_summary: args.summary,

    from_status: args.fromStatus || null,

    to_status: args.toStatus || null,

    performed_by_user_id: args.userId,

  });

  if (error) throw error;

}

export async function GET(request: Request, routeContext: any) {
  try {
    const params = await routeContext.params;
    const workId = String(params?.id || "").trim();
    const { supabase, context } = await authenticatedContext(request, workId);

    if (!context) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const [preparer, reviewer] = await Promise.all([
      profileByAuthUser(
        supabase,
        context.profile.organisation_id,
        context.work.preparer_user_id || context.work.assigned_user_id
      ),
      profileByAuthUser(
        supabase,
        context.profile.organisation_id,
        context.work.reviewer_user_id
      ),
    ]);

    return NextResponse.json({
      success: true,
      review_status: context.work.review_status || "not_requested",
      review_due_date: context.work.review_due_date || null,
      working_papers_path: context.work.working_papers_path || null,
      review_notes: context.work.review_notes || null,
      preparer_user_id:
        context.work.preparer_user_id || context.work.assigned_user_id || null,
      reviewer_user_id: context.work.reviewer_user_id || null,
      preparer_name: preparer?.full_name || preparer?.email || null,
      reviewer_name: reviewer?.full_name || reviewer?.email || null,
    });
  } catch (error: any) {
    console.error("Task review metadata failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load task review metadata." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, routeContext: any) {

  try {

    const params = await routeContext.params;

    const workId = String(params?.id || "").trim();

    const { supabase, context } = await authenticatedContext(request, workId);

    if (!context) return NextResponse.json({ error: "Access denied." }, { status: 403 });

    const body = await request.json();

    const action = String(body?.action || "").trim();
    const reviewDueDate = String(body?.reviewDueDate || "").trim();
    const workingPapersPath = String(body?.workingPapersPath || "").trim();
    const reviewNotes = String(body?.reviewNotes || "").trim();

    if (!["send", "approve", "return", "reopen"].includes(action)) return NextResponse.json({ error: "Invalid review action." }, { status: 400 });

    const now = new Date().toISOString();

    if (action === "send") {

      const preparerUserId =

      context.work.preparer_user_id ||

      context.work.assigned_user_id ||

      context.user.id;

    const isAssignedWorkOwner =

      !context.work.assigned_user_id ||

      context.work.assigned_user_id === context.user.id;

    const isOriginalPreparer =

      Boolean(context.work.preparer_user_id) &&

      context.work.preparer_user_id === context.user.id;

    const isClientReviewer =

      Boolean(context.client?.reviewer_user_id) &&

      context.client?.reviewer_user_id === context.profile.id;

    const isClientManager =

      Boolean(context.client?.manager_user_id) &&

      context.client?.manager_user_id === context.profile.id;

    const isClientPartner =

      Boolean(context.client?.partner_user_id) &&

      context.client?.partner_user_id === context.profile.id;

    const isPracticeManager = [

      "Client Manager",

      "Admin",

      "Super Admin",

    ].includes(String(context.profile.role || ""));

    const canSendToReviewer =

      isAssignedWorkOwner ||

      isOriginalPreparer ||

      isClientReviewer ||

      isClientManager ||

      isClientPartner ||

      isPracticeManager;

    if (!canSendToReviewer) {

      return NextResponse.json(

        {

          error:

            "Only the assigned work owner, preparer, client reviewer, manager, partner or practice manager can send this task to review.",

        },

        { status: 403 }

      );

    }

    const reviewerProfileId =

      context.client?.reviewer_user_id ||

      context.client?.partner_user_id ||

      null;

      if (!reviewerProfileId) return NextResponse.json({ error: "No reviewer is assigned to this client. Set one under Client Setup → Internal Responsibility." }, { status: 409 });

      const { data: reviewerProfile, error: reviewerError } = await supabase

        .from("user_profiles")

        .select("id,user_id,full_name,email")

        .eq("id", reviewerProfileId)

        .eq("organisation_id", context.profile.organisation_id)

        .maybeSingle();

      if (reviewerError) throw reviewerError;

      if (!reviewerProfile?.user_id) return NextResponse.json({ error: "The assigned reviewer does not have an active login user." }, { status: 409 });

      const { data: checklist, error: checklistError } = await supabase

        .from("crm_work_item_checklist")

        .select("id,label,status,item_type,requires_evidence,evidence_label")

        .eq("work_item_id", workId)

        .order("item_order", { ascending: true });

      if (checklistError) throw checklistError;

      const openPreparation = (checklist || []).filter(
        (item: any) =>
          !["review", "dependency", "submission"].includes(
            String(item.item_type || "")
          ) &&
          !["completed", "not_applicable"].includes(String(item.status || ""))
      );

      if (openPreparation.length) return NextResponse.json({ error: `Complete the preparation checklist first. Still open: ${openPreparation.map((item: any) => item.label).join(", ")}.` }, { status: 409 });

      const evidenceItems = (checklist || []).filter((item: any) => item.requires_evidence);

      if (evidenceItems.length) {

        const { data: evidenceRows, error: evidenceError } = await supabase

          .from("crm_work_item_evidence")

          .select("checklist_item_id")

          .eq("organisation_id", context.profile.organisation_id)

          .eq("work_item_id", workId);

        if (evidenceError) throw evidenceError;

        const ids = new Set((evidenceRows || []).map((row: any) => String(row.checklist_item_id || "")));

        const missing = evidenceItems.filter((item: any) => !ids.has(String(item.id)));

        if (missing.length) return NextResponse.json({ error: `Upload the required review evidence first: ${missing.map((item: any) => item.evidence_label || item.label).join(", ")}.` }, { status: 409 });

      }
      if (!reviewDueDate) {
        return NextResponse.json(
          { error: "Choose the internal review required-by date." },
          { status: 409 }
        );
      }

      if (!workingPapersPath) {
        return NextResponse.json(
          { error: "Link the Egnyte working-paper folder before sending this task for review." },
          { status: 409 }
        );
      }

      if (
        context.work.due_date &&
        reviewDueDate > String(context.work.due_date).slice(0, 10)
      ) {
        return NextResponse.json(
          { error: "The review date cannot be after the final task due date." },
          { status: 409 }
        );
      }

      const { error: workError } = await supabase
        .from("crm_work_items")
        .update({
          preparer_user_id: preparerUserId,
          reviewer_user_id: reviewerProfile.user_id,
          assigned_user_id: reviewerProfile.user_id,
          review_status: "awaiting_review",
          review_requested_at: now,
          review_completed_at: null,
          review_due_date: reviewDueDate,
          working_papers_path: workingPapersPath,
          review_notes: null,
          status: "ready",
          updated_at: now,
        })
        .eq("id", workId);

      if (workError) throw workError;

      await addActivity(supabase, {
        organisationId: context.profile.organisation_id,
        workId,
        userId: context.user.id,
        actionType: "sent_to_review",
        summary: `Sent to reviewer ${reviewerProfile.full_name || reviewerProfile.email || "Reviewer"} for review by ${reviewDueDate}.`,
        fromStatus: context.work.status,
        toStatus: "ready",
      });

      const taskUrl = `https://practicepilot.co.za/crm/client/${context.work.client_id}/work/${workId}`;
      const workingPapersUrl =
        `https://practicepilot.co.za/crm/client/${context.work.client_id}` +
        `?tab=documents&folderPath=${encodeURIComponent(workingPapersPath)}`;

      try {
        await sendReviewEmail({
          to: reviewerProfile.email,
          subject: `${context.client?.client_name || "Client"} — review required: ${context.work.title}`,
          greetingName: reviewerProfile.full_name,
          clientName: context.client?.client_name || "Client",
          workTitle: context.work.title,
          message: "Work has been sent to you for review.",
          taskUrl,
          workingPapersUrl,
          reviewDueDate,
        });
      } catch (mailError) {
        console.error("TASK REVIEW EMAIL ERROR:", mailError);
      }

      return NextResponse.json({
        success: true,
        review_status: "awaiting_review",
        reviewer_user_id: reviewerProfile.user_id,
        review_due_date: reviewDueDate,
        working_papers_path: workingPapersPath,
      });

    }

    if (action === "reopen") {
      const isAssignedReviewer =
        Boolean(context.work.reviewer_user_id) &&
        context.work.reviewer_user_id === context.user.id;

      const isClientReviewer =
        Boolean(context.client?.reviewer_user_id) &&
        context.client?.reviewer_user_id === context.profile.id;

      const isClientManager =
        Boolean(context.client?.manager_user_id) &&
        context.client?.manager_user_id === context.profile.id;

      const isClientPartner =
        Boolean(context.client?.partner_user_id) &&
        context.client?.partner_user_id === context.profile.id;

      const isPracticeManager = [
        "Client Manager",
        "Admin",
        "Super Admin",
      ].includes(String(context.profile.role || ""));

      if (
        !isAssignedReviewer &&
        !isClientReviewer &&
        !isClientManager &&
        !isClientPartner &&
        !isPracticeManager
      ) {
        return NextResponse.json(
          {
            error:
              "Only the reviewer, manager, partner or practice manager can reopen an approved task.",
          },
          { status: 403 }
        );
      }

      const preparerUserId =
        context.work.preparer_user_id ||
        context.work.assigned_user_id ||
        context.user.id;

      const { error: resetChecklistError } = await supabase
        .from("crm_work_item_checklist")
        .update({ status: "outstanding", updated_at: now })
        .eq("work_item_id", workId)
        .in("item_type", ["review", "submission"]);

      if (resetChecklistError) throw resetChecklistError;

      const { error: reopenError } = await supabase
        .from("crm_work_items")
        .update({
          assigned_user_id: preparerUserId,
          review_status: "not_requested",
          review_requested_at: null,
          review_completed_at: null,
          review_notes: null,
          status: "in_progress",
          completed_at: null,
          updated_at: now,
        })
        .eq("id", workId);

      if (reopenError) throw reopenError;

      await addActivity(supabase, {
        organisationId: context.profile.organisation_id,
        workId,
        userId: context.user.id,
        actionType: "review_reopened",
        summary:
          "Review workflow reopened. Review and submission steps were reset.",
        fromStatus: context.work.status,
        toStatus: "in_progress",
      });

      return NextResponse.json({
        success: true,
        review_status: "not_requested",
        status: "in_progress",
      });
    }

    if (!context.work.reviewer_user_id || context.work.reviewer_user_id !== context.user.id) {

      return NextResponse.json({ error: "Only the assigned reviewer can perform this review action." }, { status: 403 });

    }

    if (action === "return") {

      if (!context.work.preparer_user_id) {
        return NextResponse.json(
          { error: "The original preparer could not be identified." },
          { status: 409 }
        );
      }

      if (!reviewNotes) {
        return NextResponse.json(
          { error: "Add a review note before returning the task for correction." },
          { status: 409 }
        );
      }

      const { error: resetReviewError } = await supabase

        .from("crm_work_item_checklist")

        .update({ status: "outstanding", updated_at: now })

        .eq("work_item_id", workId)

        .eq("item_type", "review");

      if (resetReviewError) throw resetReviewError;

      const { error: workError } = await supabase

        .from("crm_work_items")

        .update({
          assigned_user_id: context.work.preparer_user_id,
          review_status: "returned",
          review_completed_at: null,
          review_notes: reviewNotes,
          status: "in_progress",
          updated_at: now,
        })

        .eq("id", workId);

      if (workError) throw workError;

      await addActivity(supabase, {
        organisationId: context.profile.organisation_id,
        workId,
        userId: context.user.id,
        actionType: "review_returned",
        summary: `Review returned to preparer: ${reviewNotes}`,
        fromStatus: context.work.status,
        toStatus: "in_progress",
      });

      const preparer = await profileByAuthUser(
        supabase,
        context.profile.organisation_id,
        context.work.preparer_user_id
      );

      const taskUrl = `https://practicepilot.co.za/crm/client/${context.work.client_id}/work/${workId}`;
      const workingPapersUrl = context.work.working_papers_path
        ? `https://practicepilot.co.za/crm/client/${context.work.client_id}?tab=documents&folderPath=${encodeURIComponent(context.work.working_papers_path)}`
        : null;

      try {
        await sendReviewEmail({
          to: preparer?.email,
          subject: `${context.client?.client_name || "Client"} — returned for correction: ${context.work.title}`,
          greetingName: preparer?.full_name,
          clientName: context.client?.client_name || "Client",
          workTitle: context.work.title,
          message: `The review has been returned for correction. Reviewer note: ${reviewNotes}`,
          taskUrl,
          workingPapersUrl,
        });
      } catch (mailError) {
        console.error("TASK REVIEW RETURN EMAIL ERROR:", mailError);
      }

      return NextResponse.json({
        success: true,
        review_status: "returned",
        review_notes: reviewNotes,
      });

    }

    const { error: reviewChecklistError } = await supabase

      .from("crm_work_item_checklist")

      .update({ status: "completed", updated_at: now })

      .eq("work_item_id", workId)

      .eq("item_type", "review");

    if (reviewChecklistError) throw reviewChecklistError;

    const { data: submissionRows, error: submissionError } = await supabase
      .from("crm_work_item_checklist")
      .select("id")
      .eq("work_item_id", workId)
      .eq("item_type", "submission");

    if (submissionError) throw submissionError;

    const hasSubmissionSteps = Boolean((submissionRows || []).length);
    const preparerUserId =
      context.work.preparer_user_id || context.work.assigned_user_id || null;
    const nextStatus = hasSubmissionSteps ? "ready" : "completed";

    const { error: completeError } = await supabase
      .from("crm_work_items")
      .update({
        review_status: "approved",
        review_completed_at: now,
        review_notes: null,
        assigned_user_id: preparerUserId,
        status: nextStatus,
        completed_at: hasSubmissionSteps ? null : now,
        updated_at: now,
      })
      .eq("id", workId);

    if (completeError) throw completeError;

    await addActivity(supabase, {
      organisationId: context.profile.organisation_id,
      workId,
      userId: context.user.id,
      actionType: "review_approved",
      summary: hasSubmissionSteps
        ? "Review approved. Returned to preparer for submission."
        : "Review approved and work completed.",
      fromStatus: context.work.status,
      toStatus: nextStatus,
    });

    const preparer = await profileByAuthUser(
      supabase,
      context.profile.organisation_id,
      preparerUserId
    );

    const taskUrl = `https://practicepilot.co.za/crm/client/${context.work.client_id}/work/${workId}`;
    const workingPapersUrl = context.work.working_papers_path
      ? `https://practicepilot.co.za/crm/client/${context.work.client_id}?tab=documents&folderPath=${encodeURIComponent(context.work.working_papers_path)}`
      : null;

    try {
      await sendReviewEmail({
        to: preparer?.email,
        subject: `${context.client?.client_name || "Client"} — review approved: ${context.work.title}`,
        greetingName: preparer?.full_name,
        clientName: context.client?.client_name || "Client",
        workTitle: context.work.title,
        message: hasSubmissionSteps
          ? "The review has been approved. The work is ready for submission."
          : "The review has been approved and the work is complete.",
        taskUrl,
        workingPapersUrl,
      });
    } catch (mailError) {
      console.error("TASK REVIEW APPROVAL EMAIL ERROR:", mailError);
    }

    return NextResponse.json({
      success: true,
      review_status: "approved",
      status: nextStatus,
      ready_for_submission: hasSubmissionSteps,
    });

  } catch (error: any) {

    console.error("Task review workflow failed:", error);

    return NextResponse.json({ error: error?.message || "Could not update task review." }, { status: 500 });

  }

}
