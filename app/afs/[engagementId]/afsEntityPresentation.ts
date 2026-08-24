export type AfsEntityPresentation = {
  isNpc: boolean;
  entityLabel: string;
  incomeStatementTitle: string;
  incomeStatementShortTitle: string;
  resultCurrentLabel: string;
  resultPriorLabel: string;
  resultGenericLabel: string;
  equityHeading: string;
  equityStatementTitle: string;
  accumulatedBalanceLabel: string;
  showShareCapital: boolean;
  showShareCapitalPolicy: boolean;
  enableRestrictedFunds: boolean;
  responsiblePersonsLabel: string;
  responsibilitiesTitle: string;
  reportTitle: string;
};

function cleanEntityType(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isNonProfitCompany(entityType: unknown) {
  const value = cleanEntityType(entityType);

  return (
    value === "non-profit company" ||
    value === "non profit company" ||
    value === "npc"
  );
}

export function getAfsEntityPresentation(
  entityType: unknown,
): AfsEntityPresentation {
  const npc = isNonProfitCompany(entityType);

  if (npc) {
    return {
      isNpc: true,
      entityLabel: "Non-Profit Company",
      incomeStatementTitle: "Statement of Income and Expenditure",
      incomeStatementShortTitle: "Income and Expenditure",
      resultCurrentLabel: "Surplus / (deficit) for the year",
      resultPriorLabel: "Surplus / (deficit) for the prior year",
      resultGenericLabel: "Surplus / (deficit)",
      equityHeading: "Funds",
      equityStatementTitle: "Statement of Changes in Funds",
      accumulatedBalanceLabel: "Accumulated funds",
      showShareCapital: false,
      showShareCapitalPolicy: false,
      enableRestrictedFunds: true,
      responsiblePersonsLabel: "Directors",
      responsibilitiesTitle: "Directors’ Responsibilities and Approval",
      reportTitle: "Directors’ Report",
    };
  }

  return {
    isNpc: false,
    entityLabel: String(entityType || "Company"),
    incomeStatementTitle: "Statement of Comprehensive Income",
    incomeStatementShortTitle: "Statement of Comprehensive Income",
    resultCurrentLabel: "Profit / (loss) for the year",
    resultPriorLabel: "Profit / (loss) for the prior year",
    resultGenericLabel: "Profit / (loss)",
    equityHeading: "Equity",
    equityStatementTitle: "Statement of Changes in Equity",
    accumulatedBalanceLabel: "Retained income",
    showShareCapital: true,
    showShareCapitalPolicy: true,
    enableRestrictedFunds: false,
    responsiblePersonsLabel: "Directors",
    responsibilitiesTitle: "Directors’ Responsibilities and Approval",
    reportTitle: "Directors’ Report",
  };
}

export function getAfsEntityRowLabel(
  value: unknown,
  presentation: AfsEntityPresentation,
) {
  const original = String(value || "").trim();
  if (!presentation.isNpc) return original;

  const label = original.toLowerCase();

  const exact: Record<string, string> = {
    "equity and liabilities": "Funds and liabilities",
    "equity": "Funds",
    "total equity": "Total funds",
    "total equity and liabilities": "Total funds and liabilities",
    "profit / (loss) for the year": "Surplus / (deficit) for the year",
    "profit / (loss) before taxation": "Surplus / (deficit) before taxation",
    "operating profit / (loss)": "Operating surplus / (deficit)",
    "gross profit / (loss)": "Gross surplus / (deficit)",
    "total comprehensive income / (loss)": "Total comprehensive surplus / (deficit)",
    "retained income": "Accumulated funds",
    "retained income / accumulated loss": "Accumulated funds",
    "accumulated loss": "Accumulated funds",
    "share capital": "Contributed funds",
    "share capital / contributions": "Contributed funds",
  };

  if (exact[label]) return exact[label];

  if (label.includes("retained income") || label.includes("accumulated loss")) {
    return "Accumulated funds";
  }

  if (label.includes("profit / (loss) for prior year")) {
    return "Surplus / (deficit) for prior year";
  }

  if (label.includes("profit / (loss) for current year")) {
    return "Surplus / (deficit) for current year";
  }

  return original;
}