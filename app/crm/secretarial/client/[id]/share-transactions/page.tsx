"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ClientRow = {
  id: string;
  client_name: string;
  registration_number: string | null;
};

type Shareholder = {
  id: string;
  full_legal_name: string;
  id_registration_number: string | null;
  is_active: boolean | null;
};

type ShareClass = {
  id: string;
  class_name: string;
  series_designation: string | null;
};

type Transaction = {
  transaction_type: string | null;
  number_of_shares: number | null;
  shareholder_id: string | null;
  share_class_id: string | null;
};

type Holding = {
  shareholderId: string;
  shareClassId: string;
  shares: number;
};

function signed(type: string | null, shares: number | null) {
  const value = Number(shares || 0);
  const normal = String(type || "").toLowerCase();

  if (normal === "issue" || normal === "transfer_in") return value;

  if (
    normal === "transfer_out" ||
    normal === "redemption" ||
    normal === "repurchase" ||
    normal === "cancellation"
  ) {
    return -value;
  }

  return 0;
}

export default function ShareTransactionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = params.id;

  const [client, setClient] = useState<ClientRow | null>(null);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [shareClasses, setShareClasses] = useState<ShareClass[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [transactionType, setTransactionType] =
    useState<"transfer" | "cancellation">("transfer");
  const [fromShareholderId, setFromShareholderId] = useState("");
  const [toShareholderId, setToShareholderId] = useState("");
  const [shareClassId, setShareClassId] = useState("");
  const [numberOfShares, setNumberOfShares] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const [clientResult, shareholderResult, classResult, transactionResult] =
      await Promise.all([
        supabase
          .from("crm_clients")
          .select("id, client_name, registration_number")
          .eq("id", clientId)
          .single(),
        supabase
          .from("secretarial_shareholders")
          .select(
            "id, full_legal_name, id_registration_number, is_active"
          )
          .eq("client_id", clientId)
          .order("full_legal_name"),
        supabase
          .from("secretarial_share_classes")
          .select("id, class_name, series_designation")
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("class_name"),
        supabase
          .from("secretarial_share_transactions")
          .select(
            "transaction_type, number_of_shares, shareholder_id, share_class_id"
          )
          .eq("client_id", clientId),
      ]);

    if (clientResult.error || !clientResult.data) {
      setError("Could not load the client.");
      setLoading(false);
      return;
    }

    setClient(clientResult.data as ClientRow);
    setShareholders((shareholderResult.data || []) as Shareholder[]);
    setShareClasses((classResult.data || []) as ShareClass[]);
    setTransactions((transactionResult.data || []) as Transaction[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [clientId]);

  const holdings = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of transactions) {
      if (!row.shareholder_id || !row.share_class_id) continue;

      const key = `${row.shareholder_id}:${row.share_class_id}`;
      map.set(
        key,
        (map.get(key) || 0) +
          signed(row.transaction_type, row.number_of_shares)
      );
    }

    return Array.from(map.entries())
      .map(([key, shares]) => {
        const [shareholderId, shareClassId] = key.split(":");
        return { shareholderId, shareClassId, shares };
      })
      .filter((row) => row.shares > 0);
  }, [transactions]);

  const selectedHolding = holdings.find(
    (row) =>
      row.shareholderId === fromShareholderId &&
      row.shareClassId === shareClassId
  );

  const availableShares = selectedHolding?.shares || 0;

  const holderName = (id: string) =>
    shareholders.find((row) => row.id === id)?.full_legal_name || "—";

  const className = (id: string) => {
    const row = shareClasses.find((item) => item.id === id);
    if (!row) return "—";
    return `${row.class_name}${
      row.series_designation ? ` · ${row.series_designation}` : ""
    }`;
  };

  async function submit() {
    setMessage("");
    setError("");

    if (!fromShareholderId || !shareClassId || !numberOfShares) {
      setError("Complete the shareholding change.");
      return;
    }

    if (transactionType === "transfer" && !toShareholderId) {
      setError("Select the shareholder receiving the shares.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Your session has expired.");

      const response = await fetch(
        "/api/crm/secretarial/share-transactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            clientId,
            transactionType,
            fromShareholderId,
            toShareholderId:
              transactionType === "transfer" ? toShareholderId : null,
            shareClassId,
            numberOfShares,
            effectiveDate,
            reference,
            notes,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not post the transaction.");
      }

      setMessage(result.message || "Share transaction posted.");
      setNumberOfShares("");
      setReference("");
      setNotes("");
      setFromShareholderId("");
      setToShareholderId("");
      setShareClassId("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not post the share transaction."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={page}><div style={panel}>Loading share register...</div></main>;
  }

  if (!client) {
    return <main style={page}><div style={panel}>{error || "Client not found."}</div></main>;
  }

  return (
    <main style={page}>
      <section style={crumbBar}>
        <Link href="/crm/secretarial" style={crumbLink}>SECRETARIAL</Link>
        <span style={divider}>|</span>
        <Link
          href={`/crm/secretarial/client/${client.id}?view=shareholders`}
          style={crumbLink}
        >
          {client.client_name}
        </Link>
        <span style={divider}>|</span>
        <strong>Change Shareholding</strong>
      </section>

      <section style={header}>
        <div>
          <div style={eyebrow}>SHARE TRANSACTION</div>
          <h1 style={title}>Change Shareholding</h1>
          <p style={subtitle}>
            Transfer or cancel existing shares without overwriting the historical register.
          </p>
        </div>
        <Link
          href={`/crm/secretarial/client/${client.id}?view=shareholders`}
          style={secondaryButton}
        >
          Back to Shareholders
        </Link>
      </section>

      {message ? <div style={success}>{message}</div> : null}
      {error ? <div style={warning}>{error}</div> : null}

      <section style={panel}>
        <div style={panelHeading}>
          <div>
            <h2 style={sectionTitle}>Current holdings</h2>
            <p style={sectionSubtitle}>
              This is calculated from the permanent securities transaction history.
            </p>
          </div>
        </div>

        <div style={tableHeader}>
          <div>SHAREHOLDER</div>
          <div>SHARE CLASS</div>
          <div>LIVE SHARES</div>
        </div>

        {holdings.length ? (
          holdings.map((row) => (
            <div
              key={`${row.shareholderId}-${row.shareClassId}`}
              style={tableRow}
            >
              <strong>{holderName(row.shareholderId)}</strong>
              <div>{className(row.shareClassId)}</div>
              <strong>{row.shares.toLocaleString("en-ZA")}</strong>
            </div>
          ))
        ) : (
          <div style={empty}>No current shareholdings found.</div>
        )}
      </section>

      <section style={panel}>
        <div style={panelHeading}>
          <div>
            <h2 style={sectionTitle}>Post shareholding change</h2>
            <p style={sectionSubtitle}>
              Existing certificates affected by this change will be superseded and replacement certificates will be queued. The old certificate remains in history.
            </p>
          </div>
        </div>

        <div style={modeRow}>
          <button
            type="button"
            onClick={() => setTransactionType("transfer")}
            style={{
              ...modeButton,
              ...(transactionType === "transfer" ? modeButtonActive : {}),
            }}
          >
            Transfer Shares
          </button>
          <button
            type="button"
            onClick={() => {
              setTransactionType("cancellation");
              setToShareholderId("");
            }}
            style={{
              ...modeButton,
              ...(transactionType === "cancellation"
                ? modeButtonActive
                : {}),
            }}
          >
            Cancel / Surrender Shares
          </button>
        </div>

        <div style={formGrid}>
          <label style={field}>
            <span style={label}>FROM SHAREHOLDER</span>
            <select
              value={fromShareholderId}
              onChange={(event) => {
                setFromShareholderId(event.target.value);
                setShareClassId("");
              }}
              style={input}
            >
              <option value="">Select shareholder</option>
              {shareholders
                .filter((row) => row.is_active !== false)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.full_legal_name}
                  </option>
                ))}
            </select>
          </label>

          <label style={field}>
            <span style={label}>SHARE CLASS</span>
            <select
              value={shareClassId}
              onChange={(event) => setShareClassId(event.target.value)}
              style={input}
              disabled={!fromShareholderId}
            >
              <option value="">Select class</option>
              {Array.from(
                new Set(
                  holdings
                    .filter(
                      (row) => row.shareholderId === fromShareholderId
                    )
                    .map((row) => row.shareClassId)
                )
              ).map((id) => (
                <option key={id} value={id}>
                  {className(id)}
                </option>
              ))}
            </select>
          </label>

          {transactionType === "transfer" ? (
            <label style={field}>
              <span style={label}>TO SHAREHOLDER</span>
              <select
                value={toShareholderId}
                onChange={(event) => setToShareholderId(event.target.value)}
                style={input}
              >
                <option value="">Select shareholder</option>
                {shareholders
                  .filter(
                    (row) =>
                      row.is_active !== false &&
                      row.id !== fromShareholderId
                  )
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.full_legal_name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <div />
          )}

          <label style={field}>
            <span style={label}>NUMBER OF SHARES</span>
            <input
              type="number"
              min="1"
              max={availableShares || undefined}
              value={numberOfShares}
              onChange={(event) => setNumberOfShares(event.target.value)}
              style={input}
            />
            <span style={help}>
              Available: {availableShares.toLocaleString("en-ZA")}
            </span>
          </label>

          <label style={field}>
            <span style={label}>EFFECTIVE DATE</span>
            <input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>REFERENCE</span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Resolution / transfer reference"
              style={input}
            />
          </label>
        </div>

        <label style={field}>
          <span style={label}>NOTES / REASON</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            style={textarea}
          />
        </label>

        <div style={impact}>
          <strong>Certificate impact</strong>
          <span>
            Posting this transaction will not edit an old certificate. Affected issued certificates are marked superseded and PracticePilot creates a replacement queue for the new live holdings.
          </span>
        </div>

        <div style={footer}>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/crm/secretarial/client/${client.id}?view=shareholders`
              )
            }
            style={secondaryButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            style={{
              ...primaryButton,
              ...(saving ? disabledButton : {}),
            }}
          >
            {saving
              ? "Posting..."
              : transactionType === "transfer"
                ? "Post Share Transfer"
                : "Post Cancellation"}
          </button>
        </div>
      </section>
    </main>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  padding: "10px",
  background: "#eef2f6",
  color: "#111827",
  fontFamily: "Arial, sans-serif",
};

const crumbBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "11px 12px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
  fontSize: "11px",
};

const crumbLink: CSSProperties = {
  color: "#2457d6",
  fontWeight: 900,
  textDecoration: "none",
};

const divider: CSSProperties = { color: "#94a3b8" };

const header: CSSProperties = {
  marginTop: "8px",
  padding: "16px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "20px",
};

const eyebrow: CSSProperties = {
  color: "#2457d6",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "0.08em",
};

const title: CSSProperties = {
  margin: "5px 0 3px",
  fontSize: "24px",
};

const subtitle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: "12px",
};

const panel: CSSProperties = {
  marginTop: "8px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const panelHeading: CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #d2d9e2",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: "17px",
};

const sectionSubtitle: CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "11px",
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1.3fr 140px",
  gap: "12px",
  padding: "9px 12px",
  background: "#f6f8fb",
  borderBottom: "1px solid #d2d9e2",
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 900,
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1.3fr 140px",
  gap: "12px",
  padding: "11px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: "11px",
};

const empty: CSSProperties = {
  padding: "18px 12px",
  color: "#64748b",
  fontSize: "11px",
};

const modeRow: CSSProperties = {
  display: "flex",
  gap: "8px",
  padding: "12px 14px 0",
};

const modeButton: CSSProperties = {
  padding: "9px 12px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer",
};

const modeButtonActive: CSSProperties = {
  background: "#10243d",
  color: "#ffffff",
  borderColor: "#10243d",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  padding: "14px",
};

const field: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  padding: "0 14px 14px",
};

const label: CSSProperties = {
  color: "#475569",
  fontSize: "9px",
  fontWeight: 900,
};

const input: CSSProperties = {
  minHeight: "40px",
  border: "1px solid #cbd5e1",
  padding: "0 10px",
  background: "#ffffff",
  fontSize: "12px",
};

const textarea: CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "9px 10px",
  background: "#ffffff",
  fontSize: "12px",
  resize: "vertical",
};

const help: CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
};

const impact: CSSProperties = {
  margin: "0 14px 14px",
  padding: "11px",
  border: "1px solid #b7f7d0",
  background: "#ecfdf3",
  color: "#166534",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontSize: "10px",
};

const footer: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  padding: "12px 14px",
  borderTop: "1px solid #d2d9e2",
};

const secondaryButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "38px",
  padding: "0 14px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#111827",
  fontSize: "11px",
  fontWeight: 900,
  textDecoration: "none",
  cursor: "pointer",
};

const primaryButton: CSSProperties = {
  minHeight: "38px",
  padding: "0 16px",
  border: "1px solid #10243d",
  background: "#10243d",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
};

const disabledButton: CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};

const success: CSSProperties = {
  marginTop: "8px",
  padding: "11px",
  border: "1px solid #b7f7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "11px",
  fontWeight: 800,
};

const warning: CSSProperties = {
  marginTop: "8px",
  padding: "11px",
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: "11px",
  fontWeight: 800,
};
