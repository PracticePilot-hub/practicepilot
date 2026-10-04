"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type BrowseItem = {
  id: string | null;
  name: string;
  path: string;
  type: "folder" | "file";
  size_bytes: number | null;
  modified_at: string | null;
};

type BrowseResponse = {
  success: boolean;
  linked: boolean;
  provider: string | null;
  root_path: string | null;
  root_name?: string | null;
  current_path: string | null;
  current_name: string | null;
  items: BrowseItem[];
  message?: string;
};

type PortalUser = {
  id: string;
  full_name: string | null;
  email: string;
  portal_role: string;
  is_active: boolean;
  invitation_status: string;
};

type PortalRequest = {
  id: string;
  organisation_id: string;
  client_id: string;
  request_type:
    | "document_request"
    | "approval"
    | "confirmation"
    | "question";
  title: string;
  description: string | null;
  due_date: string | null;
  status:
    | "new"
    | "in_progress"
    | "submitted"
    | "completed"
    | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  assigned_portal_user_id: string | null;
  requires_upload: boolean;
  requires_response: boolean;
  requires_approval: boolean;
  upload_provider_id: string | null;
  upload_folder_path: string | null;
  upload_folder_name: string | null;
  response_text: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const REQUEST_TYPES = [
  ["document_request", "Document request"],
  ["approval", "Approval"],
  ["confirmation", "Confirmation"],
  ["question", "Question / response"],
] as const;

const PRIORITIES = [
  ["low", "Low"],
  ["normal", "Normal"],
  ["high", "High"],
  ["urgent", "Urgent"],
] as const;

const STATUSES = [
  ["new", "New"],
  ["in_progress", "In progress"],
  ["submitted", "Submitted"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;

function statusLabel(value: PortalRequest["status"]) {
  return (
    STATUSES.find(([key]) => key === value)?.[1] || value
  );
}

function typeLabel(value: PortalRequest["request_type"]) {
  return (
    REQUEST_TYPES.find(([key]) => key === value)?.[1] || value
  );
}

function priorityLabel(value: PortalRequest["priority"]) {
  return (
    PRIORITIES.find(([key]) => key === value)?.[1] || value
  );
}

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

function responseSummary(item: PortalRequest) {
  if (!item.response_text) return "";

  if (item.request_type === "question") {
    return item.response_text;
  }

  try {
    const parsed = JSON.parse(item.response_text);

    if (item.request_type === "approval") {
      const decision = String(parsed?.decision || "").replaceAll("_", " ");
      const comment = String(parsed?.comment || "").trim();
      return comment ? `${decision} — ${comment}` : decision;
    }

    if (item.request_type === "confirmation") {
      const confirmation = String(parsed?.confirmation || "").replaceAll("_", " ");
      const comment = String(parsed?.comment || "").trim();
      return comment ? `${confirmation} — ${comment}` : confirmation;
    }

    if (item.request_type === "document_request") {
      const fileName = String(parsed?.file_name || "").trim();
      const providerPath = String(parsed?.provider_path || "").trim();
      return fileName || providerPath;
    }
  } catch {
    return item.response_text;
  }

  return item.response_text;
}

export default function ClientPortalRequestsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const clientId = String(params?.id || "");

  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);

  const [requestType, setRequestType] =
    useState<PortalRequest["request_type"]>("document_request");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] =
    useState<PortalRequest["priority"]>("normal");
  const [assignedPortalUserId, setAssignedPortalUserId] = useState("");

  const [requiresUpload, setRequiresUpload] = useState(true);
  const [requiresResponse, setRequiresResponse] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const [uploadFolderPath, setUploadFolderPath] = useState("");
  const [uploadFolderName, setUploadFolderName] = useState("");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderBrowser, setFolderBrowser] = useState<BrowseResponse | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function authToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Your PracticePilot login session could not be confirmed."
      );
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
        `/api/crm/clients/${clientId}/portal-requests`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not load portal requests."
        );
      }

      setRequests(result.requests || []);
      setPortalUsers(result.portal_users || []);

      const primary =
        (result.portal_users || []).find(
          (item: PortalUser) => item.portal_role === "primary"
        ) ||
        (result.portal_users || [])[0];

      if (primary?.id) {
        setAssignedPortalUserId(primary.id);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load portal requests."
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendRequestEmail(item: PortalRequest) {
    setUpdatingId(item.id);
    setError("");
    setNotice("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/clients/${clientId}/portal-requests`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            request_id: item.id,
            action: "resend_email",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not resend the client email."
        );
      }

      setNotice("Request email resent to the client.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not resend the client email."
      );
    } finally {
      setUpdatingId("");
    }
  }

  function setTypeDefaults(
    value: PortalRequest["request_type"]
  ) {
    setRequestType(value);

    if (value === "document_request") {
      setRequiresUpload(true);
      setRequiresResponse(false);
      setRequiresApproval(false);
      return;
    }

    if (value === "approval") {
      setRequiresUpload(false);
      setRequiresResponse(false);
      setRequiresApproval(true);
      return;
    }

    if (value === "question") {
      setRequiresUpload(false);
      setRequiresResponse(true);
      setRequiresApproval(false);
      return;
    }

    setRequiresUpload(false);
    setRequiresResponse(false);
    setRequiresApproval(false);
  }

  async function browseDestinationFolder(targetPath?: string) {
    setFolderLoading(true);
    setFolderError("");

    try {
      const token = await authToken();
      const params = new URLSearchParams();

      if (targetPath) {
        params.set("path", targetPath);
      }

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/browse${
          params.toString() ? `?${params.toString()}` : ""
        }`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not browse the client document folders."
        );
      }

      if (!result?.linked) {
        throw new Error(
          result?.message ||
            "This client does not have a document folder mapping yet."
        );
      }

      setFolderBrowser(result as BrowseResponse);
      setFolderPickerOpen(true);
    } catch (caught) {
      setFolderError(
        caught instanceof Error
          ? caught.message
          : "Could not browse the client document folders."
      );
    } finally {
      setFolderLoading(false);
    }
  }

  function selectCurrentDestination() {
    if (!folderBrowser?.current_path) {
      setFolderError("Choose a destination folder.");
      return;
    }

    setUploadFolderPath(folderBrowser.current_path);
    setUploadFolderName(
      folderBrowser.current_name ||
        folderBrowser.current_path.split("/").filter(Boolean).pop() ||
        "Selected folder"
    );
    setFolderPickerOpen(false);
    setFolderError("");
  }

  async function createDestinationFolder() {
    const folderName = newFolderName.trim();

    if (!folderName) {
      setFolderError("Enter a folder name.");
      return;
    }

    if (!folderBrowser?.current_path) {
      setFolderError("Open the parent folder first.");
      return;
    }

    setCreatingFolder(true);
    setFolderError("");

    try {
      const token = await authToken();
      const endpoint =
        `/api/crm/clients/${clientId}/documents/create-folder`;

      const jsonBody = {
        parentPath: folderBrowser.current_path,
        currentPath: folderBrowser.current_path,
        folderPath: folderBrowser.current_path,
        folderName,
        name: folderName,
      };

      let response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonBody),
      });

      let result = await response.json().catch(() => null);

      if (!response.ok) {
        const formData = new FormData();
        formData.set("parentPath", folderBrowser.current_path);
        formData.set("currentPath", folderBrowser.current_path);
        formData.set("folderPath", folderBrowser.current_path);
        formData.set("folderName", folderName);
        formData.set("name", folderName);

        response = await fetch(endpoint, {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        result = await response.json().catch(() => null);
      }

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.error || "Could not create the folder."
        );
      }

      const parentPath = folderBrowser.current_path.replace(/\/$/, "");
      const createdPath = `${parentPath}/${folderName}`;

      setFolderBrowser((current) => {
        if (!current) return current;

        const alreadyExists = (current.items || []).some(
          (item) => item.path === createdPath
        );

        if (alreadyExists) return current;

        return {
          ...current,
          items: [
            ...(current.items || []),
            {
              id: null,
              name: folderName,
              path: createdPath,
              type: "folder" as const,
              size_bytes: null,
              modified_at: new Date().toISOString(),
            },
          ].sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name);
          }),
        };
      });

      setNewFolderName("");
    } catch (caught) {
      setFolderError(
        caught instanceof Error
          ? caught.message
          : "Could not create the folder."
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  async function createRequest() {
    if (!title.trim()) {
      setError("Request title is required.");
      return;
    }

    if (
      requestType === "document_request" &&
      requiresUpload &&
      !uploadFolderPath
    ) {
      setError("Choose where the client's upload must be saved.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/clients/${clientId}/portal-requests`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            request_type: requestType,
            title: title.trim(),
            description: description.trim() || null,
            due_date: dueDate || null,
            priority,
            assigned_portal_user_id:
              assignedPortalUserId || null,
            requires_upload: requiresUpload,
            requires_response: requiresResponse,
            requires_approval: requiresApproval,
            upload_provider_id: null,
            upload_folder_path: uploadFolderPath || null,
            upload_folder_name: uploadFolderName || null,
            notify_client: true,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.request) {
        throw new Error(
          result?.error || "Could not create portal request."
        );
      }

      setRequests((current) => [
        result.request,
        ...current,
      ]);

      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("normal");
      setTypeDefaults("document_request");
      setUploadFolderPath("");
      setUploadFolderName("");

      setNotice(
        result.notification_sent
          ? "Request created and the client was emailed."
          : result.notification_error
            ? `Request created, but email notification failed: ${result.notification_error}`
            : "Request created."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create portal request."
      );
    } finally {
      setSaving(false);
    }
  }

  async function patchRequest(
    requestId: string,
    patch: Record<string, unknown>
  ) {
    setUpdatingId(requestId);
    setError("");
    setNotice("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/clients/${clientId}/portal-requests`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            request_id: requestId,
            ...patch,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.request) {
        throw new Error(
          result?.error || "Could not update portal request."
        );
      }

      setRequests((current) =>
        current.map((item) =>
          item.id === result.request.id
            ? result.request
            : item
        )
      );

      setNotice("Request updated.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update portal request."
      );
    } finally {
      setUpdatingId("");
    }
  }

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((item) => {
      if (
        statusFilter === "open" &&
        ["completed", "cancelled"].includes(item.status)
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        statusFilter !== "open" &&
        item.status !== statusFilter
      ) {
        return false;
      }

      if (
        term &&
        ![
          item.title,
          item.description || "",
          typeLabel(item.request_type),
          priorityLabel(item.priority),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }

      return true;
    });
  }, [requests, search, statusFilter]);

  const summary = useMemo(() => {
    return {
      open: requests.filter(
        (item) =>
          !["completed", "cancelled"].includes(item.status)
      ).length,
      overdue: requests.filter((item) => {
        if (
          !item.due_date ||
          ["completed", "cancelled"].includes(item.status)
        ) {
          return false;
        }

        return item.due_date < new Date().toISOString().slice(0, 10);
      }).length,
      submitted: requests.filter(
        (item) => item.status === "submitted"
      ).length,
      completed: requests.filter(
        (item) => item.status === "completed"
      ).length,
    };
  }, [requests]);

  if (loading) {
    return (
      <main style={styles.loading}>
        Loading Requests & Actions...
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Client Portal</div>
          <h1 style={styles.title}>Requests & Actions</h1>
          <p style={styles.subtitle}>
            Create and manage items that the client must complete in
            their portal.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={() =>
              window.open(
                `/client-portal-preview/${clientId}`,
                "_blank",
                "noopener,noreferrer"
              )
            }
            style={styles.secondaryButton}
          >
            Preview Portal
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/crm/client/${clientId}?tab=documents`)
            }
            style={styles.secondaryButton}
          >
            Back to Documents
          </button>
        </div>
      </section>

      {error ? <div style={styles.error}>{error}</div> : null}
      {notice ? <div style={styles.notice}>{notice}</div> : null}

      <section style={styles.summaryGrid}>
        <Summary value={summary.open} label="Open" />
        <Summary value={summary.overdue} label="Overdue" />
        <Summary value={summary.submitted} label="Submitted" />
        <Summary value={summary.completed} label="Completed" />
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <strong style={styles.panelTitle}>
              New client request
            </strong>
            <span style={styles.panelSub}>
              Set exactly what the client needs to do.
            </span>
          </div>
        </div>

        <div style={styles.requestComposer}>
          <div style={styles.composerPrimaryRow}>
            <label style={styles.field}>
              <span style={styles.label}>Request type</span>
              <select
                value={requestType}
                onChange={(event) =>
                  setTypeDefaults(
                    event.target.value as PortalRequest["request_type"]
                  )
                }
                style={styles.input}
              >
                {REQUEST_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={
                  requestType === "document_request"
                    ? "e.g. Upload September bank statement"
                    : requestType === "question"
                      ? "e.g. Please explain these transactions"
                      : "What does the client need to do?"
                }
                style={styles.input}
              />
            </label>
          </div>

          <div style={styles.composerMetaRow}>
            <label style={styles.field}>
              <span style={styles.label}>Client contact</span>
              <select
                value={assignedPortalUserId}
                onChange={(event) =>
                  setAssignedPortalUserId(event.target.value)
                }
                style={styles.input}
              >
                <option value="">All / unassigned</option>
                {portalUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email}
                    {user.portal_role === "primary" ? " · Primary" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Priority</span>
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value as PortalRequest["priority"]
                  )
                }
                style={styles.input}
              >
                {PRIORITIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={styles.composerWorkArea}>
            <label style={styles.descriptionField}>
              <span style={styles.label}>What does the client need to do?</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Give the client a short, clear instruction."
                style={styles.composerTextarea}
              />
            </label>

            {requestType === "document_request" && requiresUpload ? (
              <div style={styles.destinationCard}>
                <div style={styles.destinationCardHeader}>
                  <div>
                    <span style={styles.label}>Upload destination</span>
                    <strong style={styles.destinationTitle}>
                      {uploadFolderName || "Choose an Egnyte folder"}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void browseDestinationFolder(
                        uploadFolderPath || undefined
                      )
                    }
                    disabled={folderLoading}
                    style={styles.destinationAction}
                  >
                    {folderLoading
                      ? "Loading..."
                      : uploadFolderPath
                        ? "Change"
                        : "Choose Folder"}
                  </button>
                </div>

                <span style={styles.destinationPath}>
                  {uploadFolderPath ||
                    "The client's upload will be filed directly into the folder you select."}
                </span>

                {folderError && !folderPickerOpen ? (
                  <span style={styles.destinationError}>{folderError}</span>
                ) : null}
              </div>
            ) : (
              <div style={styles.requestBehaviourCard}>
                <span style={styles.label}>Client action</span>
                <strong style={styles.destinationTitle}>
                  {requestType === "question"
                    ? "Written response"
                    : requestType === "approval"
                      ? "Approve or decline"
                      : "Confirm or cannot confirm"}
                </strong>
                <span style={styles.destinationPath}>
                  The portal will show the correct action screen automatically.
                </span>
              </div>
            )}
          </div>

          <div style={styles.composerFooter}>
            <div style={styles.requirementPills}>
              {requestType === "document_request" ? (
                <label
                  style={{
                    ...styles.requirementPill,
                    ...(requiresUpload ? styles.requirementPillActive : {}),
                  }}
                >
                  <input
                    type="checkbox"
                    checked={requiresUpload}
                    onChange={(event) =>
                      setRequiresUpload(event.target.checked)
                    }
                    style={styles.hiddenCheck}
                  />
                  Upload
                </label>
              ) : null}

              {requestType === "question" ? (
                <label
                  style={{
                    ...styles.requirementPill,
                    ...(requiresResponse ? styles.requirementPillActive : {}),
                  }}
                >
                  <input
                    type="checkbox"
                    checked={requiresResponse}
                    onChange={(event) =>
                      setRequiresResponse(event.target.checked)
                    }
                    style={styles.hiddenCheck}
                  />
                  Written response
                </label>
              ) : null}

              {requestType === "approval" ? (
                <label
                  style={{
                    ...styles.requirementPill,
                    ...(requiresApproval ? styles.requirementPillActive : {}),
                  }}
                >
                  <input
                    type="checkbox"
                    checked={requiresApproval}
                    onChange={(event) =>
                      setRequiresApproval(event.target.checked)
                    }
                    style={styles.hiddenCheck}
                  />
                  Approval
                </label>
              ) : null}

            </div>

            <button
              type="button"
              onClick={() => void createRequest()}
              disabled={saving}
              style={
                saving ? styles.createRequestDisabled : styles.createRequestButton
              }
            >
              {saving ? "Creating..." : "Create Request"}
            </button>
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.listToolbar}>
          <div>
            <strong style={styles.panelTitle}>
              Client requests
            </strong>
            <span style={styles.panelSub}>
              {filteredRequests.length} shown
            </span>
          </div>

          <div style={styles.filters}>
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search requests..."
              style={styles.search}
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              style={styles.filterSelect}
            >
              <option value="open">Open requests</option>
              <option value="all">All statuses</option>
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.tableHeader}>
          <span>Request</span>
          <span>Assigned to</span>
          <span>Due</span>
          <span>Priority</span>
          <span>Requirements</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {filteredRequests.length ? (
          filteredRequests.map((item) => {
            const assignedUser = portalUsers.find(
              (user) =>
                user.id === item.assigned_portal_user_id
            );

            const requirements = [
              item.requires_upload ? "Upload" : "",
              item.requires_response ? "Response" : "",
              item.requires_approval ? "Approval" : "",
            ].filter(Boolean);

            return (
              <Fragment key={item.id}>
              <div style={styles.tableRow}>
                <div style={styles.requestCell}>
                  <div style={styles.requestTopline}>
                    <span style={styles.typePill}>
                      {typeLabel(item.request_type)}
                    </span>
                    <strong>{item.title}</strong>
                  </div>

                  {item.description ? (
                    <span style={styles.requestDescription}>
                      {item.description}
                    </span>
                  ) : null}

                  {item.requires_upload && item.upload_folder_path ? (
                    <span style={styles.requestDestination}>
                      Upload to: {item.upload_folder_name || item.upload_folder_path}
                    </span>
                  ) : null}
                </div>

                <select
                  value={item.assigned_portal_user_id || ""}
                  onChange={(event) =>
                    void patchRequest(item.id, {
                      assigned_portal_user_id:
                        event.target.value || null,
                    })
                  }
                  disabled={updatingId === item.id}
                  style={styles.rowSelect}
                >
                  <option value="">All / unassigned</option>
                  {portalUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>

                <span style={styles.tableText}>
                  {formatDate(item.due_date)}
                </span>

                <span
                  style={{
                    ...styles.priorityPill,
                    ...(item.priority === "urgent"
                      ? styles.priorityUrgent
                      : item.priority === "high"
                        ? styles.priorityHigh
                        : {}),
                  }}
                >
                  {priorityLabel(item.priority)}
                </span>

                <span style={styles.tableText}>
                  {requirements.length
                    ? requirements.join(" · ")
                    : "None"}
                </span>

                <select
                  value={item.status}
                  onChange={(event) =>
                    void patchRequest(item.id, {
                      status: event.target.value,
                    })
                  }
                  disabled={updatingId === item.id}
                  style={styles.rowSelect}
                >
                  {STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <div style={styles.rowActions}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRequestId(
                        selectedRequestId === item.id ? "" : item.id
                      )
                    }
                    style={styles.rowActionButton}
                  >
                    {selectedRequestId === item.id ? "Close" : "View"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void resendRequestEmail(item)}
                    disabled={updatingId === item.id}
                    style={styles.rowActionButtonSecondary}
                  >
                    Resend email
                  </button>
                </div>
              </div>

              {selectedRequestId === item.id ? (
                <div style={styles.requestDetailRow}>
                  <div style={styles.requestDetailGrid}>
                    <div>
                      <span style={styles.detailLabel}>Request</span>
                      <strong style={styles.detailValue}>{item.title}</strong>
                      {item.description ? (
                        <span style={styles.detailText}>{item.description}</span>
                      ) : null}
                    </div>

                    <div>
                      <span style={styles.detailLabel}>Client response</span>
                      <strong style={styles.detailValue}>
                        {item.response_text
                          ? responseSummary(item)
                          : "No response received yet"}
                      </strong>
                      {item.submitted_at ? (
                        <span style={styles.detailText}>
                          Submitted {formatDate(item.submitted_at)}
                        </span>
                      ) : null}
                    </div>

                    {item.requires_upload && item.upload_folder_path ? (
                      <div>
                        <span style={styles.detailLabel}>Upload destination</span>
                        <strong style={styles.detailValue}>
                          {item.upload_folder_name || item.upload_folder_path}
                        </strong>
                        <span style={styles.detailText}>
                          {item.upload_folder_path}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              </Fragment>
            );
          })
        ) : (
          <div style={styles.empty}>
            No portal requests match this view.
          </div>
        )}
      </section>

      {folderPickerOpen && folderBrowser ? (
        <div style={styles.modalBackdrop}>
          <section style={styles.folderModal}>
            <div style={styles.folderModalHeader}>
              <div>
                <div style={styles.folderEyebrow}>CLIENT WORKING FILE</div>
                <strong style={styles.folderModalTitle}>
                  Choose upload destination
                </strong>
                <span style={styles.folderModalSub}>
                  Select where the client&apos;s uploaded file must be stored.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setFolderPickerOpen(false)}
                style={styles.modalClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={styles.folderLocationBar}>
              <div style={styles.folderLocationCopy}>
                <span>Current folder</span>
                <strong>
                  {folderBrowser.current_name ||
                    folderBrowser.current_path}
                </strong>
                <small>{folderBrowser.current_path}</small>
              </div>

              <span style={styles.folderProvider}>
                {folderBrowser.provider || "Document provider"}
              </span>
            </div>

            <div style={styles.newFolderBar}>
              <div style={styles.newFolderCopy}>
                <strong>+ New folder</strong>
                <span>Create inside the current folder.</span>
              </div>

              <input
                value={newFolderName}
                onChange={(event) =>
                  setNewFolderName(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createDestinationFolder();
                  }
                }}
                placeholder="New folder name"
                style={styles.newFolderInput}
              />

              <button
                type="button"
                onClick={() => void createDestinationFolder()}
                disabled={creatingFolder || !newFolderName.trim()}
                style={
                  creatingFolder || !newFolderName.trim()
                    ? styles.newFolderButtonDisabled
                    : styles.newFolderButton
                }
              >
                {creatingFolder ? "Creating..." : "Create"}
              </button>
            </div>

            <div style={styles.folderList}>
              {folderBrowser.root_path &&
              folderBrowser.current_path !== folderBrowser.root_path ? (
                <button
                  type="button"
                  onClick={() => {
                    const current = String(
                      folderBrowser.current_path || ""
                    );
                    const root = String(folderBrowser.root_path || "");
                    const currentParts = current.split("/").filter(Boolean);
                    const rootParts = root.split("/").filter(Boolean);

                    if (currentParts.length > rootParts.length) {
                      const parent =
                        "/" +
                        currentParts.slice(0, -1).join("/");
                      void browseDestinationFolder(parent);
                    } else {
                      void browseDestinationFolder(root);
                    }
                  }}
                  style={styles.folderRow}
                >
                  <span style={styles.folderIcon}>←</span>
                  <span style={styles.folderRowCopy}>
                    <strong>Back</strong>
                    <small>Go to parent folder</small>
                  </span>
                </button>
              ) : null}

              {(folderBrowser.items || [])
                .filter((item) => item.type === "folder")
                .map((folder) => (
                  <button
                    key={folder.path}
                    type="button"
                    onClick={() =>
                      void browseDestinationFolder(folder.path)
                    }
                    style={styles.folderRow}
                  >
                    <span style={styles.folderIcon}>▰</span>
                    <span style={styles.folderRowCopy}>
                      <strong>{folder.name}</strong>
                      <small>{folder.path}</small>
                    </span>
                    <span style={styles.folderChevron}>›</span>
                  </button>
                ))}

              {(folderBrowser.items || []).filter(
                (item) => item.type === "folder"
              ).length === 0 ? (
                <div style={styles.folderEmpty}>
                  No subfolders inside this folder.
                </div>
              ) : null}
            </div>

            {folderError ? (
              <div style={styles.modalError}>{folderError}</div>
            ) : null}

            <div style={styles.folderModalFooter}>
              <div style={styles.selectedFolderPreview}>
                <span>Use current folder</span>
                <strong>
                  {folderBrowser.current_name ||
                    folderBrowser.current_path}
                </strong>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setFolderPickerOpen(false)}
                  style={styles.secondaryButton}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={selectCurrentDestination}
                  style={styles.primaryButton}
                >
                  Use This Folder
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function Summary({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div style={styles.summaryCard}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "20px 22px 42px",
    background: "#eef2f5",
    color: "#10233a",
  },
  loading: {
    minHeight: "70vh",
    display: "grid",
    placeItems: "center",
    color: "#526577",
    fontSize: 13,
    fontWeight: 800,
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 12,
  },
  eyebrow: {
    marginBottom: 4,
    color: "#1768d2",
    fontSize: 10,
    fontWeight: 900,
  },
  title: {
    margin: 0,
    fontSize: 25,
    fontWeight: 950,
    letterSpacing: "-0.025em",
  },
  subtitle: {
    margin: "5px 0 0",
    color: "#687789",
    fontSize: 11,
  },
  headerActions: {
    display: "flex",
    gap: 8,
  },
  error: {
    marginBottom: 10,
    padding: "9px 11px",
    border: "1px solid #e4a0a0",
    background: "#fff1f1",
    color: "#9f1f1f",
    fontSize: 9,
    fontWeight: 800,
  },
  notice: {
    marginBottom: 10,
    padding: "9px 11px",
    border: "1px solid #b7ddc7",
    background: "#edf9f2",
    color: "#226443",
    fontSize: 9,
    fontWeight: 800,
  },
  summaryGrid: {
    marginBottom: 12,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    border: "1px solid #cfd8e3",
    background: "#ffffff",
  },
  summaryCard: {
    minHeight: 68,
    padding: "11px 13px",
    display: "grid",
    alignContent: "center",
    gap: 2,
    borderRight: "1px solid #dfe6ed",
    fontSize: 9,
  },
  panel: {
    marginBottom: 12,
    border: "1px solid #cfd8e3",
    background: "#ffffff",
  },
  panelHeader: {
    minHeight: 56,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #dfe6ed",
  },
  panelTitle: {
    display: "block",
    fontSize: 13,
    fontWeight: 950,
  },
  panelSub: {
    display: "block",
    marginTop: 3,
    color: "#748191",
    fontSize: 9,
  },
  formGrid: {
    padding: 12,
    display: "grid",
    gridTemplateColumns:
      "1fr 1.3fr 1.3fr 1fr 0.8fr 0.8fr",
    gap: 9,
    alignItems: "end",
  },
  field: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  label: {
    color: "#526577",
    fontSize: 8,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    height: 34,
    boxSizing: "border-box",
    padding: "0 9px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: 72,
    boxSizing: "border-box",
    padding: "8px 9px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    resize: "vertical",
    outline: "none",
  },
  requirements: {
    gridColumn: "span 3",
    minHeight: 34,
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#526577",
    fontSize: 8.5,
    fontWeight: 800,
  },
  primaryButton: {
    height: 34,
    padding: "0 13px",
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 950,
    cursor: "pointer",
  },
  primaryDisabled: {
    height: 34,
    padding: "0 13px",
    border: "1px solid #cbd5e1",
    background: "#e9edf2",
    color: "#8996a4",
    fontSize: 9,
    fontWeight: 950,
    cursor: "not-allowed",
  },
  secondaryButton: {
    height: 34,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  listToolbar: {
    minHeight: 62,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid #dfe6ed",
  },
  filters: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  search: {
    width: 240,
    height: 34,
    padding: "0 9px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    outline: "none",
  },
  filterSelect: {
    width: 160,
    height: 34,
    padding: "0 8px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
  },
  tableHeader: {
    minHeight: 36,
    padding: "0 12px",
    display: "grid",
    gridTemplateColumns:
      "minmax(260px, 1.7fr) 165px 95px 80px 120px 115px 175px",
    gap: 10,
    alignItems: "center",
    background: "#f4f7fa",
    borderBottom: "1px solid #dfe6ed",
    color: "#5f6f81",
    fontSize: 8,
    fontWeight: 900,
  },
  tableRow: {
    minHeight: 68,
    padding: "8px 12px",
    display: "grid",
    gridTemplateColumns:
      "minmax(260px, 1.7fr) 165px 95px 80px 120px 115px 175px",
    gap: 10,
    alignItems: "center",
    borderBottom: "1px solid #e6ebf0",
  },
  requestCell: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  requestTopline: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 9.5,
  },
  requestDescription: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#748191",
    fontSize: 8.5,
  },
  typePill: {
    flex: "0 0 auto",
    padding: "4px 6px",
    background: "#eef4f8",
    color: "#526577",
    fontSize: 7.5,
    fontWeight: 900,
  },
  priorityPill: {
    justifySelf: "start",
    padding: "5px 8px",
    background: "#f2f4f7",
    color: "#526577",
    fontSize: 7.8,
    fontWeight: 900,
  },
  priorityHigh: {
    background: "#fff5e8",
    color: "#9b5f14",
  },
  priorityUrgent: {
    background: "#fff0f0",
    color: "#a43d2f",
  },
  rowSelect: {
    width: "100%",
    height: 30,
    padding: "0 7px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 8.5,
  },
  tableText: {
    color: "#526577",
    fontSize: 8.5,
  },
  empty: {
    minHeight: 140,
    display: "grid",
    placeItems: "center",
    color: "#7b8794",
    fontSize: 9.5,
  },

  destinationRow: {
    minHeight: 54,
    display: "flex",
    alignItems: "stretch",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
  },
  destinationValue: {
    minWidth: 0,
    flex: 1,
    padding: "8px 10px",
    display: "grid",
    gap: 3,
  },
  destinationButton: {
    minWidth: 118,
    border: "none",
    borderLeft: "1px solid #cbd5e1",
    background: "#f7f9fb",
    color: "#1768d2",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  destinationError: {
    marginTop: 3,
    color: "#a43d2f",
    fontSize: 8,
    fontWeight: 800,
  },
  requestDestination: {
    color: "#1768d2",
    fontSize: 8,
    fontWeight: 800,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    padding: 24,
    display: "grid",
    placeItems: "center",
    background: "rgba(15,35,58,0.45)",
  },
  folderModal: {
    width: "min(760px, 92vw)",
    maxHeight: "82vh",
    display: "grid",
    gridTemplateRows: "auto auto auto minmax(240px, 1fr) auto auto",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    boxShadow: "0 24px 70px rgba(15,35,58,0.24)",
  },
  folderModalHeader: {
    padding: "18px 20px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
    borderBottom: "1px solid #dfe6ed",
  },
  folderModalTitle: {
    display: "block",
    fontSize: 17,
    fontWeight: 950,
  },
  folderModalSub: {
    display: "block",
    marginTop: 5,
    color: "#687789",
    fontSize: 10,
    lineHeight: 1.45,
  },
  modalClose: {
    width: 30,
    height: 30,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#526577",
    fontSize: 18,
    cursor: "pointer",
  },

  folderProvider: {
    padding: "5px 9px",
    background: "#eaf3ff",
    color: "#1768d2",
    fontSize: 8.5,
    fontWeight: 900,
  },
  folderCurrentPath: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#526577",
    fontSize: 9,
  },
  folderList: {
    overflowY: "auto",
    background: "#ffffff",
  },
  folderRow: {
    width: "100%",
    minHeight: 64,
    padding: "9px 18px",
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr) 24px",
    alignItems: "center",
    gap: 10,
    border: "none",
    borderBottom: "1px solid #edf1f4",
    background: "#ffffff",
    color: "#10233a",
    textAlign: "left",
    cursor: "pointer",
  },
  folderIcon: {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    background: "#fff4d7",
    color: "#b47d00",
    fontSize: 13,
  },
  folderChevron: {
    color: "#84909d",
    fontSize: 20,
  },
  folderEmpty: {
    minHeight: 120,
    display: "grid",
    placeItems: "center",
    color: "#84909d",
    fontSize: 9,
  },
  modalError: {
    margin: "8px 14px 0",
    padding: "8px 10px",
    border: "1px solid #e4a0a0",
    background: "#fff1f1",
    color: "#9f1f1f",
    fontSize: 8.5,
    fontWeight: 800,
  },
  folderModalFooter: {
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderTop: "1px solid #dfe6ed",
  },
  selectedFolderPreview: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    color: "#526577",
    fontSize: 9,
  },
  modalActions: {
    display: "flex",
    gap: 8,
  },

  newFolderBar: {
    minHeight: 68,
    padding: "10px 18px",
    display: "grid",
    gridTemplateColumns: "minmax(170px, 0.8fr) minmax(220px, 1fr) 92px",
    alignItems: "center",
    gap: 10,
    borderBottom: "1px solid #dfe6ed",
    background: "#ffffff",
  },
  newFolderCopy: {
    minWidth: 0,
    display: "grid",
    gap: 2,
    color: "#10233a",
    fontSize: 8.5,
  },
  newFolderInput: {
    width: "100%",
    height: 36,
    boxSizing: "border-box",
    padding: "0 9px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 8.5,
    outline: "none",
  },
  newFolderButton: {
    height: 36,
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  newFolderButtonDisabled: {
    height: 36,
    border: "1px solid #cbd5e1",
    background: "#eef2f6",
    color: "#8996a4",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "not-allowed",
  },

  folderEyebrow: {
    marginBottom: 5,
    color: "#1768d2",
    fontSize: 8,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },
  folderLocationBar: {
    minHeight: 62,
    padding: "10px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #dfe6ed",
    background: "#f6f9fc",
  },
  folderLocationCopy: {
    minWidth: 0,
    display: "grid",
    gap: 2,
    color: "#10233a",
  },
  folderRowCopy: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    color: "#10233a",
  },

  requestComposer: {
    padding: 16,
    display: "grid",
    gap: 14,
  },
  composerPrimaryRow: {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    gap: 12,
  },
  composerMetaRow: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1.4fr) 180px 160px",
    gap: 12,
  },
  composerWorkArea: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, 0.85fr)",
    gap: 12,
    alignItems: "stretch",
  },
  descriptionField: {
    minWidth: 0,
    display: "grid",
    gap: 5,
  },
  composerTextarea: {
    width: "100%",
    minHeight: 110,
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: "#ffffff",
    color: "#10233a",
    fontSize: 10,
    lineHeight: 1.5,
    resize: "vertical",
    outline: "none",
  },
  destinationCard: {
    minHeight: 110,
    padding: 13,
    display: "grid",
    alignContent: "start",
    gap: 8,
    border: "1px solid #c9d9eb",
    borderRadius: 7,
    background: "#f5f9fe",
  },
  requestBehaviourCard: {
    minHeight: 110,
    padding: 13,
    display: "grid",
    alignContent: "start",
    gap: 8,
    border: "1px solid #d7e0e8",
    borderRadius: 7,
    background: "#f8fafc",
  },
  destinationCardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  destinationTitle: {
    display: "block",
    marginTop: 4,
    color: "#10233a",
    fontSize: 11,
    fontWeight: 950,
  },
  destinationPath: {
    color: "#667789",
    fontSize: 9,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  destinationAction: {
    minWidth: 92,
    height: 32,
    padding: "0 10px",
    border: "1px solid #1768d2",
    borderRadius: 5,
    background: "#ffffff",
    color: "#1768d2",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  composerFooter: {
    paddingTop: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  requirementPills: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  requirementPill: {
    minHeight: 30,
    padding: "0 10px",
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid #d4dde7",
    borderRadius: 999,
    background: "#ffffff",
    color: "#657487",
    fontSize: 8.5,
    fontWeight: 850,
    cursor: "pointer",
  },
  requirementPillActive: {
    borderColor: "#9fc3ee",
    background: "#edf5ff",
    color: "#1768d2",
  },
  requirementPillEmail: {
    borderColor: "#aed9bd",
    background: "#eef9f2",
    color: "#26784a",
  },
  hiddenCheck: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
  },
  createRequestButton: {
    minWidth: 150,
    height: 36,
    padding: "0 16px",
    border: "1px solid #1768d2",
    borderRadius: 5,
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: 950,
    cursor: "pointer",
  },
  createRequestDisabled: {
    minWidth: 150,
    height: 36,
    padding: "0 16px",
    border: "1px solid #cbd5e1",
    borderRadius: 5,
    background: "#e9edf2",
    color: "#8996a4",
    fontSize: 9.5,
    fontWeight: 950,
    cursor: "not-allowed",
  },

  rowActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  rowActionButton: {
    height: 30,
    padding: "0 10px",
    border: "1px solid #1768d2",
    borderRadius: 5,
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  rowActionButtonSecondary: {
    height: 30,
    padding: "0 10px",
    border: "1px solid #b9c8d8",
    borderRadius: 5,
    background: "#ffffff",
    color: "#1768d2",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  requestDetailRow: {
    padding: "12px 14px 14px",
    borderBottom: "1px solid #dfe6ed",
    background: "#f8fbfe",
  },
  requestDetailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },
  detailLabel: {
    display: "block",
    marginBottom: 5,
    color: "#708093",
    fontSize: 8,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  detailValue: {
    display: "block",
    color: "#10233a",
    fontSize: 10.5,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },
  detailText: {
    display: "block",
    marginTop: 5,
    color: "#667789",
    fontSize: 8.5,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

};
