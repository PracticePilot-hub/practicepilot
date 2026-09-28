"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/app/lib/supabase";

type ClientRow = {
  id: string;
  client_name: string;
  client_code: string | null;
  client_category: string | null;
  relationship_status: string | null;
  mapping: {
    id: string;
    folder_id: string | null;
    folder_path: string;
    folder_name: string | null;
  } | null;
};

type EgnyteFolder = {
  id: string | null;
  name: string;
  path: string;
  branch: "Entities" | "Individuals";
};

function simplify(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\(pty\)\s*ltd/g, "")
    .replace(/\bpty\s*ltd\b/g, "")
    .replace(/\bproprietary\s+limited\b/g, "")
    .replace(/\bcc\b/g, "")
    .replace(/\bnpc\b/g, "")
    .replace(/\binc\b/g, "")
    .replace(/\btrust\b/g, "trust")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export default function ClientFolderMappingPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [folders, setFolders] = useState<EgnyteFolder[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [savingClientId, setSavingClientId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function authFetch(url: string, options?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your PracticePilot login session could not be confirmed.");
    }

    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(options?.headers || {}),
      },
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Request failed.");
    }

    return result;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await authFetch(
        "/api/settings/document-providers/client-folders"
      );

      setClients((result.clients || []) as ClientRow[]);
      setFolders((result.folders || []) as EgnyteFolder[]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load client folder mapping."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const folderByPath = useMemo(
    () => new Map(folders.map((folder) => [folder.path, folder])),
    [folders]
  );

  const suggestions = useMemo(() => {
    const result = new Map<string, EgnyteFolder>();

    for (const client of clients) {
      if (client.mapping) continue;

      const expectedBranch =
        String(client.client_category || "").toLowerCase() === "individual"
          ? "Individuals"
          : "Entities";

      const clientKey = simplify(client.client_name);

      const candidates = folders.filter(
        (folder) =>
          folder.branch === expectedBranch &&
          simplify(folder.name) === clientKey
      );

      if (candidates.length === 1) {
        result.set(client.id, candidates[0]);
      }
    }

    return result;
  }, [clients, folders]);

  const visibleClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    return clients.filter((client) => {
      if (
        term &&
        ![
          client.client_name,
          client.client_code,
          client.mapping?.folder_name,
          client.mapping?.folder_path,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }

      if (statusFilter === "mapped" && !client.mapping) return false;
      if (statusFilter === "unmapped" && client.mapping) return false;

      if (
        typeFilter !== "all" &&
        String(client.client_category || "") !== typeFilter
      ) {
        return false;
      }

      return true;
    });
  }, [clients, search, statusFilter, typeFilter]);

  const mappedCount = clients.filter((client) => Boolean(client.mapping)).length;
  const suggestionCount = suggestions.size;

  async function saveMapping(clientId: string, folderPath: string) {
    const folder = folderByPath.get(folderPath);

    if (!folder) {
      setError("Choose a valid Egnyte folder.");
      return;
    }

    setSavingClientId(clientId);
    setError("");
    setNotice("");

    try {
      const result = await authFetch(
        "/api/settings/document-providers/client-folders",
        {
          method: "POST",
          body: JSON.stringify({
            clientId,
            folderId: folder.id,
            folderPath: folder.path,
            folderName: folder.name,
          }),
        }
      );

      setClients((current) =>
        current.map((client) =>
          client.id === clientId
            ? {
                ...client,
                mapping: result.mapping,
              }
            : client
        )
      );

      setNotice("Client Egnyte folder saved.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save the client folder."
      );
    } finally {
      setSavingClientId(null);
    }
  }

  async function clearMapping(clientId: string) {
    setSavingClientId(clientId);
    setError("");
    setNotice("");

    try {
      await authFetch(
        "/api/settings/document-providers/client-folders",
        {
          method: "DELETE",
          body: JSON.stringify({ clientId }),
        }
      );

      setClients((current) =>
        current.map((client) =>
          client.id === clientId
            ? { ...client, mapping: null }
            : client
        )
      );

      setNotice("Client folder link removed.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not remove the client folder link."
      );
    } finally {
      setSavingClientId(null);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <Link href="/settings/document-providers" style={styles.backLink}>
            ← Document Providers
          </Link>

          <h1 style={styles.title}>Client Folder Mapping</h1>

          <p style={styles.subtitle}>
            Link each PracticePilot client to the correct Egnyte folder. This is
            saved once and reused by Documents, uploads, reviews and the client
            portal.
          </p>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <Summary label="PP clients" value={clients.length} />
        <Summary label="Mapped" value={mappedCount} />
        <Summary label="Unmapped" value={clients.length - mappedCount} />
        <Summary label="Strong suggestions" value={suggestionCount} />
      </section>

      <section style={styles.filterBar}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search client or Egnyte folder..."
          style={styles.search}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          style={styles.select}
        >
          <option value="all">All mapping states</option>
          <option value="mapped">Mapped</option>
          <option value="unmapped">Unmapped</option>
        </select>

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          style={styles.select}
        >
          <option value="all">All record types</option>
          <option value="entity">Entities</option>
          <option value="individual">Individuals</option>
          <option value="trust">Trusts</option>
        </select>

        <strong style={styles.resultCount}>
          {visibleClients.length} clients
        </strong>
      </section>

      {error ? <div style={styles.error}>{error}</div> : null}
      {notice ? <div style={styles.notice}>{notice}</div> : null}

      <section style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Client</span>
          <span>Record Type</span>
          <span>Current Egnyte Folder</span>
          <span>Link Folder</span>
          <span />
        </div>

        {loading ? (
          <div style={styles.empty}>Loading client folders...</div>
        ) : (
          visibleClients.map((client) => {
            const expectedBranch =
              String(client.client_category || "").toLowerCase() === "individual"
                ? "Individuals"
                : "Entities";

            const availableFolders = folders.filter(
              (folder) => folder.branch === expectedBranch
            );

            const suggestion = suggestions.get(client.id) || null;

            return (
              <div key={client.id} style={styles.row}>
                <div>
                  <strong style={styles.clientName}>{client.client_name}</strong>
                  <span style={styles.clientMeta}>
                    {client.client_code || "No PP code"}
                  </span>
                </div>

                <span style={styles.typePill}>
                  {client.client_category || "entity"}
                </span>

                <div>
                  {client.mapping ? (
                    <>
                      <strong style={styles.folderName}>
                        {client.mapping.folder_name ||
                          client.mapping.folder_path.split("/").pop() ||
                          "Linked folder"}
                      </strong>
                      <span style={styles.folderPath}>
                        {client.mapping.folder_path}
                      </span>
                    </>
                  ) : suggestion ? (
                    <>
                      <span style={styles.suggestionLabel}>Suggested</span>
                      <strong style={styles.folderName}>{suggestion.name}</strong>
                      <span style={styles.folderPath}>{suggestion.path}</span>
                    </>
                  ) : (
                    <span style={styles.unmapped}>Not linked</span>
                  )}
                </div>

                <select
                  defaultValue={client.mapping?.folder_path || suggestion?.path || ""}
                  onChange={(event) => {
                    if (event.target.value) {
                      void saveMapping(client.id, event.target.value);
                    }
                  }}
                  disabled={savingClientId === client.id}
                  style={styles.folderSelect}
                >
                  <option value="">Choose {expectedBranch} folder...</option>

                  {availableFolders.map((folder) => (
                    <option key={folder.path} value={folder.path}>
                      {folder.name}
                    </option>
                  ))}
                </select>

                <div style={styles.rowActions}>
                  {suggestion && !client.mapping ? (
                    <button
                      type="button"
                      onClick={() => void saveMapping(client.id, suggestion.path)}
                      disabled={savingClientId === client.id}
                      style={styles.useSuggestion}
                    >
                      Use Suggestion
                    </button>
                  ) : null}

                  {client.mapping ? (
                    <button
                      type="button"
                      onClick={() => void clearMapping(client.id)}
                      disabled={savingClientId === client.id}
                      style={styles.clearButton}
                    >
                      Unlink
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        {!loading && visibleClients.length === 0 ? (
          <div style={styles.empty}>No clients match the current filters.</div>
        ) : null}
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.summary}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px 20px 32px",
    background: "#f5f7fa",
    color: "#10233a",
  },

  header: {
    padding: "12px 4px 14px",
    borderTop: "3px solid #10233a",
    borderBottom: "1px solid #d8dee7",
  },

  backLink: {
    color: "#1758d5",
    textDecoration: "none",
    fontSize: 9,
    fontWeight: 900,
  },

  title: {
    margin: "5px 0 0",
    fontSize: 20,
    fontWeight: 950,
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 9,
  },

  summaryGrid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    background: "#ffffff",
    border: "1px solid #d8dee7",
  },

  summary: {
    minHeight: 56,
    padding: "8px 10px",
    display: "grid",
    alignContent: "center",
    borderRight: "1px solid #e2e8f0",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: 850,
  },

  summaryValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: 950,
  },

  filterBar: {
    marginTop: 8,
    padding: 8,
    display: "grid",
    gridTemplateColumns: "1fr 220px 180px auto",
    gap: 7,
    alignItems: "center",
    background: "#ffffff",
    border: "1px solid #d8dee7",
  },

  search: {
    height: 30,
    padding: "0 8px",
    border: "1px solid #cbd5e1",
    fontSize: 9,
  },

  select: {
    height: 30,
    padding: "0 7px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: 9,
  },

  resultCount: {
    color: "#64748b",
    fontSize: 8.5,
  },

  error: {
    marginTop: 8,
    padding: "8px 10px",
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b42318",
    fontSize: 8.5,
    fontWeight: 850,
  },

  notice: {
    marginTop: 8,
    padding: "8px 10px",
    border: "1px solid #bbf7d0",
    background: "#ecfdf3",
    color: "#166534",
    fontSize: 8.5,
    fontWeight: 850,
  },

  table: {
    marginTop: 8,
    background: "#ffffff",
    border: "1px solid #d8dee7",
  },

  tableHeader: {
    minHeight: 34,
    padding: "0 9px",
    display: "grid",
    gridTemplateColumns: "1.4fr 110px 1.4fr 1.1fr 150px",
    gap: 8,
    alignItems: "center",
    background: "#f4f7fa",
    borderBottom: "1px solid #d8dee7",
    color: "#526174",
    fontSize: 8,
    fontWeight: 900,
  },

  row: {
    minHeight: 58,
    padding: "7px 9px",
    display: "grid",
    gridTemplateColumns: "1.4fr 110px 1.4fr 1.1fr 150px",
    gap: 8,
    alignItems: "center",
    borderBottom: "1px solid #e7edf4",
  },

  clientName: {
    display: "block",
    fontSize: 9.2,
    fontWeight: 900,
  },

  clientMeta: {
    display: "block",
    marginTop: 2,
    color: "#94a3b8",
    fontSize: 7.8,
  },

  typePill: {
    justifySelf: "start",
    padding: "4px 7px",
    borderRadius: 999,
    background: "#e8f0ff",
    color: "#1957d2",
    fontSize: 7.8,
    fontWeight: 900,
    textTransform: "capitalize",
  },

  folderName: {
    display: "block",
    fontSize: 8.8,
    fontWeight: 900,
  },

  folderPath: {
    display: "block",
    marginTop: 2,
    color: "#64748b",
    fontSize: 7.5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  suggestionLabel: {
    display: "inline-block",
    marginBottom: 3,
    padding: "2px 5px",
    background: "#fff7ed",
    color: "#9a6700",
    fontSize: 7,
    fontWeight: 900,
  },

  unmapped: {
    color: "#94a3b8",
    fontSize: 8.5,
  },

  folderSelect: {
    width: "100%",
    height: 30,
    minWidth: 0,
    padding: "0 6px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: 8.5,
  },

  rowActions: {
    display: "flex",
    gap: 5,
    justifyContent: "flex-end",
  },

  useSuggestion: {
    height: 28,
    padding: "0 8px",
    border: "1px solid #1758d5",
    background: "#1758d5",
    color: "#ffffff",
    fontSize: 7.8,
    fontWeight: 900,
    cursor: "pointer",
  },

  clearButton: {
    height: 28,
    padding: "0 8px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#475569",
    fontSize: 7.8,
    fontWeight: 900,
    cursor: "pointer",
  },

  empty: {
    padding: 18,
    color: "#64748b",
    textAlign: "center",
    fontSize: 9,
  },
};
