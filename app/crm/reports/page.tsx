"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type ClientWipRow = {
  client_id: string;
  client_name: string;
  total_hours: number;
  total_staff_cost: number;
  total_charge_value: number;
  work_items_touched: number;
  time_entries: number;
  included_hours: number;
  included_staff_cost: number;
  billable_hours: number;
  billable_internal_cost: number;
  billable_wip_value: number;
  billable_items: number;
  unclassified_hours: number;
  unclassified_staff_cost: number;
};

type StaffWipRow = {
  user_id: string;
  staff_name: string | null;
  staff_email: string | null;
  total_hours: number;
  total_staff_cost: number;
  total_charge_value: number;
  clients_worked_on: number;
  work_items_touched: number;
};

type Totals = {
  total_hours: number;
  total_staff_cost: number;
  total_charge_value: number;
  wip_contribution: number;
  included_hours: number;
  included_staff_cost: number;
  billable_hours: number;
  billable_internal_cost: number;
  billable_wip_value: number;
  billable_items: number;
  billable_clients: number;
  unclassified_hours: number;
  unclassified_staff_cost: number;
};

type ClientEconomicsRow = {
  client_id: string;
  client_name: string;
  client_code: string | null;
  entity_type: string | null;
  commercial_model: string | null;
  core_fee_amount: number | null;
  billing_frequency: string | null;
  monthly_fee_equivalent: number | null;
  tracked_hours: number;
  internal_staff_cost: number;
  charge_out_equivalent: number;
  contribution_amount: number | null;
  effective_recovery_percent: number | null;
  retainer_health_status:
    | "healthy"
    | "watch"
    | "scope_creep_risk"
    | "loss_making"
    | "terms_incomplete";
  included_services: string[];
  separately_billable_services: string[];
  billing_notes: string | null;
};

type ClientEconomicsSummary = {
  total_clients: number;
  healthy: number;
  watch: number;
  scope_creep_risk: number;
  loss_making: number;
  terms_incomplete: number;
  average_effective_recovery: number;
  unbilled_ad_hoc_value: number;
};

type BillingWorkRow = {
  work_item_id: string;
  client_id: string;
  client_name: string;
  work_title: string;
  service_code: string | null;
  work_status: string;
  resolved_billing_treatment: string;
  billing_status: string;
  total_hours: number;
  total_internal_cost: number;
  suggested_billable_value: number;
  invoice_reference: string | null;
  billed_amount: number | null;
  billed_at: string | null;
  first_time_entry_at: string | null;
  last_time_entry_at: string | null;
};

type BillingSummary = {
  ready_to_bill_value: number;
  ready_to_bill_items: number;
  ready_to_bill_clients: number;
  overdue_value: number;
  overdue_items: number;
  drafted_value: number;
};

type ViewKey =
  | "wip"
  | "billing"
  | "profitability"
  | "next7"
  | "next30"
  | "comparison";

function money(value: number) {
  return Number(value || 0).toLocaleString("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  });
}

function percent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}


async function readJsonResponse(response: Response, label: string) {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  if (!contentType.includes("application/json")) {
    const preview = raw.replace(/\s+/g, " ").slice(0, 140);
    throw new Error(
      `${label} returned a non-JSON response (${response.status}). ${preview}`
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `${label} returned invalid JSON (${response.status}).`
    );
  }
}

