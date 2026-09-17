"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type UserOption = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
};

type ServiceOption = {
  id: string;
  service_name: string;
  service_group: string | null;
  default_frequency: string | null;
  default_due_day?: number | null;
  default_workflow_type?: string | null;
  default_service_settings?: Record<string, unknown>;
  colour_hex?: string | null;
  text_colour_hex?: string | null;
  is_active?: boolean | null;
};

type ServiceState = {
  selected: boolean;
  frequency: string;
  firstPeriodStart: string;
  firstPeriodEnd: string;
  settings: Record<string, unknown>;
};

type ClientApiData = {
  id: string;
  client_name: string;
  entity_type: string | null;
  client_category: "individual" | "entity" | "trust" | null;
  engagement_type:
    | "ongoing_monthly"
    | "annual_monthly_retainer"
    | "annual_ad_hoc"
    | null;
  relationship_status:
    | "flying_client"
    | "in_airspace"
    | "on_radar"
    | "former_client"
    | null;
  client_code: string | null;
  status: string | null;
  year_end: string | null;
  trading_name: string | null;
  registration_number: string | null;
  registration_date: string | null;
  id_passport_number: string | null;
  date_of_birth: string | null;

  vat_number: string | null;
  paye_number: string | null;
  tax_number: string | null;
  uif_registration_number: string | null;
  customs_number: string | null;
  sdl_registered: boolean | null;
  wcc_reference_number: string | null;

  client_lead_user_id: string | null;
  manager_user_id: string | null;
  partner_user_id: string | null;

  crm_client_contacts?: Array<{
    contact_name: string | null;
    contact_position: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    is_primary: boolean | null;
  }>;

  crm_client_addresses?: Array<{
    address_type: string;
    line_1: string | null;
    line_2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
  }>;

  crm_client_services?: Array<{
    frequency: string | null;
    start_date: string | null;
    service_settings: Record<string, unknown> | null;
    is_active: boolean | null;
    crm_services:
      | {
          service_name: string;
        }
      | Array<{
          service_name: string;
        }>
      | null;
  }>;
};

type ClientFormProps = {
  mode: "create" | "edit";
  clientId?: string;
};

type ClientGroupOption = {
  id: string;
  group_name: string;
};

type ClientGroupMember = {
  id: string;
  group_id: string;
  client_id: string;
  is_active: boolean;
};


const STANDARD_FREQUENCIES = [
  "Weekly",
  "Fortnightly",
  "Monthly",
  "Bi-monthly",
  "Quarterly",
  "Six-monthly",
  "Annual",
  "Once-off",
  "Ad hoc",
];

const MONTH_BASED_FREQUENCIES = new Set([
  "Monthly",
  "Bi-monthly",
  "Quarterly",
  "Six-monthly",
]);

function defaultFrequency(serviceName: string) {
  const name = serviceName.trim().toLowerCase();

  if (name === "payroll") return "Monthly";
  if (name === "emp201") return "Monthly";
  if (name === "vat201") return "Bi-monthly";
  if (name === "emp501") return "Bi-annual";
  if (name === "provisional tax") return "Bi-annual";
  if (name === "accounting" || name === "management reports") return "Monthly";
  if (
    name.includes("registration") ||
    name.includes("paia") ||
    name.includes("cipc changes") ||
    name.includes("share transaction") ||
    name.includes("ad hoc") ||
    name.includes("once-off")
  ) {
    return "Once-off";
  }

  return "Annual";
}

function isManualService(serviceName: string, service: ServiceState) {
  const mode = String(service.settings.tasking_mode || "").toLowerCase();
  const frequency = String(service.frequency || "").toLowerCase();

  return (
    mode === "manual" ||
    mode === "none" ||
    frequency === "ad hoc" ||
    frequency === "once-off"
  );
}

function groupTitleFromServiceGroup(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Advisory & Other";

  const lower = raw.toLowerCase();

  if (lower.includes("payroll") || lower.includes("employment")) {
    return "Payroll & Employment";
  }
  if (lower === "vat" || lower.includes("value added")) {
    return "VAT";
  }
  if (lower.includes("tax")) {
    return "Tax";
  }
  if (
    lower.includes("corporate") ||
    lower.includes("secretarial") ||
    lower.includes("compliance") ||
    lower.includes("cipc") ||
    lower.includes("paia")
  ) {
    return "Corporate & Compliance";
  }
  if (
    lower.includes("finance") ||
    lower.includes("accounting") ||
    lower.includes("report")
  ) {
    return "Finance & Reporting";
  }

  return raw;
}

const TASKING_GROUP_ORDER = [
  "Finance & Reporting",
  "Payroll & Employment",
  "VAT",
  "Tax",
  "Corporate & Compliance",
  "Advisory & Other",
];

function serviceFrequencyOptions(serviceName: string, option?: ServiceOption) {
  const fromSettings = option?.default_service_settings?.frequency_options;

  if (Array.isArray(fromSettings) && fromSettings.length > 0) {
    return fromSettings.map(String);
  }

  const name = serviceName.trim().toLowerCase();

  if (name === "accounting") {
    return ["Monthly", "Bi-monthly", "Quarterly", "Six-monthly", "Annual"];
  }
  if (name === "payroll") {
    return ["Weekly", "Fortnightly", "Monthly"];
  }
  if (name === "management reports") {
    return ["Monthly", "Quarterly"];
  }

  return STANDARD_FREQUENCIES;
}

function getNestedServiceName(
  value:
    | { service_name: string }
    | Array<{ service_name: string }>
    | null
) {
  if (Array.isArray(value)) return value[0]?.service_name || "";
  return value?.service_name || "";
}

function calculatePeriodEnd(
  startDate: string,
  frequency: string,
  serviceName: string,
  settings: Record<string, unknown>
) {
  if (!startDate) return "";

  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "";

  const normalised = frequency.toLowerCase();
  const vatCategory = String(settings.vat_category || "").toUpperCase();
  const end = new Date(start);

  if (serviceName === "VAT201" && vatCategory === "C") {
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
  } else if (normalised.includes("bi-month") || serviceName === "VAT201") {
    end.setMonth(end.getMonth() + 2);
    end.setDate(0);
  } else if (normalised.includes("every 2") || normalised.includes("bi-week")) {
    end.setDate(end.getDate() + 13);
  } else if (normalised.includes("week")) {
    end.setDate(end.getDate() + 6);
  } else if (normalised.includes("bi-annual")) {
    end.setMonth(end.getMonth() + 6);
    end.setDate(end.getDate() - 1);
  } else if (normalised.includes("annual") || normalised.includes("year")) {
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
  } else {
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
  }

  return end.toISOString().slice(0, 10);
}

function monthInputValue(dateValue: string) {
  if (!dateValue) return "";
  return dateValue.slice(0, 7);
}

function monthStartFromInput(monthValue: string) {
  if (!monthValue) return "";
  return `${monthValue}-01`;
}

function monthEndFromInput(monthValue: string) {
  if (!monthValue) return "";
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return "";
  return new Date(year, month, 0).toISOString().slice(0, 10);
}

function parseDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function formatDateDisplay(value: string) {
  const parts = parseDateParts(value);
  if (!parts) return value || "—";
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(
    2,
    "0"
  )}/${parts.year}`;
}

function vatPeriodEndMatchesCategory(lastCompletedEnd: string, category: string) {
  const parts = parseDateParts(lastCompletedEnd);
  if (!parts || !category) return true;

  if (category === "C") return true;
  if (category === "A") return parts.month % 2 === 1;
  if (category === "B") return parts.month % 2 === 0;

  return true;
}

function calculateVatNextPeriod(lastCompletedEnd: string, category: string) {
  const parts = parseDateParts(lastCompletedEnd);
  if (!parts || !category) {
    return { start: "", end: "", due: "", valid: true };
  }

  const valid = vatPeriodEndMatchesCategory(lastCompletedEnd, category);

  const nextStart = new Date(parts.year, parts.month - 1, parts.day + 1);
  const monthsInPeriod = category === "C" ? 1 : 2;
  const nextEnd = new Date(
    nextStart.getFullYear(),
    nextStart.getMonth() + monthsInPeriod,
    0
  );

  const dueMonth = new Date(
    nextEnd.getFullYear(),
    nextEnd.getMonth() + 1,
    1
  );
  const due = new Date(
    dueMonth.getFullYear(),
    dueMonth.getMonth(),
    25
  );

  return {
    start: nextStart.toISOString().slice(0, 10),
    end: nextEnd.toISOString().slice(0, 10),
    due: due.toISOString().slice(0, 10),
    valid,
  };
}

function isMonthlyStyleService(serviceName: string, frequency: string) {
  if (serviceName === "VAT201") return false;

  const normalised = String(frequency || "").toLowerCase();

  return (
    normalised.includes("monthly") ||
    serviceName === "Accounting" ||
    serviceName === "Payroll" ||
    serviceName === "EMP201"
  );
}

function getServicePeriodLabel(serviceName: string, frequency: string) {
  if (serviceName === "VAT201") return "Last completed VAT period";
  if (isMonthlyStyleService(serviceName, frequency)) {
    return "First month PP must manage";
  }
  return "First period PP must manage";
}


function monthName(value: number) {
  return [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][value] || "";
}

function getYearEndMonthIndex(yearEnd: string) {
  const index = months.findIndex(
    (month) => month.toLowerCase() === String(yearEnd || "").toLowerCase()
  );
  return index >= 0 ? index : 1;
}

function getFinancialYearDates(year: number, yearEnd: string) {
  const endMonth = getYearEndMonthIndex(yearEnd);
  const periodEnd = new Date(year, endMonth + 1, 0);
  const periodStart = new Date(year - 1, endMonth + 1, 1);

  return {
    start: periodStart.toISOString().slice(0, 10),
    end: periodEnd.toISOString().slice(0, 10),
  };
}

function getPayrollTaxYearDates(year: number) {
  return {
    start: `${year - 1}-03-01`,
    end: `${year}-02-${new Date(year, 2, 0).getDate()}`,
  };
}

function buildYearOptions() {
  const thisYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, index) => thisYear - 1 + index);
}

function vatPeriodOptions(category: string) {
  const upper = String(category || "").toUpperCase();
  if (!upper) return [] as Array<{ value: string; label: string; start: string; end: string }>;

  const thisYear = new Date().getFullYear();
  const options: Array<{ value: string; label: string; start: string; end: string }> = [];

  for (let year = thisYear - 1; year <= thisYear + 2; year += 1) {
    if (upper === "C") {
      for (let month = 0; month < 12; month += 1) {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        const due = new Date(end.getFullYear(), end.getMonth() + 1, 25);
        options.push({
          value: `${start.toISOString().slice(0, 10)}|${end.toISOString().slice(0, 10)}`,
          label: `${monthName(month)} ${year} · due ${String(due.getDate()).padStart(2, "0")} ${monthName(due.getMonth())} ${due.getFullYear()}`,
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        });
      }
      continue;
    }

    const endMonths = upper === "A" ? [0, 2, 4, 6, 8, 10] : [1, 3, 5, 7, 9, 11];

    for (const endMonth of endMonths) {
      const end = new Date(year, endMonth + 1, 0);
      const start = new Date(year, endMonth - 1, 1);
      const due = new Date(end.getFullYear(), end.getMonth() + 1, 25);
      options.push({
        value: `${start.toISOString().slice(0, 10)}|${end.toISOString().slice(0, 10)}`,
        label: `${monthName(start.getMonth())}–${monthName(end.getMonth())} ${end.getFullYear()} · due ${String(due.getDate()).padStart(2, "0")} ${monthName(due.getMonth())} ${due.getFullYear()}`,
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      });
    }
  }

  return options;
}


const ACCOUNTING_FREQUENCIES = [
  "Monthly",
  "Bi-monthly",
  "Quarterly",
  "Six-monthly",
  "Annual",
];

const PAYROLL_FREQUENCIES = [
  "Weekly",
  "Fortnightly",
  "Monthly",
];

function recurringMonths(frequency: string) {
  const normalised = String(frequency || "").toLowerCase();
  if (normalised.includes("bi-month")) return 2;
  if (normalised.includes("quarter")) return 3;
  if (normalised.includes("six")) return 6;
  if (normalised.includes("annual") || normalised.includes("year")) return 12;
  return 1;
}

function recurringPeriodFromMonth(monthValue: string, frequency: string) {
  if (!monthValue) return { start: "", end: "", label: "" };

  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return { start: "", end: "", label: "" };

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month - 1 + recurringMonths(frequency), 0);

  const startLabel = start.toLocaleDateString("en-ZA", {
    month: "short",
    year: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-ZA", {
    month: "short",
    year: "numeric",
  });

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label:
      recurringMonths(frequency) === 1
        ? start.toLocaleDateString("en-ZA", {
            month: "long",
            year: "numeric",
          })
        : `${startLabel} – ${endLabel}`,
  };
}

function payrollPeriodFromStart(dateValue: string, frequency: string) {
  if (!dateValue) return { start: "", end: "", label: "" };

  const start = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(start.getTime())) {
    return { start: "", end: "", label: "" };
  }

  const days = frequency === "Fortnightly" ? 13 : 6;
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  const formatted = start.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label:
      frequency === "Fortnightly"
        ? `Fortnight commencing ${formatted}`
        : `Week commencing ${formatted}`,
  };
}

function getTaskingTypeLabel(serviceName: string, service: ServiceState) {
  if (serviceName === "VAT201") {
    const category = String(service.settings.vat_category || "");
    return category ? `Category ${category}` : "VAT category";
  }
  if (serviceName === "EMP501") return "Bi-annual reconciliation";
  if (serviceName === "Provisional Tax") return "Per tax period";
  if (serviceName === "Financial Statements") return "Annual AFS";
  if (serviceName === "Income Tax") return "Annual return";
  if (serviceName === "CIPC Annual Return") return "Annual compliance";
  if (serviceName === "Beneficial Ownership Declaration") return "Annual compliance";
  if (serviceName === "Workmans Compensation") return "Annual return";
  return service.frequency || defaultFrequency(serviceName);
}


type TimelineItem = {
  serviceName: string;
  sortKey: string;
  dateLabel: string;
  title: string;
  detail: string;
};

const SERVICE_VISUALS: Record<
  string,
  { background: string; foreground: string; short: string }
> = {
  Accounting: { background: "#4476c8", foreground: "#ffffff", short: "A" },
  Payroll: { background: "#4ea6ad", foreground: "#ffffff", short: "P" },
  EMP201: { background: "#7563b6", foreground: "#ffffff", short: "E1" },
  EMP501: { background: "#df973c", foreground: "#ffffff", short: "E5" },
  VAT201: { background: "#5ca845", foreground: "#ffffff", short: "VAT" },
  "Provisional Tax": { background: "#3d8bb0", foreground: "#ffffff", short: "PT" },
  "Income Tax": { background: "#6f62b5", foreground: "#ffffff", short: "IT" },
  "Financial Statements": { background: "#367fc0", foreground: "#ffffff", short: "FS" },
  "CIPC Annual Return": { background: "#cf6688", foreground: "#ffffff", short: "AR" },
  "Beneficial Ownership Declaration": { background: "#a45cad", foreground: "#ffffff", short: "BO" },
  "Workmans Compensation": { background: "#b28f36", foreground: "#ffffff", short: "WC" },
  "Management Reports": { background: "#167f8c", foreground: "#ffffff", short: "MR" },
  "PAIA Manual": { background: "#697a3d", foreground: "#ffffff", short: "PA" },
  "Company Secretarial": { background: "#52677a", foreground: "#ffffff", short: "CS" },
  "CIPC Changes": { background: "#7c6b9f", foreground: "#ffffff", short: "CC" },
  "UIF": { background: "#3c8791", foreground: "#ffffff", short: "UIF" },
  "WCA Letter of Good Standing": { background: "#aa8734", foreground: "#ffffff", short: "WCA" },
  "Tax Registration": { background: "#7a68ad", foreground: "#ffffff", short: "TR" },
  "VAT Registration": { background: "#4d9c45", foreground: "#ffffff", short: "VR" },
  "PAYE / UIF Registration": { background: "#4b8ba2", foreground: "#ffffff", short: "PR" },
  "Share Transactions & Certificates": { background: "#a05d8d", foreground: "#ffffff", short: "SH" },
  "Projects / Project Accounting": { background: "#477b9b", foreground: "#ffffff", short: "PJ" },
  "Advisory / Consulting": { background: "#725a9d", foreground: "#ffffff", short: "AD" },
  "Ad Hoc Work": { background: "#6b7785", foreground: "#ffffff", short: "AH" },
};

function ServiceIcon({
  serviceName,
  size = 24,
}: {
  serviceName: string;
  size?: number;
}) {
  const visual =
    SERVICE_VISUALS[serviceName] || {
      background: "#60788d",
      foreground: "#ffffff",
      short: "",
    };

  const strokeWidth = 1.7;
  const common = {
    width: Math.round(size * 0.56),
    height: Math.round(size * 0.56),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  let icon: React.ReactNode;

  switch (serviceName) {
    case "Accounting":
      icon = (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="1" />
          <path d="M8 7h8M8 11h3M13 11h3M8 15h3M13 15h3M8 19h8" />
        </svg>
      );
      break;
    case "Payroll":
      icon = (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2" />
          <path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M15 15c3 0 4.7 1.7 5 5" />
        </svg>
      );
      break;
    case "EMP201":
      icon = (
        <svg {...common}>
          <path d="M6 3h12v18H6z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
          <path d="m14 16 1.5 1.5L19 14" />
        </svg>
      );
      break;
    case "EMP501":
      icon = (
        <svg {...common}>
          <path d="M7 4h10v14H7z" />
          <path d="M4 7v13h10M10 8h4M10 12h4" />
        </svg>
      );
      break;
    case "VAT201":
      icon = (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M14 3v4h4M9 11h6M9 15h6" />
        </svg>
      );
      break;
    case "Provisional Tax":
    case "Income Tax":
      icon = (
        <svg {...common}>
          <path d="M7 17 17 7" />
          <circle cx="8" cy="8" r="2" />
          <circle cx="16" cy="16" r="2" />
        </svg>
      );
      break;
    case "Financial Statements":
      icon = (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M9 16v-3M12 16v-6M15 16v-9" />
        </svg>
      );
      break;
    case "CIPC Annual Return":
      icon = (
        <svg {...common}>
          <path d="M4 20h16M6 20V9l6-5 6 5v11" />
          <path d="M9 13h6M9 16h6" />
        </svg>
      );
      break;
    case "Beneficial Ownership Declaration":
      icon = (
        <svg {...common}>
          <circle cx="12" cy="6" r="2.5" />
          <circle cx="6" cy="17" r="2.5" />
          <circle cx="18" cy="17" r="2.5" />
          <path d="M12 8.5v4M12 12.5 7.5 15M12 12.5l4.5 2.5" />
        </svg>
      );
      break;
    case "Workmans Compensation":
      icon = (
        <svg {...common}>
          <path d="M12 3 19 6v5c0 4.5-2.6 8-7 10-4.4-2-7-5.5-7-10V6z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
      break;
    default:
      icon = (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        background: visual.background,
        color: visual.foreground,
        lineHeight: 1,
      }}
    >
      {icon}
    </span>
  );
}
function formatTimelineMonth(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    month: "short",
    year: "numeric",
  });
}

function formatTimelineDay(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  });
}

function addCalendarMonths(date: Date, monthsToAdd: number) {
  return new Date(date.getFullYear(), date.getMonth() + monthsToAdd, 1);
}

function getTimelinePoint(
  serviceName: string,
  service: ServiceState,
  clientYearEnd: string
) {
  const start = service.firstPeriodStart
    ? new Date(`${service.firstPeriodStart}T12:00:00`)
    : null;
  const end = service.firstPeriodEnd
    ? new Date(`${service.firstPeriodEnd}T12:00:00`)
    : null;

  const year = Number(service.settings.tasking_year || 0);

  if (serviceName === "Accounting") {
    return {
      sortKey: service.firstPeriodStart || "9999-12-31",
      label: start ? formatTimelineMonth(start) : "Start",
    };
  }

  if (serviceName === "Payroll") {
    return {
      sortKey: service.firstPeriodStart || "9999-12-31",
      label:
        start && service.frequency !== "Monthly"
          ? formatTimelineDay(start)
          : start
            ? formatTimelineMonth(start)
            : "Start",
    };
  }

  if (serviceName === "EMP201" && end) {
    const due = new Date(end.getFullYear(), end.getMonth() + 1, 7);
    return {
      sortKey: due.toISOString().slice(0, 10),
      label: formatTimelineDay(due),
    };
  }

  if (serviceName === "VAT201" && end) {
    const due = new Date(end.getFullYear(), end.getMonth() + 1, 25);
    return {
      sortKey: due.toISOString().slice(0, 10),
      label: formatTimelineDay(due),
    };
  }

  if (serviceName === "EMP501" && year) {
    const cycle = String(service.settings.emp501_cycle || "interim");
    const due =
      cycle === "interim"
        ? new Date(year - 1, 9, 31)
        : new Date(year, 4, 31);

    return {
      sortKey: due.toISOString().slice(0, 10),
      label: formatTimelineDay(due),
    };
  }

  if (serviceName === "Provisional Tax" && year) {
    const period = Number(service.settings.provisional_period || 1);
    const endMonth = getYearEndMonthIndex(clientYearEnd);
    const yearEndDate = new Date(year, endMonth + 1, 0);

    if (period === 1) {
      const due = new Date(
        yearEndDate.getFullYear(),
        yearEndDate.getMonth() - 6,
        new Date(
          yearEndDate.getFullYear(),
          yearEndDate.getMonth() - 5,
          0
        ).getDate()
      );
      return {
        sortKey: due.toISOString().slice(0, 10),
        label: formatTimelineDay(due),
      };
    }

    if (period === 2) {
      return {
        sortKey: yearEndDate.toISOString().slice(0, 10),
        label: formatTimelineDay(yearEndDate),
      };
    }

    return {
      sortKey: `${year}-12-31`,
      label: `${year} P3`,
    };
  }

  if (serviceName === "Income Tax" && year) {
    const endMonth = getYearEndMonthIndex(clientYearEnd);
    const due = new Date(year + 1, endMonth + 1, 0);

    return {
      sortKey: due.toISOString().slice(0, 10),
      label: formatTimelineMonth(due),
    };
  }

  if (serviceName === "Financial Statements" && year) {
    return {
      sortKey: `${year}-12-15`,
      label: `FY ${year}`,
    };
  }

  if (
    serviceName === "CIPC Annual Return" ||
    serviceName === "Beneficial Ownership Declaration" ||
    serviceName === "Workmans Compensation"
  ) {
    return {
      sortKey: year ? `${year}-12-20` : "9999-12-31",
      label: year ? String(year) : "Year",
    };
  }

  return {
    sortKey: service.firstPeriodStart || (year ? `${year}-12-31` : "9999-12-31"),
    label: start ? formatTimelineMonth(start) : year ? String(year) : "Start",
  };
}
function buildTimelineItem(
  serviceName: string,
  service: ServiceState,
  clientYearEnd: string
): TimelineItem {
  const point = getTimelinePoint(serviceName, service, clientYearEnd);

  return {
    serviceName,
    sortKey: point.sortKey,
    dateLabel: point.label,
    title: serviceName,
    detail: getTaskPreviewLabel(serviceName, service),
  };
}

function getTaskPreviewLabel(serviceName: string, service: ServiceState) {
  const year = String(service.settings.tasking_year || "");

  if (serviceName === "VAT201") {
    const label = String(service.settings.tasking_period_label || "");
    return label ? `VAT201 ${label}` : "Choose VAT period";
  }
  if (serviceName === "EMP501") {
    const cycle = String(service.settings.emp501_cycle || "");
    return year && cycle ? `EMP501 ${cycle === "interim" ? "Interim" : "Annual"} ${year}` : "Choose EMP501 period";
  }
  if (serviceName === "Provisional Tax") {
    const period = String(service.settings.provisional_period || "");
    return year && period ? `Provisional Tax ${year} P${period}` : "Choose provisional tax period";
  }
  if (serviceName === "Financial Statements") {
    return year ? `Financial Statements ${year}` : "Choose financial year";
  }
  if (serviceName === "Income Tax") {
    return year ? `Income Tax ${year}` : "Choose tax year";
  }
  if (serviceName === "CIPC Annual Return") {
    return year ? `CIPC Annual Return ${year}` : "Choose compliance year";
  }
  if (serviceName === "Beneficial Ownership Declaration") {
    return year ? `Beneficial Ownership ${year}` : "Choose compliance year";
  }
  if (serviceName === "Workmans Compensation") {
    return year ? `Workman's Compensation ${year}` : "Choose return year";
  }
  if (isManualService(serviceName, service)) {
    return "Manual / on demand";
  }

  if (
    serviceName === "Management Reports" &&
    service.firstPeriodStart
  ) {
    const monthValue = service.firstPeriodStart.slice(0, 7);
    const period = recurringPeriodFromMonth(monthValue, service.frequency);
    return period.label
      ? `Management Reports ${period.label}`
      : "Choose reporting start";
  }

  if (serviceName === "Accounting" && service.firstPeriodStart) {
    const monthValue = service.firstPeriodStart.slice(0, 7);
    const period = recurringPeriodFromMonth(monthValue, service.frequency);
    return period.label ? `Accounting ${period.label}` : "Choose Accounting start";
  }
  if (serviceName === "Payroll" && service.firstPeriodStart) {
    if (service.frequency === "Monthly") {
      const date = new Date(`${service.firstPeriodStart}T12:00:00`);
      return `Payroll ${date.toLocaleDateString("en-ZA", {
        month: "long",
        year: "numeric",
      })}`;
    }

    const label = String(service.settings.tasking_period_label || "");
    return label ? `Payroll ${label}` : "Choose Payroll start";
  }
  if (service.firstPeriodStart) {
    const date = new Date(`${service.firstPeriodStart}T12:00:00`);
    return `${serviceName} ${date.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}`;
  }
  return `Choose ${serviceName} start`;
}


