// Path: app/billing/afs/page.tsx

"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Organisation = {
  id: string;
  name: string;
  afs_billing_enabled: boolean;
  afs_plan: "flex" | "unlimited" | null;
  afs_flex_monthly_fee: number;
  afs_flex_included_per_month: number;
  afs_flex_extra_price: number;
  afs_unlimited_user_price: number;
  afs_unlimited_licence_count: number;
};

type Summary = {
  free_credits_remaining: number;
  afs_this_month: number;
  uninvoiced_amount: number;
  invoiced_amount: number;
};

type BillingItem = {
  id: string;
  client_name: string | null;
  financial_year_end: string | null;
  charge_type: string;
  billing_amount: number;
  billing_status: string;
  invoice_number: string | null;
  triggered_at: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export default function AfsBillingPage() {
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [canManagePlan, setCanManagePlan] = useState(false);
  const [licenceCount, setLicenceCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const token = await getToken();

    if (!token) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/billing/afs", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error || "Could not load AFS billing.");
      setLoading(false);
      return;
    }

    setOrganisation(json.organisation ?? null);
    setSummary(json.summary ?? null);
    setItems(json.items ?? []);
    setCanManagePlan(Boolean(json.canManagePlan));

    if (Number(json.organisation?.afs_unlimited_licence_count || 0) > 0) {
      setLicenceCount(Number(json.organisation.afs_unlimited_licence_count));
    }

    setLoading(false);
  }

  async function choosePlan(plan: "flex" | "unlimited") {
    if (!canManagePlan) return;

    setSaving(true);
    setError(null);

    const token = await getToken();

    const response = await fetch("/api/billing/afs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan,
        licence_count: plan === "unlimited" ? licenceCount : 0,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error || "Could not save your AFS plan.");
      setSaving(false);
      return;
    }

    await load();
    setSaving(false);
  }

  const plan = organisation?.afs_plan ?? null;
  const owing =
    Number(summary?.uninvoiced_amount || 0) +
    Number(summary?.invoiced_amount || 0);

  const history = useMemo(
    () => items.filter((item) => item.billing_status !== "cancelled"),
    [items]
  );

  const monthlyUnlimited =
    licenceCount * Number(organisation?.afs_unlimited_user_price || 0);

  if (loading) {
    return <main style={s.page}>Loading AFS billing...</main>;
  }

  return (
    <main style={s.page}>
      <Link href="/billing" style={s.back}>← Back to Billing</Link>

      <section style={s.hero}>
        <div>
          <h1 style={s.title}>Financial Statements</h1>
          <p style={s.subtitle}>{organisation?.name}</p>
        </div>

        <div style={s.heroRight}>
          <div style={s.heroRightTitle}>{plan ? "Current plan" : "Free trial"}</div>
          <div style={s.heroRightValue}>
            {plan === "flex"
              ? "AFS Flex"
              : plan === "unlimited"
                ? "AFS Unlimited"
                : `${summary?.free_credits_remaining ?? 0} free AFS left`}
          </div>
        </div>
      </section>

      {error ? <div style={s.error}>{error}</div> : null}

      {!plan ? (
        <section style={s.chooseArea}>
          <div style={s.chooseIntro}>
            <h2 style={s.h2}>Choose your plan</h2>
            <p style={s.body}>
              Your free AFS are used first. Your paid plan starts only after the
              free credits are finished.
            </p>
          </div>

          <div style={s.planGrid}>
            <article style={s.flexCard}>
              <div>
                <div style={s.planName}>AFS Flex</div>
                <div style={s.planPrice}>
                  {money(organisation?.afs_flex_monthly_fee)}
                  <span> / month</span>
                </div>
                <p style={s.planText}>
                  For practices that prepare fewer financial statements.
                </p>

                <ul style={s.list}>
                  <li>1 AFS included each month</li>
                  <li>
                    {money(organisation?.afs_flex_extra_price)} per additional AFS
                  </li>
                  <li>One price for the practice</li>
                </ul>
              </div>

              {canManagePlan ? (
                <button
                  type="button"
                  style={s.flexButton}
                  disabled={saving}
                  onClick={() => choosePlan("flex")}
                >
                  Choose Flex
                </button>
              ) : null}
            </article>

            <article style={s.unlimitedCard}>
              <div>
                <div style={s.recommended}>Best for busy practices</div>
                <div style={s.planName}>AFS Unlimited</div>
                <div style={s.planPrice}>
                  {money(organisation?.afs_unlimited_user_price)}
                  <span> / user / month</span>
                </div>
                <p style={s.planText}>
                  Unlimited AFS for the number of licences your practice needs.
                </p>

                <ul style={s.list}>
                  <li>Unlimited AFS</li>
                  <li>No per-AFS charge</li>
                  <li>Buy only the number of licences you need</li>
                </ul>

                <div style={s.licenceArea}>
                  <div>
                    <div style={s.licenceTitle}>How many AFS licences?</div>
                    <div style={s.licenceHelp}>
                      You can assign these licences to staff separately.
                    </div>
                  </div>

                  <div style={s.counter}>
                    <button
                      type="button"
                      style={s.counterButton}
                      onClick={() => setLicenceCount((count) => Math.max(1, count - 1))}
                    >
                      −
                    </button>
                    <div style={s.counterValue}>{licenceCount}</div>
                    <button
                      type="button"
                      style={s.counterButton}
                      onClick={() => setLicenceCount((count) => count + 1)}
                    >
                      +
                    </button>
                  </div>

                  <div style={s.monthlyTotal}>
                    Monthly total: <strong>{money(monthlyUnlimited)}</strong>
                  </div>
                </div>
              </div>

              {canManagePlan ? (
                <button
                  type="button"
                  style={s.unlimitedButton}
                  disabled={saving}
                  onClick={() => choosePlan("unlimited")}
                >
                  Choose Unlimited
                </button>
              ) : null}
            </article>
          </div>

          {!canManagePlan ? (
            <div style={s.managerNote}>
              Your Client Manager must choose the plan for the practice.
            </div>
          ) : null}
        </section>
      ) : (
        <section style={s.currentPlan}>
          <div style={s.currentPlanMain}>
            <div style={s.currentPlanTitle}>
              {plan === "flex" ? "AFS Flex" : "AFS Unlimited"}
            </div>

            <div style={s.currentPlanMeta}>
              {plan === "flex"
                ? `${money(organisation?.afs_flex_monthly_fee)} / month`
                : `${organisation?.afs_unlimited_licence_count || 0} licence(s) · ${money(
                    Number(organisation?.afs_unlimited_licence_count || 0) *
                      Number(organisation?.afs_unlimited_user_price || 0)
                  )} / month`}
            </div>

            <div style={s.body}>
              {organisation?.afs_billing_enabled
                ? "Your paid AFS plan is active."
                : `${summary?.free_credits_remaining ?? 0} free AFS are still available before billing starts.`}
            </div>
          </div>

          <div style={s.lockBox}>
            <div style={s.lockTitle}>Plan locked</div>
            <div style={s.lockText}>
              Your AFS plan cannot be changed online. To change your plan or licence quantity, please contact PracticePilot.
            </div>
            <a
              href="mailto:ferdi_v@practicepilot.co.za?subject=PracticePilot%20AFS%20plan%20change"
              style={s.contactLink}
            >
              Email PracticePilot
            </a>
          </div>
        </section>
      )}

      <section style={s.simpleSummary}>
        <div>
          <div style={s.simpleTitle}>Used this month</div>
          <div style={s.simpleValue}>{summary?.afs_this_month ?? 0} AFS</div>
        </div>
        <div>
          <div style={s.simpleTitle}>Amount owing</div>
          <div style={s.simpleValue}>{money(owing)}</div>
        </div>
      </section>

      <section style={s.history}>
        <h2 style={s.h2}>Billing history</h2>

        {history.length === 0 ? (
          <div style={s.empty}>No AFS billing history yet.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Client</th>
                <th style={s.th}>Year end</th>
                <th style={s.th}>Status</th>
                <th style={s.thRight}>Amount</th>
                <th style={s.th}>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td style={s.tdStrong}>{item.client_name || "-"}</td>
                  <td style={s.td}>{item.financial_year_end || "-"}</td>
                  <td style={s.td}>{item.billing_status}</td>
                  <td style={s.tdRight}>{money(item.billing_amount)}</td>
                  <td style={s.td}>{item.invoice_number || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 54px)",
    background: "#f3f7fb",
    padding: "26px 32px 40px",
    color: "#0f172a",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  back: {
    display: "inline-block",
    marginBottom: 14,
    color: "#0b5cab",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0b2f4f",
    color: "#ffffff",
    borderLeft: "6px solid #00a6b4",
    padding: "22px 24px",
    marginBottom: 18,
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#d7e5ef",
    fontSize: 14,
  },
  heroRight: {
    textAlign: "right",
  },
  heroRightTitle: {
    color: "#bcd1df",
    fontSize: 14,
  },
  heroRightValue: {
    marginTop: 5,
    fontSize: 21,
    fontWeight: 900,
  },
  error: {
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 12,
    marginBottom: 16,
  },
  chooseArea: {
    background: "#ffffff",
    border: "1px solid #d7e1eb",
    padding: 22,
    marginBottom: 18,
  },
  chooseIntro: {
    marginBottom: 18,
  },
  h2: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
  },
  body: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
  },
  planGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 18,
    alignItems: "stretch",
  },
  flexCard: {
    border: "2px solid #d7e1eb",
    padding: 22,
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 470,
  },
  unlimitedCard: {
    border: "2px solid #00a6b4",
    padding: 22,
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 470,
  },
  recommended: {
    color: "#008b96",
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 7,
  },
  planName: {
    fontSize: 23,
    fontWeight: 900,
  },
  planPrice: {
    marginTop: 10,
    fontSize: 31,
    fontWeight: 900,
    color: "#0b5cab",
  },
  planText: {
    marginTop: 8,
    color: "#526273",
    fontSize: 15,
  },
  list: {
    margin: "18px 0 0 18px",
    padding: 0,
    color: "#334155",
    fontSize: 15,
    lineHeight: 1.8,
  },
  licenceArea: {
    marginTop: 20,
    padding: 16,
    background: "#f5fbfc",
    border: "1px solid #d5eff1",
  },
  licenceTitle: {
    fontSize: 16,
    fontWeight: 900,
  },
  licenceHelp: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
  },
  counter: {
    display: "inline-grid",
    gridTemplateColumns: "42px 64px 42px",
    alignItems: "center",
    marginTop: 14,
    border: "1px solid #b9dfe2",
  },
  counterButton: {
    height: 40,
    border: 0,
    background: "#ffffff",
    color: "#0b5cab",
    fontSize: 22,
    fontWeight: 900,
    cursor: "pointer",
  },
  counterValue: {
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderLeft: "1px solid #b9dfe2",
    borderRight: "1px solid #b9dfe2",
    fontSize: 18,
    fontWeight: 900,
    background: "#ffffff",
  },
  monthlyTotal: {
    marginTop: 13,
    color: "#0b5cab",
    fontSize: 15,
  },
  flexButton: {
    marginTop: 20,
    width: "100%",
    border: 0,
    background: "#0b5cab",
    color: "#ffffff",
    padding: 12,
    fontSize: 14,
    fontWeight: 900,
  },
  unlimitedButton: {
    marginTop: 20,
    width: "100%",
    border: 0,
    background: "#00a6b4",
    color: "#ffffff",
    padding: 12,
    fontSize: 14,
    fontWeight: 900,
  },
  managerNote: {
    marginTop: 14,
    padding: 11,
    background: "#f8fafc",
    color: "#64748b",
  },
  currentPlan: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(340px, 0.7fr)",
    gap: 18,
    alignItems: "stretch",
    background: "#ffffff",
    border: "1px solid #d7e1eb",
    borderLeft: "6px solid #00a6b4",
    padding: "18px 20px",
    marginBottom: 18,
  },
  currentPlanMain: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  currentPlanTitle: {
    fontSize: 22,
    fontWeight: 900,
  },
  currentPlanMeta: {
    marginTop: 6,
    fontSize: 19,
    fontWeight: 900,
    color: "#0b5cab",
  },
  lockBox: {
    background: "#f8fafc",
    border: "1px solid #d7e1eb",
    padding: "14px 16px",
  },
  lockTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
  },
  lockText: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  contactLink: {
    display: "inline-block",
    marginTop: 10,
    color: "#0b5cab",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },
  simpleSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },
  simpleTitle: {
    color: "#64748b",
    fontSize: 14,
  },
  simpleValue: {
    marginTop: 5,
    fontSize: 22,
    fontWeight: 900,
  },
  history: {
    background: "#ffffff",
    border: "1px solid #d7e1eb",
    padding: 20,
  },
  empty: {
    marginTop: 12,
    background: "#f8fafc",
    padding: 14,
    color: "#64748b",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 14,
  },
  th: {
    textAlign: "left",
    padding: "9px 10px",
    background: "#eef5fa",
    fontSize: 13,
  },
  thRight: {
    textAlign: "right",
    padding: "9px 10px",
    background: "#eef5fa",
    fontSize: 13,
  },
  td: {
    padding: "9px 10px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 13,
  },
  tdStrong: {
    padding: "9px 10px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 13,
    fontWeight: 800,
  },
  tdRight: {
    padding: "9px 10px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 13,
    textAlign: "right",
  },
};
