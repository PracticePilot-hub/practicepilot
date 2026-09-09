"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

function getStoredAccessToken() {
  if (typeof window === "undefined") return "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    const rawSession = window.localStorage.getItem(storageKey);

    if (!rawSession) return "";

    const parsed = JSON.parse(rawSession);

    return String(
      parsed?.access_token ||
      parsed?.currentSession?.access_token ||
      parsed?.session?.access_token ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

type ProposalStatus = "Draft" | "Sent" | "Accepted" | "Declined";

type Proposal = {
  id: string;
  proposalNumber: string;
  clientName: string;
  contactName: string;
  createdDate: string;
  validUntil: string;
  status: ProposalStatus;
  monthlyFee: number;
  annualFee: number;
  onceOffFee: number;
};

export default function ProposalsPage() {
  const router = useRouter();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ProposalStatus>("All");
  const [duplicatingId, setDuplicatingId] = useState("");

  const visibleProposals = useMemo(() => {
    const normalisedSearch = search.trim().toLowerCase();

    return proposals.filter((proposal) => {
      const matchesSearch =
        !normalisedSearch ||
        proposal.clientName.toLowerCase().includes(normalisedSearch) ||
        proposal.proposalNumber.toLowerCase().includes(normalisedSearch) ||
        proposal.contactName.toLowerCase().includes(normalisedSearch);

      const matchesStatus =
        statusFilter === "All" || proposal.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [proposals, search, statusFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadProposals() {
      try {
        setLoading(true);
        setLoadError("");

        const response = await fetch("/api/proposals", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Unable to load proposals.");
        }

        const rows = Array.isArray(result.proposals) ? result.proposals : [];

        if (!cancelled) {
          setProposals(
            rows.map((proposal: any) => ({
              id: String(proposal.id),
              proposalNumber: proposal.proposal_number || "",
              clientName: proposal.client_name || "",
              contactName: proposal.contact_name || "",
              createdDate: proposal.proposal_date || "",
              validUntil: proposal.valid_until || "",
              status: proposal.status || "Draft",
              monthlyFee: Number(proposal.monthly_fee || 0),
              annualFee: Number(proposal.annual_fee || 0),
              onceOffFee: Number(proposal.once_off_fee || 0),
            }))
          );
        }
      } catch (error: any) {
        if (!cancelled) {
          setLoadError(error?.message || "Unable to load proposals.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProposals();

    return () => {
      cancelled = true;
    };
  }, []);

  async function duplicateProposal(proposalId: string) {
    try {
      setDuplicatingId(proposalId);
      setLoadError("");

      const accessToken = getStoredAccessToken();

      if (!accessToken) {
        throw new Error("Your login session could not be confirmed.");
      }

      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "duplicate",
          proposalId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.proposal_id) {
        throw new Error(result?.error || "Unable to duplicate proposal.");
      }

      router.push(`/proposals/${result.proposal_id}`);
    } catch (error: any) {
      setLoadError(error?.message || "Unable to duplicate proposal.");
      setDuplicatingId("");
    }
  }

  const money = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  });

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>PRACTICEPILOT</p>
          <h1 style={styles.title}>Proposals</h1>
          <p style={styles.subtitle}>
            Create, issue and track client proposals from one place.
          </p>
        </div>

        <Link href="/proposals/new" style={styles.primaryButton}>
          Create proposal
        </Link>
      </section>

      <section style={styles.toolbar}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by client, contact or proposal number"
          style={styles.searchInput}
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "All" | ProposalStatus)
          }
          style={styles.select}
        >
          <option value="All">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Accepted">Accepted</option>
          <option value="Declined">Declined</option>
        </select>
      </section>

      {loadError ? <div style={styles.errorBox}>{loadError}</div> : null}

      <section style={styles.tableShell}>
        <div style={styles.tableHeader}>
          <span>Proposal</span>
          <span>Client</span>
          <span>Created</span>
          <span>Valid until</span>
          <span>Status</span>
          <span style={styles.amountHeading}>Monthly fee</span>
          <span style={styles.amountHeading}>Annual fee</span>
          <span style={styles.amountHeading}>Once-off fee</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div style={styles.emptyState}>
            <h2 style={styles.emptyTitle}>Loading proposals...</h2>
          </div>
        ) : visibleProposals.length === 0 ? (
          <div style={styles.emptyState}>
            <h2 style={styles.emptyTitle}>No proposals found</h2>
            <p style={styles.emptyText}>
              Create the first client proposal, or adjust the current search and status filter.
            </p>
            <Link href="/proposals/new" style={styles.secondaryButton}>
              Create proposal
            </Link>
          </div>
        ) : (
          visibleProposals.map((proposal) => (
            <div key={proposal.id} style={styles.tableRow}>
              <strong>{proposal.proposalNumber}</strong>
              <div>
                <strong>{proposal.clientName}</strong>
                <div style={styles.muted}>{proposal.contactName}</div>
              </div>
              <span>{proposal.createdDate}</span>
              <span>{proposal.validUntil}</span>
              <span>{proposal.status}</span>
              <span style={styles.amount}>
                {money.format(proposal.monthlyFee)}
              </span>
              <span style={styles.amount}>
                {money.format(proposal.annualFee)}
              </span>
              <span style={styles.amount}>
                {money.format(proposal.onceOffFee)}
              </span>

              <div style={styles.actions}>
                <Link href={`/proposals/${proposal.id}`} style={styles.viewLink}>
                  Open
                </Link>

                <button
                  type="button"
                  onClick={() => duplicateProposal(proposal.id)}
                  disabled={duplicatingId === proposal.id}
                  style={{
                    ...styles.duplicateButton,
                    ...(duplicatingId === proposal.id
                      ? styles.duplicateButtonDisabled
                      : {}),
                  }}
                >
                  {duplicatingId === proposal.id ? "Duplicating..." : "Duplicate"}
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 54px)",
    background: "#f8fafc",
    padding: "28px",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
    marginBottom: 22,
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
    minHeight: 40,
    padding: "0 16px",
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
    border: "1px solid #0f172a",
  },
  toolbar: {
    display: "flex",
    gap: 10,
    padding: 12,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderBottom: 0,
  },
  searchInput: {
    flex: "1 1 auto",
    minWidth: 0,
    height: 38,
    border: "1px solid #cbd5e1",
    padding: "0 11px",
    fontSize: 13,
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
  },
  select: {
    width: 170,
    height: 38,
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    fontSize: 13,
    background: "#ffffff",
    color: "#0f172a",
  },
  errorBox: {
    marginBottom: 12,
    padding: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 750,
  },
  tableShell: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    overflowX: "auto",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns:
      "120px minmax(220px, 1.4fr) 110px 110px 95px 115px 115px 115px 150px",
    gap: 12,
    alignItems: "center",
    minHeight: 42,
    padding: "0 14px",
    borderBottom: "1px solid #dbe3ef",
    background: "#f1f5f9",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#475569",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns:
      "120px minmax(220px, 1.4fr) 110px 110px 95px 115px 115px 115px 150px",
    gap: 12,
    alignItems: "center",
    minHeight: 58,
    padding: "0 14px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 13,
  },
  amountHeading: {
    textAlign: "right",
  },
  amount: {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  muted: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  viewLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },
  duplicateButton: {
    minHeight: 30,
    padding: "0 9px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
  },
  duplicateButtonDisabled: {
    opacity: 0.55,
    cursor: "default",
  },
  emptyState: {
    display: "grid",
    justifyItems: "center",
    padding: "70px 20px",
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    fontSize: 19,
    fontWeight: 900,
  },
  emptyText: {
    maxWidth: 470,
    margin: "8px 0 18px",
    fontSize: 13,
    lineHeight: 1.55,
    color: "#64748b",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    padding: "0 14px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  },
};
