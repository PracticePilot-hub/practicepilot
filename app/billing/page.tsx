// Path: app/billing/page.tsx

"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type PaiaOrganisation = {
  id: string;
  name: string;
  paia_manual_price: number;
  paia_billing_enabled: boolean;
};

type PaiaSummary = {
  totalManuals: number;
  freeManuals: number;
  uninvoicedAmount: number;
  invoicedAmount: number;
  paidAmount: number;
};

type AfsOrganisation = {
  id: string;
  name: string;
  afs_plan: "flex" | "unlimited" | null;
  afs_flex_monthly_fee: number;
  afs_unlimited_user_price: number;
};

type AfsSummary = {
  free_credits_remaining: number;
  afs_this_month: number;
  uninvoiced_amount: number;
  invoiced_amount: number;
  paid_amount: number;
};

type BillingResponse<TOrganisation, TSummary> = {
  organisation: TOrganisation | null;
  summary: TSummary | null;
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

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function fetchBilling<T>(url: string, accessToken: string): Promise<T | null> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  return (await response.json()) as T;
}

export default function BillingPage() {
  const [paia, setPaia] = useState<
    BillingResponse<PaiaOrganisation, PaiaSummary> | null
  >(null);
  const [afs, setAfs] = useState<
    BillingResponse<AfsOrganisation, AfsSummary> | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const accessToken = await token();

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    const [paiaResult, afsResult] = await Promise.all([
      fetchBilling<BillingResponse<PaiaOrganisation, PaiaSummary>>(
        "/api/billing/paia",
        accessToken
      ),
      fetchBilling<BillingResponse<AfsOrganisation, AfsSummary>>(
        "/api/billing/afs",
        accessToken
      ),
    ]);

    setPaia(paiaResult);
    setAfs(afsResult);
    setLoading(false);
  }

  const firmName =
    afs?.organisation?.name ||
    paia?.organisation?.name ||
    "Your organisation";

  const totals = useMemo(() => {
    const uninvoiced =
      Number(paia?.summary?.uninvoicedAmount || 0) +
      Number(afs?.summary?.uninvoiced_amount || 0);
    const invoiced =
      Number(paia?.summary?.invoicedAmount || 0) +
      Number(afs?.summary?.invoiced_amount || 0);
    const paid =
      Number(paia?.summary?.paidAmount || 0) +
      Number(afs?.summary?.paid_amount || 0);

    return { uninvoiced, invoiced, paid };
  }, [paia, afs]);

  if (loading) {
    return <main style={s.page}>Loading billing...</main>;
  }

  const afsPlan =
    afs?.organisation?.afs_plan === "flex"
      ? "AFS Flex"
      : afs?.organisation?.afs_plan === "unlimited"
        ? "AFS Unlimited"
        : "Free trial";

  return (
    <main style={s.page}>
      <section style={s.intro}>
        <div>
          <h1 style={s.title}>Billing</h1>
          <p style={s.subtitle}>{firmName}</p>
        </div>
        <Link href="/dashboard" style={s.backLink}>Back to PilotHub</Link>
      </section>

      <section style={s.owePanel}>
        <div style={s.oweMain}>
          <div style={s.oweQuestion}>What do I owe right now?</div>
          <div style={s.oweAmount}>{money(totals.uninvoiced + totals.invoiced)}</div>
          <div style={s.oweBreakdown}>
            {money(totals.uninvoiced)} waiting to be invoiced · {money(totals.invoiced)} already invoiced
          </div>
        </div>

        <div style={s.paidBox}>
          <div style={s.paidTitle}>Paid</div>
          <div style={s.paidAmount}>{money(totals.paid)}</div>
        </div>
      </section>

      <section style={s.products}>
        <article style={s.afsCard}>
          <div style={s.cardTop}>
            <div>
              <div style={s.cardTitle}>Financial Statements</div>
              <div style={s.cardSub}>{afsPlan}</div>
            </div>
            <div style={s.afsBadge}>AFS</div>
          </div>

          <div style={s.bigStatement}>
            {afsPlan === "Free trial"
              ? `${afs?.summary?.free_credits_remaining ?? 0} free AFS remaining`
              : afsPlan}
          </div>

          <div style={s.cardFacts}>
            <Fact label="Used this month" value={`${afs?.summary?.afs_this_month ?? 0} AFS`} />
            <Fact label="Amount owing" value={money(
              Number(afs?.summary?.uninvoiced_amount || 0) +
              Number(afs?.summary?.invoiced_amount || 0)
            )} />
          </div>

          <Link href="/billing/afs" style={s.primaryButton}>
            {afsPlan === "Free trial" ? "Choose your AFS plan" : "Manage AFS billing"}
          </Link>
        </article>

        <article style={s.paiaCard}>
          <div style={s.cardTop}>
            <div>
              <div style={s.cardTitle}>PAIA Manuals</div>
              <div style={s.cardSub}>Pay per manual</div>
            </div>
            <div style={s.paiaBadge}>PAIA</div>
          </div>

          <div style={s.bigStatement}>
            {money(paia?.organisation?.paia_manual_price)} per manual
          </div>

          <div style={s.cardFacts}>
            <Fact label="Manuals created" value={String(paia?.summary?.totalManuals ?? 0)} />
            <Fact label="Waiting to be invoiced" value={money(paia?.summary?.uninvoicedAmount)} />
          </div>

          <Link href="/billing/paia" style={s.secondaryButton}>
            View PAIA billing
          </Link>
        </article>
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.fact}>
      <div style={s.factLabel}>{label}</div>
      <div style={s.factValue}>{value}</div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 54px)",
    background: "#f3f7fb",
    padding: "28px 32px 40px",
    color: "#0f172a",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  intro: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 900,
  },
  subtitle: {
    margin: "6px 0 0",
    fontSize: 15,
    color: "#64748b",
  },
  backLink: {
    color: "#0b5cab",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
  },
  owePanel: {
    display: "grid",
    gridTemplateColumns: "1.6fr 0.7fr",
    marginBottom: 22,
    border: "1px solid #d7e1eb",
    background: "#ffffff",
  },
  oweMain: {
    background: "#0b2f4f",
    color: "#ffffff",
    padding: "26px 28px",
  },
  oweQuestion: {
    fontSize: 17,
    fontWeight: 700,
  },
  oweAmount: {
    marginTop: 8,
    fontSize: 38,
    fontWeight: 900,
  },
  oweBreakdown: {
    marginTop: 8,
    fontSize: 14,
    color: "#d4e3ee",
  },
  paidBox: {
    padding: "26px 28px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  paidTitle: {
    fontSize: 15,
    color: "#64748b",
  },
  paidAmount: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: 900,
  },
  products: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 18,
  },
  afsCard: {
    background: "#ffffff",
    border: "1px solid #d7e1eb",
    borderTop: "6px solid #00a6b4",
    padding: 24,
  },
  paiaCard: {
    background: "#ffffff",
    border: "1px solid #d7e1eb",
    borderTop: "6px solid #0b5cab",
    padding: 24,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 900,
  },
  cardSub: {
    marginTop: 5,
    fontSize: 14,
    color: "#64748b",
  },
  afsBadge: {
    background: "#e7fbfc",
    color: "#007d86",
    padding: "6px 9px",
    fontSize: 13,
    fontWeight: 900,
  },
  paiaBadge: {
    background: "#eaf3ff",
    color: "#0b5cab",
    padding: "6px 9px",
    fontSize: 13,
    fontWeight: 900,
  },
  bigStatement: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: 900,
    color: "#0b2f4f",
  },
  cardFacts: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    marginTop: 22,
    marginBottom: 22,
  },
  fact: {
    background: "#f7fafc",
    border: "1px solid #e2e8f0",
    padding: "14px 16px",
  },
  factLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  factValue: {
    marginTop: 5,
    fontSize: 19,
    fontWeight: 900,
  },
  primaryButton: {
    display: "inline-block",
    background: "#00a6b4",
    color: "#ffffff",
    textDecoration: "none",
    padding: "11px 15px",
    fontSize: 14,
    fontWeight: 900,
  },
  secondaryButton: {
    display: "inline-block",
    background: "#0b5cab",
    color: "#ffffff",
    textDecoration: "none",
    padding: "11px 15px",
    fontSize: 14,
    fontWeight: 900,
  },
};
