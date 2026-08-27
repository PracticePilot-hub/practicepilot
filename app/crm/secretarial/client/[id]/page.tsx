"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const supabaseAny = supabase as any;

type ClientRecord = {
  id: string;
  client_name: string;
  trading_name: string | null;
  registration_number: string | null;
  id_passport_number: string | null;
  entity_type: string | null;
  status: string | null;
  organisation_id: string | null;
  registration_date: string | null;
};

type DirectorRecord = {
  id: string;
  director_name: string;
  id_passport_number: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  country_of_residence: string | null;
  id_issue_date: string | null;
  director_capacity: string | null;
  physical_address_line_1: string | null;
  physical_address_line_2: string | null;
  physical_address_city: string | null;
  physical_address_province: string | null;
  physical_address_postal_code: string | null;
  physical_address_country: string | null;
  postal_address_line_1: string | null;
  postal_address_line_2: string | null;
  postal_address_city: string | null;
  postal_address_province: string | null;
  postal_address_postal_code: string | null;
  postal_address_country: string | null;
  appointment_date: string | null;
  cessation_date: string | null;
  cessation_reason: string | null;
  cessation_notes: string | null;
  is_active: boolean | null;
};

type ShareholderRecord = {
  id: string;
  full_legal_name: string;
  id_registration_number: string | null;
  holder_type: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  nationality_or_country: string | null;
  country_of_residence_or_registration: string | null;
  physical_address_line_1: string | null;
  physical_address_line_2: string | null;
  physical_address_city: string | null;
  physical_address_province: string | null;
  physical_address_postal_code: string | null;
  physical_address_country: string | null;
  postal_address_line_1: string | null;
  postal_address_line_2: string | null;
  postal_address_city: string | null;
  postal_address_province: string | null;
  postal_address_postal_code: string | null;
  postal_address_country: string | null;
  is_active: boolean | null;
};

type ShareClassRecord = {
  id: string;
  class_name: string;
  class_code: string | null;
  series_designation: string | null;
  authorised_shares: number | null;
  issued_shares: number | null;
  rights_and_restrictions: string | null;
  is_active: boolean | null;
};

type MatterRecord = {
  id: string;
  matter_status: string | null;
  current_step: number | null;
  certificate_number: string | null;
  number_of_shares: number | null;
  shareholder_id: string | null;
  share_class_id: string | null;
  board_resolution_reference: string | null;
  board_resolution_date: string | null;
};

type CertificateRecord = {
  id: string;
  matter_id: string | null;
  certificate_number: string | null;
  certificate_status: string | null;
  issue_date: string | null;
  number_of_shares: number | null;
  shareholder_id: string | null;
  share_class_id: string | null;
  pdf_file_name: string | null;
  pdf_storage_provider: string | null;
  pdf_external_path: string | null;
  pdf_external_url: string | null;
};

type TransactionRecord = {
  id: string;
  matter_id: string | null;
  transaction_type: string | null;
  transaction_date: string | null;
  number_of_shares: number | null;
  notes: string | null;
  shareholder_id: string | null;
  share_class_id: string | null;
};

type ReplacementQueueRecord = {
  id: string;
  transaction_group_id: string;
  shareholder_id: string;
  share_class_id: string | null;
  previous_certificate_id: string | null;
  replacement_shares: number;
  replacement_reason: string;
  queue_status: string;
  replacement_matter_id: string | null;
  created_at: string;
};

type ResolutionRecord = {
  id: string;
  resolution_number: string;
  resolution_type: string;
  resolution_category: string;
  title: string;
  resolution_date: string;
  related_area: string | null;
  related_record_id: string | null;
  transaction_group_id: string | null;
  body_text: string;
  status: string;
  created_at: string;
};

type BeneficialOwnerRecord = {
  id: string;
  owner_type: string;
  ownership_type: string;
  full_legal_name: string;
  id_registration_number: string | null;
  ownership_percentage: number | null;
  effective_from: string | null;
  declaration_status: string;
  cipc_reference: string | null;
  filed_at: string | null;
  is_active: boolean;
  linked_shareholder_id?: string | null;
  nature_of_interest?: string | null;
  control_description?: string | null;
  nationality_or_country?: string | null;
  country_of_residence?: string | null;
  email?: string | null;
  phone?: string | null;
  physical_address?: string | null;
  source_structure_notes?: string | null;
};

type AnnualReturnRecord = {
  id: string;
  return_year: number;
  anniversary_date: string | null;
  due_date: string | null;
  annual_turnover: number | null;
  annual_return_fee: number | null;
  penalty_amount: number | null;
  beneficial_ownership_status: string;
  financial_submission_type: string | null;
  financial_submission_status: string;
  return_status: string;
  submitted_at: string | null;
  paid_at: string | null;
  cipc_reference: string | null;
  authority_generated_at?: string | null;
};

type CompanyChangeRecord = {
  id: string;
  change_type: string;
  title: string;
  description: string | null;
  effective_date: string | null;
  submission_date: string | null;
  matter_status: string;
  cipc_reference: string | null;
};

type DocumentRecord = {
  id: string;
  source_area: string;
  source_record_id: string | null;
  document_type: string;
  display_name: string;
  document_date: string | null;
  document_status: string;
  storage_provider: string;
  external_path: string | null;
  external_url: string | null;
  created_at: string;
};

const VIEWS = [
  "overview",
  "directors",
  "shareholders",
  "share-capital",
  "certificates",
  "beneficial-ownership",
  "annual-returns",
  "company-changes",
  "registers",
  "documents",
] as const;

