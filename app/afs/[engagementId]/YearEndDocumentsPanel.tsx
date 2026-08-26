"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type DocumentStatus = "draft" | "prepared" | "signed";

type TrustApprovalClauseKey =
  | "completeness"
  | "framework"
  | "incomeExpenditure"
  | "beneficiaryDistributions"
  | "incomeCapitalAllocation"
  | "goingConcern"
  | "subsequentEvents"
  | "trusteeRemuneration"
  | "loansBorrowings"
  | "investmentsAssets"
  | "conflictsInterests"
  | "trusteeChanges"
  | "bankingAuthority"
  | "otherMatters";

const TRUST_APPROVAL_CLAUSES: Array<{
  key: TrustApprovalClauseKey;
  label: string;
  help: string;
}> = [
  {
    key: "completeness",
    label: "Assets, liabilities and completeness",
    help: "Confirms material balances and disclosures were considered.",
  },
  {
    key: "framework",
    label: "Reporting framework and trust deed",
    help: "Approves the accounting basis subject to the trust deed.",
  },
  {
    key: "incomeExpenditure",
    label: "Income and expenditure",
    help: "Approves income, expenditure and unsupported items where applicable.",
  },
  {
    key: "beneficiaryDistributions",
    label: "Beneficiary distributions / vestings",
    help: "Approves or ratifies beneficiary benefits and allocations.",
  },
  {
    key: "incomeCapitalAllocation",
    label: "Income, losses and capital allocation",
    help: "Covers revenue profits, losses, capital gains and retained amounts.",
  },
  {
    key: "goingConcern",
    label: "Going concern",
    help: "Records the trustees' annual going-concern consideration.",
  },
  {
    key: "subsequentEvents",
    label: "Events after reporting date",
    help: "Records consideration of adjusting and disclosure events.",
  },
  {
    key: "trusteeRemuneration",
    label: "Trustee remuneration / administration fees",
    help: "Approves supported remuneration and administration charges.",
  },
  {
    key: "loansBorrowings",
    label: "Loans, borrowings, guarantees and security",
    help: "Covers Trust funding, credit facilities and security arrangements.",
  },
  {
    key: "investmentsAssets",
    label: "Investments, acquisitions and disposals",
    help: "Covers material changes in Trust property and investments.",
  },
  {
    key: "conflictsInterests",
    label: "Trustee interests and conflicts",
    help: "Records related-party interests, conflicts and safeguards.",
  },
  {
    key: "trusteeChanges",
    label: "Trustee appointments / resignations / changes",
    help: "Covers trustee changes, Master filings and Letters of Authority.",
  },
  {
    key: "bankingAuthority",
    label: "Banking and signing authority",
    help: "Confirms banking mandates and document-signing arrangements.",
  },
  {
    key: "otherMatters",
    label: "Other material year-end matters",
    help: "Captures any remaining matter requiring separate support or follow-up.",
  },
];

const DEFAULT_TRUST_APPROVAL_CLAUSES: Record<TrustApprovalClauseKey, boolean> =
  TRUST_APPROVAL_CLAUSES.reduce(
    (result, clause) => {
      result[clause.key] = true;
      return result;
    },
    {} as Record<TrustApprovalClauseKey, boolean>,
  );

type TrialBalanceLine = {
  id?: string;
  account_code: string | null;
  account_name: string;
  description?: string | null;
  current_year_balance?: number | null;
  prior_year_balance?: number | null;
  debit: number;
  credit: number;
  mapping_code?: string | null;
  mapping_label?: string | null;
  lead_schedule_key?: string | null;
};

type ClientSetupData = Record<string, any> & {
  registered_name?: string | null;
  registration_number?: string | null;
  entity_type?: string | null;
  financial_year_end?: string | null;
  basis_of_preparation?: string | null;
};

type ClientPerson = Record<string, any> & {
  id: string;
  person_type: string;
  full_name: string;
};

type DocumentKey =
  | "afs-approval"
  | "annual-minutes"
  | "loan-certificates"
  | "subordination"
  | "going-concern"
  | "distribution"
  | "subsequent-events"
  | "other"
  | "trust-income-allocation"
  | "trust-capital-allocation"
  | "trust-retention"
  | "trust-remuneration"
  | "trust-loan-approval"
  | "trust-investment"
  | "trust-conflicts"
  | "trustee-changes"
  | "trust-banking-authority";

type TrustExtraDocumentKey = Exclude<
  DocumentKey,
  | "afs-approval"
  | "annual-minutes"
  | "loan-certificates"
  | "subordination"
  | "going-concern"
  | "distribution"
  | "subsequent-events"
  | "other"
>;

type TrustExtraDocumentState = {
  status: DocumentStatus;
  text: string;
  message: string;
};

type TrustDistributionEntry = {
  id: string;
  beneficiary: string;
  category: string;
  amount: string;
  form: string;
  vestingDate: string;
  paymentTerms: string;
  notes: string;
};

const TRUST_EXTRA_DOCUMENTS: Array<{
  key: TrustExtraDocumentKey;
  ref: string;
  title: string;
  requirement: string;
  detail: string;
  placeholder: string;
}> = [
  {
    key: "trust-income-allocation",
    ref: "YD09",
    title: "Income, Profit and Loss Allocation Resolution",
    requirement: "Available",
    detail:
      "Records the trustees' annual decision on income, profits, operating results and losses for the year.",
    placeholder:
      "Record the trustees' decision on the allocation, vesting, retention or treatment of income, profits and losses for the year.",
  },
  {
    key: "trust-capital-allocation",
    ref: "YD10",
    title: "Capital Gain / Capital Profit Allocation Resolution",
    requirement: "Available",
    detail:
      "Records the trustees' decision on capital gains, capital profits and related capital allocations.",
    placeholder:
      "Record the capital gain or capital profit considered, the relevant beneficiary or beneficiaries if any, and whether the amount is vested, distributed or retained.",
  },
  {
    key: "trust-retention",
    ref: "YD11",
    title: "Retention / Accumulation Resolution",
    requirement: "Available",
    detail:
      "Documents income, gains or other amounts retained and accumulated in the Trust rather than distributed.",
    placeholder:
      "Record the amounts or categories retained in the Trust, the reason for retention and any conditions or future purpose.",
  },
  {
    key: "trust-remuneration",
    ref: "YD12",
    title: "Trustee Remuneration / Administration Fee Resolution",
    requirement: "Conditional",
    detail:
      "Approves trustee remuneration, administration fees or professional charges where the trust deed permits them.",
    placeholder:
      "Record the trustee or service provider, nature of services, amount or basis of remuneration, period covered and approval terms.",
  },
  {
    key: "trust-loan-approval",
    ref: "YD13",
    title: "Loan / Borrowing Approval Resolution",
    requirement: "Conditional",
    detail:
      "Approves material lending, borrowing, security or related-party loan arrangements entered into by the Trust.",
    placeholder:
      "Record the lender or borrower, amount, interest, repayment terms, security, purpose and any related-party considerations.",
  },
  {
    key: "trust-investment",
    ref: "YD14",
    title: "Investment / Asset Decision Resolution",
    requirement: "Conditional",
    detail:
      "Documents material acquisitions, disposals, investments or changes to Trust assets requiring trustee approval.",
    placeholder:
      "Record the asset or investment, transaction, amount or value, rationale, authority and any conditions.",
  },
  {
    key: "trust-conflicts",
    ref: "YD15",
    title: "Trustee Interests and Conflict Declaration",
    requirement: "Available",
    detail:
      "Records trustee interests, related-party matters and conflicts considered at year end.",
    placeholder:
      "Record each trustee interest or conflict considered, how it was managed, any abstention and the trustees' conclusion.",
  },
  {
    key: "trustee-changes",
    ref: "YD16",
    title: "Trustee Appointment / Resignation / Change Record",
    requirement: "Conditional",
    detail:
      "Documents trustee appointments, resignations, vacancies, replacements or changes requiring year-end support.",
    placeholder:
      "Record the trustee change, effective date, authority under the trust deed, Master-related action required and signing/administrative follow-up.",
  },
  {
    key: "trust-banking-authority",
    ref: "YD17",
    title: "Banking / Signing Authority Resolution",
    requirement: "Conditional",
    detail:
      "Documents changes to Trust banking mandates, account authorities and document-signing powers.",
    placeholder:
      "Record the bank or account, authorised trustees/signatories, signing rule, mandate changes and effective date.",
  },
];

function initialTrustExtraDocumentState() {
  return Object.fromEntries(
    TRUST_EXTRA_DOCUMENTS.map((document) => [
      document.key,
      { status: "draft", text: "", message: "" },
    ]),
  ) as Record<TrustExtraDocumentKey, TrustExtraDocumentState>;
}

type Props = {
  engagementId: string;
  clientName: string;
  entityType: string | null;
  financialYearEnd: string;
  clientSetup: ClientSetupData | null;
  trialBalanceLines: TrialBalanceLine[];
  clientPeople: ClientPerson[];
  subordinationSelections?: Record<string, any>;
  savingSubordinationId?: string | null;
  updateSubordinationSelection?: (
    key: string,
    patch: Record<string, any>,
  ) => void;
  saveSubordinationSelection?: (line: any, index: number) => Promise<void>;
  subordinationContent?: ReactNode;
};

