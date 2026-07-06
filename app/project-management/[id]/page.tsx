"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type VatMode = "Inclusive" | "Exclusive";

type ClientIncomeVatMode = "Inclusive" | "Exclusive" | "No VAT";

type Project = {
  id: string;
  name: string;
  number_of_phases: number;
  status: string;
  client_income_total?: number | null;
  client_income_vat_mode?: ClientIncomeVatMode | null;
  client_payment_count?: number | null;
  client_payment_percentages?: number[] | null;
  current_supplier_phase?: number | null;
  organisations?: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
};

type UserProfile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  can_edit_projects: boolean;
  access_enabled: boolean;
  can_access_projects: boolean;
};

type PhaseSplit = {
  id?: string;
  phaseNumber: number;
  percentage: number;
  calculatedAmount?: number;
  overrideAmount?: number | null;
  overrideType?: string | null;
};

type QuoteFile = {
  id: string;
  project_id: string;
  line_item_id: string;
  file_path: string;
  file_name: string;
  uploaded_at: string | null;
};

type LineItem = {
  id: string;
  description: string;
  amount: number;
  vatMode: VatMode;
  contractorId: string | null;
  quoteFilePath: string | null;
  quoteFileName: string | null;
  project_line_item_quote_files?: QuoteFile[];
  quoteFiles: QuoteFile[];
  phases: PhaseSplit[];
};

type ApiLineItem = {
  id: string;
  description: string;
  amount: number;
  vat_mode: VatMode;
  quote_file_path: string | null;
  quote_file_name: string | null;
  project_line_item_quote_files?: QuoteFile[];
  project_phase_splits: {
    id: string;
    phase_number: number;
    percentage: number;
    calculated_amount: number;
    override_amount: number | null;
    override_type: string | null;
  }[];
  contractor_id: string | null;
  project_contractors?: {
    id: string;
    contractor_name: string;
    trade_category: string | null;
  } | null;
};

type ProjectPayment = {
  id: string;
  payment_date: string | null;
  paid_amount: number;
};

type ProjectInvoice = {
  id: string;
  project_id: string;
  phase_number: number;
  invoice_number: string | null;
  invoice_date: string | null;
  expected_amount: number;
  invoiced_amount: number | null;
  status: string;
  project_payments?: ProjectPayment[];
};

type SupplierPayment = {
  id: string;
  project_id: string;
  line_item_id: string;
  phase_split_id: string | null;
  contractor_id: string | null;
  supplier_phase_number: number;
  paid_amount: number;
  payment_date: string | null;
  pop_file_path: string | null;
  pop_file_name: string | null;
  notes: string | null;
};

type Contractor = {
  id: string;
  contractor_name: string;
  trade_category: string | null;
  contact_person?: string | null;
email?: string | null;
phone?: string | null;
address?: string | null;
bank_details?: string | null;
vat_number?: string | null;
payment_terms?: string | null;
};

type TimelineItem = {
  id: string;
  project_id: string;
  organisation_id: string | null;
  contractor_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  project_contractors?: {
    id: string;
    contractor_name: string;
    trade_category: string | null;
  } | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(value);
}

function formatInputNumber(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return "";
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}




function isDateWithinTimelineItem(month: string, item: TimelineItem) {
  if (!item.start_date || !item.end_date) return false;

  const itemStartMonth = item.start_date.slice(0, 7);
  const itemEndMonth = item.end_date.slice(0, 7);

  return month >= itemStartMonth && month <= itemEndMonth;
} 

function calculateVat(lineItem: LineItem) {
  if (lineItem.vatMode === "Inclusive") {
    return lineItem.amount - lineItem.amount / 1.15;
  }

  return lineItem.amount * 0.15;
}

function calculateTotal(lineItem: LineItem) {
  if (lineItem.vatMode === "Inclusive") {
    return lineItem.amount;
  }

  return lineItem.amount * 1.15;
}

function calculateExcludingVat(lineItem: LineItem) {
  if (lineItem.vatMode === "Inclusive") {
    return lineItem.amount / 1.15;
  }

  return lineItem.amount;
}

function calculatePhaseAmount(lineItem: LineItem, percentage: number) {
  return calculateTotal(lineItem) * (percentage / 100);
}

function getPhasePercentage(lineItem: LineItem, phaseNumber: number) {
  return lineItem.phases.find((phase) => phase.phaseNumber === phaseNumber)?.percentage || 0;
}

function getPhaseDisplayAmount(lineItem: LineItem, phaseNumber: number) {
  const phase = lineItem.phases.find((phaseItem) => phaseItem.phaseNumber === phaseNumber);
  const percentage = getPhasePercentage(lineItem, phaseNumber);
  return phase?.overrideAmount ?? calculatePhaseAmount(lineItem, percentage);
}

function getPhaseDisplayPercentage(lineItem: LineItem, phaseNumber: number) {
  const total = calculateTotal(lineItem);
  if (!total) return 0;
  return (getPhaseDisplayAmount(lineItem, phaseNumber) / total) * 100;
}

function mapApiLineItem(item: ApiLineItem): LineItem {
  const phases = item.project_phase_splits
    .map((phase) => ({
      id: phase.id,
phaseNumber: Number(phase.phase_number),
percentage: Number(phase.percentage),
calculatedAmount: Number(phase.calculated_amount || 0),
overrideAmount: phase.override_amount === null ? null : Number(phase.override_amount),
overrideType: phase.override_type || null,
    }))
    .sort((a, b) => a.phaseNumber - b.phaseNumber);

  return {
  id: item.id,
  description: item.description,
  amount: Number(item.amount),
  vatMode: item.vat_mode,
  contractorId: item.contractor_id || null,
  quoteFilePath: item.quote_file_path || null,
  quoteFileName: item.quote_file_name || null,
  quoteFiles: item.project_line_item_quote_files || [],
  phases,
};
}

function isOlderThan30Days(dateValue: string | null) {
  if (!dateValue) return false;

  const invoiceDate = new Date(dateValue);
  const today = new Date();

  invoiceDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const differenceInMs = today.getTime() - invoiceDate.getTime();
  const differenceInDays = differenceInMs / (1000 * 60 * 60 * 24);

  return differenceInDays > 30;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = String(params.id || "");

  const [project, setProject] = useState<Project | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [vatMode, setVatMode] = useState<VatMode>("Exclusive");
  const [phasePercentages, setPhasePercentages] = useState<string[]>([]);

  const [clientIncomeTotal, setClientIncomeTotal] = useState("");
  const [clientIncomeVatMode, setClientIncomeVatMode] = useState<ClientIncomeVatMode>("Inclusive");
  const [clientPaymentCount, setClientPaymentCount] = useState("3");
  const [clientPaymentPercentages, setClientPaymentPercentages] = useState<string[]>(["33.33", "33.33", "33.34"]);
  const [clientPaymentAmounts, setClientPaymentAmounts] = useState<string[]>([]);
  const [savingClientIncome, setSavingClientIncome] = useState(false);
  const [currentSupplierPhase, setCurrentSupplierPhase] = useState("1");
  const [savingCurrentSupplierPhase, setSavingCurrentSupplierPhase] = useState(false);

  const [invoiceNumbers, setInvoiceNumbers] = useState<Record<number, string>>({});
  const [invoiceDates, setInvoiceDates] = useState<Record<number, string>>({});
  const [invoiceAmounts, setInvoiceAmounts] = useState<Record<number, string>>({});
  const [paidAmounts, setPaidAmounts] = useState<Record<number, string>>({});
  const [paymentDates, setPaymentDates] = useState<Record<number, string>>({});

  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [loadingSupplierPayments, setLoadingSupplierPayments] = useState(false);
  const [supplierPaidAmounts, setSupplierPaidAmounts] = useState<Record<string, string>>({});
  const [supplierPaymentDates, setSupplierPaymentDates] = useState<Record<string, string>>({});
  const [supplierPaymentNotes, setSupplierPaymentNotes] = useState<Record<string, string>>({});
  const [supplierPaymentLineFilter, setSupplierPaymentLineFilter] = useState("");
  const [supplierPaymentContractorFilter, setSupplierPaymentContractorFilter] = useState("");
  const [phasePaymentListPhase, setPhasePaymentListPhase] = useState("1");
  const [phasePaymentListLineFilter, setPhasePaymentListLineFilter] = useState("");
  const [phasePaymentListContractorFilter, setPhasePaymentListContractorFilter] = useState("");
  const [savingSupplierPaymentKey, setSavingSupplierPaymentKey] = useState<string | null>(null);
  const [uploadingPopKey, setUploadingPopKey] = useState<string | null>(null);

  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingLineItems, setLoadingLineItems] = useState(true);
  const [importingLineItems, setImportingLineItems] = useState(false);
  const [manualSplitLineItem, setManualSplitLineItem] = useState<LineItem | null>(null);
  const [evenSplitLineItem, setEvenSplitLineItem] = useState<LineItem | null>(null);
  const [phaseOverrideLineItem, setPhaseOverrideLineItem] = useState<LineItem | null>(null);
const [phaseOverrideValues, setPhaseOverrideValues] = useState<Record<number, string>>({});
const [manualSplitValues, setManualSplitValues] = useState<Record<number, string>>({});
const [manualSplitMode, setManualSplitMode] = useState<"amount" | "percentage">("amount");
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingInvoicePhase, setSavingInvoicePhase] = useState<number | null>(null);
  const [showQuoteSummary, setShowQuoteSummary] = useState(true);
const [showPhaseSchedule, setShowPhaseSchedule] = useState(true);
const [showInvoicesPayments, setShowInvoicesPayments] = useState(true);
const [selectedProjectSection, setSelectedProjectSection] = useState<
  | "overview"
  | "client-income"
  | "supplier-budget"
  | "supplier-schedule"
  | "phase-payments"
  | "supplier-payments"
  | "client-invoices"
  | "contractors"
  | "timeline"
  | "export"
  | "cashflow-control"
  | "exception-report"
>("overview");

const [contractors, setContractors] = useState<Contractor[]>([]);
const [contractorId, setContractorId] = useState("");
const [newContractorName, setNewContractorName] = useState("");
const [newContractorTrade, setNewContractorTrade] = useState("");
const [newContractorContact, setNewContractorContact] = useState("");
const [newContractorEmail, setNewContractorEmail] = useState("");
const [newContractorPhone, setNewContractorPhone] = useState("");
const [newContractorAddress, setNewContractorAddress] = useState("");
const [newContractorBankDetails, setNewContractorBankDetails] = useState("");
const [newContractorVatNumber, setNewContractorVatNumber] = useState("");
const [newContractorPaymentTerms, setNewContractorPaymentTerms] = useState("");
const [savingContractor, setSavingContractor] = useState(false);
const [importingContractors, setImportingContractors] = useState(false);

const [editingContractorId, setEditingContractorId] = useState<string | null>(null);
const [editContractorName, setEditContractorName] = useState("");
const [editContractorTrade, setEditContractorTrade] = useState("");
const [editContractorContact, setEditContractorContact] = useState("");
const [editContractorEmail, setEditContractorEmail] = useState("");
const [editContractorPhone, setEditContractorPhone] = useState("");
const [editContractorAddress, setEditContractorAddress] = useState("");
const [editContractorBankDetails, setEditContractorBankDetails] = useState("");
const [editContractorVatNumber, setEditContractorVatNumber] = useState("");
const [editContractorPaymentTerms, setEditContractorPaymentTerms] = useState("");
const [savingEditedContractor, setSavingEditedContractor] = useState(false);

const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
const [loadingTimelineItems, setLoadingTimelineItems] = useState(false);

function getTimelineDateRange() {
  const datedItems = timelineItems.filter((item) => item.start_date && item.end_date);

  if (datedItems.length === 0) {
    return [];
  }

  const startMonths = datedItems.map((item) => String(item.start_date).slice(0, 7));
  const endMonths = datedItems.map((item) => String(item.end_date).slice(0, 7));

  const firstMonth = startMonths.sort()[0];
  const lastMonth = endMonths.sort()[endMonths.length - 1];

  const [startYear, startMonth] = firstMonth.split("-").map(Number);
  const [endYear, endMonth] = lastMonth.split("-").map(Number);

  const months: string[] = [];

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);

    month += 1;

    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

const [timelineContractorId, setTimelineContractorId] = useState("");
const [timelineTitle, setTimelineTitle] = useState("");
const [timelineDescription, setTimelineDescription] = useState("");
const [timelineStartDate, setTimelineStartDate] = useState("");
const [timelineEndDate, setTimelineEndDate] = useState("");
const [timelineStatus, setTimelineStatus] = useState("Planned");
const [editingTimelineItemId, setEditingTimelineItemId] = useState<string | null>(null);
const [savingTimelineItem, setSavingTimelineItem] = useState(false);
const [uploadingQuoteLineItemId, setUploadingQuoteLineItemId] = useState<string | null>(null);
const [editingScheduleLineItemId, setEditingScheduleLineItemId] = useState<string | null>(null);

  const phaseNumbers = useMemo(() => {
    const count = project?.number_of_phases || 0;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [project]);

  const clientPaymentNumbers = useMemo(() => {
    const count = Math.max(1, Number(clientPaymentCount || 3));
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [clientPaymentCount]);


  function calculateIncomeIncludingVatFromValues(rawTotal: string, rawVatMode: ClientIncomeVatMode) {
    const value = Number(rawTotal || 0);

    if (rawVatMode === "Exclusive") {
      return value * 1.15;
    }

    return value;
  }

  function calculateClientPaymentAmountsFromPercentages(
    rawPercentages: string[],
    rawTotal: string,
    rawVatMode: ClientIncomeVatMode
  ) {
    const totalIncome = calculateIncomeIncludingVatFromValues(rawTotal, rawVatMode);

    return rawPercentages.map((percentage) => {
      const amount = totalIncome * (Number(percentage || 0) / 100);
      return amount ? amount.toFixed(2) : "";
    });
  }

useEffect(() => {
  loadSecurePage();
}, [projectId]);

  useEffect(() => {
    if (!project || editingLineItemId) return;
    setPhasePercentages(Array.from({ length: project.number_of_phases }, () => ""));
  }, [project, editingLineItemId]);

  useEffect(() => {
    if (!project) return;

    const loadedPaymentCount = Number(project.client_payment_count || 3);
    const safePaymentCount = loadedPaymentCount > 0 ? loadedPaymentCount : 3;

    setClientIncomeTotal(
      project.client_income_total === null || project.client_income_total === undefined
        ? ""
        : String(project.client_income_total)
    );
    setClientIncomeVatMode(project.client_income_vat_mode || "Inclusive");
    setClientPaymentCount(String(safePaymentCount));

    const loadedPercentages = Array.isArray(project.client_payment_percentages)
      ? project.client_payment_percentages
      : [];

    let percentages: string[];

    if (loadedPercentages.length === safePaymentCount) {
      percentages = loadedPercentages.map((value) => String(value));
    } else {
      const evenPercentage = Number((100 / safePaymentCount).toFixed(2));
      percentages = Array.from({ length: safePaymentCount }, () => String(evenPercentage));
      const runningTotal = percentages.reduce((total, value) => total + Number(value || 0), 0);
      percentages[safePaymentCount - 1] = String(
        Number((Number(percentages[safePaymentCount - 1] || 0) + (100 - runningTotal)).toFixed(2))
      );
    }

    setClientPaymentPercentages(percentages);
    setClientPaymentAmounts(
      calculateClientPaymentAmountsFromPercentages(
        percentages,
        project.client_income_total === null || project.client_income_total === undefined
          ? ""
          : String(project.client_income_total),
        project.client_income_vat_mode || "Inclusive"
      )
    );
  }, [project]);

  useEffect(() => {
    const numbers: Record<number, string> = {};
    const dates: Record<number, string> = {};
    const invoiceAmountsMap: Record<number, string> = {};
    const paidAmountsMap: Record<number, string> = {};
    const paymentDatesMap: Record<number, string> = {};

    invoices.forEach((invoice) => {
      const payment = invoice.project_payments?.[0];

      numbers[invoice.phase_number] = invoice.invoice_number || "";
      dates[invoice.phase_number] = invoice.invoice_date || "";

      invoiceAmountsMap[invoice.phase_number] =
        invoice.invoiced_amount === null ? "" : String(invoice.invoiced_amount);

      paidAmountsMap[invoice.phase_number] =
        payment?.paid_amount === undefined || payment?.paid_amount === null
          ? ""
          : String(payment.paid_amount);

      paymentDatesMap[invoice.phase_number] = payment?.payment_date || "";
    });

    setInvoiceNumbers(numbers);
    setInvoiceDates(dates);
    setInvoiceAmounts(invoiceAmountsMap);
    setPaidAmounts(paidAmountsMap);
    setPaymentDates(paymentDatesMap);
  }, [invoices]);

  async function loadSecurePage() {
  if (!projectId) return;

  setLoadingProject(true);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    window.location.href = "/login";
    return;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profileData) {
    alert("Could not load your user profile.");
    window.location.href = "/login";
    return;
  }

  if (!profileData.access_enabled || !profileData.can_access_projects) {
    alert("You do not have access to this module.");
    window.location.href = "/dashboard";
    return;
  }

  setProfile(profileData);

  const response = await fetch(`/api/projects/${projectId}`);
  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Could not load project.");
    window.location.href = "/project-management";
    return;
  }

  const loadedProject = data.project;

  const isInternalUser =
    profileData.role === "Super Admin" ||
    profileData.role === "Admin" ||
    profileData.role === "Staff";

  if (!isInternalUser && loadedProject.organisation_id !== profileData.organisation_id) {
    alert("You do not have access to this project.");
    window.location.href = "/project-management";
    return;
  }

  setProject(loadedProject);
  setCurrentSupplierPhase(String(loadedProject.current_supplier_phase || 1));
  setAccessChecked(true);

  await loadContractors(loadedProject.organisation_id);
  await loadTimelineItems();
  await loadLineItems();
  await loadInvoices();
  await loadSupplierPayments();

  setLoadingProject(false);
}

async function loadContractors(organisationId: string | null) {
  if (!organisationId) return;

  const response = await fetch(
  `/api/contractors?organisationId=${organisationId}&projectId=${projectId}`
);
  const text = await response.text();

  if (!text) {
    alert("Suppliers / Contractors API returned an empty response.");
    return;
  }

  const data = JSON.parse(text);

  if (response.ok) {
    setContractors(data.contractors || []);
  } else {
    alert(data.error || "Could not load contractors.");
  }
}

function handleEditTimelineItem(item: TimelineItem) {
  setEditingTimelineItemId(item.id);
  setTimelineContractorId(item.contractor_id || "");
  setTimelineTitle(item.title || "");
  setTimelineDescription(item.description || "");
  setTimelineStartDate(item.start_date || "");
  setTimelineEndDate(item.end_date || "");
  setTimelineStatus(item.status || "Planned");
}

async function handleAddTimelineItem() {
  if (!projectId) return;

  if (!timelineTitle.trim()) {
    alert("Timeline title is required.");
    return;
  }

  setSavingTimelineItem(true);
  const response = await fetch("/api/project-timeline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      organisationId: project?.organisations?.id || null,
      contractorId: timelineContractorId || null,
      title: timelineTitle,
      description: timelineDescription,
      startDate: timelineStartDate || null,
      endDate: timelineEndDate || null,
      status: timelineStatus,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Could not add timeline item.");
    return;
  }

  setTimelineContractorId("");
  setTimelineTitle("");
  setTimelineDescription("");
  setTimelineStartDate("");
  setTimelineEndDate("");
  setTimelineStatus("Planned");

  setSavingTimelineItem(false);
  await loadTimelineItems();
}

async function handleUpdateTimelineItem() {
  if (!editingTimelineItemId) return;

  if (!timelineTitle.trim()) {
    alert("Timeline title is required.");
    return;
  }

  setSavingTimelineItem(true);

  const response = await fetch("/api/project-timeline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "update",
      timelineItemId: editingTimelineItemId,
      contractorId: timelineContractorId || null,
      title: timelineTitle,
      description: timelineDescription,
      startDate: timelineStartDate || null,
      endDate: timelineEndDate || null,
      status: timelineStatus,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    alert(data.error || "Could not update timeline item.");
    setSavingTimelineItem(false);
    return;
  }

  setEditingTimelineItemId(null);
  setTimelineContractorId("");
  setTimelineTitle("");
  setTimelineDescription("");
  setTimelineStartDate("");
  setTimelineEndDate("");
  setTimelineStatus("Planned");
  setSavingTimelineItem(false);

  await loadTimelineItems();
}

async function handleDeleteTimelineItem(timelineItemId: string) {
  const confirmed = window.confirm("Are you sure you want to delete this timeline item?");

  if (!confirmed) return;

  const response = await fetch("/api/project-timeline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "delete",
      timelineItemId,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    alert(data.error || "Could not delete timeline item.");
    return;
  }

  await loadTimelineItems();
}
async function handleUpdateTimelineStatus(timelineItemId: string, status: string) {
  const response = await fetch("/api/project-timeline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "update-status",
      timelineItemId,
      status,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    alert(data.error || "Could not update timeline status.");
    return;
  }

  await loadTimelineItems();
}

async function handleImportContractors(file: File | null) {
  if (!file) return;

  if (!project?.organisations?.id) {
    alert("Project client is required before importing contractors.");
    return;
  }

  setImportingContractors(true);

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  let importedCount = 0;

  for (const row of rows) {
   const contractorName = String(
  row["Supplier / Contractor Name"] ||
    row["contractor_name"] ||
    row["Contractor"] ||
    row["Subcontractor / Company"] ||
    ""
).trim();

    if (!contractorName) continue;

    const response = await fetch("/api/contractors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organisationId: project.organisations.id,
        projectId,
        contractorName,
tradeCategory: String(row["Used For"] || row["Trade"] || row["Services / Scope"] || "").trim(),
contactPerson: String(row["Contact Person"] || row["Person"] || "").trim(),
email: String(row["Email"] || "").trim(),
phone: String(row["Phone"] || "").trim(),
address: String(row["Address"] || "").trim(),
bankDetails: String(row["Bank Details"] || row["Bank details"] || "").trim(),
vatNumber: String(row["VAT Number"] || row["Vat Number"] || "").trim(),
paymentTerms: String(row["Payment Terms"] || row["Payment terms"] || "").trim(),
      }),
    });

      if (response.ok) {
  importedCount += 1;
}
  }



  setImportingContractors(false);
  await loadContractors(project.organisations.id);
  alert(`${importedCount} contractors imported.`);
}