type ViewName = (typeof VIEWS)[number];

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function formatStatus(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "—";

  const parsed = new Date(`${text.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return text;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function money(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(number);
}

function formatWholeNumberInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-ZA").replace(/,/g, " ");
}

function parseWholeNumberInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function annualReturnFee(turnoverValue: number, entityType: string | null, late: boolean) {
  const turnover = Number.isFinite(turnoverValue) ? turnoverValue : 0;
  const entity = String(entityType || "").toLowerCase();
  const isCloseCorporation =
    entity === "cc" || entity.includes("close corporation");

  if (isCloseCorporation) {
    const base = turnover < 50_000_000 ? 100 : 4000;
    return {
      baseFee: base,
      penalty: late ? 150 : 0,
      totalFee: base + (late ? 150 : 0),
      bandLabel: turnover < 50_000_000 ? "Turnover below R50 million" : "Turnover R50 million and above",
    };
  }

  let onTime = 0;
  let lateFee = 0;

  if (turnover < 1_000_000) {
    onTime = 100;
    lateFee = 150;
  } else if (turnover < 10_000_000) {
    onTime = 450;
    lateFee = 600;
  } else if (turnover < 25_000_000) {
    onTime = 2000;
    lateFee = 2500;
  } else {
    onTime = 3000;
    lateFee = 4000;
  }

  const bandLabel =
    turnover < 1_000_000
      ? "Turnover below R1 million"
      : turnover < 10_000_000
        ? "Turnover R1 million to below R10 million"
        : turnover < 25_000_000
          ? "Turnover R10 million to below R25 million"
          : "Turnover R25 million and above";

  return {
    baseFee: onTime,
    penalty: late ? lateFee - onTime : 0,
    totalFee: late ? lateFee : onTime,
    bandLabel,
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function SecretarialClientPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const clientId = String(params?.id || "");

  const requestedView = searchParams.get("view") || "overview";
  const activeView: ViewName = VIEWS.includes(requestedView as ViewName)
    ? (requestedView as ViewName)
    : "overview";

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [directors, setDirectors] = useState<DirectorRecord[]>([]);
  const [shareholders, setShareholders] = useState<ShareholderRecord[]>([]);
  const [shareClasses, setShareClasses] = useState<ShareClassRecord[]>([]);
  const [matters, setMatters] = useState<MatterRecord[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [replacementQueue, setReplacementQueue] = useState<ReplacementQueueRecord[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionRecord[]>([]);
  const [beneficialOwners, setBeneficialOwners] = useState<BeneficialOwnerRecord[]>([]);
  const [annualReturns, setAnnualReturns] = useState<AnnualReturnRecord[]>([]);
  const [companyChanges, setCompanyChanges] = useState<CompanyChangeRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");

  const [showDirectorForm, setShowDirectorForm] = useState(false);
  const [directorName, setDirectorName] = useState("");
  const [directorIdNumber, setDirectorIdNumber] = useState("");
  const [directorEmail, setDirectorEmail] = useState("");
  const [directorPhone, setDirectorPhone] = useState("");
  const [directorDateOfBirth, setDirectorDateOfBirth] = useState("");
  const [directorNationality, setDirectorNationality] = useState("South African");
  const [directorCountryOfResidence, setDirectorCountryOfResidence] = useState("South Africa");
  const [directorIdIssueDate, setDirectorIdIssueDate] = useState("");
  const [directorCapacity, setDirectorCapacity] = useState("director");
  const [directorPhysical1, setDirectorPhysical1] = useState("");
  const [directorPhysical2, setDirectorPhysical2] = useState("");
  const [directorPhysicalCity, setDirectorPhysicalCity] = useState("");
  const [directorPhysicalProvince, setDirectorPhysicalProvince] = useState("");
  const [directorPhysicalPostalCode, setDirectorPhysicalPostalCode] = useState("");
  const [directorPhysicalCountry, setDirectorPhysicalCountry] = useState("South Africa");
  const [directorPostal1, setDirectorPostal1] = useState("");
  const [directorPostal2, setDirectorPostal2] = useState("");
  const [directorPostalCity, setDirectorPostalCity] = useState("");
  const [directorPostalProvince, setDirectorPostalProvince] = useState("");
  const [directorPostalPostalCode, setDirectorPostalPostalCode] = useState("");
  const [directorPostalCountry, setDirectorPostalCountry] = useState("South Africa");
  const [directorPostalSameAsPhysical, setDirectorPostalSameAsPhysical] = useState(false);
  const [directorAppointmentDate, setDirectorAppointmentDate] = useState("");
  const [editingDirectorId, setEditingDirectorId] = useState<string | null>(null);

  const [endingDirectorId, setEndingDirectorId] = useState<string | null>(null);
  const [directorCessationReason, setDirectorCessationReason] = useState("resigned");
  const [directorCessationDate, setDirectorCessationDate] = useState("");
  const [directorCessationNotes, setDirectorCessationNotes] = useState("");

  const [showShareholderForm, setShowShareholderForm] = useState(false);
  const [shareholderType, setShareholderType] = useState("individual");
  const [shareholderName, setShareholderName] = useState("");
  const [shareholderIdNumber, setShareholderIdNumber] = useState("");
  const [shareholderEmail, setShareholderEmail] = useState("");
  const [shareholderPhone, setShareholderPhone] = useState("");
  const [shareholderDateOfBirth, setShareholderDateOfBirth] = useState("");
  const [shareholderNationalityOrCountry, setShareholderNationalityOrCountry] = useState("South African");
  const [shareholderCountryOfResidenceOrRegistration, setShareholderCountryOfResidenceOrRegistration] = useState("South Africa");
  const [shareholderPhysical1, setShareholderPhysical1] = useState("");
  const [shareholderPhysical2, setShareholderPhysical2] = useState("");
  const [shareholderPhysicalCity, setShareholderPhysicalCity] = useState("");
  const [shareholderPhysicalProvince, setShareholderPhysicalProvince] = useState("");
  const [shareholderPhysicalPostalCode, setShareholderPhysicalPostalCode] = useState("");
  const [shareholderPhysicalCountry, setShareholderPhysicalCountry] = useState("South Africa");
  const [shareholderPostal1, setShareholderPostal1] = useState("");
  const [shareholderPostal2, setShareholderPostal2] = useState("");
  const [shareholderPostalCity, setShareholderPostalCity] = useState("");
  const [shareholderPostalProvince, setShareholderPostalProvince] = useState("");
  const [shareholderPostalPostalCode, setShareholderPostalPostalCode] = useState("");
  const [shareholderPostalCountry, setShareholderPostalCountry] = useState("South Africa");
  const [postalSameAsPhysical, setPostalSameAsPhysical] = useState(false);
  const [editingShareholderId, setEditingShareholderId] = useState<string | null>(null);

  const [showShareClassForm, setShowShareClassForm] = useState(false);
  const [shareClassName, setShareClassName] = useState("Ordinary no-par-value shares");
  const [shareClassCode, setShareClassCode] = useState("");
  const [shareClassSeries, setShareClassSeries] = useState("");
  const [authorisedShares, setAuthorisedShares] = useState("");
  const [shareClassRights, setShareClassRights] = useState("");
  const [editingShareClassId, setEditingShareClassId] = useState<string | null>(null);

  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeType, setChangeType] = useState("director_appointment");
  const [changeTitle, setChangeTitle] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [changeEffectiveDate, setChangeEffectiveDate] = useState("");

  const [annualTurnover, setAnnualTurnover] = useState("");
  const [annualFinancialType, setAnnualFinancialType] = useState("FAS");
  const [annualFinancialStatus, setAnnualFinancialStatus] = useState("outstanding");
  const [annualReturnStatus, setAnnualReturnStatus] = useState("not_started");
  const [annualCipcReference, setAnnualCipcReference] = useState("");
  const [annualSubmittedDate, setAnnualSubmittedDate] = useState("");
  const [annualPaidDate, setAnnualPaidDate] = useState("");

  const [boCipcReference, setBoCipcReference] = useState("");
  const [boFiledDate, setBoFiledDate] = useState("");
  const [showIndirectBoForm, setShowIndirectBoForm] = useState(false);
  const [boOwnerName, setBoOwnerName] = useState("");
  const [boOwnerIdNumber, setBoOwnerIdNumber] = useState("");
  const [boOwnershipPercentage, setBoOwnershipPercentage] = useState("");
  const [boNatureOfInterest, setBoNatureOfInterest] = useState("indirect_shareholding");
  const [boControlDescription, setBoControlDescription] = useState("");
  const [boEffectiveFrom, setBoEffectiveFrom] = useState(todayIso());
  const [boNationality, setBoNationality] = useState("");
  const [boCountryOfResidence, setBoCountryOfResidence] = useState("South Africa");
  const [boEmail, setBoEmail] = useState("");
  const [boPhone, setBoPhone] = useState("");
  const [boPhysicalAddress, setBoPhysicalAddress] = useState("");
  const [boStructureNotes, setBoStructureNotes] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function loadAll() {
    setLoading(true);
    setLoadError("");

    try {
      const [
        clientResult,
        directorsResult,
        shareholdersResult,
        classesResult,
        mattersResult,
        certificatesResult,
        transactionsResult,
        replacementQueueResult,
        resolutionsResult,
        boResult,
        annualReturnsResult,
        changesResult,
        documentsResult,
      ] = await Promise.all([
        supabaseAny
          .from("crm_clients")
          .select(
            "id, client_name, trading_name, registration_number, id_passport_number, entity_type, status, organisation_id, registration_date"
          )
          .eq("id", clientId)
          .single(),

        supabaseAny
          .from("crm_client_directors")
          .select("id, director_name, id_passport_number, email, phone, date_of_birth, nationality, country_of_residence, id_issue_date, director_capacity, physical_address_line_1, physical_address_line_2, physical_address_city, physical_address_province, physical_address_postal_code, physical_address_country, postal_address_line_1, postal_address_line_2, postal_address_city, postal_address_province, postal_address_postal_code, postal_address_country, appointment_date, cessation_date, cessation_reason, cessation_notes, is_active")
          .eq("client_id", clientId)
          .order("director_name"),

        supabaseAny
          .from("secretarial_shareholders")
          .select("id, full_legal_name, id_registration_number, holder_type, email, phone, date_of_birth, nationality_or_country, country_of_residence_or_registration, physical_address_line_1, physical_address_line_2, physical_address_city, physical_address_province, physical_address_postal_code, physical_address_country, postal_address_line_1, postal_address_line_2, postal_address_city, postal_address_province, postal_address_postal_code, postal_address_country, is_active")
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("full_legal_name"),

        supabaseAny
          .from("secretarial_share_classes")
          .select(
            "id, class_name, class_code, series_designation, authorised_shares, issued_shares, rights_and_restrictions, is_active"
          )
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("class_name"),

        supabaseAny
          .from("secretarial_share_matters")
          .select(
            "id, matter_status, current_step, certificate_number, number_of_shares, shareholder_id, share_class_id, board_resolution_reference, board_resolution_date"
          )
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),

        supabaseAny
          .from("secretarial_share_certificates")
          .select(
            "id, matter_id, certificate_number, certificate_status, issue_date, number_of_shares, shareholder_id, share_class_id, pdf_file_name, pdf_storage_provider, pdf_external_path, pdf_external_url"
          )
          .eq("client_id", clientId)
          .order("issue_date", { ascending: false }),

        supabaseAny
          .from("secretarial_share_transactions")
          .select(
            "id, matter_id, transaction_type, transaction_date, number_of_shares, notes, shareholder_id, share_class_id"
          )
          .eq("client_id", clientId)
          .order("transaction_date", { ascending: false }),

        supabaseAny
          .from("secretarial_certificate_replacement_queue")
          .select(
            "id, transaction_group_id, shareholder_id, share_class_id, previous_certificate_id, replacement_shares, replacement_reason, queue_status, replacement_matter_id, created_at"
          )
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),

        supabaseAny
          .from("secretarial_resolutions")
          .select(
            "id, resolution_number, resolution_type, resolution_category, title, resolution_date, related_area, related_record_id, transaction_group_id, body_text, status, created_at"
          )
          .eq("client_id", clientId)
          .order("resolution_date", { ascending: false })
          .order("created_at", { ascending: false }),

        supabaseAny
          .from("secretarial_beneficial_owners")
          .select(
            "id, owner_type, ownership_type, full_legal_name, id_registration_number, ownership_percentage, effective_from, declaration_status, cipc_reference, filed_at, is_active, linked_shareholder_id, nature_of_interest, control_description, nationality_or_country, country_of_residence, email, phone, physical_address, source_structure_notes"
          )
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("full_legal_name"),

        supabaseAny
          .from("secretarial_annual_returns")
          .select(
            "id, return_year, anniversary_date, due_date, annual_turnover, annual_return_fee, penalty_amount, beneficial_ownership_status, financial_submission_type, financial_submission_status, return_status, submitted_at, paid_at, cipc_reference, authority_generated_at"
          )
          .eq("client_id", clientId)
          .order("return_year", { ascending: false }),

        supabaseAny
          .from("secretarial_company_changes")
          .select(
            "id, change_type, title, description, effective_date, submission_date, matter_status, cipc_reference"
          )
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),

        supabaseAny
          .from("secretarial_documents")
          .select(
            "id, source_area, source_record_id, document_type, display_name, document_date, document_status, storage_provider, external_path, external_url, created_at"
          )
          .eq("client_id", clientId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false }),
      ]);

      if (clientResult.error) throw clientResult.error;

      setClient(clientResult.data as ClientRecord);

      setDirectors(directorsResult.error ? [] : ((directorsResult.data || []) as DirectorRecord[]));
      setShareholders(shareholdersResult.error ? [] : ((shareholdersResult.data || []) as ShareholderRecord[]));
      setShareClasses(classesResult.error ? [] : ((classesResult.data || []) as ShareClassRecord[]));
      setMatters(mattersResult.error ? [] : ((mattersResult.data || []) as MatterRecord[]));
      setCertificates(certificatesResult.error ? [] : ((certificatesResult.data || []) as CertificateRecord[]));
      setTransactions(transactionsResult.error ? [] : ((transactionsResult.data || []) as TransactionRecord[]));
      setReplacementQueue(replacementQueueResult.error ? [] : ((replacementQueueResult.data || []) as ReplacementQueueRecord[]));
      setResolutions(resolutionsResult.error ? [] : ((resolutionsResult.data || []) as ResolutionRecord[]));
      setBeneficialOwners(boResult.error ? [] : ((boResult.data || []) as BeneficialOwnerRecord[]));
      setAnnualReturns(annualReturnsResult.error ? [] : ((annualReturnsResult.data || []) as AnnualReturnRecord[]));
      setCompanyChanges(changesResult.error ? [] : ((changesResult.data || []) as CompanyChangeRecord[]));
      setDocuments(documentsResult.error ? [] : ((documentsResult.data || []) as DocumentRecord[]));

      const relatedErrors = [
        directorsResult.error,
        shareholdersResult.error,
        classesResult.error,
        mattersResult.error,
        certificatesResult.error,
        transactionsResult.error,
        replacementQueueResult.error,
        resolutionsResult.error,
        boResult.error,
        annualReturnsResult.error,
        changesResult.error,
        documentsResult.error,
      ].filter(Boolean);

      if (relatedErrors.length) {
        console.warn("One or more Secretarial sections could not load:", relatedErrors);
        setLoadError(
          "One or more Secretarial sections could not be retrieved. If you have not run the Full Secretarial schema migration yet, run it first."
        );
      }
    } catch (error) {
      console.error("Could not load Secretarial client file:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load the Secretarial client file."
      );
    } finally {
      setLoading(false);
    }
  }

  const shareholderById = useMemo(
    () => new Map(shareholders.map((row) => [row.id, row])),
    [shareholders]
  );

  const classById = useMemo(
    () => new Map(shareClasses.map((row) => [row.id, row])),
    [shareClasses]
  );

  function addBusinessDays(dateValue: Date, businessDays: number) {
    const result = new Date(dateValue);
    let added = 0;

    while (added < businessDays) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) added += 1;
    }

    return result;
  }

  function isoDate(dateValue: Date) {
    return dateValue.toISOString().slice(0, 10);
  }

  const nextAnnualReturn = useMemo(() => {
    if (!client?.registration_date) return null;

    const registration = new Date(`${client.registration_date}T00:00:00`);
    if (Number.isNaN(registration.getTime())) return null;

    const now = new Date();
    let year = now.getFullYear();

    let anniversary = new Date(
      year,
      registration.getMonth(),
      registration.getDate()
    );

    if (anniversary < now) {
      year += 1;
      anniversary = new Date(
        year,
        registration.getMonth(),
        registration.getDate()
      );
    }

    return {
      year,
      anniversaryDate: isoDate(anniversary),
      dueDate: isoDate(addBusinessDays(anniversary, 30)),
    };
  }, [client?.registration_date]);

  const issuedCertificates = useMemo(
    () =>
      certificates.filter((row) =>
        ["issued", "current"].includes(
          String(row.certificate_status || "").toLowerCase()
        )
      ),
    [certificates]
  );

  const openMatters = useMemo(
    () =>
      matters.filter((row) =>
        [
          "draft",
          "in_progress",
          "awaiting_review",
          "returned_for_correction",
          "approved",
        ].includes(String(row.matter_status || "").toLowerCase())
      ),
    [matters]
  );

  const pendingReplacementCertificates = useMemo(
    () =>
      replacementQueue.filter((row) =>
        ["pending", "in_progress"].includes(
          String(row.queue_status || "").toLowerCase()
        )
      ),
    [replacementQueue]
  );

  const totalIssuedShares = useMemo(
    () =>
      shareClasses.reduce(
        (total, row) => total + Number(row.issued_shares || 0),
        0
      ),
    [shareClasses]
  );

  const currentHoldings = useMemo(() => {
    const holdings = new Map<string, number>();

    for (const transaction of transactions) {
      if (!transaction.shareholder_id) continue;

      const key = `${transaction.shareholder_id}:${transaction.share_class_id || ""}`;
      const number = Number(transaction.number_of_shares || 0);
      const type = String(transaction.transaction_type || "").toLowerCase();

      const signed =
        ["issue", "transfer_in"].includes(type)
          ? number
          : ["transfer_out", "redemption", "repurchase", "cancellation"].includes(type)
            ? -number
            : 0;

      holdings.set(key, (holdings.get(key) || 0) + signed);
    }

    return Array.from(holdings.entries())
      .map(([key, shares]) => {
        const [shareholderId, shareClassId] = key.split(":");
        return {
          shareholderId,
          shareClassId,
          shares,
          shareholder: shareholderById.get(shareholderId),
          shareClass: classById.get(shareClassId),
        };
      })
      .filter((row) => row.shares !== 0);
  }, [transactions, shareholderById, classById]);

  const directNaturalPersonHoldings = useMemo(
    () =>
      currentHoldings.filter(
        (holding) =>
          String(holding.shareholder?.holder_type || "individual").toLowerCase() === "individual"
      ),
    [currentHoldings]
  );

  const complexOwnershipHoldings = useMemo(
    () =>
      currentHoldings.filter(
        (holding) =>
          String(holding.shareholder?.holder_type || "individual").toLowerCase() !== "individual"
      ),
    [currentHoldings]
  );

  const manualIndirectBeneficialOwners = useMemo(
    () =>
      beneficialOwners.filter(
        (row) =>
          String(row.owner_type || "").toLowerCase() === "individual" &&
          !row.linked_shareholder_id
      ),
    [beneficialOwners]
  );

  const derivedBeneficialOwners = useMemo(() => {
    const directOwners = directNaturalPersonHoldings.map((holding) => ({
      id: `derived-${holding.shareholderId}-${holding.shareClassId}`,
      name: holding.shareholder?.full_legal_name || "—",
      idNumber: holding.shareholder?.id_registration_number || null,
      percentage: totalIssuedShares > 0 ? (holding.shares / totalIssuedShares) * 100 : null,
      source: "Direct natural-person ownership",
      status: "calculated",
    }));

    const indirectOwners = manualIndirectBeneficialOwners.map((row) => ({
      id: row.id,
      name: row.full_legal_name,
      idNumber: row.id_registration_number,
      percentage: row.ownership_percentage,
      source: row.nature_of_interest ? formatStatus(row.nature_of_interest) : "Indirect / control interest",
      status: row.declaration_status,
    }));

    return [...directOwners, ...indirectOwners];
  }, [directNaturalPersonHoldings, manualIndirectBeneficialOwners, totalIssuedShares]);

  const boOverallStatus = useMemo(() => {
    if (!currentHoldings.length) return "not_ready";
    if (complexOwnershipHoldings.length && !manualIndirectBeneficialOwners.length) return "structure_review_required";
    if (!beneficialOwners.length) return "calculated";

    const statuses = beneficialOwners.map((row) =>
      String(row.declaration_status || "draft").toLowerCase()
    );
    if (statuses.length && statuses.every((status) => status === "filed")) return "filed";
    if (statuses.every((status) => ["ready", "filed"].includes(status))) return "ready";
    return "draft";
  }, [beneficialOwners, currentHoldings.length, complexOwnershipHoldings.length, manualIndirectBeneficialOwners.length]);

  const annualBOLiveStatus = boOverallStatus === "filed" ? "up_to_date" : "outstanding";

  async function confirmBeneficialOwnership() {
    if (!client?.organisation_id || !currentHoldings.length) {
      setMessage("Capture the shareholders and issued-share position before confirming beneficial ownership.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      if (beneficialOwners.length) {
        const { error: supersedeError } = await supabaseAny
          .from("secretarial_beneficial_owners")
          .update({
            is_active: false,
            declaration_status: "superseded",
            effective_to: todayIso(),
          })
          .eq("client_id", client.id)
          .eq("is_active", true);

        if (supersedeError) throw supersedeError;
      }

      const rows = currentHoldings.map((holding) => ({
        organisation_id: client.organisation_id,
        client_id: client.id,
        linked_shareholder_id: holding.shareholderId,
        owner_type:
          holding.shareholder?.holder_type === "entity"
            ? "legal_entity"
            : holding.shareholder?.holder_type === "trust"
              ? "trust"
              : "individual",
        ownership_type: "direct",
        full_legal_name: holding.shareholder?.full_legal_name || "",
        id_registration_number:
          holding.shareholder?.id_registration_number || null,
        ownership_percentage:
          totalIssuedShares > 0
            ? Number(((holding.shares / totalIssuedShares) * 100).toFixed(4))
            : null,
        effective_from: todayIso(),
        declaration_status: "ready",
        is_active: true,
      }));

      const { error: insertError } = await supabaseAny
        .from("secretarial_beneficial_owners")
        .insert(rows);

      if (insertError) throw insertError;

      await loadAll();
      setMessage("Beneficial ownership position confirmed and ready for filing.");
    } catch (error) {
      console.error("Could not confirm beneficial ownership:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not confirm the beneficial ownership position."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveIndirectBeneficialOwner() {
    if (!client?.organisation_id) return;

    if (!boOwnerName.trim() || !boOwnerIdNumber.trim()) {
      setMessage("Enter the natural person's full name and ID / passport number.");
      return;
    }

    const percentage = Number(String(boOwnershipPercentage || "").replace(",", "."));
    if (boOwnershipPercentage.trim() && (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)) {
      setMessage("Enter a valid BO percentage between 0 and 100.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabaseAny.from("secretarial_beneficial_owners").insert({
        organisation_id: client.organisation_id,
        client_id: client.id,
        linked_shareholder_id: null,
        owner_type: "individual",
        ownership_type: "indirect",
        full_legal_name: boOwnerName.trim(),
        id_registration_number: boOwnerIdNumber.trim(),
        ownership_percentage: boOwnershipPercentage.trim() ? percentage : null,
        effective_from: boEffectiveFrom || todayIso(),
        declaration_status: "ready",
        is_active: true,
        nature_of_interest: boNatureOfInterest,
        control_description: boControlDescription.trim() || null,
        nationality_or_country: boNationality.trim() || null,
        country_of_residence: boCountryOfResidence.trim() || null,
        email: boEmail.trim() || null,
        phone: boPhone.trim() || null,
        physical_address: boPhysicalAddress.trim() || null,
        source_structure_notes: boStructureNotes.trim() || null,
      });

      if (error) throw error;

      setShowIndirectBoForm(false);
      setBoOwnerName("");
      setBoOwnerIdNumber("");
      setBoOwnershipPercentage("");
      setBoNatureOfInterest("indirect_shareholding");
      setBoControlDescription("");
      setBoEffectiveFrom(todayIso());
      setBoNationality("");
      setBoCountryOfResidence("South Africa");
      setBoEmail("");
      setBoPhone("");
      setBoPhysicalAddress("");
      setBoStructureNotes("");
      await loadAll();
      setMessage("Indirect / control beneficial owner added.");
    } catch (error) {
      console.error("Could not add indirect beneficial owner:", error);
      setMessage(error instanceof Error ? error.message : "Could not add the beneficial owner.");
    } finally {
      setSaving(false);
    }
  }

  async function markBeneficialOwnershipFiled() {
    if (!currentHoldings.length || !client?.organisation_id) {
      setMessage("Capture shareholders and issued shares before recording the BO filing.");
      return;
    }

    if (complexOwnershipHoldings.length && !manualIndirectBeneficialOwners.length) {
      setMessage("This structure includes a company, trust or other non-natural holder. Capture the ultimate natural-person beneficial owner(s) before recording the CIPC filing.");
      return;
    }

    if (!boCipcReference.trim() || !boFiledDate) {
      setMessage("Enter the CIPC reference and filing date.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const existingLinkedIds = new Set(
        beneficialOwners.map((row) => row.linked_shareholder_id).filter(Boolean)
      );

      const directRows = directNaturalPersonHoldings
        .filter((holding) => !existingLinkedIds.has(holding.shareholderId))
        .map((holding) => ({
          organisation_id: client.organisation_id,
          client_id: client.id,
          linked_shareholder_id: holding.shareholderId,
          owner_type: "individual",
          ownership_type: "direct",
          full_legal_name: holding.shareholder?.full_legal_name || "",
          id_registration_number: holding.shareholder?.id_registration_number || null,
          ownership_percentage: totalIssuedShares > 0
            ? Number(((holding.shares / totalIssuedShares) * 100).toFixed(4))
            : null,
          effective_from: todayIso(),
          declaration_status: "filed",
          cipc_reference: boCipcReference.trim(),
          filed_at: `${boFiledDate}T12:00:00+02:00`,
          is_active: true,
          nature_of_interest: "direct_shareholding",
        }));

      if (directRows.length) {
        const { error: insertError } = await supabaseAny.from("secretarial_beneficial_owners").insert(directRows);
        if (insertError) throw insertError;
      }

      const { error: updateError } = await supabaseAny
        .from("secretarial_beneficial_owners")
        .update({
          declaration_status: "filed",
          cipc_reference: boCipcReference.trim(),
          filed_at: `${boFiledDate}T12:00:00+02:00`,
        })
        .eq("client_id", client.id)
        .eq("is_active", true)
        .eq("owner_type", "individual");

      if (updateError) throw updateError;

      await loadAll();
      setMessage("Beneficial Ownership filing recorded.");
    } catch (error) {
      console.error("Could not record BO filing:", error);
      setMessage(error instanceof Error ? error.message : "Could not record the BO filing.");
    } finally {
      setSaving(false);
    }
  }

  async function insertRow(table: string, values: Record<string, unknown>) {
    if (!client?.organisation_id) {
      setMessage("The client does not have an organisation ID.");
      return false;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabaseAny.from(table).insert({
        organisation_id: client.organisation_id,
        client_id: client.id,
        ...values,
      });

      if (error) throw error;

      await loadAll();
      setMessage("Saved.");
      return true;
    } catch (error) {
      console.error(`Could not save ${table}:`, error);
      setMessage(
        error instanceof Error ? error.message : "Could not save the record."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function updateRow(
    table: string,
    rowId: string,
    values: Record<string, unknown>
  ) {
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabaseAny
        .from(table)
        .update(values)
        .eq("id", rowId)
        .eq("client_id", client?.id);

      if (error) throw error;

      await loadAll();
      setMessage("Changes saved.");
      return true;
    } catch (error) {
      console.error(`Could not update ${table}:`, error);
      setMessage(
        error instanceof Error ? error.message : "Could not update the record."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveDirector() {
    if (!client || !directorName.trim()) {
      setMessage("Enter the director's full legal name.");
      return;
    }

    const values = {
      director_name: directorName.trim(),
      id_passport_number: directorIdNumber.trim() || null,
      email: directorEmail.trim() || null,
      phone: directorPhone.trim() || null,
      date_of_birth: directorDateOfBirth || null,
      nationality: directorNationality.trim() || null,
      country_of_residence: directorCountryOfResidence.trim() || null,
      id_issue_date: directorIdIssueDate || null,
      director_capacity: directorCapacity || "director",
      physical_address_line_1: directorPhysical1.trim() || null,
      physical_address_line_2: directorPhysical2.trim() || null,
      physical_address_city: directorPhysicalCity.trim() || null,
      physical_address_province: directorPhysicalProvince.trim() || null,
      physical_address_postal_code: directorPhysicalPostalCode.trim() || null,
      physical_address_country: directorPhysicalCountry.trim() || null,
      postal_address_line_1: (directorPostalSameAsPhysical ? directorPhysical1 : directorPostal1).trim() || null,
      postal_address_line_2: (directorPostalSameAsPhysical ? directorPhysical2 : directorPostal2).trim() || null,
      postal_address_city: (directorPostalSameAsPhysical ? directorPhysicalCity : directorPostalCity).trim() || null,
      postal_address_province: (directorPostalSameAsPhysical ? directorPhysicalProvince : directorPostalProvince).trim() || null,
      postal_address_postal_code: (directorPostalSameAsPhysical ? directorPhysicalPostalCode : directorPostalPostalCode).trim() || null,
      postal_address_country: (directorPostalSameAsPhysical ? directorPhysicalCountry : directorPostalCountry).trim() || null,
      appointment_date: directorAppointmentDate || null,
      is_active: true,
    };

    const ok = editingDirectorId
      ? await updateRow("crm_client_directors", editingDirectorId, values)
      : await insertRow("crm_client_directors", values);

    if (ok) {
      setDirectorName("");
      setDirectorIdNumber("");
      setDirectorEmail("");
      setDirectorPhone("");
      setDirectorDateOfBirth("");
      setDirectorNationality("South African");
      setDirectorCountryOfResidence("South Africa");
      setDirectorIdIssueDate("");
      setDirectorCapacity("director");
      setDirectorPhysical1("");
      setDirectorPhysical2("");
      setDirectorPhysicalCity("");
      setDirectorPhysicalProvince("");
      setDirectorPhysicalPostalCode("");
      setDirectorPhysicalCountry("South Africa");
      setDirectorPostal1("");
      setDirectorPostal2("");
      setDirectorPostalCity("");
      setDirectorPostalProvince("");
      setDirectorPostalPostalCode("");
      setDirectorPostalCountry("South Africa");
      setDirectorPostalSameAsPhysical(false);
      setDirectorAppointmentDate("");
      setEditingDirectorId(null);
      setShowDirectorForm(false);
      setMessage(editingDirectorId ? "Director updated." : "Director added.");
    }
  }

  function editDirector(row: DirectorRecord) {
    setDirectorName(row.director_name || "");
    setDirectorIdNumber(row.id_passport_number || "");
    setDirectorEmail(row.email || "");
    setDirectorPhone(row.phone || "");
    setDirectorDateOfBirth(row.date_of_birth || "");
    setDirectorNationality(row.nationality || "South African");
    setDirectorCountryOfResidence(row.country_of_residence || "South Africa");
    setDirectorIdIssueDate(row.id_issue_date || "");
    setDirectorCapacity(row.director_capacity || "director");
    setDirectorPhysical1(row.physical_address_line_1 || "");
    setDirectorPhysical2(row.physical_address_line_2 || "");
    setDirectorPhysicalCity(row.physical_address_city || "");
    setDirectorPhysicalProvince(row.physical_address_province || "");
    setDirectorPhysicalPostalCode(row.physical_address_postal_code || "");
    setDirectorPhysicalCountry(row.physical_address_country || "South Africa");
    setDirectorPostal1(row.postal_address_line_1 || "");
    setDirectorPostal2(row.postal_address_line_2 || "");
    setDirectorPostalCity(row.postal_address_city || "");
    setDirectorPostalProvince(row.postal_address_province || "");
    setDirectorPostalPostalCode(row.postal_address_postal_code || "");
    setDirectorPostalCountry(row.postal_address_country || "South Africa");

    const same =
      (row.postal_address_line_1 || "") === (row.physical_address_line_1 || "") &&
      (row.postal_address_line_2 || "") === (row.physical_address_line_2 || "") &&
      (row.postal_address_city || "") === (row.physical_address_city || "") &&
      (row.postal_address_province || "") === (row.physical_address_province || "") &&
      (row.postal_address_postal_code || "") === (row.physical_address_postal_code || "") &&
      (row.postal_address_country || "") === (row.physical_address_country || "");
    setDirectorPostalSameAsPhysical(same);

    setDirectorAppointmentDate(row.appointment_date || "");
    setEditingDirectorId(row.id);
    setShowDirectorForm(true);
  }


  function startEndDirector(row: DirectorRecord) {
    setEndingDirectorId(row.id);
    setDirectorCessationReason("resigned");
    setDirectorCessationDate(todayIso());
    setDirectorCessationNotes("");
  }

  async function endDirectorAppointment() {
    if (!endingDirectorId) return;

    if (!directorCessationDate) {
      setMessage("Enter the effective date of the director change.");
      return;
    }

    const ok = await updateRow("crm_client_directors", endingDirectorId, {
      is_active: false,
      cessation_date: directorCessationDate,
      cessation_reason: directorCessationReason,
      cessation_notes: directorCessationNotes.trim() || null,
    });

    if (ok) {
      setEndingDirectorId(null);
      setDirectorCessationReason("resigned");
      setDirectorCessationDate("");
      setDirectorCessationNotes("");
      setMessage("Director history updated. The director was not deleted.");
    }
  }

  async function saveShareholder() {
    if (!shareholderName.trim()) {
      setMessage("Enter the shareholder's full legal name.");
      return;
    }

    const values = {
      holder_type: shareholderType,
      full_legal_name: shareholderName.trim(),
      id_registration_number: shareholderIdNumber.trim() || null,
      email: shareholderEmail.trim() || null,
      phone: shareholderPhone.trim() || null,
      date_of_birth: shareholderType === "individual" ? (shareholderDateOfBirth || null) : null,
      nationality_or_country: shareholderNationalityOrCountry.trim() || null,
      country_of_residence_or_registration: shareholderCountryOfResidenceOrRegistration.trim() || null,
      physical_address_line_1: shareholderPhysical1.trim() || null,
      physical_address_line_2: shareholderPhysical2.trim() || null,
      physical_address_city: shareholderPhysicalCity.trim() || null,
      physical_address_province: shareholderPhysicalProvince.trim() || null,
      physical_address_postal_code: shareholderPhysicalPostalCode.trim() || null,
      physical_address_country: shareholderPhysicalCountry.trim() || null,
      postal_address_line_1: (postalSameAsPhysical ? shareholderPhysical1 : shareholderPostal1).trim() || null,
      postal_address_line_2: (postalSameAsPhysical ? shareholderPhysical2 : shareholderPostal2).trim() || null,
      postal_address_city: (postalSameAsPhysical ? shareholderPhysicalCity : shareholderPostalCity).trim() || null,
      postal_address_province: (postalSameAsPhysical ? shareholderPhysicalProvince : shareholderPostalProvince).trim() || null,
      postal_address_postal_code: (postalSameAsPhysical ? shareholderPhysicalPostalCode : shareholderPostalPostalCode).trim() || null,
      postal_address_country: (postalSameAsPhysical ? shareholderPhysicalCountry : shareholderPostalCountry).trim() || null,
      is_active: true,
    };

    const ok = editingShareholderId
      ? await updateRow(
          "secretarial_shareholders",
          editingShareholderId,
          values
        )
      : await insertRow("secretarial_shareholders", values);

    if (ok) {
      const wasEditing = Boolean(editingShareholderId);
      setShareholderName("");
      setShareholderIdNumber("");
      setShareholderEmail("");
      setShareholderPhone("");
      setShareholderDateOfBirth("");
      setShareholderNationalityOrCountry("South African");
      setShareholderCountryOfResidenceOrRegistration("South Africa");
      setShareholderPhysical1("");
      setShareholderPhysical2("");
      setShareholderPhysicalCity("");
      setShareholderPhysicalProvince("");
      setShareholderPhysicalPostalCode("");
      setShareholderPhysicalCountry("South Africa");
      setShareholderPostal1("");
      setShareholderPostal2("");
      setShareholderPostalCity("");
      setShareholderPostalProvince("");
      setShareholderPostalPostalCode("");
      setShareholderPostalCountry("South Africa");
      setPostalSameAsPhysical(false);
      setEditingShareholderId(null);
      setShowShareholderForm(false);
      setMessage(
        wasEditing
          ? "Shareholder updated."
          : "Shareholder added. No shares are issued by adding the shareholder alone — create a share certificate when ready."
      );
    }
  }

  function editShareholder(row: ShareholderRecord) {
    setShareholderType(row.holder_type || "individual");
    setShareholderName(row.full_legal_name || "");
    setShareholderIdNumber(row.id_registration_number || "");
    setShareholderEmail(row.email || "");
    setShareholderPhone(row.phone || "");
    setShareholderDateOfBirth(row.date_of_birth || "");
    setShareholderNationalityOrCountry(row.nationality_or_country || "South African");
    setShareholderCountryOfResidenceOrRegistration(row.country_of_residence_or_registration || "South Africa");
    setShareholderPhysical1(row.physical_address_line_1 || "");
    setShareholderPhysical2(row.physical_address_line_2 || "");
    setShareholderPhysicalCity(row.physical_address_city || "");
    setShareholderPhysicalProvince(row.physical_address_province || "");
    setShareholderPhysicalPostalCode(row.physical_address_postal_code || "");
    setShareholderPhysicalCountry(row.physical_address_country || "South Africa");
    setShareholderPostal1(row.postal_address_line_1 || "");
    setShareholderPostal2(row.postal_address_line_2 || "");
    setShareholderPostalCity(row.postal_address_city || "");
    setShareholderPostalProvince(row.postal_address_province || "");
    setShareholderPostalPostalCode(row.postal_address_postal_code || "");
    setShareholderPostalCountry(row.postal_address_country || "South Africa");

    const sameAddress =
      (row.postal_address_line_1 || "") === (row.physical_address_line_1 || "") &&
      (row.postal_address_line_2 || "") === (row.physical_address_line_2 || "") &&
      (row.postal_address_city || "") === (row.physical_address_city || "") &&
      (row.postal_address_province || "") === (row.physical_address_province || "") &&
      (row.postal_address_postal_code || "") === (row.physical_address_postal_code || "") &&
      (row.postal_address_country || "") === (row.physical_address_country || "");
    setPostalSameAsPhysical(sameAddress);
    setEditingShareholderId(row.id);
    setShowShareholderForm(true);
  }

  async function saveShareClass() {
    if (!shareClassName.trim()) {
      setMessage("Enter the share class name.");
      return;
    }

    const values = {
      class_name: shareClassName.trim(),
      class_code: shareClassCode.trim() || null,
      series_designation: shareClassSeries.trim() || null,
      authorised_shares: authorisedShares ? Number(authorisedShares) : 0,
      rights_and_restrictions: shareClassRights.trim() || null,
      par_value_type: "no_par_value",
      is_active: true,
    };

    const ok = editingShareClassId
      ? await updateRow("secretarial_share_classes", editingShareClassId, values)
      : await insertRow("secretarial_share_classes", {
          ...values,
          issued_shares: 0,
        });

    if (ok) {
      setShareClassName("Ordinary no-par-value shares");
      setShareClassCode("");
      setShareClassSeries("");
      setAuthorisedShares("");
      setShareClassRights("");
      setEditingShareClassId(null);
      setShowShareClassForm(false);
    }
  }

  function editShareClass(row: ShareClassRecord) {
    setShareClassName(row.class_name || "");
    setShareClassCode(row.class_code || "");
    setShareClassSeries(row.series_designation || "");
    setAuthorisedShares(
      row.authorised_shares == null ? "" : String(row.authorised_shares)
    );
    setShareClassRights(row.rights_and_restrictions || "");
    setEditingShareClassId(row.id);
    setShowShareClassForm(true);
  }


  const currentAnnualReturn = useMemo(() => {
    if (!nextAnnualReturn) return null;
    return (
      annualReturns.find((row) => row.return_year === nextAnnualReturn.year) ||
      null
    );
  }, [annualReturns, nextAnnualReturn]);

  const annualFeePreview = useMemo(() => {
    const turnover = parseWholeNumberInput(annualTurnover);
    const filingDeadline = nextAnnualReturn?.dueDate
      ? new Date(`${nextAnnualReturn.dueDate}T23:59:59`)
      : null;
    const late = filingDeadline ? new Date() > filingDeadline : false;
    return annualReturnFee(turnover, client?.entity_type || null, late);
  }, [annualTurnover, client?.entity_type, nextAnnualReturn?.dueDate]);

  useEffect(() => {
    if (!currentAnnualReturn) return;

    setAnnualTurnover(
      currentAnnualReturn.annual_turnover == null
        ? ""
        : formatWholeNumberInput(String(currentAnnualReturn.annual_turnover))
    );
    setAnnualFinancialType(
      currentAnnualReturn.financial_submission_type || "FAS"
    );
    setAnnualFinancialStatus(
      currentAnnualReturn.financial_submission_status || "outstanding"
    );
    setAnnualReturnStatus(currentAnnualReturn.return_status || "not_started");
    setAnnualCipcReference(currentAnnualReturn.cipc_reference || "");
    setAnnualSubmittedDate(
      currentAnnualReturn.submitted_at
        ? currentAnnualReturn.submitted_at.slice(0, 10)
        : ""
    );
    setAnnualPaidDate(
      currentAnnualReturn.paid_at
        ? currentAnnualReturn.paid_at.slice(0, 10)
        : ""
    );
  }, [currentAnnualReturn?.id]);

  async function resetAnnualTurnover() {
    setAnnualTurnover("0");

    if (!currentAnnualReturn?.id) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const fee = annualReturnFee(0, client?.entity_type ?? null, false);

      const { error } = await supabaseAny
        .from("secretarial_annual_returns")
        .update({
          annual_turnover: 0,
          annual_return_fee: fee.baseFee,
          penalty_amount: fee.penalty,
        })
        .eq("id", currentAnnualReturn.id)
        .eq("client_id", clientId);

      if (error) throw error;

      setMessage("Annual turnover reset to R 0.");
      await loadAll();
    } catch (error) {
      console.error("Could not reset Annual Return turnover:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not reset the Annual Return turnover."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAnnualReturnControl() {
    if (!client || !nextAnnualReturn) {
      setMessage("The annual-return cycle cannot be calculated.");
      return;
    }

    if (!annualTurnover.trim()) {
      setMessage("Enter the annual turnover before saving this return.");
      return;
    }

    const values = {
      return_year: nextAnnualReturn.year,
      anniversary_date: nextAnnualReturn.anniversaryDate,
      due_date: nextAnnualReturn.dueDate,
      annual_turnover: parseWholeNumberInput(annualTurnover),
      annual_return_fee: annualFeePreview.baseFee,
      penalty_amount: annualFeePreview.penalty,
      beneficial_ownership_status: annualBOLiveStatus,
      financial_submission_type: annualFinancialType || null,
      financial_submission_status: annualFinancialStatus,
      return_status: annualReturnStatus,
      submitted_at: annualSubmittedDate
        ? `${annualSubmittedDate}T12:00:00+02:00`
        : null,
      paid_at: annualPaidDate ? `${annualPaidDate}T12:00:00+02:00` : null,
      cipc_reference: annualCipcReference.trim() || null,
    };

    const ok = currentAnnualReturn
      ? await updateRow(
          "secretarial_annual_returns",
          currentAnnualReturn.id,
          values
        )
      : await insertRow("secretarial_annual_returns", values);

    if (ok) {
      setMessage("Annual Return control updated.");
    }
  }

  async function previewSecretarialDocument(
    documentType: string,
    sourceId?: string | null
  ) {
    if (!client) return;

    setMessage("");
    const previewWindow = window.open("about:blank", "_blank");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your login session could not be confirmed.");
      }

      const response = await fetch("/api/crm/secretarial/documents/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clientId: client.id,
          documentType,
          sourceId: sourceId || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Could not generate the PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (previewWindow) {
        previewWindow.location.replace(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);

      if (documentType === "annual-return-authority" && currentAnnualReturn?.id) {
        await updateRow("secretarial_annual_returns", currentAnnualReturn.id, {
          authority_generated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      if (previewWindow) previewWindow.close();
      console.error("Document generation failed:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not generate the document."
      );
    }
  }

  async function downloadSecretarialDocument(
    documentType: string,
    sourceId?: string | null,
    preferredFileName?: string
  ) {
    if (!client) return;
    try {
      setMessage("");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("Your login session could not be confirmed.");

      const response = await fetch("/api/crm/secretarial/documents/render", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ clientId: client.id, documentType, sourceId: sourceId || null }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Could not generate the PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = preferredFileName || `${client.client_name}-${documentType}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      console.error("Document download failed:", error);
      setMessage(error instanceof Error ? error.message : "Could not download the document.");
    }
  }

  async function addCompanyChange() {
    if (!changeTitle.trim()) {
      setMessage("Enter a title for the company change.");
      return;
    }

    const ok = await insertRow("secretarial_company_changes", {
      change_type: changeType,
      title: changeTitle.trim(),
      description: changeDescription.trim() || null,
      effective_date: changeEffectiveDate || null,
      matter_status: "draft",
    });

    if (ok) {
      setChangeTitle("");
      setChangeDescription("");
      setChangeEffectiveDate("");
      setShowChangeForm(false);
    }
  }

  if (loading) {
    return (
      <div style={page}>
        <div style={loadingPanel}>Loading Secretarial client file...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={page}>
        <div style={errorBar}>{loadError || "Client not found."}</div>
      </div>
    );
  }

  return (
    <div style={page}>
      <section style={workingFileBar}>
        <Link href="/crm/secretarial" style={workingFileLink}>
          SECRETARIAL
        </Link>
        <span style={divider}>|</span>
        <strong>Client File</strong>
        <span style={divider}>|</span>
        <strong>{client.client_name}</strong>
        <span style={workingFileRegistration}>
          {clean(client.registration_number || client.id_passport_number)}
        </span>
      </section>

      <section style={clientHeader}>
        <div>
          <div style={statusLine}>
            <span style={activeBadge}>{clean(client.status || "Active")}</span>
            <span style={clientType}>{clean(client.entity_type)}</span>
          </div>

          <h1 style={clientTitle}>{client.client_name}</h1>

          {client.trading_name && client.trading_name !== client.client_name ? (
            <div style={tradingName}>Trading as {client.trading_name}</div>
          ) : null}

          <div style={clientRegistration}>
            {clean(client.registration_number || client.id_passport_number)}
          </div>
        </div>
      </section>

      {loadError ? <div style={warningBar}>{loadError}</div> : null}
      {message ? <div style={messageBar}>{message}</div> : null}

      <nav style={subNav}>
        {[
          ["overview", "Overview"],
          ["directors", "Directors"],
          ["shareholders", "Shareholders"],
          ["share-capital", "Share Capital"],
          ["certificates", "Share Certificates"],
          ["beneficial-ownership", "Beneficial Ownership"],
          ["annual-returns", "Annual Returns"],
          ["company-changes", "Other CIPC Changes"],
          ["registers", "Registers"],
          ["documents", "Documents"],
        ].map(([view, label]) => (
          <Link
            key={view}
            href={`/crm/secretarial/client/${client.id}?view=${view}`}
            style={{
              ...subNavLink,
              ...(activeView === view ? subNavLinkActive : {}),
            }}
          >
            {label}
          </Link>
        ))}
      </nav>

      {activeView === "overview" ? (
        <>
          <section style={summaryStrip}>
            <Summary
              label="DIRECTORS"
              value={directors.filter((d) => d.is_active !== false).length}
            />
            <Summary label="SHAREHOLDERS" value={shareholders.length} />
            <Summary label="ISSUED SHARES" value={totalIssuedShares} />
            <Summary label="BENEFICIAL OWNERS" value={beneficialOwners.length} />
            <Summary label="OPEN MATTERS" value={openMatters.length} last />
          </section>

          <section style={panel}>
            <PanelHeading
              title="Secretarial Control Centre"
              subtitle="One client. One statutory file. Every Secretarial work area is controlled from here."
            />

            <div style={controlGrid}>
              <ControlTile
                title="Directors"
                icon="person"
                value={`${directors.length} recorded`}
                href={`/crm/secretarial/client/${client.id}?view=directors`}
              />
              <ControlTile
                title="Shareholders"
                icon="people"
                value={`${shareholders.length} recorded`}
                href={`/crm/secretarial/client/${client.id}?view=shareholders`}
              />
              <ControlTile
                title="Share Capital"
                icon="capital"
                value={`${totalIssuedShares.toLocaleString("en-ZA")} issued`}
                href={`/crm/secretarial/client/${client.id}?view=share-capital`}
              />
              <ControlTile
                title="Share Certificates"
                icon="certificate"
                value={`${issuedCertificates.length} issued`}
                href={`/crm/secretarial/client/${client.id}?view=certificates`}
              />
              <ControlTile
                title="Beneficial Ownership"
                icon="ownership"
                value={`${beneficialOwners.length} active`}
                href={`/crm/secretarial/client/${client.id}?view=beneficial-ownership`}
              />
              <ControlTile
                title="Annual Returns"
                icon="calendar"
                value={
                  annualReturns.length
                    ? `${annualReturns[0].return_year} · ${formatStatus(annualReturns[0].return_status)}`
                    : "None recorded"
                }
                href={`/crm/secretarial/client/${client.id}?view=annual-returns`}
              />
              <ControlTile
                title="Other CIPC Changes"
                icon="change"
                value={`${companyChanges.length} matters`}
                href={`/crm/secretarial/client/${client.id}?view=company-changes`}
              />
              <ControlTile
                title="Registers"
                icon="register"
                value={`${transactions.length} transactions`}
                href={`/crm/secretarial/client/${client.id}?view=registers`}
              />
              <ControlTile
                title="Documents"
                icon="document"
                value={`${documents.length} documents`}
                href={`/crm/secretarial/client/${client.id}?view=documents`}
              />
            </div>
          </section>

          <section style={panel}>
            <PanelHeading
              title="Open Secretarial Work"
              subtitle="Anything still moving through a Secretarial workflow."
            />

            {openMatters.length ? (
              openMatters.map((matter) => (
                <div key={matter.id} style={matterRow}>
                  <div>
                    <strong>
                      Share Certificate {clean(matter.certificate_number)}
                    </strong>
                    <div style={mutedSmall}>
                      Flight Map {matter.current_step || 1} of 9 ·{" "}
                      {formatStatus(matter.matter_status)}
                    </div>
                  </div>

                  <Link
                    href={`/crm/secretarial/share-certificates/${matter.id}`}
                    style={rowActionButton}
                  >
                    Open Matter
                  </Link>
                </div>
              ))
            ) : (
              <Empty text="No open Secretarial matters." />
            )}
          </section>
        </>
      ) : null}

      {activeView === "directors" ? (
        <section style={panel}>
          <PanelHeading
            title="Directors"
            subtitle="Maintain the director master and preserve the full appointment history. A director is never deleted when an appointment ends."
            action={
              <SectionButton
                label={showDirectorForm ? "Cancel" : "Add Director"}
                onClick={() => {
                  setShowDirectorForm(!showDirectorForm);
                  if (showDirectorForm) setEditingDirectorId(null);
                }}
              />
            }
          />

          <div style={processNote}>
            <strong>Director changes</strong>
            <span>
              Appointment, resignation, death, removal, disqualification or incapacity are recorded against the same director history. Supporting resolutions and evidence will flow to Documents.
            </span>
          </div>

          {showDirectorForm ? (
            <FormPanel>
              <FormGrid columns="repeat(3, minmax(0, 1fr))">
                <Field label="FULL LEGAL NAME">
                  <input value={directorName} onChange={(event) => setDirectorName(event.target.value)} style={input} />
                </Field>
                <Field label="ID / PASSPORT NUMBER">
                  <input value={directorIdNumber} onChange={(event) => setDirectorIdNumber(event.target.value)} style={input} />
                </Field>
                <Field label="APPOINTMENT DATE">
                  <input type="date" value={directorAppointmentDate} onChange={(event) => setDirectorAppointmentDate(event.target.value)} style={input} />
                </Field>

                <Field label="CAPACITY">
                  <select value={directorCapacity} onChange={(event) => setDirectorCapacity(event.target.value)} style={input}>
                    <option value="director">Director</option>
                    <option value="alternate_director">Alternate Director</option>
                    <option value="ex_officio_director">Ex Officio Director</option>
                    <option value="prescribed_officer">Prescribed Officer</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="NATIONALITY">
                  <input value={directorNationality} onChange={(event) => setDirectorNationality(event.target.value)} style={input} />
                </Field>
                <Field label="COUNTRY OF RESIDENCE">
                  <input value={directorCountryOfResidence} onChange={(event) => setDirectorCountryOfResidence(event.target.value)} style={input} />
                </Field>

                <Field label="DATE OF BIRTH">
                  <input type="date" value={directorDateOfBirth} onChange={(event) => setDirectorDateOfBirth(event.target.value)} style={input} />
                </Field>
                <Field label="EMAIL ADDRESS">
                  <input type="email" value={directorEmail} onChange={(event) => setDirectorEmail(event.target.value)} style={input} />
                </Field>
                <Field label="TELEPHONE / MOBILE">
                  <input value={directorPhone} onChange={(event) => setDirectorPhone(event.target.value)} style={input} />
                </Field>

                <Field label="ID / PASSPORT ISSUE DATE">
                  <input type="date" value={directorIdIssueDate} onChange={(event) => setDirectorIdIssueDate(event.target.value)} style={input} />
                </Field>
                <div />
                <div />
              </FormGrid>

              <div style={formSectionTitle}>PHYSICAL / RESIDENTIAL ADDRESS</div>
              <FormGrid columns="repeat(3, minmax(0, 1fr))">
                <Field label="ADDRESS LINE 1"><input value={directorPhysical1} onChange={(event) => setDirectorPhysical1(event.target.value)} style={input} /></Field>
                <Field label="ADDRESS LINE 2"><input value={directorPhysical2} onChange={(event) => setDirectorPhysical2(event.target.value)} style={input} /></Field>
                <Field label="CITY / TOWN"><input value={directorPhysicalCity} onChange={(event) => setDirectorPhysicalCity(event.target.value)} style={input} /></Field>
                <Field label="PROVINCE / STATE"><input value={directorPhysicalProvince} onChange={(event) => setDirectorPhysicalProvince(event.target.value)} style={input} /></Field>
                <Field label="POSTAL CODE"><input value={directorPhysicalPostalCode} onChange={(event) => setDirectorPhysicalPostalCode(event.target.value)} style={input} /></Field>
                <Field label="COUNTRY"><input value={directorPhysicalCountry} onChange={(event) => setDirectorPhysicalCountry(event.target.value)} style={input} /></Field>
              </FormGrid>

              <div style={formSectionTitleRow}>
                <span style={formSectionTitle}>POSTAL ADDRESS</span>
                <label style={copyAddressLabel}>
                  <input
                    type="checkbox"
                    checked={directorPostalSameAsPhysical}
                    onChange={(event) => setDirectorPostalSameAsPhysical(event.target.checked)}
                  />{" "}
                  Same as physical address
                </label>
              </div>

              {!directorPostalSameAsPhysical ? (
                <FormGrid columns="repeat(3, minmax(0, 1fr))">
                  <Field label="ADDRESS LINE 1"><input value={directorPostal1} onChange={(event) => setDirectorPostal1(event.target.value)} style={input} /></Field>
                  <Field label="ADDRESS LINE 2"><input value={directorPostal2} onChange={(event) => setDirectorPostal2(event.target.value)} style={input} /></Field>
                  <Field label="CITY / TOWN"><input value={directorPostalCity} onChange={(event) => setDirectorPostalCity(event.target.value)} style={input} /></Field>
                  <Field label="PROVINCE / STATE"><input value={directorPostalProvince} onChange={(event) => setDirectorPostalProvince(event.target.value)} style={input} /></Field>
                  <Field label="POSTAL CODE"><input value={directorPostalPostalCode} onChange={(event) => setDirectorPostalPostalCode(event.target.value)} style={input} /></Field>
                  <Field label="COUNTRY"><input value={directorPostalCountry} onChange={(event) => setDirectorPostalCountry(event.target.value)} style={input} /></Field>
                </FormGrid>
              ) : null}

              <FormFooter>
                <span style={formHelp}>
                  {editingDirectorId
                    ? "Update the permanent director record. Ending the directorship remains a separate history event."
                    : "Capture the director once. CIPC changes, resolutions and mandates can then reuse this permanent record."}
                </span>
                <div style={rowActions}>
                  {editingDirectorId &&
                  directors.find((row) => row.id === editingDirectorId)?.is_active !== false ? (
                    <button
                      type="button"
                      onClick={() => {
                        const director = directors.find((row) => row.id === editingDirectorId);
                        if (director) startEndDirector(director);
                      }}
                      style={quietActionButton}
                    >
                      End Directorship
                    </button>
                  ) : null}
                  <SaveButton
                    onClick={saveDirector}
                    saving={saving}
                    label={editingDirectorId ? "Update Director" : "Save Director"}
                  />
                </div>
              </FormFooter>
            </FormPanel>
          ) : null}

          {endingDirectorId ? (
            <FormPanel>
              <div style={changeFormHeader}>
                <div>
                  <div style={miniLabel}>END DIRECTOR APPOINTMENT</div>
                  <strong>
                    {directors.find((row) => row.id === endingDirectorId)
                      ?.director_name || "Director"}
                  </strong>
                </div>
                <SectionButton
                  label="Cancel"
                  onClick={() => setEndingDirectorId(null)}
                />
              </div>

              <FormGrid columns="220px 220px 1fr">
                <Field label="REASON">
                  <select
                    value={directorCessationReason}
                    onChange={(event) =>
                      setDirectorCessationReason(event.target.value)
                    }
                    style={input}
                  >
                    <option value="resigned">Resigned</option>
                    <option value="deceased">Deceased</option>
                    <option value="removed">Removed</option>
                    <option value="disqualified">Disqualified</option>
                    <option value="incapacitated">Incapacitated</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="EFFECTIVE DATE">
                  <input
                    type="date"
                    value={directorCessationDate}
                    onChange={(event) =>
                      setDirectorCessationDate(event.target.value)
                    }
                    style={input}
                  />
                </Field>
                <Field label="NOTES / CIPC EVIDENCE">
                  <input
                    value={directorCessationNotes}
                    onChange={(event) =>
                      setDirectorCessationNotes(event.target.value)
                    }
                    placeholder="e.g. resignation letter received / death certificate / removal resolution"
                    style={input}
                  />
                </Field>
              </FormGrid>

              <FormFooter>
                <span style={formHelp}>
                  This closes the appointment without deleting the director history.
                </span>
                <SaveButton
                  onClick={endDirectorAppointment}
                  saving={saving}
                  label="Record Director Change"
                />
              </FormFooter>
            </FormPanel>
          ) : null}

          <TableHeader
            columns="1.35fr 1fr 150px 170px 190px"
            labels={[
              "DIRECTOR",
              "ID / PASSPORT",
              "APPOINTED",
              "STATUS / ENDED",
              "ACTION",
            ]}
          />

          {directors.length ? (
            directors.map((director) => (
              <TableRow
                key={director.id}
                columns="1.35fr 1fr 150px 170px 190px"
              >
                <div>
                  <strong>{director.director_name}</strong>
                  <div style={mutedSmall}>
                    {director.is_active === false
                      ? formatStatus(director.cessation_reason || "Inactive")
                      : "Active"}
                  </div>
                </div>
                <div>{clean(director.id_passport_number)}</div>
                <div>{formatDate(director.appointment_date)}</div>
                <div>
                  <StatusPill
                    text={director.is_active === false ? "Ended" : "Active"}
                  />
                  {director.cessation_date ? (
                    <div style={mutedSmall}>
                      {formatDate(director.cessation_date)}
                    </div>
                  ) : null}
                </div>
                <div style={rowActions}>
                  {editingDirectorId === director.id && showDirectorForm ? (
                    <span style={editingRowPill}>Editing</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => editDirector(director)}
                      style={editActionButton}
                    >
                      Edit Director
                    </button>
                  )}

                </div>
              </TableRow>
            ))
          ) : (
            <Empty text="No directors captured yet." />
          )}
        </section>
      ) : null}

      {activeView === "shareholders" ? (
        <section style={panel}>
          <PanelHeading
            title="Shareholders"
            subtitle="Permanent holder master. Ownership is calculated from share transactions; it is never typed over the old history."
            action={
              <div style={rowActions}>
                <Link
                  href={`/crm/secretarial/client/${client.id}/share-transactions`}
                  style={secondaryButton}
                >
                  Change Shareholding
                </Link>
                <Link
                  href={`/crm/secretarial/share-certificates/new?clientId=${client.id}`}
                  style={secondaryButton}
                >
                  New Share Issue
                </Link>
                <SectionButton
                  label={showShareholderForm ? "Cancel" : "Add Shareholder"}
                  onClick={() => setShowShareholderForm(!showShareholderForm)}
                />
              </div>
            }
          />

          <div style={processNote}>
            <strong>How changes work</strong>
            <span>
              Add the new shareholder once, then use a share transaction to change the holding. PracticePilot recalculates the percentages from the register. Any issued certificate that no longer agrees with the live holding is flagged for replacement; the old certificate remains in history as replaced / cancelled rather than disappearing.
            </span>
          </div>

          {showShareholderForm ? (
            <FormPanel>
              <FormGrid columns="repeat(3, minmax(0, 1fr))">
                <Field label="HOLDER TYPE">
                  <select value={shareholderType} onChange={(event) => setShareholderType(event.target.value)} style={input}>
                    <option value="individual">Individual</option>
                    <option value="entity">Entity</option>
                    <option value="trust">Trust</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="FULL LEGAL NAME">
                  <input value={shareholderName} onChange={(event) => setShareholderName(event.target.value)} style={input} />
                </Field>
                <Field label="ID / REGISTRATION NUMBER">
                  <input value={shareholderIdNumber} onChange={(event) => setShareholderIdNumber(event.target.value)} style={input} />
                </Field>

                <Field label={shareholderType === "individual" ? "NATIONALITY" : "COUNTRY OF INCORPORATION / FORMATION"}>
                  <input value={shareholderNationalityOrCountry} onChange={(event) => setShareholderNationalityOrCountry(event.target.value)} style={input} />
                </Field>
                <Field label={shareholderType === "individual" ? "COUNTRY OF RESIDENCE" : "COUNTRY OF REGISTRATION"}>
                  <input value={shareholderCountryOfResidenceOrRegistration} onChange={(event) => setShareholderCountryOfResidenceOrRegistration(event.target.value)} style={input} />
                </Field>
                {shareholderType === "individual" ? (
                  <Field label="DATE OF BIRTH">
                    <input type="date" value={shareholderDateOfBirth} onChange={(event) => setShareholderDateOfBirth(event.target.value)} style={input} />
                  </Field>
                ) : (
                  <div />
                )}

                <Field label="EMAIL">
                  <input value={shareholderEmail} onChange={(event) => setShareholderEmail(event.target.value)} style={input} />
                </Field>
                <Field label="PHONE">
                  <input value={shareholderPhone} onChange={(event) => setShareholderPhone(event.target.value)} style={input} />
                </Field>
                <div />
              </FormGrid>

              <div style={formSectionTitle}>PHYSICAL / RESIDENTIAL ADDRESS</div>
              <FormGrid columns="repeat(3, minmax(0, 1fr))">
                <Field label="ADDRESS LINE 1"><input value={shareholderPhysical1} onChange={(event) => setShareholderPhysical1(event.target.value)} style={input} /></Field>
                <Field label="ADDRESS LINE 2"><input value={shareholderPhysical2} onChange={(event) => setShareholderPhysical2(event.target.value)} style={input} /></Field>
                <Field label="CITY / TOWN"><input value={shareholderPhysicalCity} onChange={(event) => setShareholderPhysicalCity(event.target.value)} style={input} /></Field>
                <Field label="PROVINCE / STATE"><input value={shareholderPhysicalProvince} onChange={(event) => setShareholderPhysicalProvince(event.target.value)} style={input} /></Field>
                <Field label="POSTAL CODE"><input value={shareholderPhysicalPostalCode} onChange={(event) => setShareholderPhysicalPostalCode(event.target.value)} style={input} /></Field>
                <Field label="COUNTRY"><input value={shareholderPhysicalCountry} onChange={(event) => setShareholderPhysicalCountry(event.target.value)} style={input} /></Field>
              </FormGrid>

              <div style={formSectionTitleRow}>
                <span style={formSectionTitle}>POSTAL ADDRESS</span>
                <label style={copyAddressLabel}>
                  <input type="checkbox" checked={postalSameAsPhysical} onChange={(event) => setPostalSameAsPhysical(event.target.checked)} /> Same as physical address
                </label>
              </div>

              {!postalSameAsPhysical ? (
                <FormGrid columns="repeat(3, minmax(0, 1fr))">
                  <Field label="ADDRESS LINE 1"><input value={shareholderPostal1} onChange={(event) => setShareholderPostal1(event.target.value)} style={input} /></Field>
                  <Field label="ADDRESS LINE 2"><input value={shareholderPostal2} onChange={(event) => setShareholderPostal2(event.target.value)} style={input} /></Field>
                  <Field label="CITY / TOWN"><input value={shareholderPostalCity} onChange={(event) => setShareholderPostalCity(event.target.value)} style={input} /></Field>
                  <Field label="PROVINCE / STATE"><input value={shareholderPostalProvince} onChange={(event) => setShareholderPostalProvince(event.target.value)} style={input} /></Field>
                  <Field label="POSTAL CODE"><input value={shareholderPostalPostalCode} onChange={(event) => setShareholderPostalPostalCode(event.target.value)} style={input} /></Field>
                  <Field label="COUNTRY"><input value={shareholderPostalCountry} onChange={(event) => setShareholderPostalCountry(event.target.value)} style={input} /></Field>
                </FormGrid>
              ) : null}

              <FormFooter>
                <span style={formHelp}>
                  Adding or editing a shareholder updates the permanent holder master. Share ownership itself changes only through share transactions.
                </span>
                <SaveButton
                  onClick={saveShareholder}
                  saving={saving}
                  label={editingShareholderId ? "Update Shareholder" : "Save Shareholder"}
                />
              </FormFooter>
            </FormPanel>
          ) : null}

          <TableHeader
            columns="1.25fr 1fr 120px 120px 1fr 170px"
            labels={[
              "SHAREHOLDER",
              "ID / REGISTRATION",
              "CURRENT SHARES",
              "% OF ISSUED",
              "CERTIFICATE POSITION",
              "ACTION",
            ]}
          />

          {shareholders.length ? (
            shareholders.map((row) => {
              const issuedToHolder = currentHoldings
                .filter((holding) => holding.shareholderId === row.id)
                .reduce((total, holding) => total + holding.shares, 0);

              const percent =
                totalIssuedShares > 0
                  ? (issuedToHolder / totalIssuedShares) * 100
                  : 0;

              const liveCertificates = issuedCertificates.filter(
                (certificate) => certificate.shareholder_id === row.id
              );

              const certificateShares = liveCertificates.reduce(
                (total, certificate) =>
                  total + Number(certificate.number_of_shares || 0),
                0
              );

              const certificateMatches =
                issuedToHolder === certificateShares &&
                (issuedToHolder === 0 || liveCertificates.length > 0);

              return (
                <TableRow
                  key={row.id}
                  columns="1.25fr 1fr 120px 120px 1fr 170px"
                >
                  <div>
                    <strong>{row.full_legal_name}</strong>
                    <div style={mutedSmall}>{formatStatus(row.holder_type)}</div>
                  </div>
                  <div>{clean(row.id_registration_number)}</div>
                  <strong>{issuedToHolder.toLocaleString("en-ZA")}</strong>
                  <strong>{percent.toFixed(2)}%</strong>
                  <div>
                    {certificateMatches ? (
                      <StatusPill text={issuedToHolder > 0 ? "Current" : "No shares"} />
                    ) : (
                      <>
                        <StatusPill text="Replacement required" />
                        <div style={mutedSmall}>
                          Live holding and issued certificate quantities differ.
                        </div>
                      </>
                    )}
                  </div>
                  {editingShareholderId === row.id && showShareholderForm ? (
                    <span style={editingRowPill}>Editing</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => editShareholder(row)}
                      style={editActionButton}
                    >
                      Edit Shareholder
                    </button>
                  )}
                </TableRow>
              );
            })
          ) : (
            <Empty text="No shareholders captured yet." />
          )}
        </section>
      ) : null}

      {activeView === "share-capital" ? (
        <section style={panel}>
          <PanelHeading
            title="Share Capital"
            subtitle="Authorised and issued share classes."
            action={
              <div style={rowActions}>
                <Link
                  href={`/crm/secretarial/client/${client.id}/share-transactions`}
                  style={secondaryButton}
                >
                  Change Shareholding
                </Link>
                <SectionButton
                  label={showShareClassForm ? "Cancel" : "Add Share Class"}
                  onClick={() => setShowShareClassForm(!showShareClassForm)}
                />
              </div>
            }
          />

          {showShareClassForm ? (
            <FormPanel>
              <FormGrid columns="1.3fr 160px 1fr 180px">
                <Field label="CLASS NAME">
                  <input
                    value={shareClassName}
                    onChange={(event) => setShareClassName(event.target.value)}
                    style={input}
                  />
                </Field>
                <Field label="CLASS CODE">
                  <input
                    value={shareClassCode}
                    onChange={(event) => setShareClassCode(event.target.value)}
                    style={input}
                  />
                </Field>
                <Field label="SERIES DESIGNATION">
                  <input
                    value={shareClassSeries}
                    onChange={(event) => setShareClassSeries(event.target.value)}
                    style={input}
                  />
                </Field>
                <Field label="AUTHORISED SHARES">
                  <input
                    type="number"
                    min="0"
                    value={authorisedShares}
                    onChange={(event) => setAuthorisedShares(event.target.value)}
                    style={input}
                  />
                </Field>
              </FormGrid>

              <Field label="RIGHTS / RESTRICTIONS">
                <textarea
                  value={shareClassRights}
                  onChange={(event) => setShareClassRights(event.target.value)}
                  style={textarea}
                />
              </Field>

              <FormFooter>
                <span style={formHelp}>
                  Issued shares are controlled by completed share transactions,
                  not manually typed here.
                </span>
                <SaveButton
                  onClick={saveShareClass}
                  saving={saving}
                  label={editingShareClassId ? "Update Share Class" : "Save Share Class"}
                />
              </FormFooter>
            </FormPanel>
          ) : null}

          <TableHeader
            columns="1.4fr 160px 160px 160px 80px"
            labels={["CLASS", "AUTHORISED", "ISSUED", "AVAILABLE", "ACTION"]}
          />

          {shareClasses.length ? (
            shareClasses.map((row) => {
              const authorised = Number(row.authorised_shares || 0);
              const issued = Number(row.issued_shares || 0);
              const available =
                authorised > 0 ? Math.max(0, authorised - issued) : null;

              return (
                <TableRow key={row.id} columns="1.4fr 160px 160px 160px 80px">
                  <div>
                    <strong>{row.class_name}</strong>
                    <div style={mutedSmall}>
                      {row.series_designation || row.class_code || "No series"}
                    </div>
                  </div>
                  <div>{authorised || "Not captured"}</div>
                  <strong>{issued.toLocaleString("en-ZA")}</strong>
                  <strong>{available == null ? "—" : available.toLocaleString("en-ZA")}</strong>
                  <button
                    type="button"
                    onClick={() => editShareClass(row)}
                    style={linkButton}
                  >
                    Edit
                  </button>
                </TableRow>
              );
            })
          ) : (
            <Empty text="No share classes captured yet." />
          )}
        </section>
      ) : null}

      {activeView === "certificates" ? (
        <section style={panel}>
          <PanelHeading
            title="Share Certificates"
            subtitle="Share issues create certificate matters from shareholders already captured in this client file."
            action={
              <Link
                href={`/crm/secretarial/share-certificates/new?clientId=${client.id}`}
                style={secondaryButton}
              >
                New Share Issue
              </Link>
            }
          />

          <div style={miniSectionTitle}>REPLACEMENT CERTIFICATES REQUIRED</div>

          {pendingReplacementCertificates.length ? (
            pendingReplacementCertificates.map((replacement) => {
              const holder = shareholderById.get(replacement.shareholder_id);
              const shareClass = replacement.share_class_id
                ? classById.get(replacement.share_class_id)
                : null;

              return (
                <div key={replacement.id} style={replacementCertificateRow}>
                  <div>
                    <strong>{holder?.full_legal_name || "Shareholder"}</strong>
                    <div style={mutedSmall}>
                      {Number(replacement.replacement_shares || 0).toLocaleString("en-ZA")}{" "}
                      {shareClass?.class_name || "shares"}
                    </div>
                  </div>
                  <div>{replacement.replacement_reason}</div>
                  <StatusPill text={formatStatus(replacement.queue_status)} />
                  <Link
                    href={`/crm/secretarial/share-certificates/new?clientId=${client.id}&shareholderId=${replacement.shareholder_id}&replacementQueueId=${replacement.id}`}
                    style={rowActionButton}
                  >
                    Create Replacement
                  </Link>
                </div>
              );
            })
          ) : (
            <Empty text="No replacement certificates are currently required." compact />
          )}

          <div style={miniSectionTitle}>OPEN / DRAFT CERTIFICATE MATTERS</div>

          {openMatters.length ? (
            openMatters.map((matter) => {
              const holder = matter.shareholder_id
                ? shareholderById.get(matter.shareholder_id)
                : null;

              return (
                <div key={matter.id} style={certificateRow}>
                  <div>
                    <strong>
                      Certificate {clean(matter.certificate_number)}
                    </strong>
                    <div style={mutedSmall}>
                      {holder?.full_legal_name || "Shareholder not yet selected"}
                    </div>
                  </div>
                  <div>Flight Map {matter.current_step || 1} of 9</div>
                  <StatusPill text={formatStatus(matter.matter_status)} />
                  <Link
                    href={`/crm/secretarial/share-certificates/${matter.id}`}
                    style={rowActionButton}
                  >
                    Open Matter
                  </Link>
                </div>
              );
            })
          ) : (
            <Empty text="No open certificate matters." compact />
          )}

          <div style={miniSectionTitle}>CERTIFICATE HISTORY</div>

          {certificates.length ? (
            certificates.map((certificate) => {
              const holder = certificate.shareholder_id
                ? shareholderById.get(certificate.shareholder_id)
                : null;

              const shareClass = certificate.share_class_id
                ? classById.get(certificate.share_class_id)
                : null;

              return (
                <div key={certificate.id} style={certificateIssuedRow}>
                  <div>
                    <strong style={certificateNumber}>
                      Certificate {clean(certificate.certificate_number)}
                    </strong>
                    <div style={mutedSmall}>
                      {holder?.full_legal_name || "—"}
                    </div>
                  </div>

                  <div>
                    {Number(certificate.number_of_shares || 0).toLocaleString("en-ZA")}{" "}
                    {shareClass?.class_name || "shares"}
                  </div>

                  <div>{formatDate(certificate.issue_date)}</div>

                  <div>
                    <StatusPill text={formatStatus(certificate.certificate_status)} />
                    {["superseded", "replaced", "cancelled", "void"].includes(
                      String(certificate.certificate_status || "").toLowerCase()
                    ) ? (
                      <div style={mutedSmall}>Preserved in certificate history</div>
                    ) : null}
                  </div>

                  <div style={certificateActions}>
                    {certificate.matter_id ? (
                      <Link
                        href={`/crm/secretarial/share-certificates/${certificate.matter_id}`}
                        style={rowActionButton}
                      >
                        Open Matter
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        previewSecretarialDocument("share-certificate", certificate.id)
                      }
                      style={rowActionButton}
                    >
                      Preview Certificate
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty text="No share certificates issued yet." compact />
          )}
        </section>
      ) : null}

      {activeView === "beneficial-ownership" ? (
        <section style={panel}>
          <PanelHeading
            title="Beneficial Ownership"
            subtitle="Direct natural-person ownership is calculated from the live share register. Only complex / indirect ownership is captured separately."
            action={
              <button type="button" onClick={() => setShowIndirectBoForm((current) => !current)} style={secondaryButton}>
                {showIndirectBoForm ? "Cancel" : "Add Indirect / Control BO"}
              </button>
            }
          />

          <div style={boSummaryStrip}>
            <div>
              <span style={miniLabel}>CURRENT NATURAL-PERSON BO</span>
              <strong style={boControlTitle}>
                {derivedBeneficialOwners.length ? `${derivedBeneficialOwners.length} beneficial owner${derivedBeneficialOwners.length === 1 ? "" : "s"}` : "No natural-person BO identified yet"}
              </strong>
            </div>
            <div>
              <span style={miniLabel}>CIPC STATUS</span>
              <StatusPill text={formatStatus(boOverallStatus === "filed" ? "up_to_date" : boOverallStatus === "structure_review_required" ? "review_required" : "not_filed")} />
            </div>
          </div>

          <div style={boStructureReview}>
            <div style={boStructureCell}><span style={miniLabel}>STRUCTURE</span><strong style={boStructureValue}>{complexOwnershipHoldings.length ? "Complex / indirect ownership" : "Simple direct ownership"}</strong></div>
            <div style={boStructureCell}><span style={miniLabel}>DIRECT NATURAL-PERSON HOLDERS</span><strong style={boStructureValue}>{directNaturalPersonHoldings.length}</strong></div>
            <div style={boStructureCell}><span style={miniLabel}>NON-NATURAL HOLDERS</span><strong style={boStructureValue}>{complexOwnershipHoldings.length}</strong>{complexOwnershipHoldings.length ? <span style={boStructureNote}>Ultimate natural-person BO must be identified before filing.</span> : null}</div>
          </div>

          {complexOwnershipHoldings.length ? (
            <div style={warningBar}>
              The share register contains {complexOwnershipHoldings.length} company / trust / other holder{complexOwnershipHoldings.length === 1 ? "" : "s"}. PracticePilot will not treat those entities as beneficial owners. Capture the ultimate natural person(s) below.
            </div>
          ) : null}

          {showIndirectBoForm ? (
            <FormPanel>
              <div style={formSectionTitle}>INDIRECT / CONTROL BENEFICIAL OWNER — NATURAL PERSON</div>
              <FormGrid columns="repeat(3, minmax(0, 1fr))">
                <Field label="FULL LEGAL NAME"><input value={boOwnerName} onChange={(e) => setBoOwnerName(e.target.value)} style={input} /></Field>
                <Field label="ID / PASSPORT NUMBER"><input value={boOwnerIdNumber} onChange={(e) => setBoOwnerIdNumber(e.target.value)} style={input} /></Field>
                <Field label="OWNERSHIP / CONTROL %"><input value={boOwnershipPercentage} onChange={(e) => setBoOwnershipPercentage(e.target.value)} placeholder="0.00" style={input} /></Field>
                <Field label="NATURE OF INTEREST">
                  <select value={boNatureOfInterest} onChange={(e) => setBoNatureOfInterest(e.target.value)} style={input}>
                    <option value="indirect_shareholding">Indirect shareholding</option>
                    <option value="voting_rights">Voting rights</option>
                    <option value="right_to_appoint_directors">Right to appoint / remove directors</option>
                    <option value="effective_control">Effective control</option>
                    <option value="trust_beneficiary">Trust beneficiary / control</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="EFFECTIVE FROM"><input type="date" value={boEffectiveFrom} onChange={(e) => setBoEffectiveFrom(e.target.value)} style={input} /></Field>
                <Field label="NATIONALITY"><input value={boNationality} onChange={(e) => setBoNationality(e.target.value)} style={input} /></Field>
                <Field label="COUNTRY OF RESIDENCE"><input value={boCountryOfResidence} onChange={(e) => setBoCountryOfResidence(e.target.value)} style={input} /></Field>
                <Field label="EMAIL"><input value={boEmail} onChange={(e) => setBoEmail(e.target.value)} style={input} /></Field>
                <Field label="PHONE"><input value={boPhone} onChange={(e) => setBoPhone(e.target.value)} style={input} /></Field>
                <Field label="CONTROL / INTEREST DESCRIPTION"><input value={boControlDescription} onChange={(e) => setBoControlDescription(e.target.value)} style={input} /></Field>
                <Field label="PHYSICAL ADDRESS"><input value={boPhysicalAddress} onChange={(e) => setBoPhysicalAddress(e.target.value)} style={input} /></Field>
                <Field label="STRUCTURE / SOURCE NOTES"><input value={boStructureNotes} onChange={(e) => setBoStructureNotes(e.target.value)} style={input} /></Field>
              </FormGrid>
              <FormFooter>
                <span style={formHelp}>Use this only where the ultimate natural person cannot be derived directly from the company's issued-share register.</span>
                <SaveButton onClick={saveIndirectBeneficialOwner} saving={saving} label="Add Beneficial Owner" />
              </FormFooter>
            </FormPanel>
          ) : null}

          <TableHeader columns="1.25fr 1fr 150px 1fr 170px" labels={["BENEFICIAL OWNER", "ID / PASSPORT", "%", "BASIS", "STATUS"]} />
          {derivedBeneficialOwners.length ? derivedBeneficialOwners.map((owner) => (
            <TableRow key={owner.id} columns="1.25fr 1fr 150px 1fr 170px">
              <strong>{owner.name}</strong><div>{clean(owner.idNumber)}</div><strong>{owner.percentage == null ? "—" : `${Number(owner.percentage).toFixed(2)}%`}</strong><div>{owner.source}</div><StatusPill text={owner.status === "ready" ? "Confirmed" : formatStatus(owner.status)} />
            </TableRow>
          )) : <Empty text="No natural-person beneficial owner has been identified yet." />}

          {currentHoldings.length ? (
            <div style={boFilingPanelSimple}>
              <div>
                <strong>CIPC BO filing</strong>
                <div style={mutedSmall}>Generate the mandate and supporting register, obtain signature and then record the filing result.</div>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button type="button" onClick={() => previewSecretarialDocument("bo-mandate")} style={rowActionButton}>Preview Mandate</button>
                  <button type="button" onClick={() => downloadSecretarialDocument("bo-mandate", null, `${client.client_name}-BO-Mandate.pdf`)} style={rowActionButton}>Download PDF</button>
                </div>
              </div>
              <Field label="CIPC REFERENCE"><input value={boCipcReference} onChange={(e) => setBoCipcReference(e.target.value)} placeholder="CIPC filing reference" style={input} /></Field>
              <Field label="FILED DATE"><input type="date" value={boFiledDate} onChange={(e) => setBoFiledDate(e.target.value)} style={input} /></Field>
              <button type="button" onClick={markBeneficialOwnershipFiled} disabled={saving} style={primaryCompactButton}>{boOverallStatus === "filed" ? "Update Filing" : "Record BO Filing"}</button>
            </div>
          ) : null}

          <div style={documentFace}><strong>BO filing pack</strong><span>Mandate, natural-person beneficial ownership schedule and the applicable securities / beneficial-interest information are generated from the client file.</span></div>
        </section>
      ) : null}

      {activeView === "annual-returns" ? (
        <section style={panel}>
          <PanelHeading
            title="Annual Returns"
            subtitle="One annual control record: turnover, CIPC fee, filing readiness, filing result and permanent history."
          />

          {!client.registration_date || !nextAnnualReturn ? (
            <div style={warningBar}>
              Registration date is missing from the client record. Add it in the Client Database so PracticePilot can calculate the Annual Return cycle.
            </div>
          ) : (
            <div style={arWorkspace}>
              <div style={arTitleRow}>
                <div>
                  <div style={arYearLine}>{nextAnnualReturn.year} Annual Return</div>
                  <div style={arWindowLine}>
                    Filing window: {formatDate(nextAnnualReturn.anniversaryDate)} – {formatDate(nextAnnualReturn.dueDate)}
                  </div>
                </div>
                <StatusPill text={formatStatus(currentAnnualReturn?.return_status || "not_started")} />
              </div>

              <div style={arGridHeader}>
                <span style={arGridHeaderCell}><b style={arStepNo}>01</b> TURNOVER &amp; CIPC</span>
                <span style={arGridHeaderCell}><b style={arStepNo}>02</b> FILING READINESS</span>
                <span style={arGridHeaderCell}><b style={arStepNo}>03</b> CIPC FILING RESULT</span>
              </div>

              <div style={arThreePanel}>
                <div style={arColumn}>
                  <Field label="ANNUAL TURNOVER">
                    <div style={arMoneyInput}>
                      <span style={arCurrencyPrefix}>R</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={annualTurnover}
                        onChange={(event) =>
                          setAnnualTurnover(formatWholeNumberInput(event.target.value))
                        }
                        placeholder="0"
                        style={arMoneyField}
                      />
                    </div>
                    <div style={arInputHelpRow}>
                      <span>Latest approved financial statements · whole rand amount</span>
                      {annualTurnover ? (
                        <button
                          type="button"
                          onClick={resetAnnualTurnover}
                          disabled={saving}
                          style={arClearTurnover}
                        >
                          Reset to 0
                        </button>
                      ) : null}
                    </div>
                  </Field>

                  <div style={arFeeTable}>
                    <div style={arFeeLine}><span>CIPC fee</span><strong>{money(annualFeePreview.baseFee)}</strong></div>
                    <div style={arFeeLine}><span>Late amount</span><strong>{money(annualFeePreview.penalty)}</strong></div>
                    <div style={{ ...arFeeLine, ...arFeeTotal }}><span>Total payable</span><strong>{money(annualFeePreview.totalFee)}</strong></div>
                  </div>

                  <div style={arBandLine}>
                    <span>Fee band</span>
                    <strong>{annualFeePreview.bandLabel}</strong>
                  </div>
                </div>

                <div style={arColumn}>
                  <Field label="BENEFICIAL OWNERSHIP">
                    <div style={arReadOnlyLine}>
                      <StatusPill text={formatStatus(annualBOLiveStatus)} />
                      <Link
                        href={`/crm/secretarial/client/${client.id}?view=beneficial-ownership`}
                        style={arInlineAction}
                      >
                        Manage BO →
                      </Link>
                    </div>
                  </Field>

                  <Field label="FINANCIAL SUBMISSION TYPE">
                    <select
                      value={annualFinancialType}
                      onChange={(event) => setAnnualFinancialType(event.target.value)}
                      style={input}
                    >
                      <option value="FAS">FAS</option>
                      <option value="AFS">AFS</option>
                      <option value="not_required">Not required</option>
                    </select>
                  </Field>

                  <Field label="AFS / FAS STATUS">
                    <select
                      value={annualFinancialStatus}
                      onChange={(event) => setAnnualFinancialStatus(event.target.value)}
                      style={input}
                    >
                      <option value="outstanding">Outstanding</option>
                      <option value="submitted">Submitted</option>
                      <option value="not_required">Not required</option>
                    </select>
                  </Field>
                </div>

                <div style={arColumn}>
                  <Field label="RETURN STATUS">
                    <select
                      value={annualReturnStatus}
                      onChange={(event) => setAnnualReturnStatus(event.target.value)}
                      style={input}
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="paid">Paid</option>
                      <option value="completed">Completed</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </Field>

                  <div style={arDatePair}>
                    <Field label="SUBMITTED DATE">
                      <input type="date" value={annualSubmittedDate} onChange={(event) => setAnnualSubmittedDate(event.target.value)} style={input} />
                    </Field>
                    <Field label="PAID DATE">
                      <input type="date" value={annualPaidDate} onChange={(event) => setAnnualPaidDate(event.target.value)} style={input} />
                    </Field>
                  </div>

                  <Field label="CIPC REFERENCE NUMBER">
                    <input
                      value={annualCipcReference}
                      onChange={(event) => setAnnualCipcReference(event.target.value)}
                      placeholder="Capture after CIPC filing"
                      style={input}
                    />
                  </Field>
                </div>
              </div>

              <div style={arFooter}>
                <div style={arFootNote}>
                  Turnover drives the statutory CIPC fee. The filed year remains in history and is never overwritten by the next cycle.
                </div>
                <div style={rowActions}>
                  <button
                    type="button"
                    onClick={() =>
                      previewSecretarialDocument(
                        "annual-return-authority",
                        currentAnnualReturn?.id || null
                      )
                    }
                    style={secondaryButton}
                    disabled={!currentAnnualReturn}
                  >
                    Preview Client Authority
                  </button>
                  <SaveButton
                    onClick={saveAnnualReturnControl}
                    saving={saving}
                    label={currentAnnualReturn ? "Save Annual Return" : "Create Annual Return"}
                  />
                </div>
              </div>
            </div>
          )}

          <div style={arHistoryHeading}>
            <strong>Annual Return History</strong>
            <span>Permanent CIPC filing history by year.</span>
          </div>

          <TableHeader
            columns="90px 130px 180px 140px 150px 150px 1fr"
            labels={["YEAR", "DEADLINE", "TURNOVER / FEE", "BO", "AFS / FAS", "STATUS", "CIPC REFERENCE"]}
          />
          {annualReturns.length ? (
            annualReturns.map((row) => (
              <TableRow
                key={row.id}
                columns="90px 130px 180px 140px 150px 150px 1fr"
              >
                <strong>{row.return_year}</strong>
                <div>{formatDate(row.due_date)}</div>
                <div>
                  <strong>{money(row.annual_turnover)}</strong>
                  <div style={mutedSmall}>
                    CIPC {money(Number(row.annual_return_fee || 0) + Number(row.penalty_amount || 0))}
                  </div>
                </div>
                <StatusPill text={formatStatus(row.beneficial_ownership_status)} />
                <StatusPill text={formatStatus(row.financial_submission_status)} />
                <StatusPill text={formatStatus(row.return_status)} />
                <div>{clean(row.cipc_reference)}</div>
              </TableRow>
            ))
          ) : (
            <Empty text="No Annual Return history yet." />
          )}
        </section>
      ) : null}

      {activeView === "company-changes" ? (
        <section style={panel}>
          <PanelHeading
            title="Other CIPC Changes"
            subtitle="Use this area only for statutory changes that do not already belong under Directors, Share Capital, Share Certificates, Beneficial Ownership or Annual Returns."
          />

          <div style={cipcHomeNote}>
            <strong>Already has a home?</strong>
            <span>
              Director changes belong under Directors. Share-capital amendments
              belong under Share Capital. Share issues and transfers belong under
              Share Certificates. BO and Annual Returns stay in their own work areas.
            </span>
          </div>

          <div style={cipcActionGrid}>
            {[
              {
                type: "registered_address",
                title: "Registered Office / Business Address",
                description: "Change the company's registered or principal business address.",
              },
              {
                type: "postal_address",
                title: "Postal Address",
                description: "Update the company's postal address where required.",
              },
              {
                type: "company_name",
                title: "Company Name Change",
                description: "Start and track a formal company-name amendment.",
              },
              {
                type: "moi",
                title: "MOI Amendment",
                description: "Record and track amendments to the Memorandum of Incorporation.",
              },
              {
                type: "financial_year_end",
                title: "Financial Year-End Change",
                description: "Track a formal change to the company's financial year-end.",
              },
              {
                type: "contact_details",
                title: "Company Contact Details",
                description: "Update company email, telephone, website or similar CIPC-maintained details.",
              },
              {
                type: "other",
                title: "Other CIPC Filing",
                description: "Use only when the filing does not fit another Secretarial work area.",
              },
            ].map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => {
                  setChangeType(item.type);
                  setChangeTitle(item.title);
                  setChangeDescription("");
                  setChangeEffectiveDate("");
                  setShowChangeForm(true);
                }}
                style={cipcActionButton}
              >
                <span style={cipcActionTitle}>{item.title}</span>
                <span style={cipcActionDescription}>{item.description}</span>
                <span style={cipcActionLink}>Start change →</span>
              </button>
            ))}
          </div>

          {showChangeForm ? (
            <FormPanel>
              <div style={changeFormHeader}>
                <div>
                  <div style={miniLabel}>CURRENT CHANGE</div>
                  <strong>{changeTitle || formatStatus(changeType)}</strong>
                </div>
                <SectionButton
                  label="Cancel"
                  onClick={() => {
                    setShowChangeForm(false);
                    setChangeType("registered_address");
                    setChangeTitle("");
                    setChangeDescription("");
                    setChangeEffectiveDate("");
                  }}
                />
              </div>

              <FormGrid columns="1.2fr 220px">
                <Field label="MATTER TITLE">
                  <input
                    value={changeTitle}
                    onChange={(event) => setChangeTitle(event.target.value)}
                    style={input}
                  />
                </Field>

                <Field label="EFFECTIVE DATE">
                  <input
                    type="date"
                    value={changeEffectiveDate}
                    onChange={(event) => setChangeEffectiveDate(event.target.value)}
                    style={input}
                  />
                </Field>
              </FormGrid>

              <Field label="DETAILS / CHANGE REQUEST">
                <textarea
                  value={changeDescription}
                  onChange={(event) => setChangeDescription(event.target.value)}
                  placeholder="Capture the current position, requested change and any filing notes."
                  style={textarea}
                />
              </Field>

              <FormFooter>
                <span style={formHelp}>
                  This creates the CIPC change matter. The permanent client record
                  should be updated from the completed workflow rather than captured
                  twice.
                </span>
                <SaveButton
                  onClick={addCompanyChange}
                  saving={saving}
                  label="Create CIPC Change Matter"
                />
              </FormFooter>
            </FormPanel>
          ) : null}

          <div style={subsectionHeading}>
            <div>
              <strong>Change History & Open Matters</strong>
              <div style={mutedSmall}>
                Permanent record of other CIPC changes started or completed for this client.
              </div>
            </div>
          </div>

          <TableHeader
            columns="220px 1.2fr 180px 180px 180px"
            labels={["CHANGE TYPE", "MATTER", "EFFECTIVE", "CIPC REFERENCE", "STATUS"]}
          />

          {companyChanges.length ? (
            companyChanges.map((row) => (
              <TableRow
                key={row.id}
                columns="220px 1.2fr 180px 180px 180px"
              >
                <div>{formatStatus(row.change_type)}</div>
                <div>
                  <strong>{row.title}</strong>
                  <div style={mutedSmall}>{clean(row.description)}</div>
                </div>
                <div>{formatDate(row.effective_date)}</div>
                <div>{clean(row.cipc_reference)}</div>
                <StatusPill text={formatStatus(row.matter_status)} />
              </TableRow>
            ))
          ) : (
            <Empty text="No other CIPC changes have been recorded for this client." />
          )}
        </section>
      ) : null}

      {activeView === "registers" ? (
        <>
          <section style={panel}>
            <PanelHeading
              title="Securities Register"
              subtitle="Permanent share transaction history posted by completed share workflows."
            />

            <TableHeader
              columns="150px 170px 1.2fr 1fr 140px 1fr"
              labels={["DATE", "TRANSACTION", "HOLDER", "CLASS", "SHARES", "REFERENCE"]}
            />

            {transactions.length ? (
              transactions.map((transaction) => {
                const holder = transaction.shareholder_id
                  ? shareholderById.get(transaction.shareholder_id)
                  : null;
                const shareClass = transaction.share_class_id
                  ? classById.get(transaction.share_class_id)
                  : null;

                return (
                  <TableRow
                    key={transaction.id}
                    columns="150px 170px 1.2fr 1fr 140px 1fr"
                  >
                    <div>{formatDate(transaction.transaction_date)}</div>
                    <div>{formatStatus(transaction.transaction_type)}</div>
                    <div>{holder?.full_legal_name || "—"}</div>
                    <div>{shareClass?.class_name || "—"}</div>
                    <strong>{clean(transaction.number_of_shares)}</strong>
                    <div>{clean(transaction.notes)}</div>
                  </TableRow>
                );
              })
            ) : (
              <Empty text="No securities-register transactions posted yet." />
            )}
          </section>

          <section style={panel}>
            <PanelHeading
              title="Current Shareholder Register"
              subtitle="Calculated from the permanent share transaction history."
            />

            <TableHeader
              columns="1.3fr 1fr 180px 180px"
              labels={["SHAREHOLDER", "CLASS", "SHARES", "% OF ISSUED"]}
            />

            {currentHoldings.length ? (
              currentHoldings.map((row) => {
                const percentage =
                  totalIssuedShares > 0
                    ? (row.shares / totalIssuedShares) * 100
                    : 0;

                return (
                  <TableRow
                    key={`${row.shareholderId}-${row.shareClassId}`}
                    columns="1.3fr 1fr 180px 180px"
                  >
                    <strong>{row.shareholder?.full_legal_name || "—"}</strong>
                    <div>{row.shareClass?.class_name || "—"}</div>
                    <strong>{row.shares.toLocaleString("en-ZA")}</strong>
                    <strong>{percentage.toFixed(2)}%</strong>
                  </TableRow>
                );
              })
            ) : (
              <Empty text="No current shareholder holdings could be calculated yet." />
            )}
          </section>
        </>
      ) : null}

      {activeView === "documents" ? (
        <section style={panel}>
          <PanelHeading
            title="Documents"
            subtitle="Generated Secretarial outputs for this client. Nothing is manually added here."
          />

          <div style={documentFace}>
            <strong>Client Secretarial document pack</strong>
            <span>
              Share certificates, resolutions, securities registers, shareholder
              registers, BO mandates/supporting documents, annual-return evidence
              and statutory-change outputs are generated from the client file.
            </span>
            <span>
              Generated outputs can now be downloaded as PDFs. Email and File to
              document storage remain the next delivery actions.
            </span>
          </div>

          <TableHeader
            columns="220px 1.4fr 160px 170px 220px"
            labels={["TYPE", "DOCUMENT", "DATE", "STATUS", "ACTION"]}
          />

          {issuedCertificates.map((certificate) => (
            <TableRow
              key={`cert-${certificate.id}`}
              columns="220px 1.4fr 160px 170px 220px"
            >
              <div>Share Certificate</div>
              <strong>
                Certificate {clean(certificate.certificate_number)}
              </strong>
              <div>{formatDate(certificate.issue_date)}</div>
              <StatusPill text={formatStatus(certificate.certificate_status)} />
              <button
                type="button"
                onClick={() =>
                  previewSecretarialDocument(
                    "share-certificate",
                    certificate.id
                  )
                }
                style={downloadButton}
              >
                Preview PDF
              </button>
            </TableRow>
          ))}

          {resolutions.map((resolution) => (
            <TableRow
              key={`resolution-${resolution.id}`}
              columns="220px 1.4fr 160px 170px 220px"
            >
              <div>{formatStatus(resolution.resolution_type)} Resolution</div>
              <strong>
                {resolution.resolution_number} · {resolution.title}
              </strong>
              <div>{formatDate(resolution.resolution_date)}</div>
              <StatusPill text={formatStatus(resolution.status)} />
              <button
                type="button"
                onClick={() =>
                  previewSecretarialDocument(
                    "resolution",
                    resolution.id
                  )
                }
                style={downloadButton}
              >
                Preview PDF
              </button>
            </TableRow>
          ))}

          {matters
            .filter(
              (matter) =>
                matter.board_resolution_reference &&
                !resolutions.some(
                  (resolution) =>
                    resolution.related_record_id === matter.id
                )
            )
            .map((matter) => (
              <TableRow
                key={`legacy-resolution-${matter.id}`}
                columns="220px 1.4fr 160px 170px 220px"
              >
                <div>Share Issue Resolution</div>
                <strong>
                  Board Resolution {matter.board_resolution_reference}
                </strong>
                <div>{formatDate(matter.board_resolution_date)}</div>
                <StatusPill text="Generated" />
                <button
                  type="button"
                  onClick={() =>
                    previewSecretarialDocument(
                      "board-resolution",
                      matter.id
                    )
                  }
                  style={downloadButton}
                >
                  Preview PDF
                </button>
              </TableRow>
            ))}

          {transactions.length ? (
            <>
              <TableRow
                columns="220px 1.4fr 160px 170px 220px"
              >
                <div>Securities Register</div>
                <strong>Securities Register</strong>
                <div>Current</div>
                <StatusPill text="Current" />
                <button
                  type="button"
                  onClick={() =>
                    previewSecretarialDocument("securities-register")
                  }
                  style={downloadButton}
                >
                  Preview PDF
                </button>
              </TableRow>
              <TableRow
                columns="220px 1.4fr 160px 170px 220px"
              >
                <div>Shareholder Register</div>
                <strong>Current Shareholder Register</strong>
                <div>Current</div>
                <StatusPill text="Current" />
                <button
                  type="button"
                  onClick={() =>
                    previewSecretarialDocument("shareholder-register")
                  }
                  style={downloadButton}
                >
                  Preview PDF
                </button>
              </TableRow>
              <TableRow
                columns="220px 1.4fr 160px 170px 220px"
              >
                <div>Shareholding Confirmation</div>
                <strong>Shareholding Confirmation Letter + Register</strong>
                <div>Current</div>
                <StatusPill text="Available to Preview" />
                <button
                  type="button"
                  onClick={() =>
                    previewSecretarialDocument("shareholding-confirmation")
                  }
                  style={downloadButton}
                >
                  Preview PDF
                </button>
              </TableRow>
              <TableRow
                columns="220px 1.4fr 160px 170px 220px"
              >
                <div>Shareholding Confirmation</div>
                <strong>Detailed Shareholding Confirmation</strong>
                <div>Current</div>
                <StatusPill text="Available to Preview" />
                <button
                  type="button"
                  onClick={() =>
                    previewSecretarialDocument("shareholding-confirmation-detailed")
                  }
                  style={downloadButton}
                >
                  Preview PDF
                </button>
              </TableRow>
            </>
          ) : null}

          {derivedBeneficialOwners.length ? (
            <TableRow columns="220px 1.4fr 160px 170px 220px">
              <div>Beneficial Ownership Mandate</div>
              <strong>BO Mandate & Supporting Pack</strong>
              <div>Current</div>
              <StatusPill text="Available to Preview" />
              <button
                type="button"
                onClick={() =>
                  previewSecretarialDocument("bo-mandate")
                }
                style={downloadButton}
              >
                Preview PDF
              </button>
            </TableRow>
          ) : null}

          {annualReturns.length ? (
            <TableRow columns="220px 1.4fr 160px 170px 220px">
              <div>Annual Return Authority</div>
              <strong>
                Client Turnover & Filing Authority - {annualReturns[0].return_year}
              </strong>
              <div>{formatDate(annualReturns[0].due_date)}</div>
              <StatusPill text="Available to Preview" />
              <button
                type="button"
                onClick={() =>
                  previewSecretarialDocument(
                    "annual-return-authority",
                    annualReturns[0].id
                  )
                }
                style={downloadButton}
              >
                Preview PDF
              </button>
            </TableRow>
          ) : null}

          {documents.map((row) => (
            <TableRow
              key={`stored-${row.id}`}
              columns="220px 1.4fr 160px 170px 220px"
            >
              <div>{row.document_type}</div>
              <strong>{row.display_name}</strong>
              <div>{formatDate(row.document_date || row.created_at)}</div>
              <StatusPill text={formatStatus(row.document_status)} />
              <div>
                {row.external_url ? (
                  <a href={row.external_url} style={textLink}>
                    Open stored document
                  </a>
                ) : (
                  <span style={mutedSmall}>Stored reference</span>
                )}
              </div>
            </TableRow>
          ))}

          {!issuedCertificates.length &&
          !transactions.length &&
          !derivedBeneficialOwners.length &&
          !documents.length ? (
            <Empty text="No Secretarial document outputs are available yet." />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}


function Summary({
  label,
  value,
  last = false,
}: {
  label: string;
  value: number;
  last?: boolean;
}) {
  return (
    <div style={last ? summaryItemLast : summaryItem}>
      <span style={summaryLabel}>{label}</span>
      <strong style={summaryValue}>{value.toLocaleString("en-ZA")}</strong>
    </div>
  );
}

function PanelHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={panelHeading}>
      <div>
        <h2 style={panelTitle}>{title}</h2>
        <div style={panelSubtitle}>{subtitle}</div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function ControlTile({
  title,
  value,
  href,
  icon,
}: {
  title: string;
  value: string;
  href: string;
  icon: string;
}) {
  return (
    <Link href={href} style={controlTile}>
      <div style={controlTileTop}>
        <span style={controlIcon}>
          <SecretarialIcon name={icon} />
        </span>
        <strong>{title}</strong>
      </div>
      <span style={controlValue}>{value}</span>
      <span style={tileArrow} aria-hidden="true">→</span>
    </Link>
  );
}

function FeeCell({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div style={strong ? feeCellStrong : feeCell}>
      <span style={miniLabel}>{label}</span>
      <strong style={feeValue}>{value}</strong>
    </div>
  );
}

function SecretarialIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "square" as const,
    strokeLinejoin: "miter" as const,
    "aria-hidden": true,
  };

  if (name === "people" || name === "ownership") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20v-2c0-3 2-5 5-5s5 2 5 5v2" />
        <path d="M14 14c3 0 5 2 5 5v1" />
      </svg>
    );
  }

  if (name === "person") {
    return (
      <svg {...common}>
        <circle cx="12" cy="7" r="3.5" />
        <path d="M5 21v-3c0-4 3-6 7-6s7 2 7 6v3" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" />
        <path d="M7 2v6M17 2v6M3 10h18" />
      </svg>
    );
  }

  if (name === "certificate") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="14" />
        <path d="M7 8h10M7 12h7M9 18v4l3-2 3 2v-4" />
      </svg>
    );
  }

  if (name === "capital") {
    return (
      <svg {...common}>
        <path d="M4 20V9M10 20V4M16 20v-7M22 20H2" />
      </svg>
    );
  }

  if (name === "register") {
    return (
      <svg {...common}>
        <path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h8" />
      </svg>
    );
  }

  if (name === "document") {
    return (
      <svg {...common}>
        <path d="M6 2h8l4 4v16H6zM14 2v5h5M9 12h6M9 16h6" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 4h16v16H4zM8 12h8M12 8v8" />
    </svg>
  );
}

function SectionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={secondaryButton}>
      {label}
    </button>
  );
}

function SaveButton({
  onClick,
  saving,
  label,
}: {
  onClick: () => void;
  saving: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      style={{
        ...saveButton,
        ...(saving ? saveButtonDisabled : {}),
      }}
    >
      {saving ? "Saving..." : label}
    </button>
  );
}

function FormPanel({ children }: { children: React.ReactNode }) {
  return <div style={formPanel}>{children}</div>;
}

function FormGrid({
  children,
  columns,
}: {
  children: React.ReactNode;
  columns: string;
}) {
  return (
    <div style={{ ...formGrid, gridTemplateColumns: columns }}>{children}</div>
  );
}

function FormFooter({ children }: { children: React.ReactNode }) {
  return <div style={formFooter}>{children}</div>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function TableHeader({
  columns,
  labels,
}: {
  columns: string;
  labels: string[];
}) {
  return (
    <div style={{ ...tableHeader, gridTemplateColumns: columns }}>
      {labels.map((label) => (
        <div key={label}>{label}</div>
      ))}
    </div>
  );
}

function TableRow({
  children,
  columns,
}: {
  children: React.ReactNode;
  columns: string;
}) {
  return (
    <div style={{ ...tableRow, gridTemplateColumns: columns }}>{children}</div>
  );
}

function StatusPill({ text }: { text: string }) {
  const lower = text.toLowerCase();
  const green =
    lower.includes("active") ||
    lower.includes("issued") ||
    lower.includes("completed") ||
    lower.includes("filed") ||
    lower.includes("up to date") ||
    lower.includes("submitted");

  return (
    <span
      style={{
        ...statusPill,
        ...(green ? statusPillGreen : {}),
      }}
    >
      {text}
    </span>
  );
}

function Empty({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  return (
    <div style={{ ...emptyState, ...(compact ? emptyStateCompact : {}) }}>
      {text}
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "8px 10px 28px",
  background: "#eef2f5",
  color: "#10233a",
};

const workingFileBar: React.CSSProperties = {
  minHeight: "40px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  gap: "9px",
  border: "1px solid #d8dee7",
  background: "#ffffff",
  fontSize: "10px",
};

const workingFileLink: React.CSSProperties = {
  color: "#2457d6",
  textDecoration: "none",
  fontWeight: 900,
  letterSpacing: "0.06em",
};

const divider: React.CSSProperties = { color: "#94a3b8" };

const workingFileRegistration: React.CSSProperties = {
  marginLeft: "auto",
  color: "#64748b",
  fontSize: "9px",
};

const clientHeader: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "108px",
  padding: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const statusLine: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const activeBadge: React.CSSProperties = {
  padding: "4px 7px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "8px",
  fontWeight: 900,
};

const clientType: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 800,
};

const clientTitle: React.CSSProperties = {
  margin: "7px 0 0",
  fontSize: "24px",
  fontWeight: 900,
};

const tradingName: React.CSSProperties = {
  marginTop: "4px",
  color: "#475569",
  fontSize: "11px",
};

const clientRegistration: React.CSSProperties = {
  marginTop: "6px",
  color: "#64748b",
  fontSize: "10px",
};

const subNav: React.CSSProperties = {
  marginTop: "8px",
  display: "flex",
  flexWrap: "wrap",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const subNavLink: React.CSSProperties = {
  padding: "11px 10px",
  borderRight: "1px solid #e5eaf0",
  color: "#475569",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 900,
};

const subNavLinkActive: React.CSSProperties = {
  background: "#0f1f33",
  color: "#ffffff",
};

const warningBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "9px 10px",
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: "9px",
  fontWeight: 800,
};

const messageBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "9px 10px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "9px",
  fontWeight: 800,
};

const errorBar: React.CSSProperties = {
  padding: "10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: "10px",
  fontWeight: 800,
};

const loadingPanel: React.CSSProperties = {
  padding: "20px",
  border: "1px solid #d8dee7",
  background: "#ffffff",
  color: "#64748b",
  fontSize: "10px",
};

const summaryStrip: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const summaryItem: React.CSSProperties = {
  minHeight: "68px",
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  borderRight: "1px solid #d8dee7",
};

const summaryItemLast: React.CSSProperties = {
  ...summaryItem,
  borderRight: "none",
};

const summaryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.04em",
};

