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

type TransactionType = "issue" | "transfer" | "cancellation";
type Step = 1 | 2 | 3 | 4;

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
  authorised_shares: number | null;
  issued_shares: number | null;
};

type Transaction = {
  transaction_type: string | null;
  number_of_shares: number | null;
  shareholder_id: string | null;
  share_class_id: string | null;
};

type Certificate = {
  certificate_number: string | null;
};

type Holding = {
  shareholderId: string;
  shareClassId: string;
  shares: number;
};

const FLIGHT_PLAN = [
  { step: 1, label: "Transaction" },
  { step: 2, label: "Allocation" },
  { step: 3, label: "Review" },
  { step: 4, label: "Complete" },
] as const;

const DEFAULT_TRANSFER_RESTRICTION =
  "The transfer of these shares is subject to the restrictions contained in the company's Memorandum of Incorporation.";

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

function nextCertificateNumber(certificates: Certificate[]) {
  const numeric = certificates
    .map((row) => String(row.certificate_number || "").trim())
    .filter((value) => /^\d+$/.test(value))
    .map((value) => Number(value));

  const next = numeric.length ? Math.max(...numeric) + 1 : 1;
  return String(next).padStart(3, "0");
}

export default function ShareTransactionFlightPlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = String(params?.id || "");

  const [client, setClient] = useState<ClientRow | null>(null);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [shareClasses, setShareClasses] = useState<ShareClass[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>(1);
  const [transactionType, setTransactionType] =
    useState<TransactionType>("issue");

  const [fromShareholderId, setFromShareholderId] = useState("");
  const [toShareholderId, setToShareholderId] = useState("");
  const [shareClassId, setShareClassId] = useState("");
  const [numberOfShares, setNumberOfShares] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [certificateNumber, setCertificateNumber] = useState("");
  const [considerationPerShare, setConsiderationPerShare] = useState("");
  const [amountPaidPerShare, setAmountPaidPerShare] = useState("");
  const [fullyPaid, setFullyPaid] = useState(true);
  const [placeOfIssue, setPlaceOfIssue] = useState("Pretoria");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  async function load() {
    setLoading(true);
    setError("");

    const [
      clientResult,
      shareholderResult,
      classResult,
      transactionResult,
      certificateResult,
    ] = await Promise.all([
      supabase
        .from("crm_clients")
        .select("id,client_name,registration_number")
        .eq("id", clientId)
        .single(),
      supabase
        .from("secretarial_shareholders")
        .select("id,full_legal_name,id_registration_number,is_active")
        .eq("client_id", clientId)
        .order("full_legal_name"),
      supabase
        .from("secretarial_share_classes")
        .select(
          "id,class_name,series_designation,authorised_shares,issued_shares",
        )
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("class_name"),
      supabase
        .from("secretarial_share_transactions")
        .select(
          "transaction_type,number_of_shares,shareholder_id,share_class_id",
        )
        .eq("client_id", clientId),
      supabase
        .from("secretarial_share_certificates")
        .select("certificate_number")
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
    setCertificates((certificateResult.data || []) as Certificate[]);

    if (!certificateNumber) {
      setCertificateNumber(
        nextCertificateNumber((certificateResult.data || []) as Certificate[]),
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    if (clientId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const activeShareholders = shareholders.filter(
    (row) => row.is_active !== false,
  );

  const holdings = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of transactions) {
      if (!row.shareholder_id || !row.share_class_id) continue;

      const key = `${row.shareholder_id}:${row.share_class_id}`;
      map.set(
        key,
        (map.get(key) || 0) +
          signed(row.transaction_type, row.number_of_shares),
      );
    }

    return Array.from(map.entries())
      .map(([key, shares]) => {
        const [shareholderId, shareClassId] = key.split(":");
        return { shareholderId, shareClassId, shares };
      })
      .filter((row) => row.shares > 0);
  }, [transactions]);

  const selectedFromHolding = holdings.find(
    (row) =>
      row.shareholderId === fromShareholderId &&
      row.shareClassId === shareClassId,
  );

  const availableShares = selectedFromHolding?.shares || 0;

  const selectedShareClass =
    shareClasses.find((row) => row.id === shareClassId) || null;

  const selectedFromShareholder =
    activeShareholders.find((row) => row.id === fromShareholderId) || null;

  const selectedToShareholder =
    activeShareholders.find((row) => row.id === toShareholderId) || null;

  const totalConsideration =
    Number(numberOfShares || 0) * Number(considerationPerShare || 0);

  function holderName(id: string) {
    return activeShareholders.find((row) => row.id === id)?.full_legal_name || "—";
  }

  function className(id: string) {
    const row = shareClasses.find((item) => item.id === id);
    if (!row) return "—";
    return `${row.class_name}${
      row.series_designation ? ` · ${row.series_designation}` : ""
    }`;
  }

  function resetForType(nextType: TransactionType) {
    setTransactionType(nextType);
    setFromShareholderId("");
    setToShareholderId("");
    setShareClassId("");
    setNumberOfShares("");
    setReference("");
    setNotes("");
    setError("");
  }

  function validateStepOne() {
    if (!effectiveDate) return "Select the effective date.";
    return "";
  }

  function validateStepTwo() {
    const shares = Number(numberOfShares);

    if (!shareClassId) return "Select the share class.";
    if (!Number.isFinite(shares) || shares <= 0) {
      return "Enter a valid number of shares.";
    }

    if (transactionType === "issue") {
      if (!toShareholderId) return "Select the shareholder receiving the shares.";
      if (!certificateNumber.trim()) return "Enter the certificate number.";

      const authorised = Number(selectedShareClass?.authorised_shares || 0);
      const issued = Number(selectedShareClass?.issued_shares || 0);

      if (authorised > 0 && issued + shares > authorised) {
        return "This issue would exceed the authorised shares for this class.";
      }

      return "";
    }

    if (!fromShareholderId) return "Select the current shareholder.";
    if (shares > availableShares) {
      return `Only ${availableShares.toLocaleString("en-ZA")} shares are available.`;
    }

    if (transactionType === "transfer") {
      if (!toShareholderId) return "Select the shareholder receiving the shares.";
      if (fromShareholderId === toShareholderId) {
        return "The transferor and transferee cannot be the same shareholder.";
      }
    }

    return "";
  }

  function nextStep() {
    setError("");

    const issue =
      step === 1 ? validateStepOne() : step === 2 ? validateStepTwo() : "";

    if (issue) {
      setError(issue);
      return;
    }

    if (step < 4) setStep((step + 1) as Step);
  }

  async function completeTransaction() {
    const validation = validateStepTwo();

    if (validation) {
      setError(validation);
      setStep(2);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Your session has expired.");

      const response = await fetch("/api/crm/secretarial/share-transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clientId,
          transactionType,
          fromShareholderId:
            transactionType === "issue" ? null : fromShareholderId,
          toShareholderId,
          shareClassId,
          numberOfShares,
          effectiveDate,
          reference,
          notes,
          certificateNumber:
            transactionType === "issue" ? certificateNumber : null,
          considerationPerShare:
            transactionType === "issue" ? considerationPerShare : null,
          amountPaidPerShare:
            transactionType === "issue" ? amountPaidPerShare : null,
          fullyPaid,
          placeOfIssue,
          transferRestriction: DEFAULT_TRANSFER_RESTRICTION,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not post the share transaction.");
      }

      setResult(payload);
      setStep(4);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not post the share transaction.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.panel}>Loading Share Transaction Flight Plan...</div>
      </main>
    );
  }

  if (!client) {
    return (
      <main style={styles.page}>
        <div style={styles.panel}>{error || "Client not found."}</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.crumbBar}>
        <Link href="/crm/secretarial" style={styles.crumbLink}>
          SECRETARIAL
        </Link>
        <span style={styles.muted}>|</span>
        <Link
          href={`/crm/secretarial/client/${client.id}?view=shareholders`}
          style={styles.crumbLink}
        >
          {client.client_name}
        </Link>
        <span style={styles.muted}>|</span>
        <strong>Share Transaction Flight Plan</strong>
      </section>

      <section style={styles.header}>
        <div>
          <div style={styles.eyebrow}>SECRETARIAL · FLIGHT PLAN</div>
          <h1 style={styles.title}>New Share Transaction</h1>
          <p style={styles.subtitle}>
            Capture the transaction once. PracticePilot updates the statutory history and certificate position from it.
          </p>
        </div>

        <Link
          href={`/crm/secretarial/client/${client.id}?view=shareholders`}
          style={styles.secondaryButton}
        >
          Exit Flight Plan
        </Link>
      </section>

      <section style={styles.flightPlan}>
        {FLIGHT_PLAN.map((item, index) => {
          const complete = item.step < step || (item.step === 4 && Boolean(result));
          const active = item.step === step;

          return (
            <div key={item.step} style={styles.flightStepWrap}>
              <div
                style={{
                  ...styles.flightStep,
                  ...(active ? styles.flightStepActive : {}),
                  ...(complete ? styles.flightStepComplete : {}),
                }}
              >
                <span style={styles.stepNumber}>
                  {complete ? "✓" : item.step}
                </span>
                <span>{item.label}</span>
              </div>
              {index < FLIGHT_PLAN.length - 1 ? (
                <div style={styles.flightLine} />
              ) : null}
            </div>
          );
        })}
      </section>

      {error ? <div style={styles.warning}>{error}</div> : null}

      {step === 1 ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.sectionTitle}>1. What happened?</h2>
              <p style={styles.sectionSubtitle}>
                Choose the transaction. The rest of the Flight Plan adapts automatically.
              </p>
            </div>
          </div>

          <div style={styles.transactionGrid}>
            <TransactionChoice
              active={transactionType === "issue"}
              title="Issue Shares"
              description="Create new issued shares and the related certificate."
              onClick={() => resetForType("issue")}
            />
            <TransactionChoice
              active={transactionType === "transfer"}
              title="Transfer Shares"
              description="Move existing shares from one shareholder to another."
              onClick={() => resetForType("transfer")}
            />
            <TransactionChoice
              active={transactionType === "cancellation"}
              title="Cancel / Surrender"
              description="Reduce a shareholder's holding and issued shares."
              onClick={() => resetForType("cancellation")}
            />
          </div>

          <div style={styles.twoColumns}>
            <Field label="EFFECTIVE DATE">
              <input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                style={styles.input}
              />
            </Field>
            <Field label="REFERENCE">
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Optional resolution / transaction reference"
                style={styles.input}
              />
            </Field>
          </div>

          <div style={styles.footer}>
            <span />
            <button type="button" onClick={nextStep} style={styles.primaryButton}>
              Continue to Allocation →
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.sectionTitle}>2. Who and how many?</h2>
              <p style={styles.sectionSubtitle}>
                PP uses the existing shareholder master and share classes. Nothing is recaptured.
              </p>
            </div>
          </div>

          {transactionType === "issue" ? (
            <>
              <div style={styles.twoColumns}>
                <Field label="SHAREHOLDER RECEIVING SHARES">
                  <select
                    value={toShareholderId}
                    onChange={(event) => setToShareholderId(event.target.value)}
                    style={styles.input}
                  >
                    <option value="">Select shareholder</option>
                    {activeShareholders.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.full_legal_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="SHARE CLASS">
                  <select
                    value={shareClassId}
                    onChange={(event) => setShareClassId(event.target.value)}
                    style={styles.input}
                  >
                    <option value="">Select share class</option>
                    {shareClasses.map((row) => (
                      <option key={row.id} value={row.id}>
                        {className(row.id)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="NUMBER OF SHARES">
                  <input
                    type="number"
                    min="1"
                    value={numberOfShares}
                    onChange={(event) => setNumberOfShares(event.target.value)}
                    style={styles.input}
                  />
                </Field>

                <Field label="CERTIFICATE NUMBER">
                  <input
                    value={certificateNumber}
                    onChange={(event) => setCertificateNumber(event.target.value)}
                    style={styles.input}
                  />
                </Field>

                <Field label="CONSIDERATION PER SHARE">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={considerationPerShare}
                    onChange={(event) =>
                      setConsiderationPerShare(event.target.value)
                    }
                    placeholder="0.00"
                    style={styles.input}
                  />
                </Field>

                <Field label="AMOUNT PAID PER SHARE">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaidPerShare}
                    onChange={(event) => setAmountPaidPerShare(event.target.value)}
                    placeholder="0.00"
                    style={styles.input}
                  />
                </Field>

                <Field label="PLACE OF ISSUE">
                  <input
                    value={placeOfIssue}
                    onChange={(event) => setPlaceOfIssue(event.target.value)}
                    style={styles.input}
                  />
                </Field>

                <label style={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={fullyPaid}
                    onChange={(event) => setFullyPaid(event.target.checked)}
                  />
                  <span>Shares are fully paid</span>
                </label>
              </div>

              {selectedShareClass ? (
                <div style={styles.impactStrip}>
                  <span>
                    Authorised:{" "}
                    <strong>
                      {Number(
                        selectedShareClass.authorised_shares || 0,
                      ).toLocaleString("en-ZA")}
                    </strong>
                  </span>
                  <span>
                    Currently issued:{" "}
                    <strong>
                      {Number(
                        selectedShareClass.issued_shares || 0,
                      ).toLocaleString("en-ZA")}
                    </strong>
                  </span>
                  <span>
                    After this issue:{" "}
                    <strong>
                      {(
                        Number(selectedShareClass.issued_shares || 0) +
                        Number(numberOfShares || 0)
                      ).toLocaleString("en-ZA")}
                    </strong>
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div style={styles.twoColumns}>
                <Field label="CURRENT SHAREHOLDER">
                  <select
                    value={fromShareholderId}
                    onChange={(event) => {
                      setFromShareholderId(event.target.value);
                      setShareClassId("");
                    }}
                    style={styles.input}
                  >
                    <option value="">Select shareholder</option>
                    {activeShareholders.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.full_legal_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="SHARE CLASS">
                  <select
                    value={shareClassId}
                    onChange={(event) => setShareClassId(event.target.value)}
                    style={styles.input}
                    disabled={!fromShareholderId}
                  >
                    <option value="">Select class</option>
                    {Array.from(
                      new Set(
                        holdings
                          .filter(
                            (row) => row.shareholderId === fromShareholderId,
                          )
                          .map((row) => row.shareClassId),
                      ),
                    ).map((id) => (
                      <option key={id} value={id}>
                        {className(id)}
                      </option>
                    ))}
                  </select>
                </Field>

                {transactionType === "transfer" ? (
                  <Field label="SHAREHOLDER RECEIVING SHARES">
                    <select
                      value={toShareholderId}
                      onChange={(event) => setToShareholderId(event.target.value)}
                      style={styles.input}
                    >
                      <option value="">Select shareholder</option>
                      {activeShareholders
                        .filter((row) => row.id !== fromShareholderId)
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.full_legal_name}
                          </option>
                        ))}
                    </select>
                  </Field>
                ) : (
                  <div />
                )}

                <Field label="NUMBER OF SHARES">
                  <input
                    type="number"
                    min="1"
                    max={availableShares || undefined}
                    value={numberOfShares}
                    onChange={(event) => setNumberOfShares(event.target.value)}
                    style={styles.input}
                  />
                  <span style={styles.help}>
                    Available: {availableShares.toLocaleString("en-ZA")}
                  </span>
                </Field>
              </div>

              <div style={styles.impactBox}>
                <strong>Certificate impact</strong>
                <span>
                  Existing certificates are never overwritten. Affected certificates are marked as replaced and PP queues the replacement certificates required for the new live holdings.
                </span>
              </div>
            </>
          )}

          <Field label="NOTES / REASON">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              style={styles.textarea}
            />
          </Field>

          <div style={styles.footer}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={styles.secondaryButton}
            >
              ← Back
            </button>
            <button type="button" onClick={nextStep} style={styles.primaryButton}>
              Review Transaction →
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.sectionTitle}>3. Review impact</h2>
              <p style={styles.sectionSubtitle}>
                Nothing is posted until you click Complete Transaction.
              </p>
            </div>
          </div>

          <div style={styles.reviewTable}>
            <ReviewRow label="Transaction" value={
              transactionType === "issue"
                ? "Issue Shares"
                : transactionType === "transfer"
                  ? "Transfer Shares"
                  : "Cancel / Surrender Shares"
            } />
            <ReviewRow label="Effective date" value={effectiveDate} />
            <ReviewRow label="Share class" value={className(shareClassId)} />
            <ReviewRow
              label="Shares"
              value={Number(numberOfShares || 0).toLocaleString("en-ZA")}
            />

            {transactionType === "issue" ? (
              <>
                <ReviewRow
                  label="Issued to"
                  value={selectedToShareholder?.full_legal_name || "—"}
                />
                <ReviewRow label="Certificate" value={certificateNumber || "—"} />
                <ReviewRow
                  label="Total consideration"
                  value={
                    considerationPerShare
                      ? `R ${totalConsideration.toFixed(2)}`
                      : "Not specified"
                  }
                />
                <ReviewRow
                  label="PP will update"
                  value="Issued shares · Securities register · Shareholder holding · Certificate register"
                />
              </>
            ) : (
              <>
                <ReviewRow
                  label="From"
                  value={selectedFromShareholder?.full_legal_name || "—"}
                />
                {transactionType === "transfer" ? (
                  <ReviewRow
                    label="To"
                    value={selectedToShareholder?.full_legal_name || "—"}
                  />
                ) : null}
                <ReviewRow
                  label="Current holding"
                  value={availableShares.toLocaleString("en-ZA")}
                />
                <ReviewRow
                  label="Resulting holding"
                  value={(availableShares - Number(numberOfShares || 0)).toLocaleString("en-ZA")}
                />
                <ReviewRow
                  label="PP will update"
                  value="Securities register · Live holdings · Existing certificate status · Replacement certificate queue"
                />
              </>
            )}
          </div>

          <div style={styles.reviewNotice}>
            <strong>One transaction. One source of truth.</strong>
            <span>
              PP records the movement first. Certificates and registers follow from that transaction instead of being captured independently.
            </span>
          </div>

          <div style={styles.footer}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={styles.secondaryButton}
            >
              ← Change
            </button>
            <button
              type="button"
              onClick={completeTransaction}
              disabled={saving}
              style={{
                ...styles.primaryButton,
                ...(saving ? styles.disabledButton : {}),
              }}
            >
              {saving ? "Posting..." : "Complete Transaction"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section style={styles.panel}>
          <div style={styles.completePanel}>
            <div style={styles.completeMark}>✓</div>
            <div>
              <h2 style={styles.completeTitle}>
                {result ? "Transaction complete" : "Ready to complete"}
              </h2>
              <p style={styles.sectionSubtitle}>
                {result?.message ||
                  "Review the transaction and complete it from the previous step."}
              </p>
            </div>
          </div>

          {result ? (
            <>
              <div style={styles.resultGrid}>
                <ResultTile
                  label="TRANSACTION"
                  value={
                    transactionType === "issue"
                      ? "Share issue posted"
                      : transactionType === "transfer"
                        ? "Share transfer posted"
                        : "Share cancellation posted"
                  }
                />
                <ResultTile
                  label="REGISTER"
                  value="Updated automatically"
                />
                <ResultTile
                  label="CERTIFICATES"
                  value={
                    transactionType === "issue"
                      ? `Certificate ${result.certificateNumber || certificateNumber} issued`
                      : `${Number(result.replacementCount || 0)} replacement item(s) queued`
                  }
                />
              </div>

              <div style={styles.footer}>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/crm/secretarial/client/${client.id}?view=registers`,
                    )
                  }
                  style={styles.secondaryButton}
                >
                  View Register
                </button>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/crm/secretarial/client/${client.id}?view=certificates`,
                    )
                  }
                  style={styles.primaryButton}
                >
                  View Certificates
                </button>
              </div>
            </>
          ) : (
            <div style={styles.footer}>
              <button
                type="button"
                onClick={() => setStep(3)}
                style={styles.secondaryButton}
              >
                ← Back to Review
              </button>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

function TransactionChoice({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.transactionChoice,
        ...(active ? styles.transactionChoiceActive : {}),
      }}
    >
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.reviewRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.resultTile}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "10px",
    background: "#eef2f6",
    color: "#111827",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  crumbBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    border: "1px solid #d2d9e2",
    background: "#ffffff",
    fontSize: 11,
  },
  crumbLink: {
    color: "#2457d6",
    fontWeight: 900,
    textDecoration: "none",
  },
  muted: { color: "#94a3b8" },
  header: {
    marginTop: 8,
    padding: "15px 16px",
    border: "1px solid #d2d9e2",
    background: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },
  eyebrow: {
    color: "#2457d6",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },
  title: { margin: "4px 0 3px", fontSize: 24 },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
  },
  flightPlan: {
    marginTop: 8,
    minHeight: 62,
    padding: "10px 16px",
    border: "1px solid #d2d9e2",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
  },
  flightStepWrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
  },
  flightStep: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  flightStepActive: { color: "#2457d6" },
  flightStepComplete: { color: "#166534" },
  stepNumber: {
    width: 25,
    height: 25,
    border: "1px solid currentColor",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 900,
  },
  flightLine: {
    height: 1,
    flex: 1,
    minWidth: 20,
    margin: "0 12px",
    background: "#d2d9e2",
  },
  panel: {
    marginTop: 8,
    border: "1px solid #d2d9e2",
    background: "#ffffff",
  },
  panelHeader: {
    padding: "14px 16px",
    borderBottom: "1px solid #d2d9e2",
  },
  sectionTitle: { margin: 0, fontSize: 17 },
  sectionSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.45,
  },
  transactionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    padding: 14,
  },
  transactionChoice: {
    minHeight: 86,
    padding: 12,
    textAlign: "left",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  transactionChoiceActive: {
    border: "2px solid #2457d6",
    background: "#f5f8ff",
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    padding: "0 14px 14px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    padding: "0 14px 14px",
  },
  label: {
    color: "#475569",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.03em",
  },
  input: {
    minHeight: 38,
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    background: "#ffffff",
    fontSize: 12,
    boxSizing: "border-box",
  },
  textarea: {
    border: "1px solid #cbd5e1",
    padding: "9px 10px",
    background: "#ffffff",
    fontSize: 12,
    resize: "vertical",
  },
  help: {
    color: "#64748b",
    fontSize: 9,
  },
  checkboxField: {
    minHeight: 38,
    margin: "17px 14px 14px",
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #cbd5e1",
    fontSize: 11,
    fontWeight: 800,
  },
  impactStrip: {
    margin: "0 14px 14px",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    border: "1px solid #d2d9e2",
    background: "#f8fafc",
  },
  impactBox: {
    margin: "0 14px 14px",
    padding: 11,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e3a8a",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 10,
    lineHeight: 1.4,
  },
  reviewTable: {
    margin: 14,
    borderTop: "1px solid #d2d9e2",
  },
  reviewRow: {
    minHeight: 42,
    padding: "9px 10px",
    borderBottom: "1px solid #d2d9e2",
    display: "grid",
    gridTemplateColumns: "180px minmax(0, 1fr)",
    gap: 15,
    alignItems: "center",
    fontSize: 11,
  },
  reviewNotice: {
    margin: "0 14px 14px",
    padding: 12,
    borderLeft: "3px solid #2457d6",
    background: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 11,
    lineHeight: 1.45,
  },
  footer: {
    minHeight: 58,
    padding: "10px 14px",
    borderTop: "1px solid #d2d9e2",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  primaryButton: {
    minHeight: 38,
    padding: "0 16px",
    border: "1px solid #10243d",
    background: "#10243d",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: 38,
    padding: "0 14px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    fontSize: 11,
    fontWeight: 900,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  disabledButton: { opacity: 0.55, cursor: "not-allowed" },
  warning: {
    marginTop: 8,
    padding: 11,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 11,
    fontWeight: 800,
  },
  completePanel: {
    padding: 20,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  completeMark: {
    width: 40,
    height: 40,
    border: "2px solid #166534",
    color: "#166534",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 900,
  },
  completeTitle: { margin: 0, fontSize: 18 },
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    borderTop: "1px solid #d2d9e2",
    borderBottom: "1px solid #d2d9e2",
  },
  resultTile: {
    padding: 14,
    borderRight: "1px solid #d2d9e2",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    fontSize: 11,
  },
};

