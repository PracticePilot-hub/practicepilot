"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type PortalDocument = {
  id: string;
  provider_path: string;
  document_name: string;
  portal_category: string;
  portal_category_label: string;
  workflow_status: string;
  client_visible: boolean;
  released_at: string | null;
  approved_at: string | null;
  updated_at: string | null;
};

type PortalResponse = {
  success: boolean;
  client: {
    id: string;
    client_name: string;
    trading_name?: string | null;
    registration_number?: string | null;
    client_code?: string | null;
  };
  documents: PortalDocument[];
  counts: {
    total: number;
    needs_action: number;
    awaiting_our_work: number;
    for_your_records: number;
  };
  category_counts: Record<string, number>;
};

const CATEGORIES = [
  ["all", "All Documents"],
  ["financial_statements", "Financial Statements"],
  ["tax", "Tax"],
  ["management_accounts", "Management Accounts"],
  ["payroll", "Payroll"],
  ["secretarial", "Secretarial"],
  ["company_documents", "Company Documents"],
  ["agreements_contracts", "Agreements & Contracts"],
  ["general", "General"],
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")
  ).toUpperCase();
}

function fileType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "PDF";
  if (["xls", "xlsx"].includes(ext)) return "XLS";
  if (["doc", "docx"].includes(ext)) return "DOC";
  return ext ? ext.toUpperCase() : "FILE";
}

