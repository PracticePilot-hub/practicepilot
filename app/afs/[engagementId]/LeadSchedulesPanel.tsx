"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";
import {
  getLeadScheduleNumber,
  getLeadSchedulePlainTitle,
  type LeadScheduleKey,
} from "./afsLeadScheduleCatalog";

type TrialBalanceLine = {
  id?: string;
  account_code: string | null;
  account_name: string;
  account_type: string | null;
  debit: number;
  credit: number;
  opening_balance?: number | null;
  current_year_balance?: number | null;
  prior_year_balance?: number | null;
  import_basis?: string | null;
  amount_layout?: string | null;
  mapping_category: string | null;
  mapping_leaf_id?: string | null;
  mapping_label?: string | null;
  mapping_statement?: string | null;
  mapping_section?: string | null;
  mapping_path?: string | null;
  mapping_smart_rule?: string | null;
  mapping_confidence?: string | null;
  mapping_saved_at?: string | null;
  mapping_code?: string | null;
  lead_schedule_number?: string | null;
  lead_schedule_key?: string | null;
  note_number: string | null;
};

type LeadScheduleAnnotation = {
  id: string;
  engagement_id: string;
  trial_balance_line_id: string | null;
  schedule_key: string;
  reference_code: string | null;
  tickmark_code: string | null;
  tickmark_label: string | null;
  annotation_note: string | null;
  prepared_by: string | null;
  reviewed_by: string | null;
};

type WorkingPaper = {
  id: string;
  engagement_id: string;
  lead_schedule_key: string | null;
  lead_schedule_number: string | null;
  title: string | null;
  wp_reference: string | null;
  document_type: string | null;
  note: string | null;
  file_name: string | null;
  file_path: string | null;
  file_mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  created_at?: string | null;
};

type ReviewPoint = {
  id: string;
  engagement_id: string;
  source_area: string | null;
  source_id: string | null;
  title: string | null;
  detail: string | null;
  priority: string | null;
  assigned_to: string | null;
  raised_by: string | null;
  raised_at: string | null;
  status: string | null;
  response: string | null;
  cleared_by: string | null;
  cleared_at: string | null;
};

type LeadSubPageKey =
  | "lead-schedule"
  | "supporting-working-paper"
  | "review-notes";

type LeadSchedulesPanelProps = {
  trialBalanceLines: TrialBalanceLine[];
  activeLeadSchedule: LeadScheduleKey | null;
  activeLeadSubPage: LeadSubPageKey;
};

const CASH_KEY = "cash" as LeadScheduleKey;

const tickmarkOptions = [
  { code: "", label: "No tickmark" },
  { code: "BS", label: "Agreed to bank statement" },
  { code: "BR", label: "Bank reconciliation reviewed" },
  { code: "GL", label: "Agreed to general ledger" },
  { code: "PY", label: "Agreed to prior year" },
  { code: "SD", label: "Supporting document inspected" },
  { code: "NA", label: "Not applicable" },
];

export default function LeadSchedulesPanel({
  trialBalanceLines,
  activeLeadSchedule,
  activeLeadSubPage,
}: LeadSchedulesPanelProps) {
  const params = useParams();
  const engagementId = String(params?.engagementId || "");
  const selectedSchedule = activeLeadSchedule;

  const [annotations, setAnnotations] = useState<LeadScheduleAnnotation[]>([]);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);
  const [annotationError, setAnnotationError] = useState("");

  const [workingPapers, setWorkingPapers] = useState<WorkingPaper[]>([]);
  const [loadingWorkingPapers, setLoadingWorkingPapers] = useState(false);
  const [workingPaperError, setWorkingPaperError] = useState("");
  const [uploadingWorkingPaper, setUploadingWorkingPaper] = useState(false);
  const [openingWorkingPaperId, setOpeningWorkingPaperId] = useState("");
  const [reviewPoints, setReviewPoints] = useState<ReviewPoint[]>([]);
const [loadingReviewPoints, setLoadingReviewPoints] = useState(false);
const [reviewPointError, setReviewPointError] = useState("");
const [savingReviewPoint, setSavingReviewPoint] = useState(false);

