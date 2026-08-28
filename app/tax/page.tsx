"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const supabaseAny = supabase as any;

type Client = {
  id: string;
  client_name: string;
  registration_number: string | null;
};

type Workbench = {
  id: string;
  client_id: string;
  tax_year: number;
  provisional_period: "first" | "second" | "third";
  due_date: string | null;
  recommended_basis: string;
  recommended_taxable_income: number | null;
  recommended_provisional_payment: number | null;
  status: string;
  updated_at: string;
};

function formatMoney(value: number | null) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPeriod(value: string) {
  if (value === "first") return "First provisional";
  if (value === "second") return "Second provisional";
  if (value === "third") return "Third / top-up";
  return value;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TaxHomePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [workbenches, setWorkbenches] = useState<Workbench[]>([]);
  const [organisationId, setOrganisationId] = useState("");

  const [selectedClientId, setSelectedClientId] = useState("");
  const [taxYear, setTaxYear] = useState("2027");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabaseAny.auth.getUser();

        if (userError || !user) {
          throw new Error("Your PracticePilot login could not be confirmed.");
        }

        const { data: profile, error: profileError } = await supabaseAny
          .from("user_profiles")
          .select("organisation_id, access_enabled")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile?.access_enabled) {
          throw new Error("Your PracticePilot access is disabled.");
        }
        if (!profile?.organisation_id) {
          throw new Error("Your user profile is not linked to an organisation.");
        }

        setOrganisationId(profile.organisation_id);

        const { data: clientRows, error: clientError } = await supabaseAny
          .from("crm_clients")
          .select("id, client_name, registration_number")
          .eq("organisation_id", profile.organisation_id)
          .order("client_name", { ascending: true });

        if (clientError) throw clientError;

        const { data: workbenchRows, error: wbError } = await supabaseAny
          .from("crm_provisional_tax_workbenches")
          .select(`
            id,
            client_id,
            tax_year,
            provisional_period,
            due_date,
            recommended_basis,
            recommended_taxable_income,
            recommended_provisional_payment,
            status,
            updated_at
          `)
          .eq("organisation_id", profile.organisation_id)
          .order("updated_at", { ascending: false });

        if (wbError) throw wbError;

        setClients((clientRows || []) as Client[]);
        setWorkbenches((workbenchRows || []) as Workbench[]);
      } catch (error) {
        console.error("Could not load Tax home:", error);
        setLoadError(
          error instanceof Error ? error.message : "Could not load Tax."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const clientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return workbenches.filter((wb) => {
      const client = clientMap.get(wb.client_id);
      const matchesSearch =
        !q ||
        client?.client_name.toLowerCase().includes(q) ||
        client?.registration_number?.toLowerCase().includes(q) ||
        String(wb.tax_year).includes(q);

      const matchesStatus =
        statusFilter === "all" || wb.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [workbenches, clientMap, search, statusFilter]);

  const createHref = selectedClientId
    ? `/tax/provisional-tax?clientId=${encodeURIComponent(
        selectedClientId
      )}&taxYear=${encodeURIComponent(taxYear)}&period=first`
    : "#";

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>PRACTICEPILOT TAX</div>
          <h1 style={heroTitle}>Provisional Tax</h1>
        </div>
        <div style={heroText}>
          Prepare, review and manage provisional tax estimates and client recommendations.
        </div>
      </section>

      {loadError ? <div style={errorBox}>{loadError}</div> : null}

      <div style={workspace}>
        <aside style={leftColumn}>
          <section style={sidePanel}>
            <div style={sideTitle}>New provisional calculation</div>
            <div style={sideText}>
              Select a client and open a clean IRP6 workbench.
            </div>

            <label style={fieldLabel}>Client</label>
            <select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              style={select}
            >
              <option value="">Select client...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.client_name}
                </option>
              ))}
            </select>

            <label style={fieldLabel}>Tax year</label>
            <input
              value={taxYear}
              onChange={(event) => setTaxYear(event.target.value)}
              style={input}
              inputMode="numeric"
            />

            <label style={fieldLabel}>Period</label>
            <div style={readonlyField}>First Provisional</div>

            {selectedClientId ? (
              <Link href={createHref} style={primaryButton}>
                Create Calculation
              </Link>
            ) : (
              <div style={disabledButton}>Select a client first</div>
            )}
          </section>

          <section style={sidePanel}>
            <div style={sideTitle}>Tax control</div>
            <div style={controlRow}>
              <span>Clients available</span>
              <strong>{clients.length}</strong>
            </div>
            <div style={controlRow}>
              <span>Calculations</span>
              <strong>{workbenches.length}</strong>
            </div>
            <div style={controlRow}>
              <span>Client ready</span>
              <strong>
                {workbenches.filter((item) => item.status === "client_ready").length}
              </strong>
            </div>
          </section>
        </aside>

        <section style={mainPanel}>
          <div style={panelTop}>
            <div>
              <div style={panelTitle}>Provisional tax calculations</div>
              <div style={panelSub}>
                {loading
                  ? "Loading..."
                  : `Showing ${filtered.length} of ${workbenches.length} calculation(s)`}
              </div>
            </div>
          </div>

          <div style={filters}>
            <div style={{ flex: 1 }}>
              <div style={filterLabel}>Client / tax year</div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search calculation..."
                style={searchInput}
              />
            </div>

            <div style={{ width: 180 }}>
              <div style={filterLabel}>Status</div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={select}
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="client_ready">Client ready</option>
                <option value="approved">Approved</option>
                <option value="submitted">Submitted</option>
              </select>
            </div>
          </div>

          <div style={tableHeader}>
            <div>Client</div>
            <div>Tax year</div>
            <div>Period</div>
            <div>Basis</div>
            <div>Recommended payment</div>
            <div>Status</div>
            <div>Due date</div>
            <div></div>
          </div>

          {loading ? (
            <div style={emptyState}>Loading calculations...</div>
          ) : filtered.length === 0 ? (
            <div style={emptyState}>
              No provisional tax calculations yet. Select a client on the left to create the first one.
            </div>
          ) : (
            filtered.map((wb) => {
              const client = clientMap.get(wb.client_id);

              return (
                <div key={wb.id} style={tableRow}>
                  <div style={clientCell}>
                    <span style={entityBadge}>
                      {(client?.client_name || "PP")
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join("")}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={clientName}>{client?.client_name || "Client"}</div>
                      <div style={clientMeta}>
                        {client?.registration_number || "No registration number"}
                      </div>
                    </div>
                  </div>

                  <div>{wb.tax_year}</div>
                  <div>{formatPeriod(wb.provisional_period)}</div>
                  <div style={basisText}>
                    {wb.recommended_basis.replaceAll("_", " ")}
                  </div>
                  <div style={amountCell}>
                    {formatMoney(wb.recommended_provisional_payment)}
                  </div>
                  <div>
                    <span style={statusPill(wb.status)}>
                      {wb.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div>{formatDate(wb.due_date)}</div>
                  <div style={{ textAlign: "right" }}>
                    <Link
                      href={`/tax/provisional-tax?clientId=${encodeURIComponent(
                        wb.client_id
                      )}&taxYear=${wb.tax_year}&period=${wb.provisional_period}`}
                      style={openLink}
                    >
                      Open
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function statusPill(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 7px",
    fontSize: 10,
    fontWeight: 850,
    textTransform: "capitalize",
    border: "1px solid",
  };

  if (status === "client_ready" || status === "approved") {
    return {
      ...base,
      background: "#e8f4f0",
      borderColor: "#b9d8d2",
      color: "#2f6f67",
    };
  }

  if (status === "submitted") {
    return {
      ...base,
      background: "#edf4ff",
      borderColor: "#c8d8f3",
      color: "#2f6f67",
    };
  }

  return {
    ...base,
    background: "#f3f5f7",
    borderColor: "#d8dee7",
    color: "#5d6875",
  };
}

const navy = "#10233a";
const warm = "#f4f6f5";
const line = "#d7dfdc";

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: warm,
  padding: "20px 22px 32px",
  color: navy,
};

const hero: React.CSSProperties = {
  minHeight: 102,
  display: "grid",
  gridTemplateColumns: "1fr 1.2fr",
  alignItems: "center",
  gap: 30,
  padding: "18px 22px",
  border: `1px solid ${line}`,
  background: "#ffffff",
  marginBottom: 14,
};

const eyebrow: React.CSSProperties = {
  color: "#2f6f67",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: ".1em",
};

const heroTitle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 31,
  fontWeight: 900,
  letterSpacing: "-.025em",
};

const heroText: React.CSSProperties = {
  color: "#697586",
  fontSize: 14,
  lineHeight: 1.5,
};

const workspace: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "315px minmax(0, 1fr)",
  gap: 14,
};

const leftColumn: React.CSSProperties = {
  display: "grid",
  gap: 14,
  alignContent: "start",
};

const sidePanel: React.CSSProperties = {
  border: `1px solid ${line}`,
  background: "#ffffff",
  padding: 16,
};

const sideTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
};

const sideText: React.CSSProperties = {
  marginTop: 5,
  color: "#6d7785",
  fontSize: 11,
  lineHeight: 1.45,
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  marginTop: 15,
  marginBottom: 5,
  color: "#4f5d6d",
  fontSize: 10,
  fontWeight: 850,
};

const select: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #ccd4dd",
  background: "#ffffff",
  padding: "9px 10px",
  color: navy,
  fontSize: 11,
  fontWeight: 750,
  outline: "none",
};