const summaryValue: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "19px",
  fontWeight: 900,
};

const panel: React.CSSProperties = {
  marginTop: "8px",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const panelHeading: React.CSSProperties = {
  minHeight: "52px",
  padding: "9px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  borderBottom: "1px solid #d8dee7",
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 900,
};

const panelSubtitle: React.CSSProperties = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "9px",
  lineHeight: 1.4,
};

const controlGrid: React.CSSProperties = {
  padding: "10px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
};

const controlTile: React.CSSProperties = {
  minHeight: "82px",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  border: "1px solid #d8dee7",
  background: "#f8fafc",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "10px",
};

const controlValue: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
};


const controlTileTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const controlIcon: React.CSSProperties = {
  width: "30px",
  height: "30px",
  display: "grid",
  placeItems: "center",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
};

const rowActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};


const processNote: React.CSSProperties = {
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  borderBottom: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "9px",
  lineHeight: 1.45,
};




const downloadButton: React.CSSProperties = {
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  padding: "7px 10px",
  fontSize: "8px",
  fontWeight: 900,
  cursor: "pointer",
  borderRadius: 0,
};

const matterRow: React.CSSProperties = {
  minHeight: "48px",
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "9px",
};

const miniSectionTitle: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  borderBottom: "1px solid #d8dee7",
  background: "#f7f9fb",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.04em",
};

const replacementCertificateRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.1fr 1.5fr 160px 190px",
  gap: "12px",
  alignItems: "center",
  minHeight: "48px",
  padding: "8px 12px",
  borderBottom: "1px solid #e1e6ed",
  background: "#fffdf5",
  fontSize: "9px",
};

const certificateRow: React.CSSProperties = {
  minHeight: "54px",
  padding: "0 12px",
  display: "grid",
  gridTemplateColumns: "1.5fr 180px 160px 120px",
  gap: "10px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "9px",
};

const certificateIssuedRow: React.CSSProperties = {
  minHeight: "64px",
  padding: "0 12px",
  display: "grid",
  gridTemplateColumns: "1.2fr 1.2fr 170px 140px 1fr",
  gap: "10px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "9px",
};

const certificateNumber: React.CSSProperties = {
  color: "#1d4ed8",
};

const certificateActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  flexWrap: "wrap",
};

const complianceNote: React.CSSProperties = {
  padding: "9px 12px",
  borderBottom: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "9px",
  fontWeight: 700,
};

const documentFace: React.CSSProperties = {
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  borderBottom: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "9px",
};

const formPanel: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #d8dee7",
  background: "#f8fafc",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  marginBottom: "10px",
};

const formFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
};

const formHelp: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  lineHeight: 1.4,
};

