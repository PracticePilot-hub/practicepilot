"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode, KeyboardEvent } from "react";
import {
  buildStatementOfFinancialPosition,
  buildStatementOfProfitOrLoss,
  formatMoney,
  type AfsTrialBalanceLine,
} from "./afsFinancialStatementEngine";
import AfsPpeNoteMatrix, { type AfsPpeClassRow } from "./AfsPpeNoteMatrix";

type Props = {
  trialBalanceLines: AfsTrialBalanceLine[];
  engagement?: {
    client_name: string;
    entity_type: string | null;
    financial_year_end: string;
    status: string;
    prepared_by: string | null;
  } | null;
  clientSetup?: ClientSetup | null;
  people?: ClientPerson[];
  reportOptions?: Partial<ReportOptions>;
  disclosureTextOverrides?: Record<string, string>;
  savingDisclosureTextKey?: string;
  onDisclosureTextChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onDisclosureTextSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
  onDisclosureTextReset?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string
  ) => void | Promise<void>;
  onReportOptionChange?: (key: keyof ReportOptions, value: boolean) => void | Promise<void>;
  savingReportOptionKey?: keyof ReportOptions | null;
};

type ClientSetup = Record<string, any> & {
  registered_name?: string | null;
  registration_number?: string | null;
  entity_type?: string | null;
  country?: string | null;
  currency?: string | null;
  currency_symbol?: string | null;
  legal_framework?: string | null;
  nature_of_business?: string | null;
  trading_name?: string | null;
  basis_of_preparation?: string | null;
  type_of_engagement?: string | null;
  report_required?: string | null;
  registered_office_line_1?: string | null;
  registered_office_line_2?: string | null;
  registered_office_city?: string | null;
  registered_office_province?: string | null;
  registered_office_postal_code?: string | null;
  physical_address_line_1?: string | null;
  physical_address_line_2?: string | null;
  physical_address_city?: string | null;
  physical_address_province?: string | null;
  physical_address_postal_code?: string | null;
  banker_name?: string | null;
  secretary_name?: string | null;
  income_tax_number?: string | null;
  vat_number?: string | null;
  practitioner_name?: string | null;
  practitioner_designation?: string | null;
  practice_name?: string | null;
  place_of_signature?: string | null;
  signature_date?: string | null;
  afs_approval_date?: string | null;
  publish_date?: string | null;
  current_period_heading?: string | null;
  prior_period_heading?: string | null;
};

type ClientPerson = Record<string, any> & {
  id: string;
  person_type: string;
  full_name: string;
  nationality?: string | null;
  appointment_date?: string | null;
  resignation_date?: string | null;
};

type StatementLine = {
  key: string;
  label: string;
  current: number;
  prior: number;
  noteNumber?: string;
  children?: StatementLine[];
  isTotal?: boolean;
  isSubtotal?: boolean;
};

type ReportOptions = {
  directorsResponsibilities: boolean;
  directorsReport: boolean;
  compilationReport: boolean;
  statementOfChangesInEquity: boolean;
  cashFlowStatement: boolean;
  accountingPolicies: boolean;
  notes: boolean;
  detailedIncomeStatement: boolean;
  taxComputation: boolean;
  policyBasisPreparation: boolean;
  policyJudgementsEstimates: boolean;
  policyGoingConcern: boolean;
  policyFinancialInstruments: boolean;
  policyCashEquivalents: boolean;
  policyTradeReceivables: boolean;
  policyInventories: boolean;
  policyPropertyPlantEquipment: boolean;
  policyInvestmentProperty: boolean;
  policyIntangibleAssets: boolean;
  policyImpairment: boolean;
  policyRevenue: boolean;
  policyEmployeeBenefits: boolean;
  policyBorrowingCosts: boolean;
  policyLeases: boolean;
  policyTaxation: boolean;
  policyShareCapitalEquity: boolean;
  policyProvisionsContingencies: boolean;
  policyRelatedParties: boolean;
  policyForeignCurrency: boolean;
  notesPropertyPlantEquipment: boolean;
  notesGoodwill: boolean;
  notesInvestmentProperty: boolean;
  notesIntangibleAssets: boolean;
  notesBiologicalAssets: boolean;
  notesOtherNonCurrentAssets: boolean;
  notesLoansReceivable: boolean;
  notesInventories: boolean;
  notesTradeReceivables: boolean;
  notesCurrentTaxReceivable: boolean;
  notesCashAndCashEquivalents: boolean;
  notesShareCapital: boolean;
  notesRetainedIncome: boolean;
  notesShareholdersLoans: boolean;
  notesOtherFinancialLiabilities: boolean;
  notesTradePayables: boolean;
  notesCurrentTaxPayable: boolean;
  notesRevenue: boolean;
  notesOtherIncome: boolean;
  notesOperatingExpenses: boolean;
  notesFinanceCosts: boolean;
  notesTaxation: boolean;
  notesCashUsedInOperations: boolean;
  directorsReportGeneralReview: boolean;
  directorsReportIncorporation: boolean;
  directorsReportNatureBusiness: boolean;
  directorsReportReviewActivities: boolean;
  directorsReportFinancialResults: boolean;
  directorsReportEventsAfter: boolean;
  directorsReportDividends: boolean;
  directorsReportShareCapital: boolean;
  directorsReportDirectors: boolean;
  directorsReportSecretary: boolean;
  directorsReportExternalAccountant: boolean;
  directorsReportInterestContracts: boolean;
  directorsReportBorrowingLimitations: boolean;
  directorsReportShareholder: boolean;
  directorsReportGoingConcern: boolean;
  directorsReportLiquiditySolvency: boolean;
  directorsReportLitigation: boolean;
  directorsReportSocialEthics: boolean;
  directorsReportSubsidiaries: boolean;
  directorsReportAssociates: boolean;
  directorsReportJointVentures: boolean;
  directorsReportNonCurrentAssets: boolean;
  directorsReportAuthorisation: boolean;
  directorsReportOther1: boolean;
  directorsReportOther2: boolean;
  directorsReportOther3: boolean;
  directorsReportOther4: boolean;
  directorsReportOther5: boolean;
  directorsReportOther6: boolean;
  directorsReportOther7: boolean;
  directorsReportOther8: boolean;
  directorsReportOther9: boolean;
  directorsReportOther10: boolean;
  showCoverLogo: boolean;
  showCoverFrameworkStatement: boolean;
  showCoverNoAssuranceStatement: boolean;
};

const defaultReportOptions: ReportOptions = {
  directorsResponsibilities: true,
  directorsReport: true,
  compilationReport: true,
  statementOfChangesInEquity: true,
  cashFlowStatement: true,
  accountingPolicies: true,
  notes: true,
  detailedIncomeStatement: true,
  taxComputation: true,
  policyBasisPreparation: true,
  policyJudgementsEstimates: true,
  policyGoingConcern: true,
  policyFinancialInstruments: true,
  policyCashEquivalents: true,
  policyTradeReceivables: false,
  policyInventories: true,
  policyPropertyPlantEquipment: false,
  policyInvestmentProperty: false,
  policyIntangibleAssets: false,
  policyImpairment: true,
  policyRevenue: false,
  policyEmployeeBenefits: false,
  policyBorrowingCosts: false,
  policyLeases: false,
  policyTaxation: false,
  policyShareCapitalEquity: true,
  policyProvisionsContingencies: false,
  policyRelatedParties: false,
  policyForeignCurrency: false,
  notesPropertyPlantEquipment: false,
  notesGoodwill: false,
  notesInvestmentProperty: false,
  notesIntangibleAssets: false,
  notesBiologicalAssets: false,
  notesOtherNonCurrentAssets: true,
  notesLoansReceivable: false,
  notesInventories: true,
  notesTradeReceivables: false,
  notesCurrentTaxReceivable: false,
  notesCashAndCashEquivalents: true,
  notesShareCapital: true,
  notesRetainedIncome: false,
  notesShareholdersLoans: true,
  notesOtherFinancialLiabilities: false,
  notesTradePayables: false,
  notesCurrentTaxPayable: false,
  notesRevenue: false,
  notesOtherIncome: false,
  notesOperatingExpenses: true,
  notesFinanceCosts: false,
  notesTaxation: false,
  notesCashUsedInOperations: true,
  directorsReportGeneralReview: true,
  directorsReportIncorporation: true,
  directorsReportNatureBusiness: true,
  directorsReportReviewActivities: true,
  directorsReportFinancialResults: true,
  directorsReportEventsAfter: true,
  directorsReportDividends: true,
  directorsReportShareCapital: true,
  directorsReportDirectors: true,
  directorsReportSecretary: false,
  directorsReportExternalAccountant: true,
  directorsReportInterestContracts: false,
  directorsReportBorrowingLimitations: false,
  directorsReportShareholder: true,
  directorsReportGoingConcern: true,
  directorsReportLiquiditySolvency: true,
  directorsReportLitigation: false,
  directorsReportSocialEthics: false,
  directorsReportSubsidiaries: false,
  directorsReportAssociates: false,
  directorsReportJointVentures: false,
  directorsReportNonCurrentAssets: false,
  directorsReportAuthorisation: true,
  directorsReportOther1: false,
  directorsReportOther2: false,
  directorsReportOther3: false,
  directorsReportOther4: false,
  directorsReportOther5: false,
  directorsReportOther6: false,
  directorsReportOther7: false,
  directorsReportOther8: false,
  directorsReportOther9: false,
  directorsReportOther10: false,
  showCoverLogo: false,
  showCoverFrameworkStatement: true,
  showCoverNoAssuranceStatement: true,
};

export default function FinancialStatementsPanel({
  trialBalanceLines,
  engagement,
  clientSetup,
  people = [],
  reportOptions,
  disclosureTextOverrides = {},
  savingDisclosureTextKey = "",
  onDisclosureTextChange,
  onDisclosureTextSave,
  onDisclosureTextReset,
  onReportOptionChange,
  savingReportOptionKey,
}: Props) {
  const options: ReportOptions = {
    ...defaultReportOptions,
    ...(reportOptions || {}),
  };

  const [sfpDisplayMode, setSfpDisplayMode] = useState<"review" | "edit">("review");
  const [printProfile, setPrintProfile] = useState<"draft" | "final">("draft");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const rawSfp = useMemo(
    () => buildStatementOfFinancialPosition(trialBalanceLines) as StatementLine[],
    [trialBalanceLines]
  );

  const preliminarySpl = useMemo(
    () => buildStatementOfProfitOrLoss(trialBalanceLines) as StatementLine[],
    [trialBalanceLines]
  );

  const clientName =
    clean(clientSetup?.registered_name) || clean(engagement?.client_name) || "Client name";
  const registrationNumber = clean(clientSetup?.registration_number) || "";
  const entityType = clean(clientSetup?.entity_type) || clean(engagement?.entity_type) || "Company";
  const yearEnd = clean(clientSetup?.financial_year_end) || clean(engagement?.financial_year_end) || "";
  const currentHeading =
    clean(clientSetup?.current_period_heading) || makeCurrentPeriodHeading(yearEnd);
  const priorHeading =
    clean(clientSetup?.prior_period_heading) || makePriorPeriodHeading(yearEnd);
  const basis = clean(clientSetup?.basis_of_preparation) || "IFRS for SMEs";
  const assurance = clean(clientSetup?.type_of_engagement) || "Compilation";
  const approvalDate =
    clean(clientSetup?.afs_approval_date) ||
    clean(clientSetup?.signature_date) ||
    clean(clientSetup?.publish_date) ||
    "";
  const issueDate = clean(clientSetup?.publish_date) || approvalDate;
  const signaturePlace = clean(clientSetup?.place_of_signature) || "Pretoria";
  const directors = people.filter((person) =>
    ["director", "member", "trustee"].includes(String(person.person_type || "").toLowerCase())
  );
  const directorWord = directors.length === 1 ? "director" : "directors";
  const directorTitle = entityType.toLowerCase().includes("close") ? "members" : directorWord;

  const profitForYear = findNestedLineTotal(preliminarySpl, ["profit / (loss) for the year", "profit for the year"]);
  const profitCurrent = profitForYear.current;
  const profitPrior = profitForYear.prior;
  const profitBeforeTaxForTax = findNestedLineTotal(preliminarySpl, [
    "profit / (loss) before taxation",
    "profit before taxation",
    "loss before taxation",
  ]);
  const taxationLineForTax = findLineByKey(preliminarySpl, "taxation");
  const taxationForTax = {
    current: toNumber(taxationLineForTax?.current),
    prior: toNumber(taxationLineForTax?.prior),
  };

  const shareCapitalTotal = findNestedLineTotal(rawSfp, [
    "share capital",
    "issued capital",
    "ordinary shares",
    "contributions",
  ]);
  const mappedRetainedIncomeTotal = findNestedLineTotal(rawSfp, [
    "retained income",
    "accumulated loss",
    "retained earnings",
  ]);

  const equityReconciliation = buildEquityReconciliation({
    shareCapital: shareCapitalTotal,
    mappedRetainedIncome: mappedRetainedIncomeTotal,
    profitForYear,
    disclosureTextOverrides,
  });

  const baseSfp = applyEquityReconciliationToSfp(rawSfp, equityReconciliation);
  const noteNumbering = buildDynamicNoteNumbering(baseSfp, preliminarySpl, options);
  const sfp = noteNumbering.sfp;
  const spl = noteNumbering.spl;

  const assetTotal = findSectionTotal(sfp, ["asset"]);
  const equityTotal = findSectionTotal(sfp, ["equity"]);
  const liabilityTotal = findSectionTotal(sfp, ["liabil"]);
  const equityAndLiabilitiesCurrent = equityTotal.current + liabilityTotal.current;
  const equityAndLiabilitiesPrior = equityTotal.prior + liabilityTotal.prior;

  const directorReportItems = buildDirectorsReportItems({
    reportOptions: withAllDirectorReportOptions(options),
    clientName,
    yearEnd,
    basis,
    clientSetup,
    directors,
    directorTitle,
    approvalDate,
    currentHeading,
    priorHeading,
    shareCapitalTotal,
    disclosureTextOverrides,
    savingDisclosureTextKey,
    onDisclosureTextChange,
    onDisclosureTextSave,
    onDisclosureTextReset,
  });

  function loadExternalScript(src: string, id: string) {
    return new Promise<void>((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Window is not available"));
        return;
      }

      if (document.getElementById(id)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function ensurePdfLibraries() {
    if (!(window as any).html2canvas) {
      await loadExternalScript(
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
        "practicepilot-html2canvas"
      );
    }

    if (!(window as any).jspdf?.jsPDF) {
      await loadExternalScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        "practicepilot-jspdf"
      );
    }
  }

  function replaceFormControlsForPdf(root: HTMLElement) {
    function printableInputValue(value: string) {
      const cleanValue = String(value || "").trim();
      if (!cleanValue) return "-";

      const numericValue = Number(cleanValue.replace(/\s/g, "").replace(/,/g, "."));
      if (Number.isFinite(numericValue) && /^-?[0-9\s,.]+$/.test(cleanValue)) {
        return formatAmount(numericValue);
      }

      return cleanValue;
    }

    root.querySelectorAll("input").forEach((input) => {
      const element = input as HTMLInputElement;
      const span = document.createElement("span");
      span.textContent = printableInputValue(element.value);
      span.setAttribute("style", element.getAttribute("style") || "");
      span.style.border = "0";
      span.style.background = "transparent";
      span.style.padding = "0";
      span.style.font = "inherit";
      span.style.color = "inherit";
      element.replaceWith(span);
    });

    root.querySelectorAll("textarea").forEach((textarea) => {
      const element = textarea as HTMLTextAreaElement;
      const div = document.createElement("div");
      div.textContent = element.value || "";
      div.setAttribute("style", element.getAttribute("style") || "");
      div.style.border = "0";
      div.style.background = "transparent";
      div.style.padding = "0";
      div.style.font = "inherit";
      div.style.color = "inherit";
      div.style.whiteSpace = "pre-wrap";
      element.replaceWith(div);
    });
  }

  async function waitForPdfImages(root: HTMLElement) {
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );
  }


  function isCanvasEffectivelyBlank(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    const { width, height } = canvas;
    if (!width || !height) return true;

    const sampleStep = 18;
    let checked = 0;
    let ink = 0;

    try {
      const data = ctx.getImageData(0, 0, width, height).data;
      for (let y = 0; y < height; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
          const i = (y * width + x) * 4;
          const r = data[i] ?? 255;
          const g = data[i + 1] ?? 255;
          const b = data[i + 2] ?? 255;
          const a = data[i + 3] ?? 255;
          checked += 1;
          if (a > 20 && (r < 245 || g < 245 || b < 245)) ink += 1;
          if (ink > 8) return false;
        }
      }
    } catch {
      return false;
    }

    return checked > 0 && ink <= 8;
  }

  async function downloadAfsPdf(profile: "draft" | "final") {
    setPrintProfile(profile);
    setIsGeneratingPdf(true);

    let exportHost: HTMLDivElement | null = null;

    try {
      await ensurePdfLibraries();

      const sourceRoot = document.querySelector(".afs-print-root") as HTMLElement | null;
      if (!sourceRoot) return;

      const html2canvas = (window as any).html2canvas;
      const JsPdfConstructor = (window as any).jspdf?.jsPDF;
      if (!html2canvas || !JsPdfConstructor) {
        alert("PDF library could not load. Check your internet connection and try again.");
        return;
      }

      exportHost = document.createElement("div");
      exportHost.className = "afs-pdf-export-host";
      exportHost.style.position = "fixed";
      exportHost.style.left = "-100000px";
      exportHost.style.top = "0";
      exportHost.style.width = "210mm";
      exportHost.style.background = "#ffffff";
      exportHost.style.zIndex = "-1";

      const exportStyle = document.createElement("style");
      exportStyle.textContent = `
        .afs-pdf-export-host,
        .afs-pdf-export-host * {
          box-sizing: border-box !important;
          color: #111827 !important;
          font-family: Arial, Helvetica, sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .afs-pdf-export-host button,
        .afs-pdf-export-host .afs-screen-only,
        .afs-pdf-export-host .afs-print-hide,
        .afs-pdf-export-host .print-hide,
        .afs-pdf-export-host .print-edit-col,
        .afs-pdf-export-host .statementModeToolbar,
        .afs-pdf-export-host .inlineEditableToolbar,
        .afs-pdf-export-host .compactNoteTabBar,
        .afs-pdf-export-host .noteEditorActions,
        .afs-pdf-export-host th.print-edit-col,
        .afs-pdf-export-host td.print-edit-col { display: none !important; }
        .afs-pdf-export-host .afs-print-root {
          width: 210mm !important;
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        .afs-pdf-export-host .afs-print-page {
          width: 210mm !important;
          max-width: none !important;
          min-height: 297mm !important;
          height: auto !important;
          margin: 0 !important;
          padding: 13mm 14mm 18mm 14mm !important;
          border: 0 !important;
          box-shadow: none !important;
          background: #ffffff !important;
          display: block !important;
          overflow: visible !important;
          page-break-after: auto !important;
          break-after: auto !important;
          font-size: 10.5pt !important;
          line-height: 1.22 !important;
        }
        .afs-pdf-export-host #afs-cover {
          height: 297mm !important;
          min-height: 297mm !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          padding: 0 22mm !important;
        }
        .afs-pdf-export-host #afs-cover h1 {
          font-size: 16px !important;
          line-height: 1.12 !important;
          margin: 0 0 3mm 0 !important;
          font-weight: 900 !important;
        }
        .afs-pdf-export-host #afs-cover p,
        .afs-pdf-export-host #afs-cover div,
        .afs-pdf-export-host #afs-cover span {
          font-size: 10.5px !important;
          line-height: 1.28 !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader {
          margin: 0 0 8mm 0 !important;
          padding: 0 0 1.8mm 0 !important;
          border-bottom: 2px solid #111827 !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader h1 {
          font-size: 11.8pt !important;
          line-height: 1.10 !important;
          margin: 0 0 1mm 0 !important;
          font-weight: 900 !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader p {
          font-size: 8.6pt !important;
          line-height: 1.12 !important;
          margin: 0.5mm 0 0 0 !important;
          font-weight: 700 !important;
        }
        .afs-pdf-export-host h2 {
          font-size: 15pt !important;
          line-height: 1.12 !important;
          margin: 0 0 5mm 0 !important;
          padding-bottom: 1.6mm !important;
          border-bottom: 2px solid #111827 !important;
          font-weight: 900 !important;
        }
        .afs-pdf-export-host h3 {
          font-size: 10.2pt !important;
          line-height: 1.22 !important;
          margin: 0 0 2.4mm 0 !important;
          font-weight: 900 !important;
        }
        .afs-pdf-export-host h4 {
          font-size: 10.2pt !important;
          line-height: 1.20 !important;
          margin: 3mm 0 1mm 0 !important;
          font-weight: 900 !important;
        }
        .afs-pdf-export-host p,
        .afs-pdf-export-host td,
        .afs-pdf-export-host th,
        .afs-pdf-export-host span,
        .afs-pdf-export-host div {
          font-size: 10.5pt !important;
          line-height: 1.22 !important;
        }
        .afs-pdf-export-host table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        .afs-pdf-export-host #afs-directors-report p,
        .afs-pdf-export-host #afs-directors-report td,
        .afs-pdf-export-host #afs-directors-report th,
        .afs-pdf-export-host #afs-directors-report span,
        .afs-pdf-export-host #afs-directors-report div {
          font-size: 10.2pt !important;
          line-height: 1.20 !important;
        }
        .afs-pdf-export-host #afs-directors-report h4 {
          font-size: 9.9pt !important;
          margin: 3mm 0 1mm 0 !important;
        }
        .afs-pdf-export-host #afs-compilation-report {
          min-height: 297mm !important;
          height: 297mm !important;
          padding: 14mm 14mm 14mm 14mm !important;
          overflow: hidden !important;
        }
        .afs-pdf-export-host #afs-compilation-report .afs-page-content,
        .afs-pdf-export-host #afs-compilation-report .afs-compilation-report {
          height: 269mm !important;
          min-height: 269mm !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .afs-pdf-export-host #afs-compilation-report .afs-compilation-letterhead-top img {
          width: 182mm !important;
          max-width: 182mm !important;
          height: auto !important;
          display: block !important;
          object-fit: contain !important;
        }
        .afs-pdf-export-host #afs-compilation-report .afs-compilation-letterhead-bottom {
          position: absolute !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
        }
        .afs-pdf-export-host #afs-compilation-report .afs-compilation-letterhead-bottom img {
          width: 182mm !important;
          max-width: 182mm !important;
          height: auto !important;
          display: block !important;
          object-fit: contain !important;
        }
        .afs-pdf-export-host #afs-compilation-report h3 {
          font-size: 10pt !important;
          line-height: 1.12 !important;
          margin: 0 0 3mm 0 !important;
          padding-bottom: 1.4mm !important;
          border-bottom: 1px solid #111827 !important;
          text-transform: uppercase !important;
        }
        .afs-pdf-export-host #afs-compilation-report h4 {
          font-size: 7.5pt !important;
          line-height: 1.12 !important;
          margin: 1.7mm 0 0.8mm 0 !important;
        }
        .afs-pdf-export-host #afs-compilation-report p,
        .afs-pdf-export-host #afs-compilation-report td,
        .afs-pdf-export-host #afs-compilation-report th,
        .afs-pdf-export-host #afs-compilation-report span,
        .afs-pdf-export-host #afs-compilation-report div {
          font-size: 7.5pt !important;
          line-height: 1.18 !important;
        }
        .afs-pdf-export-host #afs-compilation-report p { margin: 0 0 1.9mm 0 !important; }
        .afs-pdf-export-host #afs-compilation-report .afs-compilation-letterhead-top { margin-bottom: 4mm !important; }
        .afs-pdf-export-host .afs-page-footer { display: none !important; }
        .afs-pdf-export-host .afs-print-hide { display: none !important; }
        .afs-pdf-export-host .afs-page-break-before { break-before: page !important; page-break-before: always !important; }
        .afs-pdf-export-host .afs-page-footer { display: none !important; }
        .afs-pdf-export-host .afs-print-page { page-break-after: auto !important; break-after: auto !important; }
        .afs-pdf-export-host #afs-accounting-policies h4 { margin: 1.5mm 0 0.7mm 0 !important; }
        .afs-pdf-export-host #afs-accounting-policies .policySection { margin-bottom: 2.4mm !important; padding-bottom: 0 !important; border-bottom: none !important; page-break-inside: avoid !important; break-inside: avoid !important; }
        .afs-pdf-export-host #afs-accounting-policies p { margin: 0 0 1mm 0 !important; }
        .afs-pdf-export-host #afs-directors-report table,
        .afs-pdf-export-host #afs-notes table { page-break-inside: avoid !important; break-inside: avoid !important; }
        .afs-pdf-export-host #afs-notes h4 { margin-top: 3mm !important; }
        .afs-pdf-export-host .loanTermsInlineLabel { display: none !important; }
        .afs-pdf-export-host .loanTermsInlineCombined { padding: 0.8mm 0 2.2mm 5mm !important; border-bottom: none !important; }
        .afs-pdf-export-host .loanTermsInput { border: none !important; padding: 0 !important; }
        .afs-pdf-export-host .noteAmount,
        .afs-pdf-export-host .noteTd { border-bottom: none !important; padding-top: 1.5mm !important; padding-bottom: 1.5mm !important; }
        .afs-pdf-export-host .noteTotalAmount { border-top: 1.2px solid #111827 !important; border-bottom: 2px solid #111827 !important; }

        .afs-pdf-export-host #afs-notes .noteRepeatedHeader { display: none !important; }
        .afs-pdf-export-host #afs-notes .noteMasterHeader { display: table !important; margin: 2mm 0 4mm 0 !important; }
        .afs-pdf-export-host #afs-notes .noteSectionAnchor { margin-top: 5mm !important; padding-top: 3mm !important; }
        .afs-pdf-export-host #afs-notes .noteSectionAnchor:first-of-type { margin-top: 3mm !important; }
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount { padding-top: 1.1mm !important; padding-bottom: 1.1mm !important; }

        /* V54: remove repeated note years and light divider noise */
        .afs-pdf-export-host #afs-notes .noteRepeatedHeader { display: none !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable thead { display: none !important; }
        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff { border-top: 0 !important; padding-top: 1.5mm !important; margin-top: 4mm !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable { margin-top: 1mm !important; margin-bottom: 3mm !important; }
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount { font-size: 10.2pt !important; line-height: 1.16 !important; }
        .afs-pdf-export-host #afs-accounting-policies .policySection { margin-bottom: 1.2mm !important; padding-bottom: 0 !important; border-bottom: 0 !important; break-inside: auto !important; page-break-inside: auto !important; }
        .afs-pdf-export-host #afs-accounting-policies h4 { margin: 1.2mm 0 0.4mm 0 !important; }
        .afs-pdf-export-host #afs-accounting-policies p { margin: 0 0 0.55mm 0 !important; }
        .afs-pdf-export-host #afs-cover h1 { font-size: 14.5px !important; margin-bottom: 1.5mm !important; }
        .afs-pdf-export-host #afs-cover p { margin: 0.45mm 0 !important; }

        /* V55: final report presentation cleanup */
        .afs-pdf-export-host #afs-cover { overflow: hidden !important; }
        .afs-pdf-export-host #afs-cover h1 { font-size: 12.5px !important; margin-bottom: 0.8mm !important; }
        .afs-pdf-export-host #afs-cover .afs-page-content,
        .afs-pdf-export-host #afs-cover .afs-page-content > div { min-height: 0 !important; height: 100% !important; }

        .afs-pdf-export-host #afs-general-info td,
        .afs-pdf-export-host #afs-index td { border-bottom: 0 !important; }
        .afs-pdf-export-host #afs-index .indexDots,
        .afs-pdf-export-host #afs-index td:nth-child(2) { border-bottom: 0 !important; }

        .afs-pdf-export-host #afs-accounting-policies .policySection { margin-bottom: 0.8mm !important; }
        .afs-pdf-export-host #afs-accounting-policies h4 { margin: 0.9mm 0 0.25mm 0 !important; font-size: 10.1pt !important; }
        .afs-pdf-export-host #afs-accounting-policies p { margin: 0 0 0.25mm 0 !important; }

        .afs-pdf-export-host .reportSectionBlock { margin-bottom: 1.8mm !important; page-break-inside: avoid !important; break-inside: avoid !important; }
        .afs-pdf-export-host #afs-directors-report h4 { margin: 2.1mm 0 0.6mm 0 !important; }
        .afs-pdf-export-host #afs-directors-report p { margin: 0 0 1.1mm 0 !important; }

        .afs-pdf-export-host #afs-notes .noteStatementTable,
        .afs-pdf-export-host #afs-notes .noteStatementTable tbody,
        .afs-pdf-export-host #afs-notes .noteStatementTable tr,
        .afs-pdf-export-host #afs-notes .noteStatementTable td,
        .afs-pdf-export-host #afs-notes .noteStatementTable span,
        .afs-pdf-export-host #afs-notes .noteStatementTable div { border-bottom: 0 !important; text-decoration: none !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable thead { display: none !important; }
        .afs-pdf-export-host #afs-notes .noteTh,
        .afs-pdf-export-host #afs-notes .noteThRight { display: none !important; border: 0 !important; padding: 0 !important; }
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount { border-top: 1.2px solid #111827 !important; border-bottom: 1.8px solid #111827 !important; }
        .afs-pdf-export-host #afs-notes h4 { margin: 3mm 0 1mm 0 !important; }
        .afs-pdf-export-host #afs-notes p { margin: 0 0 1mm 0 !important; }

        .afs-pdf-export-host #afs-compilation-report { height: 297mm !important; min-height: 297mm !important; overflow: hidden !important; }
        .afs-pdf-export-host #afs-compilation-report .afs-page-content,
        .afs-pdf-export-host #afs-compilation-report .afs-compilation-report { height: 269mm !important; min-height: 269mm !important; overflow: hidden !important; }
        .afs-pdf-export-host #afs-compilation-report .afs-compilation-letterhead-top img,
        .afs-pdf-export-host #afs-compilation-report .afs-compilation-letterhead-bottom img { width: 182mm !important; max-width: 182mm !important; height: auto !important; object-fit: contain !important; }


        /* V56_FINAL_LAYOUT_CLEANUP */
        .afs-pdf-export-host .statementModeToolbar,
        .afs-pdf-export-host .afs-screen-only,
        .afs-pdf-export-host .print-hide,
        .afs-pdf-export-host .afs-print-hide { display: none !important; }

        .afs-pdf-export-host #afs-cover h1 { font-size: 14px !important; margin-bottom: 1.8mm !important; }
        .afs-pdf-export-host #afs-cover p { margin: 1.4mm 0 !important; }

        .afs-pdf-export-host .afs-print-page {
          padding: 13mm 14mm 18mm 14mm !important;
          font-size: 10pt !important;
          line-height: 1.16 !important;
        }
        .afs-pdf-export-host p,
        .afs-pdf-export-host td,
        .afs-pdf-export-host th,
        .afs-pdf-export-host span,
        .afs-pdf-export-host div {
          font-size: 10pt !important;
          line-height: 1.16 !important;
        }
        .afs-pdf-export-host h2 {
          font-size: 14pt !important;
          margin: 0 0 5mm 0 !important;
          padding-bottom: 1.4mm !important;
          border-bottom: 2px solid #111827 !important;
        }
        .afs-pdf-export-host h3 { font-size: 10pt !important; margin: 0 0 2mm 0 !important; }
        .afs-pdf-export-host h4 { font-size: 9.6pt !important; margin: 2.2mm 0 0.7mm 0 !important; }

        .afs-pdf-export-host #afs-directors-responsibilities p,
        .afs-pdf-export-host #afs-directors-report p {
          margin: 0 0 1.6mm 0 !important;
          line-height: 1.14 !important;
        }
        .afs-pdf-export-host #afs-directors-report h4 { margin: 2.2mm 0 0.6mm 0 !important; }
        .afs-pdf-export-host #afs-directors-report table { margin: 2.5mm 0 2.5mm 0 !important; }

        /* remove messy light row gridlines - keep only financial total rules */
        .afs-pdf-export-host #afs-index td,
        .afs-pdf-export-host #afs-general-info td,
        .afs-pdf-export-host #afs-directors-report td,
        .afs-pdf-export-host #afs-sce td,
        .afs-pdf-export-host #afs-notes td,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td {
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-pdf-export-host #afs-notes td,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td,
        .afs-pdf-export-host #afs-sce td { padding-top: 2.1mm !important; padding-bottom: 1.4mm !important; }
        .afs-pdf-export-host #afs-notes th,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-tax-computation th {
          border-top: 1.2px solid #111827 !important;
          border-bottom: 1.2px solid #111827 !important;
          padding-top: 2mm !important;
          padding-bottom: 1.4mm !important;
        }
        .afs-pdf-export-host #afs-sce th {
          border-bottom: 1.2px solid #111827 !important;
          padding-top: 2mm !important;
          padding-bottom: 1.4mm !important;
        }

        .afs-pdf-export-host #afs-notes .noteStatementTable thead { display: table-header-group !important; }
        .afs-pdf-export-host #afs-notes .noteThRight { display: table-cell !important; border-top: 1.2px solid #111827 !important; border-bottom: 1.2px solid #111827 !important; padding: 2mm 0 1.4mm 7px !important; }
        .afs-pdf-export-host #afs-notes .noteTh { border-top: 1.2px solid #111827 !important; border-bottom: 1.2px solid #111827 !important; }
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount { border: 0 !important; text-decoration: none !important; padding-top: 1.4mm !important; padding-bottom: 1.1mm !important; }
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-detailed-income td[style*="font-weight: 900"],
        .afs-pdf-export-host #afs-tax-computation td[style*="font-weight: 900"] {
          border-top: 1px solid #111827 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff { margin-top: 3mm !important; padding-top: 1mm !important; }

        .afs-pdf-export-host #afs-tax-computation [style*="#ef4444"],
        .afs-pdf-export-host #afs-tax-computation [style*="#b91c1c"] {
          border-top: 1px solid #b91c1c !important;
          color: #b91c1c !important;
        }

        /* V57: remove row-line noise and stop ugly mid-section page cuts */
        .afs-pdf-export-host #afs-sce table,
        .afs-pdf-export-host #afs-sce thead,
        .afs-pdf-export-host #afs-sce tbody,
        .afs-pdf-export-host #afs-sce tr,
        .afs-pdf-export-host #afs-sce th,
        .afs-pdf-export-host #afs-sce td,
        .afs-pdf-export-host #afs-sce span,
        .afs-pdf-export-host #afs-sce div,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-detailed-income thead,
        .afs-pdf-export-host #afs-detailed-income tbody,
        .afs-pdf-export-host #afs-detailed-income tr,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation table,
        .afs-pdf-export-host #afs-tax-computation thead,
        .afs-pdf-export-host #afs-tax-computation tbody,
        .afs-pdf-export-host #afs-tax-computation tr,
        .afs-pdf-export-host #afs-tax-computation th,
        .afs-pdf-export-host #afs-tax-computation td {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-pdf-export-host #afs-sce th,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-tax-computation th {
          border-bottom: 1px solid #111827 !important;
        }
        .afs-pdf-export-host #afs-sce td,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td {
          padding-top: 1.15mm !important;
          padding-bottom: 1.05mm !important;
        }
        .afs-pdf-export-host #afs-cash-flow .afs-print-hide { display: none !important; }
        .afs-pdf-export-host #afs-notes .noteMasterHeader { display: table !important; margin: 1mm 0 2.5mm 0 !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable { margin-top: 0.5mm !important; margin-bottom: 3.5mm !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable thead { display: table-header-group !important; }
        .afs-pdf-export-host #afs-notes .noteTh,
        .afs-pdf-export-host #afs-notes .noteThRight {
          display: table-cell !important;
          border-top: 1px solid #111827 !important;
          border-bottom: 0 !important;
          padding: 1.2mm 0 0.9mm 0 !important;
          text-decoration: none !important;
        }
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-notes td,
        .afs-pdf-export-host #afs-notes tr,
        .afs-pdf-export-host #afs-notes span,
        .afs-pdf-export-host #afs-notes div {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount { font-weight: 900 !important; }
        .afs-pdf-export-host #afs-notes h4 { margin: 3.5mm 0 1mm 0 !important; page-break-after: avoid !important; break-after: avoid !important; }
        .afs-pdf-export-host #afs-notes p { margin: 0 0 0.9mm 0 !important; }
        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff {
          margin-top: 4mm !important;
          padding-top: 0 !important;
          border-top: 0 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .afs-pdf-export-host #afs-directors-responsibilities p { margin: 0 0 1.15mm 0 !important; line-height: 1.12 !important; }
        .afs-pdf-export-host #afs-directors-report .reportSectionBlock { margin-bottom: 2.2mm !important; break-inside: avoid !important; page-break-inside: avoid !important; }
        .afs-pdf-export-host #afs-directors-report h4 { margin: 2.2mm 0 0.65mm 0 !important; }
        .afs-pdf-export-host #afs-directors-report p { margin: 0 0 1.1mm 0 !important; }

        /* V58 CONTROLLED EXPORT FOUNDATION - stop fighting inherited table borders and bad page cuts */
        .afs-pdf-export-host .afs-print-page {
          min-height: auto !important;
          height: auto !important;
          padding: 14mm 18mm 22mm 18mm !important;
          font-size: 9.4pt !important;
          line-height: 1.16 !important;
        }
        .afs-pdf-export-host #afs-cover {
          min-height: 297mm !important;
          height: 297mm !important;
          padding: 0 22mm !important;
        }
        .afs-pdf-export-host #afs-cover h1 {
          font-size: 13px !important;
          margin: 0 0 1.5mm 0 !important;
          line-height: 1.05 !important;
        }
        .afs-pdf-export-host #afs-cover p { margin: 0.8mm 0 !important; }
        .afs-pdf-export-host p,
        .afs-pdf-export-host td,
        .afs-pdf-export-host th,
        .afs-pdf-export-host span,
        .afs-pdf-export-host div {
          font-size: 9.4pt !important;
          line-height: 1.16 !important;
        }
        .afs-pdf-export-host h2 {
          font-size: 13.2pt !important;
          margin: 0 0 4mm 0 !important;
          padding-bottom: 1.2mm !important;
          border-bottom: 1.4px solid #111827 !important;
        }
        .afs-pdf-export-host h4 {
          font-size: 9.4pt !important;
          margin: 2mm 0 0.7mm 0 !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader {
          margin: 0 0 7mm 0 !important;
          padding-bottom: 1.4mm !important;
          border-bottom: 1.4px solid #111827 !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader h1 { font-size: 9.6pt !important; }
        .afs-pdf-export-host .afsPageEntityHeader p { font-size: 7.8pt !important; }
        .afs-pdf-export-host #afs-index td,
        .afs-pdf-export-host #afs-general-info td,
        .afs-pdf-export-host #afs-socie td,
        .afs-pdf-export-host #afs-socie th,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-tax-computation td,
        .afs-pdf-export-host #afs-tax-computation th,
        .afs-pdf-export-host #afs-notes td,
        .afs-pdf-export-host #afs-notes tr,
        .afs-pdf-export-host #afs-notes th {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-pdf-export-host #afs-index td { padding-top: 2mm !important; padding-bottom: 1.3mm !important; }
        .afs-pdf-export-host #afs-directors-responsibilities p,
        .afs-pdf-export-host #afs-directors-report p {
          margin: 0 0 1.15mm 0 !important;
          line-height: 1.15 !important;
        }
        .afs-pdf-export-host #afs-directors-report .reportSectionBlock {
          margin-bottom: 2.2mm !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .afs-pdf-export-host #afs-sce table,
        .afs-pdf-export-host #afs-socie table,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table,
        .afs-pdf-export-host #afs-notes .noteStatementTable {
          border-collapse: collapse !important;
        }
        .afs-pdf-export-host #afs-sce thead th,
        .afs-pdf-export-host #afs-socie thead th,
        .afs-pdf-export-host #afs-detailed-income thead th,
        .afs-pdf-export-host #afs-tax-computation thead th,
        .afs-pdf-export-host #afs-notes .noteStatementTable thead th {
          border-top: 1.2px solid #111827 !important;
          border-bottom: 1.2px solid #111827 !important;
          padding-top: 1.2mm !important;
          padding-bottom: 1mm !important;
        }
        .afs-pdf-export-host #afs-notes .noteStatementTable thead,
        .afs-pdf-export-host #afs-notes .noteRepeatedHeader {
          display: table-header-group !important;
        }
        .afs-pdf-export-host #afs-notes .noteMasterHeader { display: none !important; }
        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff {
          margin-top: 4mm !important;
          padding-top: 0 !important;
          border-top: 0 !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
        }
        .afs-pdf-export-host #afs-notes h4 { margin: 3.2mm 0 1mm 0 !important; }
        .afs-pdf-export-host #afs-notes p { margin: 0 0 1mm 0 !important; }
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-detailed-income td[style*="font-weight: 900"],
        .afs-pdf-export-host #afs-tax-computation td[style*="font-weight: 900"],
        .afs-pdf-export-host #afs-sce td[style*="font-weight: 900"],
        .afs-pdf-export-host #afs-socie td[style*="font-weight: 900"] {
          border-top: 1px solid #111827 !important;
        }
        .afs-pdf-export-host .loanTermsInlineLabel { display: none !important; }
        .afs-pdf-export-host .loanTermsInlineCombined { padding-left: 7mm !important; }

      `;

      exportStyle.textContent += `

        /* V59: CaseWare-style PDF foundation fixes */
        .afs-pdf-export-host,
        .afs-pdf-export-host * {
          font-family: Arial, Helvetica, sans-serif !important;
          font-stretch: normal !important;
          letter-spacing: normal !important;
        }

        .afs-pdf-export-host .afs-print-page {
          padding: 13mm 18mm 18mm 18mm !important;
          font-size: 9.6pt !important;
          line-height: 1.18 !important;
        }

        .afs-pdf-export-host p,
        .afs-pdf-export-host td,
        .afs-pdf-export-host th,
        .afs-pdf-export-host span,
        .afs-pdf-export-host div {
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 9.6pt !important;
          line-height: 1.18 !important;
        }

        .afs-pdf-export-host h2 {
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 13pt !important;
          line-height: 1.12 !important;
          margin: 0 0 5mm 0 !important;
          padding-bottom: 1.3mm !important;
          border-bottom: 1.4px solid #111827 !important;
          text-decoration: none !important;
        }

        .afs-pdf-export-host h3,
        .afs-pdf-export-host h4 {
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 9.7pt !important;
          line-height: 1.14 !important;
          margin: 2.4mm 0 0.8mm 0 !important;
          padding: 0 !important;
          text-decoration: none !important;
        }

        .afs-pdf-export-host #afs-cover h1 {
          font-size: 11.8pt !important;
          line-height: 1.12 !important;
          margin: 0 0 1mm 0 !important;
        }
        .afs-pdf-export-host #afs-cover p { margin: 0.6mm 0 !important; }

        .afs-pdf-export-host .afsPageEntityHeader {
          margin: 0 0 7mm 0 !important;
          padding-bottom: 1.4mm !important;
          border-bottom: 1.4px solid #111827 !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader h1 { font-size: 9.4pt !important; line-height: 1.05 !important; margin: 0 0 0.6mm 0 !important; }
        .afs-pdf-export-host .afsPageEntityHeader p { font-size: 7.7pt !important; line-height: 1.08 !important; margin: 0.25mm 0 0 0 !important; }

        /* no index/general-information row rules */
        .afs-pdf-export-host #afs-index td,
        .afs-pdf-export-host #afs-general-info td,
        .afs-pdf-export-host #afs-index .indexDots {
          border: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }

        /* Directors pages: break cleanly and stop mid-paragraph clipping */
        .afs-pdf-export-host #afs-directors-responsibilities p,
        .afs-pdf-export-host #afs-directors-report p {
          margin: 0 0 1.35mm 0 !important;
          line-height: 1.17 !important;
          orphans: 3 !important;
          widows: 3 !important;
        }
        .afs-pdf-export-host #afs-directors-report .reportSectionBlock {
          margin: 0 0 2.2mm 0 !important;
          padding: 0 !important;
          border: 0 !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .afs-pdf-export-host #afs-directors-report table,
        .afs-pdf-export-host #afs-directors-report tr,
        .afs-pdf-export-host #afs-directors-report td,
        .afs-pdf-export-host #afs-directors-report th {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        /* Financial tables: remove the noisy light row lines everywhere */
        .afs-pdf-export-host #afs-sce table,
        .afs-pdf-export-host #afs-sce thead,
        .afs-pdf-export-host #afs-sce tbody,
        .afs-pdf-export-host #afs-sce tr,
        .afs-pdf-export-host #afs-sce th,
        .afs-pdf-export-host #afs-sce td,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-detailed-income thead,
        .afs-pdf-export-host #afs-detailed-income tbody,
        .afs-pdf-export-host #afs-detailed-income tr,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation table,
        .afs-pdf-export-host #afs-tax-computation thead,
        .afs-pdf-export-host #afs-tax-computation tbody,
        .afs-pdf-export-host #afs-tax-computation tr,
        .afs-pdf-export-host #afs-tax-computation th,
        .afs-pdf-export-host #afs-tax-computation td,
        .afs-pdf-export-host #afs-notes table,
        .afs-pdf-export-host #afs-notes thead,
        .afs-pdf-export-host #afs-notes tbody,
        .afs-pdf-export-host #afs-notes tr,
        .afs-pdf-export-host #afs-notes td,
        .afs-pdf-export-host #afs-notes th {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }

        /* Keep only clean header rules. No line directly under heading before the table. */
        .afs-pdf-export-host #afs-sfp thead th,
        .afs-pdf-export-host #afs-sci thead th,
        .afs-pdf-export-host #afs-sce thead th,
        .afs-pdf-export-host #afs-cash-flow thead th,
        .afs-pdf-export-host #afs-detailed-income thead th,
        .afs-pdf-export-host #afs-tax-computation thead th,
        .afs-pdf-export-host #afs-notes .noteStatementTable thead th {
          border-top: 1px solid #111827 !important;
          border-bottom: 1px solid #111827 !important;
          padding-top: 1.4mm !important;
          padding-bottom: 1.3mm !important;
        }

        /* Notes must show year labels at each note table */
        .afs-pdf-export-host #afs-notes .noteStatementTable thead,
        .afs-pdf-export-host #afs-notes .noteRepeatedHeader {
          display: table-header-group !important;
        }
        .afs-pdf-export-host #afs-notes .noteTh,
        .afs-pdf-export-host #afs-notes .noteThRight {
          display: table-cell !important;
          border-top: 1px solid #111827 !important;
          border-bottom: 1px solid #111827 !important;
          padding: 1.3mm 0 1.1mm 0 !important;
        }
        .afs-pdf-export-host #afs-notes .noteMasterHeader { display: none !important; }
        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff {
          margin-top: 3.2mm !important;
          padding-top: 0 !important;
          border-top: 0 !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .afs-pdf-export-host #afs-notes h4 { margin: 2.2mm 0 0.9mm 0 !important; }
        .afs-pdf-export-host #afs-notes p { margin: 0 0 0.8mm 0 !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable { margin-top: 1.1mm !important; margin-bottom: 3mm !important; }
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount {
          padding-top: 1.0mm !important;
          padding-bottom: 1.0mm !important;
        }
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.4px solid #111827 !important;
          padding-top: 1.2mm !important;
          padding-bottom: 1.2mm !important;
        }
        .afs-pdf-export-host .loanTermsInlineLabel { display: none !important; }
        .afs-pdf-export-host .loanTermsInlineCombined {
          padding: 0.4mm 0 1.2mm 5mm !important;
          border: 0 !important;
        }

        /* SCE: remove ugly row grid; use spacing not lines */
        .afs-pdf-export-host #afs-sce td,
        .afs-pdf-export-host #afs-sce th {
          padding-top: 1.05mm !important;
          padding-bottom: 1.05mm !important;
          border: 0 !important;
        }
        .afs-pdf-export-host #afs-sce thead th { border-bottom: 1px solid #111827 !important; }

        /* Detailed income and tax: lines are too tight; use clean row spacing */
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td {
          padding-top: 1.05mm !important;
          padding-bottom: 1.05mm !important;
          border: 0 !important;
        }
        .afs-pdf-export-host #afs-detailed-income td[style*="font-weight: 900"],
        .afs-pdf-export-host #afs-tax-computation td[style*="font-weight: 900"] {
          border-top: 1px solid #111827 !important;
          border-bottom: 0 !important;
          padding-top: 1.6mm !important;
          padding-bottom: 1.4mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income tr:last-child td,
        .afs-pdf-export-host #afs-tax-computation tr:last-child td {
          border-bottom: 1.4px solid #111827 !important;
        }

        /* Compilation report stays on the letterhead page only */
        .afs-pdf-export-host #afs-compilation-report {
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          overflow: hidden !important;
        }


        /* V60: CaseWare/Draftworx line discipline + cleaner front page */
        .afs-pdf-export-host a,
        .afs-pdf-export-host a *,
        .afs-pdf-export-host [style*="text-decoration"],
        .afs-pdf-export-host [style*="textDecoration"] {
          text-decoration: none !important;
        }

        .afs-pdf-export-host #afs-cover {
          padding: 0 30mm !important;
        }
        .afs-pdf-export-host #afs-cover h1 {
          font-size: 10.8pt !important;
          line-height: 1.12 !important;
          margin: 0 0 1.8mm 0 !important;
          letter-spacing: 0.1px !important;
        }
        .afs-pdf-export-host #afs-cover p {
          font-size: 9.3pt !important;
          line-height: 1.22 !important;
          margin: 0.6mm 0 !important;
        }
        .afs-pdf-export-host #afs-cover p:first-of-type {
          margin-bottom: 5mm !important;
        }
        .afs-pdf-export-host #afs-cover p:last-child {
          margin-top: 5mm !important;
        }

        /* Use shorter, statement-style note/detail/tax tables instead of full-width long rules */
        .afs-pdf-export-host #afs-notes .noteStatementTable,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table {
          width: 156mm !important;
          max-width: 156mm !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }

        /* Remove row/grid/label rules. Keep rules only where amounts need accountant-style emphasis. */
        .afs-pdf-export-host #afs-notes .noteStatementTable td,
        .afs-pdf-export-host #afs-notes .noteStatementTable th,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-tax-computation td,
        .afs-pdf-export-host #afs-tax-computation th {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }

        /* Notes: keep year headings, but no long ruler through every note. */
        .afs-pdf-export-host #afs-notes .noteStatementTable thead { display: table-header-group !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable thead th {
          border-top: 1px solid #111827 !important;
          border-bottom: 1px solid #111827 !important;
          padding: 1.05mm 0 0.9mm 0 !important;
        }
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
          border: 0 !important;
        }
        .afs-pdf-export-host #afs-notes .noteTotalLabel {
          border: 0 !important;
          padding-top: 1.05mm !important;
          padding-bottom: 1.05mm !important;
        }
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.4px solid #111827 !important;
          padding-top: 1.05mm !important;
          padding-bottom: 1.05mm !important;
        }
        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff {
          margin-top: 4.2mm !important;
          padding-top: 0 !important;
          border: 0 !important;
        }
        .afs-pdf-export-host #afs-notes h4 { margin: 3.2mm 0 0.9mm 0 !important; }
        .afs-pdf-export-host #afs-notes p { margin: 0 0 0.75mm 0 !important; }

        /* Loan terms directly under the loan account, no "Terms" label, no indent. */
        .afs-pdf-export-host .loanTermsInlineLabel { display: none !important; }
        .afs-pdf-export-host .loanTermsInlineCombined {
          padding: 0.15mm 0 0.95mm 0 !important;
          border: 0 !important;
          text-indent: 0 !important;
        }
        .afs-pdf-export-host .loanTermsInput { padding: 0 !important; border: 0 !important; text-indent: 0 !important; }

        /* Detail income and tax: stop the long first-column rules. Amount columns only get emphasis. */
        .afs-pdf-export-host #afs-detailed-income thead th,
        .afs-pdf-export-host #afs-tax-computation thead th {
          border-top: 1px solid #111827 !important;
          border-bottom: 1px solid #111827 !important;
          padding-top: 1.05mm !important;
          padding-bottom: 0.95mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
          border: 0 !important;
        }
        .afs-pdf-export-host #afs-detailed-income td:first-child,
        .afs-pdf-export-host #afs-tax-computation td:first-child {
          border: 0 !important;
          text-decoration: none !important;
        }
        .afs-pdf-export-host #afs-detailed-income td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td:not(:first-child) {
          border: 0 !important;
        }
        .afs-pdf-export-host #afs-detailed-income td[style*="font-weight: 900"]:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td[style*="font-weight: 900"]:not(:first-child),
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:not(:first-child) {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.4px solid #111827 !important;
          padding-top: 1.15mm !important;
          padding-bottom: 1.05mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income td[style*="font-weight: 900"]:first-child,
        .afs-pdf-export-host #afs-tax-computation td[style*="font-weight: 900"]:first-child,
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:first-child,
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:first-child {
          border: 0 !important;
          padding-top: 1.15mm !important;
          padding-bottom: 1.05mm !important;
        }
        .afs-pdf-export-host #afs-tax-computation div[style*="border-bottom"],
        .afs-pdf-export-host #afs-tax-computation div[style*="borderBottom"],
        .afs-pdf-export-host #afs-tax-computation [style*="#e2e8f0"],
        .afs-pdf-export-host #afs-tax-computation [style*="#cbd5e1"] {
          border-bottom: 0 !important;
        }


        /* V62: real final override - removes visual noise and fixes page flow. */
        .afs-print-root,
        .afs-pdf-export-host,
        .afs-print-root *,
        .afs-pdf-export-host * {
          font-family: Arial, Helvetica, sans-serif !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-print-root .afs-print-page,
        .afs-pdf-export-host .afs-print-page {
          display: block !important;
          grid-template-rows: none !important;
          min-height: 297mm !important;
          padding: 12mm 18mm 19mm 18mm !important;
          overflow: visible !important;
        }
        .afs-print-root .afs-page-content,
        .afs-pdf-export-host .afs-page-content {
          display: block !important;
          min-height: 0 !important;
        }
        .afs-print-root .afsPageEntityHeader,
        .afs-pdf-export-host .afsPageEntityHeader {
          margin: 0 0 9mm 0 !important;
          padding: 0 0 2.8mm 0 !important;
          border-bottom: 1.5px solid #111827 !important;
        }
        .afs-print-root .afsPageEntityHeader h1,
        .afs-pdf-export-host .afsPageEntityHeader h1 {
          font-size: 10.8pt !important;
          line-height: 1.08 !important;
          margin: 0 0 0.7mm 0 !important;
        }
        .afs-print-root .afsPageEntityHeader p,
        .afs-pdf-export-host .afsPageEntityHeader p {
          font-size: 8pt !important;
          line-height: 1.10 !important;
          margin: 0.35mm 0 0 0 !important;
        }
        .afs-print-root h2,
        .afs-pdf-export-host h2 {
          font-size: 13pt !important;
          line-height: 1.12 !important;
          margin: 0 0 7mm 0 !important;
          padding-bottom: 2.2mm !important;
          border-bottom: 1.5px solid #111827 !important;
        }
        .afs-print-root h3,
        .afs-print-root h4,
        .afs-pdf-export-host h3,
        .afs-pdf-export-host h4 {
          text-decoration: none !important;
          border: 0 !important;
        }
        .afs-print-root #afs-index h2,
        .afs-pdf-export-host #afs-index h2 {
          margin-bottom: 8mm !important;
          padding-bottom: 2.4mm !important;
        }
        .afs-print-root #afs-index table,
        .afs-print-root #afs-index tr,
        .afs-print-root #afs-index td,
        .afs-pdf-export-host #afs-index table,
        .afs-pdf-export-host #afs-index tr,
        .afs-pdf-export-host #afs-index td {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
          background: transparent !important;
          background-image: none !important;
        }
        .afs-print-root #afs-index td,
        .afs-pdf-export-host #afs-index td {
          padding-top: 1.15mm !important;
          padding-bottom: 1.15mm !important;
        }
        .afs-print-root #afs-general-info table,
        .afs-print-root #afs-general-info tr,
        .afs-print-root #afs-general-info td,
        .afs-pdf-export-host #afs-general-info table,
        .afs-pdf-export-host #afs-general-info tr,
        .afs-pdf-export-host #afs-general-info td {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        .afs-print-root #afs-general-info td,
        .afs-pdf-export-host #afs-general-info td {
          padding-top: 1.6mm !important;
          padding-bottom: 1.6mm !important;
        }
        .afs-print-root #afs-directors-responsibilities p,
        .afs-pdf-export-host #afs-directors-responsibilities p {
          margin: 0 0 1.05mm 0 !important;
          line-height: 1.14 !important;
        }
        .afs-print-root #afs-directors-report .reportSectionBlock,
        .afs-pdf-export-host #afs-directors-report .reportSectionBlock {
          margin: 0 0 2.2mm 0 !important;
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }
        .afs-print-root #afs-directors-report p,
        .afs-pdf-export-host #afs-directors-report p {
          margin: 0 0 0.9mm 0 !important;
          line-height: 1.13 !important;
        }
        .afs-print-root #afs-directors-report table,
        .afs-print-root #afs-directors-report tr,
        .afs-print-root #afs-directors-report td,
        .afs-print-root #afs-directors-report th,
        .afs-pdf-export-host #afs-directors-report table,
        .afs-pdf-export-host #afs-directors-report tr,
        .afs-pdf-export-host #afs-directors-report td,
        .afs-pdf-export-host #afs-directors-report th {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        .afs-print-root #afs-directors-report thead th,
        .afs-pdf-export-host #afs-directors-report thead th {
          border-bottom: 1px solid #cbd5e1 !important;
        }

        /* Statements: only header rule + accountant amount rules, no stray top line before columns. */
        .afs-print-root #afs-sfp thead th,
        .afs-print-root #afs-sci thead th,
        .afs-print-root #afs-cash-flow thead th,
        .afs-pdf-export-host #afs-sfp thead th,
        .afs-pdf-export-host #afs-sci thead th,
        .afs-pdf-export-host #afs-cash-flow thead th {
          border-top: 0 !important;
          border-bottom: 1px solid #111827 !important;
        }
        .afs-print-root #afs-sfp td:first-child,
        .afs-print-root #afs-sci td:first-child,
        .afs-print-root #afs-cash-flow td:first-child,
        .afs-pdf-export-host #afs-sfp td:first-child,
        .afs-pdf-export-host #afs-sci td:first-child,
        .afs-pdf-export-host #afs-cash-flow td:first-child {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
        }

        /* SCE: absolutely no row underlines / first-column rules. */
        .afs-print-root #afs-sce table,
        .afs-print-root #afs-sce thead,
        .afs-print-root #afs-sce tbody,
        .afs-print-root #afs-sce tr,
        .afs-print-root #afs-sce th,
        .afs-print-root #afs-sce td,
        .afs-print-root #afs-sce div,
        .afs-print-root #afs-sce span,
        .afs-pdf-export-host #afs-sce table,
        .afs-pdf-export-host #afs-sce thead,
        .afs-pdf-export-host #afs-sce tbody,
        .afs-pdf-export-host #afs-sce tr,
        .afs-pdf-export-host #afs-sce th,
        .afs-pdf-export-host #afs-sce td,
        .afs-pdf-export-host #afs-sce div,
        .afs-pdf-export-host #afs-sce span {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-sce td,
        .afs-pdf-export-host #afs-sce td {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
        }

        /* Notes and schedules: no grid lines; short amount rules only for totals. */
        .afs-print-root #afs-notes .noteSectionAnchor,
        .afs-print-root #afs-notes .noteSectionAnchorOff,
        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff {
          margin-top: 4.2mm !important;
          padding-top: 0 !important;
          border: 0 !important;
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }
        .afs-print-root #afs-notes .noteStatementTable,
        .afs-pdf-export-host #afs-notes .noteStatementTable {
          width: 148mm !important;
          max-width: 148mm !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
          margin: 1.2mm 0 4mm 0 !important;
        }
        .afs-print-root #afs-notes .noteStatementTable col:first-child,
        .afs-pdf-export-host #afs-notes .noteStatementTable col:first-child { width: 86mm !important; }
        .afs-print-root #afs-notes .noteStatementTable col:nth-child(2),
        .afs-print-root #afs-notes .noteStatementTable col:nth-child(3),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(2),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(3) { width: 31mm !important; }
        .afs-print-root #afs-notes table,
        .afs-print-root #afs-notes tr,
        .afs-print-root #afs-notes th,
        .afs-print-root #afs-notes td,
        .afs-print-root #afs-notes div,
        .afs-print-root #afs-notes span,
        .afs-pdf-export-host #afs-notes table,
        .afs-pdf-export-host #afs-notes tr,
        .afs-pdf-export-host #afs-notes th,
        .afs-pdf-export-host #afs-notes td,
        .afs-pdf-export-host #afs-notes div,
        .afs-pdf-export-host #afs-notes span {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-notes .noteStatementTable thead th,
        .afs-pdf-export-host #afs-notes .noteStatementTable thead th {
          border-bottom: 1px solid #111827 !important;
          padding-top: 0.9mm !important;
          padding-bottom: 0.9mm !important;
        }
        .afs-print-root #afs-notes .noteTd,
        .afs-print-root #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount {
          padding-top: 0.8mm !important;
          padding-bottom: 0.8mm !important;
          border: 0 !important;
        }
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalLabel {
          border: 0 !important;
          padding-top: 1.05mm !important;
          padding-bottom: 1.05mm !important;
        }
        .afs-print-root #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border-top: 0 !important;
          border-bottom: 1.3px solid #111827 !important;
          padding-top: 1.35mm !important;
          padding-bottom: 1.15mm !important;
          line-height: 1.25 !important;
        }
        .afs-print-root .loanTermsInlineCombined,
        .afs-pdf-export-host .loanTermsInlineCombined {
          padding: 0 0 1.05mm 0 !important;
          margin: 0 !important;
          text-indent: 0 !important;
          border: 0 !important;
        }
        .afs-print-root .loanTermsInput,
        .afs-pdf-export-host .loanTermsInput {
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          text-indent: 0 !important;
          font-size: inherit !important;
          line-height: inherit !important;
        }
        .afs-print-root .loanTermsInlineLabel,
        .afs-pdf-export-host .loanTermsInlineLabel { display: none !important; }

        /* Detailed income + tax computation: stop amount lines crossing through text/figures. */
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-tax-computation table,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table {
          width: 148mm !important;
          max-width: 148mm !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
          margin-left: 0 !important;
          margin-right: auto !important;
        }
        .afs-print-root #afs-detailed-income table col:first-child,
        .afs-print-root #afs-tax-computation table col:first-child,
        .afs-pdf-export-host #afs-detailed-income table col:first-child,
        .afs-pdf-export-host #afs-tax-computation table col:first-child { width: 86mm !important; }
        .afs-print-root #afs-detailed-income table col:nth-child(2),
        .afs-print-root #afs-detailed-income table col:nth-child(3),
        .afs-print-root #afs-tax-computation table col:nth-child(2),
        .afs-print-root #afs-tax-computation table col:nth-child(3),
        .afs-pdf-export-host #afs-detailed-income table col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income table col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation table col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation table col:nth-child(3) { width: 31mm !important; }
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-detailed-income thead,
        .afs-print-root #afs-detailed-income tbody,
        .afs-print-root #afs-detailed-income tr,
        .afs-print-root #afs-detailed-income th,
        .afs-print-root #afs-detailed-income td,
        .afs-print-root #afs-tax-computation table,
        .afs-print-root #afs-tax-computation thead,
        .afs-print-root #afs-tax-computation tbody,
        .afs-print-root #afs-tax-computation tr,
        .afs-print-root #afs-tax-computation th,
        .afs-print-root #afs-tax-computation td,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-detailed-income thead,
        .afs-pdf-export-host #afs-detailed-income tbody,
        .afs-pdf-export-host #afs-detailed-income tr,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation table,
        .afs-pdf-export-host #afs-tax-computation thead,
        .afs-pdf-export-host #afs-tax-computation tbody,
        .afs-pdf-export-host #afs-tax-computation tr,
        .afs-pdf-export-host #afs-tax-computation th,
        .afs-pdf-export-host #afs-tax-computation td {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-detailed-income thead th,
        .afs-print-root #afs-tax-computation thead th,
        .afs-pdf-export-host #afs-detailed-income thead th,
        .afs-pdf-export-host #afs-tax-computation thead th {
          border-bottom: 1px solid #111827 !important;
          padding-top: 0.95mm !important;
          padding-bottom: 0.95mm !important;
        }
        .afs-print-root #afs-detailed-income td,
        .afs-print-root #afs-tax-computation td,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
        }
        .afs-print-root #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-print-root #afs-tax-computation tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:not(:first-child) {
          border-bottom: 1.3px solid #111827 !important;
          padding-bottom: 1.2mm !important;
        }
        .afs-print-root #afs-tax-computation div,
        .afs-pdf-export-host #afs-tax-computation div {
          border-bottom: 0 !important;
        }

        /* Screen editor: remove artificial massive gaps; keep textareas normal. */
        .afs-print-root .inlineEditorTextarea,
        .afs-print-root textarea {
          white-space: pre-wrap !important;
        }

      `;



      exportStyle.textContent += `
        /* V63 hard reset: final rules win over all previous print experiments */
        .afs-pdf-export-host,
        .afs-pdf-export-host * {
          font-family: Arial, Helvetica, sans-serif !important;
          letter-spacing: normal !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-pdf-export-host .afs-print-page {
          width: 210mm !important;
          max-width: none !important;
          padding: 15mm 18mm 18mm 18mm !important;
          font-size: 9.2pt !important;
          line-height: 1.16 !important;
          overflow: visible !important;
        }
        .afs-pdf-export-host p,
        .afs-pdf-export-host td,
        .afs-pdf-export-host th,
        .afs-pdf-export-host span,
        .afs-pdf-export-host div {
          font-size: 9.2pt !important;
          line-height: 1.16 !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader {
          margin-bottom: 8.5mm !important;
          padding-bottom: 2.2mm !important;
          border-bottom: 1.2px solid #111827 !important;
        }
        .afs-pdf-export-host h2 {
          margin: 0 0 7mm 0 !important;
          padding-bottom: 2.2mm !important;
          border-bottom: 1.2px solid #111827 !important;
          font-size: 12.8pt !important;
          line-height: 1.15 !important;
        }
        .afs-pdf-export-host #afs-compilation-report h3 {
          margin: 0 0 3.5mm 0 !important;
          padding-bottom: 1.8mm !important;
          border-bottom: 1px solid #111827 !important;
        }
        .afs-pdf-export-host #afs-directors-responsibilities p {
          font-size: 8.15pt !important;
          line-height: 1.08 !important;
          margin: 0 0 1mm 0 !important;
        }
        .afs-pdf-export-host #afs-directors-report p,
        .afs-pdf-export-host #afs-directors-report td,
        .afs-pdf-export-host #afs-directors-report th {
          font-size: 8.15pt !important;
          line-height: 1.08 !important;
        }
        .afs-pdf-export-host #afs-directors-report h4 {
          font-size: 8.3pt !important;
          margin: 1.8mm 0 0.55mm 0 !important;
        }
        .afs-pdf-export-host #afs-directors-report .reportSectionBlock {
          margin-bottom: 1.6mm !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
        }
        .afs-pdf-export-host #afs-directors-report table {
          margin-top: 1mm !important;
          margin-bottom: 1mm !important;
        }

        /* SFP/SCI/SCF: no extra random line before column headings */
        .afs-pdf-export-host #afs-sfp table,
        .afs-pdf-export-host #afs-sci table,
        .afs-pdf-export-host #afs-cash-flow table {
          margin-top: 0 !important;
          border-top: 0 !important;
        }
        .afs-pdf-export-host #afs-sfp thead th,
        .afs-pdf-export-host #afs-sci thead th,
        .afs-pdf-export-host #afs-cash-flow thead th {
          border-top: 0 !important;
          border-bottom: 1px solid #111827 !important;
        }

        /* SCE: remove all row/first-column rules. Keep only column heading rule and amount-only totals. */
        .afs-pdf-export-host #afs-socie table,
        .afs-pdf-export-host #afs-socie thead,
        .afs-pdf-export-host #afs-socie tbody,
        .afs-pdf-export-host #afs-socie tr,
        .afs-pdf-export-host #afs-socie th,
        .afs-pdf-export-host #afs-socie td {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-pdf-export-host #afs-socie thead th {
          border-bottom: 1px solid #111827 !important;
          padding-bottom: 1.2mm !important;
        }
        .afs-pdf-export-host #afs-socie td:first-child,
        .afs-pdf-export-host #afs-socie th:first-child {
          border: 0 !important;
          text-decoration: none !important;
        }
        .afs-pdf-export-host #afs-socie td:not(:first-child) {
          border: 0 !important;
          text-align: right !important;
        }
        .afs-pdf-export-host #afs-socie tr:last-child td:not(:first-child) {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.2px solid #111827 !important;
        }

        /* Notes: Draftworx/CaseWare style - no row grid. Only headings and amount totals. */
        .afs-pdf-export-host #afs-notes table,
        .afs-pdf-export-host #afs-notes thead,
        .afs-pdf-export-host #afs-notes tbody,
        .afs-pdf-export-host #afs-notes tr,
        .afs-pdf-export-host #afs-notes th,
        .afs-pdf-export-host #afs-notes td,
        .afs-pdf-export-host #afs-notes p,
        .afs-pdf-export-host #afs-notes div,
        .afs-pdf-export-host #afs-notes span {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-pdf-export-host #afs-notes h4 {
          margin: 4.2mm 0 1.1mm 0 !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .afs-pdf-export-host #afs-notes p {
          margin: 0 0 1mm 0 !important;
        }
        .afs-pdf-export-host #afs-notes .noteStatementTable {
          margin-top: 1.3mm !important;
          margin-bottom: 4mm !important;
          table-layout: fixed !important;
          width: 100% !important;
        }
        .afs-pdf-export-host #afs-notes .noteStatementTable col:first-child { width: auto !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(2),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(3) { width: 28mm !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable thead { display: table-header-group !important; }
        .afs-pdf-export-host #afs-notes .noteTh,
        .afs-pdf-export-host #afs-notes .noteThRight,
        .afs-pdf-export-host #afs-notes .noteStatementTable thead th {
          border-bottom: 1px solid #111827 !important;
          padding: 0 0 1.2mm 0 !important;
        }
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount {
          padding-top: 0.75mm !important;
          padding-bottom: 0.75mm !important;
        }
        .afs-pdf-export-host #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          text-align: right !important;
          font-variant-numeric: tabular-nums !important;
        }
        .afs-pdf-export-host #afs-notes .noteTotalLabel {
          border: 0 !important;
          font-weight: 900 !important;
        }
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.2px solid #111827 !important;
          padding-top: 1mm !important;
          padding-bottom: 1mm !important;
          font-weight: 900 !important;
        }
        .afs-pdf-export-host #afs-notes .loanTermsInlineCombined {
          padding: 0.2mm 0 1mm 0 !important;
          margin: 0 !important;
          border: 0 !important;
        }

        /* Detailed income and tax comp: right-column amount rules only. */
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        .afs-pdf-export-host #afs-detailed-income col:first-child,
        .afs-pdf-export-host #afs-tax-computation col:first-child { width: auto !important; }
        .afs-pdf-export-host #afs-detailed-income col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(3) { width: 29mm !important; }
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-tax-computation th,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-pdf-export-host #afs-detailed-income thead th,
        .afs-pdf-export-host #afs-tax-computation thead th {
          border-bottom: 1px solid #111827 !important;
          padding-bottom: 1.2mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income td:first-child,
        .afs-pdf-export-host #afs-tax-computation td:first-child { border: 0 !important; }
        .afs-pdf-export-host #afs-detailed-income td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td:not(:first-child) {
          text-align: right !important;
          padding-top: 1mm !important;
          padding-bottom: 1mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:not(:first-child) {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.2px solid #111827 !important;
        }
        .afs-pdf-export-host #afs-tax-computation .taxComputationSettings,
        .afs-pdf-export-host #afs-tax-computation div[style*="border-bottom"] {
          border-bottom: 0 !important;
        }
      `;

      exportStyle.textContent += `


        /* V64 final corrective override: remove remaining ugly lines and fix PDF spacing/columns */
        .afs-pdf-export-host .afs-print-page {
          padding: 14mm 18mm 18mm 18mm !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader {
          margin-bottom: 9mm !important;
          padding-bottom: 3mm !important;
        }
        .afs-pdf-export-host h2 {
          margin-bottom: 7mm !important;
          padding-bottom: 3mm !important;
        }
        .afs-pdf-export-host #afs-directors-responsibilities p {
          font-size: 7.45pt !important;
          line-height: 1.02 !important;
          margin: 0 0 0.85mm 0 !important;
        }
        .afs-pdf-export-host #afs-directors-responsibilities .signatureBlock,
        .afs-pdf-export-host #afs-directors-responsibilities div[style*="border-top"] {
          margin-top: 4mm !important;
        }
        .afs-pdf-export-host #afs-directors-report p,
        .afs-pdf-export-host #afs-directors-report td,
        .afs-pdf-export-host #afs-directors-report th,
        .afs-pdf-export-host #afs-directors-report div {
          font-size: 7.75pt !important;
          line-height: 1.03 !important;
        }
        .afs-pdf-export-host #afs-directors-report h4 {
          font-size: 7.9pt !important;
          margin: 1.45mm 0 0.45mm 0 !important;
        }
        .afs-pdf-export-host #afs-directors-report .reportSectionBlock { margin-bottom: 1.35mm !important; }

        .afs-pdf-export-host #afs-sfp table,
        .afs-pdf-export-host #afs-sci table,
        .afs-pdf-export-host #afs-cash-flow table,
        .afs-pdf-export-host #afs-socie table,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table,
        .afs-pdf-export-host #afs-notes .noteStatementTable {
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }

        .afs-pdf-export-host #afs-sfp thead th,
        .afs-pdf-export-host #afs-sci thead th,
        .afs-pdf-export-host #afs-cash-flow thead th,
        .afs-pdf-export-host #afs-socie thead th,
        .afs-pdf-export-host #afs-detailed-income thead th,
        .afs-pdf-export-host #afs-tax-computation thead th,
        .afs-pdf-export-host #afs-notes .noteStatementTable thead th {
          border-top: 0 !important;
          border-bottom: 1px solid #111827 !important;
          padding: 1.2mm 1.7mm 1.3mm 1.7mm !important;
          box-shadow: none !important;
        }

        .afs-pdf-export-host #afs-socie td,
        .afs-pdf-export-host #afs-socie th,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-tax-computation td,
        .afs-pdf-export-host #afs-tax-computation th,
        .afs-pdf-export-host #afs-notes td,
        .afs-pdf-export-host #afs-notes th {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }

        .afs-pdf-export-host #afs-socie td:first-child,
        .afs-pdf-export-host #afs-socie th:first-child,
        .afs-pdf-export-host #afs-detailed-income td:first-child,
        .afs-pdf-export-host #afs-tax-computation td:first-child {
          border: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-pdf-export-host #afs-socie tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:not(:first-child) {
          border-top: 0 !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
        }

        .afs-pdf-export-host #afs-notes .noteStatementTable { width: 100% !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable col:first-child { width: 70% !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(2),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(3) { width: 15% !important; }
        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff {
          margin-top: 5.3mm !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .afs-pdf-export-host #afs-notes h4 { margin: 0 0 1.4mm 0 !important; }
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          padding-top: 0.82mm !important;
          padding-bottom: 0.82mm !important;
        }
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border: 0 !important;
          box-shadow: none !important;
        }
        .afs-pdf-export-host #afs-notes .loanTermsInlineCombined {
          padding: 0.15mm 1.7mm 1.0mm 1.7mm !important;
          margin: 0 !important;
        }
        .afs-pdf-export-host #afs-notes .loanTermsInput { padding: 0 !important; border: 0 !important; }

        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table { width: 100% !important; }
        .afs-pdf-export-host #afs-detailed-income col:first-child,
        .afs-pdf-export-host #afs-tax-computation col:first-child { width: 68% !important; }
        .afs-pdf-export-host #afs-detailed-income col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(3) { width: 16% !important; }
        .afs-pdf-export-host #afs-detailed-income td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td:not(:first-child) {
          text-align: right !important;
          padding-left: 1.7mm !important;
          padding-right: 1.7mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income td[style*="font-weight: 900"]:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td[style*="font-weight: 900"]:not(:first-child) {
          border: 0 !important;
          box-shadow: none !important;
        }
        .afs-pdf-export-host #afs-tax-computation .taxComputationSettings,
        .afs-pdf-export-host #afs-tax-computation .taxComputationSettings * { border: 0 !important; box-shadow: none !important; }
      `;



      exportStyle.textContent += `
        /* V66 PDF FOUNDATION RESET: no html shadow rules, no black blocks, no long amount bands */
        .afs-pdf-export-host *,
        .afs-pdf-export-host #afs-socie *,
        .afs-pdf-export-host #afs-notes *,
        .afs-pdf-export-host #afs-detailed-income *,
        .afs-pdf-export-host #afs-tax-computation * {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          text-shadow: none !important;
          text-decoration: none !important;
        }

        .afs-pdf-export-host .afs-print-page {
          padding: 15mm 18mm 18mm 18mm !important;
          overflow: visible !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader {
          margin-bottom: 9mm !important;
          padding-bottom: 2.6mm !important;
          border-bottom: 1.2px solid #111827 !important;
        }
        .afs-pdf-export-host h2 {
          margin: 0 0 8mm 0 !important;
          padding-bottom: 2.6mm !important;
          border-bottom: 1.2px solid #111827 !important;
        }
        .afs-pdf-export-host #afs-index h2,
        .afs-pdf-export-host #afs-general-info h2,
        .afs-pdf-export-host #afs-directors-responsibilities h2,
        .afs-pdf-export-host #afs-directors-report h2,
        .afs-pdf-export-host #afs-sfp h2,
        .afs-pdf-export-host #afs-sci h2,
        .afs-pdf-export-host #afs-socie h2,
        .afs-pdf-export-host #afs-cash-flow h2,
        .afs-pdf-export-host #afs-accounting-policies h2,
        .afs-pdf-export-host #afs-notes h2,
        .afs-pdf-export-host #afs-detailed-income h2,
        .afs-pdf-export-host #afs-tax-computation h2 {
          padding-bottom: 2.2mm !important;
        }

        .afs-pdf-export-host #afs-directors-responsibilities p {
          font-size: 7.7pt !important;
          line-height: 1.06 !important;
          margin: 0 0 1.05mm 0 !important;
        }
        .afs-pdf-export-host #afs-directors-report p,
        .afs-pdf-export-host #afs-directors-report td,
        .afs-pdf-export-host #afs-directors-report th,
        .afs-pdf-export-host #afs-directors-report div {
          font-size: 7.65pt !important;
          line-height: 1.05 !important;
        }
        .afs-pdf-export-host #afs-directors-report h4 {
          font-size: 7.9pt !important;
          margin: 1.6mm 0 0.6mm 0 !important;
        }
        .afs-pdf-export-host #afs-directors-report .reportSectionBlock {
          margin-bottom: 1.45mm !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .afs-pdf-export-host table { border-collapse: separate !important; border-spacing: 0 !important; }
        .afs-pdf-export-host th,
        .afs-pdf-export-host td,
        .afs-pdf-export-host tr,
        .afs-pdf-export-host tbody,
        .afs-pdf-export-host thead {
          border-top: 0 !important;
          border-bottom: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          outline: 0 !important;
        }

        .afs-pdf-export-host #afs-sfp thead th,
        .afs-pdf-export-host #afs-sci thead th,
        .afs-pdf-export-host #afs-cash-flow thead th,
        .afs-pdf-export-host #afs-socie thead th,
        .afs-pdf-export-host #afs-detailed-income thead th,
        .afs-pdf-export-host #afs-tax-computation thead th,
        .afs-pdf-export-host #afs-notes .noteStatementTable thead th {
          border-bottom: 0.8px solid #111827 !important;
          padding-bottom: 1.25mm !important;
        }

        .afs-pdf-export-host #afs-socie td:first-child,
        .afs-pdf-export-host #afs-socie td:first-child *,
        .afs-pdf-export-host #afs-socie th:first-child,
        .afs-pdf-export-host #afs-socie th:first-child * {
          border: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          background: transparent !important;
        }
        .afs-pdf-export-host #afs-socie td,
        .afs-pdf-export-host #afs-socie th {
          padding-top: 0.95mm !important;
          padding-bottom: 0.95mm !important;
        }

        .afs-pdf-export-host #afs-sfp td:not(:first-child),
        .afs-pdf-export-host #afs-sci td:not(:first-child),
        .afs-pdf-export-host #afs-cash-flow td:not(:first-child),
        .afs-pdf-export-host #afs-socie td:not(:first-child),
        .afs-pdf-export-host #afs-notes td:not(:first-child),
        .afs-pdf-export-host #afs-detailed-income td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td:not(:first-child) {
          text-align: right !important;
          font-variant-numeric: tabular-nums !important;
          border: 0 !important;
        }

        .afs-pdf-export-host #afs-notes .noteStatementTable col:first-child { width: auto !important; }
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(2),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(3) { width: 24mm !important; }
        .afs-pdf-export-host #afs-detailed-income col:first-child,
        .afs-pdf-export-host #afs-tax-computation col:first-child { width: auto !important; }
        .afs-pdf-export-host #afs-detailed-income col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(3) { width: 24mm !important; }

        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td,
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          padding-top: 0.9mm !important;
          padding-bottom: 0.9mm !important;
        }

        .afs-pdf-export-host #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:not(:first-child) {
          border-top: 0 !important;
          border-bottom: 0.75px solid #111827 !important;
        }
        .afs-pdf-export-host #afs-notes .noteTotalLabel { border: 0 !important; }

        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff {
          margin-top: 6mm !important;
          padding-top: 0 !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .afs-pdf-export-host #afs-notes h4 {
          margin: 0 0 1.3mm 0 !important;
          break-after: avoid !important;
          page-break-after: avoid !important;
        }
        .afs-pdf-export-host #afs-notes p { margin: 0 0 1mm 0 !important; }
        .afs-pdf-export-host #afs-notes .loanTermsInlineCombined {
          padding: 0.15mm 0 1.0mm 0 !important;
          margin: 0 !important;
          border: 0 !important;
        }
        .afs-pdf-export-host #afs-notes .loanTermsInput,
        .afs-pdf-export-host #afs-notes input,
        .afs-pdf-export-host #afs-notes textarea {
          border: 0 !important;
          padding: 0 !important;
          background: transparent !important;
        }

        .afs-pdf-export-host #afs-tax-computation .taxComputationSettings,
        .afs-pdf-export-host #afs-tax-computation .taxComputationSettings * {
          border: 0 !important;
          background: transparent !important;
        }

        /* V67 final targeted export override: keep lines short, fix right columns, reduce directors split. */
        .afs-pdf-export-host .afs-print-page {
          padding: 13mm 17mm 16mm 17mm !important;
          min-height: 297mm !important;
          max-height: none !important;
          width: 210mm !important;
          max-width: 210mm !important;
          box-sizing: border-box !important;
          font-family: Arial, Helvetica, sans-serif !important;
        }
        .afs-pdf-export-host .afsPageEntityHeader {
          margin-bottom: 8mm !important;
          padding-bottom: 2.4mm !important;
          border-bottom: 0.65px solid #111827 !important;
        }
        .afs-pdf-export-host h2 {
          margin-bottom: 7mm !important;
          padding-bottom: 2.4mm !important;
          border-bottom: 0.65px solid #111827 !important;
        }
        .afs-pdf-export-host #afs-directors-responsibilities p {
          font-size: 7.25pt !important;
          line-height: 1.04 !important;
          margin: 0 0 0.82mm 0 !important;
        }
        .afs-pdf-export-host #afs-directors-responsibilities .signatureGrid {
          margin-top: 5mm !important;
          grid-template-columns: 58mm 58mm !important;
          gap: 16mm !important;
        }
        .afs-pdf-export-host #afs-directors-responsibilities .signatureBox,
        .afs-pdf-export-host #afs-directors-responsibilities .signatureBox * {
          font-size: 7.8pt !important;
          line-height: 1.12 !important;
        }
        .afs-pdf-export-host .signatureLine {
          width: 56mm !important;
          max-width: 56mm !important;
          border-top: 0.65px solid #111827 !important;
        }
        .afs-pdf-export-host #afs-notes .noteStatementTable,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        .afs-pdf-export-host #afs-notes .noteStatementTable col:first-child,
        .afs-pdf-export-host #afs-detailed-income col:first-child,
        .afs-pdf-export-host #afs-tax-computation col:first-child {
          width: auto !important;
        }
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(2),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(3),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(3) {
          width: 23mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income thead th,
        .afs-pdf-export-host #afs-tax-computation thead th,
        .afs-pdf-export-host #afs-notes .noteStatementTable thead th {
          border-top: 0 !important;
          border-bottom: 0.65px solid #111827 !important;
          padding: 0.8mm 1.1mm 1.0mm 1.1mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td,
        .afs-pdf-export-host #afs-notes .noteStatementTable td {
          border: 0 !important;
          text-decoration: none !important;
          padding: 0.9mm 1.1mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td:not(:first-child),
        .afs-pdf-export-host #afs-notes .noteStatementTable td:not(:first-child) {
          text-align: right !important;
          vertical-align: bottom !important;
          font-variant-numeric: tabular-nums !important;
        }
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:nth-child(3),
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border-top: 0.65px solid #111827 !important;
          border-bottom: 0.65px solid #111827 !important;
        }
        .afs-pdf-export-host #afs-notes .loanTermsInlineCombined,
        .afs-pdf-export-host #afs-notes .loanTermsInlineCombined *,
        .afs-pdf-export-host #afs-notes .loanTermsInlineText,
        .afs-pdf-export-host #afs-notes .loanTermsText {
          padding-left: 0 !important;
          margin-left: 0 !important;
          border: 0 !important;
          text-indent: 0 !important;
        }
        .afs-pdf-export-host #afs-tax-computation .print-edit-col,
        .afs-pdf-export-host #afs-detailed-income .print-edit-col,
        .afs-pdf-export-host #afs-notes .print-edit-col { display: none !important; }
      `;

      exportHost.appendChild(exportStyle);

      const clonedRoot = sourceRoot.cloneNode(true) as HTMLElement;
      clonedRoot.className = profile === "draft" ? "afs-print-root afs-print-draft" : "afs-print-root afs-print-final";
      replaceFormControlsForPdf(clonedRoot);
      clonedRoot.querySelectorAll(".afs-page-footer").forEach((footer) => footer.remove());
      exportHost.appendChild(clonedRoot);
      document.body.appendChild(exportHost);

      await waitForPdfImages(exportHost);
      await new Promise((resolve) => window.setTimeout(resolve, 250));

      const pdf = new JsPdfConstructor({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const pages = Array.from(clonedRoot.querySelectorAll(".afs-print-page")) as HTMLElement[];
      let pdfPageNumber = 0;
      let createdAnyPdfPage = false;

      for (const pageElement of pages) {
        const canvas = await html2canvas(pageElement, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          allowTaint: true,
          logging: false,
          windowWidth: pageElement.scrollWidth,
          windowHeight: pageElement.scrollHeight,
        });

        const pxPerMm = canvas.width / pageWidthMm;
        const forceSinglePdfPage =
          pageElement.id === "afs-cover" ||
          pageElement.id === "afs-general-info" ||
          pageElement.id === "afs-index" ||
          pageElement.id === "afs-compilation-report" ||
          pageElement.id === "afs-sfp" ||
          pageElement.id === "afs-sci" ||
          pageElement.id === "afs-socie" ||
          pageElement.id === "afs-cash-flow";

        if (forceSinglePdfPage) {
          const isCoverPdfPage = pageElement.id === "afs-cover";
          if (createdAnyPdfPage) pdf.addPage();
          createdAnyPdfPage = true;
          if (!isCoverPdfPage) pdfPageNumber += 1;
          const imageData = canvas.toDataURL("image/jpeg", 0.96);
          const fixedPageImageHeightMm = Math.min(pageHeightMm, canvas.height / pxPerMm);
          pdf.addImage(imageData, "JPEG", 0, 0, pageWidthMm, fixedPageImageHeightMm, undefined, "FAST");
          if (profile === "draft") {
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(54);
            pdf.text("DRAFT", pageWidthMm / 2, pageHeightMm / 2, { align: "center", angle: -32 });
          }
          if (!isCoverPdfPage) {
            pdf.setTextColor(17, 24, 39);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.text(String(pdfPageNumber), pageWidthMm / 2, pageHeightMm - 8, { align: "center" });
          }
          continue;
        }

        const normalBottomMm = 38;
        const continuationTopMm = 31;
        const continuationBottomMm = 38;
        const canvasScaleY = canvas.height / Math.max(pageElement.scrollHeight, 1);
        const pageElementRect = pageElement.getBoundingClientRect();
        const candidateElements = Array.from(
          pageElement.querySelectorAll(".afsPageEntityHeader, h2, h3, h4, p, tr, table, section, .policySection, .noteSectionAnchor, .noteSectionAnchorOff, .reportSectionBlock")
        ) as HTMLElement[];
        const safeBreaks = candidateElements
          .flatMap((element) => {
            const rect = element.getBoundingClientRect();
            const top = Math.floor((rect.top - pageElementRect.top + pageElement.scrollTop) * canvasScaleY);
            const bottom = Math.floor((rect.bottom - pageElementRect.top + pageElement.scrollTop) * canvasScaleY);
            const points: number[] = [bottom];
            if (
              element.matches(".reportSectionBlock, .policySection, .noteSectionAnchor, .noteSectionAnchorOff, h4, p, table, tr") &&
              top > 0
            ) {
              points.push(top);
            }
            return points;
          })
          .filter((point) => Number.isFinite(point) && point > 40 && point < canvas.height - 40)
          .sort((a, b) => a - b);

        function chooseSafeSliceHeight(startY: number, maxHeightPx: number, remainingPx: number) {
          if (remainingPx <= maxHeightPx) return remainingPx;
          const target = startY + maxHeightPx;
          const minAcceptable = startY + Math.floor(10 * pxPerMm);
          const safetyGap = Math.floor(3 * pxPerMm);
          const reversedBreaks = [...safeBreaks].reverse();
          const safe = reversedBreaks.find((breakPoint) => breakPoint >= minAcceptable && breakPoint <= target - safetyGap);
          if (safe) return safe - startY;
          const fallback = reversedBreaks.find((breakPoint) => breakPoint > startY + Math.floor(6 * pxPerMm) && breakPoint <= target - Math.floor(1 * pxPerMm));
          return fallback ? fallback - startY : maxHeightPx;
        }

        let y = 0;

        while (y < canvas.height) {
          const isContinuationSlice = y > 0;
          const destinationTopMm = isContinuationSlice ? continuationTopMm : 0;
          const availableHeightMm = pageHeightMm - destinationTopMm - (isContinuationSlice ? continuationBottomMm : normalBottomMm);
          const currentSliceMaxHeightPx = Math.floor(availableHeightMm * pxPerMm);
          const remaining = canvas.height - y;
          const currentSliceHeight = chooseSafeSliceHeight(y, currentSliceMaxHeightPx, remaining);
          if (currentSliceHeight < 18 * pxPerMm && y > 0) break;

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = Math.floor(pageHeightMm * pxPerMm);
          const ctx = sliceCanvas.getContext("2d");
          if (!ctx) break;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

          const destinationTopPx = Math.floor(destinationTopMm * pxPerMm);
          ctx.drawImage(
            canvas,
            0,
            y,
            canvas.width,
            currentSliceHeight,
            0,
            destinationTopPx,
            canvas.width,
            currentSliceHeight
          );

          if (y > 0 && isCanvasEffectivelyBlank(sliceCanvas)) {
            y += currentSliceHeight;
            continue;
          }

          if (createdAnyPdfPage) pdf.addPage();
          createdAnyPdfPage = true;
          pdfPageNumber += 1;
          const imageData = sliceCanvas.toDataURL("image/jpeg", 0.96);
          pdf.addImage(imageData, "JPEG", 0, 0, pageWidthMm, pageHeightMm, undefined, "FAST");

          if (isContinuationSlice) {
            pdf.setTextColor(17, 24, 39);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.6);
            pdf.text(clean(clientName), 14, 14);
            if (clean(registrationNumber)) {
              pdf.text(`(Registration number: ${clean(registrationNumber)})`, 14, 18);
            }
            pdf.text(`Financial Statements for the year ended ${formatDateLong(yearEnd || "")}`, 14, 22);
            pdf.setDrawColor(17, 24, 39);
            pdf.setLineWidth(0.45);
            pdf.line(14, 25, pageWidthMm - 14, 25);
          }

          if (profile === "draft") {
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(54);
            pdf.text("DRAFT", pageWidthMm / 2, pageHeightMm / 2, { align: "center", angle: -32 });
          }

          pdf.setTextColor(17, 24, 39);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.text(String(pdfPageNumber), pageWidthMm / 2, pageHeightMm - 8, { align: "center" });
          y += currentSliceHeight;
        }
      }

      const fileSafeClientName = clean(clientName).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "AFS";
      pdf.save(`${fileSafeClientName}_${yearEnd || "year_end"}_${profile}.pdf`);
    } catch (error) {
      console.error(error);
      alert("PDF export failed. Please try again.");
    } finally {
      if (exportHost?.parentNode) exportHost.parentNode.removeChild(exportHost);
      setIsGeneratingPdf(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <style>{`
        .afs-draft-watermark { display: none; }

        @media print {
          @page {
            size: A4;
            margin: 14mm 14mm 18mm 14mm;
          }

          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          .afs-print-root,
          .afs-print-root * {
            visibility: visible !important;
          }

          .afs-print-root::before,
          .afs-print-root::after,
          .afs-print-root *::before,
          .afs-print-root *::after {
            content: none !important;
            display: none !important;
          }

          .afs-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .afs-print-root,
          .afs-print-root * {
            color: #111827 !important;
          }

          .afs-print-root a,
          .afs-print-root span,
          .afs-print-root td,
          .afs-print-root th,
          .afs-print-root p,
          .afs-print-root div,
          .afs-print-root h1,
          .afs-print-root h3,
          .afs-print-root h4 {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          .afs-print-root .afs-compilation-report {
            position: relative !important;
            min-height: 100% !important;
            padding-bottom: 180px !important;
          }

          .afs-print-root .afs-compilation-report img {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          #afs-compilation-report .afs-compilation-letterhead-bottom {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 8mm !important;
            padding-top: 5px !important;
            border-top: 1px solid #111827 !important;
          }

          #afs-compilation-report .afs-compilation-letterhead-top img,
          #afs-compilation-report .afs-compilation-letterhead-bottom img {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: 4.44cm !important;
          }

          .afs-print-root .afs-compilation-report p,
          .afs-print-root .afs-compilation-report td,
          .afs-print-root .afs-compilation-report th,
          .afs-print-root .afs-compilation-report span {
            font-size: 10.5px !important;
            line-height: 1.35 !important;
          }

          .afs-print-root .afs-compilation-report h3 {
            font-size: 15px !important;
            line-height: 1.2 !important;
          }

          .afs-print-root .afs-compilation-report h4 {
            font-size: 12px !important;
            line-height: 1.2 !important;
            margin-top: 7px !important;
            margin-bottom: 3px !important;
          }

          .afs-print-root h2,
          .afs-print-root h3,
          .afs-print-root h4 {
            color: #111827 !important;
          }

          .afs-print-root [style*="#b91c1c"],
          .afs-print-root [style*="rgb(185, 28, 28)"],
          .afs-print-root [style*="red"] {
            color: #b91c1c !important;
          }

          .afs-print-root [style*="#dbeafe"],
          .afs-print-root [style*="#eff6ff"],
          .afs-print-root [style*="#bfdbfe"],
          .afs-print-root [style*="#2563eb"],
          .afs-print-root [style*="#1d4ed8"],
          .afs-print-root [style*="#dcfce7"],
          .afs-print-root [style*="#fff9c4"],
          .afs-print-root [style*="#fffbeb"] {
            background: transparent !important;
            border-color: #111827 !important;
          }

          .afs-print-hide {
            display: none !important;
          }

          .afs-screen-only,
          button {
            display: none !important;
          }

          .afs-page-footer {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 2mm !important;
            text-align: center !important;
            font-size: 10px !important;
            line-height: 1 !important;
            color: #111827 !important;
          }

          /* V47_41_REMOVE_FAKE_PAGE_NUMBERS */
          .afs-page-footer {
            display: none !important;
            content: none !important;
          }

          .afs-print-page {
            position: relative !important;
            display: block !important;
            break-after: page;
            page-break-after: always;
            box-shadow: none !important;
            border: none !important;
            min-height: auto !important;
            height: auto !important;
            max-height: none !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 13mm 14mm 18mm 14mm !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            font-size: 10.5pt !important;
            line-height: 1.22 !important;
          }

          /* V47_40_FIXED_PAGE_FOOTERS */
          .afs-page-footer {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 6mm !important;
            text-align: center !important;
            font-size: 10px !important;
            line-height: 1 !important;
            color: #111827 !important;
            z-index: 10 !important;
          }

          #afs-cover .afs-page-footer {
            display: none !important;
          }

          #afs-compilation-report .afs-compilation-letterhead-bottom {
            position: static !important;
            margin-top: 34px !important;
            padding-top: 8px !important;
            border-top: 1px solid #111827 !important;
          }

          #afs-compilation-report .afs-compilation-letterhead-top img,
          #afs-compilation-report .afs-compilation-letterhead-bottom img {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: 4.44cm !important;
            object-fit: contain !important;
          }


          /* V54: print view must behave like a flowing PDF, not fixed fake pages */
          .afs-page-footer { display: none !important; }
          .afs-print-page {
            position: relative !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-height: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            break-after: page !important;
            page-break-after: always !important;
          }
          .afs-print-page:last-child { break-after: auto !important; page-break-after: auto !important; }
          .afs-print-root #afs-notes .noteRepeatedHeader,
          .afs-print-root #afs-notes .noteStatementTable thead { display: none !important; }
          .afs-print-root #afs-notes .noteSectionAnchor,
          .afs-print-root #afs-notes .noteSectionAnchorOff { border-top: 0 !important; padding-top: 1.5mm !important; margin-top: 4mm !important; }
          .afs-print-root #afs-notes .noteTd,
          .afs-print-root #afs-notes .noteAmount { border-bottom: 0 !important; padding-top: 1.1mm !important; padding-bottom: 1.1mm !important; }
          .afs-print-root #afs-accounting-policies .policySection { margin-bottom: 1.2mm !important; padding-bottom: 0 !important; border-bottom: 0 !important; break-inside: auto !important; page-break-inside: auto !important; }
          .afs-print-root #afs-accounting-policies h4 { margin: 1.2mm 0 0.4mm 0 !important; }
          .afs-print-root #afs-accounting-policies p { margin: 0 0 0.25mm 0 !important; }
          .afs-print-root #afs-general-info td,
          .afs-print-root #afs-index td { border-bottom: 0 !important; }


        /* V65: final screen fixes - anchor jumps, note editor focus, and right aligned detailed/tax columns */
        .afs-screen-anchor {
          display: block !important;
          height: 1px !important;
          margin: 0 !important;
          padding: 0 !important;
          scroll-margin-top: 110px !important;
        }
        .afs-print-root #afs-notes .noteLineInput,
        .afs-print-root #afs-notes .loanTermsInput {
          pointer-events: auto !important;
          user-select: text !important;
        }
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-tax-computation table {
          width: 154mm !important;
          max-width: 154mm !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          table-layout: fixed !important;
        }
        .afs-print-root #afs-detailed-income col:first-child,
        .afs-print-root #afs-tax-computation col:first-child { width: 98mm !important; }
        .afs-print-root #afs-detailed-income col:nth-child(2),
        .afs-print-root #afs-detailed-income col:nth-child(3),
        .afs-print-root #afs-tax-computation col:nth-child(2),
        .afs-print-root #afs-tax-computation col:nth-child(3) { width: 28mm !important; }
        .afs-print-root #afs-detailed-income td:not(:first-child),
        .afs-print-root #afs-detailed-income th:not(:first-child),
        .afs-print-root #afs-tax-computation td:not(:first-child),
        .afs-print-root #afs-tax-computation th:not(:first-child) {
          text-align: right !important;
        }
        .afs-print-root #afs-detailed-income td:first-child,
        .afs-print-root #afs-tax-computation td:first-child {
          width: 98mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table {
          width: 154mm !important;
          max-width: 154mm !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          table-layout: fixed !important;
        }
        .afs-pdf-export-host #afs-detailed-income col:first-child,
        .afs-pdf-export-host #afs-tax-computation col:first-child { width: 98mm !important; }
        .afs-pdf-export-host #afs-detailed-income col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(3) { width: 28mm !important; }
        .afs-pdf-export-host #afs-detailed-income td:not(:first-child),
        .afs-pdf-export-host #afs-detailed-income th:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation th:not(:first-child) {
          text-align: right !important;
        }

          .afs-print-root #afs-index td:nth-child(2) { border-bottom: 0 !important; }
          .afs-print-root #afs-notes .noteStatementTable thead { display: none !important; }
          .afs-print-root #afs-notes .noteStatementTable td,
          .afs-print-root #afs-notes .noteStatementTable span,
          .afs-print-root #afs-notes .noteStatementTable div { border-bottom: 0 !important; text-decoration: none !important; }
          .afs-print-root #afs-notes .noteTotalLabel,
          .afs-print-root #afs-notes .noteTotalAmount { border-top: 1.2px solid #111827 !important; border-bottom: 1.8px solid #111827 !important; }

          .afs-draft-watermark {
            display: none;
          }

          .afs-print-draft .afs-draft-watermark {
            display: block !important;
            position: fixed;
            top: 42%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-32deg);
            z-index: 0;
            font-size: 86px;
            line-height: 1;
            letter-spacing: 10px;
            font-weight: 900;
            color: rgba(148, 163, 184, 0.18);
            pointer-events: none;
          }

          .afs-print-final .afs-draft-watermark {
            display: none !important;
          }

          .afs-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          #afs-cover {
            min-height: 277mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          #afs-cover .afs-page-footer {
            display: none !important;
          }

          .afs-print-page::before,
          .afs-print-page::after {
            display: none !important;
            content: none !important;
          }

          .afs-print-page:not(#afs-cover) h1 {
            color: #111827 !important;
          }

          .afs-print-root .afs-screen-only,
          .afs-print-root .afs-print-hide,
          .afs-print-root .print-hide,
          .afs-print-root .print-edit-col {
            display: none !important;
          }

          .afs-print-root th.print-edit-col,
          .afs-print-root td.print-edit-col {
            display: none !important;
          }

          .afs-print-root .statementModeToolbar,
          .afs-print-root .inlineEditableToolbar,
          .afs-print-root .compactNoteTabBar,
          .afs-print-root .noteEditorActions,
          .afs-print-root button {
            display: none !important;
          }

          .afs-print-root table,
          .afs-print-root p,
          .afs-print-root td,
          .afs-print-root th {
            font-size: 10.5pt !important;
            line-height: 1.22 !important;
          }

          #afs-cover h1 {
            font-size: 16px !important;
            margin-bottom: 3mm !important;
          }

          .afs-print-root input,
          .afs-print-root textarea {
            font-size: 10.5pt !important;
            line-height: 1.22 !important;
          }

          input,
          textarea {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            box-shadow: none !important;
            color: #111827 !important;
            font: inherit !important;
          }

          textarea {
            resize: none !important;
            overflow: visible !important;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          thead {
            display: table-header-group;
          }

          tfoot {
            display: table-footer-group;
          }

          /* V56_FINAL_LAYOUT_CLEANUP */
          .afs-print-root .statementModeToolbar,
          .afs-print-root .afs-screen-only,
          .afs-print-root .print-hide,
          .afs-print-root .afs-print-hide { display: none !important; }
          #afs-cover h1 { font-size: 14px !important; margin-bottom: 1.8mm !important; }
          #afs-cover p { margin: 1.4mm 0 !important; }
          .afs-print-root .afs-print-page { padding: 13mm 14mm 18mm 14mm !important; font-size: 10pt !important; line-height: 1.16 !important; }
          .afs-print-root p,
          .afs-print-root td,
          .afs-print-root th,
          .afs-print-root span,
          .afs-print-root div { font-size: 10pt !important; line-height: 1.16 !important; }
          .afs-print-root h2 { font-size: 14pt !important; margin: 0 0 5mm 0 !important; padding-bottom: 1.4mm !important; border-bottom: 2px solid #111827 !important; }
          .afs-print-root h3 { font-size: 10pt !important; margin: 0 0 2mm 0 !important; }
          .afs-print-root h4 { font-size: 9.6pt !important; margin: 2.2mm 0 0.7mm 0 !important; }
          #afs-directors-responsibilities p,
          #afs-directors-report p { margin: 0 0 1.6mm 0 !important; line-height: 1.14 !important; }
          #afs-directors-report h4 { margin: 2.2mm 0 0.6mm 0 !important; }
          #afs-directors-report table { margin: 2.5mm 0 2.5mm 0 !important; }
          #afs-index td,
          #afs-general-info td,
          #afs-directors-report td,
          #afs-sce td,
          #afs-notes td,
          #afs-detailed-income td,
          #afs-tax-computation td { border-bottom: 0 !important; text-decoration: none !important; }
          #afs-notes td,
          #afs-detailed-income td,
          #afs-tax-computation td,
          #afs-sce td { padding-top: 2.1mm !important; padding-bottom: 1.4mm !important; }
          #afs-notes th,
          #afs-detailed-income th,
          #afs-tax-computation th { border-top: 1.2px solid #111827 !important; border-bottom: 1.2px solid #111827 !important; padding-top: 2mm !important; padding-bottom: 1.4mm !important; }
          #afs-sce th { border-bottom: 1.2px solid #111827 !important; padding-top: 2mm !important; padding-bottom: 1.4mm !important; }
          #afs-notes .noteStatementTable thead { display: table-header-group !important; }
          #afs-notes .noteThRight { display: table-cell !important; border-top: 1.2px solid #111827 !important; border-bottom: 1.2px solid #111827 !important; padding: 2mm 0 1.4mm 7px !important; }
          #afs-notes .noteTh { border-top: 1.2px solid #111827 !important; border-bottom: 1.2px solid #111827 !important; }
          #afs-notes .noteTd,
          #afs-notes .noteAmount { border: 0 !important; text-decoration: none !important; padding-top: 1.4mm !important; padding-bottom: 1.1mm !important; }
          #afs-notes .noteTotalLabel,
          #afs-notes .noteTotalAmount,
          #afs-detailed-income td[style*="font-weight: 900"],
          #afs-tax-computation td[style*="font-weight: 900"] { border-top: 1px solid #111827 !important; border-bottom: 0 !important; text-decoration: none !important; }
          #afs-notes .noteSectionAnchor,
          #afs-notes .noteSectionAnchorOff { margin-top: 3mm !important; padding-top: 1mm !important; }

          /* V57 browser print preview cleanup */
          #afs-cash-flow .afs-print-hide { display: none !important; }
          #afs-sce table,
          #afs-sce thead,
          #afs-sce tbody,
          #afs-sce tr,
          #afs-sce th,
          #afs-sce td,
          #afs-detailed-income table,
          #afs-detailed-income thead,
          #afs-detailed-income tbody,
          #afs-detailed-income tr,
          #afs-detailed-income th,
          #afs-detailed-income td,
          #afs-tax-computation table,
          #afs-tax-computation thead,
          #afs-tax-computation tbody,
          #afs-tax-computation tr,
          #afs-tax-computation th,
          #afs-tax-computation td { border-top: 0 !important; border-bottom: 0 !important; text-decoration: none !important; box-shadow: none !important; }
          #afs-sce th,
          #afs-detailed-income th,
          #afs-tax-computation th { border-bottom: 1px solid #111827 !important; }
          #afs-notes .noteStatementTable thead { display: table-header-group !important; }
          #afs-notes .noteTh,
          #afs-notes .noteThRight { display: table-cell !important; border-top: 1px solid #111827 !important; border-bottom: 0 !important; padding: 1.2mm 0 0.9mm 0 !important; }
          #afs-notes .noteTd,
          #afs-notes .noteAmount,
          #afs-notes .noteTotalLabel,
          #afs-notes .noteTotalAmount,
          #afs-notes td,
          #afs-notes tr,
          #afs-notes span,
          #afs-notes div { border-top: 0 !important; border-bottom: 0 !important; text-decoration: none !important; box-shadow: none !important; }
          #afs-notes h4 { margin: 3.5mm 0 1mm 0 !important; page-break-after: avoid !important; break-after: avoid !important; }
          #afs-notes .noteSectionAnchor,
          #afs-notes .noteSectionAnchorOff { margin-top: 4mm !important; padding-top: 0 !important; border-top: 0 !important; break-inside: avoid !important; page-break-inside: avoid !important; }

          /* V58 browser print / PDF preview cleanup */
          .afs-print-root .afs-print-page { padding: 14mm 18mm 22mm 18mm !important; font-size: 9.4pt !important; line-height: 1.16 !important; }
          #afs-cover h1 { font-size: 13px !important; margin-bottom: 1.5mm !important; }
          #afs-cover p { margin: 0.8mm 0 !important; }
          .afs-print-root p,
          .afs-print-root td,
          .afs-print-root th,
          .afs-print-root span,
          .afs-print-root div { font-size: 9.4pt !important; line-height: 1.16 !important; }
          .afs-print-root h2 { font-size: 13.2pt !important; margin: 0 0 4mm 0 !important; padding-bottom: 1.2mm !important; border-bottom: 1.4px solid #111827 !important; }
          .afs-print-root h4 { font-size: 9.4pt !important; margin: 2mm 0 0.7mm 0 !important; }
          .afs-print-root .afsPageEntityHeader { margin: 0 0 7mm 0 !important; padding-bottom: 1.4mm !important; border-bottom: 1.4px solid #111827 !important; }
          .afs-print-root .afsPageEntityHeader h1 { font-size: 9.6pt !important; }
          .afs-print-root .afsPageEntityHeader p { font-size: 7.8pt !important; }
          #afs-index td,
          #afs-general-info td,
          #afs-socie td,
          #afs-socie th,
          #afs-detailed-income td,
          #afs-detailed-income th,
          #afs-tax-computation td,
          #afs-tax-computation th,
          #afs-notes td,
          #afs-notes tr,
          #afs-notes th { border-top: 0 !important; border-bottom: 0 !important; text-decoration: none !important; box-shadow: none !important; }
          #afs-index td { padding-top: 2mm !important; padding-bottom: 1.3mm !important; }
          #afs-directors-responsibilities p,
          #afs-directors-report p { margin: 0 0 1.15mm 0 !important; line-height: 1.15 !important; }
          #afs-directors-report .reportSectionBlock { margin-bottom: 2.2mm !important; break-inside: avoid !important; page-break-inside: avoid !important; }
          #afs-sce thead th,
          #afs-socie thead th,
          #afs-detailed-income thead th,
          #afs-tax-computation thead th,
          #afs-notes .noteStatementTable thead th { border-top: 1.2px solid #111827 !important; border-bottom: 1.2px solid #111827 !important; padding-top: 1.2mm !important; padding-bottom: 1mm !important; }
          #afs-notes .noteStatementTable thead,
          #afs-notes .noteRepeatedHeader { display: table-header-group !important; }
          #afs-notes .noteMasterHeader { display: none !important; }
          #afs-notes .noteSectionAnchor,
          #afs-notes .noteSectionAnchorOff { margin-top: 4mm !important; padding-top: 0 !important; border-top: 0 !important; break-inside: auto !important; page-break-inside: auto !important; }
          #afs-notes h4 { margin: 3.2mm 0 1mm 0 !important; }
          #afs-notes p { margin: 0 0 1mm 0 !important; }
          #afs-notes .noteTotalLabel,
          #afs-notes .noteTotalAmount,
          #afs-detailed-income td[style*="font-weight: 900"],
          #afs-tax-computation td[style*="font-weight: 900"],
          #afs-sce td[style*="font-weight: 900"],
          #afs-socie td[style*="font-weight: 900"] { border-top: 1px solid #111827 !important; }
          /* V59 browser-print mirror of controlled PDF fixes */
          .afs-print-root,
          .afs-print-root * { font-family: Arial, Helvetica, sans-serif !important; font-stretch: normal !important; letter-spacing: normal !important; }
          .afs-print-root .afs-print-page { padding: 13mm 18mm 18mm 18mm !important; font-size: 9.6pt !important; line-height: 1.18 !important; }
          .afs-print-root p,
          .afs-print-root td,
          .afs-print-root th,
          .afs-print-root span,
          .afs-print-root div { font-size: 9.6pt !important; line-height: 1.18 !important; }
          #afs-cover h1 { font-size: 11.8pt !important; margin-bottom: 1mm !important; }
          #afs-index td,
          #afs-general-info td,
          #afs-index .indexDots { border: 0 !important; border-bottom: 0 !important; text-decoration: none !important; }
          #afs-directors-report .reportSectionBlock { margin-bottom: 2.2mm !important; break-inside: avoid !important; page-break-inside: avoid !important; }
          #afs-directors-responsibilities p,
          #afs-directors-report p { margin: 0 0 1.35mm 0 !important; line-height: 1.17 !important; }
          #afs-sce table,#afs-sce tr,#afs-sce th,#afs-sce td,
          #afs-detailed-income table,#afs-detailed-income tr,#afs-detailed-income th,#afs-detailed-income td,
          #afs-tax-computation table,#afs-tax-computation tr,#afs-tax-computation th,#afs-tax-computation td,
          #afs-notes table,#afs-notes tr,#afs-notes th,#afs-notes td { border-top: 0 !important; border-bottom: 0 !important; text-decoration: none !important; box-shadow: none !important; }
          #afs-notes .noteStatementTable thead,
          #afs-notes .noteRepeatedHeader { display: table-header-group !important; }
          #afs-notes .noteTh,
          #afs-notes .noteThRight { display: table-cell !important; border-top: 1px solid #111827 !important; border-bottom: 1px solid #111827 !important; }
          #afs-notes .noteMasterHeader { display: none !important; }
          #afs-notes .noteTotalLabel,
          #afs-notes .noteTotalAmount { border-top: 1px solid #111827 !important; border-bottom: 1.4px solid #111827 !important; }
          #afs-sce thead th,
          #afs-detailed-income thead th,
          #afs-tax-computation thead th { border-bottom: 1px solid #111827 !important; }
          #afs-detailed-income td[style*="font-weight: 900"],
          #afs-tax-computation td[style*="font-weight: 900"] { border-top: 1px solid #111827 !important; padding-top: 1.6mm !important; padding-bottom: 1.4mm !important; }
          .loanTermsInlineLabel { display: none !important; }
          .loanTermsInlineCombined { padding-left: 5mm !important; }

          .loanTermsInlineLabel { display: none !important; }
          .loanTermsInlineCombined { padding-left: 7mm !important; }


        /* V60: CaseWare/Draftworx line discipline + cleaner front page */
       .afs-print-root a,
       .afs-print-root a *,
       .afs-print-root [style*="text-decoration"],
       .afs-print-root [style*="textDecoration"] {
          text-decoration: none !important;
        }

       .afs-print-root #afs-cover {
          padding: 0 30mm !important;
        }
       .afs-print-root #afs-cover h1 {
          font-size: 10.8pt !important;
          line-height: 1.12 !important;
          margin: 0 0 1.8mm 0 !important;
          letter-spacing: 0.1px !important;
        }
       .afs-print-root #afs-cover p {
          font-size: 9.3pt !important;
          line-height: 1.22 !important;
          margin: 0.6mm 0 !important;
        }
       .afs-print-root #afs-cover p:first-of-type {
          margin-bottom: 5mm !important;
        }
       .afs-print-root #afs-cover p:last-child {
          margin-top: 5mm !important;
        }

        /* Use shorter, statement-style note/detail/tax tables instead of full-width long rules */
       .afs-print-root #afs-notes .noteStatementTable,
       .afs-print-root #afs-detailed-income table,
       .afs-print-root #afs-tax-computation table {
          width: 156mm !important;
          max-width: 156mm !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }

        /* Remove row/grid/label rules. Keep rules only where amounts need accountant-style emphasis. */
       .afs-print-root #afs-notes .noteStatementTable td,
       .afs-print-root #afs-notes .noteStatementTable th,
       .afs-print-root #afs-detailed-income td,
       .afs-print-root #afs-detailed-income th,
       .afs-print-root #afs-tax-computation td,
       .afs-print-root #afs-tax-computation th {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }

        /* Notes: keep year headings, but no long ruler through every note. */
       .afs-print-root #afs-notes .noteStatementTable thead { display: table-header-group !important; }
       .afs-print-root #afs-notes .noteStatementTable thead th {
          border-top: 1px solid #111827 !important;
          border-bottom: 1px solid #111827 !important;
          padding: 1.05mm 0 0.9mm 0 !important;
        }
       .afs-print-root #afs-notes .noteTd,
       .afs-print-root #afs-notes .noteAmount {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
          border: 0 !important;
        }
       .afs-print-root #afs-notes .noteTotalLabel {
          border: 0 !important;
          padding-top: 1.05mm !important;
          padding-bottom: 1.05mm !important;
        }
       .afs-print-root #afs-notes .noteTotalAmount {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.4px solid #111827 !important;
          padding-top: 1.05mm !important;
          padding-bottom: 1.05mm !important;
        }
       .afs-print-root #afs-notes .noteSectionAnchor,
       .afs-print-root #afs-notes .noteSectionAnchorOff {
          margin-top: 4.2mm !important;
          padding-top: 0 !important;
          border: 0 !important;
        }
       .afs-print-root #afs-notes h4 { margin: 3.2mm 0 0.9mm 0 !important; }
       .afs-print-root #afs-notes p { margin: 0 0 0.75mm 0 !important; }

        /* Loan terms directly under the loan account, no "Terms" label, no indent. */
       .afs-print-root .loanTermsInlineLabel { display: none !important; }
       .afs-print-root .loanTermsInlineCombined {
          padding: 0.15mm 0 0.95mm 0 !important;
          border: 0 !important;
          text-indent: 0 !important;
        }
       .afs-print-root .loanTermsInput { padding: 0 !important; border: 0 !important; text-indent: 0 !important; }

        /* Detail income and tax: stop the long first-column rules. Amount columns only get emphasis. */
       .afs-print-root #afs-detailed-income thead th,
       .afs-print-root #afs-tax-computation thead th {
          border-top: 1px solid #111827 !important;
          border-bottom: 1px solid #111827 !important;
          padding-top: 1.05mm !important;
          padding-bottom: 0.95mm !important;
        }
       .afs-print-root #afs-detailed-income td,
       .afs-print-root #afs-tax-computation td {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
          border: 0 !important;
        }
       .afs-print-root #afs-detailed-income td:first-child,
       .afs-print-root #afs-tax-computation td:first-child {
          border: 0 !important;
          text-decoration: none !important;
        }
       .afs-print-root #afs-detailed-income td:not(:first-child),
       .afs-print-root #afs-tax-computation td:not(:first-child) {
          border: 0 !important;
        }
       .afs-print-root #afs-detailed-income td[style*="font-weight: 900"]:not(:first-child),
       .afs-print-root #afs-tax-computation td[style*="font-weight: 900"]:not(:first-child),
       .afs-print-root #afs-detailed-income tr:last-child td:not(:first-child),
       .afs-print-root #afs-tax-computation tr:last-child td:not(:first-child) {
          border-top: 1px solid #111827 !important;
          border-bottom: 1.4px solid #111827 !important;
          padding-top: 1.15mm !important;
          padding-bottom: 1.05mm !important;
        }
       .afs-print-root #afs-detailed-income td[style*="font-weight: 900"]:first-child,
       .afs-print-root #afs-tax-computation td[style*="font-weight: 900"]:first-child,
       .afs-print-root #afs-detailed-income tr:last-child td:first-child,
       .afs-print-root #afs-tax-computation tr:last-child td:first-child {
          border: 0 !important;
          padding-top: 1.15mm !important;
          padding-bottom: 1.05mm !important;
        }
       .afs-print-root #afs-tax-computation div[style*="border-bottom"],
       .afs-print-root #afs-tax-computation div[style*="borderBottom"],
       .afs-print-root #afs-tax-computation [style*="#e2e8f0"],
       .afs-print-root #afs-tax-computation [style*="#cbd5e1"] {
          border-bottom: 0 !important;
        }


        /* V61 FINAL LINE + SPACING DISCIPLINE
           This deliberately overrides previous noisy table-line experiments.
           Keep the CaseWare-style section header rules, remove random row/amount/label lines. */
        .afs-print-root,
        .afs-print-root * {
          font-family: Arial, Helvetica, sans-serif !important;
          font-stretch: normal !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }

        .afs-print-root .afs-print-page {
          padding-top: 12mm !important;
          padding-right: 18mm !important;
          padding-bottom: 19mm !important;
          padding-left: 18mm !important;
          overflow: visible !important;
        }

        .afs-print-root p {
          margin-top: 0 !important;
          margin-bottom: 1.15mm !important;
          line-height: 1.18 !important;
        }

        .afs-print-root h2 {
          margin: 0 0 4.5mm 0 !important;
          padding-bottom: 1.2mm !important;
          border-bottom: 1.4px solid #111827 !important;
          font-size: 13.2pt !important;
          line-height: 1.12 !important;
        }

        .afs-print-root h3,
        .afs-print-root h4 {
          text-decoration: none !important;
          border-bottom: 0 !important;
        }

        /* Front page: less shouty client name. */
        .afs-print-root #afs-cover h1 {
          font-size: 10.2pt !important;
          line-height: 1.12 !important;
          margin: 0 0 1.2mm 0 !important;
        }
        .afs-print-root #afs-cover p {
          font-size: 8.9pt !important;
          line-height: 1.18 !important;
          margin: 0.45mm 0 !important;
        }
        .afs-print-root #afs-cover p:first-of-type {
          margin-bottom: 3mm !important;
        }
        .afs-print-root #afs-cover p:last-child {
          margin-top: 3mm !important;
        }

        /* General info + index: NO ruled rows/dots. */
        .afs-print-root #afs-general-info table,
        .afs-print-root #afs-general-info tr,
        .afs-print-root #afs-general-info td,
        .afs-print-root #afs-index table,
        .afs-print-root #afs-index tr,
        .afs-print-root #afs-index td,
        .afs-print-root #afs-index .indexDots {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
          background-image: none !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-index td {
          padding-top: 1.55mm !important;
          padding-bottom: 1.05mm !important;
        }

        /* Directors report: avoid orphaned headings/tables and remove light table lines. */
        .afs-print-root #afs-directors-responsibilities p,
        .afs-print-root #afs-directors-report p {
          margin: 0 0 1.2mm 0 !important;
          line-height: 1.16 !important;
          orphans: 3 !important;
          widows: 3 !important;
        }
        .afs-print-root #afs-directors-report .reportSectionBlock {
          margin: 0 0 2.1mm 0 !important;
          padding: 0 !important;
          border: 0 !important;
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }
        .afs-print-root #afs-directors-report table,
        .afs-print-root #afs-directors-report tr,
        .afs-print-root #afs-directors-report td,
        .afs-print-root #afs-directors-report th {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-directors-report thead th,
        .afs-print-root #afs-directors-report tr:first-child th {
          border-bottom: 1px solid #cbd5e1 !important;
        }

        /* SCE: remove the weird first-column underlines and long amount lines. */
        .afs-print-root #afs-sce table,
        .afs-print-root #afs-sce thead,
        .afs-print-root #afs-sce tbody,
        .afs-print-root #afs-sce tr,
        .afs-print-root #afs-sce th,
        .afs-print-root #afs-sce td,
        .afs-print-root #afs-sce span,
        .afs-print-root #afs-sce div,
        .afs-print-root #afs-socie table,
        .afs-print-root #afs-socie thead,
        .afs-print-root #afs-socie tbody,
        .afs-print-root #afs-socie tr,
        .afs-print-root #afs-socie th,
        .afs-print-root #afs-socie td,
        .afs-print-root #afs-socie span,
        .afs-print-root #afs-socie div {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-print-root #afs-sce thead th,
        .afs-print-root #afs-socie thead th {
          border-bottom: 1px solid #111827 !important;
          padding-bottom: 1mm !important;
        }
        .afs-print-root #afs-sce td,
        .afs-print-root #afs-socie td {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
        }
        .afs-print-root #afs-sce tr:last-child td,
        .afs-print-root #afs-socie tr:last-child td {
          border-bottom: 0 !important;
        }

        /* Notes: keep year labels at each note table; no random long lines under every amount. */
        .afs-print-root #afs-notes .noteStatementTable {
          width: 156mm !important;
          max-width: 156mm !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          margin: 1.1mm 0 3.1mm 0 !important;
        }
        .afs-print-root #afs-notes .noteStatementTable thead,
        .afs-print-root #afs-notes .noteRepeatedHeader {
          display: table-header-group !important;
        }
        .afs-print-root #afs-notes .noteStatementTable thead th,
        .afs-print-root #afs-notes .noteTh,
        .afs-print-root #afs-notes .noteThRight {
          display: table-cell !important;
          border-top: 0 !important;
          border-bottom: 1px solid #111827 !important;
          padding-top: 1mm !important;
          padding-bottom: 0.9mm !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-notes table,
        .afs-print-root #afs-notes tbody,
        .afs-print-root #afs-notes tr,
        .afs-print-root #afs-notes td,
        .afs-print-root #afs-notes span,
        .afs-print-root #afs-notes div,
        .afs-print-root #afs-notes .noteTd,
        .afs-print-root #afs-notes .noteAmount,
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-print-root #afs-notes .noteTotalAmount {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-print-root #afs-notes .noteTd,
        .afs-print-root #afs-notes .noteAmount {
          padding-top: 0.75mm !important;
          padding-bottom: 0.75mm !important;
        }
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-print-root #afs-notes .noteTotalAmount {
          padding-top: 0.95mm !important;
          padding-bottom: 0.85mm !important;
          font-weight: 900 !important;
        }
        .afs-print-root #afs-notes .noteTotalAmount {
          border-bottom: 1.2px solid #111827 !important;
        }
        .afs-print-root #afs-notes h4 {
          margin: 3mm 0 0.7mm 0 !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .afs-print-root #afs-notes p {
          margin: 0 0 0.65mm 0 !important;
        }
        .afs-print-root #afs-notes .noteSectionAnchor,
        .afs-print-root #afs-notes .noteSectionAnchorOff {
          margin-top: 3.6mm !important;
          padding-top: 0 !important;
          border: 0 !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
        }
        .afs-print-root #afs-notes .noteSectionAnchor h4,
        .afs-print-root #afs-notes .noteSectionAnchor table thead {
          break-after: avoid !important;
          page-break-after: avoid !important;
        }

        /* Loan note: account name and terms directly below each other, same left edge. */
        .afs-print-root .loanTermsInlineLabel {
          display: none !important;
        }
        .afs-print-root .loanTermsInlineCombined,
        .afs-print-root .loanTermsInput {
          padding-left: 0 !important;
          margin-left: 0 !important;
          text-indent: 0 !important;
          border: 0 !important;
        }
        .afs-print-root .loanTermsInlineCombined {
          padding-top: 0.1mm !important;
          padding-bottom: 0.8mm !important;
        }

        /* Detailed income + tax: no long rules; no amount-only overlines except final total underline. */
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-tax-computation table {
          width: 156mm !important;
          max-width: 156mm !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-detailed-income thead,
        .afs-print-root #afs-detailed-income tbody,
        .afs-print-root #afs-detailed-income tr,
        .afs-print-root #afs-detailed-income th,
        .afs-print-root #afs-detailed-income td,
        .afs-print-root #afs-tax-computation table,
        .afs-print-root #afs-tax-computation thead,
        .afs-print-root #afs-tax-computation tbody,
        .afs-print-root #afs-tax-computation tr,
        .afs-print-root #afs-tax-computation th,
        .afs-print-root #afs-tax-computation td,
        .afs-print-root #afs-tax-computation div,
        .afs-print-root #afs-detailed-income div,
        .afs-print-root #afs-tax-computation span,
        .afs-print-root #afs-detailed-income span {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-print-root #afs-detailed-income thead th,
        .afs-print-root #afs-tax-computation thead th {
          border-bottom: 1px solid #111827 !important;
          padding-top: 0.95mm !important;
          padding-bottom: 0.85mm !important;
        }
        .afs-print-root #afs-detailed-income td,
        .afs-print-root #afs-tax-computation td {
          padding-top: 0.78mm !important;
          padding-bottom: 0.78mm !important;
        }
        .afs-print-root #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-print-root #afs-tax-computation tr:last-child td:not(:first-child) {
          border-bottom: 1.2px solid #111827 !important;
        }
        .afs-print-root #afs-detailed-income tr:last-child td:first-child,
        .afs-print-root #afs-tax-computation tr:last-child td:first-child {
          border: 0 !important;
        }
        .afs-print-root #afs-tax-computation [style*="borderBottom"],
        .afs-print-root #afs-tax-computation [style*="border-bottom"],
        .afs-print-root #afs-tax-computation [style*="#e2e8f0"],
        .afs-print-root #afs-tax-computation [style*="#cbd5e1"] {
          border-bottom: 0 !important;
          border-top: 0 !important;
        }

        }

        /* V61 FINAL LINE + SPACING DISCIPLINE
           This deliberately overrides previous noisy table-line experiments.
           Keep the CaseWare-style section header rules, remove random row/amount/label lines. */
        .afs-print-root,
        .afs-print-root * {
          font-family: Arial, Helvetica, sans-serif !important;
          font-stretch: normal !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }

        .afs-print-root .afs-print-page {
          padding-top: 12mm !important;
          padding-right: 18mm !important;
          padding-bottom: 19mm !important;
          padding-left: 18mm !important;
          overflow: visible !important;
        }

        .afs-print-root p {
          margin-top: 0 !important;
          margin-bottom: 1.15mm !important;
          line-height: 1.18 !important;
        }

        .afs-print-root h2 {
          margin: 0 0 4.5mm 0 !important;
          padding-bottom: 1.2mm !important;
          border-bottom: 1.4px solid #111827 !important;
          font-size: 13.2pt !important;
          line-height: 1.12 !important;
        }

        .afs-print-root h3,
        .afs-print-root h4 {
          text-decoration: none !important;
          border-bottom: 0 !important;
        }

        /* Front page: less shouty client name. */
        .afs-print-root #afs-cover h1 {
          font-size: 10.2pt !important;
          line-height: 1.12 !important;
          margin: 0 0 1.2mm 0 !important;
        }
        .afs-print-root #afs-cover p {
          font-size: 8.9pt !important;
          line-height: 1.18 !important;
          margin: 0.45mm 0 !important;
        }
        .afs-print-root #afs-cover p:first-of-type {
          margin-bottom: 3mm !important;
        }
        .afs-print-root #afs-cover p:last-child {
          margin-top: 3mm !important;
        }

        /* General info + index: NO ruled rows/dots. */
        .afs-print-root #afs-general-info table,
        .afs-print-root #afs-general-info tr,
        .afs-print-root #afs-general-info td,
        .afs-print-root #afs-index table,
        .afs-print-root #afs-index tr,
        .afs-print-root #afs-index td,
        .afs-print-root #afs-index .indexDots {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
          background-image: none !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-index td {
          padding-top: 1.55mm !important;
          padding-bottom: 1.05mm !important;
        }

        /* Directors report: avoid orphaned headings/tables and remove light table lines. */
        .afs-print-root #afs-directors-responsibilities p,
        .afs-print-root #afs-directors-report p {
          margin: 0 0 1.2mm 0 !important;
          line-height: 1.16 !important;
          orphans: 3 !important;
          widows: 3 !important;
        }
        .afs-print-root #afs-directors-report .reportSectionBlock {
          margin: 0 0 2.1mm 0 !important;
          padding: 0 !important;
          border: 0 !important;
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }
        .afs-print-root #afs-directors-report table,
        .afs-print-root #afs-directors-report tr,
        .afs-print-root #afs-directors-report td,
        .afs-print-root #afs-directors-report th {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-directors-report thead th,
        .afs-print-root #afs-directors-report tr:first-child th {
          border-bottom: 1px solid #cbd5e1 !important;
        }

        /* SCE: remove the weird first-column underlines and long amount lines. */
        .afs-print-root #afs-sce table,
        .afs-print-root #afs-sce thead,
        .afs-print-root #afs-sce tbody,
        .afs-print-root #afs-sce tr,
        .afs-print-root #afs-sce th,
        .afs-print-root #afs-sce td,
        .afs-print-root #afs-sce span,
        .afs-print-root #afs-sce div,
        .afs-print-root #afs-socie table,
        .afs-print-root #afs-socie thead,
        .afs-print-root #afs-socie tbody,
        .afs-print-root #afs-socie tr,
        .afs-print-root #afs-socie th,
        .afs-print-root #afs-socie td,
        .afs-print-root #afs-socie span,
        .afs-print-root #afs-socie div {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-print-root #afs-sce thead th,
        .afs-print-root #afs-socie thead th {
          border-bottom: 1px solid #111827 !important;
          padding-bottom: 1mm !important;
        }
        .afs-print-root #afs-sce td,
        .afs-print-root #afs-socie td {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
        }
        .afs-print-root #afs-sce tr:last-child td,
        .afs-print-root #afs-socie tr:last-child td {
          border-bottom: 0 !important;
        }

        /* Notes: keep year labels at each note table; no random long lines under every amount. */
        .afs-print-root #afs-notes .noteStatementTable {
          width: 156mm !important;
          max-width: 156mm !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          margin: 1.1mm 0 3.1mm 0 !important;
        }
        .afs-print-root #afs-notes .noteStatementTable thead,
        .afs-print-root #afs-notes .noteRepeatedHeader {
          display: table-header-group !important;
        }
        .afs-print-root #afs-notes .noteStatementTable thead th,
        .afs-print-root #afs-notes .noteTh,
        .afs-print-root #afs-notes .noteThRight {
          display: table-cell !important;
          border-top: 0 !important;
          border-bottom: 1px solid #111827 !important;
          padding-top: 1mm !important;
          padding-bottom: 0.9mm !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-notes table,
        .afs-print-root #afs-notes tbody,
        .afs-print-root #afs-notes tr,
        .afs-print-root #afs-notes td,
        .afs-print-root #afs-notes span,
        .afs-print-root #afs-notes div,
        .afs-print-root #afs-notes .noteTd,
        .afs-print-root #afs-notes .noteAmount,
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-print-root #afs-notes .noteTotalAmount {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-print-root #afs-notes .noteTd,
        .afs-print-root #afs-notes .noteAmount {
          padding-top: 0.75mm !important;
          padding-bottom: 0.75mm !important;
        }
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-print-root #afs-notes .noteTotalAmount {
          padding-top: 0.95mm !important;
          padding-bottom: 0.85mm !important;
          font-weight: 900 !important;
        }
        .afs-print-root #afs-notes .noteTotalAmount {
          border-bottom: 1.2px solid #111827 !important;
        }
        .afs-print-root #afs-notes h4 {
          margin: 3mm 0 0.7mm 0 !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .afs-print-root #afs-notes p {
          margin: 0 0 0.65mm 0 !important;
        }
        .afs-print-root #afs-notes .noteSectionAnchor,
        .afs-print-root #afs-notes .noteSectionAnchorOff {
          margin-top: 3.6mm !important;
          padding-top: 0 !important;
          border: 0 !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
        }
        .afs-print-root #afs-notes .noteSectionAnchor h4,
        .afs-print-root #afs-notes .noteSectionAnchor table thead {
          break-after: avoid !important;
          page-break-after: avoid !important;
        }

        /* Loan note: account name and terms directly below each other, same left edge. */
        .afs-print-root .loanTermsInlineLabel {
          display: none !important;
        }
        .afs-print-root .loanTermsInlineCombined,
        .afs-print-root .loanTermsInput {
          padding-left: 0 !important;
          margin-left: 0 !important;
          text-indent: 0 !important;
          border: 0 !important;
        }
        .afs-print-root .loanTermsInlineCombined {
          padding-top: 0.1mm !important;
          padding-bottom: 0.8mm !important;
        }

        /* Detailed income + tax: no long rules; no amount-only overlines except final total underline. */
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-tax-computation table {
          width: 156mm !important;
          max-width: 156mm !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-detailed-income thead,
        .afs-print-root #afs-detailed-income tbody,
        .afs-print-root #afs-detailed-income tr,
        .afs-print-root #afs-detailed-income th,
        .afs-print-root #afs-detailed-income td,
        .afs-print-root #afs-tax-computation table,
        .afs-print-root #afs-tax-computation thead,
        .afs-print-root #afs-tax-computation tbody,
        .afs-print-root #afs-tax-computation tr,
        .afs-print-root #afs-tax-computation th,
        .afs-print-root #afs-tax-computation td,
        .afs-print-root #afs-tax-computation div,
        .afs-print-root #afs-detailed-income div,
        .afs-print-root #afs-tax-computation span,
        .afs-print-root #afs-detailed-income span {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-print-root #afs-detailed-income thead th,
        .afs-print-root #afs-tax-computation thead th {
          border-bottom: 1px solid #111827 !important;
          padding-top: 0.95mm !important;
          padding-bottom: 0.85mm !important;
        }
        .afs-print-root #afs-detailed-income td,
        .afs-print-root #afs-tax-computation td {
          padding-top: 0.78mm !important;
          padding-bottom: 0.78mm !important;
        }
        .afs-print-root #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-print-root #afs-tax-computation tr:last-child td:not(:first-child) {
          border-bottom: 1.2px solid #111827 !important;
        }
        .afs-print-root #afs-detailed-income tr:last-child td:first-child,
        .afs-print-root #afs-tax-computation tr:last-child td:first-child {
          border: 0 !important;
        }
        .afs-print-root #afs-tax-computation [style*="borderBottom"],
        .afs-print-root #afs-tax-computation [style*="border-bottom"],
        .afs-print-root #afs-tax-computation [style*="#e2e8f0"],
        .afs-print-root #afs-tax-computation [style*="#cbd5e1"] {
          border-bottom: 0 !important;
          border-top: 0 !important;
        }


        /* V62: real final override - removes visual noise and fixes page flow. */
        .afs-print-root,
        .afs-pdf-export-host,
        .afs-print-root *,
        .afs-pdf-export-host * {
          font-family: Arial, Helvetica, sans-serif !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-print-root .afs-print-page,
        .afs-pdf-export-host .afs-print-page {
          display: block !important;
          grid-template-rows: none !important;
          min-height: 297mm !important;
          padding: 12mm 18mm 19mm 18mm !important;
          overflow: visible !important;
        }
        .afs-print-root .afs-page-content,
        .afs-pdf-export-host .afs-page-content {
          display: block !important;
          min-height: 0 !important;
        }
        .afs-print-root .afsPageEntityHeader,
        .afs-pdf-export-host .afsPageEntityHeader {
          margin: 0 0 9mm 0 !important;
          padding: 0 0 2.8mm 0 !important;
          border-bottom: 1.5px solid #111827 !important;
        }
        .afs-print-root .afsPageEntityHeader h1,
        .afs-pdf-export-host .afsPageEntityHeader h1 {
          font-size: 10.8pt !important;
          line-height: 1.08 !important;
          margin: 0 0 0.7mm 0 !important;
        }
        .afs-print-root .afsPageEntityHeader p,
        .afs-pdf-export-host .afsPageEntityHeader p {
          font-size: 8pt !important;
          line-height: 1.10 !important;
          margin: 0.35mm 0 0 0 !important;
        }
        .afs-print-root h2,
        .afs-pdf-export-host h2 {
          font-size: 13pt !important;
          line-height: 1.12 !important;
          margin: 0 0 7mm 0 !important;
          padding-bottom: 2.2mm !important;
          border-bottom: 1.5px solid #111827 !important;
        }
        .afs-print-root h3,
        .afs-print-root h4,
        .afs-pdf-export-host h3,
        .afs-pdf-export-host h4 {
          text-decoration: none !important;
          border: 0 !important;
        }
        .afs-print-root #afs-index h2,
        .afs-pdf-export-host #afs-index h2 {
          margin-bottom: 8mm !important;
          padding-bottom: 2.4mm !important;
        }
        .afs-print-root #afs-index table,
        .afs-print-root #afs-index tr,
        .afs-print-root #afs-index td,
        .afs-pdf-export-host #afs-index table,
        .afs-pdf-export-host #afs-index tr,
        .afs-pdf-export-host #afs-index td {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
          background: transparent !important;
          background-image: none !important;
        }
        .afs-print-root #afs-index td,
        .afs-pdf-export-host #afs-index td {
          padding-top: 1.15mm !important;
          padding-bottom: 1.15mm !important;
        }
        .afs-print-root #afs-general-info table,
        .afs-print-root #afs-general-info tr,
        .afs-print-root #afs-general-info td,
        .afs-pdf-export-host #afs-general-info table,
        .afs-pdf-export-host #afs-general-info tr,
        .afs-pdf-export-host #afs-general-info td {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        .afs-print-root #afs-general-info td,
        .afs-pdf-export-host #afs-general-info td {
          padding-top: 1.6mm !important;
          padding-bottom: 1.6mm !important;
        }
        .afs-print-root #afs-directors-responsibilities p,
        .afs-pdf-export-host #afs-directors-responsibilities p {
          margin: 0 0 1.05mm 0 !important;
          line-height: 1.14 !important;
        }
        .afs-print-root #afs-directors-report .reportSectionBlock,
        .afs-pdf-export-host #afs-directors-report .reportSectionBlock {
          margin: 0 0 2.2mm 0 !important;
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }
        .afs-print-root #afs-directors-report p,
        .afs-pdf-export-host #afs-directors-report p {
          margin: 0 0 0.9mm 0 !important;
          line-height: 1.13 !important;
        }
        .afs-print-root #afs-directors-report table,
        .afs-print-root #afs-directors-report tr,
        .afs-print-root #afs-directors-report td,
        .afs-print-root #afs-directors-report th,
        .afs-pdf-export-host #afs-directors-report table,
        .afs-pdf-export-host #afs-directors-report tr,
        .afs-pdf-export-host #afs-directors-report td,
        .afs-pdf-export-host #afs-directors-report th {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        .afs-print-root #afs-directors-report thead th,
        .afs-pdf-export-host #afs-directors-report thead th {
          border-bottom: 1px solid #cbd5e1 !important;
        }

        /* Statements: only header rule + accountant amount rules, no stray top line before columns. */
        .afs-print-root #afs-sfp thead th,
        .afs-print-root #afs-sci thead th,
        .afs-print-root #afs-cash-flow thead th,
        .afs-pdf-export-host #afs-sfp thead th,
        .afs-pdf-export-host #afs-sci thead th,
        .afs-pdf-export-host #afs-cash-flow thead th {
          border-top: 0 !important;
          border-bottom: 1px solid #111827 !important;
        }
        .afs-print-root #afs-sfp td:first-child,
        .afs-print-root #afs-sci td:first-child,
        .afs-print-root #afs-cash-flow td:first-child,
        .afs-pdf-export-host #afs-sfp td:first-child,
        .afs-pdf-export-host #afs-sci td:first-child,
        .afs-pdf-export-host #afs-cash-flow td:first-child {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
        }

        /* SCE: absolutely no row underlines / first-column rules. */
        .afs-print-root #afs-sce table,
        .afs-print-root #afs-sce thead,
        .afs-print-root #afs-sce tbody,
        .afs-print-root #afs-sce tr,
        .afs-print-root #afs-sce th,
        .afs-print-root #afs-sce td,
        .afs-print-root #afs-sce div,
        .afs-print-root #afs-sce span,
        .afs-pdf-export-host #afs-sce table,
        .afs-pdf-export-host #afs-sce thead,
        .afs-pdf-export-host #afs-sce tbody,
        .afs-pdf-export-host #afs-sce tr,
        .afs-pdf-export-host #afs-sce th,
        .afs-pdf-export-host #afs-sce td,
        .afs-pdf-export-host #afs-sce div,
        .afs-pdf-export-host #afs-sce span {
          border: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-sce td,
        .afs-pdf-export-host #afs-sce td {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
        }

        /* Notes and schedules: no grid lines; short amount rules only for totals. */
        .afs-print-root #afs-notes .noteSectionAnchor,
        .afs-print-root #afs-notes .noteSectionAnchorOff,
        .afs-pdf-export-host #afs-notes .noteSectionAnchor,
        .afs-pdf-export-host #afs-notes .noteSectionAnchorOff {
          margin-top: 4.2mm !important;
          padding-top: 0 !important;
          border: 0 !important;
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }
        .afs-print-root #afs-notes .noteStatementTable,
        .afs-pdf-export-host #afs-notes .noteStatementTable {
          width: 148mm !important;
          max-width: 148mm !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
          margin: 1.2mm 0 4mm 0 !important;
        }
        .afs-print-root #afs-notes .noteStatementTable col:first-child,
        .afs-pdf-export-host #afs-notes .noteStatementTable col:first-child { width: 86mm !important; }
        .afs-print-root #afs-notes .noteStatementTable col:nth-child(2),
        .afs-print-root #afs-notes .noteStatementTable col:nth-child(3),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(2),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(3) { width: 31mm !important; }
        .afs-print-root #afs-notes table,
        .afs-print-root #afs-notes tr,
        .afs-print-root #afs-notes th,
        .afs-print-root #afs-notes td,
        .afs-print-root #afs-notes div,
        .afs-print-root #afs-notes span,
        .afs-pdf-export-host #afs-notes table,
        .afs-pdf-export-host #afs-notes tr,
        .afs-pdf-export-host #afs-notes th,
        .afs-pdf-export-host #afs-notes td,
        .afs-pdf-export-host #afs-notes div,
        .afs-pdf-export-host #afs-notes span {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-notes .noteStatementTable thead th,
        .afs-pdf-export-host #afs-notes .noteStatementTable thead th {
          border-bottom: 1px solid #111827 !important;
          padding-top: 0.9mm !important;
          padding-bottom: 0.9mm !important;
        }
        .afs-print-root #afs-notes .noteTd,
        .afs-print-root #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount {
          padding-top: 0.8mm !important;
          padding-bottom: 0.8mm !important;
          border: 0 !important;
        }
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalLabel {
          border: 0 !important;
          padding-top: 1.05mm !important;
          padding-bottom: 1.05mm !important;
        }
        .afs-print-root #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border-top: 0 !important;
          border-bottom: 1.3px solid #111827 !important;
          padding-top: 1.35mm !important;
          padding-bottom: 1.15mm !important;
          line-height: 1.25 !important;
        }
        .afs-print-root .loanTermsInlineCombined,
        .afs-pdf-export-host .loanTermsInlineCombined {
          padding: 0 0 1.05mm 0 !important;
          margin: 0 !important;
          text-indent: 0 !important;
          border: 0 !important;
        }
        .afs-print-root .loanTermsInput,
        .afs-pdf-export-host .loanTermsInput {
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          text-indent: 0 !important;
          font-size: inherit !important;
          line-height: inherit !important;
        }
        .afs-print-root .loanTermsInlineLabel,
        .afs-pdf-export-host .loanTermsInlineLabel { display: none !important; }

        /* Detailed income + tax computation: stop amount lines crossing through text/figures. */
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-tax-computation table,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table {
          width: 148mm !important;
          max-width: 148mm !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
          margin-left: 0 !important;
          margin-right: auto !important;
        }
        .afs-print-root #afs-detailed-income table col:first-child,
        .afs-print-root #afs-tax-computation table col:first-child,
        .afs-pdf-export-host #afs-detailed-income table col:first-child,
        .afs-pdf-export-host #afs-tax-computation table col:first-child { width: 86mm !important; }
        .afs-print-root #afs-detailed-income table col:nth-child(2),
        .afs-print-root #afs-detailed-income table col:nth-child(3),
        .afs-print-root #afs-tax-computation table col:nth-child(2),
        .afs-print-root #afs-tax-computation table col:nth-child(3),
        .afs-pdf-export-host #afs-detailed-income table col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income table col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation table col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation table col:nth-child(3) { width: 31mm !important; }
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-detailed-income thead,
        .afs-print-root #afs-detailed-income tbody,
        .afs-print-root #afs-detailed-income tr,
        .afs-print-root #afs-detailed-income th,
        .afs-print-root #afs-detailed-income td,
        .afs-print-root #afs-tax-computation table,
        .afs-print-root #afs-tax-computation thead,
        .afs-print-root #afs-tax-computation tbody,
        .afs-print-root #afs-tax-computation tr,
        .afs-print-root #afs-tax-computation th,
        .afs-print-root #afs-tax-computation td,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-detailed-income thead,
        .afs-pdf-export-host #afs-detailed-income tbody,
        .afs-pdf-export-host #afs-detailed-income tr,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation table,
        .afs-pdf-export-host #afs-tax-computation thead,
        .afs-pdf-export-host #afs-tax-computation tbody,
        .afs-pdf-export-host #afs-tax-computation tr,
        .afs-pdf-export-host #afs-tax-computation th,
        .afs-pdf-export-host #afs-tax-computation td {
          border-top: 0 !important;
          border-bottom: 0 !important;
          text-decoration: none !important;
        }
        .afs-print-root #afs-detailed-income thead th,
        .afs-print-root #afs-tax-computation thead th,
        .afs-pdf-export-host #afs-detailed-income thead th,
        .afs-pdf-export-host #afs-tax-computation thead th {
          border-bottom: 1px solid #111827 !important;
          padding-top: 0.95mm !important;
          padding-bottom: 0.95mm !important;
        }
        .afs-print-root #afs-detailed-income td,
        .afs-print-root #afs-tax-computation td,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-pdf-export-host #afs-tax-computation td {
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
        }
        .afs-print-root #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-print-root #afs-tax-computation tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:not(:first-child) {
          border-bottom: 1.3px solid #111827 !important;
          padding-bottom: 1.2mm !important;
        }
        .afs-print-root #afs-tax-computation div,
        .afs-pdf-export-host #afs-tax-computation div {
          border-bottom: 0 !important;
        }

        /* Screen editor: remove artificial massive gaps; keep textareas normal. */
        .afs-print-root .inlineEditorTextarea,
        .afs-print-root textarea {
          white-space: pre-wrap !important;
        }



        /* V63 screen preview/editor: remove artificial giant gaps and table noise */
        .afs-print-root #afs-socie td,
        .afs-print-root #afs-socie th,
        .afs-print-root #afs-detailed-income td,
        .afs-print-root #afs-detailed-income th,
        .afs-print-root #afs-tax-computation td,
        .afs-print-root #afs-tax-computation th,
        .afs-print-root #afs-notes td,
        .afs-print-root #afs-notes th {
          text-decoration: none !important;
          box-shadow: none !important;
        }
        .afs-print-root #afs-socie td:first-child,
        .afs-print-root #afs-socie th:first-child,
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-print-root #afs-detailed-income td:first-child,
        .afs-print-root #afs-tax-computation td:first-child {
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-tax-computation table {
          width: 100% !important;
          table-layout: fixed !important;
        }
        .afs-print-root #afs-detailed-income col:nth-child(2),
        .afs-print-root #afs-detailed-income col:nth-child(3),
        .afs-print-root #afs-tax-computation col:nth-child(2),
        .afs-print-root #afs-tax-computation col:nth-child(3) { width: 150px !important; }
        .afs-print-root .inlineEditorTextarea,
        .afs-print-root textarea {
          white-space: pre-wrap !important;
          min-height: 90px;
        }
        .afs-print-root #afs-index td { border-bottom: 0 !important; }


        /* V65: final screen fixes - anchor jumps, note editor focus, and right aligned detailed/tax columns */
        .afs-screen-anchor {
          display: block !important;
          height: 1px !important;
          margin: 0 !important;
          padding: 0 !important;
          scroll-margin-top: 110px !important;
        }
        .afs-print-root #afs-notes .noteLineInput,
        .afs-print-root #afs-notes .loanTermsInput {
          pointer-events: auto !important;
          user-select: text !important;
        }
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-tax-computation table {
          width: 154mm !important;
          max-width: 154mm !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          table-layout: fixed !important;
        }
        .afs-print-root #afs-detailed-income col:first-child,
        .afs-print-root #afs-tax-computation col:first-child { width: 98mm !important; }
        .afs-print-root #afs-detailed-income col:nth-child(2),
        .afs-print-root #afs-detailed-income col:nth-child(3),
        .afs-print-root #afs-tax-computation col:nth-child(2),
        .afs-print-root #afs-tax-computation col:nth-child(3) { width: 28mm !important; }
        .afs-print-root #afs-detailed-income td:not(:first-child),
        .afs-print-root #afs-detailed-income th:not(:first-child),
        .afs-print-root #afs-tax-computation td:not(:first-child),
        .afs-print-root #afs-tax-computation th:not(:first-child) {
          text-align: right !important;
        }
        .afs-print-root #afs-detailed-income td:first-child,
        .afs-print-root #afs-tax-computation td:first-child {
          width: 98mm !important;
        }
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table {
          width: 154mm !important;
          max-width: 154mm !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          table-layout: fixed !important;
        }
        .afs-pdf-export-host #afs-detailed-income col:first-child,
        .afs-pdf-export-host #afs-tax-computation col:first-child { width: 98mm !important; }
        .afs-pdf-export-host #afs-detailed-income col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(3) { width: 28mm !important; }
        .afs-pdf-export-host #afs-detailed-income td:not(:first-child),
        .afs-pdf-export-host #afs-detailed-income th:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation th:not(:first-child) {
          text-align: right !important;
        }


        /* V68: final export polish - stop long rules and fix amount-column geometry. */
        .afs-print-root, .afs-pdf-export-host { font-family: Arial, Helvetica, sans-serif !important; }
        .afs-print-root .afsPageEntityHeader,
        .afs-pdf-export-host .afsPageEntityHeader { margin-bottom: 7mm !important; }
        .afs-print-root .afsPageEntityHeader::after,
        .afs-pdf-export-host .afsPageEntityHeader::after { margin-top: 2mm !important; }
        .afs-print-root h2, .afs-pdf-export-host h2 { margin-bottom: 6mm !important; }
        .afs-print-root .pageTitle, .afs-pdf-export-host .pageTitle { padding-bottom: 2mm !important; }

        .afs-print-root table td, .afs-print-root table th,
        .afs-pdf-export-host table td, .afs-pdf-export-host table th { text-decoration: none !important; }

        .afs-print-root #afs-detailed-income table,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-print-root #afs-tax-computation table,
        .afs-pdf-export-host #afs-tax-computation table {
          width: 145mm !important;
          max-width: 145mm !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        .afs-print-root #afs-detailed-income col:first-child,
        .afs-pdf-export-host #afs-detailed-income col:first-child,
        .afs-print-root #afs-tax-computation col:first-child,
        .afs-pdf-export-host #afs-tax-computation col:first-child { width: 96mm !important; }
        .afs-print-root #afs-detailed-income col:nth-child(2),
        .afs-print-root #afs-detailed-income col:nth-child(3),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(3),
        .afs-print-root #afs-tax-computation col:nth-child(2),
        .afs-print-root #afs-tax-computation col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(3) { width: 24.5mm !important; }
        .afs-print-root #afs-detailed-income th,
        .afs-pdf-export-host #afs-detailed-income th,
        .afs-print-root #afs-tax-computation th,
        .afs-pdf-export-host #afs-tax-computation th { border-top: 0 !important; border-bottom: 1px solid #111827 !important; }
        .afs-print-root #afs-detailed-income td,
        .afs-pdf-export-host #afs-detailed-income td,
        .afs-print-root #afs-tax-computation td,
        .afs-pdf-export-host #afs-tax-computation td { border-bottom: 0 !important; }
        .afs-print-root #afs-detailed-income td:nth-child(2),
        .afs-print-root #afs-detailed-income td:nth-child(3),
        .afs-pdf-export-host #afs-detailed-income td:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income td:nth-child(3),
        .afs-print-root #afs-tax-computation td:nth-child(2),
        .afs-print-root #afs-tax-computation td:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation td:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation td:nth-child(3) { text-align: right !important; padding-left: 2mm !important; padding-right: 0 !important; }
        .afs-print-root #afs-detailed-income .detailedIncomeTotalAmount,
        .afs-print-root #afs-detailed-income .detailedIncomeFinalAmount,
        .afs-pdf-export-host #afs-detailed-income .detailedIncomeTotalAmount,
        .afs-pdf-export-host #afs-detailed-income .detailedIncomeFinalAmount,
        .afs-print-root #afs-tax-computation .taxComputationTotalAmount,
        .afs-print-root #afs-tax-computation .taxComputationFinalAmount,
        .afs-pdf-export-host #afs-tax-computation .taxComputationTotalAmount,
        .afs-pdf-export-host #afs-tax-computation .taxComputationFinalAmount { border-top: 1px solid #111827 !important; border-bottom: 0 !important; }

        .afs-print-root #afs-notes table,
        .afs-pdf-export-host #afs-notes table { table-layout: fixed !important; width: 145mm !important; border-collapse: collapse !important; }
        .afs-print-root #afs-notes col:first-child,
        .afs-pdf-export-host #afs-notes col:first-child { width: 99mm !important; }
        .afs-print-root #afs-notes col:nth-child(2),
        .afs-print-root #afs-notes col:nth-child(3),
        .afs-pdf-export-host #afs-notes col:nth-child(2),
        .afs-pdf-export-host #afs-notes col:nth-child(3) { width: 23mm !important; }
        .afs-print-root #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteAmount { border: 0 !important; padding-left: 1.5mm !important; padding-right: 0 !important; }
        .afs-print-root #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border-top: 1px solid #111827 !important;
          border-bottom: 0 !important;
          padding-left: 1.5mm !important;
          padding-right: 0 !important;
          text-align: right !important;
        }
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalLabel { border: 0 !important; }
        .afs-print-root #afs-notes .loanTermsInlineCombined,
        .afs-pdf-export-host #afs-notes .loanTermsInlineCombined { padding-left: 0 !important; }
        .afs-print-root #afs-notes .loanTermsInlineLabel,
        .afs-pdf-export-host #afs-notes .loanTermsInlineLabel { display: none !important; }

        .afs-print-root #afs-directors-responsibilities .signatureLine,
        .afs-pdf-export-host #afs-directors-responsibilities .signatureLine,
        .afs-print-root .signatureLine,
        .afs-pdf-export-host .signatureLine { width: 58mm !important; max-width: 58mm !important; }

        .afs-print-root #afs-directors-report p,
        .afs-pdf-export-host #afs-directors-report p,
        .afs-print-root #afs-directors-responsibilities p,
        .afs-pdf-export-host #afs-directors-responsibilities p { line-height: 1.16 !important; margin-bottom: 2.2mm !important; }


        /* V69_EXPORT_FOUNDATION_RESET
           This is the final override layer. It stops the long cross-column rules,
           keeps amount rules only under amount columns, prevents black canvas blocks,
           and aligns Detailed IS / Tax Comp like an AFS statement instead of a web table. */
        .afs-print-root *,
        .afs-pdf-export-host * {
          text-decoration: none !important;
          box-shadow: none !important;
          background-image: none !important;
        }

        .afs-print-root table,
        .afs-pdf-export-host table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
          background: transparent !important;
        }
        .afs-print-root tr,
        .afs-pdf-export-host tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .afs-print-root td,
        .afs-print-root th,
        .afs-pdf-export-host td,
        .afs-pdf-export-host th {
          background: transparent !important;
          border-left: 0 !important;
          border-right: 0 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }

        /* section headings: enough breathing room below text and above rule */
        .afs-print-root .afsPageEntityHeader,
        .afs-pdf-export-host .afsPageEntityHeader {
          padding-bottom: 2.4mm !important;
          margin-bottom: 7mm !important;
          border-bottom: 1.1px solid #111827 !important;
        }
        .afs-print-root .pageTitle,
        .afs-pdf-export-host .pageTitle,
        .afs-print-root h2,
        .afs-pdf-export-host h2 {
          padding-bottom: 2.4mm !important;
          margin-bottom: 6mm !important;
          border-bottom: 1.1px solid #111827 !important;
        }

        /* Do not allow the Directors' responsibility signature to become a full-page line */
        .afs-print-root .signatureLine,
        .afs-pdf-export-host .signatureLine {
          width: 52mm !important;
          max-width: 52mm !important;
          min-width: 52mm !important;
          border-top: 1px solid #111827 !important;
          border-bottom: 0 !important;
          background: transparent !important;
        }

        /* Statement tables: remove random description-column lines */
        .afs-print-root #afs-sfp td:first-child,
        .afs-print-root #afs-sfp th:first-child,
        .afs-print-root #afs-sci td:first-child,
        .afs-print-root #afs-sci th:first-child,
        .afs-print-root #afs-socie td:first-child,
        .afs-print-root #afs-socie th:first-child,
        .afs-print-root #afs-cash-flow td:first-child,
        .afs-print-root #afs-cash-flow th:first-child,
        .afs-pdf-export-host #afs-sfp td:first-child,
        .afs-pdf-export-host #afs-sfp th:first-child,
        .afs-pdf-export-host #afs-sci td:first-child,
        .afs-pdf-export-host #afs-sci th:first-child,
        .afs-pdf-export-host #afs-socie td:first-child,
        .afs-pdf-export-host #afs-socie th:first-child,
        .afs-pdf-export-host #afs-cash-flow td:first-child,
        .afs-pdf-export-host #afs-cash-flow th:first-child {
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        .afs-print-root #afs-sfp td:not(:first-child),
        .afs-print-root #afs-sci td:not(:first-child),
        .afs-print-root #afs-socie td:not(:first-child),
        .afs-print-root #afs-cash-flow td:not(:first-child),
        .afs-pdf-export-host #afs-sfp td:not(:first-child),
        .afs-pdf-export-host #afs-sci td:not(:first-child),
        .afs-pdf-export-host #afs-socie td:not(:first-child),
        .afs-pdf-export-host #afs-cash-flow td:not(:first-child) {
          text-align: right !important;
          border-bottom-color: #111827 !important;
          border-bottom-width: 0.75px !important;
          background: transparent !important;
        }
        .afs-print-root #afs-socie td,
        .afs-pdf-export-host #afs-socie td {
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        .afs-print-root #afs-socie tr td:not(:first-child),
        .afs-pdf-export-host #afs-socie tr td:not(:first-child) {
          border-bottom: 0 !important;
        }
        .afs-print-root #afs-socie tr:nth-child(4n) td:not(:first-child),
        .afs-pdf-export-host #afs-socie tr:nth-child(4n) td:not(:first-child) {
          border-top: 0.75px solid #111827 !important;
        }

        /* Notes: neat amount columns, no long rules, totals get short amount-column rules only */
        .afs-print-root #afs-notes .noteStatementTable,
        .afs-pdf-export-host #afs-notes .noteStatementTable {
          width: 154mm !important;
          max-width: 154mm !important;
          table-layout: fixed !important;
          margin: 1.5mm 0 6mm 0 !important;
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }
        .afs-print-root #afs-notes .noteStatementTable col:first-child,
        .afs-pdf-export-host #afs-notes .noteStatementTable col:first-child { width: 104mm !important; }
        .afs-print-root #afs-notes .noteStatementTable col:nth-child(2),
        .afs-print-root #afs-notes .noteStatementTable col:nth-child(3),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(2),
        .afs-pdf-export-host #afs-notes .noteStatementTable col:nth-child(3) { width: 25mm !important; }
        .afs-print-root #afs-notes .noteTd,
        .afs-print-root #afs-notes .noteAmount,
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-print-root #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-notes .noteTd,
        .afs-pdf-export-host #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border-top: 0 !important;
          border-bottom: 0 !important;
          padding-top: 0.85mm !important;
          padding-bottom: 0.85mm !important;
          background: transparent !important;
        }
        .afs-print-root #afs-notes .noteAmount,
        .afs-print-root #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-notes .noteAmount,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          text-align: right !important;
          padding-left: 2mm !important;
          padding-right: 0 !important;
        }
        .afs-print-root #afs-notes .noteTotalAmount,
        .afs-pdf-export-host #afs-notes .noteTotalAmount {
          border-top: 0.75px solid #111827 !important;
          border-bottom: 0.75px solid #111827 !important;
        }
        .afs-print-root #afs-notes .noteTotalLabel,
        .afs-pdf-export-host #afs-notes .noteTotalLabel {
          border: 0 !important;
        }
        .afs-print-root #afs-notes .loanTermsInlineCombined,
        .afs-pdf-export-host #afs-notes .loanTermsInlineCombined {
          padding: 0 0 1.5mm 0 !important;
          border: 0 !important;
          font-style: normal !important;
        }
        .afs-print-root #afs-notes .loanTermsInput,
        .afs-pdf-export-host #afs-notes .loanTermsInput {
          border: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          width: 100% !important;
        }

        /* Detailed IS and Tax Comp: push amount columns right; rules stay under amount columns only */
        .afs-print-root #afs-detailed-income table,
        .afs-print-root #afs-tax-computation table,
        .afs-pdf-export-host #afs-detailed-income table,
        .afs-pdf-export-host #afs-tax-computation table {
          width: 162mm !important;
          max-width: 162mm !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          table-layout: fixed !important;
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }
        .afs-print-root #afs-detailed-income col:first-child,
        .afs-print-root #afs-tax-computation col:first-child,
        .afs-pdf-export-host #afs-detailed-income col:first-child,
        .afs-pdf-export-host #afs-tax-computation col:first-child { width: 110mm !important; }
        .afs-print-root #afs-detailed-income col:nth-child(2),
        .afs-print-root #afs-detailed-income col:nth-child(3),
        .afs-print-root #afs-tax-computation col:nth-child(2),
        .afs-print-root #afs-tax-computation col:nth-child(3),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(2),
        .afs-pdf-export-host #afs-detailed-income col:nth-child(3),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(2),
        .afs-pdf-export-host #afs-tax-computation col:nth-child(3) { width: 26mm !important; }
        .afs-print-root #afs-detailed-income td:first-child,
        .afs-print-root #afs-tax-computation td:first-child,
        .afs-pdf-export-host #afs-detailed-income td:first-child,
        .afs-pdf-export-host #afs-tax-computation td:first-child {
          border-top: 0 !important;
          border-bottom: 0 !important;
        }
        .afs-print-root #afs-detailed-income td:not(:first-child),
        .afs-print-root #afs-tax-computation td:not(:first-child),
        .afs-pdf-export-host #afs-detailed-income td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation td:not(:first-child) {
          text-align: right !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
          padding-left: 2mm !important;
          padding-right: 0 !important;
        }
        .afs-print-root #afs-detailed-income .detailedIncomeTotalAmount,
        .afs-print-root #afs-detailed-income .detailedIncomeFinalAmount,
        .afs-print-root #afs-tax-computation .taxComputationTotalAmount,
        .afs-print-root #afs-tax-computation .taxComputationFinalAmount,
        .afs-pdf-export-host #afs-detailed-income .detailedIncomeTotalAmount,
        .afs-pdf-export-host #afs-detailed-income .detailedIncomeFinalAmount,
        .afs-pdf-export-host #afs-tax-computation .taxComputationTotalAmount,
        .afs-pdf-export-host #afs-tax-computation .taxComputationFinalAmount {
          border-top: 0.75px solid #111827 !important;
          border-bottom: 0 !important;
          background: transparent !important;
        }
        .afs-print-root #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-print-root #afs-tax-computation tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-detailed-income tr:last-child td:not(:first-child),
        .afs-pdf-export-host #afs-tax-computation tr:last-child td:not(:first-child) {
          border-bottom: 0.75px solid #111827 !important;
        }

        /* PDF page flow: keep the problem narrative sections compact and deterministic. */
        .afs-pdf-export-host #afs-directors-responsibilities p,
        .afs-pdf-export-host #afs-directors-report p {
          font-size: 8.9pt !important;
          line-height: 1.13 !important;
          margin: 0 0 1.35mm 0 !important;
        }
        .afs-pdf-export-host #afs-directors-report h4 {
          font-size: 8.9pt !important;
          line-height: 1.12 !important;
          margin: 1.7mm 0 0.45mm 0 !important;
        }
        .afs-pdf-export-host #afs-directors-report table,
        .afs-pdf-export-host #afs-directors-report tr,
        .afs-pdf-export-host #afs-directors-report td,
        .afs-pdf-export-host #afs-directors-report th {
          font-size: 8.6pt !important;
          line-height: 1.12 !important;
        }


      `}</style>
      <div className="afs-screen-only" style={styles.printToolbar}>
        <div>
          <strong style={styles.printToolbarTitle}>Print profiles</strong>
          <span style={styles.printToolbarText}>Draft includes watermark. Final downloads clean PDF. No Chrome print headers/footers.</span>
        </div>
        <div style={styles.printToolbarActions}>
          <button type="button" style={styles.printDraftButton} onClick={() => downloadAfsPdf("draft")} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? "Generating..." : "Download draft PDF"}
          </button>
          <button type="button" style={styles.printFinalButton} onClick={() => downloadAfsPdf("final")} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? "Generating..." : "Download final PDF"}
          </button>
        </div>
      </div>

      <div style={styles.afsWorkspace}>
        <div className={printProfile === "draft" ? "afs-print-root afs-print-draft" : "afs-print-root afs-print-final"} style={styles.documentStack}>
        <AfsPage id="afs-cover" pageNo="Cover"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
          <div style={styles.coverPageInner}>
            {options.showCoverLogo ? <div style={styles.logoBox}>CLIENT<br />LOGO</div> : null}
            <h1 style={styles.coverTitle}>{clientName}</h1>
            <p style={styles.coverLine}>{registrationNumber || "(Registration number)"}</p>
            <p style={styles.coverLine}>Annual Financial Statements</p>
            <p style={styles.coverLine}>for the year ended {formatDateLong(yearEnd)}</p>
            {options.showCoverFrameworkStatement ? (
              <p style={styles.coverSmall}>These financial statements were prepared in terms of {basis}.</p>
            ) : null}
            {options.showCoverNoAssuranceStatement ? (
              <p style={styles.coverSmall}>These financial statements have not been audited or independently reviewed.</p>
            ) : null}
            <p style={styles.coverLine}>Issued {formatDateLong(issueDate)}</p>
          </div>
        </AfsPage>

        <AfsPage id="afs-general-info" title="General Information" pageNo="1"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
          <InfoTable
            rows={[
              ["Company name", clientName],
              ["Registration number", registrationNumber],
              ["Country of incorporation and domicile", clean(clientSetup?.country) || "South Africa"],
              ["Nature of business and principal activities", clean(clientSetup?.nature_of_business) || ""],
              ["Directors / members / trustees", directors.map((person) => person.full_name).join("\n")],
              ["Registered office", joinAddress(clientSetup, "registered_office")],
              ["Business address", joinAddress(clientSetup, "physical_address")],
              ["Bankers", clean(clientSetup?.banker_name) || ""],
              ["Secretary", clean(clientSetup?.secretary_name) || ""],
              ["Income tax reference number", clean(clientSetup?.income_tax_number) || ""],
              ["VAT registration number", clean(clientSetup?.vat_number) || ""],
              ["Level of assurance", assurance],
              ["Preparer", clean(clientSetup?.practitioner_name) || clean(engagement?.prepared_by) || ""],
            ]}
          />
        </AfsPage>

        <AfsPage id="afs-index" title="Index" pageNo="2"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
          <table style={styles.indexTable}>
            <tbody>
              <IndexRow label="General Information" page="1" />
              {options.directorsResponsibilities ? <IndexRow label="Directors' Responsibilities and Approval" page="3" /> : null}
              {options.directorsReport ? <IndexRow label="Directors' Report" page="4" /> : null}
              {options.compilationReport ? <IndexRow label="Independent Compiler's Report" page="6" /> : null}
              <IndexRow label="Statement of Financial Position" page="7" />
              <IndexRow label="Statement of Comprehensive Income" page="8" />
              {options.statementOfChangesInEquity ? <IndexRow label="Statement of Changes in Equity" page="9" /> : null}
              {options.cashFlowStatement ? <IndexRow label="Statement of Cash Flows" page="10" /> : null}
              {options.accountingPolicies ? <IndexRow label="Accounting Policies" page="11" /> : null}
              {options.notes ? <IndexRow label="Notes to the Financial Statements" page="12" /> : null}
              {options.detailedIncomeStatement ? <IndexRow label="Detailed Income Statement" page="16" /> : null}
              {options.taxComputation ? <IndexRow label="Tax Computation" page="17" /> : null}
            </tbody>
          </table>
        </AfsPage>

        {options.directorsResponsibilities ? (
          <AfsPage id="afs-directors-responsibilities" title="Directors' Responsibilities and Approval" pageNo="3"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
            <p style={styles.paragraph}>
              The {directorTitle} are required in terms of the Companies Act of South Africa to maintain adequate accounting records and are responsible for the content and integrity of the annual financial statements and related financial information included in this report. It is their responsibility to ensure that the annual financial statements fairly present the state of affairs of the company as at the end of the financial year and the results of its operations and cash flows for the period then ended, in conformity with {basis}.
            </p>
            <p style={styles.paragraph}>
              The annual financial statements are prepared in accordance with {basis} and are based upon appropriate accounting policies consistently applied and supported by reasonable and prudent judgements and estimates.
            </p>
            <p style={styles.paragraph}>
              The {directorTitle} acknowledge that they are ultimately responsible for the system of internal financial control established by the company and place considerable importance on maintaining a strong control environment. Internal controls are aimed at reducing the risk of error or loss in a cost-effective manner and include the proper delegation of responsibilities, effective accounting procedures, adequate segregation of duties and ongoing monitoring.
            </p>
            <p style={styles.paragraph}>
              The focus of risk management in the company is on identifying, assessing, managing and monitoring all known forms of risk across the company. While operating risk cannot be fully eliminated, the company endeavours to minimise it by ensuring that appropriate infrastructure, controls, systems and ethical behaviour are applied and managed within predetermined procedures and constraints.
            </p>
            <p style={styles.paragraph}>
              The {directorTitle} are of the opinion, based on the information and explanations given by management, that the system of internal control provides reasonable assurance that the financial records may be relied on for the preparation of the annual financial statements. However, any system of internal financial control can provide only reasonable, and not absolute, assurance against material misstatement or loss.
            </p>
            <p style={styles.paragraph}>
              The {directorTitle} have reviewed the company’s cash flow forecast for the period after year end and, in light of this review and the current financial position, are satisfied that the company has or had access to adequate resources to continue in operational existence for the foreseeable future.
            </p>
            <p style={styles.paragraph}>
              The independent compiler is responsible for compiling and reporting on the company’s annual financial statements. The compiler’s report is presented in this set of annual financial statements.
            </p>
            <p style={styles.paragraph}>
              The annual financial statements, prepared on the going concern basis, were approved by the {directorTitle} on {formatDateLong(approvalDate)} and signed on their behalf by:
            </p>
            <SignatureBlock place={signaturePlace} date={approvalDate} directors={directors} />
          </AfsPage>
        ) : null}

        {options.directorsReport ? (
          <AfsPage id="afs-directors-report" title="Directors' Report" pageNo="4"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
            <p style={styles.paragraph}>
              The {directorTitle} have pleasure in submitting their report together with the annual financial statements for the year ended {formatDateLong(yearEnd)}.
            </p>

            {directorReportItems.map((item) => {
              const optionKey = directorReportOptionKey(item.key);
              const enabled = optionKey ? Boolean(options[optionKey]) : true;
              const number = enabled ? nextDirectorReportNumber(directorReportItems, item.key, options) : 0;

              return (
                <div key={item.key} className={enabled ? "reportSectionBlock" : "afs-print-hide reportSectionBlock"} style={enabled ? styles.reportBlock : styles.reportBlockOff}>
                  <DirectorReportInlineHeading
                    number={number}
                    title={item.title}
                    optionKey={optionKey}
                    options={options}
                    savingReportOptionKey={savingReportOptionKey}
                    onReportOptionChange={onReportOptionChange}
                  />
                  {enabled ? item.content : <p style={styles.disabledSectionNote}>Section switched off. Turn it on to include and edit this disclosure.</p>}
                </div>
              );
            })}
          </AfsPage>
        ) : null}

        {options.compilationReport ? (
          <AfsPage
            id="afs-compilation-report"
            title="Practitioner's Compilation Report"
            pageNo="6"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
            hideEntityHeader
            hidePageTitle
          >
            <div className="afs-compilation-report" style={styles.compilationReportBody}>
            <div className="afs-compilation-letterhead-top" style={styles.compilationLetterheadTop}>
              <img
                src="/bizzacc/Top.png"
                alt="Bizzacc letterhead"
                style={styles.compilationHeaderImage}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </div>
            <h3 style={styles.reportTitle}>Practitioner's Compilation Report</h3>
            <p style={styles.paragraph}>To the directors of {clientName}</p>

            <p style={styles.paragraph}>
              We have compiled the annual financial statements of {clientName} set out in this report, based on information provided by management.
            </p>

            <p style={styles.paragraph}>
              These annual financial statements comprise the statement of financial position as at {formatDateLong(yearEnd)}, the statement of profit or loss and other comprehensive income, the statement of changes in equity and the statement of cash flows for the year then ended, and the notes to the annual financial statements, including material accounting policy information.
            </p>

            <h4 style={styles.reportHeading}>Management's responsibility for the annual financial statements</h4>
            <p style={styles.paragraph}>
              Management is responsible for the preparation and fair presentation of these annual financial statements in accordance with {basis}, and for such internal control as management determines is necessary to enable the preparation of annual financial statements that are free from material misstatement, whether due to fraud or error.
            </p>
            <p style={styles.paragraph}>
              Management is also responsible for the accuracy and completeness of the accounting records, documents, explanations and other information provided to us for the purpose of compiling these annual financial statements.
            </p>

            <h4 style={styles.reportHeading}>Practitioner's responsibility</h4>
            <p style={styles.paragraph}>
              Our responsibility is to compile the annual financial statements based on information provided by management. We performed this compilation engagement in accordance with International Standard on Related Services 4410 (Revised), Compilation Engagements.
            </p>
            <p style={styles.paragraph}>
              A compilation engagement involves applying accounting and financial reporting expertise to assist management in the preparation and presentation of financial information. A compilation engagement does not involve performing procedures designed to verify the accuracy or completeness of the information provided by management.
            </p>

            <h4 style={styles.reportHeading}>No assurance</h4>
            <p style={styles.paragraph}>
              Since a compilation engagement is not an assurance engagement, we are not required to verify the accuracy or completeness of the information provided to us and we do not gather evidence to express an audit opinion or a review conclusion.
            </p>
            <p style={styles.paragraph}>
              Accordingly, we do not express an audit opinion, a review conclusion or any other form of assurance on these annual financial statements.
            </p>

            <SignatureBlock place={signaturePlace} date={issueDate} practitioner={clientSetup} />
            <div className="afs-compilation-letterhead-bottom" style={styles.compilationLetterheadBottom}>
              <img
                src="/bizzacc/Bottom.png"
                alt="Bizzacc footer"
                style={styles.compilationFooterImage}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </div>
            </div>
          </AfsPage>
        ) : null}

        <AfsPage id="afs-sfp" title="Statement of Financial Position" pageNo="7"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
          <EquityReconciliationWarning reconciliation={equityReconciliation} />
          <StatementModeToolbar mode={sfpDisplayMode} onChange={setSfpDisplayMode} />
          <StatementTable
            sections={sfpDisplayMode === "edit" ? buildSfpAllMode(sfp) : sfp}
            currentHeading={currentHeading}
            priorHeading={priorHeading}
            showNotes
          />
        </AfsPage>

        <span id="afs-spl" className="afs-screen-anchor" />
        <AfsPage id="afs-sci" title="Statement of Comprehensive Income" pageNo="8"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
          <StatementOfComprehensiveIncomeTable
            lines={spl}
            currentHeading={currentHeading}
            priorHeading={priorHeading}
            showNotes
          />
        </AfsPage>

        {options.statementOfChangesInEquity ? (
          <AfsPage id="afs-socie" title="Statement of Changes in Equity" pageNo="9"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
            <StatementOfChangesInEquityTable
              reconciliation={equityReconciliation}
              disclosureTextOverrides={disclosureTextOverrides}
              savingDisclosureTextKey={savingDisclosureTextKey}
              onDisclosureTextChange={onDisclosureTextChange}
              onDisclosureTextSave={onDisclosureTextSave}
            />
          </AfsPage>
        ) : null}

        {options.cashFlowStatement ? (
          <AfsPage id="afs-cash-flow" title="Statement of Cash Flows" pageNo="10"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
            <CashFlowStatement
              profitCurrent={profitCurrent}
              profitPrior={profitPrior}
              sfp={sfp}
              cashNoteNumber={findLineByKey(sfp, "cash-and-cash-equivalents")?.noteNumber}
              cashUsedNoteNumber={noteNumbering.cashUsedInOperationsNoteNumber}
              disclosureTextOverrides={disclosureTextOverrides}
              savingDisclosureTextKey={savingDisclosureTextKey}
              onDisclosureTextChange={onDisclosureTextChange}
              onDisclosureTextSave={onDisclosureTextSave}
            />
          </AfsPage>
        ) : null}

        {options.accountingPolicies ? (
          <AfsPage id="afs-accounting-policies" title="Accounting Policies" pageNo="11"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
            <AccountingPolicies
              basis={basis}
              disclosureTextOverrides={disclosureTextOverrides}
              savingDisclosureTextKey={savingDisclosureTextKey}
              onDisclosureTextChange={onDisclosureTextChange}
              onDisclosureTextSave={onDisclosureTextSave}
              onDisclosureTextReset={onDisclosureTextReset}
              reportOptions={options}
              onReportOptionChange={onReportOptionChange}
              savingReportOptionKey={savingReportOptionKey}
            />
          </AfsPage>
        ) : null}

        {options.notes ? (
          <AfsPage id="afs-notes" title="Notes to the Annual Financial Statements" pageNo="12"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
            <NoteTable
              currentHeading={currentHeading}
              priorHeading={priorHeading}
              sfp={sfp}
              spl={spl}
              trialBalanceLines={trialBalanceLines}
              clientSetup={clientSetup}
              disclosureTextOverrides={disclosureTextOverrides}
              savingDisclosureTextKey={savingDisclosureTextKey}
              onDisclosureTextChange={onDisclosureTextChange}
              onDisclosureTextSave={onDisclosureTextSave}
              onDisclosureTextReset={onDisclosureTextReset}
              reportOptions={options}
              onReportOptionChange={onReportOptionChange}
              savingReportOptionKey={savingReportOptionKey}
              noteKeyToNumber={noteNumbering.noteKeyToNumber}
              cashUsedInOperationsNoteNumber={noteNumbering.cashUsedInOperationsNoteNumber}
            />
          </AfsPage>
        ) : null}

        {options.detailedIncomeStatement ? (
          <>
          <span id="afs-detailed-income-statement" className="afs-screen-anchor" />
          <AfsPage id="afs-detailed-income" title="Detailed Income Statement" pageNo="16"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
            <DetailedIncomeStatementTable
              trialBalanceLines={trialBalanceLines}
              currentHeading={currentHeading}
              priorHeading={priorHeading}
            />
          </AfsPage>
          </>
        ) : null}

        {options.taxComputation ? (
          <>
          <span id="afs-tax" className="afs-screen-anchor" />
          <AfsPage id="afs-tax-computation" title="Tax Computation" pageNo="17"
            clientName={clientName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
          >
            <TaxComputationTable
              currentHeading={currentHeading}
              priorHeading={priorHeading}
              profitCurrent={profitBeforeTaxForTax.current}
              profitPrior={profitBeforeTaxForTax.prior}
              incomeStatementTaxCurrent={taxationForTax.current}
              incomeStatementTaxPrior={taxationForTax.prior}
              clientSetup={clientSetup}
              disclosureTextOverrides={disclosureTextOverrides}
              savingDisclosureTextKey={savingDisclosureTextKey}
              onDisclosureTextChange={onDisclosureTextChange}
              onDisclosureTextSave={onDisclosureTextSave}
            />
          </AfsPage>
          </>
        ) : null}
        </div>

      </div>
    </div>
  );
}


function withAllDirectorReportOptions(options: ReportOptions): ReportOptions {
  return {
    ...options,
    directorsReportGeneralReview: true,
    directorsReportIncorporation: true,
    directorsReportNatureBusiness: true,
    directorsReportReviewActivities: true,
    directorsReportFinancialResults: true,
    directorsReportEventsAfter: true,
    directorsReportDividends: true,
    directorsReportShareCapital: true,
    directorsReportDirectors: true,
    directorsReportSecretary: false,
    directorsReportExternalAccountant: true,
    directorsReportInterestContracts: true,
    directorsReportBorrowingLimitations: false,
    directorsReportShareholder: true,
    directorsReportGoingConcern: true,
    directorsReportLiquiditySolvency: true,
    directorsReportLitigation: false,
    directorsReportSocialEthics: false,
    directorsReportSubsidiaries: true,
    directorsReportAssociates: true,
    directorsReportJointVentures: true,
    directorsReportNonCurrentAssets: true,
    directorsReportAuthorisation: true,
    directorsReportOther1: false,
    directorsReportOther2: true,
    directorsReportOther3: true,
    directorsReportOther4: true,
    directorsReportOther5: true,
    directorsReportOther6: true,
    directorsReportOther7: true,
    directorsReportOther8: true,
    directorsReportOther9: true,
    directorsReportOther10: true,
  };
}

function nextDirectorReportNumber(
  items: { key: string; title: string; content: ReactNode }[],
  itemKey: string,
  options: ReportOptions
): number {
  let number = 0;

  for (const item of items) {
    const optionKey = directorReportOptionKey(item.key);
    const enabled = optionKey ? Boolean(options[optionKey]) : true;
    if (enabled) number += 1;
    if (item.key === itemKey) return number;
  }

  return number;
}

function directorReportOptionKey(itemKey: string): keyof ReportOptions | null {
  const map: Record<string, keyof ReportOptions> = {
    incorporation: "directorsReportIncorporation",
    "nature-of-business": "directorsReportNatureBusiness",
    "review-of-results": "directorsReportReviewActivities",
    "financial-results": "directorsReportFinancialResults",
    "events-after": "directorsReportEventsAfter",
    "interest-in-contracts": "directorsReportInterestContracts",
    "share-capital": "directorsReportShareCapital",
    "borrowing-limitations": "directorsReportBorrowingLimitations",
    dividends: "directorsReportDividends",
    directors: "directorsReportDirectors",
    "social-ethics": "directorsReportSocialEthics",
    secretary: "directorsReportSecretary",
    shareholder: "directorsReportShareholder",
    subsidiaries: "directorsReportSubsidiaries",
    associates: "directorsReportAssociates",
    "joint-ventures": "directorsReportJointVentures",
    "non-current-assets": "directorsReportNonCurrentAssets",
    "going-concern": "directorsReportGoingConcern",
    "liquidity-solvency": "directorsReportLiquiditySolvency",
    litigation: "directorsReportLitigation",
    "external-accountant": "directorsReportExternalAccountant",
    authorisation: "directorsReportAuthorisation",
  };

  if (itemKey.startsWith("other-")) {
    const index = Number(itemKey.replace("other-", ""));
    if (index >= 1 && index <= 10) {
      return `directorsReportOther${index}` as keyof ReportOptions;
    }
  }

  return map[itemKey] || null;
}

function DirectorReportInlineHeading({
  number,
  title,
  optionKey,
  options,
  savingReportOptionKey,
  onReportOptionChange,
}: {
  number: number;
  title: string;
  optionKey: keyof ReportOptions | null;
  options: ReportOptions;
  savingReportOptionKey?: keyof ReportOptions | null;
  onReportOptionChange?: (key: keyof ReportOptions, value: boolean) => void | Promise<void>;
}) {
  const enabled = optionKey ? Boolean(options[optionKey]) : true;
  const saving = Boolean(optionKey && savingReportOptionKey === optionKey);

  return (
    <div style={enabled ? styles.drInlineHeading : styles.drInlineHeadingOff}>
      <h4 style={enabled ? styles.reportHeading : styles.reportHeadingOff}>
        {enabled ? `${number}. ` : ""}{title}
      </h4>
      {optionKey && onReportOptionChange ? (
        <button
          type="button"
          style={enabled ? styles.drToggleOn : styles.drToggleOff}
          onClick={() => onReportOptionChange(optionKey, !enabled)}
          disabled={saving}
        >
          {saving ? "Saving" : enabled ? "On" : "Off"}
        </button>
      ) : null}
    </div>
  );
}

function buildDirectorsReportItems({
  reportOptions,
  clientName,
  yearEnd,
  basis,
  clientSetup,
  directors,
  directorTitle,
  approvalDate,
  currentHeading,
  priorHeading,
  shareCapitalTotal,
  disclosureTextOverrides,
  savingDisclosureTextKey,
  onDisclosureTextChange,
  onDisclosureTextSave,
  onDisclosureTextReset,
}: {
  reportOptions: ReportOptions;
  clientName: string;
  yearEnd: string;
  basis: string;
  clientSetup?: ClientSetup | null;
  directors: ClientPerson[];
  directorTitle: string;
  approvalDate: string;
  currentHeading: string;
  priorHeading: string;
  shareCapitalTotal: { current: number; prior: number };
  disclosureTextOverrides: Record<string, string>;
  savingDisclosureTextKey?: string;
  onDisclosureTextChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onDisclosureTextSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
  onDisclosureTextReset?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string
  ) => void | Promise<void>;
}) {
  const items: { key: string; title: string; content: ReactNode }[] = [];
  const business = clean(clientSetup?.nature_of_business) || "the activities disclosed in the general information section";
  const shareholderText = clean(clientSetup?.shareholder_note) || "There have been no changes in ownership during the current financial year.";
  const authorisedShares = clean(clientSetup?.authorised_ordinary_shares);
  const authorisedParValue = clean(clientSetup?.authorised_ordinary_share_par_value);
  const issuedShares = clean(clientSetup?.issued_ordinary_shares);
  const issuedParValue = clean(clientSetup?.issued_ordinary_share_par_value);
  const defaultShareCapitalText = clean(clientSetup?.share_capital_note) ||
    "There were no changes in the authorised or issued share capital of the company during the year under review.";
  const shareCapitalText = getDisclosureTextOverride(
    disclosureTextOverrides,
    "share-capital",
    defaultShareCapitalText
  );
  const financialResultsText = getDisclosureTextOverride(
    disclosureTextOverrides,
    "financial-results",
    "The financial results and position of the company are fully set out in the attached annual financial statements and do not require further comment."
  );
  const eventsAfterText = getDisclosureTextOverride(
    disclosureTextOverrides,
    "events-after-reporting-period",
    `The ${directorTitle} are not aware of any material fact or circumstance which occurred between the reporting date and the date of this report that requires disclosure or adjustment in the annual financial statements.`
  );
  const dividendsText = getDisclosureTextOverride(
    disclosureTextOverrides,
    "dividends",
    "No dividends were declared or proposed during the year under review."
  );
  const shareholderDisclosureText = getDisclosureTextOverride(
    disclosureTextOverrides,
    "shareholder",
    shareholderText
  );
  const borrowingLimitationsText = getDisclosureTextOverride(
    disclosureTextOverrides,
    "borrowing-limitations",
    `In terms of the Memorandum of Incorporation of the company, the ${directorTitle} may exercise all the powers of the company to borrow money, as considered appropriate.`
  );
  const goingConcernText = getDisclosureTextOverride(
    disclosureTextOverrides,
    "going-concern",
    [
      "The annual financial statements have been prepared on the basis of accounting policies applicable to a going concern. This basis presumes that funds will be available to finance future operations and that the realisation of assets and settlement of liabilities, contingent obligations and commitments will occur in the ordinary course of business.",
      `The ${directorTitle} believe that the company has adequate financial resources to continue in operation for the foreseeable future and accordingly the annual financial statements have been prepared on the going concern basis. The ${directorTitle} are satisfied that the company is in a sound financial position and that it has access to sufficient borrowing facilities to meet its foreseeable cash requirements.`,
      `The ${directorTitle} are not aware of any material non-compliance with statutory or regulatory requirements or of any pending changes to legislation which may affect the company.`,
    ].join("\n\n")
  );
  const liquiditySolvencyText = getDisclosureTextOverride(
    disclosureTextOverrides,
    "liquidity-solvency",
    `The ${directorTitle} have performed the required liquidity and solvency tests required by the Companies Act of South Africa and are satisfied that the company satisfies the solvency and liquidity requirements, where applicable.`
  );
  const litigationText = getDisclosureTextOverride(
    disclosureTextOverrides,
    "litigation-statement",
    `The ${directorTitle} are not aware of any legal or arbitration proceedings, including proceedings that are pending or threatened, which may have a material effect on the company’s financial position.`
  );

  function editableText(disclosureKey: string, text: string) {
    return (
      <EditableDisclosureText
        pageKey="directors-report"
        sectionKey="directors-report"
        disclosureKey={disclosureKey}
        text={text}
        saving={
          savingDisclosureTextKey ===
          `directors-report::directors-report::${disclosureKey}`
        }
        onChange={onDisclosureTextChange}
        onSave={onDisclosureTextSave}
        onReset={onDisclosureTextReset}
      />
    );
  }

  function editableOtherText(
    disclosureKey: string,
    title: string,
    body: string,
    index: number
  ) {
    return (
      <EditableOtherDisclosureText
        pageKey="directors-report"
        sectionKey="directors-report"
        disclosureKey={disclosureKey}
        title={title}
        body={body}
        fallbackTitle={`Other disclosure ${index}`}
        saving={
          savingDisclosureTextKey ===
          `directors-report::directors-report::${disclosureKey}`
        }
        onChange={onDisclosureTextChange}
        onSave={onDisclosureTextSave}
        onReset={onDisclosureTextReset}
      />
    );
  }

  items.push({
    key: "incorporation",
    title: "Incorporation",
    content: (
      <p style={styles.paragraph}>
        {clientName} was incorporated in South Africa and obtained its certificate to commence business on the date captured in the client setup records.
      </p>
    ),
  });

  items.push({
    key: "nature-of-business",
    title: "Nature of business",
    content: (
      <p style={styles.paragraph}>
        {clientName} is incorporated in South Africa with interests in {business}. The company operates in South Africa.
      </p>
    ),
  });

  items.push({
    key: "review-of-results",
    title: "Review of financial results and activities",
    content: (
      <p style={styles.paragraph}>
        The annual financial statements have been prepared in accordance with {basis} and the requirements of the Companies Act of South Africa. The accounting policies have been applied consistently compared to the prior year. Full details of the financial position, results of operations and cash flows of the company are set out in these annual financial statements.
      </p>
    ),
  });

  if (reportOptions.directorsReportFinancialResults) {
    items.push({
      key: "financial-results",
      title: "Financial results",
      content: editableText("financial-results", financialResultsText),
    });
  }

  if (reportOptions.directorsReportEventsAfter) {
    items.push({
      key: "events-after",
      title: "Events after the reporting period",
      content: editableText("events-after-reporting-period", eventsAfterText),
    });
  }

  if (reportOptions.directorsReportInterestContracts) {
    items.push({
      key: "interest-in-contracts",
      title: "Directors' interest in contracts",
      content: (
        <p style={styles.paragraph}>
          To the knowledge of the {directorTitle}, no director had any material interest in contracts entered into by the company during the year under review, other than those disclosed in these annual financial statements.
        </p>
      ),
    });
  }

  if (reportOptions.directorsReportShareCapital) {
    items.push({
      key: "share-capital",
      title: "Authorised and issued share capital",
      content: (
        <>
          {editableText("share-capital", shareCapitalText)}
          <table style={styles.smallTable}>
            <thead>
              <tr>
                <th style={styles.thSmall}>Description</th>
                <th style={styles.thSmallRight}>Number of shares</th>
                <th style={styles.thSmallRight}>Par value</th>
                <th style={styles.thSmallRight}>{currentHeading}</th>
                <th style={styles.thSmallRight}>{priorHeading}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.tdSmall}>Authorised ordinary shares</td>
                <td style={styles.tdSmallRight}>{authorisedShares || "To be captured"}</td>
                <td style={styles.tdSmallRight}>{authorisedParValue || ""}</td>
                <td style={styles.tdSmallRight}>{calculateShareAmount(authorisedShares, authorisedParValue)}</td>
                <td style={styles.tdSmallRight}>{calculateShareAmount(authorisedShares, authorisedParValue)}</td>
              </tr>
              <tr>
                <td style={styles.tdSmall}>Issued ordinary shares</td>
                <td style={styles.tdSmallRight}>{issuedShares || "To be captured"}</td>
                <td style={styles.tdSmallRight}>{issuedParValue || ""}</td>
                <td style={styles.tdSmallRight}>{formatAmount(shareCapitalTotal.current)}</td>
                <td style={styles.tdSmallRight}>{formatAmount(shareCapitalTotal.prior)}</td>
              </tr>
            </tbody>
          </table>
        </>
      ),
    });
  }

  if (reportOptions.directorsReportBorrowingLimitations) {
    items.push({
      key: "borrowing-limitations",
      title: "Borrowing limitations",
      content: editableText("borrowing-limitations", borrowingLimitationsText),
    });
  }

  if (reportOptions.directorsReportDividends) {
    items.push({
      key: "dividends",
      title: "Dividends",
      content: editableText("dividends", dividendsText),
    });
  }

  if (reportOptions.directorsReportDirectors) {
    items.push({
      key: "directors",
      title: "Directors",
      content: (
        <>
          <p style={styles.paragraph}>The directors in office during the accounting period and up to the date of this report were as follows:</p>
          <table style={styles.smallTable}>
            <thead>
              <tr>
                <th style={styles.thSmall}>Director</th>
                <th style={styles.thSmall}>Office</th>
                <th style={styles.thSmall}>Designation</th>
                <th style={styles.thSmall}>Nationality</th>
              </tr>
            </thead>
            <tbody>
              {directors.length === 0 ? (
                <tr><td style={styles.tdSmall} colSpan={4}>No directors / members / trustees captured.</td></tr>
              ) : (
                directors.map((person) => (
                  <tr key={person.id}>
                    <td style={styles.tdSmall}>{person.full_name}</td>
                    <td style={styles.tdSmall}>{person.resignation_date ? "Resigned" : "Current"}</td>
                    <td style={styles.tdSmall}>{person.person_type}</td>
                    <td style={styles.tdSmall}>{clean(person.nationality) || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      ),
    });
  }

  if (reportOptions.directorsReportSocialEthics) {
    items.push({
      key: "social-ethics",
      title: "Social and ethics committee",
      content: (
        <p style={styles.paragraph}>
          In line with the requirements of the Companies Act of South Africa, the company has considered the requirements relating to a social and ethics committee. Details of the committee or exemption should be captured where applicable.
        </p>
      ),
    });
  }

  if (reportOptions.directorsReportSecretary) {
    items.push({
      key: "secretary",
      title: "Secretary",
      content: <p style={styles.paragraph}>{clean(clientSetup?.secretary_name) || "No company secretary was captured for this engagement."}</p>,
    });
  }

  if (reportOptions.directorsReportShareholder) {
    items.push({
      key: "shareholder",
      title: "Shareholder",
      content: editableText("shareholder", shareholderDisclosureText),
    });
  }

  if (reportOptions.directorsReportSubsidiaries) {
    items.push({
      key: "subsidiaries",
      title: "Interest in subsidiaries",
      content: <p style={styles.paragraph}>{clean(clientSetup?.subsidiaries_note) || "No interests in subsidiaries were captured for this engagement."}</p>,
    });
  }

  if (reportOptions.directorsReportAssociates) {
    items.push({
      key: "associates",
      title: "Interest in associates",
      content: <p style={styles.paragraph}>{clean(clientSetup?.associates_note) || "No interests in associates were captured for this engagement."}</p>,
    });
  }

  if (reportOptions.directorsReportJointVentures) {
    items.push({
      key: "joint-ventures",
      title: "Interest in joint ventures",
      content: <p style={styles.paragraph}>{clean(clientSetup?.joint_ventures_note) || "No interests in joint ventures were captured for this engagement."}</p>,
    });
  }

  if (reportOptions.directorsReportNonCurrentAssets) {
    items.push({
      key: "non-current-assets",
      title: "Non-current assets",
      content: <p style={styles.paragraph}>{clean(clientSetup?.non_current_assets_note) || "Details of additions, disposals and other movements in non-current assets are disclosed in the notes to the annual financial statements where applicable."}</p>,
    });
  }

  if (reportOptions.directorsReportGoingConcern) {
    items.push({
      key: "going-concern",
      title: "Going concern",
      content: editableText("going-concern", goingConcernText),
    });
  }

  if (reportOptions.directorsReportLiquiditySolvency) {
    items.push({
      key: "liquidity-solvency",
      title: "Liquidity and solvency",
      content: editableText("liquidity-solvency", liquiditySolvencyText),
    });
  }

  if (reportOptions.directorsReportLitigation) {
    items.push({
      key: "litigation",
      title: "Litigation statement",
      content: editableText("litigation-statement", litigationText),
    });
  }

  if (reportOptions.directorsReportExternalAccountant) {
    items.push({
      key: "external-accountant",
      title: "External accountant",
      content: <p style={styles.paragraph}>{clean(clientSetup?.practice_name) || "The firm"} will continue in office in accordance with the Companies Act of South Africa.</p>,
    });
  }

  if (reportOptions.directorsReportAuthorisation) {
    items.push({
      key: "authorisation",
      title: "Authorisation for issue of financial statements",
      content: <p style={styles.paragraph}>The annual financial statements set out in this report were authorised for issue by the {directorTitle} on {formatDateLong(approvalDate)}.</p>,
    });
  }


  for (let index = 1; index <= 10; index += 1) {
    const optionKey = `directorsReportOther${index}` as keyof ReportOptions;
    if (!reportOptions[optionKey]) continue;

    const disclosureKey = `other-${index}`;
    const defaultOtherText = `Other disclosure ${index}
Add custom wording here.`;
    const otherText = getDisclosureTextOverride(
      disclosureTextOverrides,
      disclosureKey,
      defaultOtherText
    );
    const parsed = parseOtherDisclosureText(otherText, index);

    items.push({
      key: disclosureKey,
      title: parsed.title,
      content: editableOtherText(disclosureKey, parsed.title, parsed.body, index),
    });
  }

  return items;
}

function parseOtherDisclosureText(text: string, index: number) {
  const parts = String(text || "")
    .split(/\r?\n/)
    .map((part) => part.trim());

  const title = parts.find(Boolean) || `Other disclosure ${index}`;
  const body = parts.slice(1).join("\n").trim();

  return {
    title,
    body,
  };
}
function DisclosureText({ text }: { text: string }) {
  const paragraphs = splitParagraphs(text);

  if (paragraphs.length === 0) return null;

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 16)}-${index}`} style={styles.paragraph}>
          {paragraph}
        </p>
      ))}
    </>
  );
}

function normaliseEditorText(value: string) {
  return String(value || "").replace(/\u00A0/g, " ");
}

function insertEditorSpaceAtCursor(
  event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  value: string,
  onValueChange: (nextValue: string) => void
) {
  event.preventDefault();
  event.stopPropagation();

  const field = event.currentTarget;
  const start = field.selectionStart ?? value.length;
  const end = field.selectionEnd ?? start;
  const nextValue = `${value.slice(0, start)} ${value.slice(end)}`;
  const nextCursor = start + 1;

  onValueChange(nextValue);

  window.requestAnimationFrame(() => {
    field.selectionStart = nextCursor;
    field.selectionEnd = nextCursor;
  });
}

function handleEditorKeyDown(
  event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  value: string,
  onValueChange: (nextValue: string) => void
) {
  void value;
  void onValueChange;
  event.stopPropagation();
}

function stopEditorKeyboardShortcuts(
  event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
) {
  event.stopPropagation();
}

function EditableDisclosureText({
  pageKey,
  sectionKey,
  disclosureKey,
  text,
  saving,
  onChange,
  onSave,
  onReset,
}: {
  pageKey: string;
  sectionKey: string;
  disclosureKey: string;
  text: string;
  saving?: boolean;
  onChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
  onReset?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string
  ) => void | Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const editable = Boolean(onChange && onSave);
  const paragraphs = splitParagraphs(draftText || text);

  function startEditing() {
    setDraftText(text);
    setIsEditing(true);
  }

  async function save() {
    const normalised = normaliseEditorText(draftText);
    onChange?.(pageKey, sectionKey, disclosureKey, normalised);
    await onSave?.(pageKey, sectionKey, disclosureKey, normalised);
    setIsEditing(false);
  }

  async function reset() {
    await onReset?.(pageKey, sectionKey, disclosureKey);
    setDraftText(text);
    setIsEditing(false);
  }

  if (!editable) {
    return <DisclosureText text={text} />;
  }

  if (isEditing) {
    return (
      <div style={styles.inlineEditorBox}>
        <textarea
          value={draftText}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setDraftText(event.target.value)}
          onKeyDown={stopEditorKeyboardShortcuts}
          rows={Math.max(4, paragraphs.length + 2)}
          style={styles.inlineEditorTextarea}
        />
        <div style={styles.inlineEditorActions}>
          <button
            type="button"
            style={saving ? styles.inlineEditorButtonDisabled : styles.inlineEditorButton}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save wording"}
          </button>
          <button
            type="button"
            style={styles.inlineEditorSecondaryButton}
            onClick={() => {
              setDraftText(text);
              setIsEditing(false);
            }}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            style={styles.inlineEditorResetButton}
            onClick={reset}
            disabled={saving}
          >
            Reset to default
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.inlineEditableText}>
      <div className="afs-screen-only" style={styles.inlineEditableToolbar}>
        <span style={styles.inlineEditableLabel}>Editable wording</span>
        <button
          type="button"
          style={styles.inlineEditButton}
          onClick={startEditing}
          title="Edit wording"
        >
          Edit wording
        </button>
      </div>
      <div style={styles.inlineEditableBody}>
        <DisclosureText text={text} />
      </div>
    </div>
  );
}

function EditableOtherDisclosureText({
  pageKey,
  sectionKey,
  disclosureKey,
  title,
  body,
  fallbackTitle,
  saving,
  onChange,
  onSave,
  onReset,
}: {
  pageKey: string;
  sectionKey: string;
  disclosureKey: string;
  title: string;
  body: string;
  fallbackTitle: string;
  saving?: boolean;
  onChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
  onReset?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string
  ) => void | Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(clean(title) || fallbackTitle);
  const [draftBody, setDraftBody] = useState(body || "");
  const editable = Boolean(onChange && onSave);
  const displayTitle = clean(title) || fallbackTitle;
  const displayBody = clean(body) || "Add custom wording here.";

  function startEditing() {
    setDraftTitle(displayTitle);
    setDraftBody(clean(body) || "");
    setIsEditing(true);
  }

  function combinedValue(nextTitle: string, nextBody: string) {
    return `${normaliseEditorText(nextTitle || fallbackTitle)}\n${normaliseEditorText(nextBody)}`;
  }

  async function save() {
    const nextValue = combinedValue(draftTitle, draftBody);
    onChange?.(pageKey, sectionKey, disclosureKey, nextValue);
    await onSave?.(pageKey, sectionKey, disclosureKey, nextValue);
    setIsEditing(false);
  }

  async function reset() {
    await onReset?.(pageKey, sectionKey, disclosureKey);
    setDraftTitle(fallbackTitle);
    setDraftBody("");
    setIsEditing(false);
  }

  if (!editable) {
    return <DisclosureText text={displayBody} />;
  }

  if (isEditing) {
    return (
      <div style={styles.inlineEditorBox}>
        <label style={styles.inlineEditorLabel}>
          Heading
          <input
            value={draftTitle}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setDraftTitle(event.target.value)}
            style={styles.inlineEditorInput}
          />
        </label>

        <label style={styles.inlineEditorLabel}>
          Wording
          <textarea
            value={draftBody}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setDraftBody(event.target.value)}
            rows={5}
            placeholder="Add custom wording here."
            style={styles.inlineEditorTextarea}
          />
        </label>

        <div style={styles.inlineEditorActions}>
          <button
            type="button"
            style={saving ? styles.inlineEditorButtonDisabled : styles.inlineEditorButton}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save section"}
          </button>
          <button
            type="button"
            style={styles.inlineEditorSecondaryButton}
            onClick={() => {
              setDraftTitle(displayTitle);
              setDraftBody(body || "");
              setIsEditing(false);
            }}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            style={styles.inlineEditorResetButton}
            onClick={reset}
            disabled={saving}
          >
            Reset to default
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.inlineEditableText}>
      <div style={styles.inlineEditableToolbar}>
        <span style={styles.inlineEditableLabel}>Custom disclosure</span>
        <button
          type="button"
          style={styles.inlineEditButton}
          onClick={startEditing}
          title="Edit custom section"
        >
          Edit section
        </button>
      </div>
      <div style={styles.inlineEditableBody}>
        <DisclosureText text={displayBody} />
      </div>
    </div>
  );
}

function AfsPage({
  id,
  title,
  pageNo,
  children,
  clientName,
  registrationNumber,
  yearEnd,
  hideEntityHeader = false,
  hidePageTitle = false,
}: {
  id?: string;
  title?: string;
  pageNo: string;
  children: ReactNode;
  clientName?: string;
  registrationNumber?: string;
  yearEnd?: string;
  hideEntityHeader?: boolean;
  hidePageTitle?: boolean;
}) {
  const isCover = id === "afs-cover";

  return (
    <section id={id} className={`afs-print-page ${id || ""}`} style={styles.afsPage}>
      <div className="afs-draft-watermark">DRAFT</div>

      {!isCover && !hideEntityHeader ? (
        <div className="afsPageEntityHeader" style={styles.afsPageEntityHeader}>
          <h1 style={styles.afsPageEntityName}>{clientName}</h1>
          {registrationNumber ? (
            <p style={styles.afsPageEntityLine}>(Registration number: {registrationNumber})</p>
          ) : null}
          <p style={styles.afsPageEntityLine}>Financial Statements for the year ended {formatDateLong(yearEnd || "")}</p>
        </div>
      ) : null}

      {title && !hidePageTitle ? <h2 style={styles.pageTitle}>{title}</h2> : null}
      <div className="afs-page-content" style={styles.pageContent}>{children}</div>
      {!isCover ? <div className="afs-page-footer" style={styles.pageFooter}>{pageNo}</div> : null}
    </section>
  );
}

type EquityReconciliation = {
  openingShareCapitalPrior: number;
  closingShareCapitalPrior: number;
  openingShareCapitalCurrent: number;
  closingShareCapitalCurrent: number;
  openingRetainedIncomePrior: number;
  profitOrLossPrior: number;
  otherComprehensiveIncomePrior: number;
  dividendsPrior: number;
  otherRetainedMovementPrior: number;
  closingRetainedIncomePrior: number;
  openingRetainedIncomeCurrent: number;
  profitOrLossCurrent: number;
  otherComprehensiveIncomeCurrent: number;
  dividendsCurrent: number;
  otherRetainedMovementCurrent: number;
  closingRetainedIncomeCurrent: number;
  mappedRetainedIncomeCurrent: number;
  mappedRetainedIncomePrior: number;
  retainedIncomeOpeningControl: number;
  retainedIncomeClosingControl: number;
  retainedIncomeOpeningCheckDifference: number;
  retainedIncomeClosingCheckDifference: number;
  closingEquityCurrent: number;
  closingEquityPrior: number;
  hasOpeningCheckDifference: boolean;
  hasClosingCheckDifference: boolean;
};

type SocieManualMovements = {
  priorDividends: number;
  currentDividends: number;
  priorIssueShares: number;
  currentIssueShares: number;
  priorOtherRetainedMovement: number;
  currentOtherRetainedMovement: number;
};

function parseSocieNumber(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const isBracketNegative = raw.startsWith("(") && raw.endsWith(")");
  const cleaned = raw
    .replace(/[R\s]/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/,/g, ".");

  const numberValue = Number(cleaned);
  if (!Number.isFinite(numberValue)) return 0;

  return isBracketNegative ? -Math.abs(numberValue) : numberValue;
}

function getSocieManualMovements(
  disclosureTextOverrides: Record<string, string>
): SocieManualMovements {
  return {
    priorDividends: parseSocieNumber(
      getDisclosureTextOverride(disclosureTextOverrides, "socie-prior-dividends", "0")
    ),
    currentDividends: parseSocieNumber(
      getDisclosureTextOverride(disclosureTextOverrides, "socie-current-dividends", "0")
    ),
    priorIssueShares: parseSocieNumber(
      getDisclosureTextOverride(disclosureTextOverrides, "socie-prior-issue-shares", "0")
    ),
    currentIssueShares: parseSocieNumber(
      getDisclosureTextOverride(disclosureTextOverrides, "socie-current-issue-shares", "0")
    ),
    priorOtherRetainedMovement: parseSocieNumber(
      getDisclosureTextOverride(disclosureTextOverrides, "socie-prior-other-retained", "0")
    ),
    currentOtherRetainedMovement: parseSocieNumber(
      getDisclosureTextOverride(disclosureTextOverrides, "socie-current-other-retained", "0")
    ),
  };
}

function buildEquityReconciliation({
  shareCapital,
  mappedRetainedIncome,
  profitForYear,
  disclosureTextOverrides,
}: {
  shareCapital: { current: number; prior: number };
  mappedRetainedIncome: { current: number; prior: number };
  profitForYear: { current: number; prior: number };
  disclosureTextOverrides: Record<string, string>;
}): EquityReconciliation {
  const manual = getSocieManualMovements(disclosureTextOverrides);

  const openingShareCapitalPrior = toNumber(shareCapital.prior);
  const closingShareCapitalPrior = roundForStatement(
    openingShareCapitalPrior + manual.priorIssueShares
  );
  const openingShareCapitalCurrent = closingShareCapitalPrior;
  const closingShareCapitalCurrent = roundForStatement(
    openingShareCapitalCurrent + manual.currentIssueShares
  );

  const openingRetainedIncomePrior = toNumber(mappedRetainedIncome.prior);
  const profitOrLossPrior = toNumber(profitForYear.prior);
  const otherComprehensiveIncomePrior = 0;
  const dividendsPrior = toNumber(manual.priorDividends);
  const otherRetainedMovementPrior = toNumber(manual.priorOtherRetainedMovement);

  const closingRetainedIncomePrior = roundForStatement(
    openingRetainedIncomePrior +
      profitOrLossPrior +
      otherComprehensiveIncomePrior +
      dividendsPrior +
      otherRetainedMovementPrior
  );

  const openingRetainedIncomeCurrent = closingRetainedIncomePrior;
  const profitOrLossCurrent = toNumber(profitForYear.current);
  const otherComprehensiveIncomeCurrent = 0;
  const dividendsCurrent = toNumber(manual.currentDividends);
  const otherRetainedMovementCurrent = toNumber(manual.currentOtherRetainedMovement);

  const closingRetainedIncomeCurrent = roundForStatement(
    openingRetainedIncomeCurrent +
      profitOrLossCurrent +
      otherComprehensiveIncomeCurrent +
      dividendsCurrent +
      otherRetainedMovementCurrent
  );

  const mappedRetainedIncomePrior = toNumber(mappedRetainedIncome.prior);
  const mappedRetainedIncomeCurrent = toNumber(mappedRetainedIncome.current);

  const retainedIncomeOpeningControl = mappedRetainedIncomeCurrent;
  const retainedIncomeClosingControl = roundForStatement(
    mappedRetainedIncomeCurrent +
      profitOrLossCurrent +
      otherComprehensiveIncomeCurrent +
      dividendsCurrent +
      otherRetainedMovementCurrent
  );

  const retainedIncomeOpeningCheckDifference = roundForStatement(
    retainedIncomeOpeningControl - openingRetainedIncomeCurrent
  );

  const retainedIncomeClosingCheckDifference = roundForStatement(
    retainedIncomeClosingControl - closingRetainedIncomeCurrent
  );

  const closingEquityPrior = roundForStatement(
    closingShareCapitalPrior + closingRetainedIncomePrior
  );
  const closingEquityCurrent = roundForStatement(
    closingShareCapitalCurrent + closingRetainedIncomeCurrent
  );

  return {
    openingShareCapitalPrior,
    closingShareCapitalPrior,
    openingShareCapitalCurrent,
    closingShareCapitalCurrent,
    openingRetainedIncomePrior,
    profitOrLossPrior,
    otherComprehensiveIncomePrior,
    dividendsPrior,
    otherRetainedMovementPrior,
    closingRetainedIncomePrior,
    openingRetainedIncomeCurrent,
    profitOrLossCurrent,
    otherComprehensiveIncomeCurrent,
    dividendsCurrent,
    otherRetainedMovementCurrent,
    closingRetainedIncomeCurrent,
    mappedRetainedIncomeCurrent,
    mappedRetainedIncomePrior,
    retainedIncomeOpeningControl,
    retainedIncomeClosingControl,
    retainedIncomeOpeningCheckDifference,
    retainedIncomeClosingCheckDifference,
    closingEquityCurrent,
    closingEquityPrior,
    hasOpeningCheckDifference: Math.abs(retainedIncomeOpeningCheckDifference) >= 0.005,
    hasClosingCheckDifference: Math.abs(retainedIncomeClosingCheckDifference) >= 0.005,
  };
}

function applyEquityReconciliationToSfp(
  sections: StatementLine[],
  reconciliation: EquityReconciliation
): StatementLine[] {
  const cloneAndUpdate = (line: StatementLine): StatementLine => {
    const children = (line.children || []).map(cloneAndUpdate);

    let nextLine: StatementLine = {
      ...line,
      children: children.length ? children : undefined,
    };

    const lowerLabel = line.label.toLowerCase();

    if (line.key === "share-capital" || lowerLabel.includes("share capital")) {
      nextLine = {
        ...nextLine,
        current: reconciliation.closingShareCapitalCurrent,
        prior: reconciliation.closingShareCapitalPrior,
      };
    }

    if (
      line.key === "retained-income" ||
      lowerLabel.includes("retained income") ||
      lowerLabel.includes("retained earnings") ||
      lowerLabel.includes("accumulated loss")
    ) {
      nextLine = {
        ...nextLine,
        current: reconciliation.closingRetainedIncomeCurrent,
        prior: reconciliation.closingRetainedIncomePrior,
      };
    }

    if (children.length) {
      nextLine.current = roundForStatement(
        children.reduce((total, child) => total + toNumber(child.current), 0)
      );
      nextLine.prior = roundForStatement(
        children.reduce((total, child) => total + toNumber(child.prior), 0)
      );
    }

    return nextLine;
  };

  return sections.map(cloneAndUpdate);
}

function EquityReconciliationWarning({
  reconciliation,
}: {
  reconciliation: EquityReconciliation;
}) {
  if (!reconciliation.hasOpeningCheckDifference && !reconciliation.hasClosingCheckDifference) {
    return null;
  }

  return (
    <div style={styles.statementWarningBox}>
      <strong>Statement of Changes in Equity check</strong>
      {reconciliation.hasOpeningCheckDifference ? (
        <span>
          Opening retained income control does not agree. The prior year roll-forward gives {formatAmount(reconciliation.openingRetainedIncomeCurrent)},
          while the current-year retained income account mapped from the trial balance is {formatAmount(reconciliation.retainedIncomeOpeningControl)}.
          Difference: {formatAmount(reconciliation.retainedIncomeOpeningCheckDifference)}.
        </span>
      ) : null}
      {reconciliation.hasClosingCheckDifference ? (
        <span>
          Closing retained income control does not agree. The Statement of Changes in Equity calculates closing retained income as {formatAmount(reconciliation.closingRetainedIncomeCurrent)}.
          The control calculation is mapped retained income {formatAmount(reconciliation.mappedRetainedIncomeCurrent)} plus current year profit/loss and owner movements, giving {formatAmount(reconciliation.retainedIncomeClosingControl)}.
          Difference: {formatAmount(reconciliation.retainedIncomeClosingCheckDifference)}.
        </span>
      ) : null}
      <span>
        The Statement of Financial Position uses the closing retained income calculated by this statement. The retained income account mapped from the trial balance is used as a control figure, together with profit/loss and owner movements.
      </span>
    </div>
  );
}

function SocieAmountInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={styles.socieInput}
      placeholder="0"
      inputMode="decimal"
    />
  );
}

function StatementOfChangesInEquityTable({
  reconciliation,
  disclosureTextOverrides,
  savingDisclosureTextKey,
  onDisclosureTextChange,
  onDisclosureTextSave,
}: {
  reconciliation: EquityReconciliation;
  disclosureTextOverrides: Record<string, string>;
  savingDisclosureTextKey?: string;
  onDisclosureTextChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onDisclosureTextSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
}) {
  const [editingMovements, setEditingMovements] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const getMovementValue = (key: string) => {
    if (drafts[key] !== undefined) return drafts[key];
    return getDisclosureTextOverride(disclosureTextOverrides, key, "0");
  };

  const changeMovement = (key: string, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
    onDisclosureTextChange?.("changes-in-equity", "manual-movements", key, value);
  };

  const saveMovement = async (key: string) => {
    await onDisclosureTextSave?.(
      "changes-in-equity",
      "manual-movements",
      key,
      getMovementValue(key)
    );
  };

  const saveAllMovements = async () => {
    const keys = [
      "socie-prior-dividends",
      "socie-current-dividends",
      "socie-prior-issue-shares",
      "socie-current-issue-shares",
      "socie-prior-other-retained",
      "socie-current-other-retained",
    ];

    for (const key of keys) {
      await saveMovement(key);
    }

    setEditingMovements(false);
  };

  const isSavingMovements = String(savingDisclosureTextKey || "").startsWith(
    "changes-in-equity::manual-movements::"
  );

  const rows: Array<{
    key: string;
    label: string;
    shareCapital?: number;
    retainedIncome?: number;
    total?: number;
    section?: boolean;
    bold?: boolean;
    totalRow?: boolean;
    inputKeyShare?: string;
    inputKeyRetained?: string;
  }> = [
    {
      key: "opening-prior",
      label: "Balance at beginning of previous year",
      shareCapital: reconciliation.openingShareCapitalPrior,
      retainedIncome: reconciliation.openingRetainedIncomePrior,
      total: reconciliation.openingShareCapitalPrior + reconciliation.openingRetainedIncomePrior,
      bold: true,
    },
    { key: "prior-changes", label: "Changes in equity - previous year", section: true },
    {
      key: "prior-profit",
      label: "Profit / (loss) for the previous year",
      shareCapital: 0,
      retainedIncome: reconciliation.profitOrLossPrior,
      total: reconciliation.profitOrLossPrior,
    },
    {
      key: "prior-oci",
      label: "Other comprehensive income for the previous year",
      shareCapital: 0,
      retainedIncome: reconciliation.otherComprehensiveIncomePrior,
      total: reconciliation.otherComprehensiveIncomePrior,
    },
    {
      key: "prior-total-comprehensive",
      label: "Total comprehensive income / (loss) for the previous year",
      shareCapital: 0,
      retainedIncome: reconciliation.profitOrLossPrior + reconciliation.otherComprehensiveIncomePrior,
      total: reconciliation.profitOrLossPrior + reconciliation.otherComprehensiveIncomePrior,
      bold: true,
    },
    { key: "prior-owner-transactions", label: "Transactions with owners - previous year", section: true },
    {
      key: "prior-dividends",
      label: "Dividends declared and paid",
      shareCapital: 0,
      retainedIncome: reconciliation.dividendsPrior,
      total: reconciliation.dividendsPrior,
      inputKeyRetained: "socie-prior-dividends",
    },
    {
      key: "prior-issue-shares",
      label: "Issue of shares",
      shareCapital: reconciliation.closingShareCapitalPrior - reconciliation.openingShareCapitalPrior,
      retainedIncome: 0,
      total: reconciliation.closingShareCapitalPrior - reconciliation.openingShareCapitalPrior,
      inputKeyShare: "socie-prior-issue-shares",
    },
    {
      key: "prior-other-retained",
      label: "Other retained income movement",
      shareCapital: 0,
      retainedIncome: reconciliation.otherRetainedMovementPrior,
      total: reconciliation.otherRetainedMovementPrior,
      inputKeyRetained: "socie-prior-other-retained",
    },
    {
      key: "closing-prior",
      label: "Balance at end of previous year / beginning of current year",
      shareCapital: reconciliation.closingShareCapitalPrior,
      retainedIncome: reconciliation.closingRetainedIncomePrior,
      total: reconciliation.closingEquityPrior,
      totalRow: true,
    },
    {
      key: "opening-current",
      label: "Balance at beginning of current year",
      shareCapital: reconciliation.openingShareCapitalCurrent,
      retainedIncome: reconciliation.openingRetainedIncomeCurrent,
      total: reconciliation.openingShareCapitalCurrent + reconciliation.openingRetainedIncomeCurrent,
      bold: true,
    },
    { key: "current-changes", label: "Changes in equity - current year", section: true },
    {
      key: "current-profit",
      label: "Profit / (loss) for the year",
      shareCapital: 0,
      retainedIncome: reconciliation.profitOrLossCurrent,
      total: reconciliation.profitOrLossCurrent,
    },
    {
      key: "current-oci",
      label: "Other comprehensive income for the year",
      shareCapital: 0,
      retainedIncome: reconciliation.otherComprehensiveIncomeCurrent,
      total: reconciliation.otherComprehensiveIncomeCurrent,
    },
    {
      key: "current-total-comprehensive",
      label: "Total comprehensive income / (loss) for the year",
      shareCapital: 0,
      retainedIncome: reconciliation.profitOrLossCurrent + reconciliation.otherComprehensiveIncomeCurrent,
      total: reconciliation.profitOrLossCurrent + reconciliation.otherComprehensiveIncomeCurrent,
      bold: true,
    },
    { key: "current-owner-transactions", label: "Transactions with owners - current year", section: true },
    {
      key: "current-dividends",
      label: "Dividends declared and paid",
      shareCapital: 0,
      retainedIncome: reconciliation.dividendsCurrent,
      total: reconciliation.dividendsCurrent,
      inputKeyRetained: "socie-current-dividends",
    },
    {
      key: "current-issue-shares",
      label: "Issue of shares",
      shareCapital: reconciliation.closingShareCapitalCurrent - reconciliation.openingShareCapitalCurrent,
      retainedIncome: 0,
      total: reconciliation.closingShareCapitalCurrent - reconciliation.openingShareCapitalCurrent,
      inputKeyShare: "socie-current-issue-shares",
    },
    {
      key: "current-other-retained",
      label: "Other retained income movement",
      shareCapital: 0,
      retainedIncome: reconciliation.otherRetainedMovementCurrent,
      total: reconciliation.otherRetainedMovementCurrent,
      inputKeyRetained: "socie-current-other-retained",
    },
    {
      key: "closing-current",
      label: "Balance at end of year",
      shareCapital: reconciliation.closingShareCapitalCurrent,
      retainedIncome: reconciliation.closingRetainedIncomeCurrent,
      total: reconciliation.closingEquityCurrent,
      totalRow: true,
    },
  ];

  return (
    <>
      <EquityReconciliationWarning reconciliation={reconciliation} />
      <div className="afs-screen-only" style={styles.socieToolbar}>
        <span>Statement reconciles retained income across previous year and current year.</span>
        {editingMovements ? (
          <div style={styles.socieToolbarActions}>
            <button
              type="button"
              style={isSavingMovements ? styles.inlineEditorButtonDisabled : styles.inlineEditorButton}
              onClick={saveAllMovements}
              disabled={isSavingMovements}
            >
              {isSavingMovements ? "Saving..." : "Save SCE movements"}
            </button>
            <button
              type="button"
              style={styles.inlineEditorSecondaryButton}
              onClick={() => setEditingMovements(false)}
            >
              Done
            </button>
          </div>
        ) : (
          <button
            type="button"
            style={styles.inlineEditSmallButton}
            onClick={() => setEditingMovements(true)}
          >
            Edit SCE movements
          </button>
        )}
      </div>
      <table style={styles.socieTable}>
        <colgroup>
          <col style={styles.socieColDescription} />
          <col style={styles.socieColAmount} />
          <col style={styles.socieColAmount} />
          <col style={styles.socieColAmount} />
        </colgroup>
        <thead>
          <tr>
            <th style={styles.statementTh}>Figures in Rand</th>
            <th style={styles.socieHeaderRight}>Share capital</th>
            <th style={styles.socieHeaderRight}>Retained income /<br />(accumulated loss)</th>
            <th style={styles.socieHeaderRight}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.section) {
              return (
                <tr key={row.key}>
                  <td style={styles.socieSectionLabel}>{row.label}</td>
                  <td style={styles.socieSectionAmount}></td>
                  <td style={styles.socieSectionAmount}></td>
                  <td style={styles.socieSectionAmount}></td>
                </tr>
              );
            }

            const labelStyle = row.totalRow
              ? styles.socieTotalLabel
              : row.bold
              ? styles.socieBoldLabel
              : styles.socieLabel;

            const amountStyle = row.totalRow
              ? styles.socieTotalAmount
              : row.bold
              ? styles.socieBoldAmount
              : styles.socieAmount;

            const shareCapitalAmount = editingMovements && row.inputKeyShare ? (
              <SocieAmountInput
                value={getMovementValue(row.inputKeyShare)}
                onChange={(value) => changeMovement(row.inputKeyShare!, value)}
              />
            ) : (
              formatAmount(toNumber(row.shareCapital))
            );

            const retainedAmount = editingMovements && row.inputKeyRetained ? (
              <SocieAmountInput
                value={getMovementValue(row.inputKeyRetained)}
                onChange={(value) => changeMovement(row.inputKeyRetained!, value)}
              />
            ) : (
              formatAmount(toNumber(row.retainedIncome))
            );

            return (
              <tr key={row.key}>
                <td style={labelStyle}>{row.label}</td>
                <td style={amountStyle}>{shareCapitalAmount}</td>
                <td style={amountStyle}>{retainedAmount}</td>
                <td style={amountStyle}>{formatAmount(toNumber(row.total))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function StatementOfComprehensiveIncomeTable({
  lines,
  currentHeading,
  priorHeading,
  showNotes,
}: {
  lines: StatementLine[];
  currentHeading: string;
  priorHeading: string;
  showNotes: boolean;
}) {
  const standardRows = [
    statementLineOrZero(lines, "revenue", "Revenue"),
    statementLineOrZero(lines, "cost-of-sales", "Cost of sales"),
    statementLineOrZero(lines, "gross-profit", "Gross profit / (loss)", true),
    statementLineOrZero(lines, "other-income", "Other income"),
    statementLineOrZero(lines, "operating-expenses", "Operating expenses"),
    statementLineOrZero(lines, "finance-costs", "Finance costs"),
    statementLineOrZero(lines, "profit-before-tax", "Profit / (loss) before taxation", true),
    statementLineOrZero(lines, "taxation", "Taxation"),
    statementLineOrZero(lines, "profit-after-tax", "Profit / (loss) for the year", false, true),
  ];

  const profitForYear = statementLineOrZero(lines, "profit-after-tax", "Profit / (loss) for the year", false, true);
  const otherComprehensiveIncome = { current: 0, prior: 0 };
  const totalComprehensiveIncome = {
    current: profitForYear.current + otherComprehensiveIncome.current,
    prior: profitForYear.prior + otherComprehensiveIncome.prior,
  };

  return (
    <table style={styles.statementTable}>
      <colgroup>
        <col style={styles.statementColDescription} />
        {showNotes ? <col style={styles.statementColNote} /> : null}
        <col style={styles.statementColAmount} />
        <col style={styles.statementColAmount} />
      </colgroup>
      <thead>
        <tr>
          <th style={styles.statementTh}>Figures in Rand</th>
          {showNotes ? <th style={styles.statementThNote}>Note</th> : null}
          <th style={styles.statementThRight}><YearHeader label={currentHeading} /></th>
          <th style={styles.statementThRight}><YearHeader label={priorHeading} /></th>
        </tr>
      </thead>
      <tbody>
        {standardRows.map((line) => (
          <ComprehensiveIncomeRow key={line.key} line={line} showNotes={showNotes} />
        ))}

        <tr>
          <td colSpan={showNotes ? 4 : 3} style={styles.statementSectionGap}></td>
        </tr>

        <tr>
          <td style={styles.statementGroupHeading}>Other comprehensive income</td>
          {showNotes ? <td style={styles.statementGroupHeadingNote}></td> : null}
          <td style={styles.statementGroupHeadingAmount}></td>
          <td style={styles.statementGroupHeadingAmount}></td>
        </tr>

        <tr>
          <td style={styles.statementLineLabel}>Other comprehensive income for the year</td>
          {showNotes ? <td style={styles.statementNote}></td> : null}
          <td style={styles.statementAmount}>-</td>
          <td style={styles.statementAmount}>-</td>
        </tr>

        <tr>
          <td style={styles.statementTotalLabel}>Total comprehensive income / (loss) for the year</td>
          {showNotes ? <td style={styles.statementTotalNote}></td> : null}
          <td style={styles.statementTotalAmount}>{formatAmount(totalComprehensiveIncome.current)}</td>
          <td style={styles.statementTotalAmount}>{formatAmount(totalComprehensiveIncome.prior)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function statementLineOrZero(
  lines: StatementLine[],
  key: string,
  label: string,
  isSubtotal = false,
  isTotal = false
): StatementLine {
  const found = findLineByKey(lines, key);

  return {
    key,
    label: found?.label || label,
    current: toNumber(found?.current),
    prior: toNumber(found?.prior),
    noteNumber: found?.noteNumber,
    isSubtotal: found?.isSubtotal || isSubtotal,
    isTotal: found?.isTotal || isTotal,
  };
}

function ComprehensiveIncomeRow({ line, showNotes }: { line: StatementLine; showNotes: boolean }) {
  const isTotal = line.isTotal;
  const isSubtotal = line.isSubtotal;

  return (
    <tr>
      <td style={isTotal ? styles.statementTotalLabel : isSubtotal ? styles.statementSubtotalLabel : styles.statementLineLabel}>
        {line.label}
      </td>
      {showNotes ? (
        <td style={isTotal ? styles.statementTotalNote : isSubtotal ? styles.statementSubtotalNote : styles.statementNote}>
          {isTotal || isSubtotal ? "" : <NoteLink noteNumber={line.noteNumber} />}
        </td>
      ) : null}
      <td style={isTotal ? styles.statementTotalAmount : isSubtotal ? styles.statementSubtotalAmount : styles.statementAmount}>
        {formatAmount(line.current)}
      </td>
      <td style={isTotal ? styles.statementTotalAmount : isSubtotal ? styles.statementSubtotalAmount : styles.statementAmount}>
        {formatAmount(line.prior)}
      </td>
    </tr>
  );
}


const SFP_ALL_MODE_DEFINITION: StatementLine[] = [
  {
    key: "assets",
    label: "Assets",
    current: 0,
    prior: 0,
    children: [
      {
        key: "non-current-assets",
        label: "Non-current assets",
        current: 0,
        prior: 0,
        children: [
          emptyStatementLine("property-plant-and-equipment", "Property, plant and equipment"),
          emptyStatementLine("right-of-use-assets", "Right-of-use assets"),
          emptyStatementLine("investment-property", "Investment property"),
          emptyStatementLine("intangible-assets", "Intangible assets"),
          emptyStatementLine("long-term-loans-receivable", "Loans receivable"),
          emptyStatementLine("deferred-tax-asset", "Deferred tax asset"),
          emptyStatementLine("other-non-current-assets", "Other non-current assets"),
        ],
      },
      {
        key: "current-assets",
        label: "Current assets",
        current: 0,
        prior: 0,
        children: [
          emptyStatementLine("inventories", "Inventories"),
          emptyStatementLine("trade-and-other-receivables", "Trade and other receivables"),
          emptyStatementLine("current-tax-receivable", "Current tax receivable"),
          emptyStatementLine("cash-and-cash-equivalents", "Bank, cash and cash equivalents"),
          emptyStatementLine("other-current-assets", "Other current assets"),
        ],
      },
    ],
  },
  {
    key: "equity-and-liabilities",
    label: "Equity and liabilities",
    current: 0,
    prior: 0,
    children: [
      {
        key: "equity",
        label: "Equity",
        current: 0,
        prior: 0,
        children: [
          emptyStatementLine("share-capital", "Issued capital"),
          emptyStatementLine("retained-income", "Retained income / (accumulated loss)"),
          emptyStatementLine("reserves", "Reserves"),
        ],
      },
      {
        key: "liabilities",
        label: "Liabilities",
        current: 0,
        prior: 0,
        children: [
          {
            key: "non-current-liabilities",
            label: "Non-current liabilities",
            current: 0,
            prior: 0,
            children: [
              emptyStatementLine("shareholders-loans", "Shareholders loans"),
              emptyStatementLine("long-term-borrowings", "Other financial liabilities"),
              emptyStatementLine("lease-liabilities-non-current", "Lease liabilities"),
              emptyStatementLine("deferred-tax-liability", "Deferred tax liability"),
            ],
          },
          {
            key: "current-liabilities",
            label: "Current liabilities",
            current: 0,
            prior: 0,
            children: [
              emptyStatementLine("trade-and-other-payables", "Trade and other payables"),
              emptyStatementLine("bank-overdraft", "Bank overdraft"),
              emptyStatementLine("current-tax-payable", "Current tax payable"),
              emptyStatementLine("dividend-payable", "Dividend payable"),
              emptyStatementLine("other-current-liabilities", "Other current liabilities"),
            ],
          },
        ],
      },
    ],
  },
];

function emptyStatementLine(key: string, label: string): StatementLine {
  return { key, label, current: 0, prior: 0 };
}

function StatementModeToolbar({
  mode,
  onChange,
}: {
  mode: "review" | "edit";
  onChange: (mode: "review" | "edit") => void;
}) {
  return (
    <div className="statementModeToolbar afs-screen-only" style={styles.statementModeToolbar}>
      <span style={styles.statementModeLabel}>Statement display</span>
      <button
        type="button"
        style={mode === "review" ? styles.methodButtonActive : styles.methodButton}
        onClick={() => onChange("review")}
      >
        Review mode · used only
      </button>
      <button
        type="button"
        style={mode === "edit" ? styles.methodButtonActive : styles.methodButton}
        onClick={() => onChange("edit")}
      >
        Edit mode · all lines
      </button>
    </div>
  );
}

function buildSfpAllMode(actual: StatementLine[]): StatementLine[] {
  const actualMap = new Map<string, StatementLine>();

  function collect(line: StatementLine) {
    actualMap.set(line.key, line);
    (line.children || []).forEach(collect);
  }

  actual.forEach(collect);

  function merge(template: StatementLine): StatementLine {
    const actualLine = actualMap.get(template.key);
    const children = template.children?.map(merge);

    if (children?.length) {
      return {
        ...template,
        ...actualLine,
        children,
        current: children.reduce((total, child) => total + toNumber(child.current), 0),
        prior: children.reduce((total, child) => total + toNumber(child.prior), 0),
      };
    }

    return actualLine ? { ...template, ...actualLine } : template;
  }

  return SFP_ALL_MODE_DEFINITION.map(merge);
}



type TaxComputationRow = {
  key: string;
  label: string;
  current: number;
  prior: number;
  bold?: boolean;
  editable?: boolean;
};

function TaxComputationTable({
  currentHeading,
  priorHeading,
  profitCurrent,
  profitPrior,
  incomeStatementTaxCurrent,
  incomeStatementTaxPrior,
  clientSetup,
  disclosureTextOverrides,
  savingDisclosureTextKey,
  onDisclosureTextChange,
  onDisclosureTextSave,
}: {
  currentHeading: string;
  priorHeading: string;
  profitCurrent: number;
  profitPrior: number;
  incomeStatementTaxCurrent: number;
  incomeStatementTaxPrior: number;
  clientSetup?: ClientSetup | null;
  disclosureTextOverrides: Record<string, string>;
  savingDisclosureTextKey?: string;
  onDisclosureTextChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onDisclosureTextSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
}) {
  const taxRateKey = "tax-computation-rate";
  const rowsKey = "tax-computation-rows";
  const overrideKey = `tax-computation::manual::${rowsKey}`;
  const taxRate = parseFlexibleNumber(disclosureTextOverrides[`tax-computation::settings::${taxRateKey}`] || "27");

  const assessedLossCurrent = getAssessedLossFromClientSetup(clientSetup, "current");
  const assessedLossPrior = getAssessedLossFromClientSetup(clientSetup, "prior");
  const manualRows = parseTaxComputationRows(
    disclosureTextOverrides[overrideKey],
    profitCurrent,
    profitPrior,
    assessedLossCurrent,
    assessedLossPrior
  );
  const taxableIncomeCurrent = roundForStatement(manualRows.reduce((sum, row) => sum + toNumber(row.current), 0));
  const taxableIncomePrior = roundForStatement(manualRows.reduce((sum, row) => sum + toNumber(row.prior), 0));
  const normalTaxCurrent = roundForStatement((taxableIncomeCurrent * taxRate) / 100);
  const normalTaxPrior = roundForStatement((taxableIncomePrior * taxRate) / 100);
  const taxDifferenceCurrent = roundForStatement(toNumber(incomeStatementTaxCurrent) - normalTaxCurrent);
  const taxDifferencePrior = roundForStatement(toNumber(incomeStatementTaxPrior) - normalTaxPrior);

  const savingRows = savingDisclosureTextKey === overrideKey;
  const savingRate = savingDisclosureTextKey === `tax-computation::settings::${taxRateKey}`;

  const updateRows = (rows: TaxComputationRow[]) => {
    onDisclosureTextChange?.("tax-computation", "manual", rowsKey, JSON.stringify(rows));
  };

  const updateRow = (index: number, field: "label" | "current" | "prior", value: string) => {
    const next = manualRows.map((row, rowIndex) =>
      rowIndex === index
        ? {
            ...row,
            [field]: field === "label" ? value : parseFlexibleNumber(value),
          }
        : row
    );
    updateRows(next);
  };

  const addRow = () => {
    updateRows([
      ...manualRows,
      {
        key: `manual-${Date.now()}`,
        label: "Additional adjustment",
        current: 0,
        prior: 0,
        editable: true,
      },
    ]);
  };

  const removeRow = (index: number) => {
    const next = manualRows.filter((_, rowIndex) => rowIndex !== index);
    updateRows(next.length ? next : defaultTaxComputationRows(profitCurrent, profitPrior, assessedLossCurrent, assessedLossPrior));
  };

  const saveRows = async () => {
    await onDisclosureTextSave?.("tax-computation", "manual", rowsKey, JSON.stringify(manualRows));
  };

  const updateTaxRate = (value: string) => {
    onDisclosureTextChange?.("tax-computation", "settings", taxRateKey, value);
  };

  const saveTaxRate = async () => {
    await onDisclosureTextSave?.("tax-computation", "settings", taxRateKey, String(taxRate || 27));
  };

  return (
    <div>
      <div style={styles.taxComputationSettings}>
        <label style={styles.taxComputationRateLabel}>Tax rate %</label>
        <input
          value={String(taxRate || "")}
          onChange={(event) => updateTaxRate(event.target.value)}
          style={styles.taxComputationRateInput}
        />
        <button type="button" style={styles.inlineEditSmallButton} onClick={saveTaxRate} disabled={savingRate}>
          {savingRate ? "Saving..." : "Save rate"}
        </button>
      </div>

      <table style={styles.taxComputationTable}>
        <colgroup>
          <col style={styles.taxComputationDescriptionCol} />
          <col style={styles.taxComputationAmountCol} />
          <col style={styles.taxComputationAmountCol} />
          <col className="print-edit-col" style={styles.taxComputationActionCol} />
        </colgroup>
        <thead>
          <tr>
            <th style={styles.taxComputationTh}>Description</th>
            <th style={styles.taxComputationThRight}><YearHeader label={currentHeading} /></th>
            <th style={styles.taxComputationThRight}><YearHeader label={priorHeading} /></th>
            <th className="print-edit-col" style={styles.taxComputationThRight}>Edit</th>
          </tr>
        </thead>
        <tbody>
          {manualRows.map((row, index) => (
            <tr key={row.key}>
              <td style={row.bold ? styles.taxComputationTotalLabel : styles.taxComputationTd}>
                {row.editable ? (
                  <input
                    value={row.label}
                    onChange={(event) => updateRow(index, "label", event.target.value)}
                    style={styles.noteLineInput}
                  />
                ) : row.label}
              </td>
              <td className={row.bold ? "taxComputationTotalAmount" : "taxComputationAmount"} style={row.bold ? styles.taxComputationTotalAmount : styles.taxComputationAmount}>
                {row.editable ? (
                  <input
                    value={String(row.current)}
                    onChange={(event) => updateRow(index, "current", event.target.value)}
                    style={styles.noteAmountInput}
                  />
                ) : formatAmount(row.current)}
              </td>
              <td className={row.bold ? "taxComputationTotalAmount" : "taxComputationAmount"} style={row.bold ? styles.taxComputationTotalAmount : styles.taxComputationAmount}>
                {row.editable ? (
                  <input
                    value={String(row.prior)}
                    onChange={(event) => updateRow(index, "prior", event.target.value)}
                    style={styles.noteAmountInput}
                  />
                ) : formatAmount(row.prior)}
              </td>
              <td className="print-edit-col" style={styles.taxComputationAction}>
                {row.editable ? (
                  <button type="button" style={styles.inlineEditSmallButton} onClick={() => removeRow(index)}>
                    Remove
                  </button>
                ) : null}
              </td>
            </tr>
          ))}

          <tr>
            <td style={styles.taxComputationTotalLabel}>Taxable income / (assessed loss)</td>
            <td className="taxComputationTotalAmount" style={styles.taxComputationTotalAmount}>{formatAmount(taxableIncomeCurrent)}</td>
            <td className="taxComputationTotalAmount" style={styles.taxComputationTotalAmount}>{formatAmount(taxableIncomePrior)}</td>
            <td className="print-edit-col" style={styles.taxComputationAction}></td>
          </tr>
          <tr>
            <td style={styles.taxComputationTd}>Normal tax at {taxRate || 27}%</td>
            <td style={styles.taxComputationAmount}>{formatAmount(normalTaxCurrent)}</td>
            <td style={styles.taxComputationAmount}>{formatAmount(normalTaxPrior)}</td>
            <td className="print-edit-col" style={styles.taxComputationAction}></td>
          </tr>
          <tr>
            <td style={styles.taxComputationTd}>Tax credits / rebates / foreign tax credits</td>
            <td style={styles.taxComputationAmount}>-</td>
            <td style={styles.taxComputationAmount}>-</td>
            <td className="print-edit-col" style={styles.taxComputationAction}></td>
          </tr>
          <tr>
            <td style={styles.taxComputationFinalLabel}>Estimated normal tax payable / (receivable)</td>
            <td className="taxComputationFinalAmount" style={styles.taxComputationFinalAmount}>{formatAmount(normalTaxCurrent)}</td>
            <td className="taxComputationFinalAmount" style={styles.taxComputationFinalAmount}>{formatAmount(normalTaxPrior)}</td>
            <td className="print-edit-col" style={styles.taxComputationAction}></td>
          </tr>
          <tr>
            <td style={styles.taxComputationCheckLabel}>Tax per income statement</td>
            <td style={styles.taxComputationCheckAmount}>{formatAmount(incomeStatementTaxCurrent)}</td>
            <td style={styles.taxComputationCheckAmount}>{formatAmount(incomeStatementTaxPrior)}</td>
            <td className="print-edit-col" style={styles.taxComputationAction}></td>
          </tr>
          <tr>
            <td style={Math.abs(taxDifferenceCurrent) > 0.005 || Math.abs(taxDifferencePrior) > 0.005 ? styles.taxComputationDifferenceLabel : styles.taxComputationCheckLabel}>
              Difference - income statement vs computation
            </td>
            <td style={Math.abs(taxDifferenceCurrent) > 0.005 ? styles.taxComputationDifferenceAmount : styles.taxComputationCheckAmount}>
              {formatAmount(taxDifferenceCurrent)}
            </td>
            <td style={Math.abs(taxDifferencePrior) > 0.005 ? styles.taxComputationDifferenceAmount : styles.taxComputationCheckAmount}>
              {formatAmount(taxDifferencePrior)}
            </td>
            <td className="print-edit-col" style={styles.taxComputationAction}></td>
          </tr>
        </tbody>
      </table>

      <div style={styles.noteEditorActions}>
        <button type="button" style={styles.inlineEditSmallButton} onClick={addRow}>
          Add adjustment
        </button>
        <button type="button" style={styles.inlineEditorButton} onClick={saveRows} disabled={savingRows}>
          {savingRows ? "Saving..." : "Save tax computation"}
        </button>
      </div>
    </div>
  );
}


function getAssessedLossFromClientSetup(clientSetup: ClientSetup | null | undefined, period: "current" | "prior") {
  const currentKeys = [
    "assessed_loss_brought_forward",
    "assessed_loss_bf",
    "assessed_loss",
    "tax_assessed_loss",
    "income_tax_assessed_loss",
    "current_assessed_loss",
    "current_year_assessed_loss",
    "assessed_loss_current",
  ];

  const priorKeys = [
    "prior_assessed_loss_brought_forward",
    "prior_assessed_loss_bf",
    "prior_assessed_loss",
    "prior_year_assessed_loss",
    "assessed_loss_prior",
  ];

  const keys = period === "current" ? currentKeys : priorKeys;

  for (const key of keys) {
    const value = parseFlexibleNumber((clientSetup as any)?.[key]);
    if (Math.abs(value) >= 0.005) return Math.abs(value);
  }

  return 0;
}


function defaultTaxComputationRows(
  profitCurrent: number,
  profitPrior: number,
  assessedLossCurrent = 0,
  assessedLossPrior = 0
): TaxComputationRow[] {
  return [
    {
      key: "accounting-profit",
      label: "Accounting profit / (loss) before tax",
      current: roundForStatement(profitCurrent),
      prior: roundForStatement(profitPrior),
      bold: true,
    },
    { key: "exempt-income", label: "Less: Exempt income", current: 0, prior: 0, editable: true },
    { key: "non-deductible-expenses", label: "Add: Non-deductible expenses", current: 0, prior: 0, editable: true },
    { key: "capital-gains", label: "Add / (less): Capital gains tax adjustments", current: 0, prior: 0, editable: true },
    { key: "allowances", label: "Less: Capital allowances / wear and tear", current: 0, prior: 0, editable: true },
    { key: "temporary-differences", label: "Add / (less): Temporary differences", current: 0, prior: 0, editable: true },
    { key: "prior-year-adjustments", label: "Add / (less): Prior year adjustments", current: 0, prior: 0, editable: true },
    {
      key: "assessed-loss",
      label: "Less: Assessed loss brought forward / utilised",
      current: assessedLossCurrent ? -Math.abs(assessedLossCurrent) : 0,
      prior: assessedLossPrior ? -Math.abs(assessedLossPrior) : 0,
      editable: true,
    },
  ];
}

function parseTaxComputationRows(
  value: string | undefined,
  profitCurrent: number,
  profitPrior: number,
  assessedLossCurrent = 0,
  assessedLossPrior = 0
) {
  const fallback = defaultTaxComputationRows(profitCurrent, profitPrior, assessedLossCurrent, assessedLossPrior);
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback;

    return parsed.map((row, index) => ({
      key: clean(row?.key) || `row-${index}`,
      label: clean(row?.label) || "Adjustment",
      current: parseFlexibleNumber(row?.current),
      prior: parseFlexibleNumber(row?.prior),
      bold: Boolean(row?.bold),
      editable: Boolean(row?.editable),
    }));
  } catch {
    return fallback;
  }
}


type DetailedIncomeLine = {
  accountCode: string;
  accountName: string;
  current: number;
  prior: number;
};

type DetailedIncomeSection = {
  key: string;
  label: string;
  rows: DetailedIncomeLine[];
  current: number;
  prior: number;
  sign: "debit-positive" | "credit-positive";
};

const DETAILED_INCOME_SECTIONS: Array<{
  key: string;
  label: string;
  prefixes: string[];
  sign: "debit-positive" | "credit-positive";
}> = [
  { key: "revenue", label: "Revenue", prefixes: ["700", "revenue", "sales"], sign: "credit-positive" },
  { key: "cost-of-sales", label: "Cost of sales", prefixes: ["720", "cost-of-sales"], sign: "debit-positive" },
  { key: "other-income", label: "Other income", prefixes: ["730", "770", "785", "other-income", "investment-income"], sign: "credit-positive" },
  { key: "operating-expenses", label: "Operating expenses", prefixes: ["750", "781", "operating-expenses", "administration expenses", "expenses"], sign: "debit-positive" },
  { key: "finance-costs", label: "Finance costs", prefixes: ["775", "finance-costs", "interest paid"], sign: "debit-positive" },
  { key: "taxation", label: "Taxation", prefixes: ["795", "taxation", "income tax expense"], sign: "debit-positive" },
];

function DetailedIncomeStatementTable({
  trialBalanceLines,
  currentHeading,
  priorHeading,
}: {
  trialBalanceLines: AfsTrialBalanceLine[];
  currentHeading: string;
  priorHeading: string;
}) {
  const sections = buildDetailedIncomeSections(trialBalanceLines);
  const revenue = sectionTotal(sections, "revenue");
  const costOfSales = sectionTotal(sections, "cost-of-sales");
  const otherIncome = sectionTotal(sections, "other-income");
  const operatingExpenses = sectionTotal(sections, "operating-expenses");
  const financeCosts = sectionTotal(sections, "finance-costs");
  const taxation = sectionTotal(sections, "taxation");

  const grossProfitCurrent = revenue.current - costOfSales.current;
  const grossProfitPrior = revenue.prior - costOfSales.prior;
  const profitBeforeTaxCurrent = grossProfitCurrent + otherIncome.current - operatingExpenses.current - financeCosts.current;
  const profitBeforeTaxPrior = grossProfitPrior + otherIncome.prior - operatingExpenses.prior - financeCosts.prior;
  const profitAfterTaxCurrent = profitBeforeTaxCurrent - taxation.current;
  const profitAfterTaxPrior = profitBeforeTaxPrior - taxation.prior;

  return (
    <div>
      <p style={styles.detailedSubheading}>Detailed analysis of income and expenses</p>
      <table style={styles.detailedIncomeTable}>
        <colgroup>
          <col style={styles.detailedIncomeDescriptionCol} />
          <col style={styles.detailedIncomeAmountCol} />
          <col style={styles.detailedIncomeAmountCol} />
        </colgroup>
        <thead>
          <tr>
            <th style={styles.detailedIncomeTh}>Description</th>
            <th style={styles.detailedIncomeThRight}><YearHeader label={currentHeading} /></th>
            <th style={styles.detailedIncomeThRight}><YearHeader label={priorHeading} /></th>
          </tr>
        </thead>
        <tbody>
          {renderDetailedIncomeSection(sections.find((section) => section.key === "revenue"))}
          {renderDetailedIncomeSection(sections.find((section) => section.key === "cost-of-sales"))}
          <DetailedIncomeTotalRow label="Gross profit / (loss)" current={grossProfitCurrent} prior={grossProfitPrior} />

          {renderDetailedIncomeSection(sections.find((section) => section.key === "other-income"))}
          {renderDetailedIncomeSection(sections.find((section) => section.key === "operating-expenses"))}
          {renderDetailedIncomeSection(sections.find((section) => section.key === "finance-costs"))}
          <DetailedIncomeTotalRow label="Profit / (loss) before taxation" current={profitBeforeTaxCurrent} prior={profitBeforeTaxPrior} />

          {renderDetailedIncomeSection(sections.find((section) => section.key === "taxation"))}
          <DetailedIncomeTotalRow label="Profit / (loss) for the year" current={profitAfterTaxCurrent} prior={profitAfterTaxPrior} final />
        </tbody>
      </table>
    </div>
  );
}

function renderDetailedIncomeSection(section?: DetailedIncomeSection) {
  if (!section || !section.rows.length) return null;

  return (
    <Fragment key={section.key}>
      <tr>
        <td colSpan={3} style={styles.detailedIncomeSectionHeading}>{section.label}</td>
      </tr>
      {section.rows.map((row) => (
        <tr key={`${section.key}-${row.accountCode}-${row.accountName}`}>
          <td style={styles.detailedIncomeDescription}>{row.accountName}</td>
          <td style={styles.detailedIncomeAmount}>{formatAmount(row.current)}</td>
          <td style={styles.detailedIncomeAmount}>{formatAmount(row.prior)}</td>
        </tr>
      ))}
      <tr>
        <td style={styles.detailedIncomeSubtotalLabel}>Total {section.label.toLowerCase()}</td>
        <td style={styles.detailedIncomeSubtotalAmount}>{formatAmount(section.current)}</td>
        <td style={styles.detailedIncomeSubtotalAmount}>{formatAmount(section.prior)}</td>
      </tr>
    </Fragment>
  );
}

function DetailedIncomeTotalRow({
  label,
  current,
  prior,
  final = false,
}: {
  label: string;
  current: number;
  prior: number;
  final?: boolean;
}) {
  return (
    <tr>
      <td style={final ? styles.detailedIncomeFinalLabel : styles.detailedIncomeTotalLabel}>{label}</td>
      <td className={final ? "detailedIncomeFinalAmount" : "detailedIncomeTotalAmount"} style={final ? styles.detailedIncomeFinalAmount : styles.detailedIncomeTotalAmount}>{formatAmount(current)}</td>
      <td className={final ? "detailedIncomeFinalAmount" : "detailedIncomeTotalAmount"} style={final ? styles.detailedIncomeFinalAmount : styles.detailedIncomeTotalAmount}>{formatAmount(prior)}</td>
    </tr>
  );
}

function buildDetailedIncomeSections(trialBalanceLines: AfsTrialBalanceLine[]): DetailedIncomeSection[] {
  return DETAILED_INCOME_SECTIONS.map((definition) => {
    const rows = trialBalanceLines
      .filter((line) => detailedIncomeLineMatches(line, definition.prefixes))
      .map((line) => {
        const rawCurrent = toNumber(
          line.current_year_balance ??
          (line as any).final_balance ??
          (line as any).current_balance ??
          (line as any).source_balance ??
          toNumber((line as any).debit) - toNumber((line as any).credit)
        );
        const rawPrior = toNumber(line.prior_year_balance ?? (line as any).prior_balance);
        const current = definition.sign === "credit-positive" ? -rawCurrent : rawCurrent;
        const prior = definition.sign === "credit-positive" ? -rawPrior : rawPrior;

        return {
          accountCode: clean(line.account_code),
          accountName: clean((line as any).account_name || (line as any).description || line.mapping_label || definition.label),
          current: roundForStatement(current),
          prior: roundForStatement(prior),
        };
      })
      .filter((row) => Math.abs(row.current) >= 0.005 || Math.abs(row.prior) >= 0.005)
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode) || a.accountName.localeCompare(b.accountName));

    return {
      key: definition.key,
      label: definition.label,
      rows,
      current: roundForStatement(rows.reduce((sum, row) => sum + row.current, 0)),
      prior: roundForStatement(rows.reduce((sum, row) => sum + row.prior, 0)),
      sign: definition.sign,
    };
  });
}

function detailedIncomeLineMatches(line: AfsTrialBalanceLine, prefixes: string[]) {
  const mappingCode = clean(line.mapping_code || line.lead_schedule_number).toLowerCase();
  const leadKey = clean(line.lead_schedule_key).toLowerCase();
  const mappingLabel = clean(`${line.mapping_label || ""} ${line.mapping_section || ""}`).toLowerCase();
  const accountCode = clean(line.account_code).toLowerCase();

  return prefixes.some((prefix) => {
    const item = prefix.toLowerCase();
    return (
      mappingCode === item ||
      mappingCode.startsWith(`${item}.`) ||
      mappingCode.startsWith(`${item}-`) ||
      leadKey.includes(item) ||
      mappingLabel.includes(item) ||
      accountCode.startsWith(item)
    );
  });
}

function sectionTotal(sections: DetailedIncomeSection[], key: string) {
  const section = sections.find((item) => item.key === key);
  return {
    current: toNumber(section?.current),
    prior: toNumber(section?.prior),
  };
}


function StatementTable({
  sections,
  currentHeading,
  priorHeading,
  showNotes,
}: {
  sections: StatementLine[];
  currentHeading: string;
  priorHeading: string;
  showNotes: boolean;
}) {
  return (
    <table style={styles.statementTable}>
      <colgroup>
        <col style={styles.statementColDescription} />
        {showNotes ? <col style={styles.statementColNote} /> : null}
        <col style={styles.statementColAmount} />
        <col style={styles.statementColAmount} />
      </colgroup>
      <thead>
        <tr>
          <th style={styles.statementTh}>Description</th>
          {showNotes ? <th style={styles.statementThNote}>Note</th> : null}
          <th style={styles.statementThRight}><YearHeader label={currentHeading} /></th>
          <th style={styles.statementThRight}><YearHeader label={priorHeading} /></th>
        </tr>
      </thead>
      <tbody>
        {sections.map((section, index) => (
          <Fragment key={section.key}>
            {index > 0 ? (
              <tr>
                <td colSpan={showNotes ? 4 : 3} style={styles.majorSpacerCell}></td>
              </tr>
            ) : null}
            <StatementSectionRows section={section} showNotes={showNotes} />
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

function StatementSectionRows({ section, showNotes }: { section: StatementLine; showNotes: boolean }) {
  return <>{renderStatementLine(section, showNotes, 0, true)}</>;
}

function renderStatementLine(
  line: StatementLine,
  showNotes: boolean,
  depth: number,
  isTopLevel = false
): ReactNode {
  const children = line.children || [];
  const hasChildren = children.length > 0;

  if (hasChildren) {
    return (
      <Fragment key={line.key}>
        <tr>
          <td style={isTopLevel ? styles.statementMajorHeading : styles.statementGroupHeading}>
            {line.label}
          </td>
          {showNotes ? (
            <td style={isTopLevel ? styles.statementMajorHeadingNote : styles.statementGroupHeadingNote}></td>
          ) : null}
          <td style={isTopLevel ? styles.statementMajorHeadingAmount : styles.statementGroupHeadingAmount}></td>
          <td style={isTopLevel ? styles.statementMajorHeadingAmount : styles.statementGroupHeadingAmount}></td>
        </tr>

        {children.map((child) => renderStatementLine(child, showNotes, depth + 1, false))}

        <tr>
          <td style={isTopLevel ? styles.statementTotalLabel : styles.statementSubtotalLabel}>
            {totalLabelFor(line.label)}
          </td>
          {showNotes ? <td style={isTopLevel ? styles.statementTotalNote : styles.statementSubtotalNote}></td> : null}
          <td style={isTopLevel ? styles.statementTotalAmount : styles.statementSubtotalAmount}>
            {formatAmount(line.current)}
          </td>
          <td style={isTopLevel ? styles.statementTotalAmount : styles.statementSubtotalAmount}>
            {formatAmount(line.prior)}
          </td>
        </tr>
      </Fragment>
    );
  }

  if (line.isTotal || line.isSubtotal) {
    return (
      <tr key={line.key}>
        <td style={line.isTotal ? styles.statementTotalLabel : styles.statementSubtotalLabel}>{line.label}</td>
        {showNotes ? <td style={line.isTotal ? styles.statementTotalNote : styles.statementSubtotalNote}></td> : null}
        <td style={line.isTotal ? styles.statementTotalAmount : styles.statementSubtotalAmount}>{formatAmount(line.current)}</td>
        <td style={line.isTotal ? styles.statementTotalAmount : styles.statementSubtotalAmount}>{formatAmount(line.prior)}</td>
      </tr>
    );
  }

  return (
    <tr key={line.key}>
      <td style={statementLineLabelStyle(depth)}>{line.label}</td>
      {showNotes ? <td style={styles.statementNote}><NoteLink noteNumber={line.noteNumber} /></td> : null}
      <td style={styles.statementAmount}>{formatAmount(line.current)}</td>
      <td style={styles.statementAmount}>{formatAmount(line.prior)}</td>
    </tr>
  );
}

function statementLineLabelStyle(depth: number): CSSProperties {
  return {
    ...styles.statementLineLabel,
    paddingLeft: `${Math.min(36, 10 + depth * 13)}px`,
  };
}

function totalLabelFor(label: string): string {
  const lower = label.toLowerCase();

  if (lower === "assets") return "Total assets";
  if (lower === "equity and liabilities") return "Total equity and liabilities";
  if (lower === "equity") return "Total equity";
  if (lower === "liabilities") return "Total liabilities";
  if (lower.includes("non-current assets")) return "Total non-current assets";
  if (lower.includes("current assets")) return "Total current assets";
  if (lower.includes("non-current liabilities")) return "Total non-current liabilities";
  if (lower.includes("current liabilities")) return "Total current liabilities";

  return `Total ${label.toLowerCase()}`;
}

function InfoTable({ rows }: { rows: [string, string][] }) {
  const visibleRows = rows.filter(([, value]) => clean(value));

  return (
    <table style={styles.infoTable}>
      <tbody>
        {visibleRows.map(([label, value]) => (
          <tr key={label}>
            <td style={styles.infoLabel}>{label}</td>
            <td style={styles.infoValue}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function IndexRow({ label, page }: { label: string; page: string }) {
  return (
    <tr>
      <td style={styles.indexLabel}>{label}</td>
      <td style={styles.indexDots}></td>
      <td style={styles.indexPage}>{page}</td>
    </tr>
  );
}

function ReportLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.reportBlock}>
      <h4 style={styles.reportHeading}>{label}</h4>
      <p style={styles.paragraph}>{value}</p>
    </div>
  );
}

function SignatureBlock({ place, date, directors, practitioner }: { place: string; date: string; directors?: ClientPerson[]; practitioner?: ClientSetup | null }) {
  if (practitioner) {
    const practitionerName = clean(practitioner.practitioner_name) || "Sarel FS van Aswegen";
    const designation = clean(practitioner.practitioner_designation) || "Professional Accountant (SA)";
    const practiceName = clean(practitioner.practice_name) || "Bizzacc Menlyn (Pty) Ltd";
    const addressLines = [
      clean((practitioner as any).practice_address_line_1) || "81 Kafue Street",
      clean((practitioner as any).practice_address_line_2) || "Lynnwood Glen",
      clean((practitioner as any).practice_address_city) || "Pretoria",
      clean((practitioner as any).practice_address_postal_code) || "0081",
    ].filter(Boolean);
    return (
      <div style={styles.practitionerSignature}>
        <div className="signatureLine" style={styles.signatureLine}></div>
        <strong>{practitionerName}</strong>
        <span>{designation}</span>
        <span>{practiceName}</span>
        {addressLines.map((line) => <span key={line}>{line}</span>)}
        <span>{place}</span>
        <span>{formatDateLong(date)}</span>
      </div>
    );
  }

  const signatories = directors && directors.length > 0 ? directors : [];

  return (
    <div style={styles.signatureGrid}>
      {signatories.length === 0 ? (
        <div style={styles.signatureBox}>
          <div className="signatureLine" style={styles.signatureLine}></div>
          <strong>Director / member</strong>
          <span>{place}</span>
          <span>{formatDateLong(date)}</span>
        </div>
      ) : (
        signatories.map((person) => (
          <div key={person.id} style={styles.signatureBox}>
            <div className="signatureLine" style={styles.signatureLine}></div>
            <strong>{person.full_name}</strong>
            <span>{place}</span>
            <span>{formatDateLong(date)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function CheckLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div style={bold ? styles.checkLineBold : styles.checkLine}>
      <span>{label}</span>
      <strong>{formatAmount(value)}</strong>
    </div>
  );
}

function SimpleAmountRow({ label, current, prior, bold }: { label: string; current: number; prior: number; bold?: boolean }) {
  return (
    <tr>
      <td style={bold ? styles.tdBold : styles.td}>{label}</td>
      <td style={bold ? styles.tdRightBold : styles.tdRight}>{formatAmount(current)}</td>
      <td style={bold ? styles.tdRightBold : styles.tdRight}>{formatAmount(prior)}</td>
    </tr>
  );
}


function CashFlowStatement({
  sfp,
  cashNoteNumber,
  cashUsedNoteNumber,
  profitCurrent,
  profitPrior,
  disclosureTextOverrides,
  savingDisclosureTextKey,
  onDisclosureTextChange,
  onDisclosureTextSave,
}: {
  sfp: StatementLine[];
  cashNoteNumber?: string;
  cashUsedNoteNumber?: string;
  profitCurrent: number;
  profitPrior: number;
  disclosureTextOverrides: Record<string, string>;
  savingDisclosureTextKey?: string;
  onDisclosureTextChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onDisclosureTextSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
}) {
  const [method, setMethod] = useState<"indirect" | "direct">("direct");
  const [editing, setEditing] = useState(false);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const storedValue = (key: string) => localValues[key] ?? disclosureTextOverrides[`cash-flow::manual::${key}`];

  const getValue = (key: string, fallback: number) => {
    const stored = storedValue(key);
    return stored === undefined || stored === null || String(stored).trim() === "" ? String(fallback) : String(stored);
  };

  const numberValue = (key: string, fallback: number) => parseFlexibleNumber(getValue(key, fallback));

  const generatedNumberValue = (key: string, fallback: number) => {
    const stored = storedValue(key);
    const storedText = stored === undefined || stored === null ? "" : String(stored).trim();
    if (storedText === "" || storedText === "0" || storedText === "0.00" || storedText === "0,00") {
      return roundCurrency(fallback);
    }
    return parseFlexibleNumber(storedText);
  };

  const changeValue = (key: string, value: string) => {
    setLocalValues((current) => ({ ...current, [key]: value }));
    onDisclosureTextChange?.("cash-flow", "manual", key, value);
  };

  const saveValue = async (key: string) => {
    await onDisclosureTextSave?.("cash-flow", "manual", key, getValue(key, 0));
  };

  const inventory = findNestedLineTotal(sfp, ["inventories"]);
  const receivables = findNestedLineTotal(sfp, ["trade and other receivables"]);
  const payables = findNestedLineTotal(sfp, ["trade and other payables"]);
  const cash = findNestedLineTotal(sfp, ["bank, cash and cash equivalents", "cash and cash equivalents"]);

  const workingCapitalCurrent = roundCurrency((inventory.prior - inventory.current) + (receivables.prior - receivables.current) + (payables.current - payables.prior));
  const workingCapitalPrior = 0;

  const closingCashCurrent = cash.current;
  const closingCashPrior = numberValue("cf-closing-cash-prior", cash.prior);
  const openingCashCurrent = numberValue("cf-opening-cash-current", cash.prior);
  const openingCashPrior = numberValue("cf-opening-cash-prior", 0);

  const requiredCashMovementCurrent = roundCurrency(closingCashCurrent - openingCashCurrent);
  const requiredCashMovementPrior = roundCurrency(closingCashPrior - openingCashPrior);

  const indirectDefaults = [
    { label: "Profit / (loss) before taxation", currentKey: "cf-profit-current", priorKey: "cf-profit-prior", current: profitCurrent, prior: profitPrior },
    { label: "Adjustments for non-cash items", currentKey: "cf-noncash-current", priorKey: "cf-noncash-prior", current: 0, prior: 0 },
    { label: "Finance costs", currentKey: "cf-finance-costs-current", priorKey: "cf-finance-costs-prior", current: 0, prior: 0 },
    { label: "Investment income", currentKey: "cf-investment-income-current", priorKey: "cf-investment-income-prior", current: 0, prior: 0 },
    { label: "Working capital movements", currentKey: "cf-working-capital-current", priorKey: "cf-working-capital-prior", current: workingCapitalCurrent, prior: workingCapitalPrior },
  ];

  const directDefaults = [
    { label: "Cash receipts from customers", currentKey: "cf-cash-receipts-current", priorKey: "cf-cash-receipts-prior", current: 0, prior: 0 },
    { label: "Cash paid to suppliers and employees", currentKey: "cf-cash-paid-current", priorKey: "cf-cash-paid-prior", current: 0, prior: 0 },
  ];

  const interestPaidCurrent = numberValue("cf-interest-paid-current", 0);
  const interestPaidPrior = numberValue("cf-interest-paid-prior", 0);
  const taxPaidCurrent = numberValue("cf-tax-paid-current", 0);
  const taxPaidPrior = numberValue("cf-tax-paid-prior", 0);
  const investingCurrent = numberValue("cf-investing-current", 0);
  const investingPrior = numberValue("cf-investing-prior", 0);
  const financingCurrent = numberValue("cf-financing-current", 0);
  const financingPrior = numberValue("cf-financing-prior", 0);

  const manualOperatingAfterCashGeneratedCurrent = interestPaidCurrent + taxPaidCurrent;
  const manualOperatingAfterCashGeneratedPrior = interestPaidPrior + taxPaidPrior;

  const defaultCashGeneratedCurrent = roundCurrency(requiredCashMovementCurrent - investingCurrent - financingCurrent - manualOperatingAfterCashGeneratedCurrent);
  const defaultCashGeneratedPrior = roundCurrency(requiredCashMovementPrior - investingPrior - financingPrior - manualOperatingAfterCashGeneratedPrior);

  const cashGeneratedDirectCurrent = generatedNumberValue("cf-cash-generated-current", defaultCashGeneratedCurrent);
  const cashGeneratedDirectPrior = generatedNumberValue("cf-cash-generated-prior", defaultCashGeneratedPrior);

  const indirectRows = indirectDefaults.map((row) => ({
    ...row,
    current: generatedNumberValue(row.currentKey, row.current),
    prior: generatedNumberValue(row.priorKey, row.prior),
  }));

  const directRows = [
    ...directDefaults.map((row) => ({
      ...row,
      current: numberValue(row.currentKey, row.current),
      prior: numberValue(row.priorKey, row.prior),
    })),
    {
      label: "Cash generated from operations",
      currentKey: "cf-cash-generated-current",
      priorKey: "cf-cash-generated-prior",
      current: cashGeneratedDirectCurrent,
      prior: cashGeneratedDirectPrior,
    },
  ];

  const saveAll = async () => {
    const allRowKeys = [...indirectDefaults, ...directDefaults, { currentKey: "cf-cash-generated-current", priorKey: "cf-cash-generated-prior" }];
    const keys = [
      ...allRowKeys.flatMap((row) => [row.currentKey, row.priorKey]),
      "cf-interest-paid-current",
      "cf-interest-paid-prior",
      "cf-tax-paid-current",
      "cf-tax-paid-prior",
      "cf-investing-current",
      "cf-investing-prior",
      "cf-financing-current",
      "cf-financing-prior",
      "cf-opening-cash-current",
      "cf-opening-cash-prior",
      "cf-closing-cash-prior",
    ];

    for (const key of keys) await saveValue(key);
    setEditing(false);
  };

  const rows = method === "direct" ? directRows : indirectRows;
  const cashUsedCurrent = rows.reduce((total, row) => total + toNumber(row.current), 0);
  const cashUsedPrior = rows.reduce((total, row) => total + toNumber(row.prior), 0);

  const operatingCurrent = cashUsedCurrent + interestPaidCurrent + taxPaidCurrent;
  const operatingPrior = cashUsedPrior + interestPaidPrior + taxPaidPrior;
  const cashMovementCurrent = operatingCurrent + investingCurrent + financingCurrent;
  const cashMovementPrior = operatingPrior + investingPrior + financingPrior;

  const calculatedClosingCashCurrent = openingCashCurrent + cashMovementCurrent;
  const calculatedClosingCashPrior = openingCashPrior + cashMovementPrior;
  const currentCashDifference = roundCurrency(closingCashCurrent - calculatedClosingCashCurrent);
  const priorCashDifference = roundCurrency(closingCashPrior - calculatedClosingCashPrior);

  const methodLabel = method === "indirect" ? "Indirect method" : "Direct method";

  return (
    <div>
      <div className="afs-print-hide" style={styles.cashFlowToolbar}>
        <div>
          <span style={styles.cashFlowHint}>Cash flow is supported by the cash used in operations note.</span>
        </div>
        <div style={styles.cashFlowActions}>
          <button type="button" style={method === "direct" ? styles.methodButtonActive : styles.methodButton} onClick={() => setMethod("direct")}>Direct</button>
          <button type="button" style={method === "indirect" ? styles.methodButtonActive : styles.methodButton} onClick={() => setMethod("indirect")}>Indirect</button>
          {editing ? (
            <button type="button" style={styles.inlineEditorButton} onClick={saveAll} disabled={Boolean(savingDisclosureTextKey)}>Save cash flow</button>
          ) : (
            <button type="button" style={styles.inlineEditSmallButton} onClick={() => setEditing(true)}>Edit cash flow</button>
          )}
        </div>
      </div>

      {(Math.abs(currentCashDifference) >= 0.005 || Math.abs(priorCashDifference) >= 0.005) ? (
        <div className="afs-screen-only" style={styles.cashFlowWarning}>
          Cash flow does not reconcile to cash and cash equivalents. Current difference: {formatAmount(currentCashDifference)}. Prior difference: {formatAmount(priorCashDifference)}.
        </div>
      ) : null}

      <table style={styles.statementTable}>
        <colgroup>
          <col style={styles.statementColDescription} />
          <col style={styles.statementColNote} />
          <col style={styles.statementColAmount} />
          <col style={styles.statementColAmount} />
        </colgroup>
        <thead>
          <tr>
            <th style={styles.statementTh}>Figures in Rand</th>
            <th style={styles.statementThNote}>Note</th>
            <th style={styles.statementThRight}><YearHeader label="2024" /></th>
            <th style={styles.statementThRight}><YearHeader label="2023" /></th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={styles.statementGroupHeading}>Cash flows from operating activities</td><td style={styles.statementNote}></td><td style={styles.statementAmount}></td><td style={styles.statementAmount}></td></tr>
          {rows.map((row) => (
            <CashFlowEditableRow key={row.currentKey} row={row} editing={editing} getValue={getValue} changeValue={changeValue} />
          ))}
          <CashFlowTotalRow label="Cash generated from / (used in) operations" current={cashUsedCurrent} prior={cashUsedPrior} note={cashUsedNoteNumber} />
          <CashFlowManualRow label="Interest paid" currentKey="cf-interest-paid-current" priorKey="cf-interest-paid-prior" current={interestPaidCurrent} prior={interestPaidPrior} editing={editing} getValue={getValue} changeValue={changeValue} />
          <CashFlowManualRow label="Taxation paid" currentKey="cf-tax-paid-current" priorKey="cf-tax-paid-prior" current={taxPaidCurrent} prior={taxPaidPrior} editing={editing} getValue={getValue} changeValue={changeValue} />
          <CashFlowTotalRow label="Net cash from operating activities" current={operatingCurrent} prior={operatingPrior} />

          <tr><td colSpan={4} style={styles.statementSectionGap}></td></tr>
          <tr><td style={styles.statementGroupHeading}>Cash flows from investing activities</td><td style={styles.statementNote}></td><td style={styles.statementAmount}></td><td style={styles.statementAmount}></td></tr>
          <CashFlowManualRow label="Net cash from investing activities" currentKey="cf-investing-current" priorKey="cf-investing-prior" current={investingCurrent} prior={investingPrior} editing={editing} getValue={getValue} changeValue={changeValue} />

          <tr><td colSpan={4} style={styles.statementSectionGap}></td></tr>
          <tr><td style={styles.statementGroupHeading}>Cash flows from financing activities</td><td style={styles.statementNote}></td><td style={styles.statementAmount}></td><td style={styles.statementAmount}></td></tr>
          <CashFlowManualRow label="Net cash from financing activities" currentKey="cf-financing-current" priorKey="cf-financing-prior" current={financingCurrent} prior={financingPrior} editing={editing} getValue={getValue} changeValue={changeValue} />

          <CashFlowTotalRow label="Total cash movement for the year" current={cashMovementCurrent} prior={cashMovementPrior} />
          <CashFlowManualRow label="Cash and cash equivalents at beginning of year" currentKey="cf-opening-cash-current" priorKey="cf-opening-cash-prior" current={openingCashCurrent} prior={openingCashPrior} editing={editing} getValue={getValue} changeValue={changeValue} />
          <CashFlowManualRow label="Cash and cash equivalents at end of year" note={cashNoteNumber} currentKey="cf-closing-cash-current-readonly" priorKey="cf-closing-cash-prior" current={closingCashCurrent} prior={closingCashPrior} editing={editing} getValue={(key, fallback) => key === "cf-closing-cash-current-readonly" ? String(fallback) : getValue(key, fallback)} changeValue={changeValue} />
          <CashFlowTotalRow label="Cash flow reconciliation difference" current={currentCashDifference} prior={priorCashDifference} doubleLine danger />
        </tbody>
      </table>
    </div>
  );
}
function CashFlowEditableRow({
  row,
  editing,
  getValue,
  changeValue,
}: {
  row: { label: string; currentKey: string; priorKey: string; current: number; prior: number; note?: string };
  editing: boolean;
  getValue: (key: string, fallback: number) => string;
  changeValue: (key: string, value: string) => void;
}) {
  return (
    <tr>
      <td style={styles.statementLineLabel}>{row.label}</td>
      <td style={styles.statementNote}>{row.note ? <NoteLink noteNumber={row.note} /> : ""}</td>
      <td style={styles.statementAmount}>{editing ? <SocieAmountInput value={getValue(row.currentKey, row.current)} onChange={(value) => changeValue(row.currentKey, value)} /> : formatAmount(row.current)}</td>
      <td style={styles.statementAmount}>{editing ? <SocieAmountInput value={getValue(row.priorKey, row.prior)} onChange={(value) => changeValue(row.priorKey, value)} /> : formatAmount(row.prior)}</td>
    </tr>
  );
}

function CashFlowManualRow({
  label,
  note,
  currentKey,
  priorKey,
  current,
  prior,
  editing,
  getValue,
  changeValue,
}: {
  label: string;
  note?: string;
  currentKey: string;
  priorKey: string;
  current: number;
  prior: number;
  editing: boolean;
  getValue: (key: string, fallback: number) => string;
  changeValue: (key: string, value: string) => void;
}) {
  return <CashFlowEditableRow row={{ label, currentKey, priorKey, current, prior, note }} editing={editing} getValue={getValue} changeValue={changeValue} />;
}

function CashFlowTotalRow({
  label,
  current,
  prior,
  note,
  doubleLine,
  danger,
}: {
  label: string;
  current: number;
  prior: number;
  note?: string;
  doubleLine?: boolean;
  danger?: boolean;
}) {
  const amountStyle = danger
    ? styles.statementDangerAmount
    : doubleLine
    ? styles.statementGrandTotalAmount
    : styles.statementTotalAmount;

  return (
    <tr className={danger ? "afs-screen-only" : undefined}>
      <td style={danger ? styles.statementDangerLabel : styles.statementTotalLabel}>{label}</td>
      <td style={styles.statementTotalNote}>{note ? <NoteLink noteNumber={note} /> : ""}</td>
      <td style={amountStyle}>{formatAmount(current)}</td>
      <td style={amountStyle}>{formatAmount(prior)}</td>
    </tr>
  );
}

function roundCurrency(value: number): number {
  return Math.round(toNumber(value) * 100) / 100;
}

function cashFlowManualNumber(overrides: Record<string, string>, key: string, fallback: number) {
  return parseFlexibleNumber(overrides[`cash-flow::manual::${key}`] ?? fallback);
}

function parseFlexibleNumber(value: any) {
  const text = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9().-]/g, "");

  if (!text) return 0;
  const negative = text.includes("(") && text.includes(")");
  const number = Number(text.replace(/[()]/g, ""));
  if (!Number.isFinite(number)) return 0;
  return negative ? -number : number;
}

function NoteLink({ noteNumber }: { noteNumber?: string }) {
  const note = clean(noteNumber);
  if (!note) return null;

  return (
    <span
      role="button"
      tabIndex={0}
      style={styles.noteLinkButton}
      onClick={(event) => {
        event.preventDefault();
        const target = document.getElementById(`afs-note-${note}`);
        if (target) {
          window.history.replaceState(null, "", `#afs-note-${note}`);
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const target = document.getElementById(`afs-note-${note}`);
          if (target) {
            window.history.replaceState(null, "", `#afs-note-${note}`);
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }}
    >
      {note}
    </span>
  );
}

const POLICY_CONFIG: Array<{
  key: string;
  optionKey: keyof ReportOptions;
  title: string;
  text: string;
}> = [
  {
    key: "basis-of-preparation",
    optionKey: "policyBasisPreparation",
    title: "Basis of preparation and summary of significant accounting policies",
    text: "The annual financial statements have been prepared in accordance with IFRS for SMEs and the requirements of the Companies Act of South Africa. The annual financial statements have been prepared on the historical cost basis, except where otherwise stated, and are presented in South African Rand.\n\nThe accounting policies set out below have been applied consistently to all periods presented in these annual financial statements.",
  },
  {
    key: "critical-judgements",
    optionKey: "policyJudgementsEstimates",
    title: "Significant judgements and sources of estimation uncertainty",
    text: "In preparing the annual financial statements, management is required to make judgements, estimates and assumptions that affect the application of accounting policies and the reported amounts of assets, liabilities, income and expenses. Estimates and underlying assumptions are reviewed on an ongoing basis.",
  },
  {
    key: "going-concern",
    optionKey: "policyGoingConcern",
    title: "Going concern",
    text: "The annual financial statements have been prepared on the going concern basis. Management has assessed the entity's ability to continue as a going concern and is not aware of any material uncertainties that may cast significant doubt on the entity's ability to continue as a going concern for the foreseeable future.",
  },
  {
    key: "financial-instruments",
    optionKey: "policyFinancialInstruments",
    title: "Financial instruments",
    text: "Financial assets and financial liabilities are recognised when the entity becomes a party to the contractual provisions of the instrument. Basic financial instruments are initially measured at the transaction price, including transaction costs, unless the arrangement constitutes a financing transaction. At the end of each reporting period, financial assets are assessed for objective evidence of impairment.",
  },
  {
    key: "cash-and-cash-equivalents",
    optionKey: "policyCashEquivalents",
    title: "Cash and cash equivalents",
    text: "Cash and cash equivalents comprise cash on hand, demand deposits and other short-term highly liquid investments that are readily convertible to known amounts of cash and are subject to an insignificant risk of changes in value.",
  },
  {
    key: "trade-and-other-receivables",
    optionKey: "policyTradeReceivables",
    title: "Trade and other receivables",
    text: "Trade and other receivables are recognised initially at the transaction price and subsequently measured at amortised cost using the effective interest method, less any impairment losses.",
  },
  {
    key: "inventories",
    optionKey: "policyInventories",
    title: "Inventories",
    text: "Inventories are measured at the lower of cost and estimated selling price less costs to complete and sell. Cost is determined using a method appropriate to the nature of the inventory and includes costs incurred in bringing the inventories to their present location and condition.",
  },
  {
    key: "property-plant-equipment",
    optionKey: "policyPropertyPlantEquipment",
    title: "Property, plant and equipment",
    text: "Property, plant and equipment are initially measured at cost and subsequently measured at cost less accumulated depreciation and accumulated impairment losses. Depreciation is recognised so as to write off the cost of assets, less their residual values, over their expected useful lives.",
  },
  {
    key: "investment-property",
    optionKey: "policyInvestmentProperty",
    title: "Investment property",
    text: "Investment property is property held to earn rentals or for capital appreciation or both. Investment property is measured in accordance with the entity's selected accounting policy under IFRS for SMEs.",
  },
  {
    key: "intangible-assets",
    optionKey: "policyIntangibleAssets",
    title: "Intangible assets",
    text: "Intangible assets acquired separately are initially measured at cost and subsequently measured at cost less accumulated amortisation and impairment losses. Amortisation is recognised over the useful life of the asset where applicable.",
  },
  {
    key: "impairment",
    optionKey: "policyImpairment",
    title: "Impairment of assets",
    text: "At each reporting date, the entity reviews the carrying amounts of its assets to determine whether there is any indication that those assets have suffered an impairment loss. Where such indication exists, the recoverable amount of the asset is estimated.",
  },
  {
    key: "revenue",
    optionKey: "policyRevenue",
    title: "Revenue",
    text: "Revenue is measured at the fair value of the consideration received or receivable, excluding amounts collected on behalf of third parties. Revenue from the sale of goods is recognised when the significant risks and rewards of ownership have transferred. Revenue from services is recognised by reference to the stage of completion when the outcome can be estimated reliably.",
  },
  {
    key: "employee-benefits",
    optionKey: "policyEmployeeBenefits",
    title: "Employee benefits",
    text: "Short-term employee benefits are recognised as an expense in the period in which the related service is rendered. Contributions to defined contribution plans are recognised as an expense when employees have rendered service entitling them to the contributions.",
  },
  {
    key: "borrowing-costs",
    optionKey: "policyBorrowingCosts",
    title: "Borrowing costs",
    text: "Borrowing costs are recognised as an expense in profit or loss in the period in which they are incurred, unless capitalisation is required or permitted by the applicable reporting framework.",
  },
  {
    key: "leases",
    optionKey: "policyLeases",
    title: "Leases",
    text: "Leases are classified in accordance with the substance of the arrangement. Lease payments are recognised on a basis that reflects the pattern of benefits received from the leased asset.",
  },
  {
    key: "taxation",
    optionKey: "policyTaxation",
    title: "Taxation",
    text: "Current tax is recognised based on taxable income for the year, using tax rates and laws that have been enacted or substantively enacted at the reporting date. Deferred tax is recognised on temporary differences where applicable.",
  },
  {
    key: "share-capital-equity",
    optionKey: "policyShareCapitalEquity",
    title: "Share capital and equity",
    text: "Ordinary shares are classified as equity. Equity instruments issued by the entity are measured at the fair value of the proceeds received, net of direct issue costs. Distributions to owners are recognised directly in equity when declared and no longer at the discretion of the entity.",
  },
  {
    key: "provisions-contingencies",
    optionKey: "policyProvisionsContingencies",
    title: "Provisions and contingencies",
    text: "Provisions are recognised when the entity has a present obligation as a result of a past event, it is probable that an outflow of economic benefits will be required to settle the obligation, and the amount can be estimated reliably. Contingent liabilities are disclosed unless the possibility of an outflow is remote.",
  },
  {
    key: "related-parties",
    optionKey: "policyRelatedParties",
    title: "Related parties",
    text: "Related party relationships, transactions and outstanding balances are disclosed where required by the applicable reporting framework.",
  },
  {
    key: "foreign-currency",
    optionKey: "policyForeignCurrency",
    title: "Foreign currency transactions",
    text: "Foreign currency transactions are translated into the functional currency using the exchange rates at the dates of the transactions. Monetary items denominated in foreign currencies are translated at the reporting date rate.",
  },
];

function AccountingPolicies({
  basis,
  disclosureTextOverrides,
  savingDisclosureTextKey,
  onDisclosureTextChange,
  onDisclosureTextSave,
  onDisclosureTextReset,
  reportOptions,
  onReportOptionChange,
  savingReportOptionKey,
}: {
  basis: string;
  disclosureTextOverrides: Record<string, string>;
  savingDisclosureTextKey?: string;
  onDisclosureTextChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onDisclosureTextSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
  onDisclosureTextReset?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string
  ) => void | Promise<void>;
  reportOptions: ReportOptions;
  onReportOptionChange?: (key: keyof ReportOptions, value: boolean) => void | Promise<void>;
  savingReportOptionKey?: keyof ReportOptions | null;
}) {
  const [mode, setMode] = useState<"review" | "edit">("review");
  const activePolicies = POLICY_CONFIG.filter((policy) => Boolean(reportOptions[policy.optionKey]));
  const visiblePolicies = POLICY_CONFIG;

  return (
    <div>
      <div className="afs-screen-only" style={styles.statementModeToolbar}>
        <span style={styles.statementModeLabel}>Accounting policies display</span>
        <button type="button" style={mode === "review" ? styles.methodButtonActive : styles.methodButton} onClick={() => setMode("review")}>
          Review mode
        </button>
        <button type="button" style={mode === "edit" ? styles.methodButtonActive : styles.methodButton} onClick={() => setMode("edit")}>
          Edit mode (all)
        </button>
      </div>

      {visiblePolicies.map((policy) => {
        const active = Boolean(reportOptions[policy.optionKey]);
        const activeIndex = activePolicies.findIndex((item) => item.key === policy.key);
        const text = getDisclosureText(
          disclosureTextOverrides,
          "accounting-policies",
          "policy",
          policy.key,
          policy.text.replace("IFRS for SMEs", basis)
        );
        const savingOption = savingReportOptionKey === policy.optionKey;

        return (
          <section
            key={policy.key}
            className={active ? "policySection" : "afs-screen-only"}
            style={active ? styles.policySection : styles.policySectionOff}
          >
            <div style={active ? styles.drInlineHeading : styles.drInlineHeadingOff}>
              <h4 style={active ? styles.reportHeading : styles.reportHeadingOff}>
                {active ? `${activeIndex + 1}. ` : ""}{policy.title}
              </h4>
              <button
                type="button"
                style={active ? styles.drToggleOn : styles.drToggleOff}
                onClick={() => onReportOptionChange?.(policy.optionKey, !active)}
                disabled={savingOption}
                title={active ? "Switch policy off" : "Switch policy on"}
              >
                {savingOption ? "Saving" : active ? "On" : "Off"}
              </button>
            </div>

            {active ? (
              <EditableDisclosureText
                pageKey="accounting-policies"
                sectionKey="policy"
                disclosureKey={policy.key}
                text={text}
                saving={savingDisclosureTextKey === `accounting-policies::policy::${policy.key}`}
                onChange={onDisclosureTextChange}
                onSave={onDisclosureTextSave}
                onReset={onDisclosureTextReset}
              />
            ) : (
              <p style={styles.inactiveDisclosureText}>
                Policy switched off. Turn it on here to include this accounting policy.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

const NOTE_CONFIG: Array<{
  key: string;
  optionKey: keyof ReportOptions;
  title: string;
  lineKeys?: string[];
  type?: "line" | "share-capital" | "cash-used" | "taxation" | "current-tax";
  description?: string;
}> = [
  {
    key: "property-plant-and-equipment",
    optionKey: "notesPropertyPlantEquipment",
    title: "Property, plant and equipment",
    lineKeys: ["property-plant-and-equipment"],
    description: "Property, plant and equipment are tangible assets held for use in the production or supply of goods or services, for rental to others, or for administrative purposes.",
  },
  {
    key: "goodwill",
    optionKey: "notesGoodwill",
    title: "Goodwill",
    lineKeys: ["goodwill"],
    description: "Goodwill is disclosed separately where applicable and is reviewed for impairment indicators at each reporting date.",
  },
  {
    key: "investment-property",
    optionKey: "notesInvestmentProperty",
    title: "Investment property",
    lineKeys: ["investment-property"],
    description: "Investment property is property held to earn rentals, for capital appreciation, or both, rather than for use in operations or for sale in the ordinary course of business.",
  },
  {
    key: "intangible-assets",
    optionKey: "notesIntangibleAssets",
    title: "Intangible assets",
    lineKeys: ["intangible-assets"],
    description: "Intangible assets are identifiable non-monetary assets without physical substance and are disclosed by class where applicable.",
  },
  {
    key: "biological-assets",
    optionKey: "notesBiologicalAssets",
    title: "Biological assets",
    lineKeys: ["biological-assets"],
    description: "Biological assets are disclosed where the entity holds living animals or plants related to agricultural activity.",
  },
  {
    key: "other-non-current-assets",
    optionKey: "notesOtherNonCurrentAssets",
    title: "Other financial assets",
    lineKeys: ["other-non-current-assets"],
    description: "Other financial assets are disclosed by class and measured in accordance with the entity's accounting policies for financial instruments.",
  },
  {
    key: "loans-receivable",
    optionKey: "notesLoansReceivable",
    title: "Loans receivable",
    lineKeys: ["long-term-loans-receivable"],
    description: "Loans receivable are disclosed with the main terms and conditions, including whether the loans are secured, interest-bearing and repayable on demand.",
  },
  {
    key: "inventories",
    optionKey: "notesInventories",
    title: "Inventories",
    lineKeys: ["inventories"],
    description: "Inventories are analysed by category where applicable.",
  },
  {
    key: "trade-receivables",
    optionKey: "notesTradeReceivables",
    title: "Trade and other receivables",
    lineKeys: ["trade-and-other-receivables"],
  },
  {
    key: "current-tax-receivable",
    optionKey: "notesCurrentTaxReceivable",
    title: "Current tax receivable",
    lineKeys: ["current-tax-receivable"],
    type: "current-tax",
    description: "Current tax receivable is analysed between the current tax charge, provisional tax payments, refunds and prior year adjustments where applicable.",
  },
  {
    key: "cash-and-cash-equivalents",
    optionKey: "notesCashAndCashEquivalents",
    title: "Cash and cash equivalents",
    lineKeys: ["cash-and-cash-equivalents"],
    description: "Cash and cash equivalents consist of cash on hand, bank balances and short-term deposits, net of bank overdrafts where applicable.",
  },
  {
    key: "share-capital",
    optionKey: "notesShareCapital",
    title: "Share capital",
    lineKeys: ["share-capital"],
    type: "share-capital",
  },
  {
    key: "retained-income",
    optionKey: "notesRetainedIncome",
    title: "Retained income / (accumulated loss)",
    lineKeys: ["retained-income"],
    description: "Retained income is controlled through the Statement of Changes in Equity and agrees to the closing balance disclosed in the statement of financial position.",
  },
  {
    key: "shareholders-loans",
    optionKey: "notesShareholdersLoans",
    title: "Loans to / (from) shareholders",
    lineKeys: ["shareholders-loans"],
    description: "Shareholder loans are disclosed with the main terms and conditions. Where no formal repayment terms exist, this should be disclosed.",
  },
  {
    key: "other-financial-liabilities",
    optionKey: "notesOtherFinancialLiabilities",
    title: "Other financial liabilities",
    lineKeys: ["long-term-borrowings"],
  },
  {
    key: "trade-payables",
    optionKey: "notesTradePayables",
    title: "Trade and other payables",
    lineKeys: ["trade-and-other-payables"],
  },
  {
    key: "current-tax-payable",
    optionKey: "notesCurrentTaxPayable",
    title: "Current tax payable",
    lineKeys: ["current-tax-payable"],
    type: "current-tax",
    description: "Current tax payable is analysed between the current tax charge, provisional tax payments, refunds and prior year adjustments where applicable.",
  },
  {
    key: "revenue",
    optionKey: "notesRevenue",
    title: "Revenue",
    lineKeys: ["revenue"],
  },
  {
    key: "other-income",
    optionKey: "notesOtherIncome",
    title: "Other income",
    lineKeys: ["other-income"],
  },
  {
    key: "operating-expenses",
    optionKey: "notesOperatingExpenses",
    title: "Operating expenses",
    lineKeys: ["operating-expenses"],
  },
  {
    key: "finance-costs",
    optionKey: "notesFinanceCosts",
    title: "Finance costs",
    lineKeys: ["finance-costs"],
  },
  {
    key: "taxation",
    optionKey: "notesTaxation",
    title: "Taxation",
    lineKeys: ["taxation"],
    type: "taxation",
    description: "Taxation is reconciled from accounting profit or loss to the tax expense recognised in profit or loss, including current tax, deferred tax and prior year adjustments where applicable.",
  },
  {
    key: "cash-used-in-operations",
    optionKey: "notesCashUsedInOperations",
    title: "Cash used in operations",
    type: "cash-used",
    description: "This note supports the statement of cash flows and can be switched off where the cash flow statement is not presented or where it is not required.",
  },
];

function noteEnabled(options: ReportOptions, optionKey: keyof ReportOptions) {
  return Boolean(options[optionKey]);
}

function buildDynamicNoteNumbering(
  sfpInput: StatementLine[],
  splInput: StatementLine[],
  options: ReportOptions
) {
  const lineKeyToNumber: Record<string, string> = {};
  const noteKeyToNumber: Record<string, string> = {};
  let nextNumber = 2;
  let cashUsedInOperationsNoteNumber = "";

  for (const config of NOTE_CONFIG) {
    if (!noteEnabled(options, config.optionKey)) continue;

    const number = String(nextNumber);
    nextNumber += 1;
    noteKeyToNumber[config.key] = number;

    if (config.type === "cash-used") {
      cashUsedInOperationsNoteNumber = number;
      continue;
    }

    for (const key of config.lineKeys || []) {
      lineKeyToNumber[key] = number;
    }
  }

  const applyNumbers = (lines: StatementLine[]): StatementLine[] =>
    lines.map((line) => {
      const children = line.children?.length ? applyNumbers(line.children) : undefined;
      const noteNumber = lineKeyToNumber[line.key] || undefined;

      return {
        ...line,
        noteNumber,
        children,
      };
    });

  return {
    sfp: applyNumbers(sfpInput),
    spl: applyNumbers(splInput),
    noteKeyToNumber,
    cashUsedInOperationsNoteNumber,
  };
}

function NoteTable({
  currentHeading,
  priorHeading,
  sfp,
  spl,
  trialBalanceLines,
  clientSetup,
  disclosureTextOverrides,
  savingDisclosureTextKey,
  onDisclosureTextChange,
  onDisclosureTextSave,
  onDisclosureTextReset,
  reportOptions,
  onReportOptionChange,
  savingReportOptionKey,
  noteKeyToNumber,
  cashUsedInOperationsNoteNumber,
}: {
  currentHeading: string;
  priorHeading: string;
  sfp: StatementLine[];
  spl: StatementLine[];
  trialBalanceLines: AfsTrialBalanceLine[];
  clientSetup?: ClientSetup | null;
  disclosureTextOverrides: Record<string, string>;
  savingDisclosureTextKey?: string;
  onDisclosureTextChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onDisclosureTextSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
  onDisclosureTextReset?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string
  ) => void | Promise<void>;
  reportOptions: ReportOptions;
  onReportOptionChange?: (optionKey: keyof ReportOptions, value: boolean) => void;
  savingReportOptionKey?: string | null;
  noteKeyToNumber?: Record<string, string>;
  cashUsedInOperationsNoteNumber?: string;
}) {
  const [mode, setMode] = useState<"review" | "edit">("review");

  const notes = buildIfrsNotes({
    sfp,
    spl,
    clientSetup,
    trialBalanceLines,
    currentHeading,
    priorHeading,
    disclosureTextOverrides,
    reportOptions,
    noteKeyToNumber,
    cashUsedInOperationsNoteNumber,
  });

  const visibleNotes =
    mode === "review" ? notes.filter((note) => note.active || note.hasBalance) : notes;

  return (
    <div>
      <section style={styles.noteIntroSection}>
        <h4 style={styles.noteHeading}>Notes to the annual financial statements</h4>
        <p style={styles.paragraph}>
          The notes are presented in the order of the statement line items and provide supporting information for amounts presented in the annual financial statements.
        </p>
        <p style={styles.notesCurrencyLine}>Figures are presented in South African Rand.</p>

        <div className="afs-screen-only" style={styles.statementModeToolbar}>
          <span style={styles.statementModeLabel}>Notes display</span>
          <button type="button" style={mode === "review" ? styles.methodButtonActive : styles.methodButton} onClick={() => setMode("review")}>
            Review mode
          </button>
          <button type="button" style={mode === "edit" ? styles.methodButtonActive : styles.methodButton} onClick={() => setMode("edit")}>
            Edit mode (all)
          </button>
        </div>
      </section>

      <table className="noteMasterHeader" style={styles.noteMasterHeader}>
        <colgroup>
          <col style={styles.noteColDescription} />
          <col style={styles.noteColAmount} />
          <col style={styles.noteColAmount} />
        </colgroup>
        <thead className="noteRepeatedHeader">
          <tr>
            <th style={styles.noteTh}>Description</th>
            <th style={styles.noteThRight}><YearHeader label={currentHeading} /></th>
            <th style={styles.noteThRight}><YearHeader label={priorHeading} /></th>
          </tr>
        </thead>
      </table>

      {visibleNotes.map((note) => {
        const optionKey = note.optionKey;
        const saving = savingReportOptionKey === String(optionKey);

        if (note.id === "property-plant-and-equipment") {
          return (
            <AfsPpeNoteMatrix
              key={note.id}
              noteNumber={note.number || ""}
              currentYear={currentHeading}
              priorYear={priorHeading}
              rows={buildPpeRowsFromTrialBalance(trialBalanceLines)}
              isEditMode={mode === "edit"}
              isEnabled={note.active}
              onToggle={(nextValue) => onReportOptionChange?.(optionKey, nextValue)}
            />
          );
        }

        return (
          <section
            key={note.id}
            id={note.number ? `afs-note-${note.number}` : `afs-note-control-${note.id}`}
            className={note.active ? undefined : "afs-screen-only afs-print-hide"}
            style={note.active ? styles.noteSectionAnchor : styles.noteSectionAnchorOff}
          >
            <div style={note.active ? styles.drInlineHeading : styles.drInlineHeadingOff}>
              <h4 style={note.active ? styles.reportHeading : styles.reportHeadingOff}>
                {note.number ? `${note.number}. ` : ""}{note.title}
              </h4>
              <button
                type="button"
                style={note.active ? styles.drToggleOn : styles.drToggleOff}
                onClick={() => onReportOptionChange?.(optionKey, !note.active)}
                disabled={saving}
                title={note.active ? "Switch note off" : "Switch note on"}
              >
                {saving ? "Saving" : note.active ? "On" : "Off"}
              </button>
            </div>

            {note.active ? (
              <>
                {note.description ? <p style={styles.paragraph}>{note.description}</p> : null}
                {note.extraTextKey ? (
                  <EditableDisclosureText
                    pageKey="notes"
                    sectionKey="note-text"
                    disclosureKey={note.extraTextKey}
                    text={getDisclosureText(
                      disclosureTextOverrides,
                      "notes",
                      "note-text",
                      note.extraTextKey,
                      note.extraTextDefault || ""
                    )}
                    saving={savingDisclosureTextKey === `notes::note-text::${note.extraTextKey}`}
                    onChange={onDisclosureTextChange}
                    onSave={onDisclosureTextSave}
                    onReset={onDisclosureTextReset}
                  />
                ) : null}

                <ManualNoteSplit
                  note={note}
                  currentHeading={currentHeading}
                  priorHeading={priorHeading}
                  disclosureTextOverrides={disclosureTextOverrides}
                  savingDisclosureTextKey={savingDisclosureTextKey}
                  onDisclosureTextChange={onDisclosureTextChange}
                  onDisclosureTextSave={onDisclosureTextSave}
                />
              </>
            ) : (
              <p style={styles.inactiveDisclosureText}>
                Note switched off. Turn it on here to include this disclosure and assign a note number.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

type IfrsNote = {
  id: string;
  optionKey: keyof ReportOptions;
  active: boolean;
  hasBalance: boolean;
  number: string;
  title: string;
  description?: string;
  extraTextKey?: string;
  extraTextDefault?: string;
  manualRowsKey?: string;
  rows: Array<{ label: string; current: number; prior: number; bold?: boolean }>;
};

function buildIfrsNotes({
  sfp,
  spl,
  clientSetup,
  trialBalanceLines,
  disclosureTextOverrides,
  reportOptions,
  noteKeyToNumber,
  cashUsedInOperationsNoteNumber,
}: {
  sfp: StatementLine[];
  spl: StatementLine[];
  trialBalanceLines: AfsTrialBalanceLine[];
  clientSetup?: ClientSetup | null;
  currentHeading: string;
  priorHeading: string;
  disclosureTextOverrides: Record<string, string>;
  reportOptions: ReportOptions;
  noteKeyToNumber?: Record<string, string>;
  cashUsedInOperationsNoteNumber?: string;
}): IfrsNote[] {
  const notes: IfrsNote[] = [];

  for (const config of NOTE_CONFIG) {
    const active = noteEnabled(reportOptions, config.optionKey);
    const line = config.lineKeys?.length
      ? config.lineKeys.map((key) => findLineByKey([...sfp, ...spl], key)).find(Boolean)
      : null;

    if (config.type === "cash-used") {
      notes.push({
        id: config.key,
        optionKey: config.optionKey,
        active,
        hasBalance: true,
        number: active ? cashUsedInOperationsNoteNumber || "" : "",
        title: config.title,
        description: config.description,
        manualRowsKey: config.key,
        rows: [
          {
            label: "Cash generated from / (used in) operations",
            current: cashFlowManualNumber(disclosureTextOverrides, "cash-used-operations-current", 0),
            prior: cashFlowManualNumber(disclosureTextOverrides, "cash-used-operations-prior", 0),
            bold: true,
          },
        ],
      });
      continue;
    }

    if (config.type === "share-capital") {
      const fallbackLine = line || makeBlankStatementLine("share-capital", "Share capital");
      notes.push(makeShareCapitalNote(config, fallbackLine, clientSetup, active));
      continue;
    }

    if (config.type === "taxation") {
      const fallbackLine = line || makeBlankStatementLine("taxation", "Taxation");
      notes.push(makeTaxationNote(config, fallbackLine, spl, disclosureTextOverrides, active));
      continue;
    }

    if (config.type === "current-tax") {
      const fallbackLine = line || makeBlankStatementLine(config.key, config.title);
      notes.push(makeCurrentTaxNote(config, fallbackLine, active));
      continue;
    }

    const movementNoteKeys = [
      "property-plant-and-equipment",
      "goodwill",
      "investment-property",
      "intangible-assets",
      "biological-assets",
    ];

    const lineForRows = line || makeBlankStatementLine(config.key, config.title);
    const autoSplitRows = movementNoteKeys.includes(config.key)
      ? []
      : buildAutoNoteRowsFromTrialBalance(config.key, trialBalanceLines, line || null);
    const rows = movementNoteKeys.includes(config.key)
      ? buildStandardNoteRows(config.key, lineForRows)
      : autoSplitRows.length
      ? autoSplitRows
      : line
      ? buildStandardNoteRows(config.key, line)
      : [];
    const manualRowsKey = [
      "property-plant-and-equipment",
      "goodwill",
      "investment-property",
      "intangible-assets",
      "biological-assets",
      "shareholders-loans",
      "loans-receivable",
      "trade-receivables",
      "trade-payables",
      "other-financial-liabilities",
      "other-non-current-assets",
      "cash-and-cash-equivalents",
      "inventories",
      "current-tax-receivable",
      "current-tax-payable",
      "taxation",
    ].includes(config.key)
      ? config.key
      : undefined;

    notes.push({
      id: config.key,
      optionKey: config.optionKey,
      active,
      hasBalance: noteHasBalance(rows, line || null),
      number: active ? noteKeyToNumber?.[config.key] || line?.noteNumber || "" : "",
      title: config.title,
      description: config.description,
      extraTextKey: noteTermsTextKey(config.key),
      extraTextDefault: defaultNoteTermsText(config.key),
      manualRowsKey,
      rows,
    });
  }

  return notes.map((note) => ({
    ...note,
    number: note.active ? note.number || noteKeyToNumber?.[note.id] || "" : "",
  }));
}


const PPE_CLASS_LABELS: Record<string, string> = {
  land: "Land",
  buildings: "Buildings",
  leaseholdProperty: "Leasehold property",
  plantAndMachinery: "Plant and machinery",
  furnitureAndFittings: "Furniture and fittings",
  motorVehicles: "Motor vehicles",
  officeEquipment: "Office equipment",
  itEquipment: "IT equipment",
  computerSoftware: "Computer software",
  leaseholdImprovements: "Leasehold improvements",
  rightOfUseAssets: "Right-of-use assets",
  propertyPlantEquipment1: "Property, plant and equipment 1",
  propertyPlantEquipment2: "Property, plant and equipment 2",
  otherPpe1: "Other PPE 1",
  otherPpe2: "Other PPE 2",
  capitalWorkInProgress: "Capital work in progress",
};

function buildPpeRowsFromTrialBalance(trialBalanceLines: AfsTrialBalanceLine[]): AfsPpeClassRow[] {
  const rows = Object.entries(PPE_CLASS_LABELS).map(([key, label]) => ({
    key,
    label,
    current: {},
    prior: {},
  })) as AfsPpeClassRow[];

  const rowByKey = new Map(rows.map((row) => [String(row.key), row]));

  trialBalanceLines.forEach((line) => {
    const mappingCode = clean(line.mapping_code || line.lead_schedule_number).toLowerCase();
    const leadKey = clean(line.lead_schedule_key).toLowerCase();
    const mappingLabel = clean(`${line.mapping_label || ""} ${line.mapping_section || ""}`).toLowerCase();
    const rawLine = line as any;
    const combined = clean(
      `${rawLine.account_name || ""} ${rawLine.description || ""} ${rawLine.account_code || ""} ${rawLine.mapping_label || ""}`
    ).toLowerCase();

    const isPpe =
      mappingCode === "305" ||
      mappingCode.startsWith("305.") ||
      mappingCode.startsWith("305-") ||
      leadKey.includes("property-plant") ||
      mappingLabel.includes("property, plant") ||
      mappingLabel.includes("property plant");

    if (!isPpe) return;

    const classKey =
      combined.includes("land") ? "land" :
      combined.includes("building") ? "buildings" :
      combined.includes("leasehold improvement") ? "leaseholdImprovements" :
      combined.includes("leasehold") ? "leaseholdProperty" :
      combined.includes("plant") || combined.includes("machinery") ? "plantAndMachinery" :
      combined.includes("furniture") || combined.includes("fitting") ? "furnitureAndFittings" :
      combined.includes("motor") || combined.includes("vehicle") ? "motorVehicles" :
      combined.includes("office") ? "officeEquipment" :
      combined.includes("software") ? "computerSoftware" :
      combined.includes("computer") || combined.includes(" it ") || combined.includes("it equipment") ? "itEquipment" :
      combined.includes("right-of-use") || combined.includes("right of use") ? "rightOfUseAssets" :
      combined.includes("work in progress") || combined.includes("wip") ? "capitalWorkInProgress" :
      "propertyPlantEquipment1";

    const row = rowByKey.get(classKey);
    if (!row) return;

    const currentRaw = toNumber(
      (line as any).current_year_balance ??
        (line as any).final_balance ??
        (line as any).current_balance ??
        (line as any).source_balance ??
        toNumber((line as any).debit) - toNumber((line as any).credit)
    );
    const priorRaw = toNumber((line as any).prior_year_balance ?? (line as any).prior_balance);

    const isAccumulatedDepreciation =
      combined.includes("accum") ||
      combined.includes("depreciation") ||
      combined.includes("impairment");

    if (isAccumulatedDepreciation) {
      row.current.openingAccumulatedDepreciation =
        toNumber(row.current.openingAccumulatedDepreciation) + Math.abs(currentRaw);
      row.prior.openingAccumulatedDepreciation =
        toNumber(row.prior.openingAccumulatedDepreciation) + Math.abs(priorRaw);
    } else {
      row.current.openingCost = toNumber(row.current.openingCost) + Math.abs(currentRaw);
      row.prior.openingCost = toNumber(row.prior.openingCost) + Math.abs(priorRaw);
    }
  });

  return rows;
}


function buildAutoNoteRowsFromTrialBalance(
  key: string,
  trialBalanceLines: AfsTrialBalanceLine[],
  statementLine: StatementLine | null
) {
  const splitConfig: Record<
    string,
    { prefixes: string[]; sign: "debit-positive" | "credit-positive"; totalLabel: string }
  > = {
    "property-plant-and-equipment": {
      prefixes: ["305"],
      sign: "debit-positive",
      totalLabel: "Property, plant and equipment",
    },
    "goodwill": {
      prefixes: ["321"],
      sign: "debit-positive",
      totalLabel: "Goodwill",
    },
    "investment-property": {
      prefixes: ["310"],
      sign: "debit-positive",
      totalLabel: "Investment property",
    },
    "intangible-assets": {
      prefixes: ["320"],
      sign: "debit-positive",
      totalLabel: "Intangible assets",
    },
    "biological-assets": {
      prefixes: ["330"],
      sign: "debit-positive",
      totalLabel: "Biological assets",
    },
    "shareholders-loans": {
      prefixes: ["548"],
      sign: "credit-positive",
      totalLabel: "Shareholders loans",
    },
    "loans-receivable": {
      prefixes: ["340", "348", "350"],
      sign: "debit-positive",
      totalLabel: "Loans receivable",
    },
    "other-non-current-assets": {
      prefixes: ["390"],
      sign: "debit-positive",
      totalLabel: "Other financial assets",
    },
    "inventories": {
      prefixes: ["405"],
      sign: "debit-positive",
      totalLabel: "Inventories",
    },
    "cash-and-cash-equivalents": {
      prefixes: ["420"],
      sign: "debit-positive",
      totalLabel: "Cash and cash equivalents",
    },
    "trade-receivables": {
      prefixes: ["430"],
      sign: "debit-positive",
      totalLabel: "Trade and other receivables",
    },
    "other-financial-liabilities": {
      prefixes: ["550", "551"],
      sign: "credit-positive",
      totalLabel: "Other financial liabilities",
    },
    "trade-payables": {
      prefixes: ["630"],
      sign: "credit-positive",
      totalLabel: "Trade and other payables",
    },
  };

  const config = splitConfig[key];
  if (!config) return [];

  const matches = trialBalanceLines.filter((line) => {
    const mappingCode = clean(line.mapping_code || line.lead_schedule_number).toLowerCase();
    const leadKey = clean(line.lead_schedule_key).toLowerCase();
    const mappingLabel = clean(`${line.mapping_label || ""} ${line.mapping_section || ""}`).toLowerCase();

    return config.prefixes.some((prefix) => {
      const item = prefix.toLowerCase();
      return (
        mappingCode === item ||
        mappingCode.startsWith(`${item}.`) ||
        mappingCode.startsWith(`${item}-`) ||
        leadKey.includes(item) ||
        mappingLabel.includes(item)
      );
    });
  });

  const detailRows = matches
    .map((line) => {
      const currentRaw = toNumber(line.current_year_balance ?? toNumber(line.debit) - toNumber(line.credit));
      const priorRaw = toNumber(line.prior_year_balance);
      const current = config.sign === "credit-positive" ? -currentRaw : currentRaw;
      const prior = config.sign === "credit-positive" ? -priorRaw : priorRaw;
      const rawLine = line as any;
      const label =
        clean(rawLine.account_name || rawLine.description || rawLine.mapping_label)
          .replace(/^\d+[\w\-/\.]*\s*[-–·:]\s*/i, "")
          .trim() ||
        config.totalLabel;

      return {
        label,
        current: roundForStatement(current),
        prior: roundForStatement(prior),
      };
    })
    .filter((row) => Math.abs(row.current) >= 0.005 || Math.abs(row.prior) >= 0.005);

  if (!detailRows.length) return [];

  const currentTotal = roundForStatement(
    detailRows.reduce((sum, row) => sum + toNumber(row.current), 0)
  );
  const priorTotal = roundForStatement(
    detailRows.reduce((sum, row) => sum + toNumber(row.prior), 0)
  );

  return [
    ...detailRows,
    {
      label: config.totalLabel,
      current: currentTotal || toNumber(statementLine?.current),
      prior: priorTotal || toNumber(statementLine?.prior),
      bold: true,
    },
  ];
}

function noteHasBalance(rows: Array<{ current: number; prior: number }>, line: StatementLine | null) {
  if (Math.abs(toNumber(line?.current)) >= 0.005 || Math.abs(toNumber(line?.prior)) >= 0.005) {
    return true;
  }

  return rows.some(
    (row) => Math.abs(toNumber(row.current)) >= 0.005 || Math.abs(toNumber(row.prior)) >= 0.005
  );
}

function buildStandardNoteRows(key: string, line: StatementLine) {
  if (
    [
      "property-plant-and-equipment",
      "goodwill",
      "investment-property",
      "intangible-assets",
      "biological-assets",
    ].includes(key)
  ) {
    const titleByKey: Record<string, string> = {
      "property-plant-and-equipment": "Property, plant and equipment",
      goodwill: "Goodwill",
      "investment-property": "Investment property",
      "intangible-assets": "Intangible assets",
      "biological-assets": "Biological assets",
    };

    const title = titleByKey[key] || line.label;
    const currentCarrying = toNumber(line.current);
    const priorCarrying = toNumber(line.prior);

    return [
      { label: "Cost / valuation", current: 0, prior: 0, bold: true },
      { label: "Opening cost / valuation", current: priorCarrying, prior: priorCarrying },
      { label: "Additions", current: 0, prior: 0 },
      { label: "Disposals", current: 0, prior: 0 },
      { label: "Transfers / reclassifications", current: 0, prior: 0 },
      { label: "Closing cost / valuation", current: currentCarrying, prior: priorCarrying, bold: true },
      { label: "Accumulated depreciation / amortisation / impairment", current: 0, prior: 0, bold: true },
      { label: "Opening accumulated depreciation / amortisation / impairment", current: 0, prior: 0 },
      { label: "Depreciation / amortisation for the year", current: 0, prior: 0 },
      { label: "Impairment losses", current: 0, prior: 0 },
      { label: "Disposals", current: 0, prior: 0 },
      { label: "Closing accumulated depreciation / amortisation / impairment", current: 0, prior: 0, bold: true },
      { label: "Carrying amount at end of year", current: currentCarrying, prior: priorCarrying, bold: true },
      { label: title, current: currentCarrying, prior: priorCarrying, bold: true },
    ];
  }

  if (key === "cash-and-cash-equivalents") {
    return [
      { label: "Bank balances", current: toNumber(line.current), prior: toNumber(line.prior) },
      { label: "Cash and cash equivalents", current: toNumber(line.current), prior: toNumber(line.prior), bold: true },
    ];
  }

  if (key === "inventories") {
    return [
      { label: "Finished goods / trading inventory", current: toNumber(line.current), prior: toNumber(line.prior) },
      { label: "Inventories", current: toNumber(line.current), prior: toNumber(line.prior), bold: true },
    ];
  }

  if (key === "other-non-current-assets") {
    return [
      { label: "Other financial assets at amortised cost", current: toNumber(line.current), prior: toNumber(line.prior) },
      { label: "Other financial assets", current: toNumber(line.current), prior: toNumber(line.prior), bold: true },
    ];
  }

  return [
    {
      label: line.label,
      current: toNumber(line.current),
      prior: toNumber(line.prior),
      bold: true,
    },
  ];
}


function noteTermsTextKey(noteKey: string) {
  if (
    [
      "shareholders-loans",
      "loans-receivable",
      "other-non-current-assets",
      "trade-receivables",
      "trade-payables",
      "other-financial-liabilities",
      "cash-and-cash-equivalents",
      "inventories",
      "current-tax-receivable",
      "current-tax-payable",
      "taxation",
      "share-capital",
    ].includes(noteKey)
  ) {
    return `${noteKey}-terms`;
  }

  return undefined;
}

function defaultNoteTermsText(noteKey: string) {
  const defaults: Record<string, string> = {
    "shareholders-loans":
      "The loans are unsecured, bear no interest and have no fixed repayment terms, unless otherwise disclosed.",
    "loans-receivable":
      "The loans are unsecured, bear no interest and have no fixed repayment terms, unless otherwise disclosed.",
    "other-non-current-assets":
      "The main terms and conditions of other financial assets are disclosed where applicable.",
    "trade-receivables":
      "Trade and other receivables are unsecured, interest free and expected to be recovered in the normal operating cycle, unless otherwise disclosed.",
    "trade-payables":
      "Trade and other payables are unsecured, interest free and payable in the normal operating cycle, unless otherwise disclosed.",
    "other-financial-liabilities":
      "The main terms and conditions of other financial liabilities are disclosed where applicable.",
    "cash-and-cash-equivalents":
      "Cash and cash equivalents are available for use by the entity unless specific restrictions are disclosed.",
    inventories:
      "Inventories are stated after taking account of write-downs to net realisable value where applicable.",
    "current-tax-receivable":
      "Current tax balances are subject to assessment by the South African Revenue Service.",
    "current-tax-payable":
      "Current tax balances are subject to assessment by the South African Revenue Service.",
    taxation:
      "The income tax rate used is the rate applicable to the entity for the year of assessment. Permanent differences, prior year adjustments and exempt income are disclosed where applicable.",
    "share-capital":
      "The ordinary shares rank pari passu in all respects. Details of rights, preferences, restrictions and capital management matters are disclosed where applicable.",
  };

  return defaults[noteKey];
}


function ManualNoteSplit({
  note,
  currentHeading,
  priorHeading,
  disclosureTextOverrides,
  savingDisclosureTextKey,
  onDisclosureTextChange,
  onDisclosureTextSave,
}: {
  note: IfrsNote;
  currentHeading: string;
  priorHeading: string;
  disclosureTextOverrides: Record<string, string>;
  savingDisclosureTextKey?: string;
  onDisclosureTextChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onDisclosureTextSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
}) {
  const manualKey = note.manualRowsKey ? `${note.manualRowsKey}-manual-rows` : "";
  const overrideKey = manualKey ? `notes::manual-rows::${manualKey}` : "";
  const initialRows = note.rows.length ? note.rows : [{ label: note.title, current: 0, prior: 0, bold: true }];
  const storedRows = manualKey ? parseManualNoteRows(disclosureTextOverrides[overrideKey], initialRows) : initialRows;
  const [draftRows, setDraftRows] = useState(storedRows);

  useEffect(() => {
    setDraftRows(storedRows);
    // reset only when the note changes; do not reset on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, overrideKey]);

  const manualRows = manualKey ? draftRows : storedRows;
  const saving = savingDisclosureTextKey === overrideKey;
  const isExpandedNote = [
    "share-capital",
    "taxation",
    "current-tax-receivable",
    "current-tax-payable",
    "shareholders-loans",
    "loans-receivable",
    "trade-receivables",
    "trade-payables",
    "other-financial-liabilities",
    "other-non-current-assets",
  ].includes(note.id);

  const updateRows = (rows: Array<{ label: string; current: number; prior: number; bold?: boolean }>) => {
    if (!manualKey) return;
    setDraftRows(rows);
  };

  const addRow = () => {
    const rowsWithoutTotal = manualRows.filter((row) => !row.bold);
    const detailRows = [...rowsWithoutTotal, { label: "New line", current: 0, prior: 0 }];
    updateRows([
      ...detailRows,
      {
        label: note.title,
        current: detailRows.reduce((sum, row) => sum + toNumber(row.current), 0),
        prior: detailRows.reduce((sum, row) => sum + toNumber(row.prior), 0),
        bold: true,
      },
    ]);
  };

  const updateRow = (index: number, field: "label" | "current" | "prior", value: string) => {
    const next = manualRows.map((row, rowIndex) =>
      rowIndex === index
        ? {
            ...row,
            [field]: field === "label" ? value : parseFlexibleNumber(value),
          }
        : row
    );
    const detailRows = next.filter((row) => !row.bold);
    const totalRowIndex = next.findIndex((row) => row.bold);
    if (totalRowIndex >= 0 && detailRows.length > 0) {
      next[totalRowIndex] = {
        ...next[totalRowIndex],
        current: detailRows.reduce((sum, row) => sum + toNumber(row.current), 0),
        prior: detailRows.reduce((sum, row) => sum + toNumber(row.prior), 0),
      };
    }
    updateRows(next);
  };

  const removeRow = (index: number) => {
    const next = manualRows.filter((_, rowIndex) => rowIndex !== index);
    updateRows(next.length ? next : initialRows);
  };

  const saveRows = async () => {
    if (!manualKey) return;
    const payload = JSON.stringify(manualRows);
    onDisclosureTextChange?.("notes", "manual-rows", manualKey, payload);
    await onDisclosureTextSave?.("notes", "manual-rows", manualKey, payload);
  };

  return (
    <div>
      {isExpandedNote ? null : null}

      <table style={styles.noteStatementTable}>
        <colgroup>
          <col style={styles.noteColDescription} />
          <col style={styles.noteColAmount} />
          <col style={styles.noteColAmount} />
          {manualKey ? <col className="print-edit-col" style={{ width: "70px" }} /> : null}
        </colgroup>
        <thead className="noteRepeatedHeader">
          <tr>
            <th style={styles.noteTh}>Description</th>
            <th style={styles.noteThRight}><YearHeader label={currentHeading} /></th>
            <th style={styles.noteThRight}><YearHeader label={priorHeading} /></th>
            {manualKey ? <th className="print-edit-col" style={styles.noteThRight}>Edit</th> : null}
          </tr>
        </thead>
        <tbody>
          {manualRows.map((row, index) => {
            const isLoanTermsNote = note.id === "shareholders-loans" || note.id === "loans-receivable";
            const termKey = `${manualKey}-loan-term-${index}`;
            const termStorageKey = `notes::loan-terms::${termKey}`;
            const termValue =
              disclosureTextOverrides[termStorageKey] ??
              (note.id === "shareholders-loans"
                ? "Unsecured, interest free and with no fixed repayment terms."
                : "Terms and repayment conditions to be disclosed.");
            const savingTerm = savingDisclosureTextKey === termStorageKey;

            return (
              <Fragment key={`${note.id}-${index}`}>
                <tr>
                  <td className={row.bold ? "noteTotalLabel" : "noteTd"} style={row.bold ? styles.noteTotalLabel : styles.noteTd}>
                    {manualKey && !row.bold ? (
                      <input
                        value={row.label}
                        onChange={(event) => updateRow(index, "label", event.target.value)}
                        onKeyDown={stopEditorKeyboardShortcuts}
                        style={styles.noteLineInput}
                      />
                    ) : row.label}
                  </td>
                  <td className={row.bold ? "noteTotalAmount" : "noteAmount"} style={row.bold ? styles.noteTotalAmount : styles.noteAmount}>
                    {formatAmount(row.current)}
                  </td>
                  <td className={row.bold ? "noteTotalAmount" : "noteAmount"} style={row.bold ? styles.noteTotalAmount : styles.noteAmount}>
                    {formatAmount(row.prior)}
                  </td>
                  {manualKey ? (
                    <td className="print-edit-col" style={styles.noteAmount}>
                      {!row.bold ? (
                        <button type="button" style={styles.inlineEditSmallButton} onClick={() => removeRow(index)}>
                          Remove
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>

                {isLoanTermsNote && !row.bold ? (
                  <tr>
                    <td className="loanTermsInlineCombined" style={styles.loanTermsInlineCombined}>
                      <div className="loanTermsInlineLabel" style={styles.loanTermsInlineLabel}>Terms</div>
                      <input
                        value={termValue}
                        onChange={(event) => onDisclosureTextChange?.("notes", "loan-terms", termKey, event.target.value)}
                        onKeyDown={stopEditorKeyboardShortcuts}
                        className="loanTermsInput"
                        style={styles.loanTermsInput}
                      />
                    </td>
                    <td className="noteAmount" style={styles.noteAmount}></td>
                    <td className="noteAmount" style={styles.noteAmount}></td>
                    {manualKey ? (
                      <td className="print-edit-col" style={styles.loanTermsAction}>
                        <button
                          type="button"
                          style={styles.inlineEditSmallButton}
                          onClick={() => onDisclosureTextSave?.("notes", "loan-terms", termKey, termValue)}
                          disabled={savingTerm}
                        >
                          {savingTerm ? "Saving..." : "Save"}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {manualKey ? (
        <div style={styles.noteEditorActions}>
          <button type="button" style={styles.inlineEditSmallButton} onClick={addRow}>
            Add line
          </button>
          <button type="button" style={styles.inlineEditorButton} onClick={saveRows} disabled={saving}>
            {saving ? "Saving..." : "Save note split"}
          </button>
        </div>
      ) : null}
    </div>
  );
}


function LoanTermsPerLine({
  note,
  rows,
  manualKey,
  disclosureTextOverrides,
  savingDisclosureTextKey,
  onDisclosureTextChange,
  onDisclosureTextSave,
}: {
  note: IfrsNote;
  rows: Array<{ label: string; current: number; prior: number; bold?: boolean }>;
  manualKey: string;
  disclosureTextOverrides: Record<string, string>;
  savingDisclosureTextKey?: string;
  onDisclosureTextChange?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value: string
  ) => void;
  onDisclosureTextSave?: (
    pageKey: string,
    sectionKey: string,
    disclosureKey: string,
    value?: string
  ) => void | Promise<void>;
}) {
  if (!manualKey || !rows.length) return null;

  const defaultTerms =
    note.id === "shareholders-loans"
      ? "Unsecured, interest free and with no fixed repayment terms."
      : "Terms and repayment conditions to be disclosed.";

  return (
    <div style={styles.loanTermsBlock}>
      <p className="afs-screen-only" style={styles.loanTermsTitle}>Terms and conditions per loan line</p>
      <table style={styles.loanTermsTable}>
        <tbody>
          {rows.map((row, index) => {
            const key = `${manualKey}-loan-term-${index}`;
            const storageKey = `notes::loan-terms::${key}`;
            const value = disclosureTextOverrides[storageKey] ?? defaultTerms;
            const saving = savingDisclosureTextKey === storageKey;

            return (
              <tr key={key}>
                <td style={styles.loanTermsName}>{row.label}</td>
                <td style={styles.loanTermsText}>
                  <input
                    value={value}
                    onChange={(event) => onDisclosureTextChange?.("notes", "loan-terms", key, event.target.value)}
                    style={styles.loanTermsInput}
                  />
                </td>
                <td className="afs-screen-only" style={styles.loanTermsAction}>
                  <button
                    type="button"
                    style={styles.inlineEditSmallButton}
                    onClick={() => onDisclosureTextSave?.("notes", "loan-terms", key, value)}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save terms"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function parseManualNoteRows(
  value: string | undefined,
  fallback: Array<{ label: string; current: number; prior: number; bold?: boolean }>
) {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback;

    return parsed
      .map((row) => ({
        label: clean(row?.label) || "Line",
        current: parseFlexibleNumber(row?.current),
        prior: parseFlexibleNumber(row?.prior),
        bold: Boolean(row?.bold),
      }))
      .filter((row) => row.label);
  } catch {
    return fallback;
  }
}

function formatPlainNumber(value: number) {
  const numericValue = toNumber(value);
  if (numericValue === 0) return "0";
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function makeBlankStatementLine(key: string, label: string): StatementLine {
  return {
    key,
    label,
    current: 0,
    prior: 0,
  };
}

function makeTaxationNote(
  config: (typeof NOTE_CONFIG)[number],
  line: StatementLine,
  spl: StatementLine[],
  disclosureTextOverrides: Record<string, string>,
  active = true
): IfrsNote {
  const profitBeforeTax = findNestedLineTotal(spl, ["profit / (loss) before taxation", "profit before taxation", "loss before taxation"]);
  const taxRate = parseFlexibleNumber(disclosureTextOverrides["notes::tax::statutory-rate"] || "27");
  const taxAtStandardRateCurrent = roundForStatement((toNumber(profitBeforeTax.current) * taxRate) / 100);
  const taxAtStandardRatePrior = roundForStatement((toNumber(profitBeforeTax.prior) * taxRate) / 100);

  return {
    id: "taxation",
    optionKey: config.optionKey,
    active,
    hasBalance: noteHasBalance([{ current: toNumber(line.current), prior: toNumber(line.prior) }], line),
    number: active ? line.noteNumber || "" : "",
    title: "Taxation",
    description: config.description,
    manualRowsKey: "taxation",
    rows: [
      { label: "Tax expense components", current: 0, prior: 0, bold: true },
      { label: "Current tax - current year", current: toNumber(line.current), prior: toNumber(line.prior) },
      { label: "Current tax - prior year over / (under) provision", current: 0, prior: 0 },
      { label: "Deferred tax - current year", current: 0, prior: 0 },
      { label: "Deferred tax - prior year over / (under) provision", current: 0, prior: 0 },
      { label: "Withholding tax / other taxes", current: 0, prior: 0 },
      { label: "Taxation", current: toNumber(line.current), prior: toNumber(line.prior), bold: true },
      { label: "Reconciliation of tax expense", current: 0, prior: 0, bold: true },
      { label: "Accounting profit / (loss) before taxation", current: toNumber(profitBeforeTax.current), prior: toNumber(profitBeforeTax.prior) },
      { label: `Tax at the applicable rate (${taxRate || 27}%)`, current: taxAtStandardRateCurrent, prior: taxAtStandardRatePrior },
      { label: "Tax effect of exempt income", current: 0, prior: 0 },
      { label: "Tax effect of non-deductible expenses", current: 0, prior: 0 },
      { label: "Capital gains tax / other permanent differences", current: 0, prior: 0 },
      { label: "Prior year adjustments", current: 0, prior: 0 },
      { label: "Temporary differences not recognised", current: 0, prior: 0 },
      { label: "Tax losses utilised / created", current: 0, prior: 0 },
      { label: "Taxation per statement of comprehensive income", current: toNumber(line.current), prior: toNumber(line.prior), bold: true },
    ],
  };
}

function makeCurrentTaxNote(
  config: (typeof NOTE_CONFIG)[number],
  line: StatementLine,
  active = true
): IfrsNote {
  return {
    id: config.key,
    optionKey: config.optionKey,
    active,
    hasBalance: noteHasBalance([{ current: toNumber(line.current), prior: toNumber(line.prior) }], line),
    number: active ? line.noteNumber || "" : "",
    title: config.title,
    description: config.description,
    manualRowsKey: config.key,
    rows: [
      { label: "Opening balance", current: toNumber(line.prior), prior: 0 },
      { label: "Normal tax - current year", current: 0, prior: 0 },
      { label: "Normal tax - prior year over / (under) provision", current: 0, prior: 0 },
      { label: "Provisional tax payments", current: 0, prior: 0 },
      { label: "Withholding tax / other tax credits", current: 0, prior: 0 },
      { label: "Income tax paid", current: 0, prior: 0 },
      { label: "Refunds received", current: 0, prior: 0 },
      { label: "Interest and penalties", current: 0, prior: 0 },
      { label: "Current tax receivable", current: Math.max(toNumber(line.current), 0), prior: Math.max(toNumber(line.prior), 0) },
      { label: "Current tax payable", current: Math.min(toNumber(line.current), 0), prior: Math.min(toNumber(line.prior), 0) },
      { label: config.title, current: toNumber(line.current), prior: toNumber(line.prior), bold: true },
    ],
  };
}

function makeShareCapitalNote(
  config: (typeof NOTE_CONFIG)[number],
  line: StatementLine,
  clientSetup?: ClientSetup | null,
  active = true
): IfrsNote {
  const authorisedShares = parseFlexibleNumber(clean(clientSetup?.authorised_ordinary_shares));
  const authorisedParValue = parseFlexibleNumber(clean(clientSetup?.authorised_ordinary_share_par_value));
  const issuedShares = parseFlexibleNumber(clean(clientSetup?.issued_ordinary_shares));
  const issuedParValue = parseFlexibleNumber(clean(clientSetup?.issued_ordinary_share_par_value));

  const authorisedAmount = authorisedShares && authorisedParValue
    ? authorisedShares * authorisedParValue
    : toNumber(line.current);
  const issuedAmount = issuedShares && issuedParValue
    ? issuedShares * issuedParValue
    : toNumber(line.current);

  return {
    id: "share-capital",
    optionKey: config.optionKey,
    active,
    hasBalance: true,
    number: active ? line.noteNumber || "" : "",
    title: "Share capital",
    description: "Share capital is disclosed by class, authorised shares and issued shares where applicable.",
    manualRowsKey: "share-capital",
    rows: [
      { label: "Authorised share capital", current: 0, prior: 0, bold: true },
      {
        label: `Ordinary shares${authorisedShares ? ` (${formatPlainNumber(authorisedShares)} shares)` : ""}`,
        current: authorisedAmount,
        prior: authorisedAmount,
      },
      { label: "No par value shares", current: 0, prior: 0 },
      { label: "Preference shares", current: 0, prior: 0 },
      { label: "Other authorised shares", current: 0, prior: 0 },
      { label: "Reconciliation of number of shares issued", current: 0, prior: 0, bold: true },
      {
        label: "Shares at beginning of year",
        current: issuedShares || 0,
        prior: issuedShares || 0,
      },
      { label: "Shares issued during the year", current: 0, prior: 0 },
      { label: "Shares bought back / cancelled during the year", current: 0, prior: 0 },
      {
        label: "Shares at end of year",
        current: issuedShares || 0,
        prior: issuedShares || 0,
      },
      { label: "Issued share capital", current: 0, prior: 0, bold: true },
      {
        label: `Ordinary shares issued${issuedShares ? ` (${formatPlainNumber(issuedShares)} shares)` : ""}`,
        current: issuedAmount,
        prior: toNumber(line.prior),
      },
      { label: "Share premium / other equity reserve", current: 0, prior: 0 },
      { label: "Treasury shares", current: 0, prior: 0 },
      {
        label: "Share capital",
        current: toNumber(line.current),
        prior: toNumber(line.prior),
        bold: true,
      },
    ],
  };
}

function flattenNoteRows(lines: StatementLine[]) {
  const rows: Array<{ noteNumber: string; label: string; current: number; prior: number }> = [];

  function walk(line: StatementLine) {
    if (line.noteNumber && !line.isTotal && !line.isSubtotal) {
      rows.push({
        noteNumber: line.noteNumber,
        label: line.label,
        current: line.current,
        prior: line.prior,
      });
    }

    (line.children || []).forEach(walk);
  }

  lines.forEach(walk);

  return rows.filter(
    (row, index, allRows) =>
      allRows.findIndex((other) => other.noteNumber === row.noteNumber) === index
  );
}

function noteNumberForLabel(label: string) {
  const lower = label.toLowerCase();

  if (lower.includes("inventor")) return "3";
  if (lower.includes("cash") || lower.includes("bank")) return "4";
  if (lower.includes("share capital") || lower.includes("issued")) return "5";
  if (lower.includes("shareholder") || lower.includes("loan")) return "6";
  if (lower.includes("tax")) return "7";
  if (lower.includes("receivable") || lower.includes("equipment") || lower.includes("asset")) return "2";

  return "";
}

function calculateShareAmount(numberOfShares: string, parValue: string) {
  const shares = Number(String(numberOfShares || "").replace(/[^0-9.-]/g, ""));
  const value = Number(String(parValue || "").replace(/[^0-9.-]/g, ""));

  if (!Number.isFinite(shares) || !Number.isFinite(value) || shares === 0 || value === 0) {
    return "";
  }

  return formatAmount(shares * value);
}

function getDisclosureText(
  overrides: Record<string, string>,
  pageKey: string,
  sectionKey: string,
  disclosureKey: string,
  fallback: string
) {
  const override = clean(overrides[`${pageKey}::${sectionKey}::${disclosureKey}`]);
  return override || fallback;
}

function getDisclosureTextOverride(
  overrides: Record<string, string>,
  disclosureKey: string,
  fallback: string
) {
  const override = clean(
    overrides[`directors-report::directors-report::${disclosureKey}`]
  );

  return override || fallback;
}

function clean(value: any) {
  const text = String(value || "").trim();
  return text || "";
}

function toNumber(value: any) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundForStatement(value: number) {
  return Math.round(toNumber(value) * 100) / 100;
}

function formatAmount(value: number) {
  const amount = toNumber(value);
  if (amount === 0) return "-";

  const rounded = Math.round(Math.abs(amount));
  const formatted = new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
    .format(rounded)
    .replace(/,/g, " ");

  return amount < 0 ? `(${formatted})` : formatted;
}

function findSectionTotal(sections: StatementLine[], terms: string[]) {
  const found = sections.find((section) => {
    const label = section.label.toLowerCase();
    return terms.some((term) => label.includes(term));
  });

  return {
    current: toNumber(found?.current),
    prior: toNumber(found?.prior),
  };
}

function findLineByKey(sections: StatementLine[], key: string): StatementLine | null {
  const stack = [...sections];

  while (stack.length > 0) {
    const line = stack.shift();
    if (!line) continue;

    if (line.key === key) {
      return line;
    }

    if (line.children?.length) {
      stack.push(...line.children);
    }
  }

  return null;
}

function findNestedLineTotal(sections: StatementLine[], terms: string[]) {
  const stack = [...sections];

  while (stack.length > 0) {
    const line = stack.shift();
    if (!line) continue;

    const label = line.label.toLowerCase();

    if (terms.some((term) => label.includes(term))) {
      return {
        current: toNumber(line.current),
        prior: toNumber(line.prior),
      };
    }

    if (line.children?.length) {
      stack.push(...line.children);
    }
  }

  return { current: 0, prior: 0 };
}

function joinAddress(setup: ClientSetup | null | undefined, prefix: "registered_office" | "physical_address") {
  if (!setup) return "";

  return [
    setup[`${prefix}_line_1`],
    setup[`${prefix}_line_2`],
    setup[`${prefix}_city`],
    setup[`${prefix}_province`],
    setup[`${prefix}_postal_code`],
  ]
    .map(clean)
    .filter(Boolean)
    .join("\n");
}

function shortFinancialHeading(label: string) {
  const text = String(label || "").trim();
  const years = text.match(/\b(19|20)\d{2}\b/g);

  if (years?.length) {
    return years[years.length - 1];
  }

  return text || "Year";
}

function YearHeader({ label }: { label: string }) {
  return (
    <span style={styles.yearHeaderWrap}>
      <span>{shortFinancialHeading(label)}</span>
      <span style={styles.currencyHeader}>R</span>
    </span>
  );
}

function makeCurrentPeriodHeading(financialYearEnd: string) {
  if (!financialYearEnd) return "Current year";
  return `Year ended ${formatDateLong(financialYearEnd)}`;
}

function makePriorPeriodHeading(financialYearEnd: string) {
  if (!financialYearEnd) return "Prior year";

  const date = new Date(financialYearEnd);
  if (Number.isNaN(date.getTime())) return "Prior year";

  date.setFullYear(date.getFullYear() - 1);
  return `Year ended ${formatDateLong(date.toISOString().slice(0, 10))}`;
}

function formatDateLong(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function splitParagraphs(text: string): string[] {
  return String(text || "")
    .split(/\n\s*\n/g)
    .map((paragraph: string) => paragraph.trim())
    .filter((paragraph: string) => paragraph.length > 0);
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    color: "#111827",
    fontSize: "15px",
    display: "grid",
    gap: "10px",
  },
  stickyNav: {
    position: "sticky",
    top: "0px",
    zIndex: 30,
    maxWidth: "980px",
    width: "100%",
    margin: "0 auto",
    background: "#eef4fb",
    padding: "6px 0",
  },
  quickNavRow: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "6px",
    display: "flex",
    gap: "5px",
    flexWrap: "wrap",
  },
  quickNavButton: {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "4px 7px",
    fontSize: "14.5px",
    fontWeight: 850,
    cursor: "pointer",
  },
  printToolbar: {
    width: "100%",
    maxWidth: "980px",
    margin: "0 auto 8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "8px 10px",
  },
  printToolbarTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  printToolbarText: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 650,
  },
  printToolbarActions: {
    display: "flex",
    gap: "6px",
  },
  printDraftButton: {
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    color: "#92400e",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
  },
  printFinalButton: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
  },
  afsWorkspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 980px)",
    gap: "10px",
    justifyContent: "center",
    alignItems: "start",
  },
  optionsSidebar: {
    position: "sticky",
    top: "52px",
    alignSelf: "start",
    maxHeight: "calc(100vh - 70px)",
    overflow: "auto",
  },
  optionsPanel: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "8px 9px",
    display: "grid",
    gap: "10px",
  },
  optionsHeader: {
    display: "grid",
    gap: "2px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "6px",
  },
  optionGroup: {
    display: "grid",
    gap: "5px",
    borderBottom: "1px solid #edf2f7",
    paddingBottom: "8px",
  },
  optionGroupTitle: {
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: 900,
  },
  optionsGrid: {
    display: "grid",
    gap: "5px",
  },
  subOptionsGrid: {
    display: "grid",
    gap: "5px",
  },
  optionCheck: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    color: "#334155",
    fontSize: "15px",
    fontWeight: 750,
  },
  documentStack: {
    display: "grid",
    gap: "14px",
    justifyItems: "center",
  },
  afsPage: {
    position: "relative",
    width: "100%",
    maxWidth: "900px",
    minHeight: "930px",
    background: "#ffffff",
    border: "1px solid #b8c7dc",
    padding: "38px 50px 42px",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    scrollMarginTop: "90px",
    boxShadow: "none",
    boxSizing: "border-box",
  },
  casewareHeader: {
    border: "1px solid #94a3b8",
    color: "#0058ff",
    fontWeight: 900,
    padding: "4px 6px",
    fontSize: "14.5px",
    marginBottom: "14px",
  },
  afsPageEntityHeader: {
    margin: "0 0 18px",
    paddingBottom: "7px",
    borderBottom: "2px solid #111827",
  },
  afsPageEntityName: {
    margin: "0",
    color: "#111827",
    fontSize: "17px",
    lineHeight: 1.15,
    fontWeight: 900,
  },
  afsPageEntityLine: {
    margin: "2px 0 0",
    color: "#111827",
    fontSize: "12px",
    lineHeight: 1.25,
    fontWeight: 650,
  },
  pageTitle: {
    margin: "0 0 13px",
    fontSize: "21px",
    lineHeight: 1.15,
    fontWeight: 900,
    borderBottom: "2px solid #111827",
    paddingBottom: "8px",
  },
  pageContent: {
    minHeight: 0,
  },
  pageFooter: {
    display: "none",
  },
  coverPageInner: {
    height: "100%",
    minHeight: "760px",
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    paddingTop: "0",
    gap: "10px",
    textAlign: "center",
  },
  logoBox: {
    width: "74px",
    height: "74px",
    border: "2px solid #1e3a8a",
    display: "grid",
    placeItems: "center",
    color: "#1e3a8a",
    fontSize: "9px",
    fontWeight: 900,
    lineHeight: 1.2,
  },
  coverTitle: {
    margin: "4px 0 0",
    fontSize: "12.5px",
    lineHeight: 1.05,
    fontWeight: 900,
  },
  coverLine: {
    margin: "0.5px 0",
    fontSize: "12px",
    lineHeight: 1.18,
  },
  coverSmall: {
    margin: "16px 0 0",
    color: "#0f172a",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  infoTable: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  infoLabel: {
    width: "250px",
    padding: "9px 7px",
    color: "#111827",
    fontWeight: 900,
    borderBottom: "0",
    verticalAlign: "top",
    fontSize: "15px",
  },
  infoValue: {
    padding: "9px 7px",
    borderBottom: "0",
    verticalAlign: "top",
    whiteSpace: "pre-line",
    fontSize: "15px",
  },
  indexTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  indexLabel: {
    padding: "8px 0",
    width: "380px",
    borderBottom: "0",
    fontSize: "15px",
  },
  indexDots: {
    borderBottom: "0",
  },
  indexPage: {
    width: "40px",
    textAlign: "right",
    padding: "7px 0 7px 8px",
    borderBottom: "0",
    fontWeight: 900,
  },
  paragraph: {
    margin: "0 0 5px",
    fontSize: "12.8px",
    lineHeight: 1.24,
    textAlign: "justify",
  },
  compilationReportBody: {
    minHeight: "100%",
    paddingBottom: "0",
  },
  compilationLetterheadTop: {
    margin: "0 0 16px",
    minHeight: "0",
    width: "100%",
  },
  compilationHeaderImage: {
    width: "100%",
    maxWidth: "100%",
    height: "auto",
    maxHeight: "4.44cm",
    objectFit: "contain",
    objectPosition: "left top",
    display: "block",
  },
  compilationLetterheadBottom: {
    marginTop: "auto",
    paddingTop: "8px",
    borderTop: "0",
    width: "100%",
  },
  compilationFooterImage: {
    width: "100%",
    maxWidth: "100%",
    height: "auto",
    maxHeight: "4.44cm",
    objectFit: "contain",
    objectPosition: "left bottom",
    display: "block",
  },
  reportTitle: {
    margin: "0 0 10px",
    fontSize: "16px",
    fontWeight: 900,
    textTransform: "uppercase",
  },
  reportBlock: {
    marginBottom: "7px",
  },
  reportHeading: {
    margin: "0 0 2px",
    fontSize: "12.6px",
    fontWeight: 900,
    color: "#111827",
  },
  taxComputationSettings: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    margin: "0 0 10px",
    padding: "6px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  taxComputationRateLabel: {
    color: "#334155",
    fontSize: "15px",
    fontWeight: 900,
  },
  taxComputationRateInput: {
    width: "60px",
    border: "1px solid #cbd5e1",
    padding: "3px 5px",
    textAlign: "right",
    fontSize: "15px",
    fontFamily: "inherit",
  },
  taxComputationTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "15px",
    color: "#0f172a",
  },
  taxComputationDescriptionCol: {
    width: "auto",
  },
  taxComputationAmountCol: {
    width: "92px",
  },
  taxComputationActionCol: {
    width: "70px",
  },
  taxComputationTh: {
    textAlign: "left",
    borderTop: "2px solid #111827",
    borderBottom: "1px solid #94a3b8",
    padding: "6px 7px",
    color: "#1e293b",
    fontWeight: 900,
  },
  taxComputationThRight: {
    textAlign: "right",
    borderTop: "2px solid #111827",
    borderBottom: "1px solid #94a3b8",
    padding: "6px 7px",
    color: "#1e293b",
    fontWeight: 900,
  },
  taxComputationTd: {
    padding: "4px 7px",
    borderBottom: "1px solid #eef2f7",
  },
  taxComputationAmount: {
    padding: "4px 7px",
    borderBottom: "1px solid #eef2f7",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  taxComputationAction: {
    padding: "4px 7px",
    borderBottom: "1px solid #eef2f7",
    textAlign: "right",
  },
  taxComputationTotalLabel: {
    padding: "6px 7px",
    borderTop: "1px solid #111827",
    fontWeight: 900,
  },
  taxComputationTotalAmount: {
    padding: "6px 7px",
    borderTop: "1px solid #111827",
    textAlign: "right",
    fontWeight: 900,
  },
  taxComputationCheckLabel: {
    padding: "6px 7px",
    borderTop: "1px solid #cbd5e1",
    fontWeight: 850,
  },
  taxComputationCheckAmount: {
    padding: "6px 7px",
    borderTop: "1px solid #cbd5e1",
    textAlign: "right",
    fontWeight: 850,
  },
  taxComputationDifferenceLabel: {
    padding: "6px 7px",
    borderTop: "1px solid #ef4444",
    color: "#b91c1c",
    fontWeight: 900,
  },
  taxComputationDifferenceAmount: {
    padding: "6px 7px",
    borderTop: "1px solid #ef4444",
    textAlign: "right",
    color: "#b91c1c",
    fontWeight: 900,
  },
  taxComputationFinalLabel: {
    padding: "7px 7px",
    borderTop: "2px solid #111827",
    borderBottom: "3px double #111827",
    fontWeight: 900,
  },
  taxComputationFinalAmount: {
    padding: "7px 7px",
    borderTop: "2px solid #111827",
    borderBottom: "3px double #111827",
    textAlign: "right",
    fontWeight: 900,
  },
  detailedSubheading: {
    margin: "0 0 10px",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 750,
  },
  detailedIncomeTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "15px",
    color: "#0f172a",
  },
  detailedIncomeDescriptionCol: {
    width: "auto",
  },
  detailedIncomeAmountCol: {
    width: "92px",
  },
  detailedIncomeTh: {
    textAlign: "left",
    borderTop: "2px solid #111827",
    borderBottom: "1px solid #94a3b8",
    padding: "6px 7px",
    color: "#1e293b",
    fontWeight: 900,
  },
  detailedIncomeThRight: {
    textAlign: "right",
    borderTop: "2px solid #111827",
    borderBottom: "1px solid #94a3b8",
    padding: "6px 7px",
    color: "#1e293b",
    fontWeight: 900,
  },
  detailedIncomeSectionHeading: {
    padding: "10px 7px 5px",
    color: "#0f172a",
    fontWeight: 900,
    borderBottom: "1px solid #dbe3ef",
  },
  detailedIncomeDescription: {
    padding: "4px 7px",
    borderBottom: "1px solid #eef2f7",
  },
  detailedIncomeAmount: {
    padding: "4px 7px",
    borderBottom: "1px solid #eef2f7",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  detailedIncomeSubtotalLabel: {
    padding: "5px 7px",
    borderTop: "1px solid #111827",
    fontWeight: 900,
  },
  detailedIncomeSubtotalAmount: {
    padding: "5px 7px",
    borderTop: "1px solid #111827",
    textAlign: "right",
    fontWeight: 900,
  },
  detailedIncomeTotalLabel: {
    padding: "8px 7px 5px",
    borderTop: "1px solid #111827",
    fontWeight: 900,
  },
  detailedIncomeTotalAmount: {
    padding: "8px 7px 5px",
    borderTop: "1px solid #111827",
    textAlign: "right",
    fontWeight: 900,
  },
  detailedIncomeFinalLabel: {
    padding: "8px 7px 5px",
    borderTop: "2px solid #111827",
    borderBottom: "3px double #111827",
    fontWeight: 900,
  },
  detailedIncomeFinalAmount: {
    padding: "8px 7px 5px",
    borderTop: "2px solid #111827",
    borderBottom: "3px double #111827",
    textAlign: "right",
    fontWeight: 900,
  },
  statementTable: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "15px",
  },
  statementColDescription: {
    width: "58%",
  },
  statementColNote: {
    width: "8%",
  },
  statementColAmount: {
    width: "17%",
  },
  statementTh: {
    textAlign: "left",
    borderTop: "2px solid #111827",
    borderBottom: "1px solid #111827",
    padding: "5px 7px 6px",
    fontWeight: 900,
    color: "#334155",
  },
  statementThNote: {
    textAlign: "center",
    borderTop: "2px solid #111827",
    borderBottom: "1px solid #111827",
    padding: "5px 7px 6px",
    fontWeight: 900,
    color: "#334155",
  },
  statementThRight: {
    textAlign: "right",
    borderTop: "2px solid #111827",
    borderBottom: "1px solid #111827",
    padding: "5px 0 6px 7px",
    fontWeight: 900,
    color: "#334155",
    verticalAlign: "bottom",
  },
  yearHeaderWrap: {
    display: "inline-grid",
    minWidth: "86px",
    width: "fit-content",
    marginLeft: "auto",
    justifyItems: "center",
    textAlign: "center",
    lineHeight: 1.05,
  },
  currencyHeader: {
    display: "block",
    width: "100%",
    fontSize: "9.5px",
    fontWeight: 900,
    textAlign: "center",
    lineHeight: 1.05,
    color: "#0f172a",
  },
  statementWarningBox: {
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    color: "#92400e",
    padding: "8px 10px",
    marginBottom: "10px",
    display: "grid",
    gap: "4px",
    fontSize: "15px",
    lineHeight: 1.35,
  },

  socieToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "8px",
    padding: "5px 0",
    fontSize: "14.5px",
    color: "#475569",
  },
  socieToolbarActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  socieInput: {
    width: "86px",
    border: "1px solid #93c5fd",
    background: "#ffffff",
    color: "#0f172a",
    padding: "3px 5px",
    fontSize: "14.5px",
    textAlign: "right",
    fontFamily: "inherit",
    fontVariantNumeric: "tabular-nums",
    outline: "none",
  },
  socieTable: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "15px",
  },
  socieColDescription: {
    width: "46%",
  },
  socieColAmount: {
    width: "18%",
  },
  socieHeaderRight: {
    textAlign: "center",
    borderTop: "2px solid #111827",
    borderBottom: "1px solid #111827",
    padding: "5px 7px 6px",
    fontWeight: 900,
    color: "#334155",
    verticalAlign: "bottom",
    lineHeight: 1.15,
  },
  socieLabel: {
    padding: "4px 7px",
    color: "#111827",
    borderBottom: "0",
  },
  socieAmount: {
    padding: "4px 7px",
    textAlign: "right",
    borderBottom: "0",
    fontVariantNumeric: "tabular-nums",
  },
  socieSectionLabel: {
    padding: "9px 7px 4px",
    fontWeight: 900,
    color: "#111827",
  },
  socieSectionAmount: {
    padding: "9px 7px 4px",
    borderBottom: "0",
  },
  socieBoldLabel: {
    padding: "6px 7px",
    fontWeight: 900,
    color: "#111827",
    borderBottom: "0",
  },
  socieBoldAmount: {
    padding: "6px 7px",
    textAlign: "right",
    fontWeight: 900,
    borderBottom: "0",
    fontVariantNumeric: "tabular-nums",
  },
  socieTotalLabel: {
    padding: "8px 7px",
    fontWeight: 900,
    color: "#111827",
  },
  socieTotalAmount: {
    padding: "8px 7px",
    textAlign: "right",
    fontWeight: 900,
    borderTop: "1px solid #111827",
    borderBottom: "3px double #111827",
    fontVariantNumeric: "tabular-nums",
  },
  statementMajorHeading: {
    padding: "9px 7px 5px",
    fontWeight: 900,
    color: "#111827",
  },
  statementMajorHeadingNote: {
    padding: "9px 7px 5px",
  },
  statementMajorHeadingAmount: {
    padding: "9px 7px 5px",
  },
  statementGroupHeading: {
    padding: "8px 7px 4px 20px",
    fontWeight: 900,
    color: "#111827",
  },
  statementGroupHeadingNote: {
    padding: "8px 7px 4px",
  },
  statementGroupHeadingAmount: {
    padding: "8px 7px 4px",
  },
  statementLineLabel: {
    padding: "3px 7px",
    color: "#111827",
  },
  statementNote: {
    padding: "3px 7px",
    textAlign: "center",
    color: "#0058ff",
    fontWeight: 850,
  },
  statementAmount: {
    padding: "3px 7px",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  statementSubtotalLabel: {
    padding: "6px 7px 6px 20px",
    fontWeight: 900,
    color: "#111827",
  },
  statementSubtotalNote: {
    padding: "6px 7px",
  },
  statementSubtotalAmount: {
    padding: "6px 7px",
    borderTop: "1px solid #111827",
    textAlign: "right",
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
  },
  statementDangerLabel: {
    padding: "6px 7px",
    fontWeight: 900,
    color: "#b91c1c",
  },
  statementDangerAmount: {
    padding: "6px 7px",
    textAlign: "right",
    fontWeight: 900,
    color: "#b91c1c",
    borderTop: "2px solid #b91c1c",
    borderBottom: "2px solid #b91c1c",
  },
  statementTotalLabel: {
    padding: "9px 7px 8px",
    fontWeight: 900,
    color: "#111827",
  },
  statementTotalNote: {
    padding: "9px 7px 8px",
  },
  statementTotalAmount: {
    padding: "9px 7px 8px",
    borderTop: "1px solid #111827",
    borderBottom: "3px double #111827",
    textAlign: "right",
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
  },
  statementSectionGap: {
    height: "8px",
    borderBottom: "0",
  },
  majorSpacerCell: {
    height: "14px",
    padding: 0,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "15px",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #cbd5e1",
    padding: "7px 7px",
    fontWeight: 900,
    color: "#334155",
  },
  thNote: {
    width: "54px",
    textAlign: "center",
    borderBottom: "1px solid #cbd5e1",
    padding: "7px 7px",
    fontWeight: 900,
    color: "#334155",
  },
  thRight: {
    width: "145px",
    textAlign: "right",
    borderBottom: "1px solid #cbd5e1",
    padding: "7px 7px",
    fontWeight: 900,
    color: "#334155",
  },
  sectionCell: {
    padding: "7px 7px",
    borderBottom: "0",
    fontWeight: 900,
    background: "#f8fafc",
  },
  sectionCellNote: {
    padding: "7px 7px",
    borderBottom: "1px solid #e5e7eb",
    textAlign: "center",
    color: "#0058ff",
    background: "#f8fafc",
    fontWeight: 900,
  },
  sectionCellRight: {
    padding: "7px 7px",
    borderBottom: "1px solid #e5e7eb",
    textAlign: "right",
    fontWeight: 900,
    background: "#f8fafc",
    fontVariantNumeric: "tabular-nums",
  },
  groupCell: {
    padding: "8px 7px 5px 7px",
    borderBottom: "1px solid #edf2f7",
    fontWeight: 900,
    color: "#111827",
  },
  groupCellNote: {
    padding: "8px 7px 5px 7px",
    borderBottom: "1px solid #edf2f7",
  },
  subtotalCell: {
    padding: "7px 7px",
    borderBottom: "1px solid #cbd5e1",
    fontWeight: 900,
    color: "#111827",
  },
  subtotalCellNote: {
    padding: "7px 7px",
    borderBottom: "1px solid #cbd5e1",
  },
  subtotalCellRight: {
    padding: "7px 7px",
    borderTop: "1px solid #111827",
    borderBottom: "1px solid #cbd5e1",
    textAlign: "right",
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
  },
  totalCell: {
    padding: "10px 7px 7px 7px",
    borderBottom: "1px solid #111827",
    fontWeight: 900,
    color: "#111827",
  },
  totalCellNote: {
    padding: "10px 7px 7px 7px",
    borderBottom: "1px solid #111827",
  },
  totalCellRight: {
    padding: "10px 7px 7px 7px",
    borderTop: "1px solid #111827",
    borderBottom: "3px double #111827",
    textAlign: "right",
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
  },
  td: {
    padding: "7px 7px",
    borderBottom: "1px solid #edf2f7",
  },
  tdBold: {
    padding: "7px 7px",
    borderBottom: "1px solid #cbd5e1",
    fontWeight: 900,
  },
  tdIndent: {
    padding: "7px 7px 7px 20px",
    borderBottom: "1px solid #edf2f7",
  },
  tdNote: {
    padding: "7px 7px",
    borderBottom: "1px solid #edf2f7",
    textAlign: "center",
    color: "#0058ff",
    fontWeight: 850,
  },
  tdRight: {
    padding: "7px 7px",
    borderBottom: "1px solid #edf2f7",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  tdRightBold: {
    padding: "7px 7px",
    borderBottom: "1px solid #cbd5e1",
    textAlign: "right",
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
  },
  smallTable: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    marginTop: "6px",
  },
  thSmall: {
    textAlign: "left",
    padding: "5px 6px",
    borderBottom: "1px solid #cbd5e1",
    color: "#334155",
    fontWeight: 900,
  },
  thSmallRight: {
    textAlign: "right",
    padding: "5px 6px",
    borderBottom: "1px solid #cbd5e1",
    color: "#334155",
    fontWeight: 900,
  },
  tdSmall: {
    padding: "5px 6px",
    borderBottom: "1px solid #edf2f7",
  },
  tdSmallRight: {
    padding: "5px 6px",
    borderBottom: "1px solid #edf2f7",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  signatureGrid: {
    marginTop: "36px",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "28px",
  },
  signatureBox: {
    display: "grid",
    gap: "4px",
    fontSize: "15px",
  },
  signatureLine: {
    borderTop: "1px solid #111827",
    marginBottom: "5px",
    height: "1px",
  },
  practitionerSignature: {
    marginTop: "36px",
    display: "grid",
    gap: "4px",
    width: "230px",
    fontSize: "15px",
  },
  statementCheck: {
    marginTop: "10px",
    borderTop: "1px solid #cbd5e1",
  },
  checkLine: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 7px",
    borderBottom: "1px solid #edf2f7",
  },
  checkLineBold: {
    display: "flex",
    justifyContent: "space-between",
    padding: "7px 7px",
    borderBottom: "1px solid #cbd5e1",
    fontWeight: 900,
  },

  inlineEditableText: {
    border: "1px solid transparent",
    background: "transparent",
    padding: "2px 0 4px 0",
    margin: "2px 0 8px 0",
  },
  inlineEditableToolbar: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "6px",
    marginBottom: "2px",
  },
  inlineEditableLabel: {
    color: "#94a3b8",
    fontSize: "8px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginRight: "auto",
  },
  inlineEditableBody: {
    minHeight: "16px",
  },
  inlineEditButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#334155",
    borderRadius: "2px",
    padding: "2px 6px",
    fontSize: "9px",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  inlineEditorBox: {
    border: "1px solid #93c5fd",
    background: "#f8fbff",
    padding: "6px",
    margin: "4px 0 8px 0",
  },
  inlineEditorLabel: {
    display: "grid",
    gap: "3px",
    marginBottom: "6px",
    color: "#334155",
    fontSize: "14.5px",
    fontWeight: 850,
  },
  inlineEditorInput: {
    width: "100%",
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    color: "#0f172a",
    padding: "5px 7px",
    fontSize: "11px",
    lineHeight: 1.35,
    outline: "none",
    fontFamily: "inherit",
  },
  inlineEditorTextarea: {
    width: "100%",
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    color: "#0f172a",
    padding: "6px 7px",
    fontSize: "11px",
    lineHeight: 1.45,
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
  },
  inlineEditorActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "6px",
  },
  inlineEditorButton: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: "2px",
    padding: "4px 8px",
    fontSize: "14.5px",
    fontWeight: 850,
    cursor: "pointer",
  },
  inlineEditorButtonDisabled: {
    border: "1px solid #93c5fd",
    background: "#93c5fd",
    color: "#ffffff",
    borderRadius: "2px",
    padding: "4px 8px",
    fontSize: "14.5px",
    fontWeight: 850,
    cursor: "not-allowed",
  },
  inlineEditorSecondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    borderRadius: "2px",
    padding: "4px 8px",
    fontSize: "14.5px",
    fontWeight: 800,
    cursor: "pointer",
  },
  inlineEditorResetButton: {
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    borderRadius: "2px",
    padding: "4px 8px",
    fontSize: "14.5px",
    fontWeight: 800,
    cursor: "pointer",
  },

  noteLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 900,
  },
  noteLinkButton: {
    appearance: "none",
    border: "0",
    background: "transparent",
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: "15px",
    cursor: "pointer",
    padding: 0,
  },
  policySection: {
    marginBottom: "6px",
    paddingBottom: "0",
    borderBottom: "0",
  },
  policySectionOff: {
    marginBottom: "6px",
    paddingBottom: "0",
    borderBottom: "0",
  },
  noteSectionAnchor: {
    marginTop: "10px",
    paddingTop: "4px",
    borderTop: "0",
    scrollMarginTop: "118px",
  },
  noteSectionAnchorOff: {
    marginTop: "10px",
    paddingTop: "4px",
    borderTop: "0",
    scrollMarginTop: "118px",
  },
  notesCurrencyLine: {
    margin: "0 0 14px",
    color: "#334155",
    fontSize: "14px",
    fontWeight: 800,
  },
  noteHeading: {
    margin: "0 0 11px",
    fontSize: "18px",
    fontWeight: 900,
    color: "#111827",
    display: "flex",
    justifyContent: "space-between",
  },
  noteMasterHeader: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "15px",
    margin: "2px 0 8px",
  },
  noteStatementTable: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "15px",
    marginTop: "2px",
  },
  noteColDescription: {
    width: "70%",
  },
  noteColAmount: {
    width: "15%",
  },
  noteTh: {
    textAlign: "left",
    borderTop: "1px solid #111827",
    borderBottom: "0",
    padding: "5px 7px",
    fontWeight: 900,
    color: "#334155",
  },
  noteThRight: {
    textAlign: "right",
    borderTop: "1px solid #111827",
    borderBottom: "0",
    padding: "5px 0 5px 7px",
    fontWeight: 900,
    color: "#334155",
  },
  noteTd: {
    padding: "5px 7px",
    borderBottom: "0",
    color: "#111827",
  },
  noteAmount: {
    padding: "5px 7px",
    borderBottom: "0",
    textAlign: "right",
    color: "#111827",
  },
  noteTotalLabel: {
    padding: "6px 7px",
    borderTop: "0",
    borderBottom: "0",
    fontWeight: 900,
    color: "#111827",
  },
  noteTotalAmount: {
    padding: "6px 7px",
    borderTop: "0",
    borderBottom: "0",
    textAlign: "right",
    fontWeight: 900,
    color: "#111827",
  },
  noteAnchorRow: {
    scrollMarginTop: "104px",
  },
  noteSubSection: {
    marginTop: "14px",
    paddingTop: "0",
    borderTop: "0",
  },
  noteSubSectionAnchor: {
    marginTop: "14px",
    paddingTop: "0",
    borderTop: "0",
    scrollMarginTop: "104px",
  },
  drInlineHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    margin: "8px 0 3px",
  },
  drInlineHeadingOff: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    margin: "8px 0 3px",
    opacity: 0.45,
  },
  reportHeadingOff: {
    margin: "0 0 4px",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 900,
  },
  drToggleOn: {
    border: "1px solid #86efac",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "2px 8px",
    fontSize: "9px",
    fontWeight: 900,
    cursor: "pointer",
  },
  drToggleOff: {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    borderRadius: "999px",
    padding: "2px 8px",
    fontSize: "9px",
    fontWeight: 900,
    cursor: "pointer",
  },
  cashFlowWarning: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#9a3412",
    padding: "7px 9px",
    marginBottom: "8px",
    fontSize: "15px",
    fontWeight: 700,
  },
  cashFlowToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
    borderBottom: "1px solid #cbd5e1",
    paddingBottom: "6px",
    color: "#334155",
  },
  cashFlowHint: {
    display: "block",
    fontSize: "14.5px",
    color: "#64748b",
    marginTop: "2px",
  },
  cashFlowActions: {
    display: "flex",
    gap: "5px",
    alignItems: "center",
  },
  statementModeToolbar: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "6px",
    marginBottom: "8px",
  },
  statementModeLabel: {
    fontSize: "14.5px",
    fontWeight: 900,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  methodButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    borderRadius: "3px",
    padding: "4px 8px",
    fontSize: "14.5px",
    fontWeight: 900,
    cursor: "pointer",
  },
  methodButtonActive: {
    border: "1px solid #2563eb",
    background: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: "3px",
    padding: "4px 8px",
    fontSize: "14.5px",
    fontWeight: 900,
    cursor: "pointer",
  },

  noteLineInput: {
    width: "100%",
    border: "1px solid #cbd5e1",
    padding: "3px 5px",
    fontSize: "15px",
    fontFamily: "inherit",
  },
  noteAmountInput: {
    width: "92px",
    border: "1px solid #cbd5e1",
    padding: "3px 5px",
    fontSize: "15px",
    fontFamily: "inherit",
    textAlign: "right",
  },
  loanTermsInlineCombined: {
    padding: "1px 7px 7px 7px",
    borderBottom: "none",
    color: "#111827",
    verticalAlign: "top",
  },
  loanTermsInlineLabel: {
    display: "none",
    margin: "0 0 3px",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 900,
  },
  loanTermsInlineText: {
    padding: "3px 0 7px",
    borderBottom: "none",
    color: "#111827",
    verticalAlign: "top",
  },
  loanTermsBlock: {
    marginTop: "8px",
  },
  loanTermsTitle: {
    margin: "0 0 5px",
    fontSize: "15px",
    color: "#64748b",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  loanTermsTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "11px",
  },
  loanTermsName: {
    width: "210px",
    padding: "4px 6px",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: 850,
    verticalAlign: "top",
  },
  loanTermsText: {
    padding: "4px 6px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "top",
  },
  loanTermsInput: {
    width: "100%",
    border: "1px solid #cbd5e1",
    padding: "3px 5px",
    fontSize: "15px",
    fontFamily: "inherit",
  },
  loanTermsAction: {
    width: "85px",
    padding: "4px 6px",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "right",
  },
  noteEditorActions: {
    display: "flex",
    gap: "6px",
    justifyContent: "flex-end",
    padding: "5px 0 10px",
  },

};