export default function YearEndDocumentsPanel({
  engagementId,
  clientName,
  entityType,
  financialYearEnd,
  clientSetup,
  trialBalanceLines = [],
  clientPeople = [],
  subordinationSelections = {},
  savingSubordinationId = null,
  updateSubordinationSelection,
  saveSubordinationSelection,
  subordinationContent,
}: Props) {
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentKey>("afs-approval");
  const [approvalPlace, setApprovalPlace] = useState("");
  const [approvalDate, setApprovalDate] = useState("");
  const [approvalSignatories, setApprovalSignatories] = useState<string[]>([]);
  const [approvalClauses, setApprovalClauses] =
    useState<Record<TrustApprovalClauseKey, boolean>>({
      ...DEFAULT_TRUST_APPROVAL_CLAUSES,
    });
  const [approvalStatus, setApprovalStatus] = useState<DocumentStatus>("draft");
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");

  const [minutesPlace, setMinutesPlace] = useState("");
  const [minutesDate, setMinutesDate] = useState("");
  const [minutesChairperson, setMinutesChairperson] = useState("");
  const [minutesAttendees, setMinutesAttendees] = useState<string[]>([]);
  const [minutesClauses, setMinutesClauses] =
    useState<Record<TrustApprovalClauseKey, boolean>>({
      ...DEFAULT_TRUST_APPROVAL_CLAUSES,
    });
  const [minutesStatus, setMinutesStatus] = useState<DocumentStatus>("draft");
  const [minutesSaving, setMinutesSaving] = useState(false);
  const [minutesMessage, setMinutesMessage] = useState("");

  const [loanStatus, setLoanStatus] = useState<DocumentStatus>("draft");
  const [loanSaving, setLoanSaving] = useState(false);
  const [loanMessage, setLoanMessage] = useState("");
  const [loanTerms, setLoanTerms] = useState<Record<string, {
    creditorName?: string;
    initiationDate?: string;
    security?: string;
    interestRate?: string;
    interestAmount?: string;
    repaymentTerms?: string;
  }>>({});

  const [subordinationStatus, setSubordinationStatus] = useState<DocumentStatus>("draft");
  const [subordinationMessage, setSubordinationMessage] = useState("");
  const [openSubordinationKey, setOpenSubordinationKey] = useState<string | null>(null);

  const [goingConcernStatus, setGoingConcernStatus] = useState<DocumentStatus>("draft");
  const [goingConcernText, setGoingConcernText] = useState("");
  const [goingConcernMessage, setGoingConcernMessage] = useState("");

  const [distributionStatus, setDistributionStatus] = useState<DocumentStatus>("draft");
  const [distributionText, setDistributionText] = useState("");
  const [distributionEntries, setDistributionEntries] = useState<TrustDistributionEntry[]>([]);
  const [distributionMessage, setDistributionMessage] = useState("");

  const [trustExtraDocuments, setTrustExtraDocuments] = useState<
    Record<TrustExtraDocumentKey, TrustExtraDocumentState>
  >(initialTrustExtraDocumentState);

  const [subsequentStatus, setSubsequentStatus] = useState<DocumentStatus>("draft");
  const [subsequentText, setSubsequentText] = useState("");
  const [subsequentMessage, setSubsequentMessage] = useState("");

  const [otherStatus, setOtherStatus] = useState<DocumentStatus>("draft");
  const [otherTitle, setOtherTitle] = useState("");
  const [otherText, setOtherText] = useState("");
  const [otherMessage, setOtherMessage] = useState("");

  const [practiceName, setPracticeName] = useState("Accounting practice");
  const [whiteLabel, setWhiteLabel] = useState(false);

  async function authHeaders(): Promise<Record<string, string>> {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function invalidateYearEndDocumentsSignoff() {
    try {
      await fetch(`/api/afs/engagements/${engagementId}/section-signoffs`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          action: "reopen",
          sectionKey: "minutes",
        }),
      });

      window.dispatchEvent(new CustomEvent("afs-signoff-refresh"));
    } catch {
      // Saving the document remains authoritative; sign-off can still be reopened manually.
    }
  }

  async function loadGenericDocument(documentKey: string) {
    const response = await fetch(
      `/api/afs/engagements/${engagementId}/year-end-documents?documentKey=${encodeURIComponent(documentKey)}`,
      {
        cache: "no-store",
        headers: await authHeaders(),
      },
    );

    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Could not load year-end document.");

    setPracticeName(result.practiceName || "Accounting practice");
    setWhiteLabel(Boolean(result.whiteLabel));
    return result.document || null;
  }

  async function saveGenericDocument(
    documentKey: string,
    status: DocumentStatus,
    payload: Record<string, any>,
  ) {
    const response = await fetch(
      `/api/afs/engagements/${engagementId}/year-end-documents`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({ documentKey, status, payload }),
      },
    );

    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || "Could not save year-end document.");

    setPracticeName(result.practiceName || practiceName);
    setWhiteLabel(Boolean(result.whiteLabel));
    await invalidateYearEndDocumentsSignoff();
    return result.document;
  }

  async function loadApprovalDocument() {
    if (!engagementId) return;

    try {
      setApprovalMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/year-end-documents?documentKey=afs-approval`,
        {
          cache: "no-store",
          headers: await authHeaders(),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Could not load AFS approval resolution.");
      }

      setPracticeName(result.practiceName || "Accounting practice");
      setWhiteLabel(Boolean(result.whiteLabel));

      const document = result.document;
      if (!document) return;

      const payload = document.payload || {};
      setApprovalPlace(String(payload.place || ""));
      setApprovalDate(String(payload.approvalDate || ""));
      setApprovalSignatories(
        Array.isArray(payload.signatories)
          ? payload.signatories.map(String).filter(Boolean)
          : [],
      );
      const savedClauses =
        payload.enabledClauses && typeof payload.enabledClauses === "object"
          ? payload.enabledClauses
          : null;

      setApprovalClauses(
        TRUST_APPROVAL_CLAUSES.reduce(
          (result, clause) => {
            result[clause.key] =
              savedClauses &&
              Object.prototype.hasOwnProperty.call(savedClauses, clause.key)
                ? Boolean(savedClauses[clause.key])
                : true;
            return result;
          },
          {} as Record<TrustApprovalClauseKey, boolean>,
        ),
      );
      setApprovalStatus(
        document.status === "signed"
          ? "signed"
          : document.status === "prepared"
            ? "prepared"
            : "draft",
      );
    } catch (error: any) {
      setApprovalMessage(error?.message || "Could not load AFS approval resolution.");
    }
  }

  async function saveApprovalDocument(status: DocumentStatus) {
    if (!engagementId) return;

    try {
      setApprovalSaving(true);
      setApprovalMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/year-end-documents`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            documentKey: "afs-approval",
            status,
            payload: {
              place: approvalPlace.trim(),
              approvalDate,
              signatories: effectiveApprovalSignatories,
              enabledClauses: approvalClauses,
            },
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Could not save AFS approval resolution.");
      }

      setPracticeName(result.practiceName || practiceName);
      setWhiteLabel(Boolean(result.whiteLabel));
      setApprovalStatus(status);

      await invalidateYearEndDocumentsSignoff();

      setApprovalMessage(
        status === "signed"
          ? "YD01 marked Signed."
          : status === "prepared"
            ? "YD01 marked Prepared."
            : "YD01 draft saved.",
      );
    } catch (error: any) {
      setApprovalMessage(error?.message || "Could not save AFS approval resolution.");
    } finally {
      setApprovalSaving(false);
    }
  }

  function approvalChanged() {
    if (approvalStatus !== "draft") {
      setApprovalStatus("draft");
    }
    setApprovalMessage("");
  }

  useEffect(() => {
    void loadApprovalDocument();
    void loadMinutesDocument();
    void loadRemainingDocuments();
  }, [engagementId]);

  async function loadMinutesDocument() {
    if (!engagementId) return;

    try {
      setMinutesMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/year-end-documents?documentKey=annual-minutes`,
        {
          cache: "no-store",
          headers: await authHeaders(),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Could not load annual meeting minutes.");
      }

      setPracticeName(result.practiceName || "Accounting practice");
      setWhiteLabel(Boolean(result.whiteLabel));

      const document = result.document;
      if (!document) return;

      const payload = document.payload || {};
      setMinutesPlace(String(payload.place || ""));
      setMinutesDate(String(payload.meetingDate || ""));
      setMinutesChairperson(String(payload.chairperson || ""));
      setMinutesAttendees(
        Array.isArray(payload.attendees)
          ? payload.attendees.map(String).filter(Boolean)
          : [],
      );

      const savedClauses =
        payload.enabledClauses && typeof payload.enabledClauses === "object"
          ? payload.enabledClauses
          : null;

      setMinutesClauses(
        TRUST_APPROVAL_CLAUSES.reduce(
          (result, clause) => {
            result[clause.key] =
              savedClauses &&
              Object.prototype.hasOwnProperty.call(savedClauses, clause.key)
                ? Boolean(savedClauses[clause.key])
                : true;
            return result;
          },
          {} as Record<TrustApprovalClauseKey, boolean>,
        ),
      );

      setMinutesStatus(
        document.status === "signed"
          ? "signed"
          : document.status === "prepared"
            ? "prepared"
            : "draft",
      );
    } catch (error: any) {
      setMinutesMessage(error?.message || "Could not load annual meeting minutes.");
    }
  }

  async function saveMinutesDocument(status: DocumentStatus) {
    if (!engagementId) return;

    try {
      setMinutesSaving(true);
      setMinutesMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/year-end-documents`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            documentKey: "annual-minutes",
            status,
            payload: {
              place: minutesPlace.trim(),
              meetingDate: minutesDate,
              chairperson: effectiveMinutesChairperson,
              attendees: effectiveMinutesAttendees,
              enabledClauses: minutesClauses,
            },
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Could not save annual meeting minutes.");
      }

      setPracticeName(result.practiceName || practiceName);
      setWhiteLabel(Boolean(result.whiteLabel));
      setMinutesStatus(status);

      await invalidateYearEndDocumentsSignoff();

      setMinutesMessage(
        status === "signed"
          ? "YD02 marked Signed."
          : status === "prepared"
            ? "YD02 marked Prepared."
            : "YD02 draft saved.",
      );
    } catch (error: any) {
      setMinutesMessage(error?.message || "Could not save annual meeting minutes.");
    } finally {
      setMinutesSaving(false);
    }
  }

  function minutesChanged() {
    if (minutesStatus !== "draft") {
      setMinutesStatus("draft");
    }
    setMinutesMessage("");
  }

  async function loadRemainingDocuments() {
    if (!engagementId) return;

    try {
      const standardDocumentsPromise = Promise.all([
        loadGenericDocument("loan-certificates"),
        loadGenericDocument("subordination"),
        loadGenericDocument("going-concern"),
        loadGenericDocument("distribution"),
        loadGenericDocument("subsequent-events"),
        loadGenericDocument("other"),
      ]);

      const trustDocumentsPromise =
        entityKind === "trust"
          ? Promise.all(
              TRUST_EXTRA_DOCUMENTS.map((document) =>
                loadGenericDocument(document.key),
              ),
            )
          : Promise.resolve([]);

      const [
        [loanDoc, subDoc, gcDoc, distDoc, eventDoc, otherDoc],
        trustDocuments,
      ] = await Promise.all([
        standardDocumentsPromise,
        trustDocumentsPromise,
      ]);

      if (loanDoc) {
        setLoanStatus(normaliseStatus(loanDoc.status));
        setLoanTerms(loanDoc.payload?.loans || {});
      }

      if (subDoc) setSubordinationStatus(normaliseStatus(subDoc.status));

      if (gcDoc) {
        setGoingConcernStatus(normaliseStatus(gcDoc.status));
        setGoingConcernText(String(gcDoc.payload?.text || ""));
      }

      if (distDoc) {
        setDistributionStatus(normaliseStatus(distDoc.status));
        setDistributionText(String(distDoc.payload?.text || ""));
        setDistributionEntries(
          Array.isArray(distDoc.payload?.entries)
            ? distDoc.payload.entries.map((entry: any) => ({
                id: String(entry?.id || `${Date.now()}-${Math.random()}`),
                beneficiary: String(entry?.beneficiary || ""),
                category: String(entry?.category || "Income"),
                amount: String(entry?.amount || ""),
                form: String(entry?.form || "Cash"),
                vestingDate: String(entry?.vestingDate || ""),
                paymentTerms: String(entry?.paymentTerms || ""),
                notes: String(entry?.notes || ""),
              }))
            : [],
        );
      }

      if (trustDocuments.length) {
        setTrustExtraDocuments((current) => {
          const next = { ...current };

          TRUST_EXTRA_DOCUMENTS.forEach((config, index) => {
            const document = trustDocuments[index];
            if (!document) return;

            next[config.key] = {
              status: normaliseStatus(document.status),
              text: String(document.payload?.text || ""),
              message: "",
            };
          });

          return next;
        });
      }

      if (eventDoc) {
        setSubsequentStatus(normaliseStatus(eventDoc.status));
        setSubsequentText(String(eventDoc.payload?.text || ""));
      }

      if (otherDoc) {
        setOtherStatus(normaliseStatus(otherDoc.status));
        setOtherTitle(String(otherDoc.payload?.title || ""));
        setOtherText(String(otherDoc.payload?.text || ""));
      }
    } catch (error: any) {
      setLoanMessage(error?.message || "Could not load remaining year-end documents.");
    }
  }

  async function saveLoanCertificates(status: DocumentStatus) {
    try {
      setLoanSaving(true);
      setLoanMessage("");
      await saveGenericDocument("loan-certificates", status, { loans: loanTerms });
      setLoanStatus(status);
      setLoanMessage(statusMessage("YD03", status));
    } catch (error: any) {
      setLoanMessage(error?.message || "Could not save loan certificates.");
    } finally {
      setLoanSaving(false);
    }
  }

  async function saveSimpleDocument(
    key: string,
    status: DocumentStatus,
    payload: Record<string, any>,
    setter: (status: DocumentStatus) => void,
    messageSetter: (value: string) => void,
    label: string,
  ) {
    try {
      messageSetter("");
      await saveGenericDocument(key, status, payload);
      setter(status);
      messageSetter(statusMessage(label, status));
    } catch (error: any) {
      messageSetter(error?.message || `Could not save ${label}.`);
    }
  }

  function updateTrustExtraDocument(
    key: TrustExtraDocumentKey,
    patch: Partial<TrustExtraDocumentState>,
  ) {
    setTrustExtraDocuments((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  }

  async function saveTrustExtraDocument(
    key: TrustExtraDocumentKey,
    refCode: string,
    status: DocumentStatus,
    text: string,
  ) {
    try {
      updateTrustExtraDocument(key, { message: "" });
      await saveGenericDocument(key, status, { text });
      updateTrustExtraDocument(key, {
        status,
        message: statusMessage(refCode, status),
      });
    } catch (error: any) {
      updateTrustExtraDocument(key, {
        message: error?.message || `Could not save ${refCode}.`,
      });
    }
  }

  const effectiveEntityType = String(
    clientSetup?.entity_type || entityType || "Company",
  ).trim();

  const entityKind = normaliseEntityKind(effectiveEntityType);

  const intelligentGoingConcernText =
    goingConcernText.trim() ||
    buildGoingConcernResolutionText({
      entityKind,
      hasFormalSupport:
        subordinationStatus === "prepared" || subordinationStatus === "signed",
    });

  const displayName = clientSetup?.registered_name || clientName;
  const registrationNumber = clientSetup?.registration_number || "";
  const yearEnd = clientSetup?.financial_year_end || financialYearEnd;
  const framework = clientSetup?.basis_of_preparation || "";

  const signatories = useMemo(
    () => getEntitySignatories(clientPeople, entityKind),
    [clientPeople, entityKind],
  );

  const beneficiaries = useMemo(
    () =>
      (clientPeople || [])
        .filter((person) =>
          String(person.person_type || "").toLowerCase().includes("beneficiary"),
        )
        .map((person) => person.full_name)
        .filter(Boolean),
    [clientPeople],
  );

  const effectiveApprovalSignatories =
    approvalSignatories.length > 0 ? approvalSignatories : signatories.slice(0, 2);

  const effectiveMinutesAttendees =
    minutesAttendees.length > 0 ? minutesAttendees : signatories;

  const effectiveMinutesChairperson =
    minutesChairperson || effectiveMinutesAttendees[0] || "";

  const detectedDistributionLines = useMemo(
    () =>
      (trialBalanceLines || []).filter((line) => {
        const code = cleanCode(line.mapping_code);
        return startsWithMapping(code, "688") && Math.abs(currentBalance(line)) >= 0.005;
      }),
    [trialBalanceLines],
  );

  const intelligentDistributionText =
    distributionText.trim() ||
    defaultDistributionResolutionText(
      entityKind,
      displayName,
      detectedDistributionLines,
    );

  const intelligentSubsequentText =
    subsequentText.trim() ||
    defaultSubsequentEventsText(entityKind, displayName);

  const linkedLoanData = useMemo(() => {
    const result: Record<string, any> = {};

    for (const line of loanLinesFromMappings(trialBalanceLines)) {
      const key = String(line.id || line.account_code || line.account_name || "");

      const match =
        Object.values(subordinationSelections || {}).find((item: any) => {
          const lineId = String(line.id || "");
          const itemLineId = String(item?.trial_balance_line_id || "");
          if (lineId && itemLineId && lineId === itemLineId) return true;

          const lineCode = String(line.account_code || "").trim();
          const itemCode = String(item?.account_code || "").trim();
          if (lineCode && itemCode && lineCode === itemCode) return true;

          const lineName = String(line.account_name || "").trim().toLowerCase();
          const itemName = String(item?.account_name || "").trim().toLowerCase();
          return Boolean(lineName && itemName && lineName === itemName);
        }) || null;

      if (match) {
        result[key] = match;
      }
    }

    return result;
  }, [trialBalanceLines, subordinationSelections]);

  const loanLines = useMemo(
    () => loanLinesFromMappings(trialBalanceLines),
    [trialBalanceLines],
  );

  const subordinationCandidates = useMemo(
    () =>
      (trialBalanceLines || []).filter((line) => {
        const code = cleanCode(line.mapping_code);
        if (!startsWithMapping(code, "548")) return false;
        return Math.abs(currentBalance(line)) >= 0.005;
      }),
    [trialBalanceLines],
  );

  const documents = useMemo(
    () => [
      {
        key: "afs-approval" as DocumentKey,
        ref: "YD01",
        title: approvalTitle(entityKind),
        requirement: "Standard",
        status:
          approvalStatus === "signed"
            ? "Signed"
            : approvalStatus === "prepared"
              ? "Prepared"
              : "Draft",
        detail:
          entityKind === "trust"
            ? "Comprehensive annual trustee resolution covering the financial statements, allocations, governance matters, authority and year-end decisions."
            : "Adoption and approval of the annual financial statements and signing authority.",
      },
      {
        key: "annual-minutes" as DocumentKey,
        ref: "YD02",
        title: minutesTitle(entityKind),
        requirement: "Standard",
        status:
          minutesStatus === "signed"
            ? "Signed"
            : minutesStatus === "prepared"
              ? "Prepared"
              : "Draft",
        detail: "Year-end meeting record dealing with the annual financial statements and matters arising.",
      },
      {
        key: "loan-certificates" as DocumentKey,
        ref: "YD03",
        title: "Loan Certificates",
        requirement: loanLines.length ? `${loanLines.length} detected` : "Conditional",
        status: loanLines.length
          ? loanStatus === "signed"
            ? "Signed"
            : loanStatus === "prepared"
              ? "Prepared"
              : "Draft"
          : "No qualifying year-end loan balance detected",
        detail: "Year-end confirmation of loan balance and material terms for each relevant loan.",
      },
      {
        key: "subordination" as DocumentKey,
        ref: "YD04",
        title: "Subordination Agreements",
        requirement:
          subordinationCandidates.length > 0
            ? `${subordinationCandidates.length} detected`
            : "Conditional",
        status:
          subordinationCandidates.length === 0
            ? "No qualifying balance detected"
            : subordinationStatus === "signed"
              ? "Signed"
              : subordinationStatus === "prepared"
                ? "Prepared"
                : "Draft",
        detail:
          entityKind === "cc"
            ? "Support agreements for qualifying member or related-party loan balances."
            : entityKind === "trust"
              ? "Support agreements for qualifying trustee, beneficiary or related-party loan balances."
              : "Support agreements for qualifying shareholder, director or related-party loan balances.",
      },
      {
        key: "going-concern" as DocumentKey,
        ref: "YD05",
        title: "Going Concern Resolution",
        requirement: "Conditional",
        status:
          goingConcernStatus === "signed"
            ? "Signed"
            : goingConcernStatus === "prepared"
              ? "Prepared"
              : "Draft",
        detail: "Formal consideration of going-concern conditions and financial support.",
      },
      {
        key: "distribution" as DocumentKey,
        ref: "YD06",
        title:
          entityKind === "trust"
            ? "Beneficiary Distribution / Vesting Resolution"
            : entityKind === "cc"
              ? "Members' Distribution Resolution"
              : "Dividend / Distribution Resolution",
        requirement:
          detectedDistributionLines.length > 0
            ? `${detectedDistributionLines.length} detected`
            : "Conditional",
        status:
          distributionStatus === "signed"
            ? "Signed"
            : distributionStatus === "prepared"
              ? "Prepared"
              : "Draft",
        detail:
          detectedDistributionLines.length > 0
            ? "A year-end dividend/distribution balance has been detected and should be considered."
            : "Approval of distributions reflected in or arising from the annual financial statements.",
      },
      {
        key: "subsequent-events" as DocumentKey,
        ref: "YD07",
        title: "Events After Reporting Date Resolution",
        requirement: "Conditional",
        status:
          subsequentStatus === "signed"
            ? "Signed"
            : subsequentStatus === "prepared"
              ? "Prepared"
              : "Draft",
        detail: "Records material subsequent events considered before issue of the annual financial statements.",
      },
      {
        key: "other" as DocumentKey,
        ref: "YD08",
        title:
          entityKind === "trust"
            ? "Other Trustee Minute / Resolution"
            : "Other Minute / Resolution",
        requirement: "Optional",
        status:
          otherStatus === "signed"
            ? "Signed"
            : otherStatus === "prepared"
              ? "Prepared"
              : "Draft",
        detail: "Additional year-end approval document where the standard set does not cover the matter.",
      },
      ...(entityKind === "trust"
        ? TRUST_EXTRA_DOCUMENTS.map((document) => ({
            key: document.key as DocumentKey,
            ref: document.ref,
            title: document.title,
            requirement: document.requirement,
            status:
              trustExtraDocuments[document.key].status === "signed"
                ? "Signed"
                : trustExtraDocuments[document.key].status === "prepared"
                  ? "Prepared"
                  : "Draft",
            detail: document.detail,
          }))
        : []),
    ].filter(
      (document) =>
        entityKind !== "trust" ||
        ["YD01", "YD02", "YD03"].includes(document.ref),
    ),
    [
      entityKind,
      loanLines.length,
      approvalStatus,
      minutesStatus,
      loanStatus,
      subordinationStatus,
      subordinationCandidates.length,
      goingConcernStatus,
      distributionStatus,
      detectedDistributionLines.length,
      subsequentStatus,
      otherStatus,
      trustExtraDocuments,
    ],
  );

  return (
    <section style={styles.shell}>
      <div style={styles.summaryBar}>
        <div>
          <strong style={styles.summaryTitle}>Year-end document register</strong>
          <span style={styles.summaryText}>
            Approval documents, minutes, loan certificates and supporting resolutions for the AFS file.
          </span>
        </div>
        <div style={styles.summaryMeta}>
          <span>{effectiveEntityType || "Entity"}</span>
          <span>{loanLines.length} loan certificate candidate{loanLines.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div style={styles.register}>
        <div style={styles.registerHeader}>
          <span>Ref</span>
          <span>Document</span>
          <span>Requirement</span>
          <span>Status</span>
        </div>

        {documents.map((document) => {
          const active = selectedDocument === document.key;
          return (
            <button
              key={document.key}
              type="button"
              onClick={() => setSelectedDocument(document.key)}
              style={{
                ...styles.registerRow,
                ...(active ? styles.registerRowActive : {}),
              }}
            >
              <span style={styles.refCell}>{document.ref}</span>
              <span style={styles.documentCell}>
                <strong>{document.title}</strong>
                <small>{document.detail}</small>
              </span>
              <span style={styles.requirementCell}>{document.requirement}</span>
              <span style={styles.statusCell}>{document.status}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.preview}>
        {selectedDocument === "afs-approval" && (
          <ApprovalDocument
            engagementId={engagementId}
            entityKind={entityKind}
            displayName={displayName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
            framework={framework}
            availableSignatories={signatories}
            selectedSignatories={effectiveApprovalSignatories}
            approvalPlace={approvalPlace}
            approvalDate={approvalDate}
            enabledClauses={approvalClauses}
            status={approvalStatus}
            saving={approvalSaving}
            message={approvalMessage}
            practiceName={practiceName}
            whiteLabel={whiteLabel}
            onPlaceChange={(value) => {
              approvalChanged();
              setApprovalPlace(value);
            }}
            onDateChange={(value) => {
              approvalChanged();
              setApprovalDate(value);
            }}
            onSignatoriesChange={(value) => {
              approvalChanged();
              setApprovalSignatories(value);
            }}
            onClauseChange={(key, checked) => {
              approvalChanged();
              setApprovalClauses((current) => ({
                ...current,
                [key]: checked,
              }));
            }}
            onResetClauses={() => {
              approvalChanged();
              setApprovalClauses({
                ...DEFAULT_TRUST_APPROVAL_CLAUSES,
              });
            }}
            onSaveDraft={() => void saveApprovalDocument("draft")}
            onMarkPrepared={() => void saveApprovalDocument("prepared")}
            onMarkSigned={() => void saveApprovalDocument("signed")}
          />
        )}

        {selectedDocument === "annual-minutes" && (
          <MinutesDocument
            engagementId={engagementId}
            entityKind={entityKind}
            displayName={displayName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
            availablePeople={signatories}
            attendees={effectiveMinutesAttendees}
            chairperson={effectiveMinutesChairperson}
            meetingPlace={minutesPlace}
            meetingDate={minutesDate}
            enabledClauses={minutesClauses}
            status={minutesStatus}
            saving={minutesSaving}
            message={minutesMessage}
            practiceName={practiceName}
            whiteLabel={whiteLabel}
            onPlaceChange={(value) => {
              minutesChanged();
              setMinutesPlace(value);
            }}
            onDateChange={(value) => {
              minutesChanged();
              setMinutesDate(value);
            }}
            onChairpersonChange={(value) => {
              minutesChanged();
              setMinutesChairperson(value);
            }}
            onAttendeesChange={(value) => {
              minutesChanged();
              setMinutesAttendees(value);
            }}
            onClauseChange={(key, checked) => {
              minutesChanged();
              setMinutesClauses((current) => ({
                ...current,
                [key]: checked,
              }));
            }}
            onResetClauses={() => {
              minutesChanged();
              setMinutesClauses({
                ...DEFAULT_TRUST_APPROVAL_CLAUSES,
              });
            }}
            onSaveDraft={() => void saveMinutesDocument("draft")}
            onMarkPrepared={() => void saveMinutesDocument("prepared")}
            onMarkSigned={() => void saveMinutesDocument("signed")}
          />
        )}

        {selectedDocument === "loan-certificates" && (
          <LoanCertificatesDocument
            engagementId={engagementId}
            displayName={displayName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
            loanLines={loanLines}
            loanTerms={loanTerms}
            linkedLoanData={linkedLoanData}
            status={loanStatus}
            saving={loanSaving}
            message={loanMessage}
            practiceName={practiceName}
            whiteLabel={whiteLabel}
            onLoanTermsChange={(key, patch) => {
              if (loanStatus !== "draft") setLoanStatus("draft");
              setLoanMessage("");
              setLoanTerms((current) => ({
                ...current,
                [key]: { ...(current[key] || {}), ...patch },
              }));
            }}
            onSaveDraft={() => void saveLoanCertificates("draft")}
            onMarkPrepared={() => void saveLoanCertificates("prepared")}
            onMarkSigned={() => void saveLoanCertificates("signed")}
          />
        )}

        {selectedDocument === "subordination" && (
          <div style={styles.documentWorkspace}>
            <DocumentActionToolbar
              refCode="YD04"
              title="Subordination Agreements"
              status={subordinationStatus}
              saving={false}
              onSaveDraft={() =>
                void saveSimpleDocument(
                  "subordination",
                  "draft",
                  {},
                  setSubordinationStatus,
                  setSubordinationMessage,
                  "YD04",
                )
              }
              onMarkPrepared={() =>
                void saveSimpleDocument(
                  "subordination",
                  "prepared",
                  {},
                  setSubordinationStatus,
                  setSubordinationMessage,
                  "YD04",
                )
              }
              onMarkSigned={() =>
                void saveSimpleDocument(
                  "subordination",
                  "signed",
                  {},
                  setSubordinationStatus,
                  setSubordinationMessage,
                  "YD04",
                )
              }
            />

            {subordinationMessage ? (
              <div style={styles.documentMessage}>{subordinationMessage}</div>
            ) : null}

            {subordinationCandidates.length === 0 ? (
              <EmptyMessage
                text={
                  entityKind === "cc"
                    ? "No qualifying non-zero member or related-party loan balance has been detected for subordination."
                    : entityKind === "trust"
                      ? "No qualifying non-zero trustee, beneficiary or related-party loan balance has been detected for subordination."
                      : "No qualifying non-zero shareholder, director or related-party loan balance has been detected for subordination."
                }
              />
            ) : (
              <div style={styles.loanCandidateTable}>
                <div style={styles.loanCandidateHeader}>
                  <span>Loan / creditor</span>
                  <span>Balance</span>
                  <span>Requirement</span>
                  <span>Status</span>
                  <span />
                </div>

                {subordinationCandidates.map((line, index) => {
                  const key = String(
                    line.id ||
                      line.account_code ||
                      `${line.account_name}-${index}`,
                  );
                  const selection =
                    subordinationSelections[key] ||
                    Object.values(subordinationSelections || {}).find(
                      (item: any) =>
                        String(item?.trial_balance_line_id || "") ===
                          String(line.id || "") ||
                        (String(item?.account_code || "").trim() &&
                          String(item?.account_code || "").trim() ===
                            String(line.account_code || "").trim()),
                    ) ||
                    {};
                  const isOpen = openSubordinationKey === key;
                  const included = Boolean(selection?.include_in_agreement);

                  return (
                    <div key={key} style={styles.loanCandidateBlock}>
                      <button
                        type="button"
                        style={{
                          ...styles.loanCandidateRow,
                          ...(isOpen ? styles.loanCandidateRowOpen : {}),
                        }}
                        onClick={() =>
                          setOpenSubordinationKey((current) =>
                            current === key ? null : key,
                          )
                        }
                      >
                        <span style={styles.loanCandidateName}>
                          <strong>
                            {selection?.creditor_name ||
                              line.account_name ||
                              "Related-party loan"}
                          </strong>
                          <small>{line.account_code || "No account code"}</small>
                        </span>

                        <span style={styles.loanCandidateAmount}>
                          {formatMoney(currentBalance(line))}
                        </span>

                        <span style={styles.loanCandidateSource}>
                          {included ? "Included" : "Review"}
                        </span>

                        <span style={styles.loanCandidateStatus}>
                          {String(selection?.agreement_status || "Draft")}
                        </span>

                        <span style={styles.loanCandidateToggle}>
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>

                      {isOpen ? (
                        <div style={styles.loanExpandedArea}>
                          <div style={styles.subordinationContextBar}>
                            <div>
                              <strong>
                                {selection?.creditor_name ||
                                  line.account_name ||
                                  "Related-party loan"}
                              </strong>
                              <span>
                                {formatMoney(currentBalance(line))} · Mapping 548
                              </span>
                            </div>
                            <span>
                              Complete the subordination terms below for this loan.
                            </span>
                          </div>

                          {updateSubordinationSelection &&
                          saveSubordinationSelection ? (
                            <SingleSubordinationEditor
                              engagementId={engagementId}
                              line={line}
                              lineIndex={index}
                              selection={selection}
                              selectionKey={key}
                              people={clientPeople}
                              entityKind={entityKind}
                              displayName={displayName}
                              registrationNumber={registrationNumber}
                              yearEnd={yearEnd}
                              practiceName={practiceName}
                              whiteLabel={whiteLabel}
                              saving={savingSubordinationId === key}
                              onChange={(patch) =>
                                updateSubordinationSelection(key, patch)
                              }
                              onSave={() =>
                                saveSubordinationSelection(line, index)
                              }
                            />
                          ) : (
                            <EmptyMessage text="Subordination editing is not connected for this file." />
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedDocument === "going-concern" && (
          <EditableResolutionDocument
            engagementId={engagementId}
            refCode="YD05"
            title="Going Concern Resolution"
            displayName={displayName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
            bodyText={intelligentGoingConcernText}
            status={goingConcernStatus}
            message={goingConcernMessage}
            practiceName={practiceName}
            whiteLabel={whiteLabel}
            signatories={signatories}
            signatureLabel={signatureFallbackLabel(entityKind)}
            placeholder="PracticePilot will use entity-specific going-concern wording. Edit only where the circumstances require different wording."
            onTextChange={(value) => {
              if (goingConcernStatus !== "draft") setGoingConcernStatus("draft");
              setGoingConcernText(value);
              setGoingConcernMessage("");
            }}
            onSaveDraft={() =>
              void saveSimpleDocument(
                "going-concern",
                "draft",
                { text: intelligentGoingConcernText },
                setGoingConcernStatus,
                setGoingConcernMessage,
                "YD05",
              )
            }
            onMarkPrepared={() =>
              void saveSimpleDocument(
                "going-concern",
                "prepared",
                { text: intelligentGoingConcernText },
                setGoingConcernStatus,
                setGoingConcernMessage,
                "YD05",
              )
            }
            onMarkSigned={() =>
              void saveSimpleDocument(
                "going-concern",
                "signed",
                { text: intelligentGoingConcernText },
                setGoingConcernStatus,
                setGoingConcernMessage,
                "YD05",
              )
            }
          />
        )}

        {selectedDocument === "distribution" &&
          (entityKind === "trust" ? (
            <TrustDistributionDocument
              engagementId={engagementId}
              displayName={displayName}
              registrationNumber={registrationNumber}
              yearEnd={yearEnd}
              bodyText={intelligentDistributionText}
              entries={distributionEntries}
              beneficiaries={beneficiaries}
              status={distributionStatus}
              message={distributionMessage}
              practiceName={practiceName}
              whiteLabel={whiteLabel}
              signatories={signatories}
              onTextChange={(value) => {
                if (distributionStatus !== "draft") setDistributionStatus("draft");
                setDistributionText(value);
                setDistributionMessage("");
              }}
              onEntriesChange={(entries) => {
                if (distributionStatus !== "draft") setDistributionStatus("draft");
                setDistributionEntries(entries);
                setDistributionMessage("");
              }}
              onSaveDraft={() =>
                void saveSimpleDocument(
                  "distribution",
                  "draft",
                  { text: intelligentDistributionText, entries: distributionEntries },
                  setDistributionStatus,
                  setDistributionMessage,
                  "YD06",
                )
              }
              onMarkPrepared={() =>
                void saveSimpleDocument(
                  "distribution",
                  "prepared",
                  { text: intelligentDistributionText, entries: distributionEntries },
                  setDistributionStatus,
                  setDistributionMessage,
                  "YD06",
                )
              }
              onMarkSigned={() =>
                void saveSimpleDocument(
                  "distribution",
                  "signed",
                  { text: intelligentDistributionText, entries: distributionEntries },
                  setDistributionStatus,
                  setDistributionMessage,
                  "YD06",
                )
              }
            />
          ) : (
            <EditableResolutionDocument
              engagementId={engagementId}
              refCode="YD06"
              title={
                entityKind === "cc"
                  ? "Members' Distribution Resolution"
                  : "Dividend / Distribution Resolution"
              }
              displayName={displayName}
              registrationNumber={registrationNumber}
              yearEnd={yearEnd}
              bodyText={intelligentDistributionText}
              status={distributionStatus}
              message={distributionMessage}
              practiceName={practiceName}
              whiteLabel={whiteLabel}
              signatories={signatories}
              signatureLabel={signatureFallbackLabel(entityKind)}
              placeholder={
                entityKind === "cc"
                  ? "Record the distribution approved by the members, including the amount, recipient and any conditions."
                  : "Record the dividend/distribution approved by the directors, including the amount, shareholders and any conditions."
              }
              onTextChange={(value) => {
                if (distributionStatus !== "draft") setDistributionStatus("draft");
                setDistributionText(value);
                setDistributionMessage("");
              }}
              onSaveDraft={() =>
                void saveSimpleDocument(
                  "distribution",
                  "draft",
                  { text: intelligentDistributionText },
                  setDistributionStatus,
                  setDistributionMessage,
                  "YD06",
                )
              }
              onMarkPrepared={() =>
                void saveSimpleDocument(
                  "distribution",
                  "prepared",
                  { text: intelligentDistributionText },
                  setDistributionStatus,
                  setDistributionMessage,
                  "YD06",
                )
              }
              onMarkSigned={() =>
                void saveSimpleDocument(
                  "distribution",
                  "signed",
                  { text: intelligentDistributionText },
                  setDistributionStatus,
                  setDistributionMessage,
                  "YD06",
                )
              }
            />
          ))}

        {selectedDocument === "subsequent-events" && (
          <EditableResolutionDocument
            engagementId={engagementId}
            refCode="YD07"
            title="Events After Reporting Date Resolution"
            displayName={displayName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
            bodyText={intelligentSubsequentText}
            status={subsequentStatus}
            message={subsequentMessage}
            practiceName={practiceName}
            whiteLabel={whiteLabel}
            signatories={signatories}
            signatureLabel={signatureFallbackLabel(entityKind)}
            placeholder={
              entityKind === "trust"
                ? "Describe the material event after reporting date and the trustees' conclusion, including whether adjustment or disclosure is required."
                : entityKind === "cc"
                  ? "Describe the material event after reporting date and the members' conclusion, including whether adjustment or disclosure is required."
                  : "Describe the material event after reporting date and the directors' conclusion, including whether adjustment or disclosure is required."
            }
            onTextChange={(value) => {
              if (subsequentStatus !== "draft") setSubsequentStatus("draft");
              setSubsequentText(value);
              setSubsequentMessage("");
            }}
            onSaveDraft={() =>
              void saveSimpleDocument(
                "subsequent-events",
                "draft",
                { text: intelligentSubsequentText },
                setSubsequentStatus,
                setSubsequentMessage,
                "YD07",
              )
            }
            onMarkPrepared={() =>
              void saveSimpleDocument(
                "subsequent-events",
                "prepared",
                { text: intelligentSubsequentText },
                setSubsequentStatus,
                setSubsequentMessage,
                "YD07",
              )
            }
            onMarkSigned={() =>
              void saveSimpleDocument(
                "subsequent-events",
                "signed",
                { text: intelligentSubsequentText },
                setSubsequentStatus,
                setSubsequentMessage,
                "YD07",
              )
            }
          />
        )}

        {selectedDocument === "other" && (
          <EditableResolutionDocument
            engagementId={engagementId}
            refCode="YD08"
            title={
              otherTitle ||
              (entityKind === "trust"
                ? "Other Trustee Minute / Resolution"
                : "Other Minute / Resolution")
            }
            displayName={displayName}
            registrationNumber={registrationNumber}
            yearEnd={yearEnd}
            bodyText={otherText}
            status={otherStatus}
            message={otherMessage}
            practiceName={practiceName}
            whiteLabel={whiteLabel}
            signatories={signatories}
            signatureLabel={signatureFallbackLabel(entityKind)}
            customTitle={otherTitle}
            placeholder="Enter the wording of the additional year-end minute or resolution."
            onTitleChange={(value) => {
              if (otherStatus !== "draft") setOtherStatus("draft");
              setOtherTitle(value);
              setOtherMessage("");
            }}
            onTextChange={(value) => {
              if (otherStatus !== "draft") setOtherStatus("draft");
              setOtherText(value);
              setOtherMessage("");
            }}
            onSaveDraft={() =>
              void saveSimpleDocument(
                "other",
                "draft",
                { title: otherTitle, text: otherText },
                setOtherStatus,
                setOtherMessage,
                "YD08",
              )
            }
            onMarkPrepared={() =>
              void saveSimpleDocument(
                "other",
                "prepared",
                { title: otherTitle, text: otherText },
                setOtherStatus,
                setOtherMessage,
                "YD08",
              )
            }
            onMarkSigned={() =>
              void saveSimpleDocument(
                "other",
                "signed",
                { title: otherTitle, text: otherText },
                setOtherStatus,
                setOtherMessage,
                "YD08",
              )
            }
          />
        )}

        {entityKind === "trust"
          ? TRUST_EXTRA_DOCUMENTS.map((config) => {
              if (selectedDocument !== config.key) return null;

              const state = trustExtraDocuments[config.key];
              const effectiveText =
                state.text.trim() ||
                defaultTrustExtraDocumentText(
                  config.key,
                  displayName,
                  yearEnd,
                );

              return (
                <div key={config.key}>
                  <EditableResolutionDocument
                  engagementId={engagementId}
                  refCode={config.ref}
                  title={config.title}
                  displayName={displayName}
                  registrationNumber={registrationNumber}
                  yearEnd={yearEnd}
                  bodyText={effectiveText}
                  status={state.status}
                  message={state.message}
                  practiceName={practiceName}
                  whiteLabel={whiteLabel}
                  signatories={signatories}
                  signatureLabel="Trustee / authorised signatory"
                  placeholder={config.placeholder}
                  onTextChange={(value) => {
                    updateTrustExtraDocument(config.key, {
                      status: "draft",
                      text: value,
                      message: "",
                    });
                  }}
                  onSaveDraft={() =>
                    void saveTrustExtraDocument(
                      config.key,
                      config.ref,
                      "draft",
                      effectiveText,
                    )
                  }
                  onMarkPrepared={() =>
                    void saveTrustExtraDocument(
                      config.key,
                      config.ref,
                      "prepared",
                      effectiveText,
                    )
                  }
                  onMarkSigned={() =>
                    void saveTrustExtraDocument(
                      config.key,
                      config.ref,
                      "signed",
                      effectiveText,
                    )
                  }
                  />
                </div>
              );
            })
          : null}
      </div>
    </section>
  );
}

function ApprovalDocument({
  engagementId,
  entityKind,
  displayName,
  registrationNumber,
  yearEnd,
  framework,
  availableSignatories,
  selectedSignatories,
  approvalPlace,
  approvalDate,
  enabledClauses,
  status,
  saving,
  message,
  practiceName,
  whiteLabel,
  onPlaceChange,
  onDateChange,
  onSignatoriesChange,
  onClauseChange,
  onResetClauses,
  onSaveDraft,
  onMarkPrepared,
  onMarkSigned,
}: {
  engagementId: string;
  entityKind: EntityKind;
  displayName: string;
  registrationNumber: string;
  yearEnd: string;
  framework: string;
  availableSignatories: string[];
  selectedSignatories: string[];
  approvalPlace: string;
  approvalDate: string;
  enabledClauses: Record<TrustApprovalClauseKey, boolean>;
  status: DocumentStatus;
  saving: boolean;
  message: string;
  practiceName: string;
  whiteLabel: boolean;
  onPlaceChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onSignatoriesChange: (value: string[]) => void;
  onClauseChange: (key: TrustApprovalClauseKey, checked: boolean) => void;
  onResetClauses: () => void;
  onSaveDraft: () => void;
  onMarkPrepared: () => void;
  onMarkSigned: () => void;
}) {
  const documentId = `yd01-${engagementId}`;

  function toggleSignatory(name: string) {
    const current = selectedSignatories.includes(name)
      ? selectedSignatories.filter((item) => item !== name)
      : [...selectedSignatories, name];

    onSignatoriesChange(current);
  }

  function printDocument() {
    const node = document.getElementById(documentId);
    if (!node) return;
    printDocumentNode(
      node,
      entityKind === "trust"
        ? `${displayName} - YD01 - Comprehensive Annual Trustees Resolution`
        : `${displayName} - YD01 - AFS Approval Resolution`,
    );
  }

  function downloadDocument() {
    const node = document.getElementById(documentId);
    if (!node) return;
    void downloadNodePdf(
      node,
      entityKind === "trust"
        ? `${displayName} - YD01 - Comprehensive Annual Trustees Resolution`
        : `${displayName} - YD01 - AFS Approval Resolution`,
      engagementId,
    );
  }

  const trustPreviewItems: React.ReactNode[] =
    entityKind === "trust"
      ? [
          <li key="afs-approval" style={styles.resolutionClause}>
            the annual financial statements of {displayName} for the year ended{" "}
            {formatDate(yearEnd)} be adopted and approved;
          </li>,

          enabledClauses.completeness ? (
            <li key="completeness" style={styles.resolutionClause}>
              the trustees confirm that, to the best of their knowledge and having
              considered the accounting records and supporting information available to
              them, all material assets, liabilities, income, expenditure and other
              balances of the Trust have been appropriately recognised, measured,
              presented and disclosed in the annual financial statements;
            </li>
          ) : null,

          enabledClauses.framework ? (
            framework ? (
              <li key="framework" style={styles.resolutionClause}>
                the annual financial statements have been prepared in accordance with{" "}
                {framework}, read together with the accounting policies adopted by the
                trustees and the provisions of the trust deed;
              </li>
            ) : (
              <li key="framework">
                the accounting policies and basis of preparation applied in the annual
                financial statements be approved, subject to the provisions of the trust
                deed and the applicable financial reporting framework;
              </li>
            )
          ) : null,

          enabledClauses.incomeExpenditure ? (
            <li key="income-expenditure" style={styles.resolutionClause}>
              the income and expenditure reflected in the annual financial statements
              for the year under review be approved and ratified, and any expenditure
              for which normal source documentation is unavailable, where applicable, be
              specifically considered by the trustees and retained in the year-end file
              with the available supporting explanation or evidence;
            </li>
          ) : null,

          enabledClauses.beneficiaryDistributions ? (
            <li key="beneficiary-distributions" style={styles.resolutionClause}>
              all distributions, vestings, benefits and allocations made or proposed to
              beneficiaries during or in respect of the year under review be approved or
              ratified, where applicable, subject to the trust deed, the accounting
              records and any separate beneficiary distribution or vesting resolution;
            </li>
          ) : null,

          enabledClauses.incomeCapitalAllocation ? (
            <li key="income-capital-allocation" style={styles.resolutionClause}>
              the treatment and allocation of income, revenue profits, losses, capital
              gains and capital profits for the year be approved, and any amount not
              vested in or distributed to a beneficiary be retained or accumulated as
              part of the Trust property in accordance with the trust deed;
            </li>
          ) : null,

          enabledClauses.goingConcern ? (
            <li key="going-concern" style={styles.resolutionClause}>
              the trustees have considered the Trust&apos;s ability to continue as a going
              concern and, unless separately resolved otherwise, are satisfied that the
              going-concern basis remains appropriate for the preparation of the annual
              financial statements;
            </li>
          ) : null,

          enabledClauses.subsequentEvents ? (
            <li key="subsequent-events" style={styles.resolutionClause}>
              events and circumstances arising after the reporting date and up to the
              date on which the annual financial statements are approved have been
              considered, and any matter requiring adjustment or disclosure has been
              appropriately dealt with in the annual financial statements or in a
              separate resolution where necessary;
            </li>
          ) : null,

          enabledClauses.trusteeRemuneration ? (
            <li key="trustee-remuneration" style={styles.resolutionClause}>
              trustee remuneration, administration fees and similar charges recorded or
              payable for the year, where applicable, be approved only to the extent
              permitted by the trust deed, properly supported and appropriately recorded
              in the accounting records;
            </li>
          ) : null,

          enabledClauses.loansBorrowings ? (
            <li key="loans-borrowings" style={styles.resolutionClause}>
              all material loans, advances, borrowings, credit facilities, guarantees,
              security arrangements and related-party funding involving the Trust during
              or at the end of the year be approved or ratified where applicable,
              subject to the trust deed and the detailed terms being supported in the
              Trust records;
            </li>
          ) : null,

          enabledClauses.investmentsAssets ? (
            <li key="investments-assets" style={styles.resolutionClause}>
              all material acquisitions, disposals, investments and changes in the
              composition of the Trust property during the year be approved or ratified
              where they fall within the powers of the trustees under the trust deed and
              are supported by the relevant records;
            </li>
          ) : null,

          enabledClauses.conflictsInterests ? (
            <li key="conflicts-interests" style={styles.resolutionClause}>
              the trustees have considered their interests, related-party relationships
              and any actual or potential conflicts arising in connection with the
              affairs of the Trust, and any required disclosure, abstention, independent
              approval or other safeguard be recorded and applied in accordance with the
              trust deed and applicable law;
            </li>
          ) : null,

          enabledClauses.trusteeChanges ? (
            <li key="trustee-changes" style={styles.resolutionClause}>
              all trustee appointments, resignations, vacancies, replacements or other
              changes during or after the year under review, where applicable, be noted
              and the Trust records, Master of the High Court filings and Letters of
              Authority be updated or followed up as required;
            </li>
          ) : null,

          enabledClauses.bankingAuthority ? (
            <li key="banking-authority" style={styles.resolutionClause}>
              the Trust&apos;s banking mandates, account authorities and document-signing
              arrangements be confirmed or approved, and any changes thereto be
              documented in a separate banking or signing-authority resolution where
              required;
            </li>
          ) : null,

          enabledClauses.otherMatters ? (
            <li key="other-matters" style={styles.resolutionClause}>
              all other material matters arising from the annual financial statements or
              the administration of the Trust requiring separate approval, support,
              disclosure or follow-up be dealt with in the relevant supporting
              resolution, minute, certificate or working paper and retained as part of
              the year-end file;
            </li>
          ) : null,

          <li key="authority-sign-issue" style={styles.resolutionClause}>
            the annual financial statements be signed on behalf of the trustees by the
            authorised trustee or trustees appearing below, and the annual financial
            statements may thereafter be issued once the required signatures and
            approvals have been applied.
          </li>,
        ].filter(Boolean)
      : [];


  return (
    <div style={styles.documentWorkspace}>
      <div style={styles.documentToolbar}>
        <div>
          <strong>YD01 · {approvalTitle(entityKind)}</strong>
          <span>
            {entityKind === "trust"
              ? "Complete the annual trustee approval details, select the signatories, then print or download the comprehensive resolution."
              : "Complete the approval details, select the signatories and download the final resolution."}
          </span>
        </div>
        <div style={styles.documentActions}>
          <span style={{
            ...styles.documentStatus,
            ...(status === "signed"
              ? styles.documentStatusSigned
              : status === "prepared"
                ? styles.documentStatusPrepared
                : styles.documentStatusDraft),
          }}>
            {status === "signed" ? "Signed" : status === "prepared" ? "Prepared" : "Draft"}
          </span>

          <button
            type="button"
            style={styles.secondaryActionButton}
            onClick={onSaveDraft}
            disabled={saving}
          >
            Save Draft
          </button>

          <button
            type="button"
            style={styles.secondaryActionButton}
            onClick={onMarkPrepared}
            disabled={saving}
          >
            Mark Prepared
          </button>

          <button
            type="button"
            style={{
              ...styles.secondaryActionButton,
              ...(status !== "prepared" ? styles.disabledActionButton : {}),
            }}
            onClick={onMarkSigned}
            disabled={saving || status !== "prepared"}
            title={status !== "prepared" ? "Mark the document Prepared before marking it Signed." : undefined}
          >
            Mark Signed
          </button>

          <button type="button" style={styles.secondaryActionButton} onClick={printDocument}>
            Print
          </button>
          <button type="button" style={styles.printButton} onClick={downloadDocument}>
            Download PDF
          </button>
        </div>
      </div>

      {message ? <div style={styles.documentMessage}>{message}</div> : null}

      <div style={styles.documentControls}>
        <label style={styles.controlField}>
          <span>Place of approval</span>
          <input
            value={approvalPlace}
            onChange={(event) => onPlaceChange(event.target.value)}
            placeholder="Pretoria"
            style={styles.controlInput}
          />
        </label>

        <label style={styles.controlField}>
          <span>Approval date</span>
          <input
            type="date"
            value={approvalDate}
            onChange={(event) => onDateChange(event.target.value)}
            style={styles.controlInput}
          />
        </label>

        <div style={styles.signatoryControl}>
          <span style={styles.controlLabel}>Signatories</span>
          {availableSignatories.length ? (
            <div style={styles.signatoryChoices}>
              {availableSignatories.map((name) => {
                const selected = selectedSignatories.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleSignatory(name)}
                    style={{
                      ...styles.signatoryChoice,
                      ...(selected ? styles.signatoryChoiceSelected : {}),
                    }}
                  >
                    {selected ? "✓ " : ""}{name}
                  </button>
                );
              })}
            </div>
          ) : (
            <span style={styles.controlHelp}>
              No {responsiblePlural(entityKind)} have been loaded in Client Setup.
            </span>
          )}
        </div>
      </div>

      <div
        style={
          entityKind === "trust"
            ? styles.trustApprovalWorkspace
            : styles.standardApprovalWorkspace
        }
      >
        {entityKind === "trust" ? (
          <aside style={styles.trustApprovalChecklist}>
            <div style={styles.trustChecklistHeader}>
              <div>
                <strong>Annual matters included</strong>
                <span>
                  All are included by default. Switch off only matters that are not
                  relevant to this Trust for the year.
                </span>
              </div>

              <button
                type="button"
                style={styles.smallResetButton}
                onClick={onResetClauses}
              >
                All on
              </button>
            </div>

            <div style={styles.trustChecklistCore}>
              <span style={styles.trustMandatoryBadge}>Required</span>
              <div>
                <strong>AFS adoption and approval</strong>
                <span>Always included.</span>
              </div>
            </div>

            {TRUST_APPROVAL_CLAUSES.map((clause) => (
              <label key={clause.key} style={styles.trustChecklistRow}>
                <input
                  type="checkbox"
                  checked={Boolean(enabledClauses[clause.key])}
                  onChange={(event) =>
                    onClauseChange(clause.key, event.target.checked)
                  }
                />
                <span>
                  <strong>{clause.label}</strong>
                  <small>{clause.help}</small>
                </span>
              </label>
            ))}

            <div style={styles.trustChecklistCore}>
              <span style={styles.trustMandatoryBadge}>Required</span>
              <div>
                <strong>Authority to sign and issue</strong>
                <span>Always included.</span>
              </div>
            </div>
          </aside>
        ) : null}

        <div
          style={
            entityKind === "trust"
              ? styles.liveDocumentPreview
              : styles.standardDocumentPreview
          }
        >
          {entityKind === "trust" ? (
            <>
              <div style={styles.livePreviewHeading}>
                <strong>Live document preview</strong>
                <span>
                  The downloaded PDF uses this content with the final A4 export layout.
                </span>
              </div>

              <div style={styles.previewContinuousShell}>
                <section style={styles.previewContinuousPage}>
                  <div style={styles.previewPageContent}>
                    <div style={styles.identity}>
                      <strong>{displayName}</strong>
                      {registrationNumber ? (
                        <span>Registration No. {registrationNumber}</span>
                      ) : null}
                      <span>
                        Annual financial statements for the year ended{" "}
                        {formatDate(yearEnd)}
                      </span>
                    </div>

                    <h1 style={styles.documentMainTitle}>
                      {approvalTitle(entityKind)}
                    </h1>

                    <p style={styles.bodyText}>
                      {approvalPlace || approvalDate ? (
                        <>
                          Adopted at {approvalPlace || "________________"} on{" "}
                          {approvalDate
                            ? formatDate(approvalDate)
                            : "________________"}.
                        </>
                      ) : (
                        <>Adopted at __________________ on __________________.</>
                      )}
                    </p>

                    <h2 style={styles.documentHeading}>It was resolved that:</h2>

                    <ul style={styles.documentList}>
                      {trustPreviewItems}
                    </ul>

                    <div
                      className="signature-grid"
                      style={styles.previewSignatureArea}
                    >
                      <SignatureBlock
                        names={selectedSignatories}
                        fallbackLabel={signatureFallbackLabel(entityKind)}
                      />
                    </div>
                  </div>

                  <div style={styles.previewPageFooter}>
                    <span>
                      Prepared as part of {practiceName}&apos;s year-end working file.
                    </span>
                    {!whiteLabel ? <span>Powered by PracticePilot</span> : null}
                  </div>
                </section>
              </div>
            </>
          ) : null}

          <div
            style={
              entityKind === "trust"
                ? styles.hiddenExportSource
                : styles.visibleDocumentSource
            }
          >
            <article id={documentId} style={styles.paper}>
            <div className="identity" style={styles.identity}>
            <strong>{displayName}</strong>
            {registrationNumber ? <span>Registration No. {registrationNumber}</span> : null}
            <span>Annual financial statements for the year ended {formatDate(yearEnd)}</span>
            </div>

            <h1 style={styles.documentMainTitle}>{approvalTitle(entityKind)}</h1>

        <p style={styles.bodyText}>
          {approvalPlace || approvalDate ? (
            <>
              Adopted at {approvalPlace || "________________"} on{" "}
              {approvalDate ? formatDate(approvalDate) : "________________"}.
            </>
          ) : (
            <>Adopted at __________________ on __________________.</>
          )}
        </p>

        <h2 style={styles.documentHeading}>It was resolved that:</h2>

        {entityKind === "trust" ? (
          <ul style={styles.documentList}>
            <li style={styles.resolutionClause}>
              the annual financial statements of {displayName} for the year ended{" "}
              {formatDate(yearEnd)} be adopted and approved;
            </li>

            {enabledClauses.completeness ? (
              <li style={styles.resolutionClause}>
                the trustees confirm that, to the best of their knowledge and having
                considered the accounting records and supporting information available to
                them, all material assets, liabilities, income, expenditure and other
                balances of the Trust have been appropriately recognised, measured,
                presented and disclosed in the annual financial statements;
              </li>
            ) : null}

            {enabledClauses.framework ? (
              framework ? (
                <li style={styles.resolutionClause}>
                  the annual financial statements have been prepared in accordance with{" "}
                  {framework}, read together with the accounting policies adopted by the
                  trustees and the provisions of the trust deed;
                </li>
              ) : (
                <li style={styles.resolutionClause}>
                  the accounting policies and basis of preparation applied in the annual
                  financial statements be approved, subject to the provisions of the trust
                  deed and the applicable financial reporting framework;
                </li>
              )
            ) : null}

            {enabledClauses.incomeExpenditure ? (
              <li style={styles.resolutionClause}>
                the income and expenditure reflected in the annual financial statements
                for the year under review be approved and ratified, and any expenditure
                for which normal source documentation is unavailable, where applicable, be
                specifically considered by the trustees and retained in the year-end file
                with the available supporting explanation or evidence;
              </li>
            ) : null}

            {enabledClauses.beneficiaryDistributions ? (
              <li style={styles.resolutionClause}>
                all distributions, vestings, benefits and allocations made or proposed to
                beneficiaries during or in respect of the year under review be approved or
                ratified, where applicable, subject to the trust deed, the accounting
                records and any separate beneficiary distribution or vesting resolution;
              </li>
            ) : null}

            {enabledClauses.incomeCapitalAllocation ? (
              <li style={styles.resolutionClause}>
                the treatment and allocation of income, revenue profits, losses, capital
                gains and capital profits for the year be approved, and any amount not
                vested in or distributed to a beneficiary be retained or accumulated as
                part of the Trust property in accordance with the trust deed;
              </li>
            ) : null}

            {enabledClauses.goingConcern ? (
              <li style={styles.resolutionClause}>
                the trustees have considered the Trust&apos;s ability to continue as a going
                concern and, unless separately resolved otherwise, are satisfied that the
                going-concern basis remains appropriate for the preparation of the annual
                financial statements;
              </li>
            ) : null}

            {enabledClauses.subsequentEvents ? (
              <li style={styles.resolutionClause}>
                events and circumstances arising after the reporting date and up to the
                date on which the annual financial statements are approved have been
                considered, and any matter requiring adjustment or disclosure has been
                appropriately dealt with in the annual financial statements or in a
                separate resolution where necessary;
              </li>
            ) : null}

            {enabledClauses.trusteeRemuneration ? (
              <li style={styles.resolutionClause}>
                trustee remuneration, administration fees and similar charges recorded or
                payable for the year, where applicable, be approved only to the extent
                permitted by the trust deed, properly supported and appropriately recorded
                in the accounting records;
              </li>
            ) : null}

            {enabledClauses.loansBorrowings ? (
              <li style={styles.resolutionClause}>
                all material loans, advances, borrowings, credit facilities, guarantees,
                security arrangements and related-party funding involving the Trust during
                or at the end of the year be approved or ratified where applicable,
                subject to the trust deed and the detailed terms being supported in the
                Trust records;
              </li>
            ) : null}

            {enabledClauses.investmentsAssets ? (
              <li style={styles.resolutionClause}>
                all material acquisitions, disposals, investments and changes in the
                composition of the Trust property during the year be approved or ratified
                where they fall within the powers of the trustees under the trust deed and
                are supported by the relevant records;
              </li>
            ) : null}

            {enabledClauses.conflictsInterests ? (
              <li style={styles.resolutionClause}>
                the trustees have considered their interests, related-party relationships
                and any actual or potential conflicts arising in connection with the
                affairs of the Trust, and any required disclosure, abstention, independent
                approval or other safeguard be recorded and applied in accordance with the
                trust deed and applicable law;
              </li>
            ) : null}

            {enabledClauses.trusteeChanges ? (
              <li style={styles.resolutionClause}>
                all trustee appointments, resignations, vacancies, replacements or other
                changes during or after the year under review, where applicable, be noted
                and the Trust records, Master of the High Court filings and Letters of
                Authority be updated or followed up as required;
              </li>
            ) : null}

            {enabledClauses.bankingAuthority ? (
              <li style={styles.resolutionClause}>
                the Trust&apos;s banking mandates, account authorities and document-signing
                arrangements be confirmed or approved, and any changes thereto be
                documented in a separate banking or signing-authority resolution where
                required;
              </li>
            ) : null}

            {enabledClauses.otherMatters ? (
              <li style={styles.resolutionClause}>
                all other material matters arising from the annual financial statements or
                the administration of the Trust requiring separate approval, support,
                disclosure or follow-up be dealt with in the relevant supporting
                resolution, minute, certificate or working paper and retained as part of
                the year-end file;
              </li>
            ) : null}

            <li>
              the annual financial statements be signed on behalf of the trustees by the
              authorised trustee or trustees appearing below, and the annual financial
              statements may thereafter be issued once the required signatures and
              approvals have been applied.
            </li>
          </ul>
        ) : (
          <ol style={styles.documentList}>
            <li>
              the annual financial statements of {displayName} for the year ended{" "}
              {formatDate(yearEnd)} be adopted and approved;
            </li>
            <li>
              the {responsiblePlural(entityKind)} confirm that, to the best of their
              knowledge, all material assets and liabilities of the entity have been
              appropriately included in the annual financial statements;
            </li>
            {framework ? (
              <li>
                the annual financial statements have been prepared in accordance with{" "}
                {framework};
              </li>
            ) : null}
            <li>
              the income and expenditure reflected in the annual financial statements,
              together with material matters arising from the accounts for the year under
              review, be approved;
            </li>
            <li>
              the annual financial statements be signed on behalf of the{" "}
              {governingBody(entityKind)} by the authorised signatory or signatories
              appearing below; and
            </li>
            <li>
              the annual financial statements may be issued once the required signatures
              have been applied.
            </li>
          </ol>
        )}

        <div className="signature-grid">
          <SignatureBlock names={selectedSignatories} fallbackLabel={signatureFallbackLabel(entityKind)} />
        </div>

        <div className="meta" style={styles.documentFooterNote}>
          <span>Prepared as part of {practiceName}&apos;s year-end working file.</span>
          {!whiteLabel ? <span>Powered by PracticePilot</span> : null}
        </div>

          </article>
          </div>
        </div>
      </div>
    </div>
  );
}

function MinutesDocument({
  engagementId,
  entityKind,
  displayName,
  registrationNumber,
  yearEnd,
  availablePeople,
  attendees,
  chairperson,
  meetingPlace,
  meetingDate,
  enabledClauses,
  status,
  saving,
  message,
  practiceName,
  whiteLabel,
  onPlaceChange,
  onDateChange,
  onChairpersonChange,
  onAttendeesChange,
  onClauseChange,
  onResetClauses,
  onSaveDraft,
  onMarkPrepared,
  onMarkSigned,
}: {
  engagementId: string;
  entityKind: EntityKind;
  displayName: string;
  registrationNumber: string;
  yearEnd: string;
  availablePeople: string[];
  attendees: string[];
  chairperson: string;
  meetingPlace: string;
  meetingDate: string;
  enabledClauses: Record<TrustApprovalClauseKey, boolean>;
  status: DocumentStatus;
  saving: boolean;
  message: string;
  practiceName: string;
  whiteLabel: boolean;
  onPlaceChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onChairpersonChange: (value: string) => void;
  onAttendeesChange: (value: string[]) => void;
  onClauseChange: (key: TrustApprovalClauseKey, checked: boolean) => void;
  onResetClauses: () => void;
  onSaveDraft: () => void;
  onMarkPrepared: () => void;
  onMarkSigned: () => void;
}) {
  const documentId = `yd02-${engagementId}`;

  function toggleAttendee(name: string) {
    const current = attendees.includes(name)
      ? attendees.filter((item) => item !== name)
      : [...attendees, name];

    onAttendeesChange(current);
  }

  function printDocument() {
    const node = document.getElementById(documentId);
    if (!node) return;
    printDocumentNode(
      node,
      entityKind === "trust"
        ? `${displayName} - YD02 - Comprehensive Annual Trustees Meeting Minutes`
        : `${displayName} - YD02 - Annual Meeting Minutes`,
    );
  }

  function downloadDocument() {
    const node = document.getElementById(documentId);
    if (!node) return;
    void downloadNodePdf(
      node,
      entityKind === "trust"
        ? `${displayName} - YD02 - Comprehensive Annual Trustees Meeting Minutes`
        : `${displayName} - YD02 - Annual Meeting Minutes`,
      engagementId,
    );
  }

  const trustMinuteItems: React.ReactNode[] = [
    <li key="afs" style={styles.resolutionClause}>
      the annual financial statements of {displayName} for the year ended{" "}
      {formatDate(yearEnd)} were laid before the meeting, considered and approved for
      issue subject to the required signatures;
    </li>,

    enabledClauses.completeness ? (
      <li key="completeness" style={styles.resolutionClause}>
        the trustees considered the accounting records and supporting information and
        confirmed that, to the best of their knowledge, all material assets,
        liabilities, income, expenditure and other balances were appropriately
        reflected and disclosed in the annual financial statements;
      </li>
    ) : null,

    enabledClauses.framework ? (
      <li key="framework" style={styles.resolutionClause}>
        the accounting policies, applicable financial reporting framework and the
        provisions of the trust deed relevant to the annual financial statements were
        considered and approved;
      </li>
    ) : null,

    enabledClauses.incomeExpenditure ? (
      <li key="income" style={styles.resolutionClause}>
        the income and expenditure for the year were considered and approved. Where
        normal source documentation was unavailable for a material item, the available
        explanation or supporting evidence was considered and is to be retained in the
        year-end file;
      </li>
    ) : null,

    enabledClauses.beneficiaryDistributions ? (
      <li key="distributions" style={styles.resolutionClause}>
        distributions, vestings, benefits and allocations made or proposed to
        beneficiaries were considered and, where applicable, approved or ratified
        subject to the trust deed, the accounting records and any separate beneficiary
        distribution or vesting resolution;
      </li>
    ) : null,

    enabledClauses.incomeCapitalAllocation ? (
      <li key="allocation" style={styles.resolutionClause}>
        the annual treatment of income, revenue profits, losses, capital gains and
        capital profits was considered, including whether amounts were vested,
        distributed, retained or accumulated as part of the Trust property;
      </li>
    ) : null,

    enabledClauses.goingConcern ? (
      <li key="going-concern" style={styles.resolutionClause}>
        the trustees considered the Trust&apos;s ability to continue as a going concern
        and, unless separately resolved otherwise, concluded that the going-concern
        basis remains appropriate;
      </li>
    ) : null,

    enabledClauses.subsequentEvents ? (
      <li key="subsequent-events" style={styles.resolutionClause}>
        events and circumstances arising after the reporting date and up to the date of
        approval of the annual financial statements were considered, and matters
        requiring adjustment, disclosure or separate approval were dealt with
        accordingly;
      </li>
    ) : null,

    enabledClauses.trusteeRemuneration ? (
      <li key="remuneration" style={styles.resolutionClause}>
        trustee remuneration, administration fees and similar charges for the year,
        where applicable, were considered and approved to the extent permitted by the
        trust deed and supported by the accounting records;
      </li>
    ) : null,

    enabledClauses.loansBorrowings ? (
      <li key="loans" style={styles.resolutionClause}>
        material loans, advances, borrowings, credit facilities, guarantees, security
        arrangements and related-party funding involving the Trust were considered,
        and any matter requiring detailed approval or support was referred to the
        relevant supporting resolution or agreement;
      </li>
    ) : null,

    enabledClauses.investmentsAssets ? (
      <li key="investments" style={styles.resolutionClause}>
        material acquisitions, disposals, investments and changes in the composition of
        the Trust property during the year were considered and, where applicable,
        approved or ratified within the powers of the trustees under the trust deed;
      </li>
    ) : null,

    enabledClauses.conflictsInterests ? (
      <li key="conflicts" style={styles.resolutionClause}>
        trustee interests, related-party relationships and actual or potential conflicts
        were considered, and any required disclosure, abstention, independent approval
        or other safeguard was noted and dealt with in accordance with the trust deed
        and applicable law;
      </li>
    ) : null,

    enabledClauses.trusteeChanges ? (
      <li key="trustee-changes" style={styles.resolutionClause}>
        trustee appointments, resignations, vacancies, replacements or other changes
        during or after the year were considered, and any required Trust record, Master
        of the High Court or Letter of Authority update was noted for completion or
        follow-up;
      </li>
    ) : null,

    enabledClauses.bankingAuthority ? (
      <li key="banking" style={styles.resolutionClause}>
        the Trust&apos;s banking mandates, account authorities and document-signing
        arrangements were considered and confirmed, with changes to be documented in a
        separate banking or signing-authority resolution where required;
      </li>
    ) : null,

    enabledClauses.otherMatters ? (
      <li key="other" style={styles.resolutionClause}>
        any other material matter arising from the annual financial statements or the
        administration of the Trust requiring approval, support, disclosure or follow-up
        was referred to the appropriate supporting resolution, minute, certificate or
        working paper;
      </li>
    ) : null,

    <li key="authority" style={styles.resolutionClause}>
      the trustees authorised the approved annual financial statements to be signed and
      issued once all required signatures and approvals have been applied.
    </li>,
  ].filter(Boolean);

  const trustMinutesBody = (
    <>
      <div className="identity">
        <div style={styles.identity}>
          <strong>{displayName}</strong>
          {registrationNumber ? (
            <span>Registration No. {registrationNumber}</span>
          ) : null}
          <span>
            Annual financial statements for the year ended {formatDate(yearEnd)}
          </span>
        </div>
      </div>

      <h1 style={styles.documentMainTitle}>{minutesTitle(entityKind)}</h1>

      <p style={styles.bodyText}>
        Held at {meetingPlace || "________________"} on{" "}
        {meetingDate ? formatDate(meetingDate) : "________________"}.
      </p>

      <div className="attendance" style={styles.minutesAttendance}>
        <strong>Present</strong>
        {attendees.length ? (
          <ul style={styles.minutesAttendanceList}>
            {attendees.map((name) => (
              <li key={name}>
                {name}
                {name === chairperson ? " (Chairperson)" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p style={styles.bodyText}>[Attendance to be completed]</p>
        )}
      </div>

      <h2 style={styles.documentHeading}>Business of the meeting</h2>
      <ul style={styles.documentList}>{trustMinuteItems}</ul>

      <h2 style={styles.documentHeading}>Closure</h2>
      <p style={styles.bodyText}>
        There being no further year-end business to discuss, the meeting was declared
        closed.
      </p>

      <div style={styles.minutesApprovalBlock}>
        <strong>Approved as a true record of the meeting</strong>
        <span>Chairperson: {chairperson || "____________________________"}</span>
        <span>
          Date: {meetingDate ? formatDate(meetingDate) : "________________"}
        </span>
      </div>

      <div style={styles.minutesAttendanceRegister}>
        <strong>Trustee attendance / signature register</strong>
        <table style={styles.minutesRegisterTable}>
          <thead>
            <tr>
              <th style={styles.minutesRegisterCell}>Trustee</th>
              <th style={styles.minutesRegisterCell}>Capacity</th>
              <th style={styles.minutesRegisterCell}>Signature</th>
            </tr>
          </thead>
          <tbody>
            {(attendees.length ? attendees : [""]).map((name, index) => (
              <tr key={`${name || "blank"}-${index}`}>
                <td style={styles.minutesRegisterCell}>
                  {name || "____________________________"}
                </td>
                <td style={styles.minutesRegisterCell}>
                  {name === chairperson ? "Chairperson / Trustee" : "Trustee"}
                </td>
                <td style={styles.minutesRegisterCell}>____________________________</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const genericMinutesDocument = (
    <article id={documentId} style={styles.paper}>
      <div className="identity">
        <div style={styles.identity}>
          <strong>{displayName}</strong>
          {registrationNumber ? <span>Registration No. {registrationNumber}</span> : null}
          <span>Annual financial statements for the year ended {formatDate(yearEnd)}</span>
        </div>
      </div>

      <h1 style={styles.documentMainTitle}>{minutesTitle(entityKind)}</h1>

      <p style={styles.bodyText}>
        Held at {meetingPlace || "________________"} on{" "}
        {meetingDate ? formatDate(meetingDate) : "________________"}.
      </p>

      <div className="attendance" style={styles.minutesAttendance}>
        <strong>Present</strong>
        {attendees.length ? (
          <ul style={styles.minutesAttendanceList}>
            {attendees.map((name) => (
              <li key={name}>
                {name}
                {name === chairperson ? " (Chairperson)" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p style={styles.bodyText}>[Attendance to be completed]</p>
        )}
      </div>

      <h2 style={styles.documentHeading}>Annual Financial Statements</h2>
      <p style={styles.bodyText}>
        The annual financial statements of {displayName} for the year ended{" "}
        {formatDate(yearEnd)} were laid before the meeting and considered.
      </p>

      <p style={styles.bodyText}>
        It was resolved that the annual financial statements be adopted as the accounts
        of the entity for the year under review and that the {responsiblePlural(entityKind)}{" "}
        approve the financial statements for issue subject to the required signatures.
      </p>

      <h2 style={styles.documentHeading}>Matters arising from the accounts</h2>
      <p style={styles.bodyText}>It was further resolved that:</p>
      <ul style={styles.documentList}>
        <li>the income reflected in the annual financial statements be approved;</li>
        <li>the expenditure reflected in the annual financial statements be approved;</li>
        <li>
          material matters arising from the accounts requiring separate approval,
          support or disclosure be dealt with in the relevant year-end resolution.
        </li>
      </ul>

      <h2 style={styles.documentHeading}>
        Interests of the {entityKind === "cc" ? "Members" : "Directors"}
      </h2>
      <p style={styles.bodyText}>
        Any interests required to be disclosed by the {responsiblePlural(entityKind)} were
        noted and are to be dealt with in accordance with the entity&apos;s governing
        documents and applicable law.
      </p>

      <h2 style={styles.documentHeading}>Closure</h2>
      <p style={styles.bodyText}>
        There being no further year-end business to discuss, the meeting was closed.
      </p>

      <div className="signature-grid">
        <SignatureBlock
          names={chairperson ? [chairperson] : attendees.slice(0, 1)}
          fallbackLabel={signatureFallbackLabel(entityKind)}
        />
      </div>

      <div className="meta" style={styles.documentFooterNote}>
        <span>Prepared as part of {practiceName}&apos;s year-end working file.</span>
        {!whiteLabel ? <span>Powered by PracticePilot</span> : null}
      </div>
    </article>
  );

  return (
    <div style={styles.documentWorkspace}>
      <div style={styles.documentToolbar}>
        <div>
          <strong>YD02 · {minutesTitle(entityKind)}</strong>
          <span>
            {entityKind === "trust"
              ? "Record attendance and the annual financial and governance matters considered by the trustees."
              : "Complete the meeting details, attendance and chairperson, then prepare, sign and download the minutes."}
          </span>
        </div>

        <div style={styles.documentActions}>
          <span
            style={{
              ...styles.documentStatus,
              ...(status === "signed"
                ? styles.documentStatusSigned
                : status === "prepared"
                  ? styles.documentStatusPrepared
                  : styles.documentStatusDraft),
            }}
          >
            {status === "signed" ? "Signed" : status === "prepared" ? "Prepared" : "Draft"}
          </span>

          <button type="button" style={styles.secondaryActionButton} onClick={onSaveDraft} disabled={saving}>
            Save Draft
          </button>
          <button type="button" style={styles.secondaryActionButton} onClick={onMarkPrepared} disabled={saving}>
            Mark Prepared
          </button>
          <button
            type="button"
            style={{
              ...styles.secondaryActionButton,
              ...(status !== "prepared" ? styles.disabledActionButton : {}),
            }}
            onClick={onMarkSigned}
            disabled={saving || status !== "prepared"}
          >
            Mark Signed
          </button>
          <button type="button" style={styles.secondaryActionButton} onClick={printDocument}>
            Print
          </button>
          <button type="button" style={styles.printButton} onClick={downloadDocument}>
            Download PDF
          </button>
        </div>
      </div>

      {message ? <div style={styles.documentMessage}>{message}</div> : null}

      <div style={styles.documentControls}>
        <label style={styles.controlField}>
          <span>Meeting place</span>
          <input value={meetingPlace} onChange={(event) => onPlaceChange(event.target.value)} placeholder="Pretoria" style={styles.controlInput} />
        </label>
        <label style={styles.controlField}>
          <span>Meeting date</span>
          <input type="date" value={meetingDate} onChange={(event) => onDateChange(event.target.value)} style={styles.controlInput} />
        </label>
        <label style={styles.controlField}>
          <span>Chairperson</span>
          <select value={chairperson} onChange={(event) => onChairpersonChange(event.target.value)} style={styles.controlInput}>
            <option value="">Select chairperson</option>
            {availablePeople.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <div style={{ ...styles.signatoryControl, gridColumn: "1 / -1" }}>
          <span style={styles.controlLabel}>Attendance</span>
          {availablePeople.length ? (
            <div style={styles.signatoryChoices}>
              {availablePeople.map((name) => {
                const selected = attendees.includes(name);
                return (
                  <button key={name} type="button" onClick={() => toggleAttendee(name)} style={{ ...styles.signatoryChoice, ...(selected ? styles.signatoryChoiceSelected : {}) }}>
                    {selected ? "✓ " : ""}{name}
                  </button>
                );
              })}
            </div>
          ) : (
            <span style={styles.controlHelp}>No {responsiblePlural(entityKind)} have been loaded in Client Setup.</span>
          )}
        </div>
      </div>

      {entityKind === "trust" ? (
        <div style={styles.trustApprovalWorkspace}>
          <aside style={styles.trustApprovalChecklist}>
            <div style={styles.trustChecklistHeader}>
              <div>
                <strong>Annual matters recorded</strong>
                <span>All are included by default. Switch off only matters that were not relevant to this Trust for the year.</span>
              </div>
              <button type="button" style={styles.smallResetButton} onClick={onResetClauses}>All on</button>
            </div>

            <div style={styles.trustChecklistCore}>
              <span style={styles.trustMandatoryBadge}>Required</span>
              <div><strong>AFS considered and approved</strong><span>Always recorded in the minutes.</span></div>
            </div>

            {TRUST_APPROVAL_CLAUSES.map((clause) => (
              <label key={clause.key} style={styles.trustChecklistRow}>
                <input type="checkbox" checked={Boolean(enabledClauses[clause.key])} onChange={(event) => onClauseChange(clause.key, event.target.checked)} />
                <span><strong>{clause.label}</strong><small>{clause.help}</small></span>
              </label>
            ))}

            <div style={styles.trustChecklistCore}>
              <span style={styles.trustMandatoryBadge}>Required</span>
              <div><strong>Authority to sign and issue</strong><span>Always recorded in the minutes.</span></div>
            </div>
          </aside>

          <div style={styles.liveDocumentPreview}>
            <div style={styles.livePreviewHeading}>
              <strong>Live minutes preview</strong>
              <span>Continuous working preview. The downloaded PDF remains properly paginated.</span>
            </div>

            <div style={styles.previewContinuousShell}>
              <section style={styles.previewContinuousPage}>
                <div style={styles.previewPageContent}>{trustMinutesBody}</div>
                <div style={styles.previewPageFooter}>
                  <span>Prepared as part of {practiceName}&apos;s year-end working file.</span>
                  {!whiteLabel ? <span>Powered by PracticePilot</span> : null}
                </div>
              </section>
            </div>

            <div style={styles.hiddenExportSource}>
              <article id={documentId} style={styles.paper}>
                {trustMinutesBody}
                <div className="meta" style={styles.documentFooterNote}>
                  <span>Prepared as part of {practiceName}&apos;s year-end working file.</span>
                  {!whiteLabel ? <span>Powered by PracticePilot</span> : null}
                </div>
              </article>
            </div>
          </div>
        </div>
      ) : (
        genericMinutesDocument
      )}
    </div>
  );
}

function LoanCertificatesDocument({
  engagementId,
  displayName,
  registrationNumber,
  yearEnd,
  loanLines,
  loanTerms,
  linkedLoanData,
  status,
  saving,
  message,
  practiceName,
  whiteLabel,
  onLoanTermsChange,
  onSaveDraft,
  onMarkPrepared,
  onMarkSigned,
}: {
  engagementId: string;
  displayName: string;
  registrationNumber: string;
  yearEnd: string;
  loanLines: TrialBalanceLine[];
  loanTerms: Record<string, {
    creditorName?: string;
    initiationDate?: string;
    security?: string;
    interestRate?: string;
    interestAmount?: string;
    repaymentTerms?: string;
  }>;
  linkedLoanData: Record<string, any>;
  status: DocumentStatus;
  saving: boolean;
  message: string;
  practiceName: string;
  whiteLabel: boolean;
  onLoanTermsChange: (key: string, patch: Record<string, string>) => void;
  onSaveDraft: () => void;
  onMarkPrepared: () => void;
  onMarkSigned: () => void;
}) {
  const [openLoanKey, setOpenLoanKey] = useState<string | null>(null);

  if (!loanLines.length) {
    return (
      <article style={styles.paper}>
        <PreviewHeading
          title="Loan Certificates"
          text="No qualifying non-zero related-party loan balance has been detected from mapping codes 547 / 548."
        />
        <EmptyMessage text="When a qualifying loan is mapped, PracticePilot will create a certificate candidate for that balance." />
      </article>
    );
  }

  function getLoanKey(line: TrialBalanceLine, index: number) {
    return String(line.id || line.account_code || `${line.account_name}-${index}`);
  }

  function effectiveTerms(line: TrialBalanceLine, index: number) {
    const key = getLoanKey(line, index);
    const savedTerms = loanTerms[key] || {};
    const linked = linkedLoanData[key] || {};

    return {
      creditorName:
        savedTerms.creditorName ||
        linked.creditor_name ||
        line.account_name ||
        "",
      initiationDate: savedTerms.initiationDate || "",
      security:
        savedTerms.security ||
        linked.security_terms ||
        "",
      interestRate:
        savedTerms.interestRate ||
        linked.interest_terms ||
        "",
      interestAmount: savedTerms.interestAmount || "",
      repaymentTerms:
        savedTerms.repaymentTerms ||
        linked.repayment_terms ||
        "",
    };
  }

  function printLoan(line: TrialBalanceLine, index: number) {
    const key = getLoanKey(line, index);
    const node = document.getElementById(
      `yd03-certificate-${engagementId}-${key}`,
    );
    if (!node) return;

    printDocumentNode(
      node,
      `${displayName} - Loan Certificate - ${effectiveTerms(line, index).creditorName}`,
    );
  }

  function downloadLoan(line: TrialBalanceLine, index: number) {
    const key = getLoanKey(line, index);
    const node = document.getElementById(
      `yd03-certificate-${engagementId}-${key}`,
    );
    if (!node) return;

    void downloadNodePdf(
      node,
      `${displayName} - Loan Certificate - ${effectiveTerms(line, index).creditorName}`,
      engagementId,
    );
  }

  return (
    <div style={styles.documentWorkspace}>
      <DocumentActionToolbar
        refCode="YD03"
        title="Loan Certificates"
        status={status}
        saving={saving}
        onSaveDraft={onSaveDraft}
        onMarkPrepared={onMarkPrepared}
        onMarkSigned={onMarkSigned}
      />

      {message ? <div style={styles.documentMessage}>{message}</div> : null}

      <div style={styles.loanCandidateTable}>
        <div style={styles.loanCandidateHeader}>
          <span>Loan / lender</span>
          <span>Balance</span>
          <span>Source</span>
          <span>Status</span>
          <span />
        </div>

        {loanLines.map((line, index) => {
          const key = getLoanKey(line, index);
          const terms = effectiveTerms(line, index);
          const linked = linkedLoanData[key] || {};
          const isOpen = openLoanKey === key;

          return (
            <div key={key} style={styles.loanCandidateBlock}>
              <button
                type="button"
                style={{
                  ...styles.loanCandidateRow,
                  ...(isOpen ? styles.loanCandidateRowOpen : {}),
                }}
                onClick={() => setOpenLoanKey((current) => (current === key ? null : key))}
              >
                <span style={styles.loanCandidateName}>
                  <strong>{terms.creditorName || line.account_name}</strong>
                  <small>{line.account_code || "No account code"}</small>
                </span>

                <span style={styles.loanCandidateAmount}>
                  {formatMoney(currentBalance(line))}
                </span>

                <span style={styles.loanCandidateSource}>
                  {linked && Object.keys(linked).length > 0
                    ? "Linked loan data"
                    : "Trial balance"}
                </span>

                <span style={styles.loanCandidateStatus}>
                  {status === "signed"
                    ? "Signed"
                    : status === "prepared"
                      ? "Prepared"
                      : "Draft"}
                </span>

                <span style={styles.loanCandidateToggle}>
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen ? (
                <div style={styles.loanExpandedArea}>
                  {linked && Object.keys(linked).length > 0 ? (
                    <div style={styles.linkedDataNotice}>
                      Loan terms were pre-populated from the year-end loan / subordination data.
                    </div>
                  ) : null}

                  <div style={styles.loanEditGrid}>
                    <label style={styles.controlField}>
                      <span>Creditor / lender</span>
                      <input
                        value={terms.creditorName}
                        onChange={(event) =>
                          onLoanTermsChange(key, {
                            ...terms,
                            creditorName: event.target.value,
                          })
                        }
                        style={styles.controlInput}
                      />
                    </label>

                    <label style={styles.controlField}>
                      <span>Initiation date</span>
                      <input
                        type="date"
                        value={terms.initiationDate}
                        onChange={(event) =>
                          onLoanTermsChange(key, {
                            ...terms,
                            initiationDate: event.target.value,
                          })
                        }
                        style={styles.controlInput}
                      />
                    </label>

                    <label style={styles.controlField}>
                      <span>Interest rate</span>
                      <input
                        value={terms.interestRate}
                        onChange={(event) =>
                          onLoanTermsChange(key, {
                            ...terms,
                            interestRate: event.target.value,
                          })
                        }
                        placeholder="e.g. Prime + 1% / Interest free"
                        style={styles.controlInput}
                      />
                    </label>

                    <label style={styles.controlField}>
                      <span>Security held</span>
                      <input
                        value={terms.security}
                        onChange={(event) =>
                          onLoanTermsChange(key, {
                            ...terms,
                            security: event.target.value,
                          })
                        }
                        placeholder="None / describe security"
                        style={styles.controlInput}
                      />
                    </label>

                    <label style={styles.controlField}>
                      <span>Interest for year / accrued</span>
                      <input
                        value={terms.interestAmount}
                        onChange={(event) =>
                          onLoanTermsChange(key, {
                            ...terms,
                            interestAmount: event.target.value,
                          })
                        }
                        placeholder="R0.00"
                        style={styles.controlInput}
                      />
                    </label>

                    <label style={styles.controlField}>
                      <span>Repayment terms</span>
                      <input
                        value={terms.repaymentTerms}
                        onChange={(event) =>
                          onLoanTermsChange(key, {
                            ...terms,
                            repaymentTerms: event.target.value,
                          })
                        }
                        placeholder="On demand / fixed term / other"
                        style={styles.controlInput}
                      />
                    </label>
                  </div>

                  <div style={styles.loanExpandedActions}>
                    <button
                      type="button"
                      style={styles.secondaryActionButton}
                      onClick={() => printLoan(line, index)}
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      style={styles.printButton}
                      onClick={() => downloadLoan(line, index)}
                    >
                      Download PDF
                    </button>
                  </div>

                  <article
                    id={`yd03-certificate-${engagementId}-${key}`}
                    className="certificate-page"
                    style={styles.paper}
                  >
                    <DocumentIdentity
                      displayName={displayName}
                      registrationNumber={registrationNumber}
                      yearEnd={yearEnd}
                    />

                    <h1 style={styles.documentMainTitle}>Loan Certificate</h1>

                    <p style={styles.bodyText}>
                      <strong>Certificate of Loan Balance and Terms</strong>
                    </p>

                    <p style={styles.bodyText}>
                      I / We hereby certify that the balance owing to{" "}
                      <strong>{terms.creditorName || line.account_name}</strong> by{" "}
                      <strong>{displayName}</strong> amounted to{" "}
                      <strong>{formatMoney(currentBalance(line))}</strong> as at{" "}
                      <strong>{formatDate(yearEnd)}</strong>, and that the material
                      terms of the loan were as follows:
                    </p>

                    <div style={styles.certificateGrid}>
                      <span>Initiation date</span>
                      <strong>
                        {terms.initiationDate
                          ? formatDate(terms.initiationDate)
                          : "—"}
                      </strong>

                      <span>Security held</span>
                      <strong>{terms.security || "—"}</strong>

                      <span>Interest rate</span>
                      <strong>{terms.interestRate || "—"}</strong>

                      <span>Interest for year / accrued</span>
                      <strong>{terms.interestAmount || "—"}</strong>

                      <span>Repayment terms</span>
                      <strong>{terms.repaymentTerms || "—"}</strong>
                    </div>

                    <SignatureBlock
                      names={[terms.creditorName || line.account_name]}
                    />

                    <DocumentFooter
                      practiceName={practiceName}
                      whiteLabel={whiteLabel}
                    />
                  </article>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function SingleSubordinationEditor({
  engagementId,
  line,
  lineIndex,
  selection,
  selectionKey,
  people,
  entityKind,
  displayName,
  registrationNumber,
  yearEnd,
  practiceName,
  whiteLabel,
  saving,
  onChange,
  onSave,
}: {
  engagementId: string;
  line: TrialBalanceLine;
  lineIndex: number;
  selection: Record<string, any>;
  selectionKey: string;
  people: ClientPerson[];
  entityKind: EntityKind;
  displayName: string;
  registrationNumber: string;
  yearEnd: string;
  practiceName: string;
  whiteLabel: boolean;
  saving: boolean;
  onChange: (patch: Record<string, any>) => void;
  onSave: () => void;
}) {
  const included = Boolean(selection?.include_in_agreement);

  const relevantPeople = (people || []).filter((person) => {
    const type = String(person?.person_type || "").toLowerCase();

    if (entityKind === "trust") return type.includes("trustee");
    if (entityKind === "cc") return type.includes("member");

    return type.includes("director");
  });

  const creditorName =
    String(selection?.creditor_name || line.account_name || "").trim();

  const signatoryName = String(selection?.company_signatory_name || "").trim();

  const signatoryLabel =
    entityKind === "trust"
      ? "Trustee signing for the trust"
      : entityKind === "cc"
        ? "Member signing for the close corporation"
        : "Director / authorised person signing for the company";

  const defaultRelationship =
    entityKind === "trust"
      ? "Trustee / beneficiary / related-party loan"
      : entityKind === "cc"
        ? "Member loan"
        : "Shareholder / director / related-party loan";

  const entitySignatureLabel =
    entityKind === "trust"
      ? "For and on behalf of the Trust"
      : entityKind === "cc"
        ? "For and on behalf of the Close Corporation"
        : "For and on behalf of the Company";

  function handleSignatory(personId: string) {
    const person =
      relevantPeople.find((item) => String(item.id) === personId) || null;

    onChange({
      company_signatory_person_id: person?.id || null,
      company_signatory_name: person?.full_name || null,
      company_signatory_capacity:
        entityKind === "trust"
          ? "Trustee"
          : entityKind === "cc"
            ? "Member"
            : "Director",
    });
  }

  function printAgreement() {
    const node = document.getElementById(
      `yd04-agreement-${selectionKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    );

    if (!node) return;

    printDocumentNode(
      node,
      `${displayName} - Subordination Agreement - ${creditorName || line.account_name}`,
    );
  }

  function downloadAgreement() {
    const node = document.getElementById(
      `yd04-agreement-${selectionKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    );

    if (!node) return;

    void downloadNodePdf(
      node,
      `${displayName} - Subordination Agreement - ${creditorName || line.account_name}`,
      engagementId,
    );
  }

  return (
    <div style={styles.singleSubordinationEditor}>
      <div style={styles.subordinationDecisionRow}>
        <div>
          <strong>Subordinate this loan?</strong>
          <span>
            Choose Yes only where this balance is to be included in a
            subordination agreement.
          </span>
        </div>

        <div style={styles.yesNoButtons}>
          <button
            type="button"
            style={{
              ...styles.yesNoButton,
              ...(included ? styles.yesNoButtonActive : {}),
            }}
            onClick={() =>
              onChange({
                include_in_agreement: true,
                agreement_status:
                  String(selection?.agreement_status || "Draft") || "Draft",
              })
            }
          >
            Yes
          </button>

          <button
            type="button"
            style={{
              ...styles.yesNoButton,
              ...(!included ? styles.yesNoButtonActiveNeutral : {}),
            }}
            onClick={() =>
              onChange({
                include_in_agreement: false,
                agreement_status: "Draft",
              })
            }
          >
            No
          </button>
        </div>
      </div>

      {included ? (
        <>
          <div style={styles.subordinationFormGrid}>
            <label style={styles.controlField}>
              <span>Creditor name</span>
              <input
                value={creditorName}
                onChange={(event) =>
                  onChange({ creditor_name: event.target.value })
                }
                style={styles.controlInput}
              />
            </label>

            <label style={styles.controlField}>
              <span>Relationship</span>
              <input
                value={String(
                  selection?.relationship || defaultRelationship,
                )}
                onChange={(event) =>
                  onChange({ relationship: event.target.value })
                }
                style={styles.controlInput}
              />
            </label>

            <label style={styles.controlField}>
              <span>Interest terms</span>
              <input
                value={String(selection?.interest_terms || "")}
                onChange={(event) =>
                  onChange({ interest_terms: event.target.value })
                }
                placeholder="e.g. Interest free / Prime + 1%"
                style={styles.controlInput}
              />
            </label>

            <label style={styles.controlField}>
              <span>Repayment terms</span>
              <input
                value={String(selection?.repayment_terms || "")}
                onChange={(event) =>
                  onChange({ repayment_terms: event.target.value })
                }
                placeholder="e.g. No fixed repayment terms"
                style={styles.controlInput}
              />
            </label>

            <label style={styles.controlField}>
              <span>Security</span>
              <input
                value={String(selection?.security_terms || "")}
                onChange={(event) =>
                  onChange({ security_terms: event.target.value })
                }
                placeholder="e.g. Unsecured"
                style={styles.controlInput}
              />
            </label>

            <label style={styles.controlField}>
              <span>{signatoryLabel}</span>
              <select
                value={String(
                  selection?.company_signatory_person_id || "",
                )}
                onChange={(event) => handleSignatory(event.target.value)}
                style={styles.controlInput}
              >
                <option value="">Select person</option>
                {relevantPeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.controlFieldWide}>
              <span>Subordination terms</span>
              <textarea
                value={String(selection?.subordination_terms || "")}
                onChange={(event) =>
                  onChange({ subordination_terms: event.target.value })
                }
                placeholder="Record any specific limitation, duration, repayment restriction or other agreed term."
                style={styles.largeTextarea}
              />
            </label>
          </div>

          <div style={styles.subordinationActionRow}>
            <span>
              Balance at year end:{" "}
              <strong>{formatMoney(currentBalance(line))}</strong>
            </span>

            <div style={styles.subordinationActionButtons}>
              <button
                type="button"
                style={styles.secondaryActionButton}
                onClick={printAgreement}
              >
                Print
              </button>

              <button
                type="button"
                style={styles.printButton}
                onClick={downloadAgreement}
              >
                Download PDF
              </button>

              <button
                type="button"
                style={styles.printButton}
                disabled={saving}
                onClick={onSave}
              >
                {saving ? "Saving..." : "Save loan"}
              </button>
            </div>
          </div>

          <article
            id={`yd04-agreement-${selectionKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
            className="certificate-page"
            style={{ ...styles.paper, display: "none" }}
          >
            <DocumentIdentity
              displayName={displayName}
              registrationNumber={registrationNumber}
              yearEnd={yearEnd}
            />

            <h1 style={styles.documentMainTitle}>Subordination Agreement</h1>

            <p style={styles.bodyText}>
              This agreement records the subordination of the amount owing by{" "}
              <strong>{displayName}</strong> to{" "}
              <strong>{creditorName || line.account_name}</strong> as at{" "}
              <strong>{formatDate(yearEnd)}</strong>.
            </p>

            <div style={styles.certificateGrid}>
              <span>Balance</span>
              <strong>{formatMoney(Math.abs(currentBalance(line)))}</strong>

              <span>Relationship</span>
              <strong>
                {String(
                  selection?.relationship || defaultRelationship,
                )}
              </strong>

              <span>Interest terms</span>
              <strong>{String(selection?.interest_terms || "—")}</strong>

              <span>Repayment terms</span>
              <strong>{String(selection?.repayment_terms || "—")}</strong>

              <span>Security</span>
              <strong>{String(selection?.security_terms || "—")}</strong>
            </div>

            <p style={styles.bodyText}>
              This agreement is entered into between{" "}
              <strong>{creditorName || line.account_name}</strong> ("the Creditor")
              and <strong>{displayName}</strong> ("the Entity").
            </p>

            <p style={styles.bodyText}>
              The Creditor is reflected in the accounting records of the Entity as
              having advanced or left amounts owing to the Entity under account{" "}
              <strong>{line.account_code || "—"}</strong>.
            </p>

            <ol style={styles.subordinationClauses}>
              <li>
                <strong>Indebtedness.</strong> The Creditor acknowledges that the
                Entity is indebted to the Creditor in respect of the above loan
                account and any further amounts which may become owing by the Entity
                to the Creditor from time to time, whether by way of loan, advance,
                credit, capital contribution or any similar arrangement.
              </li>
              <li>
                <strong>Subordination.</strong> The Creditor irrevocably
                subordinates, in favour of the other present and future creditors
                of the Entity, all claims which the Creditor has or may in future
                have against the Entity, to the extent necessary to ensure that the
                claims of those other creditors rank in priority to the Creditor&apos;s
                claim.
              </li>
              <li>
                <strong>Repayment restriction.</strong> The Entity shall not repay,
                settle, set off, reduce or otherwise discharge any subordinated
                amount to the Creditor while such repayment would result in the
                Entity being unable to pay its debts as they become due in the
                ordinary course of business, or where the liabilities of the Entity
                would exceed its assets fairly valued.
              </li>
              <li>
                <strong>No demand for payment.</strong> The Creditor undertakes not
                to demand, sue for, prove a claim for, accept payment of, or
                otherwise seek to recover the subordinated amount, except to the
                extent that the Entity is solvent and liquid after taking such
                payment into account.
              </li>
              <li>
                <strong>No preference or security.</strong> The Creditor shall not
                obtain or enforce any security, preference, cession, pledge, lien,
                set-off or other advantage in respect of the subordinated amount
                which would prejudice the rights of the other creditors of the
                Entity.
              </li>
              <li>
                <strong>Continuing effect.</strong> This subordination shall remain
                in force until the {responsiblePlural(entityKind)} of the Entity are satisfied
                that the assets of the Entity, fairly valued, exceed its liabilities
                and that the Entity is able to pay its debts as they become due in
                the ordinary course of business.
              </li>
              <li>
                <strong>Accounting records.</strong> This agreement is prepared
                with reference to the accounting records and working papers of the
                Entity for the financial year ended{" "}
                <strong>{formatDate(yearEnd)}</strong>. The parties acknowledge
                that the final amount owing may be adjusted by subsequent
                accounting entries, repayments, advances or other transactions.
              </li>
              <li>
                <strong>Governing law.</strong> This agreement shall be governed by
                and interpreted in accordance with the laws of the Republic of
                South Africa.
              </li>
            </ol>

            {String(selection?.subordination_terms || "").trim() ? (
              <p style={styles.bodyText}>
                <strong>Specific additional terms:</strong>{" "}
                {String(selection?.subordination_terms || "")}
              </p>
            ) : null}

            <div style={styles.originalAgreementSignatures}>
              <div style={styles.agreementSignatureColumn}>
                <div style={styles.agreementSignatureLine} />
                <strong>For and on behalf of the Creditor</strong>
                <span>
                  Name: {creditorName || line.account_name}
                </span>
                <span>Date: ____________________</span>
              </div>

              <div style={styles.agreementSignatureColumn}>
                <div style={styles.agreementSignatureLine} />
                <strong>{entitySignatureLabel}</strong>
                <span>Name: {signatoryName || "____________________"}</span>
                <span>
                  Capacity: {String(
                    selection?.company_signatory_capacity ||
                      (entityKind === "trust"
                        ? "Trustee / authorised signatory"
                        : entityKind === "cc"
                          ? "Member / authorised signatory"
                          : "Authorised signatory")
                  )}
                </span>
                <span>Date: ____________________</span>
              </div>
            </div>

            <DocumentFooter
              practiceName={practiceName}
              whiteLabel={whiteLabel}
            />
          </article>
        </>
      ) : (
        <div style={styles.subordinationNotRequired}>
          This loan is marked <strong>Not subordinated</strong>. Save the loan to
          record the decision.
          <button
            type="button"
            style={styles.printButton}
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving..." : "Save decision"}
          </button>
        </div>
      )}
    </div>
  );
}

function SimpleDocumentShell({
  refCode,
  title,
  status,
  message,
  children,
  onSaveDraft,
  onMarkPrepared,
  onMarkSigned,
}: {
  refCode: string;
  title: string;
  status: DocumentStatus;
  message: string;
  practiceName: string;
  whiteLabel: boolean;
  children: ReactNode;
  onSaveDraft: () => void;
  onMarkPrepared: () => void;
  onMarkSigned: () => void;
}) {
  return (
    <div style={styles.documentWorkspace}>
      <DocumentActionToolbar
        refCode={refCode}
        title={title}
        status={status}
        saving={false}
        onSaveDraft={onSaveDraft}
        onMarkPrepared={onMarkPrepared}
        onMarkSigned={onMarkSigned}
      />
      {message ? <div style={styles.documentMessage}>{message}</div> : null}
      {children}
    </div>
  );
}

function TrustDistributionDocument({
  engagementId,
  displayName,
  registrationNumber,
  yearEnd,
  bodyText,
  entries,
  beneficiaries,
  status,
  message,
  practiceName,
  whiteLabel,
  signatories,
  onTextChange,
  onEntriesChange,
  onSaveDraft,
  onMarkPrepared,
  onMarkSigned,
}: {
  engagementId: string;
  displayName: string;
  registrationNumber: string;
  yearEnd: string;
  bodyText: string;
  entries: TrustDistributionEntry[];
  beneficiaries: string[];
  status: DocumentStatus;
  message: string;
  practiceName: string;
  whiteLabel: boolean;
  signatories: string[];
  onTextChange: (value: string) => void;
  onEntriesChange: (entries: TrustDistributionEntry[]) => void;
  onSaveDraft: () => void;
  onMarkPrepared: () => void;
  onMarkSigned: () => void;
}) {
  const documentId = `YD06-${displayName}`.replace(/\s+/g, "-");

  function addEntry() {
    onEntriesChange([
      ...entries,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        beneficiary: "",
        category: "Income",
        amount: "",
        form: "Cash",
        vestingDate: "",
        paymentTerms: "",
        notes: "",
      },
    ]);
  }

  function updateEntry(
    id: string,
    patch: Partial<TrustDistributionEntry>,
  ) {
    onEntriesChange(
      entries.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function removeEntry(id: string) {
    onEntriesChange(entries.filter((entry) => entry.id !== id));
  }

  function printDocument() {
    const node = document.getElementById(documentId);
    if (!node) return;
    printDocumentNode(
      node,
      `${displayName} - Beneficiary Distribution / Vesting Resolution`,
    );
  }

  function downloadDocument() {
    const node = document.getElementById(documentId);
    if (!node) return;
    void downloadNodePdf(
      node,
      `${displayName} - Beneficiary Distribution / Vesting Resolution`,
      engagementId,
    );
  }

  return (
    <div style={styles.documentWorkspace}>
      <DocumentActionToolbar
        refCode="YD06"
        title="Beneficiary Distribution / Vesting Resolution"
        status={status}
        saving={false}
        onSaveDraft={onSaveDraft}
        onMarkPrepared={onMarkPrepared}
        onMarkSigned={onMarkSigned}
        onPrint={printDocument}
        onDownload={downloadDocument}
      />

      {message ? <div style={styles.documentMessage}>{message}</div> : null}

      <div style={styles.documentControls}>
        <label style={{ ...styles.controlField, gridColumn: "1 / -1" }}>
          <span>Resolution wording</span>
          <textarea
            value={bodyText}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Record the Trust distribution / vesting decision."
            style={styles.largeTextarea}
          />
        </label>

        <div style={{ gridColumn: "1 / -1", display: "grid", gap: "6px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
          }}>
            <div>
              <strong style={{ fontSize: "11px" }}>
                Beneficiary distributions / vestings
              </strong>
              <div style={styles.controlHelp}>
                Capture each beneficiary item separately so the resolution,
                accounting record and Trust tax workpaper can be reconciled.
              </div>
            </div>
            <button
              type="button"
              style={styles.secondaryActionButton}
              onClick={addEntry}
            >
              + Add distribution
            </button>
          </div>

          {entries.length ? (
            entries.map((entry, index) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid #d7dee8",
                  background: "#ffffff",
                  padding: "8px",
                  display: "grid",
                  gap: "7px",
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "8px",
                  alignItems: "center",
                }}>
                  <strong style={{ fontSize: "10px" }}>
                    Distribution {index + 1}
                  </strong>
                  <button
                    type="button"
                    style={styles.secondaryActionButton}
                    onClick={() => removeEntry(entry.id)}
                  >
                    Remove
                  </button>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "7px",
                }}>
                  <label style={styles.controlField}>
                    <span>Beneficiary</span>
                    {beneficiaries.length ? (
                      <select
                        value={entry.beneficiary}
                        onChange={(event) =>
                          updateEntry(entry.id, {
                            beneficiary: event.target.value,
                          })
                        }
                        style={styles.controlInput}
                      >
                        <option value="">Select beneficiary</option>
                        {beneficiaries.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={entry.beneficiary}
                        onChange={(event) =>
                          updateEntry(entry.id, {
                            beneficiary: event.target.value,
                          })
                        }
                        placeholder="Beneficiary name"
                        style={styles.controlInput}
                      />
                    )}
                  </label>

                  <label style={styles.controlField}>
                    <span>Nature</span>
                    <select
                      value={entry.category}
                      onChange={(event) =>
                        updateEntry(entry.id, {
                          category: event.target.value,
                        })
                      }
                      style={styles.controlInput}
                    >
                      <option value="Income">Income</option>
                      <option value="Capital">Capital</option>
                      <option value="Capital gain">Capital gain</option>
                      <option value="Trust property">Trust property</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label style={styles.controlField}>
                    <span>Amount / value</span>
                    <input
                      value={entry.amount}
                      onChange={(event) =>
                        updateEntry(entry.id, {
                          amount: event.target.value,
                        })
                      }
                      placeholder="0.00"
                      style={styles.controlInput}
                    />
                  </label>

                  <label style={styles.controlField}>
                    <span>Form of benefit</span>
                    <select
                      value={entry.form}
                      onChange={(event) =>
                        updateEntry(entry.id, {
                          form: event.target.value,
                        })
                      }
                      style={styles.controlInput}
                    >
                      <option value="Cash">Cash</option>
                      <option value="In specie">In specie</option>
                      <option value="Applied for beneficiary">
                        Applied for beneficiary
                      </option>
                      <option value="Invested for beneficiary">
                        Invested for beneficiary
                      </option>
                      <option value="Retained under trustee control">
                        Retained under trustee control
                      </option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label style={styles.controlField}>
                    <span>Vesting date</span>
                    <input
                      type="date"
                      value={entry.vestingDate}
                      onChange={(event) =>
                        updateEntry(entry.id, {
                          vestingDate: event.target.value,
                        })
                      }
                      style={styles.controlInput}
                    />
                  </label>

                  <label style={styles.controlField}>
                    <span>Payment / transfer terms</span>
                    <input
                      value={entry.paymentTerms}
                      onChange={(event) =>
                        updateEntry(entry.id, {
                          paymentTerms: event.target.value,
                        })
                      }
                      placeholder="Paid now / payable later / transfer details"
                      style={styles.controlInput}
                    />
                  </label>
                </div>

                <label style={styles.controlField}>
                  <span>Conditions / notes</span>
                  <input
                    value={entry.notes}
                    onChange={(event) =>
                      updateEntry(entry.id, {
                        notes: event.target.value,
                      })
                    }
                    placeholder="Conditions, asset details, conflict handling or supporting reference"
                    style={styles.controlInput}
                  />
                </label>
              </div>
            ))
          ) : (
            <EmptyMessage text="No beneficiary distribution / vesting entries have been captured yet." />
          )}
        </div>
      </div>

      <article id={documentId} style={styles.paper}>
        <DocumentIdentity
          displayName={displayName}
          registrationNumber={registrationNumber}
          yearEnd={yearEnd}
        />
        <h1 style={styles.documentMainTitle}>
          Beneficiary Distribution / Vesting Resolution
        </h1>

        <p style={styles.bodyText}>It was resolved that:</p>
        <p style={styles.bodyText}>{bodyText}</p>

        {entries.length ? (
          <>
            <h2 style={styles.documentHeading}>
              Approved beneficiary distributions / vestings
            </h2>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "8px",
              fontSize: "10px",
            }}>
              <thead>
                <tr>
                  {[
                    "Beneficiary",
                    "Nature",
                    "Amount / value",
                    "Form",
                    "Vesting date",
                    "Payment / terms",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #94a3b8",
                        padding: "5px 4px",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ padding: "5px 4px", verticalAlign: "top" }}>
                      {entry.beneficiary || "—"}
                    </td>
                    <td style={{ padding: "5px 4px", verticalAlign: "top" }}>
                      {entry.category || "—"}
                    </td>
                    <td style={{ padding: "5px 4px", verticalAlign: "top" }}>
                      {entry.amount || "—"}
                    </td>
                    <td style={{ padding: "5px 4px", verticalAlign: "top" }}>
                      {entry.form || "—"}
                    </td>
                    <td style={{ padding: "5px 4px", verticalAlign: "top" }}>
                      {entry.vestingDate
                        ? formatDate(entry.vestingDate)
                        : "—"}
                    </td>
                    <td style={{ padding: "5px 4px", verticalAlign: "top" }}>
                      {entry.paymentTerms || "—"}
                      {entry.notes ? ` · ${entry.notes}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        <SignatureBlock
          names={signatories}
          fallbackLabel="Trustee / authorised signatory"
        />
        <DocumentFooter practiceName={practiceName} whiteLabel={whiteLabel} />
      </article>
    </div>
  );
}

function EditableResolutionDocument({
  engagementId,
  refCode,
  title,
  displayName,
  registrationNumber,
  yearEnd,
  bodyText,
  status,
  message,
  practiceName,
  whiteLabel,
  signatories = [],
  signatureLabel = "Authorised signatory",
  placeholder,
  customTitle,
  onTitleChange,
  onTextChange,
  onSaveDraft,
  onMarkPrepared,
  onMarkSigned,
}: {
  engagementId: string;
  refCode: string;
  title: string;
  displayName: string;
  registrationNumber: string;
  yearEnd: string;
  bodyText: string;
  status: DocumentStatus;
  message: string;
  practiceName: string;
  whiteLabel: boolean;
  signatories?: string[];
  signatureLabel?: string;
  placeholder?: string;
  customTitle?: string;
  onTitleChange?: (value: string) => void;
  onTextChange: (value: string) => void;
  onSaveDraft: () => void;
  onMarkPrepared: () => void;
  onMarkSigned: () => void;
}) {
  const documentId = `${refCode}-${displayName}`.replace(/\s+/g, "-");

  function printDocument() {
    const node = document.getElementById(documentId);
    if (!node) return;
    printDocumentNode(node, `${displayName} - ${title}`);
  }

  function downloadDocument() {
    const node = document.getElementById(documentId);
    if (!node) return;
    void downloadNodePdf(
      node,
      `${displayName} - ${title}`,
      engagementId,
    );
  }

  return (
    <div style={styles.documentWorkspace}>
      <DocumentActionToolbar
        refCode={refCode}
        title={title}
        status={status}
        saving={false}
        onSaveDraft={onSaveDraft}
        onMarkPrepared={onMarkPrepared}
        onMarkSigned={onMarkSigned}
        onPrint={printDocument}
        onDownload={downloadDocument}
      />

      {message ? <div style={styles.documentMessage}>{message}</div> : null}

      <div style={styles.documentControls}>
        {onTitleChange ? (
          <label style={{ ...styles.controlField, gridColumn: "1 / -1" }}>
            <span>Document title</span>
            <input
              value={customTitle || ""}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Other Minute / Resolution"
              style={styles.controlInput}
            />
          </label>
        ) : null}

        <label style={{ ...styles.controlField, gridColumn: "1 / -1" }}>
          <span>Resolution wording</span>
          <textarea
            value={bodyText}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={placeholder}
            style={styles.largeTextarea}
          />
        </label>
      </div>

      <article id={documentId} style={styles.paper}>
        <DocumentIdentity
          displayName={displayName}
          registrationNumber={registrationNumber}
          yearEnd={yearEnd}
        />
        <h1 style={styles.documentMainTitle}>{title}</h1>
        <p style={styles.bodyText}>It was resolved that:</p>
        <p style={styles.bodyText}>{bodyText || "[Resolution wording to be completed]"}</p>
        <SignatureBlock names={signatories} fallbackLabel={signatureLabel} />
        <DocumentFooter practiceName={practiceName} whiteLabel={whiteLabel} />
      </article>
    </div>
  );
}

function DocumentActionToolbar({
  refCode,
  title,
  status,
  saving,
  onSaveDraft,
  onMarkPrepared,
  onMarkSigned,
  onPrint,
  onDownload,
}: {
  refCode: string;
  title: string;
  status: DocumentStatus;
  saving: boolean;
  onSaveDraft: () => void;
  onMarkPrepared: () => void;
  onMarkSigned: () => void;
  onPrint?: () => void;
  onDownload?: () => void;
}) {
  return (
    <div style={styles.documentToolbar}>
      <div>
        <strong>{refCode} · {title}</strong>
      </div>
      <div style={styles.documentActions}>
        <span
          style={{
            ...styles.documentStatus,
            ...(status === "signed"
              ? styles.documentStatusSigned
              : status === "prepared"
                ? styles.documentStatusPrepared
                : styles.documentStatusDraft),
          }}
        >
          {status === "signed" ? "Signed" : status === "prepared" ? "Prepared" : "Draft"}
        </span>
        <button type="button" style={styles.secondaryActionButton} onClick={onSaveDraft} disabled={saving}>
          Save Draft
        </button>
        <button type="button" style={styles.secondaryActionButton} onClick={onMarkPrepared} disabled={saving}>
          Mark Prepared
        </button>
        <button
          type="button"
          style={{
            ...styles.secondaryActionButton,
            ...(status !== "prepared" ? styles.disabledActionButton : {}),
          }}
          onClick={onMarkSigned}
          disabled={saving || status !== "prepared"}
        >
          Mark Signed
        </button>
        {onPrint ? (
          <button
            type="button"
            style={styles.secondaryActionButton}
            onClick={onPrint}
          >
            Print
          </button>
        ) : null}

        {onDownload ? (
          <button
            type="button"
            style={styles.printButton}
            onClick={onDownload}
          >
            Download PDF
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DocumentFooter({
  practiceName,
  whiteLabel,
}: {
  practiceName: string;
  whiteLabel: boolean;
}) {
  return (
    <div className="meta" style={styles.documentFooterNote}>
      <span>Prepared as part of {practiceName}&apos;s year-end working file.</span>
      {!whiteLabel ? <span>Powered by PracticePilot</span> : null}
    </div>
  );
}

function printDocumentNode(node: HTMLElement, title: string) {
  const printWindow = window.open("", "_blank", "width=900,height=1000");

  if (!printWindow) {
    window.alert("Could not open the print window.");
    return;
  }

  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
      }

      body {
        padding: 16mm;
        font-size: 10.5pt;
        line-height: 1.45;
      }

      article,
      .document,
      .certificate-page {
        display: block !important;
        width: 100% !important;
        max-width: none !important;
        min-height: 248mm;
        margin: 0 !important;
        padding: 0 0 20mm !important;
        border: 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
        color: #111827 !important;
      }

      h1 {
        margin: 0 0 6mm !important;
        padding: 0 0 2.5mm !important;
        border-bottom: 1px solid #111827;
        color: #111827 !important;
        font-size: 15.5pt !important;
        line-height: 1.2 !important;
        font-weight: 700 !important;
      }

      h2 {
        margin: 6mm 0 2mm !important;
        font-size: 11.5pt !important;
      }

      h3,
      h4 {
        margin: 5mm 0 1.5mm !important;
        font-size: 10.5pt !important;
      }

      p,
      li {
        font-size: 10.5pt !important;
        line-height: 1.48 !important;
      }

      p {
        margin: 0 0 3mm !important;
      }

      ol,
      ul {
        margin: 2mm 0 4mm !important;
        padding-left: 6mm !important;
      }

      li {
        margin: 0 0 2mm !important;
      }

      table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 4mm 0 !important;
      }

      th,
      td {
        padding: 2.2mm 1.6mm !important;
        vertical-align: top !important;
        font-size: 8.8pt !important;
        line-height: 1.35 !important;
      }

      .identity {
        margin: 0 0 7mm !important;
        color: #334155 !important;
        font-size: 9pt !important;
        line-height: 1.35 !important;
      }

      .signature-grid {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 10mm 14mm !important;
        margin-top: 14mm !important;
      }

      .signature {
        break-inside: avoid;
        font-size: 9pt !important;
      }

      .meta {
        position: fixed !important;
        left: 16mm !important;
        right: 16mm !important;
        bottom: 7mm !important;
        margin: 0 !important;
        padding-top: 2mm !important;
        border-top: 1px solid #e5e7eb !important;
        background: #ffffff !important;
        color: #6b7280 !important;
        display: flex !important;
        justify-content: space-between !important;
        gap: 8mm !important;
        font-size: 7.5pt !important;
        line-height: 1.2 !important;
      }

      input,
      select,
      textarea,
      button,
      .no-print {
        display: none !important;
      }

      @page {
        size: A4;
        margin: 16mm 16mm 18mm;
      }
    </style>
  </head>
  <body>
    ${node.outerHTML}
    <script>
      window.addEventListener("load", function () {
        window.print();
      });
    </script>
  </body>
</html>`);

  printWindow.document.close();
}

async function downloadNodePdf(
  node: HTMLElement,
  title: string,
  engagementId: string,
) {
  try {
    if (!supabase) {
      throw new Error("Supabase client is not available.");
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";

    if (!token) {
      throw new Error("Not authenticated.");
    }

    const response = await fetch(
      `/api/afs/engagements/${engagementId}/year-end-documents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          html: node.outerHTML,
        }),
      },
    );

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "Could not generate the PDF.");
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = disposition.match(/filename="([^"]+)"/i);
    const filename =
      filenameMatch?.[1] ||
      `${title.replace(/\s+-\s+/g, " _ ").replace(/[\\/:*?"<>|]/g, "").trim()}.pdf`;

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error: any) {
    console.error("YEAR-END DOCUMENT PDF ERROR:", error);
    window.alert(error?.message || "Could not download the PDF.");
  }
}

function normaliseStatus(value: unknown): DocumentStatus {
  return value === "signed" ? "signed" : value === "prepared" ? "prepared" : "draft";
}

function statusMessage(refCode: string, status: DocumentStatus) {
  return status === "signed"
    ? `${refCode} marked Signed.`
    : status === "prepared"
      ? `${refCode} marked Prepared.`
      : `${refCode} draft saved.`;
}

function PreviewHeading({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.previewHeading}>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <span style={styles.draftBadge}>Draft template</span>
    </div>
  );
}

function DocumentIdentity({
  displayName,
  registrationNumber,
  yearEnd,
}: {
  displayName: string;
  registrationNumber: string;
  yearEnd: string;
}) {
  return (
    <div style={styles.identity}>
      <strong>{displayName}</strong>
      {registrationNumber ? <span>Registration No. {registrationNumber}</span> : null}
      <span>Annual financial statements for the year ended {formatDate(yearEnd)}</span>
    </div>
  );
}

function SignatureBlock({
  names,
  fallbackLabel = "Authorised signatory",
}: {
  names: string[];
  fallbackLabel?: string;
}) {
  const shownNames = names.length ? names : [fallbackLabel];
  return (
    <div className="signature-grid" style={styles.signatures}>
      {shownNames.slice(0, 3).map((name) => (
        <div key={name} className="signature" style={styles.signature}>
          <span>________________________________</span>
          <strong>{name}</strong>
          <small>Date: __________________</small>
        </div>
      ))}
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <div style={styles.emptyMessage}>{text}</div>;
}

type EntityKind = "company" | "npc" | "cc" | "trust" | "other";

function normaliseEntityKind(value: string): EntityKind {
  const clean = value.toLowerCase();
  if (clean.includes("trust")) return "trust";
  if (clean.includes("close corporation") || clean === "cc" || clean.includes("close corp")) return "cc";
  if (clean.includes("non-profit") || clean.includes("non profit") || clean.includes("npc")) return "npc";
  if (clean.includes("company") || clean.includes("pty") || clean.includes("limited")) return "company";
  return "other";
}

function approvalTitle(kind: EntityKind) {
  if (kind === "trust") return "Comprehensive Annual Trustees' Resolution";
  if (kind === "cc") return "Members' Resolution – Approval of Annual Financial Statements";
  return "Directors' Resolution – Approval of Annual Financial Statements";
}

function minutesTitle(kind: EntityKind) {
  if (kind === "trust") return "Comprehensive Annual Trustees' Meeting Minutes";
  if (kind === "cc") return "Minutes of Members' Meeting";
  return "Minutes of Directors' Meeting";
}

function entityNoun(kind: EntityKind) {
  if (kind === "trust") return "trust";
  if (kind === "cc") return "close corporation";
  if (kind === "npc") return "non-profit company";
  if (kind === "company") return "company";
  return "entity";
}

function responsiblePeople(kind: EntityKind) {
  if (kind === "trust") return "trustees";
  if (kind === "cc") return "members";
  return "directors";
}


function defaultTrustExtraDocumentText(
  key: TrustExtraDocumentKey,
  displayName: string,
  yearEnd: string,
) {
  const yearEndLabel = formatDate(yearEnd);

  switch (key) {
    case "trust-income-allocation":
      return `The trustees considered the income, profits, expenditure, operating result and losses of ${displayName} for the year ended ${yearEndLabel}, together with the provisions of the trust deed and the annual financial statements.

It was resolved that the treatment of the Trust's income, profits and losses for the year be recorded in accordance with the trustees' decisions, the trust deed and applicable law. Any amount vested in a beneficiary must identify the beneficiary, nature and amount of the vested benefit and effective date. Any amount not vested or distributed is retained as part of the Trust property.`;

    case "trust-capital-allocation":
      return `The trustees considered all capital gains, capital profits, capital losses and other capital movements of ${displayName} for the year ended ${yearEndLabel}.

It was resolved that each capital amount be allocated, vested, distributed or retained in accordance with the trust deed and applicable law. Any beneficiary allocation must identify the beneficiary, the capital amount or asset concerned, the amount or value and the effective vesting or distribution date.`;

    case "trust-retention":
      return `The trustees considered all income, profits, capital gains and other amounts not distributed or vested in beneficiaries during the year ended ${yearEndLabel}.

It was resolved that such undistributed amounts be retained and accumulated as Trust property of ${displayName}, subject to the trust deed, and that the accounting records and annual financial statements reflect the resulting accumulated funds appropriately.`;

    case "trust-remuneration":
      return `The trustees considered remuneration, administration fees and professional charges paid or payable in connection with the administration of ${displayName} for the year ended ${yearEndLabel}.

It was resolved that the remuneration or fees recorded in this resolution be approved only to the extent permitted by the trust deed, supported by the services rendered and properly recorded in the accounting records. Any trustee with a personal interest in the remuneration must not participate contrary to the trust deed or applicable law.`;

    case "trust-loan-approval":
      return `The trustees considered the material loans, borrowings, credit facilities, advances and security arrangements involving ${displayName} at or during the year ended ${yearEndLabel}.

It was resolved that the arrangements recorded in this resolution be approved or ratified subject to the trust deed. The lender or borrower, amount, interest basis, repayment terms, security, purpose, related-party status and authority for the transaction must be documented.`;

    case "trust-investment":
      return `The trustees considered the material acquisitions, disposals, investments and changes in the composition of the Trust property of ${displayName} during the year ended ${yearEndLabel}.

It was resolved that the transactions recorded in this resolution be approved or ratified where they fall within the powers granted to the trustees by the trust deed, and that the relevant assets, values, transaction terms and supporting documents be retained in the Trust records.`;

    case "trust-conflicts":
      return `The trustees considered their interests, related-party relationships and any actual or potential conflicts arising in connection with the affairs of ${displayName} for the year ended ${yearEndLabel}.

It was resolved that each relevant interest or conflict be recorded, that affected trustees comply with the decision-making restrictions in the trust deed, and that any abstention, independent approval or other safeguard be documented in the Trust records.`;

    case "trustee-changes":
      return `The trustees considered all appointments, resignations, vacancies, replacements and changes in the trustees of ${displayName} during or after the year ended ${yearEndLabel}.

It was resolved that the Trust records be updated for each change and that any acceptance, resignation, appointment, Master of the High Court filing, Letter of Authority update or other required administrative action be completed and retained in the year-end file.`;

    case "trust-banking-authority":
      return `The trustees considered the banking arrangements and document-signing authorities of ${displayName}.

It was resolved that the banking mandates and signing authorities recorded in this resolution be approved, including the relevant account or facility, authorised trustee or trustees, signing rule and effective date, subject to the trust deed and the requirements of the financial institution.`;
    default:
      return "The trustees considered the matter and resolved that the decision be recorded in the Trust's year-end working file.";
  }
}

function defaultDistributionResolutionText(
  entityKind: EntityKind,
  displayName: string,
  detectedLines: TrialBalanceLine[],
) {
  const detectedTotal = detectedLines.reduce(
    (sum, line) => sum + Math.abs(currentBalance(line)),
    0,
  );

  const detectedSentence =
    detectedLines.length > 0
      ? ` The annual financial statements reflect a year-end dividend/distribution balance of ${formatMoney(detectedTotal)}.`
      : "";

  if (entityKind === "trust") {
    return `The trustees considered all distributions, vestings and benefits made or proposed by ${displayName} in accordance with the trust deed and the information reflected in the annual financial statements.${detectedSentence}

It was resolved that each beneficiary distribution or vesting recorded below be approved subject to the terms of the trust deed and applicable law. For each item the trustees must identify the beneficiary, the nature of the amount or property (including income, capital or capital gain where applicable), the amount or value, whether the benefit is paid in cash, transferred in specie, applied for the beneficiary, invested on the beneficiary's behalf or retained under trustee control, the vesting date where relevant, and any payment terms or conditions.

The trustees further confirm that the beneficiary concerned falls within the class of beneficiaries permitted by the trust deed and that any trustee who is also affected by the decision has complied with the conflict and decision-making requirements of the trust deed.`;
  }

  if (entityKind === "cc") {
    return `The members considered the distributions made or proposed by ${displayName} and the amounts reflected in the annual financial statements.${detectedSentence}

It was resolved that the distributions recorded in the annual financial statements be approved and ratified, subject to the entity meeting the applicable financial requirements at the date of each distribution and the final recipients and amounts being supported by the accounting records.`;
  }

  return `The directors considered the dividends and/or distributions made or proposed by ${displayName} and the amounts reflected in the annual financial statements.${detectedSentence}

It was resolved that the dividends and/or distributions recorded in the annual financial statements be approved and ratified, subject to the applicable solvency and liquidity requirements being satisfied at the relevant date and the final shareholders and amounts being supported by the accounting records.`;
}

function defaultSubsequentEventsText(
  entityKind: EntityKind,
  displayName: string,
) {
  const people =
    entityKind === "trust"
      ? "trustees"
      : entityKind === "cc"
        ? "members"
        : "directors";

  return `The ${people} considered events and circumstances arising after the reporting date of ${displayName} and up to the date on which the annual financial statements are approved.

It was resolved that any material event identified during this period must be assessed to determine whether adjustment of, or disclosure in, the annual financial statements is required. Where no material event requiring adjustment or disclosure has been identified, the annual financial statements may be approved on that basis.`;
}

function buildGoingConcernResolutionText({
  entityKind,
  hasFormalSupport,
}: {
  entityKind: EntityKind;
  hasFormalSupport: boolean;
}) {
  const people = responsiblePeople(entityKind);
  const entity = entityNoun(entityKind);

  if (hasFormalSupport) {
    return `The ${people} considered the ${entity}'s ability to continue as a going concern, including its financial position at year end, expected cash flows, commitments, liabilities as they fall due and the financial support and/or subordination arrangements documented in the year-end file.

Having considered the above information and the support available to the ${entity}, it was resolved that the ${people} are satisfied that the ${entity} is expected to have access to sufficient resources to continue in operation for the foreseeable future and that preparation of the annual financial statements on the going concern basis remains appropriate.`;
  }

  return `The ${people} considered the ${entity}'s ability to continue as a going concern, including its financial position at year end, expected cash flows, commitments, liabilities as they fall due and all other information available in respect of the foreseeable future.

Having considered the above information, it was resolved that the ${people} are satisfied that the ${entity} is expected to have access to sufficient resources to continue in operation for the foreseeable future and that preparation of the annual financial statements on the going concern basis remains appropriate.`;
}

function governingBody(kind: EntityKind) {
  if (kind === "trust") return "trustees";
  if (kind === "cc") return "members";
  return "board";
}

function responsiblePlural(kind: EntityKind) {
  if (kind === "trust") return "trustees";
  if (kind === "cc") return "members";
  return "directors";
}

function signatureFallbackLabel(kind: EntityKind) {
  if (kind === "trust") return "Trustee / authorised signatory";
  if (kind === "cc") return "Member / authorised signatory";
  return "Authorised signatory";
}

function getEntitySignatories(people: ClientPerson[] | undefined, kind: EntityKind) {
  const safePeople = Array.isArray(people) ? people : [];

  const preferred = safePeople.filter((person) => {
    const type = String(person.person_type || "").toLowerCase();
    if (kind === "trust") return type.includes("trustee");
    if (kind === "cc") return type.includes("member");
    return type.includes("director");
  });

  return preferred.map((person) => person.full_name).filter(Boolean);
}

function loanLinesFromMappings(trialBalanceLines: TrialBalanceLine[]) {
  return (trialBalanceLines || []).filter((line) => {
    const code = cleanCode(line.mapping_code);

    const isRelatedPartyLoan =
      startsWithMapping(code, "547") || startsWithMapping(code, "548");

    if (!isRelatedPartyLoan) return false;

    const balance = currentBalance(line);
    if (Math.abs(balance) < 0.005) return false;

    const name = String(line.account_name || line.description || "")
      .trim()
      .toLowerCase();

    const looksLikeMovementOnly =
      name.includes("repayment") ||
      name.includes("movement") ||
      name.includes("transfer") ||
      name.includes("journal");

    return !looksLikeMovementOnly;
  });
}

function cleanCode(value: unknown) {
  return String(value || "").trim();
}

function startsWithMapping(value: string, prefix: string) {
  return value === prefix || value.startsWith(`${prefix}.`);
}

function currentBalance(line: TrialBalanceLine) {
  if (line.current_year_balance !== null && line.current_year_balance !== undefined) {
    return Number(line.current_year_balance || 0);
  }
  return Number(line.debit || 0) - Number(line.credit || 0);
}

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "[year-end]";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const styles: Record<string, CSSProperties> = {
  shell: { display: "grid", gap: "10px" },
  summaryBar: {
    background: "#ffffff",
    border: "1px solid #d7dee8",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
  },
  summaryTitle: { display: "block", fontSize: "14px", color: "#0f172a" },
  summaryText: { display: "block", marginTop: "3px", fontSize: "10.5px", color: "#64748b" },
  summaryMeta: { display: "flex", gap: "8px", fontSize: "10px", color: "#475569", whiteSpace: "nowrap" },
  register: { background: "#ffffff", border: "1px solid #d7dee8" },
  registerHeader: {
    display: "grid",
    gridTemplateColumns: "70px minmax(420px, 1fr) 150px 190px",
    minHeight: "32px",
    alignItems: "center",
    padding: "0 10px",
    borderBottom: "1px solid #d7dee8",
    background: "#f8fbff",
    fontSize: "9px",
    fontWeight: 850,
    color: "#64748b",
  },
  registerRow: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "70px minmax(420px, 1fr) 150px 190px",
    alignItems: "center",
    minHeight: "46px",
    padding: "0 10px",
    border: 0,
    borderBottom: "1px solid #e5eaf1",
    background: "#ffffff",
    cursor: "pointer",
    textAlign: "left",
    color: "#0f172a",
  },
  registerRowActive: { background: "#eef5ff", boxShadow: "inset 3px 0 0 #2563eb" },
  refCell: { fontSize: "10px", fontWeight: 900, color: "#2563eb" },
  documentCell: { display: "grid", gap: "2px" },
  requirementCell: { fontSize: "10px", fontWeight: 800, color: "#475569" },
  statusCell: { fontSize: "10px", fontWeight: 800, color: "#166534" },
  preview: { minWidth: 0 },
  previewHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    paddingBottom: "10px",
    borderBottom: "1px solid #d7dee8",
    marginBottom: "14px",
  },
  draftBadge: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    padding: "4px 7px",
    fontSize: "9px",
    fontWeight: 850,
    color: "#1d4ed8",
    whiteSpace: "nowrap",
  },
  documentWorkspace: { display: "grid", gap: "10px" },
  previewContinuousShell: {
    display: "flex",
    justifyContent: "center",
  },
  previewContinuousPage: {
    position: "relative",
    width: "min(100%, 794px)",
    minHeight: "1123px",
    padding: "54px 58px 74px",
    background: "#ffffff",
    border: "1px solid #d7dee8",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  },
  previewPageContent: {
    fontSize: "12px",
    lineHeight: 1.55,
  },
  previewSignatureArea: {
    marginTop: "34px",
  },
  previewPageFooter: {
    marginTop: "48px",
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    paddingTop: "8px",
    borderTop: "1px solid #e5e7eb",
    color: "#6b7280",
    fontSize: "8px",
    lineHeight: 1.2,
  },
  hiddenExportSource: {
    position: "absolute",
    left: "-100000px",
    top: 0,
    width: "794px",
    pointerEvents: "none",
  },
  visibleDocumentSource: {
    display: "block",
  },
  standardApprovalWorkspace: {
    display: "block",
  },
  standardDocumentPreview: {
    minWidth: 0,
  },
  trustApprovalWorkspace: {
    display: "grid",
    gridTemplateColumns: "360px minmax(0, 1fr)",
    gap: "14px",
    alignItems: "start",
  },
  trustApprovalChecklist: {
    position: "sticky",
    top: "10px",
    display: "grid",
    gap: "6px",
    padding: "10px",
    border: "1px solid #d7dee8",
    background: "#ffffff",
  },
  trustChecklistHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: "10px",
    paddingBottom: "8px",
    borderBottom: "1px solid #e5e7eb",
  },
  smallResetButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "4px 7px",
    fontSize: "9px",
    fontWeight: 850,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  trustChecklistCore: {
    display: "grid",
    gridTemplateColumns: "60px 1fr",
    gap: "8px",
    alignItems: "start",
    padding: "7px 6px",
    background: "#f8fafc",
    borderBottom: "1px solid #eef2f7",
    fontSize: "10px",
  },
  trustMandatoryBadge: {
    display: "inline-flex",
    justifyContent: "center",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "2px 4px",
    fontSize: "8px",
    fontWeight: 900,
  },
  trustChecklistRow: {
    display: "grid",
    gridTemplateColumns: "18px 1fr",
    gap: "7px",
    alignItems: "start",
    padding: "6px",
    borderBottom: "1px solid #eef2f7",
    cursor: "pointer",
    fontSize: "10px",
    color: "#0f172a",
  },
  liveDocumentPreview: {
    minWidth: 0,
    padding: "10px",
    background: "#eef3f8",
    border: "1px solid #d7dee8",
  },
  livePreviewHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "0 2px 8px",
    color: "#475569",
    fontSize: "9px",
  },
  documentToolbar: {
    background: "#ffffff",
    border: "1px solid #d7dee8",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
  },
  documentActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  documentStatus: {
    padding: "5px 8px",
    border: "1px solid #cbd5e1",
    fontSize: "9px",
    fontWeight: 900,
  },
  documentStatusDraft: { background: "#f8fafc", color: "#475569" },
  documentStatusPrepared: { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" },
  documentStatusSigned: { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" },
  secondaryActionButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "7px 10px",
    fontSize: "10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  disabledActionButton: { opacity: 0.45, cursor: "not-allowed" },
  documentMessage: {
    padding: "8px 10px",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e40af",
    fontSize: "10px",
    fontWeight: 750,
  },
  documentControls: {
    background: "#ffffff",
    border: "1px solid #d7dee8",
    padding: "10px 12px",
    display: "grid",
    gridTemplateColumns: "220px 190px minmax(320px, 1fr)",
    gap: "12px",
    alignItems: "start",
  },
  controlField: { display: "grid", gap: "4px", fontSize: "10px", fontWeight: 800, color: "#475569" },
  controlLabel: { fontSize: "10px", fontWeight: 800, color: "#475569" },
  controlInput: {
    height: "32px",
    border: "1px solid #cbd5e1",
    padding: "0 9px",
    fontSize: "11px",
    color: "#0f172a",
    background: "#ffffff",
  },
  signatoryControl: { display: "grid", gap: "5px" },
  signatoryChoices: { display: "flex", flexWrap: "wrap", gap: "5px" },
  signatoryChoice: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "6px 8px",
    fontSize: "10px",
    fontWeight: 750,
    color: "#334155",
    cursor: "pointer",
  },
  signatoryChoiceSelected: {
    borderColor: "#93c5fd",
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  controlHelp: { fontSize: "10px", color: "#64748b" },
  printButton: {
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    padding: "7px 11px",
    fontSize: "10px",
    fontWeight: 850,
    cursor: "pointer",
  },
  documentMainTitle: {
    margin: "0 0 18px",
    fontSize: "18px",
    lineHeight: 1.25,
    color: "#0f172a",
  },
  documentFooterNote: {
    marginTop: "28px",
    paddingTop: "8px",
    borderTop: "1px solid #e2e8f0",
    fontSize: "9px",
    color: "#94a3b8",
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
  },
  paper: {
    background: "#ffffff",
    border: "1px solid #d7dee8",
    padding: "22px 28px",
    maxWidth: "980px",
  },
  identity: { display: "grid", gap: "3px", marginBottom: "20px", fontSize: "11px", color: "#334155" },
  bodyText: { fontSize: "11px", lineHeight: 1.65, color: "#1e293b" },
  documentList: {
    paddingLeft: "24px",
    fontSize: "11px",
    lineHeight: 1.5,
    color: "#1e293b",
    margin: 0,
    listStyleType: "disc",
    listStylePosition: "outside",
  },
  resolutionClause: {
    display: "list-item",
    marginBottom: "10px",
    paddingLeft: "4px",
  },
  documentHeading: { fontSize: "12px", margin: "18px 0 6px", color: "#0f172a" },
  signatures: { display: "flex", gap: "34px", flexWrap: "wrap", marginTop: "34px" },
  signature: { minWidth: "220px", display: "grid", gap: "5px", fontSize: "10px", color: "#334155" },
  minutesAttendance: {
    margin: "14px 0 18px",
    fontSize: "11px",
    color: "#1e293b",
  },
  minutesAttendanceList: {
    margin: "6px 0 0",
    paddingLeft: "20px",
    fontSize: "11px",
    lineHeight: 1.55,
  },
  minutesApprovalBlock: {
    display: "grid",
    gap: "6px",
    marginTop: "28px",
    paddingTop: "12px",
    borderTop: "1px solid #cbd5e1",
    fontSize: "10px",
    color: "#334155",
  },
  minutesAttendanceRegister: {
    display: "grid",
    gap: "8px",
    marginTop: "24px",
    fontSize: "10px",
    color: "#334155",
  },
  minutesRegisterTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  minutesRegisterCell: {
    padding: "8px 6px",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "left",
    verticalAlign: "top",
    fontSize: "9px",
  },
  linkedDataNotice: {
    marginBottom: "12px",
    padding: "8px 10px",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e40af",
    fontSize: "10px",
    lineHeight: 1.4,
  },
  loanCandidateTable: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
  },
  loanCandidateHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1.5fr) 140px 150px 100px 34px",
    gap: "10px",
    alignItems: "center",
    padding: "7px 10px",
    borderBottom: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#475569",
    fontSize: "10px",
    fontWeight: 800,
  },
  loanCandidateBlock: {
    borderBottom: "1px solid #e2e8f0",
  },
  loanCandidateRow: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1.5fr) 140px 150px 100px 34px",
    gap: "10px",
    alignItems: "center",
    border: 0,
    background: "#ffffff",
    padding: "9px 10px",
    color: "#0f172a",
    textAlign: "left",
    cursor: "pointer",
  },
  loanCandidateRowOpen: {
    background: "#eff6ff",
    boxShadow: "inset 3px 0 0 #2563eb",
  },
  loanCandidateName: {
    display: "grid",
    gap: "2px",
    minWidth: 0,
  },
  loanCandidateAmount: {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
  },
  loanCandidateSource: {
    color: "#475569",
    fontSize: "10px",
  },
  loanCandidateStatus: {
    color: "#166534",
    fontSize: "10px",
    fontWeight: 800,
  },
  loanCandidateToggle: {
    textAlign: "center",
    fontSize: "16px",
    fontWeight: 900,
  },
  loanExpandedArea: {
    padding: "10px",
    background: "#f8fafc",
    borderTop: "1px solid #dbeafe",
    display: "grid",
    gap: "10px",
  },
  singleSubordinationEditor: {
    display: "grid",
    gap: "12px",
  },
  subordinationDecisionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    padding: "10px 0",
    borderBottom: "1px solid #cbd5e1",
    color: "#334155",
    fontSize: "11px",
  },
  yesNoButtons: {
    display: "flex",
    gap: "6px",
    flexShrink: 0,
  },
  yesNoButton: {
    minWidth: "58px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#334155",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: 850,
    cursor: "pointer",
  },
  yesNoButtonActive: {
    borderColor: "#166534",
    background: "#ecfdf5",
    color: "#166534",
  },
  yesNoButtonActiveNeutral: {
    borderColor: "#475569",
    background: "#f1f5f9",
    color: "#0f172a",
  },
  subordinationFormGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px 14px",
  },
  controlFieldWide: {
    display: "grid",
    gap: "4px",
    gridColumn: "1 / -1",
    color: "#334155",
    fontSize: "10px",
    fontWeight: 800,
  },
  subordinationActionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    borderTop: "1px solid #cbd5e1",
    paddingTop: "10px",
    color: "#475569",
    fontSize: "11px",
  },
  subordinationActionButtons: {
    display: "flex",
    gap: "8px",
  },
  subordinationNotRequired: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "10px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#475569",
    fontSize: "11px",
  },
  subordinationClauses: {
    margin: "10px 0 14px",
    paddingLeft: "20px",
    display: "grid",
    gap: "7px",
    color: "#111827",
    fontSize: "10px",
    lineHeight: 1.42,
  },
  originalAgreementSignatures: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "28px",
    marginTop: "22px",
  },
  agreementSignatureColumn: {
    display: "grid",
    gap: "4px",
    color: "#111827",
    fontSize: "9.5px",
  },
  agreementSignatureLine: {
    borderTop: "1px solid #111827",
    marginBottom: "3px",
  },
  dualSignatureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "28px",
    marginTop: "24px",
  },
  subordinationContextBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    borderBottom: "1px solid #cbd5e1",
    paddingBottom: "8px",
    color: "#334155",
    fontSize: "10px",
  },
  loanExpandedActions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  loanEditGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
    gap: "10px",
    marginBottom: "18px",
  },
  largeTextarea: {
    minHeight: "130px",
    border: "1px solid #cbd5e1",
    padding: "9px",
    fontSize: "11px",
    lineHeight: 1.5,
    color: "#0f172a",
    background: "#ffffff",
    resize: "vertical",
  },
  certificateGrid: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: "7px 14px",
    padding: "12px 0",
    fontSize: "11px",
    color: "#334155",
  },
  loanStack: { display: "grid", gap: "10px" },
  emptyMessage: {
    padding: "16px",
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    fontSize: "10.5px",
    color: "#64748b",
  },
};
