import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const DEFAULT_REQUIRED_PREPARATION_SECTIONS = [
  "client-setup",
  "trial-balance",
  "mapping",
  "tax-calculator",
  "financial-statements",
] as const;

type Authority = "Pilot" | "First Officer" | "Captain";

type Profile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  afs_authority?: Authority | null;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing Supabase service-role key.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

type CurrentProfileResult =
  | { profile: Profile; response: null }
  | { profile: null; response: NextResponse };

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof adminClient>,
): Promise<CurrentProfileResult> {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,full_name,email,role,access_enabled,afs_authority",
    )
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Profile access denied." }, { status: 403 }),
    };
  }

  return {
    profile: data as Profile,
    response: null,
  };
}

async function engagementIdFrom(context: any) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

function cleanSectionKey(value: unknown) {
  return String(value || "").trim();
}

function includesUser(ids: unknown, userId: string) {
  return Array.isArray(ids) && ids.map(String).includes(userId);
}

function displayName(profile: Profile) {
  return profile.full_name?.trim() || profile.email;
}


async function trialBalanceOutOfBalance(
  supabase: ReturnType<typeof adminClient>,
  engagementId: string,
) {
  const { data: lines, error } = await supabase
    .from("afs_trial_balance_lines")
    .select("current_year_balance,debit,credit")
    .eq("engagement_id", engagementId);

  if (error) throw error;

  const balance = (lines || []).reduce((sum: number, line: any) => {
    const current =
      line.current_year_balance !== null &&
      line.current_year_balance !== undefined
        ? Number(line.current_year_balance || 0)
        : Number(line.debit || 0) - Number(line.credit || 0);

    return sum + (Number.isFinite(current) ? current : 0);
  }, 0);

  return Math.abs(balance) < 0.005 ? 0 : balance;
}