const field: React.CSSProperties = {
  display: "block",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.04em",
};

const input: React.CSSProperties = {
  width: "100%",
  height: "34px",
  padding: "0 9px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: "76px",
  padding: "7px 8px",
  resize: "vertical",
};

const secondaryButton: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const saveButton: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 11px",
  border: "1px solid #166534",
  background: "#166534",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const saveButtonDisabled: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};

const tableHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 12px",
  display: "grid",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.04em",
};

const tableRow: React.CSSProperties = {
  minHeight: "50px",
  padding: "0 12px",
  display: "grid",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "9px",
};

const statusPill: React.CSSProperties = {
  width: "fit-content",
  padding: "4px 6px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  fontSize: "8px",
  fontWeight: 900,
};

const statusPillGreen: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
};


const rowActionButton: React.CSSProperties = {
  minWidth: "118px",
  minHeight: "34px",
  padding: "0 12px",
  border: "1px solid #b8c4d1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const textLink: React.CSSProperties = {
  color: "#1d4ed8",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 900,
};

const linkButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  padding: 0,
  color: "#1758d5",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "left",
};

const annualReturnFace: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  borderBottom: "1px solid #d2d9e2",
  background: "#f8fafc",
};

const annualReturnCell: React.CSSProperties = {
  padding: "14px 16px",
  borderRight: "1px solid #d2d9e2",
};

