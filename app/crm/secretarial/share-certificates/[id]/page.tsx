"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const supabaseAny = supabase as any;

type ClientOption = {
  id: string;
  clientName: string;
  registrationNumber: string;
};

const DEFAULT_TRANSFER_RESTRICTION =
  "The transfer of these shares is subject to the restrictions contained in the company’s Memorandum of Incorporation.";

const FLIGHT_MAP = [
  "Company details",
  "Share structure",
  "Shareholder allocation",
  "Resolution",
  "Certificate generation",
  "Review and approval",
  "Register update",
  "Document filing",
  "Complete",
];

function formatMatterStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export default function ShareCertificateMatterPage() {
  const params = useParams<{ id: string }>();
  const matterId = String(params?.id || "");

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [matterLoading, setMatterLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [progressStatus, setProgressStatus] = useState<
    "idle" | "working" | "error"
  >("idle");
  const [rewindStatus, setRewindStatus] = useState<"idle" | "working">("idle");

  const [saveMessage, setSaveMessage] = useState("");
  const [progressMessage, setProgressMessage] = useState("");

  const [matterStatus, setMatterStatus] = useState("draft");
  const [currentStep, setCurrentStep] = useState(1);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("001");

  const [shareholderName, setShareholderName] = useState("");
  const [shareholderIdNumber, setShareholderIdNumber] = useState("");

  const [shareClass, setShareClass] = useState("Ordinary no-par-value shares");
  const [seriesDesignation, setSeriesDesignation] = useState("");
  const [numberOfShares, setNumberOfShares] = useState("");
  const [considerationPerShare, setConsiderationPerShare] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [fullyPaid, setFullyPaid] = useState(true);

  const [boardResolutionDate, setBoardResolutionDate] = useState("");
  const [boardResolutionReference, setBoardResolutionReference] = useState("");
  const [resolutionConfirmed, setResolutionConfirmed] = useState(false);

  const [issueDate, setIssueDate] = useState("");
  const [placeOfIssue, setPlaceOfIssue] = useState("Pretoria");
  const [transferRestriction, setTransferRestriction] = useState(
    DEFAULT_TRANSFER_RESTRICTION
  );
  const [signatoryOneName, setSignatoryOneName] = useState("");
  const [signatoryOneCapacity, setSignatoryOneCapacity] = useState("Director");
  const [signatoryTwoName, setSignatoryTwoName] = useState("");
  const [signatoryTwoCapacity, setSignatoryTwoCapacity] = useState("Director");
  const [certificateConfirmed, setCertificateConfirmed] = useState(false);

  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewApproved, setReviewApproved] = useState(false);

  const [registerConfirmed, setRegisterConfirmed] = useState(false);

  const [egnyteFolderPath, setEgnyteFolderPath] = useState("");
  const [egnyteConfirmed, setEgnyteConfirmed] = useState(false);

  const [finalConfirmation, setFinalConfirmation] = useState(false);

  useEffect(() => {
    async function loadMatter() {
      setMatterLoading(true);
      setLoadError("");

      try {
        const [{ data: clientData, error: clientError }, matterResult] =
          await Promise.all([
            supabaseAny
              .from("crm_clients")
              .select("id, client_name, registration_number")
              .order("client_name", { ascending: true }),

            supabaseAny
              .from("secretarial_share_matters")
              .select(`
                id,
                client_id,
                certificate_number,
                matter_status,
                current_step,
                number_of_shares,
                issue_date,
                place_of_issue,
                board_resolution_date,
                board_resolution_reference,
                consideration_per_share,
                total_consideration,
                amount_paid,
                fully_paid,
                transfer_restriction,
                signatory_one_name,
                signatory_one_capacity,
                signatory_two_name,
                signatory_two_capacity,
                review_notes,
                egnyte_folder_path,
                secretarial_shareholders (
                  full_legal_name,
                  id_registration_number
                ),
                secretarial_share_classes (
                  class_name,
                  series_designation
                )
              `)
              .eq("id", matterId)
              .maybeSingle(),
          ]);

        if (clientError) throw clientError;

        setClients(
          (clientData || []).map((client: any) => ({
            id: client.id,
            clientName: client.client_name || "Unnamed client",
            registrationNumber: client.registration_number || "",
          }))
        );

        const { data: matter, error: matterError } = matterResult;

        if (matterError) throw matterError;
        if (!matter) throw new Error("Share certificate matter not found.");

        const shareholder = Array.isArray(matter.secretarial_shareholders)
          ? matter.secretarial_shareholders[0]
          : matter.secretarial_shareholders;

        const shareClassRecord = Array.isArray(matter.secretarial_share_classes)
          ? matter.secretarial_share_classes[0]
          : matter.secretarial_share_classes;

        setSelectedClientId(matter.client_id || "");
        setCertificateNumber(matter.certificate_number || "001");
        setMatterStatus(matter.matter_status || "draft");
        setCurrentStep(Number(matter.current_step || 1));

        setShareholderName(shareholder?.full_legal_name || "");
        setShareholderIdNumber(shareholder?.id_registration_number || "");

        setShareClass(
          shareClassRecord?.class_name || "Ordinary no-par-value shares"
        );
        setSeriesDesignation(shareClassRecord?.series_designation || "");

        setNumberOfShares(
          matter.number_of_shares != null ? String(matter.number_of_shares) : ""
        );
        setConsiderationPerShare(
          matter.consideration_per_share != null
            ? String(matter.consideration_per_share)
            : ""
        );
        setAmountPaid(
          matter.amount_paid != null ? String(matter.amount_paid) : ""
        );
        setFullyPaid(matter.fully_paid !== false);

        setBoardResolutionDate(matter.board_resolution_date || "");
        setBoardResolutionReference(matter.board_resolution_reference || "");
        setResolutionConfirmed(Boolean(matter.board_resolution_date));

        setIssueDate(matter.issue_date || "");
        setPlaceOfIssue(matter.place_of_issue || "Pretoria");
        setTransferRestriction(
          matter.transfer_restriction || DEFAULT_TRANSFER_RESTRICTION
        );
        setSignatoryOneName(matter.signatory_one_name || "");
        setSignatoryOneCapacity(matter.signatory_one_capacity || "Director");
        setSignatoryTwoName(matter.signatory_two_name || "");
        setSignatoryTwoCapacity(matter.signatory_two_capacity || "Director");

        setReviewNotes(matter.review_notes || "");
        setEgnyteFolderPath(matter.egnyte_folder_path || "");

        if (matter.matter_status === "approved") {
          setReviewApproved(true);
        }
      } catch (error) {
        console.error("Could not load share certificate matter:", error);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load the share certificate matter."
        );
      } finally {
        setMatterLoading(false);
      }
    }

    if (matterId) loadMatter();
  }, [matterId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const calculatedTotalConsideration = useMemo(() => {
    const qty = Number(numberOfShares);
    const perShare = Number(considerationPerShare);

    if (!Number.isFinite(qty) || !Number.isFinite(perShare)) return "";
    if (qty <= 0 || perShare < 0) return "";

    return (qty * perShare).toFixed(2);
  }, [numberOfShares, considerationPerShare]);

  const shareStructureReady =
    Boolean(shareClass.trim()) &&
    Boolean(numberOfShares.trim()) &&
    Number(numberOfShares) > 0 &&
    (fullyPaid || Boolean(amountPaid.trim()));

  const shareholderAllocationReady =
    Boolean(shareholderName.trim()) && Boolean(shareholderIdNumber.trim());

  const resolutionReady =
    Boolean(boardResolutionDate) &&
    Boolean(boardResolutionReference.trim()) &&
    resolutionConfirmed;

  const certificateGenerationReady =
    Boolean(issueDate) &&
    Boolean(placeOfIssue.trim()) &&
    Boolean(signatoryOneName.trim()) &&
    certificateConfirmed;

  const reviewReady = reviewApproved;
  const registerReady = registerConfirmed;
  const egnyteReady = egnyteConfirmed;

  const isCompleted = matterStatus === "completed";

  async function authToken() {
    const {
      data: { session },
      error,
    } = await supabaseAny.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("Your login session could not be confirmed.");
    }

    return session.access_token;
  }

  async function saveMatter(showMessage = true) {
    if (saveStatus === "saving" || isCompleted) return;

    setSaveStatus("saving");
    if (showMessage) setSaveMessage("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/secretarial/share-certificates/${matterId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clientId: selectedClientId,
            certificateNumber,
            shareholderName,
            shareholderIdNumber,
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
            boardResolutionDate,
            boardResolutionReference,
            reviewNotes,
            egnyteFolderPath,
          }),
        }
      );

      const result = await parseResponse(response);

      setMatterStatus(result.matter?.matter_status || matterStatus);
      setCurrentStep(Number(result.matter?.current_step || currentStep));
      setSaveStatus("saved");

      if (showMessage) {
        setSaveMessage(result.message || "Share certificate matter updated.");
      }

      window.setTimeout(() => {
        setSaveStatus((status) => (status === "saved" ? "idle" : status));
      }, 1800);
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(
        error instanceof Error ? error.message : "Could not save changes."
      );
      throw error;
    }
  }

  async function parseResponse(response: Response) {
    const raw = await response.text();
    let result: any = {};

    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(
        `PracticePilot received an invalid server response (${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(result.error || "The requested action could not be completed.");
    }

    return result;
  }

  async function completeCurrentStep() {
    if (progressStatus === "working" || isCompleted) return;

    setProgressStatus("working");
    setProgressMessage("");

    try {
      await saveMatter(false);
      const token = await authToken();

      const response = await fetch(
        `/api/crm/secretarial/share-certificates/${matterId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "complete_step",
            stepData: {
              resolutionConfirmed,
              certificateConfirmed,
              reviewApproved,
              registerConfirmed,
              egnyteConfirmed,
            },
          }),
        }
      );

      const result = await parseResponse(response);

      setCurrentStep(Number(result.matter?.current_step || currentStep + 1));
      setMatterStatus(result.matter?.matter_status || "in_progress");
      setProgressStatus("idle");
      setProgressMessage(result.message || "Flight Map step completed.");
    } catch (error) {
      setProgressStatus("error");
      setProgressMessage(
        error instanceof Error ? error.message : "Could not complete this step."
      );
    }
  }

  async function goBackOneStep() {
    if (
      rewindStatus === "working" ||
      currentStep <= 1 ||
      currentStep >= 9 ||
      isCompleted
    ) {
      return;
    }

    setRewindStatus("working");
    setProgressMessage("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/secretarial/share-certificates/${matterId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "go_back" }),
        }
      );

      const result = await parseResponse(response);

      setCurrentStep(Number(result.matter?.current_step || currentStep - 1));
      setMatterStatus(result.matter?.matter_status || "in_progress");
      setProgressMessage(result.message || "Returned to the previous step.");
    } catch (error) {
      setProgressStatus("error");
      setProgressMessage(
        error instanceof Error ? error.message : "Could not move back one step."
      );
    } finally {
      setRewindStatus("idle");
    }
  }

  async function jumpToStep(targetStep: number) {
    if (
      rewindStatus === "working" ||
      isCompleted ||
      targetStep < 1 ||
      targetStep >= currentStep
    ) {
      return;
    }

    setRewindStatus("working");
    setProgressMessage("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/secretarial/share-certificates/${matterId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "jump_to_step",
            targetStep,
          }),
        }
      );

      const result = await parseResponse(response);

      setCurrentStep(targetStep);
      setMatterStatus(result.matter?.matter_status || "in_progress");

      // Later-stage confirmations must be re-done after reopening an earlier step.
      if (targetStep <= 4) setResolutionConfirmed(false);
      if (targetStep <= 5) setCertificateConfirmed(false);
      if (targetStep <= 6) setReviewApproved(false);
      if (targetStep <= 7) setRegisterConfirmed(false);
      if (targetStep <= 8) setEgnyteConfirmed(false);

      setFinalConfirmation(false);
      setProgressMessage(
        result.message ||
          `Returned to Step ${targetStep} — ${FLIGHT_MAP[targetStep - 1]}.`
      );
    } catch (error) {
      setProgressStatus("error");
      setProgressMessage(
        error instanceof Error
          ? error.message
          : "Could not reopen the selected step."
      );
    } finally {
      setRewindStatus("idle");
    }
  }

  async function finaliseMatter() {
    if (!finalConfirmation || progressStatus === "working" || isCompleted) return;

    setProgressStatus("working");
    setProgressMessage("");

    try {
      await saveMatter(false);
      const token = await authToken();

      const response = await fetch(
        `/api/crm/secretarial/share-certificates/${matterId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "finalise",
            stepData: { finalConfirmation },
          }),
        }
      );

      const result = await parseResponse(response);

      setMatterStatus(result.matter?.matter_status || "completed");
      setCurrentStep(9);
      setProgressStatus("idle");
      setProgressMessage(result.message || "Share certificate finalised.");
    } catch (error) {
      setProgressStatus("error");
      setProgressMessage(
        error instanceof Error ? error.message : "Could not finalise the matter."
      );
    }
  }

  function currentReady() {
    if (currentStep === 1) return Boolean(selectedClientId && certificateNumber);
    if (currentStep === 2) return shareStructureReady;
    if (currentStep === 3) return shareholderAllocationReady;
    if (currentStep === 4) return resolutionReady;
    if (currentStep === 5) return certificateGenerationReady;
    if (currentStep === 6) return reviewReady;
    if (currentStep === 7) return registerReady;
    if (currentStep === 8) return egnyteReady;
    if (currentStep === 9) return finalConfirmation;
    return false;
  }

  return (
    <div style={page}>
      <div style={workingFileBar}>
        <span style={workingFileLabel}>SECRETARIAL WORKING FILE</span>
        <span style={divider}>|</span>
        <Link href="/crm/secretarial" style={breadcrumbLink}>
          Secretarial
        </Link>
        <span style={divider}>|</span>
        <Link
          href="/crm/secretarial/share-certificates"
          style={breadcrumbLink}
        >
          Share Certificates
        </Link>
        <span style={divider}>|</span>
        <strong>Certificate {certificateNumber}</strong>
      </div>

      <div style={headerBar}>
        <div>
          <h1 style={pageTitle}>Share Certificate {certificateNumber}</h1>
          <div style={pageSubtitle}>
            One controlled step at a time. Finalisation at Step 9 locks the matter.
          </div>
        </div>

        <div style={headerActions}>
          <Link
            href={`/crm/secretarial/client/${selectedClientId}?view=certificates`}
            style={secondaryButton}
          >
            Exit
          </Link>

          {!isCompleted ? (
            <button
              type="button"
              onClick={() => saveMatter(true)}
              disabled={saveStatus === "saving"}
              style={{
                ...primaryButton,
                ...(saveStatus === "saving" ? disabledButton : {}),
              }}
            >
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                  ? "Saved"
                  : "Save Changes"}
            </button>
          ) : (
            <span style={lockedBadge}>Finalised & Locked</span>
          )}
        </div>
      </div>

      {loadError ? <div style={errorMessage}>{loadError}</div> : null}

      {progressMessage ? (
        <div
          style={{
            ...messageBar,
            ...(progressStatus === "error"
              ? errorMessage
              : successMessage),
          }}
        >
          {progressMessage}
        </div>
      ) : null}

      {saveMessage ? (
        <div
          style={{
            ...messageBar,
            ...(saveStatus === "error" ? errorMessage : successMessage),
          }}
        >
          {saveMessage}
        </div>
      ) : null}

      <section style={flightMapPanel}>
        <div style={flightMapHeader}>
          <div>
            <h2 style={flightTitle}>Share Certificate Flight Map</h2>
            <div style={flightSubtitle}>
              Step {currentStep} of 9 · {FLIGHT_MAP[currentStep - 1]}
            </div>
          </div>

          <div style={flightHeaderActions}>
            {currentStep > 1 && currentStep < 9 && !isCompleted ? (
              <button
                type="button"
                onClick={goBackOneStep}
                disabled={rewindStatus === "working"}
                style={backButton}
              >
                {rewindStatus === "working"
                  ? "Going back..."
                  : `← Back to Step ${currentStep - 1}`}
              </button>
            ) : null}

            <span
              style={{
                ...statusBadge,
                ...(isCompleted ? completedStatusBadge : {}),
              }}
            >
              {formatMatterStatus(matterStatus)}
            </span>
          </div>
        </div>

        <div style={flightMap}>
          {FLIGHT_MAP.map((step, index) => {
            const stepNumber = index + 1;
            const completed = stepNumber < currentStep || isCompleted;
            const active = stepNumber === currentStep && !isCompleted;
            const canJumpBack =
              completed &&
              !isCompleted &&
              stepNumber < currentStep &&
              rewindStatus !== "working";

            return (
              <button
                key={step}
                type="button"
                onClick={() => {
                  if (canJumpBack) jumpToStep(stepNumber);
                }}
                disabled={!canJumpBack}
                title={
                  canJumpBack
                    ? `Go back to Step ${stepNumber} — ${step}`
                    : undefined
                }
                style={{
                  ...flightStepButton,
                  ...(canJumpBack ? flightStepButtonClickable : {}),
                }}
              >
                <div
                  style={{
                    ...stepMarker,
                    ...(completed ? completedStepMarker : {}),
                    ...(active ? activeStepMarker : {}),
                    ...(canJumpBack ? completedStepMarkerClickable : {}),
                  }}
                >
                  {completed ? "✓" : stepNumber}
                </div>

                <div
                  style={{
                    ...stepLabel,
                    ...(active ? activeStepLabel : {}),
                    ...(canJumpBack ? completedStepLabelClickable : {}),
                  }}
                >
                  {step}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {matterLoading ? (
        <div style={loadingPanel}>Loading share certificate matter...</div>
      ) : (
        <CurrentStage
          currentStep={currentStep}
          isCompleted={isCompleted}
          selectedClientId={selectedClientId}
          setSelectedClientId={setSelectedClientId}
          clients={clients}
          selectedClient={selectedClient}
          certificateNumber={certificateNumber}
          setCertificateNumber={setCertificateNumber}
          shareClass={shareClass}
          setShareClass={setShareClass}
          seriesDesignation={seriesDesignation}
          setSeriesDesignation={setSeriesDesignation}
          numberOfShares={numberOfShares}
          setNumberOfShares={setNumberOfShares}
          considerationPerShare={considerationPerShare}
          setConsiderationPerShare={setConsiderationPerShare}
          calculatedTotalConsideration={calculatedTotalConsideration}
          amountPaid={amountPaid}
          setAmountPaid={setAmountPaid}
          fullyPaid={fullyPaid}
          setFullyPaid={setFullyPaid}
          shareholderName={shareholderName}
          setShareholderName={setShareholderName}
          shareholderIdNumber={shareholderIdNumber}
          setShareholderIdNumber={setShareholderIdNumber}
          boardResolutionDate={boardResolutionDate}
          setBoardResolutionDate={setBoardResolutionDate}
          boardResolutionReference={boardResolutionReference}
          setBoardResolutionReference={setBoardResolutionReference}
          resolutionConfirmed={resolutionConfirmed}
          setResolutionConfirmed={setResolutionConfirmed}
          issueDate={issueDate}
          setIssueDate={setIssueDate}
          placeOfIssue={placeOfIssue}
          setPlaceOfIssue={setPlaceOfIssue}
          transferRestriction={transferRestriction}
          setTransferRestriction={setTransferRestriction}
          signatoryOneName={signatoryOneName}
          setSignatoryOneName={setSignatoryOneName}
          signatoryOneCapacity={signatoryOneCapacity}
          setSignatoryOneCapacity={setSignatoryOneCapacity}
          signatoryTwoName={signatoryTwoName}
          setSignatoryTwoName={setSignatoryTwoName}
          signatoryTwoCapacity={signatoryTwoCapacity}
          setSignatoryTwoCapacity={setSignatoryTwoCapacity}
          certificateConfirmed={certificateConfirmed}
          setCertificateConfirmed={setCertificateConfirmed}
          reviewNotes={reviewNotes}
          setReviewNotes={setReviewNotes}
          reviewApproved={reviewApproved}
          setReviewApproved={setReviewApproved}
          registerConfirmed={registerConfirmed}
          setRegisterConfirmed={setRegisterConfirmed}
          egnyteFolderPath={egnyteFolderPath}
          setEgnyteFolderPath={setEgnyteFolderPath}
          egnyteConfirmed={egnyteConfirmed}
          setEgnyteConfirmed={setEgnyteConfirmed}
          finalConfirmation={finalConfirmation}
          setFinalConfirmation={setFinalConfirmation}
          ready={currentReady()}
          progressStatus={progressStatus}
          completeCurrentStep={completeCurrentStep}
          finaliseMatter={finaliseMatter}
          rewindStatus={rewindStatus}
        />
      )}
    </div>
  );
}

function CurrentStage(props: any) {
  const {
    currentStep,
    isCompleted,
    ready,
    progressStatus,
    completeCurrentStep,
    finaliseMatter,
  } = props;

  const title = `Step ${currentStep} — ${FLIGHT_MAP[currentStep - 1]}`;

  return (
    <section style={stagePanel}>
      <div style={stageHeader}>
        <div>
          <div style={stageEyebrow}>CURRENT FLIGHT MAP STAGE</div>
          <h2 style={stageTitle}>{title}</h2>
          <div style={stageDescription}>{getStageDescription(currentStep)}</div>
        </div>

        <span
          style={{
            ...readyBadge,
            ...(ready ? readyBadgeComplete : readyBadgePending),
          }}
        >
          {isCompleted
            ? "Finalised"
            : ready
              ? "Ready to continue"
              : "Incomplete"}
        </span>
      </div>

      <div style={stageContent}>
        {currentStep === 1 ? <Step1 {...props} /> : null}
        {currentStep === 2 ? <Step2 {...props} /> : null}
        {currentStep === 3 ? <Step3 {...props} /> : null}
        {currentStep === 4 ? <Step4 {...props} /> : null}
        {currentStep === 5 ? <Step5 {...props} /> : null}
        {currentStep === 6 ? <Step6 {...props} /> : null}
        {currentStep === 7 ? <Step7 {...props} /> : null}
        {currentStep === 8 ? <Step8 {...props} /> : null}
        {currentStep === 9 ? <Step9 {...props} /> : null}
      </div>

      {!isCompleted ? (
        <div style={stageFooter}>
          <div style={footerHint}>
            {currentStep === 9
              ? "Finalisation permanently locks this matter."
              : ready
                ? "All controls for this stage are complete."
                : "Complete the required information before continuing."}
          </div>

          {currentStep < 9 ? (
            <button
              type="button"
              onClick={completeCurrentStep}
              disabled={!ready || progressStatus === "working"}
              style={{
                ...completeButton,
                ...(!ready || progressStatus === "working"
                  ? disabledButton
                  : {}),
              }}
            >
              {progressStatus === "working"
                ? "Completing..."
                : `Complete Step ${currentStep} & Continue`}
            </button>
          ) : (
            <button
              type="button"
              onClick={finaliseMatter}
              disabled={!ready || progressStatus === "working"}
              style={{
                ...finaliseButton,
                ...(!ready || progressStatus === "working"
                  ? disabledButton
                  : {}),
              }}
            >
              {progressStatus === "working"
                ? "Finalising..."
                : "FINALISE SHARE CERTIFICATE"}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Step1(props: any) {
  return (
    <div style={formGrid}>
      <Field label="Client">
        <select
          value={props.selectedClientId}
          onChange={(event) => props.setSelectedClientId(event.target.value)}
          style={input}
        >
          <option value="">Select a client</option>
          {props.clients.map((client: ClientOption) => (
            <option key={client.id} value={client.id}>
              {client.clientName}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Registration number">
        <input
          value={props.selectedClient?.registrationNumber || ""}
          readOnly
          style={readOnlyInput}
        />
      </Field>

      <Field label="Certificate number">
        <input
          value={props.certificateNumber}
          onChange={(event) => props.setCertificateNumber(event.target.value)}
          style={input}
        />
      </Field>
    </div>
  );
}

function Step2(props: any) {
  return (
    <div style={stageTwoColumn}>
      <div style={stageMain}>
        <div style={formGrid}>
          <Field label="Class of shares" help="Example: Ordinary no-par-value shares.">
            <input
              value={props.shareClass}
              onChange={(event) => props.setShareClass(event.target.value)}
              style={input}
            />
          </Field>

          <Field
            label="Series designation"
            help="Leave blank if the class has no separate series."
          >
            <input
              value={props.seriesDesignation}
              onChange={(event) =>
                props.setSeriesDesignation(event.target.value)
              }
              placeholder="Leave blank if not applicable"
              style={input}
            />
          </Field>

          <Field label="Number of shares to issue">
            <input
              type="number"
              min="1"
              value={props.numberOfShares}
              onChange={(event) => props.setNumberOfShares(event.target.value)}
              style={input}
            />
          </Field>

          <Field label="Consideration per share">
            <input
              type="number"
              min="0"
              step="0.01"
              value={props.considerationPerShare}
              onChange={(event) =>
                props.setConsiderationPerShare(event.target.value)
              }
              style={input}
            />
          </Field>

          <Field label="Total consideration">
            <input
              value={
                props.calculatedTotalConsideration
                  ? `R ${props.calculatedTotalConsideration}`
                  : ""
              }
              readOnly
              style={readOnlyInput}
            />
          </Field>

          <Field label="Amount paid">
            <input
              type="number"
              min="0"
              step="0.01"
              value={props.amountPaid}
              onChange={(event) => props.setAmountPaid(event.target.value)}
              style={input}
            />
          </Field>
        </div>

        <CheckBox
          checked={props.fullyPaid}
          onChange={props.setFullyPaid}
          label="Shares are fully paid"
        />
      </div>

      <StageChecks
        checks={[
          ["Share class confirmed", Boolean(props.shareClass.trim())],
          [
            "Number of shares confirmed",
            Number(props.numberOfShares || 0) > 0,
          ],
          [
            "Payment position confirmed",
            props.fullyPaid || Boolean(props.amountPaid),
          ],
        ]}
      />
    </div>
  );
}

function Step3(props: any) {
  return (
    <div style={stageTwoColumn}>
      <div style={stageMain}>
        <div style={formGrid}>
          <Field
            label="Shareholder full legal name"
            help="Use the legal name exactly as it must appear on the certificate."
          >
            <input
              value={props.shareholderName}
              onChange={(event) => props.setShareholderName(event.target.value)}
              style={input}
            />
          </Field>

          <Field label="ID or registration number">
            <input
              value={props.shareholderIdNumber}
              onChange={(event) =>
                props.setShareholderIdNumber(event.target.value)
              }
              style={input}
            />
          </Field>
        </div>

        <div style={carryForwardGrid}>
          <Carry label="Shares allocated" value={props.numberOfShares || "—"} />
          <Carry label="Share class" value={props.shareClass || "—"} />
          <Carry label="Certificate" value={props.certificateNumber || "—"} />
        </div>
      </div>

      <StageChecks
        checks={[
          ["Shareholder legal name confirmed", Boolean(props.shareholderName.trim())],
          [
            "Shareholder identification confirmed",
            Boolean(props.shareholderIdNumber.trim()),
          ],
          [
            "Share allocation linked",
            Number(props.numberOfShares || 0) > 0 &&
              Boolean(props.shareClass.trim()),
          ],
        ]}
      />
    </div>
  );
}

function Step4(props: any) {
  const resolutionText = [
    `The directors of ${props.selectedClient?.clientName || "the company"} resolve that:`,
    "",
    `1. The company is authorised to issue ${props.numberOfShares || "—"} ${props.shareClass || "shares"} to ${props.shareholderName || "the shareholder"}.`,
    `2. The shares will be issued for a total consideration of R ${props.calculatedTotalConsideration || "0.00"}.`,
    `3. The issue date will be ${formatDate(props.issueDate || props.boardResolutionDate)}.`,
    `4. The authorised signatories are authorised to sign the share certificate and all related statutory records.`,
    `5. The securities register must be updated to reflect the issue once this matter is finalised.`,
    "",
    "This board resolution must be read together with the company’s Memorandum of Incorporation and any shareholder approval required by law.",
  ].join("\n");

  function printResolution() {
    const popup = window.open("", "_blank", "width=900,height=1100");
    if (!popup) return;

    const clientName = props.selectedClient?.clientName || "Company";
    const registration =
      props.selectedClient?.registrationNumber || "Registration number";
    const resolutionDate = formatDate(props.boardResolutionDate);

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Share Issue Resolution - ${clientName}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 48px; line-height: 1.55; }
            h1 { font-size: 22px; margin: 0 0 8px; }
            .meta { color: #64748b; font-size: 12px; margin-bottom: 28px; }
            .rule { border-top: 2px solid #0f1f33; margin: 16px 0 24px; }
            .resolution { white-space: pre-wrap; font-size: 13px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 64px; }
            .sig { border-top: 1px solid #111827; padding-top: 8px; font-size: 12px; }
            .footer { margin-top: 48px; font-size: 10px; color: #64748b; }
            @media print { button { display:none; } body { padding: 24mm; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="float:right;padding:8px 14px;">Print / Save PDF</button>
          <h1>DIRECTORS' RESOLUTION — ISSUE OF SHARES</h1>
          <div class="meta">
            <strong>${clientName}</strong><br/>
            Registration number: ${registration}<br/>
            Resolution date: ${resolutionDate}<br/>
            Reference: ${props.boardResolutionReference || "—"}
          </div>
          <div class="rule"></div>
          <div class="resolution">${resolutionText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div>

          <div class="signatures">
            <div class="sig">
              ${props.signatoryOneName || "Director"}<br/>
              ${props.signatoryOneCapacity || "Director"}
            </div>
            <div class="sig">
              ${props.signatoryTwoName || "Director"}<br/>
              ${props.signatoryTwoCapacity || "Director"}
            </div>
          </div>

          <div class="footer">
            Generated by PracticePilot. Review the company MOI and any shareholder approval requirements before signing.
          </div>
        </body>
      </html>
    `);
    popup.document.close();
  }

  return (
    <div style={stageTwoColumn}>
      <div style={stageMain}>
        <div style={formGrid}>
          <Field label="Resolution date">
            <input
              type="date"
              value={props.boardResolutionDate}
              onChange={(event) =>
                props.setBoardResolutionDate(event.target.value)
              }
              style={input}
            />
          </Field>

          <Field
            label="Resolution reference"
            help="Example: Board Resolution 01/2026."
          >
            <input
              value={props.boardResolutionReference}
              onChange={(event) =>
                props.setBoardResolutionReference(event.target.value)
              }
              style={input}
            />
          </Field>
        </div>

        <div style={resolutionPreview}>
          <div style={resolutionPreviewHeader}>
            <div>
              <div style={previewLabel}>GENERATED RESOLUTION</div>
              <strong>Directors' Resolution — Issue of Shares</strong>
            </div>

            <button
              type="button"
              onClick={printResolution}
              style={resolutionPrintButton}
            >
              Print / Save Resolution PDF
            </button>
          </div>

          <div style={resolutionBody}>{resolutionText}</div>
        </div>

        <div style={legalNote}>
          PracticePilot generates the board resolution as part of Step 4. A
          separate shareholder special resolution may still be required in
          certain cases, depending on the Companies Act and the company’s MOI.
        </div>

        <CheckBox
          checked={props.resolutionConfirmed}
          onChange={props.setResolutionConfirmed}
          label="I confirm that the generated resolution has been reviewed and is ready for signature"
        />
      </div>

      <StageChecks
        checks={[
          ["Resolution date captured", Boolean(props.boardResolutionDate)],
          [
            "Resolution reference captured",
            Boolean(props.boardResolutionReference.trim()),
          ],
          ["Resolution reviewed", props.resolutionConfirmed],
        ]}
      />
    </div>
  );
}

