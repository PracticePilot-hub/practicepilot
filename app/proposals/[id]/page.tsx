"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type ProposalStatus = "Draft" | "Sent" | "Accepted" | "Declined";

type Proposal = {
  id: string;
  proposal_number: string;
  client_name: string;
  contact_name: string | null;
  contact_email: string | null;
  status: ProposalStatus;
  proposal_date: string;
  valid_until: string;
  monthly_fee: number;
  annual_fee: number;
  once_off_fee: number;
  introduction: string | null;
  notes: string | null;
};

type ProposalService = {
  id: string;
  category: string;
  service_name: string;
  description: string | null;
  fee_type: "Monthly" | "Annual" | "Once-off";
  amount: number;
  sort_order: number;
};

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const proposalId = String(params?.id || "");

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [services, setServices] = useState<ProposalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        minimumFractionDigits: 2,
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProposal() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/proposals/${proposalId}`, {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Unable to load proposal.");
        }

        if (!cancelled) {
          setProposal(result.proposal);
          setServices(Array.isArray(result.services) ? result.services : []);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || "Unable to load proposal.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (proposalId) {
      loadProposal();
    }

    return () => {
      cancelled = true;
    };
  }, [proposalId]);

  async function updateStatus(status: ProposalStatus) {
    try {
      setStatusSaving(true);
      setError("");

      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to update proposal.");
      }

      setProposal((current) =>
        current ? { ...current, status: result.proposal.status } : current
      );
    } catch (saveError: any) {
      setError(saveError?.message || "Unable to update proposal.");
    } finally {
      setStatusSaving(false);
    }
  }

  if (loading) {
    return <main style={styles.page}>Loading proposal...</main>;
  }

  if (error && !proposal) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>{error}</div>
      </main>
    );
  }

  if (!proposal) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>Proposal not found.</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>PROPOSAL {proposal.proposal_number}</p>
          <h1 style={styles.title}>{proposal.client_name}</h1>
          <p style={styles.subtitle}>
            {proposal.contact_name || "No contact person"}
            {proposal.contact_email ? ` · ${proposal.contact_email}` : ""}
          </p>
        </div>

        <div style={styles.headerActions}>
          <Link href="/proposals" style={styles.secondaryButton}>
            Back
          </Link>

          <Link
            href={`/proposals/${proposal.id}/edit`}
            style={styles.secondaryButton}
          >
            Edit proposal
          </Link>

          <Link
            href={`/api/proposals/${proposal.id}/pdf`}
            style={styles.primaryButton}
          >
            Download PDF
          </Link>
        </div>
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <section style={styles.layout}>
        <div style={styles.mainColumn}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Proposal details</h2>
            </div>

            <div style={styles.detailGrid}>
              <div>
                <span style={styles.detailLabel}>Proposal date</span>
                <strong>{proposal.proposal_date}</strong>
              </div>

              <div>
                <span style={styles.detailLabel}>Valid until</span>
                <strong>{proposal.valid_until}</strong>
              </div>

              <div>
                <span style={styles.detailLabel}>Status</span>
                <strong>{proposal.status}</strong>
              </div>

              <div>
                <span style={styles.detailLabel}>Selected services</span>
                <strong>{services.length}</strong>
              </div>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Services included</h2>
            </div>

            <div style={styles.serviceHeader}>
              <span>Service</span>
              <span>Frequency</span>
              <span style={styles.amountHeading}>Fee</span>
            </div>

            {services.map((service) => (
              <div key={service.id} style={styles.serviceBlock}>
                <div style={styles.serviceRow}>
                  <div>
                    <strong>{service.service_name}</strong>
                    <div style={styles.category}>{service.category}</div>
                  </div>
                  <span>{service.fee_type}</span>
                  <strong style={styles.amount}>
                    {money.format(Number(service.amount || 0))}
                  </strong>
                </div>

                {service.description ? (
                  <p style={styles.description}>{service.description}</p>
                ) : null}
              </div>
            ))}
          </section>
        </div>

        <aside style={styles.summary}>
          <h2 style={styles.summaryTitle}>Fees</h2>

          <div style={styles.totalRow}>
            <span>Monthly</span>
            <strong>{money.format(Number(proposal.monthly_fee || 0))}</strong>
          </div>

          <div style={styles.totalRow}>
            <span>Annual</span>
            <strong>{money.format(Number(proposal.annual_fee || 0))}</strong>
          </div>

          <div style={styles.totalRow}>
            <span>Once-off</span>
            <strong>{money.format(Number(proposal.once_off_fee || 0))}</strong>
          </div>

          <h3 style={styles.statusTitle}>Update status</h3>

          <div style={styles.statusButtons}>
            {(["Draft", "Sent", "Accepted", "Declined"] as ProposalStatus[]).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  disabled={statusSaving || proposal.status === status}
                  onClick={() => updateStatus(status)}
                  style={{
                    ...styles.statusButton,
                    ...(proposal.status === status
                      ? styles.statusButtonActive
                      : {}),
                  }}
                >
                  {status}
                </button>
              )
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 54px)",
    padding: 28,
    background: "#f8fafc",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
    marginBottom: 22,
  },
  headerActions: {
    display: "flex",
    gap: 10,
  },
  eyebrow: {
    margin: "0 0 5px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.14em",
    color: "#2563eb",
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "#64748b",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "0 14px",
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "0 14px",
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #94a3b8",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    gap: 18,
    alignItems: "start",
  },
  mainColumn: {
    display: "grid",
    gap: 16,
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
  },
  panelHeader: {
    padding: "14px 16px",
    borderBottom: "1px solid #dbe3ef",
    background: "#f8fafc",
  },
  panelTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
    padding: 16,
  },
  detailLabel: {
    display: "block",
    marginBottom: 4,
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
  },
  serviceHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 120px 130px",
    gap: 12,
    alignItems: "center",
    minHeight: 38,
    padding: "0 14px",
    background: "#f1f5f9",
    borderBottom: "1px solid #dbe3ef",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#475569",
  },
  serviceBlock: {
    borderBottom: "1px solid #e2e8f0",
  },
  serviceRow: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 120px 130px",
    gap: 12,
    alignItems: "center",
    minHeight: 58,
    padding: "0 14px",
    fontSize: 13,
  },
  category: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
  },
  description: {
    margin: "0 14px 14px",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#475569",
  },
  amountHeading: {
    textAlign: "right",
  },
  amount: {
    textAlign: "right",
  },
  summary: {
    position: "sticky",
    top: 72,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    padding: 16,
  },
  summaryTitle: {
    margin: "0 0 12px",
    fontSize: 16,
    fontWeight: 900,
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "11px 0",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 13,
  },
  statusTitle: {
    margin: "18px 0 10px",
    fontSize: 13,
    fontWeight: 900,
  },
  statusButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  statusButton: {
    minHeight: 34,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  statusButtonActive: {
    background: "#e2e8f0",
    borderColor: "#94a3b8",
    cursor: "default",
  },
  errorBox: {
    marginBottom: 16,
    padding: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 750,
  },
};