export async function GET(request: Request, context: any) {
  try {
    const engagementId = await engagementIdFrom(context);
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const [
      { data: workflow, error: workflowError },
      { data: signoffs, error: signoffError },
      { data: users, error: usersError },
    ] = await Promise.all([
      supabase
        .from("afs_engagement_workflow")
        .select(
          "workflow_levels,pilot_user_ids,first_officer_user_ids,captain_user_ids,is_started",
        )
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id)
        .maybeSingle(),
      supabase
        .from("afs_section_signoffs")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id),
      supabase
        .from("user_profiles")
        .select("id,full_name,email")
        .eq("organisation_id", profile.organisation_id),
    ]);

    if (workflowError) throw workflowError;
    if (signoffError) throw signoffError;
    if (usersError) throw usersError;

    const names = Object.fromEntries(
      (users || []).map((user: any) => [
        user.id,
        user.full_name?.trim() || user.email,
      ]),
    );

    return NextResponse.json({
      workflow,
      currentUserId: profile.id,
      currentUserName: displayName(profile),
      names,
      signoffs: signoffs || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load section sign-offs." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const engagementId = await engagementIdFrom(context);
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const action = String(body.action || "").trim();
    const sectionKey = cleanSectionKey(body.sectionKey);

    if (!sectionKey) {
      return NextResponse.json({ error: "Section is required." }, { status: 400 });
    }

    const { data: workflow, error: workflowError } = await supabase
      .from("afs_engagement_workflow")
      .select(
        "workflow_levels,pilot_user_ids,first_officer_user_ids,captain_user_ids,is_started",
      )
      .eq("engagement_id", engagementId)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: "Start the AFS flight before signing off sections." },
        { status: 400 },
      );
    }

    const levels = Number(workflow.workflow_levels || 2);
    const isPilot = includesUser(workflow.pilot_user_ids, profile.id);
    const isFirstOfficer = includesUser(workflow.first_officer_user_ids, profile.id);
    const isCaptain = includesUser(workflow.captain_user_ids, profile.id);


    if (
      sectionKey === "trial-balance" &&
      ["prepare", "review", "captain-clear"].includes(action)
    ) {
      const balanceDifference = await trialBalanceOutOfBalance(
        supabase,
        engagementId,
      );

      if (balanceDifference !== 0) {
        const formatted = Math.abs(balanceDifference).toLocaleString("en-ZA", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        return NextResponse.json(
          {
            error: `Trial Balance is out of balance by R ${formatted}. Resolve the difference before sign-off.`,
            balanceDifference,
          },
          { status: 400 },
        );
      }
    }

    const { data: existing, error: existingError } = await supabase
      .from("afs_section_signoffs")
      .select("*")
      .eq("engagement_id", engagementId)
      .eq("organisation_id", profile.organisation_id)
      .eq("section_key", sectionKey)
      .maybeSingle();

    if (existingError) throw existingError;

    const now = new Date().toISOString();
    let patch: Record<string, any> = {
      engagement_id: engagementId,
      organisation_id: profile.organisation_id,
      section_key: sectionKey,
      updated_at: now,
    };

    if (action === "prepare") {
      if (!isPilot && !isCaptain) {
        return NextResponse.json(
          { error: "Only an assigned Pilot can prepare this section." },
          { status: 403 },
        );
      }

      patch = {
        ...patch,
        prepared_by: profile.id,
        prepared_at: now,
        reviewed_by: null,
        reviewed_at: null,
        captain_cleared_by: null,
        captain_cleared_at: null,
        reopened_by: null,
        reopened_at: null,
        reopen_reason: null,
      };

      if (levels === 1) {
        if (!isCaptain) {
          return NextResponse.json(
            { error: "Solo section completion requires the assigned Captain." },
            { status: 403 },
          );
        }

        patch.reviewed_by = profile.id;
        patch.reviewed_at = now;
        patch.captain_cleared_by = profile.id;
        patch.captain_cleared_at = now;
      }
    } else if (action === "review") {
      const { count: unresolvedCount, error: reviewPointError } = await supabase
        .from("afs_review_points")
        .select("id", { count: "exact", head: true })
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id)
        .eq("section_key", sectionKey)
        .eq("status", "open");

      if (reviewPointError) throw reviewPointError;

      if ((unresolvedCount || 0) > 0) {
        return NextResponse.json(
          { error: "Resolve all open review points before reviewing this section." },
          { status: 400 },
        );
      }

      if (!existing?.prepared_at) {
        return NextResponse.json(
          { error: "The Pilot must sign off this section first." },
          { status: 400 },
        );
      }

      if (levels === 2) {
        if (!isCaptain) {
          return NextResponse.json(
            { error: "The assigned Captain must review this 2-level section." },
            { status: 403 },
          );
        }

        patch.reviewed_by = profile.id;
        patch.reviewed_at = now;
        patch.captain_cleared_by = profile.id;
        patch.captain_cleared_at = now;
      } else if (levels === 3) {
        if (!isFirstOfficer && !isCaptain) {
          return NextResponse.json(
            { error: "The assigned First Officer must review this section." },
            { status: 403 },
          );
        }

        patch.reviewed_by = profile.id;
        patch.reviewed_at = now;
        patch.captain_cleared_by = null;
        patch.captain_cleared_at = null;
      } else {
        return NextResponse.json(
          { error: "Solo sections are completed by the Captain in one step." },
          { status: 400 },
        );
      }
    } else if (action === "captain-clear") {
      const { count: unresolvedCount, error: reviewPointError } = await supabase
        .from("afs_review_points")
        .select("id", { count: "exact", head: true })
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id)
        .eq("section_key", sectionKey)
        .eq("status", "open");

      if (reviewPointError) throw reviewPointError;

      if ((unresolvedCount || 0) > 0) {
        return NextResponse.json(
          { error: "Resolve all open review points before Captain clearance." },
          { status: 400 },
        );
      }

      if (levels !== 3) {
        return NextResponse.json(
          { error: "Separate Captain clearance is only required on 3-level flights." },
          { status: 400 },
        );
      }

      if (!existing?.reviewed_at) {
        return NextResponse.json(
          { error: "The First Officer must review this section first." },
          { status: 400 },
        );
      }

      if (!isCaptain) {
        return NextResponse.json(
          { error: "Only an assigned Captain can clear this section." },
          { status: 403 },
        );
      }

      patch.captain_cleared_by = profile.id;
      patch.captain_cleared_at = now;
    } else if (action === "reopen") {
      if (!isCaptain && !isFirstOfficer) {
        return NextResponse.json(
          { error: "Only a First Officer or Captain can reopen a signed section." },
          { status: 403 },
        );
      }

      patch = {
        ...patch,
        reviewed_by: null,
        reviewed_at: null,
        captain_cleared_by: null,
        captain_cleared_at: null,
        reopened_by: profile.id,
        reopened_at: now,
        reopen_reason: String(body.reason || "").trim() || "Section reopened for changes.",
      };
    } else {
      return NextResponse.json({ error: "Unknown sign-off action." }, { status: 400 });
    }

    let saved;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("afs_section_signoffs")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase
        .from("afs_section_signoffs")
        .insert(patch)
        .select("*")
        .single();

      if (error) throw error;
      saved = data;
    }

    if (action === "prepare") {
      const [
        { data: applicabilityRows, error: applicabilityError },
        { data: preparationRows, error: preparationError },
      ] = await Promise.all([
        supabase
          .from("afs_section_applicability")
          .select("section_key,applicability")
          .eq("engagement_id", engagementId)
          .eq("organisation_id", profile.organisation_id),

        supabase
          .from("afs_section_signoffs")
          .select("section_key,prepared_at")
          .eq("engagement_id", engagementId)
          .eq("organisation_id", profile.organisation_id),
      ]);

      if (applicabilityError) throw applicabilityError;
      if (preparationError) throw preparationError;

      const applicabilityMap = new Map(
        (applicabilityRows || []).map((row: any) => [
          String(row.section_key),
          String(row.applicability),
        ]),
      );

      const requiredSectionKeys = [
        "client-setup",
        "trial-balance",
        "adjusting-journals",
        "mapping",
        "lead-schedules",
        "tax-calculator",
        "financial-statements",
        "minutes",
        "export-print",
      ].filter((sectionKey) => {
        const explicit = applicabilityMap.get(sectionKey);

        if (explicit) return explicit === "required";

        return DEFAULT_REQUIRED_PREPARATION_SECTIONS.includes(
          sectionKey as (typeof DEFAULT_REQUIRED_PREPARATION_SECTIONS)[number],
        );
      });

      const preparedKeys = new Set(
        (preparationRows || [])
          .filter((row: any) => Boolean(row.prepared_at))
          .map((row: any) => String(row.section_key)),
      );

      const allPreparationComplete =
        requiredSectionKeys.length > 0 &&
        requiredSectionKeys.every((sectionKey) => preparedKeys.has(sectionKey));

      if (allPreparationComplete) {
        const { data: engagementStatus, error: engagementStatusError } =
          await supabase
            .from("afs_engagements")
            .select("status")
            .eq("id", engagementId)
            .single();

        if (engagementStatusError) throw engagementStatusError;

        const currentStatus = String(engagementStatus?.status || "")
          .trim()
          .toLowerCase();

        if (!["final", "archived"].includes(currentStatus)) {
          const { error: readyError } = await supabase
            .from("afs_engagements")
            .update({
              status: "Ready for Review",
              updated_at: new Date().toISOString(),
            })
            .eq("id", engagementId);

          if (readyError) throw readyError;
        }
      }
    }

    return NextResponse.json({
      success: true,
      signoff: saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not update section sign-off." },
      { status: 500 },
    );
  }
}
