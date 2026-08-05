import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseSecretKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY"
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

type CRMContact = {
  contact_name: string | null;
  is_primary: boolean | null;
};

type CRMClient = {
  id: string;
  client_name: string;
  registration_number: string | null;
  id_passport_number: string | null;
  crm_client_contacts: CRMContact[] | null;
};

export default async function CRMHome() {
  const { data: clients, error } = await supabase
    .from("crm_clients")
    .select(`
      id,
      client_name,
      registration_number,
      id_passport_number,
      crm_client_contacts (
        contact_name,
        is_primary
      )
    `)
    .order("client_name", { ascending: true });

  const safeClients = ((clients || []) as CRMClient[]).filter(
    (client) => client.client_name?.trim()
  );

  return (
    <div style={page}>
      <div style={workingFileBar}>
        <div style={workingFileLabel}>CRM WORKING FILE</div>
        <div style={divider}>|</div>
        <div style={workingFileTitle}>Client Database</div>
        <div style={divider}>|</div>
        <div style={workingFileMeta}>Practice client master</div>

        <div style={countBadge}>{safeClients.length} clients</div>
      </div>

      <div style={sectionTopBar}>
        <div>
          <div style={sectionTitle}>Client Database</div>
          <div style={sectionSubtitle}>
            Maintain the practice client master list.
          </div>
        </div>

        <Link href="/crm/new-client" style={primaryButton}>
          Add New Client
        </Link>
      </div>

      {error ? (
        <div style={errorBox}>{error.message}</div>
      ) : (
        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <h1 style={heading}>Clients</h1>
              <p style={headingSubtext}>
                Select a client to open and maintain its full record.
              </p>
            </div>
          </div>

          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Client Name</th>
                  <th style={th}>Registration / ID Number</th>
                  <th style={th}>Primary Contact</th>
                  <th style={thAction}></th>
                </tr>
              </thead>

              <tbody>
                {safeClients.map((client) => {
                  const primaryContact =
                    client.crm_client_contacts?.find(
                      (contact) => contact.is_primary
                    ) ||
                    client.crm_client_contacts?.[0] ||
                    null;

                  return (
                    <tr key={client.id}>
                      <td style={tdClient}>{client.client_name}</td>

                      <td style={td}>
                        {client.registration_number ||
                          client.id_passport_number ||
                          "-"}
                      </td>

                      <td style={td}>
                        {primaryContact?.contact_name || "-"}
                      </td>

                      <td style={tdAction}>
                        <Link
                          href={`/crm/edit-client?id=${client.id}`}
                          style={editLink}
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {safeClients.length === 0 && (
                  <tr>
                    <td style={emptyCell} colSpan={4}>
                      No CRM clients found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
  minHeight: "42px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "0 10px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const workingFileLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  color: "#1d4ed8",
};

const divider: React.CSSProperties = {
  color: "#94a3b8",
};

const workingFileTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#111827",
};

const workingFileMeta: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
};

const countBadge: React.CSSProperties = {
  marginLeft: "auto",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#e8eefc",
  color: "#1d4ed8",
  fontSize: "11px",
  fontWeight: 800,
};

const sectionTopBar: React.CSSProperties = {
  minHeight: "58px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginTop: "8px",
  padding: "10px 12px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 800,
  color: "#111827",
};

const sectionSubtitle: React.CSSProperties = {
  marginTop: "3px",
  fontSize: "12px",
  color: "#64748b",
};

const primaryButton: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  border: "1px solid #0f172a",
  borderRadius: 0,
  background: "#0f172a",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};

const errorBox: React.CSSProperties = {
  padding: "12px 14px",
  marginTop: "8px",
  border: "1px solid #dc2626",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 700,
};

const panel: React.CSSProperties = {
  marginTop: "8px",
  border: "1px solid #d2d9e2",
  borderRadius: 0,
  background: "#ffffff",
};

const panelHeader: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #d2d9e2",
};

const heading: React.CSSProperties = {
  margin: 0,
  fontSize: "22px",
  fontWeight: 500,
  color: "#111827",
};

const headingSubtext: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "13px",
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#f7f8fa",
  borderBottom: "1px solid #d2d9e2",
  color: "#475569",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const thAction: React.CSSProperties = {
  ...th,
  width: "72px",
};

const td: React.CSSProperties = {
  padding: "9px 12px",
  borderBottom: "1px solid #e5eaf0",
  verticalAlign: "middle",
  color: "#10233a",
};

const tdClient: React.CSSProperties = {
  ...td,
  fontWeight: 800,
  color: "#0f2942",
};

const tdAction: React.CSSProperties = {
  ...td,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const editLink: React.CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 800,
  textDecoration: "none",
};

const emptyCell: React.CSSProperties = {
  padding: "24px",
  textAlign: "center",
  color: "#64748b",
};
