"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type PreviewDocument = {
  id: string;
  document_name: string;
  provider_path: string;
  portal_category: string | null;
  portal_category_label?: string | null;
  released_at?: string | null;
  approved_at?: string | null;
  updated_at?: string | null;
};

type ClientInfo = {
  id: string;
  client_name: string;
  trading_name?: string | null;
};

type PreviewResponse = {
  success?: boolean;
  client?: ClientInfo;
  documents?: PreviewDocument[];
  counts?: {
    total?: number;
    needs_action?: number;
    awaiting_our_work?: number;
    for_your_records?: number;
  };
  category_counts?: Record<string, number>;
  error?: string;
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
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function categoryLabel(value: string | null | undefined) {
  return (
    CATEGORIES.find(([key]) => key === String(value || ""))?.[1] ||
    "General"
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function canPreview(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["pdf", "png", "jpg", "jpeg", "webp", "gif", "txt"].includes(ext);
}

export default function ClientPortalStaffPreviewPage() {
  const params = useParams<{ id: string }>();
  const clientId = String(params?.id || "");

  const [data, setData] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState("");
  const [previewing, setPreviewing] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function authToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your PracticePilot login session could not be confirmed.");
    }

    return session.access_token;
  }

  async function load() {
    if (!clientId) return;

    setLoading(true);
    setError("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/portal-preview`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = (await response.json()) as PreviewResponse;

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || "Could not load the client portal preview.");
      }

      setData({
        ...result,
        client: result.client || {
          id: clientId,
          client_name: "Client",
        },
        documents: result.documents || [],
        category_counts: result.category_counts || {},
      });
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

  async function documentBlob(document: PreviewDocument) {
    const token = await authToken();

    const query = new URLSearchParams({
      path: document.provider_path,
    });

    const response = await fetch(
      `/api/crm/clients/${clientId}/documents/download?${query.toString()}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "Could not load the document.");
    }

    return response.blob();
  }

  async function preview(document: PreviewDocument) {
    if (!canPreview(document.document_name)) return;

    setPreviewing(document.id);
    const popup = window.open("", "_blank");

    try {
      const blob = await documentBlob(document);
      const url = URL.createObjectURL(blob);

      if (popup) {
        popup.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (caught) {
      popup?.close();
      window.alert(
        caught instanceof Error ? caught.message : "Could not preview document."
      );
    } finally {
      setPreviewing("");
    }
  }

  async function download(document: PreviewDocument) {
    setDownloading(document.id);

    try {
      const blob = await documentBlob(document);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");

      link.href = url;
      link.download = document.document_name;
      window.document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      window.alert(
        caught instanceof Error ? caught.message : "Could not download document."
      );
    } finally {
      setDownloading("");
    }
  }

  const documents = data?.documents || [];

  const categoryCounts = useMemo(() => {
    const base: Record<string, number> = {
      all: documents.length,
      ...(data?.category_counts || {}),
    };

    for (const document of documents) {
      const key = document.portal_category || "general";
      if (!(key in base)) {
        base[key] = documents.filter(
          (item) => (item.portal_category || "general") === key
        ).length;
      }
    }

    return base;
  }, [data?.category_counts, documents]);

  const visibleDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return documents.filter((document) => {
      const categoryMatch =
        category === "all" ||
        (document.portal_category || "general") === category;

      const searchMatch =
        !term ||
        [
          document.document_name,
          categoryLabel(document.portal_category),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      return categoryMatch && searchMatch;
    });
  }, [documents, category, search]);

  if (loading) {
    return <main style={styles.loading}>Loading client portal preview...</main>;
  }

  if (error || !data?.client) {
    return (
      <main style={styles.loading}>
        {error || "Could not load client portal preview."}
      </main>
    );
  }

  const client = data.client;
  const total = data.counts?.total ?? documents.length;
  const needsAction = data.counts?.needs_action ?? 0;
  const awaitingOurWork = data.counts?.awaiting_our_work ?? 0;
  const records = data.counts?.for_your_records ?? documents.length;

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <div style={styles.brand}>PracticePilot</div>

        <div style={styles.clientBlock}>
          <div style={styles.avatar}>{initials(client.client_name) || "PP"}</div>
          <div>
            <strong style={styles.clientName}>{client.client_name}</strong>
            <span style={styles.clientSub}>Client Portal · Staff Preview</span>
          </div>
        </div>
      </header>

      <div style={styles.portalShell}>
        <aside style={styles.sideNav}>
          <div style={styles.sideBrand}>
            <div style={styles.sideBrandMark}>PP</div>
            <div>
              <strong style={styles.sideBrandName}>PracticePilot</strong>
              <span style={styles.sideBrandSub}>Client Portal</span>
            </div>
          </div>

          <div style={styles.sideNavItems}>
            <span style={styles.sideNavMuted}>
              <span style={styles.sideIcon}>⌂</span>
              Dashboard
            </span>

            <span style={styles.sideNavActive}>
              <span style={styles.sideIcon}>▣</span>
              Documents
            </span>

            <span style={styles.sideNavMuted}>
              <span style={styles.sideIcon}>□</span>
              Messages
            </span>

            <span style={styles.sideNavMuted}>
              <span style={styles.sideIcon}>⊕</span>
              Requests
            </span>

            <span style={styles.sideNavMuted}>
              <span style={styles.sideIcon}>○</span>
              My Profile
            </span>
          </div>

          <div style={styles.staffPreviewBox}>
            <strong>Staff Preview</strong>
            <span>
              This mirrors the client-facing portal. No client actions are performed here.
            </span>
          </div>
        </aside>

        <section style={styles.documentsMain}>
          <section style={styles.hero}>
            <div>
              <div style={styles.eyebrow}>CLIENT DOCUMENTS</div>
              <h1 style={styles.heroTitle}>Your Documents</h1>
              <p style={styles.heroSub}>
                Everything shared with you, organised and ready when you need it.
              </p>
            </div>

            <span style={styles.previewBadge}>STAFF PREVIEW</span>
          </section>

          <section style={styles.metrics}>
            <Metric value={total} label="Latest documents" note="Released to the client" />
            <Metric value={needsAction} label="Needs your action" note="Items requiring attention" />
            <Metric value={awaitingOurWork} label="Awaiting our work" note="Currently in progress" />
            <Metric value={records} label="For your records" note="Available anytime" />
          </section>

          <section style={styles.documentPanel}>
            <aside style={styles.categories}>
              <div style={styles.categoriesHeader}>
                <strong>Document Categories</strong>
                <span>Browse what has been shared with you.</span>
              </div>

              {CATEGORIES.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  style={{
                    ...styles.categoryButton,
                    ...(category === key ? styles.categoryButtonActive : {}),
                  }}
                >
                  <span>{label}</span>
                  <strong>{categoryCounts[key] || 0}</strong>
                </button>
              ))}
            </aside>

            <div style={styles.documentListWrap}>
              <div style={styles.listHeader}>
                <div>
                  <strong style={styles.listTitle}>
                    {category === "all"
                      ? "All Documents"
                      : categoryLabel(category)}
                  </strong>
                  <span style={styles.listSub}>
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
                  <div key={document.id} style={styles.tableRow}>
                    <div style={styles.nameCell}>
                      <span style={styles.pdfBadge}>PDF</span>
                      <div>
                        <strong>{document.document_name}</strong>
                        <span>Available in your portal</span>
                      </div>
                    </div>

                    <span style={styles.tableText}>
                      {document.portal_category_label ||
                        categoryLabel(document.portal_category)}
                    </span>

                    <span style={styles.tableText}>
                      {formatDate(
                        document.released_at ||
                          document.approved_at ||
                          document.updated_at
                      )}
                    </span>

                    <span style={styles.statusBadge}>For your records</span>

                    <div style={styles.actions}>
                      {canPreview(document.document_name) ? (
                        <button
                          type="button"
                          onClick={() => void preview(document)}
                          disabled={previewing === document.id}
                          style={styles.previewButton}
                        >
                          {previewing === document.id ? "Opening..." : "Preview"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => void download(document)}
                        disabled={downloading === document.id}
                        style={styles.downloadButton}
                      >
                        {downloading === document.id ? "..." : "Download"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.empty}>No documents match this view.</div>
              )}

              <div style={styles.helpStrip}>
                <div>
                  <strong>Can&apos;t find something?</strong>
                  <span>
                    Document requests and secure messages are coming next.
                  </span>
                </div>
                <button type="button" disabled style={styles.disabledButton}>
                  New Message
                </button>
              </div>
            </div>
          </section>
        </section>
      </div>
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
    <div style={styles.metricCard}>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricLabel}>{label}</span>
      <small style={styles.metricNote}>{note}</small>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    margin: 0,
    background: "#f4f7fa",
    color: "#10233a",
  },
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f4f7fa",
    color: "#526577",
    fontSize: 14,
    fontWeight: 800,
  },
  topbar: {
    height: 64,
    padding: "0 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #dce4ec",
    background: "#ffffff",
  },
  brand: {
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  clientBlock: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 950,
  },
  clientName: {
    display: "block",
    fontSize: 12,
  },
  clientSub: {
    display: "block",
    marginTop: 2,
    color: "#748191",
    fontSize: 9,
  },
  portalShell: {
    maxWidth: 1500,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "255px minmax(0, 1fr)",
    minHeight: "calc(100vh - 64px)",
  },
  sideNav: {
    position: "relative",
    padding: "22px 14px 20px",
    borderRight: "1px solid #dce4ec",
    background: "#ffffff",
  },
  sideBrand: {
    padding: "8px 12px 22px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  sideBrandMark: {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: 6,
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 950,
  },
  sideBrandName: {
    display: "block",
    fontSize: 16,
    fontWeight: 950,
  },
  sideBrandSub: {
    display: "block",
    marginTop: 2,
    color: "#7a8796",
    fontSize: 10,
  },
  sideNavItems: {
    display: "grid",
    gap: 4,
  },
  sideNavActive: {
    minHeight: 44,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderLeft: "3px solid #1768d2",
    background: "#eaf3ff",
    color: "#1768d2",
    fontSize: 11,
    fontWeight: 900,
  },
  sideNavMuted: {
    minHeight: 44,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#8a97a6",
    fontSize: 11,
    fontWeight: 800,
  },
  sideIcon: {
    width: 18,
    textAlign: "center",
  },
  staffPreviewBox: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 20,
    padding: 12,
    display: "grid",
    gap: 5,
    border: "1px solid #cfe0f5",
    background: "#eef6ff",
    color: "#375a7a",
    fontSize: 9,
    lineHeight: 1.45,
  },
  documentsMain: {
    padding: "24px 26px 34px",
    minWidth: 0,
  },
  hero: {
    minHeight: 120,
    padding: "24px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    borderRadius: 10,
    background:
      "linear-gradient(115deg, #102f50 0%, #174e79 55%, #1d6b88 100%)",
    color: "#ffffff",
  },
  eyebrow: {
    marginBottom: 5,
    fontSize: 8,
    fontWeight: 950,
    letterSpacing: "0.11em",
    opacity: 0.78,
  },
  heroTitle: {
    margin: 0,
    fontSize: 32,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  heroSub: {
    margin: "7px 0 0",
    fontSize: 12,
    opacity: 0.9,
  },
  previewBadge: {
    padding: "8px 11px",
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontSize: 8,
    fontWeight: 950,
    letterSpacing: "0.06em",
  },
  metrics: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  metricCard: {
    minHeight: 112,
    padding: "16px 18px",
    display: "grid",
    alignContent: "center",
    gap: 4,
    border: "1px solid #d9e2ec",
    borderRadius: 10,
    background: "#ffffff",
  },
  metricValue: {
    fontSize: 28,
    lineHeight: 1,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: 950,
  },
  metricNote: {
    color: "#84909d",
    fontSize: 9,
  },
  documentPanel: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    border: "1px solid #d9e2ec",
    borderRadius: 10,
    overflow: "hidden",
    background: "#ffffff",
  },
  categories: {
    borderRight: "1px solid #d9e2ec",
    background: "#fbfcfd",
  },
  categoriesHeader: {
    padding: "16px",
    display: "grid",
    gap: 4,
    borderBottom: "1px solid #e4eaf0",
    fontSize: 11,
  },
  categoryButton: {
    width: "100%",
    minHeight: 44,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: "none",
    borderLeft: "3px solid transparent",
    background: "transparent",
    color: "#34495e",
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
  documentListWrap: {
    minWidth: 0,
  },
  listHeader: {
    minHeight: 66,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottom: "1px solid #d9e2ec",
  },
  listTitle: {
    display: "block",
    fontSize: 14,
  },
  listSub: {
    display: "block",
    marginTop: 3,
    color: "#84909d",
    fontSize: 9,
  },
  search: {
    width: 300,
    height: 38,
    padding: "0 11px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 11,
    outline: "none",
  },
  tableHeader: {
    minHeight: 38,
    padding: "0 14px",
    display: "grid",
    gridTemplateColumns: "minmax(310px, 1.8fr) 1fr 120px 135px 188px",
    gap: 12,
    alignItems: "center",
    background: "#f4f7fa",
    borderBottom: "1px solid #d9e2ec",
    color: "#607083",
    fontSize: 8,
    fontWeight: 900,
  },
  tableRow: {
    minHeight: 70,
    padding: "9px 14px",
    display: "grid",
    gridTemplateColumns: "minmax(310px, 1.8fr) 1fr 120px 135px 188px",
    gap: 12,
    alignItems: "center",
    borderBottom: "1px solid #e8edf2",
  },
  nameCell: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  pdfBadge: {
    width: 40,
    height: 40,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
    borderRadius: 4,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 950,
  },
  tableText: {
    color: "#667789",
    fontSize: 9,
  },
  statusBadge: {
    justifySelf: "start",
    padding: "5px 9px",
    borderRadius: 999,
    background: "#e9f8ef",
    color: "#218653",
    fontSize: 8,
    fontWeight: 900,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
  },
  previewButton: {
    minWidth: 82,
    height: 34,
    border: "1px solid #1768d2",
    borderRadius: 5,
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  downloadButton: {
    minWidth: 92,
    height: 34,
    border: "1px solid #bfd0e4",
    borderRadius: 5,
    background: "#ffffff",
    color: "#1768d2",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    minHeight: 180,
    display: "grid",
    placeItems: "center",
    color: "#84909d",
    fontSize: 10,
  },
  helpStrip: {
    margin: 14,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    border: "1px solid #cde6d6",
    background: "#effaf3",
    color: "#3f6f54",
    fontSize: 9,
  },
  disabledButton: {
    height: 32,
    padding: "0 14px",
    border: "1px solid #bcd8c5",
    background: "#ffffff",
    color: "#6f8e7b",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "not-allowed",
  },
};
