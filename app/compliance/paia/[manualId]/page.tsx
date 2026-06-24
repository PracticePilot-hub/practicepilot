// Path: app/compliance/paia/[manualId]/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type PaiaManual = {
  id: string;
  manual_name: string;
  entity_name: string;
  entity_registration_number: string | null;
  vat_number: string | null;
  entity_type: string | null;
  industry: string | null;
  information_officer_name: string | null;
  information_officer_position: string | null;
  information_officer_email: string | null;
  information_officer_telephone: string | null;
  physical_address: string | null;
  postal_address: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  date_compiled: string | null;
  next_review_date: string | null;
  version_number: string | null;
  status: string | null;
  prepared_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
};

type RecordRow = {
  category_key: string;
  record_name: string;
  is_selected: boolean;
  is_custom: boolean;
  available_on_website: boolean;
  available_on_request: boolean;
  notes: string | null;
  sort_order: number;
};

type LegislationRow = {
  legislation_name: string;
  applicable_records: string | null;
  is_selected: boolean;
  is_custom: boolean;
  sort_order: number;
};

type PurposeRow = {
  purpose_name: string;
  is_selected: boolean;
  is_custom: boolean;
  sort_order: number;
};

type DataSubjectRow = {
  subject_name: string;
  information_processed: string | null;
  is_selected: boolean;
  is_custom: boolean;
  sort_order: number;
};

type InformationCategoryRow = {
  person_type: string;
  category_name: string;
  is_selected: boolean;
  is_custom: boolean;
  sort_order: number;
};

type RecipientRow = {
  recipient_name: string;
  information_shared: string | null;
  is_selected: boolean;
  is_custom: boolean;
  sort_order: number;
};

type CrossBorderRow = {
  option_key: string;
  description: string | null;
  is_selected: boolean;
};

type SecurityRow = {
  measure_name: string;
  is_selected: boolean;
  is_custom: boolean;
  sort_order: number;
};

type SignatoryRow = {
  signatory_name: string;
  signatory_capacity: string | null;
  signature_label: string | null;
  signed_at: string | null;
  sort_order: number;
};

type SectionKey =
  | "business"
  | "records"
  | "legislation"
  | "personal"
  | "recipients"
  | "security"
  | "generate";

const sections: { key: SectionKey; label: string; sub: string }[] = [
  { key: "business", label: "Business Details", sub: "Entity and Information Officer details" },
  { key: "records", label: "Records", sub: "Business records and automatic records" },
  { key: "legislation", label: "Legislation", sub: "Applicable statutory records" },
  { key: "personal", label: "Personal Information", sub: "POPIA categories and purposes" },
  { key: "recipients", label: "Recipients", sub: "Recipients and cross-border flows" },
  { key: "security", label: "Security Measures", sub: "Information security controls" },
  { key: "generate", label: "Review & Generate", sub: "Logo, signatures and export" },
];

const recordCategoryLabels: Record<string, string> = {
  administration: "Administration",
  human_resources: "Human Resources",
  operations: "Operations",
  finances: "Finances",
  information_technology: "Information Technology",
  statutory: "Statutory Records",
  general: "General / Custom",
};

const personTypeLabels: Record<string, string> = {
  natural_person: "Natural persons",
  juristic_person: "Juristic persons",
  special_information: "Special personal information",
};

function getLegislationGroup(row: LegislationRow) {
  const order = Number(row.sort_order || 0);

  if (order < 20) return "Core business and information law";
  if (order < 40) return "Tax and revenue legislation";
  if (order < 60) return "Employment and workplace legislation";
  return "Industry, entity-specific and optional legislation";
}