const [reviewTitle, setReviewTitle] = useState("");
const [reviewDetail, setReviewDetail] = useState("");
const [linkedReviewPaper, setLinkedReviewPaper] = useState<WorkingPaper | null>(null);
const [linkedReviewNote, setLinkedReviewNote] = useState("");
const [savingLinkedReviewNote, setSavingLinkedReviewNote] = useState(false);

  const [wpReference, setWpReference] = useState("");
  const [wpTitle, setWpTitle] = useState("");
  const [wpNote, setWpNote] = useState("");
  const [wpFile, setWpFile] = useState<File | null>(null);

  const [selectedLine, setSelectedLine] = useState<TrialBalanceLine | null>(null);
  const [refInput, setRefInput] = useState("");
  const [tickInput, setTickInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  function openAnnotationPopup(line: TrialBalanceLine) {
    const existing = getAnnotationForLine(annotations, line);

    setSelectedLine(line);
    setRefInput(existing?.reference_code || "");
    setTickInput(existing?.tickmark_code || "");
    setNoteInput(existing?.annotation_note || "");
  }

  function closeAnnotationPopup() {
    if (savingAnnotation) return;

    setSelectedLine(null);
    setRefInput("");
    setTickInput("");
    setNoteInput("");
  }

  function handleFileSelected(file: File | null) {
    setWpFile(file);

    if (file && !wpTitle.trim()) {
      setWpTitle(stripFileExtension(file.name));
    }
  }

  async function saveAnnotation() {
    if (!engagementId || !selectedSchedule || !selectedLine?.id) return;

    const existing = getAnnotationForLine(annotations, selectedLine);
    const selectedTickmark = tickmarkOptions.find(
      (option) => option.code === tickInput
    );

    try {
      setSavingAnnotation(true);
      setAnnotationError("");

      const payload = {
        id: existing?.id,
        trialBalanceLineId: selectedLine.id,
        trial_balance_line_id: selectedLine.id,
        scheduleKey: selectedSchedule,
        schedule_key: selectedSchedule,
        referenceCode: refInput.trim(),
        reference_code: refInput.trim(),
        tickmarkCode: tickInput.trim(),
        tickmark_code: tickInput.trim(),
        tickmarkLabel: selectedTickmark?.label || "",
        tickmark_label: selectedTickmark?.label || "",
        annotationNote: noteInput.trim(),
        annotation_note: noteInput.trim(),
      };

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/lead-schedule-annotations`,
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to save annotation.");
      }

      const savedAnnotation =
        result.annotation || result.record || result.data || result.annotations?.[0];

      if (!savedAnnotation) {
        throw new Error("Annotation saved, but the saved record was not returned.");
      }

      setAnnotations((current) => {
        const exists = current.some(
          (annotation) => annotation.id === savedAnnotation.id
        );

        if (exists) {
          return current.map((annotation) =>
            annotation.id === savedAnnotation.id ? savedAnnotation : annotation
          );
        }

        return [...current, savedAnnotation];
      });

      closeAnnotationPopup();
    } catch (error: any) {
      setAnnotationError(error?.message || "Failed to save annotation.");
    } finally {
      setSavingAnnotation(false);
    }
  }

  async function loadWorkingPapers(scheduleKey: LeadScheduleKey) {
    if (!engagementId) return;

    try {
      setLoadingWorkingPapers(true);
      setWorkingPaperError("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/working-papers?leadScheduleKey=${encodeURIComponent(
          String(scheduleKey)
        )}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to load working papers.");
      }

      setWorkingPapers(result.workingPapers || []);
    } catch (error: any) {
      setWorkingPaperError(error?.message || "Failed to load working papers.");
    } finally {
      setLoadingWorkingPapers(false);
    }
  }

  async function uploadWorkingPaper() {
    if (!engagementId || !selectedSchedule || !wpFile) {
      setWorkingPaperError("Select a PDF, Word or Excel file before uploading.");
      return;
    }

    if (!isAllowedFile(wpFile.name)) {
      setWorkingPaperError("Only PDF, Word and Excel files are allowed.");
      return;
    }

    try {
      setUploadingWorkingPaper(true);
      setWorkingPaperError("");

      const scheduleNumber = getLeadScheduleNumber(selectedSchedule);

      const formData = new FormData();
      formData.append("file", wpFile);
      formData.append("leadScheduleKey", String(selectedSchedule));
      formData.append("leadScheduleNumber", scheduleNumber || "");
      formData.append("wpReference", wpReference.trim());
      formData.append("documentType", inferDocumentType(wpFile.name));
      formData.append("title", wpTitle.trim() || wpFile.name);
      formData.append("note", wpNote.trim());

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/working-papers`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to upload working paper.");
      }

      setWorkingPapers((current) => [result.workingPaper, ...current]);

      setWpReference("");
      setWpTitle("");
      setWpNote("");
      setWpFile(null);
    } catch (error: any) {
      setWorkingPaperError(error?.message || "Failed to upload working paper.");
    } finally {
      setUploadingWorkingPaper(false);
    }
  }

  async function viewWorkingPaper(paper: WorkingPaper) {
    if (!engagementId || !paper.file_path) {
      setWorkingPaperError("No file path found for this working paper.");
      return;
    }

    try {
      setOpeningWorkingPaperId(paper.id);
      setWorkingPaperError("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/working-papers?filePath=${encodeURIComponent(
          paper.file_path
        )}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result?.error || "Could not open this file.");
      }

      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setWorkingPaperError(error?.message || "Could not open this file.");
    } finally {
      setOpeningWorkingPaperId("");
    }
  }
function getReviewSourceArea(scheduleKey: LeadScheduleKey) {
  return `lead-schedule:${String(scheduleKey)}`;
}

async function loadReviewPoints(scheduleKey: LeadScheduleKey) {
  if (!engagementId) return;

  try {
    setLoadingReviewPoints(true);
    setReviewPointError("");

    const sourceArea = getReviewSourceArea(scheduleKey);

    const response = await fetch(
      `/api/afs/engagements/${engagementId}/review-points?sourceArea=${encodeURIComponent(
        sourceArea
      )}`,
      { cache: "no-store" }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to load review points.");
    }

    setReviewPoints(result.reviewPoints || []);
  } catch (error: any) {
    setReviewPointError(error?.message || "Failed to load review points.");
  } finally {
    setLoadingReviewPoints(false);
  }
}

async function saveReviewPoint() {
  if (!engagementId || !selectedSchedule) return;

  if (!reviewTitle.trim() && !reviewDetail.trim()) {
    setReviewPointError("Add a review title or note before saving.");
    return;
  }

  try {
    setSavingReviewPoint(true);
    setReviewPointError("");

    const response = await fetch(
      `/api/afs/engagements/${engagementId}/review-points`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceArea: getReviewSourceArea(selectedSchedule),
          title: reviewTitle.trim() || "Review point",
          detail: reviewDetail.trim(),
          priority: "normal",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to save review point.");
    }

    setReviewPoints((current) => [result.reviewPoint, ...current]);
    setReviewTitle("");
    setReviewDetail("");
  } catch (error: any) {
    setReviewPointError(error?.message || "Failed to save review point.");
  } finally {
    setSavingReviewPoint(false);
  }
}

