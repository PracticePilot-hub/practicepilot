// One canonical catalogue for both new and existing proposals.
// Update services here: never maintain a separate list in the edit page.
export type ProposalService = {
  id: string;
  category: string;
  name: string;
  description: string;
  includedInPackage: boolean;
  feeType: "Monthly" | "Annual" | "Once-off";
  amount: number;
  scopeQuantity: number | "";
  scopeUnit: string;
  clientFacingNote: string;
};

export const proposalServiceCatalogue: ProposalService[] = [
  {
    id: "monthly-bookkeeping",
    category: "Accounting Services",
    name: "Monthly Bookkeeping",
    description:
      "Monthly processing and review of the accounting records, including bank and control account reconciliations.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: 6,
    scopeUnit: "financial accounts",
    clientFacingNote:
      "Includes processing and reconciliation of up to 6 bank, money market or credit card accounts.",
  },
  {
    id: "monthly-vat-compliance",
    category: "Taxation Services",
    name: "Monthly VAT Compliance",
    description:
      "Preparation, review and submission of the monthly VAT return based on the accounting information and supporting records supplied.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: 12,
    scopeUnit: "VAT periods per year",
    clientFacingNote: "Includes 12 monthly VAT return periods per year.",
  },
  {
    id: "vat-compliance",
    category: "Taxation Services",
    name: "Bi-Monthly VAT Compliance",
    description:
      "Preparation, review and submission of the bi-monthly VAT return based on the accounting information and supporting records supplied.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "monthly-payroll",
    category: "Payroll Services",
    name: "Monthly Payroll",
    description:
      "Processing of monthly payroll, statutory deductions, payslips and standard payroll reports, including routine new employee and termination processing.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: 10,
    scopeUnit: "employees",
    clientFacingNote:
      "Includes payroll for up to 10 employees. Leave administration and non-routine HR matters are excluded unless separately agreed.",
  },
  {
    id: "bi-weekly-payroll",
    category: "Payroll Services",
    name: "Bi-Weekly Wages (Every 2 Weeks)",
    description:
      "Processing of wages every two weeks (26 pay runs per year), including statutory deductions, payslips and standard payroll reports, and routine employee starters and terminations.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "employees",
    clientFacingNote:
      "Includes 26 fortnightly wage runs per year for the agreed number of employees. Leave administration and non-routine HR matters are excluded unless separately agreed.",
  },
  {
    id: "weekly-payroll",
    category: "Payroll Services",
    name: "Weekly Wages",
    description:
      "Processing of weekly wages (52 pay runs per year), including statutory deductions, payslips and standard payroll reports, and routine employee starters and terminations.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "employees",
    clientFacingNote:
      "Includes 52 weekly wage runs per year for the agreed number of employees. Leave administration and non-routine HR matters are excluded unless separately agreed.",
  },
  {
    id: "emp201",
    category: "Payroll Services",
    name: "Monthly EMP201 Submission",
    description:
      "Preparation and submission of the monthly PAYE, UIF and SDL declaration.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "emp501",
    category: "Payroll Services",
    name: "EMP501 Reconciliations",
    description:
      "Preparation and submission of the interim and annual employer reconciliations and employee tax certificates.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "afs",
    category: "Accounting Services",
    name: "Annual Financial Statements",
    description:
      "Preparation of annual financial statements in accordance with the applicable financial reporting framework. Any independent review or audit, should one become legally required or requested, is excluded and will be quoted separately.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "itr14",
    category: "Taxation Services",
    name: "Business Income Tax Return",
    description:
      "Preparation and submission of the annual corporate income tax return and review of the resulting assessment.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "irp6",
    category: "Taxation Services",
    name: "Business Provisional Tax Returns",
    description:
      "Preparation and submission of the first and second provisional tax returns.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "cipc-ar",
    category: "Compliance Services",
    name: "CIPC Annual Return",
    description:
      "Preparation and submission of the annual return to the Companies and Intellectual Property Commission.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "beneficial-ownership",
    category: "Compliance Services",
    name: "Beneficial Ownership Declaration",
    description:
      "Preparation and submission of the entity’s beneficial ownership declaration and supporting information.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "workmans",
    category: "Compliance Services",
    name: "Compensation Fund Return of Earnings",
    description:
      "Preparation and submission of the annual Return of Earnings, where applicable.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "management-reporting",
    category: "Management Reporting",
    name: "Monthly Management Reporting",
    description:
      "Preparation of a monthly income statement, balance sheet, trial balance and basic management review to support informed decision-making.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "debtors-creditors",
    category: "Accounting Services",
    name: "Debtors and Creditors Assistance",
    description:
      "Assistance with maintaining debtor and creditor accounts, allocations, reconciliations and routine account queries based on information supplied.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote:
      "Debt collection, supplier payment approval and payment loading remain subject to separate client instructions and controls.",
  },
  {
    id: "uif-declaration",
    category: "Payroll Services",
    name: "UIF Declaration to the Department of Employment and Labour",
    description:
      "Preparation and submission of the monthly UIF declaration to the Department of Employment and Labour.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "letter-good-standing",
    category: "Compliance Services",
    name: "Letter of Good Standing",
    description:
      "Annual application for the Compensation Fund Letter of Good Standing, subject to the employer account being compliant and all assessments being paid.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote:
      "Compensation Fund assessment amounts are excluded from the monthly professional fee.",
  },
  {
    id: "paia",
    category: "Compliance Services",
    name: "PAIA Manual and Information Officer Registration",
    description:
      "Preparation of the PAIA manual and registration of the Information Officer, including the initial compliance setup.",
    includedInPackage: true,
    feeType: "Annual",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "payroll-software",
    category: "Software and Subscriptions",
    name: "Payroll Software Subscription",
    description:
      "Monthly payroll software subscription required for processing the agreed payroll service.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: 10,
    scopeUnit: "employees",
    clientFacingNote:
      "Included for the agreed payroll of up to 10 employees.",
  },
  {
    id: "accounting-software",
    category: "Software and Subscriptions",
    name: "Accounting Software Subscription",
    description:
      "Monthly accounting software subscription required for processing and maintaining the agreed accounting records.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: 1,
    scopeUnit: "entity",
    clientFacingNote:
      "Includes the accounting software subscription required for the agreed entity.",
  },
  {
    id: "tax-compliance",
    category: "Taxation Services",
    name: "Routine Tax Compliance and SARS Query Management",
    description:
      "General tax compliance assistance and routine liaison with SARS. Formal audits, objections and disputes are excluded unless separately agreed.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: "",
    scopeUnit: "",
    clientFacingNote: "",
  },
  {
    id: "training",
    category: "Advisory Services",
    name: "Training",
    description:
      "Training and implementation support on agreed accounting systems, record keeping, document management and administrative processes.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: 12,
    scopeUnit: "billing periods",
    clientFacingNote:
      "Although the majority of the training may be provided during the initial implementation phase, the agreed training fee is recovered in equal monthly instalments over 12 billing periods.",
  },
  {
    id: "consulting",
    category: "Advisory Services",
    name: "Consulting",
    description:
      "Dedicated business process consulting and implementation support to improve accounting, administrative and compliance processes, including the transition from manual and paper-based processes.",
    includedInPackage: true,
    feeType: "Monthly",
    amount: 0,
    scopeQuantity: 3,
    scopeUnit: "hours per month",
    clientFacingNote:
      "These consulting hours are additional to the time required to perform bookkeeping, VAT, payroll, tax, compliance and other recurring services included in the engagement. Unused consulting hours do not accumulate unless otherwise agreed.",
  },
];
