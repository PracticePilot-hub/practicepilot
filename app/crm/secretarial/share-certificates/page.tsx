"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type MatterRow = {
  id: string;
  client_id: string;
  shareholder_id: string | null;
  certificate_number: string;
  matter_status: string;
  current_step: number;
  issue_date: string | null;
  created_at: string;
};

type ClientRow = {
  id: string;
  client_name: string | null;
  registration_number: string | null;
};

type ShareholderRow = {
  id: string;
  full_legal_name: string;
};

type DisplayRow = MatterRow & {
  clientName: string;
  registrationNumber: string;
  shareholderName: string;
};

export default function ShareCertificatesPage() {
  const [matters, setMatters] = useState<MatterRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [shareholders, setShareholders] = useState<ShareholderRow[]>([]);
  const [issuedCount, setIssuedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setLoadError("");

    try {
      const { data: matterData, error: matterError } = await supabase
        .from("secretarial_share_matters")
        .select(
          "id, client_id, shareholder_id, certificate_number, matter_status, current_step, issue_date, created_at"
        )
        .neq("matter_status", "cancelled")
        .order("created_at", { ascending: false });

      if (matterError) throw matterError;

      const loadedMatters = (matterData || []) as MatterRow[];
      setMatters(loadedMatters);

      const clientIds = Array.from(
        new Set(loadedMatters.map((matter) => matter.client_id).filter(Boolean))
      );

      if (clientIds.length > 0) {
        const { data: clientData, error: clientError } = await supabase
          .from("crm_clients")
          .select("id, client_name, registration_number")
          .in("id", clientIds);

        if (clientError) throw clientError;
        setClients((clientData || []) as ClientRow[]);
      } else {
        setClients([]);
      }

      const shareholderIds = Array.from(
        new Set(
          loadedMatters
            .map((matter) => matter.shareholder_id)
            .filter((value): value is string => Boolean(value))
        )
      );

      if (shareholderIds.length > 0) {
        const { data: shareholderData, error: shareholderError } =
          await supabase
            .from("secretarial_shareholders")
            .select("id, full_legal_name")
            .in("id", shareholderIds);

        if (shareholderError) throw shareholderError;
        setShareholders((shareholderData || []) as ShareholderRow[]);
      } else {
        setShareholders([]);
      }

      const { count, error: issuedError } = await supabase
        .from("secretarial_share_certificates")
        .select("id", { count: "exact", head: true })
        .eq("certificate_status", "issued");

      if (issuedError) throw issuedError;
      setIssuedCount(count || 0);
    } catch (error) {
      console.error("Could not load share certificate matters:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load share certificate matters."
      );
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo<DisplayRow[]>(() => {
    const clientMap = new Map(clients.map((client) => [client.id, client]));
    const shareholderMap = new Map(
      shareholders.map((shareholder) => [shareholder.id, shareholder])
    );

    return matters.map((matter) => {
      const client = clientMap.get(matter.client_id);
      const shareholder = matter.shareholder_id
        ? shareholderMap.get(matter.shareholder_id)
        : null;

      return {
        ...matter,
        clientName: client?.client_name || "Unnamed client",
        registrationNumber: client?.registration_number || "—",
        shareholderName: shareholder?.full_legal_name || "—",
      };
    });
  }, [matters, clients, shareholders]);

  const openWorkflows = matters.filter((matter) =>
    ["draft", "in_progress", "returned_for_correction"].includes(
      matter.matter_status
    )
  ).length;

  const awaitingReview = matters.filter(
    (matter) => matter.matter_status === "awaiting_review"
  ).length;

  const incompleteRegisters = matters.filter(
    (matter) =>
      matter.matter_status !== "completed" &&
      matter.current_step >= 7 &&
      matter.current_step < 9
  ).length;

  return (
    <div style={page}>
      <section style={workingFileBar}>
        <div style={workingFileText}>
          <span style={eyebrow}>CRM WORKING FILE</span>
          <span style={divider}>|</span>
          <Link href="/crm/secretarial" style={backLink}>
            Secretarial
          </Link>
          <span style={divider}>|</span>
          <strong>Share Certificates</strong>
          <span style={divider}>|</span>
          <span style={mutedText}>
            Share structure, certificates and securities register
          </span>
        </div>
      </section>

      <section style={headerPanel}>
        <div>
          <h1 style={title}>Share Certificates</h1>
          <p style={subtitle}>
            Create and control share issues, shareholder allocations,
            certificates and the company securities register.
          </p>
        </div>

        <Link
          href="/crm/secretarial/share-certificates/new"
          style={primaryButton}
        >
          New Share Certificate
        </Link>
      </section>

      {loadError ? <div style={errorBar}>{loadError}</div> : null}

      <section style={summaryStrip}>
        <div style={summaryItem}>
          <span style={summaryLabel}>OPEN WORKFLOWS</span>
          <strong style={summaryValue}>{openWorkflows}</strong>
        </div>
        <div style={summaryItem}>
          <span style={summaryLabel}>AWAITING REVIEW</span>
          <strong style={summaryValue}>{awaitingReview}</strong>
        </div>
        <div style={summaryItem}>
          <span style={summaryLabel}>ISSUED CERTIFICATES</span>
          <strong style={summaryValue}>{issuedCount}</strong>
        </div>
        <div style={summaryItemLast}>
          <span style={summaryLabel}>INCOMPLETE REGISTERS</span>
          <strong style={summaryValue}>{incompleteRegisters}</strong>
        </div>
      </section>

      <section style={contentPanel}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Share certificate workflows</h2>
            <p style={sectionSubtitle}>
              Open an existing matter or create a new share certificate workflow.
            </p>
          </div>

          <button type="button" onClick={loadPage} style={refreshButton}>
            Refresh
          </button>
        </div>

        <div style={tableHeader}>
          <div>CLIENT</div>
          <div>REGISTRATION</div>
          <div>SHAREHOLDER</div>
          <div>CERTIFICATE</div>
          <div>FLIGHT MAP</div>
          <div>STATUS</div>
          <div />
        </div>

        {loading ? (
          <div style={emptyRow}>Loading share certificate matters...</div>
        ) : rows.length === 0 ? (
          <div style={emptyRow}>
            No share certificate matters have been created yet.
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} style={tableRow}>
              <div style={clientCell}>
                <strong style={clientName}>{row.clientName}</strong>
              </div>
              <div style={tableText}>{row.registrationNumber}</div>
              <div style={tableText}>{row.shareholderName}</div>
              <div style={certificateCell}>
                {row.certificate_number || "—"}
              </div>
              <div style={flightMapCell}>
                <span style={flightMapStep}>{row.current_step}</span>
                <span style={flightMapText}>of 9</span>
              </div>
              <div>
                <span
                  style={{
                    ...statusBadge,
                    ...getStatusStyle(row.matter_status),
                  }}
                >
                  {formatStatus(row.matter_status)}
                </span>
              </div>
              <div style={actionCell}>
                <Link
                  href={`/crm/secretarial/share-certificates/${row.id}`}
                  style={textLink}
                >
                  Open
                </Link>
              </div>
            </div>
          ))
        )}
      </section>

      <section style={flightMapPanel}>
        <div style={flightMapHeader}>
          <div>
            <h2 style={sectionTitle}>Share Certificate Flight Map</h2>
            <p style={sectionSubtitle}>
              Every matter follows the same controlled PracticePilot route.
            </p>
          </div>
        </div>

        <div style={flightMap}>
          {[
            "Company details",
            "Share structure",
            "Shareholder allocation",
            "Resolution",
            "Certificate generation",
            "Review and approval",
            "Register update",
            "Egnyte filing",
            "Complete",
          ].map((step, index) => (
            <div key={step} style={flightStep}>
              <div style={stepMarker}>{index + 1}</div>
              <div style={stepLabel}>{step}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatStatus(status: string) {
  switch (status) {
    case "draft":
      return "Draft";
    case "in_progress":
      return "In progress";
    case "awaiting_review":
      return "Awaiting review";
    case "returned_for_correction":
      return "Returned";
    case "approved":
      return "Approved";
    case "completed":
      return "Completed";
    default:
      return status.replaceAll("_", " ");
  }
}

function getStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "awaiting_review":
      return {
        color: "#92400e",
        background: "#fffbeb",
        borderColor: "#fde68a",
      };
    case "approved":
    case "completed":
      return {
        color: "#166534",
        background: "#ecfdf3",
        borderColor: "#bbf7d0",
      };
    case "returned_for_correction":
      return {
        color: "#991b1b",
        background: "#fef2f2",
        borderColor: "#fecaca",
      };
    default:
      return {
        color: "#475569",
        background: "#f8fafc",
        borderColor: "#d8dee7",
      };
  }
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "8px 10px 28px",
  background: "#eef2f5",
  color: "#0f1f33",
};

const workingFileBar: React.CSSProperties = {
  minHeight: "38px",
  display: "flex",
  alignItems: "center",
  padding: "0 10px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const workingFileText: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "9px",
  fontSize: "12px",
};

const eyebrow: React.CSSProperties = {
  color: "#2457d6",
  fontWeight: 900,
  letterSpacing: "0.05em",
};

const divider: React.CSSProperties = { color: "#94a3b8" };
const mutedText: React.CSSProperties = { color: "#64748b" };

const backLink: React.CSSProperties = {
  color: "#0f1f33",
  textDecoration: "none",
  fontWeight: 900,
};

const headerPanel: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "72px",
  padding: "12px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  lineHeight: 1.2,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "12px",
  lineHeight: 1.5,
};

const primaryButton: React.CSSProperties = {
  flex: "0 0 auto",
  minHeight: "38px",
  padding: "0 15px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0f1f33",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 900,
  border: "1px solid #07111f",
};

const errorBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "10px",
  color: "#991b1b",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  fontSize: "12px",
  fontWeight: 800,
};

