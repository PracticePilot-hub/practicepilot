"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
};

type FirmOption = {
  id: string;
  name: string;
  status: string;
};

const firmOptions: FirmOption[] = [
  {
    id: "bizzacc-menlyn",
    name: "Bizzacc Menlyn (Pty) Ltd",
    status: "Active · Access enabled",
  },
];

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeStyle(status: string | null | undefined) {
  const value = String(status || "draft").toLowerCase();

  if (value.includes("final")) {
    return { ...styles.statusBadge, ...styles.statusFinal };
  }

  if (value.includes("review")) {
    return { ...styles.statusBadge, ...styles.statusReview };
  }

  return { ...styles.statusBadge, ...styles.statusDraft };
}

export default function AFSPage() {
  const router = useRouter();

  const [engagements, setEngagements] = useState<AFSEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedFirmId, setSelectedFirmId] = useState(firmOptions[0]?.id || "");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortMode, setSortMode] = useState("Entity A-Z");

  const [clientName, setClientName] = useState("");
  const [entityType, setEntityType] = useState("Company");
  const [financialYearEnd, setFinancialYearEnd] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [notes, setNotes] = useState("");

  const selectedFirm = firmOptions.find((firm) => firm.id === selectedFirmId) || firmOptions[0];

  async function loadEngagements() {
    setLoading(true);

    try {
      const res = await fetch("/api/afs/engagements", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load AFS engagements.");
      }

      setEngagements(data.engagements || []);
    } catch (error: any) {
      alert(error.message || "Failed to load AFS engagements.");
    } finally {
      setLoading(false);
    }
  }

  async function createEngagement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

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
          firmClientId: selectedFirmId,
          firmClientName: selectedFirm?.name || "Bizzacc Menlyn (Pty) Ltd",
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

  useEffect(() => {
    loadEngagements();
  }, []);

  const filteredEngagements = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    const filtered = engagements.filter((engagement) => {
      const status = String(engagement.status || "").toLowerCase();
      const statusMatches =
        statusFilter === "All" || status === statusFilter.toLowerCase();

      const searchMatches =
        !search ||
        String(engagement.client_name || "").toLowerCase().includes(search) ||
        String(engagement.entity_type || "").toLowerCase().includes(search) ||
        String(engagement.financial_year_end || "").toLowerCase().includes(search) ||
        String(engagement.prepared_by || "").toLowerCase().includes(search) ||
        String(engagement.reviewed_by || "").toLowerCase().includes(search);

      return statusMatches && searchMatches;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "Year end newest") {
        return String(b.financial_year_end || "").localeCompare(String(a.financial_year_end || ""));
      }

      if (sortMode === "Created newest") {
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      }

      return String(a.client_name || "").localeCompare(String(b.client_name || ""));
    });
  }, [engagements, searchText, sortMode, statusFilter]);

  return (
    <main style={styles.page}>
      <section style={styles.headerBand}>
        <div>
          <p style={styles.kicker}>PracticePilot</p>
          <h1 style={styles.title}>Annual Financial Statements</h1>
        </div>
        <p style={styles.headerDescription}>
          Create and manage AFS engagements, trial balances, lead schedules, statements and final file packs.
        </p>
      </section>

      <section style={styles.layoutGrid}>
        <aside style={styles.leftRail}>
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>Firm control</h2>

            <label style={styles.label}>
              Working firm / client
              <select
                style={styles.input}
                value={selectedFirmId}
                onChange={(e) => setSelectedFirmId(e.target.value)}
              >
                {firmOptions.map((firm) => (
                  <option key={firm.id} value={firm.id}>
                    {firm.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.firmCard}>
              <strong>{selectedFirm?.name || "Bizzacc Menlyn (Pty) Ltd"}</strong>
              <span>{selectedFirm?.status || "Active · Access enabled"}</span>
            </div>
          </section>

          <form onSubmit={createEngagement} style={styles.panel}>
            <h2 style={styles.panelTitle}>New AFS engagement</h2>

            <label style={styles.label}>
              Client name
              <input
                style={styles.input}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Example: ABC Trading (Pty) Ltd"
              />
            </label>

            <label style={styles.label}>
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

            <label style={styles.label}>
              Financial year end
              <input
                style={styles.input}
                type="date"
                value={financialYearEnd}
                onChange={(e) => setFinancialYearEnd(e.target.value)}
              />
            </label>

            <label style={styles.label}>
              Prepared by
              <input
                style={styles.input}
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label style={styles.label}>
              Reviewed by
              <input
                style={styles.input}
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label style={styles.label}>
              Notes
              <textarea
                style={{ ...styles.input, minHeight: 74, resize: "vertical" }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional internal notes"
              />
            </label>

            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {saving ? "Creating..." : "Create AFS engagement"}
            </button>
          </form>
        </aside>

        <section style={styles.mainPanel}>
          <div style={styles.listHeaderRow}>
            <div>
              <h2 style={styles.listTitle}>{selectedFirm?.name || "Bizzacc Menlyn (Pty) Ltd"} AFS engagements</h2>
              <p style={styles.listSubtitle}>
                Showing {filteredEngagements.length} of {engagements.length} engagement(s)
              </p>
            </div>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setSearchText("");
                setStatusFilter("All");
                setSortMode("Entity A-Z");
              }}
            >
              Clear filters
            </button>
          </div>

          <div style={styles.filtersGrid}>
            <label style={styles.compactLabel}>
              Entity / year end
              <input
                style={styles.compactInput}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search engagement..."
              />
            </label>

            <label style={styles.compactLabel}>
              Status
              <select
                style={styles.compactInput}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Draft">Draft</option>
                <option value="Review">Review</option>
                <option value="Finalised">Finalised</option>
              </select>
            </label>

            <label style={styles.compactLabel}>
              Sort by
              <select
                style={styles.compactInput}
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
              >
                <option value="Entity A-Z">Entity A-Z</option>
                <option value="Year end newest">Year end newest</option>
                <option value="Created newest">Created newest</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p style={styles.emptyText}>Loading engagements...</p>
          ) : filteredEngagements.length === 0 ? (
            <p style={styles.emptyText}>No AFS engagements match the current filters.</p>
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
                    <th style={styles.thRight}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEngagements.map((engagement) => (
                    <tr key={engagement.id} style={styles.tr}>
                      <td style={styles.tdStrong}>{engagement.client_name}</td>
                      <td style={styles.td}>{engagement.entity_type || "Entity"}</td>
                      <td style={styles.td}>{engagement.financial_year_end || "—"}</td>
                      <td style={styles.td}>{selectedFirm?.name || "Bizzacc Menlyn (Pty) Ltd"}</td>
                      <td style={styles.td}>{engagement.prepared_by || "—"}</td>
                      <td style={styles.td}>{engagement.reviewed_by || "—"}</td>
                      <td style={styles.td}>
                        <span style={statusBadgeStyle(engagement.status)}>
                          {engagement.status || "draft"}
                        </span>
                      </td>
                      <td style={styles.tdRight}>
                        <button
                          type="button"
                          style={styles.openButton}
                          onClick={() => router.push(`/afs/${engagement.id}`)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={styles.footNote}>
            Current AFS engagements are shown under Bizzacc Menlyn. Firm/client allocation will be persisted in the next database step.
          </p>
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "16px",
    color: "#111827",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "12px",
  },
  headerBand: {
    background: "#ffffff",
    border: "1px solid #dfe5ef",
    borderRadius: "6px",
    padding: "14px 18px",
    marginBottom: "7px",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "18px",
    boxShadow: "none",
  },
  kicker: {
    margin: "0 0 5px",
    fontSize: "11px",
    fontWeight: 850,
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: 0,
    fontSize: "24px",
    lineHeight: 1.12,
    fontWeight: 650,
    color: "#111827",
  },
  headerDescription: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    maxWidth: "760px",
    textAlign: "right",
  },
  layoutGrid: {
    display: "grid",
    gridTemplateColumns: "300px minmax(0, 1fr)",
    gap: "10px",
    alignItems: "start",
  },
  leftRail: {
    display: "grid",
    gap: "8px",
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #dfe5ef",
    borderRadius: "6px",
    padding: "8px",
    boxShadow: "none",
  },
  panelTitle: {
    margin: "0 0 12px",
    fontSize: "15px",
    fontWeight: 750,
    color: "#111827",
  },
  label: {
    display: "block",
    marginBottom: "7px",
    fontSize: "12px",
    fontWeight: 750,
    color: "#334155",
  },
  input: {
    width: "100%",
    marginTop: "5px",
    border: "1px solid #cfd8e6",
    borderRadius: "4px",
    padding: "7px 8px",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#111827",
    fontFamily: "inherit",
  },
  firmCard: {
    border: "1px solid #dfe5ef",
    borderRadius: "5px",
    background: "#f8fafc",
    padding: "8px",
    display: "grid",
    gap: "4px",
    color: "#334155",
  },
  primaryButton: {
    width: "100%",
    border: "1px solid #2563eb",
    borderRadius: "4px",
    padding: "7px 9px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 850,
    fontSize: "12px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  mainPanel: {
    background: "#ffffff",
    border: "1px solid #dfe5ef",
    borderRadius: "6px",
    padding: "8px",
    boxShadow: "none",
    minHeight: "300px",
  },
  listHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "7px",
  },
  listTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 800,
    color: "#111827",
  },
  listSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 650,
  },
  secondaryButton: {
    border: "1px solid #d6deea",
    borderRadius: "4px",
    background: "#ffffff",
    color: "#334155",
    padding: "7px 9px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 140px 160px",
    gap: "8px",
    marginBottom: "7px",
  },
  compactLabel: {
    display: "grid",
    gap: "4px",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 750,
  },
  compactInput: {
    border: "1px solid #cfd8e6",
    borderRadius: "4px",
    padding: "8px 9px",
    fontSize: "12px",
    color: "#111827",
    background: "#ffffff",
    outline: "none",
    fontFamily: "inherit",
  },
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: "5px",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  th: {
    background: "#f8fafc",
    borderBottom: "1px solid #dfe5ef",
    padding: "8px 7px",
    textAlign: "left",
    color: "#334155",
    fontSize: "11px",
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  thRight: {
    background: "#f8fafc",
    borderBottom: "1px solid #dfe5ef",
    padding: "8px 7px",
    textAlign: "right",
    color: "#334155",
    fontSize: "11px",
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #eef2f7",
  },
  td: {
    padding: "8px 7px",
    color: "#334155",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "8px 7px",
    color: "#111827",
    fontWeight: 850,
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "8px 7px",
    textAlign: "right",
    verticalAlign: "middle",
  },
  statusBadge: {
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 850,
    textTransform: "lowercase",
    whiteSpace: "nowrap",
    display: "inline-flex",
  },
  statusDraft: {
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  statusReview: {
    background: "#fffbeb",
    color: "#92400e",
  },
  statusFinal: {
    background: "#dcfce7",
    color: "#166534",
  },
  openButton: {
    border: "0",
    background: "transparent",
    color: "#2563eb",
    padding: "4px 0",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  emptyText: {
    color: "#64748b",
    fontSize: "12px",
    padding: "18px 4px",
  },
  footNote: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: "11px",
  },
};