"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type StaffRow = {
  user_id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  weekly_capacity_hours: number;
  mtd_available_hours: number;
  full_month_capacity_hours: number;
  hours_worked: number;
  internal_cost: number;
  charge_out_equivalent: number;
  delivery_contribution: number;
  time_load_percent: number;
  time_status: string;
  commercial_target_amount: number | null;
  commercial_target_basis: string | null;
};

type AttentionRow = {
  severity: "high" | "medium" | "info";
  title: string;
  detail: string;
};

type FlightDeckData = {
  month: {
    label: string;
    start: string;
    today: string;
    end: string;
  };
  practice: {
    monthly_target: number;
    desired_recurring_coverage_percent: number | null;
    recurring_base: number;
    sustainable_coverage_percent: number;
    ready_to_bill: number;
    billing_pipeline: number;
    expected_coverage_value: number;
    expected_coverage_percent: number;
    target_gap: number;
  };
  delivery: {
    total_hours_worked: number;
    total_internal_cost: number;
    total_charge_out_equivalent: number;
    total_delivery_contribution: number;
  };
  health: {
    loss_making_clients: number;
    scope_risk_clients: number;
    active_capacity_pools: number;
  };
  staff: StaffRow[];
  attention: AttentionRow[];
};

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function percent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function FlightDeckPage() {
  const [data, setData] = useState<FlightDeckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function getToken() {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not signed in.");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      const response = await fetch("/api/crm/flightdeck", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load FlightDeck.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load FlightDeck."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const highestLoad = useMemo(() => {
    if (!data?.staff?.length) return null;
    return [...data.staff].sort(
      (a, b) => b.time_load_percent - a.time_load_percent
    )[0];
  }, [data]);

  if (loading) {
    return <main style={page}><div style={loadingBox}>Loading FlightDeck...</div></main>;
  }

  if (!data) {
    return (
      <main style={page}>
        <div style={errorBox}>{error || "FlightDeck could not load."}</div>
      </main>
    );
  }

  return (
    <main style={page}>
      <section style={header}>
        <div>
          <h1 style={title}>Practice FlightDeck</h1>
          <p style={subtitle}>
            {data.month.label} · revenue sustainability, delivery economics and team capacity.
          </p>
        </div>

        <div style={headerActions}>
          <a href="/settings/flightdeck" style={secondaryButton}>
            FlightDeck Settings
          </a>
          <button type="button" onClick={load} style={secondaryButton}>
            Refresh
          </button>
        </div>
      </section>

      {error ? <div style={errorBox}>{error}</div> : null}

      <section style={practiceStrip}>
        <div style={targetHero}>
          <div style={heroLabel}>Monthly Practice Target</div>
          <div style={heroValue}>{money(data.practice.monthly_target)}</div>

          <div style={progressTrack}>
            <div
              style={{
                ...progressFill,
                width: `${Math.min(
                  100,
                  data.practice.expected_coverage_percent
                )}%`,
              }}
            />
          </div>

          <div style={heroFooter}>
            <span>
              Expected coverage{" "}
              <strong>{percent(data.practice.expected_coverage_percent)}</strong>
            </span>
            <span>
              Gap <strong>{money(data.practice.target_gap)}</strong>
            </span>
          </div>
        </div>

        <div style={practiceKpi}>
          <span style={kpiLabel}>Recurring Base</span>
          <strong style={kpiValue}>
            {money(data.practice.recurring_base)}
          </strong>
          <span style={kpiSub}>
            Sustainable coverage{" "}
            {percent(data.practice.sustainable_coverage_percent)}
          </span>
        </div>

        <div style={practiceKpi}>
          <span style={kpiLabel}>Ready to Bill</span>
          <strong style={kpiValue}>
            {money(data.practice.ready_to_bill)}
          </strong>
          <span style={kpiSub}>Revenue ready to convert</span>
        </div>

        <div style={practiceKpi}>
          <span style={kpiLabel}>Delivery Contribution</span>
          <strong style={kpiValue}>
            {money(data.delivery.total_delivery_contribution)}
          </strong>
          <span style={kpiSub}>
            Charge-out equivalent less staff cost
          </span>
        </div>

        <div style={practiceKpi}>
          <span style={kpiLabel}>Hours Worked MTD</span>
          <strong style={kpiValue}>
            {data.delivery.total_hours_worked.toFixed(1)}h
          </strong>
          <span style={kpiSub}>
            Internal cost {money(data.delivery.total_internal_cost)}
          </span>
        </div>
      </section>

      <div style={twoColumn}>
        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Attention Required</h2>
              <p style={panelSub}>
                What needs management attention now.
              </p>
            </div>
          </div>

          {data.attention.length ? (
            <div>
              {data.attention.map((item, index) => (
                <div key={`${item.title}-${index}`} style={attentionRow}>
                  <span
                    style={{
                      ...attentionDot,
                      ...(item.severity === "high"
                        ? attentionHigh
                        : item.severity === "medium"
                        ? attentionMedium
                        : attentionInfo),
                    }}
                  />
                  <div>
                    <strong style={attentionTitle}>{item.title}</strong>
                    <p style={attentionDetail}>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={emptyState}>Nothing currently needs attention.</div>
          )}
        </section>

        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Practice Pulse</h2>
              <p style={panelSub}>
                Fast read of sustainability and delivery pressure.
              </p>
            </div>
          </div>

          <div style={pulseGrid}>
            <div style={pulseRow}>
              <span>Recurring coverage</span>
              <strong>{percent(data.practice.sustainable_coverage_percent)}</strong>
            </div>
            <div style={pulseRow}>
              <span>Billing pipeline</span>
              <strong>{money(data.practice.billing_pipeline)}</strong>
            </div>
            <div style={pulseRow}>
              <span>Loss-making retainers</span>
              <strong>{data.health.loss_making_clients}</strong>
            </div>
            <div style={pulseRow}>
              <span>Retainers under pressure</span>
              <strong>{data.health.scope_risk_clients}</strong>
            </div>
            <div style={pulseRow}>
              <span>Active client/group capacity pools</span>
              <strong>{data.health.active_capacity_pools}</strong>
            </div>
            <div style={pulseRow}>
              <span>Highest team load</span>
              <strong>
                {highestLoad
                  ? `${highestLoad.full_name} · ${percent(
                      highestLoad.time_load_percent
                    )}`
                  : "—"}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <h2 style={panelTitle}>Staff Silos</h2>
            <p style={panelSub}>
              Time capacity, actual delivery and economic contribution this month.
            </p>
          </div>
        </div>

        <div style={staffHeader}>
          <span>Team member</span>
          <span>Weekly Capacity</span>
          <span>MTD Available</span>
          <span>Hours Worked</span>
          <span>Time Load</span>
          <span>Internal Cost</span>
          <span>Charge-out Eq.</span>
          <span>Contribution</span>
          <span>Commercial Target</span>
          <span>Status</span>
        </div>

        {data.staff.map((row) => (
          <div key={row.user_id} style={staffRow}>
            <span>
              <strong style={staffName}>{row.full_name}</strong>
              <span style={staffMeta}>{row.role || "Staff"}</span>
            </span>

            <span>{row.weekly_capacity_hours.toFixed(1)}h</span>
            <span>{row.mtd_available_hours.toFixed(1)}h</span>
            <strong>{row.hours_worked.toFixed(1)}h</strong>

            <span>
              <span style={loadBarTrack}>
                <span
                  style={{
                    ...loadBarFill,
                    width: `${Math.min(100, row.time_load_percent)}%`,
                  }}
                />
              </span>
              <strong style={loadNumber}>
                {percent(row.time_load_percent)}
              </strong>
            </span>

            <span>{money(row.internal_cost)}</span>
            <span>{money(row.charge_out_equivalent)}</span>
            <strong>{money(row.delivery_contribution)}</strong>

            <span>
              {row.commercial_target_amount == null
                ? "No target"
                : money(row.commercial_target_amount)}
            </span>

            <span
              style={{
                ...statusPill,
                ...(row.time_load_percent > 100
                  ? statusHigh
                  : row.time_load_percent >= 90
                  ? statusMedium
                  : statusGood),
              }}
            >
              {row.time_status}
            </span>
          </div>
        ))}
      </section>

      <div style={footNote}>
        <strong>Current FlightDeck basis:</strong>{" "}
        recurring revenue is contracted monthly-equivalent commercial terms.
        Ready-to-bill is current Billable WIP. Actual invoiced revenue will be added
        when the billing/invoice source is connected, so PP will not pretend
        contracted revenue equals cash or invoiced revenue.
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "14px 16px 24px",
  background: "#f3f6f9",
  color: "#10233a",
};

const header: React.CSSProperties = {
  minHeight: "48px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: "9px",
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: "6px",
};

const secondaryButton: React.CSSProperties = {
  minHeight: "28px",
  padding: "0 9px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const practiceStrip: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "1.45fr repeat(4, minmax(0, 1fr))",
  gap: "7px",
};

const targetHero: React.CSSProperties = {
  minHeight: "96px",
  padding: "10px",
  background: "#10233a",
  color: "#ffffff",
  border: "1px solid #10233a",
};

const heroLabel: React.CSSProperties = {
  fontSize: "8px",
  fontWeight: 850,
  opacity: 0.78,
};

const heroValue: React.CSSProperties = {
  marginTop: "3px",
  fontSize: "22px",
  fontWeight: 900,
};

const progressTrack: React.CSSProperties = {
  height: "7px",
  marginTop: "10px",
  background: "rgba(255,255,255,.16)",
  overflow: "hidden",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  background: "#ffffff",
};

const heroFooter: React.CSSProperties = {
  marginTop: "7px",
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  fontSize: "7.5px",
  opacity: 0.9,
};

const practiceKpi: React.CSSProperties = {
  minHeight: "96px",
  padding: "9px",
  display: "grid",
  alignContent: "center",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const kpiLabel: React.CSSProperties = {
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const kpiValue: React.CSSProperties = {
  marginTop: "3px",
  color: "#10233a",
  fontSize: "17px",
  fontWeight: 900,
};

const kpiSub: React.CSSProperties = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "7.5px",
  lineHeight: 1.35,
};

const twoColumn: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "1.35fr .85fr",
  gap: "8px",
};

const panel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const panelHeader: React.CSSProperties = {
  minHeight: "44px",
  padding: "7px 9px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #d8dee7",
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 900,
};

const panelSub: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "8px",
};

const attentionRow: React.CSSProperties = {
  minHeight: "48px",
  padding: "7px 9px",
  display: "grid",
  gridTemplateColumns: "10px minmax(0,1fr)",
  gap: "7px",
  alignItems: "start",
  borderBottom: "1px solid #e5eaf0",
};

const attentionDot: React.CSSProperties = {
  width: "7px",
  height: "7px",
  marginTop: "4px",
  borderRadius: "50%",
};

const attentionHigh: React.CSSProperties = { background: "#b42318" };
const attentionMedium: React.CSSProperties = { background: "#b7791f" };
const attentionInfo: React.CSSProperties = { background: "#1758d5" };

const attentionTitle: React.CSSProperties = {
  display: "block",
  fontSize: "8.5px",
  fontWeight: 900,
};

const attentionDetail: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "7.5px",
  lineHeight: 1.4,
};

const pulseGrid: React.CSSProperties = {
  display: "grid",
};

const pulseRow: React.CSSProperties = {
  minHeight: "35px",
  padding: "0 9px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  borderBottom: "1px solid #e5eaf0",
  color: "#526174",
  fontSize: "8px",
};

const staffHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(160px,1.3fr) 92px 92px 84px 115px 105px 105px 105px 115px 110px",
  gap: "6px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "7px",
  fontWeight: 850,
};

const staffRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(160px,1.3fr) 92px 92px 84px 115px 105px 105px 105px 115px 110px",
  gap: "6px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "7.5px",
};

const staffName: React.CSSProperties = {
  display: "block",
  fontSize: "8.5px",
  fontWeight: 900,
};

const staffMeta: React.CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7px",
};

