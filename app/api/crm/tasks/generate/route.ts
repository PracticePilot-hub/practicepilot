import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type RelationValue<T> = T | T[] | null | undefined;

type ClientRelation = {
  client_name: string | null;
  organisation_id: string | null;
  year_end: string | null;
  client_lead_user_id: string | null;
  manager_user_id: string | null;
  partner_user_id: string | null;
};

type ServiceRelation = {
  service_name: string | null;
};

type ClientServiceRow = {
  id: string;
  organisation_id: string | null;
  client_id: string;
  service_id: string;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  service_settings: Record<string, any> | null;
  task_generation_enabled: boolean | null;
  last_generated_until: string | null;
  next_generation_date: string | null;
  crm_clients: RelationValue<ClientRelation>;
  crm_services: RelationValue<ServiceRelation>;
};

type TaskPlan = {
  serviceName: string;
  titleServiceName: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
};

type ExistingWork = {
  id: string;
  workflow_id?: string | null;
  workflow_stage: string | null;
  status: string | null;
  completed_at: string | null;
};

type ChecklistTemplateItem = {
  label: string;
  item_type?: "manual" | "dependency" | "review" | "submission";
  dependency_service_code?: string | null;
  dependency_rule?: string | null;
};

type ResolvedChecklistPlan = {
  source: "practice" | "system";
  enabled: boolean;
  templateKey: string;
  steps: ChecklistTemplateItem[];
};

function getSingleRelation<T>(value: RelationValue<T>): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addCalendarMonths(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    clampDay(target.getFullYear(), target.getMonth(), date.getDate())
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

const YEAR_END_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function financialYearDates(financialYear: number, yearEndName: string | null | undefined) {
  const normalised = String(yearEndName || "February").trim().toLowerCase();
  const monthIndex = Math.max(
    0,
    YEAR_END_MONTHS.findIndex((month) => month.toLowerCase() === normalised)
  );

  const periodEnd = new Date(financialYear, monthIndex + 1, 0);
  const periodStart = new Date(financialYear - 1, monthIndex + 1, 1);

  return { periodStart, periodEnd };
}

function vatMonthsPerPeriod(settings: Record<string, any>, fallbackFrequency?: string | null) {
  const category = String(settings?.vat_category || "").trim().toUpperCase();
  if (category === "C") return 1;
  if (category === "A" || category === "B") return 2;
  return Math.max(1, monthsForFrequency(fallbackFrequency || "bi_monthly"));
}

function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.max(1, Math.min(day, lastDay));
}

function getDueDateAfterPeriod(
  periodEnd: Date,
  monthsAfter: number,
  dueDay: number
) {
  const dueMonth = new Date(
    periodEnd.getFullYear(),
    periodEnd.getMonth() + monthsAfter,
    1
  );

  return new Date(
    dueMonth.getFullYear(),
    dueMonth.getMonth(),
    clampDay(dueMonth.getFullYear(), dueMonth.getMonth(), dueDay)
  );
}

function normalFrequency(value: string | null | undefined) {
  const frequency = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (["weekly", "week"].includes(frequency)) return "weekly";
  if (["fortnightly", "fortnight", "bi_weekly", "biweekly"].includes(frequency)) {
    return "fortnightly";
  }
  if (["monthly", "month"].includes(frequency)) return "monthly";
  if (["bi_monthly", "bimonthly", "2_monthly", "two_monthly"].includes(frequency)) {
    return "bi_monthly";
  }
  if (["quarterly", "3_monthly", "three_monthly"].includes(frequency)) {
    return "quarterly";
  }
  if (["six_monthly", "6_monthly", "half_yearly", "biannual", "bi_annual"].includes(frequency)) {
    return "six_monthly";
  }
  if (["annual", "annually", "yearly"].includes(frequency)) return "annual";

  return frequency || "annual";
}

function monthsForFrequency(value: string | null | undefined) {
  const frequency = normalFrequency(value);

  if (frequency === "weekly" || frequency === "fortnightly") return 0;
  if (frequency === "monthly") return 1;
  if (frequency === "bi_monthly") return 2;
  if (frequency === "quarterly") return 3;
  if (frequency === "six_monthly") return 6;
  if (frequency === "annual") return 12;

  return 12;
}