const miniLabel: React.CSSProperties = {
  marginBottom: "5px",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.04em",
};

const cipcHomeNote: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
  padding: "12px 14px",
  borderBottom: "1px solid #d2d9e2",
  background: "#f8fafc",
  color: "#334155",
  fontSize: "9px",
};

const cipcActionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "7px",
  padding: "10px",
  borderBottom: "1px solid #d2d9e2",
};

const cipcActionButton: React.CSSProperties = {
  minHeight: "52px",
  padding: "7px 8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const cipcActionTitle: React.CSSProperties = {
  color: "#0f2239",
  fontSize: "10px",
  fontWeight: 900,
};

const cipcActionDescription: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  lineHeight: 1.25,
  flex: 1,
};

const cipcActionLink: React.CSSProperties = {
  color: "#1758d5",
  fontSize: "9px",
  fontWeight: 900,
};

const changeFormHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
};

const subsectionHeading: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px",
  borderTop: "1px solid #d2d9e2",
  borderBottom: "1px solid #d2d9e2",
  background: "#ffffff",
};

const shareIssueReminder: React.CSSProperties = {
  marginBottom: "3px",
  color: "#92400e",
  fontSize: "8px",
  fontWeight: 900,
};

const disabledText: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "8px",
};

const mutedSmall: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
};