const loadBarTrack: React.CSSProperties = {
  width: "64px",
  height: "5px",
  display: "inline-block",
  verticalAlign: "middle",
  background: "#e5eaf0",
  overflow: "hidden",
};

const loadBarFill: React.CSSProperties = {
  height: "100%",
  display: "block",
  background: "#1758d5",
};

const loadNumber: React.CSSProperties = {
  marginLeft: "5px",
  fontSize: "7.5px",
};

const statusPill: React.CSSProperties = {
  minHeight: "20px",
  padding: "0 6px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid transparent",
  fontSize: "7px",
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const statusGood: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const statusMedium: React.CSSProperties = {
  color: "#8a5a00",
  background: "#fff8e6",
  borderColor: "#f0c36b",
};

const statusHigh: React.CSSProperties = {
  color: "#991b1b",
  background: "#fff1f2",
  borderColor: "#fecaca",
};

const emptyState: React.CSSProperties = {
  padding: "14px 9px",
  color: "#64748b",
  fontSize: "8px",
};

const errorBox: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: "8px",
  fontWeight: 800,
};

const loadingBox: React.CSSProperties = {
  padding: "18px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
  color: "#64748b",
  fontSize: "9px",
};

const footNote: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  borderLeft: "3px solid #1758d5",
  background: "#f4f8fc",
  color: "#526174",
  fontSize: "7.5px",
  lineHeight: 1.45,
};