export default function ClientPortalPreviewPage() {
  const params = useParams<{ id: string }>();
  const clientId = String(params?.id || "");

  const [data, setData] = useState<PortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function load() {
    if (!clientId) return;

    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your PracticePilot login session could not be confirmed."
        );
      }

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/portal-preview`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not load the client portal preview."
        );
      }

      setData(result as PortalResponse);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load the client portal preview."
      );
    } finally {
      setLoading(false);
    }
  }

  async function download(portalDocument: PortalDocument) {
    setDownloading(portalDocument.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your PracticePilot login session could not be confirmed."
        );
      }

      const query = new URLSearchParams({
        path: portalDocument.provider_path,
        disposition: "attachment",
      });

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/download?${query.toString()}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Could not download the document.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = portalDocument.document_name;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (caught) {
      alert(
        caught instanceof Error
          ? caught.message
          : "Could not download the document."
      );
    } finally {
      setDownloading("");
    }
  }

  const visibleDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (data?.documents || []).filter((document) => {
      if (
        category !== "all" &&
        document.portal_category !== category
      ) {
        return false;
      }

      if (
        term &&
        ![
          document.document_name,
          document.portal_category_label,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }

      return true;
    });
  }, [data, category, search]);

  const clientName = data?.client?.client_name || "Client";
  const selectedCategoryLabel =
    CATEGORIES.find(([value]) => value === category)?.[1] ||
    "All Documents";

  if (loading) {
    return <main style={styles.loading}>Loading client portal preview...</main>;
  }

  if (error || !data) {
    return (
      <main style={styles.loading}>
        {error || "Client portal preview could not be loaded."}
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <div style={styles.brand}>PracticePilot</div>

        <nav style={styles.nav}>
          <span style={styles.navItem}>Home</span>
          <span style={{ ...styles.navItem, ...styles.navActive }}>
            Documents
          </span>
          <span style={styles.navItem}>Tasks</span>
          <span style={styles.navItem}>Messages</span>
        </nav>

        <div style={styles.clientIdentity}>
          <span style={styles.avatar}>{initials(clientName)}</span>
          <span>
            <strong>{clientName}</strong>
            <small>Client Portal Preview</small>
          </span>
        </div>
      </header>

      <section style={styles.hero}>
        <div>
          <h1 style={styles.heroTitle}>Your Documents</h1>
          <p style={styles.heroText}>
            Everything in one place. Clear, current and ready when you need it.
          </p>
        </div>
        <div style={styles.previewBadge}>Staff Preview</div>
      </section>

      <section style={styles.metrics}>
        <Metric
          value={data.counts.total}
          label="Latest documents"
          note="Released to the client"
        />
        <Metric
          value={data.counts.needs_action}
          label="Needs your action"
          note="Items requiring attention"
        />
        <Metric
          value={data.counts.awaiting_our_work}
          label="Awaiting our work"
          note="Currently in progress"
        />
        <Metric
          value={data.counts.for_your_records}
          label="For your records"
          note="Available anytime"
        />
      </section>

      <section style={styles.workspace}>
        <aside style={styles.categories}>
          {CATEGORIES.map(([value, label]) => {
            const count =
              value === "all"
                ? data.counts.total
                : data.category_counts[value] || 0;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                style={{
                  ...styles.categoryButton,
                  ...(category === value
                    ? styles.categoryButtonActive
                    : {}),
                }}
              >
                <span>{label}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </aside>

        <section style={styles.documentsPanel}>
          <div style={styles.toolbar}>
            <div>
              <strong style={styles.sectionTitle}>
                {selectedCategoryLabel}
              </strong>
              <span style={styles.sectionMeta}>
                {visibleDocuments.length} document
                {visibleDocuments.length === 1 ? "" : "s"}
              </span>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
              style={styles.search}
            />
          </div>

          <div style={styles.tableHeader}>
            <span>Name</span>
            <span>Category</span>
            <span>Date</span>
            <span>Status</span>
            <span />
          </div>

          {visibleDocuments.length ? (
            visibleDocuments.map((document) => (
              <div key={document.id} style={styles.documentRow}>
                <div style={styles.documentNameCell}>
                  <span style={styles.fileBadge}>
                    {fileType(document.document_name)}
                  </span>
                  <div>
                    <strong style={styles.documentName}>
                      {document.document_name}
                    </strong>
                    <span style={styles.documentSub}>
                      Available in your portal
                    </span>
                  </div>
                </div>

                <span style={styles.cellText}>
                  {document.portal_category_label}
                </span>

                <span style={styles.cellText}>
                  {formatDate(document.released_at)}
                </span>

                <span style={styles.recordPill}>For your records</span>

                <button
                  type="button"
                  onClick={() => void download(document)}
                  disabled={downloading === document.id}
                  style={styles.downloadButton}
                >
                  {downloading === document.id ? "..." : "Download"}
                </button>
              </div>
            ))
          ) : (
            <div style={styles.empty}>
              No released documents match this view.
            </div>
          )}

          <div style={styles.actionStrip}>
            <div>
              <strong>Can&apos;t find something?</strong>
              <span>
                This will later connect directly to Messages and document
                requests.
              </span>
            </div>
            <button type="button" disabled style={styles.messageButton}>
              New Message
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({
  value,
  label,
  note,
}: {
  value: number;
  label: string;
  note: string;
}) {
  return (
    <div style={styles.metric}>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricLabel}>{label}</span>
      <small style={styles.metricNote}>{note}</small>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f6f9",
    color: "#10233a",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f3f6f9",
    color: "#10233a",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: 800,
  },
  topbar: {
    minHeight: 66,
    padding: "0 28px",
    display: "grid",
    gridTemplateColumns: "210px minmax(0, 1fr) auto",
    alignItems: "stretch",
    gap: 16,
    background: "#ffffff",
    borderBottom: "1px solid #d9e1e9",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    fontSize: 21,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  nav: {
    display: "flex",
    alignItems: "stretch",
    gap: 6,
  },
  navItem: {
    minWidth: 90,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderBottom: "3px solid transparent",
    color: "#56677a",
    fontSize: 12,
    fontWeight: 800,
  },
  navActive: {
    color: "#1768d2",
    borderBottomColor: "#1768d2",
    background: "#f5f9ff",
  },
  clientIdentity: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "#164b9b",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 950,
  },
  hero: {
    margin: "0 auto",
    maxWidth: 1250,
    minHeight: 135,
    padding: "28px 34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    background:
      "linear-gradient(115deg, #102f50 0%, #174e79 55%, #1d6b88 100%)",
    color: "#ffffff",
  },
  heroTitle: {
    margin: 0,
    fontSize: 27,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  heroText: {
    margin: "7px 0 0",
    fontSize: 12,
    opacity: 0.9,
  },
  previewBadge: {
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.10)",
    fontSize: 10,
    fontWeight: 900,
  },
  metrics: {
    maxWidth: 1210,
    margin: "-18px auto 0",
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    border: "1px solid #d9e1e9",
    background: "#ffffff",
    position: "relative",
  },
  metric: {
    minHeight: 86,
    padding: "15px 18px",
    display: "grid",
    alignContent: "center",
    gap: 3,
    borderRight: "1px solid #e3e8ee",
  },
  metricValue: {
    fontSize: 21,
    fontWeight: 950,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 900,
  },
  metricNote: {
    color: "#7a8794",
    fontSize: 9,
  },
  workspace: {
    maxWidth: 1210,
    margin: "14px auto 30px",
    display: "grid",
    gridTemplateColumns: "235px minmax(0, 1fr)",
    border: "1px solid #d9e1e9",
    background: "#ffffff",
  },
  categories: {
    padding: "10px 0",
    borderRight: "1px solid #d9e1e9",
    background: "#f8fafc",
  },
  categoryButton: {
    width: "100%",
    minHeight: 43,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    border: "none",
    borderLeft: "3px solid transparent",
    background: "transparent",
    color: "#33485f",
    fontSize: 10,
    fontWeight: 800,
    textAlign: "left",
    cursor: "pointer",
  },
  categoryButtonActive: {
    borderLeftColor: "#1768d2",
    background: "#eaf3ff",
    color: "#1768d2",
  },
  documentsPanel: {
    minWidth: 0,
  },
  toolbar: {
    minHeight: 66,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #d9e1e9",
  },
  sectionTitle: {
    display: "block",
    fontSize: 15,
    fontWeight: 950,
  },
  sectionMeta: {
    display: "block",
    marginTop: 3,
    color: "#7a8794",
    fontSize: 9,
  },
  search: {
    width: 280,
    height: 36,
    padding: "0 10px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    outline: "none",
  },
  tableHeader: {
    minHeight: 36,
    padding: "0 12px",
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1.7fr) 1fr 120px 130px 90px",
    alignItems: "center",
    gap: 10,
    background: "#f3f6f9",
    borderBottom: "1px solid #d9e1e9",
    color: "#617184",
    fontSize: 8.5,
    fontWeight: 900,
  },
  documentRow: {
    minHeight: 62,
    padding: "8px 12px",
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1.7fr) 1fr 120px 130px 90px",
    alignItems: "center",
    gap: 10,
    borderBottom: "1px solid #e6ebf0",
  },
  documentNameCell: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  fileBadge: {
    width: 36,
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#e63e42",
    color: "#ffffff",
    fontSize: 8,
    fontWeight: 950,
    flex: "0 0 auto",
  },
  documentName: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 10,
    fontWeight: 900,
  },
  documentSub: {
    display: "block",
    marginTop: 3,
    color: "#84909d",
    fontSize: 8,
  },
  cellText: {
    color: "#526577",
    fontSize: 9,
  },
  recordPill: {
    justifySelf: "start",
    minHeight: 24,
    padding: "0 9px",
    display: "inline-flex",
    alignItems: "center",
    background: "#e9f8ef",
    color: "#16834f",
    borderRadius: 999,
    fontSize: 8,
    fontWeight: 900,
  },
  downloadButton: {
    height: 30,
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 8,
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    minHeight: 180,
    display: "grid",
    placeItems: "center",
    color: "#7a8794",
    fontSize: 10,
  },
  actionStrip: {
    margin: 14,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    border: "1px solid #cfe1d7",
    background: "#f2fbf6",
    color: "#285c42",
    fontSize: 9,
  },
  messageButton: {
    height: 32,
    padding: "0 12px",
    border: "1px solid #a8c8b5",
    background: "#ffffff",
    color: "#789384",
    fontWeight: 900,
  },
};
