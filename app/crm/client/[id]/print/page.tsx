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
};

type ServiceRow = {
  id: string;
  frequency: string | null;
  is_active: boolean | null;
  crm_services:
    | { service_name: string; service_group: string | null }
    | Array<{ service_name: string; service_group: string | null }>
    | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function v(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function date(value: string | null | undefined) {
  if (!value) return "—";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export default async function ClientPrintPage({ params }: PageProps) {
  const { id } = await params;

  const [
    clientResult,
    contactsResult,
    addressesResult,
    servicesResult,
    directorsResult,
    shareholdersResult,
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
          crm_services (
            service_name,
            service_group
          )
        `
      )
      .eq("client_id", id)
      .eq("is_active", true),

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
  ]);

  const client = clientResult.data;
  if (!client) notFound();

  const contacts = contactsResult.data || [];
  const addresses = addressesResult.data || [];
  const services = (servicesResult.data || []) as ServiceRow[];
  const directors = directorsResult.data || [];
  const shareholders = shareholdersResult.data || [];

  const primaryContact =
    contacts.find((contact) => contact.is_primary) || contacts[0] || null;

  const registrationOrId =
    client.registration_number || client.id_passport_number || "—";

  const generatedDate = new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          html, body {
            background: #ffffff !important;
          }

          .no-print {
            display: none !important;
          }

          .print-shell {
            padding: 0 !important;
            background: #ffffff !important;
          }

          .page-break-before {
            break-before: page;
            page-break-before: always;
          }

          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="no-print" style={toolbar}>
        <Link href={`/crm/client/${id}`} style={backButton}>
          ← Back to Client
        </Link>

        <div style={toolbarTitle}>
          Client Confirmation — {client.client_name}
        </div>

        <button id="print-client-file" type="button" style={printButton}>
          Print / Save PDF
        </button>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener("DOMContentLoaded", function () {
              var button = document.getElementById("print-client-file");
              if (button) {
                button.addEventListener("click", function () {
                  window.print();
                });
              }
            });
          `,
        }}
      />

      <main className="print-shell" style={shell}>
        <section style={document}>
          <header style={documentHeader}>
            <div>
              <div style={brand}>PracticePilot</div>
              <div style={documentType}>CLIENT INFORMATION CONFIRMATION</div>
            </div>

            <div style={documentControl}>
              <div>Prepared: {generatedDate}</div>
              <div>Client code: {v(client.client_code)}</div>
            </div>
          </header>

          <section style={clientBanner}>
            <h1 style={clientName}>{client.client_name}</h1>
            {client.trading_name ? (
              <div style={tradingName}>Trading as {client.trading_name}</div>
            ) : null}

            <div style={clientMeta}>
              <span>{v(client.entity_type)}</span>
              <span>•</span>
              <span>{registrationOrId}</span>
              {client.year_end ? (
                <>
                  <span>•</span>
                  <span>Financial year-end: {client.year_end}</span>
                </>
              ) : null}
            </div>
          </section>

          <section className="avoid-break" style={section}>
            <SectionTitle number="01" title="Entity details" />

            <div style={twoCols}>
              <Info label="Legal name" value={client.client_name} />
              <Info label="Trading name" value={client.trading_name} />
              <Info label="Entity type" value={client.entity_type} />
              <Info label="Registration / ID number" value={registrationOrId} />
              <Info
                label="Registration date"
                value={date(client.registration_date)}
              />
              <Info label="Financial year-end" value={client.year_end} />
              <Info label="Client status" value={client.status} />
              <Info label="Internal client code" value={client.client_code} />
            </div>
          </section>

          <section className="avoid-break" style={section}>
            <SectionTitle number="02" title="Tax & statutory registrations" />

            <div style={twoCols}>
              <Info label="Income tax number" value={client.tax_number} />
              <Info label="VAT number" value={client.vat_number} />
              <Info label="PAYE number" value={client.paye_number} />
              <Info
                label="UIF registration number"
                value={client.uif_registration_number}
              />
              <Info
                label="Compensation Fund reference"
                value={client.wcc_reference_number}
              />
              <Info label="Customs number" value={client.customs_number} />
              <Info
                label="SDL registered"
                value={
                  client.sdl_registered === true
                    ? "Yes"
                    : client.sdl_registered === false
                      ? "No"
                      : "—"
                }
              />
              <Info label="Trust deed number" value={client.trust_deed_number} />
            </div>
          </section>

          <section className="avoid-break" style={section}>
            <SectionTitle number="03" title="Contact details" />

            {primaryContact ? (
              <div style={twoCols}>
                <Info label="Primary contact" value={primaryContact.contact_name} />
                <Info label="Position" value={primaryContact.contact_position} />
                <Info label="Email" value={primaryContact.email} />
                <Info
                  label="Telephone"
                  value={primaryContact.mobile || primaryContact.phone}
                />
              </div>
            ) : (
              <div style={emptyText}>No primary contact is currently recorded.</div>
            )}

            {contacts.length > 1 ? (
              <>
                <h3 style={subHeading}>Other contacts</h3>
                <div style={simpleTable}>
                  <div style={simpleHeader}>
                    <span>Name</span>
                    <span>Position</span>
                    <span>Email</span>
                    <span>Telephone</span>
                  </div>

                  {contacts
                    .filter((contact) => contact.id !== primaryContact?.id)
                    .map((contact) => (
                      <div key={contact.id} style={simpleRow}>
                        <span>{v(contact.contact_name)}</span>
                        <span>{v(contact.contact_position)}</span>
                        <span>{v(contact.email)}</span>
                        <span>{v(contact.mobile || contact.phone)}</span>
                      </div>
                    ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="avoid-break" style={section}>
            <SectionTitle number="04" title="Addresses" />

            {addresses.length ? (
              <div style={addressGrid}>
                {addresses.map((address) => (
                  <div key={address.id} style={addressCard}>
                    <strong style={addressTitle}>{address.address_type}</strong>
                    <div>{v(address.line_1)}</div>
                    {address.line_2 ? <div>{address.line_2}</div> : null}
                    <div>
                      {[address.city, address.province, address.postal_code]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </div>
                    <div>{v(address.country)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyText}>No addresses are currently recorded.</div>
            )}
          </section>

          <section className="avoid-break" style={section}>
            <SectionTitle number="05" title="Practice services" />

            {services.length ? (
              <div style={simpleTable}>
                <div style={serviceHeader}>
                  <span>Service</span>
                  <span>Group</span>
                  <span>Frequency</span>
                </div>

                {services.map((service) => {
                  const details = one(service.crm_services);

                  return (
                    <div key={service.id} style={serviceRow}>
                      <strong>{details?.service_name || "Unnamed service"}</strong>
                      <span>{v(details?.service_group)}</span>
                      <span>{v(service.frequency)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={emptyText}>No active services are currently assigned.</div>
            )}
          </section>

          <section className="page-break-before" style={section}>
            <SectionTitle number="06" title="Directors / office bearers" />

            {directors.length ? (
              <div style={simpleTable}>
                <div style={directorHeader}>
                  <span>Name</span>
                  <span>ID / Passport</span>
                  <span>Appointed</span>
                  <span>Status</span>
                </div>

                {directors.map((director) => (
                  <div key={director.id} style={directorRow}>
                    <strong>{director.full_name}</strong>
                    <span>{v(director.id_passport_number)}</span>
                    <span>{date(director.appointment_date)}</span>
                    <span>{director.is_active === false ? "Inactive" : "Active"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyText}>
                No directors or office bearers are currently recorded.
              </div>
            )}
          </section>

          <section className="avoid-break" style={section}>
            <SectionTitle number="07" title="Shareholders" />

            {shareholders.length ? (
              <div style={simpleTable}>
                <div style={shareholderHeader}>
                  <span>Shareholder</span>
                  <span>Type</span>
                  <span>ID / Registration</span>
                </div>

                {shareholders.map((shareholder) => (
                  <div key={shareholder.id} style={shareholderRow}>
                    <strong>{shareholder.full_legal_name}</strong>
                    <span>{v(shareholder.holder_type)}</span>
                    <span>{v(shareholder.id_registration_number)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyText}>
                No shareholders are currently recorded.
              </div>
            )}
          </section>

          <section className="avoid-break" style={confirmationBox}>
            <h2 style={confirmationTitle}>Client confirmation and sign-off</h2>

            <p style={confirmationText}>
              I confirm that I have reviewed the information contained in this
              client information confirmation and, except for any corrections
              noted below, confirm that the information is complete and correct
              to the best of my knowledge.
            </p>

            <div style={correctionsBox}>
              <div style={correctionsLabel}>Corrections / comments:</div>
              <div style={writingLine}></div>
              <div style={writingLine}></div>
              <div style={writingLine}></div>
            </div>

            <div style={signatureGrid}>
              <Signature label="Client / authorised representative" />
              <Signature label="Capacity" />
              <Signature label="Signature" />
              <Signature label="Date" />
            </div>
          </section>

          <footer style={footer}>
            <span>PracticePilot Client Information Confirmation</span>
            <span>{client.client_name}</span>
          </footer>
        </section>
      </main>
    </>
  );
}

function SectionTitle({
  number,
  title,
}: {
  number: string;
  title: string;
}) {
  return (
    <div style={sectionTitleRow}>
      <span style={sectionNumber}>{number}</span>
      <h2 style={sectionTitle}>{title}</h2>
    </div>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={infoRow}>
      <span style={infoLabel}>{label}</span>
      <strong style={infoValue}>{v(value)}</strong>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div style={signatureBlock}>
      <div style={signatureLine}></div>
      <div style={signatureLabel}>{label}</div>
    </div>
  );
}

const toolbar: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  minHeight: "58px",
  padding: "8px 14px",
  display: "grid",
  gridTemplateColumns: "180px minmax(0, 1fr) 180px",
  alignItems: "center",
  gap: "12px",
  background: "#0f1f33",
  color: "#ffffff",
  borderBottom: "1px solid #07111f",
};

const toolbarTitle: React.CSSProperties = {
  textAlign: "center",
  fontSize: "13px",
  fontWeight: 900,
};

const backButton: React.CSSProperties = {
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 900,
};

const printButton: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 14px",
  background: "#ffffff",
  color: "#0f1f33",
  border: "1px solid #ffffff",
  borderRadius: 0,
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
};

const shell: React.CSSProperties = {
  minHeight: "100vh",
  padding: "22px",
  background: "#e6ebf0",
};

const document: React.CSSProperties = {
  width: "210mm",
  maxWidth: "100%",
  minHeight: "297mm",
  margin: "0 auto",
  padding: "14mm",
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#111827",
  boxShadow: "0 3px 16px rgba(15, 31, 51, 0.14)",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const documentHeader: React.CSSProperties = {
  minHeight: "52px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  paddingBottom: "10px",
  borderBottom: "2px solid #0f1f33",
};

const brand: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 900,
  color: "#0f1f33",
};

const documentType: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "0.14em",
  color: "#64748b",
};

const documentControl: React.CSSProperties = {
  textAlign: "right",
  color: "#64748b",
  fontSize: "9px",
  lineHeight: 1.7,
};

const clientBanner: React.CSSProperties = {
  padding: "15px 0 12px",
  borderBottom: "1px solid #cbd5e1",
};

const clientName: React.CSSProperties = {
  margin: 0,
  fontSize: "22px",
  lineHeight: 1.15,
  fontWeight: 900,
  color: "#0f1f33",
};

const tradingName: React.CSSProperties = {
  marginTop: "3px",
  color: "#475569",
  fontSize: "11px",
};

const clientMeta: React.CSSProperties = {
  marginTop: "7px",
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  color: "#64748b",
  fontSize: "9px",
};

const section: React.CSSProperties = {
  marginTop: "12px",
};

const sectionTitleRow: React.CSSProperties = {
  minHeight: "28px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  paddingBottom: "5px",
  borderBottom: "1px solid #0f1f33",
};

const sectionNumber: React.CSSProperties = {
  width: "22px",
  height: "22px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0f1f33",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 900,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 900,
  color: "#0f1f33",
};

const twoCols: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: "20px",
};

const infoRow: React.CSSProperties = {
  minHeight: "30px",
  display: "grid",
  gridTemplateColumns: "135px minmax(0, 1fr)",
  alignItems: "center",
  gap: "8px",
  borderBottom: "1px solid #e5e7eb",
};

const infoLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 800,
};

const infoValue: React.CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  fontSize: "9px",
};

const subHeading: React.CSSProperties = {
  margin: "10px 0 5px",
  fontSize: "9px",
  fontWeight: 900,
};

const simpleTable: React.CSSProperties = {
  width: "100%",
  marginTop: "5px",
};

const simpleHeader: React.CSSProperties = {
  minHeight: "25px",
  display: "grid",
  gridTemplateColumns: "1.1fr .8fr 1.2fr .8fr",
  alignItems: "center",
  gap: "8px",
  padding: "0 6px",
  background: "#f1f5f9",
  color: "#475569",
  fontSize: "7px",
  fontWeight: 900,
  textTransform: "uppercase",
};

const simpleRow: React.CSSProperties = {
  minHeight: "28px",
  display: "grid",
  gridTemplateColumns: "1.1fr .8fr 1.2fr .8fr",
  alignItems: "center",
  gap: "8px",
  padding: "0 6px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: "8px",
};

const addressGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  marginTop: "7px",
};

const addressCard: React.CSSProperties = {
  minHeight: "76px",
  padding: "8px",
  border: "1px solid #dbe2ea",
  color: "#334155",
  fontSize: "8px",
  lineHeight: 1.45,
};

const addressTitle: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  color: "#0f1f33",
  fontSize: "8px",
  textTransform: "capitalize",
};

const serviceHeader: React.CSSProperties = {
  ...simpleHeader,
  gridTemplateColumns: "1.5fr 1fr .7fr",
};

const serviceRow: React.CSSProperties = {
  ...simpleRow,
  gridTemplateColumns: "1.5fr 1fr .7fr",
};

const directorHeader: React.CSSProperties = {
  ...simpleHeader,
  gridTemplateColumns: "1.2fr 1fr .8fr .6fr",
};

const directorRow: React.CSSProperties = {
  ...simpleRow,
  gridTemplateColumns: "1.2fr 1fr .8fr .6fr",
};

const shareholderHeader: React.CSSProperties = {
  ...simpleHeader,
  gridTemplateColumns: "1.4fr .7fr 1fr",
};

const shareholderRow: React.CSSProperties = {
  ...simpleRow,
  gridTemplateColumns: "1.4fr .7fr 1fr",
};

const emptyText: React.CSSProperties = {
  padding: "9px 0",
  color: "#64748b",
  fontSize: "8px",
};

const confirmationBox: React.CSSProperties = {
  marginTop: "18px",
  padding: "12px",
  border: "1.5px solid #0f1f33",
};

const confirmationTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 900,
};

const confirmationText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#334155",
  fontSize: "9px",
  lineHeight: 1.55,
};

const correctionsBox: React.CSSProperties = {
  marginTop: "12px",
};

const correctionsLabel: React.CSSProperties = {
  marginBottom: "5px",
  fontSize: "8px",
  fontWeight: 900,
};

const writingLine: React.CSSProperties = {
  height: "23px",
  borderBottom: "1px solid #cbd5e1",
};

const signatureGrid: React.CSSProperties = {
  marginTop: "18px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "24px 30px",
};

const signatureBlock: React.CSSProperties = {
  minHeight: "32px",
};

const signatureLine: React.CSSProperties = {
  height: "20px",
  borderBottom: "1px solid #334155",
};

const signatureLabel: React.CSSProperties = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "7px",
};

const footer: React.CSSProperties = {
  marginTop: "18px",
  paddingTop: "7px",
  display: "flex",
  justifyContent: "space-between",
  gap: "15px",
  borderTop: "1px solid #cbd5e1",
  color: "#94a3b8",
  fontSize: "7px",
};