const summaryStrip: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const summaryItem: React.CSSProperties = {
  minHeight: "64px",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "5px",
  borderRight: "1px solid #d8dee7",
};

const summaryItemLast: React.CSSProperties = {
  ...summaryItem,
  borderRight: "none",
};

const summaryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "0.05em",
};

const summaryValue: React.CSSProperties = {
  fontSize: "20px",
  lineHeight: 1,
};

const contentPanel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const sectionHeader: React.CSSProperties = {
  minHeight: "62px",
  padding: "12px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  borderBottom: "1px solid #d8dee7",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 900,
};

const sectionSubtitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "12px",
};

const refreshButton: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  background: "#ffffff",
  color: "#0f1f33",
  border: "1px solid #cbd5e1",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(180px, 1.35fr) minmax(125px, .9fr) minmax(165px, 1.15fr) 100px 86px 110px 55px",
  alignItems: "center",
  minHeight: "34px",
  padding: "0 10px",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "0.04em",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(180px, 1.35fr) minmax(125px, .9fr) minmax(165px, 1.15fr) 100px 86px 110px 55px",
  alignItems: "center",
  minHeight: "52px",
  padding: "0 10px",
  borderBottom: "1px solid #e4e9ef",
};

const emptyRow: React.CSSProperties = {
  padding: "20px 10px",
  color: "#64748b",
  fontSize: "12px",
};

