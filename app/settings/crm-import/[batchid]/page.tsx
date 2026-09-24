"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type Batch = {
  id: string;
  batch_reference: string;
  import_mode: string;
  source_system: string | null;
  original_filename: string | null;
  status: string;
  total_rows: number;
  review_count: number;
  error_count: number;
};

type ImportRow = {
  id: string;
  sheet_name: string;
  source_row_number: number;
  import_key: string | null;
  record_type: string;
  raw_data: Record<string, unknown>;
  match_status: string;
  validation_errors: string[];
  validation_warnings: string[];
  approved_for_import: boolean;
};

type ReviewPayload = {
  success: boolean;
  batch: Batch;
  rows: ImportRow[];
  counts: {
    total: number;
    pending: number;
    review: number;
    error: number;
    approved: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export default function CrmImportReviewPage() {
  const params = useParams();
  const batchId = String(
    (params as Record<string, string | string[] | undefined>)?.batchid ||
      (params as Record<string, string | string[] | undefined>)?.batchId ||
      ""
  );

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedClients: number;
    updatedClients: number;
    contacts: number;
    directors: number;
    shareholders: number;
    addresses: number;
    registrationRows: number;
    documentLinks: number;
    skippedRows: number;
    failedRows: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [sheetFilter, setSheetFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  async function authFetch(url: string, options?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your login session could not be confirmed.");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const json = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok || !json?.success) {
      throw new Error(json?.error || `Request failed with status ${response.status}.`);
    }

    return json;
  }

  async function loadReview(nextPage = page) {
    if (!batchId) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "100",
      });

      if (sheetFilter !== "All") params.set("sheet", sheetFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);

      const loadPromise = authFetch(
        `/api/crm/imports/${batchId}?${params.toString()}`
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              "The review page took too long to load. The request was stopped instead of leaving the page hanging."
            )
          );
        }, 15000);
      });

      const json = await Promise.race([loadPromise, timeoutPromise]);

      setPayload(json as ReviewPayload);
      setPage(json.pagination?.page || nextPage);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the import review."
      );
    } finally {
      setLoading(false);
    }
  }

  async function validateBatch() {
    if (!batchId || validating) return;

    setValidating(true);
    setError("");

    try {
      await authFetch(`/api/crm/imports/${batchId}/validate`, {
        method: "POST",
      });
      await loadReview();
    } catch (validateError) {
      setError(
        validateError instanceof Error
          ? validateError.message
          : "Could not validate the import batch."
      );
    } finally {
      setValidating(false);
    }
  }

  async function importApprovedRows() {
    if (!batchId || importing) return;

    const approved = payload?.counts.approved || 0;

    if (approved <= 0) {
      setError("Approve the clean rows before importing.");
      return;
    }

    const proceed = window.confirm(
      `Import ${approved} approved row${approved === 1 ? "" : "s"} into live CRM?\n\nRows still marked Review or Error will be skipped.`
    );

    if (!proceed) return;

    setImporting(true);
    setError("");
    setImportResult(null);

    try {
      const json = await authFetch(`/api/crm/imports/${batchId}/import-approved`, {
        method: "POST",
      });

      setImportResult(json.result || null);
      await loadReview(1);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import the approved CRM rows."
      );
    } finally {
      setImporting(false);
    }
  }

  async function approveCleanRows() {
    if (!batchId || approving) return;

    setApproving(true);
    setError("");

    try {
      await authFetch(`/api/crm/imports/${batchId}/approve-clean`, {
        method: "POST",
      });
      await loadReview();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Could not approve the clean rows."
      );
    } finally {
      setApproving(false);
    }
  }

  useEffect(() => {
    void loadReview(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, sheetFilter, statusFilter]);

  const sheets = [
    "All",
    "Clients",
    "People",
    "People Roles",
    "Client Groups",
    "Group Members",
    "Registrations",
    "Addresses",
    "Document Links",
  ];

  const visibleRows = payload?.rows || [];

  if (!batchId) {
    return (
      <main style={pageStyle}>
        <div style={errorStyle}>
          Import batch ID is missing from the route.
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={loadingStyle}>Loading CRM import review...</div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={topRowStyle}>
        <div>
          <Link href="/settings/crm-import" style={backLinkStyle}>
            ← CRM Data Import
          </Link>
          <h1 style={titleStyle}>Validation & Review</h1>
          <div style={subtitleStyle}>
            {payload?.batch.batch_reference || "Import batch"}
            {payload?.batch.source_system
              ? ` · ${payload.batch.source_system}`
              : ""}
          </div>
        </div>

        <div style={buttonGroupStyle}>
          <button
            type="button"
            onClick={validateBatch}
            disabled={validating}
            style={secondaryButtonStyle}
          >
            {validating ? "Validating..." : "Run Validation"}
          </button>

          <button
            type="button"
            onClick={approveCleanRows}
            disabled={approving || importing}
            style={secondaryButtonStyle}
          >
            {approving ? "Approving..." : "Approve Clean Rows"}
          </button>

          <button
            type="button"
            onClick={importApprovedRows}
            disabled={
              importing ||
              approving ||
              !payload ||
              payload.counts.approved <= 0
            }
            style={{
              ...primaryButtonStyle,
              opacity:
                !payload || payload.counts.approved <= 0 || importing ? 0.55 : 1,
            }}
          >
            {importing ? "Importing..." : "Import Approved Rows"}
          </button>
        </div>
      </div>

      <section style={stepsBarStyle}>
        <div style={stepStyle}><span style={stepNumberStyle}>1</span>Upload</div>
        <div style={{ ...stepStyle, ...activeStepStyle }}><span style={stepNumberStyle}>2</span>Validate</div>
        <div style={{ ...stepStyle, ...activeStepStyle }}><span style={stepNumberStyle}>3</span>Review</div>
        <div style={importResult ? { ...stepStyle, ...activeStepStyle } : stepStyle}>
          <span style={stepNumberStyle}>4</span>Import
        </div>
        <div style={importResult ? { ...stepStyle, ...activeStepStyle } : stepStyle}>
          <span style={stepNumberStyle}>5</span>Results
        </div>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      {payload ? (
        <>
          <section style={metricsStyle}>
            <Metric label="Total staged" value={payload.counts.total} />
            <Metric label="Pending / clean" value={payload.counts.pending} />
            <Metric label="Needs review" value={payload.counts.review} />
            <Metric label="Errors" value={payload.counts.error} />
            <Metric label="Approved" value={payload.counts.approved} />
          </section>

          {importResult ? (
            <section style={importResultPanelStyle}>
              <div style={importResultHeadingStyle}>Import completed</div>
              <div style={importResultGridStyle}>
                <Metric label="Clients created" value={importResult.importedClients} />
                <Metric label="Clients updated" value={importResult.updatedClients} />
                <Metric label="Contacts" value={importResult.contacts} />
                <Metric label="Addresses" value={importResult.addresses} />
                <Metric label="Directors" value={importResult.directors} />
                <Metric label="Shareholders" value={importResult.shareholders} />
                <Metric label="Skipped rows" value={importResult.skippedRows} />
                <Metric label="Failed rows" value={importResult.failedRows} />
              </div>
              <div style={importResultFooterStyle}>
                Review/Error rows were not imported. Open CRM Clients to check the migrated client master data.
                <Link href="/crm/clients" style={openClientsLinkStyle}>
                  Open CRM Clients
                </Link>
              </div>
            </section>
          ) : null}

          <section style={panelStyle}>
            <div style={toolbarStyle}>
              <div style={filterGroupStyle}>
                <label style={labelStyle}>Sheet</label>
                <select
                  value={sheetFilter}
                  onChange={(event) => {
                    setPage(1);
                    setSheetFilter(event.target.value);
                  }}
                  style={selectStyle}
                >
                  {sheets.map((sheet) => (
                    <option key={sheet} value={sheet}>
                      {sheet}
                    </option>
                  ))}
                </select>
              </div>

              <div style={filterGroupStyle}>
                <label style={labelStyle}>Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setPage(1);
                    setStatusFilter(event.target.value);
                  }}
                  style={selectStyle}
                >
                  <option value="All">All</option>
                  <option value="pending">Pending</option>
                  <option value="review">Review</option>
                  <option value="error">Error</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="skip">Skip</option>
                  <option value="possible_duplicate">Possible Duplicate</option>
                </select>
              </div>

              <div style={paginationStyle}>
                <button
                  type="button"
                  style={pagerButtonStyle}
                  disabled={!payload || payload.pagination.page <= 1}
                  onClick={() => void loadReview(Math.max(1, page - 1))}
                >
                  Previous
                </button>
                <span style={rowCountStyle}>
                  Page {payload?.pagination.page || 1} of{" "}
                  {payload?.pagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  style={pagerButtonStyle}
                  disabled={
                    !payload ||
                    payload.pagination.page >= payload.pagination.totalPages
                  }
                  onClick={() => void loadReview(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>

            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Sheet</th>
                    <th style={thStyle}>Row</th>
                    <th style={thStyle}>Import Key</th>
                    <th style={thStyle}>Record</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Validation</th>
                    <th style={thStyle}>Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const displayName =
                      String(
                        row.raw_data["Client / Record Name*"] ||
                          row.raw_data["Full Name"] ||
                          row.raw_data["Group Name*"] ||
                          row.raw_data["Registration Number"] ||
                          row.raw_data["Link / URL*"] ||
                          row.record_type
                      );

                    const issues = [
                      ...(row.validation_errors || []),
                      ...(row.validation_warnings || []),
                    ];

                    return (
                      <tr key={row.id}>
                        <td style={tdStyle}>{row.sheet_name}</td>
                        <td style={tdStyle}>{row.source_row_number}</td>
                        <td style={monoTdStyle}>{row.import_key || "—"}</td>
                        <td style={tdStrongStyle}>{displayName}</td>
                        <td style={tdStyle}>
                          <StatusBadge status={row.match_status} />
                        </td>
                        <td style={tdStyle}>
                          {issues.length ? (
                            <div style={issueListStyle}>
                              {issues.map((issue, index) => (
                                <div key={`${row.id}-${index}`}>{issue}</div>
                              ))}
                            </div>
                          ) : (
                            <span style={cleanTextStyle}>Clean</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {row.approved_for_import ? (
                            <span style={approvedTextStyle}>Approved</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div style={footerNoteStyle}>
            Only rows explicitly approved are imported. Rows still marked Review or Error remain staged and are skipped. Services and Tasking are not imported.
          </div>
        </>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricStyle}>
      <strong style={metricValueStyle}>{value}</strong>
      <span style={metricLabelStyle}>{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colour =
    status === "error"
      ? { background: "#fff1f2", borderColor: "#fecaca", color: "#b42318" }
      : status === "review" || status === "possible_duplicate"
        ? { background: "#fff7df", borderColor: "#f3d892", color: "#8b5e00" }
        : status === "create"
          ? { background: "#ecfdf3", borderColor: "#bbf7d0", color: "#166534" }
          : status === "update"
            ? { background: "#eaf2ff", borderColor: "#bfdbfe", color: "#1756a9" }
            : { background: "#f3f6f9", borderColor: "#d8e2ee", color: "#526174" };

  return (
    <span style={{ ...badgeStyle, ...colour }}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "calc(100vh - 60px)",
  background: "#eef2f5",
  padding: "18px 20px 36px",
  color: "#10233a",
};

const loadingStyle: React.CSSProperties = {
  minHeight: 180,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 800,
  color: "#526174",
};

const topRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 14,
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 5,
  color: "#1769e0",
  textDecoration: "none",
  fontSize: 10.5,
  fontWeight: 800,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 10.5,
  color: "#66758a",
};

const buttonGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 30,
  padding: "0 13px",
  border: "1px solid #1769e0",
  background: "#1769e0",
  color: "#ffffff",
  fontSize: 10.5,
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 30,
  padding: "0 13px",
  border: "1px solid #b8c7d6",
  background: "#ffffff",
  color: "#10233a",
  fontSize: 10.5,
  fontWeight: 900,
  cursor: "pointer",
};

const stepsBarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  border: "1px solid #d8e2ee",
  background: "#ffffff",
  marginBottom: 12,
};

const stepStyle: React.CSSProperties = {
  minHeight: 38,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRight: "1px solid #d8e2ee",
  fontSize: 10.5,
  fontWeight: 800,
  color: "#66758a",
};

const activeStepStyle: React.CSSProperties = {
  background: "#eaf2ff",
  color: "#1769e0",
};

const stepNumberStyle: React.CSSProperties = {
  width: 19,
  height: 19,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid currentColor",
  borderRadius: "50%",
  fontSize: 9.5,
  fontWeight: 900,
};

const errorStyle: React.CSSProperties = {
  marginBottom: 12,
  padding: "9px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b42318",
  fontSize: 10.5,
  fontWeight: 750,
};

const metricsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  background: "#ffffff",
  border: "1px solid #d8e2ee",
  marginBottom: 12,
};

const metricStyle: React.CSSProperties = {
  padding: "10px 11px",
  borderRight: "1px solid #e3e9ef",
};

const metricValueStyle: React.CSSProperties = {
  display: "block",
  fontSize: 18,
  fontWeight: 900,
};

const metricLabelStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: 9.5,
  color: "#66758a",
  fontWeight: 750,
};

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d8e2ee",
};

const toolbarStyle: React.CSSProperties = {
  minHeight: 48,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 10px",
  borderBottom: "1px solid #d8e2ee",
  background: "#f8fafc",
};

const filterGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 850,
  color: "#526174",
};

const selectStyle: React.CSSProperties = {
  height: 29,
  minWidth: 150,
  border: "1px solid #bcc9d6",
  background: "#ffffff",
  padding: "0 8px",
  fontSize: 10.5,
  color: "#10233a",
};

const rowCountStyle: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: 10,
  fontWeight: 800,
  color: "#66758a",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thStyle: React.CSSProperties = {
  padding: "8px 8px",
  borderBottom: "1px solid #cbd6e0",
  background: "#f2f5f8",
  textAlign: "left",
  fontSize: 9.5,
  fontWeight: 900,
  color: "#435267",
};

const tdStyle: React.CSSProperties = {
  padding: "7px 8px",
  borderBottom: "1px solid #e4e9ee",
  verticalAlign: "top",
  fontSize: 10,
  color: "#46566a",
  wordBreak: "break-word",
};

const tdStrongStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#10233a",
  fontWeight: 800,
};

const monoTdStyle: React.CSSProperties = {
  ...tdStyle,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 9.5,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "0 7px",
  border: "1px solid",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "capitalize",
};

const issueListStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  color: "#8b5e00",
  fontSize: 9.5,
  lineHeight: 1.35,
};

const cleanTextStyle: React.CSSProperties = {
  color: "#166534",
  fontWeight: 850,
};

const approvedTextStyle: React.CSSProperties = {
  color: "#166534",
  fontWeight: 900,
};

const footerNoteStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "9px 10px",
  background: "#f4f8ff",
  border: "1px solid #d8e8ff",
  color: "#36516f",
  fontSize: 10,
  fontWeight: 750,
};


const paginationStyle: React.CSSProperties = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const pagerButtonStyle: React.CSSProperties = {
  minHeight: 28,
  padding: "0 9px",
  border: "1px solid #bcc9d6",
  background: "#ffffff",
  color: "#10233a",
  fontSize: 9.5,
  fontWeight: 850,
};


const importResultPanelStyle: React.CSSProperties = {
  marginBottom: 12,
  background: "#ffffff",
  border: "1px solid #b7dec4",
  borderTop: "3px solid #218647",
};

const importResultHeadingStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #d8e2ee",
  fontSize: 13,
  fontWeight: 900,
  color: "#166534",
};

const importResultGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
  borderBottom: "1px solid #d8e2ee",
};

const importResultFooterStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "9px 12px",
  fontSize: 10,
  fontWeight: 750,
  color: "#36516f",
};

const openClientsLinkStyle: React.CSSProperties = {
  minHeight: 28,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 10px",
  border: "1px solid #1769e0",
  background: "#1769e0",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: 9.5,
  fontWeight: 900,
};
