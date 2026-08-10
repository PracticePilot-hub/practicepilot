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
  searchParams: Promise<{ tab?: string; secretarialView?: string }>;
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

export default async function ClientWorkingFilePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { tab, secretarialView } = await searchParams;

  const allowedTabs = [
    "overview",
    "services",
    "tasks",
    "people",
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
      .from("crm_tasks")
      .select(
        "id, task_title, service_name, task_status, due_date, period_start, period_end, ready_for_review_at"
      )
      .eq("client_id", id)
      .neq("task_status", "Completed")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(12),

    supabase
      .from("crm_directors")
      .select(
        "id, full_name, id_passport_number, email, phone, appointment_date, resignation_date, is_active"
      )
      .eq("client_id", id)
      .order("full_name"),

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
  ]);

  const client = clientResult.data;

  if (!client) notFound();

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

  const activeServices = services.filter((service) => service.is_active !== false);
  const primaryContact =
    contacts.find((contact) => contact.is_primary) || contacts[0] || null;

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

  const queryErrors = [
    contactsResult.error,
    addressesResult.error,
    servicesResult.error,
    tasksResult.error,
    directorsResult.error,
    shareholdersResult.error,
    mattersResult.error,
    certificatesResult.error,
    shareClassesResult.error,
    transactionsResult.error,
  ].filter(Boolean);

  return (
    <div style={page}>
      <div style={workingFileBar}>
        <span style={workingFileLabel}>CLIENT WORKING FILE</span>
        <span style={divider}>|</span>
        <Link href="/crm" style={crumbLink}>
          Client Database
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

      {queryErrors.length > 0 ? (
        <div style={warningBar}>
          The client loaded, but one or more related sections could not be
          retrieved. We can fix the affected section without losing the client
          record.
        </div>
      ) : null}

      <nav style={sectionNav}>
        {[
          ["overview", "Overview"],
          ["services", "Services"],
          ["tasks", "Tasks"],
          ["people", "People"],
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

            {activeTab === "overview" ? (
<section id="overview" style={panel}>
        <PanelHeader
          number="01"
          title="Overview"
          subtitle="The core client information that drives PracticePilot."
        />

        <div style={twoColumn}>
          <div style={detailSection}>
            <h3 style={miniHeading}>Entity details</h3>

            <DetailRow label="Legal name" value={client.client_name} />
            <DetailRow label="Trading name" value={client.trading_name} />
            <DetailRow label="Entity type" value={client.entity_type} />
            <DetailRow label="Registration / ID" value={registrationOrId} />
            <DetailRow
              label="Registration date"
              value={formatDate(client.registration_date)}
            />
            <DetailRow label="Financial year-end" value={client.year_end} />
          </div>

          <div style={detailSection}>
            <h3 style={miniHeading}>Tax & statutory numbers</h3>

            <DetailRow label="Income tax" value={client.tax_number} />
            <DetailRow label="VAT" value={client.vat_number} />
            <DetailRow label="PAYE" value={client.paye_number} />
            <DetailRow
              label="UIF"
              value={client.uif_registration_number}
            />
            <DetailRow
              label="Compensation Fund"
              value={client.wcc_reference_number}
            />
            <DetailRow label="Customs" value={client.customs_number} />
          </div>
        </div>

        <div style={twoColumn}>
          <div style={detailSection}>
            <h3 style={miniHeading}>Primary contact</h3>

            {primaryContact ? (
              <>
                <DetailRow
                  label="Name"
                  value={primaryContact.contact_name}
                />
                <DetailRow
                  label="Position"
                  value={primaryContact.contact_position}
                />
                <DetailRow label="Email" value={primaryContact.email} />
                <DetailRow
                  label="Telephone"
                  value={primaryContact.mobile || primaryContact.phone}
                />
              </>
            ) : (
              <EmptyState text="No contact captured yet." />
            )}
          </div>

          <div style={detailSection}>
            <h3 style={miniHeading}>Addresses</h3>

            {addresses.length ? (
              addresses.map((address) => (
                <div key={address.id} style={addressBlock}>
                  <strong style={addressType}>{address.address_type}</strong>
                  <div>{valueOrDash(address.line_1)}</div>
                  {address.line_2 ? <div>{address.line_2}</div> : null}
                  <div>
                    {[address.city, address.province, address.postal_code]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </div>
                  {address.country ? <div>{address.country}</div> : null}
                </div>
              ))
            ) : (
              <EmptyState text="No addresses captured yet." />
            )}
          </div>
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
            {tasks.map((task) => (
              <div key={task.id} style={taskRow}>
                <div style={taskMain}>
                  <strong style={rowTitle}>{task.task_title}</strong>
                  <span style={rowMeta}>
                    {task.service_name || "General task"}
                  </span>
                </div>

                <div style={taskDue}>
                  <span style={statusPill}>
                    {formatStatus(task.task_status)}
                  </span>
                  <span style={smallMuted}>
                    Due: {formatDate(task.due_date)}
                  </span>
                </div>

                <Link href={`/crm/tasks/${task.id}`} style={textLink}>
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
                    <strong style={rowTitle}>{director.full_name}</strong>
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

            {activeTab === "secretarial" ? (
              <section id="secretarial" style={panel}>
                <PanelHeader
                  number="05"
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
                    <div style={ownershipGrid}>
                      {issuedHoldings.map((holding) => {
                        const percentage =
                          totalIssuedShares > 0
                            ? (holding.shares / totalIssuedShares) * 100
                            : 0;

                        return (
                          <div
                            key={`${holding.shareholderId}-${holding.className}`}
                            style={ownershipCard}
                          >
                            <div style={ownershipTop}>
                              <strong style={ownershipName}>
                                {holding.shareholderName}
                              </strong>
                              <strong style={ownershipPercent}>
                                {percentage.toFixed(2)}%
                              </strong>
                            </div>

                            <div style={ownershipMeta}>{holding.className}</div>
                            <div style={ownershipShares}>
                              {holding.shares.toLocaleString("en-ZA")} shares
                            </div>

                            <div style={ownershipBar}>
                              <div
                                style={{
                                  ...ownershipBarFill,
                                  width: `${Math.min(100, Math.max(0, percentage))}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
