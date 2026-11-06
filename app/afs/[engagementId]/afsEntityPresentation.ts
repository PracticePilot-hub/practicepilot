export type AfsEntityPresentation = {
  isSoleProprietor?: boolean;
  isPartnership?: boolean;
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

  const sole = /sole (?:proprietor|trader|proprietorship)/.test(cleanEntityType(entityType));
  const partnership = cleanEntityType(entityType) === 'partnership';
  if (sole || partnership) return {
    isNpc:false,isTrust:false,isSoleProprietor:sole,isPartnership:partnership,
    entityLabel:sole?'Sole Proprietor':'Partnership',incomeStatementTitle:'Statement of Comprehensive Income',incomeStatementShortTitle:'Statement of Comprehensive Income',
    resultCurrentLabel:'Profit / (loss) for the year',resultPriorLabel:'Profit / (loss) for the prior year',resultGenericLabel:'Profit / (loss)',
    equityHeading:sole?"Proprietor’s capital":"Partners’ capital",equityStatementTitle:sole?"Statement of Changes in Proprietor’s Capital":"Statement of Changes in Partners’ Capital",
    accumulatedBalanceLabel:sole?"Proprietor’s current account":"Partners’ current accounts",showShareCapital:true,showShareCapitalPolicy:true,enableRestrictedFunds:false,
    responsiblePersonsLabel:sole?'Proprietor':'Partners',responsibilitiesTitle:sole?'Proprietor’s Responsibilities and Approval':'Partners’ Responsibilities and Approval',reportTitle:sole?'Proprietor’s Report':'Partners’ Report'
  };
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
      showShareCapitalPolicy: true,
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
      showShareCapitalPolicy: true,
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
      accumulatedBalanceLabel: "Retained income / (accumulated loss)",
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

  if (presentation.isSoleProprietor || presentation.isPartnership) {
    const p=presentation;
    const exact:Record<string,string>={equity:p.equityHeading,'equity and liabilities':p.equityHeading+' and liabilities','total equity':'Total '+p.equityHeading.toLowerCase(),'total equity and liabilities':'Total '+p.equityHeading.toLowerCase()+' and liabilities','share capital':p.equityHeading,'share capital / contributions':p.equityHeading,'contributed equity':p.equityHeading,'retained income':p.accumulatedBalanceLabel,'retained income / (loss)':p.accumulatedBalanceLabel,'retained income / (accumulated loss)':p.accumulatedBalanceLabel,'accumulated loss':p.accumulatedBalanceLabel,'shareholder / director / member loans':p.isSoleProprietor?'Proprietor loan':'Partner loans','shareholder loans':p.isSoleProprietor?'Proprietor loan':'Partner loans','dividends paid':p.isSoleProprietor?'Drawings':'Partner drawings'};
    return exact[label] || original;
  }
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
      "contributed equity":"Contributed funds",
      "shareholder / director / member loans":"Director loans",
      "shareholder loans":"Director loans",
      "retained income / (loss)":"Accumulated funds",
      "retained income / (accumulated loss)":"Accumulated funds",
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
      "contributed equity":"Members’ contributions",
      "equity":"Members’ interest",
      "total equity":"Total members’ interest",
      "equity and liabilities":"Members’ interest and liabilities",
      "total equity and liabilities":"Total members’ interest and liabilities",
      "dividends paid":"Distributions to members",
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
      "contributed equity":"Trust capital",
      "retained income / (loss)":"Accumulated funds",
      "retained income / (accumulated loss)":"Accumulated funds",
      "dividends paid":"Distributions to beneficiaries",
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
/** Legal form changes terminology, never the classification or amount of a ledger balance. */
export function entityGoverningBasis(entityType:unknown){
 const p=getAfsEntityPresentation(entityType);
 return p.isTrust?'the trust deed and the Trust Property Control Act 57 of 1988, as amended':p.isCloseCorporation?'the Close Corporations Act 69 of 1984, as amended':p.isPartnership?'the partnership agreement and applicable legislation':p.isSoleProprietor?'applicable legislation and the proprietor’s reporting responsibilities':'the Companies Act 71 of 2008, as amended';
}
export function entityCapitalTitle(entityType:unknown){const p=getAfsEntityPresentation(entityType);return p.isNpc?'Contributed funds':p.isTrust?'Trust capital':p.isCloseCorporation?'Members’ contributions':p.isSoleProprietor||p.isPartnership?p.equityHeading:'Share capital';}

export function entityDisclosureFieldLabel(sectionKey:string,fieldId:string,label:string,entityType:unknown){
 const p=getAfsEntityPresentation(entityType);
 if(sectionKey==='notesShareCapital'&&(p.isNpc||p.isTrust||p.isCloseCorporation||p.isSoleProprietor||p.isPartnership))return fieldId==='classes'?'Capital, ownership and rights':fieldId==='own'?'Distributions and restrictions':label;
 return label;
}
export function entityPolicyTexts(texts:Record<string,any>,defaults:Record<string,any>,entityType:unknown){
 const p=getAfsEntityPresentation(entityType);if(!p.isNpc&&!p.isTrust&&!p.isCloseCorporation&&!p.isSoleProprietor&&!p.isPartnership)return texts;
 const out={...texts},key='policyShareCapitalEquity';
 if(out[key]&&out[key].text===defaults[key]?.text)out[key]={...out[key],title:entityCapitalTitle(entityType),text:'Capital and residual funds are classified as equity only where their contractual substance creates no obligation to deliver cash or another financial asset. Repayable balances are liabilities. Contributions, drawings or distributions and transfers between funds are reconciled separately from income and expense. Transfers between equity funds do not create cash flows or income.'};
 return out;
}