function Step5(props: any) {
  const companyName =
    props.selectedClient?.clientName || "COMPANY NAME (PTY) LTD";
  const registration =
    props.selectedClient?.registrationNumber || "REGISTRATION NUMBER";

  return (
    <div>
      <div style={certificateGenerationGrid}>
        <div>
          <div style={formGrid}>
            <Field label="Date of issue">
              <input
                type="date"
                value={props.issueDate}
                onChange={(event) => props.setIssueDate(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="Place of issue">
              <input
                value={props.placeOfIssue}
                onChange={(event) => props.setPlaceOfIssue(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="Authorised signatory 1">
              <input
                value={props.signatoryOneName}
                onChange={(event) =>
                  props.setSignatoryOneName(event.target.value)
                }
                style={input}
              />
            </Field>

            <Field label="Capacity">
              <input
                value={props.signatoryOneCapacity}
                onChange={(event) =>
                  props.setSignatoryOneCapacity(event.target.value)
                }
                style={input}
              />
            </Field>

            <Field label="Authorised signatory 2">
              <input
                value={props.signatoryTwoName}
                onChange={(event) =>
                  props.setSignatoryTwoName(event.target.value)
                }
                style={input}
              />
            </Field>

            <Field label="Capacity">
              <input
                value={props.signatoryTwoCapacity}
                onChange={(event) =>
                  props.setSignatoryTwoCapacity(event.target.value)
                }
                style={input}
              />
            </Field>
          </div>

          <Field label="Transfer restriction">
            <textarea
              value={props.transferRestriction}
              onChange={(event) =>
                props.setTransferRestriction(event.target.value)
              }
              style={textarea}
            />
          </Field>

          <CheckBox
            checked={props.certificateConfirmed}
            onChange={props.setCertificateConfirmed}
            label="I have checked the certificate wording and layout"
          />
        </div>

        <div style={certificatePreviewWrap}>
          <div style={previewLabel}>CERTIFICATE PREVIEW</div>
          <div style={certificateCanvas}>
            <img
              src="/secretarial/share-certificate-background.png"
              alt="Share certificate background"
              style={certificateBackground}
            />

            <div style={certificateNo}>
              Certificate No. {props.certificateNumber}
            </div>

            <div style={certificateCompany}>{companyName}</div>
            <div style={certificateRegistration}>
              Registration number: {registration}
            </div>

            <div style={certificateHeading}>SHARE CERTIFICATE</div>
            <div style={certificateSmall}>This is to certify that</div>

            <div style={certificateHolder}>
              {props.shareholderName || "SHAREHOLDER FULL NAME"}
            </div>

            <div style={certificateSmall}>is the registered holder of</div>

            <div style={certificateShares}>
              {props.numberOfShares || "0"} {props.shareClass}
            </div>

            <div style={certificateSmall}>
              in the issued share capital of the company.
            </div>

            <div style={certificateTiny}>
              {props.fullyPaid
                ? "The shares are fully paid."
                : `Amount paid: R ${props.amountPaid || "0.00"}`}
            </div>

            <div style={certificateTiny}>
              {props.transferRestriction}
            </div>

            <div style={certificateIssueLine}>
              Issued at {props.placeOfIssue || "PLACE"} on{" "}
              {formatDate(props.issueDate)}
            </div>

            <div style={signatureGrid}>
              <Signature
                name={props.signatoryOneName}
                capacity={props.signatoryOneCapacity}
              />
              <Signature
                name={props.signatoryTwoName}
                capacity={props.signatoryTwoCapacity}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step6(props: any) {
  return (
    <div style={stageTwoColumn}>
      <div style={stageMain}>
        <Field
          label="Review notes"
          help="Record any review comments or changes made before approval."
        >
          <textarea
            value={props.reviewNotes}
            onChange={(event) => props.setReviewNotes(event.target.value)}
            placeholder="Optional review notes..."
            style={textarea}
          />
        </Field>

        <div style={reviewSummary}>
          <SummaryRow label="Client" value={props.selectedClient?.clientName || "—"} />
          <SummaryRow label="Shareholder" value={props.shareholderName || "—"} />
          <SummaryRow
            label="Shares"
            value={`${props.numberOfShares || "—"} ${props.shareClass || ""}`}
          />
          <SummaryRow label="Certificate" value={props.certificateNumber || "—"} />
          <SummaryRow label="Issue date" value={formatDate(props.issueDate)} />
        </div>

        <CheckBox
          checked={props.reviewApproved}
          onChange={props.setReviewApproved}
          label="APPROVE this share certificate and allow the workflow to continue"
          mint
        />
      </div>

      <StageChecks
        checks={[
          ["Certificate data reviewed", true],
          ["Review decision recorded", props.reviewApproved],
          ["Approved for register update", props.reviewApproved],
        ]}
      />
    </div>
  );
}

function Step7(props: any) {
  return (
    <div style={stageTwoColumn}>
      <div style={stageMain}>
        <div style={registerBox}>
          <div style={registerHeading}>Proposed securities register entry</div>
          <SummaryRow label="Transaction" value="Issue" />
          <SummaryRow label="Shareholder" value={props.shareholderName || "—"} />
          <SummaryRow label="Share class" value={props.shareClass || "—"} />
          <SummaryRow label="Number of shares" value={props.numberOfShares || "—"} />
          <SummaryRow label="Transaction date" value={formatDate(props.issueDate)} />
          <SummaryRow
            label="Certificate"
            value={props.certificateNumber || "—"}
          />
        </div>

        <CheckBox
          checked={props.registerConfirmed}
          onChange={props.setRegisterConfirmed}
          label="I confirm that this is the correct transaction to post to the securities register"
        />

        <div style={infoBox}>
          The permanent register transaction is only posted when Step 9 is
          finalised. This means you can still go back and correct the matter
          before finalisation.
        </div>
      </div>

      <StageChecks
        checks={[
          ["Shareholder linked", Boolean(props.shareholderName)],
          ["Issue quantity confirmed", Number(props.numberOfShares || 0) > 0],
          ["Register entry confirmed", props.registerConfirmed],
        ]}
      />
    </div>
  );
}

function Step8(props: any) {
  return (
    <div style={stageTwoColumn}>
      <div style={stageMain}>
        <Field
          label="Document storage path"
          help="Optional for now while we test the workflow. Later PracticePilot can file the document automatically to the firm’s configured storage provider."
        >
          <input
            value={props.egnyteFolderPath}
            onChange={(event) => props.setEgnyteFolderPath(event.target.value)}
            placeholder="Optional during testing"
            style={input}
          />
        </Field>

        <CheckBox
          checked={props.egnyteConfirmed}
          onChange={props.setEgnyteConfirmed}
          label="Continue without automated document filing for now"
        />

        <div style={infoBox}>
          For testing, the storage path may be left blank. Once a document
          storage integration is connected, this stage can become an automatic
          filing control instead of a manual bypass.
        </div>
      </div>

      <StageChecks
        checks={[
          [
            "Storage path",
            Boolean(props.egnyteFolderPath.trim()),
          ],
          ["Testing bypass confirmed", props.egnyteConfirmed],
        ]}
      />
    </div>
  );
}

function Step9(props: any) {
  return (
    <div>
      <div style={finalSummary}>
        <div style={finalSummaryTitle}>Final certificate summary</div>
        <div style={summaryGrid}>
          <SummaryRow label="Client" value={props.selectedClient?.clientName || "—"} />
          <SummaryRow label="Certificate" value={props.certificateNumber || "—"} />
          <SummaryRow label="Shareholder" value={props.shareholderName || "—"} />
          <SummaryRow
            label="Shares"
            value={`${props.numberOfShares || "—"} ${props.shareClass || ""}`}
          />
          <SummaryRow label="Issue date" value={formatDate(props.issueDate)} />
          <SummaryRow label="Resolution" value={props.boardResolutionReference || "—"} />
          <SummaryRow label="Storage path" value={props.egnyteFolderPath || "—"} />
        </div>
      </div>

      {!props.isCompleted ? (
        <div style={finalWarning}>
          <strong>Finalisation locks this matter.</strong>
          <span>
            Before finalising, you can click any green completed Flight Map
            step above to reopen it and correct the information. After
            finalisation the certificate is issued, the securities register
            transaction is posted, and normal editing is disabled.
          </span>

        </div>
      ) : (
        <div style={finalisedFace}>
          ✓ Share Certificate {props.certificateNumber} has been finalised and
          locked.
        </div>
      )}

      {!props.isCompleted ? (
        <CheckBox
          checked={props.finalConfirmation}
          onChange={props.setFinalConfirmation}
          label="I confirm that all information is correct and this share certificate may be FINALised"
          mint
        />
      ) : null}
    </div>
  );
}

function getStageDescription(step: number) {
  const descriptions = [
    "Confirm the company and certificate identity.",
    "Confirm the share class, quantity and consideration.",
    "Confirm exactly who receives the shares.",
    "Capture and confirm the authorising resolution.",
    "Complete the issue details and inspect the actual certificate.",
    "Review the certificate and record approval.",
    "Confirm the transaction that will update the securities register.",
    "Record the external filing location.",
    "Final confirmation. This is the lock point.",
  ];

  return descriptions[step - 1] || "";
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fieldGroup}>
      <label style={labelStyle}>{label}</label>
      {children}
      {help ? <div style={fieldHelp}>{help}</div> : null}
    </div>
  );
}

function CheckBox({
  checked,
  onChange,
  label,
  mint = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  mint?: boolean;
}) {
  return (
    <label style={{ ...checkboxPanel, ...(mint ? checkboxPanelMint : {}) }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function StageChecks({ checks }: { checks: [string, boolean][] }) {
  return (
    <aside style={checksPanel}>
      <div style={checksTitle}>Stage completion check</div>

      {checks.map(([label, complete]) => (
        <div
          key={label}
          style={{
            ...checkRow,
            ...(complete ? checkRowComplete : checkRowPending),
          }}
        >
          <span
            style={{
              ...checkIcon,
              ...(complete ? checkIconComplete : {}),
            }}
          >
            {complete ? "✓" : "!"}
          </span>
          <strong>{label}</strong>
        </div>
      ))}
    </aside>
  );
}

function Carry({ label, value }: { label: string; value: string }) {
  return (
    <div style={carryItem}>
      <span style={carryLabel}>{label}</span>
      <strong style={carryValue}>{value}</strong>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryRow}>
      <span style={summaryLabel}>{label}</span>
      <strong style={summaryValue}>{value}</strong>
    </div>
  );
}

function Signature({ name, capacity }: { name: string; capacity: string }) {
  return (
    <div style={signatureBlock}>
      <div style={signatureLine} />
      <strong>{name || "Authorised Signatory"}</strong>
      <span>{capacity || "Director"}</span>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "8px 10px 28px",
  background: "#eef2f5",
  color: "#10233a",
};

const workingFileBar: React.CSSProperties = {
  minHeight: "42px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  gap: "9px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
  fontSize: "11px",
};

const workingFileLabel: React.CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 900,
  letterSpacing: "0.06em",
};

const divider: React.CSSProperties = { color: "#94a3b8" };

const breadcrumbLink: React.CSSProperties = {
  color: "#0f1f33",
  textDecoration: "none",
  fontWeight: 800,
};

const headerBar: React.CSSProperties = {
  minHeight: "70px",
  marginTop: "8px",
  padding: "10px 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const pageTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 900,
};

const pageSubtitle: React.CSSProperties = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "10px",
};

const headerActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const primaryButton: React.CSSProperties = {
  minHeight: "36px",
  padding: "0 13px",
  border: "1px solid #0f1f33",
  borderRadius: 0,
  background: "#0f1f33",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  minHeight: "36px",
  padding: "0 13px",
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f1f33",
  textDecoration: "none",
  fontSize: "10px",
  fontWeight: 900,
};

const lockedBadge: React.CSSProperties = {
  padding: "8px 10px",
  color: "#166534",
  background: "#ecfdf3",
  border: "1px solid #bbf7d0",
  fontSize: "9px",
  fontWeight: 900,
};

const messageBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "10px 12px",
  border: "1px solid",
  fontSize: "10px",
  fontWeight: 900,
};

const successMessage: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const errorMessage: React.CSSProperties = {
  color: "#991b1b",
  background: "#fff1f2",
  borderColor: "#fecaca",
};

const flightMapPanel: React.CSSProperties = {
  marginTop: "8px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const flightMapHeader: React.CSSProperties = {
  minHeight: "62px",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  borderBottom: "1px solid #d2d9e2",
};

const flightTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 900,
};

const flightSubtitle: React.CSSProperties = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "10px",
};

const flightHeaderActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const backButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 9px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f1f33",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const statusBadge: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  fontSize: "9px",
  fontWeight: 900,
};

const completedStatusBadge: React.CSSProperties = {
  borderColor: "#bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
};

const flightMap: React.CSSProperties = {
  padding: "14px 12px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "14px 36px",
};

const flightStepButton: React.CSSProperties = {
  width: "100%",
  padding: 0,
  display: "flex",
  alignItems: "center",
  gap: "9px",
  border: "none",
  background: "transparent",
  textAlign: "left",
  fontFamily: "inherit",
  cursor: "default",
};

const flightStepButtonClickable: React.CSSProperties = {
  cursor: "pointer",
};

const completedStepMarkerClickable: React.CSSProperties = {
  boxShadow: "0 0 0 2px rgba(22, 101, 52, 0.08)",
};

const completedStepLabelClickable: React.CSSProperties = {
  color: "#166534",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const stepMarker: React.CSSProperties = {
  width: "26px",
  height: "26px",
  flex: "0 0 26px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 900,
};

const completedStepMarker: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const activeStepMarker: React.CSSProperties = {
  color: "#ffffff",
  background: "#2457d6",
  borderColor: "#2457d6",
};

const stepLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 800,
};

const activeStepLabel: React.CSSProperties = {
  color: "#0f1f33",
  fontWeight: 900,
};

const stagePanel: React.CSSProperties = {
  marginTop: "8px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
};

const stageHeader: React.CSSProperties = {
  minHeight: "72px",
  padding: "11px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  borderBottom: "1px solid #d2d9e2",
};

const stageEyebrow: React.CSSProperties = {
  color: "#2457d6",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "0.08em",
};

const stageTitle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "17px",
  fontWeight: 900,
};