const input: React.CSSProperties = {
  ...select,
};

const readonlyField: React.CSSProperties = {
  border: "1px solid #ccd4dd",
  background: "#f7f9f8",
  padding: "9px 10px",
  color: navy,
  fontSize: 11,
  fontWeight: 800,
};

const primaryButton: React.CSSProperties = {
  display: "block",
  marginTop: 16,
  padding: "10px 12px",
  background: navy,
  border: "1px solid #08172a",
  color: "#fff",
  textAlign: "center",
  textDecoration: "none",
  fontSize: 11,
  fontWeight: 850,
};

const disabledButton: React.CSSProperties = {
  marginTop: 16,
  padding: "10px 12px",
  background: "#eef2f1",
  border: `1px solid ${line}`,
  color: "#87928f",
  textAlign: "center",
  fontSize: 11,
  fontWeight: 800,
};

const controlRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #e5ebe8",
  color: "#586575",
  fontSize: 11,
};

const mainPanel: React.CSSProperties = {
  border: `1px solid ${line}`,
  background: "#ffffff",
};

const panelTop: React.CSSProperties = {
  padding: "16px 14px 12px",
};

const panelTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const panelSub: React.CSSProperties = {
  marginTop: 4,
  color: "#697586",
  fontSize: 11,
};

const filters: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "end",
  padding: "0 14px 14px",
  borderBottom: `1px solid ${line}`,
};