const emptyState: React.CSSProperties = {
  padding: "18px 12px",
  color: "#64748b",
  fontSize: "10px",
};


const quietActionButton: React.CSSProperties = {
  height: "36px",
  padding: "0 14px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryCompactButton: React.CSSProperties = {
  height: "36px",
  padding: "0 15px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
};


const editingRowPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "84px",
  height: "30px",
  padding: "0 10px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "9px",
  fontWeight: 900,
};

const editActionButton: React.CSSProperties = {
  minWidth: "132px",
  height: "36px",
  padding: "0 14px",
  border: "1px solid #10233a",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const manageLinkButton: React.CSSProperties = {
  color: "#1758d5",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 900,
};

const boSummaryStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 220px",
  gap: "18px",
  alignItems: "center",
  padding: "12px",
  borderBottom: "1px solid #d8dee7",
  background: "#f8fafc",
};

const boStructureReview: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1.35fr",
  gap: 0,
  margin: "0 12px 10px",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const boStructureCell: React.CSSProperties = {
  padding: "9px 10px",
  borderRight: "1px solid #d8dee7",
};

const boStructureValue: React.CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 900,
};

const boStructureNote: React.CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "#64748b",
  fontSize: "9px",
  lineHeight: 1.35,
};

const boFilingPanelSimple: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1fr 180px auto",
  gap: "12px",
  alignItems: "end",
  padding: "14px 12px",
  borderTop: "1px solid #d8dee7",
  borderBottom: "1px solid #d8dee7",
  background: "#ffffff",
};


const annualCleanWorkspace: React.CSSProperties = { padding: "0 12px 12px" };
const annualCleanTop: React.CSSProperties = {
  minHeight: "54px",
  display: "grid",
  gridTemplateColumns: "180px 1fr auto",
  gap: "16px",
  alignItems: "center",
  borderBottom: "1px solid #cfd7e1",
};
const annualCleanTitle: React.CSSProperties = { marginLeft: "8px", fontSize: "20px", color: "#10233a" };
const annualSectionBar: React.CSSProperties = {
  height: "30px",
  marginTop: "10px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  border: "1px solid #d8dee7",
  background: "#f4f7fa",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: ".03em",
};
const annualFeeRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.25fr 1fr 1fr 1fr",
  border: "1px solid #d8dee7",
  borderTop: 0,
};
const annualBandCompact: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  border: "1px solid #d8dee7",
  borderTop: 0,
  background: "#ffffff",
};
const annualCleanGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "10px",
  padding: "10px",
  border: "1px solid #d8dee7",
  borderTop: 0,
};
const annualCleanGridFour: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr",
  gap: "10px",
  padding: "10px",
  border: "1px solid #d8dee7",
  borderTop: 0,
};

const annualCompactWorkspace: React.CSSProperties = { padding: "0 12px 14px" };
const annualCompactHeader: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "180px 1fr 180px", gap: "14px", alignItems: "center",
  padding: "12px 0", borderBottom: "1px solid #d8dee7"
};
const annualCompactYear: React.CSSProperties = { fontSize: "18px", color: "#10233a" };
const annualMoneyGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1.25fr repeat(3, minmax(0, 1fr))", border: "1px solid #d8dee7", marginTop: "12px"
};
const annualBandLine: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", border: "1px solid #d8dee7", borderTop: 0, background: "#f8fafc"
};
const annualDetailGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" };
const annualDetailSection: React.CSSProperties = { border: "1px solid #d8dee7", background: "#ffffff" };
const annualSectionTitle: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #d8dee7", background: "#f8fafc", color: "#10233a", fontSize: "9px", fontWeight: 900 };
const annualTwoCol: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "10px" };
const readOnlyField: React.CSSProperties = { minHeight: "36px", border: "1px solid #cbd5e1", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "0 10px" };

const boControlBar: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 220px auto",
  gap: "18px",
  alignItems: "center",
  padding: "14px 12px",
  borderBottom: "1px solid #d8dee7",
  background: "#f8fafc",
};

const boControlTitle: React.CSSProperties = {
  display: "block",
  marginTop: "4px",
  fontSize: "14px",
};

const boActionArea: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const boFilingPanel: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 180px auto",
  gap: "12px",
  alignItems: "end",
  padding: "14px 12px",
  borderTop: "1px solid #d8dee7",
  borderBottom: "1px solid #d8dee7",
  background: "#ffffff",
};


const formSectionTitle: React.CSSProperties = {
  margin: "8px 0 5px",
  color: "#52647a",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.06em",
};

const formSectionTitleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginTop: "8px",
};

const copyAddressLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  color: "#334155",
  fontSize: "9px",
  fontWeight: 800,
  cursor: "pointer",
};

const currencyInputWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px 1fr",
  height: "42px",
  border: "1px solid #94a3b8",
  background: "#ffffff",
};

const currencyPrefix: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: "1px solid #cbd5e1",
  color: "#10233a",
  fontSize: "14px",
  fontWeight: 900,
};

const currencyInput: React.CSSProperties = {
  width: "100%",
  border: 0,
  outline: 0,
  padding: "0 12px",
  color: "#10233a",
  fontSize: "15px",
  fontWeight: 800,
  background: "transparent",
};

const turnoverCaptured: React.CSSProperties = {
  marginTop: "5px",
  color: "#64748b",
  fontSize: "8px",
};

const feeBandMini: React.CSSProperties = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "7px",
  lineHeight: 1.35,
};

const annualReturnWorkspace: React.CSSProperties = {
  padding: "0 12px 14px",
};

const annualReturnHeading: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "20px",
  padding: "16px 0 12px",
  borderBottom: "1px solid #d8dee7",
};

const annualReturnTitle: React.CSSProperties = {
  margin: "3px 0 2px",
  color: "#10233a",
  fontSize: "20px",
  lineHeight: 1.15,
};

const annualReturnWindow: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
};

const annualTurnoverRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.15fr 1fr",
  gap: "16px",
  alignItems: "end",
  padding: "14px 0 10px",
};

const feeBandNote: React.CSSProperties = {
  minHeight: "54px",
  padding: "10px 12px",
  border: "1px solid #d8dee7",
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const feeStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  border: "1px solid #d8dee7",
  marginBottom: "12px",
};

const feeCell: React.CSSProperties = {
  padding: "12px",
  borderRight: "1px solid #d8dee7",
  background: "#ffffff",
};

const feeCellStrong: React.CSSProperties = {
  ...feeCell,
  borderRight: 0,
  background: "#ecfdf3",
};

const feeValue: React.CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "#10233a",
  fontSize: "16px",
};

const annualControlGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.9fr 1.1fr",
  gap: "12px",
  marginBottom: "12px",
};

const annualControlCard: React.CSSProperties = {
  border: "1px solid #d8dee7",
  padding: "12px",
  background: "#ffffff",
  display: "grid",
  gap: "9px",
};

const annualControlLine: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const annualFilingGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1.15fr",
  gap: "12px",
  marginBottom: "12px",
};

const annualActions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  paddingTop: "4px",
};


const arWorkspace: React.CSSProperties = {
  margin: "0 12px 12px",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const arTitleRow: React.CSSProperties = {
  minHeight: "64px",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  borderBottom: "1px solid #d8dee7",
};

const arYearLine: React.CSSProperties = {
  color: "#10233a",
  fontSize: "21px",
  fontWeight: 900,
};

const arWindowLine: React.CSSProperties = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "9px",
};

const arGridHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  borderBottom: "1px solid #c8d2df",
  background: "#eef3f8",
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: ".04em",
};

const arGridHeaderCell: React.CSSProperties = {
  padding: "10px 12px",
  borderRight: "1px solid #c8d2df",
};

const arCurrencyPrefix: React.CSSProperties = {
  height: "100%",
  display: "grid",
  placeItems: "center",
  borderRight: "1px solid #cbd5e1",
  color: "#10233a",
  fontSize: "16px",
  fontWeight: 900,
};

const arInputHelpRow: React.CSSProperties = {
  marginTop: "5px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  color: "#64748b",
  fontSize: "8px",
};

const arClearTurnover: React.CSSProperties = {
  padding: 0,
  border: 0,
  background: "transparent",
  color: "#1758d5",
  fontSize: "8px",
  fontWeight: 900,
  cursor: "pointer",
};

const arInputHelp: React.CSSProperties = {
  marginTop: "5px",
  color: "#64748b",
  fontSize: "8px",
};

const arStepNo: React.CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: "24px",
  height: "24px",
  marginRight: "8px",
  border: "1px solid #b8c5d5",
  background: "#ffffff",
  color: "#1758d5",
  fontSize: "9px",
  fontWeight: 900,
};

const arThreePanel: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
};

const arColumn: React.CSSProperties = {
  minWidth: 0,
  padding: "11px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  borderRight: "1px solid #d8dee7",
};

const arMoneyInput: React.CSSProperties = {
  height: "46px",
  display: "grid",
  gridTemplateColumns: "42px 1fr",
  alignItems: "center",
  border: "1px solid #b9c5d3",
  background: "#ffffff",
};

const arMoneyField: React.CSSProperties = {
  width: "100%",
  height: "44px",
  border: 0,
  outline: "none",
  padding: "0 10px",
  color: "#10233a",
  fontSize: "16px",
  fontWeight: 900,
};

const arFeeTable: React.CSSProperties = {
  borderTop: "1px solid #d8dee7",
};

const arFeeLine: React.CSSProperties = {
  minHeight: "40px",
  padding: "0 8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  borderBottom: "1px solid #e2e8f0",
  color: "#52647a",
  fontSize: "10px",
};

const arFeeTotal: React.CSSProperties = {
  background: "#ecfdf3",
};

const arBandLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  paddingTop: "4px",
  color: "#64748b",
  fontSize: "9px",
};

const arReadOnlyLine: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
};

const arInlineAction: React.CSSProperties = {
  color: "#1758d5",
  fontSize: "9px",
  fontWeight: 900,
  textDecoration: "none",
};

const arDatePair: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
};

const arFooter: React.CSSProperties = {
  minHeight: "52px",
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  borderTop: "1px solid #d8dee7",
  background: "#fbfcfd",
};

const arFootNote: React.CSSProperties = {
  maxWidth: "700px",
  color: "#64748b",
  fontSize: "8px",
  lineHeight: 1.4,
};

const arHistoryHeading: React.CSSProperties = {
  minHeight: "46px",
  padding: "9px 12px",
  display: "flex",
  alignItems: "baseline",
  gap: "10px",
  borderTop: "1px solid #d8dee7",
  color: "#10233a",
};


const tileArrow: React.CSSProperties = {
  marginTop: "6px",
  color: "#2563eb",
  fontSize: "14px",
  fontWeight: 900,
};
const emptyStateCompact: React.CSSProperties = {
  padding: "10px 12px",
};