const stageDescription: React.CSSProperties = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "10px",
};

const readyBadge: React.CSSProperties = {
  padding: "6px 9px",
  border: "1px solid",
  fontSize: "9px",
  fontWeight: 900,
};

const readyBadgeComplete: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const readyBadgePending: React.CSSProperties = {
  color: "#92400e",
  background: "#fffbeb",
  borderColor: "#fde68a",
};

const stageContent: React.CSSProperties = {
  padding: "12px",
};

const stageFooter: React.CSSProperties = {
  minHeight: "58px",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  borderTop: "1px solid #d2d9e2",
};

const footerHint: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
};

const completeButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 11px",
  border: "1px solid #166534",
  background: "#166534",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
};

const finaliseButton: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 14px",
  border: "1px solid #0f1f33",
  background: "#0f1f33",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 900,
  cursor: "pointer",
};

const disabledButton: React.CSSProperties = {
  opacity: 0.45,
  cursor: "default",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px 12px",
};

const fieldGroup: React.CSSProperties = {
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontSize: "10px",
  fontWeight: 900,
};

const input: React.CSSProperties = {
  width: "100%",
  height: "36px",
  padding: "0 9px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "11px",
};

const readOnlyInput: React.CSSProperties = {
  ...input,
  background: "#f8fafc",
  color: "#64748b",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: "82px",
  padding: "8px 9px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  resize: "vertical",
  fontFamily: "inherit",
  fontSize: "10px",
};