export default function PracticeReportsPage() {
  const [clients, setClients] = useState<ClientWipRow[]>([]);
  const [staff, setStaff] = useState<StaffWipRow[]>([]);
  const [totals, setTotals] = useState<Totals>({
    total_hours: 0,
    total_staff_cost: 0,
    total_charge_value: 0,
    wip_contribution: 0,
    included_hours: 0,
    included_staff_cost: 0,
    billable_hours: 0,
    billable_internal_cost: 0,
    billable_wip_value: 0,
    billable_items: 0,
    billable_clients: 0,
    unclassified_hours: 0,
    unclassified_staff_cost: 0,
  });

  const [view, setView] = useState<ViewKey>("wip");
  const [search, setSearch] = useState("");

  const [economicsRows, setEconomicsRows] = useState<ClientEconomicsRow[]>([]);
  const [economicsSummary, setEconomicsSummary] =
    useState<ClientEconomicsSummary>({
      total_clients: 0,
      healthy: 0,
      watch: 0,
      scope_creep_risk: 0,
      loss_making: 0,
      terms_incomplete: 0,
      average_effective_recovery: 0,
      unbilled_ad_hoc_value: 0,
    });
  const [economicsFilter, setEconomicsFilter] = useState<
    "retainer" | "all"
  >("retainer");
  const [selectedEconomicsClientId, setSelectedEconomicsClientId] =
    useState("");

  const [billingRows, setBillingRows] = useState<BillingWorkRow[]>([]);
  const [billingSummary, setBillingSummary] = useState<BillingSummary>({
    ready_to_bill_value: 0,
    ready_to_bill_items: 0,
    ready_to_bill_clients: 0,
    overdue_value: 0,
    overdue_items: 0,
    drafted_value: 0,
  });
  const [billingSearch, setBillingSearch] = useState("");
  const [billingFilter, setBillingFilter] = useState<
    "all" | "ready" | "drafted" | "overdue" | "not_ready"
  >("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!supabase) return;

    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You are not signed in.");
      }

      const [wipResponse, economicsResponse, billingResponse] =
        await Promise.all([
          fetch("/api/crm/reports/wip", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }),
          fetch("/api/crm/reports/client-economics", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }),
          fetch("/api/crm/reports/revenue-planner", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }),
        ]);

      const loadErrors: string[] = [];

      try {
        const wipResult = await readJsonResponse(
          wipResponse,
          "WIP report"
        );

        if (!wipResponse.ok || !wipResult?.success) {
          throw new Error(
            wipResult?.error || `WIP report failed (${wipResponse.status}).`
          );
        }

        setClients(wipResult.clients || []);
        setStaff(wipResult.staff || []);
        setTotals(wipResult.totals || {});
      } catch (wipError: any) {
        loadErrors.push(
          wipError?.message || "WIP report could not load."
        );
      }

      try {
        const economicsResult = await readJsonResponse(
          economicsResponse,
          "Client Economics"
        );

        if (!economicsResponse.ok || !economicsResult?.success) {
          throw new Error(
            economicsResult?.error ||
              `Client Economics failed (${economicsResponse.status}).`
          );
        }

        const economics =
          (economicsResult.rows || []) as ClientEconomicsRow[];

        setEconomicsRows(economics);
        setEconomicsSummary(economicsResult.summary || {});

        setSelectedEconomicsClientId((current) => {
          if (
            current &&
            economics.some((row) => row.client_id === current)
          ) {
            return current;
          }

          return economics[0]?.client_id || "";
        });
      } catch (economicsError: any) {
        loadErrors.push(
          economicsError?.message ||
            "Client Economics could not load."
        );
      }

      try {
        const billingResult = await readJsonResponse(
          billingResponse,
          "Revenue Planner"
        );

        if (!billingResponse.ok || !billingResult?.success) {
          throw new Error(
            billingResult?.error ||
              `Revenue Planner failed (${billingResponse.status}).`
          );
        }

        setBillingRows(
          (billingResult.rows || []) as BillingWorkRow[]
        );
        setBillingSummary(billingResult.summary || {});
      } catch (billingError: any) {
        loadErrors.push(
          billingError?.message ||
            "Revenue Planner could not load."
        );
      }

      if (loadErrors.length) {
        setError(loadErrors.join(" | "));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load Revenue, Billing & Capacity Planner."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    return [...clients]
      .filter((row) => !term || row.client_name.toLowerCase().includes(term))
      .sort(
        (a, b) =>
          Number(b.total_staff_cost || 0) - Number(a.total_staff_cost || 0)
      );
  }, [clients, search]);

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();

    return [...staff]
      .filter((row) => {
        const haystack = `${row.staff_name || ""} ${row.staff_email || ""}`.toLowerCase();
        return !term || haystack.includes(term);
      })
      .sort(
        (a, b) => Number(b.total_hours || 0) - Number(a.total_hours || 0)
      );
  }, [staff, search]);

  const contributionMargin =
    totals.total_charge_value > 0
      ? (totals.wip_contribution / totals.total_charge_value) * 100
      : 0;

  const filteredBillingRows = useMemo(() => {
    const term = billingSearch.trim().toLowerCase();

    return billingRows.filter((row) => {
      const ageDays = row.last_time_entry_at
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(row.last_time_entry_at).getTime()) /
                86400000
            )
          )
        : 0;

      const isOverdue =
        row.work_status === "completed" &&
        row.billing_status !== "drafted" &&
        ageDays >= 7;

      const matchesFilter =
        billingFilter === "all" ||
        (billingFilter === "ready" &&
          row.billing_status === "ready_to_bill" &&
          !isOverdue) ||
        (billingFilter === "drafted" &&
          row.billing_status === "drafted") ||
        (billingFilter === "overdue" && isOverdue) ||
        (billingFilter === "not_ready" &&
          row.billing_status === "not_ready");

      if (!matchesFilter) return false;
      if (!term) return true;

      return [
        row.client_name,
        row.work_title,
        row.service_code,
        row.billing_status,
        row.resolved_billing_treatment,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [billingRows, billingSearch, billingFilter]);

  const filteredEconomicsRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return economicsRows.filter((row) => {
      const isRetainer = ["monthly_retainer", "annual_retainer", "hybrid"].includes(
        String(row.commercial_model || "")
      );

      if (economicsFilter === "retainer" && !isRetainer) return false;

      if (!term) return true;

      return [
        row.client_name,
        row.client_code,
        row.entity_type,
        row.commercial_model,
        row.retainer_health_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [economicsRows, economicsFilter, search]);

  const selectedEconomicsClient =
    economicsRows.find(
      (row) => row.client_id === selectedEconomicsClientId
    ) || filteredEconomicsRows[0] || economicsRows[0] || null;

  const topScopeCreepClients = economicsRows
    .filter((row) =>
      ["scope_creep_risk", "watch", "loss_making"].includes(
        row.retainer_health_status
      )
    )
    .sort((a, b) => {
      const aRatio =
        a.monthly_fee_equivalent && a.monthly_fee_equivalent > 0
          ? a.internal_staff_cost / a.monthly_fee_equivalent
          : 0;
      const bRatio =
        b.monthly_fee_equivalent && b.monthly_fee_equivalent > 0
          ? b.internal_staff_cost / b.monthly_fee_equivalent
          : 0;
      return bRatio - aRatio;
    })
    .slice(0, 5);

  const topCostClients = [...clients]
    .sort(
      (a, b) =>
        Number(b.total_staff_cost || 0) - Number(a.total_staff_cost || 0)
    )
    .slice(0, 5);

  const topTeam = [...staff]
    .sort(
      (a, b) => Number(b.total_hours || 0) - Number(a.total_hours || 0)
    )
    .slice(0, 5);

  return (
    <main style={page}>
      <section style={workingBar}>
        <strong style={workingTitle}>Practice Reports</strong>
        <span style={workingDivider}>|</span>
        <span>Reporting Hub</span>
        <span style={workingDivider}>|</span>
        <span style={workingMuted}>
          WIP, billing, profitability, workload and month-on-month movement
        </span>
      </section>

      <section style={headerPanel}>
        <div>
          <h1 style={title}>Practice Reports</h1>
          <p style={subtitle}>
            Turn completed work into billing and manage the next 7 and 30 days proactively.
          </p>
        </div>

        <button type="button" style={refreshButton} onClick={() => void load()}>
          Refresh
        </button>
      </section>

      {error ? <div style={errorBar}>{error}</div> : null}

      <nav style={tabBar}>
        {[
          ["wip", "Overview"],
          ["billing", "Billing to be done"],
          ["profitability", "Client Economics"],
          ["next7", "Next 7 Days"],
          ["next30", "Next 30 Days"],
          ["comparison", "Monthly Comparison"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key as ViewKey)}
            style={{
              ...tabButton,
              ...(view === key ? activeTabButton : {}),
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === "wip" ? (
        <>
          <section style={fdHeader}>
            <div>
              <div style={fdEyebrow}>Practice Reports</div>
              <h2 style={fdTitle}>Practice FlightDeck</h2>
              <p style={fdSubtitle}>What is happening in the practice right now.</p>
            </div>
            <button type="button" onClick={load} style={fdRefresh}>Refresh</button>
          </section>

          <section style={fdKpiGrid}>
            <div style={fdKpiCard}>
              <div style={fdIconBlue}>▱</div>
              <div><span style={fdLabel}>Delivery WIP</span><strong style={fdValue}>{money(totals.total_charge_value || 0)}</strong><span style={fdMeta}>{Number(totals.total_hours || 0).toFixed(2)}h tracked</span></div>
            </div>
            <div style={fdKpiCard}>
              <div style={fdIconBlue}>▣</div>
              <div><span style={fdLabel}>Billable WIP</span><strong style={fdValue}>{money(totals.billable_wip_value || 0)}</strong><span style={fdMeta}>{totals.billable_items || 0} open items</span></div>
            </div>
            <div style={fdKpiCard}>
              <div style={fdIconRed}>!</div>
              <div><span style={fdLabel}>Revenue Leakage</span><strong style={{...fdValue,color:Number(billingSummary.overdue_value||0)>0?"#b42318":"#10233a"}}>{money(billingSummary.overdue_value || 0)}</strong><span style={fdMeta}>completed work ageing in billing</span></div>
            </div>
            <div style={fdKpiCard}>
              <div style={fdIconRed}>△</div>
              <div><span style={fdLabel}>Retainer Risk</span><strong style={fdValue}>{(economicsSummary.scope_creep_risk || 0)+(economicsSummary.loss_making || 0)} clients</strong><span style={fdMeta}>scope creep + loss-making</span></div>
            </div>
            <div style={fdKpiCard}>
              <div style={fdIconBlue}>◌</div>
              <div><span style={fdLabel}>Capacity Pressure</span><strong style={fdValue}>—</strong><span style={fdMeta}>7 day engine pending</span></div>
            </div>
            <div style={fdKpiCard}>
              <div style={fdIconBlue}>◷</div>
              <div><span style={fdLabel}>Overdue Billing</span><strong style={{...fdValue,color:Number(billingSummary.overdue_value||0)>0?"#b42318":"#10233a"}}>{money(billingSummary.overdue_value || 0)}</strong><span style={fdMeta}>{billingSummary.overdue_items || 0} overdue items</span></div>
            </div>
          </section>

          <div style={fdMainGrid}>
            <section style={fdPanel}>
              <div style={fdPanelHeader}><div><h3 style={fdPanelTitle}>Attention Required</h3><p style={fdPanelSub}>Key items that need your attention.</p></div></div>
              <div style={fdAttHeader}><span>#</span><span>Alert</span><span>Client / Context</span><span>Impact</span><span>Action</span></div>

              {Number(totals.unclassified_hours || 0) > 0 ? (
                <div style={fdAttRow}><span>1</span><span><span style={fdDotRed}/><strong>Commercial classification incomplete</strong></span><span>{Number(totals.unclassified_hours).toFixed(2)}h tracked delivery</span><span>{money(totals.unclassified_staff_cost || 0)} cost</span><a href="/crm/commercials" style={fdAction}>Review →</a></div>
              ) : null}
              {Number(billingSummary.overdue_value || 0) > 0 ? (
                <div style={fdAttRow}><span>2</span><span><span style={fdDotRed}/><strong>Overdue billing</strong></span><span>{billingSummary.overdue_items || 0} completed items</span><span>{money(billingSummary.overdue_value || 0)}</span><button type="button" onClick={()=>{setView("billing");setBillingFilter("overdue");}} style={fdActionButton}>Follow up →</button></div>
              ) : null}
              {Number(economicsSummary.loss_making || 0) > 0 ? (
                <div style={fdAttRow}><span>3</span><span><span style={fdDotRed}/><strong>Client slipping into loss</strong></span><span>{economicsSummary.loss_making || 0} clients</span><span>Internal cost exceeds fee</span><button type="button" onClick={()=>setView("profitability")} style={fdActionButton}>View →</button></div>
              ) : null}
              {Number(economicsSummary.scope_creep_risk || 0) > 0 ? (
                <div style={fdAttRow}><span>4</span><span><span style={fdDotAmber}/><strong>Retainer at risk</strong></span><span>{economicsSummary.scope_creep_risk || 0} clients</span><span>Delivery pressure building</span><button type="button" onClick={()=>setView("profitability")} style={fdActionButton}>Open →</button></div>
              ) : null}
              {Number(billingSummary.ready_to_bill_value || 0) > 0 ? (
                <div style={fdAttRow}><span>5</span><span><span style={fdDotBlue}/><strong>Unbilled ad hoc work</strong></span><span>{billingSummary.ready_to_bill_items || 0} items</span><span>{money(billingSummary.ready_to_bill_value || 0)}</span><button type="button" onClick={()=>{setView("billing");setBillingFilter("ready");}} style={fdActionButton}>Review →</button></div>
              ) : null}

              {Number(totals.unclassified_hours || 0)===0 && Number(billingSummary.overdue_value || 0)===0 && Number(economicsSummary.loss_making || 0)===0 && Number(economicsSummary.scope_creep_risk || 0)===0 && Number(billingSummary.ready_to_bill_value || 0)===0 ? <div style={fdEmpty}>No active alerts from the current reporting data.</div> : null}
            </section>

            <section style={fdPanel}>
              <div style={fdPanelHeader}><div><h3 style={fdPanelTitle}>Practice Pulse</h3><p style={fdPanelSub}>A quick health check on the practice.</p></div></div>
              <div style={fdPulseGrid}>
                <div style={fdPulseCell}><span style={fdPulseGood}>✓</span><div><span style={fdPulseLabel}>Financial Health</span><strong style={fdPulseValue}>{Number(totals.wip_contribution || 0)>=0?"On track":"Under pressure"}</strong><span style={fdPulseMeta}>{money(totals.wip_contribution || 0)} contribution equivalent</span></div></div>
                <div style={fdPulseCell}><span style={Number(economicsSummary.loss_making||0)>0?fdPulseWarn:fdPulseGood}>{Number(economicsSummary.loss_making||0)>0?"!":"✓"}</span><div><span style={fdPulseLabel}>Client Health</span><strong style={fdPulseValue}>{Number(economicsSummary.loss_making||0)>0?"Watch list":"Stable"}</strong><span style={fdPulseMeta}>{economicsSummary.scope_creep_risk||0} at risk · {economicsSummary.loss_making||0} in loss</span></div></div>
                <div style={fdPulseCell}><span style={fdPulseWarn}>!</span><div><span style={fdPulseLabel}>Team Capacity</span><strong style={fdPulseValue}>Engine pending</strong><span style={fdPulseMeta}>7 day capacity will appear here</span></div></div>
                <div style={fdPulseCell}><span style={Number(billingSummary.overdue_items||0)>0?fdPulseWarn:fdPulseGood}>{Number(billingSummary.overdue_items||0)>0?"!":"✓"}</span><div><span style={fdPulseLabel}>Billing Efficiency</span><strong style={fdPulseValue}>{Number(billingSummary.overdue_items||0)>0?"Needs attention":"Good"}</strong><span style={fdPulseMeta}>{billingSummary.overdue_items||0} overdue items</span></div></div>
              </div>
            </section>
          </div>

          <div style={fdLowerGrid}>
            <section style={fdPanel}>
              <div style={fdPanelHeader}><div><h3 style={fdPanelTitle}>Clients slipping into loss</h3><p style={fdPanelSub}>Clients where current economics need attention.</p></div><button type="button" onClick={()=>setView("profitability")} style={fdViewAll}>View all →</button></div>
              <div style={fdMiniHeader}><span>#</span><span>Client</span><span>Hours</span><span>Internal Cost</span><span>Contribution</span><span>Status</span></div>
              {economicsRows.filter((row)=>["loss_making","scope_creep_risk","watch"].includes(row.retainer_health_status)).slice(0,5).map((row,index)=>(
                <div key={row.client_id} style={fdMiniRow}><span>{index+1}</span><strong>{row.client_name}</strong><span>{Number(row.tracked_hours||0).toFixed(1)}h</span><span>{money(row.internal_staff_cost||0)}</span><strong style={{color:Number(row.contribution_amount||0)<0?"#b42318":"#166534"}}>{row.contribution_amount==null?"—":money(row.contribution_amount)}</strong><span>{row.retainer_health_status.replaceAll("_"," ")}</span></div>
              ))}
              {economicsRows.filter((row)=>["loss_making","scope_creep_risk","watch"].includes(row.retainer_health_status)).length===0 ? <div style={fdEmpty}>No clients are currently under economic pressure.</div> : null}
            </section>

            <section style={fdPanel}>
              <div style={fdPanelHeader}><div><h3 style={fdPanelTitle}>Completed ad hoc work not billed</h3><p style={fdPanelSub}>Completed work items that have not yet been billed.</p></div><button type="button" onClick={()=>setView("billing")} style={fdViewAll}>View all →</button></div>
              <div style={fdAdhocHeader}><span>#</span><span>Client</span><span>Work item</span><span>Value</span><span>Days</span></div>
              {billingRows.filter((row)=>row.work_status==="completed").slice(0,5).map((row,index)=>{
                const ageDays=row.last_time_entry_at?Math.max(0,Math.floor((Date.now()-new Date(row.last_time_entry_at).getTime())/86400000)):0;
                return <div key={row.work_item_id} style={fdAdhocRow}><span>{index+1}</span><strong>{row.client_name}</strong><span>{row.work_title}</span><strong>{money(row.suggested_billable_value||0)}</strong><strong style={{color:ageDays>=7?"#b42318":"#526174"}}>{ageDays}</strong></div>;
              })}
              {billingRows.filter((row)=>row.work_status==="completed").length===0 ? <div style={fdEmpty}>No completed ad hoc work is waiting for billing.</div> : null}
            </section>
          </div>

          <div style={fdBottomGrid}>
            <section style={fdPanel}>
              <div style={fdPanelHeader}><div><h3 style={fdPanelTitle}>Next 7 days capacity forecast</h3><p style={fdPanelSub}>Team utilisation and scheduled work.</p></div></div>
              <div style={fdPlaceholder}><span style={fdPlaceholderIcon}>▦</span><strong>Capacity engine ready for wiring</strong><span>Staff weekday availability, task estimates and client/group pools will populate this heatmap.</span></div>
            </section>

            <section style={fdPanel}>
              <div style={fdPanelHeader}><div><h3 style={fdPanelTitle}>Month-on-month trend</h3><p style={fdPanelSub}>Key practice metrics over time.</p></div></div>
              <div style={fdTrendPlaceholder}>
                <div style={fdTrendBars}>
                  <span style={{height:"28%",background:"#1d4ed8"}}/>
                  <span style={{height:"42%",background:"#60a5fa"}}/>
                  <span style={{height:"37%",background:"#1d4ed8"}}/>
                  <span style={{height:"56%",background:"#60a5fa"}}/>
                  <span style={{height:"49%",background:"#1d4ed8"}}/>
                  <span style={{height:"68%",background:"#60a5fa"}}/>
                </div>
                <span style={fdTrendLabel}>Trend engine will populate real month-on-month movement here.</span>
              </div>
            </section>
          </div>
        </>
      ) : null}

      {view === "billing" ? (
        <>
          <section style={plannerTopbar}>
            <div>
              <h2 style={plannerTitle}>Revenue, Billing & Capacity Planner</h2>
              <p style={plannerSubtitle}>
                Completed work ready for billing, capacity pressure and monthly movement in one operating view.
              </p>
            </div>

            <div style={plannerActions}>
              <button type="button" style={plannerActionButton}>
                Export Excel
              </button>
              <button type="button" style={plannerActionButton}>
                Export PDF
              </button>
            </div>
          </section>

          <section style={plannerMetricGrid}>
            <button
              type="button"
              onClick={() => setBillingFilter("ready")}
              style={plannerMetricCard}
            >
              <div style={plannerMetricIcon}>▣</div>
              <div>
                <span style={plannerMetricLabel}>Ready to Bill</span>
                <strong style={plannerMetricValue}>
                  {money(billingSummary.ready_to_bill_value || 0)}
                </strong>
                <span style={plannerMetricSub}>
                  {billingSummary.ready_to_bill_clients || 0} clients ·{" "}
                  {billingSummary.ready_to_bill_items || 0} items
                </span>
              </div>
              <span style={plannerMetricArrow}>›</span>
            </button>

            <button
              type="button"
              onClick={() => setBillingFilter("overdue")}
              style={plannerMetricCard}
            >
              <div style={{ ...plannerMetricIcon, color: "#b42318" }}>◷</div>
              <div>
                <span style={plannerMetricLabel}>Overdue Billing</span>
                <strong style={{ ...plannerMetricValue, color: "#b42318" }}>
                  {money(billingSummary.overdue_value || 0)}
                </strong>
                <span style={plannerMetricSub}>
                  {billingSummary.overdue_items || 0} items ageing 7+ days
                </span>
              </div>
              <span style={plannerMetricArrow}>›</span>
            </button>

            <div style={plannerMetricCard}>
              <div style={plannerMetricIcon}>◉</div>
              <div>
                <span style={plannerMetricLabel}>7 Day Capacity Risk</span>
                <strong style={plannerMetricValue}>—</strong>
                <span style={plannerMetricSub}>Capacity engine next</span>
              </div>
              <span style={plannerMetricArrow}>›</span>
            </div>

            <div style={plannerMetricCard}>
              <div style={plannerMetricIcon}>◉</div>
              <div>
                <span style={plannerMetricLabel}>30 Day Capacity Risk</span>
                <strong style={plannerMetricValue}>—</strong>
                <span style={plannerMetricSub}>Capacity engine next</span>
              </div>
              <span style={plannerMetricArrow}>›</span>
            </div>

            <div style={plannerMetricCard}>
              <div style={{ ...plannerMetricIcon, color: "#166534" }}>▥</div>
              <div>
                <span style={plannerMetricLabel}>Month-on-Month Change</span>
                <strong style={{ ...plannerMetricValue, color: "#166534" }}>
                  —
                </strong>
                <span style={plannerMetricSub}>Trend engine next</span>
              </div>
              <span style={plannerMetricArrow}>›</span>
            </div>
          </section>

          <section style={plannerPanel}>
            <div style={plannerPanelHeader}>
              <div>
                <h3 style={plannerPanelTitle}>Billing to be done</h3>
                <p style={plannerPanelSub}>
                  Completed work ready to be billed or overdue.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBillingFilter("all")}
                style={plannerViewAll}
              >
                View all →
              </button>
            </div>

            <div style={plannerBillingHeader}>
              <span>Client</span>
              <span>Work Performed</span>
              <span>Hours</span>
              <span>Internal Cost</span>
              <span>Charge-out Value</span>
              <span>Billing Basis</span>
              <span>Invoice Status</span>
              <span>Action</span>
            </div>

            {filteredBillingRows.length ? (
              filteredBillingRows.slice(0, 8).map((row) => {
                const ageDays = row.last_time_entry_at
                  ? Math.max(
                      0,
                      Math.floor(
                        (Date.now() -
                          new Date(row.last_time_entry_at).getTime()) /
                          86400000
                      )
                    )
                  : 0;

                const overdue =
                  row.work_status === "completed" &&
                  row.billing_status !== "drafted" &&
                  ageDays >= 7;

                return (
                  <div key={row.work_item_id} style={plannerBillingRow}>
                    <strong>{row.client_name}</strong>

                    <div>
                      <strong style={plannerWorkTitle}>{row.work_title}</strong>
                      <span style={plannerWorkSub}>
                        {row.service_code || "Client work"}
                      </span>
                    </div>

                    <span>{Number(row.total_hours || 0).toFixed(2)}</span>
                    <span>{money(row.total_internal_cost || 0)}</span>
                    <strong>{money(row.suggested_billable_value || 0)}</strong>

                    <span style={{ textTransform: "capitalize" }}>
                      {String(row.resolved_billing_treatment || "—").replaceAll(
                        "_",
                        " "
                      )}
                    </span>

                    <span
                      style={{
                        ...plannerStatus,
                        ...(overdue
                          ? plannerStatusOverdue
                          : row.billing_status === "drafted"
                          ? plannerStatusDrafted
                          : plannerStatusReady),
                      }}
                    >
                      {overdue
                        ? `Overdue (${ageDays}d)`
                        : row.billing_status === "drafted"
                        ? "Draft created"
                        : "Ready to bill"}
                    </span>

                    <a
                      href={`/crm/client/${row.client_id}/work/${row.work_item_id}`}
                      style={plannerActionLink}
                    >
                      Open
                    </a>
                  </div>
                );
              })
            ) : (
              <div style={empty}>No billable work matches this view.</div>
            )}
          </section>

          <div style={plannerSplit}>
            <section style={plannerPanel}>
              <div style={plannerPanelHeader}>
                <div>
                  <h3 style={plannerPanelTitle}>Capacity Heatmap</h3>
                  <p style={plannerPanelSub}>
                    Team utilisation for the next 14 days.
                  </p>
                </div>
              </div>

              <div style={plannerEmptyVisual}>
                <div style={plannerEmptyIcon}>◫</div>
                <strong>Capacity engine is being connected</strong>
                <span>
                  This panel will use staff weekday availability, estimated task effort and client/group capacity pools.
                </span>
              </div>
            </section>

            <section style={plannerPanel}>
              <div style={plannerPanelHeader}>
                <div>
                  <h3 style={plannerPanelTitle}>
                    Workload by client / team member / task type
                  </h3>
                  <p style={plannerPanelSub}>
                    Planned and scheduled work for the next 7 and 30 days.
                  </p>
                </div>

                <div style={plannerMiniTabs}>
                  <button style={plannerMiniTabActive}>By Client</button>
                  <button style={plannerMiniTab}>By Team Member</button>
                  <button style={plannerMiniTab}>By Task Type</button>
                </div>
              </div>

              <div style={plannerEmptyVisual}>
                <div style={plannerEmptyIcon}>▤</div>
                <strong>Workload bars will appear here</strong>
                <span>
                  We are not inventing future workload before the capacity engine is wired.
                </span>
              </div>
            </section>
          </div>

          <section style={plannerPanel}>
            <div style={plannerPanelHeader}>
              <div>
                <h3 style={plannerPanelTitle}>Month comparison</h3>
                <p style={plannerPanelSub}>
                  This month vs last month for key practice metrics.
                </p>
              </div>
            </div>

            <div style={plannerMonthGrid}>
              <div style={plannerMonthMetric}>
                <span>Tracked hours</span>
                <strong>{Number(totals.total_hours || 0).toFixed(2)}h</strong>
                <small>Current month</small>
              </div>

              <div style={plannerMonthMetric}>
                <span>Billable WIP</span>
                <strong>{money(totals.billable_wip_value || 0)}</strong>
                <small>Current open value</small>
              </div>

              <div style={plannerMonthMetric}>
                <span>Internal cost</span>
                <strong>{money(totals.total_staff_cost || 0)}</strong>
                <small>Current tracked cost</small>
              </div>

              <div style={plannerMonthMetric}>
                <span>Delivery contribution</span>
                <strong>{money(totals.wip_contribution || 0)}</strong>
                <small>Charge-out equivalent less cost</small>
              </div>

              <div style={plannerMonthMetric}>
                <span>Unclassified delivery</span>
                <strong>{Number(totals.unclassified_hours || 0).toFixed(2)}h</strong>
                <small>Needs commercial classification</small>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {view === "profitability" ? (
        <>
          <section style={economicsHeader}>
            <div>
              <div style={economicsEyebrow}>Client Economics</div>
              <h2 style={economicsTitle}>
                Client Economics & Retainer Intelligence
              </h2>
              <p style={economicsSubtitle}>
                Which clients are healthy, slipping, or consuming more than
                their fee supports.
              </p>
            </div>

            <div style={economicsHeaderActions}>
              <button
                type="button"
                onClick={() => setEconomicsFilter("retainer")}
                style={{
                  ...economicsSegmentButton,
                  ...(economicsFilter === "retainer"
                    ? economicsSegmentButtonActive
                    : {}),
                }}
              >
                Retainer Clients
              </button>

              <button
                type="button"
                onClick={() => setEconomicsFilter("all")}
                style={{
                  ...economicsSegmentButton,
                  ...(economicsFilter === "all"
                    ? economicsSegmentButtonActive
                    : {}),
                }}
              >
                All Clients
              </button>
            </div>
          </section>

          <section style={economicsKpiGrid}>
            <div style={economicsKpi}>
              <span style={economicsKpiLabel}>Healthy Clients</span>
              <strong style={economicsKpiValue}>
                {economicsSummary.healthy || 0}
              </strong>
              <span style={economicsKpiSub}>Profitable and on track</span>
            </div>

            <div style={economicsKpi}>
              <span style={economicsKpiLabel}>Scope Creep Risk</span>
              <strong style={economicsKpiValue}>
                {economicsSummary.scope_creep_risk || 0}
              </strong>
              <span style={economicsKpiSub}>Fee capacity under pressure</span>
            </div>

            <div style={economicsKpi}>
              <span style={economicsKpiLabel}>Loss-making Clients</span>
              <strong style={{ ...economicsKpiValue, color: "#b42318" }}>
                {economicsSummary.loss_making || 0}
              </strong>
              <span style={economicsKpiSub}>Internal cost exceeds fee</span>
            </div>

            <div style={economicsKpi}>
              <span style={economicsKpiLabel}>Unbilled Ad Hoc Value</span>
              <strong style={economicsKpiValue}>
                {money(economicsSummary.unbilled_ad_hoc_value || 0)}
              </strong>
              <span style={economicsKpiSub}>Work completed, not billed</span>
            </div>

            <div style={economicsKpi}>
              <span style={economicsKpiLabel}>Average Effective Recovery</span>
              <strong style={economicsKpiValue}>
                {percent(
                  economicsSummary.average_effective_recovery || 0
                )}
              </strong>
              <span style={economicsKpiSub}>
                Monthly fee vs internal cost
              </span>
            </div>
          </section>

          <section style={economicsToolbar}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients..."
              style={economicsSearch}
            />

            <span style={economicsToolbarCount}>
              {filteredEconomicsRows.length} clients
            </span>
          </section>

          <section style={economicsPanel}>
            <div style={economicsTableHeader}>
              <span>Client</span>
              <span>Commercial Model</span>
              <span>Monthly Fee Basis</span>
              <span>Tracked Hours</span>
              <span>Internal Cost</span>
              <span>Charge-out Equivalent</span>
              <span>Effective Recovery</span>
              <span>Profitability Status</span>
              <span>Recommended Action</span>
            </div>

            {filteredEconomicsRows.length ? (
              filteredEconomicsRows.map((row) => {
                const statusLabel =
                  row.retainer_health_status === "healthy"
                    ? "Healthy"
                    : row.retainer_health_status === "watch"
                    ? "Watch"
                    : row.retainer_health_status === "scope_creep_risk"
                    ? "Scope Creep Risk"
                    : row.retainer_health_status === "loss_making"
                    ? "Loss-making"
                    : "Terms incomplete";

                const action =
                  row.retainer_health_status === "healthy"
                    ? "Continue as is"
                    : row.retainer_health_status === "watch"
                    ? "Review time trend"
                    : row.retainer_health_status === "scope_creep_risk"
                    ? "Review scope / pricing"
                    : row.retainer_health_status === "loss_making"
                    ? "Urgent fee / scope review"
                    : "Complete commercial terms";

                return (
                  <button
                    type="button"
                    key={row.client_id}
                    onClick={() =>
                      setSelectedEconomicsClientId(row.client_id)
                    }
                    style={{
                      ...economicsTableRow,
                      ...(selectedEconomicsClientId === row.client_id
                        ? economicsTableRowSelected
                        : {}),
                    }}
                  >
                    <span>
                      <strong style={economicsClientName}>
                        {row.client_name}
                      </strong>
                      <span style={economicsClientMeta}>
                        {row.client_code || "No code"}
                        {row.entity_type ? ` · ${row.entity_type}` : ""}
                      </span>
                    </span>

                    <span style={economicsCell}>
                      {String(row.commercial_model || "—").replaceAll(
                        "_",
                        " "
                      )}
                    </span>

                    <span style={economicsCellStrong}>
                      {row.monthly_fee_equivalent == null
                        ? "—"
                        : money(row.monthly_fee_equivalent)}
                    </span>

                    <span style={economicsCell}>
                      {Number(row.tracked_hours || 0).toFixed(2)}
                    </span>

                    <span style={economicsCellStrong}>
                      {money(row.internal_staff_cost || 0)}
                    </span>

                    <span style={economicsCell}>
                      {money(row.charge_out_equivalent || 0)}
                    </span>

                    <span style={economicsCellStrong}>
                      {row.effective_recovery_percent == null
                        ? "—"
                        : percent(row.effective_recovery_percent)}
                    </span>

                    <span>
                      <span
                        style={{
                          ...economicsStatus,
                          ...(row.retainer_health_status === "healthy"
                            ? economicsHealthy
                            : row.retainer_health_status === "loss_making"
                            ? economicsLoss
                            : row.retainer_health_status ===
                              "terms_incomplete"
                            ? economicsIncomplete
                            : economicsRisk),
                        }}
                      >
                        {statusLabel}
                      </span>
                    </span>

                    <span style={economicsAction}>{action}</span>
                  </button>
                );
              })
            ) : (
              <div style={empty}>No clients match this view.</div>
            )}
          </section>

          {selectedEconomicsClient ? (
            <div style={economicsLowerGrid}>
              <section style={economicsPanel}>
                <div style={panelHeader}>
                  <div>
                    <h3 style={panelTitle}>Commercial Terms Snapshot</h3>
                    <p style={panelSubtitle}>
                      {selectedEconomicsClient.client_name}
                    </p>
                  </div>
                </div>

                <div style={economicsTermsBody}>
                  <div style={economicsTermsColumn}>
                    <strong style={economicsTermsHeading}>
                      Included Services
                    </strong>
                    {selectedEconomicsClient.included_services.length ? (
                      selectedEconomicsClient.included_services.map(
                        (service) => (
                          <span key={service} style={economicsServiceLine}>
                            ✓ {service}
                          </span>
                        )
                      )
                    ) : (
                      <span style={economicsMuted}>None classified</span>
                    )}
                  </div>

                  <div style={economicsTermsColumn}>
                    <strong style={economicsTermsHeading}>
                      Separately Billable Services
                    </strong>
                    {selectedEconomicsClient.separately_billable_services
                      .length ? (
                      selectedEconomicsClient.separately_billable_services.map(
                        (service) => (
                          <span key={service} style={economicsServiceLine}>
                            • {service}
                          </span>
                        )
                      )
                    ) : (
                      <span style={economicsMuted}>None classified</span>
                    )}
                  </div>

                  <div style={economicsTermsColumn}>
                    <strong style={economicsTermsHeading}>
                      Billing Notes
                    </strong>
                    <span style={economicsMuted}>
                      {selectedEconomicsClient.billing_notes ||
                        "No billing notes recorded."}
                    </span>
                  </div>
                </div>
              </section>

              <section style={economicsPanel}>
                <div style={panelHeader}>
                  <div>
                    <h3 style={panelTitle}>Fee vs Actual Cost</h3>
                    <p style={panelSubtitle}>Current month</p>
                  </div>
                </div>

                <div style={economicsBars}>
                  <div style={economicsBarRow}>
                    <span>Monthly fee equivalent</span>
                    <div style={economicsBarTrack}>
                      <div
                        style={{
                          ...economicsBarFill,
                          width: "100%",
                        }}
                      />
                    </div>
                    <strong>
                      {selectedEconomicsClient.monthly_fee_equivalent == null
                        ? "—"
                        : money(
                            selectedEconomicsClient.monthly_fee_equivalent
                          )}
                    </strong>
                  </div>

                  <div style={economicsBarRow}>
                    <span>Internal staff cost</span>
                    <div style={economicsBarTrack}>
                      <div
                        style={{
                          ...economicsBarFillCost,
                          width:
                            selectedEconomicsClient.monthly_fee_equivalent &&
                            selectedEconomicsClient.monthly_fee_equivalent > 0
                              ? `${Math.min(
                                  100,
                                  (selectedEconomicsClient.internal_staff_cost /
                                    selectedEconomicsClient.monthly_fee_equivalent) *
                                    100
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                    <strong>
                      {money(
                        selectedEconomicsClient.internal_staff_cost || 0
                      )}
                    </strong>
                  </div>

                  <div style={economicsRecoveryBox}>
                    <strong>
                      {selectedEconomicsClient.effective_recovery_percent ==
                      null
                        ? "Effective recovery unavailable"
                        : `${percent(
                            selectedEconomicsClient.effective_recovery_percent
                          )} effective recovery`}
                    </strong>
                    <span>
                      Monthly fee compared with actual internal staff cost.
                    </span>
                  </div>
                </div>
              </section>

              <section style={economicsPanel}>
                <div style={panelHeader}>
                  <div>
                    <h3 style={panelTitle}>Top Clients Under Pressure</h3>
                    <p style={panelSubtitle}>
                      Highest internal cost relative to fee.
                    </p>
                  </div>
                </div>

                <div style={economicsRiskHeader}>
                  <span>Client</span>
                  <span>Internal Cost</span>
                  <span>% of Fee</span>
                </div>

                {topScopeCreepClients.length ? (
                  topScopeCreepClients.map((row) => {
                    const ratio =
                      row.monthly_fee_equivalent &&
                      row.monthly_fee_equivalent > 0
                        ? (row.internal_staff_cost /
                            row.monthly_fee_equivalent) *
                          100
                        : 0;

                    return (
                      <div key={row.client_id} style={economicsRiskRow}>
                        <strong>{row.client_name}</strong>
                        <span>{money(row.internal_staff_cost || 0)}</span>
                        <strong
                          style={{
                            color:
                              ratio >= 100
                                ? "#b42318"
                                : ratio >= 90
                                ? "#b7791f"
                                : "#526174",
                          }}
                        >
                          {percent(ratio)}
                        </strong>
                      </div>
                    );
                  })
                ) : (
                  <div style={empty}>
                    No clients are currently under pressure.
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </>
      ) : null}

      {view === "next7" ? (
        <ReportComingNext
          title="Tasks for the next 7 days"
          description="Upcoming workload by client, team member and task / service type, with overdue work shown separately."
        />
      ) : null}

      {view === "next30" ? (
        <ReportComingNext
          title="Tasks for the next 30 days"
          description="Forward workload by client, team member and task / service type for planning capacity."
        />
      ) : null}

      {view === "comparison" ? (
        <ReportComingNext
          title="Monthly Comparison"
          description="This month versus last month: tracked hours, internal cost, charge-out value, billed revenue, profitability, completed tasks and overdue work."
        />
      ) : null}
    </main>
  );
}


function ReportComingNext({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section style={reportPlaceholder}>
      <div style={reportPlaceholderNumber}>Next report</div>
      <h2 style={reportPlaceholderTitle}>{title}</h2>
      <p style={reportPlaceholderText}>{description}</p>
    </section>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "12px 14px 34px",
  background: "#eef2f5",
  color: "#10233a",
};

const workingBar: React.CSSProperties = {
  minHeight: "40px",
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  gap: "9px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
  fontSize: "11px",
};

const workingTitle: React.CSSProperties = {
  color: "#1758d5",
  fontWeight: 900,
};

const workingDivider: React.CSSProperties = {
  color: "#94a3b8",
};

const workingMuted: React.CSSProperties = {
  color: "#64748b",
};

const headerPanel: React.CSSProperties = {
  marginTop: "10px",
  minHeight: "86px",
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "24px",
  lineHeight: 1.05,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "12px",
};

const secondaryButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const refreshButton: React.CSSProperties = {
  height: "34px",
  padding: "0 12px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "11px",
  fontWeight: 850,
  cursor: "pointer",
};

const tabBar: React.CSSProperties = {
  marginTop: "10px",
  minHeight: "44px",
  display: "flex",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const tabButton: React.CSSProperties = {
  minWidth: "132px",
  padding: "0 12px",
  border: "none",
  borderRight: "1px solid #d8dee7",
  background: "#ffffff",
  color: "#526174",
  fontSize: "10px",
  fontWeight: 850,
  cursor: "pointer",
};

const activeTabButton: React.CSSProperties = {
  background: "#10233a",
  color: "#ffffff",
};

const summaryStrip: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const summaryCell: React.CSSProperties = {
  minHeight: "54px",
  padding: "8px 10px",
  display: "grid",
  alignContent: "center",
  borderRight: "1px solid #e5eaf0",
};

const summaryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 800,
};

const summaryValue: React.CSSProperties = {
  marginTop: "2px",
  fontSize: "18px",
  fontWeight: 900,
};

const overviewGrid: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "8px",
};

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const fullWidthPanel: React.CSSProperties = {
  ...panel,
  gridColumn: "1 / -1",
};

const panelHeader: React.CSSProperties = {
  minHeight: "46px",
  padding: "7px 10px",
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

const panelSubtitle: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "8px",
};

const textButton: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#1758d5",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const miniHeader: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns: "minmax(220px,1.4fr) 70px 120px 120px",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const miniRow: React.CSSProperties = {
  minHeight: "38px",
  padding: "4px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(220px,1.4fr) 70px 120px 120px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "9px",
};

const miniHeaderTeam: React.CSSProperties = {
  ...miniHeader,
  gridTemplateColumns: "minmax(220px,1.5fr) 80px 130px",
};

const miniRowTeam: React.CSSProperties = {
  ...miniRow,
  gridTemplateColumns: "minmax(220px,1.5fr) 80px 130px",
};

const explanationGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
};

const explanationCell: React.CSSProperties = {
  minHeight: "64px",
  padding: "9px 10px",
  display: "grid",
  alignContent: "center",
  gap: "3px",
  borderRight: "1px solid #e5eaf0",
  color: "#526174",
  fontSize: "8px",
};

const filterPanel: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(300px, 1fr) auto",
  gap: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  height: "30px",
  padding: "0 8px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
};

const clearButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#526174",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const tableHeaderClient: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns: "minmax(260px,1.5fr) 90px 150px 150px 150px 80px",
  gap: "8px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 850,
};

const tableRowClient: React.CSSProperties = {
  minHeight: "42px",
  padding: "5px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(260px,1.5fr) 90px 150px 150px 150px 80px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "9px",
};

const tableHeaderTeam: React.CSSProperties = {
  ...tableHeaderClient,
  gridTemplateColumns: "minmax(260px,1.5fr) 90px 150px 150px 100px 80px",
};

const tableRowTeam: React.CSSProperties = {
  ...tableRowClient,
  gridTemplateColumns: "minmax(260px,1.5fr) 90px 150px 150px 100px 80px",
};

const name: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
};

const meta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
};

const empty: React.CSSProperties = {
  padding: "16px 10px",
  color: "#64748b",
  fontSize: "9px",
};

const wipFormulaNote: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  borderLeft: "3px solid #1758d5",
  background: "#f4f8fc",
  color: "#526174",
  fontSize: "9px",
  lineHeight: 1.45,
};

const wipHero: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "60px",
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const wipHeroTitle: React.CSSProperties = {
  margin: 0,
  color: "#10233a",
  fontSize: "15px",
  fontWeight: 900,
};

const wipHeroSubtitle: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "8px",
};

const wipHeroLegend: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  color: "#526174",
  fontSize: "9px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const legendItem: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
};

const legendDot: React.CSSProperties = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
};

const wipKpiGrid: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "7px",
};

const wipKpi: React.CSSProperties = {
  minHeight: "72px",
  padding: "8px 9px",
  display: "grid",
  alignContent: "center",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const wipKpiLabel: React.CSSProperties = {
  color: "#526174",
  fontSize: "7.5px",
  fontWeight: 850,
};

const wipKpiValue: React.CSSProperties = {
  marginTop: "2px",
  color: "#10233a",
  fontSize: "17px",
  fontWeight: 900,
};

const wipKpiSub: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7px",
  lineHeight: 1.3,
};

const wipToolbar: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "42px",
  padding: "6px 9px",
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) 300px",
  gap: "8px",
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const wipToolbarTitle: React.CSSProperties = {
  display: "block",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 900,
};

const wipToolbarText: React.CSSProperties = {
  display: "block",
  marginTop: "1px",
  color: "#64748b",
  fontSize: "7.5px",
};

const wipSearch: React.CSSProperties = {
  width: "100%",
  height: "28px",
  boxSizing: "border-box",
  padding: "0 7px",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8px",
};

const wipPanel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const wipPanelHeader: React.CSSProperties = {
  minHeight: "44px",
  padding: "7px 9px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #d8dee7",
};

const wipClientHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(190px,1.25fr) 90px 110px 135px 135px 120px 125px 62px",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8.5px",
  fontWeight: 850,
};

const wipClientRow: React.CSSProperties = {
  minHeight: "46px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(190px,1.25fr) 90px 110px 135px 135px 120px 125px 62px",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "#10233a",
  fontSize: "8px",
};

const wipTeamHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(220px,1.45fr) 90px 120px 120px 120px 80px 80px",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "7px",
  fontWeight: 850,
};

const wipTeamRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(220px,1.45fr) 90px 120px 120px 120px 80px 80px",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "#10233a",
  fontSize: "8px",
};

const wipMixPill: React.CSSProperties = {
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

const wipMixIncluded: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const wipMixBillable: React.CSSProperties = {
  color: "#8a5a00",
  background: "#fff8e6",
  borderColor: "#f0c36b",
};

const wipMixWarning: React.CSSProperties = {
  color: "#991b1b",
  background: "#fff1f2",
  borderColor: "#fecaca",
};

const wipDefinitionGrid: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "7px",
};

const wipDefinition: React.CSSProperties = {
  minHeight: "70px",
  padding: "8px 9px",
  display: "grid",
  alignContent: "start",
  gap: "3px",
  borderLeft: "3px solid #1758d5",
  background: "#f4f8fc",
  color: "#526174",
  fontSize: "7.5px",
  lineHeight: 1.4,
};

const plannerHeader: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "64px",
  padding: "9px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const plannerExportActions: React.CSSProperties = {
  display: "flex",
  gap: "6px",
};

const plannerKpiGrid: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "7px",
};

const billingTableHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(180px,1.15fr) minmax(260px,1.7fr) 75px 115px 125px 120px 125px 70px",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "7.5px",
  fontWeight: 850,
};

const billingTableRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(180px,1.15fr) minmax(260px,1.7fr) 75px 115px 125px 120px 125px 70px",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "8px",
};

const billingWorkTitle: React.CSSProperties = {
  fontSize: "8px",
  fontWeight: 900,
};

const billingOpenLink: React.CSSProperties = {
  color: "#1758d5",
  textDecoration: "none",
  fontSize: "8px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const billingLogicNote: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  display: "flex",
  gap: "5px",
  borderLeft: "3px solid #1758d5",
  background: "#f4f8fc",
  color: "#526174",
  fontSize: "8px",
};

const billingHero: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "58px",
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const billingHeroTitle: React.CSSProperties = {
  margin: 0,
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 900,
};

const billingHeroSubtitle: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "8px",
};

const billingHeroNote: React.CSSProperties = {
  maxWidth: "310px",
  padding: "6px 8px",
  borderLeft: "3px solid #1758d5",
  background: "#f4f8fc",
  color: "#526174",
  fontSize: "7.5px",
  lineHeight: 1.35,
};

const billingKpiGrid: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "7px",
};

const billingKpi: React.CSSProperties = {
  minHeight: "72px",
  padding: "8px 9px",
  display: "grid",
  alignContent: "center",
  border: "1px solid #d8dee7",
  background: "#ffffff",
  color: "#10233a",
  textAlign: "left",
  cursor: "pointer",
};

const billingKpiActive: React.CSSProperties = {
  boxShadow: "inset 0 -3px 0 #1758d5",
  background: "#f8fbff",
};

const billingKpiLabel: React.CSSProperties = {
  color: "#526174",
  fontSize: "7.5px",
  fontWeight: 850,
};

const billingKpiValue: React.CSSProperties = {
  marginTop: "2px",
  fontSize: "17px",
  fontWeight: 900,
};

const billingKpiSub: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7px",
};

const billingToolbar: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "42px",
  padding: "6px 9px",
  display: "grid",
  gridTemplateColumns: "auto minmax(260px, 1fr)",
  gap: "8px",
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const billingFilterButtons: React.CSSProperties = {
  display: "flex",
  gap: "5px",
};

const billingFilterButton: React.CSSProperties = {
  height: "28px",
  padding: "0 9px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#526174",
  fontSize: "7.5px",
  fontWeight: 850,
  cursor: "pointer",
};

const billingFilterButtonActive: React.CSSProperties = {
  background: "#10233a",
  borderColor: "#10233a",
  color: "#ffffff",
};

const billingSearchInput: React.CSSProperties = {
  width: "100%",
  height: "28px",
  padding: "0 7px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8px",
};

const billingPanel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const billingHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(180px,1.1fr) minmax(260px,1.55fr) 120px 72px 110px 115px 60px 110px 62px",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "7px",
  fontWeight: 850,
};

const billingRow: React.CSSProperties = {
  minHeight: "46px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(180px,1.1fr) minmax(260px,1.55fr) 120px 72px 110px 115px 60px 110px 62px",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "#10233a",
  fontSize: "8px",
};

const billingClient: React.CSSProperties = {
  fontSize: "8.5px",
  fontWeight: 900,
};

const billingWork: React.CSSProperties = {
  display: "block",
  fontSize: "8px",
  fontWeight: 900,
};

const billingMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7px",
};

const billingCell: React.CSSProperties = {
  fontSize: "7.5px",
  textTransform: "capitalize",
};

const billingAge: React.CSSProperties = {
  fontSize: "8px",
  fontWeight: 850,
};

const billingStatus: React.CSSProperties = {
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

const billingStatusReady: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const billingStatusDrafted: React.CSSProperties = {
  color: "#1758d5",
  background: "#eff6ff",
  borderColor: "#bfdbfe",
};

const billingStatusOverdue: React.CSSProperties = {
  color: "#991b1b",
  background: "#fff1f2",
  borderColor: "#fecaca",
};

const billingStatusNotReady: React.CSSProperties = {
  color: "#526174",
  background: "#f8fafc",
  borderColor: "#e2e8f0",
};

const billingOpen: React.CSSProperties = {
  color: "#1758d5",
  textDecoration: "none",
  fontSize: "7.5px",
  fontWeight: 900,
};

const billingDefinitionGrid: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "7px",
};

const billingDefinition: React.CSSProperties = {
  minHeight: "68px",
  padding: "8px 9px",
  display: "grid",
  alignContent: "start",
  gap: "3px",
  borderLeft: "3px solid #1758d5",
  background: "#f4f8fc",
  color: "#526174",
  fontSize: "7.5px",
  lineHeight: 1.4,
};

const overviewHero: React.CSSProperties = {
  marginTop: "12px",
  minHeight: "104px",
  padding: "18px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  background: "#ffffff",
  border: "1px solid #cfd8e3",
  boxShadow: "0 1px 2px rgba(15,35,58,0.04)",
};

const overviewTitle: React.CSSProperties = {
  margin: 0,
  color: "#10233a",
  fontSize: "24px",
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const overviewSubtitle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#5f6f82",
  fontSize: "12px",
  lineHeight: 1.4,
};

const overviewHeroRight: React.CSSProperties = {
  minWidth: "260px",
  paddingLeft: "18px",
  borderLeft: "1px solid #d8e0e8",
  textAlign: "right",
};

const overviewHeroLabel: React.CSSProperties = {
  display: "block",
  color: "#6b7b8f",
  fontSize: "10px",
  fontWeight: 800,
};

const overviewHeroValue: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#10233a",
  fontSize: "32px",
  lineHeight: 1,
  fontWeight: 950,
};

const overviewHeroMeta: React.CSSProperties = {
  display: "block",
  marginTop: "5px",
  color: "#6b7b8f",
  fontSize: "11px",
};

const overviewKpiGrid: React.CSSProperties = {
  marginTop: "12px",
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0,1fr))",
  gap: "8px",
};

const overviewKpi: React.CSSProperties = {
  minHeight: "118px",
  padding: "14px",
  display: "grid",
  gridTemplateColumns: "42px minmax(0,1fr)",
  gap: "10px",
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #cfd8e3",
  boxShadow: "0 1px 2px rgba(15,35,58,0.04)",
};

const overviewKpiIcon: React.CSSProperties = {
  width: "44px",
  height: "44px",
  display: "grid",
  placeItems: "center",
  borderRadius: "8px",
  background: "#eef5ff",
  color: "#1758d5",
  fontSize: "20px",
  fontWeight: 950,
};

const overviewKpiLabel: React.CSSProperties = {
  display: "block",
  color: "#5d6d80",
  fontSize: "10px",
  fontWeight: 850,
};

const overviewKpiValue: React.CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "#10233a",
  fontSize: "22px",
  lineHeight: 1,
  fontWeight: 950,
};

const overviewKpiSub: React.CSSProperties = {
  display: "block",
  marginTop: "5px",
  color: "#748396",
  fontSize: "9px",
  lineHeight: 1.3,
};

const overviewTwoCol: React.CSSProperties = {
  marginTop: "12px",
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr",
  gap: "10px",
};

const overviewTwoColLower: React.CSSProperties = {
  marginTop: "12px",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
};

const overviewPanel: React.CSSProperties = {
  marginTop: "12px",
  background: "#ffffff",
  border: "1px solid #cfd8e3",
  boxShadow: "0 1px 2px rgba(15,35,58,0.04)",
};

const overviewPanelHeader: React.CSSProperties = {
  minHeight: "64px",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  borderBottom: "1px solid #d8e0e8",
};

const overviewPanelTitle: React.CSSProperties = {
  margin: 0,
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 900,
};

const overviewPanelSub: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#6a788a",
  fontSize: "10px",
};

const overviewAttentionHeader: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 14px",
  display: "grid",
  gridTemplateColumns: "1.45fr 1.1fr .8fr 90px",
  gap: "8px",
  alignItems: "center",
  background: "#f4f7fa",
  borderBottom: "1px solid #d8e0e8",
  color: "#667587",
  fontSize: "9px",
  fontWeight: 850,
};

const overviewAttentionRow: React.CSSProperties = {
  minHeight: "50px",
  padding: "8px 14px",
  display: "grid",
  gridTemplateColumns: "1.45fr 1.1fr .8fr 90px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "#10233a",
  fontSize: "10px",
};

const overviewAlertDotRed: React.CSSProperties = {
  width: "8px",
  height: "8px",
  marginRight: "7px",
  display: "inline-block",
  borderRadius: "50%",
  background: "#dc2626",
};

const overviewAlertDotAmber: React.CSSProperties = {
  width: "8px",
  height: "8px",
  marginRight: "7px",
  display: "inline-block",
  borderRadius: "50%",
  background: "#d97706",
};

const overviewAlertDotBlue: React.CSSProperties = {
  width: "8px",
  height: "8px",
  marginRight: "7px",
  display: "inline-block",
  borderRadius: "50%",
  background: "#2563eb",
};

const overviewActionLink: React.CSSProperties = {
  color: "#1758d5",
  textDecoration: "none",
  fontSize: "10px",
  fontWeight: 900,
};

const overviewActionButton: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#1758d5",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "left",
  padding: 0,
};

const overviewPulseGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
};

const overviewPulseCell: React.CSSProperties = {
  minHeight: "128px",
  padding: "16px",
  display: "grid",
  gridTemplateColumns: "42px minmax(0,1fr)",
  gap: "10px",
  alignItems: "center",
  borderRight: "1px solid #e5eaf0",
  borderBottom: "1px solid #e5eaf0",
};

const overviewPulseIconGood: React.CSSProperties = {
  width: "40px",
  height: "40px",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: "#dcfce7",
  color: "#166534",
  fontSize: "18px",
  fontWeight: 950,
};

const overviewPulseIconBad: React.CSSProperties = {
  width: "40px",
  height: "40px",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: "#fee2e2",
  color: "#b42318",
  fontSize: "18px",
  fontWeight: 950,
};

const overviewPulseIconBlue: React.CSSProperties = {
  width: "40px",
  height: "40px",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: "#dbeafe",
  color: "#1758d5",
  fontSize: "18px",
  fontWeight: 950,
};

const overviewPulseLabel: React.CSSProperties = {
  display: "block",
  color: "#5f6f82",
  fontSize: "10px",
  fontWeight: 800,
};

const overviewPulseValue: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#10233a",
  fontSize: "18px",
  fontWeight: 950,
};

const overviewPulseSub: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#748396",
  fontSize: "9px",
};

const overviewPressureHeader: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 12px",
  display: "grid",
  gridTemplateColumns: "1.25fr 110px 110px 110px 120px",
  gap: "8px",
  alignItems: "center",
  background: "#f4f7fa",
  borderBottom: "1px solid #d8e0e8",
  color: "#667587",
  fontSize: "9px",
  fontWeight: 850,
};

const overviewPressureRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "7px 12px",
  display: "grid",
  gridTemplateColumns: "1.25fr 110px 110px 110px 120px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "#10233a",
  fontSize: "10px",
};

const overviewMiniStatus: React.CSSProperties = {
  minHeight: "24px",
  padding: "0 8px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "12px",
  fontSize: "9px",
  fontWeight: 850,
};

const overviewMiniStatusBad: React.CSSProperties = {
  color: "#b42318",
  background: "#fff1f2",
};

const overviewMiniStatusWarn: React.CSSProperties = {
  color: "#9a6700",
  background: "#fff7df",
};

const overviewAdhocHeader: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 12px",
  display: "grid",
  gridTemplateColumns: "1fr 1.35fr 100px 65px",
  gap: "8px",
  alignItems: "center",
  background: "#f4f7fa",
  borderBottom: "1px solid #d8e0e8",
  color: "#667587",
  fontSize: "9px",
  fontWeight: 850,
};

const overviewAdhocRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "7px 12px",
  display: "grid",
  gridTemplateColumns: "1fr 1.35fr 100px 65px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "#10233a",
  fontSize: "10px",
};

const overviewViewAll: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#1758d5",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
};

const overviewTeamGrid: React.CSSProperties = {
  padding: "10px",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0,1fr))",
  gap: "10px",
};

const overviewTeamCard: React.CSSProperties = {
  minHeight: "196px",
  padding: "14px",
  background: "#f8fafc",
  border: "1px solid #cfd8e3",
};

const overviewTeamName: React.CSSProperties = {
  display: "block",
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 950,
};

const overviewTeamEmail: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#748396",
  fontSize: "9px",
};

const overviewTeamHours: React.CSSProperties = {
  marginTop: "14px",
  color: "#10233a",
  fontSize: "28px",
  lineHeight: 1,
  fontWeight: 950,
};

const overviewTeamMetrics: React.CSSProperties = {
  marginTop: "12px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0,1fr))",
  gap: "6px",
  color: "#6b7a8c",
  fontSize: "9px",
};

const overviewTeamFooter: React.CSSProperties = {
  marginTop: "12px",
  paddingTop: "8px",
  borderTop: "1px solid #d8e0e8",
  color: "#6b7a8c",
  fontSize: "9px",
};

const overviewEmpty: React.CSSProperties = {
  padding: "20px 12px",
  color: "#748396",
  fontSize: "10px",
};

const fdHeader: React.CSSProperties = { marginTop:"10px", minHeight:"78px", padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", background:"#fff", border:"1px solid #cfd8e3" };
const fdEyebrow: React.CSSProperties = { color:"#1758d5", fontSize:"9px", fontWeight:900 };
const fdTitle: React.CSSProperties = { margin:"2px 0 0", color:"#10233a", fontSize:"22px", lineHeight:1.05, fontWeight:950 };
const fdSubtitle: React.CSSProperties = { margin:"4px 0 0", color:"#64748b", fontSize:"11px" };
const fdRefresh: React.CSSProperties = { height:"32px", padding:"0 12px", border:"1px solid #cbd5e1", background:"#fff", color:"#10233a", fontSize:"9px", fontWeight:850, cursor:"pointer" };
const fdKpiGrid: React.CSSProperties = { marginTop:"10px", display:"grid", gridTemplateColumns:"repeat(6,minmax(0,1fr))", gap:"8px" };
const fdKpiCard: React.CSSProperties = { minHeight:"112px", padding:"12px", display:"grid", gridTemplateColumns:"42px minmax(0,1fr)", gap:"10px", alignItems:"center", background:"#fff", border:"1px solid #cfd8e3" };
const fdIconBlue: React.CSSProperties = { width:"40px", height:"40px", display:"grid", placeItems:"center", borderRadius:"8px", background:"#eef5ff", color:"#1758d5", fontSize:"17px", fontWeight:950 };
const fdIconRed: React.CSSProperties = { width:"40px", height:"40px", display:"grid", placeItems:"center", borderRadius:"8px", background:"#fff1f2", color:"#b42318", fontSize:"17px", fontWeight:950 };
const fdLabel: React.CSSProperties = { display:"block", color:"#5d6d80", fontSize:"10px", fontWeight:850 };
const fdValue: React.CSSProperties = { display:"block", marginTop:"3px", color:"#10233a", fontSize:"20px", lineHeight:1, fontWeight:950 };
const fdMeta: React.CSSProperties = { display:"block", marginTop:"5px", color:"#748396", fontSize:"9px" };
const fdMainGrid: React.CSSProperties = { marginTop:"10px", display:"grid", gridTemplateColumns:"1.35fr 1fr", gap:"10px" };
const fdLowerGrid: React.CSSProperties = { marginTop:"10px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" };
const fdBottomGrid: React.CSSProperties = { marginTop:"10px", display:"grid", gridTemplateColumns:"1.1fr 1fr", gap:"10px" };
const fdPanel: React.CSSProperties = { background:"#fff", border:"1px solid #cfd8e3" };
const fdPanelHeader: React.CSSProperties = { minHeight:"56px", padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px", borderBottom:"1px solid #d8e0e8" };
const fdPanelTitle: React.CSSProperties = { margin:0, color:"#10233a", fontSize:"14px", fontWeight:900 };
const fdPanelSub: React.CSSProperties = { margin:"3px 0 0", color:"#64748b", fontSize:"10px" };
const fdAttHeader: React.CSSProperties = { minHeight:"34px", padding:"0 12px", display:"grid", gridTemplateColumns:"34px 1.45fr 1.1fr .85fr 85px", gap:"8px", alignItems:"center", background:"#f4f7fa", borderBottom:"1px solid #d8e0e8", color:"#64748b", fontSize:"9px", fontWeight:850 };
const fdAttRow: React.CSSProperties = { minHeight:"44px", padding:"6px 12px", display:"grid", gridTemplateColumns:"34px 1.45fr 1.1fr .85fr 85px", gap:"8px", alignItems:"center", borderBottom:"1px solid #e5eaf0", color:"#10233a", fontSize:"10px" };
const fdDotRed: React.CSSProperties = { width:"8px", height:"8px", marginRight:"7px", display:"inline-block", borderRadius:"50%", background:"#dc2626" };
const fdDotAmber: React.CSSProperties = { width:"8px", height:"8px", marginRight:"7px", display:"inline-block", borderRadius:"50%", background:"#d97706" };
const fdDotBlue: React.CSSProperties = { width:"8px", height:"8px", marginRight:"7px", display:"inline-block", borderRadius:"50%", background:"#1758d5" };
const fdAction: React.CSSProperties = { color:"#1758d5", textDecoration:"none", fontSize:"10px", fontWeight:900 };
const fdActionButton: React.CSSProperties = { border:"none", padding:0, background:"transparent", color:"#1758d5", fontSize:"10px", fontWeight:900, cursor:"pointer", textAlign:"left" };
const fdPulseGrid: React.CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr" };
const fdPulseCell: React.CSSProperties = { minHeight:"118px", padding:"14px", display:"grid", gridTemplateColumns:"42px minmax(0,1fr)", gap:"10px", alignItems:"center", borderRight:"1px solid #e5eaf0", borderBottom:"1px solid #e5eaf0" };
const fdPulseGood: React.CSSProperties = { width:"40px", height:"40px", display:"grid", placeItems:"center", borderRadius:"50%", background:"#dcfce7", color:"#166534", fontSize:"18px", fontWeight:950 };
const fdPulseWarn: React.CSSProperties = { width:"40px", height:"40px", display:"grid", placeItems:"center", borderRadius:"50%", background:"#ffedd5", color:"#d97706", fontSize:"18px", fontWeight:950 };
const fdPulseLabel: React.CSSProperties = { display:"block", color:"#5d6d80", fontSize:"10px", fontWeight:800 };
const fdPulseValue: React.CSSProperties = { display:"block", marginTop:"3px", color:"#10233a", fontSize:"17px", fontWeight:950 };
const fdPulseMeta: React.CSSProperties = { display:"block", marginTop:"3px", color:"#748396", fontSize:"9px" };
const fdMiniHeader: React.CSSProperties = { minHeight:"34px", padding:"0 12px", display:"grid", gridTemplateColumns:"34px 1.3fr 75px 105px 105px 110px", gap:"8px", alignItems:"center", background:"#f4f7fa", borderBottom:"1px solid #d8e0e8", color:"#64748b", fontSize:"9px", fontWeight:850 };
const fdMiniRow: React.CSSProperties = { minHeight:"42px", padding:"6px 12px", display:"grid", gridTemplateColumns:"34px 1.3fr 75px 105px 105px 110px", gap:"8px", alignItems:"center", borderBottom:"1px solid #e5eaf0", color:"#10233a", fontSize:"10px" };
const fdAdhocHeader: React.CSSProperties = { minHeight:"34px", padding:"0 12px", display:"grid", gridTemplateColumns:"34px 1fr 1.3fr 95px 55px", gap:"8px", alignItems:"center", background:"#f4f7fa", borderBottom:"1px solid #d8e0e8", color:"#64748b", fontSize:"9px", fontWeight:850 };
const fdAdhocRow: React.CSSProperties = { minHeight:"42px", padding:"6px 12px", display:"grid", gridTemplateColumns:"34px 1fr 1.3fr 95px 55px", gap:"8px", alignItems:"center", borderBottom:"1px solid #e5eaf0", color:"#10233a", fontSize:"10px" };
const fdViewAll: React.CSSProperties = { border:"none", background:"transparent", color:"#1758d5", fontSize:"10px", fontWeight:900, cursor:"pointer" };
const fdEmpty: React.CSSProperties = { padding:"18px 12px", color:"#748396", fontSize:"10px" };
const fdPlaceholder: React.CSSProperties = { minHeight:"190px", padding:"18px", display:"grid", placeItems:"center", alignContent:"center", gap:"6px", color:"#64748b", textAlign:"center", fontSize:"10px" };
const fdPlaceholderIcon: React.CSSProperties = { color:"#1758d5", fontSize:"28px", fontWeight:950 };
const fdTrendPlaceholder: React.CSSProperties = { minHeight:"190px", padding:"18px", display:"grid", alignContent:"center", gap:"12px" };
const fdTrendBars: React.CSSProperties = { height:"110px", display:"grid", gridTemplateColumns:"repeat(6,1fr)", alignItems:"end", gap:"12px", padding:"0 16px", borderBottom:"1px solid #d8e0e8" };
const fdTrendLabel: React.CSSProperties = { color:"#748396", fontSize:"10px", textAlign:"center" };

const plannerTopbar: React.CSSProperties = {
  marginTop: "10px",
  minHeight: "76px",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const plannerTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 950,
  color: "#10233a",
};

const plannerSubtitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "10px",
};

const plannerActions: React.CSSProperties = {
  display: "flex",
  gap: "6px",
};

const plannerActionButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const plannerMetricGrid: React.CSSProperties = {
  marginTop: "10px",
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0,1fr))",
  gap: "7px",
};

const plannerMetricCard: React.CSSProperties = {
  minHeight: "102px",
  padding: "12px",
  display: "grid",
  gridTemplateColumns: "38px minmax(0,1fr) 14px",
  gap: "8px",
  alignItems: "center",
  border: "1px solid #d8dee7",
  background: "#ffffff",
  color: "#10233a",
  textAlign: "left",
  cursor: "pointer",
};

const plannerMetricIcon: React.CSSProperties = {
  width: "40px",
  height: "40px",
  display: "grid",
  placeItems: "center",
  borderRadius: "6px",
  background: "#eef5ff",
  color: "#1758d5",
  fontSize: "16px",
  fontWeight: 900,
};

const plannerMetricLabel: React.CSSProperties = {
  display: "block",
  color: "#526174",
  fontSize: "9px",
  fontWeight: 850,
};

const plannerMetricValue: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#10233a",
  fontSize: "20px",
  fontWeight: 950,
};

const plannerMetricSub: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#64748b",
  fontSize: "9px",
};

const plannerMetricArrow: React.CSSProperties = {
  color: "#1758d5",
  fontSize: "16px",
  fontWeight: 900,
};

const plannerPanel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const plannerPanelHeader: React.CSSProperties = {
  minHeight: "56px",
  padding: "9px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  borderBottom: "1px solid #d8dee7",
};

const plannerPanelTitle: React.CSSProperties = {
  margin: 0,
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 900,
};

const plannerPanelSub: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: "9px",
};

const plannerViewAll: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#1758d5",
  fontSize: "7.5px",
  fontWeight: 900,
  cursor: "pointer",
};

const plannerBillingHeader: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 12px",
  display: "grid",
  gridTemplateColumns:
    "minmax(170px,1.1fr) minmax(260px,1.6fr) 72px 110px 120px 115px 120px 72px",
  gap: "7px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "7px",
  fontWeight: 850,
};

const plannerBillingRow: React.CSSProperties = {
  minHeight: "48px",
  padding: "6px 12px",
  display: "grid",
  gridTemplateColumns:
    "minmax(170px,1.1fr) minmax(260px,1.6fr) 72px 110px 120px 115px 120px 72px",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "#10233a",
  fontSize: "7.5px",
};

const plannerWorkTitle: React.CSSProperties = {
  display: "block",
  fontSize: "9.5px",
  fontWeight: 850,
};

const plannerWorkSub: React.CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
};

const plannerStatus: React.CSSProperties = {
  minHeight: "20px",
  padding: "0 6px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
  fontSize: "7px",
  fontWeight: 850,
};

const plannerStatusReady: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
};

const plannerStatusDrafted: React.CSSProperties = {
  color: "#475569",
  background: "#eef2f6",
};

const plannerStatusOverdue: React.CSSProperties = {
  color: "#b42318",
  background: "#fff1f2",
};

const plannerActionLink: React.CSSProperties = {
  minHeight: "24px",
  padding: "0 7px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "7px",
  fontWeight: 850,
};

const plannerSplit: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.15fr",
  gap: "10px",
};

const plannerEmptyVisual: React.CSSProperties = {
  minHeight: "250px",
  padding: "24px",
  display: "grid",
  placeItems: "center",
  alignContent: "center",
  gap: "5px",
  color: "#64748b",
  textAlign: "center",
  fontSize: "8px",
  background:
    "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
};

const plannerEmptyIcon: React.CSSProperties = {
  color: "#1758d5",
  fontSize: "34px",
  fontWeight: 900,
};

const plannerMiniTabs: React.CSSProperties = {
  display: "flex",
  gap: "4px",
};

const plannerMiniTab: React.CSSProperties = {
  height: "26px",
  padding: "0 8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#526174",
  fontSize: "7px",
  fontWeight: 800,
};

const plannerMiniTabActive: React.CSSProperties = {
  height: "26px",
  padding: "0 8px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "7px",
  fontWeight: 850,
};

const plannerMonthGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0,1fr))",
};

const plannerMonthMetric: React.CSSProperties = {
  minHeight: "104px",
  padding: "12px",
  display: "grid",
  alignContent: "center",
  gap: "2px",
  borderRight: "1px solid #e5eaf0",
  color: "#526174",
  fontSize: "7px",
};

const economicsHeader: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "64px",
  padding: "9px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const economicsEyebrow: React.CSSProperties = {
  color: "#1758d5",
  fontSize: "8px",
  fontWeight: 900,
};

const economicsTitle: React.CSSProperties = {
  margin: "2px 0 0",
  fontSize: "16px",
  fontWeight: 900,
};

const economicsSubtitle: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "9px",
};

const economicsHeaderActions: React.CSSProperties = {
  display: "flex",
  gap: "5px",
};

const economicsSegmentButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const economicsSegmentButtonActive: React.CSSProperties = {
  background: "#10233a",
  borderColor: "#10233a",
  color: "#ffffff",
};

const economicsKpiGrid: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "7px",
};

const economicsKpi: React.CSSProperties = {
  minHeight: "66px",
  padding: "8px 9px",
  display: "grid",
  alignContent: "center",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const economicsKpiLabel: React.CSSProperties = {
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const economicsKpiValue: React.CSSProperties = {
  marginTop: "2px",
  color: "#10233a",
  fontSize: "18px",
  fontWeight: 900,
};

const economicsKpiSub: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7.5px",
};

const economicsToolbar: React.CSSProperties = {
  marginTop: "8px",
  padding: "7px 9px",
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr) auto",
  gap: "8px",
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const economicsSearch: React.CSSProperties = {
  height: "28px",
  padding: "0 7px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8px",
};

const economicsToolbarCount: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 800,
};

const economicsPanel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const economicsTableHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(190px,1.25fr) 125px 120px 92px 120px 135px 115px 135px minmax(165px,1fr)",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "7.5px",
  fontWeight: 850,
};

const economicsTableRow: React.CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "5px 9px",
  display: "grid",
  gridTemplateColumns:
    "minmax(190px,1.25fr) 125px 120px 92px 120px 135px 115px 135px minmax(165px,1fr)",
  gap: "7px",
  alignItems: "center",
  border: "none",
  borderBottom: "1px solid #e5eaf0",
  background: "#ffffff",
  color: "#10233a",
  textAlign: "left",
  cursor: "pointer",
};

const economicsTableRowSelected: React.CSSProperties = {
  background: "#f4f8fc",
  boxShadow: "inset 3px 0 0 #1758d5",
};

const economicsClientName: React.CSSProperties = {
  display: "block",
  fontSize: "9px",
  fontWeight: 900,
};

const economicsClientMeta: React.CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7px",
};

const economicsCell: React.CSSProperties = {
  fontSize: "8px",
  textTransform: "capitalize",
};

const economicsCellStrong: React.CSSProperties = {
  fontSize: "8px",
  fontWeight: 900,
};

const economicsStatus: React.CSSProperties = {
  display: "inline-flex",
  minHeight: "21px",
  padding: "0 6px",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid transparent",
  fontSize: "7.5px",
  fontWeight: 850,
};

const economicsHealthy: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const economicsRisk: React.CSSProperties = {
  color: "#8a5a00",
  background: "#fff8e6",
  borderColor: "#f0c36b",
};

const economicsLoss: React.CSSProperties = {
  color: "#991b1b",
  background: "#fff1f2",
  borderColor: "#fecaca",
};

const economicsIncomplete: React.CSSProperties = {
  color: "#526174",
  background: "#f8fafc",
  borderColor: "#e2e8f0",
};

const economicsAction: React.CSSProperties = {
  color: "#526174",
  fontSize: "7.5px",
  fontWeight: 800,
};

const economicsLowerGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr .8fr .8fr",
  gap: "8px",
};

const economicsTermsBody: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
};

const economicsTermsColumn: React.CSSProperties = {
  minHeight: "118px",
  padding: "8px 9px",
  display: "grid",
  alignContent: "start",
  gap: "5px",
  borderRight: "1px solid #e5eaf0",
};

const economicsTermsHeading: React.CSSProperties = {
  color: "#526174",
  fontSize: "8px",
  fontWeight: 900,
};

const economicsServiceLine: React.CSSProperties = {
  color: "#334155",
  fontSize: "7.5px",
};

const economicsMuted: React.CSSProperties = {
  color: "#64748b",
  fontSize: "7.5px",
  lineHeight: 1.4,
};

const economicsBars: React.CSSProperties = {
  padding: "9px 10px",
  display: "grid",
  gap: "10px",
};

const economicsBarRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px minmax(100px,1fr) 95px",
  gap: "7px",
  alignItems: "center",
  color: "#526174",
  fontSize: "7.5px",
};

const economicsBarTrack: React.CSSProperties = {
  height: "12px",
  background: "#edf2f7",
};

const economicsBarFill: React.CSSProperties = {
  height: "100%",
  background: "#1758d5",
};

const economicsBarFillCost: React.CSSProperties = {
  height: "100%",
  background: "#5b8def",
};

const economicsRecoveryBox: React.CSSProperties = {
  marginTop: "2px",
  padding: "8px 9px",
  display: "grid",
  gap: "2px",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "8px",
};

const economicsRiskHeader: React.CSSProperties = {
  minHeight: "28px",
  padding: "0 9px",
  display: "grid",
  gridTemplateColumns: "1.2fr 100px 75px",
  gap: "6px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "7.5px",
  fontWeight: 850,
};

const economicsRiskRow: React.CSSProperties = {
  minHeight: "34px",
  padding: "4px 9px",
  display: "grid",
  gridTemplateColumns: "1.2fr 100px 75px",
  gap: "6px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  fontSize: "7.5px",
};

const reportPlaceholder: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "180px",
  padding: "22px 18px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const reportPlaceholderNumber: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 850,
};

const reportPlaceholderTitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#10233a",
  fontSize: "16px",
  fontWeight: 900,
};

const reportPlaceholderText: React.CSSProperties = {
  maxWidth: "760px",
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: "10px",
  lineHeight: 1.45,
};

const errorBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: "9px",
  fontWeight: 800,
};