const clientCell: React.CSSProperties = {
  minWidth: 0,
  paddingRight: "8px",
};

const clientName: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "12px",
};

const tableText: React.CSSProperties = {
  minWidth: 0,
  paddingRight: "8px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#526174",
  fontSize: "11px",
};

const certificateCell: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 900,
};

const flightMapCell: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "4px",
};

const flightMapStep: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 900,
};

const flightMapText: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
};

const statusBadge: React.CSSProperties = {
  minHeight: "22px",
  padding: "0 7px",
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid",
  fontSize: "9px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const actionCell: React.CSSProperties = { textAlign: "right" };

const textLink: React.CSSProperties = {
  color: "#2457d6",
  textDecoration: "none",
  fontSize: "11px",
  fontWeight: 900,
};

const flightMapPanel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const flightMapHeader: React.CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #d8dee7",
};

const flightMap: React.CSSProperties = {
  padding: "12px 10px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px 20px",
};

const flightStep: React.CSSProperties = {
  minHeight: "34px",
  display: "grid",
  gridTemplateColumns: "26px minmax(0, 1fr)",
  alignItems: "center",
  columnGap: "8px",
};

const stepMarker: React.CSSProperties = {
  width: "24px",
  height: "24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#0f1f33",
  background: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: "50%",
  fontSize: "10px",
  fontWeight: 900,
};

const stepLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 900,
};