const fieldHelp: React.CSSProperties = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "8px",
  lineHeight: 1.35,
};

const checkboxPanel: React.CSSProperties = {
  marginTop: "10px",
  padding: "10px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  border: "1px solid #d8dee7",
  background: "#f8fafc",
  fontSize: "10px",
  fontWeight: 800,
  cursor: "pointer",
};

const checkboxPanelMint: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const stageTwoColumn: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.55fr) minmax(280px, .65fr)",
  gap: "12px",
};

const stageMain: React.CSSProperties = {
  minWidth: 0,
};

const checksPanel: React.CSSProperties = {
  padding: "10px",
  border: "1px solid #d8dee7",
  background: "#fbfcfd",
};

const checksTitle: React.CSSProperties = {
  marginBottom: "8px",
  fontSize: "10px",
  fontWeight: 900,
};

const checkRow: React.CSSProperties = {
  minHeight: "44px",
  marginBottom: "6px",
  padding: "7px 8px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  border: "1px solid",
  fontSize: "9px",
};

const checkRowComplete: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const checkRowPending: React.CSSProperties = {
  color: "#92400e",
  background: "#fffbeb",
  borderColor: "#fde68a",
};

const checkIcon: React.CSSProperties = {
  width: "22px",
  height: "22px",
  flex: "0 0 22px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  border: "1px solid currentColor",
  background: "#ffffff",
  fontWeight: 900,
};

