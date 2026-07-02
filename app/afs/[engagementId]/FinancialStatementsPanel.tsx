"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";

type FinancialStatementsPanelProps = {
  engagementId?: string | null;
  engagement?: {
    id?: string | null;
    client_name?: string | null;
    clientName?: string | null;
    company_name?: string | null;
    companyName?: string | null;
    financial_year_end?: string | null;
    year_end?: string | null;
    [key: string]: unknown;
  } | null;
  clientSetup?: {
    registered_name?: string | null;
    registeredName?: string | null;
    company_name?: string | null;
    companyName?: string | null;
    financial_year_end?: string | null;
    year_end?: string | null;
    [key: string]: unknown;
  } | null;
  people?: unknown[] | null;
  trialBalanceLines?: unknown[] | null;
  [key: string]: unknown;
};

function extractEngagementIdFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const afsIndex = parts.findIndex((part) => part === "afs");

  if (afsIndex >= 0 && parts[afsIndex + 1]) {
    return parts[afsIndex + 1];
  }

  return "";
}

function clean(value: unknown) {
  return String(value || "").trim();
}

export default function FinancialStatementsPanel(props: FinancialStatementsPanelProps) {
  const pathname = usePathname() || "";

  const engagementId = useMemo(() => {
    return (
      clean(props.engagementId) ||
      clean(props.engagement?.id) ||
      extractEngagementIdFromPath(pathname)
    );
  }, [props.engagementId, props.engagement?.id, pathname]);

  const clientName =
    clean(props.clientSetup?.registered_name) ||
    clean(props.clientSetup?.registeredName) ||
    clean(props.clientSetup?.company_name) ||
    clean(props.clientSetup?.companyName) ||
    clean(props.engagement?.client_name) ||
    clean(props.engagement?.clientName) ||
    clean(props.engagement?.company_name) ||
    clean(props.engagement?.companyName) ||
    "AFS engagement";

  const yearEnd =
    clean(props.clientSetup?.financial_year_end) ||
    clean(props.clientSetup?.year_end) ||
    clean(props.engagement?.financial_year_end) ||
    clean(props.engagement?.year_end);

  const openPrintStudio = () => {
    if (!engagementId) return;
    window.open(`/afs/${engagementId}/print-studio`, "_blank", "noopener,noreferrer");
  };

  return (
    <section style={styles.page}>
      <div style={styles.hero}>
        <div>
          <p style={styles.kicker}>Financial Statements</p>
          <h1 style={styles.title}>{clientName}</h1>
          {yearEnd ? <p style={styles.subtitle}>Financial year end {yearEnd}</p> : null}
        </div>

        <button
          type="button"
          onClick={openPrintStudio}
          disabled={!engagementId}
          style={{
            ...styles.primaryButton,
            cursor: engagementId ? "pointer" : "not-allowed",
            opacity: engagementId ? 1 : 0.55,
          }}
        >
          Open Print Studio ↗
        </button>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    padding: 18,
    fontSize: 13,
    color: "#111827",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    padding: 16,
  },
  kicker: {
    margin: "0 0 4px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: "#2563eb",
    textTransform: "uppercase",
  },
  title: {
    margin: "0 0 4px",
    fontSize: 20,
    lineHeight: 1.2,
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.45,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    background: "#111827",
    color: "#ffffff",
    border: "1px solid #111827",
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 900,
  },
};
