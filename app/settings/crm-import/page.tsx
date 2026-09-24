"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type UploadResult = {
  success: boolean;
  existing?: boolean;
  batch?: {
    id: string;
    batch_reference: string;
    status: string;
    import_mode: string;
    source_system: string | null;
    original_filename: string | null;
  };
  counts?: {
    total: number;
    clients: number;
    people: number;
    peopleRoles: number;
    groups: number;
    groupMembers: number;
    registrations: number;
    addresses: number;
    documentLinks: number;
    review: number;
    errors: number;
  };
  error?: string;
};

export default function CrmImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  const selectedFileText = useMemo(() => {
    if (!file) return "No workbook selected";
    return `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }, [file]);

  async function uploadWorkbook() {
    if (!file || uploading) return;

    setUploading(true);
    setError("");
    setResult(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your login session could not be confirmed.");
      }

      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/crm/imports/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: form,
      });

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error || `Import upload failed with status ${response.status}.`
        );
      }

      setResult(payload as UploadResult);
    } catch (uploadError) {
      console.error("CRM import upload failed:", uploadError);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload the CRM import workbook."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <h1 style={titleStyle}>CRM Data Import</h1>
          <p style={subtitleStyle}>
            Upload a PracticePilot CRM Master Import workbook. This step stages
            and validates the data only — it does not create or update live CRM
            records.
          </p>
        </div>
      </section>

      <section style={stepsBarStyle}>
        <div style={{ ...stepStyle, ...activeStepStyle }}>
          <span style={stepNumberStyle}>1</span>
          <span>Upload</span>
        </div>
        <div style={stepStyle}>
          <span style={stepNumberStyle}>2</span>
          <span>Validate</span>
        </div>
        <div style={stepStyle}>
          <span style={stepNumberStyle}>3</span>
          <span>Review</span>
        </div>
        <div style={stepStyle}>
          <span style={stepNumberStyle}>4</span>
          <span>Import</span>
        </div>
        <div style={stepStyle}>
          <span style={stepNumberStyle}>5</span>
          <span>Results</span>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={panelHeadingStyle}>Upload PP Master Import Workbook</div>

        <div style={uploadGridStyle}>
          <label style={fileBoxStyle}>
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                const next = event.target.files?.[0] || null;
                setFile(next);
                setResult(null);
                setError("");
              }}
              style={{ display: "none" }}
            />

            <strong style={fileBoxTitleStyle}>
              {file ? "Workbook selected" : "Choose .xlsx workbook"}
            </strong>
            <span style={fileBoxMetaStyle}>{selectedFileText}</span>
            <span style={fileButtonStyle}>Browse</span>
          </label>

          <div style={rulesStyle}>
            <div style={rulesHeadingStyle}>Before upload</div>
            <div style={ruleRowStyle}>Use the PracticePilot CRM Master Import format.</div>
            <div style={ruleRowStyle}>Do not rename workbook tabs.</div>
            <div style={ruleRowStyle}>Import Control must contain a batch reference.</div>
            <div style={ruleRowStyle}>No Services or Tasking data is imported here.</div>
          </div>
        </div>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <div style={actionRowStyle}>
          <button
            type="button"
            onClick={uploadWorkbook}
            disabled={!file || uploading}
            style={{
              ...primaryButtonStyle,
              opacity: !file || uploading ? 0.55 : 1,
              cursor: !file || uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading & staging..." : "Upload & Stage Workbook"}
          </button>
        </div>
      </section>

      {result?.batch && result.counts ? (
        <section style={resultPanelStyle}>
          <div style={resultHeaderStyle}>
            <div>
              <div style={resultTitleStyle}>
                {result.existing
                  ? "Existing staged batch recovered"
                  : "Workbook staged successfully"}
              </div>
              <div style={resultMetaStyle}>
                Batch {result.batch.batch_reference}
                {result.batch.source_system
                  ? ` · ${result.batch.source_system}`
                  : ""}
              </div>
            </div>

            <span style={statusPillStyle}>
              {result.batch.status.replaceAll("_", " ")}
            </span>
          </div>

          <div style={metricGridStyle}>
            <Metric label="Total rows" value={result.counts.total} />
            <Metric label="Clients" value={result.counts.clients} />
            <Metric label="People" value={result.counts.people} />
            <Metric label="Groups" value={result.counts.groups} />
            <Metric label="Registrations" value={result.counts.registrations} />
            <Metric label="Needs review" value={result.counts.review} />
            <Metric label="Errors" value={result.counts.errors} />
          </div>

          <div style={nextNoteStyle}>
            {result.existing
              ? "This batch was already created by the earlier upload. Nothing has been imported into live CRM. Open the existing batch and continue with validation/review."
              : "Nothing has been imported into CRM yet. The next step is the validation/review screen for this staged batch."}
          </div>

          <div style={reviewActionRowStyle}>
            <Link
              href={`/settings/crm-import/${result.batch.id}`}
              style={reviewButtonStyle}
            >
              Open Validation & Review
            </Link>
          </div>
        </section>
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

const pageStyle: React.CSSProperties = {
  minHeight: "calc(100vh - 60px)",
  background: "#eef2f5",
  padding: "18px 20px 36px",
  color: "#10233a",
};

const headerStyle: React.CSSProperties = {
  marginBottom: 14,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  color: "#10233a",
};

const subtitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  maxWidth: 840,
  fontSize: 11.5,
  lineHeight: 1.5,
  color: "#526174",
};

const stepsBarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  border: "1px solid #d8e2ee",
  background: "#ffffff",
  marginBottom: 12,
};

const stepStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  minHeight: 38,
  padding: "0 8px",
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

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d8e2ee",
};

const panelHeadingStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #d8e2ee",
  background: "#f7f9fb",
  fontSize: 13,
  fontWeight: 900,
};

const uploadGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.15fr) minmax(300px, .85fr)",
  gap: 14,
  padding: 14,
};

const fileBoxStyle: React.CSSProperties = {
  minHeight: 150,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 7,
  border: "1px dashed #9fb3c8",
  background: "#fbfdff",
  cursor: "pointer",
};

const fileBoxTitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#10233a",
};

const fileBoxMetaStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: "#66758a",
};

const fileButtonStyle: React.CSSProperties = {
  marginTop: 4,
  minHeight: 28,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 12px",
  background: "#ffffff",
  border: "1px solid #b8c7d6",
  fontSize: 10.5,
  fontWeight: 850,
  color: "#10233a",
};

const rulesStyle: React.CSSProperties = {
  border: "1px solid #d8e2ee",
  background: "#f8fafc",
  padding: 12,
};

const rulesHeadingStyle: React.CSSProperties = {
  marginBottom: 7,
  fontSize: 12,
  fontWeight: 900,
};

const ruleRowStyle: React.CSSProperties = {
  padding: "7px 0",
  borderBottom: "1px solid #e3e9ef",
  fontSize: 10.5,
  color: "#46566a",
};

const errorStyle: React.CSSProperties = {
  margin: "0 14px 12px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  padding: "9px 10px",
  fontSize: 10.5,
  fontWeight: 750,
  color: "#b42318",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  padding: "10px 14px",
  borderTop: "1px solid #d8e2ee",
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 30,
  padding: "0 14px",
  border: "1px solid #1769e0",
  background: "#1769e0",
  color: "#ffffff",
  fontSize: 10.5,
  fontWeight: 900,
};

const resultPanelStyle: React.CSSProperties = {
  marginTop: 12,
  background: "#ffffff",
  border: "1px solid #d8e2ee",
};

const resultHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "11px 12px",
  borderBottom: "1px solid #d8e2ee",
};

const resultTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const resultMetaStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 10,
  color: "#66758a",
};

const statusPillStyle: React.CSSProperties = {
  padding: "4px 8px",
  background: "#fff7df",
  border: "1px solid #f3d892",
  fontSize: 9.5,
  fontWeight: 900,
  color: "#8b5e00",
  textTransform: "capitalize",
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  borderBottom: "1px solid #d8e2ee",
};

const metricStyle: React.CSSProperties = {
  minHeight: 65,
  padding: "10px 11px",
  borderRight: "1px solid #e3e9ef",
};

const metricValueStyle: React.CSSProperties = {
  display: "block",
  fontSize: 18,
  color: "#10233a",
};

const metricLabelStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: 9.5,
  fontWeight: 750,
  color: "#66758a",
};

const nextNoteStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "#f4f8ff",
  fontSize: 10.5,
  fontWeight: 750,
  color: "#36516f",
};


const reviewActionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  padding: "10px 12px",
  borderTop: "1px solid #d8e2ee",
};

const reviewButtonStyle: React.CSSProperties = {
  minHeight: 30,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 14px",
  border: "1px solid #1769e0",
  background: "#1769e0",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: 10.5,
  fontWeight: 900,
};