const checkIconComplete: React.CSSProperties = {
  color: "#166534",
};

const carryForwardGrid: React.CSSProperties = {
  marginTop: "12px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  border: "1px solid #d8dee7",
};

const carryItem: React.CSSProperties = {
  minHeight: "62px",
  padding: "9px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "4px",
  borderRight: "1px solid #e5eaf0",
  background: "#f8fafc",
};

const carryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  textTransform: "uppercase",
};

const carryValue: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
};

const certificateGenerationGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(330px, .8fr) minmax(520px, 1.2fr)",
  gap: "12px",
};

const certificatePreviewWrap: React.CSSProperties = {
  minWidth: 0,
  padding: "10px",
  border: "1px solid #d8dee7",
  background: "#eef2f5",
};

const previewLabel: React.CSSProperties = {
  marginBottom: "7px",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.07em",
};

const certificateCanvas: React.CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "1.414 / 1",
  overflow: "hidden",
  background: "#ffffff",
  boxShadow: "0 2px 8px rgba(15,31,51,.12)",
  fontFamily: "Georgia, 'Times New Roman', serif",
  textAlign: "center",
  color: "#111827",
};

const certificateBackground: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "fill",
};

const certificateNo: React.CSSProperties = {
  position: "absolute",
  top: "6%",
  right: "5%",
  fontFamily: "Arial, sans-serif",
  fontSize: "1.2vw",
  fontWeight: 800,
};

