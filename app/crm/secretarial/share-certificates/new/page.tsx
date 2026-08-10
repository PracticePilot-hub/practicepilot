"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type ClientOption = {
  id: string;
  clientName: string;
  registrationNumber: string;
};

type ShareholderOption = {
  id: string;
  fullLegalName: string;
  idRegistrationNumber: string;
  holderType: string;
};



const DEFAULT_TRANSFER_RESTRICTION =
  "The transfer of these shares is subject to the restrictions contained in the company’s Memorandum of Incorporation.";

function NewShareCertificateContent() {
  const searchParams = useSearchParams();
  const requestedClientId = searchParams.get("clientId") || "";
  const requestedShareholderId = searchParams.get("shareholderId") || "";

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [shareholders, setShareholders] = useState<ShareholderOption[]>([]);
  const [shareholdersLoading, setShareholdersLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedMatterId, setSavedMatterId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(requestedClientId);
  const [selectedShareholderId, setSelectedShareholderId] = useState(
    requestedShareholderId
  );
  const [certificateNumber, setCertificateNumber] = useState("001");
  const [shareClass, setShareClass] = useState(
    "Ordinary no-par-value shares"
  );
  const [seriesDesignation, setSeriesDesignation] = useState("");
  const [numberOfShares, setNumberOfShares] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [placeOfIssue, setPlaceOfIssue] = useState("Pretoria");
  const [considerationPerShare, setConsiderationPerShare] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [fullyPaid, setFullyPaid] = useState(true);
  const [transferRestriction, setTransferRestriction] = useState(
    DEFAULT_TRANSFER_RESTRICTION
  );
  const [signatoryOneName, setSignatoryOneName] = useState("");
  const [signatoryOneCapacity, setSignatoryOneCapacity] =
    useState("Director");
  const [signatoryTwoName, setSignatoryTwoName] = useState("");
  const [signatoryTwoCapacity, setSignatoryTwoCapacity] =
    useState("Director");

  useEffect(() => {
    async function loadClientAndShareholders() {
      if (!requestedClientId) {
        setClients([]);
        setShareholders([]);
        setClientsLoading(false);
        setShareholdersLoading(false);
        return;
      }

      setClientsLoading(true);
      setShareholdersLoading(true);

      const [clientResult, shareholderResult] = await Promise.all([
        supabase
          .from("crm_clients")
          .select("id, client_name, registration_number")
          .eq("id", requestedClientId)
          .single(),

        supabase
          .from("secretarial_shareholders")
          .select(
            "id, full_legal_name, id_registration_number, holder_type, is_active"
          )
          .eq("client_id", requestedClientId)
          .eq("is_active", true)
          .order("full_legal_name", { ascending: true }),
      ]);

      if (clientResult.error || !clientResult.data) {
        console.error("Could not load Secretarial client:", clientResult.error);
        setClients([]);
      } else {
        setClients([
          {
            id: clientResult.data.id,
            clientName: clientResult.data.client_name || "Unnamed client",
            registrationNumber: clientResult.data.registration_number || "",
          },
        ]);
        setSelectedClientId(clientResult.data.id);
      }

      if (shareholderResult.error) {
        console.error(
          "Could not load Secretarial shareholders:",
          shareholderResult.error
        );
        setShareholders([]);
      } else {
        setShareholders(
          (shareholderResult.data || []).map((shareholder: any) => ({
            id: shareholder.id,
            fullLegalName: shareholder.full_legal_name || "Unnamed shareholder",
            idRegistrationNumber: shareholder.id_registration_number || "",
            holderType: shareholder.holder_type || "individual",
          }))
        );
      }

      setClientsLoading(false);
      setShareholdersLoading(false);
    }

    loadClientAndShareholders();
  }, [requestedClientId]);
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const selectedShareholder = useMemo(
    () =>
      shareholders.find(
        (shareholder) => shareholder.id === selectedShareholderId
      ) || null,
    [shareholders, selectedShareholderId]
  );

  const displayCompanyName =
    selectedClient?.clientName || "COMPANY NAME (PTY) LTD";

  const displayRegistrationNumber =
    selectedClient?.registrationNumber || "REGISTRATION NUMBER";

  const displayShareholderName =
    selectedShareholder?.fullLegalName || "SHAREHOLDER FULL NAME";

  const displayShareCount = numberOfShares.trim() || "NUMBER OF SHARES";

  const displayIssueDate = issueDate
    ? new Date(`${issueDate}T00:00:00`).toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "DATE OF ISSUE";

  const calculatedTotalConsideration = useMemo(() => {
    const qty = Number(numberOfShares);
    const perShare = Number(considerationPerShare);

    if (!Number.isFinite(qty) || !Number.isFinite(perShare)) return "";
    if (qty <= 0 || perShare < 0) return "";

    return (qty * perShare).toFixed(2);
  }, [numberOfShares, considerationPerShare]);

  const paymentStatusText = fullyPaid
    ? "The shares are fully paid."
    : amountPaid.trim()
      ? `Amount paid: R ${Number(amountPaid).toFixed(2)}`
      : "The shares are not fully paid.";

  async function saveDraft() {
    if (saveStatus === "saving") return;

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your login session could not be confirmed.");
      }

      const response = await fetch(
        "/api/crm/secretarial/share-certificates",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            clientId: selectedClientId,
            shareholderId: selectedShareholderId,
            certificateNumber,
            shareholderName: selectedShareholder?.fullLegalName || "",
            shareholderIdNumber:
              selectedShareholder?.idRegistrationNumber || "",
            shareClass,
            seriesDesignation,
            numberOfShares,
            considerationPerShare,
            totalConsideration: calculatedTotalConsideration,
            amountPaid,
            fullyPaid,
            issueDate,
            placeOfIssue,
            transferRestriction,
            signatoryOneName,
            signatoryOneCapacity,
            signatoryTwoName,
            signatoryTwoCapacity,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not save the draft.");
      }

      setSavedMatterId(result.matter?.id || null);
      setSaveStatus("saved");
      setSaveMessage("Share certificate draft saved.");

      window.setTimeout(() => {
        setSaveStatus((current) =>
          current === "saved" ? "idle" : current
        );
      }, 2500);
    } catch (error) {
      console.error("Could not save share certificate draft:", error);

      setSaveStatus("error");
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Could not save the share certificate draft."
      );
    }
  }

  return (
    <div style={page}>
      <section style={workingFileBar}>
        <div style={workingFileText}>
          <span style={eyebrow}>SECRETARIAL WORKING FILE</span>
          <span style={divider}>|</span>
          <Link href="/crm/secretarial" style={backLink}>
            Secretarial
          </Link>
          <span style={divider}>|</span>
          <Link
            href="/crm/secretarial/share-certificates"
            style={backLink}
          >
            Share Certificates
          </Link>
          <span style={divider}>|</span>
          <strong>New Certificate</strong>
        </div>
      </section>

      <section style={headerPanel}>
        <div>
          <h1 style={title}>New Share Certificate</h1>
          <p style={subtitle}>
            Capture the complete certificate and share issue information.
          </p>
        </div>

        <div style={headerActions}>
          <Link
            href={
              requestedClientId
                ? `/crm/secretarial/client/${requestedClientId}?view=certificates`
                : "/crm/secretarial"
            }
            style={secondaryButton}
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={saveDraft}
            disabled={
              saveStatus === "saving" ||
              Boolean(savedMatterId) ||
              !selectedClientId ||
              !selectedShareholderId
            }
            style={{
              ...primaryButton,
              ...(saveStatus === "saving" ||
              savedMatterId ||
              !selectedClientId ||
              !selectedShareholderId
                ? disabledPrimaryButton
                : {}),
            }}
          >
            {saveStatus === "saving"
              ? "Saving..."
              : savedMatterId
                ? "Draft Saved"
                : "Save Draft"}
          </button>
        </div>
      </section>

      {saveMessage ? (
        <div
          style={{
            ...messageBar,
            ...(saveStatus === "error" ? errorMessageBar : successMessageBar),
          }}
        >
          {saveMessage}
        </div>
      ) : null}

      <section style={flightMapPanel}>
        <div style={flightMapTitleRow}>
          <div>
            <h2 style={sectionTitle}>Share Certificate Flight Map</h2>
            <p style={sectionSubtitle}>Step 1 of 9 · Company details</p>
          </div>
          <span style={draftBadge}>Draft</span>
        </div>

        <div style={flightMap}>
          {[
            "Company details",
            "Share structure",
            "Shareholder allocation",
            "Resolution",
            "Certificate generation",
            "Review and approval",
            "Register update",
            "Document filing",
            "Complete",
          ].map((step, index) => {
            const active = index === 0;

            return (
              <div key={step} style={flightStep}>
                <div
                  style={{
                    ...stepMarker,
                    ...(active ? activeStepMarker : {}),
                  }}
                >
                  {index + 1}
                </div>
                <div
                  style={{
                    ...stepLabel,
                    ...(active ? activeStepLabel : {}),
                  }}
                >
                  {step}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={workspace}>
        <section style={formPanel}>
          <div style={panelHeader}>
            <h2 style={sectionTitle}>Certificate details</h2>
            <p style={sectionSubtitle}>
              The preview updates as the information is captured.
            </p>
          </div>

          <div style={formBody}>
            {!requestedClientId ? (
              <div style={errorMessageBar}>
                Open a client from Secretarial first, then create the share
                certificate from that client's Share Certificates tab.
              </div>
            ) : null}

            <div style={fieldGroup}>
              <label style={label}>Company</label>
              <input
                value={
                  clientsLoading
                    ? "Loading client..."
                    : selectedClient?.clientName || ""
                }
                readOnly
                style={readOnlyInput}
              />
            </div>

            <div style={twoColumnGrid}>
              <div style={fieldGroup}>
                <label style={label}>Registration number</label>
                <input
                  value={selectedClient?.registrationNumber || ""}
                  readOnly
                  placeholder="Pulled from CRM"
                  style={readOnlyInput}
                />
              </div>

              <div style={fieldGroup}>
                <label style={label}>Certificate number</label>
                <input
                  value={certificateNumber}
                  onChange={(event) => setCertificateNumber(event.target.value)}
                  placeholder="001"
                  style={input}
                />
              </div>
            </div>

            <div style={dividerLine} />

            <div style={fieldGroup}>
              <label style={label}>Shareholder</label>
              <select
                value={selectedShareholderId}
                onChange={(event) =>
                  setSelectedShareholderId(event.target.value)
                }
                style={input}
                disabled={!requestedClientId || shareholdersLoading}
              >
                <option value="">
                  {shareholdersLoading
                    ? "Loading shareholders..."
                    : shareholders.length
                      ? "Select an existing shareholder"
                      : "No shareholders captured yet"}
                </option>
                {shareholders.map((shareholder) => (
                  <option key={shareholder.id} value={shareholder.id}>
                    {shareholder.fullLegalName}
                  </option>
                ))}
              </select>
            </div>

            {!shareholdersLoading && requestedClientId && !shareholders.length ? (
              <div style={messageBar}>
                No shareholders have been captured for this client yet.{" "}
                <Link
                  href={`/crm/secretarial/client/${requestedClientId}?view=shareholders`}
                  style={backLink}
                >
                  Add shareholder first
                </Link>
              </div>
            ) : null}

            <div style={twoColumnGrid}>
              <div style={fieldGroup}>
                <label style={label}>ID / registration number</label>
                <input
                  value={selectedShareholder?.idRegistrationNumber || ""}
                  readOnly
                  placeholder="Pulled from Shareholders"
                  style={readOnlyInput}
                />
              </div>

              <div style={fieldGroup}>
                <label style={label}>Holder type</label>
                <input
                  value={
                    selectedShareholder?.holderType
                      ? selectedShareholder.holderType
                          .replaceAll("_", " ")
                          .replace(/\b\w/g, (letter) => letter.toUpperCase())
                      : ""
                  }
                  readOnly
                  placeholder="Pulled from Shareholders"
                  style={readOnlyInput}
                />
              </div>
            </div>

            <div style={twoColumnGrid}>
              <div style={fieldGroup}>
                <label style={label}>Class of shares</label>
                <input
                  value={shareClass}
                  onChange={(event) => setShareClass(event.target.value)}
                  style={input}
                />
              </div>

              <div style={fieldGroup}>
                <label style={label}>Series designation</label>
                <input
                  value={seriesDesignation}
                  onChange={(event) =>
                    setSeriesDesignation(event.target.value)
                  }
                  placeholder="Leave blank if not applicable"
                  style={input}
                />
              </div>
            </div>

            <div style={twoColumnGrid}>
              <div style={fieldGroup}>
                <label style={label}>Number of shares</label>
                <input
                  type="number"
                  min="1"
                  value={numberOfShares}
                  onChange={(event) => setNumberOfShares(event.target.value)}
                  placeholder="100"
                  style={input}
                />
              </div>

              <div style={fieldGroup}>
                <label style={label}>Consideration per share</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={considerationPerShare}
                  onChange={(event) =>
                    setConsiderationPerShare(event.target.value)
                  }
                  placeholder="0.00"
                  style={input}
                />
              </div>
            </div>

            <div style={twoColumnGrid}>
              <div style={fieldGroup}>
                <label style={label}>Total consideration</label>
                <input
                  value={
                    calculatedTotalConsideration
                      ? `R ${calculatedTotalConsideration}`
                      : ""
                  }
                  readOnly
                  placeholder="Calculated"
                  style={readOnlyInput}
                />
              </div>

              <div style={fieldGroup}>
                <label style={label}>Amount paid</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  placeholder="0.00"
                  style={input}
                />
              </div>
            </div>

            <div style={checkboxRow}>
              <input
                id="fully-paid"
                type="checkbox"
                checked={fullyPaid}
                onChange={(event) => setFullyPaid(event.target.checked)}
              />
              <label htmlFor="fully-paid" style={checkboxLabel}>
                Shares are fully paid
              </label>
            </div>

            <div style={twoColumnGrid}>
              <div style={fieldGroup}>
                <label style={label}>Date of issue</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  style={input}
                />
              </div>

              <div style={fieldGroup}>
                <label style={label}>Place of issue</label>
                <input
                  value={placeOfIssue}
                  onChange={(event) => setPlaceOfIssue(event.target.value)}
                  style={input}
                />
              </div>
            </div>

            <div style={fieldGroup}>
              <label style={label}>Transfer restriction</label>
              <textarea
                value={transferRestriction}
                onChange={(event) =>
                  setTransferRestriction(event.target.value)
                }
                rows={4}
                style={textarea}
              />
            </div>

            <div style={dividerLine} />

            <div style={twoColumnGrid}>
              <div style={fieldGroup}>
                <label style={label}>Authorised signatory 1</label>
                <input
                  value={signatoryOneName}
                  onChange={(event) =>
                    setSignatoryOneName(event.target.value)
                  }
                  placeholder="Full name"
                  style={input}
                />
              </div>

              <div style={fieldGroup}>
                <label style={label}>Capacity</label>
                <input
                  value={signatoryOneCapacity}
                  onChange={(event) =>
                    setSignatoryOneCapacity(event.target.value)
                  }
                  placeholder="Director"
                  style={input}
                />
              </div>
            </div>

            <div style={twoColumnGrid}>
              <div style={fieldGroup}>
                <label style={label}>Authorised signatory 2</label>
                <input
                  value={signatoryTwoName}
                  onChange={(event) =>
                    setSignatoryTwoName(event.target.value)
                  }
                  placeholder="Full name"
                  style={input}
                />
              </div>

              <div style={fieldGroup}>
                <label style={label}>Capacity</label>
                <input
                  value={signatoryTwoCapacity}
                  onChange={(event) =>
                    setSignatoryTwoCapacity(event.target.value)
                  }
                  placeholder="Director"
                  style={input}
                />
              </div>
            </div>
          </div>
        </section>

        <section style={previewPanel}>
          <div style={panelHeader}>
            <h2 style={sectionTitle}>Certificate preview</h2>
            <p style={sectionSubtitle}>
              Live preview only. PDF generation follows after layout approval.
            </p>
          </div>

          <div style={previewViewport}>
            <div style={certificateCanvas}>
              <img
                src="/secretarial/share-certificate-background.png"
                alt="Share certificate background"
                style={certificateBackground}
              />

              <div style={certificateNumberText}>
                Certificate No. {certificateNumber || "001"}
              </div>

              <div style={companyName}>{displayCompanyName}</div>

              <div style={registrationText}>
                Registration number: {displayRegistrationNumber}
              </div>

              <div style={certificateHeading}>SHARE CERTIFICATE</div>

              <div style={certificateTextArea}>
                <div style={certificateBody}>This is to certify that</div>

                <div style={shareholderText}>{displayShareholderName}</div>

                <div style={certificateBody}>
                  is the registered holder of
                </div>

                <div style={shareCountText}>
                  {displayShareCount} {shareClass}
                </div>

                {seriesDesignation.trim() ? (
                  <div style={smallCertificateLine}>
                    Series: {seriesDesignation}
                  </div>
                ) : null}

                <div style={certificateBody}>
                  in the issued share capital of the company.
                </div>

                <div style={smallCertificateLine}>{paymentStatusText}</div>

                <div style={restrictionText}>
                  {transferRestriction || DEFAULT_TRANSFER_RESTRICTION}
                </div>

                <div style={issueText}>
                  Issued at {placeOfIssue || "PLACE"} on {displayIssueDate}
                </div>

                <div style={signatureGrid}>
                  <div style={signatureBlock}>
                    <div style={signatureLine} />
                    <div style={signatureName}>
                      {signatoryOneName || "Authorised Signatory"}
                    </div>
                    <div style={signatureCaption}>
                      {signatoryOneCapacity || "Capacity"}
                    </div>
                  </div>

                  <div style={signatureBlock}>
                    <div style={signatureLine} />
                    <div style={signatureName}>
                      {signatoryTwoName || "Authorised Signatory"}
                    </div>
                    <div style={signatureCaption}>
                      {signatoryTwoCapacity || "Capacity"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


export default function NewShareCertificatePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100%",
            padding: "20px",
            background: "#eef2f5",
            color: "#0f1f33",
            fontSize: "12px",
            fontWeight: 800,
          }}
        >
          Loading share certificate...
        </div>
      }
    >
      <NewShareCertificateContent />
    </Suspense>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "8px 10px 28px",
  background: "#eef2f5",
  color: "#0f1f33",
};

const workingFileBar: React.CSSProperties = {
  minHeight: "38px",
  display: "flex",
  alignItems: "center",
  padding: "0 10px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const workingFileText: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  fontSize: "12px",
};

const eyebrow: React.CSSProperties = {
  color: "#2457d6",
  fontWeight: 900,
  letterSpacing: "0.05em",
};

const divider: React.CSSProperties = {
  color: "#94a3b8",
};

const backLink: React.CSSProperties = {
  color: "#0f1f33",
  textDecoration: "none",
  fontWeight: 900,
};

const headerPanel: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "72px",
  padding: "12px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  lineHeight: 1.2,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "12px",
  lineHeight: 1.5,
};

const headerActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const primaryButton: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 15px",
  background: "#0f1f33",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 900,
  border: "1px solid #07111f",
  cursor: "pointer",
};

