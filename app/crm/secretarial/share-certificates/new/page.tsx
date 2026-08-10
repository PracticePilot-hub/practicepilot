"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type ClientRecord = {
  id: string;
  client_name: string | null;
  registration_number: string | null;
};

type ShareholderRecord = {
  id: string;
  full_legal_name: string;
  id_registration_number: string | null;
  holder_type: string;
};

type ShareClassRecord = {
  id: string;
  class_name: string;
  series_designation: string | null;
  authorised_shares: number | string | null;
  issued_shares: number | string | null;
};

type AllocationRow = {
  shareholderId: string;
  shares: string;
  certificateNumber: string;
};

const DEFAULT_TRANSFER_RESTRICTION =
  "The transfer of these shares is subject to the restrictions contained in the company’s Memorandum of Incorporation.";

export default function NewShareCertificatePage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId") || "";
  const preferredShareholderId = searchParams.get("shareholderId") || "";

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [shareholders, setShareholders] = useState<ShareholderRecord[]>([]);
  const [shareClasses, setShareClasses] = useState<ShareClassRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [shareClassId, setShareClassId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [placeOfIssue, setPlaceOfIssue] = useState("Pretoria");
  const [considerationPerShare, setConsiderationPerShare] = useState("");
  const [amountPaidPerShare, setAmountPaidPerShare] = useState("");
  const [fullyPaid, setFullyPaid] = useState(true);
  const [transferRestriction, setTransferRestriction] = useState(
    DEFAULT_TRANSFER_RESTRICTION
  );

  const [signatoryOneName, setSignatoryOneName] = useState("");
  const [signatoryOneCapacity, setSignatoryOneCapacity] = useState("Director");
  const [signatoryTwoName, setSignatoryTwoName] = useState("");
  const [signatoryTwoCapacity, setSignatoryTwoCapacity] = useState("Director");

  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savedMatters, setSavedMatters] = useState<
    { id: string; certificateNumber: string; shareholderName: string }[]
  >([]);

  useEffect(() => {
    async function load() {
      if (!clientId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const [clientResult, shareholderResult, classResult] = await Promise.all([
        supabase
          .from("crm_clients")
          .select("id, client_name, registration_number")
          .eq("id", clientId)
          .single(),

        supabase
          .from("secretarial_shareholders")
          .select("id, full_legal_name, id_registration_number, holder_type")
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("full_legal_name", { ascending: true }),

        supabase
          .from("secretarial_share_classes")
          .select(
            "id, class_name, series_designation, authorised_shares, issued_shares"
          )
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("class_name", { ascending: true }),
      ]);

      if (clientResult.error || !clientResult.data) {
        setError("The Secretarial client could not be loaded.");
        setLoading(false);
        return;
      }

      const loadedClient = clientResult.data as ClientRecord;
      const loadedShareholders =
        (shareholderResult.data || []) as ShareholderRecord[];
      const loadedClasses = (classResult.data || []) as ShareClassRecord[];

      setClient(loadedClient);
      setShareholders(loadedShareholders);
      setShareClasses(loadedClasses);

      if (loadedClasses.length) {
        setShareClassId(loadedClasses[0].id);
      }

      setAllocations(
        loadedShareholders.map((shareholder, index) => ({
          shareholderId: shareholder.id,
          shares: "",
          certificateNumber:
            shareholder.id === preferredShareholderId
              ? String(index + 1).padStart(3, "0")
              : "",
        }))
      );

      setLoading(false);
    }

    load();
  }, [clientId, preferredShareholderId]);

  const selectedClass = useMemo(
    () => shareClasses.find((row) => row.id === shareClassId) || null,
    [shareClasses, shareClassId]
  );

  const activeAllocations = useMemo(
    () =>
      allocations
        .map((row) => ({
          ...row,
          quantity: Number(row.shares),
        }))
        .filter((row) => Number.isFinite(row.quantity) && row.quantity > 0),
    [allocations]
  );

  const totalNewShares = useMemo(
    () => activeAllocations.reduce((sum, row) => sum + row.quantity, 0),
    [activeAllocations]
  );

  const totalIssuedAfter = useMemo(() => {
    const current = Number(selectedClass?.issued_shares || 0);
    return current + totalNewShares;
  }, [selectedClass, totalNewShares]);

  const authorisedShares = Number(selectedClass?.authorised_shares || 0);
  const exceedsAuthorised =
    authorisedShares > 0 && totalIssuedAfter > authorisedShares;

  function updateAllocation(
    shareholderId: string,
    field: "shares" | "certificateNumber",
    value: string
  ) {
    setAllocations((current) =>
      current.map((row) =>
        row.shareholderId === shareholderId ? { ...row, [field]: value } : row
      )
    );
  }

  function allocateToShareholder(shareholderId: string) {
    setAllocations((current) => {
      const usedNumbers = new Set(
        current
          .map((row) => Number(row.certificateNumber))
          .filter((value) => Number.isFinite(value) && value > 0)
      );

      let nextNumber = 1;
      while (usedNumbers.has(nextNumber)) nextNumber += 1;

      return current.map((row) =>
        row.shareholderId === shareholderId
          ? {
              ...row,
              shares: row.shares || "1",
              certificateNumber:
                row.certificateNumber || String(nextNumber).padStart(3, "0"),
            }
          : row
      );
    });
  }

  async function saveIssue() {
    if (saving) return;

    setError("");
    setMessage("");

    if (!clientId) {
      setError("Open the client from Secretarial before starting a share issue.");
      return;
    }

    if (!shareClassId) {
      setError("Select a share class.");
      return;
    }

    if (!activeAllocations.length) {
      setError("Allocate shares to at least one existing shareholder.");
      return;
    }

    if (exceedsAuthorised) {
      setError(
        "This issue would exceed the authorised shares for the selected class."
      );
      return;
    }

    for (const allocation of activeAllocations) {
      if (!allocation.certificateNumber.trim()) {
        const shareholder = shareholders.find(
          (row) => row.id === allocation.shareholderId
        );
        setError(
          `Enter a certificate number for ${
            shareholder?.full_legal_name || "each allocation"
          }.`
        );
        return;
      }
    }

    setSaving(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your login session could not be confirmed.");
      }

      const response = await fetch("/api/crm/secretarial/share-certificates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clientId,
          shareClassId,
          issueDate,
          placeOfIssue,
          considerationPerShare,
          amountPaidPerShare,
          fullyPaid,
          transferRestriction,
          signatoryOneName,
          signatoryOneCapacity,
          signatoryTwoName,
          signatoryTwoCapacity,
          allocations: activeAllocations.map((allocation) => ({
            shareholderId: allocation.shareholderId,
            numberOfShares: allocation.quantity,
            certificateNumber: allocation.certificateNumber.trim(),
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not create the share issue.");
      }

      setSavedMatters(result.matters || []);
      setMessage(
        `${result.matters?.length || activeAllocations.length} certificate matter(s) created from one share issue.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the share issue."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={page}><div style={panel}>Loading Secretarial client file…</div></div>;
  }

  if (!clientId || !client) {
    return (
      <div style={page}>
        <section style={panel}>
          <h1 style={title}>Start from the Secretarial client file</h1>
          <p style={muted}>
            A share issue belongs to one company. Select the client first so
            PracticePilot never asks you to capture the company again.
          </p>
          <Link href="/crm/secretarial" style={primaryButton}>
            Back to Secretarial Clients
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div style={page}>
      <section style={workingBar}>
        <span style={blueText}>SECRETARIAL</span>
        <span style={divider}>|</span>
        <Link
          href={`/crm/secretarial/client/${clientId}?view=shareholders`}
          style={crumb}
        >
          {client.client_name || "Client"}
        </Link>
        <span style={divider}>|</span>
        <span>New Share Issue</span>
      </section>

      <section style={headerPanel}>
        <div>
          <div style={miniLabel}>CLIENT LOCKED</div>
          <h1 style={title}>New Share Issue</h1>
          <div style={muted}>
            {client.client_name} · {client.registration_number || "No registration number"}
          </div>
        </div>

        <div style={headerActions}>
          <Link
            href={`/crm/secretarial/client/${clientId}?view=share-certificates`}
            style={secondaryButton}
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={saveIssue}
            disabled={saving || !!savedMatters.length}
            style={{
              ...primaryButton,
              opacity: saving || savedMatters.length ? 0.55 : 1,
            }}
          >
            {saving ? "Creating…" : savedMatters.length ? "Issue Created" : "Create Share Issue"}
          </button>
        </div>
      </section>

      {error ? <div style={errorBanner}>{error}</div> : null}
      {message ? <div style={successBanner}>{message}</div> : null}

      {savedMatters.length ? (
        <section style={panel}>
          <PanelHeading
            number="✓"
            title="Share issue created"
            subtitle="Each allocation has its own certificate matter, but the shareholders were selected from the permanent client master."
          />
          {savedMatters.map((matter) => (
            <div key={matter.id} style={savedRow}>
              <div>
                <strong>{matter.shareholderName}</strong>
                <div style={mutedSmall}>Certificate {matter.certificateNumber}</div>
              </div>
              <Link
                href={`/crm/secretarial/share-certificates/${matter.id}`}
                style={textLink}
              >
                Open Flight Map →
              </Link>
            </div>
          ))}
        </section>
      ) : (
        <>
          <section style={panel}>
            <PanelHeading
              number="01"
              title="Issue details"
              subtitle="Capture the transaction once. These details apply to every allocation in this issue."
            />

            <div style={formGrid3}>
              <Field label="SHARE CLASS">
                <select
                  value={shareClassId}
                  onChange={(event) => setShareClassId(event.target.value)}
                  style={input}
                >
                  <option value="">Select share class</option>
                  {shareClasses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.class_name}
                      {row.series_designation ? ` — ${row.series_designation}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="DATE OF ISSUE">
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  style={input}
                />
              </Field>

              <Field label="PLACE OF ISSUE">
                <input
                  value={placeOfIssue}
                  onChange={(event) => setPlaceOfIssue(event.target.value)}
                  style={input}
                />
              </Field>
            </div>

            <div style={formGrid2}>
              <Field label="CONSIDERATION PER SHARE">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={considerationPerShare}
                  onChange={(event) => setConsiderationPerShare(event.target.value)}
                  style={input}
                />
              </Field>

              <Field label="AMOUNT PAID PER SHARE">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaidPerShare}
                  onChange={(event) => setAmountPaidPerShare(event.target.value)}
                  style={input}
                />
              </Field>
            </div>

            <label style={checkboxRow}>
              <input
                type="checkbox"
                checked={fullyPaid}
                onChange={(event) => setFullyPaid(event.target.checked)}
              />
              Shares are fully paid
            </label>

            <Field label="TRANSFER RESTRICTION">
              <textarea
                value={transferRestriction}
                onChange={(event) => setTransferRestriction(event.target.value)}
                style={textarea}
              />
            </Field>
          </section>

          <section style={panel}>
            <PanelHeading
              number="02"
              title="Allot shares"
              subtitle="Choose from shareholders already captured in this client's Secretarial file. Nothing is re-entered."
              action={
                <Link
                  href={`/crm/secretarial/client/${clientId}?view=shareholders`}
                  style={secondaryButton}
                >
                  Add / Edit Shareholders
                </Link>
              }
            />

            {!shareholders.length ? (
              <div style={emptyState}>
                <strong>No shareholders have been captured yet.</strong>
                <span>
                  Add the shareholder master records first, then return here to allot shares.
                </span>
              </div>
            ) : (
              <>
                <div style={tableHeader}>
                  <div>SHAREHOLDER</div>
                  <div>ID / REGISTRATION</div>
                  <div>SHARES TO ALLOT</div>
                  <div>CERTIFICATE NO.</div>
                  <div>ACTION</div>
                </div>

                {shareholders.map((shareholder) => {
                  const row =
                    allocations.find(
                      (allocation) =>
                        allocation.shareholderId === shareholder.id
                    ) || {
                      shareholderId: shareholder.id,
                      shares: "",
                      certificateNumber: "",
                    };

                  const selected = Number(row.shares) > 0;

                  return (
                    <div
                      key={shareholder.id}
                      style={{
                        ...tableRow,
                        background: selected ? "#ecfdf3" : "#ffffff",
                      }}
                    >
                      <div>
                        <strong>{shareholder.full_legal_name}</strong>
                        <div style={mutedSmall}>{shareholder.holder_type}</div>
                      </div>
                      <div>{shareholder.id_registration_number || "—"}</div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.shares}
                        onChange={(event) =>
                          updateAllocation(
                            shareholder.id,
                            "shares",
                            event.target.value
                          )
                        }
                        style={compactInput}
                        placeholder="0"
                      />
                      <input
                        value={row.certificateNumber}
                        onChange={(event) =>
                          updateAllocation(
                            shareholder.id,
                            "certificateNumber",
                            event.target.value
                          )
                        }
                        style={compactInput}
                        placeholder="e.g. 002"
                      />
                      <button
                        type="button"
                        onClick={() => allocateToShareholder(shareholder.id)}
                        style={textButton}
                      >
                        {selected ? "Selected" : "Allot shares"}
                      </button>
                    </div>
                  );
                })}

                <div style={allocationSummary}>
                  <div>
                    <span style={miniLabel}>SHAREHOLDERS IN THIS ISSUE</span>
                    <strong>{activeAllocations.length}</strong>
                  </div>
                  <div>
                    <span style={miniLabel}>NEW SHARES</span>
                    <strong>{totalNewShares.toLocaleString("en-ZA")}</strong>
                  </div>
                  <div>
                    <span style={miniLabel}>ISSUED AFTER THIS ISSUE</span>
                    <strong>{totalIssuedAfter.toLocaleString("en-ZA")}</strong>
                  </div>
                  <div>
                    <span style={miniLabel}>AUTHORISED</span>
                    <strong>
                      {authorisedShares > 0
                        ? authorisedShares.toLocaleString("en-ZA")
                        : "Not captured"}
                    </strong>
                  </div>
                </div>

                {exceedsAuthorised ? (
                  <div style={warningBanner}>
                    This allocation exceeds the authorised shares for the selected class.
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section style={panel}>
            <PanelHeading
              number="03"
              title="Certificate signatories"
              subtitle="Captured once for this issue and applied to the certificate matters created from it."
            />

            <div style={formGrid2}>
              <Field label="AUTHORISED SIGNATORY 1">
                <input
                  value={signatoryOneName}
                  onChange={(event) => setSignatoryOneName(event.target.value)}
                  style={input}
                />
              </Field>
              <Field label="CAPACITY">
                <input
                  value={signatoryOneCapacity}
                  onChange={(event) =>
                    setSignatoryOneCapacity(event.target.value)
                  }
                  style={input}
                />
              </Field>
              <Field label="AUTHORISED SIGNATORY 2">
                <input
                  value={signatoryTwoName}
                  onChange={(event) => setSignatoryTwoName(event.target.value)}
                  style={input}
                />
              </Field>
              <Field label="CAPACITY">
                <input
                  value={signatoryTwoCapacity}
                  onChange={(event) =>
                    setSignatoryTwoCapacity(event.target.value)
                  }
                  style={input}
                />
              </Field>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PanelHeading({
  number,
  title,
  subtitle,
  action,
}: {
  number: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={panelHeading}>
      <div style={numberBox}>{number}</div>
      <div style={{ flex: 1 }}>
        <h2 style={sectionTitle}>{title}</h2>
        <div style={muted}>{subtitle}</div>
      </div>
      {action}
    </div>
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
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const page: React.CSSProperties = {
  padding: "10px 12px 30px",
  background: "#eef2f5",
  minHeight: "100vh",
  color: "#10233a",
};

const workingBar: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  minHeight: "42px",
  padding: "0 12px",
  border: "1px solid #d1dae5",
  background: "#ffffff",
  marginBottom: "10px",
  fontSize: "11px",
  fontWeight: 800,
};

const blueText: React.CSSProperties = { color: "#1758d5", fontWeight: 900 };
const divider: React.CSSProperties = { color: "#94a3b8" };
const crumb: React.CSSProperties = { color: "#10233a", textDecoration: "none" };

const headerPanel: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  alignItems: "center",
  padding: "16px",
  border: "1px solid #d1dae5",
  background: "#ffffff",
  marginBottom: "10px",
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const panel: React.CSSProperties = {
  border: "1px solid #d1dae5",
  background: "#ffffff",
  marginBottom: "10px",
};

const panelHeading: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "13px 14px",
  borderBottom: "1px solid #d1dae5",
};

const numberBox: React.CSSProperties = {
  width: "28px",
  height: "28px",
  display: "grid",
  placeItems: "center",
  border: "1px solid #cbd5e1",
  fontSize: "9px",
  fontWeight: 900,
};

const title: React.CSSProperties = {
  margin: "2px 0 4px",
  fontSize: "22px",
  lineHeight: 1.1,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
};

const muted: React.CSSProperties = {
  color: "#5e718a",
  fontSize: "10px",
  marginTop: "3px",
};

const mutedSmall: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  marginTop: "3px",
};

const miniLabel: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.06em",
  marginBottom: "4px",
};

const formGrid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr",
  gap: "10px",
  padding: "14px 14px 0",
};

const formGrid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  padding: "14px 14px 0",
};

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 900,
  color: "#31445c",
};

const input: React.CSSProperties = {
  minHeight: "38px",
  padding: "8px 10px",
  border: "1px solid #c9d4e2",
  background: "#ffffff",
  borderRadius: 0,
  fontSize: "11px",
  color: "#10233a",
};

const compactInput: React.CSSProperties = {
  minHeight: "34px",
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #c9d4e2",
  borderRadius: 0,
  fontSize: "10px",
  color: "#10233a",
  background: "#ffffff",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: "78px",
  margin: "0 14px 14px",
  width: "calc(100% - 28px)",
  resize: "vertical",
};

const checkboxRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  padding: "12px 14px",
  fontSize: "10px",
  fontWeight: 800,
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr 180px 180px 120px",
  gap: "10px",
  padding: "9px 12px",
  borderBottom: "1px solid #d1dae5",
  background: "#f5f7fa",
  fontSize: "8px",
  fontWeight: 900,
  color: "#586b84",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr 180px 180px 120px",
  gap: "10px",
  alignItems: "center",
  padding: "10px 12px",
  borderBottom: "1px solid #e1e6ed",
  fontSize: "10px",
};

const allocationSummary: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  borderTop: "1px solid #d1dae5",
  marginTop: "8px",
};

const savedRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 14px",
  borderBottom: "1px solid #e1e6ed",
  fontSize: "10px",
};

const emptyState: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "18px 14px",
  color: "#64748b",
  fontSize: "10px",
};

const primaryButton: React.CSSProperties = {
  display: "inline-block",
  padding: "11px 15px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
  borderRadius: 0,
};

const secondaryButton: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 13px",
  border: "1px solid #c9d4e2",
  background: "#ffffff",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 900,
  borderRadius: 0,
};

const textLink: React.CSSProperties = {
  color: "#1758d5",
  fontSize: "9px",
  fontWeight: 900,
  textDecoration: "none",
};

const textButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  padding: 0,
  color: "#1758d5",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "left",
};

const successBanner: React.CSSProperties = {
  padding: "11px 13px",
  border: "1px solid #b7efc9",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "10px",
  fontWeight: 900,
  marginBottom: "10px",
};

const errorBanner: React.CSSProperties = {
  padding: "11px 13px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: "10px",
  fontWeight: 900,
  marginBottom: "10px",
};

const warningBanner: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: "9px",
  fontWeight: 900,
};
