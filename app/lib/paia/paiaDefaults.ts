// Path: app/lib/paia/paiaDefaults.ts

import type {
  PaiaCrossBorder,
  PaiaDataSubject,
  PaiaLegislation,
  PaiaPersonalInfoCategory,
  PaiaProcessingPurpose,
  PaiaRecipient,
  PaiaRecord,
  PaiaSecurityMeasure,
  PaiaSignatory,
} from "./paiaTypes";

export const defaultRecords: PaiaRecord[] = [
  { category_key: "administration", record_name: "Founding documents", is_selected: true, available_on_request: true, sort_order: 10 },
  { category_key: "administration", record_name: "Minutes of meetings", is_selected: true, available_on_request: true, sort_order: 20 },
  { category_key: "administration", record_name: "Shareholder / member register", is_selected: true, available_on_request: true, sort_order: 30 },
  { category_key: "administration", record_name: "Statutory returns", is_selected: true, available_on_request: true, sort_order: 40 },
  { category_key: "human_resources", record_name: "Employee records", is_selected: true, available_on_request: true, sort_order: 50 },
  { category_key: "human_resources", record_name: "Employment contracts", is_selected: true, available_on_request: true, sort_order: 60 },
  { category_key: "human_resources", record_name: "Remuneration records and policies", is_selected: true, available_on_request: true, sort_order: 70 },
  { category_key: "operations", record_name: "Client and customer register", is_selected: true, available_on_request: true, sort_order: 80 },
  { category_key: "operations", record_name: "Contracts", is_selected: true, available_on_request: true, sort_order: 90 },
  { category_key: "operations", record_name: "General correspondence", is_selected: true, available_on_request: true, sort_order: 100 },
  { category_key: "operations", record_name: "Marketing records", is_selected: true, available_on_request: true, sort_order: 110 },
  { category_key: "finance", record_name: "Annual financial statements", is_selected: true, available_on_request: true, sort_order: 120 },
  { category_key: "finance", record_name: "Banking records", is_selected: true, available_on_request: true, sort_order: 130 },
  { category_key: "finance", record_name: "Management accounts", is_selected: true, available_on_request: true, sort_order: 140 },
  { category_key: "finance", record_name: "Tax records", is_selected: true, available_on_request: true, sort_order: 150 },
  { category_key: "information_technology", record_name: "IT policies and procedures", is_selected: true, available_on_request: true, sort_order: 160 },
  { category_key: "information_technology", record_name: "Network diagrams", is_selected: true, available_on_request: true, sort_order: 170 },
];

export const defaultLegislation: PaiaLegislation[] = [
  { legislation_name: "Promotion of Access to Information Act 2 of 2000", applicable_records: "PAIA manual and access request records", is_selected: true, sort_order: 10 },
  { legislation_name: "Protection of Personal Information Act 4 of 2013", applicable_records: "Personal information and privacy records", is_selected: true, sort_order: 20 },
  { legislation_name: "Companies Act 71 of 2008", applicable_records: "Company records, registers and statutory records", is_selected: true, sort_order: 30 },
  { legislation_name: "Income Tax Act 58 of 1962", applicable_records: "Income tax records and supporting schedules", is_selected: true, sort_order: 40 },
  { legislation_name: "Value-Added Tax Act 89 of 1991", applicable_records: "VAT records and supporting documents", is_selected: true, sort_order: 50 },
  { legislation_name: "Basic Conditions of Employment Act 75 of 1997", applicable_records: "Employment and remuneration records", is_selected: true, sort_order: 60 },
  { legislation_name: "Labour Relations Act 66 of 1995", applicable_records: "Employee and labour records", is_selected: true, sort_order: 70 },
  { legislation_name: "Unemployment Insurance Act 63 of 2001", applicable_records: "UIF records", is_selected: true, sort_order: 80 },
  { legislation_name: "Unemployment Insurance Contributions Act 4 of 2002", applicable_records: "UIF contribution records", is_selected: true, sort_order: 90 },
  { legislation_name: "Consumer Protection Act 68 of 2008", applicable_records: "Customer and consumer records", is_selected: false, sort_order: 100 },
  { legislation_name: "Financial Intelligence Centre Act 38 of 2001", applicable_records: "Client verification and FICA records", is_selected: false, sort_order: 110 },
];

export const defaultProcessingPurposes: PaiaProcessingPurpose[] = [
  { purpose_name: "Fulfilling statutory obligations in terms of applicable legislation", is_selected: true, sort_order: 10 },
  { purpose_name: "Keeping of accounts and records", is_selected: true, sort_order: 20 },
  { purpose_name: "Client onboarding and verification", is_selected: true, sort_order: 30 },
  { purpose_name: "Providing services to clients and customers", is_selected: true, sort_order: 40 },
  { purpose_name: "Managing contractual obligations", is_selected: true, sort_order: 50 },
  { purpose_name: "Staff administration and payroll", is_selected: true, sort_order: 60 },
  { purpose_name: "Marketing and communication", is_selected: true, sort_order: 70 },
  { purpose_name: "Resolving and tracking complaints", is_selected: true, sort_order: 80 },
];

