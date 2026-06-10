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

type Project = {
  id: string;
  name: string;
  number_of_phases: number;
  status: string;
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

type LineItem = {
  id: string;
  description: string;
  amount: number;
  vatMode: VatMode;
  contractorId: string | null;
  quoteFilePath: string | null;
  quoteFileName: string | null;
  phases: PhaseSplit[];
};

type ApiLineItem = {
  id: string;
  description: string;
  amount: number;
  vat_mode: VatMode;
  quote_file_path: string | null;
  quote_file_name: string | null;
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

function mapApiLineItem(item: ApiLineItem): LineItem {
  const phases = item.project_phase_splits
    .map((phase) => ({
      id: phase.id,
phaseNumber: Number(phase.phase_number),
percentage: Number(phase.percentage),
calculatedAmount: Number(phase.calculated_amount || 0),
overrideAmount: phase.override_amount === null ? null : Number(phase.override_amount),
rideType: phase.override_type || null,
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

  const [invoiceNumbers, setInvoiceNumbers] = useState<Record<number, string>>({});
  const [invoiceDates, setInvoiceDates] = useState<Record<number, string>>({});
  const [invoiceAmounts, setInvoiceAmounts] = useState<Record<number, string>>({});
  const [paidAmounts, setPaidAmounts] = useState<Record<number, string>>({});
  const [paymentDates, setPaymentDates] = useState<Record<number, string>>({});

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
"quote" | "phase" | "invoices" | "contractors" | "timeline" | "export"
>("quote");

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

  const phaseNumbers = useMemo(() => {
    const count = project?.number_of_phases || 0;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [project]);

useEffect(() => {
  loadSecurePage();
}, [projectId]);

  useEffect(() => {
    if (!project || editingLineItemId) return;
    setPhasePercentages(Array.from({ length: project.number_of_phases }, () => ""));
  }, [project, editingLineItemId]);

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
  setAccessChecked(true);

  await loadContractors(loadedProject.organisation_id);
  await loadTimelineItems();
  await loadLineItems();
  await loadInvoices();

  setLoadingProject(false);
}

async function loadContractors(organisationId: string | null) {
  if (!organisationId) return;

  const response = await fetch(
  `/api/contractors?organisationId=${organisationId}&projectId=${projectId}`
);
  const text = await response.text();

  if (!text) {
    alert("Contractors API returned an empty response.");
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
  row["Contractor Name"] ||
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


  async function handleSaveInvoice(phaseNumber: number) {
    const expectedAmount = getExpectedPhaseAmount(phaseNumber);

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

  function getReportTitle(sectionId: string) {
    if (sectionId === "print-full-pack") return "Total Project Pack";
    if (sectionId === "print-quote-summary") return "Project Quote Summary";
    if (sectionId === "print-phase-schedule") return "Phase Billing Schedule";
    if (sectionId === "print-invoices-payments") return "Invoices & Payments";

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
    doc.text("Project Quote Summary", margin, startY);

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
    doc.text("Phase Billing Schedule", margin, startY);

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
    doc.text("Invoices & Payments", margin, startY);

    const rows = phaseNumbers.map((phaseNumber) => {
      const expectedAmount = getExpectedPhaseAmount(phaseNumber);
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
        `Phase ${phaseNumber}`,
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
        "Phase",
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
    addHeader("Phase Billing Schedule");
    addPhaseSchedule(38);
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
  <main style={{ background: "#f4f7fb", minHeight: "calc(100vh - 60px)" }}>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
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
  <main style={{ background: "#f4f7fb", minHeight: "calc(100vh - 60px)" }}>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <aside style={styles.leftSidebar}>
        <div style={{ padding: "24px 12px 14px 0" }}>
          <p
            style={{
              margin: "0 0 14px 8px",
              fontSize: "13px",
              fontWeight: 900,
              color: "#52616f",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Project
          </p>

          <div style={{ display: "grid", gap: "10px" }}>
            <button
              style={selectedProjectSection === "quote" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("quote")}
            >
              Quote Summary
            </button>

            <button
              style={selectedProjectSection === "phase" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("phase")}
            >
              Phase Billing
            </button>

            <button
              style={selectedProjectSection === "invoices" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("invoices")}
            >
              Invoices & Payments
            </button>



            <button
              style={selectedProjectSection === "contractors" ? styles.sideMenuButtonActive : styles.sideMenuButton}
              onClick={() => setSelectedProjectSection("contractors")}
            >
              Contractors
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
              Print / Export
            </button>
          </div>
        </div>
      </aside>

      <div style={{ padding: "32px" }}>
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
          <label style={styles.label}>Contractor</label>
          <select
            style={{ ...styles.input, width: "100%" }}
            value={timelineContractorId}
            onChange={(e) => setTimelineContractorId(e.target.value)}
          >
            <option value="">No contractor selected</option>
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
        <th style={{ ...styles.th, minWidth: "180px" }}>Contractor</th>
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
    <h2 style={styles.cardTitle}>Contractors</h2>

<div style={{ ...styles.card, marginBottom: "18px", boxShadow: "none" }}>
  <h3 style={{ ...styles.cardTitle, marginBottom: "16px" }}>Add Contractor</h3>

  <div style={{ marginBottom: "16px" }}>
  <label style={styles.importButton}>
    {importingContractors ? "Importing..." : "Import Contractors from Excel"}
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
    <label style={styles.label}>Contractor Name</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorName}
      onChange={(e) => setNewContractorName(e.target.value)}
      placeholder="Contractor Name "
    />
  </div>

  <div>
    <label style={styles.label}>Address</label>
    <input
      style={{ ...styles.input, width: "100%" }}
      value={newContractorAddress}
      onChange={(e) => setNewContractorAddress(e.target.value)}
      placeholder="Contractor address"
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
      : "Add Contractor"}
</button>

</div>
</div>

    {contractors.length === 0 ? (
      <div style={styles.emptyState}>No contractors added yet.</div>
    ) : (
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Contractor</th>
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
  <section style={styles.printToolbar}>
        <button style={styles.printButton} onClick={() => printSection("print-full-pack")}>
          Print Full Project Pack
        </button>

        <button style={styles.printButton} onClick={() => printSection("print-quote-summary")}>
          Print Quote Summary
        </button>

        <button style={styles.printButton} onClick={() => printSection("print-phase-schedule")}>
          Print Phase Billing
        </button>

        <button style={styles.printButton} onClick={() => printSection("print-invoices-payments")}>
          Print Invoices & Payments
        </button>

        <button style={styles.pdfButton} onClick={() => exportPdfSection("print-full-pack")}>
          Export Full Pack PDF
        </button>

        <button style={styles.pdfButton} onClick={() => exportPdfSection("print-quote-summary")}>
          Export Quote PDF
        </button>

        <button style={styles.pdfButton} onClick={() => exportPdfSection("print-phase-schedule")}>
          Export Phase Billing PDF
        </button>

        <button style={styles.pdfButton} onClick={() => exportPdfSection("print-invoices-payments")}>
          Export Invoices PDF
        </button>
      </section>
      )}
      

{selectedProjectSection === "quote" && canEditProjectDetails && (
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>
          {editingLineItemId ? "Edit Line Item / Quote" : "Line Items / Quotes"}
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
  <label style={styles.label}>Contractor</label>
  <select
    style={styles.input}
    value={contractorId}
    onChange={(e) => setContractorId(e.target.value)}
  >
    <option value="">No contractor selected</option>
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

      <div id="print-full-pack">
        <div style={styles.printHeader}>
          <h1>{project?.name || "Project"}</h1>
          <p>Project Pack · Quote Summary and Phase Billing Schedule</p>
        </div>

        {(selectedProjectSection === "quote" || selectedProjectSection === "export") && showQuoteSummary && (
  <div id="print-quote-summary">
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Project Quote Summary</h2>

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
                    <th style={styles.th}>Contractor</th>
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
  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
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
      }}
    >
      {uploadingQuoteLineItemId === item.id ? "Uploading..." : "Upload"}
      <input
        type="file"
        style={{ display: "none" }}
        onChange={(e) => handleUploadQuoteFile(item.id, e.target.files?.[0] || null)}
        disabled={uploadingQuoteLineItemId === item.id}
      />
    </label>

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



        {(selectedProjectSection === "phase" || selectedProjectSection === "export") && showPhaseSchedule && (
            <div id="print-phase-schedule">
          {lineItems.length > 0 && (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Phase Billing Schedule</h2>

              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Override</th>


                    {phaseNumbers.map((phaseNumber) => (
  <th key={phaseNumber} style={styles.thRight}>
    Phase {phaseNumber}
  </th>
))}
                    <th style={styles.thRight}>Total Phases</th>
                    <th style={styles.thRight}>Difference</th>

                  </tr>
                </thead>

  

                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.description}</td>
                      <td style={styles.td}>
  <button
    style={{
      background: "#eef3f8",
      color: "#12304a",
      border: "1px solid #d5dde6",
      borderRadius: "8px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: 700,
      cursor: "pointer",
    }}
    onClick={() => handleOpenPhaseOverride(item)}
  >
    Override
  </button>
</td>

                      {phaseNumbers.map((phaseNumber) => {
                        const percentage = getPhasePercentage(item, phaseNumber);
                        const phase = item.phases.find((phase) => phase.phaseNumber === phaseNumber);
                        const displayAmount = phase?.overrideAmount ?? calculatePhaseAmount(item, percentage);
                        const isChangedOverride =
  phase?.overrideAmount !== null &&
  phase?.overrideAmount !== undefined &&
  Math.abs((phase.overrideAmount || 0) - (phase.calculatedAmount || 0)) >= 0.01;

                        return (
                          <td key={phaseNumber} style={styles.tdRight}>
                            {percentage}%<br />
                            <span
  style={{
  color:
    phase?.overrideType === "split"
      ? "#166534"
      : phase?.overrideType === "manual"
        ? "#92400e"
        : "#12304a",
  fontWeight: isChangedOverride ? 800 : 400,
  background:
    phase?.overrideType === "split"
      ? "#ecfdf3"
      : phase?.overrideType === "manual"
        ? "#fff7e6"
        : "transparent",
  padding: isChangedOverride ? "3px 6px" : 0,
  borderRadius: "6px",
}}
>
  {formatCurrency(displayAmount)}
</span>
                          
                          </td>
                        );
                      })}

<td style={styles.tdRight}>
  {formatCurrency(getPhaseBillingLineTotal(item))}
</td>

<td style={styles.tdRight}>
  {formatCurrency(getPhaseBillingLineDifference(item))}

  {Math.abs(getPhaseBillingLineDifference(item)) >= 0.01 && (
    <button
      style={{
        marginLeft: "8px",
        background: "#fff7e6",
        color: "#92400e",
        border: "1px solid #f5c76b",
        borderRadius: "8px",
        padding: "6px 10px",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
      }}
      onClick={() => handleSplitPhaseDifferenceEvenly(item)}
    >
      Split Evenly
    </button>
  )}

  {Math.abs(getPhaseBillingLineDifference(item)) >= 0.01 && (
  <button
    style={{
      marginLeft: "6px",
      background: "#eef3f8",
      color: "#12304a",
      border: "1px solid #d5dde6",
      borderRadius: "8px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: 700,
      cursor: "pointer",
    }}
    onClick={() => handleSplitPhaseDifferenceManually(item)}
  >
    Split Manually
  </button>
)}
</td>

                    </tr>
                  ))}
                </tbody>



              <tfoot>
  <tr>
    <td style={styles.totalCell}>Total per Phase</td>
    <td style={styles.totalCell}></td>

    {phaseTotals.map((total, index) => (
      <td key={index} style={styles.totalCellRight}>
        {formatCurrency(total)}
      </td>
    ))}

    <td style={styles.totalCellRight}>
      {formatCurrency(phaseTotals.reduce((total, value) => total + value, 0))}
    </td>

    <td style={styles.totalCellRight}></td>
  </tr>
</tfoot>
              </table>
            </section>
          )}
        </div>
      )}

      </div>

      {(selectedProjectSection === "invoices" || selectedProjectSection === "export") && canEditProjectDetails && showInvoicesPayments && (
        <div id="print-invoices-payments">
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Invoice & Payment Capture</h2>

            {loadingInvoices ? (
              <div style={styles.emptyState}>Loading invoices...</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Phase</th>
                    <th style={styles.thRight}>Expected</th>
                    <th style={styles.th}>Invoice No.</th>
                    <th style={styles.th}>Invoice Date</th>
                    <th style={styles.thRight}>Invoice Amount</th>
                    <th style={styles.thRight}>Difference</th>
                    <th style={styles.thRight}>Amount Paid</th>
                    <th style={styles.th}>Payment Date</th>
                    <th style={styles.thRight}>Outstanding</th>
                    <th style={styles.thRight}>Status</th>
                    <th style={styles.thRight} className="screen-only">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {phaseNumbers.map((phaseNumber) => {
                    const expectedAmount = getExpectedPhaseAmount(phaseNumber);
                    const existingInvoice = getInvoiceForPhase(phaseNumber);

                    const enteredInvoiceAmount =
                      invoiceAmounts[phaseNumber] === "" ||
                      invoiceAmounts[phaseNumber] === undefined
                        ? null
                        : Number(invoiceAmounts[phaseNumber]);

                    const enteredPaidAmount =
                      paidAmounts[phaseNumber] === "" || paidAmounts[phaseNumber] === undefined
                        ? null
                        : Number(paidAmounts[phaseNumber]);

                    const difference =
                      enteredInvoiceAmount === null
                        ? null
                        : enteredInvoiceAmount - expectedAmount;

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
                        <td style={styles.td}>Phase {phaseNumber}</td>
                        <td style={styles.tdRight}>{formatCurrency(expectedAmount)}</td>

                        <td style={styles.td}>
                          <input
                            style={styles.tableInput}
                            disabled={!canEditProjectDetails}
                            value={invoiceNumbers[phaseNumber] || ""}
                            onChange={(e) =>
                              setInvoiceNumbers((prev) => ({
                                ...prev,
                                [phaseNumber]: e.target.value,
                              }))
                            }
                            placeholder="Invoice no."
                          />
                        </td>

                        <td style={styles.td}>
                          <input
                            style={styles.tableInput}
                            type="date"
                            value={invoiceDates[phaseNumber] || ""}
                            onChange={(e) =>
                              setInvoiceDates((prev) => ({
                                ...prev,
                                [phaseNumber]: e.target.value,
                              }))
                            }
                          />
                        </td>

                        <td style={styles.tdRight}>
                          <input
                            style={styles.tableInputRight}
                            type="number"
                            value={invoiceAmounts[phaseNumber] || ""}
                            onChange={(e) =>
                              setInvoiceAmounts((prev) => ({
                                ...prev,
                                [phaseNumber]: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                          />
                        </td>

                        <td style={styles.tdRight}>
                          {difference === null ? "-" : formatCurrency(difference)}
                        </td>

                        <td style={styles.tdRight}>
                          <input
                            style={styles.tableInputRight}
                            type="number"
                            value={paidAmounts[phaseNumber] || ""}
                            onChange={(e) =>
                              setPaidAmounts((prev) => ({
                                ...prev,
                                [phaseNumber]: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                          />
                        </td>

                        <td style={styles.td}>
                          <input
                            style={styles.tableInput}
                            type="date"
                            value={paymentDates[phaseNumber] || ""}
                            onChange={(e) =>
                              setPaymentDates((prev) => ({
                                ...prev,
                                [phaseNumber]: e.target.value,
                              }))
                            }
                          />
                        </td>

                        <td style={styles.tdRight}>
                          {outstanding === null ? "-" : formatCurrency(outstanding)}
                          {hasOverdueOutstanding && (
                            <div style={styles.warningText}>⚠️ Over 30 days</div>
                          )}
                        </td>

                        <td style={styles.tdRight}>
                          <span
                            style={{
                              ...styles.statusPill,
                              ...(displayStatus === "Matched"
                                ? styles.statusMatched
                                : displayStatus === "Difference"
                                ? styles.statusDifference
                                : styles.statusNotInvoiced),
                            }}
                          >
                            {displayStatus}
                          </span>
                        </td>

                    {canEditProjectDetails && (
                       <td style={styles.tdRight} className="screen-only">
                          <button
                            style={styles.smallButton}
                            onClick={() => handleSaveInvoice(phaseNumber)}
                            disabled={savingInvoicePhase === phaseNumber}
                          >
                            {savingInvoicePhase === phaseNumber ? "Saving..." : "Save"}
                          </button>
                        </td>
                      )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
  page: {
  background: "#f4f7fb",
  minHeight: "calc(100vh - 60px)",
  padding: "32px",
  marginLeft: "180px",
},
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  title: {
    fontSize: "32px",
    fontWeight: 700,
    margin: 0,
    color: "#12304a",
  },
  subtitle: {
    marginTop: "8px",
    color: "#5b6775",
    fontSize: "15px",
  },
  backButton: {
    background: "#eef3f8",
    color: "#12304a",
    borderRadius: "10px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
  },
  printToolbar: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    background: "#ffffff",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "20px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    border: "1px solid #e5eaf0",
  },
  toggleToolbar: {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  background: "#ffffff",
  borderRadius: "16px",
  padding: "16px",
  marginBottom: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  border: "1px solid #e5eaf0",
},
toggleButton: {
  background: "#eef3f8",
  color: "#12304a",
  border: "1px solid #d5dde6",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
},
toggleButtonActive: {
  background: "#0b5cab",
  color: "#ffffff",
  border: "1px solid #0b5cab",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
},
  printButton: {
    background: "#12304a",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  pdfButton: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  printHeader: {
    display: "none",
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    border: "1px solid #e5eaf0",
    overflowX: "auto",
  },
  cardTitle: {
    fontSize: "20px",
    margin: "0 0 20px 0",
    color: "#12304a",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 220px 180px",
    gap: "20px",
    alignItems: "end",
  },
  phaseGrid: {
    display: "grid",
    gap: "16px",
    alignItems: "end",
    marginTop: "20px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#34495e",
  },
  input: {
    height: "42px",
    borderRadius: "10px",
    border: "1px solid #d5dde6",
    padding: "0 12px",
    fontSize: "15px",
    outline: "none",
    background: "#ffffff",
  },
  tableInput: {
    height: "36px",
    borderRadius: "8px",
    border: "1px solid #d5dde6",
    padding: "0 10px",
    fontSize: "14px",
    outline: "none",
    background: "#ffffff",
    width: "130px",
  },
  tableInputRight: {
    height: "36px",
    borderRadius: "8px",
    border: "1px solid #d5dde6",
    padding: "0 10px",
    fontSize: "14px",
    outline: "none",
    background: "#ffffff",
    width: "130px",
    textAlign: "right",
  },
  buttonHolder: {
    display: "flex",
    justifyContent: "flex-end",
  },
  primaryButton: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
  secondaryButton: {
    background: "#eef3f8",
    color: "#12304a",
    border: "none",
    borderRadius: "10px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  cancelEditRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "16px",
  },
  emptyState: {
    padding: "32px",
    textAlign: "center",
    color: "#7b8794",
    border: "1px dashed #c9d3df",
    borderRadius: "14px",
    background: "#fafcff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1200px",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #dce3eb",
    fontSize: "13px",
    color: "#34495e",
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: "12px",
    borderBottom: "1px solid #dce3eb",
    fontSize: "13px",
    color: "#34495e",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #edf1f5",
    fontSize: "14px",
    color: "#12304a",
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "12px",
    borderBottom: "1px solid #edf1f5",
    fontSize: "14px",
    color: "#12304a",
    textAlign: "right",
    verticalAlign: "middle",
    lineHeight: 1.6,
  },
  totalCell: {
    padding: "14px 12px",
    fontWeight: 700,
    color: "#12304a",
    borderTop: "2px solid #dce3eb",
  },
  totalCellRight: {
    padding: "14px 12px",
    fontWeight: 700,
    color: "#12304a",
    borderTop: "2px solid #dce3eb",
    textAlign: "right",
  },
  smallButton: {
    background: "#e8f3ff",
    color: "#0b5cab",
    border: "1px solid #c9e2ff",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    marginRight: "8px",
  },
  dangerButton: {
    background: "#fff1f1",
    color: "#b42318",
    border: "1px solid #ffd0d0",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  statusPill: {
    display: "inline-block",
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: 700,
  },
  statusMatched: {
    background: "#e8f8ee",
    color: "#137333",
    border: "1px solid #b8e6c8",
  },
  statusDifference: {
    background: "#fff4e5",
    color: "#b54708",
    border: "1px solid #ffd99b",
  },
  statusNotInvoiced: {
    background: "#eef3f8",
    color: "#5b6775",
    border: "1px solid #d5dde6",
  },
  warningText: {
    color: "#b42318",
    fontSize: "12px",
    fontWeight: 700,
    marginTop: "4px",
  },

leftSidebar: {
  background: "#ffffff",
  borderRight: "1px solid #dbe3ec",
},

sideMenuButton: {
  width: "100%",
  background: "#ffffff",
  color: "#12304a",
  border: "1px solid #dbe3ec",
  borderRadius: "10px",
  padding: "14px 14px",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
},

sideMenuButtonActive: {
  width: "100%",
  background: "#0f548c",
  color: "#ffffff",
  border: "1px solid #0f548c",
  borderRadius: "10px",
  padding: "14px 14px",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
},

importButton: {
  display: "inline-block",
  background: "#eef3f8",
  color: "#12304a",
  border: "1px solid #d5dde6",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
},

};