const certificateCompany: React.CSSProperties = {
  position: "absolute",
  top: "12%",
  left: "10%",
  right: "10%",
  fontSize: "2.4vw",
  fontWeight: 800,
};

const certificateRegistration: React.CSSProperties = {
  position: "absolute",
  top: "19%",
  left: "10%",
  right: "10%",
  fontFamily: "Arial, sans-serif",
  fontSize: "1vw",
};

const certificateHeading: React.CSSProperties = {
  position: "absolute",
  top: "28%",
  left: "8%",
  right: "8%",
  fontSize: "3vw",
  fontWeight: 800,
  letterSpacing: "0.08em",
};

const certificateSmall: React.CSSProperties = {
  position: "relative",
  top: "42%",
  marginTop: "1.4%",
  fontSize: "1.2vw",
};

const certificateHolder: React.CSSProperties = {
  position: "absolute",
  top: "48%",
  left: "17%",
  right: "17%",
  paddingBottom: "1%",
  borderBottom: "1px solid #94a3b8",
  fontSize: "2vw",
  fontWeight: 800,
};

const certificateShares: React.CSSProperties = {
  position: "absolute",
  top: "61%",
  left: "12%",
  right: "12%",
  fontSize: "1.5vw",
  fontWeight: 800,
};

const certificateTiny: React.CSSProperties = {
  position: "relative",
  top: "59%",
  maxWidth: "76%",
  margin: "1% auto 0",
  fontSize: ".85vw",
};

