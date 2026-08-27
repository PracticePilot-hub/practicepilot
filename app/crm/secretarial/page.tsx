"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type ClientRow = {
  id: string;
  client_name: string;
  registration_number: string | null;
  id_passport_number: string | null;
  entity_type: string | null;
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
  const [entityType, setEntityType] = useState("all");
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

      const response = await fetch("/api/crm/secretarial/client-summary", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Could not load the Secretarial client list."
        );
      }

      setClients((result.clients || []) as ClientRow[]);
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

  const entityTypes = useMemo(
    () =>
      Array.from(
        new Set(
          clients
            .map((client) => client.entity_type?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [clients]
  );

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

      const matchesEntity =
        entityType === "all" || client.entity_type === entityType;

      const matchesSecretarialStatus =
        secretarialStatus === "all" ||
        (secretarialStatus === "active" && hasSecretarialRecord) ||
        (secretarialStatus === "open" && stats.openMatters > 0) ||
        (secretarialStatus === "none" && !hasSecretarialRecord);

      return matchesSearch && matchesEntity && matchesSecretarialStatus;
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
    entityType,
    secretarialStatus,
    sort,
    clientStats,
  ]);

  function clearFilters() {
    setSearch("");
    setEntityType("all");
    setSecretarialStatus("all");
    setSort("name_asc");
  }

  return (
    <div style={page}>
      <section style={workingFileBar}>
        <span style={eyebrow}>SECRETARIAL</span>
        <span style={divider}>|</span>
        <strong>Client Files</strong>
        <span style={divider}>|</span>
        <span style={mutedText}>
          Select the client first, then work inside its permanent statutory file
        </span>
      </section>

      <section style={headerPanel}>
        <div>
          <h1 style={title}>Secretarial Client Files</h1>
          <p style={subtitle}>
            Directors, ownership, share capital, certificates, statutory
            workflows, registers and documents are all viewed from the client.
          </p>
        </div>

        <div style={headerCount}>
          <strong>{clients.length}</strong>
          <span>clients</span>
        </div>
      </section>

      <section style={filterPanel}>
        <div style={searchGroup}>
          <label style={filterLabel}>SEARCH</label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Client or registration / ID number..."
            style={input}
          />
        </div>

        <div style={filterGroup}>
          <label style={filterLabel}>ENTITY TYPE</label>
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            style={select}
          >
            <option value="all">All entity types</option>
            {entityTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div style={filterGroup}>
          <label style={filterLabel}>SECRETARIAL STATUS</label>
          <select
            value={secretarialStatus}
            onChange={(event) => setSecretarialStatus(event.target.value)}
            style={select}
          >
            <option value="all">All clients</option>
            <option value="active">Has secretarial records</option>
            <option value="open">Has open work</option>
            <option value="none">No secretarial records yet</option>
          </select>
        </div>

        <div style={filterGroup}>
          <label style={filterLabel}>SORT</label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            style={select}
          >
            <option value="name_asc">Client name A–Z</option>
            <option value="name_desc">Client name Z–A</option>
            <option value="registration_asc">Registration / ID</option>
          </select>
        </div>

        <button type="button" onClick={clearFilters} style={clearButton}>
          Clear
        </button>
      </section>

      <section style={contentPanel}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Clients</h2>
            <p style={sectionSubtitle}>
              {loading ? "Loading..." : `${rows.length} of ${clients.length} clients shown`}
            </p>
          </div>

          <button type="button" onClick={loadSecretarialClients} style={refreshButton}>
            Refresh
          </button>
        </div>

        {loadError ? <div style={errorBar}>{loadError}</div> : null}

        <div style={tableHeader}>
          <div>CLIENT</div>
          <div>REGISTRATION / ID</div>
          <div>SHAREHOLDERS</div>
          <div>ISSUED CERTIFICATES</div>
          <div>OPEN WORK</div>
          <div />
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
              style={clickableTableRow}
            >
              <div>
                <strong style={clientName}>{client.client_name}</strong>
              </div>

              <div style={cellText}>
                {client.registration_number || client.id_passport_number || "—"}
              </div>

              <div style={numberCell}>{stats.shareholders}</div>
              <div style={numberCell}>{stats.issuedCertificates}</div>

              <div>
                {stats.openMatters > 0 ? (
                  <span style={openBadge}>{stats.openMatters} open</span>
                ) : (
                  <span style={clearBadge}>Clear</span>
                )}
              </div>

              <div style={rowArrow} aria-hidden="true">→</div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "8px 10px 28px",
  background: "#eef2f5",
  color: "#0f1f33",
};

const workingFileBar: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  gap: "9px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
  fontSize: "11px",
};

const eyebrow: React.CSSProperties = {
  color: "#2457d6",
  fontWeight: 900,
  letterSpacing: "0.06em",
};

const divider: React.CSSProperties = { color: "#94a3b8" };
const mutedText: React.CSSProperties = { color: "#64748b" };

const headerPanel: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "76px",
  padding: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "11px",
  lineHeight: 1.45,
};

const headerCount: React.CSSProperties = {
  minWidth: "82px",
  padding: "8px 12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  borderLeft: "1px solid #d8dee7",
  color: "#64748b",
  fontSize: "9px",
};

const filterPanel: React.CSSProperties = {
  marginTop: "8px",
  padding: "10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(280px, 1.6fr) minmax(170px, .8fr) minmax(190px, .9fr) minmax(180px, .8fr) 70px",
  gap: "8px",
  alignItems: "end",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const searchGroup: React.CSSProperties = { minWidth: 0 };
const filterGroup: React.CSSProperties = { minWidth: 0 };

const filterLabel: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.06em",
};

const input: React.CSSProperties = {
  width: "100%",
  height: "34px",
  padding: "0 9px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  fontSize: "10px",
};

const select: React.CSSProperties = { ...input };

const clearButton: React.CSSProperties = {
  height: "34px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const contentPanel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const sectionHeader: React.CSSProperties = {
  minHeight: "58px",
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #d8dee7",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 900,
};

const sectionSubtitle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: "9px",
};

const refreshButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const tableHeader: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(260px, 1.4fr) minmax(180px, .9fr) 120px 150px 110px 70px",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.04em",
};

const tableRow: React.CSSProperties = {
  minHeight: "40px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(260px, 1.4fr) minmax(180px, .9fr) 120px 150px 110px 70px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e4e9ef",
};
const clickableTableRow: React.CSSProperties = {
  ...tableRow,
  color: "inherit",
  textDecoration: "none",
  cursor: "pointer",
};

const rowArrow: React.CSSProperties = {
  color: "#1758d5",
  fontSize: "25px",
  fontWeight: 900,
  lineHeight: 1,
  textAlign: "right",
};


const clientName: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
};

const clientMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
};

const cellText: React.CSSProperties = { fontSize: "9px" };

const numberCell: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 900,
};

const openBadge: React.CSSProperties = {
  padding: "4px 6px",
  color: "#92400e",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  fontSize: "8px",
  fontWeight: 900,
};

const clearBadge: React.CSSProperties = {
  padding: "4px 6px",
  color: "#166534",
  background: "#ecfdf3",
  border: "1px solid #bbf7d0",
  fontSize: "8px",
  fontWeight: 900,
};



const emptyState: React.CSSProperties = {
  padding: "18px 10px",
  color: "#64748b",
  fontSize: "10px",
};

const errorBar: React.CSSProperties = {
  padding: "9px 10px",
  color: "#991b1b",
  background: "#fff1f2",
  borderBottom: "1px solid #fecaca",
  fontSize: "10px",
  fontWeight: 800,
};