async function handleAddContractor() {
  if (!project?.organisations?.id) {
    alert("Project client is required before adding contractors.");
    return;
  }

  if (!newContractorName.trim()) {
    alert("Contractor name is required.");
    return;
  }

  setSavingContractor(true);

  const response = await fetch("/api/contractors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organisationId: project.organisations?.id,
      projectId,
      contractorName: newContractorName,
      tradeCategory: newContractorTrade,
      contactPerson: newContractorContact,
      email: newContractorEmail,
      phone: newContractorPhone,
      address: newContractorAddress,
bankDetails: newContractorBankDetails,
vatNumber: newContractorVatNumber,
paymentTerms: newContractorPaymentTerms,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Could not add contractor.");
    setSavingContractor(false);
    return;
  }

  setNewContractorName("");
  setNewContractorTrade("");
  setNewContractorContact("");
  setNewContractorEmail("");
  setNewContractorPhone("");
  setNewContractorPhone("");
setNewContractorAddress("");
setNewContractorBankDetails("");
setNewContractorVatNumber("");
setNewContractorPaymentTerms("");
setSavingContractor(false);

  await loadContractors(project.organisations?.id);
}
  async function loadLineItems() {
    if (!projectId) return;

    setLoadingLineItems(true);

    const response = await fetch(`/api/projects/${projectId}/line-items`);
    const data = await response.json();

    if (response.ok) {
      setLineItems((data.lineItems || []).map((item: ApiLineItem) => mapApiLineItem(item)));
    } else {
      alert(data.error || "Could not load line items.");
    }

    setLoadingLineItems(false);
  }
async function handleUploadQuoteFile(lineItemId: string, file: File | null) {
  if (!file) return;

  setUploadingQuoteLineItemId(lineItemId);

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${projectId}/${lineItemId}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("quote-files")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    alert(uploadError.message);
    setUploadingQuoteLineItemId(null);
    return;
  }

  const updateResponse = await fetch(`/api/projects/${projectId}/line-items`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    lineItemId,
    quoteFilePath: filePath,
    quoteFileName: file.name,
  }),
});

const updateResult = await updateResponse.json();

if (!updateResponse.ok) {
  alert(updateResult.error || "Could not save quote file to line item.");
  setUploadingQuoteLineItemId(null);
  return;
}

  setUploadingQuoteLineItemId(null);
  await loadLineItems();
}

async function handleOpenQuoteFile(filePath: string | null) {
  if (!filePath) return;

  const { data, error } = await supabase.storage
    .from("quote-files")
    .createSignedUrl(filePath, 60);

  if (error || !data?.signedUrl) {
    alert(error?.message || "Could not open quote file.");
    return;
  }

  window.open(data.signedUrl, "_blank");
}

async function handleDeleteQuoteFile(quoteFileId: string, filePath: string) {
  const confirmed = window.confirm("Delete this quote file?");
  if (!confirmed) return;

  const response = await fetch(`/api/projects/${projectId}/line-items`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "delete-quote-file",
      quoteFileId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Could not delete quote file.");
    return;
  }

  await supabase.storage.from("quote-files").remove([filePath]);
  await loadLineItems();
}
  async function loadTimelineItems() {
  if (!projectId) return;

  setLoadingTimelineItems(true);

  const response = await fetch("/api/project-timeline", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action: "list",
    projectId,
  }),
});
  const text = await response.text();
const data = text ? JSON.parse(text) : {};

  if (response.ok) {
    setTimelineItems(data.timelineItems || []);
  } else {
    alert(data.error || text || `Could not load timeline items. Status: ${response.status}`);
  }

  setLoadingTimelineItems(false);
}
async function handleUpdateContractor() {
  if (!editingContractorId) return;

  if (!newContractorName.trim()) {
    alert("Contractor name is required.");
    return;
  }

  setSavingEditedContractor(true);

  const response = await fetch("/api/contractors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "update",
      contractorId: editingContractorId,
      contractorName: newContractorName,
      tradeCategory: newContractorTrade,
contactPerson: newContractorContact,
email: newContractorEmail,
phone: newContractorPhone,
address: newContractorAddress,
bankDetails: newContractorBankDetails,
vatNumber: newContractorVatNumber,
paymentTerms: newContractorPaymentTerms,
    }),
  });

  const text = await response.text();
const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
  alert(data.error || text || `Could not update contractor. Status: ${response.status}`);
  setSavingEditedContractor(false);
  return;
}

  setEditingContractorId(null);
  setNewContractorName("");
  setNewContractorTrade("");
  setNewContractorContact("");
  setNewContractorEmail("");
  setNewContractorPhone("");
  setNewContractorAddress("");
  setNewContractorBankDetails("");
  setNewContractorVatNumber("");
  setNewContractorPaymentTerms("");
  setSavingEditedContractor(false);

  await loadContractors(project?.organisations?.id || null);
}