function getMonthlyTask(
  startDate: Date,
  serviceName: string,
  dueDay: number,
  monthsInPeriod = 1,
  dueInSameMonth = false
): TaskPlan {
  const periodStart = startOfMonth(startDate);
  const periodEnd = getMonthEnd(addMonths(periodStart, monthsInPeriod - 1));

  const dueDate = dueInSameMonth
    ? new Date(
        periodEnd.getFullYear(),
        periodEnd.getMonth(),
        clampDay(periodEnd.getFullYear(), periodEnd.getMonth(), dueDay)
      )
    : getDueDateAfterPeriod(periodEnd, 1, dueDay);

  return {
    serviceName,
    titleServiceName: serviceName,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getPayrollTask(
  startDate: Date,
  serviceName: string,
  frequency: string | null,
  settings: Record<string, any>
): TaskPlan {
  const normal = normalFrequency(frequency || "monthly");

  if (normal === "weekly" || normal === "fortnightly") {
    const periodStart = new Date(startDate);
    const periodEnd = addDays(periodStart, normal === "weekly" ? 6 : 13);

    return {
      serviceName,
      titleServiceName: serviceName,
      periodStart,
      periodEnd,
      dueDate: new Date(periodEnd),
    };
  }

  return getMonthlyTask(
    startDate,
    serviceName,
    Number(settings?.due_day || settings?.pay_day || 25),
    1,
    true
  );
}

function getVatTask(
  startDate: Date,
  serviceName: string,
  settings: Record<string, any>,
  clientFrequency?: string | null
): TaskPlan {
  const monthsInPeriod = vatMonthsPerPeriod(settings, clientFrequency);
  const periodStart = startOfMonth(startDate);

  const configuredStart = String(settings?.first_period_start || "");
  const configuredEnd = String(settings?.first_period_end || "");
  const configuredDue = String(settings?.first_due_date || "");

  const isConfiguredFirstPeriod =
    configuredStart &&
    formatDateOnly(periodStart) === formatDateOnly(parseDateOnly(configuredStart));

  const periodEnd =
    isConfiguredFirstPeriod && configuredEnd
      ? parseDateOnly(configuredEnd)
      : getMonthEnd(addMonths(periodStart, monthsInPeriod - 1));

  const dueDay = Number(settings?.due_day || 25);
  const dueDate =
    isConfiguredFirstPeriod && configuredDue
      ? parseDateOnly(configuredDue)
      : getDueDateAfterPeriod(periodEnd, 1, dueDay);

  return {
    serviceName,
    titleServiceName: serviceName,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getFinancialStatementsTask(
  serviceName: string,
  settings: Record<string, any>,
  clientYearEnd: string | null | undefined,
  cycleIndex = 0
): TaskPlan {
  const year = Number(settings?.tasking_year || 0) + cycleIndex;
  if (!year) {
    throw new Error("Financial Statements needs a financial year in Tasking Setup.");
  }

  const { periodStart, periodEnd } = financialYearDates(year, clientYearEnd);

  // PracticePilot work due date. This is a workflow date, not a statutory filing date.
  const dueDate = getMonthEnd(addMonths(startOfMonth(periodEnd), 6));

  return {
    serviceName,
    titleServiceName: `Financial Statements ${year}`,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getIncomeTaxTask(
  serviceName: string,
  settings: Record<string, any>,
  clientYearEnd: string | null | undefined,
  cycleIndex = 0
): TaskPlan {
  const year = Number(settings?.tasking_year || 0) + cycleIndex;
  if (!year) {
    throw new Error("Income Tax needs a tax year in Tasking Setup.");
  }

  const { periodStart, periodEnd } = financialYearDates(year, clientYearEnd);

  // CRM workflow date, not the statutory ITR14 deadline.
  // AFS target = 6 months after year-end.
  // Income Tax target = month-end immediately after the AFS target.
  const afsDueDate = getMonthEnd(addMonths(startOfMonth(periodEnd), 6));
  const dueDate = getMonthEnd(addMonths(startOfMonth(afsDueDate), 1));

  return {
    serviceName,
    titleServiceName: `Income Tax ${year}`,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getExactConfiguredAnnualTask(
  startDate: Date,
  serviceName: string,
  settings: Record<string, any>,
  defaultDueMonthsAfter: number,
  cycleIndex = 0
): TaskPlan {
  const periodStart = new Date(startDate);
  const configuredStart = String(settings?.first_period_start || "").trim();
  const configuredEnd = String(settings?.first_period_end || "").trim();
  const isConfiguredFirstPeriod =
    configuredStart &&
    formatDateOnly(periodStart) === formatDateOnly(parseDateOnly(configuredStart));

  const periodEnd = isConfiguredFirstPeriod && configuredEnd
    ? parseDateOnly(configuredEnd)
    : new Date(
        periodStart.getFullYear() + 1,
        periodStart.getMonth(),
        periodStart.getDate() - 1
      );

  let dueDate: Date;

  if (serviceName === "Income Tax") {
    dueDate = new Date(
      periodEnd.getFullYear() + 1,
      periodEnd.getMonth(),
      clampDay(
        periodEnd.getFullYear() + 1,
        periodEnd.getMonth(),
        periodEnd.getDate()
      )
    );
  } else if (serviceName === "Financial Statements") {
    const dueMonth = new Date(
      periodEnd.getFullYear(),
      periodEnd.getMonth() + defaultDueMonthsAfter,
      1
    );
    dueDate = getMonthEnd(dueMonth);
  } else {
    const dueMonthsAfter = Number(
      settings?.due_months_after ?? defaultDueMonthsAfter
    );
    const dueDay = Number(settings?.due_day || 31);
    dueDate = getDueDateAfterPeriod(periodEnd, dueMonthsAfter, dueDay);
  }

  const configuredYear = Number(settings?.tasking_year || 0);
  const cycleYear = configuredYear
    ? configuredYear + cycleIndex
    : periodEnd.getFullYear();

  const titleServiceName =
    serviceName === "Beneficial Ownership Declaration"
      ? `Beneficial Ownership ${cycleYear}`
      : serviceName === "Workmans Compensation"
        ? `Workman's Compensation ${cycleYear}`
        : serviceName === "WCA Letter of Good Standing"
          ? `WCA Letter of Good Standing ${cycleYear}`
          : `${serviceName} ${cycleYear}`;

  return {
    serviceName,
    titleServiceName,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getProvisionalTaxTask(
  startDate: Date,
  serviceName: string,
  settings: Record<string, any>,
  clientYearEnd: string | null | undefined,
  cycleIndex = 0
): TaskPlan {
  const firstYear = Number(settings?.tasking_year || 0);
  if (!firstYear) {
    throw new Error("Provisional Tax needs a tax year in Tasking Setup.");
  }

  const firstPeriod = Number(
    settings?.provisional_period || settings?.payment_number || 1
  );

  let year = firstYear;
  let period = firstPeriod;

  if (firstPeriod === 1) {
    year = firstYear + Math.floor(cycleIndex / 2);
    period = cycleIndex % 2 === 0 ? 1 : 2;
  } else if (firstPeriod === 2) {
    if (cycleIndex === 0) {
      year = firstYear;
      period = 2;
    } else {
      const shifted = cycleIndex - 1;
      year = firstYear + 1 + Math.floor(shifted / 2);
      period = shifted % 2 === 0 ? 1 : 2;
    }
  } else {
    if (cycleIndex === 0) {
      year = firstYear;
      period = 3;
    } else {
      const shifted = cycleIndex - 1;
      year = firstYear + 1 + Math.floor(shifted / 2);
      period = shifted % 2 === 0 ? 1 : 2;
    }
  }

  const { periodStart: financialYearStart, periodEnd: financialYearEnd } =
    financialYearDates(year, clientYearEnd);

  let periodStart = financialYearStart;
  let periodEnd: Date;
  let dueDate: Date;

  if (period === 1) {
    // First provisional payment = six months into the financial year.
    periodEnd = getMonthEnd(addMonths(startOfMonth(financialYearStart), 5));
    dueDate = periodEnd;
  } else if (period === 2) {
    // Second provisional payment = financial year-end.
    periodEnd = financialYearEnd;
    dueDate = financialYearEnd;
  } else {
    // Third/top-up workflow target = seven months after year-end.
    periodEnd = financialYearEnd;
    dueDate = getMonthEnd(addMonths(startOfMonth(financialYearEnd), 7));
  }

  return {
    serviceName,
    titleServiceName: `Provisional Tax ${year}/${String(period).padStart(2, "0")}`,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getEmp501Task(
  startDate: Date,
  serviceName: string,
  settings: Record<string, any>,
  cycleIndex = 0
): TaskPlan {
  const firstYear = Number(settings?.tasking_year || startDate.getFullYear());
  const firstCycle = String(
    settings?.emp501_cycle || settings?.cycle || "interim"
  ).toLowerCase();

  let year = firstYear;
  let cycle = firstCycle;

  if (firstCycle === "interim") {
    year = firstYear + Math.floor(cycleIndex / 2);
    cycle = cycleIndex % 2 === 0 ? "interim" : "annual";
  } else {
    if (cycleIndex === 0) {
      year = firstYear;
      cycle = "annual";
    } else {
      const shifted = cycleIndex - 1;
      year = firstYear + 1 + Math.floor(shifted / 2);
      cycle = shifted % 2 === 0 ? "interim" : "annual";
    }
  }

  const periodStart = new Date(year - 1, 2, 1);
  const periodEnd =
    cycle === "annual"
      ? new Date(year, 1, new Date(year, 2, 0).getDate())
      : new Date(year - 1, 7, 31);

  const dueDate =
    cycle === "annual"
      ? new Date(year, 4, 31)
      : new Date(year - 1, 9, 31);

  return {
    serviceName,
    titleServiceName:
      cycle === "annual"
        ? `EMP501 Annual ${year}`
        : `EMP501 Interim ${year}`,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function buildTaskPlan(
  serviceName: string,
  startDate: Date,
  frequency: string | null,
  settings: Record<string, any>,
  clientYearEnd?: string | null,
  cycleIndex = 0
): TaskPlan | null {
  if (serviceName === "VAT201") {
    return getVatTask(startDate, serviceName, settings, frequency);
  }

  if (serviceName === "Payroll") {
    return getPayrollTask(startDate, serviceName, frequency, settings);
  }

  if (serviceName === "EMP201" || serviceName === "UIF") {
    return getMonthlyTask(
      startDate,
      serviceName,
      Number(settings?.due_day || 7),
      Math.max(1, monthsForFrequency(frequency || "monthly"))
    );
  }

  if (serviceName === "Accounting") {
    return getMonthlyTask(
      startDate,
      serviceName,
      Number(settings?.due_day || 25),
      Math.max(1, monthsForFrequency(frequency || "monthly"))
    );
  }

  if (serviceName === "Management Reports") {
    return getMonthlyTask(
      startDate,
      serviceName,
      Number(settings?.due_day || 10),
      Math.max(1, monthsForFrequency(frequency || "monthly"))
    );
  }

  if (serviceName === "EMP501") {
    return getEmp501Task(startDate, serviceName, settings, cycleIndex);
  }

  if (serviceName === "Provisional Tax") {
    return getProvisionalTaxTask(
      startDate,
      serviceName,
      settings,
      clientYearEnd,
      cycleIndex
    );
  }

  if (serviceName === "Financial Statements") {
    return getFinancialStatementsTask(serviceName, settings, clientYearEnd, cycleIndex);
  }

  if (serviceName === "Income Tax") {
    return getIncomeTaxTask(serviceName, settings, clientYearEnd, cycleIndex);
  }

  if (
    serviceName === "CIPC Annual Return" ||
    serviceName === "Beneficial Ownership Declaration" ||
    serviceName === "Workmans Compensation" ||
    serviceName === "WCA Letter of Good Standing"
  ) {
    return getExactConfiguredAnnualTask(
      startDate,
      serviceName,
      settings,
      1,
      cycleIndex
    );
  }

  const months = monthsForFrequency(frequency);
  if (months > 0 && months < 12) {
    return getMonthlyTask(
      startDate,
      serviceName,
      Number(settings?.due_day || 25),
      months
    );
  }

  return null;
}

function getNextPeriodStart(
  plan: TaskPlan,
  frequency: string | null,
  serviceName: string
) {
  const normal = normalFrequency(frequency);

  if (normal === "weekly") return addDays(plan.periodStart, 7);
  if (normal === "fortnightly") return addDays(plan.periodStart, 14);

  if (serviceName === "VAT201") {
    // Category A/B always move in two-month blocks. Category C moves monthly.
    // Do not trust a stale crm_client_services.frequency value here.
    const months = plan.periodEnd.getMonth() === plan.periodStart.getMonth() ? 1 : 2;
    return addMonths(startOfMonth(plan.periodStart), months);
  }

  return addMonths(
    startOfMonth(plan.periodStart),
    Math.max(1, monthsForFrequency(frequency))
  );
}

function buildWorkflowStage(plan: TaskPlan) {
  return `${formatDateOnly(plan.periodStart)}:${formatDateOnly(plan.periodEnd)}`;
}

function buildDescription(plan: TaskPlan) {
  return `Period: ${formatDateOnly(plan.periodStart)} → ${formatDateOnly(plan.periodEnd)}`;
}

function isCompleted(work: ExistingWork | undefined) {
  return Boolean(
    work &&
      (String(work.status || "").toLowerCase() === "completed" ||
        work.completed_at)
  );
}

function futurePeriodRetentionCount(serviceName: string) {
  // PracticePilot keeps a minimum number of UPCOMING OPEN periods visible.
  // Completed periods do not count toward the quota, and overdue/open WIP is
  // preserved separately. This means finishing work early immediately exposes
  // the next valid period instead of shrinking the planning window.
  if (
    serviceName === "Accounting" ||
    serviceName === "Payroll" ||
    serviceName === "EMP201" ||
    serviceName === "UIF" ||
    serviceName === "VAT201" ||
    serviceName === "Management Reports"
  ) {
    return 3;
  }

  if (
    serviceName === "EMP501" ||
    serviceName === "Provisional Tax" ||
    serviceName === "Financial Statements"
  ) {
    return 2;
  }

  if (
    serviceName === "Income Tax" ||
    serviceName === "CIPC Annual Return" ||
    serviceName === "Beneficial Ownership Declaration" ||
    serviceName === "Workmans Compensation" ||
    serviceName === "WCA Letter of Good Standing"
  ) {
    return 1;
  }

  // Sensible default for any other recurring service.
  return 3;
}

function isRollingCycleService(serviceName: string) {
  return [
    "EMP501",
    "Provisional Tax",
    "Financial Statements",
    "Income Tax",
    "CIPC Annual Return",
    "Beneficial Ownership Declaration",
    "Workmans Compensation",
    "WCA Letter of Good Standing",
  ].includes(serviceName);
}

function checklistTemplate(serviceName: string): ChecklistTemplateItem[] {
  const templates: Record<string, ChecklistTemplateItem[]> = {
    Accounting: [
      { label: "All bank statements received" },
      { label: "Transactions captured / imported" },
      { label: "Bank reconciliations completed" },
      { label: "Debtors reviewed" },
      { label: "Creditors reviewed" },
      { label: "Payroll posted and reconciled" },
      { label: "Suspense / clearing accounts cleared" },
      { label: "VAT / tax control accounts checked" },
      { label: "Review completed" },
      { label: "Queries cleared" },
    ],
    Payroll: [
      { label: "Employee changes and payroll inputs received" },
      { label: "Payroll processed" },
      { label: "Leave, overtime and variable items checked" },
      { label: "Net pay and deductions verified" },
      { label: "Payroll journal prepared / posted" },
      { label: "Payroll reviewed" },
      { label: "Payment schedule / payslips issued" },
    ],
    EMP201: [
      {
        label: "Payroll for this period completed",
        item_type: "dependency",
        dependency_service_code: "Payroll",
        dependency_rule: "same_period_all_completed",
      },
      { label: "PAYE / UIF / SDL reconciled to payroll" },
      { label: "EMP201 values reviewed" },
      { label: "Return submitted" },
      { label: "Submission proof filed" },
    ],
    UIF: [
      {
        label: "Payroll for this period completed",
        item_type: "dependency",
        dependency_service_code: "Payroll",
        dependency_rule: "same_period_all_completed",
      },
      { label: "UIF contributor information checked" },
      { label: "UIF amount reconciled" },
      { label: "Return submitted" },
      { label: "Submission proof filed" },
    ],
    VAT201: [
      {
        label: "Accounting for the VAT period completed",
        item_type: "dependency",
        dependency_service_code: "Accounting",
        dependency_rule: "covered_period_all_completed",
      },
      { label: "Bank reconciliations completed" },
      { label: "Sales reconciled to VAT output" },
      { label: "Purchases reconciled to VAT input" },
      { label: "Exceptions / unusual transactions checked" },
      { label: "VAT control account reconciled" },
      { label: "Supporting documents complete" },
      { label: "Return reviewed" },
      { label: "Ready for submission" },
      { label: "Submitted and proof filed" },
    ],
    EMP501: [
      {
        label: "EMP201 periods for the reconciliation period completed",
        item_type: "dependency",
        dependency_service_code: "EMP201",
        dependency_rule: "covered_period_all_completed",
      },
      { label: "Payroll reconciliation completed" },
      { label: "IRP5 / IT3(a) data checked" },
      { label: "ETI reviewed where applicable" },
      { label: "EasyFile / validation errors cleared" },
      { label: "EMP501 reviewed" },
      { label: "Submitted and proof filed" },
    ],
    "Financial Statements": [
      {
        label: "Accounting for the financial year completed",
        item_type: "dependency",
        dependency_service_code: "Accounting",
        dependency_rule: "covered_period_all_completed",
      },
      { label: "Trial balance / import complete" },
      { label: "Mapping complete" },
      { label: "Lead schedules complete" },
      { label: "Financial statements prepared" },
      { label: "Tax balances reconciled" },
      { label: "Review points cleared" },
      { label: "Financial statements reviewed" },
      { label: "Final sign-off complete" },
    ],
    "Income Tax": [
      {
        label: "Financial statements for the tax year completed",
        item_type: "dependency",
        dependency_service_code: "Financial Statements",
        dependency_rule: "same_period_all_completed",
      },
      { label: "Tax computation completed" },
      { label: "Tax return prepared" },
      { label: "Tax return reviewed" },
      { label: "Return submitted and proof filed" },
    ],
    "Provisional Tax": [
      { label: "Latest accounting / management information available" },
      { label: "Estimated taxable income calculated" },
      { label: "Prior assessment / basic amount considered" },
      { label: "Provisional tax calculation reviewed" },
      { label: "IRP6 submitted" },
      { label: "Payment instruction / proof filed" },
    ],
    "CIPC Annual Return": [
      { label: "Company information confirmed" },
      { label: "Turnover / annual return information confirmed" },
      { label: "Annual return filed" },
      { label: "Filing confirmation stored" },
    ],
    "Beneficial Ownership Declaration": [
      { label: "Shareholding information confirmed" },
      { label: "Beneficial ownership structure reviewed" },
      { label: "Beneficial owners confirmed" },
      { label: "Declaration filed" },
      { label: "Filing confirmation stored" },
    ],
    "Workmans Compensation": [
      { label: "Payroll / earnings information for the return period confirmed" },
      { label: "Return of Earnings information prepared" },
      { label: "Assessment / submission reviewed" },
      { label: "Return submitted" },
      { label: "Submission proof filed" },
    ],
    "WCA Letter of Good Standing": [
      {
        label: "Workman's Compensation return / assessment up to date",
        item_type: "dependency",
        dependency_service_code: "Workmans Compensation",
        dependency_rule: "covered_period_all_completed",
      },
      { label: "Outstanding assessment balance checked" },
      { label: "Letter of Good Standing requested / renewed" },
      { label: "Current Letter of Good Standing filed" },
    ],
    "Management Reports": [
      {
        label: "Accounting for the reporting period completed",
        item_type: "dependency",
        dependency_service_code: "Accounting",
        dependency_rule: "covered_period_all_completed",
      },
      { label: "Management report pack prepared" },
      { label: "Material variances investigated" },
      { label: "Report reviewed" },
      { label: "Report issued to client" },
    ],
  };

  return (
    templates[serviceName] || [
      { label: "Work completed" },
      { label: "Work reviewed / checked" },
      { label: "Supporting evidence / communication filed" },
    ]
  );
}

async function resolveChecklistPlan(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string,
  serviceName: string
): Promise<ResolvedChecklistPlan> {
  const { data: practiceTemplate, error: templateError } = await supabase
    .from("crm_workflow_templates")
    .select("id, is_enabled")
    .eq("organisation_id", organisationId)
    .eq("service_name", serviceName)
    .maybeSingle();

  if (templateError) throw templateError;

  if (!practiceTemplate?.id) {
    return {
      source: "system",
      enabled: true,
      templateKey: `system:${serviceName}`,
      steps: checklistTemplate(serviceName),
    };
  }

  if (practiceTemplate.is_enabled === false) {
    return {
      source: "practice",
      enabled: false,
      templateKey: `practice:${practiceTemplate.id}`,
      steps: [],
    };
  }

  const { data: practiceSteps, error: stepsError } = await supabase
    .from("crm_workflow_template_steps")
    .select(
      "item_order, label, item_type, is_active, dependency_service_code, dependency_rule"
    )
    .eq("template_id", practiceTemplate.id)
    .eq("is_active", true)
    .order("item_order", { ascending: true });

  if (stepsError) throw stepsError;

  return {
    source: "practice",
    enabled: true,
    templateKey: `practice:${practiceTemplate.id}`,
    steps: (practiceSteps || [])
      .map((step: any) => ({
        label: String(step.label || "").trim(),
        item_type:
          step.item_type === "dependency" ||
          step.item_type === "review" ||
          step.item_type === "submission"
            ? step.item_type
            : "manual",
        dependency_service_code:
          step.item_type === "dependency"
            ? String(step.dependency_service_code || "").trim() || null
            : null,
        dependency_rule:
          step.item_type === "dependency"
            ? String(step.dependency_rule || "").trim() ||
              "covered_period_all_completed"
            : null,
      }))
      .filter((step: ChecklistTemplateItem) => step.label),
  };
}

async function createChecklistForNewWork(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  workItemId: string,
  plan: ResolvedChecklistPlan
) {
  if (!plan.enabled || plan.steps.length === 0) return;

  const rows = plan.steps.map((item, index) => ({
    work_item_id: workItemId,
    item_order: index + 1,
    label: item.label,
    status: "outstanding",
    item_type: item.item_type || "manual",
    template_key: plan.templateKey,
    dependency_service_code: item.dependency_service_code || null,
    dependency_rule: item.dependency_rule || null,
  }));

  const { error } = await supabase
    .from("crm_work_item_checklist")
    .insert(rows);

  if (error) throw error;
}

async function resolveAssignedAuthUserId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  client: ClientRelation,
  profileMap: Map<string, string>
) {
  const profileId =
    client.client_lead_user_id ||
    client.manager_user_id ||
    client.partner_user_id ||
    null;

  if (!profileId) return null;

  if (profileMap.has(profileId)) {
    return profileMap.get(profileId) || null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;

  const userId = data?.user_id ? String(data.user_id) : "";
  if (userId) profileMap.set(profileId, userId);

  return userId || null;
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    let requestedClientId = "";

    try {
      const body = await request.json();
      requestedClientId = String(body?.clientId || "").trim();
    } catch {
      // Admin/manual generation may call without JSON.
    }

    let query = supabase
      .from("crm_client_services")
      .select(
        `
        id,
        organisation_id,
        client_id,
        service_id,
        frequency,
        start_date,
        end_date,
        service_settings,
        task_generation_enabled,
        last_generated_until,
        next_generation_date,
        crm_clients (
          client_name,
          organisation_id,
          year_end,
          client_lead_user_id,
          manager_user_id,
          partner_user_id
        ),
        crm_services (
          service_name
        )
      `
      )
      .eq("is_active", true)
      .eq("task_generation_enabled", true);

    if (requestedClientId) {
      query = query.eq("client_id", requestedClientId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const clientServices = (data || []) as ClientServiceRow[];
    const profileMap = new Map<string, string>();

    const created: any[] = [];
    const updated: string[] = [];
    const deleted: string[] = [];
    const skipped: Array<{ client_service_id: string; reason: string }> = [];

    for (const clientService of clientServices) {
      const client = getSingleRelation(clientService.crm_clients);
      const service = getSingleRelation(clientService.crm_services);

      const serviceName = String(service?.service_name || "").trim();
      const clientName = String(client?.client_name || "").trim();
      const organisationId =
        clientService.organisation_id || client?.organisation_id || null;

      if (!serviceName || !clientName || !organisationId || !clientService.start_date) {
        skipped.push({
          client_service_id: clientService.id,
          reason: "Missing client, organisation, service or starting period.",
        });
        continue;
      }

      const settings = {
        ...(clientService.service_settings || {}),
      };

      if (!settings.first_period_start && clientService.start_date) {
        settings.first_period_start = clientService.start_date;
      }

      if (!settings.first_period_end && clientService.end_date) {
        settings.first_period_end = clientService.end_date;
      }

      const assignedUserId = await resolveAssignedAuthUserId(
        supabase,
        client || {
          client_name: clientName,
          organisation_id: organisationId,
          year_end: null,
          client_lead_user_id: null,
          manager_user_id: null,
          partner_user_id: null,
        },
        profileMap
      );

      // Resolve the practice's checklist ONCE for this client service run.
      // A saved practice workflow overrides the PracticePilot standard.
      // If the practice has disabled checklists for the service, new work gets no checklist.
      const resolvedChecklistPlan = await resolveChecklistPlan(
        supabase,
        organisationId,
        serviceName
      );

      /*
       * Reconcile ALL auto-generated work for this CLIENT + SERVICE.
       *
       * Do not restrict this lookup to the current crm_client_services.id.
       * A service can be edited/re-saved/recreated during onboarding and older
       * generated work may still point at a previous client-service record.
       * If we only query workflow_id = current id, those stale rows can never
       * be removed and the client ends up with duplicate VAT/AFS/etc work.
       *
       * Completed work is protected below and will never be deleted.
       */
      const { data: existingRows, error: existingError } = await supabase
        .from("crm_work_items")
        .select("id, workflow_id, workflow_stage, status, completed_at")
        .eq("client_id", clientService.client_id)
        .eq("service_code", serviceName)
        .eq("workflow_type", "recurring_client_service")
        .eq("source_module", "crm");

      if (existingError) throw existingError;

      const existing = (existingRows || []) as ExistingWork[];
      const existingByStage = new Map(
        existing
          .filter((row) => row.workflow_stage)
          .map((row) => [String(row.workflow_stage), row])
      );

      const desiredPlans: TaskPlan[] = [];
      const desiredStages = new Set<string>();

      const today = parseDateOnly(formatDateOnly(new Date()));
      const futurePeriodsToKeep = futurePeriodRetentionCount(serviceName);

      let cursor = parseDateOnly(clientService.start_date);
      let attempts = 0;
      let cycleIndex = 0;
      let upcomingOpenPeriods = 0;

      while (attempts < 240) {
        const plan = buildTaskPlan(
          serviceName,
          cursor,
          clientService.frequency,
          settings,
          client?.year_end || null,
          cycleIndex
        );

        if (!plan) break;

        const stage = buildWorkflowStage(plan);
        desiredStages.add(stage);

        const existingAtStage = existingByStage.get(stage);
        const completedAtStage = isCompleted(existingAtStage);

        if (!completedAtStage) {
          desiredPlans.push(plan);

          // Only genuinely upcoming OPEN periods count toward the planning quota.
          // Overdue/current WIP remains visible but does not consume future capacity.
          if (plan.dueDate.getTime() > today.getTime()) {
            upcomingOpenPeriods += 1;
          }
        }

        // Once the minimum future planning window is full, stop. Historical
        // overdue/open work has already been retained because we walked the
        // schedule forward from the configured starting period.
        if (upcomingOpenPeriods >= futurePeriodsToKeep) {
          break;
        }

        if (isRollingCycleService(serviceName)) {
          cycleIndex += 1;

          if (
            serviceName === "CIPC Annual Return" ||
            serviceName === "Beneficial Ownership Declaration" ||
            serviceName === "Workmans Compensation" ||
            serviceName === "WCA Letter of Good Standing"
          ) {
            cursor = addCalendarMonths(cursor, 12);
          }
        } else {
          const next = getNextPeriodStart(
            plan,
            clientService.frequency,
            serviceName
          );

          if (next.getTime() <= cursor.getTime()) {
            throw new Error(
              `Task generation could not advance for ${serviceName}.`
            );
          }

          cursor = next;
        }

        attempts += 1;
      }

      // Remove ONLY invalid / stale, uncompleted auto-generated work for this service.
      // Valid historical periods remain in desiredStages, so overdue WIP is preserved.
      // Completed work is always preserved. This also removes old over-generated rows
      // outside the current rolling horizon or from an incorrect prior setup.
      const obsolete = existing.filter((row) => {
        if (isCompleted(row)) return false;
        return !row.workflow_stage || !desiredStages.has(String(row.workflow_stage));
      });

      if (obsolete.length) {
        const obsoleteIds = obsolete.map((row) => row.id);
        const { error: deleteError } = await supabase
          .from("crm_work_items")
          .delete()
          .in("id", obsoleteIds);

        if (deleteError) throw deleteError;
        deleted.push(...obsoleteIds);
      }

      // Ensure each desired open period exists and carries the current dates/setup.
      for (const plan of desiredPlans) {
        const stage = buildWorkflowStage(plan);
        const existingAtStage = existingByStage.get(stage);
        const payload = {
          organisation_id: organisationId,
          client_id: clientService.client_id,
          title: `${plan.titleServiceName} - ${clientName}`,
          description: buildDescription(plan),
          work_type: "task",
          priority: "normal",
          assigned_user_id: assignedUserId,
          due_date: formatDateOnly(plan.dueDate),
          is_all_day: true,
          is_personal: false,
          workflow_type: "recurring_client_service",
          workflow_id: clientService.id,
          workflow_stage: stage,
          service_code: serviceName,
          source_module: "crm",
        };

        if (existingAtStage && !isCompleted(existingAtStage)) {
          const { error: updateError } = await supabase
            .from("crm_work_items")
            .update({
              ...payload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingAtStage.id);

          if (updateError) throw updateError;
          updated.push(existingAtStage.id);
          // Deliberately do not alter this existing work item's checklist.
          // Workflow-setting changes apply only to work created after the change.
          continue;
        }

        if (!existingAtStage) {
          const { data: inserted, error: insertError } = await supabase
            .from("crm_work_items")
            .insert({
              ...payload,
              status: "not_started",
              waiting_on: null,
              waiting_since: null,
            })
            .select("id, title, service_code, due_date")
            .single();

          if (insertError) throw insertError;

          created.push(inserted);
          await createChecklistForNewWork(
            supabase,
            inserted.id,
            resolvedChecklistPlan
          );
        }
      }

      const lastPlan = desiredPlans[desiredPlans.length - 1] || null;

      const { error: serviceUpdateError } = await supabase
        .from("crm_client_services")
        .update({
          last_generated_until: lastPlan
            ? formatDateOnly(lastPlan.periodEnd)
            : clientService.last_generated_until,
          // The daily generator is now future-period-count driven, not completion-driven.
          // next_generation_date is informational only; the cron may safely run daily.
          next_generation_date: formatDateOnly(today),
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientService.id);

      if (serviceUpdateError) throw serviceUpdateError;
    }

    return NextResponse.json({
      success: true,
      client_id: requestedClientId || null,
      services_checked: clientServices.length,
      created_count: created.length,
      updated_count: updated.length,
      deleted_obsolete_count: deleted.length,
      created,
      skipped,
      policy: {
        future_period_retention: {
          operational_default: 3,
          financial_statements: 2,
          provisional_tax: 2,
          emp501: 2,
          annual_default: 1,
        },
        generation_independent_of_completion: true,
        completed_periods_do_not_count_toward_future_quota: true,
        overdue_work_preserved: true,
        completed_work_preserved: true,
        manual_work_preserved: true,
        recurring_schedule_is_period_count_driven: true,
      },
    });
  } catch (error: any) {
    console.error("Task generation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Task generation failed.",
      },
      { status: 500 }
    );
  }
}
