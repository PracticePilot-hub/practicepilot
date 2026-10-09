"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/app/lib/supabase";
type BrowseItem = {
  id: string | null;
  name: string;
  path: string;
  type: "folder" | "file";
  size_bytes: number | null;
  modified_at: string | null;
  workflow_status?: string | null;
  client_visible?: boolean | null;
  owner_name?: string | null;
  owner_initials?: string | null;
  recent_activity?: string | null;
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
type WorkflowStatus =
  | "stored"
  | "awaiting_review"
  | "reviewed"
  | "approved"
  | "rejected";

type PortalCategory =
  | "financial_statements"
  | "tax"
  | "management_accounts"
  | "vat"
  | "payroll"
  | "secretarial"
  | "company_documents"
  | "agreements_contracts"
  | "general";

const PORTAL_CATEGORY_OPTIONS: Array<{
  value: PortalCategory;
  label: string;
}> = [
  { value: "financial_statements", label: "Financial Statements" },
  { value: "tax", label: "Tax" },
  { value: "management_accounts", label: "Management Accounts" },
  { value: "vat", label: "VAT" },
  { value: "payroll", label: "Payroll" },
  { value: "secretarial", label: "Secretarial" },
  { value: "company_documents", label: "Company Documents" },
  { value: "agreements_contracts", label: "Agreements & Contracts" },
  { value: "general", label: "General" },
];

type WorkflowRecord = {
  id: string;
  item_type?: "file" | "folder";
  provider_item_id?: string | null;
  provider_path: string;
  document_name: string;
  portal_category?: PortalCategory | null;
  workflow_status: WorkflowStatus;
  client_visible: boolean;
  last_activity_text?: string | null;
  review_requested_at?: string | null;
  review_assigned_user_id?: string | null;
  review_work_item_id?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  released_at?: string | null;
  updated_at?: string | null;
};

type ReviewerOption = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role?: string | null;
};
function providerLabel(value: string | null) {
  if (value === "egnyte") return "Egnyte";
  if (value === "google_drive") return "Google Drive";
  if (value === "onedrive") return "OneDrive";
  if (value === "dropbox") return "Dropbox";
  return "Document Provider";
}
function itemKey(item: BrowseItem) {
  return `${item.type}-${item.path}`;
}
function Icon({
  name,
  size = 18,
}: {
  name:
    | "search"
    | "refresh"
    | "upload"
    | "folder"
    | "file"
    | "chevronRight"
    | "chevronDown"
    | "users"
    | "more";
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
  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
    );
  }
  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M6.1 8.5A7 7 0 0 1 18.7 7" />
        <path d="M17.9 15.5A7 7 0 0 1 5.3 17" />
      </svg>
    );
  }
  if (name === "upload") {
    return (
      <svg {...common}>
        <path d="M12 16V5" />
        <path d="m8 9 4-4 4 4" />
        <path d="M5 19h14" />
      </svg>
    );
  }
  if (name === "folder") {
    return (
      <svg {...common}>
        <path d="M3.5 6.5h6l2 2h9v9.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z" />
      </svg>
    );
  }
  if (name === "file") {
    return (
      <svg {...common}>
        <path d="M6.5 3.5h7l4 4v13h-11z" />
        <path d="M13.5 3.5v4h4" />
      </svg>
    );
  }
  if (name === "chevronRight") {
    return (
      <svg {...common}>
        <path d="m9 6 6 6-6 6" />
      </svg>
    );
  }
  if (name === "chevronDown") {
    return (
      <svg {...common}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2" />
        <path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6" />
        <path d="M15 15c3 0 4.7 1.7 5 5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function fileExtension(name: string) {
  const clean = String(name || "").trim().toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1) : "";
}
function fileVisual(name: string) {
  const ext = fileExtension(name);
  if (ext === "pdf") {
    return { label: "PDF", short: "PDF", background: "#e54242", color: "#ffffff" };
  }
  if (["xlsx", "xls", "xlsm", "csv"].includes(ext)) {
    return { label: ext === "csv" ? "CSV" : "Excel", short: "XLS", background: "#1f8f5f", color: "#ffffff" };
  }
  if (["docx", "doc", "rtf"].includes(ext)) {
    return { label: "Word", short: "DOC", background: "#2f67c7", color: "#ffffff" };
  }
  if (["pptx", "ppt"].includes(ext)) {
    return { label: "PowerPoint", short: "PPT", background: "#d55a2a", color: "#ffffff" };
  }
  if (["jpg", "jpeg", "png", "gif", "webp", "tif", "tiff"].includes(ext)) {
    return { label: "Image", short: "IMG", background: "#8a5bc3", color: "#ffffff" };
  }
  if (["zip", "rar", "7z"].includes(ext)) {
    return { label: "Archive", short: "ZIP", background: "#667085", color: "#ffffff" };
  }
  if (["txt", "md"].includes(ext)) {
    return { label: "Text", short: "TXT", background: "#526577", color: "#ffffff" };
  }
  return {
    label: ext ? ext.toUpperCase() : "File",
    short: ext ? ext.slice(0, 3).toUpperCase() : "FILE",
    background: "#eef2f5",
    color: "#506273",
  };
}
function canPreviewInBrowser(name: string) {
  const ext = fileExtension(name);
  return [
    "pdf",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "txt",
    "md",
  ].includes(ext);
}
function FileTypeBadge({ name }: { name: string }) {
  const visual = fileVisual(name);
  return (
    <span
      style={{
        ...styles.documentBadge,
        background: visual.background,
        color: visual.color,
        border:
          visual.color === "#ffffff"
            ? "1px solid rgba(0,0,0,0.08)"
            : "1px solid #d7dfe7",
      }}
      aria-hidden="true"
    >
      {visual.short}
    </span>
  );
}
export default function DocumentBrowser({
  clientId,
}: {
  clientId: string;
}) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [rootData, setRootData] = useState<BrowseResponse | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState<
    "preview" | "download" | "upload" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [focusedItem, setFocusedItem] = useState<BrowseItem | null>(null);
  const [rightTab, setRightTab] = useState<"preview" | "details" | "activity" | "insights">("preview");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [workflowByPath, setWorkflowByPath] = useState<
    Record<string, WorkflowRecord>
  >({});
  const workflowByPathRef = useRef<Record<string, WorkflowRecord>>({});
  const [workflowReady, setWorkflowReady] = useState(false);
  const [workflowBusyPath, setWorkflowBusyPath] = useState("");
  const [showDocumentActions, setShowDocumentActions] = useState(false);
  const [showPortalMenu, setShowPortalMenu] = useState(false);
  const [reviewers, setReviewers] = useState<ReviewerOption[]>([]);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [reviewRequestItem, setReviewRequestItem] = useState<BrowseItem | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [reviewDueDate, setReviewDueDate] = useState(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  });
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const folderCacheRef = useRef<Map<string, BrowseResponse>>(new Map());
  const inFlightFolderRef = useRef<Map<string, Promise<BrowseResponse>>>(new Map());
  function folderCacheKey(targetPath?: string) {
    return targetPath || "__ROOT__";
  }
  function applyWorkflowToItems(
    items: BrowseItem[],
    workflowMap: Record<string, WorkflowRecord> = workflowByPath
  ) {
    return items.map((item) => {
      const workflow = workflowMap[item.path];

      if (!workflow) {
        return {
          ...item,
          workflow_status: "stored",
          client_visible: false,
          recent_activity: null,
        };
      }

      return {
        ...item,
        workflow_status: workflow.workflow_status,
        client_visible: workflow.client_visible,
        recent_activity: workflow.last_activity_text || null,
      };
    });
  }

  function applyWorkflowToBrowseResponse(
    response: BrowseResponse,
    workflowMap: Record<string, WorkflowRecord> = workflowByPathRef.current
  ) {
    return {
      ...response,
      items: applyWorkflowToItems(response.items, workflowMap),
    };
  }

  async function loadWorkflow() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/workflow`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not load document workflow."
        );
      }

      setReviewers((result.reviewers || []) as ReviewerOption[]);

      const nextMap: Record<string, WorkflowRecord> = {};

      for (const row of result.workflow || []) {
        if (row?.provider_path) {
          nextMap[String(row.provider_path)] = row as WorkflowRecord;
        }
      }

      workflowByPathRef.current = nextMap;
      setWorkflowByPath(nextMap);
      setWorkflowReady(true);

      setData((current) =>
        current ? applyWorkflowToBrowseResponse(current, nextMap) : current
      );

      setRootData((current) =>
        current ? applyWorkflowToBrowseResponse(current, nextMap) : current
      );

      folderCacheRef.current.forEach((cached, key) => {
        folderCacheRef.current.set(
          key,
          applyWorkflowToBrowseResponse(cached, nextMap)
        );
      });

      setFocusedItem((current) => {
        if (!current || current.type !== "file") return current;

        const workflow = nextMap[current.path];

        return workflow
          ? {
              ...current,
              workflow_status: workflow.workflow_status,
              client_visible: workflow.client_visible,
              recent_activity: workflow.last_activity_text || null,
            }
          : {
              ...current,
              workflow_status: "stored",
              client_visible: false,
              recent_activity: null,
            };
      });
    } catch (caught) {
      console.error("Could not load document workflow", caught);
      setWorkflowReady(true);
    }
  }

  async function ensureWorkflowRecord(item: BrowseItem) {
    const existing = workflowByPathRef.current[item.path];

    if (existing && existing.item_type === item.type) {
      return existing;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Your PracticePilot login session could not be confirmed."
      );
    }

    const response = await fetch(
      `/api/crm/clients/${clientId}/documents/workflow`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider_path: item.path,
          provider_item_id: item.id,
          document_name: item.name,
          item_type: item.type,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result?.success || !result?.workflow) {
      throw new Error(
        result?.error || "Could not register document workflow."
      );
    }

    const workflow = result.workflow as WorkflowRecord;

    workflowByPathRef.current = {
      ...workflowByPathRef.current,
      [workflow.provider_path]: workflow,
    };
    setWorkflowByPath(workflowByPathRef.current);

    return workflow;
  }

  function reviewerName(userId: string | null | undefined) {
    if (!userId) return "";
    const reviewer = reviewers.find((item) => item.user_id === userId);
    return reviewer?.full_name || reviewer?.email || "Reviewer";
  }

  function openReviewRequest(item: BrowseItem) {
    setReviewRequestItem(item);

    const existingReviewer =
      workflowByPath[item.path]?.review_assigned_user_id || "";

    setSelectedReviewerId(
      existingReviewer ||
        (reviewers.length === 1 ? reviewers[0].user_id : "")
    );

    const now = new Date();
    setReviewDueDate(
      [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-")
    );

    setShowReviewRequest(true);
    setError("");
    setNotice("");
  }

  async function submitReviewRequest() {
    const item = reviewRequestItem;
    if (!item) return;

    if (!selectedReviewerId) {
      setError(`Choose the person who must review this ${item.type === "folder" ? "folder pack" : "document"}.`);
      return;
    }

    setWorkflowBusyPath(item.path);
    setError("");
    setNotice("");

    try {
      await ensureWorkflowRecord(item);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your PracticePilot login session could not be confirmed."
        );
      }

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/workflow`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider_path: item.path,
            item_type: item.type,
            workflow_status: "awaiting_review",
            reviewer_user_id: selectedReviewerId,
            review_due_date: reviewDueDate,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.workflow) {
        throw new Error(
          result?.error || `Could not request ${item.type === "folder" ? "folder pack" : "document"} review.`
        );
      }

      const workflow = result.workflow as WorkflowRecord;

      workflowByPathRef.current = {
        ...workflowByPathRef.current,
        [workflow.provider_path]: workflow,
      };
      setWorkflowByPath(workflowByPathRef.current);

      const applyOne = (candidate: BrowseItem) =>
        candidate.path === workflow.provider_path
          ? {
              ...candidate,
              workflow_status: workflow.workflow_status,
              client_visible: workflow.client_visible,
              recent_activity: workflow.last_activity_text || null,
            }
          : candidate;

      setData((current) =>
        current
          ? { ...current, items: current.items.map(applyOne) }
          : current
      );

      setRootData((current) =>
        current
          ? { ...current, items: current.items.map(applyOne) }
          : current
      );

      folderCacheRef.current.forEach((cached, key) => {
        folderCacheRef.current.set(key, {
          ...cached,
          items: cached.items.map(applyOne),
        });
      });

      setFocusedItem((current) =>
        current && current.path === workflow.provider_path
          ? applyOne(current)
          : current
      );

      setShowReviewRequest(false);
      setReviewRequestItem(null);

      setNotice(
        `${item.name} sent to ${reviewerName(
          selectedReviewerId
        )} for review.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Could not request ${item.type === "folder" ? "folder pack" : "document"} review.`
      );
    } finally {
      setWorkflowBusyPath("");
    }
  }

  async function updateWorkflowStatus(
    item: BrowseItem,
    nextStatus: WorkflowStatus
  ) {
    setWorkflowBusyPath(item.path);
    setError("");
    setNotice("");

    try {
      await ensureWorkflowRecord(item);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your PracticePilot login session could not be confirmed."
        );
      }

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/workflow`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider_path: item.path,
            item_type: item.type,
            workflow_status: nextStatus,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.workflow) {
        throw new Error(
          result?.error || "Could not update document workflow."
        );
      }

      const workflow = result.workflow as WorkflowRecord;

      workflowByPathRef.current = {
        ...workflowByPathRef.current,
        [workflow.provider_path]: workflow,
      };
      setWorkflowByPath(workflowByPathRef.current);

      const applyOne = (candidate: BrowseItem) =>
        candidate.path === workflow.provider_path
          ? {
              ...candidate,
              workflow_status: workflow.workflow_status,
              client_visible: workflow.client_visible,
              recent_activity: workflow.last_activity_text || null,
            }
          : candidate;

      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map(applyOne),
            }
          : current
      );

      setRootData((current) =>
        current
          ? {
              ...current,
              items: current.items.map(applyOne),
            }
          : current
      );

      folderCacheRef.current.forEach((cached, key) => {
        folderCacheRef.current.set(key, {
          ...cached,
          items: cached.items.map(applyOne),
        });
      });

      setFocusedItem((current) =>
        current && current.path === workflow.provider_path
          ? applyOne(current)
          : current
      );

      const label =
        nextStatus === "awaiting_review"
          ? "Awaiting Review"
          : nextStatus === "reviewed"
            ? "Reviewed"
            : nextStatus === "approved"
              ? "Approved"
              : nextStatus === "rejected"
                ? "Rejected"
                : "Stored";

      setNotice(`${item.name} is now ${label}.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update document workflow."
      );
    } finally {
      setWorkflowBusyPath("");
    }
  }
  function portalCategoryLabel(
    value: PortalCategory | null | undefined
  ) {
    return (
      PORTAL_CATEGORY_OPTIONS.find((item) => item.value === value)?.label ||
      "General"
    );
  }

  async function updatePortalCategory(
    item: BrowseItem,
    nextCategory: PortalCategory
  ) {
    setWorkflowBusyPath(item.path);
    setError("");
    setNotice("");

    try {
      await ensureWorkflowRecord(item);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your PracticePilot login session could not be confirmed."
        );
      }

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/workflow`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider_path: item.path,
            item_type: item.type,
            action: "set_portal_category",
            portal_category: nextCategory,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.workflow) {
        throw new Error(
          result?.error || "Could not update the client portal category."
        );
      }

      const nextWorkflow = result.workflow as WorkflowRecord;

      workflowByPathRef.current = {
        ...workflowByPathRef.current,
        [nextWorkflow.provider_path]: nextWorkflow,
      };
      setWorkflowByPath(workflowByPathRef.current);

      setNotice(
        `${item.name} will appear under ${portalCategoryLabel(
          nextWorkflow.portal_category
        )} in the Client Portal.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update the client portal category."
      );
    } finally {
      setWorkflowBusyPath("");
    }
  }

  async function updateClientRelease(
    item: BrowseItem,
    makeVisible: boolean
  ) {
    if (item.type === "file" && makeVisible && workflowLabel(item) !== "Approved") {
      setError("Only an approved document can be released to the client.");
      return;
    }

    if (
      !makeVisible &&
      !window.confirm(
        `Remove client access to ${item.name}? The document will remain approved but will no longer be visible to the client.`
      )
    ) {
      return;
    }

    setWorkflowBusyPath(item.path);
    setError("");
    setNotice("");

    try {
      const workflow = await ensureWorkflowRecord(item);

      if (item.type === "file" && makeVisible && workflow.workflow_status !== "approved") {
        throw new Error(
          "Only an approved document can be released to the client."
        );
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your PracticePilot login session could not be confirmed."
        );
      }

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/workflow`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider_path: item.path,
            action: makeVisible ? "release" : "unrelease",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.workflow) {
        throw new Error(
          result?.error ||
            (makeVisible
              ? "Could not release the document to the client."
              : "Could not remove client access.")
        );
      }

      const nextWorkflow = result.workflow as WorkflowRecord;

      workflowByPathRef.current = {
        ...workflowByPathRef.current,
        [nextWorkflow.provider_path]: nextWorkflow,
      };
      setWorkflowByPath(workflowByPathRef.current);

      const applyOne = (candidate: BrowseItem) =>
        candidate.path === nextWorkflow.provider_path
          ? {
              ...candidate,
              workflow_status: nextWorkflow.workflow_status,
              client_visible: nextWorkflow.client_visible,
              recent_activity: nextWorkflow.last_activity_text || null,
            }
          : candidate;

      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map(applyOne),
            }
          : current
      );

      setRootData((current) =>
        current
          ? {
              ...current,
              items: current.items.map(applyOne),
            }
          : current
      );

      folderCacheRef.current.forEach((cached, key) => {
        folderCacheRef.current.set(key, {
          ...cached,
          items: cached.items.map(applyOne),
        });
      });

      setFocusedItem((current) =>
        current && current.path === nextWorkflow.provider_path
          ? applyOne(current)
          : current
      );

      setNotice(
        makeVisible
          ? `${item.name} released to the client.`
          : `Client access removed from ${item.name}.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : makeVisible
            ? "Could not release the document to the client."
            : "Could not remove client access."
      );
    } finally {
      setWorkflowBusyPath("");
    }
  }

  async function patchWorkflow(item: BrowseItem, body: Record<string, unknown>) {
    await ensureWorkflowRecord(item);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your PracticePilot login session could not be confirmed.");
    }

    const response = await fetch(
      `/api/crm/clients/${clientId}/documents/workflow`,
      {
        method: "PATCH",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider_path: item.path,
          item_type: item.type,
          ...body,
        }),
      }
    );

    const result = await response.json();
    if (!response.ok || !result?.success || !result?.workflow) {
      throw new Error(result?.error || "Could not update document workflow.");
    }

    const workflow = result.workflow as WorkflowRecord;
    workflowByPathRef.current = {
      ...workflowByPathRef.current,
      [workflow.provider_path]: workflow,
    };
    setWorkflowByPath(workflowByPathRef.current);
    return workflow;
  }

  async function releaseFolderPack(
    folder: BrowseItem,
    category: PortalCategory,
    makeVisible: boolean
  ) {
    if (folder.type !== "folder") return;

    setWorkflowBusyPath(folder.path);
    setError("");
    setNotice("");

    try {
      const visited = new Set<string>();
      const pendingApproval: string[] = [];

      const walk = async (currentFolder: BrowseItem) => {
        if (visited.has(currentFolder.path)) return;
        visited.add(currentFolder.path);

        await ensureWorkflowRecord(currentFolder);
        await patchWorkflow(currentFolder, {
          action: "set_portal_category",
          portal_category: category,
        });
        await patchWorkflow(currentFolder, {
          action: makeVisible ? "release" : "unrelease",
        });

        const response = await fetchFolder(currentFolder.path, true);

        for (const child of response.items || []) {
          await ensureWorkflowRecord(child);
          await patchWorkflow(child, {
            action: "set_portal_category",
            portal_category: category,
          });

          if (child.type === "folder") {
            await walk(child);
            continue;
          }

          if (makeVisible) {
            const workflow = workflowByPathRef.current[child.path];

            if (workflow?.workflow_status === "approved") {
              await patchWorkflow(child, {
                action: "release",
              });
            } else {
              pendingApproval.push(child.name);
            }

            continue;
          }

          await patchWorkflow(child, {
            action: "unrelease",
          });
        }
      };

      await walk(folder);
      await loadWorkflow();
      await load(currentPath, { force: true });
      setNotice(
        makeVisible
          ? pendingApproval.length
            ? `${folder.name} was released under ${portalCategoryLabel(
                category
              )}. ${pendingApproval.length} document${
                pendingApproval.length === 1 ? "" : "s"
              } remain internal until review and approval are completed.`
            : `${folder.name} and all approved documents were released to the client under ${portalCategoryLabel(
                category
              )}.`
          : `Client access was removed from ${folder.name} and its current contents.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : makeVisible
            ? "Could not release the folder pack to the client."
            : "Could not remove client access from the folder pack."
      );
    } finally {
      setWorkflowBusyPath("");
    }
  }

  async function fetchFolder(targetPath?: string, force = false) {
    const key = folderCacheKey(targetPath);
    if (!force) {
      const cached = folderCacheRef.current.get(key);
      if (cached) return cached;
      const inFlight = inFlightFolderRef.current.get(key);
      if (inFlight) return inFlight;
    }
    const request = (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error(
          "Your PracticePilot login session could not be confirmed."
        );
      }
      const params = new URLSearchParams();
      if (targetPath) {
        params.set("path", targetPath);
      }
      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/browse${
          params.toString() ? `?${params.toString()}` : ""
        }`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not load the document folder."
        );
      }
      const typedResult = applyWorkflowToBrowseResponse(
        result as BrowseResponse
      );
      folderCacheRef.current.set(key, typedResult);
      if (typedResult.current_path) {
        folderCacheRef.current.set(
          folderCacheKey(typedResult.current_path),
          typedResult
        );
      }
      if (
        typedResult.root_path &&
        typedResult.current_path === typedResult.root_path
      ) {
        folderCacheRef.current.set("__ROOT__", typedResult);
        folderCacheRef.current.set(
          folderCacheKey(typedResult.root_path),
          typedResult
        );
      }
      return typedResult;
    })();
    inFlightFolderRef.current.set(key, request);
    try {
      return await request;
    } finally {
      inFlightFolderRef.current.delete(key);
    }
  }
  function prefetchFolder(targetPath: string) {
    if (!targetPath) return;
    void fetchFolder(targetPath).catch(() => undefined);
  }

  function toggleFolderExpansion(path: string) {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }
  async function load(
    targetPath?: string,
    options?: { force?: boolean }
  ) {
    const force = Boolean(options?.force);
    const cached = !force
      ? folderCacheRef.current.get(folderCacheKey(targetPath))
      : null;
    setError("");
    setNotice("");
    setSelected(new Set());
    if (cached) {
      setData(cached);
      setCurrentPath(String(cached.current_path || ""));
      if (
        cached.linked &&
        cached.root_path &&
        cached.current_path === cached.root_path
      ) {
        setRootData(cached);
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchFolder(targetPath, force);
      setData(result);
      setCurrentPath(String(result.current_path || ""));
      if (result.linked && result.root_path) {
        if (result.current_path === result.root_path) {
          setRootData(result);
        } else if (!rootData || rootData.root_path !== result.root_path) {
          const rootResult = await fetchFolder(result.root_path);
          setRootData(rootResult);
        }
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load the document folder."
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    folderCacheRef.current.clear();
    inFlightFolderRef.current.clear();
    setData(null);
    setRootData(null);
    setCurrentPath("");
    setSearch("");
    setSelected(new Set());
    setExpandedFolders(new Set());
    workflowByPathRef.current = {};
    setWorkflowByPath({});
    setWorkflowReady(false);

    void (async () => {
      await loadWorkflow();

      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;

      const requestedFolderPath =
        String(params?.get("folderPath") || "").trim();

      await load(requestedFolderPath || undefined);
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    setFocusedItem(null);
    setRightTab("preview");
    setPreviewUrl("");
  }, [data?.current_path]);
  useEffect(() => {
    setShowDocumentActions(false);
  }, [focusedItem?.path]);


  useEffect(() => {
    if (
      !workflowReady ||
      !data?.linked ||
      typeof window === "undefined"
    ) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const documentPath = params.get("documentPath");
    if (!documentPath) return;

    const normalisedDocumentPath = documentPath.startsWith("/")
      ? documentPath
      : `/${documentPath}`;

    const slash = normalisedDocumentPath.lastIndexOf("/");
    const parentPath =
      slash > 0 ? normalisedDocumentPath.slice(0, slash) : data.root_path || "";

    if (data.current_path !== parentPath) {
      void load(parentPath);
      return;
    }

    const matchingItem = (data.items || []).find(
      (item) => item.path === normalisedDocumentPath
    );

    if (matchingItem) {
      setFocusedItem(matchingItem);
      setSelected(new Set([itemKey(matchingItem)]));
      setRightTab(matchingItem.type === "file" ? "preview" : "details");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowReady, data?.current_path, data?.items]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);
  const hasDeepLinkedDocument =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("documentPath");

  const breadcrumbs = useMemo(() => {
    const root = String(data?.root_path || "");
    const current = String(data?.current_path || "");
    if (!root || !current) return [];
    const rootParts = root.split("/").filter(Boolean);
    const currentParts = current.split("/").filter(Boolean);
    const startIndex = Math.max(rootParts.length - 1, 0);
    return currentParts
      .map((part, index) => ({
        label: part,
        path: `/${currentParts.slice(0, index + 1).join("/")}`,
        index,
      }))
      .filter((crumb) => crumb.index >= startIndex);
  }, [data]);
  const rootFolders = useMemo(
    () => (rootData?.items || []).filter((item) => item.type === "folder"),
    [rootData]
  );

  function foldersForPath(path: string) {
    const source =
      currentPath === path
        ? data
        : folderCacheRef.current.get(folderCacheKey(path)) || null;

    return (source?.items || []).filter((item) => item.type === "folder");
  }

  function renderNestedFolders(parentPath: string, depth = 1) {
    const folders = foldersForPath(parentPath);

    return folders.map((folder) => {
      const selectedFolder = currentPath === folder.path;
      const expanded = expandedFolders.has(folder.path);

      return (
        <div key={itemKey(folder)}>
          <button
            type="button"
            onMouseEnter={() => prefetchFolder(folder.path)}
            onFocus={() => prefetchFolder(folder.path)}
            onClick={() => {
              toggleFolderExpansion(folder.path);
              if (!selectedFolder) void load(folder.path);
            }}
            style={{
              ...styles.nestedFolderRow,
              paddingLeft: 18 + depth * 16,
              ...(selectedFolder ? styles.nestedFolderRowActive : {}),
            }}
          >
            <span style={styles.nestedTreeGuide} />
            <span style={styles.smallFolderIcon}>
              <Icon name="folder" size={16} />
            </span>
            <span style={styles.nestedFolderName}>{folder.name}</span>
            <span style={styles.chevronRight}>
              <Icon
                name={expanded ? "chevronDown" : "chevronRight"}
                size={13}
              />
            </span>
          </button>

          {expanded ? renderNestedFolders(folder.path, depth + 1) : null}
        </div>
      );
    });
  }
  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data?.items || [];
    return (data?.items || []).filter((item) =>
      item.name.toLowerCase().includes(term)
    );
  }, [data, search]);
  const allSelected =
    visibleItems.length > 0 &&
    visibleItems.every((item) => selected.has(itemKey(item)));
  function toggleSelected(item: BrowseItem) {
    const key = itemKey(item);

    setSelected((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);

        if (focusedItem?.path === item.path) {
          setFocusedItem(null);
        }
      } else {
        next.add(key);
        setFocusedItem(item);
        setRightTab(item.type === "file" ? "preview" : "details");

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl("");
        }
      }

      return next;
    });
  }
  function toggleAll() {
    setSelected((current) => {
      if (allSelected) return new Set();
      return new Set(visibleItems.map((item) => itemKey(item)));
    });
  }
  const selectedItems = visibleItems.filter((item) =>
    selected.has(itemKey(item))
  );
  async function authenticatedBlob(path: string, disposition: "inline" | "attachment") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error(
        "Your PracticePilot login session could not be confirmed."
      );
    }
    const params = new URLSearchParams({
      path,
      disposition,
    });
    const response = await fetch(
      `/api/crm/clients/${clientId}/documents/download?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "Could not retrieve the document.");
    }
    return response.blob();
  }
  async function previewFile(item: BrowseItem) {
    if (item.type !== "file") return;
    setBusyAction("preview");
    setError("");
    setNotice("");
    try {
      const blob = await authenticatedBlob(item.path, "inline");
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not preview the document."
      );
    } finally {
      setBusyAction(null);
    }
  }
  async function loadInlinePreview(item: BrowseItem) {
    if (item.type !== "file" || !canPreviewInBrowser(item.name)) return;

    setPreviewLoading(true);
    setError("");

    try {
      const blob = await authenticatedBlob(item.path, "inline");

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load the document preview."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadFile(item: BrowseItem) {
    if (item.type !== "file") return;
    setBusyAction("download");
    setError("");
    setNotice("");
    try {
      const blob = await authenticatedBlob(
        item.path,
        "attachment"
      );
      const namedBlob = new File([blob], item.name, {
        type: blob.type || "application/octet-stream",
      });
      const objectUrl = URL.createObjectURL(namedBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = item.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not download the document."
      );
    } finally {
      setBusyAction(null);
    }
  }
  async function uploadFile(file: File) {
    if (!currentPath) return;
    setBusyAction("upload");
    setError("");
    setNotice("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error(
          "Your PracticePilot login session could not be confirmed."
        );
      }
      const formData = new FormData();
      formData.set("folderPath", currentPath);
      formData.set("file", file);
      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/upload`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not upload the document.");
      }
      const uploadedPath = `${currentPath.replace(/\/+$/, "")}/${file.name}`;

      const uploadedItem: BrowseItem = {
        id: result?.file?.id || result?.document?.id || null,
        name: file.name,
        path:
          String(
            result?.file?.path ||
              result?.document?.path ||
              result?.path ||
              uploadedPath
          ).trim() || uploadedPath,
        type: "file",
        size_bytes:
          typeof result?.file?.size_bytes === "number"
            ? result.file.size_bytes
            : file.size,
        modified_at:
          result?.file?.modified_at ||
          result?.document?.modified_at ||
          new Date().toISOString(),
        workflow_status: "stored",
        client_visible: false,
        recent_activity: "Document uploaded. Review required.",
      };

      setFocusedItem(uploadedItem);
      setSelected(new Set([itemKey(uploadedItem)]));
      setRightTab("details");

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }

      setNotice(`${file.name} uploaded successfully. Choose a reviewer.`);
      openReviewRequest(uploadedItem);

      // Refresh the provider-backed folder after opening the review request.
      // The review modal does not depend on Egnyte's folder listing becoming
      // consistent immediately after upload.
      void load(currentPath, { force: true }).catch(() => undefined);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not upload the document."
      );
    } finally {
      setBusyAction(null);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }
  async function createNewFolder() {
    const folderName = newFolderName.trim();

    if (!currentPath) {
      setError("Open a document folder before creating a new folder.");
      return;
    }

    if (!folderName) {
      setError("Enter a folder name.");
      return;
    }

    if (/[\/\\]/.test(folderName) || folderName === "." || folderName === "..") {
      setError("Folder names cannot contain / or \\.");
      return;
    }

    setCreatingFolder(true);
    setError("");
    setNotice("");

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
        `/api/crm/clients/${clientId}/documents/create-folder`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parentPath: currentPath,
            folderName,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.folder) {
        throw new Error(result?.error || "Could not create the folder.");
      }

      const createdFolder: BrowseItem = {
        id: result.folder.id || null,
        name: String(result.folder.name || folderName),
        path: String(result.folder.path || ""),
        type: "folder",
        size_bytes: null,
        modified_at: result.folder.modified_at || new Date().toISOString(),
      };

      setData((current) => {
        if (!current || current.current_path !== currentPath) return current;

        const nextItems = [...current.items, createdFolder].sort((a, b) => {
          if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        const next = { ...current, items: nextItems };
        folderCacheRef.current.set(folderCacheKey(currentPath), next);

        if (current.root_path === currentPath) {
          folderCacheRef.current.set("__ROOT__", next);
          setRootData(next);
        }

        return next;
      });

      setNewFolderName("");
      setShowNewFolder(false);
      setNotice(`${folderName} created successfully.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the folder."
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  function formatBytes(value: number | null) {
    if (!value || value < 1) return "—";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  function formatDate(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function workflowLabel(item: BrowseItem) {
    const value = String(item.workflow_status || "stored")
      .trim()
      .toLowerCase();

    if (value === "awaiting_review") return "Awaiting Review";
    if (value === "reviewed") return "Reviewed";
    if (value === "approved") return "Approved";
    if (value === "rejected") return "Rejected";
    return "Stored";
  }

  function workflowTone(item: BrowseItem) {
    const value = workflowLabel(item).toLowerCase();

    if (value.includes("approved") || value.includes("reviewed") || value.includes("signed")) {
      return styles.statusGreen;
    }

    if (value.includes("await") || value.includes("review")) {
      return styles.statusBlue;
    }

    if (
      value.includes("action") ||
      value.includes("overdue") ||
      value.includes("rejected")
    ) {
      return styles.statusRed;
    }

    if (value.includes("progress")) {
      return styles.statusAmber;
    }

    return styles.statusNeutral;
  }

  function ownerInitials(item: BrowseItem) {
    const supplied = String(item.owner_initials || "").trim();
    if (supplied) return supplied.slice(0, 3).toUpperCase();

    const owner = String(item.owner_name || "").trim();
    if (!owner) return "—";

    return owner
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  function formatShortDate(value: string | null) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function folderCachedCount(path: string) {
    const cached = folderCacheRef.current.get(folderCacheKey(path));
    return cached?.items?.length ?? null;
  }

  const currentFiles = (data?.items || []).filter((item) => item.type === "file");
  const currentFolders = (data?.items || []).filter((item) => item.type === "folder");
  const currentPreviewable = currentFiles.filter((item) =>
    canPreviewInBrowser(item.name)
  );
  const clientVisibleCount = currentFiles.filter(
    (item) => item.client_visible === true
  ).length;
  const awaitingReviewCount = currentFiles.filter((item) =>
    String(item.workflow_status || "").toLowerCase().includes("review")
  ).length;
  const needsActionCount = currentFiles.filter((item) => {
    const value = String(item.workflow_status || "").toLowerCase();
    return (
      value.includes("action") ||
      value.includes("overdue") ||
      value.includes("rejected")
    );
  }).length;

  const recentFiles = [...currentFiles]
    .filter((item) => item.modified_at)
    .sort((a, b) => {
      const aTime = new Date(a.modified_at || 0).getTime();
      const bTime = new Date(b.modified_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);

  const workflowQueue = currentFiles
    .filter((item) => {
      const value = String(item.workflow_status || "").toLowerCase();
      return (
        value.includes("review") ||
        value.includes("action") ||
        value.includes("overdue") ||
        value.includes("progress") ||
        value.includes("rejected")
      );
    })
    .slice(0, 5);

  if (loading && !data) {
    return <div style={styles.stateBox}>Loading client documents...</div>;
  }
  if (error && !data) {
    return (
      <div style={{ ...styles.stateBox, ...styles.errorBox }}>{error}</div>
    );
  }
  if (!data?.linked) {
    return (
      <div style={{ ...styles.stateBox, ...styles.warningBox }}>
        <strong>Document folder not linked</strong>
        <span>
          Map this client in Settings → Document Providers → Client Folder
          Mapping.
        </span>
      </div>
    );
  }
  const provider = providerLabel(data.provider);
  const folderCount = data.items.filter((item) => item.type === "folder").length;
  const fileCount = data.items.filter((item) => item.type === "file").length;
  const focusedIsFile = focusedItem?.type === "file";
  const focusedCanPreview =
    focusedItem?.type === "file" && canPreviewInBrowser(focusedItem.name);
  const currentFolderItem: BrowseItem | null =
    focusedItem?.type === "folder"
      ? {
          ...focusedItem,
          workflow_status:
            workflowByPath[focusedItem.path]?.workflow_status || "stored",
          client_visible:
            workflowByPath[focusedItem.path]?.client_visible || false,
          recent_activity:
            workflowByPath[focusedItem.path]?.last_activity_text || null,
        }
      : data.current_path
        ? {
            id: null,
            name:
              data.current_name ||
              data.current_path.split("/").filter(Boolean).pop() ||
              "Current Folder",
            path: data.current_path,
            type: "folder",
            size_bytes: null,
            modified_at: null,
            workflow_status:
              workflowByPath[data.current_path]?.workflow_status || "stored",
            client_visible:
              workflowByPath[data.current_path]?.client_visible || false,
            recent_activity:
              workflowByPath[data.current_path]?.last_activity_text || null,
          }
        : null;

  return (
    <section style={styles.shell}>
      <div style={styles.hero}>
        <div style={styles.heroTitleWrap}>
          <div style={styles.heroFolderIcon}>
            <Icon name="folder" size={28} />
          </div>

          <div style={styles.heroCopy}>
            <div style={styles.heroEyebrow}>
              <span>{data.root_name || "Client Documents"}</span>
              <span style={styles.activeClientPill}>Active Client</span>
            </div>
            <h2 style={styles.heroTitle}>Documents</h2>
            <p style={styles.heroSubtitle}>
              Store, organise and collaborate on client documents in one intelligent workspace.
            </p>
          </div>
        </div>

        <div style={styles.heroActions}>
          <div style={styles.connectionCard}>
            <span style={styles.statusDot} />
            <div>
              <strong style={styles.connectionTitle}>Connected to {provider}</strong>
              <span style={styles.connectionSub}>Live provider connection</span>
            </div>
          </div>

          <input
            ref={uploadInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />

          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={busyAction !== null}
            style={busyAction === null ? styles.primaryAction : styles.actionButtonDisabled}
          >
            <Icon name="upload" size={16} />
            {busyAction === "upload" ? "Uploading..." : "Upload"}
          </button>

          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice("");
              setNewFolderName("");
              setShowNewFolder(true);
            }}
            style={styles.secondaryAction}
          >
            <Icon name="folder" size={16} />
            New Folder
          </button>

          <div style={styles.portalToolbarMenuWrap}>
            <button
              type="button"
              onClick={() => setShowPortalMenu((current) => !current)}
              style={styles.secondaryAction}
            >
              <Icon name="users" size={16} />
              Client Portal
              <span style={styles.portalToolbarChevron}>
                {showPortalMenu ? "⌃" : "⌄"}
              </span>
            </button>

            {showPortalMenu ? (
              <div style={styles.portalToolbarMenu}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPortalMenu(false);
                    window.open(
                      `/client-portal-preview/${clientId}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  style={styles.portalToolbarMenuItem}
                >
                  Preview Portal
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPortalMenu(false);
                    window.location.href =
                      `/crm/client/${clientId}/portal-access`;
                  }}
                  style={styles.portalToolbarMenuItem}
                >
                  Manage Access
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={styles.summaryStrip}>
        <div style={styles.summaryMetric}>
          <span style={{ ...styles.summaryIcon, ...styles.summaryIconBlue }}>
            <Icon name="file" size={17} />
          </span>
          <div>
            <strong style={styles.summaryValue}>{fileCount}</strong>
            <span style={styles.summaryLabel}>Documents</span>
          </div>
        </div>

        <div style={styles.summaryMetric}>
          <span style={{ ...styles.summaryIcon, ...styles.summaryIconGold }}>
            <Icon name="folder" size={17} />
          </span>
          <div>
            <strong style={styles.summaryValue}>{folderCount}</strong>
            <span style={styles.summaryLabel}>Folders here</span>
          </div>
        </div>

        <div style={styles.summaryMetric}>
          <span style={{ ...styles.summaryIcon, ...styles.summaryIconGreen }}>
            <span style={styles.summaryGlyph}>✓</span>
          </span>
          <div>
            <strong style={styles.summaryValue}>{currentPreviewable.length}</strong>
            <span style={styles.summaryLabel}>Preview-ready</span>
          </div>
        </div>

        <div style={styles.summaryMetric}>
          <span style={{ ...styles.summaryIcon, ...styles.summaryIconBlue }}>
            <span style={styles.summaryGlyph}>◎</span>
          </span>
          <div>
            <strong style={styles.summaryValue}>{clientVisibleCount}</strong>
            <span style={styles.summaryLabel}>Client visible</span>
          </div>
        </div>

        <div style={styles.summaryMetric}>
          <span style={{ ...styles.summaryIcon, ...styles.summaryIconAmber }}>
            <span style={styles.summaryGlyph}>!</span>
          </span>
          <div>
            <strong style={styles.summaryValue}>{awaitingReviewCount + needsActionCount}</strong>
            <span style={styles.summaryLabel}>Workflow attention</span>
          </div>
        </div>

        <div style={styles.summaryProvider}>
          <span style={styles.statusDot} />
          <div>
            <strong style={styles.summaryProviderTitle}>Sync status</strong>
            <span style={styles.summaryProviderSub}>Up to date</span>
          </div>
        </div>
      </div>

      <div style={styles.workspaceGrid}>
        <aside style={styles.folderPane}>
          <div style={styles.folderPaneHeader}>
            <strong>Folders</strong>
            <button type="button" disabled style={styles.miniDisabledButton}>
              +
            </button>
          </div>

          <div style={styles.folderSearch}>
            <span style={styles.searchIcon}>
              <Icon name="search" size={15} />
            </span>
            <input
              aria-label="Search folders"
              placeholder="Search folders..."
              style={styles.folderSearchInput}
              readOnly
            />
          </div>

          <button
            type="button"
            onClick={() => void load(data.root_path || undefined)}
            style={{
              ...styles.rootFolderRow,
              ...(currentPath === data.root_path ? styles.folderRowActive : {}),
            }}
          >
            <span style={styles.chevron}>
              <Icon name="chevronDown" size={14} />
            </span>
            <span style={styles.largeFolderIcon}>
              <Icon name="folder" size={18} />
            </span>
            <span style={styles.folderName}>{data.root_name || "Client Documents"}</span>
            <span style={styles.treeCount}>{rootFolders.length}</span>
          </button>

          <div style={styles.folderTreeScroll}>
            {rootFolders.map((folder) => {
              const selectedFolder =
                currentPath === folder.path ||
                currentPath.startsWith(`${folder.path}/`);
              const expanded = expandedFolders.has(folder.path);
              const cachedCount = folderCachedCount(folder.path);

              return (
                <div key={itemKey(folder)}>
                  <button
                    type="button"
                    onMouseEnter={() => prefetchFolder(folder.path)}
                    onFocus={() => prefetchFolder(folder.path)}
                    onClick={() => {
                      toggleFolderExpansion(folder.path);
                      if (currentPath !== folder.path) void load(folder.path);
                    }}
                    style={{
                      ...styles.folderRow,
                      ...(selectedFolder ? styles.folderRowActive : {}),
                    }}
                  >
                    <span style={styles.folderIndent} />
                    <span style={styles.largeFolderIcon}>
                      <Icon name="folder" size={17} />
                    </span>
                    <span style={styles.folderName}>{folder.name}</span>
                    <span style={styles.treeCount}>
                      {cachedCount === null ? "" : cachedCount}
                    </span>
                    <span style={styles.chevronRight}>
                      <Icon
                        name={expanded ? "chevronDown" : "chevronRight"}
                        size={13}
                      />
                    </span>
                  </button>

                  {expanded ? renderNestedFolders(folder.path) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <main style={styles.filePane}>
          <div style={styles.filePaneTop}>
            <div style={styles.breadcrumbRow}>
              <div style={styles.breadcrumbs}>
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;

                  return (
                    <span key={crumb.path} style={styles.crumbWrap}>
                      {index > 0 ? (
                        <span style={styles.crumbChevron}>
                          <Icon name="chevronRight" size={11} />
                        </span>
                      ) : null}

                      {isLast ? (
                        <strong style={styles.crumbCurrent}>{crumb.label}</strong>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void load(crumb.path)}
                          style={styles.crumbButton}
                        >
                          {crumb.label}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>

              <div style={styles.filePaneMeta}>
                <span>{folderCount + fileCount} items</span>
                <span style={styles.metaDivider}>|</span>
                <span>Modified newest</span>
              </div>
            </div>

            <div style={styles.commandRow}>
              <div style={styles.searchBox}>
                <span style={styles.searchIcon}>
                  <Icon name="search" size={16} />
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search documents in this folder..."
                  style={styles.searchInput}
                />
              </div>

              <button
                type="button"
                onClick={() => void load(currentPath, { force: true })}
                style={styles.compactAction}
              >
                <Icon name="refresh" size={15} />
                Refresh
              </button>
            </div>
          </div>

          {error ? <div style={styles.inlineError}>{error}</div> : null}
          {notice ? <div style={styles.noticeBar}>{notice}</div> : null}

          <div style={styles.tableHeader}>
            <label style={styles.checkboxCell}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            </label>
            <span>Name</span>
            <span>Status</span>
            <span>Client Visible</span>
            <span>Modified</span>
            <span>Owner</span>
          </div>

          <div style={styles.rows}>
            {visibleItems.length ? (
              visibleItems.map((item) => {
                const key = itemKey(item);
                const isSelected = selected.has(key);
                const rowFocused = focusedItem?.path === item.path;

                return (
                  <div
                    key={key}
                    style={{
                      ...styles.row,
                      ...(isSelected || rowFocused ? styles.rowSelected : {}),
                    }}
                  >
                    <label style={styles.checkboxCell}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(item)}
                      />
                    </label>

                    <button
                      type="button"
                      onMouseEnter={() => {
                        if (item.type === "folder") prefetchFolder(item.path);
                      }}
                      onFocus={() => {
                        if (item.type === "folder") prefetchFolder(item.path);
                      }}
                      onClick={() => {
                        if (item.type === "folder") {
                          void load(item.path);
                        } else {
                          setFocusedItem(item);
                          setSelected(new Set([key]));
                          setRightTab("preview");
                          if (previewUrl) {
                            URL.revokeObjectURL(previewUrl);
                            setPreviewUrl("");
                          }
                        }
                      }}
                      style={styles.nameButton}
                    >
                      <span style={styles.nameCell}>
                        {item.type === "folder" ? (
                          <span style={styles.folderBadge}>
                            <Icon name="folder" size={19} />
                          </span>
                        ) : (
                          <FileTypeBadge name={item.name} />
                        )}

                        <span style={styles.nameTextWrap}>
                          <strong style={styles.itemName}>{item.name}</strong>
                          <span style={styles.itemMeta}>
                            {item.type === "folder"
                              ? "Folder"
                              : `${fileVisual(item.name).label} · ${formatBytes(item.size_bytes)}`}
                          </span>
                        </span>
                      </span>
                    </button>

                    <span style={styles.cell}>
                      {item.type === "folder" ? (
                        <span style={styles.mutedDash}>—</span>
                      ) : (
                        <span style={{ ...styles.statusPill, ...workflowTone(item) }}>
                          {workflowLabel(item)}
                        </span>
                      )}
                    </span>

                    <span style={styles.cell}>
                      {item.type === "folder" ? (
                        <span style={styles.mutedDash}>—</span>
                      ) : (
                        <span
                          style={
                            item.client_visible === true
                              ? styles.visibleState
                              : styles.internalState
                          }
                        >
                          <span style={styles.visibilityDot} />
                          {item.client_visible === true ? "Visible" : "Internal"}
                        </span>
                      )}
                    </span>

                    <span style={styles.cell}>
                      {formatDate(item.modified_at)}
                    </span>

                    <span style={styles.ownerCell}>
                      {item.type === "file" ? (
                        <span style={styles.ownerAvatar}>{ownerInitials(item)}</span>
                      ) : (
                        <span style={styles.mutedDash}>—</span>
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={styles.empty}>
                {search
                  ? "No files or folders match your search."
                  : "This folder is empty."}
              </div>
            )}
          </div>

          <div style={styles.footer}>
            <span>{visibleItems.length} items</span>
            <span>{selectedItems.length ? `${selectedItems.length} selected` : "Showing all items"}</span>
          </div>
        </main>

        <aside style={styles.intelligencePane}>
          <div style={styles.rightTabs}>
            {[
              ["preview", "Preview"],
              ["details", "Details"],
              ["activity", "Activity"],
              ["insights", "Insights"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setRightTab(
                    key as "preview" | "details" | "activity" | "insights"
                  )
                }
                style={{
                  ...styles.rightTabButton,
                  ...(rightTab === key ? styles.rightTabActive : {}),
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {focusedIsFile && focusedItem ? (
            <>
              <div style={styles.selectedDocumentHeader}>
                <FileTypeBadge name={focusedItem.name} />
                <div style={styles.selectedDocumentCopy}>
                  <strong style={styles.selectedDocumentName}>
                    {focusedItem.name}
                  </strong>
                  <span style={styles.selectedDocumentMeta}>
                    {fileVisual(focusedItem.name).label} · {formatBytes(focusedItem.size_bytes)} ·{" "}
                    {formatDate(focusedItem.modified_at)}
                  </span>
                </div>
              </div>

              <div style={styles.workflowControlBar}>
                <div style={styles.workflowStatusSummary}>
                  <div style={styles.workflowPills}>
                    <span
                      style={{
                        ...styles.statusPill,
                        ...workflowTone(focusedItem),
                      }}
                    >
                      {workflowLabel(focusedItem)}
                    </span>

                    <span
                      style={
                        focusedItem.client_visible === true
                          ? styles.workflowReleasePillVisible
                          : styles.workflowReleasePill
                      }
                    >
                      {focusedItem.client_visible === true
                        ? "● Client Visible"
                        : "Internal"}
                    </span>
                  </div>

                  {workflowByPath[focusedItem.path]?.review_assigned_user_id ? (
                    <div style={styles.workflowReviewerLine}>
                      <span style={styles.workflowReviewerIcon}>○</span>
                      <span>
                        Reviewer:{" "}
                        <strong>
                          {reviewerName(
                            workflowByPath[focusedItem.path]
                              ?.review_assigned_user_id
                          )}
                        </strong>
                      </span>
                    </div>
                  ) : null}
                </div>

                <div style={styles.portalCard}>
                  <div style={styles.portalCardHeading}>
                    <span style={styles.portalCardIcon}>▣</span>
                    <strong>Client Portal</strong>
                  </div>

                  <select
                    value={
                      workflowByPath[focusedItem.path]?.portal_category ||
                      "general"
                    }
                    onChange={(event) =>
                      void updatePortalCategory(
                        focusedItem,
                        event.target.value as PortalCategory
                      )
                    }
                    disabled={workflowBusyPath === focusedItem.path}
                    style={styles.portalCategorySelect}
                  >
                    {PORTAL_CATEGORY_OPTIONS.map((category) => (
                      <option
                        key={category.value}
                        value={category.value}
                      >
                        {category.label}
                      </option>
                    ))}
                  </select>

                  <span style={styles.portalCategoryHint}>
                    {focusedItem.client_visible === true
                      ? "Visible in this section"
                      : "Section used when released"}
                  </span>
                </div>

                <div style={styles.actionCard}>
                  <div style={styles.actionCardHeading}>Actions</div>

                  <div style={styles.actionPrimaryRow}>
                    {workflowLabel(focusedItem) === "Stored" ||
                    workflowLabel(focusedItem) === "Rejected" ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === focusedItem.path}
                        onClick={() => openReviewRequest(focusedItem)}
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === focusedItem.path
                          ? "Updating..."
                          : "Request Review"}
                      </button>
                    ) : null}

                    {workflowLabel(focusedItem) === "Awaiting Review" ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === focusedItem.path}
                        onClick={() =>
                          void updateWorkflowStatus(
                            focusedItem,
                            "reviewed"
                          )
                        }
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === focusedItem.path
                          ? "Updating..."
                          : "Mark Reviewed"}
                      </button>
                    ) : null}

                    {workflowLabel(focusedItem) === "Reviewed" ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === focusedItem.path}
                        onClick={() =>
                          void updateWorkflowStatus(
                            focusedItem,
                            "approved"
                          )
                        }
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === focusedItem.path
                          ? "Updating..."
                          : "Approve"}
                      </button>
                    ) : null}

                    {workflowLabel(focusedItem) === "Approved" &&
                    focusedItem.client_visible !== true ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === focusedItem.path}
                        onClick={() =>
                          void updateClientRelease(focusedItem, true)
                        }
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === focusedItem.path
                          ? "Releasing..."
                          : "Release to Client"}
                      </button>
                    ) : null}

                    {workflowLabel(focusedItem) === "Approved" &&
                    focusedItem.client_visible === true ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === focusedItem.path}
                        onClick={() =>
                          void updateClientRelease(focusedItem, false)
                        }
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === focusedItem.path
                          ? "Updating..."
                          : "Remove Client Access"}
                      </button>
                    ) : null}

                    <div style={styles.documentActionsWrap}>
                      <button
                        type="button"
                        onClick={() =>
                          setShowDocumentActions((current) => !current)
                        }
                        style={styles.documentActionsButton}
                      >
                        Actions
                        <span style={styles.documentActionsChevron}>
                          {showDocumentActions ? "⌃" : "⌄"}
                        </span>
                      </button>

                      {showDocumentActions ? (
                        <div style={styles.documentActionsMenu}>
                          {workflowLabel(focusedItem) === "Awaiting Review" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowDocumentActions(false);
                                void updateWorkflowStatus(
                                  focusedItem,
                                  "rejected"
                                );
                              }}
                              style={styles.documentActionMenuDanger}
                            >
                              Reject Review
                            </button>
                          ) : null}

                          {workflowLabel(focusedItem) === "Reviewed" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowDocumentActions(false);
                                openReviewRequest(focusedItem);
                              }}
                              style={styles.documentActionMenuItem}
                            >
                              Return to Review
                            </button>
                          ) : null}

                          {workflowLabel(focusedItem) === "Approved" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowDocumentActions(false);
                                openReviewRequest(focusedItem);
                              }}
                              style={styles.documentActionMenuItem}
                            >
                              Re-open Review
                            </button>
                          ) : null}

                          {workflowLabel(focusedItem) === "Rejected" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowDocumentActions(false);
                                openReviewRequest(focusedItem);
                              }}
                              style={styles.documentActionMenuItem}
                            >
                              Request Review Again
                            </button>
                          ) : null}

                          {!workflowByPath[focusedItem.path]
                            ?.review_assigned_user_id &&
                          workflowLabel(focusedItem) === "Awaiting Review" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowDocumentActions(false);
                                openReviewRequest(focusedItem);
                              }}
                              style={styles.documentActionMenuItem}
                            >
                              Assign Reviewer
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {rightTab === "preview" ? (
                <div style={styles.previewSection}>
                  <div style={styles.previewSectionHeading}>
                    Document Preview
                  </div>
                  {focusedCanPreview ? (
                    previewUrl ? (
                      fileExtension(focusedItem.name) === "pdf" ? (
                        <iframe
                          title={`Preview ${focusedItem.name}`}
                          src={previewUrl}
                          style={styles.previewFrame}
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt={focusedItem.name}
                          style={styles.previewImage}
                        />
                      )
                    ) : (
                      <div style={styles.previewPlaceholder}>
                        <div style={styles.previewHeroBadge}>
                          <FileTypeBadge name={focusedItem.name} />
                        </div>
                        <strong>Inline preview ready</strong>
                        <span>
                          Load the file only when you need it, keeping folder browsing fast.
                        </span>
                        <button
                          type="button"
                          onClick={() => void loadInlinePreview(focusedItem)}
                          disabled={previewLoading}
                          style={styles.previewPrimaryButton}
                        >
                          {previewLoading ? "Loading preview..." : "Open Preview"}
                        </button>
                      </div>
                    )
                  ) : (
                    <div style={styles.previewPlaceholder}>
                      <div style={styles.previewHeroBadge}>
                        <FileTypeBadge name={focusedItem.name} />
                      </div>
                      <strong>Preview in the native application</strong>
                      <span>
                        This file type is best opened after download.
                      </span>
                    </div>
                  )}

                  <div style={styles.quickActions}>
                    {focusedCanPreview ? (
                      <button
                        type="button"
                        onClick={() => void previewFile(focusedItem)}
                        disabled={busyAction !== null}
                        style={styles.secondaryRightAction}
                      >
                        Open in new tab
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void downloadFile(focusedItem)}
                      disabled={busyAction !== null}
                      style={styles.primaryRightAction}
                    >
                      Download
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `/crm/client/${clientId}/print`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      style={styles.signOffAction}
                    >
                      PDF / Sign-off
                    </button>
                  </div>
                </div>
              ) : null}

              {rightTab === "details" ? (
                <div style={styles.rightPanelBody}>
                  <h3 style={styles.panelHeading}>Document Details</h3>

                  <div style={styles.detailList}>
                    <div style={styles.detailRow}>
                      <span>Document type</span>
                      <strong>{fileVisual(focusedItem.name).label}</strong>
                    </div>
                    <div style={styles.detailRow}>
                      <span>Size</span>
                      <strong>{formatBytes(focusedItem.size_bytes)}</strong>
                    </div>
                    <div style={styles.detailRow}>
                      <span>Modified</span>
                      <strong>{formatDate(focusedItem.modified_at)}</strong>
                    </div>
                    <div style={styles.detailRow}>
                      <span>Provider</span>
                      <strong>{provider}</strong>
                    </div>
                    <div style={styles.detailRow}>
                      <span>Workflow status</span>
                      <strong>{workflowLabel(focusedItem)}</strong>
                    </div>
                    <div style={styles.detailRow}>
                      <span>Reviewer</span>
                      <strong>
                        {reviewerName(
                          workflowByPath[focusedItem.path]
                            ?.review_assigned_user_id
                        ) || "—"}
                      </strong>
                    </div>
                    <div style={styles.detailRow}>
                      <span>Client Portal category</span>
                      <strong>
                        {portalCategoryLabel(
                          workflowByPath[focusedItem.path]?.portal_category
                        )}
                      </strong>
                    </div>
                    <div style={styles.detailRow}>
                      <span>Client release</span>
                      <strong>
                        {focusedItem.client_visible === true
                          ? "Client Visible"
                          : "Internal"}
                      </strong>
                    </div>
                    <div style={styles.detailRow}>
                      <span>Released</span>
                      <strong>
                        {workflowByPath[focusedItem.path]?.released_at
                          ? formatDate(
                              workflowByPath[focusedItem.path].released_at ||
                                null
                            )
                          : "—"}
                      </strong>
                    </div>
                  </div>

                  <div style={styles.pathBox}>
                    <span>Provider path</span>
                    <code>{focusedItem.path}</code>
                  </div>
                </div>
              ) : null}

              {rightTab === "activity" ? (
                <div style={styles.rightPanelBody}>
                  <h3 style={styles.panelHeading}>Activity</h3>
                  <div style={styles.activityEmpty}>
                    <span style={styles.activityDot} />
                    <div>
                      <strong>
                        {focusedItem.recent_activity ||
                          "Document available in the provider"}
                      </strong>
                      <span>
                        PracticePilot workflow activity is recorded here as
                        review and approval steps are completed.
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {rightTab === "insights" ? (
                <div style={styles.rightPanelBody}>
                  <h3 style={styles.panelHeading}>Document Intelligence</h3>

                  <div style={styles.insightGrid}>
                    <div style={styles.insightCard}>
                      <strong>{fileCount}</strong>
                      <span>Documents</span>
                    </div>
                    <div style={styles.insightCard}>
                      <strong>{awaitingReviewCount}</strong>
                      <span>Needs review</span>
                    </div>
                    <div style={styles.insightCard}>
                      <strong>{clientVisibleCount}</strong>
                      <span>Client visible</span>
                    </div>
                    <div style={styles.insightCard}>
                      <strong>{needsActionCount}</strong>
                      <span>Needs action</span>
                    </div>
                  </div>

                  <div style={styles.insightCompactSection}>
                    <div style={styles.sectionTitleRow}>
                      <strong>Workflow Queue</strong>
                      <span>{workflowQueue.length}</span>
                    </div>

                    {workflowQueue.length ? (
                      <div style={styles.miniList}>
                        {workflowQueue.map((item) => (
                          <button
                            type="button"
                            key={itemKey(item)}
                            onClick={() => {
                              setFocusedItem(item);
                              setRightTab("details");
                            }}
                            style={styles.miniListRow}
                          >
                            <span style={styles.queueDot} />
                            <span style={styles.miniListRowText}>
                              <strong style={styles.miniListRowName}>
                                {item.name}
                              </strong>
                              <small style={styles.miniListRowMeta}>
                                {workflowLabel(item)}
                              </small>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={styles.emptyMini}>
                        No documents currently need workflow attention.
                      </div>
                    )}
                  </div>

                  <div style={styles.insightCompactSection}>
                    <div style={styles.sectionTitleRow}>
                      <strong>Recent Uploads</strong>
                      <span>{recentFiles.length}</span>
                    </div>

                    {recentFiles.length ? (
                      <div style={styles.miniList}>
                        {recentFiles.map((item) => (
                          <button
                            type="button"
                            key={itemKey(item)}
                            onClick={() => {
                              setFocusedItem(item);
                              setRightTab("preview");
                            }}
                            style={styles.miniListRow}
                          >
                            <FileTypeBadge name={item.name} />
                            <span style={styles.miniListRowText}>
                              <strong style={styles.miniListRowName}>
                                {item.name}
                              </strong>
                              <small style={styles.miniListRowMeta}>
                                {formatShortDate(item.modified_at)}
                              </small>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={styles.emptyMini}>
                        No recent files in this folder.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div style={styles.folderOverviewPanel}>
              <div style={styles.folderOverviewHeader}>
                <span style={styles.folderOverviewIcon}>
                  <Icon name="folder" size={20} />
                </span>
                <div style={styles.folderOverviewCopy}>
                  <strong style={styles.folderOverviewTitle}>
                    {currentFolderItem?.name || data.current_name || "Current Folder"}
                  </strong>
                  <span style={styles.folderOverviewMeta}>
                    {folderCount} folder{folderCount === 1 ? "" : "s"} · {fileCount} document{fileCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div style={styles.folderOverviewStats}>
                <div style={styles.folderOverviewStat}>
                  <strong>{folderCount}</strong>
                  <span>Subfolders</span>
                </div>
                <div style={styles.folderOverviewStat}>
                  <strong>{fileCount}</strong>
                  <span>Documents</span>
                </div>
                <div style={styles.folderOverviewStat}>
                  <strong>{currentPreviewable.length}</strong>
                  <span>Preview-ready</span>
                </div>
              </div>

              {currentFolderItem ? (
                <>
                  <div style={styles.workflowStatusSummary}>
                    <div style={styles.workflowPills}>
                      <span
                        style={{
                          ...styles.statusPill,
                          ...workflowTone(currentFolderItem),
                        }}
                      >
                        {workflowLabel(currentFolderItem)}
                      </span>

                      <span
                        style={
                          currentFolderItem.client_visible === true
                            ? styles.workflowReleasePillVisible
                            : styles.workflowReleasePill
                        }
                      >
                        {currentFolderItem.client_visible === true
                          ? "● Client Visible"
                          : "Internal"}
                      </span>
                    </div>

                    {workflowByPath[currentFolderItem.path]?.review_assigned_user_id ? (
                      <div style={styles.workflowReviewerLine}>
                        <span style={styles.workflowReviewerIcon}>○</span>
                        <span>
                          Reviewer:{" "}
                          <strong>
                            {reviewerName(
                              workflowByPath[currentFolderItem.path]
                                ?.review_assigned_user_id
                            )}
                          </strong>
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div style={styles.portalCard}>
                    <div style={styles.portalCardHeading}>
                      <span style={styles.portalCardIcon}>▣</span>
                      <strong>Client Portal Folder Pack</strong>
                    </div>

                    <select
                      value={
                        workflowByPath[currentFolderItem.path]?.portal_category ||
                        "general"
                      }
                      onChange={(event) =>
                        void updatePortalCategory(
                          currentFolderItem,
                          event.target.value as PortalCategory
                        )
                      }
                      disabled={workflowBusyPath === currentFolderItem.path}
                      style={styles.portalCategorySelect}
                    >
                      {PORTAL_CATEGORY_OPTIONS.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>

                    <span style={styles.portalCategoryHint}>
                      The folder pack follows the same review and approval workflow as an individual document.
                    </span>
                  </div>

                  <div style={styles.actionCard}>
                    <div style={styles.actionCardHeading}>Folder Pack Workflow</div>

                    {workflowLabel(currentFolderItem) === "Stored" ||
                    workflowLabel(currentFolderItem) === "Rejected" ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === currentFolderItem.path}
                        onClick={() => openReviewRequest(currentFolderItem)}
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === currentFolderItem.path
                          ? "Updating..."
                          : "Request Review"}
                      </button>
                    ) : null}

                    {workflowLabel(currentFolderItem) === "Awaiting Review" ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === currentFolderItem.path}
                        onClick={() =>
                          void updateWorkflowStatus(
                            currentFolderItem,
                            "reviewed"
                          )
                        }
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === currentFolderItem.path
                          ? "Updating..."
                          : "Mark Reviewed"}
                      </button>
                    ) : null}

                    {workflowLabel(currentFolderItem) === "Reviewed" ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === currentFolderItem.path}
                        onClick={() =>
                          void updateWorkflowStatus(
                            currentFolderItem,
                            "approved"
                          )
                        }
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === currentFolderItem.path
                          ? "Updating..."
                          : "Approve Folder Pack"}
                      </button>
                    ) : null}

                    {workflowLabel(currentFolderItem) === "Approved" &&
                    currentFolderItem.client_visible !== true ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === currentFolderItem.path}
                        onClick={() =>
                          void releaseFolderPack(
                            currentFolderItem,
                            workflowByPath[currentFolderItem.path]
                              ?.portal_category || "general",
                            true
                          )
                        }
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === currentFolderItem.path
                          ? "Releasing..."
                          : "Release Folder to Client"}
                      </button>
                    ) : null}

                    {workflowLabel(currentFolderItem) === "Approved" &&
                    currentFolderItem.client_visible === true ? (
                      <button
                        type="button"
                        disabled={workflowBusyPath === currentFolderItem.path}
                        onClick={() =>
                          void releaseFolderPack(
                            currentFolderItem,
                            workflowByPath[currentFolderItem.path]
                              ?.portal_category || "general",
                            false
                          )
                        }
                        style={styles.workflowPrimaryAction}
                      >
                        {workflowBusyPath === currentFolderItem.path
                          ? "Updating..."
                          : "Remove Folder from Client"}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}

              <div style={styles.folderOverviewHint}>
                <strong>Select a document to open the command centre.</strong>
                <span>
                  Preview, details, activity and insights will appear here without leaving the working file.
                </span>
              </div>
            </div>
          )}

          {!focusedIsFile ? (
            <>
              <div style={styles.insightDivider} />

              <div style={styles.insightSection}>
                <div style={styles.sectionTitleRow}>
                  <strong>Insights Snapshot</strong>
                  <span>Current folder</span>
                </div>

                <div style={styles.insightGrid}>
                  <div style={styles.insightCard}>
                    <strong>{fileCount}</strong>
                    <span>Total Documents</span>
                  </div>
                  <div style={styles.insightCard}>
                    <strong>{awaitingReviewCount}</strong>
                    <span>Needs Review</span>
                  </div>
                  <div style={styles.insightCard}>
                    <strong>{clientVisibleCount}</strong>
                    <span>Client Visible</span>
                  </div>
                  <div style={styles.insightCard}>
                    <strong>{currentPreviewable.length}</strong>
                    <span>Preview-ready</span>
                  </div>
                </div>
              </div>

              <div style={styles.rightBottomGrid}>
                <div style={styles.insightSection}>
                  <div style={styles.sectionTitleRow}>
                    <strong>Workflow Queue</strong>
                    <span>{workflowQueue.length}</span>
                  </div>

                  {workflowQueue.length ? (
                    <div style={styles.miniList}>
                      {workflowQueue.map((item) => (
                        <button
                          type="button"
                          key={itemKey(item)}
                          onClick={() => {
                            setFocusedItem(item);
                            setRightTab("details");
                          }}
                          style={styles.miniListRow}
                        >
                          <span style={styles.queueDot} />
                          <span style={styles.miniListRowText}>
                            <strong style={styles.miniListRowName}>
                              {item.name}
                            </strong>
                            <small style={styles.miniListRowMeta}>
                              {workflowLabel(item)}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.emptyMini}>
                      No documents currently need workflow attention.
                    </div>
                  )}
                </div>

                <div style={styles.insightSection}>
                  <div style={styles.sectionTitleRow}>
                    <strong>Recent Uploads</strong>
                    <span>{recentFiles.length}</span>
                  </div>

                  {recentFiles.length ? (
                    <div style={styles.miniList}>
                      {recentFiles.map((item) => (
                        <button
                          type="button"
                          key={itemKey(item)}
                          onClick={() => {
                            setFocusedItem(item);
                            setRightTab("preview");
                          }}
                          style={styles.miniListRow}
                        >
                          <FileTypeBadge name={item.name} />
                          <span style={styles.miniListRowText}>
                            <strong style={styles.miniListRowName}>
                              {item.name}
                            </strong>
                            <small style={styles.miniListRowMeta}>
                              {formatShortDate(item.modified_at)}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.emptyMini}>
                      No recent files in this folder.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </div>

      {showReviewRequest && reviewRequestItem ? (
        <div
          style={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !workflowBusyPath
            ) {
              setShowReviewRequest(false);
              setReviewRequestItem(null);
            }
          }}
        >
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleWrap}>
                <span style={styles.reviewModalIcon}>✓</span>
                <div>
                  <strong style={styles.modalTitle}>{reviewRequestItem.type === "folder" ? "Request Folder Pack Review" : "Request Review"}</strong>
                  <span style={styles.modalSubtitle}>
                    {reviewRequestItem.name}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!workflowBusyPath) {
                    setShowReviewRequest(false);
                    setReviewRequestItem(null);
                  }
                }}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <label style={styles.modalLabel}>
                Reviewer
                <select
                  autoFocus
                  value={selectedReviewerId}
                  onChange={(event) =>
                    setSelectedReviewerId(event.target.value)
                  }
                  style={styles.modalInput}
                  disabled={Boolean(workflowBusyPath)}
                >
                  <option value="">Select reviewer...</option>
                  {reviewers.map((reviewer) => (
                    <option
                      key={reviewer.user_id}
                      value={reviewer.user_id}
                    >
                      {reviewer.full_name ||
                        reviewer.email ||
                        "Team member"}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.modalLabel}>
                Review due date
                <input
                  type="date"
                  value={reviewDueDate}
                  onChange={(event) =>
                    setReviewDueDate(event.target.value)
                  }
                  style={styles.modalInput}
                  disabled={Boolean(workflowBusyPath)}
                />
              </label>

              <div style={styles.reviewInfoBox}>
                PracticePilot will create a Document Review item in the
                reviewer&apos;s My Work and My Day. Opening that item takes
                them straight back to this document.
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => {
                  setShowReviewRequest(false);
                  setReviewRequestItem(null);
                }}
                disabled={Boolean(workflowBusyPath)}
                style={styles.modalCancel}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void submitReviewRequest()}
                disabled={
                  Boolean(workflowBusyPath) || !selectedReviewerId
                }
                style={
                  workflowBusyPath || !selectedReviewerId
                    ? styles.modalCreateDisabled
                    : styles.modalCreate
                }
              >
                {workflowBusyPath
                  ? "Assigning..."
                  : "Assign Review"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showNewFolder ? (
        <div
          style={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingFolder) {
              setShowNewFolder(false);
              setNewFolderName("");
            }
          }}
        >
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleWrap}>
                <span style={styles.modalFolderIcon}>
                  <Icon name="folder" size={20} />
                </span>
                <div>
                  <strong style={styles.modalTitle}>New Folder</strong>
                  <span style={styles.modalSubtitle}>
                    Create a folder inside {data.current_name || "the current folder"}.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!creatingFolder) {
                    setShowNewFolder(false);
                    setNewFolderName("");
                  }
                }}
                style={styles.modalClose}
                aria-label="Close new folder dialog"
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <label style={styles.modalLabel}>
                Folder name
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !creatingFolder) {
                      event.preventDefault();
                      void createNewFolder();
                    }
                  }}
                  placeholder="e.g. 2027"
                  style={styles.modalInput}
                  disabled={creatingFolder}
                />
              </label>

              <div style={styles.modalPath}>
                <span>Location</span>
                <strong>{currentPath}</strong>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName("");
                }}
                disabled={creatingFolder}
                style={styles.modalCancel}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void createNewFolder()}
                disabled={creatingFolder || !newFolderName.trim()}
                style={
                  creatingFolder || !newFolderName.trim()
                    ? styles.modalCreateDisabled
                    : styles.modalCreate
                }
              >
                {creatingFolder ? "Creating..." : "Create Folder"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    boxSizing: "border-box",
    background: "#ffffff",
    border: "1px solid #cfd8e3",
    boxShadow: "0 10px 28px rgba(16,35,58,0.05)",
  },
  stateBox: {
    padding: 16,
    background: "#ffffff",
    border: "1px solid #cfd8e3",
    color: "#64748b",
    fontSize: 11,
  },
  errorBox: {
    background: "#fff1f2",
    color: "#b42318",
  },
  warningBox: {
    display: "grid",
    gap: 4,
    borderLeft: "4px solid #d97706",
    background: "#fffaf0",
  },
  hero: {
    minHeight: 92,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    borderBottom: "1px solid #dbe3eb",
    background: "#ffffff",
  },
  heroTitleWrap: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  heroFolderIcon: {
    width: 48,
    height: 42,
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    background: "#f0b400",
    borderRadius: 5,
    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
  },
  heroCopy: {
    minWidth: 0,
  },
  heroEyebrow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#10233a",
    fontSize: 10,
    fontWeight: 850,
  },
  activeClientPill: {
    padding: "3px 7px",
    background: "#e7f8ee",
    border: "1px solid #c6ecd5",
    color: "#16834f",
    borderRadius: 999,
    fontSize: 8.5,
    fontWeight: 900,
  },
  heroTitle: {
    margin: "4px 0 0",
    color: "#10233a",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  heroSubtitle: {
    margin: "6px 0 0",
    color: "#5e6d7c",
    fontSize: 10.5,
  },
  heroActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  connectionCard: {
    minHeight: 34,
    padding: "0 9px",
    display: "flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid #d6e2ef",
    background: "#fbfdff",
  },
  connectionTitle: {
    display: "block",
    color: "#10233a",
    fontSize: 8.6,
    fontWeight: 950,
  },
  connectionSub: {
    display: "block",
    marginTop: 1,
    color: "#728091",
    fontSize: 7.2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#2fbd73",
    boxShadow: "0 0 0 3px rgba(47,189,115,0.10)",
    flex: "0 0 auto",
  },
  primaryAction: {
    height: 38,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border: "1px solid #135dc2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryAction: {
    height: 38,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  portalToolbarMenuWrap: {
    position: "relative",
    flex: "0 0 auto",
  },
  portalToolbarChevron: {
    marginLeft: 6,
    minWidth: 16,
    height: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderLeft: "1px solid #d7dee7",
    paddingLeft: 7,
    fontSize: 15,
    lineHeight: 1,
    color: "#10233a",
    fontWeight: 950,
  },
  portalToolbarMenu: {
    position: "absolute",
    top: 38,
    right: 0,
    zIndex: 60,
    minWidth: 150,
    padding: 4,
    display: "grid",
    gap: 2,
    border: "1px solid #d3dce6",
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15,35,58,0.14)",
  },
  portalToolbarMenuItem: {
    minHeight: 32,
    padding: "0 10px",
    border: "none",
    background: "#ffffff",
    color: "#10233a",
    textAlign: "left",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  actionButtonDisabled: {
    height: 38,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border: "1px solid #d7dee7",
    background: "#ffffff",
    color: "#8a96a3",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "not-allowed",
    opacity: 0.75,
  },
  summaryStrip: {
    minHeight: 52,
    padding: "0 12px",
    display: "grid",
    gridTemplateColumns: "repeat(5,minmax(92px,1fr)) minmax(140px,0.95fr)",
    alignItems: "center",
    background: "#fbfcfe",
    borderBottom: "1px solid #dbe3eb",
  },
  summaryMetric: {
    minWidth: 0,
    minHeight: 34,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    borderRight: "1px solid #e3e8ee",
  },
  summaryIcon: {
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  summaryIconBlue: {
    background: "#eaf2ff",
    color: "#1768d2",
  },
  summaryIconGold: {
    background: "#fff4d9",
    color: "#b77a00",
  },
  summaryIconGreen: {
    background: "#e8f8ef",
    color: "#159258",
  },
  summaryIconAmber: {
    background: "#fff4e1",
    color: "#c2770c",
  },
  summaryGlyph: {
    fontSize: 14,
    fontWeight: 950,
  },
  summaryValue: {
    display: "block",
    color: "#10233a",
    fontSize: 13,
    lineHeight: 1,
    fontWeight: 950,
  },
  summaryLabel: {
    display: "block",
    marginTop: 3,
    color: "#6b7786",
    fontSize: 8.3,
    fontWeight: 750,
    whiteSpace: "nowrap",
  },
  summaryProvider: {
    minHeight: 38,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 9,
  },
  summaryProviderTitle: {
    display: "block",
    color: "#10233a",
    fontSize: 8.8,
    fontWeight: 900,
  },
  summaryProviderSub: {
    display: "block",
    marginTop: 2,
    color: "#16834f",
    fontSize: 8.2,
    fontWeight: 900,
  },
  workspaceGrid: {
    minHeight: 590,
    display: "grid",
    gridTemplateColumns: "minmax(225px,260px) minmax(0,1fr) minmax(245px,275px)",
    alignItems: "stretch",
  },
  folderPane: {
    minWidth: 0,
    background: "#fbfcfd",
    borderRight: "1px solid #dbe3eb",
  },
  folderPaneHeader: {
    minHeight: 44,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#ffffff",
    borderBottom: "1px solid #dbe3eb",
    color: "#10233a",
    fontSize: 12,
    fontWeight: 950,
  },
  miniDisabledButton: {
    width: 30,
    height: 30,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#708090",
    fontSize: 18,
    lineHeight: 1,
    cursor: "not-allowed",
  },
  folderSearch: {
    height: 34,
    margin: "7px 9px",
    display: "flex",
    alignItems: "center",
    border: "1px solid #d5dde7",
    background: "#ffffff",
  },
  searchIcon: {
    width: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#577084",
    flex: "0 0 auto",
  },
  folderSearchInput: {
    minWidth: 0,
    flex: 1,
    height: "100%",
    padding: "0 8px 0 0",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#7b8793",
    fontSize: 9.5,
  },
  rootFolderRow: {
    width: "100%",
    minHeight: 44,
    padding: "0 10px",
    display: "grid",
    gridTemplateColumns: "16px 22px minmax(0,1fr) 28px",
    gap: 5,
    alignItems: "center",
    border: "none",
    borderTop: "1px solid #edf1f5",
    borderBottom: "1px solid #e8edf2",
    background: "#ffffff",
    color: "#10233a",
    textAlign: "left",
    cursor: "pointer",
  },
  folderTreeScroll: {
    maxHeight: 570,
    overflowY: "auto",
    overflowX: "hidden",
  },
  folderRow: {
    width: "100%",
    minHeight: 42,
    padding: "0 10px",
    display: "grid",
    gridTemplateColumns: "14px 22px minmax(0,1fr) 26px 16px",
    gap: 5,
    alignItems: "center",
    border: "none",
    borderBottom: "1px solid #edf1f5",
    background: "#fbfcfd",
    color: "#41566a",
    textAlign: "left",
    cursor: "pointer",
  },
  folderRowActive: {
    background: "#eaf2ff",
    color: "#10233a",
    fontWeight: 900,
  },
  folderIndent: {
    width: 14,
  },
  chevron: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#60758a",
  },
  chevronRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#718398",
  },
  largeFolderIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#e1a818",
  },
  folderName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 9.7,
  },
  treeCount: {
    minWidth: 0,
    color: "#56718a",
    fontSize: 8.5,
    textAlign: "right",
    fontWeight: 800,
  },
  nestedFolderRow: {
    width: "100%",
    minHeight: 36,
    paddingRight: 10,
    display: "grid",
    gridTemplateColumns: "10px 20px minmax(0,1fr) 16px",
    gap: 5,
    alignItems: "center",
    border: "none",
    borderBottom: "1px solid #edf1f5",
    background: "#f7f9fc",
    color: "#475b6d",
    textAlign: "left",
    cursor: "pointer",
  },
  nestedFolderRowActive: {
    background: "#e7f0ff",
    color: "#10233a",
    fontWeight: 900,
  },
  nestedTreeGuide: {
    width: 8,
    height: 20,
    borderLeft: "1px solid #cbd5e1",
    borderBottom: "1px solid #cbd5e1",
    transform: "translateY(-5px)",
  },
  smallFolderIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#d9a217",
  },
  nestedFolderName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 9,
  },
  filePane: {
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
    background: "#ffffff",
    boxSizing: "border-box",
    borderRight: "1px solid #dbe3eb",
  },
  filePaneTop: {
    background: "#ffffff",
    borderBottom: "1px solid #dbe3eb",
  },
  breadcrumbRow: {
    minHeight: 40,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  breadcrumbs: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 4,
    overflow: "hidden",
  },
  crumbWrap: {
    minWidth: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  crumbChevron: {
    display: "flex",
    color: "#94a3b8",
  },
  crumbButton: {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#1768d2",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  crumbCurrent: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#10233a",
    fontSize: 9.2,
    fontWeight: 950,
  },
  filePaneMeta: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#67788a",
    fontSize: 8.2,
    whiteSpace: "nowrap",
  },
  metaDivider: {
    color: "#c1c9d2",
  },
  commandRow: {
    minHeight: 44,
    padding: "6px 9px",
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "#fbfcfe",
    borderTop: "1px solid #eef2f6",
  },
  searchBox: {
    minWidth: 0,
    flex: 1,
    height: 32,
    display: "flex",
    alignItems: "center",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    height: "100%",
    padding: "0 9px 0 0",
    border: "none",
    outline: "none",
    color: "#10233a",
    fontSize: 9.5,
  },
  compactAction: {
    height: 32,
    padding: "0 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 8.8,
    fontWeight: 900,
    cursor: "pointer",
  },
  inlineError: {
    padding: "8px 12px",
    background: "#fff1f2",
    color: "#b42318",
    borderBottom: "1px solid #fecaca",
    fontSize: 8.5,
    fontWeight: 850,
  },
  noticeBar: {
    padding: "8px 12px",
    background: "#ecfdf3",
    color: "#166534",
    borderBottom: "1px solid #bbf7d0",
    fontSize: 8.8,
    fontWeight: 850,
  },
  tableHeader: {
    minHeight: 34,
    padding: "0 10px",
    display: "grid",
    gridTemplateColumns: "30px minmax(180px,1.7fr) minmax(86px,0.7fr) minmax(88px,0.75fr) minmax(118px,0.95fr) 52px",
    gap: 7,
    alignItems: "center",
    background: "#f3f6f9",
    borderBottom: "1px solid #dbe3eb",
    color: "#526577",
    fontSize: 8.1,
    fontWeight: 950,
  },
  rows: {
    minHeight: 410,
  },
  row: {
    minHeight: 48,
    padding: "0 10px",
    display: "grid",
    gridTemplateColumns: "30px minmax(180px,1.7fr) minmax(86px,0.7fr) minmax(88px,0.75fr) minmax(118px,0.95fr) 52px",
    gap: 7,
    alignItems: "center",
    borderBottom: "1px solid #e7edf3",
    background: "#ffffff",
  },
  rowSelected: {
    background: "#eef5ff",
  },
  checkboxCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  nameButton: {
    minWidth: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    textAlign: "left",
    color: "#10233a",
    cursor: "pointer",
  },
  nameCell: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 9,
  },
  nameTextWrap: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  folderBadge: {
    width: 32,
    height: 28,
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    background: "#f0b400",
    borderRadius: 4,
    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
  },
  documentBadge: {
    width: 30,
    height: 32,
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    fontSize: 7.4,
    fontWeight: 950,
    letterSpacing: "0.02em",
    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.06)",
  },
  itemName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#10233a",
    fontSize: 9.1,
    fontWeight: 900,
  },
  itemMeta: {
    color: "#718092",
    fontSize: 7.9,
    fontWeight: 650,
  },
  cell: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#526577",
    fontSize: 8.1,
  },
  mutedDash: {
    color: "#9aa6b2",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "100%",
    padding: "4px 7px",
    borderRadius: 999,
    fontSize: 7.7,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  statusGreen: {
    background: "#e7f8ee",
    color: "#16834f",
  },
  statusBlue: {
    background: "#e7f1ff",
    color: "#1768d2",
  },
  statusRed: {
    background: "#ffe9e9",
    color: "#c93636",
  },
  statusAmber: {
    background: "#fff2d7",
    color: "#aa6a00",
  },
  statusNeutral: {
    background: "#eef2f6",
    color: "#5f6d7c",
  },
  visibleState: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "#188553",
    fontSize: 8,
    fontWeight: 850,
  },
  internalState: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "#69788a",
    fontSize: 8,
    fontWeight: 850,
  },
  visibilityDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "currentColor",
    flex: "0 0 auto",
  },
  ownerCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  ownerAvatar: {
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "#e8eef5",
    color: "#294660",
    fontSize: 7.8,
    fontWeight: 950,
  },
  empty: {
    padding: 28,
    color: "#64748b",
    textAlign: "center",
    fontSize: 9,
  },
  footer: {
    minHeight: 36,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid #dbe3eb",
    background: "#fbfcfd",
    color: "#64748b",
    fontSize: 8.2,
  },
  intelligencePane: {
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
    background: "#ffffff",
    borderLeft: "1px solid #dbe3eb",
  },
  rightTabs: {
    minHeight: 34,
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    borderBottom: "1px solid #dbe3eb",
    background: "#ffffff",
  },
  rightTabButton: {
    position: "relative",
    minHeight: 34,
    padding: "0 6px",
    border: "none",
    borderRight: "1px solid #edf1f5",
    background: "#ffffff",
    color: "#64748b",
    fontSize: 7.9,
    fontWeight: 900,
    cursor: "pointer",
  },
  rightTabActive: {
    color: "#1768d2",
    boxShadow: "inset 0 -3px 0 #1768d2",
  },
  workflowControlBar: {
    padding: "7px 8px",
    display: "grid",
    gap: 6,
    background: "#ffffff",
    borderBottom: "1px solid #e3e8ee",
  },
  workflowStatusSummary: {
    display: "grid",
    gap: 8,
  },
  workflowPills: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  workflowReleasePill: {
    minHeight: 24,
    padding: "0 9px",
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    background: "#f2f5f8",
    color: "#667789",
    fontSize: 7.8,
    fontWeight: 900,
  },
  workflowReleasePillVisible: {
    minHeight: 24,
    padding: "0 9px",
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    background: "#e9f8ef",
    color: "#16834f",
    fontSize: 7.8,
    fontWeight: 950,
  },
  workflowReviewerLine: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#526577",
    fontSize: 8,
  },
  workflowReviewerIcon: {
    width: 15,
    height: 15,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#1768d2",
    fontSize: 12,
    flex: "0 0 auto",
  },
  portalCard: {
    padding: 7,
    display: "grid",
    gap: 6,
    border: "1px solid #dbe3eb",
    background: "#ffffff",
  },
  portalCardHeading: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#10233a",
    fontSize: 8.4,
  },
  portalCardIcon: {
    width: 22,
    height: 22,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eaf3ff",
    color: "#1768d2",
    fontSize: 11,
  },
  portalCategorySelect: {
    width: "100%",
    height: 30,
    padding: "0 8px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 8,
    fontWeight: 850,
    outline: "none",
  },
  portalCategoryHint: {
    color: "#8996a4",
    fontSize: 7.2,
  },
  actionCard: {
    padding: 7,
    display: "grid",
    gap: 6,
    border: "1px solid #dbe3eb",
    background: "#ffffff",
  },
  actionCardHeading: {
    color: "#10233a",
    fontSize: 8.4,
    fontWeight: 950,
  },
  actionPrimaryRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 88px",
    gap: 7,
    alignItems: "stretch",
  },
  workflowPrimaryAction: {
    minWidth: 0,
    height: 30,
    padding: "0 9px",
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 8,
    fontWeight: 950,
    cursor: "pointer",
  },
  documentActionsWrap: {
    position: "relative",
  },
  documentActionsButton: {
    width: "100%",
    height: 32,
    padding: "0 9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 8,
    fontWeight: 900,
    cursor: "pointer",
  },
  documentActionsChevron: {
    color: "#64748b",
    fontSize: 10,
  },
  documentActionsMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    zIndex: 40,
    minWidth: 132,
    padding: 4,
    display: "grid",
    gap: 2,
    border: "1px solid #d3dce6",
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15,35,58,0.14)",
  },
  documentActionMenuItem: {
    minHeight: 30,
    padding: "0 9px",
    border: "none",
    background: "#ffffff",
    color: "#10233a",
    textAlign: "left",
    fontSize: 7.8,
    fontWeight: 850,
    cursor: "pointer",
  },
  documentActionMenuDanger: {
    minHeight: 30,
    padding: "0 9px",
    border: "none",
    background: "#ffffff",
    color: "#c93636",
    textAlign: "left",
    fontSize: 7.8,
    fontWeight: 900,
    cursor: "pointer",
  },
  selectedDocumentHeader: {
    minHeight: 52,
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    background: "#ffffff",
    borderBottom: "1px solid #e3e8ee",
  },
  selectedDocumentCopy: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  selectedDocumentName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#10233a",
    fontSize: 9.2,
    fontWeight: 950,
  },
  selectedDocumentMeta: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#728091",
    fontSize: 7.8,
  },
  previewSectionHeading: {
    marginBottom: 7,
    color: "#10233a",
    fontSize: 8.5,
    fontWeight: 950,
  },
  previewSection: {
    padding: 8,
    background: "#fbfcfe",
    borderBottom: "1px solid #e3e8ee",
  },
  previewFrame: {
    width: "100%",
    height: 150,
    border: "1px solid #cfd8e3",
    background: "#ffffff",
  },
  previewImage: {
    width: "100%",
    maxHeight: 150,
    objectFit: "contain",
    border: "1px solid #cfd8e3",
    background: "#ffffff",
  },
  previewPlaceholder: {
    minHeight: 145,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    textAlign: "center",
    color: "#64748b",
    background: "#ffffff",
    border: "1px solid #d7dfe8",
    fontSize: 8.8,
  },
  previewHeroBadge: {
    transform: "scale(1.15)",
    marginBottom: 4,
  },
  previewPrimaryButton: {
    height: 34,
    marginTop: 6,
    padding: "0 12px",
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  quickActions: {
    marginTop: 6,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 7,
  },
  primaryRightAction: {
    height: 31,
    border: "1px solid #135dc2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  signOffAction: {
    gridColumn: "1 / -1",
    height: 31,
    border: "1px solid #10233a",
    background: "#10233a",
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryRightAction: {
    height: 31,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  rightPanelBody: {
    padding: 9,
    background: "#ffffff",
    borderBottom: "1px solid #e3e8ee",
  },
  panelHeading: {
    margin: "0 0 10px",
    color: "#10233a",
    fontSize: 10.5,
    fontWeight: 950,
  },
  detailList: {
    display: "grid",
    gap: 0,
    border: "1px solid #e0e6ed",
  },
  detailRow: {
    minHeight: 36,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottom: "1px solid #edf1f5",
    color: "#64748b",
    fontSize: 8.2,
  },
  pathBox: {
    marginTop: 10,
    padding: 10,
    display: "grid",
    gap: 5,
    background: "#f6f8fb",
    border: "1px solid #e0e6ed",
    color: "#64748b",
    fontSize: 8,
    wordBreak: "break-all",
  },
  activityEmpty: {
    minHeight: 90,
    padding: 10,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    border: "1px solid #e0e6ed",
    color: "#687789",
    fontSize: 8.2,
  },
  activityDot: {
    width: 9,
    height: 9,
    marginTop: 4,
    borderRadius: "50%",
    background: "#1768d2",
    flex: "0 0 auto",
  },
  folderOverviewPanel: {
    padding: 8,
    background: "#ffffff",
    borderBottom: "1px solid #e3e8ee",
  },
  folderOverviewHeader: {
    minHeight: 40,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  folderOverviewIcon: {
    width: 30,
    height: 26,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0b400",
    color: "#ffffff",
    borderRadius: 3,
    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
    flex: "0 0 auto",
  },
  folderOverviewCopy: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  folderOverviewTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#10233a",
    fontSize: 9,
    fontWeight: 950,
  },
  folderOverviewMeta: {
    color: "#728091",
    fontSize: 7.3,
    fontWeight: 700,
  },
  folderOverviewStats: {
    marginTop: 6,
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    border: "1px solid #e0e6ed",
    background: "#f9fbfd",
  },
  folderOverviewStat: {
    minHeight: 42,
    padding: 6,
    display: "grid",
    alignContent: "center",
    gap: 2,
    borderRight: "1px solid #e0e6ed",
    color: "#10233a",
    fontSize: 7.6,
  },
  folderOverviewHint: {
    marginTop: 6,
    padding: 8,
    display: "grid",
    gap: 3,
    background: "#f8fafc",
    border: "1px solid #e4e9ef",
    color: "#667789",
    fontSize: 7.4,
    lineHeight: 1.3,
  },
  insightDivider: {
    height: 1,
    background: "#e3e8ee",
  },
  insightCompactSection: {
    marginTop: 10,
    paddingTop: 9,
    borderTop: "1px solid #e3e8ee",
  },
  insightSection: {
    padding: 6,
    background: "#ffffff",
    borderBottom: "1px solid #e3e8ee",
  },
  sectionTitleRow: {
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#10233a",
    fontSize: 9,
    fontWeight: 950,
  },
  insightGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,
  },
  insightCard: {
    minHeight: 38,
    padding: "5px 6px",
    display: "grid",
    alignContent: "center",
    gap: 1,
    background: "#f9fbfd",
    border: "1px solid #e0e6ed",
    color: "#10233a",
    fontSize: 7.5,
  },
  rightBottomGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
  },
  miniList: {
    display: "grid",
    gap: 2,
  },
  miniListRow: {
    width: "100%",
    minHeight: 38,
    padding: "4px 2px",
    display: "grid",
    gridTemplateColumns: "34px minmax(0,1fr)",
    alignItems: "center",
    gap: 6,
    border: "none",
    borderBottom: "1px solid #eef2f6",
    background: "transparent",
    color: "#10233a",
    textAlign: "left",
    cursor: "pointer",
  },
  queueDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#f0a317",
    flex: "0 0 auto",
  },
  miniListRowText: {
    minWidth: 0,
    display: "grid",
    gap: 2,
  },
  miniListRowName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 8.2,
    color: "#10233a",
  },
  miniListRowMeta: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 7.2,
    color: "#758394",
  },
  emptyMini: {
    padding: "8px 0",
    color: "#7a8794",
    fontSize: 7.8,
    lineHeight: 1.35,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "rgba(9,24,40,0.42)",
  },
  modalCard: {
    width: "min(460px, calc(100vw - 40px))",
    background: "#ffffff",
    border: "1px solid #bfcbd7",
    boxShadow: "0 24px 70px rgba(8,28,48,0.24)",
  },
  modalHeader: {
    minHeight: 66,
    padding: "11px 13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid #dde5ed",
    background: "#fbfcfe",
  },
  modalTitleWrap: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  reviewModalIcon: {
    width: 34,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 950,
    flex: "0 0 auto",
  },
  reviewInfoBox: {
    padding: 10,
    border: "1px solid #d8e2ec",
    background: "#f7f9fc",
    color: "#526577",
    fontSize: 8.4,
    lineHeight: 1.4,
  },
  modalFolderIcon: {
    width: 34,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    background: "#f0b400",
    borderRadius: 4,
    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
    flex: "0 0 auto",
  },
  modalTitle: {
    display: "block",
    color: "#10233a",
    fontSize: 13,
    fontWeight: 950,
  },
  modalSubtitle: {
    display: "block",
    marginTop: 3,
    color: "#667789",
    fontSize: 8.6,
  },
  modalClose: {
    width: 30,
    height: 30,
    border: "none",
    background: "transparent",
    color: "#667789",
    fontSize: 20,
    cursor: "pointer",
  },
  modalBody: {
    padding: 14,
    display: "grid",
    gap: 12,
  },
  modalLabel: {
    display: "grid",
    gap: 6,
    color: "#10233a",
    fontSize: 9,
    fontWeight: 900,
  },
  modalInput: {
    width: "100%",
    height: 38,
    padding: "0 10px",
    boxSizing: "border-box",
    border: "1px solid #bfcbd7",
    outline: "none",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 10,
  },
  modalPath: {
    padding: 9,
    display: "grid",
    gap: 4,
    background: "#f6f8fb",
    border: "1px solid #e0e6ed",
    color: "#6d7b8a",
    fontSize: 8,
    wordBreak: "break-all",
  },
  modalFooter: {
    minHeight: 54,
    padding: "8px 13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    borderTop: "1px solid #dde5ed",
    background: "#fbfcfe",
  },
  modalCancel: {
    height: 34,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 8.8,
    fontWeight: 900,
    cursor: "pointer",
  },
  modalCreate: {
    height: 34,
    padding: "0 14px",
    border: "1px solid #135dc2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 8.8,
    fontWeight: 900,
    cursor: "pointer",
  },
  modalCreateDisabled: {
    height: 34,
    padding: "0 14px",
    border: "1px solid #d4dce5",
    background: "#eef2f6",
    color: "#8996a4",
    fontSize: 8.8,
    fontWeight: 900,
    cursor: "not-allowed",
  },
};