const certificateIssueLine: React.CSSProperties = {
  position: "absolute",
  bottom: "18%",
  left: "10%",
  right: "10%",
  fontSize: "1vw",
};

const signatureGrid: React.CSSProperties = {
  position: "absolute",
  left: "11%",
  right: "11%",
  bottom: "6%",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12%",
};

const signatureBlock: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  fontFamily: "Arial, sans-serif",
  fontSize: ".8vw",
};

const signatureLine: React.CSSProperties = {
  height: "16px",
  borderBottom: "1px solid #64748b",
};

const resolutionPreview: React.CSSProperties = {
  marginTop: "12px",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const resolutionPreviewHeader: React.CSSProperties = {
  minHeight: "52px",
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  borderBottom: "1px solid #d8dee7",
};

const resolutionPrintButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 9px",
  border: "1px solid #0f1f33",
  background: "#0f1f33",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 900,
  cursor: "pointer",
};

const resolutionBody: React.CSSProperties = {
  minHeight: "190px",
  padding: "12px",
  whiteSpace: "pre-wrap",
  color: "#334155",
  fontSize: "10px",
  lineHeight: 1.55,
};

const legalNote: React.CSSProperties = {
  marginTop: "10px",
  padding: "9px 10px",
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: "9px",
  lineHeight: 1.45,
};

