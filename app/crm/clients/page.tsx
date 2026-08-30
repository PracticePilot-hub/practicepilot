"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const supabaseAny = supabase as any;

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

export default function CRMClientsPage() {
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function loadClients() {
      setLoading(true);
      setLoadError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabaseAny.auth.getUser();

        if (userError || !user) {
          throw new Error("Your PracticePilot login could not be confirmed.");
        }

        const { data: profile, error: profileError } = await supabaseAny
          .from("user_profiles")
          .select("organisation_id, access_enabled")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile?.access_enabled) {
          throw new Error("Your PracticePilot access is disabled.");
        }
        if (!profile?.organisation_id) {
          throw new Error("Your user profile is not linked to an organisation.");
        }

        const { data, error } = await supabaseAny
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
          .eq("organisation_id", profile.organisation_id)
          .order("client_name", { ascending: true });

        if (error) throw error;

        setClients(
          ((data || []) as CRMClient[]).filter((client) =>
            client.client_name?.trim()
          )
        );
      } catch (error) {
        console.error("Could not load CRM clients:", error);
        setLoadError(
          error instanceof Error ? error.message : "Could not load CRM clients."
        );
        setClients([]);
      } finally {
        setLoading(false);
      }
    }

    loadClients();
  }, []);

  return (
    <div style={page}>
      <div style={sectionTopBar}>
        <div>
          <div style={eyebrow}>Clients</div>
          <div style={sectionTitle}>Client Directory</div>
          <div style={sectionSubtitle}>
            Open a client home to manage the relationship, work and compliance.
          </div>
        </div>

        <Link href="/crm/new-client" style={primaryButton}>
          Add New Client
        </Link>
      </div>

      {loadError ? (
        <div style={errorBox}>{loadError}</div>
      ) : (
        <section style={panel}>
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
                {loading ? (
                  <tr>
                    <td style={emptyCell} colSpan={4}>
                      Loading clients...
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => {
                    const primaryContact =
                      client.crm_client_contacts?.find(
                        (contact) => contact.is_primary
                      ) ||
                      client.crm_client_contacts?.[0] ||
                      null;

                    return (
                      <tr key={client.id}>
                        <td style={tdClient}>
                          <span style={clientInitials}>
                            {client.client_name
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase())
                              .join("")}
                          </span>
                          <Link
                            href={`/crm/client/${client.id}`}
                            style={clientLink}
                          >
                            {client.client_name}
                          </Link>
                        </td>

                        <td style={td}>
                          {client.registration_number ||
                            client.id_passport_number ||
                            "—"}
                        </td>

                        <td style={td}>
                          {primaryContact?.contact_name || "—"}
                        </td>

                        <td style={tdAction}>
                          <Link
                            href={`/crm/client/${client.id}`}
                            style={viewLink}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}

                {!loading && clients.length === 0 && (
                  <tr>
                    <td style={emptyCell} colSpan={4}>
                      No CRM clients found for your organisation.
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
  padding: "26px 28px 34px",
  background: "#f3f6f6",
  color: "#10233a",
};

const sectionTopBar: React.CSSProperties = {
  minHeight: "80px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "16px",
};

const eyebrow: React.CSSProperties = {
  marginBottom: "5px",
  color: "#3f6b66",
  fontSize: "14px",
  fontWeight: 900,
  letterSpacing: 0,
};

const sectionTitle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: "#10233a",
};

const sectionSubtitle: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "14px",
  color: "#596574",
};

const primaryButton: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 800,
};

const errorBox: React.CSSProperties = {
  padding: "12px 14px",
  border: "1px solid #e4a0a0",
  background: "#fff3f3",
  color: "#9f2d2d",
  fontWeight: 700,
};

const panel: React.CSSProperties = {
  border: "1px solid #d7e0df",
  background: "#ffffff",
};

const tableWrap: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
};

const table: React.CSSProperties = {
  width: "100%",
  tableLayout: "fixed",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "11px 14px",
  background: "#f5f8f8",
  borderBottom: "1px solid #dfe7e6",
  color: "#4f5f6f",
  fontSize: "12px",
  fontWeight: 900,
    };

const thAction: React.CSSProperties = {
  ...th,
  width: "72px",
};

const td: React.CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid #e7eceb",
  verticalAlign: "middle",
  color: "#10233a",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tdClient: React.CSSProperties = {
  ...td,
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontWeight: 800,
};

const clientInitials: React.CSSProperties = {
  width: "30px",
  height: "30px",
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  border: "1px solid #cfe0dd",
  background: "#eaf3f1",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 900,
};

const tdAction: React.CSSProperties = {
  ...td,
  textAlign: "right",
};

const clientLink: React.CSSProperties = {
  minWidth: 0,
  color: "#10233a",
  fontWeight: 900,
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const viewLink: React.CSSProperties = {
  color: "#0f6f67",
  fontWeight: 800,
  textDecoration: "none",
};

const emptyCell: React.CSSProperties = {
  padding: "28px",
  textAlign: "center",
  color: "#657180",
};