function registrationServiceAlreadyComplete(
  serviceName: string,
  values: {
    incomeTaxNumber: string;
    vatNumber: string;
    payeNumber: string;
    uifNumber: string;
    wccRefNr: string;
    customsNumber: string;
  }
) {
  const name = serviceName.trim().toLowerCase();

  if (name === "tax registration") {
    return Boolean(values.incomeTaxNumber.trim());
  }

  if (name === "vat registration") {
    return Boolean(values.vatNumber.trim());
  }

  if (name === "paye / uif registration") {
    return Boolean(values.payeNumber.trim() && values.uifNumber.trim());
  }

  if (name === "coida registration") {
    return Boolean(values.wccRefNr.trim());
  }

  if (name === "customs registration") {
    return Boolean(values.customsNumber.trim());
  }

  return false;
}

export default function ClientForm({ mode, clientId }: ClientFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedSection =
    searchParams.get("section") || "core";

  const isTaskingWorkspace =
    requestedSection === "tasking" ||
    (mode === "edit" && requestedSection === "services");
  const resolvedSection = isTaskingWorkspace ? "services" : requestedSection;

  const [activeSection, setActiveSection] = useState(resolvedSection);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [groupOptions, setGroupOptions] = useState<ClientGroupOption[]>([]);
  const [currentGroupMembers, setCurrentGroupMembers] = useState<ClientGroupMember[]>([]);
  const [clientGroupId, setClientGroupId] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState("");
  const [clientCategory, setClientCategory] = useState<
    "individual" | "entity" | "trust" | ""
  >("");
  const [engagementType, setEngagementType] = useState<
    "ongoing_monthly" | "annual_monthly_retainer" | "annual_ad_hoc" | ""
  >("");
  const [relationshipStatus, setRelationshipStatus] = useState<
    "flying_client" | "in_airspace" | "on_radar" | "former_client"
  >("flying_client");
  const [internalCode, setInternalCode] = useState("");
  const [status, setStatus] = useState("Active");
  const [yearEnd, setYearEnd] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationDate, setRegistrationDate] = useState("");
  const [idPassportNumber, setIdPassportNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const [vatNumber, setVatNumber] = useState("");
  const [payeNumber, setPayeNumber] = useState("");
  const [uifNumber, setUifNumber] = useState("");
  const [incomeTaxNumber, setIncomeTaxNumber] = useState("");
  const [customsNumber, setCustomsNumber] = useState("");
  const [wccRefNr, setWccRefNr] = useState("");
  const [sdlRegistered, setSdlRegistered] = useState(false);

  const [primaryContact, setPrimaryContact] = useState("");
  const [contactPosition, setContactPosition] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [cellphone, setCellphone] = useState("");

  const [physical1, setPhysical1] = useState("");
  const [physical2, setPhysical2] = useState("");
  const [physicalCity, setPhysicalCity] = useState("");
  const [physicalProvince, setPhysicalProvince] = useState("");
  const [physicalPostalCode, setPhysicalPostalCode] = useState("");

  const [postal1, setPostal1] = useState("");
  const [postal2, setPostal2] = useState("");
  const [postalCity, setPostalCity] = useState("");
  const [postalProvince, setPostalProvince] = useState("");
  const [postalPostalCode, setPostalPostalCode] = useState("");

  const [clientLeadUserId, setClientLeadUserId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [partnerUserId, setPartnerUserId] = useState("");


  const [services, setServices] = useState<Record<string, ServiceState>>({});

  const isIndividual = clientType === "Individual";
  const isFlyingClient = relationshipStatus === "flying_client";

  const relationshipStatusLabel =
    relationshipStatus === "flying_client"
      ? "Flying Client"
      : relationshipStatus === "in_airspace"
        ? "In Airspace"
        : relationshipStatus === "on_radar"
          ? "On Radar"
          : "Former Client";

  const visibleServices = useMemo(
    () =>
      serviceOptions
        .filter((service) => service.is_active !== false)
        .map((service) => service.service_name),
    [serviceOptions]
  );

  const serviceOptionByName = useMemo(
    () =>
      new Map(
        serviceOptions.map((service) => [service.service_name, service])
      ),
    [serviceOptions]
  );

  const taskingGroups = useMemo(() => {
    const grouped = new Map<string, string[]>();

    for (const option of serviceOptions) {
      if (option.is_active === false) continue;

      const group = groupTitleFromServiceGroup(option.service_group);
      const existing = grouped.get(group) || [];
      existing.push(option.service_name);
      grouped.set(group, existing);
    }

    return Array.from(grouped.entries())
      .map(([title, serviceNames]) => ({
        key: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title,
        subtitle:
          title === "Finance & Reporting"
            ? "Accounting, reporting and financial statement work"
            : title === "Payroll & Employment"
              ? "Payroll and employment compliance"
              : title === "VAT"
                ? "VAT returns and VAT-related work"
                : title === "Tax"
                  ? "Income tax, provisional tax and registrations"
                  : title === "Corporate & Compliance"
                    ? "CIPC, secretarial, PAIA and corporate compliance"
                    : "Advisory, projects and other client work",
        services: serviceNames.sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => {
        const ai = TASKING_GROUP_ORDER.indexOf(a.title);
        const bi = TASKING_GROUP_ORDER.indexOf(b.title);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
  }, [serviceOptions]);

  const onboardingTimeline = useMemo(() => {
    return taskingGroups
      .flatMap((group) => group.services)
      .filter((serviceName) => {
        const service = services[serviceName];
        return (
          service?.selected &&
          !isManualService(serviceName, service) &&
          Boolean(service.firstPeriodStart)
        );
      })
      .map((serviceName) =>
        buildTimelineItem(serviceName, services[serviceName], yearEnd)
      )
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [services, yearEnd, taskingGroups]);

  useEffect(() => {
    loadForm();
  }, [clientId]);

  useEffect(() => {
    const allowed = ["core", "services", "statutory", "contacts", "responsibility", "tasking"];
    if (allowed.includes(requestedSection)) {
      setActiveSection(requestedSection === "tasking" ? "services" : requestedSection);
    }
  }, [requestedSection]);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not signed in.");
    }

    return session.access_token;
  }

  async function apiFetch(url: string, init?: RequestInit) {
    const token = await getAccessToken();

    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  function initialiseServiceStates(options: ServiceOption[]) {
    const state: Record<string, ServiceState> = {};

    for (const option of options) {
      if (option.is_active === false) continue;

      state[option.service_name] = {
        selected: false,
        frequency:
          option.default_frequency || defaultFrequency(option.service_name),
        firstPeriodStart: "",
        firstPeriodEnd: "",
        settings: {
          ...(option.default_service_settings || {}),
        },
      };
    }

    return state;
  }

  async function loadForm() {
    try {
      setLoading(true);
      setErrorMessage("");

      const url =
        mode === "edit" && clientId
          ? `/api/clients?id=${encodeURIComponent(clientId)}`
          : "/api/clients";

      const response = await apiFetch(url);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load client form.");
      }

      const loadedUsers = (data.users || []) as UserOption[];
      const loadedServices = (data.services || []) as ServiceOption[];

      setUsers(loadedUsers);
      setServiceOptions(loadedServices);

      const groupsResponse = await apiFetch("/api/crm/groups");
      const groupsData = await groupsResponse.json();

      if (!groupsResponse.ok || !groupsData.success) {
        throw new Error(groupsData.error || "Could not load client groups.");
      }

      const loadedGroups = (groupsData.groups || []) as ClientGroupOption[];
      const loadedMembers = (groupsData.members || []) as ClientGroupMember[];

      setGroupOptions(loadedGroups);
      setCurrentGroupMembers(loadedMembers);

      if (mode === "edit" && clientId) {
        const currentMembership = loadedMembers.find(
          (member) => member.client_id === clientId && member.is_active
        );
        setClientGroupId(currentMembership?.group_id || "");
      } else {
        setClientGroupId("");
      }

      const serviceState = initialiseServiceStates(loadedServices);

      if (mode === "edit" && data.client) {
        populateClient(data.client as ClientApiData, serviceState);
      } else {
        setServices(serviceState);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load client form."
      );
    } finally {
      setLoading(false);
    }
  }

  function populateClient(
    client: ClientApiData,
    serviceState: Record<string, ServiceState>
  ) {
    setClientName(client.client_name || "");
    setClientType(client.entity_type || "");

    const loadedCategory =
      client.client_category ||
      (String(client.entity_type || "").toLowerCase() === "individual"
        ? "individual"
        : String(client.entity_type || "").toLowerCase().includes("trust")
          ? "trust"
          : "entity");

    setClientCategory(loadedCategory);
    setEngagementType(client.engagement_type || "");
    setRelationshipStatus(client.relationship_status || "flying_client");
    setInternalCode(client.client_code || "");
    setStatus(client.status || "Active");
    setYearEnd(client.year_end || "");
    setTradingName(client.trading_name || "");
    setRegistrationNumber(client.registration_number || "");
    setRegistrationDate(client.registration_date || "");
    setIdPassportNumber(client.id_passport_number || "");
    setDateOfBirth(client.date_of_birth || "");

    setVatNumber(client.vat_number || "");
    setPayeNumber(client.paye_number || "");
    setIncomeTaxNumber(client.tax_number || "");
    setUifNumber(client.uif_registration_number || "");
    setCustomsNumber(client.customs_number || "");
    setSdlRegistered(Boolean(client.sdl_registered));
    setWccRefNr(client.wcc_reference_number || "");

    setClientLeadUserId(client.client_lead_user_id || "");
    setManagerUserId(client.manager_user_id || "");
    setPartnerUserId(client.partner_user_id || "");

    const contact =
      client.crm_client_contacts?.find((item) => item.is_primary) ||
      client.crm_client_contacts?.[0];

    setPrimaryContact(contact?.contact_name || "");
    setContactPosition(contact?.contact_position || "");
    setEmail(contact?.email || "");
    setTelephone(contact?.phone || "");
    setCellphone(contact?.mobile || "");

    const physical = client.crm_client_addresses?.find(
      (item) => item.address_type === "Physical"
    );
    const postal = client.crm_client_addresses?.find(
      (item) => item.address_type === "Postal"
    );

    setPhysical1(physical?.line_1 || "");
    setPhysical2(physical?.line_2 || "");
    setPhysicalCity(physical?.city || "");
    setPhysicalProvince(physical?.province || "");
    setPhysicalPostalCode(physical?.postal_code || "");

    setPostal1(postal?.line_1 || "");
    setPostal2(postal?.line_2 || "");
    setPostalCity(postal?.city || "");
    setPostalProvince(postal?.province || "");
    setPostalPostalCode(postal?.postal_code || "");

    for (const clientService of client.crm_client_services || []) {
      const name = getNestedServiceName(clientService.crm_services);

      if (!name) continue;

      const settings = clientService.service_settings || {};

      if (!serviceState[name]) {
        serviceState[name] = {
          selected: false,
          frequency: clientService.frequency || defaultFrequency(name),
          firstPeriodStart: "",
          firstPeriodEnd: "",
          settings: {},
        };
      }

      serviceState[name] = {
        selected: Boolean(clientService.is_active),
        frequency:
          clientService.frequency ||
          String(settings.frequency || defaultFrequency(name)),
        firstPeriodStart:
          String(settings.first_period_start || clientService.start_date || ""),
        firstPeriodEnd: String(settings.first_period_end || ""),
        settings,
      };
    }

    setServices({ ...serviceState });
  }

  function updateService(
    serviceName: string,
    patch: Partial<ServiceState>
  ) {
    setServices((current) => ({
      ...current,
      [serviceName]: {
        ...(current[serviceName] || {
          selected: false,
          frequency: defaultFrequency(serviceName),
          firstPeriodStart: "",
          firstPeriodEnd: "",
          settings: {},
        }),
        ...patch,
      },
    }));
  }

  function updateServiceSetting(
    serviceName: string,
    key: string,
    value: unknown
  ) {
    const current = services[serviceName];

    updateService(serviceName, {
      settings: {
        ...(current?.settings || {}),
        [key]: value,
      },
    });
  }

  function onVatTaskingChange(
    serviceName: string,
    lastCompletedEnd: string,
    nextPeriodStart: string,
    nextPeriodEnd: string,
    nextDueDate: string
  ) {
    const current = services[serviceName];

    updateService(serviceName, {
      firstPeriodStart: nextPeriodStart,
      firstPeriodEnd: nextPeriodEnd,
      settings: {
        ...(current?.settings || {}),
        last_completed_period_end: lastCompletedEnd,
        next_due_date: nextDueDate,
      },
    });
  }

  function updateMonthlyTasking(serviceName: string, monthValue: string) {
    updateService(serviceName, {
      firstPeriodStart: monthStartFromInput(monthValue),
      firstPeriodEnd: monthEndFromInput(monthValue),
      settings: {
        ...(services[serviceName]?.settings || {}),
        tasking_period_type: "month",
        tasking_month: monthValue,
      },
    });
  }

  function updateAccountingTasking(
    frequency: string,
    monthValue?: string
  ) {
    const current = services["Accounting"];
    const currentMonth =
      monthValue !== undefined
        ? monthValue
        : monthInputValue(current?.firstPeriodStart || "");

    const period = recurringPeriodFromMonth(currentMonth, frequency);

    updateService("Accounting", {
      frequency,
      firstPeriodStart: period.start,
      firstPeriodEnd: period.end,
      settings: {
        ...(current?.settings || {}),
        tasking_period_type: "recurring_period",
        tasking_month: currentMonth,
        tasking_period_label: period.label,
      },
    });
  }

  function updatePayrollTasking(
    frequency: string,
    value?: string
  ) {
    const current = services["Payroll"];
    const nextFrequency = frequency || current?.frequency || "Monthly";

    if (nextFrequency === "Monthly") {
      const monthValue =
        value !== undefined
          ? value
          : monthInputValue(current?.firstPeriodStart || "");

      updateService("Payroll", {
        frequency: nextFrequency,
        firstPeriodStart: monthStartFromInput(monthValue),
        firstPeriodEnd: monthEndFromInput(monthValue),
        settings: {
          ...(current?.settings || {}),
          tasking_period_type: "month",
          tasking_month: monthValue,
          tasking_period_label: monthValue,
        },
      });
      return;
    }

    const dateValue =
      value !== undefined
        ? value
        : current?.firstPeriodStart || "";

    const period = payrollPeriodFromStart(dateValue, nextFrequency);

    updateService("Payroll", {
      frequency: nextFrequency,
      firstPeriodStart: period.start,
      firstPeriodEnd: period.end,
      settings: {
        ...(current?.settings || {}),
        tasking_period_type:
          nextFrequency === "Fortnightly" ? "fortnight" : "week",
        tasking_period_label: period.label,
      },
    });
  }

  function updateVatCategory(serviceName: string, category: string) {
    const current = services[serviceName];
    updateService(serviceName, {
      frequency: category === "C" ? "Monthly" : "Bi-monthly",
      firstPeriodStart: "",
      firstPeriodEnd: "",
      settings: {
        ...(current?.settings || {}),
        vat_category: category,
        tasking_period_type: "vat_period",
        tasking_period_label: "",
      },
    });
  }

  function updateVatPeriod(serviceName: string, value: string) {
    const [start, end] = value.split("|");
    const category = String(services[serviceName]?.settings.vat_category || "");
    const option = vatPeriodOptions(category).find((row) => row.value === value);

    const endDate = end ? new Date(`${end}T12:00:00`) : null;
    const dueDate =
      endDate && !Number.isNaN(endDate.getTime())
        ? new Date(endDate.getFullYear(), endDate.getMonth() + 1, 25)
            .toISOString()
            .slice(0, 10)
        : "";

    updateService(serviceName, {
      firstPeriodStart: start || "",
      firstPeriodEnd: end || "",
      settings: {
        ...(services[serviceName]?.settings || {}),
        tasking_period_type: "vat_period",
        tasking_period_label: option?.label || "",
        first_period_start: start || "",
        first_period_end: end || "",
        first_due_date: dueDate,
      },
    });
  }

  function updateAnnualTasking(serviceName: string, yearValue: string) {
    const year = Number(yearValue);
    if (!year) return;

    const financial = serviceName === "Financial Statements" || serviceName === "Income Tax";
    const dates = financial
      ? getFinancialYearDates(year, yearEnd)
      : { start: `${year}-01-01`, end: `${year}-12-31` };

    updateService(serviceName, {
      firstPeriodStart: dates.start,
      firstPeriodEnd: dates.end,
      settings: {
        ...(services[serviceName]?.settings || {}),
        tasking_period_type: "year",
        tasking_year: year,
      },
    });
  }

  function updateProvisionalTasking(yearValue: string, periodValue: string) {
    const year = Number(yearValue);
    const period = Number(periodValue);
    if (!year || !period) return;

    const fy = getFinancialYearDates(year, yearEnd);
    const fyStart = new Date(`${fy.start}T12:00:00`);
    const start = new Date(fyStart);
    if (period === 2) start.setMonth(start.getMonth() + 6);
    if (period === 3) start.setFullYear(start.getFullYear() + 1);

    updateService("Provisional Tax", {
      firstPeriodStart: start.toISOString().slice(0, 10),
      firstPeriodEnd: fy.end,
      settings: {
        ...(services["Provisional Tax"]?.settings || {}),
        tasking_period_type: "tax_period",
        tasking_year: year,
        provisional_period: period,
      },
    });
  }

  function updateEmp501Tasking(yearValue: string, cycleValue: string) {
    const year = Number(yearValue);
    if (!year || !cycleValue) return;

    const payrollYear = getPayrollTaxYearDates(year);
    const end = cycleValue === "interim" ? `${year - 1}-08-31` : payrollYear.end;

    updateService("EMP501", {
      firstPeriodStart: payrollYear.start,
      firstPeriodEnd: end,
      settings: {
        ...(services.EMP501?.settings || {}),
        tasking_period_type: "emp501_cycle",
        tasking_year: year,
        emp501_cycle: cycleValue,
      },
    });
  }

  function copyPhysicalToPostal() {
    setPostal1(physical1);
    setPostal2(physical2);
    setPostalCity(physicalCity);
    setPostalProvince(physicalProvince);
    setPostalPostalCode(physicalPostalCode);
  }

  function validate() {
    if (!clientName.trim()) {
      return "Client name is required.";
    }

    if (!clientCategory) {
      return "Record type is required.";
    }

    if (!clientType) {
      return "Entity / legal type is required.";
    }

    if (!relationshipStatus) {
      return "PracticePilot relationship is required.";
    }

    if (isFlyingClient && !engagementType) {
      return "Service relationship is required for a Flying Client.";
    }

    if (isFlyingClient) {
      for (const [serviceName, service] of Object.entries(services)) {
      if (!service.selected) continue;

      const registrationComplete = registrationServiceAlreadyComplete(
        serviceName,
        {
          incomeTaxNumber,
          vatNumber,
          payeNumber,
          uifNumber,
          wccRefNr,
          customsNumber,
        }
      );

      if (registrationComplete) continue;

      if (
        !isManualService(serviceName, service) &&
        !service.firstPeriodStart
      ) {
        return `${serviceName}: choose the first period PracticePilot must manage.`;
      }


      if (serviceName === "VAT201" && !service.settings.vat_category) {
        return "VAT201: select the VAT category.";
      }

      if (serviceName === "VAT201" && !service.firstPeriodStart) {
        return "VAT201: choose the first VAT period PracticePilot must manage.";
      }

      if (
        ["Financial Statements", "Income Tax", "CIPC Annual Return", "Beneficial Ownership Declaration", "Workmans Compensation"].includes(serviceName) &&
        !service.settings.tasking_year
      ) {
        return `${serviceName}: choose the first year PracticePilot must manage.`;
      }

      if (serviceName === "Provisional Tax") {
        if (!service.settings.tasking_year || !service.settings.provisional_period) {
          return "Provisional Tax: choose the tax year and period PracticePilot starts with.";
        }
      }

      if (serviceName === "EMP501") {
        if (!service.settings.tasking_year || !service.settings.emp501_cycle) {
          return "EMP501: choose the tax year and reconciliation cycle PracticePilot starts with.";
        }
      }
      }
    }

    return "";
  }

  async function syncClientGroup(savedClientId: string) {
    const existingMemberships = currentGroupMembers.filter(
      (member) => member.client_id === savedClientId && member.is_active
    );

    const selectedMembership = existingMemberships.find(
      (member) => member.group_id === clientGroupId
    );

    for (const member of existingMemberships) {
      if (!clientGroupId || member.group_id !== clientGroupId) {
        const response = await apiFetch("/api/crm/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "remove_member",
            memberId: member.id,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.success === false) {
          throw new Error(
            data?.error ||
              "Client saved, but the Client Group could not be updated."
          );
        }
      }
    }

    if (clientGroupId && !selectedMembership) {
      const response = await apiFetch("/api/crm/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_member",
          groupId: clientGroupId,
          clientId: savedClientId,
          relationshipLabel: null,
          isPrimary: false,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error ||
            "Client saved, but the Client Group could not be updated."
        );
      }
    }
  }

  async function handleSave() {
    if (saving) return;

    const validationError = validate();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      const payload = {
        clientId: mode === "edit" ? clientId : undefined,
        clientName,
        clientType,
        clientCategory,
        engagementType: isFlyingClient ? engagementType : "",
        relationshipStatus,
        internalCode,
        status,
        yearEnd,
        tradingName,
        registrationNumber,
        registrationDate,
        idPassportNumber,
        dateOfBirth,

        vatNumber,
        payeNumber,
        uifNumber,
        incomeTaxNumber,
        customsNumber,
        wccRefNr,
        sdlRegistered,

        primaryContact,
        contactPosition,
        email,
        telephone,
        cellphone,

        physicalAddressLine1: physical1,
        physicalAddressLine2: physical2,
        physicalCity,
        physicalProvince,
        physicalPostalCode,

        postalAddressLine1: postal1,
        postalAddressLine2: postal2,
        postalCity,
        postalProvince,
        postalPostalCode,

        clientLeadUserId,
        managerUserId,
        partnerUserId,

        services: Object.entries(services).map(
          ([serviceName, service]) => {
            const registrationComplete = registrationServiceAlreadyComplete(
              serviceName,
              {
                incomeTaxNumber,
                vatNumber,
                payeNumber,
                uifNumber,
                wccRefNr,
                customsNumber,
              }
            );

            return {
              serviceName,
              selected:
                !isFlyingClient || registrationComplete ? false : service.selected,
              frequency: service.frequency,
              firstPeriodStart: registrationComplete
                ? null
                : service.firstPeriodStart || null,
              firstPeriodEnd: registrationComplete
                ? null
                : service.firstPeriodEnd ||
                  calculatePeriodEnd(
                    service.firstPeriodStart,
                    service.frequency,
                    serviceName,
                    service.settings
                  ) ||
                  null,
              settings: service.settings,
            };
          }
        ),
      };

      const response = await apiFetch("/api/clients", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Client could not be saved.");
      }

      await syncClientGroup(data.clientId);

      if (isFlyingClient) {
        const taskResponse = await apiFetch("/api/crm/tasks/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: data.clientId }),
        });

        const taskData = await taskResponse.json().catch(() => ({}));

        if (!taskResponse.ok || taskData?.success === false) {
          throw new Error(
            taskData?.error ||
              "Client saved, but PracticePilot could not rebuild the work schedule."
          );
        }
      }

      router.push(
        isTaskingWorkspace
          ? `/crm/client/${data.clientId}?tab=work`
          : `/crm/client/${data.clientId}?tab=profile`
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Client could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={pageStyle}>Loading client form...</div>;
  }

  return (
    <div style={pageStyle}>
      <div style={pageHeadingBar}>

        <div>
          <div style={pageHeadingKicker}>
            {isTaskingWorkspace ? "Tasking Setup" : "Client Setup"}
          </div>
          <div style={pageHeadingSubtext}>
            {isTaskingWorkspace
              ? "Maintain recurring work rules, frequencies and starting periods."
              : "Maintain the client master data used across CRM, compliance and tax. Services and recurring work are managed under Tasking Setup."}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            ...topSaveButton,
            opacity: saving ? 0.6 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving
            ? "Saving..."
            : isTaskingWorkspace
              ? "Save tasking"
              : mode === "create"
                ? "Save"
                : "Save changes"}
        </button>
      </div>

      {!isTaskingWorkspace ? (
        <div style={contentHeading}>
          <div>
            <h1 style={titleStyle}>
              {mode === "create" ? "Add Client" : "Edit Client"}
            </h1>
            <p style={contentSubtitle}>
              Maintain the client master record used across CRM, compliance and recurring work.
            </p>
          </div>
        </div>
      ) : null}

      {errorMessage && <div style={errorBox}>{errorMessage}</div>}

      {!isTaskingWorkspace ? (
        <>
          <SectionHeader
            title="Core Details"
            open={activeSection === "core"}
            onClick={() =>
              setActiveSection(activeSection === "core" ? "" : "core")
            }
          />

          {activeSection === "core" && (
            <SectionBody>
              <div style={grid4}>
                <Field label="Name *"><input style={inputStyle} value={clientName} onChange={(event) => setClientName(event.target.value)} /></Field>
                <Field label="Record Type *">
                  <select style={inputStyle} value={clientCategory} onChange={(event) => setClientCategory(event.target.value as "individual" | "entity" | "trust" | "")}>
                    <option value="">Select...</option><option value="individual">Individual</option><option value="entity">Entity</option><option value="trust">Trust</option>
                  </select>
                </Field>
                <Field label="Entity / Legal Type *">
                  <select style={inputStyle} value={clientType} onChange={(event) => { const nextType = event.target.value; setClientType(nextType); if (nextType === "Individual") setClientCategory("individual"); else if (nextType === "Trust") setClientCategory("trust"); else if (nextType) setClientCategory("entity"); }}>
                    <option value="">Select...</option><option value="PTY LTD">PTY LTD</option><option value="Close Corporation">Close Corporation</option><option value="Individual">Individual</option><option value="Trust">Trust</option><option value="Non-Profit Company">Non-Profit Company</option><option value="Partnership">Partnership</option><option value="Sole Proprietor">Sole Proprietor</option>
                  </select>
                </Field>
                <Field label="Client Group">
                  <select
                    style={inputStyle}
                    value={clientGroupId}
                    onChange={(event) => setClientGroupId(event.target.value)}
                  >
                    <option value="">No group</option>
                    {groupOptions.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.group_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={relationshipRow}>
                <Field label="PracticePilot Relationship *">
                  <select style={inputStyle} value={relationshipStatus} onChange={(event) => setRelationshipStatus(event.target.value as "flying_client" | "in_airspace" | "on_radar" | "former_client")}>
                    <option value="flying_client">Flying Client</option><option value="in_airspace">In Airspace</option><option value="on_radar">On Radar</option><option value="former_client">Former Client</option>
                  </select>
                </Field>
                <Field label="Service Relationship">
                  <select style={inputStyle} value={engagementType} disabled={!isFlyingClient} onChange={(event) => setEngagementType(event.target.value as "ongoing_monthly" | "annual_monthly_retainer" | "annual_ad_hoc" | "")}>
                    <option value="">{isFlyingClient ? "Select..." : "Not applicable"}</option><option value="ongoing_monthly">Ongoing monthly</option><option value="annual_monthly_retainer">Annual – monthly retainer</option><option value="annual_ad_hoc">Annual – ad hoc</option>
                  </select>
                </Field>
                <div style={relationshipSummary}><strong>{relationshipStatusLabel}</strong><span>{relationshipStatus === "flying_client" ? "Actively engaged. Services and recurring work may apply." : relationshipStatus === "in_airspace" ? "Known to the practice, but not currently engaged." : relationshipStatus === "on_radar" ? "A genuine future opportunity." : "No longer actively engaged."}</span></div>
              </div>

              <div style={grid4}>
                <Field label="Trading Name"><input style={inputStyle} value={tradingName} onChange={(event) => setTradingName(event.target.value)} /></Field>
                <Field label={isIndividual ? "ID / Passport Number" : "Registration Number"}><input style={inputStyle} value={isIndividual ? idPassportNumber : registrationNumber} onChange={(event) => isIndividual ? setIdPassportNumber(event.target.value) : setRegistrationNumber(event.target.value)} /></Field>
                <Field label={isIndividual ? "Date of Birth" : "Registration Date"}><input type="date" style={inputStyle} value={isIndividual ? dateOfBirth : registrationDate} onChange={(event) => isIndividual ? setDateOfBirth(event.target.value) : setRegistrationDate(event.target.value)} /></Field>
                <Field label="Financial Year End"><select style={inputStyle} value={yearEnd} onChange={(event) => setYearEnd(event.target.value)}><option value="">Select...</option>{months.map((month) => <option key={month} value={month}>{month}</option>)}</select></Field>
                <Field label="Internal Code"><input style={inputStyle} value={internalCode} onChange={(event) => setInternalCode(event.target.value)} /></Field>
              </div>
            </SectionBody>
          )}
        </>
      ) : null}


      {isTaskingWorkspace && !isFlyingClient ? (
        <SectionBody>
          <div style={nonFlyingNotice}>
            Services and recurring tasking are only active for Flying Clients.
            Change the PracticePilot Relationship to Flying Client when this record becomes actively engaged.
          </div>
        </SectionBody>
      ) : null}

      {isTaskingWorkspace && isFlyingClient && (
        <SectionBody>
          <div style={taskingIntroBar}>
            <div>
              <div style={taskingIntroEyebrow}>Tasking setup</div>
              <strong style={taskingIntroTitle}>
                From which period must PracticePilot take responsibility?
              </strong>
              <div style={taskingIntroText}>
                Choose the first period PP must manage for each active service.
                The preview shows exactly what will be created before you save.
              </div>
            </div>
            <div style={taskingIntroRule}>
              First period in PP = first work PP must create
            </div>
          </div>

          <div style={taskingWorkspace}>
            <div style={taskingPlanner}>
              {taskingGroups.map((group) => {
                const groupServices = group.services.filter((serviceName) =>
                  visibleServices.includes(serviceName)
                );

                return (
                  <section key={group.key} style={taskingGroup}>
                    <div style={taskingGroupHeader}>
                      <div>
                        <strong>{group.title}</strong>
                        <span style={taskingGroupSubtitle}>{group.subtitle}</span>
                      </div>
                      <span style={taskingGroupCount}>
                        {groupServices.filter((name) => {
                          const service = services[name];
                          if (!service?.selected) return false;

                          return !registrationServiceAlreadyComplete(name, {
                            incomeTaxNumber,
                            vatNumber,
                            payeNumber,
                            uifNumber,
                            wccRefNr,
                            customsNumber,
                          });
                        }).length}/
                        {groupServices.length} active
                      </span>
                    </div>

                    <div style={taskingColumnHeader}>
                      <div>Service</div>
                      <div>Frequency / type</div>
                      <div>PP starts with</div>
                      <div>PP will create</div>
                    </div>

                    {groupServices.map((serviceName) => {
                      const service = services[serviceName] || {
                        selected: false,
                        frequency: defaultFrequency(serviceName),
                        firstPeriodStart: "",
                        firstPeriodEnd: "",
                        settings: {},
                      };
                      const serviceOption = serviceOptionByName.get(serviceName);
                      const frequencyOptions = serviceFrequencyOptions(
                        serviceName,
                        serviceOption
                      );
                      const manualService = isManualService(serviceName, service);
                      const registrationComplete = registrationServiceAlreadyComplete(
                        serviceName,
                        {
                          incomeTaxNumber,
                          vatNumber,
                          payeNumber,
                          uifNumber,
                          wccRefNr,
                          customsNumber,
                        }
                      );

                      const taskingYear = String(service.settings.tasking_year || "");
                      const provisionalPeriod = String(service.settings.provisional_period || "1");
                      const emp501Cycle = String(service.settings.emp501_cycle || "interim");
                      const vatCategory = String(service.settings.vat_category || "");
                      const selectedVatValue =
                        service.firstPeriodStart && service.firstPeriodEnd
                          ? `${service.firstPeriodStart}|${service.firstPeriodEnd}`
                          : "";

                      return (
                        <div
                          key={serviceName}
                          style={{
                            ...taskingRow,
                            ...(registrationComplete
                              ? taskingRowRegistered
                              : service.selected
                                ? {}
                                : taskingRowInactive),
                          }}
                        >
                          <label style={taskingServiceCell}>
                            <input
                              type="checkbox"
                              checked={registrationComplete ? false : service.selected}
                              disabled={registrationComplete}
                              onChange={(event) =>
                                updateService(serviceName, {
                                  selected: event.target.checked,
                                })
                              }
                            />
                            <ServiceIcon serviceName={serviceName} size={22} />
                            <span>{serviceName}</span>
                            {registrationComplete ? (
                              <span style={taskingRegisteredBadge}>Already registered</span>
                            ) : null}
                          </label>

                          <div style={taskingTypeCell}>
                            {serviceName === "Accounting" ? (
                              <select
                                style={taskingCompactSelect}
                                disabled={!service.selected}
                                value={service.frequency || "Monthly"}
                                onChange={(event) =>
                                  updateAccountingTasking(event.target.value)
                                }
                              >
                                {ACCOUNTING_FREQUENCIES.map((frequency) => (
                                  <option key={frequency} value={frequency}>
                                    {frequency}
                                  </option>
                                ))}
                              </select>
                            ) : serviceName === "Payroll" ? (
                              <select
                                style={taskingCompactSelect}
                                disabled={!service.selected}
                                value={service.frequency || "Monthly"}
                                onChange={(event) =>
                                  updatePayrollTasking(event.target.value)
                                }
                              >
                                {PAYROLL_FREQUENCIES.map((frequency) => (
                                  <option key={frequency} value={frequency}>
                                    {frequency}
                                  </option>
                                ))}
                              </select>
                            ) : serviceName === "VAT201" ? (
                              <select
                                style={taskingCompactSelect}
                                disabled={!service.selected}
                                value={vatCategory}
                                onChange={(event) =>
                                  updateVatCategory(serviceName, event.target.value)
                                }
                              >
                                <option value="">Choose category</option>
                                <option value="A">A · 2-monthly · odd month end</option>
                                <option value="B">B · 2-monthly · even month end</option>
                                <option value="C">C · monthly</option>
                              </select>
                            ) : ["EMP201", "EMP501", "Provisional Tax", "Financial Statements", "Income Tax", "CIPC Annual Return", "Beneficial Ownership Declaration", "Workmans Compensation", "WCA Letter of Good Standing"].includes(serviceName) ? (
                              <span style={taskingTypeBadge}>
                                {getTaskingTypeLabel(serviceName, service)}
                              </span>
                            ) : (
                              <select
                                style={taskingCompactSelect}
                                disabled={!service.selected}
                                value={service.frequency || defaultFrequency(serviceName)}
                                onChange={(event) => {
                                  const nextFrequency = event.target.value;
                                  updateService(serviceName, {
                                    frequency: nextFrequency,
                                    firstPeriodStart:
                                      nextFrequency === "Once-off" || nextFrequency === "Ad hoc"
                                        ? ""
                                        : service.firstPeriodStart,
                                    firstPeriodEnd:
                                      nextFrequency === "Once-off" || nextFrequency === "Ad hoc"
                                        ? ""
                                        : service.firstPeriodEnd,
                                    settings: {
                                      ...(service.settings || {}),
                                      tasking_mode:
                                        nextFrequency === "Once-off" || nextFrequency === "Ad hoc"
                                          ? "manual"
                                          : "auto",
                                    },
                                  });
                                }}
                              >
                                {frequencyOptions.map((frequency) => (
                                  <option key={frequency} value={frequency}>
                                    {frequency}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div style={taskingStartCell}>
                            {serviceName === "Payroll" &&
                            service.frequency !== "Monthly" ? (
                              <input
                                type="date"
                                style={taskingCompactInput}
                                disabled={!service.selected}
                                value={service.firstPeriodStart || ""}
                                onChange={(event) =>
                                  updatePayrollTasking(
                                    service.frequency || "Weekly",
                                    event.target.value
                                  )
                                }
                              />
                            ) : manualService ? (
                              <span style={taskingTypeBadge}>No recurring tasking</span>
                            ) : ["Accounting", "Payroll", "EMP201", "Management Reports"].includes(serviceName) ||
                              MONTH_BASED_FREQUENCIES.has(service.frequency) ? (
                              <input
                                type="month"
                                style={taskingCompactInput}
                                disabled={!service.selected}
                                value={monthInputValue(service.firstPeriodStart)}
                                onChange={(event) =>
                                  serviceName === "Accounting"
                                    ? updateAccountingTasking(
                                        service.frequency || "Monthly",
                                        event.target.value
                                      )
                                    : serviceName === "Payroll"
                                      ? updatePayrollTasking(
                                          service.frequency || "Monthly",
                                          event.target.value
                                        )
                                      : updateMonthlyTasking(
                                          serviceName,
                                          event.target.value
                                        )
                                }
                              />
                            ) : serviceName === "VAT201" ? (
                              <select
                                style={taskingCompactSelect}
                                disabled={!service.selected || !vatCategory}
                                value={selectedVatValue}
                                onChange={(event) =>
                                  updateVatPeriod(serviceName, event.target.value)
                                }
                              >
                                <option value="">Choose first VAT period</option>
                                {vatPeriodOptions(vatCategory).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : serviceName === "Provisional Tax" ? (
                              <div style={taskingInlineControls}>
                                <select
                                  style={taskingCompactSelect}
                                  disabled={!service.selected}
                                  value={taskingYear}
                                  onChange={(event) =>
                                    updateProvisionalTasking(
                                      event.target.value,
                                      provisionalPeriod
                                    )
                                  }
                                >
                                  <option value="">Tax year</option>
                                  {buildYearOptions().map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                  ))}
                                </select>
                                <select
                                  style={taskingCompactSelect}
                                  disabled={!service.selected}
                                  value={provisionalPeriod}
                                  onChange={(event) =>
                                    updateProvisionalTasking(taskingYear, event.target.value)
                                  }
                                >
                                  <option value="1">Period 1</option>
                                  <option value="2">Period 2</option>
                                  <option value="3">Period 3</option>
                                </select>
                              </div>
                            ) : serviceName === "EMP501" ? (
                              <div style={taskingInlineControls}>
                                <select
                                  style={taskingCompactSelect}
                                  disabled={!service.selected}
                                  value={taskingYear}
                                  onChange={(event) =>
                                    updateEmp501Tasking(event.target.value, emp501Cycle)
                                  }
                                >
                                  <option value="">Tax year</option>
                                  {buildYearOptions().map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                  ))}
                                </select>
                                <select
                                  style={taskingCompactSelect}
                                  disabled={!service.selected}
                                  value={emp501Cycle}
                                  onChange={(event) =>
                                    updateEmp501Tasking(taskingYear, event.target.value)
                                  }
                                >
                                  <option value="interim">Interim</option>
                                  <option value="annual">Annual</option>
                                </select>
                              </div>
                            ) : ["Weekly", "Fortnightly"].includes(service.frequency) ? (
                              <input
                                type="date"
                                style={taskingCompactInput}
                                disabled={!service.selected}
                                value={service.firstPeriodStart || ""}
                                onChange={(event) => {
                                  const period = payrollPeriodFromStart(
                                    event.target.value,
                                    service.frequency
                                  );
                                  updateService(serviceName, {
                                    firstPeriodStart: period.start,
                                    firstPeriodEnd: period.end,
                                    settings: {
                                      ...(service.settings || {}),
                                      tasking_period_type:
                                        service.frequency === "Fortnightly"
                                          ? "fortnight"
                                          : "week",
                                      tasking_period_label: period.label,
                                    },
                                  });
                                }}
                              />
                            ) : (
                              <select
                                style={taskingCompactSelect}
                                disabled={!service.selected}
                                value={taskingYear}
                                onChange={(event) =>
                                  updateAnnualTasking(serviceName, event.target.value)
                                }
                              >
                                <option value="">Choose year</option>
                                {buildYearOptions().map((year) => (
                                  <option key={year} value={year}>{year}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div style={taskingPreviewCell}>
                            {service.selected
  ? getTaskPreviewLabel(serviceName, service)
  : "Not active"}
                          </div>
                        </div>
                      );
                    })}

                    {group.title === "VAT" ? (
                      <div style={vatGuideBar}>
                        <strong>VAT categories:</strong>
                        <span>A · 2-monthly, periods end Jan/Mar/May/Jul/Sep/Nov</span>
                        <span>B · 2-monthly, periods end Feb/Apr/Jun/Aug/Oct/Dec</span>
                        <span>C · Monthly</span>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>

            <aside style={taskingLivePreview}>
              <div style={taskingPreviewHeader}>
                <div>
                  <div style={taskingPreviewEyebrow}>Onboarding timeline</div>
                  <strong>Upcoming work from your starting periods</strong>
                </div>
                <span style={taskingLiveBadge}>Live preview</span>
              </div>

              <div style={taskingTimelineList}>
                {onboardingTimeline.map((item, index) => (
                  <div key={item.serviceName} style={taskingTimelineItem}>
                    <div style={taskingTimelineDate}>{item.dateLabel}</div>

                    <div style={taskingTimelineRail}>
                      <div
                        style={{
                          ...taskingTimelineLine,
                          top: index === 0 ? "50%" : 0,
                          bottom:
                            index === onboardingTimeline.length - 1
                              ? "50%"
                              : 0,
                        }}
                      />
                      <div style={taskingTimelineIconWrap}>
                        <ServiceIcon serviceName={item.serviceName} size={24} />
                      </div>
                    </div>

                    <div style={taskingTimelineContent}>
                      <strong style={taskingPreviewItemTitle}>
                        {item.title}
                      </strong>
                      <div style={taskingPreviewItemText}>
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}

                {onboardingTimeline.length === 0 ? (
                  <div style={taskingPreviewEmpty}>
                    Select a service and starting period. The onboarding timeline
                    builds here immediately.
                  </div>
                ) : null}
              </div>

              <div style={taskingPreviewFoot}>
                <strong>Live preview only.</strong>
                <span>The timeline updates as you choose services and periods. Tasks are created only when you save.</span>
              </div>
            </aside>
          </div>
        </SectionBody>
      )}

      {!isTaskingWorkspace ? (
        <SectionHeader
        title="Tax & Statutory Registrations"
        open={activeSection === "statutory"}
        onClick={() =>
          setActiveSection(activeSection === "statutory" ? "" : "statutory")
        }
      />
      ) : null}

      {!isTaskingWorkspace && activeSection === "statutory" && (
        <SectionBody>
          <div style={statutoryNotice}>
            <strong>Existing registration details</strong>
            <span>
              Capture numbers already issued to the client here. PracticePilot uses these as master data and will only start a registration workflow where a registration is still missing.
            </span>
          </div>

          <div style={subHeading}>Tax and labour registrations</div>

          <div style={grid4}>
            <Field label="Income Tax Number">
              <input
                style={inputStyle}
                value={incomeTaxNumber}
                onChange={(event) => setIncomeTaxNumber(event.target.value)}
              />
            </Field>

            <Field label="VAT Number">
              <input
                style={inputStyle}
                value={vatNumber}
                onChange={(event) => setVatNumber(event.target.value)}
              />
            </Field>

            <Field label="PAYE Number">
              <input
                style={inputStyle}
                value={payeNumber}
                onChange={(event) => setPayeNumber(event.target.value)}
              />
            </Field>

            <Field label="UIF Number">
              <input
                style={inputStyle}
                value={uifNumber}
                onChange={(event) => setUifNumber(event.target.value)}
              />
            </Field>

            <Field label="WCC / COIDA Reference">
              <input
                style={inputStyle}
                value={wccRefNr}
                onChange={(event) => setWccRefNr(event.target.value)}
              />
            </Field>

            <Field label="Customs Number">
              <input
                style={inputStyle}
                value={customsNumber}
                onChange={(event) => setCustomsNumber(event.target.value)}
              />
            </Field>

            <label style={checkboxField}>
              <input
                type="checkbox"
                checked={sdlRegistered}
                onChange={(event) => setSdlRegistered(event.target.checked)}
              />
              SDL Registered
            </label>
          </div>
        </SectionBody>
      )}

      {!isTaskingWorkspace ? (
        <SectionHeader
        title="Contacts and Addresses"
        open={activeSection === "contact"}
        onClick={() =>
          setActiveSection(activeSection === "contact" ? "" : "contact")
        }
      />
      ) : null}

      {!isTaskingWorkspace && activeSection === "contact" && (
        <SectionBody>
          <div style={grid5}>
            <Field label="Primary Contact">
              <input
                style={inputStyle}
                value={primaryContact}
                onChange={(event) =>
                  setPrimaryContact(event.target.value)
                }
              />
            </Field>

            <Field label="Position">
              <input
                style={inputStyle}
                value={contactPosition}
                onChange={(event) =>
                  setContactPosition(event.target.value)
                }
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                style={inputStyle}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Field label="Telephone">
              <input
                style={inputStyle}
                value={telephone}
                onChange={(event) => setTelephone(event.target.value)}
              />
            </Field>

            <Field label="Cellphone">
              <input
                style={inputStyle}
                value={cellphone}
                onChange={(event) => setCellphone(event.target.value)}
              />
            </Field>
          </div>

          <div style={subHeading}>Physical Address</div>

          <div style={grid5}>
            <input
              style={inputStyle}
              placeholder="Line 1"
              value={physical1}
              onChange={(event) => setPhysical1(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Line 2 / Suburb"
              value={physical2}
              onChange={(event) => setPhysical2(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="City"
              value={physicalCity}
              onChange={(event) => setPhysicalCity(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Province"
              value={physicalProvince}
              onChange={(event) =>
                setPhysicalProvince(event.target.value)
              }
            />
            <input
              style={inputStyle}
              placeholder="Postal Code"
              value={physicalPostalCode}
              onChange={(event) =>
                setPhysicalPostalCode(event.target.value)
              }
            />
          </div>

          <div style={subHeadingRow}>
            <div style={{ ...subHeading, margin: 0, flex: 1 }}>Postal Address</div>
            <button
              type="button"
              onClick={copyPhysicalToPostal}
              style={copyButton}
            >
              Copy Physical to Postal
            </button>
          </div>

          <div style={grid5}>
            <input
              style={inputStyle}
              placeholder="Line 1"
              value={postal1}
              onChange={(event) => setPostal1(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Line 2 / Suburb"
              value={postal2}
              onChange={(event) => setPostal2(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="City"
              value={postalCity}
              onChange={(event) => setPostalCity(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Province"
              value={postalProvince}
              onChange={(event) =>
                setPostalProvince(event.target.value)
              }
            />
            <input
              style={inputStyle}
              placeholder="Postal Code"
              value={postalPostalCode}
              onChange={(event) =>
                setPostalPostalCode(event.target.value)
              }
            />
          </div>
        </SectionBody>
      )}

      {!isTaskingWorkspace ? (
        <SectionHeader
        title="Internal Responsibility"
        open={activeSection === "internal"}
        onClick={() =>
          setActiveSection(activeSection === "internal" ? "" : "internal")
        }
      />
      ) : null}

      {!isTaskingWorkspace && activeSection === "internal" && (
        <SectionBody>
          <div style={grid3}>
            <UserSelect
              label="Client Lead"
              value={clientLeadUserId}
              setValue={setClientLeadUserId}
              users={users}
            />

            <UserSelect
              label="Default Work Owner"
              value={managerUserId}
              setValue={setManagerUserId}
              users={users}
            />

            <UserSelect
              label="Reviewer"
              value={partnerUserId}
              setValue={setPartnerUserId}
              users={users}
            />
          </div>
        </SectionBody>
      )}

      {!isTaskingWorkspace ? (
        <div style={footerBar}>
          <button
            type="button"
            onClick={() =>
              router.push(
                mode === "edit" && clientId
                  ? `/crm/client/${clientId}`
                  : "/crm/clients"
              )
            }
            style={secondaryButton}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              ...primaryButton,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving
              ? "Saving..."
              : mode === "create"
                ? "Save"
                : "Save changes"}
          </button>
        </div>
      ) : null}
    </div>
  );
}


function SectionHeader({
  title,
  open,
  onClick,
}: {
  title: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" style={sectionHeader} onClick={onClick}>
      <span>{title}</span>
      <span>{open ? "−" : "+"}</span>
    </button>
  );
}

function SectionBody({ children }: { children: ReactNode }) {
  return <section style={sectionBody}>{children}</section>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function UserSelect({
  label,
  value,
  setValue,
  users,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  users: UserOption[];
}) {
  return (
    <Field label={label}>
      <select
        style={inputStyle}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">Unassigned</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.full_name || user.email}
          </option>
        ))}
      </select>
    </Field>
  );
}

const months = [
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

const statutoryNotice: React.CSSProperties = {
  marginBottom: "18px",
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  borderLeft: "4px solid #5f8f7b",
  background: "#f2f7f4",
  color: "#40515d",
  fontSize: "12px",
  lineHeight: 1.45,
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "0 8px 20px",
  background: "#eef2f5",
  color: "#10233a",
};

const titleBar: React.CSSProperties = {
  display: "none",
};

const eyebrow: React.CSSProperties = {
  display: "none",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 500,
  letterSpacing: "-0.02em",
  color: "#111827",
};

const errorBox: React.CSSProperties = {
  padding: "12px 14px",
  marginBottom: "14px",
  border: "1px solid #dc2626",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 700,
};

const sectionHeader: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "7px 9px",
  marginTop: "10px",
  border: "1px solid #d2d9e2",
  borderRadius: 0,
  background: "#f7f8fa",
  color: "#111827",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
};

const sectionBody: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #d2d9e2",
  borderTop: "none",
  background: "#ffffff",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 700,
  color: "#2f4055",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "28px",
  padding: "3px 6px",
  border: "1px solid #cfd7e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#111827",
  fontSize: "10px",
  boxSizing: "border-box",
  fontWeight: 600,
};

const relationshipRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(220px,.9fr) minmax(250px,1fr) minmax(0,1.4fr)", gap: "7px", alignItems: "end", marginBottom: "7px" };
const relationshipSummary: React.CSSProperties = { minHeight: "28px", padding: "4px 7px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "1px", borderLeft: "2px solid #819bad", background: "#f7f9fb", color: "#526273", fontSize: "9px", lineHeight: 1.3 };

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "7px",
};

const grid4: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "7px",
  marginBottom: "8px",
};

const relationshipStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(240px, .8fr) minmax(0, 2.2fr)",
  gap: "12px",
  alignItems: "stretch",
  marginBottom: "12px",
  padding: "12px",
  border: "1px solid #c8d5df",
  background: "#f5f8fa",
};

const relationshipExplanation: React.CSSProperties = {
  minHeight: "38px",
  padding: "8px 10px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "3px",
  borderLeft: "3px solid #819bad",
  background: "#ffffff",
  color: "#536273",
  fontSize: "10px",
  lineHeight: 1.4,
};

const nonFlyingNotice: React.CSSProperties = {
  marginBottom: "12px",
  padding: "11px 12px",
  borderLeft: "4px solid #819bad",
  background: "#f5f8fa",
  color: "#40515d",
  fontSize: "10px",
  lineHeight: 1.5,
};

const grid5: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "7px",
  marginBottom: "8px",
};

const taskingIntroBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "8px 10px",
  marginTop: 0,
  marginBottom: "8px",
  borderTop: "1px solid #b9cad6",
  borderBottom: "1px solid #b9cad6",
  background: "#f4f8fa",
};

const taskingIntroEyebrow: React.CSSProperties = {
  marginBottom: "4px",
  color: "#0f6f86",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: 0,
};

const taskingIntroTitle: React.CSSProperties = {
  display: "block",
  color: "#10233a",
  fontSize: "14px",
};

const taskingIntroText: React.CSSProperties = {
  marginTop: "3px",
  color: "#5a6d7d",
  fontSize: "10px",
};

const taskingIntroRule: React.CSSProperties = {
  flex: "0 0 auto",
  paddingLeft: "16px",
  borderLeft: "1px solid #cbd7df",
  color: "#486171",
  fontSize: "10px",
  fontWeight: 800,
};

const taskingWorkspace: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 310px",
  gap: "14px",
  alignItems: "start",
};

const taskingPlanner: React.CSSProperties = {
  minWidth: 0,
};

const taskingGroup: React.CSSProperties = {
  marginBottom: "12px",
  border: "1px solid #cfd9e1",
  background: "#ffffff",
};

const taskingGroupHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 10px",
  borderBottom: "1px solid #cfd9e1",
  background: "#eef3f6",
  color: "#10233a",
  fontSize: "12px",
};

const taskingGroupSubtitle: React.CSSProperties = {
  marginLeft: "8px",
  color: "#748492",
  fontSize: "9px",
  fontWeight: 600,
};

const taskingGroupCount: React.CSSProperties = {
  color: "#5c6c79",
  fontSize: "9px",
  fontWeight: 800,
};

const taskingColumnHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr 1.35fr 1.35fr",
  gap: "7px",
  padding: "7px 9px",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: 0,
};

const taskingRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr 1.35fr 1.35fr",
  gap: "7px",
  alignItems: "center",
  minHeight: "42px",
  padding: "6px 9px",
  borderBottom: "1px solid #e0e7ec",
  fontSize: "10px",
};

const taskingRowInactive: React.CSSProperties = {
  background: "#fafbfc",
  color: "#8996a1",
};

const taskingServiceCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  minWidth: 0,
  fontWeight: 850,
  color: "inherit",
};

const taskingTypeCell: React.CSSProperties = {
  minWidth: 0,
};

const taskingRowRegistered: React.CSSProperties = {
  background: "#f4faf6",
  color: "#64776b",
};

const taskingRegisteredBadge: React.CSSProperties = {
  marginLeft: "4px",
  padding: "2px 5px",
  border: "1px solid #abd9bb",
  background: "#eef9f2",
  color: "#2f7b4d",
  fontSize: "8px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const taskingTypeBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 6px",
  border: "1px solid #d8e0e6",
  background: "#f4f6f8",
  color: "#5b6976",
  fontSize: "9px",
  fontWeight: 800,
};

const taskingStartCell: React.CSSProperties = {
  minWidth: 0,
};

const taskingCompactInput: React.CSSProperties = {
  width: "100%",
  minHeight: "31px",
  border: "1px solid #cbd5df",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  padding: "4px 6px",
  fontSize: "10px",
  fontWeight: 750,
  boxSizing: "border-box",
};

const taskingCompactSelect: React.CSSProperties = {
  ...taskingCompactInput,
};

const taskingInlineControls: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "5px",
};

const taskingPreviewCell: React.CSSProperties = {
  color: "#324b5d",
  fontSize: "10px",
  fontWeight: 750,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const vatGuideBar: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "5px 12px",
  padding: "7px 9px",
  borderTop: "1px solid #dbe5ea",
  background: "#f2f8f8",
  color: "#45606c",
  fontSize: "9px",
  lineHeight: 1.45,
};

const taskingLivePreview: React.CSSProperties = {
  position: "sticky",
  top: "12px",
  border: "1px solid #cfd9e1",
  background: "#ffffff",
};

const taskingPreviewHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  padding: "10px 11px",
  borderBottom: "1px solid #d7e0e6",
  color: "#10233a",
  fontSize: "12px",
};

const taskingPreviewEyebrow: React.CSSProperties = {
  marginBottom: "3px",
  color: "#687b89",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: 0,
};

const taskingLiveBadge: React.CSSProperties = {
  padding: "3px 6px",
  border: "1px solid #a9c6b4",
  background: "#eef6f1",
  color: "#3d7652",
  fontSize: "9px",
  fontWeight: 800,
};

const taskingTimelineList: React.CSSProperties = {
  padding: "6px 10px 10px",
};

const taskingTimelineItem: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "62px 34px minmax(0, 1fr)",
  gap: "5px",
  minHeight: "54px",
  alignItems: "stretch",
};

const taskingTimelineDate: React.CSSProperties = {
  paddingTop: "17px",
  color: "#607486",
  fontSize: "9px",
  fontWeight: 800,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const taskingTimelineRail: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "54px",
};

const taskingTimelineLine: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  width: "1px",
  transform: "translateX(-50%)",
  background: "#cbd8e1",
};

const taskingTimelineIconWrap: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "3px 0",
  background: "#ffffff",
};

const taskingTimelineContent: React.CSSProperties = {
  alignSelf: "center",
  minWidth: 0,
  padding: "8px 0 9px 3px",
  borderBottom: "1px solid #e4eaee",
};

const taskingPreviewItemTitle: React.CSSProperties = {
  display: "block",
  color: "#10233a",
  fontSize: "10px",
};

const taskingPreviewItemText: React.CSSProperties = {
  marginTop: "2px",
  color: "#657784",
  fontSize: "9px",
  lineHeight: 1.35,
};

const taskingPreviewEmpty: React.CSSProperties = {
  padding: "18px 4px",
  color: "#7b8994",
  fontSize: "10px",
  lineHeight: 1.5,
};

const taskingPreviewFoot: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  padding: "9px 10px",
  borderTop: "1px solid #d7e0e6",
  background: "#f7f9fa",
  color: "#667783",
  fontSize: "9px",
};

const serviceIntro: React.CSSProperties = {
  padding: "10px 12px",
  marginBottom: "10px",
  borderLeft: "4px solid #008c99",
  background: "#edf8fa",
  fontSize: "13px",
  color: "#405568",
};

const taskingFieldLabel: React.CSSProperties = {
  marginBottom: 5,
  color: "#536273",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "none",
  letterSpacing: "0.04em",
};

const vatPreview: React.CSSProperties = {
  marginTop: 6,
  padding: "7px 9px",
  borderLeft: "3px solid #0f7c82",
  background: "#eef8f8",
  color: "#17394a",
  fontSize: 11,
  lineHeight: 1.5,
};

const vatDue: React.CSSProperties = {
  marginLeft: 12,
  fontWeight: 800,
};

const vatWarning: React.CSSProperties = {
  marginTop: 6,
  padding: "7px 9px",
  borderLeft: "3px solid #b7791f",
  background: "#fff8e8",
  color: "#7a4b00",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.45,
};

const serviceTableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1.25fr",
  gap: "7px",
  padding: "9px 10px",
  background: "#0f172a",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 800,
  textTransform: "none",
};

const serviceRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1.25fr",
  gap: "7px",
  alignItems: "center",
  padding: "8px 10px",
  border: "1px solid #d5e0e8",
  borderTop: "none",
};

const serviceCheckLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  fontWeight: 800,
  fontSize: "13px",
};

const subHeading: React.CSSProperties = {
  margin: "18px 0 10px",
  paddingBottom: "6px",
  borderBottom: "1px solid #a9bac8",
  fontWeight: 900,
  fontSize: "14px",
};

const checkboxField: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  minHeight: "38px",
  fontWeight: 800,
  fontSize: "13px",
};

const periodHint: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "10px",
  color: "#5a6d7d",
};

const subHeadingRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: "18px 0 10px",
};

const copyButton: React.CSSProperties = {
  padding: "7px 9px",
  border: "1px solid #7891a5",
  borderRadius: 0,
  background: "#ffffff",
  color: "#0b2f4f",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const footerBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "7px",
  marginTop: "10px",
  paddingTop: "9px",
  borderTop: "1px solid #a9bac8",
};

const primaryButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 10px",
  border: "1px solid #111827",
  borderRadius: 0,
  background: "#111827",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 10px",
  border: "1px solid #cfd7e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#111827",
  fontSize: "10px",
  fontWeight: 700,
  cursor: "pointer",
};


const workingFileBar: React.CSSProperties = {
  minHeight: "34px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "0 8px",
  margin: "6px 0",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
  fontSize: "12px",
};

const backButton: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid #cfd7e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

const workingFileLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: 0,
  color: "#1d4ed8",
};

const workingFileDivider: React.CSSProperties = {
  color: "#94a3b8",
};

const workingFileClient: React.CSSProperties = {
  fontWeight: 800,
  color: "#111827",
};

const workingFileMeta: React.CSSProperties = {
  color: "#526173",
};

const statusBadge: React.CSSProperties = {
  marginLeft: "auto",
  padding: "3px 7px",
  borderRadius: 2,
  background: "#e8eefc",
  color: "#1d4ed8",
  fontSize: "10px",
  fontWeight: 800,
};

const compactHeadingLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const pageHeadingBar: React.CSSProperties = {
  minHeight: "50px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "7px 10px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const pageHeadingKicker: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#111827",
};

const pageHeadingSubtext: React.CSSProperties = {
  marginTop: "2px",
  fontSize: "10px",
  color: "#64748b",
};

const topSaveButton: React.CSSProperties = {
  padding: "7px 11px",
  border: "1px solid #0f172a",
  borderRadius: 0,
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 800,
  fontSize: "10px",
};

const contentHeading: React.CSSProperties = {
  display: "none",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "10px",
  marginTop: "6px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const contentSubtitle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "10px",
  color: "#64748b",
};
