"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type PortalDocument = {
  id: string;
  item_type?: "file" | "folder";
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
  portal_user: {
    full_name: string | null;
    email: string;
    portal_role: string;
    can_view_documents: boolean;
    can_approve_actions: boolean;
  };
  client: {
    id: string;
    client_name: string;
    trading_name?: string | null;
    registration_number?: string | null;
    client_code?: string | null;
  };
  clients: Array<{
    id: string;
    client_name: string;
    trading_name?: string | null;
  }>;
  documents: PortalDocument[];
  counts: {
    total: number;
    needs_action: number;
    awaiting_our_work: number;
    for_your_records: number;
  };
  category_counts: Record<string, number>;
  requests: Array<{
    id: string;
    request_type: string;
    title: string;
    description: string | null;
    due_date: string | null;
    status: string;
    priority: string;
    assigned_portal_user_id: string | null;
    requires_upload: boolean;
    requires_response: boolean;
    requires_approval: boolean;
    response_text: string | null;
    submitted_at: string | null;
    completed_at: string | null;
  }>;
};

const CATEGORIES = [
  ["all", "All Documents"],
  ["financial_statements", "Financial Statements"],
  ["tax", "Tax"],
  ["management_accounts", "Management Accounts"],
  ["vat", "VAT"],
  ["payroll", "Payroll"],
  ["secretarial", "Secretarial"],
  ["company_documents", "Company Documents"],
  ["agreements_contracts", "Agreements & Contracts"],
  ["general", "General"],
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);

  return (
    (parts[0]?.[0] || "") +
    (parts[1]?.[0] || parts[0]?.[1] || "")
  ).toUpperCase();
}

function fileType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";

  if (ext === "pdf") return "PDF";
  if (["xls", "xlsx"].includes(ext)) return "XLS";
  if (["doc", "docx"].includes(ext)) return "DOC";

  return ext ? ext.toUpperCase() : "FILE";
}

function canPreviewDocument(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";

  return [
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "txt",
  ].includes(ext);
}

function normalisePortalPath(value: string) {
  const parts = String(value || "").split("/").filter(Boolean);
  return `/${parts.join("/")}`;
}

function parentPortalPath(value: string) {
  const normalised = normalisePortalPath(value);
  const slash = normalised.lastIndexOf("/");
  return slash > 0 ? normalised.slice(0, slash) : "/";
}

function isFolderItem(item: PortalDocument) {
  return item.item_type === "folder";
}

function requestTypeLabel(value: string) {
  const labels: Record<string, string> = {
    document_request: "Document request",
    approval: "Approval",
    confirmation: "Confirmation",
    question: "Question",
  };

  return labels[value] || "Request";
}

function requestStatusLabel(value: string) {
  const labels: Record<string, string> = {
    new: "New",
    in_progress: "In progress",
    submitted: "Submitted",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return labels[value] || value;
}

function PortalIcon({
  name,
  size = 20,
}: {
  name:
    | "home"
    | "documents"
    | "messages"
    | "requests"
    | "profile"
    | "clock"
    | "check"
    | "shield"
    | "link"
    | "download"
    | "search"
    | "folder"
    | "megaphone";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<string, React.ReactNode> = {
    home: <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.5V20h13v-9.5" />
      <path d="M9.5 20v-6h5v6" />
    </>,
    documents: <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </>,
    messages: <>
      <path d="M4 5h16v11H8l-4 4z" />
      <path d="M8 9h8M8 12h5" />
    </>,
    requests: <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>,
    profile: <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6" />
    </>,
    clock: <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
    check: <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </>,
    shield: <>
      <path d="M12 3 5 6v5c0 4.5 2.4 7.7 7 10 4.6-2.3 7-5.5 7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>,
    link: <>
      <path d="M10 13a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 1 0-5.7-5.7L11 6.3" />
      <path d="M14 11a4 4 0 0 0-5.7 0L6 13.3A4 4 0 1 0 11.7 19l1.3-1.3" />
    </>,
    download: <>
      <path d="M12 4v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 20h14" />
    </>,
    search: <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>,
    folder: <path d="M3 6h7l2 2h9v10H3z" />,
    megaphone: <>
      <path d="M4 14h3l9 4V6L7 10H4z" />
      <path d="M7 14l1 5h3" />
    </>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export default function ClientPortalPage() {
  const searchParams = useSearchParams();

  const selectedClientId = String(searchParams.get("client") || "");
  const rawView = searchParams.get("view");
  const selectedRequestId = String(searchParams.get("request") || "");
  const currentView =
    rawView === "documents"
      ? "documents"
      : rawView === "requests"
        ? "requests"
        : "home";

  const [data, setData] = useState<PortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState("");
  const [previewing, setPreviewing] = useState("");
  const [openFolderPath, setOpenFolderPath] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  useEffect(() => {
    setOpenFolderPath("");
  }, [category, selectedClientId]);

  useEffect(() => {
    if (!data?.clients?.length) return;

    const storageKey = "practicepilot-client-portal:last-client";

    if (selectedClientId) {
      window.localStorage.setItem(storageKey, selectedClientId);
      return;
    }

    const savedClientId =
      window.localStorage.getItem(storageKey) || "";

    if (
      savedClientId &&
      data.clients.some((client) => client.id === savedClientId) &&
      savedClientId !== data.client.id
    ) {
      window.location.replace(
        portalHref(currentView, savedClientId)
      );
      return;
    }

    window.localStorage.setItem(storageKey, data.client.id);
  }, [data, selectedClientId, currentView]);

  function portalHref(
    view: "home" | "documents" | "requests",
    clientId = selectedClientId
  ) {
    const params = new URLSearchParams();

    if (clientId) {
      params.set("client", clientId);
    }

    if (view !== "home") {
      params.set("view", view);
    }

    const query = params.toString();

    return `/client-portal${query ? `?${query}` : ""}`;
  }

  async function load() {
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

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) throw aalError;

      if (aal?.currentLevel !== "aal2") {
        window.location.href = "/client-portal-mfa";
        return;
      }

      const query = selectedClientId
        ? `?client=${encodeURIComponent(selectedClientId)}`
        : "";

      const response = await fetch(`/api/client-portal/me${query}`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not load the Client Portal."
        );
      }

      setData(result as PortalResponse);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load the Client Portal."
      );
    } finally {
      setLoading(false);
    }
  }

  async function preview(portalDocument: PortalDocument) {
    if (!canPreviewDocument(portalDocument.document_name)) return;

    setPreviewing(portalDocument.id);

    const previewWindow = window.open("", "_blank");

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
        document: portalDocument.id,
      });

      const response = await fetch(
        `/api/client-portal/download?${query.toString()}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);

        throw new Error(
          result?.error || "Could not preview the document."
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
    } catch (caught) {
      previewWindow?.close();

      alert(
        caught instanceof Error
          ? caught.message
          : "Could not preview the document."
      );
    } finally {
      setPreviewing("");
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
        document: portalDocument.id,
      });

      const response = await fetch(
        `/api/client-portal/download?${query.toString()}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);

        throw new Error(
          result?.error || "Could not download the document."
        );
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
    const all = (data?.documents || []).filter((document) => {
      if (category !== "all" && document.portal_category !== category) {
        return false;
      }

      if (
        term &&
        ![
          document.document_name,
          document.portal_category_label,
          document.provider_path,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }

      return true;
    });

    if (term) return all;

    if (openFolderPath) {
      return all.filter(
        (document) => parentPortalPath(document.provider_path) === openFolderPath
      );
    }

    const releasedFolders = all
      .filter((document) => isFolderItem(document))
      .map((document) => normalisePortalPath(document.provider_path));

    return all.filter((document) => {
      const path = normalisePortalPath(document.provider_path);
      return !releasedFolders.some(
        (folderPath) => path !== folderPath && path.startsWith(`${folderPath}/`)
      );
    });
  }, [data, category, search, openFolderPath]);

  const recentDocuments = useMemo(
    () => (data?.documents || []).filter((item) => item.item_type !== "folder").slice(0, 5),
    [data]
  );

  if (loading) {
    return (
      <main style={styles.loading}>
        Loading your Client Portal...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main style={styles.loading}>
        {error || "Client Portal could not be loaded."}
      </main>
    );
  }

  const clientName = data.client.client_name || "Client";
  const portalUserName =
    data.portal_user.full_name ||
    data.portal_user.email ||
    "Client";

  const selectedCategoryLabel =
    CATEGORIES.find(([value]) => value === category)?.[1] ||
    "All Documents";

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <button
          type="button"
          onClick={() =>
            window.location.assign(portalHref("home"))
          }
          style={styles.brandButton}
        >
          PracticePilot
        </button>

        <div style={styles.clientIdentity}>
          <span style={styles.avatar}>
            {initials(clientName)}
          </span>

          <span style={styles.clientIdentityCopy}>
            <strong style={styles.clientIdentityName}>
              {clientName}
            </strong>
            <small style={styles.clientIdentitySub}>
              {portalUserName}
            </small>
          </span>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.assign("/login");
            }}
            style={styles.signOutButton}
          >
            Sign out
          </button>
        </div>
      </header>

      {currentView === "home" ? (
        <HomeView
          data={data}
          clientName={clientName}
          portalUserName={portalUserName}
          recentDocuments={recentDocuments}
          downloading={downloading}
          previewing={previewing}
          onPreview={preview}
          onDownload={download}
          onViewDocuments={() =>
            window.location.assign(portalHref("documents"))
          }
          onClientChange={(clientId) =>
            window.location.assign(portalHref("home", clientId))
          }
        />
      ) : currentView === "documents" ? (
        <DocumentsView
          data={data}
          category={category}
          search={search}
          visibleDocuments={visibleDocuments}
          selectedCategoryLabel={selectedCategoryLabel}
          downloading={downloading}
          previewing={previewing}
          openFolderPath={openFolderPath}
          onCategoryChange={setCategory}
          onOpenFolder={setOpenFolderPath}
          onSearchChange={setSearch}
          onPreview={preview}
          onDownload={download}
          onClientChange={(clientId) =>
            window.location.assign(
              portalHref("documents", clientId)
            )
          }
        />
      ) : (
        <RequestsView
          data={data}
          selectedRequestId={selectedRequestId}
          onClientChange={(clientId) =>
            window.location.assign(
              portalHref("requests", clientId)
            )
          }
        />
      )}
    </main>
  );
}