async function handleDeleteContractor(contractorId: string) {
  const confirmed = window.confirm("Are you sure you want to delete this contractor?");

  if (!confirmed) return;

  const response = await fetch("/api/contractors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "delete",
      contractorId,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    alert(data.error || "Could not delete contractor.");
    return;
  }

  await loadContractors(project?.organisations?.id || null);
}

  async function loadInvoices() {
    if (!projectId) return;

    setLoadingInvoices(true);

    const response = await fetch(`/api/projects/${projectId}/invoices`);
    const data = await response.json();

    if (response.ok) {
      setInvoices(data.invoices || []);
    } else {
      alert(data.error || "Could not load invoices.");
    }

    setLoadingInvoices(false);
  }

  async function loadSupplierPayments() {
    if (!projectId) return;

    setLoadingSupplierPayments(true);

    const response = await fetch(`/api/projects/${projectId}/supplier-payments`);
    const data = await response.json();

    if (response.ok) {
      setSupplierPayments(data.supplierPayments || []);
    } else {
      alert(data.error || "Could not load supplier payments.");
    }

    setLoadingSupplierPayments(false);
  }

  function updatePhasePercentage(index: number, value: string) {
    setPhasePercentages((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }

  function resetForm() {
    if (!project) return;

    setDescription("");
    setAmount("");
    setVatMode("Exclusive");
    setContractorId("");
    setPhasePercentages(Array.from({ length: project.number_of_phases }, () => ""));
    setEditingLineItemId(null);
  }

  function handleEditContractor(contractor: Contractor) {
  setEditingContractorId(contractor.id);
  setNewContractorName(contractor.contractor_name || "");
  setNewContractorTrade(contractor.trade_category || "");
  setNewContractorContact(contractor.contact_person || "");
  setNewContractorEmail(contractor.email || "");
  setNewContractorPhone(contractor.phone || "");
  setNewContractorAddress(contractor.address || "");
  setNewContractorBankDetails(contractor.bank_details || "");
  setNewContractorVatNumber(contractor.vat_number || "");
  setNewContractorPaymentTerms(contractor.payment_terms || "");
}

  function handleEditLineItem(lineItem: LineItem) {
    if (!project) return;

    setEditingLineItemId(lineItem.id);
    setDescription(lineItem.description);
    setAmount(String(lineItem.amount));
    setVatMode(lineItem.vatMode);
    setContractorId(lineItem.contractorId || "");

    const percentages = Array.from({ length: project.number_of_phases }, (_, index) => {
      const phaseNumber = index + 1;
      return String(getPhasePercentage(lineItem, phaseNumber));
    });

    setPhasePercentages(percentages);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteLineItem(lineItemId: string) {
    const confirmed = confirm("Are you sure you want to delete this line item?");
    if (!confirmed) return;

    const response = await fetch(`/api/projects/${projectId}/line-items`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lineItemId }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not delete line item.");
      return;
    }

    await loadLineItems();

    if (editingLineItemId === lineItemId) {
      resetForm();
    }
  }

  async function handleDeleteAllLineItems() {
  const confirmed = window.confirm(
    "Are you sure you want to delete all line items for this project?"
  );

  if (!confirmed) return;

  const response = await fetch(`/api/projects/${projectId}/line-items`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "delete-all",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Could not delete all line items.");
    return;
  }

  await loadLineItems();
  alert("All line items deleted.");
}

  async function handleImportLineItems(file: File | null) {
  if (!file || !projectId || !project) return;

  setImportingLineItems(true);

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  let importedCount = 0;
  let firstError = "";

  for (const row of rows) {
    const importDescription = String(
      row["Description"] ||
        row["Item"] ||
        row["Scope"] ||
        row["Task"] ||
        row["Line Item"] ||
        ""
    ).trim();

    const importAmount = Number(
      row["Amount"] ||
        row["Quote Value"] ||
        row["Value"] ||
        row["Total"] ||
        0
    );

    if (!importDescription || importAmount <= 0) continue;

    const importVatMode = String(row["VAT Mode"] || row["Vat Mode"] || row["VAT"] || "Exclusive")
      .trim()
      .toLowerCase()
      .includes("incl")
      ? "Inclusive"
      : "Exclusive";

      
function cleanPercentage(value: any) {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value).replace("%", "").trim();
  let numberValue = Number(cleaned);

  if (Number.isNaN(numberValue)) return 0;

  if (numberValue > 0 && numberValue <= 1) {
    numberValue = numberValue * 100;
  }

  return numberValue;
}

const importPhasePercentages = phaseNumbers.map((phaseNumber) =>
  cleanPercentage(
    row[`Phase ${phaseNumber}%`] ||
      row[`Phase ${phaseNumber} %`] ||
      row[`Phase ${phaseNumber}`] ||
      row[`Phase${phaseNumber}`] ||
      0
  )
);

    const response = await fetch(`/api/projects/${projectId}/line-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: importDescription,
        amount: importAmount,
        vatMode: importVatMode,
        contractorId: null,
        phases: importPhasePercentages.map((value, index) => ({
          phaseNumber: index + 1,
          percentage: Number(value || 0),
        })),
      }),
    });

   if (response.ok) {
  importedCount += 1;
} else if (!firstError) {
  const errorText = await response.text();
  firstError = errorText;
}
  }

  setImportingLineItems(false);
  await loadLineItems();
  alert(
  firstError
    ? `${importedCount} line items imported. First error: ${firstError}`
    : `${importedCount} line items imported.`
);
}

  async function handleSaveLineItem() {
    if (!project) return;
    if (!description.trim()) return;
    if (!amount || Number(amount) <= 0) return;

    const totalPercentage = phasePercentages.reduce(
      (total, value) => total + Number(value || 0),
      0
    );

    if (totalPercentage !== 100) {
      alert("Phase percentages must add up to 100%.");
      return;
    }

    setSaving(true);

    const phases = phasePercentages.map((value, index) => ({
      phaseNumber: index + 1,
      percentage: Number(value || 0),
    }));

    const response = await fetch(`/api/projects/${projectId}/line-items`, {
      method: editingLineItemId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lineItemId: editingLineItemId,
        description: description.trim(),
        amount: Number(amount),
        vatMode,
        phases,
        contractorId: contractorId || null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not save line item.");
      setSaving(false);
      return;
    }

    resetForm();
    setSaving(false);
    await loadLineItems();
  }

 function getExpectedPhaseAmount(phaseNumber: number) {
  return lineItems.reduce((total, item) => {
    const phase = item.phases.find((phase) => phase.phaseNumber === phaseNumber);
    const percentage = getPhasePercentage(item, phaseNumber);

    return total + (phase?.overrideAmount ?? calculatePhaseAmount(item, percentage));
  }, 0);
}

function getPhaseBillingLineTotal(lineItem: LineItem) {
  return phaseNumbers.reduce((total, phaseNumber) => {
    const phase = lineItem.phases.find((phase) => phase.phaseNumber === phaseNumber);
    const percentage = getPhasePercentage(lineItem, phaseNumber);

    return total + (phase?.overrideAmount ?? calculatePhaseAmount(lineItem, percentage));
  }, 0);
}

function getPhaseBillingLineDifference(lineItem: LineItem) {
  return calculateTotal(lineItem) - getPhaseBillingLineTotal(lineItem);
}

function getPhaseBillingLineDifferencePercentage(lineItem: LineItem) {
  const total = calculateTotal(lineItem);
  const difference = getPhaseBillingLineDifference(lineItem);

  if (!total) return 0;

  return (difference / total) * 100;
}

function getManualSplitRemainingDifference(lineItem: LineItem) {
  const enteredAdjustment = Object.values(manualSplitValues).reduce((total, value) => {
    const rawValue = Number(value || 0);

    const adjustmentAmount =
      manualSplitMode === "percentage"
        ? calculateTotal(lineItem) * (rawValue / 100)
        : rawValue;

    return total + adjustmentAmount;
  }, 0);

  const remaining = getPhaseBillingLineDifference(lineItem) - enteredAdjustment;

return Math.abs(remaining) < 0.01 ? 0 : remaining;
}

function getManualSplitRemainingDifferencePercentage(lineItem: LineItem) {
  const total = calculateTotal(lineItem);
  const remainingDifference = getManualSplitRemainingDifference(lineItem);

  if (!total) return 0;

  return (remainingDifference / total) * 100;
}

async function handleSplitPhaseDifferenceEvenly(lineItem: LineItem) {
  setEvenSplitLineItem(lineItem);
}

async function handleApplyEvenSplit() {
  if (!evenSplitLineItem) return;

  const difference = getPhaseBillingLineDifference(evenSplitLineItem);

  if (Math.abs(difference) < 0.01) {
    setEvenSplitLineItem(null);
    return;
  }

  const availablePhases = evenSplitLineItem.phases.filter(
    (phase) => phase.id && phase.overrideType !== "manual"
  );

  if (availablePhases.length === 0) {
    alert("No available phases to adjust.");
    setEvenSplitLineItem(null);
    return;
  }

  const adjustmentPerPhase = difference / availablePhases.length;

  for (const phase of availablePhases) {
    const currentAmount = phase.overrideAmount ?? phase.calculatedAmount ?? 0;
    const newOverrideAmount = currentAmount + adjustmentPerPhase;

    await handleSavePhaseOverride(phase.id, String(newOverrideAmount), "split");
  }

  setEvenSplitLineItem(null);
  await loadLineItems();
}

async function handleSplitPhaseDifferenceManually(lineItem: LineItem) {
  setManualSplitLineItem(lineItem);
  setManualSplitValues({});
  setManualSplitMode("amount");
}

async function handleApplyManualSplit() {
  if (!manualSplitLineItem) return;

  for (const [phaseNumberText, value] of Object.entries(manualSplitValues)) {
    if (!value.trim()) continue;

    const phaseNumber = Number(phaseNumberText);
    const rawValue = Number(value);

const adjustmentAmount =
  manualSplitMode === "percentage"
    ? calculateTotal(manualSplitLineItem) * (rawValue / 100)
    : rawValue;

    if (Number.isNaN(adjustmentAmount)) continue;

    const phase = manualSplitLineItem.phases.find(
      (item) => item.phaseNumber === phaseNumber
    );

    if (!phase?.id) continue;

    const currentAmount = phase.overrideAmount ?? phase.calculatedAmount ?? 0;
    const newOverrideAmount = currentAmount + adjustmentAmount;

    await handleSavePhaseOverride(phase.id, String(newOverrideAmount), "split")
  }

  setManualSplitLineItem(null);
  setManualSplitValues({});
  await loadLineItems();
}

async function handleOpenPhaseOverride(lineItem: LineItem) {
  const values: Record<number, string> = {};

  phaseNumbers.forEach((phaseNumber) => {
    const phase = lineItem.phases.find((item) => item.phaseNumber === phaseNumber);
    const amount = phase?.overrideAmount ?? phase?.calculatedAmount ?? 0;

    values[phaseNumber] = String(amount);
  });

  setPhaseOverrideLineItem(lineItem);
  setPhaseOverrideValues(values);
}

async function handleApplyPhaseOverride() {
  if (!phaseOverrideLineItem) return;

  for (const [phaseNumberText, value] of Object.entries(phaseOverrideValues)) {
    const phaseNumber = Number(phaseNumberText);

    const phase = phaseOverrideLineItem.phases.find(
      (item) => item.phaseNumber === phaseNumber
    );

    if (!phase?.id) continue;

    const enteredAmount = Number(value);
    const originalAmount = phase.calculatedAmount ?? 0;

    if (value.trim() === "" || Math.abs(enteredAmount - originalAmount) < 0.01) {
      await handleSavePhaseOverride(phase.id, "", "manual");
    } else {
      await handleSavePhaseOverride(phase.id, String(enteredAmount), "manual");
    }
  }

  setPhaseOverrideLineItem(null);
  setPhaseOverrideValues({});
  await loadLineItems();
}

  function getInvoiceForPhase(phaseNumber: number) {
    return invoices.find((invoice) => invoice.phase_number === phaseNumber);
  }

  function getClientIncomeExcludingVat() {
    const value = Number(clientIncomeTotal || 0);

    if (clientIncomeVatMode === "Inclusive") {
      return value / 1.15;
    }

    return value;
  }

  function getClientIncomeVat() {
    const value = Number(clientIncomeTotal || 0);

    if (clientIncomeVatMode === "No VAT") return 0;

    if (clientIncomeVatMode === "Inclusive") {
      return value - value / 1.15;
    }

    return value * 0.15;
  }

  function getClientIncomeIncludingVat() {
    const value = Number(clientIncomeTotal || 0);

    if (clientIncomeVatMode === "Exclusive") {
      return value * 1.15;
    }

    return value;
  }

  function getClientPaymentPercentage(paymentNumber: number) {
    return Number(clientPaymentPercentages[paymentNumber - 1] || 0);
  }

  function getExpectedClientPaymentAmount(paymentNumber: number) {
    const storedAmount = Number(clientPaymentAmounts[paymentNumber - 1] || 0);

    if (storedAmount && !Number.isNaN(storedAmount)) {
      return storedAmount;
    }

    return getClientIncomeIncludingVat() * (getClientPaymentPercentage(paymentNumber) / 100);
  }

  function getClientPaymentTotalPercentage() {
    return clientPaymentPercentages.reduce((total, value) => total + Number(value || 0), 0);
  }

  function getClientPaymentTotalAmount() {
    return clientPaymentAmounts.reduce((total, value) => total + Number(value || 0), 0);
  }

  function getClientPaymentAmountDifference() {
    return getClientIncomeIncludingVat() - getClientPaymentTotalAmount();
  }

  function updateClientPaymentAmount(index: number, value: string) {
    const totalIncome = getClientIncomeIncludingVat();
    const enteredAmount = Number(value || 0);

    setClientPaymentAmounts((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });

    setClientPaymentPercentages((prev) => {
      const updated = [...prev];

      if (!totalIncome || totalIncome <= 0 || Number.isNaN(enteredAmount)) {
        updated[index] = "";
        return updated;
      }

      const calculatedPercentage = (enteredAmount / totalIncome) * 100;
      updated[index] = String(Number(calculatedPercentage.toFixed(6)));
      return updated;
    });
  }

  function getClientPaymentAmountInput(paymentNumber: number) {
    return clientPaymentAmounts[paymentNumber - 1] || "";
  }

  function updateClientPaymentCount(value: string) {
    const safeCount = Math.max(1, Math.min(12, Number(value || 1)));
    setClientPaymentCount(String(safeCount));

    const evenPercentage = Number((100 / safeCount).toFixed(2));
    const percentages = Array.from({ length: safeCount }, () => String(evenPercentage));
    const runningTotal = percentages.reduce((total, entry) => total + Number(entry || 0), 0);
    percentages[safeCount - 1] = String(
      Number((Number(percentages[safeCount - 1] || 0) + (100 - runningTotal)).toFixed(2))
    );

    setClientPaymentPercentages(percentages);
    setClientPaymentAmounts(
      calculateClientPaymentAmountsFromPercentages(percentages, clientIncomeTotal, clientIncomeVatMode)
    );
  }

  function updateClientPaymentPercentage(index: number, value: string) {
    const totalIncome = getClientIncomeIncludingVat();
    const enteredPercentage = Number(value || 0);

    setClientPaymentPercentages((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });

    setClientPaymentAmounts((prev) => {
      const updated = [...prev];

      if (!totalIncome || totalIncome <= 0 || Number.isNaN(enteredPercentage)) {
        updated[index] = "";
        return updated;
      }

      updated[index] = (totalIncome * (enteredPercentage / 100)).toFixed(2);
      return updated;
    });
  }

async function handleSavePhaseOverride(
  phaseSplitId: string | undefined,
  overrideAmount: string,
  overrideType: "manual" | "split" = "manual"
) {
  if (!phaseSplitId) {
    alert("Phase split ID is missing.");
    return;
  }

  const response = await fetch(`/api/projects/${projectId}/line-items`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
 body: JSON.stringify({
  phaseSplitId,
  overrideAmount: overrideAmount === "" ? null : Number(overrideAmount),
  overrideType,
}),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Could not save override amount.");
    return;
  }

  await loadLineItems();
}


async function handleInlinePhasePercentageSave(
  lineItem: LineItem,
  phaseNumber: number,
  value: string
) {
  const phase = lineItem.phases.find((phaseItem) => phaseItem.phaseNumber === phaseNumber);
  const enteredPercentage = Number(value);

  if (!phase?.id || Number.isNaN(enteredPercentage) || enteredPercentage < 0) return;

  const originalAmount = phase.calculatedAmount ?? calculatePhaseAmount(lineItem, getPhasePercentage(lineItem, phaseNumber));
  const newAmount = calculateTotal(lineItem) * (enteredPercentage / 100);
  const overrideValue = Math.abs(newAmount - originalAmount) < 0.01 ? "" : String(newAmount);

  await handleSavePhaseOverride(phase.id, overrideValue, "manual");
}

async function handleInlinePhaseAmountSave(
  lineItem: LineItem,
  phaseNumber: number,
  value: string
) {
  const phase = lineItem.phases.find((phaseItem) => phaseItem.phaseNumber === phaseNumber);
  const enteredAmount = Number(value);

  if (!phase?.id || Number.isNaN(enteredAmount) || enteredAmount < 0) return;

  const originalAmount = phase.calculatedAmount ?? calculatePhaseAmount(lineItem, getPhasePercentage(lineItem, phaseNumber));
  const overrideValue = Math.abs(enteredAmount - originalAmount) < 0.01 ? "" : String(enteredAmount);

  await handleSavePhaseOverride(phase.id, overrideValue, "manual");
}


  async function handleSaveClientIncome() {
    if (!projectId) return;

    const total = Number(clientIncomeTotal || 0);
    const paymentCount = Number(clientPaymentCount || 0);
    const totalPercentage = getClientPaymentTotalPercentage();

    if (!total || total <= 0) {
      alert("Client income total is required.");
      return;
    }

    if (!paymentCount || paymentCount <= 0) {
      alert("Payment count is required.");
      return;
    }

    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert("Client payment percentages must add up to 100%.");
      return;
    }

    setSavingClientIncome(true);

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientIncomeTotal: total,
        clientIncomeVatMode,
        clientPaymentCount: paymentCount,
        clientPaymentPercentages: clientPaymentPercentages.map((value) => Number(value || 0)),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not save client income.");
      setSavingClientIncome(false);
      return;
    }

    setProject(data.project);
    setSavingClientIncome(false);
  }

  async function handleSaveCurrentSupplierPhase() {
    if (!projectId) return;

    const phaseValue = Number(currentSupplierPhase || 0);

    if (!phaseValue || phaseValue <= 0) {
      alert("Current supplier phase is required.");
      return;
    }

    setSavingCurrentSupplierPhase(true);

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentSupplierPhase: phaseValue,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not save current supplier phase.");
      setSavingCurrentSupplierPhase(false);
      return;
    }

    setProject(data.project);
    setCurrentSupplierPhase(String(data.project?.current_supplier_phase || phaseValue));
    setSavingCurrentSupplierPhase(false);
  }

  function getCurrentSupplierPhaseNumber() {
    const value = Number(currentSupplierPhase || project?.current_supplier_phase || 1);
    if (!value || value <= 0) return 1;
    return value;
  }

  function getSupplierPaymentKey(lineItemId: string, phaseNumber: number) {
    return `${lineItemId}-${phaseNumber}`;
  }

  function getExpectedSupplierPaymentForLineItem(lineItem: LineItem, phaseNumber: number) {
    const phase = lineItem.phases.find((item) => item.phaseNumber === phaseNumber);

    if (!phase) return 0;

    return phase.overrideAmount ?? calculatePhaseAmount(lineItem, getPhasePercentage(lineItem, phaseNumber));
  }

  function getSupplierPaymentsForLineItemPhase(lineItemId: string, phaseNumber: number) {
    return supplierPayments.filter(
      (payment) =>
        payment.line_item_id === lineItemId && payment.supplier_phase_number === phaseNumber
    );
  }

  function getSupplierPaidForLineItemPhase(lineItemId: string, phaseNumber: number) {
    return getSupplierPaymentsForLineItemPhase(lineItemId, phaseNumber).reduce(
      (total, payment) => total + Number(payment.paid_amount || 0),
      0
    );
  }

  function getSupplierPaidForPhase(phaseNumber: number) {
    return supplierPayments
      .filter((payment) => payment.supplier_phase_number === phaseNumber)
      .reduce((total, payment) => total + Number(payment.paid_amount || 0), 0);
  }

  function getSupplierExpectedForPhase(phaseNumber: number) {
    return lineItems.reduce((total, item) => total + getPhaseDisplayAmount(item, phaseNumber), 0);
  }

  function getSupplierPaymentStatusSymbol(status: string, expectedAmount = 0) {
    if (status === "Paid") return "✓";
    if (status === "Part paid") return "◐";
    if (status === "Overpaid") return "!";
    if (expectedAmount > 0) return "○";
    return "";
  }

  function getSupplierPaymentStatusSymbolStyle(status: string) {
    if (status === "Paid") return styles.phaseTickPaid;
    if (status === "Part paid") return styles.phaseTickPart;
    if (status === "Overpaid") return styles.phaseTickOver;
    return styles.phaseTickUnpaid;
  }

  function getPhasePaymentListRows() {
    const selectedPhase = phasePaymentListPhase === "all" ? null : Number(phasePaymentListPhase || 1);

    return lineItems
      .flatMap((item) => {
        const phasesToUse = selectedPhase === null ? phaseNumbers : [selectedPhase];
        const contractor = contractors.find((contractorItem) => contractorItem.id === item.contractorId);

        return phasesToUse.map((phaseNumber) => {
          const expectedAmount = getPhaseDisplayAmount(item, phaseNumber);
          const paidAmount = getSupplierPaidForLineItemPhase(item.id, phaseNumber);
          const balance = expectedAmount - paidAmount;
          const status = getSupplierPaymentStatus(expectedAmount, paidAmount);

          return {
            item,
            contractor,
            phaseNumber,
            expectedAmount,
            paidAmount,
            balance,
            status,
          };
        });
      })
      .filter((row) => row.expectedAmount > 0 || row.paidAmount > 0)
      .filter((row) => {
        if (phasePaymentListContractorFilter === "__unlinked" && row.item.contractorId) return false;
        if (phasePaymentListContractorFilter && phasePaymentListContractorFilter !== "__unlinked" && row.item.contractorId !== phasePaymentListContractorFilter) return false;

        if (phasePaymentListLineFilter && row.item.id !== phasePaymentListLineFilter) return false;

        return true;
      })
      .sort((a, b) => a.phaseNumber - b.phaseNumber || a.item.description.localeCompare(b.item.description));
  }

  function getSupplierPaidTotal() {
    return supplierPayments.reduce((total, payment) => total + Number(payment.paid_amount || 0), 0);
  }

  function getClientPaidTotal() {
    return invoices.reduce((total, invoice) => {
      const payment = invoice.project_payments?.[0];
      return total + Number(payment?.paid_amount || 0);
    }, 0);
  }

  function getSupplierPaymentStatus(expectedAmount: number, paidAmount: number) {
    if (expectedAmount <= 0 && paidAmount <= 0) return "N/A";
    if (paidAmount <= 0) return "Not paid";
    if (paidAmount + 0.01 < expectedAmount) return "Part paid";
    if (Math.abs(paidAmount - expectedAmount) < 0.01) return "Paid";
    return "Overpaid";
  }

  function getStatusStyle(status: string) {
    if (status === "Paid" || status === "Matched") return { ...styles.statusPill, ...styles.statusMatched };
    if (status === "Part paid" || status === "Difference") return { ...styles.statusPill, ...styles.statusDifference };
    if (status === "Overpaid") return { ...styles.statusPill, ...styles.statusOverpaid };
    return { ...styles.statusPill, ...styles.statusNotInvoiced };
  }

  async function handleUploadSupplierPop(lineItem: LineItem, phase: PhaseSplit, file: File | null) {
    if (!file) return;

    const phaseNumber = phase.phaseNumber;
    const key = getSupplierPaymentKey(lineItem.id, phaseNumber);
    const paidAmount = Number(supplierPaidAmounts[key] || 0);

    if (!paidAmount || paidAmount <= 0) {
      alert("Capture the paid amount before uploading the POP.");
      return;
    }

    setUploadingPopKey(key);

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `supplier-pops/${projectId}/${lineItem.id}/phase-${phaseNumber}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("quote-files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      alert(uploadError.message);
      setUploadingPopKey(null);
      return;
    }

    await handleSaveSupplierPayment(lineItem, phase, filePath, file.name);
    setUploadingPopKey(null);
  }

  async function handleOpenSupplierPop(filePath: string | null) {
    if (!filePath) return;

    const { data, error } = await supabase.storage
      .from("quote-files")
      .createSignedUrl(filePath, 60);

    if (error || !data?.signedUrl) {
      alert(error?.message || "Could not open POP.");
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function handleSaveSupplierPayment(
    lineItem: LineItem,
    phase: PhaseSplit,
    popFilePath?: string | null,
    popFileName?: string | null
  ) {
    const phaseNumber = phase.phaseNumber;
    const key = getSupplierPaymentKey(lineItem.id, phaseNumber);
    const paidAmount = Number(supplierPaidAmounts[key] || 0);

    if (!paidAmount || paidAmount <= 0) {
      alert("Paid amount is required.");
      return;
    }

    setSavingSupplierPaymentKey(key);

    const response = await fetch(`/api/projects/${projectId}/supplier-payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lineItemId: lineItem.id,
        phaseSplitId: phase.id || null,
        contractorId: lineItem.contractorId || null,
        supplierPhaseNumber: phaseNumber,
        paidAmount,
        paymentDate: supplierPaymentDates[key] || "",
        notes: supplierPaymentNotes[key] || "",
        popFilePath: popFilePath || null,
        popFileName: popFileName || null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not save supplier payment.");
      setSavingSupplierPaymentKey(null);
      return;
    }

    setSupplierPaidAmounts((prev) => ({ ...prev, [key]: "" }));
    setSupplierPaymentDates((prev) => ({ ...prev, [key]: "" }));
    setSupplierPaymentNotes((prev) => ({ ...prev, [key]: "" }));
    setSavingSupplierPaymentKey(null);
    await loadSupplierPayments();
  }

  async function handleDeleteSupplierPayment(supplierPaymentId: string) {
    const confirmed = window.confirm("Delete this supplier payment record?");
    if (!confirmed) return;

    const response = await fetch(`/api/projects/${projectId}/supplier-payments`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ supplierPaymentId }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not delete supplier payment.");
      return;
    }

    await loadSupplierPayments();
  }

  async function handleSaveInvoice(phaseNumber: number) {
    const expectedAmount = getExpectedClientPaymentAmount(phaseNumber);

    setSavingInvoicePhase(phaseNumber);

    const response = await fetch(`/api/projects/${projectId}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phaseNumber,
        invoiceNumber: invoiceNumbers[phaseNumber] || "",
        invoiceDate: invoiceDates[phaseNumber] || "",
        expectedAmount,
        invoicedAmount: invoiceAmounts[phaseNumber] || "",
        paidAmount: paidAmounts[phaseNumber] || "",
        paymentDate: paymentDates[phaseNumber] || "",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not save invoice.");
      setSavingInvoicePhase(null);
      return;
    }

    setSavingInvoicePhase(null);
    await loadInvoices();
  }


  function escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function getAllSupplierPaymentReportRows() {
    return lineItems
      .flatMap((item) => {
        const contractor = contractors.find((contractorItem) => contractorItem.id === item.contractorId);
        return phaseNumbers.map((phaseNumber) => {
          const expectedAmount = getExpectedSupplierPaymentForLineItem(item, phaseNumber);
          const paidAmount = getSupplierPaidForLineItemPhase(item.id, phaseNumber);
          const balance = expectedAmount - paidAmount;
          const status = getSupplierPaymentStatus(expectedAmount, paidAmount);
          const payments = supplierPayments.filter(
            (payment) => payment.line_item_id === item.id && payment.supplier_phase_number === phaseNumber
          );

          return {
            item,
            contractor,
            phaseNumber,
            expectedAmount,
            paidAmount,
            balance,
            status,
            popCount: payments.filter((payment) => payment.pop_file_path).length,
            popNames: payments
              .filter((payment) => payment.pop_file_name)
              .map((payment) => payment.pop_file_name as string)
              .join(", "),
          };
        });
      })
      .filter((row) => row.expectedAmount > 0 || row.paidAmount > 0);
  }

  function printSupplierPaymentsReport() {
    const rows = getAllSupplierPaymentReportRows();
    const expectedTotal = rows.reduce((total, row) => total + row.expectedAmount, 0);
    const paidTotal = rows.reduce((total, row) => total + row.paidAmount, 0);
    const outstandingTotal = expectedTotal - paidTotal;
    const reportTitle = "Supplier Payments & POPs";

    const printWindow = window.open("", "_blank", "width=1400,height=900");

    if (!printWindow) {
      alert("Could not open print window.");
      return;
    }

    const rowHtml = rows
      .map((row) => `
          <tr>
            <td>${escapeHtml(row.item.description)}</td>
            <td>${escapeHtml(row.contractor?.contractor_name || "-")}</td>
            <td style="text-align:center;">Phase ${row.phaseNumber}</td>
            <td style="text-align:right;">${formatCurrency(row.expectedAmount)}</td>
            <td style="text-align:right;">${formatCurrency(row.paidAmount)}</td>
            <td style="text-align:right;">${formatCurrency(row.balance)}</td>
            <td style="text-align:center;">${escapeHtml(getSupplierPaymentStatusSymbol(row.status, row.expectedAmount) || "-")}</td>
            <td style="text-align:center;">${row.popCount}</td>
            <td>${escapeHtml(row.popNames || "-")}</td>
          </tr>
        `)
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(project?.name || "Project")} - ${escapeHtml(reportTitle)}</title>
          ${getPrintStyles()}
        </head>
        <body>
          <div class="print-header">
            <h1>${escapeHtml(project?.name || "Project")}</h1>
            <p>Client: ${escapeHtml(project?.organisations?.name || "Not linked")}</p>
            <p>${escapeHtml(reportTitle)}</p>
          </div>

          <table>
            <tbody>
              <tr>
                <td><strong>Supplier Budget</strong></td>
                <td style="text-align:right;">${formatCurrency(expectedTotal)}</td>
                <td><strong>Suppliers Paid</strong></td>
                <td style="text-align:right;">${formatCurrency(paidTotal)}</td>
                <td><strong>Outstanding</strong></td>
                <td style="text-align:right;">${formatCurrency(outstandingTotal)}</td>
              </tr>
            </tbody>
          </table>

          <table>
            <thead>
              <tr>
                <th>Supplier Line</th>
                <th>Supplier / Contractor</th>
                <th>Phase</th>
                <th style="text-align:right;">Expected</th>
                <th style="text-align:right;">Paid</th>
                <th style="text-align:right;">Balance</th>
                <th>Status</th>
                <th>POPs</th>
                <th>POP References</th>
              </tr>
            </thead>
            <tbody>
              ${rowHtml || `<tr><td colspan="9">No supplier payments found.</td></tr>`}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total</td>
                <td style="text-align:right;">${formatCurrency(expectedTotal)}</td>
                <td style="text-align:right;">${formatCurrency(paidTotal)}</td>
                <td style="text-align:right;">${formatCurrency(outstandingTotal)}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  async function exportSupplierPaymentsReportPdf() {
    const rows = getAllSupplierPaymentReportRows();
    const expectedTotal = rows.reduce((total, row) => total + row.expectedAmount, 0);
    const paidTotal = rows.reduce((total, row) => total + row.paidAmount, 0);
    const outstandingTotal = expectedTotal - paidTotal;

    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setTextColor(18, 48, 74);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(project?.name || "Project", 12, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Client: ${project?.organisations?.name || "Not linked"}`, 12, 20);
    doc.text("Supplier Payments & POPs", 12, 25);

    autoTable(doc, {
      startY: 32,
      head: [["Supplier Budget", "Suppliers Paid", "Outstanding"]],
      body: [[formatCurrency(expectedTotal), formatCurrency(paidTotal), formatCurrency(outstandingTotal)]],
      theme: "grid",
      styles: { fontSize: 8, textColor: [18, 48, 74], cellPadding: 2 },
      headStyles: { fillColor: [238, 243, 248], textColor: [18, 48, 74], fontStyle: "bold" },
      columnStyles: { 0: { halign: "right" }, 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Supplier Line", "Supplier / Contractor", "Phase", "Expected", "Paid", "Balance", "Status", "POPs", "POP References"]],
      body: rows.map((row) => [
        row.item.description,
        row.contractor?.contractor_name || "-",
        `Phase ${row.phaseNumber}`,
        formatCurrency(row.expectedAmount),
        formatCurrency(row.paidAmount),
        formatCurrency(row.balance),
        row.status,
        String(row.popCount),
        row.popNames || "-",
      ]),
      foot: [["Total", "", "", formatCurrency(expectedTotal), formatCurrency(paidTotal), formatCurrency(outstandingTotal), "", "", ""]],
      theme: "grid",
      styles: { fontSize: 7, textColor: [18, 48, 74], cellPadding: 2 },
      headStyles: { fillColor: [238, 243, 248], textColor: [18, 48, 74], fontStyle: "bold" },
      footStyles: { fillColor: [246, 248, 251], textColor: [18, 48, 74], fontStyle: "bold" },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 7: { halign: "center" } },
      margin: { left: 12, right: 12 },
    });

    doc.save(`${project?.name || "Project"} - Supplier Payments and POPs.pdf`);
  }


  function getCashflowControlRows() {
    return phaseNumbers.map((phaseNumber) => {
      const clientExpected = getExpectedClientPaymentAmount(phaseNumber);
      const invoice = getInvoiceForPhase(phaseNumber);
      const clientReceived = Number(invoice?.project_payments?.[0]?.paid_amount || 0);
      const supplierExpected = getExpectedPhaseAmount(phaseNumber);
      const supplierPaid = getSupplierPaidForPhase(phaseNumber);
      const supplierOutstanding = Math.max(0, supplierExpected - supplierPaid);

      return {
        phaseNumber,
        clientExpected,
        clientReceived,
        supplierExpected,
        supplierPaid,
        cashPosition: clientReceived - supplierPaid,
        supplierOutstanding,
      };
    });
  }

  function getSupplierExceptionRows() {
    const currentPhase = getCurrentSupplierPhaseNumber();

    return lineItems
      .flatMap((item) => {
        const contractor = contractors.find((contractorItem) => contractorItem.id === item.contractorId);

        return phaseNumbers.map((phaseNumber) => {
          const expectedAmount = getPhaseDisplayAmount(item, phaseNumber);
          const paidAmount = getSupplierPaidForLineItemPhase(item.id, phaseNumber);
          const balance = expectedAmount - paidAmount;
          const status = getSupplierPaymentStatus(expectedAmount, paidAmount);
          const isCurrentOrPastPhase = phaseNumber <= currentPhase;

          let issue = "";

          if (status === "Overpaid") {
            issue = "Supplier phase has been overpaid.";
          } else if (isCurrentOrPastPhase && status === "Not paid") {
            issue = "Supplier payment due for current/past phase and still unpaid.";
          } else if (isCurrentOrPastPhase && status === "Part paid") {
            issue = "Supplier payment due for current/past phase and only partly paid.";
          } else {
            issue = "";
          }

          return {
            item,
            contractor,
            phaseNumber,
            expectedAmount,
            paidAmount,
            balance,
            status,
            issue,
            isCurrentOrPastPhase,
          };
        });
      })
      .filter((row) => {
        if (row.expectedAmount <= 0) return false;
        if (row.status === "Overpaid") return true;
        return row.isCurrentOrPastPhase && row.status !== "Paid";
      })
      .sort((a, b) => a.phaseNumber - b.phaseNumber || a.item.description.localeCompare(b.item.description));
  }

  function getClientReceiptExceptionRows() {
    return clientPaymentNumbers
      .map((paymentNumber) => {
        const expectedAmount = getExpectedClientPaymentAmount(paymentNumber);
        const invoice = getInvoiceForPhase(paymentNumber);
        const receivedAmount = Number(invoice?.project_payments?.[0]?.paid_amount || 0);
        const outstanding = Math.max(0, expectedAmount - receivedAmount);
        const status = getSupplierPaymentStatus(expectedAmount, receivedAmount);
        const issue =
          status === "Not paid"
            ? "Client payment expected but no receipt captured yet."
            : status === "Part paid"
              ? "Client payment is only partly received."
              : status === "Overpaid"
                ? "Client receipt exceeds expected payment amount."
                : "Review required.";

        return {
          paymentNumber,
          expectedAmount,
          receivedAmount,
          outstanding,
          status,
          issue,
        };
      })
      .filter((row) => row.outstanding > 0 || row.status === "Overpaid");
  }

  function printCashflowControlReport() {
    const rows = getCashflowControlRows();
    const printWindow = window.open("", "_blank", "width=1400,height=900");

    if (!printWindow) {
      alert("Could not open print window.");
      return;
    }

    const rowHtml = rows
      .map((row) => `
        <tr>
          <td>Phase ${row.phaseNumber}</td>
          <td style="text-align:right;">${formatCurrency(row.clientExpected)}</td>
          <td style="text-align:right;">${formatCurrency(row.clientReceived)}</td>
          <td style="text-align:right;">${formatCurrency(row.supplierExpected)}</td>
          <td style="text-align:right;">${formatCurrency(row.supplierPaid)}</td>
          <td style="text-align:right;">${formatCurrency(row.cashPosition)}</td>
          <td style="text-align:right;">${formatCurrency(row.supplierOutstanding)}</td>
        </tr>
      `)
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(project?.name || "Project")} - Cashflow Control</title>
          ${getPrintStyles()}
        </head>
        <body>
          <div class="print-header">
            <h1>${escapeHtml(project?.name || "Project")}</h1>
            <p>Client: ${escapeHtml(project?.organisations?.name || "Not linked")}</p>
            <p>Cashflow Control</p>
          </div>

          <table>
            <tbody>
              <tr>
                <td><strong>Client Income</strong></td>
                <td style="text-align:right;">${formatCurrency(getClientIncomeIncludingVat())}</td>
                <td><strong>Client Received</strong></td>
                <td style="text-align:right;">${formatCurrency(getClientPaidTotal())}</td>
                <td><strong>Suppliers Paid</strong></td>
                <td style="text-align:right;">${formatCurrency(getSupplierPaidTotal())}</td>
              </tr>
              <tr>
                <td><strong>Current Cash Position</strong></td>
                <td style="text-align:right;">${formatCurrency(getClientPaidTotal() - getSupplierPaidTotal())}</td>
                <td><strong>Remaining Supplier Exposure</strong></td>
                <td style="text-align:right;">${formatCurrency(Math.max(0, totalIncludingVat - getSupplierPaidTotal()))}</td>
                <td><strong>Client Outstanding</strong></td>
                <td style="text-align:right;">${formatCurrency(Math.max(0, getClientIncomeIncludingVat() - getClientPaidTotal()))}</td>
              </tr>
            </tbody>
          </table>

          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th style="text-align:right;">Client Expected</th>
                <th style="text-align:right;">Client Received</th>
                <th style="text-align:right;">Supplier Expected</th>
                <th style="text-align:right;">Supplier Paid</th>
                <th style="text-align:right;">Cash Position</th>
                <th style="text-align:right;">Supplier Outstanding</th>
              </tr>
            </thead>
            <tbody>${rowHtml}</tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

  async function exportCashflowControlReportPdf() {
    const rows = getCashflowControlRows();
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setTextColor(18, 48, 74);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(project?.name || "Project", 12, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Client: ${project?.organisations?.name || "Not linked"}`, 12, 20);
    doc.text("Cashflow Control", 12, 25);

    autoTable(doc, {
      startY: 32,
      head: [["Client Income", "Client Received", "Suppliers Paid", "Current Cash", "Supplier Exposure", "Client Outstanding"]],
      body: [[
        formatCurrency(getClientIncomeIncludingVat()),
        formatCurrency(getClientPaidTotal()),
        formatCurrency(getSupplierPaidTotal()),
        formatCurrency(getClientPaidTotal() - getSupplierPaidTotal()),
        formatCurrency(Math.max(0, totalIncludingVat - getSupplierPaidTotal())),
        formatCurrency(Math.max(0, getClientIncomeIncludingVat() - getClientPaidTotal())),
      ]],
      theme: "grid",
      styles: { fontSize: 8, textColor: [18, 48, 74], cellPadding: 2 },
      headStyles: { fillColor: [238, 243, 248], textColor: [18, 48, 74], fontStyle: "bold" },
      margin: { left: 12, right: 12 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Phase", "Client Expected", "Client Received", "Supplier Expected", "Supplier Paid", "Cash Position", "Supplier Outstanding"]],
      body: rows.map((row) => [
        `Phase ${row.phaseNumber}`,
        formatCurrency(row.clientExpected),
        formatCurrency(row.clientReceived),
        formatCurrency(row.supplierExpected),
        formatCurrency(row.supplierPaid),
        formatCurrency(row.cashPosition),
        formatCurrency(row.supplierOutstanding),
      ]),
      theme: "grid",
      styles: { fontSize: 8, textColor: [18, 48, 74], cellPadding: 2 },
      headStyles: { fillColor: [238, 243, 248], textColor: [18, 48, 74], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });

    doc.save(`${project?.name || "Project"} - Cashflow Control.pdf`);
  }

  function printExceptionReport() {
    const supplierRows = getSupplierExceptionRows();
    const clientRows = getClientReceiptExceptionRows();
    const printWindow = window.open("", "_blank", "width=1400,height=900");

    if (!printWindow) {
      alert("Could not open print window.");
      return;
    }

    const supplierHtml = supplierRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.item.description)}</td>
        <td>${escapeHtml(row.contractor?.contractor_name || "-")}</td>
        <td>Phase ${row.phaseNumber}</td>
        <td style="text-align:right;">${formatCurrency(row.expectedAmount)}</td>
        <td style="text-align:right;">${formatCurrency(row.paidAmount)}</td>
        <td style="text-align:right;">${formatCurrency(row.balance)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.issue)}</td>
      </tr>
    `).join("");

    const clientHtml = clientRows.map((row) => `
      <tr>
        <td>Payment ${row.paymentNumber}</td>
        <td style="text-align:right;">${formatCurrency(row.expectedAmount)}</td>
        <td style="text-align:right;">${formatCurrency(row.receivedAmount)}</td>
        <td style="text-align:right;">${formatCurrency(row.outstanding)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.issue)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(project?.name || "Project")} - Exception Report</title>
          ${getPrintStyles()}
        </head>
        <body>
          <div class="print-header">
            <h1>${escapeHtml(project?.name || "Project")}</h1>
            <p>Client: ${escapeHtml(project?.organisations?.name || "Not linked")}</p>
            <p>Exception Report</p>
          </div>

          <h2>Supplier Exceptions</h2>
          <table>
            <thead>
              <tr>
                <th>Supplier Line</th><th>Supplier / Contractor</th><th>Phase</th><th>Expected</th><th>Paid</th><th>Balance</th><th>Status</th><th>Issue</th>
              </tr>
            </thead>
            <tbody>${supplierHtml || `<tr><td colspan="8">No supplier exceptions.</td></tr>`}</tbody>
          </table>

          <h2>Client Receipt Exceptions</h2>
          <table>
            <thead>
              <tr>
                <th>Payment</th><th>Expected</th><th>Received</th><th>Outstanding</th><th>Status</th><th>Issue</th>
              </tr>
            </thead>
            <tbody>${clientHtml || `<tr><td colspan="6">No client receipt exceptions.</td></tr>`}</tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

  async function exportExceptionReportPdf() {
    const supplierRows = getSupplierExceptionRows();
    const clientRows = getClientReceiptExceptionRows();
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setTextColor(18, 48, 74);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(project?.name || "Project", 12, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Client: ${project?.organisations?.name || "Not linked"}`, 12, 20);
    doc.text("Exception Report", 12, 25);

    autoTable(doc, {
      startY: 32,
      head: [["Supplier Line", "Supplier / Contractor", "Phase", "Expected", "Paid", "Balance", "Status", "Issue"]],
      body: supplierRows.map((row) => [row.item.description, row.contractor?.contractor_name || "-", `Phase ${row.phaseNumber}`, formatCurrency(row.expectedAmount), formatCurrency(row.paidAmount), formatCurrency(row.balance), row.status, row.issue]),
      theme: "grid",
      styles: { fontSize: 7, textColor: [18, 48, 74], cellPadding: 2 },
      headStyles: { fillColor: [238, 243, 248], textColor: [18, 48, 74], fontStyle: "bold" },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Payment", "Expected", "Received", "Outstanding", "Status", "Issue"]],
      body: clientRows.map((row) => [`Payment ${row.paymentNumber}`, formatCurrency(row.expectedAmount), formatCurrency(row.receivedAmount), formatCurrency(row.outstanding), row.status, row.issue]),
      theme: "grid",
      styles: { fontSize: 7, textColor: [18, 48, 74], cellPadding: 2 },
      headStyles: { fillColor: [238, 243, 248], textColor: [18, 48, 74], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });

    doc.save(`${project?.name || "Project"} - Exception Report.pdf`);
  }

  function printSelectedPhasePaymentList() {
    const rows = getPhasePaymentListRows();
    const expectedTotal = rows.reduce((total, row) => total + row.expectedAmount, 0);
    const paidTotal = rows.reduce((total, row) => total + row.paidAmount, 0);
    const outstandingTotal = expectedTotal - paidTotal;
    const reportTitle = phasePaymentListPhase === "all" ? "All Phases Payment List" : `Phase ${phasePaymentListPhase} Payment List`;

    const printWindow = window.open("", "_blank", "width=1400,height=900");

    if (!printWindow) {
      alert("Could not open print window.");
      return;
    }

    const rowHtml = rows
      .map((row) => {
        const symbol = getSupplierPaymentStatusSymbol(row.status, row.expectedAmount) || "-";
        return `
          <tr>
            <td>${escapeHtml(row.item.description)}</td>
            <td>${escapeHtml(row.contractor?.contractor_name || "-")}</td>
            <td>Phase ${row.phaseNumber}</td>
            <td style="text-align:right;">${formatCurrency(row.expectedAmount)}</td>
            <td style="text-align:right;">${formatCurrency(row.paidAmount)}</td>
            <td style="text-align:right;">${formatCurrency(row.balance)}</td>
            <td style="text-align:center;">${symbol}</td>
          </tr>
        `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(project?.name || "Project")} - ${escapeHtml(reportTitle)}</title>
          ${getPrintStyles()}
        </head>
        <body>
          <div class="print-header">
            <h1>${escapeHtml(project?.name || "Project")}</h1>
            <p>Client: ${escapeHtml(project?.organisations?.name || "Not linked")}</p>
            <p>${escapeHtml(reportTitle)}</p>
          </div>

          <table>
            <tbody>
              <tr>
                <td><strong>Expected to Pay</strong></td>
                <td style="text-align:right;">${formatCurrency(expectedTotal)}</td>
                <td><strong>Already Paid</strong></td>
                <td style="text-align:right;">${formatCurrency(paidTotal)}</td>
                <td><strong>Outstanding</strong></td>
                <td style="text-align:right;">${formatCurrency(outstandingTotal)}</td>
              </tr>
            </tbody>
          </table>

          <table>
            <thead>
              <tr>
                <th>Supplier Line</th>
                <th>Supplier / Contractor</th>
                <th>Phase</th>
                <th style="text-align:right;">Expected</th>
                <th style="text-align:right;">Paid</th>
                <th style="text-align:right;">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowHtml || `<tr><td colspan="7">No supplier payments found for this phase selection.</td></tr>`}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total</td>
                <td style="text-align:right;">${formatCurrency(expectedTotal)}</td>
                <td style="text-align:right;">${formatCurrency(paidTotal)}</td>
                <td style="text-align:right;">${formatCurrency(outstandingTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  async function exportSelectedPhasePaymentListPdf() {
    const rows = getPhasePaymentListRows();
    const expectedTotal = rows.reduce((total, row) => total + row.expectedAmount, 0);
    const paidTotal = rows.reduce((total, row) => total + row.paidAmount, 0);
    const outstandingTotal = expectedTotal - paidTotal;
    const reportTitle = phasePaymentListPhase === "all" ? "All Phases Payment List" : `Phase ${phasePaymentListPhase} Payment List`;

    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    doc.setTextColor(18, 48, 74);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(project?.name || "Project", 12, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Client: ${project?.organisations?.name || "Not linked"}`, 12, 20);
    doc.text(reportTitle, 12, 25);

    autoTable(doc, {
      startY: 32,
      head: [["Expected to Pay", "Already Paid", "Outstanding"]],
      body: [[formatCurrency(expectedTotal), formatCurrency(paidTotal), formatCurrency(outstandingTotal)]],
      theme: "grid",
      styles: { fontSize: 8, textColor: [18, 48, 74], cellPadding: 2 },
      headStyles: { fillColor: [238, 243, 248], textColor: [18, 48, 74], fontStyle: "bold" },
      columnStyles: { 0: { halign: "right" }, 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Supplier Line", "Supplier / Contractor", "Phase", "Expected", "Paid", "Balance", "Status"]],
      body: rows.map((row) => [
        row.item.description,
        row.contractor?.contractor_name || "-",
        `Phase ${row.phaseNumber}`,
        formatCurrency(row.expectedAmount),
        formatCurrency(row.paidAmount),
        formatCurrency(row.balance),
        row.status,
      ]),
      foot: [["Total", "", "", formatCurrency(expectedTotal), formatCurrency(paidTotal), formatCurrency(outstandingTotal), ""]],
      theme: "grid",
      styles: { fontSize: 8, textColor: [18, 48, 74], cellPadding: 2 },
      headStyles: { fillColor: [238, 243, 248], textColor: [18, 48, 74], fontStyle: "bold" },
      footStyles: { fillColor: [246, 248, 251], textColor: [18, 48, 74], fontStyle: "bold" },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });

    doc.save(`${project?.name || "Project"} - ${reportTitle}.pdf`);
  }

  function getReportTitle(sectionId: string) {
    if (sectionId === "print-full-pack") return "Full Project Control Pack";
    if (sectionId === "print-quote-summary") return "Supplier Budget Summary";
    if (sectionId === "print-phase-schedule") return "Supplier Payment Schedule";
    if (sectionId === "print-invoices-payments") return "Client Invoices & Receipts";

    return "Project Report";
  }

  function getPrintStyles() {
    return `
      <style>
        @page {
          size: A4 landscape;
          margin: 12mm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, sans-serif;
          color: #12304a;
          margin: 0;
          padding: 0;
          background: #ffffff;
        }

        .print-page {
          width: 100%;
        }

        .print-header {
          border-bottom: 2px solid #12304a;
          padding-bottom: 10px;
          margin-bottom: 18px;
        }

        .print-header h1 {
          font-size: 22px;
          margin: 0;
          color: #12304a;
        }

        .print-header p {
          margin: 6px 0 0 0;
          color: #5b6775;
          font-size: 12px;
        }

        .print-logo {
  width: 90px !important;
  height: 55px !important;
  max-width: 90px !important;
  max-height: 55px !important;
  object-fit: contain !important;
}
        section {
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          margin-bottom: 22px !important;
          overflow: visible !important;
        }

        h2 {
          font-size: 17px !important;
          margin: 0 0 10px 0 !important;
          color: #12304a !important;
        }

        table {
          width: 100% !important;
          min-width: 0 !important;
          border-collapse: collapse !important;
          table-layout: auto !important;
          font-size: 10px !important;
          margin-bottom: 18px !important;
        }

        th {
          background: #eef3f8 !important;
          color: #12304a !important;
          border: 1px solid #cfd8e3 !important;
          padding: 6px !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          white-space: normal !important;
        }

        td {
          border: 1px solid #dce3eb !important;
          padding: 6px !important;
          font-size: 10px !important;
          color: #12304a !important;
          vertical-align: top !important;
          white-space: normal !important;
        }

        td[style*="text-align: right"],
        th[style*="text-align: right"] {
          text-align: right !important;
        }

        tfoot td {
          font-weight: 700 !important;
          background: #f6f8fb !important;
          border-top: 2px solid #12304a !important;
        }

        #print-phase-schedule {
          break-before: page;
          page-break-before: always;
        }

        button,
        .screen-only {
          display: none !important;
        }

        .warningText,
        div {
          page-break-inside: avoid;
        }
      </style>
    `;
  }

  function preparePrintableSection(sectionId: string, reportTitle: string) {
    const section = document.getElementById(sectionId);

    if (!section) {
      alert("Print section not found.");
      return null;
    }

    const clonedSection = section.cloneNode(true) as HTMLElement;

    clonedSection.querySelectorAll(".screen-only").forEach((element) => {
      element.remove();
    });

    clonedSection.querySelectorAll("input").forEach((input) => {
      const value = input.getAttribute("value") || (input as HTMLInputElement).value || "-";
      const span = document.createElement("span");
      span.textContent = value || "-";
      input.replaceWith(span);
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
<div class="print-header">
  <div class="print-header-row">
    ${
      project?.organisations?.logo_url
        ? `<img src="${project.organisations.logo_url}" class="print-logo" />`
        : ""
    }

    <div>
      <h1>${project?.name || "Project"}</h1>
      <p>Client: ${project?.organisations?.name || "Not linked"}</p>
      <p>${reportTitle}</p>
    </div>
  </div>
</div>

        ${clonedSection.innerHTML}
      </div>
    `;

    return wrapper;
  }

  function printSection(sectionId: string) {
    const reportTitle = getReportTitle(sectionId);
    const printableSection = preparePrintableSection(sectionId, reportTitle);

    if (!printableSection) return;

    const printWindow = window.open("", "_blank", "width=1400,height=900");

    if (!printWindow) {
      alert("Could not open print window.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${project?.name || "Project"} - ${reportTitle}</title>
          ${getPrintStyles()}
        </head>

        <body>
          ${printableSection.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    printWindow.onafterprint = () => {
      printWindow.close();
    };

    setTimeout(() => {
      printWindow.print();
    }, 1000);
  }

  async function exportPdfSection(sectionId: string) {
  const reportTitle = getReportTitle(sectionId);
  const fileName = `${project?.name || "Project"} - ${reportTitle}.pdf`;

  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  function addHeader(title: string) {
    doc.setTextColor(18, 48, 74);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(project?.name || "Project", margin, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Client: ${project?.organisations?.name || "Not linked"}`, margin, 20);
    doc.text(title, margin, 25);

    doc.setDrawColor(18, 48, 74);
    doc.setLineWidth(0.5);
    doc.line(margin, 29, pageWidth - margin, 29);
  }

  function addQuoteSummary(startY: number) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(18, 48, 74);
    doc.text("Supplier Budget Summary", margin, startY);

    const rows = lineItems.map((item) => [
      item.description,
      item.vatMode,
      formatCurrency(calculateExcludingVat(item)),
      formatCurrency(calculateVat(item)),
      formatCurrency(calculateTotal(item)),
    ]);

    rows.push([
      "Total",
      "",
      formatCurrency(totalExcludingVat),
      formatCurrency(totalVat),
      formatCurrency(totalIncludingVat),
    ]);

    autoTable(doc, {
      startY: startY + 5,
      head: [["Description", "VAT Mode", "Excl. VAT", "VAT", "Incl. VAT"]],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 8,
        textColor: [18, 48, 74],
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [238, 243, 248],
        textColor: [18, 48, 74],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
      didParseCell: (data: any) => {
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [246, 248, 251];
        }
      },
      margin: { left: margin, right: margin },
    });

    return (doc as any).lastAutoTable.finalY + 10;
  }

  function addPhaseSchedule(startY: number) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(18, 48, 74);
    doc.text("Supplier Payment Schedule", margin, startY);

    const head = ["Description", ...phaseNumbers.map((phaseNumber) => `Phase ${phaseNumber}`)];

    const rows = lineItems.map((item) => {
      return [
        item.description,
        ...phaseNumbers.map((phaseNumber) => {
          const percentage = getPhasePercentage(item, phaseNumber);
          return `${percentage}%\n${formatCurrency(calculatePhaseAmount(item, percentage))}`;
        }),
      ];
    });

    rows.push([
      "Total per Phase",
      ...phaseTotals.map((total) => formatCurrency(total)),
    ]);

    autoTable(doc, {
      startY: startY + 5,
      head: [head],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 8,
        textColor: [18, 48, 74],
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [238, 243, 248],
        textColor: [18, 48, 74],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: phaseNumbers.reduce((acc: any, _phaseNumber, index) => {
        acc[index + 1] = { halign: "right" };
        return acc;
      }, {}),
      didParseCell: (data: any) => {
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [246, 248, 251];
        }
      },
      margin: { left: margin, right: margin },
    });

    return (doc as any).lastAutoTable.finalY + 10;
  }

  function addInvoicesAndPayments(startY: number) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(18, 48, 74);
    doc.text("Client Invoices & Receipts", margin, startY);

    const rows = clientPaymentNumbers.map((phaseNumber) => {
      const expectedAmount = getExpectedClientPaymentAmount(phaseNumber);
      const existingInvoice = getInvoiceForPhase(phaseNumber);

      const enteredInvoiceAmount =
        invoiceAmounts[phaseNumber] === "" || invoiceAmounts[phaseNumber] === undefined
          ? null
          : Number(invoiceAmounts[phaseNumber]);

      const enteredPaidAmount =
        paidAmounts[phaseNumber] === "" || paidAmounts[phaseNumber] === undefined
          ? null
          : Number(paidAmounts[phaseNumber]);

      const difference =
        enteredInvoiceAmount === null ? null : enteredInvoiceAmount - expectedAmount;

      const outstanding =
        enteredInvoiceAmount === null
          ? null
          : enteredInvoiceAmount - Number(enteredPaidAmount || 0);

      const hasOverdueOutstanding =
        outstanding !== null &&
        outstanding > 0 &&
        isOlderThan30Days(invoiceDates[phaseNumber] || null);

      return [
        `Payment ${phaseNumber}`,
        formatCurrency(expectedAmount),
        invoiceNumbers[phaseNumber] || "-",
        invoiceDates[phaseNumber] || "-",
        enteredInvoiceAmount === null ? "-" : formatCurrency(enteredInvoiceAmount),
        difference === null ? "-" : formatCurrency(difference),
        enteredPaidAmount === null ? "-" : formatCurrency(enteredPaidAmount),
        paymentDates[phaseNumber] || "-",
        outstanding === null
          ? "-"
          : `${formatCurrency(outstanding)}${hasOverdueOutstanding ? "\n⚠ Over 30 days" : ""}`,
        existingInvoice?.status || "Not Invoiced",
      ];
    });

    autoTable(doc, {
      startY: startY + 5,
      head: [[
        "Client Payment",
        "Expected",
        "Invoice No.",
        "Invoice Date",
        "Invoice Amount",
        "Difference",
        "Amount Paid",
        "Payment Date",
        "Outstanding",
        "Status",
      ]],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 7,
        textColor: [18, 48, 74],
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [238, 243, 248],
        textColor: [18, 48, 74],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        1: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        8: { halign: "right" },
      },
      margin: { left: margin, right: margin },
    });

    return (doc as any).lastAutoTable.finalY + 10;
  }

  addHeader(reportTitle);

  if (sectionId === "print-quote-summary") {
    addQuoteSummary(38);
  }

  if (sectionId === "print-phase-schedule") {
    addPhaseSchedule(38);
  }

  if (sectionId === "print-invoices-payments") {
    addInvoicesAndPayments(38);
  }

  if (sectionId === "print-full-pack") {
    addQuoteSummary(38);

    doc.addPage();
    addHeader("Supplier Payment Schedule");
    addPhaseSchedule(38);

    doc.addPage();
    addHeader("Client Invoices & Receipts");
    addInvoicesAndPayments(38);
  }

  doc.save(fileName);
}

  const totalExcludingVat = lineItems.reduce(
    (total, item) => total + calculateExcludingVat(item),
    0
  );

  const totalVat = lineItems.reduce((total, item) => total + calculateVat(item), 0);
  function getContractorQuoteValue(contractorId: string) {
  return lineItems
    .filter((item) => item.contractorId === contractorId)
    .reduce((total, item) => total + calculateTotal(item), 0);
}
  const totalIncludingVat = lineItems.reduce((total, item) => total + calculateTotal(item), 0);
  const phaseTotals = phaseNumbers.map((phaseNumber) => getExpectedPhaseAmount(phaseNumber));
  const isInternalUser =
  profile?.role === "Super Admin" ||
  profile?.role === "Admin" ||
  profile?.role === "Staff";

