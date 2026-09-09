// Path: app/assets/page.tsx

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type CRMClient = {
  id: string;
  client_name: string;
  registration_number: string | null;
  id_passport_number: string | null;
  entity_type: string | null;
  status: string | null;
};

type AssetRow = {
  id: string;
  client_id: string;
  cost: number | string | null;
  opening_accumulated_depreciation: number | string | null;
  status: string | null;
};

type DepreciationRun = {
  client_id: string;
  period_end: string;
  status: string;
};

type ClientAssetSummary = CRMClient & {
  assetCount: number;
  carryingAmount: number;
  lastDepreciationRun: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "Not run";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function AssetsClientsPage() {
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [runs, setRuns] = useState<DepreciationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setLoadError("");

    try {
      const [
        { data: clientData, error: clientError },
        { data: assetData, error: assetError },
        { data: runData, error: runError },
      ] = await Promise.all([
        supabase
          .from("crm_clients")
          .select(`
            id,
            client_name,
            registration_number,
            id_passport_number,
            entity_type,
            status
          `)
          .order("client_name", { ascending: true }),

        supabase
          .from("assets")
          .select(`
            id,
            client_id,
            cost,
            opening_accumulated_depreciation,
            status
          `),

        supabase
          .from("asset_depreciation_runs")
          .select(`
            client_id,
            period_end,
            status
          `)
          .in("status", ["calculated", "posted"])
          .order("period_end", { ascending: false }),
      ]);

      if (clientError) throw clientError;
      if (assetError) throw assetError;
      if (runError) throw runError;

      setClients(
        ((clientData || []) as CRMClient[]).filter((client) =>
          client.client_name?.trim()
        )
      );
      setAssets((assetData || []) as AssetRow[]);
      setRuns((runData || []) as DepreciationRun[]);
    } catch (error) {
      console.error("Could not load Assets client list:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load Assets client list."
      );
    } finally {
      setLoading(false);
    }
  }

  const summaries = useMemo<ClientAssetSummary[]>(() => {
    return clients.map((client) => {
      const clientAssets = assets.filter(
        (asset) =>
          asset.client_id === client.id &&
          asset.status !== "disposed" &&
          asset.status !== "scrapped"
      );

      const assetCount = clientAssets.length;

      // Until depreciation run lines are live, use captured cost less opening
      // accumulated depreciation as the current register carrying amount.
      // Step 4 will replace this with calculated current carrying values.
      const carryingAmount = clientAssets.reduce((total, asset) => {
        const cost = Number(asset.cost || 0);
        const openingAccumulatedDepreciation = Number(
          asset.opening_accumulated_depreciation || 0
        );

        return total + (cost - openingAccumulatedDepreciation);
      }, 0);

      const lastRun =
        runs.find((run) => run.client_id === client.id) || null;

      return {
        ...client,
        assetCount,
        carryingAmount,
        lastDepreciationRun: lastRun?.period_end || null,
      };
    });
  }, [clients, assets, runs]);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    return summaries.filter((client) => {
      const registration =
        client.registration_number || client.id_passport_number || "";

      const matchesSearch =
        !term ||
        client.client_name.toLowerCase().includes(term) ||
        registration.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        (client.status || "active").toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [summaries, search, statusFilter]);

  return (
    <main style={styles.page}>
      <div style={styles.workingFileBar}>
        <div style={styles.workingFileLabel}>ASSETS</div>
        <div style={styles.divider}>|</div>
        <div style={styles.workingFileTitle}>Client Asset Registers</div>
        <div style={styles.divider}>|</div>
        <div style={styles.workingFileMeta}>Practice client master</div>
        <div style={styles.countBadge}>
          {filteredClients.length} clients
        </div>
      </div>

      <div style={styles.sectionTopBar}>
        <div>
          <div style={styles.sectionTitle}>Client Asset Registers</div>
          <div style={styles.sectionSubtitle}>
            Select a client to open and maintain its fixed asset register.
          </div>
        </div>

        <div style={styles.filters}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client or registration number"
            style={styles.searchInput}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={styles.select}
          >
            <option value="active">Active clients</option>
            <option value="all">All clients</option>
            <option value="inactive">Inactive clients</option>
          </select>
        </div>
      </div>

      {loadError ? (
        <div style={styles.errorBox}>{loadError}</div>
      ) : (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h1 style={styles.heading}>Asset Registers</h1>
              <p style={styles.headingSubtext}>
                Asset counts and carrying amounts are summarised per client.
              </p>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Registration / ID Number</th>
                  <th style={styles.th}>Entity Type</th>
                  <th style={styles.thRight}>Assets</th>
                  <th style={styles.thRight}>Carrying Amount</th>
                  <th style={styles.th}>Last Depreciation Run</th>
                  <th style={styles.thAction}></th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td style={styles.emptyCell} colSpan={7}>
                      Loading client asset registers...
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td style={styles.emptyCell} colSpan={7}>
                      No matching clients found.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr key={client.id}>
                      <td style={styles.tdClient}>
                        <strong>{client.client_name}</strong>
                      </td>

                      <td style={styles.td}>
                        {client.registration_number ||
                          client.id_passport_number ||
                          "-"}
                      </td>

                      <td style={styles.td}>
                        {client.entity_type || "-"}
                      </td>

                      <td style={styles.tdRight}>
                        {client.assetCount}
                      </td>

                      <td style={styles.tdRight}>
                        {money(client.carryingAmount)}
                      </td>

                      <td style={styles.td}>
                        {formatDate(client.lastDepreciationRun)}
                      </td>

                      <td style={styles.tdAction}>
                        <Link
                          href={`/assets/${client.id}`}
                          style={styles.openButton}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    padding: "24px 28px 40px",
    color: "#17324d",
  },

  workingFileBar: {
    minHeight: "42px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 14px",
    border: "1px solid #cbd5df",
    background: "#ffffff",
    fontSize: "12px",
  },

  workingFileLabel: {
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: "#17324d",
  },

  workingFileTitle: {
    fontWeight: 800,
  },

  workingFileMeta: {
    color: "#617487",
  },

  divider: {
    color: "#a6b3bf",
  },

  countBadge: {
    marginLeft: "auto",
    fontWeight: 800,
    color: "#17324d",
  },

  sectionTopBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "20px",
    margin: "22px 0 14px",
  },

  sectionTitle: {
    fontSize: "20px",
    fontWeight: 900,
  },

  sectionSubtitle: {
    marginTop: "4px",
    fontSize: "13px",
    color: "#617487",
  },

  filters: {
    display: "flex",
    gap: "8px",
  },

  searchInput: {
    width: "330px",
    height: "36px",
    border: "1px solid #b7c4cf",
    background: "#ffffff",
    padding: "0 10px",
    outline: "none",
    color: "#17324d",
  },

  select: {
    height: "36px",
    minWidth: "150px",
    border: "1px solid #b7c4cf",
    background: "#ffffff",
    padding: "0 10px",
    color: "#17324d",
  },

  errorBox: {
    border: "1px solid #d4a5a5",
    background: "#fff6f6",
    padding: "12px",
    fontSize: "13px",
  },

  panel: {
    border: "1px solid #cbd5df",
    background: "#ffffff",
  },

  panelHeader: {
    padding: "14px 16px",
    borderBottom: "1px solid #dbe2e8",
  },

  heading: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 900,
  },

  headingSubtext: {
    margin: "3px 0 0",
    fontSize: "12px",
    color: "#6a7d8e",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },

  th: {
    textAlign: "left",
    padding: "9px 10px",
    borderBottom: "1px solid #cbd5df",
    background: "#edf2f6",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  thRight: {
    textAlign: "right",
    padding: "9px 10px",
    borderBottom: "1px solid #cbd5df",
    background: "#edf2f6",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  thAction: {
    width: "80px",
    padding: "9px 10px",
    borderBottom: "1px solid #cbd5df",
    background: "#edf2f6",
  },

  td: {
    padding: "9px 10px",
    borderBottom: "1px solid #e1e6eb",
    verticalAlign: "middle",
  },

  tdClient: {
    padding: "9px 10px",
    borderBottom: "1px solid #e1e6eb",
    verticalAlign: "middle",
  },

  tdRight: {
    padding: "9px 10px",
    borderBottom: "1px solid #e1e6eb",
    verticalAlign: "middle",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },

  tdAction: {
    padding: "7px 10px",
    borderBottom: "1px solid #e1e6eb",
    textAlign: "right",
  },

  emptyCell: {
    padding: "28px 12px",
    textAlign: "center",
    color: "#6a7d8e",
  },

  openButton: {
    display: "inline-block",
    border: "1px solid #17324d",
    padding: "5px 10px",
    textDecoration: "none",
    color: "#17324d",
    background: "#ffffff",
    fontWeight: 800,
  },
};