function EntitySwitcher({
  data,
  onClientChange,
}: {
  data: PortalResponse;
  onClientChange: (clientId: string) => void;
}) {
  if (!data.clients || data.clients.length <= 1) return null;

  return (
    <div style={styles.entitySwitcher}>
      <span style={styles.entitySwitcherLabel}>ENTITY</span>
      <select
        value={data.client.id}
        onChange={(event) => onClientChange(event.target.value)}
        style={styles.entitySwitcherSelect}
      >
        {data.clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.client_name}
          </option>
        ))}
      </select>
      <span style={styles.entitySwitcherHelp}>
        Switch between entities linked to this login.
      </span>
    </div>
  );
}

function HomeView({
  data,
  clientName,
  portalUserName,
  recentDocuments,
  downloading,
  previewing,
  onPreview,
  onDownload,
  onViewDocuments,
  onClientChange,
}: {
  data: PortalResponse;
  clientName: string;
  portalUserName: string;
  recentDocuments: PortalDocument[];
  downloading: string;
  previewing: string;
  onPreview: (document: PortalDocument) => Promise<void>;
  onDownload: (document: PortalDocument) => Promise<void>;
  onViewDocuments: () => void;
  onClientChange: (clientId: string) => void;
}) {
  return (
    <div style={styles.portalShell}>
      <aside style={styles.sideNav}>
        <div style={styles.sideBrand}>
          <div style={styles.sideBrandMark}>PP</div>
          <div>
            <strong style={styles.sideBrandName}>PracticePilot</strong>
            <span style={styles.sideBrandSub}>Client Portal</span>
          </div>
        </div>

        <EntitySwitcher
          data={data}
          onClientChange={onClientChange}
        />

        <div style={styles.sideNavItems}>
          <span style={styles.sideNavActive}>
            <span style={styles.sideIcon}><PortalIcon name="home" size={18} /></span>
            Dashboard
          </span>

          <button
            type="button"
            onClick={onViewDocuments}
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="documents" size={18} /></span>
            Documents
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal/messages")
            }
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="messages" size={18} /></span>
            Messages
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal/meetings")
            }
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="requests" size={18} /></span>
            Meetings
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal?view=requests")
            }
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="requests" size={18} /></span>
            Requests
          </button>

          <span style={styles.sideNavDisabled}>
            <span style={styles.sideIcon}><PortalIcon name="profile" size={18} /></span>
            My Profile
          </span>
        </div>

        <div style={styles.helpBox}>
          <div style={styles.helpTitleRow}>
            <span style={styles.helpIcon}>?</span>
            <strong>Need help?</strong>
          </div>
          <span>
            Contact your practice directly if you have any questions.
          </span>
          <button type="button" disabled style={styles.helpButton}>
            Send a message
          </button>
        </div>
      </aside>

      <section style={styles.dashboardMain}>
        <div style={styles.dashboardHeader}>
          <div>
            <h1 style={styles.dashboardTitle}>Welcome back</h1>
            <p style={styles.dashboardSubtitle}>
              Here&apos;s everything you need in one place.
            </p>
          </div>

          {data.clients.length > 1 ? (
            <select
              value={data.client.id}
              onChange={(event) => onClientChange(event.target.value)}
              style={styles.clientSelect}
            >
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.client_name}
                </option>
              ))}
            </select>
          ) : (
            <div style={styles.accountMeta}>
              <strong>{clientName}</strong>
              <span>{portalUserName}</span>
            </div>
          )}
        </div>

        <section style={styles.homeMetrics}>
          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal?view=documents")
            }
            style={styles.homeMetricCard}
          >
            <span style={{ ...styles.metricIconCircle, ...styles.metricBlue }}>
              <PortalIcon name="documents" size={24} />
            </span>
            <Metric value={data.counts.total} label="Latest documents" note="Released to you" />
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal?view=requests&status=open")
            }
            style={styles.homeMetricCard}
          >
            <span style={{ ...styles.metricIconCircle, ...styles.metricOrange }}>
              <PortalIcon name="clock" size={24} />
            </span>
            <Metric value={data.counts.needs_action} label="Needs your action" note="Items requiring attention" />
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal?view=requests&status=submitted")
            }
            style={styles.homeMetricCard}
          >
            <span style={{ ...styles.metricIconCircle, ...styles.metricPurple }}>
              <PortalIcon name="requests" size={24} />
            </span>
            <Metric value={data.counts.awaiting_our_work} label="Awaiting our work" note="Currently in progress" />
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal?view=documents")
            }
            style={styles.homeMetricCard}
          >
            <span style={{ ...styles.metricIconCircle, ...styles.metricGreen }}>
              <PortalIcon name="check" size={24} />
            </span>
            <Metric value={data.counts.for_your_records} label="For your records" note="Available anytime" />
          </button>
        </section>

        <div style={styles.homeGrid}>
          <div style={styles.homePrimaryColumn}>
            <section style={styles.homePanel}>
              <div style={styles.panelHeader}>
                <div style={styles.panelHeadingBlock}>
                  <span style={styles.panelHeadingIcon}><PortalIcon name="requests" size={24} /></span>
                  <div>
                    <strong style={styles.panelTitle}>Requests & Actions</strong>
                    <span style={styles.panelSub}>Items we still need from you.</span>
                  </div>
                </div>
              </div>

              {data.requests?.filter(
                (item) => ["new", "in_progress"].includes(item.status)
              ).length ? (
                <div style={styles.requestList}>
                  {data.requests
                    .filter(
                      (item) =>
                        ["new", "in_progress"].includes(item.status)
                    )
                    .slice(0, 5)
                    .map((item) => (
                      <div key={item.id} style={styles.requestRow}>
                        <div style={styles.requestInfo}>
                          <div style={styles.requestTitleLine}>
                            <span style={styles.requestTypePill}>
                              {requestTypeLabel(item.request_type)}
                            </span>
                            <strong>{item.title}</strong>
                          </div>

                          {item.description ? (
                            <span style={styles.requestDescription}>
                              {item.description}
                            </span>
                          ) : null}

                          <div style={styles.requestMeta}>
                            <span>
                              {item.due_date
                                ? `Due ${formatDate(item.due_date)}`
                                : "No due date"}
                            </span>
                            <span>{requestStatusLabel(item.status)}</span>
                            {item.priority !== "normal" ? (
                              <span>{item.priority}</span>
                            ) : null}
                          </div>
                        </div>

                        <div style={styles.requestActions}>
                          {item.requires_upload ? (
                            <span style={styles.requestNeedBadge}>Upload</span>
                          ) : null}
                          {item.requires_response ? (
                            <span style={styles.requestNeedBadge}>Response</span>
                          ) : null}
                          {item.requires_approval ? (
                            <span style={styles.requestNeedBadge}>Approval</span>
                          ) : null}

                          <button
                            type="button"
                            onClick={() =>
                              window.location.assign(
                                `/client-portal/request/${encodeURIComponent(item.id)}`
                              )
                            }
                            style={styles.requestOpenButton}
                          >
                            {item.status === "submitted"
                              ? "View submission"
                              : "Open →"}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div style={styles.emptyActionPanel}>
                  <div style={styles.emptyActionIcon}><PortalIcon name="check" size={22} /></div>
                  <strong>All up to date</strong>
                  <span>You have no outstanding document requests or actions.</span>
                  <small>We&apos;ll let you know here if anything is needed.</small>
                </div>
              )}
            </section>

            <section style={styles.homePanel}>
              <div style={styles.panelHeader}>
                <div style={styles.panelHeadingBlock}>
                  <span style={styles.panelHeadingIcon}><PortalIcon name="documents" size={24} /></span>
                  <div>
                    <strong style={styles.panelTitle}>Recent Documents</strong>
                    <span style={styles.panelSub}>
                      The latest documents shared with you.
                    </span>
                  </div>
                </div>

                <button type="button" onClick={onViewDocuments} style={styles.panelLinkButton}>
                  View all documents →
                </button>
              </div>

              <div style={styles.homeDocHeader}>
                <span>Name</span>
                <span>Category</span>
                <span>Date</span>
                <span>Status</span>
                <span />
              </div>

              {recentDocuments.length ? (
                recentDocuments.map((document) => (
                  <div key={document.id} style={styles.homeDocRow}>
                    <div style={styles.homeDocName}>
                      <span style={styles.fileBadge}>{fileType(document.document_name)}</span>
                      <div style={styles.homeDocText}>
                        <strong>{document.document_name}</strong>
                        <span>Available in your portal</span>
                      </div>
                    </div>

                    <span style={styles.cellText}>{document.portal_category_label}</span>
                    <span style={styles.cellText}>{formatDate(document.released_at)}</span>
                    <span style={styles.recordPill}>{document.item_type === "folder" ? "Folder Pack" : "For your records"}</span>

                    <div style={styles.documentActions}>
                      {canPreviewDocument(document.document_name) ? (
                        <button
                          type="button"
                          onClick={() => void onPreview(document)}
                          disabled={previewing === document.id}
                          style={styles.previewButton}
                        >
                          {previewing === document.id ? "Opening..." : "Preview"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => void onDownload(document)}
                        disabled={downloading === document.id}
                        style={styles.downloadSecondaryButton}
                      >
                        {downloading === document.id ? "..." : "Download"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.emptyPanel}>
                  No documents have been released to you yet.
                </div>
              )}
            </section>

            <section style={styles.securityStrip}>
              <div style={styles.securityIcon}><PortalIcon name="shield" size={22} /></div>
              <div>
                <strong>Your information is secure</strong>
                <span>
                  Your documents and data are privately and securely shared through PracticePilot.
                </span>
              </div>
            </section>
          </div>

          <aside style={styles.homeRightColumn}>
            <section style={styles.messagePanel}>
              <div style={styles.rightPanelIcon}><PortalIcon name="megaphone" size={26} /></div>
              <strong>Messages from your practice</strong>
              <span>
                You&apos;ll see important updates, requests or notes from your practice right here.
              </span>
              <button
                type="button"
                style={styles.outlineButton}
                onClick={() =>
                  window.location.assign("/client-portal/messages")
                }
              >
                View messages →
              </button>
            </section>

            <section style={styles.sendPanel}>
              <div style={styles.rightPanelIcon}><PortalIcon name="messages" size={26} /></div>
              <strong>Need to send something?</strong>
              <span>
                You can securely send documents or information directly to your practice.
              </span>
              <button
                type="button"
                style={styles.greenButton}
                onClick={() =>
                  window.location.assign("/client-portal/messages")
                }
              >
                New message →
              </button>
            </section>

            <section style={styles.quickLinksPanel}>
              <div style={styles.quickLinksTitle}>
                <span style={styles.panelHeadingIcon}><PortalIcon name="link" size={22} /></span>
                <strong>Quick Links</strong>
              </div>

              <button type="button" onClick={onViewDocuments} style={styles.quickLink}>
                View my documents →
              </button>
              <span style={styles.quickLinkDisabled}>Request a document · Soon</span>
              <span style={styles.quickLinkDisabled}>Update my details · Soon</span>
              <span style={styles.quickLinkDisabled}>Contact my practice · Soon</span>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}

function DocumentsView({
  data,
  category,
  search,
  visibleDocuments,
  selectedCategoryLabel,
  downloading,
  previewing,
  openFolderPath,
  onCategoryChange,
  onOpenFolder,
  onSearchChange,
  onPreview,
  onDownload,
  onClientChange,
}: {
  data: PortalResponse;
  category: string;
  search: string;
  visibleDocuments: PortalDocument[];
  selectedCategoryLabel: string;
  downloading: string;
  previewing: string;
  openFolderPath: string;
  onCategoryChange: (value: string) => void;
  onOpenFolder: (value: string) => void;
  onSearchChange: (value: string) => void;
  onPreview: (document: PortalDocument) => Promise<void>;
  onDownload: (document: PortalDocument) => Promise<void>;
  onClientChange: (clientId: string) => void;
}) {
  return (
    <div style={styles.portalShell}>
      <aside style={styles.sideNav}>
        <div style={styles.sideBrand}>
          <div style={styles.sideBrandMark}>PP</div>
          <div>
            <strong style={styles.sideBrandName}>PracticePilot</strong>
            <span style={styles.sideBrandSub}>Client Portal</span>
          </div>
        </div>

        <EntitySwitcher
          data={data}
          onClientChange={onClientChange}
        />

        <div style={styles.sideNavItems}>
          <button
            type="button"
            onClick={() => window.location.assign("/client-portal")}
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="home" size={18} /></span>
            Dashboard
          </button>

          <span style={styles.sideNavActive}>
            <span style={styles.sideIcon}><PortalIcon name="documents" size={18} /></span>
            Documents
          </span>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal/messages")
            }
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="messages" size={18} /></span>
            Messages
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal/meetings")
            }
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="requests" size={18} /></span>
            Meetings
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal?view=requests")
            }
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="requests" size={18} /></span>
            Requests
          </button>

          <span style={styles.sideNavDisabled}>
            <span style={styles.sideIcon}><PortalIcon name="profile" size={18} /></span>
            My Profile
          </span>
        </div>

        <div style={styles.helpBox}>
          <div style={styles.helpTitleRow}>
            <span style={styles.helpIcon}>?</span>
            <strong>Need help?</strong>
          </div>
          <span>Contact your practice directly if you have any questions.</span>
          <button type="button" disabled style={styles.helpButton}>
            Send a message
          </button>
        </div>
      </aside>

      <section style={styles.documentsMain}>
        <div style={styles.documentsHero}>
          <div>
            <div style={styles.documentsEyebrow}>CLIENT DOCUMENTS</div>
            <h1 style={styles.documentsTitle}>Your Documents</h1>
            <p style={styles.documentsSubtitle}>
              Everything shared with you, organised and ready when you need it.
            </p>
          </div>

          {data.clients.length > 1 ? (
            <select
              value={data.client.id}
              onChange={(event) => onClientChange(event.target.value)}
              style={styles.clientSelect}
            >
              {data.clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.client_name}
                </option>
              ))}
            </select>
          ) : (
            <div style={styles.documentsAccountMeta}>
              <strong>{data.client.client_name}</strong>
              <span>{data.portal_user.full_name || data.portal_user.email}</span>
            </div>
          )}
        </div>

        <section style={styles.documentMetricGrid}>
          <div style={styles.documentMetricCard}>
            <span style={{ ...styles.metricIconCircle, ...styles.metricBlue }}>
              <PortalIcon name="documents" size={24} />
            </span>
            <Metric value={data.counts.total} label="Latest documents" note="Released to you" />
          </div>

          <div style={styles.documentMetricCard}>
            <span style={{ ...styles.metricIconCircle, ...styles.metricOrange }}>
              <PortalIcon name="clock" size={24} />
            </span>
            <Metric value={data.counts.needs_action} label="Needs your action" note="Items requiring attention" />
          </div>

          <div style={styles.documentMetricCard}>
            <span style={{ ...styles.metricIconCircle, ...styles.metricPurple }}>
              <PortalIcon name="requests" size={24} />
            </span>
            <Metric value={data.counts.awaiting_our_work} label="Awaiting our work" note="Currently in progress" />
          </div>

          <div style={styles.documentMetricCard}>
            <span style={{ ...styles.metricIconCircle, ...styles.metricGreen }}>
              <PortalIcon name="check" size={24} />
            </span>
            <Metric value={data.counts.for_your_records} label="For your records" note="Available anytime" />
          </div>
        </section>

        <section style={styles.documentsWorkspace}>
          <aside style={styles.documentsCategoryPanel}>
            <div style={styles.documentsCategoryHeading}>
              <strong>Document Categories</strong>
              <span>Browse what has been shared with you.</span>
            </div>

            {CATEGORIES.map(([value, label]) => {
              const count =
                value === "all"
                  ? data.counts.total
                  : data.category_counts[value] || 0;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onCategoryChange(value)}
                  style={{
                    ...styles.documentCategoryButton,
                    ...(category === value
                      ? styles.documentCategoryButtonActive
                      : {}),
                  }}
                >
                  <span style={styles.documentCategoryLabel}>
                    <PortalIcon
                      name={value === "all" ? "documents" : "folder"}
                      size={17}
                    />
                    {label}
                  </span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </aside>

          <section style={styles.documentsListPanel}>
            <div style={styles.documentsToolbar}>
              <div>
                {openFolderPath ? (
                  <button
                    type="button"
                    onClick={() => onOpenFolder(parentPortalPath(openFolderPath) === "/" ? "" : parentPortalPath(openFolderPath))}
                    style={styles.folderBackButton}
                  >
                    ← Back
                  </button>
                ) : null}
                <strong style={styles.sectionTitle}>
                  {openFolderPath
                    ? openFolderPath.split("/").filter(Boolean).pop() || selectedCategoryLabel
                    : selectedCategoryLabel}
                </strong>
                <span style={styles.sectionMeta}>
                  {visibleDocuments.length} item{visibleDocuments.length === 1 ? "" : "s"}
                </span>
              </div>

              <div style={styles.searchWrap}>
                <PortalIcon name="search" size={18} />
                <input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search documents..."
                  style={styles.search}
                />
              </div>
            </div>

            <div style={styles.documentTableHeader}>
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
                    {document.item_type === "folder" ? (
                      <span style={styles.folderPackBadge}><PortalIcon name="folder" size={20} /></span>
                    ) : (
                      <span style={styles.fileBadge}>{fileType(document.document_name)}</span>
                    )}
                    <div>
                      <strong style={styles.documentName}>
                        {document.document_name}
                      </strong>
                      <span style={styles.documentSub}>
                        {document.item_type === "folder" ? "Released document pack" : "Available in your portal"}
                      </span>
                    </div>
                  </div>

                  <span style={styles.cellText}>{document.portal_category_label}</span>
                  <span style={styles.cellText}>{formatDate(document.released_at)}</span>
                  <span style={styles.recordPill}>{document.item_type === "folder" ? "Folder Pack" : "For your records"}</span>

                  <div style={styles.documentActions}>
                    {document.item_type === "folder" ? (
                      <button
                        type="button"
                        onClick={() => onOpenFolder(normalisePortalPath(document.provider_path))}
                        style={styles.previewButton}
                      >
                        Open Pack
                      </button>
                    ) : (
                      <>
                        {canPreviewDocument(document.document_name) ? (
                          <button
                            type="button"
                            onClick={() => void onPreview(document)}
                            disabled={previewing === document.id}
                            style={styles.previewButton}
                          >
                            {previewing === document.id ? "Opening..." : "Preview"}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => void onDownload(document)}
                          disabled={downloading === document.id}
                          style={styles.downloadSecondaryButton}
                        >
                          <PortalIcon name="download" size={14} />
                          {downloading === document.id ? "..." : "Download"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={styles.empty}>
                No released documents match this view.
              </div>
            )}

            <div style={styles.documentsBottomStrip}>
              <div style={styles.actionStripCopy}>
                <strong style={styles.actionStripTitle}>
                  Can&apos;t find something?
                </strong>
                <span style={styles.actionStripText}>
                  Document requests and secure messages are coming next.
                </span>
              </div>

              <button type="button" disabled style={styles.messageButton}>
                New Message
              </button>
            </div>
          </section>
        </section>
      </section>
    </div>
  );
}

function RequestsView({
  data,
  selectedRequestId,
  onClientChange,
}: {
  data: PortalResponse;
  selectedRequestId: string;
  onClientChange: (clientId: string) => void;
}) {
  const searchParams = useSearchParams();
  const requestedStatus = String(searchParams.get("status") || "all");
  const validStatuses = ["all", "open", "submitted", "completed"];
  const [status, setStatus] = useState(
    validStatuses.includes(requestedStatus) ? requestedStatus : "all"
  );

  useEffect(() => {
    setStatus(
      validStatuses.includes(requestedStatus)
        ? requestedStatus
        : "all"
    );
  }, [requestedStatus]);

  const filtered = (data.requests || []).filter((item) => {
    if (status === "open") {
      return ["new", "in_progress"].includes(item.status);
    }

    if (status === "all") return true;

    return item.status === status;
  });

  const summary = {
    open: (data.requests || []).filter(
      (item) => ["new", "in_progress"].includes(item.status)
    ).length,
    submitted: (data.requests || []).filter(
      (item) => item.status === "submitted"
    ).length,
    completed: (data.requests || []).filter(
      (item) => item.status === "completed"
    ).length,
  };

  const selectedRequest =
    (data.requests || []).find(
      (item) => item.id === selectedRequestId
    ) || null;

  return (
    <div style={styles.portalShell}>
      <aside style={styles.sideNav}>
        <div style={styles.sideBrand}>
          <div style={styles.sideBrandMark}>PP</div>
          <div>
            <strong style={styles.sideBrandName}>PracticePilot</strong>
            <span style={styles.sideBrandSub}>Client Portal</span>
          </div>
        </div>

        <EntitySwitcher
          data={data}
          onClientChange={onClientChange}
        />

        <div style={styles.sideNavItems}>
          <button
            type="button"
            onClick={() => window.location.assign("/client-portal")}
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="home" size={18} /></span>
            Dashboard
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal?view=documents")
            }
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="documents" size={18} /></span>
            Documents
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal/messages")
            }
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="messages" size={18} /></span>
            Messages
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign("/client-portal/meetings")
            }
            style={styles.sideNavButton}
          >
            <span style={styles.sideIcon}><PortalIcon name="requests" size={18} /></span>
            Meetings
          </button>

          <span style={styles.sideNavActive}>
            <span style={styles.sideIcon}><PortalIcon name="requests" size={18} /></span>
            Requests
          </span>

          <span style={styles.sideNavDisabled}>
            <span style={styles.sideIcon}><PortalIcon name="profile" size={18} /></span>
            My Profile
          </span>
        </div>

        <div style={styles.helpBox}>
          <div style={styles.helpTitleRow}>
            <span style={styles.helpIcon}>?</span>
            <strong>Need help?</strong>
          </div>
          <span>Contact your practice directly if you have any questions.</span>
          <button type="button" disabled style={styles.helpButton}>
            Send a message
          </button>
        </div>
      </aside>

      <section style={styles.requestsMain}>
        <div style={styles.requestsHeader}>
          <div>
            <div style={styles.documentsEyebrow}>REQUESTS & ACTIONS</div>
            <h1 style={styles.documentsTitle}>Things we need from you</h1>
            <p style={styles.documentsSubtitle}>
              Upload documents, answer questions and complete approvals in one place.
            </p>
          </div>

          {data.clients.length > 1 ? (
            <select
              value={data.client.id}
              onChange={(event) => onClientChange(event.target.value)}
              style={styles.clientSelect}
            >
              {data.clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.client_name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <section style={styles.requestSummaryGrid}>
          <button
            type="button"
            onClick={() => setStatus("open")}
            style={{
              ...styles.requestSummaryCard,
              ...(status === "open" ? styles.requestSummaryCardActive : {}),
            }}
          >
            <span style={{ ...styles.metricIconCircle, ...styles.metricOrange }}>
              <PortalIcon name="requests" size={22} />
            </span>
            <Metric value={summary.open} label="Needs your action" note="Still outstanding" />
          </button>

          <button
            type="button"
            onClick={() => setStatus("submitted")}
            style={{
              ...styles.requestSummaryCard,
              ...(status === "submitted" ? styles.requestSummaryCardActive : {}),
            }}
          >
            <span style={{ ...styles.metricIconCircle, ...styles.metricPurple }}>
              <PortalIcon name="clock" size={22} />
            </span>
            <Metric value={summary.submitted} label="Submitted" note="Waiting for your practice" />
          </button>

          <button
            type="button"
            onClick={() => setStatus("completed")}
            style={{
              ...styles.requestSummaryCard,
              ...(status === "completed" ? styles.requestSummaryCardActive : {}),
            }}
          >
            <span style={{ ...styles.metricIconCircle, ...styles.metricGreen }}>
              <PortalIcon name="check" size={22} />
            </span>
            <Metric value={summary.completed} label="Completed" note="Nothing more required" />
          </button>
        </section>

        <section style={styles.requestsPanel}>
          <div style={styles.requestsToolbar}>
            <div>
              <strong style={styles.panelTitle}>Your requests</strong>
              <span style={styles.panelSub}>{filtered.length} shown</span>
            </div>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={styles.requestFilter}
            >
              <option value="all">All requests</option>
              <option value="open">Needs your action</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {filtered.length ? (
            <div style={styles.requestList}>
              {filtered.map((item) => (
                <div key={item.id} style={styles.requestRow}>
                  <div style={styles.requestInfo}>
                    <div style={styles.requestTitleLine}>
                      <span style={styles.requestTypePill}>
                        {requestTypeLabel(item.request_type)}
                      </span>
                      <strong>{item.title}</strong>
                    </div>

                    {item.description ? (
                      <span style={styles.requestDescription}>
                        {item.description}
                      </span>
                    ) : null}

                    <div style={styles.requestMeta}>
                      <span>
                        {item.due_date
                          ? `Due ${formatDate(item.due_date)}`
                          : "No due date"}
                      </span>
                      <span>{requestStatusLabel(item.status)}</span>
                      {item.priority !== "normal" ? (
                        <span>{item.priority}</span>
                      ) : null}
                    </div>
                  </div>

                  <div style={styles.requestActions}>
                    {item.requires_upload ? (
                      <span style={styles.requestNeedBadge}>Upload</span>
                    ) : null}
                    {item.requires_response ? (
                      <span style={styles.requestNeedBadge}>Response</span>
                    ) : null}
                    {item.requires_approval ? (
                      <span style={styles.requestNeedBadge}>Approval</span>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        window.location.assign(
                          `/client-portal/request/${encodeURIComponent(item.id)}`
                        )
                      }
                      style={styles.requestOpenButton}
                    >
                      {item.status === "submitted"
                        ? "View submission"
                        : "Open →"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyActionPanel}>
              <div style={styles.emptyActionIcon}>
                <PortalIcon name="check" size={22} />
              </div>
              <strong>All up to date</strong>
              <span>You have no outstanding requests.</span>
            </div>
          )}
        </section>
      </section>
    </div>
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
    background: "#f5f7fa",
    color: "#10233a",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f5f7fa",
    color: "#10233a",
    fontSize: 15,
    fontWeight: 800,
  },
  topbar: {
    minHeight: 64,
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: 18,
    background: "#ffffff",
    borderBottom: "1px solid #dbe3ec",
  },
  brandButton: {
    border: "none",
    background: "transparent",
    color: "#10233a",
    textAlign: "left",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    cursor: "pointer",
  },
  nav: {
    display: "flex",
    alignItems: "stretch",
    gap: 6,
  },
  navItem: {
    minWidth: 108,
    padding: "0 18px",
    border: "none",
    borderBottom: "3px solid transparent",
    background: "transparent",
    color: "#56677a",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  navActive: {
    color: "#1768d2",
    borderBottomColor: "#1768d2",
    background: "#f4f8fd",
  },
  navItemDisabled: {
    minWidth: 108,
    padding: "0 18px",
    border: "none",
    borderBottom: "3px solid transparent",
    background: "transparent",
    color: "#a7b1bd",
    fontSize: 14,
    fontWeight: 800,
    cursor: "not-allowed",
  },
  clientIdentity: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "#2456b8",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 950,
  },
  clientIdentityCopy: {
    minWidth: 0,
    display: "grid",
    gap: 2,
  },
  clientIdentityName: {
    maxWidth: 310,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 14,
    fontWeight: 950,
  },
  clientIdentitySub: {
    color: "#718096",
    fontSize: 11,
    fontWeight: 700,
  },
  signOutButton: {
    height: 34,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#33485f",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  },

  portalShell: {
    width: "100%",
    maxWidth: "none",
    margin: 0,
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    minHeight: "calc(100vh - 64px)",
    background: "#f7f9fb",
  },
  sideNav: {
    padding: "18px 12px 18px",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #dbe3ec",
    background: "#ffffff",
  },
  sideBrand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "4px 10px 26px",
  },
  sideBrandMark: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    background: "#0b5cab",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 14,
  },
  sideBrandName: {
    display: "block",
    fontSize: 16,
    fontWeight: 950,
  },
  sideBrandSub: {
    display: "block",
    marginTop: 2,
    color: "#5f6f81",
    fontSize: 12,
  },
  sideNavItems: {
    display: "grid",
    gap: 6,
  },
  sideNavActive: {
    minHeight: 44,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    borderLeft: "4px solid #1768d2",
    borderRadius: 6,
    background: "#eaf3ff",
    color: "#1768d2",
    fontSize: 13,
    fontWeight: 900,
  },
  sideNavButton: {
    minHeight: 44,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "none",
    borderLeft: "4px solid transparent",
    background: "transparent",
    color: "#33485f",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  sideNavDisabled: {
    minHeight: 44,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    borderLeft: "4px solid transparent",
    color: "#9aa6b3",
    fontSize: 13,
    fontWeight: 800,
  },
  sideIcon: {
    width: 24,
    textAlign: "center",
    fontSize: 18,
  },
  helpBox: {
    marginTop: "auto",
    padding: 16,
    display: "grid",
    gap: 10,
    border: "1px solid #dbe3ec",
    borderRadius: 8,
    background: "#f4f7fa",
    color: "#526577",
    fontSize: 11,
    lineHeight: 1.45,
  },
  helpTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#10233a",
  },
  helpIcon: {
    width: 24,
    height: 24,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#1768d2",
    color: "#ffffff",
    fontWeight: 950,
  },
  helpButton: {
    height: 34,
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    background: "#ffffff",
    color: "#1768d2",
    fontSize: 10,
    fontWeight: 900,
  },

  dashboardMain: {
    padding: "24px 26px 34px",
    minWidth: 0,
  },
  dashboardHeader: {
    marginBottom: 22,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
  },
  dashboardTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  dashboardSubtitle: {
    margin: "6px 0 0",
    color: "#718096",
    fontSize: 14,
  },
  accountMeta: {
    display: "grid",
    gap: 2,
    textAlign: "right",
    color: "#6c7a89",
    fontSize: 11,
  },
  clientSelect: {
    minWidth: 280,
    height: 40,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 11,
    fontWeight: 850,
  },

  homeMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },
  metric: {
    minHeight: 0,
    padding: 0,
    display: "grid",
    alignContent: "center",
    gap: 4,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: 950,
  },
  metricLabel: {
    fontSize: 16,
    fontWeight: 900,
  },
  metricNote: {
    color: "#7a8794",
    fontSize: 11,
  },

  homeGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    gap: 18,
    alignItems: "start",
  },
  homePrimaryColumn: {
    minWidth: 0,
    display: "grid",
    gap: 18,
  },
  homeRightColumn: {
    display: "grid",
    gap: 18,
  },
  homePanel: {
    border: "1px solid #d9e2ec",
    borderRadius: 8,
    background: "#ffffff",
    overflow: "hidden",
  },
  panelHeader: {
    minHeight: 74,
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #e4e9ef",
  },
  panelHeadingBlock: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  panelHeadingIcon: {
    fontSize: 24,
    color: "#1768d2",
  },
  panelTitle: {
    display: "block",
    fontSize: 18,
    fontWeight: 950,
  },
  panelSub: {
    display: "block",
    marginTop: 3,
    color: "#7a8794",
    fontSize: 11,
  },
  panelLinkButton: {
    height: 36,
    padding: "0 14px",
    border: "1px solid #bfd0e4",
    borderRadius: 6,
    background: "#ffffff",
    color: "#1768d2",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  homeDocHeader: {
    minHeight: 42,
    padding: "0 16px",
    display: "grid",
    gridTemplateColumns: "minmax(270px, 1.7fr) 1fr 120px 130px 188px",
    alignItems: "center",
    gap: 12,
    background: "#f6f8fa",
    borderBottom: "1px solid #d9e1e9",
    color: "#617184",
    fontSize: 10,
    fontWeight: 900,
  },
  homeDocRow: {
    minHeight: 72,
    padding: "10px 16px",
    display: "grid",
    gridTemplateColumns: "minmax(270px, 1.7fr) 1fr 120px 130px 188px",
    alignItems: "center",
    gap: 12,
    borderBottom: "1px solid #e6ebf0",
  },
  homeDocName: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 12,
  },
  homeDocText: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  emptyPanel: {
    minHeight: 150,
    display: "grid",
    placeItems: "center",
    color: "#7a8794",
    fontSize: 11,
  },
  emptyActionPanel: {
    minHeight: 230,
    padding: 28,
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    gap: 7,
    color: "#728091",
    textAlign: "center",
    fontSize: 13,
  },
  emptyActionIcon: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#edf3f8",
    color: "#7c8ba0",
    fontSize: 20,
    fontWeight: 950,
  },
  securityStrip: {
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid #c9ddf2",
    borderRadius: 8,
    background: "#edf6ff",
    color: "#315473",
    fontSize: 11,
  },
  securityIcon: {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#d8ebff",
    color: "#1768d2",
    fontWeight: 950,
  },

  messagePanel: {
    padding: 20,
    minHeight: 190,
    display: "grid",
    alignContent: "start",
    gap: 12,
    border: "1px solid #cddcec",
    borderRadius: 8,
    background: "#edf5ff",
    color: "#34526e",
    fontSize: 12,
    lineHeight: 1.5,
  },
  sendPanel: {
    padding: 20,
    minHeight: 180,
    display: "grid",
    alignContent: "start",
    gap: 12,
    border: "1px solid #cce6d9",
    borderRadius: 8,
    background: "#f0fbf5",
    color: "#32604a",
    fontSize: 12,
    lineHeight: 1.5,
  },
  rightPanelIcon: {
    fontSize: 26,
    color: "#1768d2",
  },
  quickLinksPanel: {
    padding: 20,
    display: "grid",
    gap: 9,
    border: "1px solid #d9e1e9",
    borderRadius: 8,
    background: "#ffffff",
    fontSize: 12,
  },
  quickLinksTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  outlineButton: {
    justifySelf: "start",
    height: 34,
    padding: "0 12px",
    border: "1px solid #b9cce0",
    borderRadius: 18,
    background: "#ffffff",
    color: "#1768d2",
    fontSize: 10,
    fontWeight: 900,
  },
  greenButton: {
    justifySelf: "start",
    height: 34,
    padding: "0 12px",
    border: "1px solid #9ecfb6",
    borderRadius: 18,
    background: "#eef9f3",
    color: "#38805c",
    fontSize: 10,
    fontWeight: 900,
  },
  quickLink: {
    minHeight: 38,
    padding: "0 2px",
    border: "none",
    borderBottom: "1px solid #edf1f4",
    background: "transparent",
    color: "#1768d2",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
  },
  quickLinkDisabled: {
    minHeight: 38,
    display: "flex",
    alignItems: "center",
    borderBottom: "1px solid #edf1f4",
    color: "#9aa6b3",
    fontSize: 11,
    fontWeight: 800,
  },

  hero: {
    margin: "0 auto",
    maxWidth: 1450,
    minHeight: 150,
    padding: "34px 40px",
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
    fontSize: 36,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  heroText: {
    margin: "8px 0 0",
    fontSize: 14,
    opacity: 0.9,
  },
  clientSwitcher: {
    minWidth: 230,
    height: 38,
    padding: "0 11px",
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 850,
    outline: "none",
  },
  metrics: {
    maxWidth: 1390,
    margin: "-18px auto 0",
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    border: "1px solid #d9e1e9",
    background: "#ffffff",
    position: "relative",
  },
  workspace: {
    maxWidth: 1390,
    margin: "18px auto 38px",
    display: "grid",
    gridTemplateColumns: "255px minmax(0, 1fr)",
    border: "1px solid #d9e1e9",
    background: "#ffffff",
  },
  categories: {
    padding: "12px 0",
    borderRight: "1px solid #d9e1e9",
    background: "#f8fafc",
  },
  categoryButton: {
    width: "100%",
    minHeight: 50,
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    border: "none",
    borderLeft: "4px solid transparent",
    background: "transparent",
    color: "#33485f",
    fontSize: 11,
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
    minHeight: 72,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #d9e1e9",
  },
  sectionTitle: {
    display: "block",
    fontSize: 17,
    fontWeight: 950,
  },
  sectionMeta: {
    display: "block",
    marginTop: 3,
    color: "#7a8794",
    fontSize: 10,
  },
  search: {
    width: "100%",
    height: 38,
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#10233a",
    outline: "none",
    fontSize: 12,
  },
  tableHeader: {
    minHeight: 42,
    padding: "0 14px",
    display: "grid",
    gridTemplateColumns:
      "minmax(320px, 1.7fr) 1fr 120px 135px 188px",
    alignItems: "center",
    gap: 12,
    background: "#f3f6f9",
    borderBottom: "1px solid #d9e1e9",
    color: "#617184",
    fontSize: 9,
    fontWeight: 900,
  },
  documentRow: {
    minHeight: 70,
    padding: "9px 14px",
    display: "grid",
    gridTemplateColumns:
      "minmax(320px, 1.7fr) 1fr 120px 135px 188px",
    alignItems: "center",
    gap: 12,
    borderBottom: "1px solid #e6ebf0",
  },
  documentNameCell: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  folderPackBadge: {
    width: 42,
    height: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    background: "#f0b400",
    color: "#ffffff",
    flex: "0 0 auto",
  },
  folderBackButton: {
    marginBottom: 5,
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#1768d2",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  fileBadge: {
    width: 42,
    height: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    background: "#e63e42",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 950,
    flex: "0 0 auto",
  },
  documentName: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 11,
    fontWeight: 900,
  },
  documentSub: {
    display: "block",
    marginTop: 3,
    color: "#84909d",
    fontSize: 9,
  },
  cellText: {
    color: "#526577",
    fontSize: 10,
  },
  recordPill: {
    justifySelf: "start",
    minHeight: 26,
    padding: "0 10px",
    display: "inline-flex",
    alignItems: "center",
    background: "#e9f8ef",
    color: "#16834f",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 900,
  },
  documentActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
  },
  previewButton: {
    minWidth: 82,
    height: 34,
    padding: "0 10px",
    border: "1px solid #1768d2",
    borderRadius: 5,
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  downloadSecondaryButton: {
    minWidth: 92,
    height: 34,
    padding: "0 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    border: "1px solid #bfd0e4",
    borderRadius: 5,
    background: "#ffffff",
    color: "#1768d2",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    minHeight: 200,
    display: "grid",
    placeItems: "center",
    color: "#7a8794",
    fontSize: 11,
  },
  actionStrip: {
    margin: 16,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    border: "1px solid #cfe1d7",
    background: "#f2fbf6",
    color: "#285c42",
    fontSize: 10,
  },
  actionStripCopy: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  actionStripTitle: {
    color: "#285c42",
    fontSize: 10,
    fontWeight: 950,
  },
  actionStripText: {
    color: "#557262",
    fontSize: 9,
    lineHeight: 1.35,
  },
  messageButton: {
    minWidth: 116,
    height: 34,
    padding: "0 12px",
    border: "1px solid #a8c8b5",
    background: "#ffffff",
    color: "#789384",
    fontWeight: 900,
  },

  homeMetricCard: {
    width: "100%",
    minHeight: 132,
    padding: "18px 20px",
    display: "grid",
    alignContent: "center",
    gap: 10,
    border: "1px solid #d9e2ec",
    borderRadius: 10,
    background: "#ffffff",
    boxShadow: "0 4px 14px rgba(15,35,58,0.04)",
    color: "#10233a",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
  },
  metricIconCircle: {
    width: 46,
    height: 46,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    color: "#ffffff",
  },
  metricBlue: { background: "#1768d2" },
  metricOrange: { background: "#f59e0b" },
  metricPurple: { background: "#7c3aed" },
  metricGreen: { background: "#169b62" },

  documentsMain: {
    padding: "24px 26px 34px",
    minWidth: 0,
  },
  documentsHero: {
    minHeight: 120,
    padding: "28px 30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    borderRadius: 10,
    background:
      "linear-gradient(115deg, #102f50 0%, #174e79 55%, #1d6b88 100%)",
    color: "#ffffff",
  },
  documentsEyebrow: {
    marginBottom: 8,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.1,
    color: "#a9d7ef",
  },
  documentsTitle: {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  documentsSubtitle: {
    margin: "8px 0 0",
    maxWidth: 620,
    fontSize: 14,
    lineHeight: 1.5,
    opacity: 0.92,
  },
  documentsAccountMeta: {
    display: "grid",
    gap: 3,
    textAlign: "right",
    fontSize: 11,
    opacity: 0.9,
  },
  documentMetricGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },
  documentMetricCard: {
    minHeight: 124,
    padding: "18px 20px",
    display: "grid",
    alignContent: "center",
    gap: 10,
    border: "1px solid #d9e2ec",
    borderRadius: 10,
    background: "#ffffff",
    boxShadow: "0 4px 14px rgba(15,35,58,0.04)",
  },
  documentsWorkspace: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "280px minmax(0, 1fr)",
    border: "1px solid #d9e2ec",
    borderRadius: 10,
    overflow: "hidden",
    background: "#ffffff",
  },
  documentsCategoryPanel: {
    padding: "18px 0",
    borderRight: "1px solid #d9e2ec",
    background: "#f8fafc",
  },
  documentsCategoryHeading: {
    padding: "0 18px 16px",
    display: "grid",
    gap: 3,
    borderBottom: "1px solid #e6ebf0",
  },
  documentCategoryButton: {
    width: "100%",
    minHeight: 50,
    padding: "0 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    border: "none",
    borderLeft: "4px solid transparent",
    background: "transparent",
    color: "#33485f",
    fontSize: 11,
    fontWeight: 800,
    textAlign: "left",
    cursor: "pointer",
  },
  documentCategoryButtonActive: {
    borderLeftColor: "#1768d2",
    background: "#eaf3ff",
    color: "#1768d2",
  },
  documentCategoryLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  documentsListPanel: {
    minWidth: 0,
    background: "#ffffff",
  },
  documentsToolbar: {
    minHeight: 76,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #d9e2ec",
  },
  searchWrap: {
    width: 320,
    height: 40,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    color: "#7a8794",
    background: "#ffffff",
  },
  documentTableHeader: {
    minHeight: 44,
    padding: "0 14px",
    display: "grid",
    gridTemplateColumns:
      "minmax(320px, 1.7fr) 1fr 120px 135px 120px",
    alignItems: "center",
    gap: 12,
    background: "#f4f7fa",
    borderBottom: "1px solid #d9e1e9",
    color: "#617184",
    fontSize: 9,
    fontWeight: 900,
  },
  documentsBottomStrip: {
    margin: 16,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    border: "1px solid #cfe1d7",
    borderRadius: 8,
    background: "#f2fbf6",
    color: "#285c42",
    fontSize: 10,
  },

  requestList: {
    display: "grid",
  },
  requestRow: {
    minHeight: 88,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottom: "1px solid #e6ebf0",
    background: "#ffffff",
  },
  requestInfo: {
    minWidth: 0,
    display: "grid",
    gap: 6,
  },
  requestTitleLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
  },
  requestTypePill: {
    padding: "4px 7px",
    background: "#eef4f8",
    color: "#526577",
    fontSize: 8,
    fontWeight: 900,
  },
  requestDescription: {
    color: "#687789",
    fontSize: 10,
    lineHeight: 1.4,
  },
  requestMeta: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    color: "#84909d",
    fontSize: 9,
  },
  requestActions: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  requestNeedBadge: {
    padding: "5px 8px",
    borderRadius: 999,
    background: "#f2f6fb",
    color: "#526577",
    fontSize: 8,
    fontWeight: 900,
  },
  requestOpenButton: {
    height: 32,
    padding: "0 10px",
    border: "1px solid #1768d2",
    borderRadius: 5,
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  requestsMain: {
    width: "100%",
    maxWidth: 1120,
    boxSizing: "border-box",
    margin: "0 auto",
    padding: "18px 20px 30px",
    minWidth: 0,
  },
  requestsHeader: {
    minHeight: 96,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    borderRadius: 10,
    background:
      "linear-gradient(115deg, #102f50 0%, #174e79 55%, #1d6b88 100%)",
    color: "#ffffff",
  },
  requestSummaryGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  requestSummaryCard: {
    minHeight: 96,
    padding: "13px 15px",
    display: "grid",
    alignContent: "center",
    gap: 7,
    border: "1px solid #d9e2ec",
    borderRadius: 8,
    background: "#ffffff",
    boxShadow: "0 3px 10px rgba(15,35,58,0.035)",
    textAlign: "left",
    cursor: "pointer",
  },
  requestSummaryCardActive: {
    borderColor: "#1768d2",
    boxShadow: "0 0 0 2px rgba(23,104,210,0.08)",
    background: "#f7fbff",
  },
  requestsPanel: {
    marginTop: 14,
    border: "1px solid #d9e2ec",
    borderRadius: 10,
    overflow: "hidden",
    background: "#ffffff",
  },
  requestsToolbar: {
    minHeight: 72,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #d9e2ec",
  },
  requestFilter: {
    minWidth: 170,
    height: 38,
    padding: "0 10px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 10,
    fontWeight: 800,
  },

  requestDetailPanel: {
    marginTop: 16,
    padding: 18,
    border: "1px solid #cfd9e4",
    borderRadius: 10,
    background: "#ffffff",
  },
  requestDetailHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  requestDetailTitle: {
    margin: "8px 0 0",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  requestCloseButton: {
    height: 32,
    padding: "0 11px",
    border: "1px solid #cbd5e1",
    borderRadius: 5,
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  requestDetailDescription: {
    margin: "14px 0 0",
    color: "#5f6f81",
    fontSize: 11,
    lineHeight: 1.55,
  },
  requestDetailMetaGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  requestDetailLabel: {
    display: "block",
    marginBottom: 4,
    color: "#84909d",
    fontSize: 8,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  requestDetailRequirements: {
    marginTop: 16,
    display: "grid",
    gap: 10,
  },
  requestActionCard: {
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid #d9e2ec",
    borderRadius: 8,
    background: "#f8fafc",
    color: "#33485f",
    fontSize: 10,
  },

  entitySwitcher: {
    margin: "0 8px 18px",
    padding: "10px",
    display: "grid",
    gap: 5,
    border: "1px solid #d4e0ec",
    borderRadius: 7,
    background: "#f7faff",
  },
  entitySwitcherLabel: {
    color: "#1768d2",
    fontSize: 7.5,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },
  entitySwitcherSelect: {
    width: "100%",
    height: 34,
    padding: "0 8px",
    border: "1px solid #bfd0e3",
    borderRadius: 5,
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    fontWeight: 850,
    outline: "none",
  },
  entitySwitcherHelp: {
    color: "#7b8998",
    fontSize: 7.5,
    lineHeight: 1.35,
  },
  linkedEntityBadge: {
    display: "inline-flex",
    marginTop: 8,
    padding: "5px 8px",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontSize: 8,
    fontWeight: 900,
  },

};
