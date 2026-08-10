import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
  can_access_secretarial: boolean;
};

type SaveBody = {
  clientId?: string;
  certificateNumber?: string;
  shareholderName?: string;
  shareholderIdNumber?: string;
  shareClass?: string;
  seriesDesignation?: string;
  numberOfShares?: string | number;
  considerationPerShare?: string | number;
  totalConsideration?: string | number;
  amountPaid?: string | number;
  fullyPaid?: boolean;
  issueDate?: string;
  placeOfIssue?: string;
  transferRestriction?: string;
  signatoryOneName?: string;
  signatoryOneCapacity?: string;
  signatoryTwoName?: string;
  signatoryTwoCapacity?: string;
  boardResolutionDate?: string;
  boardResolutionReference?: string;
  reviewNotes?: string;
  egnyteFolderPath?: string;
};

type ProgressBody = {
  action?: "complete_step" | "go_back" | "jump_to_step" | "finalise";
  targetStep?: number;
  stepData?: {
    resolutionConfirmed?: boolean;
    certificateConfirmed?: boolean;
    reviewApproved?: boolean;
    registerConfirmed?: boolean;
    egnyteConfirmed?: boolean;
    finalConfirmation?: boolean;
  };
};

const STEP_NAMES = [
  "Company details",
  "Share structure",
  "Shareholder allocation",
  "Resolution",
  "Certificate generation",
  "Review and approval",
  "Register update",
  "Egnyte filing",
  "Complete",
];

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

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

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown) {
  const clean = text(value);
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof adminClient>
) {
  const token = bearer(request);

  if (!token) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id, user_id, role, organisation_id, access_enabled, can_access_secretarial"
    )
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "Could not load your user profile." },
        { status: 403 }
      ),
    };
  }

  const profile = data as UserProfile;

  if (!profile.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "Your PracticePilot access is disabled." },
        { status: 403 }
      ),
    };
  }

  if (!globalAdmin(profile.role) && !profile.can_access_secretarial) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "You do not have access to Secretarial." },
        { status: 403 }
      ),
    };
  }

  return { profile, response: null as NextResponse | null };
}

async function loadMatter(
  supabase: ReturnType<typeof adminClient>,
  id: string
) {
  return supabase
    .from("secretarial_share_matters")
    .select(
      `
        id,
        organisation_id,
        client_id,
        matter_status,
        current_step,
        certificate_number,
        shareholder_id,
        share_class_id,
        number_of_shares,
        issue_date,
        place_of_issue,
        board_resolution_date,
        board_resolution_reference,
        consideration_per_share,
        total_consideration,
        amount_paid,
        fully_paid,
        transfer_restriction,
        signatory_one_name,
        signatory_one_capacity,
        signatory_two_name,
        signatory_two_capacity,
        review_notes,
        egnyte_folder_path
      `
    )
    .eq("id", id)
    .maybeSingle();
}

function canAccessMatter(
  profile: UserProfile,
  organisationId: string | null
) {
  return (
    globalAdmin(profile.role) ||
    (!!organisationId && profile.organisation_id === organisationId)
  );
}

async function resolveShareholder(
  supabase: ReturnType<typeof adminClient>,
  organisationId: string,
  clientId: string,
  fullName: string,
  idNumber: string
) {
  let query = supabase
    .from("secretarial_shareholders")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .eq("full_legal_name", fullName)
    .eq("is_active", true);

  query = idNumber
    ? query.eq("id_registration_number", idNumber)
    : query.is("id_registration_number", null);

  const { data: existing, error } = await query.maybeSingle();
  if (error) throw error;

  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("secretarial_shareholders")
    .insert({
      organisation_id: organisationId,
      client_id: clientId,
      holder_type: "individual",
      full_legal_name: fullName,
      id_registration_number: idNumber || null,
    })
    .select("id")
    .single();

  if (createError || !created) {
    throw createError || new Error("Could not create shareholder.");
  }

  return created.id;
}

