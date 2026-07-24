import { NextRequest, NextResponse } from "next/server";
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


const CASH_FLOW_CURRENT_TO_PRIOR_FIELDS: Record<string, string> = {
  cashAdjustmentsToProfitCurrent: "cashAdjustmentsToProfitPrior",
  cashWorkingCapitalCurrent: "cashWorkingCapitalPrior",
  cashInterestReceivedCurrent: "cashInterestReceivedPrior",
  cashFinanceCostsPaidCurrent: "cashFinanceCostsPaidPrior",
  cashTaxPaidCurrent: "cashTaxPaidPrior",
  cashOtherOperatingCurrent: "cashOtherOperatingPrior",
  cashOtherOperating2Current: "cashOtherOperating2Prior",
  cashOtherOperating3Current: "cashOtherOperating3Prior",
  cashPurchaseOfPpeCurrent: "cashPurchaseOfPpePrior",
  cashProceedsOnDisposalPpeCurrent: "cashProceedsOnDisposalPpePrior",
  cashOtherInvestingCurrent: "cashOtherInvestingPrior",
  cashOtherInvesting2Current: "cashOtherInvesting2Prior",
  cashOtherInvesting3Current: "cashOtherInvesting3Prior",
  cashLoansRaisedCurrent: "cashLoansRaisedPrior",
  cashLoansRepaidCurrent: "cashLoansRepaidPrior",
  cashDividendsPaidCurrent: "cashDividendsPaidPrior",
  cashOtherFinancingCurrent: "cashOtherFinancingPrior",
  cashOtherFinancing2Current: "cashOtherFinancing2Prior",
  cashOtherFinancing3Current: "cashOtherFinancing3Prior",
};

function buildRolledStatementOverrides(
  sourceOverrides: AnyRow,
  targetOverrides: AnyRow = {},
) {
  const next: AnyRow = {
    ...targetOverrides,
  };

  /*
    Preserve the target file's current-year work. Only refresh the comparative
    cash-flow fields from the source file's completed current-year settings.
  */
  Object.entries(CASH_FLOW_CURRENT_TO_PRIOR_FIELDS).forEach(
    ([sourceKey, targetKey]) => {
      const value = sourceOverrides?.[sourceKey];

      if (value !== undefined && value !== null && value !== "") {
        next[targetKey] = numberOrZero(value);
      } else {
        delete next[targetKey];
      }
    },
  );

  /*
    The source current-year opening cash becomes the comparative opening cash
    in the next file.
  */
  if (
    sourceOverrides?.cashOpeningBalance !== undefined &&
    sourceOverrides?.cashOpeningBalance !== null &&
    sourceOverrides?.cashOpeningBalance !== ""
  ) {
    next.cashPriorOpeningBalance = numberOrZero(
      sourceOverrides.cashOpeningBalance,
    );
  } else {
    delete next.cashPriorOpeningBalance;
  }

  /*
    Do not carry SCE manual overrides forward. The SCE now derives its opening
    retained income from the rolled trial balance.
  */
  delete next.sceOpeningShareCapital;
  delete next.sceOpeningRetainedIncome;
  delete next.sceOpeningReserves;
  delete next.scePriorOtherMovements;
  delete next.sceCurrentOtherMovements;
  delete next.sceOtherMovements;
  delete next.cashPriorMovement;

  return next;
}