const legislationGroupHints: Record<string, string> = {
  "Core business and information law":
    "Usually relevant to most companies and close corporations.",
  "Tax and revenue legislation":
    "Select taxes and revenue laws that apply to the client's operations.",
  "Employment and workplace legislation":
    "Select employment laws where the client has employees or payroll obligations.",
  "Industry, entity-specific and optional legislation":
    "Use only where the client's legal form, industry or services make the legislation applicable.",
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 48px)",
    background: "#edf4fb",
    color: "#0f2742",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  fileBar: {
    margin: "10px 10px 0",
    background: "#ffffff",
    border: "1px solid #d8e3ef",
    borderRadius: 8,
    minHeight: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 10px",
  },
  back: {
    textDecoration: "none",
    color: "#0c2948",
    border: "1px solid #d8e3ef",
    background: "#f8fbff",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 850,
  },
  fileTitle: { marginLeft: 10, fontSize: 12, color: "#46617c", fontWeight: 700 },
  status: {
    borderRadius: 999,
    background: "#eef4ff",
    color: "#1769e0",
    padding: "4px 9px",
    fontSize: 11,
    fontWeight: 850,
  },
  shell: {
    display: "grid",
    gridTemplateColumns: "185px 1fr",
    gap: 10,
    padding: 10,
  },
  sideTitle: {
    margin: "8px 0 10px",
    paddingLeft: 2,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#46617c",
  },
  nav: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #d8e3ef",
    background: "#ffffff",
    borderRadius: 6,
    padding: "9px 10px",
    marginBottom: 6,
    cursor: "pointer",
    color: "#0f2742",
    fontSize: 12,
    fontWeight: 850,
  },
  navActive: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #0f66b3",
    background: "#0f66b3",
    color: "#ffffff",
    borderRadius: 6,
    padding: "9px 10px",
    marginBottom: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 850,
  },
  sectionHeader: {
    background: "#ffffff",
    border: "1px solid #d8e3ef",
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  sectionNo: { margin: 0, fontSize: 11, color: "#1769e0", fontWeight: 900 },
  h1: { margin: "4px 0 0", fontSize: 18, color: "#0c2948", fontWeight: 850 },
  sub: { margin: "4px 0 0", fontSize: 12, color: "#60758b" },
  card: { background: "#ffffff", border: "1px solid #d8e3ef", borderRadius: 12, padding: 16, marginBottom: 10 },
  sectionLine: {
    margin: "18px 0 12px",
    paddingBottom: 8,
    borderBottom: "1px solid #e2eaf3",
    fontSize: 12,
    fontWeight: 850,
    color: "#0c2948",
  },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  label: { display: "block" },
  labelText: { display: "block", marginBottom: 5, fontSize: 11, fontWeight: 850, color: "#344f6a" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: 36,
    border: "1px solid #cbd9e6",
    borderRadius: 7,
    padding: "7px 9px",
    fontSize: 12,
    color: "#0f2742",
    outline: "none",
    background: "#ffffff",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 75,
    border: "1px solid #cbd9e6",
    borderRadius: 7,
    padding: "8px 9px",
    fontSize: 12,
    color: "#0f2742",
    outline: "none",
    resize: "vertical",
    background: "#ffffff",
  },
  actions: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: "1px solid #e2eaf3",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  save: {
    border: "1px solid #1769e0",
    background: "#1769e0",
    color: "#ffffff",
    borderRadius: 7,
    padding: "9px 14px",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  smallButton: {
    border: "1px solid #cbd9e6",
    background: "#ffffff",
    color: "#0f2742",
    borderRadius: 7,
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d5dde6",
    background: "#f8fbff",
    color: "#12304a",
    borderRadius: 7,
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    borderRadius: 7,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  message: { fontSize: 12, color: "#60758b" },
  error: {
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 12,
    marginBottom: 10,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #d8e3ef",
    padding: "8px",
    color: "#344f6a",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    background: "#f8fbff",
  },
  td: {
    borderBottom: "1px solid #edf2f7",
    padding: "7px 8px",
    verticalAlign: "top",
  },
  checkbox: {
    width: 16,
    height: 16,
  },
  previewBox: {
    border: "1px solid #d8e3ef",
    borderRadius: 10,
    padding: 14,
    background: "#fbfdff",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#344f6a",
  },
};

function normaliseDate(value: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}


function withDefaults<T>(rows: T[], defaults: T[]) {
  return rows && rows.length > 0 ? rows : defaults;
}

const defaultRecords: RecordRow[] = [
  { category_key: "administration", record_name: "Founding documents", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 1 },
  { category_key: "administration", record_name: "Minutes of directors' / members' meetings", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 2 },
  { category_key: "administration", record_name: "Shareholder / member register", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 3 },
  { category_key: "administration", record_name: "Statutory returns", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 4 },
  { category_key: "administration", record_name: "Correspondence", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 5 },

  { category_key: "human_resources", record_name: "Employment contracts", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 10 },
  { category_key: "human_resources", record_name: "Employee records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 11 },
  { category_key: "human_resources", record_name: "Payroll records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 12 },
  { category_key: "human_resources", record_name: "Training records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 13 },
  { category_key: "human_resources", record_name: "Disciplinary records", is_selected: false, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 14 },

  { category_key: "operations", record_name: "Client and customer register", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 20 },
  { category_key: "operations", record_name: "Contracts and service agreements", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 21 },
  { category_key: "operations", record_name: "Supplier records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 22 },
  { category_key: "operations", record_name: "Marketing records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 23 },
  { category_key: "operations", record_name: "Sales records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 24 },

  { category_key: "finances", record_name: "Annual financial statements", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 30 },
  { category_key: "finances", record_name: "Accounting records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 31 },
  { category_key: "finances", record_name: "Banking records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 32 },
  { category_key: "finances", record_name: "Tax records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 33 },
  { category_key: "finances", record_name: "Asset register", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 34 },
  { category_key: "finances", record_name: "Insurance records", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 35 },

  { category_key: "information_technology", record_name: "IT policies and procedures", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 40 },
  { category_key: "information_technology", record_name: "Network diagrams", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 41 },
  { category_key: "information_technology", record_name: "User manuals", is_selected: true, is_custom: false, available_on_website: false, available_on_request: true, notes: "", sort_order: 42 },
];

const defaultLegislation: LegislationRow[] = [
  { legislation_name: "Companies Act 71 of 2008", applicable_records: "Company records, statutory registers, resolutions, annual returns and corporate governance records", is_selected: true, is_custom: false, sort_order: 1 },
  { legislation_name: "Promotion of Access to Information Act 2 of 2000", applicable_records: "PAIA manual, access request records and statutory access procedures", is_selected: true, is_custom: false, sort_order: 2 },
  { legislation_name: "Protection of Personal Information Act 4 of 2013", applicable_records: "Personal information records, privacy notices, consent records and security safeguard records", is_selected: true, is_custom: false, sort_order: 3 },
  { legislation_name: "Electronic Communications and Transactions Act 25 of 2002", applicable_records: "Electronic records, digital communications and website-related records", is_selected: true, is_custom: false, sort_order: 4 },
  { legislation_name: "Consumer Protection Act 68 of 2008", applicable_records: "Client, customer, marketing, service and complaint records", is_selected: true, is_custom: false, sort_order: 5 },

  { legislation_name: "Income Tax Act 58 of 1962", applicable_records: "Tax computations, payroll tax, accounting and supporting tax records", is_selected: true, is_custom: false, sort_order: 20 },
  { legislation_name: "Tax Administration Act 28 of 2011", applicable_records: "Tax administration, SARS correspondence, returns, assessments and dispute records", is_selected: true, is_custom: false, sort_order: 21 },
  { legislation_name: "Value-Added Tax Act 89 of 1991", applicable_records: "VAT records, tax invoices, VAT201 returns and supporting schedules", is_selected: true, is_custom: false, sort_order: 22 },
  { legislation_name: "Customs and Excise Act 91 of 1964", applicable_records: "Import, export and customs records where applicable", is_selected: false, is_custom: false, sort_order: 23 },

  { legislation_name: "Basic Conditions of Employment Act 75 of 1997", applicable_records: "Employment contracts, leave records, working hours, remuneration and payroll records", is_selected: true, is_custom: false, sort_order: 40 },
  { legislation_name: "Labour Relations Act 66 of 1995", applicable_records: "Disciplinary records, grievance records, labour relations records and employment correspondence", is_selected: true, is_custom: false, sort_order: 41 },
  { legislation_name: "Employment Equity Act 55 of 1998", applicable_records: "Employment equity plans, reports and workforce profile records where applicable", is_selected: false, is_custom: false, sort_order: 42 },
  { legislation_name: "Unemployment Insurance Act 63 of 2001", applicable_records: "UIF registrations, declarations and contribution records", is_selected: true, is_custom: false, sort_order: 43 },
  { legislation_name: "Skills Development Act 97 of 1998", applicable_records: "Training, skills development and workplace skills records where applicable", is_selected: true, is_custom: false, sort_order: 44 },
  { legislation_name: "Skills Development Levies Act 9 of 1999", applicable_records: "SDL calculations, EMP201 returns and related payroll records where applicable", is_selected: true, is_custom: false, sort_order: 45 },
  { legislation_name: "Occupational Health and Safety Act 85 of 1993", applicable_records: "Health and safety policies, incident records and workplace safety records", is_selected: true, is_custom: false, sort_order: 46 },
  { legislation_name: "Compensation for Occupational Injuries and Diseases Act 130 of 1993", applicable_records: "Workmen's compensation returns, injury records and assessment records", is_selected: true, is_custom: false, sort_order: 47 },

  { legislation_name: "Financial Intelligence Centre Act 38 of 2001", applicable_records: "Client identification, verification, risk assessment and accountable institution records where applicable", is_selected: false, is_custom: false, sort_order: 60 },
  { legislation_name: "National Credit Act 34 of 2005", applicable_records: "Credit agreements, consumer credit and collection records where applicable", is_selected: false, is_custom: false, sort_order: 61 },
  { legislation_name: "Close Corporations Act 69 of 1984", applicable_records: "Close corporation founding statements, members' records and accounting records where applicable", is_selected: false, is_custom: false, sort_order: 62 },
  { legislation_name: "Trust Property Control Act 57 of 1988", applicable_records: "Trust deeds, trustee resolutions and trust administration records where applicable", is_selected: false, is_custom: false, sort_order: 63 },
  { legislation_name: "Nonprofit Organisations Act 71 of 1997", applicable_records: "NPO registration, annual reports and governance records where applicable", is_selected: false, is_custom: false, sort_order: 64 },
  { legislation_name: "Pension Funds Act 24 of 1956", applicable_records: "Retirement fund and employee benefit records where applicable", is_selected: false, is_custom: false, sort_order: 65 },
  { legislation_name: "Medical Schemes Act 131 of 1998", applicable_records: "Medical aid and employee benefit records where applicable", is_selected: false, is_custom: false, sort_order: 66 },
  { legislation_name: "Sectional Titles Schemes Management Act 8 of 2011", applicable_records: "Body corporate and sectional title scheme records where applicable", is_selected: false, is_custom: false, sort_order: 67 },
  { legislation_name: "Financial Advisory and Intermediary Services Act 37 of 2002", applicable_records: "Financial services and intermediary records where applicable", is_selected: false, is_custom: false, sort_order: 68 },
  { legislation_name: "Financial Sector Regulation Act 9 of 2017", applicable_records: "Financial sector regulatory records where applicable", is_selected: false, is_custom: false, sort_order: 69 },
];

const defaultPurposes: PurposeRow[] = [
  { purpose_name: "Rendering services to clients and customers", is_selected: true, is_custom: false, sort_order: 1 },
  { purpose_name: "Administration of client, supplier and business relationships", is_selected: true, is_custom: false, sort_order: 2 },
  { purpose_name: "Employment, payroll and human resource administration", is_selected: true, is_custom: false, sort_order: 3 },
  { purpose_name: "Accounting, tax, audit and financial reporting obligations", is_selected: true, is_custom: false, sort_order: 4 },
  { purpose_name: "Compliance with legal and regulatory obligations", is_selected: true, is_custom: false, sort_order: 5 },
  { purpose_name: "Marketing and communication with clients and prospects", is_selected: true, is_custom: false, sort_order: 6 },
];

const defaultDataSubjects: DataSubjectRow[] = [
  { subject_name: "Clients and customers", information_processed: "Contact, identification, financial and transaction information", is_selected: true, is_custom: false, sort_order: 1 },
  { subject_name: "Employees and job applicants", information_processed: "Employment, payroll, contact, tax and HR information", is_selected: true, is_custom: false, sort_order: 2 },
  { subject_name: "Suppliers and service providers", information_processed: "Contact, banking, tax and service information", is_selected: true, is_custom: false, sort_order: 3 },
  { subject_name: "Directors, members and beneficial owners", information_processed: "Identification, contact and statutory information", is_selected: true, is_custom: false, sort_order: 4 },
];

const defaultInformationCategories: InformationCategoryRow[] = [
  { person_type: "natural_person", category_name: "Names", is_selected: true, is_custom: false, sort_order: 1 },
  { person_type: "natural_person", category_name: "Identity numbers", is_selected: true, is_custom: false, sort_order: 2 },
  { person_type: "natural_person", category_name: "Physical and postal addresses", is_selected: true, is_custom: false, sort_order: 3 },
  { person_type: "natural_person", category_name: "Telephone numbers and email addresses", is_selected: true, is_custom: false, sort_order: 4 },
  { person_type: "natural_person", category_name: "Financial information", is_selected: true, is_custom: false, sort_order: 5 },
  { person_type: "natural_person", category_name: "Tax related information", is_selected: true, is_custom: false, sort_order: 6 },
  { person_type: "juristic_person", category_name: "Name of legal entity", is_selected: true, is_custom: false, sort_order: 20 },
  { person_type: "juristic_person", category_name: "Registration number", is_selected: true, is_custom: false, sort_order: 21 },
  { person_type: "juristic_person", category_name: "Physical and postal address and contact details", is_selected: true, is_custom: false, sort_order: 22 },
  { person_type: "juristic_person", category_name: "Financial information", is_selected: true, is_custom: false, sort_order: 23 },
  { person_type: "juristic_person", category_name: "Founding documents", is_selected: true, is_custom: false, sort_order: 24 },
  { person_type: "special_information", category_name: "Not applicable — we do not intentionally process special personal information", is_selected: true, is_custom: false, sort_order: 40 },
];

const defaultRecipients: RecipientRow[] = [
  { recipient_name: "Auditors and accountants", information_shared: "Financial, tax and accounting information", is_selected: true, is_custom: false, sort_order: 1 },
  { recipient_name: "Banks and financial institutions", information_shared: "Banking and financial information where required", is_selected: true, is_custom: false, sort_order: 2 },
  { recipient_name: "SARS and regulatory authorities", information_shared: "Tax and statutory information", is_selected: true, is_custom: false, sort_order: 3 },
  { recipient_name: "Employees of the organisation", information_shared: "Information required for business operations", is_selected: true, is_custom: false, sort_order: 4 },
  { recipient_name: "Service providers and vendors", information_shared: "Information required for contracted services", is_selected: true, is_custom: false, sort_order: 5 },
  { recipient_name: "Legal advisors and professional consultants", information_shared: "Information required for advisory or legal purposes", is_selected: true, is_custom: false, sort_order: 6 },
];

const defaultCrossBorder: CrossBorderRow[] = [
  { option_key: "cloud_storage", description: "Personal information may be stored or processed using cloud-based systems and service providers.", is_selected: true },
  { option_key: "no_known_cross_border_transfer", description: "The organisation does not intentionally transfer personal information outside South Africa except where required by systems, suppliers or lawful business processes.", is_selected: false },
];

const defaultSecurityMeasures: SecurityRow[] = [
  { measure_name: "Access control to personal information", is_selected: true, is_custom: false, sort_order: 1 },
  { measure_name: "Computer and network security including firewalls, antivirus protection and updated protocols", is_selected: true, is_custom: false, sort_order: 2 },
  { measure_name: "Secure communications", is_selected: true, is_custom: false, sort_order: 3 },
  { measure_name: "Logical and physical access control", is_selected: true, is_custom: false, sort_order: 4 },
  { measure_name: "Confidentiality obligations with employees and service providers", is_selected: true, is_custom: false, sort_order: 5 },
  { measure_name: "Retention and disposal of information", is_selected: true, is_custom: false, sort_order: 6 },
  { measure_name: "Monitoring access and usage of private information", is_selected: true, is_custom: false, sort_order: 7 },
  { measure_name: "Training of staff members", is_selected: true, is_custom: false, sort_order: 8 },
  { measure_name: "Internal process to report security breaches or anticipated security breaches", is_selected: true, is_custom: false, sort_order: 9 },
];

const defaultSignatories: SignatoryRow[] = [
  { signatory_name: "Information Officer", signatory_capacity: "Information Officer", signature_label: "Signature", signed_at: "", sort_order: 1 },
];

export default function PaiaManualDetailPage() {
  const params = useParams();
  const manualId = String(params.manualId);

  const [manual, setManual] = useState<PaiaManual | null>(null);
  const [active, setActive] = useState<SectionKey>("business");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [legislation, setLegislation] = useState<LegislationRow[]>([]);
  const [purposes, setPurposes] = useState<PurposeRow[]>([]);
  const [dataSubjects, setDataSubjects] = useState<DataSubjectRow[]>([]);
  const [informationCategories, setInformationCategories] = useState<InformationCategoryRow[]>([]);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [crossBorder, setCrossBorder] = useState<CrossBorderRow[]>([]);
  const [securityMeasures, setSecurityMeasures] = useState<SecurityRow[]>([]);
  const [signatories, setSignatories] = useState<SignatoryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeIndex = sections.findIndex((section) => section.key === active);
  const activeSection = sections[activeIndex];

  async function loadManual() {
    setLoading(true);
    setError(null);

    try {
      const [manualRes, sectionsRes] = await Promise.all([
        fetch(`/api/paia/manuals/${manualId}`, { cache: "no-store" }),
        fetch(`/api/paia/manuals/${manualId}/sections`, { cache: "no-store" }),
      ]);

      const manualJson = await manualRes.json();
      const sectionsJson = await sectionsRes.json();

      if (!manualRes.ok) throw new Error(manualJson.error || "Could not load PAIA manual.");
      if (!sectionsRes.ok) throw new Error(sectionsJson.error || "Could not load PAIA sections.");

      setManual(manualJson.manual);
      setRecords(withDefaults(sectionsJson.records ?? [], defaultRecords));
      setLegislation(withDefaults(sectionsJson.legislation ?? [], defaultLegislation));
      setPurposes(withDefaults(sectionsJson.purposes ?? [], defaultPurposes));
      setDataSubjects(withDefaults(sectionsJson.dataSubjects ?? [], defaultDataSubjects));
      setInformationCategories(withDefaults(sectionsJson.informationCategories ?? [], defaultInformationCategories));
      setRecipients(withDefaults(sectionsJson.recipients ?? [], defaultRecipients));
      setCrossBorder(withDefaults(sectionsJson.crossBorder ?? [], defaultCrossBorder));
      setSecurityMeasures(withDefaults(sectionsJson.securityMeasures ?? [], defaultSecurityMeasures));
      setSignatories(withDefaults(sectionsJson.signatories ?? [], defaultSignatories));
    } catch (err: any) {
      setError(err?.message ?? "Could not load PAIA manual.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadManual();
  }, [manualId]);

  function updateManual(field: keyof PaiaManual, value: string) {
    setManual((current) => (current ? { ...current, [field]: value } : current));
  }

  async function saveManual() {
    if (!manual) return;

    setSaving("business");
    setMessage("");
    setError(null);

    try {
      const res = await fetch(`/api/paia/manuals/${manualId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manual),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save PAIA manual.");
      setManual(json.manual);
      setMessage("Business details saved.");
    } catch (err: any) {
      setError(err?.message ?? "Could not save PAIA manual.");
    } finally {
      setSaving("");
    }
  }

  async function finaliseManual() {
    if (!manual) return;

    const confirmed = window.confirm(
      "Finalise this PAIA manual? It will be marked as finalised. Future changes should be made through a new version."
    );

    if (!confirmed) return;

    setSaving("finalise");
    setMessage("");
    setError(null);

    try {
      const res = await fetch(`/api/paia/manuals/${manualId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...manual,
          status: "finalised",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Could not finalise PAIA manual.");
      }

      setManual(json.manual);
      setMessage("PAIA manual finalised.");
    } catch (err: any) {
      setError(err?.message ?? "Could not finalise PAIA manual.");
    } finally {
      setSaving("");
    }
  }

  async function createNewVersion() {
    if (!manual) return;

    const confirmed = window.confirm(
      `Create a new draft version from ${manual.entity_name || "this manual"}? The current finalised version will remain unchanged.`
    );

    if (!confirmed) return;

    setSaving("newVersion");
    setMessage("");
    setError(null);

    try {
      const res = await fetch(`/api/paia/manuals/${manualId}/new-version`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Could not create new PAIA manual version.");
      }

      if (json.manual?.id) {
        window.location.href = `/compliance/paia/${json.manual.id}`;
        return;
      }

      throw new Error("New PAIA manual version was created but no manual ID was returned.");
    } catch (err: any) {
      setError(err?.message ?? "Could not create new PAIA manual version.");
    } finally {
      setSaving("");
    }
  }

  async function saveSection(section: string, rows: unknown[]) {
    setSaving(section);
    setMessage("");
    setError(null);

    try {
      const res = await fetch(`/api/paia/manuals/${manualId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save PAIA section.");
      setMessage("Section saved.");
      await loadManual();
    } catch (err: any) {
      setError(err?.message ?? "Could not save PAIA section.");
    } finally {
      setSaving("");
    }
  }

  async function saveAllSections() {
    setSaving("all");
    setMessage("");
    setError(null);

    try {
      if (manual) {
        const manualRes = await fetch(`/api/paia/manuals/${manualId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(manual),
        });

        const manualJson = await manualRes.json();

        if (!manualRes.ok) {
          throw new Error(manualJson.error || "Could not save PAIA manual details.");
        }
      }

      const sectionsToSave = [
        { section: "records", rows: records },
        { section: "legislation", rows: legislation },
        { section: "purposes", rows: purposes },
        { section: "dataSubjects", rows: dataSubjects },
        { section: "informationCategories", rows: informationCategories },
        { section: "recipients", rows: recipients },
        { section: "crossBorder", rows: crossBorder },
        { section: "securityMeasures", rows: securityMeasures },
        { section: "signatories", rows: signatories },
      ];

      for (const item of sectionsToSave) {
        const res = await fetch(`/api/paia/manuals/${manualId}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || `Could not save ${item.section}.`);
        }
      }

      setMessage("All PAIA sections saved.");
      await loadManual();
    } catch (err: any) {
      setError(err?.message ?? "Could not save all PAIA sections.");
    } finally {
      setSaving("");
    }
  }


  async function uploadLogo(file: File) {
    if (!file) return;

    setSaving("logo");
    setMessage("");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch(`/api/paia/manuals/${manualId}/logo`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Could not upload logo.");
      }

      setManual((current) =>
        current
          ? {
              ...current,
              logo_url: json.logo_url,
              logo_file_path: json.logo_file_path,
            }
          : current
      );

      setMessage("Logo uploaded.");
    } catch (err: any) {
      setError(err?.message ?? "Could not upload logo.");
    } finally {
      setSaving("");
    }
  }


  const selectedRecordsCount = useMemo(
    () => records.filter((row) => row.is_selected).length,
    [records]
  );

  if (loading) {
    return <main style={s.page}><div style={{ padding: 20 }}>Loading PAIA manual...</div></main>;
  }

  if (!manual) {
    return (
      <main style={s.page}>
        <div style={{ padding: 20 }}>
          <div style={s.error}>{error || "Manual not found."}</div>
        </div>
      </main>
    );
  }

  return (
    <main style={s.page}>
      <div style={s.fileBar}>
        <div>
          <Link href="/compliance/paia" style={s.back}>← Back to PAIA</Link>
          <span style={s.fileTitle}>
            PAIA WORKING FILE | {manual.entity_name || "Untitled manual"}
          </span>
        </div>
        <span style={s.status}>{manual.status || "Draft"}</span>
      </div>

      <div style={s.shell}>
        <aside>
          <p style={s.sideTitle}>PAIA</p>
          {sections.map((section, index) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setActive(section.key)}
              style={active === section.key ? s.navActive : s.nav}
            >
              {String(index + 1).padStart(2, "0")} {section.label}
            </button>
          ))}
        </aside>

        <section>
          <div style={s.sectionHeader}>
            <div>
              <h1 style={s.h1}>{activeSection.label}</h1>
              <p style={s.sub}>{activeSection.sub}</p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <div style={s.message}>
                {active === "records" ? `${selectedRecordsCount} selected records` : null}
              </div>

              <button
                type="button"
                style={{
                  ...s.smallButton,
                  background: saving === "all" ? "#e2e8f0" : "#0f3b66",
                  color: saving === "all" ? "#334155" : "#ffffff",
                  borderColor: saving === "all" ? "#cbd5e1" : "#0f3b66",
                  minWidth: 94,
                }}
                disabled={saving === "all"}
                onClick={saveAllSections}
              >
                {saving === "all" ? "Saving..." : "Save all"}
              </button>
            </div>
          </div>

          {error ? <div style={s.error}>{error}</div> : null}

          {active === "business" ? (
            <BusinessSection
              manual={manual}
              updateManual={updateManual}
              saveManual={saveManual}
              saving={saving}
              message={message}
            />
          ) : null}

          {active === "records" ? (
            <RecordsSection
              records={records}
              setRecords={setRecords}
              save={() => saveSection("records", records)}
              saving={saving}
              message={message}
            />
          ) : null}

          {active === "legislation" ? (
            <LegislationSection
              legislation={legislation}
              setLegislation={setLegislation}
              save={() => saveSection("legislation", legislation)}
              saving={saving}
              message={message}
            />
          ) : null}

          {active === "personal" ? (
            <PersonalInformationSection
              purposes={purposes}
              setPurposes={setPurposes}
              dataSubjects={dataSubjects}
              setDataSubjects={setDataSubjects}
              informationCategories={informationCategories}
              setInformationCategories={setInformationCategories}
              savePurposes={() => saveSection("purposes", purposes)}
              saveDataSubjects={() => saveSection("dataSubjects", dataSubjects)}
              saveInformationCategories={() => saveSection("informationCategories", informationCategories)}
              saving={saving}
              message={message}
            />
          ) : null}

          {active === "recipients" ? (
            <RecipientsSection
              recipients={recipients}
              setRecipients={setRecipients}
              crossBorder={crossBorder}
              setCrossBorder={setCrossBorder}
              saveRecipients={() => saveSection("recipients", recipients)}
              saveCrossBorder={() => saveSection("crossBorder", crossBorder)}
              saving={saving}
              message={message}
            />
          ) : null}

          {active === "security" ? (
            <SecuritySection
              securityMeasures={securityMeasures}
              setSecurityMeasures={setSecurityMeasures}
              save={() => saveSection("securityMeasures", securityMeasures)}
              saving={saving}
              message={message}
            />
          ) : null}

          {active === "generate" ? (
            <GenerateSection
              manual={manual}
              updateManual={updateManual}
              saveManual={saveManual}
              uploadLogo={uploadLogo}
              records={records}
              legislation={legislation}
              purposes={purposes}
              dataSubjects={dataSubjects}
              informationCategories={informationCategories}
              recipients={recipients}
              crossBorder={crossBorder}
              securityMeasures={securityMeasures}
              signatories={signatories}
              setSignatories={setSignatories}
              saveSignatories={() => saveSection("signatories", signatories)}
              finaliseManual={finaliseManual}
              createNewVersion={createNewVersion}
              saving={saving}
              message={message}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function BusinessSection({
  manual,
  updateManual,
  saveManual,
  saving,
  message,
}: {
  manual: PaiaManual;
  updateManual: (field: keyof PaiaManual, value: string) => void;
  saveManual: () => void;
  saving: string;
  message: string;
}) {
  return (
    <div style={s.card}>
      <div style={{ ...s.sectionLine, marginTop: 0 }}>General information</div>
      <div style={s.grid3}>
        <Field label="Entity name" value={manual.entity_name || ""} onChange={(v) => updateManual("entity_name", v)} />
        <Field label="Registration number" value={manual.entity_registration_number || ""} onChange={(v) => updateManual("entity_registration_number", v)} />
        <Field label="Entity type" value={manual.entity_type || ""} onChange={(v) => updateManual("entity_type", v)} />
        <Field label="VAT number" value={manual.vat_number || ""} onChange={(v) => updateManual("vat_number", v)} />
        <Field label="Industry" value={manual.industry || ""} onChange={(v) => updateManual("industry", v)} />
        <Field label="Website" value={manual.website || ""} onChange={(v) => updateManual("website", v)} />
      </div>

      <div style={s.sectionLine}>Information Officer</div>
      <div style={s.grid3}>
        <Field label="Information Officer name" value={manual.information_officer_name || ""} onChange={(v) => updateManual("information_officer_name", v)} />
        <Field label="Position" value={manual.information_officer_position || ""} onChange={(v) => updateManual("information_officer_position", v)} />
        <Field label="Email" value={manual.information_officer_email || ""} onChange={(v) => updateManual("information_officer_email", v)} />
        <Field label="Telephone" value={manual.information_officer_telephone || ""} onChange={(v) => updateManual("information_officer_telephone", v)} />
      </div>

      <div style={s.sectionLine}>Contact information</div>
      <div style={s.grid2}>
        <TextAreaField label="Physical address" value={manual.physical_address || ""} onChange={(v) => updateManual("physical_address", v)} />
        <TextAreaField label="Postal address" value={manual.postal_address || ""} onChange={(v) => updateManual("postal_address", v)} />
        <Field label="Telephone" value={manual.telephone || ""} onChange={(v) => updateManual("telephone", v)} />
        <Field label="Email" value={manual.email || ""} onChange={(v) => updateManual("email", v)} />
      </div>

      <div style={s.sectionLine}>Manual control</div>
      <div style={s.grid3}>
        <Field label="Date compiled" type="date" value={normaliseDate(manual.date_compiled)} onChange={(v) => updateManual("date_compiled", v)} />
        <Field label="Next review date" type="date" value={normaliseDate(manual.next_review_date)} onChange={(v) => updateManual("next_review_date", v)} />
        <Field label="Version number" value={manual.version_number || "1.0"} onChange={(v) => updateManual("version_number", v)} />
      </div>

      <ActionRow message={message} saving={saving === "business"} onSave={saveManual} />
    </div>
  );
}

function RecordsSection({
  records,
  setRecords,
  save,
  saving,
  message,
}: {
  records: RecordRow[];
  setRecords: React.Dispatch<React.SetStateAction<RecordRow[]>>;
  save: () => void;
  saving: string;
  message: string;
}) {
  const grouped = useMemo(() => {
    const output: Record<string, RecordRow[]> = {};
    records.forEach((row) => {
      const key = row.category_key || "general";
      output[key] = output[key] || [];
      output[key].push(row);
    });
    return output;
  }, [records]);

  function update(index: number, patch: Partial<RecordRow>) {
    setRecords((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function remove(index: number) {
    setRecords((current) => current.filter((_, i) => i !== index));
  }

  function addRow(category_key = "general") {
    setRecords((current) => [
      ...current,
      {
        category_key,
        record_name: "New record",
        is_selected: true,
        is_custom: true,
        available_on_website: false,
        available_on_request: true,
        notes: "",
        sort_order: current.length + 1,
      },
    ]);
  }

  return (
    <div style={s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={s.message}>Tick records that must appear in the manual.</div>
        <button type="button" style={s.smallButton} onClick={() => addRow("general")}>+ Add custom record</button>
      </div>

      {Object.keys(grouped).map((categoryKey) => (
        <div key={categoryKey}>
          <div style={s.sectionLine}>{recordCategoryLabels[categoryKey] || categoryKey}</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Use</th>
                <th style={s.th}>Record</th>
                <th style={s.th}>Website</th>
                <th style={s.th}>Request</th>
                <th style={s.th}>Notes</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {records.map((row, index) =>
                row.category_key === categoryKey ? (
                  <tr key={`${categoryKey}-${index}`}>
                    <td style={s.td}><input style={s.checkbox} type="checkbox" checked={row.is_selected} onChange={(e) => update(index, { is_selected: e.target.checked })} /></td>
                    <td style={s.td}><InlineInput value={row.record_name} onChange={(v) => update(index, { record_name: v })} /></td>
                    <td style={s.td}><input style={s.checkbox} type="checkbox" checked={row.available_on_website} onChange={(e) => update(index, { available_on_website: e.target.checked })} /></td>
                    <td style={s.td}><input style={s.checkbox} type="checkbox" checked={row.available_on_request} onChange={(e) => update(index, { available_on_request: e.target.checked })} /></td>
                    <td style={s.td}><InlineInput value={row.notes || ""} onChange={(v) => update(index, { notes: v })} /></td>
                    <td style={s.td}><button type="button" style={s.dangerButton} onClick={() => remove(index)}>Delete</button></td>
                  </tr>
                ) : null
              )}
            </tbody>
          </table>
        </div>
      ))}

      <ActionRow message={message} saving={saving === "records"} onSave={save} />
    </div>
  );
}

function LegislationSection({
  legislation,
  setLegislation,
  save,
  saving,
  message,
}: {
  legislation: LegislationRow[];
  setLegislation: React.Dispatch<React.SetStateAction<LegislationRow[]>>;
  save: () => void;
  saving: string;
  message: string;
}) {
  const grouped = useMemo(() => {
    const output: Record<string, LegislationRow[]> = {};

    legislation.forEach((row) => {
      const group = getLegislationGroup(row);
      output[group] = output[group] || [];
      output[group].push(row);
    });

    return output;
  }, [legislation]);

  const selectedCount = legislation.filter((row) => row.is_selected).length;

  function update(index: number, patch: Partial<LegislationRow>) {
    setLegislation((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    setLegislation((current) => [
      ...current,
      {
        legislation_name: "New legislation",
        applicable_records: "",
        is_selected: true,
        is_custom: true,
        sort_order: 1000 + current.length,
      },
    ]);
  }

  function remove(index: number) {
    setLegislation((current) => current.filter((_, i) => i !== index));
  }

  return (
    <div style={s.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 850, color: "#0c2948" }}>
            Select applicable statutory requirements
          </div>
          <div style={{ ...s.message, marginTop: 4 }}>
            {selectedCount} selected. The defaults are grouped by practical use,
            not copied from the public wizard layout.
          </div>
        </div>

        <button type="button" style={s.smallButton} onClick={addRow}>
          + Add custom legislation
        </button>
      </div>

      {Object.keys(grouped).map((groupName) => (
        <div key={groupName} style={{ marginTop: 14 }}>
          <div
            style={{
              border: "1px solid #d8e3ef",
              borderRadius: 10,
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #d8e3ef",
                background: "#f8fbff",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0c2948" }}>
                {groupName}
              </div>
              <div style={{ ...s.message, marginTop: 3 }}>
                {legislationGroupHints[groupName]}
              </div>
            </div>

            {grouped[groupName].map((row) => {
              const realIndex = legislation.findIndex((item) => item === row);

              return (
                <div
                  key={`${groupName}-${realIndex}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "34px 1fr 1.25fr 92px",
                    gap: 10,
                    alignItems: "start",
                    padding: "10px 12px",
                    borderBottom: "1px solid #edf2f7",
                    background: row.is_selected ? "#ffffff" : "#fbfdff",
                    opacity: row.is_selected ? 1 : 0.62,
                  }}
                >
                  <div style={{ paddingTop: 8 }}>
                    <input
                      style={s.checkbox}
                      type="checkbox"
                      checked={row.is_selected}
                      onChange={(event) =>
                        update(realIndex, { is_selected: event.target.checked })
                      }
                    />
                  </div>

                  <label>
                    <span style={s.labelText}>Legislation</span>
                    <InlineInput
                      value={row.legislation_name}
                      onChange={(value) =>
                        update(realIndex, { legislation_name: value })
                      }
                    />
                  </label>

                  <label>
                    <span style={s.labelText}>Records affected / comments</span>
                    <InlineInput
                      value={row.applicable_records || ""}
                      onChange={(value) =>
                        update(realIndex, { applicable_records: value })
                      }
                    />
                  </label>

                  <div style={{ paddingTop: 19 }}>
                    {row.is_custom ? (
                      <button
                        type="button"
                        style={s.dangerButton}
                        onClick={() => remove(realIndex)}
                      >
                        Delete
                      </button>
                    ) : (
                      <span style={{ ...s.message, fontSize: 11 }}>Default</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <ActionRow
        message={message}
        saving={saving === "legislation"}
        onSave={save}
      />
    </div>
  );
}

function PersonalInformationSection({
  purposes,
  setPurposes,
  dataSubjects,
  setDataSubjects,
  informationCategories,
  setInformationCategories,
  savePurposes,
  saveDataSubjects,
  saveInformationCategories,
  saving,
  message,
}: {
  purposes: PurposeRow[];
  setPurposes: React.Dispatch<React.SetStateAction<PurposeRow[]>>;
  dataSubjects: DataSubjectRow[];
  setDataSubjects: React.Dispatch<React.SetStateAction<DataSubjectRow[]>>;
  informationCategories: InformationCategoryRow[];
  setInformationCategories: React.Dispatch<React.SetStateAction<InformationCategoryRow[]>>;
  savePurposes: () => void;
  saveDataSubjects: () => void;
  saveInformationCategories: () => void;
  saving: string;
  message: string;
}) {
  return (
    <div style={s.card}>
      <EditableSimpleList
        title="Purposes of processing"
        rows={purposes}
        labelKey="purpose_name"
        selectedKey="is_selected"
        addLabel="New processing purpose"
        setRows={setPurposes as any}
        save={savePurposes}
        saving={saving === "purposes"}
        message={message}
      />

      <div style={s.sectionLine}>Data subjects</div>
      <table style={s.table}>
        <thead>
          <tr><th style={s.th}>Use</th><th style={s.th}>Data subject</th><th style={s.th}>Information processed</th><th style={s.th}></th></tr>
        </thead>
        <tbody>
          {dataSubjects.map((row, index) => (
            <tr key={index}>
              <td style={s.td}><input style={s.checkbox} type="checkbox" checked={row.is_selected} onChange={(e) => setDataSubjects((c) => c.map((r, i) => i === index ? { ...r, is_selected: e.target.checked } : r))} /></td>
              <td style={s.td}><InlineInput value={row.subject_name} onChange={(v) => setDataSubjects((c) => c.map((r, i) => i === index ? { ...r, subject_name: v } : r))} /></td>
              <td style={s.td}><InlineInput value={row.information_processed || ""} onChange={(v) => setDataSubjects((c) => c.map((r, i) => i === index ? { ...r, information_processed: v } : r))} /></td>
              <td style={s.td}><button type="button" style={s.dangerButton} onClick={() => setDataSubjects((c) => c.filter((_, i) => i !== index))}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" style={{ ...s.smallButton, marginTop: 10 }} onClick={() => setDataSubjects((c) => [...c, { subject_name: "New data subject", information_processed: "", is_selected: true, is_custom: true, sort_order: c.length + 1 }])}>+ Add data subject</button>
      <ActionRow message={message} saving={saving === "dataSubjects"} onSave={saveDataSubjects} />

      <div style={s.sectionLine}>Categories of personal information</div>
      <table style={s.table}>
        <thead>
          <tr><th style={s.th}>Use</th><th style={s.th}>Type</th><th style={s.th}>Category</th><th style={s.th}></th></tr>
        </thead>
        <tbody>
          {informationCategories.map((row, index) => (
            <tr key={index}>
              <td style={s.td}><input style={s.checkbox} type="checkbox" checked={row.is_selected} onChange={(e) => setInformationCategories((c) => c.map((r, i) => i === index ? { ...r, is_selected: e.target.checked } : r))} /></td>
              <td style={s.td}><InlineInput value={personTypeLabels[row.person_type] || row.person_type} onChange={(v) => setInformationCategories((c) => c.map((r, i) => i === index ? { ...r, person_type: v } : r))} /></td>
              <td style={s.td}><InlineInput value={row.category_name} onChange={(v) => setInformationCategories((c) => c.map((r, i) => i === index ? { ...r, category_name: v } : r))} /></td>
              <td style={s.td}><button type="button" style={s.dangerButton} onClick={() => setInformationCategories((c) => c.filter((_, i) => i !== index))}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" style={{ ...s.smallButton, marginTop: 10 }} onClick={() => setInformationCategories((c) => [...c, { person_type: "natural_person", category_name: "New information category", is_selected: true, is_custom: true, sort_order: c.length + 1 }])}>+ Add information category</button>
      <ActionRow message={message} saving={saving === "informationCategories"} onSave={saveInformationCategories} />
    </div>
  );
}

function RecipientsSection({
  recipients,
  setRecipients,
  crossBorder,
  setCrossBorder,
  saveRecipients,
  saveCrossBorder,
  saving,
  message,
}: {
  recipients: RecipientRow[];
  setRecipients: React.Dispatch<React.SetStateAction<RecipientRow[]>>;
  crossBorder: CrossBorderRow[];
  setCrossBorder: React.Dispatch<React.SetStateAction<CrossBorderRow[]>>;
  saveRecipients: () => void;
  saveCrossBorder: () => void;
  saving: string;
  message: string;
}) {
  return (
    <div style={s.card}>
      <div style={s.sectionLine}>Recipients of personal information</div>
      <table style={s.table}>
        <thead>
          <tr><th style={s.th}>Use</th><th style={s.th}>Recipient</th><th style={s.th}>Information shared</th><th style={s.th}></th></tr>
        </thead>
        <tbody>
          {recipients.map((row, index) => (
            <tr key={index}>
              <td style={s.td}><input style={s.checkbox} type="checkbox" checked={row.is_selected} onChange={(e) => setRecipients((c) => c.map((r, i) => i === index ? { ...r, is_selected: e.target.checked } : r))} /></td>
              <td style={s.td}><InlineInput value={row.recipient_name} onChange={(v) => setRecipients((c) => c.map((r, i) => i === index ? { ...r, recipient_name: v } : r))} /></td>
              <td style={s.td}><InlineInput value={row.information_shared || ""} onChange={(v) => setRecipients((c) => c.map((r, i) => i === index ? { ...r, information_shared: v } : r))} /></td>
              <td style={s.td}><button type="button" style={s.dangerButton} onClick={() => setRecipients((c) => c.filter((_, i) => i !== index))}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" style={{ ...s.smallButton, marginTop: 10 }} onClick={() => setRecipients((c) => [...c, { recipient_name: "New recipient", information_shared: "", is_selected: true, is_custom: true, sort_order: c.length + 1 }])}>+ Add recipient</button>
      <ActionRow message={message} saving={saving === "recipients"} onSave={saveRecipients} />

      <div style={s.sectionLine}>Cross-border / cloud processing</div>
      <table style={s.table}>
        <thead>
          <tr><th style={s.th}>Use</th><th style={s.th}>Option</th><th style={s.th}>Description</th><th style={s.th}></th></tr>
        </thead>
        <tbody>
          {crossBorder.map((row, index) => (
            <tr key={index}>
              <td style={s.td}><input style={s.checkbox} type="checkbox" checked={row.is_selected} onChange={(e) => setCrossBorder((c) => c.map((r, i) => i === index ? { ...r, is_selected: e.target.checked } : r))} /></td>
              <td style={s.td}><InlineInput value={row.option_key} onChange={(v) => setCrossBorder((c) => c.map((r, i) => i === index ? { ...r, option_key: v } : r))} /></td>
              <td style={s.td}><InlineInput value={row.description || ""} onChange={(v) => setCrossBorder((c) => c.map((r, i) => i === index ? { ...r, description: v } : r))} /></td>
              <td style={s.td}><button type="button" style={s.dangerButton} onClick={() => setCrossBorder((c) => c.filter((_, i) => i !== index))}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" style={{ ...s.smallButton, marginTop: 10 }} onClick={() => setCrossBorder((c) => [...c, { option_key: "cloud_storage", description: "Personal information may be stored or processed using cloud-based systems.", is_selected: true }])}>+ Add cross-border note</button>
      <ActionRow message={message} saving={saving === "crossBorder"} onSave={saveCrossBorder} />
    </div>
  );
}

function SecuritySection({
  securityMeasures,
  setSecurityMeasures,
  save,
  saving,
  message,
}: {
  securityMeasures: SecurityRow[];
  setSecurityMeasures: React.Dispatch<React.SetStateAction<SecurityRow[]>>;
  save: () => void;
  saving: string;
  message: string;
}) {
  return (
    <div style={s.card}>
      <EditableSimpleList
        title="Information security measures"
        rows={securityMeasures}
        labelKey="measure_name"
        selectedKey="is_selected"
        addLabel="New security measure"
        setRows={setSecurityMeasures as any}
        save={save}
        saving={saving === "securityMeasures"}
        message={message}
      />
    </div>
  );
}

function GenerateSection({
  manual,
  updateManual,
  saveManual,
  uploadLogo,
  records,
  legislation,
  purposes,
  dataSubjects,
  informationCategories,
  recipients,
  crossBorder,
  securityMeasures,
  signatories,
  setSignatories,
  saveSignatories,
  finaliseManual,
  createNewVersion,
  saving,
  message,
}: {
  manual: PaiaManual;
  updateManual: (field: keyof PaiaManual, value: string) => void;
  saveManual: () => void;
  uploadLogo: (file: File) => void;
  records: RecordRow[];
  legislation: LegislationRow[];
  purposes: PurposeRow[];
  dataSubjects: DataSubjectRow[];
  informationCategories: InformationCategoryRow[];
  recipients: RecipientRow[];
  crossBorder: CrossBorderRow[];
  securityMeasures: SecurityRow[];
  signatories: SignatoryRow[];
  setSignatories: React.Dispatch<React.SetStateAction<SignatoryRow[]>>;
  saveSignatories: () => void;
  finaliseManual: () => void;
  createNewVersion: () => void;
  saving: string;
  message: string;
}) {
  const selectedRecords = records.filter((row) => row.is_selected).length;
  const selectedLegislation = legislation.filter((row) => row.is_selected).length;
  const selectedPurposes = purposes.filter((row) => row.is_selected).length;
  const selectedDataSubjects = dataSubjects.filter((row) => row.is_selected).length;
  const selectedInfoCategories = informationCategories.filter((row) => row.is_selected).length;
  const selectedRecipients = recipients.filter((row) => row.is_selected).length;
  const selectedCrossBorder = crossBorder.filter((row) => row.is_selected).length;
  const selectedSecurity = securityMeasures.filter((row) => row.is_selected).length;
  const completedSignatories = signatories.filter((row) => row.signatory_name && row.signatory_capacity).length;

  const checks = [
    {
      label: "Business details reviewed",
      complete:
        Boolean(manual.entity_name) &&
        Boolean(manual.entity_registration_number) &&
        Boolean(manual.entity_type) &&
        Boolean(manual.industry) &&
        Boolean(manual.telephone),
      detail: manual.entity_name || "Entity details incomplete",
    },
    {
      label: "Information Officer details reviewed",
      complete:
        Boolean(manual.information_officer_name) &&
        Boolean(manual.information_officer_email) &&
        Boolean(manual.information_officer_telephone),
      detail: manual.information_officer_name || "Information Officer incomplete",
    },
    {
      label: "Records reviewed",
      complete: selectedRecords > 0,
      detail: `${selectedRecords} selected records`,
    },
    {
      label: "Legislation reviewed",
      complete: selectedLegislation > 0,
      detail: `${selectedLegislation} selected legislation items`,
    },
    {
      label: "Personal information reviewed",
      complete: selectedPurposes > 0 && selectedDataSubjects > 0 && selectedInfoCategories > 0,
      detail: `${selectedPurposes} purposes · ${selectedDataSubjects} data subjects · ${selectedInfoCategories} information categories`,
    },
    {
      label: "Recipients and cross-border reviewed",
      complete: selectedRecipients > 0 && selectedCrossBorder > 0,
      detail: `${selectedRecipients} recipients · ${selectedCrossBorder} cross-border option(s)`,
    },
    {
      label: "Security measures reviewed",
      complete: selectedSecurity > 0,
      detail: `${selectedSecurity} security measures`,
    },
    {
      label: "Signatories completed",
      complete: completedSignatories > 0,
      detail: `${completedSignatories} signatory/signatories`,
    },
  ];

  const completedChecks = checks.filter((check) => check.complete).length;
  const readyForExport = completedChecks === checks.length;
  const isFinalised = String(manual.status || "").toLowerCase() === "finalised";

  return (
    <div style={s.card}>
      <div
        style={{
          border: "1px solid #d8e3ef",
          borderRadius: 12,
          background: readyForExport ? "#f0fdf4" : "#fff7ed",
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0c2948" }}>
              Final review and sign-off
            </div>
            <div style={{ ...s.message, marginTop: 4 }}>
              {completedChecks} of {checks.length} review areas complete.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                border: isFinalised
                  ? "1px solid #93c5fd"
                  : readyForExport
                  ? "1px solid #86efac"
                  : "1px solid #fed7aa",
                background: isFinalised
                  ? "#dbeafe"
                  : readyForExport
                  ? "#dcfce7"
                  : "#ffedd5",
                color: isFinalised
                  ? "#1e40af"
                  : readyForExport
                  ? "#166534"
                  : "#9a3412",
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              {isFinalised
                ? "Finalised"
                : readyForExport
                ? "Ready for finalisation"
                : "Review required"}
            </div>

            {readyForExport && !isFinalised ? (
              <button
                type="button"
                onClick={finaliseManual}
                disabled={saving === "finalise"}
                style={{
                  ...s.smallButton,
                  background: saving === "finalise" ? "#e2e8f0" : "#166534",
                  color: saving === "finalise" ? "#334155" : "#ffffff",
                  borderColor: saving === "finalise" ? "#cbd5e1" : "#166534",
                }}
              >
                {saving === "finalise" ? "Finalising..." : "Finalise manual"}
              </button>
            ) : null}

            {isFinalised ? (
              <button
                type="button"
                onClick={createNewVersion}
                disabled={saving === "newVersion"}
                style={{
                  ...s.smallButton,
                  background: saving === "newVersion" ? "#e2e8f0" : "#1769e0",
                  color: saving === "newVersion" ? "#334155" : "#ffffff",
                  borderColor: saving === "newVersion" ? "#cbd5e1" : "#1769e0",
                }}
              >
                {saving === "newVersion" ? "Creating..." : "Create new version"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div style={s.sectionLine}>Completion checklist</div>
      <div
        style={{
          border: "1px solid #d8e3ef",
          borderRadius: 10,
          overflow: "hidden",
          background: "#ffffff",
          marginBottom: 18,
        }}
      >
        {checks.map((check, index) => (
          <div
            key={check.label}
            style={{
              display: "grid",
              gridTemplateColumns: "34px 1fr 1.2fr",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              borderBottom: index === checks.length - 1 ? "none" : "1px solid #edf2f7",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 900,
                border: check.complete ? "1px solid #22c55e" : "1px solid #f97316",
                background: check.complete ? "#dcfce7" : "#ffedd5",
                color: check.complete ? "#166534" : "#9a3412",
              }}
            >
              {check.complete ? "✓" : "!"}
            </div>

            <div style={{ fontSize: 13, fontWeight: 800, color: "#0c2948" }}>
              {check.label}
            </div>

            <div style={{ fontSize: 12, color: "#64748b" }}>
              {check.detail}
            </div>
          </div>
        ))}
      </div>

      <div style={s.sectionLine}>Cover page and document control</div>
      <div style={s.grid3}>
        <div>
          <span style={s.labelText}>Company logo</span>
          <div
            style={{
              border: "1px solid #cbd9e6",
              borderRadius: 8,
              padding: 10,
              background: "#fbfdff",
              minHeight: 94,
            }}
          >
            {manual.logo_url ? (
              <div style={{ marginBottom: 10 }}>
                <img
                  src={manual.logo_url}
                  alt="Company logo"
                  style={{
                    maxWidth: 180,
                    maxHeight: 70,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
            ) : (
              <div style={{ ...s.message, marginBottom: 10 }}>
                No logo uploaded yet.
              </div>
            )}

            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadLogo(file);
              }}
              style={{
                width: "100%",
                fontSize: 12,
              }}
            />

            <div style={{ ...s.message, marginTop: 8 }}>
              Upload PNG, JPG or WEBP. This will be used on the PAIA manual cover and export.
            </div>
          </div>
        </div>

        <Field
          label="Prepared by"
          value={manual.prepared_by || ""}
          onChange={(v) => updateManual("prepared_by", v)}
        />
        <Field
          label="Reviewed by"
          value={manual.reviewed_by || ""}
          onChange={(v) => updateManual("reviewed_by", v)}
        />
        <Field
          label="Approved by"
          value={manual.approved_by || ""}
          onChange={(v) => updateManual("approved_by", v)}
        />
        <Field
          label="Version number"
          value={manual.version_number || "1.0"}
          onChange={(v) => updateManual("version_number", v)}
        />
      </div>
      <ActionRow message={message} saving={saving === "business"} onSave={saveManual} />

      <div style={s.sectionLine}>Signatories</div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Name</th>
            <th style={s.th}>Capacity</th>
            <th style={s.th}>Signature label</th>
            <th style={s.th}>Signed date</th>
            <th style={s.th}></th>
          </tr>
        </thead>
        <tbody>
          {signatories.map((row, index) => (
            <tr key={index}>
              <td style={s.td}>
                <InlineInput
                  value={row.signatory_name}
                  onChange={(v) =>
                    setSignatories((c) =>
                      c.map((r, i) => (i === index ? { ...r, signatory_name: v } : r))
                    )
                  }
                />
              </td>
              <td style={s.td}>
                <InlineInput
                  value={row.signatory_capacity || ""}
                  onChange={(v) =>
                    setSignatories((c) =>
                      c.map((r, i) => (i === index ? { ...r, signatory_capacity: v } : r))
                    )
                  }
                />
              </td>
              <td style={s.td}>
                <InlineInput
                  value={row.signature_label || ""}
                  onChange={(v) =>
                    setSignatories((c) =>
                      c.map((r, i) => (i === index ? { ...r, signature_label: v } : r))
                    )
                  }
                />
              </td>
              <td style={s.td}>
                <InlineInput
                  value={row.signed_at || ""}
                  onChange={(v) =>
                    setSignatories((c) =>
                      c.map((r, i) => (i === index ? { ...r, signed_at: v } : r))
                    )
                  }
                />
              </td>
              <td style={s.td}>
                <button
                  type="button"
                  style={s.dangerButton}
                  onClick={() => setSignatories((c) => c.filter((_, i) => i !== index))}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        style={{ ...s.smallButton, marginTop: 10 }}
        onClick={() =>
          setSignatories((c) => [
            ...c,
            {
              signatory_name: "New signatory",
              signatory_capacity: "Information Officer",
              signature_label: "Signature",
              signed_at: "",
              sort_order: c.length + 1,
            },
          ])
        }
      >
        + Add signatory
      </button>
      <ActionRow message={message} saving={saving === "signatories"} onSave={saveSignatories} />

      <div style={s.sectionLine}>Export</div>
      <div
        style={{
          border: "1px solid #d8e3ef",
          borderRadius: 10,
          background: "#f8fbff",
          padding: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 850, color: "#0c2948" }}>
            Export PAIA manual
          </div>
          <div style={{ ...s.message, marginTop: 4 }}>
            {isFinalised
              ? "This manual has been finalised. Download the issued PDF, or create a new draft version for future changes."
              : readyForExport
              ? "Final review checks are complete. Finalise the manual before issuing it."
              : "Some review checks are incomplete. You can still preview or download the PDF, but the manual may be incomplete."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a
            href={`/api/paia/manuals/${manual.id}/export`}
            target="_blank"
            rel="noreferrer"
            style={{
              ...s.secondaryButton,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              whiteSpace: "nowrap",
            }}
          >
            Open preview
          </a>

          <a
            href={`/api/paia/manuals/${manual.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            style={{
              ...s.smallButton,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              whiteSpace: "nowrap",
            }}
          >
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}

function EditableSimpleList({
  title,
  rows,
  labelKey,
  selectedKey,
  addLabel,
  setRows,
  save,
  saving,
  message,
}: {
  title: string;
  rows: any[];
  labelKey: string;
  selectedKey: string;
  addLabel: string;
  setRows: React.Dispatch<React.SetStateAction<any[]>>;
  save: () => void;
  saving: boolean;
  message: string;
}) {
  function update(index: number, patch: Record<string, unknown>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <>
      <div style={s.sectionLine}>{title}</div>
      <table style={s.table}>
        <thead>
          <tr><th style={s.th}>Use</th><th style={s.th}>Description</th><th style={s.th}></th></tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td style={s.td}><input style={s.checkbox} type="checkbox" checked={Boolean(row[selectedKey])} onChange={(e) => update(index, { [selectedKey]: e.target.checked })} /></td>
              <td style={s.td}><InlineInput value={row[labelKey] || ""} onChange={(v) => update(index, { [labelKey]: v })} /></td>
              <td style={s.td}><button type="button" style={s.dangerButton} onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" style={{ ...s.smallButton, marginTop: 10 }} onClick={() => setRows((current) => [...current, { [labelKey]: addLabel, [selectedKey]: true, is_custom: true, sort_order: current.length + 1 }])}>+ Add row</button>
      <ActionRow message={message} saving={saving} onSave={save} />
    </>
  );
}

function ActionRow({
  message,
  saving,
  onSave,
}: {
  message: string;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div style={s.actions}>
      <span style={s.message}>{message}</span>
      <button type="button" onClick={onSave} disabled={saving} style={{ ...s.save, opacity: saving ? 0.65 : 1 }}>
        {saving ? "Saving..." : "Save section"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label style={s.label}>
      <span style={s.labelText}>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} style={s.input} />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={s.label}>
      <span style={s.labelText}>{label}</span>
      <textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} style={s.textarea} />
    </label>
  );
}

function InlineInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} style={{ ...s.input, height: 32 }} />;
}
