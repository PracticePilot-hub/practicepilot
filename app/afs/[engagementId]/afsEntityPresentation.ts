export type AfsEntityPresentation = {
  isNpc: boolean;
  isTrust: boolean;
  isCloseCorporation?: boolean;
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

export function isTrust(entityType: unknown) {
  const value = cleanEntityType(entityType);

  return value === "trust" || value.includes("trust");
}

export function isCloseCorporation(entityType: unknown) {
  const value = cleanEntityType(entityType);

  return (
    value === "cc" ||
    value === "close corporation" ||
    value.includes("close corporation")
  );
}

export function getAfsEntityPresentation(
  entityType: unknown,
): AfsEntityPresentation {
  const npc = isNonProfitCompany(entityType);
  const trust = isTrust(entityType);
  const closeCorporation = isCloseCorporation(entityType);

  if (npc) {
    return {
      isNpc: true,
      isTrust: false,
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

  if (trust) {
    return {
      isNpc: false,
      isTrust: true,
      entityLabel: "Trust",
      incomeStatementTitle: "Statement of Comprehensive Income",
      incomeStatementShortTitle: "Statement of Comprehensive Income",
      resultCurrentLabel: "Profit / (loss) for the year",
      resultPriorLabel: "Profit / (loss) for the prior year",
      resultGenericLabel: "Profit / (loss)",
      equityHeading: "Trust capital and accumulated funds",
      equityStatementTitle:
        "Statement of Changes in Trust Capital and Accumulated Funds",
      accumulatedBalanceLabel: "Accumulated funds",
      showShareCapital: false,
      showShareCapitalPolicy: false,
      enableRestrictedFunds: false,
      responsiblePersonsLabel: "Trustees",
      responsibilitiesTitle: "Trustees’ Responsibilities and Approval",
      reportTitle: "Trustees’ Report",
    };
  }

  if (closeCorporation) {
    return {
      isNpc: false,
      isTrust: false,
      isCloseCorporation: true,
      entityLabel: "Close Corporation",
      incomeStatementTitle: "Statement of Comprehensive Income",
      incomeStatementShortTitle: "Statement of Comprehensive Income",
      resultCurrentLabel: "Profit / (loss) for the year",
      resultPriorLabel: "Profit / (loss) for the prior year",
      resultGenericLabel: "Profit / (loss)",
      equityHeading: "Members' interest",
      equityStatementTitle: "Statement of Changes in Members' Interest",
      accumulatedBalanceLabel: "Accumulated loss",
      showShareCapital: true,
      showShareCapitalPolicy: true,
      enableRestrictedFunds: false,
      responsiblePersonsLabel: "Members",
      responsibilitiesTitle: "Members’ Responsibilities and Approval",
      reportTitle: "Members’ Report",
    };
  }

  return {
    isNpc: false,
    isTrust: false,
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
  const label = original.toLowerCase();

  if (presentation.isNpc) {
    const exact: Record<string, string> = {
      "equity and liabilities": "Funds and liabilities",
      "equity": "Funds",
      "total equity": "Total funds",
      "total equity and liabilities": "Total funds and liabilities",
      "profit / (loss) for the year": "Surplus / (deficit) for the year",
      "profit / (loss) before taxation": "Surplus / (deficit) before taxation",
      "operating profit / (loss)": "Operating surplus / (deficit)",
      "gross profit / (loss)": "Gross surplus / (deficit)",
      "total comprehensive income / (loss)":
        "Total comprehensive surplus / (deficit)",
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

  if (presentation.isCloseCorporation) {
    const exact: Record<string, string> = {
      "share capital": "Member's contribution",
      "share capital / contributions": "Member's contribution",
      "members / owners contributions": "Member's contribution",
      "member / owner contributions": "Member's contribution",
      "owners contributions": "Member's contribution",
      "shareholder / director / member loans": "Member loans",
      "shareholder/director/member loans": "Member loans",
      "loans from shareholders": "Member loans",
      "shareholder loans": "Member loans",
    };

    if (exact[label]) return exact[label];

    return original;
  }

  if (presentation.isTrust) {
    const exact: Record<string, string> = {
      "equity and liabilities": "Trust funds and liabilities",
      "equity": "Trust capital and accumulated funds",
      "total equity": "Total trust capital and accumulated funds",
      "total equity and liabilities": "Total trust funds and liabilities",
      "retained income": "Accumulated funds",
      "retained income / accumulated loss": "Accumulated funds",
      "accumulated loss": "Accumulated funds",
      "share capital": "Trust capital",
      "share capital / contributions": "Trust capital",
      "members / owners contributions": "Trust capital",
      "member / owner contributions": "Trust capital",
      "owners contributions": "Trust capital",
      "shareholder / director / member loans": "Trustee loans",
      "shareholder/director/member loans": "Trustee loans",
      "loans from shareholders": "Trustee loans",
      "shareholder loans": "Trustee loans",
    };

    if (exact[label]) return exact[label];

    if (label.includes("retained income") || label.includes("accumulated loss")) {
      return "Accumulated funds";
    }

    return original;
  }

  return original;
}