async function resolveShareClass(
  supabase: ReturnType<typeof adminClient>,
  organisationId: string,
  clientId: string,
  className: string,
  seriesDesignation: string
) {
  let query = supabase
    .from("secretarial_share_classes")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .eq("class_name", className)
    .eq("is_active", true);

  query = seriesDesignation
    ? query.eq("series_designation", seriesDesignation)
    : query.is("series_designation", null);

  const { data: existing, error } = await query.maybeSingle();
  if (error) throw error;

  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("secretarial_share_classes")
    .insert({
      organisation_id: organisationId,
      client_id: clientId,
      class_name: className,
      series_designation: seriesDesignation || null,
      par_value_type: className.toLowerCase().includes("no-par")
        ? "no_par_value"
        : "par_value",
      authorised_shares: 0,
      issued_shares: 0,
    })
    .select("id")
    .single();

  if (createError || !created) {
    throw createError || new Error("Could not create share class.");
  }

  return created.id;
}

async function markWorkflowStep(
  supabase: ReturnType<typeof adminClient>,
  matterId: string,
  stepNumber: number,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from("secretarial_share_workflow_steps")
    .update(values)
    .eq("matter_id", matterId)
    .eq("step_number", stepNumber);

  if (error) throw error;
}

async function ensureDraftCertificate(
  supabase: ReturnType<typeof adminClient>,
  matter: any
) {
  const { data: existing, error: findError } = await supabase
    .from("secretarial_share_certificates")
    .select("id")
    .eq("matter_id", matter.id)
    .maybeSingle();

  if (findError) throw findError;

  const payload = {
    organisation_id: matter.organisation_id,
    client_id: matter.client_id,
    matter_id: matter.id,
    shareholder_id: matter.shareholder_id,
    share_class_id: matter.share_class_id,
    certificate_number: matter.certificate_number,
    issue_date: matter.issue_date,
    number_of_shares: matter.number_of_shares,
    certificate_status: "draft",
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("secretarial_share_certificates")
      .update(payload)
      .eq("id", existing.id);

    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("secretarial_share_certificates")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    throw error || new Error("Could not create draft certificate record.");
  }

  return data.id;
}

