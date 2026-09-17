"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  client_category: "individual" | "entity" | "trust" | null;
  engagement_type:
    | "ongoing_monthly"
    | "annual_monthly_retainer"
    | "annual_ad_hoc"
    | null;
  status: string | null;
  relationship_status:
    | "flying_client"
    | "in_airspace"
    | "on_radar"
    | "former_client";
  closed_at: string | null;
  crm_client_contacts: CRMContact[] | null;
};

type RelationshipFilter =
  | "all"
  | "ongoing_monthly"
  | "annual_monthly_retainer"
  | "annual_ad_hoc";

type CategoryFilter = "all" | "individual" | "entity" | "trust";
type AirspaceFilter =
  | "flying_client"
  | "in_airspace"
  | "on_radar"
  | "former_client"
  | "all";

const relationshipLabels: Record<string, string> = {
  ongoing_monthly: "Ongoing monthly",
  annual_monthly_retainer: "Annual – monthly retainer",
  annual_ad_hoc: "Annual – ad hoc",
};

const categoryLabels: Record<string, string> = {
  individual: "Individual",
  entity: "Entity",
  trust: "Trust",
};

const airspaceLabels: Record<string, string> = {
  flying_client: "Flying Client",
  in_airspace: "In Airspace",
  on_radar: "On Radar",
  former_client: "Former Client",
};

function normaliseStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export default function CRMClientsPage() {
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [relationshipFilter, setRelationshipFilter] =
    useState<RelationshipFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("all");
  const [airspaceFilter, setAirspaceFilter] =
    useState<AirspaceFilter>("flying_client");

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
            client_category,
            engagement_type,
            status,
            relationship_status,
            closed_at,
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

  const summary = useMemo(() => {
    return {
      flying: clients.filter(
        (client) => client.relationship_status === "flying_client"
      ).length,
      airspace: clients.filter(
        (client) => client.relationship_status === "in_airspace"
      ).length,
      radar: clients.filter(
        (client) => client.relationship_status === "on_radar"
      ).length,
      former: clients.filter(
        (client) => client.relationship_status === "former_client"
      ).length,
    };
  }, [clients]);

  const filteredClients = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return clients.filter((client) => {
      if (
        airspaceFilter !== "all" &&
        client.relationship_status !== airspaceFilter
      ) {
        return false;
      }

      if (
        relationshipFilter !== "all" &&
        client.engagement_type !== relationshipFilter
      ) {
        return false;
      }

      if (
        categoryFilter !== "all" &&
        client.client_category !== categoryFilter
      ) {
        return false;
      }

      if (searchValue) {
        const primaryContact =
          client.crm_client_contacts?.find((contact) => contact.is_primary) ||
          client.crm_client_contacts?.[0] ||
          null;

        const haystack = [
          client.client_name,
          client.registration_number,
          client.id_passport_number,
          primaryContact?.contact_name,
          relationshipLabels[client.engagement_type || ""],
          categoryLabels[client.client_category || ""],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(searchValue)) return false;
      }

      return true;
    });
  }, [clients, search, relationshipFilter, categoryFilter, airspaceFilter]);

  return (
    <div style={page}>
      <div style={sectionTopBar}>
        <div>
          <div style={sectionTitle}>Practice Airspace</div>
          <div style={sectionSubtitle}>
            Flying Clients, people and entities in your airspace, opportunities on radar and former clients.
          </div>
        </div>

        <Link href="/crm/new-client" style={primaryButton}>
          Add New Client
        </Link>
      </div>

      <section style={summaryStrip}>
        {[
          ["flying_client", "Flying Clients", summary.flying],
          ["in_airspace", "In Airspace", summary.airspace],
          ["on_radar", "On Radar", summary.radar],
          ["former_client", "Former Clients", summary.former],
        ].map(([value, label, count]) => (
          <button
            key={String(value)}
            type="button"
            style={{
              ...summaryCell,
              ...(airspaceFilter === value ? summaryCellActive : {}),
            }}
            onClick={() => setAirspaceFilter(value as AirspaceFilter)}
          >
            <span style={summaryLabel}>{label}</span>
            <strong style={summaryValue}>{count}</strong>
          </button>
        ))}
      </section>

      <section style={filterBar}>
        <input
          style={searchInput}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search client, registration / ID or contact..."
        />

        <select
          style={filterSelect}
          value={relationshipFilter}
          onChange={(event) =>
            setRelationshipFilter(event.target.value as RelationshipFilter)
          }
        >
          <option value="all">All service relationships</option>
          <option value="ongoing_monthly">Ongoing monthly</option>
          <option value="annual_monthly_retainer">
            Annual – monthly retainer
          </option>
          <option value="annual_ad_hoc">Annual – ad hoc</option>
        </select>

        <select
          style={filterSelect}
          value={categoryFilter}
          onChange={(event) =>
            setCategoryFilter(event.target.value as CategoryFilter)
          }
        >
          <option value="all">All record types</option>
          <option value="individual">Individuals</option>
          <option value="entity">Entities</option>
          <option value="trust">Trusts</option>
        </select>

        <select
          style={filterSelect}
          value={airspaceFilter}
          onChange={(event) =>
            setAirspaceFilter(event.target.value as AirspaceFilter)
          }
        >
          <option value="flying_client">Flying Clients</option>
          <option value="in_airspace">In Airspace</option>
          <option value="on_radar">On Radar</option>
          <option value="former_client">Former Clients</option>
          <option value="all">All Practice Airspace</option>
        </select>

        <button
          type="button"
          style={resetButton}
          onClick={() => {
            setSearch("");
            setRelationshipFilter("all");
            setCategoryFilter("all");
            setAirspaceFilter("flying_client");
          }}
        >
          Reset
        </button>
      </section>

      {loadError ? (
        <div style={errorBox}>{loadError}</div>
      ) : (
        <section style={panel}>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Client Name</th>
                  <th style={th}>Record Type</th>
                  <th style={th}>Service Relationship</th>
                  <th style={th}>Registration / ID Number</th>
                  <th style={th}>Primary Contact</th>
                  <th style={th}>PracticePilot Relationship</th>
                  <th style={thAction}></th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td style={emptyCell} colSpan={7}>
                      Loading clients...
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const primaryContact =
                      client.crm_client_contacts?.find(
                        (contact) => contact.is_primary
                      ) ||
                      client.crm_client_contacts?.[0] ||
                      null;

                    const relationshipLabel =
                      airspaceLabels[client.relationship_status] || "—";

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
                          {categoryLabels[client.client_category || ""] || "—"}
                        </td>

                        <td style={td}>
                          {relationshipLabels[client.engagement_type || ""] || "—"}
                        </td>

                        <td style={td}>
                          {client.registration_number ||
                            client.id_passport_number ||
                            "—"}
                        </td>

                        <td style={td}>
                          {primaryContact?.contact_name || "—"}
                        </td>

                        <td style={td}>
                          <span
                            style={{
                              ...statusPill,
                              ...(client.relationship_status === "former_client"
                                ? statusPillFormer
                                : client.relationship_status === "on_radar"
                                  ? statusPillRadar
                                  : client.relationship_status === "in_airspace"
                                    ? statusPillAirspace
                                    : statusPillActive),
                            }}
                          >
                            {relationshipLabel}
                          </span>
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

                {!loading && filteredClients.length === 0 && (
                  <tr>
                    <td style={emptyCell} colSpan={7}>
                      No clients match these filters.
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
  padding: "18px 20px 28px",
  background: "#f3f6f6",
  color: "#10233a",
};

const sectionTopBar: React.CSSProperties = {
  minHeight: "60px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "8px",
};

const eyebrow: React.CSSProperties = {
  marginBottom: "5px",
  color: "#3f6b66",
  fontSize: "14px",
  fontWeight: 900,
  letterSpacing: 0,
};

const sectionTitle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: "#10233a",
};

const sectionSubtitle: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "12px",
  color: "#596574",
};

const primaryButton: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 11px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "10px",
  fontWeight: 800,
};

const summaryStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  marginBottom: "10px",
  border: "1px solid #d7e0df",
  background: "#ffffff",
};