export const defaultDataSubjects: PaiaDataSubject[] = [
  { subject_name: "Clients and customers", information_processed: "Names, contact details, identity or registration numbers, tax information, financial information and correspondence", is_selected: true, sort_order: 10 },
  { subject_name: "Client employees and representatives", information_processed: "Names, contact details, identity numbers, payroll and tax-related information where applicable", is_selected: true, sort_order: 20 },
  { subject_name: "Employees and contractors", information_processed: "Names, contact details, identity numbers, employment records, payroll details and tax information", is_selected: true, sort_order: 30 },
  { subject_name: "Directors, members, trustees and beneficial owners", information_processed: "Names, identity numbers, addresses, contact details, ownership and appointment information", is_selected: true, sort_order: 40 },
  { subject_name: "Suppliers and service providers", information_processed: "Names, registration numbers, VAT numbers, contact details, banking details and correspondence", is_selected: true, sort_order: 50 },
];

export const defaultPersonalInfoCategories: PaiaPersonalInfoCategory[] = [
  { person_type: "natural_person", category_name: "Names", is_selected: true, sort_order: 10 },
  { person_type: "natural_person", category_name: "Physical and postal addresses", is_selected: true, sort_order: 20 },
  { person_type: "natural_person", category_name: "Date of birth", is_selected: true, sort_order: 30 },
  { person_type: "natural_person", category_name: "ID number", is_selected: true, sort_order: 40 },
  { person_type: "natural_person", category_name: "Tax related information", is_selected: true, sort_order: 50 },
  { person_type: "natural_person", category_name: "Financial information", is_selected: true, sort_order: 60 },
  { person_type: "natural_person", category_name: "Email address", is_selected: true, sort_order: 70 },
  { person_type: "natural_person", category_name: "Telephone number", is_selected: true, sort_order: 80 },
  { person_type: "juristic_person", category_name: "Name of legal entity", is_selected: true, sort_order: 90 },
  { person_type: "juristic_person", category_name: "Registration number", is_selected: true, sort_order: 100 },
  { person_type: "juristic_person", category_name: "VAT number", is_selected: true, sort_order: 110 },
  { person_type: "juristic_person", category_name: "Physical and postal address and contact details", is_selected: true, sort_order: 120 },
  { person_type: "juristic_person", category_name: "Financial information", is_selected: true, sort_order: 130 },
  { person_type: "juristic_person", category_name: "Founding documents", is_selected: true, sort_order: 140 },
  { person_type: "juristic_person", category_name: "Authorised signatories, beneficiaries and ultimate beneficial owners", is_selected: true, sort_order: 150 },
  { person_type: "special_information", category_name: "Not applicable – we do not process special personal information", is_selected: true, sort_order: 160 },
];

export const defaultRecipients: PaiaRecipient[] = [
  { recipient_name: "South African Revenue Service", information_shared: "Tax and payroll related information", is_selected: true, sort_order: 10 },
  { recipient_name: "Companies and Intellectual Property Commission", information_shared: "Company and statutory information", is_selected: true, sort_order: 20 },
  { recipient_name: "Banks and financial institutions", information_shared: "Financial and verification information", is_selected: true, sort_order: 30 },
  { recipient_name: "Regulatory, statutory and government bodies", information_shared: "Information required by law", is_selected: true, sort_order: 40 },
  { recipient_name: "Auditors, accountants and professional advisors", information_shared: "Financial, tax and statutory records", is_selected: true, sort_order: 50 },
  { recipient_name: "Employees of the organisation", information_shared: "Operational information required to perform duties", is_selected: true, sort_order: 60 },
  { recipient_name: "IT and cloud service providers", information_shared: "Information hosted or processed through secure systems", is_selected: true, sort_order: 70 },
  { recipient_name: "Credit bureaus and third-party verification agencies", information_shared: "Verification and credit information where applicable", is_selected: false, sort_order: 80 },
];

export const defaultCrossBorder: PaiaCrossBorder[] = [
  { option_key: "cloud_services", description: "Personal information may be stored or processed through reputable cloud-based software providers where appropriate safeguards are in place.", is_selected: true },
  { option_key: "no_cross_border", description: "The organisation does not intentionally transfer personal information outside the Republic of South Africa, unless required for the performance of services or permitted by law.", is_selected: false },
];

export const defaultSecurityMeasures: PaiaSecurityMeasure[] = [
  { measure_name: "Acceptable usage of personal information", is_selected: true, sort_order: 10 },
  { measure_name: "Access control to personal information", is_selected: true, sort_order: 20 },
  { measure_name: "Computer and network security including firewalls, antivirus software and updated protocols", is_selected: true, sort_order: 30 },
  { measure_name: "Governance and regulatory compliance", is_selected: true, sort_order: 40 },
  { measure_name: "Information security and HR policies", is_selected: true, sort_order: 50 },
  { measure_name: "Internal process to report a security breach or anticipated security breach", is_selected: true, sort_order: 60 },
  { measure_name: "Logical and physical access control", is_selected: true, sort_order: 70 },
  { measure_name: "Monitoring access and usage of private information", is_selected: true, sort_order: 80 },
  { measure_name: "Retention and disposal of information", is_selected: true, sort_order: 90 },
  { measure_name: "Secure communications", is_selected: true, sort_order: 100 },
  { measure_name: "Staff training", is_selected: true, sort_order: 110 },
  { measure_name: "Appropriate contractual security obligations with third parties", is_selected: true, sort_order: 120 },
];

export const defaultSignatories: PaiaSignatory[] = [
  {
    signatory_name: "",
    signatory_capacity: "Information Officer / Director",
    signature_label: "Signature",
    signed_at: null,
    sort_order: 10,
  },
];
