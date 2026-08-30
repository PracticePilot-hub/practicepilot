import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseSecretKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    secretarialView?: string;
    uifEmployee?: string;
    registration?: string;
  }>;
};

type ServiceRow = {
  id: string;
  frequency: string | null;
  is_active: boolean | null;
  start_date: string | null;
  crm_services:
    | { service_name: string; service_group: string | null }
    | Array<{ service_name: string; service_group: string | null }>
    | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function valueOrDash(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStatus(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatAddress(address: any) {
  if (!address) return "—";
  return [
    address.line_1,
    address.line_2,
    address.city,
    address.province,
    address.postal_code,
    address.country,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ") || "—";
}

export default async function ClientWorkingFilePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { tab, secretarialView, uifEmployee, registration } = await searchParams;

  const allowedTabs = [
    "overview",
    "profile",
    "services",
    "tasks",
    "people",
    "registrations",
    "secretarial",
    "documents",
    "activity",
  ] as const;

  const activeTab = allowedTabs.includes(
    (tab || "overview") as (typeof allowedTabs)[number]
  )
    ? (tab || "overview")
    : "overview";

  const secretarialViews = [
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

  const activeSecretarialView = secretarialViews.includes(
    (secretarialView || "overview") as (typeof secretarialViews)[number]
  )
    ? (secretarialView || "overview")
    : "overview";

  const activeRegistration = registration === "uif" ? "uif" : "hub";

  const [
    clientResult,
    contactsResult,
    addressesResult,
    servicesResult,
    tasksResult,
    directorsResult,
    shareholdersResult,
    mattersResult,
    certificatesResult,
    shareClassesResult,
    transactionsResult,
    statutoryProfileResult,
    uifRegistrationResult,
    uifEmployeesResult,
  ] = await Promise.all([
    supabase.from("crm_clients").select("*").eq("id", id).maybeSingle(),

    supabase
      .from("crm_client_contacts")
      .select(
        "id, contact_name, contact_position, email, mobile, phone, is_primary"
      )
      .eq("client_id", id)
      .order("is_primary", { ascending: false }),

    supabase
      .from("crm_client_addresses")
      .select(
        "id, address_type, line_1, line_2, city, province, postal_code, country"
      )
      .eq("client_id", id)
      .order("address_type"),

    supabase
      .from("crm_client_services")
      .select(
        `
          id,
          frequency,
          is_active,
          start_date,
          crm_services (
            service_name,
            service_group
          )
        `
      )
      .eq("client_id", id)
      .order("created_at"),

    supabase
      .from("crm_work_items")
      .select(
        "id, title, description, work_type, status, priority, assigned_user_id, due_date, start_at, end_at, is_all_day, is_personal, waiting_on, waiting_since, workflow_type, workflow_stage, service_code, source_module, completed_at, created_at"
      )
      .eq("client_id", id)
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("start_at", { ascending: true, nullsFirst: false })
      .limit(30),

    supabase
      .from("crm_client_directors")
      .select(
        "id, director_name, id_passport_number, email, phone, appointment_date, cessation_date, is_active, physical_address_line_1, physical_address_line_2, physical_address_city, physical_address_province, physical_address_postal_code, physical_address_country, postal_address_line_1, postal_address_line_2, postal_address_city, postal_address_province, postal_address_postal_code, postal_address_country"
      )
      .eq("client_id", id)
      .order("director_name"),

    supabase
      .from("secretarial_shareholders")
      .select(
        "id, full_legal_name, id_registration_number, holder_type, email, phone, is_active"
      )
      .eq("client_id", id)
      .eq("is_active", true)
      .order("full_legal_name"),

    supabase
      .from("secretarial_share_matters")
      .select(
        `
          id,
          matter_id,
          certificate_number,
          matter_status,
          current_step,
          number_of_shares,
          issue_date,
          shareholder_id,
          share_class_id,
          secretarial_shareholders (
            full_legal_name
          ),
          secretarial_share_classes (
            class_name,
            series_designation
          )
        `
      )
      .eq("client_id", id)
      .neq("matter_status", "cancelled")
      .order("created_at", { ascending: false }),

    supabase
      .from("secretarial_share_certificates")
      .select(
        `
          id,
          certificate_number,
          issue_date,
          number_of_shares,
          certificate_status,
          shareholder_id,
          share_class_id,
          secretarial_shareholders (
            full_legal_name
          ),
          secretarial_share_classes (
            class_name,
            series_designation
          )
        `
      )
      .eq("client_id", id)
      .order("issue_date", { ascending: false }),

    supabase
      .from("secretarial_share_classes")
      .select(
        "id, class_name, class_code, series_designation, authorised_shares, issued_shares, rights_and_restrictions, is_active"
      )
      .eq("client_id", id)
      .eq("is_active", true)
      .order("class_name"),

    supabase
      .from("secretarial_share_transactions")
      .select(
        `
          id,
          matter_id,
          transaction_type,
          transaction_date,
          number_of_shares,
          consideration_per_share,
          total_consideration,
          notes,
          secretarial_shareholders (
            full_legal_name
          ),
          secretarial_share_classes (
            class_name
          )
        `
      )
      .eq("client_id", id)
      .order("transaction_date", { ascending: false }),

    supabase
      .from("crm_client_statutory_profiles")
      .select("id, nature_of_business, magisterial_district, municipality")
      .eq("client_id", id)
      .maybeSingle(),

    supabase
      .from("crm_uif_registrations")
      .select(
        "id, registration_status, first_contributor_date, number_of_contributors, language_preference, employee_information_method, ui19_declaration_month, submission_date, registration_effective_date, notes, ui8_completed, ui19_or_employee_info_prepared, supporting_documents_attached, signature_obtained, submitted_to_uif, confirmation_received"
      )
      .eq("client_id", id)
      .maybeSingle(),

    supabase
      .from("crm_uif_employees")
      .select(
        "id, surname, initials, id_passport_number, gross_monthly_remuneration, total_hours_worked, commencement_date, termination_date, termination_reason_code, is_contributor, non_contributor_reason_code, is_active, notes"
      )
      .eq("client_id", id)
      .order("surname"),
  ]);

  const client = clientResult.data;

  if (!client) notFound();

  const responsibilityIds = [
    client.client_lead_user_id,
    client.manager_user_id,
    client.partner_user_id,
  ].filter(Boolean) as string[];

  const responsibilityUsersResult = responsibilityIds.length
    ? await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", responsibilityIds)
    : { data: [], error: null };

  const responsibilityUsers = responsibilityUsersResult.data || [];
  const responsibilityName = (userId: string | null | undefined) => {
    if (!userId) return "—";
    const user = responsibilityUsers.find((row: any) => row.id === userId);
    return user?.full_name || user?.email || "Assigned";
  };

  const contacts = contactsResult.data || [];
  const addresses = addressesResult.data || [];
  const services = (servicesResult.data || []) as ServiceRow[];
  const tasks = tasksResult.data || [];
  const directors = directorsResult.data || [];
  const shareholders = shareholdersResult.data || [];
  const matters = mattersResult.data || [];
  const certificates = certificatesResult.data || [];
  const shareClasses = shareClassesResult.data || [];
  const transactions = transactionsResult.data || [];
  const statutoryProfile = statutoryProfileResult.data;
  const uifRegistration = uifRegistrationResult.data;
  const uifEmployees = uifEmployeesResult.data || [];
  const editingUifEmployee =
    uifEmployees.find((employee: any) => employee.id === uifEmployee) || null;

  const uifInfoComplete = Boolean(
    statutoryProfile?.nature_of_business &&
      statutoryProfile?.magisterial_district &&
      statutoryProfile?.municipality &&
      uifRegistration?.first_contributor_date &&
      uifRegistration?.number_of_contributors != null &&
      uifRegistration?.language_preference
  );

  const uifEmployeesComplete = uifEmployees.length > 0;

  const uifDocumentsComplete = Boolean(
    uifRegistration?.ui8_completed &&
      uifRegistration?.ui19_or_employee_info_prepared
  );

  const uifSubmissionComplete = Boolean(
    uifRegistration?.signature_obtained &&
      uifRegistration?.submitted_to_uif
  );

  const uifRegistered = Boolean(
    client.uif_registration_number || uifRegistration?.confirmation_received
  );

  const uifNextAction = uifRegistered
    ? "Registration complete"
    : !uifInfoComplete
      ? "Complete registration information"
      : !uifEmployeesComplete
        ? "Capture employees for UI-19"
        : !uifDocumentsComplete
          ? "Prepare UI-8 and UI-19"
          : !uifSubmissionComplete
            ? "Obtain signature and submit to UIF"
            : "Capture UIF registration confirmation";

  const activeServices = services.filter((service) => service.is_active !== false);

  const activeDirectors = directors.filter(
    (director) => director.is_active !== false
  );

  const primaryContact =
    contacts.find((contact) => contact.is_primary) || contacts[0] || null;

  const todayKey = localDateKey();
  const workItems = tasks as any[];

  const openWorkItems = workItems.filter(
    (item) => !["completed", "cancelled"].includes(String(item.status || "").toLowerCase())
  );

  function complianceWorkStatus(
    serviceCodes: string[],
    fallbackLabel: string
  ) {
    const matching = openWorkItems
      .filter((item) =>
        serviceCodes.includes(String(item.service_code || ""))
      )
      .map((item) => {
        const dateKey = item.due_date
          ? String(item.due_date).slice(0, 10)
          : item.start_at
            ? localDateKey(new Date(item.start_at))
            : null;

        return { item, dateKey };
      })
      .sort((a, b) => {
        if (a.dateKey && b.dateKey) return a.dateKey.localeCompare(b.dateKey);
        if (a.dateKey) return -1;
        if (b.dateKey) return 1;
        return 0;
      });

    if (matching.length === 0) {
      return {
        note: "Up to date",
        tone: "green" as const,
      };
    }

    const next = matching[0];
    const title = String(next.item.title || fallbackLabel);

    if (!next.dateKey) {
      return {
        note: `${title} outstanding`,
        tone: "amber" as const,
      };
    }

    if (next.dateKey < todayKey) {
      const today = new Date(`${todayKey}T00:00:00`);
      const due = new Date(`${next.dateKey}T00:00:00`);
      const days = Math.max(
        1,
        Math.round((today.getTime() - due.getTime()) / 86_400_000)
      );

      return {
        note: `${title} overdue by ${days} ${days === 1 ? "day" : "days"}`,
        tone: "red" as const,
      };
    }

    if (next.dateKey === todayKey) {
      return {
        note: `${title} due today`,
        tone: "amber" as const,
      };
    }

    return {
      note: `${title} due ${formatDate(next.dateKey)}`,
      tone: "amber" as const,
    };
  }

  const clientTodayItems = openWorkItems
    .filter((item) => {
      const scheduledToday =
        item.start_at && localDateKey(new Date(item.start_at)) === todayKey;
      return item.due_date === todayKey || scheduledToday;
    })
    .slice(0, 6);

  const waitingOnClientItems = openWorkItems
    .filter((item) => {
      const waitingText = String(item.waiting_on || "").toLowerCase();
      return (
        String(item.status || "").toLowerCase() === "waiting" ||
        waitingText.includes("client")
      );
    })
    .slice(0, 5);


  const nextWorkItem =
    [...openWorkItems].sort((a, b) => {
      const aKey = a.start_at || a.due_date || "9999-12-31";
      const bKey = b.start_at || b.due_date || "9999-12-31";
      return String(aKey).localeCompare(String(bKey));
    })[0] || null;

  const clientNextTitle =
    !uifRegistered && uifNextAction !== "Registration complete"
      ? `UIF Registration — ${uifNextAction}`
      : nextWorkItem?.title || "No urgent client action";

  const clientNextMeta =
    !uifRegistered && uifNextAction !== "Registration complete"
      ? "Continue the UIF registration workflow."
      : nextWorkItem
        ? [
            nextWorkItem.service_code || nextWorkItem.work_type,
            nextWorkItem.due_date ? `Due ${formatDate(nextWorkItem.due_date)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "This client has no open work needing immediate attention.";

  const clientAttentionCount =
    clientTodayItems.length + waitingOnClientItems.length;

  const uifProgressSteps = [
    uifInfoComplete,
    uifEmployeesComplete,
    uifDocumentsComplete,
    uifSubmissionComplete,
    uifRegistered,
  ];

  const uifProgressPercent = Math.round(
    (uifProgressSteps.filter(Boolean).length / uifProgressSteps.length) * 100
  );

  const keyPeople = [
    primaryContact
      ? {
          name: primaryContact.contact_name,
          role: primaryContact.contact_position || "Primary contact",
          email: primaryContact.email,
          phone: primaryContact.mobile || primaryContact.phone,
        }
      : null,
    ...activeDirectors.slice(0, 3).map((director: any) => ({
      name: director.director_name,
      role: "Director / office bearer",
      email: director.email,
      phone: director.phone,
    })),
  ].filter(Boolean) as Array<{
    name: string;
    role: string;
    email?: string | null;
    phone?: string | null;
  }>;

  const physicalAddress =
    addresses.find((address) =>
      ["physical", "street", "business", "registered"].includes(
        String(address.address_type || "").toLowerCase()
      )
    ) || addresses[0] || null;

  const postalAddress =
    addresses.find((address) =>
      ["postal", "post"].includes(String(address.address_type || "").toLowerCase())
    ) || null;

  const registrationOrId =
    client.registration_number || client.id_passport_number || "—";

  const issuedHoldingsMap = new Map<
    string,
    {
      shareholderId: string;
      shareholderName: string;
      className: string;
      shares: number;
    }
  >();

  for (const certificate of certificates as any[]) {
    if (
      !["issued", "draft"].includes(
        String(certificate.certificate_status || "").toLowerCase()
      )
    ) {
      continue;
    }

    const holder = relationOne(certificate.secretarial_shareholders) as
      | { full_legal_name?: string }
      | null;

    const shareClass = relationOne(certificate.secretarial_share_classes) as
      | { class_name?: string; series_designation?: string | null }
      | null;

    const shareholderId = String(certificate.shareholder_id || "");
    const className = shareClass?.class_name || "Shares";
    const key = `${shareholderId}|${className}`;

    const existing = issuedHoldingsMap.get(key);
    const shares = Number(certificate.number_of_shares || 0);

    issuedHoldingsMap.set(key, {
      shareholderId,
      shareholderName: holder?.full_legal_name || "Unknown shareholder",
      className,
      shares: (existing?.shares || 0) + shares,
    });
  }

  const issuedHoldings = Array.from(issuedHoldingsMap.values());
  const totalIssuedShares = issuedHoldings.reduce(
    (sum, holding) => sum + holding.shares,
    0
  );

  const pendingMatters = (matters as any[]).filter((matter) =>
    ["draft", "in_progress", "awaiting_review", "returned_for_correction", "approved"].includes(
      String(matter.matter_status || "")
    )
  );

  const pendingShares = pendingMatters.reduce(
    (sum, matter) => sum + Number(matter.number_of_shares || 0),
    0
  );

  const sectionErrors = {
    overview: [
      tasksResult.error,
      contactsResult.error,
      directorsResult.error,
    ].filter(Boolean),
    profile: [
      contactsResult.error,
      addressesResult.error,
      servicesResult.error,
      directorsResult.error,
      shareholdersResult.error,
      responsibilityUsersResult.error,
    ].filter(Boolean),
    services: [servicesResult.error].filter(Boolean),
    tasks: [tasksResult.error].filter(Boolean),
    people: [contactsResult.error, directorsResult.error].filter(Boolean),
    registrations: [
      statutoryProfileResult.error,
      uifRegistrationResult.error,
      uifEmployeesResult.error,
    ].filter(Boolean),
    secretarial: [
      directorsResult.error,
      shareholdersResult.error,
      mattersResult.error,
      certificatesResult.error,
      shareClassesResult.error,
      transactionsResult.error,
    ].filter(Boolean),
    documents: [],
    activity: [tasksResult.error, mattersResult.error].filter(Boolean),
  } as const;

  const activeSectionErrors =
    sectionErrors[activeTab as keyof typeof sectionErrors] || [];

  return (
    <div style={page}>
      <div style={workingFileBar}>
        <span style={workingFileLabel}>CLIENT WORKING FILE</span>
        <span style={divider}>|</span>
        <Link href="/crm/clients" style={crumbLink}>
          Clients
        </Link>
        <span style={divider}>|</span>
        <strong>{client.client_name}</strong>
        <span style={workingFileMeta}>{registrationOrId}</span>
      </div>

      <section style={hero}>
        <div style={{ minWidth: 0 }}>
          <div style={statusLine}>
            <span style={statusBadge}>{valueOrDash(client.status)}</span>
            <span style={clientCode}>
              {client.client_code ? `Client code: ${client.client_code}` : ""}
            </span>
          </div>

          <h1 style={title}>{client.client_name}</h1>

          {client.trading_name ? (
            <div style={tradingName}>Trading as {client.trading_name}</div>
          ) : null}

          <div style={heroMeta}>
            <span>{valueOrDash(client.entity_type)}</span>
            <span>•</span>
            <span>{registrationOrId}</span>
            {client.year_end ? (
              <>
                <span>•</span>
                <span>Year-end: {client.year_end}</span>
              </>
            ) : null}
          </div>
        </div>

        <div style={heroActions}>
          <Link
            href={`/crm/edit-client?id=${client.id}`}
            style={secondaryButton}
          >
            Edit Client Details
          </Link>

          <Link
            href={`/crm/client/${client.id}/print`}
            style={primaryButton}
            target="_blank"
          >
            Client PDF / Sign-off
          </Link>
        </div>
      </section>

      <nav style={sectionNav}>
        {[
          ["overview", "Overview"],
          ["profile", "Client Profile"],
          ["services", "Services"],
          ["tasks", "Tasks"],
          ["people", "People"],
          ["registrations", "Registrations"],
          ["secretarial", "Secretarial"],
          ["documents", "Documents"],
          ["activity", "Activity"],
        ].map(([key, label]) => {
          const active = activeTab === key;

          return (
            <Link
              key={key}
              href={`/crm/client/${client.id}?tab=${key}`}
              style={{
                ...sectionNavLink,
                ...(active ? activeSectionNavLink : {}),
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {activeSectionErrors.length > 0 ? (
        <div style={sectionWarningBar}>
          <strong style={sectionWarningTitle}>
            This section could not load completely.
          </strong>
          <span style={sectionWarningText}>
            Some related information could not be retrieved. The client master
            record is safe and the rest of the working file remains available.
          </span>
        </div>
      ) : null}

            {activeTab === "overview" ? (
<section id="overview" style={clientHomeWrap}>
  <section style={clientStatusStrip}>
    {[
      (() => {
        const health = client.tax_number
          ? complianceWorkStatus(["Income Tax", "Provisional Tax"], "Tax item")
          : { note: "Registration not started", tone: "neutral" as const };

        return {
          label: "Tax",
          value: client.tax_number ? "Registered" : "Not registered",
          note: health.note,
          tone: health.tone,
        };
      })(),
      (() => {
        const health = client.paye_number
          ? complianceWorkStatus(["EMP201", "EMP501", "Payroll"], "PAYE item")
          : { note: "Registration not started", tone: "neutral" as const };

        return {
          label: "PAYE",
          value: client.paye_number ? "Registered" : "Not registered",
          note: health.note,
          tone: health.tone,
        };
      })(),
      (() => {
        const health = client.vat_number
          ? complianceWorkStatus(["VAT201"], "VAT201")
          : { note: "Registration not started", tone: "neutral" as const };

        return {
          label: "VAT",
          value: client.vat_number ? "Registered" : "Not registered",
          note: health.note,
          tone: health.tone,
        };
      })(),
      (() => {
        const health = uifRegistered
          ? complianceWorkStatus(["UIF"], "UIF item")
          : uifRegistration
            ? { note: uifNextAction, tone: "blue" as const }
            : { note: "Registration not started", tone: "neutral" as const };

        return {
          label: "UIF",
          value: uifRegistered
            ? "Registered"
            : uifRegistration
              ? "In progress"
              : "Not registered",
          note: health.note,
          tone: health.tone,
        };
      })(),
      (() => {
        const health = client.wcc_reference_number
          ? complianceWorkStatus(["Workmans Compensation"], "COIDA item")
          : { note: "Registration not started", tone: "neutral" as const };

        return {
          label: "COIDA",
          value: client.wcc_reference_number ? "Registered" : "Not registered",
          note: health.note,
          tone: health.tone,
        };
      })(),
    ].map((item) => (
      <div key={item.label} style={clientStatusCell}>
        <div
          style={{
            ...clientStatusIcon,
            ...(item.tone === "green"
              ? clientStatusGreen
              : item.tone === "red"
                ? clientStatusRed
                : item.tone === "amber"
                  ? clientStatusAmber
                  : item.tone === "blue"
                    ? clientStatusBlue
                    : item.tone === "neutral"
                      ? clientStatusNeutral
                      : clientStatusNavy),
          }}
        >
          {item.tone === "green"
            ? "✓"
            : item.tone === "red"
              ? "!"
              : item.tone === "amber"
                ? "!"
                : item.tone === "neutral"
                  ? "—"
                  : "•"}
        </div>
        <div>
          <div style={clientStatusLabel}>{item.label}</div>
          <div style={clientStatusValue}>{item.value}</div>
          <div style={clientStatusNote}>{item.note}</div>
        </div>
      </div>
    ))}
  </section>

  <div style={clientHomeGrid}>
    <section style={clientHomePanel}>
      <div style={clientHomePanelHeader}>
        <div>
          <h3 style={clientHomePanelTitle}>Today for this client</h3>
          <p style={clientHomePanelSubtitle}>
            Work due or scheduled for this client today.
          </p>
        </div>
        <Link href="/crm/tasks" style={clientHomeTextLink}>
          View all →
        </Link>
      </div>

      <div style={clientTodayNextAction}>
        <div>
          <div style={clientTodayNextLabel}>Next action</div>
          <strong style={clientTodayNextTitle}>{clientNextTitle}</strong>
          <div style={clientTodayNextMeta}>{clientNextMeta}</div>
        </div>

        {!uifRegistered && uifNextAction !== "Registration complete" ? (
          <Link
            href={`/crm/client/${client.id}?tab=registrations&registration=uif`}
            style={clientTodayNextButton}
          >
            Continue →
          </Link>
        ) : nextWorkItem ? (
          <Link href="/crm/tasks" style={clientTodayNextButton}>
            Open →
          </Link>
        ) : null}
      </div>

      {clientTodayItems.length ? (
        <div>
          {clientTodayItems.map((item: any) => (
            <div key={item.id} style={clientWorkRow}>
              <div>
                <strong style={clientWorkTitle}>{item.title}</strong>
                <div style={clientWorkMeta}>
                  {formatStatus(item.service_code || item.work_type)}
                </div>
              </div>

              <span style={clientWorkStatus}>
                {formatStatus(item.status || "not_started")}
              </span>

              <div style={clientWorkDue}>
                {item.start_at
                  ? `${formatTime(item.start_at)}${
                      item.end_at ? ` – ${formatTime(item.end_at)}` : ""
                    }`
                  : item.due_date === todayKey
                    ? "Today"
                    : formatDate(item.due_date)}
              </div>

              <Link href="/crm/tasks" style={clientHomeTextLink}>
                Open →
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div style={clientHomeEmpty}>
          Nothing is due or scheduled for this client today.
        </div>
      )}
    </section>

    <div style={clientHomeRightStack}>
      <section style={clientHomePanel}>
        <div style={clientHomePanelHeader}>
          <div>
            <h3 style={clientHomePanelTitle}>Waiting on client</h3>
            <p style={clientHomePanelSubtitle}>
              Work blocked until the client responds.
            </p>
          </div>
          <Link href="/crm/tasks" style={clientHomeTextLink}>
            View all →
          </Link>
        </div>

        {waitingOnClientItems.length ? (
          waitingOnClientItems.map((item: any) => (
            <div key={item.id} style={clientWaitingRow}>
              <div>
                <strong style={clientWorkTitle}>{item.title}</strong>
                <div style={clientWorkMeta}>
                  {item.waiting_on
                    ? `Waiting on ${item.waiting_on}`
                    : formatStatus(item.service_code || item.work_type)}
                </div>
              </div>
              <span style={clientWaitingBadge}>Waiting</span>
            </div>
          ))
        ) : (
          <div style={clientHomeEmpty}>Nothing is waiting on the client.</div>
        )}
      </section>


    </div>

    <section style={clientHomePanel}>
      <div style={clientHomePanelHeader}>
        <div>
          <h3 style={clientHomePanelTitle}>Key people</h3>
          <p style={clientHomePanelSubtitle}>
            Client contacts and office bearers you are most likely to need.
          </p>
        </div>
        <Link
          href={`/crm/client/${client.id}?tab=people`}
          style={clientHomeTextLink}
        >
          Manage →
        </Link>
      </div>

      {keyPeople.length ? (
        keyPeople.map((person) => (
          <div key={`${person.name}-${person.role}`} style={clientPersonRow}>
            <div style={clientPersonAvatar}>
              {String(person.name || "?")
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={clientWorkTitle}>{person.name}</strong>
              <div style={clientWorkMeta}>{person.role}</div>
              {person.email ? (
                <div style={clientPersonContact}>{person.email}</div>
              ) : null}
              {person.phone ? (
                <div style={clientPersonContact}>{person.phone}</div>
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <div style={clientHomeEmpty}>No key people captured yet.</div>
      )}
    </section>
  </div>

</section>
) : null}

            {activeTab === "profile" ? (
              <section id="profile" style={profilePage}>
                <div style={profileHeader}>
                  <div>
                    <div style={clientHomeEyebrow}>Client Profile</div>
                    <h2 style={profileTitle}>Client master information</h2>
                    <p style={profileSubtitle}>
                      The permanent facts PracticePilot uses across CRM, tax,
                      compliance, secretarial and recurring work.
                    </p>
                  </div>

                  <Link
                    href={`/crm/edit-client?id=${client.id}`}
                    style={secondaryButton}
                  >
                    Edit Client Details
                  </Link>
                </div>

                <div style={profileGrid}>
                  <section style={profileSection}>
                    <div style={profileSectionHeader}>Entity details</div>
                    <div style={profileFieldsGrid}>
                      <ProfileField label="Legal / registered name" value={client.client_name} />
                      <ProfileField label="Trading name" value={client.trading_name} />
                      <ProfileField label="Entity type" value={client.entity_type} />
                      <ProfileField label="Registration / ID number" value={registrationOrId} />
                      <ProfileField label="Registration date" value={formatDate(client.registration_date)} />
                      <ProfileField label="Financial year-end" value={client.year_end} />
                      <ProfileField label="Internal client code" value={client.client_code} />
                      <ProfileField label="Client status" value={client.status} />
                    </div>
                  </section>

                  <section style={profileSection}>
                    <div style={profileSectionHeader}>Primary contact</div>
                    <div style={profileFieldsGrid}>
                      <ProfileField label="Contact person" value={primaryContact?.contact_name} />
                      <ProfileField label="Position" value={primaryContact?.contact_position} />
                      <ProfileField label="Email" value={primaryContact?.email} />
                      <ProfileField
                        label="Telephone / cellphone"
                        value={primaryContact?.mobile || primaryContact?.phone}
                      />
                    </div>
                  </section>

                  <section style={profileSection}>
                    <div style={profileSectionHeader}>Addresses</div>
                    <div style={profileAddressGrid}>
                      <div style={profileAddressBlock}>
                        <div style={profileLabel}>Physical address</div>
                        <div style={profileAddressValue}>{formatAddress(physicalAddress)}</div>
                      </div>
                      <div style={profileAddressBlock}>
                        <div style={profileLabel}>Postal address</div>
                        <div style={profileAddressValue}>{formatAddress(postalAddress)}</div>
                      </div>
                    </div>
                  </section>

                  <section style={profileSection}>
                    <div style={profileSectionHeader}>Tax & statutory registrations</div>
                    <div style={profileFieldsGrid}>
                      <ProfileField label="Income Tax number" value={client.tax_number} />
                      <ProfileField label="VAT number" value={client.vat_number} />
                      <ProfileField label="PAYE number" value={client.paye_number} />
                      <ProfileField label="UIF number" value={client.uif_registration_number} />
                      <ProfileField label="WCC / COIDA reference" value={client.wcc_reference_number} />
                      <ProfileField label="Customs number" value={client.customs_number} />
                      <ProfileField
                        label="SDL"
                        value={client.sdl_registered ? "Registered" : "Not recorded as registered"}
                      />
                    </div>
                  </section>

                  <section style={profileSection}>
                    <div style={profileSectionHeader}>Practice responsibility</div>
                    <div style={profileFieldsGrid}>
                      <ProfileField label="Client lead" value={responsibilityName(client.client_lead_user_id)} />
                      <ProfileField label="Manager" value={responsibilityName(client.manager_user_id)} />
                      <ProfileField label="Partner" value={responsibilityName(client.partner_user_id)} />
                    </div>
                  </section>

                  <section style={profileSection}>
                    <div style={profileSectionHeader}>Active services</div>
                    {activeServices.length ? (
                      <div style={profileServicesGrid}>
                        {activeServices.map((service) => {
                          const master = relationOne(service.crm_services);
                          return (
                            <div key={service.id} style={profileServiceRow}>
                              <div>
                                <strong style={profileServiceName}>
                                  {master?.service_name || "Service"}
                                </strong>
                                <div style={profileServiceMeta}>
                                  {master?.service_group || "General"}
                                </div>
                              </div>
                              <div style={profileServiceRight}>
                                <span>{service.frequency || "—"}</span>
                                <span>
                                  {service.start_date
                                    ? `From ${formatDate(service.start_date)}`
                                    : "No first period"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={profileEmpty}>No active services assigned.</div>
                    )}
                  </section>

                  <section style={profileSection}>
                    <div style={profileSectionHeader}>People & office bearers</div>
                    <div style={profilePeopleSummary}>
                      <div style={profilePeopleSummaryCell}>
                        <strong style={profilePeopleSummaryNumber}>{contacts.length}</strong>
                        <span style={profilePeopleSummaryLabel}>
                          Contact{contacts.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div style={profilePeopleSummaryCell}>
                        <strong style={profilePeopleSummaryNumber}>{activeDirectors.length}</strong>
                        <span style={profilePeopleSummaryLabel}>
                          Director / office bearer records
                        </span>
                      </div>
                      <div style={profilePeopleSummaryCell}>
                        <strong style={profilePeopleSummaryNumber}>{shareholders.length}</strong>
                        <span style={profilePeopleSummaryLabel}>
                          Shareholder{shareholders.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <div style={profileSectionFooter}>
                      <Link
                        href={`/crm/client/${client.id}?tab=people`}
                        style={clientHomeTextLink}
                      >
                        Open people →
                      </Link>
                    </div>
                  </section>
                </div>
              </section>
            ) : null}

            {activeTab === "services" ? (
<section id="services" style={panel}>
        <PanelHeader
          number="02"
          title="Services"
          subtitle="What the practice is responsible for on this client."
        />

        {activeServices.length ? (
          <div style={list}>
            {activeServices.map((service) => {
              const serviceInfo = relationOne(service.crm_services);

              return (
                <div key={service.id} style={serviceRow}>
                  <div style={serviceMain}>
                    <strong style={rowTitle}>
                      {serviceInfo?.service_name || "Unnamed service"}
                    </strong>
                    <span style={rowMeta}>
                      {serviceInfo?.service_group || "General"}
                    </span>
                  </div>

                  <div style={rightInfo}>
                    <span>{valueOrDash(service.frequency)}</span>
                    <span style={smallMuted}>
                      Start: {formatDate(service.start_date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="No active services have been assigned to this client." />
        )}
      </section>
      ) : null}

            {activeTab === "tasks" ? (
<section id="tasks" style={panel}>
        <PanelHeader
          number="03"
          title="Tasks"
          subtitle="Open work currently moving through the PracticePilot Flight Map."
          action={
            <Link href="/crm/tasks" style={textLink}>
              Open task centre
            </Link>
          }
        />

        {tasks.length ? (
          <div style={list}>
            {tasks.map((task: any) => (
              <div key={task.id} style={taskRow}>
                <div style={taskMain}>
                  <strong style={rowTitle}>{task.title}</strong>
                  <span style={rowMeta}>
                    {formatStatus(task.service_code || task.work_type || "General")}
                  </span>
                </div>

                <div style={taskDue}>
                  <span style={statusPill}>
                    {formatStatus(task.status)}
                  </span>
                  <span style={smallMuted}>
                    {task.start_at
                      ? `Scheduled: ${formatDate(localDateKey(new Date(task.start_at)))} ${formatTime(task.start_at)}`
                      : `Due: ${formatDate(task.due_date)}`}
                  </span>
                </div>

                <Link href="/crm/tasks" style={textLink}>
                  Open
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No open tasks for this client." />
        )}
      </section>
      ) : null}

            {activeTab === "people" ? (
<section id="people" style={panel}>
        <PanelHeader
          number="04"
          title="People"
          subtitle="Contacts and statutory office bearers linked to the client."
        />

        <div style={twoColumn}>
          <div style={detailSection}>
            <h3 style={miniHeading}>Contacts</h3>

            {contacts.length ? (
              contacts.map((contact) => (
                <div key={contact.id} style={personRow}>
                  <div>
                    <strong style={rowTitle}>
                      {valueOrDash(contact.contact_name)}
                    </strong>
                    <div style={rowMeta}>
                      {valueOrDash(contact.contact_position)}
                    </div>
                  </div>

                  <div style={personContact}>
                    <span>{valueOrDash(contact.email)}</span>
                    <span style={smallMuted}>
                      {valueOrDash(contact.mobile || contact.phone)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No contacts captured." />
            )}
          </div>

          <div style={detailSection}>
            <h3 style={miniHeading}>Directors / office bearers</h3>

            {directors.length ? (
              directors.map((director) => (
                <div key={director.id} style={personRow}>
                  <div>
                    <strong style={rowTitle}>{director.director_name}</strong>
                    <div style={rowMeta}>
                      {director.is_active === false ? "Inactive" : "Active"}
                    </div>
                  </div>

                  <div style={personContact}>
                    <span>{valueOrDash(director.id_passport_number)}</span>
                    <span style={smallMuted}>
                      Appointed: {formatDate(director.appointment_date)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No directors or office bearers captured." />
            )}
          </div>
        </div>
      </section>
      ) : null}

            {activeTab === "registrations" ? (
              activeRegistration === "uif" ? (
<section id="registrations" style={registrationWorkspace}>
                <div style={registrationBackRow}>
                  <Link
                    href={`/crm/client/${client.id}?tab=registrations`}
                    style={clientHomeTextLink}
                  >
                    ← Back to registrations
                  </Link>
                </div>
                <div style={registrationHero}>
                  <div>
                    <div style={eyebrow}>STATUTORY REGISTRATION</div>
                    <h2 style={registrationHeroTitle}>UIF Employer Registration</h2>
                    <div style={registrationHeroSubtitle}>
                      One guided workflow from client information to registration confirmation.
                    </div>
                  </div>

                  <div style={registrationHeroAction}>
                    <span style={nextActionLabel}>NEXT ACTION</span>
                    <strong style={nextActionValue}>{uifNextAction}</strong>
                  </div>
                </div>

                <div style={workflowBar}>
                  {[
                    ["Information", uifInfoComplete],
                    ["Employees", uifEmployeesComplete],
                    ["Documents", uifDocumentsComplete],
                    ["Submission", uifSubmissionComplete],
                    ["Registered", uifRegistered],
                  ].map(([label, complete], index) => (
                    <div
                      key={String(label)}
                      style={{
                        ...workflowStep,
                        ...(complete ? workflowStepComplete : {}),
                      }}
                    >
                      <span style={workflowNumber}>
                        {complete ? "✓" : String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <div style={registrationSummary}>
                  <div style={registrationSummaryItem}>
                    <span style={summarySmallLabel}>UIF STATUS</span>
                    <strong style={registrationSummaryValue}>
                      {client.uif_registration_number
                        ? "Registered"
                        : formatStatus(
                            uifRegistration?.registration_status || "not_started"
                          )}
                    </strong>
                  </div>

                  <div style={registrationSummaryItem}>
                    <span style={summarySmallLabel}>CONTRIBUTORS</span>
                    <strong style={registrationSummaryValue}>
                      {uifRegistration?.number_of_contributors ?? "—"}
                    </strong>
                  </div>

                  <div style={registrationSummaryItem}>
                    <span style={summarySmallLabel}>UI-19 EMPLOYEES</span>
                    <strong style={registrationSummaryValue}>
                      {uifEmployees.length}
                    </strong>
                  </div>

                  <div style={registrationSummaryItemLast}>
                    <span style={summarySmallLabel}>UIF NUMBER</span>
                    <strong style={registrationSummaryValue}>
                      {valueOrDash(client.uif_registration_number)}
                    </strong>
                  </div>
                </div>

                <form
                  method="post"
                  action={`/api/crm/clients/${client.id}/uif-registration`}
                >
                  <details style={workflowSection}>
                    <summary style={workflowSectionSummary}>
                      <div style={workflowSectionTitleWrap}>
                        <span
                          style={{
                            ...sectionStatusMark,
                            ...(uifInfoComplete ? sectionStatusMarkComplete : {}),
                          }}
                        >
                          {uifInfoComplete ? "✓" : "01"}
                        </span>
                        <div>
                          <strong style={workflowSectionTitle}>
                            Employer Information
                          </strong>
                          <div style={workflowSectionSubtitle}>
                            Core CRM information and statutory profile used by UIF.
                          </div>
                        </div>
                      </div>
                      <span style={sectionChevron}>⌄</span>
                    </summary>

                    <div style={workflowSectionBody}>
                      <div style={twoColumn}>
                        <div style={detailSectionWarm}>
                          <h3 style={miniHeading}>Employer details from CRM</h3>
                          <DetailRow label="Registered name" value={client.client_name} />
                          <DetailRow label="Trading name" value={client.trading_name} />
                          <DetailRow
                            label="Ownership / entity type"
                            value={client.entity_type}
                          />
                          <DetailRow
                            label="Registration / ID"
                            value={registrationOrId}
                          />
                          <DetailRow label="PAYE number" value={client.paye_number} />
                          <DetailRow
                            label="Business telephone"
                            value={primaryContact?.mobile || primaryContact?.phone}
                          />
                          <DetailRow
                            label="Business email"
                            value={primaryContact?.email}
                          />
                        </div>

                        <div style={detailSectionWarm}>
                          <h3 style={miniHeading}>Addresses from CRM</h3>
                          <DetailRow
                            label="Physical address"
                            value={
                              physicalAddress
                                ? [
                                    physicalAddress.line_1,
                                    physicalAddress.line_2,
                                    physicalAddress.city,
                                    physicalAddress.province,
                                    physicalAddress.postal_code,
                                  ]
                                    .filter(Boolean)
                                    .join(", ")
                                : null
                            }
                          />
                          <DetailRow
                            label="Postal address"
                            value={
                              postalAddress
                                ? [
                                    postalAddress.line_1,
                                    postalAddress.line_2,
                                    postalAddress.city,
                                    postalAddress.province,
                                    postalAddress.postal_code,
                                  ]
                                    .filter(Boolean)
                                    .join(", ")
                                : null
                            }
                          />
                        </div>
                      </div>

                      <div style={warmFormGrid}>
                        <FormField label="Nature of business">
                          <input
                            name="nature_of_business"
                            defaultValue={statutoryProfile?.nature_of_business || ""}
                            style={warmInput}
                          />
                        </FormField>

                        <FormField label="Magisterial district">
                          <input
                            name="magisterial_district"
                            defaultValue={statutoryProfile?.magisterial_district || ""}
                            style={warmInput}
                          />
                        </FormField>

                        <FormField label="Municipality">
                          <input
                            name="municipality"
                            defaultValue={statutoryProfile?.municipality || ""}
                            style={warmInput}
                          />
                        </FormField>
                      </div>

                      <div style={sectionActions}>
                        <button type="submit" style={primaryButton}>
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </details>

                  <details style={workflowSection}>
                    <summary style={workflowSectionSummary}>
                      <div style={workflowSectionTitleWrap}>
                        <span
                          style={{
                            ...sectionStatusMark,
                            ...(uifRegistration?.first_contributor_date
                              ? sectionStatusMarkComplete
                              : {}),
                          }}
                        >
                          {uifRegistration?.first_contributor_date ? "✓" : "02"}
                        </span>
                        <div>
                          <strong style={workflowSectionTitle}>
                            Registration Details
                          </strong>
                          <div style={workflowSectionSubtitle}>
                            UIF-specific registration information only.
                          </div>
                        </div>
                      </div>
                      <span style={sectionChevron}>⌄</span>
                    </summary>

                    <div style={workflowSectionBody}>
                      <div style={warmFormGrid}>
                        <FormField label="Registration status">
                          <select
                            name="registration_status"
                            defaultValue={
                              uifRegistration?.registration_status || "not_started"
                            }
                            style={warmInput}
                          >
                            <option value="not_started">Not started</option>
                            <option value="information_required">
                              Information required
                            </option>
                            <option value="ready_for_signature">
                              Ready for signature
                            </option>
                            <option value="submitted">Submitted</option>
                            <option value="registered">Registered</option>
                          </select>
                        </FormField>

                        <FormField label="First contributor employed">
                          <input
                            type="date"
                            name="first_contributor_date"
                            defaultValue={
                              uifRegistration?.first_contributor_date || ""
                            }
                            style={warmInput}
                          />
                        </FormField>

                        <FormField label="Number of contributors">
                          <input
                            type="number"
                            min="0"
                            name="number_of_contributors"
                            defaultValue={
                              uifRegistration?.number_of_contributors ?? ""
                            }
                            style={warmInput}
                          />
                        </FormField>

                        <FormField label="Language preference">
                          <select
                            name="language_preference"
                            defaultValue={
                              uifRegistration?.language_preference || ""
                            }
                            style={warmInput}
                          >
                            <option value="">Select</option>
                            <option value="English">English</option>
                            <option value="Afrikaans">Afrikaans</option>
                          </select>
                        </FormField>

                        <FormField label="Employee information">
                          <select
                            name="employee_information_method"
                            defaultValue={
                              uifRegistration?.employee_information_method || ""
                            }
                            style={warmInput}
                          >
                            <option value="">Select</option>
                            <option value="ui19_attached">UI-19 attached</option>
                            <option value="electronic">
                              Will be submitted electronically
                            </option>
                          </select>
                        </FormField>

                        <FormField label="UI-19 declaration month">
                          <input
                            type="month"
                            name="ui19_declaration_month"
                            defaultValue={
                              uifRegistration?.ui19_declaration_month
                                ? String(
                                    uifRegistration.ui19_declaration_month
                                  ).slice(0, 7)
                                : ""
                            }
                            style={warmInput}
                          />
                        </FormField>
                      </div>

                      <div style={sectionActions}>
                        <button type="submit" style={primaryButton}>
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </details>

                  <details style={workflowSection}>
                    <summary style={workflowSectionSummary}>
                      <div style={workflowSectionTitleWrap}>
                        <span
                          style={{
                            ...sectionStatusMark,
                            ...(uifEmployeesComplete
                              ? sectionStatusMarkComplete
                              : {}),
                          }}
                        >
                          {uifEmployeesComplete ? "✓" : "03"}
                        </span>
                        <div>
                          <strong style={workflowSectionTitle}>
                            Employees / UI-19
                          </strong>
                          <div style={workflowSectionSubtitle}>
                            {uifEmployees.length
                              ? `${uifEmployees.length} employee${
                                  uifEmployees.length === 1 ? "" : "s"
                                } captured`
                              : "No employees captured yet"}
                          </div>
                        </div>
                      </div>
                      <span style={sectionChevron}>⌄</span>
                    </summary>

                    <div style={workflowSectionBody}>
                      {uifEmployees.length ? (
                        <div style={uifEmployeeTable}>
                          <div style={uifEmployeeHeader}>
                            <span>Employee</span>
                            <span>ID / Passport</span>
                            <span>Gross remuneration</span>
                            <span>Commenced</span>
                            <span>Contributor</span>
                            <span>Action</span>
                          </div>

                          {uifEmployees.map((employee: any) => (
                            <div key={employee.id} style={uifEmployeeRow}>
                              <div>
                                <strong>
                                  {[employee.surname, employee.initials]
                                    .filter(Boolean)
                                    .join(" ")}
                                </strong>
                                {employee.termination_date ? (
                                  <div style={smallMuted}>
                                    Terminated:{" "}
                                    {formatDate(employee.termination_date)}
                                  </div>
                                ) : null}
                              </div>
                              <span>
                                {valueOrDash(employee.id_passport_number)}
                              </span>
                              <span>
                                {employee.gross_monthly_remuneration == null
                                  ? "—"
                                  : Number(
                                      employee.gross_monthly_remuneration
                                    ).toLocaleString("en-ZA", {
                                      style: "currency",
                                      currency: "ZAR",
                                    })}
                              </span>
                              <span>
                                {formatDate(employee.commencement_date)}
                              </span>
                              <span>
                                {employee.is_contributor === false
                                  ? "No"
                                  : "Yes"}
                              </span>
                              <div style={uifEmployeeActions}>
                                <Link
                                  href={`/crm/client/${client.id}?tab=registrations&uifEmployee=${employee.id}`}
                                  style={textLink}
                                >
                                  Edit
                                </Link>

                                <form
                                  method="post"
                                  action={`/api/crm/clients/${client.id}/uif-employees`}
                                >
                                  <input
                                    type="hidden"
                                    name="action"
                                    value="delete"
                                  />
                                  <input
                                    type="hidden"
                                    name="employee_id"
                                    value={employee.id}
                                  />
                                  <button
                                    type="submit"
                                    style={dangerTextButton}
                                  >
                                    Remove
                                  </button>
                                </form>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState text="No UI-19 employees captured yet." />
                      )}

                      <div style={employeeEditor}>
                        <div style={sectionMiniHeader}>
                          <div>
                            <strong style={workflowSectionTitle}>
                              {editingUifEmployee
                                ? "Edit employee"
                                : "Add employee"}
                            </strong>
                            <div style={smallMuted}>
                              Capture only the information required for UI-19.
                            </div>
                          </div>
                          {editingUifEmployee ? (
                            <Link
                              href={`/crm/client/${client.id}?tab=registrations`}
                              style={textLink}
                            >
                              Cancel edit
                            </Link>
                          ) : null}
                        </div>

                        <form
                          method="post"
                          action={`/api/crm/clients/${client.id}/uif-employees`}
                        >
                          <input
                            type="hidden"
                            name="action"
                            value={
                              editingUifEmployee ? "update" : "create"
                            }
                          />
                          {editingUifEmployee ? (
                            <input
                              type="hidden"
                              name="employee_id"
                              value={editingUifEmployee.id}
                            />
                          ) : null}

                          <div style={warmFormGrid}>
                            <FormField label="Surname">
                              <input
                                name="surname"
                                required
                                defaultValue={
                                  editingUifEmployee?.surname || ""
                                }
                                style={warmInput}
                              />
                            </FormField>

                            <FormField label="Initials">
                              <input
                                name="initials"
                                defaultValue={
                                  editingUifEmployee?.initials || ""
                                }
                                style={warmInput}
                              />
                            </FormField>

                            <FormField label="ID / Passport number">
                              <input
                                name="id_passport_number"
                                defaultValue={
                                  editingUifEmployee?.id_passport_number || ""
                                }
                                style={warmInput}
                              />
                            </FormField>

                            <FormField label="Gross monthly remuneration">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="gross_monthly_remuneration"
                                defaultValue={
                                  editingUifEmployee?.gross_monthly_remuneration ??
                                  ""
                                }
                                style={warmInput}
                              />
                            </FormField>

                            <FormField label="Total hours worked">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="total_hours_worked"
                                defaultValue={
                                  editingUifEmployee?.total_hours_worked ?? ""
                                }
                                style={warmInput}
                              />
                            </FormField>

                            <FormField label="Commencement date">
                              <input
                                type="date"
                                name="commencement_date"
                                defaultValue={
                                  editingUifEmployee?.commencement_date || ""
                                }
                                style={warmInput}
                              />
                            </FormField>

                            <FormField label="Termination date">
                              <input
                                type="date"
                                name="termination_date"
                                defaultValue={
                                  editingUifEmployee?.termination_date || ""
                                }
                                style={warmInput}
                              />
                            </FormField>

                            <FormField label="Termination reason">
                              <select
                                name="termination_reason_code"
                                defaultValue={
                                  editingUifEmployee?.termination_reason_code ??
                                  ""
                                }
                                style={warmInput}
                              >
                                <option value="">Not applicable</option>
                                <option value="2">2 - Deceased</option>
                                <option value="3">3 - Retired</option>
                                <option value="4">4 - Dismissed</option>
                                <option value="5">5 - Contract expired</option>
                                <option value="6">6 - Resigned</option>
                                <option value="7">
                                  7 - Constructive dismissal
                                </option>
                                <option value="8">
                                  8 - Insolvency / liquidation
                                </option>
                                <option value="9">
                                  9 - Maternity / adoption
                                </option>
                                <option value="10">
                                  10 - Illness / medically boarded
                                </option>
                                <option value="11">
                                  11 - Retrenched / staff reduction
                                </option>
                                <option value="12">
                                  12 - Transfer to another branch
                                </option>
                                <option value="13">13 - Absconded</option>
                                <option value="14">
                                  14 - Business closed
                                </option>
                                <option value="15">
                                  15 - Death of domestic employer
                                </option>
                                <option value="16">
                                  16 - Voluntary severance package
                                </option>
                              </select>
                            </FormField>

                            <FormField label="Contributor">
                              <select
                                name="is_contributor"
                                defaultValue={
                                  editingUifEmployee?.is_contributor === false
                                    ? "no"
                                    : "yes"
                                }
                                style={warmInput}
                              >
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                              </select>
                            </FormField>

                            <FormField label="Non-contributor reason">
                              <select
                                name="non_contributor_reason_code"
                                defaultValue={
                                  editingUifEmployee?.non_contributor_reason_code ??
                                  ""
                                }
                                style={warmInput}
                              >
                                <option value="">Not applicable</option>
                                <option value="1">
                                  1 - Temporary employee under 24 hours
                                </option>
                                <option value="2">2 - Learner</option>
                                <option value="3">
                                  3 - National / Provincial Government
                                </option>
                                <option value="4">
                                  4 - Repatriated at end of contract
                                </option>
                                <option value="5">
                                  5 - Commission only
                                </option>
                                <option value="6">
                                  6 - No income paid
                                </option>
                                <option value="7">
                                  7 - State old age pension
                                </option>
                                <option value="8">
                                  8 - Pension payment from employer
                                </option>
                                <option value="9">
                                  9 - Above ceiling (old Act)
                                </option>
                              </select>
                            </FormField>
                          </div>

                          <div style={sectionActions}>
                            <button type="submit" style={primaryButton}>
                              {editingUifEmployee
                                ? "Save Employee"
                                : "Add Employee"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </details>

                  <details style={workflowSection}>
                    <summary style={workflowSectionSummary}>
                      <div style={workflowSectionTitleWrap}>
                        <span
                          style={{
                            ...sectionStatusMark,
                            ...(uifDocumentsComplete
                              ? sectionStatusMarkComplete
                              : {}),
                          }}
                        >
                          {uifDocumentsComplete ? "✓" : "04"}
                        </span>
                        <div>
                          <strong style={workflowSectionTitle}>
                            Registration Documents
                          </strong>
                          <div style={workflowSectionSubtitle}>
                            Generate and control the documents required for submission.
                          </div>
                        </div>
                      </div>
                      <span style={sectionChevron}>⌄</span>
                    </summary>

                    <div style={workflowSectionBody}>
                      <div style={documentActionRow}>
                        <div>
                          <strong style={documentActionTitle}>UI-8</strong>
                          <div style={smallMuted}>
                            Employer registration application
                          </div>
                        </div>
                        <Link
                          href={`/api/crm/clients/${client.id}/uif-registration/ui8`}
                          style={secondaryButton}
                          target="_blank"
                        >
                          Generate UI-8
                        </Link>
                      </div>

                      <div style={documentActionRow}>
                        <div>
                          <strong style={documentActionTitle}>UI-19</strong>
                          <div style={smallMuted}>
                            Employer declaration of employees
                          </div>
                        </div>
                        <Link
                          href={`/api/crm/clients/${client.id}/uif-registration/ui19`}
                          style={secondaryButton}
                          target="_blank"
                        >
                          Generate UI-19
                        </Link>
                      </div>

                      <div style={checkGridWarm}>
                        <CheckField
                          name="ui8_completed"
                          label="UI-8 completed"
                          defaultChecked={
                            uifRegistration?.ui8_completed || false
                          }
                        />
                        <CheckField
                          name="ui19_or_employee_info_prepared"
                          label="UI-19 / employee information prepared"
                          defaultChecked={
                            uifRegistration?.ui19_or_employee_info_prepared ||
                            false
                          }
                        />
                        <CheckField
                          name="supporting_documents_attached"
                          label="Supporting documents attached"
                          defaultChecked={
                            uifRegistration?.supporting_documents_attached ||
                            false
                          }
                        />
                      </div>

                      <div style={sectionActions}>
                        <button type="submit" style={primaryButton}>
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </details>

                  <details style={workflowSection}>
                    <summary style={workflowSectionSummary}>
                      <div style={workflowSectionTitleWrap}>
                        <span
                          style={{
                            ...sectionStatusMark,
                            ...(uifSubmissionComplete || uifRegistered
                              ? sectionStatusMarkComplete
                              : {}),
                          }}
                        >
                          {uifSubmissionComplete || uifRegistered ? "✓" : "05"}
                        </span>
                        <div>
                          <strong style={workflowSectionTitle}>
                            Submission & Confirmation
                          </strong>
                          <div style={workflowSectionSubtitle}>
                            Final signature, submission and registration confirmation.
                          </div>
                        </div>
                      </div>
                      <span style={sectionChevron}>⌄</span>
                    </summary>

                    <div style={workflowSectionBody}>
                      <div style={checkGridWarm}>
                        <CheckField
                          name="signature_obtained"
                          label="Signature obtained"
                          defaultChecked={
                            uifRegistration?.signature_obtained || false
                          }
                        />
                        <CheckField
                          name="submitted_to_uif"
                          label="Submitted to UIF"
                          defaultChecked={
                            uifRegistration?.submitted_to_uif || false
                          }
                        />
                        <CheckField
                          name="confirmation_received"
                          label="Registration confirmation received"
                          defaultChecked={
                            uifRegistration?.confirmation_received || false
                          }
                        />
                      </div>

                      <div style={warmFormGrid}>
                        <FormField label="Submission date">
                          <input
                            type="date"
                            name="submission_date"
                            defaultValue={
                              uifRegistration?.submission_date || ""
                            }
                            style={warmInput}
                          />
                        </FormField>

                        <FormField label="Registration effective date">
                          <input
                            type="date"
                            name="registration_effective_date"
                            defaultValue={
                              uifRegistration?.registration_effective_date ||
                              ""
                            }
                            style={warmInput}
                          />
                        </FormField>
                      </div>

                      <FormField label="Notes">
                        <textarea
                          name="notes"
                          defaultValue={uifRegistration?.notes || ""}
                          rows={4}
                          style={warmTextarea}
                        />
                      </FormField>

                      <div style={sectionActions}>
                        <button type="submit" style={primaryButton}>
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </details>
                </form>
              </section>
              ) : (
                <section id="registrations" style={registrationHub}>
                  <div style={registrationHubHeader}>
                    <div>
                      <div style={clientHomeEyebrow}>Registrations</div>
                      <h2 style={registrationHubTitle}>Statutory Registration Hub</h2>
                      <p style={registrationHubSubtitle}>
                        Existing registration numbers are client master data. Start a guided workflow only where a registration still needs to be completed.
                      </p>
                    </div>
                    <Link
                      href={`/crm/edit-client?id=${client.id}`}
                      style={secondaryButton}
                    >
                      Edit statutory details
                    </Link>
                  </div>

                  <div style={registrationHubList}>
                    {[
                      {
                        key: "income-tax",
                        label: "Income Tax",
                        authority: "SARS",
                        number: client.tax_number,
                        
                      },
                      {
                        key: "vat",
                        label: "VAT",
                        authority: "SARS",
                        number: client.vat_number,
                        
                      },
                      {
                        key: "paye",
                        label: "PAYE",
                        authority: "SARS",
                        number: client.paye_number,
                        
                      },
                      {
                        key: "uif",
                        label: "UIF",
                        authority: "Department of Employment and Labour",
                        number: client.uif_registration_number,
                        
                      },
                      {
                        key: "coida",
                        label: "COIDA / Compensation Fund",
                        authority: "Compensation Fund",
                        number: client.wcc_reference_number,
                        
                      },
                      {
                        key: "customs",
                        label: "Customs",
                        authority: "SARS",
                        number: client.customs_number,
                        
                      },
                    ].map((item) => {
                      const registered = Boolean(String(item.number || "").trim());
                      const uifInProgress =
                        item.key === "uif" &&
                        !registered &&
                        Boolean(uifRegistration);
                      const needsRegistration =
                        item.key === "uif" && !registered && !uifInProgress;

                      return (
                        <div key={item.key} style={registrationHubRow}>
                          <div style={registrationHubIdentity}>
                            <div
                              style={{
                                ...registrationHubIcon,
                                ...(registered
                                  ? registrationHubIconRegistered
                                  : uifInProgress
                                    ? registrationHubIconProgress
                                    : needsRegistration
                                      ? registrationHubIconMissing
                                      : registrationHubIconNeutral),
                              }}
                            >
                              {registered
                                ? "✓"
                                : uifInProgress
                                  ? "→"
                                  : needsRegistration
                                    ? "!"
                                    : "—"}
                            </div>
                            <div>
                              <strong style={registrationHubItemTitle}>
                                {item.label}
                              </strong>
                              <div style={registrationHubItemMeta}>{item.authority}</div>
                            </div>
                          </div>

                          <div>
                            <div style={registrationHubSmallLabel}>Status</div>
                            <strong
                              style={{
                                ...registrationHubStatus,
                                color: registered
                                  ? "#2f7b4d"
                                  : uifInProgress
                                    ? "#2457d6"
                                    : needsRegistration
                                      ? "#996017"
                                      : "#66737d",
                              }}
                            >
                              {registered
                                ? "Registered"
                                : uifInProgress
                                  ? "Registration in progress"
                                  : needsRegistration
                                    ? "Not registered"
                                    : "Not registered"}
                            </strong>
                          </div>

                          <div>
                            <div style={registrationHubSmallLabel}>Registration number</div>
                            <strong style={registrationHubNumber}>
                              {registered ? item.number : "—"}
                            </strong>
                          </div>

                          <div style={registrationHubAction}>
                            {registered ? (
                              <Link
                                href={`/crm/edit-client?id=${client.id}`}
                                style={registrationHubSecondaryAction}
                              >
                                Edit details
                              </Link>
                            ) : item.key === "uif" ? (
                              <Link
                                href={`/crm/client/${client.id}?tab=registrations&registration=uif`}
                                style={registrationHubPrimaryAction}
                              >
                                {uifInProgress
                                  ? "Continue registration →"
                                  : "Start registration →"}
                              </Link>
                            ) : needsRegistration ? (
                              <span style={registrationHubPlanned}>
                                Workflow to be added
                              </span>
                            ) : (
                              <span style={registrationHubNeutralText}>
                                No workflow started
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )
            ) : null}

            {activeTab === "secretarial" ? (
              <section id="secretarial" style={panel}>
                <PanelHeader
                  number="06"
                  title="Secretarial"
                  subtitle="A summary of the client's statutory position. Open the full Secretarial file for detailed work."
                  action={
                    <Link
                      href={`/crm/secretarial/client/${client.id}`}
                      style={primaryButton}
                    >
                      Open Full Secretarial File
                    </Link>
                  }
                />

                <div style={secretarialSummary}>
                  <div style={secretarialSummaryItem}>
                    <span style={summarySmallLabel}>DIRECTORS</span>
                    <strong style={summaryBigValue}>
                      {directors.filter((director) => director.is_active !== false).length}
                    </strong>
                  </div>
                  <div style={secretarialSummaryItem}>
                    <span style={summarySmallLabel}>SHAREHOLDERS</span>
                    <strong style={summaryBigValue}>{shareholders.length}</strong>
                  </div>
                  <div style={secretarialSummaryItem}>
                    <span style={summarySmallLabel}>ISSUED SHARES</span>
                    <strong style={summaryBigValue}>{totalIssuedShares}</strong>
                  </div>
                  <div style={secretarialSummaryItem}>
                    <span style={summarySmallLabel}>ISSUED CERTIFICATES</span>
                    <strong style={summaryBigValue}>
                      {(certificates as any[]).filter(
                        (certificate) =>
                          String(certificate.certificate_status || "").toLowerCase() ===
                          "issued"
                      ).length}
                    </strong>
                  </div>
                  <div style={secretarialSummaryItemLast}>
                    <span style={summarySmallLabel}>OPEN MATTERS</span>
                    <strong style={summaryBigValue}>{pendingMatters.length}</strong>
                  </div>
                </div>

                <div style={secretarialBlock}>
                  <div style={subHeadingRow}>
                    <div>
                      <h3 style={secretarialHeading}>Shareholding snapshot</h3>
                      <div style={smallMuted}>
                        This is a view of the live Secretarial records — not a second copy.
                      </div>
                    </div>
                  </div>

                  {issuedHoldings.length ? (
                    <>
                      <div style={ownershipMapHeader}>
                        <div>
                          <div style={ownershipMapEyebrow}>OWNERSHIP MAP</div>
                          <div style={ownershipMapTitle}>
                            Who owns this company?
                          </div>
                          <div style={ownershipMapSub}>
                            {totalIssuedShares.toLocaleString("en-ZA")} issued shares ·{" "}
                            {issuedHoldings.length} current holder
                            {issuedHoldings.length === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div style={ownershipMapTotal}>
                          <strong>100%</strong>
                          <span>issued ownership</span>
                        </div>
                      </div>

                      <div style={ownershipMosaic}>
                        {issuedHoldings.map((holding, index) => {
                          const percentage =
                            totalIssuedShares > 0
                              ? (holding.shares / totalIssuedShares) * 100
                              : 0;

                          const shareholderCertificates = (certificates as any[]).filter(
                            (certificate) =>
                              String(certificate.shareholder_id || "") ===
                                holding.shareholderId &&
                              ["issued", "draft"].includes(
                                String(certificate.certificate_status || "").toLowerCase()
                              )
                          );

                          const certificateNumbers = shareholderCertificates
                            .map((certificate) =>
                              String(certificate.certificate_number || "").trim()
                            )
                            .filter(Boolean);

                          const initials = holding.shareholderName
                            .split(/\s+/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part.charAt(0).toUpperCase())
                            .join("");

                          const tileStyles = [
                            ownershipTileNavy,
                            ownershipTileBlue,
                            ownershipTileTeal,
                            ownershipTileSlate,
                            ownershipTileGreen,
                          ];

                          const tile = tileStyles[index % tileStyles.length];

                          return (
                            <div
                              key={`map-${holding.shareholderId}-${holding.className}`}
                              style={{
                                ...ownershipMosaicTile,
                                ...tile,
                                flexGrow: Math.max(percentage, 12),
                                flexBasis: `${Math.max(percentage, 18)}%`,
                              }}
                            >
                              <div style={ownershipTileTop}>
                                <div style={ownershipTileInitials}>
                                  {initials || "SH"}
                                </div>
                                <div style={ownershipTileRank}>0{index + 1}</div>
                              </div>

                              <div style={ownershipTilePercent}>
                                {percentage.toFixed(2)}%
                              </div>

                              <div style={ownershipTileName}>
                                {holding.shareholderName}
                              </div>

                              <div style={ownershipTileClass}>
                                {holding.className}
                              </div>

                              <div style={ownershipTileFooter}>
                                <div>
                                  <span>SHARES</span>
                                  <strong>
                                    {holding.shares.toLocaleString("en-ZA")}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    CERT{certificateNumbers.length === 1 ? "" : "S"}
                                  </span>
                                  <strong>
                                    {certificateNumbers.length
                                      ? certificateNumbers.join(", ")
                                      : "—"}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={ownershipLedger}>
                        <div style={ownershipLedgerHeader}>
                          <span>Shareholder</span>
                          <span>Class</span>
                          <span>Certificate</span>
                          <span>Shares</span>
                          <span>Ownership</span>
                        </div>

                        {issuedHoldings.map((holding, index) => {
                          const percentage =
                            totalIssuedShares > 0
                              ? (holding.shares / totalIssuedShares) * 100
                              : 0;

                          const shareholderCertificates = (certificates as any[]).filter(
                            (certificate) =>
                              String(certificate.shareholder_id || "") ===
                                holding.shareholderId &&
                              ["issued", "draft"].includes(
                                String(certificate.certificate_status || "").toLowerCase()
                              )
                          );

                          const certificateNumbers = shareholderCertificates
                            .map((certificate) =>
                              String(certificate.certificate_number || "").trim()
                            )
                            .filter(Boolean);

                          return (
                            <div
                              key={`ledger-${holding.shareholderId}-${holding.className}`}
                              style={ownershipLedgerRow}
                            >
                              <span style={ownershipLedgerName}>
                                <span style={ownershipLedgerRank}>0{index + 1}</span>
                                {holding.shareholderName}
                              </span>
                              <span>{holding.className}</span>
                              <span>
                                {certificateNumbers.length
                                  ? certificateNumbers.join(", ")
                                  : "—"}
                              </span>
                              <strong>
                                {holding.shares.toLocaleString("en-ZA")}
                              </strong>
                              <strong style={ownershipLedgerPercent}>
                                {percentage.toFixed(2)}%
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <EmptyState text="No issued shareholding recorded yet." />
                  )}
                </div>

                <div style={secretarialBlock}>
                  <Link
                    href={`/crm/secretarial/client/${client.id}`}
                    style={secretarialWorkspaceCallout}
                  >
                    <div>
                      <strong>Open the full Company Secretarial Working File</strong>
                      <div style={smallMuted}>
                        Directors · Shareholders · Share Capital · Certificates ·
                        Beneficial Ownership · Annual Returns · Company Changes ·
                        Registers · Documents
                      </div>
                    </div>
                    <strong>Open →</strong>
                  </Link>
                </div>
              </section>
            ) : null}

            {activeTab === "documents" ? (
<section id="documents" style={panel}>
        <PanelHeader
          number="06"
          title="Documents"
          subtitle="This will become PracticePilot's window into the client's Egnyte, Google Drive, Dropbox or server folders."
        />

        <div style={comingSoon}>
          <strong>External document workspace</strong>
          <span>
            We will connect this section to the firm's selected storage provider
            rather than duplicating documents inside PracticePilot.
          </span>
        </div>
      </section>
      ) : null}

            {activeTab === "activity" ? (
<section id="activity" style={panel}>
        <PanelHeader
          number="07"
          title="Activity"
          subtitle="A single history of what happened on the client and who did it."
        />

        <div style={activityGrid}>
          <DetailRow
            label="Client created"
            value={
              client.created_at
                ? new Date(client.created_at).toLocaleString("en-ZA")
                : "—"
            }
          />
          <DetailRow
            label="Last client update"
            value={
              client.updated_at
                ? new Date(client.updated_at).toLocaleString("en-ZA")
                : "—"
            }
          />
          <DetailRow
            label="Open tasks"
            value={String(tasks.length)}
          />
          <DetailRow
            label="Share certificate matters"
            value={String(matters.length)}
          />
        </div>
      </section>
      ) : null}
    </div>
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div style={profileField}>
      <div style={profileLabel}>{label}</div>
      <div style={profileValue}>{valueOrDash(value)}</div>
    </div>
  );
}

function PanelHeader({
  number,
  title,
  subtitle,
  action,
}: {
  number: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={panelHeader}>
      <div style={panelTitleGroup}>
        <span style={panelNumber}>{number}</span>
        <div>
          <h2 style={panelTitle}>{title}</h2>
          <p style={panelSubtitle}>{subtitle}</p>
        </div>
      </div>

      {action ? <div>{action}</div> : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div style={detailRow}>
      <span style={detailLabel}>{label}</span>
      <strong style={detailValue}>{valueOrDash(value)}</strong>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={formField}>
      <span style={formLabel}>{label}</span>
      {children}
    </label>
  );
}

function CheckField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label style={checkField}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={emptyState}>{text}</div>;
}

const secretarialSubNav: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 10px",
  display: "flex",
  alignItems: "stretch",
  flexWrap: "wrap",
  borderBottom: "1px solid #d8dee7",
  background: "#f8fafc",
};

const secretarialSubNavLink: React.CSSProperties = {
  padding: "11px 9px 9px",
  borderRight: "1px solid #e5eaf0",
  color: "#475569",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 900,
};

const secretarialSubNavLinkActive: React.CSSProperties = {
  background: "#0f1f33",
  color: "#ffffff",
};

const permanentRecordLinks: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "7px",
};

const recordLink: React.CSSProperties = {
  minHeight: "46px",
  padding: "8px 9px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  border: "1px solid #d8dee7",
  background: "#f8fafc",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 800,
};

const shareCapitalTable: React.CSSProperties = {
  border: "1px solid #d8dee7",
};

const shareCapitalHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1.5fr) 140px 140px 140px",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
};

const shareCapitalRow: React.CSSProperties = {
  minHeight: "48px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1.5fr) 140px 140px 140px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "9px",
};

const registerTable: React.CSSProperties = {
  border: "1px solid #d8dee7",
};

const registerHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns: "120px 120px minmax(200px, 1fr) minmax(180px, 1fr) 100px minmax(220px, 1fr)",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
};

const registerRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns: "120px 120px minmax(200px, 1fr) minmax(180px, 1fr) 100px minmax(220px, 1fr)",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "9px",
};

const secretarialWorkspaceCallout: React.CSSProperties = {
  minHeight: "62px",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "10px",
};

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "8px 10px 32px",
  background: "#eef2f5",
  color: "#10233a",
};

const workingFileBar: React.CSSProperties = {
  minHeight: "42px",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "9px",
  padding: "0 10px",
  background: "#ffffff",
  border: "1px solid #d2d9e2",
};

const workingFileLabel: React.CSSProperties = {
  color: "#1d4ed8",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.08em",
};

const divider: React.CSSProperties = { color: "#94a3b8" };

const crumbLink: React.CSSProperties = {
  color: "#10233a",
  fontWeight: 800,
  textDecoration: "none",
};

const workingFileMeta: React.CSSProperties = {
  marginLeft: "auto",
  color: "#64748b",
  fontSize: "11px",
};

const hero: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "112px",
  padding: "15px 14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  background: "#ffffff",
  border: "1px solid #d2d9e2",
};

const statusLine: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const statusBadge: React.CSSProperties = {
  padding: "3px 7px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "10px",
  fontWeight: 900,
};

const clientCode: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
};

const title: React.CSSProperties = {
  margin: "7px 0 0",
  fontSize: "24px",
  lineHeight: 1.15,
  fontWeight: 900,
};

const tradingName: React.CSSProperties = {
  marginTop: "4px",
  color: "#475569",
  fontSize: "13px",
};

const heroMeta: React.CSSProperties = {
  marginTop: "8px",
  display: "flex",
  flexWrap: "wrap",
  gap: "7px",
  color: "#64748b",
  fontSize: "12px",
};

const heroActions: React.CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  gap: "8px",
};

const primaryButton: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0f1f33",
  color: "#ffffff",
  border: "1px solid #07111f",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 900,
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "#ffffff",
  color: "#0f1f33",
  borderColor: "#cbd5e1",
};

const sectionWarningBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "9px 12px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  border: "1px solid #e8cf9e",
  background: "#fffaf0",
};

const sectionWarningTitle: React.CSSProperties = {
  color: "#8d5414",
  fontSize: "11px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const sectionWarningText: React.CSSProperties = {
  color: "#6d604f",
  fontSize: "10px",
  lineHeight: 1.45,
};

const warningBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "10px",
  color: "#92400e",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  fontSize: "11px",
  fontWeight: 800,
};

const sectionNav: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "42px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "4px",
  background: "#ffffff",
  border: "1px solid #d2d9e2",
};

const sectionNavLink: React.CSSProperties = {
  padding: "8px 10px",
  color: "#334155",
  textDecoration: "none",
  fontSize: "11px",
  fontWeight: 900,
  borderRight: "1px solid #e2e8f0",
};

const activeSectionNavLink: React.CSSProperties = {
  background: "#0f1f33",
  color: "#ffffff",
  borderRightColor: "#0f1f33",
};

const profilePage: React.CSSProperties = {
  marginTop: "8px",
  background: "#f7f7f4",
  border: "1px solid #d7dfde",
};

const profileHeader: React.CSSProperties = {
  minHeight: "90px",
  padding: "18px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "18px",
  background: "#ffffff",
  borderBottom: "1px solid #dfe5e4",
};

const profileTitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#10233a",
  fontSize: "22px",
  lineHeight: 1.2,
  fontWeight: 900,
};

const profileSubtitle: React.CSSProperties = {
  margin: "6px 0 0",
  maxWidth: "760px",
  color: "#65717d",
  fontSize: "12px",
  lineHeight: 1.5,
};

const profileGrid: React.CSSProperties = {
  padding: "10px 12px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const profileSection: React.CSSProperties = {
  minWidth: 0,
  background: "#ffffff",
  border: "1px solid #dfe5e4",
};

const profileSectionHeader: React.CSSProperties = {
  padding: "11px 14px",
  borderBottom: "1px solid #e5eae9",
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 900,
};

const profileFieldsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const profileField: React.CSSProperties = {
  minHeight: "64px",
  padding: "10px 14px",
  borderRight: "1px solid #edf0ef",
  borderBottom: "1px solid #edf0ef",
};

const profileLabel: React.CSSProperties = {
  color: "#697680",
  fontSize: "10px",
  fontWeight: 800,
};

const profileValue: React.CSSProperties = {
  marginTop: "4px",
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 800,
  lineHeight: 1.4,
  overflowWrap: "anywhere",
};

const profileAddressGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const profileAddressBlock: React.CSSProperties = {
  minHeight: "88px",
  padding: "12px 14px",
  borderRight: "1px solid #edf0ef",
};

const profileAddressValue: React.CSSProperties = {
  marginTop: "5px",
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.5,
};

const profileServicesGrid: React.CSSProperties = {
  display: "grid",
};

const profileServiceRow: React.CSSProperties = {
  minHeight: "58px",
  padding: "9px 14px",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  borderBottom: "1px solid #edf0ef",
};

const profileServiceName: React.CSSProperties = {
  color: "#10233a",
  fontSize: "11px",
  fontWeight: 900,
};

const profileServiceMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#78838b",
  fontSize: "9px",
};

const profileServiceRight: React.CSSProperties = {
  display: "grid",
  gap: "2px",
  textAlign: "right",
  color: "#586670",
  fontSize: "9px",
  fontWeight: 750,
};

const profilePeopleSummary: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const profilePeopleSummaryCell: React.CSSProperties = {
  minHeight: "86px",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "3px",
  borderRight: "1px solid #edf0ef",
};

const profilePeopleSummaryNumber: React.CSSProperties = {
  color: "#10233a",
  fontSize: "20px",
  fontWeight: 900,
};

const profilePeopleSummaryLabel: React.CSSProperties = {
  color: "#6f7b84",
  fontSize: "10px",
  lineHeight: 1.35,
};

const profileSectionFooter: React.CSSProperties = {
  padding: "10px 14px",
  borderTop: "1px solid #edf0ef",
  display: "flex",
  justifyContent: "flex-end",
};

const profileEmpty: React.CSSProperties = {
  padding: "18px 14px",
  color: "#7a858d",
  fontSize: "11px",
};

const registrationHubIconNeutral: React.CSSProperties = {
  background: "#f0f2f3",
  color: "#6a7680",
};

const registrationHubNeutralText: React.CSSProperties = {
  color: "#7a858d",
  fontSize: "10px",
  fontWeight: 750,
};

const clientHomeWrap: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gap: "12px",
};

const clientTodayNextAction: React.CSSProperties = {
  minHeight: "64px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "10px 14px",
  background: "#fffaf1",
  borderBottom: "1px solid #eadab8",
};

const clientTodayNextLabel: React.CSSProperties = {
  color: "#7b6847",
  fontSize: "10px",
  fontWeight: 850,
};

const clientTodayNextTitle: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 900,
};

const clientTodayNextMeta: React.CSSProperties = {
  marginTop: "3px",
  color: "#6d746f",
  fontSize: "10px",
};

const clientTodayNextButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#10233a",
  border: "1px solid #10233a",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "10px",
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const registrationHub: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d7dfde",
};

const registrationHubHeader: React.CSSProperties = {
  minHeight: "102px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "20px",
  padding: "18px 20px",
  borderBottom: "1px solid #e3e8e7",
};

const registrationHubTitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#10233a",
  fontSize: "22px",
  fontWeight: 900,
};

const registrationHubSubtitle: React.CSSProperties = {
  maxWidth: "820px",
  margin: "6px 0 0",
  color: "#65717d",
  fontSize: "12px",
  lineHeight: 1.45,
};

const registrationHubList: React.CSSProperties = {
  display: "grid",
};

const registrationHubRow: React.CSSProperties = {
  minHeight: "78px",
  display: "grid",
  gridTemplateColumns: "minmax(240px, 1.35fr) minmax(170px, .8fr) minmax(220px, 1fr) minmax(190px, .85fr)",
  gap: "16px",
  alignItems: "center",
  padding: "12px 18px",
  borderBottom: "1px solid #e7eceb",
};

const registrationHubIdentity: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: "11px",
};

const registrationHubIcon: React.CSSProperties = {
  width: "34px",
  height: "34px",
  flex: "0 0 34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  fontSize: "12px",
  fontWeight: 900,
};

const registrationHubIconRegistered: React.CSSProperties = {
  background: "#e9f6ee",
  color: "#2f7b4d",
};

const registrationHubIconProgress: React.CSSProperties = {
  background: "#eaf2ff",
  color: "#2457d6",
};

const registrationHubIconMissing: React.CSSProperties = {
  background: "#fff4df",
  color: "#996017",
};

const registrationHubItemTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 900,
};

const registrationHubItemMeta: React.CSSProperties = {
  marginTop: "3px",
  color: "#74808a",
  fontSize: "10px",
};

const registrationHubSmallLabel: React.CSSProperties = {
  color: "#74808a",
  fontSize: "9px",
  fontWeight: 750,
};

const registrationHubStatus: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  fontSize: "11px",
  fontWeight: 900,
};

const registrationHubNumber: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#10233a",
  fontSize: "11px",
  fontWeight: 850,
};

const registrationHubAction: React.CSSProperties = {
  justifySelf: "end",
};

const registrationHubPrimaryAction: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#10233a",
  border: "1px solid #10233a",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "10px",
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const registrationHubSecondaryAction: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffffff",
  border: "1px solid #cfd8d7",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "10px",
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const registrationHubPlanned: React.CSSProperties = {
  color: "#7a858d",
  fontSize: "10px",
  fontWeight: 750,
};

const registrationBackRow: React.CSSProperties = {
  padding: "10px 18px",
  background: "#ffffff",
  borderBottom: "1px solid #e3e8e7",
};

const clientNextPanel: React.CSSProperties = {
  minHeight: "176px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.35fr) minmax(360px, .85fr)",
  background: "#ffffff",
  border: "1px solid #d7dfde",
};

const clientNextMain: React.CSSProperties = {
  padding: "22px 24px",
  borderRight: "1px solid #e3e8e7",
};

const clientHomeEyebrow: React.CSSProperties = {
  color: "#5c6f67",
  fontSize: "11px",
  fontWeight: 850,
};

const clientNextTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#10233a",
  fontSize: "24px",
  lineHeight: 1.2,
  fontWeight: 900,
};

const clientNextMetaStyle: React.CSSProperties = {
  maxWidth: "720px",
  margin: "8px 0 0",
  color: "#65717d",
  fontSize: "13px",
  lineHeight: 1.5,
};

const clientNextActions: React.CSSProperties = {
  marginTop: "20px",
  display: "flex",
  alignItems: "center",
  gap: "18px",
  flexWrap: "wrap",
};

const clientHomePrimaryButton: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 15px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #09172a",
  background: "#10233a",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 850,
};

const clientHomeTextLink: React.CSSProperties = {
  color: "#2457d6",
  textDecoration: "none",
  fontSize: "11px",
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const clientProgressArea: React.CSSProperties = {
  padding: "22px 24px",
  background: "#fbfcfb",
};

const clientProgressTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  color: "#465763",
  fontSize: "11px",
  fontWeight: 800,
};

const clientProgressTrack: React.CSSProperties = {
  height: "6px",
  marginTop: "10px",
  background: "#e8edec",
  overflow: "hidden",
};

const clientProgressFill: React.CSSProperties = {
  height: "100%",
  background: "#2457d6",
};

const clientProgressSteps: React.CSSProperties = {
  marginTop: "15px",
  display: "grid",
  gap: "8px",
};

const clientProgressStep: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#52616b",
  fontSize: "11px",
  fontWeight: 750,
};

const clientProgressDot: React.CSSProperties = {
  width: "22px",
  height: "22px",
  flex: "0 0 22px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #cfd8d7",
  borderRadius: "50%",
  background: "#ffffff",
  color: "#6c7881",
  fontSize: "10px",
  fontWeight: 900,
};

const clientProgressDotDone: React.CSSProperties = {
  borderColor: "#9ecfb0",
  background: "#edf7f0",
  color: "#2e7148",
};

const clientStatusStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  background: "#ffffff",
  border: "1px solid #d7dfde",
};

const clientStatusCell: React.CSSProperties = {
  minWidth: 0,
  minHeight: "82px",
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  gap: "10px",
  alignItems: "center",
  padding: "12px",
  borderRight: "1px solid #e6ebea",
};

const clientStatusIcon: React.CSSProperties = {
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  fontSize: "13px",
  fontWeight: 900,
};

const clientStatusGreen: React.CSSProperties = {
  background: "#e9f6ee",
  color: "#2f7b4d",
};

const clientStatusRed: React.CSSProperties = {
  background: "#fde9e7",
  color: "#b42318",
};

const clientStatusAmber: React.CSSProperties = {
  background: "#fff4df",
  color: "#ae6913",
};

const clientStatusBlue: React.CSSProperties = {
  background: "#eaf2ff",
  color: "#2457d6",
};

const clientStatusNavy: React.CSSProperties = {
  background: "#eef1f4",
  color: "#10233a",
};


const clientStatusNeutral: React.CSSProperties = {
  background: "#f0f2f3",
  color: "#6a7680",
};


const clientStatusLabel: React.CSSProperties = {
  color: "#53616d",
  fontSize: "10px",
  fontWeight: 800,
};

const clientStatusValue: React.CSSProperties = {
  marginTop: "2px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 900,
};

const clientStatusNote: React.CSSProperties = {
  marginTop: "3px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#7a858d",
  fontSize: "9px",
};

const clientHomeGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.55fr) minmax(320px, .9fr) minmax(280px, .75fr)",
  gap: "12px",
  alignItems: "start",
};

const clientHomeRightStack: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const clientHomePanel: React.CSSProperties = {
  minWidth: 0,
  background: "#ffffff",
  border: "1px solid #d7dfde",
};

const clientHomePanelHeader: React.CSSProperties = {
  minHeight: "58px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  padding: "10px 14px",
  borderBottom: "1px solid #e5eae9",
};

const clientHomePanelTitle: React.CSSProperties = {
  margin: 0,
  color: "#10233a",
  fontSize: "15px",
  fontWeight: 900,
};

const clientHomePanelSubtitle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#74808a",
  fontSize: "10px",
};

const clientWorkRow: React.CSSProperties = {
  minHeight: "62px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.7fr) 110px 100px 58px",
  gap: "10px",
  alignItems: "center",
  padding: "9px 14px",
  borderBottom: "1px solid #e7eceb",
};

const clientWorkTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "11px",
  fontWeight: 900,
};

const clientWorkMeta: React.CSSProperties = {
  marginTop: "3px",
  color: "#74808a",
  fontSize: "9px",
};

const clientWorkStatus: React.CSSProperties = {
  justifySelf: "start",
  padding: "4px 7px",
  background: "#eef3f9",
  border: "1px solid #d5e0eb",
  color: "#2d5577",
  fontSize: "9px",
  fontWeight: 850,
};

const clientWorkDue: React.CSSProperties = {
  color: "#52616b",
  fontSize: "10px",
  fontWeight: 800,
};

const clientWaitingRow: React.CSSProperties = {
  minHeight: "58px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "9px 14px",
  borderBottom: "1px solid #e7eceb",
};

const clientWaitingBadge: React.CSSProperties = {
  padding: "4px 7px",
  background: "#fff4df",
  border: "1px solid #edd5aa",
  color: "#996017",
  fontSize: "9px",
  fontWeight: 850,
};

const clientActivityRow: React.CSSProperties = {
  minHeight: "54px",
  display: "grid",
  gridTemplateColumns: "26px minmax(0, 1fr)",
  gap: "8px",
  alignItems: "center",
  padding: "8px 14px",
  borderBottom: "1px solid #e7eceb",
};

const clientActivityDot: React.CSSProperties = {
  width: "22px",
  height: "22px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: "#eef2f5",
  color: "#50616c",
  fontSize: "10px",
  fontWeight: 900,
};

const clientActivityDotDone: React.CSSProperties = {
  background: "#e9f6ee",
  color: "#2f7b4d",
};

const clientPersonRow: React.CSSProperties = {
  minHeight: "68px",
  display: "grid",
  gridTemplateColumns: "38px minmax(0, 1fr)",
  gap: "10px",
  alignItems: "center",
  padding: "10px 14px",
  borderBottom: "1px solid #e7eceb",
};

const clientPersonAvatar: React.CSSProperties = {
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: "#edf2f6",
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 900,
};

const clientPersonContact: React.CSSProperties = {
  marginTop: "2px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#53616d",
  fontSize: "9px",
};

const clientHomeEmpty: React.CSSProperties = {
  padding: "26px 14px",
  color: "#7a858d",
  fontSize: "11px",
};

const clientHomeSnapshot: React.CSSProperties = {
  minHeight: "58px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  padding: "10px 14px",
  background: "#fffaf1",
  border: "1px solid #eadab8",
};

const clientSnapshotTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "11px",
  fontWeight: 900,
};

const clientSnapshotText: React.CSSProperties = {
  marginTop: "3px",
  color: "#6d746f",
  fontSize: "10px",
};

const panel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d2d9e2",
  scrollMarginTop: "12px",
};

const panelHeader: React.CSSProperties = {
  minHeight: "62px",
  padding: "10px 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  borderBottom: "1px solid #d2d9e2",
};

const panelTitleGroup: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const panelNumber: React.CSSProperties = {
  width: "30px",
  height: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  fontSize: "10px",
  fontWeight: 900,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 900,
};

const panelSubtitle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: "11px",
};

const twoColumn: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  borderBottom: "1px solid #e5eaf0",
};

const detailSection: React.CSSProperties = {
  minWidth: 0,
  padding: "12px",
  borderRight: "1px solid #e5eaf0",
};

const detailSectionFull: React.CSSProperties = {
  padding: "12px",
};

const miniHeading: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: "12px",
  fontWeight: 900,
  color: "#0f2942",
};

const detailRow: React.CSSProperties = {
  minHeight: "34px",
  display: "grid",
  gridTemplateColumns: "150px minmax(0, 1fr)",
  alignItems: "center",
  gap: "10px",
  borderBottom: "1px solid #edf0f4",
};

const detailLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 800,
};

const detailValue: React.CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  fontSize: "11px",
};

const addressBlock: React.CSSProperties = {
  padding: "7px 0",
  borderBottom: "1px solid #edf0f4",
  color: "#334155",
  fontSize: "11px",
  lineHeight: 1.5,
};

const addressType: React.CSSProperties = {
  display: "block",
  marginBottom: "2px",
  color: "#0f2942",
  textTransform: "capitalize",
};

const list: React.CSSProperties = {
  padding: "0 12px",
};

const serviceRow: React.CSSProperties = {
  minHeight: "48px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 210px",
  alignItems: "center",
  gap: "15px",
  borderBottom: "1px solid #e5eaf0",
};

const serviceMain: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const rightInfo: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  color: "#334155",
  fontSize: "11px",
};

const taskRow: React.CSSProperties = {
  minHeight: "52px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 210px 50px",
  alignItems: "center",
  gap: "12px",
  borderBottom: "1px solid #e5eaf0",
};

const taskMain: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const taskDue: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const rowTitle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 900,
};

const rowMeta: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
};

const smallMuted: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
};

const statusPill: React.CSSProperties = {
  padding: "3px 6px",
  border: "1px solid #d8dee7",
  background: "#f8fafc",
  color: "#475569",
  fontSize: "9px",
  fontWeight: 900,
  textTransform: "capitalize",
};

const personRow: React.CSSProperties = {
  minHeight: "52px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(150px, .8fr)",
  alignItems: "center",
  gap: "12px",
  borderBottom: "1px solid #e5eaf0",
};

const personContact: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  textAlign: "right",
  overflowWrap: "anywhere",
  fontSize: "10px",
};

const certificateRow: React.CSSProperties = {
  minHeight: "62px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 115px 42px",
  alignItems: "center",
  gap: "10px",
  borderBottom: "1px solid #e5eaf0",
};

const certificateInfo: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const certificateStatus: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  alignItems: "flex-start",
};

const subHeadingRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const certificateHeader: React.CSSProperties = {
  minHeight: "30px",
  display: "grid",
  gridTemplateColumns: "110px minmax(0, 1.5fr) 100px 110px 100px",
  alignItems: "center",
  gap: "10px",
  padding: "0 8px",
  background: "#f7f9fb",
  border: "1px solid #e2e8f0",
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 900,
  textTransform: "uppercase",
};

const certificateRegisterRow: React.CSSProperties = {
  minHeight: "40px",
  display: "grid",
  gridTemplateColumns: "110px minmax(0, 1.5fr) 100px 110px 100px",
  alignItems: "center",
  gap: "10px",
  padding: "0 8px",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "10px",
};

const textLink: React.CSSProperties = {
  color: "#1d4ed8",
  textDecoration: "none",
  fontSize: "10px",
  fontWeight: 900,
};

const emptyState: React.CSSProperties = {
  padding: "12px 0",
  color: "#64748b",
  fontSize: "11px",
};

const secretarialActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const secondarySmallButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 9px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f1f33",
  textDecoration: "none",
  fontSize: "10px",
  fontWeight: 900,
};

const secretarialSummary: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  borderBottom: "1px solid #d2d9e2",
};

const secretarialSummaryItem: React.CSSProperties = {
  minHeight: "62px",
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "4px",
  borderRight: "1px solid #e5eaf0",
};

const secretarialSummaryItemLast: React.CSSProperties = {
  ...secretarialSummaryItem,
  borderRight: "none",
};

const summarySmallLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "0.05em",
};

const summaryBigValue: React.CSSProperties = {
  color: "#0f1f33",
  fontSize: "20px",
  lineHeight: 1,
  fontWeight: 900,
};

const secretarialBlock: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #e5eaf0",
};

const secretarialHeading: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  color: "#0f2942",
  fontWeight: 900,
};

const ownershipMapHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "18px",
  margin: "12px 0 10px",
};

const ownershipMapEyebrow: React.CSSProperties = {
  color: "#51708a",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.16em",
};

const ownershipMapTitle: React.CSSProperties = {
  marginTop: "3px",
  color: "#10233a",
  fontSize: "18px",
  fontWeight: 900,
  letterSpacing: "-0.02em",
};

const ownershipMapSub: React.CSSProperties = {
  marginTop: "3px",
  color: "#6f7c88",
  fontSize: "10px",
};

const ownershipMapTotal: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  color: "#10233a",
};

const ownershipMosaic: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  minHeight: "210px",
};

const ownershipMosaicTile: React.CSSProperties = {
  minWidth: "210px",
  minHeight: "205px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  color: "#ffffff",
  border: "1px solid rgba(0,0,0,0.05)",
};

const ownershipTileNavy: React.CSSProperties = {
  background: "linear-gradient(145deg, #10233a 0%, #183a5a 100%)",
};

const ownershipTileBlue: React.CSSProperties = {
  background: "linear-gradient(145deg, #1d4ed8 0%, #356ae6 100%)",
};

const ownershipTileTeal: React.CSSProperties = {
  background: "linear-gradient(145deg, #0f8fa3 0%, #18a6b9 100%)",
};

const ownershipTileSlate: React.CSSProperties = {
  background: "linear-gradient(145deg, #526273 0%, #71808d 100%)",
};

const ownershipTileGreen: React.CSSProperties = {
  background: "linear-gradient(145deg, #2f855a 0%, #3d9b6b 100%)",
};

const ownershipTileTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const ownershipTileInitials: React.CSSProperties = {
  width: "34px",
  height: "34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.22)",
  fontSize: "10px",
  fontWeight: 900,
};

const ownershipTileRank: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "0.12em",
  opacity: 0.65,
};

const ownershipTilePercent: React.CSSProperties = {
  marginTop: "20px",
  fontSize: "34px",
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: "-0.04em",
};

const ownershipTileName: React.CSSProperties = {
  marginTop: "9px",
  fontSize: "13px",
  fontWeight: 900,
  lineHeight: 1.25,
};

const ownershipTileClass: React.CSSProperties = {
  marginTop: "3px",
  fontSize: "9px",
  opacity: 0.72,
};

const ownershipTileFooter: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  marginTop: "18px",
  paddingTop: "11px",
  borderTop: "1px solid rgba(255,255,255,0.22)",
};

const ownershipLedger: React.CSSProperties = {
  marginTop: "10px",
  border: "1px solid #d8e0e6",
  background: "#ffffff",
};

const ownershipLedgerHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1.4fr 0.8fr 0.7fr 0.7fr",
  gap: "12px",
  padding: "9px 12px",
  background: "#f3f6f8",
  borderBottom: "1px solid #d8e0e6",
  color: "#6f7c88",
  fontSize: "8px",
  fontWeight: 900,
};

const ownershipLedgerRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1.4fr 0.8fr 0.7fr 0.7fr",
  gap: "12px",
  alignItems: "center",
  padding: "9px 12px",
  borderBottom: "1px solid #edf1f4",
  color: "#40515d",
  fontSize: "9px",
};

const ownershipLedgerName: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#10233a",
  fontWeight: 900,
};

const ownershipLedgerRank: React.CSSProperties = {
  color: "#98a4ae",
  fontSize: "8px",
  letterSpacing: "0.08em",
};

const ownershipLedgerPercent: React.CSSProperties = {
  color: "#1d4ed8",
  textAlign: "right",
};

const ownershipHero: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  padding: "16px 18px",
  margin: "12px 0 0",
  background: "#10233a",
  color: "#ffffff",
  border: "1px solid #10233a",
};

const ownershipHeroCopy: React.CSSProperties = {
  minWidth: 0,
};

const ownershipEyebrow: React.CSSProperties = {
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.14em",
  color: "#9fb6c9",
};

const ownershipHeroTitle: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "20px",
  fontWeight: 900,
  letterSpacing: "-0.02em",
};

const ownershipHeroSub: React.CSSProperties = {
  marginTop: "3px",
  fontSize: "10px",
  color: "#c7d3dd",
};

const ownershipHeroStat: React.CSSProperties = {
  minWidth: "120px",
  paddingLeft: "18px",
  borderLeft: "1px solid rgba(255,255,255,0.18)",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
};

const ownershipCompositionBar: React.CSSProperties = {
  display: "flex",
  height: "30px",
  overflow: "hidden",
  borderLeft: "1px solid #d8e0e6",
  borderRight: "1px solid #d8e0e6",
};

const ownershipSegment: React.CSSProperties = {
  minWidth: "18px",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 900,
  borderRight: "2px solid #ffffff",
};

const ownershipSegmentNavy: React.CSSProperties = { background: "#10233a" };
const ownershipSegmentBlue: React.CSSProperties = { background: "#1d4ed8" };
const ownershipSegmentTeal: React.CSSProperties = { background: "#0f8fa3" };
const ownershipSegmentSlate: React.CSSProperties = { background: "#64748b" };
const ownershipSegmentGreen: React.CSSProperties = { background: "#2f855a" };

const ownershipLegendGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0",
  border: "1px solid #d8e0e6",
  borderTop: "none",
  background: "#f8fafb",
  marginBottom: "12px",
};

const ownershipLegendItem: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "10px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "7px",
  padding: "8px 10px",
  borderRight: "1px solid #e5eaee",
  fontSize: "9px",
  color: "#526273",
};

const ownershipLegendSwatch: React.CSSProperties = {
  width: "8px",
  height: "8px",
  display: "inline-block",
};

const ownershipDotNavy: React.CSSProperties = { background: "#10233a" };
const ownershipDotBlue: React.CSSProperties = { background: "#1d4ed8" };
const ownershipDotTeal: React.CSSProperties = { background: "#0f8fa3" };
const ownershipDotSlate: React.CSSProperties = { background: "#64748b" };
const ownershipDotGreen: React.CSSProperties = { background: "#2f855a" };

const ownershipGridFunky: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
  gap: "10px",
};

const ownershipCardFunky: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  border: "1px solid #d8e0e6",
  background: "#ffffff",
};

const ownershipAccent: React.CSSProperties = {
  height: "5px",
  width: "100%",
};

const ownershipAccentNavy: React.CSSProperties = { background: "#10233a" };
const ownershipAccentBlue: React.CSSProperties = { background: "#1d4ed8" };
const ownershipAccentTeal: React.CSSProperties = { background: "#0f8fa3" };
const ownershipAccentSlate: React.CSSProperties = { background: "#64748b" };
const ownershipAccentGreen: React.CSSProperties = { background: "#2f855a" };

const ownershipCardMain: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px 42px minmax(0, 1fr) auto",
  gap: "10px",
  alignItems: "center",
  padding: "14px 14px 12px",
};

const ownershipRank: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 900,
  color: "#9aa6b2",
  letterSpacing: "0.08em",
};

const ownershipAvatarLarge: React.CSSProperties = {
  width: "42px",
  height: "42px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#eef3f6",
  border: "1px solid #d8e0e6",
  color: "#10233a",
  fontSize: "11px",
  fontWeight: 900,
};

const ownershipCardIdentity: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const ownershipNameLarge: React.CSSProperties = {
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 900,
  lineHeight: 1.2,
};

const ownershipClassLabel: React.CSSProperties = {
  color: "#7b8792",
  fontSize: "9px",
};

const ownershipPercentBlock: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  minWidth: "82px",
};

const ownershipCardBottom: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "90px 120px minmax(80px, 1fr)",
  gap: "16px",
  alignItems: "end",
  padding: "10px 14px 12px",
  borderTop: "1px solid #edf1f4",
  background: "#fbfcfd",
};

const ownershipMiniBarWrap: React.CSSProperties = {
  minWidth: 0,
  paddingBottom: "3px",
};

const ownershipMiniBarTrack: React.CSSProperties = {
  height: "6px",
  background: "#e8edf2",
  overflow: "hidden",
};

const ownershipMiniBarFill: React.CSSProperties = {
  height: "100%",
};

const ownershipSnapshotHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "16px",
  margin: "12px 0 10px",
};

const ownershipSnapshotTitle: React.CSSProperties = {
  display: "block",
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 900,
};

const ownershipSnapshotLegend: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  color: "#6f7c88",
  fontSize: "9px",
  whiteSpace: "nowrap",
};

const ownershipLegendDot: React.CSSProperties = {
  width: "8px",
  height: "8px",
  background: "#1d4ed8",
  display: "inline-block",
};

const ownershipCardEnhanced: React.CSSProperties = {
  border: "1px solid #d9e0e6",
  background: "#ffffff",
  padding: "12px",
};

const ownershipIdentityRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr) auto",
  gap: "10px",
  alignItems: "center",
};

const ownershipAvatar: React.CSSProperties = {
  width: "34px",
  height: "34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d9e0e6",
  background: "#eef3f6",
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 900,
};

const ownershipIdentityText: React.CSSProperties = {
  minWidth: 0,
};

const ownershipPercentEnhanced: React.CSSProperties = {
  color: "#1d4ed8",
  fontSize: "18px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const ownershipFactsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "140px minmax(0, 1fr)",
  gap: "14px",
  marginTop: "12px",
  paddingTop: "10px",
  borderTop: "1px solid #edf1f4",
};

const ownershipFact: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const ownershipFactLabel: React.CSSProperties = {
  color: "#7a8791",
  fontSize: "8px",
  fontWeight: 800,
};

const ownershipFactValue: React.CSSProperties = {
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 900,
};

const ownershipFactValueSmall: React.CSSProperties = {
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 800,
  lineHeight: 1.35,
};

const ownershipGrid: React.CSSProperties = {
  marginTop: "10px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
};

const ownershipCard: React.CSSProperties = {
  minWidth: 0,
  padding: "10px",
  border: "1px solid #d8dee7",
  background: "#fbfcfd",
};

const ownershipTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "12px",
};

const ownershipName: React.CSSProperties = {
  minWidth: 0,
  fontSize: "11px",
  fontWeight: 900,
};

const ownershipPercent: React.CSSProperties = {
  flex: "0 0 auto",
  color: "#1d4ed8",
  fontSize: "15px",
  fontWeight: 900,
};

const ownershipMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "9px",
};

const ownershipShares: React.CSSProperties = {
  marginTop: "7px",
  color: "#334155",
  fontSize: "10px",
  fontWeight: 800,
};

const ownershipBar: React.CSSProperties = {
  marginTop: "7px",
  height: "5px",
  overflow: "hidden",
  background: "#e2e8f0",
};

const ownershipBarFill: React.CSSProperties = {
  height: "100%",
  background: "#1d4ed8",
};

const pendingAllocationRow: React.CSSProperties = {
  minHeight: "62px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 115px 42px",
  alignItems: "center",
  gap: "10px",
  borderBottom: "1px solid #e5eaf0",
};

const certificateCards: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
};

const certificateHistoryCard: React.CSSProperties = {
  minHeight: "70px",
  padding: "9px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 120px",
  alignItems: "center",
  gap: "12px",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const certificateNumber: React.CSSProperties = {
  marginBottom: "4px",
  color: "#1d4ed8",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "0.03em",
};

const certificateHistoryRight: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "4px",
};

const registerPlaceholder: React.CSSProperties = {
  marginTop: "8px",
  padding: "10px",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  background: "#f8fafc",
  fontSize: "10px",
  lineHeight: 1.5,
};

const comingBadge: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  padding: "3px 6px",
  border: "1px solid #d8dee7",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
};

const secretarialLinkGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
};

const secretarialLinkItem: React.CSSProperties = {
  minHeight: "88px",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  border: "1px solid #d8dee7",
  color: "#475569",
  fontSize: "10px",
};

const registrationWorkspace: React.CSSProperties = {
  border: "1px solid #d8d2c8",
  background: "#f4f1eb",
};

const registrationHero: React.CSSProperties = {
  minHeight: "92px",
  padding: "18px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "24px",
  background: "#fffdf9",
  borderBottom: "1px solid #d8d2c8",
};

const eyebrow: React.CSSProperties = {
  color: "#8a7457",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "0.12em",
};

const registrationHeroTitle: React.CSSProperties = {
  margin: "4px 0 3px",
  color: "#10233a",
  fontSize: "22px",
  lineHeight: 1.1,
};

const registrationHeroSubtitle: React.CSSProperties = {
  color: "#6f6a63",
  fontSize: "11px",
};

const registrationHeroAction: React.CSSProperties = {
  minWidth: "270px",
  padding: "12px 14px",
  borderLeft: "3px solid #10233a",
  background: "#f7f3ec",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const nextActionLabel: React.CSSProperties = {
  color: "#8a7457",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.1em",
};

const nextActionValue: React.CSSProperties = {
  color: "#10233a",
  fontSize: "12px",
};

const workflowBar: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  background: "#ece6dc",
  borderBottom: "1px solid #d8d2c8",
};

const workflowStep: React.CSSProperties = {
  minHeight: "46px",
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#6f6a63",
  fontSize: "10px",
  fontWeight: 800,
  borderRight: "1px solid #d8d2c8",
};

const workflowStepComplete: React.CSSProperties = {
  background: "#e8efe7",
  color: "#31583b",
};

const workflowNumber: React.CSSProperties = {
  minWidth: "22px",
  height: "22px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid currentColor",
  fontSize: "8px",
  fontWeight: 900,
};

const registrationSummary: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  background: "#fffdf9",
  borderBottom: "1px solid #d8d2c8",
};

const registrationSummaryItem: React.CSSProperties = {
  minHeight: "54px",
  padding: "9px 14px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "3px",
  borderRight: "1px solid #e4ded4",
};

const registrationSummaryItemLast: React.CSSProperties = {
  ...registrationSummaryItem,
  borderRight: "none",
};

const registrationSummaryValue: React.CSSProperties = {
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 900,
};

const workflowSection: React.CSSProperties = {
  margin: "12px",
  border: "1px solid #d8d2c8",
  background: "#fffdf9",
};

const workflowSectionSummary: React.CSSProperties = {
  minHeight: "58px",
  padding: "0 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  cursor: "pointer",
  listStyle: "none",
  background: "#fffdf9",
};

const workflowSectionTitleWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
};

const sectionStatusMark: React.CSSProperties = {
  minWidth: "28px",
  height: "28px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #b8b0a5",
  color: "#776f65",
  background: "#f6f1e9",
  fontSize: "9px",
  fontWeight: 900,
};

const sectionStatusMarkComplete: React.CSSProperties = {
  borderColor: "#8aa28e",
  color: "#31583b",
  background: "#e8efe7",
};

const workflowSectionTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "11px",
  fontWeight: 900,
};

const workflowSectionSubtitle: React.CSSProperties = {
  marginTop: "2px",
  color: "#7a746c",
  fontSize: "9px",
};

const sectionChevron: React.CSSProperties = {
  color: "#847b70",
  fontSize: "18px",
};

const workflowSectionBody: React.CSSProperties = {
  padding: "14px",
  borderTop: "1px solid #e4ded4",
  background: "#fffdf9",
};

const detailSectionWarm: React.CSSProperties = {
  padding: "0 12px 6px",
  background: "#faf7f2",
};

const warmFormGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  marginTop: "12px",
};

const warmInput: React.CSSProperties = {
  width: "100%",
  minHeight: "36px",
  padding: "7px 9px",
  border: "1px solid #cfc6ba",
  background: "#fffdfa",
  color: "#10233a",
  fontSize: "11px",
  boxSizing: "border-box",
};

const warmTextarea: React.CSSProperties = {
  ...warmInput,
  minHeight: "88px",
  resize: "vertical",
  fontFamily: "inherit",
};

const sectionActions: React.CSSProperties = {
  marginTop: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
};

const employeeEditor: React.CSSProperties = {
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px solid #e4ded4",
};

const sectionMiniHeader: React.CSSProperties = {
  marginBottom: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const documentActionRow: React.CSSProperties = {
  minHeight: "56px",
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  border: "1px solid #e4ded4",
  borderBottom: "none",
  background: "#faf7f2",
};

const documentActionTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "11px",
};

const checkGridWarm: React.CSSProperties = {
  marginTop: "12px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  borderTop: "1px solid #ded7cd",
  borderLeft: "1px solid #ded7cd",
  background: "#faf7f2",
};

const uifEmployeeTable: React.CSSProperties = {
  marginTop: "10px",
  border: "1px solid #d8dee7",
};

const uifEmployeeHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(150px, 1.2fr) minmax(140px, 1fr) 140px 110px 80px 105px",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  textTransform: "uppercase",
};

const uifEmployeeRow: React.CSSProperties = {
  minHeight: "46px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(150px, 1.2fr) minmax(140px, 1fr) 140px 110px 80px 105px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "10px",
};

const uifEmployeeActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
};

const uifEmployeeForm: React.CSSProperties = {
  marginTop: "12px",
  paddingTop: "12px",
  borderTop: "1px solid #e5eaf0",
};

const dangerTextButton: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#b91c1c",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
};

const registrationFormHeader: React.CSSProperties = {
  minHeight: "58px",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  borderBottom: "1px solid #e5eaf0",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
};

const formField: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const formLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 900,
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: "34px",
  padding: "6px 8px",
  border: "1px solid #cbd5e1",
  background: "#f8fbff",
  color: "#10233a",
  fontSize: "11px",
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: "82px",
  resize: "vertical",
  fontFamily: "inherit",
};

const checkGrid: React.CSSProperties = {
  marginBottom: "12px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  borderTop: "1px solid #e5eaf0",
  borderLeft: "1px solid #e5eaf0",
};

const checkField: React.CSSProperties = {
  minHeight: "40px",
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  borderRight: "1px solid #e5eaf0",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "10px",
  fontWeight: 800,
};

const registrationStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  borderBottom: "1px solid #d2d9e2",
};

const registrationStripItem: React.CSSProperties = {
  minHeight: "54px",
  padding: "9px 12px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "4px",
  borderRight: "1px solid #e5eaf0",
};

const registrationStripItemLast: React.CSSProperties = {
  ...registrationStripItem,
  borderRight: "none",
};

const registrationStripValue: React.CSSProperties = {
  color: "#0f1f33",
  fontSize: "12px",
  fontWeight: 900,
};

const registrationBlock: React.CSSProperties = {
  borderBottom: "1px solid #e5eaf0",
};

const registrationSubBlock: React.CSSProperties = {
  padding: "12px",
  borderTop: "1px solid #e5eaf0",
};

const uifNotice: React.CSSProperties = {
  margin: "12px",
  padding: "9px 10px",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a5f",
  fontSize: "10px",
  lineHeight: 1.45,
};

const uifPeopleTable: React.CSSProperties = {
  marginTop: "8px",
  border: "1px solid #d8dee7",
};

const uifPeopleHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns: "minmax(200px, 1.4fr) minmax(160px, 1fr) minmax(200px, 1.2fr) 130px",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  textTransform: "uppercase",
};

const uifPeopleRow: React.CSSProperties = {
  minHeight: "42px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns: "minmax(200px, 1.4fr) minmax(160px, 1fr) minmax(200px, 1.2fr) 130px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "10px",
};

const uifRequirementsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  borderTop: "1px solid #edf0f4",
  borderLeft: "1px solid #edf0f4",
};

const uifRequirement: React.CSSProperties = {
  minHeight: "48px",
  padding: "8px 10px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "4px",
  borderRight: "1px solid #edf0f4",
  borderBottom: "1px solid #edf0f4",
};

const registrationActions: React.CSSProperties = {
  marginTop: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const disabledButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#94a3b8",
  fontSize: "10px",
  fontWeight: 900,
};

const comingSoon: React.CSSProperties = {
  padding: "16px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  color: "#475569",
  fontSize: "11px",
};

const activityGrid: React.CSSProperties = {
  padding: "0 12px 12px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: "30px",
};