function rollStructuredNotesToPrior(
  sourceState: AnyRow,
  targetState: AnyRow = {},
) {
  const next: AnyRow = {
    ...targetState,
  };

  const sourceCashGenerated =
    sourceState?.cashGeneratedFromOperations &&
    typeof sourceState.cashGeneratedFromOperations === "object"
      ? sourceState.cashGeneratedFromOperations
      : null;

  if (!sourceCashGenerated) {
    return next;
  }

  const targetCashGenerated =
    next.cashGeneratedFromOperations &&
    typeof next.cashGeneratedFromOperations === "object"
      ? { ...next.cashGeneratedFromOperations }
      : {};

  const sourceValues =
    sourceCashGenerated.values &&
    typeof sourceCashGenerated.values === "object"
      ? sourceCashGenerated.values
      : {};

  const targetValues =
    targetCashGenerated.values &&
    typeof targetCashGenerated.values === "object"
      ? { ...targetCashGenerated.values }
      : {};

  Object.entries(sourceValues).forEach(([key, rawValue]) => {
    const sourceValue =
      rawValue && typeof rawValue === "object"
        ? (rawValue as AnyRow)
        : {};

    const targetValue =
      targetValues[key] && typeof targetValues[key] === "object"
        ? { ...(targetValues[key] as AnyRow) }
        : {};

    if (
      sourceValue.current !== undefined &&
      sourceValue.current !== null &&
      sourceValue.current !== ""
    ) {
      targetValue.prior = numberOrZero(sourceValue.current);
    } else {
      delete targetValue.prior;
    }

    targetValues[key] = targetValue;
  });

  targetCashGenerated.values = targetValues;
  next.cashGeneratedFromOperations = targetCashGenerated;

  return next;
}