const disabledPrimaryButton: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};

const messageBar: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "38px",
  padding: "9px 10px",
  display: "flex",
  alignItems: "center",
  fontSize: "12px",
  fontWeight: 900,
  border: "1px solid",
};

const successMessageBar: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const errorMessageBar: React.CSSProperties = {
  color: "#991b1b",
  background: "#fef2f2",
  borderColor: "#fecaca",
};

const secondaryButton: React.CSSProperties = {
  minHeight: "36px",
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  background: "#ffffff",
  color: "#0f1f33",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 900,
  border: "1px solid #cbd5e1",
};

const flightMapPanel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const flightMapTitleRow: React.CSSProperties = {
  padding: "12px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #d8dee7",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 900,
};

const sectionSubtitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "12px",
};

const draftBadge: React.CSSProperties = {
  minHeight: "24px",
  padding: "0 9px",
  display: "inline-flex",
  alignItems: "center",
  color: "#475569",
  background: "#f8fafc",
  border: "1px solid #cbd5e1",
  fontSize: "10px",
  fontWeight: 900,
};

const flightMap: React.CSSProperties = {
  padding: "12px 10px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px 18px",
};

const flightStep: React.CSSProperties = {
  minHeight: "36px",
  display: "grid",
  gridTemplateColumns: "26px minmax(0, 1fr)",
  alignItems: "center",
  columnGap: "8px",
};