async function postFinalRegisterEntries(
  supabase: ReturnType<typeof adminClient>,
  matter: any,
  profile: UserProfile
) {
  const { data: existingTransaction, error: findTxnError } = await supabase
    .from("secretarial_share_transactions")
    .select("id")
    .eq("matter_id", matter.id)
    .eq("transaction_type", "issue")
    .maybeSingle();

  if (findTxnError) throw findTxnError;

  if (!existingTransaction) {
    const { error: txnError } = await supabase
      .from("secretarial_share_transactions")
      .insert({
        organisation_id: matter.organisation_id,
        client_id: matter.client_id,
        matter_id: matter.id,
        share_class_id: matter.share_class_id,
        shareholder_id: matter.shareholder_id,
        transaction_type: "issue",
        transaction_date: matter.issue_date,
        number_of_shares: matter.number_of_shares,
        consideration_per_share: matter.consideration_per_share,
        total_consideration: matter.total_consideration,
        notes: `Share Certificate ${matter.certificate_number}`,
        created_by_user_id: profile.id,
      });

    if (txnError) throw txnError;

    const { data: shareClass, error: classError } = await supabase
      .from("secretarial_share_classes")
      .select("issued_shares")
      .eq("id", matter.share_class_id)
      .single();

    if (classError || !shareClass) {
      throw classError || new Error("Could not load share class.");
    }

    const nextIssued =
      Number(shareClass.issued_shares || 0) + Number(matter.number_of_shares || 0);

    const { error: updateClassError } = await supabase
      .from("secretarial_share_classes")
      .update({ issued_shares: nextIssued })
      .eq("id", matter.share_class_id);

    if (updateClassError) throw updateClassError;
  }

  const { data: certificate, error: certFindError } = await supabase
    .from("secretarial_share_certificates")
    .select("id")
    .eq("matter_id", matter.id)
    .maybeSingle();

  if (certFindError) throw certFindError;

  if (certificate?.id) {
    const { error } = await supabase
      .from("secretarial_share_certificates")
      .update({
        certificate_status: "issued",
        issue_date: matter.issue_date,
        shareholder_id: matter.shareholder_id,
        share_class_id: matter.share_class_id,
        number_of_shares: matter.number_of_shares,
        pdf_storage_provider: matter.egnyte_folder_path ? "egnyte" : null,
        pdf_external_path: matter.egnyte_folder_path || null,
      })
      .eq("id", certificate.id);

    if (error) throw error;
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = adminClient();

  try {
    const { id } = await context.params;
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;
    if (!profile) {
      return NextResponse.json({ error: "No user profile." }, { status: 403 });
    }

    const { data: existing, error: matterError } = await loadMatter(supabase, id);

    if (matterError || !existing) {
      return NextResponse.json(
        { error: "Share certificate matter not found." },
        { status: 404 }
      );
    }

    if (!canAccessMatter(profile, existing.organisation_id)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    if (String(existing.matter_status).toLowerCase() === "completed") {
      return NextResponse.json(
        { error: "This share certificate has been finalised and is locked." },
        { status: 409 }
      );
    }

    const body = (await request.json()) as SaveBody;

    const clientId = text(body.clientId);
    const shareholderName = text(body.shareholderName);
    const shareholderIdNumber = text(body.shareholderIdNumber);
    const shareClassName = text(body.shareClass);
    const seriesDesignation = text(body.seriesDesignation);
    const numberOfShares = numberOrNull(body.numberOfShares);

    if (!clientId) {
      return NextResponse.json({ error: "Select a client." }, { status: 400 });
    }

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .select("id, organisation_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client?.organisation_id) {
      return NextResponse.json(
        { error: "The selected CRM client could not be found." },
        { status: 404 }
      );
    }

    if (client.organisation_id !== existing.organisation_id) {
      return NextResponse.json(
        { error: "The matter cannot be moved to another organisation." },
        { status: 400 }
      );
    }

    let shareholderId = existing.shareholder_id;
    if (shareholderName) {
      shareholderId = await resolveShareholder(
        supabase,
        existing.organisation_id,
        clientId,
        shareholderName,
        shareholderIdNumber
      );
    }

    let shareClassId = existing.share_class_id;
    if (shareClassName) {
      shareClassId = await resolveShareClass(
        supabase,
        existing.organisation_id,
        clientId,
        shareClassName,
        seriesDesignation
      );
    }

    const updatePayload: Record<string, unknown> = {
      client_id: clientId,
      certificate_number: text(body.certificateNumber),
      shareholder_id: shareholderId || null,
      share_class_id: shareClassId || null,
      number_of_shares: numberOfShares,
      consideration_per_share: numberOrNull(body.considerationPerShare),
      total_consideration: numberOrNull(body.totalConsideration),
      amount_paid: numberOrNull(body.amountPaid),
      fully_paid: body.fullyPaid !== false,
      issue_date: text(body.issueDate) || null,
      place_of_issue: text(body.placeOfIssue) || null,
      transfer_restriction: text(body.transferRestriction),
      signatory_one_name: text(body.signatoryOneName) || null,
      signatory_one_capacity: text(body.signatoryOneCapacity) || null,
      signatory_two_name: text(body.signatoryTwoName) || null,
      signatory_two_capacity: text(body.signatoryTwoCapacity) || null,
      board_resolution_date: text(body.boardResolutionDate) || null,
      board_resolution_reference: text(body.boardResolutionReference) || null,
      review_notes: text(body.reviewNotes) || null,
      egnyte_folder_path: text(body.egnyteFolderPath) || null,
      updated_by_user_id: profile.id,
    };

    const { data: updated, error: updateError } = await supabase
      .from("secretarial_share_matters")
      .update(updatePayload)
      .eq("id", id)
      .select("id, matter_status, current_step, certificate_number")
      .single();

    if (updateError || !updated) {
      throw updateError || new Error("Could not update the matter.");
    }

    return NextResponse.json({
      message: "Share certificate matter updated.",
      matter: updated,
    });
  } catch (error) {
    console.error("Update share certificate matter failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the share certificate matter.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = adminClient();

  try {
    const { id } = await context.params;
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;
    if (!profile) {
      return NextResponse.json({ error: "No user profile." }, { status: 403 });
    }

    const body = (await request.json()) as ProgressBody;

    if (!["complete_step", "go_back", "jump_to_step", "finalise"].includes(body.action || "")) {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const { data: matter, error } = await loadMatter(supabase, id);

    if (error || !matter) {
      return NextResponse.json(
        { error: "Share certificate matter not found." },
        { status: 404 }
      );
    }

    if (!canAccessMatter(profile, matter.organisation_id)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    if (String(matter.matter_status).toLowerCase() === "completed") {
      return NextResponse.json(
        { error: "This share certificate has already been finalised." },
        { status: 409 }
      );
    }

    const step = Number(matter.current_step || 1);

    if (body.action === "go_back") {
      if (step <= 1) {
        return NextResponse.json(
          { error: "This matter is already at Step 1." },
          { status: 409 }
        );
      }

      if (step >= 9) {
        return NextResponse.json(
          { error: "Step 9 is the finalisation stage and cannot move backwards." },
          { status: 409 }
        );
      }

      const previousStep = step - 1;

      await markWorkflowStep(supabase, id, step, {
        step_status: "not_started",
        started_at: null,
        completed_at: null,
        completed_by_user_id: null,
      });

      await markWorkflowStep(supabase, id, previousStep, {
        step_status: "in_progress",
        is_locked: false,
        started_at: new Date().toISOString(),
        completed_at: null,
        completed_by_user_id: null,
      });

      const resetReviewFields =
        previousStep <= 6
          ? {
              matter_status: previousStep === 1 ? "draft" : "in_progress",
              approved_at: null,
              reviewed_at: null,
            }
          : { matter_status: "in_progress" };

      const { data: updated, error: updateError } = await supabase
        .from("secretarial_share_matters")
        .update({
          current_step: previousStep,
          ...resetReviewFields,
          updated_by_user_id: profile.id,
        })
        .eq("id", id)
        .select("id, matter_status, current_step, certificate_number")
        .single();

      if (updateError || !updated) {
        throw updateError || new Error("Could not move the Flight Map back.");
      }

      return NextResponse.json({
        message: `Returned to Step ${previousStep}.`,
        matter: updated,
      });
    }

    if (body.action === "jump_to_step") {
      const targetStep = Number(body.targetStep);

      if (!Number.isInteger(targetStep) || targetStep < 1 || targetStep > 8) {
        return NextResponse.json(
          { error: "Select a valid completed Flight Map step." },
          { status: 400 }
        );
      }

      if (targetStep >= step) {
        return NextResponse.json(
          { error: "You can only jump back to a completed earlier step." },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();

      // Target step becomes active again.
      await markWorkflowStep(supabase, id, targetStep, {
        step_status: "in_progress",
        is_locked: false,
        started_at: now,
        completed_at: null,
        completed_by_user_id: null,
      });

      // Everything after the target step must be reviewed again.
      for (let stepNumber = targetStep + 1; stepNumber <= 9; stepNumber += 1) {
        await markWorkflowStep(supabase, id, stepNumber, {
          step_status: "not_started",
          is_locked: false,
          started_at: null,
          completed_at: null,
          completed_by_user_id: null,
        });
      }

      const updatePayload: Record<string, unknown> = {
        current_step: targetStep,
        matter_status: targetStep === 1 ? "draft" : "in_progress",
        completed_at: null,
        updated_by_user_id: profile.id,
      };

      // Any jump to/before approval means review and approval must be redone.
      if (targetStep <= 6) {
        updatePayload.reviewer_user_id = null;
        updatePayload.reviewed_at = null;
        updatePayload.approved_at = null;
      }

      const { data: updated, error: updateError } = await supabase
        .from("secretarial_share_matters")
        .update(updatePayload)
        .eq("id", id)
        .select("id, matter_status, current_step, certificate_number")
        .single();

      if (updateError || !updated) {
        throw updateError || new Error("Could not reopen the selected Flight Map step.");
      }

      return NextResponse.json({
        message: `Returned to Step ${targetStep} — ${STEP_NAMES[targetStep - 1]}.`,
        matter: updated,
      });
    }

    if (body.action === "finalise") {
      if (step !== 9) {
        return NextResponse.json(
          { error: "The matter must reach Step 9 before finalisation." },
          { status: 409 }
        );
      }

      if (!body.stepData?.finalConfirmation) {
        return NextResponse.json(
          { error: "Confirm that the certificate is ready to finalise." },
          { status: 400 }
        );
      }

      if (
        !matter.client_id ||
        !matter.shareholder_id ||
        !matter.share_class_id ||
        !matter.number_of_shares ||
        !matter.issue_date
      ) {
        return NextResponse.json(
          { error: "The certificate matter is incomplete and cannot be finalised." },
          { status: 400 }
        );
      }

      await postFinalRegisterEntries(supabase, matter, profile);

      await markWorkflowStep(supabase, id, 9, {
        step_status: "completed",
        is_locked: true,
        completed_at: new Date().toISOString(),
        completed_by_user_id: profile.id,
      });

      const { data: updated, error: updateError } = await supabase
        .from("secretarial_share_matters")
        .update({
          matter_status: "completed",
          current_step: 9,
          completed_at: new Date().toISOString(),
          updated_by_user_id: profile.id,
        })
        .eq("id", id)
        .select("id, matter_status, current_step, certificate_number")
        .single();

      if (updateError || !updated) {
        throw updateError || new Error("Could not finalise the matter.");
      }

      return NextResponse.json({
        message: "Share certificate finalised and locked.",
        matter: updated,
      });
    }

    if (step === 1 && !matter.client_id) {
      return NextResponse.json(
        { error: "Company details are incomplete." },
        { status: 400 }
      );
    }

    if (
      step === 2 &&
      (!matter.share_class_id ||
        !matter.number_of_shares ||
        Number(matter.number_of_shares) <= 0)
    ) {
      return NextResponse.json(
        { error: "Complete the share structure before continuing." },
        { status: 400 }
      );
    }

    if (step === 3 && !matter.shareholder_id) {
      return NextResponse.json(
        { error: "Complete the shareholder allocation before continuing." },
        { status: 400 }
      );
    }

    if (
      step === 4 &&
      (!matter.board_resolution_date ||
        !text(matter.board_resolution_reference) ||
        !body.stepData?.resolutionConfirmed)
    ) {
      return NextResponse.json(
        {
          error:
            "Confirm the resolution date/reference and that the share issue was authorised.",
        },
        { status: 400 }
      );
    }

    if (step === 5) {
      if (
        !matter.issue_date ||
        !matter.place_of_issue ||
        !matter.signatory_one_name ||
        !body.stepData?.certificateConfirmed
      ) {
        return NextResponse.json(
          {
            error:
              "Complete the certificate issue details and confirm the certificate layout.",
          },
          { status: 400 }
        );
      }

      await ensureDraftCertificate(supabase, matter);
    }

    if (step === 6 && !body.stepData?.reviewApproved) {
      return NextResponse.json(
        { error: "The certificate must be approved before continuing." },
        { status: 400 }
      );
    }

    if (step === 7 && !body.stepData?.registerConfirmed) {
      return NextResponse.json(
        {
          error:
            "Confirm that the securities register update is correct before continuing.",
        },
        { status: 400 }
      );
    }

    if (step === 8 && !body.stepData?.egnyteConfirmed) {
      return NextResponse.json(
        {
          error:
            "Confirm the temporary Egnyte testing bypass before continuing.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const nextStep = Math.min(9, step + 1);

    await markWorkflowStep(supabase, id, step, {
      step_status: step === 6 ? "approved" : "completed",
      is_locked: true,
      completed_at: now,
      completed_by_user_id: profile.id,
    });

    await markWorkflowStep(supabase, id, nextStep, {
      step_status: "in_progress",
      is_locked: false,
      started_at: now,
    });

    const matterUpdates: Record<string, unknown> = {
      current_step: nextStep,
      matter_status: step === 6 ? "approved" : "in_progress",
      updated_by_user_id: profile.id,
    };

    if (step === 6) {
      matterUpdates.reviewer_user_id = profile.id;
      matterUpdates.reviewed_at = now;
      matterUpdates.approved_at = now;
    }

    const { data: updated, error: updateError } = await supabase
      .from("secretarial_share_matters")
      .update(matterUpdates)
      .eq("id", id)
      .select("id, matter_status, current_step, certificate_number")
      .single();

    if (updateError || !updated) {
      throw updateError || new Error("Could not advance the Flight Map.");
    }

    return NextResponse.json({
      message: `Step ${step} — ${STEP_NAMES[step - 1]} completed.`,
      matter: updated,
    });
  } catch (error) {
    console.error("Share certificate Flight Map failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the Flight Map.",
      },
      { status: 500 }
    );
  }
}
