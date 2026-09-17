"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type ClientRow = {
  id: string;
  client_name: string;
  registration_number: string | null;
  id_passport_number: string | null;
  entity_type: string | null;
  client_category: "individual" | "entity" | "trust" | null;
  relationship_status:
    | "flying_client"
    | "in_airspace"
    | "on_radar"
    | "former_client"
    | null;
  status: string | null;
};

type MatterRow = {
  client_id: string;
  matter_status: string | null;
};

type CertificateRow = {
  client_id: string;
  certificate_status: string | null;
};

type ShareholderRow = {
  client_id: string;
  is_active: boolean | null;
};

type SortOption = "name_asc" | "name_desc" | "registration_asc";

export default function SecretarialPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [matters, setMatters] = useState<MatterRow[]>([]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [shareholders, setShareholders] = useState<ShareholderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [secretarialStatus, setSecretarialStatus] = useState("all");
  const [sort, setSort] = useState<SortOption>("name_asc");

  useEffect(() => {
    loadSecretarialClients();
  }, []);

  async function loadSecretarialClients() {
    setLoading(true);
    setLoadError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your login session could not be confirmed.");
      }

      const response = await fetch("/api/crm/secretarial/share-certificates", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Secretarial summary endpoint returned ${response.status}.`
        );
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Could not load the Secretarial client list."
        );
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your PracticePilot login could not be confirmed.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("organisation_id, access_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.access_enabled || !profile?.organisation_id) {
        throw new Error("Your PracticePilot organisation access could not be confirmed.");
      }

      const { data: eligibleClients, error: clientsError } = await supabase
        .from("crm_clients")
        .select(`
          id,
          client_name,
          registration_number,
          id_passport_number,
          entity_type,
          client_category,
          relationship_status,
          status
        `)
        .eq("organisation_id", profile.organisation_id)
        .eq("relationship_status", "flying_client")
        .eq("client_category", "entity")
        .order("client_name", { ascending: true });

      if (clientsError) throw clientsError;

      const corporateClients = ((eligibleClients || []) as ClientRow[]).filter(
        (client) => {
          const type = String(client.entity_type || "").trim().toLowerCase();

          return ![
            "individual",
            "trust",
            "partnership",
            "sole proprietor",
          ].includes(type);
        }
      );

      setClients(corporateClients);
      setMatters((result.matters || []) as MatterRow[]);
      setCertificates((result.certificates || []) as CertificateRow[]);
      setShareholders((result.shareholders || []) as ShareholderRow[]);
    } catch (error) {
      console.error("Could not load Secretarial client list:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load the Secretarial client list."
      );
    } finally {
      setLoading(false);
    }
  }

  const clientStats = useMemo(() => {
    const map = new Map<
      string,
      {
        openMatters: number;
        issuedCertificates: number;
        shareholders: number;
      }
    >();

    for (const client of clients) {
      map.set(client.id, {
        openMatters: 0,
        issuedCertificates: 0,
        shareholders: 0,
      });
    }

    for (const matter of matters) {
      const stat = map.get(matter.client_id);
      if (!stat) continue;

      if (
        [
          "draft",
          "in_progress",
          "awaiting_review",
          "returned_for_correction",
          "approved",
        ].includes(String(matter.matter_status || "").toLowerCase())
      ) {
        stat.openMatters += 1;
      }
    }

    for (const certificate of certificates) {
      const stat = map.get(certificate.client_id);
      if (!stat) continue;

      if (
        String(certificate.certificate_status || "").toLowerCase() === "issued"
      ) {
        stat.issuedCertificates += 1;
      }
    }

    for (const shareholder of shareholders) {
      const stat = map.get(shareholder.client_id);
      if (!stat) continue;
      stat.shareholders += 1;
    }

    return map;
  }, [clients, matters, certificates, shareholders]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = clients.filter((client) => {
      const registration =
        client.registration_number || client.id_passport_number || "";
      const stats = clientStats.get(client.id) || {
        openMatters: 0,
        issuedCertificates: 0,
        shareholders: 0,
      };

      const hasSecretarialRecord =
        stats.openMatters > 0 ||
        stats.issuedCertificates > 0 ||
        stats.shareholders > 0;

      const matchesSearch =
        !term ||
        client.client_name.toLowerCase().includes(term) ||
        registration.toLowerCase().includes(term);

      const matchesSecretarialStatus =
        secretarialStatus === "all" ||
        (secretarialStatus === "active" && hasSecretarialRecord) ||
        (secretarialStatus === "open" && stats.openMatters > 0) ||
        (secretarialStatus === "none" && !hasSecretarialRecord);

      return matchesSearch && matchesSecretarialStatus;
    });

    return [...filtered].sort((a, b) => {
      const aReg = a.registration_number || a.id_passport_number || "";
      const bReg = b.registration_number || b.id_passport_number || "";

      if (sort === "name_desc") return b.client_name.localeCompare(a.client_name);
      if (sort === "registration_asc") return aReg.localeCompare(bReg);
      return a.client_name.localeCompare(b.client_name);
    });
  }, [
    clients,
    search,
    secretarialStatus,
    sort,
    clientStats,
  ]);

  function clearFilters() {
    setSearch("");
    setSecretarialStatus("all");
    setSort("name_asc");
  }

  return (
    <main style={page}>
      <header style={secretarialHeader}>
        <div>
          <h1 style={secretarialTitle}>Secretarial</h1>
          <p style={secretarialSubtitle}>
            Manage client files, statutory records and live secretarial work.
          </p>
        </div>
      </header>

      <nav style={workspaceTabs}>
        <Link href="/crm/secretarial/client-files" style={workspaceTabActive}>
          <span style={tabIcon}>▤</span>
          Client Files
        </Link>
        <Link href="/crm/secretarial/work-orders" style={workspaceTab}>
          <span style={tabIcon}>▣</span>
          Work Orders
        </Link>
      </nav>

      <section style={summaryStrip}>
        <div style={summaryTile}>
          <span style={summaryIconBlue}>▤</span>
          <div>
            <strong style={summaryNumber}>{clients.length}</strong>
            <span style={summaryLabel}>Flying Corporate Clients</span>
          </div>
        </div>

        <div style={summaryTile}>
          <span style={summaryIconGreen}>◎</span>
          <div>
            <strong style={summaryNumber}>
              {Array.from(clientStats.values()).reduce(
                (sum, stats) => sum + stats.shareholders,
                0
              )}
            </strong>
            <span style={summaryLabel}>Linked Shareholders</span>
          </div>
        </div>

        <div style={summaryTile}>
          <span style={summaryIconAmber}>▧</span>
          <div>
            <strong style={summaryNumber}>
              {Array.from(clientStats.values()).reduce(
                (sum, stats) => sum + stats.issuedCertificates,
                0
              )}
            </strong>
            <span style={summaryLabel}>Issued Certificates</span>
          </div>
        </div>

        <div style={summaryTile}>
          <span style={summaryIconPurple}>◷</span>
          <div>
            <strong style={summaryNumber}>
              {Array.from(clientStats.values()).reduce(
                (sum, stats) => sum + stats.openMatters,
                0
              )}
            </strong>
            <span style={summaryLabel}>Open Secretarial Matters</span>
          </div>
        </div>

        <Link href="/crm/secretarial/work-orders" style={primaryAction}>
          Open Work Orders →
        </Link>
      </section>

      <section style={workspacePanel}>
        <div style={workspacePanelHeader}>
          <div>
            <h2 style={workspacePanelTitle}>Client Files</h2>
            <p style={workspacePanelSubtitle}>
              Permanent entity records for Flying corporate clients.
            </p>
          </div>
          <span style={resultCount}>
            {loading ? "Loading..." : `${rows.length} results`}
          </span>
        </div>

        <div style={filterBar}>
          <div style={searchBox}>
            <span style={searchIcon}>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by client or registration number..."
              style={searchInput}
            />
          </div>

          <select
            value={secretarialStatus}
            onChange={(event) => setSecretarialStatus(event.target.value)}
            style={filterSelect}
          >
            <option value="all">All Flying corporate clients</option>
            <option value="active">Has secretarial records</option>
            <option value="open">Has open work</option>
            <option value="none">No secretarial records yet</option>
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            style={filterSelect}
          >
            <option value="name_asc">Client name A–Z</option>
            <option value="name_desc">Client name Z–A</option>
            <option value="registration_asc">Registration number</option>
          </select>

          <button type="button" onClick={clearFilters} style={clearButton}>
            Clear
          </button>
        </div>

        {loadError ? <div style={errorBar}>{loadError}</div> : null}

        <div style={tableHeader}>
          <span>Client</span>
          <span>Registration Number</span>
          <span>Shareholders</span>
          <span>Issued Certificates</span>
          <span>Open Work</span>
          <span>Actions</span>
        </div>

        {!loading && rows.length === 0 ? (
          <div style={emptyState}>No clients match the current filters.</div>
        ) : null}

        {rows.map((client) => {
          const stats = clientStats.get(client.id) || {
            openMatters: 0,
            issuedCertificates: 0,
            shareholders: 0,
          };

          return (
            <Link
              key={client.id}
              href={`/crm/secretarial/client/${client.id}`}
              style={tableRow}
            >
              <div>
                <strong style={clientName}>{client.client_name}</strong>
                <span style={clientMeta}>Flying Client</span>
              </div>
              <span style={cellText}>
                {client.registration_number || client.id_passport_number || "—"}
              </span>
              <strong style={numberCell}>{stats.shareholders}</strong>
              <strong style={numberCell}>{stats.issuedCertificates}</strong>
              <span>
                {stats.openMatters > 0 ? (
                  <span style={openBadge}>{stats.openMatters} open</span>
                ) : (
                  <span style={clearBadge}>Clear</span>
                )}
              </span>
              <span style={rowAction}>•••</span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "18px 22px 32px",
  background: "#f4f7fb",
  color: "#10233a",
};

const secretarialHeader: React.CSSProperties = {
  padding: "2px 0 14px",
  borderBottom: "1px solid #dbe3ec",
};

const secretarialTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "24px",
  lineHeight: 1,
  fontWeight: 950,
};

const secretarialSubtitle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontSize: "11px",
};

const workspaceTabs: React.CSSProperties = {
  marginTop: "16px",
  display: "flex",
  gap: "10px",
};

const workspaceTab: React.CSSProperties = {
  width: "250px",
  height: "48px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  border: "1px solid #cad5e2",
  background: "#ffffff",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "11px",
  fontWeight: 900,
};

const workspaceTabActive: React.CSSProperties = {
  ...workspaceTab,
  borderColor: "#1758d5",
  background: "#1758d5",
  color: "#ffffff",
  boxShadow: "0 4px 12px rgba(23,88,213,.14)",
};

const tabIcon: React.CSSProperties = { fontSize: "15px", fontWeight: 900 };

const summaryStrip: React.CSSProperties = {
  marginTop: "16px",
  minHeight: "92px",
  padding: "12px 14px",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0,1fr)) 200px",
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #d6dee8",
  boxShadow: "0 2px 8px rgba(15,35,58,.04)",
};

const summaryTile: React.CSSProperties = {
  minHeight: "62px",
  padding: "0 18px",
  display: "grid",
  gridTemplateColumns: "42px minmax(0,1fr)",
  gap: "10px",
  alignItems: "center",
  borderRight: "1px solid #e5eaf0",
};

const summaryIconBlue: React.CSSProperties = {
  width: "38px",
  height: "38px",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: "#dbeafe",
  color: "#1758d5",
  fontWeight: 950,
};
const summaryIconGreen: React.CSSProperties = { ...summaryIconBlue, background: "#dcfce7", color: "#166534" };
const summaryIconAmber: React.CSSProperties = { ...summaryIconBlue, background: "#fff7df", color: "#d97706" };
const summaryIconPurple: React.CSSProperties = { ...summaryIconBlue, background: "#f3e8ff", color: "#7c3aed" };

const summaryNumber: React.CSSProperties = { display: "block", fontSize: "22px", lineHeight: 1, fontWeight: 950 };
const summaryLabel: React.CSSProperties = { display: "block", marginTop: "6px", color: "#64748b", fontSize: "9px", fontWeight: 850 };

const primaryAction: React.CSSProperties = {
  height: "42px",
  marginLeft: "16px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #1758d5",
  background: "#1758d5",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 900,
};

const workspacePanel: React.CSSProperties = {
  marginTop: "16px",
  background: "#ffffff",
  border: "1px solid #d6dee8",
  boxShadow: "0 2px 8px rgba(15,35,58,.04)",
};

const workspacePanelHeader: React.CSSProperties = {
  minHeight: "62px",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #e0e6ed",
};

const workspacePanelTitle: React.CSSProperties = { margin: 0, fontSize: "16px", fontWeight: 950 };
const workspacePanelSubtitle: React.CSSProperties = { margin: "4px 0 0", color: "#64748b", fontSize: "9px" };
const resultCount: React.CSSProperties = { color: "#64748b", fontSize: "9px", fontWeight: 850 };

const filterBar: React.CSSProperties = {
  minHeight: "68px",
  padding: "12px 14px",
  display: "grid",
  gridTemplateColumns: "minmax(360px,1.4fr) minmax(220px,.75fr) minmax(190px,.7fr) 88px",
  gap: "10px",
  alignItems: "center",
  borderBottom: "1px solid #e0e6ed",
};

const searchBox: React.CSSProperties = {
  height: "36px",
  display: "grid",
  gridTemplateColumns: "32px minmax(0,1fr)",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
};

const searchIcon: React.CSSProperties = { textAlign: "center", color: "#64748b", fontSize: "15px" };
const searchInput: React.CSSProperties = { width: "100%", height: "34px", boxSizing: "border-box", border: "none", outline: "none", color: "#10233a", fontSize: "9px" };
const filterSelect: React.CSSProperties = { height: "36px", padding: "0 9px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#10233a", fontSize: "9px" };
const clearButton: React.CSSProperties = { height: "36px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#526174", fontSize: "9px", fontWeight: 850, cursor: "pointer" };

const tableHeader: React.CSSProperties = {
  minHeight: "40px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(210px,1.7fr) minmax(150px,1fr) 90px 115px 95px 42px",
  gap: "10px",
  alignItems: "center",
  background: "#f4f7fa",
  borderBottom: "1px solid #d8e0e8",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 900,
};

const tableRow: React.CSSProperties = {
  minHeight: "58px",
  padding: "8px 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(210px,1.7fr) minmax(150px,1fr) 90px 115px 95px 42px",
  gap: "10px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "9px",
};

const clientName: React.CSSProperties = { display: "block", fontSize: "10px", fontWeight: 900 };
const clientMeta: React.CSSProperties = { display: "block", marginTop: "3px", color: "#94a3b8", fontSize: "7.5px" };
const cellText: React.CSSProperties = { color: "#475569", fontSize: "9px" };
const numberCell: React.CSSProperties = { fontSize: "12px", fontWeight: 950 };

const openBadge: React.CSSProperties = {
  minHeight: "22px", padding: "0 8px", display: "inline-flex", alignItems: "center",
  borderRadius: "11px", background: "#fff7df", color: "#9a6700", fontSize: "8px", fontWeight: 850,
};
const clearBadge: React.CSSProperties = {
  minHeight: "22px", padding: "0 8px", display: "inline-flex", alignItems: "center",
  borderRadius: "11px", background: "#ecfdf3", color: "#166534", fontSize: "8px", fontWeight: 850,
};
const rowAction: React.CSSProperties = { color: "#1758d5", fontSize: "14px", fontWeight: 900, textAlign: "center" };
const emptyState: React.CSSProperties = { padding: "20px 14px", color: "#64748b", fontSize: "9px" };
const errorBar: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontSize: "9px", fontWeight: 800 };