const filterLabel: React.CSSProperties = {
  marginBottom: 5,
  color: "#536274",
  fontSize: 10,
  fontWeight: 850,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #ccd4dd",
  padding: "9px 10px",
  fontSize: 11,
  outline: "none",
  color: navy,
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.55fr .55fr .85fr .7fr .95fr .65fr .72fr .35fr",
  gap: 10,
  alignItems: "center",
  padding: "9px 12px",
  background: "#f7f9f8",
  borderBottom: `1px solid ${line}`,
  color: "#586575",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".03em",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.55fr .55fr .85fr .7fr .95fr .65fr .72fr .35fr",
  gap: 10,
  alignItems: "center",
  minHeight: 58,
  padding: "8px 12px",
  borderBottom: "1px solid #e5ebe8",
  fontSize: 10,
};

const clientCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minWidth: 0,
};

const entityBadge: React.CSSProperties = {
  width: 30,
  height: 30,
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  background: "#edf4f2",
  border: "1px solid #d1dfdb",
  color: navy,
  fontSize: 9,
  fontWeight: 900,
};

const clientName: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const clientMeta: React.CSSProperties = {
  marginTop: 2,
  color: "#71807c",
  fontSize: 9,
};

const basisText: React.CSSProperties = {
  textTransform: "capitalize",
  fontWeight: 750,
};

const amountCell: React.CSSProperties = {
  fontWeight: 900,
};

const openLink: React.CSSProperties = {
  color: "#2f6f67",
  fontWeight: 900,
  textDecoration: "none",
};

const emptyState: React.CSSProperties = {
  padding: 34,
  textAlign: "center",
  color: "#7a8491",
  fontSize: 11,
};

const errorBox: React.CSSProperties = {
  marginBottom: 14,
  padding: "11px 13px",
  border: "1px solid #e4a0a0",
  background: "#fff3f3",
  color: "#9f2d2d",
  fontSize: 11,
  fontWeight: 700,
};
