"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type AFSEngagement = {
  id: string;
  client_name: string;
  entity_type: string | null;
  financial_year_end: string;
  status: string;
  prepared_by: string | null;
  reviewed_by: string | null;
  notes: string | null;
  created_at: string;
  organisation_id?: string | null;
  firm_client_name?: string | null;
};

type Organisation = {
  id: string;
  name: string;
  status: string | null;
  access_enabled: boolean | null;
};

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
  can_access_afs?: boolean | null;
};

function isInternalRole(role: string) {
  return role === "Super Admin" || role === "Admin" || role === "Staff";
}

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return "-";

  return new Date(dateValue).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function normaliseStatus(status: string | null | undefined) {
  const value = String(status || "Draft").trim();
  if (!value) return "Draft";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default function AFSPage() {
  const router = useRouter();

  const [engagements, setEngagements] = useState<AFSEngagement[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [selectedOrganisationId, setSelectedOrganisationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientName, setClientName] = useState("");
  const [entityType, setEntityType] = useState("Company");
  const [financialYearEnd, setFinancialYearEnd] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [notes, setNotes] = useState("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Entity A-Z");

  const internalUser = isInternalRole(profile?.role || "");

  const selectedOrganisation = useMemo(() => {
    return organisations.find((organisation) => organisation.id === selectedOrganisationId) || null;
  }, [organisations, selectedOrganisationId]);

  const visibleEngagements = useMemo(() => {
    let rows = [...engagements];

    if (profile) {
      if (internalUser) {
        if (!selectedOrganisationId) rows = [];
        else if (selectedOrganisationId !== "all") {
          rows = rows.filter((engagement) => engagement.organisation_id === selectedOrganisationId);
        }
      } else {
        rows = rows.filter((engagement) => engagement.organisation_id === profile.organisation_id);
      }
    }

    const search = searchText.trim().toLowerCase();

    if (search) {
      rows = rows.filter((engagement) => {
        const firmClient = engagement.firm_client_name || "";
        return (
          engagement.client_name.toLowerCase().includes(search) ||
          String(engagement.entity_type || "").toLowerCase().includes(search) ||
          String(engagement.financial_year_end || "").toLowerCase().includes(search) ||
          firmClient.toLowerCase().includes(search)
        );
      });
    }

    if (statusFilter !== "All") {
      rows = rows.filter((engagement) => normaliseStatus(engagement.status) === statusFilter);
    }

    rows.sort((a, b) => {
      if (sortBy === "Entity A-Z") return a.client_name.localeCompare(b.client_name);
      if (sortBy === "Entity Z-A") return b.client_name.localeCompare(a.client_name);
      if (sortBy === "Year end newest") {
        return new Date(b.financial_year_end).getTime() - new Date(a.financial_year_end).getTime();
      }
      if (sortBy === "Year end oldest") {
        return new Date(a.financial_year_end).getTime() - new Date(b.financial_year_end).getTime();
      }
      if (sortBy === "Newest created") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "Oldest created") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });

    return rows;
  }, [engagements, selectedOrganisationId, profile, internalUser, searchText, statusFilter, sortBy]);

  async function loadPage() {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profileData) {
        alert("Could not load your user profile.");
        window.location.href = "/login";
        return;
      }

      if (!profileData.access_enabled || !profileData.can_access_afs) {
        alert("You do not have access to Annual Financial Statements.");
        window.location.href = "/dashboard";
        return;
      }

      setProfile(profileData);

      const internal = isInternalRole(profileData.role || "");

      const organisationsResponse = await fetch("/api/organisations", { cache: "no-store" });
      const organisationsData = await organisationsResponse.json();

      if (!organisationsResponse.ok) {
        throw new Error(organisationsData.error || "Could not load firms/clients.");
      }

      const loadedOrganisations: Organisation[] = organisationsData.organisations || [];
      setOrganisations(loadedOrganisations);

      const engagementsResponse = await fetch("/api/afs/engagements", { cache: "no-store" });
      const engagementsData = await engagementsResponse.json();

      if (!engagementsResponse.ok) {
        throw new Error(engagementsData.error || "Could not load AFS engagements.");
      }

      setEngagements(engagementsData.engagements || []);

      if (internal) {
        const bizzacc = loadedOrganisations.find((organisation) =>
          organisation.name.toLowerCase().includes("bizzacc menlyn")
        );
        setSelectedOrganisationId(bizzacc?.id || loadedOrganisations[0]?.id || "");
      } else {
        setSelectedOrganisationId(profileData.organisation_id || "");
      }
    } catch (error: any) {
      alert(error.message || "Failed to load AFS engagements.");
    } finally {
      setLoading(false);
    }
  }

  async function createEngagement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedOrganisationId || selectedOrganisationId === "all") {
      alert("Please choose a specific firm/client first.");
      return;
    }

    if (!clientName.trim()) {
      alert("Client name is required.");
      return;
    }

    if (!financialYearEnd) {
      alert("Financial year end is required.");
      return;
    }

    setSaving(true);

    try {
      const firmClient = organisations.find((organisation) => organisation.id === selectedOrganisationId) || null;

      const res = await fetch("/api/afs/engagements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientName,
          entityType,
          financialYearEnd,
          preparedBy,
          reviewedBy,
          notes,
          organisationId: selectedOrganisationId,
          firmClientName: firmClient?.name || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create AFS engagement.");
      }

      setClientName("");
      setEntityType("Company");
      setFinancialYearEnd("");
      setPreparedBy("");
      setReviewedBy("");
      setNotes("");

      router.push(`/afs/${data.engagement.id}`);
    } catch (error: any) {
      alert(error.message || "Failed to create AFS engagement.");
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setSearchText("");
    setStatusFilter("All");
    setSortBy("Entity A-Z");
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.emptyState}>Loading AFS engagements...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.heroPanel}>
        <div>
          <div style={styles.kicker}>PracticePilot</div>
          <h1 style={styles.title}>Annual Financial Statements</h1>
        </div>

        <p style={styles.heroText}>
          Create and manage AFS engagements, trial balances, lead schedules, statements and final file packs.
        </p>
      </section>

      <div style={styles.layoutGrid}>
        <aside style={styles.leftPanel}>
          <h2 style={styles.panelTitle}>Firm control</h2>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Working firm / client</label>
            {internalUser ? (
              <select
                style={styles.input}
                value={selectedOrganisationId}
                onChange={(e) => {
                  setSelectedOrganisationId(e.target.value);
                  setSearchText("");
                }}
              >
                <option value="">Choose firm/client</option>
                <option value="all">All firms / clients</option>
                {organisations.map((organisation) => (
                  <option key={organisation.id} value={organisation.id}>
                    {organisation.name}
                    {organisation.access_enabled === false ? " - Suspended" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div style={styles.lockedClientBox}>
                {selectedOrganisation?.name || profile?.organisation_id || "Client"}
              </div>
            )}
          </div>

          <div style={styles.infoBox}>
            {selectedOrganisationId === "all" ? (
              <>
                <strong>All firms / clients</strong>
                <span>Showing all AFS engagements</span>
              </>
            ) : selectedOrganisation ? (
              <>
                <strong>{selectedOrganisation.name}</strong>
                <span>
                  {selectedOrganisation.status || "Active"} ·{" "}
                  {selectedOrganisation.access_enabled === false ? "Access blocked" : "Access enabled"}
                </span>
              </>
            ) : (
              <>
                <strong>Choose firm/client</strong>
                <span>No firm/client selected</span>
              </>
            )}
          </div>

          <form onSubmit={createEngagement} style={styles.createForm}>
            <h2 style={styles.panelTitle}>New AFS engagement</h2>

            <label style={styles.labelBlock}>
              Client name
              <input
                style={styles.input}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Example: ABC Trading (Pty) Ltd"
              />
            </label>

            <label style={styles.labelBlock}>
              Entity type
              <select
                style={styles.input}
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
              >
                <option value="Company">Company</option>
                <option value="Close Corporation">Close Corporation</option>
                <option value="Trust">Trust</option>
                <option value="Sole Proprietor">Sole Proprietor</option>
                <option value="Partnership">Partnership</option>
                <option value="Non-Profit Company">Non-Profit Company</option>
              </select>
            </label>

            <label style={styles.labelBlock}>
              Financial year end
              <input
                style={styles.input}
                type="date"
                value={financialYearEnd}
                onChange={(e) => setFinancialYearEnd(e.target.value)}
              />
            </label>

            <label style={styles.labelBlock}>
              Prepared by
              <input
                style={styles.input}
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label style={styles.labelBlock}>
              Reviewed by
              <input
                style={styles.input}
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label style={styles.labelBlock}>
              Notes
              <textarea
                style={{ ...styles.input, height: 58, paddingTop: 7, resize: "vertical" }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional internal notes"
              />
            </label>

            <button type="submit" style={styles.primaryButtonFull} disabled={saving}>
              {saving ? "Creating..." : "Create AFS engagement"}
            </button>
          </form>
        </aside>

        <section style={styles.rightPanel}>
          <div style={styles.tableHeaderRow}>
            <div>
              <h2 style={styles.panelTitle}>
                {selectedOrganisationId === "all"
                  ? "All AFS engagements"
                  : `${selectedOrganisation?.name || "AFS"} AFS engagements`}
              </h2>
              <p style={styles.resultText}>Showing {visibleEngagements.length} of {engagements.length} engagement(s)</p>
            </div>

            <button style={styles.clearButton} onClick={clearFilters}>
              Clear filters
            </button>
          </div>

          <div style={styles.filtersGrid}>
            <div style={styles.fieldGroupCompact}>
              <label style={styles.label}>Entity / year end</label>
              <input
                style={styles.input}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search engagement..."
              />
            </div>

            <div style={styles.fieldGroupCompact}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="Draft">Draft</option>
                <option value="Final">Final</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div style={styles.fieldGroupCompact}>
              <label style={styles.label}>Sort by</label>
              <select style={styles.input} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="Entity A-Z">Entity A-Z</option>
                <option value="Entity Z-A">Entity Z-A</option>
                <option value="Year end newest">Year end newest</option>
                <option value="Year end oldest">Year end oldest</option>
                <option value="Newest created">Newest created</option>
                <option value="Oldest created">Oldest created</option>
              </select>
            </div>
          </div>

          {visibleEngagements.length === 0 ? (
            <div style={styles.emptyState}>No AFS engagements found for the current selection.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Entity</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Year end</th>
                    <th style={styles.th}>Firm / client</th>
                    <th style={styles.th}>Prepared</th>
                    <th style={styles.th}>Reviewed</th>
                    <th style={styles.th}>Status</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleEngagements.map((engagement) => (
                    <tr key={engagement.id}>
                      <td style={styles.tdStrong}>{engagement.client_name}</td>
                      <td style={styles.td}>{engagement.entity_type || "Entity"}</td>
                      <td style={styles.td}>{formatDate(engagement.financial_year_end)}</td>
                      <td style={styles.td}>{engagement.firm_client_name || "Not allocated"}</td>
                      <td style={styles.td}>{engagement.prepared_by || "-"}</td>
                      <td style={styles.td}>{engagement.reviewed_by || "-"}</td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge}>{normaliseStatus(engagement.status)}</span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <button style={styles.openButton} onClick={() => router.push(`/afs/${engagement.id}`)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "18px",
    background: "#eef3f8",
    minHeight: "100vh",
    color: "#12304a",
  },
  heroPanel: {
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr",
    gap: "24px",
    alignItems: "end",
    background: "#ffffff",
    border: "1px solid #d8e2ef",
    padding: "14px 18px",
    marginBottom: "10px",
  },
  kicker: {
    color: "#0b63ff",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: "6px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 900,
    margin: 0,
    color: "#0f2742",
  },
  heroText: {
    margin: 0,
    color: "#56657a",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  layoutGrid: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: "10px",
    alignItems: "start",
  },
  leftPanel: {
    background: "#ffffff",
    border: "1px solid #d8e2ef",
    padding: "8px",
  },
  rightPanel: {
    background: "#ffffff",
    border: "1px solid #d8e2ef",
    padding: "8px",
    minWidth: 0,
  },
  panelTitle: {
    fontSize: "16px",
    margin: "0 0 7px 0",
    color: "#0f2742",
    fontWeight: 900,
  },
  resultText: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
  },
  fieldGroup: {
    display: "grid",
    gap: "5px",
    marginBottom: "8px",
  },
  fieldGroupCompact: {
    display: "grid",
    gap: "5px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 900,
    color: "#334155",
  },
  labelBlock: {
    display: "grid",
    gap: "5px",
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: 900,
    color: "#334155",
  },
  input: {
    width: "100%",
    height: "34px",
    border: "1px solid #cbd5e1",
    padding: "0 9px",
    fontSize: "13px",
    background: "#ffffff",
    color: "#12304a",
    outline: "none",
    borderRadius: 0,
    boxSizing: "border-box",
  },
  lockedClientBox: {
    minHeight: "34px",
    border: "1px solid #cbd5e1",
    padding: "8px 9px",
    fontSize: "13px",
    background: "#f8fafc",
    color: "#12304a",
    boxSizing: "border-box",
    fontWeight: 800,
  },
  infoBox: {
    display: "grid",
    gap: "4px",
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
    padding: "8px",
    marginBottom: "10px",
    fontSize: "12px",
    color: "#12304a",
  },
  createForm: {
    borderTop: "2px solid #0f2742",
    paddingTop: "10px",
  },
  primaryButtonFull: {
    width: "100%",
    background: "#0b5cab",
    color: "#ffffff",
    border: "1px solid #0b5cab",
    padding: "9px 10px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    borderRadius: 0,
  },
  tableHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: "12px",
    marginBottom: "8px",
  },
  clearButton: {
    background: "#ffffff",
    color: "#12304a",
    border: "1px solid #cbd5e1",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
    borderRadius: 0,
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 150px 170px",
    gap: "8px",
    marginBottom: "8px",
  },
  tableWrap: {
    border: "1px solid #d8e2ef",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    background: "#eef3f8",
    color: "#334155",
    textAlign: "left",
    padding: "8px 7px",
    borderBottom: "1px solid #cbd5e1",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px 7px",
    borderBottom: "1px solid #e5edf6",
    color: "#12304a",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  tdStrong: {
    padding: "8px 7px",
    borderBottom: "1px solid #e5edf6",
    color: "#0f2742",
    fontWeight: 900,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  statusBadge: {
    display: "inline-block",
    padding: "3px 8px",
    background: "#eaf3ff",
    color: "#0b5cab",
    border: "1px solid #bfdbfe",
    fontSize: "12px",
    fontWeight: 900,
  },
  openButton: {
    border: 0,
    background: "transparent",
    color: "#0b5cab",
    textDecoration: "none",
    fontWeight: 900,
    cursor: "pointer",
    padding: 0,
    fontSize: "13px",
  },
  emptyState: {
    padding: "28px",
    textAlign: "center",
    color: "#64748b",
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    fontWeight: 700,
  },
};