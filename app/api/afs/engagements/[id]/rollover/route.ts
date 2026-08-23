import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseServer } from "../../../lib/supabaseServer";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AnyRow = Record<string, any>;

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrZero(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundMoney(value: number) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 100) / 100;
}

function trialBalanceFingerprint(lines: AnyRow[]) {
  const stableRows = [...lines]
    .map((line) => ({
      account_code: String(line.account_code || "").trim(),
      mapping_code: String(line.mapping_code || "").trim(),
      final_balance: roundMoney(getFinalBalance(line)),
    }))
    .sort((a, b) =>
      `${a.account_code}|${a.mapping_code}`.localeCompare(
        `${b.account_code}|${b.mapping_code}`,
      ),
    );

  return createHash("sha256")
    .update(JSON.stringify(stableRows))
    .digest("hex");
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function calculateNextYearEnd(value: string) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error("The current financial year end is invalid.");
  }

  const currentYear = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const nextYear = currentYear + 1;
  const maximumDay = getDaysInMonth(nextYear, month - 1);
  const nextDay = Math.min(day, maximumDay);

  return [
    String(nextYear).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(nextDay).padStart(2, "0"),
  ].join("-");
}

function yearHeading(value: string) {
  const match = String(value || "").match(/^(\d{4})-/);
  return match?.[1] || "";
}

function stripSystemFields(row: AnyRow) {
  const { id, engagement_id, created_at, updated_at, ...rest } = row;
  return rest;
}

function getFinalBalance(line: AnyRow) {
  const possibleValues = [
    line.final_balance,
    line.current_balance,
    line.current_year_balance,
    line.source_balance,
    line.debit,
  ];

  for (const value of possibleValues) {
    if (value !== null && value !== undefined && value !== "") {
      return numberOrZero(value);
    }
  }

  return 0;
}