const summaryCell: React.CSSProperties = {
  minHeight: "48px",
  padding: "7px 10px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "3px",
  border: "none",
  borderRight: "1px solid #e5eae9",
  background: "#ffffff",
  color: "#10233a",
  textAlign: "left",
  cursor: "pointer",
};

const summaryCellActive: React.CSSProperties = {
  background: "#10233a",
  color: "#ffffff",
};

const summaryLabel: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 800,
};

const summaryValue: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 900,
};

const filterBar: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1.3fr) 230px 180px 170px 70px",
  gap: "8px",
  alignItems: "center",
  marginBottom: "10px",
};

const searchInput: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  border: "1px solid #cfd8d7",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
};

const filterSelect: React.CSSProperties = {
  ...searchInput,
};

const resetButton: React.CSSProperties = {
  minHeight: "36px",
  padding: "0 10px",
  border: "1px solid #cfd8d7",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 800,
  cursor: "pointer",
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
  fontSize: "12px",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "7px 9px",
  background: "#f5f8f8",
  borderBottom: "1px solid #dfe7e6",
  color: "#4f5f6f",
  fontSize: "9px",
  fontWeight: 900,
};

const thAction: React.CSSProperties = {
  ...th,
  width: "60px",
};

const td: React.CSSProperties = {
  padding: "7px 9px",
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
  gap: "9px",
  fontWeight: 800,
};

const clientInitials: React.CSSProperties = {
  width: "24px",
  height: "24px",
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  border: "1px solid #cfe0dd",
  background: "#eaf3f1",
  color: "#10233a",
  fontSize: "8px",
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

const statusPill: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 7px",
  fontSize: "8px",
  fontWeight: 850,
};

const statusPillActive: React.CSSProperties = {
  border: "1px solid #b7d7c1",
  background: "#edf7f0",
  color: "#2f7047",
};

const statusPillFormer: React.CSSProperties = {
  border: "1px solid #d7dde2",
  background: "#f4f6f7",
  color: "#6a7680",
};

const statusPillAirspace: React.CSSProperties = {
  border: "1px solid #bfd1df",
  background: "#f0f6fa",
  color: "#345b75",
};

const statusPillRadar: React.CSSProperties = {
  border: "1px solid #e3cf9f",
  background: "#fff8e8",
  color: "#8a621c",
};

const emptyCell: React.CSSProperties = {
  padding: "28px",
  textAlign: "center",
  color: "#657180",
};