const stepMarker: React.CSSProperties = {
  width: "24px",
  height: "24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#64748b",
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "50%",
  fontSize: "10px",
  fontWeight: 900,
};

const activeStepMarker: React.CSSProperties = {
  color: "#ffffff",
  background: "#2457d6",
  borderColor: "#2457d6",
};

const stepLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 800,
};

const activeStepLabel: React.CSSProperties = {
  color: "#0f1f33",
  fontWeight: 900,
};

const workspace: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "390px minmax(0, 1fr)",
  gap: "8px",
  alignItems: "start",
};

const formPanel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const previewPanel: React.CSSProperties = {
  minWidth: 0,
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const panelHeader: React.CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #d8dee7",
};

const formBody: React.CSSProperties = {
  padding: "12px 10px 14px",
};

const fieldGroup: React.CSSProperties = {
  marginBottom: "11px",
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: "5px",
  color: "#334155",
  fontSize: "11px",
  fontWeight: 900,
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: "36px",
  padding: "7px 9px",
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#0f1f33",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  fontSize: "12px",
  outline: "none",
};

const readOnlyInput: React.CSSProperties = {
  ...input,
  background: "#f8fafc",
  color: "#64748b",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: "88px",
  resize: "vertical",
  fontFamily: "inherit",
};

const twoColumnGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

const checkboxRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  margin: "0 0 13px",
};

const checkboxLabel: React.CSSProperties = {
  color: "#334155",
  fontSize: "11px",
  fontWeight: 900,
};

const dividerLine: React.CSSProperties = {
  height: "1px",
  margin: "4px 0 13px",
  background: "#e2e8f0",
};

const previewViewport: React.CSSProperties = {
  padding: "12px",
  overflow: "hidden",
  background: "#f8fafc",
};

const certificateCanvas: React.CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "1.414 / 1",
  overflow: "hidden",
  background: "#ffffff",
  boxShadow: "0 3px 12px rgba(15, 31, 51, 0.12)",
};

const certificateBackground: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const certificateNumberText: React.CSSProperties = {
  position: "absolute",
  top: "5.8%",
  right: "7.2%",
  color: "#364152",
  fontSize: "1.05vw",
  fontWeight: 700,
};

const companyName: React.CSSProperties = {
  position: "absolute",
  top: "12%",
  left: "17%",
  right: "12%",
  textAlign: "center",
  color: "#111827",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "2vw",
  fontWeight: 700,
  letterSpacing: "0.04em",
};

const registrationText: React.CSSProperties = {
  position: "absolute",
  top: "19%",
  left: "18%",
  right: "12%",
  textAlign: "center",
  color: "#4b5563",
  fontSize: "0.9vw",
};