const canEditProjectDetails = Boolean(isInternalUser || profile?.can_edit_projects);
console.log("PROJECT ACCESS TEST", {
  role: profile?.role,
  canEditProjects: profile?.can_edit_projects,
  canEditProjectDetails,
});

  if (loadingProject || !accessChecked) {
return (
  <main style={{ background: "#e9edf3", minHeight: "calc(100vh - 60px)", width: "100%", overflowX: "hidden" }}>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px minmax(0, 1fr)",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <aside style={styles.leftSidebar}></aside>

      <div style={styles.emptyState}>Checking project access...</div>
    </div>
  </main>
);
  }

  return (
  <main style={{ background: "#e9edf3", minHeight: "calc(100vh - 60px)", width: "100%", overflowX: "hidden" }}>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px minmax(0, 1fr)",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <aside style={styles.leftSidebar}>
        <div style={{ padding: "12px 6px 14px 0" }}>
          <p
            style={{
              margin: "0 0 12px 12px",
              fontSize: "11px",
              fontWeight: 900,
              color: "#9aa7b8",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Project Control File
          </p>

          <div style={{ display: "grid", gap: "2px" }}>
            <button
              style={selectedProjectSection === "overview" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("overview")}
            >
              Overview
            </button>

            <button
              style={selectedProjectSection === "client-income" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("client-income")}
            >
              Client Income
            </button>

            <button
              style={selectedProjectSection === "client-invoices" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("client-invoices")}
            >
              Client Invoices & Receipts
            </button>

            <button
              style={selectedProjectSection === "supplier-budget" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("supplier-budget")}
            >
              Supplier Budget
            </button>

            <button
              style={selectedProjectSection === "supplier-schedule" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("supplier-schedule")}
            >
              Supplier Payment Schedule
            </button>

            <button
              style={selectedProjectSection === "phase-payments" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("phase-payments")}
            >
              Phase Payment List
            </button>

            <button
              style={selectedProjectSection === "supplier-payments" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("supplier-payments")}
            >
              Supplier Payments & POPs
            </button>

            <button
              style={selectedProjectSection === "contractors" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("contractors")}
            >
              Suppliers / Contractors
            </button>

            <button
              style={selectedProjectSection === "timeline" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("timeline")}
            >
              Timeline
            </button>

            <button
              style={selectedProjectSection === "export" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("export")}
            >
              Reports / Export
            </button>
          </div>
        </div>
      </aside>

      <div style={{ padding: "12px 14px 22px 14px", minWidth: 0, overflowX: "hidden" }}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              {loadingProject ? "Project Detail" : project?.name || "Project Detail"}
            </h1>

            <p style={styles.subtitle}>
              {project
                ? `Client: ${project.organisations?.name || "Not linked"} · ${project.number_of_phases} phase${
                    project.number_of_phases === 1 ? "" : "s"
                  } · ${project.status}`
                : `Project ID: ${projectId}`}
            </p>
          </div>

          <a href="/project-management" style={styles.backButton}>
            Back to Projects
          </a>
        </div>

{selectedProjectSection === "overview" && (
  <section style={styles.card}>
    <h2 style={styles.cardTitle}>Project Overview</h2>

    <div style={styles.controlStrip}>
      <div>
        <div style={styles.controlStripLabel}>Current Supplier Phase</div>
        <div style={styles.controlStripHelp}>Used by the Exception Report. Future supplier phases are not treated as exceptions yet.</div>
      </div>

      <div style={styles.controlStripActions}>
        <select
          style={styles.compactSelect}
          value={currentSupplierPhase}
          onChange={(e) => setCurrentSupplierPhase(e.target.value)}
        >
          {phaseNumbers.map((phaseNumber) => (
            <option key={phaseNumber} value={String(phaseNumber)}>
              Phase {phaseNumber}
            </option>
          ))}
        </select>

        <button
          style={styles.primaryButtonSmall}
          onClick={handleSaveCurrentSupplierPhase}
          disabled={savingCurrentSupplierPhase}
        >
          {savingCurrentSupplierPhase ? "Saving..." : "Save Phase"}
        </button>
      </div>
    </div>

    <div style={styles.summaryGridFive}>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Client Income</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientIncomeIncludingVat())}</div>
      </div>

      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Client Received</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientPaidTotal())}</div>
      </div>

      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Supplier Budget</div>
        <div style={styles.summaryValue}>{formatCurrency(totalIncludingVat)}</div>
      </div>

      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Suppliers Paid</div>
        <div style={styles.summaryValue}>{formatCurrency(getSupplierPaidTotal())}</div>
      </div>

      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Cash Position</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientPaidTotal() - getSupplierPaidTotal())}</div>
      </div>
    </div>

    <div style={styles.twoColumnGrid}>
      <div>
        <h3 style={styles.subSectionTitle}>Client Payment Overview</h3>
        <div style={styles.tableWrapNoScroll}>
          <table style={styles.compactTable}>
            <thead>
              <tr>
                <th style={styles.th}>Payment</th>
                <th style={styles.thRight}>Expected</th>
                <th style={styles.thRight}>Received</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {clientPaymentNumbers.map((paymentNumber) => {
                const expectedAmount = getExpectedClientPaymentAmount(paymentNumber);
                const invoice = getInvoiceForPhase(paymentNumber);
                const receivedAmount = Number(invoice?.project_payments?.[0]?.paid_amount || 0);
                const status = getSupplierPaymentStatus(expectedAmount, receivedAmount);

                return (
                  <tr key={paymentNumber}>
                    <td style={styles.td}>Payment {paymentNumber}</td>
                    <td style={styles.tdRight}>{formatCurrency(expectedAmount)}</td>
                    <td style={styles.tdRight}>{formatCurrency(receivedAmount)}</td>
                    <td style={styles.td}><span style={getStatusStyle(status)}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 style={styles.subSectionTitle}>Supplier Phase Overview</h3>
        <div style={styles.tableWrapNoScroll}>
          <table style={styles.compactTable}>
            <thead>
              <tr>
                <th style={styles.th}>Phase</th>
                <th style={styles.thRight}>Expected</th>
                <th style={styles.thRight}>Paid</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {phaseNumbers.map((phaseNumber) => {
                const expectedAmount = getExpectedPhaseAmount(phaseNumber);
                const paidAmount = getSupplierPaidForPhase(phaseNumber);
                const status = getSupplierPaymentStatus(expectedAmount, paidAmount);

                return (
                  <tr key={phaseNumber}>
                    <td style={styles.td}>Supplier Phase {phaseNumber}</td>
                    <td style={styles.tdRight}>{formatCurrency(expectedAmount)}</td>
                    <td style={styles.tdRight}>{formatCurrency(paidAmount)}</td>
                    <td style={styles.td}><span style={getStatusStyle(status)}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <h3 style={styles.subSectionTitle}>Project Control Summary</h3>
    <div style={styles.tableWrapNoScroll}>
      <table style={styles.compactTable}>
        <tbody>
          <tr>
            <td style={styles.td}>Projected gross profit</td>
            <td style={styles.tdRight}>{formatCurrency(getClientIncomeIncludingVat() - totalIncludingVat)}</td>
          </tr>
          <tr>
            <td style={styles.td}>Client income still outstanding</td>
            <td style={styles.tdRight}>{formatCurrency(getClientIncomeIncludingVat() - getClientPaidTotal())}</td>
          </tr>
          <tr>
            <td style={styles.td}>Supplier payments still outstanding</td>
            <td style={styles.tdRight}>{formatCurrency(totalIncludingVat - getSupplierPaidTotal())}</td>
          </tr>
          <tr>
            <td style={styles.totalCell}>Current cash position</td>
            <td style={styles.totalCellRight}>{formatCurrency(getClientPaidTotal() - getSupplierPaidTotal())}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
)}

{selectedProjectSection === "cashflow-control" && (
  <section style={styles.card}>
    <div style={styles.sectionHeaderRow}>
      <h2 style={styles.cardTitle}>Cashflow Control</h2>
      <div style={styles.inlineActions}>
        <button style={styles.printButton} onClick={printCashflowControlReport}>Print</button>
        <button style={styles.pdfButton} onClick={exportCashflowControlReportPdf}>PDF</button>
      </div>
    </div>

    <div style={styles.summaryGridFive}>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Client Income</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientIncomeIncludingVat())}</div>
      </div>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Client Received</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientPaidTotal())}</div>
      </div>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Suppliers Paid</div>
        <div style={styles.summaryValue}>{formatCurrency(getSupplierPaidTotal())}</div>
      </div>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Current Cash Position</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientPaidTotal() - getSupplierPaidTotal())}</div>
      </div>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Remaining Exposure</div>
        <div style={styles.summaryValue}>{formatCurrency(Math.max(0, totalIncludingVat - getSupplierPaidTotal()))}</div>
      </div>
    </div>

    <h3 style={styles.subSectionTitle}>Phase Cashflow</h3>
    <div style={styles.tableWrapNoScroll}>
      <table style={styles.compactTable}>
        <thead>
          <tr>
            <th style={styles.th}>Phase</th>
            <th style={styles.thRight}>Client Expected</th>
            <th style={styles.thRight}>Client Received</th>
            <th style={styles.thRight}>Supplier Expected</th>
            <th style={styles.thRight}>Supplier Paid</th>
            <th style={styles.thRight}>Cash Position</th>
            <th style={styles.thRight}>Supplier Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {phaseNumbers.map((phaseNumber) => {
            const clientExpected = getExpectedClientPaymentAmount(phaseNumber);
            const invoice = getInvoiceForPhase(phaseNumber);
            const clientReceived = Number(invoice?.project_payments?.[0]?.paid_amount || 0);
            const supplierExpected = getExpectedPhaseAmount(phaseNumber);
            const supplierPaid = getSupplierPaidForPhase(phaseNumber);
            const supplierOutstanding = Math.max(0, supplierExpected - supplierPaid);

            return (
              <tr key={phaseNumber}>
                <td style={styles.td}>Phase {phaseNumber}</td>
                <td style={styles.tdRight}>{formatCurrency(clientExpected)}</td>
                <td style={styles.tdRight}>{formatCurrency(clientReceived)}</td>
                <td style={styles.tdRight}>{formatCurrency(supplierExpected)}</td>
                <td style={styles.tdRight}>{formatCurrency(supplierPaid)}</td>
                <td style={styles.tdRight}>{formatCurrency(clientReceived - supplierPaid)}</td>
                <td style={styles.tdRight}>{formatCurrency(supplierOutstanding)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    <h3 style={styles.subSectionTitle}>Control Totals</h3>
    <div style={styles.tableWrapNoScroll}>
      <table style={styles.compactTable}>
        <tbody>
          <tr>
            <td style={styles.td}>Client income still outstanding</td>
            <td style={styles.tdRight}>{formatCurrency(Math.max(0, getClientIncomeIncludingVat() - getClientPaidTotal()))}</td>
          </tr>
          <tr>
            <td style={styles.td}>Supplier payments still outstanding</td>
            <td style={styles.tdRight}>{formatCurrency(Math.max(0, totalIncludingVat - getSupplierPaidTotal()))}</td>
          </tr>
          <tr>
            <td style={styles.totalCell}>Current cash position</td>
            <td style={styles.totalCellRight}>{formatCurrency(getClientPaidTotal() - getSupplierPaidTotal())}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
)}

{selectedProjectSection === "exception-report" && (
  <section style={styles.card}>
    <div style={styles.sectionHeaderRow}>
      <h2 style={styles.cardTitle}>Exception Report</h2>
      <div style={styles.inlineActions}>
        <button style={styles.printButton} onClick={printExceptionReport}>Print</button>
        <button style={styles.pdfButton} onClick={exportExceptionReportPdf}>PDF</button>
      </div>
    </div>

    <div style={styles.exportNote}>
      This report only shows true exceptions. Supplier payments are only treated as exceptions if they are unpaid/part-paid in the current or past supplier phase, or if they are overpaid. Future phase payments remain scheduled items and do not appear here yet.
    </div>

    <div style={styles.controlStrip}>
      <div>
        <div style={styles.controlStripLabel}>Exception cut-off phase</div>
        <div style={styles.controlStripHelp}>Currently checking supplier phases up to Phase {getCurrentSupplierPhaseNumber()}.</div>
      </div>
      <div style={styles.controlStripActions}>
        <select
          style={styles.compactSelect}
          value={currentSupplierPhase}
          onChange={(e) => setCurrentSupplierPhase(e.target.value)}
        >
          {phaseNumbers.map((phaseNumber) => (
            <option key={phaseNumber} value={String(phaseNumber)}>Phase {phaseNumber}</option>
          ))}
        </select>
        <button
          style={styles.primaryButtonSmall}
          onClick={handleSaveCurrentSupplierPhase}
          disabled={savingCurrentSupplierPhase}
        >
          {savingCurrentSupplierPhase ? "Saving..." : "Save Phase"}
        </button>
      </div>
    </div>

    <h3 style={styles.subSectionTitle}>Supplier Exceptions</h3>
    <div style={styles.tableWrapNoScroll}>
      <table style={styles.compactTable}>
        <thead>
          <tr>
            <th style={styles.th}>Supplier Line</th>
            <th style={styles.th}>Supplier / Contractor</th>
            <th style={styles.th}>Phase</th>
            <th style={styles.thRight}>Expected</th>
            <th style={styles.thRight}>Paid</th>
            <th style={styles.thRight}>Balance</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Issue</th>
          </tr>
        </thead>
        <tbody>
          {getSupplierExceptionRows().map((row) => (
            <tr key={`${row.item.id}-${row.phaseNumber}`}>
              <td style={styles.td}>{row.item.description}</td>
              <td style={styles.td}>{row.contractor?.contractor_name || "-"}</td>
              <td style={styles.td}>Phase {row.phaseNumber}</td>
              <td style={styles.tdRight}>{formatCurrency(row.expectedAmount)}</td>
              <td style={styles.tdRight}>{formatCurrency(row.paidAmount)}</td>
              <td style={styles.tdRight}>{formatCurrency(row.balance)}</td>
              <td style={styles.td}><span style={getStatusStyle(row.status)}>{row.status}</span></td>
              <td style={styles.td}>{row.issue}</td>
            </tr>
          ))}
          {getSupplierExceptionRows().length === 0 && (
            <tr>
              <td style={styles.td} colSpan={8}>No supplier exceptions.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    <h3 style={styles.subSectionTitle}>Client Receipt Exceptions</h3>
    <div style={styles.tableWrapNoScroll}>
      <table style={styles.compactTable}>
        <thead>
          <tr>
            <th style={styles.th}>Payment</th>
            <th style={styles.thRight}>Expected</th>
            <th style={styles.thRight}>Received</th>
            <th style={styles.thRight}>Outstanding</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Issue</th>
          </tr>
        </thead>
        <tbody>
          {getClientReceiptExceptionRows().map((row) => (
            <tr key={row.paymentNumber}>
              <td style={styles.td}>Payment {row.paymentNumber}</td>
              <td style={styles.tdRight}>{formatCurrency(row.expectedAmount)}</td>
              <td style={styles.tdRight}>{formatCurrency(row.receivedAmount)}</td>
              <td style={styles.tdRight}>{formatCurrency(row.outstanding)}</td>
              <td style={styles.td}><span style={getStatusStyle(row.status)}>{row.status}</span></td>
              <td style={styles.td}>{row.issue}</td>
            </tr>
          ))}
          {getClientReceiptExceptionRows().length === 0 && (
            <tr>
              <td style={styles.td} colSpan={6}>No client receipt exceptions.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
)}


{selectedProjectSection === "client-income" && (
  <section style={styles.card}>
    <h2 style={styles.cardTitle}>Client Income</h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr 1fr auto",
        gap: "10px",
        alignItems: "end",
        marginBottom: "18px",
      }}
    >
      <div>
        <label style={styles.label}>Total Contract Income</label>
        <input
          style={{ ...styles.input, width: "100%" }}
          type="number"
          value={clientIncomeTotal}
          onChange={(e) => {
            const newTotal = e.target.value;
            setClientIncomeTotal(newTotal);
            setClientPaymentAmounts(
              calculateClientPaymentAmountsFromPercentages(
                clientPaymentPercentages,
                newTotal,
                clientIncomeVatMode
              )
            );
          }}
          placeholder="Example: 12000000"
        />
      </div>

      <div>
        <label style={styles.label}>VAT Mode</label>
        <select
          style={{ ...styles.input, width: "100%" }}
          value={clientIncomeVatMode}
          onChange={(e) => {
            const newVatMode = e.target.value as ClientIncomeVatMode;
            setClientIncomeVatMode(newVatMode);
            setClientPaymentAmounts(
              calculateClientPaymentAmountsFromPercentages(
                clientPaymentPercentages,
                clientIncomeTotal,
                newVatMode
              )
            );
          }}
        >
          <option value="Inclusive">VAT Inclusive</option>
          <option value="Exclusive">VAT Exclusive</option>
          <option value="No VAT">No VAT</option>
        </select>
      </div>

      <div>
        <label style={styles.label}>Client Payments</label>
        <input
          style={{ ...styles.input, width: "100%" }}
          type="number"
          min="1"
          max="12"
          value={clientPaymentCount}
          onChange={(e) => updateClientPaymentCount(e.target.value)}
        />
      </div>

      <button
        style={styles.primaryButton}
        onClick={handleSaveClientIncome}
        disabled={savingClientIncome}
      >
        {savingClientIncome ? "Saving..." : "Save Income"}
      </button>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
        gap: "12px",
        marginBottom: "18px",
      }}
    >
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Income Excl. VAT</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientIncomeExcludingVat())}</div>
      </div>

      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>VAT on Income</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientIncomeVat())}</div>
      </div>

      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Income Incl. VAT</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientIncomeIncludingVat())}</div>
      </div>

      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Projected Gross Profit</div>
        <div style={styles.summaryValue}>{formatCurrency(getClientIncomeIncludingVat() - totalIncludingVat)}</div>
      </div>
    </div>

    <h3 style={{ ...styles.cardTitle, fontSize: "18px" }}>Client Payment Split</h3>

    <div style={{ overflowX: "auto", border: "1px solid #d8e2ef" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Payment</th>
            <th style={styles.thRight}>Percentage</th>
            <th style={styles.thRight}>Expected Invoice Amount</th>
          </tr>
        </thead>

        <tbody>
          {clientPaymentNumbers.map((paymentNumber, index) => (
            <tr key={paymentNumber}>
              <td style={styles.td}>Client Payment {paymentNumber}</td>
              <td style={styles.tdRight}>
                <input
                  style={styles.tableInputRight}
                  type="number"
                  step="0.01"
                  value={clientPaymentPercentages[index] || ""}
                  onChange={(e) => updateClientPaymentPercentage(index, e.target.value)}
                />
              </td>
              <td style={styles.tdRight}>
                <input
                  style={styles.tableInputRightWide}
                  type="text"
                  inputMode="decimal"
                  value={getClientPaymentAmountInput(paymentNumber)}
                  onChange={(e) => updateClientPaymentAmount(index, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <td style={styles.tfootTd}>Total</td>
            <td style={{ ...styles.tfootTd, textAlign: "right" }}>
              {getClientPaymentTotalPercentage().toFixed(2)}%
            </td>
            <td style={{ ...styles.tfootTd, textAlign: "right" }}>
              {formatCurrency(getClientPaymentTotalAmount())}
            </td>
          </tr>

          <tr>
            <td style={styles.tfootTd}>Difference to Income</td>
            <td style={styles.tfootTd}></td>
            <td
              style={{
                ...styles.tfootTd,
                textAlign: "right",
                color: Math.abs(getClientPaymentAmountDifference()) < 0.01 ? "#12304a" : "#b42318",
              }}
            >
              {formatCurrency(getClientPaymentAmountDifference())}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>
)}


{selectedProjectSection === "phase-payments" && (
  <section style={styles.card}>
    <h2 style={styles.cardTitle}>Phase Payment List</h2>

    <div style={styles.scheduleHintBar}>
      Select a supplier phase to get a clean payment run list: who must be paid, the expected amount, what has already been paid, and what is still outstanding.
    </div>

    <div style={styles.stackedFilterPanel}>
      <div style={styles.stackedFilterRow}>
        <label style={styles.filterLabelWide}>Supplier Phase</label>
        <select
          style={styles.filterControlWide}
          value={phasePaymentListPhase}
          onChange={(e) => setPhasePaymentListPhase(e.target.value)}
        >
          <option value="all">All Phases</option>
          {phaseNumbers.map((phaseNumber) => (
            <option key={phaseNumber} value={String(phaseNumber)}>
              Phase {phaseNumber}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.stackedFilterRow}>
        <label style={styles.filterLabelWide}>Supplier / Line</label>
        <select
          style={styles.filterControlWide}
          value={phasePaymentListLineFilter}
          onChange={(e) => setPhasePaymentListLineFilter(e.target.value)}
        >
          <option value="">All supplier lines in selected phase</option>
          {lineItems
            .filter((item) => phasePaymentListPhase === "all" || getPhaseDisplayAmount(item, Number(phasePaymentListPhase || 1)) > 0)
            .map((item) => {
              const contractor = contractors.find((contractorItem) => contractorItem.id === item.contractorId);
              return (
                <option key={item.id} value={item.id}>
                  {item.description}{contractor ? ` — ${contractor.contractor_name}` : ""}
                </option>
              );
            })}
        </select>
      </div>

      <div style={styles.stackedFilterRow}>
        <label style={styles.filterLabelWide}>Supplier / Contractor</label>
        <select
          style={styles.filterControlWide}
          value={phasePaymentListContractorFilter}
          onChange={(e) => setPhasePaymentListContractorFilter(e.target.value)}
        >
          <option value="">All suppliers / contractors</option>
          <option value="__unlinked">Unlinked line items</option>
          {contractors.map((contractor) => (
            <option key={contractor.id} value={contractor.id}>
              {contractor.contractor_name}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.stackedFilterActions}>
        <button
          style={styles.secondaryButton}
          onClick={() => {
            setPhasePaymentListLineFilter("");
            setPhasePaymentListContractorFilter("");
          }}
        >
          Clear Filters
        </button>

        <button style={styles.printButton} onClick={printSelectedPhasePaymentList}>Print Phase List</button>
        <button style={styles.pdfButton} onClick={exportSelectedPhasePaymentListPdf}>PDF Phase List</button>
      </div>
    </div>

    {(() => {
      const rows = getPhasePaymentListRows();
      const expectedTotal = rows.reduce((total, row) => total + row.expectedAmount, 0);
      const paidTotal = rows.reduce((total, row) => total + row.paidAmount, 0);
      const outstandingTotal = expectedTotal - paidTotal;

      return (
        <>
          <div style={styles.summaryGridFour}>
            <div style={styles.summaryTile}>
              <div style={styles.summaryLabel}>Selected Phase</div>
              <div style={styles.summaryValue}>{phasePaymentListPhase === "all" ? "All Phases" : `Phase ${phasePaymentListPhase}`}</div>
            </div>
            <div style={styles.summaryTile}>
              <div style={styles.summaryLabel}>Expected to Pay</div>
              <div style={styles.summaryValue}>{formatCurrency(expectedTotal)}</div>
            </div>
            <div style={styles.summaryTile}>
              <div style={styles.summaryLabel}>Already Paid</div>
              <div style={styles.summaryValue}>{formatCurrency(paidTotal)}</div>
            </div>
            <div style={styles.summaryTile}>
              <div style={styles.summaryLabel}>Outstanding</div>
              <div style={styles.summaryValue}>{formatCurrency(outstandingTotal)}</div>
            </div>
          </div>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Supplier Line</th>
                <th style={styles.th}>Supplier / Contractor</th>
                <th style={styles.th}>Phase</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Expected</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Paid</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Balance</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const symbol = getSupplierPaymentStatusSymbol(row.status, row.expectedAmount);

                return (
                  <tr key={`${row.item.id}-${row.phaseNumber}`}>
                    <td style={styles.td}>
                      <strong>{row.item.description}</strong>
                    </td>
                    <td style={styles.td}>
                      {row.contractor?.contractor_name || "-"}
                      {row.contractor?.trade_category ? (
                        <div style={styles.mutedSmall}>{row.contractor.trade_category}</div>
                      ) : null}
                    </td>
                    <td style={styles.td}>Phase {row.phaseNumber}</td>
                    <td style={styles.tdRight}>{formatCurrency(row.expectedAmount)}</td>
                    <td style={styles.tdRight}>{formatCurrency(row.paidAmount)}</td>
                    <td style={styles.tdRight}>{formatCurrency(row.balance)}</td>
                    <td style={styles.td}>
                      {symbol ? (
                        <span title={row.status} style={getSupplierPaymentStatusSymbolStyle(row.status)}>
                          {symbol}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={styles.td}>
                      <button
                        style={styles.smallButton}
                        onClick={() => {
                          setSupplierPaymentLineFilter(row.item.id);
                          setSupplierPaymentContractorFilter(row.item.contractorId || "");
                          setSelectedProjectSection("supplier-payments");
                        }}
                      >
                        Pay / POP
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={8}>No supplier payments scheduled for this phase selection.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      );
    })()}
  </section>
)}

{selectedProjectSection === "supplier-payments" && (
  <section style={styles.card}>
    <h2 style={styles.cardTitle}>Supplier Payments & POPs</h2>

    <div style={styles.summaryGridFour}>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Supplier Budget</div>
        <div style={styles.summaryValue}>{formatCurrency(totalIncludingVat)}</div>
      </div>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Suppliers Paid</div>
        <div style={styles.summaryValue}>{formatCurrency(getSupplierPaidTotal())}</div>
      </div>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>Outstanding</div>
        <div style={styles.summaryValue}>{formatCurrency(totalIncludingVat - getSupplierPaidTotal())}</div>
      </div>
      <div style={styles.summaryTile}>
        <div style={styles.summaryLabel}>POP Records</div>
        <div style={styles.summaryValue}>{supplierPayments.filter((payment) => payment.pop_file_path).length}</div>
      </div>
    </div>

    <div style={styles.stackedFilterPanel}>
      <div style={styles.stackedFilterRow}>
        <label style={styles.filterLabelWide}>Supplier / Line</label>
        <select
          style={styles.filterControlWide}
          value={supplierPaymentLineFilter}
          onChange={(e) => setSupplierPaymentLineFilter(e.target.value)}
        >
          <option value="">All supplier lines</option>
          {lineItems.map((item) => {
            const contractor = contractors.find((contractorItem) => contractorItem.id === item.contractorId);
            return (
              <option key={item.id} value={item.id}>
                {item.description}{contractor ? ` — ${contractor.contractor_name}` : ""}
              </option>
            );
          })}
        </select>
      </div>

      <div style={styles.stackedFilterRow}>
        <label style={styles.filterLabelWide}>Supplier / Contractor</label>
        <select
          style={styles.filterControlWide}
          value={supplierPaymentContractorFilter}
          onChange={(e) => setSupplierPaymentContractorFilter(e.target.value)}
        >
          <option value="">All suppliers / contractors</option>
          <option value="__unlinked">Unlinked line items</option>
          {contractors.map((contractor) => (
            <option key={contractor.id} value={contractor.id}>
              {contractor.contractor_name}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.stackedFilterActions}>
        <button
          style={styles.secondaryButton}
          onClick={() => {
            setSupplierPaymentLineFilter("");
            setSupplierPaymentContractorFilter("");
          }}
        >
          Clear Filters
        </button>
        <button style={styles.printButton} onClick={printSupplierPaymentsReport}>Print Supplier Payments & POPs</button>
        <button style={styles.pdfButton} onClick={exportSupplierPaymentsReportPdf}>PDF Supplier Payments & POPs</button>
      </div>
    </div>

    {loadingSupplierPayments ? (
      <div style={styles.emptyState}>Loading supplier payments...</div>
    ) : (
      <div style={styles.tableWrap}>
        <table style={styles.supplierPaymentTable}>
          <thead>
            <tr>
              <th style={styles.th}>Supplier Line</th>
              <th style={styles.th}>Supplier</th>
              <th style={styles.th}>Phase</th>
              <th style={styles.thRight}>Expected</th>
              <th style={styles.thRight}>Paid</th>
              <th style={styles.thRight}>Balance</th>
              <th style={styles.th}>Status</th>
              <th style={styles.thRight}>New Paid</th>
              <th style={styles.th}>Pay Date</th>
              <th style={styles.th}>POP / Action</th>
            </tr>
          </thead>

          <tbody>
            {lineItems.flatMap((lineItem) => {
              const contractor = contractors.find((entry) => entry.id === lineItem.contractorId);
              if (supplierPaymentLineFilter && lineItem.id !== supplierPaymentLineFilter) {
                return [];
              }

              if (supplierPaymentContractorFilter === "__unlinked" && lineItem.contractorId) {
                return [];
              }

              if (
                supplierPaymentContractorFilter &&
                supplierPaymentContractorFilter !== "__unlinked" &&
                lineItem.contractorId !== supplierPaymentContractorFilter
              ) {
                return [];
              }

              return phaseNumbers.map((phaseNumber) => {
                const phase = lineItem.phases.find((item) => item.phaseNumber === phaseNumber);
                const expectedAmount = getExpectedSupplierPaymentForLineItem(lineItem, phaseNumber);

                if (!phase || expectedAmount <= 0) return null;

                const key = getSupplierPaymentKey(lineItem.id, phaseNumber);
                const paidAmount = getSupplierPaidForLineItemPhase(lineItem.id, phaseNumber);
                const balance = expectedAmount - paidAmount;
                const status = getSupplierPaymentStatus(expectedAmount, paidAmount);
                const payments = getSupplierPaymentsForLineItemPhase(lineItem.id, phaseNumber);

                return (
                  <tr key={key}>
                    <td style={styles.td}>{lineItem.description}</td>
                    <td style={styles.td}>{contractor?.contractor_name || "-"}</td>
                    <td style={styles.td}>Phase {phaseNumber}</td>
                    <td style={styles.tdRight}>{formatCurrency(expectedAmount)}</td>
                    <td style={styles.tdRight}>{formatCurrency(paidAmount)}</td>
                    <td style={styles.tdRight}>{formatCurrency(balance)}</td>
                    <td style={styles.td}><span style={getStatusStyle(status)}>{status}</span></td>
                    <td style={styles.tdRight}>
                      <input
                        style={styles.tableInputRightSmall}
                        type="number"
                        value={supplierPaidAmounts[key] || ""}
                        onChange={(e) =>
                          setSupplierPaidAmounts((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder="0.00"
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        style={styles.tableInputDate}
                        type="date"
                        value={supplierPaymentDates[key] || ""}
                        onChange={(e) =>
                          setSupplierPaymentDates((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                      />
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionStack}>
                        <input
                          style={styles.tableInputTiny}
                          value={supplierPaymentNotes[key] || ""}
                          onChange={(e) =>
                            setSupplierPaymentNotes((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder="Note"
                        />

                        <div style={styles.inlineActions}>
                          <button
                            style={styles.smallButton}
                            onClick={() => handleSaveSupplierPayment(lineItem, phase)}
                            disabled={savingSupplierPaymentKey === key}
                          >
                            {savingSupplierPaymentKey === key ? "Saving" : "Save"}
                          </button>

                          <label style={styles.smallUploadButton}>
                            {uploadingPopKey === key ? "Uploading" : "POP"}
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              style={{ display: "none" }}
                              onChange={async (e) => {
                                await handleUploadSupplierPop(lineItem, phase, e.target.files?.[0] || null);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>

                        {payments.length > 0 && (
                          <div style={styles.popList}>
                            {payments.map((payment) => (
                              <div key={payment.id} style={styles.popListRow}>
                                <span>
                                  {formatCurrency(Number(payment.paid_amount || 0))}
                                  {payment.payment_date ? ` · ${payment.payment_date}` : ""}
                                </span>
                                {payment.pop_file_path ? (
                                  <button
                                    style={styles.linkButton}
                                    onClick={() => handleOpenSupplierPop(payment.pop_file_path)}
                                  >
                                    View POP
                                  </button>
                                ) : (
                                  <span style={{ color: "#64748b" }}>No POP</span>
                                )}
                                <button
                                  style={styles.deleteMiniButton}
                                  onClick={() => handleDeleteSupplierPayment(payment.id)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}

{selectedProjectSection === "timeline" && (
  <section style={styles.card}>
    <h2 style={styles.cardTitle}>Timeline</h2>

    <div style={{ ...styles.card, marginBottom: "18px", boxShadow: "none" }}>
      <h3 style={{ ...styles.cardTitle, marginBottom: "16px" }}>Add Timeline Item</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1.8fr 1fr 1fr 1fr",
          gap: "14px",
          alignItems: "end",
        }}
      >
        <div>
          <label style={styles.label}>Supplier / Contractor</label>
          <select
            style={{ ...styles.input, width: "100%" }}
            value={timelineContractorId}
            onChange={(e) => setTimelineContractorId(e.target.value)}
          >
            <option value="">No supplier / contractor selected</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.contractor_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={styles.label}>Task / Scope</label>
          <input
            style={{ ...styles.input, width: "100%" }}
            value={timelineTitle}
            onChange={(e) => setTimelineTitle(e.target.value)}
            placeholder="Example: Installation of HVAC system"
          />
        </div>

        <div>
          <label style={styles.label}>Start Date</label>
          <input
            type="date"
            style={{ ...styles.input, width: "100%" }}
            value={timelineStartDate}
            onChange={(e) => setTimelineStartDate(e.target.value)}
          />
        </div>

        <div>
          <label style={styles.label}>End Date</label>
          <input
            type="date"
            style={{ ...styles.input, width: "100%" }}
            value={timelineEndDate}
            onChange={(e) => setTimelineEndDate(e.target.value)}
          />
        </div>

        <div>
          <label style={styles.label}>Status</label>
          <select
            style={{ ...styles.input, width: "100%" }}
            value={timelineStatus}
            onChange={(e) => setTimelineStatus(e.target.value)}
          >
            <option value="Planned">Planned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Delayed">Delayed</option>
          </select>
        </div>

        <div style={{ gridColumn: "1 / 5" }}>
          <label style={styles.label}>Description</label>
          <input
            style={{ ...styles.input, width: "100%" }}
            value={timelineDescription}
            onChange={(e) => setTimelineDescription(e.target.value)}
            placeholder="Optional notes"
          />
        </div>

     <button
  style={{ ...styles.primaryButton, width: "100%" }}
  onClick={editingTimelineItemId ? handleUpdateTimelineItem : handleAddTimelineItem}
  disabled={savingTimelineItem}
>
  {savingTimelineItem
    ? "Saving..."
    : editingTimelineItemId
      ? "Update Timeline Item"
      : "Add Timeline Item"}
</button>
      </div>
    </div>

    {loadingTimelineItems ? (
      <div style={styles.emptyState}>Loading timeline...</div>
    ) : timelineItems.length === 0 ? (
      <div style={styles.emptyState}>No timeline items added yet.</div>
    ) : (
    <div style={{ overflowX: "auto", border: "1px solid #d8e2ef", borderRadius: "12px" }}>
  <table
    style={{
      ...styles.table,
      minWidth: `${320 + getTimelineDateRange().length * 34}px`,
    }}
  >
    <thead>
      <tr>
        <th style={{ ...styles.th, minWidth: "180px" }}>Supplier / Contractor</th>
        <th style={{ ...styles.th, minWidth: "180px" }}>Task / Scope</th>
<th style={{ ...styles.th, minWidth: "180px" }}>Dates</th>

        {getTimelineDateRange().map((date) => (
          <th
            key={date}
            style={{
              ...styles.th,
              minWidth: "34px",
              textAlign: "center",
              fontSize: "12px",
            }}
          >
            {new Date(`${date}-01`).toLocaleDateString("en-ZA", {
  month: "short",
  year: "numeric",
})} 
          </th>
        ))}

        <th style={{ ...styles.th, minWidth: "140px" }}>Status</th>
        <th style={styles.th}>Actions</th>
      </tr>
    </thead>

    <tbody>
      {timelineItems.map((item) => (
        <tr key={item.id}>
          <td style={styles.td}>
            {item.project_contractors?.contractor_name || "-"}
          </td>

  <td style={styles.td}>
  <span style={{ fontWeight: 700 }}>{item.title}</span>
</td>

<td style={styles.td}>
  <span style={{ fontSize: "12px", color: "#64748b" }}>
    {item.start_date || "-"} to {item.end_date || "-"}
  </span>
</td>

          {getTimelineDateRange().map((date) => (
            <td
              key={`${item.id}-${date}`}
              style={{
                ...styles.td,
                padding: "6px",
                textAlign: "center",
                background: isDateWithinTimelineItem(date, item) ? "#ffe94d" : "#ffffff",
                borderLeft: "1px solid #e5edf6",
                borderRight: "1px solid #e5edf6",
              }}
            >
              &nbsp;
            </td>
          ))}

          <td style={styles.td}>
            <select
              style={styles.input}
              value={item.status}
              onChange={(e) => handleUpdateTimelineStatus(item.id, e.target.value)}
            >
              <option value="Planned">Planned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
            </select>
          </td>
          <td style={styles.td}>
  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
    <button
      style={{
        background: "#e8f2ff",
        color: "#0f548c",
        border: "1px solid #b7d8ff",
        padding: "8px 12px",
        borderRadius: "8px",
        fontWeight: 700,
        cursor: "pointer",
      }}
      onClick={() => handleEditTimelineItem(item)}
    >
      Edit
    </button>

    <button
      style={{
        background: "#fff1f1",
        color: "#b42318",
        border: "1px solid #ffc9c9",
        padding: "8px 12px",  
        borderRadius: "8px",
        fontWeight: 700,
        cursor: "pointer",
      }}
      onClick={() => handleDeleteTimelineItem(item.id)}
    >
      Delete
    </button>
  </div>
</td>
           </tr>
      ))}
    </tbody>
  </table>
</div>
    )}
  </section>
)}

{selectedProjectSection === "contractors" && (
  <section style={styles.card}>
    <h2 style={styles.cardTitle}>Suppliers / Contractors</h2>

<div style={{ ...styles.card, marginBottom: "18px", boxShadow: "none" }}>
  <h3 style={{ ...styles.cardTitle, marginBottom: "16px" }}>Add Supplier / Contractor</h3>

  <div style={{ marginBottom: "16px" }}>
  <label style={styles.importButton}>
    {importingContractors ? "Importing..." : "Import Suppliers / Contractors from Excel"}
    <input
      type="file"
      accept=".xlsx,.xls,.csv"
      style={{ display: "none" }}
      onChange={async (e) => {
  await handleImportContractors(e.target.files?.[0] || null);
  e.currentTarget.value = "";
}}
      disabled={importingContractors}
    />
  </label>
</div>


  <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "14px",
    alignItems: "end",
  }}
>
  <div>
    <label style={styles.label}>Supplier / Contractor Name</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorName}
      onChange={(e) => setNewContractorName(e.target.value)}
      placeholder="Supplier / Contractor Name "
    />
  </div>

  <div>
    <label style={styles.label}>Address</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorAddress}
      onChange={(e) => setNewContractorAddress(e.target.value)}
      placeholder="Supplier / contractor address"
    />
  </div>

  <div>
    <label style={styles.label}>Services/Scope</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorTrade}
      onChange={(e) => setNewContractorTrade(e.target.value)}
      placeholder="Service/Scope"
    />
  </div>

  <div>
    <label style={styles.label}>Contact Person</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorContact}
      onChange={(e) => setNewContractorContact(e.target.value)}
      placeholder="Example: John"
    />
  </div>

  <div>
    <label style={styles.label}>Email</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorEmail}
      onChange={(e) => setNewContractorEmail(e.target.value)}
      placeholder="example@email.com"
    />
  </div>

  <div>
    <label style={styles.label}>Phone</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorPhone}
      onChange={(e) => setNewContractorPhone(e.target.value)}
      placeholder="012 345 6789"
    />
  </div>

  <div>
    <label style={styles.label}>VAT Number</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorVatNumber}
      onChange={(e) => setNewContractorVatNumber(e.target.value)}
      placeholder="Example: 4123456789"
    />
  </div>

  <div>
    <label style={styles.label}>Bank Details</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorBankDetails}
      onChange={(e) => setNewContractorBankDetails(e.target.value)}
      placeholder="Bank, branch, account number"
    />
  </div>

  <div>
    <label style={styles.label}>Payment Terms</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorPaymentTerms}
      onChange={(e) => setNewContractorPaymentTerms(e.target.value)}
      placeholder="Example: 30 days"
    />
  </div>

  <div />
<button
  style={{ ...styles.primaryButton, width: "100%" }}
  onClick={editingContractorId ? handleUpdateContractor : handleAddContractor}
  disabled={savingContractor || savingEditedContractor}
>
  {editingContractorId
    ? savingEditedContractor
      ? "Saving..."
      : "Update Contractor"
    : savingContractor
      ? "Saving..."
      : "Add Supplier / Contractor"}
</button>

</div>
</div>

    {contractors.length === 0 ? (
      <div style={styles.emptyState}>No contractors added yet.</div>
    ) : (
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Supplier / Contractor</th>
            <th style={styles.th}>Address</th>
            <th style={styles.th}>Serivces/Scope</th>
            <th style={styles.th}>Contact Person</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Phone</th>
            <th style={styles.th}>VAT Number</th>
            <th style={styles.th}>Bank Details</th>
            <th style={styles.th}>Payment Terms</th>
            <th style={styles.thRight}>Quote Value</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {contractors.map((contractor) => (
            <tr key={contractor.id}>
            <td style={styles.td}>{contractor.contractor_name}</td>
            <td style={styles.td}>{contractor.address || "-"}</td>
            <td style={styles.td}>{contractor.trade_category || "-"}</td>
            <td style={styles.td}>{contractor.contact_person || "-"}</td>
            <td style={styles.td}>{contractor.email || "-"}</td>
            <td style={styles.td}>{contractor.phone || "-"}</td>
            <td style={styles.td}>{contractor.vat_number || "-"}</td>
            <td style={styles.td}>{contractor.bank_details || "-"}</td>
            <td style={styles.td}>{contractor.payment_terms || "-"}</td>
<td style={styles.tdRight}>
  {formatCurrency(getContractorQuoteValue(contractor.id))}
</td>

 <td style={styles.td}>
  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
    <button
      style={{
  background: "#e8f2ff",
  color: "#0f548c",
  border: "1px solid #b7d8ff",
  padding: "8px 12px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
}}
      onClick={() => handleEditContractor(contractor)}
    >
      Edit
    </button>

    <button
   style={{
  background: "#fff1f1",
  color: "#b42318",
  border: "1px solid #ffc9c9",
  padding: "8px 12px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
}}
      onClick={() => handleDeleteContractor(contractor.id)}
    >
      Delete
    </button>
  </div>
</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>
)}

      {selectedProjectSection === "export" && (
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Reports / Export</h2>

          <div style={styles.reportGrid}>
            <div style={styles.reportTile}>
              <h3 style={styles.reportTileTitle}>Full Project Control Pack</h3>
              <p style={styles.reportTileText}>Complete control pack: overview, client income, receipts, supplier budget and supplier schedule.</p>
              <div style={styles.inlineActions}>
                <button style={styles.printButton} onClick={() => printSection("print-full-pack")}>Print</button>
                <button style={styles.pdfButton} onClick={() => exportPdfSection("print-full-pack")}>PDF</button>
              </div>
            </div>

            <div style={styles.reportTile}>
              <h3 style={styles.reportTileTitle}>Client Income & Receipts</h3>
              <p style={styles.reportTileText}>Payment split, invoices raised, receipts captured and balances still outstanding.</p>
              <div style={styles.inlineActions}>
                <button style={styles.printButton} onClick={() => printSection("print-invoices-payments")}>Print</button>
                <button style={styles.pdfButton} onClick={() => exportPdfSection("print-invoices-payments")}>PDF</button>
              </div>
            </div>

            <div style={styles.reportTile}>
              <h3 style={styles.reportTileTitle}>Supplier Budget</h3>
              <p style={styles.reportTileText}>Supplier/contractor budget lines, quote files, VAT treatment and totals.</p>
              <div style={styles.inlineActions}>
                <button style={styles.printButton} onClick={() => printSection("print-quote-summary")}>Print</button>
                <button style={styles.pdfButton} onClick={() => exportPdfSection("print-quote-summary")}>PDF</button>
              </div>
            </div>

            <div style={styles.reportTile}>
              <h3 style={styles.reportTileTitle}>Supplier Payment Schedule</h3>
              <p style={styles.reportTileText}>Expected supplier payments per phase, with paid status ticks.</p>
              <div style={styles.inlineActions}>
                <button style={styles.printButton} onClick={() => printSection("print-phase-schedule")}>Print</button>
                <button style={styles.pdfButton} onClick={() => exportPdfSection("print-phase-schedule")}>PDF</button>
              </div>
            </div>

            <div style={styles.reportTile}>
              <h3 style={styles.reportTileTitle}>Supplier Payments & POPs</h3>
              <p style={styles.reportTileText}>Actual supplier payments, POP references and supplier outstanding balances.</p>
              <div style={styles.inlineActions}>
                <button style={styles.printButton} onClick={() => setSelectedProjectSection("supplier-payments")}>Open</button>
                <button style={styles.printButton} onClick={printSupplierPaymentsReport}>Print</button>
                <button style={styles.pdfButton} onClick={exportSupplierPaymentsReportPdf}>PDF</button>
              </div>
            </div>

            <div style={styles.reportTile}>
              <h3 style={styles.reportTileTitle}>Cashflow Control</h3>
              <p style={styles.reportTileText}>Client receipts less supplier payments, current cash position and remaining exposure.</p>
              <div style={styles.inlineActions}>
                <button style={styles.printButton} onClick={() => setSelectedProjectSection("cashflow-control")}>Open</button>
                <button style={styles.printButton} onClick={printCashflowControlReport}>Print</button>
                <button style={styles.pdfButton} onClick={exportCashflowControlReportPdf}>PDF</button>
              </div>
            </div>

            <div style={styles.reportTile}>
              <h3 style={styles.reportTileTitle}>Exception Report</h3>
              <p style={styles.reportTileText}>Unpaid supplier phases, overdue client receipts, overpaid items and phase differences.</p>
              <div style={styles.inlineActions}>
                <button style={styles.printButton} onClick={() => setSelectedProjectSection("exception-report")}>Open</button>
                <button style={styles.printButton} onClick={printExceptionReport}>Print</button>
                <button style={styles.pdfButton} onClick={exportExceptionReportPdf}>PDF</button>
              </div>
            </div>
          </div>

          <div style={styles.exportNote}>
            Supplier POPs can be printed/exported from the Supplier Payments & POPs report. Individual POP files remain linked to the exact supplier phase payment row.
          </div>
        </section>
      )}
      

{selectedProjectSection === "supplier-budget" && canEditProjectDetails && (
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>
          {editingLineItemId ? "Edit Supplier Budget Line" : "Supplier Budget / Quotes"}
        </h2>

        <div style={{ marginBottom: "16px" }}>
  <label style={styles.importButton}>
    {importingLineItems ? "Importing..." : "Import Line Items from Excel"}
    <input
      type="file"
      accept=".xlsx,.xls,.csv"
      style={{ display: "none" }}
      onChange={async (e) => {
        await handleImportLineItems(e.target.files?.[0] || null);
        e.currentTarget.value = "";
      }}
      disabled={importingLineItems}
    />
  </label>
</div>

<div style={{ marginBottom: "16px" }}>
  <button
    style={{
      background: "#fff1f1",
      color: "#b42318",
      border: "1px solid #ffc9c9",
      padding: "10px 14px",
      borderRadius: "10px",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
    }}
    onClick={handleDeleteAllLineItems}
  >
    Delete All Line Items
  </button>
</div>

        <div style={styles.formGrid}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Description</label>
            <input
              style={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: Wetworks"
            />
          </div>

          <div style={styles.fieldGroup}>
  <label style={styles.label}>Supplier / Contractor</label>
  <select
    style={styles.input}
    value={contractorId}
    onChange={(e) => setContractorId(e.target.value)}
  >
    <option value="">No supplier / contractor selected</option>
    {contractors.map((contractor) => (
      <option key={contractor.id} value={contractor.id}>
        {contractor.contractor_name}
        {contractor.trade_category ? ` - ${contractor.trade_category}` : ""}
      </option>
    ))}
  </select>
</div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Amount</label>
            <input
              style={styles.input}
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Example: 1000000"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>VAT Mode</label>
            <select
              style={styles.input}
              value={vatMode}
              onChange={(e) => setVatMode(e.target.value as VatMode)}
            >
              <option value="Exclusive">VAT Exclusive</option>
              <option value="Inclusive">VAT Inclusive</option>
            </select>
          </div>
        </div>

        {project && (
          <div
            style={{
              ...styles.phaseGrid,
              gridTemplateColumns: `repeat(${project.number_of_phases}, 1fr) 170px`,
            }}
          >
            {phaseNumbers.map((phaseNumber, index) => (
              <div key={phaseNumber} style={styles.fieldGroup}>
                <label style={styles.label}>Phase {phaseNumber} %</label>
                <input
                  style={styles.input}
                  type="number"
                  value={phasePercentages[index] || ""}
                  onChange={(e) => updatePhasePercentage(index, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}

            <div style={styles.buttonHolder}>
              <button style={styles.primaryButton} onClick={handleSaveLineItem} disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingLineItemId
                  ? "Update Line Item"
                  : "Add Line Item"}
              </button>
            </div>
          </div>
        )}

        {editingLineItemId && (
          <div style={styles.cancelEditRow}>
            <button style={styles.secondaryButton} onClick={resetForm}>
              Cancel Edit
            </button>
          </div>
        )}
      </section>
)}

      <div id="print-full-pack" style={selectedProjectSection === "export" ? styles.hiddenPrintSource : undefined}>
        <div style={styles.printHeader}>
          <h1>{project?.name || "Project"}</h1>
          <p>Project Control Pack · Supplier Budget, Supplier Payment Schedule and Client Invoices</p>
        </div>

        {(selectedProjectSection === "supplier-budget" || selectedProjectSection === "export") && showQuoteSummary && (
  <div id="print-quote-summary">
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Supplier Budget Summary</h2>

            {loadingLineItems ? (
              <div style={styles.emptyState}>Loading line items...</div>
            ) : lineItems.length === 0 ? (
              <div style={styles.emptyState}>No line items added yet.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Quote</th>
                    <th style={styles.th}>Supplier / Contractor</th>
                    <th style={styles.thRight}>VAT Mode</th>
                    <th style={styles.thRight}>Excl. VAT</th>
                    <th style={styles.thRight}>VAT</th>
                    <th style={styles.thRight}>Incl. VAT</th>
                    {canEditProjectDetails && (
  <th style={styles.thRight} className="screen-only">
    Actions
  </th>
)}
                  </tr>
                </thead>

                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.description}</td>
                      <td style={styles.td}>
  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
    {canEditProjectDetails && (
      <label
        style={{
          background: "#eef3f8",
          color: "#12304a",
          border: "1px solid #d5dde6",
          borderRadius: "8px",
          padding: "6px 10px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          width: "fit-content",
        }}
      >
        {uploadingQuoteLineItemId === item.id ? "Uploading..." : "Upload Quote"}
        <input
          type="file"
          style={{ display: "none" }}
          onChange={(e) => handleUploadQuoteFile(item.id, e.target.files?.[0] || null)}
          disabled={uploadingQuoteLineItemId === item.id}
        />
      </label>
    )}

    {(item.quoteFiles || []).length === 0 && !item.quoteFilePath && (
      <span style={{ fontSize: "12px", color: "#7a8794" }}>No quotes uploaded</span>
    )}

    {(item.quoteFiles || []).map((quoteFile, index) => (
      <div
        key={quoteFile.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          fontSize: "12px",
        }}
      >
        <button
          type="button"
          style={{
            background: "transparent",
            color: "#0b5cab",
            border: "none",
            padding: 0,
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            textDecoration: "underline",
          }}
          onClick={() => handleOpenQuoteFile(quoteFile.file_path)}
        >
          {quoteFile.file_name || `Quote ${index + 1}`}
        </button>

        {canEditProjectDetails && (
          <button
            type="button"
            style={{
              background: "transparent",
              color: "#9b1c1c",
              border: "none",
              padding: 0,
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={() => handleDeleteQuoteFile(quoteFile.id, quoteFile.file_path)}
          >
            Delete
          </button>
        )}
      </div>
    ))}

    {item.quoteFilePath && (
      <button
        type="button"
        style={{
          background: "transparent",
          color: "#0b5cab",
          border: "none",
          padding: 0,
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          textDecoration: "underline",
          width: "fit-content",
        }}
        onClick={() => handleOpenQuoteFile(item.quoteFilePath)}
      >
        {item.quoteFileName || "View quote"}
      </button>
    )}
  </div>
</td>
                      <td style={styles.td}>
  {contractors.find((contractor) => contractor.id === item.contractorId)?.contractor_name || "-"}
</td>
                      <td style={styles.tdRight}>{item.vatMode}</td>
                      <td style={styles.tdRight}>{formatCurrency(calculateExcludingVat(item))}</td>
                      <td style={styles.tdRight}>{formatCurrency(calculateVat(item))}</td>
                      <td style={styles.tdRight}>{formatCurrency(calculateTotal(item))}</td>
                  {canEditProjectDetails && (
  <td style={styles.tdRight} className="screen-only">
    <button style={styles.smallButton} onClick={() => handleEditLineItem(item)}>
      Edit
    </button>

    <button
      style={styles.dangerButton}
      onClick={() => handleDeleteLineItem(item.id)}
    >
      Delete
    </button>
  </td>
)}
                    </tr>
                  ))}
                </tbody>

<tfoot>
  
  <tr>
    <td style={styles.totalCell} colSpan={4}>
      Total
    </td>

    <td style={styles.totalCellRight}>
      {formatCurrency(totalExcludingVat)}
    </td>

    <td style={styles.totalCellRight}>
      {formatCurrency(totalVat)}
    </td>

    <td style={styles.totalCellRight}>
      {formatCurrency(totalIncludingVat)}
    </td>

    {canEditProjectDetails && <td style={styles.totalCell}></td>}
  </tr>
</tfoot>
              </table>
            )}
          </section>
        </div>
        )}



        {(selectedProjectSection === "supplier-schedule" || selectedProjectSection === "export") && showPhaseSchedule && (
            <div id="print-phase-schedule">
          {lineItems.length > 0 && (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Supplier Payment Schedule</h2>

              <div style={styles.scheduleHintBar}>
                Use <strong>Edit split</strong> to change the Rand amounts for a supplier line. The main schedule stays clean and easy to read.
              </div>

              <table style={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th style={styles.scheduleThDescription}>Supplier Line</th>
                    {phaseNumbers.map((phaseNumber) => (
                      <th key={phaseNumber} style={styles.scheduleThPhase}>Phase {phaseNumber}</th>
                    ))}
                    <th style={styles.scheduleThAmount}>Total</th>
                    <th style={styles.scheduleThAmount}>Diff</th>
                    <th style={styles.scheduleThAction}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {lineItems.map((item) => {
                    const rowDifference = getPhaseBillingLineDifference(item);

                    return (
                      <tr key={item.id}>
                        <td style={styles.scheduleTdDescription}>
                          <strong>{item.description}</strong>
                          {Math.abs(rowDifference) >= 0.01 ? (
                            <div style={styles.scheduleDifferenceNote}>Difference: {formatCurrency(rowDifference)}</div>
                          ) : null}
                        </td>

                        {phaseNumbers.map((phaseNumber) => {
                          const phase = item.phases.find((phaseItem) => phaseItem.phaseNumber === phaseNumber);
                          const displayAmount = getPhaseDisplayAmount(item, phaseNumber);
                          const displayPercentage = getPhaseDisplayPercentage(item, phaseNumber);
                          const isChangedOverride =
                            phase?.overrideAmount !== null &&
                            phase?.overrideAmount !== undefined &&
                            Math.abs((phase.overrideAmount || 0) - (phase.calculatedAmount || 0)) >= 0.01;
                          const paidAmount = getSupplierPaidForLineItemPhase(item.id, phaseNumber);
                          const paymentStatus = getSupplierPaymentStatus(displayAmount, paidAmount);
                          const statusSymbol = getSupplierPaymentStatusSymbol(paymentStatus, displayAmount);

                          return (
                            <td key={phaseNumber} style={styles.scheduleTdPhase}>
                              <div style={styles.phaseViewBox}>
                                <div style={styles.phaseViewTopLine}>
                                  <span>{formatInputNumber(displayPercentage, 2)}%</span>
                                  {statusSymbol ? (
                                    <span title={paymentStatus} style={getSupplierPaymentStatusSymbolStyle(paymentStatus)}>
                                      {statusSymbol}
                                    </span>
                                  ) : null}
                                </div>
                                <div style={styles.phaseViewAmount}>{formatCurrency(displayAmount)}</div>
                                {isChangedOverride ? <div style={styles.phaseManualNote}>Manual</div> : null}
                              </div>
                            </td>
                          );
                        })}

                        <td style={styles.scheduleTdAmount}>{formatCurrency(getPhaseBillingLineTotal(item))}</td>
                        <td style={styles.scheduleTdAmount}>{formatCurrency(rowDifference)}</td>
                        <td style={styles.scheduleTdAction}>
                          <button style={styles.editRowButton} onClick={() => handleOpenPhaseOverride(item)}>
                            Edit split
                          </button>

                          {Math.abs(rowDifference) >= 0.01 && (
                            <button style={styles.smallFixButton} onClick={() => handleSplitPhaseDifferenceEvenly(item)}>
                              Balance
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td style={styles.totalCell}>Total per Phase</td>
                    {phaseTotals.map((total, index) => (
                      <td key={index} style={styles.totalCellRight}>{formatCurrency(total)}</td>
                    ))}
                    <td style={styles.totalCellRight}>{formatCurrency(phaseTotals.reduce((total, value) => total + value, 0))}</td>
                    <td style={styles.totalCellRight}></td>
                    <td style={styles.totalCell}></td>
                  </tr>
                </tfoot>
              </table>
            </section>
          )}
        </div>
      )}

      </div>

      {(selectedProjectSection === "client-invoices" || selectedProjectSection === "export") && canEditProjectDetails && showInvoicesPayments && (
        <div id="print-invoices-payments" style={selectedProjectSection === "export" ? styles.hiddenPrintSource : undefined}>
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Client Invoices & Receipts</h2>

            {loadingInvoices ? (
              <div style={styles.emptyState}>Loading invoices...</div>
            ) : (
              <div style={styles.tableWrapNoScroll}>
                <table style={styles.clientInvoiceTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Pay</th>
                      <th style={styles.thRight}>Expected</th>
                      <th style={styles.th}>Inv No.</th>
                      <th style={styles.th}>Inv Date</th>
                      <th style={styles.thRight}>Inv Amt</th>
                      <th style={styles.thRight}>Paid</th>
                      <th style={styles.th}>Paid Date</th>
                      <th style={styles.thRight}>Outstanding</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.thRight} className="screen-only">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {clientPaymentNumbers.map((phaseNumber) => {
                      const expectedAmount = getExpectedClientPaymentAmount(phaseNumber);
                      const existingInvoice = getInvoiceForPhase(phaseNumber);

                      const enteredInvoiceAmount =
                        invoiceAmounts[phaseNumber] === "" || invoiceAmounts[phaseNumber] === undefined
                          ? null
                          : Number(invoiceAmounts[phaseNumber]);

                      const enteredPaidAmount =
                        paidAmounts[phaseNumber] === "" || paidAmounts[phaseNumber] === undefined
                          ? null
                          : Number(paidAmounts[phaseNumber]);

                      const outstanding =
                        enteredInvoiceAmount === null
                          ? null
                          : enteredInvoiceAmount - Number(enteredPaidAmount || 0);

                      const hasOverdueOutstanding =
                        outstanding !== null &&
                        outstanding > 0 &&
                        isOlderThan30Days(invoiceDates[phaseNumber] || null);

                      const displayStatus = existingInvoice?.status || "Not Invoiced";

                      return (
                        <tr key={phaseNumber}>
                          <td style={styles.td}>P{phaseNumber}</td>
                          <td style={styles.tdRight}>{formatCurrency(expectedAmount)}</td>

                          <td style={styles.td}>
                            <input
                              style={styles.tableInputTiny}
                              disabled={!canEditProjectDetails}
                              value={invoiceNumbers[phaseNumber] || ""}
                              onChange={(e) =>
                                setInvoiceNumbers((prev) => ({ ...prev, [phaseNumber]: e.target.value }))
                              }
                              placeholder="No."
                            />
                          </td>

                          <td style={styles.td}>
                            <input
                              style={styles.tableInputDate}
                              type="date"
                              value={invoiceDates[phaseNumber] || ""}
                              onChange={(e) =>
                                setInvoiceDates((prev) => ({ ...prev, [phaseNumber]: e.target.value }))
                              }
                            />
                          </td>

                          <td style={styles.tdRight}>
                            <input
                              style={styles.tableInputRightSmall}
                              type="number"
                              value={invoiceAmounts[phaseNumber] || ""}
                              onChange={(e) =>
                                setInvoiceAmounts((prev) => ({ ...prev, [phaseNumber]: e.target.value }))
                              }
                              placeholder="0.00"
                            />
                          </td>

                          <td style={styles.tdRight}>
                            <input
                              style={styles.tableInputRightSmall}
                              type="number"
                              value={paidAmounts[phaseNumber] || ""}
                              onChange={(e) =>
                                setPaidAmounts((prev) => ({ ...prev, [phaseNumber]: e.target.value }))
                              }
                              placeholder="0.00"
                            />
                          </td>

                          <td style={styles.td}>
                            <input
                              style={styles.tableInputDate}
                              type="date"
                              value={paymentDates[phaseNumber] || ""}
                              onChange={(e) =>
                                setPaymentDates((prev) => ({ ...prev, [phaseNumber]: e.target.value }))
                              }
                            />
                          </td>

                          <td style={styles.tdRight}>
                            {outstanding === null ? "-" : formatCurrency(outstanding)}
                            {hasOverdueOutstanding && <div style={styles.warningText}>⚠ 30+</div>}
                          </td>

                          <td style={styles.td}>
                            <span style={getStatusStyle(displayStatus)}>{displayStatus}</span>
                          </td>

                          {canEditProjectDetails && (
                            <td style={styles.tdRight} className="screen-only">
                              <button
                                style={styles.smallButton}
                                onClick={() => handleSaveInvoice(phaseNumber)}
                                disabled={savingInvoicePhase === phaseNumber}
                              >
                                {savingInvoicePhase === phaseNumber ? "Saving" : "Save"}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
      </div>
    </div>

{evenSplitLineItem && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        padding: "24px",
        width: "620px",
        maxWidth: "95vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          border: "1px solid #d5dde6",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "18px",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: "8px" }}>
          Split difference evenly
        </div>

        <div>
          This line is out by{" "}
          {formatCurrency(getPhaseBillingLineDifference(evenSplitLineItem))} /{" "}
          {getPhaseBillingLineDifferencePercentage(evenSplitLineItem).toFixed(6)}%
        </div>
      </div>

      <p style={{ marginTop: 0, color: "#64748b" }}>
        This will split the remaining difference evenly across all phases that are not manually overridden.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button
          style={styles.secondaryButton}
          onClick={() => setEvenSplitLineItem(null)}
        >
          Cancel
        </button>

        <button style={styles.primaryButton} onClick={handleApplyEvenSplit}>
          Split Evenly
        </button>
      </div>
    </div>
  </div>
)}

{manualSplitLineItem && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        padding: "24px",
        width: "1020px",
        maxWidth: "95vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          border: "1px solid #d5dde6",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "18px",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: "8px" }}>
          This line is out by {formatCurrency(getPhaseBillingLineDifference(manualSplitLineItem))} / {getPhaseBillingLineDifferencePercentage(manualSplitLineItem).toFixed(6)}% 
        </div>
        <div>Add the split below</div>
      </div>

      <div
  style={{
    background: "#f8fafc",
    border: "1px solid #d5dde6",
    borderRadius: "10px",
    padding: "10px 12px",
    marginTop: "14px",
    fontWeight: 800,
    color: "#12304a",
  }}
>
Remaining difference:{" "}
{formatCurrency(getManualSplitRemainingDifference(manualSplitLineItem))} /{" "}
{getManualSplitRemainingDifferencePercentage(manualSplitLineItem).toFixed(6)}%  
</div>

      <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
  <label style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "13px" }}>
    <input
      type="radio"
      checked={manualSplitMode === "amount"}
      onChange={() => setManualSplitMode("amount")}
    />
    Split by Amount
  </label>

  <label style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "13px" }}>
    <input
      type="radio"
      checked={manualSplitMode === "percentage"}
      onChange={() => setManualSplitMode("percentage")}
    />
    Split by %
  </label>
</div>

     <div
  style={{
    display: "grid",
    gridTemplateColumns: `repeat(${Math.min(phaseNumbers.length, 5)}, minmax(0, 1fr))`,
    gap: "10px",
    marginBottom: "20px",
  }}
>
  {phaseNumbers.map((phaseNumber) => (
    <div key={phaseNumber}>
      <label style={styles.label}>Phase {phaseNumber}</label>
      <input
        style={{
          ...styles.input,
          width: "100%",
          boxSizing: "border-box",
        }}
        placeholder={manualSplitMode === "percentage" ? "%" : "Amount"}
        value={manualSplitValues[phaseNumber] || ""}
        onChange={(e) =>
          setManualSplitValues((previous) => ({
            ...previous,
            [phaseNumber]: e.target.value,
          }))
        }
      />
    </div>
  ))}
</div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button
          style={styles.secondaryButton}
          onClick={() => {
            setManualSplitLineItem(null);
            setManualSplitValues({});
          }}
        >
          Cancel
        </button>

        <button style={styles.primaryButton} onClick={handleApplyManualSplit}>
          Apply Split
        </button>
      </div>
    </div>
  </div>
)}

{phaseOverrideLineItem && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        padding: "24px",
        width: "1020px",
        maxWidth: "95vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}
    >
      <h3 style={{ ...styles.cardTitle, marginBottom: "8px" }}>
        Override Phase Amounts
      </h3>

      <p style={{ marginTop: 0, marginBottom: "18px", color: "#64748b" }}>
        {phaseOverrideLineItem.description}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(phaseNumbers.length, 5)}, minmax(0, 1fr))`,
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        {phaseNumbers.map((phaseNumber) => (
          <div key={phaseNumber}>
            <label style={styles.label}>Phase {phaseNumber}</label>
            <input
              style={styles.input}
              value={phaseOverrideValues[phaseNumber] || ""}
              onChange={(e) =>
                setPhaseOverrideValues((previous) => ({
                  ...previous,
                  [phaseNumber]: e.target.value,
                }))
              }
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button
          style={styles.secondaryButton}
          onClick={() => {
            setPhaseOverrideLineItem(null);
            setPhaseOverrideValues({});
          }}
        >
          Cancel
        </button>

        <button style={styles.primaryButton} onClick={handleApplyPhaseOverride}>
          Save Overrides
        </button>
      </div>
    </div>
  </div>
)}


  </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  controlStrip: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
    padding: "10px 12px",
    marginBottom: "14px",
  },

  controlStripLabel: {
    fontSize: "12px",
    fontWeight: 900,
    color: "#12304a",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  controlStripHelp: {
    marginTop: "3px",
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 600,
  },

  controlStripActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  compactSelect: {
    height: "34px",
    minWidth: "150px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#12304a",
    padding: "0 8px",
    fontSize: "13px",
    fontWeight: 700,
  },

  primaryButtonSmall: {
    background: "#0f548c",
    color: "#ffffff",
    border: "1px solid #0f548c",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    padding: "8px 0 12px 0",
    borderBottom: "1px solid #cfd7e3",
    marginBottom: "12px",
  },
  title: {
    fontSize: "20px",
    lineHeight: 1.1,
    margin: "0 0 6px 0",
    color: "#10263f",
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: "#5b6775",
    fontSize: "12px",
    fontWeight: 600,
  },
  backButton: {
    background: "#eef3f8",
    color: "#12304a",
    border: "1px solid #c3cfdd",
    borderRadius: "0px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 800,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  printToolbar: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    background: "#f8fafc",
    borderRadius: "0px",
    padding: "8px",
    marginBottom: "10px",
    boxShadow: "none",
    border: "1px solid #cfd7e3",
  },
  toggleToolbar: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    background: "#f8fafc",
    borderRadius: "0px",
    padding: "8px",
    marginBottom: "10px",
    boxShadow: "none",
    border: "1px solid #cfd7e3",
  },
  toggleButton: {
    background: "#ffffff",
    color: "#12304a",
    border: "1px solid #c3cfdd",
    borderRadius: "0px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  toggleButtonActive: {
    background: "#12304a",
    color: "#ffffff",
    border: "1px solid #12304a",
    borderRadius: "0px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  printButton: {
    background: "#111827",
    color: "#ffffff",
    border: "1px solid #111827",
    borderRadius: "0px",
    padding: "8px 11px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  pdfButton: {
    background: "#0f548c",
    color: "#ffffff",
    border: "1px solid #0f548c",
    borderRadius: "0px",
    padding: "8px 11px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  printHeader: {
    display: "none",
  },
  card: {
    background: "#ffffff",
    borderRadius: "0px",
    padding: "14px",
    marginBottom: "12px",
    boxShadow: "none",
    border: "1px solid #cfd7e3",
    maxWidth: "100%",
    overflowX: "auto",
  },
  cardTitle: {
    fontSize: "16px",
    margin: "0 0 12px 0",
    color: "#10263f",
    fontWeight: 900,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 220px 180px",
    gap: "10px",
    alignItems: "end",
  },
  phaseGrid: {
    display: "grid",
    gap: "8px",
    alignItems: "end",
    marginTop: "10px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#34495e",
  },
  input: {
    height: "34px",
    borderRadius: "0px",
    border: "1px solid #c8d2df",
    padding: "0 9px",
    fontSize: "13px",
    outline: "none",
    background: "#ffffff",
  },
  tableInput: {
    height: "30px",
    borderRadius: "0px",
    border: "1px solid #c8d2df",
    padding: "0 8px",
    fontSize: "12px",
    outline: "none",
    background: "#ffffff",
    width: "120px",
  },
  tableInputRight: {
    height: "30px",
    borderRadius: "0px",
    border: "1px solid #c8d2df",
    padding: "0 8px",
    fontSize: "12px",
    outline: "none",
    background: "#ffffff",
    width: "120px",
    textAlign: "right",
  },
  tableInputRightWide: {
    height: "30px",
    borderRadius: "0px",
    border: "1px solid #c8d2df",
    padding: "0 8px",
    fontSize: "12px",
    outline: "none",
    background: "#ffffff",
    width: "170px",
    textAlign: "right",
  },
  buttonHolder: {
    display: "flex",
    justifyContent: "flex-end",
  },
  primaryButton: {
    background: "#0f548c",
    color: "#ffffff",
    border: "1px solid #0f548c",
    borderRadius: "0px",
    padding: "9px 10px",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
    width: "100%",
  },
  secondaryButton: {
    background: "#eef3f8",
    color: "#12304a",
    border: "1px solid #c3cfdd",
    borderRadius: "0px",
    padding: "8px 11px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  cancelEditRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "10px",
  },
  emptyState: {
    padding: "20px",
    textAlign: "center",
    color: "#667085",
    border: "1px dashed #b8c3d1",
    borderRadius: "0px",
    background: "#f8fafc",
    fontSize: "13px",
    fontWeight: 700,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "900px",
    background: "#ffffff",
  },
  th: {
    textAlign: "left",
    padding: "8px 9px",
    borderBottom: "1px solid #cfd7e3",
    background: "#f1f5f9",
    fontSize: "12px",
    color: "#26384f",
    whiteSpace: "nowrap",
    fontWeight: 900,
  },
  thRight: {
    textAlign: "right",
    padding: "8px 9px",
    borderBottom: "1px solid #cfd7e3",
    background: "#f1f5f9",
    fontSize: "12px",
    color: "#26384f",
    whiteSpace: "nowrap",
    fontWeight: 900,
  },
  td: {
    padding: "8px 9px",
    borderBottom: "1px solid #e5eaf0",
    fontSize: "12px",
    color: "#12304a",
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "8px 9px",
    borderBottom: "1px solid #e5eaf0",
    fontSize: "12px",
    color: "#12304a",
    textAlign: "right",
    verticalAlign: "middle",
    lineHeight: 1.45,
  },
  totalCell: {
    padding: "9px",
    fontWeight: 900,
    color: "#10263f",
    borderTop: "2px solid #26384f",
    background: "#f8fafc",
  },
  totalCellRight: {
    padding: "9px",
    fontWeight: 900,
    color: "#10263f",
    borderTop: "2px solid #26384f",
    background: "#f8fafc",
    textAlign: "right",
  },
  smallButton: {
    background: "#eef3f8",
    color: "#0f548c",
    border: "1px solid #b8c7d9",
    borderRadius: "0px",
    padding: "6px 8px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    marginRight: "6px",
  },
  dangerButton: {
    background: "#fff5f5",
    color: "#b42318",
    border: "1px solid #f5b5b5",
    borderRadius: "0px",
    padding: "6px 8px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  statusPill: {
    display: "inline-block",
    borderRadius: "0px",
    padding: "4px 7px",
    fontSize: "11px",
    fontWeight: 900,
  },
  statusMatched: {
    background: "#e8f8ee",
    color: "#137333",
    border: "1px solid #a6d8b5",
  },
  statusDifference: {
    background: "#fff4e5",
    color: "#b54708",
    border: "1px solid #f6c57f",
  },
  statusNotInvoiced: {
    background: "#eef3f8",
    color: "#5b6775",
    border: "1px solid #c3cfdd",
  },
  warningText: {
    color: "#b42318",
    fontSize: "11px",
    fontWeight: 900,
    marginTop: "3px",
  },
  leftSidebar: {
    background: "#101928",
    borderRight: "1px solid #1f2a3a",
    minHeight: "calc(100vh - 60px)",
  },
  sideMenuButton: {
    width: "100%",
    background: "transparent",
    color: "#d8e0eb",
    border: "none",
    borderRadius: "0px",
    padding: "9px 10px",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "left",
    borderLeft: "4px solid transparent",
  },
  sideMenuButtonActive: {
    width: "100%",
    background: "#ffffff",
    color: "#10263f",
    border: "none",
    borderRadius: "0px",
    padding: "9px 10px",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "left",
    borderLeft: "4px solid #0f548c",
  },
  summaryTile: {
    background: "#ffffff",
    border: "1px solid #cfd7e3",
    padding: "10px",
  },
  summaryLabel: {
    fontSize: "11px",
    fontWeight: 900,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "7px",
  },
  summaryValue: {
    fontSize: "17px",
    fontWeight: 900,
    color: "#10263f",
  },
  statusInfo: {
    display: "inline-block",
    padding: "4px 7px",
    background: "#eef6ff",
    border: "1px solid #b8d8f4",
    color: "#0f548c",
    fontSize: "11px",
    fontWeight: 900,
  },
  statusMuted: {
    display: "inline-block",
    padding: "4px 7px",
    background: "#f8fafc",
    border: "1px solid #d6dee8",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 900,
  },
  tfootTd: {
    padding: "9px",
    fontWeight: 900,
    color: "#10263f",
    borderTop: "2px solid #26384f",
    background: "#f8fafc",
  },
  importButton: {
    display: "inline-block",
    background: "#eef3f8",
    color: "#12304a",
    border: "1px solid #c3cfdd",
    borderRadius: "0px",
    padding: "8px 11px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  summaryGridFive: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "9px",
    marginBottom: "16px",
  },
  summaryGridFour: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "9px",
    marginBottom: "16px",
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    marginBottom: "16px",
  },
  subSectionTitle: {
    fontSize: "15px",
    fontWeight: 900,
    color: "#10263f",
    margin: "14px 0 8px 0",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #d8e2ef",
    background: "#ffffff",
  },
  tableWrapNoScroll: {
    overflowX: "hidden",
    border: "1px solid #d8e2ef",
    background: "#ffffff",
  },
  compactTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "0px",
    background: "#ffffff",
  },
  clientInvoiceTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "0px",
    tableLayout: "fixed",
    background: "#ffffff",
  },
  supplierPaymentTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1180px",
    background: "#ffffff",
  },
  filterBar: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr 120px",
    gap: "10px",
    alignItems: "end",
    marginBottom: "12px",
    padding: "10px",
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
  },
  stackedFilterPanel: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
    marginBottom: "12px",
    padding: "10px",
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
  },
  stackedFilterRow: {
    display: "grid",
    gridTemplateColumns: "180px minmax(260px, 520px)",
    gap: "10px",
    alignItems: "center",
  },
  filterLabelWide: {
    fontSize: "11px",
    fontWeight: 900,
    color: "#26384d",
    textAlign: "right",
  },
  filterControlWide: {
    width: "100%",
    border: "1px solid #c8d4e3",
    background: "#ffffff",
    padding: "7px 8px",
    fontSize: "12px",
    color: "#12304a",
    borderRadius: "0px",
  },
  stackedFilterActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginLeft: "190px",
    flexWrap: "wrap",
  },
  scheduleStatusPaid: {
    marginTop: "4px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    border: "1px solid #86efac",
    background: "#dcfce7",
    fontSize: "11px",
    fontWeight: 900,
    color: "#166534",
    lineHeight: 1,
  },
  scheduleStatusPart: {
    marginTop: "4px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    border: "1px solid #facc15",
    background: "#fef9c3",
    fontSize: "11px",
    fontWeight: 900,
    color: "#92400e",
    lineHeight: 1,
  },
  scheduleStatusUnpaid: {
    marginTop: "4px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontSize: "11px",
    fontWeight: 900,
    color: "#64748b",
    lineHeight: 1,
  },
  scheduleStatusOver: {
    marginTop: "4px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    border: "1px solid #fca5a5",
    background: "#fee2e2",
    fontSize: "11px",
    fontWeight: 900,
    color: "#b42318",
    lineHeight: 1,
  },
  tableInputTiny: {
    height: "28px",
    borderRadius: "0px",
    border: "1px solid #c8d2df",
    padding: "0 6px",
    fontSize: "11px",
    outline: "none",
    background: "#ffffff",
    width: "76px",
  },
  tableInputDate: {
    height: "28px",
    borderRadius: "0px",
    border: "1px solid #c8d2df",
    padding: "0 5px",
    fontSize: "11px",
    outline: "none",
    background: "#ffffff",
    width: "112px",
  },
  tableInputRightSmall: {
    height: "28px",
    borderRadius: "0px",
    border: "1px solid #c8d2df",
    padding: "0 6px",
    fontSize: "11px",
    outline: "none",
    background: "#ffffff",
    width: "96px",
    textAlign: "right",
  },
  actionStack: {
    display: "grid",
    gap: "5px",
  },
  inlineActions: {
    display: "flex",
    gap: "5px",
    alignItems: "center",
  },
  smallUploadButton: {
    display: "inline-block",
    background: "#eef3f8",
    color: "#0f548c",
    border: "1px solid #b8c7d9",
    borderRadius: "0px",
    padding: "6px 8px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  popList: {
    borderTop: "1px solid #e5eaf0",
    paddingTop: "5px",
    display: "grid",
    gap: "4px",
  },
  popListRow: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "11px",
    color: "#26384f",
  },
  linkButton: {
    background: "transparent",
    border: "none",
    color: "#0f548c",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },
  deleteMiniButton: {
    background: "#fff5f5",
    color: "#b42318",
    border: "1px solid #f5b5b5",
    borderRadius: "0px",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
    width: "20px",
    height: "20px",
    lineHeight: "16px",
  },
  statusOverpaid: {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #f6c57f",
  },

  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },

  reportGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
  },

  reportTile: {
    border: "1px solid #d8e2ef",
    background: "#ffffff",
    padding: "14px",
    minHeight: "145px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },

  reportTileTitle: {
    margin: "0 0 8px 0",
    fontSize: "15px",
    fontWeight: 900,
    color: "#12304a",
  },

  reportTileText: {
    margin: "0 0 14px 0",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#52616f",
  },

  exportNote: {
    marginTop: "14px",
    padding: "10px 12px",
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
    color: "#52616f",
    fontSize: "12px",
    fontWeight: 700,
  },

  inlinePhaseEditGrid: {
    display: "grid",
    gridTemplateColumns: "54px 14px 92px",
    gap: "4px",
    alignItems: "center",
    justifyContent: "end",
  },

  inlinePhasePercentInput: {
    width: "54px",
    height: "28px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#12304a",
    padding: "4px 5px",
    fontSize: "12px",
    textAlign: "right",
  },

  inlinePhaseSuffix: {
    fontSize: "11px",
    color: "#64748b",
    fontWeight: 800,
  },

  inlinePhaseAmountInput: {
    width: "92px",
    height: "28px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#12304a",
    padding: "4px 5px",
    fontSize: "12px",
    textAlign: "right",
  },

  inlinePhaseChangedInput: {
    background: "#fff7e6",
    border: "1px solid #f5c76b",
    fontWeight: 800,
  },

  inlinePhaseOverrideNote: {
    marginTop: "3px",
    fontSize: "10px",
    fontWeight: 900,
    color: "#92400e",
    textAlign: "right",
    textTransform: "uppercase",
  },


  scheduleHintBar: {
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
    color: "#52616f",
    fontSize: "12px",
    padding: "8px 10px",
    marginBottom: "10px",
  },

  scheduleTable: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "12px",
  },

  scheduleThDescription: {
    background: "#eef3f8",
    color: "#12304a",
    borderBottom: "1px solid #d8e2ef",
    padding: "8px",
    textAlign: "left",
    fontWeight: 900,
    width: "210px",
  },

  scheduleThPhase: {
    background: "#eef3f8",
    color: "#12304a",
    borderBottom: "1px solid #d8e2ef",
    padding: "8px",
    textAlign: "center",
    fontWeight: 900,
  },

  scheduleThAmount: {
    background: "#eef3f8",
    color: "#12304a",
    borderBottom: "1px solid #d8e2ef",
    padding: "8px",
    textAlign: "right",
    fontWeight: 900,
    width: "115px",
  },

  scheduleThAction: {
    background: "#eef3f8",
    color: "#12304a",
    borderBottom: "1px solid #d8e2ef",
    padding: "8px",
    textAlign: "center",
    fontWeight: 900,
    width: "100px",
  },

  scheduleTdDescription: {
    borderBottom: "1px solid #e5edf6",
    padding: "9px 8px",
    color: "#12304a",
    verticalAlign: "middle",
  },

  scheduleDifferenceNote: {
    marginTop: "4px",
    fontSize: "10px",
    color: "#b42318",
    fontWeight: 800,
  },

  scheduleTdPhase: {
    borderBottom: "1px solid #e5edf6",
    padding: "7px 6px",
    color: "#12304a",
    verticalAlign: "middle",
    textAlign: "right",
  },

  scheduleTdAmount: {
    borderBottom: "1px solid #e5edf6",
    padding: "9px 8px",
    color: "#12304a",
    verticalAlign: "middle",
    textAlign: "right",
    fontWeight: 800,
  },

  scheduleTdAction: {
    borderBottom: "1px solid #e5edf6",
    padding: "9px 8px",
    color: "#12304a",
    verticalAlign: "middle",
    textAlign: "center",
  },

  phaseViewBox: {
    minHeight: "42px",
  },

  phaseViewTopLine: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    color: "#52616f",
    fontWeight: 800,
  },

  phaseViewAmount: {
    marginTop: "3px",
    fontSize: "12px",
    fontWeight: 900,
    color: "#12304a",
  },

  phaseManualNote: {
    marginTop: "2px",
    fontSize: "9px",
    fontWeight: 900,
    color: "#92400e",
    textTransform: "uppercase",
  },

  phaseTickPaid: {
    color: "#047857",
    fontWeight: 900,
    fontSize: "13px",
  },

  phaseTickPart: {
    color: "#b45309",
    fontWeight: 900,
    fontSize: "13px",
  },

  phaseTickUnpaid: {
    color: "#94a3b8",
    fontWeight: 900,
    fontSize: "12px",
  },

  phaseTickOver: {
    color: "#b42318",
    fontWeight: 900,
    fontSize: "13px",
  },

  phaseEditBox: {
    display: "grid",
    gap: "4px",
  },

  phaseEditLine: {
    display: "grid",
    gridTemplateColumns: "1fr 12px",
    gap: "3px",
    alignItems: "center",
  },

  phaseEditPercentInput: {
    width: "100%",
    height: "25px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#12304a",
    padding: "3px 5px",
    fontSize: "11px",
    textAlign: "right",
  },

  phaseEditSuffix: {
    fontSize: "10px",
    color: "#64748b",
    fontWeight: 900,
  },

  phaseEditAmountInput: {
    width: "100%",
    height: "25px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#12304a",
    padding: "3px 5px",
    fontSize: "11px",
    textAlign: "right",
  },

  phaseEditAmountChanged: {
    background: "#fff7e6",
    border: "1px solid #f5c76b",
    fontWeight: 800,
  },

  editRowButton: {
    background: "#eef3f8",
    color: "#12304a",
    border: "1px solid #cbd5e1",
    padding: "5px 7px",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
    width: "72px",
    marginBottom: "4px",
  },

  doneRowButton: {
    background: "#0f548c",
    color: "#ffffff",
    border: "1px solid #0f548c",
    padding: "5px 7px",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
    width: "72px",
    marginBottom: "4px",
  },

  smallFixButton: {
    background: "#fff7e6",
    color: "#92400e",
    border: "1px solid #f5c76b",
    padding: "4px 7px",
    fontSize: "10px",
    fontWeight: 900,
    cursor: "pointer",
    width: "72px",
  },

  hiddenPrintSource: {
    position: "absolute",
    left: "-10000px",
    top: 0,
    width: "1px",
    height: "1px",
    overflow: "hidden",
  },
};