async function updateReviewPointStatus(point: ReviewPoint, status: string) {
  if (!engagementId) return;

  try {
    setReviewPointError("");

    const response = await fetch(
      `/api/afs/engagements/${engagementId}/review-points`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: point.id,
          status,
          response: point.response || "",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to update review point.");
    }

    setReviewPoints((current) =>
      current.map((item) =>
        item.id === result.reviewPoint.id ? result.reviewPoint : item
      )
    );
  } catch (error: any) {
    setReviewPointError(error?.message || "Failed to update review point.");
  }
}

function addReviewNoteForWorkingPaper(paper: WorkingPaper) {
  setLinkedReviewPaper(paper);
  setLinkedReviewNote("");
  setReviewPointError("");
}

async function saveLinkedReviewNote() {
  if (!engagementId || !selectedSchedule || !linkedReviewPaper) return;

  if (!linkedReviewNote.trim()) {
    setReviewPointError("Add a review note before saving.");
    return;
  }

  try {
    setSavingLinkedReviewNote(true);
    setReviewPointError("");

    const response = await fetch(
      `/api/afs/engagements/${engagementId}/review-points`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceArea: getReviewSourceArea(selectedSchedule),
          sourceId: linkedReviewPaper.id,
          title: getPaperTitle(linkedReviewPaper),
          detail: linkedReviewNote.trim(),
          priority: "normal",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to save review note.");
    }

    setReviewPoints((current) => [result.reviewPoint, ...current]);
    setLinkedReviewPaper(null);
    setLinkedReviewNote("");
  } catch (error: any) {
    setReviewPointError(error?.message || "Failed to save review note.");
  } finally {
    setSavingLinkedReviewNote(false);
  }
}

  useEffect(() => {
    if (!engagementId) return;

    async function loadAnnotations() {
      try {
        setLoadingAnnotations(true);
        setAnnotationError("");

        const response = await fetch(
          `/api/afs/engagements/${engagementId}/lead-schedule-annotations`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "Failed to load annotations.");
        }

        setAnnotations(result.annotations || []);
      } catch (error: any) {
        setAnnotationError(error?.message || "Failed to load annotations.");
      } finally {
        setLoadingAnnotations(false);
      }
    }

    loadAnnotations();
  }, [engagementId]);

  useEffect(() => {
  if (
    !selectedSchedule ||
    (activeLeadSubPage !== "supporting-working-paper" &&
      activeLeadSubPage !== "review-notes")
  ) {
    return;
  }

  loadWorkingPapers(selectedSchedule);
}, [engagementId, selectedSchedule, activeLeadSubPage]);

  const matchedLines = useMemo(() => {
    if (!selectedSchedule) return [];

    return trialBalanceLines.filter((line) =>
      matchesLeadSchedule(line, selectedSchedule)
    );
  }, [trialBalanceLines, selectedSchedule]);

  const cashLines = useMemo(() => {
    if (selectedSchedule !== CASH_KEY) return [];

    return trialBalanceLines.filter((line) => {
      if (matchesLeadSchedule(line, CASH_KEY)) return true;

      const code = normaliseCode(line.lead_schedule_number || line.mapping_code);
      return code === "620" || code.startsWith("620.");
    });
  }, [trialBalanceLines, selectedSchedule]);

  const linesForTotals = selectedSchedule === CASH_KEY ? cashLines : matchedLines;
  const currentTotal = linesForTotals.reduce(
    (total, line) => total + currentBalance(line),
    0
  );
  const priorTotal = linesForTotals.reduce(
    (total, line) => total + priorBalance(line),
    0
  );
  const movementTotal = currentTotal - priorTotal;

  if (!selectedSchedule) {
    return (
      <section style={styles.wrapper}>
        <div style={styles.emptyState}>
          <p style={styles.emptyKicker}>Lead schedules</p>
          <h3 style={styles.emptyTitle}>Select a lead schedule</h3>
          <p style={styles.emptyText}>
            Choose a lead schedule from the left-hand index to open the working paper.
          </p>
        </div>
      </section>
    );
  }

  const scheduleNumber = getLeadScheduleNumber(selectedSchedule);
  const scheduleTitle = getLeadSchedulePlainTitle(selectedSchedule);
  const fullScheduleTitle = scheduleNumber
    ? `${scheduleNumber}. ${scheduleTitle}`
    : scheduleTitle;

  if (activeLeadSubPage === "supporting-working-paper") {
    return (
      <section style={styles.wrapper}>
        <header style={styles.headerPlain}>
          <div>
            <p style={styles.kicker}>Supporting working paper</p>
            <h3 style={styles.title}>{scheduleNumber}.001 · Supporting working paper</h3>
            <p style={styles.subtitle}>
              Supporting documents for {fullScheduleTitle}.
            </p>
          </div>

          <div style={styles.headerPlainMeta}>
            <span>Files: {workingPapers.length}</span>
          </div>
        </header>

        <main style={styles.body}>
          <section style={styles.registerSection}>
            <div style={styles.registerTitleRow}>
              <strong>Upload supporting file</strong>
              <span>PDF, Word or Excel</span>
            </div>

            <div style={styles.uploadLineOne}>
              <label style={styles.flatField}>
                Ref
                <input
                  value={wpReference}
                  onChange={(event) => setWpReference(event.target.value)}
                  placeholder="WP1"
                  style={styles.flatInput}
                />
              </label>

              <label style={styles.flatField}>
                Document name
                <input
                  value={wpTitle}
                  onChange={(event) => setWpTitle(event.target.value)}
                  placeholder="Bank reconciliation / POP / Statement"
                  style={styles.flatInput}
                />
              </label>

              <label style={styles.flatField}>
                File
                <input
                  key={wpFile ? wpFile.name : "empty-file"}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(event) =>
                    handleFileSelected(event.target.files?.[0] || null)
                  }
                  style={styles.flatFileInput}
                />
              </label>

              <button
                type="button"
                style={
                  uploadingWorkingPaper
                    ? styles.flatButtonDisabled
                    : styles.flatButton
                }
                onClick={uploadWorkingPaper}
                disabled={uploadingWorkingPaper}
              >
                {uploadingWorkingPaper ? "Uploading..." : "Upload"}
              </button>
            </div>

            <div style={styles.selectedFileLine}>
              <span>Selected file:</span>
              <strong>{wpFile ? wpFile.name : "None selected"}</strong>
            </div>

            <div style={styles.uploadLineTwo}>
              <label style={styles.flatField}>
                Note
                <input
                  value={wpNote}
                  onChange={(event) => setWpNote(event.target.value)}
                  placeholder="Optional note"
                  style={styles.flatInput}
                />
              </label>
            </div>

            {workingPaperError ? (
              <div style={styles.inlineError}>{workingPaperError}</div>
            ) : null}
          </section>

          <section style={styles.registerSection}>
            <div style={styles.registerTitleRow}>
              <strong>Supporting file register</strong>
              <span>
                {loadingWorkingPapers
                  ? "Loading..."
                  : `${workingPapers.length} file(s)`}
              </span>
            </div>

            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <colgroup>
                  <col style={styles.colRef} />
                  <col style={styles.colDescription} />
                  <col style={styles.colMapping} />
                  <col style={styles.colDescription} />
                  <col style={styles.colNote} />
                  <col style={styles.colMoney} />
                  <col style={styles.colAction} />
                </colgroup>

                <thead>
                  <tr>
                    <th style={styles.th}>Ref</th>
                    <th style={styles.th}>Document name</th>
                    <th style={styles.th}>File name</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Note</th>
                    <th style={styles.thRight}>Uploaded</th>
                    <th style={styles.thRight}>Action</th>
                  </tr>
                </thead>

                <tbody>
  {workingPapers.length === 0 ? (
    <tr>
      <td colSpan={7} style={styles.emptyCell}>
        No supporting files uploaded for this lead schedule yet.
      </td>
    </tr>
  ) : (
    workingPapers.map((paper) => (
      <tr key={paper.id}>
        <td style={styles.tdRef}>{paper.wp_reference || ""}</td>
        <td style={styles.td}>{paper.title || ""}</td>
        <td style={styles.tdMuted}>{paper.file_name || ""}</td>
        <td style={styles.td}>{paper.document_type || ""}</td>
        <td style={styles.tdMuted}>{paper.note || ""}</td>
        <td style={styles.tdRight}>
          {formatDate(paper.uploaded_at || paper.created_at)}
        </td>
        <td style={styles.tdRight}>
          <div style={styles.actionButtons}>
            <button
              type="button"
              style={styles.viewButton}
              onClick={() => viewWorkingPaper(paper)}
              disabled={openingWorkingPaperId === paper.id}
            >
              {openingWorkingPaperId === paper.id ? "Opening..." : "View"}
            </button>

            <button
              type="button"
              style={styles.viewButton}
              onClick={() => addReviewNoteForWorkingPaper(paper)}
            >
              Review note
            </button>
          </div>
        </td>
      </tr>
    ))
  )}
</tbody>
              </table>
            </div>
          </section>
        </main>
      </section>
    );
  }

  if (activeLeadSubPage === "review-notes") {
  return (
    <section style={styles.wrapper}>
      <header style={styles.headerPlain}>
        <div>
          <p style={styles.kicker}>Review notes</p>
          <h3 style={styles.title}>{scheduleNumber}.002 · Review notes</h3>
          <p style={styles.subtitle}>
            Independent review points for {fullScheduleTitle}.
          </p>
        </div>

        <div style={styles.headerPlainMeta}>
          <span>Open: {reviewPoints.filter((point) => point.status !== "Cleared").length}</span>
          <span>Total: {reviewPoints.length}</span>
        </div>
      </header>

      <main style={styles.body}>
        <section style={styles.registerSection}>
          <div style={styles.registerTitleRow}>
            <strong>Add review note</strong>
            <span>Reviewer query / issue / correction required</span>
          </div>

          <div style={styles.uploadLineOne}>
            <label style={styles.flatField}>
              Title
              <input
                value={reviewTitle}
                onChange={(event) => setReviewTitle(event.target.value)}
                placeholder="Missing bank reconciliation"
                style={styles.flatInput}
              />
            </label>

            <label style={styles.flatField}>
              Review note
              <input
                value={reviewDetail}
                onChange={(event) => setReviewDetail(event.target.value)}
                placeholder="Explain the issue or review query"
                style={styles.flatInput}
              />
            </label>

            <button
              type="button"
              style={savingReviewPoint ? styles.flatButtonDisabled : styles.flatButton}
              onClick={saveReviewPoint}
              disabled={savingReviewPoint}
            >
              {savingReviewPoint ? "Saving..." : "Add"}
            </button>
          </div>

          {reviewPointError ? (
            <div style={styles.inlineError}>{reviewPointError}</div>
          ) : null}
        </section>

        <section style={styles.registerSection}>
          <div style={styles.registerTitleRow}>
            <strong>Review notes register</strong>
            <span>
              {loadingReviewPoints ? "Loading..." : `${reviewPoints.length} note(s)`}
            </span>
          </div>

          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <colgroup>
                <col style={styles.colDescription} />
                <col style={styles.colMapping} />
                <col style={styles.colDescription} />
                <col style={styles.colRef} />
                <col style={styles.colAction} />
              </colgroup>

              <thead>
  <tr>
    <th style={styles.th}>Ref</th>
    <th style={styles.th}>Document name</th>
    <th style={styles.th}>File name</th>
    <th style={styles.th}>Type</th>
    <th style={styles.th}>Note</th>
    <th style={styles.thRight}>Uploaded</th>
    <th style={styles.thRight}>Actions</th>
  </tr>
</thead>

              <tbody>
                {reviewPoints.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.emptyCell}>
                      No review notes raised for this lead schedule yet.
                    </td>
                  </tr>
                ) : (
                  reviewPoints.map((point) => (
                    <tr key={point.id}>
                      <td style={styles.td}>{point.title || ""}</td>
                      <td style={styles.tdMuted}>{point.detail || ""}</td>
                      <td style={styles.tdMuted}>{formatDate(point.raised_at)}</td>
                      <td style={styles.tdRef}>{point.status || "Open"}</td>
                      <td style={styles.tdRight}>
                        {(point.status || "Open") === "Cleared" ? (
                          <button
                            type="button"
                            style={styles.viewButton}
                            onClick={() => updateReviewPointStatus(point, "Open")}
                          >
                            Reopen
                          </button>
                        ) : (
                          <button
                            type="button"
                            style={styles.viewButton}
                            onClick={() => updateReviewPointStatus(point, "Cleared")}
                          >
                            Clear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </section>
  );
}

  if (selectedSchedule === CASH_KEY) {
    const cashAndBank = cashLines.filter((line) => currentBalance(line) >= 0);
    const overdrafts = cashLines.filter((line) => currentBalance(line) < 0);

    const cashTotal = cashAndBank.reduce(
      (total, line) => total + currentBalance(line),
      0
    );
    const overdraftTotal = overdrafts.reduce(
      (total, line) => total + currentBalance(line),
      0
    );
    const netCash = cashTotal + overdraftTotal;

    return (
      <section style={styles.wrapper}>
        <header style={styles.header}>
          <div>
            <p style={styles.kicker}>Lead schedule</p>
            <h3 style={styles.title}>{fullScheduleTitle}</h3>
            <p style={styles.subtitle}>
              Cash and bank balances mapped through the AFS mapping catalogue.
            </p>
          </div>

          <div style={styles.headerStats}>
            <Stat label="Accounts" value={cashLines.length} />
            <Stat label="Current" value={formatMoney(netCash)} />
            <Stat label="Prior" value={formatMoney(priorTotal)} />
            <Stat label="Movement" value={formatMoney(netCash - priorTotal)} />
          </div>
        </header>

        <main style={styles.body}>
          <ScheduleSection
            title="Cash and bank balances"
            lines={cashAndBank}
            total={cashTotal}
            emptyText="No debit cash/bank balances mapped yet."
            annotations={annotations}
            onOpenAnnotation={openAnnotationPopup}
          />

          <ScheduleSection
            title="Bank overdrafts / credit bank balances"
            lines={overdrafts}
            total={overdraftTotal}
            emptyText="No credit bank balances mapped yet."
            annotations={annotations}
            onOpenAnnotation={openAnnotationPopup}
          />
        </main>

        <footer style={styles.reconciliationFooter}>
          <ReconLine label="Cash and bank balances" value={cashTotal} />
          <ReconLine label="Bank overdrafts" value={overdraftTotal} />
          <ReconLine label="Net cash and cash equivalents" value={netCash} bold />
        </footer>

        {loadingAnnotations ? (
          <span style={styles.statusText}>Loading annotations...</span>
        ) : null}
        {annotationError ? (
          <span style={styles.errorText}>{annotationError}</span>
        ) : null}

        {selectedLine ? (
          <AnnotationPopup
            line={selectedLine}
            refInput={refInput}
            tickInput={tickInput}
            noteInput={noteInput}
            saving={savingAnnotation}
            onRefChange={setRefInput}
            onTickChange={setTickInput}
            onNoteChange={setNoteInput}
            onClose={closeAnnotationPopup}
            onSave={saveAnnotation}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Lead schedule</p>
          <h3 style={styles.title}>{fullScheduleTitle}</h3>
          <p style={styles.subtitle}>
            Accounts linked to this numbered AFS lead schedule.
          </p>
        </div>

        <div style={styles.headerStats}>
          <Stat label="Accounts" value={matchedLines.length} />
          <Stat label="Current" value={formatMoney(currentTotal)} />
          <Stat label="Prior" value={formatMoney(priorTotal)} />
          <Stat label="Movement" value={formatMoney(movementTotal)} />
        </div>
      </header>

      <main style={styles.body}>
        <ScheduleSection
          title={fullScheduleTitle}
          lines={matchedLines}
          total={currentTotal}
          emptyText={`No accounts mapped to ${fullScheduleTitle} yet.`}
          annotations={annotations}
          onOpenAnnotation={openAnnotationPopup}
        />
      </main>

      <footer style={styles.reconciliationFooter}>
        <ReconLine label="Current year total" value={currentTotal} />
        <ReconLine label="Prior year total" value={priorTotal} />
        <ReconLine label="Movement" value={movementTotal} bold />
      </footer>

      {loadingAnnotations ? (
        <span style={styles.statusText}>Loading annotations...</span>
      ) : null}
      {annotationError ? (
        <span style={styles.errorText}>{annotationError}</span>
      ) : null}

      {selectedLine ? (
        <AnnotationPopup
          line={selectedLine}
          refInput={refInput}
          tickInput={tickInput}
          noteInput={noteInput}
          saving={savingAnnotation}
          onRefChange={setRefInput}
          onTickChange={setTickInput}
          onNoteChange={setNoteInput}
          onClose={closeAnnotationPopup}
          onSave={saveAnnotation}
        />
      ) : null}
    </section>
  );
}

function ScheduleSection({
  title,
  lines,
  total,
  emptyText,
  annotations,
  onOpenAnnotation,
}: {
  title: string;
  lines: TrialBalanceLine[];
  total: number;
  emptyText: string;
  annotations: LeadScheduleAnnotation[];
  onOpenAnnotation: (line: TrialBalanceLine) => void;
}) {
  return (
    <section style={styles.sectionBox}>
      <div style={styles.sectionHeader}>
        <strong>{title}</strong>
        <span>{formatMoney(total)}</span>
      </div>

      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <colgroup>
            <col style={styles.colAccount} />
            <col style={styles.colDescription} />
            <col style={styles.colMapping} />
            <col style={styles.colRef} />
            <col style={styles.colTick} />
            <col style={styles.colNote} />
            <col style={styles.colMoney} />
            <col style={styles.colMoney} />
            <col style={styles.colMoney} />
          </colgroup>

          <thead>
            <tr>
              <th style={styles.th}>Account</th>
              <th style={styles.th}>Description</th>
              <th style={styles.th}>Mapping</th>
              <th style={styles.th}>Ref</th>
              <th style={styles.th}>Tick</th>
              <th style={styles.th}>Note</th>
              <th style={styles.thRight}>Current</th>
              <th style={styles.thRight}>Prior</th>
              <th style={styles.thRight}>Movement</th>
            </tr>
          </thead>

          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={9} style={styles.emptyCell}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const annotation = getAnnotationForLine(annotations, line);
                const current = currentBalance(line);
                const prior = priorBalance(line);

                return (
                  <tr
                    key={line.id || `${line.account_code}-${line.account_name}`}
                    style={styles.clickableRow}
                    onClick={() => onOpenAnnotation(line)}
                  >
                    <td style={styles.tdCode}>{line.account_code || ""}</td>
                    <td style={styles.td}>{line.account_name}</td>
                    <td style={styles.tdMuted}>{formatMappingLabel(line)}</td>
                    <td style={styles.tdRef}>{annotation?.reference_code || ""}</td>
                    <td style={styles.tdTick}>
                      {annotation?.tickmark_code ? (
                        <span style={styles.tickmark}>
                          {annotation.tickmark_code}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td style={styles.tdMuted}>{annotation?.annotation_note || ""}</td>
                    <td style={styles.tdRight}>{formatMoney(current)}</td>
                    <td style={styles.tdRight}>{formatMoney(prior)}</td>
                    <td style={styles.tdRight}>{formatMoney(current - prior)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnnotationPopup({
  line,
  refInput,
  tickInput,
  noteInput,
  saving,
  onRefChange,
  onTickChange,
  onNoteChange,
  onClose,
  onSave,
}: {
  line: TrialBalanceLine;
  refInput: string;
  tickInput: string;
  noteInput: string;
  saving: boolean;
  onRefChange: (value: string) => void;
  onTickChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div style={styles.popupBackdrop} onClick={onClose}>
      <div style={styles.popupCard} onClick={(event) => event.stopPropagation()}>
        <div style={styles.popupHeader}>
          <div>
            <p style={styles.popupKicker}>Working paper annotation</p>
            <h3 style={styles.popupTitle}>
              {line.account_code || ""} · {line.account_name}
            </h3>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={styles.popupGrid}>
          <label style={styles.fieldLabel}>
            Ref
            <input
              value={refInput}
              onChange={(event) => onRefChange(event.target.value)}
              placeholder="B1, B2, WP1..."
              style={styles.input}
            />
          </label>

          <label style={styles.fieldLabel}>
            Tickmark
            <select
              value={tickInput}
              onChange={(event) => onTickChange(event.target.value)}
              style={styles.input}
            >
              {tickmarkOptions.map((option) => (
                <option key={option.code || "blank"} value={option.code}>
                  {option.code ? `${option.code} · ${option.label}` : option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.fieldLabelWide}>
            Note
            <textarea
              value={noteInput}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Optional working-paper note..."
              style={styles.textarea}
            />
          </label>
        </div>

        <div style={styles.popupFooter}>
          <button type="button" style={styles.secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={saving ? styles.primaryButtonDisabled : styles.primaryButton}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save annotation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.statBox}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReconLine({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div style={bold ? styles.reconLineBold : styles.reconLine}>
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
    </div>
  );
}

function matchesLeadSchedule(line: TrialBalanceLine, key: LeadScheduleKey) {
  const expectedKey = String(key);
  const expectedNumber = normaliseCode(getLeadScheduleNumber(key));

  if (line.lead_schedule_key && String(line.lead_schedule_key) === expectedKey) {
    return true;
  }

  const leadScheduleNumber = normaliseCode(line.lead_schedule_number);
  if (leadScheduleNumber && expectedNumber) {
    if (leadScheduleNumber === expectedNumber) return true;
    if (leadScheduleNumber.startsWith(`${expectedNumber}.`)) return true;
  }

  const mappingCode = normaliseCode(line.mapping_code);
  if (mappingCode && expectedNumber) {
    if (mappingCode === expectedNumber) return true;
    if (mappingCode.startsWith(`${expectedNumber}.`)) return true;
  }

  return false;
}

function normaliseCode(value: string | null | undefined) {
  return String(value || "").trim();
}

function getAnnotationForLine(
  annotations: LeadScheduleAnnotation[],
  line: TrialBalanceLine
) {
  return (
    annotations.find(
      (annotation) => annotation.trial_balance_line_id === line.id
    ) || null
  );
}

function formatMappingLabel(line: TrialBalanceLine) {
  const code = line.mapping_code || line.lead_schedule_number || "";
  const label = line.mapping_label || line.mapping_category || "";

  if (code && label) return `${code} · ${label}`;
  if (label) return label;
  if (code) return code;
  return "Unmapped";
}

function toNumber(value: any) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function currentBalance(line: TrialBalanceLine) {
  if (line.current_year_balance !== undefined && line.current_year_balance !== null) {
    return toNumber(line.current_year_balance);
  }

  return toNumber(line.debit) - toNumber(line.credit);
}

function priorBalance(line: TrialBalanceLine) {
  return toNumber(line.prior_year_balance);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function isAllowedFile(fileName: string) {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsx")
  );
}

function inferDocumentType(fileName: string) {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "Word";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "Excel";

  return "Supporting document";
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function getPaperTitle(paper: WorkingPaper) {
  return (
    paper.title ||
    stripFileExtension(paper.file_name || "") ||
    "Supporting file"
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    padding: "8px",
    boxShadow: "none",
    display: "grid",
    gap: "8px",
    minHeight: 0,
    overflow: "visible",
  },
  emptyState: {
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    background: "#f8fafc",
    padding: "18px",
    alignSelf: "start",
  },
  emptyKicker: {
    margin: "0 0 4px 0",
    color: "#2563eb",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  emptyTitle: {
    margin: "0 0 6px 0",
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: 900,
  },
  emptyText: {
    margin: 0,
    color: "#475569",
    fontSize: "12px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "0 0 7px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  headerPlain: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    padding: "0 0 7px 0",
    borderBottom: "1px solid #cbd5e1",
  },
  headerPlainMeta: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    color: "#334155",
    fontSize: "11px",
    fontWeight: 750,
    whiteSpace: "nowrap",
  },
  kicker: {
    margin: "0 0 2px 0",
    color: "#2563eb",
    fontSize: "9.5px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: 900,
    lineHeight: 1.15,
  },
  subtitle: {
    margin: "3px 0 0 0",
    color: "#334155",
    fontSize: "11.5px",
    lineHeight: 1.25,
  },
  headerStats: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "stretch",
    gap: "6px",
    flexWrap: "wrap",
  },
  statBox: {
    border: "1px solid #dbe3ef",
    borderRadius: "7px",
    background: "#f8fafc",
    padding: "6px 8px",
    minWidth: "86px",
    display: "grid",
    gap: "2px",
    color: "#0f172a",
    fontSize: "11px",
  },
  body: {
    minHeight: 0,
    overflow: "visible",
    padding: "8px 0",
    display: "grid",
    alignContent: "start",
    gap: "8px",
  },
  registerSection: {
    borderTop: "1px solid #cbd5e1",
    borderBottom: "1px solid #e5e7eb",
    background: "#ffffff",
  },
  registerTitleRow: {
    background: "#f8fafc",
    borderBottom: "1px solid #dbe3ef",
    padding: "5px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    color: "#0f172a",
    fontSize: "11.5px",
  },
  uploadLineOne: {
    display: "grid",
    gridTemplateColumns: "90px minmax(260px, 1fr) minmax(320px, 1.2fr) 86px",
    gap: "6px",
    alignItems: "end",
    padding: "7px 8px 4px 8px",
  },
  selectedFileLine: {
    display: "flex",
    gap: "8px",
    padding: "2px 8px 5px 8px",
    color: "#475569",
    fontSize: "11px",
    borderBottom: "1px solid #eef2f7",
  },
  uploadLineTwo: {
    padding: "7px 8px 7px 8px",
  },
  flatField: {
    display: "grid",
    gap: "2px",
    color: "#334155",
    fontSize: "10px",
    fontWeight: 850,
  },
  flatInput: {
    border: "1px solid #cbd5e1",
    borderRadius: "2px",
    padding: "5px 6px",
    fontSize: "11.5px",
    color: "#0f172a",
    outline: "none",
    background: "#ffffff",
    height: "28px",
  },
  flatFileInput: {
    border: "1px solid #cbd5e1",
    borderRadius: "2px",
    padding: "4px 6px",
    fontSize: "11px",
    color: "#0f172a",
    outline: "none",
    background: "#ffffff",
    height: "28px",
  },
  flatButton: {
    border: "1px solid #1d4ed8",
    borderRadius: "2px",
    background: "#1d4ed8",
    color: "#ffffff",
    padding: "6px 8px",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: "11px",
    height: "28px",
  },
  flatButtonDisabled: {
    border: "1px solid #93c5fd",
    borderRadius: "2px",
    background: "#93c5fd",
    color: "#ffffff",
    padding: "6px 8px",
    fontWeight: 850,
    cursor: "not-allowed",
    fontSize: "11px",
    height: "28px",
  },
  inlineError: {
    padding: "0 8px 7px 8px",
    color: "#b91c1c",
    fontSize: "11px",
    fontWeight: 850,
  },
  sectionBox: {
    border: "1px solid #dbe3ef",
    borderRadius: "4px",
    overflow: "hidden",
    background: "#ffffff",
  },
  sectionHeader: {
    background: "#f8fafc",
    borderBottom: "1px solid #dbe3ef",
    padding: "6px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    color: "#0f172a",
    fontSize: "12px",
  },
  plainTextBlock: {
    padding: "10px",
    fontSize: "12px",
    color: "#334155",
  },
  tableScroll: {
    overflow: "visible",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "11.5px",
  },
  colAccount: { width: "9%" },
  colDescription: { width: "14%" },
  colMapping: { width: "23%" },
  colRef: { width: "6%" },
  colTick: { width: "7%" },
  colNote: { width: "13%" },
  colMoney: { width: "9.33%" },
  colAction: { width: "7%" },
  th: {
    textAlign: "left",
    padding: "5px 8px",
    borderBottom: "1px solid #e5e7eb",
    color: "#334155",
    fontSize: "10.5px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: "5px 8px",
    borderBottom: "1px solid #e5e7eb",
    color: "#334155",
    fontSize: "10.5px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  clickableRow: { cursor: "pointer" },
  td: {
    padding: "6px 8px",
    borderBottom: "1px solid #eef2f7",
    color: "#0f172a",
    verticalAlign: "top",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tdCode: {
    padding: "6px 8px",
    borderBottom: "1px solid #eef2f7",
    color: "#0f172a",
    fontWeight: 900,
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tdMuted: {
    padding: "6px 8px",
    borderBottom: "1px solid #eef2f7",
    color: "#64748b",
    verticalAlign: "top",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tdRef: {
    padding: "6px 8px",
    borderBottom: "1px solid #eef2f7",
    color: "#0f172a",
    fontWeight: 850,
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tdTick: {
    padding: "6px 8px",
    borderBottom: "1px solid #eef2f7",
    color: "#0f172a",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tdRight: {
    padding: "6px 8px",
    borderBottom: "1px solid #eef2f7",
    color: "#0f172a",
    textAlign: "right",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  emptyCell: {
    padding: "8px",
    color: "#64748b",
    fontSize: "11.5px",
    borderBottom: "1px solid #eef2f7",
  },
  viewButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "2px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "3px 7px",
    fontSize: "10.5px",
    fontWeight: 850,
    cursor: "pointer",
  },
  tickmark: {
    display: "inline-block",
    border: "1px solid #14b8a6",
    borderRadius: "999px",
    padding: "1px 6px",
    color: "#0f766e",
    background: "#f0fdfa",
    fontSize: "10px",
    fontWeight: 900,
  },
  reconciliationFooter: {
    borderTop: "1px solid #dbe3ef",
    background: "#ffffff",
    padding: "6px 8px",
    display: "grid",
    gap: "0",
  },
  reconLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "5px 0",
    borderBottom: "1px solid #eef2f7",
    color: "#0f172a",
    fontSize: "11.5px",
  },
  reconLineBold: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "6px 0 2px 0",
    color: "#0f172a",
    fontSize: "12px",
    fontWeight: 900,
  },
  popupBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.22)",
    zIndex: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
  },
  popupCard: {
    width: "min(620px, 100%)",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
    overflow: "hidden",
  },
  popupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f8fafc",
  },
  popupKicker: {
    margin: "0 0 3px 0",
    color: "#2563eb",
    fontSize: "9.5px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  popupTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: 900,
  },
  closeButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    background: "#ffffff",
    color: "#0f172a",
    width: "28px",
    height: "28px",
    cursor: "pointer",
    fontSize: "18px",
    lineHeight: 1,
  },
  popupGrid: {
    padding: "12px",
    display: "grid",
    gridTemplateColumns: "1fr 1.6fr",
    gap: "10px",
  },
  fieldLabel: {
    display: "grid",
    gap: "4px",
    color: "#334155",
    fontSize: "11px",
    fontWeight: 850,
  },
  fieldLabelWide: {
    display: "grid",
    gap: "4px",
    color: "#334155",
    fontSize: "11px",
    fontWeight: 850,
    gridColumn: "1 / -1",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    padding: "7px 8px",
    fontSize: "12px",
    color: "#0f172a",
    outline: "none",
    background: "#ffffff",
  },
  textarea: {
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    padding: "7px 8px",
    fontSize: "12px",
    color: "#0f172a",
    outline: "none",
    background: "#ffffff",
    minHeight: "78px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  popupFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "10px 12px",
    borderTop: "1px solid #e5e7eb",
    background: "#f8fafc",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "7px 10px",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: "11.5px",
  },
  primaryButton: {
    border: "1px solid #2563eb",
    borderRadius: "4px",
    background: "#2563eb",
    color: "#ffffff",
    padding: "7px 10px",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: "11.5px",
  },
  primaryButtonDisabled: {
    border: "1px solid #93c5fd",
    borderRadius: "4px",
    background: "#93c5fd",
    color: "#ffffff",
    padding: "7px 10px",
    fontWeight: 850,
    cursor: "not-allowed",
    fontSize: "11.5px",
  },
  statusText: {
    color: "#64748b",
    fontSize: "11px",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: "11px",
    fontWeight: 800,
  },

  
};