// Path: app/billing/paia/page.tsx

"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type BillingItem = {
  id: string;
  entity_name: string;
  entity_registration_number: string | null;
  created_at: string | null;
  is_free_manual: boolean;
  billing_amount: number;
  billing_status: string | null;
  invoice_number: string | null;
  invoiced_at: string | null;
};

type Summary = {
  totalManuals: number;
  freeManuals: number;
  uninvoicedAmount: number;
  invoicedAmount: number;
  paidAmount: number;
};

type Organisation = {
  id: string;
  name: string;
  paia_manual_price: number;
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

function date(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export default function PaiaBillingPage() {
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [search, setSearch] = useState("");
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

    const response = await fetch("/api/billing/paia", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await response.json();

    if (response.ok) {
      setOrganisation(json.organisation ?? null);
      setSummary(json.summary ?? null);
      setItems(json.items ?? []);
    }

    setLoading(false);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter(
      (item) =>
        String(item.entity_name || "").toLowerCase().includes(term) ||
        String(item.entity_registration_number || "").toLowerCase().includes(term) ||
        String(item.invoice_number || "").toLowerCase().includes(term)
    );
  }, [items, search]);

  if (loading) {
    return <main style={s.page}>Loading PAIA billing...</main>;
  }

  return (
    <main style={s.page}>
      <Link href="/billing" style={s.back}>← Back to Billing</Link>

      <section style={s.hero}>
        <div>
          <h1 style={s.title}>PAIA Manuals</h1>
          <p style={s.subtitle}>{organisation?.name}</p>
        </div>

        <div style={s.heroRight}>
          <div style={s.heroRightTitle}>Price per manual</div>
          <div style={s.heroRightValue}>{money(organisation?.paia_manual_price)}</div>
        </div>
      </section>

      <section style={s.summaryPanel}>
        <div style={s.summaryMain}>
          <div style={s.summaryQuestion}>What is waiting to be invoiced?</div>
          <div style={s.summaryBig}>{money(summary?.uninvoicedAmount)}</div>
          <div style={s.summaryNote}>{summary?.totalManuals ?? 0} manuals created in total</div>
        </div>

        <div style={s.summarySmall}>
          <div style={s.smallLabel}>Already invoiced</div>
          <div style={s.smallValue}>{money(summary?.invoicedAmount)}</div>
        </div>

        <div style={s.summarySmall}>
          <div style={s.smallLabel}>Paid</div>
          <div style={s.smallValue}>{money(summary?.paidAmount)}</div>
        </div>
      </section>

      <section style={s.history}>
        <div style={s.historyTop}>
          <div>
            <h2 style={s.h2}>Manuals and charges</h2>
            <p style={s.helper}>Search or review every PAIA manual billed to your practice.</p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search manuals"
            style={s.search}
          />
        </div>

        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Entity</th>
              <th style={s.th}>Registration</th>
              <th style={s.th}>Created</th>
              <th style={s.th}>Status</th>
              <th style={s.thRight}>Amount</th>
              <th style={s.th}>Invoice</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td style={s.tdStrong}>{item.entity_name}</td>
                <td style={s.td}>{item.entity_registration_number || "-"}</td>
                <td style={s.td}>{date(item.created_at)}</td>
                <td style={s.td}>
                  {item.is_free_manual ? "free" : item.billing_status || "uninvoiced"}
                </td>
                <td style={s.tdRight}>{money(item.billing_amount)}</td>
                <td style={s.td}>{item.invoice_number || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
    background: "#0b5cab",
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
    color: "#dce8f3",
    fontSize: 14,
  },
  heroRight: {
    textAlign: "right",
  },
  heroRightTitle: {
    color: "#dce8f3",
    fontSize: 14,
  },
  heroRightValue: {
    marginTop: 5,
    fontSize: 22,
    fontWeight: 900,
  },
  summaryPanel: {
    display: "grid",
    gridTemplateColumns: "1.5fr 0.7fr 0.7fr",
    background: "#ffffff",
    border: "1px solid #d7e1eb",
    marginBottom: 18,
  },
  summaryMain: {
    background: "#eef6ff",
    padding: "22px 24px",
  },
  summaryQuestion: {
    fontSize: 16,
    color: "#334155",
    fontWeight: 700,
  },
  summaryBig: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: 900,
    color: "#0b5cab",
  },
  summaryNote: {
    marginTop: 7,
    fontSize: 14,
    color: "#64748b",
  },
  summarySmall: {
    padding: "22px 24px",
    borderLeft: "1px solid #e2e8f0",
  },
  smallLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  smallValue: {
    marginTop: 8,
    fontSize: 23,
    fontWeight: 900,
  },
  history: {
    background: "#ffffff",
    border: "1px solid #d7e1eb",
    padding: 20,
  },
  historyTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: 18,
    marginBottom: 14,
  },
  h2: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
  },
  helper: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
  },
  search: {
    width: 320,
    height: 38,
    border: "1px solid #cfd8e3",
    padding: "0 10px",
    fontSize: 14,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px",
    background: "#eef5fa",
    fontSize: 13,
  },
  thRight: {
    textAlign: "right",
    padding: "10px",
    background: "#eef5fa",
    fontSize: 13,
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 13,
  },
  tdStrong: {
    padding: "10px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 13,
    fontWeight: 800,
  },
  tdRight: {
    padding: "10px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 13,
    textAlign: "right",
  },
};