const certificateHeading: React.CSSProperties = {
  position: "absolute",
  top: "27%",
  left: "18%",
  right: "12%",
  textAlign: "center",
  color: "#1f2937",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "2.3vw",
  fontWeight: 700,
  letterSpacing: "0.14em",
};

const certificateTextArea: React.CSSProperties = {
  position: "absolute",
  top: "36.5%",
  left: "13.5%",
  right: "8.5%",
  bottom: "7.5%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
};

const certificateBody: React.CSSProperties = {
  color: "#374151",
  textAlign: "center",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1vw",
  lineHeight: 1.4,
};

const shareholderText: React.CSSProperties = {
  color: "#111827",
  textAlign: "center",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.55vw",
  fontWeight: 700,
  letterSpacing: "0.04em",
  borderBottom: "1px solid #9ca3af",
  paddingBottom: "0.35vw",
  margin: "0.55vw 3vw",
};

const shareCountText: React.CSSProperties = {
  color: "#111827",
  textAlign: "center",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.15vw",
  fontWeight: 700,
  margin: "0.5vw 2.5vw",
};

const smallCertificateLine: React.CSSProperties = {
  color: "#374151",
  textAlign: "center",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.76vw",
  lineHeight: 1.3,
  marginTop: "0.22vw",
};

const restrictionText: React.CSSProperties = {
  color: "#6b7280",
  textAlign: "center",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.7vw",
  lineHeight: 1.28,
  margin: "0.35vw 1.2vw 0",
};

const issueText: React.CSSProperties = {
  marginTop: "0.35vw",
  color: "#374151",
  textAlign: "center",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.9vw",
};

const signatureGrid: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "4vw",
};

const signatureBlock: React.CSSProperties = {
  textAlign: "center",
};

const signatureLine: React.CSSProperties = {
  height: "1px",
  background: "#6b7280",
};

const signatureName: React.CSSProperties = {
  marginTop: "0.3vw",
  minHeight: "0.75vw",
  color: "#111827",
  fontSize: "0.78vw",
  fontWeight: 700,
};

const signatureCaption: React.CSSProperties = {
  marginTop: "0.1vw",
  color: "#6b7280",
  fontSize: "0.66vw",
};
