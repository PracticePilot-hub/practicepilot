import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseSecretKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

type CRMContact = {
  contact_name: string | null;
  email: string | null;
  is_primary: boolean | null;
};

type CRMClient = {
  id: string;
  client_name: string;
  trading_name: string | null;
  entity_type: string | null;
  registration_number: string | null;
  crm_client_contacts: CRMContact[] | null;
};

export default async function CRMHome() {
  const { data: clients, error } = await supabase
    .from("crm_clients")
    .select(`
      id,
      client_name,
      trading_name,
      entity_type,
      registration_number,
      crm_client_contacts (
        contact_name,
        email,
        is_primary
      )
    `)
    .order("client_name", { ascending: true });

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>CRM</p>
          <h1 style={styles.title}>Client Database</h1>
          <p style={styles.subtitle}>
            Global client master file for PracticePilot.
          </p>
        </div>

        <Link href="/crm/new-client" style={styles.primaryButton}>
          Add New Client
        </Link>
      </section>

      {error ? (
        <div style={styles.errorBox}>{error.message}</div>
      ) : (
        <section style={styles.card}>
          <div style={styles.tableHeader}>
            <h2 style={styles.cardTitle}>Clients</h2>
            <span style={styles.count}>{clients?.length || 0} clients</span>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Entity Type</th>
                  <th style={styles.th}>Registration / ID</th>
                  <th style={styles.th}>Primary Contact</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Services</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>

              <tbody>
                {((clients || []) as CRMClient[]).map((client) => {
                  const primaryContact =
                    client.crm_client_contacts?.find((contact) => contact.is_primary) ||
                    client.crm_client_contacts?.[0] ||
                    null;

                  return (
                    <tr key={client.id}>
                      <td style={styles.td}>
                        <strong>{client.client_name}</strong>
                        {client.trading_name && (
                          <div style={styles.smallText}>
                            Trading as: {client.trading_name}
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>{client.entity_type || "-"}</td>
                      <td style={styles.td}>{client.registration_number || "-"}</td>
                      <td style={styles.td}>{primaryContact?.contact_name || "-"}</td>
                      <td style={styles.td}>{primaryContact?.email || "-"}</td>
                      <td style={styles.td}>-</td>

                      <td style={styles.td}>
                        <Link
                          href={`/crm/edit-client?id=${client.id}`}
                          style={styles.linkButton}
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {(!clients || clients.length === 0) && (
                  <tr>
                    <td style={styles.emptyCell} colSpan={7}>
                      No CRM clients found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f8fc",
    padding: "36px",
    color: "#0b2f4f",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "24px",
    marginBottom: "28px",
  },
  eyebrow: {
    margin: 0,
    color: "#00a6b4",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: "6px 0 0",
    fontSize: "34px",
    letterSpacing: "-0.04em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#526173",
    fontSize: "15px",
  },
  primaryButton: {
    background: "#0b5cab",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "12px",
    padding: "13px 18px",
    fontSize: "14px",
    fontWeight: 900,
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#991b1b",
    padding: "16px",
    borderRadius: "14px",
    fontWeight: 700,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "20px",
    boxShadow: "0 16px 40px rgba(11,47,79,0.08)",
    overflow: "hidden",
  },
  tableHeader: {
    padding: "20px 22px",
    borderBottom: "1px solid #e5edf4",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
  },
  count: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#526173",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: "#f8fbfd",
    borderBottom: "1px solid #e5edf4",
    color: "#526173",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  td: {
    padding: "14px 16px",
    borderBottom: "1px solid #eef3f7",
    verticalAlign: "top",
  },
  smallText: {
    marginTop: "4px",
    color: "#6b7788",
    fontSize: "12px",
  },
  linkButton: {
    color: "#0b5cab",
    fontWeight: 900,
    textDecoration: "none",
  },
  emptyCell: {
    padding: "28px",
    textAlign: "center",
    color: "#6b7788",
  },
};