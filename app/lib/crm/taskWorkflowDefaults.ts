export type ClientWorkflowStep = {
  label: string;
  item_type?: "manual" | "dependency" | "review" | "submission";
  dependency_service_code?: string | null;
  dependency_rule?: string | null;
  requires_evidence?: boolean;
  evidence_label?: string | null;
};

export function normaliseWorkflowStep(raw: any): ClientWorkflowStep | null {
  const label = String(raw?.label || "").trim();
  if (!label) return null;
  let item_type: ClientWorkflowStep["item_type"] =
    raw?.item_type === "dependency" ||
    raw?.item_type === "review" ||
    raw?.item_type === "submission"
      ? raw.item_type
      : "manual";
  if (item_type === "manual" && /\breview(ed| completed)?\b/i.test(label)) {
    item_type = "review";
  }
  const requires_evidence =
    item_type !== "dependency" &&
    item_type !== "review" &&
    Boolean(raw?.requires_evidence);
  return {
    label,
    item_type,
    dependency_service_code:
      item_type === "dependency"
        ? String(raw?.dependency_service_code || "").trim() || null
        : null,
    dependency_rule:
      item_type === "dependency"
        ? String(raw?.dependency_rule || "").trim() ||
          "covered_period_all_completed"
        : null,
    requires_evidence,
    evidence_label: requires_evidence
      ? String(raw?.evidence_label || label).trim() || label
      : null,
  };
}

export function systemChecklistTemplate(serviceName: string): ClientWorkflowStep[] {
  const templates: Record<string, ClientWorkflowStep[]> = {
    Accounting: [
      { label: "All bank statements received" },
      { label: "Transactions captured / imported" },
      { label: "Bank reconciliations completed", requires_evidence: true, evidence_label: "Bank reconciliation" },
      { label: "Debtors reviewed" },
      { label: "Creditors reviewed" },
      { label: "Payroll posted and reconciled" },
      { label: "Suspense / clearing accounts cleared" },
      { label: "VAT / tax control accounts checked", requires_evidence: true, evidence_label: "VAT control account / VAT transaction detail" },
      { label: "Review completed", item_type: "review" },
      { label: "Queries cleared" },
    ],
    Payroll: [
      { label: "Employee changes and payroll inputs received" },
      { label: "Payroll processed" },
      { label: "Leave, overtime and variable items checked" },
      { label: "Net pay and deductions verified" },
      { label: "Payroll journal prepared / posted" },
      { label: "Payroll reviewed", item_type: "review" },
      { label: "Payment schedule / payslips issued" },
    ],
    VAT201: [
      { label: "Accounting for the VAT period completed", item_type: "dependency", dependency_service_code: "Accounting", dependency_rule: "covered_period_all_completed" },
      { label: "Bank reconciliations completed" },
      { label: "Sales reconciled to VAT output" },
      { label: "Purchases reconciled to VAT input" },
      { label: "Exceptions / unusual transactions checked" },
      { label: "VAT control account reconciled", requires_evidence: true, evidence_label: "VAT control account / VAT transaction detail" },
      { label: "Supporting documents complete" },
      { label: "Return reviewed", item_type: "review" },
      { label: "Ready for submission" },
      { label: "Submitted and proof filed", item_type: "submission" },
    ],
    EMP201: [
      { label: "Payroll for this period completed", item_type: "dependency", dependency_service_code: "Payroll", dependency_rule: "same_period_all_completed" },
      { label: "PAYE / UIF / SDL reconciled to payroll" },
      { label: "EMP201 values reviewed", item_type: "review" },
      { label: "Return submitted", item_type: "submission" },
      { label: "Submission proof filed" },
    ],
    UIF: [
      { label: "Payroll for this period completed", item_type: "dependency", dependency_service_code: "Payroll", dependency_rule: "same_period_all_completed" },
      { label: "UIF contributor information checked" },
      { label: "UIF amount reconciled" },
      { label: "Return submitted", item_type: "submission" },
      { label: "Submission proof filed" },
    ],
    EMP501: [
      { label: "EMP201 periods for the reconciliation period completed", item_type: "dependency", dependency_service_code: "EMP201", dependency_rule: "covered_period_all_completed" },
      { label: "Payroll reconciliation completed" },
      { label: "IRP5 / IT3(a) data checked" },
      { label: "ETI reviewed where applicable" },
      { label: "EasyFile / validation errors cleared" },
      { label: "EMP501 reviewed", item_type: "review" },
      { label: "Submitted and proof filed", item_type: "submission" },
    ],
    "Financial Statements": [
      { label: "Accounting for the financial year completed", item_type: "dependency", dependency_service_code: "Accounting", dependency_rule: "covered_period_all_completed" },
      { label: "Trial balance / import complete" },
      { label: "Mapping complete" },
      { label: "Lead schedules complete" },
      { label: "Financial statements prepared" },
      { label: "Tax balances reconciled" },
      { label: "Review points cleared" },
      { label: "Financial statements reviewed", item_type: "review" },
      { label: "Final sign-off complete" },
    ],
    "Income Tax": [
      { label: "Financial statements for the tax year completed", item_type: "dependency", dependency_service_code: "Financial Statements", dependency_rule: "same_period_all_completed" },
      { label: "Tax computation completed" },
      { label: "Tax return prepared" },
      { label: "Tax return reviewed", item_type: "review" },
      { label: "Return submitted and proof filed", item_type: "submission" },
    ],
    "Provisional Tax": [
      { label: "Latest accounting / management information available" },
      { label: "Estimated taxable income calculated" },
      { label: "Prior assessment / basic amount considered" },
      { label: "Provisional tax calculation reviewed", item_type: "review" },
      { label: "IRP6 submitted", item_type: "submission" },
      { label: "Payment instruction / proof filed" },
    ],
    "CIPC Annual Return": [
      { label: "Company information confirmed" },
      { label: "Turnover / annual return information confirmed" },
      { label: "Annual return filed", item_type: "submission" },
      { label: "Filing confirmation stored" },
    ],
    "Beneficial Ownership Declaration": [
      { label: "Shareholding information confirmed" },
      { label: "Beneficial ownership structure reviewed", item_type: "review" },
      { label: "Beneficial owners confirmed" },
      { label: "Declaration filed", item_type: "submission" },
      { label: "Filing confirmation stored" },
    ],
    "Workmans Compensation": [
      { label: "Payroll / earnings information for the return period confirmed" },
      { label: "Return of Earnings information prepared" },
      { label: "Assessment / submission reviewed", item_type: "review" },
      { label: "Return submitted", item_type: "submission" },
      { label: "Submission proof filed" },
    ],
    "WCA Letter of Good Standing": [
      { label: "Workman's Compensation return / assessment up to date", item_type: "dependency", dependency_service_code: "Workmans Compensation", dependency_rule: "covered_period_all_completed" },
      { label: "Outstanding assessment balance checked" },
      { label: "Letter of Good Standing requested / renewed" },
      { label: "Current Letter of Good Standing filed" },
    ],
    "Management Reports": [
      { label: "Accounting for the reporting period completed", item_type: "dependency", dependency_service_code: "Accounting", dependency_rule: "covered_period_all_completed" },
      { label: "Management report pack prepared" },
      { label: "Material variances investigated" },
      { label: "Report reviewed", item_type: "review" },
      { label: "Report issued to client" },
    ],
  };
  return (templates[serviceName] || [
    { label: "Work completed" },
    { label: "Work reviewed / checked", item_type: "review" },
    { label: "Supporting evidence / communication filed" },
  ]).map(normaliseWorkflowStep).filter(Boolean) as ClientWorkflowStep[];
}