async function refreshExistingPrintStudioSettings(
  supabase: any,
  sourceEngagementId: string,
  targetEngagementId: string,
) {
  const [sourceResult, targetResult] = await Promise.all([
    supabase
      .from("afs_print_studio_settings")
      .select("*")
      .eq("engagement_id", sourceEngagementId)
      .maybeSingle(),
    supabase
      .from("afs_print_studio_settings")
      .select("*")
      .eq("engagement_id", targetEngagementId)
      .maybeSingle(),
  ]);

  if (sourceResult.error) throw sourceResult.error;
  if (targetResult.error) throw targetResult.error;

  if (!sourceResult.data) {
    return {
      updated: false,
      reason: "No source Print Studio settings found.",
    };
  }

  const sourceSettings = sourceResult.data;
  const targetSettings = targetResult.data || {};

  const statementOverrides = buildRolledStatementOverrides(
    sourceSettings.statement_overrides || {},
    targetSettings.statement_overrides || {},
  );

  const structuredNotesState = rollStructuredNotesToPrior(
    sourceSettings.structured_notes_state || {},
    targetSettings.structured_notes_state || {},
  );

  const payload = {
    engagement_id: targetEngagementId,
    report_options:
      targetSettings.report_options ||
      sourceSettings.report_options ||
      {},
    directors_report_texts:
      targetSettings.directors_report_texts ||
      sourceSettings.directors_report_texts ||
      {},
    accounting_policy_texts:
      targetSettings.accounting_policy_texts ||
      sourceSettings.accounting_policy_texts ||
      {},
    note_texts:
      targetSettings.note_texts ||
      sourceSettings.note_texts ||
      {},
    statement_overrides: statementOverrides,
    structured_notes_state: structuredNotesState,
    updated_at: new Date().toISOString(),
  };

  if (targetSettings.id) {
    const { error } = await supabase
      .from("afs_print_studio_settings")
      .update(payload)
      .eq("id", targetSettings.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("afs_print_studio_settings")
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
  }

  return {
    updated: true,
    statementOverrideCount: Object.keys(statementOverrides).length,
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


async function upsertTrialBalanceHistory(
  supabase: any,
  sourceEngagement: AnyRow,
  sourceTrialBalance: AnyRow[],
  targetEngagementId: string,
) {
  if (!sourceEngagement?.financial_year_end || sourceTrialBalance.length === 0) {
    return {
      upserted: 0,
    };
  }

  const rows = sourceTrialBalance
    .map((line) => {
      const accountCode = String(line.account_code || "").trim();
      const accountName = String(line.account_name || "").trim();

      if (!accountCode || !accountName) return null;

      return {
        organisation_id: sourceEngagement.organisation_id || null,
        engagement_id: targetEngagementId,
        source_engagement_id: sourceEngagement.id,
        trial_balance_line_id: line.id || null,
        financial_year_end: sourceEngagement.financial_year_end,
        account_code: accountCode,
        account_name: accountName,
        closing_balance: roundMoney(getFinalBalance(line)),
        mapping_code: cleanText(line.mapping_code),
        mapping_label: cleanText(line.mapping_label),
        mapping_statement: cleanText(line.mapping_statement),
        mapping_section: cleanText(line.mapping_section),
        mapping_path: cleanText(line.mapping_path),
        lead_schedule_number: cleanText(line.lead_schedule_number),
        lead_schedule_key: cleanText(line.lead_schedule_key),
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return {
      upserted: 0,
    };
  }

  const { error } = await supabase
    .from("afs_trial_balance_history")
    .upsert(rows, {
      onConflict:
        "engagement_id,financial_year_end,account_code",
    });

  if (error) throw error;

  return {
    upserted: rows.length,
  };
}


function calculatePriorFinancialYearEnd(value: string) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error("The financial year end is invalid.");
  }

  const currentYear = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const priorYear = currentYear - 1;
  const maximumDay = getDaysInMonth(priorYear, month - 1);
  const priorDay = Math.min(day, maximumDay);

  return [
    String(priorYear).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(priorDay).padStart(2, "0"),
  ].join("-");
}

async function upsertPriorYearTrialBalanceHistory(
  supabase: any,
  sourceEngagement: AnyRow,
  sourceTrialBalance: AnyRow[],
  targetEngagementId: string,
) {
  if (!sourceEngagement?.financial_year_end || sourceTrialBalance.length === 0) {
    return {
      upserted: 0,
    };
  }

  const priorFinancialYearEnd = calculatePriorFinancialYearEnd(
    sourceEngagement.financial_year_end,
  );

  const rows = sourceTrialBalance
    .map((line) => {
      const accountCode = String(line.account_code || "").trim();
      const accountName = String(line.account_name || "").trim();

      if (!accountCode || !accountName) return null;

      const priorBalance =
        line.prior_year_balance !== null &&
        line.prior_year_balance !== undefined &&
        line.prior_year_balance !== ""
          ? numberOrZero(line.prior_year_balance)
          : numberOrZero(line.credit);

      return {
        organisation_id: sourceEngagement.organisation_id || null,
        engagement_id: targetEngagementId,
        source_engagement_id: sourceEngagement.id,
        trial_balance_line_id: line.id || null,
        financial_year_end: priorFinancialYearEnd,
        account_code: accountCode,
        account_name: accountName,
        closing_balance: roundMoney(priorBalance),
        mapping_code: cleanText(line.mapping_code),
        mapping_label: cleanText(line.mapping_label),
        mapping_statement: cleanText(line.mapping_statement),
        mapping_section: cleanText(line.mapping_section),
        mapping_path: cleanText(line.mapping_path),
        lead_schedule_number: cleanText(line.lead_schedule_number),
        lead_schedule_key: cleanText(line.lead_schedule_key),
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return {
      upserted: 0,
    };
  }

  const { error } = await supabase
    .from("afs_trial_balance_history")
    .upsert(rows, {
      onConflict:
        "engagement_id,financial_year_end,account_code",
    });

  if (error) throw error;

  return {
    upserted: rows.length,
  };
}

async function copyExistingTrialBalanceHistory(
  supabase: any,
  sourceEngagementId: string,
  targetEngagementId: string,
) {
  const { data, error } = await supabase
    .from("afs_trial_balance_history")
    .select("*")
    .eq("engagement_id", sourceEngagementId)
    .order("financial_year_end", { ascending: true });

  if (error) throw error;

  const sourceRows = data || [];

  if (sourceRows.length === 0) {
    return {
      copied: 0,
    };
  }

  const rows = sourceRows.map((row: AnyRow) => ({
    ...stripSystemFields(row),
    engagement_id: targetEngagementId,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("afs_trial_balance_history")
    .upsert(rows, {
      onConflict:
        "engagement_id,financial_year_end,account_code",
    });

  if (upsertError) throw upsertError;

  return {
    copied: rows.length,
  };
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

    const historyCopyResult =
      await copyExistingTrialBalanceHistory(
        supabase,
        sourceEngagementId,
        newEngagementId as string,
      );

    const historyUpsertResult =
      await upsertTrialBalanceHistory(
        supabase,
        sourceEngagement,
        sourceTrialBalance,
        newEngagementId as string,
      );

    const priorHistoryUpsertResult =
      await upsertPriorYearTrialBalanceHistory(
        supabase,
        sourceEngagement,
        sourceTrialBalance,
        newEngagementId as string,
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
        statement_overrides: buildRolledStatementOverrides(
          sourceSettings.statement_overrides || {},
        ),
        structured_notes_state: rollStructuredNotesToPrior(
          sourceSettings.structured_notes_state || {},
        ),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("afs_print_studio_settings")
        .insert(settingsInsert);

      if (error) throw error;
    }

    return {
      engagement: newEngagement,
      copied: {
        clientSetup: Boolean(setupResult.data),
        people: sourcePeople.length,
        trialBalanceLines: sourceTrialBalance.length,
        printStudioSettings: Boolean(printStudioResult.data),
        closingTransfer,
        historyCopied: historyCopyResult.copied,
        historyUpserted: historyUpsertResult.upserted,
        priorHistoryUpserted: priorHistoryUpsertResult.upserted,
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

    const refreshReason = cleanText(
      body.refreshReason ?? body.refresh_reason ?? body.reason,
    );

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

    if (existingEngagement?.id) {
      if (!refreshReason) {
        return NextResponse.json(
          {
            success: false,
            requiresRefreshReason: true,
            error:
              "A refresh reason is required before updating the existing Next Flight engagement.",
          },
          { status: 400 },
        );
      }

      const historyCopyResult =
        await copyExistingTrialBalanceHistory(
          supabase,
          sourceEngagementId,
          existingEngagement.id,
        );

      const historyUpsertResult =
        await upsertTrialBalanceHistory(
          supabase,
          sourceEngagement,
          sourceTrialBalance || [],
          existingEngagement.id,
        );

      const priorHistoryUpsertResult =
        await upsertPriorYearTrialBalanceHistory(
          supabase,
          sourceEngagement,
          sourceTrialBalance || [],
          existingEngagement.id,
        );

      const refreshResult = await refreshExistingTrialBalance(
        supabase,
        sourceTrialBalance || [],
        existingEngagement.id,
      );

      const printStudioRefresh =
        await refreshExistingPrintStudioSettings(
          supabase,
          sourceEngagementId,
          existingEngagement.id,
        );

      const engagementUpdate: AnyRow = {
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

      const { data: refreshAudit, error: auditError } = await supabase
        .from("afs_rollover_refresh_audit")
        .insert({
          organisation_id: sourceEngagement.organisation_id || null,
          source_engagement_id: sourceEngagementId,
          target_engagement_id: existingEngagement.id,
          refresh_reason: refreshReason,
          refreshed_by: null,
          source_financial_year_end:
            sourceEngagement.financial_year_end || null,
          target_financial_year_end:
            existingEngagement.financial_year_end || nextFinancialYearEnd,
          target_status_before:
            existingEngagement.status || null,
          target_status_after:
            refreshedEngagement.status || null,
          trial_balance_lines_updated:
            numberOrZero(refreshResult.updated),
          trial_balance_lines_inserted:
            numberOrZero(refreshResult.inserted),
          history_rows_copied:
            numberOrZero(historyCopyResult.copied),
          history_rows_upserted:
            numberOrZero(historyUpsertResult.upserted),
          prior_history_rows_upserted:
            numberOrZero(priorHistoryUpsertResult.upserted),
          print_studio_refreshed:
            Boolean(printStudioRefresh.updated),
          refreshed_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (auditError) throw auditError;

      return NextResponse.json({
        success: true,
        refreshed: true,
        created: false,
        message:
          "Existing Next Flight engagement refreshed successfully.",
        sourceEngagementId,
        engagement: refreshedEngagement,
        nextFinancialYearEnd,
        refreshReason,
        refreshAudit,
        refresh: {
          ...refreshResult,
          printStudio: printStudioRefresh,
          historyCopied: historyCopyResult.copied,
          historyUpserted: historyUpsertResult.upserted,
          priorHistoryUpserted: priorHistoryUpsertResult.upserted,
        },
      });
    }

    const createdResult = await createNewRollover(
      supabase,
      sourceEngagement,
      sourceEngagementId,
      nextFinancialYearEnd,
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