const reviewSummary: React.CSSProperties = {
  marginTop: "10px",
  borderTop: "1px solid #d8dee7",
};

const registerBox: React.CSSProperties = {
  padding: "10px",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const registerHeading: React.CSSProperties = {
  marginBottom: "5px",
  fontSize: "11px",
  fontWeight: 900,
};

const summaryRow: React.CSSProperties = {
  minHeight: "34px",
  display: "grid",
  gridTemplateColumns: "150px minmax(0, 1fr)",
  alignItems: "center",
  gap: "10px",
  borderBottom: "1px solid #e5eaf0",
};

const summaryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 800,
};

const summaryValue: React.CSSProperties = {
  overflowWrap: "anywhere",
  fontSize: "10px",
  fontWeight: 900,
};

const infoBox: React.CSSProperties = {
  marginTop: "10px",
  padding: "9px 10px",
  border: "1px solid #d8dee7",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: "9px",
  lineHeight: 1.5,
};

const finalSummary: React.CSSProperties = {
  border: "1px solid #d8dee7",
};

const finalSummaryTitle: React.CSSProperties = {
  padding: "9px 10px",
  background: "#0f1f33",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 900,
};

const summaryGrid: React.CSSProperties = {
  padding: "0 10px",
};

const finalWarning: React.CSSProperties = {
  marginTop: "12px",
  padding: "11px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: "10px",
};


const finalisedFace: React.CSSProperties = {
  marginTop: "12px",
  padding: "12px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "11px",
  fontWeight: 900,
};

const loadingPanel: React.CSSProperties = {
  marginTop: "8px",
  padding: "20px",
  border: "1px solid #d2d9e2",
  background: "#ffffff",
  color: "#64748b",
  fontSize: "10px",
};