function normalise(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isStatementOfFinancialPositionLine(line: AnyRow) {
  const statement = normalise(line.mapping_statement);
  const mappingSection = normalise(line.mapping_section);
  const mappingPath = normalise(line.mapping_path);
  const leadScheduleNumber = String(
    line.lead_schedule_number || "",
  ).trim();
  const mappingCode = String(line.mapping_code || "").trim();

  return (
    statement.includes("financial position") ||
    statement === "sfp" ||
    mappingSection.includes("asset") ||
    mappingSection.includes("equity") ||
    mappingSection.includes("liabilit") ||
    mappingPath.includes("asset") ||
    mappingPath.includes("equity") ||
    mappingPath.includes("liabilit") ||
    /^(3|4|5|6|8)/.test(leadScheduleNumber) ||
    /^(3|4|5|6|8)/.test(mappingCode)
  );
}

function isRetainedIncomeLine(line: AnyRow) {
  const code = normalise(line.account_code);
  const name = normalise(line.account_name);
  const mappingCode = normalise(line.mapping_code);
  const mappingLabel = normalise(line.mapping_label);
  const mappingPath = normalise(line.mapping_path);

  return (
    code === "510-000" ||
    mappingCode === "510" ||
    mappingCode.startsWith("510.") ||
    name.includes("retained income") ||
    name.includes("retained earnings") ||
    name.includes("accumulated loss") ||
    mappingLabel.includes("retained income") ||
    mappingLabel.includes("retained earnings") ||
    mappingLabel.includes("accumulated loss") ||
    mappingPath.includes("retained income") ||
    mappingPath.includes("retained earnings") ||
    mappingPath.includes("accumulated loss")
  );
}

function calculateClosingTransfer(sourceTrialBalance: AnyRow[]) {
  return roundMoney(
    sourceTrialBalance
      .filter((line) => !isStatementOfFinancialPositionLine(line))
      .reduce((sum, line) => sum + getFinalBalance(line), 0),
  );
}

function calculateCarriedBalance(
  sourceLine: AnyRow,
  closingTransfer: number,
) {
  const finalBalance = getFinalBalance(sourceLine);

  if (isRetainedIncomeLine(sourceLine)) {
    return roundMoney(finalBalance + closingTransfer);
  }

  return roundMoney(finalBalance);
}

function buildRolloverTrialBalanceLine(
  sourceLine: AnyRow,
  newEngagementId: string,
  closingTransfer: number,
) {
  const priorYearBalance = roundMoney(getFinalBalance(sourceLine));
  const carriedOpeningBalance = calculateCarriedBalance(
    sourceLine,
    closingTransfer,
  );
  const cleanSource = stripSystemFields(sourceLine);
  const isSfp = isStatementOfFinancialPositionLine(sourceLine);

  const newCurrentBalance = isSfp ? carriedOpeningBalance : 0;

  return {
    ...cleanSource,

    engagement_id: newEngagementId,

    debit: newCurrentBalance,
    credit: priorYearBalance,

    opening_balance: isSfp ? carriedOpeningBalance : 0,

    current_year_balance: newCurrentBalance,
    current_balance: newCurrentBalance,
    final_balance: newCurrentBalance,
    prior_year_balance: priorYearBalance,

    source_balance: newCurrentBalance,
    manual_adjustment: 0,
    adjustments: 0,
    reclassifications: 0,

    period_1: 0,
    period_2: 0,
    period_3: 0,
    period_4: 0,
    period_5: 0,
    period_6: 0,
    period_7: 0,
    period_8: 0,
    period_9: 0,
    period_10: 0,
    period_11: 0,
    period_12: 0,

    updated_at: new Date().toISOString(),
  };
}

function buildNewEngagement(
  source: AnyRow,
  nextFinancialYearEnd: string,
) {
  const row: AnyRow = {
    client_name: source.client_name,
    entity_type: source.entity_type,
    financial_year_end: nextFinancialYearEnd,
    status: "Draft",
    prepared_by: source.prepared_by || null,
    reviewed_by: null,
    notes: source.notes || null,
    organisation_id: source.organisation_id || null,
    firm_client_name: source.firm_client_name || null,
  };

  const ownershipFields = [
    "owner_user_id",
    "user_id",
    "created_by_user_id",
    "created_by",
    "created_by_id",
  ];

  for (const field of ownershipFields) {
    if (source[field] !== undefined) {
      row[field] = source[field];
    }
  }

  return row;
}

async function refreshExistingTrialBalance(
  supabase: any,
  sourceTrialBalance: AnyRow[],
  targetEngagementId: string,
) {
  const { data: targetLines, error: targetError } = await supabase
    .from("afs_trial_balance_lines")
    .select("*")
    .eq("engagement_id", targetEngagementId);

  if (targetError) throw targetError;

  const currentTargetLines = targetLines || [];
  const targetByCode = new Map<string, AnyRow>();

  for (const line of currentTargetLines) {
    const code = String(line.account_code || "").trim().toUpperCase();
    if (code) targetByCode.set(code, line);
  }

  const closingTransfer = calculateClosingTransfer(sourceTrialBalance);
  let updated = 0;
  let inserted = 0;

  for (const sourceLine of sourceTrialBalance) {
    const code = String(sourceLine.account_code || "")
      .trim()
      .toUpperCase();

    const priorYearBalance = roundMoney(getFinalBalance(sourceLine));
    const openingBalance = isStatementOfFinancialPositionLine(sourceLine)
      ? calculateCarriedBalance(sourceLine, closingTransfer)
      : 0;

    const existingTarget = code ? targetByCode.get(code) : null;

    if (existingTarget?.id) {
      const oldOpeningBalance = numberOrZero(
        existingTarget.opening_balance,
      );

      const openingMovement = isStatementOfFinancialPositionLine(
        sourceLine,
      )
        ? roundMoney(openingBalance - oldOpeningBalance)
        : 0;

      const updatePayload: AnyRow = {
        credit: priorYearBalance,
        prior_year_balance: priorYearBalance,
        opening_balance: openingBalance,
        updated_at: new Date().toISOString(),
      };

      /*
        Refresh only the opening portion of existing SFP accounts.
        Current-year journals, manual adjustments, reclassifications
        and newly captured movements remain untouched.
      */
      if (isRetainedIncomeLine(sourceLine)) {
        updatePayload.debit = openingBalance;
        updatePayload.source_balance = openingBalance;
        updatePayload.current_year_balance = openingBalance;
        updatePayload.current_balance = openingBalance;
        updatePayload.final_balance = roundMoney(
          openingBalance +
            numberOrZero(existingTarget.manual_adjustment) +
            numberOrZero(existingTarget.adjustments) +
            numberOrZero(existingTarget.reclassifications),
        );
      } else if (openingMovement !== 0) {
        updatePayload.debit = roundMoney(
          numberOrZero(existingTarget.debit) + openingMovement,
        );

        updatePayload.source_balance = roundMoney(
          numberOrZero(existingTarget.source_balance) +
            openingMovement,
        );

        updatePayload.current_year_balance = roundMoney(
          numberOrZero(existingTarget.current_year_balance) +
            openingMovement,
        );

        updatePayload.current_balance = roundMoney(
          numberOrZero(existingTarget.current_balance) +
            openingMovement,
        );

        updatePayload.final_balance = roundMoney(
          numberOrZero(existingTarget.final_balance) +
            openingMovement,
        );
      }

      const { error } = await supabase
        .from("afs_trial_balance_lines")
        .update(updatePayload)
        .eq("id", existingTarget.id);

      if (error) throw error;
      updated += 1;
      continue;
    }

    const newLine = buildRolloverTrialBalanceLine(
      sourceLine,
      targetEngagementId,
      closingTransfer,
    );

    const { error } = await supabase
      .from("afs_trial_balance_lines")
      .insert(newLine);

    if (error) throw error;
    inserted += 1;
  }

  return {
    updated,
    inserted,
    closingTransfer,
  };
}

async function createNewRollover(
  supabase: any,
  sourceEngagement: AnyRow,
  sourceEngagementId: string,
  nextFinancialYearEnd: string,
  sourceFingerprint: string,
) {
  let newEngagementId: string | null = null;

  try {
    const { data: newEngagement, error: insertEngagementError } =
      await supabase
        .from("afs_engagements")
        .insert(
          buildNewEngagement(
            sourceEngagement,
            nextFinancialYearEnd,
          ),
        )
        .select("*")
        .single();

    if (insertEngagementError || !newEngagement) {
      throw new Error(
        insertEngagementError?.message ||
          "Failed to create the new AFS engagement.",
      );
    }

    newEngagementId = newEngagement.id;

    const { data: trackedEngagement, error: trackingError } = await supabase
      .from("afs_engagements")
      .update({
        rollover_source_engagement_id: sourceEngagementId,
        rollover_source_fingerprint: sourceFingerprint,
        rollover_source_snapshot_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", newEngagementId)
      .select("*")
      .single();

    if (trackingError) throw trackingError;

    const [
      setupResult,
      peopleResult,
      trialBalanceResult,
      printStudioResult,
    ] = await Promise.all([
      supabase
        .from("afs_client_setup")
        .select("*")
        .eq("engagement_id", sourceEngagementId)
        .maybeSingle(),

      supabase
        .from("afs_client_people")
        .select("*")
        .eq("engagement_id", sourceEngagementId)
        .order("created_at", { ascending: true }),

      supabase
        .from("afs_trial_balance_lines")
        .select("*")
        .eq("engagement_id", sourceEngagementId)
        .order("account_code", { ascending: true }),

      supabase
        .from("afs_print_studio_settings")
        .select("*")
        .eq("engagement_id", sourceEngagementId)
        .maybeSingle(),
    ]);

    if (setupResult.error) throw setupResult.error;
    if (peopleResult.error) throw peopleResult.error;
    if (trialBalanceResult.error) throw trialBalanceResult.error;
    if (printStudioResult.error) throw printStudioResult.error;

    if (setupResult.data) {
      const sourceSetup = stripSystemFields(setupResult.data);

      const setupInsert = {
        ...sourceSetup,
        engagement_id: newEngagementId,
        signature_date: null,
        afs_approval_date: null,
        publish_date: null,
        current_period_heading: yearHeading(nextFinancialYearEnd),
        prior_period_heading: yearHeading(
          sourceEngagement.financial_year_end,
        ),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("afs_client_setup")
        .insert(setupInsert);

      if (error) throw error;
    }

    const sourcePeople = peopleResult.data || [];

    if (sourcePeople.length > 0) {
      const peopleInsert = sourcePeople.map((person: AnyRow) => ({
        ...stripSystemFields(person),
        engagement_id: newEngagementId,
      }));

      const { error } = await supabase
        .from("afs_client_people")
        .insert(peopleInsert);

      if (error) throw error;
    }

    const sourceTrialBalance = trialBalanceResult.data || [];
    const closingTransfer = calculateClosingTransfer(
      sourceTrialBalance,
    );

    if (sourceTrialBalance.length > 0) {
      const trialBalanceInsert = sourceTrialBalance.map((line: AnyRow) =>
        buildRolloverTrialBalanceLine(
          line,
          newEngagementId as string,
          closingTransfer,
        ),
      );

      const { error } = await supabase
        .from("afs_trial_balance_lines")
        .insert(trialBalanceInsert);

      if (error) throw error;
    }

    if (printStudioResult.data) {
      const sourceSettings = printStudioResult.data;

      const settingsInsert = {
        engagement_id: newEngagementId,
        report_options: sourceSettings.report_options || {},
        directors_report_texts:
          sourceSettings.directors_report_texts || {},
        accounting_policy_texts:
          sourceSettings.accounting_policy_texts || {},
        note_texts: sourceSettings.note_texts || {},
        statement_overrides: {},
        structured_notes_state: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("afs_print_studio_settings")
        .insert(settingsInsert);

      if (error) throw error;
    }

    return {
      engagement: trackedEngagement || newEngagement,
      copied: {
        clientSetup: Boolean(setupResult.data),
        people: sourcePeople.length,
        trialBalanceLines: sourceTrialBalance.length,
        printStudioSettings: Boolean(printStudioResult.data),
        closingTransfer,
      },
    };
  } catch (error) {
    if (newEngagementId) {
      await supabase
        .from("afs_engagements")
        .delete()
        .eq("id", newEngagementId);
    }

    throw error;
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const supabase = getSupabaseServer();

  try {
    const { id: sourceEngagementId } = await context.params;

    if (!sourceEngagementId) {
      return NextResponse.json(
        { error: "Missing source engagement id." },
        { status: 400 },
      );
    }

    let body: AnyRow = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { data: sourceEngagement, error: engagementError } =
      await supabase
        .from("afs_engagements")
        .select("*")
        .eq("id", sourceEngagementId)
        .single();

    if (engagementError || !sourceEngagement) {
      throw new Error(
        engagementError?.message ||
          "The source AFS engagement could not be found.",
      );
    }

    const sourceStatus = String(sourceEngagement.status || "")
      .trim()
      .toLowerCase();

    const rolloverAllowed =
      sourceStatus === "final" ||
      sourceStatus === "ready for review";

    if (!rolloverAllowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Next Flight becomes available once the current flight is Ready for Review or Final.",
        },
        { status: 400 },
      );
    }

    const nextFinancialYearEnd =
      cleanText(body.financialYearEnd) ||
      calculateNextYearEnd(sourceEngagement.financial_year_end);

    const { data: existingEngagement, error: duplicateError } =
      await supabase
        .from("afs_engagements")
        .select("*")
        .eq("organisation_id", sourceEngagement.organisation_id)
        .eq("client_name", sourceEngagement.client_name)
        .eq("financial_year_end", nextFinancialYearEnd)
        .maybeSingle();

    if (duplicateError) throw duplicateError;

    const { data: sourceTrialBalance, error: sourceTbError } =
      await supabase
        .from("afs_trial_balance_lines")
        .select("*")
        .eq("engagement_id", sourceEngagementId)
        .order("account_code", { ascending: true });

    if (sourceTbError) throw sourceTbError;

    const sourceFingerprint = trialBalanceFingerprint(
      sourceTrialBalance || [],
    );

    if (existingEngagement?.id) {
      const refreshResult = await refreshExistingTrialBalance(
        supabase,
        sourceTrialBalance || [],
        existingEngagement.id,
      );

      const engagementUpdate: AnyRow = {
        rollover_source_engagement_id: sourceEngagementId,
        rollover_source_fingerprint: sourceFingerprint,
        rollover_source_snapshot_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (
        String(existingEngagement.status || "")
          .trim()
          .toLowerCase() === "final"
      ) {
        engagementUpdate.status = "Reopened";
      }

      const { data: refreshedEngagement, error: refreshError } =
        await supabase
          .from("afs_engagements")
          .update(engagementUpdate)
          .eq("id", existingEngagement.id)
          .select("*")
          .single();

      if (refreshError) throw refreshError;

      return NextResponse.json({
        success: true,
        refreshed: true,
        created: false,
        message:
          "Existing Next Flight engagement refreshed successfully.",
        sourceEngagementId,
        engagement: refreshedEngagement,
        nextFinancialYearEnd,
        refresh: refreshResult,
      });
    }

    const createdResult = await createNewRollover(
      supabase,
      sourceEngagement,
      sourceEngagementId,
      nextFinancialYearEnd,
      sourceFingerprint,
    );

    return NextResponse.json({
      success: true,
      refreshed: false,
      created: true,
      message: "Next Flight engagement created successfully.",
      sourceEngagementId,
      engagement: createdResult.engagement,
      nextFinancialYearEnd,
      copied: createdResult.copied,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Next Flight rollover failed.",
      },
      { status: 500 },
    );
  }
}
